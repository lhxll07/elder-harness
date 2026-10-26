import * as THREE from 'three'
import { PHONE_Z } from '../props.js'
import { COLOR, caption, attach, solid, pageLayer, pin, wire, ring, gate, packet, cross, fingerprint, ticket, travel, windowAt, smooth01, clamp01 } from './mechanism-geometry.js'

export function buildActionMechanism(chapter) {
  if (chapter.kind === 'loop') buildPageGuard(chapter)
  else if (chapter.kind === 'ladder') buildAutonomy(chapter)
  else buildHandback(chapter)
}

function buildPageGuard(chapter) {
  const stage = attach(chapter.group, new THREE.Group())
  const oldPage = attach(stage, pageLayer('r17'), [-1.28, 0.02, -0.52])
  const newPage = attach(stage, pageLayer('r18', true), [0.39, 0.02, 0.34])
  const ambiguous = attach(stage, pageLayer('r19', true, true), [0.39, 0.02, 0.34])
  oldPage.rotation.y = 0.10
  newPage.rotation.y = ambiguous.rotation.y = -0.06
  const pins = []
  const flows = []
  const kinds = ['自身', '父节点', '子节点', '兄弟序列']
  const colors = [COLOR.mint, COLOR.blue, COLOR.amber, COLOR.mint]
  kinds.forEach((kind, index) => {
    const offset = -0.37 + index * 0.24
    pins.push(attach(stage, pin(colors[index]), [-1.28 + offset, 0.32, -0.48]))
    pins.push(attach(stage, pin(colors[index]), [0.39 + offset, -0.05, 0.38]))
    flows.push(wire(stage, [[-1.28 + offset, 0.32, -0.46], [-0.67 + offset, 0.74 - index * 0.13, -0.05], [0.39 + offset, -0.05, 0.39]], colors[index]))
  })
  const coordinate = attach(stage, pin(COLOR.red))
  const coordinateCross = attach(stage, cross(0.10), [0.39, 0.32, 0.42])
  const coordinateFlow = wire(stage, [[-1.28, 0.32, -0.46], [-0.50, 0.32, 0.0], [0.39, 0.32, 0.40]], COLOR.red)
  const call = attach(stage, packet(COLOR.mint, 'click'))
  const callName = chapter.text('click(e12, r17)', [-1.27, -1.10, -0.10], 0.15, COLOR.mint)
  const rebound = chapter.text('唯一匹配 → click(e31, r18)', [-0.40, -1.10, 0.36], 0.18, COLOR.mint)
  const scope = chapter.text('先核对 app · windowId · 宽高', [-0.40, 1.05, -0.1], 0.17, COLOR.blue)
  const identity = chapter.text('身份 = 自身 + 父 + 子 + 兄弟；必须 enabled 且直接可操作', [-0.30, -1.13, 0.30], 0.16)
  const rejected = chapter.text('坐标不能跨 revision 重放', [-0.40, 0.92, 0.55], 0.18, COLOR.red)
  const ambiguousLabel = chapter.text('完整稳定身份出现两份：count = 2', [-0.43, 1.14, 0.55], 0.16, COLOR.amber)
  const stop = chapter.text('不猜目标，丢弃旧动作，再观察', [-0.40, -1.05, 0.55], 0.20, COLOR.amber)
  const normal = chapter.text('回到复诊任务 · 普通内科由本人明确', [-0.20, 0.75, 0.4], 0.19)
  const demo = chapter.text('页面重排 / 歧义分支为机制示意', [-0.28, -1.37, 0.0], 0.11, COLOR.blue)
  const forks = [wire(stage, [[-0.52, -0.03, 0.30], [0, 0.32, 0.55], [0.39, -0.05, 0.41]], COLOR.amber), wire(stage, [[-0.52, -0.03, 0.30], [0, -0.38, 0.55], [0.39, -0.42, 0.41]], COLOR.amber)]
  const blocked = attach(stage, cross(0.13), [-0.55, -0.03, 0.56])
  chapter.camera([
    [3.3, [-1.2, 0.65, 6.8], [-0.25, 0, 0], 36, -2],
    [7.1, [-2.65, 0.65, 5.55], [-0.55, 0, 0], 38, -3],
    [10.2, [0.1, 0.42, 5.90], [-0.40, 0, 0], 35],
    [14.1, [0.75, 1.65, 5.95], [-0.35, 0.0, 0.2], 37, 2],
    [17.7, [0, 0.25, 6.4], [0, 0, 0], 35],
  ])
  chapter.animate = (local) => {
    chapter.pose(local, [2.04, -0.15, -0.12], 0.72, [0, -0.16, 0], 18.5)
    const opened = windowAt(local, 1.7, 16.6, 1.0, 0.8)
    const duplicate = smooth01(local, 11.4, 0.8)
    chapter.show(stage, opened)
    chapter.show(newPage, opened * (1 - duplicate))
    chapter.show(ambiguous, opened * duplicate)
    const correspondence = windowAt(local, 5.5, 11.0)
    pins.forEach((mesh, index) => chapter.show(mesh, correspondence * smooth01(local, 5.4 + Math.floor(index / 2) * 0.3, 0.5)))
    flows.forEach((flow, index) => flow.update((local - 5.8 - index * 0.25) / 2.7, correspondence * chapter.env))
    travel(coordinate, [[-1.28, 0.32, -0.46], [0.39, 0.32, 0.42]], local, 3.1, 1.7)
    chapter.show(coordinate, windowAt(local, 3.1, 5.7))
    chapter.show(coordinateCross, windowAt(local, 4.5, 5.7))
    coordinateFlow.update((local - 3.1) / 1.7, windowAt(local, 3.1, 5.7) * chapter.env)
    travel(call, [[-1.25, -0.75, 0.1], [-0.52, -0.17, 0.8], [0.39, -0.05, 0.52]], local, 8.0, 2.5)
    chapter.show(call, windowAt(local, 7.8, 11.0))
    chapter.show(callName, windowAt(local, 2.8, 4.9))
    chapter.show(rebound, windowAt(local, 8.7, 11.0))
    chapter.show(scope, windowAt(local, 2.2, 3.9))
    chapter.show(identity, windowAt(local, 5.5, 8.1))
    chapter.show(rejected, windowAt(local, 4.1, 5.7))
    chapter.show(ambiguousLabel, windowAt(local, 11.5, 14.9))
    chapter.show(stop, windowAt(local, 13.2, 16.6))
    chapter.show(blocked, windowAt(local, 13.2, 16.2))
    forks.forEach((flow) => flow.update((local - 12.2) / 2, windowAt(local, 12.2, 16.2) * chapter.env))
    chapter.show(normal, windowAt(local, 17.0, 19.0))
    chapter.show(demo, opened)
    chapter.page('departments', 'doctors', local, 18.7)
    chapter.status = { label: '正在办', working: true }
  }
}

function buildAutonomy(chapter) {
  const stage = attach(chapter.group, new THREE.Group())
  const lanes = [0.63, 0.0, -0.65]
  const gates = []
  const rails = []
  const flows = lanes.map((height, index) => {
    const color = index ? COLOR.amber : COLOR.mint
    const rail = attach(stage, solid(2.9, 0.015, 0.22, 0x355059), [-0.38, height, -0.15 + index * 0.10])
    rails.push(rail)
    attach(rail, solid(2.9, 0.008, 0.012, color), [0, 0.055, 0.12])
    if (index === 0) {
      const reversible = attach(stage, ring(0.22, color, 0.010), [-0.44, height + 0.05, 0.2])
      reversible.rotation.y = 0.28
      rails.push(reversible)
    } else {
      gates.push(attach(stage, gate(color, 0.42, 0.43), [0.4, height + 0.16, 0.0 + index * 0.10]))
    }
    return wire(stage, [[-1.90, height + 0.13, 0.23], [-0.55, height + 0.13, 0.23], [1.0, height + 0.13, 0.23]], color)
  })
  const routine = attach(stage, packet(COLOR.mint, '翻页'))
  const unknown = attach(stage, packet(COLOR.amber, '?'))
  const commitment = attach(stage, packet(COLOR.red, '提交'))
  const labels = [chapter.text('可逆 · 信息明确', [-0.43, 0.98, 0.2], 0.15, COLOR.mint), chapter.text('信息缺口 · 先问本人', [-0.65, 0.35, 0.2], 0.15, COLOR.amber), chapter.text('对外承诺 / 不可逆 · 交还本人', [-0.44, -0.95, 0.25], 0.15, COLOR.amber)]
  const question = chapter.text('ask_user：上次是哪位医生？', [-0.65, 0.32, 0.7], 0.23)
  const choices = [chapter.text('陈医生？', [-1.44, -0.32, 0.62], 0.18, COLOR.amber), chapter.text('李医生？', [0.15, -0.32, 0.62], 0.18, COLOR.amber)]
  const forks = [wire(stage, [[-0.65, 0.06, 0.6], [-1.1, -0.03, 0.7], [-1.45, -0.22, 0.7]], COLOR.amber), wire(stage, [[-0.65, 0.06, 0.6], [-0.2, -0.03, 0.7], [0.15, -0.22, 0.7]], COLOR.amber)]
  const answer = chapter.text('本人：不记得了，问问女儿', [-0.62, -0.90, 0.65], 0.22, COLOR.amber)
  const route = chapter.text('ask_user 补齐信息 · ask_person 交还关键操作', [-0.45, -1.23, 0.3], 0.14, COLOR.blue)
  const letter = attach(stage, packet(COLOR.amber, '求助'))
  chapter.camera([
    [3.6, [-0.8, 2.70, 6.35], [-0.2, 0, 0], 38, -4],
    [6.4, [0.4, 0.24, 5.80], [-0.3, -0.1, 0.1], 35, -1],
    [9.0, [-0.8, -0.05, 5.25], [-0.5, 0.12, 0.2], 36],
    [13.7, [0.2, 0.6, 6.30], [0, 0, 0], 36, 2],
    [15.2, [0.1, 0.18, 5.55], [0, 0, 0], 35],
  ])
  chapter.animate = (local) => {
    chapter.pose(local, [1.86, -0.11, -0.12], 0.78)
    const opened = windowAt(local, 1.8, 13.8, 1, 0.8)
    chapter.show(stage, opened)
    const tracks = windowAt(local, 1.8, 7.2, 1, 0.7)
    rails.forEach((mesh) => chapter.show(mesh, tracks))
    flows.forEach((flow, index) => flow.update((local - 2.7 - index * 0.4) / 2.6, tracks * chapter.env))
    labels.forEach((mesh) => chapter.show(mesh, tracks))
    gates.forEach((mesh) => chapter.show(mesh, tracks))
    travel(routine, [[-1.9, 0.76, 0.25], [-0.40, 0.76, 0.25], [1.1, 0.76, 0.25]], local, 2.3, 2.7)
    travel(unknown, [[-1.9, 0.13, 0.25], [0.14, 0.13, 0.25]], local, 3.0, 2.6)
    const advance = smooth01(local, 3.5, 2.6)
    const bounce = Math.sin(clamp01((local - 6) / 0.75) * Math.PI) * 0.18
    commitment.position.set(-1.90 + 2.03 * advance - bounce, -0.52, 0.35)
    chapter.show(routine, tracks)
    chapter.show(unknown, tracks)
    chapter.show(commitment, tracks)
    chapter.show(route, windowAt(local, 4.5, 7.4))
    chapter.show(question, windowAt(local, 7.7, 11.1))
    choices.forEach((mesh) => chapter.show(mesh, windowAt(local, 8.4, 11.1)))
    forks.forEach((flow) => flow.update((local - 8.0) / 1.6, windowAt(local, 8.0, 11.1) * chapter.env))
    chapter.show(answer, windowAt(local, 11.4, 14.0))
    travel(letter, [[-0.64, -0.5, 0.7], [0.6, 0.3, 0.9], [1.9, 0.70, 0.0]], local, 12.5, 2)
    chapter.show(letter, windowAt(local, 12.3, 14.6))
    chapter.page('doctors')
    chapter.status = { label: local > 14.4 ? '已经找家人了' : local > 7.5 ? '等您回答一句' : '正在办', working: local <= 7.5 }
  }
}

function buildHandback(chapter) {
  const paper = attach(chapter.group, ticket([['医院 / 科室', '示例医院 · 普通内科'], ['医生', '陈医生'], ['就诊时间', '周四上午（示例）'], ['就诊人', '本人'], ['费用', '¥ 20.00 · 示例']]), [-1.27, 0.99, 0.3])
  const stopped = attach(chapter.group, packet(COLOR.mint, '提交'))
  const barrier = attach(chapter.group, gate(COLOR.amber, 0.64, 0.68), [-0.40, -0.18, 0.5])
  const decision = chapter.text('ask_person → 等您操作', [-0.65, -1.05, 0.5], 0.19, COLOR.amber)
  const information = chapter.text('每项可读，每项由您核对', [-0.30, 1.03, 0.4], 0.18)
  const finger = attach(chapter.phone, fingerprint())
  const target = new THREE.Vector3(0, -0.43, PHONE_Z.glass + 0.07)
  const touch = attach(chapter.phone, ring(0.065, COLOR.amber, 0.003), [target.x, target.y, PHONE_Z.glass + 0.008])
  const owner = chapter.text('本人亲自点按 · 不是 Agent 自动 click', [0.10, -0.91, 0.6], 0.17, COLOR.amber)
  const resume = chapter.text('随后由本人明确说“继续核对”，才恢复观察', [0, 1.06, 0.4], 0.18, COLOR.blue)
  chapter.camera([
    [3.6, [-1.05, 1.05, 6.6], [-0.1, 0, 0], 36, -3],
    [6.7, [0.5, 0.25, 5.75], [0, 0, 0], 35],
    [10.3, [0.85, -0.15, 4.5], [0.55, -0.19, 0.12], 34, 3],
    [13.0, [0.15, 0.20, 4.9], [0, 0, 0], 35],
  ])
  chapter.animate = (local) => {
    chapter.title.position.y -= smooth01(local, 7.5, 1.2) * 0.26
    chapter.show(chapter.title, windowAt(local, 1.0, 7.4, 0.7, 0.6))
    const open = chapter.pose(local, [0.98, -0.04, -0.02], 1.02, [0, -0.14, 0], 10.8)
    chapter.show(paper, windowAt(local, 1.7, 7.2, 0.8, 0.6))
    paper.rotation.y = -0.12 * open
    paper.userData.segments.forEach((hinge, index) => {
      const unfold = smooth01(local, 1.9 + index * 0.52, 0.9)
      hinge.rotation.x = (1 - unfold) * (index % 2 ? -1.23 : 1.23)
    })
    chapter.show(information, windowAt(local, 2.3, 5.7))
    chapter.show(barrier, windowAt(local, 5.7, 8.0))
    travel(stopped, [[-1.40, -0.20, 0.65], [-0.70, -0.20, 0.65]], local, 5.5, 1.2)
    chapter.show(stopped, windowAt(local, 5.5, 8.0))
    chapter.show(decision, windowAt(local, 5.7, 8.0))
    const approach = smooth01(local, 8.7, 1.45)
    const withdraw = smooth01(local, 10.7, 1.15)
    finger.position.copy(target).add(new THREE.Vector3(0.10 + withdraw * 0.45, 0.26, 0.95 * (1 - approach) + withdraw * 1.2))
    finger.rotation.set(-0.38, 0.15, -0.35)
    chapter.show(finger, windowAt(local, 8.4, 11.7))
    const touched = windowAt(local, 10.08, 10.85, 0.16, 0.35)
    touch.scale.setScalar(1 + smooth01(local, 10.1, 0.85) * 2.0)
    chapter.show(touch, touched)
    chapter.show(owner, windowAt(local, 8.4, 11.6))
    chapter.show(resume, windowAt(local, 12.0, 13.9))
    chapter.page('review', 'waiting', local, 10.75, 0.8)
    chapter.status = { label: '等您操作', working: false }
  }
}
