/**
 * JEDNO MÍSTO, KDE SE ZAPISUJE DOHRANÁ HRA.
 *
 * Dřív měla každá stránka (`/park`, `/mars`, `/venus`, `/mercury`) vlastní
 * kopii stejných kroků: načti profil → přidej žetony → zkontroluj denní
 * výzvu → ulož → pošli skóre na tabuli. Čtyři kopie znamenaly, že se nové
 * pravidlo (třeba level) muselo doplnit na čtyřech místech a na jednom
 * zůstalo zapomenuté.
 *
 * Teď je to jeden `recordRun()`:
 *   - žetony za odehranou hru (+2 za osobní rekord, + bonus za pódium),
 *   - denní výzva (jednou denně, jen když sedí hra a cíl),
 *   - level z počtu dohraných her (roste i když se žetony utratí za kolo),
 *   - skóre na tabuli.
 *
 * Profil (`ParkProfile`) zůstává v `localStorage`, protože je to hra bez
 * peněz a bez účtu — nic z toho nejde směnit.
 */

import {
  awardRun,
  grantTokens,
  loadProfile,
  saveProfile,
  today,
  type ParkProfile,
  type RunResult,
} from '@/core/park/profile';
import { CHALLENGE_REWARD, claimChallenge } from '@/core/park/challenge';
import type { ParkGameId } from '@/core/park/games';
import { invalidateScores } from './boards';

export interface RunInput {
  game: ParkGameId;
  score: number;
  /** Přezdívka na tabuli; bez ní se nic neposílá. */
  nickname?: string | null;
  /** Extra žetony za umístění (pódium, výhra) — přidají se k základu. */
  bonus?: number;
  /** `false` = hra se nemá započítat (přerušená, proti botovi…). */
  ranked?: boolean;
}

export interface RunOutcome {
  profile: ParkProfile;
  tokensGained: number;
  personalBest: boolean;
  challengeClaimed: boolean;
  /** Level po zápisu a jestli se právě změnil. */
  level: number;
  levelUp: boolean;
  /** Dokončení odeslání na tabuli (null = neposílalo se). */
  posted: Promise<void> | null;
}

/**
 * Level z počtu dohraných her — ne z žetonů, protože ty se utrácejí za kolo
 * a hráč by po jízdě „zdegradoval", což nedává smysl.
 *
 * Křivka: 0 her = 1, 2 = 2, 8 = 3, 18 = 4, 32 = 5, 50 = 6 … (2·(L−1)²).
 */
export function levelFor(runs: number): number {
  if (!Number.isFinite(runs) || runs <= 0) return 1;
  return Math.floor(Math.sqrt(runs / 2)) + 1;
}

/** Kolik her potřebuješ na daný level (spodní hranice). */
export function runsForLevel(level: number): number {
  const safe = Math.max(1, Math.floor(level));
  return 2 * (safe - 1) ** 2;
}

export interface LevelProgress {
  level: number;
  /** 0..1 — jak daleko jsi k dalšímu levelu. */
  ratio: number;
  /** Kolik her ještě chybí do dalšího levelu. */
  remaining: number;
  next: number;
}

export function levelProgress(runs: number): LevelProgress {
  const level = levelFor(runs);
  const from = runsForLevel(level);
  const to = runsForLevel(level + 1);
  const span = Math.max(1, to - from);
  return {
    level,
    ratio: Math.max(0, Math.min(1, (runs - from) / span)),
    remaining: Math.max(0, to - runs),
    next: to,
  };
}

/**
 * Zapiš dohranou hru. Volá se **jednou** po skončení zápasu, ne průběžně.
 *
 * Vrací i `tokensGained`, aby si stránka mohla složit vlastní hlášku
 * („rekord · +3 žetony · denní výzva +5").
 */
export function recordRun(input: RunInput): RunOutcome {
  const profile = loadProfile();
  const ranked = input.ranked !== false;

  if (!ranked) {
    return {
      profile,
      tokensGained: 0,
      personalBest: false,
      challengeClaimed: false,
      level: levelFor(profile.runs),
      levelUp: false,
      posted: null,
    };
  }

  const score = Math.max(0, Math.round(input.score));
  const before = levelFor(profile.runs);
  let posted: Promise<void> | null = null;

  const awarded: RunResult = awardRun(profile, input.game, score);
  let next = awarded.profile;
  const challenge = claimChallenge(next, input.game, score);
  next = challenge.profile;
  if (input.bonus && input.bonus > 0) next = grantTokens(next, input.bonus);
  saveProfile(next);

  const after = levelFor(next.runs);

  if (input.nickname) {
    posted = fetch('/api/park/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game: input.game, score, name: input.nickname }),
    })
      .then(() => {
        invalidateScores();
      })
      .catch(() => undefined);
  }

  return {
    profile: next,
    tokensGained: awarded.tokensGained + (input.bonus ?? 0) + (challenge.claimed ? CHALLENGE_REWARD : 0),
    personalBest: awarded.personalBest,
    challengeClaimed: challenge.claimed,
    level: after,
    levelUp: after > before,
    posted,
  };
}

/** Přezdívka na tabuli — jedna pro všechny hry, uložená v prohlížeči. */
export function nickname(fallback = 'hrac'): string {
  if (typeof window === 'undefined') return fallback;
  try {
    const saved = window.localStorage.getItem('nirvana.park.name');
    if (saved) return saved;
    const generated = `hrac-${Math.random().toString(36).slice(2, 5)}`;
    window.localStorage.setItem('nirvana.park.name', generated);
    return generated;
  } catch {
    return fallback;
  }
}

/** Lidsky čitelná hláška po dohrané hře (jedna pro všechny hry). */
export function describeRun(outcome: RunOutcome, cs: boolean, extra: string[] = []): string {
  const bits: string[] = [...extra];
  if (outcome.personalBest) bits.push(cs ? 'rekord' : 'record');
  if (outcome.tokensGained > 0) bits.push(`+${outcome.tokensGained} ${cs ? 'žetonů' : 'tokens'}`);
  if (outcome.challengeClaimed) bits.push(cs ? `denní výzva +${CHALLENGE_REWARD}` : `daily +${CHALLENGE_REWARD}`);
  if (outcome.levelUp) bits.push(cs ? `level ${outcome.level}` : `level ${outcome.level}`);
  if (bits.length === 0) bits.push(cs ? 'zapsáno' : 'recorded');
  return bits.join(' · ');
}

/** Den pro denní vstupenku — export kvůli testům, ať se nemění datum na dvou místech. */
export { today };
