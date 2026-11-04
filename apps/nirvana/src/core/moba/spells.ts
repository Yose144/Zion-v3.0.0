/**
 * MOBA „PRVNÍ SVĚT" — kouzla avatarů.
 *
 * **Každá postava umí kouzla, protože je má v kánonu.** Ability v
 * `V31/L4/oasis/data/avatars.json` (`Dharma Shield`, `Agni Pariksha`,
 * `Cosmic Vision`…) se přeloží na sadu Q/W/E/R podle toho, co ta schopnost
 * dělá. Nic se nevymýšlí ručně pro 200 postav — pravidla jsou tady a jsou
 * deterministická: stejné id dá vždy stejnou sadu.
 *
 * Kouzla nejsou dekorace: sim je počítá (dmg, štít, heal, zpomalení, dash)
 * a klient jen kreslí, co sim vrátí — jinak by hráč viděl jiné zásahy, než
 * se opravdu staly (stejné pravidlo jako u arény).
 */

import { AVATARS_BY_ID, type AvatarEntry } from '../avatars/catalog';
import { avatarLook } from '../avatars/kit';

export type SpellSlot = 'Q' | 'W' | 'E' | 'R';
export type SpellKind = 'projectile' | 'aoe' | 'buff' | 'dash';

/** Žánr schopnosti — z textu ability, ne z nálady. */
export type SpellSchool =
  | 'ward' // štíty, ochrana, léčení
  | 'fire' // oheň, spalování, Agni
  | 'arrow' // luk, šíp, přesná rána
  | 'blade' // meč, kopí, boj zblízka
  | 'cosmic' // vize, čas, vesmír
  | 'mind' // moudrost, knihy, iluze
  | 'nature' // lotos, země, růst
  | 'storm' // bouře, hrom, voda
  | 'song' // hudba, tanec, vína
  | 'shadow' // smrt, přechod, temnota
  | 'beast'; // zvířecí síla, skok, běh

/** Všechny školy na jednom místě — UI i testy je procházejí. */
export const SPELL_SCHOOLS: SpellSchool[] = [
  'ward',
  'fire',
  'arrow',
  'blade',
  'cosmic',
  'mind',
  'nature',
  'storm',
  'song',
  'shadow',
  'beast',
];

export interface Spell {
  slot: SpellSlot;
  name: string;
  school: SpellSchool;
  kind: SpellKind;
  /** Přímé poškození (0 u čistě podpůrných). */
  damage: number;
  /** Štít na sebe (absorbuje poškození). */
  shield: number;
  /** Léčení na sebe. */
  heal: number;
  /** Zpomalení 0..1 na `slowMs`. */
  slow: number;
  slowMs: number;
  /** Dosah seslání (0 = na sebe). */
  range: number;
  /** Poloměr zásahu (AoE) nebo hitbox projektilu. */
  radius: number;
  /** Rychlost projektilu (m/s), u AoE/buffu 0. */
  speed: number;
  cooldownMs: number;
  mana: number;
  /** Barva VFX — z paprsku postavy, aby kouzlo „patřilo" jí. */
  color: string;
}

const SCHOOL_WORDS: [SpellSchool, string[]][] = [
  ['ward', ['shield', 'protect', 'barrier', 'guard', 'ward', 'shelter', 'defend']],
  ['fire', ['fire', 'flame', 'burn', 'agni', 'inferno', 'ember', 'solar', 'sun']],
  ['arrow', ['arrow', 'bow', 'shot', 'aim', 'pierce', 'snipe']],
  ['blade', ['sword', 'blade', 'spear', 'strike', 'combat', 'strength', 'battle', 'mace', 'axe']],
  ['cosmic', ['cosmic', 'vision', 'timeline', 'time', 'universe', 'star', 'void', 'dimension']],
  ['mind', ['knowledge', 'wisdom', 'text', 'book', 'mind', 'truth', 'clue', 'insight', 'teach']],
  ['nature', ['lotus', 'nature', 'earth', 'growth', 'garden', 'forest', 'seed', 'bloom']],
  ['storm', ['storm', 'thunder', 'lightning', 'rain', 'water', 'ocean', 'wave', 'wind']],
  ['song', ['song', 'music', 'dance', 'sound', 'melody', 'veena', 'flute']],
  ['shadow', ['death', 'shadow', 'dark', 'yomi', 'underworld', 'ancestor', 'spirit']],
  ['beast', ['beast', 'strength', 'leap', 'monkey', 'eagle', 'wolf', 'tiger', 'wing']],
];

function schoolOf(text: string): SpellSchool {
  const lower = text.toLowerCase();
  for (const [school, words] of SCHOOL_WORDS) {
    if (words.some((word) => lower.includes(word))) return school;
  }
  return 'cosmic';
}

/** Stabilní PRNG — stejné id musí dát vždy stejná čísla. */
function seededRandom(id: number): () => number {
  let state = (2166136261 ^ (id + 1)) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Slovník názvů — z atributů postavy, ať kouzlo zní jako ona. */
const NAME_PARTS: Record<SpellSchool, { q: string[]; w: string[]; e: string[]; r: string[] }> = {
  ward: { q: ['Ward Strike', 'Shield Bash'], w: ['Aegis', 'Sanctuary'], e: ['Bulwark', 'Guardian Ring'], r: ['Unbreakable Vow', 'Dharma Shield'] },
  fire: { q: ['Ember Bolt', 'Cinder Shot'], w: ['Inner Flame', 'Kindled Ward'], e: ['Fire Ring', 'Ash Circle'], r: ['Agni Pariksha', 'Solar Judgement'] },
  arrow: { q: ['Piercing Shot', 'True Aim'], w: ['Steady Breath', 'Hunter’s Focus'], e: ['Arrow Rain', 'Volley'], r: ['Sky-Piercer', 'Thousand Arrows'] },
  blade: { q: ['Blade Arc', 'Cleaving Cut'], w: ['Battle Focus', 'Iron Guard'], e: ['Spear Sweep', 'Charge'], r: ['Dharma Strike', 'Final Verdict'] },
  cosmic: { q: ['Star Shard', 'Astral Bolt'], w: ['Cosmic Clarity', 'Timeline Step'], e: ['Orbit Collapse', 'Nova Ring'], r: ['Cosmic Vision', 'All Timelines at Once'] },
  mind: { q: ['Rune Word', 'Glyph Bolt'], w: ['Insight', 'Read the Pattern'], e: ['Glyph Field', 'Binding Text'], r: ['Unwritten Sutra', 'Final Lesson'] },
  nature: { q: ['Thorn Shot', 'Petal Dart'], w: ['Bloom', 'Rootward Peace'], e: ['Lotus Ring', 'Vine Snare'], r: ['Lotus Awakening', 'World Garden'] },
  storm: { q: ['Storm Spark', 'Rain Dart'], w: ['Second Wind', 'Tide Guard'], e: ['Thunder Ring', 'Undertow'], r: ['Heaven’s Gate', 'Great Wave'] },
  song: { q: ['Resonant Note', 'Sound Lance'], w: ['Harmony', 'Encore'], e: ['Dissonance', 'Dance Ring'], r: ['Song of the Spheres', 'Final Chorus'] },
  shadow: { q: ['Grave Bolt', 'Spirit Cut'], w: ['Shroud', 'Ancestor’s Whisper'], e: ['Yomi Gate', 'Soul Snare'], r: ['Threshold Walk', 'Last Rite'] },
  beast: { q: ['Claw Rush', 'Feral Strike'], w: ['Beast Vigour', 'Pounce'], e: ['Stampede Ring', 'Wing Buffet'], r: ['Avatar of Strength', 'Sky Leap'] },
};

/** Čísla podle školy a slotu — Q je slabé a rychlé, R je finisher. */
const SCHOOL_BASE: Record<SpellSchool, { q: number; w: number; e: number; r: number }> = {
  ward: { q: 42, w: 0, e: 34, r: 60 },
  fire: { q: 52, w: 0, e: 46, r: 90 },
  arrow: { q: 58, w: 0, e: 40, r: 86 },
  blade: { q: 54, w: 0, e: 44, r: 82 },
  cosmic: { q: 48, w: 0, e: 42, r: 96 },
  mind: { q: 44, w: 0, e: 38, r: 78 },
  nature: { q: 40, w: 24, e: 36, r: 74 },
  storm: { q: 46, w: 0, e: 40, r: 88 },
  song: { q: 44, w: 20, e: 36, r: 80 },
  shadow: { q: 50, w: 0, e: 44, r: 92 },
  beast: { q: 52, w: 20, e: 40, r: 84 },
};

// ── aspekty (dva způsoby, jak hrát stejnou školu) ────────────────────
//
// Každá postava má od 2026-11-04 **volbu před zápasem**: ostrou, nebo
// ochrannou variantu svých kouzel. Nejde o buff — obě varianty jsou
// obchod: `a` bere obranu za poškození, `b` obranu za poškození.
// Kdyby jedna byla lepší, výběr by nebyl volba, ale kontrola znalosti.

export type AspectId = 'a' | 'b';

export interface AspectDef {
  id: AspectId;
  name: { cs: string; en: string };
  note: { cs: string; en: string };
  damage: number;
  shield: number;
  heal: number;
  radius: number;
  cooldown: number;
}

/** Názvy jsou per škola — „Žár" u ohně, „Příliv" u bouře. Čísla jsou dvě. */
const ASPECT_NAMES: Record<SpellSchool, { a: { cs: string; en: string }; b: { cs: string; en: string } }> = {
  ward: { a: { cs: 'Světlo štítu', en: 'Shield Light' }, b: { cs: 'Tichá pevnost', en: 'Silent Keep' } },
  fire: { a: { cs: 'Žár', en: 'Blaze' }, b: { cs: 'Popel', en: 'Embers' } },
  arrow: { a: { cs: 'Ostrostřelec', en: 'Deadeye' }, b: { cs: 'Lovec v záloze', en: 'Lurking Hunter' } },
  blade: { a: { cs: 'Ostří', en: 'Edge' }, b: { cs: 'Stěna', en: 'Wall' } },
  cosmic: { a: { cs: 'Hvězdný jas', en: 'Starlight' }, b: { cs: 'Tichý obzor', en: 'Silent Horizon' } },
  mind: { a: { cs: 'Jasný výklad', en: 'Clear Reading' }, b: { cs: 'Trpělivý text', en: 'Patient Text' } },
  nature: { a: { cs: 'Trn', en: 'Thorn' }, b: { cs: 'Kořen', en: 'Root' } },
  storm: { a: { cs: 'Blesk', en: 'Bolt' }, b: { cs: 'Příliv', en: 'Tide' } },
  song: { a: { cs: 'Prudké tóny', en: 'Sharp Tones' }, b: { cs: 'Držený akord', en: 'Held Chord' } },
  shadow: { a: { cs: 'Ostrý stín', en: 'Sharp Shade' }, b: { cs: 'Hluboký stín', en: 'Deep Shade' } },
  beast: { a: { cs: 'Spár', en: 'Claw' }, b: { cs: 'Kůže a kost', en: 'Hide and Bone' } },
};

const ASPECT_NOTES = {
  a: { cs: '+14 % poškození, −20 % štítu a léčení', en: '+14% damage, −20% shield and healing' },
  b: { cs: '−12 % poškození, +35 % štítu a léčení', en: '−12% damage, +35% shield and healing' },
} as const;

export function aspectById(school: SpellSchool, id: AspectId): AspectDef {
  const names = ASPECT_NAMES[school];
  return id === 'b'
    ? { id: 'b', name: names.b, note: ASPECT_NOTES.b, damage: 0.88, shield: 1.35, heal: 1.35, radius: 1.1, cooldown: 1.04 }
    : { id: 'a', name: names.a, note: ASPECT_NOTES.a, damage: 1.14, shield: 0.8, heal: 0.8, radius: 0.94, cooldown: 0.96 };
}

/** Obě volby pro školu — pick screen je vypíše vedle sebe. */
export function aspectsFor(school: SpellSchool): [AspectDef, AspectDef] {
  return [aspectById(school, 'a'), aspectById(school, 'b')];
}

/** Škola postavy (bez stavby kouzel) — pick screen ji potřebuje dřív. */
export function schoolOfAvatar(id: number): SpellSchool {
  const entry: AvatarEntry | undefined = AVATARS_BY_ID.get(id);
  return schoolOf(`${entry?.subtitle ?? ''} ${entry?.name ?? ''}`);
}

function pick<T>(random: () => number, list: T[], fallback: T): T {
  return list[Math.floor(random() * list.length) % list.length] ?? fallback;
}

/**
 * Sada kouzel pro postavu. `ability` je kanonický název schopnosti —
 * z něj plyne školy i jméno ultimátky.
 */
export function spellsFor(id: number, color: string, aspect: AspectId = 'a'): Spell[] {
  const entry: AvatarEntry | undefined = AVATARS_BY_ID.get(id);
  const random = seededRandom(id);
  const text = `${entry?.subtitle ?? ''} ${entry?.name ?? ''}`;
  const school = schoolOf(text);
  const base = SCHOOL_BASE[school];
  const names = NAME_PARTS[school];
  const cl = entry?.cl ?? 3;
  const scale = 0.85 + cl * 0.05;

  const spell = (
    slot: SpellSlot,
    name: string,
    kind: SpellKind,
    damage: number,
    cooldownMs: number,
    mana: number,
    overrides: Partial<Spell> = {},
  ): Spell => ({
    slot,
    name,
    school,
    kind,
    damage: Math.round(damage * scale),
    shield: 0,
    heal: 0,
    slow: 0,
    slowMs: 0,
    range: 10,
    radius: 1.6,
    speed: 0,
    cooldownMs,
    mana,
    color,
    ...overrides,
  });

  const kit = [
    spell('Q', pick(random, names.q, names.q[0]!), 'projectile', base.q, 3200, 30, {
      range: 12,
      radius: 1.1,
      speed: 22,
    }),
    spell(
      'W',
      pick(random, names.w, names.w[0]!),
      school === 'beast' ? 'dash' : 'buff',
      base.w,
      9000,
      45,
      {
        range: 0,
        shield: school === 'ward' ? 90 + cl * 8 : 40 + cl * 4,
        heal: school === 'nature' || school === 'song' ? 70 + cl * 6 : 0,
        slow: 0,
      },
    ),
    spell('E', pick(random, names.e, names.e[0]!), 'aoe', base.e, 7000, 55, {
      range: 9,
      radius: 3.2,
      slow: school === 'storm' || school === 'shadow' ? 0.35 : 0.2,
      slowMs: 1800,
      speed: 0,
    }),
    spell('R', pick(random, names.r, names.r[0]!), 'aoe', base.r, 45000, 100, {
      range: 13,
      radius: 4.6,
      slow: 0.45,
      slowMs: 2400,
      speed: 0,
    }),
  ];

  // Aspekt je **jeden násobek na celou sadu** — kdyby se aplikoval po
  // kouzlech, rozešly by se hodnoty v HUD (klient počítá stejnou funkcí).
  const def = aspectById(school, aspect);
  return kit.map((entry) => ({
    ...entry,
    damage: Math.round(entry.damage * def.damage),
    shield: Math.round(entry.shield * def.shield),
    heal: Math.round(entry.heal * def.heal),
    radius: Math.round(entry.radius * def.radius * 100) / 100,
    cooldownMs: Math.round(entry.cooldownMs * def.cooldown),
  }));
}

/** Kouzla pro konkrétní postavu včetně palety (barva VFX) a aspektu. */
export function spellsForAvatar(id: number, aspect: AspectId = 'a'): Spell[] {
  return spellsFor(id, avatarLook(id).palette.glow, aspect);
}

export const SPELL_SLOTS: SpellSlot[] = ['Q', 'W', 'E', 'R'];

/**
 * Stupeň kouzla z úrovně hrdiny — malá hra, žádné skill pointy (model HotS).
 *
 * Q/W/E: 1. stupeň od 1. úrovně, dál na 4., 7. a 10.
 * R (ultimátka): odemčená na 6. úrovni, dál na 11. a 15.
 *
 * Klient si stupeň počítá **stejnou funkcí** ze snapshotu (`level`), takže se
 * nemusí posílat v protokolu — a nemůže se rozejít se serverem.
 */
export function spellRank(level: number, slot: SpellSlot): number {
  if (slot === 'R') return level >= 15 ? 3 : level >= 11 ? 2 : level >= 6 ? 1 : 0;
  return Math.max(1, Math.min(4, 1 + Math.floor((level - 1) / 3)));
}

/** +22 % k síle kouzla za každý stupeň nad prvním. */
export const SPELL_RANK_SCALE = 0.22;

/**
 * Mana a cooldown podle stupně — **počítá to klient i server stejnou funkcí**,
 * takže HUD neukazuje jiné číslo, než jaké sim opravdu strhne.
 * Mana roste (+15 %/stupeň), cooldown klesá (−7 %/stupeň).
 */
export function spellMana(baseMana: number, rank: number): number {
  return Math.round(baseMana * (1 + 0.15 * Math.max(0, rank - 1)));
}

export function spellCooldown(baseCooldownMs: number, rank: number): number {
  return Math.round(baseCooldownMs * (1 - 0.07 * Math.max(0, rank - 1)));
}

// ── mechanické rozdíly škol ───────────────────────────────────────────
//
// Do 2. 11. 2026 se všech 11 škol chovalo stejně (dmg + shield + heal +
// slow), takže hrdinové splývali — rozhodovalo jen id, ne kánon. Níž je
// každá škola jiná **mechanikou**, ne jen číslem.
//
// Všechno se počítá v `sim.ts` (jeden zdroj pravdy pro sólo i server).
// Klient dostane výsledek ve snapshotu (buffy) — sám nic nepočítá.

export interface SchoolTraits {
  /** Podíl poškození jako hoření na 3 s (oheň). */
  burn?: number;
  /** Projektil projde skrz první cíl (šíp). */
  pierce?: boolean;
  /** Podíl poškození na druhý cíl do 6 m od zásahu (bouře). */
  chain?: number;
  /** Násobek poškození proti cílům pod `executeBelow` (čepel, stín). */
  execute?: number;
  executeBelow?: number;
  /** Podíl štítu dostane i nejbližší spojenec do 8 m (ward). */
  allyShield?: number;
  /** Podíl many, který W vrátí (kosmické). */
  manaSurge?: number;
  /** Léčení rozložené do 4 s místo naráz (příroda, píseň). */
  healOverTime?: boolean;
  /** Podíl nepřátelského štítu, který zásah strhne (mysl). */
  shieldBreak?: number;
  /** Násobek poloměru dopadu u dash kouzla (bestie). */
  dashRadius?: number;
}

export const SCHOOL_TRAITS: Record<SpellSchool, SchoolTraits> = {
  ward: { allyShield: 0.6 },
  fire: { burn: 0.4 },
  arrow: { pierce: true },
  blade: { execute: 0.45, executeBelow: 0.35 },
  cosmic: { manaSurge: 0.25 },
  mind: { shieldBreak: 0.7 },
  nature: { healOverTime: true },
  storm: { chain: 0.5 },
  song: { healOverTime: true, allyShield: 0.35 },
  shadow: { execute: 0.6, executeBelow: 0.4 },
  beast: { dashRadius: 1.7 },
};

/**
 * Krátký popis mechaniky pro HUD. Hráč nemá číst zdroják, aby zjistil,
 * že jeho oheň pálí a ward kryje spojence.
 */
export const SCHOOL_LABEL: Record<SpellSchool, { cs: string; en: string }> = {
  ward: { cs: 'štít i pro spojence', en: 'shields an ally too' },
  fire: { cs: 'spálí (hoření 3 s)', en: 'burns over 3 s' },
  arrow: { cs: 'prolétne skrz', en: 'pierces through' },
  blade: { cs: 'doráží zraněné', en: 'executes the wounded' },
  cosmic: { cs: 'vrací manu', en: 'restores mana' },
  mind: { cs: 'strhne štít', en: 'strips shields' },
  nature: { cs: 'léčí postupně', en: 'heals over time' },
  storm: { cs: 'řetězí na druhý cíl', en: 'chains to a second target' },
  song: { cs: 'léčí a štítí', en: 'heals and shields' },
  shadow: { cs: 'popraví zraněné', en: 'executes the wounded' },
  beast: { cs: 'skok do šířky', en: 'wide leap' },
};
