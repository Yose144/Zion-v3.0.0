// Ověření scény vesmíru: sjednocené linky + brána připnutá k Jupiteru.
//
// Co dělá:
//  1) lokální stub pass ověřovatele (:9099) + appka s ARCHIVE_VERIFY_URL
//  2) headless Chromium s pass cookie → `/?sceneAudit=1`
//  3) screenshot základního záběru (dráhy) → klik na Jupiter → screenshot s bránou
//  4) vypíše `window.__projectScene` (draw calls / textury) a chyby z konzole
//
// Spustit:  node apps/nirvana/e2e/universe-links.mjs
// Předpoklad: `npm run build` v apps/nirvana (build bez NEXT_PUBLIC_NIRVANA_NET_URL).

import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
/** Vlastní port — 3010/3011 může držet paralelní session, ta se nesmí zabít. */
const PORT = process.env.UNIVERSE_LINKS_PORT ?? '3012';
const BASE = `http://127.0.0.1:${PORT}`;
const EXE =
  process.env.CHROME_PATH ??
  '/Users/yeshuae/.cache/puppeteer/chrome-headless-shell/mac_arm-156.0.8078.47/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const SHOTS = join(APP_DIR, '.artifacts', 'render', 'universe-20261102');
const PASS_VALUE = 'local-audit-code-2026'; // délka > 8, jinak verifyPassCode odmítne

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── stub pass ověřovatele ────────────────────────────────────────────
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
  // čekáme až appka odpovídá
  const up = await waitFor(async () => {
    try {
      const res = await fetch(`${BASE}/api/pass`);
      return res.status === 200;
    } catch {
      return false;
    }
  }, 30_000);
  if (!up) throw new Error('appka se nespustila');
  mkdirSync(SHOTS, { recursive: true });

  browser = await chromium.launch({
    executablePath: EXE,
    headless: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addCookies([
    { name: 'zion_nirvana_pass', value: PASS_VALUE, url: BASE },
  ]);
  const page = await context.newPage();

  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (/401|404|favicon|net::ERR|WebSocket/.test(text)) return;
    errors.push(`console: ${text}`);
  });

  await page.goto(`${BASE}/?sceneAudit=1`, { waitUntil: 'networkidle', timeout: 60_000 });

  // R3F mountuje až po GL init — na swiftshaderu desítky vteřin.
  // Čekáme na `calls > 0`: první snímek hooku počítá ještě před renderem.
  const audit = await waitFor(
    () =>
      page.evaluate(() => {
        const value = window.__projectScene;
        return value && value.calls > 0 ? value : null;
      }),
    180_000,
    500,
  );
  check('scéna se vyrenderovala (audit hook)', Boolean(audit), 'timeout 180 s / žádný vykreslený snímek');
  if (audit) {
    console.log(`     audit: calls=${audit.calls} tris=${audit.triangles} tex=${audit.textures} tier=${audit.tier}`);
    check('draw calls v rozumném pásmu', audit.calls > 0 && audit.calls < 600, String(audit.calls));
  }
  // trochu času na dopočet textur (Jupiter, planety)
  await sleep(4000);
  await page.screenshot({ path: join(SHOTS, 'links-earth.png'), timeout: 60_000 });
  check('screenshot: základní záběr (dráhy)', true);

  // fokus na Jupiter — hluboký odkaz #portal=park (Shell ho mapuje na focus jupiter)
  await page.evaluate(() => {
    window.location.hash = '#portal=park';
  });
  await sleep(5000); // přelet kamery (1,8 s) + rezerva na billboard brány a textury
  await page.screenshot({ path: join(SHOTS, 'links-jupiter.png'), timeout: 60_000 });
  check('screenshot: fokus na Jupiter (brána u planety)', true);
  const chipVisible = await page
    .locator('span.planet-chip', { hasText: 'Jupiter' })
    .isVisible()
    .catch(() => false);
  check('po přeletu je Jupiter ve záběru (chip vidět)', chipVisible);

  check('bez chyb v konzoli', errors.length === 0, errors.join(' | '));
} catch (error) {
  check('ověření nespadlo', false, String(error));
} finally {
  if (browser) await browser.close();
  cleanup();
}

console.log(`\nuniverse-links: ${failures === 0 ? 'PASSED' : `${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
