import * as THREE from 'three'
import { Chapter } from '../chapter.js'
import { C } from '../palette.js'
import { EASE, hash11, smooth01 } from '../ease.js'
import { makePhone, makeGlow, roundedPlaneGeometry } from '../props.js'
import { phonePose } from '../phone.js'
import { PhoneView } from '../phoneview.js'
import { blankScreen, text as screenText, homeScreen, screenLayer, SCREEN_W, SCREEN_H } from '../screen.js'
import { textPlane } from '../text.js'

const STEP_COUNT = 16
const PARTICLE_COUNT = 4200
const STEP_SPACING = 0.53
const STEP_FRONT = -0.26
const STEP_WIDTH = 0.78
const STEP_HEIGHT = 1.66
const STEP_LABELS = [
  '打开服务', '找到挂号', '选择医院', '搜索科室',
  '选择门诊', '查看医生', '查看出诊', '选择日期',
  '选择时段', '填写就诊人', '核对身份', '阅读须知',
  '核对费用', '补全信息', '核对预约', '本人确认',
]

function stepDepth(index) {
  return STEP_FRONT - index * STEP_SPACING
}

function stepTexture(index) {
  const canvas = document.createElement('canvas')
  canvas.width = 960
  canvas.height = 2040
  const context = canvas.getContext('2d')
  context.scale(3, 3)
  const panel = (left, top, width, height, radius, fill) => {
    context.beginPath()
    context.roundRect(left, top, width, height, radius)
    context.fillStyle = fill
    context.fill()
  }
  const accents = ['#c69a60', '#729fac', '#83aa98', '#a497bb']
  const accent = accents[index % accents.length]
  const label = (content, left, top, size = 18, color = '#b7c9d9') => {
    context.fillStyle = color
    context.font = `400 ${size}px "Noto Sans CJK SC", sans-serif`
    context.textAlign = 'left'
    context.fillText(content, left, top)
  }
  const line = (left, top, width, fill = 'rgba(164,185,202,0.42)') => panel(left, top, width, 8, 4, fill)
  const thumbnail = (left, top, width, height, variant = 0) => {
    panel(left, top, width, height, 12, ['#526b72', '#6e6253', '#596c62', '#655f76'][variant % 4])
    if (variant % 3 === 0) {
      panel(left + width * 0.23, top + height * 0.22, width * 0.54, height * 0.61, 5, '#a2bec4')
      context.fillStyle = '#527c83'
      context.fillRect(left + width * 0.44, top + height * 0.29, width * 0.12, height * 0.24)
      context.fillRect(left + width * 0.35, top + height * 0.35, width * 0.30, height * 0.10)
      for (let windowIndex = 0; windowIndex < 6; windowIndex++) {
        context.fillRect(left + width * (0.31 + windowIndex % 3 * 0.14),
          top + height * (0.60 + Math.floor(windowIndex / 3) * 0.11), width * 0.08, height * 0.06)
      }
    } else if (variant % 3 === 1) {
      context.beginPath()
      context.arc(left + width * 0.5, top + height * 0.35, Math.min(width, height) * 0.17, 0, Math.PI * 2)
      context.fillStyle = '#a5bdc6'
      context.fill()
      context.beginPath()
      context.ellipse(left + width * 0.5, top + height * 0.73, width * 0.30, height * 0.23, 0, Math.PI, Math.PI * 2)
      context.fillStyle = '#c0d1d5'
      context.fill()
    } else {
      panel(left + width * 0.24, top + height * 0.14, width * 0.52, height * 0.72, 5, '#bacad0')
      for (let row = 0; row < 4; row++) {
        panel(left + width * 0.32, top + height * (0.28 + row * 0.13),
          width * (row === 3 ? 0.24 : 0.36), height * 0.045, 2, '#607e88')
      }
    }
  }
  const chip = (content, left, top, width, selected = false) => {
    panel(left, top, width, 42, 13, selected ? accent : 'rgba(158,180,198,0.16)')
    label(content, left + 10, top + 27, 17, selected ? '#172530' : '#b7c9d9')
  }
  const action = (content = '下一步') => {
    panel(28, 584, 264, 52, 20, accent)
    label(content, 116, 617, 19, '#172530')
  }
  const field = (content, top, valueWidth = 140) => {
    label(content, 30, top, 17, '#8d9faf')
    panel(28, top + 15, 264, 51, 10, 'rgba(160,181,198,0.12)')
    line(43, top + 37, valueWidth)
  }

  panel(2, 2, 316, 676, 36, 'rgba(34,48,63,0.88)')
  context.beginPath()
  context.roundRect(3, 3, 314, 674, 35)
  context.strokeStyle = 'rgba(174,195,213,0.85)'
  context.lineWidth = 3
  context.stroke()

  context.fillStyle = '#b7c9d9'
  context.font = '500 28px "Noto Sans CJK SC", sans-serif'
  context.textAlign = 'left'
  context.fillText(STEP_LABELS[index], 30, 88)
  context.font = '400 16px "Noto Sans CJK SC", sans-serif'
  context.fillStyle = '#8295a6'
  context.fillText('流程示意', 30, 120)

  switch (index) {
    case 0:
      panel(28, 156, 264, 110, 18, '#526f80')
      label('便民就医服务', 46, 201, 23)
      line(46, 229, 145)
      for (let tile = 0; tile < 6; tile++) {
        const left = 28 + tile % 3 * 92
        const top = 300 + Math.floor(tile / 3) * 118
        thumbnail(left, top, 78, 68, tile)
        line(left + 8, top + 82, 60)
      }
      break
    case 1:
      panel(28, 157, 264, 43, 22, 'rgba(160,181,198,0.17)')
      label('找到预约挂号入口', 48, 185, 18)
      for (let tile = 0; tile < 4; tile++) {
        const left = 28 + tile % 2 * 138
        const top = 226 + Math.floor(tile / 2) * 150
        thumbnail(left, top, 126, 112, tile + 1)
        label(['预约挂号', '报告查询', '就诊记录', '缴费入口'][tile], left + 12, top + 137, 19)
      }
      break
    case 2:
      panel(28, 156, 264, 330, 18, '#334e60')
      context.strokeStyle = '#728a99'
      context.lineWidth = 12
      for (let street = 0; street < 4; street++) {
        context.beginPath()
        context.moveTo(30, 192 + street * 78)
        context.lineTo(285, 161 + street * 82)
        context.stroke()
      }
      context.beginPath()
      context.moveTo(125, 165)
      context.lineTo(185, 480)
      context.stroke()
      context.beginPath()
      context.arc(159, 323, 23, 0, Math.PI * 2)
      context.fillStyle = accent
      context.fill()
      panel(45, 424, 230, 45, 10, '#263b4b')
      label('查找附近医院', 64, 453, 18)
      action('选择医院')
      break
    case 3:
      panel(28, 158, 264, 52, 20, 'rgba(160,181,198,0.20)')
      label('输入科室名称', 49, 192, 22)
      label('科室分类', 30, 257, 19)
      chip('内科', 28, 281, 115)
      chip('外科', 155, 281, 137)
      chip('眼科', 28, 337, 145)
      chip('骨科', 185, 337, 107)
      label('更多科室', 30, 423, 19)
      line(30, 456, 221)
      line(30, 495, 180)
      line(30, 534, 240)
      break
    case 4:
      for (let row = 0; row < 3; row++) {
        const top = 157 + row * 140
        panel(28, top, 264, 122, 14, 'rgba(160,181,198,0.12)')
        thumbnail(41, top + 16, 81, 87, row * 3)
        label(['普通门诊', '专家门诊', '复诊门诊'][row], 135, top + 39, 21)
        line(135, top + 65, 124)
        line(135, top + 87, 93, accent)
      }
      break
    case 5:
      panel(22, 155, 67, 399, 12, '#293f50')
      for (let row = 0; row < 4; row++) {
        panel(30, 175 + row * 80, 50, 45, 8, row === 1 ? accent : '#425969')
      }
      for (let row = 0; row < 3; row++) {
        const top = 158 + row * 132
        thumbnail(101, top, 80, 100, row * 3 + 1)
        line(194, top + 18, 98)
        line(194, top + 48, 78)
        label('查看', 246, top + 91, 18, accent)
      }
      panel(22, 591, 276, 47, 19, accent)
      break
    case 6:
      thumbnail(28, 154, 264, 231, 1)
      label('医生与门诊信息', 30, 433, 22)
      line(30, 466, 235)
      line(30, 492, 177)
      label('查看可预约日期', 30, 546, 19, accent)
      action('查看出诊')
      break
    case 7:
      panel(28, 154, 264, 58, 14, '#38586a')
      label('选择预约日期', 45, 193, 23)
      for (let weekday = 0; weekday < 7; weekday++) {
        label(['一', '二', '三', '四', '五', '六', '日'][weekday], 35 + weekday * 37, 263, 17)
      }
      for (let day = 0; day < 21; day++) {
        const left = 28 + day % 7 * 38
        const top = 292 + Math.floor(day / 7) * 61
        panel(left, top, 31, 44, 8, day === 10 ? accent : '#41596b')
        label(String(day + 1), left + 5, top + 28, 16, day === 10 ? '#172530' : '#b7c9d9')
      }
      label('日期仅为流程示意', 30, 526, 17, '#8d9faf')
      action('确定日期')
      break
    case 8:
      label('上午时段', 30, 189, 22)
      for (let slot = 0; slot < 4; slot++) {
        const left = 28 + slot % 2 * 139
        const top = 218 + Math.floor(slot / 2) * 70
        chip(['08:30', '09:00', '09:30', '10:00'][slot], left, top, 125, slot === 2)
      }
      label('下午时段', 30, 418, 22)
      chip('14:00', 28, 451, 125)
      chip('14:30', 167, 451, 125)
      action('确定时段')
      break
    case 9:
      field('就诊人姓名', 170, 105)
      field('证件信息', 279, 173)
      field('联系电话', 388, 213)
      chip('本人', 28, 499, 93, true)
      chip('家人', 134, 499, 93)
      action('核对信息')
      break
    case 10:
      panel(28, 154, 264, 88, 15, '#38586a')
      label('请本人核对身份', 44, 204, 22)
      thumbnail(106, 270, 108, 123, 1)
      label('姓名：***', 69, 437, 22)
      label('证件号：********', 47, 483, 21)
      action('本人核对')
      break
    case 11:
      for (let ticket = 0; ticket < 3; ticket++) {
        const top = 158 + ticket * 133
        panel(28, top, 264, 106, 16, ['#645943', '#445f60', '#554b68'][ticket])
        label(['预约说明', '就诊须知', '信息与隐私'][ticket], 48, top + 45, 24)
        line(48, top + 74, 158)
        context.beginPath()
        context.arc(256, top + 53, 15, 0, Math.PI * 2)
        context.strokeStyle = accent
        context.lineWidth = 3
        context.stroke()
      }
      action('阅读须知')
      break
    case 12:
      panel(28, 157, 264, 121, 16, '#355364')
      label('费用明细', 46, 201, 23)
      line(46, 231, 212, accent)
      for (let row = 0; row < 4; row++) {
        const top = 333 + row * 58
        label(['费用项目', '金额明细', '支付方式', '本人核对'][row], 30, top, 21)
        line(226, top - 11, 65, row === 3 ? accent : '#7f96a6')
      }
      action('核对费用')
      break
    case 13:
      panel(28, 158, 264, 179, 16, 'rgba(160,181,198,0.18)')
      label('补全联系人信息', 44, 197, 22)
      line(44, 238, 191)
      line(44, 274, 147)
      chip('本人', 28, 362, 79, true)
      chip('家人', 119, 362, 79)
      chip('其他', 210, 362, 82)
      for (let key = 0; key < 24; key++) {
        const left = 28 + key % 8 * 34
        const top = 445 + Math.floor(key / 8) * 37
        panel(left, top, 27, 28, 5, '#506374')
      }
      action('保存信息')
      break
    case 14:
      panel(28, 155, 264, 78, 14, '#3f5f67')
      label('医院与预约日期', 44, 186, 20)
      line(44, 207, 203)
      thumbnail(28, 254, 88, 119, 1)
      line(133, 276, 156)
      line(133, 312, 118)
      line(133, 351, 145, accent)
      panel(28, 401, 264, 143, 14, 'rgba(160,181,198,0.14)')
      label('科室 / 医生 / 时段', 43, 437, 20)
      line(43, 467, 228)
      line(43, 502, 173)
      action('核对预约')
      break
    case 15:
      context.beginPath()
      context.arc(160, 247, 60, 0, Math.PI * 2)
      context.strokeStyle = '#83aa98'
      context.lineWidth = 6
      context.stroke()
      label('本人', 132, 257, 27, '#b7cfbf')
      label('请本人核对', 91, 378, 25)
      label('关键操作交还本人', 61, 427, 21, '#8ca598')
      panel(28, 470, 264, 65, 15, '#34534e')
      label('保留最后的决定权', 57, 511, 20)
      action('我来确认')
      break
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

export function build({ stage, chapter }) {
  return new Prologue({ stage, chapter })
}

class Prologue extends Chapter {
  constructor(context) {
    super(context)
    this.phone = makePhone()
    this.phone.name = 'phone'
    this.group.add(this.phone)
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
    this.view = new PhoneView(context.stage, this.phone)
    this.layer = screenLayer()
    homeScreen(this.layer.ctx, { listening: false })

    this.task = textPlane('预约挂号', {
      size: 140,
      font: '500 1px "Noto Sans CJK SC", sans-serif',
      color: 0xdce3e8,
      letterSpacing: 14,
      worldHeight: 0.93,
      supersample: 1,
    })
    this.task.position.z = 0.18
    this.task.name = 'errand'
    this.group.add(this.task)
    this._buildParticles()
    this._buildSteps()

    this.title = textPlane('银龄智办', {
      size: 120,
      font: '500 1px "Noto Sans CJK SC", sans-serif',
      color: 0xd6dfe3,
      letterSpacing: 10,
      worldHeight: 0.24,
      supersample: 1,
    })
    this.title.position.set(0, 1.04, 0.12)
    this.group.add(this.title)
    this.descriptor = textPlane('可信跨应用助老智能体', {
      size: 36,
      font: '400 1px "Noto Sans CJK SC", sans-serif',
      color: C.textDim,
      worldHeight: 0.15,
      supersample: 1,
    })
    this.descriptor.position.set(0, 0.86, 0.12)
    this.group.add(this.descriptor)
    this.brandHalo = makeGlow({ color: 0x79b7a9, size: 2.2, opacity: 0 })
    this.brandHalo.position.set(0, 0, -0.35)
    this.group.add(this.brandHalo)
  }

  _buildParticles() {
    const canvas = this.task.material.map.image
    const context = canvas.getContext('2d')
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    const samples = []
    for (let pixelY = 0; pixelY < canvas.height; pixelY++) {
      for (let pixelX = 0; pixelX < canvas.width; pixelX++) {
        if (pixels[(pixelY * canvas.width + pixelX) * 4 + 3] > 128) {
          samples.push([pixelX, pixelY])
        }
      }
    }
    if (!samples.length) throw new Error('开场文字未生成可用字形')

    const positions = new Float32Array(PARTICLE_COUNT * 3)
    const targets = new Float32Array(PARTICLE_COUNT * 3)
    const orders = new Float32Array(PARTICLE_COUNT)
    const phases = new Float32Array(PARTICLE_COUNT)
    const planeWidth = this.task.geometry.parameters.width
    const planeHeight = this.task.geometry.parameters.height

    for (let index = 0; index < PARTICLE_COUNT; index++) {
      const sample = samples[Math.floor(index * samples.length / PARTICLE_COUNT)]
      positions[index * 3] = (sample[0] / canvas.width - 0.5) * planeWidth
      positions[index * 3 + 1] = (0.5 - sample[1] / canvas.height) * planeHeight
      positions[index * 3 + 2] = this.task.position.z
      const stepIndex = Math.floor(hash11(index, 1) * STEP_COUNT)
      targets[index * 3] = (hash11(index, 2) - 0.5) * STEP_WIDTH * 0.85
      targets[index * 3 + 1] = (hash11(index, 3) - 0.5) * STEP_HEIGHT * 0.85
      targets[index * 3 + 2] = stepDepth(stepIndex)
      orders[index] = stepIndex / (STEP_COUNT - 1) * 0.72
      phases[index] = hash11(index, 4) * Math.PI * 2
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aTarget', new THREE.BufferAttribute(targets, 3))
    geometry.setAttribute('aOrder', new THREE.BufferAttribute(orders, 1))
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))
    this.particleMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: true,
      blending: THREE.AdditiveBlending,
      uniforms: { uProgress: { value: 0 }, uOpacity: { value: 0 } },
      vertexShader: `
        attribute vec3 aTarget;
        attribute float aOrder;
        attribute float aPhase;
        uniform float uProgress;
        uniform float uOpacity;
        varying float vAlpha;
        void main() {
          float travel = smoothstep(aOrder, aOrder + 0.28, uProgress);
          vec3 location = mix(position, aTarget, travel);
          location.x += sin(travel * 3.14159) * cos(aPhase) * 0.16;
          location.y += sin(travel * 3.14159) * sin(aPhase) * 0.16;
          vec4 viewPosition = modelViewMatrix * vec4(location, 1.0);
          gl_Position = projectionMatrix * viewPosition;
          gl_PointSize = clamp(0.016 * projectionMatrix[1][1] * 540.0 / max(0.1, -viewPosition.z), 1.4, 8.0);
          vAlpha = uOpacity * (1.0 - travel);
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        void main() {
          float radius = length(gl_PointCoord - 0.5);
          float softness = 1.0 - smoothstep(0.12, 0.5, radius);
          gl_FragColor = vec4(0.74, 0.82, 0.88, softness * vAlpha);
        }
      `,
    })
    this.particles = new THREE.Points(geometry, this.particleMaterial)
    this.particles.frustumCulled = false
    this.group.add(this.particles)
  }

  _buildSteps() {
    this.steps = Array.from({ length: STEP_COUNT }, (_, index) => {
      const mesh = new THREE.Mesh(
        roundedPlaneGeometry(STEP_WIDTH, STEP_HEIGHT, 0.09, 16),
        new THREE.MeshBasicMaterial({
          map: stepTexture(index), transparent: true, opacity: 0,
          toneMapped: false, depthWrite: false, side: THREE.DoubleSide,
        }),
      )
      mesh.name = `step-${index + 1}`
      mesh.position.set(0, 0, stepDepth(index))
      this.group.add(mesh)
      return mesh
    })

    this.rails = []
    for (const horizontal of [-1, 1]) {
      for (const vertical of [-1, 1]) {
        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
          horizontal * STEP_WIDTH / 2, vertical * STEP_HEIGHT / 2, STEP_FRONT,
          horizontal * STEP_WIDTH / 2, vertical * STEP_HEIGHT / 2, stepDepth(STEP_COUNT - 1),
        ]), 3))
        const rail = new THREE.Line(geometry, new THREE.LineBasicMaterial({
          color: 0x8da7bd, transparent: true, opacity: 0, depthWrite: false,
        }))
        this.rails.push(rail)
        this.group.add(rail)
      }
    }
  }

  update(local, absolute, envelope) {
    const taskIn = smooth01(local, 0.15, 0.7)
    const taskOut = 1 - smooth01(local, 2.85, 0.65)
    this.task.userData.setOpacity(taskIn * taskOut * envelope)
    this.particleMaterial.uniforms.uProgress.value = smooth01(local, 2.8, 3.0)
    this.particleMaterial.uniforms.uOpacity.value = smooth01(local, 2.7, 0.35) * envelope
    this.particles.visible = local > 2.7 && local < 5.85

    const remainingDepth = 1 - smooth01(local, 9.0, 1.7)
    const corridorOut = 1 - smooth01(local, 10.6, 0.25)
    this.steps.forEach((step, index) => {
      const arrival = smooth01(local, 2.9 + index * 0.14, 0.45)
      const fold = smooth01(local, 9.0 + (STEP_COUNT - 1 - index) * 0.065, 0.72)
      step.position.set(0, 0, -0.052 + (stepDepth(index) + 0.052) * remainingDepth)
      step.rotation.set(0, (index % 2 ? 1 : -1) * Math.sin(fold * Math.PI) * 1.05, 0)
      step.scale.set(1 - fold * 0.15, 1 - fold * 0.10, 1)
      step.material.opacity = arrival * corridorOut * envelope * 0.92
      step.visible = step.material.opacity > 0.001
    })
    for (const rail of this.rails) {
      const positions = rail.geometry.attributes.position
      positions.setZ(0, -0.052 + (STEP_FRONT + 0.052) * remainingDepth)
      positions.setZ(1, -0.052 + (stepDepth(STEP_COUNT - 1) + 0.052) * remainingDepth)
      positions.needsUpdate = true
      rail.material.opacity = smooth01(local, 4.5, 1.2) * corridorOut * envelope * 0.18
      rail.visible = rail.material.opacity > 0.001
    }

    const pose = phonePose(absolute)
    const emphasis = smooth01(local, 13.9, 0.65)
    const handoff = smooth01(local, 15.25, 0.75)
    this.phone.position.set(0, pose.y, pose.z)
    this.phone.rotation.set(pose.rotX, pose.rotY, 0)
    this.phone.scale.setScalar(pose.scale)
    this.phone.visible = pose.scale > 0.02 && emphasis < 0.995
    for (const { material, opacity } of this.phoneMaterials) {
      material.opacity = opacity * (1 - emphasis)
    }
    this._drawScreen(local)

    const titleIn = smooth01(local, 11.4, 0.6)
    this.title.position.set(-0.75 * handoff, 1.04 * (1 - emphasis) * (1 - handoff) + handoff * 1.05, 0.12 + emphasis * 0.18 - handoff * 0.1)
    this.title.scale.setScalar((1 + emphasis * 1.25) * (1 - handoff) + handoff * 0.625)
    this.descriptor.position.set(0, 0.86 - emphasis * 1.13, 0.12 + emphasis * 0.18)
    this.descriptor.scale.setScalar(1 + emphasis * 0.12)
    this.title.userData.setOpacity(titleIn * envelope * (1 - smooth01(local, 15.75, 0.6)))
    this.descriptor.userData.setOpacity(titleIn * envelope * 0.90 * (1 - smooth01(local, 15.25, 0.55)))
    this.brandHalo.material.opacity = emphasis * (1 - handoff) * envelope * 0.16
    super.update(local, absolute, envelope)
  }

  _drawScreen(local) {
    const context = this.view.g
    blankScreen(context)
    const centerX = SCREEN_W / 2
    const centerY = SCREEN_H / 2
    const markIn = smooth01(local, 4.0, 0.7)
    const markOut = 1 - smooth01(local, 10.3, 0.4)
    screenText(context, '银龄智办', centerX, centerY, {
      font: '500 86px "Noto Sans CJK SC", sans-serif',
      color: '#79b7a9', alpha: markIn * markOut,
    })

    const reveal = EASE.inOut(smooth01(local, 10.85, 1.0))
    if (reveal > 0.001) {
      const width = SCREEN_W * (0.72 + reveal * 0.28)
      const height = SCREEN_H * (0.18 + reveal * 0.82)
      context.save()
      context.beginPath()
      context.roundRect(centerX - width / 2, centerY - height / 2, width, height, 62 * (1 - reveal))
      context.clip()
      context.globalAlpha = Math.min(1, reveal * 3)
      context.drawImage(this.layer.canvas, 0, 0, SCREEN_W, SCREEN_H)
      context.restore()
    }
    this.view.commitNow()
  }
}
