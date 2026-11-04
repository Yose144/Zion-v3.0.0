'use client';

// Reading bookmarks for the Zion Archive — localStorage only, like progress.
// A bookmark is one chapter (not a scroll position): the reader is chapter
// based and every chapter has a stable hash, so a chapter bookmark is exactly
// resumable across sessions and devices is not required.

import { useEffect, useState } from 'react';

export const BOOKMARKS_KEY = 'zion.archive.bookmarks.v1';
export const BOOKMARKS_EVENT = 'zion-archive-bookmarks';

export interface Bookmark {
  id: string;
  bookId: string;
  bookTitle: string;
  chapterSlug: string;
  chapterLabel: string;
  path: string;
  createdAt: number;
}

export function bookmarkId(bookId: string, chapterSlug: string): string {
  return `${bookId}:${chapterSlug}`;
}

function isBookmark(value: unknown): value is Bookmark {
  if (!value || typeof value !== 'object') return false;
  const b = value as Partial<Bookmark>;
  return (
    typeof b.id === 'string' &&
    typeof b.bookId === 'string' &&
    typeof b.chapterSlug === 'string' &&
    typeof b.chapterLabel === 'string' &&
    typeof b.path === 'string' &&
    typeof b.createdAt === 'number'
  );
}

export function getBookmarks(): Bookmark[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(BOOKMARKS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isBookmark).sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

function persist(list: Bookmark[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(list.slice(0, 300)));
    window.dispatchEvent(new Event(BOOKMARKS_EVENT));
  } catch {
    /* private mode — bookmarks are a convenience */
  }
}

/** Returns true when the bookmark was added, false when it was removed. */
export function toggleBookmark(entry: Omit<Bookmark, 'id' | 'createdAt'>): boolean {
  const id = bookmarkId(entry.bookId, entry.chapterSlug);
  const list = getBookmarks();
  const existing = list.find((b) => b.id === id);
  if (existing) {
    persist(list.filter((b) => b.id !== id));
    return false;
  }
  persist([{ ...entry, id, createdAt: Date.now() }, ...list]);
  return true;
}

export function removeBookmark(id: string): void {
  persist(getBookmarks().filter((b) => b.id !== id));
}

export function isBookmarked(bookId: string, chapterSlug: string): boolean {
  return getBookmarks().some((b) => b.id === bookmarkId(bookId, chapterSlug));
}

/** Bookmarks for one book (or all), kept in sync with writes and other tabs. */
export function useBookmarks(bookId?: string): Bookmark[] {
  const [all, setAll] = useState<Bookmark[]>([]);

  useEffect(() => {
    const sync = () => setAll(getBookmarks());
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener(BOOKMARKS_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(BOOKMARKS_EVENT, sync);
    };
  }, []);

  return bookId ? all.filter((b) => b.bookId === bookId) : all;
}
