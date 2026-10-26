import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { launch } from './cdp.mjs'
import { serve } from './serve.mjs'
import { captureExpr, decodeDataURL } from './capture.mjs'
import { DURATION } from '../src/compiler-script.js'

const directory = resolve(process.argv[2] ?? 'tmp/compiler-qa')
mkdirSync(directory, { recursive: true })
const server = await serve()
const browser = await launch({ width: 1920, height: 1080, port: 9787 })
const session = browser.session
const evaluate = async expression => {
  const result = await session.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
  return result.result.value
}
try {
  await session.send('Page.enable')
  await session.send('Runtime.enable')
  await session.send('Page.navigate', { url: `${server.origin}/compiler.html?offline=1&renderScale=1` })
  let ready = false
  for (let attempt = 0; attempt < 600; attempt++) {
    const error = await evaluate('window.__error || ""')
    if (error) throw new Error(error)
    ready = await evaluate('window.__ready === true')
    if (ready) break
    await new Promise(resolveWait => setTimeout(resolveWait, 100))
  }
  if (!ready) throw new Error('装载超时')
  const times = [1.2, 7.5, 21, 35.5, 38, 47.5, 52, 60.5, 70.5, 74.2, 75, 76.4, 78.0, 79.4, 80.7, 82.2, 83.7, 85.0, 86.3, 87.5, 89.0, 90.8, 92.5, 94.3, 96.2, 100.0]
  const hashes = new Map()
  for (const time of times) {
    const bytes = decodeDataURL(await evaluate(captureExpr(time, 'jpeg', 95)))
    writeFileSync(join(directory, `${String(time).replace('.', '-')}.jpg`), bytes)
    hashes.set(time, createHash('sha256').update(bytes).digest('hex'))
    console.log(`构图检查 ${time.toFixed(2)}s`)
  }
  const determinism = []
  for (const time of [100.0, 21, 92.5, 70.5, 83.7, 35.5, 78.0, 47.5, 89.0]) {
    const bytes = decodeDataURL(await evaluate(captureExpr(time, 'jpeg', 95)))
    determinism.push({ time, passed: createHash('sha256').update(bytes).digest('hex') === hashes.get(time) })
  }
  const prefix = []
  const baseline = resolve('out/review/compiler-v01/frames')
  if (existsSync(baseline)) {
    for (const frame of [72, 1260, 2280, 3120, 4230, 4499]) {
      const bytes = decodeDataURL(await evaluate(captureExpr(frame / 60, 'jpeg', 96)))
      writeFileSync(join(directory, `prefix-${frame}.jpg`), bytes)
      const previousPath = join(baseline, `f${String(frame).padStart(6, '0')}.jpg`)
      const previous = readFileSync(previousPath)
      const identical = bytes.equals(previous)
      const difference = identical ? { mean: 0, changedFraction: 0 } : JSON.parse(execFileSync('python3', ['-c', `
import json, sys
import numpy as np
from PIL import Image
previous = np.asarray(Image.open(sys.argv[1]).convert('RGB'), dtype=np.float64)
current = np.asarray(Image.open(sys.argv[2]).convert('RGB'), dtype=np.float64)
difference = np.abs(previous - current)
print(json.dumps({'mean': float(difference.mean()), 'changedFraction': float(np.mean(np.any(difference > 0, axis=2)))}))
`, previousPath, join(directory, `prefix-${frame}.jpg`)], { encoding: 'utf8' }))
      prefix.push({ frame, time: frame / 60, identical, difference, passed: difference.mean < 0.001 && difference.changedFraction < 0.0002 })
    }
  }
  const state = await evaluate(`(() => {
    const failures = [];
    for (let frame = 0; frame < ${DURATION * 60}; frame += 10) {
      window.__compiler.update(frame / 60);
      window.__stage.scene.updateMatrixWorld(true);
      window.__stage.scene.traverse(object => {
        if (object.visible && !object.matrixWorld.elements.every(Number.isFinite)) failures.push({ frame, name: object.name });
      });
    }
    return { checkedFrames: ${DURATION * 6}, failureCount: failures.length, failures: failures.slice(0, 20), error: window.__error || '' };
  })()`)
  const report = { ...state, determinism, prefix, samples: times, entry: 'compiler.html', render: [1920, 1080] }
  writeFileSync(join(directory, 'check.json'), JSON.stringify(report, null, 2) + '\n')
  if (state.failures.length || state.error || determinism.some(check => !check.passed) || prefix.some(check => !check.passed) || prefix.length && !prefix.at(-1).identical) throw new Error('画面状态、确定性或复用片段一致性检查失败')
  console.log(JSON.stringify(report, null, 2))
} finally {
  await browser.close()
  await server.close()
}
