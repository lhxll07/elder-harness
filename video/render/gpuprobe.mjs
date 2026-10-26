// Which GL backend is Chromium actually using, and what does a frame cost?
//
//   node render/gpuprobe.mjs                      # every known backend
//   node render/gpuprobe.mjs --gpu angle-vulkan
//   node render/gpuprobe.mjs --at 8,105,244
//
// This film is a WebGL2 render: bloom, bokeh and a grade pass per frame at
// 1920x1080. Whether that runs on the discrete GPU or on SwiftShader is the
// entire cost of the render, and Chromium decides it silently from a flag set
// that has no obvious relationship to the hardware. So it gets asked.
//
// The timing measures exactly what `frames.mjs` does per frame — render, then
// read the canvas back — because the readback and the JPEG encode are part of
// the cost and a GPU that only accelerates the draw would still decode slowly.

import { launch, GPU_MODES } from './cdp.mjs'
import { serve } from './serve.mjs'
import { captureExpr } from './capture.mjs'
import { DURATION } from '../src/timeline.js'

const RENDERER_EXPR = `(() => {
  const c = document.createElement('canvas')
  const gl = c.getContext('webgl2') || c.getContext('webgl')
  if (!gl) return 'no webgl'
  const ext = gl.getExtension('WEBGL_debug_renderer_info')
  if (!ext) return 'webgl (renderer string hidden)'
  return gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) + ' / ' + gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
})()`

const args = parseArgs(process.argv.slice(2))
const modes = args.gpu ? [String(args.gpu)] : Object.keys(GPU_MODES)
const SAMPLES = args.at ? String(args.at).split(',').map(Number) : [8, 30, 50, 70, 105, 140, 170, 195, 225, 244]

const FPS = 60
const FRAMES = Math.round(DURATION * FPS)
const WORKERS = Number(args.workers ?? 8)

const server = await serve()
const rows = []

try {
  for (const mode of modes) {
    process.stdout.write(`${mode.padEnd(14)} … `)
    const r = await probe(mode)
    rows.push(r)
    if (r.error) console.log(`FAILED  ${r.error.split('\n')[0]}`)
    else console.log(`${r.mid}ms/frame  ${short(r.gl)}`)
  }
} finally {
  await server.close()
}

console.log('')
console.log(`正片 ${FRAMES} 帧（${DURATION}s @ ${FPS}fps）\n`)

const header = ['后端', 'GL', '中位', '均值', '最快', '全片估时']
const table = rows.map((r) => {
  if (r.error) return [r.mode, '—', '—', '—', '—', r.error.split('\n')[0].slice(0, 30)]
  // Wall-clock for the whole film, split across the workers a render would use.
  const wall = (r.mid * FRAMES) / WORKERS / 1000
  return [r.mode, short(r.gl), `${r.mid}ms`, `${r.avg.toFixed(0)}ms`, `${r.min}ms`, fmtDur(wall)]
})
printTable(header, table)

const best = rows.filter((r) => !r.error).sort((a, b) => a.mid - b.mid)[0]
const worst = rows.filter((r) => !r.error).sort((a, b) => b.mid - a.mid)[0]

if (best) {
  console.log(`\n最快：${best.mode}（${best.mid}ms/帧）`)
  if (worst && worst.mid > best.mid * 1.5) {
    console.log(`${worst.mode} 慢 ${(worst.mid / best.mid).toFixed(1)}× —— 渲染时用 --gpu ${best.mode}`)
  }
  if (/swiftshader|llvmpipe|software/i.test(best.gl ?? '')) {
    console.log('\n注意：最快的一档仍是软件光栅。说明这台机器上 Chromium 没能拿到 GPU；')
    console.log('     检查 nvidia 的 EGL/ICD 是否装了（nvidia-smi 能跑不代表 EGL 可用）。')
  }
}

async function probe(mode) {
  const port = 9500 + Math.floor(Math.random() * 400)
  let browser
  try {
    browser = await launch({ width: 1920, height: 1080, port, gpu: mode })
  } catch (e) {
    return { mode, error: e.message }
  }

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
      return { mode, error: 'page never ready: ' + why }
    }

    const gl = await ev(s, RENDERER_EXPR)
    const times = []
    for (const t of SAMPLES) {
      const t0 = Date.now()
      await ev(s, captureExpr(t, 'jpeg', 90))
      times.push(Date.now() - t0)
    }

    times.sort((a, b) => a - b)
    return {
      mode,
      gl,
      min: times[0],
      mid: times[Math.floor(times.length / 2)],
      avg: times.reduce((a, b) => a + b, 0) / times.length,
    }
  } catch (e) {
    return { mode, error: e.message }
  } finally {
    await browser.close()
  }
}

/** Long renderer strings are the norm; the head is the part that identifies it. */
function short(s) {
  if (!s) return '—'
  const cleaned = String(s).replace(/^Google Inc\. \(Google, Inc\.\)\s*/, '').trim()
  return cleaned.length > 46 ? cleaned.slice(0, 43) + '…' : cleaned
}

function fmtDur(sec) {
  if (sec < 90) return `${sec.toFixed(0)}s`
  const m = Math.floor(sec / 60)
  return `${m}m${String(Math.round(sec - m * 60)).padStart(2, '0')}s`
}

function printTable(header, rows) {
  const widths = header.map((h, i) => Math.max(vw(h), ...rows.map((r) => vw(r[i] ?? ''))))
  const line = (cells) => cells.map((c, i) => padTo(c, widths[i])).join('  ')
  console.log(line(header))
  console.log(widths.map((w) => '─'.repeat(w)).join('  '))
  for (const r of rows) console.log(line(r))
}

function vw(s) {
  // CJK glyphs are two columns wide; without this the table's columns drift.
  return [...String(s)].reduce((n, ch) => n + (/[　-鿿＀-￯]/.test(ch) ? 2 : 1), 0)
}

function padTo(s, w) {
  return String(s) + ' '.repeat(Math.max(0, w - vw(s)))
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
