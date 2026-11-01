/**
 * AVATAR — jak vypadá ve 3D.
 *
 * V repu nejsou žádné modely (0× glb/gltf) a 200 avatarů nejde namodelovat
 * ručně, takže vzhled **počítáme z dat**: id → PRNG → tělo, plášť, ornamenty,
 * aura. Paprsek a vzácnost bereme z katalogu, takže Ráma je modrý a
 * Krišna-Maitreya zlatý, jak říká roster.
 *
 * Důležité: `avatarLook()` je **čistá a deterministická** — stejné id dá
 * vždycky stejnou postavu, takže cizí hráč jde vykreslit jen z `avatarId`,
 * bez stahování celého rosteru.
 */

import { AVATARS_BY_ID, RAY_COLOR, type AvatarEntry, type AvatarRay } from './catalog';

export type BodyType = 'slim' | 'standard' | 'heavy';

export type Ornament =
  | 'halo'
  | 'staff'
  | 'lotus'
  | 'conch'
  | 'sword'
  | 'book'
  | 'veena'
  | 'bow'
  | 'drum'
  | 'orb'
  | 'banner'
  | 'spear';

export interface AvatarLook {
  id: number;
  name: string;
  ray: AvatarRay;
  rarity: AvatarEntry['rarity'];
  cl: number;
  body: BodyType;
  /** Výška postavy v metrech (1,55–2,1). */
  height: number;
  /** Šířka trupu (0,75–1,3 násobek). */
  width: number;
  palette: {
    robe: string;
    trim: string;
    glow: string;
    skin: string;
  };
  ornaments: Ornament[];
  /** 0–2 prstence aury podle vzácní. */
  auraRings: number;
  crown: boolean;
  seed: number;
}

const SKIN = ['#e8c9a0', '#d7b48b', '#c69a72', '#a97c56', '#8a5f3f', '#f0d7b8'];
const ORNAMENTS: Ornament[] = [
  'staff',
  'lotus',
  'conch',
  'sword',
  'book',
  'veena',
  'bow',
  'drum',
  'orb',
  'banner',
  'spear',
];

/** FNV-1a — stejné id dá vždy stejné semínko. */
function hashId(id: number): number {
  let value = 2166136261 ^ id;
  value = Math.imul(value, 16777619);
  value ^= value >>> 13;
  return value >>> 0;
}

/** mulberry32 — malý deterministický PRNG (stejný jako u ZIS sigilu). */
function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(random: () => number, list: readonly T[], fallback: T): T {
  if (list.length === 0) return fallback;
  return list[Math.floor(random() * list.length) % list.length] ?? fallback;
}

/** Ztmaví/ztlumí barvu — plášť nesmí svítit stejně jako trim. */
function shade(hex: string, factor: number): string {
  const value = hex.replace('#', '');
  const r = Math.round(parseInt(value.slice(0, 2), 16) * factor);
  const g = Math.round(parseInt(value.slice(2, 4), 16) * factor);
  const b = Math.round(parseInt(value.slice(4, 6), 16) * factor);
  const clamp = (n: number) => Math.max(0, Math.min(255, n));
  return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g).toString(16).padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`;
}

/** Volitelné úpravy z ZIS (`avatar3d`) — hráč si je vybírá v pickeru. */
export interface AvatarOverrides {
  bodyType?: BodyType;
  neonColor?: string;
}

/** Vzhled pro konkrétní id. Neznámé id = host (šedý poutník). */
export function avatarLook(
  id: number | null | undefined,
  overrides: AvatarOverrides = {},
): AvatarLook {
  const entry = typeof id === 'number' ? AVATARS_BY_ID.get(id) : undefined;
  const seed = hashId(entry?.id ?? 9999);
  const random = rng(seed);
  const ray: AvatarRay = entry?.ray ?? 'White';
  const rarity = entry?.rarity ?? 'Rare';
  const cl = entry?.cl ?? 1;
  const base = RAY_COLOR[ray];
  const accent = /^#[0-9a-fA-F]{6}$/.test(overrides.neonColor ?? '')
    ? overrides.neonColor!
    : base;

  const derivedBody: BodyType =
    rarity === 'OneOfOne'
      ? 'standard'
      : random() < 0.3
        ? 'slim'
        : random() < 0.72
          ? 'standard'
          : 'heavy';
  const body: BodyType = overrides.bodyType ?? derivedBody;

  const ornamentCount = rarity === 'Rare' ? (random() < 0.45 ? 1 : 0) : rarity === 'Epic' ? 1 : 2;
  const ornaments: Ornament[] = [];
  for (let index = 0; index < ornamentCount; index += 1) {
    const candidate = pick(random, ORNAMENTS, 'orb');
    if (!ornaments.includes(candidate)) ornaments.push(candidate);
  }
  if (rarity === 'Legendary' || rarity === 'OneOfOne') ornaments.unshift('halo');

  return {
    id: entry?.id ?? -1,
    name: entry?.name ?? 'Poutník',
    ray,
    rarity,
    cl,
    body,
    height: 1.58 + random() * 0.5,
    width: body === 'slim' ? 0.82 : body === 'heavy' ? 1.24 : 1,
    palette: {
      robe: shade(accent, 0.55),
      trim: accent,
      glow: shade(accent, 1.15),
      skin: pick(random, SKIN, '#d7b48b'),
    },
    ornaments,
    auraRings: rarity === 'OneOfOne' ? 2 : rarity === 'Legendary' ? 1 : 0,
    crown: rarity === 'Legendary' || rarity === 'OneOfOne' || cl >= 7,
    seed,
  };
}
