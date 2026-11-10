/**
 * GHOST — záznam nejlepší jízdy a jeho přehrání.
 *
 * Ghost není druhá simulace: je to **vzorkovaná stopa** (`t`, `x`, `z`,
 * `heading`), kterou scéna jen interpoluje. Kdyby ghost znovu počítal fyziku,
 * rozešel by se s tím, co hráč opravdu jel (a stačilo by změnit jednu
 * konstantu, aby se duch „utrhl“).
 *
 * Vzorkování je časové, ne po snímcích: jinak by měl hráč na 144 fps ghosta
 * hustšího než na 30 fps a délka záznamu by závisela na výkonu stroje.
 */

import type { PikoMode } from './world';

export interface GhostPoint {
  t: number;
  x: number;
  z: number;
  /** Natočení ve světě (rad). */
  heading: number;
}

export interface GhostRun {
  mode: PikoMode;
  score: number;
  points: GhostPoint[];
}

/** Vzorek každých 0,2 s — plynulé i na 30 fps, a přesto úsporné. */
export const GHOST_STEP = 0.2;
/** Strop záznamu (3 minuty) — delší jízda se zaznamenává dál, ale maže začátek. */
export const GHOST_MAX = 900;

function wrapAngle(angle: number): number {
  return ((angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
}

/** Zapiš vzorek, pokud od posledního uplynul `GHOST_STEP`. Mutuje pole. */
export function pushGhost(
  points: GhostPoint[],
  t: number,
  x: number,
  z: number,
  heading: number,
): void {
  if (!Number.isFinite(t) || !Number.isFinite(x) || !Number.isFinite(z)) return;
  const last = points[points.length - 1];
  if (last && t - last.t < GHOST_STEP - 1e-6) return;
  points.push({ t, x, z, heading });
  if (points.length > GHOST_MAX) points.shift();
}

/** Vzorek v čase `t` (lineární interpolace, úhel po kratší straně). */
export function sampleGhost(points: GhostPoint[], t: number): GhostPoint | null {
  if (points.length === 0) return null;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  if (t <= first.t) return first;
  if (t >= last.t) return last;

  // malé pole (řádově stovky) — lineární hledání je čitelnější než binární
  for (let index = 1; index < points.length; index++) {
    const next = points[index]!;
    if (next.t < t) continue;
    const prev = points[index - 1]!;
    const span = Math.max(1e-6, next.t - prev.t);
    const k = Math.min(1, Math.max(0, (t - prev.t) / span));
    return {
      t,
      x: prev.x + (next.x - prev.x) * k,
      z: prev.z + (next.z - prev.z) * k,
      heading: prev.heading + wrapAngle(next.heading - prev.heading) * k,
    };
  }
  return last;
}

/** Délka záznamu v sekundách (pro UI „duch 0:42“). */
export function ghostLength(points: GhostPoint[]): number {
  if (points.length === 0) return 0;
  return points[points.length - 1]!.t;
}

/** Záznam pro uložení do pasu; příliš krátký běh nemá smysl. */
export function createGhostRun(
  mode: PikoMode,
  score: number,
  points: GhostPoint[],
): GhostRun | null {
  if (points.length < 8) return null;
  return {
    mode,
    score,
    points: points.map((point) => ({
      t: Math.round(point.t * 100) / 100,
      x: Math.round(point.x * 100) / 100,
      z: Math.round(point.z * 100) / 100,
      heading: Math.round(point.heading * 1000) / 1000,
    })),
  };
}
