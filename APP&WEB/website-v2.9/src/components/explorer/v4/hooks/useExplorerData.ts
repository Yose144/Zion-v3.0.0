"use client";

/**
 * ZION Explorer V4 — Data Hooks
 *
 * Polling-based data hooks for explorer pages.
 * Uses the existing usePolling infrastructure — no new dependencies needed.
 * Each hook manages its own fetch + state + error, with configurable interval.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { usePolling } from "@/hooks/usePolling";
import * as explorerApi from "@/lib/explorer/api";
import type {
  ExplorerStats,
  ExplorerBlock,
  ExplorerBlockListItem,
  ExplorerTransaction,
  ExplorerTxListItem,
  ExplorerAddress,
  ExplorerMempool,
  ExplorerPeers,
  ExplorerRichList,
} from "@/lib/explorer/types";

interface DataState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  refresh: () => void;
}

function useExplorerData<T>(
  fetcher: () => Promise<T>,
  intervalMs: number,
  enabled = true,
): DataState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const fetcherRef = useRef(fetcher);
  const refreshFlag = useRef(0);

  useEffect(() => { fetcherRef.current = fetcher; });

  const doFetch = useCallback(async () => {
    try {
      const result = await fetcherRef.current();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  // Manual refresh — increments a flag to trigger re-fetch
  const refresh = useCallback(() => {
    refreshFlag.current++;
    setLoading(true);
    void doFetch();
  }, [doFetch]);

  // Re-fetch when refreshFlag changes
  useEffect(() => {
    if (refreshFlag.current > 0) void doFetch();
  }, [refreshFlag.current]);

  usePolling(doFetch, intervalMs, { enabled, immediate: true });

  return { data, error, loading, refresh };
}

// ── Individual hooks ────────────────────────────────────────────────────────

export function useStats(intervalMs = 15_000): DataState<ExplorerStats> {
  return useExplorerData(explorerApi.getStats, intervalMs);
}

export function useBlocks(limit = 20, offset = 0, intervalMs = 15_000): DataState<ExplorerBlockListItem[]> {
  return useExplorerData(() => explorerApi.getBlocks(limit, offset), intervalMs);
}

export function useBlock(heightOrHash: number | string | null, intervalMs = 30_000): DataState<ExplorerBlock> {
  return useExplorerData(
    () => heightOrHash !== null ? explorerApi.getBlock(heightOrHash) : Promise.reject(new Error("No block identifier")),
    intervalMs,
    heightOrHash !== null,
  );
}

export function useTransaction(hash: string | null, intervalMs = 30_000): DataState<ExplorerTransaction> {
  return useExplorerData(
    () => hash ? explorerApi.getTransaction(hash) : Promise.reject(new Error("No tx hash")),
    intervalMs,
    !!hash,
  );
}

export function useTransactions(limit = 20, offset = 0, intervalMs = 15_000): DataState<{ count: number; total_tx_count: number; transactions: ExplorerTxListItem[]; items: ExplorerTxListItem[] }> {
  return useExplorerData(() => explorerApi.getTransactions(limit, offset), intervalMs);
}

export function useAddress(address: string | null, intervalMs = 30_000): DataState<ExplorerAddress> {
  return useExplorerData(
    () => address ? explorerApi.getAddress(address) : Promise.reject(new Error("No address")),
    intervalMs,
    !!address,
  );
}

export function useMempool(intervalMs = 5_000): DataState<ExplorerMempool> {
  return useExplorerData(explorerApi.getMempool, intervalMs);
}

export function usePeers(intervalMs = 30_000): DataState<ExplorerPeers> {
  return useExplorerData(explorerApi.getPeers, intervalMs);
}

export function useRichList(intervalMs = 60_000): DataState<ExplorerRichList> {
  return useExplorerData(explorerApi.getRichList, intervalMs);
}
