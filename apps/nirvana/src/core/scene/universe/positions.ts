import type { SurfaceSpot } from '@/core/portals/manifest';
import type { WorldPoint } from '@/lib/worlds';

/** Nová Země — geografie scény. Radiály a úhly jsou canon-stable. */
export const PLANET_R = 4;
export const RING_R = 6.4;
export const RING_R2 = 7.15;
export const ORBIT_R = 5.05;
export const GATE_POS: [number, number, number] = [10.6, 2.1, -7.2];
export const SUN_POS: [number, number, number] = [34, 14, -26];

export function hash01(id: string, salt = 0): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

export function latLonToVec3(lat: number, lon: number, r: number): [number, number, number] {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return [
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  ];
}

/** Pevná místa na povrchu — funkcionální spoty manifestu. */
export const SURFACE_SPOTS: Record<SurfaceSpot, { lat: number; lon: number }> = {
  harbor: { lat: -6, lon: -55 },
  market: { lat: 16, lon: 38 },
  forge: { lat: -18, lon: 108 },
  library: { lat: 34, lon: -142 },
  beacon: { lat: 58, lon: 172 },
  gate: { lat: 0, lon: 0 }, // nepoužívá se — gate visí volně
  ring: { lat: 0, lon: 0 },
};

export function spotPosition(spot: SurfaceSpot, r = PLANET_R + 0.06): [number, number, number] {
  const s = SURFACE_SPOTS[spot];
  return latLonToVec3(s.lat, s.lon, r);
}

/** L5 svět → bod na povrchu (deterministicky z id). */
export function surfacePosition(world: WorldPoint, r = PLANET_R + 0.03): [number, number, number] {
  if (world.galaxyPosition) {
    const g = world.galaxyPosition;
    const len = Math.hypot(g.x, g.y, g.z) || 1;
    return [(g.x / len) * r, (g.y / len) * r, (g.z / len) * r];
  }
  const lat = -55 + hash01(world.id, 7) * 110;
  const lon = hash01(world.id, 13) * 360 - 180;
  return latLonToVec3(lat, lon, r);
}

/** L6 svět → stanice na prstenci Issobelly. */
export function ringPosition(world: WorldPoint, index: number, total: number, r = RING_R): [number, number, number] {
  const angle = (index / Math.max(total, 1)) * Math.PI * 2 + hash01(world.id, 3) * 0.4;
  return [Math.cos(angle) * r, 0, Math.sin(angle) * r];
}

/** L4 (a nižší) svět → vnitřní oběžná dráha — krouží kolem planety pod prstencem. */
export function orbitPosition(world: WorldPoint, index: number, total: number): [number, number, number] {
  const r = ORBIT_R + hash01(world.id, 11) * 0.7;
  const angle = (index / Math.max(total, 1)) * Math.PI * 2;
  const y = (hash01(world.id, 17) - 0.5) * 1.6;
  return [Math.cos(angle) * r, y, Math.sin(angle) * r];
}

export type WorldSlot = 'surface' | 'ring' | 'orbit';

export function worldSlot(world: WorldPoint): WorldSlot {
  if (world.layer >= 6) return 'ring';
  if (world.layer === 5) return 'surface';
  return 'orbit';
}
