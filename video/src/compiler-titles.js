import * as THREE from 'three'
import { windowAt } from './compiler-design.js'

export class CompilerTitles {
  constructor(stage, cues) {
    this.cues = cues
    this.canvas = document.createElement('canvas')
    this.canvas.width = stage.renderWidth
    this.canvas.height = stage.renderHeight
    this.context = this.canvas.getContext('2d')
    this.context.scale(stage.renderScale, stage.renderScale)
    this.texture = new THREE.CanvasTexture(this.canvas)
    this.texture.colorSpace = THREE.SRGBColorSpace
    this.texture.minFilter = THREE.LinearFilter
    this.texture.generateMipmaps = false
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1920, 1080), new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }))
    this.mesh.renderOrder = 100
    stage.overlay.add(this.mesh)
  }

  update(time) {
    const context = this.context
    context.clearRect(0, 0, 1920, 1080)
    if (time < 96.3) {
      const gradient = context.createLinearGradient(0, 780, 0, 1080)
      gradient.addColorStop(0, 'rgba(16,17,20,0)')
      gradient.addColorStop(0.58, 'rgba(16,17,20,0.66)')
      gradient.addColorStop(1, 'rgba(16,17,20,0.92)')
      context.fillStyle = gradient
      context.fillRect(0, 780, 1920, 300)
    }
    this.write('银龄智办', 82, 72, 25, '#ded9cc', 500)
    this.write('为 人 编 译', 218, 72, 19, '#b69c75', 400)
    if (time < 9.5) this.write('机制可视化 · 示例任务', 1838, 72, 19, '#919b9a', 400, 'right')
    for (const cue of this.cues) {
      const opacity = windowAt(time, cue.start, cue.end, 0.6, 0.45)
      if (opacity <= 0.001) continue
      context.save()
      context.globalAlpha = opacity
      this.write(cue.phase, 82, 128, 20, '#c4ae8d', 400)
      context.fillStyle = '#d7ac70'
      context.fillRect(84, 879, cue.hero ? 110 : 51, 2)
      const offset = (1 - opacity) * 9
      context.shadowColor = 'rgba(7,12,16,0.95)'
      context.shadowBlur = 14
      this.write(cue.main, 80, 944 + offset, cue.hero ? 62 : 45, '#ede7db', cue.hero ? 500 : 400)
      this.write(cue.detail, 83, 1002 + offset, 26, '#aab7b7', 400)
      context.restore()
    }
    if (time > 98.0) {
      const opacity = Math.min(1, (time - 98.0) / 1.5)
      context.save()
      context.globalAlpha = opacity
      this.write('一场把界面的语言，转换成人的语言的编译。', 960, 1004, 24, '#a9b5b3', 400, 'center')
      context.restore()
    }
    this.texture.needsUpdate = true
  }

  write(content, horizontal, vertical, size, color, weight = 400, align = 'left') {
    const context = this.context
    context.font = `${weight} ${size}px "Noto Sans CJK SC", sans-serif`
    context.textBaseline = 'middle'
    context.textAlign = align
    context.fillStyle = color
    context.fillText(content, horizontal, vertical)
  }
}
