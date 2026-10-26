#!/usr/bin/env python3
"""Build a 14-page main presentation and 10-page appendix into live and print HTML."""

from __future__ import annotations

import re
from pathlib import Path


DECK = Path(__file__).resolve().parent
PAGE_WIDTH, PAGE_HEIGHT = 1600, 900
MAIN_COUNT, APPENDIX_COUNT = 14, 10


def load_slides() -> list[str]:
    files = sorted((DECK / "slides").glob("p*.html"))
    if len(files) != MAIN_COUNT + APPENDIX_COUNT:
        raise ValueError("Expected 14 main slides and 10 appendix slides")
    slides = []
    for page, source in enumerate(files, start=1):
        if source.name != f"p{page:02d}.html":
            raise ValueError(f"Slide sequence is not contiguous: {source.name}")
        body = source.read_text(encoding="utf-8").strip()
        section = "main" if page <= MAIN_COUNT else "appendix"
        if f'data-section="{section}"' not in body:
            raise ValueError(f"Wrong presentation section: {source.name}")
        if not re.search(rf'class="pno">{page:02d}</span>', body):
            raise ValueError(f"Wrong footer page number: {source.name}")
        if body.count('<section class="slide') != 1 or body.count("<h1 ") != 1:
            raise ValueError(f"Expected one slide and one headline: {source.name}")
        for asset in re.findall(r'<img[^>]+src="([^"]+)"', body):
            if not (DECK / asset).is_file():
                raise ValueError(f"Missing local asset: {asset}")
        slides.append(body.replace("<section ", f'<section id="p{page}" ', 1))
    return slides


def document(body: str, css: str, title: str, script: str = "") -> str:
    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<style>{css}</style>
</head>
<body>
{body}
{script}
</body>
</html>
"""


def build_live(slides: list[str], css: str) -> str:
    live_css = """
html, body { background: #071c22; overflow: hidden; }
.viewport { position: fixed; inset: 0 0 46px; display: flex; align-items: center; justify-content: center; }
.stage { width: 1600px; height: 900px; flex: none; transform-origin: center; box-shadow: 0 20px 90px #0006; }
.stage .slide { display: none; }
.stage .slide.on { display: flex; }
.hud { position: fixed; bottom: 0; left: 0; right: 0; height: 46px; display: flex; justify-content: space-between; align-items: center; padding: 0 28px; color: #adc5c3; font: 13px var(--sans); }
.hud button { margin-left: 12px; background: none; border: 1px solid #355056; color: #d9eee5; padding: 4px 12px; cursor: pointer; font: inherit; }
.hud button:focus-visible, .index-link:focus-visible { outline: 2px solid #77e6c3; outline-offset: 4px; }
"""
    body = f"""<main class="viewport"><div class="stage" id="stage">{''.join(slides)}</div></main>
<nav class="hud" aria-label="演示导航">
<span>← → 翻页　·　F 全屏　·　A 备份　·　M 主讲</span>
<span><span id="position" aria-live="polite"></span><button id="main-button">主讲</button><button id="appendix-button">备份目录</button></span>
</nav>"""
    script = f"""<script>
const slides = [...document.querySelectorAll('.slide')];
const stage = document.getElementById('stage');
const position = document.getElementById('position');
const mainCount = {MAIN_COUNT};
let currentIndex = 0;

function show(requestedIndex) {{
  currentIndex = Math.max(0, Math.min(slides.length - 1, requestedIndex));
  slides.forEach((slide, index) => {{
    slide.classList.toggle('on', index === currentIndex);
    slide.setAttribute('aria-hidden', String(index !== currentIndex));
  }});
  const isAppendix = currentIndex >= mainCount;
  position.textContent = isAppendix
    ? '备份 ' + (currentIndex - mainCount + 1) + ' / ' + (slides.length - mainCount)
    : '主讲 ' + (currentIndex + 1) + ' / ' + mainCount;
  history.replaceState(null, '', '#p' + (currentIndex + 1));
}}

function fit() {{
  const scale = Math.min(innerWidth / {PAGE_WIDTH}, (innerHeight - 46) / {PAGE_HEIGHT}) * .98;
  stage.style.transform = 'scale(' + scale + ')';
}}

function advance(direction) {{
  const lastIndex = currentIndex < mainCount ? mainCount - 1 : slides.length - 1;
  show(Math.max(0, Math.min(lastIndex, currentIndex + direction)));
}}

addEventListener('resize', fit);
addEventListener('keydown', event => {{
  if (event.target.closest('button, a') && event.key === 'Enter') return;
  if (['ArrowRight', 'ArrowDown', ' ', 'PageDown', 'Enter'].includes(event.key)) {{ advance(1); event.preventDefault(); }}
  else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(event.key)) {{ advance(-1); event.preventDefault(); }}
  else if (event.key === 'Home') {{ show(currentIndex < mainCount ? 0 : mainCount); event.preventDefault(); }}
  else if (event.key === 'End') {{ show(currentIndex < mainCount ? mainCount - 1 : slides.length - 1); event.preventDefault(); }}
  else if (event.key.toLowerCase() === 'a') show(mainCount);
  else if (event.key.toLowerCase() === 'm') show(0);
  else if (event.key.toLowerCase() === 'f') {{
    const operation = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    operation.catch(() => {{}});
  }}
}});
stage.addEventListener('click', event => {{
  const link = event.target.closest('a[href^="#p"]');
  if (link) {{ event.preventDefault(); show(Number(link.hash.slice(2)) - 1); return; }}
  if (!event.target.closest('button, a')) advance(event.clientX < innerWidth / 2 ? -1 : 1);
}});
addEventListener('hashchange', () => {{
  const page = Number(location.hash.slice(2));
  if (Number.isInteger(page) && page >= 1 && page <= slides.length) show(page - 1);
}});
document.getElementById('main-button').addEventListener('click', () => show(0));
document.getElementById('appendix-button').addEventListener('click', () => show(mainCount));
const initialPage = /^#p\\d+$/.test(location.hash) ? Number(location.hash.slice(2)) : 1;
fit();
show(initialPage - 1);
</script>"""
    return document(body, css + live_css, "银龄智办 · 答辩重构版", script)


def main() -> None:
    css = (DECK / "deck.css").read_text(encoding="utf-8")
    slides = load_slides()
    (DECK / "deck.print.html").write_text(
        document("\n".join(slides), css, "银龄智办 · 答辩重构版"), encoding="utf-8"
    )
    (DECK / "deck.html").write_text(build_live(slides, css), encoding="utf-8")
    print(f"Built {MAIN_COUNT} main + {APPENDIX_COUNT} appendix slides, {PAGE_WIDTH}×{PAGE_HEIGHT}.")


if __name__ == "__main__":
    main()
