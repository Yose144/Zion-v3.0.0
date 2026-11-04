#!/usr/bin/env node
/**
 * Test živého seznamu místností (lobby).
 *
 * Ověřuje, že server posílá `rooms` **každému** hráči, který prošel `hello`,
 * a to při: vytvoření místnosti, příchodu hráče, změně stavu a odchodu.
 * Bez toho by lobby ukazovalo stav z okamžiku připojení.
 *
 * Spustit: node apps/nirvana-net/test/rooms.mjs (po `npm run build`)
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { WebSocket } from 'ws';
import { PROTO_VERSION as PROTO } from '../dist/nirvana/src/core/net/protocol.js';

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, '..', 'dist', 'nirvana-net', 'src', 'index.js');
const PORT = Number(process.env.ROOMS_PORT ?? 4500 + Math.floor(Math.random() * 300));
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

  console.log('\n== lobby: živý seznam místností ==');
  const a = client();
  const b = client();
  await Promise.all([a.opened, b.opened]);
  for (const c of [a, b]) c.send({ t: 'hello', proto: PROTO });
  const welcome = await a.waitFor((m) => m.t === 'welcome');
  check('welcome nese seznam místností', Array.isArray(welcome.rooms) && welcome.rooms.length === 0);

  a.send({ t: 'join', game: 'tanks' });
  const created = await a.waitFor((m) => m.t === 'rooms' && m.rooms.length === 1);
  check('vytvoření místnosti se rozšíří', created.rooms[0].game === 'tanks', JSON.stringify(created.rooms));

  const seenByB = await b.waitFor((m) => m.t === 'rooms' && m.rooms.some((r) => r.players === 1));
  check('seznam dostane i hráč bez místnosti', seenByB.rooms[0].players === 1, String(seenByB.rooms[0]?.players));

  b.send({ t: 'join', game: 'tanks' });
  const twoPlayers = await b.waitFor(
    (m) => m.t === 'rooms' && m.rooms.some((r) => r.players === 2),
  );
  check('příchod hráče změní počet', twoPlayers.rooms[0].players === 2, String(twoPlayers.rooms[0]?.players));

  // změna stavu (waiting → running) se propíše do lobby
  a.send({ t: 'aim', angle: 45, power: 50 });
  a.send({ t: 'shoot' });
  const running = await b.waitFor(
    (m) => m.t === 'rooms' && m.rooms.some((r) => r.state === 'running'),
    8000,
  );
  check('stav místnosti se propíše', running.rooms[0].state === 'running', running.rooms[0]?.state);

  // pozorovatel, který nikdy nevstoupí do místnosti — podle něj se pozná
  // i úklid (odpojený hráč už další zprávu nedostane)
  const c = client();
  await c.opened;
  c.send({ t: 'hello', proto: PROTO });
  await c.waitFor((m) => m.t === 'welcome');

  a.close();
  const afterLeave = await c.waitFor((m) => m.t === 'rooms' && m.rooms.some((r) => r.players === 1), 6000);
  check('odchod hráče se propíše', afterLeave.rooms[0].players === 1, String(afterLeave.rooms[0]?.players));

  b.close();
  const emptied = await c.waitFor((m) => m.t === 'rooms' && m.rooms.length === 0, 6000).catch(() => null);
  check('prázdná místnost zmizí ze seznamu', Boolean(emptied), 'seznam zůstal');
  c.close();
} catch (error) {
  failures += 1;
  console.log(`  FAIL výjimka — ${error.message}`);
  console.log(log.split('\n').slice(-6).join('\n'));
} finally {
  server.kill('SIGTERM');
  await sleep(200);
}

console.log(`\n${failures === 0 ? 'ROOMS OK' : `${failures} CHYB`}`);
process.exit(failures === 0 ? 0 : 1);
