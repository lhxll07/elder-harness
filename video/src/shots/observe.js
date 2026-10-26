import * as THREE from 'three'
import { Chapter } from '../chapter.js'
import { CameraRig } from '../stage.js'
import { smooth01, hash11 } from '../ease.js'
import { makePhone, makeGlow, roundedPlaneGeometry, PHONE, PHONE_Z } from '../props.js'
import { PhoneView } from '../phoneview.js'
import { textPlane } from '../text.js'
import { hospitalPage, floatingPill } from './voice.js'
import { SCREEN_W, SCREEN_H, fillRR } from '../screen.js'

const MINT = 0x8abdab
const AMBER = 0xd3aa74
const FONT = '"Noto Sans CJK SC", sans-serif'
const ENTRY = { x: 60, y: 968, width: 465, height: 280 }
const OPEN_AT = 17.7

function envelope(local, start, end, fadeIn = 0.4, fadeOut = 0.5) {
  return smooth01(local, start, fadeIn) * (1 - smooth01(local, end, fadeOut))
}

function plane(canvas, width, height, solid = false) {
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  const mesh = new THREE.Mesh(
    roundedPlaneGeometry(width, height, 0.065, 20),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
  )
  mesh.userData.setOpacity = (opacity) => {
    mesh.material.opacity = opacity
    mesh.material.depthWrite = solid && opacity > 0.9
    mesh.visible = opacity > 0.001
  }
  return mesh
}

function card({ kicker, title, footer, width = 1.6, height = 0.95, accent = '#8abdab' }) {
  const canvas = document.createElement('canvas')
  canvas.width = 1000
  canvas.height = Math.round(1000 * height / width)
  const context = canvas.getContext('2d')
  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height)
  gradient.addColorStop(0, '#203b44')
  gradient.addColorStop(1, '#11252e')
  context.beginPath()
  context.roundRect(4, 4, canvas.width - 8, canvas.height - 8, 40)
  context.fillStyle = gradient
  context.fill()
  context.strokeStyle = accent
  context.lineWidth = 4
  context.stroke()
  context.textBaseline = 'middle'
  context.fillStyle = accent
  context.font = `500 40px ${FONT}`
  context.fillText(kicker, 58, 68)
  context.fillStyle = '#d3e0e4'
  context.font = `500 82px ${FONT}`
  context.fillText(title, 58, canvas.height * 0.5)
  context.fillStyle = '#9bb2bd'
  context.font = `400 36px ${FONT}`
  context.fillText(footer, 58, canvas.height - 64)
  return plane(canvas, width, height, true)
}

function label(content, height, color = 0xd1dde1) {
  return textPlane(content, { size: 76, font: `500 1px ${FONT}`, color, worldHeight: height, supersample: 1 })
}

function mechanism({ kicker, title, rows, footer, width = 2.3, accent = '#8abdab' }) {
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 660
  const context = canvas.getContext('2d')
  const gradient = context.createLinearGradient(0, 0, 1200, 660)
  gradient.addColorStop(0, '#29484f')
  gradient.addColorStop(1, '#12272f')
  context.beginPath()
  context.roundRect(4, 4, 1192, 652, 46)
  context.fillStyle = gradient
  context.fill()
  context.strokeStyle = accent
  context.lineWidth = 4
  context.stroke()
  context.textBaseline = 'middle'
  context.fillStyle = accent
  context.font = `500 40px ${FONT}`
  context.fillText(kicker, 70, 63)
  context.fillStyle = '#e0ebe8'
  context.font = `500 86px ${FONT}`
  context.fillText(title, 70, 162)
  rows.forEach((content, index) => {
    const top = 272 + index * 88
    fillRR(context, 70, top - 28, 66, 58, 13, 'rgba(138,189,171,0.16)')
    context.fillStyle = accent
    context.font = `500 34px ${FONT}`
    context.fillText(String(index + 1).padStart(2, '0'), 81, top)
    context.fillStyle = '#c5d8dc'
    context.font = `400 52px ${FONT}`
    context.fillText(content, 163, top)
  })
  context.fillStyle = '#9cb6bd'
  context.font = `400 35px ${FONT}`
  context.fillText(footer, 70, 596)
  return plane(canvas, width, width * 660 / 1200, true)
}

export { buildCinema as build } from './cinema-chapter.js'

export function buildLegacy(context) {
  return new Observe(context)
}

class Observe extends Chapter {
  constructor(context) {
    super(context)
    this.phone = makePhone()
    this.phone.name = 'phone'
    this.phone.scale.setScalar(1.1)
    this.group.add(this.phone)
    this.view = new PhoneView(this.stage, this.phone)
    this.pages = [hospitalPage(), hospitalPage(true)]
    this.materials = []
    const visited = new Set()
    this.phone.traverse((object) => {
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!material || visited.has(material)) continue
        visited.add(material)
        material.transparent = true
        this.materials.push({ material, opacity: material.opacity })
      }
    })
    this.resume = card({ kicker: '您说', title: '好，继续吧', footer: '确认继续，才恢复操作', width: 1.50, height: 0.94, accent: '#d3aa74' })
    this.resume.position.set(-1.38, 0.13, 0.2)
    this.group.add(this.resume)
    this.call = card({ kicker: '当前页面 · 定位到入口', title: '预约挂号 · e7', footer: '打开科室列表，不提交预约', width: 1.60, height: 0.72 })
    this.call.position.set(1.40, 0.25, 0.18)
    this.group.add(this.call)
    this.captions = [
      ['结构通道：知道是什么、能不能点', MINT, 3.2, 6.0],
      ['视觉通道：补上图标与画面信息', AMBER, 6.15, 10.2],
      ['同一页观察，两类线索互补', MINT, 10.3, 13.15],
      ['页面变了，执行前重新校验', MINT, 13.35, 16.25],
    ].map(([content, color, start, end]) => {
      const mesh = label(content, 0.19, color)
      mesh.position.set(0, 1.68, 0.12)
      this.group.add(mesh)
      return { mesh, start, end }
    })
    this.fusion = mechanism({
      kicker: '双通道观察 / 同一次页面', title: '结构定位，视觉补足',
      rows: ['控件可读 → 按编号操作', '图形内容 → 画面补足', '结合当前页 → 决定下一步'],
      footer: '按页面能力使用，不要求每页都截图',
    })
    this.fusion.position.set(0, 0.35, 0.94)
    this.group.add(this.fusion)
    this.binding = mechanism({
      kicker: '执行前 / 本机工具守卫', title: '绑定当前页面', width: 1.95,
      rows: ['目标 e7 · 可点击', '版本: hospital_01', '页面变化 → 重新校验'],
      footer: '不是把旧坐标一路重放',
    })
    this.binding.position.set(1.48, 0.25, 0.55)
    this.group.add(this.binding)
    this.next = label('入口已找到，继续核对复诊信息', 0.19)
    this.next.position.set(0, 1.07, 0.12)
    this.group.add(this.next)
    this.billboards = [this.resume, this.call, this.fusion, this.binding, this.next, ...this.captions.map(({ mesh }) => mesh)]
    this.quaternion = new THREE.Quaternion()
    this._buildControls()
    this._buildVision()
    this._buildTarget()
    this.links = [this._link(MINT), this._link(AMBER), this._link(MINT)]
    this.cameraRig = new CameraRig()
    const at = (local, position, target, options = {}) => this.cameraRig.at(this.chapter.start + local, position, target, options)
    at(0, [0, 0.10, 4.45], [0, 0, 0], { fov: 34 })
    at(1.8, [0, 0.10, 4.45], [0, 0, 0], { fov: 34 })
    at(3.8, [-0.65, 0.58, 5.35], [-0.35, 0.24, 0.48], { fov: 39, roll: -2 })
    at(5.1, [-0.7, 0.80, 5.65], [-0.35, 0.28, 0.50], { fov: 40, roll: -2 })
    at(7.2, [1.15, 1.0, 6.25], [0.4, 0.38, 0.60], { fov: 40, roll: 2 })
    at(8.5, [0.9, 0.9, 6.25], [0.35, 0.38, 0.60], { fov: 40, roll: 1 })
    at(10.4, [-0.9, 1.35, 6.65], [0, 0.40, 0.60], { fov: 41, roll: -2 })
    at(11.5, [0, 0.65, 6.3], [0, 0.35, 0.65], { fov: 40 })
    at(12.8, [0.4, 0.65, 6.1], [0, 0.35, 0.65], { fov: 40, roll: 1 })
    at(14.2, [0.7, 0.80, 5.4], [0.38, 0.28, 0.55], { fov: 39, roll: -1 })
    at(15.5, [0.35, 0.48, 5.1], [0.3, 0.22, 0.45], { fov: 38 })
    at(17.1, [0.12, 0.12, 4.5], [0, 0, 0], { fov: 34 })
    at(18.8, [0, 0.10, 4.45], [0, 0, 0], { fov: 34 })
    at(20, [0, 0.10, 4.45], [0, 0, 0], { fov: 34 })
    this.aperture = 0.00045
    this.maxBlur = 0.0025
  }

  _buildControls() {
    this.controls = new THREE.Group()
    this.group.add(this.controls)
    this.billboards.push(this.controls)
    this.controlsBacking = new THREE.Mesh(
      roundedPlaneGeometry(1.65, 2.24, 0.10, 20),
      new THREE.MeshBasicMaterial({ color: 0x142a33, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
    )
    this.controls.add(this.controlsBacking)
    this.controlsTitle = label('结构通道 / 控件树', 0.18, MINT)
    this.controlsTitle.position.set(0, 0.89, 0.02)
    this.controls.add(this.controlsTitle)
    this.controlsFooter = label(['文字 · 编号 · 操作能力', '可点击 e7 / 当前页面'], 0.21, 0x92adb9)
    this.controlsFooter.position.set(0, -0.87, 0.02)
    this.controls.add(this.controlsFooter)
    const entries = [
      ['医院服务', 0, false], ['便民服务', 1, false], ['e7   预约挂号', 2, true],
      ['e8   报告查询', 2, false], ['e9   门诊缴费', 2, false], ['e10  就诊记录', 2, false],
    ]
    this.nodes = entries.map(([content, depth, selected], index) => {
      const row = new THREE.Group()
      row.position.set(0, 0.57 - index * 0.218, 0.025)
      const bar = new THREE.Mesh(
        roundedPlaneGeometry(1.42, 0.19, 0.032, 12),
        new THREE.MeshBasicMaterial({ color: selected ? 0x325a57 : 0x213b45, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
      )
      row.add(bar)
      const text = label(content, 0.14, selected ? 0xb9ddd1 : 0xb9cbd4)
      text.position.set(-0.59 + depth * 0.08 + text.geometry.parameters.width / 2, 0, 0.01)
      row.add(text)
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.012, 16), new THREE.MeshBasicMaterial({ color: selected ? MINT : 0x7194a2, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }))
      dot.position.set(-0.65 + depth * 0.08, 0, 0.012)
      row.add(dot)
      this.controls.add(row)
      return { row, bar, text, dot, selected }
    })
    const points = [new THREE.Vector3(-0.49, 0.39, 0.035), new THREE.Vector3(-0.49, -0.55, 0.035)]
    this.trunk = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: MINT, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }))
    this.controls.add(this.trunk)
  }

  _buildVision() {
    this.vision = new THREE.Group()
    this.group.add(this.vision)
    this.billboards.push(this.vision)
    this.visionBacking = new THREE.Mesh(
      roundedPlaneGeometry(1.27, 2.65, 0.10, 20),
      new THREE.MeshBasicMaterial({ color: 0x203039, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
    )
    this.vision.add(this.visionBacking)
    this.visionTitle = label('视觉通道 / 画面辅助', 0.15, AMBER)
    this.visionTitle.position.set(0, 1.28, 0.05)
    this.vision.add(this.visionTitle)
    this.visionFooter = label('视觉已开启 · 本例已授权', 0.115, 0xd1bb96)
    this.visionFooter.position.set(0, 1.10, 0.05)
    this.vision.add(this.visionFooter)
    const screenshot = hospitalPage()
    floatingPill(screenshot.getContext('2d'), 6, 1, { label: '正在办', working: true })
    const texture = new THREE.CanvasTexture(screenshot)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 8
    this.tiles = []
    this.imageWidth = 0.96
    this.imageHeight = this.imageWidth * SCREEN_H / SCREEN_W
    for (let row = 0; row < 4; row++) {
      for (let column = 0; column < 3; column++) {
        const map = texture.clone()
        map.repeat.set(1 / 3, 1 / 4)
        map.offset.set(column / 3, 1 - (row + 1) / 4)
        map.needsUpdate = true
        const tile = new THREE.Mesh(
          new THREE.PlaneGeometry(this.imageWidth / 3, this.imageHeight / 4),
          new THREE.MeshBasicMaterial({ map, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
        )
        const x = (column - 1) * this.imageWidth / 3
        const y = (1.5 - row) * this.imageHeight / 4 - 0.02
        this.vision.add(tile)
        this.tiles.push({ tile, x, y, row, column })
      }
    }
    const overlay = document.createElement('canvas')
    overlay.width = SCREEN_W
    overlay.height = SCREEN_H
    const context = overlay.getContext('2d')
    for (let column = 1; column < 20; column++) {
      context.strokeStyle = column % 2 ? 'rgba(55,89,101,0.13)' : 'rgba(55,89,101,0.28)'
      context.lineWidth = column % 2 ? 1 : 2
      context.beginPath()
      context.moveTo(column * SCREEN_W / 20, 0)
      context.lineTo(column * SCREEN_W / 20, SCREEN_H)
      context.stroke()
    }
    for (let row = 1; row < 20; row++) {
      context.strokeStyle = row % 2 ? 'rgba(55,89,101,0.13)' : 'rgba(55,89,101,0.28)'
      context.lineWidth = row % 2 ? 1 : 2
      context.beginPath()
      context.moveTo(0, row * SCREEN_H / 20)
      context.lineTo(SCREEN_W, row * SCREEN_H / 20)
      context.stroke()
    }
    context.font = `500 30px ${FONT}`
    context.fillStyle = '#577480'
    for (let tick = 1; tick < 10; tick++) {
      context.fillText(`${tick * 10}%`, 13, tick * SCREEN_H / 10 - 9)
    }
    context.beginPath()
    context.roundRect(ENTRY.x - 10, ENTRY.y - 10, ENTRY.width + 20, ENTRY.height + 20, 36)
    context.fillStyle = 'rgba(211,170,116,0.12)'
    context.fill()
    context.strokeStyle = '#ba8443'
    context.lineWidth = 12
    context.stroke()
    this.visionOverlay = plane(overlay, this.imageWidth, this.imageHeight)
    this.visionOverlay.position.set(0, -0.02, 0.14)
    this.vision.add(this.visionOverlay)
  }

  _buildTarget() {
    const screenWidth = PHONE.w - PHONE.bezel * 2
    const screenHeight = PHONE.h - PHONE.bezel * 2
    this.target = new THREE.Group()
    this.target.position.set(
      ((ENTRY.x + ENTRY.width / 2) / SCREEN_W - 0.5) * screenWidth,
      (0.5 - (ENTRY.y + ENTRY.height / 2) / SCREEN_H) * screenHeight,
      PHONE_Z.glass + 0.005,
    )
    this.phone.add(this.target)
    const outline = document.createElement('canvas')
    outline.width = 600
    outline.height = 380
    const context = outline.getContext('2d')
    context.beginPath()
    context.roundRect(12, 12, 576, 356, 42)
    context.strokeStyle = '#78b69d'
    context.lineWidth = 12
    context.stroke()
    this.targetOutline = plane(outline, ENTRY.width / SCREEN_W * screenWidth + 0.018, ENTRY.height / SCREEN_H * screenHeight + 0.018)
    this.target.add(this.targetOutline)
    this.ripple = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.003, 8, 64), new THREE.MeshBasicMaterial({ color: MINT, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }))
    this.ripple.position.z = 0.007
    this.target.add(this.ripple)
    this.scan = new THREE.Mesh(new THREE.PlaneGeometry(screenWidth, 0.005), new THREE.MeshBasicMaterial({ color: MINT, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }))
    this.scan.position.z = PHONE_Z.glass + 0.004
    this.phone.add(this.scan)
  }

  _link(color) {
    const curve = new THREE.CubicBezierCurve3(...Array.from({ length: 4 }, () => new THREE.Vector3()))
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(97 * 3), 3))
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }))
    const particles = new THREE.BufferGeometry()
    particles.setAttribute('position', new THREE.BufferAttribute(new Float32Array(28 * 3), 3))
    const points = new THREE.Points(particles, new THREE.PointsMaterial({ color, size: 0.014, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }))
    points.frustumCulled = false
    const head = makeGlow({ color, size: 0.16, opacity: 0 })
    this.group.add(line, points, head)
    return { curve, line, points, head, scratch: new THREE.Vector3() }
  }

  update(local, absolute, opacity) {
    this.local = local
    this.opacity = opacity
    const unfold = smooth01(local, 2.6, 1.5)
    const fold = smooth01(local, 14.35, 2.15)
    const spread = unfold * (1 - fold)
    const fusion = envelope(local, 10.1, 12.85, 0.6, 0.6)
    const binding = envelope(local, 13.1, 16.15, 0.55, 0.45)
    this.phone.visible = true
    this.phone.rotation.set(spread * 0.015, -spread * 0.10, 0)
    for (const entry of this.materials) entry.material.opacity = entry.opacity * (1 - fusion * 0.52)
    this.resume.userData.setOpacity(envelope(local, 0.45, 2.45, 0.35, 0.4) * opacity)
    this.call.userData.setOpacity(envelope(local, 16.25, 17.8, 0.35, 0.35) * opacity)
    for (const { mesh, start, end } of this.captions) mesh.userData.setOpacity(envelope(local, start, end, 0.35, 0.25) * opacity)
    this.fusion.userData.setOpacity(fusion * opacity)
    this.fusion.scale.setScalar(0.9 + fusion * 0.1)
    this.binding.userData.setOpacity(binding * opacity)
    this.binding.position.x = 1.48 + (1 - binding) * 0.14
    this.next.userData.setOpacity(smooth01(local, 18.55, 0.4) * opacity)
    const controlsOpacity = envelope(local, 2.65, 12.55, 0.55, 0.75) * opacity
    this.controls.visible = controlsOpacity > 0.001
    this.controls.position.set((-1.46 - fusion * 0.40) * spread, 0.20 * spread, 0.08 + spread * 0.78)
    this.controls.scale.setScalar(0.48 + spread * 0.52)
    this.controlsBacking.material.opacity = controlsOpacity * 0.96
    this.controlsTitle.userData.setOpacity(controlsOpacity)
    this.controlsFooter.userData.setOpacity(controlsOpacity)
    this.trunk.material.opacity = controlsOpacity * 0.38
    this.nodes.forEach(({ row, bar, text, dot, selected }, index) => {
      const arrival = smooth01(local, 2.9 + index * 0.14, 0.45)
      const appearance = controlsOpacity * arrival
      row.position.z = 0.025 + (1 - arrival) * -0.15
      bar.material.opacity = appearance * (selected ? 0.95 : 0.7)
      text.userData.setOpacity(appearance)
      dot.material.opacity = appearance
    })
    const visionSpread = smooth01(local, 5.65, 1.4) * (1 - fold)
    const visionOpacity = envelope(local, 5.95, 12.4, 0.7, 0.75) * opacity
    this.vision.visible = visionOpacity > 0.001
    this.vision.position.set((1.48 + fusion * 0.40) * visionSpread, 0.20 * visionSpread, 0.08 + visionSpread * 0.75)
    this.vision.scale.setScalar(0.767 + visionSpread * 0.233)
    this.visionBacking.material.opacity = visionOpacity * 0.92
    this.visionTitle.userData.setOpacity(visionOpacity)
    this.visionFooter.userData.setOpacity(visionOpacity)
    this.tiles.forEach(({ tile, x, y, row, column }, index) => {
      const separation = Math.sin(smooth01(local, 5.95, 1.8) * Math.PI) * visionSpread
      tile.position.set(x + (column - 1) * separation * 0.035, y + (1.5 - row) * separation * 0.018, 0.03 + separation * (0.055 + hash11(index, 8) * 0.09))
      tile.material.opacity = visionOpacity * smooth01(local, 5.95 + row * 0.06, 0.45)
    })
    this.visionOverlay.userData.setOpacity(smooth01(local, 7.45, 0.55) * visionOpacity)
    this.targetOutline.userData.setOpacity(envelope(local, 13.35, OPEN_AT, 0.7, 0.25) * opacity)
    this.scan.position.y = (0.5 - smooth01(local, 2.65, 2.6)) * (PHONE.h - PHONE.bezel * 2)
    this.scan.material.opacity = envelope(local, 2.65, 5.05, 0.25, 0.4) * opacity * 0.7
    const tap = smooth01(local, 17.15, 0.5)
    this.ripple.scale.setScalar(0.45 + tap * 2.4)
    this.ripple.material.opacity = envelope(local, 17.15, 17.65, 0.12, 0.25) * opacity
    this._drawScreen(local)
    super.update(local, absolute, opacity)
  }

  _drawScreen(local) {
    const context = this.view.g
    context.drawImage(this.pages[0], 0, 0, SCREEN_W, SCREEN_H)
    const pageReveal = smooth01(local, OPEN_AT, 0.65)
    if (pageReveal > 0) {
      context.save()
      context.globalAlpha = pageReveal
      context.drawImage(this.pages[1], (1 - pageReveal) * SCREEN_W * 0.10, 0, SCREEN_W, SCREEN_H)
      context.restore()
    }
    const status = local < 0.75 ? { label: '停下了', working: false }
      : local < 2.0 ? { label: '正在听…', working: false }
      : { label: '正在办', working: true }
    floatingPill(context, local, 1, status)
    const selected = envelope(local, 13.65, OPEN_AT, 0.65, 0.25)
    if (selected > 0) {
      context.save()
      context.globalAlpha = selected * 0.12
      fillRR(context, ENTRY.x, ENTRY.y, ENTRY.width, ENTRY.height, 30, '#1a7f6b')
      context.restore()
    }
    this.view.commitNow()
  }

  afterCamera(camera) {
    camera.getWorldQuaternion(this.quaternion)
    for (const object of this.billboards) object.quaternion.copy(this.quaternion)
    this.phone.updateMatrixWorld(true)
    const target = this.target.getWorldPosition(new THREE.Vector3())
    const origins = [
      new THREE.Vector3(0.10, 0.13, 0.04).multiplyScalar(this.controls.scale.x).applyQuaternion(this.quaternion).add(this.controls.position),
      new THREE.Vector3(((ENTRY.x + ENTRY.width / 2) / SCREEN_W - 0.5) * this.imageWidth, (0.5 - (ENTRY.y + ENTRY.height / 2) / SCREEN_H) * this.imageHeight - 0.02, 0.14).multiplyScalar(this.vision.scale.x).applyQuaternion(this.quaternion).add(this.vision.position),
      this.binding.position.clone(),
    ]
    this.links.forEach((link, index) => {
      const incoming = index < 2
      const destination = incoming ? this.fusion.position : target
      const start = incoming ? 9.75 + index * 0.18 : 13.35
      const alpha = envelope(this.local, start, incoming ? 12.85 : 16.6, 0.4, 0.45) * this.opacity
      link.curve.v0.copy(origins[index])
      link.curve.v1.copy(origins[index]).add(new THREE.Vector3(index === 0 ? 0.35 : -0.35, 0.45, 0.30))
      link.curve.v2.copy(destination).add(new THREE.Vector3(index === 0 ? -0.45 : 0.45, 0.32, 0.35))
      link.curve.v3.copy(destination)
      const vertices = link.line.geometry.attributes.position
      for (let vertex = 0; vertex < 97; vertex++) {
        link.curve.getPoint(vertex / 96, link.scratch)
        vertices.setXYZ(vertex, link.scratch.x, link.scratch.y, link.scratch.z)
      }
      vertices.needsUpdate = true
      const progress = smooth01(this.local, start, incoming ? 1.75 : 1.4)
      link.line.geometry.setDrawRange(0, Math.max(2, Math.ceil(progress * 97)))
      link.line.material.opacity = alpha * 0.34
      const particles = link.points.geometry.attributes.position
      for (let particle = 0; particle < 28; particle++) {
        link.curve.getPoint(Math.max(0, progress - particle * 0.009), link.scratch)
        particles.setXYZ(particle, link.scratch.x, link.scratch.y, link.scratch.z)
      }
      particles.needsUpdate = true
      link.points.material.opacity = alpha * 0.9
      link.head.position.copy(link.curve.getPoint(progress, link.scratch))
      link.head.material.opacity = alpha * 0.5
    })
  }
}
