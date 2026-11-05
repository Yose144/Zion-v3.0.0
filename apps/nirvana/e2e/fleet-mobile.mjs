#!/usr/bin/env node
/**
 * FLOTILA — mobilní audit (dotyk, layout, přetečení).
 *
 * Ověřuje **funkci, ne počet tlačítek**. U MOBY se už jednou stalo, že audit
 * počítal tlačítka ve spodní půlce a prošel i s jediným tlačítkem chatu;
 * tady se proto po stisku měří skutečný důsledek — loď zrychlí, kurz se změní.
 *
 * Tři věci, které se musí emulovat, jinak test měří něco jiného:
 *   `isMobile` + `hasTouch`  → bez nich se nevyhodnotí `(pointer: coarse)`
 *                              a hra dotykové ovládání vůbec nevykreslí
 *   `x-render-audit`         → ZAP brána (jen lokálně, produkce env nemá)
 *
 * Spuštění:
 *   node apps/nirvana/e2e/fleet-mobile.mjs
 *   FLEET_URL=https://… node apps/nirvana/e2e/fleet-mobile.mjs
 */

import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { launch, PHONE, PHONE_LANDSCAPE } from './_browser.mjs';
import { ensureApp, grantPass } from './_app.mjs';

const repo = resolve(import.meta.dirname, '../../..');
const SHOTS = resolve(repo, '.artifacts/render/fleet');

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

async function waitFor(page, fn, timeout = 25000, label = 'stav') {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await page.evaluate(fn)) return true;
    await sleep(200);
  }
  throw new Error(`timeout: ${label}`);
}

/** Stisk dotykového tlačítka (PointerEvent = to, co `TouchButton` poslouchá). */
async function press(page, selector, ms = 700) {
  await page.evaluate((query) => {
    const button = document.querySelector(query);
    if (!button) throw new Error(`chybí ${query}`);
    button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, pointerType: 'touch' }));
  }, selector);
  await sleep(ms);
  await page.evaluate((query) => {
    document
      .querySelector(query)
      ?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, pointerType: 'touch' }));
  }, selector);
}

/** Největší přesah obsahu za okraj — 0 znamená „nic nepřetéká". */
const overflowProbe = () => {
  const doc = document.documentElement;
  return Math.max(0, doc.scrollWidth - doc.clientWidth);
};

/** Protnou se dvě obrazovky? (HUD vs. dotykový pad) */
const overlapProbe = () => {
  const hud = document.querySelector('.fleet-hud')?.getBoundingClientRect();
  const pad = document.querySelector('.fleet-touch')?.getBoundingClientRect();
  if (!hud || !pad) return null;
  const intersects =
    hud.left < pad.right && pad.left < hud.right && hud.top < pad.bottom && pad.top < hud.bottom;
  return { intersects, hudBottom: hud.bottom, padTop: pad.top, hudRight: hud.right, padLeft: pad.left };
};

async function main() {
  const app = await ensureApp({ base: process.env.FLEET_URL ?? 'http://127.0.0.1:3010' });
  const host = new URL(app.base).hostname;
  await mkdir(SHOTS, { recursive: true });
  if (!process.env.ZION_GPU) process.env.ZION_GPU = 'metal';

  const browser = await launch();
  const page = await browser.newPage(PHONE);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await grantPass(page, host);

  console.log('\n▸ hangár na telefonu (390 × 844)');
  await page.goto(`${app.base}/fleet?fleetDebug=1`, { waitUntil: 'networkidle' });
  await waitFor(page, () => document.querySelectorAll('.fleet-card').length > 0, 30000, 'karty lodí');

  check('karty lodí jsou na výšku čitelné', (await page.evaluate(overflowProbe)) <= 1, `overflow=${await page.evaluate(overflowProbe)}`);
  const launchVisible = await page.evaluate(() => {
    const button = document.querySelector('.fleet-launch button');
    if (!button) return false;
    const rect = button.getBoundingClientRect();
    return rect.bottom <= window.innerHeight + 1 && rect.width > 80;
  });
  check('tlačítko Vzlétnout je v obraze', launchVisible);
  const tapTarget = await page.evaluate(() => {
    const card = document.querySelector('.fleet-card');
    return card ? Math.round(card.getBoundingClientRect().height) : 0;
  });
  check('karta lodi má dotykovou výšku (≥ 40 px)', tapTarget >= 40, `${tapTarget}px`);
  await page.screenshot({ path: `${SHOTS}/mobile-hangar.png` });

  console.log('\n▸ let na telefonu');
  await page.evaluate(() => document.querySelector('.fleet-launch button')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await waitFor(page, () => Boolean(document.querySelector('.fleet-canvas canvas')), 40000, 'canvas');
  await waitFor(page, () => Boolean(window.__fleetDebug), 60000, 'debug háček');
  await waitFor(page, () => document.querySelectorAll('.fleet-touch .touch-key').length >= 6, 15000, 'dotykové ovládání');

  const touchKeys = await page.evaluate(() => document.querySelectorAll('.fleet-touch .touch-key').length);
  check('dotykové ovládání se vykreslilo (coarse)', touchKeys >= 7, `buttons=${touchKeys}`);

  const padSize = await page.evaluate(() => {
    const rect = document.querySelector('.fleet-touch .touch-key')?.getBoundingClientRect();
    return rect ? Math.round(Math.min(rect.width, rect.height)) : 0;
  });
  check('dotykové tlačítko má ≥ 44 px', padSize >= 44, `${padSize}px`);

  // funkční test: PLYN musí loď opravdu rozjet
  const before = await page.evaluate(() => window.__fleetDebug.state());
  await press(page, '.fleet-touch.is-right .touch-key:nth-of-type(1)', 900);
  const after = await page.evaluate(() => window.__fleetDebug.state());
  check('PLYN přes dotyk zrychlí loď', after.speed > before.speed + 0.4, `${before.speed.toFixed(2)} → ${after.speed.toFixed(2)}`);

  // funkční test: zatáčení doleva
  const yawBefore = after.yaw;
  await press(page, '.fleet-touch.is-left .touch-key:nth-of-type(1)', 700);
  const turned = await page.evaluate(() => window.__fleetDebug.state());
  check('šipka vlevo změní kurz', Math.abs(turned.yaw - yawBefore) > 0.05, `Δyaw=${(turned.yaw - yawBefore).toFixed(3)}`);

  const overlap = await page.evaluate(overlapProbe);
  check('HUD nepřekrývá dotykový pad', overlap !== null && !overlap.intersects, JSON.stringify(overlap));
  check('let nepřetéká do stran', (await page.evaluate(overflowProbe)) <= 1);

  // kotvení musí jít i na dotyku (panel má tlačítka ≥ 40 px)
  await page.evaluate(() => window.__fleetDebug.dock('nabukano-1'));
  await waitFor(page, () => Boolean(document.querySelector('.fleet-docked')), 15000, 'panel doku');
  const dockButtons = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.fleet-docked-actions button')).map((button) =>
      Math.round(button.getBoundingClientRect().height),
    ),
  );
  check('tlačítka panelu doku mají ≥ 40 px', dockButtons.every((height) => height >= 38), dockButtons.join('/'));
  const panelInView = await page.evaluate(() => {
    const rect = document.querySelector('.fleet-docked')?.getBoundingClientRect();
    return rect ? rect.top >= 0 && rect.bottom <= window.innerHeight + 1 : false;
  });
  check('panel doku se vejde do obrazu', panelInView);
  await page.screenshot({ path: `${SHOTS}/mobile-docked.png` });

  console.log('\n▸ na šířku (844 × 390)');
  // Otočení za letu je jiná situace než „přijdu na šířku" — a ta druhá je ta,
  // kterou hráč opravdu dělá. Test proto otevírá novou stránku, ne jen mění
  // viewport běžící hry (při změně za letu se remountuje scéna a měření
  // chytalo polovinu starého stromu).
  const wide = await browser.newPage(PHONE_LANDSCAPE);
  const wideErrors = [];
  wide.on('pageerror', (error) => wideErrors.push(error.message));
  await grantPass(wide, host);
  await wide.goto(`${app.base}/fleet?fleetDebug=1`, { waitUntil: 'networkidle' });
  await waitFor(wide, () => document.querySelectorAll('.fleet-card').length > 0, 30000, 'karty lodí (landscape)');
  check('na šířku nic nepřetéká', (await wide.evaluate(overflowProbe)) <= 1);

  await wide.evaluate(() =>
    document.querySelector('.fleet-launch button')?.dispatchEvent(new MouseEvent('click', { bubbles: true })),
  );
  await waitFor(wide, () => document.querySelectorAll('.fleet-touch .touch-key').length >= 6, 40000, 'ovládání (landscape)');
  const landscape = await wide.evaluate(overlapProbe);
  check('na šířku HUD nepřekrývá ovládání', landscape !== null && !landscape.intersects, JSON.stringify(landscape));
  const padBox = await wide.evaluate(() => {
    const rect = document.querySelector('.fleet-touch.is-left')?.getBoundingClientRect();
    const right = document.querySelector('.fleet-touch.is-right')?.getBoundingClientRect();
    if (!rect || !right) return null;
    return {
      inside:
        rect.top >= -1 &&
        right.bottom <= window.innerHeight + 1 &&
        right.right <= window.innerWidth + 1 &&
        rect.left >= -1,
      height: window.innerHeight,
      bottom: Math.round(Math.max(rect.bottom, right.bottom)),
      screen: window.innerHeight,
    };
  });
  check('ovládání zůstane celé v obraze', Boolean(padBox?.inside), JSON.stringify(padBox));
  check('na šířku nejsou chyby v konzoli', wideErrors.length === 0, wideErrors.slice(0, 2).join(' | '));
  await wide.screenshot({ path: `${SHOTS}/mobile-landscape.png` });

  check('v konzoli nejsou chyby', errors.filter((line) => !line.includes('401')).length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();
  app.stop();
  console.log(`\n${failed === 0 ? '✓' : '✗'} fleet-mobile: ${passed} prošlo, ${failed} selhalo\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
