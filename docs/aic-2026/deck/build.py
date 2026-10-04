#!/usr/bin/env python3
"""把 deck/slides/pNN.html 与 deck.css 合成为两份产物：

  1. deck/deck.print.html —— 单文件、连续分页，供 Chromium 打印 PDF
  2. deck/deck.html       —— 带键盘导航的演示版（左右/空格翻页，供现场全屏演示）

用法：
    python3 deck/build.py          # 合成 HTML
    bash deck/build_pdf.sh         # 合成 HTML 并导出 PDF

单页文件约定：每个 slides/pNN.html 只写 <div class="slide">…</div>，
样式一律来自 deck.css，不在页内写行内 <style>。
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

DECK = Path(__file__).resolve().parent
SLIDES = DECK / "slides"
CSS = DECK / "deck.css"
OUT_PRINT = DECK / "deck.print.html"
OUT_LIVE = DECK / "deck.html"

# 页面尺寸（与 build_pdf.sh 的 --print-to-pdf 尺寸一致）
PAGE_W, PAGE_H = 1600, 900


def load_slides() -> list[tuple[str, str]]:
    files = sorted(SLIDES.glob("p*.html"))
    if not files:
        sys.exit(f"错误：{SLIDES} 下没有找到 p*.html")
    slides: list[tuple[str, str]] = []
    for f in files:
        body = f.read_text(encoding="utf-8")
        if 'class="slide' not in body:
            sys.exit(f"错误：{f.name} 里没有找到 .slide 容器（单页文件只写 slide 内容）")
        # 每页文件的页码占位：把 .pno 里的内容与文件名核对，防止漏页/串页
        expected = f.stem[1:]  # p07 -> 07
        m = re.search(r'class="pno">\s*(\d+)\s*<', body)
        if m and m.group(1) != expected:
            print(f"  ! {f.name} 页码标注为 {m.group(1)}，与文件名不符", file=sys.stderr)
        slides.append((f.stem, body.strip()))
    return slides


def build_print(slides: list[tuple[str, str]], css: str) -> str:
    body = "\n\n".join(f"<!-- {name} -->\n{html}" for name, html in slides)
    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>银龄智办 · 答辩演示</title>
<style>
{css}
</style>
</head>
<body>
{body}
</body>
</html>
"""


def build_live(slides: list[tuple[str, str]], css: str) -> str:
    """演示版：只显示一页，方向键/空格/PageUp/PageDown 切换。"""
    body = "\n\n".join(f"<!-- {name} -->\n{html}" for name, html in slides)
    n = len(slides)
    live_css = f"""
html, body {{ background:#0B0E12; overflow:hidden; }}
.stage {{
  position:fixed; inset:0;
  display:flex; align-items:center; justify-content:center;
}}
.stage .slide {{
  display:none;
  flex:none;
  box-shadow:0 24px 80px rgba(0,0,0,.55);
}}
.stage .slide.on {{ display:flex; }}
/* 等比缩放到视口 */
#scale {{ transform-origin:center center; }}
.hud {{
  position:fixed; right:20px; bottom:16px;
  font:600 13px/1 var(--mono);
  color:#8A939E; letter-spacing:.06em;
  background:rgba(11,14,18,.72); padding:8px 12px; border-radius:8px;
  z-index:99; user-select:none;
}}
.hint {{
  position:fixed; left:20px; bottom:16px;
  font:500 12.5px/1.4 var(--sans);
  color:#5C6672; z-index:99; user-select:none;
}}
"""
    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>银龄智办 · 答辩演示（演示版）</title>
<style>
{css}
{live_css}
</style>
</head>
<body>
<div class="stage" id="scale">
{body}
</div>
<div class="hud"><span id="cur">1</span> / {n}</div>
<div class="hint">← → 翻页　·　F 全屏　·　Home / End 首尾</div>
<script>
const slides = [...document.querySelectorAll('.slide')];
const stage  = document.getElementById('scale');
const cur    = document.getElementById('cur');
let i = 0;

function show(k) {{
  i = Math.max(0, Math.min(slides.length - 1, k));
  slides.forEach((s, n) => s.classList.toggle('on', n === i));
  cur.textContent = i + 1;
  location.hash = 'p' + (i + 1);
}}

function fit() {{
  const s = Math.min(innerWidth / {PAGE_W}, innerHeight / {PAGE_H}) * 0.96;
  stage.style.transform = 'scale(' + s + ')';
}}
addEventListener('resize', fit);

addEventListener('keydown', e => {{
  if (['ArrowRight','ArrowDown',' ','PageDown','Enter'].includes(e.key)) {{ show(i+1); e.preventDefault(); }}
  else if (['ArrowLeft','ArrowUp','PageUp','Backspace'].includes(e.key)) {{ show(i-1); e.preventDefault(); }}
  else if (e.key === 'Home') {{ show(0); e.preventDefault(); }}
  else if (e.key === 'End')  {{ show(slides.length-1); e.preventDefault(); }}
  else if (e.key === 'f' || e.key === 'F') {{
    document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
  }}
}});
stage.addEventListener('click', e => show(i + (e.clientX < innerWidth/2 ? -1 : 1)));

const fromHash = parseInt((location.hash.match(/^#p(\\d+)$/) || [])[1], 10);
fit();
show(Number.isFinite(fromHash) ? fromHash - 1 : 0);
</script>
</body>
</html>
"""


def main() -> None:
    css = CSS.read_text(encoding="utf-8")
    slides = load_slides()

    OUT_PRINT.write_text(build_print(slides, css), encoding="utf-8")
    OUT_LIVE.write_text(build_live(slides, css), encoding="utf-8")

    size = OUT_PRINT.stat().st_size / 1024
    print(f"合成 {len(slides)} 页：")
    for name, _ in slides:
        print(f"  · {name}")
    print(f"\n{OUT_PRINT.name}  {size:.0f} KB   （打印 / PDF）")
    print(f"{OUT_LIVE.name}   （现场演示）")


if __name__ == "__main__":
    main()
