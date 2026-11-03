/**
 * MOBA „PRVNÍ SVĚT" — simulace.
 *
 * Server i klient počítají **tentýž kód** (pravidlo z arény): klient posílá
 * jen vstup a sim rozhoduje o poškození, smrti i vítězství. Kdyby klient
 * počítal zásahy sám, hráč by viděl jiné číslo, než jaké dostal soupeř.
 *
 * Co hra obsahuje: tři linky, vlny minionů, věže, Nexy, tři uzly L5
 * (převzetí = bonus k poškození) a **čtyři kouzla na postavu** z kánonu
 * (`spells.ts`). Co záměrně není: obchod, itemy, úrovně kouzel, mlha války,
 * multiplayer — to jsou další vrstvy, ne nedodělky.
 */

import { AVATARS_BY_ID } from '../avatars/catalog';
import { avatarLook } from '../avatars/kit';
import { SCHOOL_TRAITS, SPELL_RANK_SCALE, spellCooldown, spellMana, spellRank, spellsFor, type Spell, type SpellSchool, type SpellSlot } from './spells';
import {
  BOSS_BASE_DAMAGE,
  BOSS_BASE_HP,
  BOSS_DAMAGE_PER_MIN,
  BOSS_HP_PER_MIN,
  BOSS_RESPAWN_MS,
  BOSS_SPOT,
  BUSH_REVEAL,
  bushAt,
  INHIBITOR_RESPAWN_MS,
  JUNGLE_CAMPS,
  LANES,
  MAP_HALF_X,
  MAP_HALF_Z,
  MATCH_SECONDS,
  MINION_ATTACK_MS,
  MINION_DAMAGE,
  MINION_HP,
  MINION_RANGE,
  MINION_SPEED,
  NODE_BONUS_PER_SITE,
  NODE_CAPTURE_MS,
  NODE_SITES,
  RUNE_INTERVAL_MS,
  RUNE_PICKUP_RANGE,
  RUNE_SPOTS,
  SPAWNS,
  STRUCTURES,
  VISION,
  WAVE_INTERVAL_MS,
  WAVE_SIZE,
  isStructureProtected,
  type JungleCamp,
  type RuneType,
  type LaneId,
  type StructureHp,
  type Team,
} from './map';

export type UnitKind = 'hero' | 'minion' | 'tower' | 'nexus' | 'monster';

export type BuffType = 'strength' | 'ward' | 'speed' | 'ancient' | 'burn' | 'regen' | 'invisible';

export interface Buff {
  type: BuffType;
  until: number;
  power: number;
  /** Kdo buff způsobil (hoření) — kvůli připsání zabití. */
  source?: string;
}

/**
 * Itemy (F2) — základní komponenty + složené z receptů.
 *
 * Bonusy se **sčítají** přes všechny itemy hrdiny (`itemTotals`), takže
 * přidání itemu nikde neznamená novou větev v sim. Efekty držíme na pár
 * číslech (poškození, obrana, HP, mana, rychlost, regenerace, vidění) —
 * dost na to, aby šlo hrát „na build", a dost málo na to, aby se to dalo
 * vybalancovat.
 */
export type ItemId =
  // základ
  | 'blade'
  | 'fang'
  | 'aegis'
  | 'cloak'
  | 'boots'
  | 'rune'
  // složené
  | 'warblade'
  | 'bulwark'
  | 'windsoles'
  | 'lotus'
  | 'eye'
  | 'ember'
  | 'scepter'
  | 'crown'
  // aktivní
  | 'blink'
  | 'barrier'
  | 'dust'
  | 'surge'
  | 'veil'
  // spotřební
  | 'ward'
  | 'sentry';

export interface ItemBonus {
  /** Multiplikativní bonus k poškození (0.25 = +25 %). */
  damage?: number;
  /** Snížení příchozího poškození (0.10 = −10 %). */
  armor?: number;
  hp?: number;
  mana?: number;
  /** Multiplikativní bonus k rychlosti. */
  speed?: number;
  /** Regenerace HP za sekundu. */
  regen?: number;
  /** Bonus k vidění v metrech. */
  vision?: number;
}

export interface MobaItem {
  id: ItemId;
  name: { cs: string; en: string };
  cost: number;
  note: { cs: string; en: string };
  /** Komponenty se při nákupu spotřebují (odečte se jejich cena). */
  components?: ItemId[];
  bonus: ItemBonus;
  /** Spotřební item — nezabírá slot, kupuje se do zásoby (ward). */
  consumable?: boolean;
  /** Aktivní schopnost itemu (klávesa 1–6). */
  active?: ItemActive;
}

export type ItemActiveKind = 'blink' | 'shield' | 'heal' | 'haste' | 'invisible';

export interface ItemActive {
  kind: ItemActiveKind;
  cooldownMs: number;
  /** Síla podle druhu: metry (blink), štít/HP (shield/heal), podíl (haste). */
  power: number;
  /** Trvání efektu (u neviditelnosti); jinde se bere z power. */
  durationMs?: number;
}

/** Kolik itemů se vejde hrdinovi do inventáře. */
export const ITEM_SLOTS = 6;
/** Kolik z ceny dostaneš zpět při prodeji. */
export const SELL_RATIO = 0.6;

// ── wardy a buyback (F5) ──────────────────────────────────────────
export const WARD_DURATION_MS = 90_000;
export const WARD_VISION = 10;
export const WARD_RANGE = 12;
export const WARD_STOCK_MAX = 3;
export const SENTRY_STOCK_MAX = 2;
export const SENTRY_RADIUS = 8;
export const SENTRY_DURATION_MS = 60_000;
export const SENTRY_RANGE = 14;
export const BUYBACK_BASE = 200;
export const BUYBACK_PER_LEVEL = 50;
export const BUYBACK_COOLDOWN_MS = 180_000;
export const BUYBACK_HP_RATIO = 0.6;
export const RESPAWN_BASE_MS = 5000;
export const RESPAWN_PER_LEVEL_MS = 1500;

/** Cena buybacku — roste s levely, aby se nevyplatil pořád. */
export function buybackCost(hero: Hero): number {
  return BUYBACK_BASE + hero.level * BUYBACK_PER_LEVEL;
}

export const ITEMS: MobaItem[] = [
  // ── základ ──────────────────────────────────────────────────────
  {
    id: 'blade',
    name: { cs: 'Čepel', en: 'Blade' },
    cost: 400,
    note: { cs: '+25 % poškození', en: '+25% damage' },
    bonus: { damage: 0.25 },
  },
  {
    id: 'fang',
    name: { cs: 'Tesák', en: 'Fang' },
    cost: 300,
    note: { cs: '+12 % poškození', en: '+12% damage' },
    bonus: { damage: 0.12 },
  },
  {
    id: 'aegis',
    name: { cs: 'Aegis', en: 'Aegis' },
    cost: 400,
    note: { cs: '+250 max HP, −10 % příchozího poškození', en: '+250 max HP, −10% incoming damage' },
    bonus: { hp: 250, armor: 0.1 },
  },
  {
    id: 'cloak',
    name: { cs: 'Plášť', en: 'Cloak' },
    cost: 500,
    note: { cs: '−12 % příchozího poškození', en: '−12% incoming damage' },
    bonus: { armor: 0.12 },
  },
  {
    id: 'boots',
    name: { cs: 'Sandály', en: 'Boots' },
    cost: 400,
    note: { cs: '+15 % rychlosti', en: '+15% movement speed' },
    bonus: { speed: 0.15 },
  },
  {
    id: 'rune',
    name: { cs: 'Runový kámen', en: 'Rune Stone' },
    cost: 350,
    note: { cs: '+150 max manу', en: '+150 max mana' },
    bonus: { mana: 150 },
  },
  // ── složené ─────────────────────────────────────────────────────
  {
    id: 'warblade',
    name: { cs: 'Válečná čepel', en: 'Warblade' },
    cost: 1100,
    note: { cs: '+45 % poškození (Čepel + Tesák)', en: '+45% damage (Blade + Fang)' },
    components: ['blade', 'fang'],
    bonus: { damage: 0.45 },
  },
  {
    id: 'bulwark',
    name: { cs: 'Bašta', en: 'Bulwark' },
    cost: 1350,
    note: { cs: '+450 max HP, −24 % příchozího (Aegis + Plášť)', en: '+450 max HP, −24% incoming (Aegis + Cloak)' },
    components: ['aegis', 'cloak'],
    bonus: { hp: 450, armor: 0.24 },
  },
  {
    id: 'windsoles',
    name: { cs: 'Větrné sandály', en: 'Windsoles' },
    cost: 1150,
    note: { cs: '+25 % rychlosti, +150 many (Sandály + Runa)', en: '+25% speed, +150 mana (Boots + Rune)' },
    components: ['boots', 'rune'],
    bonus: { speed: 0.25, mana: 150 },
  },
  {
    id: 'lotus',
    name: { cs: 'Lotosový štít', en: 'Lotus Shield' },
    cost: 700,
    note: { cs: '+200 max HP, regenerace 4 HP/s', en: '+200 max HP, 4 HP/s regen' },
    bonus: { hp: 200, regen: 4 },
  },
  {
    id: 'eye',
    name: { cs: 'Orlí oko', en: 'Eagle Eye' },
    cost: 550,
    note: { cs: '+6 m vidění (proti mlze)', en: '+6 m vision (against fog)' },
    bonus: { vision: 6 },
  },
  {
    id: 'ember',
    name: { cs: 'Žhavý uhlík', en: 'Ember' },
    cost: 600,
    note: { cs: '+18 % poškození, +8 % rychlosti', en: '+18% damage, +8% speed' },
    bonus: { damage: 0.18, speed: 0.08 },
  },
  {
    id: 'scepter',
    name: { cs: 'Žezlo', en: 'Scepter' },
    cost: 1400,
    note: { cs: '+25 % poškození, +300 many (Runa + Uhlík)', en: '+25% damage, +300 mana (Rune + Ember)' },
    components: ['rune', 'ember'],
    bonus: { damage: 0.25, mana: 300 },
  },
  {
    id: 'crown',
    name: { cs: 'Koruna', en: 'Crown' },
    cost: 1400,
    note: { cs: '+30 % poškození, +300 max HP', en: '+30% damage, +300 max HP' },
    bonus: { damage: 0.3, hp: 300 },
  },
  // ── aktivní ─────────────────────────────────────────────────────
  {
    id: 'blink',
    name: { cs: 'Skok', en: 'Blink' },
    cost: 900,
    note: { cs: 'aktivní (1–6): skok až 7 m · 12 s', en: 'active (1–6): blink up to 7 m · 12 s' },
    bonus: {},
    active: { kind: 'blink', cooldownMs: 12_000, power: 7 },
  },
  {
    id: 'barrier',
    name: { cs: 'Bariéra', en: 'Barrier' },
    cost: 700,
    note: { cs: 'aktivní (1–6): +300 štítu na 4 s · 20 s', en: 'active (1–6): +300 shield for 4 s · 20 s' },
    bonus: {},
    active: { kind: 'shield', cooldownMs: 20_000, power: 300 },
  },
  {
    id: 'dust',
    name: { cs: 'Léčivý prach', en: 'Healing Dust' },
    cost: 600,
    note: { cs: 'aktivní (1–6): +250 HP · 25 s', en: 'active (1–6): +250 HP · 25 s' },
    bonus: {},
    active: { kind: 'heal', cooldownMs: 25_000, power: 250 },
  },
  {
    id: 'surge',
    name: { cs: 'Příval', en: 'Surge' },
    cost: 650,
    note: { cs: 'aktivní (1–6): +40 % rychlosti na 4 s · 18 s', en: 'active (1–6): +40% speed for 4 s · 18 s' },
    bonus: {},
    active: { kind: 'haste', cooldownMs: 18_000, power: 0.4 },
  },
  {
    id: 'veil',
    name: { cs: 'Závoj', en: 'Veil' },
    cost: 800,
    note: { cs: 'aktivní (1–6): neviditelnost na 6 s · 30 s', en: 'active (1–6): invisibility for 6 s · 30 s' },
    bonus: {},
    active: { kind: 'invisible', cooldownMs: 30_000, power: 0, durationMs: 6000 },
  },
  // ── spotřební ───────────────────────────────────────────────────
  {
    id: 'sentry',
    name: { cs: 'Strážné oko', en: 'Sentry' },
    cost: 120,
    note: { cs: '+1 sentry (max 2) — odhalí neviditelné do 8 m na 60 s', en: '+1 sentry (max 2) — reveals invisible within 8 m for 60 s' },
    bonus: {},
    consumable: true,
  },
  {
    id: 'ward',
    name: { cs: 'Strážný kámen', en: 'Ward' },
    cost: 150,
    note: { cs: '+1 strážce (max 3) — vidění 10 m na 90 s', en: '+1 ward (max 3) — 10 m vision for 90 s' },
    bonus: {},
    consumable: true,
  },
];

const ITEM_BY_ID = new Map(ITEMS.map((item) => [item.id, item]));

/** Součet bonusů všech itemů hrdiny — jedno místo, odkud čtou všichni. */
export function itemTotals(items: ItemId[]): Required<ItemBonus> {
  const total: Required<ItemBonus> = { damage: 0, armor: 0, hp: 0, mana: 0, speed: 0, regen: 0, vision: 0 };
  for (const id of items) {
    const bonus = ITEM_BY_ID.get(id)?.bonus;
    if (!bonus) continue;
    total.damage += bonus.damage ?? 0;
    total.armor += bonus.armor ?? 0;
    total.hp += bonus.hp ?? 0;
    total.mana += bonus.mana ?? 0;
    total.speed += bonus.speed ?? 0;
    total.regen += bonus.regen ?? 0;
    total.vision += bonus.vision ?? 0;
  }
  return total;
}

/** Základní rychlost hrdiny (m/s) — stejné číslo používá klientská predikce. */
export const BASE_SPEED = 6.2;


// ── Ekonomika (F1) — viz docs/3.3/MOBA-PRVNI-SVET-PLAN.md ─────────
//
// Bez pasivního zlata nemá prohrávající linka cestu zpět; bez sdíleného XP
// je hra o jednom hrdinovi. Čísla jsou zmenšená na 8minutový zápas, ale
// poměry drží standard: last hit > asistence, smrt něco stojí, věž platí.
export const GOLD_CAP = 9999;
export const PASSIVE_GOLD_PER_SEC = 2;
export const MINION_GOLD = 24;
export const MINION_XP = 26;
/** Kdo je v tomto okruhu, dostane XP (a asistencia zlato). */
export const XP_SHARE_RADIUS = 14;
/** Spojenci (ne zabiják) dostanou tuhle část XP. */
export const XP_ALLY_RATIO = 0.5;
/** Vlastní minion pod tímhle podílem HP jde dorazit (deny). */
export const DENY_HP_RATIO = 0.5;
export const ASSIST_GOLD_RATIO = 0.4;
export const GOLD_LOSS_RATIO = 0.1;
export const GOLD_LOSS_CAP = 200;
export const TOWER_GOLD_TEAM = 120;
export const TOWER_GOLD_LASTHIT = 60;
export const TOWER_XP = 120;
export const HERO_BOUNTY = 180;
export const HERO_KILL_XP = 140;
export const ASSIST_KILL_XP = 70;

/** XP potřebné na další level — jedno místo pro sim i HUD. */
export const xpNeeded = (level: number) => 120 + level * 70;

/** Celkové XP nasbírané na daném levelu (pro XPM ve scoreboardu). */
export const totalXpAt = (level: number, xp: number) => {
  let total = xp;
  for (let current = 1; current < level; current += 1) total += xpNeeded(current);
  return total;
};

// ── obtížnost botů (F6) ───────────────────────────────────────────
//
// Obtížnost mění **jen rozhodování** (přesnost, kadence, ochota ustoupit),
// nikdy poškození — jinak by „hard" znamenal jinou hru, ne lepší soupeře.
export type BotSkill = 'easy' | 'normal' | 'hard';

export const BOT_SKILLS: Record<
  BotSkill,
  { aimError: number; castDelay: number; retreatHp: number }
> = {
  easy: { aimError: 3.2, castDelay: 1100, retreatHp: 0.3 },
  normal: { aimError: 1.4, castDelay: 450, retreatHp: 0.55 },
  hard: { aimError: 0.45, castDelay: 120, retreatHp: 0.72 },
};

/**
 * Rychlost podle itemů, buffů a zpomalení.
 *
 * `now` je **simulační čas** (`state.now`), ne `Date.now()` — buffy se ukládají
 * v sim hodinách, takže reálné hodiny je vždycky považovaly za propadlé
 * (rychlostní buffy z run a Přívalu proto nikdy nefungovaly).
 */
// ── talenty (F8) ──────────────────────────────────────────────────
//
// Dvě volby za zápas (10. a 15. úroveň) podle archetypu kouzel. Efekty se
// sčítají stejně jako itemy (`talentTotals`), takže nový talent není nová
// větev v sim — jen další číslo do součtu.

export type TalentRole = 'aggressive' | 'support' | 'control';

export interface TalentEffect {
  damage?: number;
  hp?: number;
  mana?: number;
  speed?: number;
  vision?: number;
  spellPower?: number;
  regen?: number;
}

export interface Talent {
  id: string;
  name: { cs: string; en: string };
  note: { cs: string; en: string };
  effect: TalentEffect;
}

/** Stupně, na kterých se talent volí. */
export const TALENT_TIERS = [10, 15] as const;

export const TALENTS: Record<TalentRole, Record<number, [Talent, Talent]>> = {
  aggressive: {
    10: [
      { id: 'edge', name: { cs: 'Ostří čepele', en: 'Blade Edge' }, note: { cs: '+12 % poškození', en: '+12% damage' }, effect: { damage: 0.12 } },
      { id: 'stride', name: { cs: 'Bojový krok', en: 'Battle Stride' }, note: { cs: '+8 % rychlosti', en: '+8% speed' }, effect: { speed: 0.08 } },
    ],
    15: [
      { id: 'executioner', name: { cs: 'Kat', en: 'Executioner' }, note: { cs: '+20 % poškození', en: '+20% damage' }, effect: { damage: 0.2 } },
      { id: 'warpath', name: { cs: 'Válečná stezka', en: 'Warpath' }, note: { cs: '+12 % dmg, +6 % rychlosti', en: '+12% dmg, +6% speed' }, effect: { damage: 0.12, speed: 0.06 } },
    ],
  },
  support: {
    10: [
      { id: 'spring', name: { cs: 'Životní pramen', en: 'Life Spring' }, note: { cs: '+250 max HP', en: '+250 max HP' }, effect: { hp: 250 } },
      { id: 'focus', name: { cs: 'Soustředění', en: 'Focus' }, note: { cs: '+15 % síly kouzel', en: '+15% spell power' }, effect: { spellPower: 0.15 } },
    ],
    15: [
      { id: 'wellspring', name: { cs: 'Pramen života', en: 'Wellspring' }, note: { cs: '+400 HP, +3 HP/s', en: '+400 HP, +3 HP/s' }, effect: { hp: 400, regen: 3 } },
      { id: 'radiance', name: { cs: 'Záře', en: 'Radiance' }, note: { cs: '+25 % síly kouzel', en: '+25% spell power' }, effect: { spellPower: 0.25 } },
    ],
  },
  control: {
    10: [
      { id: 'farsight', name: { cs: 'Daleký zrak', en: 'Farsight' }, note: { cs: '+5 m vidění', en: '+5 m vision' }, effect: { vision: 5 } },
      { id: 'reservoir', name: { cs: 'Hluboká studna', en: 'Deep Reservoir' }, note: { cs: '+200 many', en: '+200 mana' }, effect: { mana: 200 } },
    ],
    15: [
      { id: 'oracle', name: { cs: 'Věštba', en: 'Oracle' }, note: { cs: '+8 m vidění, +5 % dmg', en: '+8 m vision, +5% damage' }, effect: { vision: 8, damage: 0.05 } },
      { id: 'deepwell', name: { cs: 'Bezedná studna', en: 'Bottomless Well' }, note: { cs: '+350 many, +15 % síly kouzel', en: '+350 mana, +15% spell power' }, effect: { mana: 350, spellPower: 0.15 } },
    ],
  },
};

/** Archetyp z první školy kouzel — stejné rozdělení jako `SCHOOL_TRAITS`. */
export function talentRole(school: SpellSchool): TalentRole {
  if (school === 'ward' || school === 'nature' || school === 'song') return 'support';
  if (school === 'cosmic' || school === 'mind') return 'control';
  return 'aggressive';
}

export function talentsFor(school: SpellSchool): Record<number, [Talent, Talent]> {
  return TALENTS[talentRole(school)];
}

/** Součet efektů vybraných talentů (analogie `itemTotals`). */
export function talentTotals(hero: Hero): Required<TalentEffect> {
  const total: Required<TalentEffect> = { damage: 0, hp: 0, mana: 0, speed: 0, vision: 0, spellPower: 0, regen: 0 };
  const school = hero.spells?.[0]?.school ?? 'cosmic';
  const options = talentsFor(school);
  for (const [tierRaw, pick] of Object.entries(hero.talentPicks)) {
    const tier = Number(tierRaw);
    const talent = options[tier]?.[pick];
    if (!talent) continue;
    total.damage += talent.effect.damage ?? 0;
    total.hp += talent.effect.hp ?? 0;
    total.mana += talent.effect.mana ?? 0;
    total.speed += talent.effect.speed ?? 0;
    total.vision += talent.effect.vision ?? 0;
    total.spellPower += talent.effect.spellPower ?? 0;
    total.regen += talent.effect.regen ?? 0;
  }
  return total;
}

/** Nejbližší nevybraný talent (10, pak 15) — null = hráč má vše. */
export function pendingTalent(hero: Hero): number | null {
  for (const tier of TALENT_TIERS) {
    if (hero.level >= tier && hero.talentPicks[tier] === undefined) return tier;
  }
  return null;
}

/** Volba talentu — vrací false, když na ni hrdina ještě nemá nárok. */
export function pickTalent(hero: Hero, tier: number, pick: number): boolean {
  if (!TALENT_TIERS.includes(tier as (typeof TALENT_TIERS)[number])) return false;
  if (pick !== 0 && pick !== 1) return false;
  if (pendingTalent(hero) !== tier) return false;
  hero.talentPicks[tier] = pick;
  recomputeHeroStats(hero);
  return true;
}

export function heroSpeed(
  hero: { items: ItemId[]; slowFactor: number; buffs?: Buff[] },
  now = Date.now(),
): number {
  const talents = 'talentPicks' in hero ? talentTotals(hero as Hero) : { speed: 0 } as Required<TalentEffect>;
  let speed = BASE_SPEED * (1 + itemTotals(hero.items).speed + talents.speed) * (1 - hero.slowFactor);
  for (const buff of hero.buffs ?? []) {
    if (buff.until > now && buff.type === 'speed') speed *= 1 + buff.power;
  }
  return speed;
}

export interface Hero {
  id: string;
  team: Team;
  heroId: number;
  name: string;
  kind: 'hero';
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  level: number;
  xp: number;
  alive: boolean;
  respawnAt: number;
  shield: number;
  shieldUntil: number;
  slowUntil: number;
  slowFactor: number;
  /** Základní maxima před itemy — maxima se dopočítávají (`recomputeHeroStats`). */
  baseMaxHp: number;
  baseMaxMana: number;
  spells: Spell[];
  cooldowns: Record<SpellSlot, number>;
  attackCooldown: number;
  facing: number;
  kills: number;
  deaths: number;
  damageDone: number;
  healingDone: number;
  /** Zlato ze zabití a uzlu; za něj se kupují itemy. */
  gold: number;
  /** Aegis z bosse — jednorázové vzkříšení (spotřebuje se při smrti). */
  aegis: boolean;
  /** Kolik wardů má v zásobě (spotřební item, nezabírá slot). */
  wards: number;
  /** Kolik sentry očí má v zásobě. */
  sentries: number;
  /** Kdy půjde aktivní item znovu použít (sim čas per item). */
  itemCooldowns: Partial<Record<ItemId, number>>;
  /** Vybrané talenty: tier (10/15) → index volby. */
  talentPicks: Record<number, number>;
  /** Kdy může hrdina znovu buybackovat (ms, sim čas). */
  buybackAt: number;
  items: ItemId[];
  buffs: Buff[];
  isPlayer: boolean;
  /** Kam se bot zrovna dívá / kam jde (jen pro AI). */
  botLane: LaneId;
  botCast: { slot: SpellSlot; x: number; z: number } | null;
  /** Kdy může bot znovu seslat (kadence podle obtížnosti). */
  botNextCast: number;
  /** Kolik kouzel bot seslal (diagnostika obtížnosti, neposílá se). */
  botCasts: number;
}

export interface Minion {
  id: string;
  team: Team;
  lane: LaneId;
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  damage: number;
  range: number;
  attackMs: number;
  speed: number;
  /** Super minion — spawne se, když padne nepřátelský inhibitor v lince. */
  super: boolean;
  cooldown: number;
}

export interface Tower {
  id: string;
  team: Team;
  kind: 'tower' | 'nexus' | 'inhibitor';
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  range: number;
  damage: number;
  attackMs: number;
  cooldown: number;
  /** Inhibitor po zničení vyroste znovu (`INHIBITOR_RESPAWN_MS`). */
  respawnAt: number;
}

export interface Projectile {
  id: string;
  team: Team;
  x: number;
  z: number;
  dx: number;
  dz: number;
  speed: number;
  radius: number;
  damage: number;
  ttl: number;
  color: string;
  owner: string;
  /** Škola kouzla — rozhoduje o chování při zásahu (hoření, řetěz…). */
  school: SpellSchool;
  /** Šíp projde skrz cíl, místo aby se spotřeboval. */
  pierce: boolean;
  /** Cíle, které už dostaly zásah (u průrazného projektilu). */
  hitIds: string[];
}

export interface Effect {
  id: string;
  kind: 'aoe' | 'hit' | 'shield' | 'heal' | 'level' | 'capture';
  x: number;
  z: number;
  radius: number;
  color: string;
  ttl: number;
  maxTtl: number;
}

export interface NodeState {
  key: string;
  name: string;
  x: number;
  z: number;
  owner: Team | null;
  /** Postup převzetí podle týmu (ms). */
  progress: Record<Team, number>;
}

export interface MobaInput {
  moveX: number;
  moveZ: number;
  cast: { slot: SpellSlot; x: number; z: number } | null;
  attack: boolean;
}

export const NO_INPUT: MobaInput = { moveX: 0, moveZ: 0, cast: null, attack: false };

export interface Monster {
  id: string;
  campId: string;
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  damage: number;
  range: number;
  attackMs: number;
  cooldown: number;
  type: JungleCamp['type'];
  alive: boolean;
  respawnAt: number;
}

export interface Rune {
  id: string;
  spotId: string;
  type: RuneType;
  x: number;
  z: number;
  /** Kdy se má runa objevit (ms od začátku zápasu, sim čas). */
  spawnAt: number;
}

export interface Ward {
  id: string;
  team: Team;
  x: number;
  z: number;
  expiresAt: number;
}

export interface Sentry {
  id: string;
  team: Team;
  x: number;
  z: number;
  expiresAt: number;
}

export interface Boss {
  id: string;
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  damage: number;
  range: number;
  attackMs: number;
  cooldown: number;
  alive: boolean;
  respawnAt: number;
  /** Kolik minut zápasu měl boss při posledním spawnu (škálování). */
  level: number;
}

export interface MobaState {
  now: number;
  time: number;
  ended: Team | null;
  heroes: Hero[];
  minions: Minion[];
  monsters: Monster[];
  runes: Rune[];
  /** Wardy na mapě (vidí je jen vlastní tým). */
  wards: Ward[];
  /** Sentry — odhalují neviditelné jednotky. */
  sentries: Sentry[];
  boss: Boss;
  nextRuneAt: number;
  /** Obtížnost botů — v online drží server `normal`. */
  botSkill: BotSkill;
  towers: Tower[];
  projectiles: Projectile[];
  effects: Effect[];
  nodes: NodeState[];
  nextWaveAt: number;
  wave: number;
  seq: number;
  banner: string | null;
  bannerUntil: number;
}

// ── pomocné ──────────────────────────────────────────────────────────

let SEQ = 0;
const nextId = (prefix: string) => `${prefix}-${(SEQ += 1)}`;

const distance = (ax: number, az: number, bx: number, bz: number) => Math.hypot(ax - bx, az - bz);

function makeHero(id: string, team: Team, heroId: number, spawn: { x: number; z: number }, isPlayer: boolean): Hero {
  const entry = AVATARS_BY_ID.get(heroId);
  const cl = entry?.cl ?? 3;
  const look = avatarLook(heroId);
  const maxHp = 620 + cl * 34;
  const maxMana = 320 + cl * 18;
  return {
    id,
    team,
    heroId,
    name: entry?.name ?? 'Poutník',
    kind: 'hero',
    x: spawn.x,
    z: spawn.z,
    hp: maxHp,
    maxHp,
    mana: maxMana,
    maxMana,
    level: 1,
    xp: 0,
    alive: true,
    respawnAt: 0,
    shield: 0,
    shieldUntil: 0,
    slowUntil: 0,
    slowFactor: 0,
    baseMaxHp: maxHp,
    baseMaxMana: maxMana,
    spells: spellsFor(heroId, look.palette.glow),
    cooldowns: { Q: 0, W: 0, E: 0, R: 0 },
    attackCooldown: 0,
    facing: team === 'blue' ? 0 : Math.PI,
    kills: 0,
    deaths: 0,
    damageDone: 0,
    healingDone: 0,
    gold: 320,
    aegis: false,
    wards: 0,
    sentries: 0,
    buybackAt: 0,
    itemCooldowns: {},
    talentPicks: {},
    items: [],
    buffs: [],
    isPlayer,
    botLane: 'mid',
    botCast: null,
    botNextCast: 0,
    botCasts: 0,
  };
}

/** Jedno sedlo zápasu — hráč nebo bot na dané straně. */
export interface MobaSeat {
  id: string;
  heroId: number;
  team: Team;
  /** true = ovládá ho hráč (dostává vstup), false = bot. */
  human?: boolean;
}

/** Boss sílí s časem zápasu — na konci je mnohem tvrdší než na startu. */
function makeBoss(minutes: number): Boss {
  const hp = Math.round(BOSS_BASE_HP * (1 + minutes * BOSS_HP_PER_MIN));
  const damage = Math.round(BOSS_BASE_DAMAGE * (1 + minutes * BOSS_DAMAGE_PER_MIN));
  return {
    id: 'boss',
    x: BOSS_SPOT.x,
    z: BOSS_SPOT.z,
    hp,
    maxHp: hp,
    damage,
    range: 6.5,
    attackMs: 1500,
    cooldown: 0,
    alive: true,
    respawnAt: 0,
    level: minutes,
  };
}

/** Druh runy se střídá deterministicky — stejná hra pro všechny. */
const RUNE_TYPES: RuneType[] = ['bounty', 'haste', 'power'];

/** Runy na obou místech; druh se posouvá s cyklem, aby se neopakoval pořád stejný. */
function makeRunes(cycle: number, wave: number): Rune[] {
  return RUNE_SPOTS.map((spot, index) => ({
    id: `rune-${spot.id}-${wave}-${cycle}`,
    spotId: spot.id,
    type: RUNE_TYPES[(cycle + index) % RUNE_TYPES.length]!,
    x: spot.x,
    z: spot.z,
    spawnAt: 0,
  }));
}

/**
 * Zápas z rozpisu sedaček — používá server pro 2v2 i sólo (sólo je jen
 * rozpis se dvěma sedačkami). Počet hrdinů není pevný, sim se přizpůsobí.
 */
export function createMobaMatch(seats: MobaSeat[], now: number, botSkill: BotSkill = 'normal'): MobaState {
  const heroes = seats.map((seat) =>
    makeHero(
      seat.id,
      seat.team,
      seat.heroId,
      seat.team === 'blue' ? SPAWNS.blue : SPAWNS.red,
      seat.human === true,
    ),
  );
  // rozestup, ať se hrdinové ve spawnu nepřekrývají
  heroes.forEach((hero, index) => {
    const offset = (index % 2) * 2.4 - 1.2;
    hero.x += hero.team === 'blue' ? offset : -offset;
    hero.z += offset;
  });

  const monsters: Monster[] = JUNGLE_CAMPS.map((camp) => {
    const stats = camp.type === 'ancient' ? { hp: 1800, damage: 65, range: 6, attackMs: 1400 } : camp.type === 'medium' ? { hp: 900, damage: 38, range: 5, attackMs: 1300 } : { hp: 550, damage: 24, range: 4.5, attackMs: 1200 };
    return {
      id: nextId(`monster-${camp.id}`),
      campId: camp.id,
      x: camp.x,
      z: camp.z,
      hp: stats.hp,
      maxHp: stats.hp,
      damage: stats.damage,
      range: stats.range,
      attackMs: stats.attackMs,
      cooldown: 0,
      type: camp.type,
      alive: true,
      respawnAt: 0,
    };
  });

  const state: MobaState = {
    now,
    time: 0,
    ended: null,
    heroes,
    minions: [],
    monsters,
    towers: STRUCTURES.map((structure) => ({
      id: structure.id,
      team: structure.team,
      kind: structure.kind,
      x: structure.x,
      z: structure.z,
      hp: structure.hp,
      maxHp: structure.hp,
      range: structure.range,
      damage: structure.damage,
      attackMs: structure.attackMs,
      cooldown: 0,
      respawnAt: 0,
    })),
    projectiles: [],
    effects: [],
    runes: makeRunes(0, 0),
    wards: [],
    sentries: [],
    boss: makeBoss(0),
    nextRuneAt: now + RUNE_INTERVAL_MS,
    botSkill,
    nodes: NODE_SITES.map((site) => ({
      key: site.key,
      name: site.name,
      x: site.x,
      z: site.z,
      owner: null,
      progress: { blue: 0, red: 0 },
    })),
    nextWaveAt: now + 6000,
    wave: 0,
    seq: 0,
    banner: 'PRVNÍ SVĚT — chraň svou Zemi',
    bannerUntil: now + 4200,
  };
  return state;
}

/** Sólo 1v1 — tenký obal nad `createMobaMatch` (klient i testy). */
export function createMoba(playerHeroId: number, enemyHeroId: number, now: number, botSkill: BotSkill = 'normal'): MobaState {
  return createMobaMatch(
    [
      { id: 'hero-you', heroId: playerHeroId, team: 'blue', human: true },
      { id: 'hero-foe', heroId: enemyHeroId, team: 'red', human: false },
    ],
    now,
    botSkill,
  );
}

/** Bonus k poškození podle převzatých uzlů L5. */
export function nodeBonus(state: MobaState, team: Team): number {
  const owned = state.nodes.filter((node) => node.owner === team).length;
  return 1 + owned * NODE_BONUS_PER_SITE;
}

const levelScale = (hero: Hero) => 1 + (hero.level - 1) * 0.06;
/** Odchozí poškození podle itemů a buffů. */
const damageOut = (hero: Hero, now: number) => {
  let mult = 1 + itemTotals(hero.items).damage + talentTotals(hero).damage;
  for (const buff of hero.buffs) {
    if (buff.until > now && buff.type === 'strength') mult *= 1 + buff.power;
  }
  return mult;
};
/** Příchozí poškození podle itemů a buffů (Aegis tlumí, ward posiluje). */
const damageIn = (hero: Hero, now: number) => {
  let mult = Math.max(0.5, 1 - itemTotals(hero.items).armor);
  for (const buff of hero.buffs) {
    if (buff.until > now && buff.type === 'ward') mult *= 1 - buff.power * 0.5;
  }
  return Math.max(0.5, mult);
};

function addEffect(state: MobaState, kind: Effect['kind'], x: number, z: number, radius: number, color: string, ttl: number) {
  state.effects.push({ id: nextId('fx'), kind, x, z, radius, color, ttl, maxTtl: ttl });
}

function damageHero(state: MobaState, hero: Hero, amount: number, source: string) {
  if (!hero.alive) return;
  let remaining = amount * damageIn(hero, state.now);
  if (hero.shield > 0) {
    const absorbed = Math.min(hero.shield, remaining);
    hero.shield -= absorbed;
    remaining -= absorbed;
  }
  hero.hp -= remaining;
  if (hero.hp <= 0) {
    // Aegis z bosse: jednorázové vzkříšení místo smrti.
    if (hero.aegis) {
      hero.aegis = false;
      hero.hp = Math.round(hero.maxHp * 0.6);
      addEffect(state, 'shield', hero.x, hero.z, 2.6, '#ffd166', 1200);
      state.banner = `${hero.name} — Aegis ho vrátila do boje`;
      state.bannerUntil = state.now + 3200;
      return;
    }
    hero.hp = 0;
    hero.alive = false;
    hero.deaths += 1;
    hero.respawnAt = state.now + (RESPAWN_BASE_MS + hero.level * RESPAWN_PER_LEVEL_MS);
    // Smrt stojí zlato (unreliable) — jinak je umírání jen zrychlení hry.
    const lost = Math.min(GOLD_LOSS_CAP, Math.round(hero.gold * GOLD_LOSS_RATIO));
    hero.gold = Math.max(0, hero.gold - lost);
    addEffect(state, 'hit', hero.x, hero.z, 2.2, '#ff6b6b', 600);
    const killer = state.heroes.find((candidate) => candidate.id === source);
    if (killer && killer.team !== hero.team) {
      killer.kills += 1;
      killer.gold = Math.min(GOLD_CAP, killer.gold + HERO_BOUNTY);
      gainXp(state, killer, HERO_KILL_XP);
      // Asistence: spojenci v okruhu dostanou část odměny i XP.
      for (const ally of state.heroes) {
        if (ally === killer || ally.team !== killer.team || !ally.alive) continue;
        if (distance(ally.x, ally.z, hero.x, hero.z) > XP_SHARE_RADIUS) continue;
        ally.gold = Math.min(GOLD_CAP, ally.gold + Math.round(HERO_BOUNTY * ASSIST_GOLD_RATIO));
        gainXp(state, ally, ASSIST_KILL_XP);
      }
      state.banner = `${killer.name} srazil ${hero.name}`;
      state.bannerUntil = state.now + 3500;
    }
  }
}

// ── školy kouzel ─────────────────────────────────────────────────────

/**
 * Zásah kouzlem — co se stane navíc podle školy.
 *
 * Do 2. 11. 2026 se školy chovaly stejně; odsud má každá svou mechaniku
 * (`SCHOOL_TRAITS` ve `spells.ts`). Volá se **po** `damageHero`, takže
 * `amount` je už skutečně udělené poškození (po bonusech a úrovni).
 */
function applyOnHit(
  state: MobaState,
  casterId: string,
  casterTeam: Team,
  target: Hero,
  amount: number,
  school: SpellSchool,
): void {
  const traits = SCHOOL_TRAITS[school];
  if (!traits || !target.alive) return;

  // Mysl: zásah strhne část štítu („vidíš, že to byl jen přelud").
  if (traits.shieldBreak && target.shield > 0) {
    target.shield = Math.max(0, target.shield * (1 - traits.shieldBreak));
    addEffect(state, 'hit', target.x, target.z, 1.2, '#d8b4fe', 260);
  }

  // Oheň: hoření na 3 s. Stejný sesilatel prodlouží a posílí, nesčítá.
  if (traits.burn) {
    const dps = (amount * traits.burn) / 3;
    const existing = target.buffs.find((buff) => buff.type === 'burn' && buff.source === casterId);
    if (existing) {
      existing.until = state.now + 3000;
      existing.power = Math.max(existing.power, dps);
    } else {
      target.buffs.push({ type: 'burn', until: state.now + 3000, power: dps, source: casterId });
    }
  }

  // Bouře: část poškození přeteče na druhý cíl do 6 m.
  if (traits.chain) {
    const second = state.heroes.find(
      (other) =>
        other !== target &&
        other.team !== casterTeam &&
        other.alive &&
        distance(other.x, other.z, target.x, target.z) <= 6,
    );
    if (second) {
      damageHero(state, second, amount * traits.chain, casterId);
      addEffect(state, 'hit', second.x, second.z, 1, '#9ad7ff', 240);
    }
  }
}

/** Popravčí bonus — čepel a stín trestají zraněné cíle. */
function schoolDamage(school: SpellSchool, target: Hero, base: number): number {
  const traits = SCHOOL_TRAITS[school];
  if (!traits?.execute || !traits.executeBelow) return base;
  return target.hp / target.maxHp <= traits.executeBelow ? base * (1 + traits.execute) : base;
}

function applyJungleBuff(hero: Hero, type: JungleCamp['type'], now: number) {
  if (type === 'small') {
    hero.buffs.push({ type: 'speed', until: now + 90000, power: 0.15 });
    hero.buffs.push({ type: 'strength', until: now + 90000, power: 0.12 });
  } else if (type === 'medium') {
    hero.buffs.push({ type: 'strength', until: now + 120000, power: 0.25 });
    hero.buffs.push({ type: 'ward', until: now + 120000, power: 0.15 });
  } else if (type === 'ancient') {
    hero.buffs.push({ type: 'ancient', until: now + 150000, power: 1 });
    hero.buffs.push({ type: 'strength', until: now + 150000, power: 0.4 });
    hero.buffs.push({ type: 'ward', until: now + 150000, power: 0.25 });
    hero.buffs.push({ type: 'speed', until: now + 150000, power: 0.2 });
  }
}

function damageMinion(state: MobaState, minion: Minion, amount: number, source: string) {
  minion.hp -= amount;
  if (minion.hp > 0) return;
  state.minions = state.minions.filter((candidate) => candidate.id !== minion.id);
  const killer = state.heroes.find((candidate) => candidate.id === source);
  // Deny: vlastní hrdina dorazil vlastního miniona (jen pod 50 % HP —
  // hlídá výběr cíle, sem se jiný případ nedostane).
  const denied = killer !== undefined && killer.team === minion.team;
  // XP dostávají hrdinové **druhé strany** v okruhu, ne jen zabiják:
  // zabiják plnou dávku, spojenci polovinu; denied minion dá jen 50 %.
  for (const hero of state.heroes) {
    if (!hero.alive || hero.team === minion.team) continue;
    if (distance(hero.x, hero.z, minion.x, minion.z) > XP_SHARE_RADIUS) continue;
    const isKiller = killer?.id === hero.id;
    const ratio = denied ? 0.5 : isKiller ? 1 : XP_ALLY_RATIO;
    gainXp(state, hero, Math.round((minion.super ? MINION_XP * 2 : MINION_XP) * ratio));
  }
  if (killer && !denied) {
    killer.gold = Math.min(GOLD_CAP, killer.gold + (minion.super ? MINION_GOLD * 2 : MINION_GOLD));
    killer.damageDone += amount;
  }
  if (killer && denied) {
    addEffect(state, 'hit', minion.x, minion.z, 0.6, '#94a3b8', 200);
  }
}

function damageMonster(state: MobaState, monster: Monster, amount: number, source: string) {
  if (!monster.alive) return;
  monster.hp -= amount;
  if (monster.hp > 0) return;
  monster.alive = false;
  const camp = JUNGLE_CAMPS.find((c) => c.id === monster.campId);
  if (camp) {
    monster.respawnAt = state.now + camp.respawnMs;
    const killer = state.heroes.find((candidate) => candidate.id === source);
    if (killer) {
      gainXp(state, killer, camp.type === 'ancient' ? 250 : camp.type === 'medium' ? 120 : 60);
      killer.gold = Math.min(GOLD_CAP, killer.gold + (camp.type === 'ancient' ? 175 : camp.type === 'medium' ? 90 : 45));
      killer.damageDone += amount;
      applyJungleBuff(killer, camp.type, state.now);
      state.banner = `${killer.name} zabil ${camp.type === 'ancient' ? 'Prastaré stvoření' : camp.type === 'medium' ? 'Středního tábora' : 'Jungle monstra'}`;
      state.bannerUntil = state.now + 3200;
    }
  }
}

/** Přepočítá maxima z levelu a itemů — jediné místo, kde se mění maxHp/maxMana. */
function recomputeHeroStats(hero: Hero) {
  const totals = itemTotals(hero.items);
  const talents = talentTotals(hero);
  hero.maxHp = hero.baseMaxHp + (hero.level - 1) * 55 + totals.hp + talents.hp;
  hero.maxMana = hero.baseMaxMana + (hero.level - 1) * 18 + totals.mana + talents.mana;
  hero.hp = Math.min(hero.hp, hero.maxHp);
  hero.mana = Math.min(hero.mana, hero.maxMana);
}

/** Poškození struktury — jedno místo pro hrdiny i miniony (odměna týmu). */
function damageTower(state: MobaState, tower: Tower, amount: number, attacker: Hero | null) {
  if (tower.hp <= 0) return;
  tower.hp = Math.max(0, tower.hp - amount);
  if (attacker) attacker.damageDone += amount;
  addEffect(state, 'hit', tower.x, tower.z, 0.8, '#ffe6a8', 180);
  if (tower.hp > 0) return;

  // Věž padla — zlato a XP pro celý tým, kdo ji dorazil, dostane prémii.
  const team: Team = attacker ? attacker.team : tower.team === 'blue' ? 'red' : 'blue';
  for (const hero of state.heroes) {
    if (hero.team !== team) continue;
    hero.gold = Math.min(GOLD_CAP, hero.gold + TOWER_GOLD_TEAM);
    gainXp(state, hero, TOWER_XP);
  }
  if (attacker) attacker.gold = Math.min(GOLD_CAP, attacker.gold + TOWER_GOLD_LASTHIT);
  if (tower.kind === 'inhibitor') {
    tower.respawnAt = state.now + INHIBITOR_RESPAWN_MS;
    state.banner = `${tower.team === 'blue' ? 'ZION' : 'Opozice'} přišla o inhibitor — super minioni!`;
    state.bannerUntil = state.now + 4000;
    return;
  }
  if (tower.kind === 'tower') {
    const label = tower.id.includes('-base-') ? 'základnovou věž' : tower.id.includes('-outer-') ? 'vnější věž' : 'vnitřní věž';
    state.banner = `${team === 'blue' ? 'ZION' : 'Opozice'} zničila ${label}`;
    state.bannerUntil = state.now + 2600;
  }
}

/** Zabití bosse — zlato, XP a Aegis (jednorázové vzkříšení). */
function damageBoss(state: MobaState, amount: number, source: string) {
  const boss = state.boss;
  if (!boss.alive) return;
  boss.hp -= amount;
  if (boss.hp > 0) return;
  boss.hp = 0;
  boss.alive = false;
  boss.respawnAt = state.now + BOSS_RESPAWN_MS;
  const killer = state.heroes.find((hero) => hero.id === source);
  if (killer) {
    killer.gold = Math.min(GOLD_CAP, killer.gold + 250);
    gainXp(state, killer, 220);
    killer.aegis = true;
    state.banner = `${killer.name} zabil Prastarého strážce — Aegis!`;
    state.bannerUntil = state.now + 4200;
  }
}

function gainXp(state: MobaState, hero: Hero, amount: number) {
  hero.xp += amount;
  for (;;) {
    const need = xpNeeded(hero.level);
    if (hero.xp < need || hero.level >= 15) break;
    hero.xp -= need;
    hero.level += 1;
    recomputeHeroStats(hero);
    hero.hp = Math.min(hero.maxHp, hero.hp + 90);
    hero.mana = Math.min(hero.maxMana, hero.mana + 40);
    addEffect(state, 'level', hero.x, hero.z, 1.8, '#ffd166', 700);
  }
}

function nearestEnemyHero(state: MobaState, hero: Hero, range: number): Hero | null {
  let best: Hero | null = null;
  let bestDistance = range;
  for (const other of state.heroes) {
    if (other.team === hero.team || !other.alive) continue;
    // Neviditelného soupeře nejde zamířit, dokud ho neodhalí sentry.
    if (isHidden(state, other, hero.team)) continue;
    const d = distance(hero.x, hero.z, other.x, other.z);
    if (d < bestDistance) {
      bestDistance = d;
      best = other;
    }
  }
  return best;
}

function nearestEnemyMinion(state: MobaState, hero: Hero, range: number): Minion | null {
  let best: Minion | null = null;
  let bestDistance = range;
  for (const minion of state.minions) {
    if (minion.team === hero.team) continue;
    const d = distance(hero.x, hero.z, minion.x, minion.z);
    if (d < bestDistance) {
      bestDistance = d;
      best = minion;
    }
  }
  return best;
}

// ── kouzla ───────────────────────────────────────────────────────────

function castSpell(state: MobaState, hero: Hero, slot: SpellSlot, x: number, z: number) {
  const spell = hero.spells.find((candidate) => candidate.slot === slot);
  if (!spell) return;
  const rank = spellRank(hero.level, slot);
  // Ultimátka je do 6. úrovně zamčená — jinak by R bylo silnější než Q hned od startu.
  if (rank < 1) return;
  if (!hero.alive || state.now < hero.cooldowns[slot]) return;
  const manaCost = spellMana(spell.mana, rank);
  if (hero.mana < manaCost) return;
  const distanceToPoint = distance(hero.x, hero.z, x, z);
  if (spell.range > 0 && distanceToPoint > spell.range + spell.radius) return;

  hero.mana -= manaCost;
  hero.cooldowns[slot] = state.now + spellCooldown(spell.cooldownMs, rank);
  hero.facing = Math.atan2(x - hero.x, z - hero.z);
  // Stupeň kouzla nahrazuje `levelScale` — jinak by se level počítal dvakrát.
  const rankBonus = 1 + (rank - 1) * SPELL_RANK_SCALE;
  const bonus = nodeBonus(state, hero.team) * damageOut(hero, state.now) * rankBonus * (1 + talentTotals(hero).spellPower);

  if (spell.kind === 'projectile') {
    const dx = x - hero.x;
    const dz = z - hero.z;
    const length = Math.hypot(dx, dz) || 1;
    state.projectiles.push({
      id: nextId('proj'),
      team: hero.team,
      x: hero.x,
      z: hero.z,
      dx: dx / length,
      dz: dz / length,
      speed: spell.speed,
      radius: spell.radius,
      damage: spell.damage * bonus,
      ttl: (spell.range + 4) / Math.max(1, spell.speed),
      color: spell.color,
      owner: hero.id,
      school: spell.school,
      pierce: SCHOOL_TRAITS[spell.school]?.pierce === true,
      hitIds: [],
    });
    addEffect(state, 'hit', hero.x, hero.z, 0.8, spell.color, 220);
    return;
  }

  if (spell.kind === 'dash') {
    const dx = x - hero.x;
    const dz = z - hero.z;
    const length = Math.hypot(dx, dz) || 1;
    const step = Math.min(7, length);
    hero.x = Math.max(-MAP_HALF_X, Math.min(MAP_HALF_X, hero.x + (dx / length) * step));
    hero.z = Math.max(-MAP_HALF_Z, Math.min(MAP_HALF_Z, hero.z + (dz / length) * step));
    addEffect(state, 'aoe', hero.x, hero.z, 1.6, spell.color, 320);
    if (spell.damage > 0) {
      // Bestie dopadá v širším kruhu (`dashRadius`) — skok má váhu.
      const hitRadius = 2.2 * (SCHOOL_TRAITS[spell.school]?.dashRadius ?? 1);
      for (const other of state.heroes) {
        if (other.team === hero.team || !other.alive) continue;
        if (distance(hero.x, hero.z, other.x, other.z) > hitRadius) continue;
        const dealt = schoolDamage(spell.school, other, spell.damage * bonus);
        damageHero(state, other, dealt, hero.id);
        if (other.alive) applyOnHit(state, hero.id, hero.team, other, dealt, spell.school);
      }
    }
    return;
  }

  if (spell.kind === 'buff') {
    const traits = SCHOOL_TRAITS[spell.school];
    if (spell.shield > 0) {
      const shield = spell.shield * rankBonus;
      hero.shield = shield;
      hero.shieldUntil = state.now + 6000;
      addEffect(state, 'shield', hero.x, hero.z, 1.7, spell.color, 6000);

      // Ward a píseň štítí i nejbližšího spojence.
      if (traits?.allyShield) {
        const ally = state.heroes
          .filter(
            (other) =>
              other !== hero &&
              other.team === hero.team &&
              other.alive &&
              distance(hero.x, hero.z, other.x, other.z) <= 8,
          )
          .sort((a, b) => distance(hero.x, hero.z, a.x, a.z) - distance(hero.x, hero.z, b.x, b.z))[0];
        if (ally) {
          ally.shield = Math.max(ally.shield, shield * traits.allyShield);
          ally.shieldUntil = state.now + 6000;
          addEffect(state, 'shield', ally.x, ally.z, 1.7, spell.color, 6000);
        }
      }
    }
    if (spell.heal > 0) {
      const heal = spell.heal * rankBonus;
      if (traits?.healOverTime) {
        // Příroda a píseň léčí postupně — nedá se tím utéct z boje.
        const existing = hero.buffs.find((buff) => buff.type === 'regen');
        if (existing) {
          existing.until = state.now + 4000;
          existing.power = Math.max(existing.power, heal / 4);
        } else {
          hero.buffs.push({ type: 'regen', until: state.now + 4000, power: heal / 4 });
        }
        addEffect(state, 'heal', hero.x, hero.z, 1.5, '#7bf0a8', 1200);
      } else {
        const before = hero.hp;
        hero.hp = Math.min(hero.maxHp, hero.hp + heal);
        hero.healingDone += hero.hp - before;
        addEffect(state, 'heal', hero.x, hero.z, 1.5, '#7bf0a8', 700);
      }
    }
    // Kosmické: W vrátí část many.
    if (traits?.manaSurge) {
      hero.mana = Math.min(hero.maxMana, hero.mana + hero.maxMana * traits.manaSurge);
      addEffect(state, 'heal', hero.x, hero.z, 1.2, '#a5b4fc', 500);
    }
    return;
  }

  // AoE (E a R)
  addEffect(state, 'aoe', x, z, spell.radius, spell.color, 620);
  for (const other of state.heroes) {
    if (other.team === hero.team || !other.alive) continue;
    if (distance(x, z, other.x, other.z) > spell.radius + 0.8) continue;
    const dealt = schoolDamage(spell.school, other, spell.damage * bonus);
    damageHero(state, other, dealt, hero.id);
    if (other.alive) applyOnHit(state, hero.id, hero.team, other, dealt, spell.school);
    if (spell.slow > 0) {
      other.slowUntil = state.now + spell.slowMs;
      other.slowFactor = spell.slow;
    }
  }
  for (const minion of [...state.minions]) {
    if (minion.team === hero.team) continue;
    if (distance(x, z, minion.x, minion.z) > spell.radius + 0.6) continue;
    damageMinion(state, minion, spell.damage * bonus * 0.7, hero.id);
  }
}

// ── AI ───────────────────────────────────────────────────────────────

function stepBot(state: MobaState, hero: Hero, now: number) {
  if (!hero.alive) return;
  const foe = state.heroes.find((candidate) => candidate.team !== hero.team && candidate.alive);
  const enemyMinion = nearestEnemyMinion(state, hero, 18);
  const target = enemyMinion
    ? { x: enemyMinion.x, z: enemyMinion.z, distance: distance(hero.x, hero.z, enemyMinion.x, enemyMinion.z) }
    : foe
      ? { x: foe.x, z: foe.z, distance: distance(hero.x, hero.z, foe.x, foe.z) }
      : null;

  // drž se linky, dokud není cíl
  if (!target) {
    hero.botCast = null;
    return;
  }

  const skill = BOT_SKILLS[state.botSkill];
  // Obtížnost mění jen rozhodování: přesnost míření, kadenci a ochotu ustoupit.
  const retreating = hero.hp < hero.maxHp * skill.retreatHp;
  const move = retreating ? -1 : target.distance > 6 ? 1 : target.distance < 3.4 ? -0.4 : 0;
  const dx = target.x - hero.x;
  const dz = target.z - hero.z;
  const length = Math.hypot(dx, dz) || 1;
  hero.x += (dx / length) * move * 4.4 * (1 / 30);
  hero.z += (dz / length) * move * 4.4 * (1 / 30);

  // kouzla: Q na dostřel, E na skupinu, R na finisher, W při zranění
  const ready = (slot: SpellSlot) => now >= hero.cooldowns[slot];
  const affordable = (slot: SpellSlot) => {
    const spell = hero.spells.find((candidate) => candidate.slot === slot);
    return spell ? hero.mana >= spellMana(spell.mana, Math.max(1, spellRank(hero.level, slot))) : false;
  };
  // Deterministická „třeska" — stejná hra pro všechny, ale slabší bot míří hůř.
  const wobble = (seed: number) => {
    const value = Math.sin(seed * 12.9898) * 43758.5453;
    return value - Math.floor(value);
  };
  const aim = (x: number, z: number) => ({
    x: x + (wobble(now * 0.001 + hero.x) - 0.5) * 2 * skill.aimError,
    z: z + (wobble(now * 0.0013 + hero.z) - 0.5) * 2 * skill.aimError,
  });
  const canCast = now >= hero.botNextCast;
  const cast = (slot: SpellSlot, x: number, z: number) => {
    const point = slot === 'W' ? { x: hero.x, z: hero.z } : aim(x, z);
    hero.botCast = { slot, x: point.x, z: point.z };
    hero.botNextCast = now + skill.castDelay;
    hero.botCasts += 1;
  };

  // Aktivní itemy: bot je používá reaktivně (léčení/štít při zranění,
  // skok na dotahovačku nebo na útěk). `useItem` sám hlídá cooldown.
  const hpRatio = hero.hp / hero.maxHp;
  if (hpRatio < 0.55) {
    const dust = activeItemOf(hero, 'heal');
    if (dust && useItem(state, hero, dust, hero.x, hero.z)) return;
  }
  if (hpRatio < 0.7) {
    const barrier = activeItemOf(hero, 'shield');
    if (barrier && useItem(state, hero, barrier, hero.x, hero.z)) return;
  }
  const blink = activeItemOf(hero, 'blink');
  if (blink) {
    if (retreating) {
      // útěk: skok pryč od cíle
      const awayX = hero.x - (target.x - hero.x);
      const awayZ = hero.z - (target.z - hero.z);
      if (useItem(state, hero, blink, awayX, awayZ)) return;
    }
    if (target.distance > 8 && target.distance < 14) {
      // dotahovačka: skok na cíl
      if (useItem(state, hero, blink, target.x, target.z)) return;
    }
  }
  const surge = activeItemOf(hero, 'haste');
  if (surge && target.distance > 5 && useItem(state, hero, surge, hero.x, hero.z)) return;

  if (canCast && hero.hp < hero.maxHp * Math.max(0.5, skill.retreatHp) && ready('W') && affordable('W')) {
    cast('W', hero.x, hero.z);
    return;
  }
  if (hero.botCast) return;
  if (!canCast) return;

  if (target.distance < 11 && ready('Q') && affordable('Q')) {
    cast('Q', target.x, target.z);
    return;
  }
  if (target.distance < 8 && ready('E') && affordable('E')) {
    cast('E', target.x, target.z);
    return;
  }
  if (foe && ready('R') && affordable('R') && distance(hero.x, hero.z, foe.x, foe.z) < 12 && (foe.hp < foe.maxHp * 0.6 || hero.hp < hero.maxHp * 0.4)) {
    cast('R', foe.x, foe.z);
    return;
  }
  hero.botCast = null;

  // Talenty: bot si vybírá sám (deterministicky), aby nezůstal bez bonusů.
  const pending = pendingTalent(hero);
  if (pending !== null) pickTalent(hero, pending, state.seq % 2);

  // Nákup: bot musí utrácet. Bez toho by pasivní zlato zvýhodnilo jen
  // člověka — bot by hromadil 900 zlaťáků a prohrával staty.
  for (const itemId of botBuild(hero)) {
    if (hero.items.includes(itemId)) continue;
    if (buyItem(hero, itemId)) break;
  }
}

/** Build bota podle školy jeho kouzel — agresivní školy kupují čepel první. */
/** Build bota podle školy jeho kouzel — včetně aktivních itemů (F9). */
function botBuild(hero: Hero): ItemId[] {
  const school = hero.spells?.[0]?.school ?? 'cosmic';
  if (school === 'fire' || school === 'arrow' || school === 'blade' || school === 'storm' || school === 'shadow' || school === 'beast') {
    // agresivní: čepel, boty, skok na dotahovačku, pak HP
    return ['blade', 'boots', 'blink', 'aegis'];
  }
  if (school === 'ward' || school === 'nature' || school === 'song') {
    // podpůrný: HP první, bariéra na přežití, boty, čepel
    return ['aegis', 'barrier', 'boots', 'blade'];
  }
  return ['boots', 'barrier', 'blade', 'aegis'];
}

/** Najdi v inventáři item s danou aktivní schopností (nebo null). */
function activeItemOf(hero: Hero, kind: ItemActiveKind): ItemId | null {
  for (const id of hero.items) {
    const item = ITEMS.find((candidate) => candidate.id === id);
    if (item?.active?.kind === kind) return id;
  }
  return null;
}

// ── minioni a inhibitory (F3) ───────────────────────────────────────

/** Super minion je tvrdší a platí za něj víc — odměna za prolomenou linku. */
const SUPER_MINION = { hp: 680, damage: 42, range: 5.2, attackMs: 1100, speed: 3.4 } as const;

function spawnMinion(state: MobaState, team: Team, lane: LaneId, index: number, isSuper: boolean) {
  const base = team === 'blue' ? SPAWNS.blue : SPAWNS.red;
  const stats = isSuper
    ? SUPER_MINION
    : { hp: MINION_HP, damage: MINION_DAMAGE, range: MINION_RANGE, attackMs: MINION_ATTACK_MS, speed: MINION_SPEED };
  state.minions.push({
    id: nextId(`minion-${team}`),
    team,
    lane,
    x: base.x + (team === 'blue' ? 6 : -6) + index * 1.4,
    z: (LANES.find((candidate) => candidate.id === lane)?.z ?? 0) + (index - 1) * 1.2,
    hp: stats.hp,
    maxHp: stats.hp,
    damage: stats.damage,
    range: stats.range,
    attackMs: stats.attackMs,
    speed: stats.speed,
    super: isSuper,
    cooldown: 0,
  });
}

/** Stojí inhibitor daného týmu v lince? (Když spadl, teče super minion.) */
function inhibitorDown(state: MobaState, team: Team, lane: LaneId): boolean {
  const inhibitor = state.towers.find((tower) => tower.id === `${team}-inhibitor-${lane}`);
  return Boolean(inhibitor && inhibitor.hp <= 0);
}

// ── krok simulace ────────────────────────────────────────────────────

export function stepMoba(
  state: MobaState,
  dt: number,
  inputs: Record<string, MobaInput>,
  now: number,
): void {
  if (state.ended) return;
  state.now = now;
  state.time += dt;
  if (state.time >= MATCH_SECONDS) {
    const blue = state.towers.filter((tower) => tower.team === 'blue' && tower.kind === 'nexus').reduce((sum, tower) => sum + tower.hp, 0);
    const red = state.towers.filter((tower) => tower.team === 'red' && tower.kind === 'nexus').reduce((sum, tower) => sum + tower.hp, 0);
    state.ended = blue >= red ? 'blue' : 'red';
    state.banner = state.ended === 'blue' ? 'ZION drží Zemi' : 'Opozice prolomila linii';
    state.bannerUntil = now + 6000;
    return;
  }

  // ── vlny minionů ──────────────────────────────────────────────────
  if (now >= state.nextWaveAt) {
    state.nextWaveAt = now + WAVE_INTERVAL_MS;
    state.wave += 1;
    for (const lane of LANES) {
      for (const team of ['blue', 'red'] as Team[]) {
        for (let index = 0; index < WAVE_SIZE; index += 1) {
          spawnMinion(state, team, lane.id, index, false);
        }
        // Padlý nepřátelský inhibitor pouští do linky super miniona.
        const rival: Team = team === 'blue' ? 'red' : 'blue';
        if (inhibitorDown(state, rival, lane.id)) spawnMinion(state, team, lane.id, WAVE_SIZE, true);
      }
    }
    state.banner = `Vlna ${state.wave}`;
    state.bannerUntil = now + 2200;
  }

  // ── runy ──────────────────────────────────────────────────────────
  if (now >= state.nextRuneAt) {
    state.nextRuneAt = now + RUNE_INTERVAL_MS;
    const cycle = Math.floor(state.time / (RUNE_INTERVAL_MS / 1000));
    state.runes = makeRunes(cycle, state.wave);
    state.banner = 'Runy se objevily';
    state.bannerUntil = now + 2200;
  }

  // sebrání runy — kdo doběhne první
  for (const rune of [...state.runes]) {
    const taker = state.heroes.find(
      (hero) => hero.alive && distance(hero.x, hero.z, rune.x, rune.z) <= RUNE_PICKUP_RANGE,
    );
    if (!taker) continue;
    state.runes = state.runes.filter((candidate) => candidate.id !== rune.id);
    if (rune.type === 'bounty') {
      taker.gold = Math.min(GOLD_CAP, taker.gold + 120);
    } else if (rune.type === 'haste') {
      taker.buffs.push({ type: 'speed', until: now + 10_000, power: 0.35 });
    } else {
      taker.buffs.push({ type: 'strength', until: now + 10_000, power: 0.3 });
    }
    addEffect(state, 'capture', rune.x, rune.z, 2.2, rune.type === 'bounty' ? '#ffd166' : rune.type === 'haste' ? '#7fe3d4' : '#ff7a6b', 900);
    state.banner = `${taker.name} sebral runu ${rune.type === 'bounty' ? 'bounty' : rune.type === 'haste' ? 'spěchu' : 'síly'}`;
    state.bannerUntil = now + 2600;
  }

  // ── boss ──────────────────────────────────────────────────────────
  const boss = state.boss;
  if (!boss.alive) {
    if (now >= boss.respawnAt) {
      const next = makeBoss(Math.floor(state.time / 60));
      state.boss = { ...next, alive: true, respawnAt: 0, cooldown: 0 };
      state.banner = 'Prastarý strážce se probudil';
      state.bannerUntil = now + 3000;
    }
  } else if (now >= boss.cooldown) {
    const target = state.heroes
      // Boss je neutrální: nevidí nikoho, koho neodhalil sentry ani jedné strany.
      .filter(
        (hero) =>
          hero.alive &&
          !(isHidden(state, hero, 'blue') && isHidden(state, hero, 'red')) &&
          distance(hero.x, hero.z, boss.x, boss.z) <= boss.range,
      )
      .sort((a, b) => distance(a.x, a.z, boss.x, boss.z) - distance(b.x, b.z, boss.x, boss.z))[0];
    if (target) {
      boss.cooldown = now + boss.attackMs;
      damageHero(state, target, boss.damage, boss.id);
      addEffect(state, 'hit', target.x, target.z, 0.9, '#c084fc', 220);
    }
  }

  // ── buffy ─────────────────────────────────────────────────────────
  for (const hero of state.heroes) {
    hero.buffs = hero.buffs.filter((buff) => buff.until > state.now);
  }

  // ── monstra ───────────────────────────────────────────────────────
  for (const monster of state.monsters) {
    if (!monster.alive) {
      if (state.now >= monster.respawnAt) {
        const camp = JUNGLE_CAMPS.find((c) => c.id === monster.campId);
        if (camp) {
          const stats = camp.type === 'ancient' ? { hp: 1800, damage: 65, range: 6, attackMs: 1400 } : camp.type === 'medium' ? { hp: 900, damage: 38, range: 5, attackMs: 1300 } : { hp: 550, damage: 24, range: 4.5, attackMs: 1200 };
          monster.hp = stats.hp;
          monster.maxHp = stats.hp;
          monster.damage = stats.damage;
          monster.range = stats.range;
          monster.attackMs = stats.attackMs;
        }
        monster.alive = true;
        monster.cooldown = 0;
      }
      continue;
    }
    if (state.now < monster.cooldown) continue;
    const target = state.heroes.find(
      (hero) => hero.alive && distance(monster.x, monster.z, hero.x, hero.z) <= monster.range,
    );
    if (!target) continue;
    monster.cooldown = state.now + monster.attackMs;
    damageHero(state, target, monster.damage, monster.id);
    addEffect(state, 'hit', target.x, target.z, 0.6, '#ff9f1a', 200);
  }

  // ── hrdinové ──────────────────────────────────────────────────────
  for (const hero of state.heroes) {
    if (!hero.alive) {
      if (now >= hero.respawnAt) {
        hero.alive = true;
        hero.hp = hero.maxHp;
        hero.mana = hero.maxMana;
        hero.shield = 0;
        const spawn = hero.team === 'blue' ? SPAWNS.blue : SPAWNS.red;
        hero.x = spawn.x;
        hero.z = spawn.z;
        addEffect(state, 'level', hero.x, hero.z, 1.6, '#7fe3d4', 700);
      }
      continue;
    }

    if (state.now >= hero.shieldUntil) hero.shield = 0;
    if (state.now >= hero.slowUntil) hero.slowFactor = 0;
    hero.mana = Math.min(hero.maxMana, hero.mana + dt * 7);
    // Pasivní příjem — i prohrávající linka musí mít cestu k itemu.
    hero.gold = Math.min(GOLD_CAP, hero.gold + PASSIVE_GOLD_PER_SEC * dt);
    // Regenerace z itemů (Lotosový štít).
    const regen = itemTotals(hero.items).regen + talentTotals(hero).regen;
    if (regen > 0) hero.hp = Math.min(hero.maxHp, hero.hp + regen * dt);

    // Hoření a regenerace — buffy, které působí každý snímek.
    for (const buff of hero.buffs) {
      if (buff.type === 'burn') damageHero(state, hero, buff.power * dt, buff.source ?? 'burn');
      else if (buff.type === 'regen') {
        const before = hero.hp;
        hero.hp = Math.min(hero.maxHp, hero.hp + buff.power * dt);
        hero.healingDone += hero.hp - before;
      }
    }
    if (!hero.alive) continue;

    const speed = heroSpeed(hero, state.now);

    const input = inputs[hero.id];
    if (input) {
      const length = Math.hypot(input.moveX, input.moveZ);
      if (length > 0.05) {
        const nx = input.moveX / length;
        const nz = input.moveZ / length;
        hero.x += nx * speed * dt;
        hero.z += nz * speed * dt;
        hero.facing = Math.atan2(nx, nz);
      }
      if (input.cast) castSpell(state, hero, input.cast.slot, input.cast.x, input.cast.z);
    } else {
      stepBot(state, hero, now);
      const botCast = hero.botCast;
      if (botCast) castSpell(state, hero, botCast.slot, botCast.x, botCast.z);
    }

    hero.x = Math.max(-MAP_HALF_X, Math.min(MAP_HALF_X, hero.x));
    hero.z = Math.max(-MAP_HALF_Z, Math.min(MAP_HALF_Z, hero.z));

    // automatický útok
    if (now >= hero.attackCooldown) {
      const wantsAttack = input ? input.attack : true;
      if (wantsAttack) {
        let target: Hero | Minion | Monster | Boss | null = nearestEnemyHero(state, hero, 6.4) ?? nearestEnemyMinion(state, hero, 6.4);
        if (!target && state.boss.alive && distance(hero.x, hero.z, state.boss.x, state.boss.z) <= 7.2) {
          target = state.boss;
        }
        if (!target) {
          let best: Monster | null = null;
          let bestDistance = 6.4;
          for (const monster of state.monsters) {
            if (!monster.alive) continue;
            const d = distance(hero.x, hero.z, monster.x, monster.z);
            if (d < bestDistance) {
              bestDistance = d;
              best = monster;
            }
          }
          target = best;
        }
        if (!target) {
          // Deny: vlastní minion pod 50 % HP. Bez toho by obránce nemohl
          // nepříteli odepřít zlato — a linka by byla jen o poslední ráně.
          let denyTarget: Minion | null = null;
          let denyDistance = 6.4;
          for (const minion of state.minions) {
            if (minion.team !== hero.team) continue;
            if (minion.hp >= minion.maxHp * DENY_HP_RATIO) continue;
            const d = distance(hero.x, hero.z, minion.x, minion.z);
            if (d < denyDistance) {
              denyDistance = d;
              denyTarget = minion;
            }
          }
          target = denyTarget;
        }
        if (target) {
          hero.attackCooldown = now + 850;
          hero.facing = Math.atan2(target.x - hero.x, target.z - hero.z);
          const damage =
            (28 + (AVATARS_BY_ID.get(hero.heroId)?.cl ?? 3) * 3) *
            levelScale(hero) *
            nodeBonus(state, hero.team) *
            damageOut(hero, state.now);
          hero.damageDone += damage;
          if ('heroId' in target && 'team' in target) damageHero(state, target as Hero, damage, hero.id);
          else if (target === state.boss) damageBoss(state, damage, hero.id);
          else if ('campId' in target) damageMonster(state, target as Monster, damage, hero.id);
          else damageMinion(state, target as Minion, damage, hero.id);
          addEffect(state, 'hit', target.x, target.z, 0.7, '#ffe6a8', 180);
        }
      }
    }
  }

  // ── minioni ───────────────────────────────────────────────────────
  for (const minion of [...state.minions]) {
    const lane = LANES.find((candidate) => candidate.id === minion.lane) ?? LANES[1]!;
    const enemyBase = minion.team === 'blue' ? SPAWNS.red : SPAWNS.blue;
    const enemyHero = state.heroes.find(
      (hero) =>
        hero.team !== minion.team &&
        hero.alive &&
        !isHidden(state, hero, minion.team) &&
        distance(minion.x, minion.z, hero.x, hero.z) <= minion.range,
    );
    const enemyMinion = state.minions.find(
      (other) => other.team !== minion.team && distance(minion.x, minion.z, other.x, other.z) <= minion.range,
    );

    if (enemyHero || enemyMinion) {
      if (now >= minion.cooldown) {
        minion.cooldown = now + minion.attackMs;
        const target = enemyHero ?? enemyMinion!;
        if (enemyHero) damageHero(state, enemyHero, minion.damage, minion.id);
        else damageMinion(state, enemyMinion!, minion.damage, minion.id);
        addEffect(state, 'hit', target.x, target.z, 0.5, '#ffb877', 150);
      }
      continue;
    }

    // Bez jednotky v dosahu útočí minion na strukturu — jinak by linka
    // nikdy netlačila a hra by se rozhodovala jen souboji hrdinů.
    const structure = state.towers.find(
      (tower) =>
        tower.team !== minion.team &&
        tower.hp > 0 &&
        !isStructureProtected(state.towers, tower.id) &&
        distance(minion.x, minion.z, tower.x, tower.z) <= minion.range,
    );
    if (structure) {
      if (now >= minion.cooldown) {
        minion.cooldown = now + minion.attackMs;
        damageTower(state, structure, minion.damage, null);
      }
      continue;
    }

    const dx = enemyBase.x - minion.x;
    const length = Math.hypot(dx) || 1;
    minion.x += (dx / length) * minion.speed * dt;
    minion.z += Math.sign(lane.z - minion.z) * Math.min(Math.abs(lane.z - minion.z), minion.speed * dt * 0.6);
  }

  // ── věže a Nexy ───────────────────────────────────────────────────
  for (const tower of state.towers) {
    if (tower.hp <= 0) {
      // Inhibitor se po pěti minutách obnoví — linka se musí dát zavřít.
      if (tower.kind === 'inhibitor' && tower.respawnAt > 0 && now >= tower.respawnAt) {
        tower.hp = tower.maxHp;
        tower.respawnAt = 0;
        state.banner = `${tower.team === 'blue' ? 'ZION' : 'Opozice'} obnovila inhibitor`;
        state.bannerUntil = now + 3000;
        addEffect(state, 'level', tower.x, tower.z, 2.4, tower.team === 'blue' ? '#7fe3d4' : '#ff7a6b', 900);
      }
      continue;
    }
    // Inhibitor nestřílí (range 0) — jeho hodnota je v super minionech.
    if (tower.damage <= 0 || tower.range <= 0) continue;
    if (now < tower.cooldown) continue;
    const minion = state.minions.find(
      (candidate) => candidate.team !== tower.team && distance(tower.x, tower.z, candidate.x, candidate.z) <= tower.range,
    );
    const hero = state.heroes.find(
      (candidate) =>
        candidate.team !== tower.team &&
        candidate.alive &&
        !isHidden(state, candidate, tower.team) &&
        distance(tower.x, tower.z, candidate.x, candidate.z) <= tower.range,
    );
    const target = minion ?? hero;
    if (!target) continue;
    tower.cooldown = now + tower.attackMs;
    if (minion) damageMinion(state, minion, tower.damage, tower.id);
    else damageHero(state, hero!, tower.damage, tower.id);
    addEffect(state, 'hit', target.x, target.z, 0.6, tower.team === 'blue' ? '#7fe3d4' : '#ff7a6b', 220);
  }

  // ── projektily ────────────────────────────────────────────────────
  for (const projectile of [...state.projectiles]) {
    projectile.ttl -= dt;
    projectile.x += projectile.dx * projectile.speed * dt;
    projectile.z += projectile.dz * projectile.speed * dt;
    let consumed = false;

    for (const hero of state.heroes) {
      if (hero.team === projectile.team || !hero.alive) continue;
      if (projectile.hitIds.includes(hero.id)) continue;
      if (distance(projectile.x, projectile.z, hero.x, hero.z) <= projectile.radius + 0.7) {
        const dealt = schoolDamage(projectile.school, hero, projectile.damage);
        damageHero(state, hero, dealt, projectile.owner);
        if (hero.alive) applyOnHit(state, projectile.owner, projectile.team, hero, dealt, projectile.school);
        addEffect(state, 'hit', hero.x, hero.z, 1.1, projectile.color, 260);
        projectile.hitIds.push(hero.id);
        // Šíp projde dál, ostatní projektily se spotřebují.
        if (!projectile.pierce) {
          consumed = true;
          break;
        }
      }
    }
    if (!consumed) {
      for (const minion of [...state.minions]) {
        if (minion.team === projectile.team) continue;
        if (projectile.hitIds.includes(minion.id)) continue;
        if (distance(projectile.x, projectile.z, minion.x, minion.z) <= projectile.radius + 0.5) {
          damageMinion(state, minion, projectile.damage, projectile.owner);
          projectile.hitIds.push(minion.id);
          if (!projectile.pierce) {
            consumed = true;
            break;
          }
        }
      }
    }
    if (consumed || projectile.ttl <= 0) {
      state.projectiles = state.projectiles.filter((candidate) => candidate.id !== projectile.id);
    }
  }

  // ── poškození struktur (hrdinové útočí na věže) ───────────────────
  for (const hero of state.heroes) {
    if (!hero.alive) continue;
    for (const tower of state.towers) {
      if (tower.hp <= 0 || tower.team === hero.team) continue;
      // Vnější věž kryje vnitřní, vnitřní kryje Nexu (viz `map.ts`).
      if (isStructureProtected(state.towers, tower.id)) continue;
      if (distance(hero.x, hero.z, tower.x, tower.z) > 5.6) continue;
      if (now < hero.attackCooldown - 400) continue;
      const damage = 26 * levelScale(hero) * nodeBonus(state, hero.team) * damageOut(hero, state.now);
      damageTower(state, tower, damage, hero);
      if (tower.hp === 0 && tower.kind === 'nexus') {
        state.ended = hero.team;
        state.banner = hero.team === 'blue' ? 'ZION drží Zemi' : 'Opozice prolomila linii';
        state.bannerUntil = now + 8000;
      }
    }
  }

  // ── uzly L5 ───────────────────────────────────────────────────────
  for (const node of state.nodes) {
    for (const team of ['blue', 'red'] as Team[]) {
      const present = state.heroes.some(
        (hero) => hero.team === team && hero.alive && distance(hero.x, hero.z, node.x, node.z) <= 5.5,
      );
      if (!present) {
        node.progress[team] = Math.max(0, node.progress[team] - dt * 400);
        continue;
      }
      if (node.owner === team) continue;
      node.progress[team] += dt * 1000;
      if (node.progress[team] >= NODE_CAPTURE_MS) {
        node.owner = team;
        for (const hero of state.heroes) {
          if (hero.team !== team || !hero.alive) continue;
          if (distance(hero.x, hero.z, node.x, node.z) > 6.5) continue;
          hero.gold = Math.min(GOLD_CAP, hero.gold + 70);
        }
        node.progress = { blue: 0, red: 0 };
        addEffect(state, 'capture', node.x, node.z, 3.4, team === 'blue' ? '#7fe3d4' : '#ff7a6b', 1400);
        state.banner = `${node.name} převzat — ${team === 'blue' ? 'ZION' : 'Opozice'}`;
        state.bannerUntil = now + 3000;
      }
    }
    if (node.owner) {
      const rival: Team = node.owner === 'blue' ? 'red' : 'blue';
      node.progress[rival] = Math.min(node.progress[rival], NODE_CAPTURE_MS * 0.9);
    }
  }

  // ── wardy ─────────────────────────────────────────────────────────
  state.wards = state.wards.filter((ward) => ward.expiresAt > now);
  state.sentries = state.sentries.filter((sentry) => sentry.expiresAt > now);

  // ── efekty ────────────────────────────────────────────────────────
  state.effects = state.effects.filter((effect) => {
    effect.ttl -= dt * 1000;
    return effect.ttl > 0;
  });

  // ── konec: Nexa padla (kýmkoli — debug, minion, hrdina) ───────────
  if (!state.ended) {
    for (const tower of state.towers) {
      if (tower.kind !== 'nexus' || tower.hp > 0) continue;
      state.ended = tower.team === 'blue' ? 'red' : 'blue';
      state.banner = state.ended === 'blue' ? 'ZION drží Zemi' : 'Opozice prolomila linii';
      state.bannerUntil = now + 8000;
    }
  }
}

/**
 * Nákup itemu — vrací `false`, když na něj není zlato, není slot nebo už ho má.
 *
 * Složené itemy se chovají jako recept: vlastněné komponenty se **spotřebují**
 * a platí se jen rozdíl ceny. Slot se uvolní právě o komponenty, takže
 * složení jde i s plným inventářem.
 */
export function buyItem(hero: Hero, itemId: ItemId): boolean {
  const item = ITEM_BY_ID.get(itemId);
  if (!item) return false;
  if (item.consumable) {
    // Spotřební item jde do zásoby, nezabírá slot — jinak by ward sežral build.
    const isSentry = itemId === 'sentry';
    const stock = isSentry ? hero.sentries : hero.wards;
    const max = isSentry ? SENTRY_STOCK_MAX : WARD_STOCK_MAX;
    if (stock >= max) return false;
    if (hero.gold < item.cost) return false;
    hero.gold -= item.cost;
    if (isSentry) hero.sentries += 1;
    else hero.wards += 1;
    return true;
  }
  if (hero.items.includes(itemId)) return false;

  const owned = (item.components ?? []).filter((component) => hero.items.includes(component));
  const refundForComponents = owned.reduce((sum, component) => sum + (ITEM_BY_ID.get(component)?.cost ?? 0), 0);
  const price = Math.max(0, item.cost - refundForComponents);
  if (hero.gold < price) return false;

  // Po spotřebování komponent se slot uvolní — kontrola až po nich.
  if (hero.items.length - owned.length + 1 > ITEM_SLOTS) return false;

  hero.gold -= price;
  if (owned.length > 0) hero.items = hero.items.filter((id) => !owned.includes(id));
  hero.items.push(itemId);
  recomputeHeroStats(hero);
  return true;
}

/**
 * Polož ward na zem — jen v dosahu (`WARD_RANGE`) a jen když nějaký má.
 * Vidění drží `visionSources`, takže ward funguje i proti mlze.
 */
export function placeWard(state: MobaState, hero: Hero, x: number, z: number): boolean {
  if (!hero.alive || hero.wards <= 0) return false;
  if (distance(hero.x, hero.z, x, z) > WARD_RANGE) return false;
  hero.wards -= 1;
  state.wards.push({
    id: nextId('ward'),
    team: hero.team,
    x,
    z,
    expiresAt: state.now + WARD_DURATION_MS,
  });
  addEffect(state, 'shield', x, z, 1.4, '#7fe3d4', 420);
  return true;
}

/**
 * Polož sentry — odhaluje neviditelné jednotky v okruhu.
 * Vidění ani útok neřeší; to dělá `isHidden()` při filtrování a cílení.
 */
export function placeSentry(state: MobaState, hero: Hero, x: number, z: number): boolean {
  if (!hero.alive || hero.sentries <= 0) return false;
  if (distance(hero.x, hero.z, x, z) > SENTRY_RANGE) return false;
  hero.sentries -= 1;
  state.sentries.push({
    id: nextId('sentry'),
    team: hero.team,
    x,
    z,
    expiresAt: state.now + SENTRY_DURATION_MS,
  });
  addEffect(state, 'shield', x, z, 1.2, '#facc15', 420);
  return true;
}

/**
 * Je hrdina skrytý před daným týmem? Neviditelnost kryje **jen** sentry
 * protistrany — bez něj ho nevidíš ani na mapě, ani s ním nemůžeš bojovat.
 */
export function isHidden(state: MobaState, hero: Hero, viewerTeam: Team): boolean {
  // Vlastní tým vidí vždy — neviditelnost je jen proti soupeři.
  if (hero.team === viewerTeam) return false;
  const invisible = hero.buffs.some((buff) => buff.type === 'invisible' && buff.until > state.now);
  if (!invisible) return false;
  return !state.sentries.some(
    (sentry) =>
      sentry.team === viewerTeam &&
      sentry.expiresAt > state.now &&
      distance(sentry.x, sentry.z, hero.x, hero.z) <= SENTRY_RADIUS,
  );
}

/**
 * Buyback — mrtvý hrdina zaplatí a vrátí se do hry na 60 % HP.
 * Cooldown drží, aby se z toho nestal permanentní respawn zdarma.
 */
export function buyback(hero: Hero, now: number): boolean {
  if (hero.alive) return false;
  if (now < hero.buybackAt) return false;
  const cost = buybackCost(hero);
  if (hero.gold < cost) return false;
  hero.gold -= cost;
  hero.alive = true;
  hero.hp = Math.round(hero.maxHp * BUYBACK_HP_RATIO);
  hero.mana = Math.round(hero.maxMana * 0.5);
  hero.shield = 0;
  hero.buffs = [];
  hero.buybackAt = now + BUYBACK_COOLDOWN_MS;
  const spawn = hero.team === 'blue' ? SPAWNS.blue : SPAWNS.red;
  hero.x = spawn.x;
  hero.z = spawn.z;
  return true;
}

/**
 * Použij aktivní item (klávesa 1–6). Server rozhoduje o cooldownu i efektu;
 * klient posílá jen id a bod (u bliku), nikdy neúčtuje nic sám.
 */
export function useItem(state: MobaState, hero: Hero, itemId: ItemId, x: number, z: number): boolean {
  const item = ITEM_BY_ID.get(itemId);
  if (!item?.active) return false;
  if (!hero.alive) return false;
  if (!hero.items.includes(itemId)) return false;
  if (state.now < (hero.itemCooldowns[itemId] ?? 0)) return false;

  const active = item.active;
  if (active.kind === 'blink') {
    const dx = x - hero.x;
    const dz = z - hero.z;
    const length = Math.hypot(dx, dz) || 1;
    const step = Math.min(active.power, length);
    hero.x = Math.max(-MAP_HALF_X, Math.min(MAP_HALF_X, hero.x + (dx / length) * step));
    hero.z = Math.max(-MAP_HALF_Z, Math.min(MAP_HALF_Z, hero.z + (dz / length) * step));
    addEffect(state, 'aoe', hero.x, hero.z, 1.6, '#a5b4fc', 320);
  } else if (active.kind === 'shield') {
    hero.shield = Math.max(hero.shield, active.power);
    hero.shieldUntil = state.now + 4000;
    addEffect(state, 'shield', hero.x, hero.z, 1.8, '#a5b4fc', 800);
  } else if (active.kind === 'heal') {
    const before = hero.hp;
    hero.hp = Math.min(hero.maxHp, hero.hp + active.power);
    hero.healingDone += hero.hp - before;
    addEffect(state, 'heal', hero.x, hero.z, 1.6, '#7bf0a8', 700);
  } else if (active.kind === 'invisible') {
    hero.buffs.push({ type: 'invisible', until: state.now + (active.durationMs ?? 6000), power: 0 });
    addEffect(state, 'shield', hero.x, hero.z, 1.6, '#94a3b8', 500);
  } else {
    hero.buffs.push({ type: 'speed', until: state.now + 4000, power: active.power });
    addEffect(state, 'capture', hero.x, hero.z, 1.4, '#7fe3d4', 500);
  }
  hero.itemCooldowns[itemId] = state.now + active.cooldownMs;
  return true;
}

/** Prodej itemu — vrací vrácené zlato (0 = item nemá). */
export function sellItem(hero: Hero, itemId: ItemId): number {
  const item = ITEM_BY_ID.get(itemId);
  if (!item || !hero.items.includes(itemId)) return 0;
  const refund = Math.round(item.cost * SELL_RATIO);
  hero.items = hero.items.filter((id) => id !== itemId);
  hero.gold = Math.min(GOLD_CAP, hero.gold + refund);
  recomputeHeroStats(hero);
  return refund;
}

/** Najde hrdinu podle id v jakémkoli stavu (pro server i debug). */
export function heroById(state: MobaState, id: string): Hero | null {
  return state.heroes.find((hero) => hero.id === id) ?? null;
}

export interface MobaSnapshot {
  time: number;
  ended: Team | null;
  banner: string | null;
  wave: number;
  nextWaveIn: number;
  nodes: NodeState[];
  towers: { id: string; team: Team; kind: 'tower' | 'nexus' | 'inhibitor'; x: number; z: number; hp: number; maxHp: number }[];
  heroes: {
    id: string;
    team: Team;
    name: string;
    heroId: number;
    x: number;
    z: number;
    hp: number;
    maxHp: number;
    mana: number;
    maxMana: number;
    shield: number;
    level: number;
    xp: number;
    xpNeed: number;
    alive: boolean;
    respawnIn: number;
    cooldowns: Record<SpellSlot, number>;
    kills: number;
    deaths: number;
    gold: number;
    damage: number;
    healing: number;
    items: ItemId[];
    aegis: boolean;
    wards: number;
    sentries: number;
    /** Je hrdina právě neviditelný? (vlastní HUD to musí ukázat) */
    invisible: boolean;
    /** Zbývající cooldowny aktivních itemů (ms). */
    itemCooldowns: Record<string, number>;
    /** Vybrané talenty. */
    talents: { tier: number; pick: number }[];
    /** Nevybraný talent (10/15), null = vybráno. */
    talentPending: number | null;
    /** Cena buybacku; 0 = nedostupný (živý nebo na cooldownu). */
    buybackCost: number;
    buffs: Buff[];
  }[];
  minions: { id: string; team: Team; x: number; z: number; hp: number; maxHp: number; super: boolean }[];
  /** Runy na mapě — kdo je sebere, dostane zlato nebo buff. */
  runes: { id: string; type: RuneType; x: number; z: number }[];
  /** Prastarý strážce (boss) — Aegis a týmové zlato. */
  boss: { id: string; x: number; z: number; hp: number; maxHp: number; alive: boolean; respawnIn: number };
  /** Wardy vlastního týmu (nepřítel je nevidí). */
  wards: { id: string; x: number; z: number }[];
  /** Sentry vlastního týmu. */
  sentries: { id: string; x: number; z: number }[];
  monsters: { id: string; x: number; z: number; hp: number; maxHp: number; type: JungleCamp['type']; alive: boolean }[];
  projectiles: { id: string; x: number; z: number; color: string }[];
  effects: { id: string; kind: Effect['kind']; x: number; z: number; radius: number; color: string; alpha: number }[];
}

/**
 * Prázdný snapshot pro stav „čeká se na hráče".
 *
 * Drží ho **sim**, ne server — když se do snapshotu přidá pole, musí se
 * doplnit tady, ne v druhém ručním literálu (ten už jednou rozbil build
 * niru-net, protože mu chyběly runy a boss).
 */
export function emptyMobaSnapshot(banner: string): MobaSnapshot {
  return {
    time: 0,
    ended: null,
    banner,
    wave: 0,
    nextWaveIn: 0,
    nodes: [],
    towers: [],
    heroes: [],
    minions: [],
    runes: [],
    wards: [],
    sentries: [],
    boss: { id: 'boss', x: 0, z: 0, hp: 0, maxHp: 0, alive: false, respawnIn: 0 },
    monsters: [],
    projectiles: [],
    effects: [],
  };
}

/** Zdroj vidění pro tým — hrdinové, minioni, věže a vlastněné uzly. */
export function visionSources(state: MobaState, team: Team): { x: number; z: number; radius: number }[] {
  const sources: { x: number; z: number; radius: number }[] = [];
  for (const hero of state.heroes) {
    if (hero.team === team && hero.alive) {
      // Orlí oko a jiné itemy vidění rozšiřují okruh — mlha je jejich protihra.
      sources.push({ x: hero.x, z: hero.z, radius: VISION.hero + itemTotals(hero.items).vision + talentTotals(hero).vision });
    }
  }
  for (const minion of state.minions) {
    if (minion.team === team) sources.push({ x: minion.x, z: minion.z, radius: VISION.minion });
  }
  for (const tower of state.towers) {
    if (tower.team === team && tower.hp > 0) sources.push({ x: tower.x, z: tower.z, radius: VISION.tower });
  }
  for (const node of state.nodes) {
    if (node.owner === team) sources.push({ x: node.x, z: node.z, radius: VISION.node });
  }
  for (const ward of state.wards) {
    if (ward.team === team && ward.expiresAt > state.now) {
      sources.push({ x: ward.x, z: ward.z, radius: WARD_VISION });
    }
  }
  return sources;
}

/** Je bod vidět týmem? (Projektil letící mlhou nemá prozradit střelce.) */
export function isVisibleTo(
  sources: { x: number; z: number; radius: number }[],
  x: number,
  z: number,
): boolean {
  for (const source of sources) {
    if (distance(x, z, source.x, source.z) <= source.radius) return true;
  }
  return false;
}

/**
 * Snapshot hry.
 *
 * `viewerTeam` zapíná **mlhu války**: nepřátelské jednotky, monstra
 * a projektily se posílají jen když je tým vidí. Vlastní tým, struktury
 * (věže jde vidět vždycky) a uzly L5 se posílají vždy — bez toho by mapa
 * přestala být mapou.
 *
 * Bez `viewerTeam` se posílá všechno (debug, sólo bez mlhy, divák).
 */
export function mobaSnapshot(state: MobaState, viewerTeam?: Team): MobaSnapshot {
  const sources = viewerTeam ? visionSources(state, viewerTeam) : null;
  // Bush je past na vidění: jednotka v něm je vidět, jen když je zdroj
  // vidění hodně blízko. Odsud se to filtruje pro snapshot (sim vidí vše).
  const sees = (x: number, z: number) => {
    if (!sources) return true;
    if (bushAt(x, z)) {
      return sources.some((source) => distance(source.x, source.z, x, z) <= Math.min(source.radius, BUSH_REVEAL));
    }
    return isVisibleTo(sources, x, z);
  };
  return {
    time: state.time,
    ended: state.ended,
    banner: state.bannerUntil > state.now ? state.banner : null,
    wave: state.wave,
    nextWaveIn: Math.max(0, Math.round((state.nextWaveAt - state.now) / 1000)),
    nodes: state.nodes,
    towers: state.towers
      .filter((tower) => tower.hp > 0 || tower.kind === 'nexus')
      .map((tower) => ({
        id: tower.id,
        team: tower.team,
        kind: tower.kind,
        x: tower.x,
        z: tower.z,
        hp: tower.hp,
        maxHp: tower.maxHp,
      })),
    heroes: state.heroes
      // Nepřítel se posílá jen živý a viděný — mrtvý hrdina v mlze nemá
      // prozrazovat, kde se za 20 s objeví.
      .filter(
        (hero) =>
          !viewerTeam ||
          hero.team === viewerTeam ||
          (hero.alive && sees(hero.x, hero.z) && !isHidden(state, hero, viewerTeam)),
      )
      .map((hero) => ({
        id: hero.id,
        team: hero.team,
        name: hero.name,
        heroId: hero.heroId,
        x: Math.round(hero.x * 100) / 100,
        z: Math.round(hero.z * 100) / 100,
        hp: Math.round(hero.hp),
        maxHp: hero.maxHp,
        mana: Math.round(hero.mana),
        maxMana: hero.maxMana,
        shield: Math.round(hero.shield),
        level: hero.level,
        xp: Math.round(hero.xp),
        xpNeed: xpNeeded(hero.level),
        alive: hero.alive,
        respawnIn: hero.alive ? 0 : Math.max(0, Math.ceil((hero.respawnAt - state.now) / 1000)),
        cooldowns: hero.cooldowns,
        kills: hero.kills,
        deaths: hero.deaths,
        gold: Math.round(hero.gold),
        damage: Math.round(hero.damageDone),
        healing: Math.round(hero.healingDone),
        items: hero.items,
        aegis: hero.aegis,
        wards: hero.wards,
        sentries: hero.sentries,
        invisible: hero.buffs.some((buff) => buff.type === 'invisible' && buff.until > state.now),
        itemCooldowns: Object.fromEntries(
          Object.entries(hero.itemCooldowns).map(([id, at]) => [id, Math.max(0, (at ?? 0) - state.now)]),
        ),
        talents: Object.entries(hero.talentPicks).map(([tier, pick]) => ({ tier: Number(tier), pick })),
        talentPending: pendingTalent(hero),
        buybackCost: !hero.alive && state.now >= hero.buybackAt ? buybackCost(hero) : 0,
        buffs: hero.buffs,
    })),
    minions: state.minions
      .filter((minion) => !viewerTeam || minion.team === viewerTeam || sees(minion.x, minion.z))
      .map((minion) => ({
        id: minion.id,
        team: minion.team,
        x: Math.round(minion.x * 100) / 100,
        z: Math.round(minion.z * 100) / 100,
        hp: minion.hp,
        maxHp: minion.maxHp,
        super: minion.super,
      })),
    runes: state.runes.map((rune) => ({ id: rune.id, type: rune.type, x: rune.x, z: rune.z })),
    wards: state.wards
      .filter((ward) => !viewerTeam || ward.team === viewerTeam)
      .map((ward) => ({ id: ward.id, x: ward.x, z: ward.z })),
    sentries: state.sentries
      .filter((sentry) => !viewerTeam || sentry.team === viewerTeam)
      .map((sentry) => ({ id: sentry.id, x: sentry.x, z: sentry.z })),
    boss: {
      id: state.boss.id,
      x: state.boss.x,
      z: state.boss.z,
      hp: Math.round(state.boss.hp),
      maxHp: state.boss.maxHp,
      alive: state.boss.alive,
      respawnIn: state.boss.alive ? 0 : Math.max(0, Math.ceil((state.boss.respawnAt - state.now) / 1000)),
    },
    monsters: state.monsters
      .filter((monster) => sees(monster.x, monster.z))
      .map((monster) => ({
        id: monster.id,
        x: Math.round(monster.x * 100) / 100,
        z: Math.round(monster.z * 100) / 100,
        hp: monster.alive ? monster.hp : 0,
        maxHp: monster.maxHp,
        type: monster.type,
        alive: monster.alive,
      })),
    projectiles: state.projectiles
      // Projektil v mlze prozradí, odkud letí — vlastní se posílají vždy.
      .filter((projectile) => !viewerTeam || projectile.team === viewerTeam || sees(projectile.x, projectile.z))
      .map((projectile) => ({
        id: projectile.id,
        x: projectile.x,
        z: projectile.z,
        color: projectile.color,
      })),
    effects: state.effects.map((effect) => ({
      id: effect.id,
      kind: effect.kind,
      x: effect.x,
      z: effect.z,
      radius: effect.radius,
      color: effect.color,
      alpha: Math.max(0, effect.ttl / effect.maxTtl),
    })),
  };
}
