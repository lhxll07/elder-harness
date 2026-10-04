"""Shared fixture: every test gets its own SQLite file, so tests cannot see each other's circle."""

from __future__ import annotations

import os
import sys

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import db  # noqa: E402
from app import main  # noqa: E402


@pytest.fixture()
def client(tmp_path):
    db.init(str(tmp_path / "test.db"))
    # The join throttle is process-local state on purpose (single-process deployment), so it has to
    # be cleared per test; otherwise one test's failed guesses would lock out the next test.
    main._join_failures.clear()
    # No `with`: the lifespan's background watcher is not wanted in tests; silence is checked
    # explicitly through app.watch.check_silence().
    return TestClient(main.app)


@pytest.fixture()
def device(client):
    response = client.post("/api/device/pair", json={"elder_name": "妈妈"})
    assert response.status_code == 200
    return response.json()


def auth(device_info):
    return {"Authorization": f"Bearer {device_info['token']}"}
