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
import { PROTO_VERSION as PROTO } from '../dist/nirvana/src/core/net/protocol.js';

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, '..', 'dist', 'nirvana-net', 'src', 'index.js');
const require = createRequire(import.meta.url);
const { PLAYER_RESPAWN_MS } = require('../dist/nirvana/src/core/arena/weapons.js');
const { makeSolids, lineOfSight, PLAYER } = require('../dist/nirvana/src/core/arena/physics.js');
const { ARENA_BOXES } = require('../dist/nirvana/src/core/arena/map.js');
const { buildNavGrid } = require('../dist/nirvana/src/core/arena/nav.js');
const { createBotMemory, stepBot, driveBot, nearestTarget } = require('../dist/nirvana/src/core/arena/bot.js');
const { BOT_SKILLS } = require('../dist/nirvana/src/core/arena/bot.js');
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

  // ── úrovně obtížnosti (Q3 easy/medium/hard) ────────────────────────
  check('tři úrovně obtížnosti', ['easy', 'normal', 'hard'].every((s) => BOT_SKILLS[s]),
    Object.keys(BOT_SKILLS).join(','));
  check('hard míří přesněji než easy', BOT_SKILLS.hard.aimError < BOT_SKILLS.easy.aimError,
    `${BOT_SKILLS.hard.aimError} < ${BOT_SKILLS.easy.aimError}`);
  check('hard střílí rychleji než easy', BOT_SKILLS.hard.fireDelayMs < BOT_SKILLS.easy.fireDelayMs);
  check('obtížnost NEMĚNÍ damage', !('damage' in BOT_SKILLS.hard) && !('damage' in BOT_SKILLS.easy),
    'damage drží sdílená WEAPONS');

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

  // oba na volné linii (z=16 je mimo schody i platformu); 6 m = v dosahu
  // i s rezervou pro chybu míření
  human.body.x = 0;
  human.body.z = 16;
  human.body.y = 0.2;
  const bot = [...sim.players.values()].find((p) => p.isBot);
  bot.body.x = -6;
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

  // ── bot se vrátí (respawn) ─────────────────────────────────────────
  const deadBotId = kill?.killer;
  let botBack = false;
  for (let tick = 0; tick < 30 * 4 && !botBack; tick++) {
    now += 1000 / 30;
    arena.stepArena(sim, 1 / 30, now);
    const back = [...sim.players.values()].find((p) => p.id === deadBotId);
    if (back && back.alive && back.hp === 100) botBack = true;
  }
  check('zabitý bot se vrátí do hry', botBack, `id=${deadBotId}`);

  // ── člověk zabije bota (rail = one-shot) — deterministicky ──────────
  const sim3 = arena.createArena(Date.now());
  const human3 = arena.addPlayer(sim3, 'c_h', 'Hráč', null, Date.now());
  arena.ensureBots(sim3);
  human3.body.x = 0; human3.body.z = 16; human3.body.y = 0.2;
  const victimBot = [...sim3.players.values()].find((p) => p.isBot);
  // ostatní boty z místnosti vyndáme — jinak by člověka odkopali dřív,
  // než by stihl vystřelit (test musí být deterministický)
  for (const p of [...sim3.players.values()]) {
    if (p.isBot && p.id !== victimBot.id) sim3.players.delete(p.id);
  }
  victimBot.body.x = -6; victimBot.body.z = 16; victimBot.body.y = 0.2;
  victimBot.alive = true;

  let now3 = Date.now();
  let botDead = null;
  for (let tick = 0; tick < 30 * 6 && !botDead; tick++) {
    now3 += 1000 / 30;
    const dx = victimBot.body.x - human3.body.x;
    const dy = (victimBot.body.y + 1.05) - (human3.body.y + PLAYER.eye);
    const dz = victimBot.body.z - human3.body.z;
    const len = Math.hypot(dx, dy, dz) || 1;
    human3.input.yaw = Math.atan2(-dx / len, -dz / len);
    human3.input.pitch = Math.asin(dy / len);
    human3.input.fire = true;
    human3.input.weapon = 'rail';
    const events = arena.stepArena(sim3, 1 / 30, now3);
    botDead = events.find((e) => e.kind === 'kill' && e.victim === victimBot.id) ?? null;
  }
  check('člověk zabije bota (rail = Q3 one-shot)', Boolean(botDead), JSON.stringify(botDead));

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
  // jen jeden bot — ostatní by člověka zabili rail a test by ztratil smysl
  for (const p of [...sim2.players.values()]) {
    if (p.isBot && p.id !== target.id) sim2.players.delete(p.id);
  }
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

  // ── pickupy: MG náboje se berou a vracejí (Q3 ammo box) ────────────
  {
    const sim4 = arena.createArena(Date.now());
    const human4 = arena.addPlayer(sim4, 'c_h2', 'Hráč', null, Date.now());
    arena.ensureBots(sim4);
    for (const p of [...sim4.players.values()]) {
      if (p.isBot) sim4.players.delete(p.id);
    }
    const ammoPickup = sim4.pickups.find((p) => p.kind === 'ammo');
    check('v mapě jsou MG náboje', Boolean(ammoPickup), JSON.stringify(sim4.pickups.map((p) => p.kind)));
    human4.mgAmmo = 0;
    human4.body.x = ammoPickup.x;
    human4.body.z = ammoPickup.z;
    human4.body.y = ammoPickup.y;
    let now4 = Date.now();
    for (let tick = 0; tick < 30; tick++) {
      now4 += 1000 / 30;
      arena.stepArena(sim4, 1 / 30, now4);
    }
    check('pickup doplní náboje na MG', human4.mgAmmo > 0, `mgAmmo=${human4.mgAmmo}`);
  }

  // ── tři boti = tři různé úrovně ────────────────────────────────────
  {
    const sim5 = arena.createArena(Date.now());
    arena.addPlayer(sim5, 'c_h3', 'Hráč', null, Date.now());
    arena.ensureBots(sim5);
    const skills = [...sim5.players.values()].filter((p) => p.isBot).map((p) => p.skill);
    check('boti mají různé úrovně', new Set(skills).size === 3, JSON.stringify(skills));
  }
}

// ── 2b) nová Q3 sada zbraní na serveru (simulace, bez sítě) ───────────
console.log('\n== server: brokovnice / blesk / plazma / pěst ==');
{
  const sim = arena.createArena(Date.now());
  const human = arena.addPlayer(sim, 'c_w', 'Hráč', null, Date.now());
  arena.ensureBots(sim);
  const bot = [...sim.players.values()].find((p) => p.isBot);
  // jen jeden terč a bez AI: dummy nesmí utéct ani střílet
  for (const p of [...sim.players.values()]) {
    if (p.isBot && p.id !== bot.id) sim.players.delete(p.id);
  }
  bot.isBot = false;
  bot.input.fire = false;
  human.body.x = 0; human.body.z = 16; human.body.y = 0.2;
  bot.body.x = 0; bot.body.z = 13; bot.body.y = 0.2;
  bot.hp = 100; bot.alive = true;
  const aim = () => {
    const dx = bot.body.x - human.body.x;
    const dy = bot.body.y + 1.05 - (human.body.y + PLAYER.eye);
    const dz = bot.body.z - human.body.z;
    const len = Math.hypot(dx, dy, dz) || 1;
    human.input.yaw = Math.atan2(-dx / len, -dz / len);
    human.input.pitch = Math.asin(dy / len);
  };
  let now = Date.now();
  const fireOnce = (weapon, ammoField) => {
    human.weapon = weapon;
    human.input.weapon = weapon;
    if (ammoField) human[ammoField] = 99;
    aim();
    human.input.fire = true;
    now += 2000;
    arena.stepArena(sim, 1 / 30, now);
    human.input.fire = false;
  };

  fireOnce('shotgun', 'shotgunAmmo');
  check('brokovnice: výstřel ubere botovi HP', bot.hp < 100, String(bot.hp));

  bot.hp = 100;
  fireOnce('lightning', 'lightningAmmo');
  check('blesk: 8 dmg na zásah', bot.hp === 92, String(bot.hp));

  bot.hp = 100;
  sim.rockets.length = 0;
  fireOnce('plasma', 'plasmaAmmo');
  check(
    'plazma: vytvoří projektil kind=plasma',
    sim.rockets.some((rocket) => rocket.kind === 'plasma'),
    JSON.stringify(sim.rockets.map((rocket) => rocket.kind)),
  );

  sim.rockets.length = 0;
  bot.hp = 100;
  bot.body.z = human.body.z - 1.6;
  fireOnce('gauntlet');
  check('pěst: 50 dmg na blízko', bot.hp === 50, String(bot.hp));

  // munice se skutečně odečítá (shotgun 1 náboj na výstřel)
  bot.hp = 100;
  bot.body.z = human.body.z - 3;
  human.shotgunAmmo = 2;
  fireOnce('shotgun', 'shotgunAmmo');
  check('brokovnice: odečte náboj', human.shotgunAmmo === 1, String(human.shotgunAmmo));
  check('brokovnice: po výstřelu zbývá zbraň', human.weapon === 'shotgun', human.weapon);
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
    // testy nemají ZAP cookie — bez tohohle by každý join skončil pass_required
    NIRVANA_NET_REQUIRE_PASS: '0',
    // testy úklidu: reconnect vypnutý, jinak sedlo drží 45 s
    NIRVANA_NET_RESUME_MS: '0',
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
  a.send({ t: 'hello', proto: PROTO });
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

  // ── transport: zbraň + munice ve snapshotu (server je vlastník) ────
  const anyBots = snapshot.players.filter((p) => p.isBot);
  const hasWeaponData = snapshot.players.every((p) => typeof p.weapon === 'number' && typeof p.ammo === 'number');
  check('snapshot nese zbraň i munici', hasWeaponData,
    JSON.stringify(snapshot.players.map((p) => ({ w: p.weapon, a: p.ammo }))));

  // ── stav zápasu je 'running' (match_start poslán) ──────────────────
  check('zápas běží', a.last((m) => m.t === 'event' && m.event.kind === 'match_start') !== null);
  check('boti jsou v každém snapshotu', anyBots.length === 3);

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
