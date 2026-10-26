import * as THREE from 'three'
import { Chapter } from '../chapter.js'
import { CameraRig } from '../stage.js'
import { makePhone } from '../props.js'
import { PhoneView } from '../phoneview.js'
import { SCREEN_W, SCREEN_H } from '../screen.js'
import { floatingPill } from './voice.js'
import { journeyPage } from './journey-ui.js'
import { caption, attach, fade, windowAt, smooth01 } from './mechanism-geometry.js'
import { buildActionMechanism } from './mechanism-actions.js'
import { buildTrustMechanism } from './mechanism-trust.js'
import { buildSkillMechanism } from './mechanism-skills.js'

export function buildMechanism(context) {
  return new MechanismChapter(context)
}

class MechanismChapter extends Chapter {
  constructor(context) {
    super(context)
    this.kind = this.chapter.name
    this.duration = this.chapter.end - this.chapter.start
    this.phone = attach(this.group, makePhone())
    this.phone.name = 'phone'
    this.phone.scale.setScalar(1.1)
    this.view = new PhoneView(this.stage, this.phone)
    this.pages = Object.fromEntries(['departments', 'doctors', 'dates', 'review', 'waiting', 'result'].map((kind) => [kind, journeyPage(kind)]))
    this.billboards = []
    this.quaternion = new THREE.Quaternion()
    this.aperture = 0.00016
    this.maxBlur = 0.0010
    const titles = {
      loop: '页面变化，重新确认目标', ladder: '分级自主：按信息与风险分工',
      guard: '信息交给家人，控制权留给本人', handback: '压缩步骤，不压缩决定权',
      evidence: '完成声明，要过两本账', teach: '经验是一册方法，不是一条坐标脚本',
      evolve: '让新经验先走进试验台', coda: '银龄智办',
    }
    this.title = this.text(titles[this.kind], [0, 1.42, 0], this.kind === 'coda' ? 0.50 : 0.23)
    this.titleY = 1.42
    if (['loop', 'ladder', 'handback'].includes(this.kind)) buildActionMechanism(this)
    else if (['guard', 'evidence'].includes(this.kind)) buildTrustMechanism(this)
    else buildSkillMechanism(this)
  }

  text(content, point, height = 0.16, color) {
    const mesh = attach(this.group, caption(content, height, color), point)
    this.billboards.push(mesh)
    return mesh
  }

  camera(keys) {
    const rig = new CameraRig()
    rig.at(this.chapter.start - 0.9, [0, 0.10, 4.45], [0, 0, 0], { fov: 34 })
    rig.at(this.chapter.start + 0.9, [0, 0.10, 4.45], [0, 0, 0], { fov: 34 })
    for (const [local, position, look, fov = 36, roll = 0] of keys) {
      rig.at(this.chapter.start + local, position, look, { fov, roll })
    }
    rig.at(this.chapter.end - 0.9, [0, 0.10, 4.45], [0, 0, 0], { fov: 34 })
    rig.at(this.chapter.end + 0.9, [0, 0.10, 4.45], [0, 0, 0], { fov: 34 })
    this.cameraRig = rig
  }

  pose(local, point, scale = 0.75, rotation = [0, -0.12, 0], close = this.duration - 3.4) {
    const amount = windowAt(local, 1.0, close, 1.5, 1.5)
    this.phone.position.set(...point).multiplyScalar(amount)
    this.phone.scale.setScalar(1.1 + (scale - 1.1) * amount)
    this.phone.rotation.set(...rotation.map((value) => value * amount))
    return amount
  }

  show(object, opacity) {
    fade(object, opacity * this.env)
  }

  page(first, second, local, start = Infinity, duration = 0.8) {
    const mix = smooth01(local, start, duration)
    const context = this.view.g
    context.drawImage(this.pages[first], 0, 0, SCREEN_W, SCREEN_H)
    if (second && mix > 0) {
      context.save()
      context.globalAlpha = mix
      context.drawImage(this.pages[second], 0, 0, SCREEN_W, SCREEN_H)
      context.restore()
    }
  }

  update(local, absolute, env) {
    this.env = env
    this.phone.visible = true
    this.phone.position.set(0, 0, 0)
    this.phone.rotation.set(0, 0, 0)
    this.phone.scale.setScalar(1.1)
    this.title.position.y = 1.06 + smooth01(local, 1.5, 1.8) * (this.titleY - 1.06)
    this.show(this.title, windowAt(local, 1.0, this.duration - 3.7, 0.7, 0.7))
    this.animate(local)
    floatingPill(this.view.g, absolute - 44, 1, this.status ?? { label: '正在办', working: true })
    this.view.commitNow()
  }

  afterCamera(camera) {
    camera.getWorldQuaternion(this.quaternion)
    for (const mesh of this.billboards) mesh.quaternion.copy(this.quaternion)
  }
}
