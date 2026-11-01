#!/usr/bin/env node
/**
 * Smoke test služby zion-nirvana-net.
 *
 * Spustí build na náhodném portu, projde handshake, místnosti, presence,
 * rate limit a Origin kontrolu, pak proces ukončí. Běží bez test frameworku
 * (`node test/smoke.mjs`) — stejně se dá pustit na serveru po nasazení.
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { WebSocket } from 'ws';

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, '..', 'dist', 'nirvana-net', 'src', 'index.js');
// náhodný port: zbytky z předchozího běhu nesmí ovlivnit výsledek
const PORT = Number(process.env.SMOKE_PORT ?? 3200 + Math.floor(Math.random() * 700));
const BASE = `http://127.0.0.1:${PORT}/net`;
const WS_URL = `ws://127.0.0.1:${PORT}/net`;

let failures = 0;
function check(name, condition, detail = '') {
  if (condition) {
    console.log(`  OK   ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

/** WS klient se sbírkou zpráv a čekáním na konkrétní typ. */
function client(options = {}) {
  const socket = new WebSocket(WS_URL, options);
  // chyby handshaku se řeší přes `opened`; trvalý listener brání uncaught 'error'
  socket.on('error', () => {});
  const inbox = [];
  const waiters = [];
  socket.on('message', (data) => {
    const message = JSON.parse(data.toString());
    inbox.push(message);
    for (const waiter of [...waiters]) {
      if (waiter.match(message)) {
        waiters.splice(waiters.indexOf(waiter), 1);
        waiter.resolve(message);
      }
    }
  });
  const opened = new Promise((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });
  return {
    socket,
    inbox,
    opened,
    send: (message) => socket.send(JSON.stringify(message)),
    waitFor(match, timeoutMs = 2000) {
      const existing = inbox.find(match);
      if (existing) return Promise.resolve(existing);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error('timeout waiting for message'));
        }, timeoutMs);
        waiters.push({ match, resolve: (m) => { clearTimeout(timer); resolve(m); } });
      });
    },
    close: () => socket.close(),
  };
}

const server = spawn(process.execPath, [entry], {
  env: { ...process.env, NIRVANA_NET_PORT: String(PORT), NIRVANA_NET_ALLOWED_ORIGINS: 'https://nirvana.zionterranova.com' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', (chunk) => { serverLog += chunk.toString(); });
server.stderr.on('data', (chunk) => { serverLog += chunk.toString(); });
const serverExit = new Promise((resolve) => server.once('exit', (code) => resolve(code)));

async function waitForHealth() {
  for (let attempt = 0; attempt < 60; attempt++) {
    const exited = await Promise.race([serverExit, sleep(100).then(() => 'running')]);
    if (exited !== 'running') throw new Error(`služba spadla (exit ${exited}):\n${serverLog}`);
    try {
      const response = await fetch(`${BASE}/health`);
      if (response.ok) return response.json();
    } catch {
      // služba ještě naběhla
    }
  }
  throw new Error(`služba nenaběhla:\n${serverLog}`);
}

try {
  console.log(`\n== ${BASE} ==`);

  const health = await waitForHealth();
  check('health: ok', health.ok === true && health.service === 'zion-nirvana-net', JSON.stringify(health));
  check('health: proto', health.proto === 1);
  check('health: bez spojení', health.connections === 0 && health.rooms === 0);

  const metrics = await (await fetch(`${BASE}/metrics`)).text();
  check('metrics: nirvana_net_up', metrics.includes('nirvana_net_up 1'));
  check('metrics: proto verze', metrics.includes('nirvana_net_proto_version 1'));

  // ── handshake ───────────────────────────────────────────────────────
  const a = client();
  await a.opened;
  a.send({ t: 'hello', proto: 1 });
  const welcome = await a.waitFor((m) => m.t === 'welcome');
  check('welcome: proto', welcome.proto === 1);
  check('welcome: host (bez ZIS)', welcome.you.role === 'guest' && /^host-/.test(welcome.you.name), welcome.you.name);
  check('welcome: žádné místnosti', welcome.rooms.length === 0);

  a.send({ t: 'ping', at: 42 });
  const pong = await a.waitFor((m) => m.t === 'pong');
  check('ping → pong', pong.at === 42);

  // ── místnost a presence ─────────────────────────────────────────────
  a.send({ t: 'join', game: 'arena' });
  const roomA = await a.waitFor((m) => m.t === 'room');
  check('room: arena-1', roomA.room.id === 'arena-1' && roomA.room.game === 'arena', roomA.room.id);
  check('room: 1 hráč', roomA.room.players === 1 && roomA.room.maxPlayers === 8);
  check('room: obsazenost', roomA.occupants.length === 1 && roomA.occupants[0].role === 'guest');
  check('room: spawn prázdný (M0)', roomA.spawn === null);

  const b = client();
  await b.opened;
  b.send({ t: 'hello', proto: 1 });
  await b.waitFor((m) => m.t === 'welcome');
  b.send({ t: 'join', game: 'arena' });
  const roomB = await b.waitFor((m) => m.t === 'room');
  check('quick join: stejná místnost', roomB.room.id === 'arena-1', roomB.room.id);
  check('quick join: 2 hráči', roomB.room.players === 2);

  const joinEvent = await a.waitFor((m) => m.t === 'event' && m.event.kind === 'join');
  check('event: join', joinEvent.event.player.id === welcome.you.id ? false : true, JSON.stringify(joinEvent.event));

  // ── vstup a chat ────────────────────────────────────────────────────
  a.send({ t: 'input', seq: 1, mx: 0, mz: 1, yaw: 0, pitch: 0, jump: false, fire: false, weapon: 0 });
  await sleep(150);
  check('input: bez chyby', !a.inbox.some((m) => m.t === 'error'), JSON.stringify(a.inbox.filter((m) => m.t === 'error')));

  a.send({ t: 'chat', text: 'ahoj' });
  const chatError = await a.waitFor((m) => m.t === 'error' && m.code === 'not_available');
  check('chat: zatím odmítnut (M1)', Boolean(chatError));

  // ── validace a limity ───────────────────────────────────────────────
  a.send({ t: 'nonsense' });
  check('neznámý typ → bad_frame', Boolean(await a.waitFor((m) => m.t === 'error' && m.code === 'bad_frame')));

  const noise = client();
  await noise.opened;
  for (let i = 0; i < 60; i++) noise.send({ t: 'ping', at: i });
  check('rate limit', Boolean(await noise.waitFor((m) => m.t === 'error' && m.code === 'rate_limited', 3000)));
  noise.close();

  // ── Origin ──────────────────────────────────────────────────────────
  const evil = client({ headers: { Origin: 'https://evil.example' } });
  evil.opened.catch(() => {}); // odmítnutý handshake = očekávaný stav, ne chyba testu
  const evilRejected = await new Promise((resolve) => {
    evil.socket.once('open', () => resolve(false));
    evil.socket.once('error', () => resolve(true));
    setTimeout(() => resolve(false), 1500);
  });
  check('cizí Origin odmítnut', evilRejected);

  const good = client({ headers: { Origin: 'https://nirvana.zionterranova.com' } });
  await good.opened;
  good.send({ t: 'hello', proto: 1 });
  await good.waitFor((m) => m.t === 'welcome');
  check('povolený Origin projde', true);
  good.close();

  // ── odpojení uklidí místnost ────────────────────────────────────────
  a.close();
  b.close();
  await sleep(400);
  const after = await (await fetch(`${BASE}/health`)).json();
  check('úklid: 0 místností', after.rooms === 0, JSON.stringify(after));
  check('úklid: 0 spojení', after.connections === 0);
} catch (error) {
  failures += 1;
  console.log(`  FAIL výjimka: ${error.message}`);
  console.log(serverLog.split('\n').slice(-15).join('\n'));
} finally {
  server.kill('SIGTERM');
  if (process.env.SMOKE_VERBOSE === '1') {
    console.log('--- log služby ---');
    console.log(serverLog.trim());
  }
}

await sleep(200);
console.log(failures === 0 ? '\nSMOKE OK\n' : `\nSMOKE FAILED (${failures})\n`);
process.exit(failures === 0 ? 0 : 1);
