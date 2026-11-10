/**
 * NALU — jízda na vlně.
 *
 * Vlna se láme u útesu a jede ke břehu. Hráč na ní stojí, kormidluje po její
 * stěně a hledá **kapsu** (nejsilnější místo). Kapsa se posouvá, takže se nedá
 * jen držet směr: kdo řeže moc, ztrácí balanc, kdo stojí daleko od kapsy,
 * ztrácí rychlost a sejde z vlny.
 *
 * Proč „flow“ a triky: bez nich je optimální strategie „držet střed a nic
 * nedělat“. Flow roste jen v kapse, zvedá rychlost i násobič a **vzdušný
 * trik** (skok z vlny) dá bonus × násobič — takže odměňuje risk, ne pasivitu.
 *
 * Tři vlny za sebou; každá končí u břehu, pádem nebo uvíznutím. Skóre je
 * ujetá vzdálenost + čas v kapse + triky + čistá jízda. Všechno je čistá
 * matematika, takže to jde otestovat bez prohlížeče.
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
  /** Jak dlouho trvá vzdušný trik (s). */
  airTime: 0.85,
  /** Ztráta rychlosti ve vzduchu (m/s²). */
  airDrag: 2.2,
  /** Balanc, který vzduch bere (za s). */
  airBalanceDrain: 5,
  /** Základ bodů za čisté přistání (násobí se flow). */
  trickBonus: 120,
  /** Přírůstek/úbytek flow za sekundu (v kapse / mimo ni). */
  flowGain: 0.55,
  flowLoss: 0.9,
  /** Strop násobiče (combo = 1 + flow × 2). */
  comboMax: 3,
} as const;

export type SurfPhase = 'ready' | 'riding' | 'between' | 'done';
export type SurfEvent = 'takeoff' | 'wipeout' | 'bogged' | 'wave' | 'air' | 'landing';

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
  /** 0..1 — plynulost jízdy v kapse (násobič `combo`). */
  flow: number;
  /** 1..3 — násobič bodů (odvozený z `flow`). */
  combo: number;
  /** Zbývající čas ve vzduchu (s); 0 = na vodě. */
  air: number;
  /** Body z triků na téhle vlně. */
  bonus: number;
  /** Počet čistých přistání za celou jízdu. */
  tricks: number;
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
  /** Skok z vlny (jen když je rychlost i kapsa). */
  trick?: boolean;
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

/** Skóre jedné jízdy. `clean` = bez pádu a bez uvíznutí, `bonus` = triky. */
export function waveScore(
  distance: number,
  pocketSeconds: number,
  clean: boolean,
  bonus = 0,
): number {
  return Math.round(
    Math.max(0, distance) * 1.2 +
      Math.max(0, pocketSeconds) * 4 +
      Math.max(0, bonus) +
      (clean ? 60 : 0),
  );
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
    flow: 0,
    combo: 1,
    air: 0,
    bonus: 0,
    tricks: 0,
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
  state.flow = 0;
  state.combo = 1;
  state.air = 0;
  state.bonus = 0;
  // start kousek od kapsy — hráč má co dohánět, ale ne na druhé straně laguny
  state.x = pocketTargetFor(state) * 0.5;
}

/** Společné ukončení vlny — skóre, medaile, další vlna. */
function endWave(state: SurfState, clean: boolean, event: SurfEvent): SurfStep {
  const gained = waveScore(state.distance, state.pocketTime, clean, state.bonus);
  state.score += gained;
  state.waveScores.push(gained);
  state.clean = clean;
  if (!clean) state.wipes += 1;

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

  // ── vzduch ──────────────────────────────────────────────────────────
  if (state.air > 0) {
    state.air -= step;
    state.speed = clamp(state.speed - SURF.airDrag * step, 0, SURF.maxSpeed);
    state.x = clamp(state.x + steer * SURF.turnRate * 0.55 * step, LAGOON.minX, LAGOON.maxX);
    state.distance += state.speed * step;
    state.totalDistance += state.speed * step;
    state.balance = clamp(state.balance - SURF.airBalanceDrain * step, 0, 100);

    if (state.air <= 0) {
      state.air = 0;
      if (state.balance <= 0) {
        return endWave(state, false, 'wipeout');
      }
      state.bonus += Math.round(SURF.trickBonus * state.combo);
      state.tricks += 1;
      return { event: 'landing', waveDone: false, finished: false };
    }

    return { event: null, waveDone: false, finished: false };
  }

  // ── jízda po vodě ───────────────────────────────────────────────────
  const target = pocketTargetFor(state);
  const offset = state.x - target;
  state.pocket = clamp(1 - Math.abs(offset) / SURF.pocketTolerance, 0, 1);

  // flow roste jen v kapse; mimo ni padá a násobič se vrací k jedné
  const inPocket = state.pocket > 0.6;
  state.flow = clamp(
    state.flow + (inPocket ? SURF.flowGain : -SURF.flowLoss) * step,
    0,
    1,
  );
  state.combo = 1 + state.flow * (SURF.comboMax - 1);

  // rychlost: kapsa a flow tlačí, okraj a řezání brzdí, pumpování hýbe
  const speedTarget =
    6.2 +
    state.pocket * 4.6 +
    state.flow * 1.2 -
    Math.abs(steer) * 1.4 -
    (1 - state.pocket) * 3.0 +
    (pump ? 3.2 : 0);
  state.speed += (speedTarget - state.speed) * Math.min(1, step * 1.1);
  state.speed = clamp(state.speed, 0, SURF.maxSpeed);

  state.x = clamp(state.x + steer * SURF.turnRate * step, LAGOON.minX, LAGOON.maxX);

  state.distance += state.speed * step;
  state.totalDistance += state.speed * step;

  if (inPocket) state.pocketTime += step;

  // balanc: tvrdé řezání a okraj vlny berou, klid v kapse vrací
  let delta = state.pocket > 0.68 && Math.abs(steer) < 0.3 ? 14 : 0;
  delta -= Math.abs(steer) * 12;
  delta -= (1 - state.pocket) * 9;
  if (pump) delta -= 3;
  state.balance = clamp(state.balance + delta * step, 0, 100);

  // trik: jen s rychlostí, v kapse a s trochou balance
  if (input.trick && state.balance > 20 && state.speed > 9 && state.pocket > 0.5) {
    state.air = SURF.airTime;
    return { event: 'air', waveDone: false, finished: false };
  }

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
  const event: SurfEvent = wipeout ? 'wipeout' : bogged ? 'bogged' : 'wave';
  return endWave(state, clean, event);
}
