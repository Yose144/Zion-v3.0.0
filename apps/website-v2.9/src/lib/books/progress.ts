'use client';

// Local reading progress for the Zion Archive library.
//
// Stored in localStorage only — no account, no server call, no tracking. The
// archive is a paid library, so progress must survive without any backend
// session: a reader who opens a chapter today finds "continue reading" after a
// restart. Every write also emits a window event so the hub reacts immediately
// (same tab) and a `storage` listener covers other tabs.

import { useEffect, useState } from 'react';

export const READING_PROGRESS_KEY = 'zion.archive.progress.v1';
export const READING_PROGRESS_EVENT = 'zion-archive-progress';

export interface BookProgressEntry {
  bookId: string;
  /** Reader route, e.g. /zion-archive/nirvana/cist — used by "continue reading". */
  path: string;
  chapterSlug: string;
  /** 0-based index inside the book's chapter list. */
  chapterIndex: number;
  totalChapters: number;
  /** Localized "Kapitola 3 — Jméno" label captured at read time. */
  chapterLabel: string;
  bookTitle: string;
  updatedAt: number;
}

export type ReadingProgress = Record<string, BookProgressEntry>;

function isEntry(value: unknown): value is BookProgressEntry {
  if (!value || typeof value !== 'object') return false;
  const e = value as Partial<BookProgressEntry>;
  return (
    typeof e.bookId === 'string' &&
    typeof e.path === 'string' &&
    typeof e.chapterSlug === 'string' &&
    typeof e.chapterIndex === 'number' &&
    typeof e.totalChapters === 'number' &&
    typeof e.updatedAt === 'number'
  );
}

/** Read the whole map; returns `{}` when storage is unavailable or corrupt. */
export function getReadingProgress(): ReadingProgress {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(READING_PROGRESS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: ReadingProgress = {};
    for (const [id, entry] of Object.entries(parsed as Record<string, unknown>)) {
      if (isEntry(entry)) out[id] = entry;
    }
    return out;
  } catch {
    return {};
  }
}

/** Persist one book's progress and notify listeners (same tab + other tabs). */
export function saveReadingProgress(entry: BookProgressEntry): void {
  if (typeof window === 'undefined') return;
  try {
    const next = { ...getReadingProgress(), [entry.bookId]: entry };
    // keep the store tiny: most recent 60 books is far more than the library
    const trimmed = Object.fromEntries(
      Object.entries(next)
        .sort((a, b) => b[1].updatedAt - a[1].updatedAt)
        .slice(0, 60),
    );
    window.localStorage.setItem(READING_PROGRESS_KEY, JSON.stringify(trimmed));
    window.dispatchEvent(new Event(READING_PROGRESS_EVENT));
  } catch {
    /* private mode / quota — progress is a convenience, never a failure */
  }
}

export function clearReadingProgress(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(READING_PROGRESS_KEY);
    window.dispatchEvent(new Event(READING_PROGRESS_EVENT));
  } catch {
    /* ignore */
  }
}

/** 1-based percent of the book finished (last opened chapter counts as reached). */
export function progressPercent(entry: BookProgressEntry | undefined): number {
  if (!entry || entry.totalChapters <= 0) return 0;
  const reached = Math.min(entry.totalChapters, Math.max(1, entry.chapterIndex + 1));
  return Math.round((reached / entry.totalChapters) * 100);
}

/** Most recently opened books first — the source for "continue reading". */
export function recentProgress(progress: ReadingProgress, limit = 3): BookProgressEntry[] {
  return Object.values(progress)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit);
}

/** Client hook: current progress map, updated on write/storage events. */
export function useReadingProgress(): ReadingProgress {
  const [progress, setProgress] = useState<ReadingProgress>({});

  useEffect(() => {
    const sync = () => setProgress(getReadingProgress());
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener(READING_PROGRESS_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(READING_PROGRESS_EVENT, sync);
    };
  }, []);

  return progress;
}
