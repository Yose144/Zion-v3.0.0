/*
 * Layout + weight audit for the landing page at four widths.
 *
 *   python3 -m http.server 4321 --directory dist &
 *   node scripts/audit-layout.mjs            # screenshots into $OUT_DIR
 *
 * Reports per-viewport transfer bytes, request count, DOM size, horizontal
 * overflow and console errors, and writes <viewport>-fold/-full screenshots.
 */
import fs from 'node:fs';
import puppeteer from 'puppeteer';

const BASE = process.env.INTRO_URL || 'http://127.0.0.1:4321';
const OUT = process.env.OUT_DIR || '/tmp/intro-audit';
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const VIEWS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'mobile', width: 390, height: 844, mobile: true },
  { name: 'small', width: 320, height: 640, mobile: true },
];

fs.mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
const summary = {};

for (const v of VIEWS) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.setCacheEnabled(false);
  await page.setViewport({
    width: v.width,
    height: v.height,
    deviceScaleFactor: 1,
    isMobile: !!v.mobile,
    hasTouch: !!v.mobile,
  });
  await page.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1200));

  const data = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] || {};
    const res = performance.getEntriesByType('resource');
    const total = res.reduce((n, r) => n + (r.transferSize || 0), 0);
    return {
      doc: nav.transferSize || 0,
      total,
      requests: res.length,
      domNodes: document.getElementsByTagName('*').length,
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
      height: document.documentElement.scrollHeight,
      canvases: document.querySelectorAll('canvas').length,
    };
  });

  await page.screenshot({ path: `${OUT}/${v.name}-full.png`, fullPage: true, captureBeyondViewport: true });
  await page.screenshot({ path: `${OUT}/${v.name}-fold.png` });
  summary[v.name] = { ...data, errors };
  await page.close();
}

console.log(JSON.stringify(summary, null, 2));
await browser.close();
