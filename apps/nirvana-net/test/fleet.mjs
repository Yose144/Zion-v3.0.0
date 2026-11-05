#!/usr/bin/env node
/**
 * Test společného letu (flotila).
 *
 * Flotila je **relay** hra: klient počítá svůj pohyb sám a server ho předává
 * ostatním. Test proto ověřuje to, co má server opravdu na starosti:
 *  1. dva piloti se potkají v jedné místnosti a vidí se navzájem,
 *  2. poloha, natočení i **stav doku** se přenesou,
 *  3. nesmyslné hodnoty (mimo prostor, `dockId` mimo seznam, neznámá loď)
 *     se ořežou nebo zahodí — ne že je server slepě přepošle,
 *  4. vlastní stav se ve snapshotu nevrací (klient si ho predikuje sám),
 *  5. odchod udělá **ducha** (3 s), ale sedlo se uvolní hned,
 *  6. místnost má šest sedadel a sedmý pilot jde do jiné.
 *
 * Spustit: node apps/nirvana-net/test/fleet.mjs (po `npm run build`)
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { WebSocket } from 'ws';
import { FLEET_ROOM_SIZE, PROTO_VERSION as PROTO } from '../dist/nirvana/src/core/net/protocol.js';

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, '..', 'dist', 'nirvana-net', 'src', 'index.js');
const PORT = Number(process.env.FLEET_PORT ?? 5300 + Math.floor(Math.random() * 200));
const WS_URL = `ws://127.0.0.1:${PORT}/net`;

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

const server = spawn(process.execPath, [entry], {
  env: {
    ...process.env,
    NIRVANA_NET_PORT: String(PORT),
    NIRVANA_NET_ALLOWED_ORIGINS: 'http://127.0.0.1:3055',
    ZIS_URL: 'http://127.0.0.1:1',
    NIRVANA_NET_REQUIRE_PASS: '0',
    NIRVANA_NET_RESUME_MS: '0',
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

/** Poslední snapshot s piloty (server posílá 15×/s). */
const snapshotOf = (c) => c.last((m) => m.t === 'snapshot' && m.game === 'fleet');

/** Pilot podle id ve snapshotu. */
const pilotOf = (c, id) => snapshotOf(c)?.fleet?.pilots?.find((pilot) => pilot.id === id) ?? null;

async function handshake(c, name = 'host') {
  await c.opened;
  c.send({ t: 'hello', proto: PROTO, name });
  await c.waitFor((m) => m.t === 'welcome', 6000);
}

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

  console.log('\n▸ připojení dvou pilotů');
  const a = client();
  await handshake(a, 'a');
  a.send({ t: 'join', game: 'fleet', shipId: 'awing' });
  const roomA = await a.waitFor((m) => m.t === 'room');
  const idA = roomA.youPlayerId;
  check('místnost flotily vznikla', roomA.room.id.startsWith('fleet-'), roomA.room.id);
  check('první pilot je sám (čeká)', roomA.room.state === 'waiting', roomA.room.state);

  const b = client();
  await handshake(b, 'b');
  b.send({ t: 'join', game: 'fleet', shipId: 'tiefighter' });
  const roomB = await b.waitFor((m) => m.t === 'room');
  const idB = roomB.youPlayerId;
  check('druhý pilot se přidal do stejné místnosti', roomB.room.id === roomA.room.id, roomB.room.id);
  // `state` v `room` zprávě je stav v okamžiku usednutí (místnost vznikala jako
  // `waiting`), takže se překlopení čte z živého seznamu místností.
  const running = await a
    .waitFor((m) => m.t === 'rooms' && m.rooms.some((room) => room.id === roomA.room.id && room.state === 'running'), 4000)
    .catch(() => null);
  check('stav se překlopil na running', running !== null, snapshotOf(a)?.game ?? 'bez seznamu');
  check('obsazeno dva', roomB.occupants.length === 2, String(roomB.occupants.length));

  console.log('\n▸ poloha a natočení');
  a.send({ t: 'flight', x: 3.5, y: 8, z: -12, yaw: 1.25, pitch: 0.3, roll: -0.2, speed: 7 });
  await sleep(300);
  const seenA = pilotOf(b, idA);
  check('protější pilot je ve snapshotu', seenA !== null);
  check('poloha sedí', seenA && Math.abs(seenA.x - 3.5) < 1e-6 && Math.abs(seenA.y - 8) < 1e-6 && Math.abs(seenA.z + 12) < 1e-6, JSON.stringify(seenA && [seenA.x, seenA.y, seenA.z]));
  check('natočení sedí', seenA && Math.abs(seenA.yaw - 1.25) < 1e-6 && Math.abs(seenA.pitch - 0.3) < 1e-6);
  check('loď se přenesla z `join`', seenA?.shipId === 'awing', seenA?.shipId);
  check('vlastní stav se nevrací', pilotOf(a, idA) === null);

  console.log('\n▸ ověření hodnot (server není slepý přeposílač)');
  a.send({ t: 'flight', x: 9999, y: -9999, z: 0, yaw: 42, pitch: 9, roll: 9, speed: 999, docked: true, dockId: 'hack-1' });
  await sleep(300);
  const clamped = pilotOf(b, idA);
  check('souřadnice se ořežou do prostoru', clamped && Math.abs(clamped.x) <= 34.0001 && Math.abs(clamped.y) <= 34.0001, JSON.stringify(clamped && [clamped.x, clamped.y]));
  check('yaw se zabalí do (−π, π]', clamped && Math.abs(clamped.yaw) <= Math.PI + 1e-6, String(clamped?.yaw));
  check('pitch/roll mají strop', clamped && Math.abs(clamped.pitch) <= 1.2 + 1e-6 && Math.abs(clamped.roll) <= 1 + 1e-6);
  check('rychlost má strop', clamped && Math.abs(clamped.speed) <= 40.0001, String(clamped?.speed));
  check('neexistující dok se zahodí', clamped && clamped.docked === false && !clamped.dockId, JSON.stringify({ docked: clamped?.docked, dockId: clamped?.dockId }));

  console.log('\n▸ kotvení se přenese');
  a.send({ t: 'flight', x: 0, y: 6, z: 20, yaw: 0, pitch: 0, roll: 0, speed: 0, docked: true, dockId: 'nabukano-2' });
  await sleep(300);
  const docked = pilotOf(b, idA);
  check('dok je vidět u ostatních', docked?.docked === true && docked?.dockId === 'nabukano-2', JSON.stringify({ docked: docked?.docked, dockId: docked?.dockId }));

  console.log('\n▸ neznámá loď');
  const c = client();
  await handshake(c, 'c');
  c.send({ t: 'join', game: 'fleet', shipId: 'death-star' });
  const roomC = await c.waitFor((m) => m.t === 'room');
  await sleep(250);
  const fallback = pilotOf(a, roomC.youPlayerId);
  check('neznámá loď spadne na x-wing', fallback?.shipId === 'xwing', fallback?.shipId);

  console.log('\n▸ duch při odchodu');
  const ghostsBefore = (snapshotOf(b)?.fleet?.pilots ?? []).length;
  c.close();
  await sleep(500);
  const ghost = (snapshotOf(b)?.fleet?.pilots ?? []).find((pilot) => pilot.id === roomC.youPlayerId);
  check('odejitý pilot zůstane jako duch', ghost?.ghost === true, JSON.stringify(ghost && { ghost: ghost.ghost }));
  await sleep(3200);
  const afterGhost = (snapshotOf(b)?.fleet?.pilots ?? []).find((pilot) => pilot.id === roomC.youPlayerId);
  check('po 3 s duch zmizí', !afterGhost);
  check('ostatní zůstali', (snapshotOf(b)?.fleet?.pilots ?? []).length === ghostsBefore - 1, String((snapshotOf(b)?.fleet?.pilots ?? []).length));

  console.log('\n▸ kapacita místnosti');
  const crowd = [];
  for (let index = 0; index < FLEET_ROOM_SIZE + 2; index += 1) {
    const extra = client();
    await handshake(extra, `x${index}`);
    extra.send({ t: 'join', game: 'fleet' });
    crowd.push({ client: extra, room: await extra.waitFor((m) => m.t === 'room') });
  }
  const firstRoom = crowd[0].room.room.id;
  const sameRoom = crowd.filter((entry) => entry.room.room.id === firstRoom).length;
  const otherRoom = crowd.filter((entry) => entry.room.room.id !== firstRoom).length;
  // V `fleet-1` už sedí dva piloti z první části testu, takže se do něj vejdou
  // jen další čtyři; zbytek musí dostat novou místnost.
  check(
    `místnost pobere ${FLEET_ROOM_SIZE} pilotů (2 + ${sameRoom})`,
    sameRoom + 2 === FLEET_ROOM_SIZE,
    `stejná=${sameRoom} jiná=${otherRoom}`,
  );
  check('přebytek jde do jiné místnosti', otherRoom > 0, `jiná=${otherRoom}`);
  check(
    'žádná místnost nepřekročí kapacitu',
    sameRoom + 2 <= FLEET_ROOM_SIZE && otherRoom <= FLEET_ROOM_SIZE,
    `stejná=${sameRoom} jiná=${otherRoom}`,
  );
  check('id místností mají prefix fleet', crowd.every((entry) => entry.room.room.id.startsWith('fleet-')));

  for (const entry of crowd) entry.client.close();
  a.close();
  b.close();
  await sleep(200);
} catch (error) {
  failures += 1;
  console.error('výjimka:', error.message);
  console.error(log.split('\n').slice(-12).join('\n'));
} finally {
  server.kill();
}

console.log(failures === 0 ? '\n✓ fleet: vše prošlo\n' : `\n✗ fleet: ${failures} selhalo\n`);
process.exit(failures === 0 ? 0 : 1);
