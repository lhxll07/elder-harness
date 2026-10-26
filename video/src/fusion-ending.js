import { CameraRig } from './stage.js'
import { THREE, add, surface, cropPage, fade, smooth01, lerp } from './compiler-design.js'
import { COLORS, text, mono, fill, rule, badge, check, layer, schedule } from './fusion-memory-ui.js'

export class FusionEnding {
  constructor(film) {
    this.film = film
    this.root = add(film.root, new THREE.Group())
    this.canvas = document.createElement('canvas')
    this.canvas.width = 3360
    this.canvas.height = 1720
    this.context = this.canvas.getContext('2d')
    this.sheet = add(this.root, surface(this.canvas, 8.4, 4.3), [0, 0.55, 0.9])
    this.sheet.material.depthWrite = false
    this.sheet.material.fog = false
    this.receipt = cropPage(film.pages.result, 75, 1150, 930, 200)
    this.camera = new CameraRig().flow(0.65)
    const seam = film.camera.sample(96)
    this.camera.at(173, seam.pos.toArray(), seam.look.toArray(), { fov: seam.fov, roll: seam.roll })
    this.camera.at(177, [0.45, 0.65, 9.8], [0, 0.2, 0.3], { fov: 39, roll: 0.4 })
    this.camera.at(182, [-0.3, 0.5, 9.45], [0, 0.25, 0.4], { fov: 39, roll: -0.3 })
    this.camera.at(186, [0, 0.3, 9.2], [0, 0.25, 0.4], { fov: 38 })
    this.camera.at(190, [0, 0.28, 8.9], [0, 0.25, 0.4], { fov: 38 })
  }

  update(time) {
    this.root.visible = time >= 173
    if (!this.root.visible) return
    const film = this.film
    for (const object of [film.brand, film.signature, film.endDetail]) fade(object, 0)
    for (const entry of film.source) fade(entry.root, 0)
    for (const entry of film.constraints) fade(entry.root, 0)
    for (const entry of film.reviewPieces) fade(entry.mesh, 0)
    if (film.proof) fade(film.proof.root, 0)
    film.updatePhone(96)
    fade(film.phone, 0)
    const recede = smooth01(time, 180.8, 1.3)
    this.sheet.position.y = lerp(0.55, 0.60, recede)
    this.sheet.scale.setScalar(lerp(1, 0.975, recede))
    const context = this.context
    context.setTransform(2, 0, 0, 2, 0, 0)
    context.clearRect(0, 0, 1680, 860)
    layer(context, smooth01(time, 173.8, 1.2), () => {
      text(context, '为人编译', 840, 95, 62, COLORS.light, 500, 'center')
      text(context, '让技术承担复杂，让人保留决定。', 840, 164, 29, COLORS.dim, 400, 'center')
    })
    const headings = ['把界面，读成步骤', '把结论，放回事实', '把经历，留下方法']
    const footers = ['双通道观察 · 逐页理解', '本地审计 → 独立复核', '独立验证 → 家人采用']
    headings.forEach((heading, index) => {
      const progress = smooth01(time, 174.4 + index * 0.58, 1.4)
      layer(context, progress, () => {
        const horizontal = 40 + index * 560
        context.save()
        context.translate(horizontal, (1 - progress) * 50)
        mono(context, `0${index + 1}`, 12, 246, 24, '#9eafb8')
        text(context, heading, 12, 303, 34, COLORS.light)
        if (index === 0) {
          schedule(context, 12, 354, 490, { height: 208, size: 20, highlight: progress, rowHighlight: smooth01(time, 175.8, 1.2) })
          for (let step = 0; step < 3; step++) {
            const vertical = 588 + step * 48
            const reveal = smooth01(time, 176.1 + step * 0.25, 0.8)
            layer(context, reveal, () => {
              fill(context, 12 + (1 - reveal) * 80, vertical, 490, 39, 12, '#edf3f5')
              text(context, ['01  找到科室', '02  读取排班', '03  本人核对'][step], 30 + (1 - reveal) * 80, vertical + 20, 21, COLORS.ink)
            })
          }
        } else if (index === 1) {
          fill(context, 12, 354, 490, 208, 24, COLORS.paper)
          text(context, '医院返回 · 当前页面', 36, 387, 21, COLORS.muted)
          context.drawImage(this.receipt, 34, 418, 446, 446 * 200 / 930)
          text(context, '医院页面 · 回执', 36, 539, 21, COLORS.muted)
          for (let lane = 0; lane < 2; lane++) {
            const reveal = smooth01(time, 177.2 + lane * 0.6, 1)
            fill(context, 12, 588 + lane * 57, 490, 44, 14, '#203940')
            text(context, lane === 0 ? '本地证据审计' : '独立云端复核', 32, 610 + lane * 57, 23, COLORS.light)
            check(context, 468, 610 + lane * 57, reveal, '#97cbbb', 1.2)
          }
        } else {
          fill(context, 12, 354, 490, 208, 24, COLORS.paper)
          mono(context, 'reading_tables', 36, 391, 23)
          text(context, '先找表头，再对齐目标列', 36, 444, 27, COLORS.ink)
          rule(context, 36, 480, 442)
          badge(context, '当前应用', 36, 521, 132)
          badge(context, '读表任务', 184, 521, 132)
          badge(context, '表头可见', 332, 521, 144)
          const adopted = smooth01(time, 178.2, 1.1)
          text(context, '独立验证', 14, 617, 26, COLORS.light)
          check(context, 174, 617, adopted, '#97cbbb')
          text(context, '家人选择采用', 242, 617, 26, COLORS.light)
          check(context, 470, 617, adopted, '#97cbbb')
          fill(context, 12, 654, 490 * adopted, 3, 1.5, '#97cbbb')
        }
        text(context, footers[index], 12, 774, 22, COLORS.dim, 400)
        context.restore()
      })
    })
    fade(this.sheet, smooth01(time, 173.4, 0.8) * (1 - smooth01(time, 181.4, 1.5)))
    this.sheet.material.map.needsUpdate = true
    film.applyCamera(this.camera, time)
  }
}
