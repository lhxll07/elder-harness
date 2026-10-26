"""The trusted-circle server.

Three jobs, in the order they matter:

1. **Keep the circle reachable.** The phone reports what happened; the people who care can see it and
   take it over from a web page, with no app to install.
2. **Watch the watcher.** A phone that goes quiet cannot say so. That is the one thing only a server
   can notice (see [watch]).
3. **Keep "trusted" meaningful.** Who is in the circle, what each role may see, and that instructions
   from anyone outside it count for nothing.

Deliberately small: SQLite, no ORM, no background queue, no accounts-and-passwords. The elder's phone
authenticates with a device token; a family member joins once with the pairing code shown on that
phone and keeps a session cookie.
"""

from __future__ import annotations

import logging
import os
import secrets
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import Body, Cookie, FastAPI, Form, Header, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from . import load_env

# Configuration is read at import time; load .env before importing modules that snapshot it.
load_env(str(Path(__file__).resolve().parent.parent / ".env"))

from . import db, family, family_view, notify, speech, watch, web  # noqa: E402

log = logging.getLogger("hotline")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

# How often the phone is expected to check in, and how long silence is tolerated before the circle
# is told. Overridable so tests (and a demo) do not have to wait hours.
HEARTBEAT_SECONDS = int(os.environ.get("HOTLINE_HEARTBEAT_SECONDS", "300"))
SILENCE_SECONDS = int(os.environ.get("HOTLINE_SILENCE_SECONDS", str(watch.DEFAULT_SILENCE_SECONDS)))
WATCH_TOKEN = os.environ.get("HOTLINE_WATCH_TOKEN", "").strip()
ENROLLMENT_TOKEN = os.environ.get("HOTLINE_ENROLLMENT_TOKEN", "").strip()
SPEECH_DEVICE_SECONDS = int(os.environ.get("HOTLINE_SPEECH_DEVICE_DAILY_SECONDS", "600"))
SPEECH_TOTAL_SECONDS = int(os.environ.get("HOTLINE_SPEECH_TOTAL_DAILY_SECONDS", "3600"))

# A pairing code is a setup secret that anyone who can reach this page may try to guess. Its length
# is handled in ``db.new_pair_code``; this is the other half — a guesser gets a few tries, not an
# hour of them. The counter is in-process, which matches the single-process deployment this server
# is designed for; a multi-worker deployment would have to keep it in the database.
JOIN_WINDOW_SECONDS = int(os.environ.get("HOTLINE_JOIN_WINDOW_SECONDS", "600"))
JOIN_MAX_FAILURES = int(os.environ.get("HOTLINE_JOIN_MAX_FAILURES", "5"))
_join_failures: dict[str, list[float]] = {}


def recent_join_failures(ip: str) -> list[float]:
    now = time.time()
    recent = [at for at in _join_failures.get(ip, []) if now - at < JOIN_WINDOW_SECONDS]
    if recent:
        _join_failures[ip] = recent
    else:
        _join_failures.pop(ip, None)
    return recent


def note_join_failure(ip: str) -> None:
    _join_failures.setdefault(ip, []).append(time.time())


@asynccontextmanager
async def lifespan(app: FastAPI):
    import asyncio

    db.init()
    task = asyncio.create_task(watch.run_forever(interval_seconds=300, silence_seconds=SILENCE_SECONDS))
    try:
        yield
    finally:
        task.cancel()


app = FastAPI(title="银龄专线 · 家人与社区", lifespan=lifespan)
app.mount("/static", StaticFiles(directory=Path(__file__).resolve().parent / "static"), name="static")
app.include_router(family.create_router(SILENCE_SECONDS))


# --------------------------------------------------------------------------- device (the phone)


def device_from_auth(authorization: str | None) -> dict[str, Any]:
    token = (authorization or "").removeprefix("Bearer ").strip()
    device = db.device_by_token(token) if token else None
    if not device:
        raise HTTPException(status_code=401, detail="设备未配对或令牌无效")
    return device


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {"ok": True, "server_time": time.time(), "heartbeat_seconds": HEARTBEAT_SECONDS, "notifications_configured": notify.is_configured()}


@app.post("/api/device/pair")
def pair(request: Request, payload: dict[str, Any] = Body(default={})) -> dict[str, Any]:
    """Called once when the family sets the phone up. Returns the token the phone keeps."""
    host = request.client.host if request.client else "unknown"
    supplied = str(payload.get("enrollment_token", ""))
    if ENROLLMENT_TOKEN:
        if not secrets.compare_digest(supplied, ENROLLMENT_TOKEN):
            raise HTTPException(status_code=403, detail="需要服务管理员提供的设备注册口令")
    elif host not in {"127.0.0.1", "::1"}:
        raise HTTPException(status_code=403, detail="公开部署必须配置设备注册口令")
    if not db.consume_quota(host, "pair", 10, 600):
        raise HTTPException(status_code=429, detail="设备注册过于频繁")
    elder_name = str(payload.get("elder_name", "")).strip()[:40]
    device = db.create_device(elder_name)
    db.touch_device(device["id"], "刚刚配对")
    log.info("[pair] device=%s", device["id"])
    return {
        "device_id": device["id"],
        "token": device["token"],
        "pair_code": device["pair_code"],
        "pair_code_role": "family",
        "expires_in": db.PAIR_CODE_TTL_SECONDS,
        "heartbeat_seconds": HEARTBEAT_SECONDS,
    }


@app.post("/api/device/token/rotate")
def rotate_token(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    device = device_from_auth(authorization)
    return {"token": db.rotate_device_token(device["id"])}


@app.get("/api/device/circle")
def list_members(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    device = device_from_auth(authorization)
    return {"members": [{key: member[key] for key in ("id", "name", "role")} for member in db.circle_of(device["id"])]}


@app.delete("/api/device/circle/{member_id}")
def remove_member(member_id: int, authorization: str | None = Header(default=None)) -> dict[str, bool]:
    device = device_from_auth(authorization)
    if not db.revoke_member(device["id"], member_id):
        raise HTTPException(status_code=404, detail="成员不存在")
    return {"ok": True}


@app.post("/api/device/invite")
def invite(
    payload: dict[str, Any] = Body(default={}),
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    """Issue a fresh invite bound to one role, invalidating the phone's previous code.

    Called by the phone when the person wants to add someone to the circle. The role travels with
    the code, so a joiner cannot choose to be 家人; see [join].
    """
    device = device_from_auth(authorization)
    role = str(payload.get("role", "family"))
    if role not in family_view.ROLE_LABEL:
        raise HTTPException(status_code=400, detail="身份只能是 family / community / neighbor")
    rotated = db.rotate_pair_code(device["id"], role)
    log.info("[invite] device=%s role=%s", device["id"], role)
    return {
        "pair_code": rotated["pair_code"],
        "pair_code_role": role,
        "expires_in": db.PAIR_CODE_TTL_SECONDS,
    }


@app.post("/api/device/profile")
def update_profile(
    payload: dict[str, Any] = Body(default={}),
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    device = device_from_auth(authorization)
    name = str(payload.get("elder_name", "")).strip()[:40]
    db.update_device_name(device["id"], name)
    return {"elder_name": name}


@app.post("/api/device/heartbeat")
def heartbeat(
    payload: dict[str, Any] = Body(default={}),
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    """Proof of life, and the phone's inbox: whoever is running is also who gets told things."""
    device = device_from_auth(authorization)
    db.touch_device(device["id"], str(payload.get("note", ""))[:200])
    # Delivered is set by the phone's /ack call, not here: handing a message to the phone and
    # displaying it are two different things, and a crash between them must not eat the message.
    pending = db.pending_for_device(device["id"])
    sender_names = {member["id"]: member["name"] for member in db.circle_of(device["id"])}
    return {
        "ok": True,
        "server_time": time.time(),
        "pending": [
            {
                "id": event["id"],
                "kind": event["kind"],
                "title": event["title"],
                "body": event["body"],
                "from": sender_names.get(event["created_by"], ""),
            }
            for event in pending
        ],
    }


@app.post("/api/device/ack")
def acknowledge(
    payload: dict[str, Any] = Body(default={}),
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    """The phone confirms it displayed a message, or that the elder read it.

    Only this device's own to_device events can be acknowledged, so one paired phone cannot mark
    another phone's inbox as read.
    """
    device = device_from_auth(authorization)
    raw_ids = payload.get("ids", [])
    if not isinstance(raw_ids, list):
        raise HTTPException(status_code=422, detail="ids 必须是数组")
    ids: list[int] = []
    for value in raw_ids[:100]:
        try:
            ids.append(int(value))
        except (TypeError, ValueError):
            continue
    read = bool(payload.get("read", False))
    acked = db.acknowledge_events(device["id"], ids, read=read)
    log.info("[ack] device=%s read=%s ids=%s", device["id"], read, acked)
    return {"ok": True, "read": read, "acked": acked}


@app.get("/api/speech/status")
def speech_status() -> dict[str, Any]:
    """Whether this server can turn speech into text; the phone asks before offering to listen."""
    return {"configured": speech.is_configured(), "style": speech.style()}


@app.post("/api/device/transcribe")
async def transcribe(
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    """Raw 16 kHz mono PCM16 in the body, text out. The phone records; the server holds the keys."""
    device = device_from_auth(authorization)
    max_bytes = speech.SAMPLE_RATE * 2 * speech.MAX_AUDIO_SECONDS
    pcm = bytearray()
    async for chunk in request.stream():
        pcm.extend(chunk)
        if len(pcm) > max_bytes:
            raise HTTPException(status_code=413, detail="语音数据过大")
    pcm = bytes(pcm)
    if len(pcm) < speech.SAMPLE_RATE:  # under ~30ms of audio is a mis-tap, not a sentence
        return {"text": ""}
    if len(pcm) % 2:
        raise HTTPException(status_code=422, detail="音频必须为 PCM16")
    seconds = max(1, (len(pcm) + speech.SAMPLE_RATE * 2 - 1) // (speech.SAMPLE_RATE * 2))
    if not db.consume_quota(str(device["id"]), "speech-minute", 10, 60):
        raise HTTPException(status_code=429, detail="语音请求过于频繁，请稍后再试")
    if not db.consume_quota(str(device["id"]), "speech-daily", SPEECH_DEVICE_SECONDS, 86400, seconds):
        raise HTTPException(status_code=429, detail="本设备今日语音额度已用完")
    if not db.consume_quota("server", "speech-total", SPEECH_TOTAL_SECONDS, 86400, seconds):
        raise HTTPException(status_code=429, detail="服务今日语音总额度已用完")
    try:
        text = await speech.transcribe(pcm, keyterms=[device["elder_name"]] if device["elder_name"] else None)
    except speech.SpeechError as error:
        log.warning("[speech] device=%s failed=%s", device["id"], type(error).__name__)
        raise HTTPException(status_code=503, detail=str(error)) from error
    log.info("[speech] device=%s bytes=%d chars=%d", device["id"], len(pcm), len(text))
    return {"text": text}


@app.post("/api/device/events")
def post_event(
    payload: dict[str, Any] = Body(default={}),
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    """The phone's news: 报平安 / 求助 / 办好了 / 异常."""
    device = device_from_auth(authorization)
    kind = str(payload.get("kind", "")).strip()
    if kind not in {"peace", "help", "done", "alert"}:
        raise HTTPException(status_code=422, detail="未知的事件类型")
    title = str(payload.get("title", "")).strip()[:120]
    body = str(payload.get("body", "")).strip()[:1000]
    context = str(payload.get("context", "")).strip()[:2000]
    event = db.add_event(device["id"], kind, "from_device", title=title, body=body, context=context)
    notification_state = "not_requested"
    accepted = []
    if kind in {"help", "alert"}:
        members = db.circle_of(device["id"])
        accepted = notify.notify_circle(members, kind, title, body) or []
        if not notify.recipients(members, kind):
            notification_state = "no_recipients"
        elif not notify.is_configured():
            notification_state = "not_configured"
        else:
            notification_state = "accepted" if accepted else "failed"
    log.info("[event] device=%s kind=%s", device["id"], kind)
    return {"id": event["id"], "created_at": event["created_at"],
            "notification_state": notification_state, "accepted_recipients": len(accepted)}


# --------------------------------------------------------------------------- the circle (web)


@app.get("/", response_class=HTMLResponse)
def index(session: str | None = Cookie(default=None)):
    if family.member_from_cookie(session):
        return RedirectResponse("/family", status_code=303)
    return HTMLResponse(web.join_page())


@app.post("/join")
def join(
    request: Request,
    pair_code: str = Form(...),
    name: str = Form(...),
    phone: str = Form(default=""),
):
    ip = request.client.host if request.client else "unknown"
    if len(recent_join_failures(ip)) >= JOIN_MAX_FAILURES:
        log.warning("[join] throttled ip=%s", ip)
        return HTMLResponse(
            web.join_page("尝试的次数太多了，请过一会儿再试。"), status_code=429
        )

    device = db.device_by_pair_code(pair_code)
    if not device:
        note_join_failure(ip)
        return HTMLResponse(
            web.join_page("配对码不对，或者老人手机上还没配对成功。"), status_code=400
        )
    _join_failures.pop(ip, None)

    # The role is decided by whoever handed out the code, and travels with it. It is deliberately
    # not read from the form: letting a joiner pick "家人" meant that anyone who guessed a code
    # could read the elder's private context and leave a message the phone reads aloud as
    # "家人留言" — which is exactly the channel phone fraud needs.
    role = str(device.get("pair_code_role", ""))
    if role not in family_view.ROLE_LABEL:
        return HTMLResponse(web.join_page("邀请身份无效，请由老人手机重新生成邀请码。"), status_code=403)
    clean_name = name.strip()[:24] or "家人"
    clean_phone = phone.strip()[:20]
    # Joining twice with the same number updates that person instead of adding a duplicate.
    existing = next(
        (member for member in db.circle_of(device["id"]) if clean_phone and member["phone"] == clean_phone),
        None,
    )
    if existing and existing["role"] != role:
        return HTMLResponse(
            web.join_page("这个手机号已绑定其他身份，请由老人手机上的家人重新确认邀请。"),
            status_code=403,
        )
    member = existing or db.add_circle_member(device["id"], clean_name, clean_phone, role)
    session = db.create_session(member["id"])
    log.info("[join] device=%s member=%s role=%s", device["id"], member["id"], role)
    response = RedirectResponse("/family", status_code=303)
    response.set_cookie(
        "session",
        session,
        httponly=True,
        secure=request.url.scheme == "https",
        samesite="lax",
        max_age=db.SESSION_TTL_SECONDS,
    )
    return response


@app.post("/api/watch/check")
def trigger_watch(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    """For tests and for a cron-style deployment; the background task calls the same function."""
    if not WATCH_TOKEN:
        raise HTTPException(status_code=404, detail="定时检查接口未启用")
    supplied = (authorization or "").removeprefix("Bearer ").strip()
    if not supplied or not secrets.compare_digest(supplied, WATCH_TOKEN):
        raise HTTPException(status_code=401, detail="定时检查令牌无效")
    raised = watch.check_silence(silence_seconds=SILENCE_SECONDS)
    return {"raised": [event["title"] for event in raised]}
