import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeTouchHand } from '../src/touch-hand.js'
import { makePhone, PHONE, PHONE_Z } from '../src/props.js'
import { phoneShell } from '../src/device-detail.js'
import { launch } from './cdp.mjs'
import { serve } from './serve.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const hand = makeTouchHand()
let handVertices = 0
hand.traverse((object) => {
  if (!object.geometry) return
  assert.equal(object.geometry.getAttribute('position').count, object.geometry.getAttribute('normal').count)
  for (const attribute of Object.values(object.geometry.attributes)) assert([...attribute.array].every(Number.isFinite), '模型属性必须为有限值')
  handVertices += object.geometry.getAttribute('position').count
})
const shell = phoneShell(PHONE.w, PHONE.h, PHONE.d, PHONE.r)
assert(Math.abs(shell.boundingBox.max.z - PHONE.d / 2) < 1e-7)
assert(Math.abs(shell.boundingBox.min.z + PHONE.d / 2) < 1e-7)
assert(PHONE_Z.glass > PHONE_Z.screen && PHONE_Z.screen > PHONE_Z.maskEdge && PHONE_Z.maskEdge > PHONE_Z.bodyFront)
assert.equal(makePhone().userData.screen.position.z, PHONE_Z.screen)

const server = await serve()
const browser = await launch({ width: 1920, height: 1080, port: 9445, gpu: 'angle-vulkan' })
async function evaluate(expression) {
  const response = await browser.session.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails))
  return response.result.value
}
try {
  await browser.session.send('Page.enable')
  await browser.session.send('Runtime.enable')
  await browser.session.send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__pageOverflows = []
    const originalFillText = CanvasRenderingContext2D.prototype.fillText
    CanvasRenderingContext2D.prototype.fillText = function(content, horizontal, vertical, maximum) {
      if (this.canvas.width === 1620 && this.canvas.height === 3603) {
        const metrics = this.measureText(content)
        const shrink = maximum && maximum < metrics.width ? maximum / metrics.width : 1
        const transform = this.getTransform()
        const left = new DOMPoint(horizontal - metrics.actualBoundingBoxLeft * shrink, vertical - metrics.actualBoundingBoxAscent).matrixTransform(transform)
        const right = new DOMPoint(horizontal + metrics.actualBoundingBoxRight * shrink, vertical + metrics.actualBoundingBoxDescent).matrixTransform(transform)
        if (left.x < -1 || right.x > this.canvas.width + 1 || left.y < -1 || right.y > this.canvas.height + 1) window.__pageOverflows.push({content,left:{x:left.x,y:left.y},right:{x:right.x,y:right.y}})
      }
      return maximum === undefined ? originalFillText.call(this, content, horizontal, vertical) : originalFillText.call(this, content, horizontal, vertical, maximum)
    }
  ` })
  await browser.session.send('Page.navigate', { url: `${server.origin}/index.html?offline=1&renderScale=2` })
  let ready = false
  for (let attempt = 0; attempt < 600 && !ready; attempt++) {
    ready = await evaluate('window.__ready === true')
    const error = await evaluate('window.__error || ""')
    if (error) throw new Error(error)
    if (!ready) await new Promise((resolve) => setTimeout(resolve, 100))
  }
  assert(ready, '场景启动超时')
  const pages = await evaluate(`(async () => {
    const { hospitalPage } = await import('/src/shots/voice.js')
    const { journeyPage } = await import('/src/shots/journey-ui.js')
    const { crop } = await import('/src/shots/cinema-props.js')
    const { canvasSurface, fade } = await import('/src/shots/mechanism-geometry.js')
    const { SCREEN_W, SCREEN_H } = await import('/src/screen.js')
    const canvases = [hospitalPage(), hospitalPage(true), ...['doctors','dates','review','waiting','result'].map(journeyPage)]
    const source = canvases[0]
    const first = canvasSurface(source, 1, 2)
    const second = canvasSurface(source, 1, 2)
    fade(first, 0.25)
    fade(second, 1)
    const section = crop(source, 60, 1150, 960, 880)
    const expectedPixel = source.getContext('2d').getImageData(150, 1800, 1, 1).data
    const actualPixel = section.getContext('2d').getImageData(60, 75, 1, 1).data
    const phoneMaps = []
    window.__stage.world.traverse(object => { if (object.userData.screenMat?.map) phoneMaps.push(object.userData.screenMat.map.generateMipmaps) })
    return {
      dimensions:canvases.map(canvas => [canvas.width,canvas.height]),
      distinctPages:new Set(canvases).size === canvases.length,
      cachedPages:hospitalPage() === source && journeyPage('review') === canvases[4],
      sourceUnchanged:journeyPage('departments') === canvases[1],
      sharedStaticTexture:first.material.map === second.material.map,
      independentOpacity:first.material.opacity === 0.25 && second.material.opacity === 1,
      cropDimensions:[section.width,section.height],
      cropCoordinates:expectedPixel.every((value,index) => value === actualPixel[index]),
      dynamicPhoneTexturesUnchanged:phoneMaps.length > 0 && phoneMaps.every(value => !value),
      uiExcludedFromBloom:window.__stage.bloom.threshold > 1,
      pageTextOverflows:window.__pageOverflows,
      logicalDimensions:[SCREEN_W,SCREEN_H]
    }
  })()`)
  assert(pages.dimensions.every(([width, height]) => width === 1620 && height === 3603))
  assert.deepEqual(pages.cropDimensions, [1440, 1320])
  for (const key of ['distinctPages', 'cachedPages', 'sourceUnchanged', 'sharedStaticTexture', 'independentOpacity', 'cropCoordinates', 'dynamicPhoneTexturesUnchanged', 'uiExcludedFromBloom']) assert(pages[key], key)
  assert.deepEqual(pages.pageTextOverflows, [])
  const report = { passed: true, geometryFinite: true, handVertices, phoneDepthLayers: true, ...pages }
  mkdirSync(join(root, 'tmp'), { recursive: true })
  writeFileSync(join(root, 'tmp/polish-check.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report, null, 2))
} finally {
  await browser.close()
  await server.close()
}
