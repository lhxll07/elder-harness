// The stage: renderer, post chain, camera rig.
//
// One camera, one world. Chapters do not cut between scenes — they occupy
// regions of a single continuous space, and the camera travels between them.
// That is the whole reason the film can be 4 minutes without a single hard cut:
// there is never a "new scene" to cut to.

import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js'
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js'
import { C, rgb } from './palette.js'
import { clamp, EASE, hash11, lerp, smooth01 } from './ease.js'
import { Studio } from './studio.js'

export const WIDTH = 1920
export const HEIGHT = 1080

/**
 * Grade shader. Applied last, after bloom.
 *
 * This is the single biggest lever on whether the render reads as "WebGL demo"
 * or "film": slight tone curve, a vignette, film grain that is a pure function
 * of (x, y, t) so it stays deterministic, and a whisper of chromatic aberration
 * that grows toward the frame edge.
 */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 0.38 },
    uGrain: { value: 0.0015 },
    uAberration: { value: 0.00012 },
    uLift: { value: new THREE.Vector3(...rgb(C.floor)) },
    uExposure: { value: 1.0 },
    uFade: { value: 1.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uAberration;
    uniform float uExposure;
    uniform float uFade;
    uniform vec3 uLift;
    varying vec2 vUv;

    float hash(vec2 p) {
      p = fract(p * vec2(233.34, 851.73));
      p += dot(p, p + 23.45);
      return fract(p.x * p.y);
    }

    void main() {
      vec2 uv = vUv;
      vec2 c = uv - 0.5;
      float r2 = dot(c, c);

      // Radial chromatic aberration, zero at centre so the focal subject stays
      // razor sharp and only the corners separate.
      vec2 off = c * uAberration * (0.35 + r2 * 2.6);
      vec3 col;
      col.r = texture2D(tDiffuse, uv + off).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - off).b;

      col *= uExposure;

      // Filmic shoulder: keeps highlights from clipping flat white, which is
      // what makes a phone screen read as a light source rather than a rectangle.
      col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);

      // Shadow lift toward the room's own colour, so black is never a dead hole.
      // Applied as an additive floor rather than a mix, which keeps the lift
      // independent of the pixel's own value and stops the deep background from
      // banding — a mix against near-zero is where the dither pattern shows.
      float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col += uLift * 0.055 * (1.0 - smoothstep(0.0, 0.30, lum));

      // Vignette, gentle and off-centre so it does not look like a lens preset.
      float v = 1.0 - uVignette * smoothstep(0.18, 0.86, r2 * 1.95);
      col *= v;

      // Grain. Deterministic in (x, y, time) — a frame renders the same twice.
      // Scaled by local luma so it never lifts a black frame into visible noise:
      // grain belongs on the mid-tones, not in the shadows.
      float g = hash(floor(uv * vec2(1920.0, 1080.0)) + vec2(uTime * 91.7, uTime * 47.3));
      col += (g - 0.5) * uGrain * mix(0.15, 1.0, smoothstep(0.0, 0.25, dot(col, vec3(0.333))));

      col *= uFade;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
}

export class Stage {
  constructor(canvas) {
    this.canvas = canvas
    const parameters = new URLSearchParams(location.search)
    this.offline = parameters.get('offline') === '1'
    this.renderScale = Number(parameters.get('renderScale') ?? 1)
    if (!Number.isFinite(this.renderScale) || this.renderScale < 1 || this.renderScale > 2) throw new Error('renderScale 必须介于 1 和 2 之间')
    this.renderWidth = Math.round(WIDTH * this.renderScale / 2) * 2
    this.renderHeight = Math.round(HEIGHT * this.renderScale / 2) * 2
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true, // toDataURL reads the buffer after the draw
    })
    this.renderer.setPixelRatio(1)
    this.renderer.setSize(this.renderWidth, this.renderHeight, false)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.NoToneMapping // the grade pass owns the curve
    this.renderer.setClearColor(C.backdropDeep, 1)
    this.renderer.debug.onShaderError = (context, program, vertex, fragment) => {
      window.__error = ['Shader compilation failed', context.getProgramInfoLog(program), context.getShaderInfoLog(vertex), context.getShaderInfoLog(fragment)].filter(Boolean).join('\n')
    }

    // A lost WebGL context does not throw. `toDataURL` simply returns a black
    // image, `renderer.render` quietly does nothing, and an offline render keeps
    // "succeeding" for thousands of frames — this is exactly how the first full
    // render of this film produced 1800 black frames from one worker and still
    // exited 0. Publishing the state lets the renderer notice and re-do the work
    // on a fresh context instead of shipping the black.
    this.contextLost = false
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault()
      this.contextLost = true
      window.__error = 'WebGL context lost'
    })
    canvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false
    })

    this.scene = new THREE.Scene()
    this.scene.fog = new THREE.FogExp2(C.backdropDeep, 0.030)

    this.camera = new THREE.PerspectiveCamera(34, WIDTH / HEIGHT, 0.1, 200)

    // world: everything the camera travels past.
    this.world = new THREE.Group()
    this.scene.add(this.world)

    // rig: the camera's own group, so camera motion composes cleanly with a
    // handheld offset that is applied on top rather than fighting it.
    this.rig = new THREE.Group()
    this.scene.add(this.rig)
    this.rig.add(this.camera)

    // overlay: subtitles, and anything else that must survive the post chain
    // untouched.
    //
    // This exists because the composer's depth-of-field pass renders the whole
    // scene with an override material to build its depth buffer — and a
    // subtitle, which lives 1.9 units in front of a camera focused at 7, is
    // therefore blurred as if it were a close foreground object. Bloom and film
    // grain hurt it too. Drawing the strip in its own orthographic space *after*
    // the composer is the only way to guarantee the type stays at full
    // resolution, and it makes "56px" mean 56 real pixels.
    this.overlay = new THREE.Scene()
    this.overlayCam = new THREE.OrthographicCamera(-WIDTH / 2, WIDTH / 2, HEIGHT / 2, -HEIGHT / 2, -1000, 1000)
    this.overlayCam.position.z = 10

    this._buildEnvironment()
    this._buildPost()
  }

  /**
   * The room. Not geometry the viewer should notice — its job is to give the
   * glass, the water-like floor and the fog something to reflect and fade into.
   */
  _buildEnvironment() {
    this.studio = new Studio(this.scene, this.world)
    this.floor = this.studio.floor

    // A single soft key light, high and behind the camera's left shoulder, plus
    // a cool rim from far right. Two lights, no more: every extra source adds a
    // second set of specular highlights and the phone stops reading as one object.
    const key = new THREE.DirectionalLight(0xdfeaf2, 1.75)
    key.position.set(-4.2, 6.5, 3.4)
    this.scene.add(key)

    const rim = new THREE.DirectionalLight(0x4d7f9c, 1.35)
    rim.position.set(5.6, 3.2, -5.8)
    this.scene.add(rim)

    const fill = new THREE.HemisphereLight(0x8fa6b4, 0x0a1014, 0.70)
    this.scene.add(fill)

    // Env map from a tiny procedural gradient — gives the metal something to
    // reflect without shipping an HDR file.
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    const envScene = makeEnvScene()
    this.envRT = pmrem.fromScene(envScene, 0.025)
    this.scene.environment = this.envRT.texture
    pmrem.dispose()

    this.scene.add(new THREE.AmbientLight(0x2a343a, 0.35))
  }

  _buildPost() {
    // No MSAA render target here.
    //
    // EffectComposer's default target has no `samples`, which does leave the 3D
    // geometry aliased. A 4x multisampled HalfFloat target was measured on this
    // machine before being rejected: a single-frame render went from ~2s to
    // ~120s, and it asks for four times the memory of the target it replaces —
    // the same memory the parallel renderer runs out of when it drops frames to
    // black. Edge quality is worth having; not at that price, and not by making
    // an already fragile render more fragile.
    this.composer = new EffectComposer(this.renderer)
    this.composer.setSize(this.renderWidth, this.renderHeight)

    this.renderPass = new RenderPass(this.scene, this.camera)
    this.composer.addPass(this.renderPass)

    // Depth of field, driven per frame from the camera's focus distance. Kept
    // narrow: this is product/film photography, where the subject is the plane
    // of the phone and everything else is deliberately out of focus.
    this.bokeh = new BokehPass(this.scene, this.camera, {
      focus: 8.0,
      aperture: 0.0016,
      maxblur: 0.006,
      width: this.renderWidth,
      height: this.renderHeight,
    })
    this.composer.addPass(this.bokeh)

    // Bloom.
    //
    this.bloom = new UnrealBloomPass(new THREE.Vector2(this.renderWidth, this.renderHeight), 0.38, 0.38, 1.10)
    this.composer.addPass(this.bloom)

    this.antialias = new ShaderPass({
      ...FXAAShader,
      uniforms: { ...FXAAShader.uniforms, uBlend: { value: 0 } },
      fragmentShader: FXAAShader.fragmentShader
        .replace('uniform vec2 resolution;', 'uniform vec2 resolution; uniform float uBlend;')
        .replace('gl_FragColor = ApplyFXAA( tDiffuse, resolution.xy, vUv );', 'if (uBlend <= 0.0) { gl_FragColor = texture2D(tDiffuse, vUv); return; } gl_FragColor = mix(texture2D(tDiffuse, vUv), ApplyFXAA(tDiffuse, resolution.xy, vUv), uBlend);'),
    })
    this.antialias.uniforms.resolution.value.set(1 / this.renderWidth, 1 / this.renderHeight)
    this.composer.addPass(this.antialias)

    this.grade = new ShaderPass(GradeShader)
    this.composer.addPass(this.grade)

    // OutputPass does the linear -> sRGB encode and must be last.
    this.output = new OutputPass()
    this.output.enabled = !this.offline
    this.composer.addPass(this.output)
    if (this.offline) {
      this.composer.renderToScreen = false
      this.captureTarget = new THREE.WebGLRenderTarget(this.renderWidth, this.renderHeight, { depthBuffer: false, stencilBuffer: false })
      this.captureTarget.texture.name = 'offline-frame'
    }
  }

  /** Uniform handle for the film clock, so grain animates without a global. */
  setTime(t) {
    this.grade.uniforms.uTime.value = t
    const finish = smooth01(t, 102, 4)
    this.antialias.uniforms.uBlend.value = this.renderScale > 1 ? 0.18 : 0.82
    this.grade.uniforms.uGrain.value = lerp(0.0015, 0.0012, finish)
    this.grade.uniforms.uAberration.value = 0.00012
    this.grade.uniforms.uVignette.value = lerp(0.25, 0.22, finish)
    this.studio.update(t)
  }

  setFocus(distance, aperture = 0.0016, maxblur = 0.006) {
    this.bokeh.uniforms.focus.value = distance
    this.bokeh.uniforms.aperture.value = aperture
    this.bokeh.uniforms.maxblur.value = maxblur
  }

  setExposure(v) {
    this.grade.uniforms.uExposure.value = v
  }

  setFade(v) {
    this.grade.uniforms.uFade.value = v
  }

  render() {
    this.composer.render()
    if (this.offline) this.renderer.setRenderTarget(this.composer.readBuffer)

    // The overlay goes on last and outside the post chain, so the depth-of-field,
    // bloom and grain passes never touch it.
    //
    // `autoClear` off keeps the composer's colour; `clearDepth` on top of that is
    // what makes the overlay actually appear. The composer leaves its own depth
    // values in the buffer from the passes it ran, and the subtitle quads — which
    // test depth by default — are rejected against them. The symptom is specific
    // and easy to misread: the objects are in the scene graph, their opacity is
    // correct, and nothing is drawn.
    this.renderer.autoClear = false
    this.renderer.clearDepth()
    this.renderer.render(this.overlay, this.overlayCam)
    this.renderer.autoClear = true
    if (this.offline) {
      this.output.renderToScreen = false
      this.output.render(this.renderer, this.captureTarget, this.composer.readBuffer)
      this.renderer.setRenderTarget(null)
    }
  }
}

/**
 * A gradient sphere used as the environment. Two stops: warm above, cool dark
 * below, plus a soft bright band that reads as a window on curved metal.
 */
function makeEnvScene() {
  const scene = new THREE.Scene()
  const geo = new THREE.SphereGeometry(12, 32, 24)
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      uTop: { value: new THREE.Color(0x3d5566) },
      uBottom: { value: new THREE.Color(0x080c10) },
      uBand: { value: new THREE.Color(0x9fc4d6) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop, uBottom, uBand;
      varying vec3 vPos;
      void main() {
        vec3 n = normalize(vPos);
        float h = n.y * 0.5 + 0.5;
        vec3 col = mix(uBottom, uTop, pow(h, 0.85));
        float band = exp(-pow((n.y - 0.36) / 0.24, 2.0)) * smoothstep(-0.3, 0.5, n.z);
        float strip = exp(-pow((n.x + 0.64) / 0.13, 4.0)) * smoothstep(-0.6, 0.1, n.z) * (1.0 - smoothstep(0.65, 0.95, abs(n.y)));
        float warm = exp(-pow((n.x - 0.71) / 0.22, 4.0) - pow((n.y - 0.13) / 0.65, 4.0));
        col += uBand * band * 0.48;
        col += vec3(0.75, 0.88, 0.90) * strip * 1.65;
        col += vec3(0.85, 0.73, 0.56) * warm * 0.65;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  })
  scene.add(new THREE.Mesh(geo, mat))
  return scene
}

// ---------------------------------------------------------------------------
// Camera rig
// ---------------------------------------------------------------------------

/**
 * A dolly rig. Position and target are separate splines so the camera can move
 * sideways while still looking at the subject, and `roll` is driven separately
 * because a tiny amount of it is the difference between "camera on rails" and
 * "camera on a gimbal".
 */
export class CameraRig {
  constructor() {
    this.keys = []
    this.flowStrength = 0
  }

  flow(strength = 0.65) {
    this.flowStrength = strength
    return this
  }

  /**
   * @param {number} t      absolute seconds
   * @param {number[]} pos  [x, y, z]
   * @param {number[]} look [x, y, z]
   * @param {object} opts   { roll, fov, ease }
   */
  at(t, pos, look, opts = {}) {
    this.keys.push({
      t,
      pos: new THREE.Vector3(...pos),
      look: new THREE.Vector3(...look),
      roll: opts.roll ?? 0,
      fov: opts.fov ?? 34,
      ease: opts.ease ?? EASE.inOut,
    })
    this.keys.sort((a, b) => a.t - b.t)
    return this
  }

  /** Position/target at time t, eased between the bracketing keys. */
  sample(t) {
    const k = this.keys
    if (!k.length) return { pos: new THREE.Vector3(), look: new THREE.Vector3(), roll: 0, fov: 34 }
    if (t <= k[0].t) return k[0]
    if (t >= k[k.length - 1].t) return k[k.length - 1]

    let i = 0
    while (i < k.length - 1 && k[i + 1].t <= t) i++
    const a = k[i]
    const b = k[i + 1]
    const span = b.t - a.t
    const raw = span === 0 ? 1 : (t - a.t) / span
    if (this.flowStrength) {
      const derivative = (index, read) => {
        if (index === 0 || index === k.length - 1) return 0
        const previousSpan = k[index].t - k[index - 1].t
        const nextSpan = k[index + 1].t - k[index].t
        const previousSlope = (read(k[index]) - read(k[index - 1])) / previousSpan
        const nextSlope = (read(k[index + 1]) - read(k[index])) / nextSpan
        if (previousSlope * nextSlope <= 0) return 0
        return Math.sign(previousSlope) * Math.min(Math.abs((previousSlope * nextSpan + nextSlope * previousSpan) / (previousSpan + nextSpan)) * this.flowStrength, Math.abs(previousSlope) * 3, Math.abs(nextSlope) * 3)
      }
      const interpolate = read => {
        const squared = raw * raw
        const cubed = squared * raw
        return (2 * cubed - 3 * squared + 1) * read(a) + (cubed - 2 * squared + raw) * span * derivative(i, read) + (-2 * cubed + 3 * squared) * read(b) + (cubed - squared) * span * derivative(i + 1, read)
      }
      return {
        pos: new THREE.Vector3(...['x', 'y', 'z'].map(axis => interpolate(key => key.pos[axis]))),
        look: new THREE.Vector3(...['x', 'y', 'z'].map(axis => interpolate(key => key.look[axis]))),
        roll: interpolate(key => key.roll),
        fov: interpolate(key => key.fov),
      }
    }
    const k1 = (b.ease ?? EASE.inOut)(clamp(raw, 0, 1))

    return {
      pos: a.pos.clone().lerp(b.pos, k1),
      look: a.look.clone().lerp(b.look, k1),
      roll: lerp(a.roll, b.roll, k1),
      fov: lerp(a.fov, b.fov, k1),
    }
  }

  /**
   * Applies the sampled pose plus a handheld offset.
   *
   * The offset is a sum of two incommensurate sines per axis: it never repeats
   * over the film's length, and — because it is a function of absolute t — it
   * is identical on every worker.
   */
  apply(t, camera, rig, { handheld = 0.020, handheldSpeed = 0.32 } = {}) {
    const s = this.sample(t)
    camera.position.copy(s.pos)
    camera.fov = s.fov
    camera.updateProjectionMatrix()

    const dir = new THREE.Vector3().subVectors(s.look, s.pos).normalize()
    const target = s.pos.clone().add(dir)

    if (handheld > 0) {
      const a = t * handheldSpeed * 1.00 + 11.3
      const b = t * handheldSpeed * 1.618 + 41.7
      const c = t * handheldSpeed * 2.414 + 7.1
      rig.position.set(
        Math.sin(a) * handheld + Math.sin(c * 0.7) * handheld * 0.4,
        Math.cos(b) * handheld * 0.72 + Math.sin(a * 0.53) * handheld * 0.3,
        Math.sin(b * 0.41) * handheld * 0.55,
      )
    } else {
      rig.position.set(0, 0, 0)
    }

    camera.lookAt(target)
    if (s.roll) camera.rotateZ(s.roll * Math.PI / 180)
    return s
  }
}

/** Deterministic jitter for want of a noise function in the rig. */
export function jitter(t, seed, amount) {
  return (hash11(Math.floor(t * 24), seed) - 0.5) * 2 * amount
}
