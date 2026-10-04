"""M1 acceptance: pairing, the circle, 求助 hand-over, role boundaries and the silence watcher."""

from __future__ import annotations

import base64
import json
import re
import time
from urllib.parse import unquote

import pytest

from app import db, main, notify, watch
from conftest import auth


def invite(client, device, role="family"):
    """Rotate the phone's invite code to one role. The role travels with the code."""
    response = client.post("/api/device/invite", json={"role": role}, headers=auth(device))
    assert response.status_code == 200
    body = response.json()
    assert body["pair_code_role"] == role
    return body["pair_code"]


def join(client, device, name="大女儿", phone="13800000001", role="family"):
    """Join the circle. There is no role field on the form: the invite already carries it."""
    response = client.post(
        "/join",
        data={"pair_code": invite(client, device, role), "name": name, "phone": phone},
        follow_redirects=False,
    )
    assert response.status_code == 303
    return response


def test_pairing_returns_a_token_and_code(client):
    response = client.post("/api/device/pair", json={"elder_name": "妈妈"})
    body = response.json()
    assert body["token"] and len(body["pair_code"]) == 8
    assert body["heartbeat_seconds"] > 0


def test_device_without_token_is_rejected(client):
    assert client.post("/api/device/heartbeat", json={}).status_code == 401
    assert client.post("/api/device/events", json={"kind": "help"}).status_code == 401


def test_heartbeat_records_life_and_returns_the_inbox(client, device):
    client.post("/api/device/heartbeat", json={"note": "正在守护"}, headers=auth(device))
    with db.db() as connection:
        row = connection.execute("SELECT * FROM devices").fetchone()
    assert row["last_seen_at"] is not None
    assert row["last_seen_note"] == "正在守护"


def test_wrong_pair_code_is_refused(client, device):
    response = client.post(
        "/join",
        data={"pair_code": "ZZZZZZZZ", "name": "陌生人", "phone": "139"},
    )
    assert response.status_code == 400
    assert db.circle_of(device["device_id"]) == []


def test_a_joiner_cannot_pick_their_own_role(client, device):
    """The old form let anyone who held a code choose 家人. The role now travels with the invite."""
    code = invite(client, device, "neighbor")
    response = client.post(
        "/join",
        data={"pair_code": code, "name": "陌生人", "phone": "139", "role": "family"},
        follow_redirects=False,
    )
    assert response.status_code == 303
    assert [member["role"] for member in db.circle_of(device["device_id"])] == ["neighbor"]


def test_repeated_wrong_codes_are_throttled(client, device):
    for _ in range(main.JOIN_MAX_FAILURES):
        response = client.post("/join", data={"pair_code": "ZZZZZZZZ", "name": "陌生人", "phone": "139"})
        assert response.status_code == 400

    blocked = client.post("/join", data={"pair_code": "ZZZZZZZZ", "name": "陌生人", "phone": "139"})
    assert blocked.status_code == 429
    # A correct code does not get through either while the throttle is on: a guesser learns nothing
    # from the difference between "wrong" and "right but throttled".
    known = client.post(
        "/join",
        data={"pair_code": invite(client, device, "family"), "name": "大女儿", "phone": "13800000001"},
    )
    assert known.status_code == 429


def test_invite_needs_the_device_token_and_a_known_role(client, device):
    assert client.post("/api/device/invite", json={"role": "family"}).status_code == 401
    assert client.post(
        "/api/device/invite", json={"role": "family"}, headers=auth(device)
    ).status_code == 200
    assert client.post(
        "/api/device/invite", json={"role": "root"}, headers=auth(device)
    ).status_code == 400


def test_family_sees_the_elder_and_the_timeline(client, device):
    join(client, device)
    client.post(
        "/api/device/events",
        json={"kind": "peace", "title": "报平安", "body": "今天正常"},
        headers=auth(device),
    )
    page = client.get("/family").text
    assert "妈妈" in page
    assert "报平安" in page


def test_help_request_notifies_only_those_who_can_act(client, device, monkeypatch):
    sent = []
    monkeypatch.setattr(notify, "notify_circle", lambda members, kind, title, body: sent.append((kind, title)))
    join(client, device, name="大女儿", phone="13800000001", role="family")
    join(client, device, name="张网格员", phone="13800000002", role="community")
    join(client, device, name="隔壁老王", phone="13800000003", role="neighbor")

    client.post(
        "/api/device/events",
        json={"kind": "help", "title": "需要人帮忙", "body": "卡在验证码", "context": "正在给女儿发微信"},
        headers=auth(device),
    )
    assert sent and sent[0][0] == "help"

    members = db.circle_of(device["device_id"])
    assert {m["name"] for m in notify.recipients(members, "help")} == {"大女儿", "张网格员", "隔壁老王"}
    # 报平安 goes to family only: the community does not need to read it.
    assert {m["name"] for m in notify.recipients(members, "peace")} == {"大女儿"}


def test_claiming_a_help_request_answers_the_phone(client, device):
    join(client, device, name="大女儿")
    created = client.post(
        "/api/device/events",
        json={"kind": "help", "title": "需要人帮忙", "body": "卡在验证码"},
        headers=auth(device),
    ).json()

    response = client.post(f"/family/claim/{created['id']}", follow_redirects=False)
    assert response.status_code == 303

    with db.db() as connection:
        event = connection.execute("SELECT * FROM events WHERE id = ?", (created["id"],)).fetchone()
    assert event["status"] == "claimed"

    inbox = client.post("/api/device/heartbeat", json={}, headers=auth(device)).json()["pending"]
    assert any(item["kind"] == "ack" and "大女儿" in item["title"] for item in inbox)
    # Heartbeat only hands it over; the phone must confirm before the server stops resending it.
    assert client.post("/api/device/heartbeat", json={}, headers=auth(device)).json()["pending"]
    acked = client.post(
        "/api/device/ack",
        json={"ids": [item["id"] for item in inbox]},
        headers=auth(device),
    )
    assert acked.status_code == 200 and set(acked.json()["acked"]) == {item["id"] for item in inbox}
    assert client.post("/api/device/heartbeat", json={}, headers=auth(device)).json()["pending"] == []


def test_second_claim_does_not_queue_another_ack(client, device):
    join(client, device, name="大女儿")
    created = client.post(
        "/api/device/events",
        json={"kind": "help", "title": "需要人帮忙", "body": "卡在验证码"},
        headers=auth(device),
    ).json()

    first = client.post(f"/family/claim/{created['id']}", follow_redirects=False)
    assert first.status_code == 303

    second = client.post(f"/family/claim/{created['id']}", follow_redirects=False)
    assert second.status_code == 303
    assert "已经有人接手" in unquote(second.headers["location"])

    with db.db() as connection:
        ack_count = connection.execute(
            "SELECT COUNT(*) FROM events WHERE device_id = ? AND kind = 'ack' AND direction = 'to_device'",
            (device["device_id"],),
        ).fetchone()[0]
    assert ack_count == 1


def test_community_cannot_put_words_on_the_elder_phone(client, device):
    join(client, device, name="张网格员", phone="13800000002", role="community")
    response = client.post("/family/message", data={"text": "在家吗"}, follow_redirects=False)
    assert response.status_code == 403
    assert db.pending_for_device(device["device_id"]) == []


def test_family_message_reaches_the_phone(client, device):
    join(client, device, name="大女儿")
    client.post("/family/message", data={"text": "明天下午我来看你"}, follow_redirects=False)
    inbox = client.post("/api/device/heartbeat", json={}, headers=auth(device)).json()["pending"]
    assert inbox and inbox[0]["body"] == "明天下午我来看你"
    assert inbox[0]["from"] == "大女儿"


def test_family_message_receipt_goes_from_waiting_to_seen(client, device):
    join(client, device, name="大女儿")
    client.post("/family/message", data={"text": "记得吃药"}, follow_redirects=False)

    page = client.get("/family").text
    assert "等待老人手机收取" in page

    inbox = client.post("/api/device/heartbeat", json={}, headers=auth(device)).json()["pending"]
    assert inbox
    page = client.get("/family").text
    assert "等待老人手机收取" in page  # handing it to the phone is not display yet

    response = client.post(
        "/api/device/ack",
        json={"ids": [inbox[0]["id"]]},
        headers=auth(device),
    )
    assert response.status_code == 200
    assert "已到手机" in client.get("/family").text
    assert "老人已看到" not in client.get("/family").text

    response = client.post(
        "/api/device/ack",
        json={"ids": [inbox[0]["id"]], "read": True},
        headers=auth(device),
    )
    assert response.status_code == 200
    page = client.get("/family").text
    assert "老人已看到" in page
    # After the read receipt, the server must not send it again.
    assert client.post("/api/device/heartbeat", json={}, headers=auth(device)).json()["pending"] == []


def test_ack_cannot_touch_another_devices_inbox(client, device):
    other = client.post("/api/device/pair", json={"elder_name": "爸爸"}).json()
    event = db.add_event(device["device_id"], "message", "to_device", title="留言", body="给我的")
    response = client.post(
        "/api/device/ack",
        json={"ids": [event["id"]], "read": True},
        headers=auth(other),
    )
    assert response.status_code == 200 and response.json()["acked"] == []
    inbox = client.post("/api/device/heartbeat", json={}, headers=auth(device)).json()["pending"]
    assert [item["id"] for item in inbox] == [event["id"]]


def test_community_sees_that_help_is_needed_but_not_the_context(client, device):
    join(client, device, name="大女儿", phone="13800000001", role="family")
    client.post(
        "/api/device/events",
        json={"kind": "help", "title": "需要人帮忙", "body": "卡住了", "context": "正在输入银行卡号"},
        headers=auth(device),
    )
    family_page = client.get("/family").text
    assert "正在输入银行卡号" in family_page

    other = client.post(
        "/join",
        data={"pair_code": invite(client, device, "community"), "name": "张网格员", "phone": "13800000002"},
        follow_redirects=False,
    )
    community = _CookieClient(other.cookies)
    community_page = community.get("/family").text
    assert "需要人帮忙" in community_page
    assert "正在输入银行卡号" not in community_page


class _CookieClient:
    """Reuse the session cookie the join response handed out."""

    def __init__(self, cookies):
        from fastapi.testclient import TestClient

        from app import main

        self._client = TestClient(main.app)
        for key, value in cookies.items():
            self._client.cookies.set(key, value)

    def get(self, path):
        return self._client.get(path)


def test_silence_raises_one_alert_per_outage(client, device):
    client.post("/api/device/heartbeat", json={}, headers=auth(device))
    with db.db() as connection:
        connection.execute("UPDATE devices SET last_seen_at = ?", (time.time() - 7 * 3600,))

    raised = watch.check_silence(silence_seconds=6 * 3600)
    assert len(raised) == 1 and "没有联系" in raised[0]["title"]
    # Checking again while the same silence continues must not spam the circle.
    assert watch.check_silence(silence_seconds=6 * 3600) == []


def test_claimed_silence_alert_still_suppresses_repeats(client, device):
    join(client, device, name="大女儿")
    client.post("/api/device/heartbeat", json={}, headers=auth(device))
    with db.db() as connection:
        connection.execute("UPDATE devices SET last_seen_at = ?", (time.time() - 7 * 3600,))

    raised = watch.check_silence(silence_seconds=6 * 3600)
    assert len(raised) == 1
    response = client.post(f"/family/claim/{raised[0]['id']}", follow_redirects=False)
    assert response.status_code == 303
    # Claiming the alert does not mean the silence is over; do not raise another one.
    assert watch.check_silence(silence_seconds=6 * 3600) == []


def test_a_device_that_never_checked_in_is_not_missing(client, device):
    # Pairing counts as contact; a device that has genuinely never checked in is still being set up.
    with db.db() as connection:
        connection.execute("UPDATE devices SET last_seen_at = NULL")
    assert watch.check_silence(silence_seconds=0) == []


def test_page_text_is_escaped(client, device):
    join(client, device)
    client.post(
        "/api/device/events",
        json={"kind": "help", "title": "<script>alert(1)</script>", "body": "x"},
        headers=auth(device),
    )
    page = client.get("/family").text
    assert "<script>alert(1)</script>" not in page
    assert "&lt;script&gt;" in page


def test_summary_shape_is_stable(client, device):
    join(client, device)
    body = client.get(f"/api/devices/{device['device_id']}/summary").json()
    assert body["elder_name"] == "妈妈"
    assert [member["role"] for member in body["circle"]] == ["family"]
    assert re.fullmatch(r"[A-HJ-NP-Z2-9]{8}", device["pair_code"])  # no I/O/0/1 look-alikes



def test_summary_requires_a_circle_session(client, device):
    response = client.get(f"/api/devices/{device['device_id']}/summary")
    assert response.status_code == 404


def test_a_circle_cannot_claim_another_devices_help(client, device):
    other = client.post("/api/device/pair", json={"elder_name": "爸爸"}).json()
    join(client, other, name="别人家的家人", phone="13800000009", role="family")

    created = client.post(
        "/api/device/events",
        json={"kind": "help", "title": "需要人帮忙", "body": "卡住了"},
        headers=auth(device),
    ).json()

    response = client.post(f"/family/claim/{created['id']}", follow_redirects=False)
    assert response.status_code == 303
    with db.db() as connection:
        row = connection.execute("SELECT status FROM events WHERE id = ?", (created["id"],)).fetchone()
    assert row["status"] == "new"
    acks = db.pending_for_device(device["device_id"])
    assert all(item["kind"] != "ack" for item in acks)


def test_expired_pair_code_is_refused(client, device):
    with db.db() as connection:
        connection.execute(
            "UPDATE devices SET pair_code_expires_at = ? WHERE id = ?",
            (time.time() - 1, device["device_id"]),
        )
    response = client.post(
        "/join",
        data={"pair_code": device["pair_code"], "name": "过期的人", "phone": "139", "role": "family"},
        follow_redirects=False,
    )
    assert response.status_code == 400


def test_transcribe_rejects_oversized_audio(client, device):
    from app import speech

    too_big = b"\x00" * (speech.SAMPLE_RATE * 2 * speech.MAX_AUDIO_SECONDS + 1)
    response = client.post("/api/device/transcribe", content=too_big, headers=auth(device))
    assert response.status_code == 413


# --------------------------------------------------------------------------- 语音识别（讯飞）

def test_frame_shapes_for_both_protocol_styles():
    from app import speech

    classic = json.loads(speech.frame_for(speech.STYLE_CLASSIC, "appid", b"\x01\x02", 0, 3))
    assert classic["common"]["app_id"] == "appid"
    assert classic["data"]["status"] == 0 and classic["data"]["format"] == "audio/L16;rate=16000"
    assert base64.b64decode(classic["data"]["audio"]) == b"\x01\x02"

    new = json.loads(speech.frame_for(speech.STYLE_NEW, "appid", b"\x01\x02", 2, 9))
    assert new["header"]["app_id"] == "appid" and new["header"]["status"] == 2
    assert new["payload"]["audio"]["sample_rate"] == 16000
    assert new["payload"]["audio"]["seq"] == 9


def test_result_parsing_keeps_the_newest_text():
    from app import speech

    classic = {"code": 0, "data": {"status": 1, "result": {"ws": [{"cw": [{"w": "打开"}, {"w": "微信"}]}]}}}
    assert speech.text_of(speech.STYLE_CLASSIC, classic) == "打开微信"
    assert speech.finished(speech.STYLE_CLASSIC, {"data": {"status": 2}}) is True

    payload = base64.b64encode(json.dumps({"ws": [{"cw": [{"w": "我到家了"}]}]}).encode()).decode()
    new = {"header": {"code": 0, "status": 2}, "payload": {"result": {"text": payload}}}
    assert speech.text_of(speech.STYLE_NEW, new) == "我到家了"
    assert speech.finished(speech.STYLE_NEW, new) is True


def test_recognition_errors_are_surfaced():
    from app import speech

    with pytest.raises(speech.SpeechError):
        speech.text_of(speech.STYLE_CLASSIC, {"code": 10404, "message": "no category route found"})
    with pytest.raises(speech.SpeechError):
        speech.text_of(speech.STYLE_NEW, {"header": {"code": 10404, "message": "no route"}})


def test_transcribe_endpoint_needs_a_device_and_returns_text(client, device, monkeypatch):
    from app import speech

    pcm = b"\x00\x01" * 8000  # half a second of PCM
    assert client.post("/api/device/transcribe", content=pcm).status_code == 401

    async def fake(pcm_bytes, keyterms=None):
        assert len(pcm_bytes) == len(pcm)
        return "打开微信"

    monkeypatch.setattr(speech, "transcribe", fake)
    response = client.post("/api/device/transcribe", content=pcm, headers=auth(device))
    assert response.status_code == 200 and response.json()["text"] == "打开微信"


def test_transcribe_failure_is_reported_as_unavailable(client, device, monkeypatch):
    from app import speech

    async def boom(pcm_bytes, keyterms=None):
        raise speech.SpeechError("连不上语音识别服务")

    monkeypatch.setattr(speech, "transcribe", boom)
    response = client.post("/api/device/transcribe", content=b"\x00\x01" * 8000, headers=auth(device))
    assert response.status_code == 503


def test_speech_status_endpoint(client):
    body = client.get("/api/speech/status").json()
    assert set(body) == {"configured", "style"}


def test_watch_check_is_disabled_without_a_server_token(client, monkeypatch):
    from app import main, watch

    monkeypatch.setattr(main, "WATCH_TOKEN", "")
    monkeypatch.setattr(watch, "check_silence", lambda **kwargs: pytest.fail("unauthorized watcher ran"))
    assert client.post("/api/watch/check").status_code == 404


def test_watch_check_rejects_wrong_token_without_running(client, monkeypatch):
    from app import main, watch

    monkeypatch.setattr(main, "WATCH_TOKEN", "watch-secret")
    monkeypatch.setattr(watch, "check_silence", lambda **kwargs: pytest.fail("unauthorized watcher ran"))
    assert client.post("/api/watch/check", headers={"Authorization": "Bearer wrong"}).status_code == 401
    assert client.post("/api/watch/check").status_code == 401


def test_watch_check_accepts_the_configured_token(client, monkeypatch):
    from app import main, watch

    monkeypatch.setattr(main, "WATCH_TOKEN", "watch-secret")
    monkeypatch.setattr(watch, "check_silence", lambda **kwargs: [{"title": "有人需要帮助"}])
    response = client.post("/api/watch/check", headers={"Authorization": "Bearer watch-secret"})
    assert response.status_code == 200
    assert response.json() == {"raised": ["有人需要帮助"]}
