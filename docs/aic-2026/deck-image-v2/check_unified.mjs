import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const directory = path.dirname(fileURLToPath(import.meta.url));
const profile = await mkdtemp(path.join(tmpdir(), 'yinling-unified-validation-'));
const browser = spawn('chromium', ['--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
const reports = [];
const runtimeErrors = [];
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
  await command('Runtime.enable');
  await command('Page.enable');

  for (const page of [2, 3, 4, 5, 7, 8]) {
    const pageName = `p${String(page).padStart(2, '0')}`;
    const report = { page, viewports: [], runtimeErrors: [] };
    const errorStart = runtimeErrors.length;
    for (const [width, height] of [[3840, 2160], [1920, 1080], [1366, 768], [1024, 768], [390, 844]]) {
      await command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
      await command('Page.navigate', { url: pathToFileURL(path.join(directory, `${pageName}.html`)).href });
      await waitFor(`document.documentElement.dataset.ready === 'true' && document.querySelector('.background')?.naturalWidth === 3840`);
      const result = await evaluate(`(() => {
        const slide = document.querySelector('.slide');
        const slideBounds = slide.getBoundingClientRect();
        const scale = slideBounds.width / 2048;
        const tolerance = Math.max(0.15, 0.3 * scale);
        const selectors = 'h1,h2,h3,p,.phone-entries span,.stage-index,.metric-column strong,.metric-column>span,.metric-arrow';
        const textElements = [...slide.querySelectorAll(selectors)].filter(element => element.textContent.trim());
        const boundsOf = element => {
          const range = document.createRange();
          range.selectNodeContents(element);
          const rectangle = range.getBoundingClientRect();
          return { left: rectangle.left, top: rectangle.top, right: rectangle.right, bottom: rectangle.bottom };
        };
        const blocks = textElements.map(element => ({ element, text: element.textContent.trim(), ...boundsOf(element) }));
        const textIssues = [];
        const overlappingTextBlocks = [];
        for (const block of blocks) {
          if (block.left < slideBounds.left - tolerance || block.top < slideBounds.top - tolerance || block.right > slideBounds.right + tolerance || block.bottom > slideBounds.bottom + tolerance) textIssues.push({ text: block.text, reason: 'outside slide' });
          if (block.element.scrollWidth > block.element.clientWidth + 1 || block.element.scrollHeight > block.element.clientHeight + 1) textIssues.push({ text: block.text, reason: 'element overflow', client: [block.element.clientWidth, block.element.clientHeight], scroll: [block.element.scrollWidth, block.element.scrollHeight] });
        }
        for (let first = 0; first < blocks.length; first += 1) {
          for (let second = first + 1; second < blocks.length; second += 1) {
            const left = blocks[first];
            const right = blocks[second];
            if (Math.min(left.right, right.right) - Math.max(left.left, right.left) > tolerance && Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > tolerance) overlappingTextBlocks.push([left.text, right.text]);
          }
        }
        const overflowingCards = [...slide.querySelectorAll('.capability,.deployment-part,.stage-copy,.plane-copy,.review-stage,.value-copy,.benchmark,.result-card,.phone-entries,.result-copy,.story-step,.evidence-part,.values,.population,.request,.plane-heading,.execution-node,.stage-caption,.group-title,.ledger-caption,.review-order')].filter(element => element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1).map(element => ({ className: element.className, client: [element.clientWidth, element.clientHeight], scroll: [element.scrollWidth, element.scrollHeight] }));
        const requiredPanelSelectors = {
          2: '.population',
          3: '.deployment',
          4: '.evidence',
          5: '.deployment',
          7: '.benchmark',
          8: '.values',
        };
        const panelIssues = [...slide.querySelectorAll(requiredPanelSelectors[${page}])].filter(element => !element.classList.contains('soft-panel') || getComputedStyle(element).borderTopWidth !== '1px' || getComputedStyle(element).backgroundImage === 'none').map(element => element.className);
        const unframedLabelIssues = [...slide.querySelectorAll('.stage-copy,.capability,.story-step,.request,.plane-heading,.execution-node,.section-label,.stage-caption,.group-title,.review-stage')].filter(element => element.classList.contains('soft-panel') || parseFloat(getComputedStyle(element).borderTopWidth) > 0 || getComputedStyle(element).backgroundImage !== 'none').map(element => element.className);
        if (slide.querySelectorAll('.soft-panel').length !== 1) panelIssues.push('Only one key information panel is allowed');
        panelIssues.push(...unframedLabelIssues);
        const panelTextIssues = blocks.filter(block => {
          const panel = block.element.closest('.soft-panel');
          if (!panel) return false;
          const bounds = panel.getBoundingClientRect();
          return block.left < bounds.left - tolerance || block.top < bounds.top - tolerance || block.right > bounds.right + tolerance || block.bottom > bounds.bottom + tolerance;
        }).map(block => block.text);
        const multilineBodyCopy = [...slide.querySelectorAll('.capability p,.stage-copy p,.story-step p,.plane-mechanism,.execution-node p,.value-copy p')].filter(element => element.querySelector('br')).map(element => element.textContent.trim());
        const zoneMap = {
          2: { '.result-copy': [1693, 503, 236, 250] },
          3: { '.phone-status': [890, 303, 132, 55], '.phone-caption': [924, 563, 186, 47], '.phone-hint': [870, 645, 296, 58], '.phone-entries': [850, 830, 316, 85] },
          4: { '.result-card': [1607, 394, 303, 266] },
          7: { '.launcher-title': [174, 335, 382, 42], '.contact-draft': [856, 354, 305, 64], '.contact-person': [1490, 330, 309, 64], '.incoming-draft': [815, 447, 205, 72], '.reply-draft': [994, 542, 210, 65], '.incoming-person': [1438, 433, 211, 72], '.reply-person': [1618, 535, 222, 65], '.draft-edit': [808, 675, 310, 48], '.draft-person': [1430, 676, 300, 48], '.owner-label': [1885, 432, 154, 55] },
        };
        const imageTextZoneIssues = [];
        for (const [selector, zone] of Object.entries(zoneMap[${page}] || {})) {
          const container = slide.querySelector(selector);
          const children = container.matches(selectors) ? [container] : [...container.querySelectorAll(selectors)];
          for (const element of children) {
            const rectangle = boundsOf(element);
            const actual = { left: (rectangle.left - slideBounds.left) / scale, top: (rectangle.top - slideBounds.top) / scale, right: (rectangle.right - slideBounds.left) / scale, bottom: (rectangle.bottom - slideBounds.top) / scale };
            if (actual.left < zone[0] - 1 || actual.top < zone[1] - 1 || actual.right > zone[0] + zone[2] + 1 || actual.bottom > zone[1] + zone[3] + 1) imageTextZoneIssues.push({ selector, text: element.textContent.trim(), actual });
          }
        }
        const band = document.querySelector('.values');
        const facts = {
          population: document.querySelector('.population-total strong')?.textContent,
          share: document.querySelector('.share-number strong')?.textContent,
          capabilityCount: document.querySelectorAll('.capability').length,
          phoneEntryCount: document.querySelectorAll('.phone-entries span').length,
          deploymentCount: document.querySelectorAll('.deployment-part').length,
          storyStageCount: document.querySelectorAll('.story-step').length,
          resultAwaiting: document.querySelector('.result-primary strong')?.textContent,
          resultSigned: document.querySelector('.result-secondary strong')?.textContent,
          planeCount: document.querySelectorAll('.plane-copy').length,
          executionCount: document.querySelectorAll('.execution-node').length,
          messageStageCount: document.querySelectorAll('.stage-caption').length,
          drafts: [...document.querySelectorAll('.draft-text')].map(element => element.textContent),
          history: [...document.querySelectorAll('.chat-message')].map(element => element.textContent),
          benchmark: [document.querySelector('[data-metric="stepwise"]')?.textContent, document.querySelector('[data-metric="graded"]')?.textContent],
          owner: document.querySelector('.owner-label')?.textContent,
          reviewStageCount: document.querySelectorAll('.review-stage').length,
          ledgerFieldCount: document.querySelectorAll('.ledger-field').length,
          valueCount: band?.querySelectorAll('.value-copy').length,
          valueBandBorder: band ? getComputedStyle(band).borderTopWidth : null,
        };
        return { viewport: [window.innerWidth, window.innerHeight], fontsReady: document.fonts.status === 'loaded', fonts: [...document.fonts].map(font => ({ family: font.family, weight: font.weight, status: font.status })), backgroundLoaded: document.querySelector('.background').complete && document.querySelector('.background').naturalWidth === 3840, slideFitsViewport: slideBounds.left >= -tolerance && slideBounds.top >= -tolerance && slideBounds.right <= window.innerWidth + tolerance && slideBounds.bottom <= window.innerHeight + tolerance, facts, textIssues, overlappingTextBlocks, overflowingCards, imageTextZoneIssues, panelIssues, panelTextIssues, multilineBodyCopy };
      })()`);
      report.viewports.push(result);
    }
    await command('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
    await keypress('f', 'KeyF', 70);
    await waitFor('Boolean(document.fullscreenElement)');
    await keypress('f', 'KeyF', 70);
    await waitFor('!document.fullscreenElement');
    report.fullscreenToggle = 'passed';
    const previous = page === 2 ? 'cover' : `p${String(page - 1).padStart(2, '0')}`;
    await keypress('ArrowLeft', 'ArrowLeft', 37);
    await waitFor(`location.pathname.endsWith('/${previous}.html') && document.documentElement.dataset.ready === 'true'`);
    report.previousSlideNavigation = 'passed';
    await keypress('ArrowRight', 'ArrowRight', 39);
    await waitFor(`location.pathname.endsWith('/${pageName}.html') && document.documentElement.dataset.ready === 'true'`);
    report.previousToCurrentNavigation = 'passed';
    report.runtimeErrors = runtimeErrors.slice(errorStart);
    report.passed = report.runtimeErrors.length === 0 && report.viewports.every(result => {
      const facts = result.facts;
      const semanticChecks = {
        2: facts.population === '3.23' && facts.share === '23.0',
        3: facts.capabilityCount === 6 && facts.phoneEntryCount === 3 && facts.deploymentCount === 3,
        4: facts.storyStageCount === 5 && facts.resultAwaiting === '1' && facts.resultSigned === '3',
        5: facts.planeCount === 3 && facts.executionCount === 5 && facts.deploymentCount === 4,
        7: facts.messageStageCount === 3 && facts.drafts.length === 2 && facts.drafts.every(draft => draft === '我已到家，请放心。') && facts.history.length === 4 && !facts.history.includes('我已到家，请放心。') && facts.benchmark.join(',') === '10,1' && facts.owner === '本人操作',
        8: facts.reviewStageCount === 3 && facts.ledgerFieldCount === 4 && facts.valueCount === 3 && facts.valueBandBorder === '1px',
      };
      return semanticChecks[page] && result.fontsReady && result.fonts.every(font => font.status === 'loaded') && result.backgroundLoaded && result.slideFitsViewport && result.textIssues.length === 0 && result.overlappingTextBlocks.length === 0 && result.overflowingCards.length === 0 && result.imageTextZoneIssues.length === 0 && result.panelIssues.length === 0 && result.panelTextIssues.length === 0 && result.multilineBodyCopy.length === 0;
    });
    await writeFile(path.join(directory, `previews/${pageName}-validation.json`), JSON.stringify(report, null, 2) + '\n');
    reports.push(report);
    console.log(`${pageName}: ${report.passed ? 'passed' : 'FAILED'} (5 viewports, fonts, text bounds, illustration zones, semantics, fullscreen, navigation)`);
  }
  const aggregate = { pages: reports.map(report => ({ page: report.page, passed: report.passed })), runtimeErrors, passed: reports.every(report => report.passed) };
  await writeFile(path.join(directory, 'previews/unified-validation.json'), JSON.stringify(aggregate, null, 2) + '\n');
  assert.equal(aggregate.passed, true, 'All unified-slide checks must pass');
} finally {
  socket?.close();
  browser.kill('SIGTERM');
  await new Promise(resolve => browser.once('exit', resolve));
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
