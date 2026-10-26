import argparse
import json
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont


parser = argparse.ArgumentParser()
parser.add_argument('directory', type=Path)
arguments = parser.parse_args()
directory = arguments.directory
video = directory / f'{directory.name}.mp4'
probe = json.loads(subprocess.check_output([
    'ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(video),
]))
streams = probe['streams']
stream = next(item for item in streams if item['codec_type'] == 'video')
fps_numerator, fps_denominator = map(int, stream['avg_frame_rate'].split('/'))
fps = fps_numerator / fps_denominator
files = sorted((directory / 'frames').glob('f*.jpg'))
indices = [int(file.stem[1:]) for file in files]
metadata_path = directory / 'film.json'
metadata = json.loads(metadata_path.read_text()) if metadata_path.exists() else {}
expected_count = metadata.get('frames', round(float(stream['duration']) * fps))
expected_resolution = (metadata.get('render', {}).get('width', stream['width']), metadata.get('render', {}).get('height', stream['height']))
resolution_failures = []
contiguous = bool(indices) and indices == list(range(indices[0], indices[0] + expected_count))
differences = []
blank_scene_frames = []
previous = None
for file in files:
    with Image.open(file) as source:
        if source.size != expected_resolution:
            resolution_failures.append({'frame': file.name, 'resolution': source.size})
        source.draft('RGB', (480, 270))
        current = np.asarray(source.convert('RGB').resize((480, 270), Image.Resampling.BILINEAR), dtype=np.float32)
    if metadata.get('version', 0) >= 14 and int(file.stem[1:]) / fps >= 1.3 and float(current[68:202, 96:384].mean()) <= 2:
        blank_scene_frames.append(file.name)
    if previous is not None:
        differences.append(float(np.abs(current - previous).mean()))
    previous = current
differences = np.asarray(differences)
candidates = []
for offset, difference in enumerate(differences):
    neighborhood = np.concatenate((differences[max(0, offset - 12):offset], differences[offset + 1:offset + 13]))
    typical = float(np.median(neighborhood)) if len(neighborhood) else 0
    if difference > max(8, typical * 6):
        candidates.append({'frame': indices[offset + 1], 'time': indices[offset + 1] / fps, 'difference': float(difference), 'neighborhood_median': typical})
boundaries = []
for chapter in metadata.get('shots', [])[1:]:
    frame = round(chapter['start'] * fps)
    offset = frame - indices[0] - 1
    if 0 <= offset < len(differences):
        boundaries.append({'time': chapter['start'], 'chapter': chapter['name'], 'difference': float(differences[offset]), 'maximum_near_boundary': float(differences[max(0, offset - 12):offset + 13].max())})
decode = subprocess.run(['ffmpeg', '-v', 'error', '-threads', '2', '-i', str(video), '-f', 'null', '-'], capture_output=True, text=True)
format_passed = stream['codec_name'] == 'h264' and stream['width'] == 1920 and stream['height'] == 1080 and stream['pix_fmt'] == 'yuv420p' and len(streams) == 1 and abs(fps - metadata.get('fps', fps)) < 0.001 and int(stream.get('nb_frames', 0)) == expected_count
report = {
    'video': str(video), 'duration': float(stream['duration']), 'fps': fps,
    'frame_count': len(files), 'encoded_frames': int(stream.get('nb_frames', 0)),
    'render_resolution': expected_resolution, 'render_resolution_passed': not resolution_failures,
    'render_resolution_failures': resolution_failures[:10],
    'format_passed': format_passed, 'contiguous_frames_passed': contiguous,
    'full_decode_passed': decode.returncode == 0 and not decode.stderr.strip(),
    'temporal_scan_passed': not candidates, 'isolated_jump_candidates': candidates,
    'scene_capture_passed': not blank_scene_frames, 'blank_scene_frames': blank_scene_frames,
    'boundary_differences': boundaries,
    'largest_frame_difference': float(differences.max()) if len(differences) else 0,
    'note': '逐帧差分用于排查采集污染和孤立跳帧，不替代人工构图与可读性检查。',
}
(directory / 'validation.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
shots = metadata.get('shots', [])
sample_indices = []
for chapter in shots:
    duration = chapter['end'] - chapter['start']
    sample_indices.extend(round((chapter['start'] + duration * fraction) * fps) for fraction in (0.25, 0.55, 0.82))
if not sample_indices:
    sample_indices = [indices[0] + round((len(files) - 1) * fraction) for fraction in (0.1, 0.3, 0.5, 0.7, 0.9)]
columns = 6
rows = (len(sample_indices) + columns - 1) // columns
sheet = Image.new('RGB', (columns * 480, rows * 302), '#101b21')
draw = ImageDraw.Draw(sheet)
font = ImageFont.load_default(size=18)
for offset, frame in enumerate(sample_indices):
    source = directory / 'frames' / f'f{frame:06d}.jpg'
    with Image.open(source) as image:
        thumbnail = image.resize((480, 270), Image.Resampling.LANCZOS)
    horizontal, vertical = offset % columns * 480, offset // columns * 302
    sheet.paste(thumbnail, (horizontal, vertical))
    chapter = next((item['name'] for item in shots if item['start'] <= frame / fps < item['end']), '')
    draw.text((horizontal + 12, vertical + 274), f'{frame / fps:.2f}s  {chapter}', font=font, fill='#dce5e1')
sheet.save(directory / 'contact-sheet.png')
print(json.dumps(report, ensure_ascii=False, indent=2))
if not all(report[key] for key in ('format_passed', 'render_resolution_passed', 'contiguous_frames_passed', 'full_decode_passed', 'temporal_scan_passed', 'scene_capture_passed')):
    raise SystemExit('画面或编码验证失败，请检查 validation.json')
