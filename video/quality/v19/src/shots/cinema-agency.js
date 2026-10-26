import { SCREEN_W, SCREEN_H } from '../screen.js'
import { THREE, COLOR, attach, caption, crop, frame, beam, canvasSurface, solid, smooth01, windowAt } from './cinema-props.js'
import { ring } from './mechanism-geometry.js'
import { backedSheet as sheet, ticket as keycap, foldedNote as paperMessage, machined, laptopDetails } from './cinema-finish.js'
import { makeTouchHand } from '../touch-hand.js'

const familyImages = Object.fromEntries(await Promise.all(['overview', 'request', 'compose', 'submitted', 'delivered', 'read'].map(async (name) => {
  const image = new Image()
  image.src = `/assets/family/${name}.png`
  await image.decode()
  return [name, image]
})))

export function buildAgency(chapter) {
  if (chapter.kind === 'guard') buildFamily(chapter)
  else buildRibbon(chapter)
}

function buildFamily(chapter) {
  const family = attach(chapter.group, new THREE.Group(), [2.7, 0.08, -0.8])
  const display = attach(family, machined(3.86, 2.50, 0.10, 0x314d55, 0.24), [0, 0, -0.08])
  const base = attach(family, machined(3.98, 0.065, 1.38, 0x647b80, 0.31), [0, -1.28, 0.60])
  laptopDetails(family)
  const overview = attach(family, canvasSurface(familyImages.overview, 2.27, 2.23, 0xd4ddd3), [0, 0, 0.01])
  const request = attach(family, canvasSurface(familyImages.request, 3.62, 2.16, 0xd4ddd3), [0, 0, 0.02])
  const compose = attach(family, canvasSurface(familyImages.compose, 2.1, 2.28, 0xd4ddd3), [0, 0, 0.03])
  const receipts = ['submitted', 'delivered', 'read'].map((name) => attach(family, canvasSurface(familyImages[name], 3.62, 0.99, 0xd4ddd3), [0, 0, 0.04]))
  const receiptHeading = attach(family, caption('家人页 · 留言回执', 0.18, COLOR.blue), [0, 0.98, 0.05])
  const route = attach(chapter.group, new THREE.Group())
  const beforeGap = beam(route, COLOR.mint, 0.022)
  beforeGap.update([-2.7, -1.43, 0.2], [-0.76, -1.43, 0.2])
  const afterGap = beam(route, COLOR.blue, 0.022)
  afterGap.update([0.76, -1.43, 0.2], [2.7, -1.43, -0.7])
  const bridge = beam(route, COLOR.mint, 0.022)
  const gap = attach(route, caption('还不知道哪位医生', 0.16, COLOR.amber), [0, -1.05, 0.35])
  const missingDoctor = attach(route, frame(1.48, 0.18, COLOR.amber), [0, -1.43, 0.2])
  const paper = attach(chapter.group, paperMessage())
  const stamps = ['已提交', '送到手机', '本人已读'].map((content, index) => attach(paper, keycap(content, '', 0.63, 0.25, index === 2 ? COLOR.mint : COLOR.blue), [0.47, -0.23, 0.05]))
  const trajectory = new THREE.CatmullRomCurve3([[2.7, 0.10, 0.6], [1.6, 0.82, 1.4], [-0.6, 0.65, 1.7], [-2.55, 0.16, 1.0]].map((point) => new THREE.Vector3(...point)), false, 'centripetal')
  const ask = chapter.text('您：不记得了，问问女儿', [0, 0.85, 0.55], 0.18, COLOR.amber)
  const dashboard = chapter.text('任务背景随求助一起到达', [2.7, 1.44, -0.45], 0.17, COLOR.blue)
  const noResume = chapter.text('家人补充信息，老人核对决定', [-2.55, 1.58, 1.0], 0.16, COLOR.amber)
  const elder = chapter.text('您：是陈医生，周四上午，继续', [-1.42, 1.44, 0.75], 0.18, COLOR.mint)
  const boundary = chapter.text('家人协作 / 求助 → 留言 → 本人确认', [2.7, -1.61, -0.30], 0.105, COLOR.blue)
  chapter.camera([
    [3.3, [-0.2, 1.35, 8.6], [0, -0.05, 0], 42, -3],
    [6.2, [3.4, 0.64, 5.1], [2.7, 0.04, -0.4], 40, 2],
    [8.9, [2.9, 0.25, 4.3], [2.7, 0.05, -0.4], 37],
    [11.1, [2.05, 0.85, 5.3], [1.7, 0.3, 0.3], 43, -5],
    [14.1, [-2.35, 0.75, 5.4], [-2.2, 0.1, 0.4], 43, -2],
    [17.4, [-1.0, 1.15, 7.5], [-1.05, -0.03, 0], 40, 2],
    [19.3, [0, 0.30, 5.7], [0, 0, 0], 36],
  ])
  chapter.animate = (local) => {
    const stage = windowAt(local, 1.7, 18.9, 1.4, 1.2)
    chapter.device(local, [-2.7, 0, 0.1], 2.0, [0, 0.09, 0], 1.7, 18.7)
    chapter.show(family, stage)
    chapter.show(display, stage)
    chapter.show(base, stage)
    chapter.show(overview, windowAt(local, 2.4, 5.8) * stage)
    chapter.show(request, windowAt(local, 5.7, 7.7, 0.35, 0.35) * stage)
    chapter.show(compose, windowAt(local, 7.7, 11.1, 0.35, 0.6) * stage)
    receipts.forEach((receipt, index) => chapter.show(receipt, windowAt(local, [11.0, 13.5, 15.0][index], [13.5, 15.0, 18.9][index], 0.3, 0.3) * stage))
    chapter.show(receiptHeading, windowAt(local, 11.0, 18.9) * stage)
    chapter.show(route, stage)
    const reconnect = smooth01(local, 17.0, 1.1)
    bridge.update([-0.76, -1.43, 0.2], [-0.76 + reconnect * 1.52, -1.43, 0.2])
    chapter.show(bridge.object, stage * reconnect)
    chapter.show(gap, stage * (1 - reconnect) * (1 - windowAt(local, 6.5, 11.8, 0.5, 0.5)))
    chapter.show(missingDoctor, stage * (1 - reconnect))
    const travel = smooth01(local, 10.4, 3.7)
    trajectory.getPointAt(travel, paper.position)
    paper.rotation.set(0.08 * Math.sin(travel * Math.PI), -0.28 * Math.sin(travel * Math.PI), -0.13 * Math.sin(travel * Math.PI))
    paper.scale.setScalar(0.85 + smooth01(local, 13.9, 0.9) * 0.40)
    paper.userData.fold(smooth01(local, 9.8, 0.8) * (1 - smooth01(local, 13.1, 1.1)) * 0.70)
    chapter.show(paper, windowAt(local, 9.8, 16.7, 0.6, 0.6))
    stamps.forEach((stamp, index) => chapter.show(stamp, windowAt(local, [10.4, 13.5, 15.0][index], [13.4, 14.9, 16.7][index], 0.18, 0.18)))
    chapter.show(ask, windowAt(local, 0.75, 2.8))
    chapter.show(dashboard, windowAt(local, 5.6, 7.8))
    chapter.show(boundary, windowAt(local, 5.7, 7.8))
    chapter.show(noResume, windowAt(local, 14.3, 16.6))
    chapter.show(elder, windowAt(local, 16.9, 19.0))
    chapter.page('doctors', 'review', local, 18.4, 0.8)
    chapter.status = { label: local < 13.5 ? '已经找家人了' : local < 16.9 ? '家人留言' : local < 19.2 ? '正在办' : '等您操作', working: local >= 16.9 && local < 19.2 }
  }
}

function buildRibbon(chapter) {
  const pages = ['home', 'departments', 'doctors', 'dates'].map((kind, index) => {
    const root = attach(chapter.group, sheet(crop(chapter.pages[kind], 0, 540, SCREEN_W, 1580), 1.34, 1.96))
    attach(root, caption(['医院', '普通内科', '陈医生', '周四上午'][index], 0.15, COLOR.mint), [0, 1.16, 0.05])
    return root
  })
  const stitches = Array.from({ length: 4 }, () => beam(chapter.group, COLOR.mint, 0.009))
  const button = attach(chapter.phone, frame(960 / SCREEN_W * 0.676, 176 / SCREEN_H * 1.426, COLOR.amber), [0, (0.5 - 1992 / SCREEN_H) * 1.426, 0.075])
  const finger = attach(chapter.group, makeTouchHand())
  const touch = attach(chapter.group, ring(0.12, COLOR.amber, 0.006))
  const folds = chapter.text('已明确、可逆的步骤，交给系统', [-0.3, 1.70, 0.5], 0.18, COLOR.mint)
  const finalChoice = chapter.text('最后这一按，留给您', [1.8, 2.05, 0.5], 0.22, COLOR.amber)
  const policy = chapter.text('关键提交 · ask_person → 本人操作', [1.8, -1.65, 0.5], 0.12, COLOR.blue)
  chapter.camera([
    [3.0, [-3.6, 0.35, 6.4], [-1.3, 0, -0.3], 42, -5],
    [5.6, [-0.5, 0.82, 6.6], [0.2, 0, 0], 44, 2],
    [8.3, [1.85, 0.36, 7.0], [1.8, 0, 0.15], 40],
    [10.9, [1.85, 0.24, 6.9], [1.8, -0.05, 0.15], 40],
    [13.1, [0.7, 0.18, 5.2], [0.5, 0, 0.04], 35],
  ])
  chapter.animate = (local) => {
    chapter.device(local, [1.8, 0, 0.15], 2.35, [0, 0, 0], 1.4, 12.2)
    const stage = windowAt(local, 1.8, 8.5, 0.9, 0.6)
    pages.forEach((page, index) => {
      const fold = smooth01(local, 3.4 + index * 0.72, 1.4)
      const initial = new THREE.Vector3(-3.4 + index * 1.47, index % 2 ? 0.13 : -0.07, -1.3 + index * 0.43)
      const end = new THREE.Vector3(1.8, 0, 0.20)
      page.position.copy(initial).lerp(end, fold)
      page.rotation.set(0.12 * Math.sin(fold * Math.PI), (index % 2 ? 1 : -1) * Math.sin(fold * Math.PI) * 1.25, 0)
      page.scale.setScalar(1 - fold * 0.72)
      chapter.show(page, stage * (1 - smooth01(local, 4.4 + index * 0.72, 0.8)))
      const next = index < 3 ? [-3.4 + (index + 1) * 1.47, 0, -1.3 + (index + 1) * 0.43] : [1.8, 0, 0.2]
      stitches[index].update(initial.toArray(), next)
      chapter.show(stitches[index].object, stage * (1 - fold))
    })
    chapter.show(button, windowAt(local, 7.0, 11.8))
    const approach = smooth01(local, 9.7, 1.3)
    const buttonY = (0.5 - 1992 / SCREEN_H) * 1.426 * chapter.phone.scale.x
    finger.position.set(4.0 + (chapter.phone.position.x - 4.0) * approach, -1.62 + (buttonY + 1.62) * approach, 1.1 - approach * 0.83)
    finger.rotation.set(0.42, 0.68 + 0.12 * (1 - approach), -0.16)
    chapter.show(finger, windowAt(local, 9.6, 11.9, 0.4, 0.4))
    touch.position.set(chapter.phone.position.x, buttonY, chapter.phone.position.z + 0.20)
    touch.scale.setScalar(1 + smooth01(local, 10.9, 0.6) * 0.8)
    chapter.show(touch, windowAt(local, 10.9, 11.7, 0.12, 0.3))
    chapter.show(folds, windowAt(local, 2.6, 6.6))
    chapter.show(finalChoice, windowAt(local, 7.5, 10.6, 0.6, 0.5))
    chapter.show(policy, windowAt(local, 7.7, 9.5))
    chapter.page('review', 'waiting', local, 11.5, 0.9)
    chapter.status = { label: '等您操作', working: false }
  }
}
