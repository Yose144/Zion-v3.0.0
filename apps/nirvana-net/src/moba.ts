/**
 * MOBA „PRVNÍ SVĚT" — serverová místnost (2v2).
 *
 * Server drží **jednu simulaci** (`core/moba/sim.ts`, stejný modul jako sólo)
 * a jen do ní pumpuje vstupy hráčů. Volná sedla doplní boti, aby se na hru
 * nečekalo — stejný princip jako „Stín" v Merkuru.
 *
 * Pravidlo M2a: klient nepočítá poškození ani vlny. Kdyby počítal, hráči by
 * viděli jinou hru, než jakou server rozhodl.
 */

import {
  buyItem,
  createMobaMatch,
  heroById,
  mobaSnapshot,
  stepMoba,
  NO_INPUT,
  type ItemId,
  type MobaInput,
  type MobaSeat,
  type MobaState,
} from '../../nirvana/src/core/moba/sim.js';
import { AVATARS_BY_ID } from '../../nirvana/src/core/avatars/catalog.js';

/** Pět na každé straně (5v5). */
export const MOBA_ROOM_SIZE = 10;
/** Kolik hrdinů má mít každá strana. */
const TEAM_SIZE = 5;
/** Jak dlouho se čeká na druhého hráče, než nastoupí boti. */
const BOT_FILL_DELAY_MS = 6000;
/** Odpočet před startem (ms). */
const COUNTDOWN_MS = 4000;
/** Pauza po konci zápasu, než se rozjede nový. */
const RESTART_MS = 12_000;

export type MobaPhase = 'waiting' | 'countdown' | 'running' | 'ended';

export interface MobaSeatInfo {
  /** Id připojení (u lidí) nebo `bot-N` (u doplněných botů). */
  id: string;
  heroId: number;
  team: 'blue' | 'red';
  human: boolean;
}

export interface MobaRoomSim {
  createdAt: number;
  phase: MobaPhase;
  seats: Map<string, MobaSeatInfo>;
  sim: MobaState | null;
  startAt: number;
  endedAt: number;
  seq: number;
  inputs: Map<string, MobaInput>;
  lastError: string | null;
}

/** Záloha pro doplnění botů — známé postavy, ať to není náhodný šum. */
const BOT_HEROES = [82, 85, 86, 84, 3, 19, 20, 5];

export function createMobaRoom(now: number): MobaRoomSim {
  return {
    createdAt: now,
    phase: 'waiting',
    seats: new Map(),
    sim: null,
    startAt: 0,
    endedAt: 0,
    seq: 0,
    inputs: new Map(),
    lastError: null,
  };
}

function teamCount(room: MobaRoomSim, team: 'blue' | 'red'): number {
  let count = 0;
  for (const seat of room.seats.values()) if (seat.team === team) count += 1;
  return count;
}

/** Přidá hráče do volného sedla. Vrací false, když je plno. */
export function addMobaSeat(room: MobaRoomSim, connId: string, heroId: number | undefined, now: number): boolean {
  if (room.seats.size >= MOBA_ROOM_SIZE) return false;
  const wanted = heroId !== undefined && AVATARS_BY_ID.has(heroId) ? heroId : 0;
  // zákaz duplicit: obsazený hrdina → první volný z poolu (hráč to uvidí v HUD)
  const taken = new Set([...room.seats.values()].map((seat) => seat.heroId));
  let safeHero = wanted;
  if (taken.has(wanted)) {
    const free = BOT_HEROES.find((id) => !taken.has(id));
    safeHero = free ?? wanted;
    room.lastError = `hrdina ${wanted} je obsazený, dostal jsi ${safeHero}`;
  }
  const team: 'blue' | 'red' = teamCount(room, 'blue') <= teamCount(room, 'red') ? 'blue' : 'red';
  room.seats.set(connId, { id: connId, heroId: safeHero, team, human: true });
  room.inputs.set(connId, NO_INPUT);
  if (room.phase === 'waiting') room.startAt = Math.min(room.startAt || now + BOT_FILL_DELAY_MS, now + BOT_FILL_DELAY_MS + 4000);
  return true;
}

export function removeMobaSeat(room: MobaRoomSim, connId: string): void {
  room.seats.delete(connId);
  room.inputs.delete(connId);
}

/** Nákup itemu pro hráče v místnosti. */
export function buyMobaItem(room: MobaRoomSim, connId: string, itemId: ItemId): boolean {
  if (!room.sim) return false;
  const hero = heroById(room.sim, connId);
  if (!hero) return false;
  return buyItem(hero, itemId);
}

export function setMobaInput(room: MobaRoomSim, connId: string, input: MobaInput): void {
  if (!room.seats.has(connId)) return;
  room.inputs.set(connId, input);
}

/** Doplní boty tak, aby každá strana měla dva hráče. */
function fillBots(room: MobaRoomSim): void {
  let index = 0;
  for (const team of ['blue', 'red'] as const) {
    while (teamCount(room, team) < TEAM_SIZE) {
      const heroId = BOT_HEROES[index % BOT_HEROES.length]!;
      index += 1;
      const id = `bot-${team}-${index}`;
      room.seats.set(id, { id, heroId, team, human: false });
      room.inputs.delete(id);
    }
  }
}

function startMatch(room: MobaRoomSim, now: number): void {
  fillBots(room);
  const seats: MobaSeat[] = [...room.seats.values()].map((seat) => ({
    id: seat.id,
    heroId: seat.heroId,
    team: seat.team,
    human: seat.human,
  }));
  room.sim = createMobaMatch(seats, now);
  room.phase = 'running';
  room.startAt = 0;
  room.endedAt = 0;
  room.lastError = null;
}

export function stepMobaRoom(room: MobaRoomSim, dt: number, now: number): void {
  if (room.phase === 'waiting') {
    if (room.seats.size > 0 && room.startAt > 0 && now >= room.startAt) {
      room.phase = 'countdown';
      room.startAt = now + COUNTDOWN_MS;
    }
    return;
  }

  if (room.phase === 'countdown') {
    if (now >= room.startAt) startMatch(room, now);
    return;
  }

  if (room.phase === 'ended') {
    if (now - room.endedAt >= RESTART_MS) startMatch(room, now);
    return;
  }

  if (!room.sim) return;
  stepMoba(room.sim, dt, Object.fromEntries(room.inputs), now);
  // kouzlo je jednorázové — bez vyčištění by se sesílalo každý tick
  for (const input of room.inputs.values()) input.cast = null;
  room.seq += 1;

  if (room.sim.ended) {
    room.phase = 'ended';
    room.endedAt = now;
  }
}

export interface MobaRoomSnapshot {
  moba: ReturnType<typeof mobaSnapshot>;
  countdown: number;
  phase: MobaPhase;
}

export function mobaRoomSnapshot(room: MobaRoomSim, now: number): MobaRoomSnapshot {
  return {
    moba: room.sim
      ? mobaSnapshot(room.sim)
      : {
          time: 0,
          ended: null,
          banner: 'Čeká se na hráče…',
          wave: 0,
          nextWaveIn: 0,
          nodes: [],
          towers: [],
          heroes: [],
          minions: [],
          monsters: [],
          projectiles: [],
          effects: [],
        },
    countdown: room.phase === 'countdown' ? Math.max(0, Math.ceil((room.startAt - now) / 1000)) : 0,
    phase: room.phase,
  };
}

/** Hrdinové, kteří v místnosti ještě nejsou — klient z toho může nabízet výběr. */
export function freeHeroes(room: MobaRoomSim): number[] {
  const taken = new Set([...room.seats.values()].map((seat) => seat.heroId));
  return BOT_HEROES.filter((id) => !taken.has(id));
}
