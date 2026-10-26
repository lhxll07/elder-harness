import { THREE, COLOR, attach, caption, crop, frame, railFrame, beam, flight, drawing, write, solid, smooth01, windowAt } from './cinema-props.js'
import { ring, cross } from './mechanism-geometry.js'
import { backedSheet as sheet, ticket as keycap, laminate, machined } from './cinema-finish.js'

export function buildProof(chapter) {
  if (chapter.kind === 'evidence') buildEvidence(chapter)
  else buildRuler(chapter)
}

function buildEvidence(chapter) {
  const source = attach(chapter.group, sheet(crop(chapter.pages.result, 60, 1150, 960, 880), 2.56, 2.35), [0, -0.61, -0.51])
  const provenance = attach(source, caption('PAGE · 示例医院 · r23 · step 12', 0.125, COLOR.blue), [0, 1.31, 0.07])
  const claim = attach(chapter.group, new THREE.Group(), [0, 1.20, 0.44])
  const prefix = attach(claim, caption('预约', 0.49, COLOR.text), [-0.60, 0, 0])
  const success = attach(claim, caption('成功', 0.49, COLOR.red), [0.61, 0, 0])
  success.name = '成功（坠落反例）'
  const counterexample = chapter.text('结论核验示意', [0, 1.89, 0.4], 0.14, COLOR.red)
  const emptySupport = attach(chapter.group, frame(0.92, 0.17, COLOR.red), [0.65, 0.35, 0.10])
  const claimSupport = beam(chapter.group, COLOR.blue, 0.011)
  claimSupport.update([-0.60, 0.19, -0.42], [-0.60, 1.01, 0.42])
  const question = chapter.text('结论要由对应回执支撑', [1.90, -0.90, 0.4], 0.15, COLOR.amber)
  const facts = attach(chapter.group, new THREE.Group(), [0, 1.12, 0.50])
  const submitted = attach(facts, caption('已提交', 0.26, COLOR.mint), [-0.89, 0, 0])
  const pending = attach(facts, caption('待医院确认', 0.26, COLOR.blue), [0.63, 0, 0])
  const pillars = [-0.89, 0.63].map((horizontal, index) => {
    const connector = beam(chapter.group, index ? COLOR.blue : COLOR.mint, 0.017)
    connector.update([horizontal, 0.17, -0.42], [horizontal, 1.02, 0.43])
    return connector
  })
  const actionStrip = attach(chapter.group, drawing(2.35, 0.80, (context, width, height) => {
    context.fillStyle = '#243f46'
    context.fillRect(0, 0, width, height)
    write(context, 'ACTION · call_id → tool_result', 0.08, 0.14, 0.105, '#80a5bc')
    write(context, 'ask_person  →  已经请老人自己完成这一步', 0.08, 0.37, 0.086)
    write(context, '调用与返回，按同一编号配对', 0.08, 0.62, 0.105, '#8abdab')
  }), [-2.48, -0.30, 0.45])
  laminate(actionStrip, 2.35, 0.80)
  const typed = attach(chapter.group, keycap('自己输入“预约成功”', 'SELF_TYPED', 1.92, 0.59, COLOR.amber), [-2.53, 0.23, 0.68])
  const echo = attach(chapter.group, keycap('再读回同样的文字', '来源仍为 SELF_TYPED', 1.92, 0.59, COLOR.amber), [-2.53, -0.64, 0.68])
  const echoFlight = flight(chapter.group, [[-1.55, 0.23, 0.70], [-1.25, -0.15, 0.9], [-1.55, -0.64, 0.70], [-3.45, -0.64, 0.70], [-3.75, -0.1, 0.9], [-3.45, 0.23, 0.7]], COLOR.amber, 0.008)
  const exclusion = attach(chapter.group, cross(0.17), [-1.02, -0.08, 0.69])
  const noSelfProof = chapter.text('自己输入 / 页面观察，分开归档', [-2.40, -1.39, 0.72], 0.145, COLOR.amber)
  const localStamp = attach(source, keycap('本机核验', '机械检查 + 完成审计', 1.62, 0.55), [0, -0.66, 0.08])
  const localNames = chapter.text('MechanicalFirstReviewer + CompletionAudit', [0, 1.89, 0.5], 0.135, COLOR.mint)
  const rejected = chapter.text('本机审计 → 校准这句结论', [-2.35, -1.15, 0.50], 0.15, COLOR.amber)
  const cloud = attach(chapter.group, ring(0.48, COLOR.blue, 0.023), [2.30, 0.83, -0.18])
  attach(cloud, ring(0.37, COLOR.blue, 0.004), [0, 0, 0.02])
  const cloudLabel = chapter.text('CloudReviewer', [2.30, 1.65, 0.12], 0.16, COLOR.blue)
  const validPath = flight(chapter.group, [[0.0, -0.33, 0.64], [0.85, 0.70, 1.30], [2.3, 0.83, -0.05]], COLOR.mint, 0.010)
  const passed = chapter.text('本机通过的这份记录，才进入模型复核', [0, 1.74, 0.5], 0.15, COLOR.mint)
  const resume = chapter.text('您：我点好了，帮我核对一下', [0, 0.99, 0.5], 0.19, COLOR.amber)
  const exact = chapter.text('动作有记录，结果有依据', [0, 1.10, 0.5], 0.21, COLOR.mint)
  chapter.camera([
    [3.8, [0.2, 0.62, 7.0], [0, 0, 0], 39],
    [6.5, [-2.20, -0.36, 5.0], [0.1, 0.25, -0.1], 43, -7],
    [9.5, [0.75, 0.50, 6.0], [0, 0.20, 0], 40, 3],
    [13.2, [-2.95, 0.35, 5.8], [-1.75, -0.18, 0.15], 42, -3],
    [17.0, [0.15, 1.13, 7.5], [0.65, 0.10, 0], 42, 2],
    [20.8, [0, 0.20, 6.2], [0, 0, 0], 37],
  ])
  chapter.animate = (local) => {
    const stage = windowAt(local, 2.8, 21.0, 1.1, 1.2)
    chapter.device(local, [0, -0.12, -1.14], 2.15, [0, 0, 0], 2.1, 21.0)
    chapter.dimPhone(1 - stage)
    chapter.show(source, stage)
    chapter.show(provenance, stage)
    chapter.show(resume, windowAt(local, 0.8, 2.8))
    chapter.show(claim, windowAt(local, 3.1, 10.2))
    chapter.show(prefix, 1 - smooth01(local, 8.8, 0.6))
    chapter.show(claimSupport.object, windowAt(local, 5.1, 9.1))
    chapter.show(counterexample, windowAt(local, 3.4, 7.2))
    const fall = smooth01(local, 7.7, 1.8)
    success.position.set(0.61 + fall * 0.46, -fall * fall * 3.6, fall * 0.42)
    success.rotation.z = -fall * 0.67
    chapter.show(success, 1 - smooth01(local, 8.7, 0.9))
    chapter.show(emptySupport, windowAt(local, 5.6, 8.8))
    chapter.show(question, windowAt(local, 6.2, 9.5))
    chapter.show(facts, windowAt(local, 9.2, 20.6))
    pillars.forEach((connector) => chapter.show(connector.object, windowAt(local, 9.2, 20.4)))
    chapter.show(actionStrip, windowAt(local, 4.1, 5.9))
    const selfProof = windowAt(local, 11.0, 14.9)
    chapter.show(typed, selfProof)
    chapter.show(echo, selfProof)
    echoFlight.update(smooth01(local, 11.4, 2.1), 0.82)
    chapter.show(echoFlight.root, selfProof)
    chapter.show(exclusion, windowAt(local, 12.0, 14.9))
    chapter.show(noSelfProof, windowAt(local, 12.0, 14.9))
    chapter.show(localStamp, windowAt(local, 15.1, 19.5))
    localStamp.rotation.z = -0.06 * (1 - smooth01(local, 15.2, 0.7))
    chapter.show(localNames, windowAt(local, 15.1, 16.4, 0.6, 0.4))
    chapter.show(rejected, windowAt(local, 8.2, 10.3))
    chapter.show(cloud, windowAt(local, 16.6, 20.5))
    chapter.show(cloudLabel, windowAt(local, 16.6, 20.5))
    validPath.update(smooth01(local, 17.1, 2.6), 0.55)
    chapter.show(validPath.root, windowAt(local, 17.1, 20.5))
    chapter.show(passed, windowAt(local, 17.1, 19.7))
    chapter.show(exact, windowAt(local, 20.8, 22.0))
    chapter.page('waiting', 'result', local, 2.7, 0.9)
    chapter.status = { label: local < 1.0 ? '等您操作' : local < 2.7 ? '正在听…' : local < 21.0 ? '正在办' : '待您确认', working: local >= 2.7 && local < 21.0 }
  }
}

function schedule() {
  return drawing(4.50, 2.50, (context, width, height) => {
    const stock = context.createLinearGradient(0, 0, width, height)
    stock.addColorStop(0, '#f1f2e8')
    stock.addColorStop(1, '#d7e4d9')
    context.fillStyle = stock
    context.fillRect(0, 0, width, height)
    context.fillStyle = '#d0e1d5'
    context.fillRect(0.12, 0.35, 4.24, 0.42)
    context.fillStyle = 'rgba(88,134,108,0.07)'
    context.fillRect(0.12, 1.25, 4.24, 0.48)
    context.fillStyle = '#c5ddca'
    context.fillRect(1.72, 0.35, 0.88, 0.42)
    context.fillStyle = '#5d8b70'
    context.fillRect(0.12, 0.10, 0.028, 0.18)
    write(context, '陈医生复诊排班 · 示例表格', 0.20, 0.20, 0.145, '#294943')
    const headers = ['时间', '周三', '周四', '周五', '周六']
    const names = [['09:00', '李医生', '陈医生', '李医生', '休诊'], ['10:00', '陈医生', '陈医生', '李医生', '休诊'], ['11:00', '李医生', '陈医生', '陈医生', '休诊']]
    const centers = [0.46, 1.28, 2.16, 3.04, 3.92]
    headers.forEach((heading, index) => write(context, heading, centers[index], 0.53, 0.16, '#285447', 'center'))
    context.strokeStyle = '#9bb6a4'
    context.lineWidth = 0.005
    for (const horizontal of [0.12, 0.84, 1.72, 2.60, 3.48, 4.36]) {
      context.beginPath()
      context.moveTo(horizontal, 0.35)
      context.lineTo(horizontal, 2.21)
      context.stroke()
    }
    for (const vertical of [0.35, 0.77, 1.25, 1.73, 2.21]) {
      context.beginPath()
      context.moveTo(0.12, vertical)
      context.lineTo(4.36, vertical)
      context.stroke()
    }
    names.forEach((row, index) => row.forEach((content, column) => write(context, content, centers[column], 1.01 + index * 0.48, 0.145, '#2b453e', 'center')))
    write(context, '按表头定位，再逐行读取目标列', 0.15, 2.37, 0.095, '#536f67')
  })
}

function methodPage() {
  return drawing(1.30, 1.67, (context, width, height) => {
    const stock = context.createLinearGradient(0, 0, width, height)
    stock.addColorStop(0, '#eef0df')
    stock.addColorStop(1, '#c9dac8')
    context.fillStyle = stock
    context.fillRect(0, 0, width, height)
    write(context, 'METHOD / 按需加载', 0.10, 0.12, 0.062, '#71856e')
    write(context, 'reading_tables', 0.10, 0.28, 0.12, '#315647')
    const steps = ['先找表头', '再定位目标列', '列头 + 行 + 内容', '跳列？返回重数']
    steps.forEach((step, index) => {
      const top = 0.44 + index * 0.29
      context.fillStyle = index === 3 ? '#cad9be' : 'rgba(249,249,235,0.58)'
      context.beginPath()
      context.roundRect(0.08, top, 1.14, 0.235, 0.025)
      context.fill()
      write(context, String(index + 1).padStart(2, '0'), 0.14, top + 0.115, 0.07, '#7c9278')
      write(context, step, 0.33, top + 0.115, index === 0 ? 0.105 : 0.088, '#29473a')
    })
  })
}

function buildRuler(chapter) {
  const table = attach(chapter.group, laminate(schedule(), 4.50, 2.50, 0x8eaaa0, 0.055), [-0.85, 0, -0.34])
  const targetX = -0.85 + 2.16 - 2.25
  const catalogue = attach(chapter.group, new THREE.Group(), [-3.56, 0.50, 0.16])
  const names = ['reading_tables', 'blind_page', 'wechat_input']
  names.forEach((name, index) => {
    attach(catalogue, solid(1.34, 0.055, 0.12, index ? 0x35505a : 0x7b9b88), [0, -0.4 * index, -0.12 * index])
    attach(catalogue, caption(name, 0.105, index ? COLOR.blue : COLOR.mint), [0, -0.4 * index + 0.12, 0.06])
  })
  const method = attach(chapter.group, laminate(methodPage(), 1.30, 1.67, 0x879e87, 0.028))
  const ruler = attach(chapter.group, new THREE.Group(), [targetX, 0, 0.04])
  const leaves = [-1, 0, 1].map((index) => {
    const leaf = attach(ruler, new THREE.Group())
    attach(leaf, railFrame(0.88, 0.63, 0x477765, 0.018))
    for (const side of [-1, 1]) attach(leaf, machined(0.044, 0.075, 0.043, 0xb4c6af, 0.23), [side * 0.43, -0.3125, 0.008])
    const film = attach(leaf, new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.61), new THREE.MeshPhysicalMaterial({ color: 0xa9d0bd, roughness: 0.18, metalness: 0.06, clearcoat: 0.8, transparent: true, opacity: 0.055, depthWrite: false })), [0, 0, 0.014])
    film.material.transparent = true
    film.material.opacity = 0.07
    for (let tick = 0; tick < 4; tick++) attach(leaf, solid(0.055, 0.012, 0.012, COLOR.mint), [-0.40, -0.23 + tick * 0.15, 0.03])
    return { leaf, index }
  })
  const anchor = attach(ruler, railFrame(0.88, 0.39, 0x315f52, 0.016), [0, 0.72, 0.045])
  const bar = attach(ruler, solid(0.86, 0.028, 0.025, COLOR.mint), [0, 0.30, 0.06])
  const wrongBar = attach(chapter.group, railFrame(0.88, 0.41, 0x914e48, 0.020), [targetX + 0.88, 0.72, 0.08])
  const records = ['09:00', '10:00', '11:00'].map((time, index) => attach(chapter.group, keycap(`周四｜${time}｜陈医生`, '列头 + 行 + 内容 → transcript', 2.28, 0.53), [2.60, 0.57 - index * 0.64, 0.24]))
  const readPaths = records.map((record, index) => flight(chapter.group, [[targetX + 0.4, 0.24 - index * 0.48, 0.16], [1.3, 0.35 - index * 0.44, 0.60], [1.42, record.position.y, 0.24]], COLOR.mint, 0.006))
  const replay = chapter.text('回看刚才：周四上午，怎么读对？', [0, 0.88, 0.5], 0.18, COLOR.amber)
  const resident = chapter.text('小目录常驻，方法正文按需展开', [-2.2, 1.53, 0.2], 0.15, COLOR.blue)
  const load = chapter.text('load_skill("reading_tables")', [-0.90, 1.52, 0.9], 0.15, COLOR.mint)
  const stop = chapter.text('列头跳到“周五” → 停住，返回表头重数', [0, 1.57, 0.7], 0.17, COLOR.red)
  const methodRule = chapter.text('方法可复用，页面逐次读取', [0, 1.57, 0.7], 0.18, COLOR.mint)
  const boundary = chapter.text('reading_tables / 模型阅读方法', [0, -1.54, 0.6], 0.13, COLOR.blue)
  chapter.camera([
    [3.5, [0.5, 0.90, 6.7], [-0.85, 0, -0.1], 42, -4],
    [6.4, [-2.85, 0.70, 5.8], [-1.40, 0.10, 0.1], 41, -5],
    [9.4, [0.2, 1.25, 7.7], [0, 0.02, -0.05], 42, 2],
    [12.6, [0.9, 0.54, 7.7], [0, 0.03, 0], 42, -2],
    [15.7, [0.2, 0.63, 7.4], [0, 0, 0], 41],
    [17.8, [0, 0.25, 5.7], [0, 0, 0], 37],
  ])
  chapter.animate = (local) => {
    const stage = windowAt(local, 2.1, 17.9, 1.0, 1.0)
    chapter.device(local, [0, 0, -1.2], 1.7, [0, 0, 0], 1.7, 17.5)
    chapter.dimPhone(1 - stage)
    chapter.show(table, stage)
    const returnPage = smooth01(local, 16.9, 1.0)
    table.position.set(-0.85 * (1 - returnPage), 0, -0.34 - returnPage * 0.86)
    table.scale.setScalar(1 - returnPage * 0.77)
    chapter.show(catalogue, windowAt(local, 3.8, 8.0))
    const pull = smooth01(local, 5.2, 1.1)
    const open = smooth01(local, 7.0, 1.2) * (1 - smooth01(local, 16.0, 1.2))
    const returnMethod = smooth01(local, 16.8, 1.1)
    method.position.set((-3.56 + pull * 2.62) * (1 - returnMethod), (0.42 - pull * 0.29) * (1 - returnMethod), 0.20 + pull * 0.88 - returnMethod * 2.16)
    method.rotation.set(0, -0.20 * (1 - pull) + returnMethod * 1.1, -0.10 * (1 - pull))
    method.scale.setScalar(1 - returnMethod * 0.6)
    chapter.show(method, windowAt(local, 5.1, 8.2) + windowAt(local, 16.7, 17.9) * 0.9)
    ruler.position.set(targetX + smooth01(local, 11.6, 0.6) * (1 - smooth01(local, 13.0, 0.6)) * 0.88, 0, 0.04)
    leaves.forEach(({ leaf, index }) => {
      leaf.position.y = index * 0.625 * open
      leaf.rotation.x = index * (1 - open) * 1.38
    })
    chapter.show(ruler, windowAt(local, 7.1, 17.3))
    chapter.show(anchor, windowAt(local, 8.0, 17.2))
    let barY = 0.24 - smooth01(local, 8.8, 2.3) * 0.48
    if (local >= 12.6) barY = -0.24 + smooth01(local, 12.6, 0.8) * 0.96
    if (local >= 13.4) barY = 0.72 - smooth01(local, 13.7, 1.8) * 1.44
    bar.position.y = barY
    chapter.show(bar, windowAt(local, 8.3, 16.4))
    chapter.show(wrongBar, windowAt(local, 11.8, 13.4, 0.2, 0.3))
    records.forEach((record, index) => {
      const start = [9.0, 10.0, 14.7][index]
      chapter.show(record, windowAt(local, start + 0.5, 16.6))
      readPaths[index].update(smooth01(local, start, 0.8), 0.55)
      chapter.show(readPaths[index].root, windowAt(local, start, start + 1.2))
    })
    chapter.show(replay, windowAt(local, 0.8, 2.5))
    chapter.show(resident, windowAt(local, 4.0, 5.8))
    chapter.show(load, windowAt(local, 5.9, 7.9))
    chapter.show(stop, windowAt(local, 11.9, 13.5))
    chapter.show(methodRule, windowAt(local, 14.0, 16.6))
    chapter.show(boundary, windowAt(local, 8.6, 16.6))
    chapter.page('result', null, local)
    chapter.status = { label: '待您确认', working: false }
  }
}
