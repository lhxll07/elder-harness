// Offline frame extraction — parallel across CPU cores.
//
//   node render/frames.mjs                      # whole film
//   node render/frames.mjs --range 38,52        # seconds
//   node render/frames.mjs --only evidence      # one chapter
//   node render/frames.mjs --fps 30 --quality 92 --workers 8
//
// Determinism is the whole point: every worker renders its slice from the same
// static page with the same expression, so a frame is reproducible and a
// chapter can be re-rendered alone after an edit without touching the rest.

import { launch, DEFAULT_GPU } from './cdp.mjs'
import { serve } from './serve.mjs'
import { captureExpr, decodeDataURL, extFor } from './capture.mjs'
import { CHAPTERS, DURATION as BASE_DURATION } from '../src/timeline.js'
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { availableParallelism } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')

const args = parseArgs(process.argv.slice(2))
const ENTRY = String(args.entry ?? 'index.html')
const fusionCapture = ENTRY === 'fusion.html' || Boolean(args['software-canvas'])
const extraArgs = fusionCapture ? ['--disable-accelerated-2d-canvas'] : []
if (!/^[a-zA-Z0-9_./-]+\.html$/.test(ENTRY) || ENTRY.includes('..')) throw new Error('--entry 必须为视频目录内的 HTML 入口')
const DURATION = Number(args.duration ?? BASE_DURATION)
if (!Number.isFinite(DURATION) || DURATION <= 0) throw new Error('--duration 必须为正数')
const FPS = args.fps ?? 60
const FORMAT = args.format ?? 'jpeg'
const QUALITY = args.quality ?? 94
const OUT = resolve(ROOT, args.out ?? 'out/frames')
const WORKERS = args.workers ?? Math.min(8, Math.max(1, availableParallelism() - 2))
const BASE_PORT = args.port ?? 9400 + Math.floor(Math.random() * 400)
// Which GL backend Chromium runs on. On a box with a discrete GPU this is the
// difference between minutes and most of an hour — see render/gpuprobe.mjs,
// which measures it here rather than assuming.
const GPU = String(args.gpu ?? DEFAULT_GPU)
const RENDER_SCALE = Number(args['render-scale'] ?? 1)
if (!Number.isFinite(RENDER_SCALE) || RENDER_SCALE < 1 || RENDER_SCALE > 2) throw new Error('--render-scale 必须介于 1 和 2 之间')
const RENDER_WIDTH = Math.round(1920 * RENDER_SCALE / 2) * 2
const RENDER_HEIGHT = Math.round(1080 * RENDER_SCALE / 2) * 2
// How long a worker waits after tearing down a context that lost its device, so
// the driver's pool has somewhere to reclaim to before a new one is allocated.
const RECOVERY_MS = Number(args.recovery ?? 3000)

const server = await serve()

// The film's table of contents, read straight from the module.
//
// This used to come out of a probe browser: a full Chromium launched on the
// same GPU, the whole page booted, every chapter built and every shader
// compiled — and then thrown away — before the first worker started. That was
// several seconds of pure overhead on every invocation, paid in full even for a
// one-frame render or a single chapter.
//
// DURATION and CHAPTERS are plain data and the page derives its own scene from
// them, so a Node-side copy cannot disagree with what the page builds.
//
// The range is handed to the page as a query string below, and the page builds
// only the chapters inside it. That is the other half of the startup cost: a
// 16-second chapter render used to construct all eleven chapters' worth of
// geometry, canvases and shaders to draw two of them.
let first = Math.max(0, Math.round((args.range ? Number(String(args.range).split(',')[0]) : 0) * FPS))
let last = Math.round((args.range ? Number(String(args.range).split(',')[1]) : DURATION) * FPS)
let selectedShots = null

if (args.only) {
  selectedShots = String(args.only).split(',').map((name) => {
    const shot = CHAPTERS.find((entry) => entry.name === name.trim() || entry.name.startsWith(name.trim()))
    if (!shot) throw new Error(`no shot "${name}". available: ${CHAPTERS.map((entry) => entry.name).join(', ')}`)
    return shot
  })
  if (!args.range) {
    first = Math.round(Math.min(...selectedShots.map((shot) => shot.start)) * FPS)
    last = Math.round(Math.max(...selectedShots.map((shot) => shot.end)) * FPS)
  }
}

const total = last - first
if (total <= 0) {
  console.error(`empty range: frames ${first}..${last}`)
  process.exit(1)
}

// What the page is told to build for. One string, used by every worker.
const WINDOW_QUERY = `?offline=1&renderScale=${RENDER_SCALE}&from=${(first / FPS).toFixed(3)}&to=${(last / FPS).toFixed(3)}` +
  (selectedShots ? `&only=${encodeURIComponent(selectedShots.map((shot) => shot.name).join(','))}` : '')
const PAGE_URL = server.origin + '/' + ENTRY + WINDOW_QUERY

console.log(`本次渲染 ${(total / FPS).toFixed(2)}s @ ${FPS}fps${selectedShots ? ` · ${selectedShots.map((shot) => shot.title).join(' / ')}` : ''}`)
console.log(`原生采集 ${RENDER_WIDTH}×${RENDER_HEIGHT} · render-scale ${RENDER_SCALE}`)
for (const s of (selectedShots ?? (ENTRY === 'index.html' ? CHAPTERS : [])).filter((chapter) => chapter.end * FPS > first && chapter.start * FPS < last)) {
  const mark = s.start * FPS >= first && s.start * FPS < last ? '>' : ' '
  console.log(`  ${mark} ${s.name.padEnd(14)} ${fmt(s.start)} – ${fmt(s.end)}  (${(s.end - s.start).toFixed(1)}s)`)
}
console.log(`frames ${first}..${last - 1}  (${total})  →  ${WORKERS} workers`)

if (args.clean && existsSync(OUT)) rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

const ext = extFor(FORMAT)
const started = Date.now()
let doneCount = 0
let failed = null

// Contiguous blocks, not round-robin: each worker holds one long-lived page, so
// the per-frame cost stays flat instead of paying a context switch per frame.
const per = Math.ceil(total / WORKERS)
const blocks = []
for (let i = 0; i < WORKERS; i++) {
  const a = first + i * per
  const b = Math.min(last, a + per)
  if (a < b) blocks.push([a, b])
}

await Promise.all(
  blocks.map(([a, b], index) =>
    renderBlock({ a, b, index }).catch((err) => {
      failed = err
    }),
  ),
)

if (failed) {
  console.error('\nrender failed:', failed.message)
  process.exit(1)
}

console.log(`\nwrote ${total} frames to ${OUT} in ${((Date.now() - started) / 1000).toFixed(0)}s`)

// Release the preview server before returning.
//
// A listening socket is a live handle, and a live handle keeps Node's event loop
// alive. The frames were on disk and every browser was gone, but the process
// stayed up until something killed it — so a render that took one second looked
// like one that took five minutes, and callers that wait for the exit code
// waited for the timeout instead. Nothing else here holds a handle open.
await server.close()

async function renderBlock({ a, b, index }) {
  // Frames this block has had to re-do on a fresh browser. A WebGL context loss
  // is recoverable — the page is deterministic, so re-rendering the frame on a
  // new context gives the correct pixels. What is *not* recoverable is noticing
  // it late: a black frame is indistinguishable from a very dark one by looking
  // at it.
  const retries = new Map()
  const MAX_RETRIES = 3

  let browser = await launch({ width: 1920, height: 1080, port: BASE_PORT + index, gpu: GPU, extraArgs })
  try {
    // The query string carries the range, so the page builds only the chapters
    // that range can reach — see src/main.js.
    await navigate(browser.session, PAGE_URL)
    await waitReady(browser.session)
    const dimensions = await evalStr(browser.session, '[window.__film.renderWidth, window.__film.renderHeight]')
    if (dimensions[0] !== RENDER_WIDTH || dimensions[1] !== RENDER_HEIGHT) throw new Error(`采集分辨率不匹配：${dimensions}`)

    for (let f = a; f < b; f++) {
      if (failed) return
      const t = f / FPS
      const file = join(OUT, `f${String(f).padStart(6, '0')}.${ext}`)

      let dataURL = await evalStr(browser.session, captureExpr(t, FORMAT, QUALITY))
      let bytes = decodeDataURL(dataURL)

      // A lost context is silent: `toDataURL` returns a black image and no
      // exception is raised anywhere. So the frame is checked, and if it looks
      // wrong the browser is rebuilt and the frame re-rendered before it ever
      // reaches disk. This is the check whose absence produced 1800 identical
      // black frames in an earlier full render of this film, with exit code 0.
      const lost = await evalStr(browser.session, 'window.__contextLost === true').catch(() => false)
      const sceneRetries = fusionCapture ? await evalStr(browser.session, 'window.__captureFrameRetries || 0') : 0
      if (sceneRetries) console.warn(`\nframe ${f}: recovered transient blank 3D pass with ${sceneRetries} complete re-render(s)`)

      if (lost || (looksBlack(bytes, ext) && t < DURATION - 1.5)) {
        const n = (retries.get(f) ?? 0) + 1
        retries.set(f, n)
        if (n > MAX_RETRIES) {
          throw new Error(
            `frame ${f} (t=${t.toFixed(2)}s) still blank after ${MAX_RETRIES} retries` +
              (lost ? ' — context keeps being lost on this block' : ''),
          )
        }
        process.stdout.write(`\r  re-rendering frame ${f} (${lost ? 'context lost' : 'blank'}) …          \n`)

        // The cause is GPU memory exhaustion across the parallel browsers: the
        // kernel log fills with `NV_ERR_NO_MEMORY ... ctx_buf_pool.c:315` while
        // the run is going, and a reclaimed context never comes back. Rebuilding
        // this one browser while the others keep allocating does not free the
        // driver's pool — the first attempt at this fix failed on a *fresh*
        // context for exactly that reason. So the whole run cools down: every
        // worker stops before its next frame, this one tears its context down,
        // and nothing allocates until the pool has had time to be reclaimed.
        await browser.close()
        await sleep(RECOVERY_MS)

        browser = await launch({ width: 1920, height: 1080, port: BASE_PORT + index, gpu: GPU, extraArgs })
        await navigate(browser.session, PAGE_URL)
        await waitReady(browser.session)

        dataURL = await evalStr(browser.session, captureExpr(t, FORMAT, QUALITY))
        bytes = decodeDataURL(dataURL)
        if (looksBlack(bytes, ext)) {
          throw new Error(`frame ${f} (t=${t.toFixed(2)}s) rendered blank on a fresh context`)
        }
      }

      writeFileSync(file, bytes)

      // A chapter that throws returns frames — black ones — and the run still
      // "succeeds". The page records the error; surfacing it here is the
      // difference between a finished render and a fast way to make 14400 black
      // frames.
      const pageError = await evalStr(browser.session, 'window.__error || ""').catch(() => '')
      if (pageError) throw new Error(`chapter threw at t=${t.toFixed(2)}: ${pageError.split('\n')[0]}`)

      doneCount++
      if (doneCount % 25 === 0 || doneCount === total) {
        const eta = ((Date.now() - started) / doneCount) * (total - doneCount) / 1000
        process.stdout.write(
          `\r  ${doneCount}/${total}  ${((doneCount / total) * 100).toFixed(1)}%  eta ${eta.toFixed(0)}s   `,
        )
      }
    }
  } finally {
    await browser.close()
  }
}

/**
 * Is this frame a flat black image?
 *
 * A JPEG of a black 1920x1080 frame compresses to ~12.5 KB; a real frame of this
 * film — which is dark by design — is never under 60 KB, because the grain in
 * the grade pass is itself incompressible. The threshold sits far below any
 * legitimate frame and far above a blank one, so this cannot mistake a
 * deliberately dark shot for a failure.
 *
 * The size test is used rather than decoding the JPEG: at 14880 frames, a
 * decode per frame costs more than the render does.
 */
function looksBlack(bytes, ext) {
  if (ext === 'jpg' || ext === 'jpeg') return bytes.length < 24_000
  return false
}

async function navigate(session, url) {
  await session.send('Page.enable')
  await session.send('Runtime.enable')
  await session.send('Emulation.setDeviceMetricsOverride', {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false,
  })
  await session.send('Page.navigate', { url })
}

async function waitReady(session) {
  for (let i = 0; i < 900; i++) {
    const ready = await evalStr(session, 'window.__ready === true').catch(() => false)
    if (ready) return
    if (i === 200) {
      const why = await evalStr(session, 'window.__error || "no error reported"').catch(() => 'unknown')
      throw new Error(`page never became ready: ${why}`)
    }
    await sleep(100)
  }
  throw new Error('page never became ready (timeout)')
}

function fmt(sec) {
  const m = Math.floor(sec / 60)
  const s = sec - m * 60
  return `${m}:${s.toFixed(1).padStart(4, '0')}`
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function evalStr(session, expr) {
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
