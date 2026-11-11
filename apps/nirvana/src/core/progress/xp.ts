/**
 * XP — jediná křivka postupu v Nirvaně.
 *
 * Dřív level rostl z **počtu dohraných her** (`2·(L−1)²`). To mělo dvě
 * chyby: hra za 2 body a hra za rekord dávaly stejně, a hráč, který jednu
 * hru hrál pořád dokola, byl na stejném levelu jako ten, kdo jich prošel
 * dvacet. XP to opravuje: rozhoduje **výkon** (skóre proti referenci),
 * **dokončení**, **rekord** a násobek za dharma validaci.
 *
 * Křivka zůstala stejná jako dřívější levelování, jen se počítá z XP:
 * `level = 1 + ⌊√(xp / 120)⌋`, takže starý profil (`runs`) se migruje
 * na `xp = runs × 60` a level se nezmění.
 */

import type { ParkGameId } from '@/core/park/games';
import { CHALLENGE_TARGETS } from '@/core/park/challenge';

/** Kolik XP dá „čistá" hra bez ohledu na skóre (liší se podle délky světa). */
export const GAME_XP: Record<ParkGameId, number> = {
  pong: 14,
  breakout: 14,
  snake: 14,
  tetris: 16,
  asteroids: 14,
  tower: 16,
  gallery: 18,
  arena: 60,
  race: 55,
  fight: 55,
  moba: 90,
  tanks: 50,
  lumi: 60,
  piko: 50,
  neptune: 55,
  pluto: 50,
  fleet: 45,
};

/** XP na level; `120 × (L−1)²` je stejná křivka jako dřívější `runs`. */
export const XP_PER_LEVEL = 120;

/** Kolik XP potřebuješ, abys z levelu `level` postoupil dál (spodní hranice). */
export function xpForLevel(level: number): number {
  const safe = Math.max(1, Math.floor(level));
  return XP_PER_LEVEL * (safe - 1) ** 2;
}

/** Level z XP. Nikdy neklesá a nikdy není menší než 1. */
export function levelFromXp(xp: number): number {
  if (!Number.isFinite(xp) || xp <= 0) return 1;
  return Math.floor(Math.sqrt(xp / XP_PER_LEVEL)) + 1;
}

export interface XpProgress {
  level: number;
  /** 0..1 — jak daleko jsi k dalšímu levelu. */
  ratio: number;
  /** Kolik XP ještě chybí do dalšího levelu. */
  remaining: number;
  /** XP na dalším levelu. */
  next: number;
  /** XP, na kterém současný level začal. */
  from: number;
}

export function xpProgress(xp: number): XpProgress {
  const safe = Math.max(0, Math.round(xp));
  const level = levelFromXp(safe);
  const from = xpForLevel(level);
  const to = xpForLevel(level + 1);
  const span = Math.max(1, to - from);
  return {
    level,
    ratio: Math.max(0, Math.min(1, (safe - from) / span)),
    remaining: Math.max(0, to - safe),
    next: to,
    from,
  };
}

export interface XpInput {
  game: ParkGameId;
  score: number;
  /** Dohráno do konce (výhra, dno, kurz, srdce…)? */
  completed?: boolean;
  /** Osobní rekord? */
  best?: boolean;
  /** Násobek z dharma validace (0 = nic, 0,5 = pečeť). */
  dharmaBonus?: number;
  /** Násobek z Consciousness Level (`cl × 0,05`, max 0,30). */
  clBonus?: number;
}

/**
 * XP za jednu dohranou hru.
 *
 * - `ratio` = skóre proti referenci světa (denní cíl), strop 1,5× — dvakrát
 *   lepší hra než „cíl" nedá neomezeně XP,
 * - dokončení +25 %, rekord +15 % (násobením, ne sčítáním — jinak by
 *   rekord z malé hry přebil dokončení velké),
 * - dharma násobek a CL bonus se přičtou až nakonec (`1 + bonus`).
 */
export function xpForRun({
  game,
  score,
  completed = false,
  best = false,
  dharmaBonus = 0,
  clBonus = 0,
}: XpInput): number {
  const base = GAME_XP[game] ?? 20;
  const reference = Math.max(1, CHALLENGE_TARGETS[game] ?? 500);
  const ratio = Math.max(0, Math.min(1.5, Math.max(0, score) / reference));
  const performance = base * (0.4 + 0.6 * ratio);
  const finish = completed ? 1.25 : 1;
  const record = best ? 1.15 : 1;
  const dharma = 1 + Math.max(0, Math.min(0.6, dharmaBonus));
  const consciousness = 1 + Math.max(0, Math.min(0.3, clBonus));
  return Math.max(1, Math.round(performance * finish * record * dharma * consciousness));
}
