import type { RingSpec, Vec3 } from './types';

/** Rotace stanice na prstenci — čistá funkce, deterministická. */
export function stationAngle(index: number, count: number): number {
  if (count <= 0) return 0;
  return (index / count) * Math.PI * 2;
}

/** Pozice stanice na prstenci v rovině XZ (se sklonem). */
export function stationPosition(ring: RingSpec, index: number): Vec3 {
  const angle = stationAngle(index, ring.stations);
  const radius = (ring.inner + ring.outer) / 2;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(ring.tilt) * Math.sin(angle) * radius,
    z: Math.sin(angle) * radius,
  };
}

/** Všechny stanice prstence najednou — pro instanced render. */
export function ringStations(ring: RingSpec): Vec3[] {
  return Array.from({ length: ring.stations }, (_, index) => stationPosition(ring, index));
}
