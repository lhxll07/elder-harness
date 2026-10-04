"""Pins the shared "rendered page -> observation text" semantics across languages.

`core/src/test/kotlin/.../SkillObservationGoldenTest.kt` reads the *same* golden file and checks
`SkillShadow.observationFor`; this test checks `tasks/skill_replay.py`'s `observation_from_payload`
(the Tier-1 adapter). The two implementations cannot drift silently: whichever side changes without
the other turns its own suite red.

The last test additionally compares the Kotlin marker list with the Python one by reading the Kotlin
source, so even a marker that no golden row happens to exercise is caught.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TASKS = ROOT / "tasks"
GOLDEN = ROOT / "core" / "src" / "test" / "resources" / "skill_observation_golden.tsv"
KOTLIN_GATE = ROOT / "core" / "src" / "main" / "kotlin" / "com" / "yinling" / "core" / "SkillGate.kt"

sys.path.insert(0, str(TASKS))

import skill_replay  # noqa: E402


def _unescape(value: str) -> str:
    return value.replace("\\n", "\n")


def _golden_rows() -> list[tuple[str, str]]:
    rows: list[tuple[str, str]] = []
    for raw in GOLDEN.read_text(encoding="utf-8").splitlines():
        line = raw.rstrip()
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        rendered, expected = line.split("|||")
        rows.append((_unescape(rendered), _unescape(expected)))
    return rows


def test_golden_table_is_shared_with_the_kotlin_side() -> None:
    rows = _golden_rows()
    assert len(rows) >= 8, f"golden table looks empty: {len(rows)} rows"
    for rendered, expected in rows:
        assert skill_replay.observation_from_payload(rendered) == expected, rendered[:60]


def test_installed_app_decoration_never_satisfies_requires() -> None:
    rendered = (
        "当前页面：com.tencent.mm\n"
        "已安装应用（open_app 必须用这里的完整名称）：美团、微信\n"
        "（对老人说的每句话都必须用简体中文）"
    )
    observation = skill_replay.observation_from_payload(rendered)
    assert "美团" not in observation
    assert not skill_replay.requires_satisfied(["美团"], observation)


def test_empty_observation_fails_closed() -> None:
    assert skill_replay.observation_from_payload("提示：只有装饰文本") == ""
    assert skill_replay.observation_from_payload("") == ""
    assert not skill_replay.requires_satisfied(["字体"], skill_replay.observation_from_payload("提示：x"))


def test_kotlin_and_python_strip_the_same_markers() -> None:
    source = KOTLIN_GATE.read_text(encoding="utf-8")
    block = re.search(r"val OBSERVATION_TAIL_MARKERS = listOf\((.*?)\)", source, re.S)
    assert block is not None, "SkillShadow.OBSERVATION_TAIL_MARKERS not found in SkillGate.kt"
    kotlin_markers = re.findall(r'"((?:[^"\\]|\\.)*)"', block.group(1))
    assert kotlin_markers == list(skill_replay.OBSERVATION_TAIL_MARKERS), (
        "the marker lists have drifted:\n"
        f"  Kotlin: {kotlin_markers}\n"
        f"  Python: {list(skill_replay.OBSERVATION_TAIL_MARKERS)}"
    )
