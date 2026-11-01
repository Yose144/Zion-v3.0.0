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
  PLAYER_RESPAWN_MS,
  TARGET_EYE_RATIO,
  TARGET_RADIUS,
  WEAPONS,
  aimVector,
  applyDamage,
  pickTarget,
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
  ammo: number;
  alive: boolean;
  respawnAt: number;
  cooldownUntil: number;
  input: ArenaInput;
  lastHitBy: string | null;
}

export interface Rocket {
  id: number;
  owner: string;
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
  | { kind: 'pickup'; id: string; item: 'health' | 'armor' }
  | { kind: 'match_start'; at: number }
  | { kind: 'match_end'; scoreboard: { id: string; name: string; frags: number; deaths: number }[] };

export interface ArenaSim {
  players: Map<string, ArenaPlayer>;
  rockets: Rocket[];
  solids: Box4[];
  pickups: ArenaPickup[];
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

export function createArena(now: number): ArenaSim {
  return {
    players: new Map(),
    rockets: [],
    solids: makeSolids(ARENA_BOXES),
    pickups: ARENA_PICKUPS,
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
    alive: true,
    respawnAt: 0,
    cooldownUntil: 0,
    input: { forward: 0, strafe: 0, yaw: spawn.yaw, pitch: -0.05, jump: false, fire: false, weapon: 'rail' },
    lastHitBy: null,
  };
  sim.players.set(id, player);
  if (sim.players.size === 1) {
    sim.startedAt = now;
    sim.state = 'running';
    sim.events.push({ kind: 'match_start', at: now });
  }
  return player;
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

function fireRocket(sim: ArenaSim, player: ArenaPlayer, now: number): void {
  const dir = aimVector(player.input.yaw, player.input.pitch);
  sim.rockets.push({
    id: sim.nextRocketId++,
    owner: player.id,
    x: player.body.x + dir.x * 0.6,
    y: player.body.y + PLAYER.eye + dir.y * 0.6,
    z: player.body.z + dir.z * 0.6,
    vx: dir.x * WEAPONS.rocket.speed,
    vy: dir.y * WEAPONS.rocket.speed,
    vz: dir.z * WEAPONS.rocket.speed,
    ttl: now + WEAPONS.rocket.ttlMs,
  });
}

function explode(sim: ArenaSim, rocket: Rocket, x: number, y: number, z: number, directId: string | null, now: number): void {
  const radius = WEAPONS.rocket.radius;
  for (const player of sim.players.values()) {
    if (!player.alive) continue;
    const distance = Math.hypot(player.body.x - x, player.body.y + 0.9 - y, player.body.z - z);
    if (distance > radius) continue;
    const base = player.id === directId ? WEAPONS.rocket.damage : WEAPONS.rocket.splash;
    const falloff = player.id === directId ? 1 : 1 - distance / radius;
    const amount = Math.round(base * Math.max(0.15, falloff));
    hurt(sim, player, amount, rocket.owner, 'rocket', now);
  }
}

function stepRockets(sim: ArenaSim, dt: number, now: number): void {
  const survivors: Rocket[] = [];
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

  // respawny a smrt
  for (const player of sim.players.values()) {
    if (player.alive) continue;
    if (player.respawnAt === 0 || now >= player.respawnAt) {
      const spawn = spawnPoint(sim, false);
      player.hp = 100;
      player.armor = 0;
      player.weapon = 'rail';
      player.ammo = WEAPONS.rocket.ammo;
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

    // zbraň a střelba
    if (player.input.weapon !== player.weapon) {
      if (player.input.weapon === 'rail' || player.ammo > 0) player.weapon = player.input.weapon;
    }
    if (player.input.fire && now >= player.cooldownUntil) {
      if (player.weapon === 'rail') {
        player.cooldownUntil = now + WEAPONS.rail.cooldownMs;
        fireRail(sim, player, now);
      } else if (player.ammo > 0) {
        player.ammo -= 1;
        player.cooldownUntil = now + WEAPONS.rocket.cooldownMs;
        fireRocket(sim, player, now);
        if (player.ammo <= 0) player.weapon = 'rail';
      } else {
        player.weapon = 'rail';
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
      if (pickup.kind === 'health') player.hp = Math.min(100, player.hp + 25);
      else player.armor = Math.min(100, player.armor + 50);
      sim.pickupReadyAt.set(pickup.id, now + pickup.respawn * 1000);
      sim.events.push({ kind: 'pickup', id: player.id, item: pickup.kind });
    }

    if (player.frags >= FRAG_LIMIT) endMatch(sim, now);
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
  weapon: 0 | 1;
  alive: boolean;
}

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
    weapon: player.weapon === 'rocket' ? 1 : 0,
    alive: player.alive,
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
