"use client";

/**
 * ZION Explorer V4 — SSE Hook
 *
 * Connects to the /api/blockchain/sse endpoint and provides
 * real-time updates for new blocks, mempool changes, and stats.
 *
 * Usage:
 *   const { stats, newBlock, mempoolUpdate, connected } = useExplorerSSE(15);
 */

import { useEffect, useRef, useState } from "react";
import { createExplorerSSE, onStats, onNewBlock, onMempoolUpdate } from "@/lib/explorer/sse";
import type { SseStatsEvent, SseNewBlockEvent, SseMempoolUpdateEvent } from "@/lib/explorer/types";

interface UseExplorerSSEOptions {
  interval?: number; // poll interval in seconds (default: 15)
  enabled?: boolean; // can be disabled (e.g. when tab is hidden)
}

interface ExplorerSSEState {
  stats: SseStatsEvent | null;
  lastNewBlock: SseNewBlockEvent | null;
  lastMempoolUpdate: SseMempoolUpdateEvent | null;
  connected: boolean;
  blockCount: number; // total new blocks since connection
  mempoolEventCount: number; // total mempool events since connection
}

export function useExplorerSSE(options: UseExplorerSSEOptions = {}): ExplorerSSEState {
  const { interval = 15, enabled = true } = options;

  const [state, setState] = useState<ExplorerSSEState>({
    stats: null,
    lastNewBlock: null,
    lastMempoolUpdate: null,
    connected: false,
    blockCount: 0,
    mempoolEventCount: 0,
  });

  // Keep latest state in a ref so we can update incrementally
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (!enabled) return;

    const sseUrl = `/api/blockchain/sse?interval=${interval}`;
    const client = createExplorerSSE(sseUrl);

    const unsubStats = onStats(client, (data) => {
      setState((prev) => ({ ...prev, stats: data, connected: true }));
    });

    const unsubBlock = onNewBlock(client, (data) => {
      setState((prev) => ({
        ...prev,
        lastNewBlock: data,
        connected: true,
        blockCount: prev.blockCount + 1,
      }));
    });

    const unsubMempool = onMempoolUpdate(client, (data) => {
      setState((prev) => ({
        ...prev,
        lastMempoolUpdate: data,
        connected: true,
        mempoolEventCount: prev.mempoolEventCount + 1,
      }));
    });

    return () => {
      unsubStats();
      unsubBlock();
      unsubMempool();
      client.close();
      setState((prev) => ({ ...prev, connected: false }));
    };
  }, [interval, enabled]);

  return state;
}
