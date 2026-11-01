/**
 * ARÉNA — zbraně a poškození.
 *
 * **Jeden zdroj pro klienta i server.** Kdyby si server vedl vlastní čísla,
 * padaly by rány jinak než je vidět na obrazovce — a to je nejhorší druh chyby
 * v multiplayeru („trefil jsem ho a nic"). Konstanty proto bydlí tady a
 * `MarsArena.tsx` i `nirvana-net` je importují.
 */

import { raySolids, raySphere, type Box4 } from './physics';

export type WeaponId = 'rail' | 'rocket';

export const WEAPONS = {
  rail: {
    damage: 55,
    cooldownMs: 750,
    /** Rail má nekonečno munice. */
    ammo: Number.POSITIVE_INFINITY,
  },
  rocket: {
    damage: 85,
    splash: 60,
    radius: 3.2,
    speed: 26,
    cooldownMs: 850,
    ammo: 12,
    ttlMs: 4000,
  },
} as const;

/** Podíl poškození, který spolkne armor. */
export const ARMOR_ABSORB = 0.6;
/** Jak dlouho leží mrtvý hráč, než se vrátí na spawn (ms). */
export const PLAYER_RESPAWN_MS = 2400;
/** Poloměr zásahové koule hráče. */
export const TARGET_RADIUS = 0.62;
/** O kolik výš nad spodkem těla je střed zásahové koule. */
export const TARGET_EYE_RATIO = 0.6;

export interface AimTarget {
  id: string;
  /** Střed zásahové koule (ne spodek těla). */
  x: number;
  y: number;
  z: number;
  radius: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Směr pohledu z yaw/pitch — stejná konvence jako kamera (při yaw 0 kouká −Z).
 * Odpovídá `new THREE.Vector3(0,0,-1).applyEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'))`.
 */
export function aimVector(yaw: number, pitch: number): Vec3 {
  const cosPitch = Math.cos(pitch);
  return {
    x: -Math.sin(yaw) * cosPitch,
    y: Math.sin(pitch),
    z: -Math.cos(yaw) * cosPitch,
  };
}

/**
 * Rail: co trefí paprsek dřív — zeď, nebo hráč? Vrací `null`, když nic
 * (doletí do `maxDist`).
 */
export function pickTarget(
  origin: Vec3,
  dir: Vec3,
  solids: Box4[],
  targets: AimTarget[],
  maxDist = 120,
): { id: string; distance: number; point: Vec3 } | null {
  const wall = raySolids(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, solids, maxDist);
  let limit = wall?.t ?? maxDist;
  let hitId: string | null = null;

  for (const target of targets) {
    const distance = raySphere(
      origin.x,
      origin.y,
      origin.z,
      dir.x,
      dir.y,
      dir.z,
      target.x,
      target.y,
      target.z,
      target.radius,
    );
    if (distance !== null && distance < limit) {
      limit = distance;
      hitId = target.id;
    }
  }

  return {
    id: hitId ?? '',
    distance: limit,
    point: { x: origin.x + dir.x * limit, y: origin.y + dir.y * limit, z: origin.z + dir.z * limit },
  };
}

/** Poškození s absorpcí armoru. Vrací nové hodnoty i to, jestli cíl padl. */
export function applyDamage(
  hp: number,
  armor: number,
  amount: number,
): { hp: number; armor: number; died: boolean } {
  const absorbed = Math.min(Math.max(0, armor), Math.round(amount * ARMOR_ABSORB));
  const nextArmor = Math.max(0, armor - absorbed);
  const nextHp = Math.max(0, hp - (amount - absorbed));
  return { hp: nextHp, armor: nextArmor, died: nextHp <= 0 };
}
