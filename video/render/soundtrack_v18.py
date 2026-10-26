import argparse
from datetime import datetime, timezone
import json
import shutil
import subprocess

import numpy as np
import soundfile as sf
from scipy.signal import welch

from sound_music_v03 import DURATION, audit_harmony
from sound_sync_v03 import check_encoded_sync
from sound_sync_v04 import render_effects
from sound_synthesis import SAMPLE_RATE
from soundtrack import ROOT, digest, execute, master, validate, write_json
import soundtrack


SEED = 20261017


def character_check(effects, music, sync):
    spectral_frequency, spectral_power = welch(effects.mean(axis=1), SAMPLE_RATE, nperseg=4096)
    bright_fraction = float(spectral_power[spectral_frequency > 6000].sum() / max(spectral_power.sum(), 1e-12))
    contacts = []
    for cue in sync['records']:
        center = cue['target_sample']
        window = slice(center - 2880, center + 2880)
        effect_rms = float(np.sqrt(np.mean(effects[window] ** 2)))
        music_rms = float(np.sqrt(np.mean(music[window] ** 2)))
        contacts.append({'cue_id': cue['id'], 'profile': cue['profile'],
                         'sfx_to_music_db': float(20 * np.log10(max(effect_rms, 1e-9) / max(music_rms, 1e-9)))})
    if bright_fraction > 0.12 or not np.isfinite(effects).all() or np.max(np.abs(effects)) >= 0.99:
        raise RuntimeError('Effects brightness/headroom sanity check failed')
    return {'passed': True, 'sfx_high_frequency_power_fraction_above_6khz': bright_fraction,
            'sfx_peak_dbfs': float(20 * np.log10(np.max(np.abs(effects)))),
            'distinct_sound_profiles': len(sync['profiles_used']), 'cue_prominence': contacts,
            'limitation': 'Spectral/headroom measurements are not a subjective listening test; cue prominence includes overlapping effects'}


def animation_cues(root):
    result = subprocess.run(['node', str(root / 'render/animation-sound-motion-v18.mjs')], capture_output=True, text=True, check=True)
    return json.loads(result.stdout)


def main():
    parser = argparse.ArgumentParser(description='v18: soft, varied animation-responsive effects over the unchanged v03 piano score')
    parser.add_argument('--output', default='out/review/fusion-v18-sound')
    parser.add_argument('--remaster', action='store_true')
    arguments = parser.parse_args()
    source = ROOT / 'out/review/fusion-v18/fusion-v18.mp4'
    destination = (ROOT / arguments.output).resolve()
    picture_sha = digest(source)
    soundtrack.SOURCE_SHA256 = picture_sha
    previous = {}
    protected = [source.parent.resolve()]
    for version in ['v01', 'v02', 'v03', 'v04', 'v04b']:
        folder = ROOT / f'out/review/fusion-v17-sound-{version}'
        delivery = json.loads((folder / 'delivery.json').read_text())
        if digest(ROOT / delivery['file']) != delivery['sha256']:
            raise RuntimeError(f'Previous sound delivery changed: {version}')
        previous[version] = {'file': delivery['file'], 'sha256': delivery['sha256']}
        protected.append(folder.resolve())
    if any(destination == folder or folder in destination.parents for folder in protected):
        raise RuntimeError('Output must not touch any completed picture or sound delivery')
    if (destination / 'delivery.json').exists():
        raise RuntimeError('Completed sound versions cannot be overwritten')
    destination.mkdir(parents=True, exist_ok=True)
    stems = destination / 'stems'
    stems.mkdir(exist_ok=True)
    previous_score = ROOT / 'out/review/fusion-v17-sound-v03'
    music_source = previous_score / 'music.wav'
    music_hash = digest(music_source)
    raw = destination / 'mix-premaster.wav'
    if not arguments.remaster:
        contract = animation_cues(ROOT)
        write_json(destination / 'animation-cues.json', contract)
        old_score = json.loads((previous_score / 'cues.json').read_text())
        events = [event for event in old_score['events'] if event['track'].startswith('music')]
        music, rate = sf.read(music_source, dtype='float32', always_2d=True)
        if rate != SAMPLE_RATE or music.shape != (DURATION * SAMPLE_RATE, 2):
            raise RuntimeError('Reused piano score has changed format')
        print(f"Rendering {len(contract['cues'])} accents and {len(contract['gestures'])} animation-driven motion envelopes", flush=True)
        tracks, sync = render_effects(np.random.default_rng(SEED), contract, old_score['harmony'], events, music)
        write_json(destination / 'harmony-check.json', audit_harmony(events, old_score['harmony']))
        write_json(destination / 'cue-sync.json', sync)
        write_json(destination / 'cues.json', {'sound_revision': 5, 'music_revision': 3, 'duration_seconds': DURATION,
                   'seed': SEED, 'score': old_score['score'], 'harmony': old_score['harmony'],
                   'events': sorted(events, key=lambda event: event['time']), 'narration': False})
        effects = np.zeros((DURATION * SAMPLE_RATE, 2), dtype=np.float32)
        for name, track in tracks.items():
            if not np.isfinite(track).all() or np.max(np.abs(track)) >= 0.99:
                raise RuntimeError(f'Invalid or clipped effects stem: {name}')
            sf.write(stems / f'{name}.wav', track, SAMPLE_RATE, subtype='PCM_24')
            effects += track
        del tracks
        write_json(destination / 'sound-character-check.json', character_check(effects, music, sync))
        shutil.copy2(music_source, destination / 'music.wav')
        for path in sorted((previous_score / 'stems').glob('music-*.wav')):
            shutil.copy2(path, stems / path.name)
        sf.write(destination / 'sfx.wav', effects, SAMPLE_RATE, subtype='PCM_24')
        sf.write(raw, music + effects, SAMPLE_RATE, subtype='FLOAT')
        del music, effects
        for name in ['instrument-provenance.json', 'PIANO-LICENSE.txt']:
            shutil.copy2(previous_score / name, destination / name)
    if digest(destination / 'music.wav') != music_hash:
        raise RuntimeError('The piano score must be byte-identical to v03')
    print('Mastering and muxing the complete 3:16 film; picture stream copy only', flush=True)
    master_path = destination / 'master-48k-24bit.wav'
    write_json(destination / 'mastering.json', master(raw, master_path))
    credits = (previous_score / 'CREDITS.txt').read_text().strip() + (
        '\nRevision 5: v18 picture; original animation-responsive sound design. No Slay the Spire music or game sound recordings are used. '
        'Piano music premaster reused unchanged from sound revision 3. No narration.')
    (destination / 'CREDITS.txt').write_text(credits + '\n')
    output = destination / f'{destination.name}.mp4'
    execute(['ffmpeg', '-y', '-hide_banner', '-nostats', '-i', source, '-i', master_path,
             '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k',
             '-ar', SAMPLE_RATE, '-ac', '2', '-t', DURATION, '-movflags', '+faststart',
             '-metadata', 'title=银龄智办 · 为人编译', '-metadata', f'comment={credits}', output])
    print('Checking full decode, picture identity, sound timing, harmony, stereo balance and loudness', flush=True)
    sync = json.loads((destination / 'cue-sync.json').read_text())
    validation = validate(source, output, master_path)
    encoded_sync = check_encoded_sync(output, master_path, sync)
    write_json(destination / 'encoded-sync-check.json', encoded_sync)
    for item in previous.values():
        if digest(ROOT / item['file']) != item['sha256']:
            raise RuntimeError('A previous sound delivery changed')
    if digest(music_source) != music_hash:
        raise RuntimeError('The v03 piano source changed')
    validation.update({'cue_scheduling_passed': sync['passed'], 'animation_effect_cues': sync['effects_checked'],
                       'motion_gestures_checked': sync['motion_gestures_checked'],
                       'maximum_motion_boundary_error_samples': sync['maximum_motion_boundary_error_samples'],
                       'music_premaster_byte_identical_to_v03': True,
                       'decoded_audio_alignment_passed': encoded_sync['passed'],
                       'maximum_decoded_audio_lag_samples': encoded_sync['maximum_lag_samples']})
    write_json(destination / 'validation.json', validation)
    snapshot = destination / 'audio-source'
    snapshot.mkdir(exist_ok=True)
    for name in ['soundtrack_v04.py', 'sound_palette_v04.py', 'sound_sync_v04.py', 'animation-sound-motion.mjs',
                 'sound_music_v03.py', 'sound_sync_v03.py', 'animation-sound-cues.mjs', 'sound_synthesis.py',
                 'soundtrack.py', 'piano_samples.py', 'requirements-audio.txt']:
        shutil.copy2(ROOT / 'render' / name, snapshot / name)
    shutil.copy2(ROOT / 'docs/fusion-v18-sound.md', snapshot / 'sound-treatment.md')
    write_json(destination / 'delivery.json', {
        'status': 'complete', 'sound_revision': 5, 'mix_revision': 'a', 'music_revision': 3, 'file': str(output.relative_to(ROOT)),
        'duration_seconds': DURATION, 'resolution': [1920, 1080], 'fps': 60,
        'sha256': digest(output), 'bytes': output.stat().st_size, 'source_picture_sha256': picture_sha,
        'picture_bitstream_identical': True, 'picture_rerendered': False,
        'music_premaster_byte_identical_to_v03': True, 'music_premaster_sha256': music_hash,
        'audio': {'codec': 'aac', 'sample_rate': SAMPLE_RATE, 'channels': 2, 'bitrate': 320000,
                  'original_sound_design': True, 'reference_music_or_game_audio_used': False, 'narration': False,
                  'integrated_lufs': validation['integrated_lufs'], 'true_peak_dbtp': validation['true_peak_dbtp']},
        'animation_effect_cues': sync['effects_checked'], 'motion_gestures': sync['motion_gestures_checked'],
        'distinct_sound_profiles': len(sync['profiles_used']), 'sfx_snapped_to_music': False,
        'cue_peak_scheduling_error_samples': sync['maximum_scheduling_error_samples'],
        'decoded_aac_maximum_lag_samples': encoded_sync['maximum_lag_samples'],
        'stems': sorted(str(path.relative_to(destination)) for path in stems.glob('*.wav')),
        'previous_versions_verified': previous, 'review_page_opened': False, 'automatically_played': False,
        'validation': 'validation.json', 'credits': 'CREDITS.txt', 'instrument_license': 'PIANO-LICENSE.txt',
        'completed_at': datetime.now(timezone.utc).isoformat(),
    })
    print(json.dumps({'file': str(output), 'lufs': validation['integrated_lufs'],
                      'cue_points': sync['effects_checked'], 'motion_gestures': sync['motion_gestures_checked'],
                      'picture_unchanged': True, 'piano_unchanged': True}, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
