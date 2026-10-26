import * as THREE from 'three'
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'

const NAMES = ['depth', 'system', 'compiler', 'family', 'precision', 'evidence', 'method', 'lab', 'adoption', 'human']
const plates = new Map()
let reflection

export async function loadQualityAssets() {
  const loader = new THREE.TextureLoader()
  await Promise.all(NAMES.map(async name => {
    const texture = await loader.loadAsync(new URL(`../assets/plate-${name}-4k.png`, import.meta.url).href)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.generateMipmaps = false
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
    plates.set(name, texture)
  }))
  reflection = await new HDRLoader().loadAsync(new URL('../assets/studio-reflections.hdr', import.meta.url).href)
  reflection.mapping = THREE.EquirectangularReflectionMapping
}

export function qualityPlate(name) {
  const texture = plates.get(name)
  if (!texture) throw new Error(`Blender studio plate has not loaded: ${name}`)
  return texture
}

export function applyQualityEnvironment(stage) {
  if (!reflection) throw new Error('Blender reflection environment has not loaded')
  const generator = new THREE.PMREMGenerator(stage.renderer)
  generator.compileEquirectangularShader()
  const target = generator.fromEquirectangular(reflection)
  stage.scene.environment = target.texture
  stage.envRT.dispose()
  stage.envRT = target
  generator.dispose()
}
