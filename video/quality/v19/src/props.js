// Reusable geometry. Every prop is built once and moved by the chapters, never
// rebuilt — at 14400 frames, allocation inside the render loop is the whole
// performance budget.

import * as THREE from 'three'
import { C, css, EMIT, rgb } from './palette.js'
import { textPlane } from './text.js'
import { phoneShell, deviceDetails, cameraModule } from './device-detail.js'

export { loadDeviceAssets } from './device-assets-v19.js'

/**
 * The device's real dimensions, in world units. One unit ≈ 100mm, so the whole
 * table reads as the phone's actual millimetre measurements.
 *
 * The proportions are those of a modern flagship: 19.5:9, a 2.5mm metal rail,
 * and a 1.5mm bezel — the previous model used a 12mm bezel and a rail that
 * sat *outside* the chamfer, which is the "thick glowing border" the review
 * called out. Real devices have almost no bezel and the rail is a face of the
 * body, not a shell around it.
 */
export const PHONE = {
  w: 0.70,
  h: 1.52,
  d: 0.078,
  r: 0.098,
  /** Metal rail thickness measured on the body's own silhouette. */
  rail: 0.025,
  /** Black gap between the glass edge and the active display. */
  bezel: 0.015,
  /** Corner radius of the display itself, inside the glass's own radius. */
  screenR: 0.082,
  camR: 0.034,
}

/**
 * Z heights of the device's front layers, in world units.
 *
 * These are the fix for the artefact that made the first render unusable. An
 * ExtrudeGeometry with a bevel protrudes forward by `bevelSize` in *both*
 * directions, so a body built with depth 0.030 and radius 0.075 actually
 * extends to z ≈ 0.012 in front of its nominal face — and the screen plane,
 * which sat 0.0008 in front of that nominal face, was therefore *inside* the
 * body. Two near-coplanar surfaces a few thousandths apart at a shallow angle
 * is the textbook recipe for z-fighting, which is what the diagonal moiré
 * across the display was.
 *
 * So the front layers are declared once, here, with gaps an order of magnitude
 * larger than any depth precision the renderer needs, and every prop reads
 * from this table rather than inventing its own offset.
 */
const Z = {
  bodyBack: -0.039,
  bodyFront: 0.039,
  /** The black border ring, a hair above the chassis' front face. */
  maskEdge: 0.0395,
  /** The display, on top of the mask: nothing may sit over an emissive panel. */
  screen: 0.0399,
  /** Cover glass, last, and never opaque enough to grey the display. */
  glass: 0.0412,
  /** Camera island, on the *back* — `bodyBack` is negative, so this is too. */
  cam: -0.046,
  edgeGlow: 0.0415,
}

export const PHONE_Z = Z

/**
 * The phone.
 *
 * Four meshes, in the order a real handset is assembled: a chassis with a
 * chamfered rail and a flat back, a cover glass that reaches the rail
 * (an all-screen front, edge to edge), the display and its hairline border
 * behind that glass, and a camera island.
 *
 * The screen is the only emissive surface in the film, so its brightness
 * relative to everything else is what makes the whole image read.
 */
export function makePhone() {
  const group = new THREE.Group()

  // ── Chassis ───────────────────────────────────────────────────────────────
  // One solid, chamfered on all four sides. The rail is rendered by the
  // chamfer catching the key and rim light — the previous model added a
  // separate bright band *around* the body, which is what made the silhouette
  // read as a bordered slab rather than a handset.
  const chassis = new THREE.Mesh(
    phoneShell(PHONE.w, PHONE.h, PHONE.d, PHONE.r),
    new THREE.MeshPhysicalMaterial({
      // Dark anodised aluminium, not polished chrome: on a real device the rail
      // is a matte edge, and a mirror finish here would put a hard specular line
      // around the whole silhouette.
      color: 0x69777e,
      roughness: 0.34,
      metalness: 0.82,
      envMapIntensity: 0.78,
      clearcoat: 0.12,
      clearcoatRoughness: 0.32,
    }),
  )
  group.add(chassis)

  // ── Cover glass ───────────────────────────────────────────────────────────
  // Full width and height: no bezel outside it. The dark border a phone shows
  // is *behind* this glass, drawn by the mask below.
  //
  // Kept faint on purpose — and fainter than it looks like it needs to be.
  //
  // A cover glass is a mirror at a shallow angle, and with `clearcoat: 1.0` and a
  // near-zero roughness this one rendered at close to white, so at even 0.12
  // opacity it added about half again to the brightness of the display behind
  // it. Measured on the prologue's close shot, the front of the device read 79
  // out of 255 with the glass and 54 without: the "dark phone showing a lit
  // screen" the film needs was arriving as a flat pale slab, and the same device
  // looked like a different object in every chapter that caught the environment
  // at a different angle. The display has to stay legible through it.
  //
  // What is left is enough for a sheen along the edge and for the screen to read
  // as being *under* something. Anything more is a second image on top.
  const glass = new THREE.Mesh(
    phoneShell(PHONE.w - 0.003, PHONE.h - 0.003, 0.002, PHONE.r - 0.0015),
    new THREE.MeshPhysicalMaterial({
      color: 0xf2f7fa,
      roughness: 0.095,
      metalness: 0,
      clearcoat: 0.45,
      clearcoatRoughness: 0.08,
      transparent: true,
      opacity: 0.025,
      depthWrite: false,
      envMapIntensity: 0.3,
    }),
  )
  glass.position.z = Z.glass
  group.add(glass)

  // ── Display ───────────────────────────────────────────────────────────────
  // A rounded rectangle, not a plane, so the corners follow the glass instead
  // of squaring off inside it.
  const screenMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    toneMapped: false,
  })
  const sw = PHONE.w - PHONE.bezel * 2
  const sh = PHONE.h - PHONE.bezel * 2
  const screen = new THREE.Mesh(roundedPlaneGeometry(sw, sh, PHONE.screenR, 48), screenMat)
  screen.position.z = Z.screen
  group.add(screen)

  // The black border, a hair larger than the display and the same colour as the
  // glass's edge. This is the phone's visible bezel.
  const mask = new THREE.Mesh(
    roundedPlaneGeometry(sw + 0.008, sh + 0.008, PHONE.screenR + 0.004, 48),
    new THREE.MeshBasicMaterial({
      color: 0x05080a,
      transparent: true,
      opacity: 0.97,
      toneMapped: false,
    }),
  )
  mask.position.z = Z.maskEdge
  group.add(mask)

  // ── Camera island ─────────────────────────────────────────────────────────
  // Two lenses and a flash on a raised pill. Small, but it is the single detail
  // that tells a viewer which way the device is facing when the screen is off.
  const cam = cameraModule()
  cam.position.set(-PHONE.w / 2 + 0.135, PHONE.h / 2 - 0.115, Z.cam)
  group.add(cam)
  deviceDetails(group, PHONE, Z)

  group.userData.screen = screen
  group.userData.screenMat = screenMat
  group.userData.glass = glass
  group.userData.mask = mask
  group.userData.chassis = chassis
  group.userData.cam = cam
  return group
}

/**
 * A rounded *plane*: a flat rounded rectangle with UVs covering its full bounds,
 * for anything that is textured or has to read as a screen.
 *
 * PlaneGeometry's UVs are what the display texture depends on, and a Shape's
 * extrusion would give the screen a front face plus sides the texture does not
 * cover. This keeps the UV mapping identical to a plane while rounding the
 * corners.
 */
export function roundedPlaneGeometry(w, h, r, segments = 24) {
  const shape = roundedRect2D(w, h, r, segments)
  const geo = new THREE.ShapeGeometry(shape, segments)
  // ShapeGeometry's UVs are in shape space, not 0..1.
  const uv = geo.attributes.uv
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (uv.getX(i) + w / 2) / w, (uv.getY(i) + h / 2) / h)
  }
  uv.needsUpdate = true
  return geo
}

/**
 * A rounded box with no bevel.
 *
 * The film's device has to be built from non-bevelled extrusions: ExtrudeGeometry's
 * bevel expands a shape in every direction including the extrusion axis, so a
 * bevelled front face is not where the geometry says it is, and stacking the
 * screen, the mask and the glass on top of one becomes guesswork. Flat
 * extrusions have exact bounds, which is what the z-layer table needs. The
 * softening the bevel would have provided is instead done with the cover glass
 * highlight and the edge glow, where it can be controlled.
 */
export function roundedBoxFlat(w, h, d, r, curveSegments = 16) {
  const geo = roundedRect2D(w, h, r, curveSegments)
  const extrude = new THREE.ExtrudeGeometry(geo, {
    depth: d,
    bevelEnabled: false,
    curveSegments,
  })
  extrude.center()
  extrude.computeVertexNormals()
  return extrude
}

/** A rounded rectangle as a Shape, used by both box builders. */
function roundedRect2D(w, h, r, curveSegments) {
  const shape = new THREE.Shape()
  const rad = Math.min(r, w / 2, h / 2)
  const x = -w / 2
  const y = -h / 2

  shape.moveTo(x + rad, y)
  shape.lineTo(x + w - rad, y)
  shape.absarc(x + w - rad, y + rad, rad, -Math.PI / 2, 0, false)
  shape.lineTo(x + w, y + h - rad)
  shape.absarc(x + w - rad, y + h - rad, rad, 0, Math.PI / 2, false)
  shape.lineTo(x + rad, y + h)
  shape.absarc(x + rad, y + h - rad, rad, Math.PI / 2, Math.PI, false)
  shape.lineTo(x, y + rad)
  shape.absarc(x + rad, y + rad, rad, Math.PI, Math.PI * 1.5, false)
  return shape
}

/**
 * A rounded box. three's RoundedBoxGeometry lives in examples/jsm and pulls in
 * another module for one shape; this is a cheap lathe-free approximation built
 * from a subdivided box with corner-rounded cross sections, which is enough at
 * the scale the phone is ever seen.
 */
export function roundedBox(w, h, d, r, segments = 3) {
  const shape = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  shape.moveTo(x + r, y)
  shape.lineTo(x + w - r, y)
  shape.quadraticCurveTo(x + w, y, x + w, y + r)
  shape.lineTo(x + w, y + h - r)
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  shape.lineTo(x + r, y + h)
  shape.quadraticCurveTo(x, y + h, x, y + h - r)
  shape.lineTo(x, y + r)
  shape.quadraticCurveTo(x, y, x + r, y)

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: d,
    bevelEnabled: true,
    bevelThickness: Math.min(r * 0.35, d * 0.4),
    bevelSize: Math.min(r * 0.28, d * 0.4),
    bevelSegments: segments,
    curveSegments: 12,
  })
  geo.center()
  geo.computeVertexNormals()
  return geo
}

/**
 * A frosted card. Used for the claim cards, the hand-off notices and the family
 * reply — one object with a different colour and content per use, which is what
 * keeps the film's vocabulary small enough to stay legible.
 */
export function makeCard({ w = 0.86, h = 0.30, color = C.bone, opacity = 0.93, radius = 0.035 } = {}) {
  const group = new THREE.Group()
  const geo = roundedBox(w, h, 0.006, radius, 2)

  const face = new THREE.Mesh(
    geo,
    new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.55,
      metalness: 0,
      transparent: true,
      opacity,
      transmission: 0.35,
      thickness: 0.05,
      clearcoat: 0.6,
      clearcoatRoughness: 0.3,
      depthWrite: false,
    }),
  )
  group.add(face)

  group.userData.face = face
  group.userData.size = { w, h }
  return group
}

/** A flat plane the chapter can put text on, kept as its own object for fading. */
export function makeTextPlane(content, opts = {}) {
  return textPlane(content, opts)
}

/** A thin glowing line between two points. */
export function makeBeam(from, to, { color = C.brand, opacity = 0.8, radius = 0.008 } = {}) {
  const dir = new THREE.Vector3().subVectors(to, from)
  const len = dir.length()
  const geo = new THREE.CylinderGeometry(radius, radius, 1, 8, 1, true)
  geo.translate(0, 0.5, 0)
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      toneMapped: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  )
  mesh.position.copy(from)
  mesh.scale.set(1, len, 1)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
  return mesh
}

/** A soft radial sprite, for glows and node halos. */
export function makeGlow({ color = C.brand, size = 0.4, opacity = 0.6 } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, `rgba(255,255,255,0.95)`)
  g.addColorStop(0.25, `rgba(255,255,255,0.42)`)
  g.addColorStop(0.6, `rgba(255,255,255,0.10)`)
  g.addColorStop(1, `rgba(255,255,255,0)`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({
      map: tex,
      color,
      transparent: true,
      opacity,
      toneMapped: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  )
  mesh.userData.setColor = (hex) => mesh.material.color.setHex(hex)
  return mesh
}

/** A pill: the spoken-step chips and the option buttons. */
export function makePill({ w = 0.5, h = 0.085, color = C.bone, opacity = 0.9 } = {}) {
  const mesh = new THREE.Mesh(
    roundedBox(w, h, 0.008, h / 2, 2),
    new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.5,
      metalness: 0,
      transparent: true,
      opacity,
      transmission: 0.3,
      thickness: 0.04,
      depthWrite: false,
    }),
  )
  return mesh
}

/** A step of the three-tier ladder. */
export function makeStep({ w = 1.0, h = 0.10, d = 0.5, color = C.brand, glow = EMIT.quiet } = {}) {
  const group = new THREE.Group()
  const tread = new THREE.Mesh(
    roundedBox(w, h, d, 0.03, 2),
    new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.35,
      metalness: 0.1,
      transparent: true,
      opacity: 0.86,
      transmission: 0.2,
      thickness: 0.06,
      emissive: new THREE.Color(color),
      emissiveIntensity: glow,
    }),
  )
  group.add(tread)
  group.userData.tread = tread
  group.userData.setEmissive = (v) => {
    tread.material.emissiveIntensity = v
  }
  return group
}

/**
 * A grid of proportional lines. The film's recurring "the machine is looking at
 * the screen" motif, drawn flat so it can be laid over anything.
 */
export function makeGrid({ size = 1.2, divisions = 10, color = C.gold, opacity = 0.5 } = {}) {
  const group = new THREE.Group()
  const mat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    toneMapped: false,
    depthWrite: false,
  })
  const half = size / 2
  for (let i = 0; i <= divisions; i++) {
    const k = -half + (size / divisions) * i
    const major = i % 2 === 0
    if (!major) continue
    group.add(
      lineFrom(new THREE.Vector3(k, -half, 0), new THREE.Vector3(k, half, 0), mat),
    )
    group.add(
      lineFrom(new THREE.Vector3(-half, k, 0), new THREE.Vector3(half, k, 0), mat),
    )
  }
  group.userData.setOpacity = (v) => {
    mat.opacity = v
    group.visible = v > 0.001
  }
  return group
}

function lineFrom(a, b, mat) {
  const geo = new THREE.BufferGeometry().setFromPoints([a, b])
  return new THREE.Line(geo, mat)
}

/**
 * A wireframe stack: rows of short segments. This is the shape of both the
 * accessibility tree and the evidence ledger, which is deliberate — they are
 * the same idea (structure extracted from a page) in two roles.
 */
export function makeToggle(color = C.brand, { size = 0.05, on = true } = {}) {
  const geo = new THREE.CircleGeometry(size, 28)
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({
      color: on ? color : 0x3a444b,
      transparent: true,
      opacity: on ? 0.95 : 0.5,
      toneMapped: false,
      depthWrite: false,
    }),
  )
  return mesh
}
