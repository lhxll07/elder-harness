from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


DECK = Path(__file__).resolve().parent
SOURCE = DECK.parent
OUTPUT = DECK / "assets"
FONT_PATH = subprocess.check_output(
    ["fc-match", "-f", "%{file}", "Noto Sans CJK SC"], text=True
).strip()


def prepare(source: Path, name: str, bounds: tuple[int, int, int, int] | None = None) -> dict:
    image = Image.open(source).convert("RGB")
    if bounds is not None:
        drawing = ImageDraw.Draw(image)
        drawing.rectangle(bounds, fill="#dce9e2")
        font = ImageFont.truetype(FONT_PATH, 42)
        drawing.text(
            (bounds[0] + 25, bounds[1] + 22),
            "取件信息已脱敏",
            font=font,
            fill="#28564b",
        )
    destination = OUTPUT / name
    image.save(destination, optimize=True)
    return {
        "asset": name,
        "source": str(source.relative_to(SOURCE)),
        "source_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "asset_sha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
        "redacted_bounds": bounds,
        "other_edits": "none",
        "evidence_scope": "archived interface, not a new real-device run",
    }


def main() -> None:
    OUTPUT.mkdir(exist_ok=True)
    records = [
        prepare(SOURCE / "figures/shot-home.png", "home.png"),
        prepare(
            SOURCE / "experiments/raw/R1-拼多多-原页面.png",
            "parcel-page.png",
            (35, 1318, 1236, 1430),
        ),
        prepare(
            SOURCE / "experiments/raw/R1-拼多多-答案卡.png",
            "parcel-result.png",
            (90, 1215, 1155, 1430),
        ),
    ]
    (OUTPUT / "provenance.json").write_text(
        json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Prepared {len(records)} local archive assets; original files unchanged.")


if __name__ == "__main__":
    main()
