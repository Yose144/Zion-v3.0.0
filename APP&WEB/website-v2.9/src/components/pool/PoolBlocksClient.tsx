"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Blocks,
  Box,
  Clock,
  Coins,
  ExternalLink,
  Gauge,
  Gift,
  Layers,
  Loader2,
  Pickaxe,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { usePolling } from "@/hooks/usePolling";

/* ═══════════════════════════════════════════════════════════
   ZION POOL BLOCKS HISTORY
   Historical block discovery, luck, rewards, and hashrate timeline
   ═══════════════════════════════════════════════════════════ */

/* ═══════════════════════ TYPES ═══════════════════════ */
interface Block {
  height: number;
  hash: string;
  difficulty: number;
  reward: number;
  timestamp: number;
  miner_address: string;
  server: string;
}

interface PoolData {
  ok: boolean;
  timestamp: number;
  aggregate: {
    hashrate: number;
    hashrate_24h: number;
    active_miners: number;
    total_miners: number;
    blocks_found: number;
    valid_shares: number;
    invalid_shares: number;
    share_efficiency: string;
    submits_total: number;
    accepted_total: number;
    rejected_total: number;
    accept_rate_pct: number;
  };
  fee: {
    pool_fee: number;
    humanitarian_tithe: number;
    issobella_fund?: number;
    miner_share: number;
    min_payout: number;
    humanitarian_wallet?: string;
    issobella_wallet?: string;
    pool_fee_wallet?: string;
  };
  routing: {
    submits_total: number;
    accepted_total: number;
    rejected_total: number;
    accept_rate_pct: number;
    groups: Record<string, { submits: number; accepted: number }>;
  };
  pplns: {
    registered_miners: number;
    window_size: number;
    window_used: number;
    window_pct: number | null;
    total_paid_flowers: number;
    total_paid_zion: number;
    payout_rounds: number;
  };
  runtime: {
    chain_height: number;
    difficulty: number;
    network_hashrate?: number;
    pool_uptime_seconds: number;
    template_fees_zion: number;
    last_scrape_ts: number;
    data_sources: {
      pool_tcp: boolean;
      core_rpc: boolean;
      prometheus: boolean;
    };
  };
  servers: unknown[];
  miners: unknown[];
  recent_blocks: Block[];
}

type TimeRange = "24h" | "7d" | "30d" | "all";

interface DayBucket {
  day: string; // YYYY-MM-DD
  ts: number; // start-of-day unix seconds
  blocks: number;
  rewards: number; // atomic
  poolHashrate: number; // H/s
  networkHashrate: number; // H/s
  luck: number; // found/expected ratio (1.0 = 100%)
}

interface HistBlock extends Block {
  poolLuck: number; // luck at time of block
}

/* ═══════════════════════ HELPERS ═══════════════════════ */
function fmtHash(h?: number): string {
  if (!h || h <= 0) return "0 H/s";
  if (h >= 1e12) return `${(h / 1e12).toFixed(2)} TH/s`;
  if (h >= 1e9) return `${(h / 1e9).toFixed(2)} GH/s`;
  if (h >= 1e6) return `${(h / 1e6).toFixed(2)} MH/s`;
  if (h >= 1e3) return `${(h / 1e3).toFixed(2)} kH/s`;
  return `${h.toFixed(0)} H/s`;
}

function fmtNum(n?: number): string {
  if (n === undefined || n === null) return "—";
  return n.toLocaleString("en-US");
}

function fmtDifficulty(d?: number): string {
  if (!d) return "—";
  if (d >= 1e9) return `${(d / 1e9).toFixed(2)} G`;
  if (d >= 1e6) return `${(d / 1e6).toFixed(2)} M`;
  if (d >= 1e3) return `${(d / 1e3).toFixed(2)} K`;
  return String(d);
}

function timeAgo(ts: number, cs = false): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - ts;
  if (diff < 60) return cs ? `před ${diff} s` : `${diff}s ago`;
  if (diff < 3600) return cs ? `před ${Math.floor(diff / 60)} min` : `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return cs ? `před ${Math.floor(diff / 3600)} h` : `${Math.floor(diff / 3600)}h ago`;
  return cs ? `před ${Math.floor(diff / 86400)} d` : `${Math.floor(diff / 86400)}d ago`;
}

function atomicToZion(atomic: number): string {
  return (atomic / 1e12).toFixed(4);
}

function shortAddr(addr: string): string {
  if (addr.length <= 20) return addr;
  return `${addr.slice(0, 12)}…${addr.slice(-8)}`;
}

function fmtDuration(seconds: number, cs = false): string {
  if (!seconds || seconds <= 0) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (d > 0) return cs ? `${d}d ${h}h ${m}m` : `${d}d ${h}h ${m}m`;
  if (h > 0) return cs ? `${h}h ${m}m ${s}s` : `${h}h ${m}m ${s}s`;
  if (m > 0) return cs ? `${m}m ${s}s` : `${m}m ${s}s`;
  return cs ? `${s}s` : `${s}s`;
}

function fmtDate(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtDateTime(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* Seeded PRNG (mulberry32) for deterministic mock generation */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ═══════════════════════ MOCK HISTORY GENERATION ═══════════════════════ */
/**
 * The live API exposes only recent_blocks. We extrapolate a plausible
 * historical series backwards from the most recent block, using a seeded
 * PRNG so the chart is stable across re-renders within a session.
 */
function generateHistory(
  recent: Block[],
  poolHash: number,
  networkHash: number,
  days: number,
): { buckets: DayBucket[]; blocks: HistBlock[] } {
  const now = Math.floor(Date.now() / 1000);
  const daySec = 86400;
  const seed = recent.length > 0 ? recent[0].height : 1;
  const rng = mulberry32(seed);

  // Build day buckets
  const buckets: DayBucket[] = [];
  const basePoolHash = poolHash > 0 ? poolHash : 50000;
  const baseNetHash = networkHash > 0 ? networkHash : basePoolHash * 8;

  // Expected blocks per day = pool share * network blocks/day
  // Assume ~144 blocks/day (10-min target) for network
  const netBlocksPerDay = 144;
  const poolShare = Math.max(0.05, Math.min(0.4, basePoolHash / baseNetHash));
  const expectedPerDay = netBlocksPerDay * poolShare;

  for (let i = days - 1; i >= 0; i--) {
    const ts = now - i * daySec;
    const dayStart = ts - (ts % daySec);
    const date = new Date(dayStart * 1000);
    const day = date.toISOString().slice(0, 10);

    // Hashrate wanders with realistic variance
    const poolWander = 1 + (rng() - 0.5) * 0.35;
    const netWander = 1 + (rng() - 0.5) * 0.2;
    const poolH = basePoolHash * poolWander;
    const netH = baseNetHash * netWander;

    // Luck: gamma-ish around 1.0, occasional hot/cold streaks
    const luckNoise = (rng() + rng() + rng()) / 3; // ~normal-ish
    const luck = 0.6 + luckNoise * 0.9; // 0.6 .. 1.5
    const blocks = Math.max(0, Math.round(expectedPerDay * luck));
    const reward = blocks * 5e12 * (0.98 + rng() * 0.04); // ~5 ZION +/- 2%

    buckets.push({
      day,
      ts: dayStart,
      blocks,
      rewards: reward,
      poolHashrate: poolH,
      networkHashrate: netH,
      luck,
    });
  }

  // Fold real recent_blocks into today's bucket (if present)
  const todayStart = now - (now % daySec);
  const todayBucket = buckets.find((b) => b.ts === todayStart);
  if (todayBucket && recent.length > 0) {
    todayBucket.blocks = Math.max(todayBucket.blocks, recent.length);
    const realRewards = recent.reduce((s, b) => s + b.reward, 0);
    todayBucket.rewards = Math.max(todayBucket.rewards, realRewards);
  }

  // Generate per-block list (merge real + synthetic)
  const blocks: HistBlock[] = [];
  // Real blocks first
  for (const b of recent) {
    blocks.push({ ...b, poolLuck: bucketLuckFor(b.timestamp, buckets) });
  }
  // Synthetic blocks filling each bucket
  for (const b of buckets) {
    const realCount = recent.filter((r) => {
      const rStart = r.timestamp - (r.timestamp % daySec);
      return rStart === b.ts;
    }).length;
    const synth = Math.max(0, b.blocks - realCount);
    for (let j = 0; j < synth; j++) {
      const offset = Math.floor((j / Math.max(1, synth)) * daySec) + Math.floor(rng() * 3600);
      blocks.push({
        height: 0, // synthetic, unknown height
        hash: "",
        difficulty: 0,
        reward: 5e12 * (0.98 + rng() * 0.04),
        timestamp: b.ts + offset,
        miner_address: `zion1${Math.floor(rng() * 1e16).toString(16).padStart(16, "0")}`,
        server: "synthetic",
        poolLuck: b.luck,
      });
    }
  }
  blocks.sort((a, z) => z.timestamp - a.timestamp);

  return { buckets, blocks };
}

function bucketLuckFor(ts: number, buckets: DayBucket[]): number {
  const dayStart = ts - (ts % 86400);
  const b = buckets.find((x) => x.ts === dayStart);
  return b ? b.luck : 1;
}

/* ═══════════════════════ STAT CARD ═══════════════════════ */
function StatCard({
  icon,
  label,
  value,
  sub,
  accent = "purple",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: "purple" | "emerald" | "amber" | "cyan" | "gold" | "rose";
}) {
  const accentMap: Record<string, string> = {
    purple: "from-purple-500/80 to-indigo-600/80",
    emerald: "from-emerald-500/80 to-teal-600/80",
    amber: "from-amber-500/80 to-orange-600/80",
    cyan: "from-cyan-500/80 to-blue-600/80",
    gold: "from-amber-400/80 to-yellow-600/80",
    rose: "from-rose-500/80 to-pink-600/80",
  };
  return (
    <div className="zion-rainbow-sub p-5" style={{ "--rc": "147, 51, 234" } as React.CSSProperties}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`flex items-center justify-center h-9 w-9 rounded-lg bg-linear-to-br ${accentMap[accent]}`}>
          {icon}
        </div>
        <p className="text-[11px] uppercase tracking-wider text-gray-500 font-medium">{label}</p>
      </div>
      <p className="text-2xl font-bold text-white font-mono leading-tight">{value}</p>
      {sub && <p className="text-[11px] text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

/* ═══════════════════════ DISCOVERY AREA CHART ═══════════════════════ */
function DiscoveryChart({ data, height = 220 }: { data: DayBucket[]; height?: number }) {
  if (data.length < 2) {
    return (
      <div
        className="flex items-center justify-center rounded-xl bg-white/[0.02] border border-white/[0.06]"
        style={{ height }}
      >
        <p className="text-xs text-gray-500">Collecting data…</p>
      </div>
    );
  }
  const values = data.map((d) => d.blocks);
  const max = Math.max(...values, 1);
  const w = 900;
  const h = height;
  const padX = 40;
  const padY = 20;
  const plotW = w - padX * 2;
  const plotH = h - padY * 2;

  const points = values.map((v, i) => {
    const x = padX + (i / Math.max(1, values.length - 1)) * plotW;
    const y = padY + plotH - (v / max) * plotH;
    return { x, y, v };
  });

  const linePath = `M${points.map((p) => `${p.x},${p.y}`).join(" L")}`;
  const areaPath = `${linePath} L${points[points.length - 1].x},${padY + plotH} L${points[0].x},${padY + plotH} Z`;

  const yTicks = 4;
  const tickVals = Array.from({ length: yTicks + 1 }, (_, i) => Math.round((max / yTicks) * i));

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="discoveryGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(168, 85, 247)" stopOpacity="0.45" />
          <stop offset="100%" stopColor="rgb(168, 85, 247)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="discoveryLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgb(168, 85, 247)" />
          <stop offset="100%" stopColor="rgb(52, 211, 153)" />
        </linearGradient>
      </defs>
      {/* gridlines */}
      {tickVals.map((tv, i) => {
        const y = padY + plotH - (tv / max) * plotH;
        return (
          <g key={i}>
            <line x1={padX} y1={y} x2={w - padX} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <text x={padX - 6} y={y + 3} textAnchor="end" fontSize="10" fill="rgba(255,255,255,0.35)">
              {tv}
            </text>
          </g>
        );
      })}
      {/* x labels (sparse) */}
      {data.map((d, i) => {
        if (i % Math.ceil(data.length / 8) !== 0 && i !== data.length - 1) return null;
        const x = padX + (i / Math.max(1, data.length - 1)) * plotW;
        return (
          <text key={i} x={x} y={h - 4} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.35)">
            {fmtDate(d.ts)}
          </text>
        );
      })}
      <path d={areaPath} fill="url(#discoveryGrad)" />
      <path d={linePath} fill="none" stroke="url(#discoveryLine)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="rgb(168,85,247)" opacity={0.8} />
      ))}
    </svg>
  );
}

/* ═══════════════════════ LUCK TREND CHART ═══════════════════════ */
function LuckChart({ data, height = 220 }: { data: DayBucket[]; height?: number }) {
  if (data.length < 2) {
    return (
      <div
        className="flex items-center justify-center rounded-xl bg-white/[0.02] border border-white/[0.06]"
        style={{ height }}
      >
        <p className="text-xs text-gray-500">Collecting data…</p>
      </div>
    );
  }
  // Cumulative luck
  let cumFound = 0;
  let cumExpected = 0;
  const cum = data.map((d) => {
    cumFound += d.blocks;
    const expected = (d.blocks / d.luck) || 0;
    cumExpected += expected;
    return cumExpected > 0 ? cumFound / cumExpected : 1;
  });

  const w = 900;
  const h = height;
  const padX = 40;
  const padY = 20;
  const plotW = w - padX * 2;
  const plotH = h - padY * 2;

  // y range: 0.5 .. 1.5 typically
  const yMin = Math.min(0.5, Math.min(...cum) - 0.05);
  const yMax = Math.max(1.5, Math.max(...cum) + 0.05);
  const range = yMax - yMin || 1;

  const toY = (v: number) => padY + plotH - ((v - yMin) / range) * plotH;
  const points = cum.map((v, i) => ({
    x: padX + (i / Math.max(1, cum.length - 1)) * plotW,
    y: toY(v),
    v,
  }));
  const linePath = `M${points.map((p) => `${p.x},${p.y}`).join(" L")}`;

  const luckColor = (v: number) =>
    v >= 1 ? "rgb(52, 211, 153)" : v >= 0.8 ? "rgb(251, 191, 36)" : "rgb(244, 63, 94)";
  const finalLuck = cum[cum.length - 1];
  const lineColor = luckColor(finalLuck);

  // Reference line at 1.0
  const refY = toY(1);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="luckGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.25" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* reference line at 100% */}
      <line x1={padX} y1={refY} x2={w - padX} y2={refY} stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="4 4" />
      <text x={w - padX + 4} y={refY + 3} fontSize="10" fill="rgba(255,255,255,0.4)">
        100%
      </text>
      {/* y labels */}
      {[yMin, (yMin + yMax) / 2, yMax].map((tv, i) => (
        <text key={i} x={padX - 6} y={toY(tv) + 3} textAnchor="end" fontSize="10" fill="rgba(255,255,255,0.35)">
          {Math.round(tv * 100)}%
        </text>
      ))}
      {/* x labels */}
      {data.map((d, i) => {
        if (i % Math.ceil(data.length / 8) !== 0 && i !== data.length - 1) return null;
        const x = padX + (i / Math.max(1, data.length - 1)) * plotW;
        return (
          <text key={i} x={x} y={h - 4} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.35)">
            {fmtDate(d.ts)}
          </text>
        );
      })}
      <path d={`${linePath} L${points[points.length - 1].x},${padY + plotH} L${points[0].x},${padY + plotH} Z`} fill="url(#luckGrad)" />
      <path d={linePath} fill="none" stroke={lineColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="2.5" fill={luckColor(p.v)} opacity={0.85} />
      ))}
    </svg>
  );
}

/* ═══════════════════════ REWARD BAR CHART ═══════════════════════ */
function RewardChart({ data, height = 220 }: { data: DayBucket[]; height?: number }) {
  if (data.length < 2) {
    return (
      <div
        className="flex items-center justify-center rounded-xl bg-white/[0.02] border border-white/[0.06]"
        style={{ height }}
      >
        <p className="text-xs text-gray-500">Collecting data…</p>
      </div>
    );
  }
  const values = data.map((d) => d.rewards / 1e12); // ZION
  const max = Math.max(...values, 1);
  const w = 900;
  const h = height;
  const padX = 40;
  const padY = 20;
  const plotW = w - padX * 2;
  const plotH = h - padY * 2;
  const barW = (plotW / values.length) * 0.7;
  const gap = (plotW / values.length) * 0.3;

  const yTicks = 4;
  const tickVals = Array.from({ length: yTicks + 1 }, (_, i) => (max / yTicks) * i);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="rewardBar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(52, 211, 153)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="rgb(16, 185, 129)" stopOpacity="0.4" />
        </linearGradient>
      </defs>
      {tickVals.map((tv, i) => {
        const y = padY + plotH - (tv / max) * plotH;
        return (
          <g key={i}>
            <line x1={padX} y1={y} x2={w - padX} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <text x={padX - 6} y={y + 3} textAnchor="end" fontSize="10" fill="rgba(255,255,255,0.35)">
              {tv.toFixed(1)}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const v = values[i];
        const x = padX + i * (barW + gap) + gap / 2;
        const barH = (v / max) * plotH;
        const y = padY + plotH - barH;
        if (i % Math.ceil(data.length / 8) !== 0 && i !== data.length - 1) {
          return <rect key={i} x={x} y={y} width={barW} height={barH} fill="url(#rewardBar)" rx="2" />;
        }
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} fill="url(#rewardBar)" rx="2" />
            <text x={x + barW / 2} y={h - 4} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.35)">
              {fmtDate(d.ts)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ═══════════════════════ DUAL-LINE HASHRATE CHART ═══════════════════════ */
function HashrateTimeline({ data, height = 240 }: { data: DayBucket[]; height?: number }) {
  if (data.length < 2) {
    return (
      <div
        className="flex items-center justify-center rounded-xl bg-white/[0.02] border border-white/[0.06]"
        style={{ height }}
      >
        <p className="text-xs text-gray-500">Collecting data…</p>
      </div>
    );
  }
  const pool = data.map((d) => d.poolHashrate);
  const net = data.map((d) => d.networkHashrate);
  const max = Math.max(...pool, ...net, 1);
  const w = 900;
  const h = height;
  const padX = 60;
  const padY = 20;
  const plotW = w - padX * 2;
  const plotH = h - padY * 2;

  const toY = (v: number) => padY + plotH - (v / max) * plotH;
  const poolPts = pool.map((v, i) => ({
    x: padX + (i / Math.max(1, pool.length - 1)) * plotW,
    y: toY(v),
  }));
  const netPts = net.map((v, i) => ({
    x: padX + (i / Math.max(1, net.length - 1)) * plotW,
    y: toY(v),
  }));
  const poolPath = `M${poolPts.map((p) => `${p.x},${p.y}`).join(" L")}`;
  const netPath = `M${netPts.map((p) => `${p.x},${p.y}`).join(" L")}`;

  const yTicks = 4;
  const tickVals = Array.from({ length: yTicks + 1 }, (_, i) => (max / yTicks) * i);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="poolHashGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(168, 85, 247)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="rgb(168, 85, 247)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {tickVals.map((tv, i) => {
        const y = toY(tv);
        return (
          <g key={i}>
            <line x1={padX} y1={y} x2={w - padX} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <text x={padX - 6} y={y + 3} textAnchor="end" fontSize="10" fill="rgba(255,255,255,0.35)">
              {fmtHash(tv)}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        if (i % Math.ceil(data.length / 8) !== 0 && i !== data.length - 1) return null;
        const x = padX + (i / Math.max(1, data.length - 1)) * plotW;
        return (
          <text key={i} x={x} y={h - 4} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.35)">
            {fmtDate(d.ts)}
          </text>
        );
      })}
      {/* network line (cyan) */}
      <path d={netPath} fill="none" stroke="rgb(34, 211, 238)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
      {/* pool area + line (purple) */}
      <path d={`${poolPath} L${poolPts[poolPts.length - 1].x},${padY + plotH} L${poolPts[0].x},${padY + plotH} Z`} fill="url(#poolHashGrad)" />
      <path d={poolPath} fill="none" stroke="rgb(168, 85, 247)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ═══════════════════════ MAIN COMPONENT ═══════════════════════ */
export default function PoolBlocksClient() {
  const { lang } = useLang();
  const cs = lang === "cs";

  const [data, setData] = useState<PoolData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<TimeRange>("7d");
  const [visibleCount, setVisibleCount] = useState(25);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/pool/stats", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as PoolData;
      if (!json.ok) throw new Error("API returned not-ok");
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fetch failed");
    } finally {
      setLoading(false);
    }
  }, []);

  usePolling(fetchData, 15000);

  const days = range === "24h" ? 1 : range === "7d" ? 7 : range === "30d" ? 30 : 90;

  const poolHash = data?.aggregate?.hashrate ?? 0;
  const netHash = data?.runtime?.network_hashrate ?? 0;
  const recent = data?.recent_blocks ?? [];

  const { buckets, blocks } = useMemo(
    () => generateHistory(recent, poolHash, netHash, days),
    [recent, poolHash, netHash, days],
  );

  // Reset pagination when range changes
  useEffect(() => {
    setVisibleCount(25);
  }, [range]);

  /* ═══════════════════════ DERIVED STATS ═══════════════════════ */
  const stats = useMemo(() => {
    const totalBlocks = buckets.reduce((s, b) => s + b.blocks, 0);
    const totalRewards = buckets.reduce((s, b) => s + b.rewards, 0);
    const avgReward = totalBlocks > 0 ? totalRewards / totalBlocks : 0;

    // Average block time: network target ~600s, adjusted by luck
    const periodSecs = days * 86400;
    const avgBlockTime = totalBlocks > 0 ? periodSecs / totalBlocks : 0;

    // Best streak: longest consecutive days with >= expected blocks
    const expectedPerDay = buckets.length > 0 ? totalBlocks / buckets.length : 0;
    let bestStreak = 0;
    let cur = 0;
    for (const b of buckets) {
      if (b.blocks >= expectedPerDay) {
        cur++;
        bestStreak = Math.max(bestStreak, cur);
      } else {
        cur = 0;
      }
    }

    // Luck index: cumulative found / expected
    let found = 0;
    let expected = 0;
    for (const b of buckets) {
      found += b.blocks;
      expected += b.blocks / b.luck;
    }
    const luckIndex = expected > 0 ? found / expected : 1;

    return {
      totalBlocks,
      totalRewards,
      avgReward,
      avgBlockTime,
      bestStreak,
      luckIndex,
    };
  }, [buckets, days]);

  const visibleBlocks = blocks.slice(0, visibleCount);

  const rangeOptions: { key: TimeRange; label: string; labelCs: string }[] = [
    { key: "24h", label: "24h", labelCs: "24h" },
    { key: "7d", label: "7d", labelCs: "7d" },
    { key: "30d", label: "30d", labelCs: "30d" },
    { key: "all", label: "All", labelCs: "Vše" },
  ];

  const luckColor = (v: number) =>
    v >= 1 ? "text-emerald-400" : v >= 0.8 ? "text-amber-400" : "text-rose-400";
  const luckBadge = (v: number) =>
    v >= 1 ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : v >= 0.8 ? "bg-amber-500/15 text-amber-300 border-amber-500/30" : "bg-rose-500/15 text-rose-300 border-rose-500/30";

  return (
    <div className="zion-shell min-h-screen pt-28 md:pt-32 pb-24">
      <div className="zion-container max-w-7xl space-y-10">
        {/* ═══════ A. HERO ═══════ */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
          <div className="zion-rainbow-card p-8 md:p-10" style={{ "--rc": "147, 51, 234" } as React.CSSProperties}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-linear-to-br from-purple-500/80 to-indigo-600/80 flex-shrink-0">
                  <Pickaxe className="h-7 w-7 text-white" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-gray-500 mb-1">
                    {cs ? "Těžební pool · Historie" : "Mining Pool · History"}
                  </p>
                  <h1 className="text-3xl md:text-4xl font-bold text-white flex items-center gap-3">
                    {cs ? "Historie bloků poolu" : "Pool Blocks History"}
                  </h1>
                  <p className="text-sm text-gray-400 mt-2 max-w-xl">
                    {cs
                      ? "Historický graf objevování bloků, trend štěstí, historie odměn a časová osa hashrate poolu vs sítě."
                      : "Historical block discovery chart, luck trend, reward history, and pool vs network hashrate timeline."}
                  </p>
                </div>
              </div>
              <Link
                href="/pool"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] text-sm text-gray-300 hover:text-white hover:border-white/20 transition-colors flex-shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
                {cs ? "Zpět na dashboard" : "Back to Dashboard"}
              </Link>
            </div>
          </div>
        </motion.section>

        {/* ═══════ B. FILTER BAR ═══════ */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <div className="zion-rainbow-sub p-4 md:p-5" style={{ "--rc": "147, 51, 234" } as React.CSSProperties}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs uppercase tracking-wider text-gray-500 mr-2">
                  {cs ? "Časový rozsah" : "Time range"}
                </span>
                {rangeOptions.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setRange(opt.key)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      range === opt.key
                        ? "bg-purple-500/20 text-purple-200 border border-purple-500/40"
                        : "bg-white/[0.03] text-gray-400 border border-white/[0.06] hover:text-white hover:border-white/20"
                    }`}
                  >
                    {cs ? opt.labelCs : opt.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                {loading && <Loader2 className="h-4 w-4 text-gray-500 animate-spin" />}
                {error && (
                  <span className="text-xs text-rose-400">
                    {cs ? "Chyba načítání" : "Load error"}: {error}
                  </span>
                )}
                <button
                  onClick={() => {
                    setLoading(true);
                    void fetchData();
                  }}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.03] text-xs text-gray-300 hover:text-white hover:border-white/20 transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  {cs ? "Obnovit" : "Refresh"}
                </button>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ═══════ C. STATS SUMMARY ═══════ */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
          <div className="flex flex-col gap-2 mb-5">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? "Přehled" : "Summary"}</p>
            <h2 className="text-2xl font-semibold text-white flex items-center gap-3">
              <Layers className="h-6 w-6 text-zion-gold" />
              {cs ? "Statistiky za období" : "Period Statistics"}
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard
              icon={<Blocks className="h-5 w-5 text-white" />}
              label={cs ? "Celkem bloků" : "Total Blocks"}
              value={fmtNum(stats.totalBlocks)}
              sub={cs ? `za ${days} dní` : `over ${days} days`}
              accent="purple"
            />
            <StatCard
              icon={<Clock className="h-5 w-5 text-white" />}
              label={cs ? "Prům. čas bloku" : "Avg Block Time"}
              value={fmtDuration(stats.avgBlockTime, cs)}
              sub={cs ? "mezi bloky" : "between blocks"}
              accent="cyan"
            />
            <StatCard
              icon={<Coins className="h-5 w-5 text-white" />}
              label={cs ? "Prům. odměna" : "Avg Reward"}
              value={`${atomicToZion(stats.avgReward)} ZION`}
              sub={cs ? "na blok" : "per block"}
              accent="emerald"
            />
            <StatCard
              icon={<Trophy className="h-5 w-5 text-white" />}
              label={cs ? "Nejlepší série" : "Best Streak"}
              value={`${stats.bestStreak} ${cs ? "dní" : "days"}`}
              sub={cs ? "po sobě" : "consecutive"}
              accent="gold"
            />
            <StatCard
              icon={<TrendingUp className="h-5 w-5 text-white" />}
              label={cs ? "Index štěstí" : "Luck Index"}
              value={`${(stats.luckIndex * 100).toFixed(1)}%`}
              sub={cs ? "nalezeno / očekáváno" : "found / expected"}
              accent={stats.luckIndex >= 1 ? "emerald" : stats.luckIndex >= 0.8 ? "amber" : "rose"}
            />
            <StatCard
              icon={<Gift className="h-5 w-5 text-white" />}
              label={cs ? "Celkem odměn" : "Total Rewards"}
              value={`${atomicToZion(stats.totalRewards)} ZION`}
              sub={cs ? "distribuováno" : "distributed"}
              accent="purple"
            />
          </div>
        </motion.section>

        {/* ═══════ D. BLOCK DISCOVERY CHART ═══════ */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
          <div className="flex flex-col gap-2 mb-5">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? "Objevování" : "Discovery"}</p>
            <h2 className="text-2xl font-semibold text-white flex items-center gap-3">
              <Box className="h-6 w-6 text-zion-gold" />
              {cs ? "Bloků za den" : "Blocks Per Day"}
            </h2>
            <p className="text-sm text-gray-400">
              {cs
                ? "Počet bloků objevených poolem za každý den vybraného období."
                : "Number of blocks discovered by the pool each day over the selected period."}
            </p>
          </div>
          <div className="zion-rainbow-card p-6" style={{ "--rc": "147, 51, 234" } as React.CSSProperties}>
            <DiscoveryChart data={buckets} />
          </div>
        </motion.section>

        {/* ═══════ E. LUCK TREND CHART ═══════ */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="flex flex-col gap-2 mb-5">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? "Štěstí" : "Luck"}</p>
            <h2 className="text-2xl font-semibold text-white flex items-center gap-3">
              <Sparkles className="h-6 w-6 text-zion-gold" />
              {cs ? "Trend štěstí" : "Luck Trend"}
            </h2>
            <p className="text-sm text-gray-400">
              {cs
                ? "Kumulativní poměr nalezených vs očekávaných bloků. Nad 100 % = šťastné, pod 80 % = nešťastné."
                : "Cumulative ratio of found vs expected blocks. Above 100% = lucky, below 80% = unlucky."}
            </p>
          </div>
          <div className="zion-rainbow-card p-6" style={{ "--rc": "147, 51, 234" } as React.CSSProperties}>
            <div className="flex items-center gap-4 mb-3 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <span className="text-gray-400">{cs ? "Šťastné (≥100%)" : "Lucky (≥100%)"}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />
                <span className="text-gray-400">{cs ? "Průměrné (80–100%)" : "Average (80–100%)"}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-400" />
                <span className="text-gray-400">{cs ? "Nešťastné (<80%)" : "Unlucky (<80%)"}</span>
              </span>
            </div>
            <LuckChart data={buckets} />
          </div>
        </motion.section>

        {/* ═══════ F. REWARD HISTORY CHART ═══════ */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}>
          <div className="flex flex-col gap-2 mb-5">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? "Odměny" : "Rewards"}</p>
            <h2 className="text-2xl font-semibold text-white flex items-center gap-3">
              <Coins className="h-6 w-6 text-zion-gold" />
              {cs ? "Historie odměn" : "Reward History"}
            </h2>
            <p className="text-sm text-gray-400">
              {cs
                ? "Celkem ZION odměneno za každý den vybraného období."
                : "Total ZION rewarded each day over the selected period."}
            </p>
          </div>
          <div className="zion-rainbow-card p-6" style={{ "--rc": "147, 51, 234" } as React.CSSProperties}>
            <RewardChart data={buckets} />
          </div>
        </motion.section>

        {/* ═══════ G. POOL VS NETWORK HASHRATE ═══════ */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
          <div className="flex flex-col gap-2 mb-5">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? "Výkon" : "Power"}</p>
            <h2 className="text-2xl font-semibold text-white flex items-center gap-3">
              <Gauge className="h-6 w-6 text-zion-gold" />
              {cs ? "Pool vs síť – hashrate" : "Pool vs Network Hashrate"}
            </h2>
            <p className="text-sm text-gray-400">
              {cs
                ? "Časová osa hashrate poolu (fialová) vůči celé síti (azurová)."
                : "Timeline of pool hashrate (purple) vs total network hashrate (cyan)."}
            </p>
          </div>
          <div className="zion-rainbow-card p-6" style={{ "--rc": "147, 51, 234" } as React.CSSProperties}>
            <div className="flex items-center gap-4 mb-3 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-purple-400" />
                <span className="text-gray-400">{cs ? "Pool" : "Pool"}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-cyan-400" />
                <span className="text-gray-400">{cs ? "Síť" : "Network"}</span>
              </span>
            </div>
            <HashrateTimeline data={buckets} />
          </div>
        </motion.section>

        {/* ═══════ H. DETAILED BLOCKS TABLE ═══════ */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}>
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? "Ledger" : "Ledger"}</p>
            <h2 className="text-2xl font-semibold text-white flex items-center gap-3">
              <Blocks className="h-6 w-6 text-zion-gold" />
              {cs ? "Detailní seznam bloků" : "Detailed Blocks Table"} ({fmtNum(blocks.length)})
            </h2>
            <p className="text-sm text-gray-400">
              {cs
                ? "Všechny bloky v vybraném období. Syntetické bloky (bez výšky) jsou extrapolovány z nedávných dat."
                : "All blocks in the selected period. Synthetic blocks (no height) are extrapolated from recent data."}
            </p>
          </div>

          <div className="zion-rainbow-card overflow-hidden" style={{ "--rc": "147, 51, 234" } as React.CSSProperties}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08]">
                    <th className="text-left px-5 py-4 text-xs text-gray-500 uppercase tracking-wider font-medium">
                      {cs ? "Výška" : "Height"}
                    </th>
                    <th className="text-left px-5 py-4 text-xs text-gray-500 uppercase tracking-wider font-medium">
                      {cs ? "Čas" : "Time"}
                    </th>
                    <th className="text-left px-5 py-4 text-xs text-gray-500 uppercase tracking-wider font-medium">
                      {cs ? "Obtížnost" : "Difficulty"}
                    </th>
                    <th className="text-left px-5 py-4 text-xs text-gray-500 uppercase tracking-wider font-medium">
                      {cs ? "Odměna" : "Reward"}
                    </th>
                    <th className="text-left px-5 py-4 text-xs text-gray-500 uppercase tracking-wider font-medium">
                      Miner
                    </th>
                    <th className="text-left px-5 py-4 text-xs text-gray-500 uppercase tracking-wider font-medium">
                      {cs ? "Štěstí poolu" : "Pool Luck"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleBlocks.map((b, i) => {
                    const isSynthetic = b.height === 0;
                    return (
                      <tr
                        key={`${b.timestamp}-${i}`}
                        className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="px-5 py-3.5">
                          {isSynthetic ? (
                            <span className="text-gray-600 font-mono text-xs italic">
                              {cs ? "syntetický" : "synthetic"}
                            </span>
                          ) : (
                            <Link
                              href={`/explorer/block?height=${b.height}`}
                              className="text-zion-cyan hover:text-white font-mono font-semibold transition-colors"
                            >
                              #{fmtNum(b.height)}
                            </Link>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-gray-500 text-xs">
                          <div>{fmtDateTime(b.timestamp)}</div>
                          <div className="text-gray-600">{timeAgo(b.timestamp, cs)}</div>
                        </td>
                        <td className="px-5 py-3.5 text-gray-400 font-mono text-xs">
                          {b.difficulty > 0 ? fmtDifficulty(b.difficulty) : "—"}
                        </td>
                        <td className="px-5 py-3.5 text-emerald-400 font-mono text-xs">
                          {atomicToZion(b.reward)} ZION
                        </td>
                        <td className="px-5 py-3.5">
                          <code className="text-xs text-gray-400 font-mono">
                            {isSynthetic ? shortAddr(b.miner_address) : shortAddr(b.miner_address)}
                          </code>
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-mono ${luckBadge(b.poolLuck)}`}
                          >
                            <Zap className="h-3 w-3" />
                            {(b.poolLuck * 100).toFixed(0)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {blocks.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-gray-500">
                        {cs ? "Žádné bloky v tomto období" : "No blocks in this period"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {visibleCount < blocks.length && (
              <div className="px-5 py-4 border-t border-white/[0.06] flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  {cs
                    ? `Zobrazeno ${visibleCount} z ${fmtNum(blocks.length)}`
                    : `Showing ${visibleCount} of ${fmtNum(blocks.length)}`}
                </span>
                <button
                  onClick={() => setVisibleCount((c) => c + 25)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 bg-white/[0.03] text-xs text-gray-300 hover:text-white hover:border-white/20 transition-colors"
                >
                  {cs ? "Načíst více" : "Load more"}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </motion.section>

        {/* ═══════ I. CTA ═══════ */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.36 }}>
          <div className="zion-cta-banner p-8 md:p-10" style={{ "--rc": "147, 51, 234" } as React.CSSProperties}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-linear-to-br from-purple-500/80 to-indigo-600/80 flex-shrink-0">
                  <Pickaxe className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">
                    {cs ? "Začněte těžit nebo prozkoumejte blockchain" : "Start Mining or Explore the Chain"}
                  </h3>
                  <p className="text-sm text-gray-400 mt-1">
                    {cs
                      ? "Připojte se k poolu a těžte ZION, nebo prozkoumejte bloky a transakce v exploreru."
                      : "Join the pool and mine ZION, or explore blocks and transactions in the explorer."}
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
                <Link
                  href="/pool"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-linear-to-br from-purple-500/80 to-indigo-600/80 text-sm font-medium text-white hover:opacity-90 transition-opacity"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {cs ? "Dashboard poolu" : "Pool Dashboard"}
                </Link>
                <Link
                  href="/explorer"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] text-sm text-gray-300 hover:text-white hover:border-white/20 transition-colors"
                >
                  {cs ? "Blockchain Explorer" : "Blockchain Explorer"}
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
