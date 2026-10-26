import { Stage, CameraRig, WIDTH, HEIGHT } from './stage.js'
import { SCREEN_W, SCREEN_H } from './screen.js'
import { floatingPill } from './shots/voice.js'
import { CompilerFilm } from './compiler-film.js'
import { FusionOpening } from './fusion-opening.js'
import { FusionRuntime } from './fusion-runtime.js'
import { FusionMemory } from './fusion-memory.js'
import { FusionDetail } from './fusion-detail.js'
import { FusionCompile } from './fusion-compile.js'
import { FusionEnding } from './fusion-ending.js'
import { finishFusion } from './fusion-finish.js'
import { FusionTitles } from './fusion-titles.js'
import { editAt, editTime } from './fusion-edit.js'
import { DURATION, VERSION, BEATS, CUES, EXPERIENCE_END, compilerTime, openingTime, runtimeTime, studioTime } from './fusion-script.js'
import { THREE, PAGE_HEIGHT, fade, smooth01, lerp, windowAt } from './compiler-design.js'

export async function boot() {
  await Promise.all(['400', '500', '600', '700'].map(weight => document.fonts.load(`${weight} 96px "Noto Sans CJK SC"`)))
  await document.fonts.load('400 96px "Noto Serif CJK SC"')
  await document.fonts.ready
  const family = Object.fromEntries(await Promise.all(['request', 'compose', 'read'].map(async name => {
    const image = new Image()
    image.src = `/assets/family/${name}.png`
    await image.decode()
    return [name, image]
  })))
  const stage = new Stage(document.getElementById('view'))
  const opening = new FusionOpening(stage)
  const film = new FusionFilm(stage, family, opening)
  const detail = new FusionDetail(stage, film)
  const titles = new FusionTitles(stage, CUES)
  const finish = finishFusion(stage)
  window.__stage = stage
  window.__fusion = film
  window.__fusionDetail = detail
  window.__fusionFinish = finish
  window.__film = { title: `银龄智办 · 为人编译 · v${VERSION}`, duration: DURATION, width: WIDTH, height: HEIGHT, renderWidth: stage.renderWidth, renderHeight: stage.renderHeight, renderScale: stage.renderScale, shots: BEATS }
  window.__setSceneAt = time => {
    try {
      const source = editTime(time)
      window.__expectedSceneVisible = time >= 1.3
      stage.setTime(source < 40 ? openingTime(source) : studioTime(source))
      stage.setFade(smooth01(time, -0.6, 1.8))
      detail.root.visible = false
      film.update(source)
      detail.update(editAt(time), time)
      finish.update(time)
      if (opening.voice.group.visible) opening.voice.afterCamera?.(stage.camera)
      titles.update(time)
    } catch (error) {
      window.__error = String(error.stack || error)
      throw error
    }
  }
  window.__renderAt = time => {
    window.__setSceneAt(time)
    stage.render()
  }
  Object.defineProperty(window, '__contextLost', { get: () => stage.contextLost })
  window.__renderAt(0)
  document.getElementById('boot').classList.add('hidden')
  window.__ready = true
}

class FusionFilm extends CompilerFilm {
  constructor(stage, family, opening) {
    super(stage, family)
    this.camera.flow(0.55)
    this.opening = opening
    this.compile = new FusionCompile(this)
    this.runtime = new FusionRuntime(this)
    this.memory = new FusionMemory(this)
    this.ending = new FusionEnding(this)
    this.bridgeCamera = new CameraRig().flow(0.6)
    const start = opening.endCamera
    const finish = this.camera.sample(14)
    this.bridgeCamera.at(40, start.pos.toArray(), start.look.toArray(), { fov: start.fov, roll: start.roll })
    this.bridgeCamera.at(43, [0.1, 0.16, 4.6], [0, 0.02, 0], { fov: 34 })
    this.bridgeCamera.at(46.7, [3.2, 1.3, 8.4], [0, 0.1, -0.3], { fov: 39, roll: -3 })
    this.bridgeCamera.at(50, finish.pos.toArray(), finish.look.toArray(), { fov: finish.fov, roll: finish.roll })
    this.runtimeCamera = new CameraRig().flow(0.65)
    const runtimeStart = this.camera.sample(54)
    const runtimeEnd = this.camera.sample(68)
    this.runtimeCamera.at(90, runtimeStart.pos.toArray(), runtimeStart.look.toArray(), { fov: runtimeStart.fov, roll: runtimeStart.roll })
    for (const [time, position, look, fov, roll = 0] of [
      [95, [2.4, 1.1, 8.2], [0, 0.1, 0], 39, 2],
      [99, [-2.2, 1.1, 8.9], [-0.3, 0.1, 0], 40, -3],
      [104, [1.8, 1.1, 8.6], [0.1, 0.1, 0], 39, 2],
      [110, [0.6, 2.1, 10.7], [-0.2, 0.1, 0], 40, 0],
      [114, [-1.4, 1.5, 10.6], [-0.2, 0.1, 0], 40, -2],
      [116, [0.6, 0.8, 8.1], [0.1, 0.1, 0], 39, 0],
    ]) this.runtimeCamera.at(time, position, look, { fov, roll })
    this.runtimeCamera.at(118, runtimeEnd.pos.toArray(), runtimeEnd.look.toArray(), { fov: runtimeEnd.fov, roll: runtimeEnd.roll })
  }

  buildRoom() {
    const existing = new Set(this.stage.scene.children)
    super.buildRoom()
    this.roomLights = this.stage.scene.children.filter(object => !existing.has(object) && object.isLight).map(light => ({ light, intensity: light.intensity }))
    const material = this.stage.studio.background.material
    material.uniforms.outer = { value: 1 }
    material.uniforms.uTime = this.stage.studio.uniforms.uTime
    material.fragmentShader = material.fragmentShader.replace('uniform float warmth;', 'uniform float warmth; uniform float outer; uniform float uTime;').replace('gl_FragColor = vec4(base, 1.0);', `
      float drift = sin(uTime * 0.018) * 0.055;
      vec3 outside = mix(vec3(0.010, 0.015, 0.024), vec3(0.027, 0.040, 0.054), smoothstep(-0.45, 0.5, normal.y));
      float cool = exp(-7.0 * pow(normal.x + 0.58 + drift, 2.0) - 4.5 * pow(normal.y - 0.14, 2.0));
      float warm = exp(-12.0 * pow(normal.x - 0.70 + drift, 2.0) - 6.0 * pow(normal.y + 0.06, 2.0));
      float silk = normal.y - 0.11 - 0.25 * normal.x - 0.13 * normal.x * normal.x - drift;
      outside += vec3(0.008, 0.022, 0.032) * cool + vec3(0.016, 0.016, 0.018) * warm;
      outside += vec3(0.004, 0.010, 0.017) * exp(-silk * silk * 23.0) * exp(-normal.x * normal.x * 0.9);
      gl_FragColor = vec4(mix(base, outside, 0.72 + outer * 0.28), 1.0);
    `)
    const floorMaterial = this.stage.studio.floor.material
    floorMaterial.uniforms.roomFade = { value: 1 }
    floorMaterial.fragmentShader = floorMaterial.fragmentShader.replace('uniform float uTime;', 'uniform float uTime; uniform float roomFade;').replace('vec4(color, alpha)', 'vec4(color, alpha * roomFade)')
  }

  room(time) {
    if (time < 40) this.stage.studio.background.material.uniforms.warmth.value = 0
    const outside = 1 - smooth01(time, 43, 12) + smooth01(time, EXPERIENCE_END, 7) * 0.45
    this.stage.studio.background.material.uniforms.outer.value = Math.min(1, outside)
    this.stage.studio.floor.visible = true
    this.stage.studio.floor.material.uniforms.roomFade.value = 1 - smooth01(time, 40, 5)
    this.stage.scene.fog.density = lerp(0.012, 0.030, Math.min(1, outside))
    for (const { light, intensity } of this.roomLights) light.intensity = intensity * (1 - Math.min(1, outside))
  }

  update(time) {
    this.room(time)
    this.runtime.root.visible = false
    this.memory.root.visible = false
    this.ending.root.visible = false
    if (time < 40) {
      this.root.visible = false
      this.opening.update(time)
      return
    }
    this.root.visible = true
    this.opening.hide()
    const source = compilerTime(time)
    super.update(source)
    this.compile.update(source)
    if (time < 50) this.bridge(time)
    else if (time < 90) this.runtime.root.visible = false
    else if (time < 112) {
      this.runtime.update(runtimeTime(time))
      this.applyCamera(this.runtimeCamera, runtimeTime(time))
    }
    else if (time >= 135 && time < EXPERIENCE_END) this.memory.update(time)
    this.ending.update(time)
    if (time >= 125) for (const entry of this.source) fade(entry.root, 0)
    this.opening.tail(time)
  }

  applyCamera(rig, time) {
    const pose = rig.apply(time, this.stage.camera, this.stage.rig, { handheld: 0 })
    this.stage.setFocus(pose.pos.distanceTo(pose.look), 0.000025, 0.001)
  }

  bridge(time) {
    const amount = smooth01(time, 43, 7)
    const initial = this.opening.endPhone
    this.phone.position.lerpVectors(initial.position, this.phone.position.clone(), amount)
    this.phone.scale.setScalar(lerp(initial.scale, this.phone.scale.x, amount))
    this.phone.rotation.set(lerp(initial.rotation.x, this.phone.rotation.x, amount), lerp(initial.rotation.y, this.phone.rotation.y, amount), lerp(initial.rotation.z, this.phone.rotation.z, amount))
    fade(this.phone, lerp(1, 1 - smooth01(14, 13, 3), amount))
    const context = this.view.g
    context.drawImage(this.pages.home, 0, 0, SCREEN_W, SCREEN_H)
    context.save()
    context.globalAlpha = smooth01(time, 43.2, 0.9)
    context.drawImage(this.pages.departments, 0, 0, SCREEN_W, SCREEN_H)
    context.restore()
    floatingPill(context, time, 1, { label: time < 40.6 ? '停下了' : time < 42.8 ? '听到了' : '正在找入口', working: false })
    this.view.commitNow()
    this.phone.updateMatrixWorld(true)
    this.source.forEach((entry, index) => {
      const target = entry.root.position.clone()
      const progress = index === 1 ? amount : smooth01(time, 44.6 + index * 0.07, 50 - 44.6 - index * 0.07)
      entry.root.position.lerpVectors(new THREE.Vector3(0, 0, 0.06 - index * 0.015), target, progress)
      entry.root.scale.setScalar(lerp(1.48 * initial.scale / PAGE_HEIGHT, entry.root.scale.x, progress))
      entry.root.rotation.set(entry.root.rotation.x * progress, entry.root.rotation.y * progress, entry.root.rotation.z * progress)
      fade(entry.root, progress)
      fade(entry.heading, progress * smooth01(time, 46.6, 2.1))
      fade(entry.footer, progress * smooth01(time, 46.6, 2.1))
    })
    fade(this.masthead, smooth01(time, 46.2, 3.8))
    this.applyCamera(this.bridgeCamera, time)
  }
}
