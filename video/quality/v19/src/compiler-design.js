import * as THREE from 'three'
import { textPlane } from './text.js'
import { makeGlow } from './props.js'
import { surfaceTexture, fade } from './shots/mechanism-geometry.js'
import { frame } from './shots/cinema-props.js'
import { smooth01, clamp01, lerp } from './ease.js'
import { SCREEN_W, SCREEN_H } from './screen.js'

export const INK = 0xeae4d5
export const GOLD = 0xd7ac70
export const JADE = 0xa1c5b2
export const BLUE = 0xa9bdcd
export const PAGE_WIDTH = 1.66
export const PAGE_HEIGHT = 3.68
export const BANDS = 18

export function add(parent, object, position = [0, 0, 0]) {
  object.position.set(...position)
  parent.add(object)
  return object
}

export function type(content, height = 0.36, color = INK, serif = false) {
  return textPlane(content, { size: 96, worldHeight: height, color, font: `${serif ? 400 : 500} 1px "${serif ? 'Noto Serif CJK SC' : 'Noto Sans CJK SC'}", sans-serif`, supersample: 2 })
}

export function windowAt(time, start, end, enter = 0.7, exit = 0.7) {
  return smooth01(time, start, enter) * (1 - smooth01(time, end, exit))
}

export function surface(source, width, height) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({
    map: surfaceTexture(source), side: THREE.DoubleSide, transparent: true, depthWrite: true, toneMapped: false, forceSinglePass: true,
  }))
  mesh.userData.width = width
  mesh.userData.height = height
  return mesh
}

export function page(source, index, title) {
  const root = new THREE.Group()
  root.name = `source-page-${index}`
  const material = new THREE.MeshBasicMaterial({ map: surfaceTexture(source), side: THREE.DoubleSide, transparent: true, depthWrite: true, toneMapped: false, forceSinglePass: true })
  const bands = []
  for (let bandIndex = 0; bandIndex < BANDS; bandIndex++) {
    const geometry = new THREE.PlaneGeometry(PAGE_WIDTH, PAGE_HEIGHT / BANDS + 0.001, 12, 1)
    const coordinates = geometry.attributes.uv
    for (let vertex = 0; vertex < coordinates.count; vertex++) coordinates.setY(vertex, 1 - (bandIndex + 1 - coordinates.getY(vertex)) / BANDS)
    const band = add(root, new THREE.Mesh(geometry, material), [0, PAGE_HEIGHT / 2 - (bandIndex + 0.5) * PAGE_HEIGHT / BANDS, 0])
    band.userData.base = geometry.attributes.position.array.slice()
    bands.push(band)
  }
  const heading = add(root, type(title, 0.22), [0, PAGE_HEIGHT / 2 + 0.22, 0.02])
  const footer = add(root, type(String(index + 1).padStart(2, '0'), 0.17, GOLD), [0, -PAGE_HEIGHT / 2 - 0.16, 0.02])
  return { root, bands, heading, footer, index }
}

export function bendPage(entry, amount, scatter, time) {
  entry.bands.forEach((band, bandIndex) => {
    const original = band.userData.base
    const positions = band.geometry.attributes.position
    for (let vertex = 0; vertex < positions.count; vertex++) {
      const horizontal = original[vertex * 3]
      positions.setZ(vertex, Math.cos(horizontal / PAGE_WIDTH * Math.PI) * amount * 0.18)
    }
    positions.needsUpdate = true
    band.geometry.computeBoundingSphere()
    const delay = (entry.index * 0.07 + bandIndex * 0.018)
    const depart = smooth01(scatter, delay, 0.52)
    const side = entry.index < 3 ? -1 : 1
    const angle = bandIndex / BANDS * Math.PI * 0.9 + entry.index * 0.12 + time * 0.015
    const radius = 1.5 + entry.index * 0.08
    band.position.set(
      side * (0.7 + Math.sin(angle) * radius) * depart,
      PAGE_HEIGHT / 2 - (bandIndex + 0.5) * PAGE_HEIGHT / BANDS + Math.cos(angle) * radius * depart,
      -depart * (2.8 + bandIndex * 0.07),
    )
    band.rotation.set(depart * 0.25 * Math.sin(angle), side * depart * (0.60 + Math.sin(angle) * 0.18), side * depart * (0.08 + angle * 0.20))
    band.scale.set(1 - depart * 0.10, 1 - depart * 0.18, 1)
  })
}

export function line(points, color = GOLD, opacity = 0.7) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points.map(point => new THREE.Vector3(...point)))
  return new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false }))
}

export function stroke(parent, points, color = GOLD, radius = 0.009) {
  const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)))
  const geometry = new THREE.TubeGeometry(curve, 160, radius, 6, false)
  const mesh = add(parent, new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, metalness: 0.58, roughness: 0.3, transparent: true })))
  return { mesh, curve, reveal(amount) { geometry.setDrawRange(0, Math.round(clamp01(amount) * geometry.index.count / 6) * 6) } }
}

export function selection(width, height, color = GOLD) {
  const root = new THREE.Group()
  add(root, frame(width, height, color))
  const glow = add(root, makeGlow({ color, size: Math.max(width, height) * 1.4, opacity: 0.22 }), [0, 0, -0.01])
  glow.scale.y = 0.45
  return root
}

export function field(label, value, cropCanvas, width, height, color = JADE) {
  const root = new THREE.Group()
  const picture = cropCanvas ? add(root, surface(cropCanvas, width, height)) : null
  const outline = add(root, frame(width + 0.06, height + 0.06, color), [0, 0, 0.008])
  const title = add(root, type(value, 0.47, color), [0, -height / 2 - 0.35, 0.015])
  const kicker = add(root, type(label, 0.18, INK), [0, height / 2 + 0.22, 0.015])
  return { root, picture, outline, title, kicker }
}

export function interpolate(time, keys) {
  const components = key => Array.from({ length: 7 }, (_, index) => key[index + 1] ?? (index === 3 ? 1 : 0))
  if (time <= keys[0][0]) return components(keys[0])
  if (time >= keys.at(-1)[0]) return components(keys.at(-1))
  const index = keys.findIndex((key, offset) => offset < keys.length - 1 && key[0] <= time && keys[offset + 1][0] > time)
  const first = keys[index]
  const second = keys[index + 1]
  const amount = smooth01(time, first[0], second[0] - first[0])
  const initial = components(first)
  const target = components(second)
  return initial.map((value, component) => lerp(value, target[component], amount))
}

export function place(object, time, keys) {
  const [horizontal, vertical, depth, scale = 1, pitch = 0, yaw = 0, roll = 0] = interpolate(time, keys)
  object.position.set(horizontal, vertical, depth)
  object.scale.setScalar(scale)
  object.rotation.set(pitch, yaw, roll)
}

export function cropImage(source, left, top, width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d').drawImage(source, left, top, width, height, 0, 0, width, height)
  return canvas
}

export function cropPage(source, left, top, width, height) {
  const horizontalScale = source.width / SCREEN_W
  const verticalScale = source.height / SCREEN_H
  return cropImage(source, left * horizontalScale, top * verticalScale, width * horizontalScale, height * verticalScale)
}

export { THREE, fade, smooth01, lerp }
