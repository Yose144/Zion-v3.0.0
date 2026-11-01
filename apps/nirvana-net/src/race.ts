/**
 * VENUŠE — serverová simulace závodu.
 *
 * Stejná trať a stejná fyzika jako v prohlížeči
 * (`core/race/track.ts`, `core/race/physics.ts`), takže se server a klient
 * nemůžou rozejít v tom, kde je okraj tratě. Klient posílá jen plyn a zatáčení.
 *
 * Závod: odpočet 3 s → tři kola → cílovka. Když dojedou všichni (nebo vyprší
 * čas), závod skončí a po chvíli se rozjede nový.
 */

import {
  CHECKPOINTS,
  LAPS,
  SAMPLES,
  buildTrack,
  checkpointIndices,
  type TrackPoint,
} from '../../nirvana/src/core/race/track.js';
import { type Craft, spawnCraft, stepCraft } from '../../nirvana/src/core/race/physics.js';
import { advanceLap, newLapState, type LapState } from '../../nirvana/src/core/race/rivals.js';

export interface RaceInput {
  /** −1..1 (záporné = brzda/couvat). */
  throttle: number;
  /** −1..1 (kladné = doleva, stejná konvence jako sólo). */
  steer: number;
}

export interface RacePlayer {
  id: string;
  name: string;
  craft: Craft;
  lap: LapState;
  input: RaceInput;
  offTrack: boolean;
}

export type RacePhase = 'countdown' | 'running' | 'ended';

export type RaceEvent =
  | { kind: 'race_start'; at: number }
  | { kind: 'finish'; id: string; name: string; totalSeconds: number; position: number }
  | {
      kind: 'race_end';
      standings: { id: string; name: string; totalSeconds: number | null; laps: number }[];
    };

export interface RaceSim {
  track: TrackPoint[];
  checkpoints: number[];
  players: Map<string, RacePlayer>;
  phase: RacePhase;
  /** Simulovaný čas začátku odpočtu / závodu (ms, wall clock). */
  countdownUntil: number;
  startedAt: number;
  endedAt: number;
  seq: number;
  events: RaceEvent[];
}

/** Rozestupy na roštu: hráč 1 a 2 v první řadě, další o kus zpět. */
const GRID: { sample: number; lateral: number }[] = [
  { sample: 0, lateral: -2.6 },
  { sample: 0, lateral: 2.6 },
  { sample: SAMPLES - 6, lateral: -2.6 },
  { sample: SAMPLES - 6, lateral: 2.6 },
  { sample: SAMPLES - 12, lateral: -2.6 },
  { sample: SAMPLES - 12, lateral: 2.6 },
  { sample: SAMPLES - 18, lateral: -2.6 },
  { sample: SAMPLES - 18, lateral: 2.6 },
];

const COUNTDOWN_MS = 3000;
/** Po konci závodu se čeká na nový. */
const RESTART_MS = 8000;
/** Strop závodu: 3 kola + rezerva (jeden hráč, co zůstane viset, nesmí držet ostatní). */
const RACE_TIMEOUT_MS = 8 * 60 * 1000;

export function createRace(now: number): RaceSim {
  return {
    track: buildTrack(),
    checkpoints: checkpointIndices(),
    players: new Map(),
    phase: 'countdown',
    countdownUntil: now + COUNTDOWN_MS,
    startedAt: 0,
    endedAt: 0,
    seq: 0,
    events: [],
  };
}

export function addRacePlayer(sim: RaceSim, id: string, name: string, now: number): RacePlayer {
  const slot = GRID[sim.players.size % GRID.length]!;
  const craft = spawnCraft(sim.track, slot.sample, slot.lateral);
  const lap = newLapState(slot.sample);
  const player: RacePlayer = {
    id,
    name,
    craft,
    lap,
    input: { throttle: 0, steer: 0 },
    offTrack: false,
  };
  sim.players.set(id, player);

  // nový hráč = nový odpočet, ať má šanci nastoupit na rošt
  if (sim.phase === 'ended' || sim.phase === 'countdown' || sim.players.size === 1) {
    sim.phase = 'countdown';
    sim.countdownUntil = now + COUNTDOWN_MS;
    sim.startedAt = 0;
    sim.endedAt = 0;
  }
  return player;
}

export function removeRacePlayer(sim: RaceSim, id: string): void {
  sim.players.delete(id);
  if (sim.players.size === 0) {
    sim.phase = 'countdown';
    sim.startedAt = 0;
    sim.endedAt = 0;
  }
}

export function setRaceInput(sim: RaceSim, id: string, input: Partial<RaceInput>): void {
  const player = sim.players.get(id);
  if (!player) return;
  if (typeof input.throttle === 'number' && Number.isFinite(input.throttle)) {
    player.input.throttle = Math.max(-1, Math.min(1, input.throttle));
  }
  if (typeof input.steer === 'number' && Number.isFinite(input.steer)) {
    player.input.steer = Math.max(-1, Math.min(1, input.steer));
  }
}

function standings(sim: RaceSim) {
  return [...sim.players.values()]
    .map((player) => ({
      id: player.id,
      name: player.name,
      totalSeconds:
        player.lap.finishedAt === null || sim.startedAt === 0
          ? null
          : (player.lap.finishedAt - sim.startedAt) / 1000,
      laps: Math.min(LAPS, player.lap.lap),
      travelled: player.lap.travelled,
    }))
    .sort((a, b) => {
      if (a.totalSeconds !== null && b.totalSeconds !== null) return a.totalSeconds - b.totalSeconds;
      if (a.totalSeconds !== null) return -1;
      if (b.totalSeconds !== null) return 1;
      return b.travelled - a.travelled;
    });
}

export function stepRace(sim: RaceSim, dt: number, now: number): RaceEvent[] {
  if (sim.phase === 'countdown') {
    if (now >= sim.countdownUntil) {
      sim.phase = 'running';
      sim.startedAt = now;
      for (const player of sim.players.values()) {
        player.lap.lapStart = now;
        player.input.throttle = 0;
        player.input.steer = 0;
      }
      sim.events.push({ kind: 'race_start', at: now });
    }
    return drain(sim);
  }

  if (sim.phase === 'ended') {
    if (now - sim.endedAt >= RESTART_MS) {
      sim.phase = 'countdown';
      sim.countdownUntil = now + COUNTDOWN_MS;
      sim.startedAt = 0;
      sim.endedAt = 0;
      for (const [index, player] of [...sim.players.values()].entries()) {
        const slot = GRID[index % GRID.length]!;
        player.craft = spawnCraft(sim.track, slot.sample, slot.lateral);
        player.lap = newLapState(slot.sample);
        player.input = { throttle: 0, steer: 0 };
        player.offTrack = false;
      }
    }
    return drain(sim);
  }

  // ── běžící závod ──────────────────────────────────────────────────
  for (const player of sim.players.values()) {
    if (player.lap.finishedAt !== null) continue; // dojel, jen se veze

    const step = stepCraft(player.craft, player.input, sim.track, dt, now);
    player.offTrack = step.offTrack;

    const result = advanceLap(player.lap, step.index, sim.checkpoints, now);
    if (result.finished) {
      const totalSeconds = (player.lap.finishedAt! - sim.startedAt) / 1000;
      const position = standings(sim).findIndex((row) => row.id === player.id) + 1;
      sim.events.push({
        kind: 'finish',
        id: player.id,
        name: player.name,
        totalSeconds: Math.round(totalSeconds * 100) / 100,
        position,
      });
    }
  }

  const allFinished =
    sim.players.size > 0 &&
    [...sim.players.values()].every((player) => player.lap.finishedAt !== null);
  const timedOut = now - sim.startedAt > RACE_TIMEOUT_MS;

  if (allFinished || timedOut) {
    sim.phase = 'ended';
    sim.endedAt = now;
    sim.events.push({
      kind: 'race_end',
      standings: standings(sim)
        .slice(0, 8)
        .map((row) => ({
          id: row.id,
          name: row.name,
          totalSeconds: row.totalSeconds === null ? null : Math.round(row.totalSeconds * 100) / 100,
          laps: row.laps,
        })),
    });
  }

  sim.seq += 1;
  return drain(sim);
}

function drain(sim: RaceSim): RaceEvent[] {
  const events = sim.events;
  sim.events = [];
  return events;
}

export interface RaceSnapshotPlayer {
  id: string;
  name: string;
  x: number;
  z: number;
  heading: number;
  speed: number;
  lap: number;
  checkpoint: number;
  offTrack: boolean;
  finishedAtMs: number | null;
}

export function raceSnapshot(sim: RaceSim, now: number) {
  const players: RaceSnapshotPlayer[] = [...sim.players.values()].map((player) => ({
    id: player.id,
    name: player.name,
    x: Math.round(player.craft.x * 100) / 100,
    z: Math.round(player.craft.z * 100) / 100,
    heading: Math.round(player.craft.heading * 1000) / 1000,
    speed: Math.round(player.craft.speed * 100) / 100,
    lap: Math.min(LAPS, player.lap.lap),
    checkpoint: player.lap.nextCheckpoint,
    offTrack: player.offTrack,
    finishedAtMs:
      player.lap.finishedAt === null ? null : Math.round(player.lap.finishedAt - sim.startedAt),
  }));

  return {
    players,
    state: sim.phase,
    countdown:
      sim.phase === 'countdown' ? Math.max(0, Math.ceil((sim.countdownUntil - now) / 1000)) : 0,
    raceSeconds: sim.startedAt === 0 ? 0 : Math.round((now - sim.startedAt) / 100) / 10,
    laps: LAPS,
    checkpoints: CHECKPOINTS,
  };
}
