/**
 * ZION Explorer V4 — Formatting utilities
 *
 * Shared formatters for hashes, amounts, timestamps, and numbers.
 * Used by all V4 components for consistent display.
 */

// ── Hash formatting ─────────────────────────────────────────────────────────

export function truncateHash(hash: string, head = 12, tail = 8): string {
  if (!hash) return '—';
  if (hash.length <= head + tail + 1) return hash;
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}

export function shortHash(hash: string, len = 16): string {
  if (!hash) return '—';
  if (hash.length <= len) return hash;
  return `${hash.slice(0, len)}…`;
}

// ── Amount formatting ───────────────────────────────────────────────────────

export function formatZion(amount: number, decimals = 6): string {
  if (amount === 0) return '0';
  if (amount < 0.000001) return amount.toExponential(2);
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

export function formatFlowers(amount: number): string {
  return amount.toLocaleString('en-US');
}

// ── Number formatting ───────────────────────────────────────────────────────

export function formatNumber(n: number): string {
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return n.toLocaleString();
}

export function formatHashrate(hps: number): string {
  if (hps >= 1e12) return `${(hps / 1e12).toFixed(2)} TH/s`;
  if (hps >= 1e9) return `${(hps / 1e9).toFixed(2)} GH/s`;
  if (hps >= 1e6) return `${(hps / 1e6).toFixed(2)} MH/s`;
  if (hps >= 1e3) return `${(hps / 1e3).toFixed(2)} kH/s`;
  return `${hps.toFixed(1)} H/s`;
}

export function formatDifficulty(diff: number): string {
  return formatNumber(diff);
}

// ── Time formatting ─────────────────────────────────────────────────────────

export function formatTimestamp(ts: number, locale = 'en-US'): string {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString(locale);
}

export function formatAge(ts: number, cs = false): string {
  if (!ts) return '';
  const s = Math.floor(Date.now() / 1000 - ts);
  if (s < 0) return cs ? 'budoucnost' : 'future';
  if (s < 60) return cs ? `před ${s} s` : `${s}s ago`;
  if (s < 3600) return cs ? `před ${Math.floor(s / 60)} min` : `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return cs ? `před ${Math.floor(s / 3600)} h` : `${Math.floor(s / 3600)}h ago`;
  return cs ? `před ${Math.floor(s / 86400)} d` : `${Math.floor(s / 86400)}d ago`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

// ── Percentage ──────────────────────────────────────────────────────────────

export function formatPercentage(value: number, decimals = 2): string {
  return `${value.toFixed(decimals)}%`;
}
