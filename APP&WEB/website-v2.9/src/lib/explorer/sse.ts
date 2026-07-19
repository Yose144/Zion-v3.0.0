/**
 * ZION Explorer V4 — SSE Client Helper
 *
 * Wraps the native EventSource API with typed event handlers,
 * automatic reconnection, and cleanup.
 *
 * Usage:
 *   const sse = createExplorerSSE('/api/blockchain/sse?interval=15');
 *   const unsubStats = sse.on('stats', (data) => { ... });
 *   const unsubBlock = sse.on('new_block', (data) => { ... });
 *   // ... later
 *   sse.close();
 */

import type {
  SseStatsEvent,
  SseNewBlockEvent,
  SseMempoolUpdateEvent,
  SsePingEvent,
} from './types';

export type SseEventType = 'stats' | 'new_block' | 'mempool_update' | 'ping';

type SseEventHandler<T = unknown> = (data: T) => void;

interface SseClient {
  on: <T = unknown>(event: SseEventType, handler: SseEventHandler<T>) => () => void;
  close: () => void;
  readonly readyState: number;
}

/**
 * Create a typed SSE client for the ZION explorer.
 *
 * @param url — full URL to the SSE endpoint (e.g. '/api/blockchain/sse?interval=15')
 * @param autoReconnect — if true (default), reconnect on connection loss with backoff
 * @returns SseClient with `.on()` for subscribing and `.close()` for cleanup
 */
export function createExplorerSSE(
  url: string,
  autoReconnect = true,
): SseClient {
  let es: EventSource | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectDelay = 1000;
  const maxReconnectDelay = 30000;

  const handlers = new Map<SseEventType, Set<SseEventHandler>>();

  const connect = () => {
    try {
      es = new EventSource(url);
    } catch {
      scheduleReconnect();
      return;
    }

    es.onopen = () => {
      reconnectDelay = 1000; // reset backoff on successful connection
    };

    es.onerror = () => {
      // EventSource auto-reconnects, but if readyState is CLOSED, we do manual reconnect
      if (es?.readyState === EventSource.CLOSED && autoReconnect) {
        scheduleReconnect();
      }
    };

    // Wire up typed event listeners
    const eventTypes: SseEventType[] = ['stats', 'new_block', 'mempool_update', 'ping'];
    for (const type of eventTypes) {
      es.addEventListener(type, (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          const set = handlers.get(type);
          if (set) {
            for (const handler of set) {
              try {
                handler(data);
              } catch (err) {
                console.error(`[explorer-sse] handler error for "${type}":`, err);
              }
            }
          }
        } catch {
          // ignore parse errors
        }
      });
    }
  };

  const scheduleReconnect = () => {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      reconnectDelay = Math.min(reconnectDelay * 2, maxReconnectDelay);
      connect();
    }, reconnectDelay);
  };

  connect();

  return {
    on<T = unknown>(event: SseEventType, handler: SseEventHandler<T>): () => void {
      let set = handlers.get(event);
      if (!set) {
        set = new Set();
        handlers.set(event, set);
      }
      set.add(handler as SseEventHandler);

      // Return unsubscribe function
      return () => {
        const s = handlers.get(event);
        s?.delete(handler as SseEventHandler);
      };
    },

    close() {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (es) {
        es.close();
        es = null;
      }
      handlers.clear();
    },

    get readyState() {
      return es?.readyState ?? EventSource.CLOSED;
    },
  };
}

// ── Typed event helper (convenience) ────────────────────────────────────────

export function onStats(client: SseClient, handler: (data: SseStatsEvent) => void): () => void {
  return client.on<SseStatsEvent>('stats', handler);
}

export function onNewBlock(client: SseClient, handler: (data: SseNewBlockEvent) => void): () => void {
  return client.on<SseNewBlockEvent>('new_block', handler);
}

export function onMempoolUpdate(client: SseClient, handler: (data: SseMempoolUpdateEvent) => void): () => void {
  return client.on<SseMempoolUpdateEvent>('mempool_update', handler);
}

export function onPing(client: SseClient, handler: (data: SsePingEvent) => void): () => void {
  return client.on<SsePingEvent>('ping', handler);
}
