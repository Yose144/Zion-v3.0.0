"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Cpu,
  Clock,
  Flame,
  Gauge,
  Heart,
  Layers,
  Pickaxe,
  Shield,
  TrendingDown,
  Wallet,
  Zap,
} from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { usePolling } from "@/hooks/usePolling";
import { apiClient } from "@/lib/api";

import type { ExplorerConsensus } from "@/lib/explorer/types";
import { formatNumber } from "@/lib/explorer/format";

const ExplorerConsensusConsensusClientCopy = {
  noDataAvailable: { cs: `Data nejsou dostupná`, en: `No data available` },
  enUs: { cs: `cs-CZ`, en: `en-US` },
  lwmaDaa: { cs: `LWMA DAA`, en: `LWMA DAA` },
  zionUsesTheLinearlyWeightedMov: { cs: `ZION používá Linearly Weighted Moving Average (LWMA) Difficulty Adjustment Algorithm. Cílem je stabilní 60s blok bez náhlých skoků obtížnosti. LWMA klade vyšší váhu na recentní bloky, což umožňuje rychlejší reakci na změny hashrate.`, en: `ZION uses the Linearly Weighted Moving Average (LWMA) Difficulty Adjustment Algorithm. The goal is a stable 60s block time without sudden difficulty jumps. LWMA weights recent blocks more heavily, allowing faster response to hashrate changes.` },
  decadeDecay: { cs: `Decade Decay`, en: `Decade Decay` },
  zionEmissionIsNotAHalvingItSDe: { cs: `Emise ZION není halving — je to Decade Decay. Každých ~10 let (525 600 bloků) klesne odměna o 20 %. Startuje na 5 400 ZION/blok a postupně klesá na 724 ZION/blok v desáté dekádě, kde zůstává jako tail emise do nekonečna. Celkový strop je 144 miliard ZION.`, en: `ZION emission is not a halving — it\'s Decade Decay. Every ~10 years (525,600 blocks) the reward drops by 20%. Starting at 5,400 ZION/block and gradually declining to 724 ZION/block in the 10th decade, where it remains as tail emission forever. Total cap is 144 billion ZION.` },
  powAlgorithms: { cs: `PoW algoritmy`, en: `PoW Algorithms` },
  zionSupportsThreeAlgorithmsDee: { cs: `ZION podporuje tři algoritmy: Deeksha Lite (default, nízká energie, 256 KiB scratchpad), Deeksha Lite Fire (full power, 512 KiB, vyšší teplota) a Cosmic Harmony Ekam Deeksha v2 (nejpokročilejší). Pool automaticky detekuje algoritmus z Hello zprávy a validuje share podle něj.`, en: `ZION supports three algorithms: Deeksha Lite (default, low energy, 256 KiB scratchpad), Deeksha Lite Fire (full power, 512 KiB, higher temperature), and Cosmic Harmony Ekam Deeksha v2 (most advanced). The pool auto-detects the algorithm from the Hello message and validates shares accordingly.` },
  k89551RewardSplit: { cs: `Odměna 89/5/5/1`, en: `89/5/5/1 Reward Split` },
  everyCoinbaseBlockSplitsTheRew: { cs: `Každý coinbase blok rozděluje odměnu: 89 % miner, 5 % humanitární fond, 5 % Issobella Fund a 1 % pool fee. Tento poměr je konstituční — změna vyžaduje governance proposal. Fee transakcí jsou 100 % spáleny (burn), což snižuje celkovou zásobu.`, en: `Every coinbase block splits the reward: 89% miner, 5% humanitarian fund, 5% Issobella Fund, and 1% pool fee. This ratio is constitutional — changing it requires a governance proposal. Transaction fees are 100% burned, reducing total supply.` },
  securityValidation: { cs: `Bezpečnost & validace`, en: `Security & Validation` },
  utxoModelWithRingSignaturesEve: { cs: `UTXO model s ring signatures. Každý blok musí projít plnou validací: PoW, signature verification, double-spend check a consensus rules. Orphan bloky jsou sledovány jako potenciální forky. Pool validuje share pomocí session-specific algoritmu.`, en: `UTXO model with ring signatures. Every block undergoes full validation: PoW, signature verification, double-spend check, and consensus rules. Orphan blocks are tracked as potential forks. The pool validates shares using the session-specific algorithm.` },
  protocol: { cs: `Protokol`, en: `Protocol` },
  terranovaConsensus: { cs: `TerraNova konsensus`, en: `TerraNova Consensus` },
  consensusEconomics: { cs: `Konsensus & ekonomika`, en: `Consensus & Economics` },
  overviewOfAlgorithmsEmissionAn: { cs: `Přehled algoritmů, emise a bezpečnostního modelu ZION TerraNova.`, en: `Overview of algorithms, emission, and security model of ZION TerraNova.` },
  details: { cs: `Detaily`, en: `Details` },
  protocolParameters: { cs: `Protokolové parametry`, en: `Protocol Parameters` },
  emission: { cs: `Emise`, en: `Emission` },
  decadeDecaySchedule: { cs: `Decade Decay rozvrh`, en: `Decade Decay Schedule` },
  decade: { cs: `Dekáda`, en: `Decade` },
  rewardBlock: { cs: `Odměna / blok`, en: `Reward / Block` },
  blocks: { cs: `Bloků`, en: `Blocks` },
  share: { cs: `Podíl`, en: `Share` },
  zionTerranovaConsensusProtocol: { cs: `ZION TerraNova — Konsensus · Protokolové parametry · V3 MainNet`, en: `ZION TerraNova — Consensus · Protocol parameters · V3 MainNet` },
};

/* ─── Difficulty Adjustment SVG chart ────────────────────────── */
function DifficultyChart({
  chart,
  cs,
  loading,
}: {
  chart: { labels: string[]; values: number[] } | null;
  cs: boolean;
  loading: boolean;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  const values = chart?.values ?? [];
  const labels = chart?.labels ?? [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 border-2 border-white/10 border-t-purple-400/60 rounded-full animate-spin" />
      </div>
    );
  }

  if (!values.length) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-white/20 gap-2">
        <Gauge className="h-8 w-8" />
        <p className="text-sm">{ExplorerConsensusConsensusClientCopy.noDataAvailable[cs ? 'cs' : 'en']}</p>
      </div>
    );
  }

  const W = 800, H = 240;
  const PAD = { top: 16, right: 16, bottom: 28, left: 60 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  // Pad range for bands
  const yMin = min - range * 0.15;
  const yMax = max + range * 0.15;
  const yRange = yMax - yMin || 1;

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const upperBand = mean * 1.2;
  const lowerBand = mean * 0.8;

  const xFor = (i: number) => PAD.left + (i / Math.max(values.length - 1, 1)) * chartW;
  const yFor = (v: number) => PAD.top + chartH - ((v - yMin) / yRange) * chartH;

  const pathD = values.map((v, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(v)}`).join(" ");
  const areaD = `${pathD} L ${xFor(values.length - 1)} ${PAD.top + chartH} L ${xFor(0)} ${PAD.top + chartH} Z`;

  // Detect adjustment points (>5% change from previous)
  const adjustmentIdx: number[] = [];
  for (let i = 1; i < values.length; i++) {
    const pct = Math.abs(values[i] - values[i - 1]) / (values[i - 1] || 1);
    if (pct > 0.05) adjustmentIdx.push(i);
  }

  const yLabels = [0, 0.25, 0.5, 0.75, 1].map((pct) => ({
    value: yMin + pct * yRange,
    y: PAD.top + chartH - pct * chartH,
  }));

  const fmtSI = (v: number) => {
    if (v >= 1e9) return (v / 1e9).toFixed(2) + "G";
    if (v >= 1e6) return (v / 1e6).toFixed(2) + "M";
    if (v >= 1e3) return (v / 1e3).toFixed(1) + "K";
    return v.toFixed(0);
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-56" preserveAspectRatio="none">
      <defs>
        <linearGradient id="diffAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a855f7" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#a855f7" stopOpacity="0.01" />
        </linearGradient>
      </defs>
      {/* Grid */}
      {yLabels.map((yl, i) => (
        <g key={i}>
          <line x1={PAD.left} x2={W - PAD.right} y1={yl.y} y2={yl.y} stroke="rgba(255,255,255,0.05)" strokeDasharray="4" />
          <text x={PAD.left - 6} y={yl.y + 3} textAnchor="end" fill="rgba(255,255,255,0.2)" fontSize="7.5" fontFamily="monospace">
            {fmtSI(yl.value)}
          </text>
        </g>
      ))}
      {/* LWMA bands */}
      <line x1={PAD.left} x2={W - PAD.right} y1={yFor(upperBand)} y2={yFor(upperBand)} stroke="rgba(228, 30, 43,0.3)" strokeWidth="1" strokeDasharray="6 3" />
      <line x1={PAD.left} x2={W - PAD.right} y1={yFor(lowerBand)} y2={yFor(lowerBand)} stroke="rgba(6, 105, 40,0.3)" strokeWidth="1" strokeDasharray="6 3" />
      <line x1={PAD.left} x2={W - PAD.right} y1={yFor(mean)} y2={yFor(mean)} stroke="rgba(255,255,255,0.12)" strokeWidth="0.8" strokeDasharray="2 2" />
      {/* Band labels */}
      <text x={W - PAD.right - 4} y={yFor(upperBand) - 3} textAnchor="end" fill="rgba(228, 30, 43,0.5)" fontSize="7" fontFamily="monospace">+20%</text>
      <text x={W - PAD.right - 4} y={yFor(lowerBand) + 9} textAnchor="end" fill="rgba(6, 105, 40,0.5)" fontSize="7" fontFamily="monospace">-20%</text>
      {/* Area + line */}
      <path d={areaD} fill="url(#diffAreaGrad)" />
      <path d={pathD} fill="none" stroke="#a855f7" strokeWidth="1.8" strokeLinejoin="round" opacity="0.9" />
      {/* Adjustment dots */}
      {adjustmentIdx.map((i) => (
        <circle key={i} cx={xFor(i)} cy={yFor(values[i])} r="3" fill="#ef4444" stroke="rgba(0,0,0,0.6)" strokeWidth="1.5" opacity="0.85" />
      ))}
      {/* Hover */}
      {values.map((v, i) => (
        <g key={i}>
          <rect
            x={xFor(i) - chartW / values.length / 2}
            y={PAD.top}
            width={chartW / values.length}
            height={chartH}
            fill="transparent"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          />
          {hovered === i && (
            <>
              <line x1={xFor(i)} x2={xFor(i)} y1={PAD.top} y2={PAD.top + chartH} stroke="rgba(255,255,255,0.1)" strokeDasharray="2" />
              <circle cx={xFor(i)} cy={yFor(v)} r="3.5" fill="#a855f7" stroke="rgba(0,0,0,0.6)" strokeWidth="1.5" />
              <rect x={Math.min(xFor(i) - 44, W - 96)} y={Math.max(yFor(v) - 28, 2)} width="88" height="20" rx="6" fill="rgba(0,0,0,0.85)" stroke="#a855f7" strokeWidth="0.5" />
              <text x={Math.min(xFor(i), W - 52)} y={Math.max(yFor(v) - 14, 14)} textAnchor="middle" fill="white" fontSize="7.5" fontWeight="600" fontFamily="monospace">
                {fmtSI(v)}
              </text>
            </>
          )}
        </g>
      ))}
      {/* X-axis date labels (first, middle, last) */}
      {[0, Math.floor(values.length / 2), values.length - 1]
        .filter((idx, i, arr) => arr.indexOf(idx) === i && idx >= 0 && idx < labels.length)
        .map((idx) => (
          <text
            key={`xl-${idx}`}
            x={xFor(idx)}
            y={H - 8}
            textAnchor="middle"
            fill="rgba(255,255,255,0.25)"
            fontSize="7"
            fontFamily="monospace"
          >
            {labels[idx] ? new Date(labels[idx]).toLocaleDateString(ExplorerConsensusConsensusClientCopy.enUs[cs ? 'cs' : 'en'], { month: "short", day: "numeric" }) : ""}
          </text>
        ))}
    </svg>
  );
}

export default function ConsensusClient() {
  const { lang } = useLang();
  const cs = lang === "cs";

  const [consensus, setConsensus] = useState<ExplorerConsensus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchConsensus = useCallback(async () => {
    try {
      const result = await apiClient<ExplorerConsensus>("/blockchain/consensus?range=7d");
      setConsensus(result);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConsensus();
  }, [fetchConsensus]);
  usePolling(fetchConsensus, 30_000);

  const sections = [
    {
      icon: Clock,
      title: ExplorerConsensusConsensusClientCopy.lwmaDaa[cs ? 'cs' : 'en'],
      color: "text-zion-cyan",
      content: ExplorerConsensusConsensusClientCopy.zionUsesTheLinearlyWeightedMov[cs ? 'cs' : 'en'],
    },
    {
      icon: TrendingDown,
      title: ExplorerConsensusConsensusClientCopy.decadeDecay[cs ? 'cs' : 'en'],
      color: "text-zion-gold",
      content: ExplorerConsensusConsensusClientCopy.zionEmissionIsNotAHalvingItSDe[cs ? 'cs' : 'en'],
    },
    {
      icon: Pickaxe,
      title: ExplorerConsensusConsensusClientCopy.powAlgorithms[cs ? 'cs' : 'en'],
      color: "text-zion-cyan",
      content: ExplorerConsensusConsensusClientCopy.zionSupportsThreeAlgorithmsDee[cs ? 'cs' : 'en'],
    },
    {
      icon: Heart,
      title: ExplorerConsensusConsensusClientCopy.k89551RewardSplit[cs ? 'cs' : 'en'],
      color: "text-zion-purple",
      content: ExplorerConsensusConsensusClientCopy.everyCoinbaseBlockSplitsTheRew[cs ? 'cs' : 'en'],
    },
    {
      icon: Shield,
      title: ExplorerConsensusConsensusClientCopy.securityValidation[cs ? 'cs' : 'en'],
      color: "text-zion-purple",
      content: ExplorerConsensusConsensusClientCopy.utxoModelWithRingSignaturesEve[cs ? 'cs' : 'en'],
    },
  ];

  const decades = consensus?.consensus?.decades ?? [
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

  return (
    <div className="relative min-h-screen pb-24 overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full blur-[200px] bg-zion-purple/8" />
        <div className="absolute -right-40 top-2/3 h-[400px] w-[400px] rounded-full blur-[200px] bg-zion-cyan/6" />
      </div>

      <div className="relative z-10 zion-container max-w-5xl space-y-14 pt-6">
        {/* HERO */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          className="zion-rainbow-card rounded-3xl md:rounded-4xl bg-black/60 p-6 md:p-10 shadow-[0_30px_120px_rgba(0,0,0,0.45)]" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-zion-purple/40 bg-zion-purple/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-purple uppercase">
              <Cpu className="h-4 w-4" />
              {ExplorerConsensusConsensusClientCopy.protocol[cs ? 'cs' : 'en']}
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-gray-400">{ExplorerConsensusConsensusClientCopy.terranovaConsensus[cs ? 'cs' : 'en']}</p>
              <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-gradient leading-tight">
                {ExplorerConsensusConsensusClientCopy.consensusEconomics[cs ? 'cs' : 'en']}
              </h1>
            </div>
            <p className="text-lg text-gray-300 max-w-2xl">
              {ExplorerConsensusConsensusClientCopy.overviewOfAlgorithmsEmissionAn[cs ? 'cs' : 'en']}
            </p>

            {consensus?.network && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="rounded-xl border border-white/5 bg-black/20 p-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500">{cs ? 'Výška' : 'Height'}</p>
                  <p className="text-lg font-semibold text-white tabular-nums">{formatNumber(consensus.network.chain_height)}</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-black/20 p-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500">{cs ? 'Obtížnost' : 'Difficulty'}</p>
                  <p className="text-lg font-semibold text-zion-gold tabular-nums">{formatNumber(consensus.network.current_difficulty)}</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-black/20 p-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500">{cs ? 'Cíl bloku' : 'Target block'}</p>
                  <p className="text-lg font-semibold text-zion-cyan tabular-nums">{consensus.consensus?.target_block_time ?? 60}s</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-black/20 p-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500">{cs ? 'Max supply' : 'Max supply'}</p>
                  <p className="text-lg font-semibold text-white tabular-nums">{formatNumber(consensus.consensus?.max_supply ?? 144_000_000_000)}</p>
                </div>
              </div>
            )}
          </div>
        </motion.section>

        {/* DIFFICULTY CHART */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
          className="zion-section p-6 md:p-10">
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Graf' : 'Chart'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Gauge className="h-7 w-7 text-zion-purple" />
              {cs ? 'Obtížnost (7 dní)' : 'Difficulty (7 days)'}
            </h2>
          </div>
          <DifficultyChart chart={consensus?.difficulty_chart ?? null} cs={cs} loading={loading} />
        </motion.section>

        {/* INFO CARDS */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{ExplorerConsensusConsensusClientCopy.details[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Shield className="h-7 w-7 text-zion-purple" />
              {ExplorerConsensusConsensusClientCopy.protocolParameters[cs ? 'cs' : 'en']}
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {sections.map((s) => (
              <div key={s.title} className="zion-rainbow-sub p-6" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                <div className="flex items-center gap-2 mb-3">
                  <s.icon className={`h-5 w-5 ${s.color}`} />
                  <h3 className="text-base font-semibold text-white">{s.title}</h3>
                </div>
                <p className="text-sm text-gray-400 leading-relaxed">{s.content}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* DECADE TABLE */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="zion-section p-6 md:p-10">
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{ExplorerConsensusConsensusClientCopy.emission[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Flame className="h-7 w-7 text-zion-gold" />
              {ExplorerConsensusConsensusClientCopy.decadeDecaySchedule[cs ? 'cs' : 'en']}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/6">
                  <th className="text-left text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-6 py-3">{ExplorerConsensusConsensusClientCopy.decade[cs ? 'cs' : 'en']}</th>
                  <th className="text-left text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-3 py-3">{ExplorerConsensusConsensusClientCopy.rewardBlock[cs ? 'cs' : 'en']}</th>
                  <th className="text-left text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-3 py-3">{ExplorerConsensusConsensusClientCopy.blocks[cs ? 'cs' : 'en']}</th>
                  <th className="text-right text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium px-6 py-3">{ExplorerConsensusConsensusClientCopy.share[cs ? 'cs' : 'en']}</th>
                </tr>
              </thead>
              <tbody>
                {decades.map((d) => (
                  <tr key={d.index} className="border-b border-white/3 hover:bg-white/3 transition-colors">
                    <td className="px-6 py-3 text-white font-semibold">{d.index === 10 ? "Tail ∞" : `Decade ${d.index}`}</td>
                    <td className="px-3 py-3 text-zion-gold font-mono">{d.reward.toFixed(3)} ZION</td>
                    <td className="px-3 py-3 text-gray-400 font-mono">{d.blocks > 0 ? d.blocks.toLocaleString() : "∞"}</td>
                    <td className="px-6 py-3 text-right text-gray-400">{d.pct}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.section>

        <p className="text-center text-xs text-gray-600">
          {ExplorerConsensusConsensusClientCopy.zionTerranovaConsensusProtocol[cs ? 'cs' : 'en']}
        </p>
      </div>
    </div>
  );
}
