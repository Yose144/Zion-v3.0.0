#!/usr/bin/env node
/**
 * Test hlediště (diváci).
 *
 * Ověřuje, že divák:
 *  1. dostane potvrzení s `spectator: true` a seznamem hráčů,
 *  2. **nezabírá sedlo** — počet hráčů v místnosti se nezmění a hra ho
 *     nepočítá jako hráče (jinak by v tancích ukradl tah a v aréně se
 *     objevil jako mrtvola v rohu),
 *  3. dostává stejné snapshoty jako hráči (jinak by se „díval" na prázdno),
 *  4. v lobby se počítá zvlášť (`spectators`),
 *  5. jeho odchod nemaže místnost, dokud v ní sedí hráč.
 *
 * Spustit: node apps/nirvana-net/test/spectate.mjs (po `npm run build`)
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { WebSocket } from 'ws';
import { PROTO_VERSION as PROTO } from '../dist/nirvana/src/core/net/protocol.js';

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, '..', 'dist', 'nirvana-net', 'src', 'index.js');
const PORT = Number(process.env.SPECTATE_PORT ?? 4800 + Math.floor(Math.random() * 200));
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

  console.log('\n== hlediště ==');
  const player = client();
  await player.opened;
  player.send({ t: 'hello', proto: PROTO });
  await player.waitFor((m) => m.t === 'welcome');

  player.send({ t: 'join', game: 'arena' });
  const room = await player.waitFor((m) => m.t === 'room');
  const roomId = room.room.id;
  check('hráč dostal sedlo', room.spectator !== true && room.room.players === 1, JSON.stringify(room.room));

  // Kolik entit má hra bez diváka (hráč + boti v prázdných sedlech).
  const beforeWatch = await player.waitFor((m) => m.t === 'snapshot' && m.game === 'arena', 5000);
  const entitiesBefore = beforeWatch.players.length;

  const watcher = client();
  await watcher.opened;
  watcher.send({ t: 'hello', proto: PROTO });
  await watcher.waitFor((m) => m.t === 'welcome');
  watcher.send({ t: 'join', game: 'arena', room: roomId, spectate: true });

  const seat = await watcher.waitFor((m) => m.t === 'room');
  check('divák dostane potvrzení s příznakem', seat.spectator === true, JSON.stringify(seat));
  check('divák nevidí sám sebe jako hráče', seat.youPlayerId != null);
  check('divák dostane historii chatu', Array.isArray(seat.history));

  // snapshoty chodí i divákovi
  const shot = await watcher.waitFor((m) => m.t === 'snapshot' && m.game === 'arena', 5000).catch(() => null);
  check('divákovi chodí snapshoty', Boolean(shot), shot ? 'ok' : 'žádný snapshot');
  check(
    'divák nezvýší počet entit ve snapshotu',
    Boolean(shot) && shot.players.length === entitiesBefore,
    `před=${entitiesBefore} po=${shot?.players.length ?? '—'}`,
  );

  // lobby počítá diváka zvlášť
  const lobby = await player.waitFor(
    (m) => m.t === 'rooms' && m.rooms.some((entry) => entry.id === roomId && (entry.spectators ?? 0) >= 1),
    5000,
  ).catch(() => null);
  check('lobby ukazuje diváka zvlášť', Boolean(lobby), lobby ? JSON.stringify(lobby.rooms[0]) : 'timeout');
  check(
    'divák se nepočítá do hráčů',
    Boolean(lobby) && lobby.rooms.find((entry) => entry.id === roomId)?.players === 1,
    lobby ? String(lobby.rooms[0]?.players) : '—',
  );

  // divák posílá vstup → server ho nesmí posadit ani rozbít hru
  watcher.send({ t: 'input', forward: 1, strafe: 0, yaw: 0, pitch: 0, jump: false, fire: false, weapon: 0 });
  await sleep(400);
  const after = await watcher.waitFor((m) => m.t === 'snapshot' && m.game === 'arena', 4000).catch(() => null);
  check('vstup diváka hru nerozbije', Boolean(after), after ? 'ok' : 'žádný snapshot');

  // odchod diváka místnost nemaže
  watcher.send({ t: 'leave' });
  await sleep(400);
  const stillThere = await player.waitFor(
    (m) => m.t === 'rooms' && m.rooms.some((entry) => entry.id === roomId),
    4000,
  ).catch(() => null);
  check('po odchodu diváka místnost zůstává', Boolean(stillThere));

  // a naopak: dívat se na neexistující místnost nejde
  const ghost = client();
  await ghost.opened;
  ghost.send({ t: 'hello', proto: PROTO });
  await ghost.waitFor((m) => m.t === 'welcome');
  ghost.send({ t: 'join', game: 'arena', room: 'arena-999', spectate: true });
  const missing = await ghost.waitFor((m) => m.t === 'error', 4000).catch(() => null);
  check('dívat se na neexistující místnost nejde', missing?.code === 'room_missing', String(missing?.code));
  ghost.close();

  watcher.close();
  player.close();
} catch (error) {
  failures += 1;
  console.log(`  FAIL výjimka: ${error.message}`);
  console.log(log.split('\n').slice(-12).join('\n'));
} finally {
  await sleep(200);
  server.kill('SIGTERM');
}

console.log('');
if (failures > 0) {
  console.log(`SPECTATE FAILED (${failures})`);
  process.exit(1);
}
console.log('SPECTATE OK');
