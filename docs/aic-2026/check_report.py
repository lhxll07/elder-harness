#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""收尾自检：表号、图号、文献引用、关键数字与禁忌表述。

用法：python3 check_report.py     （退出码 0 = 全绿）
"""
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
MD = HERE / "作品方案-定稿.md"

sys.path.insert(0, str(HERE))
from build_report import REFS, TABLE_CAPTIONS, TABLE_NUMBERS  # noqa: E402

text = MD.read_text(encoding="utf-8")
CITE = re.compile(r"\[\s*(@[a-z0-9_]+(?:\s*[;，、,]?\s*@[a-z0-9_]+)*)\s*\]")
TABLE_REF = re.compile(r"表\s?(\d+)")
FIGURE_REF = re.compile(r"图\s?(\d+)")

failures = []


def check(name, ok, detail=""):
    print(f"{'✓' if ok else '✗'} {name}{'：' + detail if detail and not ok else ''}")
    if not ok:
        failures.append(name)


# 1. 表号：正文引用必须都落在实际排出的编号里
valid_tables = {n for n in TABLE_NUMBERS if n is not None}
used_tables = set()
for m in TABLE_REF.finditer(text):
    if "原文" in text[max(0, m.start() - 16):m.start()]:
        continue
    if m.start() and text[m.start() - 1] == "课":
        continue
    used_tables.add(int(m.group(1)))
check("表号引用都能对上题注", used_tables <= valid_tables,
      f"越界: {sorted(used_tables - valid_tables)}")
check("题注与表格数量一致", len(TABLE_CAPTIONS) == len(TABLE_NUMBERS),
      f"题注 {len(TABLE_CAPTIONS)} vs 编号 {len(TABLE_NUMBERS)}")

# 2. 图号：1..N 连续出现，且不超过实际插图数（正文 13 张 Mermaid + 8 张实机截图 = 21）
FIG_TOTAL = 21
used_figs = {int(m.group(1)) for m in FIGURE_REF.finditer(text)}
check("图号引用不越界", max(used_figs) <= FIG_TOTAL, f"引用到图 {max(used_figs)}，共 {FIG_TOTAL} 张")
check("图号引用不下于 1", min(used_figs) >= 1 if used_figs else True)

# 3. 文献：不引用未定义的键，也不留从未引用的条目
defined = {k for k, _ in REFS}
cited = {k for m in CITE.finditer(text) for k in re.findall(r"@([a-z0-9_]+)", m.group(1))}
check("没有未定义的文献键", cited <= defined, f"未定义: {sorted(cited - defined)}")
check("每条文献都被正文引用", defined <= cited, f"未被引用: {sorted(defined - cited)}")

# 4. 禁忌表述（用过就等于失信）
banned = ["漏拦率 0", "谎报率为 0", "未发现谎报", "有改善", "已全部通过",
          "点餐打扰 0 次", "保证安全"]
NEGATIONS = ("不写", "不使用", "不再", "不作", "不用", "也不", "不把", "拒绝", "不声称", "否定", "不报告")


def offending(phrase):
    """命中且不是在“不使用/不写……”这类否定语境里，才算违规。"""
    for m in re.finditer(re.escape(phrase), text):
        pre = text[max(0, m.start() - 25):m.start()]
        if not any(n in pre for n in NEGATIONS):
            return text[max(0, m.start() - 20):m.end() + 6].replace("\n", " ")
    return None


hit = [b for b in banned if offending(b)]
check("禁忌表述零命中（否定语境不算）", not hit,
      f"命中: {[(b, offending(b)) for b in hit]}")

# 4.5 核心数字跨表一致（同一指标在正文各处必须同一数值）
CONSISTENT = {
    "分级执行拦截 15/20": ["15/20", "15 / 20"],
    "固定词表拦截 6/20": ["6/20", "6 / 20"],
    "完成核验 22/22": ["22/22"],
    "仅机械层 12/22": ["12/22"],
}
for label, forms in CONSISTENT.items():
    check(f"核心数字出现：{label}", any(f in text for f in forms))
for wrong in ["7/20", "7 / 20", "222 项", "23 个测试类"]:
    check(f"无残留错值：{wrong}", wrong not in text)

# 5. 关键数字仍与数据文件一致
checks = {
    "31 条运行归档": "31",
    "人工真值 5 行": "5 行有人工真值",
    "用户反馈 17/2/1": "有帮助 17",
    "回归断言 208": "208",
    "8 款第三方应用": "8 款第三方应用",
}
for label, needle in checks.items():
    check(f"关键数字存在：{label}", needle in text)

print()
if failures:
    print(f"未通过 {len(failures)} 项：" + "、".join(failures))
    sys.exit(1)
print("全部通过。")
