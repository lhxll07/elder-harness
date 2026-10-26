import * as THREE from 'three'
import { roundedPlaneGeometry, makeGlow } from '../props.js'
import { COLOR, caption, attach, canvasSurface, drawing, write, solid, clamp01, smooth01, windowAt } from './mechanism-geometry.js'
import { backedSheet, ticket } from './cinema-finish.js'
import { SCREEN_W, SCREEN_H } from '../screen.js'

export function crop(source, left, top, width, height) {
  const canvas = document.createElement('canvas')
  const horizontalScale = source.width / SCREEN_W
  const verticalScale = source.height / SCREEN_H
  canvas.width = Math.round(width * horizontalScale)
  canvas.height = Math.round(height * verticalScale)
  canvas.getContext('2d').drawImage(source, left * horizontalScale, top * verticalScale, width * horizontalScale, height * verticalScale, 0, 0, canvas.width, canvas.height)
  return canvas
}

export function sheet(canvas, width, height, tint = 0xf0f5ef) {
  const root = new THREE.Group()
  attach(root, backedSheet(canvas, width, height, tint), [0, 0, 0.014])
  return root
}

export function keycap(title, detail = '', width = 1.38, height = 0.52, color = COLOR.mint) {
  const root = new THREE.Group()
  attach(root, ticket(title, detail, width, height, color), [0, 0, 0.008])
  return root
}

export function frame(width, height, color = COLOR.mint) {
  const roundedPath = (path, spanWidth, spanHeight, radius) => {
    const horizontal = spanWidth / 2
    const vertical = spanHeight / 2
    path.moveTo(-horizontal + radius, -vertical)
    path.lineTo(horizontal - radius, -vertical)
    path.quadraticCurveTo(horizontal, -vertical, horizontal, -vertical + radius)
    path.lineTo(horizontal, vertical - radius)
    path.quadraticCurveTo(horizontal, vertical, horizontal - radius, vertical)
    path.lineTo(-horizontal + radius, vertical)
    path.quadraticCurveTo(-horizontal, vertical, -horizontal, vertical - radius)
    path.lineTo(-horizontal, -vertical + radius)
    path.quadraticCurveTo(-horizontal, -vertical, -horizontal + radius, -vertical)
    return path
  }
  const thickness = Math.min(width, height, 1) * 0.009
  const radius = Math.min(width, height) * 0.08
  const shape = roundedPath(new THREE.Shape(), width, height, radius)
  shape.holes.push(roundedPath(new THREE.Path(), width - thickness * 2, height - thickness * 2, radius - thickness))
  return new THREE.Mesh(new THREE.ShapeGeometry(shape, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.82, side: THREE.DoubleSide, toneMapped: false }))
}

export function railFrame(width, height, color = COLOR.ink, thickness = 0.018) {
  const root = new THREE.Group()
  for (const side of [-1, 1]) {
    attach(root, solid(thickness, height + thickness, 0.028, color), [side * width / 2, 0, 0])
    attach(root, solid(width, thickness, 0.028, color), [0, side * height / 2, 0])
  }
  return root
}

export function beam(parent, color = COLOR.mint, radius = 0.008) {
  const rod = attach(parent, new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, 16), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.65, toneMapped: false })))
  const axis = new THREE.Vector3(0, 1, 0)
  const first = new THREE.Vector3()
  const second = new THREE.Vector3()
  return { object: rod, update(from, to) {
    first.set(...from)
    second.set(...to)
    const distance = Math.max(0.0001, first.distanceTo(second))
    rod.position.copy(first).add(second).multiplyScalar(0.5)
    rod.scale.set(1, distance, 1)
    rod.quaternion.setFromUnitVectors(axis, second.sub(first).normalize())
  } }
}

export function flight(parent, points, color = COLOR.mint, radius = 0.014) {
  const root = attach(parent, new THREE.Group())
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)), false, 'centripetal')
  const trail = attach(root, new THREE.Mesh(new THREE.TubeGeometry(curve, 96, radius, 12, false), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.58, toneMapped: false })))
  const arrow = attach(root, new THREE.Group())
  const nose = attach(arrow, new THREE.Mesh(new THREE.ConeGeometry(radius * 5, radius * 17, 32), new THREE.MeshStandardMaterial({ color, metalness: 0.7, roughness: 0.25 })))
  nose.rotation.x = Math.PI / 2
  attach(arrow, makeGlow({ color, size: 0.32, opacity: 0.32 }))
  const tangent = new THREE.Vector3()
  const axis = new THREE.Vector3(0, 0, 1)
  return { root, arrow, update(progress, tail = 0.32) {
    const amount = clamp01(progress)
    curve.getPointAt(amount, arrow.position)
    curve.getTangentAt(amount, tangent)
    arrow.quaternion.setFromUnitVectors(axis, tangent)
    const begin = Math.max(0, Math.floor((amount - tail) * 96))
    const end = Math.max(begin, Math.ceil(amount * 96))
    trail.geometry.setDrawRange(begin * 72, (end - begin) * 72)
  } }
}

export function paperMessage() {
  const root = new THREE.Group()
  const leaves = []
  for (const side of [-1, 1]) {
    const pivot = attach(root, new THREE.Group())
    attach(pivot, drawing(0.90, 0.86, (context, width, height) => {
      context.fillStyle = '#b8c8b7'
      context.fillRect(0, 0, width, height)
      if (side < 0) {
        write(context, '家人留言', 0.08, 0.14, 0.09, '#365d4c')
        write(context, '上次陈医生，', 0.08, 0.39, 0.105, '#233f37')
        write(context, '您再核对一下。', 0.08, 0.62, 0.084, '#233f37')
      } else {
        context.strokeStyle = '#6d937a'
        context.lineWidth = 0.008
        for (let row = 0; row < 4; row++) {
          context.beginPath()
          context.moveTo(0.09, 0.18 + row * 0.16)
          context.lineTo(0.76 - row * 0.055, 0.18 + row * 0.16)
          context.stroke()
        }
      }
    }), [side * 0.45, 0, 0])
    leaves.push({ pivot, side })
  }
  root.userData.fold = (amount) => leaves.forEach(({ pivot, side }) => { pivot.rotation.y = -side * amount * Math.PI * 0.78 })
  return root
}

export function sparkField(parent, count = 160, color = COLOR.mint) {
  const positions = new Float32Array(count * 3)
  for (let index = 0; index < count; index++) {
    const angle = index * 2.39996
    const radius = 0.28 + Math.sqrt(index / count) * 1.1
    positions[index * 3] = Math.cos(angle) * radius
    positions[index * 3 + 1] = Math.sin(angle) * radius
    positions[index * 3 + 2] = Math.sin(index * 1.73) * 0.45
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  return attach(parent, new THREE.Points(geometry, new THREE.PointsMaterial({ color, size: 0.012, transparent: true, opacity: 0.42, depthWrite: false, toneMapped: false })))
}

export { THREE, COLOR, caption, attach, canvasSurface, drawing, write, solid, clamp01, smooth01, windowAt }
