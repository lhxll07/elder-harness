import { CameraRig } from './stage.js'
import { SCREEN_W, SCREEN_H } from './screen.js'
import { THREE, PAGE_WIDTH, PAGE_HEIGHT, INK, JADE, add, type, surface, cropPage, fade, smooth01, windowAt, lerp } from './compiler-design.js'
import { text, mono, fill, rule } from './fusion-memory-ui.js'

const STRIP_WIDTH = 3.25
const STRIP_HEIGHT = 0.43
const STEPS = [
  ['home', 640, 290, '找到预约入口', '入口与导航'],
  ['departments', 782, 246, '选择普通内科', '科室来自您的需求'],
  ['doctors', 590, 210, '补齐医生线索', '哪位医生，仍需确认'],
  ['dates', 790, 192, '读取当页排班', '带着周四上午去查找'],
  ['review', 590, 172, '请本人核对', '医生、时间、费用'],
  ['result', 600, 180, '对照返回状态', '结论要有页面依据'],
]

export class FusionCompile {
  constructor(film) {
    this.film = film
    this.root = add(film.root, new THREE.Group())
    this.root.name = 'same-pages-compiled-for-a-person'
    this.camera = new CameraRig().flow(0.55)
    for (const [time, position, look, fov, roll = 0] of [
      [24.5, ...this.pose(24.5)],
      [27.2, [2.5, 1.1, 11.0], [0, 0.05, -0.3], 40, 1.2],
      [30.5, [1.3, 0.9, 9.4], [-0.15, 0.15, 0.15], 38, -1.1],
      [33.4, [-1.3, 0.95, 9.0], [0, 0.12, 0.3], 38, -0.6],
      [36.4, [0.2, 0.4, 8.7], [0, 0.15, 0.7], 37],
      [38.4, ...this.pose(38.4)],
      [40, ...this.pose(40)],
    ]) this.camera.at(time, position, look, { fov, roll })
    this.strips = STEPS.map(([kind, top, height, title, detail], index) => {
      const crop = cropPage(film.pages[kind], 60, top, 960, height)
      const root = add(this.root, new THREE.Group())
      const image = add(root, surface(crop, STRIP_WIDTH, STRIP_WIDTH * crop.height / crop.width))
      const canvas = document.createElement('canvas')
      canvas.width = 1560
      canvas.height = 206
      const context = canvas.getContext('2d', { willReadFrequently: true })
      fill(context, 0, 0, 1560, 206, 22, '#f4f6f8')
      mono(context, String(index + 1).padStart(2, '0'), 32, 58, 31, '#7a9294')
      text(context, title, 130, 66, 48, '#233b42', 500)
      text(context, detail, 130, 145, 29, '#5d747b')
      rule(context, 130, 188, 1370, '#dce5e9')
      const step = add(root, surface(canvas, STRIP_WIDTH, STRIP_HEIGHT), [0, 0, 0.002])
      for (const mesh of [image, step]) {
        mesh.renderOrder = 35 + index
        mesh.material.depthTest = false
        mesh.material.fog = false
      }
      const material = film.source[index].bands[0].material
      material.userData.extraction = { value: 0 }
      material.onBeforeCompile = shader => {
        shader.uniforms.extraction = material.userData.extraction
        shader.fragmentShader = 'uniform float extraction;\n' + shader.fragmentShader.replace('#include <alphatest_fragment>', `
          float extractedRegion = step(0.055556, vMapUv.x) * step(vMapUv.x, 0.944444) * step(${(1 - (top + height) / SCREEN_H).toFixed(8)}, vMapUv.y) * step(vMapUv.y, ${(1 - top / SCREEN_H).toFixed(8)});
          diffuseColor.a *= 1.0 - extractedRegion * extraction;
          #include <alphatest_fragment>
        `)
      }
      return { root, image, step, material, top, height, index }
    })
    this.planLabel = add(this.root, type('页面中的信息，成为可执行的步骤。', 0.25, INK), [-1.65, 2.05, 0.8])
    this.systemLabel = add(this.root, type('操作由软件承担', 0.22, JADE), [-1.65, -1.82, 0.8])
    this.humanLabel = add(this.root, type('留下需求与决定', 0.29, INK), [2.35, 2.02, 0.9])
    this.questionLabel = add(this.root, type('只剩一个，需要您决定的问题。', 0.30, INK), [0, 1.55, 1])
  }

  pose(time) {
    const pose = this.film.camera.sample(time)
    return [pose.pos.toArray(), pose.look.toArray(), pose.fov, pose.roll]
  }

  update(time) {
    this.root.visible = time >= 24.5 && time < 40
    this.strips.forEach(entry => { entry.material.userData.extraction.value = 0 })
    if (!this.root.visible) return
    const film = this.film
    const fold = smooth01(time, 32.1, 2.6)
    const retention = smooth01(time, 33.1, 2.4)
    film.source.forEach((entry, index) => {
      const collapse = smooth01(time, 28.2 + index * 0.09, 2.6)
      const neutral = 1 - smooth01(time, 24.5, 1.2)
      const parse = windowAt(time, 15, 24.3, 3, 2.8)
      const normal = windowAt(time, 3.2 + index * 0.12, 32.5, 0.7, 1.1) * (index === 1 ? 1 : 1 - parse) * (1 - smooth01(time, 27, 3.4) * 0.96)
      fade(entry.root, normal)
      fade(entry.heading, normal * (1 - smooth01(time, 26.0, 1.2)))
      fade(entry.footer, normal * (1 - smooth01(time, 26.0, 1.2)))
      entry.root.position.z = lerp(entry.root.position.z, -1.9 - index * 0.035, collapse)
      entry.root.rotation.z *= 1 - collapse
      entry.bands.forEach((band, bandIndex) => {
        band.position.set(0, (PAGE_HEIGHT / 2 - (bandIndex + 0.5) * PAGE_HEIGHT / 18) * (1 - collapse * 0.95), -collapse * bandIndex * 0.003)
        band.rotation.set(0, 0, 0)
        band.scale.set(1 - collapse * 0.08, 1 - collapse * 0.94, 1)
        const positions = band.geometry.attributes.position
        const original = band.userData.base
        for (let vertex = 0; vertex < positions.count; vertex++) positions.setZ(vertex, Math.cos(original[vertex * 3] / PAGE_WIDTH * Math.PI) * neutral * 0.18)
        positions.needsUpdate = true
        band.geometry.computeBoundingSphere()
      })
      entry.root.position.x = lerp(entry.root.position.x, -1.65, collapse)
      entry.root.position.y = lerp(entry.root.position.y, -1.3, collapse)
      entry.root.updateMatrixWorld(true)
    })
    this.strips.forEach(entry => {
      const lift = smooth01(time, 25.45 + entry.index * 0.16, 3.0)
      const source = film.source[entry.index].root
      const origin = source.localToWorld(new THREE.Vector3(0, (0.5 - (entry.top + entry.height / 2) / SCREEN_H) * PAGE_HEIGHT, 0.008))
      const destination = new THREE.Vector3(-1.65, 1.40 - entry.index * 0.52, 0.95)
      const stacked = new THREE.Vector3(-1.65, -1.3 + entry.index * 0.018, 0.75 - entry.index * 0.015)
      entry.root.position.copy(origin).lerp(destination, lift).lerp(stacked, fold)
      entry.root.quaternion.copy(source.quaternion).slerp(new THREE.Quaternion(), lift)
      entry.root.scale.setScalar(lerp(PAGE_WIDTH * 960 / SCREEN_W / STRIP_WIDTH * source.scale.x, 1, lift) * lerp(1, 0.74, fold))
      const rewrite = smooth01(time, 27.7 + entry.index * 0.12, 1.0)
      const opacity = windowAt(time, 25.45 + entry.index * 0.16, 34.4, 0.35, 1.1) * (1 - smooth01(fold, 0.25, 0.7) * 0.45)
      fade(entry.image, opacity * (1 - smooth01(rewrite, 0, 0.55)))
      fade(entry.step, opacity * smooth01(rewrite, 0.28, 0.72))
      entry.material.userData.extraction.value = lift
    })
    film.constraints.forEach((entry, index) => {
      const emerge = smooth01(time, 29.3 + index * 0.45, 2.0)
      const origin = new THREE.Vector3(-1.65, 1.4 - [1, 3, 2][index] * 0.52, 1.02)
      const output = new THREE.Vector3(2.35, 1.05 - index * 1.12, 0.95)
      const final = new THREE.Vector3((index - 1) * 2.75, 0.15, 0.95)
      entry.root.position.copy(origin).lerp(output, emerge).lerp(final, retention)
      entry.root.rotation.set(0, 0, 0)
      entry.root.scale.setScalar(lerp(0.72, 1, emerge))
      if (index === 2) entry.root.scale.x *= 1 + windowAt(time, 38.8, 43, 1, 0.8) * 0.08
      fade(entry.root, smooth01(emerge, 0.45, 0.5) * (index === 2 ? 1 : 1 - smooth01(time, 37.3, 1.0)))
    })
    fade(film.kept, 0)
    fade(film.removed, 0)
    fade(film.spine.mesh, 0)
    const parserExit = 1 - smooth01(time, 24.0, 0.9)
    for (const object of [film.structure, film.pixelLabel, film.rowSelection, film.correspondence.mesh, film.sameTarget]) fade(object, windowAt(time, 16.3, 25.1, 1.9, 1.5) * parserExit)
    const doctor = smooth01(smooth01(time, 30.2, 2), 0.45, 0.5)
    fade(film.constraints[2].title, doctor * (1 - smooth01(time, 38.2, 0.9)))
    fade(film.hole, doctor * (1 - smooth01(time, 40.5, 0.6)))
    fade(film.constraints[2].outline, doctor)
    fade(film.constraints[2].kicker, doctor)
    fade(this.planLabel, windowAt(time, 28.2, 32.5, 1, 0.8))
    fade(this.systemLabel, windowAt(time, 30.0, 34.5, 1, 0.8))
    fade(this.humanLabel, windowAt(time, 30.4, 33.0, 0.8, 0.8))
    fade(this.questionLabel, windowAt(time, 35.0, 38.3, 0.8, 0.7))
    if (time < 40) {
      const pose = this.camera.apply(time, film.stage.camera, film.stage.rig, { handheld: 0 })
      film.stage.setFocus(pose.pos.distanceTo(pose.look), 0.000012, 0.0008)
    }
  }
}
