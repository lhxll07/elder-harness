import * as THREE from 'three'
import { Chapter } from '../chapter.js'
import { CameraRig } from '../stage.js'
import { makePhone, makeGlow, PHONE_Z } from '../props.js'
import { PhoneView } from '../phoneview.js'
import { SCREEN_W, SCREEN_H } from '../screen.js'
import { smooth01 } from '../ease.js'
import { floatingPill } from './voice.js'
import { journeyPage, REVIEW_FIELDS } from './journey-ui.js'
import { MINT, AMBER, windowAt, panel, label, position, path, halo } from './journey-visuals.js'

const TITLES = {
  loop: '接过繁琐步骤，不替您决定', ladder: '拿不准，就停下来问一句',
  guard: '可信的人补信息，决定仍在您', handback: '最后这一按，留给本人',
  evidence: '系统说办完，不等于真的办成', teach: '触发推送，方法按需拉取',
  evolve: '候选经验，先验证再启用', coda: '银龄智办',
}
const START_PAGES = {
  loop: 'departments', ladder: 'doctors', guard: 'doctors', handback: 'review',
  evidence: 'waiting', teach: 'result', evolve: 'result', coda: 'result',
}
const END_LABELS = {
  loop: '等您回答一句', ladder: '已经找家人了', guard: '等您操作', handback: '等您操作',
  evidence: '待您确认', teach: '待您确认', evolve: '待您确认', coda: '待您确认',
}

export function buildJourney(context) {
  return new Journey(context)
}

class Journey extends Chapter {
  constructor(context) {
    super(context)
    this.kind = this.chapter.name
    this.duration = this.chapter.end - this.chapter.start
    this.phone = makePhone()
    this.phone.name = 'phone'
    this.phone.scale.setScalar(1.1)
    this.group.add(this.phone)
    this.view = new PhoneView(this.stage, this.phone)
    this.pages = Object.fromEntries(['departments', 'doctors', 'dates', 'review', 'waiting', 'result'].map((kind) => [kind, journeyPage(kind)]))
    this.items = {}
    this.billboards = []
    this.paths = []
    this.rings = []
    this.quaternion = new THREE.Quaternion()
    this.title = label(TITLES[this.kind], this.kind === 'coda' ? 0.50 : 0.22)
    this.group.add(this.title)
    this.billboards.push(this.title)
    this.pool = makeGlow({ color: MINT, size: 3.5, opacity: 0 })
    this.pool.position.set(0, 0.10, -0.70)
    this.group.add(this.pool)
    this.tap = makeGlow({ color: AMBER, size: 0.09, opacity: 0 })
    this.tap.position.set(0, -0.43, PHONE_Z.glass + 0.006)
    this.phone.add(this.tap)
    this.tapRing = halo(this.phone, 0.055, AMBER)
    this.tapRing.position.copy(this.tap.position)
    this.aperture = 0.00035
    this.maxBlur = 0.0020
    this._buildContent()
    this._buildCamera()
  }

  _panel(key, content) {
    const mesh = panel(content)
    this.items[key] = mesh
    this.group.add(mesh)
    this.billboards.push(mesh)
    return mesh
  }

  _label(key, content, height = 0.18, color = MINT) {
    const mesh = label(content, height, color)
    this.items[key] = mesh
    this.group.add(mesh)
    this.billboards.push(mesh)
    return mesh
  }

  _path(points, color, closed = false) {
    const flow = path(this.group, points, color, closed)
    this.paths.push(flow)
    return flow
  }

  _buildContent() {
    if (this.kind === 'loop') {
      this._panel('instruction', { kicker: '您说 / 已知的复诊科室', title: '普通内科', rows: ['和上次一样'], footer: '科室由本人提供，不由助手诊断', accent: '#d3aa74' })
      const nodes = [['observe', '01 / OBSERVE', '看当前页面'], ['decide', '02 / PLAN', '定下一步'], ['guard', '03 / GUARD', '本机校验'], ['again', '04 / OBSERVE', '操作后再看']]
      nodes.forEach(([key, kicker, title]) => this._panel(key, { kicker, title, width: 1.68, height: 0.72 }))
      this._panel('tool', { kicker: '本轮工具 / 概念控件编号', title: 'click(e12)', footer: '当前页唯一可操作目标 → 执行', width: 2.15, height: 0.68 })
      this.loopFlow = this._path([[-1.48, 0.65, 0.55], [0, 1.25, -0.10], [1.48, 0.65, 0.55], [1.48, -0.45, 0.68], [0, -0.82, 0.10], [-1.48, -0.45, 0.68]], MINT, true)
      this._label('next', '医生列表已打开，接着核对上次就诊信息', 0.19)
    } else if (this.kind === 'ladder') {
      this._panel('reversible', { kicker: '分级自主 / 可逆步骤', title: '流畅代办', rows: ['查找 · 翻页 · 填写'], footer: '已明确且不触及关键提交' })
      this._panel('uncertain', { kicker: '分级自主 / 信息不明', title: '问本人', rows: ['不猜医生，不猜日期'], footer: 'ask_user', accent: '#d3aa74' })
      this._panel('sensitive', { kicker: '分级自主 / 关键操作', title: '交还本人', rows: ['提交 · 付款 · 验证'], footer: 'ask_person', accent: '#d3aa74' })
      this._panel('question', { kicker: '助手问您 / ask_user', title: '上次是哪位医生？', rows: ['知道后，才继续选择'], width: 2.18, height: 1.04 })
      this._panel('answer', { kicker: '您说', title: '不记得了', rows: ['问问女儿'], footer: '助手不自行猜一个答案', accent: '#d3aa74' })
      this.stairFlow = this._path([[-1.58, -0.34, 0.38], [-1.0, -0.28, 0.38], [0, 0.22, 0.67], [0.8, 0.24, 0.67], [1.58, 0.80, 0.94]], AMBER)
    } else if (this.kind === 'guard') {
      this._panel('request', { kicker: '本人提出求助', title: '问问女儿', rows: ['我忘了上次的医生'], footer: '求助由本人发起', accent: '#d3aa74' })
      this._panel('family', { kicker: '已绑定亲友 / 文本回复', title: '上次陈医生', rows: ['仅补充既有就诊信息'], footer: '没有远程点按手机的权限', accent: '#9fb8cb', width: 2.05 })
      this._panel('consent', { kicker: '本人确认后再继续', title: '对，还是陈医生', rows: ['周四上午，好，继续'], footer: '亲友回复不会自动恢复任务', accent: '#d3aa74', width: 2.15 })
      this.familyFlow = this._path([[-1.5, 0.15, 0.5], [-1.05, 1.04, 0.65], [0, 1.05, 0.80], [1.55, 0.16, 0.75]], 0x9fb8cb)
      this._label('boundary', '亲友补信息 ≠ 远程控屏', 0.19, 0x9fb8cb)
    } else if (this.kind === 'handback') {
      REVIEW_FIELDS.forEach((field, index) => this._panel(`field${index}`, { ...field, width: 1.64, height: 0.70 }))
      this._panel('handover', { kicker: '关键提交 / ask_person', title: '请您亲自确认', rows: ['医院 · 医生 · 时间 · 费用'], footer: '助手停手，等待本人操作', accent: '#d3aa74', width: 2.22 })
      this._label('pressed', '本人点按提交，等待医院返回', 0.19, AMBER)
      this.rings.push(halo(this.group, 0.74, AMBER))
    } else if (this.kind === 'evidence') {
      this._panel('resume', { kicker: '本人操作后 / 明确继续核对', title: '我点好了', rows: ['帮我核对一下'], footer: '再次得到本人指令，才继续观察', accent: '#d3aa74' })
      this._panel('ledger0', { kicker: '本轮观察与工具记录 / 01', title: '观察与打开', rows: ['控件编号绑定当时页面'], width: 1.75, height: 0.83 })
      this._panel('ledger1', { kicker: '本轮工具记录 / 02', title: '交还本人', rows: ['ask_person · 助手已停手'], width: 1.75, height: 0.83, accent: '#d3aa74' })
      this._panel('local', { kicker: '核验顺序 / 本机先行', title: '记录、时序、证据', rows: ['文字输入不能自证成功', '无本轮证据 → 待核对'], footer: '机械一致性 + 本轮证据', width: 2.40, height: 1.36 })
      this._panel('model', { kicker: '仅本机通过后 / 模型复核', title: '不能推翻本机拒绝', rows: ['复核不等于外部业务回执'], width: 2.40, height: 1.12, accent: '#9fb8cb' })
      this._panel('status', { kicker: '本轮页面显示 / 状态分层', title: '已提交，待医院确认', rows: ['不是“预约成功”', '也不是“已完成支付”'], footer: '真实业务结果以医院正式回执为准', width: 2.6, height: 1.31, accent: '#d3aa74' })
      this.auditFlow = this._path([[-1.7, 0.40, 0.65], [-0.5, 1.3, 0.80], [1.4, 0.5, 0.78], [1.4, -0.38, 0.78]], MINT)
    } else if (this.kind === 'teach') {
      this._panel('trigger', { kicker: '常驻指令 / 轻量线索', title: '何时查经验', rows: ['应用 + 任务类别'], footer: '不把整套经验塞进每轮上下文', width: 2.02 })
      this._panel('method', { kicker: 'load_skill / 按需加载', title: '具体怎么做', rows: ['查入口 → 核对当前页', '方法不能越过安全策略'], width: 2.28, height: 1.21 })
      this._panel('candidate', { kicker: '任务经确认后 / 候选沉淀', title: '候选，不是新权限', rows: ['先审核、验证，才可启用'], footer: '经验不能提高工具权限', width: 2.65, height: 1.00, accent: '#d3aa74' })
      this.skillFlow = this._path([[-1.50, 0.50, 0.55], [-0.45, 1.1, 0.6], [0.70, 1.10, 0.75], [1.45, 0.35, 0.75], [0.45, -0.15, 0.80]], MINT)
      this._label('safety', '旧经验也要重新观察，不能重放旧坐标', 0.19)
    } else if (this.kind === 'evolve') {
      this._panel('t0', { kicker: 'T0 / 静态契约', title: '检查边界', rows: ['工具 · 参数 · 禁止动作'], footer: '契约 lint', width: 1.73, height: 1.01 })
      this._panel('t1', { kicker: 'T1 / 离线反事实', title: '检查误匹配', rows: ['无关任务不能误触发'], footer: 'requires 仅展示离线门禁', width: 1.73, height: 1.01 })
      this._panel('t2', { kicker: 'T2 / 冻结任务集', title: '等待实机回归', rows: ['门禁逻辑已有实现'], footer: '尚未执行 T2 实机回归', width: 1.73, height: 1.01, accent: '#d3aa74' })
      this._panel('version', { kicker: '不可变版本 / 可回退', title: '候选不会覆盖旧版', rows: ['保留证据、拒绝原因和版本', '验证记录随版本保留'], width: 2.6, height: 1.23, accent: '#9fb8cb' })
      this._label('limit', '实现门禁 ≠ 已通过实机验证', 0.18, AMBER)
      this.gateFlow = this._path([[-1.90, 0.4, 0.55], [-0.85, 0.43, 0.65], [0, 0.4, 0.75], [0.90, 0.40, 0.9], [1.90, 0.40, 1.0]], MINT)
    } else {
      this._label('promise', '把复杂留给系统，把决定留给本人', 0.24)
      this._label('principles', '办成有证据 · 帮忙有分寸', 0.23, AMBER)
      this._label('prototype', '安卓原型 · 流程与机制演示', 0.12, 0x8da5b1)
      this.rings.push(halo(this.group, 1.0, MINT), halo(this.group, 1.16, MINT))
    }
  }

  _buildCamera() {
    this.cameraRig = new CameraRig()
    const at = (local, point, look = [0, 0.30, 0.48], options = {}) => this.cameraRig.at(this.chapter.start + local, point, look, options)
    at(0, [0, 0.10, 4.45], [0, 0, 0])
    at(0.9, [0, 0.10, 4.45], [0, 0, 0])
    const positions = {
      loop: [[-1.0, 1.3, 6.4], [1.20, 0.72, 6.4]], ladder: [[-1.1, 1.45, 6.6], [1.15, 0.75, 6.5]],
      guard: [[-1.0, 0.80, 6.3], [0.9, 1.2, 6.4]], handback: [[-1.3, 1.5, 6.65], [0.65, 0.85, 6.5]],
      evidence: [[-0.95, 1.10, 6.5], [0.8, 0.9, 6.7]], teach: [[-0.8, 1.1, 6.5], [1.0, 0.8, 6.4]],
      evolve: [[-1.2, 1.2, 6.8], [1.0, 1.0, 6.8]], coda: [[0, 0.35, 4.80], [0, 0.10, 4.80]],
    }[this.kind]
    at(this.duration * 0.25, positions[0], [0, 0.30, 0.48], { fov: this.kind === 'coda' ? 34 : 40, roll: this.kind === 'coda' ? 0 : -1.5 })
    at(this.duration * 0.59, positions[1], [0, 0.25, 0.50], { fov: this.kind === 'coda' ? 34 : 40, roll: this.kind === 'coda' ? 0 : 1 })
    at(this.duration - 2.2, [0, 0.10, 4.45], [0, 0, 0])
    at(this.duration, [0, 0.10, 4.45], [0, 0, 0])
  }

  update(local, absolute, opacity) {
    this.local = local
    this.opacity = opacity
    this.phone.visible = true
    this.phone.position.set(0, 0, 0)
    this.phone.rotation.set(0, 0, 0)
    this.phone.scale.setScalar(1.1)
    this.pool.material.opacity = windowAt(local, 1.2, this.duration - 2.4) * opacity * 0.10
    this.tap.material.opacity = 0
    this.tapRing.material.opacity = 0
    this.tapRing.scale.setScalar(1)
    for (const mesh of Object.values(this.items)) mesh.userData.setOpacity(0)
    for (const flow of this.paths) flow.update(0, 0)
    for (const ring of this.rings) ring.material.opacity = 0
    const spread = windowAt(local, 1.2, this.duration - 3.8, 1.2, 1.2)
    this.title.position.set(0, 1.08 + spread * 0.45, 0.28)
    this.title.userData.setOpacity(windowAt(local, 0.85, this.duration - 1.1) * opacity)
    this.pageState = { first: START_PAGES[this.kind], second: null, blend: 0 }
    this.status = { label: END_LABELS[this.kind], working: false }
    this[`_${this.kind}`](local, opacity, spread)
    this._drawScreen(local)
  }

  _show(key, point, opacity, scale = 1) {
    position(this.items[key], point, opacity * this.opacity, scale)
  }

  _page(first, second, local, start, duration = 0.7) {
    this.pageState = { first, second, blend: smooth01(local, start, duration) }
  }

  _loop(local, opacity) {
    this._show('instruction', [-1.45, 0.14, 0.32], windowAt(local, 0.7, 3.8))
    const open = windowAt(local, 3.8, 14.8, 1.15, 1.25)
    const nodes = [['observe', -1.62, 0.69], ['decide', 1.62, 0.69], ['guard', 1.62, -0.39], ['again', -1.62, -0.39]]
    nodes.forEach(([key, horizontal, vertical], index) => {
      const arrival = smooth01(local, 3.85 + index * 0.30, 0.60)
      const active = windowAt(local, 5.0 + index * 1.7, 6.2 + index * 1.7, 0.3, 0.3)
      this._show(key, [horizontal * open, vertical * open, 0.35 + open * 0.30], open * arrival * (0.70 + active * 0.30), 0.75 + 0.25 * open)
    })
    this.loopFlow.update(Math.max(0, (local - 5.0) / 7.2), open * opacity)
    this._show('tool', [0, 1.20, 0.70], windowAt(local, 8.3, 11.5))
    this._show('next', [0, 1.08, 0.16], windowAt(local, 15.4, 17.95))
    this.title.userData.setOpacity(windowAt(local, 0.85, 14.8) * (1 - windowAt(local, 8.0, 12.1)) * opacity)
    const tap = windowAt(local, 10.35, 10.85, 0.12, 0.18)
    this.tap.position.set(0.105, 0.21, PHONE_Z.glass + 0.006)
    this.tapRing.position.copy(this.tap.position)
    this.tap.material.opacity = tap
    this.tapRing.material.opacity = tap * 0.75
    this.tapRing.scale.setScalar(0.6 + smooth01(local, 10.35, 0.6) * 1.7)
    this._page('departments', 'doctors', local, 10.9)
    this.status = local < 1.0 ? { label: '正在办', working: true }
      : local < 3.85 ? { label: '正在听…', working: false }
      : local < 12.6 ? { label: '正在办', working: true } : { label: '等您回答一句', working: false }
  }

  _ladder(local, opacity) {
    const open = windowAt(local, 1.4, 7.6, 1.2, 0.8)
    this.phone.position.y = -open * 0.42
    this.phone.scale.setScalar(1.1 - open * 0.23)
    const steps = [['reversible', -1.65, -0.24, 0.38], ['uncertain', 0, 0.27, 0.67], ['sensitive', 1.65, 0.78, 0.96]]
    steps.forEach(([key, horizontal, vertical, depth], index) => {
      const arrive = smooth01(local, 1.4 + index * 0.45, 0.7)
      this._show(key, [horizontal * open, vertical, depth], open * arrive, 0.85 + open * 0.15)
    })
    this.stairFlow.update((local - 2) / 6, open * opacity)
    this._show('question', [-1.48, 0.27, 0.65], windowAt(local, 7.8, 11.9))
    this._show('answer', [1.45, 0.14, 0.57], windowAt(local, 11.55, 15.0))
    this.status = { label: local < 14.9 ? '等您回答一句' : '已经找家人了', working: false }
  }

  _guard(local, opacity) {
    this._show('request', [-1.55, 0.24, 0.55], windowAt(local, 0.85, 5.0))
    this._show('family', [0.10, 0.85, 0.80], windowAt(local, 3.9, 8.2))
    this._show('consent', [1.46, 0.08, 0.67], windowAt(local, 7.5, 11.1))
    this.familyFlow.update((local - 2.4) / 7.2, windowAt(local, 2.2, 10.4) * opacity)
    this._show('boundary', [0, -0.98, 0.20], windowAt(local, 4.0, 10.5))
    if (local < 10.9) this._page('doctors', 'dates', local, 9.7, 0.7)
    else this._page('dates', 'review', local, 11.15, 0.8)
    this.status = local < 3.9 ? { label: '已经找家人了', working: false }
      : local < 8.0 ? { label: '家人留言', working: false }
      : local < 9.7 ? { label: '正在听…', working: false }
      : local < 12.0 ? { label: '正在办', working: true } : { label: '等您操作', working: false }
  }

  _handback(local, opacity) {
    const open = windowAt(local, 1.35, 10.7, 1.8, 1.35)
    const points = [[-1.78, 0.80, 0.65], [1.78, 0.80, 0.65], [-1.78, -0.15, 0.67], [1.78, -0.15, 0.67], [0, 1.37, 0.71]]
    points.forEach((point, index) => {
      const arrive = smooth01(local, 1.5 + index * 0.36, 0.8)
      this._show(`field${index}`, [point[0] * open, point[1] * open, point[2] * open], open * arrive, 0.7 + open * 0.3)
    })
    this.title.position.y = 1.08 + open * 1.00
    this._show('handover', [1.47, 0.20, 0.38], windowAt(local, 11.5, 15.5))
    this._show('pressed', [0, 1.08, 0.18], windowAt(local, 16.1, 18.1))
    this.title.userData.setOpacity(windowAt(local, 0.85, 15.4) * opacity)
    this.rings[0].position.set(0, -0.32, 0.18)
    this.rings[0].scale.set(0.57, 0.28, 1)
    this.rings[0].material.opacity = windowAt(local, 10.8, 15.6) * opacity * 0.5
    const tap = windowAt(local, 15.5, 16.12, 0.14, 0.2)
    this.tap.position.set(0, -0.53, PHONE_Z.glass + 0.006)
    this.tapRing.position.copy(this.tap.position)
    this.tap.material.opacity = tap
    this.tapRing.material.opacity = tap * 0.8
    this.tapRing.scale.setScalar(0.65 + smooth01(local, 15.5, 0.65) * 2.2)
    this._page('review', 'waiting', local, 16.12)
    this.status = { label: '等您操作', working: false }
  }

  _evidence(local, opacity) {
    this._show('resume', [-1.48, 0.18, 0.45], windowAt(local, 0.6, 2.8))
    this._show('ledger0', [-1.70, 0.67, 0.62], windowAt(local, 3.05, 10.2))
    this._show('ledger1', [-1.70, -0.31, 0.63], windowAt(local, 4.0, 10.2))
    this._show('local', [1.49, 0.34, 0.78], windowAt(local, 3.5, 8.0))
    this._show('model', [1.49, 0.34, 0.78], windowAt(local, 8.25, 11.65))
    this._show('status', [1.47, 0.31, 0.65], windowAt(local, 12.0, 15.5))
    this.auditFlow.update((local - 3.2) / 7.0, windowAt(local, 3.2, 11.3) * opacity)
    this._page('waiting', 'result', local, 6.0, 0.8)
    this.status = local < 0.8 ? { label: '等您操作', working: false }
      : local < 3.1 ? { label: '正在听…', working: false }
      : local < 11.8 ? { label: '正在办', working: true } : { label: '待您确认', working: false }
  }

  _teach(local, opacity) {
    const open = windowAt(local, 1.25, 10.8, 1.3, 1.0)
    this.phone.position.set(-open * 0.35, -open * 0.28, -open * 0.18)
    this.phone.scale.setScalar(1.1 - open * 0.20)
    this._show('trigger', [-1.49, 0.64, 0.55], windowAt(local, 1.1, 6.1))
    this._show('method', [1.47, 0.51, 0.77], windowAt(local, 4.0, 8.5))
    this._show('candidate', [1.07, 0.19, 0.83], windowAt(local, 8.4, 11.1))
    this.skillFlow.update((local - 2) / 7.8, windowAt(local, 2.0, 10.5) * opacity)
    this._show('safety', [0, 1.27, 0.27], windowAt(local, 5.0, 10.8))
  }

  _evolve(local, opacity) {
    const open = windowAt(local, 1.0, 8.6, 1.3, 0.8)
    this.phone.position.y = -open * 0.43
    this.phone.scale.setScalar(1.1 - open * 0.25)
    const gates = [['t0', -1.98, 0.45, 0.55], ['t1', 0, 0.45, 0.75], ['t2', 1.98, 0.45, 0.95]]
    gates.forEach(([key, horizontal, vertical, depth], index) => {
      const arrive = smooth01(local, 1.3 + index * 1.0, 0.8)
      this._show(key, [horizontal, vertical, depth], open * arrive, 0.85 + open * 0.15)
    })
    this.gateFlow.update(Math.min(0.86, Math.max(0, (local - 2.0) / 7)), open * opacity)
    this._show('limit', [0, 1.13, 0.25], windowAt(local, 4.1, 8.4))
    this._show('version', [1.40, 0.33, 0.68], windowAt(local, 8.9, 11.8))
  }

  _coda(local, opacity) {
    const unfold = smooth01(local, 0.5, 1.8)
    this.phone.position.set(-1.67 * unfold, -0.16 * unfold, -0.18 * unfold)
    this.phone.rotation.y = unfold * 0.10
    this.phone.scale.setScalar(1.1 - unfold * 0.45)
    this.title.position.set(0, 0.34, 0.85)
    this.title.userData.setOpacity(smooth01(local, 0.65, 1.35) * opacity)
    this._show('promise', [0, -0.10, 0.88], smooth01(local, 1.9, 0.85))
    this._show('principles', [0, -0.49, 0.89], smooth01(local, 2.8, 0.85))
    this._show('prototype', [0, -0.71, 0.90], smooth01(local, 3.8, 0.7))
    this.pool.position.set(0, 0.28, -0.1)
    this.pool.material.opacity = unfold * opacity * 0.14
    this.rings.forEach((ring, index) => {
      ring.position.set(0, 0.26, 0.1 - index * 0.35)
      ring.rotation.set(unfold * 0.15, unfold * (0.30 + index * 0.15), 0)
      ring.scale.setScalar(0.8 + unfold * 0.4)
      ring.material.opacity = windowAt(local, 0.8 + index * 0.2, 6.0) * opacity * 0.2
    })
  }

  _drawScreen(local) {
    const { first, second, blend } = this.pageState
    const context = this.view.g
    context.drawImage(this.pages[first], 0, 0, SCREEN_W, SCREEN_H)
    if (second && blend > 0) {
      context.save()
      context.globalAlpha = blend
      context.drawImage(this.pages[second], (1 - blend) * SCREEN_W * 0.06, 0, SCREEN_W, SCREEN_H)
      context.restore()
    }
    floatingPill(context, this.chapter.start + local - 44, 1, this.status)
    this.view.commitNow()
  }

  afterCamera(camera) {
    camera.getWorldQuaternion(this.quaternion)
    for (const mesh of this.billboards) mesh.quaternion.copy(this.quaternion)
  }
}
