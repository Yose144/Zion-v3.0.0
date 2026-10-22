'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { usePolling } from '@/hooks/usePolling';

/**
 * Shared blockchain stats — single fetch deduplicated across all components.
 * Uses a module-level cache so NetworkTicker, ProExplorerStats, ExplorerDashboard
 * etc. all share ONE fetch instead of each making their own /blockchain/stats call.
 */

type Stats = Record<string, any> | null;

interface SharedState {
  data: Stats;
  error: boolean;
  loading: boolean;
  refresh: () => void;
}

// Module-level singleton — shared across all hook instances on the same page
let cachedData: Stats = null;
let cachedError = false;
let cachedAt = 0;
let inFlight: Promise<void> | null = null;
const subscribers = new Set<(s: SharedState) => void>();
const CACHE_TTL = 5_000; // 5s — don't re-fetch more often than this

function notify() {
  const state: SharedState = {
    data: cachedData,
    error: cachedError,
    loading: !cachedData && !cachedError,
    refresh: doFetch,
  };
  for (const sub of subscribers) sub(state);
}

async function doFetch() {
  // Deduplicate: if a fetch is already in-flight, wait for it
  if (inFlight) return inFlight;

  // Rate-limit: don't fetch more often than CACHE_TTL
  const now = Date.now();
  if (cachedData && now - cachedAt < CACHE_TTL) {
    notify();
    return;
  }

  inFlight = (async () => {
    try {
      const json = await apiClient<any>('/blockchain/stats');
      cachedData = json;
      cachedError = false;
      cachedAt = Date.now();
    } catch {
      cachedError = true;
    } finally {
      inFlight = null;
      notify();
    }
  })();

  return inFlight;
}

export function useBlockchainStats(intervalMs = 15_000): SharedState {
  const [state, setState] = useState<SharedState>(() => ({
    data: cachedData,
    error: cachedError,
    loading: !cachedData && !cachedError,
    refresh: doFetch,
  }));

  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    // Subscribe to shared state updates
    const handler = (s: SharedState) => setState(s);
    subscribers.add(handler);

    // If no data yet, trigger initial fetch
    if (!cachedData && !cachedError && !inFlight) {
      doFetch();
    } else {
      // Already have data — push it to this subscriber
      handler({
        data: cachedData,
        error: cachedError,
        loading: false,
        refresh: doFetch,
      });
    }

    return () => {
      subscribers.delete(handler);
    };
  }, []);

  // Single polling timer — only the first subscriber starts it
  const pollRef = useRef<number | null>(null);
  useEffect(() => {
    if (pollRef.current !== null) return; // Already polling
    pollRef.current = window.setInterval(() => doFetch(), intervalMs);
    return () => {
      if (pollRef.current !== null) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [intervalMs]);

  return state;
}
