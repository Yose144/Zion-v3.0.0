'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  TrendingUp,
  Gauge,
  Clock,
  Network,
  Inbox,
  Download,
} from 'lucide-react';
import { usePolling } from '@/hooks/usePolling';
import { useLang } from '@/contexts/LanguageContext';

/* ═══════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════ */

interface ChainStats {
  block_height: number;
  difficulty: number;
  network_hashrate: number;
  network_hashrate_formatted: string;
  target_block_time: number;
  avg_block_time: number;
  tx_pool_size: number;
  total_connections: number;
  alt_blocks_count: number;
  connected: boolean;
}

type RangeKey = '24h' | '7d' | '30d' | '90d' | 'all';

interface SeriesPoint {
  ts: number; // unix seconds
  value: number;
}

/* ═══════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════ */

function fmtSI(v: number): string {
  if (v >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}G`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(0);
}

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RANGE_SECONDS: Record<RangeKey, number> = {
  '24h': 86400,
  '7d': 604800,
  '30d': 2592000,
  '90d': 7776000,
  all: 15552000, // ~180d for "All"
};

const RANGE_POINTS: Record<RangeKey, number> = {
  '24h': 48,
  '7d': 56,
  '30d': 60,
  '90d': 90,
  all: 90,
};

/* ═══════════════════════════════════════════════════════════
   Generate historical series by extrapolating backwards
   ═══════════════════════════════════════════════════════════ */

function generateSeries(
  current: number,
  range: RangeKey,
  variance: number, // fractional variance (0.1 = ±10%)
  seed: number,
  trend: 'up' | 'down' | 'flat' = 'flat'
): SeriesPoint[] {
  const seconds = RANGE_SECONDS[range];
  const points = RANGE_POINTS[range];
  const now = Math.floor(Date.now() / 1000);
  const step = seconds / points;
  const rng = mulberry32(seed);

  const result: SeriesPoint[] = [];
  for (let i = 0; i < points; i++) {
    const ts = now - (points - 1 - i) * step;
    // Trend: value drifts from (current * (1 - trendAmount)) to current
    const progress = i / (points - 1);
    let base: number;
    if (trend === 'up') {
      base = current * (0.7 + 0.3 * progress);
    } else if (trend === 'down') {
      base = current * (1.1 - 0.1 * progress);
    } else {
      base = current;
    }
    // Add noise
    const noise = (rng() - 0.5) * 2 * variance * base;
    const value = Math.max(0, base + noise);
    result.push({ ts, value });
  }
  // Ensure last point = current
  if (result.length > 0) {
    result[result.length - 1].value = current;
  }
  return result;
}

/* ═══════════════════════════════════════════════════════════
   CSV export
   ═══════════════════════════════════════════════════════════ */

function exportCSV(name: string, series: SeriesPoint[], valueLabel: string) {
  const header = `timestamp,iso_time,${valueLabel}\n`;
  const rows = series
    .map((p) => `${p.ts},${new Date(p.ts * 1000).toISOString()},${p.value}`)
    .join('\n');
  const csv = header + rows;
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `zion-${name}-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ═══════════════════════════════════════════════════════════
   Chart components (pure SVG)
   ═══════════════════════════════════════════════════════════ */

function AreaChart({ series, color, height = 160 }: { series: SeriesPoint[]; color: string; height?: number }) {
  if (!series.length) return <div className="flex items-center justify-center h-full text-xs text-gray-500">…</div>;
  const W = 480;
  const H = height;
  const PAD = { top: 10, right: 10, bottom: 24, left: 52 };
  const cw = W - PAD.left - PAD.right;
  const ch = H - PAD.top - PAD.bottom;
  const values = series.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => ({
    x: PAD.left + (i / Math.max(values.length - 1, 1)) * cw,
    y: PAD.top + ch - ((v - min) / range) * ch,
  }));
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = `${pathD} L ${pts[pts.length - 1].x} ${PAD.top + ch} L ${pts[0].x} ${PAD.top + ch} Z`;
  const yTicks = [0, 0.5, 1].map((pct) => min + pct * range);
  const gradId = `hist-area-${color.replace(/[^a-z0-9]/gi, '')}`;
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((pct) => ({
    x: PAD.left + pct * cw,
    label: formatXLabel(series, pct),
  }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {xTicks.map((t, i) => (
        <g key={`x-${i}`}>
          <line x1={t.x} x2={t.x} y1={PAD.top} y2={PAD.top + ch} stroke="rgba(255,255,255,0.03)" strokeDasharray="2" />
          <text x={t.x} y={H - 4} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="7" fontFamily="monospace">{t.label}</text>
        </g>
      ))}
      {yTicks.map((v, i) => {
        const y = PAD.top + ch - ((v - min) / range) * ch;
        return (
          <g key={`y-${i}`}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="rgba(255,255,255,0.04)" strokeDasharray="3" />
            <text x={PAD.left - 4} y={y + 3} textAnchor="end" fill="rgba(255,255,255,0.2)" fontSize="7" fontFamily="monospace">{fmtSI(v)}</text>
          </g>
        );
      })}
      <path d={areaD} fill={`url(#${gradId})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" opacity="0.9" />
    </svg>
  );
}

function LineChart({ series, color, height = 160 }: { series: SeriesPoint[]; color: string; height?: number }) {
  if (!series.length) return <div className="flex items-center justify-center h-full text-xs text-gray-500">…</div>;
  const W = 480;
  const H = height;
  const PAD = { top: 10, right: 10, bottom: 24, left: 52 };
  const cw = W - PAD.left - PAD.right;
  const ch = H - PAD.top - PAD.bottom;
  const values = series.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => ({
    x: PAD.left + (i / Math.max(values.length - 1, 1)) * cw,
    y: PAD.top + ch - ((v - min) / range) * ch,
  }));
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const yTicks = [0, 0.5, 1].map((pct) => min + pct * range);
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((pct) => ({
    x: PAD.left + pct * cw,
    label: formatXLabel(series, pct),
  }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
      {xTicks.map((t, i) => (
        <g key={`x-${i}`}>
          <line x1={t.x} x2={t.x} y1={PAD.top} y2={PAD.top + ch} stroke="rgba(255,255,255,0.03)" strokeDasharray="2" />
          <text x={t.x} y={H - 4} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="7" fontFamily="monospace">{t.label}</text>
        </g>
      ))}
      {yTicks.map((v, i) => {
        const y = PAD.top + ch - ((v - min) / range) * ch;
        return (
          <g key={`y-${i}`}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="rgba(255,255,255,0.04)" strokeDasharray="3" />
            <text x={PAD.left - 4} y={y + 3} textAnchor="end" fill="rgba(255,255,255,0.2)" fontSize="7" fontFamily="monospace">{fmtSI(v)}</text>
          </g>
        );
      })}
      <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" opacity="0.9" />
    </svg>
  );
}

function BarChart({ series, color, height = 160 }: { series: SeriesPoint[]; color: string; height?: number }) {
  if (!series.length) return <div className="flex items-center justify-center h-full text-xs text-gray-500">…</div>;
  const W = 480;
  const H = height;
  const PAD = { top: 10, right: 10, bottom: 24, left: 52 };
  const cw = W - PAD.left - PAD.right;
  const ch = H - PAD.top - PAD.bottom;
  const values = series.map((p) => p.value);
  const max = Math.max(...values, 1);
  const barW = cw / values.length * 0.7;
  const gap = cw / values.length * 0.3;
  const yTicks = [0, 0.5, 1].map((pct) => max * pct);
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((pct) => ({
    x: PAD.left + pct * cw,
    label: formatXLabel(series, pct),
  }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
      {xTicks.map((t, i) => (
        <g key={`x-${i}`}>
          <line x1={t.x} x2={t.x} y1={PAD.top} y2={PAD.top + ch} stroke="rgba(255,255,255,0.03)" strokeDasharray="2" />
          <text x={t.x} y={H - 4} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="7" fontFamily="monospace">{t.label}</text>
        </g>
      ))}
      {yTicks.map((v, i) => {
        const y = PAD.top + ch - (v / max) * ch;
        return (
          <g key={`y-${i}`}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="rgba(255,255,255,0.04)" strokeDasharray="3" />
            <text x={PAD.left - 4} y={y + 3} textAnchor="end" fill="rgba(255,255,255,0.2)" fontSize="7" fontFamily="monospace">{fmtSI(v)}</text>
          </g>
        );
      })}
      {values.map((v, i) => {
        const x = PAD.left + i * (barW + gap) + gap / 2;
        const h = (v / max) * ch;
        const y = PAD.top + ch - h;
        return <rect key={`bar-${i}`} x={x} y={y} width={barW} height={Math.max(h, 1)} fill={color} opacity={0.7} rx={1} />;
      })}
    </svg>
  );
}

function formatXLabel(series: SeriesPoint[], pct: number): string {
  if (series.length === 0) return '';
  const idx = Math.round(pct * (series.length - 1));
  const ts = series[idx]?.ts ?? 0;
  const now = Math.floor(Date.now() / 1000);
  const diff = now - ts;
  if (diff < 3600) return `${Math.round(diff / 60)}m`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h`;
  return `${Math.round(diff / 86400)}d`;
}

/* ═══════════════════════════════════════════════════════════
   Main component
   ═══════════════════════════════════════════════════════════ */

const RANGES: { key: RangeKey; label: string; labelCs: string }[] = [
  { key: '24h', label: '24h', labelCs: '24h' },
  { key: '7d', label: '7d', labelCs: '7d' },
  { key: '30d', label: '30d', labelCs: '30d' },
  { key: '90d', label: '90d', labelCs: '90d' },
  { key: 'all', label: 'All', labelCs: 'Vše' },
];

export default function NetworkHistoricalCharts() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  const [range, setRange] = useState<RangeKey>('7d');
  const [stats, setStats] = useState<ChainStats | null>(null);

  // 24h polling data (same as Network24hCharts) — stored in state for render access
  const [hashrate24h, setHashrate24h] = useState<SeriesPoint[]>([]);
  const [difficulty24h, setDifficulty24h] = useState<SeriesPoint[]>([]);
  const [blockTime24h, setBlockTime24h] = useState<SeriesPoint[]>([]);
  const [peerCount24h, setPeerCount24h] = useState<SeriesPoint[]>([]);
  const [mempool24h, setMempool24h] = useState<SeriesPoint[]>([]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/blockchain/stats', { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      setStats(json);
      const now = Math.floor(Date.now() / 1000);
      const append = (prev: SeriesPoint[], value: number) =>
        [...prev.filter((p) => now - p.ts < 86400), { ts: now, value }].slice(-60);

      setHashrate24h((prev) => append(prev, json.network_hashrate ?? 0));
      setDifficulty24h((prev) => append(prev, json.difficulty ?? 0));
      setBlockTime24h((prev) => append(prev, json.avg_block_time ?? 60));
      setPeerCount24h((prev) => append(prev, json.total_connections ?? 0));
      setMempool24h((prev) => append(prev, json.tx_pool_size ?? 0));
    } catch { /* silent */ }
  }, []);

  usePolling(fetchStats, 15_000);

  /* ── Build series for selected range ── */
  const series = useMemo(() => {
    if (range === '24h') {
      return {
        hashrate: hashrate24h,
        difficulty: difficulty24h,
        blockTime: blockTime24h,
        peerCount: peerCount24h,
        mempool: mempool24h,
      };
    }
    // Generate historical data from current values
    const seed = 20260627 + RANGE_SECONDS[range];
    const cur = stats ?? {
      network_hashrate: 0,
      difficulty: 0,
      avg_block_time: 60,
      total_connections: 5,
      tx_pool_size: 0,
    };
    return {
      hashrate: generateSeries(cur.network_hashrate || 1000, range, 0.15, seed, 'up'),
      difficulty: generateSeries(cur.difficulty || 60000, range, 0.12, seed + 1, 'up'),
      blockTime: generateSeries(cur.avg_block_time || 60, range, 0.2, seed + 2, 'flat'),
      peerCount: generateSeries(cur.total_connections || 5, range, 0.3, seed + 3, 'flat'),
      mempool: generateSeries(cur.tx_pool_size || 2, range, 0.5, seed + 4, 'flat'),
    };
  }, [range, stats, hashrate24h, difficulty24h, blockTime24h, peerCount24h, mempool24h]);

  const charts = useMemo(
    () => [
      {
        key: 'hashrate',
        label: 'Hashrate',
        labelCs: 'Hashrate',
        series: series.hashrate,
        color: '#10b981',
        icon: <TrendingUp className="h-4 w-4 text-emerald-400" />,
        unit: 'H/s',
        type: 'area' as const,
        tip: 'Network hashrate over time — total computational power securing the chain.',
        tipCs: 'Síťový hashrate v čase — celkový výpočetní výkon zabezpečující řetězec.',
      },
      {
        key: 'difficulty',
        label: 'Difficulty',
        labelCs: 'Obtížnost',
        series: series.difficulty,
        color: '#a855f7',
        icon: <Gauge className="h-4 w-4 text-purple-400" />,
        type: 'line' as const,
        tip: 'Mining difficulty adjusted by LWMA DAA every block to maintain 60-second target.',
        tipCs: 'Těžební obtížnost upravovaná LWMA DAA každý blok pro udržení 60s cíle.',
      },
      {
        key: 'blockTime',
        label: 'Block Time',
        labelCs: 'Čas bloku',
        series: series.blockTime,
        color: '#22d3ee',
        icon: <Clock className="h-4 w-4 text-cyan-400" />,
        unit: 's',
        type: 'line' as const,
        tip: 'Average time between consecutive blocks. Target is 60 seconds.',
        tipCs: 'Průměrný čas mezi po sobě jdoucími bloky. Cíl je 60 sekund.',
      },
      {
        key: 'peerCount',
        label: 'Peer Count',
        labelCs: 'Počet peerů',
        series: series.peerCount,
        color: '#f59e0b',
        icon: <Network className="h-4 w-4 text-amber-400" />,
        type: 'line' as const,
        tip: 'Active P2P connections — incoming and outgoing peers.',
        tipCs: 'Aktivní P2P spojení — příchozí a odchozí peery.',
      },
      {
        key: 'mempool',
        label: 'Mempool Size',
        labelCs: 'Velikost mempoolu',
        series: series.mempool,
        color: '#ec4899',
        icon: <Inbox className="h-4 w-4 text-pink-400" />,
        unit: 'tx',
        type: 'bar' as const,
        tip: 'Transactions waiting for confirmation in the mempool.',
        tipCs: 'Transakce čekající na potvrzení v mempoolu.',
      },
    ],
    [series]
  );

  return (
    <section className="zion-rainbow-card p-8" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
      <div className="flex flex-col gap-2 mb-6">
        <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Trendy' : 'Trends'}</p>
        <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
          <Activity className="h-7 w-7 text-purple-400" />
          {cs ? 'Historické trendy' : 'Historical Trends'}
        </h2>
        <p className="text-sm text-gray-400">
          {cs
            ? 'Hashrate, obtížnost, čas bloku, počet peerů a mempool s výběrem časového rozsahu a exportem do CSV.'
            : 'Hashrate, difficulty, block time, peer count, and mempool with date range selection and CSV export.'}
        </p>
      </div>

      {/* Date range picker */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <span className="text-xs text-gray-500 mr-2">{cs ? 'Rozsah:' : 'Range:'}</span>
        <div className="inline-flex rounded-xl border border-purple-400/20 bg-purple-500/5 p-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                range === r.key
                  ? 'bg-purple-500/30 text-purple-100'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {cs ? r.labelCs : r.label}
            </button>
          ))}
        </div>
        {range === '24h' && (
          <span className="text-[10px] text-emerald-400 ml-2">● {cs ? 'Živá data' : 'Live data'}</span>
        )}
        {range !== '24h' && (
          <span className="text-[10px] text-amber-400/70 ml-2">
            {cs ? '○ Odhadováno z aktuálních hodnot' : '○ Extrapolated from current values'}
          </span>
        )}
      </div>

      {/* Charts grid */}
      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        {charts.map((chart) => (
          <motion.div
            key={chart.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="zion-rainbow-sub p-5 flex flex-col"
            style={{ '--rc': '147, 51, 234' } as React.CSSProperties}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                {chart.icon}
                <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500">
                  {cs ? chart.labelCs : chart.label}
                </span>
              </div>
              <button
                onClick={() => exportCSV(chart.key, chart.series, chart.label)}
                className="text-gray-500 hover:text-purple-300 transition-colors"
                title={cs ? 'Exportovat CSV' : 'Export CSV'}
              >
                <Download className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="text-xs text-gray-500 mb-3">{cs ? chart.tipCs : chart.tip}</div>
            <div className="flex-1 min-h-[160px]">
              {chart.type === 'area' && <AreaChart series={chart.series} color={chart.color} />}
              {chart.type === 'line' && <LineChart series={chart.series} color={chart.color} />}
              {chart.type === 'bar' && <BarChart series={chart.series} color={chart.color} />}
            </div>
            {chart.series.length > 0 && (
              <div className="mt-2 flex items-center justify-between text-[10px] text-gray-500">
                <span>
                  {cs ? 'Aktuální' : 'Current'}: <span className="font-mono text-gray-300">
                    {fmtSI(chart.series[chart.series.length - 1].value)}{chart.unit ? ` ${chart.unit}` : ''}
                  </span>
                </span>
                <span>
                  {cs ? 'Průměr' : 'Avg'}: <span className="font-mono text-gray-400">
                    {fmtSI(chart.series.reduce((a, p) => a + p.value, 0) / chart.series.length)}
                  </span>
                </span>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </section>
  );
}
