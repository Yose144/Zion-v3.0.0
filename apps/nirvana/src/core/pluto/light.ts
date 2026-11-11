/**
 * PLUTO — SRDCE NA OKRAJI. Simulace pochůzky.
 *
 * Čistý modul bez three.js a bez Reactu (`test/pluto-light.mjs` ho pouští
 * v Node). Scéna z něj jen čte — nikdy nepočítá vlastní teplo ani zapálení,
 * jinak by hráč viděl jinou hru, než jaká se měří.
 *
 * Jedna mechanika: **teplo**. Ubývá podle toho, jak daleko jsi od
 * nejbližšího světla (modul nebo zapálená lampa), a u světla se dobíjí.
 * Zapálená lampa je proto nový zdroj tepla — hra je o posouvání hranice,
 * ne o běhu na konec mapy.
 */

import {
  COMPLETE_BONUS,
  DRAIN_BASE,
  DUSK_BASE,
  DUSK_PER_S,
  DRAIN_MAX,
  DRAIN_PER_M,
  ICE_RESPONSE,
  LAMP_COUNT,
  LAMP_RADIUS,
  LAMP_SCORE,
  LAMP_WARMTH,
  LAMPS,
  LIGHT_TIME,
  MOVE_RESPONSE,
  REGEN,
  SHUTTLE,
  SPEED,
  WARM_RADIUS,
  WARMTH_MAX,
  WARMTH_SCORE,
  WARMTH_START,
  WORLD,
} from './world';

export type LightEnd = 'complete' | 'frozen' | null;
export type LightEventKind = 'lit' | 'channel' | 'warm' | 'cold' | 'complete' | 'frozen';

export interface LightEvent {
  kind: LightEventKind;
  /** Id lampy, pokud se týká. */
  id?: number;
  warmth: number;
}

export interface LightInput {
  /** Směr chůze −1..1 (šikmo jde i diagonála, normalizuje se). */
  mx: number;
  mz: number;
}

export interface LightState {
  x: number;
  z: number;
  vx: number;
  vz: number;
  warmth: number;
  /** Rozpracované zapalování (0..LIGHT_TIME). */
  channel: number;
  /** Lampy, u kterých se právě stojí (pro HUD a scénu). */
  channelId: number | null;
  lit: boolean[];
  litCount: number;
  /** Vzdálenost k nejbližšímu teplu (HUD, testy). */
  warmDistance: number;
  /** Aktuální síla soumraku (roste s časem). */
  dusk: number;
  time: number;
  end: LightEnd;
  events: LightEvent[];
  lastEvent: LightEvent | null;
  eventId: number;
}

export interface LightResult {
  score: number;
  lamps: number;
  totalLamps: number;
  warmth: number;
  elapsed: number;
  end: LightEnd;
}

export const IDLE_INPUT: LightInput = { mx: 0, mz: 0 };

export function createLight(): LightState {
  return {
    x: 0,
    z: SHUTTLE.z,
    vx: 0,
    vz: 0,
    warmth: WARMTH_START,
    channel: 0,
    channelId: null,
    lit: LAMPS.map(() => false),
    litCount: 0,
    warmDistance: 0,
    dusk: duskAt(0),
    time: 0,
    end: null,
    events: [],
    lastEvent: null,
    eventId: 0,
  };
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

function push(state: LightState, event: LightEvent): void {
  state.events.push(event);
  state.lastEvent = event;
  state.eventId += 1;
}

/** Nejbližší zdroj tepla — modul nebo zapálená lampa. */
export function nearestWarm(state: LightState): { distance: number; kind: 'shuttle' | 'lamp'; id: number } {
  let best: { distance: number; kind: 'shuttle' | 'lamp'; id: number } = {
    distance: Math.hypot(state.x - SHUTTLE.x, state.z - SHUTTLE.z) - SHUTTLE.radius,
    kind: 'shuttle',
    id: 0,
  };
  for (let i = 0; i < LAMPS.length; i += 1) {
    if (!state.lit[i]) continue;
    const lamp = LAMPS[i];
    const distance = Math.hypot(state.x - lamp.x, state.z - lamp.z) - WARM_RADIUS;
    if (distance < best.distance) best = { distance, kind: 'lamp', id: lamp.id };
  }
  return best;
}

/** Soumrak: čím déle jsi venku, tím větší zima (i u modulu). */
export function duskAt(time: number): number {
  return DUSK_BASE + Math.max(0, time) * DUSK_PER_S;
}

/** Ztráta tepla za sekundu v dané vzdálenosti a čase (0 = jsi u světla). */
export function drainFor(distance: number, time = 0): number {
  if (distance <= 0) return duskAt(time);
  return Math.min(DRAIN_MAX, DRAIN_BASE + distance * DRAIN_PER_M + duskAt(time));
}

/**
 * Posunout pochůzku o `dt` (zastropované na 50 ms).
 *
 * Vrací tentýž objekt — scéna drží `useRef` a nic nealokuje.
 */
export function stepLight(state: LightState, input: LightInput, dt: number): LightState {
  state.events = [];
  if (state.end) return state;

  const step = Math.min(0.05, Math.max(0, dt));
  if (step <= 0) return state;

  state.time += step;

  // ── pohyb (na ledě klouže) ─────────────────────────────────────────
  let mx = clamp(input.mx, -1, 1);
  let mz = clamp(input.mz, -1, 1);
  const length = Math.hypot(mx, mz);
  if (length > 1) {
    mx /= length;
    mz /= length;
  }
  const moving = length > 0.01;
  const response = moving ? MOVE_RESPONSE : ICE_RESPONSE;
  const k = Math.min(1, response * step);
  state.vx += (mx * SPEED - state.vx) * k;
  state.vz += (mz * SPEED - state.vz) * k;
  state.x = clamp(state.x + state.vx * step, -WORLD, WORLD);
  state.z = clamp(state.z + state.vz * step, -WORLD, WORLD);

  // ── teplo ──────────────────────────────────────────────────────────
  const warm = nearestWarm(state);
  state.warmDistance = Math.max(0, warm.distance);
  const before = state.warmth;
  const lowBefore = before < WARMTH_MAX * 0.25;
  const dusk = duskAt(state.time);
  state.dusk = dusk;
  if (warm.distance <= 0) {
    // i u světla platí soumrak — pozdě ve hře už modul jen zpomaluje chladnutí
    state.warmth = Math.min(WARMTH_MAX, state.warmth + (REGEN - dusk) * step);
    if (before < WARMTH_MAX && state.warmth >= WARMTH_MAX) push(state, { kind: 'warm', warmth: state.warmth });
  } else {
    state.warmth -= drainFor(warm.distance, state.time) * step;
    if (!lowBefore && state.warmth < WARMTH_MAX * 0.25) push(state, { kind: 'cold', warmth: state.warmth });
  }

  // ── zapalování ─────────────────────────────────────────────────────
  let channelLamp: number | null = null;
  for (let i = 0; i < LAMPS.length; i += 1) {
    if (state.lit[i]) continue;
    const lamp = LAMPS[i];
    if (Math.hypot(state.x - lamp.x, state.z - lamp.z) > LAMP_RADIUS) continue;
    channelLamp = i;
    break;
  }

  if (channelLamp === null) {
    state.channel = 0;
    state.channelId = null;
  } else {
    const lamp = LAMPS[channelLamp];
    if (state.channelId !== lamp.id) {
      state.channel = 0;
      state.channelId = lamp.id;
    }
    state.channel += step;
    if (state.channel < LIGHT_TIME) {
      // průběh zapalování jde do stavu (HUD kreslí kruh), ne do událostí —
      // jinak by hlášky blikaly 60× za sekundu
    } else {
      state.lit[channelLamp] = true;
      state.litCount += 1;
      state.channel = 0;
      state.channelId = null;
      state.warmth = Math.min(WARMTH_MAX, state.warmth + LAMP_WARMTH);
      push(state, { kind: 'lit', id: lamp.id, warmth: state.warmth });
      if (state.litCount >= LAMP_COUNT) {
        state.end = 'complete';
        push(state, { kind: 'complete', warmth: state.warmth });
        return state;
      }
    }
  }

  // ── konec ──────────────────────────────────────────────────────────
  if (state.warmth <= 0) {
    state.warmth = 0;
    state.end = 'frozen';
    push(state, { kind: 'frozen', warmth: 0 });
  }
  return state;
}

/** Skóre: lampy, zbytek tepla, bonus za celé srdce. */
export function scoreOf(state: LightState): number {
  return (
    state.litCount * LAMP_SCORE +
    Math.round(state.warmth) * WARMTH_SCORE +
    (state.end === 'complete' ? COMPLETE_BONUS : 0)
  );
}

export function resultOf(state: LightState): LightResult {
  return {
    score: scoreOf(state),
    lamps: state.litCount,
    totalLamps: LAMP_COUNT,
    warmth: Math.round(state.warmth),
    elapsed: Math.round(state.time * 10) / 10,
    end: state.end,
  };
}

/** Nejbližší nezapálená lampa (kompas v HUD). `null` = všechny svítí. */
export function nextLamp(state: LightState): { id: number; dx: number; dz: number; distance: number } | null {
  let best: { id: number; dx: number; dz: number; distance: number } | null = null;
  let bestDistance = Infinity;
  for (let i = 0; i < LAMPS.length; i += 1) {
    if (state.lit[i]) continue;
    const lamp = LAMPS[i];
    const dx = lamp.x - state.x;
    const dz = lamp.z - state.z;
    const distance = Math.hypot(dx, dz);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = { id: lamp.id, dx, dz, distance };
    }
  }
  return best;
}

/** Kolik metrů odsud dojdeš, než zamrzneš (HUD: „dosah"). */
export function reachOf(state: LightState): number {
  const distance = Math.max(0, state.warmDistance);
  const drain = drainFor(distance, state.time) || DRAIN_BASE;
  return Math.round((state.warmth / Math.max(0.1, drain)) * SPEED);
}
