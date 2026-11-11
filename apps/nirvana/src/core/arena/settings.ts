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
/**
 * Menu a ArenaTouch mohou být v jiných chunkech (dvě modulové instance).
 * Událost na `window` proto aktualizuje cache i v té druhé — jinak by
 * posuvník v menu změnil jen svoji kopii a hra by jela starou citlivostí.
 */
let listening = false;
function ensureListener(): void {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  window.addEventListener('nirvana:arena-look', (event) => {
    const value = Number((event as CustomEvent<number>).detail);
    cached = clamp(value);
  });
}

/** Násobek základní citlivosti (1 = výchozí). */
export function getLookSensitivity(): number {
  ensureListener();
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

/**
 * Obtížnost se čte **vždy z localStorage**, ne z modulové mezipaměti.
 *
 * Menu a stránka hry jsou v jiných chunkách a Next je umí vyhodnotit jako
 * dva modulové instance; cache v jedné pak druhá nevidí (reálně: menu
 * nastavilo nightmare, hra nastoupila s normal). Čtení je vzácné, takže
 * pár zápisů navíc nic nestojí.
 */
export function getBotSkill(): BotSkill {
  if (typeof window === 'undefined') return 'normal';
  try {
    const raw = window.localStorage.getItem(SKILL_KEY);
    return BOT_SKILL_ORDER.includes(raw as BotSkill) ? (raw as BotSkill) : 'normal';
  } catch {
    return 'normal';
  }
}

export function setBotSkill(value: BotSkill): BotSkill {
  const next = BOT_SKILL_ORDER.includes(value) ? value : 'normal';
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
  ensureListener();
  const next = clamp(value);
  cached = next;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(LOOK_KEY, String(next));
    } catch {
      /* volba se neuloží, ale platí pro tuhle hru */
    }
    // Propagace do druhé modulové instance (menu ↔ hra).
    window.dispatchEvent(new CustomEvent('nirvana:arena-look', { detail: next }));
  }
  return next;
}
