const SHADOWS = {
  card: { color: 'rgba(8,21,32,0.15)', blur: 22, offset: 8 },
  control: { color: 'rgba(8,21,32,0.12)', blur: 14, offset: 5 },
}

function channels(color) {
  if (typeof color !== 'string') return null
  const hex = /^#([\da-f]{6})$/i.exec(color)
  if (hex) {
    const value = Number.parseInt(hex[1], 16)
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255, 1]
  }
  const rgb = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i.exec(color)
  return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), Number(rgb[4] ?? 1)] : null
}

function tint(components, target, amount) {
  const values = components.slice(0, 3).map((value, index) => Math.round(value + (target[index] - value) * amount))
  return `rgba(${values.join(',')},${components[3]})`
}

export function surfaceGradient(context, horizontal, vertical, width, height, color, strength = 1) {
  const components = channels(color)
  if (!components) return color
  const light = (components[0] * 0.2126 + components[1] * 0.7152 + components[2] * 0.0722) / 255
  const gradient = context.createLinearGradient(horizontal, vertical, horizontal + width * 0.16, vertical + height)
  gradient.addColorStop(0, tint(components, [255, 255, 255], (light > 0.6 ? 0.035 : 0.055) * strength))
  gradient.addColorStop(0.42, color)
  gradient.addColorStop(1, tint(components, [19, 35, 47], (light > 0.6 ? 0.038 : 0.075) * strength))
  return gradient
}

export function surfaceShadow(context, elevation = 'card') {
  const shadow = SHADOWS[elevation]
  context.shadowColor = shadow.color
  context.shadowBlur = shadow.blur
  context.shadowOffsetX = 0
  context.shadowOffsetY = shadow.offset
}

export function paintSurface(context, horizontal, vertical, width, height, color, options = {}) {
  const { elevation, inset = false, edge = 1, strength = 1 } = options
  const finished = Math.min(width, height) >= 32
  context.fillStyle = color
  if (!finished && !elevation) {
    context.fill()
    return
  }
  const components = channels(color)
  context.save()
  context.fillStyle = finished ? surfaceGradient(context, horizontal, vertical, width, height, color, strength) : color
  if (elevation) surfaceShadow(context, elevation)
  context.fill()
  if (finished && edge > 0) {
    context.shadowColor = 'transparent'
    context.shadowBlur = 0
    context.shadowOffsetX = 0
    context.shadowOffsetY = 0
    context.clip()
    const alpha = options.edgeOpacity ?? components?.[3] ?? 1
    const rim = context.createLinearGradient(horizontal, vertical, horizontal + width * 0.12, vertical + height)
    rim.addColorStop(0, inset ? `rgba(19,35,47,${alpha * 0.16})` : `rgba(255,255,255,${alpha * 0.62})`)
    rim.addColorStop(0.46, `rgba(255,255,255,${alpha * 0.08})`)
    rim.addColorStop(1, inset ? `rgba(255,255,255,${alpha * 0.55})` : `rgba(19,35,47,${alpha * 0.13})`)
    context.strokeStyle = rim
    context.lineWidth = edge * 2
    context.stroke()
  }
  context.restore()
}

export function surfaceRule(context, horizontal, vertical, width, color) {
  const components = channels(color)
  if (!components || width <= 0) {
    context.fillStyle = color
    context.fillRect(horizontal, vertical, width, 1)
    return
  }
  const gradient = context.createLinearGradient(horizontal, vertical, horizontal + width, vertical)
  const subdued = `rgba(${components.slice(0, 3).join(',')},${components[3] * 0.65})`
  gradient.addColorStop(0, subdued)
  gradient.addColorStop(0.08, color)
  gradient.addColorStop(0.92, color)
  gradient.addColorStop(1, subdued)
  context.fillStyle = gradient
  context.fillRect(horizontal, vertical, width, 1)
}
