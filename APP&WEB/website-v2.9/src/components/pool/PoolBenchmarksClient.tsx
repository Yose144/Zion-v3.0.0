'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Cpu,
  Gauge,
  Zap,
  TrendingUp,
  Server,
  Filter,
  ArrowUpDown,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Calculator,
  Info,
  Download,
  Activity,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

/* ═══════════════════════════════════════════════════════════
   ZION POOL · HARDWARE BENCHMARKS
   GPU & CPU performance results for Cosmic Harmony PoW
   ═══════════════════════════════════════════════════════════ */

const RC = '147, 51, 234'; // purple for pool
const rcStyle = { '--rc': RC } as React.CSSProperties;

/* ─── Types ─────────────────────────────────────────────────── */

type Algo = 'deeksha_lite_v1' | 'deeksha_lite_fire' | 'ekam_deeksha_v2';
type HwType = 'GPU' | 'CPU';

interface BenchRow {
  id: string;
  hardware: string;
  type: HwType;
  algorithm: Algo;
  hashrate: number; // KH/s
  power: number; // W
  memory: string;
  arch: string;
  backend: string;
  measured: boolean; // true = measured, false = estimated
  notes: { cs: string; en: string };
}

/* ─── Static benchmark data ─────────────────────────────────── */
/* Based on AGENTS.md benchmarks (RX 5700 XT measured) + estimates */

const BENCH_DATA: BenchRow[] = [
  {
    id: 'rx5700xt-fire',
    hardware: 'AMD RX 5700 XT',
    type: 'GPU',
    algorithm: 'deeksha_lite_fire',
    hashrate: 18.16,
    power: 180,
    memory: '8 GB GDDR6',
    arch: 'RDNA1 (gfx1010)',
    backend: 'OpenCL',
    measured: true,
    notes: {
      cs: 'Měřeno po RDNA1 fix (commit cc50d1b4). Fire mód: 512 KiB scratchpad, vyšší příkon.',
      en: 'Measured after RDNA1 fix (commit cc50d1b4). Fire mode: 512 KiB scratchpad, higher power draw.',
    },
  },
  {
    id: 'rx5700xt-v1',
    hardware: 'AMD RX 5700 XT',
    type: 'GPU',
    algorithm: 'deeksha_lite_v1',
    hashrate: 9.70,
    power: 180,
    memory: '8 GB GDDR6',
    arch: 'RDNA1 (gfx1010)',
    backend: 'OpenCL',
    measured: true,
    notes: {
      cs: 'Měřeno po RDNA1 fix. Standardní 256 KiB scratchpad, 4 průchody.',
      en: 'Measured after RDNA1 fix. Standard 256 KiB scratchpad, 4 passes.',
    },
  },
  {
    id: 'rtx4090-v1',
    hardware: 'NVIDIA RTX 4090',
    type: 'GPU',
    algorithm: 'deeksha_lite_v1',
    hashrate: 45,
    power: 450,
    memory: '24 GB GDDR6X',
    arch: 'Ada Lovelace (SM 8.9)',
    backend: 'CUDA',
    measured: false,
    notes: {
      cs: 'Odhad na základě škálování oproti RTX 3090 a H100. TPB=24, wc=262144.',
      en: 'Estimated based on scaling vs RTX 3090 and H100. TPB=24, wc=262144.',
    },
  },
  {
    id: 'rtx3090-v1',
    hardware: 'NVIDIA RTX 3090',
    type: 'GPU',
    algorithm: 'deeksha_lite_v1',
    hashrate: 30,
    power: 350,
    memory: '24 GB GDDR6X',
    arch: 'Ampere (SM 8.6)',
    backend: 'CUDA',
    measured: false,
    notes: {
      cs: 'Odhad ~1.5× RTX 3060 (16.5 KH/s). TPB=24, wc=4096.',
      en: 'Estimated ~1.5× RTX 3060 (16.5 KH/s). TPB=24, wc=4096.',
    },
  },
  {
    id: 'rx6900xt-v1',
    hardware: 'AMD RX 6900 XT',
    type: 'GPU',
    algorithm: 'deeksha_lite_v1',
    hashrate: 25,
    power: 300,
    memory: '16 GB GDDR6',
    arch: 'RDNA2 (gfx1030)',
    backend: 'OpenCL',
    measured: false,
    notes: {
      cs: 'Odhad ~2.5× RX 5700 XT v1. RDNA2 má větší L2 cache.',
      en: 'Estimated ~2.5× RX 5700 XT v1. RDNA2 has larger L2 cache.',
    },
  },
  {
    id: 'rx580-v1',
    hardware: 'AMD RX 580',
    type: 'GPU',
    algorithm: 'deeksha_lite_v1',
    hashrate: 5,
    power: 185,
    memory: '8 GB GDDR5',
    arch: 'Polaris (GCN 4.0)',
    backend: 'OpenCL',
    measured: false,
    notes: {
      cs: 'Odhad. Starší GCN architektura, nižší L2 cache.',
      en: 'Estimated. Older GCN architecture, smaller L2 cache.',
    },
  },
  {
    id: 'ryzen7950x-v1',
    hardware: 'Ryzen 9 7950X',
    type: 'CPU',
    algorithm: 'deeksha_lite_v1',
    hashrate: 2,
    power: 65,
    memory: '64 MB L3',
    arch: 'Zen 4 (16C/32T)',
    backend: 'CPU',
    measured: false,
    notes: {
      cs: 'Odhad. 16 jader, velký L3 cache. TDP 65W (base), ~105W boost.',
      en: 'Estimated. 16 cores, large L3 cache. TDP 65W (base), ~105W boost.',
    },
  },
  {
    id: 'ryzen5950x-v1',
    hardware: 'Ryzen 9 5950X',
    type: 'CPU',
    algorithm: 'deeksha_lite_v1',
    hashrate: 1.5,
    power: 65,
    memory: '64 MB L3',
    arch: 'Zen 3 (16C/32T)',
    backend: 'CPU',
    measured: false,
    notes: {
      cs: 'Odhad. 16 jader Zen 3, dobrý poměr výkon/příkon.',
      en: 'Estimated. 16 cores Zen 3, good performance/power ratio.',
    },
  },
  {
    id: 'i9-13900k-v1',
    hardware: 'Intel i9-13900K',
    type: 'CPU',
    algorithm: 'deeksha_lite_v1',
    hashrate: 1.8,
    power: 65,
    memory: '36 MB L3',
    arch: 'Raptor Lake (24C/32T)',
    backend: 'CPU',
    measured: false,
    notes: {
      cs: 'Odhad. 8P+16E jader. Hybridní architektura, P-cores dominantní.',
      en: 'Estimated. 8P+16E cores. Hybrid architecture, P-cores dominant.',
    },
  },
  {
    id: 'm2max-v1',
    hardware: 'Apple M2 Max',
    type: 'CPU',
    algorithm: 'deeksha_lite_v1',
    hashrate: 1.2,
    power: 30,
    memory: '48 MB L2',
    arch: 'Apple Silicon (12C)',
    backend: 'Metal',
    measured: false,
    notes: {
      cs: 'Odhad. Vynikající efektivita (30W). Metal backend.',
      en: 'Estimated. Excellent efficiency (30W). Metal backend.',
    },
  },
  {
    id: 'threadripper3990x-v1',
    hardware: 'Threadripper 3990X',
    type: 'CPU',
    algorithm: 'deeksha_lite_v1',
    hashrate: 3,
    power: 280,
    memory: '256 MB L3',
    arch: 'Zen 2 (64C/128T)',
    backend: 'CPU',
    measured: false,
    notes: {
      cs: 'Odhad. 64 jader, obrovský L3 cache, ale vysoký příkon 280W.',
      en: 'Estimated. 64 cores, huge L3 cache, but high 280W power draw.',
    },
  },
];

/* ─── Algorithm labels ──────────────────────────────────────── */

const ALGO_LABELS: Record<Algo, { cs: string; en: string }> = {
  deeksha_lite_v1: { cs: 'Deeksha Lite v1', en: 'Deeksha Lite v1' },
  deeksha_lite_fire: { cs: 'Deeksha Lite Fire', en: 'Deeksha Lite Fire' },
  ekam_deeksha_v2: { cs: 'Ekam Deeksha v2', en: 'Ekam Deeksha v2' },
};

type SortKey = 'hashrate' | 'efficiency' | 'profitability';
type AlgoFilter = Algo | 'all';
type HwFilter = 'all' | HwType;

/* ─── Pool stats fetch ──────────────────────────────────────── */

interface PoolStats {
  poolHashrate: number; // H/s
  blocksPerDay: number;
  rewardPerBlock: number; // ZION
  minerShare: number; // 0-100
}

function estimateBlocksPerDay(recent: { timestamp: number }[]): number {
  if (recent.length < 2) return 1440;
  const sorted = [...recent].sort((a, b) => b.timestamp - a.timestamp);
  const span = Math.max(1, sorted[0].timestamp - sorted[sorted.length - 1].timestamp);
  const intervals = Math.max(1, sorted.length - 1);
  return Math.max(1, Math.min(10000, 86400 / (span / intervals)));
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */

export default function PoolBenchmarksClient() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  const [algoFilter, setAlgoFilter] = useState<AlgoFilter>('all');
  const [hwFilter, setHwFilter] = useState<HwFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('hashrate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Profitability calculator inputs
  const [elecCost, setElecCost] = useState(0.12); // $/kWh
  const [zionPrice, setZionPrice] = useState(0.50); // $/ZION

  // Pool stats
  const [poolStats, setPoolStats] = useState<PoolStats>({
    poolHashrate: 50000, // fallback 50 KH/s
    blocksPerDay: 1440,
    rewardPerBlock: 5400,
    minerShare: 89,
  });

  const fetchPoolStats = useCallback(async () => {
    try {
      const res = await fetch('/api/pool/stats', { cache: 'no-store' });
      const json = await res.json();
      if (json.ok) {
        const hr = json.aggregate?.hashrate ?? 50000;
        const reward = json.recent_blocks?.[0]?.reward
          ? json.recent_blocks[0].reward / 1e6
          : 5400;
        const bpd = estimateBlocksPerDay(json.recent_blocks ?? []);
        const ms = json.fee?.miner_share ?? 89;
        setPoolStats({
          poolHashrate: hr,
          blocksPerDay: bpd,
          rewardPerBlock: reward,
          minerShare: ms,
        });
      }
    } catch {
      /* silent — keep fallback */
    }
  }, []);

  useEffect(() => {
    fetchPoolStats();
    const id = setInterval(fetchPoolStats, 30_000);
    return () => clearInterval(id);
  }, [fetchPoolStats]);

  /* ─── Derived calculations ──────────────────────────────────── */

  // hashrate is in KH/s; pool hashrate is in H/s → convert
  const computeZionPerDay = useCallback(
    (row: BenchRow): number => {
      const hwHashHs = row.hashrate * 1000; // KH/s → H/s
      if (poolStats.poolHashrate <= 0) return 0;
      const share = hwHashHs / poolStats.poolHashrate;
      return share * poolStats.blocksPerDay * poolStats.rewardPerBlock * (poolStats.minerShare / 100);
    },
    [poolStats],
  );

  const computeUsdPerDay = useCallback(
    (row: BenchRow): number => {
      const zion = computeZionPerDay(row);
      const elecPerDay = (row.power / 1000) * 24 * elecCost;
      return zion * zionPrice - elecPerDay;
    },
    [computeZionPerDay, elecCost, zionPrice],
  );

  const efficiency = (row: BenchRow): number => row.power > 0 ? row.hashrate / row.power : 0; // KH/s per W

  /* ─── Filtering + sorting ──────────────────────────────────── */

  const filteredRows = useMemo(() => {
    let rows = BENCH_DATA.filter((r) => {
      if (algoFilter !== 'all' && r.algorithm !== algoFilter) return false;
      if (hwFilter !== 'all' && r.type !== hwFilter) return false;
      return true;
    });
    rows = [...rows].sort((a, b) => {
      let av: number, bv: number;
      if (sortKey === 'hashrate') { av = a.hashrate; bv = b.hashrate; }
      else if (sortKey === 'efficiency') { av = efficiency(a); bv = efficiency(b); }
      else { av = computeUsdPerDay(a); bv = computeUsdPerDay(b); }
      return sortDir === 'desc' ? bv - av : av - bv;
    });
    return rows;
  }, [algoFilter, hwFilter, sortKey, sortDir, computeUsdPerDay]);

  /* ─── Summary stats ────────────────────────────────────────── */

  const summary = useMemo(() => {
    const gpus = BENCH_DATA.filter((r) => r.type === 'GPU');
    const cpus = BENCH_DATA.filter((r) => r.type === 'CPU');
    const bestGpu = gpus.reduce((m, r) => (r.hashrate > m.hashrate ? r : m), gpus[0]);
    const bestCpu = cpus.reduce((m, r) => (r.hashrate > m.hashrate ? r : m), cpus[0]);
    const mostEff = BENCH_DATA.reduce((m, r) => (efficiency(r) > efficiency(m) ? r : m), BENCH_DATA[0]);
    return {
      bestGpu,
      bestCpu,
      mostEff,
      total: BENCH_DATA.length,
    };
  }, []);

  /* ─── Sort handler ─────────────────────────────────────────── */

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  /* ─── Chart data ───────────────────────────────────────────── */

  const chartRows = useMemo(() => {
    return [...BENCH_DATA].sort((a, b) => efficiency(b) - efficiency(a));
  }, []);

  const hashrateChartRows = useMemo(() => {
    return [...BENCH_DATA].sort((a, b) => b.hashrate - a.hashrate);
  }, []);

  const maxEff = Math.max(...BENCH_DATA.map(efficiency));
  const maxHash = Math.max(...BENCH_DATA.map((r) => r.hashrate));

  const effColor = (eff: number): string => {
    const ratio = eff / maxEff;
    if (ratio > 0.66) return '#10b981'; // emerald
    if (ratio > 0.33) return '#f59e0b'; // amber
    return '#ef4444'; // red
  };

  /* ═══════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════ */

  return (
    <div className="zion-shell min-h-screen pt-28 md:pt-32 pb-24">
      <div className="zion-container max-w-7xl space-y-10">

        {/* ── A. HERO ─────────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="zion-rainbow-card p-8 md:p-10"
          style={rcStyle}
        >
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="w-14 h-14 rounded-2xl bg-purple-500/15 flex items-center justify-center shrink-0">
              <Gauge className="w-7 h-7 text-purple-400" />
            </div>
            <div className="flex-1">
              <div className="zion-kicker mb-3" style={{ borderColor: 'rgba(147,51,234,0.3)' }}>
                <Cpu className="w-3.5 h-3.5 text-purple-400" />
                {cs ? 'Cosmic Harmony PoW' : 'Cosmic Harmony PoW'}
              </div>
              <h1 className="text-3xl md:text-5xl font-bold text-white mb-2">
                {cs ? 'Hardwarové Benchmarky' : 'Hardware Benchmarks'}
              </h1>
              <p className="text-gray-400 text-base md:text-lg max-w-2xl">
                {cs
                  ? 'Cosmic Harmony PoW — výsledky GPU a CPU výkonu. Hashrate, energetická efektivita a porovnání ziskovosti.'
                  : 'Cosmic Harmony PoW — GPU & CPU performance results. Hashrate, power efficiency, and profitability comparison.'}
              </p>
            </div>
            <Link
              href="/pool"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-purple-400/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 transition-colors text-sm font-medium shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              {cs ? 'Zpět na Pool' : 'Back to Pool'}
            </Link>
          </div>
        </motion.section>

        {/* ── B. FILTER BAR ───────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="zion-rainbow-sub p-5 md:p-6"
          style={rcStyle}
        >
          <div className="flex items-center gap-2 mb-4 text-purple-300">
            <Filter className="w-4 h-4" />
            <span className="text-sm font-semibold uppercase tracking-wider">
              {cs ? 'Filtry a řazení' : 'Filters & Sorting'}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Algorithm filter */}
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">
                {cs ? 'Algoritmus' : 'Algorithm'}
              </label>
              <select
                value={algoFilter}
                onChange={(e) => setAlgoFilter(e.target.value as AlgoFilter)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-purple-400/50 focus:outline-none transition-colors"
              >
                <option value="all">{cs ? 'Všechny' : 'All'}</option>
                <option value="deeksha_lite_v1">Deeksha Lite v1</option>
                <option value="deeksha_lite_fire">Deeksha Lite Fire</option>
                <option value="ekam_deeksha_v2">Ekam Deeksha v2</option>
              </select>
            </div>
            {/* Hardware type filter */}
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">
                {cs ? 'Typ hardwaru' : 'Hardware Type'}
              </label>
              <select
                value={hwFilter}
                onChange={(e) => setHwFilter(e.target.value as HwFilter)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-purple-400/50 focus:outline-none transition-colors"
              >
                <option value="all">{cs ? 'Vše' : 'All'}</option>
                <option value="GPU">GPU</option>
                <option value="CPU">CPU</option>
              </select>
            </div>
            {/* Sort by */}
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">
                {cs ? 'Řadit podle' : 'Sort By'}
              </label>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-purple-400/50 focus:outline-none transition-colors"
              >
                <option value="hashrate">{cs ? 'Hashrate' : 'Hashrate'}</option>
                <option value="efficiency">{cs ? 'Efektivita (H/W)' : 'Efficiency (H/W)'}</option>
                <option value="profitability">{cs ? 'Ziskovost ($/den)' : 'Profitability ($/day)'}</option>
              </select>
            </div>
          </div>
        </motion.section>

        {/* ── C. SUMMARY STATS ────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <SummaryCard
            icon={<TrendingUp className="w-5 h-5 text-emerald-400" />}
            label={cs ? 'Nejlepší GPU hashrate' : 'Best GPU hashrate'}
            value={`${summary.bestGpu.hashrate} KH/s`}
            sub={summary.bestGpu.hardware}
            rc={rcStyle}
          />
          <SummaryCard
            icon={<Cpu className="w-5 h-5 text-cyan-400" />}
            label={cs ? 'Nejlepší CPU hashrate' : 'Best CPU hashrate'}
            value={`${summary.bestCpu.hashrate} KH/s`}
            sub={summary.bestCpu.hardware}
            rc={rcStyle}
          />
          <SummaryCard
            icon={<Zap className="w-5 h-5 text-amber-400" />}
            label={cs ? 'Nejefektivnější (H/W)' : 'Most efficient (H/W)'}
            value={`${efficiency(summary.mostEff).toFixed(2)} KH/W`}
            sub={summary.mostEff.hardware}
            rc={rcStyle}
          />
          <SummaryCard
            icon={<Server className="w-5 h-5 text-purple-400" />}
            label={cs ? 'Celkem benchmarků' : 'Total benchmarks'}
            value={`${summary.total}`}
            sub={cs ? 'GPU + CPU záznamů' : 'GPU + CPU entries'}
            rc={rcStyle}
          />
        </motion.section>

        {/* ── D. MAIN BENCHMARK TABLE ──────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="zion-rainbow-card overflow-hidden"
          style={rcStyle}
        >
          <div className="p-5 border-b border-white/10 flex items-center gap-2">
            <Activity className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">
              {cs ? 'Hlavní tabulka benchmarků' : 'Main Benchmark Table'}
            </h2>
            <span className="ml-auto text-xs text-gray-500">
              {filteredRows.length} {cs ? 'záznamů' : 'entries'}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-white/50 text-xs uppercase tracking-wider">
                  <th className="px-4 py-3">{cs ? 'Hardware' : 'Hardware'}</th>
                  <th className="px-4 py-3">{cs ? 'Typ' : 'Type'}</th>
                  <th className="px-4 py-3">{cs ? 'Algoritmus' : 'Algorithm'}</th>
                  <SortHeader label={cs ? 'Hashrate' : 'Hashrate'} active={sortKey === 'hashrate'} dir={sortDir} onClick={() => handleSort('hashrate')} align="right" />
                  <th className="px-4 py-3 text-right">{cs ? 'Příkon (W)' : 'Power (W)'}</th>
                  <SortHeader label={cs ? 'Efektivita (H/W)' : 'Efficiency (H/W)'} active={sortKey === 'efficiency'} dir={sortDir} onClick={() => handleSort('efficiency')} align="right" />
                  <th className="px-4 py-3">{cs ? 'Paměť' : 'Memory'}</th>
                  <th className="px-4 py-3 text-right">{cs ? 'Est. ZION/den' : 'Est. ZION/day'}</th>
                  <SortHeader label={cs ? 'Est. $/den' : 'Est. $/day'} active={sortKey === 'profitability'} dir={sortDir} onClick={() => handleSort('profitability')} align="right" />
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const zionDay = computeZionPerDay(row);
                  const usdDay = computeUsdPerDay(row);
                  const expanded = expandedRow === row.id;
                  return (
                    <React.Fragment key={row.id}>
                      <tr
                        className={`border-b border-white/5 hover:bg-white/[0.03] transition-colors cursor-pointer ${
                          expanded ? 'bg-purple-500/[0.06]' : ''
                        }`}
                        onClick={() => setExpandedRow(expanded ? null : row.id)}
                      >
                        <td className="px-4 py-3 font-medium text-white whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {row.measured ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" title={cs ? 'Měřeno' : 'Measured'} />
                            ) : (
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400/60 shrink-0" title={cs ? 'Odhad' : 'Estimated'} />
                            )}
                            {row.hardware}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            row.type === 'GPU' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-cyan-500/15 text-cyan-300'
                          }`}>
                            {row.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white/60 whitespace-nowrap text-xs">
                          {ALGO_LABELS[row.algorithm][cs ? 'cs' : 'en']}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-purple-300 text-base">
                          {row.hashrate} <span className="text-xs text-purple-400/60 font-normal">KH/s</span>
                        </td>
                        <td className="px-4 py-3 text-right text-white/60">{row.power}</td>
                        <td className="px-4 py-3 text-right font-semibold text-amber-300">
                          {efficiency(row).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-white/50 whitespace-nowrap text-xs">{row.memory}</td>
                        <td className="px-4 py-3 text-right text-white/70 font-mono text-xs">
                          {zionDay >= 0.001 ? zionDay.toFixed(4) : zionDay.toExponential(2)}
                        </td>
                        <td className={`px-4 py-3 text-right font-semibold font-mono text-xs ${usdDay >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {usdDay >= 0 ? '+' : ''}{usdDay.toFixed(4)}
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="bg-black/30">
                          <td colSpan={9} className="px-4 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                              <div>
                                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">{cs ? 'Architektura' : 'Architecture'}</div>
                                <div className="text-white/80">{row.arch}</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">{cs ? 'Backend' : 'Backend'}</div>
                                <div className="text-white/80">{row.backend}</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">{cs ? 'Status' : 'Status'}</div>
                                <div className={row.measured ? 'text-emerald-400' : 'text-amber-400'}>
                                  {row.measured ? (cs ? 'Měřeno' : 'Measured') : (cs ? 'Odhad' : 'Estimated')}
                                </div>
                              </div>
                              <div className="md:col-span-3">
                                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">{cs ? 'Poznámka' : 'Notes'}</div>
                                <div className="text-white/60 leading-relaxed">{row.notes[cs ? 'cs' : 'en']}</div>
                              </div>
                              <div className="md:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-white/5">
                                <MiniStat label={cs ? 'Hashrate' : 'Hashrate'} value={`${row.hashrate} KH/s`} />
                                <MiniStat label={cs ? 'Příkon' : 'Power'} value={`${row.power} W`} />
                                <MiniStat label={cs ? 'Efektivita' : 'Efficiency'} value={`${efficiency(row).toFixed(2)} KH/W`} />
                                <MiniStat label={cs ? 'Energie/den' : 'Energy/day'} value={`${((row.power / 1000) * 24).toFixed(2)} kWh`} />
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                      {cs ? 'Žádné záznamy pro vybrané filtry.' : 'No entries match the selected filters.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-white/5 text-xs text-gray-500 flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> {cs ? 'Měřeno' : 'Measured'}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400/60" /> {cs ? 'Odhad' : 'Estimated'}
            </span>
            <span className="ml-auto">
              {cs ? 'Klikněte na řádek pro detail.' : 'Click a row for details.'}
            </span>
          </div>
        </motion.section>

        {/* ── E. EFFICIENCY CHART ──────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="zion-rainbow-card p-6 md:p-8"
          style={rcStyle}
        >
          <div className="flex items-center gap-2 mb-6">
            <Zap className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-semibold text-white">
              {cs ? 'Graf efektivity (H/W)' : 'Efficiency Chart (H/W)'}
            </h2>
          </div>
          <div className="space-y-2.5">
            {chartRows.map((row) => {
              const eff = efficiency(row);
              const pct = (eff / maxEff) * 100;
              const color = effColor(eff);
              return (
                <div key={row.id} className="flex items-center gap-3">
                  <span className="w-36 text-xs text-white/60 text-right shrink-0 truncate" title={row.hardware}>
                    {row.hardware}
                  </span>
                  <div className="flex-1 h-6 bg-white/5 rounded-md overflow-hidden relative">
                    <div
                      className="h-full rounded-md transition-all duration-500"
                      style={{ width: `${Math.min(pct, 100)}%`, background: `linear-gradient(90deg, ${color}66, ${color})` }}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-mono text-white/80">
                      {eff.toFixed(2)}
                    </span>
                  </div>
                  <span className="w-10 text-xs text-white/40 shrink-0">KH/W</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500" /> {cs ? 'Nejlepší' : 'Best'}</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-500" /> {cs ? 'Průměrný' : 'Mid'}</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-500" /> {cs ? 'Nejhorší' : 'Worst'}</span>
          </div>
        </motion.section>

        {/* ── F. HASHRATE COMPARISON CHART ─────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="zion-rainbow-card p-6 md:p-8"
          style={rcStyle}
        >
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">
              {cs ? 'Porovnání hashrate' : 'Hashrate Comparison'}
            </h2>
          </div>
          <div className="space-y-2.5">
            {hashrateChartRows.map((row) => {
              const pct = (row.hashrate / maxHash) * 100;
              return (
                <div key={row.id} className="flex items-center gap-3">
                  <span className="w-36 text-xs text-white/60 text-right shrink-0 truncate" title={row.hardware}>
                    {row.hardware}
                  </span>
                  <div className="flex-1 h-6 bg-white/5 rounded-md overflow-hidden relative">
                    <div
                      className="h-full rounded-md transition-all duration-500"
                      style={{
                        width: `${Math.min(pct, 100)}%`,
                        background: 'linear-gradient(90deg, rgba(147,51,234,0.4), rgba(147,51,234,0.9))',
                      }}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-mono text-white/80">
                      {row.hashrate}
                    </span>
                  </div>
                  <span className="w-10 text-xs text-white/40 shrink-0">KH/s</span>
                </div>
              );
            })}
          </div>
        </motion.section>

        {/* ── G. PROFITABILITY CALCULATOR ──────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="zion-rainbow-sub p-6 md:p-8"
          style={rcStyle}
        >
          <div className="flex items-center gap-2 mb-5">
            <Calculator className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">
              {cs ? 'Kalkulačka ziskovosti' : 'Profitability Calculator'}
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">
                {cs ? 'Cena elektřiny ($/kWh)' : 'Electricity Cost ($/kWh)'}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={elecCost}
                onChange={(e) => setElecCost(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-purple-400/50 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">
                {cs ? 'Cena ZION ($)' : 'ZION Price ($)'}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={zionPrice}
                onChange={(e) => setZionPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-purple-400/50 focus:outline-none transition-colors"
              />
            </div>
          </div>
          <div className="text-xs text-gray-500 mb-4 flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-purple-400" />
            {cs ? 'Pool hashrate (live):' : 'Live pool hashrate:'}{' '}
            <span className="font-mono text-purple-300">
              {(poolStats.poolHashrate / 1000).toFixed(2)} KH/s
            </span>
            {' · '}
            {cs ? 'Bloky/den:' : 'Blocks/day:'}{' '}
            <span className="font-mono text-purple-300">{poolStats.blocksPerDay.toFixed(0)}</span>
            {' · '}
            {cs ? 'Odměna:' : 'Reward:'}{' '}
            <span className="font-mono text-purple-300">{poolStats.rewardPerBlock} ZION</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-white/50 text-xs uppercase tracking-wider">
                  <th className="px-3 py-2">{cs ? 'Hardware' : 'Hardware'}</th>
                  <th className="px-3 py-2 text-right">{cs ? 'ZION/den' : 'ZION/day'}</th>
                  <th className="px-3 py-2 text-right">{cs ? 'Elektřina/den' : 'Elec/day'}</th>
                  <th className="px-3 py-2 text-right">{cs ? 'Hrubý $/den' : 'Gross $/day'}</th>
                  <th className="px-3 py-2 text-right">{cs ? 'Čistý $/den' : 'Net $/day'}</th>
                </tr>
              </thead>
              <tbody>
                {BENCH_DATA.map((row) => {
                  const zion = computeZionPerDay(row);
                  const gross = zion * zionPrice;
                  const elec = (row.power / 1000) * 24 * elecCost;
                  const net = gross - elec;
                  return (
                    <tr key={row.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                      <td className="px-3 py-2 text-white/80 whitespace-nowrap">{row.hardware}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-white/60">
                        {zion >= 0.001 ? zion.toFixed(4) : zion.toExponential(2)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-red-400/70">-${elec.toFixed(3)}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-white/70">${gross.toFixed(3)}</td>
                      <td className={`px-3 py-2 text-right font-mono text-xs font-semibold ${net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {net >= 0 ? '+' : ''}{net.toFixed(3)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.section>

        {/* ── H. METHODOLOGY INFO ──────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="zion-section"
        >
          <div className="flex items-center gap-2 mb-5">
            <Info className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">
              {cs ? 'Metodika benchmarků' : 'Benchmark Methodology'}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="zion-tile">
              <h3 className="text-sm font-semibold text-purple-300 mb-2 flex items-center gap-2">
                <span className="font-mono text-xs bg-purple-500/15 px-2 py-0.5 rounded">--ekam-bench</span>
                {cs ? 'Benchmark nástroj' : 'Benchmark Tool'}
              </h3>
              <p className="text-sm text-white/60 leading-relaxed">
                {cs
                  ? 'Měření probíhá v režimu --ekam-bench (10sekundové měření, bez pool overhead). Miner commit: 9e307c4d. Výsledky představují horní mez — live stratum hashrate je nižší kvůli režii komunikace s pool.'
                  : 'Benchmarks run with --ekam-bench mode (10-second measurement, no pool overhead). Miner commit: 9e307c4d. Results represent an upper bound — live stratum hashrate is lower due to pool communication overhead.'}
              </p>
            </div>
            <div className="zion-tile">
              <h3 className="text-sm font-semibold text-purple-300 mb-2">
                {cs ? 'Stratum vs benchmark rozdíl' : 'Stratum vs Benchmark Difference'}
              </h3>
              <p className="text-sm text-white/60 leading-relaxed">
                {cs
                  ? 'Benchmark --ekam-bench používá work_size přímo, zatímco live stratum mining omezuje nonce batch size (ZION_NONCE_COUNT=4096 pro CPU, ZION_NONCE_COUNT_GPU=262144 pro GPU). To snižuje efektivní hashrate cca o 10–30 %.'
                  : 'The --ekam-bench benchmark uses work_size directly, while live stratum mining limits nonce batch size (ZION_NONCE_COUNT=4096 for CPU, ZION_NONCE_COUNT_GPU=262144 for GPU). This reduces effective hashrate by roughly 10–30%.'}
              </p>
            </div>
            <div className="zion-tile">
              <h3 className="text-sm font-semibold text-purple-300 mb-2">
                {cs ? 'GPU backendy' : 'GPU Backends'}
              </h3>
              <ul className="text-sm text-white/60 leading-relaxed space-y-1">
                <li>• <span className="font-mono text-purple-300/80">OpenCL</span> — {cs ? 'AMD GPU (RDNA1/RDNA2, GCN)' : 'AMD GPUs (RDNA1/RDNA2, GCN)'}</li>
                <li>• <span className="font-mono text-purple-300/80">CUDA</span> — {cs ? 'NVIDIA GPU (Pascal → Blackwell)' : 'NVIDIA GPUs (Pascal → Blackwell)'}</li>
                <li>• <span className="font-mono text-purple-300/80">Metal</span> — {cs ? 'Apple Silicon (M1/M2/M3)' : 'Apple Silicon (M1/M2/M3)'}</li>
              </ul>
            </div>
            <div className="zion-tile">
              <h3 className="text-sm font-semibold text-purple-300 mb-2">
                {cs ? 'Jak reprodukovat' : 'How to Reproduce'}
              </h3>
              <pre className="text-xs font-mono text-white/70 bg-black/40 rounded-lg p-3 overflow-x-auto leading-relaxed">
{`# Build with GPU support
cargo build --release -p zion-miner --features gpu-opencl

# Run benchmark
ZION_GPU_BACKEND=opencl \\
  cargo run --release -p zion-miner -- \\
  --ekam-bench --algorithm deeksha_lite_v1`}
              </pre>
            </div>
          </div>
        </motion.section>

        {/* ── I. CTA ──────────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="zion-cta-banner"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
            {cs ? 'Spusťte vlastní benchmark' : 'Run Your Own Benchmark'}
          </h2>
          <p className="text-white/70 mb-6 max-w-xl mx-auto">
            {cs
              ? 'Stáhněte si ZION miner, zkompilujte s GPU podporou a změřte svůj hardware v režimu --ekam-bench.'
              : 'Download the ZION miner, compile with GPU support, and measure your hardware in --ekam-bench mode.'}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/download"
              className="zion-button-primary"
            >
              <Download className="w-4 h-4" />
              {cs ? 'Stáhnout Miner' : 'Download Miner'}
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/pool"
              className="zion-button-secondary"
            >
              <ArrowLeft className="w-4 h-4" />
              {cs ? 'Zpět na Pool' : 'Back to Pool'}
            </Link>
          </div>
        </motion.section>

      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════ */

function SummaryCard({
  icon,
  label,
  value,
  sub,
  rc,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  rc: React.CSSProperties;
}) {
  return (
    <div className="zion-rainbow-sub p-5" style={rc}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-gray-400 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white mb-1">{value}</div>
      <div className="text-xs text-gray-500 truncate" title={sub}>{sub}</div>
    </div>
  );
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
  align,
}: {
  label: string;
  active: boolean;
  dir: 'asc' | 'desc';
  onClick: () => void;
  align: 'left' | 'right';
}) {
  return (
    <th className={`px-4 py-3 ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <button
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        className={`inline-flex items-center gap-1 hover:text-white transition-colors ${active ? 'text-purple-300' : ''}`}
      >
        {label}
        <ArrowUpDown className={`w-3 h-3 ${active ? 'opacity-100' : 'opacity-40'}`} />
        {active && (dir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}
      </button>
    </th>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">{label}</div>
      <div className="text-sm text-white/80 font-mono">{value}</div>
    </div>
  );
}
