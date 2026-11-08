// Rychlá sondа: HUD her na mobilu + domovská záložka GameHud.
// Spuštění: node apps/nirvana/e2e/_probe-hud.mjs (vyžaduje server na :3010)
let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  ({ chromium } = require(process.env.PLAYWRIGHT_MODULE ??
    '/Users/yeshuae/.nvm/versions/node/v20.19.6/lib/node_modules/playwright'));
}
import { resolveExecutable } from './_browser.mjs';

const BASE = process.env.NIRVANA_BASE ?? 'http://127.0.0.1:3010';
const browser = await chromium.launch({
  executablePath: resolveExecutable(),
  headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'],
});
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
await ctx.addCookies([{ name: 'zion_nirvana_pass', value: 'local-audit-code-2026', url: BASE }]);
const page = await ctx.newPage();
const rect = `(el) => el ? el.getBoundingClientRect().toJSON() : null`;

async function probe(path, startRe, hudSel) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 60_000 });
  const btn = page.getByRole('button', { name: startRe }).first();
  await btn.click({ timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(4000);
  return page.evaluate(`(() => {
    const hud = document.querySelector('${hudSel}');
    const ex = document.querySelector('.game-exit');
    const r = ${rect};
    return { hud: r(hud), exit: r(ex), vw: innerWidth, scrollW: document.documentElement.scrollWidth };
  })()`);
}

console.log('MARS ', JSON.stringify(await probe('/mars', /Vstoupit do arény|Enter the arena/i, '.arena-hud')));
console.log('VENUS', JSON.stringify(await probe('/venus', /Vstoupit na start|Na start|Start/i, '.race-hud')));

await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 60_000 });
await page.waitForTimeout(3000);
const home = await page.evaluate(() => {
  const a = document.querySelector('.game-hud-tabs a[href="/"]');
  return a ? { text: a.textContent.trim(), cls: a.className } : null;
});
console.log('HOME-TAB', JSON.stringify(home));
await page.screenshot({ path: '/tmp/nirvana-home-tab.png' }).catch(() => {});
await browser.close();
