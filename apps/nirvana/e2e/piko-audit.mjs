#!/usr/bin/env node
/**
 * TE PĪKO ORA — audit v prohlížeči.
 *
 * Ověřuje **funkci, ne vzhled**: že se kánoe opravdu rozjede záběry, že se
 * počítá projetá bóje, že surf převezme vlna a že na dotyku jsou čtyři
 * tlačítka. Simulace má vlastní test (`test/piko-sim.mjs`) — tenhle skript
 * kontroluje, že je **napojená** na klávesy, scénu a HUD.
 *
 * Spuštění:
 *   node apps/nirvana/e2e/piko-audit.mjs
 *   PIKO_URL=https://… node apps/nirvana/e2e/piko-audit.mjs
 */

import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { launch, PHONE } from './_browser.mjs';
import { ensureApp, grantPass } from './_app.mjs';

const repo = resolve(import.meta.dirname, '../../..');
const SHOTS = resolve(repo, '.artifacts/render/piko');

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

const ignoreNoise = (line) =>
  line.includes('401') ||
  line.includes('ws://') ||
  line.includes('wss://') ||
  line.includes('WebSocket') ||
  line.includes('/net');

async function waitFor(page, fn, timeout = 20000, label = 'stav', arg) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = await page.evaluate(fn, arg);
    if (value) return value;
    await sleep(200);
  }
  throw new Error(`timeout: ${label}`);
}

async function main() {
  const app = await ensureApp({ base: process.env.PIKO_URL ?? 'http://127.0.0.1:3010' });
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
    // Síťové 404/401 hlásí prohlížeč jako „Failed to load resource" bez URL;
    // přesnou adresu máme z `response` níž, takže tenhle šum přeskočíme.
    if (message.type() === 'error' && !message.text().includes('Failed to load resource')) {
      errors.push(message.text());
    }
  });
  page.on('response', (response) => {
    if (response.status() >= 400) failedUrls.push(`${response.status()} ${response.url()}`);
  });
  await grantPass(page, host);

  console.log('\n▸ menu laguny');
  await page.goto(`${BASE}/piko?pikoDebug=1`, { waitUntil: 'networkidle' });
  await waitFor(page, () => document.querySelectorAll('.piko-mode').length === 2, 30000, 'karty her');
  check('menu nabízí dvě hry', true);
  const title = await page.evaluate(() => document.querySelector('.piko-panel header strong')?.textContent ?? '');
  check('menu má název světa', title.includes('Pīko'), title);
  const cards = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.piko-mode strong')).map((node) => node.textContent ?? ''),
  );
  check('karty jsou kánoe a surf', cards.some((c) => c.includes('Va\'a')) && cards.some((c) => c.includes('Nalu')), cards.join(' / '));
  const docked = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a')).some((anchor) => anchor.getAttribute('href') === '/piko'),
  );
  check('lišta her nabízí Piko', docked);
  await page.screenshot({ path: `${SHOTS}/menu.png` });

  console.log('\n▸ kánoe');
  await page.click('.arena-actions .park-btn');
  await waitFor(page, () => document.querySelectorAll('canvas').length > 0, 30000, 'canvas');
  await waitFor(page, () => Boolean(window.__pikoDebug), 40000, 'debug háček');
  const start = await page.evaluate(() => window.__pikoDebug());
  check('start: šest bójí před hráčem', start.nextGate === 0 && start.mode === 'canoe');

  await page.keyboard.down('w');
  await sleep(2600);
  await page.keyboard.up('w');
  const moving = await page.evaluate(() => window.__pikoDebug());
  check('pádlo kánoi rozjede', moving.speed > 1, `speed=${moving.speed}`);
  check('kánoe pluje k útesu', moving.z < start.z - 2, `z=${moving.z} (start ${start.z})`);
  check('čas se počítá', moving.elapsed > 1.5, `t=${moving.elapsed}`);
  const hud = await page.evaluate(() => ({
    text: document.querySelector('.piko-hud')?.textContent ?? '',
    speed: document.querySelector('.piko-hud .race-speed')?.textContent ?? '',
  }));
  check('HUD je vidět', hud.text.length > 0);
  check('HUD ukazuje rychlost v km/h', /km\/h/.test(hud.speed), hud.speed);

  console.log('\n▸ pauza společným menu');
  await page.click('.game-menu-open');
  // Stav čteme až po otevření: mezi kliknutím a pauzou ještě kánoe klouže,
  // takže „před otevřením" by hlásilo falešný pohyb.
  await sleep(600);
  const pausedAt = await page.evaluate(() => window.__pikoDebug());
  await page.keyboard.down('w');
  await sleep(1200);
  await page.keyboard.up('w');
  const pausedState = await page.evaluate(() => window.__pikoDebug());
  check(
    'menu hru opravdu pozastaví',
    pausedState.x === pausedAt.x && pausedState.z === pausedAt.z && pausedState.speed === pausedAt.speed,
    `x ${pausedAt.x}→${pausedState.x}, z ${pausedAt.z}→${pausedState.z}, v ${pausedAt.speed}→${pausedState.speed}`,
  );
  await page.keyboard.press('Escape');
  await waitFor(page, () => !document.querySelector('.game-menu'), 8000, 'zavřené menu');
  await sleep(300);
  await page.keyboard.down('w');
  await sleep(900);
  await page.keyboard.up('w');
  const resumed = await page.evaluate(() => window.__pikoDebug());
  check(
    'po zavření menu hra pokračuje',
    resumed.x !== pausedState.x || resumed.z !== pausedState.z || resumed.speed !== pausedState.speed,
  );

  // bóje: teleport na první a ověření, že se započítá
  await page.evaluate(() => window.__pikoTeleport(-16, 2));
  await waitFor(page, () => window.__pikoDebug().gates === 1, 15000, 'první bóje');
  const gate = await page.evaluate(() => window.__pikoDebug());
  check('projetá bóje se počítá', gate.gates === 1 && gate.nextGate === 1);
  check('skóre roste s bójí', gate.score > 0, String(gate.score));
  await sleep(900);
  await page.screenshot({ path: `${SHOTS}/canoe.png` });

  const renderer = await page.evaluate(() => window.__pikoRenderer?.() ?? null);
  if (renderer) {
    console.log(
      `  · ${renderer.calls} draw calls · ${renderer.triangles} trojúhelníků · ` +
        `${renderer.textures} textur · ${renderer.geometries} geometrií`,
    );
    check('draw calls pod 200', renderer.calls < 200, String(renderer.calls));
    check('trojúhelníky pod 150 k', renderer.triangles < 150000, String(renderer.triangles));
  } else {
    check('rendererinfo je dostupné', false, 'window.__pikoRenderer chybí');
  }

  // dojetí kurzu: zbytek bójí v pořadí
  console.log('\n▸ dojetí kurzu');
  const gates = await page.evaluate(() => window.__pikoDebug().gatesAt);
  for (let index = 1; index < gates.length; index++) {
    await page.evaluate((point) => window.__pikoTeleport(point.x, point.z), gates[index]);
    await waitFor(page, (expected) => window.__pikoDebug().gates === expected, 15000, `bóje ${index + 1}`, index + 1);
  }
  await waitFor(page, () => Boolean(document.querySelector('.race-verdict')), 20000, 'výsledková karta');
  const finished = await page.evaluate(() => ({
    text: document.querySelector('.race-verdict')?.textContent ?? '',
    score: document.querySelector('.arena-result strong')?.textContent ?? '',
    profile: JSON.parse(localStorage.getItem('nirvana.park.v1') ?? '{}'),
  }));
  check('kurz se dojel do konce', finished.text.length > 3, finished.text);
  check('výsledek ukazuje skóre', Number(finished.score) > 0, finished.score);
  check('dohraná hra se zapsala do profilu', finished.profile.runs >= 1, JSON.stringify(finished.profile.runs));
  check('rekord hry Piko existuje', Number(finished.profile.best?.piko) > 0, JSON.stringify(finished.profile.best));
  const resultPro = await page.evaluate(() => document.querySelector('.piko-pro-result')?.textContent ?? '');
  check('výsledek hlásí rekord i medaili', /rekord|record/i.test(resultPro), resultPro);
  check('výsledek hlásí zlato', /Zlato|Gold|Oro/i.test(resultPro), resultPro);
  await page.screenshot({ path: `${SHOTS}/result.png` });

  console.log('\n▸ pas a skiny');
  await page.click('.arena-actions .park-btn.park-btn-mp');
  await waitFor(page, () => Boolean(document.querySelector('.piko-modes')), 15000, 'menu po kurzu');
  await page.click('.piko-mode:nth-of-type(1)');
  await waitFor(page, () => Boolean(document.querySelector('.piko-medals')), 15000, 'pas');
  const passportUi = await page.evaluate(() => ({
    medals: document.querySelectorAll('.piko-medal').length,
    gold: Boolean(document.querySelector('.piko-medal.is-gold.is-earned')),
    skins: document.querySelectorAll('.piko-skin').length,
    locked: document.querySelectorAll('.piko-skin.is-locked').length,
    ghostNote: document.querySelector('.piko-ghost-note')?.textContent ?? '',
  }));
  check('pas má tři medaile', passportUi.medals === 3, String(passportUi.medals));
  check('zlato z kurzu je zapsané', passportUi.gold);
  check('pas má tři skiny', passportUi.skins === 3, String(passportUi.skins));
  check('po zlatu je odemčený i třetí skin', passportUi.locked === 0, String(passportUi.locked));
  check('pas hlásí uloženého ducha', /duch|ghost|fantasma/i.test(passportUi.ghostNote), passportUi.ghostNote);

  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('.piko-skin'));
    buttons[2]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  const storedSkin = await page.evaluate(
    () => JSON.parse(localStorage.getItem('nirvana.piko.v1') ?? '{}').skins?.canoe ?? '',
  );
  check('výběr skinu se uloží', storedSkin === 'ahi', storedSkin);

  console.log('\n▸ duch a minimapa');
  await page.click('.arena-actions .park-btn');
  await waitFor(page, () => window.__pikoDebug?.().mode === 'canoe', 20000, 'kánoe znovu');
  // duch se ukáže až po rozjetí (na startu by se překrýval s hráčem)
  await page.keyboard.down('w');
  await sleep(800);
  const ghostA = await page.evaluate(() => window.__pikoGhost?.() ?? null);
  check('duch předchozí jízdy je na trati', ghostA !== null, JSON.stringify(ghostA));
  await sleep(1400);
  await page.keyboard.up('w');
  const ghostB = await page.evaluate(() => window.__pikoGhost?.() ?? null);
  check(
    'duch jede s časem',
    ghostB !== null && ghostA !== null && (ghostB.x !== ghostA.x || ghostB.z !== ghostA.z),
    JSON.stringify({ ghostA, ghostB }),
  );
  const minimap = await page.evaluate(() => ({
    map: Boolean(document.querySelector('.piko-minimap')),
    gates: document.querySelectorAll('.piko-map-gate').length,
    player: Boolean(document.querySelector('.piko-map-player')),
  }));
  check('minimapa je vidět', minimap.map && minimap.player, JSON.stringify(minimap));
  check('minimapa má šest bójí', minimap.gates === 6, String(minimap.gates));
  await page.screenshot({ path: `${SHOTS}/ghost.png` });

  // zpět do menu
  await page.evaluate(() => {
    document.querySelector('.piko-hud .game-exit')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await waitFor(page, () => !document.querySelector('.piko-hud'), 15000, 'menu po duchovi');

  console.log('\n▸ surf');
  await page.click('.piko-mode:nth-of-type(2)');
  await page.click('.arena-actions .park-btn');
  await waitFor(page, () => window.__pikoDebug?.().mode === 'surf', 20000, 'surf běh');
  // vlna startuje po 2,6 s (simulační čas)
  await waitFor(page, () => window.__pikoDebug().phase === 'riding', 25000, 'vlna');
  const riding = await page.evaluate(() => window.__pikoDebug());
  check('vlna převzala hráče', riding.phase === 'riding' && riding.wave === 1);
  check('na vlně má rychlost', riding.speed > 5, `speed=${riding.speed}`);

  await page.keyboard.down('w');
  await page.keyboard.down('a');
  await sleep(1600);
  await page.keyboard.up('a');
  await page.keyboard.up('w');
  const carved = await page.evaluate(() => window.__pikoDebug());
  check('pumpování a řez vlnu posunou', carved.distance > riding.distance, `${riding.distance} → ${carved.distance}`);
  check('balanc je vidět v datech', carved.balance <= 100 && carved.balance >= 0, String(carved.balance));
  const surfHud = await page.evaluate(() => document.querySelector('.piko-balance i')?.getAttribute('style') ?? '');
  check('HUD kreslí balanc', surfHud.includes('width'), surfHud);
  await sleep(800);
  await page.screenshot({ path: `${SHOTS}/surf.png` });

  console.log('\n▸ dojetí sady vln');
  for (let wave = 0; wave < 3; wave++) {
    await waitFor(page, () => window.__pikoDebug().phase === 'riding', 25000, 'vlna');
    // dojetí na konec vlny (v reálu to znamená ~22 s jízdy)
    await page.evaluate(() => window.__pikoSurf({ distance: 200, balance: 100 }));
    if (wave < 2) {
      await waitFor(page, (expected) => window.__pikoDebug().wave === expected, 25000, 'další vlna', wave + 2);
    }
  }
  await waitFor(page, () => Boolean(document.querySelector('.race-verdict')), 25000, 'výsledek surfu');
  const surfResult = await page.evaluate(() => ({
    text: document.querySelector('.race-verdict')?.textContent ?? '',
    waves: document.querySelectorAll('.arena-result strong')[2]?.textContent ?? '',
    score: document.querySelector('.arena-result strong')?.textContent ?? '',
  }));
  check('sada tří vln se dojela', surfResult.text.length > 3, surfResult.text);
  check('výsledek surfu ukazuje tři vlny', surfResult.waves.includes('/3'), surfResult.waves);
  check('surf zapsal skóre', Number(surfResult.score) > 0, surfResult.score);
  const surfPro = await page.evaluate(() => document.querySelector('.piko-pro-result')?.textContent ?? '');
  check('surf udělil medaili', /Bronz|Stříbro|Zlato|Bronze|Silver|Gold|Bronce|Plata|Oro/i.test(surfPro), surfPro);

  console.log('\n▸ dotyk');
  const phone = await browser.newPage({ ...PHONE });
  await grantPass(phone, host);
  await phone.goto(`${BASE}/piko`, { waitUntil: 'networkidle' });
  await waitFor(phone, () => document.querySelectorAll('.piko-mode').length === 2, 30000, 'menu na telefonu');
  await phone.click('.piko-mode:nth-of-type(2)');
  await phone.click('.arena-actions .park-btn');
  await waitFor(phone, () => Boolean(document.querySelector('.touch-pad')), 20000, 'dotykový pad');
  const keys = await phone.evaluate(() => document.querySelectorAll('.touch-key').length);
  check('na dotyku je pět tlačítek (4 směry + trik)', keys === 5, String(keys));
  const trickButton = await phone.evaluate(() => Boolean(document.querySelector('.piko-trick')));
  check('na dotyku je tlačítko triku', trickButton);

  const overflow = await phone.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  check('na telefonu není vodorovný přesah', overflow <= 2, `${overflow}px`);

  const overlap = await phone.evaluate(() => {
    const hud = document.querySelector('.piko-hud')?.getBoundingClientRect();
    const keys = Array.from(document.querySelectorAll('.touch-key'));
    if (!hud || keys.length === 0) return 'missing';
    const top = Math.min(...keys.map((node) => node.getBoundingClientRect().top));
    return hud.bottom <= top + 1 ? 'ok' : `overlap ${Math.round(hud.bottom - top)}px`;
  });
  check('HUD nepřekrývá dotykové ovládání', overlap === 'ok', String(overlap));
  await phone.screenshot({ path: `${SHOTS}/phone.png` });

  console.log('\n▸ koncept');
  await page.goto(`${BASE}/present/te-piko-ora`, { waitUntil: 'networkidle' });
  await waitFor(page, () => Boolean(document.querySelector('.present-game-cta')), 40000, 'CTA do hry');
  const href = await page.evaluate(() => document.querySelector('.present-game-cta')?.getAttribute('href') ?? '');
  check('koncept Te Pīko Ora vede do hry', href === '/piko', href);

  console.log('\n▸ konzole');
  const real = errors.filter((line) => !ignoreNoise(line));
  check('v konzoli nejsou chyby', real.length === 0, real.slice(0, 3).join(' | '));
  // 404 na soundtrack je pre-existing (soubor v repu není), 401 na `/api/auth/me`
  // je host bez ZIS session — ani jedno není chyba hry.
  const bad = failedUrls.filter(
    (line) => !line.includes('/audio/') && !line.includes('/api/auth/me'),
  );
  check('žádné chybějící assety', bad.length === 0, bad.slice(0, 3).join(' | '));

  await browser.close();
  app.stop();
  console.log(`\n${failed === 0 ? '✓' : '✗'} piko-audit: ${passed} prošlo, ${failed} selhalo\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
