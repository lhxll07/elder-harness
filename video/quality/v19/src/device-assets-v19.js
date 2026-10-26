import * as THREE from 'three'

const assetUrl = new URL('../assets/device-geometry-v19.json', import.meta.url)
const geometryCache = new Map()
let loading = null

function geometryKey(dimensions) {
  return dimensions.map(value => value.toFixed(6)).join(':')
}

function decodeGeometry(entry) {
  const { dimensions, positions, normals, indices } = entry
  if (!Array.isArray(dimensions) || dimensions.length !== 4 || !dimensions.every(value => Number.isFinite(value) && value > 0)) throw new Error(`Invalid device dimensions: ${entry.name}`)
  if (!Array.isArray(positions) || !positions.length || positions.length % 3 || !positions.every(Number.isFinite)) throw new Error(`Invalid device positions: ${entry.name}`)
  if (!Array.isArray(normals) || normals.length !== positions.length || !normals.every(Number.isFinite)) throw new Error(`Invalid device normals: ${entry.name}`)
  if (!Array.isArray(indices) || !indices.length || indices.length % 3 || !indices.every(value => Number.isInteger(value) && value >= 0 && value < positions.length / 3)) throw new Error(`Invalid device indices: ${entry.name}`)
  for (let offset = 0; offset < normals.length; offset += 3) {
    if (Math.abs(Math.hypot(normals[offset], normals[offset + 1], normals[offset + 2]) - 1) > 0.0001) throw new Error(`Non-unit device normal: ${entry.name}`)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.name = `blender-v19-${entry.name}`
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setIndex(indices)
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  const size = geometry.boundingBox.getSize(new THREE.Vector3())
  const center = geometry.boundingBox.getCenter(new THREE.Vector3())
  if (size.toArray().some((value, axis) => Math.abs(value - dimensions[axis]) > 0.0000002) || center.length() > 0.0000002) {
    geometry.dispose()
    throw new Error(`Device geometry bounds mismatch: ${entry.name}`)
  }
  geometry.userData = { deviceAsset: entry.name, generator: 'Blender', dimensions: [...dimensions] }
  return geometry
}

export function loadDeviceAssets() {
  if (!loading) {
    loading = fetch(assetUrl).then(async response => {
      if (!response.ok) throw new Error(`Device asset load failed: ${response.status} ${assetUrl}`)
      const document = await response.json()
      if (document.version !== 19 || document.coordinateSystem !== 'X-right,Y-up,Z-front' || !Array.isArray(document.geometries) || document.geometries.length !== 4) throw new Error('Invalid v19 device asset document')
      const decoded = new Map()
      try {
        for (const entry of document.geometries) {
          const geometry = decodeGeometry(entry)
          const key = geometryKey(entry.dimensions)
          if (decoded.has(key)) {
            geometry.dispose()
            throw new Error(`Duplicate device geometry: ${entry.name}`)
          }
          decoded.set(key, geometry)
        }
      } catch (error) {
        for (const geometry of decoded.values()) geometry.dispose()
        throw error
      }
      for (const [key, geometry] of decoded) geometryCache.set(key, geometry)
    }).catch(error => {
      loading = null
      throw error
    })
  }
  return loading
}

export function getDeviceGeometry(width, height, depth, radius) {
  return geometryCache.get(geometryKey([width, height, depth, radius]))?.clone() ?? null
}
