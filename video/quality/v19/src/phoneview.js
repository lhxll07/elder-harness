// The phone screen as a live surface.
//
// A chapter draws into a 2D canvas and this hands the result to the screen
// material. The texture is uploaded only when the chapter says the content
// changed, so a chapter that draws a static page uploads one texture for its
// whole length instead of sixty per second.
//
// The canvas is 1080×2230 while the screen plane is 0.676×1.426 world units, so
// a 1:1 texel-to-pixel mapping happens at ~4.0 units from the camera. Closer
// than that the screen is being read and the extra resolution is earned.

import * as THREE from 'three'
import { SCREEN_W, SCREEN_H, SCREEN_SUPERSAMPLE } from './screen.js'

export class PhoneView {
  constructor(stage, phone) {
    this.stage = stage
    this.phone = phone

    // The canvas carries the interface at supersampled resolution while all the
    // drawing code below keeps using the logical 1080-wide coordinate system.
    // Chapters never see the extra pixels; the screen just reads sharper.
    this.canvas = document.createElement('canvas')
    this.canvas.width = Math.round(SCREEN_W * SCREEN_SUPERSAMPLE)
    this.canvas.height = Math.round(SCREEN_H * SCREEN_SUPERSAMPLE)
    this.ctx = this.canvas.getContext('2d')
    this.scale = SCREEN_SUPERSAMPLE

    this.texture = new THREE.CanvasTexture(this.canvas)
    this.texture.colorSpace = THREE.SRGBColorSpace
    // No mipmaps.
    //
    // The screen is a UI surface, always the largest and most important thing
    // in frame, and the camera views it at an angle for much of the film.
    // Mipmapped minification picks a level from the *most* compressed axis, so
    // at even a moderate tilt it drops to a quarter-resolution level and the
    // interface turns to stripes — which is exactly what the first render did.
    // The texture is fixed-size and drawn 1:1 or larger, so there is nothing
    // for a mip chain to buy in the first place.
    this.texture.minFilter = THREE.LinearFilter
    this.texture.magFilter = THREE.LinearFilter
    this.texture.generateMipmaps = false
    this.texture.anisotropy = 16

    phone.userData.screenMat.map = this.texture
    phone.userData.screenMat.color.setHex(0xffffff)
    phone.userData.screenMat.needsUpdate = true

    this._lastFrame = -1
    this.resetTransform()
  }

  /**
   * Puts the context back into logical coordinates.
   *
   * Every chapter's drawing code is written against SCREEN_W x SCREEN_H. This
   * scales that coordinate system up to the real canvas once, so no chapter
   * ever has to know the supersample factor exists — and, critically, so a
   * chapter that calls ctx.setTransform itself (several do, to draw rotated
   * cards) has a documented way back.
   */
  resetTransform() {
    this.ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0)
  }

  /** Direct access for a chapter to draw with. */
  get g() {
    return this.ctx
  }

  /**
   * Marks the canvas dirty. Call once per frame after drawing.
   * `everyN` throttles the upload for cues that do not need per-frame fidelity.
   */
  commit(t, everyN = 1) {
    const n = Math.floor(t * 60)
    if (n % everyN !== 0) return
    if (n === this._lastFrame) return
    this._lastFrame = n
    this.texture.needsUpdate = true
  }

  /** Force an upload regardless of throttle — for a hard content change. */
  commitNow() {
    this.texture.needsUpdate = true
  }

  /** Screen brightness. Chapters dim it when the phone is not the subject. */
  setBrightness(v) {
    this.phone.userData.screenMat.color.setScalar(v)
  }
}

/**
 * A screen that is off. Chapters that need the glass to read as dark use this
 * rather than hiding the mesh, because a hidden mesh leaves a hole in the
 * reflections.
 */
export function blankScreen(ctx, { luma = 12 } = {}) {
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = `rgb(${luma},${luma + 4},${luma + 6})`
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
}
