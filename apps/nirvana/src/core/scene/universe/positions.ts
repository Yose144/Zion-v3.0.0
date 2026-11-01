import type { WorldPoint } from '@/lib/worlds';

/** Nová Země — geografie scény. Radiály a úhly jsou canon-stable. */
export const PLANET_R = 4;
export const RING_R = 6.4;
export const RING_R2 = 7.15;
export const ORBIT_R = 5.05;

/**
 * Brána je připnutá k Jupiteru — obíhá s planetou, ne se zemskou soustavou,
 * takže je od něj pořád stejně daleko (a je ve záběru, když se na Jupiter
 * doletí). Odsazení je lokální vůči carrieru planety.
 *
 * Délka |offsetu| = 12,9 je záměrně větší než hit-sféra Jupiteru
 * (`max(size*2.6, 2.6)` = 9,36) + poloměr brány (3): jinak by klik na bránu
 * nejdřív trefil planetu a otevřel by se panel pouti místo vstupu do OASIS.
 */
export const GATE_JUPITER_OFFSET: [number, number, number] = [9, 6.5, 6.5];
export const SUN_POS: [number, number, number] = [0, 0, 0];
/** Oběžná dráha zemské soustavy — skutečná 3. dráha = 1 AU (1 AU = 30 jednotek). */
export const EARTH_ORBIT_R = 30;
export const EARTH_ORBIT_SPEED = 0.02;

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

/** Planety obíhají podle tohohle jediného vzorce — scéna i fokus se musí shodovat. */
export function planetPosition(
  id: string,
  index: number,
  orbitR: number,
  speed: number,
  t: number,
): [number, number, number] {
  const angle = hash01(id, 5) * Math.PI * 2 + index + t * speed;
  return [Math.cos(angle) * orbitR, 0, Math.sin(angle) * orbitR];
}

/* ─── Nebeská flotila (L6) ────────────────────────────────────────────────
 * Pohyblivý uzel nebe: mateřská loď Nabukano s dokovacím rámem a tři nebeské
 * Marie. Není to pin na povrchu — flotila obíhá Novou Zemi mezi planetou a
 * prstencem Issobelly. Jeden vzorec pro scénu i pro fokus: kdyby se rozešly,
 * kamera doletí tam, kde loď není.
 */
export const FLEET_ORBIT_R = 15.5;
export const FLEET_SPEED = 0.022; // rad/s — pomalejší než archa na hladině
export const FLEET_ANGLE0 = 0.9;
export const FLEET_Y = 4.2;

export function fleetPosition(t: number): [number, number, number] {
  const a = FLEET_ANGLE0 + t * FLEET_SPEED;
  return [Math.cos(a) * FLEET_ORBIT_R, FLEET_Y + Math.sin(a * 2) * 0.12, Math.sin(a) * FLEET_ORBIT_R];
}

/** Natočení trupu po tečně dráhy (příď = lokální +x). */
export function fleetHeading(t: number): number {
  return -(FLEET_ANGLE0 + t * FLEET_SPEED) - Math.PI / 2;
}

/* ─── Měsíc (Matrix) ──────────────────────────────────────────────────────
 * Cislunární prostor: Měsíc leží DÁL než flotila, protože flotila je „mezi
 * Zemí a Měsícem". Jeden vzorec pro scénu, fokus i trasu.
 */
export const MOON_ORBIT_R = 24;
export const MOON_SPEED = 0.05;
export const MOON_ANGLE0 = Math.PI * 0.35;

export function moonPosition(t: number): [number, number, number] {
  const a = MOON_ANGLE0 + t * MOON_SPEED;
  return [Math.cos(a) * MOON_ORBIT_R, Math.sin(a * 0.55) * 1.4, Math.sin(a) * MOON_ORBIT_R];
}
