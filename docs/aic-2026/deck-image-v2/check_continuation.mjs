import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const directory = path.dirname(fileURLToPath(import.meta.url));
const profile = await mkdtemp(path.join(tmpdir(), 'yinling-continuation-validation-'));
const browser = spawn(process.env.CHROME || 'chromium', ['--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
const runtimeErrors = [];
const reports = [];
let socket;

try {
  let port;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0];
      break;
    } catch {
      await delay(100);
    }
  }
  assert.ok(port, 'Chromium debugging port must be available');
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let sequence = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') runtimeErrors.push(message.params.exceptionDetails);
    if (message.id && pending.has(message.id)) {
      const callback = pending.get(message.id);
      pending.delete(message.id);
      message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
    }
  });
  function command(method, params = {}) {
    sequence += 1;
    const identifier = sequence;
    return new Promise((resolve, reject) => {
      pending.set(identifier, { resolve, reject });
      socket.send(JSON.stringify({ id: identifier, method, params }));
    });
  }
  async function evaluate(expression) {
    const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
  async function waitFor(expression) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (await evaluate(expression)) return;
      await delay(100);
    }
    throw new Error(`Timed out: ${expression}`);
  }
  async function keypress(key, code, keyCode) {
    await command('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: keyCode });
    await command('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode });
  }
  function pageName(page) {
    return page === 1 ? 'cover' : `p${String(page).padStart(2, '0')}`;
  }
  async function navigate(page) {
    await command('Page.navigate', { url: pathToFileURL(path.join(directory, `${pageName(page)}.html`)).href });
    await waitFor(`location.pathname.endsWith('/${pageName(page)}.html') && document.documentElement.dataset.ready === 'true' && document.querySelector('.background')?.naturalWidth > 0`);
  }
  await command('Runtime.enable');
  await command('Page.enable');

  for (let page = 9; page <= 17; page += 1) {
    const report = { page, viewports: [] };
    for (const [width, height] of [[3840, 2160], [1920, 1080], [1366, 768], [1024, 768], [390, 844]]) {
      await command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
      await navigate(page);
      const result = await evaluate(`(() => {
        const slide = document.querySelector('.slide');
        const slideBounds = slide.getBoundingClientRect();
        const scale = slideBounds.width / 2048;
        const tolerance = Math.max(0.2, scale * 0.4);
        const textElements = [...slide.querySelectorAll('h1,h2,h3,p')].filter(element => element.textContent.trim());
        const blocks = textElements.map(element => {
          const range = document.createRange();
          range.selectNodeContents(element);
          const rectangle = range.getBoundingClientRect();
          return { element, text: element.textContent.trim(), left: rectangle.left, top: rectangle.top, right: rectangle.right, bottom: rectangle.bottom };
        });
        const textIssues = [];
        const textOverlaps = [];
        for (const block of blocks) {
          if (block.left < slideBounds.left - tolerance || block.top < slideBounds.top - tolerance || block.right > slideBounds.right + tolerance || block.bottom > slideBounds.bottom + tolerance) textIssues.push({ text: block.text, reason: 'outside slide' });
          if (block.element.scrollWidth > block.element.clientWidth + 1 || block.element.scrollHeight > block.element.clientHeight + 1) textIssues.push({ text: block.text, reason: 'element overflow' });
          const panel = block.element.closest('.soft-panel');
          if (panel) {
            const panelBounds = panel.getBoundingClientRect();
            if (block.left < panelBounds.left - tolerance || block.right > panelBounds.right + tolerance || block.top < panelBounds.top - tolerance || block.bottom > panelBounds.bottom + tolerance) textIssues.push({ text: block.text, reason: 'outside information panel' });
          }
        }
        for (let first = 0; first < blocks.length; first += 1) {
          for (let second = first + 1; second < blocks.length; second += 1) {
            const left = blocks[first];
            const right = blocks[second];
            if (Math.min(left.right, right.right) - Math.max(left.left, right.left) > tolerance && Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > tolerance) textOverlaps.push([left.text, right.text]);
          }
        }
        const unframedLabelIssues = [...slide.querySelectorAll('.diagram-label,.diagram-note,.experience-stage,.value-stage,.roadmap-stage')].filter(element => parseFloat(getComputedStyle(element).borderTopWidth) > 0 || getComputedStyle(element).backgroundImage !== 'none').map(element => element.className);
        const fontFamily = getComputedStyle(slide).fontFamily.split(',')[0].replaceAll('"', '');
        const usedFonts = [...document.fonts].filter(font => font.family.replaceAll('"', '') === fontFamily).map(font => ({ family: font.family, weight: font.weight, status: font.status }));
        const background = slide.querySelector('.background');
        const charts = [...slide.querySelectorAll('[data-chart]')].map(chart => {
          const plot = chart.querySelector('.chart-plot').getBoundingClientRect();
          const total = Number(chart.dataset.total);
          return { name: chart.dataset.chart, total, baseline: (plot.bottom - slideBounds.top) / scale, columns: [...chart.querySelectorAll('.chart-column')].map(column => {
            const bar = column.querySelector('.chart-bar').getBoundingClientRect();
            const count = Number(column.dataset.count);
            return { count, actualRatio: bar.height / plot.height, expectedRatio: count / total, bottom: (bar.bottom - slideBounds.top) / scale, label: column.querySelector('.chart-label').textContent.trim(), value: column.querySelector('.chart-value').textContent.trim() };
          }) };
        });
        const facts = {
          perception: [...slide.querySelectorAll('.perception-label')].map(element => element.textContent),
          experience: [...slide.querySelectorAll('.experience-stage')].map(element => element.textContent),
          family: [...slide.querySelectorAll('.family-request,.family-claim,.family-delivery,.family-read')].map(element => element.textContent),
          engineering: Object.fromEntries([...slide.querySelectorAll('[data-metric]')].map(element => [element.dataset.metric, Number(element.dataset.value)])),
          productStages: slide.querySelectorAll('.product-stage').length,
          values: slide.querySelectorAll('.value-stage').length,
          roadmap: slide.querySelectorAll('.roadmap-stage').length,
          closing: slide.querySelector('.closing-title')?.textContent,
        };
        const normal = text => text.replace(/\\s+/g, '');
        const titleBounds = blocks.find(block => block.element.tagName === 'H1');
        const zoneIssues = [];
        if (${page} === 9 && (titleBounds.bottom - slideBounds.top) / scale > 170) zoneIssues.push('p09 title overlaps upper structure illustration');
        if (${page} === 17 && blocks.filter(block => !block.element.matches('.page-number')).some(block => (block.right - slideBounds.left) / scale > 1010)) zoneIssues.push('closing text encroaches on product illustration');
        return {
          viewport: [innerWidth, innerHeight],
          fontsReady: document.fonts.status === 'loaded', usedFonts,
          background: { loaded: background.complete && background.naturalWidth > 0, size: [background.naturalWidth, background.naturalHeight] },
          slideFitsViewport: slideBounds.left >= -tolerance && slideBounds.top >= -tolerance && slideBounds.right <= innerWidth + tolerance && slideBounds.bottom <= innerHeight + tolerance,
          textIssues, textOverlaps, unframedLabelIssues, zoneIssues,
          panelCount: slide.querySelectorAll('.soft-panel').length,
          charts, facts,
          visibleCopy: normal(textElements.filter(element => !element.matches('.page-number,.footer-note,.source')).map(element => element.textContent).join('')).length,
        };
      })()`);
      report.viewports.push(result);
    }
    await keypress('f', 'KeyF', 70);
    await waitFor('Boolean(document.fullscreenElement)');
    await keypress('f', 'KeyF', 70);
    await waitFor('!document.fullscreenElement');
    report.fullscreenToggle = 'passed';
    report.passed = report.viewports.every(result => {
      const facts = result.facts;
      const semanticChecks = {
        9: facts.perception.join(',') === '结构读取,按需视觉,统一目标派发',
        10: facts.experience.length === 5 && facts.experience[2].includes('独立验证') && facts.experience[3].includes('人工采用'),
        11: facts.family.length === 4 && facts.family.some(text => text.includes('长者已读')),
        12: result.charts.map(chart => chart.columns.map(column => column.count).join(',')).join(';') === '6,15;0,12,22' && result.charts.every(chart => chart.columns.every(column => Math.abs(column.actualRatio - column.expectedRatio) < 0.001 && Math.abs(column.bottom - chart.baseline) < 0.1)) && Math.abs(result.charts[0].baseline - result.charts[1].baseline) < 0.1,
        13: JSON.stringify(facts.engineering) === JSON.stringify({ core: 233, chain: 209, server: 58, apps: 8, runs: 31 }),
        14: facts.productStages === 4,
        15: facts.values === 3,
        16: facts.roadmap === 3,
        17: facts.closing === '银龄智办',
      };
      return semanticChecks[page] && result.fontsReady && result.usedFonts.length === 2 && result.usedFonts.every(font => font.status === 'loaded') && result.background.loaded && result.background.size[0] * 9 === result.background.size[1] * 16 && result.slideFitsViewport && result.textIssues.length === 0 && result.textOverlaps.length === 0 && result.unframedLabelIssues.length === 0 && result.zoneIssues.length === 0 && result.panelCount === (page === 13 ? 1 : 0);
    });
    await writeFile(path.join(directory, `previews/${pageName(page)}-validation.json`), JSON.stringify(report, null, 2) + '\n');
    reports.push(report);
    console.log(`${pageName(page)}: ${report.passed ? 'passed' : 'FAILED'} (5 viewports, fonts, text, data, fullscreen)`);
  }

  await command('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await navigate(1);
  for (let page = 2; page <= 17; page += 1) {
    await keypress('ArrowRight', 'ArrowRight', 39);
    await waitFor(`location.pathname.endsWith('/${pageName(page)}.html') && document.documentElement.dataset.ready === 'true'`);
  }
  await keypress('ArrowRight', 'ArrowRight', 39);
  assert.equal(await evaluate('location.pathname.endsWith("/p17.html")'), true, 'Last page must not navigate beyond the deck');
  for (let page = 16; page >= 1; page -= 1) {
    await keypress('ArrowLeft', 'ArrowLeft', 37);
    await waitFor(`location.pathname.endsWith('/${pageName(page)}.html') && document.documentElement.dataset.ready === 'true'`);
  }
  const navigation = { forward: '1–17 passed', backward: '17–1 passed', terminalRightArrow: 'passed' };
  const aggregate = { pages: reports.map(report => ({ page: report.page, passed: report.passed, visibleCopy: report.viewports[0].visibleCopy })), navigation, runtimeErrors, passed: reports.every(report => report.passed) && runtimeErrors.length === 0 };
  await writeFile(path.join(directory, 'previews/continuation-validation.json'), JSON.stringify(aggregate, null, 2) + '\n');
  console.log('Full-deck bidirectional navigation: passed');
  assert.equal(aggregate.passed, true, 'All continuation-slide checks must pass');
} finally {
  socket?.close();
  browser.kill('SIGTERM');
  await new Promise(resolve => browser.once('exit', resolve));
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
