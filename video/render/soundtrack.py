import argparse
from datetime import datetime, timezone
import hashlib
import importlib.metadata
import json
from pathlib import Path
import re
import shutil
import subprocess

import numpy as np
import soundfile as sf

from sound_synthesis import SAMPLE_RATE, add_event, bass, ceramic, contact, envelope, gesture, key, pad, percussion, pluck, rms_gain, room


ROOT = Path(__file__).resolve().parents[1]
DURATION = 196
SOURCE_SHA256 = 'f71a67172867b312e9113b51fa54da6ed434300f0e8cc369297e7199cb0ff016'
SEED = 20261017
BEAT = 60 / 96
CHORDS = {
    'D': {'bass': 38, 'notes': [54, 57, 62]},
    'A/C#': {'bass': 37, 'notes': [52, 57, 61]},
    'Bm': {'bass': 35, 'notes': [54, 59, 62]},
    'G': {'bass': 31, 'notes': [55, 59, 62]},
    'A': {'bass': 33, 'notes': [52, 57, 61]},
}
ACTS = [
    (0, 16, '需求 / 深度与收拢', ['D', 'G', 'D'], 0.42),
    (16, 40, '架构 / 系统协作', ['D', 'A/C#', 'Bm', 'G', 'D'], 0.62),
    (40, 57, '观察 / 双通道', ['D', 'A/C#', 'Bm', 'G'], 0.57),
    (57, 75, '编译 / 操作消去与人的决定', ['G', 'D', 'Bm', 'A'], 0.66),
    (75, 85, '家人 / 带上下文的回应', ['G', 'D'], 0.45),
    (85, 109, '执行 / 观察、定位、阅读', ['D', 'A/C#', 'Bm', 'G', 'D'], 0.60),
    (109, 114, '本人 / 核对与提交', ['D'], 0.38),
    (114, 136, '核验 / 来源与事实', ['Bm', 'G', 'D', 'A'], 0.49),
    (136, 149, '方法 / 提炼与迁移', ['G', 'D', 'A/C#'], 0.65),
    (149, 170, '验证 / 独立运行与重算', ['Bm', 'G', 'D', 'A'], 0.72),
    (170, 179, '采用 / 人的选择与按需装入', ['G', 'D'], 0.56),
    (179, 196, '为人编译 / 总结与回收', ['G', 'D', 'A', 'D'], 0.68),
]
QUIET = [(34.7, 38.0, 0.30), (67.2, 75.0, 0.13), (109.0, 114.1, 0.12), (127.5, 130.8, 0.50)]


def execute(arguments):
    result = subprocess.run([str(argument) for argument in arguments], capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(f"Command failed: {' '.join(map(str, arguments))}\n{result.stderr[-6000:]}")
    return result.stdout, result.stderr


def digest(path):
    result = hashlib.sha256()
    with path.open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            result.update(chunk)
    return result.hexdigest()


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def timeline():
    script = "import {EDITS,editTime} from './src/fusion-edit.js'; import {compilerTime} from './src/fusion-script.js'; const samples=Array.from({length:11761},(_,index)=>({time:index/60,compiler:compilerTime(editTime(index/60))})); console.log(JSON.stringify({edits:EDITS,samples}));"
    result = subprocess.run(['node', '--input-type=module', '-e', script], cwd=ROOT, capture_output=True, text=True, check=True)
    return json.loads(result.stdout)


def compiler_clock(data, target, minimum, maximum):
    candidates = [sample for sample in data['samples'] if minimum <= sample['time'] <= maximum]
    return min(candidates, key=lambda sample: abs(sample['compiler'] - target))['time']


def chord_at(time, harmony):
    return next((chord for start, end, chord in harmony if start <= time < end), harmony[-1][2])


def harmony_timeline():
    result = []
    for start, end, title, progression, intensity in ACTS:
        spacing = (end - start) / len(progression)
        result.extend((start + index * spacing, start + (index + 1) * spacing, name) for index, name in enumerate(progression))
    return result


def chord_tone(note, chord):
    allowed = {voice % 12 for voice in CHORDS[chord]['notes']}
    candidates = [candidate for candidate in range(note - 6, note + 7) if candidate % 12 in allowed]
    return min(candidates, key=lambda candidate: (abs(candidate - note), candidate))


def compatible_duration(note, onset, duration, harmony):
    end = min(onset + duration, 195.65)
    for boundary, next_end, name in harmony:
        if onset < boundary < end and note % 12 not in {voice % 12 for voice in CHORDS[name]['notes']}:
            end = boundary - 0.025
            break
    return max(1 / SAMPLE_RATE, end - onset)


def check_harmony(events, harmony):
    pitched = [event for event in events if event['kind'] in ['note', 'dry', 'rounded']]
    conflicts = []
    for event in pitched:
        for start, end, name in harmony:
            overlap = min(event['time'] + event['duration'], end) - max(event['time'], start)
            if overlap > 0.001 and event['note'] % 12 not in {voice % 12 for voice in CHORDS[name]['notes']}:
                conflicts.append({'event': event, 'overlapping_chord': name, 'overlap_seconds': overlap})
    if not pitched or conflicts:
        raise RuntimeError(f'Harmony schedule has conflicting notes: {conflicts[:5]}')
    return {'passed': True, 'key': 'D major', 'pitched_events_checked': len(pitched),
            'out_of_chord_dry_notes': 0, 'incompatible_dry_sustains': 0,
            'includes_pitched_sfx': True, 'reverb_not_included_in_dry_note_audit': True,
            'chords': CHORDS, 'schedule': harmony}


def quiet_gain(time):
    for start, end, gain in QUIET:
        if start <= time <= end:
            return gain
    return 1.0


def arrangement(time):
    return next((intensity for start, end, name, chords, intensity in ACTS if start <= time < end), 0.4)


def music_score(rng, events):
    names = ['music-pad', 'music-keys', 'music-pulse', 'music-bass', 'music-percussion']
    tracks = {name: np.zeros((DURATION * SAMPLE_RATE, 2), dtype=np.float32) for name in names}
    harmony = harmony_timeline()

    def music_note(track, note, onset, duration, gain, pan=0, width=0):
        name = chord_at(onset, harmony)
        note = chord_tone(note, name)
        duration = compatible_duration(note, onset, duration, harmony)
        if duration < 0.12:
            return None
        if track == 'music-pad':
            signal = pad(note, duration, rng, 0.38)
        elif track == 'music-bass':
            signal = bass(note, duration)
        elif track == 'music-pulse':
            signal = pluck(note, duration, rng)
        else:
            signal = key(note, duration, rng)
        add_event(tracks[track], signal, onset, gain, pan, width)
        events.append({'track': track, 'time': round(onset, 6), 'duration': round(duration, 6),
                       'kind': 'note', 'note': note, 'chord': name})
        return note

    for start, end, title, progression, intensity in ACTS:
        spacing = (end - start) / len(progression)
        for index, name in enumerate(progression):
            onset = start + index * spacing
            chord = CHORDS[name]
            pad_duration = min(spacing + 0.12, 195.5 - onset)
            for voice, note in enumerate(chord['notes']):
                pan = (voice - 1) * 0.23
                music_note('music-pad', note, onset, pad_duration, 0.36, pan, 0.22)
            if onset < 190:
                for voice, note in enumerate(chord['notes'][1:]):
                    music_note('music-keys', note + 12, onset + 0.16 + voice * 0.055, 3.1,
                               intensity * (0.30 if start in [75, 179] else 0.18), (voice - 0.5) * 0.14, 0.12)
            events.append({'track': 'music', 'time': round(onset, 4), 'kind': 'harmony', 'chord': name, 'act': title})
        print(f'Composed {start:5.1f}–{end:5.1f}s: {title}', flush=True)

    for index in range(276):
        onset = 16 + index * BEAT
        if onset >= 188:
            break
        strength = arrangement(onset) * quiet_gain(onset)
        chord = CHORDS[chord_at(onset, harmony)]
        if index % 4 == 0 and strength > 0.15:
            music_note('music-bass', chord['bass'], onset + 0.018, 1.25, strength * 0.70)
        active_pulse = onset < 67 or 85 <= onset < 109 or 136 <= onset < 188
        if active_pulse and strength > 0.2 and index % 2 == 0:
            pattern = [0, 1, 2, 1]
            note = chord['notes'][pattern[(index // 2) % len(pattern)]] + 12
            velocity = strength * (0.37 if index % 4 == 0 else 0.24)
            music_note('music-pulse', note, onset, 1.0, velocity, 0.17 * np.sin(index * 0.8), 0.15)
        active_drums = 21 <= onset < 67 or 85 <= onset < 109 or 136 <= onset < 188
        if active_drums and strength > 0.2:
            if index % 4 == 0 or (149 <= onset < 170 and index % 8 == 6):
                add_event(tracks['music-percussion'], percussion('kick', rng), onset, strength * 0.85)
            if index % 4 == 2:
                add_event(tracks['music-percussion'], percussion('rim', rng), onset + 0.013, strength * 0.31, 0.10)
            if index % 2 == 1:
                add_event(tracks['music-percussion'], percussion('shaker', rng, 0.12), onset + 0.012, strength * 0.10, -0.28)
    phrases = [
        (1.15, [66, 69], [0, 1.65], 0.34),
        (14.05, [66, 69, 74], [0, 0.44, 1.03], 0.46),
        (26.0, [66, 71, 74, 71], [0, 0.625, 1.875, 3.125], 0.32),
        (44.75, [66, 69, 74], [0, 0.625, 1.875], 0.34),
        (63.0, [66, 69, 74], [0, 0.625, 1.875], 0.38),
        (68.7, [71, 66], [0, 2.5], 0.20),
        (75.5, [67, 71, 74, 74, 69], [0, 0.9375, 2.5, 5, 6.25], 0.44),
        (91.0, [66, 69, 74], [0, 0.625, 1.875], 0.28),
        (104.5, [66, 69, 74], [0, 0.625, 1.875], 0.28),
        (123.9, [67, 66], [0, 1.25], 0.22),
        (137.7, [67, 71, 74], [0, 0.625, 1.875], 0.43),
        (149.75, [66, 71, 74, 71], [0, 0.625, 1.875, 3.125], 0.34),
        (164.75, [64, 69, 73], [0, 0.625, 1.875], 0.30),
        (175.5, [66, 69, 74], [0, 0.625, 1.875], 0.36),
        (181.2, [67, 71, 74, 69, 69, 66], [0, 0.625, 1.875, 3.125, 4.375, 5.625], 0.44),
        (190.05, [69, 73, 74], [0, 0.625, 1.70], 0.40),
    ]
    for start, notes, offsets, velocity in phrases:
        played = []
        for index, (note, offset) in enumerate(zip(notes, offsets)):
            onset = start + offset
            played.append(music_note('music-keys', note, onset, 3.5, velocity * (0.9 if index == 1 else 1), (index % 3 - 1) * 0.07, 0.15))
        events.append({'track': 'music', 'time': start, 'kind': 'theme', 'midi_notes': played, 'offsets': offsets})
    targets = {'music-pad': -31.5, 'music-keys': -28.5, 'music-pulse': -35.5, 'music-bass': -33.0, 'music-percussion': -37.0}
    gains = {}
    for name, track in tracks.items():
        gains[name] = rms_gain(track, targets[name])
        for start, end, gain in QUIET:
            depth = np.sqrt(gain) if name in ['music-pad', 'music-keys'] else gain
            envelope(track, [(0, 1), (start - 0.55, 1), (start + 0.35, depth), (end - 0.35, depth), (end + 0.55, 1), (DURATION, 1)])
        envelope(track, [(0, 0), (0.8, 0.7), (3.0, 1), (188.3, 1), (190.5, 0.85), (193.2, 0.57), (195.65, 0), (196, 0)])
    room_input = tracks['music-keys'] + tracks['music-pulse'] + tracks['music-pad'] * 0.08
    tracks['music-space'] = room(room_input, rng, 1.35, 0.12)
    envelope(tracks['music-space'], [(0, 1), (194.3, 1), (195.65, 0), (196, 0)])
    return tracks, gains, harmony


def sound_effects(rng, events, clock, harmony):
    gestures = np.zeros((DURATION * SAMPLE_RATE, 2), dtype=np.float32)
    details = np.zeros_like(gestures)

    def motion(time, duration, label, direction='open', gain=0.042, pan=0):
        add_event(gestures, gesture(duration, rng, direction), time, gain, pan, 0.42)
        events.append({'track': 'sfx', 'time': round(time, 4), 'duration': duration, 'kind': 'motion', 'label': label, 'gesture': direction})

    def tap(time, label, gain=0.12, pan=0, paper=False):
        add_event(details, contact(rng, 'paper' if paper else 'soft'), time, gain, pan)
        events.append({'track': 'sfx', 'time': round(time, 4), 'duration': 0.18 if paper else 0.11, 'kind': 'contact', 'label': label})

    def tone(time, note, label, gain=0.085, rounded=False, pan=0):
        name = chord_at(time, harmony)
        note = chord_tone(note, name)
        duration = compatible_duration(note, time, 1.6 if rounded else 0.65, harmony)
        add_event(details, ceramic(note, duration, rng, rounded), time, gain, pan, 0.10 if rounded else 0)
        events.append({'track': 'sfx', 'time': round(time, 4), 'duration': duration, 'kind': 'rounded' if rounded else 'dry', 'note': note, 'chord': name, 'label': label})

    motion(2.8, 2.1, '需求展开成页面纵深', gain=0.036)
    for index in range(8):
        tap(3.05 + index * 0.14, f'通道页面 {index + 1}', 0.030 + index * 0.003, (index / 7 - 0.5) * 0.9, True)
    motion(8.95, 1.8, '通道压缩回手机', 'close', 0.065)
    tap(10.64, '通道归位', 0.095)
    motion(11.0, 0.8, '应用界面展开', gain=0.040)
    motion(16.2, 1.2, '由手机进入系统协作', gain=0.032)
    motion(19.1, 0.70, '语音数据送往识别服务', 'focus', 0.035, -0.12)
    tone(21.4, 69, 'ASR 输出文字', 0.065, False, -0.18)
    motion(22.4, 0.8, '文字与页面输入模型', 'focus', 0.032)
    tone(24.8, 74, '模型生成下一步工具调用', 0.070)
    tap(27.7, '本机校验后执行', 0.090)
    tone(29.6, 69, '页面观察返回', 0.060, True, 0.16)
    tap(31.2, '下一轮工具调用', 0.070, -0.10)
    tap(32.6, '下一轮页面更新', 0.055, 0.10)
    motion(34.7, 0.65, '收到暂停，动作柔和停下', 'close', 0.027)
    tap(40.65, '接回同一次任务', 0.070)
    motion(43.0, 1.4, '进入页面编译工作台', gain=0.052)
    tone(48.55, 62, '控件结构读取', 0.072, False, -0.26)
    tone(50.15, 69, '截图关系补充', 0.070, True, 0.26)
    tap(53.2, '双通道对齐同一个目标', 0.095)
    for index in range(6):
        source = 25.45 + index * 0.16
        onset = compiler_clock(clock, source + 0.35, 50, 64)
        landing = compiler_clock(clock, source + 2.55, 50, 64)
        motion(onset, 0.62, f'第 {index + 1} 页抽取信息', 'focus', 0.025, (index - 2.5) * 0.09)
        tone(landing, [62, 64, 69, 62, 64, 69][index], f'信息归位为步骤 {index + 1}', 0.064, False, (index - 2.5) * 0.06)
    fold = compiler_clock(clock, 32.8, 60, 70)
    motion(fold - 0.65, 1.3, '操作步骤折叠消去', 'close', 0.052)
    tap(fold + 0.72, '需求与决定保留下来', 0.077, paper=True)
    motion(75.25, 0.95, '携带上下文进入家人端', gain=0.038)
    tap(78.4, '家人接手查看背景', 0.075, paper=True)
    tone(80.5, 62, '家人回复线索', 0.075, True, 0.12)
    tone(82.1, 69, '线索回到原手机', 0.075, True, -0.12)
    tap(84.0, '本人确认线索', 0.085)
    motion(85.3, 0.85, '线索落到当前页面', 'focus', 0.036)
    tap(88.0, '版式变化重新定位', 0.065, paper=True)
    tone(91.9, 62, '本地核对后绑定', 0.075)
    motion(94.2, 0.9, '同名目标展开上下文', gain=0.032)
    motion(97.0, 0.9, '重新观察当前页面', 'focus', 0.034)
    tap(99.5, '选中新观察中的唯一目标', 0.090)
    motion(102.4, 0.85, '按需装入阅读方法', gain=0.040)
    tone(103.65, 62, '方法归位', 0.075, True)
    for index, onset in enumerate([105.55, 106.32, 107.09]):
        tone(onset, [62, 64, 69][index], ['读表头', '对齐目标列', '核对行与内容'][index], 0.065, False, (index - 1) * 0.15)
    motion(109.1, 0.65, '核对页交给本人', 'close', 0.025)
    tap(112.4, '本人提交，仅表示提交动作', 0.14)
    tap(114.6, '动作记录与返回页面分开', 0.080, paper=True)
    motion(118.1, 0.7, '去除没有依据的结论', 'close', 0.026)
    tone(121.0, 62, '本地证据审计完成', 0.105, False, -0.15)
    tone(123.4, 62, '独立云端语义复核', 0.095, True, 0.15)
    tone(125.2, 57, '中性落定：已提交，待医院确认', 0.066, True)
    motion(127.3, 0.85, '同一句话的来源对照展开', gain=0.026)
    motion(128.65, 0.55, 'SELF_TYPED 不作为外部证据', 'close', 0.022)
    tap(131.05, '外部页面事实与来源归位', 0.072, paper=True)
    tap(134.15, '来源、版本和步骤留存', 0.062, paper=True)
    motion(136.15, 0.9, '办理轨迹展开', gain=0.038)
    for index, offset in enumerate([0, 0.37, 0.71, 1.02, 1.30]):
        tap(137.2 + offset, f'轨迹要点提炼 {index + 1}', 0.055, (index - 2) * 0.12, True)
    motion(139.1, 1.0, '移除个人信息，折叠成通用方法', 'close', 0.044)
    tap(141.3, '方法候选归档，不表示已发布', 0.082, paper=True)
    motion(143.3, 0.8, '换一种排班版式', gain=0.035)
    tone(145.3, 62, '当前版式重新找到表头', 0.068)
    tone(147.1, 69, '方法不变，目标重读', 0.064)
    motion(149.2, 0.85, '独立运行与原任务回归展开', gain=0.043)
    for index, onset in enumerate([151.7, 153.1, 154.55, 156.4]):
        tap(onset, f'演示运行归档 {index + 1}，不代表真实测量成绩', 0.075, (index % 2 - 0.5) * 0.24, True)
    tone(158.2, 62, '版本契约一致，本机重算', 0.075)
    motion(159.3, 0.85, '进入影子回放', 'focus', 0.034)
    for index, onset in enumerate([162.05, 163.35, 164.65]):
        tap(onset, ['匹配应用', '匹配任务族', '匹配页面前提'][index], 0.063, (index - 1) * 0.16, True)
    tap(167.0, '适用与不适用的运行均进入账本', 0.072, paper=True)
    motion(170.25, 0.65, '交给家人选择', 'close', 0.030)
    tap(172.1, '家人手动采用', 0.12)
    motion(174.25, 0.75, '按需打开匹配方法', gain=0.034)
    tone(176.25, 62, '匹配方法轻装入', 0.072, True)
    motion(179.2, 1.05, '总结展开', gain=0.042)
    for index, onset in enumerate([181.5, 182.22, 182.94]):
        tap(onset, ['读懂页面', '核实事实', '留下方法'][index], 0.057, (index - 1) * 0.20, True)
    motion(187.65, 1.55, '三项能力收回手机', 'close', 0.046)
    tone(190.15, 62, '品牌稳定，温和收住', 0.045, True)
    details += room(details, rng, 0.9, 0.075)
    for track in [gestures, details]:
        envelope(track, [(0, 0), (0.1, 1), (194.6, 1), (195.65, 0), (196, 0)])
    return {'sfx-motion': gestures, 'sfx-detail': details}


def loudness(path, target=False):
    audio_filter = 'loudnorm=I=-16:TP=-2:LRA=9:print_format=json' if target else 'loudnorm=I=-16:TP=-1:LRA=9:print_format=json'
    stdout, stderr = execute(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-vn', '-af', audio_filter, '-f', 'null', '-'])
    return json.loads(re.findall(r'\{[^{}]*"input_i"[^{}]*\}', stderr)[-1])


def master(raw, destination):
    measured = loudness(raw, True)
    parameters = ':'.join([
        'loudnorm=I=-16', 'TP=-2', 'LRA=9',
        f"measured_I={measured['input_i']}", f"measured_TP={measured['input_tp']}",
        f"measured_LRA={measured['input_lra']}", f"measured_thresh={measured['input_thresh']}",
        f"offset={measured['target_offset']}", 'linear=true', 'print_format=json',
    ])
    stdout, stderr = execute(['ffmpeg', '-y', '-hide_banner', '-nostats', '-i', raw, '-af', parameters, '-ar', SAMPLE_RATE, '-c:a', 'pcm_s24le', destination])
    return {'analysis': measured, 'render': json.loads(re.findall(r'\{[^{}]*"input_i"[^{}]*\}', stderr)[-1]), 'filter': parameters}


def video_hash(path):
    stdout, stderr = execute(['ffmpeg', '-v', 'error', '-i', path, '-map', '0:v:0', '-c:v', 'copy', '-f', 'hash', '-hash', 'sha256', '-'])
    return stdout.strip()


def validate(source, output, master_path):
    stdout, stderr = execute(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', output])
    probe = json.loads(stdout)
    video = [stream for stream in probe['streams'] if stream['codec_type'] == 'video']
    audio = [stream for stream in probe['streams'] if stream['codec_type'] == 'audio']
    if len(video) != 1 or len(audio) != 1:
        raise RuntimeError('Expected one video stream and one audio stream')
    if (video[0]['width'], video[0]['height'], video[0]['r_frame_rate'], int(video[0]['nb_frames'])) != (1920, 1080, '60/1', 11760):
        raise RuntimeError('Picture format changed')
    if audio[0]['sample_rate'] != '48000' or audio[0]['channels'] != 2 or audio[0]['codec_name'] != 'aac':
        raise RuntimeError('Unexpected delivery audio format')
    if abs(float(probe['format']['duration']) - DURATION) > 0.025 or abs(float(audio[0]['duration']) - DURATION) > 0.025:
        raise RuntimeError('Audio/video duration mismatch')
    if abs(float(audio[0].get('start_time', 0))) > 0.025:
        raise RuntimeError('Audio starts out of sync')
    original_hash = video_hash(source)
    copied_hash = video_hash(output)
    if original_hash != copied_hash:
        raise RuntimeError('Video packet hash changed during mux')
    execute(['ffmpeg', '-v', 'error', '-xerror', '-i', output, '-f', 'null', '-'])
    audio_data, rate = sf.read(master_path, dtype='float32', always_2d=True)
    if audio_data.shape != (DURATION * SAMPLE_RATE, 2) or rate != SAMPLE_RATE or not np.isfinite(audio_data).all():
        raise RuntimeError('Invalid lossless master samples')
    sample_peak = float(np.max(np.abs(audio_data)))
    if sample_peak >= 0.99 or np.max(np.abs(audio_data[-round(0.3 * SAMPLE_RATE):])) > 0.00004:
        raise RuntimeError('Clipped master or unclean tail')
    rms = np.sqrt(np.mean(audio_data.astype(np.float64) ** 2, axis=0))
    balance = float(20 * np.log10(rms[0] / rms[1]))
    if abs(balance) > 1.0:
        raise RuntimeError('Unbalanced stereo image')
    measured = loudness(output)
    if abs(float(measured['input_i']) + 16) > 1 or float(measured['input_tp']) > -1.0:
        raise RuntimeError(f'Final loudness/headroom out of range: {measured}')
    per_second = np.sqrt(np.mean(audio_data.reshape(DURATION, SAMPLE_RATE, 2).astype(np.float64) ** 2, axis=(1, 2)))
    if np.any(per_second[1:193] < 0.00005):
        raise RuntimeError('Unexpected silent gap in score')
    if digest(source) != SOURCE_SHA256:
        raise RuntimeError('Silent picture baseline changed')
    return {
        'passed': True, 'picture_bitstream_identical': True, 'video_packet_hash': original_hash,
        'full_av_decode_passed': True, 'duration_seconds': float(probe['format']['duration']),
        'audio_start_seconds': float(audio[0].get('start_time', 0)), 'master_samples': len(audio_data),
        'sample_peak_dbfs': float(20 * np.log10(sample_peak)), 'stereo_balance_db': balance,
        'dc_offset': audio_data.mean(axis=0).tolist(), 'integrated_lufs': float(measured['input_i']),
        'true_peak_dbtp': float(measured['input_tp']), 'loudness_range_lu': float(measured['input_lra']),
        'rms_per_second_dbfs': (20 * np.log10(np.maximum(per_second, 1e-10))).tolist(),
        'clean_tail_seconds': 0.3, 'narration': False, 'review_page_opened': False,
    }


def main():
    parser = argparse.ArgumentParser(description='Original score + sound design for the locked fusion-v17 picture')
    parser.add_argument('--source', default='out/review/fusion-v17/fusion-v17.mp4')
    parser.add_argument('--output', default='out/review/fusion-v17-sound-v02')
    parser.add_argument('--remaster', action='store_true')
    arguments = parser.parse_args()
    source = (ROOT / arguments.source).resolve()
    destination = (ROOT / arguments.output).resolve()
    if digest(source) != SOURCE_SHA256:
        raise RuntimeError('This score is authored for the locked v17 picture only')
    if destination == source.parent or (destination / 'delivery.json').exists():
        raise RuntimeError('Use a fresh sound-version directory; previous deliveries remain untouched')
    destination.mkdir(parents=True, exist_ok=True)
    stem_directory = destination / 'stems'
    stem_directory.mkdir(exist_ok=True)
    raw_mix = destination / 'mix-premaster.wav'
    master_path = destination / 'master-48k-24bit.wav'
    if not arguments.remaster:
        rng = np.random.default_rng(SEED)
        events = []
        clock = timeline()
        tracks, gains, harmony = music_score(rng, events)
        print('Music complete; aligning causal sound effects to picture', flush=True)
        tracks.update(sound_effects(np.random.default_rng(SEED + 1), events, clock, harmony))
        harmony_report = check_harmony(events, harmony)
        write_json(destination / 'harmony-check.json', harmony_report)
        print(f"Harmony passed: {harmony_report['pitched_events_checked']} pitched events, no incompatible dry sustains", flush=True)
        music_mix = np.zeros_like(next(iter(tracks.values())))
        sfx_mix = np.zeros_like(music_mix)
        for name, track in tracks.items():
            if not np.isfinite(track).all() or np.max(np.abs(track)) >= 0.99:
                raise RuntimeError(f'Invalid or clipped stem: {name}')
            sf.write(stem_directory / f'{name}.wav', track, SAMPLE_RATE, subtype='PCM_24')
            (music_mix if name.startswith('music') else sfx_mix)[:] += track
        sf.write(destination / 'music.wav', music_mix, SAMPLE_RATE, subtype='PCM_24')
        sf.write(destination / 'sfx.wav', sfx_mix, SAMPLE_RATE, subtype='PCM_24')
        sf.write(raw_mix, music_mix + sfx_mix, SAMPLE_RATE, subtype='FLOAT')
        write_json(destination / 'cues.json', {
            'duration_seconds': DURATION, 'sample_rate': SAMPLE_RATE, 'seed': SEED, 'bpm': 96,
            'score_revision': 2, 'key': 'D major', 'theme_midi': [66, 69, 74],
            'sfx_seed': SEED + 1, 'external_audio_assets': [], 'narration': False,
            'harmony_strategy': 'Consonant triads, close voice leading, chord-matched melody and pitched effects',
            'harmony_schedule': harmony,
            'quiet_windows': QUIET, 'layer_calibration_gains': gains, 'acts': ACTS,
            'events': sorted(events, key=lambda event: event['time']), 'picture_edits': clock['edits'],
        })
        del tracks, music_mix, sfx_mix
    harmony_report = json.loads((destination / 'harmony-check.json').read_text())
    if not harmony_report['passed']:
        raise RuntimeError('Harmony audit must pass before mastering')
    print('Mastering the complete 196-second mix', flush=True)
    mastering = master(raw_mix, master_path)
    write_json(destination / 'mastering.json', mastering)
    output = destination / f'{destination.name}.mp4'
    execute(['ffmpeg', '-y', '-hide_banner', '-nostats', '-i', source, '-i', master_path,
             '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k',
             '-ar', SAMPLE_RATE, '-ac', '2', '-t', DURATION, '-movflags', '+faststart',
             '-metadata', 'title=银龄智办 · 为人编译',
             '-metadata', 'comment=Original procedural score and sound design; locked fusion-v17 picture; no narration', output])
    print('Checking loudness, full decode, audio sync and unchanged picture packets', flush=True)
    validation = validate(source, output, master_path)
    validation['harmony_schedule_passed'] = harmony_report['passed']
    validation['pitched_events_checked'] = harmony_report['pitched_events_checked']
    write_json(destination / 'validation.json', validation)
    snapshot = destination / 'audio-source'
    snapshot.mkdir(exist_ok=True)
    for name in ['soundtrack.py', 'sound_synthesis.py', 'requirements-audio.txt']:
        shutil.copy2(ROOT / 'render' / name, snapshot / name)
    shutil.copy2(ROOT / 'docs' / 'fusion-v17-sound-cues.md', snapshot / 'picture-sound-proposal.md')
    shutil.copy2(ROOT / 'docs' / 'fusion-v17-sound-v02.md', snapshot / 'sound-treatment.md')
    write_json(destination / 'delivery.json', {
        'status': 'complete', 'score_revision': 2, 'file': str(output.relative_to(ROOT)), 'duration_seconds': DURATION,
        'resolution': [1920, 1080], 'fps': 60, 'source_picture': str(source.relative_to(ROOT)),
        'source_picture_sha256': SOURCE_SHA256, 'sha256': digest(output), 'bytes': output.stat().st_size,
        'picture_rerendered': False, 'picture_bitstream_identical': True,
        'audio': {'codec': 'aac', 'bitrate': 320000, 'sample_rate': SAMPLE_RATE, 'channels': 2,
                  'original_music': True, 'original_sfx': True, 'external_audio_assets': [], 'narration': False,
                  'key': 'D major', 'harmony_audit': 'harmony-check.json',
                  'integrated_lufs': validation['integrated_lufs'], 'true_peak_dbtp': validation['true_peak_dbtp']},
        'lossless_master': master_path.name, 'separate_mixes': ['music.wav', 'sfx.wav'],
        'stems': sorted(str(path.relative_to(destination)) for path in stem_directory.glob('*.wav')),
        'python_packages': {name: importlib.metadata.version(name) for name in ['numpy', 'scipy', 'soundfile']},
        'reproduction': 'tmp/audio-venv/bin/python render/soundtrack.py --output out/review/NEW-SOUND-VERSION',
        'validation': 'validation.json', 'old_versions_preserved': True, 'review_page_opened': False,
        'automatically_played': False, 'completed_at': datetime.now(timezone.utc).isoformat(),
    })
    print(json.dumps({'file': str(output), 'lufs': validation['integrated_lufs'], 'true_peak': validation['true_peak_dbtp'], 'picture_unchanged': True}, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
