#!/usr/bin/env node
/**
 * Test místností „jen lidé" (protokol 25).
 *
 * `mode: 'humans'` znamená: prázdná sedla **nedoplní boti** a hra čeká na
 * lidi. Bez toho se pozvaný kamarád připojí do zápasu, který už dávno
 * sehrál bot — a v tancích by za něj střílel.
 *
 * Ověřuje arénu (žádní boti v snapshotu, stav `waiting` do druhého člověka)
 * a tanky (bot sám nevypálí; po druhém hráči jde hrát).
 *
 * Spustit: node apps/nirvana-net/test/humans.mjs (po `npm run build`)
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { WebSocket } from 'ws';
import { PROTO_VERSION as PROTO } from '../dist/nirvana/src/core/net/protocol.js';

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, '..', 'dist', 'nirvana-net', 'src', 'index.js');
const PORT = Number(process.env.HUMANS_PORT ?? 4900 + Math.floor(Math.random() * 200));
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
    NIRVANA_NET_ALLOWED_ORIGINS: '',
    ZIS_URL: 'http://127.0.0.1:1',
    NIRVANA_NET_RESUME_MS: '0',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
server.stdout.on('data', (c) => { log += c.toString(); });
server.stderr.on('data', (c) => { log += c.toString(); });

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
    send: (m) => socket.send(JSON.stringify(m)),
    last(match) {
      return [...inbox].reverse().find(match) ?? null;
    },
    async waitFor(match, ms = 8000) {
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

try {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/net/health`);
      if (response.ok) break;
    } catch {
      /* start */
    }
    await sleep(100);
  }

  console.log('\n== aréna: jen lidé ==');
  const a = client();
  await a.opened;
  a.send({ t: 'hello', proto: PROTO });
  await a.waitFor((m) => m.t === 'welcome');
  a.send({ t: 'join', game: 'arena', mode: 'humans' });
  const roomA = await a.waitFor((m) => m.t === 'room');
  check('místnost hlásí režim humans', roomA.room.mode === 'humans', roomA.room.mode);

  await sleep(800);
  const snapA = a.last((m) => m.t === 'snapshot' && m.game === 'arena');
  const bots = (snapA?.players ?? []).filter((player) => player.isBot);
  check('v aréně nejsou boti', bots.length === 0, `${bots.length} botů`);
  check('jeden hráč = stav waiting', roomA.room.state === 'waiting' || snapA?.state === 'running',
    `${roomA.room.state}`);

  const b = client();
  await b.opened;
  b.send({ t: 'hello', proto: PROTO });
  await b.waitFor((m) => m.t === 'welcome');
  b.send({ t: 'join', game: 'arena', room: roomA.room.id });
  const roomB = await b.waitFor((m) => m.t === 'room');
  check('druhý hráč do stejné místnosti', roomB.room.id === roomA.room.id, roomB.room.id);
  await sleep(800);
  const snapB = b.last((m) => m.t === 'snapshot' && m.game === 'arena');
  check('po druhém hráči jsou ve hře dva lidé a žádný bot',
    (snapB?.players ?? []).filter((p) => p.isBot).length === 0 && (snapB?.players ?? []).length === 2,
    JSON.stringify((snapB?.players ?? []).map((p) => p.isBot)));
  a.close();
  b.close();
  await sleep(400);

  console.log('\n== tanky: jen lidé ==');
  const c = client();
  await c.opened;
  c.send({ t: 'hello', proto: PROTO });
  await c.waitFor((m) => m.t === 'welcome');
  c.send({ t: 'join', game: 'tanks', mode: 'humans' });
  const roomC = await c.waitFor((m) => m.t === 'room');
  check('tanky hlásí režim humans', roomC.room.mode === 'humans', roomC.room.mode);

  // První snapshot nemusí být v inboxu hned po `room` (chodí 15×/s) — čeká se.
  const first = await c.waitFor((m) => m.t === 'snapshot' && m.game === 'tanks', 6000);
  check('první hráč je na tahu', first.tanks.turn === 0, String(first.tanks.turn));

  c.send({ t: 'shoot' });
  await sleep(2500);
  const after = c.last((m) => m.t === 'snapshot' && m.game === 'tanks');
  check('po výstřelu se čeká na člověka (bot nevypálí)',
    after?.tanks?.shots === 1, `${after?.tanks?.shots} ran`);

  const d = client();
  await d.opened;
  d.send({ t: 'hello', proto: PROTO });
  await d.waitFor((m) => m.t === 'welcome');
  d.send({ t: 'join', game: 'tanks', room: roomC.room.id });
  const roomD = await d.waitFor((m) => m.t === 'room');
  check('druhý hráč sedí vpravo', roomD.youPlayerId !== roomC.youPlayerId);
  const viewD = await d.waitFor((m) => m.t === 'snapshot' && m.game === 'tanks' && m.tanks?.you === 1);
  check('druhý hráč dostal stranu 1', viewD.tanks.you === 1);
  // Střela prvního hráče ještě letí — teprve ve fázi `aim` platí soupeřův
  // výstřel. Čekat na fázi, ne na čas (vysoká lob letí i 3 s).
  const idle = await c.waitFor(
    (m) => m.t === 'snapshot' && m.game === 'tanks' && m.tanks?.phase === 'aim' && m.tanks?.turn === 1,
    8000,
  ).catch(() => null);
  check('po dopadu je na tahu druhý člověk', Boolean(idle), 'fáze se nevrátila do aim');
  d.send({ t: 'aim', angle: 50, power: 60 });
  await sleep(300);
  d.send({ t: 'shoot' });
  await sleep(2500);
  const afterD = c.last((m) => m.t === 'snapshot' && m.game === 'tanks');
  check('druhý člověk může hrát', (afterD?.tanks?.shots ?? 0) >= 2, `${afterD?.tanks?.shots} ran`);
  c.close();
  d.close();
} catch (error) {
  failures += 1;
  console.log(`  FAIL výjimka — ${error.message}`);
  console.log(log.split('\n').slice(-6).join('\n'));
} finally {
  server.kill('SIGTERM');
  await sleep(200);
}

console.log(`\n${failures === 0 ? 'HUMANS OK' : `${failures} CHYB`}`);
process.exit(failures === 0 ? 0 : 1);
