import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { launch } from './cdp.mjs'
import { serve } from './serve.mjs'
import { captureExpr, decodeDataURL } from './capture.mjs'
import { DURATION, VERSION, fromMemoryTime } from '../src/fusion-script.js'
import { fromEditTime } from '../src/fusion-edit.js'
import { SCENOGRAPHY } from '../src/fusion-scenery.js'

const directory = resolve(process.argv[2] ?? `tmp/fusion-v${String(VERSION).padStart(2, '0')}-check`)
const reuseFrom = process.argv[3]
if (reuseFrom && !/^fusion-v\d+$/.test(reuseFrom)) throw new Error('复用版本必须为 fusion-v数字')
const reuseUntil = Number(process.argv[4] ?? 0)
const reuseAfter = Number(process.argv[5] ?? DURATION)
const reuseTailFrom = Number(process.argv[6] ?? reuseAfter)
const renderScale = Number(process.env.RENDER_SCALE ?? 1)
const sampleTime = time => Math.round(fromEditTime(fromMemoryTime(time)) * 60) / 60
mkdirSync(directory, { recursive: true })
const server = await serve()
const browser = await launch({ width: 1920 * renderScale, height: 1080 * renderScale, port: 9789, extraArgs: ['--disable-accelerated-2d-canvas'] })
const session = browser.session
const evaluate = async expression => {
  const result = await session.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
  return result.result.value
}
try {
  await session.send('Page.enable')
  await session.send('Runtime.enable')
  await session.send('Page.navigate', { url: `${server.origin}/fusion.html?offline=1&renderScale=${renderScale}` })
  let ready = false
  for (let attempt = 0; attempt < 600; attempt++) {
    const error = await evaluate('window.__error || ""')
    if (error) throw new Error(error)
    ready = await evaluate('window.__ready === true')
    if (ready) break
    await new Promise(resolveWait => setTimeout(resolveWait, 100))
  }
  if (!ready) throw new Error('装载超时')
  const samples = [...new Set([
    ...SCENOGRAPHY.flatMap(section => [section.start, section.start + 0.1, Math.round((section.start + section.end) * 30) / 60, ...(section.start ? [section.start - 0.1] : [])]),
    ...[8.8, 13.5, 30.5, 38.5, 41.5, 42, 45, 50, 71.5, 83.5, 89.5, 93.5, 108.5, 115, 122, 129, 133.5, 134.98, 135, 137.5, 140, 140.6, 142.7, 144, 145.5, 147.5, 149.8, 151.5, 152.8, 154.4, 157.3, 159.5, 160.1, 161.5, 163.8, 164.5, 166.2, 167, 168.2, 169.5, 172.8, 175.5, 176, 176.8, 177.8, 178.9, 180, 180.3, 181.3, 182.7, 183.98, 184, 187.5, 191].map(sampleTime),
    14, 15.5, 16, 16.5, 17.5, 18.5, 22.5, 23, 23.5, 24, 34.5, 35, 35.5, 36, 53, 54, 55, 56, 56.98, 57, 57.25, 57.5, 58.2, 59.7, 61.3, 63, 64.3, 65.2, 65.98, 66, 67, 68.2, 69.3, 70.5, 71.5, 72.5, 73.5, 74.5, 74.75, 74.98, 75, 75.02, 93.98, 94, 95.5, 97.3, 99.5, 101.5, 101.98, 102,
    126.98, 126 + 59 / 60, 127, 128.5, 130, 132, 134.6, 135.98, 135 + 59 / 60, 136, 158.98, 159, 160.7, 162.5, 164.6, 166.4, 168, 169.98, 170,
    14.5, 15, 16.8, 20, 20.5, 21, 21.5, 36.5, 37, 75.5, 76.5, 78, 80, 82, 84, 102.5, 103.5, 104.5, 105.5, 106.5, 108, 114.5, 116, 118, 120, 122, 124, 125.5, 179, 180, 181, 182, 184, 185, 187, 190, 193, 195.5,
  ])].sort((before, after) => before - after)
  const hashes = new Map()
  for (const time of samples) {
    const bytes = decodeDataURL(await evaluate(captureExpr(time, 'jpeg', 96)))
    writeFileSync(join(directory, `${String(time).replace('.', '-')}.jpg`), bytes)
    hashes.set(time, createHash('sha256').update(bytes).digest('hex'))
    console.log(`构图检查 ${time.toFixed(2)}s`)
  }
  const determinism = []
  for (const time of [...SCENOGRAPHY.map(section => Math.round((section.start + section.end) * 30) / 60), ...[172.8, 93.5, 8.8, 108.5, 42, 140, 30.5, 50, 154.4, 187.5, 180.3, 45, 134.98, 184, 191, 164.5, 145.5, 176.8, 181.3].map(sampleTime), 22.5, 35, 35.5, 58.2, 63, 65.2, 67, 69.3, 71.5, 73.5, 74.98, 97.3, 99.5, 128.5, 134.6, 162.5, 168]) {
    const bytes = decodeDataURL(await evaluate(captureExpr(time, 'jpeg', 96)))
    const identical = createHash('sha256').update(bytes).digest('hex') === hashes.get(time)
    let difference = { mean: 0, maximum: 0, changedFraction: 0 }
    if (!identical) {
      const name = `${String(time).replace('.', '-')}.jpg`
      const repeated = join(directory, `repeat-${name}`)
      writeFileSync(repeated, bytes)
      difference = JSON.parse(execFileSync('python3', ['-c', `
import json, sys
import numpy as np
from PIL import Image
before = np.asarray(Image.open(sys.argv[1]).convert('RGB'), dtype=np.int16)
after = np.asarray(Image.open(sys.argv[2]).convert('RGB'), dtype=np.int16)
difference = np.abs(before - after)
print(json.dumps({'mean': float(difference.mean()), 'maximum': int(difference.max()), 'changedFraction': float(np.any(difference > 0, axis=2).mean())}))
`, join(directory, name), repeated], { encoding: 'utf8' }))
    }
    determinism.push({ time, identical, difference, passed: identical || difference.mean < 0.00001 && difference.maximum <= 1 && difference.changedFraction < 0.00001 })
  }
  const state = await evaluate(`(() => {
    const failures = [];
    for (let frame = 0; frame < ${DURATION * 60}; frame += 30) {
      window.__setSceneAt(frame / 60);
      window.__stage.scene.updateMatrixWorld(true);
      window.__stage.scene.traverse(object => {
        if (!object.matrixWorld.elements.every(Number.isFinite)) failures.push({ frame, name: object.name });
      });
    }
    return { failureCount: failures.length, failures: failures.slice(0, 20), error: window.__error || '' };
  })()`)
  const reused = []
  if (reuseFrom) {
    const referenceHTML = readFileSync(resolve('out', 'review', reuseFrom, 'fusion.html'), 'utf8').replace("'./src/fusion-film.js'", `'/out/review/${reuseFrom}/source/fusion-film.js'`)
    await session.send('Page.navigate', { url: `${server.origin}/__fusion-reference.html?offline=1&renderScale=1` })
    for (let attempt = 0; attempt < 100; attempt++) {
      const navigated = await evaluate('location.pathname === "/__fusion-reference.html" && document.readyState === "complete"').catch(() => false)
      if (navigated) break
      await new Promise(resolveWait => setTimeout(resolveWait, 50))
    }
    await evaluate(`document.open(); document.write(${JSON.stringify(referenceHTML)}); document.close(); true`)
    let referenceReady = false
    for (let attempt = 0; attempt < 600; attempt++) {
      const error = await evaluate('window.__error || ""')
      if (error) throw new Error(error)
      referenceReady = await evaluate('window.__ready === true')
      if (referenceReady) break
      await new Promise(resolveWait => setTimeout(resolveWait, 100))
    }
    if (!referenceReady) throw new Error('同光栅配置基线装载超时')
    for (const time of [8.8, 13.5, 30.5, 38.5, 41.5, 42, 50, 71.5, 83.5, 89.5, 93.5, 108.5, 115, 122, 129, 133.5, 187.5, 191].map(sampleTime).filter(value => value < reuseUntil || value >= reuseAfter)) {
      const sourceTime = time >= reuseAfter ? time + reuseTailFrom - reuseAfter : time
      const reference = join(directory, `baseline-${String(time).replace('.', '-')}.jpg`)
      writeFileSync(reference, decodeDataURL(await evaluate(captureExpr(sourceTime, 'jpeg', 96))))
      const current = join(directory, `${String(time).replace('.', '-')}.jpg`)
      const difference = JSON.parse(execFileSync('python3', ['-c', `
import json, sys
import numpy as np
from PIL import Image
before = np.asarray(Image.open(sys.argv[1]).convert('RGB'), dtype=np.int16)
after = np.asarray(Image.open(sys.argv[2]).convert('RGB'), dtype=np.int16)
difference = np.abs(before - after)
print(json.dumps({'mean': float(difference.mean()), 'maximum': int(difference.max()), 'changedFraction': float(np.any(difference > 0, axis=2).mean())}))
`, reference, current], { encoding: 'utf8' }))
      reused.push({ time, sourceTime, referenceSource: `${reuseFrom}/source`, referenceRasterization: 'accelerated-2d-canvas disabled; same as current source', difference, passed: difference.mean < 0.001 && difference.maximum <= 16 && difference.changedFraction < 0.001 })
    }
  }
  const report = { ...state, samples, determinism, reused, rasterization: '禁用加速 2D Canvas，WebGL 仍使用 ANGLE/EGL；消除动态中文纹理的字形缓存污染。', reuseTolerance: '当前源与旧版冻结源在相同 Canvas 光栅配置下对照：通道均差 < 0.001/255，最大差 ≤ 16，变化像素 < 0.1%；同一进程乱序确定性仍使用更严格标准。交付的未修改帧硬链接自旧版，不以新光栅配置重渲染。', entry: 'fusion.html', render: [1920, 1080] }
  report.render = [1920 * renderScale, 1080 * renderScale]
  report.renderScale = renderScale
  writeFileSync(join(directory, 'check.json'), JSON.stringify(report, null, 2) + '\n')
  if (state.failureCount || state.error || determinism.some(check => !check.passed) || reused.some(check => !check.passed)) throw new Error('画面状态、确定性或复用检查失败')
  console.log(JSON.stringify(report, null, 2))
} finally {
  await browser.close()
  await server.close()
}
