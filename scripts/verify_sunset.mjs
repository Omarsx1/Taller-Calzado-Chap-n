import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Headless-Chrome screenshot harness for the sunset exterior environment.
 *
 * Requires the dev/preview server to be running. Captures the initial view,
 * the panorámica exterior view and two orbit steps toward the painted sun so
 * the sky, mountain rings and sunset lighting can be inspected without a
 * manual browser session.
 *
 * Configuration (all optional, via environment variables):
 * - CHROME_BIN      path to the Chrome/Chromium binary
 * - APP_URL         server URL to capture
 * - SUNSET_SHOT_DIR directory where the PNGs are written
 */

const CHROME_BIN =
  process.env.CHROME_BIN ??
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const APP_URL = process.env.APP_URL ?? 'http://localhost:5173/';
const APP_PORT = new URL(APP_URL).port || '80';
const OUT_DIR = process.env.SUNSET_SHOT_DIR ?? path.resolve('.artifacts/sunset');

fs.mkdirSync(OUT_DIR, { recursive: true });

const chrome = spawn(CHROME_BIN, [
  '--headless=new',
  '--remote-debugging-port=9223',
  '--use-gl=angle',
  '--use-angle=metal',
  '--window-size=1600,900',
  APP_URL,
]);

await new Promise((r) => setTimeout(r, 2000));

try {
  await fetch('http://127.0.0.1:9223/json/version');

  const listRes = await fetch('http://127.0.0.1:9223/json/list');
  const pages = await listRes.json();
  const page = pages.find((p) => p.url.includes(APP_PORT));
  const targetWs = page.webSocketDebuggerUrl;

  const ws = new WebSocket(targetWs);
  await new Promise((resolve) => (ws.onopen = resolve));

  let reqId = 1;
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const id = reqId++;
      const handler = (evt) => {
        const msg = JSON.parse(evt.data);
        if (msg.id === id) {
          ws.removeEventListener('message', handler);
          resolve(msg.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id, method, params }));
    });

  const consoleErrors = [];
  ws.addEventListener('message', (evt) => {
    const msg = JSON.parse(evt.data);
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
    }
  });
  await send('Runtime.enable');

  const takeShot = async (name) => {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT_DIR, `${name}.png`), Buffer.from(res.data, 'base64'));
    console.log(`Saved ${path.join(OUT_DIR, `${name}.png`)}`);
  };

  /** Left-drag on the canvas: negative dx orbits the view to the right. */
  const drag = async (dx) => {
    const startX = 900;
    const y = 450;
    await send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: startX,
      y,
      button: 'left',
      clickCount: 1,
    });
    const steps = 12;
    for (let s = 1; s <= steps; s++) {
      await send('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: startX + (dx * s) / steps,
        y,
        button: 'left',
      });
    }
    await send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: startX + dx,
      y,
      button: 'left',
      clickCount: 1,
    });
  };

  // Wait for sky + warehouse GLB + shoes to load
  await new Promise((r) => setTimeout(r, 8000));

  // 1. Initial interior/exterior view (default camera)
  await takeShot('sunset_1_initial');

  // 2. Panorámica: whole 93 m site with mountain rings above the roofline
  await send('Runtime.evaluate', {
    expression: 'document.querySelector("[data-goto=panoramica]").click()',
  });
  await new Promise((r) => setTimeout(r, 2500));
  await takeShot('sunset_2_panoramica');

  // 3-4. Orbit right toward the painted sun (u = 0.34, low over the rings).
  //      ~77 px of drag ≈ 31°, which centres the sun from the initial view.
  await drag(-75);
  await new Promise((r) => setTimeout(r, 1200));
  await takeShot('sunset_3_toward_sun');

  await drag(-75);
  await new Promise((r) => setTimeout(r, 1200));
  await takeShot('sunset_4_sun_right_edge');

  if (consoleErrors.length > 0) {
    console.log('Console errors captured:');
    for (const err of consoleErrors) console.log(` - ${err}`);
  } else {
    console.log('No console errors.');
  }

  ws.close();
} finally {
  chrome.kill();
}
