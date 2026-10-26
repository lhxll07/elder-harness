import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CHAPTERS, SUBTITLES } from '../src/timeline.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const options = { version: 2, workers: 2 }
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index].replace(/^--/, '')
  if (!['version', 'workers'].includes(key)) throw new Error(`未知参数 ${key}`)
  const value = Number(process.argv[index + 1])
  if (!Number.isInteger(value) || value < 1 || key === 'workers' && value > 8) throw new Error(`参数无效 ${key}`)
  options[key] = value
}
const shots = CHAPTERS.filter((chapter) => chapter.start >= 44 && chapter.end <= 206)
const fps = 60
const start = shots[0].start
const end = shots.at(-1).end
const first = start * fps
const count = (end - start) * fps
const stem = `sequence-03-10-v${String(options.version).padStart(2, '0')}`
const output = join(root, 'out', 'review', stem)
if (existsSync(output)) throw new Error(`保留已有版本，不覆盖：${output}`)
const cues = SUBTITLES.filter((cue) => cue.a < end && cue.b > start)
if (shots.length !== 8 || shots.some((shot, index) => index && shot.start !== shots[index - 1].end)) throw new Error('修改分镜必须连续')
if (cues.some((cue, index) => cue.b <= cue.a || index && cue.a < cues[index - 1].b)) throw new Error('字幕时间无效或重叠')
mkdirSync(output, { recursive: true })
for (const folder of ['src', 'render', 'docs', 'assets']) cpSync(join(root, folder), join(output, folder === 'src' ? 'source' : folder), { recursive: true })
const frames = join(output, 'frames')
const video = join(output, `${stem}.mp4`)
writeFileSync(join(output, 'film.json'), JSON.stringify({
  version: options.version, baseline: 'film-v16', start, end, duration: end - start,
  fps, frames: count, width: 1920, height: 1080,
  render: { width: 1920, height: 1080, scale: 1 },
  shots, subtitles: cues, audio: '无音轨，画面与字幕审阅版',
  disclaimer: '医院页面与空间折叠为机制示意。提交由本人完成，业务状态为已提交、待医院确认。候选经验待实机验证。',
}, null, 2) + '\n')

function run(command, argumentsList) {
  const result = spawnSync(command, argumentsList, { cwd: root, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} 退出码 ${result.status}`)
}

run(process.execPath, ['render/frames.mjs', '--only', shots.map((shot) => shot.name).join(','), '--range', `${start},${end}`, '--fps', String(fps), '--workers', String(options.workers), '--render-scale', '1', '--quality', '96', '--out', frames])
for (let index = first; index < first + count; index++) {
  if (!existsSync(join(frames, `f${String(index).padStart(6, '0')}.jpg`))) throw new Error(`缺少帧 ${index}`)
}
run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'warning', '-stats', '-framerate', String(fps), '-start_number', String(first), '-i', join(frames, 'f%06d.jpg'), '-frames:v', String(count), '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-g', '120', '-movflags', '+faststart', video])
run('python3', ['render/validate.py', output])
console.log(`\n修改段连续成片：${video}`)
