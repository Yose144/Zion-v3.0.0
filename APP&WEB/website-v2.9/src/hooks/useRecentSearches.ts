"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "zion_explorer_recent_searches";
const MAX_ITEMS = 10;

export interface RecentSearch {
  query: string;
  href: string;
  type: string;
  timestamp: number;
}

export function useRecentSearches() {
  const [recents, setRecents] = useState<RecentSearch[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setRecents(JSON.parse(raw));
    } catch { /* silent */ }
  }, []);

  const persist = useCallback((next: RecentSearch[]) => {
    setRecents(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch { /* silent */ }
  }, []);

  const add = useCallback((query: string, href: string, type: string) => {
    if (!query.trim()) return;
    setRecents((prev) => {
      const filtered = prev.filter((r) => r.query !== query);
      const next = [{ query, href, type, timestamp: Date.now() }, ...filtered].slice(0, MAX_ITEMS);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* silent */ }
      return next;
    });
  }, []);

  const remove = useCallback((query: string) => {
    setRecents((prev) => {
      const next = prev.filter((r) => r.query !== query);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* silent */ }
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setRecents([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* silent */ }
  }, []);

  return { recents, add, remove, clear };
}
