// Formatting helpers — QTU has 12 decimals, ZION flowers are 1e-6,
// PRL has its own unit. Never render raw integers to the UI.

const UNITS: [number, string][] = [
  [1e18, 'EH/s'],
  [1e15, 'PH/s'],
  [1e12, 'TH/s'],
  [1e9, 'GH/s'],
  [1e6, 'MH/s'],
  [1e3, 'KH/s'],
];

export function fmtHashrate(hps: number): string {
  if (!Number.isFinite(hps) || hps <= 0) return '0 H/s';
  for (const [div, unit] of UNITS) {
    if (hps >= div) return `${(hps / div).toFixed(2)} ${unit}`;
  }
  return `${hps.toFixed(1)} H/s`;
}

export function fmtAmount(amount: number, unit: string): string {
  // QTU amounts arrive already in whole units (mock keeps 12-decimal
  // precision in the number). Trim noise, keep meaningful decimals.
  const abs = Math.abs(amount);
  const digits = abs >= 100 ? 2 : abs >= 1 ? 4 : 6;
  return `${amount.toFixed(digits)} ${unit}`;
}

export function fmtInt(n: number): string {
  return n.toLocaleString('en-US');
}

export function fmtUsd(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—';
  if (v >= 1) return `$${v.toFixed(2)}`;
  if (v >= 0.01) return `$${v.toFixed(4)}`;
  // sub-cent prices (ZION trades ~$0.0001) — keep 2 significant digits
  return `$${v.toPrecision(2)}`;
}

export function fmtDifficulty(d: number | null): string {
  if (d == null) return '—';
  const units: [number, string][] = [
    [1e12, 'T'], [1e9, 'G'], [1e6, 'M'], [1e3, 'K'],
  ];
  for (const [div, suffix] of units) {
    if (d >= div) return `${(d / div).toFixed(2)}${suffix}`;
  }
  return `${d}`;
}

export function fmtAgo(ts: number, lang: 'cs' | 'en'): string {
  const s = Math.max(0, Math.floor(Date.now() / 1000) - ts);
  const units: [number, string, string][] = [
    [86_400, 'd', 'd'],
    [3_600, 'h', 'h'],
    [60, 'm', 'min'],
    [1, 's', 's'],
  ];
  for (const [div, cs, en] of units) {
    if (s >= div) {
      const v = Math.floor(s / div);
      const u = lang === 'cs' ? cs : en;
      return lang === 'cs' ? `před ${v} ${u}` : `${v}${u} ago`;
    }
  }
  return lang === 'cs' ? 'právě teď' : 'just now';
}

export function fmtDuration(s: number): string {
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3_600);
  return d > 0 ? `${d}d ${h}h` : `${h}h ${Math.floor((s % 3_600) / 60)}m`;
}

export function shortAddr(a: string): string {
  return a.length > 18 ? `${a.slice(0, 10)}…${a.slice(-6)}` : a;
}

// Payout lifecycle — queued (computed, awaiting broadcast) → sent (tx
// broadcast) → confirmed. Shared badge styling + bilingual labels.
import type { PayoutStatus } from './types';

export const PAYOUT_STATUS_CLASS: Record<PayoutStatus, string> = {
  queued: 'text-gold border-gold/40 bg-gold/10',
  sent: 'text-cyan border-cyan/40 bg-cyan/10',
  confirmed: 'text-green border-green/40 bg-green/10',
};

export function payoutStatusLabel(
  status: PayoutStatus,
  t: (cs: string, en: string) => string,
): string {
  if (status === 'queued') return t('ve frontě', 'queued');
  if (status === 'sent') return t('odesláno', 'sent');
  return t('potvrzeno', 'confirmed');
}
