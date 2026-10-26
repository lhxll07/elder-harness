import { SCREEN_W, SCREEN_H } from './screen.js'
import { floatingPill } from './shots/voice.js'
import { frame } from './shots/cinema-props.js'
import { fill, rule, badge, panel as uiPanel } from './fusion-memory-ui.js'
import { THREE, INK, GOLD, JADE, BLUE, add, type, surface, selection, cropPage, fade, smooth01, windowAt, lerp, place } from './compiler-design.js'

function canvas(width, height, draw) {
  const result = document.createElement('canvas')
  result.width = width
  result.height = height
  draw(result.getContext('2d'))
  return result
}

function write(context, content, horizontal, vertical, size, color = '#294943', align = 'left') {
  context.font = `500 ${size}px "Noto Sans CJK SC", sans-serif`
  context.fillStyle = color
  context.textAlign = align
  context.textBaseline = 'middle'
  context.fillText(content, horizontal, vertical)
}

function schedule() {
  return canvas(1800, 1040, context => {
    fill(context, 0, 0, 1800, 1040, 44, '#f7f9fb')
    write(context, '陈医生 · 门诊排班（示例）', 75, 95, 58)
    fill(context, 48, 180, 1704, 168, 16, '#e9eff3')
    fill(context, 728, 180, 340, 768, 14, '#e2f0eb')
    const headers = ['时间', '周三', '周四', '周五', '周六']
    const records = [
      ['09:00', '李医生', '陈医生', '李医生', '休诊'],
      ['10:00', '陈医生', '陈医生', '李医生', '休诊'],
      ['11:00', '李医生', '陈医生', '陈医生', '休诊'],
    ]
    headers.forEach((heading, index) => write(context, heading, 218 + index * 340, 265, 63, '#285447', 'center'))
    records.forEach((record, rowIndex) => {
      if (rowIndex === 1) {
        context.fillStyle = 'rgba(88,134,108,0.07)'
        context.fillRect(48, 348 + rowIndex * 200, 1704, 200)
      }
      record.forEach((content, column) => write(context, content, 218 + column * 340, 448 + rowIndex * 200, 56, '#2b453e', 'center'))
    })
    context.strokeStyle = '#e0e7ed'
    context.lineWidth = 1.5
    for (const vertical of [180, 348, 548, 748, 948]) {
      context.beginPath()
      context.moveTo(48, vertical)
      context.lineTo(1752, vertical)
      context.stroke()
    }
    write(context, '当前页阅读示意 · 列头与行内容一起记录', 75, 995, 35, '#617e70')
  })
}

function method() {
  return canvas(1800, 1140, context => {
    context.scale(1.5, 1.5)
    uiPanel(context, 0, 0, 1200, 760, 34)
    write(context, 'METHOD / 读取正文', 72, 80, 34, '#657985')
    write(context, 'reading_tables', 72, 176, 66, '#26434b')
    badge(context, '表头可见', 894, 80, 234, { height: 54, size: 28 })
    rule(context, 72, 244, 1056)
    for (const [index, content] of ['先找表头', '定位目标列', '列头 + 行 + 内容'].entries()) {
      fill(context, 72, 284 + index * 119, 1056, 94, 19, '#edf3f6')
      write(context, String(index + 1).padStart(2, '0'), 100, 332 + index * 119, 39, '#147e70')
      write(context, content, 224, 332 + index * 119, 48, '#253d46')
    }
    write(context, '辅助模型阅读，仍以当前页面为准', 72, 709, 29, '#657985')
  })
}

export class FusionRuntime {
  constructor(film) {
    this.film = film
    this.root = add(film.root, new THREE.Group())
    this.root.name = 'follow-the-doctor-and-thursday'
    this.word = add(this.root, type('陈医生', 0.48, GOLD), [2.75, -0.5, 0.8])
    this.rows = Array.from({ length: 3 }, (_, index) => cropPage(film.pages.doctors, 60, 834 + index * 347, 960, 304))
    this.list = add(this.root, new THREE.Group(), [-1.65, 0.15, 0.4])
    this.listRows = this.rows.map((row, index) => add(this.list, surface(row, 2.80, 2.80 * 304 / 960), [0, 1.1 - index * 1.1, 0]))
    this.oldTarget = add(this.list, frame(2.88, 0.94, 0xab8174), [0, 1.1, 0.06])
    this.target = add(this.list, frame(2.88, 0.94, JADE), [0, 1.1, 0.08])
    this.identity = add(this.root, type('同一窗口 · 稳定身份 · 唯一匹配', 0.19, BLUE), [-1.65, -1.73, 0.6])
    this.call = add(this.root, type('tool_call → 本地校验 → click(e31)', 0.20, JADE), [-1.65, 1.97, 0.6])
    this.screenTap = add(this.root, selection(0.62, 0.18, GOLD))
    this.tableCanvas = schedule()
    this.board = add(this.root, surface(this.tableCanvas, 4.50, 2.60))
    this.method = add(this.root, surface(method(), 3.10, 3.10 * 760 / 1200))
    this.methodLabel = add(this.root, type('目录匹配 → 按需读取正文 → 对照当前页面', 0.19, BLUE))
    this.methodSteps = ['01 识别表头', '02 目标列', '03 行与内容'].map(content => add(this.root, type(content, 0.17, JADE)))
    this.ruler = add(this.root, new THREE.Group())
    this.leaves = [-1, 0, 1].map(index => {
      const leaf = add(this.ruler, new THREE.Group())
      add(leaf, frame(0.85, 0.49, JADE))
      add(leaf, new THREE.Mesh(new THREE.PlaneGeometry(0.83, 0.47), new THREE.MeshBasicMaterial({ color: JADE, transparent: true, opacity: 0.055, depthWrite: false })), [0, 0, -0.005])
      return { leaf, index }
    })
    this.header = add(this.root, frame(0.85, 0.40, GOLD))
    this.scan = add(this.root, new THREE.Mesh(new THREE.PlaneGeometry(0.81, 0.008), new THREE.MeshBasicMaterial({ color: JADE, transparent: true, depthWrite: false })))
    this.records = ['09:00', '10:00', '11:00'].map((time, index) => {
      const root = add(this.root, new THREE.Group())
      add(root, type(`${time}  陈医生`, 0.23, JADE), [0, 0.08, 0])
      add(root, type('表头 + 时间 + 医生', 0.13, BLUE), [0, -0.20, 0])
      return { root, index }
    })
    this.datePage = canvas(SCREEN_W, SCREEN_H, context => {
      context.drawImage(film.pages.dates, 0, 0, SCREEN_W, SCREEN_H)
      context.fillStyle = '#f0f4ef'
      context.fillRect(48, 1008, 984, 590)
      context.drawImage(this.tableCanvas, 60, 1025, 960, 555)
    })
  }

  update(time) {
    const film = this.film
    this.root.visible = time >= 90 && time < 118
    if (!this.root.visible) return
    for (const object of [film.skill, film.reobserve, film.oldTarget, film.liveTarget, film.bindText, film.tap, ...film.instructions]) fade(object, 0)
    const swap = smooth01(time, 97.1, 1.8)
    const listAmount = windowAt(time, 92.8, 105.9, 1.8, 1.8)
    fade(this.list, listAmount)
    this.listRows.forEach((row, index) => {
      row.position.y = 1.1 - index * 1.1 + (index === 0 ? -1.1 * swap : index === 1 ? 1.1 * swap : 0)
    })
    fade(this.oldTarget, windowAt(time, 96.8, 98.4, 0.5, 0.8) * listAmount * 0.55)
    this.target.position.y = 1.1 - swap * 1.1
    fade(this.target, windowAt(time, 98.0, 104.3, 0.9, 0.8) * listAmount)
    fade(this.identity, windowAt(time, 97.5, 104.3, 0.7, 0.8))
    fade(this.call, windowAt(time, 102.1, 104.8, 0.6, 0.6))
    place(this.word, time, [[90, 2.75, -0.48, 0.8], [92, 2.75, -0.48, 0.8], [95.2, -1.65, 1.93, 0.65], [99.2, -1.65, 1.93, 0.65], [101.2, -1.65, 0.15, 0.65, 0.45]])
    fade(this.word, windowAt(time, 91.8, 101.2, 1.0, 1.0))
    const clue = windowAt(54 + (time - 90) / 2, 51, 57, 1, 0.8) * (1 - smooth01(time, 91.5, 1.6))
    fade(film.resolved, clue)
    fade(film.valueDoctor, clue)
    const reading = windowAt(time, 106.8, 115.7, 1.4, 2.2)
    const phoneOffset = windowAt(time, 106.3, 114.9, 1.7, 3.1)
    film.phone.position.x += phoneOffset * 2.3
    film.phone.scale.multiplyScalar(1 - phoneOffset * 0.16)
    film.phone.updateMatrixWorld(true)
    const context = film.view.g
    context.drawImage(film.pages.doctors, 0, 0, SCREEN_W, SCREEN_H)
    context.fillStyle = '#f0f4ef'
    context.fillRect(48, 820, 984, 1080)
    this.rows.forEach((row, index) => context.drawImage(row, 60, 834 + index * 347 + (index === 0 ? swap * 347 : index === 1 ? -swap * 347 : 0), 960, 304))
    for (const [start, page] of [[106.6, this.datePage], [116.1, film.pages.review]]) {
      context.save()
      context.globalAlpha = smooth01(time, start, 0.9)
      context.drawImage(page, 0, 0, SCREEN_W, SCREEN_H)
      context.restore()
    }
    floatingPill(context, time, 1, { label: time < 97 ? '找到陈医生' : time < 105.6 ? '正在对齐…' : time < 116 ? '正在读排班' : '请您核对', working: false })
    film.view.commitNow()
    this.screenTap.position.copy(film.phonePoint(530, 986 + swap * 347))
    this.screenTap.quaternion.copy(film.phone.quaternion)
    fade(this.screenTap, windowAt(time, 103.0, 104.0, 0.35, 0.55))
    const boardOrigin = film.phonePoint(540, 1295)
    this.board.position.copy(boardOrigin).lerp(new THREE.Vector3(-1.80, 0.10, 0.4), reading)
    this.board.scale.setScalar(lerp(0.25, 1, reading))
    this.board.rotation.set(-0.05 * reading, -0.05 * reading, 0)
    fade(this.board, windowAt(time, 106.8, 115.7, 1.1, 2.2) * (0.18 + smooth01(time, 110.0, 1.4) * 0.82))
    const load = smooth01(time, 106.2, 1.8)
    this.method.position.copy(film.phonePoint(540, 255)).lerp(new THREE.Vector3(-1.8, 0.22, 1.0), load)
    this.method.quaternion.copy(film.phone.quaternion).slerp(new THREE.Quaternion(), load)
    this.method.scale.setScalar(lerp(0.13, 1, load))
    fade(this.method, windowAt(time, 106.2, 111.0, 0.8, 0.95))
    this.methodLabel.position.set(-1.8, 1.97, 0.7)
    fade(this.methodLabel, windowAt(time, 106.9, 115.2, 0.8, 0.7))
    this.methodSteps.forEach((step, index) => {
      const spread = smooth01(time, 110.0 + index * 0.15, 1.15)
      step.position.set(lerp(-1.8, -3.25 + index * 1.42, spread), lerp(0.58 - index * 0.32, 1.64, spread), 1.04)
      fade(step, windowAt(time, 110.2 + index * 0.15, 115.2, 0.55, 0.9))
    })
    const unfold = smooth01(time, 109.3, 1.0) * (1 - smooth01(time, 115.5, 1.8))
    this.ruler.position.set(-1.80, -0.22, 0.54)
    this.leaves.forEach(({ leaf, index }) => {
      leaf.position.y = -index * 0.5
      leaf.rotation.x = 0
      leaf.scale.setScalar(0.97 + unfold * 0.03)
    })
    fade(this.ruler, windowAt(time, 109.2, 115.5, 1.0, 1.8))
    this.header.position.set(-1.80, 0.737, 0.55)
    fade(this.header, windowAt(time, 109.6, 115.5, 0.7, 1.8))
    const scan = smooth01(time, 110.4, 4.0)
    this.scan.position.set(-1.80, 0.28 - scan, 0.59)
    fade(this.scan, windowAt(time, 110.0, 115.2, 0.7, 0.8))
    this.records.forEach(({ root, index }) => {
      const amount = smooth01(time, 111.0 + index * 1.15, 0.85)
      const returnAmount = smooth01(time, 115.7, 1.9)
      const origin = new THREE.Vector3(-1.80, 0.28 - index * 0.5, 0.60)
      const destination = film.phonePoint(540, 770 + index * 150).add(new THREE.Vector3(0, 0, 0.06))
      root.position.copy(origin).lerp(destination, amount).lerp(boardOrigin, returnAmount)
      root.scale.setScalar((0.65 + 0.35 * amount) * (1 - returnAmount * 0.8))
      fade(root, windowAt(time, 111.0 + index * 1.15, 115.2, 0.85, 0.9))
    })
  }
}
