import type { PlanetSpec, RingSpec, Vec3 } from './types';

/**
 * Kanonické univerzum.
 *
 * Jedna planeta (Nová Země), prstenec Issobelly (L6) a Brána v prostoru.
 * Souřadnice jsou v metrech, Y-up, pravá ruka — stejné jako web renderer.
 */

export const NEW_EARTH: PlanetSpec = {
  id: 'new-earth',
  layer: 'L5',
  title: { cs: 'Nová Země', en: 'New Earth' },
  radius: 1,
};

export const ISSOBELLA_RING: RingSpec = {
  id: 'issobella',
  planetId: 'new-earth',
  inner: 1.72,
  outer: 2.18,
  tilt: 0.2,
  stations: 6,
};

export const GATE = {
  id: 'gate',
  position: { x: -3.15, y: 0.55, z: 2.2 } satisfies Vec3,
  radius: 0.42,
};

/** Pozice portálu ve scéně — z `manifest.ring` (x, z) do světa. */
export function placeMarker(ring: { x: number; z: number }, y = 0.28): Vec3 {
  return { x: ring.x, y, z: ring.z };
}

/** Normalizovaný úhel kamery pro pomalý oblet. */
export function orbitAngle(t: number, speed = 0.055): number {
  return t * speed;
}

/** Kamera na oběžné dráze — čistá funkce, renderer jen aplikuje. */
export function orbitCamera(angle: number, radius = 5.4, height = 2.15): Vec3 {
  return {
    x: Math.cos(angle) * radius,
    y: height,
    z: Math.sin(angle) * radius,
  };
}
