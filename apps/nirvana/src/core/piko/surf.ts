/**
 * NALU — jízda na vlně.
 *
 * Vlna se láme u útesu a jede ke břehu. Hráč na ní stojí, kormidluje po její
 * stěně a hledá **kapsu** (nejsilnější místo). Kapsa se posouvá, takže se nedá
 * jen držet směr: kdo řeže moc, ztrácí balanc, kdo stojí daleko od kapsy,
 * ztrácí rychlost a sejde z vlny.
 *
 * Tři vlny za sebou; každá končí u břehu, pádem nebo uvíznutím. Skóre je
 * ujetá vzdálenost + čas v kapse + čistá jízda. Všechno je čistá matematika,
 * takže to jde otestovat bez prohlížeče.
 */

import { LAGOON } from './world';

export const SURF = {
  waves: 3,
  /** Délka jedné jízdy, než vlna dorazí ke břehu (m). */
  length: 200,
  /** Strop rychlosti (m/s). */
  maxSpeed: 13,
  /** Jak rychle se dá posunout po stěně vlny (m/s). */
  turnRate: 12,
  /** Pauza mezi vlnami (s). */
  waveWait: 2.6,
  /** Rozkmit kapsy na obě strany (m). */
  pocketRange: 20,
  /** Odchylka, při které je kapsa ještě „plná" (m). */
  pocketTolerance: 22,
} as const;

export type SurfPhase = 'ready' | 'riding' | 'between' | 'done';
export type SurfEvent = 'takeoff' | 'wipeout' | 'bogged' | 'wave';

export interface SurfState {
  /** 1..3 — kolikátá vlna se jede. */
  wave: number;
  phase: SurfPhase;
  /** Odpočet do startu / do další vlny (s). */
  waveTimer: number;
  /** Poloha po stěně vlny, −68..68. */
  x: number;
  speed: number;
  /** 0..100; nula = pád. */
  balance: number;
  /** Ujeté metry na téhle vlně. */
  distance: number;
  totalDistance: number;
  /** Sekundy strávené v kapse na téhle vlně. */
  pocketTime: number;
  /** 0..1 — jak blízko je hráč kapse (pro HUD a scénu). */
  pocket: number;
  /** Jak dlouho je hráč pomalý (uvíznutí). */
  slowFor: number;
  /** Byla poslední vlna čistá? */
  clean: boolean;
  wipes: number;
  score: number;
  waveScores: number[];
  /** Simulovaný čas (s) — kapsa i animace z něj počítají. */
  time: number;
  /** Odehraný čas od startu (s). */
  elapsed: number;
  finished: boolean;
}

export interface SurfInput {
  /** −1..1 (＋ = vlevo po stěně). */
  steer: number;
  /** Dopumpování — zrychlí, ale stojí balanc. */
  pump: boolean;
}

export interface SurfStep {
  event: SurfEvent | null;
  /** Vlna právě skončila (ať už jakkoli). */
  waveDone: boolean;
  finished: boolean;
}

/** Kde je právě kapsa vlny. Stejnou funkci čte simulace i scéna. */
export function pocketTargetFor(state: Pick<SurfState, 'time' | 'wave'>): number {
  return Math.sin(state.time * 0.55 + state.wave * 1.4) * SURF.pocketRange;
}

/** Skóre jedné jízdy. `clean` = bez pádu a bez uvíznutí. */
export function waveScore(distance: number, pocketSeconds: number, clean: boolean): number {
  return Math.round(Math.max(0, distance) * 1.2 + Math.max(0, pocketSeconds) * 4 + (clean ? 60 : 0));
}

export function createSurf(): SurfState {
  return {
    wave: 1,
    phase: 'ready',
    waveTimer: SURF.waveWait,
    x: 0,
    speed: 0,
    balance: 100,
    distance: 0,
    totalDistance: 0,
    pocketTime: 0,
    pocket: 0,
    slowFor: 0,
    clean: true,
    wipes: 0,
    score: 0,
    waveScores: [],
    time: 0,
    elapsed: 0,
    finished: false,
  };
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

function beginWave(state: SurfState): void {
  state.phase = 'riding';
  state.waveTimer = 0;
  state.speed = 8;
  state.balance = 100;
  state.distance = 0;
  state.pocketTime = 0;
  state.slowFor = 0;
  state.clean = true;
  state.pocket = 0;
  // start kousek od kapsy — hráč má co dohánět, ale ne na druhé straně laguny
  state.x = pocketTargetFor(state) * 0.5;
}

export function stepSurf(state: SurfState, input: SurfInput, dt: number): SurfStep {
  const step = Math.min(0.05, Math.max(0, dt));
  if (state.finished || step <= 0) {
    return { event: null, waveDone: false, finished: state.finished };
  }

  state.time += step;

  // čekání na vlnu
  if (state.phase === 'ready' || state.phase === 'between') {
    state.waveTimer -= step;
    if (state.waveTimer <= 0) {
      beginWave(state);
      return { event: 'takeoff', waveDone: false, finished: false };
    }
    return { event: null, waveDone: false, finished: false };
  }

  if (state.phase !== 'riding') {
    return { event: null, waveDone: false, finished: state.finished };
  }

  state.elapsed += step;

  const steer = clamp(input.steer, -1, 1);
  const pump = Boolean(input.pump);

  // kapsa — nejsilnější místo vlny, posouvá se v čase
  const target = pocketTargetFor(state);
  const offset = state.x - target;
  state.pocket = clamp(1 - Math.abs(offset) / SURF.pocketTolerance, 0, 1);

  // rychlost: kapsa tlačí, okraj a řezání brzdí, pumpování hýbe
  const speedTarget =
    6.2 +
    state.pocket * 4.6 -
    Math.abs(steer) * 1.4 -
    (1 - state.pocket) * 3.0 +
    (pump ? 3.2 : 0);
  state.speed += (speedTarget - state.speed) * Math.min(1, step * 1.1);
  state.speed = clamp(state.speed, 0, SURF.maxSpeed);

  state.x = clamp(state.x + steer * SURF.turnRate * step, LAGOON.minX, LAGOON.maxX);

  state.distance += state.speed * step;
  state.totalDistance += state.speed * step;

  if (state.pocket > 0.6) state.pocketTime += step;

  // balanc: tvrdé řezání a okraj vlny berou, klid v kapse vrací
  let delta = state.pocket > 0.68 && Math.abs(steer) < 0.3 ? 14 : 0;
  delta -= Math.abs(steer) * 12;
  delta -= (1 - state.pocket) * 9;
  if (pump) delta -= 3;
  state.balance = clamp(state.balance + delta * step, 0, 100);

  if (state.speed < 2.2) state.slowFor += step;
  else state.slowFor = 0;

  // konec jízdy: pád, uvíznutí nebo doraz ke břehu
  const wipeout = state.balance <= 0;
  const bogged = state.slowFor > 1.6;
  const shore = state.distance >= SURF.length;

  if (!wipeout && !bogged && !shore) {
    return { event: null, waveDone: false, finished: false };
  }

  const clean = !wipeout && !bogged;
  state.score += waveScore(state.distance, state.pocketTime, clean);
  state.waveScores.push(waveScore(state.distance, state.pocketTime, clean));
  state.clean = clean;
  if (!clean) state.wipes += 1;

  const event: SurfEvent = wipeout ? 'wipeout' : bogged ? 'bogged' : 'wave';

  if (state.wave >= SURF.waves) {
    state.phase = 'done';
    state.finished = true;
  } else {
    state.wave += 1;
    state.phase = 'between';
    state.waveTimer = SURF.waveWait;
  }

  return { event, waveDone: true, finished: state.finished };
}
