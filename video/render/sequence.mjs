import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CHAPTERS, SUBTITLES } from '../src/timeline.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const options = {}
for (let index = 2; index < process.argv.length; index += 2) {
  const name = process.argv[index].replace(/^--/, '')
  const value = process.argv[index + 1]
  if (!['version', 'fps', 'workers'].includes(name) || !value || value.startsWith('--')) {
    throw new Error('用法：node render/sequence.mjs --version 1 --fps 60 --workers 2')
  }
  options[name] = Number(value)
}

const fps = options.fps ?? 60
const workers = options.workers ?? 2
let version = options.version ?? 1
if (!Number.isInteger(fps) || fps < 1 || fps > 120) throw new Error('fps 必须是 1–120 的整数')
if (!Number.isInteger(workers) || workers < 1 || workers > 16) throw new Error('workers 必须是 1–16 的整数')
if (!Number.isInteger(version) || version < 1) throw new Error('version 必须是正整数')

const shots = CHAPTERS.filter((chapter) => ['prologue', 'voice', 'observe'].includes(chapter.name))
if (shots.length !== 3 || shots.some((shot, index) => index > 0 && shot.start !== shots[index - 1].end)) {
  throw new Error('前三镜必须连续，不能夹入占位章节')
}
const reviewRoot = join(root, 'out', 'review')
const folderName = (revision) => `sequence-01-03-v${String(revision).padStart(2, '0')}`
if (options.version === undefined) {
  while (existsSync(join(reviewRoot, folderName(version)))) version++
}
mkdirSync(reviewRoot, { recursive: true })
const stem = folderName(version)
const output = join(reviewRoot, stem)
mkdirSync(output)
const frames = join(output, 'frames')
const first = Math.round(shots[0].start * fps)
const count = Math.round(shots.at(-1).end * fps) - first
const duration = count / fps
const videoPath = join(output, `${stem}.mp4`)

function run(command, argumentsList) {
  const result = spawnSync(command, argumentsList, { cwd: root, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} 退出码：${result.status}`)
}

run(process.execPath, [
  'render/frames.mjs', '--only', shots.map((shot) => shot.name).join(','),
  '--range', `${shots[0].start},${shots.at(-1).end}`, '--fps', String(fps),
  '--workers', String(workers), '--out', frames,
])
for (let index = first; index < first + count; index++) {
  if (!existsSync(join(frames, `f${String(index).padStart(6, '0')}.jpg`))) throw new Error(`缺少帧 ${index}`)
}
run('ffmpeg', [
  '-y', '-hide_banner', '-loglevel', 'warning', '-stats', '-framerate', String(fps),
  '-start_number', String(first), '-i', join(frames, 'f%06d.jpg'), '-frames:v', String(count),
  '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
  '-g', String(fps * 2), '-movflags', '+faststart', videoPath,
])
const samples = Array.from({ length: 12 }, (_, index) => Math.floor(count * (index + 0.5) / 12))
run('ffmpeg', [
  '-y', '-hide_banner', '-loglevel', 'error', '-i', videoPath,
  '-vf', `select='${samples.map((index) => `eq(n,${index})`).join('+')}',scale=480:270,tile=4x3`,
  '-frames:v', '1', '-update', '1', join(output, 'contact-sheet.png'),
])
cpSync(join(root, 'src'), join(output, 'source'), { recursive: true })
cpSync(join(root, 'render'), join(output, 'render'), { recursive: true })
cpSync(join(root, 'docs'), join(output, 'docs'), { recursive: true })
writeFileSync(join(output, 'sequence.json'), JSON.stringify({
  version, duration, fps, frames: count, width: 1920, height: 1080,
  audio: '无音轨；审阅连续画面、字幕与节奏',
  shots: shots.map(({ name, title, start, end }) => ({ name, title, start, end })),
  subtitles: SUBTITLES.filter((cue) => cue.a < shots.at(-1).end && cue.b > shots[0].start),
  disclaimer: '医院页面与控件编号为动画概念示意，不是真机录屏或预约完成证据。',
}, null, 2) + '\n')
console.log(`\n前三镜连续精修版：${videoPath}`)
