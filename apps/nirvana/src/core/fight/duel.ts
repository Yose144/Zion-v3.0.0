/**
 * MERKUR — SOUBOJ (duel). Zsdílený modul: počítá ho **klient i server**
 * (`apps/nirvana-net/src/fight.ts`), aby se nikdy nestalo „trefil jsem ho a nic".
 *
 * Koncept: jednoduchá bitska bok po boku (pohled z boku, klec na Merkuru):
 * dva bojovníci na přímce, dopředu/dozadu, skok, pěst, kop, blok.
 * Best-of-3 kol, 60 s na kolo.
 *
 * Pravidlo z Venuše: jedna fyzika pro všechny — hráč posílá input, bot i
 * server používají týž `stepDuel`. Žádný druhý integrátor.
 */

import type { NetIdentity } from '../net/protocol';

// ── konstanty (jedna sada čísel pro klienta i server) ────────────────────

export const ARENA_HALF = 9;         // x ∈ [−9, 9]
export const FIGHTER_GAP = 1.1;      // minimální odstup těl
export const SPEED = 4.2;            // m/s po zemi
export const JUMP_V = 8.2;
export const GRAVITY = 26;
export const MAX_HP = 100;
export const ROUND_SECONDS = 60;
export const ROUNDS_TO_WIN = 2;      // best of 3
export const COUNTDOWN_SECONDS = 3;
export const ROUND_END_SECONDS = 2.5;

export interface AttackSpec {
  startup: number;
  active: number;
  recovery: number;
  damage: number;
  reach: number;
  knockback: number;
}

export const PUNCH: AttackSpec = {
  startup: 0.08,
  active: 0.1,
  recovery: 0.16,
  damage: 7,
  reach: 2.15,
  knockback: 4.5,
};

export const KICK: AttackSpec = {
  startup: 0.14,
  active: 0.12,
  recovery: 0.26,
  damage: 13,
  reach: 2.65,
  knockback: 7,
};

/** Blok přežere 80 % poškození — nikdy ne nula, aby blokování nebylo ne-smrtelné. */
export const BLOCK_DAMAGE_MUL = 0.2;

// ── stavy ─────────────────────────────────────────────────────────────

export interface FightInput {
  /** −1..1 pohyb po ose x (světový směr, ne „vůči soupeři"). */
  move: number;
  jump: boolean;
  punch: boolean;
  kick: boolean;
  block: boolean;
}

export const NO_INPUT: FightInput = { move: 0, jump: false, punch: false, kick: false, block: false };

export type AttackKind = 'punch' | 'kick';

export interface ActiveAttack {
  kind: AttackKind;
  /** Čas od startu úderu (s). */
  elapsed: number;
  /** Už tento úder zasadil zásah? (jedna rána = jedno kolo) */
  hit: boolean;
}

export interface Fighter {
  id: string;
  name: string;
  avatarId: number | null;
  x: number;
  y: number;
  vx: number;
  vy: number;
  onGround: boolean;
  hp: number;
  facing: 1 | -1;
  attack: ActiveAttack | null;
  /** Drží blok (jen pro animaci; pravidla řeší `stepFighter`). */
  blocking: boolean;
  /** Hitstun — pár vteřin, kdy nejde nic dělat. */
  stun: number;
  wins: number;
  ko: boolean;
}

export type DuelPhase = 'countdown' | 'fighting' | 'roundEnd' | 'matchEnd';

export interface DuelEvent {
  kind: 'ko' | 'round_end' | 'match_end' | 'fight_start';
  at: number;
  winner?: string;
  loser?: string;
  reason?: 'ko' | 'time';
}

export interface Duel {
  a: Fighter;
  b: Fighter;
  phase: DuelPhase;
  /** Simulované hodiny (s) — fází řídí `timer`. */
  timer: number;
  round: number;
  events: DuelEvent[];
}

// ── konstruktéry ──────────────────────────────────────────────────────

export function makeFighter(source: Pick<NetIdentity, 'id' | 'name' | 'avatarId'>, x: number, facing: 1 | -1): Fighter {
  return {
    id: source.id,
    name: source.name,
    avatarId: source.avatarId,
    x,
    y: 0,
    vx: 0,
    vy: 0,
    onGround: true,
    hp: MAX_HP,
    facing,
    attack: null,
    blocking: false,
    stun: 0,
    wins: 0,
    ko: false,
  };
}

export function createDuel(
  left: Pick<NetIdentity, 'id' | 'name' | 'avatarId'>,
  right: Pick<NetIdentity, 'id' | 'name' | 'avatarId'>,
): Duel {
  return {
    a: makeFighter(left, -4, 1),
    b: makeFighter(right, 4, -1),
    phase: 'countdown',
    timer: COUNTDOWN_SECONDS,
    round: 1,
    events: [],
  };
}

/** Vynulování pozic i HP pro další kolo; `wins` zůstávají. */
function resetRound(duel: Duel): void {
  for (const [fighter, x, facing] of [
    [duel.a, -4, 1],
    [duel.b, 4, -1],
  ] as [Fighter, number, 1 | -1][]) {
    fighter.x = x;
    fighter.y = 0;
    fighter.vx = 0;
    fighter.vy = 0;
    fighter.onGround = true;
    fighter.hp = MAX_HP;
    fighter.facing = facing;
    fighter.attack = null;
    fighter.blocking = false;
    fighter.stun = 0;
    fighter.ko = false;
  }
}

/**
 * Reset Celého zápasu **bez vyměny objektů** — klient i server drží refy na
 * tytéž bojovníky; when by se objekty přepnuly, animace by četly mrtvý stav.
 */
export function resetDuel(duel: Duel): void {
  duel.a.wins = 0;
  duel.b.wins = 0;
  duel.round = 1;
  duel.phase = 'countdown';
  duel.timer = COUNTDOWN_SECONDS;
  duel.events = [];
  resetRound(duel);
}

// ── simulace ──────────────────────────────────────────────────────────

function specOf(kind: AttackKind): AttackSpec {
  return kind === 'punch' ? PUNCH : KICK;
}

/**
 * Jeden bojovník — pohyb, skok, úder, facing. `stepDuel` to volá v páru;
 * multiplayerový klient volá **přímo** pro vlastní predikci (zásahy a HP
 * rozhoduje server, klient je jen zrcadlí).
 */
export function stepFighter(self: Fighter, other: Fighter, input: FightInput, dt: number): void {
  if (self.ko) return;

  const blocking = input.block && self.onGround && self.stun <= 0 && !self.attack;
  self.blocking = blocking;

  // 1) útok — spouští se hranou, nepovolí se ve vzduchu, ve stunu ani v bloku
  if (!self.attack && self.stun <= 0 && self.onGround && !blocking) {
    if (input.punch) self.attack = { kind: 'punch', elapsed: 0, hit: false };
    else if (input.kick) self.attack = { kind: 'kick', elapsed: 0, hit: false };
  }

  // 2) horizontální pohyb — úder i blok znamená stojí; ve stunu jen dojíždí knockback
  let target = 0;
  if (self.stun <= 0 && !self.attack && !blocking) target = Math.max(-1, Math.min(1, input.move)) * SPEED;
  if (self.stun > 0) self.vx *= Math.max(0, 1 - 8 * dt); // knockback decays
  else self.vx = target;

  // 3) skok
  if (input.jump && self.onGround && self.stun <= 0 && !self.attack && !blocking) {
    self.vy = JUMP_V;
    self.onGround = false;
  }

  // 4) integrace
  self.x += self.vx * dt;
  self.y += self.vy * dt;
  self.vy -= GRAVITY * dt;
  if (self.y <= 0) {
    self.y = 0;
    self.vy = 0;
    self.onGround = true;
  }
  self.x = Math.max(-ARENA_HALF, Math.min(ARENA_HALF, self.x));

  // 5) tváří v tvář soupeři (klasický fighting), ale ne v průběhu úderu
  if (!self.attack && self.stun <= 0 && self.onGround) {
    self.facing = other.x >= self.x ? 1 : -1;
  }

  if (self.stun > 0) self.stun = Math.max(0, self.stun - dt);

  // 6) průběh úderu
  if (self.attack) {
    const spec = specOf(self.attack.kind);
    self.attack.elapsed += dt;
    if (self.attack.elapsed >= spec.startup + spec.recovery + spec.active) self.attack = null;
  }
}

/** Zasadí úder, pokud je soupeř v dosahu, ve slabém svislém překryvu a ještě nezasážený. */
function resolveAttack(attacker: Fighter, defender: Fighter, blocking: boolean, duel: Duel, now: number): void {
  if (!attacker.attack || attacker.attack.hit || defender.ko) return;
  const spec = specOf(attacker.attack.kind);
  if (attacker.attack.elapsed < spec.startup || attacker.attack.elapsed > spec.startup + spec.active) return;

  const dx = (defender.x - attacker.x) * attacker.facing; // kladné = soupeř je „přede mnou"
  if (dx < 0.2 || dx > spec.reach || Math.abs(defender.y - attacker.y) > 1.5) return;

  attacker.attack.hit = true;
  const raw = blocking ? spec.damage * BLOCK_DAMAGE_MUL : spec.damage;
  defender.hp = Math.max(0, defender.hp - Math.round(raw));
  defender.stun = blocking ? 0.1 : 0.28;
  defender.vx = attacker.facing * (blocking ? spec.knockback * 0.5 : spec.knockback);
  defender.attack = null;

  if (defender.hp <= 0) {
    defender.ko = true;
    attacker.wins += 1;
    duel.events.push({ kind: 'ko', at: now, winner: attacker.id, loser: defender.id });
  }
}

/**
 * Jeden simulovaný krok. `dt` je pevný krok (server 1/30 s), `now` jen pro
 * časová razítka eventů — fyzika na něm nezávisí (lekce z Venuše: simulované
 * hodiny, ne `performance.now()`).
 */
export function stepDuel(
  duel: Duel,
  inputA: FightInput,
  inputB: FightInput,
  dt: number,
  now: number,
): DuelEvent[] {
  if (duel.phase === 'countdown') {
    duel.timer -= dt;
    if (duel.timer <= 0) {
      duel.phase = 'fighting';
      duel.timer = ROUND_SECONDS;
      duel.events.push({ kind: 'fight_start', at: now });
    }
    return drain(duel);
  }

  if (duel.phase === 'roundEnd' || duel.phase === 'matchEnd') {
    duel.timer -= dt;
    if (duel.timer <= 0) {
      if (duel.phase === 'matchEnd') return drain(duel);
      if (duel.a.wins >= ROUNDS_TO_WIN || duel.b.wins >= ROUNDS_TO_WIN) {
        duel.phase = 'matchEnd';
        duel.timer = Infinity;
        const winner = duel.a.wins > duel.b.wins ? duel.a : duel.b;
        duel.events.push({ kind: 'match_end', at: now, winner: winner.id });
      } else {
        duel.round += 1;
        resetRound(duel);
        duel.phase = 'countdown';
        duel.timer = COUNTDOWN_SECONDS;
      }
    }
    return drain(duel);
  }

  // ── fighting ────────────────────────────────────────────────────────
  stepFighter(duel.a, duel.b, inputA, dt);
  stepFighter(duel.b, duel.a, inputB, dt);
  resolveAttack(duel.a, duel.b, inputB.block && duel.b.onGround && !duel.b.attack, duel, now);
  resolveAttack(duel.b, duel.a, inputA.block && duel.a.onGround && !duel.a.attack, duel, now);

  // těla se nesmí snoubit — symetrické roztlačení
  const overlap = FIGHTER_GAP - Math.abs(duel.a.x - duel.b.x);
  if (overlap > 0) {
    const dir = duel.a.x <= duel.b.x ? 1 : -1;
    duel.a.x = Math.max(-ARENA_HALF, Math.min(ARENA_HALF, duel.a.x - (dir * overlap) / 2));
    duel.b.x = Math.max(-ARENA_HALF, Math.min(ARENA_HALF, duel.b.x + (dir * overlap) / 2));
  }

  const anyKo = duel.a.ko || duel.b.ko;
  duel.timer -= dt;
  const timeUp = duel.timer <= 0;

  if (anyKo || timeUp) {
    let winner: Fighter | null = null;
    if (timeUp && !anyKo) {
      // na čas: vyšší HP; shoda = kolo pro nikoho (wins se nedají, zápas dál)
      winner = duel.a.hp > duel.b.hp ? duel.a : duel.b.hp > duel.a.hp ? duel.b : null;
      if (winner) winner.wins += 1;
      duel.events.push({
        kind: 'round_end',
        at: now,
        winner: winner?.id,
        reason: 'time',
      });
    } else if (anyKo) {
      winner = duel.a.ko ? duel.b : duel.a;
      duel.events.push({ kind: 'round_end', at: now, winner: winner.id, loser: duel.a.ko ? duel.a.id : duel.b.id, reason: 'ko' });
    }
    duel.phase = 'roundEnd';
    duel.timer = ROUND_END_SECONDS;
  }

  return drain(duel);
}

function drain(duel: Duel): DuelEvent[] {
  const events = duel.events;
  duel.events = [];
  return events;
}

// ── bot (sólo cvičení) ─────────────────────────────────────────────────

export interface BotMemory {
  /** Simulovaný čas dalšího rozhodnutí. */
  nextThink: number;
  pick: AttackKind;
  blockUntil: number;
  seed: number;
}

export type BotDifficulty = 'gentle' | 'standard' | 'champion';

interface BotTuning {
  thinkEvery: number;
  thinkJitter: number;
  kickChance: number;
  guardChance: number;
}

const BOT_TUNING: Record<BotDifficulty, BotTuning> = {
  gentle: { thinkEvery: 0.52, thinkJitter: 0.28, kickChance: 0.22, guardChance: 0.12 },
  standard: { thinkEvery: 0.25, thinkJitter: 0.2, kickChance: 0.4, guardChance: 0.44 },
  champion: { thinkEvery: 0.12, thinkJitter: 0.1, kickChance: 0.55, guardChance: 0.82 },
};

export function makeBotMemory(): BotMemory {
  return { nextThink: 0, pick: 'punch', blockUntil: 0, seed: 1 };
}

/** Deterministický PRNG (mulberry32) — bot musí být naprosto opakovatelný. */
function rand(memory: BotMemory): number {
  memory.seed = (memory.seed + 0x6d2b79f5) | 0;
  let t = memory.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Bot míří na soupeře, drží odstup a útočí v dosahu. Rozhoduje se v
 * simulovaných intervalech (ne každý frame); obtížnost mění reakční dobu,
 * výběr kopů a pravděpodobnost, že zareaguje blokem.
 */
export function botInput(
  duel: Duel,
  memory: BotMemory,
  self: Fighter,
  foe: Fighter,
  clock: number,
  difficulty: BotDifficulty = 'standard',
): FightInput {
  if (duel.phase !== 'fighting') return NO_INPUT;

  const tuning = BOT_TUNING[difficulty];
  if (clock >= memory.nextThink) {
    memory.nextThink = clock + tuning.thinkEvery + rand(memory) * tuning.thinkJitter;
    memory.pick = rand(memory) < tuning.kickChance ? 'kick' : 'punch';
    if (foe.attack && rand(memory) < tuning.guardChance) {
      memory.blockUntil = clock + (difficulty === 'champion' ? 0.48 : 0.36);
    }
  }

  const dx = foe.x - self.x;
  const distance = Math.abs(dx);
  const want = specOf(memory.pick).reach - 0.45;
  let move = 0;
  if (distance > want) move = dx > 0 ? 1 : -1;
  else if (distance < want - 0.6) move = dx > 0 ? -1 : 1;

  return {
    move,
    jump: false,
    punch: distance <= specOf(memory.pick).reach && memory.pick === 'punch',
    kick: distance <= specOf(memory.pick).reach && memory.pick === 'kick',
    block: clock < memory.blockUntil,
  };
}
