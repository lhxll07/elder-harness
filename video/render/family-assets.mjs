import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch } from './cdp.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const result = spawnSync('python3', [join(root, 'render/family-data.py')], { encoding: 'utf8' })
if (result.status !== 0) throw new Error(result.stderr)
const pages = JSON.parse(result.stdout)
const css = readFileSync(join(root, '../server/app/static/family.css'), 'utf8')
const output = join(root, 'assets/family')
mkdirSync(output, { recursive: true })
const browser = await launch({ width: 1280, height: 1100, port: 9437, gpu: 'angle-vulkan' })
async function evaluate(expression) {
  const response = await browser.session.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails))
  return response.result.value
}
async function capture(name, selector) {
  const clip = selector ? await evaluate(`(() => { const rectangle = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {x:rectangle.x,y:rectangle.y,width:rectangle.width,height:rectangle.height,scale:3} })()`) : { x: 80, y: 0, width: 1120, height: 1100, scale: 2 }
  const screenshot = await browser.session.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip })
  writeFileSync(join(output, `${name}.png`), Buffer.from(screenshot.data, 'base64'))
}
try {
  await browser.session.send('Page.enable')
  await browser.session.send('Runtime.enable')
  await browser.session.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1100, deviceScaleFactor: 1, mobile: false })
  for (const [name, html] of Object.entries(pages)) {
    const styled = html.replace('<link rel="stylesheet" href="/static/family.css">', `<style>${css}</style>`)
    await browser.session.send('Page.navigate', { url: 'data:text/html;charset=utf-8,' + encodeURIComponent(styled) })
    await evaluate('document.fonts.ready')
    await evaluate('document.querySelectorAll("details").forEach(element => element.open = true)')
    if (name === 'overview') {
      await capture('overview')
      await capture('request', '#requests')
      await capture('contacts', '.side-column .panel:last-child')
    } else if (name === 'compose') {
      await evaluate('document.querySelector("textarea").value = "上次看的是陈医生。您再核对一下就诊记录。"')
      await capture('compose', '#message')
    } else {
      await capture(name, '#activity .event-card')
    }
  }
  writeFileSync(join(output, 'provenance.json'), JSON.stringify({ source: ['server/app/web.py', 'server/app/static/family.css'], data: '虚构示例；静态页面素材，不是端到端实机运行', assets: ['overview', 'request', 'contacts', 'compose', 'submitted', 'delivered', 'read'] }, null, 2) + '\n')
  console.log(`真实家人端样式资产：${output}`)
} finally {
  await browser.close()
}
