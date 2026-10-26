import * as THREE from 'three'

export class Studio {
  constructor(scene, world) {
    this.uniforms = { uTime: { value: 0 } }
    const background = new THREE.Mesh(new THREE.SphereGeometry(90, 48, 32), new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: `
        varying vec3 vDirection;
        void main() {
          vDirection = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec3 vDirection;
        void main() {
          vec3 direction = normalize(vDirection);
          float drift = sin(uTime * 0.018) * 0.055;
          vec3 color = mix(vec3(0.011, 0.022, 0.028), vec3(0.030, 0.055, 0.061), smoothstep(-0.45, 0.5, direction.y));
          float cool = exp(-7.0 * pow(direction.x + 0.58 + drift, 2.0) - 4.5 * pow(direction.y - 0.14, 2.0));
          float warm = exp(-12.0 * pow(direction.x - 0.70 + drift, 2.0) - 6.0 * pow(direction.y + 0.06, 2.0));
          float silk = direction.y - 0.11 - 0.25 * direction.x - 0.13 * direction.x * direction.x - drift;
          float ribbon = exp(-silk * silk * 23.0) * exp(-direction.x * direction.x * 0.9);
          float lip = exp(-pow(silk + 0.09, 2.0) * 420.0);
          color += vec3(0.014, 0.046, 0.049) * cool;
          color += vec3(0.033, 0.025, 0.014) * warm;
          color += vec3(0.008, 0.021, 0.022) * ribbon;
          color += vec3(0.005, 0.009, 0.009) * lip;
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    }))
    background.name = '柔光无缝影棚'
    background.frustumCulled = false
    background.renderOrder = -1000
    scene.add(background)
    this.background = background

    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      vertexShader: `
        varying vec3 vWorld;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorld = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec3 vWorld;
        void main() {
          vec2 point = vWorld.xz;
          float pool = exp(-point.x * point.x * 0.022 - pow(point.y - 1.0, 2.0) * 0.038);
          float edge = exp(-pow(point.x + 6.0, 2.0) * 0.012 - pow(point.y + 8.0, 2.0) * 0.017);
          vec3 color = vec3(0.012, 0.023, 0.029) + vec3(0.010, 0.021, 0.021) * pool + vec3(0.008, 0.014, 0.017) * edge;
          float alpha = exp(-dot(point, point) * 0.0015) * 0.88;
          gl_FragColor = vec4(color, alpha);
        }
      `,
    }))
    this.floor.rotation.x = -Math.PI / 2
    this.floor.position.y = -2.62
    this.floor.renderOrder = -900
    world.add(this.floor)
  }

  update(time) {
    this.uniforms.uTime.value = time
  }
}
