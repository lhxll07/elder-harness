"""The one thing the phone cannot do for itself: notice that it has gone quiet.

Everything else in this product assumes the app is running while the person uses the phone. A phone
that is switched off, out of battery, or whose app has been killed cannot report any of that — so
"no heartbeat" has to be noticed *here*, and the answer is a person, not another feature.
"""

from __future__ import annotations

import logging
import time
from typing import Any

from . import db, notify

log = logging.getLogger("hotline.watch")

# How long a device may stay silent before the circle is told. Deliberately generous: a phone that
# is charging overnight is not a problem, and crying wolf is how these messages stop being read.
DEFAULT_SILENCE_SECONDS = 6 * 60 * 60


def silent_devices(now: float | None = None, silence_seconds: int = DEFAULT_SILENCE_SECONDS) -> list[dict[str, Any]]:
    now = now if now is not None else time.time()
    with db.db() as connection:
        rows = connection.execute("SELECT * FROM devices").fetchall()
    silent = []
    for row in rows:
        device = dict(row)
        last = device["last_seen_at"]
        # A device that has never checked in is being set up, not missing.
        if last is None:
            continue
        if now - last >= silence_seconds:
            device["silent_seconds"] = int(now - last)
            silent.append(device)
    return silent


def check_silence(
    now: float | None = None,
    silence_seconds: int = DEFAULT_SILENCE_SECONDS,
) -> list[dict[str, Any]]:
    """Raises one alert per silence, and does not repeat while the same silence continues."""
    now = now if now is not None else time.time()
    raised = []
    for device in silent_devices(now, silence_seconds):
        # An alert that was created after the phone's last contact belongs to this same silence
        # episode, even if the family has already claimed it. A later heartbeat moves last_seen_at
        # past that alert, so a genuinely new silence can raise again.
        last_alert = db.latest_alert_at(device["id"])
        if last_alert is not None and last_alert > (device["last_seen_at"] or 0):
            continue
        hours = device["silent_seconds"] // 3600
        minutes = (device["silent_seconds"] % 3600) // 60
        when = f"{hours} 小时" if hours else f"{minutes} 分钟"
        title = f"{device['elder_name'] or '老人'}的手机已经 {when} 没有联系了"
        body = (
            "手机可能只是没电、关机或放在一边。按约定打个电话确认一下；"
            "如果打不通，再联系社区或上门看看。"
        )
        event = db.add_event(device["id"], "alert", "from_device", title=title, body=body)
        members = db.circle_of(device["id"])
        notify.notify_circle(members, "alert", title, body)
        log.warning("[watch] silence alert device=%s event=%s", device["id"], event["id"])
        raised.append(event)
    return raised


async def run_forever(interval_seconds: int = 300, silence_seconds: int = DEFAULT_SILENCE_SECONDS) -> None:
    import asyncio

    while True:
        try:
            check_silence(silence_seconds=silence_seconds)
        except Exception:  # a watcher that dies is worse than one that is late
            log.exception("[watch] check failed")
        await asyncio.sleep(interval_seconds)
