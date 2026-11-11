/**
 * ARÉNA — výsledek online zápasu pro progresi.
 *
 * Je to **čistá funkce** bez Reactu a three.js, aby se dala otestovat bez
 * tříminutového zápasu (`test/arena-mp-result.mjs`): server pošle
 * `secondsLeft` a tabulku, klient z toho udělá skóre, čas a výhru.
 * Komponenta (`MarsMultiplayer`) ji jen zavolá po `match_end`.
 */

import { MATCH_SECONDS } from './map';

export interface MpResult {
  frags: number;
  deaths: number;
  score: number;
  /** Odehraný čas zápasu v sekundách (ze serverových `secondsLeft`). */
  elapsedSeconds: number;
  /** Vyhrál hráč? (první v tabulce = víc fragů, při shodě méně smrtí) */
  won: boolean;
}

export function mpResultOf(input: {
  frags: number;
  deaths: number;
  /** Server posílá, kolik zbývá do konce (0 = čas vypršel). */
  timeLeft: number;
  /** Id prvního hráče v tabulce (server ji řadí podle fragů a smrtí). */
  leaderId: string | null;
  youId: string | null;
}): MpResult {
  const secondsLeft = Math.max(0, Math.min(MATCH_SECONDS, input.timeLeft));
  return {
    frags: Math.max(0, input.frags),
    deaths: Math.max(0, input.deaths),
    score: Math.max(0, input.frags * 100 - input.deaths * 25),
    elapsedSeconds: Math.max(1, Math.round(MATCH_SECONDS - secondsLeft)),
    won: Boolean(input.youId) && input.leaderId === input.youId,
  };
}
