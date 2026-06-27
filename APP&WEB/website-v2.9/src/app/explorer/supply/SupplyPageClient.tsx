"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Coins,
  Crown,
  Flame,
  Heart,
  Layers,
  Pickaxe,
  PieChart,
  Rocket,
  Timer,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { usePolling } from "@/hooks/usePolling";
import { apiClient } from "@/lib/api";
import { SITE_RELEASE_LABEL } from "@/lib/site";
import { BLOCKS_PER_DECADE } from "@/lib/constants";

interface EmissionData {
  total_emission: number;
  total_fees: number;
  total_burned: number;
  circulating_supply: number;
  max_supply: number;
  emission_pct: number;
  remaining_supply: number;
  base_reward_per_block: number;
  blocks_per_day: number;
  daily_emission: number;
  yearly_emission: number;
  estimated_years_remaining: number;
  estimated_full_emission_date: string;
  mining_horizon_label?: string;
  block_height: number;
  difficulty: number;
  reward_distribution: {
    miner_pct: number;
    humanitarian_pct: number;
    pool_fee_pct: number;
    miner_per_block: number;
    humanitarian_per_block: number;
    pool_fee_per_block: number;
  };
  humanitarian: {
    rate: number;
    per_block: number;
    estimated_total: number;
  };
}

interface ChainStats {
  block_height: number;
  difficulty: number;
  premine_supply: number;
  mined_supply: number;
  circulating_supply: number;
  max_supply: number;
  remaining_supply: number;
  emission_pct: string;
  network_hashrate_formatted: string;
  active_miners: number;
  connected: boolean;
}

function fmtZion(n: number, dec = 2) {
  if (n >= 1e12) return `${(n / 1e12).toFixed(dec)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(dec)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(dec)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(dec)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: dec });
}

function fmtFull(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

/* ─── Donut SVG chart ─────────────────────────────────────────── */
function DonutChart({
  segments,
  size = 180,
  stroke = 24,
}: {
  segments: { pct: number; color: string; label: string }[];
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offsets = segments.reduce<number[]>((acc, s) => {
    const prev = acc.length > 0 ? acc[acc.length - 1] + segments[acc.length - 1].pct * c : 0;
    acc.push(prev);
    return acc;
  }, []);
  return (
    <svg width={size} height={size} className="shrink-0">
      {segments.map((s, i) => {
        const dash = s.pct * c;
        return (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={stroke}
            strokeDasharray={`${dash} ${c - dash}`}
            strokeDashoffset={-offsets[i]}
            strokeLinecap="butt"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        );
      })}
      <text
        x="50%"
        y="45%"
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-white text-[10px] uppercase tracking-widest"
      >
        ZION
      </text>
      <text
        x="50%"
        y="58%"
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-zion-gold text-sm font-bold"
      >
        144B
      </text>
    </svg>
  );
}

/* ─── Decade schedule data ───────────────────────────────────── */
const DECADES = [
  { index: 0, reward: 5400.067, blocks: 525_600, pct: "20%" },
  { index: 1, reward: 4320.054, blocks: 525_600, pct: "16%" },
  { index: 2, reward: 3456.043, blocks: 525_600, pct: "12.8%" },
  { index: 3, reward: 2764.834, blocks: 525_600, pct: "10.24%" },
  { index: 4, reward: 2211.867, blocks: 525_600, pct: "8.19%" },
  { index: 5, reward: 1769.494, blocks: 525_600, pct: "6.55%" },
  { index: 6, reward: 1415.595, blocks: 525_600, pct: "5.24%" },
  { index: 7, reward: 1132.476, blocks: 525_600, pct: "4.19%" },
  { index: 8, reward: 905.981, blocks: 525_600, pct: "3.36%" },
  { index: 9, reward: 724.785, blocks: 525_600, pct: "2.68%" },
  { index: 10, reward: 724.785, blocks: 0, pct: "Tail ∞" },
];

export default function SupplyPageClient() {
  const { lang } = useLang();
  const cs = lang === "cs";
  const locale = cs ? "cs-CZ" : "en-US";

  const [emission, setEmission] = useState<EmissionData | null>(null);
  const [stats, setStats] = useState<ChainStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [e, s] = await Promise.all([
        apiClient<EmissionData>("/blockchain/emission"),
        apiClient<ChainStats>("/blockchain/stats"),
      ]);
      setEmission(e);
      setStats(s);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  usePolling(fetchData, 30_000);

  const data = emission ?? (stats ? {
    total_emission: stats.mined_supply,
    total_fees: 0,
    total_burned: 0,
    circulating_supply: stats.circulating_supply,
    max_supply: stats.max_supply,
    emission_pct: parseFloat(stats.emission_pct),
    remaining_supply: stats.remaining_supply,
    base_reward_per_block: 5400.067,
    blocks_per_day: 1440,
    daily_emission: 0,
    yearly_emission: 0,
    estimated_years_remaining: 100,
    estimated_full_emission_date: "",
    mining_horizon_label: undefined,
    block_height: stats.block_height,
    difficulty: stats.difficulty,
    reward_distribution: { miner_pct: 89, humanitarian_pct: 5, pool_fee_pct: 1, miner_per_block: 0, humanitarian_per_block: 0, pool_fee_per_block: 0 },
    humanitarian: { rate: 0.05, per_block: 0, estimated_total: 0 },
  } : null);

  const premine = stats?.premine_supply ?? 16_280_000_000;
  const mined = data?.total_emission ?? 0;
  const circ = data?.circulating_supply ?? premine;
  const max = data?.max_supply ?? 144_000_000_000;
  const remaining = data?.remaining_supply ?? Math.max(0, max - circ);
  const burned = data?.total_burned ?? 0;
  const emissionPct = data?.emission_pct ?? (circ / max) * 100;

  const donutSegments = [
    { pct: premine / max, color: "#a855f7", label: cs ? "Premine" : "Premine" },
    { pct: mined / max, color: "#22c55e", label: cs ? "Vytěženo" : "Mined" },
    { pct: remaining / max, color: "#334155", label: cs ? "Zbývá" : "Remaining" },
  ];

  const rewardDist = data?.reward_distribution ?? {
    miner_pct: 89,
    humanitarian_pct: 5,
    pool_fee_pct: 1,
    miner_per_block: 0,
    humanitarian_per_block: 0,
    pool_fee_per_block: 0,
  };
  const issobellaPct = 100 - rewardDist.miner_pct - rewardDist.humanitarian_pct - rewardDist.pool_fee_pct;

  return (
    <div className="zion-shell min-h-screen pt-28 md:pt-32 pb-24 overflow-x-hidden">
      {/* background glows */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full blur-[200px] bg-zion-gold/8" />
        <div className="absolute -right-40 top-2/3 h-[400px] w-[400px] rounded-full blur-[200px] bg-zion-purple/6" />
        <div className="absolute left-1/2 top-0 h-48 w-full -translate-x-1/2 bg-linear-to-b from-zion-gold/15 to-transparent" />
      </div>

      <div className="relative z-10 zion-container max-w-7xl space-y-14">
        {/* ── Back link ── */}
        <Link
          href="/explorer"
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {cs ? "Zpět do průzkumníka" : "Back to Explorer"}
        </Link>

        {/* ═══════ HERO ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="zion-rainbow-card rounded-3xl md:rounded-4xl bg-black/60 p-6 md:p-10 shadow-[0_30px_120px_rgba(0,0,0,0.45)]" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-zion-gold/40 bg-zion-gold/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-gold uppercase">
                <Coins className="h-4 w-4" />
                {SITE_RELEASE_LABEL} · {cs ? "Zásoba" : "Supply"}
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-gray-400">
                  {cs ? "Tokenomika ZION" : "ZION Tokenomics"}
                </p>
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-gradient leading-tight">
                  {cs ? "Supply Dashboard" : "Supply Dashboard"}
                </h1>
              </div>
              <p className="text-lg text-gray-300 max-w-2xl">
                {cs
                  ? "Kompletní přehled zásoby ZION: circulating, vytěžené, spálené, zamčené a zůstávající. Decade Decay emise s 144 miliardovým stropem."
                  : "Complete ZION supply overview: circulating, mined, burned, locked, and remaining. Decade Decay emission with 144 billion cap."}
              </p>
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <Rocket className="h-3 w-3 text-zion-gold" /> 144B {cs ? "max" : "max"}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <Flame className="h-3 w-3 text-amber-400" /> 100% {cs ? "fee burn" : "fee burn"}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <Heart className="h-3 w-3 text-pink-400" /> 5% {cs ? "humanitární" : "humanitarian"}
                </span>
              </div>
            </div>

            {/* Donut */}
            <div className="flex items-center gap-6">
              <DonutChart segments={donutSegments} />
              <div className="space-y-3">
                {[
                  { label: cs ? "Premine" : "Premine", value: fmtZion(premine), color: "bg-purple-500" },
                  { label: cs ? "Vytěženo" : "Mined", value: fmtZion(mined), color: "bg-emerald-500" },
                  { label: cs ? "Zbývá" : "Remaining", value: fmtZion(remaining), color: "bg-slate-700" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2 text-sm">
                    <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                    <span className="text-gray-400">{item.label}</span>
                    <span className="text-white font-mono font-semibold ml-auto">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        {/* ═══════ STATS GRID ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? "Metriky" : "Metrics"}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <BarChart3 className="h-7 w-7 text-emerald-400" />
              {cs ? "Supply statistiky" : "Supply Statistics"}
            </h2>
          </div>

          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="zion-rainbow-sub p-6 h-32" style={{ '--rc': '251, 191, 36' } as React.CSSProperties} />
              ))}
            </div>
          )}

          {!loading && data && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: cs ? "Circulating" : "Circulating", icon: Activity, accent: "text-emerald-400", value: fmtZion(circ), sub: `${emissionPct.toFixed(6)}% ${cs ? "z max" : "of max"}` },
                { label: cs ? "Max Supply" : "Max Supply", icon: Crown, accent: "text-zion-gold", value: fmtZion(max), sub: "144,000,000,000 ZION" },
                { label: cs ? "Vytěženo" : "Mined", icon: Pickaxe, accent: "text-cyan-400", value: fmtZion(mined), sub: `~${data.block_height?.toLocaleString(locale)} ${cs ? "bloků" : "blocks"}` },
                { label: cs ? "Premine" : "Premine", icon: Wallet, accent: "text-purple-400", value: fmtZion(premine), sub: cs ? "Genesis alokace" : "Genesis allocation" },
                { label: cs ? "Zbývá" : "Remaining", icon: Timer, accent: "text-slate-400", value: fmtZion(remaining), sub: `${(100 - emissionPct).toFixed(4)}%` },
                { label: cs ? "Spáleno (fees)" : "Burned (fees)", icon: Flame, accent: "text-amber-400", value: burned > 0 ? fmtZion(burned) : "—", sub: cs ? "100% fee burn" : "100% fee burn" },
                { label: cs ? "Denní emise" : "Daily Emission", icon: TrendingUp, accent: "text-zion-cyan", value: fmtZion(data.daily_emission), sub: `${data.base_reward_per_block} × ${data.blocks_per_day}` },
                { label: cs ? "Horizont těžby" : "Mining Horizon", icon: Rocket, accent: "text-zion-gold", value: data.mining_horizon_label ?? `${Math.round(data.estimated_years_remaining)} ${cs ? "let" : "yrs"}`, sub: data.estimated_full_emission_date || "—" },
              ].map((card) => (
                <div
                  key={card.label}
                  className="zion-rainbow-sub p-6"
                  style={{ '--rc': '251, 191, 36' } as React.CSSProperties}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <card.icon className={`h-4 w-4 ${card.accent}`} />
                    <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500">{card.label}</span>
                  </div>
                  <p className={`text-2xl font-bold tabular-nums ${card.accent}`}>{card.value}</p>
                  <p className="text-[11px] text-gray-500 mt-1">{card.sub}</p>
                </div>
              ))}
            </div>
          )}
        </motion.section>

        {/* ═══════ EMISSION PROGRESS ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="zion-section p-6 md:p-10"
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? "Průběh" : "Progress"}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <PieChart className="h-7 w-7 text-zion-gold" />
              {cs ? "Emisní průběh" : "Emission Progress"}
            </h2>
          </div>

          <div className="space-y-4">
            {/* Premine bar */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-purple-400">{cs ? "Premine" : "Premine"}</span>
                <span className="text-gray-400 font-mono">{fmtZion(premine)} ZION</span>
              </div>
              <div className="h-3 bg-white/4 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full" style={{ width: `${(premine / max) * 100}%` }} />
              </div>
            </div>
            {/* Mined bar */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-emerald-400">{cs ? "Vytěženo" : "Mined"}</span>
                <span className="text-gray-400 font-mono">{fmtZion(mined)} ZION</span>
              </div>
              <div className="h-3 bg-white/4 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(mined / max) * 100}%` }} />
              </div>
            </div>
            {/* Remaining bar */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">{cs ? "Zbývá k vytěžení" : "Remaining to mine"}</span>
                <span className="text-gray-400 font-mono">{fmtZion(remaining)} ZION</span>
              </div>
              <div className="h-3 bg-white/4 rounded-full overflow-hidden">
                <div className="h-full bg-slate-600 rounded-full" style={{ width: `${(remaining / max) * 100}%` }} />
              </div>
            </div>

            <div className="flex justify-between items-end pt-2">
              <span className="text-xs text-gray-500">
                {cs ? "Celková zásoba" : "Total supply"}: {fmtFull(max)} ZION
              </span>
              <span className="text-xs text-zion-gold font-mono tabular-nums">
                {emissionPct.toFixed(6)}% {cs ? "emitováno" : "emitted"}
              </span>
            </div>
          </div>
        </motion.section>

        {/* ═══════ REWARD DISTRIBUTION ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
          className="zion-section p-6 md:p-10"
        >
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? "Distribuce" : "Distribution"}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Zap className="h-7 w-7 text-zion-cyan" />
              {cs ? "Rozdělení odměn za blok" : "Block Reward Split"}
            </h2>
            <p className="text-sm text-gray-400">
              {cs
                ? "Každý coinbase blok rozděluje odměnu podle pevného poměru 89/5/5/1."
                : "Every coinbase block splits the reward according to a fixed 89/5/5/1 ratio."}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: cs ? "Miner" : "Miner", pct: rewardDist.miner_pct, perBlock: rewardDist.miner_per_block, color: "bg-emerald-500", text: "text-emerald-400", icon: Pickaxe },
              { label: cs ? "Humanitární" : "Humanitarian", pct: rewardDist.humanitarian_pct, perBlock: rewardDist.humanitarian_per_block, color: "bg-pink-500", text: "text-pink-400", icon: Heart },
              { label: "Issobella Fund", pct: issobellaPct, perBlock: 0, color: "bg-purple-500", text: "text-purple-400", icon: Layers },
              { label: cs ? "Pool fee" : "Pool Fee", pct: rewardDist.pool_fee_pct, perBlock: rewardDist.pool_fee_per_block, color: "bg-zion-cyan", text: "text-zion-cyan", icon: Wallet },
            ].map((d) => (
              <div key={d.label} className="zion-rainbow-sub p-5" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
                <div className="flex items-center gap-2 mb-3">
                  <d.icon className={`h-4 w-4 ${d.text}`} />
                  <span className="text-xs text-gray-400">{d.label}</span>
                </div>
                <p className={`text-3xl font-bold ${d.text}`}>{d.pct}%</p>
                <p className="text-[11px] text-gray-500 mt-1">
                  {d.perBlock > 0 ? `~${fmtZion(d.perBlock)} ZION / ${cs ? "blok" : "block"}` : cs ? "pevný podíl" : "fixed share"}
                </p>
                <div className="mt-3 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className={`h-full ${d.color} rounded-full`} style={{ width: `${d.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ═══════ DECADE DECAY TABLE ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="zion-section p-6 md:p-10"
        >
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? "Harmonogram" : "Schedule"}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Timer className="h-7 w-7 text-zion-gold" />
              {cs ? "Decade Decay emise" : "Decade Decay Emission"}
            </h2>
            <p className="text-sm text-gray-400">
              {cs
                ? "Každá dekáda (525 600 bloků ~ 1 rok) snižuje odměnu o 20%. Po 10. dekádě pokračuje tail reward ∞."
                : "Each decade (525,600 blocks ~ 1 year) reduces the reward by 20%. After decade 10, tail reward continues forever."}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 text-left text-[11px] uppercase tracking-[0.2em] text-gray-500">
                  <th className="pb-3 pl-3">{cs ? "Dekáda" : "Decade"}</th>
                  <th className="pb-3">{cs ? "Odměna / blok" : "Reward / block"}</th>
                  <th className="pb-3">{cs ? "Bloků" : "Blocks"}</th>
                  <th className="pb-3">{cs ? "Celkem ZION" : "Total ZION"}</th>
                  <th className="pb-3">{cs ? "Podíl" : "Share"}</th>
                  <th className="pb-3 pr-3">{cs ? "Stav" : "Status"}</th>
                </tr>
              </thead>
              <tbody>
                {DECADES.map((d) => {
                  const totalZion = d.blocks * d.reward;
                  const currentHeight = data?.block_height ?? 0;
                  const decadeStart = d.index * BLOCKS_PER_DECADE;
                  const decadeEnd = decadeStart + d.blocks;
                  const isActive = d.index === 10
                    ? currentHeight >= decadeStart
                    : currentHeight >= decadeStart && currentHeight < decadeEnd;
                  const isPast = d.index !== 10 && currentHeight >= decadeEnd;
                  return (
                    <tr
                      key={d.index}
                      className={`border-b border-white/4 ${isActive ? "bg-zion-gold/5" : ""} ${isPast ? "opacity-50" : ""}`}
                    >
                      <td className="py-3 pl-3 font-mono text-white">{d.index === 10 ? "Tail ∞" : d.index}</td>
                      <td className="py-3 font-mono text-gray-300">{d.reward.toFixed(3)} ZION</td>
                      <td className="py-3 font-mono text-gray-300">{d.blocks > 0 ? d.blocks.toLocaleString(locale) : "∞"}</td>
                      <td className="py-3 font-mono text-gray-300">{d.blocks > 0 ? fmtZion(totalZion) : "∞"}</td>
                      <td className="py-3 text-gray-400">{d.pct}</td>
                      <td className="py-3 pr-3">
                        {isActive && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-zion-gold/10 border border-zion-gold/30 px-2 py-0.5 text-[10px] text-zion-gold uppercase tracking-wider">
                            <Activity className="h-3 w-3" /> {cs ? "Aktivní" : "Active"}
                          </span>
                        )}
                        {isPast && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] text-emerald-400 uppercase tracking-wider">
                            <TrendingUp className="h-3 w-3" /> {cs ? "Dokončeno" : "Done"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.section>

        {/* ═══════ CTA ═══════ */}
        <motion.section
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.22 }}
          className="zion-cta-banner p-10 text-center"
        >
          <Coins className="mx-auto h-12 w-12 text-zion-gold" />
          <h2 className="mt-6 text-3xl font-semibold text-white">ZION Supply</h2>
          <p className="mt-4 text-gray-100 max-w-3xl mx-auto">
            {cs
              ? "Všechna čísla jsou odvozena z aktuálního chain height a on-chain RPC. Decade Decay zajišťuje dlouhodobou udržitelnost."
              : "All numbers are derived from current chain height and on-chain RPC. Decade Decay ensures long-term sustainability."}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link href="/explorer" className="inline-flex items-center gap-2 rounded-2xl bg-black/70 px-6 py-3 text-sm font-semibold text-white border border-white/20">
              <ArrowLeft className="h-4 w-4" /> {cs ? "Zpět" : "Back"}
            </Link>
            <Link href="/explorer/mempool" className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-6 py-3 text-sm font-semibold text-white border border-white/10">
              <Flame className="h-4 w-4" /> Mempool
            </Link>
          </div>
        </motion.section>

        <p className="text-center text-xs text-gray-600">
          {cs
            ? `ZION TerraNova ${SITE_RELEASE_LABEL} — Supply Dashboard · Data v reálném čase z nativního Rust runtime`
            : `ZION TerraNova ${SITE_RELEASE_LABEL} — Supply Dashboard · Real-time data from native Rust runtime`}
        </p>
      </div>
    </div>
  );
}
