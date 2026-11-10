/**
 * PAS — postup hráče v Te Pīko Ora.
 *
 * Drží medaile, osobní rekordy a **odemčené lodi/prkna**. Je to jen
 * `localStorage` (stejně jako pouť a Lumi), žádné peníze a žádná identita;
 * nic z toho nejde směnit.
 *
 * Pravidla:
 *  - medaile se nikdy nesnižuje (jednou zlatá = navždy zlatá),
 *  - skin se odemyká medailí ve **svém** módu (bronzová kánoe neodemkne prkno),
 *  - ghost se ukládá jen při novém rekordu (jinak by se přepsal lepší běh),
 *  - poškozený/upravený JSON se zahodí nebo ohne na bezpečné hodnoty.
 *
 * Čisté funkce (`medalFor`, `applyRun`, `unlockedSkins`, `setSkin`) jdou
 * testovat bez prohlížeče; `load`/`save` jsou jen tenká vrstva nad
 * `localStorage`.
 */

import { createGhostRun, type GhostPoint, type GhostRun } from './ghost';
import type { PikoMode } from './world';

export type Medal = 'none' | 'bronze' | 'silver' | 'gold';

const RANK: Record<Medal, number> = { none: 0, bronze: 1, silver: 2, gold: 3 };

export function medalRank(medal: Medal): number {
  return RANK[medal] ?? 0;
}

export function betterMedal(a: Medal, b: Medal): Medal {
  return medalRank(a) >= medalRank(b) ? a : b;
}

/**
 * Hranice medailí. Kalibrované ke skóre, ne k času: kánoe dá max 1200,
 * surf kolem 1100 (i s triky). Bronz znamená „dohráno slušně“, zlato
 * „čistá jízda s bonusem“, ne „štěstí na jednu vlnu“.
 */
export const PIKO_MEDALS: Record<PikoMode, { bronze: number; silver: number; gold: number }> = {
  canoe: { bronze: 720, silver: 900, gold: 1050 },
  surf: { bronze: 600, silver: 820, gold: 1000 },
};

export function medalFor(score: number, mode: PikoMode): Medal {
  const safe = Math.max(0, score);
  const limits = PIKO_MEDALS[mode];
  if (safe >= limits.gold) return 'gold';
  if (safe >= limits.silver) return 'silver';
  if (safe >= limits.bronze) return 'bronze';
  return 'none';
}

export interface SkinName {
  cs: string;
  en: string;
  es?: string;
  pt?: string;
  fr?: string;
}

export interface PikoSkin {
  id: string;
  name: SkinName;
  /** `none` = dostupný od začátku. */
  unlock: Medal;
  /** Kánoe: trup a lem. */
  hull?: string;
  trim?: string;
  /** Surf: prkno a pruh. */
  deck?: string;
  stripe?: string;
}

export const CANOE_SKINS: PikoSkin[] = [
  {
    id: 'koa',
    name: { cs: 'Koa', en: 'Koa', es: 'Koa' },
    unlock: 'none',
    hull: '#6b4a29',
    trim: '#c9a458',
  },
  {
    id: 'moana',
    name: { cs: 'Moana', en: 'Moana', es: 'Moana' },
    unlock: 'bronze',
    hull: '#2f6f74',
    trim: '#bfe6ea',
  },
  {
    id: 'ahi',
    name: { cs: 'Ahi', en: 'Ahi', es: 'Ahi' },
    unlock: 'gold',
    hull: '#8a2f3a',
    trim: '#ffd166',
  },
];

export const SURF_SKINS: PikoSkin[] = [
  {
    id: 'nalu',
    name: { cs: 'Nalu', en: 'Nalu', es: 'Nalu' },
    unlock: 'none',
    deck: '#2fb8ad',
    stripe: '#ffd166',
  },
  {
    id: 'moana',
    name: { cs: 'Moana', en: 'Moana', es: 'Moana' },
    unlock: 'bronze',
    deck: '#2f6f9a',
    stripe: '#bfe6ea',
  },
  {
    id: 'ahi',
    name: { cs: 'Ahi', en: 'Ahi', es: 'Ahi' },
    unlock: 'gold',
    deck: '#c2553c',
    stripe: '#ffe9a8',
  },
];

export function skinsFor(mode: PikoMode): PikoSkin[] {
  return mode === 'canoe' ? CANOE_SKINS : SURF_SKINS;
}

export function skinById(mode: PikoMode, id: string): PikoSkin | null {
  return skinsFor(mode).find((skin) => skin.id === id) ?? null;
}

export function defaultSkin(mode: PikoMode): PikoSkin {
  return skinsFor(mode)[0]!;
}

/** Aktivní skin podle pasu (když je uložený id neplatný, padá na výchozí). */
export function activeSkin(passport: PikoPassport, mode: PikoMode): PikoSkin {
  const skin = skinById(mode, passport.skins[mode]);
  if (skin && medalRank(passport.medals[mode]) >= medalRank(skin.unlock)) return skin;
  return defaultSkin(mode);
}

export function unlockedSkins(passport: PikoPassport, mode: PikoMode): PikoSkin[] {
  const rank = medalRank(passport.medals[mode]);
  return skinsFor(mode).filter((skin) => rank >= medalRank(skin.unlock));
}

export interface PikoPassport {
  runs: number;
  best: Record<PikoMode, number>;
  /** Čas/Cas jízdy, ve které padl rekord (s). */
  bestTime: Record<PikoMode, number | null>;
  medals: Record<PikoMode, Medal>;
  /** Vybraný skin pro každý mód. */
  skins: Record<PikoMode, string>;
  ghost: Record<PikoMode, GhostRun | null>;
}

export function emptyPassport(): PikoPassport {
  return {
    runs: 0,
    best: { canoe: 0, surf: 0 },
    bestTime: { canoe: null, surf: null },
    medals: { canoe: 'none', surf: 'none' },
    skins: { canoe: defaultSkin('canoe').id, surf: defaultSkin('surf').id },
    ghost: { canoe: null, surf: null },
  };
}

export interface PikoRunInput {
  mode: PikoMode;
  score: number;
  elapsed: number;
  /** Vzorky dráhy z právě dojeté jízdy (pro ghosta). */
  ghostPoints?: GhostPoint[];
}

export interface PikoRunOutcome {
  passport: PikoPassport;
  /** Medaile, kterou tenhle běh získal (i když je nižší než dosavadní). */
  medal: Medal;
  improved: boolean;
  /** Skin(y), které se právě odemkly. */
  newSkins: PikoSkin[];
  ghostSaved: boolean;
}

/** Zapiš dohranou jízdu. Čistá funkce — nemění vstupní pas. */
export function applyRun(passport: PikoPassport, input: PikoRunInput): PikoRunOutcome {
  const mode = input.mode;
  const score = Math.max(0, Math.round(Number.isFinite(input.score) ? input.score : 0));
  const elapsed = Math.max(0, Number.isFinite(input.elapsed) ? input.elapsed : 0);
  const medal = medalFor(score, mode);
  const improved = score > passport.best[mode];

  const ghost = improved && input.ghostPoints
    ? createGhostRun(mode, score, input.ghostPoints)
    : null;

  const next: PikoPassport = {
    runs: passport.runs + 1,
    best: { ...passport.best, [mode]: Math.max(score, passport.best[mode]) },
    bestTime: {
      ...passport.bestTime,
      [mode]: improved ? Math.round(elapsed * 10) / 10 : passport.bestTime[mode],
    },
    medals: { ...passport.medals, [mode]: betterMedal(passport.medals[mode], medal) },
    skins: { ...passport.skins },
    ghost: { ...passport.ghost, [mode]: ghost ?? passport.ghost[mode] },
  };

  const before = new Set(unlockedSkins(passport, mode).map((skin) => skin.id));
  const newSkins = unlockedSkins(next, mode).filter((skin) => !before.has(skin.id));

  return { passport: next, medal, improved, newSkins, ghostSaved: ghost !== null };
}

/** Změna skinu — jen na odemčený. Vrací `null`, když to nejde. */
export function setSkin(passport: PikoPassport, mode: PikoMode, id: string): PikoPassport | null {
  const skin = skinById(mode, id);
  if (!skin) return null;
  if (medalRank(passport.medals[mode]) < medalRank(skin.unlock)) return null;
  if (passport.skins[mode] === id) return passport;
  return { ...passport, skins: { ...passport.skins, [mode]: id } };
}

/* ── persistence ──────────────────────────────────────────────────── */

const STORAGE_KEY = 'nirvana.piko.v1';

function isMedal(value: unknown): value is Medal {
  return value === 'none' || value === 'bronze' || value === 'silver' || value === 'gold';
}

function finite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function sanitizeGhost(value: unknown, mode: PikoMode): GhostRun | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<GhostRun>;
  if (raw.mode !== mode || !Array.isArray(raw.points) || raw.points.length < 8) return null;
  const points: GhostPoint[] = [];
  for (const point of raw.points.slice(0, 900)) {
    if (!point || typeof point !== 'object') continue;
    const candidate = point as Partial<GhostPoint>;
    if (
      typeof candidate.t !== 'number' ||
      typeof candidate.x !== 'number' ||
      typeof candidate.z !== 'number' ||
      typeof candidate.heading !== 'number'
    ) {
      continue;
    }
    if (!Number.isFinite(candidate.t) || !Number.isFinite(candidate.x)) continue;
    if (!Number.isFinite(candidate.z) || !Number.isFinite(candidate.heading)) continue;
    points.push({
      t: candidate.t,
      x: candidate.x,
      z: candidate.z,
      heading: candidate.heading,
    });
  }
  if (points.length < 8) return null;
  return { mode, score: finite(raw.score), points };
}

function sanitize(raw: unknown): PikoPassport {
  const base = emptyPassport();
  if (!raw || typeof raw !== 'object') return base;
  const data = raw as Partial<PikoPassport>;
  const medals = data.medals && typeof data.medals === 'object' ? data.medals : {};
  const skins = data.skins && typeof data.skins === 'object' ? data.skins : {};
  const best = data.best && typeof data.best === 'object' ? data.best : {};
  const bestTime = data.bestTime && typeof data.bestTime === 'object' ? data.bestTime : {};
  const ghost = data.ghost && typeof data.ghost === 'object' ? data.ghost : {};

  const passport: PikoPassport = {
    runs: Math.max(0, Math.floor(finite(data.runs))),
    best: {
      canoe: Math.max(0, Math.round(finite((best as Record<string, unknown>).canoe))),
      surf: Math.max(0, Math.round(finite((best as Record<string, unknown>).surf))),
    },
    bestTime: {
      canoe: typeof (bestTime as Record<string, unknown>).canoe === 'number'
        ? Math.max(0, finite((bestTime as Record<string, unknown>).canoe))
        : null,
      surf: typeof (bestTime as Record<string, unknown>).surf === 'number'
        ? Math.max(0, finite((bestTime as Record<string, unknown>).surf))
        : null,
    },
    medals: {
      canoe: isMedal((medals as Record<string, unknown>).canoe)
        ? ((medals as Record<string, unknown>).canoe as Medal)
        : 'none',
      surf: isMedal((medals as Record<string, unknown>).surf)
        ? ((medals as Record<string, unknown>).surf as Medal)
        : 'none',
    },
    skins: {
      canoe: typeof (skins as Record<string, unknown>).canoe === 'string'
        ? ((skins as Record<string, unknown>).canoe as string)
        : base.skins.canoe,
      surf: typeof (skins as Record<string, unknown>).surf === 'string'
        ? ((skins as Record<string, unknown>).surf as string)
        : base.skins.surf,
    },
    ghost: {
      canoe: sanitizeGhost((ghost as Record<string, unknown>).canoe, 'canoe'),
      surf: sanitizeGhost((ghost as Record<string, unknown>).surf, 'surf'),
    },
  };

  // Neplatný nebo zamčený skin se nesmí zobrazit (a už vůbec ne uložit).
  passport.skins.canoe = activeSkin(passport, 'canoe').id;
  passport.skins.surf = activeSkin(passport, 'surf').id;
  return passport;
}

export function loadPassport(): PikoPassport {
  if (typeof window === 'undefined') return emptyPassport();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyPassport();
    return sanitize(JSON.parse(raw));
  } catch {
    return emptyPassport();
  }
}

export function savePassport(passport: PikoPassport): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(passport));
  } catch {
    /* plný disk / soukromý režim — hra jede dál bez pasu */
  }
}

export { STORAGE_KEY as PIKO_PASSPORT_KEY };
