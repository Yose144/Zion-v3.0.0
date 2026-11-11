#!/usr/bin/env node
/**
 * Test map arény v multiplayeru (protokol 38).
 *
 * Ověřuje, že **mapa je vlastnost místnosti**, ne klienta:
 *  1. server bere mapu z `join` a neznámou hodnotu shodí na Mars,
 *  2. sim/ARENA_MAPS opravdu používá stejná data jako sólo (pickupy, spawny),
 *  3. snapshot nese `map`, takže klient ví, který svět kreslit,
 *  4. dva lidé s jinou mapou se **nesetkají v jedné místnosti** a dva se
 *     stejnou mapou se potkají.
 *
 * Spouštět po `npm run build` (potřebuje dist/).
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { createRequire } from 'node:module';
import { WebSocket } from 'ws';
import { PROTO_VERSION as PROTO } from '../dist/nirvana/src/core/net/protocol.js';

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, '..', 'dist', 'nirvana-net', 'src', 'index.js');
const require = createRequire(import.meta.url);
const arena = require('../dist/nirvana-net/src/arena.js');
const { ARENA_MAPS } = require('../dist/nirvana/src/core/arena/map.js');

const PORT = Number(process.env.ARENA_MAPS_PORT ?? 3900 + Math.floor(Math.random() * 300));
const WS_URL = `ws://127.0.0.1:${PORT}/net`;

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

const ids = (sim) => sim.pickups.map((pickup) => `${pickup.id}@${pickup.x},${pickup.z}`).sort().join(',');

// ── 1) simulace: mapa z options ───────────────────────────────────────
console.log('\n== server: mapa v simulaci ==');
{
  const mars = arena.createArena(Date.now());
  check('výchozí mapa je Mars', mars.map === 'mars', mars.map);

  const q3dm3 = arena.createArena(Date.now(), { map: 'q3dm3' });
  check('q3dm3 se opravdu použije', q3dm3.map === 'q3dm3', q3dm3.map);
  check(
    'q3dm3 má pickupy ze svého katalogu',
    ids(q3dm3) ===
      ARENA_MAPS.q3dm3.pickups.map((p) => `${p.id}@${p.x},${p.z}`).sort().join(','),
    ids(q3dm3),
  );
  check(
    'q3dm3 nemá pickupy z Marsu (jiný svět)',
    ids(q3dm3) !== ids(mars),
    `${ids(q3dm3)} vs ${ids(mars)}`,
  );

  const q3dm6 = arena.createArena(Date.now(), { map: 'q3dm6' });
  check('q3dm6 se opravdu použije', q3dm6.map === 'q3dm6', q3dm6.map);
  check(
    'q3dm6 má víc pickupů na plošinách (mega/armor nahoře)',
    q3dm6.pickups.filter((p) => p.y > 1).length >= 3,
    String(q3dm6.pickups.filter((p) => p.y > 1).length),
  );

  const bogus = arena.createArena(Date.now(), { map: 'nope' });
  check('neznámá mapa padá na Mars', bogus.map === 'mars', bogus.map);

  // hráč se postaví na spawn té mapy (vyvýšený, ne v podlaze)
  const player = arena.addPlayer(q3dm3, 'c_p', 'Hráč', null, Date.now());
  const spawn3 = ARENA_MAPS.q3dm3.playerSpawn;
  check(
    'hráč startuje na spawnu mapy (včetně výšky)',
    Math.abs(player.body.x - spawn3.x) < 0.01 &&
      Math.abs(player.body.z - spawn3.z) < 0.01 &&
      Math.abs(player.body.y - (spawn3.y ?? 0.2)) < 0.01,
    JSON.stringify({ x: player.body.x, y: player.body.y, z: player.body.z }),
  );

  const snap = arena.arenaSnapshot(q3dm3, Date.now());
  check('snapshot nese mapu', snap.map === 'q3dm3', String(snap.map));
  check(
    'snapshot pickupy odpovídají mapě',
    snap.pickups.length === ARENA_MAPS.q3dm3.pickups.length,
    `${snap.pickups.length}/${ARENA_MAPS.q3dm3.pickups.length}`,
  );

  // boti se rodí na spawnách mapy (ne Marsu)
  const sim = arena.createArena(Date.now(), { map: 'q3dm6', bots: true });
  arena.addPlayer(sim, 'c_b', 'Hráč', null, Date.now());
  arena.ensureBots(sim);
  const bots = [...sim.players.values()].filter((p) => p.isBot).length;
  check('boti se doplní i na jiné mapě', bots === 3, String(bots));
}

// ── 2) síť: mapa vybírá místnost ──────────────────────────────────────
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
    async waitFor(match, ms = 8000) {
      const started = Date.now();
      for (;;) {
        const found = this.last(match);
        if (found) return found;
        if (Date.now() - started > ms) throw new Error('timeout waiting for message');
        await sleep(40);
      }
    },
    close: () => socket.close(),
  };
}

const server = spawn(process.execPath, [entry], {
  env: {
    ...process.env,
    NIRVANA_NET_PORT: String(PORT),
    NIRVANA_NET_ALLOWED_ORIGINS: 'http://127.0.0.1:3998',
    ZIS_URL: 'http://127.0.0.1:1',
    NIRVANA_NET_REQUIRE_PASS: '0',
    NIRVANA_NET_RESUME_MS: '0',
    NIRVANA_ARENA_BOTS: '1',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
server.stdout.on('data', (c) => { log += c.toString(); });
server.stderr.on('data', (c) => { log += c.toString(); });

try {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/net/health`);
      if (response.ok) break;
    } catch { /* start */ }
    await sleep(100);
  }
  console.log(`\n== místnosti podle mapy na :${PORT} ==`);

  const a = client();
  await a.opened;
  a.send({ t: 'hello', proto: PROTO });
  await a.waitFor((m) => m.t === 'welcome');
  a.send({ t: 'join', game: 'arena', map: 'q3dm3' });
  const roomA = await a.waitFor((m) => m.t === 'room');
  const snapA = await a.waitFor((m) => m.t === 'snapshot' && m.map === 'q3dm3');
  check('join s mapou projde', Boolean(roomA.room?.id), JSON.stringify(roomA.room));
  check('snapshot A hlásí q3dm3', snapA.map === 'q3dm3', String(snapA.map));
  check(
    'snapshot A má pickupy q3dm3',
    snapA.pickups.length === ARENA_MAPS.q3dm3.pickups.length,
    `${snapA.pickups.length}`,
  );

  const b = client();
  await b.opened;
  b.send({ t: 'hello', proto: PROTO });
  await b.waitFor((m) => m.t === 'welcome');
  b.send({ t: 'join', game: 'arena', map: 'q3dm6' });
  const roomB = await b.waitFor((m) => m.t === 'room');
  const snapB = await b.waitFor((m) => m.t === 'snapshot' && m.map === 'q3dm6');
  check('jiná mapa = jiná místnost', roomB.room.id !== roomA.room.id, `${roomB.room.id} vs ${roomA.room.id}`);
  check('snapshot B hlásí q3dm6', snapB.map === 'q3dm6', String(snapB.map));

  // třetí člověk se stejnou mapou se musí připojit k A, ne k B
  const c = client();
  await c.opened;
  c.send({ t: 'hello', proto: PROTO });
  await c.waitFor((m) => m.t === 'welcome');
  c.send({ t: 'join', game: 'arena', map: 'q3dm3' });
  const roomC = await c.waitFor((m) => m.t === 'room');
  check('stejná mapa = stejná místnost', roomC.room.id === roomA.room.id, `${roomC.room.id} vs ${roomA.room.id}`);
  const snapC = await c.waitFor((m) => m.t === 'snapshot' && m.map === 'q3dm3');
  check('snapshot C hlásí q3dm3', snapC.map === 'q3dm3', String(snapC.map));

  a.close();
  b.close();
  c.close();
} catch (error) {
  failures += 1;
  console.error(`  FAIL ${error instanceof Error ? error.message : String(error)}`);
} finally {
  server.kill('SIGTERM');
  await sleep(200);
  server.kill('SIGKILL');
}

if (failures !== 0) console.error(`\n--- server log ---\n${log.slice(-3000)}`);
console.log(failures === 0 ? '\nARENA MAPS NET OK' : `\nARENA MAPS NET FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);
