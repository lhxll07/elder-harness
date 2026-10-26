import { SCREEN_W, SCREEN_H, fillRR } from '../screen.js'

export const UI = { background: '#f1f4f7', paper: '#ffffff', ink: '#233640', muted: '#647985', green: '#147e70', line: '#e0e7ed', pale: '#e5f1ed' }
export const PAGE_SCALE = 2

export function pageCanvas(source) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(SCREEN_W * PAGE_SCALE)
  canvas.height = Math.round(SCREEN_H * PAGE_SCALE)
  const context = canvas.getContext('2d')
  context.scale(PAGE_SCALE, PAGE_SCALE)
  if (source) context.drawImage(source, 0, 0, SCREEN_W, SCREEN_H)
  return { canvas, context }
}

export function uiCard(context, left, top, width, height, { fill = UI.paper, radius = 36, border = UI.line, shadow = true } = {}) {
  context.save()
  if (shadow) {
    context.shadowColor = 'rgba(23,42,58,0.035)'
    context.shadowBlur = 36
    context.shadowOffsetY = 14
    fillRR(context, left, top, width, height, radius, fill)
    context.shadowColor = 'rgba(23,42,58,0.055)'
    context.shadowBlur = 9
    context.shadowOffsetY = 3
  }
  fillRR(context, left, top, width, height, radius, fill)
  context.shadowColor = 'transparent'
  if (fill === UI.paper) {
    const light = context.createLinearGradient(left, top, left + width * 0.24, top + height)
    light.addColorStop(0, '#ffffff')
    light.addColorStop(1, '#f9fbfc')
    fillRR(context, left, top, width, height, radius, light)
  }
  context.beginPath()
  context.roundRect(left + 1, top + 1, width - 2, height - 2, radius)
  context.strokeStyle = border
  context.lineWidth = 1.5
  context.stroke()
  context.restore()
}

export function uiBadge(context, label, left, top, width, { fill = UI.pale, color = UI.green, height = 56, size = 29 } = {}) {
  fillRR(context, left, top, width, height, height / 2, fill)
  context.save()
  context.font = `500 ${size}px "Noto Sans CJK SC", sans-serif`
  context.textBaseline = 'middle'
  context.textAlign = 'center'
  context.fillStyle = color
  context.fillText(label, left + width / 2, top + height / 2, width - 20)
  context.restore()
}

export function uiIcon(context, kind, left, top, size, color = UI.green) {
  context.save()
  context.translate(left, top)
  context.scale(size / 64, size / 64)
  context.strokeStyle = color
  context.fillStyle = color
  context.lineWidth = 3
  context.lineCap = 'round'
  context.lineJoin = 'round'
  const line = (...points) => {
    context.beginPath()
    points.forEach(([horizontal, vertical], index) => index ? context.lineTo(horizontal, vertical) : context.moveTo(horizontal, vertical))
    context.stroke()
  }
  const outline = (horizontal, vertical, width, height, radius = 5) => {
    context.beginPath()
    context.roundRect(horizontal, vertical, width, height, radius)
    context.stroke()
  }
  if (kind === 'calendar') {
    outline(10, 14, 44, 42, 7)
    line([10, 27], [54, 27])
    line([22, 8], [22, 20])
    line([42, 8], [42, 20])
    for (const [horizontal, vertical] of [[21, 36], [33, 36], [21, 46], [33, 46], [45, 46]]) fillRR(context, horizontal - 2, vertical - 2, 4, 4, 1, color)
  } else if (kind === 'report' || kind === 'record') {
    outline(14, 8, 37, 48, 6)
    if (kind === 'report') {
      line([22, 23], [42, 23])
      line([22, 33], [42, 33])
      line([22, 43], [33, 43])
    } else {
      line([24, 21], [40, 21])
      line([32, 13], [32, 29])
      line([23, 41], [42, 41])
      line([23, 48], [36, 48])
    }
  } else if (kind === 'wallet') {
    outline(9, 17, 46, 36, 7)
    line([10, 18], [44, 9], [47, 17])
    outline(36, 29, 21, 14, 4)
    context.beginPath()
    context.arc(44, 36, 1.8, 0, Math.PI * 2)
    context.fill()
  } else if (kind === 'hospital') {
    outline(14, 20, 36, 37, 4)
    outline(23, 6, 18, 18, 4)
    line([32, 10], [32, 20])
    line([27, 15], [37, 15])
    outline(27, 44, 10, 13, 1)
    for (const horizontal of [23, 41]) for (const vertical of [31, 39]) fillRR(context, horizontal - 2, vertical - 2, 4, 4, 1, color)
  } else if (kind === 'home') {
    line([8, 29], [32, 9], [56, 29])
    line([15, 26], [15, 55], [49, 55], [49, 26])
    outline(27, 39, 10, 16, 1)
  } else if (kind === 'person') {
    context.beginPath()
    context.arc(32, 21, 10, 0, Math.PI * 2)
    context.stroke()
    context.beginPath()
    context.ellipse(32, 52, 20, 15, 0, Math.PI, Math.PI * 2)
    context.stroke()
  } else if (kind === 'check') {
    line([15, 33], [27, 45], [50, 20])
  } else if (kind === 'clock') {
    context.beginPath()
    context.arc(32, 32, 23, 0, Math.PI * 2)
    context.stroke()
    line([32, 17], [32, 32], [43, 38])
  }
  context.restore()
}

export function uiButton(context, label, left, top, width, height) {
  const gradient = context.createLinearGradient(left, top, left + width, top + height)
  gradient.addColorStop(0, '#218c7c')
  gradient.addColorStop(1, '#14766a')
  uiCard(context, left, top, width, height, { fill: gradient, border: '#2c7e69', radius: 32 })
  context.save()
  context.font = '500 65px "Noto Sans CJK SC", sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = '#fcfdf9'
  context.fillText(label, left + width / 2, top + height / 2)
  context.restore()
}

export function doctorPortrait(context, left, top, width, height, variant) {
  context.save()
  context.beginPath()
  context.roundRect(left, top, width, height, 26)
  context.clip()
  const background = context.createLinearGradient(left, top, left + width, top + height)
  background.addColorStop(0, variant === 1 ? '#e4edf4' : '#e2f0eb')
  background.addColorStop(1, '#f0f4f7')
  context.fillStyle = background
  context.fillRect(left, top, width, height)
  uiIcon(context, 'person', left + width * 0.19, top + height * 0.17, width * 0.62, variant === 1 ? '#68869d' : '#468d7b')
  fillRR(context, left + width * 0.60, top + height * 0.65, width * 0.26, width * 0.26, width * 0.13, '#ffffff')
  const centerX = left + width * 0.73
  const centerY = top + height * 0.65 + width * 0.13
  fillRR(context, centerX - 2, centerY - 9, 4, 18, 2, UI.green)
  fillRR(context, centerX - 9, centerY - 2, 18, 4, 2, UI.green)
  context.restore()
}
