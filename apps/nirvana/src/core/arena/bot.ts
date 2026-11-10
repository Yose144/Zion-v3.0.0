/**
 * ARÉNA — botí mozek, sdílený klientem i serverem.
 *
 * **Jeden zdroj pravdy (pravidlo M2a):** sólová aréna i multiplayer boti
 * jedou **týmž kódem**. Kdyby server měl jinou AI, hráč by ve dvou hrách
 * potkal dva různé typy botů — a „boti jsou slabí" by byl jen dojem.
 *
 * Bot:
 *  - jde k nejbližšímu živému cíli po cestě z navigační mřížky (BFS),
 *  - drží si odstup (daleko jde blíž, blízko couvá) a pořád strafuje,
 *  - míří na cíl s chybou (jinak by byl přesný a nestíral by),
 *  - střílí, když má viditelnost (LOS) a uplynul cooldown.
 *
 * Žádné Reactu, žádného DOM — čistá logika, kterou jde testovat v Node.
 */

import { PLAYER, lineOfSight, stepBody, type Body, type Box4 } from './physics';
import { cellCenter, cellIndex, findPath, nearestWalkable, type NavGrid } from './nav';
import { aimVector, TARGET_EYE_RATIO } from './weapons';

export interface BotTarget {
  id: string;
  x: number;
  y: number;
  z: number;
  alive: boolean;
  /** Serverový bot — boti se navzájem nehoní, hrají si na člověka. */
  isBot?: boolean;
}

export interface BotMemory {
  /** Cesta po buňkách mřížky (indexy). */
  path: number[];
  pathIndex: number;
  nextRepath: number;
  strafeDir: 1 | -1;
  nextJump: number;
  nextShot: number;
  /** Chyba míření — bot nemusí trefit každý výstřel. */
  aimErrorX: number;
  aimErrorY: number;
}

export interface BotIntent {
  /** Vstup do `stepBody` (relativní k yaw). */
  forward: number;
  strafe: number;
  jump: boolean;
  /** Míří sem bot. */
  yaw: number;
  pitch: number;
  /** Chce střílet (server/marsarena rozhodne o cooldownu a munici). */
  fire: boolean;
  /** Vidí cíle (LOS) — používá se i pro strafování. */
  sees: boolean;
}

export interface BotOptions {
  /** Rychlost bota jako násobek maxima (sólo 0,62). */
  speed?: number;
  /** Dosah střelby (za ním už nemá smysl mířit). */
  engageRange?: number;
  /** Chyba míření v radiánech. */
  aimError?: number;
  /** Doba mezi výstřely (ms). */
  fireDelayMs?: number;
  /** Výška oka, ze které bot míří — MUSÍ sedět se `PLAYER.eye`, jinak
   *  bot počítá z jedné výšky a server střílí z jiné a rány míjí. */
  eyeHeight?: number;
  /** Výška středu zásahové koule cíle — `PLAYER.height * TARGET_EYE_RATIO`. */
  targetHeight?: number;
}

export const DEFAULT_BOT_OPTIONS: Required<BotOptions> = {
  speed: 0.62,
  engageRange: 26,
  // 0,035 rad ≈ 2° — na 10 m to dává 0,35 m odchylku, tedy zásah pod
  // poloměrem 0,62 m. Vyšší hodnota (0,06) dělala z botů střelce, kteří
  // na delší vzdálenost míjeli skoro vždy.
  aimError: 0.035,
  fireDelayMs: 850,
  // stejné hodnoty jako používá server při testu zásahu
  eyeHeight: PLAYER.eye,
  targetHeight: PLAYER.height * TARGET_EYE_RATIO,
};

/**
 * Úrovně obtížnosti (Q3 má easy/medium/hard). Jednotlivé parametry —
 * **ne** damage — protože damage drží sdílená `WEAPONS` a nesmí se
 * rozjet podle obtížnosti (jinak „trefil jsem ho a nic").
 */
export type BotSkill = 'easy' | 'normal' | 'hard' | 'nightmare';

export const BOT_SKILLS: Record<BotSkill, Required<BotOptions>> = {
  easy: {
    ...DEFAULT_BOT_OPTIONS,
    aimError: 0.085,
    fireDelayMs: 1400,
    speed: 0.5,
  },
  normal: { ...DEFAULT_BOT_OPTIONS },
  hard: {
    ...DEFAULT_BOT_OPTIONS,
    aimError: 0.018,
    fireDelayMs: 620,
    speed: 0.78,
  },
  /**
   * Nightmare (Q3 „nightmare"): rychlý, přesný, ale **stejné poškození**.
   * Obtížnost nikdy nesmí měnit damage — jinak by to byla jiná hra, ne lepší
   * soupeř.
   */
  nightmare: {
    ...DEFAULT_BOT_OPTIONS,
    aimError: 0.01,
    fireDelayMs: 460,
    speed: 0.9,
  },
};

export function skillOptions(skill: BotSkill): Required<BotOptions> {
  return BOT_SKILLS[skill] ?? DEFAULT_BOT_OPTIONS;
}

export function createBotMemory(): BotMemory {
  return {
    path: [],
    pathIndex: 0,
    nextRepath: 0,
    strafeDir: 1,
    nextJump: 0,
    nextShot: 0,
    aimErrorX: 0,
    aimErrorY: 0,
  };
}

/**
 * Nejbližší živý cíl. **Lidi mají přednost** — boti se navzájem nehoní,
 * jinak by se tři boty vyraždili mezi sebou a člověk by si neměl s kým hrát.
 */
export function nearestTarget(targets: BotTarget[], from: Body): BotTarget | null {
  let best: BotTarget | null = null;
  let bestDistance = Infinity;
  for (const target of targets) {
    if (!target.alive) continue;
    const distance = Math.hypot(target.x - from.x, target.z - from.z);
    // ČLOVĚK MÁ PŘEDNOST — boti jsou v aréně kvůli němu (Mercurův princip
    // „prázdné sedlo drží bot"). Bez tohohle biasu se tři boti vyraždí
    // mezi sebou a hráč by se jen díval. Bez lidí v místnosti se bias
    // nepočítá (boti pak hrají proti sobě).
    const bias = target.isBot && targets.some((t) => !t.isBot && t.alive) ? 1000 : 0;
    const weighted = distance + bias;
    if (weighted < bestDistance) {
      bestDistance = weighted;
      best = target;
    }
  }
  return best;
}

/**
 * Jeden krok botího mozku. `now` je v milisekundách (wall clock),
 * `dt` v sekundách.
 */
export function stepBot(
  memory: BotMemory,
  self: Body,
  targets: BotTarget[],
  nav: NavGrid,
  solids: Box4[],
  now: number,
  dt: number,
  options: BotOptions = {},
): BotIntent {
  const opt = { ...DEFAULT_BOT_OPTIONS, ...options };
  const target = nearestTarget(targets, self);

  // ── není cíl: stojí a kouká se po směru pohybu ──────────────────────
  if (!target) {
    return {
      forward: 0,
      strafe: 0,
      jump: false,
      yaw: memory.aimErrorX,
      pitch: 0,
      fire: false,
      sees: false,
    };
  }

  // ── cesta po mřížce, přepočítaná ~2×/s ─────────────────────────────
  if (now > memory.nextRepath) {
    memory.nextRepath = now + 480 + Math.random() * 220;
    const from = nearestWalkable(nav, cellIndex(self.x, self.z));
    const to = nearestWalkable(nav, cellIndex(target.x, target.z));
    memory.path = findPath(nav, from, to);
    memory.pathIndex = 0;
  }

  let goalX = target.x;
  let goalZ = target.z;
  if (memory.path.length > 0) {
    while (memory.pathIndex < memory.path.length) {
      const [cx, cz] = cellCenter(memory.path[memory.pathIndex]!);
      if (Math.hypot(cx - self.x, cz - self.z) < 0.7) memory.pathIndex += 1;
      else break;
    }
    const node = memory.path[Math.min(memory.pathIndex, memory.path.length - 1)]!;
    const [wx, wz] = cellCenter(node);
    goalX = wx;
    goalZ = wz;
  }

  // ── natočení k cíli ────────────────────────────────────────────────
  const targetYaw = Math.atan2(-(target.x - self.x), -(target.z - self.z));
  const targetDist = Math.hypot(target.x - self.x, target.z - self.z);
  const targetPitch = Math.atan2(
    target.y + opt.targetHeight - (self.y + opt.eyeHeight),
    Math.max(0.2, targetDist),
  );

  // chyba míření se obnovuje občas (aby bot nešel do středu přesně)
  if (now > memory.nextShot - opt.fireDelayMs) {
    memory.aimErrorX = (Math.random() * 2 - 1) * opt.aimError;
    memory.aimErrorY = (Math.random() * 2 - 1) * opt.aimError * 0.6;
  }

  const yaw = targetYaw + memory.aimErrorX;
  const pitch = Math.max(-0.9, Math.min(0.9, targetPitch + memory.aimErrorY));

  // ── viditelnost (z téže výšky, ze které bot míří) ───────────────────
  const sees = lineOfSight(
    self.x,
    self.y + opt.eyeHeight,
    self.z,
    target.x,
    target.y + opt.targetHeight,
    target.z,
    solids,
  );

  // ── držení odstupu ─────────────────────────────────────────────────
  const toGoal = Math.hypot(goalX - self.x, goalZ - self.z);
  const approach = toGoal > 1.2 ? 1 : targetDist > 11 ? 1 : targetDist < 5 ? -1 : 0;
  if (Math.random() < 0.01) memory.strafeDir = memory.strafeDir === 1 ? -1 : 1;

  const jump = now > memory.nextJump && Math.random() < 0.02;
  if (now > memory.nextJump) memory.nextJump = now + 1800 + Math.random() * 2200;

  const fire = sees && targetDist <= opt.engageRange && now > memory.nextShot;
  // cooldown patří do mozku — jinak by bot „držel spoušť" každý snímek
  // a server by se musel spoléhat jen na vlastní cooldown zbraně
  if (fire) memory.nextShot = now + opt.fireDelayMs;

  return {
    forward: approach,
    strafe: memory.strafeDir * (sees ? 0.9 : 0.4),
    jump,
    yaw,
    pitch,
    fire,
    sees,
  };
}

/**
 * Posune tělo bota podle záměru (stejná fyzika jako hráč).
 * Volitelné zrcadlí to, co dělá `stepBody` v aréně.
 */
export function driveBot(
  memory: BotMemory,
  body: Body,
  intent: BotIntent,
  dt: number,
  solids: Box4[],
  radius: number,
  height: number,
  speed: number,
): void {
  stepBody(
    body,
    intent.yaw,
    {
      forward: intent.forward,
      strafe: intent.strafe,
      jump: intent.jump,
      speed,
    },
    dt,
    solids,
    radius,
    height,
  );
}

/** Směr výstřelu z záměru (yaw/pitch) — sdílené s hráčem. */
export function botAim(intent: BotIntent) {
  return aimVector(intent.yaw, intent.pitch);
}
