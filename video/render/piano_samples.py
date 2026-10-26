from concurrent.futures import ThreadPoolExecutor
from fractions import Fraction
import hashlib
import json
from pathlib import Path
import re
import urllib.parse
import urllib.request

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

from sound_synthesis import SAMPLE_RATE, filtered


REVISION = '3382bf9496bba2486f5ab0de55a264d1dfc38404'
BASE_URL = f'https://raw.githubusercontent.com/sfzinstruments/SalamanderGrandPiano/{REVISION}/'
ASSETS = Path(__file__).resolve().parents[1] / 'assets/audio/salamander'
ROOT_NOTES = range(33, 82, 3)
LAYERS = [6, 10]


def sample_name(note, layer):
    names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    return f'{names[note % 12]}{note // 12 - 1}v{layer}.flac'


def prepare():
    ASSETS.mkdir(parents=True, exist_ok=True)
    resources = ['LICENSE', 'Data/tune_ret.txt', 'Data/region.txt']
    resources += [f'Samples/{sample_name(note, layer)}' for note in ROOT_NOTES for layer in LAYERS]

    def fetch(resource):
        destination = ASSETS / resource
        destination.parent.mkdir(parents=True, exist_ok=True)
        if not destination.exists():
            request = urllib.request.Request(BASE_URL + urllib.parse.quote(resource), headers={'User-Agent': 'elder-harness-original-score'})
            with urllib.request.urlopen(request, timeout=90) as response:
                data = response.read()
            if resource.endswith('.flac') and not data.startswith(b'fLaC'):
                raise RuntimeError(f'Invalid piano sample: {resource}')
            temporary = destination.with_suffix(destination.suffix + '.part')
            temporary.write_bytes(data)
            temporary.replace(destination)
        return {'file': resource, 'sha256': hashlib.sha256(destination.read_bytes()).hexdigest(), 'bytes': destination.stat().st_size}

    with ThreadPoolExecutor(max_workers=4) as pool:
        records = list(pool.map(fetch, resources))
    manifest = {'instrument': 'Salamander Grand Piano V3', 'author': 'Alexander Holm',
                'license': 'CC BY 3.0', 'repository': 'https://github.com/sfzinstruments/SalamanderGrandPiano',
                'revision': REVISION, 'retuning_credit': 'Markus Fiedler', 'files': records}
    (ASSETS / 'provenance.json').write_text(json.dumps(manifest, indent=2) + '\n')
    return manifest


class Piano:
    def __init__(self):
        self.cache = {}
        table = (ASSETS / 'Data/tune_ret.txt').read_text()
        self.tuning = {int(index): float(cents) for index, cents in re.findall(r'\$TUNE(\d+)\s+([-\d.]+)', table)}

    def pitched(self, note, layer):
        identity = (note, layer)
        if identity not in self.cache:
            source = min(ROOT_NOTES, key=lambda root: abs(root - note))
            audio, rate = sf.read(ASSETS / 'Samples' / sample_name(source, layer), dtype='float32', always_2d=True)
            audio = audio[:round(rate * 8)]
            block = max(1, rate // 1000)
            energy = np.mean(audio[:len(audio) // block * block].reshape(-1, block, audio.shape[1]) ** 2, axis=(1, 2))
            onset = np.flatnonzero(energy > energy.max() * 0.0004)
            if len(onset):
                audio = audio[max(0, int(onset[0]) * block - block):]
            tune_index = (source - 21) // 3 + 1
            cents = self.tuning.get(tune_index, 0)
            ratio = rate / SAMPLE_RATE * 2 ** ((note - source + cents / 100) / 12)
            fraction = Fraction(1 / ratio).limit_denominator(1200)
            audio = resample_poly(audio, fraction.numerator, fraction.denominator, axis=0).astype(np.float32)
            for channel in range(audio.shape[1]):
                audio[:, channel] = filtered(filtered(audio[:, channel], 38, 'highpass'), 6100 if layer == 10 else 4800)
            mid = np.mean(audio, axis=1)
            side = (audio[:, 0] - audio[:, -1]) * 0.18
            audio = np.column_stack((mid + side, mid - side)).astype(np.float32)
            rms = np.sqrt(np.mean(audio[:min(len(audio), SAMPLE_RATE)] ** 2))
            audio *= min(0.16 / max(float(rms), 1e-8), 0.78 / max(float(np.max(np.abs(audio))), 1e-8))
            self.cache[identity] = audio
        return self.cache[identity]

    def note(self, note, duration, layer=6):
        source = self.pitched(note, layer)
        count = round(duration * SAMPLE_RATE)
        result = np.zeros((count, 2), dtype=np.float32)
        available = min(count, len(source))
        result[:available] = source[:available]
        attack = min(count, round(SAMPLE_RATE * 0.002))
        release = min(count, round(SAMPLE_RATE * min(0.40, duration * 0.25)))
        result[:attack] *= np.linspace(0, 1, attack, dtype=np.float32)[:, None]
        result[-release:] *= np.sin(np.linspace(np.pi / 2, 0, release, dtype=np.float32))[:, None] ** 2
        power = np.mean(result.astype(np.float64) ** 2, axis=0)
        reference = np.sqrt(np.mean(power))
        result *= (reference / np.sqrt(np.maximum(power, 1e-12)))[None, :]
        return result


if __name__ == '__main__':
    result = prepare()
    print(f"Prepared {len(result['files']) - 3} licensed piano samples ({sum(record['bytes'] for record in result['files']) / 1024**2:.1f} MiB)", flush=True)
