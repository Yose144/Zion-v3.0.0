'use client';

/**
 * NASTAVENÍ ARÉNY, KTERÉ PŘEŽIJE OBNOVENÍ STRÁNKY.
 *
 * Jediná položka je zatím citlivost pohledu. Dřív to byla konstanta
 * (`LOOK_SENSITIVITY = 0.0034`), což je na telefonu akorát a na tabletu
 * pomalé — a nikdo to nemohl změnit. Ukládá se do `localStorage`, protože
 * jde o volbu zařízení, ne účtu.
 */

const LOOK_KEY = 'nirvana.arena.look';
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
