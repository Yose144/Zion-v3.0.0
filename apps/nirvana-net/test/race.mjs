#!/usr/bin/env node
/**
 * Test Venuše v multiplayeru.
 *
 * Dvě části:
 *  1. **Simulace** (bez sítě): dva jezdce řídí stejná AI jako sólo boti,
 *     server odsimuluje tři kola a musí je nechat dojet + vyhlásit pořadí.
 *  2. **Síť**: dva klienti se připojí, projde odpočet, plyn je opravdu pohne.
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
const race = require('../dist/nirvana-net/src/race.js');
const { buildTrack } = require('../dist/nirvana/src/core/race/track.js');
const { rivalInput } = require('../dist/nirvana/src/core/race/rivals.js');

const PORT = Number(process.env.RACE_PORT ?? 3600 + Math.floor(Math.random() * 300));
const WS_URL = `ws://127.0.0.1:${PORT}/net`;

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

// ── 1) simulace: tři kola, dva jezdci ─────────────────────────────────
{
  console.log('\n== simulace (bez sítě) ==');
  const sim = race.createRace(1000);
  const track = buildTrack();
  const a = race.addRacePlayer(sim, 'p_a', 'Jezdec A', 3, 1000);
  const b = race.addRacePlayer(sim, 'p_b', 'Jezdec B', null, 1000);

  const dt = 1 / 30;
  let now = 1000;
  const events = [];
  for (let tick = 0; tick < 30 * 200; tick++) {
    now += dt * 1000;
    for (const player of [a, b]) {
      // stejná AI jako sólo boti: feed-forward na směr tratě
      const input = rivalInput(
        { spec: { id: player.id, nameCs: '', nameEn: '', color: '#fff', skill: 0.85 }, craft: player.craft, lap: player.lap },
        track,
      );
      race.setRaceInput(sim, player.id, { throttle: input.throttle, steer: input.steer });
    }
    events.push(...race.stepRace(sim, dt, now));
    if (sim.phase === 'ended') break;
  }

  const startEvent = events.find((event) => event.kind === 'race_start');
  const finishes = events.filter((event) => event.kind === 'finish');
  const endEvent = events.find((event) => event.kind === 'race_end');

  check('odpočet → start závodu', Boolean(startEvent));
  check('oba dojeli', finishes.length === 2, String(finishes.length));
  check('pořadí je 1 a 2', finishes.map((f) => f.position).sort().join(',') === '1,2',
    finishes.map((f) => f.position).join(','));
  check('časy jsou rozumné (60–200 s)', finishes.every((f) => f.totalSeconds > 60 && f.totalSeconds < 200),
    finishes.map((f) => f.totalSeconds).join(', '));
  check('závod skončil', sim.phase === 'ended');
  check('pořadí v race_end', Boolean(endEvent) && endEvent.standings.length === 2 &&
    endEvent.standings[0].totalSeconds <= endEvent.standings[1].totalSeconds,
    JSON.stringify(endEvent?.standings));
  check('tři kola', endEvent.standings.every((row) => row.laps === 3),
    JSON.stringify(endEvent?.standings.map((r) => r.laps)));
}

// ── 2) síť: dva klienti ───────────────────────────────────────────────
const server = spawn(process.execPath, [entry], {
  env: {
    ...process.env,
    NIRVANA_NET_PORT: String(PORT),
    NIRVANA_NET_ALLOWED_ORIGINS: 'http://127.0.0.1:3055',
    ZIS_URL: 'http://127.0.0.1:1',
    // testy nemají ZAP cookie — bez tohohle by každý join skončil pass_required
    NIRVANA_NET_REQUIRE_PASS: '0',
    // testy úklidu: reconnect vypnutý, jinak sedlo drží 45 s
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
        if (Date.now() - started > ms) throw new Error('timeout: ' + match.toString().slice(0, 40));
        await sleep(40);
      }
    },
    close: () => socket.close(),
  };
}

try {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/net/health`);
      if (response.ok) break;
    } catch { /* start */ }
    await sleep(100);
  }

  console.log('\n== síť (dva klienti) ==');
  const a = client();
  const b = client();
  await a.opened;
  await b.opened;
  a.send({ t: 'hello', proto: PROTO });
  b.send({ t: 'hello', proto: PROTO });
  await a.waitFor((m) => m.t === 'welcome');
  await b.waitFor((m) => m.t === 'welcome');

  a.send({ t: 'join', game: 'race' });
  const roomA = await a.waitFor((m) => m.t === 'room');
  check('místnost závodu', roomA.room.id === 'race-1' && roomA.room.game === 'race', roomA.room.id);
  check('youPlayerId i pro závod', typeof roomA.youPlayerId === 'string');

  b.send({ t: 'join', game: 'race' });
  await b.waitFor((m) => m.t === 'room');

  const snapshot = await a.waitFor((m) => m.t === 'snapshot' && m.game === 'race' && m.players.length === 2);
  check('snapshot závodu: 2 jezdci', snapshot.players.length === 2);
  check('snapshot: jména', snapshot.players.every((p) => typeof p.name === 'string' && p.name.length > 0),
    JSON.stringify(snapshot.players.map((p) => p.name)));
  check('snapshot: avatarId (host = null)', snapshot.players.every((p) => p.avatarId === null),
    JSON.stringify(snapshot.players.map((p) => p.avatarId)));
  check('snapshot: odpočet', snapshot.state === 'countdown' && snapshot.countdown > 0,
    JSON.stringify({ state: snapshot.state, countdown: snapshot.countdown }));
  check('snapshot: tři kola', snapshot.laps === 3, String(snapshot.laps));

  // počkat na start závodu
  const started = await a.waitFor((m) => m.t === 'event' && m.event.kind === 'race_start', 8000);
  check('race_start event', Boolean(started));

  const me = () => {
    const snap = a.last((m) => m.t === 'snapshot' && m.game === 'race');
    return snap?.players.find((p) => p.id === roomA.youPlayerId);
  };
  const before = me();
  for (let index = 0; index < 45; index++) {
    a.send({
      t: 'input', seq: index, mx: 0, mz: 1, yaw: 0, pitch: 0,
      jump: false, fire: false, weapon: 0,
    });
    await sleep(40);
  }
  await sleep(200);
  const after = me();
  const moved = Math.hypot(after.x - before.x, after.z - before.z);
  check('plyn hýbe vozítkem', moved > 2, `${moved.toFixed(2)} m`);
  check('rychlost roste', after.speed > 3, String(after.speed));

  b.close();
  await sleep(500);
  const solo = a.last((m) => m.t === 'snapshot' && m.game === 'race');
  check('po odpojení 1 jezdec', solo.players.length === 1, String(solo.players.length));

  a.close();
  await sleep(300);
  const health = await (await fetch(`http://127.0.0.1:${PORT}/net/health`)).json();
  check('úklid místnosti', health.rooms === 0, JSON.stringify(health));
} catch (error) {
  failures += 1;
  console.log(`  FAIL výjimka: ${error.message}`);
  console.log(log.split('\n').slice(-10).join('\n'));
} finally {
  server.kill('SIGTERM');
}

await sleep(150);
console.log(failures === 0 ? '\nRACE OK\n' : `\nRACE FAILED (${failures})\n`);
process.exit(failures === 0 ? 0 : 1);
