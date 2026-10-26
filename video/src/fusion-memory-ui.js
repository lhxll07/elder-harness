import { rr } from './screen.js'

export const COLORS = {
  paper: '#f5f7f9', white: '#ffffff', ink: '#23343d', muted: '#596e78',
  rule: '#e0e7eb', jade: '#137d70', wash: '#e1efeb', gold: '#d2b484',
  light: '#f0f3f6', dim: '#a2b3bd', coral: '#bf8275',
}

const FONT = '"Noto Sans CJK SC", sans-serif'

export function text(context, content, horizontal, vertical, size = 24, color = COLORS.ink, weight = 500, align = 'left') {
  context.font = `${weight} ${size}px ${FONT}`
  context.fillStyle = color
  context.textAlign = align
  context.textBaseline = 'middle'
  context.fillText(content, horizontal, vertical)
}

export function mono(context, content, horizontal, vertical, size = 20, color = COLORS.muted) {
  context.font = `400 ${size}px "Liberation Mono", monospace`
  context.fillStyle = color
  context.textAlign = 'left'
  context.textBaseline = 'middle'
  context.fillText(content, horizontal, vertical)
}

export function fill(context, horizontal, vertical, width, height, radius, color) {
  rr(context, horizontal, vertical, width, height, radius)
  context.fillStyle = color
  context.fill()
}

export function panel(context, horizontal, vertical, width, height, radius = 22) {
  context.save()
  context.shadowColor = 'rgba(0,8,18,0.18)'
  context.shadowBlur = 24
  context.shadowOffsetY = 10
  fill(context, horizontal, vertical, width, height, radius, COLORS.paper)
  context.restore()
  const light = context.createLinearGradient(horizontal, vertical, horizontal + width * 0.45, vertical + height)
  light.addColorStop(0, 'rgba(255,255,255,0.44)')
  light.addColorStop(1, 'rgba(255,255,255,0)')
  fill(context, horizontal, vertical, width, height, radius, light)
}

export function rule(context, horizontal, vertical, width, color = COLORS.rule) {
  context.fillStyle = color
  context.fillRect(horizontal, vertical, width, 1)
}

export function badge(context, content, horizontal, vertical, width, options = {}) {
  const height = options.height ?? 36
  fill(context, horizontal, vertical - height / 2, width, height, height / 2, options.fill ?? COLORS.wash)
  text(context, content, horizontal + width / 2, vertical, options.size ?? 18, options.color ?? COLORS.jade, 500, 'center')
}

export function check(context, horizontal, vertical, amount = 1, color = COLORS.jade, scale = 1) {
  context.save()
  context.translate(horizontal, vertical)
  context.scale(scale, scale)
  context.lineWidth = 2.6
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.strokeStyle = color
  context.beginPath()
  context.moveTo(-7, 0)
  if (amount < 0.35) context.lineTo(-7 + 5 * amount / 0.35, 5 * amount / 0.35)
  else {
    context.lineTo(-2, 5)
    context.lineTo(-2 + 12 * (amount - 0.35) / 0.65, 5 - 15 * (amount - 0.35) / 0.65)
  }
  context.stroke()
  context.restore()
}

export function touch(context, horizontal, vertical, amount) {
  if (amount <= 0 || amount >= 1) return
  context.save()
  context.globalAlpha *= Math.sin(amount * Math.PI)
  context.strokeStyle = COLORS.jade
  context.lineWidth = 2
  context.beginPath()
  context.arc(horizontal, vertical, 10 + amount * 32, 0, Math.PI * 2)
  context.stroke()
  context.restore()
}

export function layer(context, opacity, draw) {
  if (opacity <= 0.001) return
  context.save()
  context.globalAlpha *= opacity
  draw()
  context.restore()
}

export function morphPanel(context, from, to, progress, destination = false) {
  const authored = destination ? to : from
  const current = from.map((value, index) => value + (to[index] - value) * progress)
  const scale = Math.min(current[2] / authored[2], current[3] / authored[3])
  context.translate(current[0] + (current[2] - authored[2] * scale) / 2, current[1] + (current[3] - authored[3] * scale) / 2)
  context.scale(scale, scale)
  context.translate(-authored[0], -authored[1])
}

export function outline(context, horizontal, vertical, width, height, color = COLORS.jade, dashed = false) {
  context.save()
  rr(context, horizontal, vertical, width, height, 6)
  context.strokeStyle = color
  context.lineWidth = 2
  if (dashed) context.setLineDash([6, 6])
  context.stroke()
  context.restore()
}

export function schedule(context, horizontal, vertical, width, options = {}) {
  const height = options.height ?? 276
  const rowHeight = height / 4
  const timeWidth = width * 0.17
  const columnWidth = (width - timeWidth) / 3
  const reorder = options.reorder ?? 0
  const highlight = options.highlight ?? 1
  const row = options.row ?? -1
  const target = options.target ?? 2
  const size = options.size ?? 25
  const columnPosition = column => {
    if (column === 0) return horizontal
    return horizontal + timeWidth + (column - 1 - reorder) * columnWidth
  }
  const headings = options.headings ?? ['时间', '周三', '周四', '周五']
  const values = options.values ?? [
    ['09:00', '李医生', '陈医生', '李医生'],
    ['10:00', '陈医生', '陈医生', '休诊'],
    ['11:00', '李医生', '休诊', '陈医生'],
  ]
  fill(context, horizontal, vertical, width, height, 8, COLORS.white)
  const columns = [0, 1, 3, 2].flatMap(column => (column === 1 && reorder > 0 ? [0, columnWidth * 3] : [0]).map(offset => ({ column, offset })))
  for (const { column, offset } of columns) {
    const columnX = columnPosition(column) + offset
    const columnSize = column === 0 ? timeWidth : columnWidth
    const lift = column === target ? -Math.sin(reorder * Math.PI) * 18 : 0
    context.save()
    if (column > 0) {
      context.beginPath()
      context.rect(horizontal + timeWidth, vertical - 20, width - timeWidth, height + 40)
      context.clip()
    }
    context.translate(0, lift)
    if (column === target && reorder > 0 && reorder < 1) {
      context.shadowColor = 'rgba(27,60,47,0.18)'
      context.shadowBlur = 12
      context.shadowOffsetY = 5
    }
    fill(context, columnX + 1, vertical + 1, columnSize - 2, height - 2, 5, COLORS.white)
    context.shadowColor = 'transparent'
    fill(context, columnX + 1, vertical + 1, columnSize - 2, rowHeight - 1, 5, '#e9eff3')
    if (column === target) {
      layer(context, highlight, () => {
        fill(context, columnX + 2, vertical + 2, columnSize - 4, height - 4, 5, 'rgba(28,132,105,0.085)')
        fill(context, columnX + 2, vertical + 2, columnSize - 4, rowHeight - 3, 5, '#d5e9e4')
      })
    }
    text(context, headings[column], columnX + columnSize / 2, vertical + rowHeight / 2, size, COLORS.ink, 500, 'center')
    values.forEach((entries, index) => {
      if (column === target && row === index) layer(context, options.rowHighlight ?? 1, () => fill(context, columnX + 3, vertical + rowHeight * (index + 1) + 3, columnSize - 6, rowHeight - 6, 4, '#d2e9e2'))
      text(context, entries[column], columnX + columnSize / 2, vertical + rowHeight * (index + 1.5), size - 1, entries[column] === '休诊' ? COLORS.muted : COLORS.ink, 400, 'center')
      rule(context, columnX + 1, vertical + rowHeight * (index + 1), columnSize - 2)
    })
    context.restore()
  }
  if (highlight > 0.001) layer(context, highlight, () => outline(context, columnPosition(target) + 1, vertical - Math.sin(reorder * Math.PI) * 18 + 1, columnWidth - 2, height - 2))
  return { targetX: columnPosition(target), timeWidth, columnWidth, rowHeight }
}

export function method(context, horizontal, vertical, width, options = {}) {
  panel(context, horizontal, vertical, width, 476)
  text(context, '读表方法', horizontal + 32, vertical + 45, 29, COLORS.ink, 500)
  badge(context, options.active ? '生效' : '候选', horizontal + width - 102, vertical + 45, 70)
  text(context, '适用前提：当前页面可见表头', horizontal + 32, vertical + 96, 19, COLORS.muted)
  rule(context, horizontal + 32, vertical + 128, width - 64)
  const steps = ['先识别表头', '再定位目标列', '连同行内容核对']
  steps.forEach((content, index) => {
    const amount = options.steps?.[index] ?? 1
    layer(context, amount, () => {
      const baseline = vertical + 184 + index * 88
      text(context, String(index + 1).padStart(2, '0'), horizontal + 32, baseline, 24, COLORS.jade, 500)
      text(context, content, horizontal + 89, baseline, 26, COLORS.ink, 500)
      if (options.selected === index) rule(context, horizontal + 89, baseline + 25, width - 132, COLORS.jade)
    })
  })
  text(context, '校验要求：对照当前页面来源', horizontal + 32, vertical + 435, 18, COLORS.muted)
}
