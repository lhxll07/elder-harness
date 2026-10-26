// Live preview server.
//
//   node render/preview.mjs                 # http://127.0.0.1:8017/
//   node render/preview.mjs --port 9000 --open
//
// This drives the *same* `window.__renderAt(t)` the offline renderer calls — the
// page you watch here and the frames ffmpeg gets are produced by one function,
// so "it looked right in the preview" is a real statement about the master.
// The only difference is the clock: rAF here, a fixed list of timestamps there.
//
// The scrubber is the point. A film like this is authored as a pure function of
// t, so any instant is reachable, and a chapter that reads wrong at 0:47 is one
// drag away rather than a re-render.

import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { join, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CHAPTERS, DURATION } from '../src/timeline.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')

const args = parseArgs(process.argv.slice(2))
const PORT = Number(args.port ?? 8017)
const OPEN = args.open === true

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.ttc': 'font/collection',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost')

    if (url.pathname === '/__film.json') {
      const body = JSON.stringify({ duration: DURATION, chapters: CHAPTERS })
      res.writeHead(200, { 'Content-Type': MIME['.json'], 'Content-Length': Buffer.byteLength(body) })
      res.end(body)
      return
    }

    // The player chrome. Injected rather than kept in index.html so the file
    // the renderer loads stays exactly what gets rendered — no transport bar in
    // a data URL screenshot because someone forgot a query flag.
    if (url.pathname === '/__player.js') {
      const body = PLAYER
      res.writeHead(200, { 'Content-Type': MIME['.js'], 'Content-Length': Buffer.byteLength(body) })
      res.end(body)
      return
    }

    if (url.pathname === '/' && url.searchParams.has('player')) {
      const html = await readFile(join(ROOT, 'index.html'), 'utf8')
      const body = html.replace(
        '</body>',
        '  <script type="module" src="/__player.js"></script>\n</body>',
      )
      res.writeHead(200, { 'Content-Type': MIME['.html'], 'Content-Length': Buffer.byteLength(body) })
      res.end(body)
      return
    }

    let rel = decodeURIComponent(url.pathname)
    if (rel === '/') rel = '/index.html'

    const path = join(ROOT, rel.replace(/^(\.\.[/\\])+/, ''))
    if (!path.startsWith(ROOT)) {
      res.writeHead(403).end('forbidden')
      return
    }

    const body = await readFile(path)
    res.writeHead(200, {
      'Content-Type': MIME[extname(path).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': body.length,
      'Cache-Control': 'no-store',
    })
    res.end(body)
  } catch {
    res.writeHead(404).end('not found')
  }
})

await new Promise((r) => server.listen(PORT, '127.0.0.1', r))

const url = `http://127.0.0.1:${PORT}/?player=1`
console.log(`银龄智办 · 预览播放器\n  ${url}\n`)
console.log(`  ${CHAPTERS.length} 章 / ${DURATION}s`)
console.log('  空格 播放暂停 · ←/→ 逐帧 · ↑/↓ 跳章 · Home 回到开头 · R 重放当前秒\n')

if (OPEN) {
  const opener = process.platform === 'darwin' ? 'open' : 'xdg-open'
  spawn(opener, [url], { detached: true, stdio: 'ignore' }).unref()
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    server.close(() => process.exit(0))
  })
}

/**
 * The player. Runs inside the page, after `boot()` has published
 * `window.__film`, and never touches the render path — it only decides which
 * `t` to ask for and when to stop asking.
 */
const PLAYER = /* js */ `
const info = await waitForFilm()
const canvas = document.getElementById('view')

// The canvas is a fixed 1920x1080 render surface; the browser window is not.
// Scale it with CSS so the render never changes size with the window.
const fit = () => {
  const k = Math.min(window.innerWidth / 1920, (window.innerHeight - 64) / 1080)
  canvas.style.width = Math.round(1920 * k) + 'px'
  canvas.style.height = Math.round(1080 * k) + 'px'
}
fit()
addEventListener('resize', fit)

let t = 0
let playing = false
let rate = 1
let last = 0

const bar = document.createElement('div')
bar.style.cssText = [
  'position:fixed', 'left:0', 'right:0', 'bottom:0', 'height:64px',
  'background:#0b1014', 'border-top:1px solid #1d262d',
  'display:flex', 'align-items:center', 'gap:14px', 'padding:0 18px',
  'font:500 14px/1 "Noto Sans CJK SC",sans-serif', 'color:#9aa6ad',
  'z-index:50', 'user-select:none',
].join(';')

const play = document.createElement('button')
play.textContent = '▶'
play.style.cssText = 'width:40px;height:40px;border-radius:20px;border:0;background:#1a7f6b;color:#fff;font-size:16px;cursor:pointer'

const scrub = document.createElement('input')
scrub.type = 'range'
scrub.min = '0'
scrub.max = String(info.duration)
scrub.step = String(1 / 60)
scrub.value = '0'
scrub.style.cssText = 'flex:1;accent-color:#1a7f6b;cursor:pointer'

const clock = document.createElement('span')
clock.style.cssText = 'font-variant-numeric:tabular-nums;min-width:112px;text-align:right;color:#f2f4f5'

const label = document.createElement('span')
label.style.cssText = 'min-width:150px;color:#5c686f'

const rateSel = document.createElement('select')
for (const r of [0.25, 0.5, 1, 2]) {
  const o = document.createElement('option')
  o.value = String(r)
  o.textContent = r + '×'
  rateSel.append(o)
}
rateSel.value = '1'
rateSel.style.cssText = 'background:#141c22;color:#9aa6ad;border:1px solid #1d262d;border-radius:6px;padding:6px 8px'

bar.append(play, scrub, clock, label, rateSel)
document.body.append(bar)

function chapterAt(tt) {
  return info.shots.find((s) => tt >= s.start && tt < s.end) ?? info.shots[info.shots.length - 1]
}

function fmt(sec) {
  const m = Math.floor(sec / 60)
  const s = sec - m * 60
  return m + ':' + s.toFixed(1).padStart(4, '0')
}

function draw() {
  window.__renderAt(t)
  scrub.value = String(t)
  const ch = chapterAt(t)
  clock.textContent = fmt(t) + ' / ' + fmt(info.duration)
  label.textContent = ch.title
}

play.onclick = () => setPlaying(!playing)

function setPlaying(v) {
  playing = v
  play.textContent = v ? '❚❚' : '▶'
  if (v) {
    last = performance.now()
    requestAnimationFrame(tick)
  }
}

function tick(now) {
  if (!playing) return
  const dt = Math.min(0.25, (now - last) / 1000)
  last = now
  t += dt * rate
  if (t >= info.duration) {
    t = info.duration
    setPlaying(false)
  }
  draw()
  if (playing) requestAnimationFrame(tick)
}

scrub.oninput = () => {
  t = Number(scrub.value)
  setPlaying(false)
  draw()
}

addEventListener('keydown', (e) => {
  if (e.target === scrub) return
  const step = e.shiftKey ? 1.0 : 1 / 60
  if (e.code === 'Space') { e.preventDefault(); setPlaying(!playing) }
  else if (e.code === 'ArrowRight') { t = Math.min(info.duration, t + step); setPlaying(false); draw() }
  else if (e.code === 'ArrowLeft') { t = Math.max(0, t - step); setPlaying(false); draw() }
  else if (e.code === 'ArrowDown') { jump(1) }
  else if (e.code === 'ArrowUp') { jump(-1) }
  else if (e.code === 'Home') { t = 0; draw() }
  else if (e.key === 'r' || e.key === 'R') { t = Math.floor(t); draw() }
})

function jump(dir) {
  const ch = chapterAt(t)
  const i = info.shots.indexOf(ch)
  const next = info.shots[Math.max(0, Math.min(info.shots.length - 1, i + dir))]
  // Land 0.25s in so the chapter's entrance has begun and the frame is not the
  // blank first instant of a fade.
  t = next.start + 0.25
  setPlaying(false)
  draw()
}

// Warm every chapter's shaders once, in the background, so scrubbing into a
// chapter that has never been drawn does not stutter on first compile.
;(async () => {
  for (const s of info.shots) {
    window.__renderAt(s.start + 1.0)
    await new Promise((r) => setTimeout(r, 0))
  }
  draw()
})()

runFrames()

/**
 * `?frames=1` renders a fixed sample of timestamps and reports how long each
 * took, which is the only way to compare a change's cost against its look
 * without running the whole film.
 */
async function runFrames() {
  if (!new URLSearchParams(location.search).has('frames')) return
  const at = (new URLSearchParams(location.search).get('frames') || '')
    .split(',')
    .filter(Boolean)
    .map(Number)
  const points = at.length ? at : info.shots.map((s) => (s.start + s.end) / 2)
  const results = []
  for (const p of points) {
    const t0 = performance.now()
    window.__renderAt(p)
    results.push({ t: p, ms: Math.round(performance.now() - t0) })
  }
  console.table(results)
  window.__frames = results
}

async function waitForFilm() {
  for (let i = 0; i < 1800; i++) {
    if (window.__film) return window.__film
    if (window.__error) throw new Error(window.__error)
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error('page never published window.__film')
}
`

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
