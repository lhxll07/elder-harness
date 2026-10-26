import json
import subprocess

import numpy as np
import soundfile as sf
from scipy.ndimage import uniform_filter1d
from scipy.signal import correlate, correlation_lags

from sound_music_v03 import DURATION, chord_at, chord_tone, note_duration
from sound_synthesis import SAMPLE_RATE, add_event, ceramic, contact, envelope, gesture, room, stereo


def animation_cues(root):
    result = subprocess.run(['node', str(root / 'render/animation-sound-cues.mjs')], capture_output=True, text=True, check=True)
    return json.loads(result.stdout)


def render_effects(rng, contract, harmony, events):
    tracks = {name: np.zeros((DURATION * SAMPLE_RATE, 2), dtype=np.float32) for name in ['sfx-motion', 'sfx-contact']}
    records = []
    for cue in contract['cues']:
        target = cue['target_frame'] * (SAMPLE_RATE // 60)
        kind = cue['kind']
        duration = cue.get('duration', 0.75)
        pan = cue.get('pan', 0)
        note = None
        if kind in ['motion', 'focus', 'close']:
            signal = gesture(duration, rng, {'motion': 'open', 'focus': 'focus', 'close': 'close'}[kind])
            gain = cue.get('gain', 0.034)
            track = 'sfx-motion'
        elif kind in ['warm', 'dry']:
            name = chord_at(cue['time'], harmony)
            note = chord_tone(57 if '待医院确认' in cue['label'] else 62, name)
            duration = note_duration(note, cue['time'], 0.95 if kind == 'warm' else 0.45, harmony)
            signal = ceramic(note, duration, rng, kind == 'warm')
            touch = contact(rng)
            signal[:min(len(signal), len(touch))] += touch[:len(signal)] * 0.16
            gain = cue.get('gain', 0.060)
            track = 'sfx-contact'
        else:
            signal = contact(rng, 'paper' if kind == 'paper' else 'soft')
            gain = cue.get('gain', 0.080)
            track = 'sfx-contact'
        audio = stereo(signal, pan, 0.18 if track == 'sfx-motion' else 0)
        energy = uniform_filter1d(np.mean(audio.astype(np.float64) ** 2, axis=1), size=round(0.005 * SAMPLE_RATE))
        peak = int(np.argmax(energy))
        start_sample = target - peak
        if start_sample < 0:
            raise RuntimeError(f"Cue predates available audio: {cue['label']}")
        add_event(tracks[track], audio, start_sample / SAMPLE_RATE, gain)
        record = {**cue, 'track': track, 'render_start_sample': start_sample, 'render_start_seconds': start_sample / SAMPLE_RATE,
                  'audible_peak_offset_samples': peak, 'scheduled_peak_sample': start_sample + peak,
                  'target_sample': target, 'sync_error_samples': start_sample + peak - target,
                  'peak_definition': 'Maximum centered 5ms RMS energy of the individual effect', 'gain': gain}
        records.append(record)
        event = {'track': track, 'kind': kind, 'time': start_sample / SAMPLE_RATE, 'duration': len(signal) / SAMPLE_RATE,
                 'cue_time': cue['time'], 'cue_id': cue['id'], 'label': cue['label'], 'pitched': note is not None}
        if note is not None:
            event['note'] = note
        events.append(event)
    tracks['sfx-contact'] += room(tracks['sfx-contact'], rng, 0.65, 0.035)
    for track in tracks.values():
        envelope(track, [(0, 1), (194.5, 1), (195.65, 0), (196, 0)])
    if any(record['sync_error_samples'] for record in records):
        raise RuntimeError('An effect missed its exported animation cue frame')
    return tracks, {'passed': True, 'fps': 60, 'sample_rate': SAMPLE_RATE, 'samples_per_frame': 800,
                    'effects_checked': len(records), 'maximum_scheduling_error_samples': 0,
                    'sfx_snapped_to_music_grid': False, 'records': records,
                    'limitation': 'Cue phases are authored from frozen animation expressions; perceived sync still requires viewing'}


def check_encoded_sync(output, master_path, sync):
    result = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(output), '-map', '0:a:0', '-ar', str(SAMPLE_RATE),
                             '-ac', '2', '-f', 'f32le', '-'], capture_output=True, check=True)
    decoded = np.frombuffer(result.stdout, dtype=np.float32).reshape(-1, 2)
    master, rate = sf.read(master_path, dtype='float32', always_2d=True)
    checks = []
    targets = [10.7, 23.4667, 56.25, 58.8667, 81.0, 105.4167, 112.5, 121.15, 123.1833, 139.5833, 172.4, 189.0]
    for time in targets:
        start = round((time - 0.4) * SAMPLE_RATE)
        end = start + SAMPLE_RATE
        reference = master[start:end].mean(axis=1).astype(np.float64)
        encoded = decoded[start:end].mean(axis=1).astype(np.float64)
        correlations = correlate(encoded, reference, mode='full', method='fft')
        lags = correlation_lags(len(encoded), len(reference), mode='full')
        nearby = np.abs(lags) <= 1024
        lag = int(lags[nearby][np.argmax(correlations[nearby])])
        correlation = float(np.corrcoef(reference, encoded)[0, 1])
        if abs(lag) > 2 or correlation < 0.97:
            raise RuntimeError(f'AAC audio alignment failed at {time}s: {lag} samples, correlation {correlation}')
        checks.append({'time': time, 'lag_samples': lag, 'correlation': correlation})
    for record in sync['records']:
        center = record['target_sample']
        neighborhood = master[max(0, center - 800):center + 801]
        if np.sqrt(np.mean(neighborhood ** 2)) < 0.00003:
            raise RuntimeError(f"Unexpected silence at animation cue: {record['label']}")
    return {'passed': True, 'decoded_aac_alignment_checks': checks,
            'maximum_lag_samples': max(abs(check['lag_samples']) for check in checks),
            'cue_neighborhoods_non_silent': len(sync['records'])}
