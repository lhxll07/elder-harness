import { SCREEN_W, SCREEN_H } from '../screen.js'
import { THREE, COLOR, attach, caption, crop, sheet, keycap, frame, railFrame, beam, flight, smooth01, windowAt } from './cinema-props.js'
import { ring, cross } from './mechanism-geometry.js'

export function buildPerception(chapter) {
  if (chapter.kind === 'observe') buildPeel(chapter)
  else buildReflow(chapter)
}

function semanticPage(source) {
  const canvas = document.createElement('canvas')
  canvas.width = SCREEN_W
  canvas.height = SCREEN_H
  const context = canvas.getContext('2d')
  context.fillStyle = '#142e36'
  context.fillRect(0, 0, SCREEN_W, SCREEN_H)
  context.globalAlpha = 0.09
  context.drawImage(source, 0, 0, SCREEN_W, SCREEN_H)
  context.globalAlpha = 1
  context.font = '500 48px "Noto Sans CJK SC", sans-serif'
  context.textBaseline = 'middle'
  const entries = [
    [60, 550, 960, 180, 'text: 示例医院'],
    [555, 968, 465, 280, '报告查询 · e08'],
    [60, 1288, 465, 280, '门诊缴费 · e09'],
    [555, 1288, 465, 280, '就诊记录 · e10'],
  ]
  entries.forEach(([left, top, width, height, content]) => {
    context.strokeStyle = '#80a5bc'
    context.lineWidth = 5
    context.strokeRect(left, top, width, height)
    context.fillStyle = '#b1cccf'
    context.fillText(content, left + 22, top + height / 2, width - 44)
  })
  context.setLineDash([22, 18])
  context.strokeStyle = '#d3aa74'
  context.strokeRect(60, 968, 465, 280)
  context.setLineDash([])
  context.fillStyle = '#d3aa74'
  context.font = '500 43px "Noto Sans CJK SC", sans-serif'
  context.fillText('这里没有可用控件', 86, 1108, 415)
  context.fillStyle = '#9baeb5'
  context.fillText('结构线索示意 · 不补造元素', 82, 1780)
  return canvas
}

function buildPeel(chapter) {
  const width = 1.90
  const height = width * 1.426 / 0.676
  const pixel = attach(chapter.group, sheet(chapter.pages.home, width, height))
  const semantic = attach(chapter.group, sheet(semanticPage(chapter.pages.home), width, height, 0xffffff))
  const horizontal = (292.5 / SCREEN_W - 0.5) * width
  const vertical = (0.5 - 1108 / SCREEN_H) * height
  const targetWidth = 465 / SCREEN_W * width
  const targetHeight = 280 / SCREEN_H * height
  const pixelTarget = attach(pixel, railFrame(targetWidth, targetHeight, 0x2d756b, 0.012), [horizontal, vertical, 0.05])
  const missing = attach(semantic, railFrame(targetWidth, targetHeight, COLOR.amber, 0.012), [horizontal, vertical, 0.05])
  const pixelName = attach(pixel, caption('像素：看得见的预约入口', 0.12, COLOR.ink), [0, 1.83, 0.05])
  const treeName = attach(semantic, caption('结构：文字、身份与关系', 0.12, COLOR.blue), [0, 1.83, 0.05])
  const connectors = Array.from({ length: 4 }, () => beam(chapter.group, COLOR.blue, 0.005))
  const scan = attach(pixel, new THREE.Mesh(new THREE.PlaneGeometry(width, 0.026), new THREE.MeshBasicMaterial({ color: COLOR.mint, transparent: true, opacity: 0.52, toneMapped: false })), [0, 1, 0.065])
  const focus = attach(chapter.group, ring(0.24, 0x27675b, 0.014))
  const resume = chapter.text('您：继续', [0, 0.95, 0.5], 0.20, COLOR.amber)
  const problem = chapter.text('看得到，却缺一条可用的结构线索', [0, 2.10, 0.1], 0.17, COLOR.amber)
  const permission = chapter.text('视觉通道 · 本人授权 / 非敏感页面', [0, -1.91, 0.5], 0.12, COLOR.blue)
  const merged = chapter.text('同一当前页，互补线索重新对齐', [0, 1.96, 0.5], 0.18, COLOR.mint)
  const target = chapter.text('预约挂号', [horizontal, vertical + 0.47, 1.10], 0.14, COLOR.mint)
  chapter.camera([
    [3.4, [0, 0.45, 7.4], [0, 0, -0.25], 39],
    [6.5, [-3.9, 0.58, 5.3], [0, 0.12, -0.10], 43, -5],
    [9.3, [-2.8, 0.34, 2.65], [-0.15, 0.14, -0.22], 49, -6],
    [12.8, [2.8, 0.55, 5.7], [0, 0.08, 0], 42, 3],
    [15.5, [0, 0.25, 7.0], [0, 0, -0.1], 38],
    [17.4, [0, 0.20, 5.5], [0, 0, 0], 35],
  ])
  chapter.animate = (local) => {
    const stage = windowAt(local, 2.0, 15.9, 1.3, 1.4)
    chapter.device(local, [0, 0, -0.62], 2.81, [0, 0, 0], 1.9, 15.7)
    chapter.dimPhone(1 - stage)
    const peel = smooth01(local, 4.0, 2.0) * (1 - smooth01(local, 12.7, 2.0))
    pixel.position.set(peel * 0.55, 0, -0.50 + peel * 1.52)
    semantic.position.set(-peel * 0.55, 0, -0.54 - peel * 1.12)
    chapter.show(pixel, stage)
    chapter.show(semantic, stage * windowAt(local, 4.0, 14.5, 1.0, 0.6))
    chapter.show(pixelName, windowAt(local, 4.8, 8.1) * stage)
    chapter.show(treeName, windowAt(local, 4.8, 8.1) * stage)
    chapter.show(pixelTarget, windowAt(local, 5.6, 15.6) * stage)
    chapter.show(missing, windowAt(local, 5.6, 12.2) * stage)
    scan.position.y = 1.75 - 3.25 * smooth01(local, 6.1, 3.4)
    chapter.show(scan, windowAt(local, 6.0, 10.2) * stage)
    const corners = [[horizontal - targetWidth / 2, vertical - targetHeight / 2], [horizontal + targetWidth / 2, vertical - targetHeight / 2], [horizontal - targetWidth / 2, vertical + targetHeight / 2], [horizontal + targetWidth / 2, vertical + targetHeight / 2]]
    corners.forEach(([left, top], index) => {
      connectors[index].update([left + pixel.position.x, top, pixel.position.z + 0.05], [left + semantic.position.x, top, semantic.position.z + 0.05])
      chapter.show(connectors[index].object, windowAt(local, 8.6, 14.4) * stage)
    })
    focus.position.set(horizontal + pixel.position.x, vertical, pixel.position.z + 0.08)
    focus.scale.setScalar(0.95 + Math.sin(local * 3) * 0.04)
    chapter.show(focus, windowAt(local, 11.1, 15.6))
    target.position.z = pixel.position.z + 0.15
    target.position.x = horizontal + pixel.position.x
    chapter.show(target, windowAt(local, 11.4, 15.5))
    chapter.show(resume, windowAt(local, 0.65, 2.4))
    chapter.show(problem, windowAt(local, 3.0, 6.9))
    chapter.show(permission, windowAt(local, 3.2, 7.0))
    chapter.show(merged, windowAt(local, 13.1, 15.7))
    chapter.page('home', 'departments', local, 16.0, 0.9)
    chapter.status = { label: local < 1.2 ? '停下了' : local < 2.1 ? '正在听…' : '正在办', working: local >= 2.1 }
  }
}

function buildReflow(chapter) {
  const surface = attach(chapter.group, new THREE.Group(), [0, 0, -0.22])
  const header = attach(surface, sheet(crop(chapter.pages.departments, 0, 540, 1080, 270), 2.5, 0.625), [0, 1.38, 0])
  const target = attach(surface, keycap('普通内科', 'e12 · r17 · enabled', 2.25, 0.59), [0, 0.66, 0.12])
  const targetDisplay = target.children.find((object) => object.material?.map)
  const oldTexture = targetDisplay.material.map
  const newTexture = keycap('普通内科', 'e31 · r18 · enabled', 2.25, 0.59).children.find((object) => object.material?.map).material.map
  const wrong = attach(surface, keycap('全科门诊', '另一入口 · 不可误点', 2.25, 0.59, COLOR.blue), [0, -0.12, 0.12])
  const third = attach(surface, keycap('外科门诊', '其他科室', 2.25, 0.59, COLOR.blue), [0, -0.90, 0.12])
  const rebound = attach(surface, caption('e31 / r18 ← e12 / r17', 0.14, COLOR.mint), [0, -1.39, 0.18])
  const reflowNote = attach(surface, caption('布局换位，结构顺序不变（示意）', 0.11, COLOR.blue), [0, 1.03, 0.18])
  const duplicate = attach(surface, keycap('普通内科', 'e41 · 相同完整身份', 2.25, 0.59, COLOR.amber), [0, -0.90, 0.14])
  const blockers = [-0.12, -0.90].map((vertical) => attach(surface, cross(0.16), [0, vertical, 0.60]))
  const shield = attach(surface, railFrame(2.38, 0.67, COLOR.red), [0, 0.66, 0.57])
  const oldFlight = flight(chapter.group, [[-3.3, 0.66, 1.4], [-1.4, 0.66, 1.05], [0, 0.66, 0.40]], COLOR.red, 0.013)
  const matched = flight(chapter.group, [[-2.7, 0.55, 1.3], [-1.3, 0.04, 0.90], [0, -0.12, 0.02]], COLOR.mint)
  const branches = [-0.12, -0.90].map((vertical) => flight(chapter.group, [[-2.3, -0.12, 1.3], [-1.15, vertical, 0.95], [0, vertical, 0.44]], COLOR.amber, 0.010))
  const identity = attach(target, new THREE.Group())
  const identityEdges = []
  const identities = [['自身 · text / id', [-1.48, 0.39, 0.18]], ['父节点 · 科室列表', [1.48, 0.39, 0.18]], ['子节点 · 门诊说明', [-1.48, -0.39, 0.18]], ['兄弟序列 · 未变', [1.48, -0.39, 0.18]]]
  identities.forEach(([content, point]) => {
    attach(identity, caption(content, 0.12, COLOR.blue), point)
    const connector = beam(identity, COLOR.blue, 0.004)
    connector.update([point[0] * 0.64, point[1], point[2]], [point[0] * 0.24, 0, 0.12])
    identityEdges.push(connector)
  })
  const mismatch = chapter.text('旧坐标前方，已经不是刚才的按钮', [0, 1.72, 0.3], 0.18, COLOR.red)
  const stopped = chapter.text('revision 更新 → 重新核对当前页', [-0.5, -0.4, 0.75], 0.16, COLOR.amber)
  const identityRule = chapter.text('按稳定身份，重新匹配同一控件', [0, 1.80, 0.3], 0.17, COLOR.mint)
  const check = chapter.text('app / windowId / 尺寸一致 · 直接可操作 · 两页均唯一', [0, -1.46, 0.6], 0.13, COLOR.blue)
  const ambiguous = chapter.text('身份重复 → 进入重新观察分支', [0, 1.77, 0.3], 0.17, COLOR.amber)
  const reread = chapter.text('重读当前页，确认唯一目标', [0, -1.46, 0.6], 0.17, COLOR.amber)
  const normal = chapter.text('回到唯一目标，继续同一次复诊', [0, 1.45, 0.3], 0.18, COLOR.mint)
  chapter.camera([
    [3.3, [-0.6, 0.65, 6.7], [0, 0.05, 0], 40, -3],
    [6.1, [-2.55, 0.78, 3.5], [-0.35, 0.56, 0.24], 47, -6],
    [9.5, [2.05, 1.14, 6.1], [0, -0.05, 0], 42, 3],
    [13.1, [-0.35, 2.4, 6.0], [0, -0.18, 0], 43, -3],
    [17.2, [0.25, 0.30, 6.2], [0, 0.02, 0], 39],
    [19.3, [0, 0.20, 5.0], [0, 0, 0], 35],
  ])
  chapter.animate = (local) => {
    const stage = windowAt(local, 1.9, 18.2, 1.2, 1.2)
    chapter.device(local, [0, 0, -0.8], 2.1, [0, 0, 0], 1.5, 18.5)
    chapter.dimPhone(1 - stage)
    chapter.show(surface, stage)
    const reflow = smooth01(local, 3.8, 1.3)
    targetDisplay.material.map = reflow > 0.5 ? newTexture : oldTexture
    target.position.y = 0.66 - reflow * 0.78
    wrong.position.y = -0.12 + reflow * 0.78
    const ambiguousPhase = windowAt(local, 11.9, 15.4, 0.5, 0.5)
    chapter.show(third, stage * (1 - ambiguousPhase))
    chapter.show(duplicate, stage * ambiguousPhase)
    chapter.show(header, stage)
    chapter.show(identity, windowAt(local, 7.5, 11.5) * stage)
    chapter.show(rebound, (windowAt(local, 9.0, 11.6) + windowAt(local, 16.0, 17.2)) * stage)
    chapter.show(reflowNote, windowAt(local, 7.6, 11.6) * stage)
    chapter.show(shield, windowAt(local, 5.1, 7.1) * stage)
    oldFlight.update(smooth01(local, 2.6, 3.0), 0.52)
    chapter.show(oldFlight.root, windowAt(local, 2.6, 7.1))
    matched.update(smooth01(local, 16.0, 1.5), 0.70)
    chapter.show(matched.root, windowAt(local, 16.0, 18.2))
    branches.forEach((path, index) => {
      path.update(smooth01(local, 12.3, 1.0), 0.76)
      chapter.show(path.root, ambiguousPhase)
      chapter.show(blockers[index], windowAt(local, 13.0, 15.4) * stage)
    })
    chapter.show(mismatch, windowAt(local, 3.3, 5.4))
    chapter.show(stopped, windowAt(local, 5.3, 7.1))
    chapter.show(identityRule, windowAt(local, 7.6, 11.5))
    chapter.show(check, windowAt(local, 8.2, 11.5))
    chapter.show(ambiguous, windowAt(local, 12.0, 15.4))
    chapter.show(reread, windowAt(local, 13.2, 15.4))
    chapter.show(normal, windowAt(local, 16.1, 18.1))
    chapter.page('departments', 'doctors', local, 18.2, 0.8)
    chapter.status = { label: '正在办', working: true }
  }
}
