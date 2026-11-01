/**
 * Typy domény světa. Žádný React, žádné Three, žádný DOM.
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

/**
 * Portál promítnutý do scény.
 *
 * Vzniká z `manifest.ring` + lokalizovaného titulku — svět je tak řízený
 * Portal Contractem, ne ručně udržovaným seznamem bodů.
 */
export interface SceneMarker {
  id: string;
  title: string;
  /** 0–360, odstín markeru */
  hue: number;
  x: number;
  y: number;
  z: number;
  /** je portál otevřený, nebo jen připravovaný */
  live: boolean;
}
