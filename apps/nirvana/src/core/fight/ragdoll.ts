/**
 * MERKUR — RAGDOLL SOUBOJ (styl Ragdoll Masters).
 *
 * Jediný modul, který počítá **klient i server** (`apps/nirvana-net/src/fight.ts`
 * ho importuje relativně, stejně jako `arena`/`race`). Když se změní síla úderu
 * nebo tuhost kloubů, mění se na jednom místě — jinak by hráč viděl jiné zásahy,
 * než počítá server.
 *
 * Loutka je 2D (x, y) postava z 11 bodů spojených distance constraints
 * (PBD/Verlet). Vstup neříká „pěst", ale **pohyb a švih**: A/D tlačí tělo,
 * W nadskočí, J vyšle ruku, K vyšle nohu, S zpevní kryt. Zásah vzniká jen
 * tehdy, když se letící končetina opravdu srazí se soupeřem dostatečnou
 * rychlostí — odtud „fyzikální" souboj.
 *
 * Módy (jeden engine, různá pravidla):
 *   duel     — 1v1, best of 3, 60 s na kolo, HP.
 *   ball     — ragdoll fotbal: dopravit míč do soupeřovy branky, 90 s.
 *   survival — nekonečné vlny botů, HP přežívá, skóre = vlny.
 *   practice — trénink proti nemrtvé figuríně, HP se regeneruje.
 */

import type { NetIdentity } from '../net/protocol';

// ── konstanty (jedna sada čísel pro klienta i server) ──────────────────────

export const ARENA_HALF = 10;
export const MAX_HP = 100;
export const ROUND_SECONDS = 60;
export const BALL_SECONDS = 90;
export const ROUNDS_TO_WIN = 2;
export const COUNTDOWN_SECONDS = 3;
export const ROUND_END_SECONDS = 2.5;
export const BALL_RADIUS = 0.42;
export const GOAL_HEIGHT = 2.8;
export const GRAVITY = 22;

/** Indexy bodů loutky. Pořadí je součást drátu (`pose`), neměnit. */
export const P = {
  HEAD: 0,
  CHEST: 1,
  PELVIS: 2,
  ELBOW_L: 3,
  HAND_L: 4,
  ELBOW_R: 5,
  HAND_R: 6,
  KNEE_L: 7,
  FOOT_L: 8,
  KNEE_R: 9,
  FOOT_R: 10,
} as const;

export const POINT_COUNT = 11;

/** Poloměry pro kolize (m). */
export const POINT_RADIUS: number[] = [0.2, 0.27, 0.25, 0.09, 0.12, 0.09, 0.12, 0.11, 0.13, 0.11, 0.13];

/** Hmotnosti (vyšší = těžší = méně se posune při řešení constraintů). */
const POINT_MASS: number[] = [0.9, 1.7, 1.5, 0.45, 0.45, 0.45, 0.45, 0.7, 0.65, 0.7, 0.65];
const INV_MASS: number[] = POINT_MASS.map((mass) => 1 / mass);

interface Joint {
  a: number;
  b: number;
  rest: number;
  stiffness: number;
}

const JOINTS: Joint[] = [
  { a: P.HEAD, b: P.CHEST, rest: 0.33, stiffness: 1 },
  { a: P.CHEST, b: P.PELVIS, rest: 0.58, stiffness: 1 },
  { a: P.CHEST, b: P.ELBOW_L, rest: 0.32, stiffness: 0.92 },
  { a: P.ELBOW_L, b: P.HAND_L, rest: 0.3, stiffness: 0.92 },
  { a: P.CHEST, b: P.ELBOW_R, rest: 0.32, stiffness: 0.92 },
  { a: P.ELBOW_R, b: P.HAND_R, rest: 0.3, stiffness: 0.92 },
  { a: P.PELVIS, b: P.KNEE_L, rest: 0.46, stiffness: 0.96 },
  { a: P.KNEE_L, b: P.FOOT_L, rest: 0.46, stiffness: 0.96 },
  { a: P.PELVIS, b: P.KNEE_R, rest: 0.46, stiffness: 0.96 },
  { a: P.KNEE_R, b: P.FOOT_R, rest: 0.46, stiffness: 0.96 },
];

/** Segmenty pro renderer — ať si scéna nepočítá vlastní tabulku. */
export const RENDER_SEGMENTS: { a: number; b: number; radius: number; kind: 'torso' | 'arm' | 'leg' }[] = [
  { a: P.HEAD, b: P.CHEST, radius: 0.11, kind: 'torso' },
  { a: P.CHEST, b: P.PELVIS, radius: 0.21, kind: 'torso' },
  { a: P.CHEST, b: P.ELBOW_L, radius: 0.075, kind: 'arm' },
  { a: P.ELBOW_L, b: P.HAND_L, radius: 0.068, kind: 'arm' },
  { a: P.CHEST, b: P.ELBOW_R, radius: 0.075, kind: 'arm' },
  { a: P.ELBOW_R, b: P.HAND_R, radius: 0.068, kind: 'arm' },
  { a: P.PELVIS, b: P.KNEE_L, radius: 0.1, kind: 'leg' },
  { a: P.KNEE_L, b: P.FOOT_L, radius: 0.085, kind: 'leg' },
  { a: P.PELVIS, b: P.KNEE_R, radius: 0.1, kind: 'leg' },
  { a: P.KNEE_R, b: P.FOOT_R, radius: 0.085, kind: 'leg' },
];

/** Body, kterými lze zasáhnout (rychlost rozhoduje o síle). */
const STRIKERS: { index: number; power: number }[] = [
  { index: P.HEAD, power: 1.25 },
  { index: P.HAND_L, power: 0.85 },
  { index: P.HAND_R, power: 0.85 },
  { index: P.FOOT_L, power: 1.15 },
  { index: P.FOOT_R, power: 1.15 },
  { index: P.KNEE_L, power: 0.8 },
  { index: P.KNEE_R, power: 0.8 },
  { index: P.ELBOW_L, power: 0.6 },
  { index: P.ELBOW_R, power: 0.6 },
];

/** Tělo, které může být zasaženo. */
const BODY: number[] = [P.HEAD, P.CHEST, P.PELVIS];

/** Dosah pěsti a kopu v metrech mezi středy těl — čte i bot a testy. */
export const PUNCH_REACH = 1.34;
export const KICK_REACH = 1.62;

/** Minimální rychlost končetiny, od které se počítá poškození (m/s). */
const HIT_MIN_SPEED = 3.0;
/** Násobek (rychlost − práh) na poškození. */
const HIT_DAMAGE = 3.2;
/** Maximální poškození jednoho zásahu. */
const HIT_MAX = 28;
/**
 * „Dosah pěsti“: švihající končetina má větší efektivní poloměr, protože
 * se do zásahu počítá i moment hybnosti. Bez toho by pěst musela být
 * doslova uvnitř trupu, aby zabrala.
 */
const STRIKE_RADIUS_BONUS = 0.28;

const MOVE_SPEED = 5.2;
const MOVE_RESPONSE = 11;

const AIR_DRAG = 0.9;
const KNOCK_DRAG = 3.2;
const GUARD_DRAG = 2.6;

// ── typy ───────────────────────────────────────────────────────────────────

export type FightMode = 'duel' | 'ball' | 'survival' | 'practice';
export type RagdollPhase = 'countdown' | 'playing' | 'roundEnd' | 'matchEnd';
export type BotDifficulty = 'gentle' | 'standard' | 'champion';

export interface FightInput {
  /** −1..1 pohyb těla po ose x. */
  move: number;
  jump: boolean;
  punch: boolean;
  kick: boolean;
  block: boolean;
}

export const NO_INPUT: FightInput = { move: 0, jump: false, punch: false, kick: false, block: false };

export interface RagdollFighter {
  id: string;
  name: string;
  avatarId: number | null;
  /** Pozice a rychlosti jednotlivých bodů (indexy z `P`). */
  x: number[];
  y: number[];
  vx: number[];
  vy: number[];
  /**
   * „Nárazové“ rychlosti: posun před posturální stabilizací. Postura umí
   * trhnout tělem o desítky centimetrů a bez toho by zvednutí loutky
   * vyrobilo falešný zásah o rychlosti 20 m/s (reálně se to stalo).
   */
  ivx: number[];
  ivy: number[];
  hp: number;
  /** Vyhraná kola (duel). */
  wins: number;
  /** Branky (ball). */
  score: number;
  ko: boolean;
  guard: boolean;
  stun: number;
  /** Po zásahu se chvíli neřídí vstupem (knockback má přednost). */
  knock: number;
  facing: 1 | -1;
  /** Ochlazení mezi zásahy (aby jeden švih nezasáhl 5×). */
  hitCooldown: number;
  /** Ochlazení mezi švihy (držený útok opakuje). */
  strikeCooldown: number;
  hitFlash: number;
  isBot: boolean;
  /** Statistiky pro HUD. */
  hits: number;
  bestHit: number;
  prevJump: boolean;
}

export interface RagdollBall {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export type RagdollEvent =
  | { kind: 'fight_start'; at: number }
  | { kind: 'ko'; at: number; winner: string; loser: string }
  | { kind: 'round_end'; at: number; winner: string | null; reason: 'ko' | 'time' }
  | { kind: 'match_end'; at: number; winner: string | null }
  | { kind: 'hit'; at: number; by: string; on: string; damage: number; speed: number; x: number; y: number }
  | { kind: 'goal'; at: number; side: 'a' | 'b'; scoreA: number; scoreB: number }
  | { kind: 'wave_start'; at: number; wave: number }
  | { kind: 'wave_end'; at: number; wave: number };

export interface RagdollMatch {
  mode: FightMode;
  a: RagdollFighter;
  b: RagdollFighter;
  ball: RagdollBall | null;
  phase: RagdollPhase;
  /** Fázový časovač (odpočet / zbývající čas kola / pauza po kole). */
  timer: number;
  round: number;
  wave: number;
  /** Odehraný čas v módu (survival, ball). */
  elapsed: number;
  /** Kdo dal poslední gól (ball) — výkop dostane inkasující strana. */
  lastScorer: 'a' | 'b' | null;
  /** Střídání pořadí srážek s míčem — jinak poslední v cyklu vždy vyhrává. */
  ballSeq: number;
}

export interface RagdollIdentity {
  id: string;
  name: string;
  avatarId: number | null;
}

type IdentityLike = Pick<NetIdentity, 'id' | 'name' | 'avatarId'>;

// ── konstruktéry ───────────────────────────────────────────────────────────

const SPAWN: [number, number][] = [
  [0, 1.88], // head
  [0, 1.55], // chest
  [0, 0.97], // pelvis
  [-0.34, 1.3], // elbow L
  [-0.42, 1.02], // hand L
  [0.34, 1.3], // elbow R
  [0.42, 1.02], // hand R
  [-0.17, 0.58], // knee L
  [-0.2, 0.14], // foot L
  [0.17, 0.58], // knee R
  [0.2, 0.14], // foot R
];

export function makeRagdollFighter(source: RagdollIdentity | IdentityLike, x: number, facing: 1 | -1): RagdollFighter {
  const px: number[] = [];
  const py: number[] = [];
  for (let i = 0; i < POINT_COUNT; i++) {
    const point = SPAWN[i]!;
    px.push(x + point[0]);
    py.push(point[1]);
  }
  return {
    id: source.id,
    name: source.name,
    avatarId: source.avatarId ?? null,
    x: px,
    y: py,
    vx: new Array<number>(POINT_COUNT).fill(0),
    vy: new Array<number>(POINT_COUNT).fill(0),
    ivx: new Array<number>(POINT_COUNT).fill(0),
    ivy: new Array<number>(POINT_COUNT).fill(0),
    hp: MAX_HP,
    wins: 0,
    score: 0,
    ko: false,
    guard: false,
    stun: 0,
    knock: 0,
    facing,
    hitCooldown: 0,
    strikeCooldown: 0,
    hitFlash: 0,
    isBot: false,
    hits: 0,
    bestHit: 0,
    prevJump: false,
  };
}

function placeFighter(f: RagdollFighter, x: number, facing: 1 | -1): void {
  for (let i = 0; i < POINT_COUNT; i++) {
    const point = SPAWN[i]!;
    f.x[i] = x + point[0];
    f.y[i] = point[1];
    f.vx[i] = 0;
    f.vy[i] = 0;
    f.ivx[i] = 0;
    f.ivy[i] = 0;
  }
  f.facing = facing;
  f.ko = false;
  f.guard = false;
  f.stun = 0;
  f.knock = 0;
  f.hitCooldown = 0;
  f.strikeCooldown = 0;
  f.prevJump = false;
}

export function createRagdollMatch(
  mode: FightMode,
  left: RagdollIdentity | IdentityLike,
  right: RagdollIdentity | IdentityLike,
): RagdollMatch {
  const a = makeRagdollFighter(left, -3.4, 1);
  const b = makeRagdollFighter(right, 3.4, -1);
  const match: RagdollMatch = {
    mode,
    a,
    b,
    ball: mode === 'ball' ? { x: 0, y: 0.6, vx: 0, vy: 0 } : null,
    phase: 'countdown',
    timer: COUNTDOWN_SECONDS,
    round: 1,
    wave: 1,
    elapsed: 0,
    lastScorer: null,
    ballSeq: 0,
  };
  if (mode === 'survival') {
    b.hp = 60;
    match.timer = 2;
  }
  return match;
}

/** Reset pozic pro nové kolo / novou vlnu (wins a skóre zůstávají). */
function resetPositions(match: RagdollMatch): void {
  placeFighter(match.a, -3.4, 1);
  placeFighter(match.b, 3.4, -1);
  if (match.mode === 'survival') {
    match.b.hp = Math.min(180, 60 + (match.wave - 1) * 24);
  } else {
    match.a.hp = MAX_HP;
    match.b.hp = MAX_HP;
  }
  if (match.ball) {
    match.ball.x = 0;
    match.ball.y = 0.6;
    match.ball.vx = 0;
    match.ball.vy = 0;
  }
}

/** Nové kolo duelu — `wins` zůstávají. */
function resetRound(match: RagdollMatch): void {
  resetPositions(match);
  match.phase = 'countdown';
  match.timer = COUNTDOWN_SECONDS;
}

/**
 * Restart celého zápasu **bez výměny objektů** — renderer drží refy na
 * `match.a`/`match.b`, takže nový objekt by nechal loutky viset ve mrtvém stavu.
 */
export function resetRagdollMatch(match: RagdollMatch): void {
  match.a.wins = 0;
  match.b.wins = 0;
  match.a.score = 0;
  match.b.score = 0;
  match.a.hits = 0;
  match.b.hits = 0;
  match.a.bestHit = 0;
  match.b.bestHit = 0;
  match.a.hp = MAX_HP;
  match.b.hp = match.mode === 'survival' ? 60 : MAX_HP;
  match.round = 1;
  match.wave = 1;
  match.elapsed = 0;
  match.lastScorer = null;
  match.phase = 'countdown';
  match.timer = match.mode === 'survival' ? 2 : COUNTDOWN_SECONDS;
  placeFighter(match.a, -3.4, 1);
  placeFighter(match.b, 3.4, -1);
  if (match.ball) {
    match.ball.x = 0;
    match.ball.y = 0.6;
    match.ball.vx = 0;
    match.ball.vy = 0;
  }
}

// ── odvozené hodnoty ───────────────────────────────────────────────────────

export function centerOf(f: RagdollFighter): { x: number; y: number } {
  return { x: f.x[P.CHEST]!, y: f.y[P.CHEST]! };
}

/** Střed těla (mezi hrudníkem a pánví) — pro kameru a HUD. */
export function bodyCenterOf(f: RagdollFighter): { x: number; y: number } {
  return {
    x: ((f.x[P.CHEST]! + f.x[P.PELVIS]!) / 2),
    y: ((f.y[P.CHEST]! + f.y[P.PELVIS]!) / 2),
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Drátová podoba pózy: ploché [x0,y0,x1,y1,…] (22 čísel). */
export function poseOf(f: RagdollFighter): number[] {
  const pose: number[] = [];
  for (let i = 0; i < POINT_COUNT; i++) {
    pose.push(round2(f.x[i]!), round2(f.y[i]!));
  }
  return pose;
}

/** Zápis pózy ze serveru do klienta (rychlosti se nulují — klient nepredikuje). */
export function applyPose(f: RagdollFighter, pose: number[] | null | undefined): void {
  if (!pose || pose.length < POINT_COUNT * 2) return;
  for (let i = 0; i < POINT_COUNT; i++) {
    f.x[i] = pose[i * 2]!;
    f.y[i] = pose[i * 2 + 1]!;
    f.vx[i] = 0;
    f.vy[i] = 0;
    f.ivx[i] = 0;
    f.ivy[i] = 0;
  }
}

export function setModeTimer(match: RagdollMatch): void {
  if (match.phase !== 'playing') return;
  match.timer = match.mode === 'duel' ? ROUND_SECONDS : 0;
}

// ── fyzika ─────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

function grounded(f: RagdollFighter): boolean {
  return (
    f.y[P.FOOT_L]! <= POINT_RADIUS[P.FOOT_L]! + 0.06 ||
    f.y[P.FOOT_R]! <= POINT_RADIUS[P.FOOT_R]! + 0.06 ||
    f.y[P.PELVIS]! <= POINT_RADIUS[P.PELVIS]! + 0.06
  );
}

function solveJoints(f: RagdollFighter): void {
  const x = f.x;
  const y = f.y;
  for (let iteration = 0; iteration < 5; iteration++) {
    for (const joint of JOINTS) {
      const ai = joint.a;
      const bi = joint.b;
      const ax = x[ai]!;
      const ay = y[ai]!;
      const bx = x[bi]!;
      const by = y[bi]!;
      let dx = bx - ax;
      let dy = by - ay;
      const distance = Math.hypot(dx, dy) || 1e-6;
      if (distance < 1e-5) {
        dx = 1e-3;
        dy = 0;
      }
      const difference = (distance - joint.rest) / distance;
      const total = INV_MASS[ai]! + INV_MASS[bi]!;
      const moveA = difference * (INV_MASS[ai]! / total) * joint.stiffness;
      const moveB = difference * (INV_MASS[bi]! / total) * joint.stiffness;
      x[ai] = ax + dx * moveA;
      y[ai] = ay + dy * moveA;
      x[bi] = bx - dx * moveB;
      y[bi] = by - dy * moveB;
    }
  }
}

function clampWorld(f: RagdollFighter, mode: FightMode): void {
  for (let i = 0; i < POINT_COUNT; i++) {
    const radius = POINT_RADIUS[i]!;
    if (f.y[i]! < radius) {
      f.y[i] = radius;
      if (f.vy[i]! < 0) f.vy[i] = 0;
    }
    // strop je měkký — kdyby někdo vyletěl, vrátí se do klece
    if (f.y[i]! > 16) {
      f.y[i] = 16;
      if (f.vy[i]! > 0) f.vy[i] = 0;
    }
    const limit = ARENA_HALF - radius;
    if (mode === 'ball') {
      // v ragdoll fotbale stojí bojovníci před brankou, ne v ní
      f.x[i] = clamp(f.x[i]!, -limit, limit);
    } else {
      f.x[i] = clamp(f.x[i]!, -limit, limit);
    }
  }
}

function applyLocomotion(f: RagdollFighter, input: FightInput, sub: number): void {
  if (f.ko || f.stun > 0 || f.knock > 0) return;
  const move = clamp(input.move, -1, 1);
  const target = move * MOVE_SPEED * (f.guard ? 0.45 : 1);
  const response = Math.min(1, MOVE_RESPONSE * sub);
  // horní tělo se naklání do směru, nohy jdou o kousek méně
  const weights: number[] = [0.9, 1, 0.9, 0.7, 0.7, 0.7, 0.7, 0.6, 0.5, 0.6, 0.5];
  for (let i = 0; i < POINT_COUNT; i++) {
    const weight = weights[i]!;
    f.vx[i] = f.vx[i]! + (target * weight - f.vx[i]!) * response;
  }
}

function strikeHand(f: RagdollFighter): void {
  const dir = f.facing;
  const hand = dir === 1 ? P.HAND_R : P.HAND_L;
  const elbow = dir === 1 ? P.ELBOW_R : P.ELBOW_L;
  f.vx[hand] = f.vx[hand]! + dir * 10.4;
  f.vy[hand] = f.vy[hand]! + 2.4;
  f.vx[elbow] = f.vx[elbow]! + dir * 6.4;
  f.vy[elbow] = f.vy[elbow]! + 0.8;
  f.vx[P.CHEST] = f.vx[P.CHEST]! - dir * 1.7;
  f.vx[P.PELVIS] = f.vx[P.PELVIS]! - dir * 0.8;
  f.vx[P.HEAD] = f.vx[P.HEAD]! - dir * 0.7;
}

function strikeLeg(f: RagdollFighter): void {
  const dir = f.facing;
  const foot = dir === 1 ? P.FOOT_R : P.FOOT_L;
  const knee = dir === 1 ? P.KNEE_R : P.KNEE_L;
  f.vx[foot] = f.vx[foot]! + dir * 12.4;
  f.vy[foot] = f.vy[foot]! + 3.1;
  f.vx[knee] = f.vx[knee]! + dir * 7.8;
  f.vy[knee] = f.vy[knee]! + 1.2;
  f.vx[P.PELVIS] = f.vx[P.PELVIS]! - dir * 1.8;
  f.vx[P.CHEST] = f.vx[P.CHEST]! - dir * 0.9;
}

function stepFighter(
  f: RagdollFighter,
  input: FightInput,
  sub: number,
  firstSubstep: boolean,
): void {
  const prevX = new Array<number>(POINT_COUNT);
  const prevY = new Array<number>(POINT_COUNT);

  f.stun = Math.max(0, f.stun - sub);
  f.knock = Math.max(0, f.knock - sub);
  f.hitCooldown = Math.max(0, f.hitCooldown - sub);
  f.strikeCooldown = Math.max(0, f.strikeCooldown - sub);
  f.hitFlash = Math.max(0, f.hitFlash - sub);

  const alive = !f.ko;
  const guarding = alive && input.block && f.stun <= 0;
  f.guard = guarding;

  if (alive && !guarding && f.stun <= 0) {
    if (input.punch && f.strikeCooldown <= 0) {
      strikeHand(f);
      f.strikeCooldown = 0.3;
    }
    if (input.kick && f.strikeCooldown <= 0) {
      strikeLeg(f);
      f.strikeCooldown = 0.44;
    }
  }

  if (firstSubstep && input.jump && !f.prevJump && alive && f.stun <= 0 && grounded(f) && !guarding) {
    for (let i = 0; i < POINT_COUNT; i++) {
      f.vy[i] = f.vy[i]! + 6.4;
    }
    f.vy[P.CHEST] = f.vy[P.CHEST]! + 1.1;
  }
  f.prevJump = input.jump;

  applyLocomotion(f, input, sub);

  const drag = f.ko ? 1.8 : f.knock > 0 ? KNOCK_DRAG : guarding ? GUARD_DRAG : AIR_DRAG;
  const dragFactor = Math.max(0, 1 - drag * sub);

  for (let i = 0; i < POINT_COUNT; i++) {
    let vx = f.vx[i]! * dragFactor;
    let vy = f.vy[i]! * dragFactor - GRAVITY * sub;
    if (f.ko) {
      vx *= 0.98;
      vy += 2 * sub;
    }
    f.vx[i] = vx;
    f.vy[i] = vy;
    prevX[i] = f.x[i]!;
    prevY[i] = f.y[i]!;
    f.x[i] = f.x[i]! + vx * sub;
    f.y[i] = f.y[i]! + vy * sub;
  }

  solveJoints(f);
  clampWorld(f, 'duel');
  keepLimbsOut(f);

  // nárazová rychlost = pohyb PŘED posturální stabilizací
  for (let i = 0; i < POINT_COUNT; i++) {
    f.ivx[i] = (f.x[i]! - prevX[i]!) / sub;
    f.ivy[i] = (f.y[i]! - prevY[i]!) / sub;
  }
  applyPosture(f, input, sub);

  // skutečná rychlost (pro míč a další krok) = i s posturou
  for (let i = 0; i < POINT_COUNT; i++) {
    f.vx[i] = (f.x[i]! - prevX[i]!) / sub;
    f.vy[i] = (f.y[i]! - prevY[i]!) / sub;
  }
}

/** Jemné odpuzování koncových bodů od trupu — aby se loutka nepropadla do sebe. */
function keepLimbsOut(f: RagdollFighter): void {
  const pairs: [number, number, number][] = [
    [P.HAND_L, P.CHEST, 0.28],
    [P.HAND_R, P.CHEST, 0.28],
    [P.HAND_L, P.PELVIS, 0.26],
    [P.HAND_R, P.PELVIS, 0.26],
    [P.FOOT_L, P.PELVIS, 0.3],
    [P.FOOT_R, P.PELVIS, 0.3],
  ];
  for (const [end, core, min] of pairs) {
    const dx = f.x[end]! - f.x[core]!;
    const dy = f.y[end]! - f.y[core]!;
    const distance = Math.hypot(dx, dy) || 1e-6;
    if (distance >= min) continue;
    const push = (min - distance) / distance;
    f.x[end] = f.x[end]! + dx * push;
    f.y[end] = f.y[end]! + dy * push;
  }
}

/**
 * Posturální stabilizace — loutka není hadr na podlaze, ale bojovník, který
 * se drží na nohou. Bez toho by se při prvním kroku složila (naměřeno:
 * hrudník spadl z 1,55 m na 0,27 m) a žádný úder by nebyl vidět.
 *
 * Vypíná se při KO, stunu a knockbacku — tehdy má loutka opravdu „vlát“.
 * Ve vzduchu se taky necvičí; jinak by postava levitovala.
 */
function applyPosture(f: RagdollFighter, input: FightInput, sub: number): void {
  if (f.ko || f.stun > 0 || f.knock > 0) return;
  const footY = Math.max(f.y[P.FOOT_L]!, f.y[P.FOOT_R]!);
  const onGround = footY <= POINT_RADIUS[P.FOOT_L]! + 0.12 || f.y[P.PELVIS]! <= 0.75;
  if (!onGround) return;

  const k = Math.min(1, 18 * sub);
  const lean = clamp(input.move, -1, 1) * 0.15;

  // pánev drží výšku těla (nohy se tím narovnají)
  f.y[P.PELVIS] = f.y[P.PELVIS]! + (1 - f.y[P.PELVIS]!) * k;
  // hrudník nad pánví, s náklonem do směru pohybu
  const chestX = f.x[P.PELVIS]! + lean * 0.5;
  const chestY = f.y[P.PELVIS]! + 0.58;
  f.x[P.CHEST] = f.x[P.CHEST]! + (chestX - f.x[P.CHEST]!) * k;
  f.y[P.CHEST] = f.y[P.CHEST]! + (chestY - f.y[P.CHEST]!) * k;
  // hlava nad hrudníkem
  f.x[P.HEAD] = f.x[P.HEAD]! + (f.x[P.CHEST]! + lean * 0.4 - f.x[P.HEAD]!) * k;
  f.y[P.HEAD] = f.y[P.HEAD]! + (f.y[P.CHEST]! + 0.33 - f.y[P.HEAD]!) * k;

  // kolena a chodidla pod pánví — jinak by nohy vlály do stran
  // (při kopu se noha neuvolňuje, jinak by postura tlumila samotný švih)
  if (!input.kick) {
    const legK = Math.min(1, 8 * sub);
    f.x[P.KNEE_L] = f.x[P.KNEE_L]! + (f.x[P.PELVIS]! - 0.17 - f.x[P.KNEE_L]!) * legK;
    f.x[P.KNEE_R] = f.x[P.KNEE_R]! + (f.x[P.PELVIS]! + 0.17 - f.x[P.KNEE_R]!) * legK;
    f.x[P.FOOT_L] = f.x[P.FOOT_L]! + (f.x[P.KNEE_L]! - 0.04 - f.x[P.FOOT_L]!) * legK;
    f.x[P.FOOT_R] = f.x[P.FOOT_R]! + (f.x[P.KNEE_R]! + 0.04 - f.x[P.FOOT_R]!) * legK;
  }
}

function collideFighters(a: RagdollFighter, b: RagdollFighter): void {
  for (let i = 0; i < POINT_COUNT; i++) {
    const ax = a.x[i]!;
    const ay = a.y[i]!;
    const radiusA = POINT_RADIUS[i]!;
    for (let j = 0; j < POINT_COUNT; j++) {
      const bx = b.x[j]!;
      const by = b.y[j]!;
      let dx = bx - ax;
      let dy = by - ay;
      const distance = Math.hypot(dx, dy);
      const minimum = radiusA + POINT_RADIUS[j]!;
      if (distance >= minimum || distance < 1e-6) continue;
      const overlap = (minimum - distance) * 0.6;
      dx /= distance;
      dy /= distance;
      const total = INV_MASS[i]! + INV_MASS[j]!;
      const moveA = overlap * (INV_MASS[i]! / total);
      const moveB = overlap * (INV_MASS[j]! / total);
      a.x[i] = a.x[i]! - dx * moveA;
      a.y[i] = a.y[i]! - dy * moveA;
      b.x[j] = b.x[j]! + dx * moveB;
      b.y[j] = b.y[j]! + dy * moveB;
    }
  }
}

function simulate(match: RagdollMatch, inputA: FightInput, inputB: FightInput, dt: number): void {
  const substeps = Math.max(1, Math.min(4, Math.ceil(dt / (1 / 120))));
  const sub = dt / substeps;
  for (let step = 0; step < substeps; step++) {
    stepFighter(match.a, inputA, sub, step === 0);
    stepFighter(match.b, inputB, sub, step === 0);
    collideFighters(match.a, match.b);
    clampWorld(match.a, match.mode);
    clampWorld(match.b, match.mode);
  }
  syncFacing(match);
}

function syncFacing(match: RagdollMatch): void {
  if (match.mode === 'ball') {
    // v ragdoll fotbale se neotáčí podle soupeře, ale podle branky, kterou útočí
    match.a.facing = 1;
    match.b.facing = -1;
    return;
  }
  const a = centerOf(match.a);
  const b = centerOf(match.b);
  if (!match.a.ko) match.a.facing = b.x >= a.x ? 1 : -1;
  if (!match.b.ko) match.b.facing = a.x >= b.x ? 1 : -1;
}

// ── zásahy ─────────────────────────────────────────────────────────────────

export function hitDamage(speed: number, power: number, guard: boolean): number {
  if (speed <= HIT_MIN_SPEED) return 0;
  const raw = (speed - HIT_MIN_SPEED) * HIT_DAMAGE * power * (guard ? 0.35 : 1);
  return Math.max(1, Math.min(HIT_MAX, Math.round(raw)));
}

/** Zásah na tělo — jediná cesta, kterou HP ubývá (používá i testy). */
export function damageFighter(
  match: RagdollMatch,
  target: RagdollFighter,
  amount: number,
  attacker: RagdollFighter,
  now: number,
  events: RagdollEvent[],
): void {
  if (amount <= 0 || target.ko) return;
  target.hp = Math.max(0, target.hp - Math.round(amount));
  target.hitFlash = 0.18;
  if (match.mode === 'practice') {
    if (target.hp <= 0) target.hp = MAX_HP; // figurína se znovu postaví
    return;
  }
  if (target.hp > 0) return;
  target.hp = 0;
  target.ko = true;
  target.guard = false;
  target.stun = 0;
  target.knock = 0;
  events.push({ kind: 'ko', at: now, winner: attacker.id, loser: target.id });
}

function resolveCombat(match: RagdollMatch, now: number, events: RagdollEvent[]): void {
  if (match.mode === 'ball') return;
  const fighters: [RagdollFighter, RagdollFighter][] = [
    [match.a, match.b],
    [match.b, match.a],
  ];
  for (const [attacker, defender] of fighters) {
    if (attacker.hitCooldown > 0 || attacker.ko) continue;
    let landed = false;
    for (const striker of STRIKERS) {
      const si = striker.index;
      const sx = attacker.x[si]!;
      const sy = attacker.y[si]!;
      const svx = attacker.ivx[si]!;
      const svy = attacker.ivy[si]!;
      for (const di of BODY) {
        const dx = defender.x[di]! - sx;
        const dy = defender.y[di]! - sy;
        const distance = Math.hypot(dx, dy);
        const minimum = POINT_RADIUS[si]! + POINT_RADIUS[di]! + STRIKE_RADIUS_BONUS;
        if (distance >= minimum || distance < 1e-6) continue;
        const nx = dx / distance;
        const ny = dy / distance;
        const closing = (svx - defender.ivx[di]!) * nx + (svy - defender.ivy[di]!) * ny;
        const damage = hitDamage(closing, striker.power, defender.guard);
        if (damage <= 0) continue;

        attacker.hitCooldown = 0.22;
        attacker.hits += 1;
        attacker.bestHit = Math.max(attacker.bestHit, closing);
        defender.stun = Math.max(defender.stun, Math.min(0.42, 0.1 + damage * 0.012));
        defender.knock = Math.max(defender.knock, 0.2 + damage * 0.008);
        const push = closing * (defender.guard ? 0.45 : 0.8);
        defender.vx[di] = defender.vx[di]! + nx * push;
        defender.vy[di] = defender.vy[di]! + ny * push;
        attacker.vx[si] = attacker.vx[si]! - nx * closing * 0.12;
        attacker.vy[si] = attacker.vy[si]! - ny * closing * 0.12;

        events.push({
          kind: 'hit',
          at: now,
          by: attacker.id,
          on: defender.id,
          damage,
          speed: closing,
          x: sx,
          y: sy,
        });
        damageFighter(match, defender, damage, attacker, now, events);
        landed = true;
        break;
      }
      if (landed) break;
    }
  }
}

// ── míč (ragdoll fotbal) ───────────────────────────────────────────────────

function stepBall(match: RagdollMatch, dt: number, now: number, events: RagdollEvent[]): void {
  const ball = match.ball;
  if (!ball) return;

  ball.vy -= GRAVITY * dt;
  const drag = Math.max(0, 1 - 0.12 * dt);
  ball.vx *= drag;
  ball.vy *= drag;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  if (ball.y < BALL_RADIUS) {
    ball.y = BALL_RADIUS;
    if (ball.vy < 0) ball.vy = -ball.vy * 0.62;
    ball.vx *= Math.max(0, 1 - 0.55 * dt);
  }

  const limit = ARENA_HALF - BALL_RADIUS;
  if (ball.x > limit && ball.y >= GOAL_HEIGHT - BALL_RADIUS) {
    ball.x = limit;
    ball.vx = -Math.abs(ball.vx) * 0.55;
  }
  if (ball.x < -limit && ball.y >= GOAL_HEIGHT - BALL_RADIUS) {
    ball.x = -limit;
    ball.vx = Math.abs(ball.vx) * 0.55;
  }

  // srážka s loutkami — jediný způsob, jak míč rozhýbat.
  // Pořadí stran se střídá: kdyby vždy začínala A, poslední rána B by vždy
  // vyhrála souboj o míč a jeden bot by vyhrával 14:0 (naměřeno).
  match.ballSeq = (match.ballSeq + 1) % 2;
  const order: RagdollFighter[] =
    match.ballSeq === 0 ? [match.a, match.b] : [match.b, match.a];
  for (const fighter of order) {
    for (let i = 0; i < POINT_COUNT; i++) {
      const dx = ball.x - fighter.x[i]!;
      const dy = ball.y - fighter.y[i]!;
      const distance = Math.hypot(dx, dy);
      const minimum = BALL_RADIUS + POINT_RADIUS[i]!;
      if (distance >= minimum || distance < 1e-6) continue;
      const nx = dx / distance;
      const ny = dy / distance;
      ball.x = fighter.x[i]! + nx * minimum;
      ball.y = fighter.y[i]! + ny * minimum;
      const rvx = ball.vx - fighter.vx[i]!;
      const rvy = ball.vy - fighter.vy[i]!;
      const normal = rvx * nx + rvy * ny;
      if (normal < 0) {
        ball.vx -= 1.55 * normal * nx;
        ball.vy -= 1.55 * normal * ny;
        ball.vx += fighter.vx[i]! * 0.28;
        ball.vy += fighter.vy[i]! * 0.28;
      }
    }
  }

  const speed = Math.hypot(ball.vx, ball.vy);
  const maxSpeed = 24;
  if (speed > maxSpeed) {
    ball.vx = (ball.vx / speed) * maxSpeed;
    ball.vy = (ball.vy / speed) * maxSpeed;
  }

  // branky: A útočí doprava, B doleva
  if (ball.x > ARENA_HALF - BALL_RADIUS && ball.y < GOAL_HEIGHT) {
    match.a.score += 1;
    match.lastScorer = 'a';
    events.push({ kind: 'goal', at: now, side: 'a', scoreA: match.a.score, scoreB: match.b.score });
    match.phase = 'roundEnd';
    match.timer = 1.4;
  } else if (ball.x < -ARENA_HALF + BALL_RADIUS && ball.y < GOAL_HEIGHT) {
    match.b.score += 1;
    match.lastScorer = 'b';
    events.push({ kind: 'goal', at: now, side: 'b', scoreA: match.a.score, scoreB: match.b.score });
    match.phase = 'roundEnd';
    match.timer = 1.4;
  }
}

function ballReset(match: RagdollMatch): void {
  if (!match.ball) return;
  match.ball.x = 0;
  match.ball.y = 0.6;
  match.ball.vx = 0;
  match.ball.vy = 0;
}

// ── pravidla ───────────────────────────────────────────────────────────────

function endDuelRound(match: RagdollMatch, now: number, events: RagdollEvent[], reason: 'ko' | 'time'): void {
  let winner: RagdollFighter | null = null;
  if (reason === 'ko') {
    if (match.a.ko && !match.b.ko) winner = match.b;
    else if (match.b.ko && !match.a.ko) winner = match.a;
  } else if (match.a.hp > match.b.hp) {
    winner = match.a;
  } else if (match.b.hp > match.a.hp) {
    winner = match.b;
  }
  if (winner) winner.wins += 1;
  events.push({ kind: 'round_end', at: now, winner: winner?.id ?? null, reason });
  match.phase = 'roundEnd';
  match.timer = ROUND_END_SECONDS;
}

function startSurvivalWave(match: RagdollMatch, now: number, events: RagdollEvent[]): void {
  match.wave += 1;
  match.a.hp = Math.min(MAX_HP, match.a.hp + 22);
  match.a.ko = false;
  placeFighter(match.a, -3.4, 1);
  match.a.hp = Math.min(MAX_HP, match.a.hp);
  placeFighter(match.b, 3.4, -1);
  match.b.hp = Math.min(200, 60 + (match.wave - 1) * 26);
  match.b.ko = false;
  match.phase = 'countdown';
  match.timer = 2;
  events.push({ kind: 'wave_start', at: now, wave: match.wave });
}

// ── hlavní krok ────────────────────────────────────────────────────────────

export function stepRagdoll(
  match: RagdollMatch,
  inputA: FightInput,
  inputB: FightInput,
  dt: number,
  now: number,
): RagdollEvent[] {
  const events: RagdollEvent[] = [];
  const step = Math.max(0.001, Math.min(0.05, dt));

  if (match.phase === 'countdown') {
    simulate(match, NO_INPUT, NO_INPUT, step);
    match.timer -= step;
    if (match.timer <= 0) {
      match.phase = 'playing';
      match.timer = match.mode === 'duel' ? ROUND_SECONDS : 0;
      if (match.mode === 'survival') {
        events.push({ kind: 'wave_start', at: now, wave: match.wave });
      }
      events.push({ kind: 'fight_start', at: now });
    }
    return events;
  }

  if (match.phase === 'roundEnd') {
    simulate(match, NO_INPUT, NO_INPUT, step);
    match.timer -= step;
    if (match.timer > 0) return events;

    if (match.mode === 'duel') {
      if (match.a.wins >= ROUNDS_TO_WIN || match.b.wins >= ROUNDS_TO_WIN) {
        const winner = match.a.wins > match.b.wins ? match.a : match.b.wins > match.a.wins ? match.b : null;
        match.phase = 'matchEnd';
        match.timer = Infinity;
        events.push({ kind: 'match_end', at: now, winner: winner?.id ?? null });
      } else {
        match.round += 1;
        resetRound(match);
      }
    } else if (match.mode === 'survival') {
      if (match.a.ko) {
        match.phase = 'matchEnd';
        match.timer = Infinity;
        events.push({ kind: 'match_end', at: now, winner: match.b.id });
      } else {
        startSurvivalWave(match, now, events);
      }
    } else if (match.mode === 'ball') {
      // po gólu se pokračuje stejným tempem, jen se vrátí pozice
      match.a.ko = false;
      match.b.ko = false;
      match.a.guard = false;
      match.b.guard = false;
      match.a.stun = 0;
      match.b.stun = 0;
      match.a.knock = 0;
      match.b.knock = 0;
      placeFighter(match.a, -3.4, 1);
      placeFighter(match.b, 3.4, -1);
      ballReset(match);
      // výkop dostane inkasující strana — jinak jeden bot vyhrává pořád
      if (match.ball) {
        if (match.lastScorer === 'a') match.ball.x = 2.2;
        else if (match.lastScorer === 'b') match.ball.x = -2.2;
      }
      match.phase = 'playing';
    } else {
      match.phase = 'playing';
    }
    return events;
  }

  if (match.phase === 'matchEnd') {
    simulate(match, NO_INPUT, NO_INPUT, step);
    return events;
  }

  // ── playing ──────────────────────────────────────────────────────────────
  simulate(match, inputA, inputB, step);
  resolveCombat(match, now, events);

  if (match.mode === 'ball') {
    stepBall(match, step, now, events);
    match.elapsed += step;
    if (match.elapsed >= BALL_SECONDS) {
      match.phase = 'matchEnd';
      match.timer = Infinity;
      const winner = match.a.score > match.b.score ? match.a : match.b.score > match.a.score ? match.b : null;
      events.push({ kind: 'match_end', at: now, winner: winner?.id ?? null });
      return events;
    }
    return events;
  }

  if (match.mode === 'practice') {
    match.elapsed += step;
    match.a.hp = Math.min(MAX_HP, match.a.hp + 5 * step);
    match.b.hp = Math.min(MAX_HP, match.b.hp + 8 * step);
    return events;
  }

  if (match.mode === 'survival') {
    match.elapsed += step;
    if (match.b.ko) {
      events.push({ kind: 'wave_end', at: now, wave: match.wave });
      match.phase = 'roundEnd';
      match.timer = ROUND_END_SECONDS;
    } else if (match.a.ko) {
      match.phase = 'matchEnd';
      match.timer = Infinity;
      events.push({ kind: 'match_end', at: now, winner: match.b.id });
    }
    return events;
  }

  // duel
  if (match.a.ko || match.b.ko) {
    endDuelRound(match, now, events, 'ko');
    return events;
  }
  match.timer -= step;
  if (match.timer <= 0) endDuelRound(match, now, events, 'time');
  return events;
}

// ── bot (sólo) ─────────────────────────────────────────────────────────────

export interface BotMemory {
  /** Simulovaný čas dalšího rozhodnutí. */
  nextThink: number;
  pick: 'punch' | 'kick';
  guardUntil: number;
  seed: number;
}

interface BotTuning {
  think: number;
  jitter: number;
  kickChance: number;
  guardChance: number;
  aggression: number;
}

const BOT_TUNING: Record<BotDifficulty, BotTuning> = {
  gentle: { think: 0.62, jitter: 0.3, kickChance: 0.24, guardChance: 0.18, aggression: 1.28 },
  standard: { think: 0.34, jitter: 0.22, kickChance: 0.42, guardChance: 0.42, aggression: 1.0 },
  champion: { think: 0.18, jitter: 0.12, kickChance: 0.55, guardChance: 0.7, aggression: 0.84 },
};

export function makeBotMemory(): BotMemory {
  return { nextThink: 0, pick: 'punch', guardUntil: 0, seed: 1 };
}

function rand(memory: BotMemory): number {
  memory.seed = (memory.seed + 0x6d2b79f5) | 0;
  let t = memory.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function limbSpeed(f: RagdollFighter): number {
  let best = 0;
  for (const index of [P.HAND_L, P.HAND_R, P.FOOT_L, P.FOOT_R, P.HEAD]) {
    best = Math.max(best, Math.hypot(f.vx[index]!, f.vy[index]!));
  }
  return best;
}

/**
 * Bot míří na soupeře (nebo na míč) a švihá, když je v dosahu. Rozhoduje se
 * v simulovaných intervalech; obtížnost mění reakci, výběr kopu a krytí.
 */
export function botInput(
  match: RagdollMatch,
  side: 'a' | 'b',
  memory: BotMemory,
  difficulty: BotDifficulty = 'standard',
  clock = 0,
): FightInput {
  if (match.phase !== 'playing') return NO_INPUT;
  const self = side === 'a' ? match.a : match.b;
  const foe = side === 'a' ? match.b : match.a;
  if (self.ko) return NO_INPUT;
  if (match.mode === 'practice') return NO_INPUT;

  const tuning = BOT_TUNING[difficulty];
  if (clock >= memory.nextThink) {
    memory.nextThink = clock + tuning.think + rand(memory) * tuning.jitter;
    memory.pick = rand(memory) < tuning.kickChance ? 'kick' : 'punch';
    if (limbSpeed(foe) > 4.2 && rand(memory) < tuning.guardChance) {
      memory.guardUntil = clock + (difficulty === 'champion' ? 0.5 : 0.34);
    }
  }

  const selfCenter = centerOf(self);
  const foeCenter = centerOf(foe);

  if (match.mode === 'ball' && match.ball) {
    const ball = match.ball;
    const attackDir = side === 'a' ? 1 : -1;
    // stůj na opačné straně míče, než je branka, kterou útočíš
    const standX = ball.x - attackDir * (0.9 + tuning.aggression * 0.12);
    const dx = standX - selfCenter.x;
    let move = 0;
    if (Math.abs(dx) > 0.45) move = Math.sign(dx);
    const ballDx = ball.x - selfCenter.x;
    const ballDistance = Math.abs(ballDx);
    const inFront = ballDx * attackDir > 0;
    const kick = ballDistance < 2.1 && ball.y < 2.7 && inFront;
    const punch = ballDistance < 1.35 && !inFront;
    // Když je míč na špatné straně, bot přes něj nesmí přejít po zemi —
    // jinak ho tělem dokutálí do vlastní branky (přesně to dělalo 0:13).
    const wrongSide = (standX - selfCenter.x) * ballDx < 0;
    const jump = wrongSide && ballDistance < 1.3 && ball.y < 1.2;
    return { move, jump, punch, kick, block: false };
  }

  const dx = foeCenter.x - selfCenter.x;
  const distance = Math.abs(dx);
  // pěst je krátká, kop delší — bot podle toho drží odstup
  const desired = memory.pick === 'kick' ? tuning.aggression + 0.3 : tuning.aggression - 0.15;
  let move = 0;
  if (distance > desired + 0.3) move = Math.sign(dx);
  else if (distance < desired - 0.45) move = -Math.sign(dx);

  const reach = memory.pick === 'kick' ? KICK_REACH : PUNCH_REACH;
  const aligned = Math.abs(foeCenter.y - selfCenter.y) < 1.4;
  const inRange = distance < reach && aligned;
  const guard = clock < memory.guardUntil;
  const punch = inRange && memory.pick === 'punch' && !guard;
  const kick = inRange && memory.pick === 'kick' && !guard;
  const jump = false;
  return { move, jump, punch, kick, block: guard };
}
