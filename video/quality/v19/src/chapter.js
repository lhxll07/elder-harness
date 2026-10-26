// Shared chapter scaffolding.
//
// Every chapter has the same shape: build() once, update(local, absolute, env)
// every frame, and nothing else. The base class exists so a chapter never has
// to think about its own visibility, its own dispose, or where its group sits —
// those are the film's concerns, not any one chapter's.

import * as THREE from 'three'
import { clamp, EASE, smooth01 } from './ease.js'

export class Chapter {
  constructor({ stage, chapter }) {
    this.stage = stage
    this.chapter = chapter
    this.group = new THREE.Group()
    this.group.name = chapter.name
    /** Objects registered for automatic envelope-driven opacity. */
    this.fades = []
  }

  /** Register a mesh so `env` fades it without the chapter writing code for it. */
  fade(mesh, { max = 1, delay = 0, curve = 1 } = {}) {
    this.fades.push({ mesh, max, delay, curve })
    return mesh
  }

  /** Applies the envelope to everything registered with fade(). */
  applyEnvelope(env, local) {
    for (const f of this.fades) {
      const k = f.delay <= 0 ? env : clamp((local - f.delay) / 0.6) * env
      const v = f.curve === 1 ? k : Math.pow(k, f.curve)
      if (f.mesh.userData.setOpacity) f.mesh.userData.setOpacity(v * f.max)
      else if (f.mesh.material) {
        f.mesh.material.opacity = v * f.max
        f.mesh.visible = v > 0.002
      }
    }
  }

  /** Override. `local` is seconds since the chapter started; can be negative. */
  update(local, absolute, env) {
    this.applyEnvelope(env, local)
  }

  /** Override if the chapter needs to release non-disposable resources. */
  dispose() {}
}

/**
 * Places an object on an arc around the phone.
 *
 * Chapters that orbit content around the device all need this, and the angles
 * are easy to get wrong by hand — a 3° error is invisible in code and obvious
 * in a cut.
 */
export function orbitAt(object, { radius, angle, height = 0, tilt = 0 }) {
  const rad = (angle * Math.PI) / 180
  object.position.set(Math.sin(rad) * radius, height, Math.cos(rad) * radius)
  object.rotation.y = rad
  object.rotation.x = tilt * (Math.PI / 180)
  return object
}

/**
 * A soft wipe across an object: 0 -> 1 as a band sweeps it in the given axis.
 * Used for the scan-line beats, where the point is that the machine is reading
 * something in order rather than all at once.
 */
export function sweep(local, { start, dur, index = 0, indexTotal = 1, stagger = 0.35 }) {
  const begin = start + (index / Math.max(1, indexTotal)) * stagger * indexTotal
  return EASE.inOut(clamp((local - begin) / dur))
}

/** Convenience: a boolean beat, ramped. */
export function beat(local, at, dur = 0.5, curve = EASE.exit) {
  return curve(clamp((local - at) / dur))
}

/** 0 before `at`, 1 after, with a smooth edge. */
export function gate(local, at, dur = 0.4, curve = EASE.exit) {
  return curve(clamp((local - at) / dur))
}

/** Text that types on, one character at a time, from a function of t. */
export function typeOn(str, local, { start, cps = 14 }) {
  const n = Math.floor(Math.max(0, (local - start) * cps))
  return str.slice(0, Math.min(str.length, n))
}

export { smooth01 }
