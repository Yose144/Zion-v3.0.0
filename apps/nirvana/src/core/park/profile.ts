import type { ParkGameId } from './games';
import { type DharmaSealState, EMPTY_DHARMA } from '@/core/progress/dharma';

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
  /** Den poslední dokončené jízdy na kole — bonus za první jízdu dne. */
  rideDay: string | null;
  /** Zkušenosti (2026-11-11). Level se počítá z nich, ne z počtu her. */
  xp: number;
  /** Dharma validace — pečeti a poslední verdikt. */
  dharma: DharmaSealState;
}

export const WHEEL_COST = 1;
const STORAGE_KEY = 'nirvana.park.v1';

const EMPTY: ParkProfile = {
  tokens: 0,
  best: {},
  runs: 0,
  day: null,
  tickets: 0,
  challengeDay: null,
  rideDay: null,
  xp: 0,
  dharma: EMPTY_DHARMA,
};

/**
 * Migrace starého profilu: level dřív rostl z počtu her (`2·(L−1)²`) a nová
 * křivka je `120·(L−1)²` z XP. `runs × 60` dá přesně stejný level, takže
 * nikdo po aktualizaci „nezdegraduje" (test to hlídá).
 */
function migratedXp(runs: number): number {
  return Math.max(0, Math.floor(runs)) * 60;
}

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
      rideDay: typeof parsed.rideDay === 'string' ? parsed.rideDay : null,
      xp:
        parsed.xp === undefined || parsed.xp === null
          ? migratedXp(Number(parsed.runs) || 0)
          : Math.max(0, Math.floor(Number(parsed.xp) || 0)),
      dharma:
        parsed.dharma && typeof parsed.dharma === 'object'
          ? {
              seals: Math.max(0, Math.floor(Number((parsed.dharma as DharmaSealState).seals) || 0)),
              validations: Math.max(0, Math.floor(Number((parsed.dharma as DharmaSealState).validations) || 0)),
              last: (parsed.dharma as DharmaSealState).last ?? null,
            }
          : EMPTY_DHARMA,
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
  // Lišta a panel Cesty čtou profil při mountu a při `focus`; hra, která
  // skončí bez navigace, by jinak ukazovala stará čísla (přesně to se
  // stalo: po dohraném Neptunu měl panel XP 0 a žádný verdikt).
  try {
    window.dispatchEvent(new CustomEvent('nirvana:profile'));
  } catch {
    // staré prohlížeče bez CustomEvent — čísla se dohoní při focus
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

/** Žetony navíc — pódium v závodě, odměna za výzvu. Taky se hned ukládá. */
export function grantTokens(profile: ParkProfile, amount: number): ParkProfile {
  if (amount <= 0) return profile;
  const next: ParkProfile = { ...profile, tokens: profile.tokens + amount };
  saveProfile(next);
  return next;
}

/**
 * Dokončená jízda na kole. První jízda dne je zdarma — žeton se vrátí.
 * Nejde z toho vydělat: kolo stojí 1 a vrátí 1, takže bilance je nula;
 * druhá a další jízda téhož dne stojí vstupné jako obyčejně.
 */
export function claimRideBonus(profile: ParkProfile): { profile: ParkProfile; granted: boolean } {
  if (profile.rideDay === today()) return { profile, granted: false };
  const next: ParkProfile = { ...profile, rideDay: today(), tokens: profile.tokens + 1 };
  saveProfile(next);
  return { profile: next, granted: true };
}
