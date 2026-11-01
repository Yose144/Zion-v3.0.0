/**
 * MERKUR — serverová simulace souboje.
 *
 * Používá **přesně týž modul** co klient (`core/fight/duel.ts`), takže se
 * nikdy nemůže rozejít „trefil jsem ho a nic". Prázdné sedlo ve výchozí
 * pozici drží bot (stejný `botInput` jako sólo cvičení) — ať online duel
 * není utkání s pametným stropem, když druhý hráč teprve dorazí.
 *
 * Zápas: best of 3, 60 s na kolo. Po konci zápasu se po 6 s tvoří nový.
 */

import {
  botInput,
  createDuel,
  makeBotMemory,
  NO_INPUT,
  stepDuel,
  type BotMemory,
  type Duel,
  type DuelEvent,
  type FightInput,
  type Fighter,
} from '../../nirvana/src/core/fight/duel.js';
import type { EventPayload, FightPlayerState } from '../../nirvana/src/core/net/protocol.js';

export interface FightSeat {
  /** connection/player id, nebo null = sedlo drží bot. */
  id: string | null;
  name: string;
  avatarId: number | null;
}

export interface FightRoomSim {
  duel: Duel;
  seats: { a: FightSeat; b: FightSeat };
  inputs: { a: FightInput; b: FightInput };
  bots: { a: BotMemory; b: BotMemory };
  /** Simulované hodiny (s) — bot i fáze se řídí jimi, ne wall-clock. */
  clock: number;
  seq: number;
  /** Wall-clock čas, kdy se po `matchEnd` zrodí nový zápas (0 = nic naplánováno). */
  restartAt: number;
}

const RESTART_MS = 6000;

function seatFighter(seat: FightSeat, x: number, facing: 1 | -1): Fighter {
  return {
    id: seat.id ?? `bot-${x > 0 ? 'b' : 'a'}`,
    name: seat.name,
    avatarId: seat.avatarId,
    x,
    y: 0,
    vx: 0,
    vy: 0,
    onGround: true,
    hp: 100,
    facing,
    attack: null,
    blocking: false,
    stun: 0,
    wins: 0,
    ko: false,
  };
}

function freshDuel(seats: { a: FightSeat; b: FightSeat }): Duel {
  return {
    a: seatFighter(seats.a, -4, 1),
    b: seatFighter(seats.b, 4, -1),
    phase: 'countdown',
    timer: 3,
    round: 1,
    events: [],
  };
}

export function createFight(now: number): FightRoomSim {
  const seats = {
    a: { id: null, name: 'Stín', avatarId: null },
    b: { id: null, name: 'Stín', avatarId: null },
  };
  return {
    duel: freshDuel(seats),
    seats,
    inputs: { a: { ...NO_INPUT }, b: { ...NO_INPUT } },
    bots: { a: makeBotMemory(), b: makeBotMemory() },
    clock: 0,
    seq: 0,
    restartAt: 0,
  };
}

/** Obsadí první volné sedlo. Vrací false, když je zápas plný (index to řeší novou místností). */
export function addFightPlayer(
  sim: FightRoomSim,
  id: string,
  name: string,
  avatarId: number | null,
  _now: number,
): boolean {
  for (const side of ['a', 'b'] as const) {
    if (sim.seats[side].id === null) {
      sim.seats[side] = { id, name, avatarId };
      sim.duel[side].id = id;
      sim.duel[side].name = name;
      sim.duel[side].avatarId = avatarId;
      return true;
    }
  }
  return false;
}

export function removeFightPlayer(sim: FightRoomSim, id: string): void {
  for (const side of ['a', 'b'] as const) {
    if (sim.seats[side].id === id) {
      sim.seats[side] = { id: null, name: 'Stín', avatarId: null };
      sim.inputs[side] = { ...NO_INPUT };
      sim.duel[side].id = `bot-${side}`;
      sim.duel[side].name = 'Stín';
      sim.duel[side].avatarId = null;
    }
  }
}

export function setFightInput(sim: FightRoomSim, id: string, input: Partial<FightInput>): void {
  for (const side of ['a', 'b'] as const) {
    if (sim.seats[side].id !== id) continue;
    const current = sim.inputs[side];
    if (typeof input.move === 'number' && Number.isFinite(input.move)) {
      current.move = Math.max(-1, Math.min(1, input.move));
    }
    current.jump = input.jump === true;
    current.punch = input.punch === true;
    current.kick = input.kick === true;
    current.block = input.block === true;
  }
}

/** Jméno pro tabuli/hud — identitu zná jen server, nikdy klient. */
function eventsToWire(sim: FightRoomSim, events: DuelEvent[]): EventPayload[] {
  return events.map((event) => {
    if (event.kind === 'ko') {
      return { kind: 'duel_ko', winner: event.winner!, loser: event.loser!, round: sim.duel.round, at: event.at };
    }
    if (event.kind === 'round_end') {
      return {
        kind: 'round_end',
        round: sim.duel.round,
        winner: event.winner ?? null,
        reason: event.reason ?? 'ko',
        at: event.at,
      } as EventPayload;
    }
    if (event.kind === 'fight_start') {
      return { kind: 'round_start', round: sim.duel.round, at: event.at };
    }
    // match_end
    return {
      kind: 'duel_end',
      winner: event.winner!,
      aWins: sim.duel.a.wins,
      bWins: sim.duel.b.wins,
      at: event.at,
    };
  });
}

export function stepFight(sim: FightRoomSim, dt: number, now: number): EventPayload[] {
  sim.clock += dt;

  // volná sedla hraje bot; lidský input platí jen pro obsazené
  const inputA =
    sim.seats.a.id !== null ? sim.inputs.a : botInput(sim.duel, sim.bots.a, sim.duel.a, sim.duel.b, sim.clock);
  const inputB =
    sim.seats.b.id !== null ? sim.inputs.b : botInput(sim.duel, sim.bots.b, sim.duel.b, sim.duel.a, sim.clock);

  const events = stepDuel(sim.duel, inputA, inputB, dt, now);
  if (sim.duel.phase !== 'matchEnd') sim.restartAt = 0;
  if (sim.duel.phase === 'matchEnd' && sim.restartAt === 0) sim.restartAt = now + RESTART_MS;

  const wire = eventsToWire(sim, events);

  if (sim.restartAt !== 0 && now >= sim.restartAt) {
    sim.duel = freshDuel(sim.seats);
    sim.inputs = { a: { ...NO_INPUT }, b: { ...NO_INPUT } };
    sim.restartAt = 0;
  }

  sim.seq += 1;
  return wire;
}

function toState(fighter: Fighter): FightPlayerState {
  return {
    id: fighter.id,
    name: fighter.name,
    avatarId: fighter.avatarId,
    x: Math.round(fighter.x * 100) / 100,
    y: Math.round(fighter.y * 100) / 100,
    facing: fighter.facing,
    hp: fighter.hp,
    wins: fighter.wins,
    ko: fighter.ko,
    stun: Math.round(fighter.stun * 100) / 100,
    blocking: fighter.blocking,
    attack: fighter.attack
      ? { kind: fighter.attack.kind, elapsed: Math.round(fighter.attack.elapsed * 100) / 100 }
      : null,
  };
}

export function fightSnapshot(sim: FightRoomSim, now: number) {
  const state: 'countdown' | 'running' | 'roundEnd' | 'matchEnd' =
    sim.duel.phase === 'countdown'
      ? 'countdown'
      : sim.duel.phase === 'fighting'
        ? 'running'
        : sim.duel.phase === 'roundEnd'
          ? 'roundEnd'
          : 'matchEnd';
  return {
    players: [toState(sim.duel.a), toState(sim.duel.b)] as FightPlayerState[],
    state,
    round: sim.duel.round,
    countdown:
      sim.duel.phase === 'countdown' ? Math.max(0, Math.ceil(sim.duel.timer)) : 0,
    secondsLeft: sim.duel.phase === 'fighting' ? Math.max(0, Math.ceil(sim.duel.timer)) : 0,
  };
}
