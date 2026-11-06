#!/usr/bin/env node
/**
 * FLOTILA — zátěžový test scény (6 pilotů v jedné místnosti).
 *
 * Proč samostatně: sólo audit měří 21 draw calls / 26 k tris, jenže místnost
 * má **šest** sedadel a každá loď z marketu je 10–24 k trojúhelníků. Než se
 * udělá LOD, musí se změřit, jestli je vůbec potřeba — jinak je to slepá
 * optimalizace, která jen zhorší vzhled.
 *
 * Protistrany jsou **Node WS klienti** (5×), ne prohlížeče: jde o zátěž
 * rendereru, ne o počet WebGL kontextů. Klienti posílají stav letu 10×/s,
 * takže scéna opravdu kreslí šest lodí na různých místech.
 *
 * Appka musí být postavená s `NEXT_PUBLIC_NIRVANA_NET_URL`:
 *   cd apps/nirvana && rm -rf .next && \
 *     NEXT_PUBLIC_NIRVANA_NET_URL=ws://127.0.0.1:3011/net npx next build
 *
 * Spuštění:
 *   node apps/nirvana/e2e/fleet-load.mjs
 */

import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { WebSocket } from 'ws';
import { mkdir } from 'node:fs/promises';
import { launch } from './_browser.mjs';
import { ensureApp, grantPass } from './_app.mjs';
import { PROTO_VERSION as PROTO } from '../../nirvana-net/dist/nirvana/src/core/net/protocol.js';

const repo = resolve(import.meta.dirname, '../../..');
const NET_PORT = Number(process.env.FLEET_NET_PORT ?? 3011);
const WS_URL = `ws://127.0.0.1:${NET_PORT}/net`;
const SHIPS = ['awing', 'bwing', 'tiefighter', 'tieinterceptor', 'snowspeeder'];

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

async function waitFor(fn, timeout = 30000, label = 'stav') {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = await fn();
    if (value) return value;
    await sleep(150);
  }
  throw new Error(`timeout: ${label}`);
}

function pilot(name) {
  const socket = new WebSocket(WS_URL);
  socket.on('error', () => {});
  const inbox = [];
  socket.on('message', (data) => inbox.push(JSON.parse(data.toString())));
  return {
    socket,
    inbox,
    open: new Promise((done) => socket.once('open', done)),
    send: (message) => socket.send(JSON.stringify(message)),
    last: (match) => [...inbox].reverse().find(match) ?? null,
    close: () => socket.close(),
  };
}

async function main() {
  const net = spawn(process.execPath, [resolve(repo, 'apps/nirvana-net/dist/nirvana-net/src/index.js')], {
    env: {
      ...process.env,
      NIRVANA_NET_PORT: String(NET_PORT),
      NIRVANA_NET_REQUIRE_PASS: '0',
      NIRVANA_NET_RESUME_MS: '0',
      ZIS_URL: 'http://127.0.0.1:1',
      NIRVANA_NET_ALLOWED_ORIGINS: 'http://127.0.0.1:3010,http://localhost:3010',
    },
    stdio: 'ignore',
  });
  const cleanup = () => net.kill('SIGKILL');
  process.once('exit', cleanup);

  await waitFor(
    () => fetch(`http://127.0.0.1:${NET_PORT}/net/health`).then((res) => res.ok).catch(() => false),
    20000,
    'net health',
  );

  const app = await ensureApp();
  if (!process.env.ZION_GPU) process.env.ZION_GPU = 'metal';

  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await grantPass(page, new URL(app.base).hostname);

  console.log('\n▸ sólo (referenční stav)');
  await page.goto(`${app.base}/fleet?fleetDebug=1`, { waitUntil: 'networkidle' });
  await waitFor(() => page.evaluate(() => document.querySelectorAll('.fleet-card').length > 0), 30000, 'hangár');
  await page.evaluate(() =>
    document.querySelector('.fleet-launch button')?.dispatchEvent(new MouseEvent('click', { bubbles: true })),
  );
  await waitFor(() => page.evaluate(() => Boolean(window.__fleetDebug)), 60000, 'scéna');

  const measure = async () => {
    await sleep(1500);
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
    return { ...renderer, fps };
  };

  const solo = await measure();
  console.log(
    `  · sólo: ${solo.calls} calls · ${solo.triangles} tris · ${solo.textures} textur · ${solo.fps} fps`,
  );

  console.log('\n▸ plná místnost (5 dalších pilotů)');
  // Přepínač společného letu je jen v hangáru, takže se musí zpět a zapnout
  // ho tam — klikat na `.fleet-launch` za letu nic nedělá (a přesně na to
  // test prvně narazil: čekal id místnosti, které nikdy nemohlo vzniknout).
  await page.evaluate(() =>
    document.querySelector('.fleet-exit')?.dispatchEvent(new MouseEvent('click', { bubbles: true })),
  );
  await waitFor(() => page.evaluate(() => Boolean(document.querySelector('.fleet-coop'))), 15000, 'hangár');
  await page.evaluate(() =>
    document.querySelector('.fleet-coop')?.dispatchEvent(new MouseEvent('click', { bubbles: true })),
  );
  await page.evaluate(() =>
    document.querySelector('.fleet-launch button')?.dispatchEvent(new MouseEvent('click', { bubbles: true })),
  );
  const room = await waitFor(
    () => page.evaluate(() => document.querySelector('.fleet-peers em')?.textContent ?? ''),
    30000,
    'id místnosti',
  );

  const crowd = [];
  for (const [index, shipId] of SHIPS.entries()) {
    const client = pilot(`p${index}`);
    await client.open;
    client.send({ t: 'hello', proto: PROTO, name: `p${index}` });
    await waitFor(() => Promise.resolve(Boolean(client.last((m) => m.t === 'welcome'))), 8000, 'welcome');
    client.send({ t: 'join', game: 'fleet', room, shipId });
    await waitFor(() => Promise.resolve(Boolean(client.last((m) => m.t === 'room'))), 8000, 'room');
    crowd.push(client);
  }

  // Každý pilot letí po vlastní kružnici — jinak by stáli na sobě a scéna
  // by kreslila jednu loď pětkrát na stejném místě (a měřila hovno).
  const timer = setInterval(() => {
    crowd.forEach((client, index) => {
      const angle = (Date.now() / 2600 + index) % (Math.PI * 2);
      client.send({
        t: 'flight',
        x: Math.cos(angle) * (10 + index),
        y: 6 + Math.sin(angle * 1.7) * 2,
        z: Math.sin(angle) * (10 + index),
        yaw: angle,
        pitch: 0.1,
        roll: 0,
        speed: 6,
      });
    });
  }, 100);

  await waitFor(() => page.evaluate(() => (window.__fleetDebug.remotes() ?? 0) >= 5), 30000, '5 cizích pilotů');
  await mkdir(resolve(repo, '.artifacts/render/fleet'), { recursive: true });
  await page.screenshot({ path: resolve(repo, '.artifacts/render/fleet/load-6-pilots.png') });
  const full = await measure();
  console.log(
    `  · plno: ${full.calls} calls · ${full.triangles} tris · ${full.textures} textur · ${full.fps} fps`,
  );

  clearInterval(timer);
  for (const client of crowd) client.close();
  await sleep(300);

  console.log('\n▸ rozpočet');
  check('scéna kreslí šest lodí', (await page.evaluate(() => window.__fleetDebug.remotes())) === 5);
  check('draw calls pod 200', full.calls < 200, `${full.calls}`);
  check('trojúhelníky pod 120 k', full.triangles < 120_000, `${full.triangles}`);
  check('fps ≥ 30 (Metal)', full.fps >= 30, `${full.fps} fps`);
  check('bez chyb v konzoli', errors.length === 0, errors.slice(0, 2).join(' | '));
  console.log(
    `\n  rozdíl proti sólu: +${full.calls - solo.calls} calls, +${full.triangles - solo.triangles} tris, ${full.fps - solo.fps} fps`,
  );

  await browser.close();
  app.stop();
  cleanup();
  console.log(`\n${failed === 0 ? '✓' : '✗'} fleet-load: ${passed} prošlo, ${failed} selhalo\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
