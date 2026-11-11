#!/usr/bin/env node
/**
 * NEPTUN — HLUBINA, audit v prohlížeči.
 *
 * Ověřuje **funkci, ne vzhled**: že zvon opravdu klesá, že `W` zrychlí sestup,
 * že kormidlo posune zvon, že se světlo započítá, že se sestup dohraje a
 * uloží, a že na dotyku jsou čtyři tlačítka. Simulace má vlastní test
 * (`test/neptun-dive.mjs`) — tenhle skript kontroluje, že je **napojená**
 * na klávesy, scénu, HUD a progresi.
 *
 * Spuštění:
 *   node apps/nirvana/e2e/neptune-audit.mjs
 *   NEPTUNE_URL=https://… node apps/nirvana/e2e/neptune-audit.mjs
 */

import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { launch, PHONE } from './_browser.mjs';
import { ensureApp, grantPass } from './_app.mjs';

const repo = resolve(import.meta.dirname, '../../..');
const SHOTS = resolve(repo, '.artifacts/render/neptune');

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

const debug = (page) => page.evaluate(() => window.__neptuneDebug?.state() ?? null);

async function main() {
  const app = await ensureApp({ base: process.env.NEPTUNE_URL ?? 'http://127.0.0.1:3010' });
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
  await page.goto(`${BASE}/neptune?neptuneDebug=1`, { waitUntil: 'networkidle' });
  await waitFor(page, () => Boolean(document.querySelector('.neptune-panel')), 30000, 'panel menu');
  const menu = await page.evaluate(() => ({
    title: document.querySelector('.neptune-panel header strong')?.textContent ?? '',
    decks: document.querySelectorAll('.neptune-deck').length,
    facts: document.querySelectorAll('.neptune-facts dd').length,
    keys: document.querySelectorAll('.arena-keys li').length,
    start: document.querySelector('.arena-actions .park-btn')?.textContent ?? '',
    docked: Array.from(document.querySelectorAll('a')).some((a) => a.getAttribute('href') === '/neptune'),
  }));
  check('menu má název světa', /Hlubina|Deep/.test(menu.title), menu.title);
  check('dosier planety zůstalo (6 faktů)', menu.facts === 6, String(menu.facts));
  check('menu vypisuje pět vrstev', menu.decks === 5, String(menu.decks));
  check('menu má tři klávesy', menu.keys === 3, String(menu.keys));
  check('menu má start', menu.start.trim().length > 0, menu.start);
  check('lišta her nabízí Neptun', menu.docked);
  await page.screenshot({ path: `${SHOTS}/menu.png` });

  console.log('\n▸ sestup');
  await page.click('.arena-actions .park-btn');
  await waitFor(page, () => Boolean(document.querySelector('.neptune-hud')), 30000, 'HUD');
  await waitFor(page, () => Boolean(window.__neptuneDebug), 45000, 'debug háček');
  const start = await debug(page);
  // háček se registruje po init WebGL, takže zvon už pár metrů klesl — test
  // nesmí měřit „přesně nula“, jen že start nebyl uprostřed sestupu
  check('start: hloubka u hladiny', start.depth < 6, String(start.depth));
  check('start: plná lucerna', start.energy > 95, String(start.energy));
  check('start: plný plášť', start.hull === 100, String(start.hull));

  const before = await debug(page);
  await sleep(1500);
  const passive = await debug(page);
  check('zvon klesá i bez vstupu', passive.depth > before.depth + 2, `${before.depth} → ${passive.depth}`);

  await page.keyboard.down('w');
  await sleep(1400);
  const diving = await debug(page);
  await page.keyboard.up('w');
  const passiveRate = (passive.depth - before.depth) / 1.5;
  const diveRate = (diving.depth - passive.depth) / 1.4;
  check('W zrychlí sestup', diveRate > passiveRate * 1.2, `${passiveRate.toFixed(1)} vs ${diveRate.toFixed(1)} m/s`);

  const hud = await page.evaluate(() => ({
    depth: document.querySelector('.neptune-depth-value')?.textContent ?? '',
    text: document.querySelector('.neptune-hud')?.textContent ?? '',
    gauges: document.querySelectorAll('.neptune-gauge').length,
  }));
  check('HUD ukazuje hloubku v metrech', Number(hud.depth) > 0, hud.depth);
  check('HUD má dvě bary (lucerna, plášť)', hud.gauges === 2, String(hud.gauges));

  console.log('\n▸ kormidlo a světla');
  const beforeSteer = await debug(page);
  await page.keyboard.down('a');
  await sleep(900);
  await page.keyboard.up('a');
  const steered = await debug(page);
  check('kormidlo posune zvon do strany', Math.abs(steered.x - beforeSteer.x) > 1.5, `x ${beforeSteer.x} → ${steered.x}`);

  // teleport k prvnímu světlu (simulace je stejná, jen se nemusí doletět)
  const mote = await page.evaluate(() => {
    const lights = [
      { depth: 70, x: -6 },
      { depth: 120, x: 5 },
    ];
    return lights[0];
  });
  await page.evaluate((point) => window.__neptuneDebug.teleport(point.depth - 4, point.x), mote);
  await sleep(700);
  const collected = await debug(page);
  check('světlo se započítá', collected.lights === 1, String(collected.lights));
  const lightHud = await page.evaluate(
    () => document.querySelector('.neptune-lights')?.textContent ?? '',
  );
  check('HUD ukazuje 1/15', /1\s*\/\s*15/.test(lightHud.replace(/\s+/g, ' ')), lightHud);
  await page.screenshot({ path: `${SHOTS}/dive.png` });

  console.log('\n▸ pauza společným menu');
  await page.click('.game-menu-open');
  await sleep(600);
  const pausedAt = await debug(page);
  await page.keyboard.down('w');
  await sleep(1000);
  await page.keyboard.up('w');
  const paused = await debug(page);
  check('menu sestup opravdu pozastaví', paused.depth === pausedAt.depth, `${pausedAt.depth} → ${paused.depth}`);
  await page.keyboard.press('Escape');
  await waitFor(page, () => !document.querySelector('.game-menu'), 8000, 'zavřené menu');
  await sleep(500);
  const resumed = await debug(page);
  check('po zavření menu sestup pokračuje', resumed.depth > paused.depth, `${paused.depth} → ${resumed.depth}`);

  console.log('\n▸ hluboké vrstvy');
  await page.evaluate(() => window.__neptuneDebug.teleport(660, 0));
  await sleep(2400);
  const deep = await page.evaluate(() => ({
    depth: window.__neptuneDebug.state().depth,
    energy: window.__neptuneDebug.state().energy,
    deck: document.querySelector('.neptune-depth em')?.textContent ?? '',
    bar: document.querySelector('.neptune-gauge.is-energy .neptune-track i')?.getBoundingClientRect().width ?? 0,
    track: document.querySelector('.neptune-gauge.is-energy .neptune-track')?.getBoundingClientRect().width ?? 0,
  }));
  console.log(`  · ${deep.depth} m · lucerna ${deep.energy} · bar ${Math.round(deep.bar)}/${Math.round(deep.track)} px`);
  // bar musí odpovídat stavu — jinak HUD lže o tom, kolik zbývá
  const expectedBar = Math.min(1, deep.energy / 140);
  const actualBar = deep.track > 0 ? deep.bar / deep.track : 0;
  check(
    'bar lucerny odpovídá stavu',
    Math.abs(actualBar - expectedBar) < 0.06,
    `${actualBar.toFixed(2)} vs ${expectedBar.toFixed(2)} (${deep.energy})`,
  );
  check('hloubka přejde do iontové tmy', /Iontová|Ion/i.test(deep.deck), deep.deck);
  check('HUD ukazuje zbývající metry', /\d+ m/.test(deep.deck), deep.deck);
  await page.screenshot({ path: `${SHOTS}/deep.png` });

  console.log('\n▸ dojezd na dno');
  await page.evaluate(() => window.__neptuneDebug.teleport(892, 0));
  await page.keyboard.down('w');
  await waitFor(page, () => Boolean(document.querySelector('.race-verdict')), 25000, 'výsledková karta');
  await page.keyboard.up('w');
  const finished = await page.evaluate(() => ({
    verdict: document.querySelector('.race-verdict')?.textContent ?? '',
    win: Boolean(document.querySelector('.race-verdict.win')),
    values: Array.from(document.querySelectorAll('.arena-result strong')).map((n) => n.textContent ?? ''),
    profile: JSON.parse(localStorage.getItem('nirvana.park.v1') ?? '{}'),
  }));
  check('dno ukončí sestup', /Dno|bottom/i.test(finished.verdict), finished.verdict);
  check('výsledek je označený jako výhra', finished.win);
  check('výsledek ukazuje 900 m', finished.values.some((v) => v.includes('900')), finished.values.join(' · '));
  check('dohraná hra se zapsala do profilu', finished.profile.runs >= 1, String(finished.profile.runs));
  check('rekord hry Neptun existuje', Number(finished.profile.best?.neptune) > 900, JSON.stringify(finished.profile.best));
  await sleep(300);
  await page.screenshot({ path: `${SHOTS}/result.png` });

  const board = await fetch(`${BASE}/api/park/scores`, {
    headers: { cookie: 'zion_nirvana_pass=ZAP-AUDIT0000000' },
  }).then((r) => r.json());
  check(
    'skóre je na tabuli',
    Array.isArray(board.scores?.neptune) && board.scores.neptune.length > 0,
    JSON.stringify(board.scores?.neptune ?? null),
  );

  console.log('\n▸ dotyk');
  const phone = await browser.newPage(PHONE);
  await phone.context?.().addCookies?.([{ name: 'zion_nirvana_pass', value: 'ZAP-AUDIT0000000', domain: host, path: '/' }]);
  await phone.setCookie?.({ name: 'zion_nirvana_pass', value: 'ZAP-AUDIT0000000', domain: host, path: '/' });
  await phone.goto(`${BASE}/neptune`, { waitUntil: 'networkidle' });
  await waitFor(phone, () => Boolean(document.querySelector('.neptune-panel')), 30000, 'menu na telefonu');
  await phone.click('.arena-actions .park-btn');
  await waitFor(phone, () => document.querySelectorAll('.touch-pad .touch-key').length === 4, 30000, 'čtyři tlačítka');
  const touch = await phone.evaluate(() => ({
    keys: document.querySelectorAll('.touch-pad .touch-key').length,
    hudTop: document.querySelector('.neptune-hud')?.getBoundingClientRect().top ?? -1,
    depthTop: document.querySelector('.neptune-depth')?.getBoundingClientRect().top ?? -1,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  check('dotyk má čtyři tlačítka', touch.keys === 4, String(touch.keys));
  check('HUD je na dotyku nahoře', touch.hudTop >= 0 && touch.hudTop < 200, String(touch.hudTop));
  check('hloubka nepřekrývá HUD', touch.depthTop > touch.hudTop + 20, `${touch.hudTop} / ${touch.depthTop}`);
  check('stránka nepřetéká do stran', touch.overflow <= 1, String(touch.overflow));
  await phone.screenshot({ path: `${SHOTS}/phone.png` });
  // tlačítko opravdu posílá klávesu — hloubka musí růst
  const phoneBefore = await phone.evaluate(() => document.querySelector('.neptune-depth-value')?.textContent ?? '0');
  await phone.evaluate(() => {
    const button = document.querySelector('.touch-pad .touch-key.is-up');
    button?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  });
  await sleep(900);
  await phone.evaluate(() => {
    const button = document.querySelector('.touch-pad .touch-key.is-up');
    button?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
  });
  const phoneAfter = await phone.evaluate(() => document.querySelector('.neptune-depth-value')?.textContent ?? '0');
  check('dotykové tlačítko hýbe sestupem', Number(phoneAfter) > Number(phoneBefore), `${phoneBefore} → ${phoneAfter}`);

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
