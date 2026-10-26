import { CameraRig } from './stage.js'
import { THREE, add, surface, fade, smooth01, windowAt, lerp } from './compiler-design.js'
import { COLORS, text, mono, fill, panel, rule, badge, check, touch, layer, outline, schedule } from './fusion-memory-ui.js'
import { FusionWorkspace } from './fusion-workspace.js'
import { FusionHandoff } from './fusion-handoff.js'

const WIDTH = 1600
const HEIGHT = 680
const RATIO = 2

export class FusionDetail {
  constructor(stage, film) {
    this.stage = stage
    this.root = add(stage.scene, new THREE.Group())
    this.root.name = 'concrete-mechanism-inserts'
    this.root.visible = false
    this.film = film
    this.workspace = new FusionWorkspace(this.root, stage.renderHeight)
    this.workspace.cove.renderOrder = 75
    this.workspace.contextPlane.visible = false
    this.canvas = document.createElement('canvas')
    this.canvas.width = WIDTH * RATIO
    this.canvas.height = HEIGHT * RATIO
    this.context = this.canvas.getContext('2d')
    this.sheet = add(this.root, surface(this.canvas, 8.65, 8.65 * HEIGHT / WIDTH), [0, 0.44, 0.65])
    this.sheet.material.depthWrite = false
    this.sheet.material.depthTest = false
    this.sheet.material.fog = false
    this.sheet.renderOrder = 90
    this.handoff = new FusionHandoff(this.root, film)
    this.camera = new CameraRig().flow(0.65)
    for (const [time, position, look, fov, roll] of [
      [0, [-1.0, 0.85, 7.7], [-0.45, 0.45, 0.65], 40, -0.6],
      [0.30, [-1.35, 0.8, 7.35], [-0.65, 0.43, 0.65], 40, -0.7],
      [0.62, [1.25, 1.0, 7.5], [0.50, 0.40, 0.65], 40, 0.7],
      [1, [0.25, 1.25, 8.45], [0, 0.40, 0.65], 40, 0],
    ]) this.camera.at(time, [position[0] * 0.8, position[1], position[2] + 0.55], [look[0] * 0.4, look[1], look[2]], { fov: fov + 1, roll })
  }

  update(edit, actualTime) {
    this.root.visible = Boolean(edit.detail)
    if (!this.root.visible) return
    const time = actualTime - edit.start
    const duration = edit.end - edit.start
    const presence = windowAt(time, 0, duration - 1.35, 1.35, 1.35)
    this.workspace.contextPlane.visible = false
    this.workspace.uniforms.opacity.value = presence * 0.38
    this.workspace.uniforms.page.value = edit.detail === 'relations' ? 1 : 0
    this.workspace.uniforms.verification.value = edit.detail === 'shadow' || edit.detail === 'provenance' ? 1 : 0
    this.workspace.uniforms.column.value = lerp(0.48, 0.56, smooth01(time, 1.5, 3.8))
    this.workspace.uniforms.adopted.value = 0
    const context = this.context
    context.setTransform(RATIO, 0, 0, RATIO, 0, 0)
    context.clearRect(0, 0, WIDTH, HEIGHT)
    context.globalAlpha = 1
    context.setLineDash([])
    if (edit.detail === 'reobserve') this.drawReobserve(time)
    else if (edit.detail === 'provenance') this.drawProvenance(time)
    else this.drawShadow(time)
    this.sheet.rotation.set(0.008, lerp(-0.028, 0.035, smooth01(time, 0.6, duration - 1.2)), 0)
    this.handoff.update(this.sheet, edit.detail, time, duration, this.canvas, context)
    this.sheet.material.map.needsUpdate = true
    fade(this.sheet, presence)
    const camera = this.stage.camera
    const basePosition = camera.position.clone()
    const baseQuaternion = camera.quaternion.clone()
    const baseFov = camera.fov
    const baseRoll = this.stage.rig.rotation.z
    const pose = this.camera.apply(time / duration, camera, this.stage.rig, { handheld: 0 })
    const targetPosition = camera.position.clone()
    const targetQuaternion = camera.quaternion.clone()
    camera.position.lerpVectors(basePosition, targetPosition, presence)
    camera.quaternion.slerpQuaternions(baseQuaternion, targetQuaternion, presence)
    camera.fov = lerp(baseFov, pose.fov, presence)
    this.stage.rig.rotation.z = lerp(baseRoll, this.stage.rig.rotation.z, presence)
    camera.updateProjectionMatrix()
    this.stage.setFocus(camera.position.distanceTo(this.sheet.position), 0.000012, 0.0007)
  }

  drawRelations(time) {
    const context = this.context
    panel(context, 60, 104, 900, 470)
    text(context, '当前排班页', 92, 146, 29, COLORS.ink)
    text(context, '目标：周四上午的陈医生', 92, 193, 21, COLORS.muted)
    const table = schedule(context, 88, 230, 844, { height: 278, highlight: smooth01(time, 2.3, 0.65), row: 0, rowHighlight: smooth01(time, 3.7, 0.7) })
    layer(context, smooth01(time, 3.4, 0.6), () => {
      fill(context, 88, 230 + table.rowHeight, table.timeWidth, table.rowHeight, 4, '#dce4cf')
      text(context, '09:00', 88 + table.timeWidth / 2, 230 + table.rowHeight * 1.5, 24, COLORS.ink, 500, 'center')
    })
    text(context, '同名文字的含义，要放回表头与行内容', 92, 542, 21, COLORS.jade)
    text(context, '控件树：文字与身份', 1030, 146, 28, COLORS.light)
    const resolve = smooth01(time, 3.0, 0.8)
    layer(context, 1 - resolve, () => {
      for (const [index, identity] of ['e43', 'e58', 'e72'].entries()) {
        const baseline = 234 + index * 88
        mono(context, identity, 1030, baseline, 23, '#b0c7b5')
        rule(context, 1100, baseline, 40, '#719482')
        text(context, '陈医生', 1168, baseline, 30, COLORS.light)
      }
      text(context, '文字相同，行列关系仍需观察', 1030, 536, 20, COLORS.dim)
    })
    const values = [['周四', 278], ['09:00', 366], ['陈医生', 454]]
    const origins = [[table.targetX + table.columnWidth / 2, 265], [88 + table.timeWidth / 2, 335], [table.targetX + table.columnWidth / 2, 335]]
    values.forEach(([content, baseline], index) => {
      const progress = smooth01(time, 2.7 + index * 0.72, 1.25)
      layer(context, Math.sin(progress * Math.PI), () => {
        const horizontal = lerp(origins[index][0], 1194, progress)
        const vertical = lerp(origins[index][1], baseline, progress) - Math.sin(progress * Math.PI) * 28
        fill(context, horizontal - 79, vertical - 25, 158, 50, 8, '#d1e5d7')
        text(context, content, horizontal, vertical, 26, COLORS.jade, 500, 'center')
      })
      layer(context, smooth01(time, 4.1 + index * 0.4, 0.5), () => {
        text(context, ['表头', '时间', '当前内容'][index], 1030, baseline, 21, COLORS.dim)
        text(context, content, 1190, baseline, 34, COLORS.light)
      })
    })
    layer(context, smooth01(time, 5.7, 0.65), () => {
      check(context, 1042, 552, 1, '#9ac7ac')
      text(context, '同一目标，身份与版式相互补全', 1066, 552, 20, COLORS.light)
    })
  }

  drawReobserve(time) {
    const context = this.context
    const fresh = smooth01(time, 3.0, 0.75)
    const selected = smooth01(time, 4.6, 0.7)
    panel(context, 60, 104, 900, 470)
    text(context, '普通内科 · 陈医生', 92, 146, 29, COLORS.ink)
    badge(context, fresh > 0.5 ? '新观察' : '页面已变化', 768, 146, 152)
    text(context, '09:00 与 10:00，都是当前可见的同名选项', 92, 197, 21, COLORS.muted)
    for (const [index, hour] of ['09:00', '10:00'].entries()) {
      const top = 240 + index * 137
      fill(context, 92, top, 836, 110, 11, index === 0 && selected > 0 ? '#d5e9dc' : '#fcfdf9')
      text(context, '陈医生', 119, top + 37, 28, COLORS.ink)
      text(context, `普通内科  ·  ${hour}`, 119, top + 79, 23, COLORS.muted)
      layer(context, fresh, () => mono(context, index === 0 ? 'e43' : 'e72', 810, top + 53, 26, COLORS.jade))
      layer(context, windowAt(time, 1.1, 3.1, 0.35, 0.4), () => outline(context, 92, top, 836, 110, COLORS.coral, true))
      if (index === 0) {
        layer(context, selected, () => outline(context, 92, top, 836, 110))
        touch(context, 800, top + 54, smooth01(time, 5.3, 0.9))
      }
    }
    layer(context, fresh * (1 - selected), () => {
      const scan = smooth01(time, 3.0, 1.7)
      rule(context, 92, lerp(225, 508, scan), 836, '#6aab85')
    })
    text(context, '本地执行记录', 1030, 146, 28, COLORS.light)
    layer(context, 1 - selected, () => {
      mono(context, 'click(e42) / rev31', 1030, 234, 25, '#d1b18a')
      layer(context, smooth01(time, 1.1, 0.5), () => {
        mono(context, 'stale_screen', 1030, 312, 26, '#c79783')
        text(context, '旧引用无法唯一重绑', 1030, 365, 25, COLORS.light)
        text(context, '重新观察当前页面', 1030, 438, 26, '#a6c9b2')
      })
    })
    layer(context, selected, () => {
      mono(context, 'observe() / rev32', 1030, 234, 25, COLORS.dim)
      mono(context, 'click(e43) / rev32', 1030, 318, 25, '#cce0cd')
      text(context, '新上下文，重新选择', 1030, 404, 28, COLORS.light)
      check(context, 1042, 496, 1, '#9ac7ac')
      text(context, '当前窗口 · 当前版本 · 唯一目标', 1066, 496, 20, COLORS.light)
    })
  }

  drawProvenance(time) {
    const context = this.context
    const external = smooth01(time, 3.2, 0.8)
    panel(context, 60, 104, 900, 176)
    text(context, '自己输入的搜索词', 92, 143, 26, COLORS.ink)
    fill(context, 92, 180, 836, 66, 9, '#e6eae2')
    text(context, '陈医生  09:00', 120, 213, 30, COLORS.ink)
    layer(context, smooth01(time, 1.5, 0.5), () => {
      rule(context, 116, 213, 260 * smooth01(time, 1.5, 0.55), COLORS.coral)
      text(context, '不能证明已经预约', 880, 213, 22, COLORS.coral, 500, 'right')
    })
    panel(context, 60, 318, 900, 256)
    text(context, '医院返回的办理页面', 92, 358, 26, COLORS.ink)
    layer(context, 0.24 + external * 0.76, () => {
      text(context, '已提交', 92, 430, 41, COLORS.jade)
      text(context, '待医院确认', 92, 495, 29, COLORS.ink)
      badge(context, '医院页面', 778, 430, 150)
      mono(context, 'app / rev32 / step18', 92, 545, 20)
    })
    text(context, '证据账本', 1030, 146, 28, COLORS.light)
    layer(context, 1 - external, () => {
      mono(context, 'source: SELF_TYPED', 1030, 234, 24, '#c79783')
      text(context, '输入，不是外部事实', 1030, 302, 28, COLORS.light)
      text(context, '“预约成功”', 1030, 405, 34, '#bfa08e')
      rule(context, 1030, 405, 210 * smooth01(time, 1.6, 0.6), '#c79783')
    })
    layer(context, external, () => {
      mono(context, 'source: PAGE', 1030, 234, 25, '#a6c9b2')
      mono(context, 'rev32 / step18', 1030, 288, 23, COLORS.dim)
      text(context, '只支持已经观察到的事实', 1030, 358, 25, COLORS.light)
      text(context, '已提交', 1030, 430, 39, '#cbe1cd')
      text(context, '待医院确认', 1030, 493, 31, COLORS.light)
      check(context, 1042, 556, 1, '#9ac7ac')
      text(context, '结论与来源一起保留', 1066, 556, 23, COLORS.light)
    })
  }

  drawShadow(time) {
    const context = this.context
    const archive = smooth01(time, 7.1, 0.65)
    layer(context, 1 - archive, () => {
      text(context, '同一方法 · v3', 84, 104, 29, COLORS.light)
      mono(context, '应用 + 任务族 + 页面前提', 1020, 104, 23, '#c5b58e')
      const cases = [
        ['当前医院', '读表任务', '表头可见'], ['当前医院', '提交确认', '没有表格'],
        ['另一应用', '读表任务', '表头可见'], ['当前医院', '读表任务', '表头不可见'],
      ]
      cases.forEach((labels, index) => {
        const horizontal = 84 + index * 378
        panel(context, horizontal, 153, 348, 385)
        text(context, labels[0], horizontal + 23, 188, 24, COLORS.ink)
        text(context, labels[1], horizontal + 23, 227, 20, COLORS.muted)
        if (index === 1) {
          text(context, '请核对就诊信息', horizontal + 23, 301, 24, COLORS.ink)
          text(context, '陈医生 · 周四上午', horizontal + 23, 352, 22, COLORS.muted)
          fill(context, horizontal + 23, 408, 302, 48, 24, '#dbe6dc')
          text(context, '本人提交', horizontal + 174, 432, 22, COLORS.jade, 500, 'center')
        } else {
          schedule(context, horizontal + 17, 273, 314, { height: 204, size: 16, highlight: index === 0 ? smooth01(time, 4.2, 0.65) : 0 })
          if (index === 3) {
            fill(context, horizontal + 17, 272, 314, 53, 5, '#e6eae3')
            text(context, '表头不在当前画面', horizontal + 174, 298, 17, COLORS.muted, 400, 'center')
          }
        }
        text(context, labels[2], horizontal + 23, 509, 18, COLORS.muted)
        const onset = [4.4, 1.8, 2.8, 3.8][index]
        layer(context, smooth01(time, onset, 0.55), () => {
          badge(context, index === 0 ? '符合完整前提' : ['任务族不符', '应用不符', '前提不符'][index - 1], horizontal + 23, 588, 302, { height: 44, size: 22, fill: index === 0 ? '#d3e8d8' : '#283c38', color: index === 0 ? COLORS.jade : '#a9b8af' })
          outline(context, horizontal, 153, 348, 385, index === 0 ? '#9bc5a5' : '#536a5e')
        })
      })
    })
    layer(context, archive, () => {
      panel(context, 60, 104, 1480, 470)
      text(context, '归档运行 · 独立核实的结果', 92, 146, 29, COLORS.ink)
      mono(context, 'reading_tables / v3', 1100, 146, 22)
      rule(context, 92, 192, 1416)
      const records = [['目标运行 01', 'done', '完成'], ['目标运行 02', 'done', '完成'], ['原有任务回归', 'done', '仍通过'], ['未完成运行', 'not_done', '同样保留']]
      records.forEach(([title, outcome, result], index) => {
        const baseline = 245 + index * 78
        text(context, title, 94, baseline, 27, COLORS.ink)
        mono(context, `real_outcome: ${outcome}`, 595, baseline, 23, index === 3 ? COLORS.coral : COLORS.muted)
        text(context, result, 1465, baseline, 25, index === 3 ? COLORS.coral : COLORS.jade, 500, 'right')
        if (index < 3) rule(context, 94, baseline + 37, 1410)
      })
      text(context, '不挑选性隐藏失败，交给本机重新核算', 92, 543, 20, COLORS.muted)
    })
  }
}
