import type { ParkGameId } from './games';

/**
 * Žetony a osobní rekordy. Všechno jen v prohlížeči — park nehraje o peníze
 * a nic z toho nejde směnit. Kdyby se jednou hrálo o víc, bude to jiný modul
 * s jinými pravidly, ne tahle hračka.
 */

export interface ParkProfile {
  tokens: number;
  best: Partial<Record<ParkGameId, number>>;
  runs: number;
  /** Poslední návštěva (YYYY-MM-DD) — denní vstupenka. */
  day: string | null;
  /** Zlaté vstupenky za splněné denní výzvy. */
  tickets: number;
  /** Den, kdy byla výzva naposledy splněna (YYYY-MM-DD). */
  challengeDay: string | null;
}

export const WHEEL_COST = 1;
const STORAGE_KEY = 'nirvana.park.v1';

const EMPTY: ParkProfile = { tokens: 0, best: {}, runs: 0, day: null, tickets: 0, challengeDay: null };

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function loadProfile(): ParkProfile {
  if (typeof window === 'undefined') return { ...EMPTY, best: {} };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY, best: {}, day: today(), tokens: 1 };
    const parsed = JSON.parse(raw) as Partial<ParkProfile>;
    const profile: ParkProfile = {
      tokens: Math.max(0, Math.floor(Number(parsed.tokens) || 0)),
      best: typeof parsed.best === 'object' && parsed.best ? parsed.best : {},
      runs: Math.max(0, Math.floor(Number(parsed.runs) || 0)),
      day: typeof parsed.day === 'string' ? parsed.day : null,
      tickets: Math.max(0, Math.floor(Number(parsed.tickets) || 0)),
      challengeDay: typeof parsed.challengeDay === 'string' ? parsed.challengeDay : null,
    };
    // denní vstupenka: první návštěva dne dostane žeton na kolo
    if (profile.day !== today()) {
      profile.day = today();
      profile.tokens += 1;
    }
    return profile;
  } catch {
    return { ...EMPTY, best: {}, day: today(), tokens: 1 };
  }
}

export function saveProfile(profile: ParkProfile): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // soukromý režim — hra jede dál, jen si nic nepamatuje
  }
}

export interface RunResult {
  profile: ParkProfile;
  tokensGained: number;
  personalBest: boolean;
}

/** Dohraná hra: 1 žeton za odehranou hru, 2 navíc za osobní rekord. */
export function awardRun(profile: ParkProfile, game: ParkGameId, score: number): RunResult {
  const previous = profile.best[game] ?? 0;
  const personalBest = score > previous;
  const tokensGained = 1 + (personalBest ? 2 : 0);
  const next: ParkProfile = {
    ...profile,
    runs: profile.runs + 1,
    tokens: profile.tokens + tokensGained,
    best: { ...profile.best, [game]: Math.max(previous, score) },
  };
  saveProfile(next);
  return { profile: next, tokensGained, personalBest };
}

export function spendTokens(profile: ParkProfile, amount: number): ParkProfile | null {
  if (profile.tokens < amount) return null;
  const next: ParkProfile = { ...profile, tokens: profile.tokens - amount };
  saveProfile(next);
  return next;
}
