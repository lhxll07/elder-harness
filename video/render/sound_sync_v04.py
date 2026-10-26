import json
import subprocess

import numpy as np
from scipy.ndimage import uniform_filter1d

from sound_music_v03 import DURATION
from sound_palette_v04 import accent, movement
from sound_synthesis import SAMPLE_RATE, add_event, envelope, room


def animation_cues(root):
    result = subprocess.run(['node', str(root / 'render/animation-sound-motion.mjs')], capture_output=True, text=True, check=True)
    return json.loads(result.stdout)


def render_effects(rng, contract, harmony, events, music):
    tracks = {name: np.zeros((DURATION * SAMPLE_RATE, 2), dtype=np.float32) for name in
              ['sfx-paper', 'sfx-touch', 'sfx-resonance', 'sfx-flow']}
    records = []
    motion_records = []
    for cue in contract['cues']:
        audio, design = accent(cue, harmony, rng)
        target = cue['target_frame'] * 800
        energy = uniform_filter1d(np.mean(audio.astype(np.float64) ** 2, axis=1), size=240)
        peak = int(np.argmax(energy))
        start = target - peak
        if start < 0:
            raise RuntimeError(f"Sound predates film: {cue['id']}")
        window = slice(max(0, peak - 2880), min(len(audio), peak + 2880))
        dry_rms = float(np.sqrt(np.mean(audio[window] ** 2)))
        music_rms = float(np.sqrt(np.mean(music[target - 2880:target + 2880] ** 2)))
        relative_target = -9 if design['profile'] in ['fold', 'seat', 'tool', 'align', 'local', 'method', 'adopt'] else -12
        if design['profile'] in ['pause', 'subtract', 'voice', 'gather', 'fan']:
            relative_target = -15
        desired_rms = min(0.030, music_rms * 10 ** (relative_target / 20))
        base_gain = design['gain']
        design['gain'] = max(base_gain, min(base_gain * 3.0, desired_rms / max(dry_rms, 1e-9), 0.27))
        design['masking_compensation_db'] = float(20 * np.log10(design['gain'] / base_gain))
        add_event(tracks[design['track']], audio, start / SAMPLE_RATE, design['gain'])
        records.append({**cue, **design, 'render_start_sample': start, 'render_start_seconds': start / SAMPLE_RATE,
                        'audible_peak_offset_samples': peak, 'target_sample': target, 'scheduled_peak_sample': start + peak,
                        'sync_error_samples': start + peak - target,
                        'peak_definition': 'Maximum centered 5ms RMS of final stereo individual dry effect'})
        event = {'track': design['track'], 'kind': design['profile'], 'time': start / SAMPLE_RATE,
                 'duration': len(audio) / SAMPLE_RATE, 'cue_time': cue['time'], 'cue_id': cue['id'],
                 'label': cue['label'], 'pitched': design['note'] is not None}
        if event['pitched']:
            event['note'] = design['note']
        events.append(event)
    for gesture in contract['gestures']:
        audio, shape = movement(gesture, rng)
        start = gesture['start_frame'] * 800
        end = gesture['end_frame'] * 800
        if len(audio) != end - start + 1 or np.max(np.abs(audio[[0, -1]])) > 1e-7:
            raise RuntimeError(f"Motion boundary mismatch: {gesture['label']}")
        add_event(tracks['sfx-flow'], audio, start / SAMPLE_RATE, gesture['gain'])
        motion_records.append({key: value for key, value in gesture.items() if key != 'samples'} | {
            'start_sample': start, 'end_sample': end, 'boundary_scheduling_error_samples': 0,
            'duration_seconds': (end - start) / SAMPLE_RATE, 'control_frames': len(gesture['samples']),
            'amplitude_control': 'Interpolated frozen-animation speed × eased travel window',
            'control_peak_frame': gesture['start_frame'] + int(np.argmax(shape)) / 800})
        events.append({'track': 'sfx-flow', 'kind': gesture['texture'], 'time': start / SAMPLE_RATE,
                       'duration': len(audio) / SAMPLE_RATE, 'cue_id': gesture['cue_id'],
                       'label': gesture['label'], 'pitched': False})
    acoustic_bus = tracks['sfx-paper'] + tracks['sfx-touch'] + tracks['sfx-resonance']
    tracks['sfx-room'] = room(acoustic_bus, rng, 0.58, 0.045)
    for track in tracks.values():
        envelope(track, [(0, 1), (194.5, 1), (195.65, 0), (196, 0)])
    if any(record['sync_error_samples'] for record in records):
        raise RuntimeError('A sound effect missed its animation cue')
    return tracks, {'passed': True, 'fps': 60, 'sample_rate': SAMPLE_RATE, 'samples_per_frame': 800,
                    'effects_checked': len(records), 'maximum_scheduling_error_samples': 0,
                    'sfx_snapped_to_music_grid': False, 'records': records,
                    'motion_gestures_checked': len(motion_records), 'motion_records': motion_records,
                    'maximum_motion_boundary_error_samples': 0,
                    'profiles_used': sorted({record['profile'] for record in records}),
                    'limitation': 'Dry accent energy peaks and motion controls are measured; subjective softness and perceived sync need listening'}
