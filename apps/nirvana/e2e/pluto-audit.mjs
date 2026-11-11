#!/usr/bin/env node
/**
 * PLUTO — SRDCE NA OKRAJI, audit v prohlížeči.
 *
 * Ověřuje **funkci, ne vzhled**: že hráč opravdu chodí, že teplo ubývá
 * daleko od ohně a dobíjí se u lampy, že stání u lampy ji zapálí, že se
 * hra dohraje devíti lampami a uloží. Simulace má vlastní test
 * (`test/pluto-light.mjs`) — tenhle skript kontroluje, že je **napojená**
 * na klávesy, scénu, HUD a progresi.
 *
 * Spuštění:
 *   node apps/nirvana/e2e/pluto-audit.mjs
 *   PLUTO_URL=https://… node apps/nirvana/e2e/pluto-audit.mjs
 */

import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { launch, PHONE } from './_browser.mjs';
import { ensureApp, grantPass } from './_app.mjs';

const repo = resolve(import.meta.dirname, '../../..');
const SHOTS = resolve(repo, '.artifacts/render/pluto');

let passed = 0;
let failed = 0;
const check = (name, ok, detail = '') => {
  if (ok) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function waitFor(page, fn, timeout = 20000, label = 'stav', arg) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = await page.evaluate(fn, arg);
    if (value) return value;
    await sleep(150);
  }
  throw new Error(`timeout: ${label}`);
}

const debug = (page) => page.evaluate(() => window.__plutoDebug?.state() ?? null);

async function main() {
  const app = await ensureApp({ base: process.env.PLUTO_URL ?? 'http://127.0.0.1:3010' });
  const BASE = app.base;
  const host = new URL(BASE).hostname;

  await mkdir(SHOTS, { recursive: true });
  if (!process.env.ZION_GPU) process.env.ZION_GPU = 'metal';
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  const failedUrls = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('Failed to load resource')) {
      errors.push(message.text());
    }
  });
  page.on('response', (response) => {
    if (response.status() >= 400) failedUrls.push(`${response.status()} ${response.url()}`);
  });
  await grantPass(page, host);

  console.log('\n▸ menu planety');
  await page.goto(`${BASE}/pluto?plutoDebug=1`, { waitUntil: 'networkidle' });
  await waitFor(page, () => Boolean(document.querySelector('.pluto-panel')), 30000, 'panel menu');
  const menu = await page.evaluate(() => ({
    title: document.querySelector('.pluto-panel header strong')?.textContent ?? '',
    lamps: document.querySelectorAll('.pluto-lamps-list li').length,
    facts: document.querySelectorAll('.planet-facts dd').length,
    start: document.querySelector('.arena-actions .park-btn')?.textContent ?? '',
    docked: Array.from(document.querySelectorAll('a')).some((a) => a.getAttribute('href') === '/pluto'),
  }));
  check('menu má název světa', /Srdce|Heart/i.test(menu.title), menu.title);
  check('menu vypisuje devět lamp', menu.lamps === 9, String(menu.lamps));
  check('dosier planety zůstalo (6 faktů)', menu.facts === 6, String(menu.facts));
  check('menu má start', menu.start.trim().length > 0, menu.start);
  check('lišta her nabízí Pluto', menu.docked);
  await page.screenshot({ path: `${SHOTS}/menu.png` });

  console.log('\n▸ chůze a teplo');
  await page.click('.arena-actions .park-btn');
  await waitFor(page, () => Boolean(document.querySelector('.pluto-hud')), 30000, 'HUD');
  await waitFor(page, () => Boolean(window.__plutoDebug), 45000, 'debug háček');
  const start = await debug(page);
  check('start: plné teplo', start.warmth > 95, String(start.warmth));
  check('start: nic nesvítí', start.lamps === 0, String(start.lamps));

  await page.keyboard.down('w');
  await sleep(1400);
  await page.keyboard.up('w');
  const walked = await debug(page);
  check('W posune hráče na sever', walked.z < start.z - 3, `z ${start.z} → ${walked.z}`);
  check('cesta ubírá teplo', walked.warmth < start.warmth, `${start.warmth} → ${walked.warmth}`);
  const hud = await page.evaluate(() => ({
    lamps: document.querySelector('.pluto-lamps')?.textContent ?? '',
    reach: document.querySelector('.pluto-reach')?.textContent ?? '',
    bar: document.querySelector('.pluto-warmth-track i')?.getBoundingClientRect().width ?? 0,
  }));
  check('HUD ukazuje lampy 0/9', /0\s*\/\s*9/.test(hud.lamps.replace(/\s+/g, ' ')), hud.lamps);
  check('HUD ukazuje dosah v metrech', /\d+\s*m/.test(hud.reach), hud.reach);
  check('bar tepla není prázdný', hud.bar > 5, String(hud.bar));
  await page.screenshot({ path: `${SHOTS}/walk.png` });

  console.log('\n▸ zapálení lampy');
  // lampa 1 je na (0, 38) — teleport a chvíle stání
  await page.evaluate(() => window.__plutoDebug.teleport(0, 38));
  await waitFor(page, () => window.__plutoDebug.state().lamps === 1, 15000, 'první lampa');
  const lit = await debug(page);
  check('stání u lampy ji zapálí', lit.lamps === 1, String(lit.lamps));
  const litHud = await page.evaluate(() => ({
    lamps: document.querySelector('.pluto-lamps')?.textContent ?? '',
    toast: document.querySelector('.pluto-toast')?.textContent ?? '',
  }));
  check('HUD ukazuje 1/9', /1\s*\/\s*9/.test(litHud.lamps.replace(/\s+/g, ' ')), litHud.lamps);
  check('zapálení se ohlásí', /lampa|lamp/i.test(litHud.toast), litHud.toast);

  // u zapálené lampy se teplo dobíjí
  await page.evaluate(() => window.__plutoDebug.freeze(70));
  const low = await debug(page);
  await page.evaluate(() => window.__plutoDebug.teleport(0, 38));
  await sleep(2000);
  const warmed = await debug(page);
  check('u lampy se teplo dobíjí', warmed.warmth > low.warmth + 3, `${low.warmth} → ${warmed.warmth}`);

  console.log('\n▸ pauza společným menu');
  await page.click('.game-menu-open');
  await sleep(600);
  const pausedAt = await debug(page);
  await page.keyboard.down('w');
  await sleep(1000);
  await page.keyboard.up('w');
  const paused = await debug(page);
  check(
    'menu hru opravdu pozastaví',
    paused.x === pausedAt.x && paused.z === pausedAt.z,
    `${pausedAt.z} → ${paused.z}`,
  );
  await page.keyboard.press('Escape');
  await waitFor(page, () => !document.querySelector('.game-menu'), 8000, 'zavřené menu');
  await sleep(400);

  console.log('\n▸ celé srdce');
  const lamps = await page.evaluate(() => window.__plutoDebug.lamps ?? null);
  // zbylých osm lamp: teleport na každou a počkat na zapálení
  for (let i = 1; i < 9; i += 1) {
    const point = lamps?.[i] ?? null;
    if (!point) throw new Error('__plutoDebug.lamps chybí');
    await page.evaluate((p) => window.__plutoDebug.teleport(p.x, p.z), point);
    await waitFor(page, (expected) => window.__plutoDebug.state().lamps === expected, 15000, `lampa ${i + 1}`, i + 1);
  }
  await waitFor(page, () => Boolean(document.querySelector('.race-verdict')), 20000, 'výsledková karta');
  const finished = await page.evaluate(() => ({
    verdict: document.querySelector('.race-verdict')?.textContent ?? '',
    win: Boolean(document.querySelector('.race-verdict.win')),
    values: Array.from(document.querySelectorAll('.arena-result strong')).map((n) => n.textContent ?? ''),
    profile: JSON.parse(localStorage.getItem('nirvana.park.v1') ?? '{}'),
  }));
  check('devět lamp ukončí hru', /Srdce svítí|heart is lit/i.test(finished.verdict), finished.verdict);
  check('výsledek je označený jako výhra', finished.win);
  check('výsledek ukazuje 9/9', finished.values.some((v) => v.replace(/\s/g, '') === '9/9'), finished.values.join(' · '));
  check('dohraná hra se zapsala do profilu', finished.profile.runs >= 1, String(finished.profile.runs));
  check('rekord hry Pluto existuje', Number(finished.profile.best?.pluto) > 500, JSON.stringify(finished.profile.best));
  await page.screenshot({ path: `${SHOTS}/result.png` });

  const board = await fetch(`${BASE}/api/park/scores`, {
    headers: { cookie: 'zion_nirvana_pass=ZAP-AUDIT0000000' },
  }).then((r) => r.json());
  check(
    'skóre je na tabuli',
    Array.isArray(board.scores?.pluto) && board.scores.pluto.length > 0,
    JSON.stringify(board.scores?.pluto ?? null),
  );

  console.log('\n▸ dotyk');
  const phone = await browser.newPage(PHONE);
  await phone.context?.().addCookies?.([{ name: 'zion_nirvana_pass', value: 'ZAP-AUDIT0000000', domain: host, path: '/' }]);
  await phone.setCookie?.({ name: 'zion_nirvana_pass', value: 'ZAP-AUDIT0000000', domain: host, path: '/' });
  await phone.goto(`${BASE}/pluto?plutoDebug=1`, { waitUntil: 'networkidle' });
  await waitFor(phone, () => Boolean(document.querySelector('.pluto-panel')), 30000, 'menu na telefonu');
  await phone.click('.arena-actions .park-btn');
  await waitFor(phone, () => document.querySelectorAll('.touch-pad .touch-key').length === 4, 30000, 'čtyři tlačítka');
  const touch = await phone.evaluate(() => ({
    keys: document.querySelectorAll('.touch-pad .touch-key').length,
    hudTop: document.querySelector('.pluto-hud')?.getBoundingClientRect().top ?? -1,
    warmthTop: document.querySelector('.pluto-warmth')?.getBoundingClientRect().top ?? -1,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  check('dotyk má čtyři tlačítka', touch.keys === 4, String(touch.keys));
  check('HUD je na dotyku nahoře', touch.hudTop >= 0 && touch.hudTop < 200, String(touch.hudTop));
  check('teplo nepřekrývá HUD', touch.warmthTop > touch.hudTop + 20, `${touch.hudTop} / ${touch.warmthTop}`);
  check('stránka nepřetéká do stran', touch.overflow <= 1, String(touch.overflow));
  await phone.screenshot({ path: `${SHOTS}/phone.png` });
  const phoneBefore = await phone.evaluate(() => document.querySelector('.pluto-lamps')?.textContent ?? '');
  await phone.evaluate(() => {
    const button = document.querySelector('.touch-pad .touch-key.is-up');
    button?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  });
  await sleep(1200);
  await phone.evaluate(() => {
    const button = document.querySelector('.touch-pad .touch-key.is-up');
    button?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
  });
  const phoneMoved = await phone.evaluate(() => window.__plutoDebug?.state().z ?? 0);
  check('dotykové tlačítko hýbe hráčem', phoneMoved < 58, `${phoneBefore} → z=${phoneMoved}`);

  check('žádná chyba v konzoli', errors.length === 0, errors.slice(0, 3).join(' | '));
  check(
    'žádný 4xx/5xx',
    failedUrls.filter((row) => !row.includes('401')).length === 0,
    failedUrls.slice(0, 3).join(' | '),
  );

  await browser.close();
  await app.stop();

  console.log(`\n${failed === 0 ? 'PASSED' : 'FAILED'}: ${passed}/${passed + failed} kontrol`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
