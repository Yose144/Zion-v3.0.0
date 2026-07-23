"use client";

import { useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Activity,
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
import { BLOCKS_PER_DECADE, BLOCKS_PER_DAY } from "@/lib/constants";
import { estimateCirculatingSupplyAtHeight } from "@/lib/supply";

const ExplorerSupplySupplyPageClientCopy = {
  k1y: { cs: `1R`, en: `1Y` },
  all: { cs: `Vše`, en: `All` },
  supplyOverTime: { cs: `Zásoba v čase`, en: `Supply Over Time` },
  cumulativeEmissionBurnProjecti: { cs: `Kumulativní emise + projekce spalování`, en: `Cumulative emission + burn projection` },
  burn: { cs: `spál.`, en: `burn` },
  circulatingSupply: { cs: `Cirkulující zásoba`, en: `Circulating supply` },
  burnProjection: { cs: `Projekce spalování`, en: `Burn projection` },
  enUs: { cs: `cs-CZ`, en: `en-US` },
  premine: { cs: `Premine`, en: `Premine` },
  mined: { cs: `Vytěženo`, en: `Mined` },
  remaining: { cs: `Zbývá`, en: `Remaining` },
  supply: { cs: `Zásoba`, en: `Supply` },
  zionTokenomics: { cs: `Tokenomika ZION`, en: `ZION Tokenomics` },
  supplyDashboard: { cs: `Supply Dashboard`, en: `Supply Dashboard` },
  completeZionSupplyOverviewCirc: { cs: `Kompletní přehled zásoby ZION: circulating, vytěžené, spálené, zamčené a zůstávající. Decade Decay emise s 144 miliardovým stropem.`, en: `Complete ZION supply overview: circulating, mined, burned, locked, and remaining. Decade Decay emission with 144 billion cap.` },
  max: { cs: `max`, en: `max` },
  feeBurn: { cs: `fee burn`, en: `fee burn` },
  humanitarian: { cs: `humanitární`, en: `humanitarian` },
  metrics: { cs: `Metriky`, en: `Metrics` },
  supplyStatistics: { cs: `Supply statistiky`, en: `Supply Statistics` },
  circulating: { cs: `Circulating`, en: `Circulating` },
  ofMax: { cs: `z max`, en: `of max` },
  maxSupply: { cs: `Max Supply`, en: `Max Supply` },
  blocks: { cs: `bloků`, en: `blocks` },
  genesisAllocation: { cs: `Genesis alokace`, en: `Genesis allocation` },
  burnedFees: { cs: `Spáleno (fees)`, en: `Burned (fees)` },
  k100FeeBurn: { cs: `100% fee burn`, en: `100% fee burn` },
  dailyEmission: { cs: `Denní emise`, en: `Daily Emission` },
  miningHorizon: { cs: `Horizont těžby`, en: `Mining Horizon` },
  yrs: { cs: `let`, en: `yrs` },
  progress: { cs: `Průběh`, en: `Progress` },
  emissionProgress: { cs: `Emisní průběh`, en: `Emission Progress` },
  remainingToMine: { cs: `Zbývá k vytěžení`, en: `Remaining to mine` },
  totalSupply: { cs: `Celková zásoba`, en: `Total supply` },
  emitted: { cs: `emitováno`, en: `emitted` },
  distribution: { cs: `Distribuce`, en: `Distribution` },
  blockRewardSplit: { cs: `Rozdělení odměn za blok`, en: `Block Reward Split` },
  everyCoinbaseBlockSplitsTheRew: { cs: `Každý coinbase blok rozděluje odměnu podle pevného poměru 89/5/5/1.`, en: `Every coinbase block splits the reward according to a fixed 89/5/5/1 ratio.` },
  miner: { cs: `Miner`, en: `Miner` },
  humanitarian_2: { cs: `Humanitární`, en: `Humanitarian` },
  poolFee: { cs: `Pool fee`, en: `Pool Fee` },
  block: { cs: `blok`, en: `block` },
  fixedShare: { cs: `pevný podíl`, en: `fixed share` },
  schedule: { cs: `Harmonogram`, en: `Schedule` },
  decadeDecayEmission: { cs: `Decade Decay emise`, en: `Decade Decay Emission` },
  eachDecade525600Blocks1YearRed: { cs: `Každá dekáda (525 600 bloků ~ 1 rok) snižuje odměnu o 20%. Po 10. dekádě pokračuje tail reward ∞.`, en: `Each decade (525,600 blocks ~ 1 year) reduces the reward by 20%. After decade 10, tail reward continues forever.` },
  decade: { cs: `Dekáda`, en: `Decade` },
  rewardBlock: { cs: `Odměna / blok`, en: `Reward / block` },
  blocks_2: { cs: `Bloků`, en: `Blocks` },
  totalZion: { cs: `Celkem ZION`, en: `Total ZION` },
  share: { cs: `Podíl`, en: `Share` },
  status: { cs: `Stav`, en: `Status` },
  active: { cs: `Aktivní`, en: `Active` },
  done: { cs: `Dokončeno`, en: `Done` },
  allNumbersAreDerivedFromCurren: { cs: `Všechna čísla jsou odvozena z aktuálního chain height a on-chain RPC. Decade Decay zajišťuje dlouhodobou udržitelnost.`, en: `All numbers are derived from current chain height and on-chain RPC. Decade Decay ensures long-term sustainability.` },
};

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

/* ─── Supply Over Time SVG area chart ─────────────────────────── */
type SupplyRange = "30d" | "90d" | "1y" | "all";

function SupplyOverTimeChart({
  currentHeight,
  premine,
  burned,
  dailyEmission,
  cs,
}: {
  currentHeight: number;
  premine: number;
  burned: number;
  dailyEmission: number;
  cs: boolean;
}) {
  const [range, setRange] = useState<SupplyRange>("90d");
  const [hovered, setHovered] = useState<number | null>(null);

  const data = useMemo(() => {
    const daysByRange: Record<SupplyRange, number> = {
      "30d": 30,
      "90d": 90,
      "1y": 365,
      all: Math.max(30, Math.floor(currentHeight / BLOCKS_PER_DAY)),
    };
    const numDays = daysByRange[range];
    const step = Math.max(1, Math.ceil(numDays / 180));
    const pts: { label: string; supply: number; burn: number }[] = [];
    const now = Date.now();
    for (let i = numDays; i >= 0; i -= step) {
      const height = Math.max(0, currentHeight - i * BLOCKS_PER_DAY);
      const supply = estimateCirculatingSupplyAtHeight(height, premine);
      const label = new Date(now - i * 86_400_000).toISOString().slice(0, 10);
      const burn =
        burned > 0
          ? (burned / Math.max(currentHeight, 1)) * height
          : dailyEmission * 0.02 * (height / BLOCKS_PER_DAY);
      pts.push({ label, supply, burn });
    }
    return pts;
  }, [range, currentHeight, premine, burned, dailyEmission]);

  const W = 800, H = 260;
  const PAD = { top: 16, right: 56, bottom: 28, left: 64 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const supplyVals = data.map((d) => d.supply);
  const burnVals = data.map((d) => d.burn);
  const sMin = Math.min(...supplyVals);
  const sMax = Math.max(...supplyVals);
  const sRange = sMax - sMin || 1;
  const bMax = Math.max(...burnVals, 1);

  const xFor = (i: number) => PAD.left + (i / Math.max(data.length - 1, 1)) * chartW;
  const ySupply = (v: number) => PAD.top + chartH - ((v - sMin) / sRange) * chartH;
  const yBurn = (v: number) => PAD.top + chartH - (v / bMax) * chartH;

  const supplyPath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${ySupply(d.supply)}`).join(" ");
  const supplyArea = `${supplyPath} L ${xFor(data.length - 1)} ${PAD.top + chartH} L ${xFor(0)} ${PAD.top + chartH} Z`;
  const burnPath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yBurn(d.burn)}`).join(" ");

  const yLabels = [0, 0.25, 0.5, 0.75, 1].map((pct) => ({
    value: sMin + pct * sRange,
    y: PAD.top + chartH - pct * chartH,
  }));

  const ranges: { value: SupplyRange; label: string }[] = [
    { value: "30d", label: "30D" },
    { value: "90d", label: "90D" },
    { value: "1y", label: ExplorerSupplySupplyPageClientCopy.k1y[cs ? 'cs' : 'en'] },
    { value: "all", label: ExplorerSupplySupplyPageClientCopy.all[cs ? 'cs' : 'en'] },
  ];

  return (
    <div
      className="zion-rainbow-card rounded-3xl bg-black/60 p-6 md:p-8"
      style={{ "--rc": "147, 51, 234" } as React.CSSProperties}
    >
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
            <TrendingUp className="w-4.5 h-4.5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">
              {ExplorerSupplySupplyPageClientCopy.supplyOverTime[cs ? 'cs' : 'en']}
            </h3>
            <p className="text-[11px] text-white/30">
              {ExplorerSupplySupplyPageClientCopy.cumulativeEmissionBurnProjecti[cs ? 'cs' : 'en']}
            </p>
          </div>
        </div>
        <div className="flex gap-0.5">
          {ranges.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`px-3 py-1 text-[11px] rounded-md transition-all ${
                range === r.value
                  ? "bg-white/[0.10] text-white font-semibold"
                  : "text-white/30 hover:text-white/60"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-56" preserveAspectRatio="none">
        <defs>
          <linearGradient id="supplyAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9333ea" stopOpacity="0.25" />
            <stop offset="50%" stopColor="#10b981" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {/* Grid + left Y-axis (supply) */}
        {yLabels.map((yl, i) => (
          <g key={i}>
            <line x1={PAD.left} x2={W - PAD.right} y1={yl.y} y2={yl.y} stroke="rgba(255,255,255,0.05)" strokeDasharray="4" />
            <text x={PAD.left - 6} y={yl.y + 3} textAnchor="end" fill="rgba(255,255,255,0.2)" fontSize="8" fontFamily="monospace">
              {fmtZion(yl.value)}
            </text>
          </g>
        ))}
        {/* Right Y-axis (burn) */}
        {[0, 0.5, 1].map((pct, i) => (
          <text
            key={i}
            x={W - PAD.right + 6}
            y={PAD.top + chartH - pct * chartH + 3}
            textAnchor="start"
            fill="rgba(16,185,129,0.45)"
            fontSize="7"
            fontFamily="monospace"
          >
            {fmtZion(bMax * pct)}
          </text>
        ))}
        {/* Supply area + line */}
        <path d={supplyArea} fill="url(#supplyAreaGrad)" />
        <path d={supplyPath} fill="none" stroke="#9333ea" strokeWidth="1.8" strokeLinejoin="round" opacity="0.9" />
        {/* Burn line (dashed emerald) */}
        <path d={burnPath} fill="none" stroke="#10b981" strokeWidth="1.2" strokeDasharray="4 2" opacity="0.7" />
        {/* Hover */}
        {data.map((d, i) => (
          <g key={i}>
            <rect
              x={xFor(i) - chartW / data.length / 2}
              y={PAD.top}
              width={chartW / data.length}
              height={chartH}
              fill="transparent"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            />
            {hovered === i && (
              <>
                <line x1={xFor(i)} x2={xFor(i)} y1={PAD.top} y2={PAD.top + chartH} stroke="rgba(255,255,255,0.1)" strokeDasharray="2" />
                <circle cx={xFor(i)} cy={ySupply(d.supply)} r="3.5" fill="#9333ea" stroke="rgba(0,0,0,0.6)" strokeWidth="1.5" />
                <circle cx={xFor(i)} cy={yBurn(d.burn)} r="2.5" fill="#10b981" stroke="rgba(0,0,0,0.6)" strokeWidth="1" />
                <rect x={Math.min(xFor(i) - 62, W - 130)} y={Math.max(ySupply(d.supply) - 38, 2)} width="124" height="34" rx="6" fill="rgba(0,0,0,0.9)" stroke="#9333ea" strokeWidth="0.5" />
                <text x={Math.min(xFor(i), W - 68)} y={Math.max(ySupply(d.supply) - 24, 14)} textAnchor="middle" fill="white" fontSize="7.5" fontWeight="600" fontFamily="monospace">
                  {fmtZion(d.supply)} ZION
                </text>
                <text x={Math.min(xFor(i), W - 68)} y={Math.max(ySupply(d.supply) - 12, 26)} textAnchor="middle" fill="#10b981" fontSize="7" fontFamily="monospace">
                  {ExplorerSupplySupplyPageClientCopy.burn[cs ? 'cs' : 'en']} {fmtZion(d.burn)}
                </text>
              </>
            )}
          </g>
        ))}
      </svg>
      <div className="flex items-center gap-4 mt-3 text-[10px]">
        <span className="flex items-center gap-1.5 text-white/40">
          <span className="w-3 h-1 rounded-full bg-purple-500" />
          {ExplorerSupplySupplyPageClientCopy.circulatingSupply[cs ? 'cs' : 'en']}
        </span>
        <span className="flex items-center gap-1.5 text-white/40">
          <span className="w-3 h-px bg-emerald-500" style={{ borderTop: "1px dashed #10b981" }} />
          {ExplorerSupplySupplyPageClientCopy.burnProjection[cs ? 'cs' : 'en']}
        </span>
      </div>
    </div>
  );
}

export default function SupplyPageClient() {
  const { lang } = useLang();
  const cs = lang === "cs";
  const locale = ExplorerSupplySupplyPageClientCopy.enUs[cs ? 'cs' : 'en'];

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
    { pct: premine / max, color: "#a855f7", label: ExplorerSupplySupplyPageClientCopy.premine[cs ? 'cs' : 'en'] },
    { pct: mined / max, color: "#22c55e", label: ExplorerSupplySupplyPageClientCopy.mined[cs ? 'cs' : 'en'] },
    { pct: remaining / max, color: "#334155", label: ExplorerSupplySupplyPageClientCopy.remaining[cs ? 'cs' : 'en'] },
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
    <div className="relative min-h-screen pb-24 overflow-x-hidden">
      {/* background glows */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full blur-[200px] bg-zion-gold/8" />
        <div className="absolute -right-40 top-2/3 h-[400px] w-[400px] rounded-full blur-[200px] bg-zion-purple/6" />
        <div className="absolute left-1/2 top-0 h-48 w-full -translate-x-1/2 bg-linear-to-b from-zion-gold/15 to-transparent" />
      </div>

      <div className="relative z-10 zion-container max-w-7xl space-y-14 pt-6">
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
                {SITE_RELEASE_LABEL} · {ExplorerSupplySupplyPageClientCopy.supply[cs ? 'cs' : 'en']}
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-gray-400">
                  {ExplorerSupplySupplyPageClientCopy.zionTokenomics[cs ? 'cs' : 'en']}
                </p>
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-gradient leading-tight">
                  {ExplorerSupplySupplyPageClientCopy.supplyDashboard[cs ? 'cs' : 'en']}
                </h1>
              </div>
              <p className="text-lg text-gray-300 max-w-2xl">
                {ExplorerSupplySupplyPageClientCopy.completeZionSupplyOverviewCirc[cs ? 'cs' : 'en']}
              </p>
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <Rocket className="h-3 w-3 text-zion-gold" /> 144B {ExplorerSupplySupplyPageClientCopy.max[cs ? 'cs' : 'en']}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <Flame className="h-3 w-3 text-amber-400" /> 100% {ExplorerSupplySupplyPageClientCopy.feeBurn[cs ? 'cs' : 'en']}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <Heart className="h-3 w-3 text-pink-400" /> 5% {ExplorerSupplySupplyPageClientCopy.humanitarian[cs ? 'cs' : 'en']}
                </span>
              </div>
            </div>

            {/* Donut */}
            <div className="flex items-center gap-6">
              <DonutChart segments={donutSegments} />
              <div className="space-y-3">
                {[
                  { label: ExplorerSupplySupplyPageClientCopy.premine[cs ? 'cs' : 'en'], value: fmtZion(premine), color: "bg-purple-500" },
                  { label: ExplorerSupplySupplyPageClientCopy.mined[cs ? 'cs' : 'en'], value: fmtZion(mined), color: "bg-emerald-500" },
                  { label: ExplorerSupplySupplyPageClientCopy.remaining[cs ? 'cs' : 'en'], value: fmtZion(remaining), color: "bg-slate-700" },
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

        {/* ═══════ SUPPLY OVER TIME CHART ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
        >
          {!loading && data && (
            <SupplyOverTimeChart
              currentHeight={data.block_height}
              premine={premine}
              burned={burned}
              dailyEmission={data.daily_emission}
              cs={cs}
            />
          )}
        </motion.section>

        {/* ═══════ STATS GRID ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{ExplorerSupplySupplyPageClientCopy.metrics[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <BarChart3 className="h-7 w-7 text-emerald-400" />
              {ExplorerSupplySupplyPageClientCopy.supplyStatistics[cs ? 'cs' : 'en']}
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
                { label: ExplorerSupplySupplyPageClientCopy.circulating[cs ? 'cs' : 'en'], icon: Activity, accent: "text-emerald-400", value: fmtZion(circ), sub: `${emissionPct.toFixed(6)}% ${ExplorerSupplySupplyPageClientCopy.ofMax[cs ? 'cs' : 'en']}` },
                { label: ExplorerSupplySupplyPageClientCopy.maxSupply[cs ? 'cs' : 'en'], icon: Crown, accent: "text-zion-gold", value: fmtZion(max), sub: "144,000,000,000 ZION" },
                { label: ExplorerSupplySupplyPageClientCopy.mined[cs ? 'cs' : 'en'], icon: Pickaxe, accent: "text-cyan-400", value: fmtZion(mined), sub: `~${data.block_height?.toLocaleString(locale)} ${ExplorerSupplySupplyPageClientCopy.blocks[cs ? 'cs' : 'en']}` },
                { label: ExplorerSupplySupplyPageClientCopy.premine[cs ? 'cs' : 'en'], icon: Wallet, accent: "text-purple-400", value: fmtZion(premine), sub: ExplorerSupplySupplyPageClientCopy.genesisAllocation[cs ? 'cs' : 'en'] },
                { label: ExplorerSupplySupplyPageClientCopy.remaining[cs ? 'cs' : 'en'], icon: Timer, accent: "text-slate-400", value: fmtZion(remaining), sub: `${(100 - emissionPct).toFixed(4)}%` },
                { label: ExplorerSupplySupplyPageClientCopy.burnedFees[cs ? 'cs' : 'en'], icon: Flame, accent: "text-amber-400", value: burned > 0 ? fmtZion(burned) : "—", sub: ExplorerSupplySupplyPageClientCopy.k100FeeBurn[cs ? 'cs' : 'en'] },
                { label: ExplorerSupplySupplyPageClientCopy.dailyEmission[cs ? 'cs' : 'en'], icon: TrendingUp, accent: "text-zion-cyan", value: fmtZion(data.daily_emission), sub: `${data.base_reward_per_block} × ${data.blocks_per_day}` },
                { label: ExplorerSupplySupplyPageClientCopy.miningHorizon[cs ? 'cs' : 'en'], icon: Rocket, accent: "text-zion-gold", value: data.mining_horizon_label ?? `${Math.round(data.estimated_years_remaining)} ${ExplorerSupplySupplyPageClientCopy.yrs[cs ? 'cs' : 'en']}`, sub: data.estimated_full_emission_date || "—" },
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
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{ExplorerSupplySupplyPageClientCopy.progress[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <PieChart className="h-7 w-7 text-zion-gold" />
              {ExplorerSupplySupplyPageClientCopy.emissionProgress[cs ? 'cs' : 'en']}
            </h2>
          </div>

          <div className="space-y-4">
            {/* Premine bar */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-purple-400">{ExplorerSupplySupplyPageClientCopy.premine[cs ? 'cs' : 'en']}</span>
                <span className="text-gray-400 font-mono">{fmtZion(premine)} ZION</span>
              </div>
              <div className="h-3 bg-white/4 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full" style={{ width: `${(premine / max) * 100}%` }} />
              </div>
            </div>
            {/* Mined bar */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-emerald-400">{ExplorerSupplySupplyPageClientCopy.mined[cs ? 'cs' : 'en']}</span>
                <span className="text-gray-400 font-mono">{fmtZion(mined)} ZION</span>
              </div>
              <div className="h-3 bg-white/4 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(mined / max) * 100}%` }} />
              </div>
            </div>
            {/* Remaining bar */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">{ExplorerSupplySupplyPageClientCopy.remainingToMine[cs ? 'cs' : 'en']}</span>
                <span className="text-gray-400 font-mono">{fmtZion(remaining)} ZION</span>
              </div>
              <div className="h-3 bg-white/4 rounded-full overflow-hidden">
                <div className="h-full bg-slate-600 rounded-full" style={{ width: `${(remaining / max) * 100}%` }} />
              </div>
            </div>

            <div className="flex justify-between items-end pt-2">
              <span className="text-xs text-gray-500">
                {ExplorerSupplySupplyPageClientCopy.totalSupply[cs ? 'cs' : 'en']}: {fmtFull(max)} ZION
              </span>
              <span className="text-xs text-zion-gold font-mono tabular-nums">
                {emissionPct.toFixed(6)}% {ExplorerSupplySupplyPageClientCopy.emitted[cs ? 'cs' : 'en']}
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
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{ExplorerSupplySupplyPageClientCopy.distribution[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Zap className="h-7 w-7 text-zion-cyan" />
              {ExplorerSupplySupplyPageClientCopy.blockRewardSplit[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400">
              {ExplorerSupplySupplyPageClientCopy.everyCoinbaseBlockSplitsTheRew[cs ? 'cs' : 'en']}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: ExplorerSupplySupplyPageClientCopy.miner[cs ? 'cs' : 'en'], pct: rewardDist.miner_pct, perBlock: rewardDist.miner_per_block, color: "bg-emerald-500", text: "text-emerald-400", icon: Pickaxe },
              { label: ExplorerSupplySupplyPageClientCopy.humanitarian_2[cs ? 'cs' : 'en'], pct: rewardDist.humanitarian_pct, perBlock: rewardDist.humanitarian_per_block, color: "bg-pink-500", text: "text-pink-400", icon: Heart },
              { label: "Issobella Fund", pct: issobellaPct, perBlock: 0, color: "bg-purple-500", text: "text-purple-400", icon: Layers },
              { label: ExplorerSupplySupplyPageClientCopy.poolFee[cs ? 'cs' : 'en'], pct: rewardDist.pool_fee_pct, perBlock: rewardDist.pool_fee_per_block, color: "bg-zion-cyan", text: "text-zion-cyan", icon: Wallet },
            ].map((d) => (
              <div key={d.label} className="zion-rainbow-sub p-5" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
                <div className="flex items-center gap-2 mb-3">
                  <d.icon className={`h-4 w-4 ${d.text}`} />
                  <span className="text-xs text-gray-400">{d.label}</span>
                </div>
                <p className={`text-3xl font-bold ${d.text}`}>{d.pct}%</p>
                <p className="text-[11px] text-gray-500 mt-1">
                  {d.perBlock > 0 ? `~${fmtZion(d.perBlock)} ZION / ${ExplorerSupplySupplyPageClientCopy.block[cs ? 'cs' : 'en']}` : ExplorerSupplySupplyPageClientCopy.fixedShare[cs ? 'cs' : 'en']}
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
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{ExplorerSupplySupplyPageClientCopy.schedule[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Timer className="h-7 w-7 text-zion-gold" />
              {ExplorerSupplySupplyPageClientCopy.decadeDecayEmission[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400">
              {ExplorerSupplySupplyPageClientCopy.eachDecade525600Blocks1YearRed[cs ? 'cs' : 'en']}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 text-left text-[11px] uppercase tracking-[0.2em] text-gray-500">
                  <th className="pb-3 pl-3">{ExplorerSupplySupplyPageClientCopy.decade[cs ? 'cs' : 'en']}</th>
                  <th className="pb-3">{ExplorerSupplySupplyPageClientCopy.rewardBlock[cs ? 'cs' : 'en']}</th>
                  <th className="pb-3">{ExplorerSupplySupplyPageClientCopy.blocks_2[cs ? 'cs' : 'en']}</th>
                  <th className="pb-3">{ExplorerSupplySupplyPageClientCopy.totalZion[cs ? 'cs' : 'en']}</th>
                  <th className="pb-3">{ExplorerSupplySupplyPageClientCopy.share[cs ? 'cs' : 'en']}</th>
                  <th className="pb-3 pr-3">{ExplorerSupplySupplyPageClientCopy.status[cs ? 'cs' : 'en']}</th>
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
                            <Activity className="h-3 w-3" /> {ExplorerSupplySupplyPageClientCopy.active[cs ? 'cs' : 'en']}
                          </span>
                        )}
                        {isPast && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] text-emerald-400 uppercase tracking-wider">
                            <TrendingUp className="h-3 w-3" /> {ExplorerSupplySupplyPageClientCopy.done[cs ? 'cs' : 'en']}
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
            {ExplorerSupplySupplyPageClientCopy.allNumbersAreDerivedFromCurren[cs ? 'cs' : 'en']}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
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
