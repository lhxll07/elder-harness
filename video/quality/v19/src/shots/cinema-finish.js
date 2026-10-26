import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { roundedPlaneGeometry } from '../props.js'
import { COLOR, attach, drawing, write, surfaceTexture, smooth01, windowAt } from './mechanism-geometry.js'

export function machined(width, height, depth, color = 0x243d43, roughness = 0.29) {
  return new THREE.Mesh(
    new RoundedBoxGeometry(width, height, depth, 5, Math.min(width, height, depth) * 0.32),
    new THREE.MeshPhysicalMaterial({ color, metalness: 0.58, roughness, clearcoat: 0.28, clearcoatRoughness: 0.32, envMapIntensity: 0.9, transparent: true }),
  )
}

export function laminate(surface, width, height, color = 0x647b76, depth = 0.052) {
  attach(surface, machined(width + 0.018, height + 0.018, depth, color, 0.43), [0, 0, -depth / 2 - 0.014])
  return surface
}

export function backedSheet(canvas, width, height, tint = 0xf0f5ef) {
  const surface = new THREE.Mesh(roundedPlaneGeometry(width, height, 0.045, 32), new THREE.MeshBasicMaterial({ map: surfaceTexture(canvas), color: tint, side: THREE.DoubleSide, transparent: true, depthWrite: false, toneMapped: false }))
  return laminate(surface, width, height, 0x81968c, 0.038)
}

export function ticket(title, detail = '', width = 1.38, height = 0.52, color = COLOR.mint) {
  const surface = drawing(width, height, (context, canvasWidth, canvasHeight) => {
    const gradient = context.createLinearGradient(0, 0, canvasWidth, canvasHeight)
    gradient.addColorStop(0, '#254d4b')
    gradient.addColorStop(0.65, '#1d373e')
    gradient.addColorStop(1, '#172c34')
    context.fillStyle = gradient
    context.fillRect(0, 0, canvasWidth, canvasHeight)
    context.fillStyle = new THREE.Color(color).getStyle()
    context.fillRect(0.075, height * 0.20, 0.012, height * 0.58)
    let titleSize = height * (detail ? 0.245 : 0.27)
    context.font = `500 ${titleSize}px "Noto Sans CJK SC", sans-serif`
    while (context.measureText(title).width > width - 0.25 && titleSize > 0.035) {
      titleSize -= 0.003
      context.font = `500 ${titleSize}px "Noto Sans CJK SC", sans-serif`
    }
    write(context, title, 0.14, detail ? height * 0.36 : height * 0.5, titleSize, '#e1e9e2')
    if (detail) write(context, detail, 0.14, height * 0.76, Math.min(height * 0.16, (width - 0.26) / Math.max(8, detail.length)), '#a0b9b4')
  })
  return laminate(surface, width, height, 0x345650, 0.058)
}

export function foldedNote() {
  const root = new THREE.Group()
  const leaves = []
  for (const side of [-1, 1]) {
    const pivot = attach(root, new THREE.Group())
    const leaf = drawing(0.90, 0.86, (context, width, height) => {
      const stock = context.createLinearGradient(0, 0, width, height)
      stock.addColorStop(0, '#e3e0ce')
      stock.addColorStop(0.55, '#d4d9c5')
      stock.addColorStop(1, '#bbc9b8')
      context.fillStyle = stock
      context.fillRect(0, 0, width, height)
      for (let fiber = 0; fiber < 700; fiber++) {
        context.fillStyle = fiber % 3 ? 'rgba(65,80,56,0.025)' : 'rgba(255,255,240,0.12)'
        context.fillRect(((fiber * 127) % 997) / 997 * width, ((fiber * 239) % 991) / 991 * height, 0.018, 0.001)
      }
      const crease = context.createLinearGradient(side < 0 ? width - 0.065 : 0, 0, side < 0 ? width : 0.065, 0)
      crease.addColorStop(0, side < 0 ? 'rgba(48,72,49,0)' : 'rgba(48,72,49,0.16)')
      crease.addColorStop(1, side < 0 ? 'rgba(48,72,49,0.16)' : 'rgba(48,72,49,0)')
      context.fillStyle = crease
      context.fillRect(side < 0 ? width - 0.065 : 0, 0, 0.065, height)
      if (side < 0) {
        write(context, '家人留言', 0.08, 0.14, 0.082, '#667c5e')
        write(context, '上次陈医生，', 0.08, 0.38, 0.103, '#2b4335')
        write(context, '您再核对一下。', 0.08, 0.62, 0.080, '#354c3a')
      } else {
        context.strokeStyle = '#91a88c'
        context.lineWidth = 0.003
        for (let row = 0; row < 4; row++) {
          context.beginPath()
          context.moveTo(0.09, 0.18 + row * 0.16)
          context.lineTo(0.76 - row * 0.055, 0.18 + row * 0.16)
          context.stroke()
        }
        write(context, '信息补齐，交给您核对', 0.08, 0.78, 0.042, '#6c8068')
      }
    })
    laminate(leaf, 0.898, 0.858, 0xbac6ae, 0.014)
    attach(pivot, leaf, [side * 0.45, 0, 0])
    leaves.push({ pivot, side })
  }
  root.userData.fold = (amount) => leaves.forEach(({ pivot, side }) => { pivot.rotation.y = -side * amount * Math.PI * 0.78 })
  return root
}

export function laptopDetails(parent) {
  const keys = new THREE.InstancedMesh(new RoundedBoxGeometry(0.23, 0.018, 0.105, 4, 0.006), new THREE.MeshPhysicalMaterial({ color: 0x1b2c32, roughness: 0.46, metalness: 0.30, transparent: true }), 52)
  const transform = new THREE.Object3D()
  for (let index = 0; index < 52; index++) {
    transform.position.set((index % 13 - 6) * 0.268, -1.231, 0.13 + Math.floor(index / 13) * 0.14)
    transform.updateMatrix()
    keys.setMatrixAt(index, transform.matrix)
  }
  attach(parent, keys)
  const legends = drawing(3.48, 0.52, (context) => {
    const rows = ['1234567890−＝⌫', 'QWERTYUIOP［］\\', 'ASDFGHJKL；＇↵⌁', 'ZXCVBNM，．／↑←→']
    rows.forEach((row, rowIndex) => [...row].forEach((letter, column) => write(context, letter, 0.132 + column * 0.268, 0.05 + rowIndex * 0.14, 0.035, '#a4b5b5', 'center')))
  })
  attach(parent, legends, [0, -1.220, 0.34]).rotation.x = -Math.PI / 2
  attach(parent, machined(1.12, 0.009, 0.34, 0x647b80, 0.40), [0, -1.240, 1.04])
  attach(parent, machined(1.08, 0.003, 0.30, 0x70858a, 0.48), [0, -1.233, 1.04])
  attach(parent, machined(3.56, 0.055, 0.11, 0x607b80, 0.22), [0, -1.205, -0.08])
  for (const side of [-1, 1]) {
    attach(parent, machined(0.08, 0.059, 0.112, 0x314950, 0.38), [side * 1.72, -1.205, -0.08])
    for (let slot = 0; slot < 18; slot++) attach(parent, machined(0.10, 0.003, 0.009, 0x2e454b, 0.52), [side * 1.91, -1.237, 0.10 + slot * 0.031])
  }
  const camera = new THREE.Mesh(new THREE.SphereGeometry(0.018, 16, 8), new THREE.MeshPhysicalMaterial({ color: 0x122a32, roughness: 0.16, metalness: 0.58, transparent: true }))
  attach(parent, camera, [0, 1.185, -0.006])
}

export function refineScene(group) {
  const devices = new Set()
  group.traverse((object) => {
    if (object.userData.screenMat) object.traverse((part) => devices.add(part))
  })
  group.traverse((object) => {
    if (devices.has(object)) return
    if (object.geometry?.type === 'BoxGeometry') {
      const { width, height, depth } = object.geometry.parameters
      object.geometry = new RoundedBoxGeometry(width, height, depth, 4, Math.min(width, height, depth) * 0.24)
    }
    if (!object.material) return
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material.map) {
        material.map.generateMipmaps = true
        material.map.minFilter = THREE.LinearMipmapLinearFilter
        material.map.anisotropy = 16
      }
      if (material.isMeshStandardMaterial) material.envMapIntensity = 0.9
    }
  })
}

function atmosphere(color) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const context = canvas.getContext('2d')
  const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128)
  gradient.addColorStop(0, '#ffffff')
  gradient.addColorStop(0.3, '#ffffff58')
  gradient.addColorStop(0.72, '#ffffff10')
  gradient.addColorStop(1, '#ffffff00')
  context.fillStyle = gradient
  context.fillRect(0, 0, 256, 256)
  const texture = new THREE.CanvasTexture(canvas)
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: texture, color, transparent: true, opacity: 0.15, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }))
  mesh.scale.set(10, 5.8, 1)
  return mesh
}

export function finishChapter(chapter) {
  const phoneObjects = new Set()
  chapter.phone.traverse((object) => phoneObjects.add(object))
  chapter.group.traverse((object) => {
    if (phoneObjects.has(object)) return
    if (object.geometry?.type === 'BoxGeometry') {
      const { width, height, depth } = object.geometry.parameters
      object.geometry = new RoundedBoxGeometry(width, height, depth, 3, Math.min(width, height, depth) * 0.28)
    }
    if (!object.material) return
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      material.transparent = true
      if (material.map) {
        material.map.generateMipmaps = true
        material.map.minFilter = THREE.LinearMipmapLinearFilter
        material.map.anisotropy = 16
        material.map.needsUpdate = true
      }
      if (material.isMeshStandardMaterial) {
        material.roughness = Math.max(0.27, material.roughness)
        material.envMapIntensity = 0.85
      }
      if (object.isLineSegments) material.opacity *= 0.40
      material.needsUpdate = true
    }
  })
  const cool = attach(chapter.group, atmosphere(0x326d70), [-2.8, 0.6, -4.2])
  const warm = attach(chapter.group, atmosphere(0x756041), [3.5, 1.8, -5.1])
  const edge = attach(chapter.group, new THREE.PointLight(0xb0d7c9, 14, 13, 2), [-3.5, 3.0, 2.6])
  const rim = attach(chapter.group, new THREE.PointLight(0xe3c99e, 11, 12, 2), [3.8, 1.7, -0.8])
  chapter.finish = (local) => {
    const amount = chapter.kind === 'coda' ? smooth01(local, 0.4, 1.8) : windowAt(local, 1.8, chapter.duration - 1.6, 1.2, 1.3)
    chapter.show(cool, amount * 0.70)
    chapter.show(warm, amount * 0.52)
    cool.position.x = -2.8 + Math.sin(local * 0.11) * 0.28
    warm.position.y = 1.8 + Math.sin(local * 0.09) * 0.16
    edge.intensity = 14 * amount * chapter.env
    rim.intensity = 11 * amount * chapter.env
  }
}
