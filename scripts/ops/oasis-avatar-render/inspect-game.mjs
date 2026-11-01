// Kontrola, že herní model avatarů (po přechodu na merged geometrii) vypadá dobře.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer');

const BASE = process.env.BASE ?? 'http://127.0.0.1:3033';
const OUT = process.env.OUT ?? '.artifacts/render/oasis-avatars-20261101';

const browser = await puppeteer.launch({
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal', '--hide-scrollbars'],
  defaultViewport: { width: 1280, height: 900, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

await page.goto(`${BASE}/avatars`, { waitUntil: 'networkidle2', timeout: 120_000 });
await new Promise((r) => setTimeout(r, 6000));
await page.screenshot({ path: `${OUT}/game-avatars.png` });

const info = await page.evaluate(() => ({
  canvases: document.querySelectorAll('canvas').length,
  title: document.querySelector('h1')?.textContent?.slice(0, 80) ?? null,
}));

console.log(JSON.stringify({ ...info, errors: errors.slice(0, 6) }, null, 2));
await browser.close();
