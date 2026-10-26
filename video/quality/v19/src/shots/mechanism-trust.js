import * as THREE from 'three'
import { COLOR, caption, attach, canvasSurface, drawing, write, solid, wire, envelope, gate, packet, book, cross, travel, windowAt, smooth01, clamp01 } from './mechanism-geometry.js'

const familyAssets = Object.fromEntries(await Promise.all(['overview', 'request', 'contacts', 'compose', 'submitted', 'delivered', 'read'].map(async (name) => {
  const image = new Image()
  image.src = `/assets/family/${name}.png`
  await image.decode()
  return [name, image]
})))

function webSurface(name, width) {
  const image = familyAssets[name]
  return canvasSurface(image, width, width * image.height / image.width, 0xbec9c4)
}

export function buildTrustMechanism(chapter) {
  if (chapter.kind === 'guard') buildFamily(chapter)
  else buildEvidence(chapter)
}

function buildFamily(chapter) {
  chapter.titleY = 2.40
  const overview = attach(chapter.group, webSurface('overview', 4.10), [-0.20, -0.12, 0.0])
  overview.rotation.y = -0.09
  const request = attach(chapter.group, webSurface('request', 2.78), [-1.27, 0.27, 0.25])
  const contacts = attach(chapter.group, webSurface('contacts', 1.68), [1.30, 0.48, 0.33])
  const composer = attach(chapter.group, webSurface('compose', 1.77), [0.88, 0.25, 0.45])
  const connection = chapter.text('手机联系 ≠ 健康监测', [-0.65, 2.04, 0.2], 0.16, COLOR.amber)
  const claimed = chapter.text('“我来处理”只是接手，不是办成', [-0.55, -1.12, 0.4], 0.18, COLOR.amber)
  const privacy = chapter.text('求助背景只向家人展开', [-1.23, 1.22, 0.4], 0.14, COLOR.blue)
  const notInstruction = chapter.text('留言是给本人看的信息，不进入 Agent 任务指令', [0, -1.21, 0.45], 0.16, COLOR.amber)
  const receipts = ['submitted', 'delivered', 'read'].map((name, index) => {
    const root = attach(chapter.group, new THREE.Group(), [-1.74 + index * 1.74, 0.21, 0.4])
    attach(root, envelope(), [0, 0.57, 0])
    attach(root, webSurface(name, 1.53), [0, -0.12, 0.06])
    attach(root, caption(['01 提交', '02 到手机', '03 本人已读'][index], 0.16, index === 2 ? COLOR.mint : COLOR.amber), [0, 0.88, 0.05])
    return root
  })
  const distinct = chapter.text('三种状态分开记录：提交 ≠ 送达 ≠ 已读', [0, -1.00, 0.45], 0.20)
  const delivered = attach(chapter.group, envelope())
  const flight = wire(chapter.group, [[0.80, 0.4, 0.5], [1.3, 1.12, 0.95], [2.35, 0.61, 0.10]], COLOR.amber)
  const message = chapter.text('女儿：上次陈医生，您再核对一下', [-0.70, 0.41, 0.45], 0.20, COLOR.amber)
  const reply = chapter.text('本人：是陈医生，周四上午，继续', [-0.60, -0.05, 0.5], 0.21)
  const control = chapter.text('不远程点按 · 不自动续办 · 本人确认才恢复', [0, -0.80, 0.45], 0.17, COLOR.blue)
  const demo = chapter.text('真实模板 · 示例数据', [1.28, 1.34, 0.1], 0.10, COLOR.blue)
  chapter.camera([
    [3.1, [-0.65, 1.05, 9.0], [0, 0.08, 0], 38, -2],
    [5.0, [0.65, 0.4, 8.1], [-0.10, -0.04, 0], 36],
    [7.6, [-0.74, 0.63, 6.55], [-0.40, 0.13, 0.3], 37, -2],
    [11.0, [0.90, 0.40, 5.90], [0.20, 0, 0.2], 36, 2],
    [14.8, [0.05, 0.8, 7.25], [0, 0.10, 0.4], 36],
    [18.3, [0.15, 0.35, 6.35], [0.25, 0, 0], 36, -1],
    [19.7, [0, 0.20, 5.20], [0, 0, 0], 35],
  ])
  chapter.animate = (local) => {
    chapter.title.position.y = 1.06 + smooth01(local, 1.5, 2.0) * 1.34 - smooth01(local, 5.6, 0.9) * 0.86
    chapter.pose(local, [2.70, -0.28, -0.16], 0.76, [0, -0.21, 0], 18.2)
    const receiptSpace = windowAt(local, 12.5, 16.5, 0.8, 0.5)
    chapter.phone.position.y -= receiptSpace * 0.55
    chapter.phone.scale.multiplyScalar(1 - receiptSpace * 0.14)
    chapter.show(overview, windowAt(local, 1.8, 5.8, 1.1, 0.7))
    chapter.show(connection, windowAt(local, 3.0, 5.5))
    const requests = windowAt(local, 6.0, 12.2, 0.7, 0.5)
    request.scale.setScalar(1 - smooth01(local, 9.5, 1) * 0.15)
    chapter.show(request, requests)
    chapter.show(contacts, windowAt(local, 6.3, 9.7))
    chapter.show(claimed, windowAt(local, 6.7, 9.3))
    chapter.show(privacy, windowAt(local, 6.3, 9.4))
    chapter.show(composer, windowAt(local, 9.9, 12.3))
    chapter.show(notInstruction, windowAt(local, 10.0, 12.4))
    receipts.forEach((root, index) => chapter.show(root, windowAt(local, 12.6 + index * 0.60, 16.3, 0.65, 0.5)))
    chapter.show(distinct, windowAt(local, 13.5, 16.1))
    chapter.show(demo, windowAt(local, 6.0, 16.1))
    travel(delivered, [[0.80, 0.40, 0.5], [1.3, 1.12, 0.95], [2.35, 0.61, 0.10]], local, 16.1, 1.4)
    delivered.rotation.z = Math.sin(clamp01((local - 16.1) / 1.4) * Math.PI) * -0.22
    chapter.show(delivered, windowAt(local, 16.0, 17.7, 0.4, 0.4))
    flight.update((local - 16.1) / 1.4, windowAt(local, 16.0, 17.7) * chapter.env)
    chapter.show(message, windowAt(local, 17.2, 18.8))
    chapter.show(reply, windowAt(local, 18.0, 19.4))
    chapter.show(control, windowAt(local, 17.4, 19.3))
    if (local < 18.6) chapter.page('doctors')
    else if (local < 20.0) chapter.page('doctors', 'dates', local, 18.6, 0.8)
    else chapter.page('dates', 'review', local, 20.0, 0.8)
    chapter.status = { label: local < 17.1 ? '已经找家人了' : local < 18.5 ? '家人留言' : local < 20.0 ? '正在办' : '等您操作', working: local >= 18.5 && local < 20.0 }
  }
}

function ledgerPage(heading, entries, color = '#8abdab') {
  return drawing(1.70, 0.92, (context, width, height) => {
    context.fillStyle = '#29444b'
    context.fillRect(0, 0, width, height)
    write(context, heading, 0.10, 0.13, 0.093, color)
    entries.forEach((entry, index) => write(context, entry, 0.10, 0.34 + index * 0.19, 0.073))
    context.strokeStyle = '#5d817d'
    context.lineWidth = 0.004
    context.strokeRect(0.04, 0.04, width - 0.08, height - 0.08)
  })
}

function buildEvidence(chapter) {
  const ledger = attach(chapter.group, new THREE.Group())
  const actions = attach(ledger, book('动作账', COLOR.mint, 0.74, 1.02), [-1.46, 0.02, -0.10])
  actions.userData.cover.rotation.y = -Math.PI
  const observationBook = attach(ledger, book('证据账', COLOR.blue, 0.74, 1.02), [0.52, 0.02, -0.1])
  observationBook.userData.cover.rotation.y = -Math.PI
  const actionPaper = attach(ledger, ledgerPage('tool_call_id → tool result', ['c17 · click(e31) → success', 'c18 · ask_person → 已交还本人', '只记助手工具，不记录本人触摸']), [-1.12, 0.0, 0.28])
  const observationPaper = attach(ledger, ledgerPage('PAGE / app / revision / step', ['医院 · r23 · step 12', '已提交 · 待医院确认', '本轮独立页面观察'], '#80a5bc'), [0.91, 0.0, 0.30])
  const ledgerLink = wire(ledger, [[-1.12, -0.54, 0.34], [-0.1, -0.85, 0.7], [0.91, -0.54, 0.36]], COLOR.blue)
  const sequence = chapter.text('先对动作与返回，再对事实来源与时序', [-0.08, -1.12, 0.50], 0.18)
  const resume = chapter.text('本人：我点好了，帮我核对一下', [-0.24, 0.63, 0.6], 0.21, COLOR.amber)
  const selfTyped = attach(chapter.group, ledgerPage('SELF_TYPED / 输入值', ['input_text("20")', '输入框再读到“20”', '自产文字不是独立事实'], '#d3aa74'), [-1.05, 0.07, 0.4])
  const excluded = attach(chapter.group, cross(0.25), [0.28, 0.10, 0.7])
  const sourceRule = chapter.text('同一个数字，也必须核对字段、单位和来源', [-0.43, -1.08, 0.45], 0.18, COLOR.blue)
  const selfRule = chapter.text('来源过滤：SELF_TYPED / 敏感页不作独立证据', [-0.38, 0.97, 0.5], 0.17, COLOR.amber)
  const localGate = attach(chapter.group, gate(COLOR.mint, 0.74, 1.16), [-0.35, 0.0, 0.2])
  const modelGate = attach(chapter.group, gate(COLOR.blue, 0.68, 1.16), [1.14, 0, -0.25])
  const checkLabels = [chapter.text('MechanicalFirstReviewer', [-0.38, 0.89, 0.30], 0.125, COLOR.mint), chapter.text('+ CompletionAudit', [-0.38, 0.70, 0.30], 0.14, COLOR.mint), chapter.text('CloudReviewer', [1.12, 0.83, -0.1], 0.15, COLOR.blue)]
  const claim = attach(chapter.group, packet(COLOR.red, '完成？'))
  const wrong = chapter.text('错误声明：预约成功', [-1.44, -0.73, 0.5], 0.19, COLOR.red)
  const actual = chapter.text('独立页面：待医院确认', [0.50, -0.80, 0.5], 0.19, COLOR.blue)
  const hardStop = attach(chapter.group, cross(0.17), [-0.77, 0.0, 0.53])
  const cannotOverride = chapter.text('本机拒绝 → 不进入模型复核；模型不能覆盖', [-0.16, -1.15, 0.5], 0.18, COLOR.amber)
  const valid = attach(chapter.group, packet(COLOR.mint, '证据'))
  const validFlow = wire(chapter.group, [[-1.42, 0, 0.4], [-0.32, 0, 0.5], [1.1, 0, -0.1], [1.7, 0, -0.1]], COLOR.mint)
  const precise = chapter.text('只报告：已提交，待医院确认', [-0.22, -0.87, 0.6], 0.22, COLOR.mint)
  const allowed = chapter.text('本机通过后，才交给模型做最终复核', [-0.12, -1.19, 0.5], 0.17)
  const demo = chapter.text('机制反例示意；不是预约成功或付款证据', [0, -1.43, 0.25], 0.11, COLOR.blue)
  chapter.camera([
    [3.3, [-0.55, 0.50, 6.55], [0, 0.02, 0.1], 36, -2],
    [6.0, [-1.15, 1.05, 6.0], [-0.20, 0.0, 0.1], 37, -2],
    [10.3, [0.45, 0.25, 5.75], [-0.38, 0.0, 0.3], 35, 2],
    [14.7, [-1.6, 0.65, 6.2], [0.05, 0.0, 0.1], 37, -3],
    [18.8, [1.10, 0.85, 6.20], [0.18, 0.0, 0.0], 36, 2],
    [21.0, [0, 0.20, 5.60], [0, 0, 0], 35],
  ])
  chapter.animate = (local) => {
    chapter.pose(local, [2.28, -0.10, -0.16], 0.73, [0, -0.18, 0], 20.3)
    chapter.show(resume, windowAt(local, 0.9, 2.8))
    chapter.show(ledger, windowAt(local, 3.0, 7.3))
    actionPaper.rotation.y = -0.10
    observationPaper.rotation.y = 0.08
    ledgerLink.update((local - 3.7) / 2.6, windowAt(local, 3.7, 7.1) * chapter.env)
    chapter.show(sequence, windowAt(local, 4.0, 7.3))
    chapter.show(selfTyped, windowAt(local, 7.9, 11.0))
    selfTyped.rotation.y = smooth01(local, 8, 1.7) * -0.12
    chapter.show(excluded, windowAt(local, 8.8, 11.0))
    chapter.show(selfRule, windowAt(local, 8.4, 11.0))
    chapter.show(sourceRule, windowAt(local, 8.8, 11.0))
    const testing = windowAt(local, 11.7, 20.2)
    chapter.show(localGate, testing)
    chapter.show(modelGate, testing)
    checkLabels.forEach((mesh) => chapter.show(mesh, testing))
    const rejected = windowAt(local, 12.1, 16.0)
    travel(claim, [[-1.75, 0, 0.4], [-0.83, 0, 0.43]], local, 12.1, 1.5)
    chapter.show(claim, rejected)
    chapter.show(wrong, rejected)
    chapter.show(actual, rejected)
    chapter.show(hardStop, windowAt(local, 13.3, 16.0))
    chapter.show(cannotOverride, windowAt(local, 13.7, 16.0))
    const passed = windowAt(local, 16.5, 20.3)
    localGate.userData.hinge.rotation.z = smooth01(local, 16.7, 0.9) * Math.PI / 2
    modelGate.userData.hinge.rotation.z = smooth01(local, 18.0, 0.9) * Math.PI / 2
    travel(valid, [[-1.42, 0, 0.4], [-0.32, 0, 0.5], [1.1, 0, -0.1], [1.7, 0, -0.1]], local, 16.7, 3.2)
    chapter.show(valid, passed)
    validFlow.update((local - 16.7) / 3.2, passed * chapter.env)
    chapter.show(precise, passed)
    chapter.show(allowed, windowAt(local, 17.5, 20.3))
    chapter.show(demo, windowAt(local, 7.9, 20.1))
    chapter.page('waiting', 'result', local, 3.1, 0.8)
    chapter.status = { label: local < 1.0 ? '等您操作' : local < 2.7 ? '正在听…' : local < 20.0 ? '正在办' : '待您确认', working: local >= 2.7 && local < 20.0 }
  }
}
