import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { launch } from './cdp.mjs'
import { serve } from './serve.mjs'
import { captureExpr, decodeDataURL } from './capture.mjs'

const directory = resolve(process.argv[2] ?? 'video/tmp/quality-v19-check')
const scale = Number(process.env.RENDER_SCALE ?? 1)
const times = process.env.QUALITY_TIMES ? process.env.QUALITY_TIMES.split(',').map(Number) : [
  4, 8.8, 13.5, 14.9, 15.8, 16, 16.2, 20, 29, 35.5, 39.4, 41.5, 45, 52.5, 55.5,
  56.25, 57.5, 61.3, 65.1, 68.2, 74.98, 75.02, 78, 81.5, 84.9, 89.5, 98.4, 105.5,
  108, 112.5, 116.3, 121.15, 123.18, 126.98, 127.02, 131, 136.02, 140.5, 146.3, 153.5,
  158.98, 159.02, 163.95, 168, 172.4, 176.5, 179, 183.5, 188.5, 191.5, 195.5,
]
mkdirSync(directory, { recursive: true })
const server = await serve()
const browser = await launch({ width: 1920, height: 1080, port: 9819, extraArgs: ['--disable-accelerated-2d-canvas'] })
const session = browser.session
const evaluate = async expression => {
  const response = await session.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text)
  return response.result.value
}
try {
  await session.send('Page.enable')
  await session.send('Runtime.enable')
  await session.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
  await session.send('Page.navigate', { url: `${server.origin}/quality/v19/index.html?offline=1&renderScale=${scale}` })
  let ready = false
  for (let attempt = 0; attempt < 1200; attempt++) {
    const error = await evaluate('window.__error || ""')
    if (error) throw new Error(error)
    ready = await evaluate('window.__ready === true')
    if (ready) break
    await new Promise(resolveWait => setTimeout(resolveWait, 100))
  }
  if (!ready) throw new Error('Quality scene did not finish loading')
  const hashes = new Map()
  const results = []
  for (const time of times) {
    const started = performance.now()
    const image = decodeDataURL(await evaluate(captureExpr(time, 'jpeg', 96)))
    const name = `t-${String(Math.round(time * 60)).padStart(6, '0')}.jpg`
    writeFileSync(join(directory, name), image)
    hashes.set(time, createHash('sha256').update(image).digest('hex'))
    results.push({ time, frame: Math.round(time * 60), file: name, bytes: image.length, seconds: (performance.now() - started) / 1000 })
    const error = await evaluate('window.__error || ""')
    if (error) throw new Error(error)
    console.log(`Quality ${time.toFixed(2)}s · ${image.length} bytes`)
  }
  const repeats = []
  for (const time of [183.5, 55.5, 121.15, 81.5, 16, 172.4].filter(time => times.includes(time))) {
    const image = decodeDataURL(await evaluate(captureExpr(time, 'jpeg', 96)))
    const identical = createHash('sha256').update(image).digest('hex') === hashes.get(time)
    writeFileSync(join(directory, `repeat-${Math.round(time * 60)}.jpg`), image)
    repeats.push({ time, identical })
  }
  const renderer = await evaluate(`(() => {const renderer=window.__stage.renderer; const gl=renderer.getContext(); const ext=gl.getExtension('WEBGL_debug_renderer_info'); return {render:[renderer.domElement.width,renderer.domElement.height],device:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),textures:renderer.info.memory.textures,geometries:renderer.info.memory.geometries};})()`)
  const report = { passed: repeats.every(entry => entry.identical), samples: results, repeats, renderer, automatically_played: false, review_page_opened: false }
  writeFileSync(join(directory, 'check.json'), JSON.stringify(report, null, 2) + '\n')
  if (!report.passed) throw new Error('Out-of-order capture changed pixels; inspect repeat frames')
  console.log(JSON.stringify({ passed: true, samples: results.length, renderer }))
} finally {
  await browser.close()
  await server.close()
}
