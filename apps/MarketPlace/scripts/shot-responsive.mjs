// Screenshot homepage ve čtyřech šířkách — kontrola responsivity karet.
// Použití: node scripts/shot-responsive.mjs [baseUrl]
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
    for (const d of fs.readdirSync(cache).sort().reverse()) {
      const p = path.join(cache, d, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
      if (fs.existsSync(p)) return p;
    }
  }
  return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
}

const widths = [
  ['mobile-390', 390, 844],
  ['tablet-768', 768, 1024],
  ['laptop-1024', 1024, 900],
  ['desktop-1440', 1440, 1000],
];

const browser = await puppeteer.launch({ executablePath: findChrome(), headless: 'new', args: ['--no-sandbox'] });

for (const [name, w, h] of widths) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h });
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let y = 0;
      const step = () => {
        y += window.innerHeight * 0.8;
        window.scrollTo(0, y);
        if (y < document.body.scrollHeight) setTimeout(step, 100);
        else { window.scrollTo(0, 0); setTimeout(resolve, 300); }
      };
      step();
    });
  });
  await new Promise((r) => setTimeout(r, 700));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  await page.screenshot({ path: path.join(OUT, `resp-${name}.png`), fullPage: true });
  console.log(`${name}: hotovo, vodorovné přetečení=${overflow}`);
  await page.close();
}

await browser.close();
