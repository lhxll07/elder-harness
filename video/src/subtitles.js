// Subtitles, drawn in screen space on the stage's overlay scene.
//
// Why not in the world, parented to the camera: the composer's depth-of-field
// pass renders the entire scene with an override material to build a depth
// buffer, and a subtitle hanging 1.9 units in front of a camera focused at 7 is
// blurred exactly as a close foreground object would be. Bloom and film grain
// take another bite. The strip has to survive all three, so it is drawn after
// the composer, in an orthographic space where one unit is one pixel — which
// also makes the type sizes below mean what they say.
//
// The type is the film's own: a Chinese line that carries the argument, and an
// English line under it that says the same thing rather than translating it
// word for word.

import * as THREE from 'three'
import { C } from './palette.js'
import { EASE, clamp } from './ease.js'
import { subtitleAt } from './timeline.js'
import { textPlane, textTexture } from './text.js'
import { HEIGHT } from './stage.js'

// Sizes in pixels, at 1080p. 56px is the floor the storyboard sets for the
// Chinese line, and the sizes are the reason this module draws in screen space.
const ZH_PX = 56
const EN_PX = 34

// Distance from the bottom of the frame, in pixels, to the Chinese line's
// baseline box. Clear of the 1080p safe area and above any player chrome.
const ZH_Y = -HEIGHT / 2 + 148
const EN_Y = ZH_Y - 62

export class Subtitles {
  constructor(stage) {
    this.stage = stage
    this.group = new THREE.Group()
    this.group.renderOrder = 100
    stage.overlay.add(this.group)

    // Scrim: a soft vertical gradient behind the type, so a bright screen
    // behind it never eats the subtitle.
    this.scrim = makeScrim()
    this.group.add(this.scrim)

    this.zh = null
    this.en = null
    this.currentKey = ''
  }

  update(t) {
    const active = subtitleAt(t)
    // Only one cue is ever on screen: the film's cues do not overlap, and if two
    // ever did the second would silently win. Asserting that here keeps the cue
    // table honest.
    const cue = active[0] ?? null

    const key = cue ? `${cue.a}|${cue.zh}|${cue.en}` : ''
    if (key !== this.currentKey) {
      this.currentKey = key
      this._rebuild(cue)
    }

    if (!cue) {
      this.scrim.material.opacity = 0
      if (this.zh) this.zh.visible = false
      if (this.en) this.en.visible = false
      return
    }

    // Entrance: the Chinese line lands first and the English follows 120ms
    // behind it. That stagger is the difference between "two lines appeared" and
    // "a sentence was spoken".
    const zhIn = EASE.exit(clamp((t - cue.a) / 0.55))
    const enIn = EASE.exit(clamp((t - cue.a - 0.12) / 0.5))
    const out = EASE.entry(clamp((cue.b - t) / 0.45))
    const zhA = Math.min(zhIn, out)
    const enA = Math.min(enIn, out)

    if (this.zh) {
      this.zh.userData.setOpacity(zhA)
      // 14px of rise over the entrance. In this space that is literally 14px.
      this.zh.position.y = ZH_Y + (1 - zhIn) * 14
    }
    if (this.en) {
      this.en.userData.setOpacity(enA * 0.88)
      this.en.position.y = EN_Y + (1 - enIn) * 10
    }
    this.scrim.material.opacity = Math.min(zhIn, out) * 0.85
  }

  _rebuild(cue) {
    for (const key of ['zh', 'en']) {
      const old = this[key]
      if (!old) continue
      this.group.remove(old)
      old.geometry.dispose()
      old.material.dispose()
      this[key] = null
    }
    if (!cue) return

    // `worldHeight` is the plane's height in overlay units, which are pixels —
    // so the size is stated once and the raster underneath is what text.js
    // actually rasterised.
    //
    // The plane is sized to the raster's real height, not to the line box.
    // text.js reserves vertical padding above and below the line — room for
    // descenders and for a halo — so one 56px line comes back as a 118px raster.
    // Handing `worldHeight` the line box alone (56 * 1.34 = 75) squeezed that
    // raster to 64%: the storyboard's 56px floor arrived on screen as 35px, and
    // the supersample below it was spent on pixels that were then thrown away.
    // Asking the raster how tall it is costs one cached lookup and makes the
    // declared size mean what it says.
    const zhOpts = {
      size: ZH_PX,
      font: '600 1px "Noto Sans CJK SC", "Noto Sans CJK", sans-serif',
      color: C.text,
      align: 'center',
      supersample: this.stage.renderScale,
    }
    this.zh = textPlane(cue.zh, { ...zhOpts, worldHeight: textTexture(cue.zh, zhOpts).height })
    this.zh.position.set(0, ZH_Y, 0)
    this.zh.renderOrder = 101
    this.group.add(this.zh)

    const enOpts = {
      size: EN_PX,
      font: 'italic 400 1px "Noto Serif CJK SC", "Liberation Serif", Georgia, serif',
      color: 0xd8d0bf,
      align: 'center',
      supersample: this.stage.renderScale,
    }
    this.en = textPlane(cue.en, { ...enOpts, worldHeight: textTexture(cue.en, enOpts).height })
    this.en.position.set(0, EN_Y, 0)
    this.en.renderOrder = 101
    this.group.add(this.en)
  }
}

/**
 * The gradient behind the type.
 *
 * Sized in the overlay's own pixel units and pinned to the bottom of the frame,
 * so it covers the whole safe area at any type size the cue table grows to.
 */
function makeScrim() {
  const canvas = document.createElement('canvas')
  canvas.width = 8
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  const g = ctx.createLinearGradient(0, 0, 0, 256)
  g.addColorStop(0, 'rgba(8,12,16,0)')
  g.addColorStop(0.35, 'rgba(8,12,16,0.55)')
  g.addColorStop(1, 'rgba(8,12,16,0.88)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 8, 256)

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace

  const h = 340
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    opacity: 0,
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2400, h), mat)
  mesh.position.set(0, -HEIGHT / 2 + h / 2 - 20, -1)
  mesh.renderOrder = 99
  return mesh
}
