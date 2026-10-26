// The phone's screen, drawn with canvas 2D and uploaded as a texture.
//
// The interface is deliberately two-dimensional: it is a canvas inside a
// physical object, exactly like the real thing. Drawing it in 3D would mean
// rebuilding every text run as geometry for no gain, and would lose the crisp
// sub-pixel type that makes a screen read as a screen.
//
// Everything below is deterministic in `t` — no Math.random, no Date.

import { C, css } from './palette.js'

// Logical design size of the interface. Every drawing call in every chapter is
// written against these numbers and never against the real canvas size.
export const SCREEN_W = 1080

/**
 * Height, derived from the display's own proportions rather than chosen.
 *
 * The screen mesh is `PHONE.w - 2*bezel` by `PHONE.h - 2*bezel` in props.js —
 * 0.67 x 1.49 world units, a ratio of 1:2.224. This canvas was 1080x2230, a
 * ratio of 1:2.065, so every chapter's interface was stretched about 7.7%
 * vertically on its way onto the glass. The visible symptom is the app's one
 * round button arriving as a vertical ellipse, and any circle drawn anywhere on
 * this screen inheriting the same error.
 *
 * 1080 * 1.49 / 0.67 = 2402. Keep in sync with PHONE in src/props.js.
 */
export const SCREEN_H = 2402

/**
 * How many real pixels each logical pixel gets.
 *
 * The screen is never wider than ~492px in frame — that is the closest the
 * camera ever comes to the device — so 1080 already oversamples it by 2.2x, and
 * 2230 oversamples the height by more than that. The 1.6x of the first render
 * was headroom nothing was spending: at 1728x3568 each chapter held a 24.6MB
 * canvas and a matching GPU texture, eleven of them at once, for detail that was
 * then minified away. Halving it costs no visible detail and returns ~170MB of
 * GPU memory to the render — and that memory is what the parallel renderer was
 * running out of when it dropped frames to black.
 *
 * The texture samples with no mip chain (see phoneview.js), so a *smaller*
 * minification ratio also means less aliasing on the thin UI rules.
 */
export const SCREEN_SUPERSAMPLE = 1.0

/**
 * A screen that is off.
 *
 * Chapters use this rather than hiding the mesh: a hidden mesh leaves a hole
 * where the glass reflections should be, and the device immediately stops
 * reading as an object.
 */
export function blankScreen(ctx, { luma = 12 } = {}) {
  // Under the supersampled canvas the context carries a scale, so clearing has
  // to account for it: reset to the *scaled* transform, not to identity, or the
  // wipe covers only the top-left corner and the previous frame's pixels stay
  // visible everywhere else.
  const s = SCREEN_SUPERSAMPLE
  ctx.setTransform(s, 0, 0, s, 0, 0)
  ctx.fillStyle = `rgb(${luma},${luma + 4},${luma + 6})`
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
  // A very faint cool gradient so the "off" state is not a flat rectangle.
  const g = ctx.createLinearGradient(0, 0, 0, SCREEN_H)
  g.addColorStop(0, 'rgba(30,44,52,0.35)')
  g.addColorStop(0.6, 'rgba(0,0,0,0)')
  g.addColorStop(1, 'rgba(0,0,0,0.25)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
}

const F = {
  ui: (px, weight = 400) => `${weight} ${px}px "Noto Sans CJK SC", "Noto Sans CJK", sans-serif`,
  num: (px, weight = 300) => `${weight} ${px}px "Inter", "Liberation Sans", sans-serif`,
}

// The product's own type scale, scaled up for the phone's 1080px width frame.
const T = {
  huge: 130,
  big: 84,
  title: 62,
  body: 46,
  small: 38,
  tiny: 32,
}

export class Screen {
  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.width = SCREEN_W
    this.canvas.height = SCREEN_H
    this.ctx = this.canvas.getContext('2d')
    this.dirty = true
  }

  /** Clear to the product's own background. */
  clear(bg = '#0F171B') {
    const { ctx } = this
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
  }
}

// ---------------------------------------------------------------------------
// Drawing primitives
// ---------------------------------------------------------------------------

export function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rad, y)
  ctx.lineTo(x + w - rad, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad)
  ctx.lineTo(x + w, y + h - rad)
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h)
  ctx.lineTo(x + rad, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad)
  ctx.lineTo(x, y + rad)
  ctx.quadraticCurveTo(x, y, x + rad, y)
  ctx.closePath()
}

export function fillRR(ctx, x, y, w, h, r, fill) {
  rr(ctx, x, y, w, h, r)
  ctx.fillStyle = fill
  ctx.fill()
}

export function text(ctx, str, x, y, { font, color, align = 'center', baseline = 'middle', alpha = 1, maxWidth }) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.font = font
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.textBaseline = baseline
  if (maxWidth) ctx.fillText(str, x, y, maxWidth)
  else ctx.fillText(str, x, y)
  ctx.restore()
}

/** Greedy CJK-aware wrap into lines that fit `maxWidth`. */
export function wrapLines(ctx, str, maxWidth, font) {
  ctx.save()
  ctx.font = font
  const lines = []
  let line = ''
  for (const ch of str) {
    const test = line + ch
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = ch
    } else line = test
  }
  if (line) lines.push(line)
  ctx.restore()
  return lines
}

/** The app's status bar: time, and the two live indicators. */
export function statusBar(ctx, { t = 0, mic = false, net = true } = {}) {
  const y = 92
  text(ctx, '9:41', 90, y, { font: F.num(44, 500), color: 'rgba(255,255,255,0.72)', align: 'left' })
  const rx = SCREEN_W - 90
  // Signal bars
  for (let i = 0; i < 4; i++) {
    const h = 14 + i * 8
    fillRR(ctx, rx - 150 + i * 20, y + 12 - h, 12, h, 3, 'rgba(255,255,255,0.62)')
  }
  fillRR(ctx, rx - 60, y - 4, 44, 22, 6, 'rgba(255,255,255,0.30)')
  fillRR(ctx, rx - 58, y - 2, 36, 18, 5, 'rgba(255,255,255,0.72)')
  if (mic) {
    ctx.beginPath()
    ctx.arc(rx - 200, y, 8 + Math.sin(t * 6) * 2.5, 0, Math.PI * 2)
    ctx.fillStyle = css(C.attention, 0.95)
    ctx.fill()
  }
  if (net) {
    ctx.beginPath()
    ctx.arc(rx - 178, y, 5, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.fill()
  }
}

/**
 * The one big button — the film's signature object.
 *
 * The colour is the state: green idle, amber listening, and the ring breathes
 * with the voice. Everything the elder needs to know about what the assistant
 * is doing is in this one object, which is the point the chapter is making.
 */
export function bigButton(ctx, { cx, cy, r, color, glow = 1, t = 0, ring = 0, pressed = 0, label }) {
  const scale = 1 - pressed * 0.05

  // Outer halo
  const halo = ctx.createRadialGradient(cx, cy, r * 0.7, cx, cy, r * 2.5)
  halo.addColorStop(0, css(color, 0.30 * glow))
  halo.addColorStop(0.45, css(color, 0.10 * glow))
  halo.addColorStop(1, css(color, 0))
  ctx.fillStyle = halo
  ctx.beginPath()
  ctx.arc(cx, cy, r * 2.5, 0, Math.PI * 2)
  ctx.fill()

  // Voice rings — expand and fade, phase-locked to `t` so they never stutter.
  if (ring > 0) {
    for (let i = 0; i < 3; i++) {
      const k = ((t * 0.55 + i / 3) % 1)
      const rr2 = r * (1.06 + k * 0.85)
      ctx.beginPath()
      ctx.arc(cx, cy, rr2, 0, Math.PI * 2)
      ctx.strokeStyle = css(color, (1 - k) * 0.34 * ring)
      ctx.lineWidth = 3 + (1 - k) * 5
      ctx.stroke()
    }
  }

  // Body
  const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r)
  g.addColorStop(0, css(shade(color, 1.22), 1))
  g.addColorStop(0.55, css(color, 1))
  g.addColorStop(1, css(shade(color, 0.80), 1))
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r * scale, 0, Math.PI * 2)
  ctx.fillStyle = g
  ctx.shadowColor = css(color, 0.55 * glow)
  ctx.shadowBlur = 60 * glow
  ctx.fill()
  ctx.restore()

  // Specular: a soft highlight in the upper-left, the way a real domed button
  // catches the room. Without it the button is a flat disc.
  const sp = ctx.createRadialGradient(cx - r * 0.36, cy - r * 0.42, 0, cx - r * 0.3, cy - r * 0.36, r * 1.15)
  sp.addColorStop(0, 'rgba(255,255,255,0.30)')
  sp.addColorStop(0.5, 'rgba(255,255,255,0.06)')
  sp.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.beginPath()
  ctx.arc(cx, cy, r * scale, 0, Math.PI * 2)
  ctx.fillStyle = sp
  ctx.fill()

  // Inset rim
  ctx.beginPath()
  ctx.arc(cx, cy, r * scale - 2, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255,255,255,0.20)'
  ctx.lineWidth = 2
  ctx.stroke()

  if (label) {
    text(ctx, label, cx, cy, { font: F.ui(96, 300), color: 'rgba(255,255,255,0.96)' })
  }
}

/**
 * A waveform.
 *
 * `flat` is the load-bearing parameter: it is 0 while the assistant is talking
 * and collapses to 1 the instant the elder speaks over it. That collapse is the
 * single most important animation in the film — it is what "you can interrupt
 * it" looks like.
 */
export function waveform(ctx, { cx, cy, width, height, t, color, bars = 48, flat = 0, amp = 1, alpha = 1 }) {
  const step = width / bars
  for (let i = 0; i < bars; i++) {
    const u = i / (bars - 1)
    const env = Math.sin(u * Math.PI)
    const phase = t * 6.4 + i * 0.42
    const raw = (Math.sin(phase) * 0.6 + Math.sin(phase * 0.37 + 1.7) * 0.4)
    let h = Math.abs(raw) * env * height * 0.5 * amp
    // Squash toward the centreline. At flat=1 the wave is a straight line.
    h *= 1 - flat
    const x = cx - width / 2 + step * (i + 0.5)
    const barH = Math.max(2.5, h * 2)
    fillRR(ctx, x - step * 0.26, cy - barH / 2, step * 0.52, barH, step * 0.26, css(color, alpha * (0.55 + env * 0.45)))
  }
  if (flat > 0.02) {
    // The line it collapses to stays visible for a beat — the silence has to be
    // seen, not just the absence of sound.
    const w = width * (1 - flat * 0.55)
    fillRR(ctx, cx - w / 2, cy - 2.5, w, 5, 2.5, css(color, alpha * flat * 0.8))
  }
}

/** A transcript bubble: what the elder said. */
export function sayBubble(ctx, { x, y, w, str, alpha = 1, scale = 1, accent = C.attention }) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(x, y)
  ctx.scale(scale, scale)
  const lines = wrapLines(ctx, str, w - 90, F.ui(T.small))
  const h = lines.length * (T.small * 1.5) + 56
  fillRR(ctx, -w / 2, -h / 2, w, h, 34, 'rgba(196,106,20,0.20)')
  rr(ctx, -w / 2, -h / 2, w, h, 34)
  ctx.strokeStyle = css(accent, 0.55)
  ctx.lineWidth = 2.5
  ctx.stroke()
  lines.forEach((l, i) => {
    text(ctx, l, 0, -h / 2 + 28 + T.small * 1.5 * (i + 0.5), {
      font: F.ui(T.small),
      color: 'rgba(255,255,255,0.94)',
    })
  })
  ctx.restore()
}

/**
 * A spoken step pill. The assistant narrates every action; these are those
 * actions, and the newest one is the brightest.
 */
export function stepPill(ctx, { x, y, w, str, alpha = 1, focus = 1, color = C.brand }) {
  const h = 108
  ctx.save()
  ctx.globalAlpha = alpha
  fillRR(ctx, x, y, w, h, h / 2, `rgba(255,255,255,${0.045 + focus * 0.055})`)
  if (focus > 0.02) {
    rr(ctx, x, y, w, h, h / 2)
    ctx.strokeStyle = css(color, 0.10 + focus * 0.42)
    ctx.lineWidth = 2
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.arc(x + 54, y + h / 2, 9, 0, Math.PI * 2)
  ctx.fillStyle = css(color, 0.35 + focus * 0.6)
  ctx.fill()
  text(ctx, str, x + 90, y + h / 2, {
    font: F.ui(T.small, focus > 0.5 ? 500 : 400),
    color: `rgba(255,255,255,${0.50 + focus * 0.45})`,
    align: 'left',
  })
  ctx.restore()
}

/** A generic list row, for the app pages the assistant is driving. */
export function listRow(ctx, { x, y, w, h, title, sub, alpha = 1, highlight = 0, color = C.brand }) {
  ctx.save()
  ctx.globalAlpha = alpha
  fillRR(ctx, x, y, w, h, 26, `rgba(255,255,255,${0.035 + highlight * 0.05})`)
  if (highlight > 0.01) {
    rr(ctx, x, y, w, h, 26)
    ctx.strokeStyle = css(color, highlight * 0.85)
    ctx.lineWidth = 3
    ctx.stroke()
  }
  fillRR(ctx, x + 30, y + h / 2 - 46, 92, 92, 22, 'rgba(255,255,255,0.09)')
  text(ctx, title, x + 152, y + (sub ? h / 2 - 28 : h / 2), {
    font: F.ui(T.small, 500),
    color: 'rgba(255,255,255,0.90)',
    align: 'left',
  })
  if (sub) {
    text(ctx, sub, x + 152, y + h / 2 + 34, {
      font: F.ui(T.tiny),
      color: 'rgba(255,255,255,0.55)',
      align: 'left',
    })
  }
  ctx.restore()
}

/** The app chrome above a driven page: back chevron, title, and a live badge. */
export function appBar(ctx, { title, sub, alpha = 1, badge }) {
  ctx.save()
  ctx.globalAlpha = alpha
  fillRR(ctx, 0, 0, SCREEN_W, 250, 0, 'rgba(255,255,255,0.03)')
  ctx.beginPath()
  ctx.moveTo(92, 190)
  ctx.lineTo(130, 154)
  ctx.lineTo(92, 118)
  ctx.strokeStyle = 'rgba(255,255,255,0.72)'
  ctx.lineWidth = 7
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.stroke()
  text(ctx, title, SCREEN_W / 2, 156, { font: F.ui(T.body, 600), color: 'rgba(255,255,255,0.94)' })
  if (sub) text(ctx, sub, SCREEN_W / 2, 210, { font: F.ui(T.tiny), color: 'rgba(255,255,255,0.48)' })
  if (badge) {
    fillRR(ctx, SCREEN_W - 300, 128, 210, 60, 30, css(badge.color, 0.22))
    rr(ctx, SCREEN_W - 300, 128, 210, 60, 30)
    ctx.strokeStyle = css(badge.color, 0.7)
    ctx.lineWidth = 2
    ctx.stroke()
    text(ctx, badge.text, SCREEN_W - 195, 158, { font: F.ui(T.tiny, 500), color: css(badge.color, 1) })
  }
  ctx.restore()
}

/** Lighten/darken a hex int. */
export function shade(hex, k) {
  const r = Math.min(255, Math.round(((hex >> 16) & 255) * k))
  const g = Math.min(255, Math.round(((hex >> 8) & 255) * k))
  const b = Math.min(255, Math.round((hex & 255) * k))
  return (r << 16) | (g << 8) | b
}

/**
 * The app's home screen — drawn to match the shipping product.
 *
 * Every number below is measured off a screenshot of the real app rather than
 * composed here. The film used to stand its own dark interface in for this one,
 * which was the film's invention and not the product; a film whose argument is
 * "this is what your parent will actually be holding" cannot afford that on the
 * one screen it is asking the viewer to recognise.
 *
 * Two consequences worth stating, because both are deliberate:
 *
 * 1. The ground is white and the type is dark. The rest of the film is dark
 *    because the space around the device is dark, but the app itself is a light
 *    interface — a phone in a dim room showing a bright screen is also simply
 *    what this looks like.
 * 2. There is no status bar. The reference has none, and the settings gear in
 *    the top right occupies the corner a clock would.
 *
 * The idle screen is deliberately a pure function of nothing: no clock, no
 * animation. Two chapters draw it across a crossfade — the prologue handing the
 * device to 「说得出口」 — and any dependence on local time would make the two
 * disagree for the second they are both on screen.
 */
export function homeScreen(ctx, { listening = false } = {}) {
  const INK = '#131a22'
  const MUTED = '#4d5a63'
  const FAINT = '#53565e'
  const GEAR = '#82939e'
  // Both taken from the product: the idle green and the listening amber are the
  // brand's own two tokens, which is why the film's palette already matched them.
  const GREEN = '#1a806b'
  const AMBER = '#c46a14'

  ctx.setTransform(SCREEN_SUPERSAMPLE, 0, 0, SCREEN_SUPERSAMPLE, 0, 0)
  ctx.globalAlpha = 1

  // Ground.
  //
  // Not #ffffff, and the difference is not a matter of taste. The film's bloom
  // pass keys off a 0.78 threshold in linear light — about sRGB 229 — and the
  // display is the one surface that is *not* tone mapped on its way to that
  // pass. A pure white ground therefore crosses the threshold across the whole
  // panel and the device blows out into a white flare that takes the chapter
  // with it; it also breaks the film's own rule that only brand and status
  // colours are allowed to emit. At #dee1e4 the ground's luminance is 0.75 and
  // it renders as a bright screen without emitting. The white in this design is
  // spent on the two lines of type on the button, where it reads as light.
  ctx.fillStyle = '#dfe4e8'
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)

  // Settings gear, top right.
  gearIcon(ctx, 943, 138, 27, GEAR)

  // The live-status line: a green dot and 「我在」.
  ctx.beginPath()
  ctx.arc(89, 792, 23, 0, Math.PI * 2)
  ctx.fillStyle = GREEN
  ctx.fill()
  text(ctx, '我在', 148, 792, { font: F.ui(72, 400), color: INK, align: 'left' })

  // The one button. Green while idle, amber while the microphone is open — the
  // same two states the product uses, and the same two the film's own palette
  // already had for "waiting" and "listening".
  ctx.beginPath()
  ctx.arc(540, 1186, 298, 0, Math.PI * 2)
  ctx.fillStyle = listening ? AMBER : GREEN
  ctx.fill()

  // Microphone, then the line it is there to explain.
  micIcon(ctx, 540, 1137, 96, 132, '#ffffff')
  text(ctx, listening ? '正在听…' : '说给接线员听', 540, 1279, { font: F.ui(62, 500), color: '#ffffff' })

  text(ctx, listening ? '说完就停，或再点一下' : '点一下开始说话', 540, 1570, {
    font: F.ui(48, 400),
    color: MUTED,
  })

  // The three fallbacks. Laid out to the reference's margins — 130px either
  // side — rather than at even centres, which is what the reference does.
  text(ctx, '打字', 175, 2263, { font: F.ui(46, 400), color: FAINT })
  text(ctx, '请家人帮忙', 446, 2263, { font: F.ui(46, 400), color: FAINT })
  text(ctx, '给家人打电话', 808, 2263, { font: F.ui(46, 400), color: FAINT })
}

/**
 * A programme-into-a-microphone glyph: capsule, cradle, stem, foot.
 *
 * Drawn rather than typed because the interface font has no such glyph, and
 * because the proportions are the reference's: a 96x132 box with the cradle
 * spanning its full width.
 */
function micIcon(ctx, cx, cy, w, h, color) {
  const top = cy - h / 2
  const capW = w * 0.48
  const capH = h * 0.62
  const cradleR = w / 2
  const cradleY = top + h * 0.46
  const lw = w * 0.105

  ctx.save()
  ctx.fillStyle = color
  ctx.strokeStyle = color
  ctx.lineCap = 'round'

  // Capsule.
  const capX = cx - capW / 2
  const capY = top
  const r = capW / 2
  ctx.beginPath()
  ctx.moveTo(capX + r, capY)
  ctx.lineTo(capX + capW - r, capY)
  ctx.quadraticCurveTo(capX + capW, capY, capX + capW, capY + r)
  ctx.lineTo(capX + capW, capY + capH - r)
  ctx.quadraticCurveTo(capX + capW, capY + capH, capX + capW - r, capY + capH)
  ctx.lineTo(capX + r, capY + capH)
  ctx.quadraticCurveTo(capX, capY + capH, capX, capY + capH - r)
  ctx.lineTo(capX, capY + r)
  ctx.quadraticCurveTo(capX, capY, capX + r, capY)
  ctx.closePath()
  ctx.fill()

  // Cradle: the open half-ring the capsule sits in.
  ctx.lineWidth = lw
  ctx.beginPath()
  ctx.arc(cx, cradleY, cradleR - lw / 2, Math.PI * 0.06, Math.PI * 0.94)
  ctx.stroke()

  // Stem and foot.
  ctx.beginPath()
  ctx.moveTo(cx, top + h * 0.80)
  ctx.lineTo(cx, top + h * 0.94)
  ctx.lineWidth = lw * 0.95
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(cx - w * 0.20, top + h * 0.955)
  ctx.lineTo(cx + w * 0.20, top + h * 0.955)
  ctx.lineWidth = lw * 0.95
  ctx.stroke()
  ctx.restore()
}

/** A settings gear: a toothed disc with the reference's very light grey. */
function gearIcon(ctx, cx, cy, r, color) {
  const TEETH = 8
  ctx.save()
  ctx.fillStyle = color
  ctx.beginPath()
  for (let i = 0; i < TEETH * 2; i++) {
    const a = (i / (TEETH * 2)) * Math.PI * 2 - Math.PI / 2
    const rad = i % 2 === 0 ? r : r * 0.76
    const x = cx + Math.cos(a) * rad
    const y = cy + Math.sin(a) * rad
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fill()
  // The hub is cut by drawing the ground colour back over it, not by erasing:
  // this canvas is the device's display, and a hole in it would show the bezel.
  ctx.fillStyle = '#dee1e4'
  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.34, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/**
 * A scratch layer at the screen's logical size, for compositing one screen state
 * over another.
 *
 * The overlay helpers each set their own `globalAlpha`, so a state cannot be
 * faded in by setting the target context's alpha and calling them. Drawing the
 * incoming state into a layer and blitting that layer with `drawImage` is the
 * one route where the fade actually applies — `drawImage` is the only call here
 * that respects the composite alpha it is given.
 */
export function screenLayer() {
  const canvas = document.createElement('canvas')
  canvas.width = SCREEN_W
  canvas.height = SCREEN_H
  return { canvas, ctx: canvas.getContext('2d') }
}

export { F as SCREEN_FONT, T as SCREEN_TYPE }
