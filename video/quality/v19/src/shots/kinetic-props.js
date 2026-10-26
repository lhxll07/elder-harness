import * as THREE from 'three'
import { makeGlow } from '../props.js'
import { attach, caption, drawing, write, solid, surfaceTexture, fade, COLOR } from './mechanism-geometry.js'
import { backedSheet, machined } from './cinema-finish.js'
import { clamp01, smooth01 } from '../ease.js'

export function paper(canvas, width, height) {
  const root = new THREE.Group()
  const surface = attach(root, backedSheet(canvas, width, height))
  surface.material.depthWrite = true
  surface.renderOrder = 2
  return root
}

export function printedPage(heading, lines, width = 2.4, height = 3.2, accent = '#397966') {
  const surface = drawing(width, height, (context) => {
    const compact = height < 1.7
    const stock = context.createLinearGradient(0, 0, width, height)
    stock.addColorStop(0, '#f5f3e9')
    stock.addColorStop(1, '#dce6db')
    context.fillStyle = stock
    context.fillRect(0, 0, width, height)
    context.fillStyle = accent
    context.fillRect(0.15, compact ? height * 0.19 : 0.22, 0.025, compact ? height * 0.32 : 0.33)
    write(context, heading, 0.25, compact ? height * 0.31 : 0.37, compact ? Math.min(0.19, height * 0.24) : 0.19, '#28443f')
    lines.forEach((line, index) => {
      const vertical = compact ? height * (0.64 + index * 0.16 / Math.max(1, lines.length)) : 0.85 + index * (height - 1.15) / Math.max(1, lines.length)
      context.strokeStyle = 'rgba(54,87,69,0.13)'
      context.lineWidth = 0.002
      context.beginPath()
      context.moveTo(0.22, vertical + 0.20)
      context.lineTo(width - 0.22, vertical + 0.20)
      context.stroke()
      write(context, line, 0.25, vertical, Math.min(compact ? height * 0.15 : 0.14, (width - 0.5) / Math.max(1, line.length)), '#426054')
    })
    if (!compact) write(context, '银龄智办 / 机制示意', 0.25, height - 0.18, 0.065, '#7d9283')
  })
  surface.material.depthWrite = true
  surface.renderOrder = 2
  return surface
}

export function accordion(canvases, titles, width = 1.65, height = 2.65) {
  const root = new THREE.Group()
  const inner = attach(root, new THREE.Group())
  const leaves = canvases.map((canvas, index) => {
    const pivot = attach(inner, new THREE.Group())
    const surface = attach(pivot, paper(canvas, width - 0.012, height), [width / 2, 0, 0])
    const hinge = attach(pivot, new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, height + 0.018, 12),
      new THREE.MeshStandardMaterial({ color: 0x92a494, roughness: 0.42, metalness: 0.28 }),
    ))
    const number = attach(pivot, caption(String(index + 1).padStart(2, '0'), 0.075, 0xabc8b7), [width / 2, -height / 2 - 0.13, 0.04])
    const name = attach(pivot, caption(titles[index], 0.10, COLOR.text), [width / 2, height / 2 + 0.15, 0.03])
    return { pivot, surface, hinge, number, name }
  })
  const positions = leaves.map(() => new THREE.Vector3())
  return {
    root, leaves, positions,
    fold(progress, { wave = 0.25, open = 0.10, closed = 1.535 } = {}) {
      let horizontal = 0
      let depth = 0
      leaves.forEach((leaf, index) => {
        const local = smooth01(progress, index / Math.max(1, leaves.length - 1) * wave, 1 - wave)
        const angle = (index % 2 ? -1 : 1) * (open + (closed - open) * local)
        leaf.pivot.position.set(horizontal, 0, depth)
        leaf.pivot.rotation.y = angle
        positions[index].set(horizontal + Math.cos(angle) * width / 2, 0, depth - Math.sin(angle) * width / 2)
        horizontal += Math.cos(angle) * width
        depth -= Math.sin(angle) * width
      })
      inner.position.set(-horizontal / 2, 0, -depth / 2)
      positions.forEach((position) => position.add(inner.position))
    },
    show(amount) { fade(root, amount) },
  }
}

export function stageFloor(parent) {
  const root = attach(parent, new THREE.Group())
  const shadowCanvas = document.createElement('canvas')
  shadowCanvas.width = 256
  shadowCanvas.height = 256
  const context = shadowCanvas.getContext('2d')
  const gradient = context.createRadialGradient(128, 128, 8, 128, 128, 128)
  gradient.addColorStop(0, 'rgba(7,24,28,0.62)')
  gradient.addColorStop(0.55, 'rgba(7,24,28,0.22)')
  gradient.addColorStop(1, 'rgba(7,24,28,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, 256, 256)
  const shadow = attach(root, new THREE.Mesh(new THREE.PlaneGeometry(12, 5), new THREE.MeshBasicMaterial({ map: surfaceTexture(shadowCanvas), transparent: true, depthWrite: false })), [0, -2.20, 0])
  shadow.rotation.x = -Math.PI / 2
  const edge = attach(root, new THREE.PointLight(0xdbe8ca, 16, 22, 2), [-4, 4.5, 2])
  const warm = attach(root, new THREE.PointLight(0xe9be86, 12, 20, 2), [5, 3, -2])
  return { root, show(amount) { fade(root, amount); edge.intensity = amount * 16; warm.intensity = amount * 12 } }
}

export function bookmark(title, detail, width = 1.6, color = COLOR.amber) {
  const root = new THREE.Group()
  const body = printedPage(title, detail ? [detail] : [], width, 0.83, new THREE.Color(color).getStyle())
  attach(root, body)
  attach(root, machined(width, 0.022, 0.032, color), [0, 0.407, 0.014])
  attach(root, solid(0.10, 0.21, 0.028, color), [width / 2 - 0.17, 0.45, -0.02])
  return root
}

export function paperTrail(parent, points, width = 0.11) {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)))
  const geometry = new THREE.PlaneGeometry(width, 1, 1, 96)
  const vertices = geometry.attributes.position
  const tangent = new THREE.Vector3()
  const normal = new THREE.Vector3()
  const location = new THREE.Vector3()
  const up = new THREE.Vector3(0, 0, 1)
  for (let row = 0; row <= 96; row++) {
    const progress = row / 96
    curve.getPoint(progress, location)
    curve.getTangent(progress, tangent)
    normal.crossVectors(tangent, up).normalize().multiplyScalar(width / 2)
    for (let side = 0; side < 2; side++) {
      const offset = side ? 1 : -1
      vertices.setXYZ(row * 2 + side, location.x + normal.x * offset, location.y + normal.y * offset, location.z + normal.z * offset)
    }
  }
  geometry.computeVertexNormals()
  const mesh = attach(parent, new THREE.Mesh(geometry, new THREE.MeshPhysicalMaterial({ color: 0xd9dec9, side: THREE.DoubleSide, roughness: 0.58, metalness: 0.08, transparent: true, opacity: 0.70 })))
  return { mesh, curve, update(progress) { geometry.setDrawRange(0, Math.floor(clamp01(progress) * 96) * 6) } }
}

export function touchHalo(parent, color = COLOR.amber) {
  const root = attach(parent, new THREE.Group())
  attach(root, new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.005, 12, 64), new THREE.MeshBasicMaterial({ color, transparent: true })))
  attach(root, makeGlow({ color, size: 0.45, opacity: 0.24 }))
  return root
}

export { THREE, COLOR, attach, caption, drawing, write, solid, fade, machined, clamp01, smooth01 }
