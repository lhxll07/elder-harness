import { CameraRig } from './stage.js'
import { buildCameraPath } from './camera.js'
import { build as buildPrologue } from './shots/prologue.js'
import { build as buildVoice } from './shots/voice.js'
import { refineScene } from './shots/cinema-finish.js'
import { EASE, clamp, smooth01, lerp } from './ease.js'
import { fade } from './compiler-design.js'
import { openingTime } from './fusion-script.js'

function envelope(time, start, end) {
  return Math.min(EASE.exit(clamp((time - start + 0.9) / 1.215, 0, 1)), EASE.entry(clamp((end + 0.9 - time) / 1.215, 0, 1)))
}

export class FusionOpening {
  constructor(stage) {
    this.stage = stage
    this.camera = new CameraRig().flow(0.5)
    buildCameraPath(this.camera)
    this.prologue = buildPrologue({ stage, chapter: { name: 'prologue', start: 0, end: 16 } })
    this.voice = buildVoice({ stage, chapter: { name: 'voice', start: 16, end: 44 } })
    this.voice.cameraRig.flow(0.5)
    for (const chapter of [this.prologue, this.voice]) {
      refineScene(chapter.group)
      stage.world.add(chapter.group)
    }
    this.voice.update(28, 44, 1)
    this.endPhone = {
      position: this.voice.phone.position.clone(),
      rotation: this.voice.phone.rotation.clone(),
      scale: this.voice.phone.scale.x,
    }
    this.endCamera = this.voice.cameraRig.sample(44)
    this.pauseFade = false
    this.hide()
  }

  hide() {
    this.prologue.group.visible = false
    this.voice.group.visible = false
  }

  tail(time) {
    this.prologue.group.visible = false
    this.voice.group.visible = time < 41.2
    if (!this.voice.group.visible) return
    this.voice.update(28, 44, 1 - smooth01(time, 40, 0.8))
    this.voice.phone.visible = false
    this.voice.afterCamera?.(this.stage.camera)
  }

  update(time) {
    const source = openingTime(time)
    const prologueAmount = envelope(source, 0, 16)
    const voiceAmount = source > 41.5 ? 1 : envelope(source, 16, 44)
    this.prologue.group.visible = source < 18.2
    this.voice.group.visible = source > 15.1
    if (this.prologue.group.visible) this.prologue.update(source, source, prologueAmount)
    this.prologue.title.visible = false
    if (source >= 14 && source < 18.2) {
      const emphasis = smooth01(source, 13.9, 0.65)
      const handoff = smooth01(source, 15.8, 0.8)
      this.prologue.title.position.set(-0.75 * handoff, lerp(1.04 * (1 - emphasis), 1.05, handoff), lerp(0.12 + emphasis * 0.18, 0.2, handoff))
      this.prologue.title.scale.setScalar(lerp(1 + emphasis * 1.25, 0.625, handoff))
      this.prologue.title.visible = false
    }
    if (this.voice.group.visible) this.voice.update(source - 16, source, voiceAmount)
    this.voice.cards.acknowledgement.userData.setOpacity(0)
    const pause = smooth01(source, 39.4, 0.7) * (1 - smooth01(source, 42.9, 0.7))
    if (pause > 0.001) {
      fade(this.voice.phone, 1 - pause * 0.95)
      this.pauseFade = true
    } else if (this.pauseFade) {
      fade(this.voice.phone, 1)
      this.pauseFade = false
    }
    this.voice.leadInTexts[0].visible = false
    if (source < 16) this.voice.phone.visible = false
    else this.prologue.phone.visible = false
    const rig = source >= 16 ? this.voice.cameraRig : this.camera
    const pose = rig.apply(source, this.stage.camera, this.stage.rig, { handheld: 0 })
    if (source >= 15.2 && source < 17.6) {
      const handoff = smooth01(source, 15.2, 2.4)
      const previous = this.camera.sample(source)
      const next = this.voice.cameraRig.sample(source)
      const position = previous.pos.clone().lerp(next.pos, handoff)
      const look = previous.look.clone().lerp(next.look, handoff)
      this.stage.camera.position.copy(position)
      this.stage.camera.lookAt(look)
      this.stage.camera.fov = lerp(previous.fov, next.fov, handoff)
      this.stage.camera.rotateZ(lerp(previous.roll, next.roll, handoff) * Math.PI / 180)
      this.stage.camera.updateProjectionMatrix()
    }
    this.voice.afterCamera?.(this.stage.camera)
    const transition = smooth01(source, 15.1, 1.8)
    this.stage.setFocus(pose.pos.distanceTo(pose.look), 0.00055, 0.0028 + transition * 0.0001)
    this.stage.setExposure(0.92 + 0.08 * transition)
  }
}
