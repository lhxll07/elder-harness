import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

function outline(width, height, radius, segments = 32) {
  const points = []
  for (const [centerX, centerY, start] of [
    [width / 2 - radius, -height / 2 + radius, -Math.PI / 2],
    [width / 2 - radius, height / 2 - radius, 0],
    [-width / 2 + radius, height / 2 - radius, Math.PI / 2],
    [-width / 2 + radius, -height / 2 + radius, Math.PI],
  ]) {
    for (let index = 0; index <= segments; index++) {
      const angle = start + index / segments * Math.PI / 2
      points.push(new THREE.Vector2(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius))
    }
  }
  return points
}

export function phoneShell(width, height, depth, radius) {
  const bevel = Math.min(0.004, depth * 0.22)
  const rings = []
  for (let index = 0; index <= 8; index++) {
    const angle = index / 8 * Math.PI / 2
    rings.push({ inset: bevel * (1 - Math.sin(angle)), depth: -depth / 2 + bevel * (1 - Math.cos(angle)) })
  }
  for (let index = 0; index <= 8; index++) {
    const angle = index / 8 * Math.PI / 2
    rings.push({ inset: bevel * (1 - Math.cos(angle)), depth: depth / 2 - bevel + bevel * Math.sin(angle) })
  }
  const vertices = []
  const indices = []
  const count = outline(width, height, radius).length
  for (const ring of rings) {
    for (const point of outline(width - ring.inset * 2, height - ring.inset * 2, radius - ring.inset)) vertices.push(point.x, point.y, ring.depth)
  }
  for (let layer = 0; layer < rings.length - 1; layer++) {
    for (let index = 0; index < count; index++) {
      const first = layer * count + index
      const next = layer * count + (index + 1) % count
      indices.push(first, next, first + count, next, next + count, first + count)
    }
  }
  for (const [layer, direction] of [[0, -1], [rings.length - 1, 1]]) {
    const center = vertices.length / 3
    vertices.push(0, 0, rings[layer].depth)
    const points = outline(width - rings[layer].inset * 2, height - rings[layer].inset * 2, radius - rings[layer].inset)
    for (const point of points) vertices.push(point.x, point.y, rings[layer].depth)
    for (let index = 0; index < count; index++) {
      const first = center + 1 + index
      const next = center + 1 + (index + 1) % count
      indices.push(center, direction > 0 ? first : next, direction > 0 ? next : first)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  return geometry
}

function add(parent, geometry, material, position = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(...position)
  parent.add(mesh)
  return mesh
}

export function deviceDetails(group, dimensions, layers) {
  const metal = new THREE.MeshPhysicalMaterial({ color: 0x87938f, roughness: 0.25, metalness: 0.94, clearcoat: 0.30, clearcoatRoughness: 0.22 })
  const ceramic = new THREE.MeshStandardMaterial({ color: 0x2b3435, roughness: 0.52, metalness: 0.12 })
  const black = new THREE.MeshBasicMaterial({ color: 0x05090b })
  const back = add(group, phoneShell(dimensions.w - 0.009, dimensions.h - 0.009, 0.004, dimensions.r - 0.0045), new THREE.MeshPhysicalMaterial({ color: 0x243b37, roughness: 0.39, metalness: 0.10, clearcoat: 0.46, clearcoatRoughness: 0.28 }), [0, 0, layers.bodyBack - 0.001])
  back.name = '磨砂玻璃背板'
  for (const [horizontal, vertical, height] of [[1, 0.19, 0.13], [-1, 0.28, 0.10], [-1, 0.13, 0.10]]) {
    add(group, new RoundedBoxGeometry(0.009, height, 0.026, 5, 0.004), metal, [horizontal * (dimensions.w / 2 + 0.001), vertical, 0])
  }
  for (const horizontal of [-1, 1]) {
    for (const vertical of [-0.54, 0.54]) add(group, new THREE.BoxGeometry(0.0015, 0.018, 0.061), ceramic, [horizontal * (dimensions.w / 2 + 0.0002), vertical, 0])
  }
  add(group, new RoundedBoxGeometry(0.082, 0.003, 0.022, 4, 0.001), black, [0, -dimensions.h / 2 - 0.0005, 0])
  add(group, new RoundedBoxGeometry(0.059, 0.0012, 0.005, 4, 0.0005), ceramic, [0, -dimensions.h / 2 - 0.0021, 0])
  for (const horizontal of [-1, 1]) {
    for (let index = 0; index < 5; index++) add(group, new THREE.CylinderGeometry(0.0038, 0.0038, 0.0018, 20), black, [horizontal * (0.086 + index * 0.018), -dimensions.h / 2, 0])
  }
  add(group, new RoundedBoxGeometry(0.080, 0.0025, 0.0015, 3, 0.0006), black, [0, dimensions.h / 2 - 0.008, layers.glass + 0.002])
  add(group, new THREE.CircleGeometry(0.0085, 48), black, [0, dimensions.h / 2 - 0.030, layers.glass + 0.002])
  add(group, new THREE.CircleGeometry(0.0042, 40), new THREE.MeshPhysicalMaterial({ color: 0x192e3b, metalness: 0.45, roughness: 0.12, clearcoat: 1 }), [0, dimensions.h / 2 - 0.030, layers.glass + 0.0022])
  add(group, new THREE.RingGeometry(0.0063, 0.0068, 64), metal, [0, dimensions.h / 2 - 0.030, layers.glass + 0.0023])
}

export function cameraModule() {
  const group = new THREE.Group()
  const metal = new THREE.MeshPhysicalMaterial({ color: 0x50635f, metalness: 0.92, roughness: 0.23, clearcoat: 0.25 })
  add(group, phoneShell(0.184, 0.132, 0.012, 0.033), metal)
  for (const horizontal of [-0.044, 0.044]) {
    const barrel = add(group, new THREE.CylinderGeometry(0.030, 0.030, 0.012, 64), metal, [horizontal, -0.007, -0.010])
    barrel.rotation.x = Math.PI / 2
    const optic = add(group, new THREE.CircleGeometry(0.025, 64), new THREE.MeshPhysicalMaterial({ color: 0x0c1925, roughness: 0.065, metalness: 0.50, clearcoat: 1, clearcoatRoughness: 0.04 }), [horizontal, -0.007, -0.0165])
    optic.rotation.y = Math.PI
    const coating = add(group, new THREE.RingGeometry(0.012, 0.020, 64), new THREE.MeshPhysicalMaterial({ color: 0x1b3844, roughness: 0.12, metalness: 0.62, clearcoat: 0.85 }), [horizontal, -0.007, -0.0167])
    coating.rotation.y = Math.PI
    const aperture = add(group, new THREE.CircleGeometry(0.010, 48), new THREE.MeshBasicMaterial({ color: 0x03080c }), [horizontal, -0.007, -0.0168])
    aperture.rotation.y = Math.PI
    const ring = add(group, new THREE.TorusGeometry(0.0265, 0.0011, 12, 64), metal, [horizontal, -0.007, -0.017])
    ring.rotation.y = Math.PI
  }
  add(group, new THREE.SphereGeometry(0.008, 32, 20), new THREE.MeshPhysicalMaterial({ color: 0xe0dcc5, roughness: 0.27, clearcoat: 0.7 }), [0.053, 0.044, -0.008])
  return group
}
