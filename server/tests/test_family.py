from __future__ import annotations

from urllib.parse import unquote

import pytest

from app import db
from conftest import auth, join


@pytest.mark.parametrize("role", ["family", "community", "neighbor"])
def test_summary_applies_dashboard_role_and_privacy_rules(client, device, role):
    join(client, device, role="family", phone="13800000009")
    client.cookies.clear()
    join(client, device, role=role, phone="13800000008")
    for kind in ("peace", "help", "done", "alert", "message", "ack"):
        db.add_event(device["device_id"], kind, "from_device", title=kind, context="仅限家人的背景")
    response = client.get(f"/api/devices/{device['device_id']}/summary")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    body = response.json()
    expected = {
        "family": {"peace", "help", "done", "alert", "message", "ack"},
        "community": {"help", "alert", "ack"},
        "neighbor": {"help"},
    }
    assert {event["kind"] for event in body["events"]} == expected[role]
    if role == "family":
        assert all(event["context"] == "仅限家人的背景" for event in body["events"])
        assert any(member["phone"] == "13800000009" for member in body["circle"])
    else:
        assert all(event["context"] == "" for event in body["events"])
        assert all(member["phone"] == "" for member in body["circle"])
        assert "仅限家人的背景" not in client.get("/family").text
        assert "13800000009" not in client.get("/family").text


def test_unknown_role_fails_closed(client, device, monkeypatch):
    join(client, device)
    original_session_member = db.session_member
    monkeypatch.setattr(db, "session_member", lambda token: {**original_session_member(token), "role": "unknown"})
    event = db.add_event(device["device_id"], "help", "from_device", context="私密内容")
    body = client.get(f"/api/devices/{device['device_id']}/summary").json()
    assert body["events"] == []
    assert body["circle"] == []
    client.post(f"/family/claim/{event['id']}")
    assert db.events_for(device["device_id"])[0]["status"] == "new"


def test_neighbor_cannot_claim_contact_alerts(client, device):
    join(client, device, role="neighbor")
    alert = db.add_event(device["device_id"], "alert", "from_device", title="联系提醒")
    response = client.post(f"/family/claim/{alert['id']}", follow_redirects=False)
    assert response.status_code == 303
    assert db.events_for(device["device_id"])[0]["status"] == "new"
    assert len(db.events_for(device["device_id"])) == 1
    help_event = db.add_event(device["device_id"], "help", "from_device", title="需要帮忙")
    client.post(f"/family/claim/{help_event['id']}")
    claimed = next(event for event in db.events_for(device["device_id"]) if event["id"] == help_event["id"])
    assert claimed["status"] == "claimed"


def test_pending_requests_survive_activity_window(client, device):
    join(client, device)
    request = db.add_event(device["device_id"], "help", "from_device", title="旧求助仍须处理")
    for index in range(85):
        db.add_event(device["device_id"], "peace", "from_device", title=f"平安记录 {index}")
    page = client.get("/family").text
    assert "旧求助仍须处理" in page
    assert f'action="/family/claim/{request["id"]}"' in page
    client.post(f"/family/claim/{request['id']}")
    page = client.get("/family").text
    assert "旧求助仍须处理" in page
    assert "大女儿 已经接手" in page
    assert f'action="/family/claim/{request["id"]}"' not in page


def test_logout_revokes_the_server_session(client, device):
    join(client, device)
    old_token = client.cookies.get("session")
    assert db.session_member(old_token) is not None
    response = client.post("/family/logout", follow_redirects=False)
    assert response.status_code == 303
    assert db.session_member(old_token) is None
    client.cookies.set("session", old_token)
    assert client.get("/family", follow_redirects=False).status_code == 303
    assert client.get(f"/api/devices/{device['device_id']}/summary").status_code == 404


def test_logout_is_safe_without_a_session(client):
    assert client.post("/family/logout", follow_redirects=False).status_code == 303


@pytest.mark.parametrize("text", ["", "  \n  ", "字" * 501])
def test_invalid_messages_are_rejected_without_events(client, device, text):
    join(client, device)
    response = client.post("/family/message", data={"text": text}, follow_redirects=False)
    assert response.status_code == 422
    assert db.events_for(device["device_id"]) == []


def test_message_and_claim_feedback_do_not_claim_delivery(client, device):
    join(client, device)
    message = client.post("/family/message", data={"text": "明天见"}, follow_redirects=False)
    assert "等待老人手机收取" in unquote(message.headers["location"])
    event = db.add_event(device["device_id"], "help", "from_device")
    claim = client.post(f"/family/claim/{event['id']}", follow_redirects=False)
    assert "等待老人手机收取" in unquote(claim.headers["location"])
    assert all(not event["delivered"] for event in db.events_for(device["device_id"]))


def test_profile_update_keeps_pairing_and_circle(client, device):
    join(client, device)
    before = db.device_by_id(device["device_id"])
    members = db.circle_of(device["device_id"])
    assert client.post("/api/device/profile", json={"elder_name": "新称呼"}).status_code == 401
    response = client.post("/api/device/profile", json={"elder_name": "  外婆  "}, headers=auth(device))
    assert response.status_code == 200
    assert response.json() == {"elder_name": "外婆"}
    after = db.device_by_id(device["device_id"])
    assert {key: after[key] for key in ("id", "token", "pair_code")} == {key: before[key] for key in ("id", "token", "pair_code")}
    assert db.circle_of(device["device_id"]) == members
    assert "外婆的近况" in client.get("/family").text
    assert client.post("/api/device/heartbeat", json={}, headers=auth(device)).status_code == 200


def test_dashboard_is_uncached_and_stylesheet_is_available(client, device):
    join(client, device)
    response = client.get("/family")
    assert response.headers["cache-control"] == "no-store"
    assert 'href="/static/family.css"' in response.text
    stylesheet = client.get("/static/family.css")
    assert stylesheet.status_code == 200
    assert stylesheet.headers["content-type"].startswith("text/css")
    assert "prefers-reduced-motion" in stylesheet.text


def test_pairing_reports_invitation_lifetime(device):
    assert device["expires_in"] == db.PAIR_CODE_TTL_SECONDS


@pytest.mark.parametrize("role", ["unknown", ""])
def test_invalid_invitation_role_never_grants_family_access(client, device, role):
    with db.db() as connection:
        connection.execute("UPDATE devices SET pair_code_role = ? WHERE id = ?", (role, device["device_id"]))
    response = client.post("/join", data={"pair_code": device["pair_code"], "name": "加入者"}, follow_redirects=False)
    assert response.status_code == 403
    assert db.circle_of(device["device_id"]) == []
