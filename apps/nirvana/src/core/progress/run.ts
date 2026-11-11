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
 *   - **XP** z výkonu (`core/progress/xp.ts`) — z XP roste level,
 *   - **dharma validace** (`core/progress/dharma.ts`) — pět pilířů, pečeť
 *     a násobek XP,
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
import { applyVerdict, validateRun, type DharmaVerdict, type RunMetrics } from './dharma';
import { levelFromXp, xpForRun } from './xp';

export interface RunInput {
  game: ParkGameId;
  score: number;
  /** Přezdívka na tabuli; bez ní se nic neposílá. */
  nickname?: string | null;
  /** Extra žetony za umístění (pódium, výhra) — přidají se k základu. */
  bonus?: number;
  /** `false` = hra se nemá započítat (přerušená, proti botovi…). */
  ranked?: boolean;
  /** Co hra o sobě řekne dharma validátoru (čas, cíl, objektivy, dary…). */
  metrics?: RunMetrics;
}

export interface RunOutcome {
  profile: ParkProfile;
  tokensGained: number;
  personalBest: boolean;
  challengeClaimed: boolean;
  /** Level po zápisu a jestli se právě změnil. */
  level: number;
  levelUp: boolean;
  /** XP po zápisu a kolik jich hra dala. */
  xp: number;
  xpGained: number;
  /** Dharma verdikt (null = hra se nepočítala). */
  dharma: DharmaVerdict | null;
  /** Dokončení odeslání na tabuli (null = neposílalo se). */
  posted: Promise<void> | null;
}

/**
 * Zapiš dohranou hru. Volá se **jednou** po skončení zápasu, ne průběžně.
 *
 * Vrací i `tokensGained` / `xpGained` / `dharma`, aby si stránka mohla
 * složit vlastní hlášku („rekord · +3 žetony · +48 XP · ☸ 4/5").
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
      level: levelFromXp(profile.xp),
      levelUp: false,
      xp: profile.xp,
      xpGained: 0,
      dharma: null,
      posted: null,
    };
  }

  const score = Math.max(0, Math.round(input.score));
  const before = levelFromXp(profile.xp);
  let posted: Promise<void> | null = null;

  // dharma validace běží před zápisem — její násobek patří do XP
  const verdict = validateRun({ ...input.metrics, score });

  const awarded: RunResult = awardRun(profile, input.game, score);
  let next = awarded.profile;
  const challenge = claimChallenge(next, input.game, score);
  next = challenge.profile;
  if (input.bonus && input.bonus > 0) next = grantTokens(next, input.bonus);

  const xpGained = xpForRun({
    game: input.game,
    score,
    completed: input.metrics?.completed === true,
    best: awarded.personalBest,
    dharmaBonus: verdict.bonus,
  });
  next = {
    ...next,
    xp: next.xp + xpGained,
    dharma: applyVerdict(next.dharma, verdict),
  };
  saveProfile(next);

  const after = levelFromXp(next.xp);

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
    xp: next.xp,
    xpGained,
    dharma: verdict,
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

/** Krátká značka verdiktu do hlášky (`☸ pečeť`, `☸ 4/5`). */
export function dharmaLabel(verdict: DharmaVerdict | null, cs: boolean): string {
  if (!verdict) return '';
  if (verdict.grade === 'seal') return cs ? '☸ dharma pečeť' : '☸ dharma seal';
  if (verdict.grade === 'pass') return cs ? `☸ ${verdict.passed}/5` : `☸ ${verdict.passed}/5`;
  if (verdict.grade === 'partial') return cs ? `☸ ${verdict.passed}/5` : `☸ ${verdict.passed}/5`;
  return cs ? '☸ neúplné' : '☸ incomplete';
}

/** Lidsky čitelná hláška po dohrané hře (jedna pro všechny hry). */
export function describeRun(outcome: RunOutcome, cs: boolean, extra: string[] = []): string {
  const bits: string[] = [...extra];
  if (outcome.personalBest) bits.push(cs ? 'rekord' : 'record');
  if (outcome.tokensGained > 0) bits.push(`+${outcome.tokensGained} ${cs ? 'žetonů' : 'tokens'}`);
  if (outcome.xpGained > 0) bits.push(`+${outcome.xpGained} XP`);
  if (outcome.dharma) bits.push(dharmaLabel(outcome.dharma, cs));
  if (outcome.challengeClaimed) bits.push(cs ? `denní výzva +${CHALLENGE_REWARD}` : `daily +${CHALLENGE_REWARD}`);
  if (outcome.levelUp) bits.push(cs ? `level ${outcome.level}` : `level ${outcome.level}`);
  if (bits.length === 0) bits.push(cs ? 'zapsáno' : 'recorded');
  return bits.join(' · ');
}

/** Den pro denní vstupenku — export kvůli testům, ať se nemění datum na dvou místech. */
export { today };
