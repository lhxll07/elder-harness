"""Read-only v19 source/audio contract audit; only --output writes a JSON report."""

import argparse
from datetime import datetime, timezone
from fractions import Fraction
import hashlib
import json
from pathlib import Path
import re
import shlex
import subprocess
import sys


ROOT = Path(__file__).resolve().parent.parent
FPS = 60
DURATION = 196
FRAMES = FPS * DURATION
SAMPLE_RATE = 48000
PICTURE_SHA256 = 'c7ddb957af5feaca516885038b0cb682a16336f5f1e06cf8041d44696723d46a'
SOUND_SHA256 = '499e45cde1237f78108dd4786290423d9dcf28bddae6e3e31211197d0d04b826'
MASTER_SHA256 = 'c6f0cc17a280847917d471772be883be24fac0b1abcbadb047e09f5d20106bd4'
CONTRACT_SHA256 = '4f3ea47611437bcbdc6f69860df764682b4bcf3d47006ea21a8da4b339a6c1e5'
VISUAL_ALLOWLIST = frozenset({
    'compiler-design.js', 'device-detail.js', 'fusion-finish.js',
    'fusion-scenery.js', 'fusion-workspace.js', 'fusion-memory-ui.js',
    'palette.js', 'props.js', 'screen.js', 'stage.js', 'studio.js', 'touch-hand.js',
})
ADDED_VISUAL_MODULES = {
    'device-assets-v19.js': ('loadDeviceAssets', 'getDeviceGeometry'),
    'quality-assets.js': ('loadQualityAssets', 'qualityPlate', 'applyQualityEnvironment'),
    'quality-surfaces.js': ('surfaceGradient', 'surfaceShadow', 'paintSurface', 'surfaceRule'),
}
PROTECTED_FUNCTIONS = {
    'compiler-design.js': ('windowAt', 'bendPage', 'interpolate', 'place'),
    'fusion-finish.js': ('sampleFusionFinish',),
    'fusion-scenery.js': ('sampleFusionScenery',),
}
CANVAS_VISUAL_FUNCTIONS = {
    'fusion-memory-ui.js': frozenset({'fill', 'panel', 'rule', 'schedule'}),
    'screen.js': frozenset({'fillRR', 'bigButton', 'homeScreen', 'gearIcon'}),
}
CANVAS_MOTION_NAMES = re.compile(
    r'(?:height|rowHeight|timeWidth|columnWidth|reorder|highlight|row|target|size|'
    r'columnPosition|headings|values|columns|columnX|columnSize|lift|scale|k|rr2)'
)
BOOT_IMPORTS = (b"import { loadQualityAssets } from './quality-assets.js'\n",
                b"import { loadDeviceAssets } from './device-assets-v19.js'\n")
BOOT_LOADER = b'  await Promise.all([loadQualityAssets(), loadDeviceAssets()])\n'
CLOCK_FILES = ('fusion-edit.js', 'fusion-script.js', 'voice-timing.js', 'timeline.js')
VERSION_PATTERN = re.compile(rb'(?m)^export const VERSION = (18|19)(?=\r?$|;)')
TIMING_NAME = re.compile(
    r'(?:.*DURATION|.*BEATS|.*CUES|EDITS|MEMORY_CLOCK|EXPERIENCE_END|SCENOGRAPHY|SCENERY_TRANSITION|FPS)',
    re.IGNORECASE,
)
JS_TOKENS = re.compile(
    r'//[^\n]*|/\*.*?\*/|"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|'
    r'`(?:\\.|[^`\\])*`|[A-Za-z_$][\w$]*|=>|\s+|.', re.DOTALL,
)

RUNTIME_PROBE = r"""
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
const request = JSON.parse(await new Promise(resolve => {
  let input = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', chunk => input += chunk)
  process.stdin.on('end', () => resolve(input))
}))
async function inspect(directory) {
  const load = name => import(pathToFileURL(`${directory}/${name}`).href)
  const edit = await load('fusion-edit.js')
  const script = await load('fusion-script.js')
  const voice = await load('voice-timing.js')
  const timeline = await load('timeline.js')
  function clocks(frame) {
    const actual = frame / 60
    const source = edit.editTime(actual)
    return { actual, source, compiler: script.compilerTime(source),
      runtime: script.runtimeTime(source), memory: script.memoryTime(source),
      voice: voice.voiceStoryTime(script.openingTime(source) - 16),
      detail: actual - edit.editAt(actual).start,
      opening: script.openingTime(source), studio: script.studioTime(source),
      inverseEdit: edit.fromEditTime(source), inverseMemory: script.fromMemoryTime(source),
      voicePlayback: voice.voicePlaybackTime(actual), voiceStory: voice.voiceStoryTime(actual) }
  }
  const clockHashes = Object.fromEntries(Object.keys(clocks(0)).map(name => [name, createHash('sha256')]))
  for (let frame = 0; frame <= 11760; frame++) {
    for (const [name, value] of Object.entries(clocks(frame))) {
      if (!Number.isFinite(value)) throw new Error(`Non-finite clock ${name} at frame ${frame}`)
      clockHashes[name].update(`${frame}:${JSON.stringify(value)}\n`)
    }
  }
  const constants = {}
  for (const [moduleName, module] of Object.entries({ edit, script, timeline })) {
    constants[moduleName] = Object.fromEntries(Object.entries(module)
      .filter(([name, value]) => name !== 'VERSION' && typeof value !== 'function'))
  }
  return { version: script.VERSION, constants,
    clock_frames_checked: 11761,
    clock_hashes: Object.fromEntries(Object.entries(clockHashes).map(([name, hash]) => [name, hash.digest('hex')])),
    cue_clocks: request.cues.map(cue => {
      const value = clocks(cue.target_frame)[cue.source_clock]
      if (!Number.isFinite(value)) throw new Error(`Unknown cue clock ${cue.source_clock}`)
      return { id: cue.id, value }
    }) }
}
console.log(JSON.stringify({ baseline: await inspect(request.baseline), candidate: await inspect(request.candidate) }))
"""


def digest_bytes(content):
    return hashlib.sha256(content).hexdigest()


def digest_file(path):
    digest = hashlib.sha256()
    with path.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def read_tree(directory):
    if not directory.is_dir():
        raise ValueError(f'Source directory does not exist: {directory}')
    files = {}
    for path in sorted(directory.rglob('*')):
        if path.is_symlink():
            raise ValueError(f'Symlinks are not permitted in a source snapshot: {path}')
        if path.is_file():
            files[path.relative_to(directory).as_posix()] = path.read_bytes()
    if not files:
        raise ValueError(f'Empty source snapshot: {directory}')
    return files


def timing_declarations(content, name_pattern=TIMING_NAME):
    text = content.decode('utf-8')
    tokens = [match for match in JS_TOKENS.finditer(text)
              if not match.group().isspace() and not match.group().startswith(('//', '/*'))]
    declarations = {}
    for index, token in enumerate(tokens[:-3]):
        if token.group() not in ('const', 'let', 'var'):
            continue
        name = tokens[index + 1].group()
        if not name_pattern.fullmatch(name) or tokens[index + 2].group() != '=':
            continue
        start = index + 3
        stack = []
        finish = None
        for offset in range(start, len(tokens)):
            current = tokens[offset].group()
            if offset > start and not stack:
                previous = tokens[offset - 1]
                gap = text[previous.end():tokens[offset].start()]
                continuation = previous.group() in ('=', '=>', '.', '+', '-', '*', '/', '?', ':', '&&', '||')
                if current in (';', ',') or ('\n' in gap and not continuation and current != '.'):
                    finish = previous.end()
                    break
            if current in ('(', '[', '{'):
                stack.append(current)
            elif current in (')', ']', '}'):
                if not stack or stack.pop() != {')': '(', ']': '[', '}': '{'}[current]:
                    raise ValueError(f'Unbalanced initializer for {name}')
        if finish is None:
            if stack:
                raise ValueError(f'Unterminated initializer for {name}')
            finish = tokens[-1].end()
        declarations.setdefault(name, []).append(text[tokens[start].start():finish].strip())
    return declarations


def script_version(content):
    matches = list(VERSION_PATTERN.finditer(content))
    if len(matches) != 1:
        raise ValueError('Expected exactly one export const VERSION = 18 or 19')
    return int(matches[0].group(1)), VERSION_PATTERN.sub(
        lambda match: match.group().replace(match.group(1), b'18', 1), content,
    )


def syntax_tokens(content):
    return [match.group() for match in JS_TOKENS.finditer(content.decode('utf-8'))
            if not match.group().isspace() and not match.group().startswith(('//', '/*'))]


def balanced_end(tokens, start):
    stack = []
    for index in range(start, len(tokens)):
        token = tokens[index]
        if token in ('(', '[', '{'):
            stack.append(token)
        elif token in (')', ']', '}'):
            if not stack or stack.pop() != {')': '(', ']': '[', '}': '{'}[token]:
                raise ValueError('Unbalanced JavaScript block')
            if not stack:
                return index
    raise ValueError('Unterminated JavaScript block')


def function_blocks(content):
    tokens = syntax_tokens(content)
    functions = {}
    for index, token in enumerate(tokens[:-3]):
        if token != 'function' or tokens[index + 2] != '(':
            continue
        name = tokens[index + 1]
        body = balanced_end(tokens, index + 2) + 1
        if tokens[body] != '{' or name in functions:
            raise ValueError(f'Unexpected or duplicate function declaration: {name}')
        functions[name] = tokens[index:balanced_end(tokens, body) + 1]
    return functions


def guarded_calls(content):
    tokens = syntax_tokens(content)
    names = {'text', 'mono', 'badge', 'fillText', 'wrapLines', 'translate', 'rotate',
             'scale', 'transform', 'setTransform', 'smooth01', 'windowAt', 'lerp',
             'envelope', 'if', 'for', 'while', 'switch'}
    return [tokens[index:balanced_end(tokens, index + 1) + 1]
            for index, token in enumerate(tokens[:-1]) if token in names and tokens[index + 1] == '('
            and (index == 0 or tokens[index - 1] != 'function')]


def visual_invariants(name, before, after):
    required = PROTECTED_FUNCTIONS.get(name, ())
    canvas = name in CANVAS_VISUAL_FUNCTIONS
    if not required and not canvas:
        return {'passed': True, 'scope': 'timing declarations and animation anchors only'}
    original, current = function_blocks(before), function_blocks(after)
    if canvas:
        required = tuple(set(original) - CANVAS_VISUAL_FUNCTIONS[name])
    functions = {function: function in original and original[function] == current.get(function)
                 for function in sorted(required)}
    same_inventory = not canvas or original.keys() == current.keys()
    same_calls = not canvas or guarded_calls(before) == guarded_calls(after)
    same_motion_bindings = (not canvas or
                            timing_declarations(before, CANVAS_MOTION_NAMES) ==
                            timing_declarations(after, CANVAS_MOTION_NAMES))
    return {'passed': same_inventory and same_calls and same_motion_bindings and all(functions.values()),
            'protected_functions': functions, 'function_inventory_matches': same_inventory,
            'motion_and_content_bindings_match': same_motion_bindings,
            'narrative_motion_and_control_calls_match': same_calls}


def material_boot_matches(before, after):
    if before == after:
        return True
    normalized = after
    if any(normalized.count(line) != 1 for line in BOOT_IMPORTS):
        return False
    for line in BOOT_IMPORTS:
        normalized = normalized.replace(line, b'', 1)
    marker = b'export async function boot() {\n'
    if normalized.count(marker + BOOT_LOADER) != 1 or normalized.count(BOOT_LOADER) != 1:
        return False
    return normalized.replace(marker + BOOT_LOADER, marker, 1) == before


def family_material_matches(before, after):
    replacements = (
        (b"    fill(context, 76, 946, 340, 148, 38, COLORS.jade)",
         b"    fill(context, 76, 946, 340, 148, 38, COLORS.jade, { elevation: 'control' })"),
        (b"    fill(context, 72, 383, 969, 396, 30, '#ffffff')",
         b"    fill(context, 72, 383, 969, 396, 30, '#ffffff', { inset: true, strength: 0.6 })"),
        (b"    fill(context, 72, 981, 969, 148, 38, COLORS.jade)",
         b"    fill(context, 72, 981, 969, 148, 38, COLORS.jade, { elevation: 'control' })"),
    )
    for original, material in replacements:
        after = after.replace(material, original)
    return before == after


def opening_opacity_state_fix(before, after):
    initializer = (b'    this.endCamera = this.voice.cameraRig.sample(44)\n'
                   b'    this.pauseFade = false\n'
                   b'    this.hide()\n')
    pause_expression = b'    const pause = smooth01(source, 39.4, 0.7) * (1 - smooth01(source, 42.9, 0.7))\n'
    original_pause = (pause_expression + b'    if (pause > 0.001) {\n'
                      b'      fade(this.voice.phone, 1 - pause * 0.95)\n'
                      b'      this.pauseFade = true\n'
                      b'    } else if (this.pauseFade) {\n'
                      b'      fade(this.voice.phone, 1)\n'
                      b'      this.pauseFade = false\n'
                      b'    }\n')
    fixed_pause = (pause_expression +
                   b'    if (pause > 0.001) for (const { material } of this.voice.phoneMaterials) material.opacity *= 1 - pause * 0.95\n')
    original_matches = before.count(initializer) == 1 and before.count(original_pause) == 1
    expected = before
    if original_matches:
        expected = before.replace(initializer, initializer.replace(b'    this.pauseFade = false\n', b''), 1)
        expected = expected.replace(original_pause, fixed_pause, 1)
    applied = original_matches and before != after and after == expected
    passed = before == after or applied
    return {'passed': passed, 'applied': applied,
            'classification': 'deterministic opacity-state fix',
            'action_retimed': False if passed else None,
            'pause_expression_unchanged': before.count(pause_expression) == after.count(pause_expression) == 1,
            'exact_source_normalization': 'Only remove pauseFade initialization and replace the frozen pause if/elseif block.',
            'rendered_order_determinism_checked': False}


def added_visual_module(name, content):
    tokens = syntax_tokens(content)
    exports = [tokens[index + 2] if tokens[index + 1] != 'async' else tokens[index + 3]
               for index, token in enumerate(tokens[:-3]) if token == 'export']
    imports = re.findall(r"(?m)^import[^\n]*from\s+['\"]([^'\"]+)['\"]", content.decode('utf-8'))
    references_clock = any(token in {'DURATION', 'BEATS', 'CUES', 'EDITS', 'editTime', 'voiceStoryTime',
                                    'requestAnimationFrame', 'setInterval', 'setTimeout'} for token in tokens)
    return (set(exports) == set(ADDED_VISUAL_MODULES[name]) and
            all(path == 'three' or path.startswith('three/') for path in imports) and
            not timing_declarations(content) and not references_clock)


def compare_sources(baseline, candidate):
    missing = sorted(baseline.keys() - candidate.keys())
    extra = sorted(candidate.keys() - baseline.keys())
    records = []
    for name in sorted(baseline.keys() & candidate.keys()):
        before, after = baseline[name], candidate[name]
        policy = 'byte_identical'
        same = before == after
        details = {}
        if name == 'fusion-script.js':
            policy = 'only_VERSION_18_to_19'
            original_version, original = script_version(before)
            version, normalized = script_version(after)
            same = original_version == 18 and normalized == original
            details['candidate_version'] = version
        elif name == 'fusion-film.js':
            policy = 'only_two_material_loader_imports_and_boot_preload'
            same = material_boot_matches(before, after)
        elif name == 'fusion-family-ui.js':
            policy = 'only_three_reviewed_fill_material_options'
            same = family_material_matches(before, after)
        elif name == 'fusion-opening.js':
            policy = 'exact_deterministic_opacity_state_fix_no_retiming'
            details['deterministic_opacity_state_fix'] = opening_opacity_state_fix(before, after)
            same = details['deterministic_opacity_state_fix']['passed']
        elif name in VISUAL_ALLOWLIST:
            policy = 'visual_allowlist_with_timing_invariants'
            details['visual_invariants'] = visual_invariants(name, before, after)
            same = details['visual_invariants']['passed']
        before_timing, after_timing = timing_declarations(before), timing_declarations(after)
        timing_matches = before_timing == after_timing
        passed = same and timing_matches
        records.append({'file': name, 'policy': policy, 'changed': before != after,
                        'baseline_sha256': digest_bytes(before), 'candidate_sha256': digest_bytes(after),
                        'timing_declarations': before_timing, 'timing_matches': timing_matches,
                        'passed': passed, 'status': 'PASS' if passed else 'FAIL',
                        'failure_reasons': ([] if same else [f'Source change violates {policy}']) +
                        ([] if timing_matches else ['Timing declarations changed']), **details})
    for name in extra:
        allowed = name in ADDED_VISUAL_MODULES
        passed = allowed and added_visual_module(name, candidate[name])
        records.append({'file': name, 'policy': 'added_material_module' if allowed else 'unapproved_added_file',
                        'changed': True, 'candidate_sha256': digest_bytes(candidate[name]),
                        'passed': passed, 'status': 'PASS' if passed else 'FAIL',
                        'failure_reasons': [] if passed else ['Unapproved module or non-material exports/timing dependencies']})
    required = set(CLOCK_FILES) - baseline.keys()
    return {'passed': not missing and not required and all(record['passed'] for record in records),
            'missing': missing, 'extra': extra, 'missing_clock_modules': sorted(required),
            'approved_added_visual_modules': sorted(set(extra) & ADDED_VISUAL_MODULES.keys()),
            'unexpected_extra': sorted(set(extra) - ADDED_VISUAL_MODULES.keys()),
            'deterministic_opacity_state_fixes': [record['file'] for record in records
                                                if record.get('deterministic_opacity_state_fix', {}).get('applied')],
            'clock_modules_passed': all(name in baseline and name in candidate for name in CLOCK_FILES) and
            all(record['passed'] for record in records if record['file'] in CLOCK_FILES),
            'visual_allowlist': sorted(VISUAL_ALLOWLIST), 'files': records}


def run_json(command, request=None):
    result = subprocess.run(command, input=None if request is None else json.dumps(request),
                            text=True, capture_output=True, check=True, timeout=120)
    return json.loads(result.stdout)


def compare_anchors(contract, baseline, candidate):
    fingerprints = []
    for entry in contract['contracts']:
        name = entry['file']
        fingerprints.append({'file': name, 'passed': name in baseline and
                             digest_bytes(baseline[name]) == entry['sha256']})
    anchors = []
    for kind, entries in (('cue', contract['cues']), ('gesture', contract['gestures'])):
        for entry in entries:
            name, expression = entry['source_file'], entry['source_expression']
            before = baseline.get(name, b'').decode('utf-8')
            after = candidate.get(name, b'').decode('utf-8')
            anchors.append({'kind': kind, 'id': entry.get('id', entry.get('cue_id')),
                            'file': name, 'expression': expression,
                            'passed': bool(expression) and expression in before and expression in after})
    return {'passed': bool(fingerprints) and bool(anchors) and
            all(entry['passed'] for entry in fingerprints + anchors),
            'fingerprints': fingerprints, 'anchors': anchors}


def audit_animation(contract_path, baseline, candidate, baseline_path, candidate_path, clock_modules_passed):
    contract_bytes = contract_path.read_bytes()
    contract = json.loads(contract_bytes)
    header_passed = (digest_bytes(contract_bytes) == CONTRACT_SHA256 and
                     contract['picture_version'] == 18 and contract['fps'] == FPS and
                     contract['duration_seconds'] == DURATION and len(contract['cues']) == 75 and
                     len(contract['gestures']) == 26)
    anchors = compare_anchors(contract, baseline, candidate)
    exporter_names = ('animation-sound-cues-v18.mjs', 'animation-sound-motion-v18.mjs')
    exporters = {name: (ROOT / 'render' / name).read_bytes() ==
                 (baseline_path.parent / 'render' / name).read_bytes() for name in exporter_names}
    report = {'passed': False, 'contract_sha256': digest_bytes(contract_bytes),
              'header_passed': header_passed, 'source_anchors': anchors,
              'exporters_match_frozen_snapshot': exporters}
    if not (header_passed and anchors['passed'] and clock_modules_passed and all(exporters.values())):
        report['runtime_skipped'] = 'Clock/anchor/exporter checks failed; changed clock JavaScript was not executed.'
        return report
    exported = run_json(['node', str(ROOT / 'render' / exporter_names[1])])
    fields = ('picture_version', 'fps', 'duration_seconds', 'contracts', 'cues', 'gestures')
    report['v18_export_matches_saved_contract'] = all(exported.get(name) == contract.get(name) for name in fields)
    runtime = run_json(['node', '--input-type=module', '-e', RUNTIME_PROBE], {
        'baseline': str(baseline_path), 'candidate': str(candidate_path), 'cues': contract['cues'],
    })
    original, current = runtime['baseline'], runtime['candidate']
    report['runtime'] = runtime
    report['duration_BEATS_CUES_and_exports_identical'] = original['constants'] == current['constants']
    report['all_frame_clocks_identical'] = original['clock_hashes'] == current['clock_hashes']
    cue_clocks = dict((entry['id'], entry['value']) for entry in current['cue_clocks'])
    report['cue_clock_targets_match'] = all(
        0 <= cue['target_frame'] < FRAMES and abs(cue['time'] * FPS - cue['target_frame']) < 1e-6 and
        abs(abs(cue_clocks[cue['id']] - cue['source_target']) - cue['source_clock_error']) < 1e-7
        for cue in contract['cues']
    )
    report['passed'] = all((report['v18_export_matches_saved_contract'],
                            report['duration_BEATS_CUES_and_exports_identical'],
                            report['all_frame_clocks_identical'], report['cue_clock_targets_match'],
                            original['constants']['script']['DURATION'] == DURATION,
                            original['version'] == 18, current['version'] in (18, 19)))
    return report


def probe(path):
    return run_json(['ffprobe', '-v', 'error', '-show_entries',
                     'format=duration,size:stream=codec_type,codec_name,width,height,r_frame_rate,'
                     'nb_frames,sample_rate,channels,start_time,duration_ts,time_base,bits_per_raw_sample',
                     '-of', 'json', str(path)])


def picture_format(metadata, with_audio):
    video = [stream for stream in metadata['streams'] if stream['codec_type'] == 'video']
    audio = [stream for stream in metadata['streams'] if stream['codec_type'] == 'audio']
    if len(video) != 1 or len(audio) != int(with_audio):
        return False
    stream = video[0]
    passed = (Fraction(metadata['format']['duration']) == DURATION and
              stream['codec_name'] == 'h264' and stream['width'] == 1920 and stream['height'] == 1080 and
              Fraction(stream['r_frame_rate']) == FPS and int(stream['nb_frames']) == FRAMES and
              Fraction(stream.get('start_time', '0')) == 0)
    if with_audio:
        passed = passed and (audio[0]['codec_name'] == 'aac' and int(audio[0]['sample_rate']) == SAMPLE_RATE and
                             audio[0]['channels'] == 2 and Fraction(audio[0].get('start_time', '-1')) == 0)
    return passed


def audit_media(picture, sound, master):
    records = []
    for path, expected, with_audio in ((picture, PICTURE_SHA256, False), (sound, SOUND_SHA256, True)):
        identity = digest_file(path)
        metadata = probe(path)
        delivery = json.loads((path.parent / 'delivery.json').read_text())
        validation = json.loads((path.parent / 'validation.json').read_text())
        validation_passed = (validation.get('passed') is True and validation.get('full_av_decode_passed') is True
                             if with_audio else validation.get('full_decode_passed') is True and
                             validation.get('frame_count') == FRAMES)
        delivery_passed = (delivery.get('status') == 'complete' and delivery.get('sha256') == expected and
                           delivery.get('duration_seconds') == DURATION and delivery.get('fps') == FPS and
                           delivery.get('bytes') == path.stat().st_size)
        records.append({'file': str(path), 'sha256': identity, 'expected_sha256': expected,
                        'probe': metadata, 'saved_delivery_passed': delivery_passed,
                        'saved_full_decode_validation_passed': validation_passed,
                        'passed': identity == expected and picture_format(metadata, with_audio) and
                        delivery_passed and validation_passed})
    metadata = probe(master)
    streams = metadata['streams']
    master_identity = digest_file(master)
    master_passed = (len(streams) == 1 and streams[0]['codec_type'] == 'audio' and
                     streams[0]['codec_name'] == 'pcm_s24le' and int(streams[0]['sample_rate']) == SAMPLE_RATE and
                     streams[0]['channels'] == 2 and int(streams[0]['bits_per_raw_sample']) == 24 and
                     int(streams[0]['duration_ts']) == DURATION * SAMPLE_RATE and
                     Fraction(streams[0]['time_base']) == Fraction(1, SAMPLE_RATE) and
                     Fraction(metadata['format']['duration']) == DURATION and master_identity == MASTER_SHA256)
    delivery = json.loads((sound.parent / 'delivery.json').read_text())
    validation = json.loads((sound.parent / 'validation.json').read_text())
    sync = json.loads((sound.parent / 'cue-sync.json').read_text())
    encoded = json.loads((sound.parent / 'encoded-sync-check.json').read_text())
    linkage_passed = (delivery.get('source_picture_sha256') == PICTURE_SHA256 and
                      delivery.get('picture_bitstream_identical') is True and
                      validation.get('picture_bitstream_identical') is True and
                      validation.get('master_samples') == DURATION * SAMPLE_RATE and
                      validation.get('cue_scheduling_passed') is True and
                      validation.get('decoded_audio_alignment_passed') is True and
                      validation.get('maximum_decoded_audio_lag_samples') == 0 and
                      sync.get('passed') is True and sync.get('effects_checked') == 75 and
                      sync.get('motion_gestures_checked') == 26 and sync.get('samples_per_frame') == 800 and
                      sync.get('maximum_scheduling_error_samples') == 0 and
                      sync.get('maximum_motion_boundary_error_samples') == 0 and
                      sync.get('sfx_snapped_to_music_grid') is False and
                      encoded.get('passed') is True and encoded.get('maximum_lag_samples') == 0)
    return {'passed': all(record['passed'] for record in records) and master_passed and linkage_passed,
            'media': records, 'master': {'file': str(master), 'sha256': master_identity,
                                        'expected_sha256': MASTER_SHA256, 'probe': metadata, 'passed': master_passed},
            'picture_audio_linkage_passed': linkage_passed,
            'decode_scope': 'ffprobe metadata only; full decode results are read from saved v18 validation, not rerun.',
            'missing_v17_media_required': False}


def section(operation):
    try:
        return operation()
    except (OSError, ValueError, KeyError, TypeError, IndexError, subprocess.SubprocessError) as error:
        details = {'passed': False, 'error': f'{type(error).__name__}: {error}'}
        if isinstance(error, subprocess.CalledProcessError):
            details['stderr'] = error.stderr[-4000:] if error.stderr else ''
        return details


def report_destination(output, protected):
    if output == '-':
        return None
    path = Path(output).resolve()
    if path.suffix.lower() != '.json' or not path.parent.is_dir():
        raise ValueError('--output must be a .json path with an existing parent, or - for stdout')
    if any(path == directory or directory in path.parents for directory in protected):
        raise ValueError('The report must not overwrite source, renderer, or frozen v18 delivery files')
    return path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=ROOT / 'quality/v19/src')
    parser.add_argument('--baseline', type=Path, default=ROOT / 'out/review/fusion-v18/source')
    parser.add_argument('--picture', type=Path, default=ROOT / 'out/review/fusion-v18/fusion-v18.mp4')
    parser.add_argument('--sound', type=Path, default=ROOT / 'out/review/fusion-v18-sound/fusion-v18-sound.mp4')
    parser.add_argument('--master', type=Path, default=ROOT / 'out/review/fusion-v18-sound/master-48k-24bit.wav')
    parser.add_argument('--contract', type=Path, default=ROOT / 'out/review/fusion-v18-sound/animation-cues.json')
    parser.add_argument('--new-picture', type=Path, help='Optional finished silent v19 MP4; metadata is checked, never encoded')
    parser.add_argument('--mux-output', type=Path, default=ROOT / 'out/review/fusion-v19-sound/fusion-v19-sound.mp4',
                        help='Report-only mux destination; no command is executed')
    parser.add_argument('--output', default='-', help='JSON report path; default - writes JSON to stdout only')
    arguments = parser.parse_args()
    paths = {name: getattr(arguments, name).resolve() for name in
             ('source', 'baseline', 'picture', 'sound', 'master', 'contract')}
    protected = [paths['source'], paths['baseline'].parent, paths['sound'].parent, ROOT / 'src', ROOT / 'render']
    if arguments.new_picture:
        protected.append(arguments.new_picture.resolve())
    try:
        output = report_destination(arguments.output, protected + list(paths.values()))
    except ValueError as error:
        parser.error(str(error))
    report = {'schema_version': 2, 'created_at': datetime.now(timezone.utc).isoformat(),
              'read_only_inputs': True, 'paths': {name: str(path) for name, path in paths.items()},
              'expected': {'duration_seconds': DURATION, 'fps': FPS, 'frames': FRAMES,
                           'sample_rate': SAMPLE_RATE, 'master_samples': DURATION * SAMPLE_RATE}}
    baseline = candidate = None
    try:
        baseline, candidate = read_tree(paths['baseline']), read_tree(paths['source'])
        report['sources'] = section(lambda: compare_sources(baseline, candidate))
        report['animation'] = section(lambda: audit_animation(
            paths['contract'], baseline, candidate, paths['baseline'], paths['source'],
            report['sources'].get('clock_modules_passed', False)))
    except (OSError, ValueError) as error:
        report['sources'] = {'passed': False, 'error': str(error)}
    report['v18_media'] = section(lambda: audit_media(paths['picture'], paths['sound'], paths['master']))
    if arguments.new_picture:
        def inspect_new_picture():
            metadata = probe(arguments.new_picture.resolve())
            return {'passed': picture_format(metadata, False), 'probe': metadata,
                    'sha256': digest_file(arguments.new_picture.resolve())}
        report['v19_picture'] = section(inspect_new_picture)
    if baseline is not None and candidate is not None:
        report['source_snapshot_stable'] = section(lambda: {
            'passed': read_tree(paths['baseline']) == baseline and read_tree(paths['source']) == candidate,
            'note': 'No locks are taken; concurrent source edits make this audit fail. Rerun after edits settle.',
        })
    check_names = ('sources', 'animation', 'source_snapshot_stable', 'v18_media')
    if arguments.new_picture:
        check_names += ('v19_picture',)
    report['passed'] = all(report.get(name, {}).get('passed') is True for name in check_names)
    report['status'] = 'PASS' if report['passed'] else 'FAIL'
    report['checks'] = []
    report['failures'] = []
    for name in check_names:
        check = report.setdefault(name, {'passed': False, 'error': 'Check was not completed'})
        check['status'] = 'PASS' if check.get('passed') is True else 'FAIL'
        report['checks'].append({'check': name, 'status': check['status']})
        if check.get('passed') is not True:
            report['failures'].append(f"{name}: {check.get('error') or check.get('runtime_skipped') or 'contract mismatch'}")
    for entry in report['sources'].get('files', []):
        if not entry['passed']:
            report['failures'].append(f"{entry['file']}: {'; '.join(entry['failure_reasons'])}")
    for name in report['sources'].get('missing', []):
        report['failures'].append(f'{name}: missing source file')
    picture_input = str(arguments.new_picture.resolve()) if arguments.new_picture else '<v19-silent-196s-1080p60.mp4>'
    mux_command = ['ffmpeg', '-n', '-i', picture_input, '-i', str(paths['sound']),
                   '-map', '0:v:0', '-map', '1:a:0', '-map_metadata', '-1', '-c:v', 'copy',
                   '-c:a', 'copy', str(arguments.mux_output.resolve())]
    report['master_reuse'] = {
        'eligible_by_checked_contract': report['passed'],
        'v19_picture_metadata_checked': bool(arguments.new_picture),
        'command_executed': False, 'mux_command_argv': mux_command, 'mux_command_shell': shlex.join(mux_command),
        'conditions': ['Render must use exactly the audited source snapshot, 196 seconds and 11760 frames at 60 fps.',
                       'No retiming, frame interpolation, changed motion timing, new narration, or music-grid snapping.',
                       'Copy the approved v18 AAC stream without re-encoding when timing is unchanged; use the lossless master only if a new mix is required.',
                       'After muxing, validate picture and audio packet identity, full AV decode, frame count and timestamps.',
                       'Preserve PIANO-LICENSE.txt, CREDITS.txt and instrument-provenance.json alongside delivery.'],
        'limitations': ['Visual allowlisted code is not proven semantically or perceptually equivalent.',
                        'Source anchors and clock equality do not replace final rendered-frame or subjective listening review.'],
    }
    serialized = json.dumps(report, ensure_ascii=False, indent=2) + '\n'
    if output:
        output.write_text(serialized, encoding='utf-8')
        print(f"{report['status']}: v19 source/audio contract; report={output}")
        for check in report['checks']:
            print(f"  {check['status']}: {check['check']}")
        for name in report['sources'].get('deterministic_opacity_state_fixes', []):
            print(f'  PASS: {name}: deterministic opacity-state fix; action_retimed=false')
        for failure in report['failures']:
            print(f'  reason: {failure}')
    else:
        sys.stdout.write(serialized)
    return 0 if report['passed'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
