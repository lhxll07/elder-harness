import * as THREE from 'three'
import { Chapter } from '../chapter.js'
import { C } from '../palette.js'
import { smooth01, hash11 } from '../ease.js'
import { makePhone, makeGlow, roundedPlaneGeometry } from '../props.js'
import { phonePose } from '../phone.js'
import { PhoneView } from '../phoneview.js'
import { textPlane } from '../text.js'
import { VoiceChain } from './voice-chain.js'
import { voiceStoryTime, pauseClock } from '../voice-timing.js'
import { homeScreen, fillRR, rr, text as screenText, SCREEN_W, SCREEN_H } from '../screen.js'
import { UI, pageCanvas, uiCard, uiBadge, uiIcon } from './page-design.js'

const CUT_AT = 22.6
const PAGE_AT = 14.8
const FLOW_POINTS = 96
const BRAND = '#1a7f6b'
const hospitalPages = new Map()

function uiText(context, content, x, y, size, color = '#233a46', align = 'left', weight = 400) {
  screenText(context, content, x, y, {
    font: `${weight} ${size}px "Noto Sans CJK SC", sans-serif`, color, align,
  })
}

export function hospitalPage(departments = false) {
  if (hospitalPages.has(departments)) return hospitalPages.get(departments)
  const { canvas, context } = pageCanvas()
  context.fillStyle = UI.background
  context.fillRect(0, 0, SCREEN_W, SCREEN_H)
  uiText(context, '9:41', 84, 78, 44)
  for (let index = 0; index < 4; index++) {
    fillRR(context, 861 + index * 19, 92 - index * 10, 10, 12 + index * 10, 2, '#415660')
  }
  fillRR(context, 967, 65, 57, 30, 6, '#819098')
  fillRR(context, 971, 69, 43, 22, 3, '#415660')
  fillRR(context, 0, 368, SCREEN_W, 172, 0, UI.paper)
  fillRR(context, 0, 538, SCREEN_W, 2, 0, UI.line)
  uiText(context, '‹', 78, 452, 86)
  uiText(context, departments ? '预约挂号' : '医院服务', SCREEN_W / 2, 452, 62, '#233a46', 'center', 500)
  uiText(context, '···', 983, 443, 62, '#526d79', 'center')

  if (departments) {
    uiText(context, '选择复诊科室', 70, 655, 70, UI.ink, 'left', 600)
    uiText(context, '科室分类', 72, 727, 34, UI.muted)
    uiBadge(context, '复诊预约', 792, 624, 224, { size: 32 })
    uiCard(context, 60, 782, 285, 1238, { fill: '#e9eff3', shadow: false })
    const categories = ['内科', '外科', '其他门诊']
    categories.forEach((category, index) => {
      const top = 817 + index * 188
      if (index === 0) {
        fillRR(context, 77, top, 250, 142, 28, '#d8ebe5')
        fillRR(context, 77, top + 37, 6, 68, 3, UI.green)
      }
      uiText(context, category, 202, top + 71, 52, index === 0 ? UI.green : UI.muted, 'center', index === 0 ? 600 : 400)
    })
    const departmentsList = ['普通内科', '心血管内科', '内分泌科', '呼吸内科']
    departmentsList.forEach((department, index) => {
      const top = 782 + index * 275
      uiCard(context, 379, top, 638, 246)
      uiText(context, department, 423, top + 86, 56, UI.ink, 'left', 500)
      uiText(context, '门诊排班 · 待查看', 423, top + 166, 40, '#627783')
      uiText(context, '›', 955, top + 117, 62, '#688390', 'center')
    })
  } else {
    const hero = context.createLinearGradient(60, 603, 1020, 903)
    hero.addColorStop(0, '#e2f1ec')
    hero.addColorStop(1, '#d4e5ea')
    uiCard(context, 60, 603, 960, 300, { fill: hero, border: '#cadfd4', radius: 36 })
    uiText(context, '安心就医', 110, 692, 74, '#285f59', 'left', 600)
    uiText(context, '预约复诊，更方便', 110, 791, 45, '#496b7b')
    uiCard(context, 748, 638, 204, 220, { fill: '#eaf4ee', border: '#d7e8dd', radius: 48, shadow: false })
    uiIcon(context, 'hospital', 772, 662, 156, '#5b9387')
    const services = ['预约挂号', '报告查询', '门诊缴费', '就诊记录']
    services.forEach((service, index) => {
      const left = 60 + index % 2 * 495
      const top = 968 + Math.floor(index / 2) * 320
      const iconColors = ['#347d67', '#537d9b', '#a27f50', '#737c9d']
      const iconFills = ['#e0eee4', '#e6eef5', '#f2ebdf', '#ecedf4']
      uiCard(context, left, top, 465, 280)
      fillRR(context, left + 43, top + 36, 92, 92, 25, iconFills[index])
      uiIcon(context, ['calendar', 'report', 'wallet', 'record'][index], left + 58, top + 51, 62, iconColors[index])
      uiText(context, '›', left + 406, top + 84, 48, '#9cafa8', 'center')
      uiText(context, service, left + 43, top + 194, 60, UI.ink, 'left', 500)
    })
    uiCard(context, 60, 1647, 960, 373)
    uiText(context, '复诊指南', 108, 1734, 62, UI.ink, 'left', 500)
    uiBadge(context, '就诊提示', 765, 1697, 198, { size: 29, fill: '#edf2ee', color: UI.muted })
    uiText(context, '先选科室，再核对日期', 108, 1828, 48, '#5c7380')
    uiText(context, '预约信息以医院页面为准', 108, 1923, 41, '#70818a')
  }

  uiText(context, '挂号流程示意 · 医院和时间待确认', SCREEN_W / 2, 2116, 32, '#788891', 'center')
  fillRR(context, 0, 2220, SCREEN_W, 182, 0, UI.paper)
  fillRR(context, 0, 2220, SCREEN_W, 2, 0, UI.line)
  const navigation = ['首页', '就诊', '我的']
  navigation.forEach((label, index) => {
    uiIcon(context, ['home', 'calendar', 'person'][index], 156 + index * 360, 2240, 48, index === 0 ? UI.green : '#839992')
    uiText(context, label, 180 + index * 360, 2325, 37, index === 0 ? UI.green : UI.muted, 'center')
  })
  fillRR(context, 400, 2370, 280, 9, 4, '#73838d')
  hospitalPages.set(departments, canvas)
  return canvas
}

function floatingStatus(local) {
  if (local < 15.35) return { label: '银龄', working: false }
  if (local < 21.4) return { label: '正在办', working: true }
  if (local < CUT_AT) return { label: '正在说…', working: false }
  if (local < 24.0) return { label: '正在听…', working: false }
  if (local < 25.8) return { label: '正在说…', working: false }
  return { label: '停下了', working: false }
}

export function floatingPill(context, local, opacity, status = floatingStatus(local)) {
  const { label, working } = status
  const height = 164
  const top = 152
  context.save()
  context.globalAlpha = opacity
  context.font = '400 70px "Noto Sans CJK SC", sans-serif'
  const width = Math.max(318, context.measureText(label).width + 86)
  const left = (SCREEN_W - width) / 2
  context.shadowColor = 'rgba(22,63,56,0.2)'
  context.shadowBlur = 22
  context.shadowOffsetY = 8
  fillRR(context, left, top, width, height, height / 2, BRAND)
  context.shadowBlur = 0
  context.shadowOffsetY = 0
  rr(context, left, top, width, height, height / 2)
  context.lineWidth = 3
  context.strokeStyle = 'rgba(235,244,241,0.9)'
  context.stroke()
  const textOpacity = working ? 0.725 + Math.cos((local - 10.2) * Math.PI / 0.9) * 0.275 : 1
  screenText(context, label, SCREEN_W / 2, top + height / 2, {
    font: '400 70px "Noto Sans CJK SC", sans-serif', color: '#ffffff', alpha: opacity * textOpacity,
  })
  context.restore()
}

function envelope(local, start, end, fadeIn = 0.6, fadeOut = 0.7) {
  return smooth01(local, start, fadeIn) * (1 - smooth01(local, end, fadeOut))
}

function dialogue({ speaker, lines, footer, accent }) {
  const canvas = document.createElement('canvas')
  canvas.width = 800
  canvas.height = 600
  const context = canvas.getContext('2d')
  context.beginPath()
  context.roundRect(4, 4, 792, 592, 48)
  context.fillStyle = '#182830'
  context.fill()
  context.lineWidth = 5
  context.strokeStyle = accent
  context.stroke()
  context.fillStyle = accent
  context.font = '500 42px "Noto Sans CJK SC", sans-serif'
  context.textAlign = 'left'
  context.fillText(speaker, 64, 91)
  context.fillStyle = '#cdd9de'
  context.font = '500 86px "Noto Sans CJK SC", sans-serif'
  const top = lines.length === 1 ? 322 : 263
  lines.forEach((content, index) => context.fillText(content, 64, top + index * 112))
  context.fillStyle = '#a0b3bf'
  context.font = '400 39px "Noto Sans CJK SC", sans-serif'
  context.fillText(footer, 64, 528)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  const mesh = new THREE.Mesh(
    roundedPlaneGeometry(1.60, 1.20, 0.095, 20),
    new THREE.MeshBasicMaterial({
      map: texture, transparent: true, opacity: 0, depthWrite: false, toneMapped: false,
    }),
  )
  mesh.userData.setOpacity = (opacity) => {
    mesh.material.opacity = opacity
    mesh.visible = opacity > 0.001
  }
  return mesh
}

export function build({ stage, chapter }) {
  return new Voice({ stage, chapter })
}

class Voice extends Chapter {
  constructor(context) {
    super(context)
    this.phone = makePhone()
    this.phone.name = 'phone'
    this.group.add(this.phone)
    this.view = new PhoneView(this.stage, this.phone)
    this.hospitalPages = [hospitalPage()]
    this.chain = new VoiceChain(this.group, this.chapter.start)
    this.cameraRig = this.chain.cameraRig
    this.aperture = 0.00055
    this.maxBlur = 0.0028
    this.phoneMaterials = []
    const materials = new Set()
    this.phone.traverse((object) => {
      const candidates = Array.isArray(object.material) ? object.material : [object.material]
      for (const material of candidates) {
        if (!material || materials.has(material)) continue
        materials.add(material)
        material.transparent = true
        this.phoneMaterials.push({ material, opacity: material.opacity })
      }
    })

    this.cards = {
      request: dialogue({
        speaker: '您说', lines: ['帮我预约', '一次复诊'],
        footer: '只说想办什么', accent: '#c69a60',
      }),
      intent: dialogue({
        speaker: '听懂您的需求', lines: ['预约复诊'],
        footer: '医院和时间，待您确认', accent: '#7cbaa7',
      }),
      working: dialogue({
        speaker: '接线员告诉您', lines: ['正在查找', '预约入口'],
        footer: '每一步，都会说给您听', accent: '#7cbaa7',
      }),
      stop: dialogue({
        speaker: '您随时可以说', lines: ['等等，', '先别办'],
        footer: '不必找到暂停按钮', accent: '#d2a069',
      }),
      acknowledgement: dialogue({
        speaker: '接线员回应', lines: ['好，', '先不操作'],
        footer: '已暂停，等您决定', accent: '#9abdb2',
      }),
    }
    for (const [name, card] of Object.entries(this.cards)) {
      card.name = name
      card.position.set(name === 'request' || name === 'stop' ? -1.34 : 1.34, 0.12, 0.14)
      this.group.add(card)
    }

    this._buildLeadIn()
    this.overlayTitle = textPlane('悬浮在顶部，不占满屏幕', {
      size: 76, font: '500 1px "Noto Sans CJK SC", sans-serif',
      color: 0xd1dde1, worldHeight: 0.22, supersample: 1,
    })
    this.overlayTitle.position.set(-0.95, 1.32, 0.10)
    this.group.add(this.overlayTitle)
    this.closing = textPlane('接下来，它怎样看懂眼前这一页？', {
      size: 76, font: '500 1px "Noto Sans CJK SC", sans-serif',
      color: 0xd1dde1, worldHeight: 0.22, supersample: 1,
    })
    this.closing.position.set(0, 1.07, 0.10)
    this.group.add(this.closing)

    this.pool = makeGlow({ color: C.attention, size: 2.6, opacity: 0 })
    this.pool.position.set(0, -0.05, -0.8)
    this.group.add(this.pool)
    this.input = this._buildFlow(C.attention, [
      [-1.30, 0.54, 0.18], [-0.85, 1.04, 0.20], [-0.10, 0.98, 0.20], [0, 0.08, 0.18],
    ])
    this.interruption = this._buildFlow(C.attention, [
      [-1.30, 0.54, 0.18], [-0.85, 0.99, 0.20], [-0.28, 0.91, 0.20], [0, 0.65, 0.18],
    ])
    this.output = this._buildFlow(C.brand, [
      [0, 0.65, 0.18], [0.28, 0.91, 0.20], [0.83, 0.99, 0.20], [1.30, 0.54, 0.18],
    ])
  }

  _buildFlow(color, coordinates) {
    const curve = new THREE.CubicBezierCurve3(...coordinates.map((point) => new THREE.Vector3(...point)))
    const line = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 72, 0.0028, 6, false),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
    )
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(FLOW_POINTS * 3), 3))
    const points = new THREE.Points(geometry, new THREE.PointsMaterial({
      color, size: 0.018, transparent: true, opacity: 0, depthWrite: true,
      toneMapped: false, blending: THREE.AdditiveBlending,
    }))
    points.frustumCulled = false
    this.group.add(line, points)
    return { curve, line, points, scratch: new THREE.Vector3() }
  }

  _buildLeadIn() {
    this.leadIn = new THREE.Group()
    this.leadIn.position.set(-0.75, 0, 0.20)
    this.group.add(this.leadIn)
    this.leadInTexts = [
      { content: '银龄智办', height: 0.15, y: 1.05, color: 0xd6dfe3 },
      { content: '把复杂留给系统', height: 0.15, y: 0.79, color: 0x9abdb2 },
      { content: ['只说一句话，', '手机怎样替您办事？'], height: 0.61, y: 0.33, color: 0xd1dde1 },
      { content: '以「预约复诊」为例，走进协作架构', height: 0.16, y: -0.18, color: 0xa0b3bf },
    ].map(({ content, height, y, color }) => {
      const mesh = textPlane(content, {
        size: 76, font: '500 1px "Noto Sans CJK SC", sans-serif',
        color, worldHeight: height, supersample: 1,
      })
      mesh.position.y = y
      this.leadIn.add(mesh)
      return mesh
    })
    this.leadInSteps = ['语音识别', '模型决策', '本机执行', '结果回传'].map((content, index) => {
      const tile = new THREE.Mesh(
        roundedPlaneGeometry(0.78, 0.28, 0.05, 16),
        new THREE.MeshBasicMaterial({ color: 0x26434b, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
      )
      tile.position.set(-1.38 + index * 0.92, -0.55, 0)
      const label = textPlane(content, {
        size: 64, color: index === 0 ? 0xd3aa74 : index === 3 ? 0x89b2c7 : 0x8abdab,
        worldHeight: 0.13, supersample: 1,
      })
      label.position.z = 0.01
      tile.add(label)
      const arrow = index < 3 ? textPlane('→', { size: 64, color: 0x6f929f, worldHeight: 0.12, supersample: 1 }) : null
      if (arrow) {
        arrow.position.set(tile.position.x + 0.46, -0.55, 0)
        this.leadIn.add(arrow)
      }
      this.leadIn.add(tile)
      return { tile, label, arrow }
    })
  }

  _updateFlow(flow, local, opacity, clock = local) {
    const positions = flow.points.geometry.attributes.position
    for (let index = 0; index < FLOW_POINTS; index++) {
      const progress = (hash11(index, 1) + clock * (0.22 + hash11(index, 2) * 0.09)) % 1
      flow.curve.getPoint(progress, flow.scratch)
      const spread = Math.sin(progress * Math.PI) * 0.025
      flow.scratch.y += Math.sin(index * 2.4 + clock * 2) * spread
      flow.scratch.z += Math.cos(index * 1.9 + clock) * spread
      positions.setXYZ(index, flow.scratch.x, flow.scratch.y, flow.scratch.z)
    }
    positions.needsUpdate = true
    flow.points.geometry.computeBoundingSphere()
    flow.points.material.opacity = opacity * 0.85
    flow.line.material.opacity = opacity * 0.28
    flow.points.visible = flow.line.visible = opacity > 0.002
  }

  update(playback, absolute, opacity) {
    const local = voiceStoryTime(playback)
    const pose = phonePose(this.chapter.start + local)
    const entrance = smooth01(playback, 0.15, 0.65)
    const leadIn = envelope(playback, 0, 2.55, 0.85, 0.65)
    const technical = envelope(local, 3.7, 17.25, 0.4, 0.85)
    const executing = envelope(local, 14.4, 16.2, 0.3, 0.3)
    const displaced = envelope(local, 13.7, 17.25, 0.6, 0.8)
    const overview = envelope(local, 17.25, 21.1, 0.55, 0.6)
    this.phone.position.set(1.55 * leadIn - 0.65 * displaced - envelope(local, 21.1, 22.65, 0.6, 0.6) * 0.92, pose.y - overview * 0.45, pose.z + overview * 0.2)
    this.phone.rotation.set(pose.rotX, pose.rotY, 0)
    this.phone.scale.setScalar(pose.scale * (1 + entrance * 0.1) * (1 - overview * 0.08))
    this.phone.visible = entrance > 0.001
    for (const { material, opacity: originalOpacity } of this.phoneMaterials) {
      material.opacity = originalOpacity * entrance * (1 - technical * 0.78 * (1 - executing))
    }

    const appearances = {
      request: envelope(local, 0.9, 3.4, 0.5, 0.35),
      intent: 0,
      working: 0,
      stop: envelope(local, CUT_AT - 0.1, 24.5, 0.65, 0.6),
      acknowledgement: envelope(local, 24.0, 26.0, 0.6, 0.6),
    }
    for (const [name, appearance] of Object.entries(appearances)) {
      const card = this.cards[name]
      card.userData.setOpacity(appearance * opacity)
      card.position.y = 0.12 - (1 - appearance) * 0.045
    }
    const leadInOpacity = envelope(playback, 0.25, 2.55, 0.55, 0.65) * opacity
    this.leadIn.visible = leadInOpacity > 0.001
    for (const mesh of this.leadInTexts) mesh.userData.setOpacity(leadInOpacity)
    this.leadInSteps.forEach(({ tile, label, arrow }, index) => {
      const appearance = smooth01(playback, 0.65 + index * 0.17, 0.4) * leadInOpacity
      tile.material.opacity = appearance * 0.85
      label.userData.setOpacity(appearance)
      arrow?.userData.setOpacity(appearance * 0.7)
    })
    this.overlayTitle.userData.setOpacity(envelope(local, 21.7, 22.55, 0.35, 0.15) * opacity)
    this.closing.userData.setOpacity(smooth01(local, 26.15, 0.5) * opacity)

    const listening = envelope(local, 0.9, 3.4, 0.3, 0.3)
    const interrupting = envelope(local, CUT_AT, 24.0, 0.10, 0.25)
    const speaking = envelope(local, 21.7, CUT_AT, 0.35, 0.15)
    const reply = envelope(local, 24.0, 25.8, 0.3, 0.25)
    this._updateFlow(this.input, local, listening * opacity)
    this._updateFlow(this.interruption, local, interrupting * opacity)
    this._updateFlow(this.output, local, Math.max(speaking, reply) * opacity, local < 24.0 ? pauseClock(local, CUT_AT) : local)
    this.pool.material.opacity = (listening * 0.14 + interrupting * 0.21) * opacity
    this.pool.scale.setScalar(1 + Math.sin(absolute * 1.2) * 0.025)
    this.chain.update(local, opacity)
    this._drawScreen(local)
    super.update(playback, absolute, opacity)
  }

  _drawScreen(local) {
    const context = this.view.g
    const listening = local >= 0.9 && local < 3.5
    homeScreen(context, { listening })
    const pageTime = Math.min(local, CUT_AT)
    const appReveal = smooth01(pageTime, PAGE_AT, 0.75)
    if (appReveal > 0) {
      context.save()
      context.globalAlpha = appReveal
      context.drawImage(this.hospitalPages[0], 0, 0, SCREEN_W, SCREEN_H)
      context.restore()
      floatingPill(context, local, appReveal)
    }
    this.view.commitNow()
  }

  afterCamera(camera) {
    this.chain.afterCamera(camera)
    this.leadIn.quaternion.copy(camera.quaternion)
  }
}
