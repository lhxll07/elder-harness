import { THREE, COLOR, attach, caption, flight, drawing, write, smooth01, windowAt } from './cinema-props.js'
import { cross, ring } from './mechanism-geometry.js'
import { machined, ticket, laminate } from './cinema-finish.js'

export function buildFinale(chapter) {
  if (chapter.kind === 'evolve') buildLaboratory(chapter)
  else buildClosing(chapter)
}

function cassette(label, color = COLOR.mint) {
  const root = new THREE.Group()
  attach(root, machined(0.68, 0.94, 0.13, 0x23443f, 0.34))
  for (let layer = 0; layer < 5; layer++) attach(root, machined(0.57, 0.008, 0.10, 0xa5b7a2, 0.57), [0.02, -0.30 + layer * 0.12, 0.065])
  attach(root, machined(0.075, 0.88, 0.17, color, 0.26), [-0.29, 0, 0.015])
  for (const horizontal of [-0.20, 0.25]) {
    for (const vertical of [-0.40, 0.40]) {
      attach(root, new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.004, 20), new THREE.MeshStandardMaterial({ color: 0x7c9788, metalness: 0.82, roughness: 0.35 })), [horizontal, vertical, 0.068]).rotation.x = Math.PI / 2
    }
  }
  for (let tooth = 0; tooth < 7; tooth++) attach(root, machined(0.031, 0.075, 0.012, 0xb19b68, 0.38), [-0.14 + tooth * 0.049, -0.41, 0.075])
  attach(root, ticket(label, 'immutable', 0.53, 0.31, color), [0.035, 0.18, 0.12])
  return root
}

function portal(parent, horizontal, color) {
  const root = attach(parent, new THREE.Group(), [horizontal, 0, 0])
  attach(root, machined(1.55, 0.11, 0.88, 0x355157), [0, -0.84, -0.10])
  for (const side of [-1, 1]) {
    attach(root, machined(0.09, 1.48, 0.16, 0x647e7a), [side * 0.59, -0.04, -0.20])
    attach(root, machined(0.019, 1.28, 0.018, color), [side * 0.59, -0.04, -0.10])
  }
  attach(root, machined(1.28, 0.095, 0.17, 0x647e7a), [0, 0.70, -0.20])
  const hinge = attach(root, new THREE.Group(), [-0.58, -0.18, -0.08])
  attach(hinge, machined(1.17, 0.065, 0.09, color), [0.58, 0, 0])
  return { root, hinge }
}

function replaySurface(title, detail, accent) {
  return laminate(drawing(2.15, 0.97, (context, width, height) => {
    const gradient = context.createLinearGradient(0, 0, width, height)
    gradient.addColorStop(0, '#294b4c')
    gradient.addColorStop(1, '#193039')
    context.fillStyle = gradient
    context.fillRect(0, 0, width, height)
    write(context, title, 0.12, 0.18, 0.13, accent)
    write(context, detail, 0.12, 0.44, 0.13, '#dce8df')
    write(context, 'page observation', 0.12, 0.75, 0.085, '#8caaa9')
    context.fillStyle = '#476862'
    context.fillRect(1.54, 0.70, 0.42, 0.022)
    context.fillRect(1.68, 0.79, 0.28, 0.022)
  }), 2.15, 0.97, 0x4a6b65, 0.065)
}

function buildLaboratory(chapter) {
  const bench = attach(chapter.group, new THREE.Group())
  attach(bench, machined(6.16, 0.13, 1.24, 0x2a454c, 0.31), [0, -0.98, -0.12])
  for (const horizontal of [-2.72, 2.72]) {
    attach(bench, machined(0.12, 0.24, 0.92, 0x172e35, 0.50), [horizontal, -1.12, -0.12])
    for (const vertical of [-0.60, 0.36]) attach(bench, new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.006, 24), new THREE.MeshStandardMaterial({ color: 0x859a91, roughness: 0.38, metalness: 0.80 })), [horizontal, -0.910, vertical])
  }
  const stations = [-2.05, 0, 2.05].map((horizontal, index) => portal(bench, horizontal, index === 2 ? COLOR.amber : COLOR.mint))
  const candidate = attach(bench, cassette('候选 v2', COLOR.amber), [-2.05, -0.13, 0.30])
  const stamp = attach(bench, machined(0.45, 0.20, 0.34, 0x8bb9a7), [-2.05, 1.12, 0.25])
  for (const [index, content] of ['T0  契约与安全', 'T1  反事实回放', 'T2  实机回归'].entries()) attach(bench, caption(content, 0.18, index === 2 ? COLOR.amber : COLOR.mint), [-2.05 + index * 2.05, 1.34, 0.02])
  const benchNote = chapter.text('候选经验 → 契约检查 → 双轨回放 → 实机回归', [0, -1.36, 0.65], 0.13, COLOR.blue)
  const replay = attach(chapter.group, new THREE.Group())
  const target = attach(replay, replaySurface('目标 · 医院任务', '普通内科 / 可预约', '#a9cebb'), [-1.35, 0.28, 0.22])
  const other = attach(replay, replaySurface('非目标 · 同应用其他页', '消息列表 / 联系人', '#d7b981'), [1.35, 0.28, 0.22])
  const targetPath = flight(replay, [[-1.35, -0.27, 0.25], [-1.35, -0.70, 0.65], [-0.22, -0.70, 0.65]], COLOR.mint, 0.012)
  const otherPath = flight(replay, [[1.35, -0.27, 0.25], [1.35, -0.70, 0.65], [0.87, -0.70, 0.65]], COLOR.amber, 0.012)
  const stopper = attach(replay, machined(0.075, 0.38, 0.12, 0x9f6e5d), [0.84, -0.70, 0.65])
  const refused = attach(replay, cross(0.14), [0.84, -0.70, 0.74])
  const match = chapter.text('同一套触发条件，同时检验两类页面', [0, 1.28, 0.5], 0.17, COLOR.blue)
  const formula = chapter.text('apps 匹配  ∧  requires 全部出现在当前页', [0, -1.14, 0.70], 0.17)
  const offline = chapter.text('目标命中 / 非目标暴露 · 离线双轨评估', [0, -1.43, 0.65], 0.125, COLOR.blue)
  const threshold = chapter.text('准入门槛：非目标暴露率 = 0', [0, 1.60, 0.5], 0.16, COLOR.amber)
  const fixture = attach(chapter.group, new THREE.Group(), [1.62, 0, 0.10])
  const deviceGate = portal(fixture, 0, COLOR.amber)
  attach(fixture, machined(0.59, 1.12, 0.09, 0x172d35), [0, -0.03, -0.31])
  attach(fixture, ticket('T2', '待执行', 0.45, 0.43, COLOR.amber), [0, 0.07, -0.24])
  const rules = attach(chapter.group, laminate(drawing(2.88, 1.60, (context, width, height) => {
    context.fillStyle = '#203b40'
    context.fillRect(0, 0, width, height)
    write(context, 'T2 / 实机回归准入规则', 0.15, 0.21, 0.16, '#d8bb88')
    const lines = ['目标改善 ≥ 2/3；旧任务不退化', '不新增 false_done / 越界', '步数与 token ≤ 基线 1.3 倍']
    lines.forEach((line, index) => {
      context.fillStyle = '#718e82'
      context.beginPath()
      context.arc(0.19, 0.60 + index * 0.34, 0.022, 0, Math.PI * 2)
      context.fill()
      write(context, line, 0.28, 0.60 + index * 0.34, 0.122, '#d9e4da')
    })
  }), 2.88, 1.60), [-1.19, 0.02, 0.22])
  const pending = chapter.text('以实机表现，检验候选方法的价值', [0, 1.33, 0.6], 0.21, COLOR.amber)
  const versions = attach(chapter.group, new THREE.Group())
  attach(versions, machined(4.50, 0.10, 0.93, 0x2d464b), [0, -0.85, 0.05])
  const current = attach(versions, cassette('v1'), [-1.26, -0.17, 0.22])
  const held = attach(versions, cassette('v2', COLOR.amber), [1.26, -0.17, 0.22])
  const activeRail = attach(versions, machined(0.93, 0.025, 0.35, 0x8abdab), [-1.26, -0.77, 0.40])
  attach(versions, caption('active → v1', 0.18, COLOR.mint), [-1.26, 0.62, 0.30])
  attach(versions, caption('candidate → v2', 0.18, COLOR.amber), [1.26, 0.62, 0.30])
  attach(versions, ticket('验证决定准入', '版本留存 · 切换可回退', 2.22, 0.62, COLOR.amber), [0, 1.25, 0.25])
  const returnPath = flight(versions, [[1.26, -0.62, 0.45], [0.7, -1.06, 0.90], [-0.7, -1.06, 0.90], [-1.26, -0.62, 0.45]], COLOR.blue, 0.008)
  chapter.camera([
    [3.4, [-2.2, 2.5, 8.7], [0, 0.05, 0], 40, -3],
    [5.4, [-1.15, 0.90, 7.7], [-0.40, 0.02, 0.1], 39, -1],
    [8.4, [0.20, 0.85, 7.6], [0, 0.04, 0.2], 39, 1],
    [10.4, [0.30, 0.55, 7.4], [0, 0.02, 0.2], 39],
    [12.8, [1.5, 0.85, 7.7], [0, 0.04, 0.1], 39, 2],
    [16.1, [-0.30, 0.70, 7.0], [0, 0, 0.15], 38],
    [17.9, [0, 0.25, 5.4], [0, 0, 0], 36],
  ])
  chapter.animate = (local) => {
    const stage = windowAt(local, 1.8, 17.5, 1.0, 1.0)
    chapter.device(local, [0, -0.12, -1.1], 1.8, [0, 0, 0], 1.6, 17.4)
    chapter.dimPhone(1 - stage)
    const wide = windowAt(local, 1.9, 6.1, 0.8, 0.6)
    chapter.show(bench, wide)
    chapter.show(benchNote, wide)
    const press = Math.sin(smooth01(local, 3.2, 1.5) * Math.PI)
    stamp.position.y = 1.12 - press * 0.36
    candidate.rotation.y = -0.14
    candidate.position.z = 0.30 - smooth01(local, 4.2, 1.1) * 0.49
    stations[0].hinge.rotation.z = smooth01(local, 4.2, 0.8) * Math.PI / 2
    stations[1].hinge.rotation.z = 0
    stations[2].hinge.rotation.z = 0
    const counterfactual = windowAt(local, 6.0, 10.9, 0.65, 0.6)
    chapter.show(replay, counterfactual)
    target.rotation.y = -0.10
    other.rotation.y = 0.10
    targetPath.update(smooth01(local, 6.7, 2.1), 0.55)
    otherPath.update(smooth01(local, 7.2, 1.5), 0.55)
    chapter.show(stopper, counterfactual)
    chapter.show(refused, counterfactual * smooth01(local, 8.4, 0.4))
    chapter.show(match, counterfactual)
    chapter.show(formula, counterfactual)
    chapter.show(offline, counterfactual)
    chapter.show(threshold, counterfactual)
    const device = windowAt(local, 11.0, 14.9, 0.65, 0.55)
    chapter.show(fixture, device)
    chapter.show(rules, device)
    chapter.show(pending, device)
    deviceGate.hinge.rotation.z = 0
    const version = windowAt(local, 15.0, 17.6, 0.6, 0.6)
    chapter.show(versions, version)
    current.rotation.y = -0.08
    held.rotation.y = 0.13
    held.position.y = -0.17 + Math.sin(smooth01(local, 15.2, 1.4) * Math.PI) * 0.08
    activeRail.material.emissive.setHex(0x3f7965)
    activeRail.material.emissiveIntensity = 0.20
    returnPath.update(smooth01(local, 15.4, 1.8), 0.35)
    chapter.page('result', null, local)
    chapter.status = { label: '待您确认', working: false }
  }
}

function buildClosing(chapter) {
  const emblem = attach(chapter.group, new THREE.Group(), [0, 0.95, 0.05])
  attach(emblem, new THREE.Mesh(new THREE.CylinderGeometry(0.245, 0.245, 0.045, 96), new THREE.MeshPhysicalMaterial({ color: 0x276b58, metalness: 0.54, roughness: 0.29, clearcoat: 0.6, transparent: true })))
  emblem.children[0].rotation.x = Math.PI / 2
  attach(emblem, machined(0.063, 0.155, 0.022, 0xcadbc8, 0.30), [0, 0.027, 0.039])
  const arch = attach(emblem, new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.010, 12, 48, Math.PI), new THREE.MeshStandardMaterial({ color: 0xcadbc8, metalness: 0.4, roughness: 0.32, transparent: true })), [0, 0.015, 0.041])
  arch.rotation.z = Math.PI
  attach(emblem, machined(0.014, 0.057, 0.018, 0xcadbc8), [0, -0.093, 0.039])
  attach(emblem, machined(0.090, 0.015, 0.018, 0xcadbc8), [0, -0.124, 0.039])
  const brand = chapter.text('银龄智办', [0, 0.28, 0.20], 0.48, 0xe3e9e1)
  const promise = chapter.text('复杂留给系统，决定留给您', [0, -0.24, 0.20], 0.22, COLOR.text)
  const principle = chapter.text('办成有证据 · 帮忙有分寸', [0, -0.60, 0.20], 0.17, COLOR.mint)
  const status = chapter.text('原型与机制演示 · 业务数据为示例', [0, -0.93, 0.20], 0.105, COLOR.blue)
  const validation = chapter.text('验证进度：家人端 E2E、T2 实机回归待验证', [0, -1.13, 0.20], 0.095, COLOR.blue)
  const halo = attach(chapter.group, ring(1.24, COLOR.mint, 0.004), [0, 0.25, -0.50])
  const orbit = attach(chapter.group, ring(1.31, COLOR.amber, 0.0025), [0, 0.25, -0.53])
  chapter.camera([[3.0, [0, 0.20, 5.8], [0, 0, 0], 34], [6.8, [0, 0.20, 5.8], [0, 0, 0], 34]])
  for (const key of chapter.cameraRig.keys.filter((entry) => entry.t >= chapter.chapter.end - 0.9)) key.pos.set(0, 0.20, 5.8)
  chapter.animate = (local) => {
    const open = smooth01(local, 0.65, 1.8)
    chapter.phone.position.set(-1.91 * open, -0.11 * open, -0.13 * open)
    chapter.phone.scale.setScalar(1.1 - 0.40 * open)
    chapter.phone.rotation.y = 0.13 * open
    emblem.rotation.y = -0.22 * (1 - open)
    emblem.position.y = 0.95 - (1 - open) * 0.12
    chapter.show(emblem, smooth01(local, 1.1, 1.1))
    chapter.show(brand, smooth01(local, 1.1, 1.1))
    chapter.show(promise, smooth01(local, 2.1, 0.8))
    chapter.show(principle, smooth01(local, 2.8, 0.8))
    chapter.show(status, smooth01(local, 3.5, 0.8))
    chapter.show(validation, smooth01(local, 3.5, 0.8))
    halo.rotation.set(0.16 + 0.03 * open, 0.23, 0)
    orbit.rotation.set(-0.13, -0.27, 0)
    halo.scale.setScalar(0.88 + open * 0.14)
    orbit.scale.setScalar(0.88 + open * 0.14)
    chapter.show(halo, windowAt(local, 1.0, 6.9, 1.3, 1.5) * 0.34)
    chapter.show(orbit, windowAt(local, 1.2, 6.6, 1.3, 1.5) * 0.16)
    chapter.page('result', null, local)
    chapter.status = { label: '待您确认', working: false }
  }
}
