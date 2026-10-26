import * as THREE from 'three'
import { lerp, smooth01 } from './ease.js'
import { FusionScenery } from './fusion-scenery.js'

export function sampleFusionFinish(time) {
  const reading = [[74, 85], [101, 109], [113, 136], [148, 170], [179, 196]].reduce((amount, [start, end]) => Math.max(amount, smooth01(time, start, 1.8) * (1 - smooth01(time, end - 1.8, 1.8))), 0)
  const presence = smooth01(time, 0, 2.8) * (1 - smooth01(time, 190, 4.2))
  const strength = presence * lerp(1, 0.46, reading)
  return {
    horizontal: (Math.sin(time * 0.43 + 0.7) + Math.sin(time * 0.79 + 2.1) * 0.28) * 0.0015 * strength,
    vertical: (Math.sin(time * 0.37 + 1.8) + Math.sin(time * 0.67 + 0.4) * 0.24) * 0.00095 * strength,
    depth: Math.sin(time * 0.29 + 0.8) * 0.00065 * strength,
    roll: (Math.sin(time * 0.33 + 0.3) + Math.sin(time * 0.61 + 1.4) * 0.22) * 0.00048 * strength,
    strength,
    collaboration: smooth01(time, 74, 2.5) * (1 - smooth01(time, 84, 2.5)),
    verification: smooth01(time, 112, 3) * (1 - smooth01(time, 136, 3)),
    memory: smooth01(time, 136, 3) * (1 - smooth01(time, 179, 4)),
  }
}

function environment(stage) {
  const scene = new THREE.Scene()
  const geometry = new THREE.SphereGeometry(12, 32, 24)
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: `
      varying vec3 direction;
      void main() {
        direction = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 direction;
      void main() {
        vec3 normal = normalize(direction);
        vec3 color = mix(vec3(0.012, 0.020, 0.029), vec3(0.15, 0.20, 0.25), smoothstep(-0.4, 0.9, normal.y));
        float key = exp(-pow((normal.x + 0.43) / 0.30, 4.0) - pow((normal.y - 0.36) / 0.53, 4.0)) * smoothstep(0.0, 0.45, normal.z);
        float rim = exp(-pow((normal.x - 0.76) / 0.15, 4.0) - pow((normal.y - 0.10) / 0.66, 4.0));
        float ceiling = exp(-pow((normal.y - 0.83) / 0.24, 2.0));
        color += vec3(1.85, 2.05, 2.20) * key;
        color += vec3(0.82, 1.08, 1.18) * rim;
        color += vec3(0.20, 0.23, 0.25) * ceiling;
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  })
  scene.add(new THREE.Mesh(geometry, material))
  const generator = new THREE.PMREMGenerator(stage.renderer)
  const target = generator.fromScene(scene, 0.035)
  stage.scene.environment = target.texture
  stage.envRT.dispose()
  stage.envRT = target
  generator.dispose()
  geometry.dispose()
  material.dispose()
}

function illuminateSurface(material, time) {
  const previous = material.onBeforeCompile
  const previousKey = material.customProgramCacheKey()
  const variant = previous === THREE.Material.prototype.onBeforeCompile ? 'shared' : material.uuid
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer)
    shader.uniforms.fusionFinishTime = time
    shader.fragmentShader = 'uniform float fusionFinishTime;\n' + shader.fragmentShader.replace('#include <map_fragment>', `
      #include <map_fragment>
      float paperLuma = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
      float paperMask = smoothstep(0.42, 0.88, paperLuma);
      vec2 lightPosition = vec2(0.22 + sin(fusionFinishTime * 0.12) * 0.045, 0.88);
      vec2 lightDistance = (vMapUv - lightPosition) / vec2(0.86, 0.72);
      float paperLight = exp(-dot(lightDistance, lightDistance));
      diffuseColor.rgb *= mix(1.0, 0.978 + paperLight * 0.025 + vMapUv.y * 0.008, paperMask);
    `)
  }
  material.customProgramCacheKey = () => `${previousKey}|fusion-v16-soft-surface|${variant}`
  material.needsUpdate = true
}

export function finishFusion(stage) {
  const deviceParts = new Set()
  const surfaces = new Set()
  stage.scene.traverse(object => {
    if (object.userData.screenMat) {
      object.traverse(part => deviceParts.add(part))
      const chassis = object.userData.chassis.material
      chassis.roughness = 0.32
      chassis.metalness = 0.82
      chassis.envMapIntensity = 0.82
      chassis.clearcoat = 0.16
      chassis.clearcoatRoughness = 0.27
      const glass = object.userData.glass.material
      glass.roughness = 0.095
      glass.opacity = 0.020
      glass.envMapIntensity = 0.26
    }
    if (object.userData.width && object.userData.height || object.parent?.name.startsWith('source-page-')) {
      if (object.material?.isMeshBasicMaterial && object.material.map) surfaces.add(object.material)
    }
  })
  stage.scene.traverse(object => {
    if (!object.material || deviceParts.has(object)) return
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material.isMeshStandardMaterial) {
        material.metalness = 0
        material.roughness = 0.76
        material.envMapIntensity = 0.22
        if (material.isMeshPhysicalMaterial) {
          material.clearcoat = 0
          material.transmission = 0
        }
      }
      if (material.map) material.map.anisotropy = 16
    }
  })
  environment(stage)
  const timeUniform = { value: 0 }
  for (const material of surfaces) illuminateSurface(material, timeUniform)
  const scenery = new FusionScenery(stage)
  const [key, rim] = stage.scene.children.filter(object => object.isDirectionalLight)
  key.color.setHex(0xe5edf5)
  rim.color.setHex(0x99bdcb)
  key.intensity = 1.65
  rim.intensity = 1.15
  stage.scene.add(key.target, rim.target)
  const right = new THREE.Vector3()
  const up = new THREE.Vector3()
  const forward = new THREE.Vector3()
  const center = new THREE.Vector3()
  const offset = new THREE.Vector3()
  return {
    scenery,
    update(time) {
      const pose = sampleFusionFinish(time)
      const camera = stage.camera
      const distance = stage.bokeh.uniforms.focus.value
      const visibleHeight = 2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
      offset.set(pose.horizontal * visibleHeight, pose.vertical * visibleHeight, pose.depth * distance).applyQuaternion(camera.quaternion)
      camera.position.add(offset)
      camera.rotateZ(pose.roll)
      camera.updateMatrixWorld(true)
      timeUniform.value = time
      scenery.update(time, camera)
      key.color.copy(scenery.keyColor)
      rim.color.copy(scenery.rimColor)
      right.set(1, 0, 0).applyQuaternion(camera.quaternion)
      up.set(0, 1, 0).applyQuaternion(camera.quaternion)
      forward.set(0, 0, -1).applyQuaternion(camera.quaternion)
      center.copy(camera.position).addScaledVector(forward, distance)
      key.target.position.copy(center)
      rim.target.position.copy(center)
      key.position.copy(center).addScaledVector(right, -4.5).addScaledVector(up, 6).addScaledVector(forward, -2.8)
      rim.position.copy(center).addScaledVector(right, 5.8).addScaledVector(up, 2.8).addScaledVector(forward, 3.5)
      stage.bloom.strength = 0.27
      stage.bloom.radius = 0.48
      stage.bloom.threshold = 1.12
      stage.grade.uniforms.uGrain.value = 0.00085
      stage.grade.uniforms.uAberration.value = 0.000055
      stage.grade.uniforms.uVignette.value = 0.19
      return pose
    },
  }
}
