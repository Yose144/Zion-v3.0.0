/**
 * Tiny stale-while-revalidate cache for read-only explorer endpoints.
 *
 * Why: several explorer endpoints derive data by walking chain history
 * (charts = ~200 sampled blocks, richlist = balance scan, emission =
 * getSupplyInfo). Without it every cache expiry made *one* unlucky request
 * pay the full cost (1–2 s), and concurrent requests multiplied it.
 *
 * Semantics per key:
 *   - fresh  (< freshMs)  → return cached value, no work
 *   - stale  (< staleMs)  → return cached value immediately, refresh in background
 *   - expired / missing   → await the loader (deduplicated: one in-flight per key)
 *   - loader error        → keep serving the last known value (any age) if we
 *                           have one; otherwise propagate the error
 *
 * Process-local (like the rest of the explorer caches). Restart = cold start.
 */

export interface CachedValue<T> {
  value: T;
  /** True when the returned value is older than `freshMs`. */
  stale: boolean;
  /** Age of the returned value in ms (0 for freshly computed values). */
  ageMs: number;
}

interface Entry<T> {
  value: T;
  at: number;
}

export interface SwrCache<T> {
  get(key: string, loader: () => Promise<T>): Promise<CachedValue<T>>;
  /** Drop one key, or everything when `key` is omitted. */
  invalidate(key?: string): void;
  size(): number;
}

export function createSwrCache<T>(options: {
  freshMs: number;
  staleMs: number;
  maxEntries?: number;
}): SwrCache<T> {
  const { freshMs, staleMs, maxEntries = 128 } = options;
  const entries = new Map<string, Entry<T>>();
  const inFlight = new Map<string, Promise<T>>();

  const touch = (key: string, entry: Entry<T>) => {
    // Refresh insertion order so the eviction below is roughly LRU.
    entries.delete(key);
    entries.set(key, entry);
    while (entries.size > maxEntries) {
      const oldest = entries.keys().next().value;
      if (oldest === undefined) break;
      entries.delete(oldest);
    }
  };

  const load = (key: string, loader: () => Promise<T>): Promise<T> => {
    const active = inFlight.get(key);
    if (active) return active;
    const request = loader()
      .then((value) => {
        touch(key, { value, at: Date.now() });
        return value;
      })
      .finally(() => {
        if (inFlight.get(key) === request) inFlight.delete(key);
      });
    inFlight.set(key, request);
    return request;
  };

  return {
    async get(key, loader) {
      const entry = entries.get(key);
      const now = Date.now();

      if (entry) {
        const ageMs = now - entry.at;
        if (ageMs < freshMs) {
          return { value: entry.value, stale: false, ageMs };
        }
        if (ageMs < staleMs) {
          // Serve immediately; refresh in the background (errors keep the old
          // value, since `load` only replaces the entry on success).
          void load(key, loader).catch(() => undefined);
          return { value: entry.value, stale: true, ageMs };
        }
      }

      try {
        const value = await load(key, loader);
        return { value, stale: false, ageMs: 0 };
      } catch (error) {
        if (entry) return { value: entry.value, stale: true, ageMs: Date.now() - entry.at };
        throw error;
      }
    },

    invalidate(key) {
      if (key === undefined) entries.clear();
      else entries.delete(key);
    },

    size() {
      return entries.size;
    },
  };
}

/** Standard Cache-Control for explorer payloads. */
export function cacheControl(options: {
  /** Seconds a browser/shared cache may serve without revalidating. */
  maxAge?: number;
  /** Seconds a stale copy may be served while revalidating. */
  swr?: number;
  sMaxAge?: number;
} = {}): string {
  const { maxAge = 0, swr = 30, sMaxAge } = options;
  const parts = ['public'];
  if (sMaxAge !== undefined) parts.push(`s-maxage=${sMaxAge}`);
  parts.push(`max-age=${maxAge}`);
  parts.push(`stale-while-revalidate=${swr}`);
  return parts.join(', ');
}
