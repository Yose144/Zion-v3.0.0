#!/usr/bin/env node
/**
 * Smoke test služby zion-nirvana-net (M0 + M1).
 *
 * Spustí **stub ZIS** a build služby na náhodných portech, projde handshake,
 * hosta (read-only), přihlášeného (chat), rate limit, sanitizaci, místnosti,
 * Origin kontrolu a úklid. Bez test frameworku — `node test/smoke.mjs`.
 *
 * Stub ZIS záměrně není skutečná ZIS: testujeme, že služba umí rozlišit
 * platnou session od neplatné, ne že ZIS funguje.
 */

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { WebSocket } from 'ws';

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, '..', 'dist', 'nirvana-net', 'src', 'index.js');
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

// ── stub ZIS ──────────────────────────────────────────────────────────
const ZIS_USER = {
  id: 'u_test_1',
  primaryAddress: 'zion1testaddressxxxxxxxxxxxxxxxxxxx',
  displayName: 'Tester',
  avatar: '/api/auth/avatar/u_test_1.svg',
  avatar3d: { callsign: 'Poutník', avatarId: 7 },
};
const zis = createServer((request, response) => {
  const cookie = request.headers.cookie ?? '';
  if (request.url === '/api/auth/me' && cookie.includes('zion_session=good')) {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(ZIS_USER));
    return;
  }
  response.writeHead(401, { 'content-type': 'application/json' });
  response.end('{"error":"unauthorized"}');
});
await new Promise((resolve) => zis.listen(0, '127.0.0.1', resolve));
const ZIS_PORT = zis.address().port;

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
  opened.catch(() => {});

  return {
    socket,
    inbox,
    opened,
    send: (message) => socket.send(JSON.stringify(message)),
    waitFor(match, timeoutMs = 2000) {
      const existing = [...inbox].reverse().find(match);
      if (existing) return Promise.resolve(existing);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout waiting for message')), timeoutMs);
        waiters.push({ match, resolve: (m) => { clearTimeout(timer); resolve(m); } });
      });
    },
    close: () => socket.close(),
  };
}

const server = spawn(process.execPath, [entry], {
  env: {
    ...process.env,
    NIRVANA_NET_PORT: String(PORT),
    NIRVANA_NET_ALLOWED_ORIGINS: 'https://nirvana.zionterranova.com',
    ZIS_URL: `http://127.0.0.1:${ZIS_PORT}`,
  },
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
      // služba ještě nenaběhla
    }
  }
  throw new Error(`služba nenaběhla:\n${serverLog}`);
}

try {
  console.log(`\n== ${BASE} (stub ZIS na :${ZIS_PORT}) ==`);

  const health = await waitForHealth();
  check('health: ok', health.ok === true && health.service === 'zion-nirvana-net', JSON.stringify(health));
  check('health: proto 4', health.proto === 4, String(health.proto));
  check('health: bez spojení', health.connections === 0 && health.rooms === 0);

  const metrics = await (await fetch(`${BASE}/metrics`)).text();
  check('metrics: nirvana_net_up', metrics.includes('nirvana_net_up 1'));
  check('metrics: chat counter', metrics.includes('nirvana_net_chat_messages_total'));

  // ── host: čte, ale nepíše ───────────────────────────────────────────
  const guest = client();
  await guest.opened;
  guest.send({ t: 'hello', proto: 4 });
  const guestWelcome = await guest.waitFor((m) => m.t === 'welcome');
  check('host: role guest', guestWelcome.you.role === 'guest' && /^host-/.test(guestWelcome.you.name));
  check('host: prázdná historie', guestWelcome.history.length === 0);
  check('host: online 1', guestWelcome.online === 1, String(guestWelcome.online));

  guest.send({ t: 'chat', text: 'ahoj' });
  const readOnly = await guest.waitFor((m) => m.t === 'error' && m.code === 'read_only');
  check('host: chat odmítnut (read_only)', Boolean(readOnly));

  // ── přihlášený (ZIS) ────────────────────────────────────────────────
  const zisClient = client({ headers: { Cookie: 'zion_session=good' } });
  await zisClient.opened;
  zisClient.send({ t: 'hello', proto: 4 });
  const zisWelcome = await zisClient.waitFor((m) => m.t === 'welcome');
  check('zis: role zis', zisWelcome.you.role === 'zis', zisWelcome.you.role);
  check('zis: jméno z callsignu', zisWelcome.you.name === 'Poutník', zisWelcome.you.name);
  check('zis: avatarId z avatar3d', zisWelcome.you.avatarId === 7, String(zisWelcome.you.avatarId));
  check('seznam přítomných', Array.isArray(zisWelcome.members) && zisWelcome.members.length === 2,
    JSON.stringify(zisWelcome.members));
  const me = zisWelcome.members.find((m) => m.role === 'zis');
  check('člen má avatar', Boolean(me && me.avatar && me.avatar.includes('/api/auth/avatar/')), JSON.stringify(me));
  check(
    'zis: avatar URL absolutní',
    String(zisWelcome.you.avatar).startsWith(`http://127.0.0.1:${ZIS_PORT}/api/auth/avatar/`),
    String(zisWelcome.you.avatar),
  );

  const presence = await guest.waitFor(
    (m) => m.t === 'event' && m.event.kind === 'presence' && m.event.members.some((x) => x.role === 'zis'),
  );
  check('host vidí přítomnost', presence.event.online === 2, String(presence.event.online));

  // ── chat: oba ho vidí, text se čistí ────────────────────────────────
  zisClient.send({ t: 'chat', text: 'Ahoj <script>alert(1)</script>  světe' });
  const chatForGuest = await guest.waitFor((m) => m.t === 'event' && m.event.kind === 'chat');
  check('host dostane zprávu', chatForGuest.event.text.includes('Ahoj'));
  check('sanitizace < >', !chatForGuest.event.text.includes('<') && !chatForGuest.event.text.includes('>'), chatForGuest.event.text);
  check('autor zprávy', chatForGuest.event.name === 'Poutník' && chatForGuest.event.role === 'zis');
  // z tagu nesmí zůstat ani znak; vnitřní text („alert(1)") je jen text, ne kód
  check(
    'z tagů nic nezbylo',
    !/[<>]/.test(chatForGuest.event.text) && !/<\/?script/i.test(chatForGuest.event.text),
    chatForGuest.event.text,
  );

  // jedna zpráva = jedna událost (žádné dvojí odeslání)
  const chatEvents = guest.inbox.filter((m) => m.t === 'event' && m.event.kind === 'chat');
  check('jedna zpráva = jeden event', chatEvents.length === 1, String(chatEvents.length));

  // ── příkazy a rate limit ────────────────────────────────────────────
  zisClient.send({ t: 'chat', text: '/who' });
  const who = await zisClient.waitFor((m) => m.t === 'event' && m.event.kind === 'system');
  check('/who vypíše kanál', who.event.text.includes('Poutník'), who.event.text);

  // 2 zprávy / 2 s → třetí musí dostat rate_limited
  zisClient.send({ t: 'chat', text: 'jedna' });
  zisClient.send({ t: 'chat', text: 'dva' });
  zisClient.send({ t: 'chat', text: 'tři' });
  const flood = await zisClient.waitFor((m) => m.t === 'error' && m.code === 'rate_limited', 3000);
  check('chat rate limit (2/2 s)', Boolean(flood));

  // ── neplatná session = host ─────────────────────────────────────────
  const badCookie = client({ headers: { Cookie: 'zion_session=rozbitá' } });
  await badCookie.opened;
  badCookie.send({ t: 'hello', proto: 4 });
  const badWelcome = await badCookie.waitFor((m) => m.t === 'welcome');
  check('neplatná session → host', badWelcome.you.role === 'guest');
  badCookie.close();

  // ── historie se vrací novému hráči ──────────────────────────────────
  await sleep(200);
  const late = client();
  await late.opened;
  late.send({ t: 'hello', proto: 4 });
  const lateWelcome = await late.waitFor((m) => m.t === 'welcome');
  check('historie pro nováčka', lateWelcome.history.length >= 1, String(lateWelcome.history.length));
  late.close();

  // ── místnosti ───────────────────────────────────────────────────────
  zisClient.send({ t: 'join', game: 'arena' });
  const room = await zisClient.waitFor((m) => m.t === 'room');
  check('room: arena-1', room.room.id === 'arena-1', room.room.id);
  check('room: 1 hráč', room.room.players === 1);

  // park po odchodu do místnosti pošle nový seznam (bez Poutníka)
  const parkWithout = await guest.waitFor(
    (m) => m.t === 'event' && m.event.kind === 'presence' && !m.event.members.some((x) => x.name === 'Poutník'),
  );
  check('park ohlásí odchod do místnosti', parkWithout.event.online >= 1);

  zisClient.send({ t: 'leave' });
  await sleep(200);
  const back = await guest.waitFor(
    (m) => m.t === 'event' && m.event.kind === 'presence' && m.event.members.some((x) => x.name === 'Poutník'),
  );
  check('návrat do parku ohlášen', Boolean(back));

  // ── validace ────────────────────────────────────────────────────────
  guest.send({ t: 'nonsense' });
  check('neznámý typ → bad_frame', Boolean(await guest.waitFor((m) => m.t === 'error' && m.code === 'bad_frame')));

  const lowProto = client();
  await lowProto.opened;
  lowProto.send({ t: 'hello', proto: 1 });
  const mismatch = await lowProto.waitFor((m) => m.t === 'error' && m.code === 'proto_mismatch');
  check('starý proto → proto_mismatch', Boolean(mismatch));

  const noise = client();
  await noise.opened;
  for (let i = 0; i < 60; i++) noise.send({ t: 'ping', at: i });
  check('rate limit rámců', Boolean(await noise.waitFor((m) => m.t === 'error' && m.code === 'rate_limited', 3000)));
  noise.close();

  // ── Origin ──────────────────────────────────────────────────────────
  const evil = client({ headers: { Origin: 'https://evil.example' } });
  const evilRejected = await new Promise((resolve) => {
    evil.socket.once('open', () => resolve(false));
    evil.socket.once('error', () => resolve(true));
    setTimeout(() => resolve(false), 1500);
  });
  check('cizí Origin odmítnut', evilRejected);

  const good = client({ headers: { Origin: 'https://nirvana.zionterranova.com' } });
  await good.opened;
  good.send({ t: 'hello', proto: 4 });
  await good.waitFor((m) => m.t === 'welcome');
  check('povolený Origin projde', true);
  good.close();

  // ── úklid ───────────────────────────────────────────────────────────
  guest.close();
  zisClient.close();
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
  zis.close();
  if (process.env.SMOKE_VERBOSE === '1') {
    console.log('--- log služby ---');
    console.log(serverLog.trim());
  }
}

await sleep(200);
console.log(failures === 0 ? '\nSMOKE OK\n' : `\nSMOKE FAILED (${failures})\n`);
process.exit(failures === 0 ? 0 : 1);
