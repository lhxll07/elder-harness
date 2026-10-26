// Encode the rendered frames into the deliverable.
//
//   node render/encode.mjs                       # master + web, 60fps
//   node render/encode.mjs --fps 30              # if frames were rendered at 30
//   node render/encode.mjs --crf 16 --preset slow
//   node render/encode.mjs --audio assets/vo.mp3
//   node render/encode.mjs --srt                 # write the cue sheet only
//   node render/encode.mjs --in out/frames --out out/film
//
// The frame set is checked before ffmpeg is handed anything. A missing frame in
// the middle of the sequence does not fail ffmpeg — it silently shifts every
// frame after it one slot earlier, and the film keeps going, out of sync with
// its own subtitles, for the rest of its length. That failure is worth a
// pre-flight pass rather than a discovery in review.

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, writeFileSync, statSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DURATION, SUBTITLES } from '../src/timeline.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')

const args = parseArgs(process.argv.slice(2))
const FPS = Number(args.fps ?? 60)
const IN = resolve(ROOT, String(args.in ?? 'out/frames'))
const OUT = resolve(ROOT, String(args.out ?? 'out/film'))
const EXT = String(args.ext ?? 'jpg')
const CRF = Number(args.crf ?? 18)
const PRESET = String(args.preset ?? 'slow')
const AUDIO = args.audio ? resolve(ROOT, String(args.audio)) : null

if (args.srt) {
  writeSrt()
  process.exit(0)
}

if (!existsSync(IN)) fail(`no frame directory at ${IN}\nrun: node render/frames.mjs`)

// ── Pre-flight: the frame set must be one contiguous run from zero. ─────────
const files = readdirSync(IN).filter((f) => f.startsWith('f') && f.endsWith('.' + EXT))
const indices = files.map((f) => Number(f.slice(1, f.indexOf('.')))).sort((a, b) => a - b)
if (!indices.length) fail(`no .${EXT} frames in ${IN}`)

if (indices[0] !== 0) {
  fail(`frame sequence starts at ${indices[0]}, not 0 — the first ${indices[0]} frames are missing`)
}

const gaps = []
for (let i = 1; i < indices.length; i++) {
  if (indices[i] !== indices[i - 1] + 1) gaps.push([indices[i - 1] + 1, indices[i] - 1])
}

const last = indices[indices.length - 1]
const expected = Math.round(DURATION * FPS)

if (gaps.length) {
  // A gap is a hard stop: encoding it produces a film with a splice in it.
  const [a, b] = gaps[0]
  fail(
    `frame sequence has ${gaps.length} gap(s); first is ${a}..${b} (${(a / FPS).toFixed(1)}s–${(b / FPS).toFixed(1)}s)\n` +
      `  fill it with: node render/frames.mjs --range ${(a / FPS).toFixed(1)},${((b + 1) / FPS).toFixed(1)}`,
  )
}

const count = last + 1
const filmSeconds = count / FPS

if (count < expected) {
  // A short tail is a warning, not an error: `--range` renders are legitimately
  // short, and the encoder's job is to say what it is about to do, not to stop
  // the user from doing it on purpose.
  console.log(
    `注意：序列止于第 ${last} 帧（${(last / FPS).toFixed(2)}s），正片全长 ${DURATION}s。\n` +
      `      将编码出 ${filmSeconds.toFixed(2)}s 的成片；若这不是刻意只渲了一段，请补渲 ${((expected - count) / FPS).toFixed(1)}s。\n`,
  )
}

const totalBytes = indices.reduce((n, i) => n + statSync(join(IN, `f${pad(i)}.${EXT}`)).size, 0)

console.log(`帧序列  ${count} 帧 @ ${FPS}fps = ${filmSeconds.toFixed(2)}s`)
console.log(`来源    ${IN}`)
console.log(`体积    ${(totalBytes / 1024 / 1024).toFixed(0)} MB (${EXT})\n`)

mkdirSync(OUT, { recursive: true })

const pattern = join(IN, `f%06d.${EXT}`)
const targets = [
  {
    name: '母版',
    file: join(OUT, 'yinling-master.mp4'),
    args: [
      '-c:v', 'libx264', '-preset', PRESET, '-crf', String(CRF),
      '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.2',
      // Keyframe every two seconds: the coda holds on a still frame for 1.5s and
      // a GOP longer than that makes seeking into the ending visibly chunky.
      '-g', String(FPS * 2), '-movflags', '+faststart',
    ],
  },
  {
    name: '网页投递版',
    file: join(OUT, 'yinling-web.mp4'),
    args: [
      '-c:v', 'libx264', '-preset', 'medium', '-crf', String(CRF + 6),
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    ],
  },
]

for (const t of targets) {
  const argv = [
    '-y', '-hide_banner', '-loglevel', 'warning', '-stats',
    '-framerate', String(FPS),
    '-start_number', '0',
    '-i', pattern,
  ]
  if (AUDIO) argv.push('-i', AUDIO)
  argv.push(...t.args)
  // Audio is optional and never required: the film carries its information in
  // burned-in subtitles, so a missing track costs nothing but ambience.
  if (AUDIO) argv.push('-c:a', 'aac', '-b:a', '192k', '-shortest')
  else argv.push('-an')
  argv.push(t.file)

  process.stdout.write(`\n${t.name} → ${t.file.replace(ROOT + '/', '')}\n`)
  const r = spawnSync('ffmpeg', argv, { stdio: 'inherit' })
  if (r.status !== 0) fail(`ffmpeg failed on ${t.name} (exit ${r.status})`)

  const written = statSync(t.file)
  const kbps = (written.size * 8) / filmSeconds / 1000
  console.log(`  ${(written.size / 1024 / 1024).toFixed(1)} MB · ${kbps.toFixed(0)} kbps`)
}

writeSrt()

function writeSrt() {
  mkdirSync(OUT, { recursive: true })
  const path = join(OUT, 'yinling.srt')
  writeFileSync(path, buildSrt(SUBTITLES), 'utf8')
  console.log(`\n字幕 → ${path.replace(ROOT + '/', '')}`)
}

/**
 * A sidecar for review and for platforms that want one. The film's own
 * subtitles are burned into the frames by `src/subtitles.js`; both come from
 * `SUBTITLES` in the timeline, so the two cannot drift apart.
 */
function buildSrt(cues) {
  return (
    cues
      .map((c, i) => `${i + 1}\n${tc(c.a)} --> ${tc(c.b)}\n${c.zh}\n${c.en}\n`)
      .join('\n') + '\n'
  )
}

/** Seconds -> `HH:MM:SS,mmm`. */
function tc(sec) {
  const ms = Math.round(sec * 1000)
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${p2(h)}:${p2(m)}:${p2(s)},${String(ms % 1000).padStart(3, '0')}`
}

function p2(n) {
  return String(n).padStart(2, '0')
}

function pad(n) {
  return String(n).padStart(6, '0')
}

function fail(msg) {
  console.error(`\n编码中止：${msg}\n`)
  process.exit(1)
}

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) continue
    const key = a.slice(2)
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) out[key] = true
    else {
      out[key] = isNaN(Number(next)) ? next : Number(next)
      i++
    }
  }
  return out
}
