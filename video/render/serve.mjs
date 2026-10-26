// Static server for the film's own directory tree.
//
// One origin for everything: the page, three.module.js, the fonts and the
// generated glyph atlases. Anything fetched cross-origin would need CORS
// headers on a file:// page, which headless Chromium refuses for module
// scripts — so the film is served, never opened as a file.

import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, normalize, extname, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')

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
}

export async function serve() {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost')
      let rel = decodeURIComponent(url.pathname)
      if (rel === '/' || rel === '') rel = '/index.html'

      // normalize() collapses any ../ before it can escape ROOT.
      const path = join(ROOT, normalize(rel).replace(/^(\.\.[/\\])+/, ''))
      if (!path.startsWith(ROOT)) {
        res.writeHead(403).end('forbidden')
        return
      }

      const info = await stat(path)
      if (info.isDirectory()) {
        res.writeHead(404).end('not found')
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

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()

  return {
    origin: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  }
}
