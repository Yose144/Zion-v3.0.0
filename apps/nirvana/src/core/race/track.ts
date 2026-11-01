/**
 * VENUŠE — okruh.
 *
 * Trať je parametricky daná křivka (superelipsa s vlněním), takže se dá
 * postavit z pár čísel: šířka, poloměr, vlna. Z ní plyne geometrie pásu,
 * checkpointy i to, kde vozítko jede po silnici a kde už je v písku.
 */

export const TRACK_RADIUS = 86;
export const TRACK_WIDTH = 11;
export const TRACK_AMPLITUDE = 22;
export const TRACK_WAVES = 3;
export const SAMPLES = 320;
export const LAPS = 3;
export const CHECKPOINTS = 6;

export interface TrackPoint {
  x: number;
  z: number;
  /** Jednotkový vektor ve směru jízdy. */
  tx: number;
  tz: number;
  /** Jednotková normála (dovnitř/dovněž). */
  nx: number;
  nz: number;
}

function radiusAt(theta: number): number {
  return TRACK_RADIUS + Math.sin(theta * TRACK_WAVES) * TRACK_AMPLITUDE;
}

export function buildTrack(): TrackPoint[] {
  const points: TrackPoint[] = [];
  for (let i = 0; i < SAMPLES; i++) {
    const theta = (i / SAMPLES) * Math.PI * 2;
    const r = radiusAt(theta);
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;

    // tečna numericky (stabilnější než analytická derivace vlnění)
    const thetaNext = ((i + 1) / SAMPLES) * Math.PI * 2;
    const rNext = radiusAt(thetaNext);
    const dx = Math.cos(thetaNext) * rNext - x;
    const dz = Math.sin(thetaNext) * rNext - z;
    const len = Math.hypot(dx, dz) || 1;

    points.push({
      x,
      z,
      tx: dx / len,
      tz: dz / len,
      nx: -dz / len,
      nz: dx / len,
    });
  }
  return points;
}

/** Nejbližší vzorek tratě — hledá se v okně kolem poslední pozice. */
export function nearestSample(track: TrackPoint[], x: number, z: number, hint: number): number {
  const total = track.length;
  let bestIndex = hint;
  let bestDistance = Infinity;

  for (let offset = -12; offset <= 12; offset++) {
    const index = (hint + offset + total) % total;
    const point = track[index]!;
    const distance = (point.x - x) ** 2 + (point.z - z) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }

  // když se ztratí (teleport, pád), projdi celou trať
  if (bestDistance > 24 * 24) {
    for (let index = 0; index < total; index += 4) {
      const point = track[index]!;
      const distance = (point.x - x) ** 2 + (point.z - z) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }
  }
  return bestIndex;
}

export function lateralOffset(point: TrackPoint, x: number, z: number): number {
  return (x - point.x) * point.nx + (z - point.z) * point.nz;
}

/** Checkpointy jako indexy vzorků — projíždí se v pořadí. */
export function checkpointIndices(): number[] {
  return Array.from({ length: CHECKPOINTS }, (_, i) =>
    Math.round((i / CHECKPOINTS) * SAMPLES) % SAMPLES,
  );
}

/** Body na tabuli: kdo dojel rychleji, má víc. */
export function raceScore(totalSeconds: number, laps: number): number {
  if (laps <= 0 || totalSeconds <= 0) return 0;
  return Math.max(0, Math.round((laps / totalSeconds) * 100000));
}
