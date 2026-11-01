#!/usr/bin/env node
/**
 * Test Merkur duelu.
 *
 * Dvě části:
 *  1. **Simulace** (bez sítě): `stepFight` s inputy musí zasadit zásah,
 *     srážet HP na nulu, počítat kola, ukončit zápas a restartovat ho;
 *     blok musí mazat poškození a bot musí obsadit prázdné sedlo.
 *  2. **Síť**: dva klienti dojdou do `fight-1`, třetí dostane novou
 *     místnost (cap 2), vstup hýbe bojovníkem, pěst ubírá soupeři HP,
 *     po odpojení soupeře doplní bot.
 */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { WebSocket } from 'ws';

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, '..', 'dist', 'nirvana-net', 'src', 'index.js');
const require = createRequire(import.meta.url);
const fight = require('../dist/nirvana-net/src/fight.js');
const duel = require('../dist/nirvana/src/core/fight/duel.js');

const PORT = Number(process.env.FIGHT_PORT ?? 3700 + Math.floor(Math.random() * 300));
const WS_URL = `ws://127.0.0.1:${PORT}/net`;

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

const DT = 1 / 30;

// ── 1) simulace ───────────────────────────────────────────────────────
console.log('\n== simulace (bez sítě) ==');
{
  const sim = fight.createFight(1000);
  fight.addFightPlayer(sim, 'p_a', 'Boxer A', 7, 1000);
  fight.addFightPlayer(sim, 'p_b', 'Boxer B', null, 1000);

  let now = 1000;
  const events = [];
  let reachedDamage = false;
  for (let tick = 0; tick < 30 * 40; tick++) {
    now += DT * 1000;
    // A nejdřív doběhne do dosahu (během úderu se nestojí na místě a nekročí)
    const dx = sim.duel.b.x - sim.duel.a.x;
    const inRange = Math.abs(dx) <= duel.PUNCH.reach - 0.3;
    fight.setFightInput(sim, 'p_a', {
      move: inRange ? 0 : dx > 0 ? 1 : -1,
      jump: false,
      punch: inRange,
      kick: false,
      block: false,
    });
    fight.setFightInput(sim, 'p_b', { move: 0, jump: false, punch: false, kick: false, block: false });
    events.push(...fight.stepFight(sim, DT, now));
    if (sim.duel.b.hp < 100) reachedDamage = true;
    if (events.some((e) => e.kind === 'duel_end')) break;
  }

  const ko = events.find((e) => e.kind === 'duel_ko');
  const end = events.find((e) => e.kind === 'duel_end');
  check('A uštědřil zásah (B ztrácí HP)', reachedDamage, `hpB=${sim.duel.b.hp}`);
  check('K.O. event', Boolean(ko) && ko.winner === 'p_a' && ko.loser === 'p_b', JSON.stringify(ko));
  check('vyhrál 2:0', Boolean(end) && end.winner === 'p_a' && end.aWins === 2 && end.bWins === 0,
    JSON.stringify(end));

  // restart zápasu po 6 s
  let restartSeen = false;
  for (let tick = 0; tick < 30 * 8 && !restartSeen; tick++) {
    now += DT * 1000;
    events.push(...fight.stepFight(sim, DT, now));
    if (sim.duel.phase === 'countdown' && sim.duel.round === 1 && sim.duel.a.wins === 0) restartSeen = true;
  }
  check('po match_end přijde nový zápas', restartSeen, sim.duel.phase);
}
{
  // blok mazí poškození — srovnání blokováného a neblokováného zásahu
  const withBlock = fight.createFight(0);
  fight.addFightPlayer(withBlock, 'p_a', 'A', null, 0);
  fight.addFightPlayer(withBlock, 'p_b', 'B', null, 0);
  const noBlock = fight.createFight(0);
  fight.addFightPlayer(noBlock, 'p_a', 'A', null, 0);
  fight.addFightPlayer(noBlock, 'p_b', 'B', null, 0);
  let nowB = 0;
  let hpBlock = 100;
  for (let tick = 0; tick < 30 * 6; tick++) {
    nowB += DT * 1000;
    const dx = withBlock.duel.b.x - withBlock.duel.a.x;
    const inRange = Math.abs(dx) <= duel.PUNCH.reach - 0.3;
    fight.setFightInput(withBlock, 'p_a', { move: inRange ? 0 : 1, jump: false, punch: inRange, kick: false, block: false });
    fight.setFightInput(withBlock, 'p_b', { move: 0, jump: false, punch: false, kick: false, block: true });
    fight.stepFight(withBlock, DT, nowB);
  }
  hpBlock = withBlock.duel.b.hp;
  let nowN = 0;
  for (let tick = 0; tick < 30 * 6; tick++) {
    nowN += DT * 1000;
    const dx = noBlock.duel.b.x - noBlock.duel.a.x;
    const inRange = Math.abs(dx) <= duel.PUNCH.reach - 0.3;
    fight.setFightInput(noBlock, 'p_a', { move: inRange ? 0 : 1, jump: false, punch: inRange, kick: false, block: false });
    fight.setFightInput(noBlock, 'p_b', { move: 0, jump: false, punch: false, kick: false, block: false });
    fight.stepFight(noBlock, DT, nowN);
  }
  const hpFree = noBlock.duel.b.hp;
  check('blok výrazně snižuje poškození', hpBlock > hpFree + 10 && hpBlock > 60, `blok=${hpBlock} volný=${hpFree}`);
}
{
  // časový limit bez vstupu → kolo rozhodne HP shoda → 'time' bez vítěze
  const sim = fight.createFight(0);
  fight.addFightPlayer(sim, 'p_a', 'A', null, 0);
  fight.addFightPlayer(sim, 'p_b', 'B', null, 0);
  let now = 0;
  const events = [];
  for (let tick = 0; tick < 30 * 66; tick++) {
    now += DT * 1000;
    events.push(...fight.stepFight(sim, DT, now));
  }
  const timeRound = events.find((e) => e.kind === 'round_end' && e.reason === 'time');
  check('na čas senza round_end(time)', Boolean(timeRound), JSON.stringify(events.slice(0, 4)));
}
{
  // těla se nesmí snoubit + hranice klece drží: A honí B ke zdi, B utíká
  const sim = fight.createFight(0);
  fight.addFightPlayer(sim, 'p_a', 'A', null, 0);
  fight.addFightPlayer(sim, 'p_b', 'B', null, 0);
  sim.duel.b.x = 8.2;
  let now = 0;
  let minGap = Infinity;
  for (let tick = 0; tick < 30 * 20; tick++) {
    now += DT * 1000;
    const dx = sim.duel.b.x - sim.duel.a.x;
    const inRange = Math.abs(dx) <= duel.PUNCH.reach - 0.3;
    fight.setFightInput(sim, 'p_a', { move: inRange ? 0 : 1, jump: false, punch: inRange, kick: false, block: false });
    fight.setFightInput(sim, 'p_b', { move: 1, jump: false, punch: false, kick: false, block: false });
    fight.stepFight(sim, DT, now);
    if (sim.duel.phase === 'fighting') minGap = Math.min(minGap, Math.abs(sim.duel.a.x - sim.duel.b.x));
  }
  check('bojovníci se nikdy neprotnou', minGap >= duel.FIGHTER_GAP - 0.01, String(minGap));
  check('hranice klece drží', Math.abs(sim.duel.a.x) <= duel.ARENA_HALF + 0.01 && Math.abs(sim.duel.b.x) <= duel.ARENA_HALF + 0.01,
    `${sim.duel.a.x.toFixed(2)}|${sim.duel.b.x.toFixed(2)}`);
  check('B doběhl až ke zdi', sim.duel.b.x >= duel.ARENA_HALF - 0.5, String(sim.duel.b.x.toFixed(2)));
}
{
  // volné sedlo drží bot — hýbe se a útočí
  const sim = fight.createFight(0);
  fight.addFightPlayer(sim, 'p_a', 'Samotář', null, 0);
  let now = 0;
  const startFoeX = sim.duel.b.x;
  let foeActed = false;
  for (let tick = 0; tick < 30 * 30 && sim.duel.phase !== 'matchEnd'; tick++) {
    now += DT * 1000;
    fight.stepFight(sim, DT, now);
    if (sim.duel.b.attack) foeActed = true;
  }
  check('bot v prázdném sedle útočí', foeActed || sim.duel.a.hp < 100, `hpA=${sim.duel.a.hp} bx=${sim.duel.b.x.toFixed(2)} start=${startFoeX}`);
  check('solo bez druhého hráče nesekne duel', sim.duel.phase !== 'countdown' || sim.duel.a.wins + sim.duel.b.wins > 0,
    sim.duel.phase);
}

// ── 2) síť ────────────────────────────────────────────────────────────
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
  for (const socket of [a, b, c]) socket.send({ t: 'hello', proto: 3 });
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
  check('snapshot duelu: 2 bojovníci', snapshot.players.length === 2);
  check('snapshot: jména i id', snapshot.players.every((p) => p.name && p.id), JSON.stringify(snapshot.players.map((p) => p.name)));
  check('snapshot: odpočet', snapshot.state === 'countdown' && snapshot.countdown > 0, JSON.stringify({ state: snapshot.state }));

  // třetí klient = nová místnost (fight je two-seat)
  c.send({ t: 'join', game: 'fight' });
  const roomC = await c.waitFor((m) => m.t === 'room');
  check('třetí jde do fight-2', roomC.room.id === 'fight-2', roomC.room.id);

  const started = await a.waitFor((m) => m.t === 'event' && m.event.kind === 'round_start', 9000);
  check('round_start event', Boolean(started));

  const me = () => {
    const snap = a.last((m) => m.t === 'snapshot' && m.game === 'fight');
    return snap?.players.find((p) => p.id === roomA.youPlayerId);
  };
  const beforeX = me()?.x ?? 0;
  for (let index = 0; index < 60; index++) {
    a.send({ t: 'input', seq: index, mx: 1, mz: 0, yaw: 0, pitch: 0, jump: false, fire: false, weapon: 0, block: false });
    await sleep(35);
  }
  const afterX = me()?.x ?? 0;
  check('pohyb hýbe bojovníkem', Math.abs(afterX - beforeX) > 1.5, `${beforeX}→${afterX}`);

  // pěst: a běží na b a mlátí — b musí ztratit HP
  const foeId = () => {
    const snap = a.last((m) => m.t === 'snapshot' && m.game === 'fight');
    return snap?.players.find((p) => p.id !== roomA.youPlayerId);
  };
  const foeHpBefore = foeId()?.hp ?? 0;
  for (let index = 0; index < 150; index++) {
    a.send({
      t: 'input', seq: index, mx: foeId().x > me().x ? 1 : -1, mz: 0, yaw: 0, pitch: 0,
      jump: false, fire: true, weapon: 0, block: false,
    });
    await sleep(35);
    if ((foeId()?.hp ?? 100) < foeHpBefore) break;
  }
  const foeHpAfter = foeId()?.hp ?? 100;
  check('pěst ubírá soupeři HP', foeHpAfter < foeHpBefore, `${foeHpBefore}→${foeHpAfter}`);

  // odpojení b → bot doplní sedlo (duel nesmí zamrzit na jednoho člověka)
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
