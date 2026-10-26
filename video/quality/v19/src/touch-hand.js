import * as THREE from 'three'

function smoothRadialSeam(geometry, longitudinal, radial) {
  geometry.computeVertexNormals()
  const normals = geometry.getAttribute('normal')
  const seam = new THREE.Vector3()
  const opposite = new THREE.Vector3()
  for (let ring = 0; ring <= longitudinal; ring++) {
    const first = ring * (radial + 1)
    const last = first + radial
    seam.fromBufferAttribute(normals, first)
    opposite.fromBufferAttribute(normals, last)
    seam.add(opposite).normalize()
    normals.setXYZ(first, seam.x, seam.y, seam.z)
    normals.setXYZ(last, seam.x, seam.y, seam.z)
  }
  normals.needsUpdate = true
  return geometry
}

function sculptedDigit(curve, width, thickness, taper = true) {
  const vertices = []
  const indices = []
  const coordinates = []
  const longitudinal = 64
  const radial = 48
  const frames = curve.computeFrenetFrames(longitudinal, false)
  for (let ring = 0; ring <= longitudinal; ring++) {
    const progress = ring / longitudinal
    const center = curve.getPointAt(progress)
    const cap = Math.pow(Math.sin(Math.min(progress / 0.15, 1) * Math.PI / 2), 0.58)
    const knuckle = 1 + 0.045 * Math.exp(-Math.pow((progress - 0.57) / 0.06, 2))
    const profile = Math.max(0.0005, cap * knuckle * (taper ? 0.85 + progress * 0.15 : 1))
    for (let side = 0; side <= radial; side++) {
      const angle = side / radial * Math.PI * 2
      const point = center.clone()
        .addScaledVector(frames.normals[ring], Math.cos(angle) * width * profile)
        .addScaledVector(frames.binormals[ring], Math.sin(angle) * thickness * profile)
      vertices.push(point.x, point.y, point.z)
      coordinates.push(side / radial, progress)
      if (ring < longitudinal && side < radial) {
        const current = ring * (radial + 1) + side
        indices.push(current, current + 1, current + radial + 1, current + 1, current + radial + 2, current + radial + 1)
      }
    }
  }
  for (const [ring, reverse] of [[0, true], [longitudinal, false]]) {
    const center = curve.getPointAt(ring / longitudinal)
    const centerIndex = vertices.length / 3
    vertices.push(center.x, center.y, center.z)
    coordinates.push(0.5, 0.5)
    for (let side = 0; side <= radial; side++) {
      const source = (ring * (radial + 1) + side) * 3
      vertices.push(vertices[source], vertices[source + 1], vertices[source + 2])
      coordinates.push(side / radial, ring / longitudinal)
      if (side < radial) indices.push(centerIndex, centerIndex + side + (reverse ? 2 : 1), centerIndex + side + (reverse ? 1 : 2))
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(coordinates, 2))
  geometry.setIndex(indices)
  return smoothRadialSeam(geometry, longitudinal, radial)
}

function palmGeometry() {
  const sections = [[0.68, 0.038, -0.012, 0.075, 0.054], [0.84, 0.12, -0.022, 0.24, 0.105], [1.06, 0.145, -0.023, 0.32, 0.126], [1.25, 0.14, -0.022, 0.275, 0.118], [1.46, 0.14, -0.016, 0.177, 0.10], [1.72, 0.14, -0.01, 0.181, 0.106], [2.12, 0.14, -0.006, 0.206, 0.122], [2.65, 0.14, 0, 0.238, 0.142]]
  const vertices = []
  const coordinates = []
  const indices = []
  const longitudinal = 140
  const radial = 64
  for (let ring = 0; ring <= longitudinal; ring++) {
    const section = ring / longitudinal * (sections.length - 1)
    const first = Math.min(sections.length - 2, Math.floor(section))
    const fraction = section - first
    const blend = THREE.MathUtils.smoothstep(fraction, 0, 1)
    const profile = sections[first].map((value, index) => THREE.MathUtils.lerp(value, sections[first + 1][index], index === 0 ? fraction : blend))
    for (let side = 0; side <= radial; side++) {
      const angle = side / radial * Math.PI * 2
      vertices.push(profile[1] + Math.cos(angle) * profile[3], profile[2] + Math.sin(angle) * profile[4], profile[0])
      coordinates.push(side / radial, ring / longitudinal * 2)
      if (ring < longitudinal && side < radial) {
        const current = ring * (radial + 1) + side
        indices.push(current, current + 1, current + radial + 1, current + 1, current + radial + 2, current + radial + 1)
      }
    }
  }
  for (const [ring, reverse] of [[0, true], [longitudinal, false]]) {
    const profile = sections[ring === 0 ? 0 : sections.length - 1]
    const center = vertices.length / 3
    vertices.push(profile[1], profile[2], profile[0])
    coordinates.push(0.5, 0.5)
    for (let side = 0; side <= radial; side++) {
      const source = (ring * (radial + 1) + side) * 3
      vertices.push(vertices[source], vertices[source + 1], vertices[source + 2])
      coordinates.push(side / radial, ring / longitudinal * 2)
      if (side < radial) indices.push(center, center + side + (reverse ? 2 : 1), center + side + (reverse ? 1 : 2))
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(coordinates, 2))
  geometry.setIndex(indices)
  return smoothRadialSeam(geometry, longitudinal, radial)
}

function skinGrain() {
  const size = 128
  const pixels = new Uint8Array(size * size * 4)
  for (let index = 0; index < size * size; index++) {
    const noise = ((index * 1597 + (index % size) * 811) ^ (index >>> 3)) & 255
    const value = 118 + Math.round(noise * 0.1)
    pixels.set([value, value, value, 255], index * 4)
  }
  const texture = new THREE.DataTexture(pixels, size, size)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(7, 14)
  texture.generateMipmaps = true
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.needsUpdate = true
  return texture
}

export function makeTouchHand() {
  const root = new THREE.Group()
  root.name = '本人指触'
  const skin = new THREE.MeshPhysicalMaterial({ color: 0xc6a98f, roughness: 0.65, metalness: 0, clearcoat: 0.01, sheen: 0.10, sheenColor: 0xe3bc9f, sheenRoughness: 0.86, bumpMap: skinGrain(), bumpScale: 0.00018, transparent: true })
  const add = (geometry, material = skin, position = [0, 0, 0], scale = [1, 1, 1]) => {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(...position)
    mesh.scale.set(...scale)
    root.add(mesh)
    return mesh
  }
  const indexCurve = new THREE.CatmullRomCurve3([[0, -0.016, 0], [0, 0, 0.16], [0.007, 0.012, 0.39], [0.018, 0.002, 0.62], [0.035, -0.008, 0.84]].map((point) => new THREE.Vector3(...point)))
  add(sculptedDigit(indexCurve, 0.098, 0.077))
  add(palmGeometry())
  for (const [horizontal, length] of [[0.20, 1], [0.355, 0.94], [0.47, 0.80]]) {
    const curve = new THREE.CatmullRomCurve3([[horizontal, -0.15, 1.02], [horizontal, -0.14, 0.77], [horizontal, 0.045, 0.72], [horizontal, 0.075, 1.00], [horizontal * 0.9, -0.01, 1.23]].map(([positionX, positionY, positionZ]) => new THREE.Vector3(positionX, positionY, 1.2 + (positionZ - 1.2) * length)))
    add(sculptedDigit(curve, 0.078 * length, 0.074 * length, false))
  }
  const thumbCurve = new THREE.CatmullRomCurve3([[-0.20, -0.12, 0.73], [-0.31, -0.09, 0.83], [-0.27, -0.03, 1.03], [-0.04, -0.03, 1.22]].map((point) => new THREE.Vector3(...point)))
  add(sculptedDigit(thumbCurve, 0.103, 0.088))
  const nail = new THREE.MeshPhysicalMaterial({ color: 0xdec5b2, roughness: 0.48, metalness: 0, clearcoat: 0.14, clearcoatRoughness: 0.42, transparent: true })
  add(new THREE.SphereGeometry(1, 48, 32, 0, Math.PI * 2, 0, Math.PI / 2), nail, [0, 0.071, 0.205], [0.062, 0.009, 0.112])
  const crease = new THREE.MeshStandardMaterial({ color: 0xa98067, roughness: 0.76, transparent: true, opacity: 0.18 })
  for (const [vertical, height] of [[0.43, 0.084], [0.64, 0.077]]) {
    const points = []
    for (let step = 0; step <= 32; step++) {
      const horizontal = (step / 32 - 0.5) * 0.132
      points.push(new THREE.Vector3(horizontal + 0.01, height - 0.013 * Math.pow(horizontal / 0.066, 2), vertical + Math.pow(horizontal / 0.066, 2) * 0.012))
    }
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 32, 0.0012, 5, false), crease)
  }
  return root
}
