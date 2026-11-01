#!/usr/bin/env node
/**
 * Test Q3 sestavy — boti v multiplayeru.
 *
 * Ověřuje přesně to, co dělá arénu „nikdy prázdnou" (Mercurův princip):
 *  1. **sdílený botí mozek** (`core/arena/bot.ts`) — preferuje lidi, hýbe se,
 *     chce střílet; tenhle modul používá i server, takže sólo a MP boti
 *     jsou stejní (pravidlo M2a),
 *  2. **server je autorita** — bot v simu zasadí zásah člověku a zabije ho,
 *  3. v místnosti jsou 3 boti s `isBot`, jmény a pohybem,
 *  4. člověk dokáže zabít bota a bot se vrátí,
 *  5. frag limit platí **jen** pro lidi — bot nesmí vyhrát zápas.
 *
 * Síťová část je deterministic (bot vlastní simulace střílí na cíl, který
 * mu nastavíme), takže test neflakuje jako „čekám, až mě bot náhodou najde".
 *
 * Spouštět po `npm run build` (potřebuje dist/).
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { createRequire } from 'node:module';
import { WebSocket } from 'ws';

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, '..', 'dist', 'nirvana-net', 'src', 'index.js');
const require = createRequire(import.meta.url);
const { PLAYER_RESPAWN_MS } = require('../dist/nirvana/src/core/arena/weapons.js');
const { makeSolids, lineOfSight, PLAYER } = require('../dist/nirvana/src/core/arena/physics.js');
const { ARENA_BOXES } = require('../dist/nirvana/src/core/arena/map.js');
const { buildNavGrid } = require('../dist/nirvana/src/core/arena/nav.js');
const { createBotMemory, stepBot, driveBot, nearestTarget } = require('../dist/nirvana/src/core/arena/bot.js');
const arena = require('../dist/nirvana-net/src/arena.js');

const PORT = Number(process.env.ARENA_BOTS_PORT ?? 3900 + Math.floor(Math.random() * 300));
const WS_URL = `ws://127.0.0.1:${PORT}/net`;

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

// ── 1) sdílený botí mozek (bez sítě) ───────────────────────────────────
console.log('\n== sdílený botí mozek ==');
{
  const solids = makeSolids(ARENA_BOXES);
  const nav = buildNavGrid(ARENA_BOXES);
  // oba na stejné ose z mimo schody (z=6,6..10,2) a mimo platformu
  const human = { id: 'h1', x: 8, y: 0, z: 16, alive: true };
  const otherBot = { id: 'bot-9', x: -14, y: 0, z: 14, alive: true, isBot: true };
  const body = { x: -8, y: 0.2, z: 16, vx: 0, vy: 0, vz: 0, onGround: true };
  const memory = createBotMemory();

  check('LOS bot → člověk (čistá linie)', lineOfSight(body.x, body.y + 1.2, body.z,
    human.x, human.y + 1.35, human.z, solids));
  check('nearestTarget preferuje člověka', nearestTarget([otherBot, human], body)?.id === 'h1',
    nearestTarget([otherBot, human], body)?.id);
  check('bez lidí boti hrají proti sobě', nearestTarget([otherBot], body)?.id === 'bot-9');

  let fired = 0;
  let clock = 0;
  const startX = body.x;
  for (let tick = 0; tick < 30 * 4; tick++) {
    clock += 1000 / 30;
    const intent = stepBot(memory, body, [human, otherBot], nav, solids, clock, 1 / 30);
    driveBot(memory, body, intent, 1 / 30, solids, 0.45, 1.7, 0.62);
    if (intent.fire) fired += 1;
  }
  check('bot se hýbe (stejná fyzika jako hráč)', Math.abs(body.x - startX) > 0.5,
    `${body.x.toFixed(1)},${body.z.toFixed(1)}`);
  check('bot chce střílet na člověka', fired > 0, `výstřely=${fired}`);
}

// ── 2) server je autorita: bot zasadí zásah člověku ────────────────────
console.log('\n== serverová simulace (bot zasáhne člověka) ==');
{
  const sim = arena.createArena(Date.now());
  const human = arena.addPlayer(sim, 'c_human', 'Hráč', null, Date.now());
  arena.ensureBots(sim);

  // oba na volné linii (z=16 je mimo schody i platformu)
  human.body.x = 8;
  human.body.z = 16;
  human.body.y = 0.2;
  const bot = [...sim.players.values()].find((p) => p.isBot);
  bot.body.x = -8;
  bot.body.z = 16;
  bot.body.y = 0.2;

  check('LOS bot → člověk', lineOfSight(bot.body.x, bot.body.y + 1.2, bot.body.z,
    human.body.x, human.body.y + 1.35, human.body.z, makeSolids(ARENA_BOXES)));

  let now = Date.now();
  let sawDamage = false;
  let kill = null;
  for (let tick = 0; tick < 30 * 8 && !kill; tick++) {
    now += 1000 / 30;
    const events = arena.stepArena(sim, 1 / 30, now);
    if (human.hp < 100) sawDamage = true;
    kill = events.find((e) => e.kind === 'kill' && e.victim === 'c_human') ?? null;
  }
  check('bot zasadí zásah (server počítá damage)', sawDamage, `hp=${human.hp}`);
  check('bot člověka zabije (kill event)', Boolean(kill), JSON.stringify(kill));
  const botFrags = [...sim.players.values()].filter((p) => p.isBot).reduce((s, p) => s + p.frags, 0);
  check('frag šel některému botovi', botFrags >= 1, `boti frags=${botFrags} killer=${kill?.killer}`);

  // ── MG: 8 dmg na ránu, rozptyl — NENÍ one-shot jako rail ──────────
  const sim2 = arena.createArena(Date.now());
  const human2 = arena.addPlayer(sim2, 'c_h', 'Hráč', null, Date.now());
  arena.ensureBots(sim2);
  human2.body.x = 0; human2.body.z = 16; human2.body.y = 0.2;
  human2.weapon = 'mg';
  human2.input.weapon = 'mg';
  human2.ammo = 999;
  human2.mgAmmo = 999;
  const target = [...sim2.players.values()].find((p) => p.isBot);
  target.body.x = 6; target.body.z = 16; target.body.y = 0.2;

  let now2 = Date.now();
  for (let tick = 0; tick < 30 * 1.5; tick++) {
    now2 += 1000 / 30;
    // člověk míří na bota a drží spoušť — MG má cooldown 100 ms
    const dx = target.body.x - human2.body.x;
    const dy = (target.body.y + 1.05) - (human2.body.y + PLAYER.eye);
    const dz = target.body.z - human2.body.z;
    const len = Math.hypot(dx, dy, dz) || 1;
    human2.input.yaw = Math.atan2(-dx / len, -dz / len);
    human2.input.pitch = Math.asin(dy / len);
    human2.input.fire = true;
    human2.input.weapon = 'mg';
    arena.stepArena(sim2, 1 / 30, now2);
  }
  const dmg = 100 - target.hp;
  // Q3 MG: 8 dmg na ránu — proto musí být rozdíl dělitelný 8 a nesmí to být one-shot
  check('MG ubírá po 8 (není one-shot jako rail)', dmg > 0 && dmg % 8 === 0 && dmg < 100,
    `dmg=${dmg} hp=${target.hp}`);
}

// ── 3) síťová část: místnost, pohyb, lidský frag ──────────────────────
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
    async waitFor(match, ms = 8000) {
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
    NIRVANA_NET_ALLOWED_ORIGINS: 'http://127.0.0.1:3998',
    ZIS_URL: 'http://127.0.0.1:1',
    NIRVANA_ARENA_BOTS: '3',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
server.stdout.on('data', (c) => { log += c.toString(); });
server.stderr.on('data', (c) => { log += c.toString(); });

try {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/net/health`);
      if (response.ok) break;
    } catch { /* start */ }
    await sleep(100);
  }
  console.log(`\n== boti v místnosti na :${PORT} ==`);

  const a = client();
  await a.opened;
  a.send({ t: 'hello', proto: 4 });
  await a.waitFor((m) => m.t === 'welcome');
  a.send({ t: 'join', game: 'arena' });
  const roomA = await a.waitFor((m) => m.t === 'room');
  check('místnost arena-1', roomA.room.id === 'arena-1', roomA.room.id);

  const snapshot = await a.waitFor((m) => m.t === 'snapshot' && m.players.length >= 4);
  const humans = snapshot.players.filter((p) => !p.isBot);
  const bots = snapshot.players.filter((p) => p.isBot === true);
  check('v místnosti jsou 3 boti', bots.length === 3, `boti=${bots.length} celkem=${snapshot.players.length}`);
  check('boti mají jména', bots.every((p) => p.name && p.name !== '…'), JSON.stringify(bots.map((p) => p.name)));
  check('člověk je jeden a je to on', humans.length === 1 && humans[0].id === roomA.youPlayerId,
    JSON.stringify(humans.map((p) => p.id)));

  // ── boti se hýbou ─────────────────────────────────────────────────
  const start = bots.map((p) => ({ id: p.id, x: p.x, z: p.z }));
  await sleep(2500);
  const later = a.last((m) => m.t === 'snapshot');
  const moved = start.map((s) => {
    const now = later.players.find((p) => p.id === s.id);
    return now ? Math.hypot(now.x - s.x, now.z - s.z) : 0;
  });
  check('boti se pohybují (sdílená fyzika)', moved.some((d) => d > 1), moved.map((d) => d.toFixed(1)).join('/'));

  // ── člověk zabije bota (rail = Q3 100 dmg = one-shot) ─────────────
  const botTarget = bots.find((p) => p.alive);
  let botKilled = null;
  for (let i = 0; i < 90 && !botKilled; i++) {
    const snap = a.last((m) => m.t === 'snapshot');
    const me = snap.players.find((p) => p.id === roomA.youPlayerId);
    const foe = snap.players.find((p) => p.id === botTarget.id);
    if (me && foe && foe.alive) {
      const dx = foe.x - me.x;
      const dy = (foe.y + 1.05) - (me.y + 1.6);
      const dz = foe.z - me.z;
      const len = Math.hypot(dx, dy, dz) || 1;
      a.send({
        t: 'input', seq: 700 + i, mx: 0, mz: 0,
        yaw: Math.atan2(-dx / len, -dz / len),
        pitch: Math.asin(dy / len),
        jump: false, fire: true, weapon: 0,
      });
    }
    await sleep(100);
    botKilled = a.last((m) => m.t === 'event' && m.event.kind === 'kill' &&
      m.event.victim === botTarget.id && m.event.killer === roomA.youPlayerId);
  }
  check('člověk zabije bota (rail = Q3 dmg)', Boolean(botKilled),
    JSON.stringify(a.inbox.filter((m) => m.t === 'event' && m.event.kind === 'kill').slice(-3)));

  // ── bot se vrátí ──────────────────────────────────────────────────
  const backAt = Date.now() + PLAYER_RESPAWN_MS + 1500;
  let respawned = null;
  while (Date.now() < backAt && !respawned) {
    await sleep(200);
    const snap = a.last((m) => m.t === 'snapshot');
    const foe = snap?.players.find((p) => p.id === botTarget.id);
    if (foe && foe.alive && foe.hp === 100) respawned = foe;
  }
  check('bot se vrátí do hry', Boolean(respawned));

  // ── frag limit jen pro lidi (deterministicky, přímo v simu) ───────
  {
    const sim = arena.createArena(Date.now());
    arena.addPlayer(sim, 'c_human', 'Hráč', null, Date.now());
    const bot = [...sim.players.values()].find((p) => p.isBot);
    bot.frags = 100; // bot „vyhrál"
    for (let i = 0; i < 5; i++) arena.stepArena(sim, 1 / 30, Date.now() + i * 34);
    check('bot se 100 fragy neukončí zápas', sim.state === 'running', sim.state);

    const human = [...sim.players.values()].find((p) => !p.isBot);
    human.frags = 100;
    for (let i = 0; i < 5 && sim.state === 'running'; i++) {
      arena.stepArena(sim, 1 / 30, Date.now() + 1000 + i * 34);
    }
    check('člověk se 100 fragy zápas ukončí', sim.state === 'ended', sim.state);
  }

  a.close();
} catch (error) {
  failures += 1;
  console.log(`  FAIL výjimka: ${error.message}`);
  console.log(log.split('\n').slice(-12).join('\n'));
} finally {
  server.kill('SIGTERM');
}

await sleep(200);
console.log(failures === 0 ? '\nARENA-BOTS OK\n' : `\nARENA-BOTS FAILED (${failures})\n`);
process.exit(failures === 0 ? 0 : 1);
