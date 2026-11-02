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
import { SCHOOL_TRAITS, spellsFor, type Spell, type SpellSchool, type SpellSlot } from './spells';
import {
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
  SPAWNS,
  STRUCTURES,
  VISION,
  WAVE_INTERVAL_MS,
  WAVE_SIZE,
  isStructureProtected,
  type JungleCamp,
  type LaneId,
  type StructureHp,
  type Team,
} from './map';

export type UnitKind = 'hero' | 'minion' | 'tower' | 'nexus' | 'monster';

export type BuffType = 'strength' | 'ward' | 'speed' | 'ancient' | 'burn' | 'regen';

export interface Buff {
  type: BuffType;
  until: number;
  power: number;
  /** Kdo buff způsobil (hoření) — kvůli připsání zabití. */
  source?: string;
}

/** Tři itemy — každý mění jinou věc, aby šlo hrát „na build". */
export type ItemId = 'blade' | 'aegis' | 'boots';

export interface MobaItem {
  id: ItemId;
  name: { cs: string; en: string };
  cost: number;
  note: { cs: string; en: string };
}

export const ITEMS: MobaItem[] = [
  {
    id: 'blade',
    name: { cs: 'Čepel', en: 'Blade' },
    cost: 400,
    note: { cs: '+25 % poškození', en: '+25% damage' },
  },
  {
    id: 'aegis',
    name: { cs: 'Aegis', en: 'Aegis' },
    cost: 400,
    note: { cs: '+250 max HP, −10 % příchozího poškození', en: '+250 max HP, −10% incoming damage' },
  },
  {
    id: 'boots',
    name: { cs: 'Sandály', en: 'Boots' },
    cost: 400,
    note: { cs: '+15 % rychlosti', en: '+15% movement speed' },
  },
];

/** Základní rychlost hrdiny (m/s) — stejné číslo používá klientská predikce. */
export const BASE_SPEED = 6.2;
export const BLADE_MULT = 1.25;
export const AEGIS_MULT = 0.9;
export const AEGIS_HP = 250;
export const BOOTS_MULT = 1.15;

/** Rychlost podle itemů, buffů a zpomalení. */
export function heroSpeed(hero: { items: ItemId[]; slowFactor: number; buffs?: Buff[] }): number {
  const boots = hero.items.includes('boots') ? BOOTS_MULT : 1;
  let speed = BASE_SPEED * boots * (1 - hero.slowFactor);
  const now = Date.now();
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
  spells: Spell[];
  cooldowns: Record<SpellSlot, number>;
  attackCooldown: number;
  facing: number;
  kills: number;
  deaths: number;
  damageDone: number;
  /** Zlato ze zabití a uzlu; za něj se kupují itemy. */
  gold: number;
  items: ItemId[];
  buffs: Buff[];
  isPlayer: boolean;
  /** Kam se bot zrovna dívá / kam jde (jen pro AI). */
  botLane: LaneId;
  botCast: { slot: SpellSlot; x: number; z: number } | null;
}

export interface Minion {
  id: string;
  team: Team;
  lane: LaneId;
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  cooldown: number;
}

export interface Tower {
  id: string;
  team: Team;
  kind: 'tower' | 'nexus';
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  range: number;
  damage: number;
  attackMs: number;
  cooldown: number;
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

export interface MobaState {
  now: number;
  time: number;
  ended: Team | null;
  heroes: Hero[];
  minions: Minion[];
  monsters: Monster[];
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
    spells: spellsFor(heroId, look.palette.glow),
    cooldowns: { Q: 0, W: 0, E: 0, R: 0 },
    attackCooldown: 0,
    facing: team === 'blue' ? 0 : Math.PI,
    kills: 0,
    deaths: 0,
    damageDone: 0,
    gold: 320,
    items: [],
    buffs: [],
    isPlayer,
    botLane: 'mid',
    botCast: null,
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

/**
 * Zápas z rozpisu sedaček — používá server pro 2v2 i sólo (sólo je jen
 * rozpis se dvěma sedačkami). Počet hrdinů není pevný, sim se přizpůsobí.
 */
export function createMobaMatch(seats: MobaSeat[], now: number): MobaState {
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
    })),
    projectiles: [],
    effects: [],
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
export function createMoba(playerHeroId: number, enemyHeroId: number, now: number): MobaState {
  return createMobaMatch(
    [
      { id: 'hero-you', heroId: playerHeroId, team: 'blue', human: true },
      { id: 'hero-foe', heroId: enemyHeroId, team: 'red', human: false },
    ],
    now,
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
  let mult = hero.items.includes('blade') ? BLADE_MULT : 1;
  for (const buff of hero.buffs) {
    if (buff.until > now && buff.type === 'strength') mult *= 1 + buff.power;
  }
  return mult;
};
/** Příchozí poškození podle itemů a buffů (Aegis tlumí, ward posiluje). */
const damageIn = (hero: Hero, now: number) => {
  let mult = hero.items.includes('aegis') ? AEGIS_MULT : 1;
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
    hero.hp = 0;
    hero.alive = false;
    hero.deaths += 1;
    hero.respawnAt = state.now + (6000 + hero.level * 1200);
    addEffect(state, 'hit', hero.x, hero.z, 2.2, '#ff6b6b', 600);
    const killer = state.heroes.find((candidate) => candidate.id === source);
    if (killer && killer.team !== hero.team) {
      killer.kills += 1;
      killer.gold = Math.min(3000, killer.gold + 180);
      gainXp(state, killer, 140);
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
  if (killer) {
    gainXp(state, killer, 26);
    killer.gold = Math.min(3000, killer.gold + 24);
    killer.damageDone += amount;
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
      killer.gold = Math.min(3000, killer.gold + (camp.type === 'ancient' ? 175 : camp.type === 'medium' ? 90 : 45));
      killer.damageDone += amount;
      applyJungleBuff(killer, camp.type, state.now);
      state.banner = `${killer.name} zabil ${camp.type === 'ancient' ? 'Prastaré stvoření' : camp.type === 'medium' ? 'Středního tábora' : 'Jungle monstra'}`;
      state.bannerUntil = state.now + 3200;
    }
  }
}

function gainXp(state: MobaState, hero: Hero, amount: number) {
  hero.xp += amount;
  for (;;) {
    const need = 120 + hero.level * 70;
    if (hero.xp < need || hero.level >= 15) break;
    hero.xp -= need;
    hero.level += 1;
    hero.maxHp += 55;
    hero.maxMana += 18;
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
  if (!hero.alive || state.now < hero.cooldowns[slot]) return;
  if (hero.mana < spell.mana) return;
  const distanceToPoint = distance(hero.x, hero.z, x, z);
  if (spell.range > 0 && distanceToPoint > spell.range + spell.radius) return;

  hero.mana -= spell.mana;
  hero.cooldowns[slot] = state.now + spell.cooldownMs;
  hero.facing = Math.atan2(x - hero.x, z - hero.z);
  const bonus = nodeBonus(state, hero.team) * levelScale(hero) * damageOut(hero, state.now);

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
      const shield = spell.shield * levelScale(hero);
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
      const heal = spell.heal * levelScale(hero);
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
        hero.hp = Math.min(hero.maxHp, hero.hp + heal);
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

  const move = target.distance > 6 ? 1 : target.distance < 3.4 ? -0.4 : 0;
  const dx = target.x - hero.x;
  const dz = target.z - hero.z;
  const length = Math.hypot(dx, dz) || 1;
  hero.x += (dx / length) * move * 4.4 * (1 / 30);
  hero.z += (dz / length) * move * 4.4 * (1 / 30);

  // kouzla: Q na dostřel, E na skupinu, R na finisher, W při zranění
  const ready = (slot: SpellSlot) => now >= hero.cooldowns[slot];
  const affordable = (slot: SpellSlot) => {
    const spell = hero.spells.find((candidate) => candidate.slot === slot);
    return spell ? hero.mana >= spell.mana : false;
  };

  if (hero.hp < hero.maxHp * 0.55 && ready('W') && affordable('W')) {
    hero.botCast = { slot: 'W', x: hero.x, z: hero.z };
    return;
  }
  if (target.distance < 11 && ready('Q') && affordable('Q')) {
    hero.botCast = { slot: 'Q', x: target.x, z: target.z };
    return;
  }
  if (target.distance < 8 && ready('E') && affordable('E')) {
    hero.botCast = { slot: 'E', x: target.x, z: target.z };
    return;
  }
  if (foe && ready('R') && affordable('R') && distance(hero.x, hero.z, foe.x, foe.z) < 12 && (foe.hp < foe.maxHp * 0.6 || hero.hp < hero.maxHp * 0.4)) {
    hero.botCast = { slot: 'R', x: foe.x, z: foe.z };
    return;
  }
  hero.botCast = null;
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
          const base = team === 'blue' ? SPAWNS.blue : SPAWNS.red;
          state.minions.push({
            id: nextId(`minion-${team}`),
            team,
            lane: lane.id,
            x: base.x + (team === 'blue' ? 6 : -6) + index * 1.4,
            z: lane.z + (index - 1) * 1.2,
            hp: MINION_HP,
            maxHp: MINION_HP,
            cooldown: 0,
          });
        }
      }
    }
    state.banner = `Vlna ${state.wave}`;
    state.bannerUntil = now + 2200;
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

    // Hoření a regenerace — buffy, které působí každý snímek.
    for (const buff of hero.buffs) {
      if (buff.type === 'burn') damageHero(state, hero, buff.power * dt, buff.source ?? 'burn');
      else if (buff.type === 'regen') hero.hp = Math.min(hero.maxHp, hero.hp + buff.power * dt);
    }
    if (!hero.alive) continue;

    const speed = heroSpeed(hero);

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
        let target: Hero | Minion | Monster | null = nearestEnemyHero(state, hero, 6.4) ?? nearestEnemyMinion(state, hero, 6.4);
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
      (hero) => hero.team !== minion.team && hero.alive && distance(minion.x, minion.z, hero.x, hero.z) <= MINION_RANGE,
    );
    const enemyMinion = state.minions.find(
      (other) => other.team !== minion.team && distance(minion.x, minion.z, other.x, other.z) <= MINION_RANGE,
    );

    if (enemyHero || enemyMinion) {
      if (now >= minion.cooldown) {
        minion.cooldown = now + MINION_ATTACK_MS;
        const target = enemyHero ?? enemyMinion!;
        if (enemyHero) damageHero(state, enemyHero, MINION_DAMAGE, minion.id);
        else damageMinion(state, enemyMinion!, MINION_DAMAGE, minion.id);
        addEffect(state, 'hit', target.x, target.z, 0.5, '#ffb877', 150);
      }
      continue;
    }

    const dx = enemyBase.x - minion.x;
    const length = Math.hypot(dx) || 1;
    minion.x += (dx / length) * MINION_SPEED * dt;
    minion.z += Math.sign(lane.z - minion.z) * Math.min(Math.abs(lane.z - minion.z), MINION_SPEED * dt * 0.6);
  }

  // ── věže a Nexy ───────────────────────────────────────────────────
  for (const tower of state.towers) {
    if (tower.hp <= 0) continue;
    if (now < tower.cooldown) continue;
    const minion = state.minions.find(
      (candidate) => candidate.team !== tower.team && distance(tower.x, tower.z, candidate.x, candidate.z) <= tower.range,
    );
    const hero = state.heroes.find(
      (candidate) => candidate.team !== tower.team && candidate.alive && distance(tower.x, tower.z, candidate.x, candidate.z) <= tower.range,
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
      tower.hp = Math.max(0, tower.hp - damage);
      hero.damageDone += damage;
      addEffect(state, 'hit', tower.x, tower.z, 0.8, '#ffe6a8', 180);
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
          hero.gold = Math.min(3000, hero.gold + 70);
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

/** Nákup itemu — vrací `false`, když na něj není zlato nebo už ho má. */
export function buyItem(hero: Hero, itemId: ItemId): boolean {
  const item = ITEMS.find((candidate) => candidate.id === itemId);
  if (!item) return false;
  if (hero.items.includes(itemId)) return false;
  if (hero.gold < item.cost) return false;
  hero.gold -= item.cost;
  hero.items.push(itemId);
  if (itemId === 'aegis') {
    hero.maxHp += AEGIS_HP;
    hero.hp = Math.min(hero.maxHp, hero.hp + AEGIS_HP);
  }
  return true;
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
  towers: { id: string; team: Team; kind: 'tower' | 'nexus'; x: number; z: number; hp: number; maxHp: number }[];
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
    alive: boolean;
    respawnIn: number;
    cooldowns: Record<SpellSlot, number>;
    kills: number;
    deaths: number;
    gold: number;
    items: ItemId[];
    buffs: Buff[];
  }[];
  minions: { id: string; team: Team; x: number; z: number; hp: number; maxHp: number }[];
  monsters: { id: string; x: number; z: number; hp: number; maxHp: number; type: JungleCamp['type']; alive: boolean }[];
  projectiles: { id: string; x: number; z: number; color: string }[];
  effects: { id: string; kind: Effect['kind']; x: number; z: number; radius: number; color: string; alpha: number }[];
}

/** Zdroj vidění pro tým — hrdinové, minioni, věže a vlastněné uzly. */
export function visionSources(state: MobaState, team: Team): { x: number; z: number; radius: number }[] {
  const sources: { x: number; z: number; radius: number }[] = [];
  for (const hero of state.heroes) {
    if (hero.team === team && hero.alive) sources.push({ x: hero.x, z: hero.z, radius: VISION.hero });
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
  const sees = (x: number, z: number) => !sources || isVisibleTo(sources, x, z);
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
      .filter((hero) => !viewerTeam || hero.team === viewerTeam || (hero.alive && sees(hero.x, hero.z)))
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
        alive: hero.alive,
        respawnIn: hero.alive ? 0 : Math.max(0, Math.ceil((hero.respawnAt - state.now) / 1000)),
        cooldowns: hero.cooldowns,
        kills: hero.kills,
        deaths: hero.deaths,
        gold: Math.round(hero.gold),
        items: hero.items,
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
      })),
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
