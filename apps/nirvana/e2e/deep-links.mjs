// Ověření deep-linků a stavů portálů v Nirvaně.
//
// Scény:
//  1) `#world=<id>` při mountu  → world portál + focus `world:<id>`
//  2) `#portal=hiran&world=`    → stale world se ignoruje, hash se přepíše
//  3) `#portal=world&world=`    → hashchange doletí na world:<id>
//  4) zavření portálu           → panel zmizí, hash se vyčistí
//  5) `#world=__NOPE__`         → portál se otevře, fokus nespadne
//
// Spustit:  node apps/nirvana/e2e/deep-links.mjs
// Předpoklad: `npm run build` v apps/nirvana.

import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveExecutable } from './_browser.mjs';

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const globalPath =
    process.env.PLAYWRIGHT_MODULE ??
    '/Users/yeshuae/.nvm/versions/node/v20.19.6/lib/node_modules/playwright';
  ({ chromium } = require(globalPath));
}

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_DIR = join(HERE, '..');
const NEXT_BIN = join(APP_DIR, '..', '..', 'node_modules', 'next', 'dist', 'bin', 'next');
const PORT = process.env.DEEP_LINKS_PORT ?? '3013';
const BASE = `http://127.0.0.1:${PORT}`;
const EXE = resolveExecutable();
const PASS_VALUE = 'local-audit-code-2026';

// Známé světy z živého API (layer<6 → orbit slot).
const WORLD_A = 'NIRVANA';
const WORLD_B = '0_0_INITIAL_RELEASE';

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const stub = spawn(process.execPath, ['-e', `
  require('node:http').createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    res.end('{"valid":true}');
  }).listen(9099, '127.0.0.1', () => console.log('stub ready'));
`], { stdio: ['ignore', 'pipe', 'pipe'] });

const app = spawn(process.execPath, [NEXT_BIN, 'start', '--port', PORT], {
  cwd: APP_DIR,
  env: { ...process.env, ARCHIVE_VERIFY_URL: 'http://127.0.0.1:9099/verify' },
  stdio: ['ignore', 'pipe', 'pipe'],
});

const cleanup = () => {
  stub.kill('SIGTERM');
  app.kill('SIGTERM');
};
process.on('exit', cleanup);

async function waitFor(fn, timeoutMs, step = 250) {
  const started = Date.now();
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() - started > timeoutMs) return null;
    await sleep(step);
  }
}

let browser;
try {
  const up = await waitFor(async () => {
    try {
      const res = await fetch(`${BASE}/api/pass`);
      return res.status === 200;
    } catch {
      return false;
    }
  }, 30_000);
  if (!up) throw new Error('appka se nespustila');

  browser = await chromium.launch({
    executablePath: EXE,
    headless: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addCookies([{ name: 'zion_nirvana_pass', value: PASS_VALUE, url: BASE }]);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  const state = async () =>
    page.evaluate(() => ({
      focus: window.__nirvanaLink?.getCurrentFocus?.() ?? null,
      hash: window.location.hash,
      portal: Boolean(document.querySelector('aside.portal')),
      worldCurrent: document.querySelector('.world-current')?.textContent?.trim() ?? null,
    }));
  // na swiftshaderu se scéna inicializuje desítky sekund —-focus se čte,
  // až engine existuje a doletí
  const waitFocus = (want, ms = 120_000) =>
    waitFor(async () => {
      const s = await state();
      return s.focus === want ? s : null;
    }, ms, 500);
  const setHash = (h) => page.evaluate((v) => { window.location.hash = v; }, h);

  // ── 1) #world=<id> při mountu ─────────────────────────────────────
  await page.goto(`${BASE}/#world=${WORLD_A}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const s1 = await waitFocus(`world:${WORLD_A}`);
  check('#world=<id> doletí na world:<id>', Boolean(s1), JSON.stringify(await state()));
  check('#world=<id> otevře world portál', (await state()).portal === true);
  check('vybraný svět označený v portálu', (await state()).worldCurrent !== null);

  // ── 2) hashchange: #portal=hiran&world=<id> — stale world ─────────
  await setHash(`#portal=hiran&world=${WORLD_A}`);
  const s2 = await waitFocus('sun', 30_000);
  check('ne-world portál letí na svůj focus (sun)', Boolean(s2), JSON.stringify(await state()));
  await sleep(600); // hash sync přepíše world parametr
  const h2 = (await state()).hash;
  check('stale world vypadne z hash', !h2.includes('world='), h2);

  // ── 3) hashchange: #portal=world&world=<id2> ──────────────────────
  await setHash(`#portal=world&world=${WORLD_B}`);
  const s3 = await waitFocus(`world:${WORLD_B}`);
  check('#portal=world&world=<id> doletí na world:<id>', Boolean(s3), JSON.stringify(await state()));

  // ── 4) zavření portálu ────────────────────────────────────────────
  const closeBtn = page.locator('aside.portal .portal-head button').first();
  await closeBtn.click({ timeout: 10_000 }).catch(() => {});
  await sleep(800);
  const s4 = await state();
  check('zavření portálu skryje panel', s4.portal === false);
  check('zavření portálu vyčistí hash', s4.hash === '' || s4.hash === '#', s4.hash);

  check('žádné JS chyby', errors.length === 0, errors.slice(0, 3).join(' | '));
  await page.close();

  // ── 5) neexistující svět — druhá čerstvá stránka ──────────────────
  const page2 = await context.newPage();
  await page2.goto(`${BASE}/#world=__NO_SUCH_WORLD__`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  // počkáme na engine (první frame), pak zkontrolujeme, že focus není world:__NO_SUCH_WORLD__
  const engineUp = await waitFor(async () => {
    const f = await page2.evaluate(() => window.__nirvanaLink?.getCurrentFocus?.() ?? null);
    return f !== null ? f : null;
  }, 120_000, 500);
  const s5 = await page2.evaluate(() => ({
    focus: window.__nirvanaLink?.getCurrentFocus?.() ?? null,
    portal: Boolean(document.querySelector('aside.portal')),
  }));
  check('scéna naběhla i s neznámým světem', Boolean(engineUp), String(engineUp));
  check('neznámý svět nevede na world:__NO_SUCH_WORLD__', s5.focus !== 'world:__NO_SUCH_WORLD__', String(s5.focus));
  check('world portál se stejně otevřel', s5.portal === true);
  await page2.close();
} catch (error) {
  check('ověření nespadlo', false, String(error));
} finally {
  if (browser) await browser.close();
}

console.log(`\ndeep-links: ${failures === 0 ? 'PASSED' : `${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
