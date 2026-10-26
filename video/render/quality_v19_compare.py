import argparse
import json
from pathlib import Path
import subprocess

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
TIMES = [8.8, 20, 61.3, 81.5, 121.15, 153.5, 172.4, 191.5]


def main():
    parser = argparse.ArgumentParser(description='Static v18/v19 material and lighting comparison; no playback')
    parser.add_argument('--output', type=Path, default=ROOT / 'tmp/quality-v19-comparison.jpg')
    arguments = parser.parse_args()
    scratch = ROOT / 'tmp/quality-v19-comparison'
    scratch.mkdir(exist_ok=True)
    sheet = Image.new('RGB', (1920, len(TIMES) * 572), '#0b141c')
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 19)
    for index, time in enumerate(TIMES):
        baseline = scratch / f'baseline-{index}.png'
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', str(time), '-i',
                        str(ROOT / 'out/review/fusion-v18/fusion-v18.mp4'), '-frames:v', '1', str(baseline)], check=True)
        upgraded = ROOT / f'tmp/quality-v19-check-4k/t-{round(time * 60):06d}.jpg'
        for column, source_path in enumerate([baseline, upgraded]):
            with Image.open(source_path) as source:
                tile = source.convert('RGB').resize((960, 540), Image.Resampling.LANCZOS)
            sheet.paste(tile, (column * 960, index * 572))
            draw.text((column * 960 + 18, index * 572 + 546),
                      f'{"v18 baseline" if column == 0 else "v19 Blender / 4K to 1080p"}  |  {time:.2f}s', font=font, fill='#d3e3e9')
    arguments.output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(arguments.output, quality=95, subsampling=0)
    print(json.dumps({'file': str(arguments.output), 'comparisons': len(TIMES), 'playback': False}))


if __name__ == '__main__':
    main()
