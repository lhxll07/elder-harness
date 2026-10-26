import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { roundedPlaneGeometry, makeGlow } from '../props.js'
import { textPlane } from '../text.js'
import { clamp01, smooth01 } from '../ease.js'
import { path, windowAt } from './journey-visuals.js'

export const COLOR = { mint: 0x8abdab, amber: 0xd3aa74, red: 0xc27c78, blue: 0x80a5bc, ink: 0x203b43, text: 0xcbd9d6 }
const FONT = '"Noto Sans CJK SC", sans-serif'
const surfaceTextures = new WeakMap()

export function fade(object, opacity) {
  const amount = clamp01(opacity)
  object.visible = amount > 0.001
  object.traverse((child) => {
    if (!child.material) return
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    for (const material of materials) {
      material.userData.baseOpacity ??= material.opacity
      material.userData.baseDepthWrite ??= material.depthWrite
      material.transparent = true
      material.opacity = material.userData.baseOpacity * amount
      material.depthWrite = material.userData.baseDepthWrite && material.opacity >= 0.999
    }
  })
}

export function caption(content, height = 0.16, color = COLOR.text) {
  return textPlane(content, { size: 80, font: `500 1px ${FONT}`, color, worldHeight: height, supersample: 2 })
}

export function attach(parent, child, position = [0, 0, 0]) {
  child.position.set(...position)
  parent.add(child)
  return child
}

export function solid(width, height, depth, color = COLOR.ink, metalness = 0.3) {
  return new THREE.Mesh(new RoundedBoxGeometry(width, height, depth, 4, Math.min(width, height, depth) * 0.24), new THREE.MeshPhysicalMaterial({ color, metalness, roughness: 0.36, clearcoat: 0.20, clearcoatRoughness: 0.38, envMapIntensity: 0.85 }))
}

export function surfaceTexture(canvas) {
  if (surfaceTextures.has(canvas)) return surfaceTextures.get(canvas)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.anisotropy = 16
  surfaceTextures.set(canvas, texture)
  return texture
}

export function canvasSurface(canvas, width, height, tint = 0xffffff) {
  return new THREE.Mesh(roundedPlaneGeometry(width, height, 0.035, 32), new THREE.MeshBasicMaterial({ map: surfaceTexture(canvas), color: tint, side: THREE.DoubleSide, transparent: true, depthWrite: false, toneMapped: false }))
}

export function drawing(width, height, draw) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * 800)
  canvas.height = Math.round(height * 800)
  const context = canvas.getContext('2d')
  context.scale(800, 800)
  draw(context, width, height)
  return canvasSurface(canvas, width, height)
}

export function write(context, content, horizontal, vertical, size = 0.075, color = '#cbd9d6', align = 'left') {
  context.font = `500 ${size}px ${FONT}`
  context.textAlign = align
  context.textBaseline = 'middle'
  context.fillStyle = color
  context.fillText(content, horizontal, vertical)
}

export function pageLayer(revision, shifted = false, duplicate = false) {
  const root = new THREE.Group()
  attach(root, solid(1.25, 1.80, 0.025, 0x2c4a53), [0, 0, -0.019])
  const page = drawing(1.25, 1.80, (context, width, height) => {
    context.fillStyle = '#20383f'
    context.fillRect(0, 0, width, height)
    write(context, '医院预约 · 科室', 0.09, 0.16, 0.093)
    write(context, `page ${revision}`, 0.09, 0.30, 0.07, '#80a5bc')
    const rows = shifted ? ['全科门诊', '普通内科', duplicate ? '普通内科' : '外科门诊'] : ['普通内科', '外科门诊', '全科门诊']
    rows.forEach((row, index) => {
      const top = 0.43 + index * 0.37
      context.fillStyle = row === '普通内科' ? '#365b58' : '#2a454e'
      context.beginPath()
      context.roundRect(0.08, top, 1.09, 0.30, 0.025)
      context.fill()
      write(context, row, 0.15, top + 0.10, 0.088)
      const element = shifted ? (duplicate && index === 2 ? 'e41' : 'e31') : 'e12'
      write(context, row === '普通内科' ? `${element} · id: dept` : `e${22 + index}`, 0.15, top + 0.22, 0.062, '#91adb5')
    })
    write(context, 'app / window / 尺寸一致', 0.09, 1.66, 0.068, '#8abdab')
  })
  attach(root, page)
  return root
}

export function ring(radius, color = COLOR.mint, thickness = 0.012) {
  return new THREE.Mesh(new THREE.TorusGeometry(radius, thickness, 16, 128), new THREE.MeshBasicMaterial({ color, transparent: true, toneMapped: false }))
}

export function pin(color = COLOR.mint) {
  const root = new THREE.Group()
  attach(root, new THREE.Mesh(new THREE.SphereGeometry(0.033, 32, 20), new THREE.MeshPhysicalMaterial({ color, metalness: 0.7, roughness: 0.25, clearcoat: 0.32 })))
  attach(root, ring(0.067, color, 0.003))
  return root
}

export function wire(parent, points, color = COLOR.mint) {
  return path(parent, points, color)
}

export function gate(color = COLOR.amber, width = 0.92, height = 1.10) {
  const root = new THREE.Group()
  attach(root, solid(0.06, height, 0.10, color), [-width / 2, 0, 0])
  attach(root, solid(0.06, height, 0.10, color), [width / 2, 0, 0])
  attach(root, solid(width + 0.06, 0.07, 0.10, color), [0, height / 2, 0])
  const hinge = attach(root, new THREE.Group(), [-width / 2, -0.05, 0.03])
  attach(hinge, solid(width, 0.075, 0.055, color), [width / 2, 0, 0])
  root.userData.hinge = hinge
  return root
}

export function packet(color = COLOR.mint, title = '') {
  const root = new THREE.Group()
  const body = attach(root, solid(0.34, 0.23, 0.18, color, 0.65))
  attach(root, new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.30, 0.19, 0.15)), new THREE.LineBasicMaterial({ color: COLOR.text, transparent: true, opacity: 0.24 })))
  if (title) attach(root, caption(title, 0.07, 0x203b43), [0, 0, 0.10])
  return root
}

export function envelope() {
  const root = new THREE.Group()
  attach(root, solid(0.44, 0.29, 0.022, COLOR.amber))
  const seam = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.21, 0.13, 0.018), new THREE.Vector3(0, -0.02, 0.018), new THREE.Vector3(0.21, 0.13, 0.018)])
  attach(root, new THREE.Line(seam, new THREE.LineBasicMaterial({ color: COLOR.ink })))
  return root
}

export function book(title, color = COLOR.mint, width = 0.54, height = 0.80) {
  const root = new THREE.Group()
  attach(root, solid(width - 0.025, height - 0.04, 0.10, 0xb6c3bc), [0.009, 0, 0])
  attach(root, solid(width, height, 0.018, color), [0, 0, -0.065])
  const hinge = attach(root, new THREE.Group(), [-width / 2, 0, 0.060])
  attach(hinge, solid(width, height, 0.018, color), [width / 2, 0, 0])
  attach(hinge, caption(title, 0.087, COLOR.ink), [width / 2, 0.02, 0.014])
  root.userData.cover = hinge
  return root
}

export function cross(size = 0.13, color = COLOR.red) {
  const root = new THREE.Group()
  const first = attach(root, solid(size * 2, 0.028, 0.025, color))
  first.rotation.z = Math.PI / 4
  const second = attach(root, solid(size * 2, 0.028, 0.025, color))
  second.rotation.z = -Math.PI / 4
  return root
}

export function fingerprint() {
  const root = new THREE.Group()
  const skin = new THREE.MeshStandardMaterial({ color: 0xc9af95, roughness: 0.58, metalness: 0 })
  attach(root, new THREE.Mesh(new THREE.CapsuleGeometry(0.10, 0.50, 6, 16), skin))
  for (let index = 0; index < 6; index++) {
    const arc = new THREE.EllipseCurve(0, 0, 0.03 + index * 0.01, 0.055 + index * 0.01, 0.25, Math.PI * 1.8)
    const points = arc.getPoints(32).map((point) => new THREE.Vector3(point.x, point.y - 0.16, 0.096))
    attach(root, new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0x907967, transparent: true, opacity: 0.45 })))
  }
  return root
}

export function ticket(fields) {
  const root = new THREE.Group()
  const segments = []
  let parent = root
  fields.forEach(([heading, value], index) => {
    const hinge = attach(parent, new THREE.Group(), index ? [0, -0.35, 0] : [0, 0, 0])
    const sheet = drawing(1.20, 0.35, (context, width, height) => {
      context.fillStyle = index % 2 ? '#b5c6bf' : '#bdcdc7'
      context.fillRect(0, 0, width, height)
      write(context, heading, 0.09, 0.09, 0.053, '#526d65')
      write(context, value, 0.09, 0.235, 0.091, '#233e3c')
      context.strokeStyle = '#829d91'
      context.setLineDash([0.015, 0.012])
      context.lineWidth = 0.003
      context.beginPath()
      context.moveTo(0.04, height - 0.01)
      context.lineTo(width - 0.04, height - 0.01)
      context.stroke()
    })
    attach(hinge, sheet, [0, -0.175, 0.002 * index])
    parent = hinge
    segments.push(hinge)
  })
  root.userData.segments = segments
  return root
}

export function pointAlong(points, progress) {
  const amount = clamp01(progress) * (points.length - 1)
  const index = Math.min(points.length - 2, Math.floor(amount))
  return new THREE.Vector3(...points[index]).lerp(new THREE.Vector3(...points[index + 1]), amount - index)
}

export function travel(object, points, local, start, duration) {
  object.position.copy(pointAlong(points, smooth01(local, start, duration)))
}

export function shine(parent, point, color = COLOR.mint, size = 0.3) {
  return attach(parent, makeGlow({ color, size, opacity: 0.35 }), point)
}

export { windowAt, smooth01, clamp01 }
