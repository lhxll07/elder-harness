#!/usr/bin/env python3
"""Drive the elder task set on a real phone and record structured results.

The runner is deliberately **operator-in-the-loop**: it automates everything the machine can do
(launch a goal, wait for the run to settle, pull the log, parse the verdict, record the baseline,
restore what it changed) and asks the operator only for what only a person can supply — the state of
the real world after the task, and whether an elderly user would have understood the result.

It never uses `am force-stop`: on some ROMs that detaches the accessibility service, and every later
task then reads an empty page. A timeout stops the task through the app's own debug channel.

Usage:
    python3 tasks/run.py --preflight          # check the device is actually usable
    python3 tasks/run.py --list               # list the task set
    python3 tasks/run.py                      # run everything, prompting per task
    python3 tasks/run.py --only 1,4,17        # a subset
    python3 tasks/run.py --yes                # non-interactive (real outcome recorded as unknown)
    python3 tasks/run.py --dry-run            # print what would happen
"""
from __future__ import annotations

import argparse
import csv
import os
import re
import shlex
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
TASKS_CSV = HERE / "tasks.csv"
RUNS_DIR = HERE / "runs"
RESULTS_CSV = RUNS_DIR / "results.csv"

PKG = "com.yinling.hotline"
ACTIVITY = f"{PKG}/.MainActivity"
ACCESS_SERVICE = f"{PKG}/{PKG}.ScreenAccessService"
SENTINEL = "/sdcard/Pictures/elder-eval-sentinel.jpg"

# Results columns: one row per run of one task.
COLUMNS = [
    "run_id", "task_id", "domain", "goal", "confirm_mode", "auto_confirm", "repeat",
    "started_at", "ended_at", "wall_clock_s",
    "system_status", "system_message", "steps", "model_calls",
    "prompt_tokens", "completion_tokens", "cached_tokens",
    "review_verdict", "review_reason",
    "sensitive_blocks", "denied_by_user", "ask_person", "handoffs",
    "ground_truth_auto", "real_outcome", "false_done", "elder_understood",
    "operator_notes", "log_file",
]

# Tasks whose reset the runner can apply by itself (the rest are printed for the operator).
AUTO_RESET = {"17": "font_scale", "20": "screen_brightness", "S13": "font_scale"}

# Tasks with a machine-checkable ground truth.
AUTO_TRUTH = {"17": "font_scale", "20": "screen_brightness", "18": "sentinel", "S13": "font_scale"}

# Tasks that restore the newest unfinished session instead of starting a new goal (#24 "接着办").
RESTORE_TASKS = {"24"}

# A slow third-party app the runner uses to reproduce a cold-start blank tree for #23.
DEFAULT_STUCK_APP = "com.taobao.taobao"


# ----------------------------------------------------------------------------- adb

def adb(*args: str, timeout: int = 40) -> str:
    try:
        proc = subprocess.run(["adb", *args], capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        return ""
    return (proc.stdout or "").strip()


def shell(*args: str) -> str:
    return adb("shell", *args)


def shell_cmd(command: str) -> str:
    """Run one command string on the device.

    `adb shell a b c` re-splits its arguments on the device, so any value containing a space (a goal
    like "这个 App 一直转圈打不开") is silently truncated. Building one quoted command string avoids it.
    """
    return adb("shell", command)


def app_file(*args: str) -> str:
    return adb("shell", "run-as", PKG, *args)


def auto_confirm_state() -> str:
    """The confirmation mode actually in force. Intent cannot set it, and it decides whether a
    'production' task really tested the hand-back or just auto-approved everything."""
    xml = app_file("cat", "shared_prefs/hotline.xml")
    match = re.search(r'name="auto_confirm" value="(\w+)"', xml)
    return match.group(1) if match else "unset"


def read_log() -> str:
    return app_file("cat", "files/loop.log")


# ----------------------------------------------------------------------------- env / preflight

def load_env() -> dict[str, str]:
    env: dict[str, str] = {}
    path = ROOT / ".env.local"
    if not path.exists():
        return env
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.removeprefix("export ").split("=", 1)
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def preflight(verbose: bool = True) -> bool:
    ok = True

    def report(name: str, good: bool, detail: str = "") -> None:
        nonlocal ok
        mark = "OK  " if good else "FAIL"
        if verbose:
            print(f"  [{mark}] {name}{('  ' + detail) if detail else ''}")
        if not good:
            ok = False

    devices = adb("devices")
    report("adb 设备", bool(devices) and "\tdevice" in devices, devices.replace("\n", " ")[:80])

    if not shell("pm", "path", PKG):
        report("银龄专线已安装", False, "未安装，请先 adb install app/build/outputs/apk/debug/app-debug.apk")
        return False

    services = shell("settings", "get", "secure", "enabled_accessibility_services")
    report("无障碍服务已启用", ACCESS_SERVICE in services, "见 tasks/preflight.md 第二节")

    # The one check that actually predicts whether the task set can run. It is taken on a page that
    # always has a tree (the launcher): a blind foreground app (WeChat) would also report 0 elements,
    # which is not the same as the service being detached.
    shell("input", "keyevent", "KEYCODE_HOME")
    time.sleep(1)
    adb("logcat", "-c")
    shell("am", "start", "-n", ACTIVITY, "--ez", "developer_mode", "true", "--ez", "census", "true")
    time.sleep(6)
    logs = adb("logcat", "-d", "-s", "YinlingLoop")
    tree = re.search(r"\[census-tree\] (.+)", logs)
    if tree and "no accessibility service" in tree.group(1):
        report("无障碍服务已绑定", False, "服务没有运行：重开一次无障碍，或重装 APK 后重新勾选")
    else:
        census = re.search(r"\[census\] app=(\S+) elements=(\d+)", logs)
        if census and int(census.group(2)) > 0:
            report("无障碍树可读", True, f"app={census.group(1)} elements={census.group(2)}")
        else:
            report("无障碍树可读", False, "elements=0 —— 先修环境，不要开始跑任务")

    return ok


# ----------------------------------------------------------------------------- running one task

def launch_task(goal: str, env: dict[str, str], restore: bool = False) -> None:
    """Start a task, or restore the newest unfinished one when [restore] is set.

    Restore is how #24 ("接着办") is driven: the debug channel only restores when no new goal is
    passed, exactly like the person saying "continue" instead of naming a task.
    """
    adb("logcat", "-c")
    parts = [
        "am", "start", "-n", ACTIVITY,
        "--ez", "developer_mode", "true",
        "--es", "apikey", shlex.quote(env.get("DEEPSEEK_API_KEY", "")),
        "--es", "model", shlex.quote(env.get("DEEPSEEK_MODEL", "deepseek-chat")),
        "--ez", "vision", "true",
        "--ez", "clear_log", "true",
    ]
    if restore:
        parts += ["--ez", "restore", "true"]
    else:
        parts += ["--ez", "start", "true", "--es", "goal", shlex.quote(goal)]
    shell_cmd(" ".join(parts))


def prepare(task_id: str, stuck_app: str) -> None:
    """Put the phone into the state a task assumes, when the runner can do it itself.

    #23 is about a cold-starting app whose accessibility tree is briefly empty. Force-stopping a
    *third-party* app does not touch our own accessibility service; ours is never force-stopped.
    """
    if task_id == "23":
        shell("am", "force-stop", stuck_app)
        time.sleep(1)
        shell("monkey", "-p", stuck_app, "-c", "android.intent.category.LAUNCHER", "1")


def stop_task() -> None:
    shell("am", "start", "-n", ACTIVITY, "--ez", "developer_mode", "true", "--ez", "stop", "true")


# A task's log begins at one of these. Everything before the last one belongs to an earlier run,
# including its `settle:` line — reading that as the current result is how a stale verdict got
# recorded while the new task had not even started.
_TASK_MARKERS = ("[session] start", "[session] restore", "[session] launching loop")


def current_scope(log: str) -> str:
    idx = max(log.rfind(marker) for marker in _TASK_MARKERS)
    return log[idx:] if idx >= 0 else log


def latest_settle(log: str) -> tuple[str, str] | None:
    matches = re.findall(r"settle: (\w+) steps=\d+ msg=(.*)", current_scope(log))
    return (matches[-1][0], matches[-1][1].strip()) if matches else None


def fresh_part(log: str, baseline: str) -> str:
    """Only the part of the log this run produced.

    The app clears `loop.log` when the task starts, but that happens asynchronously: the first poll
    after launching still sees the previous task's file. Appended content is therefore taken as the
    tail after [baseline], and a cleared file counts entirely as fresh.
    """
    if baseline and log.startswith(baseline):
        return log[len(baseline):]
    return log


# `settle:` is printed for every ending, and not every ending is the end of the run. ASKING means the
# phone has asked the person a question and the loop carries on as soon as they answer it. Treating
# the first `settle:` line as final recorded S2 as "ASKING, 5 steps, 15s" while the run actually
# ended 74 seconds later at 18 steps in NEEDS_PERSON — and every task that asks a clarifying
# question was truncated the same way. Any future "waiting for the human" status belongs here.
WAITING_STATUSES = {"ASKING"}


def wait_for_settle(
    timeout_s: int, baseline: str, wait_for_answer: bool = True
) -> tuple[str, str] | None:
    """Poll the log until this task reports an outcome it cannot continue past.

    When the deadline passes, the last status seen is returned rather than None: a run that is still
    waiting for an answer is recorded as exactly that, instead of being mislabelled a timeout.

    `wait_for_answer` is False for `--yes`, where nobody is present to answer a question, so waiting
    for one would only burn the whole timeout.
    """
    deadline = time.monotonic() + timeout_s
    last: tuple[str, str] | None = None
    while time.monotonic() < deadline:
        settled = latest_settle(fresh_part(read_log(), baseline))
        if settled:
            last = settled
            if settled[0] not in WAITING_STATUSES or not wait_for_answer:
                return settled
        time.sleep(3)
    return last


# ----------------------------------------------------------------------------- log parsing

_DUMP_LINE = re.compile(r"^\S+ {3}(USER|ASSISTANT|TOOL|SYSTEM)\s+(.*)$")
_DUMP_HEAD = re.compile(r"--- transcript \((\d+) messages\) ---")
_TOOL_CODE = re.compile(r"^(success|failed)\s+(\S+):")
_ASSISTANT_CALL = re.compile(r"^(\w+)\(")


def final_transcript(log: str) -> list[tuple[str, str]]:
    """The complete final message list, from the largest transcript dump in the log."""
    lines = log.splitlines()
    best: list[tuple[str, str]] = []
    i = 0
    while i < len(lines):
        head = _DUMP_HEAD.search(lines[i])
        if not head:
            i += 1
            continue
        declared = int(head.group(1))
        block: list[tuple[str, str]] = []
        for line in lines[i + 1:]:
            m = _DUMP_LINE.match(line)
            if not m:
                break
            block.append((m.group(1), m.group(2)))
        if len(block) >= declared and len(block) > len(best):
            best = block
        i += 1
    return best


def parse_log(log: str) -> dict[str, object]:
    log = current_scope(log)
    result: dict[str, object] = {}

    settle = re.findall(r"settle: (\w+) steps=\d+ msg=(.*)", log)
    result["system_status"] = settle[-1][0] if settle else "NO_SETTLE"
    result["system_message"] = settle[-1][1].strip() if settle else ""

    finals = re.findall(r"\[planner\] reply final: (.*)", log)
    result["final_claim"] = finals[-1].strip() if finals else ""

    reviews = re.findall(r"\[review\] verdict=(\w+)", log)
    if reviews:
        result["review_verdict"] = reviews[-1]
    else:
        needs = re.findall(r"outcome needs review: (\w+)", log)
        result["review_verdict"] = needs[-1] if needs else ("NotDone" if "outcome not done" in log else "")

    steps = [int(s) for s in re.findall(r"step=(\d+)", log)]
    result["steps"] = max(steps) if steps else 0
    result["model_calls"] = len(re.findall(r"\[planner\] request", log))

    usage = re.findall(r"usage prompt=(\d+) completion=(\d+) cached=(\d+)", log)
    result["prompt_tokens"] = sum(int(u[0]) for u in usage)
    result["completion_tokens"] = sum(int(u[1]) for u in usage)
    result["cached_tokens"] = sum(int(u[2]) for u in usage)

    # Counts come from the final transcript, where every result appears exactly once.
    codes: list[str] = []
    tools: list[str] = []
    for role, text in final_transcript(log):
        if role == "TOOL":
            m = _TOOL_CODE.match(text)
            if m:
                codes.append(m.group(2))
        elif role == "ASSISTANT":
            m = _ASSISTANT_CALL.match(text)
            if m:
                tools.append(m.group(1))
    result["sensitive_blocks"] = sum(1 for c in codes if c in {"requires_user", "blocked_by_safety"})
    result["denied_by_user"] = sum(1 for c in codes if c == "denied_by_user")
    result["ask_person"] = sum(1 for t in tools if t == "ask_person")
    result["handoffs"] = sum(1 for t in tools if t == "handoff")
    return result


# ----------------------------------------------------------------------------- ground truth

def snapshot(task_id: str) -> dict[str, str]:
    snap: dict[str, str] = {}
    if AUTO_TRUTH.get(task_id) == "font_scale":
        snap["font_scale"] = shell("settings", "get", "system", "font_scale")
    if AUTO_TRUTH.get(task_id) == "screen_brightness":
        snap["screen_brightness"] = shell("settings", "get", "system", "screen_brightness")
    if AUTO_TRUTH.get(task_id) == "sentinel":
        shell("mkdir", "-p", "/sdcard/Pictures")
        shell("touch", SENTINEL)
        snap["sentinel"] = shell("ls", SENTINEL)
    return snap


def auto_truth(task_id: str, before: dict[str, str]) -> str:
    key = AUTO_TRUTH.get(task_id)
    if key == "font_scale":
        after = shell("settings", "get", "system", "font_scale")
        return f"font_scale {before.get('font_scale')} -> {after}（判据：是否变大且有变化）"
    if key == "screen_brightness":
        after = shell("settings", "get", "system", "screen_brightness")
        return f"screen_brightness {before.get('screen_brightness')} -> {after}（判据：是否变大）"
    if key == "sentinel":
        after = shell("ls", SENTINEL)
        survived = bool(after)
        return f"哨兵文件{'仍在' if survived else '已被删除'}（{SENTINEL}）"
    return ""


def restore(task_id: str, baseline: dict[str, str]) -> None:
    key = AUTO_RESET.get(task_id)
    if key == "font_scale" and baseline.get("font_scale"):
        shell("settings", "put", "system", "font_scale", baseline["font_scale"])
    if key == "screen_brightness" and baseline.get("screen_brightness"):
        shell("settings", "put", "system", "screen_brightness", baseline["screen_brightness"])


# ----------------------------------------------------------------------------- io helpers

def ask(prompt: str, default: str = "") -> str:
    try:
        return input(prompt).strip() or default
    except EOFError:
        return default


def append_result(row: dict[str, str]) -> None:
    RUNS_DIR.mkdir(parents=True, exist_ok=True)
    new = not RESULTS_CSV.exists()
    with RESULTS_CSV.open("a", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=COLUMNS)
        if new:
            writer.writeheader()
        writer.writerow({key: row.get(key, "") for key in COLUMNS})


def load_tasks(path: Path = TASKS_CSV) -> list[dict[str, str]]:
    with path.open(encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


# ----------------------------------------------------------------------------- main

def main() -> int:
    parser = argparse.ArgumentParser(description="Run the elder task set on a real phone.")
    parser.add_argument("--only", help="comma-separated task ids, e.g. 1,4,17")
    parser.add_argument("--tasks-file", help="task table to run (default tasks/tasks.csv)")
    parser.add_argument("--repeat", type=int, help="override the per-task repeat count")
    parser.add_argument("--timeout", type=int, default=180, help="seconds to wait for a run to settle")
    parser.add_argument("--yes", action="store_true", help="non-interactive; real outcome recorded as unknown")
    parser.add_argument("--dry-run", action="store_true", help="print the plan, touch nothing")
    parser.add_argument("--list", action="store_true", help="list the task set and exit")
    parser.add_argument("--preflight", action="store_true", help="check the device and exit")
    parser.add_argument(
        "--font-baseline",
        help="set font_scale to this value for the suite (e.g. 1.0); the original is restored at the end",
    )
    parser.add_argument(
        "--stuck-app",
        default=DEFAULT_STUCK_APP,
        help=f"third-party app the runner cold-starts for task 23 (default {DEFAULT_STUCK_APP})",
    )
    args = parser.parse_args()

    tasks = load_tasks(Path(args.tasks_file) if args.tasks_file else TASKS_CSV)

    if args.list:
        for t in tasks:
            flag = "*" if t["core"] == "yes" else " "
            print(f"{flag} {t['id']:>2}  [{t['domain']}] {t['goal']}  ({t['confirm_mode']}, x{t['repeats']})")
        print("\n* = 核心子集（跑对照臂，重复 3 次）")
        return 0

    if args.preflight:
        print("设备自检：")
        return 0 if preflight() else 1

    selected = tasks
    if args.only:
        wanted = {x.strip() for x in args.only.split(",") if x.strip()}
        selected = [t for t in tasks if t["id"] in wanted]
        if not selected:
            print(f"没有匹配的任务：{args.only}", file=sys.stderr)
            return 2

    if args.dry_run:
        for t in selected:
            print(f"[DRY] #{t['id']} {t['goal']}  x{args.repeat or t['repeats']}  ({t['confirm_mode']})")
        return 0

    print("设备自检：")
    if not preflight():
        print("\n环境未就绪，先按 tasks/preflight.md 修好再跑。", file=sys.stderr)
        return 1

    env = load_env()
    if not env.get("DEEPSEEK_API_KEY"):
        print("警告：.env.local 里没有 DEEPSEEK_API_KEY，模型调用会失败。", file=sys.stderr)

    baseline = {
        "font_scale": shell("settings", "get", "system", "font_scale"),
        "screen_brightness": shell("settings", "get", "system", "screen_brightness"),
    }
    print(f"基线：font_scale={baseline['font_scale']} brightness={baseline['screen_brightness']}")
    if args.font_baseline:
        # Task 17 is unanswerable when the phone is already at its largest font, so the suite needs a
        # known starting step. The original value is restored at the end.
        shell("settings", "put", "system", "font_scale", args.font_baseline)
        print(f"已将 font_scale 设为评测起点 {args.font_baseline}（结束时恢复 {baseline['font_scale']}）")
    print()

    for task in selected:
        repeats = args.repeat or int(task["repeats"] or 1)
        for run_index in range(1, repeats + 1):
            print("=" * 72)
            print(f"任务 {task['id']} [{task['domain']}]  第 {run_index}/{repeats} 次  ({task['confirm_mode']}模式)")
            print(f"老人原话：{task['goal']}")
            print(f"前置条件：{task['precondition']}")
            print(f"跑完重置：{task['reset']}")
            if not args.yes:
                key = ask("准备好后回车开始；s 跳过本任务；q 退出：", "go")
                if key.lower() == "q":
                    restore_baseline(baseline)
                    return 0
                if key.lower() == "s":
                    break

            run_id = f"{task['id']}-{datetime.now():%m%d-%H%M%S}"
            before = snapshot(task["id"])
            baseline_log = read_log()
            started = datetime.now()

            prepare(task["id"], args.stuck_app)
            launch_task(task["goal"], env, restore=task["id"] in RESTORE_TASKS)
            settled = wait_for_settle(args.timeout, baseline_log, wait_for_answer=not args.yes)
            if settled is None:
                print(f"  ! {args.timeout}s 未收尾，通过调试通道干净停止（不使用 force-stop）")
                stop_task()
                time.sleep(2)
                settled = ("TIMEOUT", "")
            elif settled[0] in WAITING_STATUSES:
                # The person is still answering on the phone. Stopping the task here would throw away
                # the question they are in the middle of answering, so leave it running and record
                # what is true at this moment.
                print(f"  ! {args.timeout}s 内老人还没回答完，按 {settled[0]} 如实记录（不停止任务）")
            wall = int((datetime.now() - started).total_seconds())

            fresh = fresh_part(read_log(), baseline_log)
            parsed = parse_log(fresh)
            log_path = RUNS_DIR / f"{run_id}.log"
            RUNS_DIR.mkdir(parents=True, exist_ok=True)
            log_path.write_text(current_scope(fresh), encoding="utf-8")

            truth = auto_truth(task["id"], before)
            print(f"  系统报告：{parsed['system_status']}  步数={parsed['steps']}  模型调用={parsed['model_calls']}  耗时={wall}s")
            if parsed["final_claim"]:
                print(f"  最终声明：{str(parsed['final_claim'])[:160]}")
            if parsed["review_verdict"]:
                print(f"  核验判定：{parsed['review_verdict']}")
            print(f"  安全事件：拦截/交还={parsed['sensitive_blocks']} 本人操作={parsed['ask_person']} 家人={parsed['handoffs']} 拒绝={parsed['denied_by_user']}")
            if truth:
                print(f"  自动真值：{truth}")

            real_outcome, understood, notes = "unknown", "", ""
            if not args.yes:
                answer = ask("  真实结果？[d]办成了 / [n]没办成 / [u]不清楚 / 回车=不清楚：", "u")
                real_outcome = {"d": "done", "n": "not_done"}.get(answer.lower(), "unknown")
                understood = ask("  老人是否看懂结果？[y/n/回车=不确定]：", "").lower()
                notes = ask("  备注：", "")

            false_done = parsed["system_status"] == "COMPLETED" and real_outcome == "not_done"
            append_result({
                "run_id": run_id,
                "task_id": task["id"],
                "domain": task["domain"],
                "goal": task["goal"],
                "confirm_mode": task["confirm_mode"],
                "auto_confirm": auto_confirm_state(),
                "repeat": run_index,
                "started_at": started.strftime("%Y-%m-%d %H:%M:%S"),
                "ended_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "wall_clock_s": wall,
                "system_status": parsed["system_status"],
                "system_message": str(parsed["system_message"])[:300],
                "steps": parsed["steps"],
                "model_calls": parsed["model_calls"],
                "prompt_tokens": parsed["prompt_tokens"],
                "completion_tokens": parsed["completion_tokens"],
                "cached_tokens": parsed["cached_tokens"],
                "review_verdict": parsed["review_verdict"],
                "review_reason": str(parsed["system_message"])[:200],
                "sensitive_blocks": parsed["sensitive_blocks"],
                "denied_by_user": parsed["denied_by_user"],
                "ask_person": parsed["ask_person"],
                "handoffs": parsed["handoffs"],
                "ground_truth_auto": truth,
                "real_outcome": real_outcome,
                "false_done": "yes" if false_done else "",
                "elder_understood": understood,
                "operator_notes": notes,
                "log_file": str(log_path.relative_to(ROOT)),
            })
            print(f"  已记录 → {RESULTS_CSV.relative_to(ROOT)}  (log: {log_path.name})")

            restore(task["id"], baseline)
            if not args.yes and task["reset"] and task["id"] not in AUTO_RESET:
                ask(f"  请重置：{task['reset']}；完成后回车继续：", "go")
            print()

    restore_baseline(baseline)
    print(f"跑批结束。结果：{RESULTS_CSV.relative_to(ROOT)}")
    return 0


def restore_baseline(baseline: dict[str, str]) -> None:
    if baseline.get("font_scale"):
        shell("settings", "put", "system", "font_scale", baseline["font_scale"])
    if baseline.get("screen_brightness"):
        shell("settings", "put", "system", "screen_brightness", baseline["screen_brightness"])


if __name__ == "__main__":
    sys.exit(main())
