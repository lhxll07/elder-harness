import numpy as np

from piano_samples import Piano
from sound_synthesis import SAMPLE_RATE, add_event, envelope, pad, rms_gain, room


DURATION = 196
BEAT = 0.625
BAR = BEAT * 4
CHORDS = {
    'D': {'bass': 38, 'notes': [54, 57, 62]},
    'D/F#': {'bass': 42, 'notes': [54, 57, 62]},
    'A/C#': {'bass': 37, 'notes': [52, 57, 61]},
    'A': {'bass': 33, 'notes': [52, 57, 61]},
    'Bm': {'bass': 35, 'notes': [54, 59, 62]},
    'G': {'bass': 43, 'notes': [55, 59, 62]},
    'Em': {'bass': 40, 'notes': [55, 59, 64]},
}
PROGRESSIONS = [
    ['D', 'D/F#', 'G', 'A'],
    ['Bm', 'G', 'D', 'A/C#'],
    ['D', 'A/C#', 'Bm', 'G'],
    ['G', 'D/F#', 'Em', 'A'],
    ['D', 'G', 'Bm', 'A'],
    ['G', 'D/F#', 'Em', 'A'],
    ['Bm', 'G', 'D', 'A'],
    ['Bm', 'G', 'D', 'A'],
    ['G', 'D/F#', 'Em', 'A'],
]
QUIET = [(34.7, 38.0, 0.50), (67.2, 74.8, 0.30), (109.0, 114.0, 0.25), (127.4, 130.8, 0.62)]


def harmony_timeline():
    result = [(0.0, 6.0, 'D')]
    for phrase, progression in enumerate(PROGRESSIONS):
        result.extend((6 + phrase * 20 + index * 5, 11 + phrase * 20 + index * 5, chord) for index, chord in enumerate(progression))
    return result + [(186.0, 188.5, 'G'), (188.5, 191.0, 'A'), (191.0, 196.0, 'D')]


def chord_at(time, harmony):
    return next(name for start, end, name in harmony if start <= time < end)


def chord_tone(note, name):
    pitches = {voice % 12 for voice in CHORDS[name]['notes']}
    return min((candidate for candidate in range(note - 6, note + 7) if candidate % 12 in pitches), key=lambda candidate: (abs(candidate - note), candidate))


def note_duration(note, start, duration, harmony):
    end = min(start + duration, 195.6)
    for boundary, next_end, name in harmony:
        if start < boundary < end and note % 12 not in {voice % 12 for voice in CHORDS[name]['notes']}:
            end = boundary - 0.02
            break
    return max(1 / SAMPLE_RATE, end - start)


def audit_harmony(events, harmony):
    pitched = [event for event in events if event['kind'] == 'note' or event.get('pitched')]
    failures = []
    for event in pitched:
        for start, end, name in harmony:
            overlap = min(event['time'] + event['duration'], end) - max(event['time'], start)
            if overlap > 0.001 and event['note'] % 12 not in {voice % 12 for voice in CHORDS[name]['notes']}:
                failures.append({'event': event, 'chord': name})
    if failures or not pitched:
        raise RuntimeError(f'Conflicting dry harmony: {failures[:4]}')
    boundaries = [start for start, end, name in harmony if 6 <= start < 191]
    if any(abs((start - 6) / BAR - round((start - 6) / BAR)) > 1e-8 for start in boundaries):
        raise RuntimeError('Harmony has drifted off the bar grid')
    return {'passed': True, 'key': 'D major', 'bpm': 96, 'meter': '4/4',
            'music_grid_origin_seconds': 6, 'phrase_bars': 8, 'pitched_events_checked': len(pitched),
            'dry_pitch_conflicts': 0, 'bar_grid_passed': True, 'schedule': harmony,
            'limitation': 'Scheduled fundamental pitches only; not a substitute for listening or a reverb audit'}


def compose(rng, events):
    piano = Piano()
    harmony = harmony_timeline()
    tracks = {name: np.zeros((DURATION * SAMPLE_RATE, 2), dtype=np.float32) for name in
              ['music-ostinato', 'music-melody', 'music-bass', 'music-pad']}

    def play(track, desired, start, duration, velocity, layer=6, pan=0):
        name = chord_at(start, harmony)
        note = chord_tone(desired, name)
        duration = note_duration(note, start, duration, harmony)
        if duration < 0.14:
            return
        signal = piano.note(note, duration, layer)
        angle = (pan + 1) * np.pi / 4
        signal[:, 0] *= np.cos(angle) * np.sqrt(2)
        signal[:, 1] *= np.sin(angle) * np.sqrt(2)
        add_event(tracks[track], signal, start, velocity)
        events.append({'track': track, 'kind': 'note', 'time': round(start, 6),
                       'note': note, 'duration': round(duration, 6), 'chord': name, 'velocity': round(velocity, 4)})

    for time, note, duration, velocity in [(0.65, 62, 4.5, 0.35), (2.0, 69, 3.5, 0.28), (3.5, 66, 3.2, 0.30), (5.0, 74, 2.7, 0.34)]:
        play('music-melody', note, time, duration, velocity)
    for start, end, name in harmony:
        for voice, note in enumerate(CHORDS[name]['notes']):
            duration = note_duration(note, start, min(end - start + 0.12, 195.5 - start), harmony)
            add_event(tracks['music-pad'], pad(note, duration, rng, 0.26), start, 0.18, (voice - 1) * 0.24, 0.16)
            events.append({'track': 'music-pad', 'kind': 'note', 'time': start, 'note': note, 'duration': duration, 'chord': name})
    for bar in range(74):
        start = 6 + bar * BAR
        name = chord_at(start, harmony)
        phrase = min(8, bar // 8)
        chord = CHORDS[name]
        play('music-bass', chord['bass'], start + rng.uniform(0.003, 0.012), 2.1, 0.31 if bar % 2 == 0 else 0.20)
        if bar % 2 == 0:
            play('music-bass', chord['bass'] + 12, start + BEAT * 2.5 + 0.008, 1.0, 0.12)
        pattern = [0, 2, 1, 2, 0, 2, 1, 2] if phrase % 3 != 2 else [0, 1, 2, 1, 0, 2, 1, 2]
        for index, voice in enumerate(pattern):
            onset = max(start, start + index * BEAT / 2 + rng.uniform(-0.005, 0.005))
            if (start < 16 and index % 2) or (67.2 < onset < 74.8 and index not in [0, 4]) or (109 < onset < 114 and index not in [0, 4]):
                continue
            dynamic = [0.29, 0.15, 0.21, 0.16, 0.25, 0.15, 0.21, 0.17][index]
            dynamic *= rng.uniform(0.93, 1.06) * (1.08 if phrase in [2, 7] else 1)
            play('music-ostinato', chord['notes'][voice] + 12, onset, 1.45, dynamic, pan=(voice - 1) * 0.075)
    theme = [
        (0, 69, 1.6), (1.5, 74, 1.0), (3, 78, 2.5), (6, 74, 1.5),
        (8, 78, 1.7), (10, 74, 1.5), (12, 69, 2.7),
        (16, 71, 1.4), (18, 74, 1.5), (20, 78, 2.2), (23, 74, 0.7),
        (24, 76, 1.8), (27, 73, 1.0), (28.5, 69, 2.9),
    ]
    for phrase in range(9):
        start = 6 + phrase * 20
        for index, (beat, desired, length) in enumerate(theme):
            onset = start + beat * BEAT + rng.uniform(0, 0.009)
            if 109 <= onset < 114 or (67.2 <= onset < 74.8 and index not in [0, 6]):
                continue
            if phrase in [1, 4, 7] and index in [3, 9]:
                desired -= 3
            velocity = (0.43 if phrase in [0, 3, 8] else 0.38) * (0.86 if index in [1, 5, 9, 11] else 1)
            play('music-melody', desired, onset, length * BEAT + 0.38, velocity, layer=10 if index in [0, 2, 7] else 6, pan=0.035 * np.sin(index))
        events.append({'track': 'music', 'kind': 'phrase', 'time': start, 'duration': 20, 'phrase': phrase + 1})
        print(f'Original piano phrase {phrase + 1}/9: {start:.1f}–{start + 20:.1f}s', flush=True)
    for time, note, duration, velocity in [(186.0, 71, 2.2, 0.34), (187.25, 74, 1.5, 0.30), (188.5, 76, 1.6, 0.34),
                                           (189.75, 73, 1.3, 0.30), (191.0, 74, 3.7, 0.41), (192.5, 62, 3.0, 0.26)]:
        play('music-melody', note, time, duration, velocity)
    for note in [38, 57, 66]:
        play('music-bass' if note == 38 else 'music-ostinato', note, 191.0, 4.4, 0.24)
    calibration = {}
    targets = {'music-ostinato': -30.5, 'music-melody': -27.0, 'music-bass': -33.0, 'music-pad': -38.0}
    for name, track in tracks.items():
        calibration[name] = rms_gain(track, targets[name])
        for start, end, depth in QUIET:
            depth = np.sqrt(depth) if name == 'music-melody' else depth
            envelope(track, [(0, 1), (start - 0.5, 1), (start + 0.4, depth), (end - 0.3, depth), (end + 0.6, 1), (196, 1)])
        envelope(track, [(0, 0), (0.6, 0.6), (2.0, 1), (190.8, 1), (193.2, 0.82), (195.65, 0), (196, 0)])
    room_input = tracks['music-ostinato'] + tracks['music-melody'] + tracks['music-bass'] * 0.28
    tracks['music-room'] = room(room_input, rng, 1.8, 0.14)
    envelope(tracks['music-room'], [(0, 1), (194.1, 1), (195.65, 0), (196, 0)])
    return tracks, harmony, {'bpm': 96, 'meter': '4/4', 'bar_seconds': BAR, 'phrase_seconds': 20,
                             'grid_origin_seconds': 6, 'key': 'D major', 'layer_calibration_gains': calibration,
                             'theme_midi': [69, 74, 78], 'composition': 'Original; no reference melody, audio or transcription used'}
