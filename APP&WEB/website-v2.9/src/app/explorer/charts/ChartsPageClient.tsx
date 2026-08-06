"use client";

import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Activity,
  BarChart3,
  Blocks,
  Clock,
  Download,
  Layers,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { usePolling } from "@/hooks/usePolling";
import { apiClient } from "@/lib/api";
import { exportToCsv } from "@/lib/csv-export";
import { SITE_RELEASE_LABEL } from "@/lib/site";
import LiveBadge from "@/components/explorer/v4/shared/LiveBadge";

const ExplorerChartsChartsPageClientCopy = {
  height: { cs: `Výška`, en: `Height` },
  hashrate: { cs: `Hashrate`, en: `Hashrate` },
  difficulty: { cs: `Obtížnost`, en: `Difficulty` },
  blockTime: { cs: `Čas bloku`, en: `Block Time` },
  totalTx: { cs: `TX celkem`, en: `Total TX` },
  mempool: { cs: `Mempool`, en: `Mempool` },
  analytics: { cs: `Analytika`, en: `Analytics` },
  historicalData: { cs: `Historická data`, en: `Historical Data` },
  chartsAnalytics: { cs: `Grafy a analytika`, en: `Charts & Analytics` },
  historicalTrendsForHashrateDif: { cs: `Historické trendy hashrate, obtížnosti, času bloku a transakcí. Auto-refresh každých 30 sekund.`, en: `Historical trends for hashrate, difficulty, block time, and transactions. Auto-refresh every 30 seconds.` },
  autoRefresh30s: { cs: `Auto-refresh 30s`, en: `Auto-Refresh 30s` },
  live: { cs: `ŽIVĚ`, en: `LIVE` },
  timeRange: { cs: `Časový rozsah`, en: `Time range` },
  trends: { cs: `Trendy`, en: `Trends` },
  networkCharts: { cs: `Síťové grafy`, en: `Network Charts` },
  points: { cs: `bodů`, en: `points` },
  exportCsv: { cs: `Export CSV`, en: `Export CSV` },
  aboutTheCharts: { cs: `O grafech`, en: `About the charts` },
  dataComesFromTheLiveZionNodeRp: { cs: `Data pocházejí z živého ZION node RPC. Hashrate a obtížnost používají LWMA DAA (Difficulty Adjustment Algorithm). Čas bloku je klouzavý průměr. Auto-refresh 30 sekund.`, en: `Data comes from the live ZION node RPC. Hashrate and difficulty use LWMA DAA (Difficulty Adjustment Algorithm). Block time is a rolling average. Auto-refresh every 30 seconds.` },
};

/* ── helpers ─────────────────────────────────────────────────── */

function fmtSI(v: number): string {
  if (v >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}G`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(0);
}

function fmtHashrate(v: number): string {
  if (v >= 1e12) return `${(v / 1e12).toFixed(2)} TH/s`;
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)} GH/s`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)} MH/s`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(2)} kH/s`;
  return `${v.toFixed(1)} H/s`;
}

/* ── SVG Area Chart ──────────────────────────────────────────── */

function AreaChart({
  values,
  labels,
  color,
  height = 220,
  formatY = fmtSI,
}: {
  values: number[];
  labels: string[];
  color: string;
  height?: number;
  formatY?: (v: number) => string;
}) {
  if (!values.length)
    return (
      <div style={{ height }} className="flex items-center justify-center">
        <span className="text-xs text-gray-600">No data</span>
      </div>
    );

  const W = 800;
  const H = height;
  const PAD = { top: 16, right: 16, bottom: 28, left: 56 };
  const cw = W - PAD.left - PAD.right;
  const ch = H - PAD.top - PAD.bottom;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const pts = values.map((v, i) => ({
    x: PAD.left + (i / Math.max(values.length - 1, 1)) * cw,
    y: PAD.top + ch - ((v - min) / range) * ch,
  }));

  const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaD = `${pathD} L ${pts[pts.length - 1].x} ${PAD.top + ch} L ${pts[0].x} ${PAD.top + ch} Z`;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((pct) => min + pct * range);
  const gradId = `ac-${color.replace(/[^a-z0-9]/gi, "")}`;

  // Show ~6 x-axis labels
  const labelStep = Math.max(1, Math.floor(labels.length / 6));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* Y grid + labels */}
      {yTicks.map((v, i) => {
        const y = PAD.top + ch - ((v - min) / range) * ch;
        return (
          <g key={i}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y}
              y2={y}
              stroke="rgba(255,255,255,0.04)"
              strokeDasharray="3"
            />
            <text
              x={PAD.left - 6}
              y={y + 3}
              textAnchor="end"
              fill="rgba(255,255,255,0.3)"
              fontSize="10"
              fontFamily="monospace"
            >
              {formatY(v)}
            </text>
          </g>
        );
      })}
      {/* X labels */}
      {labels.map((label, i) => {
        if (i % labelStep !== 0 && i !== labels.length - 1) return null;
        const x = PAD.left + (i / Math.max(labels.length - 1, 1)) * cw;
        return (
          <text
            key={i}
            x={x}
            y={H - 8}
            textAnchor="middle"
            fill="rgba(255,255,255,0.25)"
            fontSize="9"
            fontFamily="monospace"
          >
            {label}
          </text>
        );
      })}
      <path d={areaD} fill={`url(#${gradId})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" opacity="0.9" />
      {/* Last point dot */}
      <circle
        cx={pts[pts.length - 1].x}
        cy={pts[pts.length - 1].y}
        r="3"
        fill={color}
        className="animate-pulse"
      />
    </svg>
  );
}

/* ── types ───────────────────────────────────────────────────── */

interface ChartData {
  chart: string;
  range: string;
  data_points: number;
  data: { labels: string[]; values: number[] };
}

interface StatsData {
  block_height: number;
  network_hashrate: number;
  network_hashrate_formatted: string;
  difficulty: number;
  avg_block_time: number;
  tx_count: number;
  tx_pool_size: number;
  total_transactions: number;
  circulating_supply: number;
  total_supply: number;
  max_supply: number;
  connected: boolean;
}

type ChartType = "hashrate" | "difficulty" | "blocktime" | "txcount";
type RangeType = "24h" | "7d" | "30d";

/* ── component ───────────────────────────────────────────────── */

export default function ChartsPageClient() {
  const { lang } = useLang();
  const cs = lang === "cs";

  const [stats, setStats] = useState<StatsData | null>(null);
  const [charts, setCharts] = useState<Record<string, ChartData>>({});
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<RangeType>("24h");

  const chartTypes: { key: ChartType; label: string; labelCs: string; icon: typeof Zap; color: string; formatY: (v: number) => string; formatVal: (v: number) => string }[] = [
    { key: "hashrate", label: "Hashrate", labelCs: "Hashrate", icon: Zap, color: "#22d3ee", formatY: fmtHashrate, formatVal: fmtHashrate },
    { key: "difficulty", label: "Difficulty", labelCs: "Obtížnost", icon: TrendingUp, color: "#34d399", formatY: fmtSI, formatVal: fmtSI },
    { key: "blocktime", label: "Block Time", labelCs: "Čas bloku", icon: Clock, color: "#eab308", formatY: (v) => `${v.toFixed(1)}s`, formatVal: (v) => `${v.toFixed(1)}s` },
    { key: "txcount", label: "TX / Block", labelCs: "TX / Blok", icon: Layers, color: "#a855f7", formatY: (v) => v.toFixed(0), formatVal: (v) => v.toFixed(0) },
  ];

  const ranges: { key: RangeType; label: string; labelCs: string }[] = [
    { key: "24h", label: "24H", labelCs: "24H" },
    { key: "7d", label: "7D", labelCs: "7D" },
    { key: "30d", label: "30D", labelCs: "30D" },
  ];

  const fetchAll = useCallback(async () => {
    try {
      const [s, ...chartResults] = await Promise.all([
        apiClient<StatsData>("/blockchain/stats"),
        ...chartTypes.map((ct) =>
          apiClient<ChartData>(`/blockchain/charts?type=${ct.key}&range=${range}`).catch(() => null),
        ),
      ]);
      setStats(s);
      const next: Record<string, ChartData> = {};
      chartTypes.forEach((ct, i) => {
        const result = chartResults[i];
        if (result) next[ct.key] = result;
      });
      setCharts(next);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  usePolling(fetchAll, 30_000);

  const handleExportChart = (chartType: ChartType) => {
    const cd = charts[chartType];
    if (!cd) return;
    const headers = ["timestamp", "value"];
    const rows = cd.data.labels.map((label, i) => [label, cd.data.values[i] ?? ""]);
    exportToCsv(`zion-chart-${chartType}-${range}.csv`, headers, rows);
  };

  const statCards = useMemo(
    () => [
      {
        label: ExplorerChartsChartsPageClientCopy.height[cs ? 'cs' : 'en'],
        value: stats ? `#${stats.block_height.toLocaleString()}` : "—",
        icon: Blocks,
        color: "text-zion-gold",
      },
      {
        label: ExplorerChartsChartsPageClientCopy.hashrate[cs ? 'cs' : 'en'],
        value: stats?.network_hashrate_formatted ?? "—",
        icon: Zap,
        color: "text-zion-cyan",
      },
      {
        label: ExplorerChartsChartsPageClientCopy.difficulty[cs ? 'cs' : 'en'],
        value: stats ? fmtSI(stats.difficulty) : "—",
        icon: TrendingUp,
        color: "text-zion-cyan-400",
      },
      {
        label: ExplorerChartsChartsPageClientCopy.blockTime[cs ? 'cs' : 'en'],
        value: stats ? `${stats.avg_block_time.toFixed(1)}s` : "—",
        icon: Clock,
        color: "text-zion-gold-400",
      },
      {
        label: ExplorerChartsChartsPageClientCopy.totalTx[cs ? 'cs' : 'en'],
        value: stats ? stats.total_transactions.toLocaleString() : "—",
        icon: Layers,
        color: "text-zion-purple",
      },
      {
        label: ExplorerChartsChartsPageClientCopy.mempool[cs ? 'cs' : 'en'],
        value: stats ? String(stats.tx_pool_size) : "—",
        icon: Activity,
        color: "text-zion-purple-400",
      },
    ],
    [stats, cs],
  );

  /* ── render ──────────────────────────────────────────────── */

  return (
    <div className="relative min-h-screen pb-24 overflow-x-hidden">
      {/* ── Background glows ── */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full blur-[200px] bg-zion-purple/8" />
        <div className="absolute -right-40 top-2/3 h-[400px] w-[400px] rounded-full blur-[200px] bg-zion-cyan/6" />
        <div className="absolute left-1/2 top-0 h-48 w-full -translate-x-1/2 bg-linear-to-b from-zion-purple/15 to-transparent" />
      </div>

      <div className="relative z-10 zion-container max-w-7xl space-y-10 pt-6 pb-8">
        {/* ═══════ HERO ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="zion-rainbow-card rounded-3xl md:rounded-4xl bg-black/60 p-6 md:p-10 shadow-[0_30px_120px_rgba(0,0,0,0.45)]"
          style={{ "--rc": "228, 30, 43" } as React.CSSProperties}
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-zion-purple/40 bg-zion-purple/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-purple uppercase">
                <BarChart3 className="h-4 w-4" />
                {SITE_RELEASE_LABEL} · {ExplorerChartsChartsPageClientCopy.analytics[cs ? 'cs' : 'en']}
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-gray-400">
                  {ExplorerChartsChartsPageClientCopy.historicalData[cs ? 'cs' : 'en']}
                </p>
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-gradient leading-tight">
                  {ExplorerChartsChartsPageClientCopy.chartsAnalytics[cs ? 'cs' : 'en']}
                </h1>
              </div>
              <p className="text-lg text-gray-300 max-w-2xl">
                {ExplorerChartsChartsPageClientCopy.historicalTrendsForHashrateDif[cs ? 'cs' : 'en']}
              </p>
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="zion-badge zion-badge-green">
                  <Activity className="h-3 w-3" /> {ExplorerChartsChartsPageClientCopy.autoRefresh30s[cs ? 'cs' : 'en']}
                </span>
                <LiveBadge label={ExplorerChartsChartsPageClientCopy.live[cs ? 'cs' : 'en']} />
              </div>
            </div>

            {/* Range selector */}
            <div className="flex flex-col gap-3">
              <span className="text-xs text-gray-400 uppercase tracking-wider">
                {ExplorerChartsChartsPageClientCopy.timeRange[cs ? 'cs' : 'en']}
              </span>
              <div className="flex items-center gap-2">
                {ranges.map((r) => (
                  <button
                    key={r.key}
                    onClick={() => {
                      setRange(r.key);
                      setLoading(true);
                    }}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                      range === r.key
                        ? "bg-zion-purple/15 text-zion-purple border border-zion-purple/30"
                        : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 hover:text-white/70"
                    }`}
                  >
                    {cs ? r.labelCs : r.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        {/* ═══════ STAT CARDS ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {statCards.map((card, i) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06 + i * 0.02 }}
                className="zion-rainbow-sub p-4 rounded-2xl"
                style={{ "--rc": "228, 30, 43" } as React.CSSProperties}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">
                    {card.label}
                  </span>
                  <card.icon className={`w-4 h-4 ${card.color}`} />
                </div>
                <div className={`text-lg font-bold ${card.color} tabular-nums`}>
                  {card.value}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ═══════ CHARTS GRID ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">
              {ExplorerChartsChartsPageClientCopy.trends[cs ? 'cs' : 'en']}
            </p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <BarChart3 className="h-7 w-7 text-zion-purple" />
              {ExplorerChartsChartsPageClientCopy.networkCharts[cs ? 'cs' : 'en']}
            </h2>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {chartTypes.map((ct, idx) => {
              const cd = charts[ct.key];
              const values = cd?.data.values ?? [];
              const labels = cd?.data.labels ?? [];
              const latest = values.length ? values[values.length - 1] : 0;
              const prev = values.length > 1 ? values[values.length - 2] : latest;
              const change = prev ? ((latest - prev) / prev) * 100 : 0;

              return (
                <motion.div
                  key={ct.key}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + idx * 0.04 }}
                  className="zion-rainbow-card rounded-3xl bg-black/60 p-6"
                  style={{ "--rc": ct.color.replace("#", "").match(/.{2}/g)?.map((h) => parseInt(h, 16)).join(", ") || "228, 30, 43" } as React.CSSProperties}
                >
                  {/* chart header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: `${ct.color}15`, border: `1px solid ${ct.color}30` }}
                      >
                        <ct.icon className="w-5 h-5" style={{ color: ct.color }} />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-white">
                          {cs ? ct.labelCs : ct.label}
                        </h3>
                        <p className="text-[11px] text-gray-500">
                          {range.toUpperCase()} · {values.length} {ExplorerChartsChartsPageClientCopy.points[cs ? 'cs' : 'en']}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div
                          className="text-lg font-bold tabular-nums"
                          style={{ color: ct.color }}
                        >
                          {ct.formatVal(latest)}
                        </div>
                        {values.length > 1 && (
                          <div
                            className={`text-[11px] tabular-nums ${
                              change >= 0 ? "text-zion-cyan-400" : "text-zion-purple-400"
                            }`}
                          >
                            {change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(2)}%
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleExportChart(ct.key)}
                        disabled={!cd}
                        className="p-2 rounded-xl bg-white/5 border border-white/10 text-white/40 hover:text-white/70 hover:bg-white/10 disabled:opacity-30 transition"
                        title={ExplorerChartsChartsPageClientCopy.exportCsv[cs ? 'cs' : 'en']}
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* chart body */}
                  <div className="h-[220px]">
                    {loading && !cd ? (
                      <div className="h-full flex items-center justify-center">
                        <div className="w-full h-full bg-white/5 rounded-xl animate-pulse" />
                      </div>
                    ) : (
                      <AreaChart
                        values={values}
                        labels={labels}
                        color={ct.color}
                        height={220}
                        formatY={ct.formatY}
                      />
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        {/* ═══════ INFO NOTE ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
        >
          <div className="zion-rainbow-card rounded-2xl bg-black/60 p-6" style={{ "--rc": "228, 30, 43" } as React.CSSProperties}>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-zion-purple/10 border border-zion-purple/20 flex items-center justify-center flex-shrink-0">
                <BarChart3 className="w-5 h-5 text-zion-purple" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white mb-1">
                  {ExplorerChartsChartsPageClientCopy.aboutTheCharts[cs ? 'cs' : 'en']}
                </h3>
                <p className="text-sm text-gray-400">
                  {ExplorerChartsChartsPageClientCopy.dataComesFromTheLiveZionNodeRp[cs ? 'cs' : 'en']}
                </p>
              </div>
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
