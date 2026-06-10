"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "zion_explorer_watchlist";

export interface WatchlistItem {
  address: string;
  label?: string;
  addedAt: number;
}

export function useWatchlist() {
  const [items, setItems] = useState<WatchlistItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch { /* silent */ }
  }, []);

  const add = useCallback((address: string, label?: string) => {
    setItems((prev) => {
      if (prev.some((i) => i.address === address)) return prev;
      const next = [...prev, { address, label, addedAt: Date.now() }];
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* silent */ }
      return next;
    });
  }, []);

  const remove = useCallback((address: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.address !== address);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* silent */ }
      return next;
    });
  }, []);

  const toggle = useCallback((address: string, label?: string) => {
    setItems((prev) => {
      const exists = prev.some((i) => i.address === address);
      const next = exists ? prev.filter((i) => i.address !== address) : [...prev, { address, label, addedAt: Date.now() }];
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* silent */ }
      return next;
    });
  }, []);

  const isWatched = useCallback((address: string) => items.some((i) => i.address === address), [items]);

  return { items, add, remove, toggle, isWatched };
}
