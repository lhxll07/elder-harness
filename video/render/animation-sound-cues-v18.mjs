import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { editAt, editTime } from '../out/review/fusion-v18/source/fusion-edit.js'
import { compilerTime, openingTime, runtimeTime, memoryTime } from '../out/review/fusion-v18/source/fusion-script.js'
import { voiceStoryTime } from '../out/review/fusion-v18/source/voice-timing.js'

const frozen = new URL('../out/review/fusion-v18/source/', import.meta.url)
const sources = new Map()
const cues = []

function clockAt(frame, clock) {
  const actual = frame / 60
  const source = editTime(actual)
  if (clock === 'compiler') return compilerTime(source)
  if (clock === 'runtime') return runtimeTime(source)
  if (clock === 'memory') return memoryTime(source)
  if (clock === 'voice') return voiceStoryTime(openingTime(source) - 16)
  if (clock === 'source') return source
  if (clock === 'detail') return actual - editAt(actual).start
  return actual
}

function anchor(file, expression, clock, target, range, kind, label, options = {}) {
  if (!sources.has(file)) sources.set(file, readFileSync(new URL(file, frozen), 'utf8'))
  const source = sources.get(file)
  const location = source.indexOf(expression)
  if (location < 0) throw new Error(`Animation anchor no longer matches frozen picture: ${file}: ${expression}`)
  let best = null
  for (let frame = Math.ceil(range[0] * 60); frame <= Math.floor(range[1] * 60); frame++) {
    const error = Math.abs(clockAt(frame, clock) - target)
    if (!best || error < best.error) best = { frame, error }
  }
  if (best.error > 0.08) throw new Error(`Unreachable animation anchor: ${label}: ${best.error}`)
  cues.push({ id: `cue-${String(cues.length + 1).padStart(3, '0')}`, label, kind,
    target_frame: best.frame, time: best.frame / 60, source_clock: clock, source_target: target,
    source_clock_error: best.error, source_file: file, source_line: source.slice(0, location).split('\n').length,
    source_expression: expression, ...options })
}

const intro = 'shots/prologue.js'
anchor(intro, 'smooth01(local, 2.8, 3.0)', 'source', 4.3, [0, 8], 'motion', '需求展开成页面纵深', { duration: 1.6 })
for (const index of [0, 3, 6, 9, 12, 15]) anchor(intro, 'smooth01(local, 2.9 + index * 0.14, 0.45)', 'source', 2.9 + index * 0.14 + 0.405, [2, 7], 'paper', `通道第 ${index + 1} 层展开`, { gain: 0.035 })
anchor(intro, 'smooth01(local, 9.0, 1.7)', 'source', 9.85, [8, 12], 'close', '通道收拢的速度峰值', { duration: 1.5, gain: 0.048 })
anchor(intro, 'smooth01(local, 9.0 + (STEP_COUNT - 1 - index) * 0.065, 0.72)', 'source', 10.695, [9, 12], 'tap', '最后一层折叠归位')
anchor(intro, 'smooth01(local, 10.85, 1.0)', 'source', 11.35, [10, 13], 'motion', '应用界面展开', { duration: 0.75 })
anchor('fusion-titles.js', 'smooth01(source, 13.9, 0.75)', 'source', 14.275, [13, 16], 'warm', '开场品牌强调', { gain: 0.045 })

const chain = 'shots/voice-chain.js'
anchor(chain, 'proxy: envelope(local, 3.3, 4.95, 0.25, 0.35)', 'voice', 3.55, [16, 30], 'motion', '语音送入代理', { duration: 0.6 })
anchor(chain, 'smooth01(local, 5.95, 0.8)', 'voice', 6.71, [16, 30], 'dry', '识别文字归位')
anchor(chain, 'model: Math.max(envelope(local, 8.05, 10.30, 0.4, 0.4)', 'voice', 8.45, [16, 32], 'focus', '文字与页面进入模型', { duration: 0.65 })
anchor(chain, 'call: envelope(local, 10.10, 13.12, 0.4, 0.25)', 'voice', 10.5, [18, 34], 'paper', '工具调用生成')
anchor(chain, 'smooth01(local, 12.10, 1.15)', 'voice', 12.675, [20, 34], 'focus', '工具调用送往本机校验', { duration: 0.6 })
anchor('shots/voice.js', 'const PAGE_AT = 14.8', 'voice', 15.175, [22, 35], 'tap', '本机执行后医院页面展开')
anchor(chain, 'result: envelope(local, 15.85, 17.20, 0.35, 0.35)', 'voice', 16.2, [25, 36], 'paper', '新页面反馈归位')
anchor('shots/voice.js', 'const CUT_AT = 22.6', 'voice', 22.6, [32, 39], 'close', '暂停指令抵达', { duration: 0.55, gain: 0.026 })

anchor('fusion-film.js', 'else if (time < 90)', 'source', 46.0, [42, 47], 'focus', '进入同一次任务的页面', { duration: 1.0 })
anchor('compiler-film.js', 'const parse = windowAt(time, 15.0, 24.3, 3.0, 2.8)', 'compiler', 17.4, [47, 56], 'dry', '控件结构出现', { pan: -0.18 })
anchor('compiler-film.js', 'this.correspondence.reveal(smooth01(time, 20, 2.4))', 'compiler', 21.2, [47, 57], 'warm', '截图关系与控件对应', { pan: 0.18, gain: 0.055 })
anchor('compiler-film.js', 'fade(this.sameTarget, windowAt(time, 21.3, 25.5, 1.0, 1.0))', 'compiler', 22.2, [47, 57], 'paper', '双通道对齐同一个目标')
for (let index = 0; index < 6; index++) {
  const start = 25.45 + index * 0.16
  anchor('fusion-compile.js', 'smooth01(time, 25.45 + entry.index * 0.16, 3.0)', 'compiler', start + 1.5, [53, 63], 'focus', `第 ${index + 1} 页信息提取的速度峰值`, { duration: 0.58, gain: 0.024, pan: (index - 2.5) * 0.07 })
  anchor('fusion-compile.js', 'smooth01(time, 25.45 + entry.index * 0.16, 3.0)', 'compiler', start + 3.0, [53, 64], 'paper', `第 ${index + 1} 页信息归位`, { gain: 0.065, pan: (index - 2.5) * 0.06 })
}
anchor('fusion-compile.js', 'const fold = smooth01(time, 32.1, 2.6)', 'compiler', 33.4, [60, 70], 'close', '操作步骤折叠的速度峰值', { duration: 1.0, gain: 0.044 })
anchor('fusion-compile.js', 'const retention = smooth01(time, 33.1, 2.4)', 'compiler', 35.5, [60, 72], 'paper', '需求与决定保留下来')

const family = 'compiler-film.js'
anchor(family, 'const entry = smooth01(time, 41.4, 2.2)', 'compiler', 42.5, [75, 85], 'motion', '带上下文展开家人端', { duration: 0.85 })
anchor(family, 'const split = smooth01(time, 44.8, 2.6)', 'compiler', 46.1, [75, 85], 'paper', '家人接手与回复页展开')
anchor(family, '[48.5, 2.0, 0.30, 0.02, 0.68]', 'compiler', 49.6, [75, 85], 'warm', '家人线索回复', { gain: 0.05 })
anchor(family, 'fade(this.elderReply, windowAt(time, 51.4, 54.3, 0.8, 0.8))', 'compiler', 52.2, [75, 85], 'tap', '老人确认线索后原处续办')
anchor('fusion-runtime.js', 'const swap = smooth01(time, 97.1, 1.8)', 'runtime', 98.0, [85, 94], 'motion', '版式变化重新定位', { duration: 0.65 })
anchor('fusion-runtime.js', 'fade(this.screenTap, windowAt(time, 103.0, 104.0, 0.35, 0.55))', 'runtime', 103.35, [85, 94], 'tap', '重新绑定目标后点按')
anchor('fusion-detail.js', 'const fresh = smooth01(time, 3.0, 0.75)', 'detail', 3.375, [94, 102], 'focus', '歧义目标重新观察', { duration: 0.6 })
anchor('fusion-detail.js', 'touch(context, 800, top + 54, smooth01(time, 5.3, 0.9))', 'detail', 5.75, [94, 102], 'tap', '新观察中的唯一目标点按')
anchor('fusion-runtime.js', 'const load = smooth01(time, 106.2, 1.8)', 'runtime', 107.1, [102, 109], 'motion', '按需装入读表方法', { duration: 0.75 })
for (let index = 0; index < 3; index++) anchor('fusion-runtime.js', 'const amount = smooth01(time, 111.0 + index * 1.15, 0.85)', 'runtime', 111.0 + index * 1.15 + 0.85, [102, 109], 'paper', `阅读步骤 ${index + 1} 归位`, { gain: 0.065 })
anchor('compiler-film.js', 'smooth01(time, 73.1, 1.0)', 'compiler', 73.6, [109, 114], 'tap', '本人点按提交', { gain: 0.14 })

const proof = 'compiler-proof.js'
anchor(proof, 'const receipt = smooth01(time, 78.0, 1.5)', 'compiler', 79.5, [114, 120], 'paper', '医院返回页面出现')
anchor(proof, 'const reject = smooth01(time, 82.0, 1.2)', 'compiler', 82.6, [114, 120], 'close', '去除超出证据的结论', { duration: 0.5, gain: 0.024 })
anchor(proof, 'const local = smooth01(time, 85.0, 1.8)', 'compiler', 86.8, [120, 127], 'dry', '本地证据审计进度完成', { gain: 0.075, pan: -0.15 })
anchor(proof, 'const cloud = smooth01(time, 88.2, 1.8)', 'compiler', 90.0, [120, 127], 'warm', '独立云端复核进度完成', { gain: 0.065, pan: 0.15 })
anchor(proof, 'const result = smooth01(time, 91.2, 1.5)', 'compiler', 92.7, [120, 127], 'warm', '已提交待医院确认，中性落定', { gain: 0.04 })
anchor('fusion-detail.js', 'smooth01(time, 1.5, 0.5)', 'detail', 1.75, [127, 136], 'close', 'SELF_TYPED 不作为外部证据', { duration: 0.5, gain: 0.021 })
anchor('fusion-detail.js', 'const external = smooth01(time, 3.2, 0.8)', 'detail', 4.0, [127, 136], 'paper', '外部医院事实与来源归位')

const memory = 'fusion-memory.js'
anchor(memory, 'const unfold = smooth01(time, 135.7, 2.1)', 'memory', 136.75, [136, 143], 'motion', '轨迹工作台展开', { duration: 0.8 })
for (let index = 0; index < 3; index++) anchor(memory, 'steps: [0, 1, 2].map(index => smooth01(time, 141.0 + index * 1.7, 0.65))', 'memory', 141.0 + index * 1.7 + 0.65, [136, 143], 'paper', `通用阅读方法步骤 ${index + 1} 归位`, { gain: 0.065 })
anchor(memory, 'const reorder = smooth01(time, 151.0, 3.6)', 'memory', 152.8, [143, 149], 'motion', '换版式重新对齐', { duration: 0.7 })
anchor(memory, 'rowHighlight: smooth01(time, 155.3, 0.8)', 'memory', 156.1, [143, 149], 'paper', '新排班页目标重新对齐')
for (const [target, expression, label] of [[162.6, 'const first = smooth01(time, 162.0, 0.6)', '独立目标运行 01 归档'], [164.6, 'const regression = smooth01(time, 164.0, 0.6)', '原有任务回归归档'], [165.6, 'const second = smooth01(time, 165.0, 0.6)', '独立目标运行 02 归档']]) anchor(memory, expression, 'memory', target, [149, 159], 'paper', label)
anchor('fusion-detail.js', 'const onset = [4.4, 1.8, 2.8, 3.8][index]', 'detail', 4.95, [159, 170], 'paper', '影子回放符合完整前提')
anchor('fusion-detail.js', 'const archive = smooth01(time, 7.1, 0.65)', 'detail', 7.75, [159, 170], 'paper', '完整运行账本归档')
anchor(memory, 'touch(context, 1141, 514, smooth01(time, 177.35, 1.0))', 'memory', 177.85, [170, 174], 'tap', '家人手动点按采用', { gain: 0.13 })
anchor(memory, 'smooth01(time, 180.25, 0.8)', 'memory', 181.05, [174, 179], 'paper', '匹配方法正文装入')
anchor(memory, 'const load = smooth01(time, 181.7, 1.5)', 'memory', 182.45, [174, 179], 'close', '方法收回当前手机', { duration: 0.6 })
for (let index = 0; index < 3; index++) anchor('fusion-ending.js', 'smooth01(time, 174.4 + index * 0.58, 1.4)', 'source', 174.4 + index * 0.58 + 1.0, [179, 187], 'paper', ['读懂页面总结', '核实事实总结', '留下方法总结'][index], { gain: 0.05 })
anchor('fusion-titles.js', 'smooth01(source, EXPERIENCE_END + 10.6, 1.6)', 'source', 184.4, [189, 194], 'warm', '最终品牌稳定', { gain: 0.035 })

const contracts = [...sources].map(([file, text]) => ({ file, sha256: createHash('sha256').update(text).digest('hex') }))
console.log(JSON.stringify({ picture_version: 18, fps: 60, duration_seconds: 196,
  basis: fileURLToPath(frozen), contracts, cues: cues.sort((first, second) => first.time - second.time) }))
