from __future__ import annotations

from typing import Any

ROLE_LABEL = {"family": "家人", "community": "社区", "neighbor": "邻居"}
VISIBLE_KINDS = {
    "family": {"peace", "help", "done", "alert", "message", "ack"},
    "community": {"help", "alert", "ack"},
    "neighbor": {"help"},
}


def visible_events(events: list[dict[str, Any]], role: str) -> list[dict[str, Any]]:
    visible = VISIBLE_KINDS.get(role, set())
    return [
        {**event, "context": event.get("context", "") if role == "family" else ""}
        for event in events
        if event["kind"] in visible
    ]


def visible_circle(members: list[dict[str, Any]], role: str) -> list[dict[str, Any]]:
    return [
        {**member, "phone": member.get("phone", "") if role == "family" else ""}
        for member in members
    ] if role in ROLE_LABEL else []


def claimable_kinds(role: str) -> tuple[str, ...]:
    return tuple(kind for kind in ("help", "alert") if kind in VISIBLE_KINDS.get(role, set()))
