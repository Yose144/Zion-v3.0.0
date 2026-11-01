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

/** Co postava v kánonu je — řídí siluetu, zbroj i vlasy (z podtitulu). */
export type AvatarArchetype = 'warrior' | 'sage' | 'royal' | 'artist' | 'healer' | 'mystic' | 'wanderer';
/** Střih vlasů / pokrývky hlavy. */
export type AvatarHair = 'bald' | 'topknot' | 'long' | 'short' | 'braids' | 'hood' | 'veil';
/** Střih oděvu — mění siluetu (a tím i to, jak postava na kartě vypadá). */
export type AvatarOutfit = 'robe' | 'tunic' | 'armor' | 'sari';
/** Pokrývka hlavy nad vlasy (kultura / hodnost). */
export type AvatarHeadwear = 'none' | 'turban' | 'laurel' | 'feathers' | 'mitre' | 'circlet';
/** Postoj — jinak stojí všech 200 postav stejně jako vojáčci. */
export type AvatarPose = 'neutral' | 'open' | 'guard' | 'raise';

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
  /** Co postava je — z podtitulu (`Dharma King` → royal, `Warrior Seeker` → warrior). */
  archetype: AvatarArchetype;
  /** Vlasy nebo pokrývka hlavy. */
  hair: AvatarHair;
  /** Střih oděvu (silueta). */
  outfit: AvatarOutfit;
  /** Pokrývka hlavy nad vlasy. */
  headwear: AvatarHeadwear;
  /** Postoj (ruce, ramena). */
  pose: AvatarPose;
  /** Barva vlasů (u `bald`/`hood` se nepoužije). */
  hairColor: string;
  beard: boolean;
  cape: boolean;
  /** 0 = holá ramena, 1 = lehké nárameníky, 2 = plná zbroj. */
  pauldrons: 0 | 1 | 2;
  /** Svítící oči (vysoké CL / 1-of-1). */
  eyeGlow: boolean;
  /** Kov nárameníků, spon a zbraní. */
  metal: string;
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
const HAIR = ['#1b1410', '#2c1e16', '#4a2f1d', '#6b4a2f', '#d8d2c6', '#9aa3ad'];
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

/**
 * Archetyp z podtitulu. Roster nese roli v podtitulu (`Dharma King`,
 * `Warrior Seeker`, `Goddess of Knowledge`), takže se dá silueta odvodit
 * z kánonu a ne z náhody — král dostane plášť, mnich holou hlavu.
 */
const ARCHETYPE_WORDS: [AvatarArchetype, string[]][] = [
  ['warrior', ['warrior', 'king', 'queen', 'protector', 'guardian', 'knight', 'samurai', 'general', 'fighter', 'champion', 'defender', 'soldier', 'hunter']],
  ['royal', ['emperor', 'empress', 'princess', 'prince', 'monarch', 'ruler', 'sovereign', 'lady', 'lord']],
  ['sage', ['sage', 'teacher', 'master', 'yogi', 'monk', 'buddha', 'rishi', 'wise', 'scholar', 'lama', 'philosopher', 'architect', 'seer']],
  ['artist', ['poet', 'musician', 'singer', 'dancer', 'artist', 'muse', 'storyteller', 'bard']],
  ['healer', ['healer', 'mother', 'compassion', 'mercy', 'nurse', 'medicine', 'beloved', 'devotion']],
  ['mystic', ['mystic', 'oracle', 'priestess', 'priest', 'magician', 'sorceress', 'shaman', 'witch', 'alchemist', 'goddess']],
];

export function archetypeOf(subtitle: string): AvatarArchetype | null {
  const text = subtitle.toLowerCase();
  for (const [archetype, words] of ARCHETYPE_WORDS) {
    if (words.some((word) => text.includes(word))) return archetype;
  }
  return null;
}

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

  // ── silueta z kánonu ────────────────────────────────────────────────
  // Archetyp z podtitulu; když ho text nenese, rozhodne náhoda (deterministicky).
  const archetype: AvatarArchetype =
    (entry ? archetypeOf(entry.subtitle) : null) ??
    pick(random, ['wanderer', 'sage', 'warrior', 'mystic'] as const, 'wanderer');

  const HAIROF: Record<AvatarArchetype, AvatarHair[]> = {
    warrior: ['topknot', 'short', 'braids', 'short'],
    royal: ['long', 'topknot', 'long'],
    sage: ['bald', 'short', 'long', 'topknot'],
    artist: ['long', 'braids', 'short'],
    healer: ['veil', 'long', 'braids'],
    mystic: ['hood', 'veil', 'long'],
    wanderer: ['hood', 'short', 'braids'],
  };
  const hair = pick(random, HAIROF[archetype], 'short');

  // ── oděv, pokrývka hlavy a postoj ──────────────────────────────────
  const OUTFITOF: Record<AvatarArchetype, AvatarOutfit[]> = {
    warrior: ['armor', 'tunic', 'armor', 'robe'],
    royal: ['sari', 'robe', 'tunic'],
    sage: ['robe', 'robe', 'tunic'],
    artist: ['sari', 'robe', 'tunic'],
    healer: ['sari', 'robe', 'robe'],
    mystic: ['robe', 'robe', 'sari'],
    wanderer: ['tunic', 'robe', 'tunic'],
  };
  const outfit = pick(random, OUTFITOF[archetype], 'robe');
  const HEADWEAROF: Record<AvatarArchetype, AvatarHeadwear[]> = {
    warrior: ['none', 'circlet', 'feathers', 'none'],
    royal: ['circlet', 'turban', 'laurel'],
    sage: ['none', 'none', 'circlet'],
    artist: ['laurel', 'none', 'feathers'],
    healer: ['none', 'circlet', 'laurel'],
    mystic: ['turban', 'none', 'circlet'],
    wanderer: ['none', 'feathers', 'none'],
  };
  const headwear = pick(random, HEADWEAROF[archetype], 'none');
  const pose = pick(random, ['neutral', 'open', 'guard', 'raise'] as const, 'neutral');
  const beard =
    (archetype === 'sage' || archetype === 'warrior' || archetype === 'mystic') && random() < 0.42;
  const cape = archetype === 'royal' || archetype === 'mystic' || rarity === 'OneOfOne' || (archetype === 'warrior' && random() < 0.5);
  const pauldrons: 0 | 1 | 2 =
    archetype === 'warrior' ? (body === 'heavy' || rarity === 'Legendary' ? 2 : 1)
      : archetype === 'royal' ? 1
        : rarity === 'OneOfOne' ? 2
          : 0;
  const eyeGlow = cl >= 7 || rarity === 'OneOfOne';
  const warmRay = ray === 'RubyGold' || ray === 'Yellow' || ray === 'AllRays';
  const metal = warmRay ? '#e8c07a' : ray === 'Obsidian' ? '#8f7a9c' : '#c9d4e4';
  const hairColor =
    (cl >= 8 && (archetype === 'sage' || archetype === 'mystic')) || rarity === 'OneOfOne'
      ? '#e6e2d6'
      : pick(random, HAIR, '#2c1e16');

  return {
    id: entry?.id ?? -1,
    name: entry?.name ?? 'Poutník',
    ray,
    rarity,
    cl,
    body,
    archetype,
    hair,
    outfit,
    headwear,
    pose,
    hairColor,
    beard,
    cape,
    pauldrons,
    eyeGlow,
    metal,
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
