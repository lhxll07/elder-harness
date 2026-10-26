import { THREE, add, surface, cropPage, fade, smooth01, lerp } from './compiler-design.js'

const REGIONS = {
  reobserve: [60, 104, 900, 470],
  provenance: [60, 318, 900, 256],
  shadow: [40, 70, 1520, 550],
}

export class FusionHandoff {
  constructor(parent, film) {
    this.film = film
    this.canvas = document.createElement('canvas')
    this.canvas.width = 3600
    this.canvas.height = 1800
    this.context = this.canvas.getContext('2d', { willReadFrequently: true })
    this.mesh = add(parent, surface(this.canvas, 1, 1))
    this.mesh.name = 'inherited-interface-surface'
    this.mesh.renderOrder = 91
    this.mesh.material.depthWrite = false
    this.mesh.material.depthTest = false
    this.mesh.material.fog = false
    this.result = cropPage(film.pages.result, 75, 1150, 930, 200)
    this.report = document.createElement('canvas')
    this.report.width = 1320
    this.report.height = 738
  }

  origin(kind) {
    const film = this.film
    if (kind === 'reobserve') {
      const row = film.runtime.listRows[0]
      row.updateWorldMatrix(true, false)
      return { image: film.runtime.rows[0], position: row.getWorldPosition(new THREE.Vector3()), quaternion: row.getWorldQuaternion(new THREE.Quaternion()), width: 2.8, height: 2.8 * 304 / 960 }
    }
    if (kind === 'provenance') {
      return {
        image: this.result, position: film.phonePoint(540, 1250), quaternion: film.phone.getWorldQuaternion(new THREE.Quaternion()),
        width: film.phonePoint(75, 1250).distanceTo(film.phonePoint(1005, 1250)),
        height: film.phonePoint(540, 1150).distanceTo(film.phonePoint(540, 1350)),
      }
    }
    const report = film.memory.layers.find(entry => entry.name === 'report')
    const pane = report.panes[0]
    const unit = 8.28 / 1600
    pane.updateWorldMatrix(true, false)
    const ratio = report.canvas.width / 1600
    const reportContext = this.report.getContext('2d')
    reportContext.clearRect(0, 0, this.report.width, this.report.height)
    reportContext.drawImage(report.canvas, 60 * ratio, 92 * ratio, 880 * ratio, 492 * ratio, 0, 0, 1320, 738)
    return {
      image: this.report,
      position: pane.localToWorld(new THREE.Vector3(10 * unit, 2 * unit, 0.008)),
      quaternion: pane.getWorldQuaternion(new THREE.Quaternion()), width: 880 * unit, height: 492 * unit,
    }
  }

  update(sheet, kind, time, duration, sourceCanvas, sourceContext) {
    const region = REGIONS[kind]
    const origin = this.origin(kind)
    const entry = smooth01(time, 0, 1.35)
    const exit = smooth01(time, duration - 1.35, 1.35)
    const progress = entry * (1 - exit)
    const rewrite = smooth01(time, 0.4, 0.9) * (1 - smooth01(time, duration - 1.3, 0.85))
    const width = lerp(origin.width, region[2] / 1600 * 8.65, progress)
    const height = lerp(origin.height, region[3] / 1600 * 8.65, progress)
    const context = this.context
    context.setTransform(2, 0, 0, 2, 0, 0)
    context.clearRect(0, 0, 1800, 900)
    const contain = (image, left, top, sourceWidth, sourceHeight) => {
      const fit = Math.min(width / sourceWidth, height / sourceHeight)
      const targetWidth = sourceWidth * fit / width * 1800
      const targetHeight = sourceHeight * fit / height * 900
      context.drawImage(image, left, top, sourceWidth, sourceHeight, (1800 - targetWidth) / 2, (900 - targetHeight) / 2, targetWidth, targetHeight)
    }
    context.globalAlpha = 1 - rewrite
    contain(origin.image, 0, 0, origin.image.width, origin.image.height)
    context.globalAlpha = rewrite
    const ratio = sourceCanvas.width / 1600
    contain(sourceCanvas, region[0] * ratio, region[1] * ratio, region[2] * ratio, region[3] * ratio)
    context.globalAlpha = 1
    sourceContext.clearRect(...region)
    sheet.updateWorldMatrix(true, false)
    const target = sheet.localToWorld(new THREE.Vector3(((region[0] + region[2] / 2) / 1600 - 0.5) * 8.65, (0.5 - (region[1] + region[3] / 2) / 680) * 8.65 * 680 / 1600, 0.006))
    this.mesh.position.copy(origin.position).lerp(target, progress)
    this.mesh.quaternion.copy(origin.quaternion).slerp(sheet.getWorldQuaternion(new THREE.Quaternion()), progress)
    this.mesh.scale.set(width, height, 1)
    fade(this.mesh, smooth01(time, 0, 0.18) * (1 - smooth01(time, duration - 0.18, 0.18)))
    this.mesh.material.map.needsUpdate = true
    if (kind === 'reobserve') fade(this.film.runtime.list, 1 - progress)
    if (kind === 'provenance') {
      for (const entry of this.film.source) fade(entry.root, 0)
    }
    if (kind === 'shadow') fade(this.film.memory.board, 1 - progress)
    const phone = this.film.phone
    const phoneVisible = phone.visible
    phone.position.x -= 1.1 * progress
    phone.scale.multiplyScalar(lerp(1, 0.9, progress))
    fade(phone, phoneVisible ? 1 - smooth01(progress, 0.02, 0.22) : 0)
    phone.updateMatrixWorld(true)
    return progress
  }
}
