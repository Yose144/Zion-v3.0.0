/**
 * ARÉNA — zbraně a poškození.
 *
 * **Jeden zdroj pro klienta i server.** Kdyby si server vedl vlastní čísla,
 * padaly by rány jinak než je vidět na obrazovce — a to je nejhorší druh chyby
 * v multiplayeru („trefil jsem ho a nic"). Konstanty proto bydlí tady a
 * `MarsArena.tsx` i `nirvana-net` je importují.
 *
 * Čísla jsou z **Quake 3** (id-Software/Q3-Arena, `g_weapon.c`, `g_missile.c`,
 * `bg_public.h`), přepočtená do metrů (1 jednotka ≈ 0,03125 m):
 *
 * | zbraň        | Q3                          | tady              |
 * |--------------|-----------------------------|-------------------|
 * | railgun      | 100 dmg, 1,5 s mezi výstřely| 100 dmg, 1,2 s   |
 * | rocket       | 100 + 100 splash, r=120 u   | 100 + 100, r=3,75 m |
 * | machinegun   | 8 dmg na dávku, 100 ms      | 8 dmg, 100 ms, 50 |
 * | armor        | `ARMOR_PROTECTION` 0,66    | 66 % poškození    |
 */

import { raySolids, raySphere, type Box4 } from './physics';

export type WeaponId = 'rail' | 'rocket' | 'mg' | 'shotgun' | 'lightning' | 'plasma';

export const WEAPONS = {
  rail: {
    damage: 100,
    cooldownMs: 1200,
    /** Rail má nekonečno munice. */
    ammo: Number.POSITIVE_INFINITY,
    /** Rail v Q3 jde skrz hráče; tady zasáhne prvního (rozdíl v balancingu). */
    pierces: false,
  },
  rocket: {
    damage: 100,
    splash: 100,
    radius: 3.75,
    speed: 28,
    cooldownMs: 800,
    ammo: 12,
    ttlMs: 4000,
  },
  mg: {
    damage: 8,
    cooldownMs: 100,
    ammo: 50,
    /** Rozptyl paprsku v radiánech (Q3 `MACHINEGUN_SPREAD` ≈ 0,035). */
    spread: 0.035,
    range: 120,
  },
  /**
   * Brokovnice (Q3 `g_weapon.c`): 11 broků × 10 poškození, jeden náboj na
   * výstřel, kužel 0,11 rad. Krátký dostřel — zblízka drtí, z dálky jen
   * škrábe, přesně jak má.
   */
  shotgun: {
    damage: 10,
    pellets: 11,
    spread: 0.11,
    range: 30,
    cooldownMs: 900,
    ammo: 10,
    /** Kolik nábojů vrátí ammo pickup (Q3 box dává víc, než je zásobník). */
    pickup: 5,
  },
  /**
   * Blesk (Q3 `g_weapon.c`): 8 poškození každých 50 ms, přesný paprsek,
   * dolet 60 m. Drží se spoušť — zvuk i poškození jdou v dávkách.
   */
  lightning: {
    damage: 8,
    range: 60,
    cooldownMs: 50,
    ammo: 100,
    pickup: 40,
    automatic: true,
  },
  /**
   * Plazma (Q3 `g_missile.c`): přímý zásah 20 + splash 15, pomalý projektil,
   * rychlá kadence. Mezi raketou a MG — trestá přesné vedení, ne štěstí.
   */
  plasma: {
    damage: 20,
    splash: 15,
    radius: 1.6,
    speed: 38,
    cooldownMs: 120,
    ammo: 60,
    pickup: 25,
    ttlMs: 2500,
  },
} as const;

/** Podíl poškození, který spolkne armor (Q3 `ARMOR_PROTECTION` = 0,66). */
export const ARMOR_ABSORB = 0.66;

/**
 * Zbraň, kterou bot zvolí podle vzdálenosti.
 *
 * Q3 boti přepínají podle situace — brokovnice zblízka, raketa na střední,
 * MG na dálku a rail na dlouhou. Do 10. 11. 2026 měli všichni jen rail,
 * takže souboj byl vždy stejný bez ohledu na to, kde jsi stál.
 */
export function botWeaponFor(distance: number): WeaponId {
  if (!Number.isFinite(distance) || distance < 0) return 'rail';
  if (distance <= 5) return 'shotgun';
  if (distance <= 14) return 'rocket';
  if (distance <= 24) return 'mg';
  return 'rail';
}

/**
 * Dávky botů. AI nemá simulovat plnou kadenci ani 11 broků — hráč by proti
 * ní neměl šanci. Čísla jsou zlomek hráčových, ale pořád z `WEAPONS`.
 */
export const BOT_FIRE = {
  mgBurst: 4,
  shotgunPellets: 6,
  /** Pravděpodobnost, že bot na střední vzdálenost opravdu vystřelí raketu. */
  rocketChance: 0.45,
} as const;
/** Kolik nábojů na MG dá jeden pickup (Q3 ammo boxy dávají plný zásobník). */
export const MG_AMMO_PICKUP = 25;
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

/** Rozptyl paprsku (machinegun) — náhodný úhel ve dvou osách. */
export function spreadVector(dir: Vec3, spread: number, random: () => number = Math.random): Vec3 {
  if (spread <= 0) return dir;
  const yaw = (random() * 2 - 1) * spread;
  const pitch = (random() * 2 - 1) * spread;
  const cos = Math.cos(pitch);
  return {
    x: dir.x * cos + dir.z * yaw,
    y: dir.y + pitch * 0.6,
    z: dir.z * cos - dir.x * yaw,
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
