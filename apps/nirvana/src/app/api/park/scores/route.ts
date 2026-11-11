/**
 * GET  /api/park/scores — tabule pouti (top 10 na hru).
 * POST /api/park/scores — odevzdat dohranou hru { game, score, name? }.
 *
 * Bez peněz a bez účtů: jméno je přezdívka, skóre je číslo. Persistence je
 * soubor, pokud je nastavený `NIRVANA_PARK_SCORES_PATH`; jinak jen v paměti
 * procesu (restart = prázdná tabule — poctivě to tak je, žádná falešná sláva).
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

const GAMES = new Set([
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
]);
const TOP = 10;
const MAX_SCORE = 100_000;
const STORE_PATH = process.env.NIRVANA_PARK_SCORES_PATH ?? '';
const RATE_MAX = 20;
const RATE_WINDOW_MS = 60_000;

interface Entry {
  game: string;
  name: string;
  score: number;
  at: number;
}

type Board = Record<string, Entry[]>;

const NO_STORE = { 'Cache-Control': 'no-store' } as const;
const hits = new Map<string, number[]>();

let board: Board | null = null;

function emptyBoard(): Board {
  return {
    pong: [],
    breakout: [],
    snake: [],
    tetris: [],
    asteroids: [],
    tower: [],
    gallery: [],
    arena: [],
    race: [],
    fight: [],
    moba: [],
    tanks: [],
    lumi: [],
    piko: [],
    neptune: [],
    pluto: [],
  };
}

function readBoard(): Board {
  if (board) return board;
  board = emptyBoard();
  if (STORE_PATH) {
    try {
      const raw = fs.readFileSync(/*turbopackIgnore: true*/ STORE_PATH, 'utf8');
      const parsed = JSON.parse(raw) as Partial<Board>;
      for (const game of GAMES) {
        const list = Array.isArray(parsed?.[game]) ? parsed[game]! : [];
        board[game] = list
          .filter((entry) => entry && typeof entry.score === 'number')
          .slice(0, TOP)
          .map((entry) => ({
            game,
            name: typeof entry.name === 'string' ? entry.name.slice(0, 12) : 'hrac',
            score: Math.max(0, Math.floor(entry.score)),
            at: Number(entry.at) || 0,
          }));
      }
    } catch {
      // chybějící nebo rozbitý soubor = čistá tabule, ne pád
    }
  }
  return board;
}

function writeBoard(next: Board) {
  board = next;
  if (!STORE_PATH) return;
  try {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    const tmp = `${STORE_PATH}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(next), 'utf8');
    fs.renameSync(tmp, STORE_PATH);
  } catch {
    // zapisovat se nepodařilo — tabule zůstává v paměti
  }
}

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 512) {
    for (const [key, stamps] of hits) {
      if (!stamps.some((t) => now - t < RATE_WINDOW_MS)) hits.delete(key);
    }
  }
  return false;
}

function cleanName(value: unknown): string {
  if (typeof value !== 'string') return 'hrac';
  const trimmed = value.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 12);
  return trimmed || 'hrac';
}

export async function GET() {
  const current = readBoard();
  return NextResponse.json({ scores: current, games: [...GAMES] }, { headers: NO_STORE });
}

export async function POST(req: NextRequest) {
  if (rateLimited(clientIp(req))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: NO_STORE });
  }

  let game = '';
  let score = -1;
  let name = 'hrac';
  try {
    const body = (await req.json()) as { game?: unknown; score?: unknown; name?: unknown };
    game = typeof body?.game === 'string' ? body.game : '';
    score = typeof body?.score === 'number' ? body.score : -1;
    name = cleanName(body?.name);
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400, headers: NO_STORE });
  }

  if (!GAMES.has(game)) {
    return NextResponse.json({ error: 'unknown_game' }, { status: 400, headers: NO_STORE });
  }
  if (!Number.isFinite(score) || score < 0 || score > MAX_SCORE) {
    return NextResponse.json({ error: 'bad_score' }, { status: 400, headers: NO_STORE });
  }

  const current = readBoard();
  const entry: Entry = { game, name, score: Math.floor(score), at: Date.now() };
  const list = [...current[game], entry].sort((a, b) => b.score - a.score || a.at - b.at).slice(0, TOP);
  const next: Board = { ...current, [game]: list };
  writeBoard(next);

  const rank = list.findIndex((row) => row === entry);
  return NextResponse.json(
    { rank: rank >= 0 ? rank + 1 : null, top: list, persisted: Boolean(STORE_PATH) },
    { headers: NO_STORE },
  );
}
