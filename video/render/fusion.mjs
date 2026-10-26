import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, writeFileSync, readFileSync, linkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { VERSION, DURATION, BEATS, CUES } from '../src/fusion-script.js'
import { SCENOGRAPHY, SCENERY_TRANSITION } from '../src/fusion-scenery.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const workers = Number(process.argv[2] ?? 2)
if (!Number.isInteger(workers) || workers < 1 || workers > 4) throw new Error('workers 必须介于 1 和 4')
if (DURATION <= 180) throw new Error('整片必须严格超过 3 分钟，禁止用不足 180 秒的时间轴交付')
const option = name => {
  const index = process.argv.indexOf(name)
  return index === -1 ? null : process.argv[index + 1]
}
const renderScale = Number(option('--render-scale') ?? 2)
if (renderScale !== 2) throw new Error('最终版必须使用原生 4K 渲染，再降采样导出 1080p')
if (workers > 2) throw new Error('4K 渲染最多使用两个工作进程，防止显存不足导致黑帧')
const reuseFrom = option('--reuse-from')
const reuseUntil = Number(option('--reuse-until') ?? 0)
const reuseAfter = Number(option('--reuse-after') ?? DURATION)
const reuseTailFrom = Number(option('--reuse-tail-from') ?? reuseAfter)
const preflight = option('--preflight')
if (preflight) {
  const check = JSON.parse(readFileSync(join(root, preflight, 'check.json'), 'utf8'))
  if (check.failureCount || check.error || check.determinism.some(entry => !entry.passed) || check.render?.[0] !== 3840 || check.render?.[1] !== 2160) throw new Error('4K 预检未通过')
}
if (!Number.isFinite(reuseUntil) || reuseUntil < 0 || reuseUntil >= DURATION || reuseUntil && !BEATS.some(beat => beat.start === reuseUntil)) throw new Error('复用终点必须是有效的完整分镜边界')
if (Boolean(reuseFrom) !== Boolean(reuseUntil) || reuseFrom && !/^fusion-v\d+$/.test(reuseFrom)) throw new Error('同时指定有效的 --reuse-from 与 --reuse-until')
if (!Number.isFinite(reuseAfter) || reuseAfter <= reuseUntil || reuseAfter > DURATION || reuseAfter < DURATION && (!reuseFrom || !BEATS.some(beat => beat.start === reuseAfter))) throw new Error('尾段复用起点必须是有效的完整分镜边界')
if (!Number.isFinite(reuseTailFrom) || reuseTailFrom < reuseUntil || !Number.isInteger(reuseTailFrom * 60)) throw new Error('源片尾起点必须是有效帧边界')
const stem = `fusion-v${String(VERSION).padStart(2, '0')}`
const output = join(root, 'out', 'review', stem)
if (existsSync(output)) throw new Error(`不覆盖旧版：${output}`)
mkdirSync(output, { recursive: true })
for (const folder of ['src', 'render', 'docs', 'assets']) cpSync(join(root, folder), join(output, folder === 'src' ? 'source' : folder), { recursive: true })
cpSync(join(root, 'fusion.html'), join(output, 'fusion.html'))
if (preflight) cpSync(join(root, preflight), join(output, 'preflight-4k'), { recursive: true })
const frames = join(output, 'frames')
const fps = 60
const count = DURATION * fps
writeFileSync(join(output, 'film.json'), JSON.stringify({
  version: VERSION, title: '银龄智办 · 为人编译', duration: DURATION, minimumDurationExclusive: 180, fps, frames: count,
  width: 1920, height: 1080, render: { width: 3840, height: 2160, scale: renderScale, canvas2D: 'software', webGL: 'ANGLE/EGL', downsample: 'Lanczos 4K → 1080p' },
  entry: 'fusion.html', baseline: ['film-v16', 'compiler-v02'], shots: BEATS, subtitles: CUES,
  audio: '无音轨；完整画面与字幕节奏审阅版',
  structure: '196 秒。v18 定版：保留 v16/v17 的叙事、剪辑、页面、材质与自然微晃，修复结尾手机压栏、读表记录回位、字幕字速与安全区、幽灵字叠层与裁字、提交段重复文案；新增 35–40 秒全幅暂停节拍、结尾留白与真机实验标注。以深蓝引子、靛蓝架构光廊、玉灰编译层叠台、暖灰家人双窗、青灰取景窗、蓝绿核验光井、鼠尾草提炼折面、石墨验证阶梯台、玉绿采用与深蓝收束体现章节递进。全片原生 4K 渲染 11760 帧，Lanczos 降采样导出 1080p60。此版仍无音轨，声音版本另存。',
  scenography: { chapters: SCENOGRAPHY, transitionSeconds: SCENERY_TRANSITION, technique: '无拟物道具的程序化光影空间；连续换章、轻视差、字幕净区；不新增机制或产品能力声明' },
  reused: reuseFrom ? { version: reuseFrom, ranges: [[0, reuseUntil], ...(reuseAfter < DURATION ? [[reuseAfter, DURATION]] : [])], tailSourceStart: reuseTailFrom, tailOffset: reuseTailFrom - reuseAfter, method: '复用未修改的完整分镜原生帧；片尾按时间偏移映射；当前源对照检查见 composition-check.json' } : null,
  note: '机制可视化，非实机录像。示例医院、医生、时间、费用。编译、折叠、阅读尺和证据支撑均为解释性物象。阅读方法辅助模型，不是确定性解析器。家人提供线索，由本人确认；提交由本人完成。挂号最终状态为已提交、待医院确认。本地通过后才进入独立模型复核；对照示意不表示真实误报。经验段独立标注流程示意与虚拟数据，技巧页按现有界面操作重排以适配宽屏，v3、契约缩写与运行结果仅演示准入流程，不是实测成绩。不声称本次任务已完成、已生成候选或已通过验证。须在任务完成且本人确认后提炼候选；独立验证报告绑定契约版本，由本机核算，通过后家人选择采用。无自动发布或真实泛化收益声明。旧版本不修改。',
}, null, 2) + '\n')

function run(command, argumentsList) {
  const result = spawnSync(command, argumentsList, { cwd: root, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} 退出码 ${result.status}`)
}

run(process.execPath, ['render/fusion-finish-check.mjs', join(output, 'motion-check.json')])
run(process.execPath, ['render/fusion-scenery-check.mjs', join(output, 'scenery-check.json')])

if (reuseFrom) {
  const base = join(root, 'out', 'review', reuseFrom)
  const metadata = JSON.parse(readFileSync(join(base, 'film.json'), 'utf8'))
  if (metadata.render?.scale !== renderScale || metadata.fps !== fps || metadata.width !== 1920 || metadata.height !== 1080 || metadata.duration < reuseUntil || reuseAfter < DURATION && (metadata.duration - reuseTailFrom !== DURATION - reuseAfter || !metadata.shots.some(shot => shot.start === reuseTailFrom))) throw new Error('复用版本的规格或片尾长度不匹配')
  const checkDirectory = join(root, 'tmp', `${stem}-check`)
  run(process.execPath, ['render/fusion-check.mjs', checkDirectory, reuseFrom, String(reuseUntil), String(reuseAfter), String(reuseTailFrom)])
  cpSync(join(checkDirectory, 'check.json'), join(output, 'composition-check.json'))
  mkdirSync(frames, { recursive: true })
  for (let frame = 0; frame < reuseUntil * fps; frame++) {
    const name = `f${String(frame).padStart(6, '0')}.jpg`
    linkSync(join(base, 'frames', name), join(frames, name))
  }
  for (let frame = reuseAfter * fps; frame < count; frame++) {
    const name = `f${String(frame).padStart(6, '0')}.jpg`
    const sourceName = `f${String(frame + Math.round((reuseTailFrom - reuseAfter) * fps)).padStart(6, '0')}.jpg`
    linkSync(join(base, 'frames', sourceName), join(frames, name))
  }
}
run(process.execPath, ['render/frames.mjs', '--entry', 'fusion.html', '--duration', String(DURATION), '--range', `${reuseUntil},${reuseAfter}`, '--fps', String(fps), '--workers', String(workers), '--render-scale', String(renderScale), '--quality', '96', '--out', frames])
for (let frame = 0; frame < count; frame++) {
  if (!existsSync(join(frames, `f${String(frame).padStart(6, '0')}.jpg`))) throw new Error(`缺帧：${frame}`)
}
run('ffmpeg', [
  '-y', '-hide_banner', '-loglevel', 'warning', '-stats', '-framerate', String(fps), '-start_number', '0', '-i', join(frames, 'f%06d.jpg'),
  '-frames:v', String(count), '-an', '-vf', 'scale=1920:1080:flags=lanczos:in_range=pc:out_range=tv,format=yuv420p',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-color_range', 'tv', '-g', '120', '-movflags', '+faststart', join(output, `${stem}.mp4`),
])
run('python3', ['render/validate.py', output])
if (preflight) run('python3', ['render/fusion-audit.py', output])
console.log(`\nv${VERSION} 完整成片：${join(output, `${stem}.mp4`)}`)
