import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image


parser = argparse.ArgumentParser()
parser.add_argument('directory', type=Path)
arguments = parser.parse_args()
directory = arguments.directory.resolve()
root = Path(__file__).resolve().parent.parent
metadata = json.loads((directory / 'film.json').read_text())
preflight = json.loads((directory / 'preflight-4k' / 'check.json').read_text())
files = []
for folder, snapshot in [('src', 'source'), ('render', 'render'), ('docs', 'docs'), ('assets', 'assets')]:
    for current in sorted((root / folder).rglob('*')):
        if not current.is_file() or '__pycache__' in current.parts:
            continue
        reference = directory / snapshot / current.relative_to(root / folder)
        digest = hashlib.sha256(current.read_bytes()).hexdigest()
        files.append({'path': str(current.relative_to(root)), 'sha256': digest, 'matched': reference.exists() and hashlib.sha256(reference.read_bytes()).hexdigest() == digest})
current = root / 'fusion.html'
files.append({'path': 'fusion.html', 'sha256': hashlib.sha256(current.read_bytes()).hexdigest(), 'matched': current.read_bytes() == (directory / 'fusion.html').read_bytes()})
comparisons = []
for time in preflight['samples']:
    frame = round(time * metadata['fps'])
    if abs(time * metadata['fps'] - frame) > 0.00001:
        continue
    name = str(time).removesuffix('.0').replace('.', '-') + '.jpg'
    with Image.open(directory / 'preflight-4k' / name) as before, Image.open(directory / 'frames' / f'f{frame:06d}.jpg') as after:
        difference = np.abs(np.asarray(before, dtype=np.int16) - np.asarray(after, dtype=np.int16))
    mean = float(difference.mean())
    maximum = int(difference.max())
    fraction = float(np.any(difference > 0, axis=2).mean())
    comparisons.append({'time': time, 'mean': mean, 'maximum': maximum, 'changed_fraction': fraction, 'passed': mean < 0.001 and maximum <= 16 and fraction < 0.001})
audit = {
    'source_frozen_during_final_render': all(entry['matched'] for entry in files),
    'source_snapshot_file_count': len(files), 'files': files,
    'full_native_4k_render': metadata['render']['scale'] == 2 and metadata['reused'] is None,
    'native_frames': metadata['frames'], 'output': [metadata['width'], metadata['height'], metadata['fps']],
    'preflight_native_comparison_passed': bool(comparisons) and all(entry['passed'] for entry in comparisons),
    'preflight_native_comparisons': comparisons,
}
(directory / 'render-audit.json').write_text(json.dumps(audit, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({key: value for key, value in audit.items() if key not in ('files', 'preflight_native_comparisons')}, ensure_ascii=False, indent=2))
if not audit['source_frozen_during_final_render'] or not audit['full_native_4k_render'] or not audit['preflight_native_comparison_passed']:
    raise SystemExit('冻结源或预检/原生帧对照未通过')
