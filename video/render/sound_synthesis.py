import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt


SAMPLE_RATE = 48000


def seconds(duration):
    return np.arange(round(duration * SAMPLE_RATE), dtype=np.float32) / SAMPLE_RATE


def frequency(note):
    return 440 * 2 ** ((note - 69) / 12)


def fade(signal, attack=0.008, release=0.06):
    result = signal.copy()
    attack_samples = min(len(result), max(1, round(attack * SAMPLE_RATE)))
    release_samples = min(len(result), max(1, round(release * SAMPLE_RATE)))
    result[:attack_samples] *= np.sin(np.linspace(0, np.pi / 2, attack_samples)) ** 2
    result[-release_samples:] *= np.sin(np.linspace(np.pi / 2, 0, release_samples)) ** 2
    return result


def filtered(signal, cutoff, mode='lowpass'):
    return sosfilt(butter(2, cutoff, btype=mode, fs=SAMPLE_RATE, output='sos'), signal).astype(np.float32)


def peak_normalize(signal, peak=0.9):
    return signal * (peak / max(float(np.max(np.abs(signal))), 1e-9))


def stereo(signal, pan=0, width=0.0):
    angle = (np.clip(pan, -1, 1) + 1) * np.pi / 4
    result = np.column_stack((signal * np.cos(angle), signal * np.sin(angle)))
    if width:
        delay = round(0.0097 * SAMPLE_RATE)
        delayed = np.zeros_like(signal)
        delayed[delay:] = signal[:-delay]
        energy = max(float(np.dot(signal, signal)), 1e-9)
        correlation = float(np.dot(delayed, signal)) / energy
        side = (delayed - signal * correlation) * width * 0.35
        result[:, 0] += side
        result[:, 1] -= side
    return result.astype(np.float32)


def key(note, duration, rng, felt=True):
    clock = seconds(duration)
    pitch = frequency(note)
    result = np.zeros_like(clock)
    brightness = 0.48 if felt else 0.85
    for harmonic in range(1, 9):
        stiffness = np.sqrt(1 + 0.000012 * harmonic ** 2)
        decay = np.exp(-clock * (0.75 + harmonic * 0.36) / (1.3 if felt else 0.95))
        amplitude = brightness ** (harmonic - 1) / harmonic
        detune = 0.06 + harmonic * 0.015
        partial = np.sin(2 * np.pi * pitch * harmonic * stiffness * clock)
        partial += 0.34 * np.sin(2 * np.pi * (pitch * harmonic * stiffness + detune) * clock)
        result += (amplitude * decay * partial).astype(np.float32)
    noise = filtered(rng.normal(size=len(clock)).astype(np.float32), [450, 2300], 'bandpass')
    result += noise * np.exp(-clock * 70) * 0.055
    return peak_normalize(fade(result, 0.006 if felt else 0.003, 0.22))


def pluck(note, duration, rng):
    clock = seconds(duration)
    pitch = frequency(note)
    result = np.zeros_like(clock)
    for harmonic, amplitude in [(1, 1.0), (2, 0.22), (3, 0.12), (4, 0.035), (6, 0.012)]:
        phase = rng.uniform(-0.08, 0.08)
        result += amplitude * np.sin(2 * np.pi * pitch * harmonic * clock + phase) * np.exp(-clock * (3.8 + harmonic * 1.1))
    return peak_normalize(fade(result, 0.004, 0.12))


def pad(note, duration, rng, openness=0.6):
    clock = seconds(duration)
    pitch = frequency(note)
    result = np.zeros_like(clock)
    for detune, weight in [(-1.4, 0.25), (0, 0.55), (1.7, 0.25)]:
        oscillator = np.zeros_like(clock)
        detuned = pitch * 2 ** (detune / 1200)
        phase = rng.uniform(0, 2 * np.pi)
        for harmonic in range(1, 6):
            amplitude = openness ** (harmonic - 1) / harmonic ** 1.7
            oscillator += amplitude * np.sin(2 * np.pi * detuned * harmonic * clock + phase)
        result += oscillator * weight
    result *= 0.91 + 0.055 * np.sin(2 * np.pi * 0.11 * clock + rng.uniform(0, 6))
    return peak_normalize(fade(result, min(0.65, duration * 0.22), min(0.60, duration * 0.25)))


def bass(note, duration):
    clock = seconds(duration)
    pitch = frequency(note)
    signal = np.sin(2 * np.pi * pitch * clock)
    signal += 0.23 * np.sin(2 * np.pi * pitch * 2 * clock)
    signal += 0.07 * np.sin(2 * np.pi * pitch * 3 * clock)
    signal *= np.exp(-clock * 1.5)
    return peak_normalize(fade(signal, 0.025, min(0.3, duration * 0.3)))


def percussion(kind, rng, duration=0.3):
    clock = seconds(duration)
    noise = rng.normal(size=len(clock)).astype(np.float32)
    if kind == 'kick':
        phase = 2 * np.pi * (48 * clock + 36 * (1 - np.exp(-clock * 32)) / 32)
        signal = np.sin(phase) * np.exp(-clock * 15)
        signal += filtered(noise, 900) * np.exp(-clock * 110) * 0.04
    elif kind == 'rim':
        signal = filtered(noise, [750, 4200], 'bandpass') * np.exp(-clock * 90)
        signal += 0.2 * np.sin(2 * np.pi * 430 * clock) * np.exp(-clock * 85)
        signal += 0.1 * np.sin(2 * np.pi * 870 * clock) * np.exp(-clock * 125)
    else:
        signal = filtered(noise, [3800, 10500], 'bandpass') * np.exp(-clock * 80)
    return peak_normalize(fade(signal, 0.0018, 0.035))


def gesture(duration, rng, direction='open'):
    clock = seconds(duration)
    progress = clock / max(duration, 0.001)
    noise = rng.normal(size=len(clock)).astype(np.float32)
    fine = filtered(noise, [1300, 5800], 'bandpass')
    body = filtered(noise, [170, 1600], 'bandpass')
    if direction == 'close':
        contour = np.sin(np.pi * progress) ** 1.6 * (0.3 + progress)
        balance = 1 - progress
    elif direction == 'focus':
        contour = np.sin(np.pi * progress) ** 2.2
        balance = np.sin(np.pi * progress)
    else:
        contour = np.sin(np.pi * progress) ** 1.8 * (1 - 0.45 * progress)
        balance = progress
    signal = (fine * (0.10 + 0.24 * balance) + body * (0.48 - 0.18 * balance)) * contour
    return peak_normalize(fade(signal, 0.05, 0.16))


def contact(rng, kind='soft'):
    duration = 0.18 if kind == 'paper' else 0.11
    clock = seconds(duration)
    noise = rng.normal(size=len(clock)).astype(np.float32)
    cutoff = [500, 3700] if kind == 'paper' else [350, 2400]
    signal = filtered(noise, cutoff, 'bandpass') * np.exp(-clock * (42 if kind == 'paper' else 80))
    signal += np.sin(2 * np.pi * (230 if kind == 'paper' else 310) * clock) * np.exp(-clock * 100) * 0.22
    return peak_normalize(fade(signal, 0.002, 0.03))


def ceramic(note, duration, rng, rounded=False):
    clock = seconds(duration)
    pitch = frequency(note)
    signal = np.zeros_like(clock)
    partials = [(1, 1.0), (2, 0.10), (3, 0.030), (4, 0.010)]
    for ratio, amplitude in partials:
        decay = 3.1 if rounded else 7.5
        signal += amplitude * np.sin(2 * np.pi * pitch * ratio * clock) * np.exp(-clock * decay * ratio ** 0.65)
    return peak_normalize(fade(signal, 0.014 if rounded else 0.003, 0.14))


def add_event(track, audio, start, gain=1, pan=0, width=0):
    start_sample = round(start * SAMPLE_RATE)
    audio = stereo(audio, pan, width) if audio.ndim == 1 else audio
    source_start = max(0, -start_sample)
    destination_start = max(0, start_sample)
    count = min(len(track) - destination_start, len(audio) - source_start)
    if count > 0:
        track[destination_start:destination_start + count] += audio[source_start:source_start + count] * gain


def envelope(track, points):
    samples = np.asarray([round(time * SAMPLE_RATE) for time, value in points])
    values = np.asarray([value for time, value in points], dtype=np.float32)
    positions = np.arange(len(track))
    track *= np.interp(positions, samples, values).astype(np.float32)[:, None]


def rms_gain(track, decibels):
    block_samples = SAMPLE_RATE // 5
    padding = (-len(track)) % block_samples
    power = np.mean(np.pad(track, ((0, padding), (0, 0))).reshape(-1, block_samples, 2) ** 2, axis=(1, 2))
    active = power[power > max(float(power.max()) * 0.008, 1e-10)]
    measured = np.sqrt(np.mean(active)) if len(active) else 1
    gain = 10 ** (decibels / 20) / max(float(measured), 1e-8)
    track *= gain
    return float(gain)


def room(track, rng, decay=2.2, wet=0.16):
    clock = seconds(decay)
    result = np.empty_like(track)
    for channel in range(2):
        impulse = filtered(rng.normal(size=len(clock)).astype(np.float32), [220, 5200], 'bandpass')
        impulse *= np.exp(-clock * 6.9 / (decay * 0.68))
        impulse[:round(0.032 * SAMPLE_RATE)] = 0
        impulse /= max(float(np.sqrt(np.sum(impulse ** 2))), 1e-8)
        impulse *= 0.6
        for delay, amplitude in [(0.043, 0.26), (0.071, 0.19), (0.113, 0.12), (0.173, 0.07)]:
            impulse[round((delay + channel * 0.0031) * SAMPLE_RATE)] += amplitude
        result[:, channel] = fftconvolve(track[:, channel], impulse, mode='full')[:len(track)] * wet
    return result
