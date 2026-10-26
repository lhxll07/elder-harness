// Minimal Chrome DevTools Protocol client.
//
// Chromium rather than puppeteer/playwright: the only things needed here are
// "open page, evaluate expression, screenshot", and a pinned browser
// dependency is one more thing that can fail to install on a render box.

import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** Snapshot builds ship Chromium under different names per channel. */
const BIN_NAMES = ['chrome', 'chromium', 'chrome-headless-shell', 'headless_shell']

/**
 * Where a Chromium might be. Order: explicit override, system paths, then the
 * puppeteer/playwright caches — a render box with a browser in its cache and
 * nothing in /usr/bin is the common case.
 */
function findChrome() {
  const explicit = [process.env.CHROME_PATH, process.env.CHROMIUM_PATH].filter(Boolean)
  const system = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/snap/bin/chromium',
  ]
  for (const p of [...explicit, ...system]) {
    if (existsSync(p)) return p
  }

  const home = process.env.HOME ?? ''
  const caches = [
    join(home, '.cache/puppeteer'),
    join(home, '.cache/ms-playwright'),
    join(home, '.cache/chromium'),
  ]
  for (const root of caches) {
    if (!existsSync(root)) continue
    for (const dir of readdirSync(root)) {
      const base = join(root, dir)
      for (const name of BIN_NAMES) {
        const direct = join(base, name)
        if (existsSync(direct)) return direct
      }
      // Some layouts nest one level further: chrome-linux64/chrome
      for (const inner of readdirSync(base).slice(0, 12)) {
        for (const name of BIN_NAMES) {
          const nested = join(base, inner, name)
          if (existsSync(nested)) return nested
        }
      }
    }
  }
  return null
}

/**
 * GL backend flag sets, by name.
 *
 * Chromium chooses its backend silently, and on a headless Linux box the choice
 * is usually SwiftShader — a CPU rasteriser that turns this film's bloom and
 * bokeh passes into roughly a second of work per frame. Naming the backends and
 * letting the caller pick is the difference between a 35-minute render and a
 * 3-minute one, and `gpuprobe.mjs` measures which is which on this machine
 * rather than assuming.
 */
export const GPU_MODES = {
  /** Whatever Chromium picks, software permitted. */
  auto: ['--enable-unsafe-swiftshader', '--enable-features=Vulkan,UseSkiaRenderer'],
  /** CPU rasteriser, explicitly. Correct everywhere; the slow floor. */
  swiftshader: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  /**
   * Integrated GPU through ANGLE's EGL backend.
   *
   * This is the default on a box that has one, and the reason is stability
   * rather than speed. An iGPU draws from system memory, so it has no fixed VRAM
   * pool to exhaust: on this machine the discrete card produced 2289 identical
   * black frames across three workers — the kernel log filling with
   * `NV_ERR_NO_MEMORY ... ctx_buf_pool.c:315` while the run was going — and the
   * integrated one rendered the same region with zero failures at 56 frames/s
   * across 8 workers. Frames from the two are byte-for-byte near-identical, so
   * nothing about the image is being traded for this.
   */
  'angle-egl': [
    '--use-gl=angle',
    '--use-angle=gl-egl',
    '--ignore-gpu-blocklist',
    '--enable-gpu-rasterization',
  ],
  /** Discrete GPU through ANGLE's Vulkan backend. Faster, but see above. */
  'angle-vulkan': [
    '--use-gl=angle',
    '--use-angle=vulkan',
    '--ignore-gpu-blocklist',
    '--enable-gpu-rasterization',
  ],
}

export const DEFAULT_GPU = 'angle-egl'

function fail(msg) {
  throw new Error(msg)
}

export async function launch({ width, height, port, headless = true, gpu = DEFAULT_GPU, extraArgs = [] }) {
  const profile = mkdtempSync(join(tmpdir(), 'yinling-chrome-'))
  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-sync',
    '--disable-translate',
    '--mute-audio',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--force-color-profile=srgb',
    ...(GPU_MODES[gpu] ?? fail(`unknown gpu mode "${gpu}"; known: ${Object.keys(GPU_MODES).join(', ')}`)),
    `--window-size=${width},${height}`,
    '--allow-insecure-localhost',
    ...extraArgs,
  ]
  if (headless) args.push('--headless=new')
  args.push('about:blank')

  const bin = findChrome()
  if (!bin) throw new Error('no chromium found; set CHROME_PATH to a chrome/chromium binary')

  const proc = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] })
  let stderr = ''
  proc.stderr.on('data', (d) => (stderr += d))

  const wsUrl = await waitForTarget(port, () => stderr)
  const session = await connect(wsUrl)

  return {
    session,
    async close() {
      try {
        session.close()
      } catch {}
      proc.kill('SIGKILL')
      try {
        rmSync(profile, { recursive: true, force: true })
      } catch {}
    },
  }
}

async function waitForTarget(port, getStderr) {
  const deadline = Date.now() + 30_000
  let lastErr = null
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`)
      const tabs = await res.json()
      const page = tabs.find((t) => t.type === 'page')
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl
    } catch (e) {
      lastErr = e
    }
    await new Promise((r) => setTimeout(r, 120))
  }
  throw new Error(`chromium never opened a debuggable page: ${lastErr}\n${getStderr()}`)
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url)
    const pending = new Map()
    let nextId = 1

    ws.addEventListener('open', () =>
      resolve({
        send(method, params = {}) {
          const id = nextId++
          return new Promise((res, rej) => {
            pending.set(id, { res, rej, method })
            ws.send(JSON.stringify({ id, method, params }))
          })
        },
        close() {
          try {
            ws.close()
          } catch {}
        },
      }),
    )
    ws.addEventListener('error', reject)
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data)
      if (msg.id && pending.has(msg.id)) {
        const { res, rej, method } = pending.get(msg.id)
        pending.delete(msg.id)
        if (msg.error) rej(new Error(`${method}: ${msg.error.message}`))
        else res(msg.result)
      }
    })
  })
}
