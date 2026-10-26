import { Chapter } from '../chapter.js'
import { CameraRig } from '../stage.js'
import { makePhone } from '../props.js'
import { PhoneView } from '../phoneview.js'
import { SCREEN_W, SCREEN_H } from '../screen.js'
import { hospitalPage, floatingPill } from './voice.js'
import { journeyPage } from './journey-ui.js'
import { crop, frame as outline, beam } from './cinema-props.js'
import { canvasSurface, windowAt } from './mechanism-geometry.js'
import { foldedNote, laptopDetails } from './cinema-finish.js'
import { paper, printedPage, accordion, stageFloor, bookmark, paperTrail, touchHalo, THREE, COLOR, attach, caption, drawing, write, solid, fade, machined, smooth01 } from './kinetic-props.js'

const familyImages = Object.fromEntries(await Promise.all(['request', 'compose', 'submitted', 'delivered', 'read'].map(async (name) => {
  const image = new Image()
  image.src = `/assets/family/${name}.png`
  await image.decode()
  return [name, image]
})))

export function build(context) {
  return new KineticChapter(context)
}

function frame(width, height, color) {
  const mesh = outline(width, height, color)
  mesh.renderOrder = 4
  return mesh
}

class KineticChapter extends Chapter {
  constructor(context) {
    super(context)
    this.kind = this.chapter.name
    this.duration = this.chapter.end - this.chapter.start
    this.group.name = `kinetic-${this.kind}`
    this.phone = attach(this.group, makePhone())
    this.phone.name = 'phone'
    this.view = new PhoneView(this.stage, this.phone)
    this.pages = Object.fromEntries(['departments', 'doctors', 'dates', 'review', 'waiting', 'result'].map((kind) => [kind, journeyPage(kind)]))
    this.pages.home = hospitalPage()
    this.billboards = []
    this.quaternion = new THREE.Quaternion()
    this.floor = stageFloor(this.group)
    this.aperture = 0.00004
    this.maxBlur = 0.00035
    this.pageKinds = ['home', 'departments', 'doctors', 'dates', 'review', 'result']
    this.pageNames = ['预约入口', '选择科室', '查找医生', '读取排班', '核对信息', '提交状态']
    const builders = { observe: buildPeel, loop: buildRebind, ladder: buildCompression, guard: buildRelay, handback: buildDecision, evidence: buildReceipt, teach: buildReading, evolve: buildExperience }
    builders[this.kind](this)
  }

  text(content, point, height = 0.18, color = COLOR.text) {
    const mesh = attach(this.group, caption(content, height, color), point)
    mesh.name = content
    mesh.userData.anchor = [...point]
    mesh.userData.lane = point[1] > 1.4 ? 'top' : point[1] < -1.4 ? 'bottom' : null
    if (mesh.userData.lane) {
      mesh.material.depthTest = false
      mesh.renderOrder = 30
      const original = mesh.material.map.image
      const canvas = document.createElement('canvas')
      canvas.width = original.width
      canvas.height = original.height
      const context = canvas.getContext('2d')
      context.shadowColor = 'rgba(6,24,29,0.95)'
      context.shadowBlur = 10
      context.shadowOffsetY = 2
      for (let pass = 0; pass < 3; pass++) context.drawImage(original, 0, 0)
      const texture = new THREE.CanvasTexture(canvas)
      texture.colorSpace = THREE.SRGBColorSpace
      mesh.material.map = texture
    }
    this.billboards.push(mesh)
    return mesh
  }

  show(object, amount) { fade(object, amount * this.env) }

  dimPhone(amount) { fade(this.phone, amount) }

  presence(local, start = 1.0, end = this.duration - 2.0) {
    return windowAt(local, start, end, 1.1, 1.0)
  }

  pose(local, position, scale = 2.2, rotation = [0, 0, 0]) {
    const amount = this.presence(local)
    this.phone.position.set(...position).multiplyScalar(amount)
    this.phone.scale.setScalar(1.1 + (scale - 1.1) * amount)
    this.phone.rotation.set(...rotation.map((value) => value * amount))
  }

  camera(keys) {
    this.cameraRig = new CameraRig()
    for (const local of [-0.9, 0.95]) this.cameraRig.at(this.chapter.start + local, [0, 0.10, 4.45], [0, 0, 0], { fov: 34 })
    for (const [local, position, look, fov = 38, roll = 0] of keys) this.cameraRig.at(this.chapter.start + local, position, look, { fov, roll })
    for (const local of [this.duration - 0.9, this.duration + 0.9]) this.cameraRig.at(this.chapter.start + local, [0, 0.10, 4.45], [0, 0, 0], { fov: 34 })
  }

  page(first, second, local, start = Infinity, duration = 0.75) {
    this.view.g.drawImage(this.pages[first], 0, 0, SCREEN_W, SCREEN_H)
    const amount = smooth01(local, start, duration)
    if (second && amount > 0) {
      this.view.g.save()
      this.view.g.globalAlpha = amount
      this.view.g.drawImage(this.pages[second], 0, 0, SCREEN_W, SCREEN_H)
      this.view.g.restore()
    }
  }

  book() {
    return accordion(this.pageKinds.map((kind) => crop(this.pages[kind], 0, 550, SCREEN_W, 1600)), this.pageNames)
  }

  update(local, absolute, env) {
    this.env = env
    this.phone.visible = true
    this.phone.position.set(0, 0, 0)
    this.phone.rotation.set(0, 0, 0)
    this.phone.scale.setScalar(1.1)
    this.dimPhone(1)
    this.floor.show(this.presence(local) * env * 0.72)
    this.animate(local)
    floatingPill(this.view.g, absolute - 44, 1, this.status ?? { label: '正在办', working: true })
    this.view.commitNow()
  }

  afterCamera(camera) {
    camera.getWorldQuaternion(this.quaternion)
    const viewHeight = 12 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
    const depth = new THREE.Vector3(0, 0, -6).applyMatrix4(camera.matrixWorld).project(camera).z
    this.billboards.forEach((mesh) => {
      mesh.quaternion.copy(this.quaternion)
      mesh.position.set(...mesh.userData.anchor)
      if (!mesh.userData.lane) return
      mesh.geometry.computeBoundingBox()
      const halfWidth = (mesh.geometry.boundingBox.max.x - mesh.geometry.boundingBox.min.x) / 4.2
      const horizontal = THREE.MathUtils.clamp(mesh.userData.anchor[0] * 0.18, -0.92 + halfWidth, 0.92 - halfWidth)
      mesh.position.set(horizontal, mesh.userData.lane === 'top' ? 0.66 : -0.56, depth).unproject(camera)
      mesh.scale.setScalar(viewHeight / 4.2)
    })
  }
}

function buildPeel(chapter) {
  const pixels = attach(chapter.group, paper(crop(chapter.pages.home, 0, 550, SCREEN_W, 1600), 2.7, 4.0))
  const structure = attach(chapter.group, printedPage('同一页 / 结构', ['医院服务', '门诊入口 · 可点按', '预约挂号 · 图形线索缺口', '父子关系 / 控件身份'], 2.7, 4.0), [0, 0, -0.3])
  const layers = Array.from({ length: 7 }, (_, index) => {
    const layer = attach(chapter.group, frame(2.7, 4.0, index % 2 ? COLOR.blue : COLOR.mint))
    return { layer, index }
  })
  const entrance = attach(chapter.group, frame(1.13, 0.78, COLOR.amber))
  const links = Array.from({ length: 4 }, () => beam(chapter.group, COLOR.mint, 0.004))
  const sight = chapter.text('看见外观', [-1.3, 2.25, 0.2], 0.20)
  const identity = chapter.text('读懂结构', [1.5, 2.25, -0.5], 0.20, COLOR.mint)
  const permit = chapter.text('本人授权 / 非敏感页', [0, -2.12, 0.4], 0.13, COLOR.amber)
  const joined = chapter.text('两种线索，同一个入口', [0, 2.23, 0.5], 0.25, COLOR.mint)
  chapter.camera([
    [3.2, [0.3, 0.28, 6.4], [0, 0, 0.3], 39],
    [6.0, [4.8, 1.9, 6.3], [0, 0, -0.4], 43, -5],
    [9.4, [5.4, 0.8, 2.5], [0, 0, -0.6], 46, -3],
    [12.6, [2.6, 0.5, 5.9], [0, 0, 0], 41, 2],
    [16.2, [0, 0.20, 6.2], [0, 0, 0], 36],
  ])
  chapter.animate = (local) => {
    const stage = windowAt(local, 2.1, 16.5, 1.0, 1.0)
    const peel = smooth01(local, 4.0, 3.0) * (1 - smooth01(local, 12.2, 2.0))
    const returnPage = smooth01(local, 14.5, 2.2)
    chapter.pose(local, [0, 0, -0.55], 2.65)
    chapter.dimPhone(1 - stage * (1 - smooth01(local, 15.8, 1.1)))
    pixels.position.set(-peel * 0.40, 0, 0.30 + peel * 0.86)
    structure.position.set(peel * 0.30, 0, -0.15 - peel * 1.75)
    for (const object of [pixels, structure]) {
      object.scale.setScalar(1 - returnPage * 0.45)
      object.rotation.y = peel * -0.10
      chapter.show(object, stage)
    }
    layers.forEach(({ layer, index }) => {
      layer.position.set(-0.4 * peel + index * 0.10 * peel, 0, 1.16 - index * 0.43 * peel)
      chapter.show(layer, windowAt(local, 5.0 + index * 0.09, 12.3, 0.6, 1.0) * 0.38)
    })
    links.forEach((link, index) => {
      const horizontal = index % 2 ? 0.90 : -0.90
      const vertical = index < 2 ? 1.38 : -1.35
      link.update([pixels.position.x + horizontal, vertical, pixels.position.z], [structure.position.x + horizontal, vertical, structure.position.z])
      chapter.show(link.object, stage * peel * 0.45)
    })
    entrance.position.set(-0.63 + pixels.position.x, 0.50, pixels.position.z + 0.04)
    chapter.show(entrance, windowAt(local, 10.8, 16.4))
    chapter.show(sight, windowAt(local, 4.5, 11.9))
    chapter.show(identity, windowAt(local, 5.0, 11.9))
    chapter.show(permit, windowAt(local, 7.8, 11.8))
    chapter.show(joined, windowAt(local, 12.7, 16.6))
    chapter.page('home', 'departments', local, 16.7)
    chapter.status = { label: local < 2 ? '接着办' : '正在找入口', working: true }
  }
}

function buildRebind(chapter) {
  const root = attach(chapter.group, new THREE.Group())
  const board = attach(root, paper(crop(chapter.pages.departments, 0, 550, SCREEN_W, 1600), 2.85, 4.25))
  const strips = ['普通内科', '全科门诊', '外科门诊'].map((title, index) => {
    const strip = attach(root, printedPage(title, [index ? '门诊入口' : 'id: dept / 同一科室'], 2.42, 0.72), [0, 0.9 - index * 0.94, 0.16])
    return strip
  })
  const oldTarget = attach(root, frame(2.52, 0.80, COLOR.red), [0, 0.9, 0.29])
  const newTarget = attach(root, frame(2.52, 0.80, COLOR.mint))
  const trace = paperTrail(chapter.group, [[-3.5, 1.4, 2.3], [-2.1, 1.2, 1.7], [-0.8, 0.9, 0.8], [0, 0.9, 0.36]], 0.06)
  const stable = chapter.text('位置在变，身份不变', [0, 2.37, 0.2], 0.27, COLOR.mint)
  const revision = chapter.text('旧落点先停下 / 核对当前页', [-1.2, -2.25, 0.6], 0.15, COLOR.amber)
  const signature = chapter.text('文字 · 控件身份 · 父子与兄弟关系', [0, -2.20, 0.7], 0.14, COLOR.mint)
  const ambiguity = chapter.text('匹配不唯一，就重新观察', [0, 2.35, 0.5], 0.20, COLOR.amber)
  const duplicates = attach(root, frame(2.52, 0.80, COLOR.amber), [0, -0.98, 0.27])
  chapter.camera([
    [3.2, [-0.7, 0.1, 6.5], [0, 0.05, 0], 41],
    [6.1, [-2.0, 1.1, 5.2], [0, 0.65, 0.2], 41, -5],
    [8.5, [2.8, 0.8, 5.6], [0, 0.15, 0], 44, 4],
    [12.6, [0.8, 0.0, 6.4], [0, -0.2, 0], 40],
    [16.3, [-0.6, 0.6, 6.7], [0, 0.1, 0], 42, -2],
    [18.6, [0, 0.16, 5.4], [0, 0, 0], 35],
  ])
  chapter.animate = (local) => {
    const stage = windowAt(local, 2.0, 18.4, 1, 1.0)
    const move = smooth01(local, 5.4, 1.65)
    const settle = smooth01(local, 17.2, 1.7)
    root.scale.setScalar(1 - settle * 0.46)
    root.rotation.y = Math.sin(local * 0.14) * 0.06 * stage
    chapter.show(root, stage)
    chapter.pose(local, [0, 0, -0.65], 2.5)
    chapter.dimPhone(1 - stage * (1 - smooth01(local, 17.5, 1.1)))
    strips[0].position.y = 0.9 - move * 0.94
    strips[1].position.y = -0.04 + move * 0.94
    strips[0].position.z = 0.16 + Math.sin(move * Math.PI) * 0.32
    strips[1].position.z = 0.16 - Math.sin(move * Math.PI) * 0.05
    trace.update(smooth01(local, 3.3, 1.8))
    chapter.show(trace.mesh, windowAt(local, 3.0, 8.8))
    chapter.show(oldTarget, windowAt(local, 5.4, 9.0) * stage)
    newTarget.position.set(0, strips[0].position.y, 0.35)
    chapter.show(newTarget, windowAt(local, 9.1, 18.1) * stage)
    chapter.show(duplicates, windowAt(local, 13.8, 15.5) * stage)
    chapter.show(stable, windowAt(local, 9.0, 13.4))
    chapter.show(revision, windowAt(local, 5.8, 9.0))
    chapter.show(signature, windowAt(local, 9.1, 13.5))
    chapter.show(ambiguity, windowAt(local, 14.0, 16.1))
    chapter.page('departments', 'doctors', local, 18.9)
    chapter.status = { label: local < 8.5 ? '核对当前页面' : '找准了，继续', working: true }
  }
}

function buildCompression(chapter) {
  const book = chapter.book()
  attach(chapter.group, book.root, [0, 0, -0.8])
  const question = attach(chapter.group, bookmark('上次是哪位医生？', '只差这一项信息', 2.25))
  const gap = attach(chapter.group, frame(2.34, 0.94, COLOR.amber))
  const headline = chapter.text('长长的流程，只留下此刻的问题', [0, 2.18, 0.3], 0.30)
  const ask = chapter.text('“不记得了，问问女儿。”', [0, -1.62, 0.7], 0.23, COLOR.amber)
  chapter.camera([
    [2.8, [-5.2, 0.35, 3.5], [-2.8, 0, -0.7], 50, -6],
    [4.3, [-3.6, 0.6, 4.5], [-1.8, 0, -0.8], 48, -3],
    [6.8, [4.0, 3.0, 8.5], [0, 0, -0.65], 47, 3],
    [9.5, [5.0, 1.1, 5.8], [0, 0.15, -0.6], 43],
    [12.4, [1.2, 0.45, 5.8], [0, 0.25, 0.2], 37],
    [14.7, [0, 0.2, 5.0], [0, 0.15, 0], 35],
  ])
  chapter.animate = (local) => {
    const stage = windowAt(local, 1.5, 15.4, 1.0, 1.0)
    const fold = smooth01(local, 4.4, 5.0)
    book.fold(fold, { wave: 0.38, open: 0.15 })
    book.root.position.set(-0.7, -0.18 + fold * 0.82, -1.1)
    book.root.rotation.set(0.04, -0.25 + fold * 0.65, -0.03)
    book.root.scale.setScalar(1.25 - fold * 0.20 - smooth01(local, 11.1, 1.6) * 0.4)
    book.show(stage * chapter.env)
    chapter.pose(local, [0.55, -0.05, 0.55], 2.2, [0, -0.14, 0])
    chapter.dimPhone(1 - stage * (1 - smooth01(local, 7.5, 1.6)))
    const emerge = smooth01(local, 8.0, 1.9)
    question.position.set(0.12, 0.45 + emerge * 0.22, -0.3 + emerge * 1.5)
    question.rotation.y = (1 - emerge) * 1.28
    question.scale.setScalar(0.65 + emerge * 0.35)
    chapter.show(question, windowAt(local, 8.0, 14.9))
    gap.position.copy(question.position)
    gap.position.z += 0.035
    chapter.show(gap, windowAt(local, 9.6, 14.9) * 0.7)
    chapter.show(headline, windowAt(local, 5.0, 8.4))
    chapter.show(ask, windowAt(local, 12.0, 15.5))
    chapter.page('doctors')
    chapter.status = { label: local < 9 ? '正在整理复诊流程' : '上次是哪位医生？', working: local < 9 }
  }
}

function buildRelay(chapter) {
  const book = chapter.book()
  attach(chapter.group, book.root)
  const laptop = attach(chapter.group, new THREE.Group(), [2.8, 0.20, -0.8])
  attach(laptop, machined(3.86, 2.5, 0.10, 0x314d55), [0, 0, -0.08])
  attach(laptop, machined(3.98, 0.065, 1.38, 0x647b80), [0, -1.28, 0.60])
  laptopDetails(laptop)
  const screens = ['request', 'compose', 'submitted', 'delivered', 'read'].map((name, index) => {
    const screen = attach(laptop, canvasSurface(familyImages[name], 3.62, 2.25), [0, 0, 0.01 + index * 0.002])
    screen.material.depthWrite = true
    screen.renderOrder = 2
    return screen
  })
  const trail = paperTrail(chapter.group, [[2.3, 0.4, -0.3], [1.3, 1.65, 0.8], [-0.5, 1.5, 1.1], [-2.1, 0.55, 0.65]], 0.13)
  const note = attach(chapter.group, foldedNote())
  const slot = attach(chapter.group, frame(1.9, 0.93, COLOR.amber), [-2.1, 0.65, 0.9])
  const sent = chapter.text('已提交 → 已送达 → 本人已读', [1.5, -1.75, 0.5], 0.14, COLOR.blue)
  const known = chapter.text('“是陈医生，周四上午，继续。”', [0, 2.12, 0.8], 0.23, COLOR.amber)
  const preserved = chapter.text('只补这一项，不必从头再来', [0, 2.13, 0.7], 0.25, COLOR.mint)
  chapter.camera([
    [3.0, [-3.1, 1.25, 8.3], [-0.4, 0.0, -0.2], 44, -4],
    [6.4, [3.3, 0.8, 5.0], [2.7, 0.15, -0.6], 43, 1],
    [10.6, [3.6, 0.4, 4.5], [2.7, 0.0, -0.5], 42],
    [14.5, [-0.2, 2.3, 7.9], [0.2, 0.35, 0], 45, -4],
    [17.4, [-3.1, 0.7, 6.1], [-2.0, 0.15, 0.2], 40],
    [19.1, [-0.3, 0.25, 6.1], [-0.6, 0.1, 0], 38],
  ])
  chapter.animate = (local) => {
    const stage = windowAt(local, 1.6, 19.0, 0.9, 1.0)
    const returnScene = smooth01(local, 18.0, 1.5)
    chapter.pose(local, [-2.1, -0.1, 0.4], 2.15, [0, 0.13, 0])
    book.fold(0.97)
    book.root.position.set(-2.1, -0.15, -1.0)
    book.root.rotation.y = 0.42
    book.root.scale.setScalar(0.64)
    book.show(stage * chapter.env * 0.85)
    chapter.show(laptop, stage)
    laptop.position.x = 2.8 + returnScene * 2
    const changes = [0, 6.8, 10.2, 11.7, 14.4]
    screens.forEach((screen, index) => {
      const arrived = index ? smooth01(local, changes[index], 0.42) : 1
      const retired = index < screens.length - 1 && local >= changes[index + 1] + 0.42
      chapter.show(screen, retired ? 0 : stage * arrived)
    })
    const delivery = smooth01(local, 11.4, 4.0)
    trail.update(delivery)
    chapter.show(trail.mesh, windowAt(local, 11.2, 17.8))
    trail.curve.getPoint(delivery, note.position)
    note.rotation.set(0.04, -0.2 + delivery * 0.35, Math.sin(delivery * Math.PI) * -0.14)
    note.userData.fold(0.60 * (1 - smooth01(local, 13.7, 1.5)))
    note.scale.setScalar(0.70 + smooth01(local, 14, 1.5) * 0.22)
    chapter.show(note, windowAt(local, 11.4, 17.5))
    chapter.show(slot, windowAt(local, 2.0, 16.4) * 0.65)
    chapter.show(sent, windowAt(local, 10.2, 14.7))
    chapter.show(known, windowAt(local, 16.5, 18.6))
    chapter.show(preserved, windowAt(local, 3.0, 5.4))
    chapter.page('doctors', 'review', local, 18.7)
    chapter.status = { label: local < 13 ? '等家人补充信息' : local < 17 ? '请您核对留言' : '信息已确认，继续', working: local >= 17 }
  }
}

function buildDecision(chapter) {
  const book = chapter.book()
  attach(chapter.group, book.root)
  const choices = [
    bookmark('陈医生', '本人已确认', 1.45),
    bookmark('周四上午', '示例时段', 1.65),
    bookmark('¥20.00', '示例费用 / 本人核对', 1.75),
  ].map((choice) => attach(chapter.group, choice))
  const halo = touchHalo(chapter.group)
  const decision = chapter.text('这一按，始终留给您', [-3.4, 2.07, 0.5], 0.31, COLOR.amber)
  const folded = chapter.text('折叠的是操作，不是决定', [0, 2.18, 0.5], 0.30)
  chapter.camera([
    [3.0, [-5.2, 2.4, 10.3], [0, 0, -0.4], 46, -4],
    [5.6, [4.6, 2.5, 7.5], [0, 0, -0.5], 43, 3],
    [8.0, [0.65, 0.4, 6.7], [0, 0, 0.5], 37],
    [11.5, [0, 0.1, 6.7], [0, 0, 0.5], 37],
    [12.8, [0, 0.1, 5.5], [0, 0, 0.2], 35],
  ])
  chapter.animate = (local) => {
    const stage = windowAt(local, 1.4, 12.9, 0.9, 0.9)
    const fold = smooth01(local, 3.0, 4.1)
    const pocket = smooth01(local, 6.4, 1.8)
    book.fold(fold, { wave: 0.40, open: 0.13 })
    book.root.position.set(0, pocket * 1.25, -0.65 - pocket * 0.20)
    book.root.rotation.set(0.03, 0.2 + fold * 0.90, 0)
    book.root.scale.setScalar(1.18 - pocket * 0.82)
    book.show(stage * chapter.env * (1 - smooth01(local, 7.5, 1.0)))
    chapter.pose(local, [0, 0.27, 0.60], 2.25, [0, -0.10 * (1 - fold), 0])
    chapter.dimPhone(1 - stage * (1 - smooth01(local, 5.0, 1.6)))
    choices.forEach((choice, index) => {
      const lift = smooth01(local, 3.4 + index * 0.38, 1.5)
      const tuck = smooth01(local, 6.3 + index * 0.20, 1.3)
      const targetHeight = [0.50, 0.12, -0.85][index]
      choice.position.set((index - 1) * 1.85 * (1 - tuck), (0.85 + lift * 0.35) * (1 - tuck) + targetHeight * tuck, 0.1 + lift * 1.2 - tuck * 0.55)
      choice.rotation.y = (1 - lift) * 1.1
      choice.scale.setScalar(0.8 + lift * 0.2 - tuck * 0.40)
      chapter.show(choice, windowAt(local, 3.3 + index * 0.3, 7.1 + index * 0.12) * (1 - smooth01(local, 6.3 + index * 0.20, 1.1)))
    })
    chapter.show(folded, windowAt(local, 2.8, 6.9))
    chapter.show(decision, windowAt(local, 8.3, 11.9))
    const touch = smooth01(local, 11.0, 0.7)
    halo.position.set(0, -0.99, 0.79)
    halo.scale.setScalar(0.8 + touch * 1.6)
    chapter.show(halo, windowAt(local, 11.0, 11.6, 0.15, 0.5))
    chapter.page('review', 'waiting', local, 11.8)
    chapter.status = { label: local < 11.8 ? '请您核对并提交' : '帮您核对结果', working: local >= 11.8 }
  }
}

function buildReceipt(chapter) {
  const source = attach(chapter.group, paper(crop(chapter.pages.result, 0, 620, SCREEN_W, 1440), 3.05, 4.07))
  const fragments = [
    { top: 1158, height: 160, width: 2.70, displayHeight: 0.40, target: [-1.55, 1.10, 1.35] },
    { top: 1392, height: 192, width: 2.70, displayHeight: 0.49, target: [-1.55, 0.18, 1.50] },
    { top: 1624, height: 192, width: 2.70, displayHeight: 0.49, target: [-1.55, -0.74, 1.65] },
  ].map((entry) => ({ ...entry, mesh: attach(chapter.group, paper(crop(chapter.pages.result, 60, entry.top, 960, entry.height), entry.width, entry.displayHeight)), connector: beam(chapter.group, COLOR.mint, 0.004) }))
  const selfTyped = attach(chapter.group, printedPage('自己写下的文字', ['“预约成功”', '来源：SELF_TYPED'], 1.9, 1.45), [2.3, -0.40, 0.7])
  const headline = chapter.text('每项结论，都有出处', [0, 2.43, 0.4], 0.30)
  const provenance = chapter.text('输入的文字，不替代页面事实', [1.4, -1.71, 0.8], 0.15, COLOR.blue)
  const audit = chapter.text('动作与返回配对 → 页面证据 → 模型复核', [0, -2.20, 0.8], 0.14, COLOR.mint)
  const submitted = chapter.text('已提交', [-0.84, 0.52, 1.6], 0.40, COLOR.mint)
  const pending = chapter.text('待医院确认', [1.02, 0.52, 1.6], 0.32, COLOR.amber)
  const pendingFrame = attach(chapter.group, frame(2.40, 0.83, COLOR.amber), [1.02, 0.52, 1.45])
  chapter.camera([
    [3.1, [0.3, 0.2, 6.8], [0, 0, 0], 40],
    [6.3, [-1.9, 0.6, 6.4], [0, 0.1, 0.4], 42, -3],
    [10.5, [-4.5, 1.7, 6.0], [-0.2, 0.0, 0.4], 44, -4],
    [14.6, [2.8, 0.7, 7.3], [0, 0, 0.2], 43, 3],
    [18.8, [0, 0.35, 7.4], [0, 0.25, 0.2], 39],
    [20.5, [0, 0.2, 5.9], [0, 0.1, 0], 36],
  ])
  chapter.animate = (local) => {
    const stage = windowAt(local, 2.0, 20.5, 0.9, 1.0)
    const extract = smooth01(local, 5.1, 3.0)
    const finish = smooth01(local, 17.4, 1.7)
    const returnPage = smooth01(local, 19.4, 1.8)
    chapter.pose(local, [0, 0, -0.45], 2.4)
    chapter.dimPhone(1 - stage * (1 - smooth01(local, 19.7, 1.4)))
    source.position.set(extract * 0.85, 0, -extract * 0.55)
    source.rotation.y = -extract * 0.16
    source.scale.setScalar(1 - returnPage * 0.42)
    chapter.show(source, stage * (1 - finish * 0.84))
    fragments.forEach((entry, index) => {
      const lift = smooth01(local, 5.2 + index * 1.2, 2.1)
      const from = new THREE.Vector3(0, (0.5 - (entry.top + entry.height / 2 - 620) / 1440) * 4.07, 0.03)
      entry.mesh.position.copy(from).lerp(new THREE.Vector3(...entry.target), lift)
      entry.mesh.rotation.y = -lift * 0.12
      entry.mesh.rotation.z = lift * (index - 1) * 0.025
      chapter.show(entry.mesh, windowAt(local, 5.0 + index * 1.2, 17.8) * (1 - finish))
      entry.connector.update([source.position.x - 0.8, from.y, source.position.z + 0.04], entry.mesh.position.toArray())
      chapter.show(entry.connector.object, windowAt(local, 6.2 + index * 1.1, 17.0) * 0.5)
    })
    selfTyped.rotation.y = smooth01(local, 12.5, 1.4) * 0.72
    selfTyped.position.z = 0.7 - smooth01(local, 12.5, 1.4) * 0.65
    chapter.show(selfTyped, windowAt(local, 10.9, 15.4) * 0.58)
    chapter.show(headline, windowAt(local, 3.2, 10.0))
    chapter.show(provenance, windowAt(local, 11.2, 15.6))
    chapter.show(audit, windowAt(local, 14.8, 17.7))
    chapter.show(submitted, windowAt(local, 17.9, 20.5))
    chapter.show(pending, windowAt(local, 17.9, 20.5))
    chapter.show(pendingFrame, windowAt(local, 17.9, 20.5))
    chapter.page('waiting', 'result', local, 18.5)
    chapter.status = { label: local < 18.5 ? '核对页面依据' : '已提交，待医院确认', working: local < 18.5 }
  }
}

function buildReading(chapter) {
  const table = attach(chapter.group, new THREE.Group())
  attach(table, solid(5.12, 3.24, 0.045, 0xc9d6c8, 0.08), [0, 0, -0.06])
  const days = ['时间', '周三', '周四', '周五', '周六']
  const columns = days.map((day, index) => {
    const column = drawing(0.98, 3.1, (context, width, height) => {
      context.fillStyle = index === 2 ? '#dfece1' : '#f1f3e9'
      context.fillRect(0, 0, width, height)
      write(context, day, width / 2, 0.30, 0.17, '#31574e', 'center')
      const doctor = ['时间', '李医生', '陈医生', '王医生', '暂无号源'][index]
      const labels = index ? [doctor, doctor, doctor, '排班示例'] : ['09:00', '10:00', '11:00', '时间']
      labels.forEach((label, row) => {
        context.strokeStyle = '#c5d4c7'
        context.lineWidth = 0.003
        context.beginPath()
        context.moveTo(0.04, 0.62 + row * 0.59)
        context.lineTo(width - 0.04, 0.62 + row * 0.59)
        context.stroke()
        write(context, label, width / 2, 0.92 + row * 0.59, row === 3 ? 0.09 : 0.13, '#496453', 'center')
      })
    })
    column.material.depthWrite = true
    column.renderOrder = 2
    return attach(table, column, [(index - 2) * 1.01, 0, 0.04])
  })
  const ruler = attach(table, frame(1.04, 3.20, COLOR.mint), [0, 0, 0.12])
  const bar = attach(table, solid(0.96, 0.035, 0.025, COLOR.mint), [0, 0.60, 0.15])
  const oldPosition = attach(table, frame(1.04, 0.49, COLOR.red), [0, 1.23, 0.18])
  const header = chapter.text('按表头读，不按位置记', [0, 2.10, 0.5], 0.30)
  const loading = chapter.text('load_skill("reading_tables")', [0, -1.97, 0.6], 0.15, COLOR.mint)
  const changed = chapter.text('布局改变，重新对齐表头', [0, 2.10, 0.5], 0.24, COLOR.amber)
  const record = attach(chapter.group, bookmark('周四 · 10:00 · 陈医生', '表头 + 行 + 内容', 2.8), [0, -0.95, 1.1])
  chapter.camera([
    [3.4, [-2.4, 1.6, 7.8], [0, 0.0, -0.2], 44, -4],
    [6.4, [0.8, 0.45, 6.6], [0, 0.1, 0], 43],
    [9.4, [2.4, 1.1, 7.5], [0.4, 0.1, 0], 43, 3],
    [13.5, [-0.8, 0.4, 7.7], [0.2, 0.15, 0], 41, -2],
    [16.4, [0, 0.25, 6.6], [0, 0, 0], 38],
  ])
  chapter.animate = (local) => {
    const stage = windowAt(local, 2.0, 16.8, 1, 1)
    const reflow = smooth01(local, 9.5, 1.8)
    const returnPage = smooth01(local, 15.9, 1.5)
    table.scale.setScalar(1 - returnPage * 0.70)
    table.rotation.y = -0.06 + Math.sin(local * 0.10) * 0.08
    chapter.show(table, stage)
    const order = [0, 3, 1, 4, 2]
    columns.forEach((column, index) => {
      column.position.x = ((index - 2) * (1 - reflow) + (order[index] - 2) * reflow) * 1.01
      column.position.z = 0.04 + Math.sin(reflow * Math.PI) * (index % 2 ? 0.20 : 0)
    })
    ruler.position.x = columns[2].position.x
    ruler.position.z = 0.15 + Math.sin(reflow * Math.PI) * 0.20
    bar.position.x = ruler.position.x
    const firstRead = 0.60 - smooth01(local, 6.0, 2.6) * 0.59
    const returnHeader = smooth01(local, 11.3, 0.7)
    const readAgain = 1.22 - smooth01(local, 12.0, 2.3) * 1.21
    bar.position.y = firstRead * (1 - returnHeader) + readAgain * returnHeader
    chapter.show(ruler, windowAt(local, 5.6, 16.4) * stage)
    chapter.show(bar, windowAt(local, 6.0, 15.7) * stage)
    chapter.show(oldPosition, windowAt(local, 9.8, 12.0) * stage)
    chapter.show(header, windowAt(local, 3.0, 9.3))
    chapter.show(loading, windowAt(local, 3.4, 6.6))
    chapter.show(changed, windowAt(local, 9.8, 12.3))
    chapter.show(record, windowAt(local, 13.6, 16.7))
    chapter.pose(local, [0, 0, -1], 2.1)
    chapter.dimPhone(1 - stage * (1 - smooth01(local, 16.0, 1.1)))
    chapter.page('result')
    chapter.status = { label: '回看：排班读取方法', working: false }
  }
}

function buildExperience(chapter) {
  const pages = [
    ['T0 / 契约', ['适用应用与任务', '页面前提 / 禁用项', '参数、策略与脱敏']],
    ['T1 / 双轨回放', ['目标任务：核对命中', '非目标：核对暴露', '提炼来源不充当验证']],
    ['T2 / 实机回归', ['独立运行 / 真实结果', '新任务收益 + 旧任务', '当前：待实机验证']],
  ]
  const root = attach(chapter.group, new THREE.Group())
  const leaves = pages.map(([heading, lines], index) => {
    const pivot = attach(root, new THREE.Group())
    const sheet = printedPage(heading, lines, 2.25, 3.12, index === 2 ? '#ae8656' : '#397966')
    attach(pivot, sheet, [1.125, 0, 0])
    attach(pivot, solid(0.028, 3.14, 0.05, index === 2 ? COLOR.amber : COLOR.mint))
    return pivot
  })
  const candidate = attach(chapter.group, bookmark('reading_tables · 候选 v2', '候选保留 / 等待独立验证', 2.85), [0, -0.50, 1.2])
  const adopted = attach(chapter.group, bookmark('当前采用 v1', '验证状态与版本绑定', 1.85, COLOR.mint), [-2.5, -0.65, 0.7])
  const title = chapter.text('一次做法，怎样成为可靠经验？', [0, 2.15, 0.6], 0.27)
  const pending = chapter.text('方法可以积累，采用要经过验证', [0, 2.15, 0.6], 0.25, COLOR.amber)
  chapter.camera([
    [3.3, [-2.7, 1.4, 7.5], [0, 0.15, 0], 43, -4],
    [6.7, [3.4, 1.8, 6.9], [0.25, 0, 0], 45, 3],
    [10.6, [-1.0, 0.7, 7.5], [0.2, 0.0, 0], 42],
    [14.4, [1.5, 0.6, 7.2], [0, 0, 0], 41, -2],
    [16.7, [0, 0.2, 6.2], [0, 0, 0], 37],
  ])
  chapter.animate = (local) => {
    const stage = windowAt(local, 1.7, 16.8, 1, 1)
    const open = smooth01(local, 3.0, 2.0)
    const close = smooth01(local, 14.9, 1.8)
    let horizontal = -2.8 + close * 1.75
    let depth = -0.2
    leaves.forEach((leaf, index) => {
      const angle = (index % 2 ? -1 : 1) * (1.50 - open * 1.03 + close * 1.03)
      leaf.position.set(horizontal, 0, depth)
      leaf.rotation.y = angle
      horizontal += Math.cos(angle) * 2.25
      depth -= Math.sin(angle) * 2.25
      chapter.show(leaf, stage)
    })
    root.rotation.y = -0.15
    root.scale.setScalar(1 - close * 0.45)
    chapter.show(title, windowAt(local, 2.4, 6.4))
    chapter.show(pending, windowAt(local, 13.7, 16.7))
    chapter.show(candidate, windowAt(local, 12.0, 16.5))
    chapter.show(adopted, windowAt(local, 10.9, 16.5))
    chapter.pose(local, [0, 0, -1.1], 2.1)
    chapter.dimPhone(1 - stage * (1 - smooth01(local, 16.0, 1.1)))
    chapter.page('result')
    chapter.status = { label: '经验候选，等待验证', working: false }
  }
}
