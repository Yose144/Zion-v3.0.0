/**
 * VA'A — plachtění na polynéské kánoi s balancírkou.
 *
 * Arkádová fyzika, ne simulace: záběr vesla dá impuls, trup klouže a voda ho
 * brzdí. Držené tlačítko neznamená „plyn naplno", ale **rytmus záběrů** —
 * proto má každý záběr svůj cooldown. Tím je z kánoe hra o tempu, ne o držení
 * klávesy (a na dotyku se nemusí mačkat dvakrát za vteřinu).
 *
 * Jeden model pro hráče i pro testy: `test/piko-sim.mjs` pouští tuhle
 * matematiku v Node bez prohlížeče.
 */

import { GATE_RADIUS, LAGOON, PIKO_GATES, START } from './world';

export const CANOE = {
  /** Jak dlouho po záběru trvá, než jde zabrat znovu (s). */
  strokePeriod: 0.62,
  /** Impuls jednoho záběru (m/s). */
  strokeImpulse: 2.5,
  /** Odpor trupu (1/s) — při vyšší rychlosti brzdí víc. */
  drag: 0.52,
  /** Přibrzdění pádlem (násobí odpor). */
  braceDrag: 1.7,
  /** Strop rychlosti (m/s) — ~23 km/h. */
  maxSpeed: 6.4,
  /** Rychlost otáčení (rad/s) při plné rychlosti. */
  turnRate: 1.05,
  /** Pobřežní proud táhne ke břehu (m/s). */
  current: 0.12,
} as const;

export const GATE_POINTS = 120;
/** Čas, do kterého se počítá plný bonus — kdo jede pomalu, dostane jen bóje. */
export const TARGET_SECONDS = 100;
export const TIME_BONUS_MAX = 480;
export const CANOE_TIME_LIMIT = 180;

export interface CanoeState {
  x: number;
  z: number;
  /** 0 = sever (+z), postupuje po směru hodinových ručiček. */
  heading: number;
  /** m/s, kladné = vpřed. */
  speed: number;
  gates: number;
  nextGate: number;
  /** 0..1 — animace záběru pro pádlo. */
  strokePhase: number;
  strokeCooldown: number;
  elapsed: number;
  started: boolean;
  finished: boolean;
  score: number;
  /** Čas posledního nárazu do útesu (s) — brání trvalému brzdění. */
  hitAt: number;
}

export interface CanoeInput {
  /** Držené pádlo — záběry jdou v rytmu `strokePeriod`. */
  paddle: boolean;
  /** −1..1 (＋ = vlevo). */
  steer: number;
  /** Přibrzdit pádlem. */
  brace: boolean;
}

export interface CanoeStep {
  /** Právě proběhl záběr (pro zvuk a animaci). */
  stroke: boolean;
  /** Index právě projeté bóje, nebo `null`. */
  gate: number | null;
  /** Náraz do okraje laguny. */
  hitReef: boolean;
  finished: boolean;
}

/** Skóre: bóje + časový bonus, ale jen úměrně k projetým bójím. */
export function canoeScore(gates: number, seconds: number): number {
  const safeGates = Math.min(PIKO_GATES.length, Math.max(0, gates));
  const gatePoints = safeGates * GATE_POINTS;
  const raw = Math.max(0, (TARGET_SECONDS - Math.max(0, seconds)) * 6);
  const timeBonus = Math.round(Math.min(TIME_BONUS_MAX, raw) * (safeGates / PIKO_GATES.length));
  return gatePoints + timeBonus;
}

export function createCanoe(): CanoeState {
  return {
    x: START.x,
    z: START.z,
    heading: Math.PI, // čelem k útesu
    speed: 0,
    gates: 0,
    nextGate: 0,
    strokePhase: 0,
    strokeCooldown: 0,
    elapsed: 0,
    started: false,
    finished: false,
    score: 0,
    hitAt: -10,
  };
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/**
 * Jeden krok kánoe. Mutuje `state` (stejně jako `stepCraft` u Venuše) a vrací
 * události, které hra potřebuje pro zvuk a HUD.
 */
export function stepCanoe(state: CanoeState, input: CanoeInput, dt: number): CanoeStep {
  const step = Math.min(0.05, Math.max(0, dt));
  if (state.finished || step <= 0) {
    return { stroke: false, gate: null, hitReef: false, finished: state.finished };
  }

  const paddle = Boolean(input.paddle);
  const brace = Boolean(input.brace);
  const steer = clamp(input.steer, -1, 1);

  if (!state.started && (paddle || Math.abs(steer) > 0.2)) {
    state.started = true;
  }

  // záběr v rytmu — držené pádlo není plyn, ale tempo
  state.strokeCooldown = Math.max(0, state.strokeCooldown - step);
  let stroke = false;
  if (paddle && state.strokeCooldown <= 0) {
    state.speed += CANOE.strokeImpulse;
    state.strokeCooldown = CANOE.strokePeriod;
    state.strokePhase = 0;
    stroke = true;
  }
  state.strokePhase = paddle
    ? (state.strokePhase + step / CANOE.strokePeriod) % 1
    : 0;

  // odpor trupu (+ přibrzdění)
  state.speed -= state.speed * CANOE.drag * step;
  if (brace) state.speed -= state.speed * CANOE.braceDrag * step;
  state.speed = clamp(state.speed, 0, CANOE.maxSpeed);

  // zatáčení: v klidu jde kánoe otočit jen málo, ve svižné jízdě ostře
  const authority = 0.4 + 0.6 * Math.min(1, state.speed / 3.5);
  state.heading += steer * CANOE.turnRate * authority * step;

  // proud táhne ke břehu — bez záběrů se loď pomalu vrací
  state.x += Math.sin(state.heading) * state.speed * step;
  state.z += Math.cos(state.heading) * state.speed * step + CANOE.current * step;

  // hranice laguny: útes i břeh jsou zeď, ne pružina
  let hitReef = false;
  const clampedX = clamp(state.x, LAGOON.minX, LAGOON.maxX);
  const clampedZ = clamp(state.z, LAGOON.reefZ + 1, LAGOON.beachZ - 1);
  if (clampedX !== state.x || clampedZ !== state.z) {
    state.x = clampedX;
    state.z = clampedZ;
    if (state.elapsed - state.hitAt > 0.45) {
      state.hitAt = state.elapsed;
      state.speed *= 0.55;
      hitReef = true;
    }
  }

  if (state.started) state.elapsed += step;

  // bóje — jen v pořadí, jinak by šlo kurz přeskočit
  let gate: number | null = null;
  const next = PIKO_GATES[state.nextGate];
  if (next) {
    const dx = state.x - next.x;
    const dz = state.z - next.z;
    if (Math.hypot(dx, dz) <= GATE_RADIUS) {
      gate = state.nextGate;
      state.gates += 1;
      state.nextGate += 1;
    }
  }

  state.score = canoeScore(state.gates, state.elapsed);

  if (state.gates >= PIKO_GATES.length || state.elapsed >= CANOE_TIME_LIMIT) {
    state.finished = true;
    state.score = canoeScore(state.gates, state.elapsed);
  }

  return { stroke, gate, hitReef, finished: state.finished };
}
