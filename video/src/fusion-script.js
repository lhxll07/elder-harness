import { SUBTITLES } from './timeline.js'
import { EDIT_DURATION, EDITS } from './fusion-edit.js'

export const DURATION = EDIT_DURATION
export const VERSION = 18
export const EXPERIENCE_END = 173

const MEMORY_CLOCK = [[135, 135], [144, 148], [151, 160], [164, 174.6], [168, 180], [173, 184]]

function remap(time, source, destination) {
  if (time <= MEMORY_CLOCK[0][source]) return time
  for (let index = 1; index < MEMORY_CLOCK.length; index++) {
    const previous = MEMORY_CLOCK[index - 1]
    const next = MEMORY_CLOCK[index]
    if (time <= next[source]) return previous[destination] + (time - previous[source]) / (next[source] - previous[source]) * (next[destination] - previous[destination])
  }
  const last = MEMORY_CLOCK.at(-1)
  return time + last[destination] - last[source]
}

export const memoryTime = time => remap(time, 0, 1)
export const fromMemoryTime = time => remap(time, 1, 0)
export const studioTime = time => time >= 135 ? memoryTime(time) : time

export const BEATS = EDITS.map(({ name, title, start, end }) => ({ name, title, start, end }))

export function openingTime(time) {
  return time <= 16 ? time : 16 + (Math.min(time, 40) - 16) * 28 / 24
}

export function compilerTime(time) {
  if (time < 50) return 14
  if (time < 90) return time - 36
  if (time < 112) return 54 + (runtimeTime(time) - 90) / 2
  if (time < 118) return 68 + (time - 112) * 8 / 6
  if (time < 125) return 76 + (time - 118) * 9 / 7
  if (time < 135) return 85 + (time - 125) * 11 / 10
  if (time < EXPERIENCE_END) return 96
  return 96 + time - EXPERIENCE_END
}

export function runtimeTime(time) {
  return time < 102 ? 90 + (time - 90) * 16 / 12 : 106 + (time - 102) * 12 / 10
}

const fromOpening = time => time <= 16 ? time : 16 + (time - 16) * 24 / 28

export const CUES = [
  ...SUBTITLES.filter(cue => cue.a < 44).map(cue => ({
    start: fromOpening(cue.a), end: fromOpening(Math.min(cue.b, 44)), main: cue.zh,
    detail: cue.en, phase: cue.a < 16 ? '' : '一句话 → 语音识别 → 模型规划 → 本地工具 → 页面反馈',
  })),
  { start: 40.5, end: 43.3, main: '“继续，挂普通内科，周四上午。”', detail: '同一次复诊，从刚才停下的页面接着办。', phase: 'INPUT / 接回人的目标' },
  { start: 43.6, end: 46.8, main: '走进这一次“为人编译”。', detail: '从当前页面出发，把复杂交给系统。', phase: 'COMPILE / 进入同一个任务' },
  { start: 47.2, end: 50.7, main: '先读懂，眼前这一页。', detail: '控件树给语义与可操作性，截图给位置与版式。', phase: 'PARSE / 双通道观察' },
  { start: 51.0, end: 55.3, main: '控件给身份，截图补关系。', detail: '两种观察，对齐同一个“普通内科”。', phase: 'PARSE / 对齐同一个目标' },
  { start: 55.6, end: 60.5, main: '从页面抽出信息，编排成步骤。', detail: '展示流程结构；后续页面，到达后逐页观察。', phase: 'LOWER / 页面 → 信息 → 步骤' },
  { start: 60.8, end: 64.1, main: '操作交给软件，缺口单独留下。', detail: '科室和时间已知；医生待补充，后续页面到达后再观察。', phase: 'PLAN / 已知需求 + 待补线索' },
  { start: 64.4, end: 69.3, main: '消去操作。留下决定。', detail: '查找与导航由软件承担，核对与提交由本人决定。', phase: 'COMPILE FOR PEOPLE / 为人编译', hero: true },
  { start: 69.6, end: 72.0, main: '复杂的路径，变成清楚的选择。', detail: '普通内科、周四上午；还差上次那位医生。', phase: 'OUTPUT / 回到人的语言' },
  { start: 72.3, end: 74.7, main: '现在，只问一个真正需要人的问题。', detail: '“上次，是哪位医生？”', phase: 'RESOLVE / 把缺口交给人' },
  { start: 75.2, end: 78.4, main: '把目标、进度和问题，一起交给家人。', detail: '打开网页就能看到：预约复诊，已知科室与时段，还差医生。', phase: 'RESOLVE / 带上下文的协作' },
  { start: 78.7, end: 81.7, main: '家人补一条线索，任务往前一步。', detail: '接手求助，回复“上次是陈医生”。', phase: 'RESOLVE / 看背景 → 接手 → 回复' },
  { start: 82.0, end: 84.8, main: '线索回到老人，决定留在本人。', detail: '老人核对后，原手机、原进度继续办理。', phase: 'RESOLVE / 本人确认 → 原处续办' },
  { start: 85.2, end: 88.2, main: '找到页面里的陈医生。', detail: '把家人的线索落到当前选项上。', phase: 'BIND / 线索 → 当前目标' },
  { start: 88.5, end: 91.2, main: '位置会变，身份重新对齐。', detail: '核对窗口、页面版本、控件身份与唯一匹配。', phase: 'BIND / 重新绑定' },
  { start: 91.5, end: 93.8, main: '找准，再执行。', detail: '工具调用先过本地校验。', phase: 'RUN / 本地执行边界' },
  { start: 94.2, end: 97.3, main: '同名目标，先读清上下文。', detail: '旧引用无法唯一重绑，返回重新观察。', phase: 'REOBSERVE / 先观察，再绑定' },
  { start: 97.6, end: 101.7, main: '读新页面，再选新编号。', detail: '结合当前上下文重新选择，执行后继续观察。', phase: 'REOBSERVE / 新观察 → 新目标' },
  { start: 102.2, end: 104.8, main: '排班展开，方法按需装入。', detail: 'load_skill("reading_tables")', phase: 'LINK / 目录常驻，正文按需' },
  { start: 105.1, end: 108.8, main: '带着周四，连同行与表头一起读。', detail: '方法辅助模型，结果回到本人核对页。', phase: 'READ / 表头 + 行 + 内容' },
  { start: 109.2, end: 113.8, main: '医生、时间、费用。由您核对，由您提交。', detail: '系统承担操作，决定回到本人。', phase: 'COMMIT / 人的决定' },
  { start: 114.2, end: 116.6, main: '动作看记录，结果看页面。', detail: '本人点按，与医院返回，分别核验。', phase: 'VERIFY / 动作不等于结果' },
  { start: 116.9, end: 119.8, main: '结论，必须与事实相符。', detail: '“预约成功”不能替代“待医院确认”。', phase: 'PROOF / 结论对照事实' },
  { start: 120.2, end: 123.1, main: '让事实，托住结论。', detail: '本地先审，再由独立模型复核页面含义。', phase: 'SOURCE MAP / 结论对应证据', hero: true },
  { start: 123.4, end: 126.8, main: '“已提交，待医院确认。”', detail: '有据可循的一句话，回到手机顶部。', phase: 'OUTPUT / 回到人的语言' },
  { start: 127.2, end: 130.7, main: '同一句话，先辨认它的来源。', detail: '搜索词记录输入，医院页面提供外部办理事实。', phase: 'PROVENANCE / 区分信息来源' },
  { start: 131.0, end: 135.7, main: '让结论，长在外部事实之上。', detail: '保留应用、页面版本与步骤，只支持证据能证明的部分。', phase: 'PROVENANCE / 来源 + 版本 + 步骤' },
  { start: 136.2, end: 138.7, main: '一次经历，怎样留下方法？', detail: '以下为经验机制演示：完成且本人确认后提炼候选。', phase: 'DISTILL / 从经历到方法' },
  { start: 139.0, end: 142.8, main: '留下读法，而非这一次的信息。', detail: '移除姓名、日期与旧引用，保留前提、步骤和校验要求。', phase: 'DISTILL / 信息 → 通用步骤', hero: true },
  { start: 143.2, end: 145.6, main: '先找表头，再找目标列。', detail: '方法复用，目标从当前页面重读。', phase: 'TRANSFER / 阅读当前页面' },
  { start: 145.9, end: 148.8, main: '位置换了，目标跟着页面走。', detail: '重对齐行列，不回放旧坐标。', phase: 'TRANSFER / 换版式，重观察' },
  { start: 149.2, end: 152.4, main: '新的能办，原来的也要办好。', detail: '独立目标运行，与原有任务回归，分别核实结果。', phase: 'VALIDATE / 两类独立运行' },
  { start: 152.7, end: 155.7, main: '成功核实，失败也留下。', detail: '目标完成至少两次，旧任务仍通过，记录完整保留。', phase: 'VALIDATE / 运行归档' },
  { start: 156.0, end: 158.8, main: '同一版契约，由本机重算。', detail: '复核准入、安全、开销与影子回放。', phase: 'ADMIT / 独立报告 → 本机复算' },
  { start: 159.2, end: 162.5, main: '方法有用，也要用在该用的地方。', detail: '回放已归档的决策点，核对应用、任务族与页面前提。', phase: 'SHADOW / 逐点检查适用边界' },
  { start: 162.8, end: 166.1, main: '应用、任务、页面前提，同时对齐。', detail: '逐点核对完整前提，区分适用与不适用的场景。', phase: 'SHADOW / 三项条件共同匹配' },
  { start: 166.4, end: 169.8, main: '每一次运行，都写入同一份账本。', detail: '成功与未完成均独立核实，交给本机重新计算。', phase: 'SHADOW / 完整归档，重新计算' },
  { start: 170.2, end: 173.8, main: '验证通过，再由家人选择采用。', detail: '技巧页手动采用，生效后仍可回退或退休。', phase: 'ADOPT / 人决定是否采用', hero: true },
  { start: 174.2, end: 178.7, main: '下一次，只装入当下需要的方法。', detail: '匹配应用、任务与页面前提，按需读取方法正文。', phase: 'LINK / 目录匹配 → 按需装入' },
]
