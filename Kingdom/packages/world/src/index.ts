/**
 * @zion/world — DOMÉNA světa. Žádný React, žádné Three, žádný DOM.
 *
 * Tohle je seam pro AAA: jednou tuhle doménu vezme UE5/Puerts adaptér
 * a Místnost se nezmění. Porušení téhle hranice = konec plánu F7.
 *
 * Souřadnice: Y-up, pravá ruka, metry (stejné jako web adaptér).
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Vrstva ekosystému jako místo ve světě. */
export type LayerId = 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6';

export interface PlanetSpec {
  id: string;
  layer: LayerId;
  title: { cs: string; en: string };
  /** poloměr planety v metrech */
  radius: number;
}

export interface RingSpec {
  id: string;
  planetId: string;
  /** vnitřní a vnější poloměr prstence */
  inner: number;
  outer: number;
  /** sklon v radiánech */
  tilt: number;
  /** počet stanic na prstenci */
  stations: number;
}

/** Místo ve vesmíru — orbit, planeta, prstenec, stanice, brána. */
export type Place =
  | { kind: 'orbit' }
  | { kind: 'planet'; planetId: string }
  | { kind: 'ring'; ringId: string }
  | { kind: 'station'; ringId: string; index: number }
  | { kind: 'gate' };

/** Rotace stanice na prstenci — čistá funkce, deterministická. */
export function stationAngle(index: number, count: number): number {
  if (count <= 0) return 0;
  return (index / count) * Math.PI * 2;
}

/** Pozice stanice na prstenci v rovině XZ. */
export function stationPosition(ring: RingSpec, index: number): Vec3 {
  const angle = stationAngle(index, ring.stations);
  const radius = (ring.inner + ring.outer) / 2;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(ring.tilt) * Math.sin(angle) * radius,
    z: Math.sin(angle) * radius,
  };
}
