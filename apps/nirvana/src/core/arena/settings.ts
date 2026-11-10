'use client';

/**
 * NASTAVENÍ ARÉNY, KTERÉ PŘEŽIJE OBNOVENÍ STRÁNKY.
 *
 * Jediná položka je zatím citlivost pohledu. Dřív to byla konstanta
 * (`LOOK_SENSITIVITY = 0.0034`), což je na telefonu akorát a na tabletu
 * pomalé — a nikdo to nemohl změnit. Ukládá se do `localStorage`, protože
 * jde o volbu zařízení, ne účtu.
 */

import type { BotSkill } from './bot';

const LOOK_KEY = 'nirvana.arena.look';
const SKILL_KEY = 'nirvana.arena.skill';
/** Rozsah, který dává smysl: 0,4× (přesné míření) až 2,5× (rychlé otáčení). */
export const LOOK_MIN = 0.4;
export const LOOK_MAX = 2.5;
export const LOOK_DEFAULT = 1;

function clamp(value: number): number {
  if (!Number.isFinite(value)) return LOOK_DEFAULT;
  return Math.min(LOOK_MAX, Math.max(LOOK_MIN, value));
}

/** Mezipaměť — `pointermove` ji čte 60×/s, localStorage by byl zbytečný I/O. */
let cached: number | null = null;

/** Násobek základní citlivosti (1 = výchozí). */
export function getLookSensitivity(): number {
  if (cached !== null) return cached;
  if (typeof window === 'undefined') return LOOK_DEFAULT;
  try {
    const raw = window.localStorage.getItem(LOOK_KEY);
    cached = raw ? clamp(Number(raw)) : LOOK_DEFAULT;
  } catch {
    // soukromý režim / zakázané úložiště — hra musí jet dál
    cached = LOOK_DEFAULT;
  }
  return cached;
}

/** Obtížnost botů v sólu — volba zařízení, ne účtu. */
export const BOT_SKILL_ORDER: BotSkill[] = ['easy', 'normal', 'hard', 'nightmare'];

let skillCache: BotSkill | null = null;

export function getBotSkill(): BotSkill {
  if (skillCache) return skillCache;
  if (typeof window === 'undefined') return 'normal';
  try {
    const raw = window.localStorage.getItem(SKILL_KEY);
    skillCache = BOT_SKILL_ORDER.includes(raw as BotSkill) ? (raw as BotSkill) : 'normal';
  } catch {
    skillCache = 'normal';
  }
  return skillCache ?? 'normal';
}

export function setBotSkill(value: BotSkill): BotSkill {
  const next = BOT_SKILL_ORDER.includes(value) ? value : 'normal';
  skillCache = next;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(SKILL_KEY, next);
    } catch {
      /* volba se neuloží, ale platí pro tuhle hru */
    }
  }
  return next;
}

export function setLookSensitivity(value: number): number {
  const next = clamp(value);
  cached = next;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(LOOK_KEY, String(next));
    } catch {
      /* volba se neuloží, ale platí pro tuhle hru */
    }
  }
  return next;
}
