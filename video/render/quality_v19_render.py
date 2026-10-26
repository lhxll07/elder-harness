import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[1]


def digest(path):
    with path.open('rb') as source:
        return hashlib.file_digest(source, 'sha256').hexdigest()


def run(command):
    subprocess.run([str(value) for value in command], cwd=ROOT, check=True)


def packet_hash(path, stream):
    return subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(path), '-map', stream,
                                    '-c', 'copy', '-f', 'hash', '-hash', 'sha256', '-'], text=True).strip()


def main():
    parser = argparse.ArgumentParser(description='Blender asset-enhanced v19 full-film 4K render and existing audio remux')
    parser.add_argument('--output', default='out/review/fusion-v19-blender')
    parser.add_argument('--workers', type=int, default=2)
    parser.add_argument('--resume', action='store_true')
    arguments = parser.parse_args()
    destination = (ROOT / arguments.output).resolve()
    if arguments.workers not in [1, 2]:
        raise RuntimeError('Use one or two workers for 4K capture')
    if (destination / 'delivery.json').exists() or destination.exists() and not arguments.resume:
        raise RuntimeError('Use a fresh output folder, or explicitly resume an incomplete render')
    destination.mkdir(parents=True, exist_ok=True)
    run([sys.executable, ROOT / 'render/quality_v19_contract.py', '--output', destination / 'narrative-contract.json'])
    check = json.loads((ROOT / 'tmp/quality-v19-check-4k/check.json').read_text())
    if not check['passed'] or check['renderer']['render'] != [3840, 2160]:
        raise RuntimeError('Native 4K quality preflight must pass first')
    baseline = ROOT / 'out/review/fusion-v18'
    soundtrack = ROOT / 'out/review/fusion-v18-sound'
    metadata = json.loads((baseline / 'film.json').read_text())
    metadata.update({'version': 19, 'title': '银龄智办 · 为人编译 · Blender 质感升级',
                     'render': {'width': 3840, 'height': 2160, 'scale': 2, 'canvas2D': 'software',
                                'webGL': 'ANGLE/EGL', 'downsample': 'Lanczos 4K → 1080p',
                                'blender': 'Cycles OptiX 64-sample architectural plates, HDR studio, refined device geometry'},
                     'audio': 'Reuse v18 final AAC bitstream without re-encoding; narrative/animation clock unchanged'})
    (destination / 'film.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n')
    for source, name in [(ROOT / 'quality/v19/src', 'source'), (ROOT / 'quality/v19/assets', 'blender-assets'),
                         (ROOT / 'tmp/quality-v19-check-4k', 'preflight-4k')]:
        shutil.copytree(source, destination / name, dirs_exist_ok=True)
    scripts = destination / 'render'
    scripts.mkdir(exist_ok=True)
    for name in ['blender_studio_v19.py', 'blender_device_v19.py', 'quality_v19_contract.py', 'quality_v19_check.mjs',
                 'quality_v19_render.py', 'frames.mjs', 'capture.mjs', 'cdp.mjs', 'serve.mjs', 'validate.py']:
        shutil.copy2(ROOT / 'render' / name, scripts / name)
    shutil.copy2(ROOT / 'docs/fusion-v19-blender.md', destination / 'treatment.md')
    frames = destination / 'frames'
    if not frames.exists() or len(list(frames.glob('f*.jpg'))) != 11760:
        run(['node', 'render/frames.mjs', '--entry', 'quality/v19/index.html', '--software-canvas',
             '--duration', '196', '--fps', '60', '--workers', arguments.workers,
             '--render-scale', '2', '--quality', '96', '--out', frames])
    final = destination / f'{destination.name}.mp4'
    silent = destination / f'{destination.name}-silent.mp4'
    if not silent.exists():
        run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'warning', '-stats', '-framerate', '60',
             '-start_number', '0', '-i', frames / 'f%06d.jpg', '-frames:v', '11760', '-an',
             '-vf', 'scale=1920:1080:flags=lanczos:in_range=pc:out_range=tv,format=yuv420p',
             '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p',
             '-color_range', 'tv', '-g', '120', '-movflags', '+faststart', final])
        run(['python3', 'render/validate.py', destination])
        shutil.copy2(destination / 'validation.json', destination / 'picture-validation.json')
        final.rename(silent)
    sound_source = soundtrack / 'fusion-v18-sound.mp4'
    credits = (soundtrack / 'CREDITS.txt').read_text()
    run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'warning', '-i', silent, '-i', sound_source,
         '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'copy', '-t', '196', '-movflags', '+faststart',
         '-metadata', 'title=银龄智办 · 为人编译 · Blender 质感版', '-metadata', f'comment={credits}', final])
    run(['ffmpeg', '-v', 'error', '-xerror', '-i', final, '-f', 'null', '-'])
    probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(final)]))
    video_stream = next(stream for stream in probe['streams'] if stream['codec_type'] == 'video')
    audio_stream = next(stream for stream in probe['streams'] if stream['codec_type'] == 'audio')
    if (video_stream['width'], video_stream['height'], video_stream['avg_frame_rate'], int(video_stream['nb_frames'])) != (1920, 1080, '60/1', 11760):
        raise RuntimeError('Final picture format mismatch')
    if len(probe['streams']) != 2 or abs(float(audio_stream['start_time'])) > 0.001 or abs(float(probe['format']['duration']) - 196) > 0.025:
        raise RuntimeError('Final A/V layout or duration mismatch')
    if packet_hash(final, '0:v:0') != packet_hash(silent, '0:v:0') or packet_hash(final, '0:a:0') != packet_hash(sound_source, '0:a:0'):
        raise RuntimeError('Picture or approved AAC stream changed during final mux')
    for name in ['CREDITS.txt', 'PIANO-LICENSE.txt', 'animation-cues.json', 'cue-sync.json', 'encoded-sync-check.json']:
        shutil.copy2(soundtrack / name, destination / name)
    baseline_delivery = json.loads((baseline / 'delivery.json').read_text())
    sound_delivery = json.loads((soundtrack / 'delivery.json').read_text())
    if digest(baseline / 'fusion-v18.mp4') != baseline_delivery['sha256'] or digest(sound_source) != sound_delivery['sha256']:
        raise RuntimeError('A protected baseline delivery changed')
    validation = {'passed': True, 'full_av_decode_passed': True, 'duration_seconds': 196, 'render_resolution': [3840, 2160],
                  'resolution': [1920, 1080], 'fps': 60, 'frames': 11760, 'picture_validation': 'picture-validation.json',
                  'approved_aac_bitstream_identical': True, 'audio_reencoded': False, 'animation_timing_unchanged': True,
                  'source_contract': 'narrative-contract.json', 'audio_start_seconds': float(audio_stream['start_time']),
                  'review_page_opened': False, 'automatically_played': False}
    (destination / 'validation.json').write_text(json.dumps(validation, ensure_ascii=False, indent=2) + '\n')
    delivery = {'status': 'complete', 'version': 19, 'file': str(final.relative_to(ROOT)), 'duration_seconds': 196,
                'resolution': [1920, 1080], 'render_resolution': [3840, 2160], 'fps': 60, 'frames': 11760,
                'sha256': digest(final), 'bytes': final.stat().st_size, 'validation': 'validation.json',
                'blender_assets': 'blender-assets', 'source': 'source', 'sound_source': sound_delivery['file'],
                'sound_source_sha256': sound_delivery['sha256'], 'approved_aac_bitstream_identical': True,
                'narration': False, 'review_page_opened': False, 'automatically_played': False,
                'completed_at': datetime.now(timezone.utc).isoformat()}
    (destination / 'delivery.json').write_text(json.dumps(delivery, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(delivery, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
