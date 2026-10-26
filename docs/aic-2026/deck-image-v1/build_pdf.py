from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageOps


PAGE_COUNT = 17
CANVAS = (3840, 2160)
ROOT = Path(__file__).resolve().parent


def main() -> None:
    parser = argparse.ArgumentParser(description="将整页生图合成为 17 页答辩 PDF")
    parser.add_argument("--partial", action="store_true", help="只合成已归档的连续前缀页")
    arguments = parser.parse_args()
    paths = [ROOT / "slides" / f"p{page:02d}.png" for page in range(1, PAGE_COUNT + 1)]
    if arguments.partial:
        available = []
        for path in paths:
            if not path.is_file():
                break
            available.append(path)
        paths = available
    else:
        missing = [path.name for path in paths if not path.is_file()]
        if missing:
            parser.error("尚缺整页图片：" + "、".join(missing))
    if not paths:
        parser.error("尚未归档第 1 页图片")
    pages = []
    try:
        for path in paths:
            with Image.open(path) as source:
                page = ImageOps.exif_transpose(source).convert("RGB")
            if page.size != CANVAS:
                page.close()
                parser.error(f"{path.name} 尺寸应为 {CANVAS}，实际为 {source.size}")
            pages.append(page)
        name = "银龄智办-17页生图答辩.pdf"
        if arguments.partial:
            name = f"银龄智办-生图答辩-前{len(pages):02d}页预览.pdf"
        output = ROOT / name
        pages[0].save(
            output,
            "PDF",
            save_all=True,
            append_images=pages[1:],
            resolution=288.0,
            quality=98,
            subsampling=0,
            optimize=True,
            title="银龄智办——可信跨应用助老智能体",
            author="能工智人团队",
        )
        print(f"已生成 {len(pages)} 页：{output}")
    finally:
        for page in pages:
            page.close()


if __name__ == "__main__":
    main()
