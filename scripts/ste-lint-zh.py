#!/usr/bin/env python3
"""检查中文技术文本的受控用语与句长，不修改输入文件。"""

import argparse
import re
from pathlib import Path


FORBIDDEN = {
    "进行": "直接使用动作动词",
    "加以": "直接使用动作动词",
    "需要注意的是": "删除套话",
    "在一定程度上": "明确条件或删除套话",
    "无缝": "描述具体行为",
    "强大": "描述具体能力",
    "赋能": "描述具体作用",
    "闭环": "描述流程或结果",
    "若干": "写明数量或范围",
    "一些": "写明对象或范围",
    "相关": "写明对象",
}


def plain_text(text):
    text = re.sub(r"!\[([^\]]*)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"\[[\d,，、 —–-]+\]", "", text)
    text = re.sub(r"\$[^$]*\$", "公式", text)
    text = re.sub(r"<br\s*/?>", "。", text)
    return re.sub(r"[*`\s]", "", text)


def check(path):
    issues = []
    fenced = False
    references = False
    display_math = False
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        stripped = line.strip()
        if stripped.startswith("```"):
            fenced = not fenced
            continue
        if fenced:
            continue
        if stripped == "#### 2. 参考文献":
            references = True
            continue
        if references and stripped.startswith("### "):
            references = False
        if references or stripped.startswith(">"):
            continue
        if stripped.startswith("$$"):
            if stripped.count("$$") == 1:
                display_math = not display_math
            continue
        if display_math or not stripped or stripped.startswith(("#", "![", "<!--")):
            continue
        if re.fullmatch(r"[|: —-]+", stripped):
            continue
        for phrase, advice in FORBIDDEN.items():
            if phrase in stripped:
                issues.append((line_number, "用词", f"{phrase}：{advice}"))
        if "；" in stripped or ";" in stripped:
            issues.append((line_number, "分号", "改为独立句或列表"))
        cells = stripped.strip("|").split("|") if stripped.startswith("|") else [stripped]
        for cell in cells:
            clean = plain_text(re.sub(r"^\s*(?:[-*]|\d+\.)\s+", "", cell))
            for sentence in re.split(r"[。！？!?]", clean):
                sentence = sentence.strip("：:，、\"“”‘’（）()")
                if not re.search(r"[\u4e00-\u9fff]", sentence):
                    continue
                limit = 25 if re.match(r"^(?:请|点击|点按|按下|打开|输入|选择|填入|运行|执行命令)", sentence) else 40
                if len(sentence) > limit:
                    issues.append((line_number, "句长", f"{len(sentence)}>{limit}：{sentence}"))
    return issues


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("files", nargs="+", type=Path)
    arguments = parser.parse_args()
    total = 0
    for path in arguments.files:
        issues = check(path)
        for line_number, category, message in issues:
            print(f"{path}:{line_number}: {category}: {message}")
        total += len(issues)
        print(f"{path}: {len(issues)} 项检查提示")
    return int(total > 0)


if __name__ == "__main__":
    raise SystemExit(main())
