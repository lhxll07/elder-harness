import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { editAt, editTime } from '../out/review/fusion-v18/source/fusion-edit.js'
import { compilerTime, openingTime, runtimeTime, memoryTime } from '../out/review/fusion-v18/source/fusion-script.js'
import { voiceStoryTime } from '../out/review/fusion-v18/source/voice-timing.js'

const contract = JSON.parse(execFileSync(process.execPath, [fileURLToPath(new URL('animation-sound-cues-v18.mjs', import.meta.url))], { encoding: 'utf8' }))
const gestures = []

function clockAt(frame, clock) {
  const actual = frame / 60
  const source = editTime(actual)
  if (clock === 'compiler') return compilerTime(source)
  if (clock === 'runtime') return runtimeTime(source)
  if (clock === 'memory') return memoryTime(source)
  if (clock === 'voice') return voiceStoryTime(openingTime(source) - 16)
  if (clock === 'detail') return actual - editAt(actual).start
  return source
}

function motion(number, start, duration, texture, gain, direction = 1) {
  const cue = contract.cues.find(entry => entry.id === `cue-${String(number).padStart(3, '0')}`)
  if (!cue) throw new Error(`Missing motion cue ${number}`)
  const frames = []
  const edit = editAt(cue.time)
  for (let frame = Math.max(0, cue.target_frame - 360); frame <= Math.min(11759, cue.target_frame + 360); frame++) {
    if (cue.source_clock === 'detail' && editAt(frame / 60).name !== edit.name) continue
    frames.push({ frame, clock: clockAt(frame, cue.source_clock) })
  }
  const nearest = target => frames.reduce((best, entry) => {
    const error = Math.abs(entry.clock - target)
    return !best || error < best.error - 1e-8 || (Math.abs(error - best.error) < 1e-8 && Math.abs(entry.frame - cue.target_frame) < Math.abs(best.frame - cue.target_frame))
      ? { ...entry, error } : best
  }, null)
  const first = nearest(start)
  const last = nearest(start + duration)
  if (first.error > 0.08 || last.error > 0.08 || last.frame <= first.frame) throw new Error(`Unreachable motion span: ${cue.label}`)
  const samples = frames.filter(entry => entry.frame >= first.frame && entry.frame <= last.frame).map(entry => {
    const phase = Math.max(0, Math.min(1, (entry.clock - start) / duration))
    return { frame: entry.frame, progress: phase * phase * (3 - 2 * phase) }
  })
  samples[0].progress = 0
  samples.at(-1).progress = 1
  for (let index = 0; index < samples.length; index++) {
    const before = samples[Math.max(0, index - 1)]
    const after = samples[Math.min(samples.length - 1, index + 1)]
    samples[index].velocity = (after.progress - before.progress) * 60 / (after.frame - before.frame)
  }
  if (samples.some(entry => entry.velocity < -1e-8)) throw new Error(`Reversed animation clock: ${cue.label}`)
  gestures.push({ cue_id: cue.id, label: cue.label, source_file: cue.source_file, source_expression: cue.source_expression,
    source_clock: cue.source_clock, source_start: start, source_duration: duration,
    start_frame: first.frame, end_frame: last.frame, boundary_clock_error: Math.max(first.error, last.error),
    texture, gain, direction, pan: cue.pan ?? 0, samples })
}

motion(1, 2.8, 3.0, 'silk', 0.024)
motion(8, 9.0, 1.7, 'fold', 0.034, -1)
motion(10, 10.85, 1.0, 'silk', 0.017)
motion(12, 3.25, 2.0, 'breath', 0.020)
motion(14, 8.05, 0.4, 'breath', 0.015)
motion(16, 12.10, 1.15, 'thread', 0.019)
motion(22, 20.0, 2.4, 'thread', 0.016)
for (let index = 0; index < 6; index++) motion(24 + index * 2, 25.45 + index * 0.16, 3.0, 'thread', 0.008)
motion(36, 32.1, 2.6, 'fold', 0.028, -1)
motion(38, 41.4, 2.2, 'silk', 0.023)
motion(39, 44.8, 2.6, 'paper', 0.019)
motion(42, 97.1, 1.8, 'paper', 0.019)
motion(44, 3.0, 0.75, 'silk', 0.014)
motion(46, 106.2, 1.8, 'paper', 0.024)
motion(53, 85.0, 1.8, 'felt', 0.014)
motion(54, 88.2, 1.8, 'breath', 0.015)
motion(58, 135.7, 2.1, 'paper', 0.025)
motion(62, 151.0, 3.6, 'thread', 0.022)
motion(68, 7.1, 0.65, 'fold', 0.021, -1)
motion(71, 181.7, 1.5, 'fold', 0.021, -1)
motion(75, 181.7, 2.6, 'silk', 0.030, -1)

console.log(JSON.stringify({ ...contract, sound_revision: 4, gestures,
  motion_basis: 'Per-frame smooth01 progress and its derivative, evaluated using frozen animation clocks; not musical beats' }))
