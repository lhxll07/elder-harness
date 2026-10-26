import { Chapter } from '../chapter.js'
import { CameraRig } from '../stage.js'
import { makePhone } from '../props.js'
import { PhoneView } from '../phoneview.js'
import { SCREEN_W, SCREEN_H } from '../screen.js'
import { hospitalPage, floatingPill } from './voice.js'
import { journeyPage } from './journey-ui.js'
import { fade } from './mechanism-geometry.js'
import { THREE, caption, attach, smooth01, windowAt } from './cinema-props.js'
import { buildPerception } from './cinema-perception.js'
import { buildAgency } from './cinema-agency.js'
import { buildProof } from './cinema-proof.js'
import { buildFinale } from './cinema-finale.js'
import { finishChapter } from './cinema-finish.js'

export function buildCinema(context) {
  return new CinemaChapter(context)
}

class CinemaChapter extends Chapter {
  constructor(context) {
    super(context)
    this.kind = this.chapter.name
    this.group.name = this.kind
    this.duration = this.chapter.end - this.chapter.start
    this.phone = attach(this.group, makePhone())
    this.phone.name = 'phone'
    this.phone.scale.setScalar(1.1)
    this.view = new PhoneView(this.stage, this.phone)
    this.pages = Object.fromEntries(['departments', 'doctors', 'dates', 'review', 'waiting', 'result'].map((kind) => [kind, journeyPage(kind)]))
    this.pages.home = hospitalPage()
    this.billboards = []
    this.quaternion = new THREE.Quaternion()
    this.phoneMaterials = []
    const seen = new Set()
    this.phone.traverse((object) => {
      if (!object.material) return
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (seen.has(material)) continue
        seen.add(material)
        material.transparent = true
        material.needsUpdate = true
        this.phoneMaterials.push({ material, opacity: material.opacity, depthWrite: material.depthWrite })
      }
    })
    this.aperture = 0.00012
    this.maxBlur = 0.0007
    if (['observe', 'loop'].includes(this.kind)) buildPerception(this)
    else if (['guard', 'handback'].includes(this.kind)) buildAgency(this)
    else if (['evidence', 'teach'].includes(this.kind)) buildProof(this)
    else buildFinale(this)
    if (this.chapter.start >= 104) finishChapter(this)
  }

  text(content, point, height = 0.16, color) {
    const mesh = attach(this.group, caption(content, height, color), point)
    mesh.name = content
    mesh.material.depthTest = false
    mesh.renderOrder = 30
    this.billboards.push(mesh)
    return mesh
  }

  show(object, amount) {
    fade(object, amount * this.env)
  }

  device(local, point, scale = 1.1, rotation = [0, 0, 0], start = 1.1, end = this.duration - 3.3) {
    const amount = windowAt(local, start, end, 1.3, 1.2)
    this.phone.position.set(...point).multiplyScalar(amount)
    this.phone.scale.setScalar(1.1 + amount * (scale - 1.1))
    this.phone.rotation.set(...rotation.map((value) => value * amount))
    return amount
  }

  dimPhone(opacity = 1) {
    this.phone.visible = opacity > 0.001
    for (const entry of this.phoneMaterials) {
      entry.material.opacity = entry.opacity * opacity
      entry.material.transparent = true
      entry.material.depthWrite = entry.depthWrite && opacity >= 0.999
    }
  }

  camera(keys) {
    this.cameraRig = new CameraRig()
    this.cameraRig.at(this.chapter.start - 0.9, [0, 0.10, 4.45], [0, 0, 0], { fov: 34 })
    this.cameraRig.at(this.chapter.start + 0.9, [0, 0.10, 4.45], [0, 0, 0], { fov: 34 })
    for (const [local, position, look, fov = 38, roll = 0] of keys) this.cameraRig.at(this.chapter.start + local, position, look, { fov, roll })
    this.cameraRig.at(this.chapter.end - 0.9, [0, 0.10, 4.45], [0, 0, 0], { fov: 34 })
    this.cameraRig.at(this.chapter.end + 0.9, [0, 0.10, 4.45], [0, 0, 0], { fov: 34 })
  }

  page(first, second, local, start = Infinity, duration = 0.8) {
    const context = this.view.g
    context.drawImage(this.pages[first], 0, 0, SCREEN_W, SCREEN_H)
    const blend = smooth01(local, start, duration)
    if (second && blend > 0) {
      context.save()
      context.globalAlpha = blend
      context.drawImage(this.pages[second], 0, 0, SCREEN_W, SCREEN_H)
      context.restore()
    }
  }

  update(local, absolute, env) {
    this.env = env
    this.phone.visible = true
    this.phone.position.set(0, 0, 0)
    this.phone.scale.setScalar(1.1)
    this.phone.rotation.set(0, 0, 0)
    this.dimPhone(1)
    this.animate(local)
    this.finish?.(local)
    floatingPill(this.view.g, absolute - 44, 1, this.status ?? { label: '正在办', working: true })
    this.view.commitNow()
  }

  afterCamera(camera) {
    camera.getWorldQuaternion(this.quaternion)
    for (const mesh of this.billboards) mesh.quaternion.copy(this.quaternion)
  }
}
