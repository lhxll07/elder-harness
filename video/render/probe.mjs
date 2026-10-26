// Scene-graph probe.
//
//   node render/probe.mjs --at 20
//   node render/probe.mjs --at 20 --selector overlay
//
// Answers "why is nothing on screen at t" from the page itself instead of by
// reading code and guessing. It renders the film at the given time and reports
// what the camera actually sees: the overlay's contents, the world's visible
// children, and the numbers that most often explain an empty frame — opacity,
// position, and whether a mesh ended up behind the camera.

import { launch, DEFAULT_GPU } from './cdp.mjs'
import { serve } from './serve.mjs'
import { captureExpr } from './capture.mjs'

/**
 * Summarises one object the way a person debugging a frame would.
 *
 * Written as a source fragment and inlined into each expression below, rather
 * than assigned to a page global: the page is re-navigated for every probe and
 * anything stashed on `window` would have to be re-installed at exactly the
 * right moment, which is one more thing to get wrong.
 */
const SUMMARY_FN = `
  function childSummary(o) {
    const out = {
      name: o.name || o.type,
      visible: o.visible,
      pos: o.position.toArray().map((v) => +v.toFixed(2)),
    }
    const ops = []
    o.traverse((n) => {
      if (n.material && n.material.opacity !== undefined) ops.push(+(n.material.opacity.toFixed(3)))
    })
    if (ops.length) out.opacity = [...new Set(ops)].slice(0, 4)
    if (o.children.length) out.kids = o.children.length
    return out
  }
`

const PIXEL_EXPR = `(() => {
  const c = document.getElementById('view')
  const g = c.getContext('webgl2') || c.getContext('webgl')
  const h = 18
  const px = new Uint8Array(c.width * c.height * 4)
  g.readPixels(0, 0, c.width, c.height, g.RGBA, g.UNSIGNED_BYTE, px)
  let sum = 0, lit = 0, n = 0
  const rows = new Array(h).fill(0)
  const counts = new Array(h).fill(0)
  for (let y = 0; y < c.height; y += 8) {
    const row = (h - 1) - Math.floor((y / c.height) * h)
    for (let x = 0; x < c.width; x += 8) {
      const i = (y * c.width + x) * 4
      const v = px[i] * 0.2126 + px[i + 1] * 0.7152 + px[i + 2] * 0.0722
      sum += v; n++
      if (v > 40) lit++
      rows[row] += v; counts[row]++
    }
  }
  return {
    mean: sum / n,
    lit: lit / n,
    rows: rows.map((v, i) => v / Math.max(1, counts[i])),
  }
})()`

const args = parseArgs(process.argv.slice(2))
const AT = args.at ? String(args.at).split(',').map(Number) : [20]
const SELECTOR = String(args.selector ?? 'all')

const server = await serve()
const browser = await launch({ width: 1920, height: 1080, port: 9337, gpu: String(args.gpu ?? DEFAULT_GPU) })

try {
  const s = browser.session
  await s.send('Page.enable')
  await s.send('Runtime.enable')
  await s.send('Emulation.setDeviceMetricsOverride', {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false,
  })
  await s.send('Page.navigate', { url: server.origin + '/index.html' })

  let ready = false
  for (let i = 0; i < 900 && !ready; i++) {
    ready = await ev(s, 'window.__ready === true').catch(() => false)
    if (!ready) await sleep(100)
  }
  if (!ready) {
    const why = await ev(s, 'window.__error || "unknown"').catch(() => 'unknown')
    throw new Error('page never became ready: ' + why)
  }

  for (const t of AT) {
    await ev(s, captureExpr(t, 'jpeg', 60))
    console.log(`\n──── t = ${t}s ────`)

    if (SELECTOR === 'all' || SELECTOR === 'overlay') {
      const o = await ev(s, overlayExpr())
      console.log(`overlay: ${o.children} children (${o.visible} visible)`)
      for (const c of o.items) console.log('  ' + JSON.stringify(c))
    }

    if (SELECTOR === 'all' || SELECTOR === 'world') {
      const w = await ev(s, worldExpr())
      console.log(`world: ${w.children} children, ${w.visible} visible, camera at [${w.cam.join(', ')}]`)
      for (const c of w.items) console.log('  ' + JSON.stringify(c))
    }

    if (SELECTOR === 'all' || SELECTOR === 'pixels') {
      const p = await ev(s, PIXEL_EXPR)
      console.log(`pixels: mean ${p.mean.toFixed(1)}, lit fraction ${(p.lit * 100).toFixed(1)}%`)
      // Where the brightness actually is. The film should have its subject in
      // the upper-middle and its subtitle band near the bottom, so a row profile
      // says which of the two is missing faster than any screenshot.
      console.log(`  row mean (top→bottom): ${p.rows.map((v) => v.toFixed(0)).join(' ')}`)
    }
  }
} finally {
  await browser.close()
  await server.close()
}

function overlayExpr() {
  return `(() => {
    ${SUMMARY_FN}
    const s = window.__stage
    return {
      children: s.overlay.children.length,
      visible: s.overlay.children.filter((c) => c.visible).length,
      items: s.overlay.children.map(childSummary),
    }
  })()`
}

function worldExpr() {
  return `(() => {
    ${SUMMARY_FN}
    const s = window.__stage
    const vis = s.world.children.filter((c) => c.visible)
    return {
      children: s.world.children.length,
      visible: vis.length,
      cam: s.camera.position.toArray().map((v) => +v.toFixed(2)),
      items: vis.slice(0, 14).map(childSummary),
    }
  })()`
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function ev(session, expr) {
  const r = await session.send('Runtime.evaluate', {
    expression: expr,
    returnByValue: true,
    awaitPromise: true,
  })
  if (r.exceptionDetails) {
    throw new Error('page error: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text))
  }
  return r.result.value
}

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) continue
    const key = a.slice(2)
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) out[key] = true
    else {
      out[key] = isNaN(Number(next)) ? next : Number(next)
      i++
    }
  }
  return out
}
