'use client';

/**
 * Tabule skóre pro všechny hry — jeden zdroj, jedno načtení.
 *
 * Dřív tabuli znala jen pouť (`/park`), i když skóre posílaly i Mars, Venuše
 * a Merkur. Hráč, který hrál jen arénu, svoje jméno nikde neviděl. Tenhle
 * modul načte `/api/park/scores` jednou pro celou appku a drží ho v modulové
 * cache, takže otevření žebříčků na páté stránce neznameá pátý request.
 */

import { useCallback, useEffect, useState } from 'react';
import { emptyScores, type ParkScores } from '@/core/park/scores';
import type { ParkGameId } from '@/core/park/games';

interface CacheEntry {
  scores: ParkScores;
  at: number;
}

let cache: CacheEntry | null = null;
let inflight: Promise<ParkScores> | null = null;
/** 30 s stačí: tabule se mění jen dohranou hrou, ne průběžně. */
const TTL_MS = 30_000;

export async function loadScores(force = false): Promise<ParkScores> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.scores;
  if (inflight) return inflight;

  inflight = fetch('/api/park/scores', { cache: 'no-store' })
    .then((response) => (response.ok ? response.json() : null))
    .then((body: { scores?: ParkScores } | null) => {
      const scores = body?.scores ?? emptyScores();
      cache = { scores, at: Date.now() };
      return scores;
    })
    .catch(() => cache?.scores ?? emptyScores())
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

/** Zneplatní cache — volá se po odeslání skóre, aby tabule nezůstala stará. */
export function invalidateScores(): void {
  cache = null;
}

export interface ScoresState {
  scores: ParkScores;
  loading: boolean;
  refresh: () => void;
}

export function useScores(): ScoresState {
  const [scores, setScores] = useState<ParkScores>(() => cache?.scores ?? emptyScores());
  const [loading, setLoading] = useState(cache === null);

  const refresh = useCallback(() => {
    setLoading(true);
    void loadScores(true)
      .then(setScores)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let live = true;
    void loadScores().then((next) => {
      if (!live) return;
      setScores(next);
      setLoading(false);
    });
    const onFocus = () => {
      void loadScores(true).then((next) => live && setScores(next));
    };
    window.addEventListener('focus', onFocus);
    return () => {
      live = false;
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return { scores, loading, refresh };
}

/** Názvy her — jedno místo pro celou appku (HUD, tabule, hlášky). */
export const GAME_TITLES: Record<ParkGameId, { cs: string; en: string; glyph: string }> = {
  pong: { cs: 'Pong', en: 'Pong', glyph: '🏓' },
  breakout: { cs: 'Breakout', en: 'Breakout', glyph: '🧱' },
  snake: { cs: 'Had', en: 'Snake', glyph: '🐍' },
  tetris: { cs: 'Tetris', en: 'Tetris', glyph: '🧩' },
  asteroids: { cs: 'Asteroidy', en: 'Asteroids', glyph: '☄️' },
  tower: { cs: 'Věž', en: 'Tower', glyph: '🧱' },
  gallery: { cs: 'Střelnice', en: 'Gallery', glyph: '🎯' },
  arena: { cs: 'Mars aréna', en: 'Mars arena', glyph: '🔫' },
  race: { cs: 'Venuše okruh', en: 'Venus circuit', glyph: '🏁' },
  fight: { cs: 'Merkur souboj', en: 'Mercury duel', glyph: '⚔' },
  moba: { cs: 'První svět', en: 'First world', glyph: '🌍' },
  tanks: { cs: 'Saturn tanky', en: 'Saturn tanks', glyph: '🛡' },
};

/** Pořadí, v jakém se hry ukazují v žebříčcích (od nejhranějších). */
export const GAME_ORDER: ParkGameId[] = [
  'arena',
  'moba',
  'race',
  'fight',
  'tanks',
  'gallery',
  'pong',
  'breakout',
  'snake',
  'tetris',
  'tower',
  'asteroids',
];
