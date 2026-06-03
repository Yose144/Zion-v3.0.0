// ─── usePolling — adaptive interval hook ─────────────────────────────────────
import { useEffect, useRef } from 'react';
import { useStatusStore } from '../stores/statusStore';
import { useSettingsStore } from '../stores/settingsStore';

/**
 * Polls the given async function at `intervalMs` (from settings).
 * When WebSocket is connected we use 2× longer interval (WS is the real-time
 * channel; polling is just a safety net).
 */
export function usePolling(fn: () => Promise<void>, baseFactor = 1) {
  const connected = useStatusStore((s) => s.connected);
  const interval = useSettingsStore((s) => s.refreshIntervalMs);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    const ms = connected ? interval * 2 * baseFactor : interval * baseFactor;
    const id = setInterval(() => { fnRef.current().catch(() => {}); }, ms);
    return () => clearInterval(id);
  }, [connected, interval, baseFactor]);
}
