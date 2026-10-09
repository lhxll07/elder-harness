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
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse

from . import load_env

# Configuration is read at import time; load .env before importing modules that snapshot it.
load_env(str(Path(__file__).resolve().parent.parent / ".env"))

from . import db, notify, speech, watch, web  # noqa: E402

log = logging.getLogger("hotline")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

# How often the phone is expected to check in, and how long silence is tolerated before the circle
# is told. Overridable so tests (and a demo) do not have to wait hours.
HEARTBEAT_SECONDS = int(os.environ.get("HOTLINE_HEARTBEAT_SECONDS", "300"))
SILENCE_SECONDS = int(os.environ.get("HOTLINE_SILENCE_SECONDS", str(watch.DEFAULT_SILENCE_SECONDS)))
WATCH_TOKEN = os.environ.get("HOTLINE_WATCH_TOKEN", "").strip()

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


# --------------------------------------------------------------------------- device (the phone)


def device_from_auth(authorization: str | None) -> dict[str, Any]:
    token = (authorization or "").removeprefix("Bearer ").strip()
    device = db.device_by_token(token) if token else None
    if not device:
        raise HTTPException(status_code=401, detail="设备未配对或令牌无效")
    return device


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {"ok": True, "server_time": time.time(), "heartbeat_seconds": HEARTBEAT_SECONDS}


@app.post("/api/device/pair")
def pair(payload: dict[str, Any] = Body(default={})) -> dict[str, Any]:
    """Called once when the family sets the phone up. Returns the token the phone keeps."""
    elder_name = str(payload.get("elder_name", "")).strip()[:40]
    device = db.create_device(elder_name)
    db.touch_device(device["id"], "刚刚配对")
    log.info("[pair] device=%s elder=%r", device["id"], elder_name)
    return {
        "device_id": device["id"],
        "token": device["token"],
        "pair_code": device["pair_code"],
        "pair_code_role": "family",
        "heartbeat_seconds": HEARTBEAT_SECONDS,
    }


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
    if role not in web.ROLE_LABEL:
        raise HTTPException(status_code=400, detail="身份只能是 family / community / neighbor")
    rotated = db.rotate_pair_code(device["id"], role)
    log.info("[invite] device=%s role=%s", device["id"], role)
    return {
        "pair_code": rotated["pair_code"],
        "pair_code_role": role,
        "expires_in": db.PAIR_CODE_TTL_SECONDS,
    }


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
    try:
        text = await speech.transcribe(pcm, keyterms=[device["elder_name"]] if device["elder_name"] else None)
    except speech.SpeechError as error:
        log.warning("[speech] device=%s 失败：%s", device["id"], error)
        raise HTTPException(status_code=503, detail=str(error)) from error
    log.info("[speech] device=%s %d 字节 → %r", device["id"], len(pcm), text[:40])
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
    if kind in {"help", "alert"}:
        notify.notify_circle(db.circle_of(device["id"]), kind, title, body)
    log.info("[event] device=%s kind=%s title=%r", device["id"], kind, title)
    return {"id": event["id"], "created_at": event["created_at"]}


# --------------------------------------------------------------------------- the circle (web)


def member_from_cookie(session: str | None) -> dict[str, Any] | None:
    return db.session_member(session) if session else None


@app.get("/", response_class=HTMLResponse)
def index(session: str | None = Cookie(default=None)):
    if member_from_cookie(session):
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
    role = str(device.get("pair_code_role") or "family")
    if role not in web.ROLE_LABEL:
        role = "family"
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
    log.info("[join] device=%s member=%s role=%s", device["id"], clean_name, role)
    response = RedirectResponse("/family", status_code=303)
    response.set_cookie(
        "session",
        session,
        httponly=True,
        secure=request.url.scheme == "https",
        samesite="lax",
        max_age=60 * 60 * 24 * 365,
    )
    return response


@app.get("/family", response_class=HTMLResponse)
def family(
    session: str | None = Cookie(default=None),
    ok: str = "",
):
    member = member_from_cookie(session)
    if not member:
        return RedirectResponse("/", status_code=303)
    with db.db() as connection:
        row = connection.execute("SELECT * FROM devices WHERE id = ?", (member["device_id"],)).fetchone()
    device = dict(row)
    return HTMLResponse(
        web.dashboard(
            member,
            device,
            db.events_for(device["id"], limit=80),
            db.circle_of(device["id"]),
            SILENCE_SECONDS,
            flash=ok,
        )
    )


@app.post("/family/claim/{event_id}")
def claim(event_id: int, session: str | None = Cookie(default=None)):
    member = member_from_cookie(session)
    if not member:
        return RedirectResponse("/", status_code=303)
    event = db.claim_event(event_id, member["id"], member["device_id"])
    if not event:
        return RedirectResponse("/family?ok=这条求助已经有人接手了", status_code=303)
    db.add_event(
        member["device_id"],
        "ack",
        "to_device",
        title=f"{member['name']}说她来处理",
        body="等一下，我来帮你。",
        created_by=member["id"],
    )
    log.info("[claim] event=%s by=%s", event_id, member["name"])
    return RedirectResponse("/family?ok=你已经接手，老人手机上会收到提示", status_code=303)


@app.post("/family/message")
def message(
    text: str = Form(...),
    session: str | None = Cookie(default=None),
):
    member = member_from_cookie(session)
    if not member:
        return RedirectResponse("/", status_code=303)
    # Only family may put words on the elder's phone: that channel reads as a familiar voice, and it
    # must not be usable by someone the person does not know.
    if member["role"] != "family":
        raise HTTPException(status_code=403, detail="只有家人能给老人留话")
    body = text.strip()[:500]
    if body:
        db.add_event(
            member["device_id"], "message", "to_device", title="留言", body=body, created_by=member["id"]
        )
    return RedirectResponse("/family?ok=已经发到老人手机上", status_code=303)


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


@app.get("/api/devices/{device_id}/summary")
def summary(
    device_id: int,
    session: str | None = Cookie(default=None),
) -> JSONResponse:
    """A small read-only view for the circle member paired with this device."""
    member = member_from_cookie(session)
    if not member or member["device_id"] != device_id:
        # 404 (not 403) avoids confirming which device ids exist.
        raise HTTPException(status_code=404, detail="没有这个设备")
    with db.db() as connection:
        row = connection.execute("SELECT * FROM devices WHERE id = ?", (device_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="没有这个设备")
    device = dict(row)
    return JSONResponse(
        {
            "elder_name": device["elder_name"],
            "last_seen_at": device["last_seen_at"],
            "circle": db.circle_of(device_id),
            "events": db.events_for(device_id, limit=20),
        }
    )
