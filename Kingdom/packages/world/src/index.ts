/**
 * @zion/world — DOMÉNA světa. Žádný React, žádné Three, žádný DOM.
 *
 * Tohle je seam pro AAA: jednou tuhle doménu vezme UE5/Puerts adaptér
 * a Místnost se nezmění. Porušení téhle hranice = konec plánu F7.
 *
 * Souřadnice: Y-up, pravá ruka, metry (stejné jako web adaptér).
 */

export type { Vec3, LayerId, PlanetSpec, RingSpec, Place, SceneMarker } from './types';
export { stationAngle, stationPosition, ringStations } from './geometry';
export { mulberry32, starField, starBrightness } from './rng';
export {
  NEW_EARTH,
  ISSOBELLA_RING,
  GATE,
  placeMarker,
  orbitAngle,
  orbitCamera,
} from './orbit';
