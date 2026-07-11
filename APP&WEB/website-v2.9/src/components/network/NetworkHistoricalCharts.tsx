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

export default function NetworkHistoricalCharts() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  // 24h polling data (real — polls /api/blockchain/stats every 15s)
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

  /* ── Real 24h series (only range available — no synthetic history) ── */
  const series = useMemo(() => ({
    hashrate: hashrate24h,
    difficulty: difficulty24h,
    blockTime: blockTime24h,
    peerCount: peerCount24h,
    mempool: mempool24h,
  }), [hashrate24h, difficulty24h, blockTime24h, peerCount24h, mempool24h]);

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
    <section className="zion-rainbow-card p-8" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
      <div className="flex flex-col gap-2 mb-6">
        <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Trendy' : 'Trends'}</p>
        <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
          <Activity className="h-7 w-7 text-zion-cyan" />
          {cs ? 'Historické trendy' : 'Historical Trends'}
        </h2>
        <p className="text-sm text-gray-400">
          {cs
            ? 'Hashrate, obtížnost, čas bloku, počet peerů a mempool — živá data za posledních 24 hodin s exportem do CSV.'
            : 'Hashrate, difficulty, block time, peer count, and mempool — live data for the last 24 hours with CSV export.'}
        </p>
      </div>

      {/* Live data badge — only 24h real data is available */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <span className="text-xs text-gray-500 mr-2">{cs ? 'Rozsah:' : 'Range:'}</span>
        <span className="zion-badge-gold">24h</span>
        <span className="text-[10px] text-emerald-400 ml-2">● {cs ? 'Živá data' : 'Live data'}</span>
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
            style={{ '--rc': '6, 182, 212' } as React.CSSProperties}
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
              {chart.series.length < 2 ? (
                <div className="flex flex-col items-center justify-center gap-2 h-full text-center">
                  <p className="text-sm text-gray-400">
                    {cs ? 'Nedostatek dat pro zobrazení grafu' : 'Insufficient data to render chart'}
                  </p>
                  <p className="text-xs text-gray-600">
                    {cs ? 'Graf se naplní jak budou přibývat živá data (každých 15 s).'
                      : 'Chart will populate as live data accumulates (every 15s).'}
                  </p>
                </div>
              ) : (
                <>
                  {chart.type === 'area' && <AreaChart series={chart.series} color={chart.color} />}
                  {chart.type === 'line' && <LineChart series={chart.series} color={chart.color} />}
                  {chart.type === 'bar' && <BarChart series={chart.series} color={chart.color} />}
                </>
              )}
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
