// Screenshot vánočních povrchů — desktop + mobil.
// Použití: node shot-xmas.mjs [baseUrl]
import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.argv[2] || 'http://127.0.0.1:3101';
const OUT = path.resolve('.artifacts/render/xmas-20261104');
fs.mkdirSync(OUT, { recursive: true });

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const cache = path.join(process.env.HOME, '.cache/puppeteer/chrome');
  if (fs.existsSync(cache)) {
    const dirs = fs.readdirSync(cache).sort().reverse();
    for (const d of dirs) {
      const p = path.join(cache, d, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
      if (fs.existsSync(p)) return p;
    }
  }
  return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
}

const browser = await puppeteer.launch({
  executablePath: findChrome(),
  headless: 'new',
  args: ['--no-sandbox', '--force-device-scale-factor=1'],
});

const pages = [
  ['/', 'home', true],
  ['/vanoce', 'vanoce-index', true],
  ['/vanoce/kniha-kralovstvi-srdce', 'book', true],
  ['/vanoce/kniha-kralovstvi-srdce', 'book-mobile', false],
  ['/vanoce/zion-pass', 'pass', true],
  ['/vanoce/lampion', 'lampion', true],
];

for (const [route, name, desktop] of pages) {
  const page = await browser.newPage();
  await page.setViewport(desktop ? { width: 1440, height: 1000 } : { width: 390, height: 844 });
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'cs-CZ,cs' });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(BASE + route, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 900));
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
  console.log(`${name}: ok, chyby=${errors.length}${errors.length ? ' → ' + errors.slice(0, 2).join(' | ') : ''}`);
  await page.close();
}

await browser.close();
