"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Blocks,
  Clock,
  Globe,
  Hash,
  Layers,
  Network,
  Pickaxe,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { usePolling } from "@/hooks/usePolling";
import { apiClient } from "@/lib/api";
import { SITE_RELEASE_LABEL } from "@/lib/site";

interface ChainStats {
  block_height: number;
  difficulty: number;
  network_hashrate: number;
  network_hashrate_formatted: string;
  target_block_time: number;
  avg_block_time: number;
  tx_count: number;
  tx_pool_size: number;
  total_connections: number;
  incoming_connections: number;
  outgoing_connections: number;
  block_size_limit: number;
  block_size_median: number;
  alt_blocks_count: number;
  pool_hashrate: number;
  pool_hashrate_formatted: string;
  active_miners: number;
  connected: boolean;
  version: string;
}

interface ChartData {
  chart: string;
  range: string;
  data_points: number;
  data: { labels: string[]; values: number[] };
}

function fmtHashrate(v: number): string {
  if (v >= 1e12) return `${(v / 1e12).toFixed(2)} TH/s`;
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)} GH/s`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)} MH/s`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(2)} kH/s`;
  return `${v.toFixed(0)} H/s`;
}

function fmtSI(v: number): string {
  if (v >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}G`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(0);
}

/* ─── Mini Sparkline ────────────────────────────────────────── */
function Sparkline({ data, color, height = 48 }: { data: number[]; color: string; height?: number }) {
  if (!data.length) return <div style={{ height }} className="flex items-center justify-center"><span className="text-[10px] text-gray-600">…</span></div>;
  const w = 200;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${height - ((v - min) / range) * (height - 4) - 2}`).join(' ');
  const gradId = `sg-${color.replace(/[^a-z0-9]/gi, '')}`;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <polygon points={`0,${height} ${pts} ${w},${height}`} fill={`url(#${gradId})`} />
    </svg>
  );
}

/* ─── SVG Area Chart (larger) ───────────────────────────────── */
function AreaChart({ values, color, height = 160 }: { values: number[]; color: string; height?: number }) {
  if (!values.length) return null;
  const W = 400;
  const H = height;
  const PAD = { top: 8, right: 8, bottom: 20, left: 44 };
  const cw = W - PAD.left - PAD.right;
  const ch = H - PAD.top - PAD.bottom;
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
  const gradId = `ac-${color.replace(/[^a-z0-9]/gi, '')}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      {/* Y grid */}
      {yTicks.map((v, i) => {
        const y = PAD.top + ch - ((v - min) / range) * ch;
        return (
          <g key={i}>
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

export default function NetworkStatsClient() {
  const { lang } = useLang();
  const cs = lang === "cs";

  const [stats, setStats] = useState<ChainStats | null>(null);
  const [charts, setCharts] = useState<Record<string, ChartData>>({});
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [s, hr, diff, bt, tx] = await Promise.all([
        apiClient<ChainStats>("/blockchain/stats"),
        apiClient<ChartData>("/blockchain/charts?type=hashrate&range=24h"),
        apiClient<ChartData>("/blockchain/charts?type=difficulty&range=24h"),
        apiClient<ChartData>("/blockchain/charts?type=blocktime&range=24h"),
        apiClient<ChartData>("/blockchain/charts?type=txcount&range=24h"),
      ]);
      setStats(s);
      const next: Record<string, ChartData> = {};
      if (hr) next.hashrate = hr;
      if (diff) next.difficulty = diff;
      if (bt) next.blocktime = bt;
      if (tx) next.txcount = tx;
      setCharts(next);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  usePolling(fetchAll, 30_000);

  const hrData = charts.hashrate?.data.values ?? [];
  const diffData = charts.difficulty?.data.values ?? [];
  const btData = charts.blocktime?.data.values ?? [];
  const txData = charts.txcount?.data.values ?? [];

  const statCards = [
    { label: cs ? "Hashrate" : "Hashrate", value: stats?.network_hashrate_formatted ?? "—", sub: fmtHashrate(stats?.network_hashrate ?? 0), icon: Zap, color: "text-cyan-400", spark: hrData, sparkColor: "rgb(34,211,238)" },
    { label: cs ? "Obtížnost" : "Difficulty", value: fmtSI(stats?.difficulty ?? 0), sub: cs ? "LWMA DAA" : "LWMA DAA", icon: TrendingUp, color: "text-emerald-400", spark: diffData, sparkColor: "rgb(52,211,153)" },
    { label: cs ? "Čas bloku" : "Block Time", value: stats?.avg_block_time ? `${stats.avg_block_time.toFixed(1)}s` : "—", sub: `${stats?.target_block_time ?? 60}s ${cs ? "cíl" : "target"}`, icon: Clock, color: "text-zion-gold", spark: btData, sparkColor: "rgb(234,179,8)" },
    { label: cs ? "Výška" : "Height", value: (stats?.block_height ?? 0).toLocaleString(), sub: cs ? "aktuální blok" : "current block", icon: Blocks, color: "text-purple-400", spark: [], sparkColor: "rgb(168,85,247)" },
    { label: cs ? "TX celkem" : "Total TX", value: (stats?.tx_count ?? 0).toLocaleString(), sub: `${stats?.tx_pool_size ?? 0} ${cs ? "v mempoolu" : "in mempool"}`, icon: Layers, color: "text-zion-cyan", spark: txData, sparkColor: "rgb(6,182,212)" },
    { label: cs ? "Peeri" : "Peers", value: (stats?.total_connections ?? 0).toLocaleString(), sub: `${stats?.incoming_connections ?? 0} ${cs ? "in" : "in"} / ${stats?.outgoing_connections ?? 0} ${cs ? "out" : "out"}`, icon: Network, color: "text-rose-400", spark: [], sparkColor: "rgb(251,113,133)" },
    { label: cs ? "Pool hashrate" : "Pool Hashrate", value: stats?.pool_hashrate_formatted ?? "—", sub: `${stats?.active_miners ?? 0} ${cs ? "minerů" : "miners"}`, icon: Pickaxe, color: "text-amber-400", spark: [], sparkColor: "rgb(251,191,36)" },
    { label: cs ? "Alt bloky" : "Alt Blocks", value: (stats?.alt_blocks_count ?? 0).toLocaleString(), sub: cs ? "potenciální forky" : "potential forks", icon: BarChart3, color: "text-slate-400", spark: [], sparkColor: "rgb(148,163,184)" },
  ];

  const chartCards = [
    { key: "hashrate", title: cs ? "Hashrate (24h)" : "Hashrate (24h)", icon: Zap, color: "#22d3ee", data: hrData },
    { key: "difficulty", title: cs ? "Obtížnost (24h)" : "Difficulty (24h)", icon: TrendingUp, color: "#34d399", data: diffData },
    { key: "blocktime", title: cs ? "Čas bloku (24h)" : "Block Time (24h)", icon: Clock, color: "#eab308", data: btData },
    { key: "txcount", title: cs ? "TX / blok (24h)" : "TX / Block (24h)", icon: Layers, color: "#06b6d4", data: txData },
  ];

  return (
    <div className="zion-shell min-h-screen pt-28 md:pt-32 pb-24 overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full blur-[200px] bg-purple-500/8" />
        <div className="absolute -right-40 top-2/3 h-[400px] w-[400px] rounded-full blur-[200px] bg-cyan-500/6" />
        <div className="absolute left-1/2 top-0 h-48 w-full -translate-x-1/2 bg-linear-to-b from-purple-500/15 to-transparent" />
      </div>

      <div className="relative z-10 zion-container max-w-7xl space-y-14">
        {/* Back link */}
        <Link href="/explorer" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" />
          {cs ? "Zpět do průzkumníka" : "Back to Explorer"}
        </Link>

        {/* ═══════ HERO ═══════ */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="zion-panel rounded-3xl md:rounded-4xl bg-black/60 p-6 md:p-10 shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/40 bg-purple-500/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-purple-300 uppercase">
                <Network className="h-4 w-4" />
                {SITE_RELEASE_LABEL} · {cs ? "Síť" : "Network"}
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-gray-400">{cs ? "Live metriky" : "Live Metrics"}</p>
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-gradient leading-tight">
                  {cs ? "Network Stats" : "Network Stats"}
                </h1>
              </div>
              <p className="text-lg text-gray-300 max-w-2xl">
                {cs
                  ? "Hashrate, obtížnost, čas bloku a transakce v reálném čase. Historické trendy z posledních 24 hodin."
                  : "Hashrate, difficulty, block time and transactions in real time. Historical trends from the last 24 hours."}
              </p>
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <Globe className="h-3 w-3 text-emerald-400" /> {stats?.connected ? (cs ? "Online" : "Online") : (cs ? "Offline" : "Offline")}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <Hash className="h-3 w-3 text-zion-gold" /> {stats?.version || "v2.9.9"}
                </span>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ═══════ STATS GRID ═══════ */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? "Aktuálně" : "Current"}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Activity className="h-7 w-7 text-emerald-400" />
              {cs ? "Síťové statistiky" : "Network Statistics"}
            </h2>
          </div>

          {loading && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="rounded-3xl border border-white/8 bg-black/60 p-6 h-36" />
              ))}
            </div>
          )}

          {!loading && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {statCards.map((card) => (
                <div key={card.label} className="rounded-3xl border border-white/8 bg-black/60 backdrop-blur-xl p-5 hover:border-white/12 transition-colors flex flex-col">
                  <div className="flex items-center gap-2 mb-2">
                    <card.icon className={`h-4 w-4 ${card.color}`} />
                    <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500">{card.label}</span>
                  </div>
                  <p className={`text-xl font-bold tabular-nums ${card.color}`}>{card.value}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{card.sub}</p>
                  {card.spark.length > 1 && (
                    <div className="mt-auto pt-3">
                      <Sparkline data={card.spark} color={card.sparkColor} height={40} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </motion.section>

        {/* ═══════ CHARTS ═══════ */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? "Trendy" : "Trends"}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <BarChart3 className="h-7 w-7 text-purple-400" />
              {cs ? "24h grafy" : "24h Charts"}
            </h2>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {chartCards.map((c) => {
              const avg = c.data.length ? (c.data.reduce((a, b) => a + b, 0) / c.data.length) : 0;
              const min = c.data.length ? Math.min(...c.data) : 0;
              const max = c.data.length ? Math.max(...c.data) : 0;
              const trend = c.data.length >= 2 ? c.data[c.data.length - 1] - c.data[0] : 0;
              return (
                <div key={c.key} className="rounded-4xl border border-white/8 bg-black/60 backdrop-blur-xl p-5 md:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <c.icon className="h-4 w-4" style={{ color: c.color }} />
                      <span className="text-sm font-medium text-white">{c.title}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px]">
                      {trend >= 0 ? (
                        <TrendingUp className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-red-400" />
                      )}
                      <span className={trend >= 0 ? "text-emerald-400" : "text-red-400"}>
                        {trend >= 0 ? "+" : ""}{fmtSI(trend)}
                      </span>
                    </div>
                  </div>
                  <div className="h-40">
                    {c.data.length > 0 ? (
                      <AreaChart values={c.data} color={c.color} height={160} />
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-gray-600">{cs ? "Žádná data" : "No data"}</div>
                    )}
                  </div>
                  <div className="grid grid-cols-3 border-t border-white/6 mt-4 pt-3">
                    {[
                      { label: cs ? "Min" : "Min", value: min },
                      { label: cs ? "Průměr" : "Avg", value: avg },
                      { label: cs ? "Max" : "Max", value: max },
                    ].map((s, i) => (
                      <div key={s.label} className={`text-center ${i < 2 ? "border-r border-white/6" : ""}`}>
                        <p className="text-[10px] uppercase tracking-wider text-gray-500">{s.label}</p>
                        <p className="text-xs font-semibold text-white tabular-nums mt-0.5">{fmtSI(s.value)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.section>

        {/* ═══════ CTA ═══════ */}
        <motion.section initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.14 }} className="rounded-4xl border border-zion-cyan/30 bg-linear-to-r from-zion-cyan/20 via-zion-purple/10 to-zion-cyan/20 p-10 text-center">
          <Network className="mx-auto h-12 w-12 text-zion-cyan" />
          <h2 className="mt-6 text-3xl font-semibold text-white">ZION Network</h2>
          <p className="mt-4 text-gray-100 max-w-3xl mx-auto">
            {cs
              ? "Nativní Rust P2P síť s LWMA DAA. Hashrate a obtížnost se přizpůsobují v reálném čase pro stabilní 60s blok."
              : "Native Rust P2P network with LWMA DAA. Hashrate and difficulty adjust in real time for a stable 60s block."}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link href="/network" className="inline-flex items-center gap-2 rounded-2xl bg-black/70 px-6 py-3 text-sm font-semibold text-white border border-white/20">
              <Globe className="h-4 w-4" /> {cs ? "Stav sítě" : "Network Status"}
            </Link>
            <Link href="/explorer/supply" className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-6 py-3 text-sm font-semibold text-white border border-white/10">
              <BarChart3 className="h-4 w-4" /> Supply
            </Link>
          </div>
        </motion.section>

        <p className="text-center text-xs text-gray-600">
          {cs
            ? `ZION TerraNova ${SITE_RELEASE_LABEL} — Network Stats · Data v reálném čase · Aktualizace každých 30 s`
            : `ZION TerraNova ${SITE_RELEASE_LABEL} — Network Stats · Real-time data · Updates every 30s`}
        </p>
      </div>
    </div>
  );
}
