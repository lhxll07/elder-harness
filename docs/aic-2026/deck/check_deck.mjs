import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const deck = dirname(fileURLToPath(import.meta.url));
const output = process.argv[2]
  ? resolve(process.argv[2])
  : await mkdtemp(join(tmpdir(), 'elder-deck-check-'));
const profile = await mkdtemp(join(tmpdir(), 'elder-deck-chrome-'));
await mkdir(output, { recursive: true });
const browser = spawn(process.env.CHROME || 'chromium', [
  '--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
  '--no-first-run', '--no-default-browser-check', '--hide-scrollbars',
  '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0',
  `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });
let launchError;
browser.on('error', error => { launchError = error; });
const pause = milliseconds => new Promise(resolvePause => setTimeout(resolvePause, milliseconds));
const pending = new Map();
let sequence = 0;
let socket;

async function connect() {
  let port;
  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (launchError) throw launchError;
    if (browser.exitCode !== null) throw new Error(`Chromium exited: ${browser.exitCode}`);
    try {
      port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]);
      if (port) break;
    } catch {}
    await pause(100);
  }
  if (!port) throw new Error('Chromium did not open its local debugging port');
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const target = targets.find(item => item.type === 'page');
  if (!target) throw new Error('No browser page found');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolveOpen, rejectOpen) => {
    socket.addEventListener('open', resolveOpen, { once: true });
    socket.addEventListener('error', rejectOpen, { once: true });
  });
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    clearTimeout(request.timer);
    if (message.error) request.reject(new Error(JSON.stringify(message.error)));
    else request.resolve(message.result);
  });
}

function send(method, params = {}) {
  const requestId = ++sequence;
  return new Promise((resolveRequest, rejectRequest) => {
    const timer = setTimeout(() => {
      pending.delete(requestId);
      rejectRequest(new Error(`CDP timeout: ${method}`));
    }, 20000);
    pending.set(requestId, { resolve: resolveRequest, reject: rejectRequest, timer });
    socket.send(JSON.stringify({ id: requestId, method, params }));
  });
}

async function evaluate(expression) {
  const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
  return response.result.value;
}

async function navigate(filename) {
  await send('Page.navigate', { url: pathToFileURL(join(deck, filename)).href });
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    ready = await evaluate("document.readyState === 'complete' && document.querySelectorAll('.slide').length === 24");
    if (ready) break;
    await pause(100);
  }
  if (!ready) throw new Error(`Page did not finish loading: ${filename}`);
  await evaluate('document.fonts.ready.then(() => true)');
}

async function assertActive(expected, label) {
  const actual = await evaluate("document.querySelector('.slide.on')?.id");
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}

async function keypress(key) {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key });
}

try {
  await connect();
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
  await navigate('deck.print.html');
  const report = await evaluate(`(() => {
    const slides = [...document.querySelectorAll('.slide')];
    return {
      pages: slides.length,
      main: slides.filter(slide => slide.dataset.section === 'main').length,
      appendix: slides.filter(slide => slide.dataset.section === 'appendix').length,
      fontsReady: document.fonts.status === 'loaded',
      brokenImages: [...document.images].filter(image => !image.complete || !image.naturalWidth).map(image => image.getAttribute('src')),
      textIssues: slides.flatMap((slide, index) => {
        const bounds = slide.getBoundingClientRect();
        const footerTop = slide.querySelector('.footer').getBoundingClientRect().top;
        const walker = document.createTreeWalker(slide, NodeFilter.SHOW_TEXT);
        const issues = [];
        let textNode;
        while ((textNode = walker.nextNode())) {
          if (!textNode.textContent.trim()) continue;
          const parent = textNode.parentElement;
          const range = document.createRange();
          range.selectNodeContents(textNode);
          for (const rect of range.getClientRects()) {
            if (!rect.width || !rect.height) continue;
            if (rect.left < bounds.left - 1 || rect.right > bounds.right + 1 || rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1) {
              issues.push({ page: index + 1, type: 'outside-slide', text: textNode.textContent.trim().slice(0, 75) });
            } else if (!parent.closest('.footer') && rect.bottom > footerTop - 8) {
              issues.push({ page: index + 1, type: 'footer-overlap', text: textNode.textContent.trim().slice(0, 75) });
            }
          }
        }
        return issues;
      }),
      dimensions: slides.map(slide => ({ width: slide.offsetWidth, height: slide.offsetHeight })),
    };
  })()`);
  for (let page = 0; page < 24; page += 1) {
    const screenshot = await send('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: true,
      clip: { x: 0, y: page * 900, width: 1600, height: 900, scale: .6 },
    });
    await writeFile(join(output, `p${String(page + 1).padStart(2, '0')}.png`), Buffer.from(screenshot.data, 'base64'));
  }
  await navigate('deck.html');
  await assertActive('p1', 'initial main page');
  await keypress('End');
  await assertActive('p14', 'main ending');
  await keypress('ArrowRight');
  await assertActive('p14', 'main must not advance into appendix');
  await keypress('a');
  await assertActive('p15', 'appendix shortcut');
  await evaluate('document.querySelector(\'.index-link[href="#p19"]\').click()');
  await assertActive('p19', 'appendix index link');
  await keypress('End');
  await assertActive('p24', 'appendix ending');
  await keypress('m');
  await assertActive('p1', 'return to main');
  report.navigation = 'passed';
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ ...report, dimensions: undefined, output }, null, 2));
  if (report.pages !== 24 || report.main !== 14 || report.appendix !== 10 ||
      report.brokenImages.length || report.textIssues.length || !report.fontsReady ||
      report.dimensions.some(size => size.width !== 1600 || size.height !== 900)) {
    process.exitCode = 1;
  }
} finally {
  socket?.close();
  const closed = new Promise(resolveClose => browser.once('exit', resolveClose));
  browser.kill('SIGTERM');
  await Promise.race([closed, pause(2000)]);
  if (browser.exitCode === null && browser.signalCode === null) browser.kill('SIGKILL');
  for (const request of pending.values()) clearTimeout(request.timer);
  await rm(profile, { recursive: true, force: true });
}
