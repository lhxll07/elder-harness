import * as THREE from 'three'
import { CameraRig } from '../stage.js'
import { smooth01, hash11 } from '../ease.js'
import { roundedPlaneGeometry, makeGlow } from '../props.js'
import { textPlane } from '../text.js'
import { voicePlaybackTime, pauseClock } from '../voice-timing.js'

const CUT_AT = 22.6
const AMBER = 0xd3aa74
const MINT = 0x8abdab
const BLUE = 0x89b2c7
const FONT = '"Noto Sans CJK SC", sans-serif'

function envelope(local, start, end, fadeIn = 0.35, fadeOut = 0.4) {
  return smooth01(local, start, fadeIn) * (1 - smooth01(local, end, fadeOut))
}

function panel({ title, kicker, lines = [], footer, accent = '#8abdab', width = 2.8, height = 1.75 }) {
  const canvas = document.createElement('canvas')
  canvas.width = 1280
  canvas.height = Math.round(canvas.width * height / width)
  const context = canvas.getContext('2d')
  context.beginPath()
  context.roundRect(5, 5, canvas.width - 10, canvas.height - 10, 48)
  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height)
  gradient.addColorStop(0, '#1a343e')
  gradient.addColorStop(0.55, '#142a33')
  gradient.addColorStop(1, '#10212a')
  context.fillStyle = gradient
  context.fill()
  context.lineWidth = 5
  context.strokeStyle = accent
  context.stroke()
  context.save()
  context.globalAlpha = 0.065
  context.strokeStyle = '#a5c9d6'
  context.lineWidth = 1
  for (let offset = 52; offset < canvas.width - 40; offset += 64) {
    context.beginPath()
    context.moveTo(offset, 265)
    context.lineTo(offset, canvas.height - 110)
    context.stroke()
  }
  context.restore()
  context.beginPath()
  context.moveTo(72, 257)
  context.lineTo(canvas.width - 72, 257)
  context.strokeStyle = '#355564'
  context.lineWidth = 2
  context.stroke()
  for (let index = 0; index < 3; index++) {
    context.beginPath()
    context.arc(canvas.width - 88 - index * 32, 75, 6, 0, Math.PI * 2)
    context.fillStyle = index === 0 ? accent : '#42616f'
    context.fill()
  }
  context.textAlign = 'left'
  context.textBaseline = 'middle'
  context.fillStyle = accent
  context.font = `500 43px ${FONT}`
  context.fillText(kicker, 72, 76)
  context.fillStyle = '#d3e0e4'
  context.font = `500 85px ${FONT}`
  context.fillText(title, 72, 185)
  const first = lines.length === 1 ? canvas.height * 0.60 : canvas.height * 0.48
  lines.forEach((line, index) => {
    const content = typeof line === 'string' ? { text: line } : line
    context.fillStyle = content.color ?? '#cedce0'
    context.font = `400 ${content.size ?? 75}px ${content.mono ? '"Liberation Mono", monospace' : FONT}`
    context.fillText(content.text, 72, first + index * 108)
  })
  context.fillStyle = '#96abb5'
  context.font = `400 39px ${FONT}`
  context.fillText(footer, 72, canvas.height - 66)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  const mesh = new THREE.Mesh(
    roundedPlaneGeometry(width, height, 0.1, 20),
    new THREE.MeshBasicMaterial({
      map: texture, transparent: true, opacity: 0, depthWrite: false, toneMapped: false,
    }),
  )
  const backing = new THREE.Mesh(roundedPlaneGeometry(width + 0.004, height + 0.004, 0.105, 32), new THREE.MeshBasicMaterial({ color: 0x1a303b, transparent: true, depthWrite: false, toneMapped: false }))
  backing.material.opacity = 0
  backing.position.set(0, 0, -0.008)
  mesh.add(backing)
  mesh.userData.setOpacity = (opacity) => {
    mesh.material.opacity = opacity
    mesh.material.depthWrite = opacity > 0.8
    backing.material.opacity = opacity
    backing.material.depthWrite = false
    mesh.visible = opacity > 0.001
  }
  return mesh
}

function toolLibrary() {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 1180
  const context = canvas.getContext('2d')
  context.textBaseline = 'middle'
  context.fillStyle = '#a2c7b9'
  context.font = `500 59px ${FONT}`
  context.fillText('工具目录 · 按需选择', 38, 57)
  const entries = [
    ['open_app', '新应用先征得同意'],
    ['click', '按可见控件编号点按'],
    ['input_text', '填入文字，不直接提交'],
    ['scroll', '滚动当前页面'],
    ['ask_user', '信息不够，先问老人'],
  ]
  entries.forEach(([name, explanation], index) => {
    const top = 123 + index * 187
    context.beginPath()
    context.roundRect(8, top, 1008, 164, 25)
    context.fillStyle = index === 0 ? '#213c3d' : '#172b34'
    context.fill()
    context.strokeStyle = index === 0 ? '#8abdab' : '#3b5865'
    context.lineWidth = index === 0 ? 4 : 2
    context.stroke()
    context.fillStyle = index === 0 ? '#b1d5c5' : '#c0d3dd'
    context.font = '500 69px "Liberation Mono", monospace'
    context.fillText(name, 47, top + 53)
    context.fillStyle = '#93aab6'
    context.font = `400 40px ${FONT}`
    context.fillText(explanation, 47, top + 117)
  })
  context.fillStyle = '#9daeb7'
  context.font = `400 35px ${FONT}`
  context.fillText('截图：仅视觉开启且获授权时', 38, 1116)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2.1, 2.42),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
  )
  mesh.userData.setOpacity = (opacity) => {
    mesh.material.opacity = opacity
    mesh.visible = opacity > 0.001
  }
  return mesh
}

export class VoiceChain {
  constructor(parent, start) {
    this.group = new THREE.Group()
    this.group.name = 'voice-cloud-tool-loop'
    parent.add(this.group)
    this.panels = {}
    const add = (name, options, position) => {
      const mesh = panel(options)
      mesh.position.set(...position)
      mesh.name = name
      this.panels[name] = mesh
      this.group.add(mesh)
      return mesh
    }
    add('proxy', {
      title: '语音代理', kicker: '01 / 手机录音上传',
      lines: [{ text: 'POST /api/device/transcribe', size: 54, mono: true }],
      footer: 'PCM16 · 16 kHz · Mono', accent: '#d3aa74', width: 2.8, height: 1.2,
    }, [-1.20, 1.60, 0.20])
    add('asr', {
      title: '云端语音识别', kicker: '02 / 讯飞 IAT',
      lines: [{ text: '声波 → 文字', size: 90 }],
      footer: '语音代理转发 · WebSocket', accent: '#d3aa74',
    }, [-3.0, 1.15, -1.7])
    add('recognized', {
      title: '语音识别结果', kicker: 'ASR → text',
      lines: ['帮我预约', '一次复诊'], footer: '识别文字先返回手机', accent: '#d3aa74',
    }, [-3.0, 1.15, -1.67])
    add('local', {
      title: '本机编排', kicker: '03 / AgentLoop',
      lines: [{ text: '识别文字 + 当前页面', size: 65 }, { text: '工具目录 + 历史结果', size: 65 }],
      footer: 'AgentLoop / CloudPlanner · 本机', width: 2.6, height: 1.65,
    }, [0.1, 1.45, -0.90])
    add('model', {
      title: '大模型', kicker: '04 / CloudPlanner 发起请求',
      lines: ['理解目标', '选择下一步工具'], footer: 'POST /chat/completions',
    }, [3.1, 1.05, -1.9])
    add('call', {
      title: 'open_app', kicker: 'tool_calls[0] · id: call_01',
      lines: [{ text: '{ "argument":', size: 72, mono: true }, { text: '  "医院服务" }', size: 88 }],
      footer: '下一站：本机校验与执行', width: 2.8, height: 1.85,
    }, [4.3, 0.80, 0.55])
    add('gate', {
      title: '本机工具守卫', kicker: '05 / 校验后才执行',
      lines: [{ text: '参数 · 授权 · 页面状态', size: 71 }, { text: '本例：本人同意打开新应用', size: 61 }],
      footer: '工具与风险不同，检查也不同', width: 2.9, height: 1.70,
    }, [1.75, 0.35, 0.30])
    add('result', {
      title: '调用结果回传', kicker: '06 / 回到模型，形成闭环',
      lines: [{ text: 'role: "tool"', size: 81, mono: true }, { text: 'tool_call_id: call_01', size: 64, mono: true }],
      footer: '结果 + 新页面 → 下一轮判断', width: 2.9, height: 1.65,
    }, [1.80, 1.25, -0.25])
    add('next', {
      title: '下一步提议：click', kicker: '重新看页面，再选择工具',
      lines: [
        { text: '"target": "e7"', size: 64, mono: true },
        { text: '"expectedEffect":', size: 61, mono: true },
        { text: '"显示预约挂号页面"', size: 74 },
      ],
      footer: '下一轮决策 · 由当前页继续', width: 2.9, height: 1.65,
    }, [0.95, 0.35, 0.25])
    this.library = toolLibrary()
    this.library.position.set(1.65, 0.72, 0.55)
    this.group.add(this.library)
    this.billboards = [...Object.values(this.panels), this.library]
    this.recognition = {
      source: this.panels.asr.material.map.image,
      result: this.panels.recognized.material.map.image,
      canvas: document.createElement('canvas'), last: -1,
    }
    this.recognition.canvas.width = this.recognition.source.width
    this.recognition.canvas.height = this.recognition.source.height
    this.recognition.context = this.recognition.canvas.getContext('2d', { willReadFrequently: true })
    const recognitionTexture = new THREE.CanvasTexture(this.recognition.canvas)
    recognitionTexture.colorSpace = THREE.SRGBColorSpace
    recognitionTexture.anisotropy = 16
    this.panels.asr.material.map = recognitionTexture
    this.cameraQuaternion = new THREE.Quaternion()
    this.wave = []
    const barGeometry = new THREE.BoxGeometry(0.018, 1, 0.018)
    this.waveMaterial = new THREE.MeshBasicMaterial({ color: AMBER, transparent: true, opacity: 0, depthWrite: false, toneMapped: false })
    for (let index = 0; index < 64; index++) {
      const bar = new THREE.Mesh(barGeometry, this.waveMaterial)
      bar.position.set(-1.0 + index / 63 * 2.0, -0.46, 0.02)
      this.panels.asr.add(bar)
      this.wave.push(bar)
    }
    this.halos = [
      this._halo([-3.0, 1.15, -1.95], AMBER),
      this._halo([3.1, 1.05, -2.15], MINT),
    ]
    this.routes = [
      this._route('audio', AMBER, [[0, 0.08, 0.12], [-0.65, 1.90, 2.2], [-2.4, 1.85, 0.6], [-3.0, 1.15, -1.65]], 3.25, 2.0),
      this._route('text', AMBER, [[-3.0, 1.15, -1.65], [-2.2, 2.3, -1.0], [-0.5, 2.0, -0.3], [0.1, 1.45, -0.85]], 6.55, 1.15),
      this._route('request', MINT, [[0.1, 1.45, -0.85], [0.9, 2.4, -1.2], [2.4, 2.4, -1.5], [3.1, 1.05, -1.85]], 7.75, 1.3),
      this._route('call', MINT, [[3.1, 1.05, -1.85], [4.6, 1.95, -0.8], [3.2, 0.85, 0.7], [1.75, 0.35, 0.35]], 12.1, 1.35),
      this._route('dispatch', MINT, [[1.75, 0.35, 0.35], [1.1, 0.95, 0.8], [-0.45, 1.15, 0.65], [-0.65, 0.65, 0.14]], 14.35, 1.05),
      this._route('return', BLUE, [[-0.65, 0.65, 0.14], [0.1, 2.4, 0.3], [2.4, 2.1, -0.9], [3.1, 1.05, -1.85]], 15.75, 1.3),
      this._route('next', MINT, [[3.1, 1.05, -1.85], [3.2, 1.8, -0.1], [2.9, 0.9, 0.8], [1.9, 0.35, 0.3]], 21.1, 1.75),
    ]
    this.packetCurve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(4.3, 0.80, 0.55), new THREE.Vector3(4.0, 1.9, 0.95),
      new THREE.Vector3(2.6, 1.25, 0.75), new THREE.Vector3(1.75, 0.35, 0.3),
    )
    this.packetScratch = new THREE.Vector3()
    this.tunnel = []
    const tunnelGeometry = new THREE.TorusGeometry(0.235, 0.008, 6, 48)
    const normal = new THREE.Vector3(0, 0, 1)
    for (let index = 0; index < 12; index++) {
      const progress = 0.08 + index / 11 * 0.83
      const ring = new THREE.Mesh(tunnelGeometry, new THREE.MeshBasicMaterial({
        color: AMBER, transparent: true, opacity: 0, depthWrite: false, toneMapped: false,
      }))
      ring.position.copy(this.routes[0].curve.getPoint(progress))
      ring.quaternion.setFromUnitVectors(normal, this.routes[0].curve.getTangent(progress).normalize())
      this.group.add(ring)
      this.tunnel.push({ ring, progress })
    }
    this._buildOverview()
    this.cameraRig = new CameraRig()
    const at = (local, position, target, options = {}) => this.cameraRig.at(start + voicePlaybackTime(local), position, target, options)
    at(0, [0, 0.05, 4.1], [0, 0, 0], { fov: 34 })
    at(0.25, [0, 0.05, 5.3], [0, 0, 0], { fov: 34 })
    at(0.72, [0, 0.05, 5.3], [0, 0, 0], { fov: 34 })
    at(0.9, [0, 0.05, 4.8], [0, 0, 0], { fov: 34 })
    at(2.8, [0, 0.05, 4.8], [0, 0, 0], { fov: 34 })
    at(3.7, [-1.4, 1.20, 5.6], [-1.45, 0.90, -0.45], { fov: 42, roll: -2 })
    at(4.7, [-3.5, 1.70, 3.4], [-3.0, 1.15, -1.7], { fov: 42, roll: -1 })
    at(6.4, [-2.45, 1.8, 2.5], [-3.0, 1.15, -1.7], { fov: 40 })
    at(7.6, [-0.75, 2.90, 3.5], [0.1, 1.45, -0.9], { fov: 42, roll: 5 })
    at(8.7, [2.7, 2.2, 2.9], [3.1, 1.05, -1.9], { fov: 40, roll: 1 })
    at(9.75, [3.75, 1.65, 2.85], [3.1, 1.05, -1.9], { fov: 40 })
    at(10.65, [3.1, 1.50, 5.5], [3.1, 0.75, 0.55], { fov: 42, roll: -2 })
    at(12.3, [3.15, 1.40, 5.5], [3.1, 0.75, 0.55], { fov: 42 })
    at(13.4, [2.2, 2.05, 4.3], [1.75, 0.35, 0.3], { fov: 43, roll: 5 })
    at(14.1, [1.6, 1.35, 4.6], [1.75, 0.35, 0.3], { fov: 42 })
    at(15.1, [0.5, 1.20, 4.9], [0.5, 0.20, 0.05], { fov: 43, roll: -3 })
    at(16.1, [1.8, 3.25, 4.8], [1.8, 1.1, -0.3], { fov: 43, roll: -3 })
    at(17.0, [1.9, 2.6, 4.9], [1.8, 1.1, -0.3], { fov: 42 })
    at(17.85, [0.8, 3.5, 7.8], [0, 0.15, -0.3], { fov: 44, roll: -3 })
    at(18.9, [-2.1, 3.2, 8.1], [-0.2, 0.15, -0.3], { fov: 43, roll: -1 })
    at(20.25, [1.1, 2.45, 7.7], [0.1, 0.15, -0.2], { fov: 42, roll: 1.5 })
    at(21.05, [0.7, 1.30, 7.1], [0.1, 0.15, -0.1], { fov: 40 })
    at(22.1, [0.35, 0.38, 6.5], [-0.05, 0.18, 0], { fov: 38 })
    at(23.5, [0.05, 0.30, 6.1], [-0.10, 0.15, 0], { fov: 37 })
    at(25.2, [-0.1, 0.22, 5.4], [0, 0.10, 0], { fov: 36 })
    at(27.8, [0, 0.10, 4.45], [0, 0, 0], { fov: 34 })
  }

  _buildOverview() {
    this.overviewNodes = []
    const add = (options, position) => {
      const mesh = panel({ width: 2.15, height: 1.34, ...options })
      mesh.position.set(...position)
      this.overviewNodes.push(mesh)
      this.billboards.push(mesh)
      this.group.add(mesh)
    }
    add({
      title: '云端 ASR', kicker: '讯飞 IAT / 语音服务', lines: ['声波 → 文字'],
      footer: 'WebSocket', accent: '#d3aa74',
    }, [-3.05, 1.65, -1.1])
    add({
      title: '语音代理', kicker: '自有服务端',
      lines: [{ text: '/api/device/transcribe', size: 53, mono: true }],
      footer: '服务端持有语音凭据', accent: '#d3aa74',
    }, [-3.05, -0.40, 0.65])
    add({
      title: 'AgentLoop', kicker: '手机本机 / 会话编排',
      lines: [{ text: '目标 · 当前页面 · 工具', size: 65 }], footer: '每一步重新观察',
    }, [-0.05, 1.65, -0.8])
    add({
      title: '云端大模型', kicker: '模型提供方 / HTTPS',
      lines: [{ text: 'messages + tools', size: 65, mono: true }], footer: '提出下一步 tool_calls',
    }, [2.95, 1.65, -1.1])
    add({
      title: '本机工具守卫', kicker: '手机本机 / AndroidPhoneTools',
      lines: [{ text: '校验后执行', size: 77 }], footer: '参数 · 风险 · 授权 · 页面',
    }, [3.0, -0.40, 0.65])
    this.overviewLabels = [
      ['云端理解，本机执行，结果回传', [0, 2.78, -0.10], 0.20, MINT],
      ['手机界面', [0, -1.55, 0.28], 0.16, BLUE],
      ['tool_calls', [4.1, 0.55, 0.4], 0.13, MINT],
      ['新页面观察', [-0.82, 0.72, 0.35], 0.12, BLUE],
      ['role: tool', [1.25, 0.70, 1.12], 0.13, BLUE],
    ].map(([content, position, height, color]) => {
      const mesh = textPlane(content, { size: 64, color, worldHeight: height, supersample: 1 })
      mesh.position.set(...position)
      this.group.add(mesh)
      this.billboards.push(mesh)
      return mesh
    })
    const make = (name, color, coordinates, phase, duration, prefix = false) => ({
      ...this._route(name, color, coordinates, 17.25, duration), phase, prefix,
    })
    this.overviewRoutes = [
      make('raw_audio', AMBER, [[0, 0.16, 0.34], [-0.95, -0.08, 1.15], [-2.0, -0.2, 1.15], [-2.95, -0.25, 0.72]], 0, 0.6, true),
      make('speech_api', AMBER, [[-3.05, -0.1, 0.75], [-4.25, 0.3, 0.8], [-4.25, 1.1, -0.3], [-3.1, 1.3, -1.0]], 0, 0.6, true),
      make('recognized_text', AMBER, [[-3.0, 1.65, -0.95], [-2.0, 2.35, -0.65], [-1.0, 2.35, -0.65], [-0.1, 1.55, -0.65]], 0, 0.6, true),
      make('model_request', MINT, [[0.0, 1.6, -0.65], [1.0, 2.35, -0.4], [2.0, 2.35, -0.6], [2.95, 1.65, -0.95]], 0, 0.58),
      make('model_call', MINT, [[3.0, 1.5, -0.95], [4.35, 1.25, -0.1], [4.35, 0.3, 0.85], [3.0, -0.25, 0.78]], 0.65, 0.58),
      make('local_action', MINT, [[2.95, -0.25, 0.8], [2.0, -1.05, 1.2], [0.85, -1.0, 0.95], [0.0, 0.16, 0.35]], 1.3, 0.58),
      make('observe_again', BLUE, [[0.0, 0.16, 0.35], [-0.85, 0.55, 0.8], [-0.8, 1.0, 0.3], [-0.1, 1.45, -0.6]], 1.95, 0.58),
      make('tool_result', BLUE, [[0.0, 0.16, 0.35], [1.1, 0.55, 1.75], [2.15, 1.1, 1.2], [2.95, 1.55, -0.9]], 1.95, 0.58),
    ]
    this.platform = new THREE.Mesh(
      new THREE.RingGeometry(4.3, 4.315, 160),
      new THREE.MeshBasicMaterial({ color: 0x4c7888, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }),
    )
    this.platform.rotation.x = -Math.PI / 2
    this.platform.position.set(0, -1.78, -0.15)
    this.group.add(this.platform)
  }

  _paintRoute(route, progress, lineOpacity, packetOpacity) {
    route.line.geometry.setDrawRange(0, Math.max(2, Math.ceil(progress * 120)))
    route.line.material.opacity = lineOpacity
    const positions = route.points.geometry.attributes.position
    for (let index = 0; index < 28; index++) {
      const trailing = Math.max(0, progress - index * (0.008 + hash11(index, 12) * 0.004))
      route.curve.getPoint(trailing, route.scratch)
      positions.setXYZ(index, route.scratch.x, route.scratch.y, route.scratch.z)
    }
    positions.needsUpdate = true
    route.points.geometry.computeBoundingSphere()
    route.points.material.opacity = packetOpacity * 0.85
    route.head.position.copy(route.curve.getPoint(progress, route.scratch))
    route.head.material.opacity = packetOpacity * 0.7
    route.line.visible = lineOpacity > 0.001
    route.points.visible = route.head.visible = packetOpacity > 0.001
  }

  _halo(position, color) {
    const group = new THREE.Group()
    group.position.set(...position)
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, toneMapped: false })
    const geometry = new THREE.TorusGeometry(1.15, 0.006, 6, 96)
    for (let index = 0; index < 3; index++) {
      const ring = new THREE.Mesh(geometry, material)
      ring.rotation.set(index * 0.68, index * 0.58, index * 0.9)
      group.add(ring)
    }
    this.group.add(group)
    return { group, material }
  }

  _route(name, color, coordinates, start, duration) {
    const curve = new THREE.CubicBezierCurve3(...coordinates.map((point) => new THREE.Vector3(...point)))
    const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(120))
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }))
    const pointsGeometry = new THREE.BufferGeometry()
    pointsGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(28 * 3), 3))
    const points = new THREE.Points(pointsGeometry, new THREE.PointsMaterial({
      color, size: 0.034, transparent: true, opacity: 0, depthWrite: false, toneMapped: false,
      blending: THREE.AdditiveBlending,
    }))
    points.frustumCulled = false
    const head = makeGlow({ color, size: 0.27, opacity: 0 })
    this.group.add(line, points, head)
    return { name, curve, line, points, head, start, duration, scratch: new THREE.Vector3() }
  }

  update(local, opacity) {
    this.paintRecognition(local)
    const overview = envelope(local, 15.65, 17.35, 0.45, 0.5) * 0.20
    const appearances = {
      proxy: envelope(local, 3.3, 4.95, 0.25, 0.35),
      asr: envelope(local, 4.0, 7.15, 0.35, 0.35),
      recognized: 0,
      local: envelope(local, 7.1, 8.25, 0.25, 0.35),
      model: Math.max(envelope(local, 8.05, 10.30, 0.4, 0.4), overview),
      call: envelope(local, 10.10, 13.12, 0.4, 0.25),
      gate: envelope(local, 12.85, 15.05, 0.4, 0.4),
      result: envelope(local, 15.85, 17.20, 0.35, 0.35),
      next: envelope(local, 21.25, CUT_AT - 0.2, 0.4, 0.7),
    }
    for (const [name, appearance] of Object.entries(appearances)) {
      this.panels[name].userData.setOpacity(appearance * opacity)
    }
    this.library.userData.setOpacity(envelope(local, 10.0, 12.75, 0.4, 0.35) * opacity)
    const packetTransfer = smooth01(local, 12.10, 1.15)
    this.panels.call.position.copy(this.packetCurve.getPoint(packetTransfer, this.packetScratch))
    this.panels.call.scale.setScalar(1 - packetTransfer * 0.72)
    this.waveMaterial.opacity = envelope(local, 4.0, 6.0, 0.35, 0.3) * 0.8 * opacity
    this.wave.forEach((bar, index) => {
      const center = Math.sin(index / 63 * Math.PI)
      const signal = Math.abs(Math.sin(local * 7.3 + index * 0.55) * 0.65 + Math.sin(local * 3.2 + index * 1.7) * 0.35)
      bar.scale.y = 0.015 + center * signal * 0.24
    })
    this.halos[0].material.opacity = Math.max(appearances.asr, appearances.recognized) * opacity * 0.25
    this.halos[1].material.opacity = appearances.model * opacity * 0.22
    this.halos.forEach((halo, index) => {
      halo.group.rotation.set(local * 0.13, local * 0.17 + index, local * 0.08)
    })
    const tunnelAlpha = envelope(local, 3.25, 5.6, 0.25, 0.3) * opacity
    const audioProgress = smooth01(local, 3.25, 2.0)
    for (const { ring, progress } of this.tunnel) {
      const pulse = Math.exp(-Math.pow((progress - audioProgress) * 7, 2))
      ring.material.opacity = tunnelAlpha * (0.12 + pulse * 0.50)
    }
    for (const route of this.routes) {
      const clock = pauseClock(local, CUT_AT)
      const progress = smooth01(clock, route.start, route.duration)
      const alpha = envelope(local, route.start, Math.min(route.start + route.duration + 0.25, CUT_AT), 0.18, 0.25) * opacity
      this._paintRoute(route, progress, alpha * 0.40, alpha)
    }
    const architectureAlpha = envelope(local, 17.25, 21.1, 0.55, 0.6) * opacity
    for (const mesh of this.overviewNodes) mesh.userData.setOpacity(architectureAlpha)
    for (const mesh of this.overviewLabels) mesh.userData.setOpacity(architectureAlpha)
    this.platform.material.opacity = architectureAlpha * 0.22
    const cycle = ((pauseClock(local, CUT_AT) - 17.45) % 2.8 + 2.8) % 2.8
    for (const route of this.overviewRoutes) {
      const progress = route.prefix ? 1 : smooth01(cycle, route.phase, route.duration)
      const packetAlpha = route.prefix ? 0 : envelope(cycle, route.phase, route.phase + route.duration, 0.1, 0.12) * architectureAlpha
      this._paintRoute(route, progress, architectureAlpha * (route.prefix ? 0.22 : 0.37), packetAlpha)
      route.line.geometry.setDrawRange(0, 121)
    }
  }

  paintRecognition(local) {
    const progress = smooth01(local, 5.95, 0.8)
    const entry = this.recognition
    if (entry.last === progress) return
    entry.last = progress
    const context = entry.context
    const width = entry.canvas.width
    const height = entry.canvas.height
    context.globalAlpha = 1
    context.clearRect(0, 0, width, height)
    context.drawImage(entry.source, 0, 0)
    context.save()
    context.beginPath()
    context.rect(9, 270, width - 18, height - 375)
    context.clip()
    const background = context.createLinearGradient(0, 0, width, height)
    background.addColorStop(0, '#1a343e')
    background.addColorStop(0.55, '#142a33')
    background.addColorStop(1, '#10212a')
    context.fillStyle = background
    context.fillRect(0, 0, width, height)
    context.globalAlpha = 1 - smooth01(progress, 0, 0.35)
    context.drawImage(entry.source, 0, 0)
    context.globalAlpha = smooth01(progress, 0.35, 0.65)
    context.drawImage(entry.result, 0, 0)
    context.restore()
    this.panels.asr.material.map.needsUpdate = true
  }

  afterCamera(camera) {
    camera.getWorldQuaternion(this.cameraQuaternion)
    for (const mesh of this.billboards) mesh.quaternion.copy(this.cameraQuaternion)
  }
}
