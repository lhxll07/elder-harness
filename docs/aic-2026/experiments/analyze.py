#!/usr/bin/env python3
"""汇总老人对照实验记录，输出可直接贴进报告的 Markdown 表。

用法：
    python3 analyze.py 老人对照实验-记录表.csv
    python3 analyze.py 老人对照实验-记录表.csv --md > 汇总.md

口径：
  · completion：2=独立完成，1=提示后完成，0=未完成；完成率=(2+1)/有效次数。
  · 用时只统计完成项（completion 为 1 或 2 且 time_s>0），避免“没做完所以很快”。
  · 只做描述统计与配对胜负计数，不做显著性宣称（n=12—15）。
"""

from __future__ import annotations

import argparse
import csv
import statistics
from collections import defaultdict


def num(value: str) -> float | None:
    value = (value or "").strip()
    if value in {"", "NA", "na", "-"}:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def load(path: str) -> list[dict]:
    with open(path, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    demo: dict[str, dict] = {}
    for row in rows:
        pid = row["pid"].strip()
        for key in ("age_group", "gender", "proficiency"):
            if row.get(key, "").strip():
                demo.setdefault(pid, {})[key] = row[key].strip()
        row["_pid"] = pid
    for row in rows:
        row.update(demo.get(row["_pid"], {}))
    return [r for r in rows if num(r.get("completion", "")) is not None]


def stats(rows: list[dict], cond: str) -> dict:
    rs = [r for r in rows if r["condition"].strip().upper() == cond]
    n = len(rs)
    comp = [num(r["completion"]) for r in rs]
    done = [c for c in comp if c in (1, 2)]
    times = [num(r["time_s"]) for r in rs if num(r["completion"]) in (1, 2) and (num(r["time_s"]) or 0) > 0]
    prompts = [num(r["prompts"]) for r in rs if num(r["prompts"]) is not None]
    helps = [num(r["help_count"]) for r in rs if num(r["help_count"]) is not None]
    mis = [num(r["misclicks"]) for r in rs if num(r["misclicks"]) is not None]
    danger = [num(r["danger_actions"]) for r in rs if num(r["danger_actions"]) is not None]
    und = [num(r["understands"]) for r in rs if num(r["understands"]) in (0, 1)]
    stop = [num(r["can_stop"]) for r in rs if num(r["can_stop"]) in (0, 1)]
    use = [num(r["usefulness"]) for r in rs if num(r["usefulness"]) is not None]
    return {
        "n": n,
        "completion": len(done) / n if n else None,
        "independent": sum(1 for c in comp if c == 2) / n if n else None,
        "median_time": statistics.median(times) if times else None,
        "prompts": statistics.mean(prompts) if prompts else None,
        "helps": statistics.mean(helps) if helps else None,
        "misclicks": sum(mis) if mis else None,
        "danger": sum(danger) if danger else None,
        "understands": (sum(und) / len(und)) if und else None,
        "can_stop": (sum(stop) / len(stop)) if stop else None,
        "usefulness": statistics.mean(use) if use else None,
    }


def fmt(value: float | None, pct: bool = False) -> str:
    if value is None:
        return "—"
    if pct:
        return f"{value * 100:.0f}%"
    return f"{value:.1f}".rstrip("0").rstrip(".")


def paired(rows: list[dict], left: str, right: str) -> tuple[int, int, int]:
    """left 相对 right 的完成胜负：better / worse / tie。"""
    by: dict[tuple[str, str], dict[str, float]] = defaultdict(dict)
    for r in rows:
        cond = r["condition"].strip().upper()
        if cond in (left, right):
            by[(r["_pid"], r["task"].strip())][cond] = num(r["completion"])  # type: ignore[assignment]
    better = worse = tie = 0
    for pair in by.values():
        if left not in pair or right not in pair:
            continue
        a, b = pair[left], pair[right]
        if a > b:
            better += 1
        elif a < b:
            worse += 1
        else:
            tie += 1
    return better, worse, tie


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("csv", nargs="?", default="老人对照实验-记录表.csv")
    args = ap.parse_args()

    rows = load(args.csv)
    if not rows:
        raise SystemExit("没有可用记录：completion 为空。先填 completion（0/1/2）。")

    cols = ["A", "B", "C"]
    data = {c: stats(rows, c) for c in cols}
    labels = {"A": "A 自己操作", "B": "B 现有助手", "C": "C 本作品"}

    print("| 指标 | A 自己操作 | B 现有助手 | C 本作品 |")
    print("|---|---:|---:|---:|")
    print(f"| 有效次数 | " + " | ".join(str(data[c]['n']) for c in cols) + " |")
    print(f"| 完成率（2+1） | " + " | ".join(fmt(data[c]['completion'], True) for c in cols) + " |")
    print(f"| 独立完成率（2） | " + " | ".join(fmt(data[c]['independent'], True) for c in cols) + " |")
    print(f"| 完成用时中位数（秒） | " + " | ".join(fmt(data[c]['median_time']) for c in cols) + " |")
    print(f"| 平均提示次数 | " + " | ".join(fmt(data[c]['prompts']) for c in cols) + " |")
    print(f"| 平均求助次数 | " + " | ".join(fmt(data[c]['helps']) for c in cols) + " |")
    print(f"| 误触总数 | " + " | ".join(fmt(data[c]['misclicks']) for c in cols) + " |")
    print(f"| 危险动作总数 | " + " | ".join(fmt(data[c]['danger']) for c in cols) + " |")
    print(f"| 能说出当前状态 | NA | {fmt(data['B']['understands'], True)} | {fmt(data['C']['understands'], True)} |")
    print(f"| 5 秒内能停下 | NA | {fmt(data['B']['can_stop'], True)} | {fmt(data['C']['can_stop'], True)} |")
    print(f"| 有用性均值（1—5） | " + " | ".join(fmt(data[c]['usefulness']) for c in cols) + " |")

    for left, right in (("C", "A"), ("C", "B")):
        b, w, t = paired(rows, left, right)
        print(f"\n- {left} 相对 {right} 的完成胜负（按人×任务配对）：更好 {b} / 更差 {w} / 持平 {t}")


if __name__ == "__main__":
    main()
