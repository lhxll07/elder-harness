// Smoke test and contact sheet.
//
// Renders a handful of timestamps, reports how long each took, and writes them
// as one image so a change in the film's look can be judged at a glance rather
// than by opening ten PNGs.
//
//   node render/ping.mjs                     # default sample points
//   node render/ping.mjs --at 8,20,92        # specific seconds
//   node render/ping.mjs --full              # render at 1920x1080
//   node render/ping.mjs --tile              # emit the contact sheet too

import { launch, DEFAULT_GPU } from './cdp.mjs'
import { serve } from './serve.mjs'
import { captureExpr, decodeDataURL } from './capture.mjs'
import { mkdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')

const args = parseArgs(process.argv.slice(2))
const W = args.full ? 1920 : 960
const H = args.full ? 1080 : 540
const OUT = join(ROOT, 'out/ping')
mkdirSync(OUT, { recursive: true })

const server = await serve()
const browser = await launch({
  width: 1920,
  height: 1080,
  port: 9333,
  gpu: String(args.gpu ?? DEFAULT_GPU),
})

let failures = 0
try {
  await browser.session.send('Page.enable')
  await browser.session.send('Runtime.enable')
  await browser.session.send('Emulation.setDeviceMetricsOverride', {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false,
  })
  const url = server.origin + '/index.html'
  await browser.session.send('Page.navigate', { url })

  let ready = false
  for (let i = 0; i < 900 && !ready; i++) {
    ready = await ev(browser.session, 'window.__ready === true').catch(() => false)
    if (!ready) await sleep(100)
  }
  if (!ready) {
    const why = await ev(browser.session, 'window.__error || "unknown"').catch(() => 'unknown')
    throw new Error(`page never became ready: ${why}`)
  }

  const info = JSON.parse(await ev(browser.session, 'JSON.stringify(window.__film)'))
  console.log(`film: ${info.title}  ${info.duration}s  ${info.shots.length} chapters`)
  console.log(info.shots.map((s) => `  ${s.name.padEnd(10)} ${s.start}s–${s.end}s`).join('\n'))

  const points = args.at
    ? String(args.at).split(',').map(Number)
    : info.shots.map((s) => Number(((s.start + s.end) / 2 - 0.6).toFixed(2)))

  console.log(`\nrendering ${points.length} sample frames at ${W}x${H}`)
  const written = []
  for (const t of points) {
    const t0 = Date.now()
    const dataURL = await ev(browser.session, captureExpr(t, 'png', 100))
    const ms = Date.now() - t0
    const file = join(OUT, `t${String(Math.round(t * 10)).padStart(5, '0')}.png`)
    writeFileSync(file, decodeDataURL(dataURL))
    written.push(file)

    const err = await ev(browser.session, 'window.__error || ""').catch(() => '')
    if (err) {
      failures++
      console.log(`  t=${t.toFixed(1)}s  FAILED  ${err.split('\n')[0]}`)
    } else {
      console.log(`  t=${t.toFixed(1)}s  ${String(ms).padStart(5)}ms  ${file.replace(ROOT + '/', '')}`)
    }
  }

  if (args.tile && written.length) {
    const sheet = join(ROOT, 'out/ping/contact-sheet.jpg')
    const cols = Math.min(4, written.length)
    const rows = Math.ceil(written.length / cols)
    const r = spawnSync('ffmpeg', [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-i', join(OUT, 't%05d.png'),
      '-filter_complex', `scale=${W}:${H},tile=${cols}x${rows}`,
      sheet,
    ], { stdio: 'inherit' })
    if (r.status === 0) console.log(`\ncontact sheet: ${sheet.replace(ROOT + '/', '')}`)
  }
} finally {
  await browser.close()
  await server.close()
}

process.exit(failures ? 1 : 0)

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
