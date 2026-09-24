import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Headless-Chrome screenshot harness for the factory branding medallions.
 *
 * Requires the dev server to be running (`npm run dev`). Captures the pedestal
 * and exterior views so the logo placement can be inspected without a browser.
 *
 * Configuration (all optional, via environment variables):
 * - CHROME_BIN     path to the Chrome/Chromium binary
 * - APP_URL        dev server URL to capture
 * - LOGO_SHOT_DIR  directory where the PNGs are written
 */

const CHROME_BIN =
  process.env.CHROME_BIN ??
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const APP_URL = process.env.APP_URL ?? 'http://localhost:5173/';
const APP_PORT = new URL(APP_URL).port || '80';
const OUT_DIR = process.env.LOGO_SHOT_DIR ?? path.resolve('.artifacts/logos');

fs.mkdirSync(OUT_DIR, { recursive: true });

const chrome = spawn(CHROME_BIN, [
  '--headless=new',
  '--remote-debugging-port=9222',
  '--use-gl=angle',
  '--use-angle=metal',
  '--window-size=1600,900',
  APP_URL,
]);

await new Promise((r) => setTimeout(r, 2000));

try {
  await fetch('http://127.0.0.1:9222/json/version');

  const listRes = await fetch('http://127.0.0.1:9222/json/list');
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

  // Wait 3s for 3D assets to load
  await new Promise((r) => setTimeout(r, 3000));

  const takeShot = async (name) => {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT_DIR, `${name}.png`), Buffer.from(res.data, 'base64'));
    console.log(`Saved ${path.join(OUT_DIR, `${name}.png`)}`);
  };

  // 1. Initial view showing Pedestal Badge & UI Topbar Logo
  await takeShot('logo_pedestal_view');

  // 2. Exterior view showing Main Facade Logo
  await send('Runtime.evaluate', {
    expression: 'document.querySelector("[data-goto=panoramica]").click()',
  });
  await new Promise((r) => setTimeout(r, 2200));
  await takeShot('logo_exterior_view');

  ws.close();
} finally {
  chrome.kill();
}
