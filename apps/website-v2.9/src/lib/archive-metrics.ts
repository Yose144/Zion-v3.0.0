import 'server-only';

// Lightweight in-process counters for the archive gate (no external store).
// Exposed as Prometheus text by /api/archive/metrics for scraping.
// Counters reset on deploy — same convention as the rest of the site.

interface ArchiveMetricsStore {
  granted: number;
  denied: number;
  downloads: Record<string, number>;
  since: string;
}

const globalStore = globalThis as unknown as { __zionArchiveMetrics?: ArchiveMetricsStore };

function store(): ArchiveMetricsStore {
  if (!globalStore.__zionArchiveMetrics) {
    globalStore.__zionArchiveMetrics = {
      granted: 0,
      denied: 0,
      downloads: {},
      since: new Date().toISOString(),
    };
  }
  return globalStore.__zionArchiveMetrics;
}

export function recordAccess(granted: boolean): void {
  const s = store();
  if (granted) s.granted += 1;
  else s.denied += 1;
}

export function recordDownload(id: string): void {
  const s = store();
  s.downloads[id] = (s.downloads[id] ?? 0) + 1;
}

export function getArchiveMetrics(): ArchiveMetricsStore {
  return store();
}
