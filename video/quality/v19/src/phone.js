// The phone's pose over the whole film.
//
// Authored here rather than inside chapters, for one specific reason: chapters
// overlap during a transition (their envelopes cross for ~0.9s), and if both
// were writing the phone's transform they would fight for those frames. A
// single function of absolute time has no such failure mode — whichever
// chapters are alive, the device is where the film says it is.
//
// The camera orbits the device; the device mostly does not move. That is a
// deliberate inversion of the usual turntable look: the viewer is the one
// travelling, so the object stays a fixed point to reason about.

import { EASE, clamp, lerp } from './ease.js'
import { VOICE_EXTRA_SECONDS, sharedTimelineTime } from './timeline.js'

const KEYS = [
  // ── 序幕: assembled out of the field ────────────────────────────────────
  { t: 0.0, scale: 0.0001, rotY: 0, rotX: 0, y: 0, z: 0, ease: EASE.exit },
  { t: 3.4, scale: 0.0001, rotY: 0, rotX: 0, y: 0, z: 0, ease: EASE.exit },
  { t: 4.6, scale: 1.0, rotY: 0, rotX: 0, y: 0, z: 0, ease: EASE.exit },
  { t: 10.0, scale: 1.0, rotY: 0, rotX: 0, y: 0, z: 0, ease: EASE.drift },

  // ── 说得出口: settles, breathes ─────────────────────────────────────────
  { t: 16.0, scale: 1.0, rotY: 0, rotX: 0, y: 0, z: 0, ease: EASE.inOut },
  { t: 24.0, scale: 1.0, rotY: -3.5, rotX: 1.5, y: 0.01, z: 0, ease: EASE.drift },
  { t: 33.0, scale: 1.0, rotY: 2.5, rotX: -1.0, y: -0.01, z: 0, ease: EASE.drift },
  { t: 40.0, scale: 1.0, rotY: 0, rotX: 0, y: 0, z: 0, ease: EASE.inOut },

  // ── 看得见页面: the tree grows in depth, so the device tilts back a touch
  // so the screen plane faces the camera more squarely while the camera itself
  // swings wide.
  { t: 44.0, scale: 1.0, rotY: -4, rotX: 6, y: 0.04, z: 0, ease: EASE.inOut },
  { t: 52.0, scale: 1.0, rotY: 3, rotX: 3, y: 0.02, z: 0, ease: EASE.drift },
  { t: 60.0, scale: 1.0, rotY: 0, rotX: 0, y: 0, z: 0, ease: EASE.inOut },

  // ── 办得成事: flat, so the loop drawn above it stays legible ────────────
  { t: 86.0, scale: 1.0, rotY: 0, rotX: 0, y: 0, z: 0, ease: EASE.inOut },

  // ── 办成有证据: dead square to camera. Nothing may be off-axis here — the
  // viewer is reading a ledger, and any perspective skew on the rows costs
  // legibility for no rhetorical gain.
  { t: 124.0, scale: 1.0, rotY: 0, rotX: 0, y: 0, z: 0, ease: EASE.inOut },

  // ── 帮忙有分寸: the ladder is a lateral object, so the device lifts and
  // turns a few degrees to give the tiers a receding edge.
  { t: 132.0, scale: 1.0, rotY: -7, rotX: 2, y: 0.05, z: 0, ease: EASE.inOut },
  { t: 148.0, scale: 1.0, rotY: 7, rotX: 1, y: 0.04, z: 0, ease: EASE.drift },
  { t: 160.0, scale: 1.0, rotY: 0, rotX: 0, y: 0, z: 0, ease: EASE.inOut },

  // ── 交还本人: square, close, still ──────────────────────────────────────
  { t: 180.0, scale: 1.0, rotY: 0, rotX: 0, y: 0, z: 0, ease: EASE.inOut },

  // ── 可信的人: the device recedes so the guard circle can breathe around it.
  { t: 186.0, scale: 0.82, rotY: -5, rotX: 3, y: 0.10, z: 0, ease: EASE.inOut },
  { t: 198.0, scale: 0.80, rotY: 5, rotX: 2, y: 0.08, z: 0, ease: EASE.drift },
  { t: 204.0, scale: 0.90, rotY: 0, rotX: 0, y: 0.06, z: 0, ease: EASE.inOut },

  // ── 教一次就会 / 越用越稳: back to size, with a working tilt ────────────
  { t: 214.0, scale: 0.96, rotY: -6, rotX: 4, y: 0.02, z: 0, ease: EASE.inOut },
  { t: 228.0, scale: 1.0, rotY: 4, rotX: 1, y: 0.0, z: 0, ease: EASE.drift },
  { t: 236.0, scale: 1.0, rotY: 0, rotX: 0, y: 0, z: 0, ease: EASE.inOut },

  // ── 尾声: one final, almost imperceptible settle to dead centre.
  { t: 248.0, scale: 1.0, rotY: 0, rotX: 0, y: 0, z: 0, ease: EASE.exit },
].map((key) => ({ ...key, t: key.t >= 40 ? key.t + VOICE_EXTRA_SECONDS : key.t }))

export function phonePose(t) {
  t = sharedTimelineTime(t)
  const k = KEYS
  if (t <= k[0].t) return { ...k[0], visible: false }
  if (t >= k[k.length - 1].t) return { ...k[k.length - 1], visible: true }

  let i = 0
  while (i < k.length - 1 && k[i + 1].t <= t) i++
  const a = k[i]
  const b = k[i + 1]
  const ease = b.ease ?? EASE.inOut
  const raw = (t - a.t) / (b.t - a.t)
  const m = ease(clamp(raw, 0, 1))

  return {
    scale: lerp(a.scale, b.scale, m),
    rotY: lerp(a.rotY, b.rotY, m) * (Math.PI / 180),
    rotX: lerp(a.rotX, b.rotX, m) * (Math.PI / 180),
    y: lerp(a.y, b.y, m),
    z: lerp(a.z, b.z, m),
    visible: true,
    // 0 until the device has been assembled, for chapters that need to know.
    assembled: clamp((t - 3.4) / 1.2, 0, 1),
  }
}
