import * as THREE from 'three'
import { COLOR, caption, attach, drawing, write, solid, wire, ring, gate, packet, book, cross, travel, windowAt, smooth01 } from './mechanism-geometry.js'

export function buildSkillMechanism(chapter) {
  if (chapter.kind === 'teach') buildLibrary(chapter)
  else if (chapter.kind === 'evolve') buildLaboratory(chapter)
  else buildCoda(chapter)
}

function buildLibrary(chapter) {
  const library = attach(chapter.group, new THREE.Group())
  attach(library, solid(3.46, 0.05, 0.44, COLOR.ink), [-0.20, -0.73, -0.06])
  const names = ['盲页观察', '读表格', '微信输入', '扩展目录', '候选方法']
  const volumes = names.map((name, index) => attach(library, book(name, index === 1 ? COLOR.mint : COLOR.blue), [-1.55 + index * 0.66, -0.28, -0.12]))
  attach(volumes[1], drawing(0.46, 0.68, (context, width, height) => {
    context.fillStyle = '#b7c8c0'
    context.fillRect(0, 0, width, height)
    write(context, '排班示意', width / 2, 0.07, 0.055, '#335950', 'center')
    context.fillStyle = '#7ea69b'
    context.fillRect(0.16, 0.13, 0.13, 0.48)
    for (let column = 0; column < 3; column++) {
      const horizontal = 0.09 + column * 0.14
      write(context, ['三', '四', '五'][column], horizontal, 0.17, 0.045, '#233d38', 'center')
      for (let row = 0; row < 3; row++) {
        write(context, column === 1 ? '陈' : '李', horizontal, 0.29 + row * 0.13, 0.047, '#233d38', 'center')
      }
    }
  }), [0, 0, 0.073])
  const catalog = attach(chapter.group, drawing(2.95, 0.52, (context, width, height) => {
    context.fillStyle = '#29444b'
    context.fillRect(0, 0, width, height)
    write(context, '常驻：触发规则 + 一行技巧目录', 0.12, 0.16, 0.103, '#8abdab')
    write(context, '动手前查对应技巧；具体内容不常驻', 0.12, 0.37, 0.083)
  }), [-0.20, 0.70, 0.22])
  const pull = chapter.text('load_skill("reading_tables")', [-0.28, 0.94, 0.6], 0.18, COLOR.mint)
  const detail = attach(chapter.group, drawing(1.64, 1.01, (context, width, height) => {
    context.fillStyle = '#b7c8c0'
    context.fillRect(0, 0, width, height)
    write(context, 'reading_tables / 内置技巧', 0.10, 0.15, 0.080, '#335950')
    write(context, '1. 先读表头：日期 / 时段', 0.10, 0.37, 0.080, '#233d38')
    write(context, '2. 定位目标列，逐条带列头读', 0.10, 0.59, 0.076, '#233d38')
    write(context, '3. 列头跳变 → 重新数列', 0.10, 0.81, 0.080, '#233d38')
  }), [0.15, 0.10, 0.84])
  const transcript = attach(chapter.group, solid(1.78, 0.11, 0.35, 0x345259), [0.15, -0.87, 0.40])
  attach(transcript, caption('tool result → transcript → 下一轮决策', 0.11, COLOR.mint), [0, 0.11, 0.20])
  const loaded = wire(chapter.group, [[-0.90, -0.15, 0.60], [-0.50, 0.40, 0.98], [0.15, -0.85, 0.68]], COLOR.mint)
  const notScript = chapter.text('不保存固定坐标；仍受当前页守卫和本人操作边界约束', [-0.2, -1.07, 0.5], 0.16, COLOR.amber)
  const allClosed = chapter.text('只展开需要的一册，其余仍留在目录', [-0.22, 1.06, 0.2], 0.17)
  const candidate = attach(chapter.group, book('候选 v2', COLOR.amber, 0.62, 0.85), [-0.53, 0.04, 0.65])
  const enclosure = attach(chapter.group, new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.88, 1.10, 0.44)), new THREE.LineBasicMaterial({ color: COLOR.amber, transparent: true, opacity: 0.65 })), [-0.53, 0.04, 0.65])
  const candidateCaption = chapter.text('任务经确认后 → 候选经验；封存，不当场启用', [0.0, -0.90, 0.62], 0.19, COLOR.amber)
  const candidateNote = chapter.text('家人示范采集与自动学会尚未实现', [0.0, -1.07, 0.50], 0.13, COLOR.blue)
  chapter.camera([
    [3.3, [-0.5, 0.8, 6.80], [-0.1, 0, 0], 36, -2],
    [7.0, [-2.0, 0.5, 5.85], [-0.50, 0, 0.25], 37, -4],
    [10.5, [0.40, 0.25, 5.7], [-0.25, 0, 0.4], 35, 1],
    [14.8, [0.95, 0.95, 6.0], [0, 0, 0.3], 36, 2],
    [17.0, [0.1, 0.2, 5.9], [0, 0, 0], 35],
  ])
  chapter.animate = (local) => {
    chapter.pose(local, [2.16, -0.14, -0.2], 0.73, [0, -0.18, 0])
    const shelf = windowAt(local, 1.7, 12.7, 0.9, 0.7)
    chapter.show(library, shelf)
    volumes.forEach((volume, index) => {
      const entrance = smooth01(local, 1.8 + index * 0.18, 0.8)
      volume.position.set(-1.55 + index * 0.66, -0.28 - (1 - entrance) * 0.35, -0.12)
      volume.rotation.y = -0.10
      volume.userData.cover.rotation.y = 0
      if (index === 1) {
        const selected = windowAt(local, 5.7, 11.4, 1.3, 0.8)
        volume.position.add(new THREE.Vector3(-0.16, 0.48, 0.90).multiplyScalar(selected))
        volume.userData.cover.rotation.y = -1.70 * smooth01(local, 6.2, 1.3) * (1 - smooth01(local, 11.4, 0.8))
      }
    })
    chapter.show(catalog, windowAt(local, 2.0, 5.1))
    chapter.show(allClosed, windowAt(local, 3.0, 5.1))
    chapter.show(pull, windowAt(local, 5.4, 8.0))
    chapter.show(detail, windowAt(local, 7.7, 11.7, 0.8, 0.6))
    detail.rotation.y = -0.08 + smooth01(local, 7.7, 2) * 0.08
    chapter.show(transcript, windowAt(local, 8.3, 12.4))
    loaded.update((local - 8.3) / 3.4, windowAt(local, 8.3, 12.4) * chapter.env)
    chapter.show(notScript, windowAt(local, 9.3, 12.4))
    chapter.show(candidate, windowAt(local, 13.2, 16.6))
    chapter.show(enclosure, windowAt(local, 13.2, 16.6))
    candidate.rotation.y = 0.17 + Math.sin(local * 0.6) * 0.05
    enclosure.rotation.y = candidate.rotation.y
    chapter.show(candidateCaption, windowAt(local, 13.5, 16.7))
    chapter.show(candidateNote, windowAt(local, 14.6, 16.7))
    chapter.page('result')
    chapter.status = { label: '待您确认', working: false }
  }
}

function replayPage(title, lines, color) {
  return drawing(1.23, 0.76, (context, width, height) => {
    context.fillStyle = '#233e46'
    context.fillRect(0, 0, width, height)
    write(context, title, 0.09, 0.14, 0.082, color)
    lines.forEach((line, index) => write(context, line, 0.09, 0.36 + index * 0.19, 0.071))
  })
}

function buildLaboratory(chapter) {
  const bench = attach(chapter.group, new THREE.Group())
  attach(bench, solid(4.52, 0.10, 0.8, 0x2c454c), [0, -0.64, -0.20])
  const checks = [-1.55, 0, 1.55].map((horizontal, index) => attach(bench, gate(index === 2 ? COLOR.amber : COLOR.mint, 0.78, 1.02), [horizontal, -0.07, -0.1]))
  const candidate = attach(bench, book('候选 v2', COLOR.amber, 0.43, 0.63), [-1.55, -0.10, 0.36])
  const stamp = attach(bench, solid(0.26, 0.25, 0.22, COLOR.mint), [-1.55, 0.74, 0.4])
  const contract = chapter.text('T0 · 参数契约 / 安全策略 / 脱敏', [-1.48, 0.87, 0.2], 0.145, COLOR.mint)
  const shadow = chapter.text('T1 · 反事实回放', [0.18, 0.87, 0.20], 0.16, COLOR.blue)
  const regression = chapter.text('T2 · 冻结任务集回归', [1.6, 0.87, 0.20], 0.15, COLOR.amber)
  const replay = attach(chapter.group, new THREE.Group())
  const target = attach(replay, replayPage('目标 / 医院任务', ['当前页：普通内科', '可预约 · 就诊人'], '#8abdab'), [-0.91, 0.21, 0.54])
  const other = attach(replay, replayPage('非目标 / 同应用其他页', ['当前页：消息列表', '联系人 · 通知'], '#d3aa74'), [0.67, 0.21, 0.54])
  const targetRoute = wire(replay, [[-0.92, -0.15, 0.5], [-0.92, -0.63, 0.7], [0.5, -0.63, 0.7]], COLOR.mint)
  const otherRoute = wire(replay, [[0.67, -0.15, 0.5], [0.67, -0.63, 0.7], [0.95, -0.63, 0.7]], COLOR.amber)
  const noExposure = attach(replay, cross(0.11), [0.95, -0.63, 0.72])
  const observation = chapter.text('只匹配 page observation；剥离“已安装应用”和“提示”', [-0.10, 1.00, 0.4], 0.16, COLOR.blue)
  const formula = chapter.text('exposed = apps 匹配 ∧ requires 全部出现在当前页', [-0.10, -0.88, 0.5], 0.16)
  const threshold = chapter.text('准入门槛：非目标暴露率 = 0；不是本片测得的通过率', [-0.1, -1.12, 0.4], 0.13, COLOR.amber)
  const offline = chapter.text('requires 这里用于离线门禁；未接入运行时自动选择', [-0.1, -1.36, 0.4], 0.12, COLOR.blue)
  const fixture = attach(chapter.group, new THREE.Group(), [0.52, -0.07, 0.46])
  const deviceBoundary = attach(chapter.group, gate(COLOR.amber, 0.78, 1.02), [0.52, -0.07, 0.32])
  attach(fixture, solid(0.65, 0.10, 0.47, COLOR.ink), [0, -0.56, 0])
  attach(fixture, new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.43, 0.94, 0.08)), new THREE.LineBasicMaterial({ color: COLOR.amber, transparent: true, opacity: 0.65 })), [0, 0, 0.0])
  const waiting = chapter.text('实机回归待执行 · 门仍然关闭', [-0.42, -1.10, 0.6], 0.21, COLOR.amber)
  const admission = chapter.text(['准入规则，不是当前成绩', '目标改善 ≥ 2/3；旧任务不退化', '不新增 false_done / 越界', '步数与 token 不高于基线 1.3 倍'], [-1.12, 0.03, 0.6], 0.58)
  const versions = attach(chapter.group, new THREE.Group())
  attach(versions, book('v1', COLOR.mint), [-1.0, 0, 0.44])
  attach(versions, book('v2', COLOR.amber), [0.8, 0, 0.44])
  const active = chapter.text('active → v1', [-1.0, 0.68, 0.5], 0.17, COLOR.mint)
  const held = chapter.text('candidate → v2', [0.8, 0.68, 0.5], 0.17, COLOR.amber)
  const immutable = chapter.text('版本不可变，切换 active 指针；保留旧版，可回退', [0, -0.82, 0.5], 0.18)
  const heldCaption = chapter.text('验证未齐，候选不自动上线', [0, -1.03, 0.5], 0.15, COLOR.amber)
  const rollback = wire(versions, [[0.8, -0.45, 0.4], [0, -0.74, 0.7], [-1.0, -0.45, 0.4]], COLOR.blue)
  chapter.camera([
    [3.0, [-1.2, 1.8, 7.20], [-0.20, 0, 0], 37, -3],
    [5.2, [-1.8, 0.35, 5.8], [-0.48, 0, 0], 37, -2],
    [8.5, [0.4, 1.0, 6.6], [0, 0.0, 0.3], 36, 2],
    [12.3, [1.55, 0.52, 6.4], [0.10, 0, 0.3], 36, 3],
    [16.2, [0.15, 0.4, 6.25], [-0.1, 0, 0.2], 36],
    [17.3, [0, 0.2, 5.6], [0, 0, 0], 35],
  ])
  chapter.animate = (local) => {
    chapter.pose(local, [2.42, -0.21, -0.25], 0.68, [0, -0.18, 0])
    const wide = windowAt(local, 1.7, 5.8, 0.9, 0.6)
    chapter.show(bench, wide)
    chapter.show(contract, wide)
    chapter.show(shadow, wide)
    chapter.show(regression, wide)
    const press = Math.sin(smooth01(local, 3.3, 1.3) * Math.PI)
    stamp.position.y = 0.74 - press * 0.37
    candidate.rotation.y = -0.15
    checks[0].userData.hinge.rotation.z = smooth01(local, 4.2, 0.8) * Math.PI / 2
    checks[1].userData.hinge.rotation.z = 0
    checks[2].userData.hinge.rotation.z = 0
    const counterfactual = windowAt(local, 6.2, 10.7, 0.7, 0.6)
    chapter.show(replay, counterfactual)
    target.rotation.y = -0.12
    other.rotation.y = 0.09
    targetRoute.update((local - 7.0) / 2.4, counterfactual * chapter.env)
    otherRoute.update((local - 7.5) / 1.8, counterfactual * chapter.env)
    chapter.show(noExposure, counterfactual * smooth01(local, 8.4, 0.4))
    chapter.show(observation, counterfactual)
    chapter.show(formula, counterfactual)
    chapter.show(threshold, counterfactual)
    chapter.show(offline, counterfactual)
    const deviceGate = windowAt(local, 11.2, 14.8, 0.7, 0.6)
    chapter.show(deviceBoundary, deviceGate)
    chapter.show(fixture, deviceGate)
    chapter.show(admission, deviceGate)
    chapter.show(waiting, deviceGate)
    chapter.show(versions, windowAt(local, 15.2, 17.4))
    chapter.show(active, windowAt(local, 15.3, 17.4))
    chapter.show(held, windowAt(local, 15.3, 17.4))
    chapter.show(immutable, windowAt(local, 15.6, 17.4))
    chapter.show(heldCaption, windowAt(local, 16.2, 17.4))
    rollback.update((local - 15.4) / 2.4, windowAt(local, 15.4, 17.4) * chapter.env)
    chapter.page('result')
    chapter.status = { label: '待您确认', working: false }
  }
}

function buildCoda(chapter) {
  const promise = chapter.text('复杂留给系统，决定留给您', [0, -0.10, 0.4], 0.24)
  const principle = chapter.text('办成有证据 · 帮忙有分寸', [0, -0.47, 0.4], 0.19, COLOR.mint)
  const status = chapter.text('原型演示 · 不代表实际预约成功', [0, -0.77, 0.4], 0.11, COLOR.blue)
  const orbit = attach(chapter.group, ring(0.98, COLOR.mint, 0.004), [0, 0.27, -0.35])
  chapter.camera([[3.5, [0, 0.28, 5.8], [0, 0, 0], 34], [6.5, [0, 0.28, 5.8], [0, 0, 0], 34]])
  for (const key of chapter.cameraRig.keys.filter((entry) => entry.t >= chapter.chapter.end - 0.9)) key.pos.set(0, 0.28, 5.8)
  chapter.animate = (local) => {
    const open = smooth01(local, 0.65, 1.8)
    chapter.phone.position.set(-1.72 * open, -0.13 * open, -0.13 * open)
    chapter.phone.scale.setScalar(1.1 - 0.44 * open)
    chapter.phone.rotation.y = 0.17 * open
    chapter.title.position.set(0, 0.38, 0.4)
    chapter.show(chapter.title, smooth01(local, 1.0, 1.1))
    chapter.show(promise, smooth01(local, 2.1, 0.8))
    chapter.show(principle, smooth01(local, 2.8, 0.8))
    chapter.show(status, smooth01(local, 3.6, 0.8))
    orbit.rotation.set(open * 0.16, open * 0.22, 0)
    orbit.scale.setScalar(0.82 + open * 0.22)
    chapter.show(orbit, windowAt(local, 1.2, 6.1) * 0.35)
    chapter.page('result')
    chapter.status = { label: '待您确认', working: false }
  }
}
