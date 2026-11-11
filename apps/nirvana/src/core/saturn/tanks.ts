/**
 * SATURN — TANKY (artilerie).
 *
 * Jeden modul pravidel pro **dvě** verze hry:
 *   - `Tanks2D` — oldschool 2D artilerie na canvasu,
 *   - `Tanks3D` — stejná pravidla v 3D scéně.
 *
 * Proč jeden modul: kdyby si 2D a 3D vedly vlastní fyziku, rozešly by se
 * dostřely i poškození a „v oldschoolu to padá jinam" by byla pravda.
 * Renderer jen čte stav — nikdy nic nepočítá.
 *
 * Souřadnice: **y nahoru**, počátek vlevo dole. Renderery si osu překlopí
 * samy (canvas kreslí odshora, three má Y nahoru taky).
 *
 * Deterministické: vše jde ze semínka v `mulberry32`, takže stejné semínko
 * = stejná mapa i stejný vítr. Bot nemá vlastní náhodu.
 */

export const WORLD_W = 1000;
export const WORLD_H = 560;
/** Počet vzorků výšky terénu (renderer z nich dělá křivku i mesh). */
export const TERRAIN_COLS = 161;
export const COL_W = WORLD_W / (TERRAIN_COLS - 1);

export const GRAVITY = 260;
export const WIND_MAX = 46;
export const TANK_W = 38;
export const TANK_H = 20;
export const TANK_HP = 100;

/** Poloměr výbuchu a maximální poškození v epicentru. */
export const BLAST_R = 80;
export const BLAST_DAMAGE = 40;

/** Rychlost střely podle síly (0–100). 470 jednotek/s doletí ~850. */
export const SPEED_MIN = 260;
export const SPEED_MAX = 470;

/** Pauza mezi dopadem a předáním tahu — hráč musí vidět, co se stalo. */
export const RESOLVE_MS = 900;
/** Jak dlouho se drží nápis „konec" před nabídkou nové hry. */
const BOT_THINK_MS = 750;

export type TankSide = 'player' | 'bot';
export type TankPhase = 'aim' | 'flight' | 'resolve' | 'over';

export interface Terrain {
  /** Výška povrchu pro každý sloupec, `TERRAIN_COLS` hodnot. */
  heights: Float32Array;
  /** Roste s každým zásahem — 3D scéna podle něj pozná, že má přestavět mesh. */
  version: number;
}

export interface Tank {
  side: TankSide;
  /** Střed pásu (y = výška terénu v `x`). */
  x: number;
  hp: number;
  /** Úhel hlavně ve stupních: 0 = vodorovně k soupeři, 90 = kolmo vzhůru. */
  angle: number;
  /** Síla výstřelu 0–100. */
  power: number;
  alive: boolean;
}

export interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Stopa pro vykreslení (x,y po dvojicích, omezená délka). */
  trail: number[];
  by: TankSide;
}

export interface Explosion {
  x: number;
  y: number;
  age: number;
  /** 0–1 podle toho, jak blízko bylo epicentrum tanku. */
  force: number;
}

export interface LastHit {
  x: number;
  y: number;
  damage: number;
  by: TankSide;
  at: number;
}

export interface TanksState {
  terrain: Terrain;
  player: Tank;
  bot: Tank;
  turn: TankSide;
  phase: TankPhase;
  wind: number;
  shot: Shot | null;
  explosions: Explosion[];
  /** Sim čas v ms — buffery a animace se počítají z něj, ne z `Date.now()`. */
  now: number;
  /** Odehraný čas zápasu v sekundách (součet kroků, ne hodiny prohlížeče). */
  elapsed: number;
  /** Odpočet do akce, kterou řídí sim (bot, předání tahu). */
  waitMs: number;
  over: TankSide | null;
  wins: { player: number; bot: number };
  lastHit: LastHit | null;
  shotsFired: number;
  seed: number;
  /**
   * Kdo hraje pravou stranu. Sólo: `true` (bot). Online: `false`, když sedí
   * člověk — jinak by bot střílel za něj.
   */
  autoBot: boolean;
}

// ── pomocné ────────────────────────────────────────────────────────────

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Výška terénu v libovolném `x` (lineární interpolace mezi vzorky). */
export function terrainAt(terrain: Terrain, x: number): number {
  const clamped = Math.min(Math.max(x, 0), WORLD_W);
  const pos = clamped / COL_W;
  const index = Math.min(Math.floor(pos), TERRAIN_COLS - 2);
  const frac = pos - index;
  const a = terrain.heights[index]!;
  const b = terrain.heights[index + 1]!;
  return a + (b - a) * frac;
}

function slopeAt(terrain: Terrain, x: number): number {
  const left = terrainAt(terrain, Math.max(0, x - 6));
  const right = terrainAt(terrain, Math.min(WORLD_W, x + 6));
  return (right - left) / 12;
}

function makeTerrain(seed: number): Terrain {
  const rng = mulberry32(seed);
  const p1 = rng() * Math.PI * 2;
  const p2 = rng() * Math.PI * 2;
  const p3 = rng() * Math.PI * 2;
  const heights = new Float32Array(TERRAIN_COLS);
  for (let i = 0; i < TERRAIN_COLS; i += 1) {
    const t = i / (TERRAIN_COLS - 1);
    // symetrický základ: oba konce výš, střed níž — jako klasická artilerie
    const valley = Math.pow(Math.abs(t - 0.5) * 2, 1.4) * 120;
    const h =
      90 +
      valley +
      46 * Math.sin(t * Math.PI * 2 + p1) +
      26 * Math.sin(t * Math.PI * 5.2 + p2) +
      13 * Math.sin(t * Math.PI * 11 + p3);
    heights[i] = Math.min(Math.max(h, 70), WORLD_H - 190);
  }
  return { heights, version: 0 };
}

function makeTank(side: TankSide, x: number, terrain: Terrain): Tank {
  // hlaveň se srovná se svahem, aby netrčela do země
  const slope = Math.atan(slopeAt(terrain, x));
  return {
    side,
    x,
    hp: TANK_HP,
    angle: Math.max(8, Math.min(78, 45 - (slope * 180) / Math.PI)),
    power: 58,
    alive: true,
  };
}

/** Střed korby (y nad terénem, aby tank stál na povrchu). */
export function tankCenter(terrain: Terrain, tank: Tank): { x: number; y: number } {
  return { x: tank.x, y: terrainAt(terrain, tank.x) + TANK_H / 2 };
}

/** Konec hlavně — z něj střela startuje. Musí to být stejné pro 2D i 3D. */
export function barrelTip(state: TanksState, side: TankSide): { x: number; y: number; angle: number } {
  const tank = side === 'player' ? state.player : state.bot;
  const center = tankCenter(state.terrain, tank);
  const dir = side === 'player' ? 1 : -1;
  const rad = (tank.angle * Math.PI) / 180;
  const barrel = 26;
  return {
    x: center.x + Math.cos(rad) * barrel * dir,
    y: center.y + Math.sin(rad) * barrel,
    angle: rad,
  };
}

function speedFor(power: number): number {
  return SPEED_MIN + ((SPEED_MAX - SPEED_MIN) * Math.min(Math.max(power, 0), 100)) / 100;
}

// ── stav hry ───────────────────────────────────────────────────────────

export function createTanks(
  seed = Math.floor(Math.random() * 1e9),
  options: { autoBot?: boolean } = {},
): TanksState {
  const terrain = makeTerrain(seed);
  const player = makeTank('player', WORLD_W * 0.12, terrain);
  const bot = makeTank('bot', WORLD_W * 0.88, terrain);
  const rng = mulberry32(seed ^ 0x9e3779b9);
  return {
    terrain,
    player,
    bot,
    turn: 'player',
    phase: 'aim',
    wind: Math.round((rng() * 2 - 1) * WIND_MAX),
    shot: null,
    explosions: [],
    now: 0,
    elapsed: 0,
    waitMs: 0,
    over: null,
    wins: { player: 0, bot: 0 },
    lastHit: null,
    shotsFired: 0,
    seed,
    autoBot: options.autoBot ?? true,
  };
}

/** Nové kolo na nové mapě, skóre zůstává. */
export function rematch(state: TanksState, seed = Math.floor(Math.random() * 1e9)): TanksState {
  const next = createTanks(seed, { autoBot: state.autoBot });
  next.wins = { ...state.wins };
  return next;
}

export function adjustAim(state: TanksState, side: TankSide, dAngle: number, dPower: number): void {
  if (state.phase !== 'aim' || state.turn !== side || state.over) return;
  const tank = side === 'player' ? state.player : state.bot;
  tank.angle = Math.min(90, Math.max(0, tank.angle + dAngle));
  tank.power = Math.min(100, Math.max(5, tank.power + dPower));
}

/** Vypálí, pokud je hráč na tahu. Vrací `true`, když střela opravdu vznikla. */
export function fire(state: TanksState, side: TankSide): boolean {
  if (state.phase !== 'aim' || state.turn !== side || state.over) return false;
  const tank = side === 'player' ? state.player : state.bot;
  const tip = barrelTip(state, side);
  const dir = side === 'player' ? 1 : -1;
  const speed = speedFor(tank.power);
  state.shot = {
    x: tip.x,
    y: tip.y,
    vx: Math.cos(tip.angle) * speed * dir,
    vy: Math.sin(tip.angle) * speed,
    trail: [tip.x, tip.y],
    by: side,
  };
  state.phase = 'flight';
  state.waitMs = 0;
  state.shotsFired += 1;
  return true;
}

/** Vyhloubí kráter a vrátí `true`, když se terén změnil. */
function carve(terrain: Terrain, cx: number, cy: number, radius: number): boolean {
  let changed = false;
  const from = Math.max(0, Math.floor((cx - radius) / COL_W));
  const to = Math.min(TERRAIN_COLS - 1, Math.ceil((cx + radius) / COL_W));
  for (let i = from; i <= to; i += 1) {
    const dx = i * COL_W - cx;
    const half = radius * radius - dx * dx;
    if (half <= 0) continue;
    // spodní hrana kružnice: pod ni se země propadne
    const floor = cy - Math.sqrt(half);
    if (terrain.heights[i]! > floor) {
      terrain.heights[i] = Math.max(24, floor);
      changed = true;
    }
  }
  if (changed) terrain.version += 1;
  return changed;
}

function damageTank(tank: Tank, terrain: Terrain, cx: number, cy: number): number {
  const center = tankCenter(terrain, tank);
  const distance = Math.hypot(center.x - cx, center.y - cy);
  if (distance > BLAST_R) return 0;
  const falloff = 1 - distance / BLAST_R;
  const damage = Math.round(BLAST_DAMAGE * Math.pow(falloff, 0.75));
  if (damage <= 0) return 0;
  tank.hp = Math.max(0, tank.hp - damage);
  if (tank.hp === 0) tank.alive = false;
  return damage;
}

function explode(state: TanksState, x: number, y: number, by: TankSide) {
  carve(state.terrain, x, y, BLAST_R);
  const toPlayer = damageTank(state.player, state.terrain, x, y);
  const toBot = damageTank(state.bot, state.terrain, x, y);
  const damage = by === 'player' ? toBot : toPlayer;
  const force = Math.min(1, Math.max(toPlayer, toBot) / BLAST_DAMAGE);
  state.explosions.push({ x, y, age: 0, force });
  state.lastHit = { x, y, damage, by, at: state.now };
  state.shot = null;
  state.phase = 'resolve';
  state.waitMs = RESOLVE_MS;
  if (!state.player.alive || !state.bot.alive) {
    const winner: TankSide | null = !state.bot.alive && !state.player.alive
      ? (toPlayer >= toBot ? 'bot' : 'player')
      : !state.bot.alive
        ? 'player'
        : !state.player.alive
          ? 'bot'
          : null;
    if (winner) {
      state.over = winner;
      state.wins[winner] += 1;
      state.phase = 'over';
      state.waitMs = 0;
    }
  }
}

/** Posun střely na `dt` sekund; `true` = dopadla. */
function advanceShot(state: TanksState, dt: number): boolean {
  const shot = state.shot;
  if (!shot) return false;
  // podkroky: 470 j/s by při 1/60 proletělo ~8 j za snímek a mohlo přeskočit hřeben
  const steps = Math.max(1, Math.ceil(dt / (1 / 180)));
  const step = dt / steps;
  for (let i = 0; i < steps; i += 1) {
    shot.vx += state.wind * step;
    shot.vy -= GRAVITY * step;
    shot.x += shot.vx * step;
    shot.y += shot.vy * step;
    shot.trail.push(shot.x, shot.y);
    if (shot.trail.length > 240) shot.trail.splice(0, shot.trail.length - 240);

    // mimo mapu — střela propadla, ale tah musí skončit (jinak hra zamrzne)
    if (shot.x < -80 || shot.x > WORLD_W + 80 || shot.y < -200) {
      state.shot = null;
      state.phase = 'resolve';
      state.waitMs = RESOLVE_MS * 0.5;
      state.lastHit = null;
      return true;
    }
    // zásah tanku (krabice)
    const target = shot.by === 'player' ? state.bot : state.player;
    if (target.alive) {
      const center = tankCenter(state.terrain, target);
      if (
        Math.abs(shot.x - center.x) < TANK_W / 2 + 3 &&
        shot.y > center.y - TANK_H &&
        shot.y < center.y + TANK_H
      ) {
        explode(state, shot.x, shot.y, shot.by);
        return true;
      }
    }
    // zásah terénu
    if (shot.y <= terrainAt(state.terrain, shot.x)) {
      explode(state, shot.x, Math.max(shot.y, terrainAt(state.terrain, shot.x)), shot.by);
      return true;
    }
  }
  return false;
}

function other(side: TankSide): TankSide {
  return side === 'player' ? 'bot' : 'player';
}

function beginTurn(state: TanksState) {
  const next = other(state.turn);
  const tank = next === 'player' ? state.player : state.bot;
  state.turn = tank.alive ? next : state.turn;
  state.phase = 'aim';
  state.waitMs = state.turn === 'bot' ? BOT_THINK_MS : 0;
  const rng = mulberry32((state.seed ^ Math.imul(state.shotsFired + 1, 2654435761)) >>> 0);
  state.wind = Math.round((rng() * 2 - 1) * WIND_MAX);
}

/**
 * Jeden krok simulace. `dt` v sekundách (strop 0,05 — stejné pravidlo jako
 * u ostatních her, jinak by se při propadu snímku střela teleportovala).
 */
export function stepTanks(state: TanksState, dt: number): void {
  const step = Math.min(Math.max(dt, 0), 0.05);
  state.now += step * 1000;
  state.elapsed += step;

  for (const ex of state.explosions) ex.age += step;
  for (let i = state.explosions.length - 1; i >= 0; i -= 1) {
    if (state.explosions[i]!.age > 1.1) state.explosions.splice(i, 1);
  }

  if (state.phase === 'flight') {
    advanceShot(state, step);
    return;
  }

  if (state.phase === 'resolve') {
    state.waitMs -= step * 1000;
    if (state.waitMs <= 0) beginTurn(state);
    return;
  }

  if (state.phase === 'aim' && state.turn === 'bot' && state.autoBot && !state.over) {
    state.waitMs -= step * 1000;
    if (state.waitMs <= 0) {
      const aim = botAim(state);
      state.bot.angle = aim.angle;
      state.bot.power = aim.power;
      fire(state, 'bot');
    }
  }
}

// ── bot ────────────────────────────────────────────────────────────────

interface Candidate {
  angle: number;
  power: number;
  miss: number;
}

/** Suchý průlet střely bez mutace stavu — jen pro hledání mířidla. */
function previewShot(state: TanksState, side: TankSide, angle: number, power: number, terrain: Terrain) {
  const tank = side === 'player' ? state.player : state.bot;
  const center = tankCenter(terrain, tank);
  const dir = side === 'player' ? 1 : -1;
  const rad = (angle * Math.PI) / 180;
  const speed = speedFor(power);
  let x = center.x + Math.cos(rad) * 26 * dir;
  let y = center.y + Math.sin(rad) * 26;
  let vx = Math.cos(rad) * speed * dir;
  let vy = Math.sin(rad) * speed;
  const dt = 1 / 90;
  for (let i = 0; i < 400; i += 1) {
    vx += state.wind * dt;
    vy -= GRAVITY * dt;
    x += vx * dt;
    y += vy * dt;
    if (x < -40 || x > WORLD_W + 40 || y < -100) break;
    if (y <= terrainAt(terrain, x)) break;
  }
  return { x, y };
}

/**
 * Bot hledá mířidlo hrubou mřížkou a pak ho „lidsky" rozladí.
 * Chyba je v jednotkách úhlu/síly — záměrně ne přesné řešení, jinak by
 * hráč neměl šanci.
 */
export function aimAt(state: TanksState, side: TankSide, error = 0): { angle: number; power: number } {
  const foe = side === 'player' ? state.bot : state.player;
  const target = tankCenter(state.terrain, foe);
  const score = (angle: number, power: number) => {
    const landing = previewShot(state, side, angle, power, state.terrain);
    return Math.hypot(landing.x - target.x, landing.y - target.y);
  };

  // 1) hrubá mřížka nad celým rozsahem
  let best: Candidate | null = null;
  for (let angle = 14; angle <= 78; angle += 4) {
    for (let power = 24; power <= 100; power += 4) {
      const miss = score(angle, power);
      if (!best || miss < best.miss) best = { angle, power, miss };
    }
  }

  // 2) jemné doladění kolem nejlepšího — hrubá mřížka minula o desítky jednotek
  const coarse = best;
  if (coarse) {
    for (let angle = coarse.angle - 4; angle <= coarse.angle + 4; angle += 0.5) {
      for (let power = coarse.power - 6; power <= coarse.power + 6; power += 1) {
        if (angle < 0 || angle > 90 || power < 5 || power > 100) continue;
        const miss = score(angle, power);
        if (miss < best!.miss) best = { angle, power, miss };
      }
    }
  }
  if (error <= 0) {
    return { angle: best?.angle ?? 45, power: best?.power ?? 60 };
  }
  const rng = mulberry32((state.seed ^ Math.imul(state.shotsFired + 7, 40503)) >>> 0);
  const jitterAngle = (rng() * 2 - 1) * error;
  const jitterPower = (rng() * 2 - 1) * error * 1.6;
  return {
    angle: Math.min(90, Math.max(0, (best?.angle ?? 45) + jitterAngle)),
    power: Math.min(100, Math.max(5, (best?.power ?? 60) + jitterPower)),
  };
}

/** Bot = `aimAt('bot')` s lidskou chybou. */
export function botAim(state: TanksState, error = 2.6): { angle: number; power: number } {
  return aimAt(state, 'bot', error);
}

// ── telemetrie pro HUD ─────────────────────────────────────────────────

export interface TanksInfo {
  turn: TankSide;
  phase: TankPhase;
  wind: number;
  playerHp: number;
  botHp: number;
  angle: number;
  power: number;
  lastDamage: number | null;
  wins: { player: number; bot: number };
  shots: number;
  /** Odehraný čas zápasu v sekundách. */
  elapsed: number;
}

export function tanksInfo(state: TanksState): TanksInfo {
  const shooter = state.turn === 'player' ? state.player : state.bot;
  return {
    turn: state.turn,
    phase: state.phase,
    wind: state.wind,
    playerHp: state.player.hp,
    botHp: state.bot.hp,
    angle: Math.round(shooter.angle),
    power: Math.round(shooter.power),
    lastDamage: state.lastHit ? state.lastHit.damage : null,
    wins: { ...state.wins },
    shots: state.shotsFired,
    elapsed: Math.round(state.elapsed * 10) / 10,
  };
}
