import { THREE, add, surface, fade, smooth01, windowAt, lerp } from './compiler-design.js'
import { text, mono, rule, layer } from './fusion-memory-ui.js'

const WIDTH = 2400
const HEIGHT = 1200

export class FusionWorkspace {
  constructor(parent, renderHeight) {
    this.root = add(parent, new THREE.Group())
    this.root.name = 'page-context-and-validation-records'
    this.uniforms = {
      opacity: { value: 0 }, page: { value: 1 }, verification: { value: 0 },
      column: { value: 0.55 }, adopted: { value: 0 },
      sceneryTint: { value: new THREE.Vector3(1, 1, 1) },
    }
    this.cove = add(this.root, new THREE.Mesh(new THREE.PlaneGeometry(42, 24), new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false, depthTest: false, toneMapped: false,
      vertexShader: `
        varying vec2 positionOnSurface;
        void main() {
          positionOnSurface = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 positionOnSurface;
        uniform float opacity;
        uniform float page;
        uniform float verification;
        uniform float column;
        uniform float adopted;
        uniform vec3 sceneryTint;
        float gaussian(vec2 position, vec2 center, vec2 spread) {
          vec2 distanceToCenter = (position - center) / spread;
          return exp(-dot(distanceToCenter, distanceToCenter));
        }
        void main() {
          vec2 position = positionOnSurface;
          float light = gaussian(position, vec2(0.28, 0.68), vec2(0.35, 0.45));
          float edgeLight = gaussian(position, vec2(0.8, 0.58), vec2(0.30, 0.34));
          float fold = position.y - 0.30 - 0.035 * pow((position.x - 0.5) * 2.0, 2.0);
          float cove = exp(-pow(fold * 7.0, 2.0));
          float activeColumn = exp(-pow((position.x - column) * 22.0, 4.0));
          float recordLeft = gaussian(position, vec2(0.35, 0.58), vec2(0.13, 0.44));
          float recordRight = gaussian(position, vec2(0.67, 0.58), vec2(0.13, 0.44));
          float finish = fract(sin(dot(floor(position * vec2(7000.0, 4000.0)), vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
          vec3 color = vec3(0.010, 0.016, 0.025);
          color += light * vec3(0.012, 0.018, 0.026);
          color += edgeLight * vec3(0.006, 0.016, 0.025);
          color += cove * vec3(0.002, 0.005, 0.009);
          color += activeColumn * page * vec3(0.005, 0.021, 0.021);
          color += verification * (recordLeft + recordRight) * vec3(0.005, 0.010, 0.016);
          color += adopted * gaussian(position, vec2(0.5, 0.63), vec2(0.22, 0.34)) * vec3(0.005, 0.013, 0.012);
          color += finish * 0.0002;
          gl_FragColor = vec4(color * sceneryTint, opacity * 0.76);
        }
      `,
    })), [0, 0, -6.5])
    this.cove.renderOrder = -40
    this.canvas = document.createElement('canvas')
    this.canvas.width = WIDTH
    this.canvas.height = HEIGHT
    this.context = this.canvas.getContext('2d')
    this.contextPlane = add(this.root, surface(this.canvas, 23.5, 11.75), [0, 0.45, -4.7])
    this.contextPlane.material.fog = false
    this.contextPlane.material.depthWrite = false
    this.contextPlane.renderOrder = -20
    this.contextPlane.material.onBeforeCompile = shader => {
      shader.uniforms.contextViewHeight = { value: renderHeight }
      shader.fragmentShader = 'uniform float contextViewHeight;\n' + shader.fragmentShader.replace('#include <alphatest_fragment>', `
        float screenHeight = gl_FragCoord.y / contextViewHeight;
        diffuseColor.a *= smoothstep(0.19, 0.29, screenHeight) * (1.0 - smoothstep(0.82, 0.91, screenHeight));
        #include <alphatest_fragment>
      `)
    }
  }

  update(time) {
    const opacity = windowAt(time, 135.5, 182.1, 1.2, 1.9)
    this.uniforms.opacity.value = opacity
    const transfer = smooth01(time, 151.0, 3.6)
    this.uniforms.page.value = 1 - smooth01(time, 159.7, 1.1)
    this.uniforms.column.value = lerp(0.55, 0.445, transfer)
    this.uniforms.verification.value = windowAt(time, 160, 175.5, 1, 1)
    this.uniforms.adopted.value = smooth01(time, 177.85, 0.65)
    const context = this.context
    context.clearRect(0, 0, WIDTH, HEIGHT)
    context.globalAlpha = 1
    this.drawPage(time, transfer)
    this.drawRecords(time)
    this.drawDirectory(time)
    this.contextPlane.material.map.needsUpdate = true
    this.contextPlane.position.x = lerp(0.32, -0.32, smooth01(time, 138, 20))
    this.contextPlane.rotation.set(0, -0.025 + 0.04 * smooth01(time, 164, 14), 0)
    fade(this.contextPlane, opacity * 0.26)
  }

  drawPage(time, transfer) {
    const context = this.context
    layer(context, windowAt(time, 136, 160.0, 1.2, 1), () => {
      const target = lerp(1300, 900, transfer)
      const wash = context.createLinearGradient(target, 190, target, 1120)
      wash.addColorStop(0, 'rgba(118,169,140,0.035)')
      wash.addColorStop(0.3, 'rgba(118,169,140,0.14)')
      wash.addColorStop(1, 'rgba(118,169,140,0)')
      context.fillStyle = wash
      context.fillRect(target - 170, 188, 340, 950)
      text(context, '周四', target, 352, 80, '#769983', 400, 'center')
      text(context, '周五', lerp(1700, 1300, transfer), 352, 48, '#425b52', 400, 'center')
      text(context, '周三', transfer < 0.5 ? 900 - transfer * 800 : 2100 - transfer * 800, 352, 48, '#425b52', 400, 'center')
      context.fillStyle = '#314a42'
      for (const position of [650, 1050, 1450, 1850]) context.fillRect(position, 330, 1, 660)
      for (const baseline of [350, 510, 670, 830, 990]) rule(context, 440, baseline, 1460, '#334b44')
      const remove = 1 - smooth01(time, 139, 1.8)
      layer(context, remove, () => {
        mono(context, '10 / 22', 450, 918, 34, '#6b7267')
        mono(context, 'element e42', 1580, 918, 32, '#6b7267')
      })
      layer(context, smooth01(time, 140.2, 1.2), () => {
        text(context, '表头', 480, 918, 32, '#61796c', 400)
        text(context, '目标列', target, 918, 32, '#7a9c83', 400, 'center')
        text(context, '行与内容', 1820, 918, 32, '#61796c', 400, 'right')
      })
    })
  }

  drawRecords(time) {
    const context = this.context
    layer(context, windowAt(time, 160, 176.2, 0.7, 0.8), () => {
      const report = smooth01(time, 167.8, 1.2)
      layer(context, 1 - report, () => {
        const positions = [410, 600, 790]
        for (const [index, baseline] of positions.entries()) {
          const amount = smooth01(time, 161.7 + index * 1.8, 0.7)
          layer(context, 0.08 + amount * 0.14, () => {
            mono(context, index < 2 ? `TARGET / 0${index + 1}` : 'REGRESSION / 01', 440, baseline, 26, '#6c8778')
            rule(context, 440, baseline + 58, 1490, '#3e584c')
            mono(context, 'v3', 1210, baseline, 26, '#65836f')
            mono(context, '9c7…a20', 1570, baseline, 26, '#65836f')
          })
        }
      })
      layer(context, report, () => {
        const baseline = lerp(960, 930, report)
        mono(context, 'reading_tables / v3', 440, baseline, 34, '#839b87')
        rule(context, 440, baseline + 55, 1490, '#829b81')
        mono(context, 'contract 9c7…a20', 1530, baseline, 33, '#839b87')
      })
    })
  }

  drawDirectory(time) {
    const context = this.context
    layer(context, windowAt(time, 176, 182.5, 0.8, 0.8), () => {
      const adopted = smooth01(time, 177.85, 0.65)
      text(context, '技巧目录', 560, 355, 36, '#75917b', 400)
      layer(context, 1 - adopted, () => text(context, '候选', 1820, 355, 44, '#677a6a', 400, 'right'))
      layer(context, adopted, () => text(context, '生效', 1820, 355, 44, '#90b496', 400, 'right'))
      rule(context, 560, 330, 1260, '#49624e')
      mono(context, 'reading_tables', 560, 860, 44, '#829b81')
      text(context, '当前应用', 1230, 860, 30, '#6f8d75', 400)
      text(context, '读表任务', 1530, 860, 30, '#6f8d75', 400)
      text(context, '表头可见', 1830, 860, 30, '#6f8d75', 400)
      const load = smooth01(time, 180.2, 0.8)
      rule(context, 560, 1050, 1260 * load, '#8bab8b')
    })
  }
}
