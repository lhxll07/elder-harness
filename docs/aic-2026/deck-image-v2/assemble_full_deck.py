import hashlib
import json
import re
import subprocess
import unicodedata
from collections import Counter
from pathlib import Path

from fontTools.ttLib import TTFont
from PIL import Image, ImageChops, ImageStat

from prepare_unified_fonts import SlideText


DIRECTORY = Path(__file__).resolve().parent
TITLES = [
    "封面", "需求与价值", "产品全景", "场景闭环", "总体架构", "绑定创新",
    "授权创新", "证据创新", "双通道感知", "经验演进", "亲友协作", "机制实证",
    "工程交付", "完整办事链", "应用价值", "推广路径", "终场",
]
BACKGROUND_SOURCES = [
    "e7e23a92-fef5-43e3-8777-c03f404566cd",
    "d317c1dc-16a8-4212-a1b4-c6553d15c8b4",
    "2344fca6-494f-4ffd-9559-202afbaca67f",
    "12f0a8b8-d8e2-44a8-be8d-ed72a7347082",
    "c5fd2b44-1705-4834-8b09-24deab4cddfb",
    "a956ca21-bf95-47e7-a918-f5365a10a7aa",
    "7f61ef52-776f-4f76-9b98-b87c411cc9d8",
    "59f4ee42-c81e-456e-8c49-9c7e3bfb3766",
    "0d0debb5-5fba-4908-b629-e607e0723e3e",
]


def run(*arguments):
    return subprocess.run(arguments, cwd=DIRECTORY, check=True, capture_output=True, text=True).stdout


def normalize(text):
    return "".join(character for character in unicodedata.normalize("NFKC", text) if not character.isspace())


def pdf_metadata(pdf):
    metadata = run("pdfinfo", str(pdf))
    pages = int(re.search(r"^Pages:\s+(\d+)", metadata, re.MULTILINE).group(1))
    dimensions = re.search(r"^Page size:\s+([\d.]+) x ([\d.]+) pts", metadata, re.MULTILINE)
    return pages, [float(dimensions.group(1)), float(dimensions.group(2))]


def overview(images, destination, columns, thumbnail_width):
    thumbnail_height = thumbnail_width * 9 // 16
    gap = 12
    rows = (len(images) + columns - 1) // columns
    canvas = Image.new("RGB", (columns * (thumbnail_width + gap) + gap, rows * (thumbnail_height + gap) + gap), "#e8eef4")
    for index, image_path in enumerate(images):
        with Image.open(image_path) as image:
            thumbnail = image.convert("RGB").resize((thumbnail_width, thumbnail_height), Image.Resampling.LANCZOS)
            canvas.paste(thumbnail, (gap + index % columns * (thumbnail_width + gap), gap + index // columns * (thumbnail_height + gap)))
    canvas.save(destination)


def main():
    browser_reports = [json.loads((DIRECTORY / f"previews/{name}-validation.json").read_text()) for name in ["unified", "continuation"]]
    assert all(report["passed"] for report in browser_reports), "Browser checks must pass before assembly"
    pdf_directory = DIRECTORY / "previews/pdf"
    pdf_directory.mkdir(exist_ok=True)
    reports = []
    pdfs = []
    previews = []
    pdf_previews = []
    for page, title in enumerate(TITLES, start=1):
        page_name = "cover" if page == 1 else f"p{page:02}"
        pdf_name = "银龄智办-封面.pdf" if page == 1 else f"银龄智办-第{page:02}页-{title}.pdf"
        pdf = DIRECTORY / pdf_name
        preview = DIRECTORY / f"previews/{page_name}-4k.png"
        document = SlideText()
        document.feed((DIRECTORY / f"{page_name}.html").read_text())
        source_text = "".join(document.fragments)
        expected_text = normalize(source_text)
        extracted_text = normalize(run("pdftotext", "-enc", "UTF-8", str(pdf), "-"))
        missing_characters = sorted((Counter(expected_text) - Counter(extracted_text)).elements())
        font_prefix = "cover-sc" if page == 1 else "p06-sc" if page == 6 else f"p{page:02}-unified-sc"
        missing_glyphs = {}
        for weight in ["regular", "bold"]:
            with TTFont(DIRECTORY / f"assets/fonts/{font_prefix}-{weight}.otf") as font:
                cmap = font.getBestCmap()
                missing_glyphs[weight] = sorted(set(character for character in source_text if not character.isspace() and ord(character) not in cmap))
        font_rows = run("pdffonts", str(pdf)).splitlines()[2:]
        embedded_fonts = bool(font_rows) and all(re.search(r"\byes\s+yes\s+yes\s+\d+\s+\d+\s*$", row) for row in font_rows)
        pages, dimensions = pdf_metadata(pdf)
        with Image.open(preview) as image:
            preview_dimensions = list(image.size)
        background_details = None
        if page >= 9:
            background = DIRECTORY / f"assets/p{page:02}-background.png"
            digest = hashlib.sha256(background.read_bytes()).hexdigest()
            source = Path.home() / f"Downloads/playground-batch-{BACKGROUND_SOURCES[page - 9]}-1.png"
            source_digest = hashlib.sha256(source.read_bytes()).hexdigest() if source.exists() else None
            with Image.open(background) as image:
                background_dimensions = list(image.size)
            background_details = {"sha256": digest, "dimensions": background_dimensions, "original_unchanged": digest == source_digest if source_digest else None}
        run("pdftoppm", "-scale-to-x", "1440", "-scale-to-y", "810", "-singlefile", "-png", str(pdf), str(pdf_directory / page_name))
        pdf_preview = pdf_directory / f"{page_name}.png"
        with Image.open(preview) as browser_image, Image.open(pdf_preview) as pdf_image:
            reference = browser_image.convert("RGB").resize(pdf_image.size, Image.Resampling.LANCZOS)
            difference = ImageStat.Stat(ImageChops.difference(reference, pdf_image.convert("RGB")))
            mean_difference = sum(difference.mean) / 3
        report = {
            "page": page, "pdf": pdf_name, "preview_dimensions": preview_dimensions,
            "pdf_pages": pages, "pdf_page_points": dimensions,
            "fonts_embedded_subset_unicode": embedded_fonts,
            "missing_glyphs": missing_glyphs, "missing_pdf_characters": missing_characters,
            "background": background_details,
            "preview_pdf_mean_channel_difference": round(mean_difference, 4),
        }
        report["passed"] = pages == 1 and dimensions == [960.0, 540.0] and preview_dimensions == [3840, 2160] and embedded_fonts and not missing_characters and all(not glyphs for glyphs in missing_glyphs.values()) and mean_difference < 5 and (background_details is None or background_details["original_unchanged"] is not False)
        reports.append(report)
        pdfs.append(pdf)
        previews.append(preview)
        pdf_previews.append(pdf_preview)
        print(f"{page_name}: {'passed' if report['passed'] else 'FAILED'} (PDF, fonts, text, source image)")
    aggregate = {"date": "2026-10-24", "pages": reports, "passed": all(report["passed"] for report in reports)}
    report_path = DIRECTORY / "previews/full-deck-artifacts.json"
    report_path.write_text(json.dumps(aggregate, ensure_ascii=False, indent=2) + "\n")
    assert aggregate["passed"], f"Artifact checks failed; see {report_path}"
    merged = DIRECTORY / "银龄智办-完整17页-答辩.pdf"
    continuation = DIRECTORY / "银龄智办-后09页-机制与价值.pdf"
    run("pdfunite", *(str(pdf) for pdf in pdfs), str(merged))
    run("pdfunite", *(str(pdf) for pdf in pdfs[8:]), str(continuation))
    assert pdf_metadata(merged) == (17, [960.0, 540.0])
    assert pdf_metadata(continuation) == (9, [960.0, 540.0])
    aggregate["merged_pdf"] = merged.name
    aggregate["merged_pdf_pages"] = 17
    aggregate["continuation_pdf_pages"] = 9
    report_path.write_text(json.dumps(aggregate, ensure_ascii=False, indent=2) + "\n")
    overview(previews, DIRECTORY / "previews/full-deck-review.png", 3, 768)
    overview(pdf_previews, DIRECTORY / "previews/full-deck-pdf-review.png", 3, 768)
    overview(previews[8:], DIRECTORY / "previews/continuation-review.png", 3, 960)
    overview(pdf_previews[8:], DIRECTORY / "previews/continuation-pdf-review.png", 3, 960)
    print(f"Assembled and verified: {merged.name} (17 pages)")


if __name__ == "__main__":
    main()
