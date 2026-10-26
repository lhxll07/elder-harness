import numpy as np
from scipy.ndimage import uniform_filter1d

from sound_music_v03 import CHORDS, chord_at, chord_tone
from sound_synthesis import SAMPLE_RATE, fade, filtered, frequency, peak_normalize, seconds, stereo


PROFILES = {
    'fan': {'duration': 0.25, 'gain': 0.070, 'material': 'paper', 'tone': 0},
    'open': {'duration': 0.66, 'gain': 0.055, 'material': 'silk', 'tone': 0},
    'fold': {'duration': 0.58, 'gain': 0.080, 'material': 'fold', 'tone': 0},
    'seat': {'duration': 0.30, 'gain': 0.120, 'material': 'wood', 'tone': 0.65},
    'brand': {'duration': 1.15, 'gain': 0.080, 'material': 'bloom', 'tone': 0.90},
    'voice': {'duration': 0.52, 'gain': 0.055, 'material': 'breath', 'tone': 0},
    'text': {'duration': 0.32, 'gain': 0.095, 'material': 'felt', 'tone': 0.55},
    'gather': {'duration': 0.47, 'gain': 0.062, 'material': 'silk', 'tone': 0},
    'tool': {'duration': 0.28, 'gain': 0.105, 'material': 'wood', 'tone': 0.35},
    'transfer': {'duration': 0.44, 'gain': 0.065, 'material': 'thread', 'tone': 0},
    'pause': {'duration': 0.34, 'gain': 0.042, 'material': 'felt', 'tone': 0},
    'structure': {'duration': 0.31, 'gain': 0.095, 'material': 'wood', 'tone': 0.45},
    'visual': {'duration': 0.59, 'gain': 0.082, 'material': 'glass', 'tone': 0.70},
    'align': {'duration': 0.27, 'gain': 0.110, 'material': 'wood', 'tone': 0.40},
    'extract': {'duration': 0.30, 'gain': 0.060, 'material': 'pluck', 'tone': 0.75},
    'retain': {'duration': 0.42, 'gain': 0.060, 'material': 'felt', 'tone': 0.60},
    'family': {'duration': 0.74, 'gain': 0.080, 'material': 'warm', 'tone': 0.85},
    'touch': {'duration': 0.20, 'gain': 0.115, 'material': 'felt', 'tone': 0.35},
    'load': {'duration': 0.53, 'gain': 0.080, 'material': 'paper', 'tone': 0},
    'read': {'duration': 0.29, 'gain': 0.092, 'material': 'pluck', 'tone': 0.65},
    'receipt': {'duration': 0.35, 'gain': 0.090, 'material': 'paper', 'tone': 0},
    'subtract': {'duration': 0.36, 'gain': 0.042, 'material': 'subtract', 'tone': 0},
    'local': {'duration': 0.37, 'gain': 0.110, 'material': 'wood', 'tone': 0.65},
    'cloud': {'duration': 0.68, 'gain': 0.085, 'material': 'glass', 'tone': 0.80},
    'pending': {'duration': 0.52, 'gain': 0.062, 'material': 'warm', 'tone': 0.80},
    'source': {'duration': 0.33, 'gain': 0.100, 'material': 'wood', 'tone': 0.50},
    'method': {'duration': 0.37, 'gain': 0.105, 'material': 'pluck', 'tone': 0.65},
    'report': {'duration': 0.29, 'gain': 0.095, 'material': 'paper', 'tone': 0},
    'archive': {'duration': 0.46, 'gain': 0.105, 'material': 'fold', 'tone': 0},
    'adopt': {'duration': 0.30, 'gain': 0.130, 'material': 'felt', 'tone': 0.50},
}


def profile_for(cue):
    number = int(cue['id'].split('-')[1])
    if 2 <= number <= 7:
        return 'fan', number - 2
    if 24 <= number <= 35:
        return ('extract' if number % 2 == 0 else 'seat'), (number - 24) // 2
    if 47 <= number <= 49:
        return 'read', number - 47
    if 59 <= number <= 61:
        return 'method', number - 59
    if 64 <= number <= 67:
        return 'report', number - 64
    if 72 <= number <= 74:
        return ['read', 'local', 'method'][number - 72], number - 72
    names = {
        1: 'open', 8: 'fold', 9: 'seat', 10: 'open', 11: 'brand', 12: 'voice', 13: 'text',
        14: 'gather', 15: 'tool', 16: 'transfer', 17: 'seat', 18: 'receipt', 19: 'pause',
        20: 'open', 21: 'structure', 22: 'visual', 23: 'align', 36: 'fold', 37: 'retain',
        38: 'open', 39: 'load', 40: 'family', 41: 'touch', 42: 'transfer', 43: 'touch',
        44: 'gather', 45: 'touch', 46: 'load', 50: 'touch', 51: 'receipt', 52: 'subtract',
        53: 'local', 54: 'cloud', 55: 'pending', 56: 'subtract', 57: 'source', 58: 'load',
        62: 'transfer', 63: 'align', 68: 'archive', 69: 'adopt', 70: 'load', 71: 'fold',
        75: 'fold', 76: 'brand',
    }
    return names[number], 0


def consonant_note(start_time, end_time, desired, harmony):
    allowed = set(range(12))
    for start, end, chord in harmony:
        if end > start_time and start < end_time:
            allowed &= {note % 12 for note in CHORDS[chord]['notes']}
    if not allowed:
        raise RuntimeError(f'No common dry effect pitch across {start_time:.6f}–{end_time:.6f}s')
    return min((note for note in range(desired - 7, desired + 8) if note % 12 in allowed),
               key=lambda note: (abs(note - desired), note))


def noise_texture(duration, rng, material, variant=0):
    clock = seconds(duration)
    progress = clock / duration
    noise = rng.normal(size=len(clock)).astype(np.float32)
    body = filtered(noise, [160, 1350], 'bandpass')
    fiber = filtered(noise, [1050, 5200], 'bandpass')
    grain = filtered(rng.normal(size=len(clock)).astype(np.float32), 38)
    grain /= max(float(np.std(grain)), 1e-8)
    if material in ['silk', 'breath', 'thread', 'subtract']:
        shape = np.sin(np.pi * progress) ** (1.8 if material == 'thread' else 2.4)
        balance = 1 - progress if material == 'subtract' else progress
        signal = (body * (0.72 - balance * 0.30) + fiber * (0.05 + balance * 0.15)) * shape
        signal *= 1 + grain * (0.035 if material == 'breath' else 0.075)
    elif material in ['paper', 'fold']:
        contour = np.zeros_like(clock)
        locations = [0.035, 0.20, 0.44, 0.70] if material == 'fold' else [0.025, 0.13, 0.34]
        for index, location in enumerate(locations):
            center = duration * (location + rng.uniform(-0.008, 0.008))
            width = duration * (0.035 + index * 0.018)
            contour += np.exp(-0.5 * ((clock - center) / width) ** 2) * (0.82 ** index)
        signal = (body * 0.52 + fiber * (0.28 + variant * 0.012)) * contour
        signal *= 1 + np.clip(grain, -2, 2) * 0.15
    else:
        decay = 35 if material == 'felt' else 45
        signal = (body * 0.92 + fiber * 0.065) * np.exp(-clock * decay)
        if material == 'wood':
            signal += fiber * np.exp(-((clock - 0.026) / 0.008) ** 2) * 0.09
    return peak_normalize(fade(filtered(signal, 5800), 0.006, min(0.06, duration * 0.22)), 0.75)


def resonance(note, duration, material):
    clock = seconds(duration)
    pitch = frequency(note)
    weights = {
        'wood': [1, 0.30, 0.17, 0.045], 'felt': [1, 0.13, 0.035],
        'glass': [1, 0.22, 0.05, 0.018], 'pluck': [1, 0.34, 0.12, 0.035],
        'warm': [1, 0.18, 0.06], 'bloom': [1, 0.20, 0.055, 0.012],
    }[material]
    decay = {'wood': 12, 'felt': 15, 'glass': 5.3, 'pluck': 10, 'warm': 4.4, 'bloom': 3.5}[material]
    signal = np.zeros_like(clock)
    for index, amplitude in enumerate(weights):
        harmonic = index + 1
        signal += amplitude * np.sin(2 * np.pi * pitch * harmonic * clock) * np.exp(-clock * decay * harmonic ** 0.65)
    attack = 0.028 if material in ['warm', 'bloom', 'glass'] else 0.006
    signal = fade(filtered(signal, 4900), attack, min(0.17, duration * 0.32))
    return peak_normalize(signal, 0.80)


def accent(cue, harmony, rng):
    name, variant = profile_for(cue)
    profile = PROFILES[name]
    duration = profile['duration'] * (1 + 0.025 * variant)
    material = profile['material']
    tone_mix = profile['tone']
    desired = {'brand': 62, 'local': 54, 'cloud': 69, 'pending': 57, 'family': 62,
               'extract': 66, 'read': 62, 'method': 62, 'adopt': 57}.get(name, 62)
    if name in ['read', 'method', 'seat', 'extract']:
        desired += [0, 4, 7, 12, 7, 4][variant % 6]
    note = chord_tone(desired, chord_at(cue['time'], harmony)) if tone_mix else None
    noise_material = material if material in ['silk', 'breath', 'thread', 'paper', 'fold', 'subtract', 'felt', 'wood'] else 'felt'
    signal = noise_texture(duration, rng, noise_material, variant) * (0.82 if not tone_mix else 0.30)
    if name == 'tool':
        offset = round(0.045 * SAMPLE_RATE)
        signal[offset:] += noise_texture(duration, rng, 'felt')[:-offset] * 0.13
    if name == 'pause':
        signal *= np.exp(-seconds(duration) * 14)
    pan = cue.get('pan', 0)
    if name == 'fan':
        pan = (variant - 2.5) * 0.085
    gain = profile['gain'] * rng.uniform(0.96, 1.03)
    if name == 'touch' and cue['id'] == 'cue-050':
        gain *= 1.18
    track = 'sfx-resonance' if name in ['brand', 'visual', 'family', 'cloud', 'pending', 'retain'] else (
        'sfx-paper' if name in ['fan', 'open', 'fold', 'voice', 'gather', 'transfer', 'load', 'receipt', 'subtract', 'report', 'archive'] else 'sfx-touch')
    for attempt in range(4):
        combined = signal + resonance(note, duration, material) * tone_mix if tone_mix else signal
        audio = stereo(peak_normalize(combined, 0.85), pan, 0.14 if track == 'sfx-paper' else 0.04)
        if note is None:
            break
        energy = uniform_filter1d(np.mean(audio.astype(np.float64) ** 2, axis=1), size=240)
        start = cue['time'] - int(np.argmax(energy)) / SAMPLE_RATE
        corrected = consonant_note(start, start + len(audio) / SAMPLE_RATE, desired, harmony)
        if corrected == note:
            break
        note = corrected
    else:
        raise RuntimeError(f"Effect pitch/peak alignment did not converge: {cue['id']}")
    return audio, {'profile': name, 'material': material, 'variant': variant, 'note': note,
                   'gain': gain, 'track': track, 'pan': pan, 'dry_duration': duration}


def movement(gesture, rng):
    count = (gesture['end_frame'] - gesture['start_frame']) * 800 + 1
    frames = np.array([entry['frame'] for entry in gesture['samples']])
    positions = np.arange(count) / 800 + gesture['start_frame']
    progress = np.interp(positions, frames, [entry['progress'] for entry in gesture['samples']])
    velocity = np.interp(positions, frames, [entry['velocity'] for entry in gesture['samples']])
    velocity /= max(float(np.max(velocity)), 1e-8)
    noise = rng.normal(size=count).astype(np.float32)
    bands = {
        'silk': ([150, 1250], [950, 3900]), 'breath': ([220, 980], [1200, 3400]),
        'thread': ([350, 1800], [1800, 4800]), 'paper': ([250, 1500], [1100, 4400]),
        'fold': ([130, 950], [850, 3600]), 'felt': ([110, 700], [650, 2100]),
    }
    low_band, high_band = bands[gesture['texture']]
    low = filtered(noise, low_band, 'bandpass')
    high = filtered(noise, high_band, 'bandpass')
    travel = progress if gesture['direction'] > 0 else 1 - progress
    signal = low * (0.75 - 0.28 * travel) + high * (0.08 + 0.20 * travel)
    if gesture['texture'] in ['paper', 'fold']:
        creases = (0.5 + 0.5 * np.sin(progress * np.pi * (10 if gesture['texture'] == 'fold' else 6))) ** 5
        signal *= 0.65 + 0.35 * creases
    shape = velocity ** 1.15 * np.sin(np.pi * progress) ** 0.32
    signal = peak_normalize(filtered(signal, 5600), 0.85) * shape
    signal = fade(signal, 0.014, 0.025)
    pan = gesture['pan'] + (progress - 0.5) * gesture['direction'] * 0.18
    angle = (np.clip(pan, -0.4, 0.4) + 1) * np.pi / 4
    audio = np.column_stack((signal * np.cos(angle), signal * np.sin(angle))).astype(np.float32)
    return audio, shape.astype(np.float32)
