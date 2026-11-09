#!/usr/bin/env node
/**
 * Test „spícího" hráče v relay hrách (flotila + lumi).
 *
 * Chyba, kterou to kryje: `step()` po `IDLE_MS` bez zpráv entitu **smazal**,
 * ale sedlo v místnosti zůstávalo (otevřené socket i resume grace 45 s).
 * Hráč pak posílal `flight`/`fly` do prázdna — server odpovídal
 * `not_available` a loď/letec pro ostatní neexistoval.
 *
 * Správné chování: ticho entity jen přepne do **ducha** a první herní
 * zpráva ho zase oživí — ať je socket otevřený (skrytá karta), nebo ho
 * hráč oživil resume tokenem **bez** opakovaného `join`.
 *
 * `NIRVANA_NET_RELAY_IDLE_MS` zrychluje test (600 ms místo 12 s).
 *
 * Spustit: node apps/nirvana-net/test/relay-idle.mjs (po `npm run build`)
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { WebSocket } from 'ws';
import { PROTO_VERSION as PROTO } from '../dist/nirvana/src/core/net/protocol.js';

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, '..', 'dist', 'nirvana-net', 'src', 'index.js');
const PORT = Number(process.env.RELAY_IDLE_PORT ?? 5900 + Math.floor(Math.random() * 200));
const WS_URL = `ws://127.0.0.1:${PORT}/net`;
const IDLE_MS = 600;

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

const server = spawn(process.execPath, [entry], {
  env: {
    ...process.env,
    NIRVANA_NET_PORT: String(PORT),
    NIRVANA_NET_ALLOWED_ORIGINS: '',
    ZIS_URL: 'http://127.0.0.1:1',
    NIRVANA_NET_REQUIRE_PASS: '0',
    NIRVANA_NET_RELAY_IDLE_MS: String(IDLE_MS),
    // grace musí být delší než prodleva ve scénáři resume (900 ms)
    NIRVANA_NET_RESUME_MS: '5000',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
server.stdout.on('data', (chunk) => {
  log += chunk.toString();
});
server.stderr.on('data', (chunk) => {
  log += chunk.toString();
});

function client() {
  const socket = new WebSocket(WS_URL);
  socket.on('error', () => {});
  const inbox = [];
  socket.on('message', (data) => inbox.push(JSON.parse(data.toString())));
  const opened = new Promise((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });
  opened.catch(() => {});
  return {
    socket,
    inbox,
    opened,
    send: (message) => socket.send(JSON.stringify(message)),
    last(match) {
      return [...inbox].reverse().find(match) ?? null;
    },
    async waitFor(match, ms = 6000) {
      const started = Date.now();
      for (;;) {
        const found = this.last(match);
        if (found) return found;
        if (Date.now() - started > ms) throw new Error('timeout');
        await sleep(40);
      }
    },
    close: () => socket.close(),
  };
}

const fleetSnap = (c) => c.last((m) => m.t === 'snapshot' && m.game === 'fleet');
const lumiSnap = (c) => c.last((m) => m.t === 'snapshot' && m.game === 'lumi');
const pilotOf = (c, id) => fleetSnap(c)?.fleet?.pilots?.find((pilot) => pilot.id === id) ?? null;
const flyerOf = (c, id) => lumiSnap(c)?.lumi?.flyers?.find((flyer) => flyer.id === id) ?? null;
const hadError = (c, code) => c.inbox.some((m) => m.t === 'error' && m.code === code);

async function handshake(c) {
  await c.opened;
  c.send({ t: 'hello', proto: PROTO });
  return c.waitFor((m) => m.t === 'welcome', 6000);
}

const flight = (x, y, z) => ({ t: 'flight', x, y, z, yaw: 0, pitch: 0, roll: 0, speed: 5 });
const fly = (x, y) => ({ t: 'fly', x, y, vx: 0, vy: 0, energy: 100 });

try {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/net/health`);
      if (response.ok) break;
    } catch {
      // ještě nenaběhl
    }
    await sleep(200);
  }

  console.log('\n▸ neznámá hra v `join` propadne (žádná tichá aréna)');
  const probe = client();
  await handshake(probe);
  probe.send({ t: 'join', game: 'death-star' });
  const badJoin = await probe.waitFor((m) => m.t === 'error', 4000).catch(() => null);
  check('neznámá hra dostane bad_frame', badJoin?.code === 'bad_frame', JSON.stringify(badJoin));
  probe.close();

  console.log('\n▸ FLOTILA: ticho → duch → návrat');
  const a = client();
  const welcomeA = await handshake(a);
  a.send({ t: 'join', game: 'fleet', shipId: 'awing' });
  const roomA = await a.waitFor((m) => m.t === 'room');
  const idA = roomA.youPlayerId;

  const b = client();
  await handshake(b);
  b.send({ t: 'join', game: 'fleet', shipId: 'tiefighter' });
  const roomB = await b.waitFor((m) => m.t === 'room');
  check('druzí pilot ve stejné místnosti', roomB.room.id === roomA.room.id, roomB.room.id);

  a.send(flight(3, 8, -12));
  await sleep(300);
  check('živý pilot je vidět', pilotOf(b, idA)?.x === 3, JSON.stringify(pilotOf(b, idA)?.x));

  // ticho delší než IDLE_MS → duch, ne smazání
  await sleep(IDLE_MS + 700);
  const dormant = pilotOf(b, idA);
  check('po tichu pilot zůstane jako duch', dormant?.ghost === true, JSON.stringify(dormant && { ghost: dormant.ghost }));

  // návrat bez joinu — první `flight` ho oživí
  a.send(flight(5, 9, -10));
  await sleep(400);
  const revived = pilotOf(b, idA);
  check('návrat pilot oživí', revived !== null && revived.ghost !== true && revived.x === 5, JSON.stringify(revived));
  check('žádné not_available', !hadError(a, 'not_available'));

  console.log('\n▸ FLOTILA: resume po tichu (sedlo drží, entity ne)');
  a.close();
  await sleep(IDLE_MS + 400); // za IDLE_MS, ale v rámci grace
  const a2 = client();
  await a2.opened;
  a2.send({ t: 'hello', proto: PROTO, resume: welcomeA.resume });
  const welcome2 = await a2.waitFor((m) => m.t === 'welcome');
  check('resume potvrzeno', welcome2.resumed === true, String(welcome2.resumed));
  const room2 = await a2.waitFor((m) => m.t === 'room');
  check('stejné sedlo po resume', room2.youPlayerId === idA, `${room2.youPlayerId} vs ${idA}`);

  // ŽÁDNÉ opakované `join` — přesně reprodukce bugu: sedlo je, entity
  // byla smazaná → `not_available`. Teď má entity jako ducha a `flight`
  // ji oživí.
  a2.send(flight(7, 10, -8));
  await sleep(500);
  const afterResume = pilotOf(b, idA);
  check('pilot po resume ožije bez joinu', afterResume !== null && afterResume.ghost !== true && afterResume.x === 7, JSON.stringify(afterResume));
  check('po resume žádné not_available', !hadError(a2, 'not_available'));

  console.log('\n▸ LUMI: ticho → duch → návrat');
  const c = client();
  await handshake(c);
  c.send({ t: 'join', game: 'lumi', path: 'calm' });
  const roomC = await c.waitFor((m) => m.t === 'room');
  const idC = roomC.youPlayerId;

  const d = client();
  await handshake(d);
  d.send({ t: 'join', game: 'lumi', path: 'calm' });
  const roomD = await d.waitFor((m) => m.t === 'room');
  check('druzí letec ve stejné místnosti', roomD.room.id === roomC.room.id, roomD.room.id);

  c.send(fly(20, 20));
  await sleep(300);
  check('živý letec je vidět', flyerOf(d, idC)?.x === 20, JSON.stringify(flyerOf(d, idC)?.x));

  await sleep(IDLE_MS + 700);
  const dormantFlyer = flyerOf(d, idC);
  check('po tichu letec zůstane jako duch', dormantFlyer?.ghost === true, JSON.stringify(dormantFlyer && { ghost: dormantFlyer.ghost }));

  c.send(fly(30, 25));
  await sleep(400);
  const revivedFlyer = flyerOf(d, idC);
  check('návrat letce oživí', revivedFlyer !== null && revivedFlyer.ghost !== true && revivedFlyer.x === 30, JSON.stringify(revivedFlyer));
  check('u letce žádné not_available', !hadError(c, 'not_available'));

  // úklid
  a2.close();
  b.close();
  c.close();
  d.close();
  await sleep(300);
} catch (error) {
  failures += 1;
  console.log(`  FAIL výjimka — ${error.message}`);
  console.log(log.split('\n').slice(-10).join('\n'));
} finally {
  server.kill('SIGTERM');
  await sleep(200);
}

console.log(`\n${failures === 0 ? 'RELAY-IDLE OK' : `${failures} CHYB`}`);
process.exit(failures === 0 ? 0 : 1);
