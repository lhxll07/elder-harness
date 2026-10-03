#!/usr/bin/env python3
"""组装答辩演示 HTML：每页一个文件，改哪页改哪个文件，互不影响。"""
import pathlib, re, sys

D = pathlib.Path(__file__).parent
S = D / "slides"

def load(pattern, label):
    files = sorted(S.glob(pattern))
    if not files:
        sys.exit(f"✗ 找不到{label}文件：{pattern}")
    return [f.read_text(encoding="utf-8").strip() for f in files], files

main, mf = load("p*.html", "正文")
back, bf = load("b*.html", "备用")
css = (D / "deck.css").read_text(encoding="utf-8")

html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>银龄智办 · 答辩演示</title>
<link rel="stylesheet" href="deck.css"></head>
<body>
{chr(10).join(main)}
<div style="page-break-before:always;break-before:page"></div>
{chr(10).join(back)}
</body></html>"""

(D / "答辩演示.html").write_text(html, encoding="utf-8")
print(f"✓ 正文 {len(main)} 张（{mf[0].name}…{mf[-1].name}）+ 备用 {len(back)} 张 = {len(main)+len(back)} 张")
