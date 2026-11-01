#!/usr/bin/env node
/**
 * Test serverové arény: dva klienti, pohyb, zásah, frag, respawn.
 * Boti jsou tady **vypnuti** (`NIRVANA_ARENA_BOTS=0`) — jinak by stříleli do
 * testovacích hráčů a test by flakoval. Chování botů ověřuje `arena-bots.mjs`.
 *
 * Ověřuje, že server je autorita — klient jen posílá vstup a dostává
 * snapshoty. Zásah se počítá **na serveru** (hitscan proti stejné mapě
 * jako v prohlížeči), takže test nesahá na žádnou klientskou logiku.
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { createRequire } from 'node:module';
import { WebSocket } from 'ws';

// sdílená fyzika/mapa z nirvany (build služby je CommonJS)
const require = createRequire(import.meta.url);
const { ARENA_BOXES } = require('../dist/nirvana/src/core/arena/map.js');
const { makeSolids, raySolids } = require('../dist/nirvana/src/core/arena/physics.js');

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, '..', 'dist', 'nirvana-net', 'src', 'index.js');
const PORT = Number(process.env.ARENA_PORT ?? 3300 + Math.floor(Math.random() * 500));
const WS_URL = `ws://127.0.0.1:${PORT}/net`;

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

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
    NIRVANA_NET_ALLOWED_ORIGINS: 'http://127.0.0.1:3999',
    // deterministický test: boti by stříleli do testovacích hráčů
    NIRVANA_ARENA_BOTS: '0',
    ZIS_URL: 'http://127.0.0.1:1',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
server.stdout.on('data', (c) => { log += c.toString(); });
server.stderr.on('data', (c) => { log += c.toString(); });
const exited = new Promise((resolve) => server.once('exit', (code) => resolve(code)));

async function waitForHealth() {
  for (let attempt = 0; attempt < 60; attempt++) {
    const state = await Promise.race([exited, sleep(100).then(() => 'running')]);
    if (state !== 'running') throw new Error(`služba spadla (exit ${state}):\n${log}`);
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/net/health`);
      if (response.ok) return;
    } catch { /* ještě běží start */ }
  }
  throw new Error(`služba nenaběhla:\n${log}`);
}

/** Má A z očí volnou linii na zásahovou kouli B? (stejná fyzika jako server) */
function hasLineOfSight(a, b) {
  const solids = makeSolids(ARENA_BOXES);
  const ox = a.x;
  const oy = a.y + 1.6;
  const oz = a.z;
  const tx = b.x;
  const ty = b.y + 1.75 * 0.6;
  const tz = b.z;
  const dx = tx - ox;
  const dy = ty - oy;
  const dz = tz - oz;
  const length = Math.hypot(dx, dy, dz) || 1;
  const wall = raySolids(ox, oy, oz, dx / length, dy / length, dz / length, solids, length);
  return wall === null;
}

/** yaw/pitch, aby (eye) mířilo na střed zásahové koule protivníka. */
function aimAt(from, to) {
  const ox = from.x;
  const oy = from.y + 1.6; // PLAYER.eye
  const oz = from.z;
  const dx = to.x - ox;
  const dy = to.y + 1.75 * 0.6 - oy;
  const dz = to.z - oz;
  const length = Math.hypot(dx, dy, dz) || 1;
  const nx = dx / length;
  const ny = dy / length;
  const nz = dz / length;
  return { yaw: Math.atan2(-nx, -nz), pitch: Math.asin(ny) };
}

try {
  await waitForHealth();
  console.log(`\n== aréna na :${PORT} ==`);

  const a = client();
  const b = client();
  await a.opened;
  await b.opened;

  a.send({ t: 'hello', proto: 4 });
  b.send({ t: 'hello', proto: 4 });
  await a.waitFor((m) => m.t === 'welcome');
  await b.waitFor((m) => m.t === 'welcome');

  a.send({ t: 'join', game: 'arena' });
  const roomA = await a.waitFor((m) => m.t === 'room');
  check('room: arena-1', roomA.room.id === 'arena-1', roomA.room.id);
  check('room: youPlayerId', typeof roomA.youPlayerId === 'string' && roomA.youPlayerId.startsWith('c_'),
    String(roomA.youPlayerId));

  b.send({ t: 'join', game: 'arena' });
  const roomB = await b.waitFor((m) => m.t === 'room');
  check('quick join: stejná místnost', roomB.room.id === 'arena-1', roomB.room.id);

  const first = await a.waitFor((m) => m.t === 'snapshot' && m.players.length === 2);
  check('snapshot: 2 hráči (boti vypnuti)', first.players.length === 2, String(first.players.length));
  check('snapshot: rakety pole', Array.isArray(first.projectiles), JSON.stringify(first.projectiles));
  check('snapshot: pickupy', Array.isArray(first.pickups) && first.pickups.length === 3,
    JSON.stringify(first.pickups));
  check('snapshot: čas zápasu', typeof first.secondsLeft === 'number', String(first.secondsLeft));

  const meA = first.players.find((p) => p.id === roomA.youPlayerId);
  const meB = first.players.find((p) => p.id === roomB.youPlayerId);
  check('snapshot: vlastní hráč', Boolean(meA && meB));
  check('start: 100 hp', meA.hp === 100 && meB.hp === 100);

  // ── pohyb ───────────────────────────────────────────────────────────
  const before = { x: meA.x, z: meA.z };
  for (let i = 0; i < 30; i++) {
    a.send({ t: 'input', seq: i, mx: 0, mz: 1, yaw: meA.yaw, pitch: 0, jump: false, fire: false, weapon: 0 });
    await sleep(33);
  }
  await sleep(250);
  const moved = a.last((m) => m.t === 'snapshot')?.players.find((p) => p.id === roomA.youPlayerId);
  const distance = Math.hypot(moved.x - before.x, moved.z - before.z);
  check('pohyb: hráč se pohnul', distance > 1, `${distance.toFixed(2)} m`);

  // ── přesun B na volné prostranství (u spawnu je mezi nimi plošina) ──
  const GOAL = { x: 4, z: 14 };
  for (let i = 0; i < 240; i++) {
    const snapshot = b.last((m) => m.t === 'snapshot');
    if (!snapshot) { await sleep(40); continue; }
    const me = snapshot.players.find((p) => p.id === roomB.youPlayerId);
    const dx = GOAL.x - me.x;
    const dz = GOAL.z - me.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 2.5) break;
    const yaw = Math.atan2(-dx, -dz);
    b.send({ t: 'input', seq: 200 + i, mx: 0, mz: 1, yaw, pitch: 0, jump: false, fire: false, weapon: 0 });
    await sleep(40);
  }
  b.send({ t: 'input', seq: 260, mx: 0, mz: 0, yaw: 0, pitch: 0, jump: false, fire: false, weapon: 0 });
  await sleep(300);

  // ── zásah: A míří na B a střílí rail ────────────────────────────────
  const aimSnap = a.last((m) => m.t === 'snapshot');
  const selfA = aimSnap.players.find((p) => p.id === roomA.youPlayerId);
  const rivalB = aimSnap.players.find((p) => p.id === roomB.youPlayerId);
  check('B se přesunul', Math.hypot(rivalB.x - 4, rivalB.z - 14) < 4,
    JSON.stringify({ x: rivalB.x, z: rivalB.z }));
  check('volná linie A → B', hasLineOfSight(selfA, rivalB),
    JSON.stringify({ a: { x: selfA.x, z: selfA.z }, b: { x: rivalB.x, z: rivalB.z } }));

  const aim = aimAt(selfA, rivalB);
  let fired = 0;
  for (let i = 0; i < 60; i++) {
    const fire = i % 8 === 0 && fired < 4; // ~2,4 Hz, čtyři rány (2× 55 hp)
    if (fire) fired += 1;
    a.send({
      t: 'input', seq: 300 + i, mx: 0, mz: 0,
      yaw: aim.yaw, pitch: aim.pitch,
      jump: false, fire, weapon: 0,
    });
    await sleep(33);
  }

  const killEvent = await a.waitFor((m) => m.t === 'event' && m.event.kind === 'kill', 6000)
    .catch(() => null);
  check('kill event', Boolean(killEvent), JSON.stringify(a.inbox.filter((m) => m.t === 'event')));
  check('kill: killer je A', killEvent?.event.killer === roomA.youPlayerId, JSON.stringify(killEvent?.event));
  check('kill: victim je B', killEvent?.event.victim === roomB.youPlayerId);

  await sleep(300);
  const after = a.last((m) => m.t === 'snapshot');
  const scoreA = after.players.find((p) => p.id === roomA.youPlayerId);
  const scoreB = after.players.find((p) => p.id === roomB.youPlayerId);
  check('skóre: A má frag', scoreA.frags === 1, String(scoreA.frags));
  check('skóre: B má death', scoreB.deaths === 1, String(scoreB.deaths));
  check('B je mrtvý / čeká na respawn', scoreB.alive === false || scoreB.hp === 0,
    JSON.stringify({ alive: scoreB.alive, hp: scoreB.hp }));

  // ── respawn ─────────────────────────────────────────────────────────
  await sleep(2800);
  const respawned = a.last((m) => m.t === 'snapshot')?.players.find((p) => p.id === roomB.youPlayerId);
  check('respawn: B žije', respawned.alive === true && respawned.hp === 100, JSON.stringify(respawned));
  check('respawn event', Boolean(a.last((m) => m.t === 'event' && m.event.kind === 'respawn')));

  // ── odpočet: opuštění místnosti uklidí hráče ze simulace ────────────
  b.close();
  await sleep(500);
  const solo = a.last((m) => m.t === 'snapshot');
  check('po odpojení 1 hráč', solo.players.length === 1, String(solo.players.length));

  a.close();
  await sleep(400);
  const health = await (await fetch(`http://127.0.0.1:${PORT}/net/health`)).json();
  check('úklid: 0 místností', health.rooms === 0, JSON.stringify(health));
} catch (error) {
  failures += 1;
  console.log(`  FAIL výjimka: ${error.message}`);
  console.log(log.split('\n').slice(-12).join('\n'));
} finally {
  server.kill('SIGTERM');
  if (process.env.ARENA_VERBOSE === '1') {
    console.log('--- log ---');
    console.log(log.trim());
  }
}

await sleep(200);
console.log(failures === 0 ? '\nARENA OK\n' : `\nARENA FAILED (${failures})\n`);
process.exit(failures === 0 ? 0 : 1);
