/**
 * NEPTUN — HLUBINA. Simulace sestupu.
 *
 * Čistý modul bez three.js a bez Reactu, aby se dal pustit v Node
 * (`test/neptun-dive.mjs`). Scéna z něj jen čte stav — nikdy nepočítá
 * vlastní fyziku, jinak by hráč viděl jinou hru, než jaká se měří.
 *
 * Pravidla:
 *  - klesáš vždy (i bez vstupu), `W` zrychlí, `S` přibrzdí;
 *  - vítr tě odnáší do stran, `A`/`D` kormidluješ proti němu;
 *  - **lucerna** je čas (temnější vrstvy žerou víc), **světla** ji dobíjí;
 *  - **plášť** je chyba (náraz do stěny proudu, okraj víru);
 *  - doletět na dno = bonus, ne podmínka — hra končí i bez toho.
 */

import {
  BOTTOM_BONUS,
  DEPTH_BOTTOM,
  LANE,
  MAX_ENERGY,
  MOTES,
  MOTE_ENERGY,
  MOTE_RADIUS,
  MOTE_SCORE,
  SINK_BASE,
  SINK_BRAKE,
  SINK_DIVE,
  SINK_MIN,
  SINK_RESPONSE,
  START_ENERGY,
  START_HULL,
  STEER_MAX,
  STEER_RESPONSE,
  VORTEX_ENERGY,
  VORTEX_HULL,
  VORTICES,
  VX_MAX,
  WALL_HULL,
  deckIndexAt,
  drainAt,
  windAt,
} from './world';

/** Čím sestup skončil. `null` = ještě letíš. */
export type DiveEnd = 'bottom' | 'lantern' | 'hull' | null;

export type DiveEventKind = 'light' | 'vortex' | 'wall' | 'deck' | 'bottom' | 'lantern' | 'hull';

export interface DiveEvent {
  kind: DiveEventKind;
  /** Id světla/víru, pokud se týká. */
  id?: number;
  depth: number;
}

export interface DiveInput {
  /** −1 vlevo, +1 vpravo. */
  steer: number;
  /** Zrychlit sestup (`W`). */
  dive: boolean;
  /** Přibrzdit (`S`). */
  brake: boolean;
}

export interface DiveState {
  depth: number;
  x: number;
  vx: number;
  sink: number;
  energy: number;
  hull: number;
  wind: number;
  /** Simulované hodiny v sekundách (ne skutečné — testy i pauza). */
  time: number;
  deck: number;
  collected: boolean[];
  lightCount: number;
  end: DiveEnd;
  /** Události **posledního kroku** (telemetrie je čte, ne hromadí). */
  events: DiveEvent[];
  /** Poslední událost + razítko pro hlášky v HUD (`null` = nic). */
  lastEvent: DiveEvent | null;
  eventId: number;
}

export interface DiveResult {
  score: number;
  depth: number;
  lights: number;
  totalLights: number;
  elapsed: number;
  end: DiveEnd;
  deck: number;
}

export const IDLE_INPUT: DiveInput = { steer: 0, dive: false, brake: false };

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function createDive(): DiveState {
  return {
    depth: 0,
    x: 0,
    vx: 0,
    sink: SINK_BASE,
    energy: START_ENERGY,
    hull: START_HULL,
    wind: windAt(0),
    time: 0,
    deck: deckIndexAt(0),
    collected: MOTES.map(() => false),
    lightCount: 0,
    end: null,
    events: [],
    lastEvent: null,
    eventId: 0,
  };
}

function push(state: DiveState, event: DiveEvent): void {
  state.events.push(event);
  state.lastEvent = event;
  state.eventId += 1;
}

/**
 * Posunout sestup o `dt` sekund (zastropované na 50 ms, stejně jako ostatní
 * hry — na 15 fps by jinak jeden krok přeskočil celý vír).
 *
 * Vrací tentýž objekt, takže scéna může držet `useRef` a nic nealokovat.
 */
export function stepDive(state: DiveState, input: DiveInput, dt: number): DiveState {
  state.events = [];
  if (state.end) return state;

  const step = Math.min(0.05, Math.max(0, dt));
  if (step <= 0) return state;

  state.time += step;

  const deckBefore = state.deck;

  // ── vítr a kormidlo ────────────────────────────────────────────────
  const wind = windAt(state.depth);
  state.wind = wind;
  const steer = clamp(input.steer, -1, 1);
  const targetVx = steer * STEER_MAX + wind;
  state.vx += (clamp(targetVx, -VX_MAX, VX_MAX) - state.vx) * Math.min(1, STEER_RESPONSE * step);
  state.vx = clamp(state.vx, -VX_MAX, VX_MAX);
  state.x += state.vx * step;

  // stěna proudu: mimo uličku tlak ohne plášť
  if (state.x > LANE || state.x < -LANE) {
    state.x = clamp(state.x, -LANE, LANE);
    state.vx *= -0.25;
    state.hull -= WALL_HULL * step;
    push(state, { kind: 'wall', depth: state.depth });
  }

  // ── klesání ────────────────────────────────────────────────────────
  const targetSink = Math.max(
    SINK_MIN,
    SINK_BASE + (input.dive ? SINK_DIVE : 0) - (input.brake ? SINK_BRAKE : 0),
  );
  state.sink += (targetSink - state.sink) * Math.min(1, SINK_RESPONSE * step);
  state.depth += state.sink * step;

  const deckAfter = deckIndexAt(state.depth);
  if (deckAfter !== deckBefore) {
    state.deck = deckAfter;
    push(state, { kind: 'deck', depth: state.depth });
  }

  // ── lucerna ────────────────────────────────────────────────────────
  // Spotřeba je za **metr**, ne za sekundu: jinak je `W` vždy nejlepší
  // volba (rychlý sestup = kratší čas = méně energie) a brzda nemá smysl.
  state.energy -= drainAt(state.depth) * Math.max(0, state.sink) * step;

  // ── víry ───────────────────────────────────────────────────────────
  for (const vortex of VORTICES) {
    const dy = Math.abs(state.depth - vortex.depth);
    if (dy > vortex.radius) continue;
    const dx = state.x - vortex.x;
    const near = Math.hypot(dx, dy);
    if (near > vortex.radius) continue;
    // tah ke středu — čím blíž, tím silnější
    const pull = (1 - near / vortex.radius) * 26;
    state.vx -= Math.sign(dx) * pull * step;
    state.energy -= VORTEX_ENERGY * step;
    state.hull -= VORTEX_HULL * step;
    push(state, { kind: 'vortex', id: vortex.id, depth: state.depth });
  }

  // ── světla ─────────────────────────────────────────────────────────
  for (let i = 0; i < MOTES.length; i += 1) {
    if (state.collected[i]) continue;
    const mote = MOTES[i];
    if (Math.abs(state.depth - mote.depth) > MOTE_RADIUS) continue;
    if (Math.abs(state.x - mote.x) > MOTE_RADIUS) continue;
    state.collected[i] = true;
    state.lightCount += 1;
    state.energy = Math.min(MAX_ENERGY, state.energy + MOTE_ENERGY);
    push(state, { kind: 'light', id: mote.id, depth: state.depth });
  }

  // ── konec ──────────────────────────────────────────────────────────
  if (state.depth >= DEPTH_BOTTOM) {
    state.depth = DEPTH_BOTTOM;
    state.end = 'bottom';
    push(state, { kind: 'bottom', depth: DEPTH_BOTTOM });
    return state;
  }
  if (state.hull <= 0) {
    state.hull = 0;
    state.end = 'hull';
    push(state, { kind: 'hull', depth: state.depth });
    return state;
  }
  if (state.energy <= 0) {
    state.energy = 0;
    state.end = 'lantern';
    push(state, { kind: 'lantern', depth: state.depth });
  }
  return state;
}

/** Skóre: metry hloubky + světla + bonus za dno (dno je vstupenka, ne trest). */
export function scoreOf(state: DiveState): number {
  return Math.floor(state.depth) + state.lightCount * MOTE_SCORE + (state.end === 'bottom' ? BOTTOM_BONUS : 0);
}

export function resultOf(state: DiveState): DiveResult {
  return {
    score: scoreOf(state),
    depth: Math.floor(state.depth),
    lights: state.lightCount,
    totalLights: MOTES.length,
    elapsed: Math.round(state.time * 10) / 10,
    end: state.end,
    deck: state.deck,
  };
}

/**
 * Nejbližší nesebrané světlo (pro kompas v HUD). `null` = všechna sebraná;
 * HUD pak ukazuje na dno. Počítá se z pozice, ne z pořadí v poli — kdo mine
 * světlo, nemá koukat na to první.
 */
export function nextMote(state: DiveState): { id: number; dx: number; dy: number } | null {
  let best: { id: number; dx: number; dy: number } | null = null;
  let bestDistance = Infinity;
  for (let i = 0; i < MOTES.length; i += 1) {
    if (state.collected[i]) continue;
    const mote = MOTES[i];
    const dx = mote.x - state.x;
    const dy = mote.depth - state.depth;
    const distance = Math.hypot(dx, dy);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = { id: mote.id, dx, dy };
    }
  }
  return best;
}

/** Podíl cesty ke dnu 0..1 (HUD, testy). */
export function depthRatio(state: DiveState): number {
  return clamp(state.depth / DEPTH_BOTTOM, 0, 1);
}
