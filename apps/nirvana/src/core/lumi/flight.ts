/**
 * KŘÍDLA — fyzika letu.
 *
 * Záměrně **jednoduchá a čitelná**: pláštěnka tě zvedá, dokud má sílu,
 * proudy vzduchu ji dobíjejí a světla ti dají kousek dechu. Žádné
 * nepřátelé, žádné poškození, žádný časový limit — hra je o cestě.
 *
 * Drží se to mimo React i mimo three.js, protože takhle se dá simulace
 * otestovat v Node (`test/lumi-flight.mjs`) a nemůže se rozejít s tím, co
 * hráč vidí.
 */

import { LUMI_HEIGHT, LUMI_WIDTH, pathData, type LumiPathId } from './world';

export interface FlightInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  /**
   * Směr pohledu pro **let pohledem ve VR** (jednotkový 2D vektor).
   *
   * Klávesnice i dotyk posílají čtyři booleany — to je pro obrazovku správně,
   * protože hráč vidí kurzor. V headsetu ale není „nahoru", je tam „tam, kam
   * se dívám": stejná simulace proto bere i vektor. Když je `aim` zadaný,
   * čtyři booleany se ignorují (jinak by se sčítaly dva názory na směr).
   */
  aim?: { x: number; y: number };
  /** Jak silně táhne pohled (0–1). 0 = jen kloužeš. */
  gaze?: number;
}

export const NO_FLIGHT: FlightInput = { up: false, down: false, left: false, right: false };

/**
 * Je tenhle vstup „pohledový"? (VR)
 *
 * Drží se na jednom místě, aby simulace i scéna neměly jiný názor na to,
 * co je ještě klávesnice a co už hlava.
 */
export function isGaze(input: FlightInput): boolean {
  if (!input.aim) return false;
  if (!Number.isFinite(input.aim.x) || !Number.isFinite(input.aim.y)) return false;
  return (input.gaze ?? 0) > 0.001;
}

export interface FlightState {
  /** Kterou cestou letíš — světla, proudy i svatyně se berou odsud. */
  path: LumiPathId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Síla pláštěnky 0..100. */
  energy: number;
  /** Sebraná světla (id). */
  lights: number[];
  /** Kolik jich je celkem — pro HUD i pro svatyni. */
  total: number;
  /** Simulovaný čas v sekundách. */
  time: number;
  /** Hra skončila (doneseš světla do svatyně). */
  finished: boolean;
  /**
   * Naposledy sebrané světlo, které ještě nikdo nevyzvedl (pro text
   * příběhu). **Nuluje ho až ten, kdo ho zobrazí** — kdyby se nulovalo
   * každý krok, telemetrie (6×/s) by ho minula a text by se neukázal
   * (měřeno: 2 ze 3 běhů testu bez textu).
   */
  lastLight: number | null;
}

// ── čísla ────────────────────────────────────────────────────────────
// Měřeno tak, aby cesta trvala 1,5–3 minuty a dala se doletět i bez
// dokonalého řízení: gravitace je mírná, proud vzduchu silnější než pád.
export const GRAVITY = 16;
export const LIFT = 34;
export const MAX_RISE = 26;
export const MAX_FALL = 22;
export const ACCEL = 26;
export const MAX_SPEED = 24;
export const DRAG = 1.6;
export const ENERGY_MAX = 100;
export const LIFT_DRAIN = 22;
export const GLIDE_REGEN = 4;
export const CURRENT_REFILL = 26;
export const LIGHT_REFILL = 18;
export const LIGHT_RADIUS = 3.4;
export const SHRINE_RADIUS = 6;

export function createFlight(path: LumiPathId = 'calm'): FlightState {
  const data = pathData(path);
  return {
    path: data.id,
    x: 10,
    y: 12,
    vx: 0,
    vy: 0,
    energy: ENERGY_MAX,
    lights: [],
    total: data.lights.length,
    time: 0,
    finished: false,
    lastLight: null,
  };
}

/** Je bod v proudu vzduchu? Vrací nejsilnější proud (nebo 0). */
export function currentAt(x: number, y: number, path: LumiPathId = 'calm'): number {
  let lift = 0;
  for (const current of pathData(path).currents) {
    const dx = x - current.x;
    const dy = y - current.y;
    if (dx * dx + dy * dy <= current.r * current.r) lift = Math.max(lift, current.lift);
  }
  return lift;
}

/**
 * Jeden krok simulace. `dt` v sekundách (strop 0,05 — stejné pravidlo jako
 * u ostatních her, aby pomalý stroj neproletěl zdí).
 */
export function stepFlight(state: FlightState, input: FlightInput, dt: number): FlightState {
  if (state.finished) return state;
  const step = Math.min(0.05, Math.max(0, dt));
  if (step === 0) return state;

  state.time += step;

  const data = pathData(state.path);
  const lift = currentAt(state.x, state.y, state.path);
  const canLift = state.energy > 0;

  const gaze = isGaze(input);
  const aim = gaze ? input.aim! : null;
  const gazePower = gaze ? Math.max(0, Math.min(1, input.gaze ?? 0)) : 0;

  // 1) svisle: pláštěnka (dokud je síla) nebo gravitace
  if (gaze && aim && aim.y > 0.15 && canLift) {
    // Pohled vzhůru = lucerna táhne; spotřeba je úměrná tomu, jak strmě.
    state.vy += LIFT * aim.y * gazePower * step;
    state.energy = Math.max(0, state.energy - LIFT_DRAIN * aim.y * gazePower * step);
  } else if (input.up && canLift) {
    state.vy += LIFT * step;
    state.energy = Math.max(0, state.energy - LIFT_DRAIN * step);
  } else {
    // Ve VR klesáš při pohledu vpřed **měkce** (0,35 g): hráč nemá klávesu
    // „stoupat", takže by jinak při každém pohledu dopředu spadl jako kámen.
    // Kdo chce klesat rychle, podívá se dolů (viz níže).
    state.vy -= GRAVITY * (gaze ? 0.35 : 1) * step;
  }
  // 2) proudy vzduchu nesou i bez pláštěnky
  if (lift > 0) {
    state.vy += lift * step;
    state.energy = Math.min(ENERGY_MAX, state.energy + CURRENT_REFILL * step);
  } else if (!input.up && !(gaze && aim && aim.y > 0.15)) {
    // klouzání samo do nabíjí — jinak by hráč uvízl bez síly
    state.energy = Math.min(ENERGY_MAX, state.energy + GLIDE_REGEN * step);
  }
  if (input.down || (gaze && aim && aim.y < -0.15)) {
    // pohled dolů = řízené klesání (nedusí, jen zrychlí pád)
    const dive = gaze && aim ? Math.abs(aim.y) * gazePower : 1;
    state.vy -= GRAVITY * 0.8 * dive * step;
  }

  state.vy = Math.max(-MAX_FALL, Math.min(MAX_RISE, state.vy));

  // 3) vodorovně
  const steer = gaze && aim ? aim.x * gazePower : (input.right ? 1 : 0) - (input.left ? 1 : 0);
  state.vx += steer * ACCEL * step;
  state.vx -= state.vx * DRAG * step;
  state.vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, state.vx));

  // 4) integrace + hranice (odráží se, aby hráč nikdy „nezmizel")
  state.x += state.vx * step;
  state.y += state.vy * step;
  if (state.x < 2) {
    state.x = 2;
    state.vx = Math.abs(state.vx) * 0.3;
  } else if (state.x > LUMI_WIDTH - 2) {
    state.x = LUMI_WIDTH - 2;
    state.vx = -Math.abs(state.vx) * 0.3;
  }
  if (state.y < 2) {
    state.y = 2;
    state.vy = Math.abs(state.vy) * 0.35;
  } else if (state.y > LUMI_HEIGHT - 2) {
    state.y = LUMI_HEIGHT - 2;
    state.vy = -Math.abs(state.vy) * 0.2;
  }

  // 5) světla
  for (const light of data.lights) {
    if (state.lights.includes(light.id)) continue;
    const dx = state.x - light.x;
    const dy = state.y - light.y;
    if (dx * dx + dy * dy > LIGHT_RADIUS * LIGHT_RADIUS) continue;
    state.lights.push(light.id);
    state.lastLight = light.id;
    state.energy = Math.min(ENERGY_MAX, state.energy + LIGHT_REFILL);
  }

  // 6) svatyně: jen se všemi světly
  if (state.lights.length === state.total) {
    const dx = state.x - data.shrine.x;
    const dy = state.y - data.shrine.y;
    if (dx * dx + dy * dy <= SHRINE_RADIUS * SHRINE_RADIUS) state.finished = true;
  }

  return state;
}

/**
 * Skóre: světla jsou základ, čas je bonus, ne trest — kdo se kochá, nemá
 * být potrestaný na úroveň toho, kdo jen proletí. Proto se čas odečítá
 * mírně (1 bod za 2 s) a jen do nuly.
 */
export function lumiScore(state: FlightState): number {
  if (!state.finished) return state.lights.length * 100;
  const bonus = Math.max(0, 600 - Math.floor(state.time) * 2);
  return state.lights.length * 100 + bonus;
}

/**
 * Kam teď letět: nejbližší nesebrané světlo, a když máš všechna, svatyně.
 *
 * Vrací `null`, když je hotovo (svatyně dosažena). Funkce je čistá, takže ji
 * testuje i HUD — kompas se tak nemůže rozejít se simulací.
 */
export function nextTarget(state: FlightState): { x: number; y: number; kind: 'light' | 'shrine'; id: number | null } | null {
  if (state.finished) return null;
  const data = pathData(state.path);
  let best: { x: number; y: number; kind: 'light'; id: number; dist: number } | null = null;
  for (const light of data.lights) {
    if (state.lights.includes(light.id)) continue;
    const dist = (state.x - light.x) ** 2 + (state.y - light.y) ** 2;
    if (!best || dist < best.dist) best = { x: light.x, y: light.y, kind: 'light', id: light.id, dist };
  }
  if (best) return { x: best.x, y: best.y, kind: 'light', id: best.id };
  if (state.lights.length >= state.total) {
    return { x: data.shrine.x, y: data.shrine.y, kind: 'shrine', id: null };
  }
  return null;
}

/** Kolik světel ještě chybí. */
export function missingLights(state: FlightState): number {
  return state.total - state.lights.length;
}
