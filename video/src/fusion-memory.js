import { CameraRig } from './stage.js'
import { SCREEN_W, SCREEN_H } from './screen.js'
import { floatingPill } from './shots/voice.js'
import { THREE, add, surface, fade, smooth01, windowAt, lerp } from './compiler-design.js'
import { COLORS, text, mono, fill, panel, rule, badge, check, touch, layer, outline, schedule, method, morphPanel } from './fusion-memory-ui.js'
import { EXPERIENCE_END, memoryTime, fromMemoryTime } from './fusion-script.js'
import { FusionWorkspace } from './fusion-workspace.js'

const WIDTH = 1600
const HEIGHT = 680
const PIXEL_RATIO = 2

export class FusionMemory {
  constructor(film) {
    this.film = film
    this.root = add(film.root, new THREE.Group())
    this.root.name = 'experience-interface-choreography'
    this.root.visible = false
    this.workspace = new FusionWorkspace(this.root, film.stage.renderHeight)
    this.board = add(this.root, new THREE.Group(), [0, 0.43, 0.60])
    this.layers = [
      this.createLayer('distill', [0, 990, WIDTH], [135.7, 160.45]),
      this.createLayer('trials', [0, 800, WIDTH], [159.7, 168.6]),
      this.createLayer('report', [0, 980, WIDTH], [167.8, 176.3]),
      this.createLayer('adoption', [0, WIDTH], [175.5, 180.3]),
      this.createLayer('loading', [0, 820, WIDTH], [179.7, 182.8]),
    ]
    this.camera = new CameraRig().flow(0.65)
    const seam = film.camera.sample(96)
    this.camera.at(135, seam.pos.toArray(), seam.look.toArray(), { fov: seam.fov, roll: seam.roll })
    for (const [time, position, look, fov, roll = 0] of [
      [137.5, [-1.9, 0.88, 7.2], [-0.7, 0.43, 0.6], 39, -1.3],
      [140.1, [-0.8, 0.95, 7.7], [0.1, 0.45, 0.55], 39, -0.4],
      [145.2, [1.6, 0.72, 7.35], [0.85, 0.40, 0.65], 40, 1.1],
      [149.7, [0.8, 1.10, 7.65], [-0.18, 0.45, 0.55], 39, 0.5],
      [154.8, [-1.75, 0.76, 6.9], [-1.22, 0.43, 0.75], 40, -1.0],
      [159.5, [-0.55, 1.2, 8.25], [0, 0.43, 0.55], 40, -0.4],
      [162.2, [-2.2, 0.80, 7.0], [-1.55, 0.40, 0.65], 40, -0.9],
      [164.6, [-0.2, 1.35, 8.8], [0, 0.37, 0.50], 40, 0],
      [166.8, [2.05, 0.85, 7.25], [1.45, 0.40, 0.65], 40, 1.0],
      [168.6, [0.25, 1.45, 8.3], [-0.05, 0.38, 0.55], 40, 0],
      [171.2, [1.25, 0.82, 7.3], [0.85, 0.42, 0.65], 40, 0.7],
      [174.7, [1.5, 1.22, 8.2], [0.25, 0.35, 0.5], 39, 0.3],
      [176.6, [-0.85, 0.65, 6.65], [-0.05, 0.4, 0.75], 40, -1.0],
      [178.8, [0.75, 0.80, 6.8], [0.18, 0.34, 0.75], 40, 0.5],
      [180.4, [-0.9, 1.0, 7.4], [-0.1, 0.38, 0.6], 40, -0.7],
      [182.0, [1.0, 0.80, 7.8], [0.25, 0.4, 0.6], 39, 0.5],
    ]) this.camera.at(fromMemoryTime(time), [position[0] * 0.78, position[1], position[2] + 0.65], [look[0] * 0.5, look[1], look[2]], { fov: fov + 1, roll })
    this.camera.at(EXPERIENCE_END, seam.pos.toArray(), seam.look.toArray(), { fov: seam.fov, roll: seam.roll })
    const token = document.createElement('canvas')
    token.width = 560
    token.height = 144
    const context = token.getContext('2d')
    fill(context, 4, 4, 552, 136, 58, '#e4efe5')
    text(context, '读表方法', 280, 72, 57, COLORS.jade, 500, 'center')
    this.loaded = add(this.root, surface(token, 1.12, 0.288))
    this.loaded.renderOrder = 30
    this.loaded.material.depthWrite = false
    this.loaded.material.fog = false
  }

  createLayer(name, cuts, range) {
    const canvas = document.createElement('canvas')
    canvas.width = WIDTH * PIXEL_RATIO
    canvas.height = HEIGHT * PIXEL_RATIO
    const root = add(this.board, new THREE.Group())
    root.name = `experience-${name}`
    const panes = cuts.slice(1).map((right, index) => {
      const left = cuts[index]
      const pane = add(root, surface(canvas, (right - left) * 8.28 / WIDTH, 8.28 * HEIGHT / WIDTH))
      const coordinates = pane.geometry.attributes.uv
      for (let vertex = 0; vertex < coordinates.count; vertex++) coordinates.setX(vertex, (left + coordinates.getX(vertex) * (right - left)) / WIDTH)
      coordinates.needsUpdate = true
      pane.material.depthWrite = false
      pane.material.fog = false
      pane.renderOrder = 20
      pane.userData.horizontal = ((left + right) / 2 - WIDTH / 2) * 8.28 / WIDTH
      return pane
    })
    return { name, canvas, context: canvas.getContext('2d'), root, panes, range }
  }

  update(actualTime) {
    const time = memoryTime(actualTime)
    const film = this.film
    this.root.visible = actualTime >= 135 && actualTime < EXPERIENCE_END
    if (!this.root.visible) return
    for (const entry of film.source) fade(entry.root, 0)
    for (const object of [film.brand, film.signature, film.endDetail]) fade(object, 0)
    const phoneAway = smooth01(time, 135.4, 1.8) * (1 - smooth01(time, 181.9, 1.65))
    fade(film.phone, 1 - phoneAway)
    film.phone.updateMatrixWorld(true)
    const screen = film.view.g
    screen.drawImage(film.pages.result, 0, 0, SCREEN_W, SCREEN_H)
    floatingPill(screen, 96, 1, { label: '已提交 · 待确认', working: false })
    film.view.commitNow()
    this.workspace.update(time)
    for (const entry of this.layers) {
      entry.root.visible = time >= entry.range[0] && time < entry.range[1]
      if (!entry.root.visible) continue
      const context = entry.context
      this.context = context
      context.setTransform(PIXEL_RATIO, 0, 0, PIXEL_RATIO, 0, 0)
      context.clearRect(0, 0, WIDTH, HEIGHT)
      context.globalAlpha = 1
      context.setLineDash([])
      if (entry.name === 'distill') this.drawDistillation(time)
      else if (entry.name === 'trials') this.drawTrials(time)
      else if (entry.name === 'report') this.drawReport(time)
      else if (entry.name === 'adoption') this.drawAdoption(time)
      else this.drawLoading(time)
      entry.root.position.set(0, 0, 0)
      entry.root.rotation.set(0, 0, 0)
      entry.panes.forEach(pane => {
        pane.position.set(pane.userData.horizontal, 0, 0)
        pane.rotation.set(0, 0, 0)
        pane.material.map.needsUpdate = true
      })
    }
    fade(this.board, windowAt(time, 135.7, 182.2, 1.1, 1.1))
    const unfold = smooth01(time, 135.7, 2.1)
    this.board.position.copy(film.phonePoint(540, 1295)).lerp(new THREE.Vector3(0, 0.43, 0.60), unfold)
    this.board.scale.setScalar(lerp(0.22, 1, unfold))
    this.board.rotation.set(0.012 * windowAt(time, 137, 181, 1, 1), 0, 0)
    const load = smooth01(time, 181.7, 1.5)
    const destination = film.phonePoint(540, 255)
    this.loaded.position.set(-0.42, 0.98, 1.12).lerp(destination, load)
    this.loaded.quaternion.identity().slerp(film.phone.quaternion, load)
    this.loaded.scale.setScalar(lerp(1.0, 0.12, load))
    fade(this.loaded, windowAt(time, 181.7, 182.8, 0.32, 0.48))
    const pose = this.camera.apply(actualTime, film.stage.camera, film.stage.rig, { handheld: 0 })
    const focus = lerp(pose.pos.distanceTo(pose.look), pose.pos.distanceTo(this.board.position), windowAt(time, 136, 182.5, 1.0, 1.0))
    film.stage.setFocus(focus, 0.000012, 0.0007)
  }

  drawDistillation(time) {
    const context = this.context
    layer(context, 1 - smooth01(time, 159.7, 0.75), () => {
      const spread = smooth01(time, 138.7, 2.8)
      const horizontal = lerp(350, 60, spread)
      const remove = smooth01(time, 139.0, 1.8)
      const reorder = smooth01(time, 151.0, 3.6)
      const intoTrials = smooth01(time, 159.3, 1.15)
      context.save()
      morphPanel(context, [60, 92, 900, 476], [60, 132, 664, 412], intoTrials)
      panel(context, horizontal, 92, 900, 476)
      text(context, time < 149.2 ? '排班页面' : '新页面 · 栏位调整', horizontal + 32, 137, 29, COLORS.ink, 500)
      badge(context, time < 149.2 ? '当前观察' : '重新观察', horizontal + 748, 137, 118)
      text(context, '普通内科 · 门诊排班', horizontal + 32, 185, 20, COLORS.muted)
      const table = schedule(context, horizontal + 28, 226, 844, {
        height: 272, reorder, highlight: smooth01(time, 137.8, 1.2),
        row: 0, rowHighlight: smooth01(time, 155.3, 0.8),
      })
      layer(context, 1 - remove, () => {
        text(context, '姓名 陈*', horizontal + 32, 533, 19, COLORS.muted)
        text(context, '日期 10 月 22 日', horizontal + 260, 533, 19, COLORS.muted)
        mono(context, 'element e42', horizontal + 610, 533, 19)
        const erase = smooth01(time, 139.0, 0.9)
        context.fillStyle = COLORS.coral
        for (const [offset, lineWidth] of [[32, 105], [260, 171], [610, 130]]) context.fillRect(horizontal + offset, 533, lineWidth * erase, 1.5)
      })
      layer(context, remove * (1 - smooth01(time, 148.3, 0.8)), () => text(context, '一次性信息移除，通用阅读步骤保留', horizontal + 32, 533, 19, COLORS.jade))
      layer(context, windowAt(time, 151.6, 155.2, 0.5, 0.7), () => {
        const previousX = horizontal + 28 + table.timeWidth + table.columnWidth
        outline(context, previousX + 6, 232, table.columnWidth - 12, 260, COLORS.coral, true)
        text(context, '旧位置', previousX + table.columnWidth / 2, 531, 19, COLORS.coral, 400, 'center')
      })
      layer(context, smooth01(time, 156.0, 0.8), () => {
        check(context, horizontal + 42, 533)
        text(context, '周四  ·  09:00  ·  陈医生', horizontal + 66, 533, 23, COLORS.jade, 500)
      })
      context.restore()
      layer(context, smooth01(time, 140.1, 0.8), () => {
        morphPanel(context, [1020, 92, 520, 476], [876, 132, 664, 412], intoTrials)
        method(context, 1020, 92, 520, {
          steps: [0, 1, 2].map(index => smooth01(time, 141.0 + index * 1.7, 0.65)),
          selected: time < 149 ? Math.min(2, Math.max(0, Math.floor((time - 140.9) / 1.7))) : time < 155.2 ? 1 : 2,
        })
      })
      const observed = ['周三　周四　周五', '周四', '09:00 · 陈医生']
      for (const [index, content] of ['表头', '目标列', '行与内容'].entries()) {
        const progress = smooth01(time, 140.0 + index * 1.7, 1.25)
        layer(context, Math.sin(progress * Math.PI), () => {
          const originX = horizontal + 28 + table.timeWidth + table.columnWidth * 1.5
          const horizontalPosition = lerp(originX, 1109, progress)
          const verticalPosition = lerp(260 + index * 76, 276 + index * 88, progress) - Math.sin(progress * Math.PI) * 30
          const generalize = smooth01(progress, 0.45, 0.4)
          const chipWidth = lerp(index === 0 ? 290 : index === 2 ? 236 : 130, 130, generalize)
          fill(context, horizontalPosition - chipWidth / 2, verticalPosition - 24, chipWidth, 48, 9, '#d1e5d7')
          layer(context, 1 - generalize, () => text(context, observed[index], horizontalPosition, verticalPosition, 23, COLORS.jade, 500, 'center'))
          layer(context, generalize, () => text(context, content, horizontalPosition, verticalPosition, 23, COLORS.jade, 500, 'center'))
        })
      }
    })
  }

  drawTrials(time) {
    const context = this.context
    layer(context, windowAt(time, 159.7, 167.8, 0.8, 0.8), () => {
      text(context, '独立目标验证', 60, 94, 29, COLORS.light, 500)
      text(context, '原有任务回归', 876, 94, 29, COLORS.light, 500)
      text(context, '同一候选 · v3', 1540, 94, 21, COLORS.gold, 400, 'right')
      this.drawTrial(time, 60, false)
      this.drawTrial(time, 876, true)
      const first = smooth01(time, 162.0, 0.6)
      const second = smooth01(time, 165.0, 0.6)
      const regression = smooth01(time, 164.0, 0.6)
      layer(context, first, () => {
        check(context, 80, 603, 1, '#9ac7ac', 1.1)
        text(context, '目标运行 01', 104, 603, 22, COLORS.light)
      })
      layer(context, second, () => {
        check(context, 343, 603, 1, '#9ac7ac', 1.1)
        text(context, '目标运行 02', 367, 603, 22, COLORS.light)
      })
      layer(context, regression, () => {
        check(context, 896, 603, 1, '#9ac7ac', 1.1)
        text(context, '原本通过，仍然完成', 920, 603, 22, COLORS.light)
      })
    })
  }

  drawReport(time) {
    const context = this.context
    layer(context, windowAt(time, 167.8, 175.5, 0, 0.8), () => {
      context.save()
      morphPanel(context, [60, 132, 664, 412], [60, 92, 880, 492], smooth01(time, 167.5, 1.1), true)
      morphPanel(context, [60, 92, 880, 492], [340, 92, 920, 492], smooth01(time, 175.5, 0.8))
      panel(context, 60, 92, 880, 492)
      context.save()
      context.globalAlpha *= smooth01(time, 167.8, 0.55) * (1 - smooth01(time, 175.2, 0.3))
      text(context, '独立验证报告', 92, 139, 29, COLORS.ink, 500)
      badge(context, '独立材料', 788, 139, 118)
      mono(context, 'reading_tables / v3', 92, 196, 23, COLORS.ink)
      mono(context, 'contract 9c7…a20', 579, 196, 20)
      rule(context, 92, 230, 816)
      const rows = [['目标运行 01', '完成'], ['目标运行 02', '完成'], ['原有任务回归', '仍通过'], ['失败运行记录', '完整保留']]
      rows.forEach(([title, result], index) => {
        const baseline = 274 + index * 72
        layer(context, smooth01(time, 168.1 + index * 0.30, 0.55), () => {
          text(context, title, 94, baseline, 25, COLORS.ink)
          check(context, 715, baseline)
          text(context, result, 744, baseline, 23, COLORS.jade)
          if (index < 3) rule(context, 94, baseline + 35, 810)
        })
      })
      text(context, '留存运行与决策点，由本机重新核对', 94, 554, 18, COLORS.muted)
      context.restore()
      context.restore()
      text(context, '本机重新计算', 1020, 139, 31, COLORS.light, 500)
      mono(context, 'v3 / contract 9c7…a20', 1020, 196, 22, COLORS.dim)
      layer(context, windowAt(time, 169.0, 170.9, 0.35, 0.35), () => {
        rule(context, 92, 218, 816, COLORS.jade)
        rule(context, 1020, 218, 484, '#91bda3')
      })
      const gates = [
        ['版本与契约一致', '验证材料对应当前候选'],
        ['目标与回归证据', '目标完成 ≥ 2 次 · 旧任务仍通过'],
        ['影子回放', '逐点复核：应用 / 任务族 / 页面前提'],
        ['安全与开销约束', '核对越界、谎报与对照开销'],
      ]
      gates.forEach(([title, detail], index) => {
        const amount = smooth01(time, 169.1 + index * 1.12, 0.65)
        const baseline = 272 + index * 76
        layer(context, 0.30 + amount * 0.70, () => {
          fill(context, 1020, baseline - 15, 30, 30, 15, amount > 0.99 ? '#375e4d' : '#263e3b')
          if (amount > 0) check(context, 1035, baseline, amount, '#b5d7bd', 0.8)
          text(context, title, 1070, baseline, 25, COLORS.light, 500)
          text(context, detail, 1070, baseline + 32, 17, COLORS.dim)
        })
      })
      layer(context, smooth01(time, 173.7, 0.65), () => badge(context, '验证通过 · 可手动采用', 1020, 607, 456, { height: 46, size: 22 }))
    })
  }

  drawTrial(time, horizontal, regression) {
    const context = this.context
    const start = regression ? 161.5 : 160.5
    const second = regression ? 0 : smooth01(time, 162.7, 1.3)
    context.save()
    morphPanel(context, regression ? [1020, 92, 520, 476] : [60, 92, 900, 476], [horizontal, 132, 664, 412], smooth01(time, 159.3, 1.15), true)
    if (!regression) morphPanel(context, [60, 132, 664, 412], [60, 92, 880, 492], smooth01(time, 167.5, 1.1))
    panel(context, horizontal, 132, 664, 412)
    context.save()
    context.globalAlpha *= 1 - smooth01(time, 167.2, 0.6)
    text(context, regression ? '原有检验页 · 周三' : time < 163.3 ? '改版排班页 · 目标运行 01' : '另一排班页 · 目标运行 02', horizontal + 26, 171, 23, COLORS.ink, 500)
    text(context, '读取当前页面 · 独立核实返回结果', horizontal + 26, 212, 18, COLORS.muted)
    schedule(context, horizontal + 24, 246, 616, {
      height: 216, size: 20, target: regression ? 1 : 2,
      reorder: regression ? 0 : 1 - second,
      highlight: smooth01(time, start, 0.8), row: 0, rowHighlight: smooth01(time, start + 0.8, 0.6),
      values: regression ? [['08:00', '可采样', '可采样', '停诊'], ['14:00', '可采样', '停诊', '可采样'], ['18:00', '停诊', '停诊', '停诊']] : undefined,
    })
    const done = regression ? smooth01(time, 163.5, 0.65) : smooth01(time, 161.7, 0.65) * (1 - smooth01(time, 162.7, 0.35)) + smooth01(time, 164.8, 0.65)
    layer(context, done, () => {
      fill(context, horizontal + 24, 482, 616, 40, 6, COLORS.wash)
      check(context, horizontal + 48, 502)
      text(context, regression ? '独立核实：原有任务仍完成' : '独立核实：本次任务完成', horizontal + 72, 502, 20, COLORS.jade)
    })
    context.restore()
    context.restore()
  }

  drawAdoption(time) {
    const context = this.context
    layer(context, windowAt(time, 175.5, 179.7, 0, 0.6), () => {
      morphPanel(context, [60, 92, 880, 492], [340, 92, 920, 492], smooth01(time, 175.5, 0.8), true)
      morphPanel(context, [340, 92, 920, 492], [80, 103, 704, 456], smooth01(time, 179.7, 0.6))
      const adopted = smooth01(time, 177.85, 0.65)
      panel(context, 340, 92, 920, 492)
      context.save()
      context.globalAlpha *= smooth01(time, 175.5, 0.55) * (1 - smooth01(time, 179.4, 0.3))
      text(context, '家人设置  /  技巧', 378, 133, 20, COLORS.muted)
      text(context, adopted > 0.5 ? '生效技巧' : '候选技巧', 378, 194, 31, COLORS.ink, 500)
      text(context, '导入独立验证报告', 1222, 194, 18, COLORS.jade, 400, 'right')
      rule(context, 378, 232, 844)
      text(context, '读表：先找表头，再对齐目标列', 378, 285, 29, COLORS.ink, 500)
      badge(context, adopted > 0.5 ? '生效' : '候选', 1134, 285, 86)
      mono(context, 'reading_tables · v3', 378, 334, 22)
      text(context, '适用：当前应用 · 读表任务 · 表头可见', 378, 379, 21, COLORS.muted)
      fill(context, 378, 414, 844, 49, 8, COLORS.wash)
      check(context, 405, 439)
      text(context, '独立验证通过', 430, 439, 22, COLORS.jade, 500)
      if (adopted < 0.5) {
        text(context, '查看', 405, 515, 23, COLORS.jade)
        fill(context, 1060, 487, 162, 54, 27, COLORS.jade)
        text(context, '采用', 1141, 514, 25, '#ffffff', 500, 'center')
        touch(context, 1141, 514, smooth01(time, 177.35, 1.0))
      } else {
        text(context, '查看', 405, 515, 23, COLORS.jade)
        text(context, '回退到上一版', 1016, 515, 22, COLORS.jade, 400, 'right')
        text(context, '退休', 1175, 515, 22, COLORS.jade, 400, 'right')
      }
      layer(context, adopted, () => text(context, '已采用，下一次任务会看到它', 800, 626, 25, COLORS.light, 400, 'center'))
      context.restore()
    })
  }

  drawLoading(time) {
    const context = this.context
    layer(context, windowAt(time, 179.7, 182.1, 0, 0.7), () => {
      context.save()
      morphPanel(context, [340, 92, 920, 492], [80, 103, 704, 456], smooth01(time, 179.7, 0.6), true)
      panel(context, 80, 103, 704, 456)
      context.save()
      context.globalAlpha *= smooth01(time, 179.7, 0.5)
      text(context, '下一次 · 同类页面', 110, 145, 28, COLORS.ink, 500)
      badge(context, '正在读表', 598, 145, 150)
      text(context, '目标：查看周四上午的门诊', 110, 203, 21, COLORS.muted)
      schedule(context, 108, 250, 648, { height: 250, size: 23, reorder: 1, row: 0 })
      context.restore()
      context.restore()
      text(context, '匹配应用、任务与当前页面前提', 920, 142, 26, COLORS.light, 500)
      mono(context, 'load_skill("reading_tables")', 920, 221, 24, '#d7bb8e')
      rule(context, 920, 262, 555 * smooth01(time, 180.25, 0.8), '#587669')
      for (const [index, content] of ['先识别表头', '再定位目标列', '连同行内容核对'].entries()) layer(context, smooth01(time, 180.4 + index * 0.22, 0.5), () => {
        text(context, String(index + 1).padStart(2, '0'), 920, 319 + index * 78, 24, '#a0c8ac', 500)
        text(context, content, 978, 319 + index * 78, 28, COLORS.light)
      })
      text(context, '本次只装入匹配的方法正文', 920, 558, 21, COLORS.dim)
    })
  }
}
