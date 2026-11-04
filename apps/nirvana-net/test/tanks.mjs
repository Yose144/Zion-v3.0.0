#!/usr/bin/env node
/**
 * Test multiplayeru TANKŮ (Saturn) — 1v1 artilerie.
 *
 * Dvě části:
 *  1. **Simulace** (bez sítě): `createTanks(…, { autoBot: false })` nesmí
 *     sám střílet za druhého hráče; s `autoBot: true` naopak ano. Ověřuje
 *     i to, že serverová strana (`tanksHpForTest`) sedí na simulaci.
 *  2. **Síť**: dva klienti v `tanks-1`, první má stranu 0 a je na tahu,
 *     `aim` od něj server přijme, `aim` od soupeře ne, `shoot` spustí let
 *     a po dopadu se tah předá; terén se posílá jen při změně.
 *
 * Spustit: node apps/nirvana-net/test/tanks.mjs (po `npm run build`)
 */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { WebSocket } from 'ws';
import { PROTO_VERSION as PROTO } from '../dist/nirvana/src/core/net/protocol.js';

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, '..', 'dist', 'nirvana-net', 'src', 'index.js');
const require = createRequire(import.meta.url);
const sim = require('../dist/nirvana/src/core/saturn/tanks.js');

const PORT = Number(process.env.TANKS_PORT ?? 4100 + Math.floor(Math.random() * 300));
const WS_URL = `ws://127.0.0.1:${PORT}/net`;

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

// ── 1) simulace ───────────────────────────────────────────────────────
console.log('\n== simulace bez sítě ==');
{
  const manual = sim.createTanks(5, { autoBot: false });
  for (let i = 0; i < 300; i += 1) sim.stepTanks(manual, 1 / 30);
  check('autoBot=false: bot sám nevypálí', manual.shotsFired === 0, String(manual.shotsFired));

  const auto = sim.createTanks(5, { autoBot: true });
  auto.player.angle = 45;
  auto.player.power = 50;
  sim.fire(auto, 'player');
  // bot dostane tah až po dopadu; `autoBot` znamená, že si ho vezme sám
  for (let i = 0; i < 900 && auto.shotsFired < 2; i += 1) sim.stepTanks(auto, 1 / 30);
  check('autoBot=true: bot vypálí sám', auto.shotsFired >= 2, String(auto.shotsFired));

  const fire = sim.createTanks(5, { autoBot: false });
  const tip = sim.barrelTip(fire, 'player');
  check('hlaveň hráče je vpravo od tanku', tip.x > fire.player.x);
  fire.player.angle = 50;
  fire.player.power = 70;
  check('fire() vystřelí', sim.fire(fire, 'player') === true);
  check('po výstřelu je fáze letu', fire.phase === 'flight');
  // po dopadu je chvíle `resolve` (900 ms), teprve pak se předá tah
  for (let i = 0; i < 900 && fire.phase !== 'aim'; i += 1) sim.stepTanks(fire, 1 / 30);
  check('střela doletí a tah se předá', fire.phase === 'aim' && fire.turn === 'bot', `${fire.phase}/${fire.turn}`);
}

// ── 2) síť ────────────────────────────────────────────────────────────
const server = spawn(process.execPath, [entry], {
  env: {
    ...process.env,
    NIRVANA_NET_PORT: String(PORT),
    NIRVANA_NET_ALLOWED_ORIGINS: 'http://127.0.0.1:3055',
    ZIS_URL: 'http://127.0.0.1:1',
    // testy úklidu: reconnect vypnutý, jinak sedlo drží 45 s
    NIRVANA_NET_RESUME_MS: '0',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
server.stdout.on('data', (chunk) => { log += chunk.toString(); });
server.stderr.on('data', (chunk) => { log += chunk.toString(); });

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
    async waitFor(match, ms = 10000) {
      const started = Date.now();
      for (;;) {
        const found = this.last(match);
        if (found) return found;
        if (Date.now() - started > ms) throw new Error('timeout: ' + match.toString().slice(0, 40));
        await sleep(40);
      }
    },
    close: () => socket.close(),
  };
}

const snapshotOf = (client) => client.last((m) => m.t === 'snapshot' && m.game === 'tanks')?.tanks ?? null;

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

  console.log('\n== síť (dva klienti) ==');
  const a = client();
  const b = client();
  await Promise.all([a.opened, b.opened]);
  for (const socket of [a, b]) socket.send({ t: 'hello', proto: PROTO });
  await a.waitFor((m) => m.t === 'welcome');
  await b.waitFor((m) => m.t === 'welcome');

  a.send({ t: 'join', game: 'tanks' });
  const roomA = await a.waitFor((m) => m.t === 'room');
  check('místnost tanks-1', roomA.room.id === 'tanks-1' && roomA.room.game === 'tanks', roomA.room.id);
  check('kapacita tanků = 2', roomA.room.maxPlayers === 2, String(roomA.room.maxPlayers));

  b.send({ t: 'join', game: 'tanks' });
  const roomB = await b.waitFor((m) => m.t === 'room');
  check('oba ve stejné místnosti', roomB.room.id === roomA.room.id, `${roomB.room.id} vs ${roomA.room.id}`);

  const first = await a.waitFor((m) => m.t === 'snapshot' && m.game === 'tanks' && m.tanks);
  const second = await b.waitFor((m) => m.t === 'snapshot' && m.game === 'tanks' && m.tanks);
  check('snapshot nese stranu hráče', first.tanks.you === 0 && second.tanks.you === 1, `${first.tanks.you}/${second.tanks.you}`);
  check('první hráč je na tahu', first.tanks.turn === 0, String(first.tanks.turn));
  // `waitFor` vrací POSLEDNÍ zprávu, takže první snapshot s terénem hledáme
  // v inboxu (terén se posílá jen při změně — podruhé už `null`).
  const firstSnapshot = a.inbox.find((m) => m.t === 'snapshot' && m.game === 'tanks' && m.tanks);
  check(
    'terén přišel poprvé',
    Array.isArray(firstSnapshot?.tanks.terrain) && firstSnapshot.tanks.terrain.length > 100,
    String(firstSnapshot?.tanks.terrain?.length),
  );
  check('dva tanky ve snapshotu', first.tanks.tanks.length === 2 && first.tanks.tanks.every((t) => t.hp === 100));

  const later = await a.waitFor((m) => m.t === 'snapshot' && m.game === 'tanks' && m.tanks && m.tanks.terrain === null);
  check('terén se neposílá opakovaně', Boolean(later), 'druhý snapshot měl terrain');

  // mířidlo: první hráč nastaví, soupeř zkusí totéž (nesmí projít)
  a.send({ t: 'aim', angle: 62, power: 70 });
  await sleep(180);
  check('hráč na tahu: úhel přijat', Math.abs(snapshotOf(a).tanks[0].angle - 62) < 1, String(snapshotOf(a).tanks[0].angle));
  const angleBefore = snapshotOf(b).tanks[1].angle;
  b.send({ t: 'aim', angle: 20, power: 20 });
  await sleep(180);
  check('soupeř mimo tah: úhel zůstal', Math.abs(snapshotOf(b).tanks[1].angle - angleBefore) < 1, String(snapshotOf(b).tanks[1].angle));

  // validace rozsahu — server nepustí úhel 500
  a.send({ t: 'aim', angle: 500, power: 500 });
  await sleep(180);
  const clamped = snapshotOf(a).tanks[0];
  check('server ořeže úhel i sílu', clamped.angle === 90 && clamped.power === 100, `${clamped.angle}/${clamped.power}`);

  // výstřel → let → tah soupeře
  a.send({ t: 'shoot' });
  const flying = await a.waitFor((m) => m.t === 'snapshot' && m.tanks && m.tanks.phase === 'flight', 6000);
  check('výstřel spustí let', Boolean(flying));
  const handed = await a.waitFor((m) => m.t === 'snapshot' && m.tanks && m.tanks.turn === 1, 12000);
  check('po dopadu je na tahu soupeř', Boolean(handed));
  check('soupeř dostal snapshot se svým tahem', (await b.waitFor((m) => m.t === 'snapshot' && m.tanks && m.tanks.turn === 1, 6000)).tanks.turn === 1);

  // bot nesmí hrát za člověka
  const shotsBefore = snapshotOf(a).shots;
  await sleep(2200);
  check('bot s plnou místností sám nestřílí', snapshotOf(a).shots === shotsBefore, `${shotsBefore} → ${snapshotOf(a).shots}`);

  // odpojení → místnost se uklidí
  a.close();
  b.close();
  await sleep(600);
  const health = await (await fetch(`http://127.0.0.1:${PORT}/net/health`)).json();
  check('úklid: místnosti zmizely', health.rooms === 0, JSON.stringify(health));
} catch (error) {
  failures += 1;
  console.log(`  FAIL výjimka — ${error.message}`);
  console.log(log.split('\n').slice(-6).join('\n'));
} finally {
  server.kill('SIGTERM');
  await sleep(200);
}

console.log(`\n${failures === 0 ? 'TANKS OK' : `${failures} CHYB`}`);
process.exit(failures === 0 ? 0 : 1);
