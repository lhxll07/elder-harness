import { Stage, CameraRig, WIDTH, HEIGHT } from './stage.js'
import { makePhone, PHONE, PHONE_Z } from './props.js'
import { PhoneView } from './phoneview.js'
import { SCREEN_W, SCREEN_H } from './screen.js'
import { hospitalPage, floatingPill } from './shots/voice.js'
import { journeyPage } from './shots/journey-ui.js'
import { DURATION, BEATS, CUES } from './compiler-script.js'
import { CompilerTitles } from './compiler-titles.js'
import { CompilerProof } from './compiler-proof.js'
import { familyPages } from './fusion-family-ui.js'
import { THREE, INK, GOLD, JADE, BLUE, PAGE_WIDTH, PAGE_HEIGHT, add, type, windowAt, surface, page, bendPage, line, stroke, selection, field, place, cropImage, cropPage, fade, smooth01, lerp } from './compiler-design.js'

export async function boot() {
  await Promise.all([
    document.fonts.load('500 96px "Noto Sans CJK SC"'),
    document.fonts.load('400 96px "Noto Serif CJK SC"'),
  ])
  await document.fonts.ready
  const family = Object.fromEntries(await Promise.all(['request', 'compose', 'read'].map(async name => {
    const image = new Image()
    image.src = `/assets/family/${name}.png`
    await image.decode()
    return [name, image]
  })))
  const stage = new Stage(document.getElementById('view'))
  const film = new CompilerFilm(stage, family)
  const titles = new CompilerTitles(stage, CUES)
  window.__stage = stage
  window.__film = {
    title: '银龄智办 · 为人编译', duration: DURATION, width: WIDTH, height: HEIGHT,
    renderWidth: stage.renderWidth, renderHeight: stage.renderHeight, renderScale: stage.renderScale,
    shots: BEATS, structure: '一个连续任务；节拍仅供渲染检查，不作为章节显示',
  }
  window.__compiler = film
  window.__renderAt = time => {
    try {
      stage.setTime(time)
      stage.setFade(0.35 + 0.65 * smooth01(time, 0, 0.8))
      film.update(time)
      titles.update(time)
      stage.render()
    } catch (error) {
      window.__error = String(error.stack || error)
      throw error
    }
  }
  Object.defineProperty(window, '__contextLost', { get: () => stage.contextLost })
  window.__renderAt(0)
  document.getElementById('boot').classList.add('hidden')
  window.__ready = true
}

export class CompilerFilm {
  constructor(stage, family) {
    this.stage = stage
    this.family = family
    this.root = add(stage.world, new THREE.Group())
    this.root.name = 'one-compilation'
    this.phone = add(this.root, makePhone())
    this.view = new PhoneView(stage, this.phone)
    this.pages = Object.fromEntries(['departments', 'doctors', 'dates', 'review', 'waiting', 'result'].map(kind => [kind, journeyPage(kind)]))
    this.pages.home = hospitalPage()
    this.source = ['home', 'departments', 'doctors', 'dates', 'review', 'result'].map((kind, index) => {
      const entry = page(this.pages[kind], index, ['预约入口', '选择科室', '查找医生', '读取排班', '核对信息', '提交状态'][index])
      this.root.add(entry.root)
      return entry
    })
    this.camera = new CameraRig()
    for (const [time, position, look, fov = 38, roll = 0] of [
      [0, [0, 0.12, 6.8], [0, 0.1, 0], 36],
      [3, [0, 0.12, 6.8], [0, 0.1, 0], 36],
      [8, [6.8, 2.6, 5.8], [0, 0, -2.0], 40, -7],
      [12, [4, 2.0, 11], [0, 0, -1.5], 40, -3],
      [16, [0.8, 0.4, 10.5], [0, 0.1, 0], 38],
      [20, [-0.4, 0.25, 7.7], [0, 0.1, 0], 38, -2],
      [24, [1.4, 0.8, 7.8], [0, 0.1, 0], 38],
      [27, [2.6, 1.5, 11.5], [0, 0, -1], 40, 3],
      [33, [0, 0.3, 10], [0, 0.1, 0], 36],
      [37, [0, 0.2, 8.5], [0, 0.1, 0], 36],
      [40, [2.75, 0.15, 3.2], [2.75, 0.15, -1], 38],
      [42, [2.75, 0.1, 1.6], [2.75, 0.1, -3], 42],
      [44.5, [0.6, 0.1, 9.7], [0, 0.1, 0], 38],
      [48, [0, 0.15, 8.5], [0, 0.1, 0], 38],
      [52, [0, 0.1, 7.8], [0, 0.1, 0], 38],
      [55, [3.4, 1.4, 8], [0.1, 0, 0], 40, 6],
      [59, [3.5, 0.75, 6.3], [0.2, 0.05, 0], 40, 3],
      [63, [1, 0.35, 6.8], [0, 0.05, 0], 38],
      [67, [0, 0.1, 6.6], [0.1, 0.1, 0], 38],
      [71, [-0.5, 0.2, 6.3], [0.2, 0.1, 0], 38],
      [75, [0, 0.1, 6.3], [0.2, 0.1, 0], 38],
      [78, [3.8, 1.65, 7.8], [0.15, 0, 0], 40, -5],
      [81, [0, 0.3, 10.3], [0, 0.3, 0], 38],
      [84, [1.9, 1.0, 9.5], [0, 0.2, 0.1], 38, -4],
      [87, [0, 0.2, 9.2], [0, 0.2, 0.1], 38],
      [90, [-3.2, 1.6, 8.5], [0, 0.2, 0], 40, 5],
      [93, [0, 0.3, 8.7], [0, 0.15, 0], 38],
      [96, [0, 0.1, 7.8], [0, 0.1, 0], 38],
      [104, [0, 0.1, 7.8], [0, 0.1, 0], 38],
    ]) this.camera.at(time, position, look, { fov, roll })
    this.buildRoom()
    this.buildLanguage()
    this.buildParser()
    this.buildFields()
    this.buildFamily()
    this.buildRuntime()
    this.buildProof()
    this.buildSignature()
  }

  buildRoom() {
    const stage = this.stage
    stage.studio.floor.visible = false
    stage.scene.fog = new THREE.FogExp2(0x171719, 0.012)
    stage.studio.background.material = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: { warmth: { value: 0 } },
      vertexShader: 'varying vec3 direction; void main() { direction = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        varying vec3 direction;
        uniform float warmth;
        void main() {
          vec3 normal = normalize(direction);
          float windowLight = exp(-5.0 * pow(normal.x + 0.65, 2.0) - 4.0 * pow(normal.y - 0.2, 2.0));
          float rim = exp(-12.0 * pow(normal.x - 0.65, 2.0) - 3.0 * pow(normal.y + 0.1, 2.0));
          vec3 base = vec3(0.003, 0.004, 0.005) + vec3(0.004, 0.004, 0.004) * (normal.y + 1.0);
          base += mix(vec3(0.014, 0.018, 0.022), vec3(0.038, 0.022, 0.009), warmth) * windowLight;
          base += vec3(0.007, 0.014, 0.022) * rim;
          gl_FragColor = vec4(base, 1.0);
        }
      `,
    })
    add(stage.scene, new THREE.PointLight(0xe7c7a0, 24, 30, 2), [-5, 4, 4])
    add(stage.scene, new THREE.PointLight(0xc2cdd9, 16, 30, 2), [5, 3, -4])
    this.spine = stroke(this.root, [[-6, -1.55, -0.4], [-3.1, -1.1, 0.7], [0, -0.95, 0.9], [3, -1.1, 0.7], [6, -1.55, -0.4]], GOLD, 0.008)
  }

  buildLanguage() {
    this.utterance = add(this.root, type('帮我挂周四上午的普通内科。', 0.69, INK, true), [0, 1.37, 1.1])
    this.asr = add(this.root, type('语音 → 文字 → 目标', 0.22, GOLD), [0, 0.80, 1.1])
    this.waves = add(this.root, new THREE.Group(), [0, 1.25, 1.2])
    this.bars = Array.from({ length: 43 }, (_, index) => {
      const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.013, 0.10, 3, 6), new THREE.MeshBasicMaterial({ color: index % 3 ? INK : GOLD, transparent: true, toneMapped: false }))
      return add(this.waves, mesh, [(index - 21) * 0.07, 0, 0])
    })
    this.masthead = add(this.root, type('为人编译', 1.65, INK), [0, 2.5, -2])
    this.masthead.rotation.y = -0.12
  }

  buildParser() {
    this.structure = add(this.root, new THREE.Group())
    const nodes = [
      ['window', -0.8, 1.6, BLUE], ['预约挂号', -0.45, 1.10, INK],
      ['科室列表', -0.1, 0.60, INK], ['e12  普通内科', 0.50, 0.10, JADE],
      ['e13  心血管内科', 0.62, -0.40, INK], ['e14  内分泌科', 0.50, -0.90, INK],
      ['clickable = true', 0.50, -1.48, GOLD],
    ]
    nodes.forEach(([content, horizontal, vertical, color], index) => {
      add(this.structure, type(content, index === 3 ? 0.38 : 0.26, color), [horizontal, vertical, 0])
    })
    add(this.structure, line([[-1.36, 1.52, 0], [-1.36, -1.0, 0], [-0.95, -1.0, 0]], BLUE, 0.45))
    for (const vertical of [1.1, 0.60, 0.1, -0.4, -0.9]) add(this.structure, line([[-1.36, vertical, 0], [-0.95, vertical, 0]], BLUE, 0.45))
    add(this.structure, type('控件树 / 语义与可操作性', 0.20, BLUE), [0, 2.12, 0])
    this.pixelLabel = add(this.root, type('截图 / 可见位置与版式', 0.23, GOLD))
    this.rowSelection = add(this.root, selection(PAGE_WIDTH * 638 / SCREEN_W, PAGE_HEIGHT * 246 / SCREEN_H, GOLD))
    this.correspondence = stroke(this.root, [[-1.4, 0.28, 0.22], [-0.55, 0.30, 0.25], [0.55, 0.28, 0.25], [1.45, 0.15, 0.18]], JADE, 0.0018)
    this.sameTarget = add(this.root, type('同一个「普通内科」', 0.30, JADE), [0, -1.50, 0.35])
  }

  buildFields() {
    this.constraints = [
      field('科室', '普通内科', cropPage(this.pages.departments, 379, 782, 638, 246), 1.37, 0.53),
      field('时段', '周四上午', cropPage(this.pages.dates, 60, 790, 960, 192), 1.70, 0.34),
      field('医生', '哪位医生？', null, 1.64, 0.53, GOLD),
    ]
    this.constraints.forEach(entry => this.root.add(entry.root))
    this.resolved = add(this.constraints[2].root, type('陈医生', 0.47, GOLD), [0, -0.615, 0.016])
    this.hole = add(this.constraints[2].root, type('？', 0.49, GOLD), [0, 0, 0.02])
    this.valueDoctor = add(this.constraints[2].root, surface(cropPage(this.pages.doctors, 280, 880, 500, 130), 1.40, 0.36), [0, 0, 0.012])
    this.kept = add(this.root, type('任务约束', 0.24, GOLD), [0, 1.30, 0.9])
    this.removed = add(this.root, type('入口 · 列表 · 翻页 · 查找 · 返回', 0.36, 0x8c8e8d), [0, -1.55, 0.2])
  }

  buildFamily() {
    const pages = familyPages()
    this.familyRequest = add(this.root, surface(pages.request, 6.0, 6.0 * 1197 / 2004))
    this.familyCompose = add(this.root, surface(pages.compose, 2.85, 2.85 * 1209 / 1113))
    this.familyRead = add(this.root, surface(pages.read, 5.6, 5.6 * 507 / 1854))
    this.familyMessage = add(this.root, surface(pages.message, 4.0, 0.7))
    this.familyCaption = add(this.root, type('家人网页 · 带着上下文协作', 0.23, GOLD))
    this.elderReply = add(this.root, type('“核对过了，就选陈医生。”', 0.47, INK), [0, -0.9, 0.8])
  }

  buildRuntime() {
    this.skill = add(this.root, new THREE.Group())
    const reference = document.createElement('canvas')
    reference.width = 1800
    reference.height = 630
    const context = reference.getContext('2d')
    context.fillStyle = '#e9e6db'
    context.fillRect(0, 0, 1800, 630)
    context.fillStyle = '#84704e'
    context.font = '500 47px "Noto Sans CJK SC", sans-serif'
    context.fillText('REFERENCE / 按需方法片段示意', 100, 112)
    context.fillStyle = '#2c4445'
    context.font = '500 79px "Noto Sans CJK SC", sans-serif'
    context.fillText('以实时观察', 100, 285)
    context.fillText('和工具反馈为准', 100, 405)
    context.strokeStyle = '#b5a88e'
    context.lineWidth = 2
    context.beginPath()
    context.moveTo(100, 500)
    context.lineTo(1695, 500)
    context.stroke()
    add(this.skill, surface(reference, 2.5, 0.875))
    add(this.skill, type('当前方法 / 按需引用', 0.25, GOLD), [0, 0.66, 0.02])
    add(this.skill, type('load_skill', 0.27, INK), [0, -0.68, 0.02])
    this.instructions = [
      ['tap_text("普通内科")', 'expectedEffect: 出现「选择医生」'],
      ['click(target: "e31")', '控件编号来自最近一次页面观察'],
      ['tap_text("核对预约信息")', 'expectedEffect: 出现「请您核对预约信息」'],
    ].map(([call, effect]) => {
      const root = add(this.root, new THREE.Group())
      add(root, type('tool_call', 0.22, GOLD), [0, 0.53, 0])
      add(root, type(call, 0.34, INK), [0, 0.06, 0])
      add(root, type(effect, 0.20, BLUE), [0, -0.43, 0])
      add(root, line([[-1.65, -0.75, 0], [1.65, -0.75, 0]], GOLD, 0.4))
      return root
    })
    this.reobserve = add(this.root, type('观察 → 本地约束 → 执行 → 再观察', 0.24, JADE))
    this.oldTarget = add(this.root, selection(0.75, 0.25, 0x8b8580))
    this.liveTarget = add(this.root, selection(0.75, 0.25, GOLD))
    this.bindText = add(this.root, type('页面变了，重新定位。', 0.22, GOLD))
    this.tap = add(this.root, selection(0.34, 0.16, GOLD))
    this.reviewPieces = [
      { canvas: cropPage(this.pages.review, 60, 989, 960, 192), top: 989 },
      { canvas: cropPage(this.pages.review, 60, 1209, 960, 192), top: 1209 },
      { canvas: cropPage(this.pages.review, 60, 1649, 960, 192), top: 1649 },
    ].map(entry => ({ ...entry, mesh: add(this.root, surface(entry.canvas, 2.95, 0.59)) }))
    this.choose = add(this.root, type('这一次，由您提交。', 0.42, GOLD))
    this.shiftCanvas = document.createElement('canvas')
    this.shiftCanvas.width = SCREEN_W
    this.shiftCanvas.height = SCREEN_H
    this.shiftContext = this.shiftCanvas.getContext('2d')
    this.departmentRows = Array.from({ length: 4 }, (_, index) => cropPage(this.pages.departments, 379, 782 + index * 275, 638, 246))
  }

  buildProof() {
    this.proof = new CompilerProof(this.root, this.pages.result)
  }

  buildSignature() {
    this.brand = add(this.root, type('银龄智办', 0.95, INK), [0, 1.1, 1.0])
    this.signature = add(this.root, type('把复杂流程，编译成明白的一步。', 0.39, GOLD), [0, 0.35, 1.0])
    this.endDetail = add(this.root, type('流程被压缩。决定仍属于您。', 0.26, INK), [0, 0.10, 1.0])
  }

  update(time) {
    this.updatePhone(time)
    this.updateSource(time)
    this.updateLanguage(time)
    this.updateParser(time)
    this.updateConstraints(time)
    this.updateFamily(time)
    this.updateRuntime(time)
    this.updateProof(time)
    fade(this.brand, smooth01(time, 96.4, 1.8))
    fade(this.signature, smooth01(time, 97.0, 1.8))
    fade(this.endDetail, smooth01(time, 98.0, 1.8))
    const pose = this.camera.apply(time, this.stage.camera, this.stage.rig, { handheld: 0 })
    this.stage.setFocus(pose.pos.distanceTo(pose.look), 0.000025, 0.001)
    this.stage.setExposure(1.0)
    this.stage.studio.background.material.uniforms.warmth.value = 0.25 + smooth01(time, 31, 7) * 0.50
  }

  updatePhone(time) {
    place(this.phone, time, [
      [0, 0, -0.36, 0, 1.65], [3, 0, -0.36, 0, 1.65], [9, 0, -0.2, 0.3, 2.0],
      [16, -5.6, -0.1, -2, 1.5, 0, 0.2], [50, -5.6, -0.1, -2, 1.5, 0, 0.2],
      [57, 1.1, 0.22, 0, 2.10, 0, -0.12], [64, 1.1, 0.22, 0, 2.10],
      [75, 1.1, 0.22, 0, 2.10], [78.5, -3.1, 0.15, -0.5, 1.8, 0, 0.22],
      [90.5, -3.1, 0.15, -0.5, 1.8, 0, 0.22], [94.0, 0, -0.3, 0.2, 1.7],
      [99, 0, -1.03, 0, 1.25],
    ])
    const opacity = (1 - smooth01(time, 13, 3)) + smooth01(time, 54.0, 2)
    fade(this.phone, Math.min(1, opacity))
    const context = this.view.g
    context.drawImage(this.pages.home, 0, 0, SCREEN_W, SCREEN_H)
    for (const [start, kind] of [[56.8, 'departments'], [62.4, 'doctors'], [64.1, 'dates'], [66.3, 'review'], [74.5, 'waiting'], [77.8, 'result']]) {
      const amount = smooth01(time, start, 0.6)
      if (!amount) continue
      context.save()
      context.globalAlpha = amount
      context.drawImage(this.pages[kind], 0, 0, SCREEN_W, SCREEN_H)
      context.restore()
    }
    if (time >= 59 && time < 62.5) {
      this.paintMovedRows(time)
      context.save()
      context.globalAlpha = windowAt(time, 59, 62.0, 0.4, 0.5)
      context.drawImage(this.shiftCanvas, 0, 0, SCREEN_W, SCREEN_H)
      context.restore()
    }
    const label = time < 3.4 ? '正在听…' : time < 54 ? '银龄' : time < 60 ? '正在办…' : time < 66.5 ? '正在核对…' : time < 74.5 ? '请您核对' : time < 94.3 ? '正在核验…' : '已提交 · 待确认'
    floatingPill(context, time, 1, { label, working: false })
    this.view.commitNow()
    this.phone.updateMatrixWorld(true)
  }

  paintMovedRows(time) {
    const context = this.shiftContext
    context.clearRect(0, 0, SCREEN_W, SCREEN_H)
    context.drawImage(this.pages.departments, 0, 0, SCREEN_W, SCREEN_H)
    context.fillStyle = '#f0f4ef'
    context.fillRect(365, 775, 670, 1110)
    const movement = smooth01(time, 59.5, 1.1)
    for (let index = 0; index < 4; index++) {
      const offset = index === 0 ? 275 * movement : index === 1 ? -275 * movement : 0
      context.drawImage(this.departmentRows[index], 379, 782 + index * 275 + offset, 638, 246)
    }
  }

  updateSource(time) {
    const expansion = smooth01(time, 3.1, 5.8)
    const spread = smooth01(time, 9, 5.5)
    const parse = windowAt(time, 15.0, 24.3, 3.0, 2.8)
    const scatter = smooth01(time, 28.1, 5.8)
    const returnAmount = smooth01(time, 95.3, 4.5)
    this.source.forEach((entry, index) => {
      const stack = [0.05 * index, -0.23, -0.10 - index * (0.07 + expansion * 0.90)]
      const flat = [(index - 2.5) * 1.91, 0.12 + Math.sin(index * 0.8) * 0.08, -1.1 - Math.abs(index - 2.5) * 0.07]
      const parsed = index === 1 ? [-1.65, 0.12, 0] : [flat[0] * 1.4, flat[1], -5.8]
      const horizontal = lerp(lerp(stack[0], flat[0], spread), parsed[0], parse)
      const vertical = lerp(lerp(stack[1], flat[1], spread), parsed[1], parse)
      const depth = lerp(lerp(stack[2], flat[2], spread), parsed[2], parse)
      const compression = 1 - returnAmount
      entry.root.position.set(lerp(horizontal, 0, returnAmount), lerp(vertical, -1.02, returnAmount), lerp(depth, -0.25 - index * 0.028, returnAmount))
      entry.root.rotation.set(-returnAmount * 0.05, lerp(expansion * (1 - spread) * -0.10, index === 1 ? -0.08 : (index - 2.5) * -0.025, parse), (index - 2.5) * -0.008 * spread * compression)
      entry.root.scale.setScalar(lerp(lerp(0.70, 1, expansion) + parse * (index === 1 ? -0.06 : 0), 0.45, returnAmount))
      const normal = windowAt(time, 3.2 + index * 0.12, 32.8, 0.7, 1.7) * (1 - parse * (index === 1 ? 0 : 1))
      const returned = windowAt(time, 95.3, 100.5, 1.6, 1.5) * 0.50
      const opacity = Math.max(normal, returned)
      fade(entry.root, opacity)
      fade(entry.heading, opacity * (1 - scatter) * (1 - returnAmount) * (index === 1 ? 1 - parse : 1))
      fade(entry.footer, opacity * (1 - scatter) * (1 - returnAmount))
      bendPage(entry, expansion * (1 - scatter), scatter * (1 - smooth01(time, 92, 4)), time)
    })
    this.spine.reveal(smooth01(time, 25.5, 8.0))
    fade(this.spine.mesh, windowAt(time, 25, 40.0, 2, 1.2))
  }

  updateLanguage(time) {
    fade(this.utterance, windowAt(time, 1.7, 5.8, 1.0, 1.3))
    this.utterance.position.y = 1.37 + smooth01(time, 4, 3) * 0.25
    fade(this.asr, windowAt(time, 2.7, 5.0, 0.8, 0.8))
    fade(this.waves, windowAt(time, 0, 1.4, 0.5, 0.7))
    this.bars.forEach((bar, index) => {
      bar.scale.y = 0.8 + (Math.sin(time * 6.5 + index * 0.79) * 0.5 + 0.5) * Math.sin((index + 1) / 44 * Math.PI) * 5.0
    })
    fade(this.masthead, windowAt(time, 10.5, 16.6, 1.6, 1.5))
  }

  updateParser(time) {
    const amount = windowAt(time, 16.3, 25.1, 1.9, 1.5)
    this.structure.position.set(1.45, 0.10, 0.1)
    this.structure.rotation.y = -0.10 + smooth01(time, 18, 6) * 0.06
    fade(this.structure, amount)
    this.pixelLabel.position.set(-1.65, 2.22, 0.1)
    fade(this.pixelLabel, amount)
    const origin = this.source[1].root
    origin.updateMatrixWorld(true)
    const target = origin.localToWorld(new THREE.Vector3((698 / SCREEN_W - 0.5) * PAGE_WIDTH, (0.5 - 905 / SCREEN_H) * PAGE_HEIGHT, 0.028))
    this.rowSelection.position.copy(target)
    this.rowSelection.rotation.copy(origin.rotation)
    this.rowSelection.scale.copy(origin.scale)
    fade(this.rowSelection, windowAt(time, 19.8, 25.2, 1.2, 1.0))
    fade(this.correspondence.mesh, windowAt(time, 20.0, 25.5, 1.0, 1.0))
    this.correspondence.reveal(smooth01(time, 20, 2.4))
    fade(this.sameTarget, windowAt(time, 21.3, 25.5, 1.0, 1.0))
  }

  updateConstraints(time) {
    const origins = [
      [-2.85 + (698 / SCREEN_W - 0.5) * PAGE_WIDTH, 0.12 + (0.5 - 905 / SCREEN_H) * PAGE_HEIGHT, -0.97],
      [0.955, 0.12 + (0.5 - 886 / SCREEN_H) * PAGE_HEIGHT, -0.97],
      [-0.955, 0.12 + (0.5 - 986 / SCREEN_H) * PAGE_HEIGHT, -0.97],
    ]
    this.constraints.forEach((entry, index) => {
      const extract = smooth01(time, 26.0 + index * 0.40, 4.1)
      const recall = smooth01(time, 50.5, 1.5)
      const bind = smooth01(time, 54.0, 2.8)
      const final = [(index - 1) * 2.75, 0.15, 0.95]
      entry.root.position.set(...origins[index].map((value, axis) => lerp(value, final[axis], extract)))
      entry.root.position.lerp(new THREE.Vector3((index - 1) * 1.8, 1.8, 0.9), recall)
      entry.root.position.lerp(new THREE.Vector3(1.1, 1.5, 0.15), bind)
      entry.root.scale.setScalar(lerp(lerp(0.86, 1.0, extract), 0.55, recall) * (1 - bind * 0.90))
      entry.root.rotation.set(0, (1 - extract) * 0.15, (1 - extract) * -0.05)
      const opacity = index === 2 ? windowAt(time, 26.8, 57, 1, 0.8) : Math.max(windowAt(time, 26 + index * 0.4, 39, 1, 1), windowAt(time, 52.6, 57, 0.8, 0.8))
      const known = index < 2 ? 1 - smooth01(time, 37.3, 1.0) : 1
      fade(entry.root, opacity * known)
      if (index < 2) fade(entry.title, 0)
    })
    const resolution = smooth01(time, 52, 1.1)
    fade(this.constraints[2].title, (1 - resolution) * windowAt(time, 27, 39.1, 1, 0.8))
    fade(this.hole, (1 - resolution) * windowAt(time, 27.5, 40.5, 0.8, 0.6))
    const outlineOpacity = Math.max(windowAt(time, 27, 41.7, 1, 0.7), windowAt(time, 52, 57, 1, 0.8))
    fade(this.constraints[2].outline, outlineOpacity)
    fade(this.constraints[2].kicker, outlineOpacity)
    fade(this.resolved, resolution * windowAt(time, 51, 57, 1, 0.8))
    fade(this.valueDoctor, resolution * windowAt(time, 51, 57, 1, 0.8))
    const portal = windowAt(time, 38.8, 43.0, 1.0, 0.8)
    const doctor = this.constraints[2].root
    doctor.scale.x *= 1 + portal * 0.08
    fade(this.kept, windowAt(time, 29.6, 37.9, 1, 0.8))
    fade(this.removed, windowAt(time, 27.5, 33.0, 1.0, 1.3))
    this.removed.position.z = lerp(0.2, -2, smooth01(time, 29, 5))
  }

  updateFamily(time) {
    const entry = smooth01(time, 41.4, 2.2)
    const split = smooth01(time, 44.8, 2.6)
    place(this.familyRequest, time, [
      [0, 2.75, 0.15, -3.4, 0.37], [41, 2.75, 0.15, -3.4, 0.37],
      [44.5, 0, 0.05, 0, 1], [47.5, -2.1, 0.12, -0.2, 0.68, 0, 0.07],
      [50, -2.7, 0.12, -1.0, 0.58, 0, 0.12],
    ])
    fade(this.familyRequest, smooth01(time, 40.2, 1.5) * windowAt(time, 39.8, 49.5, 0.7, 1.2))
    place(this.familyCompose, time, [[0, 3.8, 0.12, -0.1, 0.9, 0, -0.14], [44.8, 3.8, 0.12, -0.1, 0.9, 0, -0.14], [47.5, 2.0, 0.12, 0, 1, 0, -0.03]])
    fade(this.familyCompose, split * windowAt(time, 44.8, 49.5, 1.0, 1.2))
    place(this.familyMessage, time, [[0, 2.0, 0.30, 0.02, 0.68], [48.5, 2.0, 0.30, 0.02, 0.68], [50.7, 0, 0.55, 0.8, 1]])
    fade(this.familyMessage, windowAt(time, 48.5, 51.2, 1.2, 1.0))
    place(this.familyRead, time, [[0, 0, 0.40, 0.75, 1], [51.7, 0, 0.40, 0.75, 1], [54.6, 1.1, 1.4, 0.2, 0.18]])
    fade(this.familyRead, windowAt(time, 50.9, 54.2, 0.9, 0.8))
    this.familyCaption.position.set(lerp(0, -1.5, split), 2.24, 0.15)
    fade(this.familyCaption, windowAt(time, 43.5, 49.8, 1, 1))
    fade(this.elderReply, windowAt(time, 51.4, 54.3, 0.8, 0.8))
  }

  phonePoint(horizontal, vertical) {
    return this.phone.localToWorld(new THREE.Vector3(
      (horizontal / SCREEN_W - 0.5) * (PHONE.w - PHONE.bezel * 2),
      (0.5 - vertical / SCREEN_H) * (PHONE.h - PHONE.bezel * 2),
      PHONE_Z.screen + 0.012,
    ))
  }

  updateRuntime(time) {
    place(this.skill, time, [[0, -4.4, 1.15, -0.9, 1, 0, 0.16], [54.7, -4.4, 1.15, -0.9, 1, 0, 0.16], [56.5, -1.9, 1.10, 0.7, 1, 0, 0], [59.5, 0.95, 1.45, 0.15, 0.12]])
    fade(this.skill, windowAt(time, 54.8, 59.0, 1, 0.8))
    this.instructions.forEach((object, index) => {
      object.position.set(-1.85, 0.30, 0.50)
      const starts = [58.0, 60.6, 64.0]
      const ends = [60.2, 63.5, 67.1]
      fade(object, windowAt(time, starts[index], ends[index], 0.6, 0.6))
    })
    this.reobserve.position.set(-1.85, -1.00, 0.5)
    fade(this.reobserve, windowAt(time, 58.0, 67.0, 1.0, 0.8))
    const moved = smooth01(time, 59.5, 1.1)
    const old = this.phonePoint(698, 905)
    const current = this.phonePoint(698, 905 + 275 * moved)
    this.oldTarget.position.copy(old)
    this.liveTarget.position.copy(current)
    this.oldTarget.quaternion.copy(this.phone.quaternion)
    this.liveTarget.quaternion.copy(this.phone.quaternion)
    fade(this.oldTarget, windowAt(time, 59.4, 61.6, 0.5, 0.6) * 0.35)
    fade(this.liveTarget, windowAt(time, 59.0, 62.0, 0.5, 0.6))
    this.bindText.position.copy(current).add(new THREE.Vector3(0.3, -0.42, 0.14))
    fade(this.bindText, windowAt(time, 60.5, 62.1, 0.5, 0.5))
    const tapPoint = time < 66 ? this.phonePoint(550, 1730) : this.phonePoint(550, 1992)
    this.tap.position.copy(tapPoint)
    this.tap.quaternion.copy(this.phone.quaternion)
    this.tap.scale.setScalar(1.0 + Math.sin(smooth01(time, 73.1, 1.0) * Math.PI) * 0.3)
    fade(this.tap, Math.max(windowAt(time, 65.3, 66.1, 0.3, 0.4), windowAt(time, 73.2, 74.2, 0.3, 0.4)))
    const spread = windowAt(time, 67.8, 73.6, 1.4, 0.9)
    this.reviewPieces.forEach((entry, index) => {
      const origin = this.phonePoint(540, entry.top + 96)
      const destination = new THREE.Vector3(-0.95, 1.1 - index * 0.82, 0.5)
      entry.mesh.position.copy(origin).lerp(destination, spread)
      entry.mesh.quaternion.copy(this.phone.quaternion).slerp(new THREE.Quaternion(), spread)
      entry.mesh.scale.setScalar(lerp(0.45, 1, spread))
      fade(entry.mesh, windowAt(time, 67.8, 73.8, 0.9, 0.9))
    })
    this.choose.position.set(-1.8, -0.98, 0.60)
    fade(this.choose, 0)
  }

  updateProof(time) {
    this.proof.update(time, this.phone, (horizontal, vertical) => this.phonePoint(horizontal, vertical))
  }
}
