import { spawnSync } from 'node:child_process'
import { constants, copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DURATION, BEATS, CUES } from '../src/compiler-script.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const options = { version: 1, workers: 2, from: 0, reuse: null }
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index].replace(/^--/, '')
  if (key === 'reuse') {
    const value = process.argv[index + 1]
    if (!/^compiler-v\d+$/.test(value ?? '')) throw new Error('复用版本名称无效')
    options.reuse = value
    continue
  }
  const value = Number(process.argv[index + 1])
  if (!['version', 'workers', 'from'].includes(key) || !Number.isFinite(value) || (key === 'from' ? value < 0 || value >= DURATION : !Number.isInteger(value) || value < 1) || key === 'workers' && value > 4) throw new Error(`参数无效：${key}`)
  options[key] = value
}
if (Boolean(options.reuse) !== (options.from > 0)) throw new Error('--reuse 与大于零的 --from 必须同时提供')
const stem = `compiler-v${String(options.version).padStart(2, '0')}`
const output = join(root, 'out', 'review', stem)
if (existsSync(output)) throw new Error(`不覆盖已有版本：${output}`)
const fps = 60
const count = DURATION * fps
const first = Math.round(options.from * fps)
const baseline = options.reuse ? join(root, 'out', 'review', options.reuse) : null
if (baseline) {
  const metadata = JSON.parse(readFileSync(join(baseline, 'film.json'), 'utf8'))
  if (metadata.fps !== fps || metadata.render?.width !== 1920 || metadata.render?.height !== 1080 || metadata.frames < first) throw new Error('复用源的帧率、分辨率或时长不兼容')
  for (let frame = 0; frame < first; frame++) {
    if (!existsSync(join(baseline, 'frames', `f${String(frame).padStart(6, '0')}.jpg`))) throw new Error(`复用源缺帧：${frame}`)
  }
}
mkdirSync(output, { recursive: true })
for (const folder of ['src', 'render', 'docs', 'assets']) cpSync(join(root, folder), join(output, folder === 'src' ? 'source' : folder), { recursive: true })
cpSync(join(root, 'compiler.html'), join(output, 'compiler.html'))
const frames = join(output, 'frames')
mkdirSync(frames, { recursive: true })
if (baseline) {
  for (let frame = 0; frame < first; frame++) {
    const filename = `f${String(frame).padStart(6, '0')}.jpg`
    copyFileSync(join(baseline, 'frames', filename), join(frames, filename), constants.COPYFILE_FICLONE)
  }
  console.log(`复用 ${options.reuse} 的前 ${first / fps} 秒；仅渲染 ${first / fps}—${DURATION} 秒。`)
}
writeFileSync(join(output, 'film.json'), JSON.stringify({
  version: options.version, title: '为人编译', baseline: options.reuse ?? 'film-v16（原文件保留）',
  entry: 'compiler.html', start: 0, end: DURATION, duration: DURATION, fps, frames: count,
  width: 1920, height: 1080, render: { width: 1920, height: 1080, scale: 1 },
  reusedFrames: first, renderedRange: [first / fps, DURATION],
  shots: BEATS, subtitles: CUES, structure: '重写核心叙事的独立完整样片，不拼接旧八章。节拍不在影片中分章。',
  audio: '无音轨，画面与字幕审阅版',
  note: '编译、试印和透片合版均为核验依据关系的视觉解释，不表示传统编译器、字形比对或自动删词。核验段用同一页面对照两种候选说法，不表示真实运行先误报、再自动改写。医院信息为示例，家人端为项目现有页面素材。本人提交，结论为已提交、待医院确认。',
}, null, 2) + '\n')

function run(command, argumentsList) {
  const result = spawnSync(command, argumentsList, { cwd: root, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} 退出码 ${result.status}`)
}

run(process.execPath, ['render/frames.mjs', '--entry', 'compiler.html', '--duration', String(DURATION), '--range', `${first / fps},${DURATION}`, '--fps', String(fps), '--workers', String(options.workers), '--render-scale', '1', '--quality', '96', '--out', frames])
for (let frame = 0; frame < count; frame++) {
  if (!existsSync(join(frames, `f${String(frame).padStart(6, '0')}.jpg`))) throw new Error(`缺帧：${frame}`)
}
run('ffmpeg', [
  '-y', '-hide_banner', '-loglevel', 'warning', '-stats', '-framerate', String(fps), '-start_number', '0', '-i', join(frames, 'f%06d.jpg'),
  '-frames:v', String(count), '-an', '-vf', 'scale=iw:ih:in_range=pc:out_range=tv,format=yuv420p',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-color_range', 'tv', '-g', '120', '-movflags', '+faststart', join(output, `${stem}.mp4`),
])
run('python3', ['render/validate.py', output])
console.log(`\n完整新叙事样片：${join(output, `${stem}.mp4`)}`)
