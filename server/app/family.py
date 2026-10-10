from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Cookie, Form, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse

from . import db, family_view, web

log = logging.getLogger("hotline.family")


def member_from_cookie(session: str | None) -> dict[str, Any] | None:
    return db.session_member(session) if session else None


def create_router(silence_seconds: int) -> APIRouter:
    router = APIRouter()

    @router.get("/family", response_class=HTMLResponse)
    def dashboard(session: str | None = Cookie(default=None), ok: str = ""):
        member = member_from_cookie(session)
        if not member:
            return RedirectResponse("/", status_code=303)
        device = db.device_by_id(member["device_id"])
        if not device:
            raise HTTPException(status_code=404, detail="没有这个设备")
        return HTMLResponse(
            web.dashboard(
                member,
                device,
                db.events_for(device["id"], limit=80),
                db.circle_of(device["id"]),
                silence_seconds,
                flash=ok,
                requests=db.open_requests_for(device["id"]),
            ),
            headers={"Cache-Control": "no-store"},
        )

    @router.post("/family/claim/{event_id}")
    def claim(event_id: int, session: str | None = Cookie(default=None)):
        member = member_from_cookie(session)
        if not member:
            return RedirectResponse("/", status_code=303)
        event = db.claim_event(
            event_id,
            member["id"],
            member["device_id"],
            allowed_kinds=family_view.claimable_kinds(member["role"]),
        )
        if not event:
            return RedirectResponse("/family?ok=这条求助已经有人接手了，或您没有处理权限", status_code=303)
        db.add_event(
            member["device_id"],
            "ack",
            "to_device",
            title=f"{member['name']}说由自己来处理",
            body="等一下，我来帮你。",
            created_by=member["id"],
        )
        log.info("[claim] event=%s member=%s", event_id, member["id"])
        return RedirectResponse("/family?ok=你已经接手，回话正在等待老人手机收取", status_code=303)

    @router.post("/family/message")
    def message(text: str = Form(..., max_length=500), session: str | None = Cookie(default=None)):
        member = member_from_cookie(session)
        if not member:
            return RedirectResponse("/", status_code=303)
        if member["role"] != "family":
            raise HTTPException(status_code=403, detail="只有家人能给老人留话")
        body = text.strip()
        if not body:
            raise HTTPException(status_code=422, detail="请填写留言内容")
        db.add_event(
            member["device_id"], "message", "to_device", title="留言", body=body, created_by=member["id"]
        )
        return RedirectResponse("/family?ok=留言已提交，等待老人手机收取", status_code=303)

    @router.post("/family/logout")
    def logout(session: str | None = Cookie(default=None)):
        if session:
            db.delete_session(session)
        response = RedirectResponse("/", status_code=303)
        response.delete_cookie("session")
        return response

    @router.get("/api/devices/{device_id}/summary")
    def summary(device_id: int, session: str | None = Cookie(default=None)) -> JSONResponse:
        member = member_from_cookie(session)
        if not member or member["device_id"] != device_id:
            raise HTTPException(status_code=404, detail="没有这个设备")
        device = db.device_by_id(device_id)
        if not device:
            raise HTTPException(status_code=404, detail="没有这个设备")
        role = member["role"]
        return JSONResponse(
            {
                "elder_name": device["elder_name"],
                "last_seen_at": device["last_seen_at"],
                "circle": family_view.visible_circle(db.circle_of(device_id), role),
                "events": family_view.visible_events(db.events_for(device_id, limit=20), role),
            },
            headers={"Cache-Control": "no-store"},
        )

    return router
