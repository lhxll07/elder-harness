"""Optional notification relay. Acceptance is not a delivery/read receipt."""

from __future__ import annotations

import logging
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

log = logging.getLogger("hotline.notify")


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, file_pointer, code, message, headers, new_url):
        return None


def is_configured() -> bool:
    return bool(os.environ.get("HOTLINE_NOTIFY_WEBHOOK", "").strip() and os.environ.get("HOTLINE_NOTIFY_TOKEN", "").strip())

# What each role is expected to hear about.
ROLE_SCOPE = {
    "family": {"peace", "help", "done", "alert"},
    "community": {"help", "alert"},
    "neighbor": {"help"},
}


def recipients(members: list[dict[str, Any]], kind: str) -> list[dict[str, Any]]:
    return [member for member in members if kind in ROLE_SCOPE.get(member["role"], set())]


def notify_circle(members: list[dict[str, Any]], kind: str, title: str, body: str) -> list[str]:
    """Returns relay-accepted recipients, never inferred delivery/read receipts."""
    targets = recipients(members, kind)
    if not targets or not is_configured():
        log.info("[notify] kind=%s configured=%s targets=%d", kind, is_configured(), len(targets))
        return []
    url = os.environ["HOTLINE_NOTIFY_WEBHOOK"].strip()
    try:
        parsed = urllib.parse.urlsplit(url)
    except ValueError:
        log.error("[notify] invalid relay URL")
        return []
    if parsed.username or parsed.password or parsed.fragment or not parsed.hostname or not (
        parsed.scheme == "https" or (parsed.scheme == "http" and parsed.hostname in {"127.0.0.1", "::1", "localhost"})
    ):
        log.error("[notify] invalid relay URL")
        return []
    payload = {
        "kind": kind,
        "recipients": [
            {"id": member["id"], "role": member["role"], "phone": member["phone"],
             "title": title if member["role"] == "family" else "守护圈需要您查看",
             "body": body if member["role"] == "family" else "请打开守护圈查看您有权限处理的提醒。"}
            for member in targets
        ],
    }
    request = urllib.request.Request(url, data=json.dumps(payload).encode(), headers={
        "Content-Type": "application/json", "Authorization": "Bearer " + os.environ["HOTLINE_NOTIFY_TOKEN"],
    }, method="POST")
    try:
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
        with opener.open(request, timeout=5) as response:
            if not 200 <= response.status < 300:
                return []
        log.info("[notify] relay_accepted kind=%s targets=%d", kind, len(targets))
        return [member["phone"] for member in targets if member["phone"]]
    except (OSError, ValueError, urllib.error.URLError):
        log.warning("[notify] relay_failed kind=%s; event remains available on dashboard", kind)
        return []
