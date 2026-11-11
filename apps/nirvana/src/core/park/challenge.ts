import type { ParkGameId } from './games';
import type { ParkProfile } from './profile';

/**
 * Denní výzva — jediný důvod, proč se do parku vracet každý den.
 *
 * Vybere se deterministicky z data: stejný den = stejná hra a stejný cíl pro
 * všechny. Splnění dá žetony navíc a zlatou vstupenku; podruhé už ne.
 * Žádné peníze, žádná směna — jen číslo, které roste.
 */

export interface DailyChallenge {
  /** YYYY-MM-DD podle lokálního času. */
  day: string;
  game: ParkGameId;
  target: number;
  reward: number;
}

export const CHALLENGE_GAMES: ParkGameId[] = [
  'pong',
  'breakout',
  'snake',
  'tetris',
  'asteroids',
  'tower',
  'gallery',
  'arena',
  'race',
  'fight',
  'moba',
  'tanks',
  'lumi',
  'piko',
  'neptune',
  'pluto',
  'fleet',
];

/** Cíle podle toho, kolik bodů hra reálně dává. */
export const CHALLENGE_TARGETS: Record<ParkGameId, number> = {
  pong: 500, // 5 bodů ve Pongu
  breakout: 300, // 30 cihel
  snake: 200, // 8 jablek
  tetris: 400, // 4 řádky
  asteroids: 300, // 6 velkých skal nebo vlna 2
  tower: 250, // 16 pater (i s pár perfecty)
  gallery: 150, // 15 zásahů
  arena: 500, // 5 fragů
  race: 3000, // 3 kola pod ~100 s
  fight: 170, // vyhrát duel (i 2:1)
  moba: 600, // vyhraný zápas na Prvním světě
  tanks: 300, // vyhrát tankový duel 2:0
  lumi: 900, // donést všech sedm světel (700 + časový bonus)
  piko: 600, // laguna: šest bójí nebo tři vlny
  neptune: 600, // hlubina: ~600 m sestupu (nebo 500 m a dvě světla)
  pluto: 600, // srdce: pět lamp a kousek tepla navrch
  fleet: 300, // flotila: doletět a přistát (vzdálenost + dok)
};

export const CHALLENGE_REWARD = 5;

function dayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function hash(text: string): number {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

export function dailyChallenge(date = new Date()): DailyChallenge {
  const day = dayKey(date);
  const seed = hash(day);
  const game = CHALLENGE_GAMES[seed % CHALLENGE_GAMES.length]!;
  return { day, game, target: CHALLENGE_TARGETS[game], reward: CHALLENGE_REWARD };
}

export interface ChallengeResult {
  profile: ParkProfile;
  claimed: boolean;
}

/**
 * Splnění denní výzvy: jednou denně, jen když hra sedí a skóre dosáhne cíle.
 * Volá se po každé dohrané hře (i nesplněné — pak jen nic neudělá).
 */
export function claimChallenge(
  profile: ParkProfile,
  game: ParkGameId,
  score: number,
  date = new Date(),
): ChallengeResult {
  const challenge = dailyChallenge(date);
  if (
    profile.challengeDay === challenge.day ||
    game !== challenge.game ||
    score < challenge.target
  ) {
    return { profile, claimed: false };
  }
  return {
    profile: {
      ...profile,
      challengeDay: challenge.day,
      tickets: profile.tickets + 1,
      tokens: profile.tokens + challenge.reward,
    },
    claimed: true,
  };
}

/* ── denní dharma cíl ─────────────────────────────────────────────────
 * Druhá polovinа dne: výzva chce **skóre**, dharma cíl chce **pečeť**
 * (tedy čistý běh — čas, cíl, světla, žádné pády). Stejná hra jako výzva
 * by oba cíle slila do jednoho, proto se losuje s jiným solí.
 */

export const DHARMA_GOAL_REWARD = 3;

export interface DharmaGoal {
  day: string;
  game: ParkGameId;
  reward: number;
}

export function dailyDharmaGoal(date = new Date()): DharmaGoal {
  const day = dayKey(date);
  const seed = hash(`dharma:${day}`);
  const game = CHALLENGE_GAMES[seed % CHALLENGE_GAMES.length]!;
  return { day, game, reward: DHARMA_GOAL_REWARD };
}

/**
 * Splnění dharma cíle: jednou denně, jen když hra sedí a verdikt je pečeť.
 * Volá se po každé dohrané hře (i nesplněné — pak jen nic neudělá).
 */
export function claimDharmaGoal(
  profile: ParkProfile,
  game: ParkGameId,
  grade: string,
  date = new Date(),
): ChallengeResult {
  const goal = dailyDharmaGoal(date);
  if (profile.dharmaGoalDay === goal.day || game !== goal.game || grade !== 'seal') {
    return { profile, claimed: false };
  }
  return {
    profile: {
      ...profile,
      dharmaGoalDay: goal.day,
      tokens: profile.tokens + goal.reward,
    },
    claimed: true,
  };
}
