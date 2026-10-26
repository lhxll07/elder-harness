import * as THREE from 'three'
import { roundedPlaneGeometry, makeGlow } from '../props.js'
import { textPlane } from '../text.js'
import { smooth01, clamp01 } from '../ease.js'

const FONT = '"Noto Sans CJK SC", sans-serif'
export const MINT = 0x8abdab
export const AMBER = 0xd3aa74

export function windowAt(local, start, end, arrival = 0.6, departure = 0.6) {
  return smooth01(local, start, arrival) * (1 - smooth01(local, end, departure))
}

function fitted(context, content, x, y, size, color, width) {
  context.font = `500 ${size}px ${FONT}`
  while (context.measureText(content).width > width && size > 26) {
    size -= 2
    context.font = `500 ${size}px ${FONT}`
  }
  context.fillStyle = color
  context.fillText(content, x, y)
}

export function panel({ kicker, title, rows = [], footer = '', accent = '#8abdab', width = 1.85, height = 0.90 }) {
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = Math.round(1200 * height / width)
  const context = canvas.getContext('2d')
  const gradient = context.createLinearGradient(0, 0, 1200, canvas.height)
  gradient.addColorStop(0, '#29444b')
  gradient.addColorStop(1, '#13282f')
  context.beginPath()
  context.roundRect(4, 4, 1192, canvas.height - 8, 46)
  context.fillStyle = gradient
  context.fill()
  context.strokeStyle = accent
  context.lineWidth = 3
  context.stroke()
  context.textBaseline = 'middle'
  fitted(context, kicker, 66, 62, 41, accent, 1068)
  fitted(context, title, 66, rows.length ? 170 : canvas.height * 0.50, 116, '#d0dcd9', 1068)
  const rowStart = 287
  const rowGap = Math.min(103, (canvas.height - rowStart - (footer ? 112 : 55)) / Math.max(1, rows.length - 1))
  rows.forEach((content, index) => {
    context.fillStyle = accent
    context.beginPath()
    context.arc(79, rowStart + index * rowGap, 6, 0, Math.PI * 2)
    context.fill()
    fitted(context, content, 107, rowStart + index * rowGap, 61, '#bfd3d7', 1027)
  })
  if (footer) fitted(context, footer, 66, canvas.height - 62, 37, '#96afb6', 1068)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  texture.generateMipmaps = false
  texture.minFilter = THREE.LinearFilter
  const mesh = new THREE.Mesh(roundedPlaneGeometry(width, height, 0.070, 20), new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }))
  mesh.userData.setOpacity = (opacity) => {
    mesh.material.opacity = clamp01(opacity)
    mesh.visible = opacity > 0.001
  }
  return mesh
}

export function label(content, height = 0.20, color = 0xd4e1e3) {
  return textPlane(content, { size: 84, font: `500 1px ${FONT}`, color, worldHeight: height, supersample: 1 })
}

export function position(mesh, point, opacity, scale = 1) {
  mesh.position.set(...point)
  mesh.scale.setScalar(scale)
  mesh.userData.setOpacity(opacity)
}

export function path(parent, points, color = MINT, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)), closed, 'centripetal')
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(192)), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }))
  const head = makeGlow({ color, size: 0.12, opacity: 0 })
  const pointsGeometry = new THREE.BufferGeometry()
  pointsGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(24 * 3), 3))
  const dots = new THREE.Points(pointsGeometry, new THREE.PointsMaterial({ color, size: 0.010, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }))
  dots.frustumCulled = false
  parent.add(line, head, dots)
  const scratch = new THREE.Vector3()
  return { update(progress, opacity) {
    line.visible = head.visible = dots.visible = opacity > 0.001
    line.material.opacity = opacity * 0.36
    head.material.opacity = opacity * 0.90
    dots.material.opacity = opacity * 0.80
    curve.getPointAt(closed ? ((progress % 1) + 1) % 1 : clamp01(progress), head.position)
    const attribute = pointsGeometry.attributes.position
    for (let index = 0; index < 24; index++) {
      const tail = progress - index * 0.006
      curve.getPointAt(closed ? (tail % 1 + 1) % 1 : clamp01(tail), scratch)
      attribute.setXYZ(index, scratch.x, scratch.y, scratch.z)
    }
    attribute.needsUpdate = true
  } }
}

export function halo(parent, radius = 0.65, color = MINT) {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.003, 8, 160), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }))
  parent.add(mesh)
  return mesh
}
