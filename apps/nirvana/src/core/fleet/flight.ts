/**
 * LET — čistá simulace stíhačky.
 *
 * Záměrně **nezná three.js** ani React: jde spustit v Node (`test/fleet-flight.mjs`),
 * takže se letové vlastnosti a dokování dají měřit bez prohlížeče. Scéna
 * (`FleetScene`) i testy čtou stejný stav — nemůže se stát, že by hra letěla
 * jinak, než co testy ověřují.
 *
 * Model je arkádový, ne realistický: rychlost jde za plynem, zatáčení je
 * úměrné rychlosti (stojící loď se neotočí na místě), boost je palivo.
 * Žádná setrvačnost do stran — kdyby loď klouzala, nedá se na dok doletět
 * přesně, a to je celý smysl hry.
 */

import type { ShipSpec } from './ships';
import type { Dock } from './docks';

/** Hranice letového prostoru (Měsíc je na 24, flotila na 15,5). */
export const WORLD_RADIUS = 34;
/** Nová Země včetně atmosféry — blíž se nesmí. */
export const PLANET_RADIUS = 4.4;
/** V jaké vzdálenosti od doku se počítá přiblížení. */
export const DOCK_RADIUS = 1.5;
/** Jak dlouho se musí u doku držet, aby se zakotvilo. */
export const DOCK_HOLD = 1.5;
/** Maximální rychlost, se kterou jde přistát. */
export const DOCK_MAX_SPEED = 5;
/** Ochranná známka proti „přistání" v plné rychlosti. */
export const BOOST_BURN = 3.2;
/** Kolikrát silnější je brzda proti plynu. */
export const BRAKE_FACTOR = 2.2;

export interface ShipState {
  x: number;
  y: number;
  z: number;
  /** Natočení kolem svislé osy (nos = +Z při yaw 0). */
  yaw: number;
  /** Klopení (kladné = nahoru). */
  pitch: number;
  /** Náklon — jen vizuální, na let nemá vliv. */
  roll: number;
  speed: number;
  /** Palivo boostu 0..1. */
  boost: number;
  docked: string | null;
  /** 0..1 — jak daleko je dokončení přistání. */
  dockProgress: number;
  /** Dok, u kterého se právě drží (i nedokončený). */
  dockId: string | null;
  /** Ujetá dráha — pro HUD a pro testy. */
  travelled: number;
}

export interface ShipInput {
  /** −1..1 (plyn/brzda). */
  throttle: number;
  yaw: number;
  pitch: number;
  roll: number;
  boost: boolean;
  brake: boolean;
}

export const NO_INPUT: ShipInput = { throttle: 0, yaw: 0, pitch: 0, roll: 0, boost: false, brake: false };

export function createShip(spec: ShipSpec, at?: { x: number; y: number; z: number; yaw?: number }): ShipState {
  return {
    x: at?.x ?? 0,
    y: at?.y ?? 6,
    z: at?.z ?? 14,
    yaw: at?.yaw ?? Math.PI,
    pitch: 0,
    roll: 0,
    speed: 0,
    boost: 1,
    docked: null,
    dockProgress: 0,
    dockId: null,
    travelled: 0,
  };
}

/** Jednotkový vektor přídě. */
export function forwardOf(state: ShipState): [number, number, number] {
  const cosPitch = Math.cos(state.pitch);
  return [Math.sin(state.yaw) * cosPitch, Math.sin(state.pitch), Math.cos(state.yaw) * cosPitch];
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/**
 * Jeden krok simulace.
 *
 * `dt` je v sekundách a ořezává se na 0,05 s — na 15 fps by jinak loď
 * „proletěla" dokem mezi dvěma snímky a hráč by nepochopil, proč se nic
 * nestalo (stejná past jako u závodu na Venuši).
 */
export function stepShip(
  state: ShipState,
  input: ShipInput,
  spec: ShipSpec,
  dt: number,
  docks: Dock[],
  t: number,
): void {
  const step = clamp(dt, 0, 0.05);

  // ── zakotveno: loď jede s dokem, vstup se ignoruje ────────────────────
  if (state.docked) {
    const dock = docks.find((entry) => entry.id === state.docked);
    if (dock) {
      state.x = dock.position[0];
      state.y = dock.position[1];
      state.z = dock.position[2];
      state.yaw = dock.yaw;
    }
    state.pitch = 0;
    state.roll = 0;
    state.speed = 0;
    state.dockProgress = 1;
    state.boost = Math.min(1, state.boost + step * 0.5);
    return;
  }

  // ── rychlost ──────────────────────────────────────────────────────────
  const boosting = input.boost && state.boost > 0.02;
  if (boosting) state.boost = Math.max(0, state.boost - step / BOOST_BURN);
  else state.boost = Math.min(1, state.boost + step / 8);

  let target: number;
  if (input.brake) {
    target = 0;
  } else if (input.throttle >= 0) {
    // kladný plyn = dopředu; nula = volnoběh (loď nezastaví, jen zpomalí)
    target = (input.throttle > 0 ? input.throttle : 0.35) * spec.maxSpeed;
  } else {
    // záporný plyn = couvání, výrazně pomalejší
    target = input.throttle * spec.maxSpeed * 0.35;
  }
  if (boosting) target *= spec.boost;

  // Brzda musí být výrazně silnější než plyn — je to nástroj, kterým se
  // doletí na dok. Kdyby brzdila stejně jako táhne, hráč by u doku vždy
  // přeletěl a přistání by bylo dílem náhody.
  const limit = (input.brake ? spec.accel * BRAKE_FACTOR : spec.accel) * step;
  const delta = clamp(target - state.speed, -limit, limit);
  state.speed += delta;

  // ── zatáčení ──────────────────────────────────────────────────────────
  // Stojící loď se nemá čím opřít o vzduch, takže se otáčí pomaleji —
  // zároveň ale musí jít otočit i při velmi nízké rychlosti, jinak se hráč
  // po kolizi s planetou nedostane z rohu.
  const authority = 0.45 + 0.55 * Math.min(1, Math.abs(state.speed) / spec.maxSpeed);
  state.yaw += input.yaw * spec.turn * authority * step;
  state.pitch = clamp(state.pitch + input.pitch * spec.pitch * authority * step, -1.15, 1.15);

  // náklon: držené Q/E se sčítá, jinak se loď srovná podle zatáčení
  const bank = -input.yaw * 0.55 + input.roll * 0.8;
  state.roll += (bank - state.roll) * Math.min(1, step * 6);

  // ── pohyb ─────────────────────────────────────────────────────────────
  const [fx, fy, fz] = forwardOf(state);
  const travel = state.speed * step;
  state.x += fx * travel;
  state.y += fy * travel;
  state.z += fz * travel;
  state.travelled += Math.abs(travel);

  // ── hranice a planeta ─────────────────────────────────────────────────
  const distance = Math.hypot(state.x, state.y, state.z);
  if (distance > WORLD_RADIUS) {
    const scale = WORLD_RADIUS / distance;
    state.x *= scale;
    state.y *= scale;
    state.z *= scale;
    state.speed *= 0.9;
  }
  if (distance < PLANET_RADIUS) {
    const scale = PLANET_RADIUS / Math.max(distance, 0.001);
    state.x *= scale;
    state.y *= scale;
    state.z *= scale;
    state.speed *= 0.85;
  }

  // ── dokování ──────────────────────────────────────────────────────────
  let nearest: Dock | null = null;
  let nearestDistance = Infinity;
  for (const dock of docks) {
    const gap = Math.hypot(dock.position[0] - state.x, dock.position[1] - state.y, dock.position[2] - state.z);
    if (gap < nearestDistance) {
      nearestDistance = gap;
      nearest = dock;
    }
  }

  const close = nearest !== null && nearestDistance < DOCK_RADIUS && Math.abs(state.speed) < DOCK_MAX_SPEED;
  if (close && nearest) {
    state.dockId = nearest.id;
    // Dokovací paprsek: dok si loď přitáhne a zbrzdí. Bez toho by hráč musel
    // viset v okruhu 1,5 jednotky na volnoběh ( který sám táhne dopředu),
    // takže by přistání nešlo dokončit — přesně to odhalil test.
    const pull = Math.min(1, step * 1.8);
    state.x += (nearest.position[0] - state.x) * pull;
    state.y += (nearest.position[1] - state.y) * pull;
    state.z += (nearest.position[2] - state.z) * pull;
    state.speed *= Math.exp(-3 * step);

    state.dockProgress = Math.min(1, state.dockProgress + step / DOCK_HOLD);
    if (state.dockProgress >= 1) {
      state.docked = nearest.id;
      state.x = nearest.position[0];
      state.y = nearest.position[1];
      state.z = nearest.position[2];
      state.yaw = nearest.yaw;
      state.speed = 0;
      state.pitch = 0;
      state.roll = 0;
    }
  } else {
    state.dockId = null;
    state.dockProgress = Math.max(0, state.dockProgress - step * 2);
  }

  void t;
}

/**
 * Odpojení od doku. Loď dostane malý impuls ven, aby hned nezůstala
 * v dosahu doku a nezasekla se v půlce přistání.
 */
export function undock(state: ShipState): void {
  if (!state.docked) return;
  state.docked = null;
  state.dockProgress = 0;
  state.dockId = null;
  state.speed = 1.5;
  state.y = state.y + 0.6;
}

/** Stavy pro HUD — jedna funkce, aby si stránka nepočítala vlastní čísla. */
export interface FleetTelemetry {
  x: number;
  y: number;
  z: number;
  speed: number;
  boost: number;
  dockProgress: number;
  dockId: string | null;
  docked: string | null;
  travelled: number;
  nearest: { id: string; kind: string; distance: number } | null;
}

export function telemetry(state: ShipState, docks: Dock[]): FleetTelemetry {
  let nearest: FleetTelemetry['nearest'] = null;
  for (const dock of docks) {
    const distance = Math.hypot(dock.position[0] - state.x, dock.position[1] - state.y, dock.position[2] - state.z);
    if (!nearest || distance < nearest.distance) nearest = { id: dock.id, kind: dock.kind, distance };
  }
  return {
    x: state.x,
    y: state.y,
    z: state.z,
    speed: state.speed,
    boost: state.boost,
    dockProgress: state.dockProgress,
    dockId: state.dockId,
    docked: state.docked,
    travelled: state.travelled,
    nearest,
  };
}
