#!/usr/bin/env node
/**
 * FLOTILA — společný let, ověření spojení (appka ↔ nirvana-net).
 *
 * Test `test/fleet.mjs` ověřuje server. Tenhle skript ověřuje, že je server
 * **opravdu napojený na hru**: že tlačítko „Letět s ostatními" pošle `join`,
 * že se cizí pilot objeví ve scéně a že se přes síť přenese i to, že přistál
 * na doku. Přesně tenhle druh chyby (join, který tiše propadne do arény)
 * se už jednou stal u tanků i u Venuše.
 *
 * Protistrana je **Node WS klient**, ne druhé okno prohlížeče: headless
 * Chromium se software rasterem táhne a druhý WebGL kontext by test
 * zpomalil natolik, že by se dala měřit latence, ne hra.
 *
 * Appka musí být postavená s `NEXT_PUBLIC_NIRVANA_NET_URL` na tuto službu:
 *   cd apps/nirvana && rm -rf .next && \
 *     NEXT_PUBLIC_NIRVANA_NET_URL=ws://127.0.0.1:3011/net npx next build
 *
 * Spuštění:
 *   node apps/nirvana/e2e/fleet-online.mjs
 */

import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { WebSocket } from 'ws';
import { launch } from './_browser.mjs';
// Protokol se čte z **postaveného** netu, ne z literálu: paralelní session
// ho umí zvednout (31 → 32) a test s natvrdo zapsaným číslem pak padá na
// `proto_mismatch`, přestože je vše v pořádku. Stejné pravidlo jako u net testů.
import { PROTO_VERSION as PROTO } from '../../nirvana-net/dist/nirvana/src/core/net/protocol.js';
import { ensureApp, grantPass } from './_app.mjs';

const repo = resolve(import.meta.dirname, '../../..');
const SHOTS = resolve(repo, '.artifacts/render/fleet');
const NET_PORT = Number(process.env.FLEET_NET_PORT ?? 3011);
const WS_URL = `ws://127.0.0.1:${NET_PORT}/net`;

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

async function waitFor(fn, timeout = 25000, label = 'stav') {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = await fn();
    if (value) return value;
    await sleep(150);
  }
  throw new Error(`timeout: ${label}`);
}

/** Protistrana: klient, který letí, ale nic nekreslí. */
function pilot() {
  const socket = new WebSocket(WS_URL);
  socket.on('error', () => {});
  const inbox = [];
  socket.on('message', (data) => inbox.push(JSON.parse(data.toString())));
  const opened = new Promise((done) => socket.once('open', done));
  opened.catch(() => {});
  return {
    socket,
    inbox,
    opened,
    send: (message) => socket.send(JSON.stringify(message)),
    last: (match) => [...inbox].reverse().find(match) ?? null,
    close: () => socket.close(),
  };
}

async function main() {
  /** Děti se uklízejí v `finally` — když test spadne na timeout, nesmí
   *  zůstat viset `next-server` ani net služba na portu (přesně tím se pak
   *  druhý běh připojil ke staré instanci bez oracle stubu). */
  const children = [];
  const net = spawn(process.execPath, [resolve(repo, 'apps/nirvana-net/dist/nirvana-net/src/index.js')], {
    env: {
      ...process.env,
      NIRVANA_NET_PORT: String(NET_PORT),
      NIRVANA_NET_REQUIRE_PASS: '0',
      // Origin allowlist: bez něj služba zavře spojení z :3010 (403) a hra
      // zůstane „offline", aniž by cokoli řekla — proto se to v testu nastavuje.
      NIRVANA_NET_ALLOWED_ORIGINS: 'http://127.0.0.1:3010,http://localhost:3010',
      NIRVANA_NET_RESUME_MS: '0',
      ZIS_URL: 'http://127.0.0.1:1',
    },
    stdio: 'ignore',
  });
  children.push(net);
  process.once('exit', () => children.forEach((child) => child.kill('SIGKILL')));

  await waitFor(
    async () => fetch(`http://127.0.0.1:${NET_PORT}/net/health`).then((res) => res.ok).catch(() => false),
    20000,
    'net health',
  );

  const app = await ensureApp();
  children.push({ kill: () => app.stop() });
  await mkdir(SHOTS, { recursive: true });
  if (!process.env.ZION_GPU) process.env.ZION_GPU = 'metal';

  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await grantPass(page, new URL(app.base).hostname);

  console.log('\n▸ zapnutí společného letu');
  await page.goto(`${app.base}/fleet?fleetDebug=1`, { waitUntil: 'networkidle' });
  await waitFor(() => page.evaluate(() => document.querySelectorAll('.fleet-card').length > 0), 30000, 'hangár');
  await page.evaluate(() =>
    document.querySelector('.fleet-coop')?.dispatchEvent(new MouseEvent('click', { bubbles: true })),
  );
  const coopOn = await page.evaluate(() => document.querySelector('.fleet-coop')?.classList.contains('is-active'));
  check('přepínač „Letět s ostatními" se zapne', coopOn === true);
  check(
    'vysvětlení režimu je vidět',
    await page.evaluate(() => Boolean(document.querySelector('.fleet-coop-note'))),
  );

  console.log('\n▸ start letu a připojení do místnosti');
  await page.evaluate(() =>
    document.querySelector('.fleet-launch button')?.dispatchEvent(new MouseEvent('click', { bubbles: true })),
  );
  await waitFor(() => page.evaluate(() => Boolean(document.querySelector('.fleet-peers'))), 40000, 'HUD pilotů');
  // HUD pilotů se objeví dřív než `room` zpráva — id místnosti se musí počkat,
  // jinak se čte prázdný string a vypadá to, že join neproběhl.
  const roomLabel = await waitFor(
    () => page.evaluate(() => document.querySelector('.fleet-peers em')?.textContent ?? ''),
    15000,
    'id místnosti',
  );
  check('klient je v místnosti flotily', roomLabel.startsWith('fleet-'), roomLabel);

  console.log('\n▸ protistrana se připojí');
  const b = pilot();
  await b.opened;
  b.send({ t: 'hello', proto: PROTO, name: 'b' });
  await waitFor(async () => Boolean(b.last((m) => m.t === 'welcome')), 8000, 'welcome protistrany');
  if (!b.last((m) => m.t === 'welcome')) {
    const error = b.last((m) => m.t === 'error');
    console.error('  ! server odpověděl:', JSON.stringify(error));
  }
  b.send({ t: 'join', game: 'fleet', room: roomLabel, shipId: 'bwing' });
  await waitFor(async () => Boolean(b.last((m) => m.t === 'room')), 8000, 'room protistrany');

  // stránka musí vidět protistranu ve scéně
  const remotes = await waitFor(
    () => page.evaluate(() => window.__fleetDebug.remoteList()).then((list) => (list.length > 0 ? list : null)),
    15000,
    'cizí pilot ve scéně',
  );
  check('cizí pilot se objevil ve scéně', remotes.length === 1, String(remotes.length));
  check('přišla i jeho loď z marketu', remotes[0]?.shipId === 'bwing', remotes[0]?.shipId);
  const peersText = await page.evaluate(() => document.querySelector('.fleet-peers strong')?.textContent ?? '');
  check('HUD počítá dva piloty', peersText === '2', peersText);

  console.log('\n▸ pohyb protistrany');
  b.send({ t: 'flight', x: 4, y: 8, z: -6, yaw: 0.5, pitch: 0, roll: 0, speed: 6 });
  const moved = await waitFor(
    () =>
      page
        .evaluate(() => window.__fleetDebug.remoteList())
        .then((list) => (list[0] && Math.abs(list[0].x - 4) < 1e-6 ? list : null)),
    8000,
    'poloha protistrany',
  );
  check('poloha protistrany dorazila do scény', Boolean(moved));
  check('natočení protistrany dorazilo', Math.abs(moved[0].yaw - 0.5) < 1e-6, String(moved[0].yaw));

  console.log('\n▸ kotvení protistrany');
  b.send({ t: 'flight', x: 4, y: 8, z: -6, yaw: 0.5, pitch: 0, roll: 0, speed: 0, docked: true, dockId: 'issobella' });
  const docked = await waitFor(
    () =>
      page
        .evaluate(() => window.__fleetDebug.remoteList())
        .then((list) => (list[0]?.docked ? list[0] : null)),
    8000,
    'dok protistrany',
  );
  check('přistání protistrany je vidět', docked.dockId === 'issobella', docked.dockId);

  console.log('\n▸ zpětný směr (server vidí naši loď)');
  const mine = await waitFor(
    () => {
      const snapshot = b.last((m) => m.t === 'snapshot' && m.game === 'fleet');
      return snapshot?.fleet?.pilots?.[0] ?? null;
    },
    10000,
    'náš pilot u protistrany',
  );
  check('protistrana vidí naši loď', mine.shipId === 'xwing', mine.shipId);
  check('a její polohu', Number.isFinite(mine.x) && Number.isFinite(mine.z), JSON.stringify([mine.x, mine.z]));

  console.log('\n▸ hlediště (?watch=)');
  const watcher = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await grantPass(watcher, new URL(app.base).hostname);
  await watcher.goto(`${app.base}/fleet?watch=${roomLabel}&fleetDebug=1`, { waitUntil: 'networkidle' });
  await waitFor(
    () => watcher.evaluate(() => Boolean(document.querySelector('.arena-spectator'))),
    40000,
    'pruh DÍVÁŠ SE',
  );
  check('divák vidí pruh „DÍVÁŠ SE"', true);
  check(
    'divák nevidí ovládání lodi',
    await watcher.evaluate(() => !document.querySelector('.fleet-keys') && !document.querySelector('.fleet-touch')),
  );
  const seen = await waitFor(
    () => watcher.evaluate(() => window.__fleetDebug?.remoteList?.() ?? []).then((list) => (list.length > 0 ? list : null)),
    25000,
    'cizí pilot u diváka',
  );
  check('divák vidí letící loď', seen.length >= 1, String(seen.length));
  // Divák nesmí zabrat sedlo: protistrana pořád vidí jen jednoho pilota.
  await sleep(1200);
  const pilotsForPlayer = await page.evaluate(() => window.__fleetDebug.remoteList().length);
  check('divák nezabral sedlo', pilotsForPlayer === 1, `pilots=${pilotsForPlayer}`);
  await watcher.screenshot({ path: `${SHOTS}/online-watch.png` });

  await page.screenshot({ path: `${SHOTS}/online.png` });
  check('v konzoli nejsou chyby', errors.filter((line) => !line.includes('401')).length === 0, errors.slice(0, 3).join(' | '));

  b.close();
  await browser.close();
  app.stop();
  net.kill();
  children.length = 0;
  console.log(`\n${failed === 0 ? '✓' : '✗'} fleet-online: ${passed} prošlo, ${failed} selhalo\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
