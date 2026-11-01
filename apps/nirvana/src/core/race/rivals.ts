/**
 * VENUŠE — soupeři.
 *
 * Tři boti na stejné trati, se **stejnou fyzikou** jako hráč (`physics.ts`).
 * Liší se jen rozhodováním: jak pozdě brzdí a jak těsně řežou zatáčku.
 * Žádné rubber-banding — kdo jede čistěji, vyhraje. (Kdyby se přidalo
 * dohánění, přestane být čas na tabuli porovnatelný s lidským.)
 */

import {
  CHECKPOINTS,
  LAPS,
  SAMPLES,
  checkpointIndices,
  nearestSample,
  type TrackPoint,
} from './track';
import {
  type Craft,
  type CraftInput,
  clamp,
  spawnCraft,
  stepCraft,
  wrapAngle,
} from './physics';

export interface RivalSpec {
  id: string;
  nameCs: string;
  nameEn: string;
  color: string;
  /** 0–1 — jen rozhodování (brzdný bod, stopa). Fyzika je pro všechny stejná. */
  skill: number;
}

export const RIVALS: RivalSpec[] = [
  { id: 'jitrenka', nameCs: 'Jitřenka', nameEn: 'Dawnstar', color: '#c8f56a', skill: 0.93 },
  { id: 'fosfor', nameCs: 'Fosfor', nameEn: 'Phosphor', color: '#ff9de2', skill: 0.79 },
  { id: 'vega', nameCs: 'Vega', nameEn: 'Vega', color: '#7fe3d4', skill: 0.63 },
];

/** Rošt: hráč a nejrychlejší soupeř v první řadě, zbytek o kus zpět. */
const GRID: { sample: number; lateral: number }[] = [
  { sample: SAMPLES - 5, lateral: 2.6 },
  { sample: SAMPLES - 10, lateral: -2.6 },
  { sample: SAMPLES - 10, lateral: 2.6 },
];

export const PLAYER_LATERAL = -2.6;

/** Metry na vzorek tratě — počítá se jednou pro dané pole vzorků. */
const metresPerSampleCache = new WeakMap<TrackPoint[], number>();

function metresPerSample(track: TrackPoint[]): number {
  const cached = metresPerSampleCache.get(track);
  if (cached !== undefined) return cached;
  let total = 0;
  for (let i = 0; i < track.length; i++) {
    const a = track[i]!;
    const b = track[(i + 1) % track.length]!;
    total += Math.hypot(b.x - a.x, b.z - a.z);
  }
  const value = total / track.length;
  metresPerSampleCache.set(track, value);
  return value;
}

/** Stav na kolo — stejný pro hráče i boty, aby se kola počítala jedním kódem. */
export interface LapState {
  lap: number;
  nextCheckpoint: number;
  /** Simulovaný čas začátku kola (ms). */
  lapStart: number;
  lastLap: number | null;
  bestLap: number | null;
  /** Simulovaný čas dojetí cíle, nebo null. */
  finishedAt: number | null;
  /**
   * Ujetá vzdálenost ve vzorcích tratě — **jediná** metrika pořadí.
   * Sčítá se přírůstek indexu, takže funguje i pro rošt za startovní čárou
   * (viz `spawnSample`) a nezávisí na tom, kde zrovna je checkpoint.
   */
  travelled: number;
  /** Poslední známý vzorek (pro přírůstek). */
  sample: number;
}

/** Vzorek na roštu → ujetá vzdálenost: za startovní čárou je záporná. */
function startTravelled(spawnSample: number): number {
  return spawnSample > SAMPLES / 2 ? spawnSample - SAMPLES : spawnSample;
}

export function newLapState(spawnSample = 0): LapState {
  return {
    lap: 1,
    nextCheckpoint: 1,
    lapStart: 0,
    lastLap: null,
    bestLap: null,
    finishedAt: null,
    travelled: startTravelled(spawnSample),
    sample: spawnSample,
  };
}

/** Přírůstek indexu se ořízne na kratší cestu kolem dokola. */
function wrapSamples(delta: number): number {
  const half = SAMPLES / 2;
  return ((((delta + half) % SAMPLES) + SAMPLES) % SAMPLES) - half;
}

export interface LapStep {
  lapDone: boolean;
  finished: boolean;
}

/**
 * Projetí checkpointu v pořadí. Volá se každý frame; checkpoint se počítá,
 * jen když je nejbližší vzorek ≤ 4 od cílového indexu.
 */
export function advanceLap(
  state: LapState,
  index: number,
  checkpoints: number[],
  now: number,
): LapStep {
  state.travelled += wrapSamples(index - state.sample);
  state.sample = index;
  if (state.finishedAt !== null) return { lapDone: false, finished: false };

  const target = checkpoints[state.nextCheckpoint % CHECKPOINTS]!;
  const distance = Math.min(Math.abs(index - target), SAMPLES - Math.abs(index - target));
  if (distance > 4) return { lapDone: false, finished: false };

  state.nextCheckpoint += 1;
  if (state.nextCheckpoint <= CHECKPOINTS) return { lapDone: false, finished: false };

  const lapSeconds = (now - state.lapStart) / 1000;
  state.lastLap = lapSeconds;
  state.bestLap = state.bestLap === null ? lapSeconds : Math.min(state.bestLap, lapSeconds);
  state.lapStart = now;
  state.nextCheckpoint = 1;
  state.lap += 1;

  if (state.lap > LAPS) {
    state.finishedAt = now;
    return { lapDone: true, finished: true };
  }
  return { lapDone: true, finished: false };
}

export interface Rival {
  spec: RivalSpec;
  craft: Craft;
  lap: LapState;
}

export function createRivals(track: TrackPoint[]): Rival[] {
  return RIVALS.map((spec, i) => {
    const slot = GRID[i]!;
    return {
      spec,
      craft: spawnCraft(track, slot.sample, slot.lateral),
      lap: newLapState(slot.sample),
    };
  });
}

/**
 * Rozhodování bota: **feed-forward** na směr tratě + korekce stranové odchylky.
 * (Původní „jeď k bodu na trati“ eldoval: tětiva k bodu ~1 s dopředu nutí
 * vozidlo zatáčet víc než trať, řízení saturovalo a bot skončil ve zdi.)
 * `skill` mění ostrost sledování stopy a to, jak moc bot na rovině tlačí.
 */
export function rivalInput(rival: Rival, track: TrackPoint[]): CraftInput {
  const craft = rival.craft;
  const total = track.length;
  const mps = metresPerSample(track);
  const speed = Math.abs(craft.speed);
  const index = nearestSample(track, craft.x, craft.z, craft.sample);
  const here = track[index]!;

  const lateral = (craft.x - here.x) * here.nx + (craft.z - here.z) * here.nz;

  // směr tratě kus dopředu (feed-forward), ne tětiva k cílovému bodu
  const look = Math.max(2, Math.round((3 + speed * 0.55) / mps));
  const ahead = track[(index + look) % total]!;
  const headingError = wrapAngle(Math.atan2(ahead.tx, ahead.tz) - craft.heading);

  const skill = rival.spec.skill;
  const targetLateral = (skill - 0.5) * 2.2; // zkušenější řeže mírně vnitřek
  const kH = 1.8 + skill * 1.4;
  const kL = 0.16 + skill * 0.12;
  const steer = clamp(kH * headingError - kL * (targetLateral - lateral), -1, 1);

  // kolik z maxima tratě využije: lepší jezdec méně liftuje
  const vCap = 18.0 - (1 - skill) * 5.0;
  const throttle = clamp((vCap - speed) * 1.6, -1, 1);

  return { throttle, steer };
}

export interface RivalStep extends LapStep {
  index: number;
  lateral: number;
  offTrack: boolean;
}

export function stepRival(
  rival: Rival,
  track: TrackPoint[],
  checkpoints: number[],
  dt: number,
  now: number,
): RivalStep {
  const input = rivalInput(rival, track);
  const step = stepCraft(rival.craft, input, track, dt, now);
  const lap = advanceLap(rival.lap, step.index, checkpoints, now);
  return { ...lap, index: step.index, lateral: step.lateral, offTrack: step.offTrack };
}

/**
 * Postup v závodě = ujetá vzdálenost ve vzorcích. Monotónní, nezávislý na
 * roštu i na tom, kde je zrovna checkpoint (dřívější verze počítala zlomek
 * cesty k checkpointu → mezi branami byli všichni „na stejně“).
 */
export function raceProgress(lap: LapState): number {
  return lap.travelled;
}

export interface StandingRow {
  id: string;
  nameCs: string;
  nameEn: string;
  color: string;
  isPlayer: boolean;
  lap: number;
  /** Metry za vedoucím (0 = vedu). Zaokrouhluje se až v HUD. */
  gap: number;
  /** Celkový čas, jen když závodník dojel. */
  totalSeconds: number | null;
}

export interface RankInput {
  id: string;
  nameCs: string;
  nameEn: string;
  color: string;
  isPlayer: boolean;
  lap: LapState;
  progress: number;
  startTime: number;
}

export const PLAYER_ID = 'player';

export interface StandingsInput {
  playerLap: LapState;
  rivals: Rival[];
  startTime: number;
  metresPerProgress: number;
}

/** Aktuální pořadí hráče + botů (jeden zdroj pro HUD, výsledky i debug háček). */
export function buildStandings(input: StandingsInput): StandingRow[] {
  const playerProgress = raceProgress(input.playerLap);

  const entries: RankInput[] = [
    {
      id: PLAYER_ID,
      nameCs: 'Ty',
      nameEn: 'You',
      color: '#ffd166',
      isPlayer: true,
      lap: input.playerLap,
      progress: playerProgress,
      startTime: input.startTime,
    },
    ...input.rivals.map((rival) => ({
      id: rival.spec.id,
      nameCs: rival.spec.nameCs,
      nameEn: rival.spec.nameEn,
      color: rival.spec.color,
      isPlayer: false,
      lap: rival.lap,
      progress: raceProgress(rival.lap),
      startTime: input.startTime,
    })),
  ];

  return rankRacers(entries, input.metresPerProgress);
}

export function rankRacers(entries: RankInput[], metresPerProgress: number): StandingRow[] {
  const sorted = [...entries].sort((a, b) => {
    if (a.lap.finishedAt !== null && b.lap.finishedAt !== null) {
      return a.lap.finishedAt - b.lap.finishedAt;
    }
    if (a.lap.finishedAt !== null) return -1;
    if (b.lap.finishedAt !== null) return 1;
    return b.progress - a.progress;
  });

  const leader = sorted[0]!;
  return sorted.map((entry) => ({
    id: entry.id,
    nameCs: entry.nameCs,
    nameEn: entry.nameEn,
    color: entry.color,
    isPlayer: entry.isPlayer,
    lap: Math.min(LAPS, entry.lap.lap),
    gap:
      entry.lap.finishedAt !== null && leader.lap.finishedAt !== null
        ? 0
        : Math.max(0, (leader.progress - entry.progress) * metresPerProgress),
    totalSeconds:
      entry.lap.finishedAt === null ? null : (entry.lap.finishedAt - entry.startTime) / 1000,
  }));
}
