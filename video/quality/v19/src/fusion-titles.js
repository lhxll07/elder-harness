import { CompilerTitles } from './compiler-titles.js'
import { windowAt, smooth01, lerp } from './compiler-design.js'
import { EXPERIENCE_END } from './fusion-script.js'
import { editAt, editTime } from './fusion-edit.js'

export class FusionTitles extends CompilerTitles {
  update(time) {
    const source = editTime(time)
    const edit = editAt(time)
    const context = this.context
    context.clearRect(0, 0, 1920, 1080)
    if (source < EXPERIENCE_END + 0.3) {
      const gradient = context.createLinearGradient(0, 790, 0, 1080)
      gradient.addColorStop(0, 'rgba(12,19,22,0)')
      gradient.addColorStop(0.6, 'rgba(12,19,22,0.63)')
      gradient.addColorStop(1, 'rgba(12,19,22,0.91)')
      context.fillStyle = gradient
      context.fillRect(0, 790, 1920, 290)
    }
    if (source > 11.4 && source < EXPERIENCE_END + 0.5) {
      context.save()
      const emphasis = smooth01(source, 13.9, 0.75)
      const handoff = smooth01(source, 15.8, 2.0)
      context.globalAlpha = smooth01(source, 11.4, 0.6) * (1 - smooth01(source, EXPERIENCE_END - 0.5, 1))
      this.write('银龄智办', lerp(960, 132, handoff), lerp(lerp(102, 530, emphasis), 72, handoff), lerp(lerp(67, 108, emphasis), 25, handoff), '#e6e9e9', 500, 'center')
      context.globalAlpha *= smooth01(source, 17.0, 0.8)
      this.write(source < 44 ? '从一句话，到一次办事' : '为 人 编 译', 218, 72, 19, '#c0a67d')
      context.restore()
    }
    if ((source >= 135 || edit.detail || edit.name === 'compile') && source < EXPERIENCE_END) {
      context.save()
      context.globalAlpha = edit.detail || edit.name === 'compile' ? windowAt(time, edit.start, edit.end - 0.3, 0.3, 0.3) : windowAt(source, 135.4, EXPERIENCE_END - 1.2, 0.9, 1.2)
      this.write(edit.name === 'compile' ? '流程结构示意 · 后续页面逐页观察' : '机制演示 · 示例数据', 1816, 128, 22, '#a2b3bd', 400, 'right')
      context.restore()
    }
    if (time > 36.0 && time < 39.4) {
      const pause = windowAt(time, 36.0, 38.9, 0.5, 0.5)
      context.save()
      context.globalAlpha = pause
      context.fillStyle = 'rgba(6,10,14,0.52)'
      context.fillRect(0, 0, 1920, 1080)
      context.fillStyle = '#d7ac70'
      context.fillRect(1080, 410, 72, 2)
      this.write('好，先不操作。', 1080, 492, 72, '#ede7db', 500, 'left')
      this.write('已暂停，等您决定。', 1080, 566, 29, '#aab7b7', 400, 'left')
      context.restore()
    }
    for (const cue of this.cues) {
      const opacity = windowAt(time, cue.start, cue.end, time < 42 ? 0.5 : 0.28, time < 42 ? 0.35 : 0.22)
      if (opacity <= 0.001) continue
      context.save()
      context.globalAlpha = opacity
      if (cue.phase) this.write(cue.phase, 104, 124, 22, '#c4ae8d')
      context.fillStyle = '#d7ac70'
      context.fillRect(108, 826, cue.hero ? 124 : 54, 2)
      context.shadowColor = 'rgba(7,12,16,0.95)'
      context.shadowBlur = 14
      this.write(cue.main, 104, 890 + (1 - opacity) * 8, cue.hero ? 68 : 48, '#ede7db', cue.hero ? 500 : 400)
      this.write(cue.detail, 107, 948 + (1 - opacity) * 8, 28, '#b6c2c2')
      context.restore()
    }
    if (time > 178.62 && time < 179.55) {
      const dip = Math.min(smooth01(time, 178.62, 0.28), 1 - smooth01(time, 179.18, 0.30))
      context.save()
      context.globalAlpha = dip * 0.94
      context.fillStyle = '#04080c'
      context.fillRect(0, 0, 1920, 1080)
      context.restore()
    }
    if (source > EXPERIENCE_END + 10.6) {
      context.save()
      context.globalAlpha = smooth01(source, EXPERIENCE_END + 10.6, 1.6)
      this.write('银龄智办', 960, 414, 105, '#edf3f5', 500, 'center')
      this.write('为 人 编 译', 960, 505, 29, '#b3cabf', 400, 'center')
      this.write('压缩流程，保留决定。', 960, 623, 55, '#edf3f5', 500, 'center')
      this.write('真机实验 R1–R3 · 20 位老人试用记录，见佐证材料', 960, 688, 22, '#8fa3a0', 400, 'center')
      this.write('让每一次办事，都成为看得懂、做得稳的一步。', 960, 1000, 27, '#b5c5c0', 400, 'center')
      context.restore()
    }
    this.texture.needsUpdate = true
  }
}
