#!/usr/bin/env python3
"""把人工真值回填到某个已有 run 上（一个任务一个任务跑时用）。

    python3 tasks/record_truth.py <run_id> d|n|u [看懂了吗 y|n|空] [备注]

记录本身在跑完时就已落盘（见 run.py 的 record-then-update），这个脚本只补真值列，
因此即使操作者当时没在旁边，观测也不会丢。
"""
import importlib.util, sys, pathlib

spec = importlib.util.spec_from_file_location("runner", pathlib.Path(__file__).with_name("run.py"))
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__)
        return 2
    run_id, verdict = sys.argv[1], sys.argv[2].lower()
    understood = sys.argv[3] if len(sys.argv) > 3 else ""
    notes = sys.argv[4] if len(sys.argv) > 4 else ""
    outcome = {"d": "done", "n": "not_done", "u": "unknown"}.get(verdict)
    if outcome is None:
        print("真值只能是 d / n / u")
        return 2

    import csv
    with runner.RESULTS_CSV.open(newline="", encoding="utf-8") as handle:
        row = next((r for r in csv.DictReader(handle) if r["run_id"] == run_id), None)
    if row is None:
        print(f"找不到 run_id={run_id}")
        return 1
    ok = runner.update_result(run_id, {
        "real_outcome": outcome,
        "false_done": "yes" if (row["system_status"] == "COMPLETED" and outcome == "not_done") else "",
        "elder_understood": understood,
        "operator_notes": notes,
    })
    print(f"{run_id}: 真值={outcome} 看懂={understood or '未记'} 谎报={'是' if row['system_status']=='COMPLETED' and outcome=='not_done' else '否'}" if ok else "回填失败")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
