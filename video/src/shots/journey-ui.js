import { hospitalPage } from './voice.js'
import { SCREEN_W, fillRR, text } from '../screen.js'
import { UI, pageCanvas, uiCard, uiBadge, uiIcon, uiButton, doctorPortrait } from './page-design.js'

const FONT = '"Noto Sans CJK SC", sans-serif'
const journeyPages = new Map()

function write(context, content, x, y, size = 54, color = '#233a46', align = 'left', weight = 400) {
  text(context, content, x, y, { font: `${weight} ${size}px ${FONT}`, color, align })
}

function row(context, heading, value, top, accent = false) {
  uiCard(context, 60, top, 960, 192, { fill: accent ? '#e0eee5' : UI.paper, border: accent ? '#bcd7c5' : UI.line, radius: 26 })
  if (accent) fillRR(context, 61, top + 52, 6, 88, 3, '#5c9e83')
  write(context, heading, 105, top + 58, 36, UI.muted)
  write(context, value, 105, top + 127, 57, accent ? UI.green : UI.ink, 'left', 500)
}

export function journeyPage(kind) {
  if (kind === 'departments') return hospitalPage(true)
  if (journeyPages.has(kind)) return journeyPages.get(kind)
  const { canvas, context } = pageCanvas(hospitalPage(true))
  fillRR(context, 0, 540, SCREEN_W, 1680, 0, UI.background)
  if (kind === 'doctors') {
    write(context, '普通内科 · 选择医生', 70, 655, 65, '#233a46', 'left', 500)
    write(context, '按您的复诊信息选择', 70, 744, 43, '#657c85')
    const doctors = [['陈医生', '普通内科门诊'], ['李医生', '普通内科门诊'], ['其他医生', '查看更多排班']]
    doctors.forEach(([name, detail], index) => {
      const top = 834 + index * 347
      uiCard(context, 60, top, 960, 304)
      if (index < 2) doctorPortrait(context, 98, top + 64, 154, 174, index)
      else {
        fillRR(context, 98, top + 64, 154, 174, 26, '#e3eee9')
        uiIcon(context, 'person', 132, top + 105, 88, '#72998a')
      }
      write(context, name, 306, top + 97, 67, UI.ink, 'left', 500)
      write(context, detail, 306, top + 182, 42, '#617c87')
      write(context, '排班待查看  ›', 306, top + 251, 39, '#507d86')
      uiBadge(context, index === 2 ? '排班' : '门诊', 834, top + 63, 132, { height: 52, size: 28, fill: '#edf3ee', color: '#6b8c7e' })
    })
  } else if (kind === 'dates') {
    write(context, '陈医生 · 选择时间', 70, 655, 68, '#233a46', 'left', 500)
    row(context, '已确认的复诊需求', '周四上午（示例）', 790, true)
    row(context, '门诊时段', '上午 09:00—11:30', 1025)
    row(context, '就诊人', '本人 · 信息待核对', 1260)
    uiBadge(context, '选择时段', 60, 1518, 240, { fill: '#e4ece7', color: UI.muted })
    uiBadge(context, '核对信息', 324, 1518, 240)
    uiBadge(context, '本人提交', 588, 1518, 240, { fill: '#e4ece7', color: UI.muted })
    uiButton(context, '核对预约信息', 60, 1650, 960, 187)
  } else if (kind === 'review') {
    write(context, '请您核对预约信息', 70, 655, 68, '#233a46', 'left', 500)
    const fields = [['医院 / 科室', '示例医院 · 普通内科'], ['医生', '陈医生'], ['时间', '周四上午（示例）'], ['就诊人', '本人'], ['挂号费', '¥ 20.00（示例）']]
    fields.forEach(([heading, value], index) => row(context, heading, value, 769 + index * 220))
    uiButton(context, '提交预约', 60, 1904, 960, 176)
  } else {
    const pending = kind === 'waiting'
    write(context, pending ? '等待医院页面返回' : '预约提交记录', 540, 685, 68, '#233a46', 'center', 500)
    const halo = context.createRadialGradient(540, 977, 90, 540, 977, 205)
    halo.addColorStop(0, '#d7eadf')
    halo.addColorStop(1, UI.background)
    context.fillStyle = halo
    context.fillRect(327, 764, 426, 426)
    uiCard(context, 414, 835, 252, 284, { radius: 42, border: '#c8ded1' })
    uiIcon(context, pending ? 'clock' : 'record', 456, 867, 168, '#54917b')
    uiBadge(context, pending ? '正在核验' : '提交记录', 435, 1061, 210, { height: 48, size: 28 })
    write(context, pending ? '本人已点按提交' : '已提交 · 待医院确认', 540, 1243, 65, '#315f60', 'center', 500)
    row(context, '本轮操作', '您已确认并提交', 1392, true)
    row(context, '外部业务状态', '以医院正式回执为准', 1624)
    write(context, '不等于预约成功或已完成支付', 540, 1942, 43, '#7d7366', 'center')
  }
  write(context, '概念流程 · 医院 / 医生 / 时间 / 费用均为示例', 540, 2134, 30, '#788891', 'center')
  journeyPages.set(kind, canvas)
  return canvas
}

export const REVIEW_FIELDS = [
  { kicker: '医院 / 科室', title: '普通内科', rows: ['示例医院'], accent: '#8abdab' },
  { kicker: '医生', title: '陈医生', rows: ['本人已确认'], accent: '#8abdab' },
  { kicker: '就诊时间', title: '周四上午', rows: ['示例时段'], accent: '#d3aa74' },
  { kicker: '就诊人', title: '本人', rows: ['信息请您核对'], accent: '#d3aa74' },
  { kicker: '挂号费用', title: '¥ 20.00', rows: ['示例 · 不代付'], accent: '#d3aa74' },
]
