#!/usr/bin/env node
/**
 * Test Merkur ragdoll souboje.
 *
 * Dvě části:
 *  1. **Simulace** (bez sítě): loutka stojí, švih ubírá HP, KO ukončí kolo,
 *     kryt snižuje poškození, časový limit rozhodne kolo, bot v prázdném
 *     sedle útočí a body zůstávají v kleci.
 *  2. **Síť**: dva klienti dojdou do `fight-1`, třetí dostane novou
 *     místnost (cap 2), snapshot nese pózu loutky, vstup hýbe loutkou,
 *     pěst ubírá soupeři HP a po odpojení soupeře doplní bot.
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
const fight = require('../dist/nirvana-net/src/fight.js');
const ragdoll = require('../dist/nirvana/src/core/fight/ragdoll.js');

const PORT = Number(process.env.FIGHT_PORT ?? 3700 + Math.floor(Math.random() * 300));
const WS_URL = `ws://127.0.0.1:${PORT}/net`;

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

const DT = 1 / 30;
const NO_INPUT = { move: 0, jump: false, punch: false, kick: false, block: false };

// ── 1) simulace ───────────────────────────────────────────────────────
console.log('\n== simulace (bez sítě) ==');
{
  // loutka musí stát, ne se složit na podlahu
  const sim = fight.createFight(0);
  let now = 0;
  for (let tick = 0; tick < 30 * 4; tick++) {
    now += DT * 1000;
    fight.stepFight(sim, DT, now);
  }
  const chest = ragdoll.bodyCenterOf(sim.match.a);
  const feet = Math.max(sim.match.a.y[ragdoll.P.FOOT_L], sim.match.a.y[ragdoll.P.FOOT_R]);
  check('loutka stojí (hrudník nad 1,2 m)', chest.y > 1.2, String(chest.y));
  check('chodidla leží na zemi', feet < 0.25, String(feet));
}
{
  // švih ubírá HP soupeři
  const sim = fight.createFight(0);
  fight.addFightPlayer(sim, 'p_a', 'Boxer A', 7, 0);
  fight.addFightPlayer(sim, 'p_b', 'Boxer B', null, 0);
  sim.match.phase = 'playing';
  sim.match.timer = 60;
  // přiblížit A k B (test zásahu, ne pohybu)
  for (let i = 0; i < ragdoll.POINT_COUNT; i++) sim.match.a.x[i] += 4.2;

  let now = 0;
  let reachDamage = false;
  const events = [];
  for (let tick = 0; tick < 30 * 8 && !reachDamage; tick++) {
    now += DT * 1000;
    fight.setFightInput(sim, 'p_a', { move: 1, jump: false, punch: true, kick: false, block: false });
    events.push(...fight.stepFight(sim, DT, now));
    if (sim.match.b.hp < 100) reachDamage = true;
  }
  check('švih ubírá soupeři HP', reachDamage, `hpB=${sim.match.b.hp}`);
  check('zásah se počítá (hits > 0)', sim.match.a.hits > 0, `hits=${sim.match.a.hits}`);
}
{
  // KO přes `damageFighter` — deterministické pravidlo kol
  const sim = fight.createFight(0);
  sim.match.phase = 'playing';
  sim.match.timer = 60;
  const events = [];
  ragdoll.damageFighter(sim.match, sim.match.b, 100, sim.match.a, 0, events);
  let now = 0;
  for (let tick = 0; tick < 30 * 1; tick++) {
    now += DT * 1000;
    events.push(...fight.stepFight(sim, DT, now));
  }
  check('KO nastaví ko', sim.match.b.ko === true);
  check('KO ukončí kolo (roundEnd)', sim.match.phase === 'roundEnd', sim.match.phase);
  check('vítěz kola dostal bod', sim.match.a.wins === 1, String(sim.match.a.wins));
  check('KO event prošel do sítě', events.some((e) => e.kind === 'round_end' && e.reason === 'ko'), JSON.stringify(events.slice(0, 3)));
}
{
  // kryt snižuje poškození (čistá funkce)
  const free = ragdoll.hitDamage(8, 1, false);
  const guarded = ragdoll.hitDamage(8, 1, true);
  const weak = ragdoll.hitDamage(2, 1, false);
  check('kryt snižuje poškození', guarded > 0 && guarded < free, `free=${free} guard=${guarded}`);
  check('pomalý dotek nepoškodí', weak === 0, String(weak));
}
{
  // časový limit
  const sim = fight.createFight(0);
  sim.match.phase = 'playing';
  sim.match.timer = 0.02;
  sim.match.a.hp = 80;
  sim.match.b.hp = 40;
  let now = 0;
  let round = null;
  for (let tick = 0; tick < 30 * 2 && !round; tick++) {
    now += DT * 1000;
    const events = fight.stepFight(sim, DT, now);
    round = events.find((e) => e.kind === 'round_end') ?? null;
  }
  check('na čas rozhodne vyšší HP', Boolean(round) && round.winner === sim.match.a.id, JSON.stringify(round));
  check('důvod kola = time', round?.reason === 'time', round?.reason);
}
{
  // bot v prázdném sedle útočí
  const sim = fight.createFight(0);
  fight.addFightPlayer(sim, 'p_a', 'Samotář', null, 0);
  let now = 0;
  for (let tick = 0; tick < 30 * 35; tick++) {
    now += DT * 1000;
    fight.stepFight(sim, DT, now);
  }
  check('bot v prázdném sedle útočí', sim.match.b.hits > 0 || sim.match.a.hp < 100,
    `hits=${sim.match.b.hits} hpA=${sim.match.a.hp}`);
}
{
  // hranice klece a podlaha
  const sim = fight.createFight(0);
  sim.match.phase = 'playing';
  sim.match.timer = 60;
  let now = 0;
  let outside = false;
  for (let tick = 0; tick < 30 * 10; tick++) {
    now += DT * 1000;
    fight.setFightInput(sim, 'p_a', { move: 1, jump: tick % 40 === 0, punch: tick % 20 === 0, kick: false, block: false });
    fight.stepFight(sim, DT, now);
    for (const side of ['a', 'b']) {
      const f = sim.match[side];
      for (let i = 0; i < ragdoll.POINT_COUNT; i++) {
        if (Math.abs(f.x[i]) > ragdoll.ARENA_HALF + 0.01 || f.y[i] < -0.01 || f.y[i] > 16.5) outside = true;
      }
    }
  }
  check('loutky zůstávají v kleci', !outside);
}

// obtížnosti mají být měřitelně různé
{
  const sample = (difficulty) => {
    const sim = fight.createFight(0);
    sim.match.phase = 'playing';
    sim.match.timer = 60;
    const memory = ragdoll.makeBotMemory();
    let decisions = 0;
    let guards = 0;
    for (let frame = 0; frame < 300; frame++) {
      const before = memory.nextThink;
      const input = ragdoll.botInput(sim.match, 'b', memory, difficulty, frame / 30);
      if (memory.nextThink !== before) decisions += 1;
      if (input.block) guards += 1;
    }
    return { decisions, guards };
  };
  const gentle = sample('gentle');
  const champion = sample('champion');
  check('mistr se rozhoduje častěji než klidný', champion.decisions > gentle.decisions,
    `gentle=${gentle.decisions} champion=${champion.decisions}`);
}

// ── 2) síť ────────────────────────────────────────────────────────────
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

  console.log('\n== síť (tři klienti) ==');
  const a = client();
  const b = client();
  const c = client();
  await Promise.all([a.opened, b.opened, c.opened]);
  for (const socket of [a, b, c]) socket.send({ t: 'hello', proto: PROTO });
  await a.waitFor((m) => m.t === 'welcome');
  await b.waitFor((m) => m.t === 'welcome');
  await c.waitFor((m) => m.t === 'welcome');

  a.send({ t: 'join', game: 'fight' });
  const roomA = await a.waitFor((m) => m.t === 'room');
  check('místnost duelu fight-1', roomA.room.id === 'fight-1' && roomA.room.game === 'fight', roomA.room.id);
  check('kapacita duelu = 2', roomA.room.maxPlayers === 2, String(roomA.room.maxPlayers));
  check('youPlayerId i pro duel', typeof roomA.youPlayerId === 'string');

  b.send({ t: 'join', game: 'fight' });
  const roomB = await b.waitFor((m) => m.t === 'room');
  check('druhý padne do fight-1', roomB.room.id === 'fight-1', roomB.room.id);

  const snapshot = await a.waitFor((m) => m.t === 'snapshot' && m.game === 'fight' && m.players.length === 2);
  check('snapshot duelu: 2 loutky', snapshot.players.length === 2);
  check('snapshot: jména i id', snapshot.players.every((p) => p.name && p.id), JSON.stringify(snapshot.players.map((p) => p.name)));
  check('snapshot: póza ragdoll (22 čísel)', snapshot.players.every((p) => Array.isArray(p.pose) && p.pose.length === 22),
    JSON.stringify(snapshot.players.map((p) => p.pose?.length)));
  check('snapshot: odpočet', snapshot.state === 'countdown' && snapshot.countdown > 0, JSON.stringify({ state: snapshot.state }));

  // třetí klient = nová místnost
  c.send({ t: 'join', game: 'fight' });
  const roomC = await c.waitFor((m) => m.t === 'room');
  check('třetí jde do fight-2', roomC.room.id === 'fight-2', roomC.room.id);

  const started = await a.waitFor((m) => m.t === 'event' && m.event.kind === 'round_start', 9000);
  check('round_start event', Boolean(started));

  const me = () => {
    const snap = a.last((m) => m.t === 'snapshot' && m.game === 'fight');
    return snap?.players.find((p) => p.id === roomA.youPlayerId);
  };
  const foe = () => {
    const snap = a.last((m) => m.t === 'snapshot' && m.game === 'fight');
    return snap?.players.find((p) => p.id !== roomA.youPlayerId);
  };
  const beforeX = me()?.x ?? 0;
  for (let index = 0; index < 60; index++) {
    a.send({ t: 'input', seq: index, mx: 1, mz: 0, yaw: 0, pitch: 0, jump: false, fire: false, weapon: 0, block: false });
    await sleep(35);
  }
  const afterX = me()?.x ?? 0;
  check('pohyb hýbe loutkou', Math.abs(afterX - beforeX) > 1.2, `${beforeX}→${afterX}`);

  // úder: přibliž se a mláti
  const foeHpBefore = foe()?.hp ?? 100;
  let hurt = false;
  for (let index = 0; index < 180 && !hurt; index++) {
    const selfNow = me();
    const foeNow = foe();
    if (!selfNow || !foeNow) {
      await sleep(40);
      continue;
    }
    const gap = foeNow.x - selfNow.x;
    const close = Math.abs(gap) < ragdoll.PUNCH_REACH - 0.1;
    a.send({
      t: 'input', seq: index, mx: close ? 0 : gap > 0 ? 1 : -1, mz: 0, yaw: 0, pitch: 0,
      jump: false, fire: true, weapon: 0, block: false,
    });
    await sleep(35);
    hurt = (foe()?.hp ?? 100) < foeHpBefore;
  }
  const foeHpAfter = foe()?.hp ?? 100;
  check('úder ubírá soupeři HP', hurt, `${foeHpBefore}→${foeHpAfter}`);

  // odpojení b → bot doplní sedlo
  b.close();
  await sleep(700);
  const soloSnap = a.last((m) => m.t === 'snapshot' && m.game === 'fight');
  const botFilled = soloSnap.players.some((p) => p.id.startsWith('bot-'));
  check('po odpojení doplní server meta-bota', soloSnap.players.length === 2 && botFilled,
    JSON.stringify(soloSnap.players.map((p) => p.id)));

  c.close();
  a.close();
  await sleep(500);
  const health = await (await fetch(`http://127.0.0.1:${PORT}/net/health`)).json();
  check('úklid místností', health.rooms === 0, JSON.stringify(health));
} catch (error) {
  check('síťová část nespadla', false, String(error));
  console.log(log.slice(-2000));
} finally {
  server.kill();
}

console.log(`\nfight: ${failures === 0 ? 'PASSED' : `${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
