import * as THREE from 'three'
import { smooth01 } from './ease.js'
import { qualityPlate } from './quality-assets.js'

export const SCENOGRAPHY = [
  { name: 'depth', title: '引子 · 深蓝纵深', start: 0, end: 16, deep: [0.006, 0.011, 0.020], top: [0.033, 0.057, 0.085], light: [0.019, 0.035, 0.050], tint: [0.83, 0.96, 1.12], key: 0xe5edf5, rim: 0x99bdcb },
  { name: 'system', title: '架构 · 靛蓝光廊', start: 16, end: 42, deep: [0.007, 0.010, 0.025], top: [0.043, 0.052, 0.102], light: [0.023, 0.035, 0.064], tint: [0.87, 0.90, 1.20], key: 0xe4eaf7, rim: 0x9eafdb },
  { name: 'compiler', title: '为人编译 · 玉灰层叠台', start: 42, end: 75, deep: [0.009, 0.019, 0.020], top: [0.047, 0.083, 0.077], light: [0.035, 0.057, 0.048], tint: [0.98, 1.17, 0.91], key: 0xe5efe9, rim: 0x9cc6b9 },
  { name: 'family', title: '家人协作 · 暖灰双窗', start: 75, end: 85, deep: [0.022, 0.020, 0.018], top: [0.089, 0.078, 0.067], light: [0.056, 0.048, 0.040], tint: [1.28, 1.09, 0.87], key: 0xf1e7db, rim: 0xcab89e },
  { name: 'precision', title: '定位与阅读 · 青灰取景窗', start: 85, end: 114, deep: [0.007, 0.018, 0.025], top: [0.028, 0.077, 0.092], light: [0.023, 0.060, 0.073], tint: [0.81, 1.14, 1.14], key: 0xe2eef2, rim: 0x8abfc8 },
  { name: 'evidence', title: '事实核验 · 蓝绿双光井', start: 114, end: 136, deep: [0.007, 0.011, 0.025], top: [0.032, 0.048, 0.090], light: [0.024, 0.039, 0.070], tint: [0.82, 0.95, 1.20], key: 0xe5ebf5, rim: 0x9bb9d3 },
  { name: 'method', title: '经验提炼 · 鼠尾草折面', start: 136, end: 149, deep: [0.017, 0.023, 0.017], top: [0.069, 0.089, 0.058], light: [0.050, 0.063, 0.039], tint: [1.22, 1.19, 0.76], key: 0xe9eedf, rim: 0xb9c59f },
  { name: 'lab', title: '独立验证 · 石墨阶梯台', start: 149, end: 170, deep: [0.012, 0.016, 0.024], top: [0.057, 0.069, 0.094], light: [0.042, 0.050, 0.067], tint: [0.98, 1.02, 1.17], key: 0xe7ecf4, rim: 0xa8b9d2 },
  { name: 'adoption', title: '采用与复用 · 开放玉绿', start: 170, end: 179, deep: [0.009, 0.023, 0.022], top: [0.038, 0.091, 0.074], light: [0.030, 0.066, 0.048], tint: [0.98, 1.27, 0.94], key: 0xe5efe7, rim: 0xa1c8b1 },
  { name: 'human', title: '总结 · 归于深蓝', start: 179, end: 196, deep: [0.005, 0.010, 0.021], top: [0.032, 0.055, 0.086], light: [0.020, 0.035, 0.054], tint: [0.86, 0.97, 1.12], key: 0xe5edf5, rim: 0x99bdcb },
]

export const SCENERY_TRANSITION = 3.2

export function sampleFusionScenery(time) {
  const enters = SCENOGRAPHY.map((section, index) => index === 0 ? 1 : smooth01(time, section.start - SCENERY_TRANSITION / 2, SCENERY_TRANSITION))
  return {
    weights: enters.map((amount, index) => amount - (enters[index + 1] ?? 0)),
    compression: smooth01(time, 56.4, 10.6),
    reading: smooth01(time, 101.7, 5.8),
    distillation: smooth01(time, 136, 7),
    adoption: smooth01(time, 169.5, 8.8),
  }
}

const FRAGMENT = `
  uniform vec2 sceneryResolution;
  uniform vec2 sceneryParallax;
  uniform vec3 sceneryDeep;
  uniform vec3 sceneryTop;
  uniform vec3 sceneryLight;
  uniform float sceneryWeights[10];
  uniform float sceneryTime;
  uniform vec4 sceneryProgress;
  uniform sampler2D qualityPlateFirst;
  uniform sampler2D qualityPlateSecond;
  uniform float qualityPlateMix;

  float pool(vec2 point, vec2 center, vec2 spread) {
    vec2 relative = (point - center) / spread;
    return exp(-dot(relative, relative));
  }

  float fold(vec2 point, float height, float slope, float width) {
    float distanceToFold = point.y - height - point.x * slope;
    float face = exp(-pow((distanceToFold - width * 0.7) / width, 2.0));
    float seam = exp(-pow(distanceToFold / (width * 0.13), 2.0));
    float shadow = exp(-pow((distanceToFold + width * 0.6) / (width * 0.8), 2.0));
    return face * 0.54 + seam * 0.12 - shadow * 0.28;
  }

  float windowShape(vec2 point, vec2 center, vec2 halfSize, float radius) {
    vec2 bounds = abs(point - center) - halfSize + radius;
    float distanceToEdge = min(max(bounds.x, bounds.y), 0.0) + length(max(bounds, 0.0)) - radius;
    return (1.0 - smoothstep(-0.02, 0.025, distanceToEdge)) * 0.34 + exp(-pow(distanceToEdge / 0.028, 2.0)) * 0.12;
  }

  void main() {
    vec2 coordinates = gl_FragCoord.xy / sceneryResolution;
    vec2 point = (coordinates - 0.5) * vec2(sceneryResolution.x / sceneryResolution.y, 1.0);
    point += sceneryParallax;
    float vertical = smoothstep(-0.40, 0.48, point.y);
    vec3 color = mix(sceneryDeep, sceneryTop, vertical * 0.76);
    float sharedHorizon = point.y + 0.23 - point.x * 0.045;
    color += sceneryLight * exp(-sharedHorizon * sharedHorizon * 52.0) * 0.11;
    float shape = 0.0;

    if (sceneryWeights[0] > 0.00001) {
      float opening = pool(point, vec2(-0.46, 0.23), vec2(0.68, 0.29));
      opening += pool(point, vec2(0.65, 0.08), vec2(0.38, 0.40)) * 0.25;
      shape += opening * sceneryWeights[0] * 0.55;
    }

    if (sceneryWeights[1] > 0.00001) {
      float corridor = 0.0;
      for (int layer = 0; layer < 4; layer++) {
        float depth = float(layer);
        float edge = abs(point.x + sceneryParallax.x * depth * 0.8) - 0.40 - depth * 0.16 + point.y * 0.34;
        float face = smoothstep(-0.035, 0.02, edge) * (1.0 - smoothstep(0.06, 0.18, edge));
        corridor += face * (0.38 - depth * 0.06) + exp(-pow(edge / 0.017, 2.0)) * 0.07;
      }
      shape += corridor * sceneryWeights[1];
      color += vec3(0.010, 0.012, 0.030) * pool(point, vec2(0.0, 0.27), vec2(0.47, 0.25)) * sceneryWeights[1];
    }

    if (sceneryWeights[2] > 0.00001) {
      float layers = 0.0;
      float spacing = mix(0.135, 0.043, sceneryProgress.x);
      for (int layer = 0; layer < 5; layer++) {
        float height = -0.26 + float(layer) * spacing;
        vec2 bent = point;
        bent.y -= pow(point.x + 0.38, 2.0) * (0.035 + float(layer) * 0.011);
        layers += fold(bent, height, -0.035, 0.080) * 0.32;
      }
      shape += layers * sceneryWeights[2];
      color += vec3(0.010, 0.022, 0.016) * pool(point, vec2(-0.52, 0.16), vec2(0.55, 0.36)) * sceneryWeights[2];
    }

    if (sceneryWeights[3] > 0.00001) {
      vec2 warmPoint = point + sceneryParallax * 0.6;
      float windows = windowShape(warmPoint, vec2(-0.57, 0.19), vec2(0.48, 0.31), 0.15);
      windows += windowShape(warmPoint, vec2(0.65, 0.07), vec2(0.45, 0.34), 0.15) * 0.58;
      shape += windows * sceneryWeights[3];
      color += vec3(0.018, 0.013, 0.008) * pool(point, vec2(-0.56, 0.27), vec2(0.50, 0.40)) * sceneryWeights[3];
    }

    if (sceneryWeights[4] > 0.00001) {
      float aperture = 0.0;
      for (int column = 0; column < 3; column++) {
        float horizontal = -0.62 + float(column) * 0.56 + sceneryProgress.y * 0.055;
        float edge = point.x - horizontal + point.y * 0.08;
        aperture += exp(-pow((edge - 0.06) / 0.13, 2.0)) * 0.17;
        aperture += exp(-pow(edge / 0.009, 2.0)) * 0.045;
      }
      shape += aperture * sceneryWeights[4] * smoothstep(-0.42, -0.18, point.y);
      color += vec3(0.004, 0.022, 0.030) * pool(point, vec2(0.48, 0.30), vec2(0.50, 0.26)) * sceneryWeights[4];
    }

    if (sceneryWeights[5] > 0.00001) {
      float leftWell = pool(point, vec2(-0.56, 0.18), vec2(0.30, 0.40));
      float rightWell = pool(point, vec2(0.56, 0.18), vec2(0.30, 0.40));
      float divider = exp(-pow(point.x / 0.13, 2.0));
      color += (vec3(0.017, 0.034, 0.068) * leftWell + vec3(0.013, 0.049, 0.043) * rightWell) * sceneryWeights[5];
      color *= 1.0 - divider * sceneryWeights[5] * 0.18;
      shape += fold(point, -0.18, 0.0, 0.08) * sceneryWeights[5] * 0.20;
    }

    if (sceneryWeights[6] > 0.00001) {
      float pleats = 0.0;
      for (int layer = 0; layer < 3; layer++) {
        float level = float(layer);
        vec2 folded = point;
        folded.y -= abs(point.x + 0.12) * mix(0.14, 0.045, sceneryProgress.z);
        pleats += fold(folded, -0.28 + level * 0.15, -0.025, 0.095) * (0.55 - level * 0.09);
      }
      shape += pleats * sceneryWeights[6];
      color += vec3(0.024, 0.026, 0.010) * pool(point, vec2(-0.46, 0.24), vec2(0.63, 0.35)) * sceneryWeights[6];
    }

    if (sceneryWeights[7] > 0.00001) {
      float platforms = 0.0;
      for (int bay = 0; bay < 4; bay++) {
        float offset = float(bay);
        float horizontal = -0.87 + offset * 0.49;
        float lane = smoothstep(horizontal - 0.025, horizontal + 0.025, point.x) * (1.0 - smoothstep(horizontal + 0.44, horizontal + 0.49, point.x));
        float height = -0.25 + offset * 0.075;
        platforms += lane * fold(point, height, 0.065, 0.16) * 0.60;
      }
      shape += platforms * sceneryWeights[7];
      color += vec3(0.013, 0.018, 0.032) * pool(point, vec2(0.34, 0.31), vec2(0.68, 0.27)) * sceneryWeights[7];
    }

    if (sceneryWeights[8] > 0.00001) {
      float opening = pool(point, vec2(mix(-0.45, 0.38, sceneryProgress.w), 0.17), vec2(0.62, 0.35));
      shape += opening * sceneryWeights[8] * 0.45;
      shape += fold(point, -0.27, -0.075, 0.14) * sceneryWeights[8] * 0.36;
    }

    if (sceneryWeights[9] > 0.00001) {
      float summary = 1.0 - smoothstep(186.0, 192.0, sceneryTime);
      float spotlight = pool(point, vec2(mix(-0.30, 0.0, 1.0 - summary), 0.17), vec2(0.64, 0.36));
      shape += spotlight * sceneryWeights[9] * 0.38;
      shape += fold(point, -0.26, 0.025, 0.14) * sceneryWeights[9] * summary * 0.20;
    }

    float textClearance = smoothstep(0.14, 0.32, coordinates.y) * (1.0 - smoothstep(0.82, 0.97, coordinates.y));
    color += sceneryLight * shape * textClearance * 0.55;
    vec2 plateCoordinates = clamp((coordinates - 0.5) * 0.972 + 0.5 + sceneryParallax * vec2(0.58, 0.45), vec2(0.001), vec2(0.999));
    vec3 studio = mix(texture2D(qualityPlateFirst, plateCoordinates).rgb, texture2D(qualityPlateSecond, plateCoordinates).rgb, qualityPlateMix);
    float studioLuma = dot(studio, vec3(0.2126, 0.7152, 0.0722));
    studio *= 0.74 + 0.10 * smoothstep(0.015, 0.16, studioLuma);
    color = mix(color, studio, 0.70);
    float lowerFalloff = 1.0 - smoothstep(0.08, 0.36, coordinates.y);
    color *= 1.0 - lowerFalloff * 0.24;
    gl_FragColor = vec4(max(color, vec3(0.0)), 1.0);
  }
`

export class FusionScenery {
  constructor(stage) {
    this.stage = stage
    this.weights = new Float32Array(SCENOGRAPHY.length)
    this.keyColor = new THREE.Color()
    this.rimColor = new THREE.Color()
    this.workspaceTint = new THREE.Vector3()
    this.workspaceMaterials = []
    this.themes = SCENOGRAPHY.map(section => ({ ...section, keyColor: new THREE.Color(section.key), rimColor: new THREE.Color(section.rim) }))
    const material = stage.studio.background.material
    this.uniforms = {
      sceneryResolution: { value: new THREE.Vector2(stage.renderWidth, stage.renderHeight) },
      sceneryParallax: { value: new THREE.Vector2() },
      sceneryDeep: { value: new THREE.Vector3() },
      sceneryTop: { value: new THREE.Vector3() },
      sceneryLight: { value: new THREE.Vector3() },
      sceneryWeights: { value: this.weights },
      sceneryTime: { value: 0 },
      sceneryProgress: { value: new THREE.Vector4() },
      qualityPlateFirst: { value: qualityPlate('depth') },
      qualityPlateSecond: { value: qualityPlate('depth') },
      qualityPlateMix: { value: 0 },
    }
    Object.assign(material.uniforms, this.uniforms)
    material.fragmentShader = FRAGMENT
    material.needsUpdate = true
    stage.scene.traverse(object => {
      if (object.material?.uniforms?.sceneryTint) this.workspaceMaterials.push(object.material)
    })
  }

  update(time, camera) {
    const pose = sampleFusionScenery(time)
    this.weights.set(pose.weights)
    const active = pose.weights.map((weight, index) => ({ weight, index })).filter(entry => entry.weight > 0.00001)
    const first = active[0] ?? { index: 0, weight: 1 }
    const second = active[1] ?? first
    this.uniforms.qualityPlateFirst.value = qualityPlate(this.themes[first.index].name)
    this.uniforms.qualityPlateSecond.value = qualityPlate(this.themes[second.index].name)
    this.uniforms.qualityPlateMix.value = active.length > 1 ? second.weight / (first.weight + second.weight) : 0
    this.uniforms.sceneryTime.value = time
    this.uniforms.sceneryProgress.value.set(pose.compression, pose.reading, pose.distillation, pose.adoption)
    this.uniforms.sceneryParallax.value.set(Math.tanh(camera.position.x * 0.12) * 0.032, Math.tanh(camera.position.y * 0.15) * 0.020)
    for (const key of ['sceneryDeep', 'sceneryTop', 'sceneryLight']) this.uniforms[key].value.set(0, 0, 0)
    this.workspaceTint.set(0, 0, 0)
    this.keyColor.setRGB(0, 0, 0)
    this.rimColor.setRGB(0, 0, 0)
    this.themes.forEach((theme, index) => {
      const amount = pose.weights[index]
      for (const [key, values] of [['sceneryDeep', theme.deep], ['sceneryTop', theme.top], ['sceneryLight', theme.light]]) {
        const vector = this.uniforms[key].value
        vector.x += values[0] * amount
        vector.y += values[1] * amount
        vector.z += values[2] * amount
      }
      this.workspaceTint.x += theme.tint[0] * amount
      this.workspaceTint.y += theme.tint[1] * amount
      this.workspaceTint.z += theme.tint[2] * amount
      this.keyColor.r += theme.keyColor.r * amount
      this.keyColor.g += theme.keyColor.g * amount
      this.keyColor.b += theme.keyColor.b * amount
      this.rimColor.r += theme.rimColor.r * amount
      this.rimColor.g += theme.rimColor.g * amount
      this.rimColor.b += theme.rimColor.b * amount
    })
    for (const material of this.workspaceMaterials) material.uniforms.sceneryTint.value.copy(this.workspaceTint)
    const deep = this.uniforms.sceneryDeep.value
    this.stage.scene.fog.color.setRGB(deep.x, deep.y, deep.z)
    return pose
  }
}
