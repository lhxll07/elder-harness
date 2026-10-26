import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import shutil

import numpy as np
import soundfile as sf

from piano_samples import ASSETS, prepare
from sound_music_v03 import DURATION, audit_harmony, compose
from sound_sync_v03 import animation_cues, check_encoded_sync, render_effects
from sound_synthesis import SAMPLE_RATE
from soundtrack import ROOT, SOURCE_SHA256, digest, execute, master, validate, write_json


SEED = 20261019


def main():
    parser = argparse.ArgumentParser(description='Original flowing piano score with frame-anchored animation sound effects')
    parser.add_argument('--output', default='out/review/fusion-v17-sound-v03')
    parser.add_argument('--remaster', action='store_true')
    arguments = parser.parse_args()
    destination = (ROOT / arguments.output).resolve()
    source = ROOT / 'out/review/fusion-v17/fusion-v17.mp4'
    if digest(source) != SOURCE_SHA256 or destination == source.parent:
        raise RuntimeError('Locked v17 picture does not match')
    if (destination / 'delivery.json').exists():
        raise RuntimeError('Completed sound versions cannot be overwritten')
    destination.mkdir(parents=True, exist_ok=True)
    stem_directory = destination / 'stems'
    stem_directory.mkdir(exist_ok=True)
    previous = {}
    for version in ['v01', 'v02']:
        folder = ROOT / f'out/review/fusion-v17-sound-{version}'
        delivery = json.loads((folder / 'delivery.json').read_text())
        path = ROOT / delivery['file']
        if digest(path) != delivery['sha256']:
            raise RuntimeError(f'Previous sound version changed: {version}')
        previous[version] = {'file': delivery['file'], 'sha256': delivery['sha256']}
    raw = destination / 'mix-premaster.wav'
    if not arguments.remaster:
        provenance = prepare()
        contract = animation_cues(ROOT)
        write_json(destination / 'animation-cues.json', contract)
        events = []
        tracks, harmony, score = compose(np.random.default_rng(SEED), events)
        print('Piano score complete; aligning effect energy peaks to animation cue frames', flush=True)
        effects, sync = render_effects(np.random.default_rng(SEED + 1), contract, harmony, events)
        tracks.update(effects)
        harmony_report = audit_harmony(events, harmony)
        write_json(destination / 'harmony-check.json', harmony_report)
        write_json(destination / 'cue-sync.json', sync)
        write_json(destination / 'cues.json', {'score_revision': 3, 'duration_seconds': DURATION,
                   'seed': SEED, 'score': score, 'harmony': harmony,
                   'events': sorted(events, key=lambda event: event['time']), 'narration': False})
        write_json(destination / 'instrument-provenance.json', provenance)
        music = np.zeros((DURATION * SAMPLE_RATE, 2), dtype=np.float32)
        effects_bus = np.zeros_like(music)
        for name, track in tracks.items():
            if not np.isfinite(track).all() or np.max(np.abs(track)) >= 0.99:
                raise RuntimeError(f'Invalid or clipped stem: {name}')
            sf.write(stem_directory / f'{name}.wav', track, SAMPLE_RATE, subtype='PCM_24')
            (music if name.startswith('music') else effects_bus)[:] += track
        for name, bus in [('music.wav', music), ('sfx.wav', effects_bus)]:
            if np.max(np.abs(bus)) >= 0.99:
                raise RuntimeError(f'Clipped premaster bus: {name}')
            sf.write(destination / name, bus, SAMPLE_RATE, subtype='PCM_24')
        sf.write(raw, music + effects_bus, SAMPLE_RATE, subtype='FLOAT')
        del tracks, effects, music, effects_bus
    print('Mastering and encoding the complete 3:16 film', flush=True)
    master_path = destination / 'master-48k-24bit.wav'
    write_json(destination / 'mastering.json', master(raw, master_path))
    credits = ('Original composition and sound design for 银龄智办. Piano instrument: Salamander Grand Piano V3 by Alexander Holm; '
               'retuning by Markus Fiedler; CC BY 3.0. Samples resampled, filtered and enveloped. '
               'https://github.com/sfzinstruments/SalamanderGrandPiano ; https://creativecommons.org/licenses/by/3.0/ . '
               'No Zeta or 3Blue1Brown recording, melody or transcription is included.')
    (destination / 'CREDITS.txt').write_text(credits + '\n')
    output = destination / f'{destination.name}.mp4'
    execute(['ffmpeg', '-y', '-hide_banner', '-nostats', '-i', source, '-i', master_path,
             '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k',
             '-ar', SAMPLE_RATE, '-ac', '2', '-t', DURATION, '-movflags', '+faststart',
             '-metadata', 'title=银龄智办 · 为人编译', '-metadata', f'comment={credits}', output])
    print('Checking full decode, unchanged picture, cue scheduling and decoded AAC alignment', flush=True)
    validation = validate(source, output, master_path)
    sync = json.loads((destination / 'cue-sync.json').read_text())
    encoded_sync = check_encoded_sync(output, master_path, sync)
    write_json(destination / 'encoded-sync-check.json', encoded_sync)
    validation.update({'cue_scheduling_passed': sync['passed'], 'animation_effect_cues': sync['effects_checked'],
                       'decoded_audio_alignment_passed': encoded_sync['passed'],
                       'maximum_decoded_audio_lag_samples': encoded_sync['maximum_lag_samples']})
    write_json(destination / 'validation.json', validation)
    for item in previous.values():
        if digest(ROOT / item['file']) != item['sha256']:
            raise RuntimeError('A previous sound delivery changed during rendering')
    snapshot = destination / 'audio-source'
    snapshot.mkdir(exist_ok=True)
    for name in ['soundtrack_v03.py', 'sound_music_v03.py', 'sound_sync_v03.py', 'piano_samples.py',
                 'animation-sound-cues.mjs', 'soundtrack.py', 'sound_synthesis.py', 'requirements-audio.txt']:
        shutil.copy2(ROOT / 'render' / name, snapshot / name)
    shutil.copy2(ROOT / 'docs/fusion-v17-sound-v03.md', snapshot / 'sound-treatment.md')
    shutil.copy2(ASSETS / 'LICENSE', destination / 'PIANO-LICENSE.txt')
    write_json(destination / 'delivery.json', {
        'status': 'complete', 'score_revision': 3, 'file': str(output.relative_to(ROOT)),
        'duration_seconds': DURATION, 'resolution': [1920, 1080], 'fps': 60,
        'sha256': digest(output), 'bytes': output.stat().st_size,
        'source_picture_sha256': SOURCE_SHA256, 'picture_bitstream_identical': True, 'picture_rerendered': False,
        'audio': {'codec': 'aac', 'sample_rate': SAMPLE_RATE, 'channels': 2, 'bitrate': 320000,
                  'original_composition': True, 'reference_audio_or_melody_used': False, 'narration': False,
                  'instrument': 'Salamander Grand Piano V3, Alexander Holm, CC BY 3.0',
                  'integrated_lufs': validation['integrated_lufs'], 'true_peak_dbtp': validation['true_peak_dbtp']},
        'animation_effect_cues': sync['effects_checked'], 'sfx_snapped_to_music': False,
        'cue_peak_scheduling_error_samples': sync['maximum_scheduling_error_samples'],
        'decoded_aac_maximum_lag_samples': encoded_sync['maximum_lag_samples'],
        'stems': sorted(str(path.relative_to(destination)) for path in stem_directory.glob('*.wav')),
        'previous_versions_verified': previous, 'review_page_opened': False, 'automatically_played': False,
        'validation': 'validation.json', 'credits': 'CREDITS.txt', 'instrument_license': 'PIANO-LICENSE.txt',
        'completed_at': datetime.now(timezone.utc).isoformat(),
    })
    print(json.dumps({'file': str(output), 'lufs': validation['integrated_lufs'],
                      'cue_points': sync['effects_checked'], 'picture_unchanged': True}, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
