import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CHAPTERS, SUBTITLES, DURATION } from '../src/timeline.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const options = {}
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index].replace(/^--/, '')
  const value = process.argv[index + 1]
  if (!['version', 'fps', 'workers', 'gpu', 'render-scale'].includes(key) || !value || value.startsWith('--')) {
    throw new Error('用法：node render/film.mjs --version 1 --fps 60 --workers 1 --gpu angle-vulkan --render-scale 2')
  }
  options[key] = key === 'gpu' ? value : Number(value)
}
const fps = options.fps ?? 60
const workers = options.workers ?? 1
const gpu = options.gpu ?? 'angle-vulkan'
const renderScale = options['render-scale'] ?? 1
if (!Number.isFinite(renderScale) || renderScale < 1 || renderScale > 2) throw new Error('--render-scale 必须介于 1 和 2 之间')
const renderWidth = Math.round(1920 * renderScale / 2) * 2
const renderHeight = Math.round(1080 * renderScale / 2) * 2
let version = options.version ?? 1
for (const [key, value, maximum] of [['fps', fps, 120], ['workers', workers, 16], ['version', version, 9999]]) {
  if (!Number.isInteger(value) || value < 1 || value > maximum) throw new Error(`${key} 必须为 1–${maximum} 的整数`)
}
if (CHAPTERS[0].start !== 0 || CHAPTERS.some((chapter, index) => chapter.end <= chapter.start || index > 0 && chapter.start !== CHAPTERS[index - 1].end)) {
  throw new Error('时间轴必须从零开始、连续且非空')
}
const cues = [...SUBTITLES].sort((first, second) => first.a - second.a)
if (cues.some((cue, index) => cue.b <= cue.a || cue.a < 0 || cue.b > DURATION || index > 0 && cue.a < cues[index - 1].b)) {
  throw new Error('字幕存在无效时间或重叠')
}
const reviewRoot = join(root, 'out', 'review')
const folderName = (revision) => `film-v${String(revision).padStart(2, '0')}`
if (options.version === undefined) while (existsSync(join(reviewRoot, folderName(version)))) version++
const stem = folderName(version)
const output = join(reviewRoot, stem)
if (existsSync(output)) throw new Error(`版本已存在，保留旧片：${output}`)
mkdirSync(output, { recursive: true })
const frames = join(output, 'frames')
const count = Math.round(DURATION * fps)
const videoPath = join(output, `${stem}.mp4`)
cpSync(join(root, 'src'), join(output, 'source'), { recursive: true })
cpSync(join(root, 'render'), join(output, 'render'), { recursive: true })
cpSync(join(root, 'docs'), join(output, 'docs'), { recursive: true })
cpSync(join(root, 'assets'), join(output, 'assets'), { recursive: true })
writeFileSync(join(output, 'film.json'), JSON.stringify({
  version, duration: count / fps, fps, frames: count, width: 1920, height: 1080, gpu, workers,
  render: { width: renderWidth, height: renderHeight, scale: renderScale, downsample: 'Lanczos 3 → 1920×1080', frameQuality: renderScale > 1 ? 96 : 94 },
  audio: '无音轨；审阅连续画面、字幕与节奏',
  capture: '独占离屏 RGBA8 render target，非浏览器显示 framebuffer',
  shots: CHAPTERS, subtitles: SUBTITLES,
  disclaimer: '医院、医生、时间、费用与控件编号均为动画概念示意，不是真机录屏或预约成功证据。家人网页采用真实模板和示例数据，端到端实机协作未验证。T2 实机回归尚待执行。',
}, null, 2) + '\n')

function run(command, argumentsList) {
  const result = spawnSync(command, argumentsList, { cwd: root, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} 退出码：${result.status}`)
}

run(process.execPath, ['render/frames.mjs', '--fps', String(fps), '--workers', String(workers), '--gpu', gpu, '--render-scale', String(renderScale), '--quality', renderScale > 1 ? '96' : '94', '--out', frames])
for (let index = 0; index < count; index++) {
  const frame = join(frames, `f${String(index).padStart(6, '0')}.jpg`)
  if (!existsSync(frame) || statSync(frame).size === 0) throw new Error(`缺少或空白帧 ${index}`)
}
run('ffmpeg', [
  '-y', '-hide_banner', '-loglevel', 'warning', '-stats', '-framerate', String(fps),
  '-start_number', '0', '-i', join(frames, 'f%06d.jpg'), '-frames:v', String(count),
  '-an', '-vf', 'scale=1920:1080:flags=lanczos:in_range=pc:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709,setsar=1,format=yuv420p',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
  '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
  '-g', String(fps * 2), '-movflags', '+faststart', videoPath,
])
run('python3', ['render/validate.py', output])
console.log(`\n整片完整渲染与编码：${videoPath}`)
