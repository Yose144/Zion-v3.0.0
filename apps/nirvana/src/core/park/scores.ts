import type { ParkGameId } from './games';

/** Tabule pouti — top 10 na hru, jak je vrací `/api/park/scores`. */
export interface ParkScoreEntry {
  name: string;
  score: number;
  at: number;
}

export type ParkScores = Partial<Record<ParkGameId, ParkScoreEntry[]>>;

export function emptyScores(): ParkScores {
  return { pong: [], breakout: [], snake: [] };
}

export function topScore(scores: ParkScores, game: ParkGameId): number {
  return scores[game]?.[0]?.score ?? 0;
}
