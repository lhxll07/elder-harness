// Film entry point.
//
// The contract with the renderer is one function: window.__renderAt(t) draws
// the film at absolute time t and returns nothing. Every chapter is a pure
// function of t, so no state crosses frames and no chapter needs to know
// whether the frame before it was rendered at all — which is what lets 8
// workers render interleaved slices of the same film.

import * as THREE from 'three'
import { Stage, CameraRig, WIDTH, HEIGHT } from './stage.js'
import { CHAPTERS, DURATION, chapterAt, subtitleAt } from './timeline.js'
import { buildCameraPath } from './camera.js'
import { Subtitles } from './subtitles.js'
import { ChapterGuide } from './chapter-guide.js'
import { C } from './palette.js'
import { EASE, clamp, smooth01 } from './ease.js'
import { refineScene } from './shots/cinema-finish.js'

const CHAPTER_MODULES = {
  prologue: () => import('./shots/prologue.js'),
  voice: () => import('./shots/voice.js'),
  observe: () => import('./shots/kinetic-chapter.js'),
  loop: () => import('./shots/kinetic-chapter.js'),
  evidence: () => import('./shots/kinetic-chapter.js'),
  ladder: () => import('./shots/kinetic-chapter.js'),
  handback: () => import('./shots/kinetic-chapter.js'),
  guard: () => import('./shots/kinetic-chapter.js'),
  teach: () => import('./shots/kinetic-chapter.js'),
  evolve: () => import('./shots/kinetic-chapter.js'),
  coda: () => import('./shots/coda.js'),
}

export async function boot() {
  await document.fonts.ready
  await waitForFonts()

  const canvas = document.getElementById('view')
  canvas.width = WIDTH
  canvas.height = HEIGHT

  const stage = new Stage(canvas)
  const rig = new CameraRig()
  buildCameraPath(rig)

  // Drawn on the stage's overlay scene, after the composer — see subtitles.js
  // for why the strip cannot live in the world.
  const subtitles = new Subtitles(stage)
  const chapterGuide = new ChapterGuide(stage)

  // A single frame of slack on each side of a chapter's window, so a chapter's
  // own entrance animation can start a hair before its nominal start without
  // fighting the one before it. Module scope: the film's camera parameters are
  // blended over the same window — see chapterWeights().
  // (FADE, defined once below the imports.)

  // Which chapters to build.
  //
  // The renderer knows the range it is about to ask for and says so in the query
  // string. Building all eleven chapters costs every worker the geometry, the
  // canvases and the shader compiles of all eleven before it draws its first
  // frame — the dominant cost of a short render, and pure waste when the range
  // covers one chapter. A chapter outside the range, plus the crossfade slack on
  // either side of it, can never be shown, so it is never built. With no query
  // string — the live preview, the scene-graph probe — every chapter is built,
  // exactly as before.
  const params = new URLSearchParams(location.search)
  const winFrom = params.has('from') ? Number(params.get('from')) : -Infinity
  const winTo = params.has('to') ? Number(params.get('to')) : Infinity
  const only = params.get('only')
  const selected = only ? new Set(only.split(',').map((name) => name.trim()).filter(Boolean)) : null
  const wanted = CHAPTERS.filter((c) => (!selected || selected.has(c.name)) && c.end >= winFrom - FADE && c.start <= winTo + FADE)

  // Chapters are built eagerly *within that window*: all of them exist before
  // the first frame renders, because a chapter that appears mid-render would
  // make early frames and late frames disagree about the scene graph. The
  // imports are started together rather than one after another; `build` itself
  // is synchronous, so construction still happens one chapter at a time.
  const chapters = await Promise.all(
    wanted.map(async (chapter) => {
      const loader = CHAPTER_MODULES[chapter.name]
      if (!loader) throw new Error(`no chapter module for "${chapter.name}"`)
      const mod = await loader()
      const instance = mod.build({ stage, chapter })
      refineScene(instance.group)
      instance.group.visible = false
      stage.world.add(instance.group)
      return { ...chapter, instance }
    }),
  )
  const apertures = { ...APERTURE }
  const blurs = { ...MAX_BLUR }
  for (const chapter of chapters) {
    apertures[chapter.name] = chapter.instance.aperture ?? apertures[chapter.name]
    blurs[chapter.name] = chapter.instance.maxBlur ?? blurs[chapter.name]
  }
  const continuousPhones = new Set(CHAPTERS.map((chapter) => chapter.name))

  function frameAt(t) {
    stage.setTime(t)
    stage.setFade(globalFade(t))

    for (const ch of chapters) {
      const visible = t > ch.start - FADE && t < ch.end + FADE
      ch.instance.group.visible = visible
      if (!visible) continue

      // Local time: a chapter is written as if it began at zero.
      const local = t - ch.start
      // The crossfade between chapters. Never a cut — always an overlap, and
      // the camera is moving through both of them at the time it happens.
      const env = selected?.size === 1 ? 1 : chapterEnvelope(t, ch.start, ch.end, FADE)
      ch.instance.update(local, t, env)
    }
    const phoneChapter = chapters.find((chapter) => t >= chapter.start && t < chapter.end && chapter.instance.phone)
    if (phoneChapter) {
      for (const chapter of chapters) {
        if (continuousPhones.has(chapter.name) && chapter !== phoneChapter) chapter.instance.phone.visible = false
      }
    }

    subtitles.update(t)
    chapterGuide.update(t)

    const cameraChapter = chapters.find((chapter) => t >= chapter.start && t < chapter.end && chapter.instance.cameraRig)
    const activeRig = cameraChapter?.instance.cameraRig ?? rig
    const cam = activeRig.apply(t, stage.camera, stage.rig, {
      handheld: handheldAmount(t, chapters),
    })
    for (const chapter of chapters) {
      if (chapter.instance.group.visible) chapter.instance.afterCamera?.(stage.camera)
    }
    const dist = cameraChapter ? cam.pos.distanceTo(cam.look) : cam.pos.length()
    stage.setFocus(dist, focusAperture(t, apertures, chapters), focusBlur(t, blurs, chapters))
    stage.setExposure(exposureAt(t, chapters))

    stage.render()
  }

  // Debug handle. `render/probe.mjs` reads the scene graph through this to
  // answer "why is nothing on screen at t" without a round of guessing.
  window.__stage = stage

  window.__renderAt = frameAt
  window.__film = {
    title: '银龄智办 — 演示短片',
    duration: DURATION,
    width: WIDTH,
    height: HEIGHT,
    renderWidth: stage.renderWidth,
    renderHeight: stage.renderHeight,
    renderScale: stage.renderScale,
    shots: CHAPTERS.map((c) => ({ name: c.name, title: c.title, start: c.start, end: c.end })),
  }

  // Draw frame zero now: it warms every material, compiles every shader, and
  // means a worker's first capture does not pay the compile cost.
  frameAt(0)

  document.getElementById('boot')?.classList.add('hidden')
  window.__ready = true
}

/**
 * How long a chapter's window is widened at each end.
 *
 * Chapters overlap for this long, which is what makes a four-minute film with no
 * cuts in it possible: one chapter is always arriving while the last is leaving.
 */
const FADE = 0.9

/**
 * Chapter envelope: fades in over `fade` at the start, out over the end.
 *
 * Both ends are eased with curves that leave and arrive slowly, so two chapters
 * overlapping in the same frame are never both at 50% and washed out — one is
 * always dominant.
 */
function chapterEnvelope(t, start, end, fade) {
  const inK = EASE.exit(clamp((t - (start - fade)) / (fade * 1.35)))
  const outK = EASE.entry(clamp(((end + fade) - t) / (fade * 1.35)))
  return Math.min(inK, outK)
}

/**
 * How much each chapter owns the frame at time t.
 *
 * `chapterAt` answers "which chapter is this" with a single name. That is the
 * right answer for a chapter's own content and the wrong one for the film's
 * camera: exposure, aperture and handheld amplitude were all read from that one
 * name, so every chapter boundary cut them in a single frame.
 *
 * Measured across the prologue's hand-off to 「说得出口」, the frame at exactly
 * 16.000s differed from the frame before it by 17.8x the median frame-to-frame
 * difference over that stretch — the whole image stepping 8.7% brighter and the
 * depth of field changing with it, in one frame of a film that has no cuts
 * anywhere else. These are the same weights the scene already uses for
 * visibility, so a camera parameter now crosses over exactly as the chapters do.
 */
function chapterWeights(t, candidates = CHAPTERS) {
  const out = []
  for (const c of candidates) {
    const w = chapterEnvelope(t, c.start, c.end, FADE)
    if (w > 0.001) out.push([c, w])
  }
  return out.length ? out : [[chapterAt(t), 1]]
}

/** A per-chapter table, read as a weighted blend rather than a lookup. */
function blendChapter(t, table, fallback, candidates = CHAPTERS) {
  let sum = 0
  let total = 0
  for (const [c, w] of chapterWeights(t, candidates)) {
    sum += (table[c.name] ?? fallback) * w
    total += w
  }
  return total > 0 ? sum / total : fallback
}

/** Fade the whole image up from black at the very start and down at the end. */
function globalFade(t) {
  const inK = smooth01(t, -0.6, 1.8)
  const outK = 1 - smooth01(t, DURATION - 2.4, 2.4)
  return Math.min(inK, outK)
}

/**
 * Handheld amplitude per chapter.
 *
 * The camera is never perfectly still — a locked-off shot in a film like this
 * reads as a still image. But the amount is a dramatic choice: the evidence
 * chapter is nearly static because the viewer must read numbers, and the
 * prologue drifts because nothing is being read yet.
 */
function handheldAmount(t, candidates = CHAPTERS) {
  let sum = 0
  let total = 0
  for (const [c, w] of chapterWeights(t, candidates)) {
    const local = t - c.start
    const base = {
      prologue: 0.030,
      voice: 0.018,
      observe: 0.016,
      loop: 0.020,
      evidence: 0.008,
      ladder: 0.014,
      handback: 0.012,
      guard: 0.007,
      teach: 0.006,
      evolve: 0.007,
      coda: 0.003,
    }[c.name] ?? 0.016

    // Settle to almost nothing at the start of a chapter and let it breathe up.
    const settle = 0.4 + 0.6 * smooth01(local, 0.2, 2.2)
    sum += base * settle * w
    total += w
  }
  return total > 0 ? sum / total : 0.016
}

const APERTURE = {
  prologue: 0.00055,
  voice: 0.0008,
  observe: 0.0014,
  loop: 0.0022,
  evidence: 0.0012,
  ladder: 0.0018,
  handback: 0.0016,
  guard: 0.0022,
  teach: 0.0020,
  evolve: 0.0020,
  coda: 0.0026,
}

function focusAperture(t, table = APERTURE, candidates = CHAPTERS) {
  return blendChapter(t, table, 0.0018, candidates)
}

/** The two chapters the film asks the viewer to read get a tighter depth budget. */
const MAX_BLUR = Object.fromEntries(CHAPTERS.map((c) => [c.name, c.name === 'prologue' ? 0.0028 : c.name === 'voice' ? 0.0034 : c.core ? 0.0042 : 0.0072]))

function focusBlur(t, table = MAX_BLUR, candidates = CHAPTERS) {
  return blendChapter(t, table, 0.0072, candidates)
}

const EXPOSURE = {
  prologue: 0.92,
  voice: 1.00,
  observe: 1.02,
  loop: 1.00,
  evidence: 1.06,
  ladder: 1.00,
  handback: 1.02,
  guard: 0.98,
  teach: 1.00,
  evolve: 1.00,
  coda: 0.96,
}

function exposureAt(t, candidates = CHAPTERS) {
  return blendChapter(t, EXPOSURE, 1.0, candidates)
}

async function waitForFonts() {
  const wanted = [
    '300 32px "Noto Sans CJK SC"',
    '400 32px "Noto Sans CJK SC"',
    '500 32px "Noto Sans CJK SC"',
    '600 32px "Noto Sans CJK SC"',
    '700 32px "Noto Sans CJK SC"',
    '300 32px "Noto Serif CJK SC"',
    '400 32px "Noto Serif CJK SC"',
  ]
  await Promise.all(wanted.map((f) => document.fonts.load(f, '银龄智办办成有证据帮忙有分寸')))
  await document.fonts.ready
}
