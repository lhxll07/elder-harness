import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch } from './cdp.mjs'
import { serve } from './serve.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const server = await serve()
const browser = await launch({ width: 1920, height: 1080, port: 9441, gpu: 'angle-vulkan' })
async function evaluate(expression) {
  const response = await browser.session.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails))
  return response.result.value
}
try {
  await browser.session.send('Page.enable')
  await browser.session.send('Runtime.enable')
  const renderScale = Number(process.env.RENDER_SCALE ?? 1)
  await browser.session.send('Page.navigate', { url: `${server.origin}/index.html?offline=1&renderScale=${renderScale}` })
  let ready = false
  for (let attempt = 0; attempt < 600 && !ready; attempt++) {
    ready = await evaluate('window.__ready === true')
    const error = await evaluate('window.__error || ""')
    if (error) throw new Error(error)
    if (!ready) await new Promise((resolve) => setTimeout(resolve, 100))
  }
  if (!ready) throw new Error('场景启动超时')
  const report = await evaluate(`(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js')
    const { SUBTITLES } = await import('/src/timeline.js')
    const stage = window.__stage
    stage.render = () => {}
    const invalid = []
    const clipped = new Map()
    const overlayClipped = new Map()
    stage.overlayCam.updateMatrixWorld(true)
    const snapshot = () => {
      const state = []
      stage.world.traverse(object => {
        let ancestor = object
        while (ancestor) { if (!ancestor.visible) return; ancestor = ancestor.parent }
        state.push([object.uuid, object.visible, object.position.toArray(), object.rotation.toArray(), object.scale.toArray(), object.material?.opacity, object.material?.depthWrite, object.material?.transparent, object.material?.map?.uuid, object.geometry?.drawRange])
      })
      return JSON.stringify(state)
    }
    for (let frame = 0; frame < window.__film.duration * 60; frame++) {
      const time = frame / 60
      window.__renderAt(time)
      stage.world.updateMatrixWorld(true)
      stage.camera.updateMatrixWorld(true)
      if (frame % 15 === 0) {
        stage.overlay.updateMatrixWorld(true)
        stage.overlay.traverse(object => {
          if (!object.userData.textureInfo || object.material.opacity < 0.65) return
          let ancestor = object
          while (ancestor) { if (!ancestor.visible) return; ancestor = ancestor.parent }
          object.geometry.computeBoundingBox()
          const bounds = object.geometry.boundingBox
          const points = [[bounds.min.x,bounds.min.y],[bounds.max.x,bounds.min.y],[bounds.min.x,bounds.max.y],[bounds.max.x,bounds.max.y]].map(([horizontal,vertical]) => new THREE.Vector3(horizontal,vertical,0).applyMatrix4(object.matrixWorld).project(stage.overlayCam))
          if (points.some(point => Math.abs(point.x) > 0.97 || Math.abs(point.y) > 0.97) && !overlayClipped.has(object.uuid)) overlayClipped.set(object.uuid,{time,aspect:object.userData.textureInfo.aspect,bounds:points.map(point=>point.toArray())})
        })
      }
      stage.world.traverse(object => {
        if (![...object.position.toArray(), ...object.scale.toArray(), ...object.matrixWorld.elements, object.material?.opacity ?? 1].every(Number.isFinite)) invalid.push({time,object:object.name || object.type})
        if (time < 44 || frame % 15 || !object.userData.textureInfo || object.material.opacity < 0.65) return
        let ancestor = object
        while (ancestor) { if (!ancestor.visible) return; ancestor = ancestor.parent }
        object.geometry.computeBoundingBox()
        const bounds = object.geometry.boundingBox
        if (bounds.max.y - bounds.min.y < 0.12) return
        const points = [[bounds.min.x,bounds.min.y],[bounds.max.x,bounds.min.y],[bounds.min.x,bounds.max.y],[bounds.max.x,bounds.max.y]].map(([horizontal,vertical]) => new THREE.Vector3(horizontal,vertical,0).applyMatrix4(object.matrixWorld).project(stage.camera))
        const hasSubtitle = SUBTITLES.some(cue => time >= cue.a && time < cue.b)
        if (points.some(point => Math.abs(point.x) > 0.98 || point.y > 0.98 || point.y < (hasSubtitle ? -0.77 : -0.97))) {
          const key = object.uuid
          if (!clipped.has(key)) clipped.set(key,{time,object:object.name,chapter:object.parent.name,aspect:object.userData.textureInfo.aspect,position:object.position.toArray(),bounds:points.map(point=>point.toArray())})
        }
      })
    }
    const deterministic = []
    for (const time of [47.5,50.5,53.3,57.5,60.5,69.5,73.5,77.5,81.5,92,100,111,115,118,122,130.5,135.5,137,147,150.5,155,159.5,174,178.5,180,183,193.5,198.5,202.5,211]) {
      window.__renderAt(time)
      const expected = snapshot()
      window.__renderAt(9)
      window.__renderAt(time)
      if (snapshot() !== expected) deterministic.push(time)
    }
    return {duration:window.__film.duration,renderWidth:stage.renderWidth,renderHeight:stage.renderHeight,framesChecked:window.__film.duration*60,invalid,deterministicFailures:deterministic,textSafeAreaCandidates:[...clipped.values()],overlayTextSafeAreaCandidates:[...overlayClipped.values()]}
  })()`)
  mkdirSync(join(root, 'tmp'), { recursive: true })
  writeFileSync(join(root, 'tmp/mechanism-check.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report, null, 2))
  if (report.invalid.length || report.deterministicFailures.length || report.overlayTextSafeAreaCandidates.length) throw new Error('动画状态检查未通过')
} finally {
  await browser.close()
  await server.close()
}
