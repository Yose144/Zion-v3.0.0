/**
 * MERKUR — serverová ragdoll simulace souboje.
 *
 * Používá **přesně týž modul** co klient (`core/fight/ragdoll.ts`), takže se
 * nikdy nemůže rozejít „trefil jsem ho a nic". Prázdné sedlo drží bot
 * (stejný `botInput` jako sólo cvičení) — online duel tak není utkání
 * s prázdným stropem, když druhý hráč teprve dorazí.
 *
 * Zápas: best of 3, 60 s na kolo. Po konci zápasu se po 6 s tvoří nový.
 */

import {
  bodyCenterOf,
  botInput,
  createRagdollMatch,
  makeBotMemory,
  NO_INPUT,
  poseOf,
  resetRagdollMatch,
  stepRagdoll,
  type BotMemory,
  type FightInput,
  type RagdollFighter,
  type RagdollMatch,
} from '../../nirvana/src/core/fight/ragdoll.js';
import type { EventPayload, FightPlayerState } from '../../nirvana/src/core/net/protocol.js';

export interface FightSeat {
  /** connection/player id, nebo null = sedlo drží bot. */
  id: string | null;
  name: string;
  avatarId: number | null;
}

export interface FightRoomSim {
  match: RagdollMatch;
  seats: { a: FightSeat; b: FightSeat };
  inputs: { a: FightInput; b: FightInput };
  bots: { a: BotMemory; b: BotMemory };
  /** Simulované hodiny (s) — bot i fáze se řídí jimi, ne wall-clock. */
  clock: number;
  /** `false` v místnosti „jen lidé" — prázdné sedlo zůstane prázdné. */
  botsEnabled: boolean;
  seq: number;
  /** Wall-clock čas, kdy se po `matchEnd` zrodí nový zápas (0 = nic naplánováno). */
  restartAt: number;
}

const RESTART_MS = 6000;

export function createFight(now: number, options: { bots?: boolean } = {}): FightRoomSim {
  const seats = {
    a: { id: null, name: 'Stín', avatarId: null },
    b: { id: null, name: 'Stín', avatarId: null },
  };
  const match = createRagdollMatch(
    'duel',
    { id: 'bot-a', name: 'Stín', avatarId: null },
    { id: 'bot-b', name: 'Stín', avatarId: null },
  );
  return {
    match,
    seats,
    inputs: { a: { ...NO_INPUT }, b: { ...NO_INPUT } },
    bots: { a: makeBotMemory(), b: makeBotMemory() },
    clock: 0,
    seq: 0,
    restartAt: 0,
    botsEnabled: options.bots ?? true,
  };
}

/** Obsadí první volné sedlo. Vrací false, když je zápas plný. */
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
      const fighter = sim.match[side];
      fighter.id = id;
      fighter.name = name;
      fighter.avatarId = avatarId;
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
      const fighter = sim.match[side];
      fighter.id = `bot-${side}`;
      fighter.name = 'Stín';
      fighter.avatarId = null;
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

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function stepFight(sim: FightRoomSim, dt: number, now: number): EventPayload[] {
  // Místnost „jen lidé": dokud sedí jen jeden, duel neběží (dřív by ho
  // sehrál bot a hráč by čekal na soupeře, který mezitím vyhrál).
  if (!sim.botsEnabled && (sim.seats.a.id === null || sim.seats.b.id === null)) {
    return [];
  }

  sim.clock += dt;

  // volná sedla hraje bot; lidský input platí jen pro obsazená
  const inputA =
    sim.seats.a.id !== null
      ? sim.inputs.a
      : botInput(sim.match, 'a', sim.bots.a, 'standard', sim.clock);
  const inputB =
    sim.seats.b.id !== null
      ? sim.inputs.b
      : botInput(sim.match, 'b', sim.bots.b, 'standard', sim.clock);

  const raw = stepRagdoll(sim.match, inputA, inputB, dt, now);

  if (sim.match.phase === 'matchEnd' && sim.restartAt === 0) {
    sim.restartAt = now + RESTART_MS;
  }
  if (sim.match.phase !== 'matchEnd') sim.restartAt = 0;

  const wire: EventPayload[] = [];
  for (const event of raw) {
    if (event.kind === 'ko') {
      wire.push({
        kind: 'duel_ko',
        winner: event.winner,
        loser: event.loser,
        round: sim.match.round,
        at: event.at,
      });
    } else if (event.kind === 'round_end') {
      wire.push({
        kind: 'round_end',
        round: sim.match.round,
        winner: event.winner,
        reason: event.reason,
        at: event.at,
      });
    } else if (event.kind === 'fight_start') {
      wire.push({ kind: 'round_start', round: sim.match.round, at: event.at });
    } else if (event.kind === 'match_end' && event.winner) {
      wire.push({
        kind: 'duel_end',
        winner: event.winner,
        aWins: sim.match.a.wins,
        bWins: sim.match.b.wins,
        at: event.at,
      });
    }
  }

  if (sim.restartAt !== 0 && now >= sim.restartAt) {
    resetRagdollMatch(sim.match);
    sim.inputs = { a: { ...NO_INPUT }, b: { ...NO_INPUT } };
    sim.restartAt = 0;
  }

  sim.seq += 1;
  return wire;
}

function toState(fighter: RagdollFighter): FightPlayerState {
  const center = bodyCenterOf(fighter);
  return {
    id: fighter.id,
    name: fighter.name,
    avatarId: fighter.avatarId,
    x: round2(center.x),
    y: round2(center.y),
    facing: fighter.facing,
    hp: Math.round(fighter.hp),
    wins: fighter.wins,
    ko: fighter.ko,
    stun: round2(fighter.stun),
    blocking: fighter.guard,
    attack: null,
    pose: poseOf(fighter),
    guard: round2(fighter.guardMeter),
    combo: fighter.combo,
  };
}

export function fightSnapshot(sim: FightRoomSim, now: number) {
  const state: 'countdown' | 'running' | 'roundEnd' | 'matchEnd' =
    sim.match.phase === 'countdown'
      ? 'countdown'
      : sim.match.phase === 'playing'
        ? 'running'
        : sim.match.phase === 'roundEnd'
          ? 'roundEnd'
          : 'matchEnd';
  return {
    players: [toState(sim.match.a), toState(sim.match.b)] as FightPlayerState[],
    state,
    round: sim.match.round,
    countdown: sim.match.phase === 'countdown' ? Math.max(0, Math.ceil(sim.match.timer)) : 0,
    secondsLeft: sim.match.phase === 'playing' ? Math.max(0, Math.ceil(sim.match.timer)) : 0,
  };
}
