import * as THREE from 'three'
import { CHAPTERS, chapterAt } from './timeline.js'
import { smooth01 } from './ease.js'
import { textPlane, textTexture } from './text.js'
import { WIDTH, HEIGHT } from './stage.js'

export class ChapterGuide {
  constructor(stage) {
    this.renderScale = stage.renderScale
    this.entries = new Map()
    this.groups = []
    for (const chapter of CHAPTERS.filter((entry) => entry.section)) {
      const group = new THREE.Group()
      group.renderOrder = 105
      stage.overlay.add(group)
      const [section, mechanism] = chapter.section.split(' · ')
      const number = chapter.start < 44 ? '01' : chapter.start < 166 ? '02' : '03'
      this.line(group, `${number} / ${section}`, 24, 0x88b9a6, HEIGHT / 2 - 73)
      this.line(group, `${chapter.title}${mechanism ? ` · ${mechanism}` : ''}`, 28, 0xdce5df, HEIGHT / 2 - 117)
      const accent = new THREE.Mesh(new THREE.PlaneGeometry(34, 2), new THREE.MeshBasicMaterial({ color: 0x88b9a6, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }))
      accent.position.set(-WIDTH / 2 + 91, HEIGHT / 2 - 39, 2)
      group.add(accent)
      this.entries.set(chapter.name, group)
      this.groups.push(group)
    }
  }

  line(group, content, size, color, vertical) {
    const options = { size, color, font: '500 1px "Noto Sans CJK SC", sans-serif', supersample: this.renderScale, align: 'left' }
    const texture = textTexture(content, options)
    const mesh = textPlane(content, { ...options, worldHeight: texture.height })
    mesh.position.set(-WIDTH / 2 + 74 + texture.width / 2, vertical, 2)
    mesh.material.depthTest = false
    mesh.material.depthWrite = false
    mesh.renderOrder = 106
    group.add(mesh)
  }

  update(time) {
    const chapter = chapterAt(time)
    const selected = this.entries.get(chapter.name)
    for (const group of this.groups) group.visible = group === selected
    if (!selected) return
    const opacity = Math.min(smooth01(time, chapter.start + 0.6, 0.7), 1 - smooth01(time, chapter.end - 1.3, 0.7)) * 0.82
    for (const child of selected.children) child.material.opacity = opacity
  }
}
