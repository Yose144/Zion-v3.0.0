/**
 * ARÉNA — serverová simulace pro multiplayer.
 *
 * Server je autorita: počítá pohyb, zásahy, smrt i skóre. Klient posílá jen
 * vstup (`mx`/`mz`/`yaw`/`pitch`/`jump`/`fire`) a dostává snapshoty.
 *
 * Fyzika i mapa jsou **stejné moduly jako v prohlížeči**
 * (`core/arena/physics.ts`, `core/arena/map.ts`) — žádná druhá implementace,
 * takže se server a klient nemůžou rozejít v tom, kde je zeď.
 */

import {
  ARENA_BOXES,
  ARENA_PICKUPS,
  BOT_SPAWNS,
  FRAG_LIMIT,
  MATCH_SECONDS,
  PLAYER_SPAWN,
  type ArenaPickup,
} from '../../nirvana/src/core/arena/map.js';
import { buildNavGrid, type NavGrid } from '../../nirvana/src/core/arena/nav.js';
import {
  createBotMemory,
  nearestTarget,
  skillOptions,
  stepBot,
  type BotMemory,
  type BotSkill,
  type BotTarget,
} from '../../nirvana/src/core/arena/bot.js';
import {
  PLAYER,
  makeSolids,
  raySolids,
  raySphere,
  stepBody,
  type Body,
  type Box4,
} from '../../nirvana/src/core/arena/physics.js';
import {
  MG_AMMO_PICKUP,
  PLAYER_RESPAWN_MS,
  TARGET_EYE_RATIO,
  TARGET_RADIUS,
  BOT_FIRE,
  WEAPONS,
  aimVector,
  botWeaponFor,
  applyDamage,
  pickTarget,
  spreadVector,
  type WeaponId,
} from '../../nirvana/src/core/arena/weapons.js';

export interface ArenaInput {
  /** −1..1 dopředu. */
  forward: number;
  /** −1..1 doprava. */
  strafe: number;
  yaw: number;
  pitch: number;
  jump: boolean;
  fire: boolean;
  weapon: WeaponId;
}
export interface ArenaPlayer {
  id: string;
  name: string;
  avatarId: number | null;
  body: Body;
  hp: number;
  armor: number;
  frags: number;
  deaths: number;
  weapon: WeaponId;
  /** Munice raketometu (rail je nekonečný). */
  ammo: number;
  /** Munice strojní pušky — vlastní zásobník, jinak by MG vystřílela rakety. */
  mgAmmo: number;
  /** Munice nové Q3 sady (sólo i MP ji teď sdílí). */
  shotgunAmmo: number;
  lightningAmmo: number;
  plasmaAmmo: number;
  alive: boolean;
  respawnAt: number;
  cooldownUntil: number;
  input: ArenaInput;
  lastHitBy: string | null;
  /** Serverový bot (Q3 sestava: aréna nikdy není prázdná). */
  isBot?: boolean;
  /** Botí mozek — sdílený modul, stejný jako v sóle. */
  memory?: BotMemory;
  /** Úroveň obtížnosti (Q3 easy/medium/hard) — určuje parametry mozku. */
  skill?: BotSkill;
}

export interface Rocket {
  id: number;
  owner: string;
  /** `plasma` letí stejnou fyzikou jako raketa, jen slabší a rychlejší. */
  kind: 'rocket' | 'plasma';
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  ttl: number;
}

export type ArenaEvent =
  | { kind: 'kill'; killer: string; victim: string; weapon: WeaponId; at: number }
  | { kind: 'respawn'; id: string }
  | { kind: 'pickup'; id: string; item: 'health' | 'armor' | 'ammo' | 'powerup' | 'mega' | 'shard' }
  | { kind: 'match_start'; at: number }
  | { kind: 'match_end'; scoreboard: { id: string; name: string; frags: number; deaths: number }[] };

export interface ArenaSim {
  players: Map<string, ArenaPlayer>;
  rockets: Rocket[];
  solids: Box4[];
  pickups: ArenaPickup[];
  /** Navigační mřížka pro boty (BFS po buňkách). */
  nav: NavGrid;
  /** `false` v místnosti „jen lidé" — boti se nedoplňují. */
  botsEnabled: boolean;
  /** Kdy předmět zase bude k dispozici (ms), 0 = leží. */
  pickupReadyAt: Map<string, number>;
  startedAt: number;
  state: 'running' | 'ended';
  endedAt: number;
  seq: number;
  nextRocketId: number;
  spawnCursor: number;
  events: ArenaEvent[];
}

const SPAWNS = BOT_SPAWNS;
const PICKUP_RANGE = 1.6;
/** Po konci zápasu se aréna po téhle době uklidí a začne nový. */
const MATCH_RESTART_MS = 5000;
/**
 * Kolik botů má aréna držet, aby nebyla prázdná (Q3 sestava).
 * `NIRVANA_ARENA_BOTS=0` je vypne — testy tak zůstanou deterministické
 * (jinak by boti stříleli do testovacích hráčů a test by flakoval).
 */
const BOT_COUNT = Math.max(
  0,
  Number.parseInt(process.env.NIRVANA_ARENA_BOTS ?? '3', 10) || 0,
);
const BOT_NAMES = ['VALLIS', 'NOCTIS', 'ARES'];
/** Každý bot jiná úroveň — jako v sólo aréně (stejná sestava). */
const BOT_SKILLS: BotSkill[] = ['easy', 'normal', 'hard'];

export function createArena(now: number, options: { bots?: boolean } = {}): ArenaSim {
  return {
    players: new Map(),
    rockets: [],
    solids: makeSolids(ARENA_BOXES),
    pickups: ARENA_PICKUPS,
    nav: buildNavGrid(ARENA_BOXES),
    botsEnabled: options.bots ?? true,
    pickupReadyAt: new Map(),
    startedAt: now,
    state: 'running',
    endedAt: 0,
    seq: 0,
    nextRocketId: 1,
    spawnCursor: 0,
    events: [],
  };
}

function humanCount(sim: ArenaSim): number {
  let count = 0;
  for (const player of sim.players.values()) {
    if (!player.isBot) count += 1;
  }
  return count;
}

/** Munice dané zbraně (`rail` a pěst jsou nekonečné). */
function ammoOf(player: ArenaPlayer, weapon: WeaponId): number {
  if (weapon === 'rail' || weapon === 'gauntlet') return Number.POSITIVE_INFINITY;
  if (weapon === 'mg') return player.mgAmmo;
  if (weapon === 'shotgun') return player.shotgunAmmo;
  if (weapon === 'lightning') return player.lightningAmmo;
  if (weapon === 'plasma') return player.plasmaAmmo;
  return player.ammo;
}

function spendAmmo(player: ArenaPlayer, weapon: WeaponId): void {
  if (weapon === 'mg') player.mgAmmo -= 1;
  else if (weapon === 'shotgun') player.shotgunAmmo -= 1;
  else if (weapon === 'lightning') player.lightningAmmo -= 1;
  else if (weapon === 'plasma') player.plasmaAmmo -= 1;
  else if (weapon === 'rocket') player.ammo -= 1;
}

function spawnPoint(sim: ArenaSim, usePlayerSpawn: boolean) {
  if (usePlayerSpawn) return { x: PLAYER_SPAWN.x, z: PLAYER_SPAWN.z, yaw: PLAYER_SPAWN.yaw };
  const point = SPAWNS[sim.spawnCursor % SPAWNS.length] ?? SPAWNS[0]!;
  sim.spawnCursor += 1;
  return { x: point.x, z: point.z, yaw: point.yaw };
}

function placeBody(player: ArenaPlayer, spawn: { x: number; z: number; yaw: number }): void {
  player.body = {
    x: spawn.x,
    y: 0.2,
    z: spawn.z,
    vx: 0,
    vy: 0,
    vz: 0,
    onGround: false,
  };
  player.input.yaw = spawn.yaw;
  player.input.pitch = -0.05;
}

export function addPlayer(
  sim: ArenaSim,
  id: string,
  name: string,
  avatarId: number | null,
  now: number,
): ArenaPlayer {
  const spawn = spawnPoint(sim, sim.players.size === 0);
  const player: ArenaPlayer = {
    id,
    name,
    avatarId,
    body: { x: spawn.x, y: 0.2, z: spawn.z, vx: 0, vy: 0, vz: 0, onGround: false },
    hp: 100,
    armor: 0,
    frags: 0,
    deaths: 0,
    weapon: 'rail',
    ammo: WEAPONS.rocket.ammo,
    mgAmmo: WEAPONS.mg.ammo,
    shotgunAmmo: WEAPONS.shotgun.ammo,
    lightningAmmo: WEAPONS.lightning.ammo,
    plasmaAmmo: WEAPONS.plasma.ammo,
    alive: true,
    respawnAt: 0,
    cooldownUntil: 0,
    input: { forward: 0, strafe: 0, yaw: spawn.yaw, pitch: -0.05, jump: false, fire: false, weapon: 'rail' },
    lastHitBy: null,
  };
  sim.players.set(id, player);
  ensureBots(sim);
  if (humanCount(sim) === 1) {
    sim.startedAt = now;
    sim.state = 'running';
    sim.events.push({ kind: 'match_start', at: now });
  }
  return player;
}

/**
 * Doplní boty, aby aréna nebyla prázdná (M2a chyběli — „prázdná aréna je
 * prázdná"). Bot je v simu jako běžný hráč, jen s `isBot` a vlastním mozkem.
 *
 * **Idempotentní:** chybějící boty doplní, existující nechá být — jinak by
 * každý nový hráč vynuloval botům skóre a oni by začínali od nuly.
 */
export function ensureBots(sim: ArenaSim): void {
  if (!sim.botsEnabled) return;
  const existing = [...sim.players.values()].filter((player) => player.isBot);
  for (let index = existing.length; index < BOT_COUNT; index++) {
    const spawn = BOT_SPAWNS[index % BOT_SPAWNS.length]!;
    const bot: ArenaPlayer = {
      id: `bot-${index + 1}`,
      name: BOT_NAMES[index % BOT_NAMES.length]!,
      avatarId: null,
      body: { x: spawn.x, y: 0.2, z: spawn.z, vx: 0, vy: 0, vz: 0, onGround: false },
      hp: 100,
      armor: 0,
      frags: 0,
      deaths: 0,
      weapon: 'rail',
      ammo: WEAPONS.rocket.ammo,
      mgAmmo: WEAPONS.mg.ammo,
      shotgunAmmo: WEAPONS.shotgun.ammo,
      lightningAmmo: WEAPONS.lightning.ammo,
      plasmaAmmo: WEAPONS.plasma.ammo,
      alive: true,
      respawnAt: 0,
      cooldownUntil: 0,
      input: { forward: 0, strafe: 0, yaw: spawn.yaw, pitch: -0.05, jump: false, fire: false, weapon: 'rail' },
      lastHitBy: null,
      isBot: true,
      memory: createBotMemory(),
      skill: BOT_SKILLS[index % BOT_SKILLS.length],
    };
    sim.players.set(bot.id, bot);
  }
}

export function removePlayer(sim: ArenaSim, id: string): void {
  sim.players.delete(id);
  sim.rockets = sim.rockets.filter((rocket) => rocket.owner !== id);
}

export function setInput(sim: ArenaSim, id: string, input: Partial<ArenaInput>): void {
  const player = sim.players.get(id);
  if (!player) return;
  const clamp = (value: number | undefined, min: number, max: number) =>
    typeof value === 'number' && Number.isFinite(value)
      ? Math.min(max, Math.max(min, value))
      : 0;

  if (input.forward !== undefined) player.input.forward = clamp(input.forward, -1, 1);
  if (input.strafe !== undefined) player.input.strafe = clamp(input.strafe, -1, 1);
  if (input.yaw !== undefined) player.input.yaw = input.yaw;
  if (input.pitch !== undefined) player.input.pitch = clamp(input.pitch, -Math.PI / 2, Math.PI / 2);
  if (input.jump !== undefined) player.input.jump = input.jump;
  if (input.fire !== undefined) player.input.fire = input.fire;
  if (input.weapon !== undefined) player.input.weapon = input.weapon;
}

function liveTargets(sim: ArenaSim, exceptId: string) {
  const targets: { id: string; x: number; y: number; z: number; radius: number }[] = [];
  for (const player of sim.players.values()) {
    if (!player.alive || player.id === exceptId) continue;
    targets.push({
      id: player.id,
      x: player.body.x,
      y: player.body.y + PLAYER.height * TARGET_EYE_RATIO,
      z: player.body.z,
      radius: TARGET_RADIUS,
    });
  }
  return targets;
}

function killPlayer(
  sim: ArenaSim,
  victim: ArenaPlayer,
  killerId: string | null,
  weapon: WeaponId,
  now: number,
): void {
  victim.alive = false;
  victim.hp = 0;
  victim.deaths += 1;
  victim.respawnAt = now + PLAYER_RESPAWN_MS;
  const killer = killerId ? sim.players.get(killerId) : null;
  if (killer && killer.id !== victim.id) killer.frags += 1;
  sim.events.push({
    kind: 'kill',
    killer: killer?.id ?? '',
    victim: victim.id,
    weapon,
    at: now,
  });
}

function hurt(
  sim: ArenaSim,
  victim: ArenaPlayer,
  amount: number,
  attacker: string,
  weapon: WeaponId,
  now: number,
): void {
  if (!victim.alive) return;
  const result = applyDamage(victim.hp, victim.armor, amount);
  victim.hp = result.hp;
  victim.armor = result.armor;
  victim.lastHitBy = attacker;
  if (result.died) killPlayer(sim, victim, attacker, weapon, now);
}

function fireRail(sim: ArenaSim, player: ArenaPlayer, now: number): void {
  const dir = aimVector(player.input.yaw, player.input.pitch);
  const origin = { x: player.body.x, y: player.body.y + PLAYER.eye, z: player.body.z };
  const hit = pickTarget(origin, dir, sim.solids, liveTargets(sim, player.id));
  if (hit && hit.id) {
    const victim = sim.players.get(hit.id);
    if (victim) hurt(sim, victim, WEAPONS.rail.damage, player.id, 'rail', now);
  }
}

/** Machinegun: rychlý spray s rozptylem (Q3 `MACHINEGUN_SPREAD`). */
function fireMg(sim: ArenaSim, player: ArenaPlayer, now: number): void {
  const dir = spreadVector(aimVector(player.input.yaw, player.input.pitch), WEAPONS.mg.spread);
  const origin = { x: player.body.x, y: player.body.y + PLAYER.eye, z: player.body.z };
  const hit = pickTarget(origin, dir, sim.solids, liveTargets(sim, player.id), WEAPONS.mg.range);
  if (hit && hit.id) {
    const victim = sim.players.get(hit.id);
    if (victim) hurt(sim, victim, WEAPONS.mg.damage, player.id, 'mg', now);
  }
}

function fireRocket(sim: ArenaSim, player: ArenaPlayer, now: number): void {
  const dir = aimVector(player.input.yaw, player.input.pitch);
  sim.rockets.push({
    id: sim.nextRocketId++,
    owner: player.id,
    kind: 'rocket',
    x: player.body.x + dir.x * 0.6,
    y: player.body.y + PLAYER.eye + dir.y * 0.6,
    z: player.body.z + dir.z * 0.6,
    vx: dir.x * WEAPONS.rocket.speed,
    vy: dir.y * WEAPONS.rocket.speed,
    vz: dir.z * WEAPONS.rocket.speed,
    ttl: now + WEAPONS.rocket.ttlMs,
  });
}

function fireShotgun(sim: ArenaSim, player: ArenaPlayer, now: number): void {
  const base = aimVector(player.input.yaw, player.input.pitch);
  const origin = { x: player.body.x, y: player.body.y + PLAYER.eye, z: player.body.z };
  for (let pellet = 0; pellet < WEAPONS.shotgun.pellets; pellet += 1) {
    const dir = spreadVector(base, WEAPONS.shotgun.spread);
    const hit = pickTarget(origin, dir, sim.solids, liveTargets(sim, player.id), WEAPONS.shotgun.range);
    if (hit && hit.id) {
      const victim = sim.players.get(hit.id);
      if (victim) hurt(sim, victim, WEAPONS.shotgun.damage, player.id, 'shotgun', now);
    }
  }
}

function fireLightning(sim: ArenaSim, player: ArenaPlayer, now: number): void {
  const dir = aimVector(player.input.yaw, player.input.pitch);
  const origin = { x: player.body.x, y: player.body.y + PLAYER.eye, z: player.body.z };
  const hit = pickTarget(origin, dir, sim.solids, liveTargets(sim, player.id), WEAPONS.lightning.range);
  if (hit && hit.id) {
    const victim = sim.players.get(hit.id);
    if (victim) hurt(sim, victim, WEAPONS.lightning.damage, player.id, 'lightning', now);
  }
}

function fireGauntlet(sim: ArenaSim, player: ArenaPlayer, now: number): void {
  const dir = aimVector(player.input.yaw, player.input.pitch);
  const origin = { x: player.body.x, y: player.body.y + PLAYER.eye, z: player.body.z };
  const hit = pickTarget(origin, dir, sim.solids, liveTargets(sim, player.id), WEAPONS.gauntlet.range);
  if (hit && hit.id) {
    const victim = sim.players.get(hit.id);
    if (victim) hurt(sim, victim, WEAPONS.gauntlet.damage, player.id, 'gauntlet', now);
  }
}

function firePlasma(sim: ArenaSim, player: ArenaPlayer, now: number): void {
  const dir = aimVector(player.input.yaw, player.input.pitch);
  sim.rockets.push({
    id: sim.nextRocketId++,
    owner: player.id,
    kind: 'plasma',
    x: player.body.x + dir.x * 0.6,
    y: player.body.y + PLAYER.eye + dir.y * 0.6,
    z: player.body.z + dir.z * 0.6,
    vx: dir.x * WEAPONS.plasma.speed,
    vy: dir.y * WEAPONS.plasma.speed,
    vz: dir.z * WEAPONS.plasma.speed,
    ttl: now + WEAPONS.plasma.ttlMs,
  });
}

function explode(sim: ArenaSim, rocket: Rocket, x: number, y: number, z: number, directId: string | null, now: number): void {
  const spec = rocket.kind === 'plasma' ? WEAPONS.plasma : WEAPONS.rocket;
  const radius = spec.radius;
  for (const player of sim.players.values()) {
    if (!player.alive) continue;
    const distance = Math.hypot(player.body.x - x, player.body.y + 0.9 - y, player.body.z - z);
    if (distance > radius) continue;
    // Bot se nesmí vyhodit vlastní raketou na blízko (hraje se pro lidi).
    const owner = sim.players.get(rocket.owner);
    if (owner?.isBot && player.id === rocket.owner && distance < 2) continue;
    const base = player.id === directId ? spec.damage : spec.splash;
    const falloff = player.id === directId ? 1 : 1 - distance / radius;
    const amount = Math.round(base * Math.max(0.15, falloff));
    hurt(sim, player, amount, rocket.owner, rocket.kind, now);
  }
}

/**
 * Boti jedou **stejným modulem** jako boti v sólové aréně
 * (`core/arena/bot.ts`) — jinak by „boti jsou slabí" byl jen dojem a hráč
 * by v MP potkal jiné boty než v sóle.
 */
function stepBots(sim: ArenaSim, dt: number, now: number): void {
  const targets: BotTarget[] = [...sim.players.values()]
    .filter((player) => player.alive)
    .map((player) => ({
      id: player.id,
      x: player.body.x,
      y: player.body.y,
      z: player.body.z,
      alive: player.alive,
      isBot: player.isBot === true,
    }));

  for (const bot of sim.players.values()) {
    if (!bot.isBot) continue;
    if (!bot.alive) continue;
    const memory = bot.memory ?? createBotMemory();
    bot.memory = memory;

    // úroveň určuje jen parametry mozku (rychlost, přesnost, kadenci) —
    // damage drží sdílená `WEAPONS` a nesmí se měnit podle obtížnosti
    const options = skillOptions(bot.skill ?? 'normal');
    const intent = stepBot(memory, bot.body, targets, sim.nav, sim.solids, now, dt, options);
    bot.input.forward = intent.forward;
    bot.input.strafe = intent.strafe;
    bot.input.jump = intent.jump;
    bot.input.yaw = intent.yaw;
    bot.input.pitch = intent.pitch;
    bot.input.fire = intent.fire;
    // Zbraň podle vzdálenosti — stejné pravidlo jako v sólu. Raketa jen
    // občas, aby souboj nebyl jen o výbuších.
    const nearest = nearestTarget(targets, bot.body);
    const distance = nearest ? Math.hypot(nearest.x - bot.body.x, nearest.z - bot.body.z) : 99;
    let botWeapon: WeaponId = botWeaponFor(distance);
    if (botWeapon === 'rocket' && Math.random() > BOT_FIRE.rocketChance) botWeapon = 'mg';
    bot.input.weapon = botWeapon;
  }
}

function stepRockets(sim: ArenaSim, dt: number, now: number): void {  const survivors: Rocket[] = [];
  for (const rocket of sim.rockets) {
    if (now > rocket.ttl) {
      explode(sim, rocket, rocket.x, rocket.y, rocket.z, null, now);
      continue;
    }
    const nx = rocket.x + rocket.vx * dt;
    const ny = rocket.y + rocket.vy * dt;
    const nz = rocket.z + rocket.vz * dt;
    const dx = nx - rocket.x;
    const dy = ny - rocket.y;
    const dz = nz - rocket.z;
    const length = Math.hypot(dx, dy, dz);
    if (length < 1e-6) {
      survivors.push(rocket);
      continue;
    }
    const ux = dx / length;
    const uy = dy / length;
    const uz = dz / length;

    // zeď a hráči — stejné funkce jako v prohlížeči
    const wall = raySolids(rocket.x, rocket.y, rocket.z, ux, uy, uz, sim.solids, length);
    let hitPlayer: string | null = null;
    let hitDistance = wall?.t ?? length;
    for (const target of liveTargets(sim, rocket.owner)) {
      const distance = raySphere(
        rocket.x,
        rocket.y,
        rocket.z,
        ux,
        uy,
        uz,
        target.x,
        target.y,
        target.z,
        target.radius,
      );
      if (distance !== null && distance < hitDistance) {
        hitDistance = distance;
        hitPlayer = target.id;
      }
    }

    if (wall !== null || hitPlayer) {
      explode(
        sim,
        rocket,
        rocket.x + ux * hitDistance,
        rocket.y + uy * hitDistance,
        rocket.z + uz * hitDistance,
        hitPlayer,
        now,
      );
      continue;
    }

    rocket.x = nx;
    rocket.y = ny;
    rocket.z = nz;
    survivors.push(rocket);
  }
  sim.rockets = survivors;
}

export function stepArena(sim: ArenaSim, dt: number, now: number): ArenaEvent[] {
  if (sim.state === 'ended') {
    if (now - sim.endedAt >= MATCH_RESTART_MS) restartMatch(sim, now);
    const events = sim.events;
    sim.events = [];
    return events;
  }

  // ── boti: stejný mozek jako v sóle (shared modul) ──────────────────
  stepBots(sim, dt, now);

  // respawny a smrt
  for (const player of sim.players.values()) {
    if (player.alive) continue;
    if (player.respawnAt === 0 || now >= player.respawnAt) {
      const spawn = spawnPoint(sim, false);
      player.hp = 100;
      player.armor = 0;
      player.weapon = 'rail';
      player.ammo = WEAPONS.rocket.ammo;
      player.mgAmmo = WEAPONS.mg.ammo;
      player.shotgunAmmo = WEAPONS.shotgun.ammo;
      player.lightningAmmo = WEAPONS.lightning.ammo;
      player.plasmaAmmo = WEAPONS.plasma.ammo;
      player.alive = true;
      player.respawnAt = 0;
      player.lastHitBy = null;
      placeBody(player, spawn);
      sim.events.push({ kind: 'respawn', id: player.id });
    }
  }

  for (const player of sim.players.values()) {
    if (!player.alive) continue;

    stepBody(player.body, player.input.yaw, {
      forward: player.input.forward,
      strafe: player.input.strafe,
      jump: player.input.jump,
    }, dt, sim.solids);

    // zbraň a střelba — každá zbraň má vlastní zásobník
    if (player.input.weapon !== player.weapon) {
      if (player.input.weapon === 'rail' || ammoOf(player, player.input.weapon) > 0) {
        player.weapon = player.input.weapon;
      }
    }
    if (player.input.fire && now >= player.cooldownUntil) {
      const weapon = player.weapon;
      const spec = WEAPONS[weapon];
      // Boti mají munici nekonečnou — jinak by po pár ranách skončili na railu.
      const ammo = player.isBot ? Number.POSITIVE_INFINITY : ammoOf(player, weapon);
      if (Number.isFinite(ammo) && ammo <= 0) {
        player.weapon = 'rail';
      } else {
        player.cooldownUntil = now + spec.cooldownMs;
        if (Number.isFinite(ammo)) spendAmmo(player, weapon);
        if (weapon === 'rail') fireRail(sim, player, now);
        else if (weapon === 'mg') fireMg(sim, player, now);
        else if (weapon === 'shotgun') fireShotgun(sim, player, now);
        else if (weapon === 'lightning') fireLightning(sim, player, now);
        else if (weapon === 'plasma') firePlasma(sim, player, now);
        else if (weapon === 'gauntlet') fireGauntlet(sim, player, now);
        else fireRocket(sim, player, now);
        if (Number.isFinite(ammo) && ammoOf(player, weapon) <= 0) player.weapon = 'rail';
      }
    }

    // pickupy
    for (const pickup of sim.pickups) {
      const readyAt = sim.pickupReadyAt.get(pickup.id) ?? 0;
      if (now < readyAt) continue;
      const distance = Math.hypot(player.body.x - pickup.x, player.body.z - pickup.z);
      if (distance > PICKUP_RANGE) continue;
      if (pickup.kind === 'health' && player.hp >= 100) continue;
      if (pickup.kind === 'armor' && player.armor >= 100) continue;
      if (pickup.kind === 'shard' && player.armor >= 100) continue;

      if (pickup.kind === 'health') player.hp = Math.min(100, player.hp + 25);
      else if (pickup.kind === 'ammo') {
        const before =
          player.ammo + player.mgAmmo + player.shotgunAmmo + player.lightningAmmo + player.plasmaAmmo;
        player.ammo = Math.min(WEAPONS.rocket.ammo, player.ammo + 5);
        player.mgAmmo = Math.min(WEAPONS.mg.ammo, player.mgAmmo + MG_AMMO_PICKUP);
        player.shotgunAmmo = Math.min(WEAPONS.shotgun.ammo, player.shotgunAmmo + WEAPONS.shotgun.pickup);
        player.lightningAmmo = Math.min(WEAPONS.lightning.ammo, player.lightningAmmo + WEAPONS.lightning.pickup);
        player.plasmaAmmo = Math.min(WEAPONS.plasma.ammo, player.plasmaAmmo + WEAPONS.plasma.pickup);
        const after =
          player.ammo + player.mgAmmo + player.shotgunAmmo + player.lightningAmmo + player.plasmaAmmo;
        if (after === before) continue;
      } else if (pickup.kind === 'shard') player.armor = Math.min(100, player.armor + 5);
      else player.armor = Math.min(100, player.armor + 50);
      sim.pickupReadyAt.set(pickup.id, now + pickup.respawn * 1000);
      sim.events.push({ kind: 'pickup', id: player.id, item: pickup.kind });
    }

    // frag limit počítá jen lidi — bot nesmí vyhrát zápas člověku
    if (!player.isBot && player.frags >= FRAG_LIMIT) endMatch(sim, now);
  }

  stepRockets(sim, dt, now);

  if (now - sim.startedAt >= MATCH_SECONDS * 1000) endMatch(sim, now);

  sim.seq += 1;
  const events = sim.events;
  sim.events = [];
  return events;
}

function endMatch(sim: ArenaSim, now: number): void {
  if (sim.state === 'ended') return;
  sim.state = 'ended';
  sim.endedAt = now;
  sim.rockets = [];
  sim.events.push({
    kind: 'match_end',
    scoreboard: [...sim.players.values()]
      .map((player) => ({
        id: player.id,
        name: player.name,
        frags: player.frags,
        deaths: player.deaths,
      }))
      .sort((a, b) => b.frags - a.frags || a.deaths - b.deaths),
  });
}

function restartMatch(sim: ArenaSim, now: number): void {
  sim.state = 'running';
  sim.startedAt = now;
  sim.seq = 0;
  sim.rockets = [];
  sim.pickupReadyAt.clear();
  sim.spawnCursor = 0;
  for (const player of sim.players.values()) {
    player.frags = 0;
    player.deaths = 0;
    player.hp = 100;
    player.armor = 0;
    player.alive = true;
    player.respawnAt = 0;
    player.weapon = 'rail';
    player.ammo = WEAPONS.rocket.ammo;
    player.mgAmmo = WEAPONS.mg.ammo;
    player.shotgunAmmo = WEAPONS.shotgun.ammo;
    player.lightningAmmo = WEAPONS.lightning.ammo;
    player.plasmaAmmo = WEAPONS.plasma.ammo;
    player.cooldownUntil = 0;
    placeBody(player, spawnPoint(sim, false));
  }
  sim.events.push({ kind: 'match_start', at: now });
}

export interface ArenaSnapshotPlayer {
  id: string;
  name: string;
  avatarId: number | null;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  hp: number;
  armor: number;
  frags: number;
  deaths: number;
  weapon: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** Munice aktivní zbraně (rail/pěst = −1 = nekonečno). */
  ammo: number;
  mgAmmo: number;
  /** Munice všech zbraní pro HUD. */
  ammoByWeapon: Record<number, number>;
  alive: boolean;
  /** Serverový bot (Q3 sestava) — tabule ho odliší. */
  isBot?: boolean;
}

/** Pořadí zbraní na drátě — stejné jako `WeaponId` v protokolu. */
const WEAPON_NUM: Record<WeaponId, 0 | 1 | 2 | 3 | 4 | 5 | 6> = {
  rail: 0,
  rocket: 1,
  mg: 2,
  shotgun: 3,
  lightning: 4,
  plasma: 5,
  gauntlet: 6,
};

export function arenaSnapshot(sim: ArenaSim, now: number) {
  const players: ArenaSnapshotPlayer[] = [...sim.players.values()].map((player) => ({
    id: player.id,
    name: player.name,
    avatarId: player.avatarId,
    x: Math.round(player.body.x * 100) / 100,
    y: Math.round(player.body.y * 100) / 100,
    z: Math.round(player.body.z * 100) / 100,
    yaw: Math.round(player.input.yaw * 1000) / 1000,
    pitch: Math.round(player.input.pitch * 1000) / 1000,
    hp: player.hp,
    armor: player.armor,
    frags: player.frags,
    deaths: player.deaths,
    weapon: WEAPON_NUM[player.weapon] ?? 0,
    ammo: Number.isFinite(ammoOf(player, player.weapon)) ? ammoOf(player, player.weapon) : -1,
    mgAmmo: player.mgAmmo,
    ammoByWeapon: {
      0: -1,
      1: player.ammo,
      2: player.mgAmmo,
      3: player.shotgunAmmo,
      4: player.lightningAmmo,
      5: player.plasmaAmmo,
      6: -1,
    },
    alive: player.alive,
    isBot: player.isBot === true,
  }));

  return {
    players,
    projectiles: sim.rockets.map((rocket) => ({
      id: rocket.id,
      owner: rocket.owner,
      x: Math.round(rocket.x * 100) / 100,
      y: Math.round(rocket.y * 100) / 100,
      z: Math.round(rocket.z * 100) / 100,
    })),
    pickups: sim.pickups.map((pickup) => ({
      id: pickup.id,
      taken: (sim.pickupReadyAt.get(pickup.id) ?? 0) > now,
    })),
    state: sim.state,
    secondsLeft: Math.max(0, Math.round(MATCH_SECONDS - (now - sim.startedAt) / 1000)),
  };
}
