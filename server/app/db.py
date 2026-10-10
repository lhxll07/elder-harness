"""SQLite storage for the trusted-circle server.

Deliberately plain: one file, stdlib ``sqlite3``, no ORM. The data here is small (one row per
device, a handful per circle, a few events a day) and being able to read the whole schema on one
screen matters more than convenience.
"""

from __future__ import annotations

import json
import os
import secrets
import sqlite3
import time
from contextlib import contextmanager
from typing import Any, Iterator

DB_PATH = os.environ.get("HOTLINE_DB", os.path.join(os.path.dirname(__file__), "..", "hotline.db"))
# A pairing code is a setup secret, not a permanent password. The phone can always re-pair.
PAIR_CODE_TTL_SECONDS = int(os.environ.get("HOTLINE_PAIR_TTL_SECONDS", "3600"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS devices (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    token         TEXT NOT NULL UNIQUE,
    pair_code     TEXT NOT NULL UNIQUE,
    pair_code_expires_at REAL NOT NULL,
    elder_name    TEXT NOT NULL DEFAULT '',
    created_at    REAL NOT NULL,
    last_seen_at  REAL,
    last_seen_note TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS circle (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id  INTEGER NOT NULL REFERENCES devices(id),
    name       TEXT NOT NULL,
    phone      TEXT NOT NULL DEFAULT '',
    -- family sees everything about the person; community and neighbours see that help is needed,
    -- not the contents of private messages.
    role       TEXT NOT NULL CHECK (role IN ('family', 'community', 'neighbor')),
    created_at REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    circle_id  INTEGER NOT NULL REFERENCES circle(id),
    created_at REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id   INTEGER NOT NULL REFERENCES devices(id),
    -- from the phone: peace | help | done | alert ; to the phone: message | ack
    kind        TEXT NOT NULL,
    direction   TEXT NOT NULL CHECK (direction IN ('from_device', 'to_device')),
    title       TEXT NOT NULL DEFAULT '',
    body        TEXT NOT NULL DEFAULT '',
    -- what the phone was doing when it asked for help; never shown to community/neighbour roles.
    context     TEXT NOT NULL DEFAULT '',
    created_at  REAL NOT NULL,
    created_by  INTEGER REFERENCES circle(id),
    status      TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'claimed', 'closed')),
    claimed_by  INTEGER REFERENCES circle(id),
    claimed_at  REAL,
    -- delivered stays for older rows; delivered_at says when the phone displayed it.
    delivered   INTEGER NOT NULL DEFAULT 0,
    delivered_at REAL,
    read_at     REAL
);

CREATE INDEX IF NOT EXISTS events_device_idx ON events (device_id, id);
"""


def connect() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute("PRAGMA foreign_keys=ON")
    return connection


def init(path: str | None = None) -> None:
    global DB_PATH
    if path:
        DB_PATH = path
    with connect() as connection:
        connection.executescript(SCHEMA)
        # Existing demo databases predate the two receipt columns. SQLite has no
        # "ADD COLUMN IF NOT EXISTS", so check the small schema first.
        columns = {row[1] for row in connection.execute("PRAGMA table_info(events)").fetchall()}
        if "delivered_at" not in columns:
            connection.execute("ALTER TABLE events ADD COLUMN delivered_at REAL")
        if "read_at" not in columns:
            connection.execute("ALTER TABLE events ADD COLUMN read_at REAL")
        device_columns = {
            row[1] for row in connection.execute("PRAGMA table_info(devices)").fetchall()
        }
        if "pair_code_expires_at" not in device_columns:
            connection.execute("ALTER TABLE devices ADD COLUMN pair_code_expires_at REAL")
            connection.execute(
                "UPDATE devices SET pair_code_expires_at = created_at + ?",
                (PAIR_CODE_TTL_SECONDS,),
            )
        if "pair_code_role" not in device_columns:
            # Databases from before roles were bound to the invite: every existing code was a
            # family invite, because that was the only thing the join form offered.
            connection.execute(
                "ALTER TABLE devices ADD COLUMN pair_code_role TEXT NOT NULL DEFAULT 'family'"
            )


@contextmanager
def db() -> Iterator[sqlite3.Connection]:
    connection = connect()
    try:
        yield connection
        connection.commit()
    finally:
        connection.close()


def new_token() -> str:
    return secrets.token_urlsafe(24)


def new_pair_code() -> str:
    # Read off the elder's phone and typed into a browser once. Eight characters over this alphabet
    # is about 40 bits; six was about 30, which is guessable inside a one-hour window by anyone who
    # can reach the join page. Length is cheap, and it is still short enough to read aloud.
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(8))


def create_device(elder_name: str) -> dict[str, Any]:
    with db() as connection:
        for _ in range(5):
            code = new_pair_code()
            try:
                cursor = connection.execute(
                    "INSERT INTO devices "
                    "(token, pair_code, pair_code_expires_at, elder_name, created_at) "
                    "VALUES (?,?,?,?,?)",
                    (new_token(), code, time.time() + PAIR_CODE_TTL_SECONDS, elder_name, time.time()),
                )
            except sqlite3.IntegrityError:
                continue
            row = connection.execute("SELECT * FROM devices WHERE id = ?", (cursor.lastrowid,)).fetchone()
            return dict(row)
    raise RuntimeError("could not allocate a pairing code")


def device_by_token(token: str) -> dict[str, Any] | None:
    with db() as connection:
        row = connection.execute("SELECT * FROM devices WHERE token = ?", (token,)).fetchone()
        return dict(row) if row else None


def device_by_id(device_id: int) -> dict[str, Any] | None:
    with db() as connection:
        row = connection.execute("SELECT * FROM devices WHERE id = ?", (device_id,)).fetchone()
        return dict(row) if row else None


def update_device_name(device_id: int, name: str) -> None:
    with db() as connection:
        connection.execute("UPDATE devices SET elder_name = ? WHERE id = ?", (name, device_id))


def device_by_pair_code(code: str) -> dict[str, Any] | None:
    with db() as connection:
        row = connection.execute(
            "SELECT * FROM devices WHERE pair_code = ? AND pair_code_expires_at > ?",
            (code.strip().upper(), time.time()),
        ).fetchone()
        return dict(row) if row else None


def rotate_pair_code(device_id: int, role: str) -> dict[str, Any]:
    """Issue a fresh invite code for one role, invalidating the previous one.

    The role lives on the invite, not on the join form. Whoever holds the code can join, but only
    as the role the person who handed out the code chose — a joiner can no longer promote
    themselves to 家人 and read the elder's private context, or leave them a message that the
    phone reads aloud as "家人留言".
    """
    with db() as connection:
        for _ in range(5):
            code = new_pair_code()
            try:
                connection.execute(
                    "UPDATE devices SET pair_code = ?, pair_code_role = ?, pair_code_expires_at = ? "
                    "WHERE id = ?",
                    (code, role, time.time() + PAIR_CODE_TTL_SECONDS, device_id),
                )
            except sqlite3.IntegrityError:
                continue
            row = connection.execute("SELECT * FROM devices WHERE id = ?", (device_id,)).fetchone()
            return dict(row)
    raise RuntimeError("could not allocate a pairing code")


def touch_device(device_id: int, note: str = "") -> None:
    with db() as connection:
        connection.execute(
            "UPDATE devices SET last_seen_at = ?, last_seen_note = ? WHERE id = ?",
            (time.time(), note, device_id),
        )


def circle_of(device_id: int) -> list[dict[str, Any]]:
    with db() as connection:
        rows = connection.execute(
            "SELECT * FROM circle WHERE device_id = ? ORDER BY id", (device_id,)
        ).fetchall()
        return [dict(row) for row in rows]


def add_circle_member(device_id: int, name: str, phone: str, role: str) -> dict[str, Any]:
    with db() as connection:
        cursor = connection.execute(
            "INSERT INTO circle (device_id, name, phone, role, created_at) VALUES (?,?,?,?,?)",
            (device_id, name, phone, role, time.time()),
        )
        row = connection.execute("SELECT * FROM circle WHERE id = ?", (cursor.lastrowid,)).fetchone()
        return dict(row)


def create_session(circle_id: int) -> str:
    token = new_token()
    with db() as connection:
        connection.execute(
            "INSERT INTO sessions (token, circle_id, created_at) VALUES (?,?,?)",
            (token, circle_id, time.time()),
        )
    return token


def delete_session(token: str) -> None:
    with db() as connection:
        connection.execute("DELETE FROM sessions WHERE token = ?", (token,))


def session_member(token: str) -> dict[str, Any] | None:
    with db() as connection:
        row = connection.execute(
            "SELECT c.*, d.elder_name, d.id AS device_id, d.last_seen_at, d.last_seen_note, "
            "d.pair_code FROM sessions s JOIN circle c ON c.id = s.circle_id "
            "JOIN devices d ON d.id = c.device_id WHERE s.token = ?",
            (token,),
        ).fetchone()
        return dict(row) if row else None


def add_event(
    device_id: int,
    kind: str,
    direction: str,
    title: str = "",
    body: str = "",
    context: str = "",
    created_by: int | None = None,
    status: str = "new",
) -> dict[str, Any]:
    with db() as connection:
        cursor = connection.execute(
            "INSERT INTO events (device_id, kind, direction, title, body, context, created_at, "
            "created_by, status) VALUES (?,?,?,?,?,?,?,?,?)",
            (device_id, kind, direction, title, body, context, time.time(), created_by, status),
        )
        row = connection.execute("SELECT * FROM events WHERE id = ?", (cursor.lastrowid,)).fetchone()
        return dict(row)


def events_for(device_id: int, limit: int = 50) -> list[dict[str, Any]]:
    with db() as connection:
        rows = connection.execute(
            "SELECT * FROM events WHERE device_id = ? ORDER BY id DESC LIMIT ?",
            (device_id, limit),
        ).fetchall()
        return [dict(row) for row in rows]


def open_requests_for(device_id: int) -> list[dict[str, Any]]:
    with db() as connection:
        rows = connection.execute(
            "SELECT * FROM events WHERE device_id = ? AND kind IN ('help', 'alert') "
            "AND status IN ('new', 'claimed') ORDER BY id DESC",
            (device_id,),
        ).fetchall()
        return [dict(row) for row in rows]


def pending_for_device(device_id: int) -> list[dict[str, Any]]:
    with db() as connection:
        rows = connection.execute(
            "SELECT * FROM events WHERE device_id = ? AND direction = 'to_device' AND delivered = 0 "
            "ORDER BY id",
            (device_id,),
        ).fetchall()
        return [dict(row) for row in rows]


def acknowledge_events(device_id: int, event_ids: list[int], read: bool = False) -> list[int]:
    """Records that the phone displayed (or the elder read) its own downlink events."""
    if not event_ids:
        return []
    placeholders = ",".join("?" for _ in event_ids)
    now = time.time()
    with db() as connection:
        rows = connection.execute(
            f"SELECT id FROM events WHERE device_id = ? AND direction = 'to_device' "
            f"AND id IN ({placeholders})",
            (device_id, *event_ids),
        ).fetchall()
        acked = [int(row["id"]) for row in rows]
        if not acked:
            return []
        ids = ",".join("?" for _ in acked)
        if read:
            connection.execute(
                f"UPDATE events SET delivered = 1, "
                f"delivered_at = COALESCE(delivered_at, ?), read_at = COALESCE(read_at, ?) "
                f"WHERE id IN ({ids})",
                (now, now, *acked),
            )
        else:
            connection.execute(
                f"UPDATE events SET delivered = 1, delivered_at = COALESCE(delivered_at, ?) "
                f"WHERE id IN ({ids})",
                (now, *acked),
            )
    return acked


def claim_event(
    event_id: int,
    circle_id: int,
    device_id: int,
    allowed_kinds: tuple[str, ...] = ("help", "alert"),
) -> dict[str, Any] | None:
    if not allowed_kinds:
        return None
    placeholders = ",".join("?" for kind in allowed_kinds)
    with db() as connection:
        cursor = connection.execute(
            "UPDATE events SET status = 'claimed', claimed_by = ?, claimed_at = ? "
            f"WHERE id = ? AND device_id = ? AND kind IN ({placeholders}) AND status = 'new'",
            (circle_id, time.time(), event_id, device_id, *allowed_kinds),
        )
        if cursor.rowcount == 0:
            # Someone else already claimed it, or it is not a help/alert. Returning None is what
            # lets the web layer say "已经有人接手" instead of queueing a second ack.
            return None
        row = connection.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
        return dict(row) if row else None


def latest_alert_at(device_id: int) -> float | None:
    """Timestamp of the newest alert, claimed or not, for one silence episode."""
    with db() as connection:
        row = connection.execute(
            "SELECT MAX(created_at) AS at FROM events WHERE device_id = ? AND kind = 'alert'",
            (device_id,),
        ).fetchone()
    value = row["at"] if row else None
    return float(value) if value is not None else None


def member_by_id(member_id: int) -> dict[str, Any] | None:
    with db() as connection:
        row = connection.execute("SELECT * FROM circle WHERE id = ?", (member_id,)).fetchone()
        return dict(row) if row else None


def as_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)
