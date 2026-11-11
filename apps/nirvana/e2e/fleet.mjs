#!/usr/bin/env node
/**
 * FLOTILA — audit v prohlížeči.
 *
 * Ověřuje **funkci, ne vzhled**: že se loď opravdu rozjede na plyn, že doletí
 * na dok (přes teleport v debug háčku, protože doletět 15 jednotek ručně by
 * v auditu znamenalo minuty), že se zakotví, že se odpojí a že se přitom nic
 * nerozbije v konzoli.
 *
 * Proč se nepoužívá jen `test/fleet-flight.mjs`: ten ověřuje simulaci.
 * Tenhle skript ověřuje, že simulace je **napojená** — že klávesa dojde do
 * refu, že scéna čte stav a že se model z marketu skutečně stáhne
 * (`/models/fleet/*.glb` je pod veřejným prefixem middleware).
 *
 * Spuštění:
 *   node apps/nirvana/e2e/fleet.mjs            # appku na :3010 si spustí sám
 *   FLEET_URL=https://… node apps/nirvana/e2e/fleet.mjs   # proti běžící instanci
 */

import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { launch } from './_browser.mjs';
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

/**
 * Co se v konzoli ignoruje: hra je **navržená tak, že bez realtime služby
 * jede dál sólo**, takže neúspěšné WS spojení a 401 z `/api/auth/me` nejsou
 * chyby hry. Kdyby se filtrovalo víc, audit by mohl zakrýt skutečnou chybu.
 */
const ignoreOffline = (line) =>
  line.includes('401') ||
  line.includes('ws://') ||
  line.includes('wss://') ||
  line.includes('WebSocket') ||
  line.includes('/net');

/** Počká na `predicate` v prohlížeči; polluje z Node (ne `waitForFunction`). */
async function waitFor(page, fn, timeout = 20000, label = 'stav') {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = await page.evaluate(fn);
    if (value) return value;
    await sleep(200);
  }
  throw new Error(`timeout: ${label}`);
}

async function main() {
  const app = await ensureApp({ base: process.env.FLEET_URL ?? 'http://127.0.0.1:3010' });
  const BASE = app.base;
  const host = new URL(BASE).hostname;

  await mkdir(SHOTS, { recursive: true });
  if (!process.env.ZION_GPU) process.env.ZION_GPU = 'metal';
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await grantPass(page, host);

  console.log('\n▸ hangár');
  await page.goto(`${BASE}/fleet?fleetDebug=1`, { waitUntil: 'networkidle' });
  await waitFor(page, () => document.querySelectorAll('.fleet-card').length > 0, 30000, 'karty lodí');
  const cards = await page.evaluate(() => document.querySelectorAll('.fleet-card').length);
  // 8 = sedm stíhaček z marketu + Millennium Falcon (z archivu Thingiverse)
  check('hangár nabízí 8 lodí', cards === 8, `count=${cards}`);
  const falcon = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.fleet-card-name')).some((el) => el.textContent?.includes('Falcon')),
  );
  check('v hangáru je Millennium Falcon', falcon);
  const title = await page.evaluate(() => document.querySelector('.fleet-hangar h1')?.textContent ?? '');
  check('hangár má nadpis', (title ?? '').length > 3, title);
  await page.screenshot({ path: `${SHOTS}/hangar.png` });

  console.log('\n▸ start letu');
  await page.click('.fleet-launch button');
  await waitFor(page, () => Boolean(document.querySelector('.fleet-canvas canvas')), 40000, 'canvas');
  check('scéna se spustila', true);
  await waitFor(page, () => Boolean(window.__fleetDebug), 60000, 'debug háček');

  const modelLoaded = await page.evaluate(() =>
    performance.getEntriesByType('resource').some((entry) => entry.name.includes('/models/fleet/')),
  );
  check('model lodi se stáhl z /models/fleet', modelLoaded);

  // snímek hned po startu: musí v něm být planeta i flotila, ne prázdno
  await sleep(1500);
  await page.screenshot({ path: `${SHOTS}/launch.png` });

  const start = await page.evaluate(() => window.__fleetDebug.state());
  // Volnoběh táhne dopředu (0,35 × maximum) — loď nemá viset na místě.
  // Ověřuje se tedy „neletí plnou rychlostí", ne nula.
  check('na startu loď neletí plnou rychlostí', Math.abs(start.speed) < 9.5 * 0.45, `speed=${start.speed.toFixed(2)}`);

  console.log('\n▸ plyn a zatáčení');
  await page.keyboard.down('w');
  await sleep(1500);
  await page.keyboard.up('w');
  const moving = await page.evaluate(() => window.__fleetDebug.state());
  check('plyn loď rozjede', moving.speed > 1.5, `speed=${moving.speed.toFixed(2)}`);
  check('loď se posunula', Math.hypot(moving.x - start.x, moving.y - start.y, moving.z - start.z) > 1);

  const yaw0 = moving.yaw;
  await page.keyboard.down('w');
  await page.keyboard.down('a');
  await sleep(900);
  await page.keyboard.up('a');
  await page.keyboard.up('w');
  const turned = await page.evaluate(() => window.__fleetDebug.state());
  check('zatáčení funguje', Math.abs(turned.yaw - yaw0) > 0.2, `Δyaw=${(turned.yaw - yaw0).toFixed(2)}`);

  console.log('\n▸ kotvení');
  await page.evaluate(() => window.__fleetDebug.dock('nabukano-2'));
  await waitFor(page, () => Boolean(document.querySelector('.fleet-docked')), 15000, 'panel doku');
  const dockedState = await page.evaluate(() => window.__fleetDebug.state());
  check('loď je zakotvená na Nabukanu', dockedState.docked === 'nabukano-2', String(dockedState.docked));
  const dockText = await page.evaluate(() => document.querySelector('.fleet-docked h2')?.textContent ?? '');
  check('panel hlásí Nabukano', dockText.includes('Nabukano'), dockText);
  await page.screenshot({ path: `${SHOTS}/docked.png` });

  console.log('\n▸ odpojení');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('.fleet-docked-actions button'));
    buttons[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await waitFor(page, () => !window.__fleetDebug.state().docked, 15000, 'odpojení');
  const undocked = await page.evaluate(() => window.__fleetDebug.state());
  check('po odpojení není zakotveno', undocked.docked === null);
  check('po odpojení má loď impuls', undocked.speed > 0);

  console.log('\n▸ Issobella');
  await page.evaluate(() => window.__fleetDebug.dock('issobella'));
  await waitFor(page, () => window.__fleetDebug.state().docked === 'issobella', 15000, 'dok Issobella');
  check('kotvení na Issobelle funguje', true);

  console.log('\n▸ HUD a scéna');
  const hud = await page.evaluate(() => ({
    gauges: document.querySelectorAll('.fleet-gauges span').length,
    target: document.querySelector('.fleet-target strong')?.textContent ?? '',
  }));
  check('HUD má tři údaje', hud.gauges === 3, String(hud.gauges));
  check('HUD ukazuje cíl', hud.target.length > 2, hud.target);

  await page.evaluate(() => window.__fleetDebug.teleport(0, 8, 22));
  await sleep(1200);
  await page.screenshot({ path: `${SHOTS}/flight.png` });

  console.log('\n▸ přistání = dohraný běh');
  // Přistání je jediná „výhra" flotily, takže se z něj musí zapsat běh
  // (XP, dharma, tabule). Teleport sám `travelled` nezvyšuje, takže se
  // nejdřív kousek letí — práh 25 jednotek brání farmení na místě.
  await page.keyboard.down('w');
  await sleep(3000);
  await page.keyboard.up('w');
  await page.evaluate(() => {
    const dock = window.__fleetDebug.docks()[0];
    window.__fleetDebug.teleport(dock.position[0], dock.position[1], dock.position[2]);
  });
  await sleep(2500);
  const afterDock = await page.evaluate(() => ({
    profile: JSON.parse(localStorage.getItem('nirvana.park.v1') ?? '{}'),
    docked: window.__fleetDebug.state().docked,
  }));
  check('přistání se započítalo do profilu', Number(afterDock.profile.best?.fleet) > 0, JSON.stringify(afterDock.profile.best ?? {}));
  check('přistání dalo XP', Number(afterDock.profile.xp) > 0, String(afterDock.profile.xp));
  check('přistání zapsalo svět flotily', (afterDock.profile.plays?.fleet ?? 0) >= 1, JSON.stringify(afterDock.profile.plays ?? {}));
  check('dharma validace proběhla', (afterDock.profile.dharma?.validations ?? 0) >= 1, JSON.stringify(afterDock.profile.dharma ?? {}));

  console.log('\n▸ výkon');
  const renderer = await page.evaluate(() => window.__fleetDebug.renderer());
  const fps = await page.evaluate(
    () =>
      new Promise((done) => {
        let frames = 0;
        const start = performance.now();
        const tick = () => {
          frames += 1;
          if (performance.now() - start < 1500) requestAnimationFrame(tick);
          else done(Math.round((frames / (performance.now() - start)) * 1000));
        };
        requestAnimationFrame(tick);
      }),
  );
  console.log(
    `  · ${renderer.calls} draw calls · ${renderer.triangles} trojúhelníků · ` +
      `${renderer.textures} textur · ${renderer.geometries} geometrií · ${fps} fps`,
  );
  // Strop scény univerza je ~175 draw calls / 90 k tris; flotila je jeden svět,
  // takže se do něj musí vejít i s carrierem a stanicí.
  check('draw calls pod 200', renderer.calls < 200, String(renderer.calls));
  check('trojúhelníky pod 120 k', renderer.triangles < 120000, String(renderer.triangles));
  check('fps ≥ 30 (Metal)', fps >= 30, `${fps} fps`);

  check('v konzoli nejsou chyby', errors.filter((line) => !ignoreOffline(line)).length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();
  app.stop();
  console.log(`\n${failed === 0 ? '✓' : '✗'} fleet-audit: ${passed} prošlo, ${failed} selhalo\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
