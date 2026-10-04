#!/usr/bin/env python3
"""把真机运行日志脱敏后再入库。

用法：
    python3 tasks/redact_log.py IN.log OUT.log [--terms FILE] [--report]

日志里会有第三方的真实页面文本（快递单号、地址、聊天内容、手机号），
直接提交到仓库等于把测试者的个人信息一起交出去。这个脚本做两层处理：

  1. 模式匹配：手机号、身份证、银行卡、邮箱、长数字串（运单号/订单号）、
     含门牌号的地址片段。
  2. 字面替换：--terms 指定的词表（一行一个），用于「新疆大学北校区西院」
     这类无法靠模式识别、但确实能定位到人的字符串。

脚本只做替换，不改动日志的行数与时间戳，因此脱敏后的日志仍可用于逐条复核
（第 N 步做了什么、何时收尾、判定结果是什么都不受影响）。
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

# 顺序重要：先长后短，避免身份证被手机号规则先吃掉一部分
PATTERNS: list[tuple[str, re.Pattern[str], str]] = [
    ("邮箱", re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"), "[邮箱]"),
    ("身份证", re.compile(r"(?<!\d)\d{17}[\dXx](?!\d)"), "[身份证]"),
    ("银行卡", re.compile(r"(?<!\d)\d{16,19}(?!\d)"), "[银行卡]"),
    ("手机号", re.compile(r"(?<!\d)1[3-9]\d{9}(?!\d)"), "[手机号]"),
    # 运单号/订单号：连续 10 位以上数字，常混字母（SF1234567890123）
    ("运单号", re.compile(r"(?<!\d)\d{10,}(?!\d)"), "[运单号]"),
    ("含字母运单号", re.compile(r"(?<![A-Za-z0-9])[A-Za-z]{2,4}\d{9,}(?![A-Za-z0-9])"), "[运单号]"),
    ("取件码", re.compile(r"(?<!\d)\d{1,3}-\d{1,2}-\d{3,4}(?!\d)"), "[取件码]"),
    # 门牌号式地址片段：xx路/街/号/栋/单元 + 数字
    ("门牌", re.compile(r"[\u4e00-\u9fa5]{2,12}(?:路|街|巷|号|栋|幢|单元|室|小区|花园|大厦)\s*\d+[号栋幢单元室]?"), "[地址]"),
]


def build_term_pattern(terms: list[str]) -> re.Pattern[str] | None:
    usable = [t.strip() for t in terms if len(t.strip()) >= 2]
    if not usable:
        return None
    # 长词优先，避免短词先匹配掉长词的一部分
    usable.sort(key=len, reverse=True)
    return re.compile("|".join(re.escape(t) for t in usable))


def redact(text: str, term_pattern: re.Pattern[str] | None) -> tuple[str, dict[str, int]]:
    counts: dict[str, int] = {}
    for name, pattern, replacement in PATTERNS:
        text, n = pattern.subn(replacement, text)
        if n:
            counts[name] = counts.get(name, 0) + n
    if term_pattern is not None:
        text, n = term_pattern.subn("[已脱敏]", text)
        if n:
            counts["词表"] = n
    return text, counts


def main() -> int:
    parser = argparse.ArgumentParser(description="真机日志脱敏")
    parser.add_argument("src", type=Path)
    parser.add_argument("dst", type=Path, nargs="?")
    parser.add_argument("--terms", type=Path, help="字面替换词表，一行一个")
    parser.add_argument("--report", action="store_true", help="只统计不写文件")
    parser.add_argument("--check", action="store_true", help="脱敏后自检残留并返回非零")
    args = parser.parse_args()

    terms = args.terms.read_text(encoding="utf-8").splitlines() if args.terms else []
    term_pattern = build_term_pattern(terms)

    text = args.src.read_text(encoding="utf-8", errors="replace")
    clean, counts = redact(text, term_pattern)

    if args.report:
        print(f"{args.src.name}: {counts or '未发现敏感模式'}")
        return 0

    if not args.dst:
        parser.error("需要输出路径（或使用 --report）")

    # 不改变行数：脱敏只做同行内替换
    if clean.count("\n") != text.count("\n"):
        print("脱敏改变了行数，拒绝写出", file=sys.stderr)
        return 2

    args.dst.write_text(clean, encoding="utf-8")

    if args.check:
        leftover = {name: len(p.findall(clean)) for name, p, _ in PATTERNS if p.findall(clean)}
        if leftover:
            print(f"自检发现残留：{leftover}", file=sys.stderr)
            return 1

    print(f"{args.src.name} → {args.dst.name}  脱敏 {counts or '无命中'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
