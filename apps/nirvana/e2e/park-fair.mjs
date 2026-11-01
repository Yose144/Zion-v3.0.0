// E2E: pouť na Jupiteru — Asteroidy + tabule + ruské kolo.
//
// Dvě části:
//  1. **Logika** (bez prohlížeče): `createAsteroids` nad falešným canvasem.
//     Ověří, že se loď hýbe, střely se kreslí, skály mizí a hra končí KONEC HRY.
//  2. **Prohlížeč**: `/park` má pět skříní, Asteroidy se dají spustit a ukončit,
//     skóre jde na tabuli, Merkur je na tabuli vidět a kolo jízdu ukončí.
//
// Spustit:  node apps/nirvana/e2e/park-fair.mjs
// Předpoklad: appka `next start -p 3010` (bez NEXT_PUBLIC_NIRVANA_NET_URL).

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

const BASE = process.env.PARK_BASE ?? 'http://127.0.0.1:3010';
const EXE =
  process.env.CHROME_PATH ??
  '/Users/yeshuae/.cache/puppeteer/chrome-headless-shell/mac_arm-156.0.8078.47/chrome-headless-shell-mac-arm64/chrome-headless-shell';

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── 1) logika Asteroid ──────────────────────────────────────────────
console.log('\n== Asteroidy (logika bez prohlížeče) ==');
{
  const work = mkdtempSync(join(tmpdir(), 'park-fair-'));
  try {
    execFileSync(
      'npx',
      [
        'tsc',
        join(import.meta.dirname, '..', 'src/core/park/games/asteroids.ts'),
        '--outDir',
        work,
        // CommonJS: Node v ESM neumí načíst `./types` bez přípony a tsc ji nepřepisuje
        '--module',
        'commonjs',
        '--target',
        'es2022',
        '--moduleResolution',
        'node',
        '--skipLibCheck',
        '--noEmitOnError',
      ],
      { cwd: join(import.meta.dirname, '..'), stdio: 'pipe' },
    );
    const { createRequire } = await import('node:module');
    const requireLocal = createRequire(import.meta.url);
    const { createAsteroids } = requireLocal(join(work, 'asteroids.js'));

    // zaznamenáme si co kdo kreslí — jediná cesta, jak vidět stav hry zvenčí
    const calls = { fillRect: [], translate: [] };
    const ctx = new Proxy(
      {},
      {
        get: (_target, prop) => {
          if (prop === 'fillRect') return (...args) => calls.fillRect.push(args);
          if (prop === 'translate') return (...args) => calls.translate.push(args);
          return () => {};
        },
        set: () => true,
      },
    );
    const canvas = { width: 0, height: 0, getContext: () => ctx };

    let ended = null;
    let scored = false;
    const handle = createAsteroids(canvas, {
      onScore: (value) => {
        if (typeof value === 'number') scored = true;
      },
      onEnd: (value) => {
        ended = value;
      },
    });

    // a) po startu něco běží: skály jsou nakreslené (obrys kamenů jde přes stroke,
    //    ale střely a hvězdy přes fillRect — hvězdy jsou 1/1.6 px, střely přesně 3)
    for (let i = 0; i < 30; i++) handle.frame(1 / 30);
    check('hra po startu kreslí (hvězdy ve scéně)', calls.fillRect.length > 0, String(calls.fillRect.length));

    // b) loď se po plynu hýbe — nejprve počáteční pozice (střed), pak po tahu
    calls.translate.length = 0;
    handle.key('ArrowUp', true);
    for (let i = 0; i < 40; i++) handle.frame(1 / 30);
    handle.key('ArrowUp', false);
    const shipPositions = calls.translate.map((args) => `${args[0].toFixed(1)}|${args[1].toFixed(1)}`);
    const unique = new Set(shipPositions);
    check('tlačící se loď mění pozici', unique.size >= 2, [...unique].slice(0, 4).join(' → '));

    // c) střelba: střely se kreslí jako čtverce 3×3 (hvězdy jsou 1/1.6)
    calls.fillRect.length = 0;
    handle.key('Space', true);
    for (let i = 0; i < 12; i++) handle.frame(1 / 30);
    const bullets = calls.fillRect.filter((args) => args[2] === 3 && args[3] === 3);
    check('mezerník vystřelí', bullets.length > 0, `${bullets.length} střel`);
    handle.key('Space', false);

    // d) konec hry: ukazatel drží (ve hře = plyn + volant), takže loď naráží
    //    do skal a přijde o všechny tři životy
    handle.pointer(0.5);
    let frames = 0;
    while (ended === null && frames < 60 * 60 * 30) {
      handle.frame(1 / 30);
      frames += 1;
    }
    handle.pointer(null);
    check('hra jednou skončí (3 životy pryč)', ended !== null, `${(frames / 30).toFixed(0)} s simulace`);
    check('skóre je číslo >= 0', typeof ended === 'number' && ended >= 0, String(ended));
    check('onScore se volal', scored);

    handle.stop();
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

// ── 2) prohlížeč ────────────────────────────────────────────────────
const browser = await chromium.launch({
  executablePath: EXE,
  headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'],
});
const errors = [];
function watch(page, tag) {
  page.on('pageerror', (error) => errors.push(`${tag} pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (/401|404|favicon|net::ERR/.test(text)) return;
    errors.push(`${tag} console: ${text}`);
  });
}

// profil předem — ať test nezávisí na náhodě denní vstupenky a rekordů
const today = new Date().toISOString().slice(0, 10);
const SEED = { tokens: 5, best: { asteroids: 123 }, runs: 3, day: today, tickets: 0, challengeDay: null, rideDay: null };

try {
  console.log('\n== pouť v prohlížeči ==');
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  watch(page, 'park');
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, JSON.stringify(value)),
    ['nirvana.park.v1', SEED],
  );
  await page.goto(`${BASE}/park`, { waitUntil: 'networkidle' });

  const cabinets = await page.locator('.park-games button').allTextContents();
  check('skříně: pět her včetně Asteroid', cabinets.length === 5 && cabinets.some((t) => /Asteroid/i.test(t)),
    cabinets.join(' | '));
  const boardCols = await page.locator('.park-board-col em').allTextContents();
  check('tabule má sloupec Merkur souboj', boardCols.some((t) => /Merkur/i.test(t)), boardCols.join(', '));
  check('tabule má sloupec Asteroidy', boardCols.some((t) => /Asteroid/i.test(t)), boardCols.join(', '));
  const asteroidCard = await page.locator('.park-games button', { hasText: /Asteroid/i }).first().textContent();
  check('skříň ukazuje rekord ze profilu', /rekord 123/i.test(asteroidCard ?? ''), (asteroidCard ?? '').trim());

  const tokens = () =>
    page
      .locator('.park-tokens')
      .textContent()
      .then((text) => Number((text ?? '').replace(/\D/g, '')));

  // a) Asteroidy: spustit, chvíli hrát, ukončit → do menu (žádný žeton, nebylo dohráno)
  await page.locator('.park-games button', { hasText: /Asteroid/i }).first().click();
  await page.locator('.park-dock.is-open').waitFor({ timeout: 5000 });
  check('Asteroidy se spustily (dock otevřen)', await page.locator('.park-dock.is-open').count() === 1);
  check('dock název hry', /Asteroid/i.test((await page.locator('.park-dock-copy strong').textContent()) ?? ''));
  await page.keyboard.down('Space');
  await page.keyboard.down('ArrowUp');
  await sleep(900);
  await page.keyboard.up('ArrowUp');
  await page.keyboard.up('Space');
  await page.locator('.park-dock-copy button', { hasText: /Ukončit hru|Quit game/i }).click();
  await page.locator('.park-panel').waitFor({ timeout: 5000 });
  check('Ukončit hru vrací do menu', await page.locator('.park-panel').count() === 1);
  check('předčasný odchod žetony nedává (poctivě)', (await tokens()) === 5, String(await tokens()));

  // b) Snake: jedna klávesa doprava → had narazí do zdi → hra dohrána → +1 žeton
  await page.locator('.park-games button', { hasText: /Snake/i }).first().click();
  await page.locator('.park-dock.is-open').waitFor({ timeout: 5000 });
  await page.keyboard.press('ArrowRight');
  await page.locator('.park-dock-copy button', { hasText: /Hrát znovu|Play again/i }).waitFor({ timeout: 15000 });
  check('dohraná hra ukáže Hrát znovu', true);
  check('dohraná hra přinese žeton', (await tokens()) === 6, String(await tokens()));
  await page.locator('.park-dock-copy button', { hasText: /Ukončit hru|Quit game/i }).click();
  await page.locator('.park-panel').waitFor({ timeout: 5000 });

  // c) tabule přijme skóre z Merkura (servisní stránka, žádný prohlížeč navíc)
  const post = await fetch(`${BASE}/api/park/scores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ game: 'fight', score: 170, name: 'e2e-park' }),
  });
  check('API přijme skóre Merkura', post.status === 200, String(post.status));
  const board = await (await fetch(`${BASE}/api/park/scores`)).json();
  check('tabule Merkura má záznam', (board?.scores?.fight ?? []).some((row) => row.name === 'e2e-park'),
    JSON.stringify(board?.scores?.fight ?? []).slice(0, 120));

  // d) ruské kolo: jízda se dá ukončit (tlačítko má sdílenou třídu se střelnicí)
  await page.locator('.park-ride-btn', { hasText: /Ruské kolo|Ferris wheel/i }).click();
  await page.locator('.park-chrome button', { hasText: /Sesednout|Get off/i }).waitFor({ timeout: 5000 });
  check('jízda začne (ukáže se Sesednout)', true);
  await page.locator('.park-chrome button', { hasText: /Sesednout|Get off/i }).click();
  await page.locator('.park-notice').waitFor({ timeout: 5000 });
  const rideNotice = (await page.locator('.park-notice').textContent()) ?? '';
  check('Sesednout ukončí jízdu', /Jízda ukončena|Ride ended/i.test(rideNotice), rideNotice.trim());
  check('jízda strhne vstupné', (await tokens()) === 5, String(await tokens()));

  check('bez JS chyb na pouti', errors.length === 0, errors.join(' | '));
  await page.close();
} catch (error) {
  check('pouť E2E nespadlo', false, String(error));
  console.log(errors.join('\n'));
} finally {
  await browser.close();
}

console.log(`\npark-e2e: ${failures === 0 ? 'PASSED' : `${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
