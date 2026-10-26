import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CHAPTERS, SUBTITLES } from '../src/timeline.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const options = {}
const allowed = new Set(['shot', 'version', 'fps', 'workers', 'resume'])

for (let index = 2; index < process.argv.length; index += 2) {
  const name = process.argv[index].replace(/^--/, '')
  const value = process.argv[index + 1]
  if (!allowed.has(name) || !value || value.startsWith('--')) {
    throw new Error('用法：node render/review.mjs --shot prologue --version 1 --fps 60 --workers 4')
  }
  options[name] = value
}

const shotIndex = CHAPTERS.findIndex((chapter) => chapter.name === (options.shot ?? 'prologue'))
if (shotIndex < 0) throw new Error(`未知分镜：${options.shot}`)

const shot = CHAPTERS[shotIndex]
const fps = Number(options.fps ?? 60)
const workers = Number(options.workers ?? 4)
if (!Number.isInteger(fps) || fps < 1 || fps > 120) throw new Error('fps 必须是 1–120 的整数')
if (!Number.isInteger(workers) || workers < 1 || workers > 16) throw new Error('workers 必须是 1–16 的整数')

const reviewRoot = join(root, 'out', 'review')
const shotNumber = String(shotIndex + 1).padStart(2, '0')
const resume = options.resume === 'true'
if (options.resume && !resume) throw new Error('resume 必须是 true')
if (resume && !options.version) throw new Error('恢复渲染需要显式传入 --version')
let version = Number(options.version ?? 1)
if (!Number.isInteger(version) || version < 1) throw new Error('version 必须是正整数')

const folderName = (revision) => `shot-${shotNumber}-v${String(revision).padStart(2, '0')}`
if (!options.version) {
  while (existsSync(join(reviewRoot, folderName(version)))) version++
}

mkdirSync(reviewRoot, { recursive: true })
const output = join(reviewRoot, folderName(version))
if (resume) {
  if (!existsSync(output)) throw new Error(`待恢复目录不存在：${output}`)
  if (existsSync(join(output, 'shot.json'))) throw new Error('该版本已完成，请使用新版本号')
} else {
  mkdirSync(output)
}

function run(command, argumentsList) {
  const result = spawnSync(command, argumentsList, { cwd: root, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} 退出码：${result.status}`)
}

const frames = join(output, 'frames')
const first = Math.round(shot.start * fps)
const count = Math.round(shot.end * fps) - first
const duration = count / fps
const stem = folderName(version)
const videoName = `${stem}.mp4`
const videoPath = join(output, videoName)

const completeFrames = Array.from({ length: count }, (_, index) =>
  existsSync(join(frames, `f${String(first + index).padStart(6, '0')}.jpg`)),
).every(Boolean)
if (!resume || !completeFrames) {
  run(process.execPath, [
    'render/frames.mjs', '--only', shot.name, '--range', `${shot.start},${shot.end}`,
    '--fps', String(fps), '--workers', String(workers), '--out', frames,
  ])
}

for (let frameIndex = first; frameIndex < first + count; frameIndex++) {
  const framePath = join(frames, `f${String(frameIndex).padStart(6, '0')}.jpg`)
  if (!existsSync(framePath)) throw new Error(`缺少渲染帧：${framePath}`)
}

run('ffmpeg', [
  '-y', '-hide_banner', '-loglevel', 'warning', '-stats',
  '-framerate', String(fps), '-start_number', String(first),
  '-i', join(frames, 'f%06d.jpg'), '-frames:v', String(count),
  '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
  '-pix_fmt', 'yuv420p', '-g', String(fps * 2), '-movflags', '+faststart', videoPath,
])

run('ffmpeg', [
  '-y', '-hide_banner', '-loglevel', 'error', '-ss', String(duration * 0.6),
  '-i', videoPath, '-frames:v', '1', '-update', '1', join(output, 'poster.png'),
])

const sampleFrames = Array.from({ length: 6 }, (_, index) => Math.round(duration * fps * (index + 0.5) / 6))
const selection = sampleFrames.map((frameIndex) => `eq(n,${frameIndex})`).join('+')
run('ffmpeg', [
  '-y', '-hide_banner', '-loglevel', 'error', '-i', videoPath,
  '-vf', `select='${selection}',scale=640:360,tile=3x2`,
  '-frames:v', '1', '-update', '1', join(output, 'contact-sheet.png'),
])

const metadata = {
  shot: shot.name, title: shot.title, version, duration, fps, width: 1920, height: 1080,
  source: `src/shots/${shot.name}.js`, audio: '无音轨；本轮审阅画面与节奏',
  subtitles: SUBTITLES.filter((cue) => cue.a < shot.end && cue.b > shot.start)
    .map((cue) => ({ start: Math.max(0, cue.a - shot.start), end: Math.min(duration, cue.b - shot.start), text: cue.zh })),
}
cpSync(join(root, 'src'), join(output, 'source'), { recursive: true })
writeFileSync(join(output, 'shot.json'), JSON.stringify(metadata, null, 2) + '\n')
writeFileSync(join(output, 'index.html'), `<!doctype html>
<html lang="zh-CN">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>银龄智办 · 分镜 ${shotNumber} · V${version}</title>
<style>
body{margin:0;background:#10181e;color:#eef3f2;font:16px/1.7 system-ui,sans-serif}
main{max-width:1200px;margin:auto;padding:28px 24px}h1{font-size:24px;margin:0 0 8px}
p{color:#b5c7c2;margin:8px 0 20px}video{display:block;width:100%;background:#000;border-radius:12px}
nav{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:16px}
button{background:#1a7f6b;color:white;border:0;border-radius:8px;padding:10px 16px;font:inherit;cursor:pointer}
button:focus-visible{outline:3px solid #efc981;outline-offset:3px}output{font-variant-numeric:tabular-nums}
img{display:block;width:100%;margin-top:24px;border-radius:8px}a{color:#8dd9c7}
</style>
<main>
<h1>分镜 ${shotNumber} · ${shot.title} · V${version}</h1>
<p>${duration} 秒 / 1920 × 1080 / ${fps} fps · 无音轨，先审阅画面、字幕与节奏。动画概念示意，不是真机录屏。</p>
<video id="player" controls playsinline preload="metadata" poster="poster.png" src="${videoName}"></video>
<nav aria-label="审片工具">
<button type="button" id="replay">从头播放</button>
<button type="button" id="pause">暂停并查看时间</button>
<output id="time" aria-live="polite">0.00 秒 · 第 0 帧</output>
<a href="${videoName}" download>下载 MP4</a>
</nav>
<p>反馈示例：「第 8 秒标题太小」「前 3 秒再快一些」。本轮只修改这一镜，不自动推进下一镜。</p>
<img src="contact-sheet.png" alt="这一分镜按时间顺序排列的六张关键帧">
</main>
<script>
const player = document.getElementById('player')
const time = document.getElementById('time')
const update = () => { time.textContent = player.currentTime.toFixed(2) + ' 秒 · 第 ' + Math.floor(player.currentTime * ${fps}) + ' 帧' }
player.addEventListener('timeupdate', update)
player.addEventListener('seeked', update)
document.getElementById('replay').addEventListener('click', () => { player.currentTime = 0; player.play() })
document.getElementById('pause').addEventListener('click', () => { player.pause(); update() })
</script>
</html>
`)
console.log(`\n分镜已输出：${videoPath}\n审片页面：${join(output, 'index.html')}`)
