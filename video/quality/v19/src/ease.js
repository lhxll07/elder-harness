// Easing and timing. Every function here is pure in t — nothing accumulates.
//
// That purity is load-bearing: 14400 frames get rendered by 8 workers at
// arbitrary times, so "the same second of the film" must produce the same
// pixels no matter who renders it or in what order.

/**
 * Ramp 0 -> 1 over `dur` seconds starting at `start`. Negative `dur` runs
 * backwards.
 *
 * The clamp has to happen BEFORE the cubic. `x*x*(3-2x)` is only a smoothstep
 * on [0,1]; past 1 it dives sharply back down, so clamping the *result* turns
 * "past the end of the ramp" into 0 instead of 1.
 */
export function smooth01(t, start, dur) {
  if (dur === 0) return t >= start ? 1 : 0
  const raw = dur > 0 ? (t - start) / dur : 1 - (t - start) / -dur
  return smoothstep01(raw)
}

export function smoothstep01(x) {
  const c = clamp01(x)
  return c * c * (3 - 2 * c)
}

export function clamp01(x) {
  return x < 0 ? 0 : x > 1 ? 1 : x
}

export function clamp(x, a, b) {
  return x < a ? a : x > b ? b : x
}

export function lerp(a, b, k) {
  return a + (b - a) * k
}

export function easeInOut(x) {
  const c = clamp01(x)
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2
}

export function easeOut(x) {
  return 1 - Math.pow(1 - clamp01(x), 3)
}

export function easeIn(x) {
  const c = clamp01(x)
  return c * c * c
}

/** A pulse that rises and falls once across [start, start+dur]. */
export function pulse(t, start, dur) {
  const x = clamp01((t - start) / dur)
  return Math.sin(x * Math.PI)
}

/** Overdamped spring: settles rather than stopping. */
export function spring(t, damping = 6, freq = 12) {
  if (t <= 0) return 0
  return 1 - Math.exp(-damping * t) * Math.cos(freq * t)
}

// ---------------------------------------------------------------------------
// Motion curves
// ---------------------------------------------------------------------------

/**
 * A CSS cubic-bezier as a JS function, solved with Newton-Raphson plus a
 * bisection fallback so the flat ends never produce NaN.
 *
 * These curves are the difference between "an object moved" and "an object
 * arrived". A long decelerating tail reads as weight; a linear ramp reads as
 * a slideshow.
 */
export function cubicBezier(x1, y1, x2, y2) {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by

  const fx = (t) => ((ax * t + bx) * t + cx) * t
  const fy = (t) => ((ay * t + by) * t + cy) * t
  const dfx = (t) => (3 * ax * t + 2 * bx) * t + cx

  return (x) => {
    const target = clamp01(x)
    if (target === 0 || target === 1) return target
    let t = target
    for (let i = 0; i < 6; i++) {
      const err = fx(t) - target
      if (Math.abs(err) < 1e-6) return fy(t)
      const d = dfx(t)
      if (Math.abs(d) < 1e-6) break
      t -= err / d
      if (t < 0 || t > 1) break
    }
    let lo = 0
    let hi = 1
    t = target
    for (let i = 0; i < 24; i++) {
      const err = fx(t) - target
      if (Math.abs(err) < 1e-6) break
      if (err > 0) hi = t
      else lo = t
      t = (lo + hi) / 2
    }
    return fy(t)
  }
}

// The three curves the film is actually built on. Named for feel, not for math,
// so a shot says `EASE.exit` instead of `cubicBezier(0.16, 1, 0.3, 1)`.
export const EASE = {
  /** Long deceleration tail. Entrances, arrivals, anything with weight. */
  exit: cubicBezier(0.16, 1, 0.3, 1),
  /** Symmetric. Camera moves, traversals, cross-space travel. */
  inOut: cubicBezier(0.65, 0, 0.35, 1),
  /** Slow start, hard finish. Departures, dismissals, things being taken away. */
  entry: cubicBezier(0.7, 0, 0.84, 0),
  /** Gentle overshoot. Buttons, confirmations, anything the hand touched. */
  overshoot: cubicBezier(0.34, 1.56, 0.64, 1),
  /** Long, flat middle. For the slow drift under a text hold. */
  drift: cubicBezier(0.4, 0, 0.6, 1),
}

/** Ramp using a named curve. */
export function ramp(t, start, dur, curve = EASE.inOut) {
  return curve(clamp01((t - start) / dur))
}

/**
 * Trapezoid: 0 outside, 1 inside, eased at both ends. This is how almost every
 * element in the film appears and disappears.
 */
export function window01(t, start, end, fadeIn = 0.6, fadeOut = 0.6) {
  const inK = fadeIn <= 0 ? (t >= start ? 1 : 0) : EASE.exit(clamp01((t - start) / fadeIn))
  const outK = fadeOut <= 0 ? (t <= end ? 1 : 0) : EASE.entry(clamp01((end - t) / fadeOut))
  return Math.min(inK, outK)
}

/** Deterministic per-index pseudo-random in [0,1). Index-stable across workers. */
export function hash01(n) {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b)
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35)
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296
}

export function hash11(n, salt = 0) {
  return hash01(n * 1523 + salt * 7919)
}
