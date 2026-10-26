// Text rasterisation.
//
// Chinese has no usable MSDF atlas shipped with three.js, and generating one for
// a film's whole vocabulary is a build step that can fail on a render box. So
// text is rasterised with canvas 2D at a deliberately generous size — 3x the
// largest pixel size it will ever occupy on screen — and mapped onto a plane.
// At 1080p and the sizes this film uses, that is indistinguishable from vector
// under the camera moves it actually performs, and it has no build step.
//
// Every texture is cached by content + style. A title that appears twice in the
// film is rasterised once.

import * as THREE from 'three'
import { css, C } from './palette.js'

const cache = new Map()

const CJK = '"Noto Sans CJK SC", "Noto Sans CJK", "Source Han Sans SC", "WenQuanYi Micro Hei", sans-serif'
const LATIN = '"Inter", "Helvetica Neue", "Liberation Sans", "DejaVu Sans", sans-serif'
const SERIF = '"Noto Serif CJK SC", "Liberation Serif", Georgia, serif'

export const FONT = {
  /** Chapter titles and the film's own display type. */
  display: `300 1px ${CJK}`,
  title: `700 1px ${CJK}`,
  /** Captions and on-screen UI text. */
  body: `400 1px ${CJK}`,
  bodyBold: `600 1px ${CJK}`,
  /** English subtitle line. */
  latin: `400 1px ${LATIN}`,
  latinItalic: `italic 400 1px ${SERIF}`,
  latinCaps: `500 1px ${LATIN}`,
}

/**
 * Rasterise one or more lines to a texture.
 *
 * @param {string|string[]} content
 * @param {object} opts
 * @param {number} opts.size       px height of the em box, at final display size
 * @param {string} opts.font       family string from FONT
 * @param {number} opts.color      hex int
 * @param {number} opts.letterSpacing  px, applied between glyphs
 * @param {number} opts.lineHeight  multiplier
 * @param {string} opts.align      'left' | 'center' | 'right'
 * @param {number} opts.maxWidth   px; wraps CJK greedily when exceeded
 * @param {number} opts.supersample  rasterisation multiple (default 3)
 * @returns {{texture: THREE.Texture, width: number, height: number, aspect: number}}
 */
export function textTexture(content, opts = {}) {
  const lines = Array.isArray(content) ? content.flatMap((s) => wrap(String(s), opts)) : wrap(String(content), opts)
  const size = opts.size ?? 42
  const ss = opts.supersample ?? 3
  const font = opts.font ?? FONT.body
  const color = opts.color ?? C.text
  const letterSpacing = opts.letterSpacing ?? 0
  const lineHeight = opts.lineHeight ?? 1.34
  const align = opts.align ?? 'center'
  const weight = opts.weight ?? 1

  const key = JSON.stringify([lines, size, font, color, letterSpacing, lineHeight, align, ss, weight])
  if (cache.has(key)) return cache.get(key)

  const fontStr = font.replace('1px', `${size}px`)
  const measure = mkCanvas(8, 8).ctx
  measure.font = fontStr

  const lineWidths = lines.map((l) => measureText(measure, l, letterSpacing))
  const textW = Math.max(1, ...lineWidths)
  const linePx = size * lineHeight
  // Vertical padding leaves room for descenders and for a bloom halo that would
  // otherwise clip at the texture edge.
  const padX = Math.ceil(size * 0.34) + 4
  const padY = Math.ceil(size * 0.30) + 4
  const w = Math.ceil(textW + padX * 2)
  const h = Math.ceil(linePx * lines.length + padY * 2)

  const { canvas, ctx } = mkCanvas(w * ss, h * ss)
  ctx.scale(ss, ss)
  ctx.font = fontStr
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillStyle = css(color)

  lines.forEach((line, i) => {
    const lw = lineWidths[i]
    let x = padX
    if (align === 'center') x = (w - lw) / 2
    else if (align === 'right') x = w - padX - lw
    const y = padY + linePx * (i + 0.5)
    fillTracked(ctx, line, x, y, letterSpacing)
  })

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = true
  texture.anisotropy = 8
  texture.needsUpdate = true

  const result = { texture, width: w, height: h, aspect: w / h }
  cache.set(key, result)
  return result
}

/**
 * A textured plane sized in world units, with the raster's own aspect ratio.
 * `height` is the world height of the em box plus its padding.
 */
export function textPlane(content, opts = {}) {
  const height = opts.worldHeight ?? 0.3
  const { texture, aspect, width, height: texH } = textTexture(content, opts)
  const geo = new THREE.PlaneGeometry(height * aspect, height)
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    opacity: opts.opacity ?? 1,
    side: THREE.DoubleSide,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.userData.textureInfo = { width, height: texH, aspect }
  // Convenience: the caller almost always wants to fade it later.
  mesh.userData.setOpacity = (v) => {
    mat.opacity = v
    mesh.visible = v > 0.001
  }
  return mesh
}

function mkCanvas(w, h) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.ceil(w))
  canvas.height = Math.max(1, Math.ceil(h))
  return { canvas, ctx: canvas.getContext('2d') }
}

function measureText(ctx, text, spacing) {
  if (!spacing) return ctx.measureText(text).width
  let w = 0
  for (const ch of text) w += ctx.measureText(ch).width + spacing
  return Math.max(0, w - spacing)
}

/** Draws with per-glyph advance, since canvas has no letterSpacing everywhere. */
function fillTracked(ctx, text, x, y, spacing) {
  if (!spacing) {
    ctx.fillText(text, x, y)
    return
  }
  let cx = x
  for (const ch of text) {
    ctx.fillText(ch, cx, y)
    cx += ctx.measureText(ch).width + spacing
  }
}

/**
 * Greedy wrap. Latin breaks on spaces, CJK breaks anywhere — which is what a
 * reader of either script expects, and mixing the rule would break both.
 */
function wrap(text, { maxWidth }) {
  if (!maxWidth) return [text]
  const lines = []
  let line = ''
  let width = 0
  const ctx = mkCanvas(8, 8).ctx
  ctx.font = '400 100px sans-serif'

  for (const ch of text) {
    if (ch === '\n') {
      lines.push(line)
      line = ''
      width = 0
      continue
    }
    const isCJK = /[　-鿿＀-￯]/.test(ch)
    const isSpace = ch === ' '
    const cw = (isCJK || isSpace ? 100 : 52) * 0.42
    if (width + cw > maxWidth && line) {
      if (isSpace) {
        lines.push(line)
        line = ''
        width = 0
        continue
      }
      lines.push(line)
      line = ch
      width = cw
    } else {
      line += ch
      width += cw
    }
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

export function disposeTextCache() {
  for (const { texture } of cache.values()) texture.dispose()
  cache.clear()
}
