import { THREE, add, surface, cropPage, fade, windowAt, smooth01, lerp } from './compiler-design.js'
import { COLORS, text, mono, fill, panel, rule, badge, check, layer } from './fusion-memory-ui.js'

const WIDTH = 1600
const HEIGHT = 800

export class CompilerProof {
  constructor(parent, resultPage) {
    this.root = add(parent, new THREE.Group())
    this.root.name = 'traceable-results-not-floating-claims'
    this.canvas = document.createElement('canvas')
    this.canvas.width = WIDTH * 2
    this.canvas.height = HEIGHT * 2
    this.context = this.canvas.getContext('2d', { willReadFrequently: true })
    this.sheet = add(this.root, surface(this.canvas, 6.0, 3.0))
    this.sheet.material.depthWrite = false
    this.sheet.material.fog = false
    this.receipt = cropPage(resultPage, 75, 1150, 930, 200)
  }

  update(time, phone, phonePoint) {
    const presence = windowAt(time, 75.35, 95.8, 0.9, 0.9)
    this.root.visible = presence > 0.001
    if (!this.root.visible) return
    const entry = smooth01(time, 75.35, 3.3)
    const exit = smooth01(time, 93.0, 2.7)
    const origin = phonePoint(540, 1992).lerp(phonePoint(540, 1243), smooth01(time, 76.5, 2.5))
    this.sheet.position.copy(origin).lerp(new THREE.Vector3(0.92, 0.38, 0.82), entry).lerp(phonePoint(540, 1243), exit)
    this.sheet.quaternion.copy(phone.quaternion).slerp(new THREE.Quaternion(), entry * (1 - exit))
    this.sheet.scale.setScalar(lerp(0.22, 1, entry) * lerp(1, 0.18, exit))
    const context = this.context
    context.setTransform(2, 0, 0, 2, 0, 0)
    context.clearRect(0, 0, WIDTH, HEIGHT)
    const receipt = smooth01(time, 78.0, 1.5)
    const reject = smooth01(time, 82.0, 1.2)
    const local = smooth01(time, 85.0, 1.8)
    const cloud = smooth01(time, 88.2, 1.8)
    const result = smooth01(time, 91.2, 1.5)
    layer(context, 1 - result, () => {
      panel(context, 32, 36, 1536, 720, 34)
      text(context, '动作与结果，分别核验', 78, 108, 39, COLORS.ink)
      badge(context, '本轮记录', 1340, 108, 172, { size: 24, height: 46 })
      rule(context, 78, 167, 1434)
      fill(context, 78, 205, 1434, 112, 22, '#edf2f6')
      text(context, '操作记录', 107, 241, 25, COLORS.muted)
      text(context, '本人已点按提交', 107, 284, 34, COLORS.ink)
      text(context, '证明动作发生', 1466, 261, 26, COLORS.muted, 400, 'right')
      layer(context, receipt, () => {
        fill(context, 78, 344, 1434, 130, 22, '#e8f2ee')
        text(context, '医院页面 / 本轮返回', 107, 381, 24, COLORS.jade)
        context.drawImage(this.receipt, 0, 0, this.receipt.width, this.receipt.height, 945, 354, 510, 510 * 200 / 930)
        text(context, '外部业务状态', 107, 430, 30, COLORS.ink)
      })
      layer(context, windowAt(time, 79.2, 84.0, 0.7, 0.5), () => {
        text(context, '候选结论 · 对照示意', 107, 553, 25, COLORS.muted)
        text(context, '预约成功', 107, 615, 45, reject > 0.3 ? COLORS.coral : COLORS.ink)
        fill(context, 107, 614, 182 * reject, 2, COLORS.coral)
        layer(context, reject, () => {
          text(context, '页面仅支持“已提交，待医院确认”', 440, 615, 32, COLORS.ink)
          badge(context, '收窄结论', 1270, 615, 190, { size: 24, height: 47, fill: '#f3e9e5', color: COLORS.coral })
        })
      })
      layer(context, smooth01(time, 84.6, 0.65), () => {
        const lanes = [
          ['本地证据审计', '动作记录 · 来源 · 页面上下文', local, 78],
          ['独立云端复核', '本轮页面 · 候选结论是否一致', cloud, 820],
        ]
        for (const [title, detail, progress, horizontal] of lanes) {
          fill(context, horizontal, 516, 692, 176, 24, '#edf2f6')
          text(context, title, horizontal + 28, 556, 30, COLORS.ink)
          text(context, detail, horizontal + 28, 609, 23, COLORS.muted)
          fill(context, horizontal + 28, 650, 620, 3, 1.5, '#dce5eb')
          fill(context, horizontal + 28, 650, 620 * progress, 3, 1.5, COLORS.jade)
          layer(context, smooth01(progress, 0.85, 0.15), () => check(context, horizontal + 637, 556, 1, COLORS.jade, 1.4))
        }
        text(context, '本地通过后，才进入独立复核', 800, 730, 24, COLORS.muted, 400, 'center')
      })
      layer(context, 1 - smooth01(time, 79.3, 1.3), () => text(context, '操作发生，不等于业务办成', 800, 704, 27, COLORS.muted, 400, 'center'))
    })
    layer(context, result, () => {
      panel(context, 115, 234, 1370, 310, 42)
      badge(context, '与本轮页面事实一致', 164, 290, 382, { size: 27, height: 48 })
      text(context, '已提交 · 待医院确认', 164, 405, 66, COLORS.ink)
      mono(context, 'PAGE / current revision / current step', 164, 491, 25, COLORS.muted)
      check(context, 1384, 405, 1, COLORS.jade, 3)
    })
    fade(this.sheet, presence)
    this.sheet.material.map.needsUpdate = true
  }
}
