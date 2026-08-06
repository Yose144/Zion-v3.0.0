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
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

const PoolBenchmarksCopy = {
  cosmicHarmonyPow: { cs: `Cosmic Harmony PoW`, en: `Cosmic Harmony PoW` },
  hardwareBenchmarks: { cs: `Hardwarové Benchmarky`, en: `Hardware Benchmarks` },
  cosmicHarmonyPowGpuCpuPerforma: { cs: `Cosmic Harmony PoW — výsledky GPU a CPU výkonu. Hashrate, energetická efektivita a porovnání ziskovosti.`, en: `Cosmic Harmony PoW — GPU & CPU performance results. Hashrate, power efficiency, and profitability comparison.` },
  backToPool: { cs: `Zpět na Pool`, en: `Back to Pool` },
  theseBenchmarksAreFromRealMeas: { cs: `Tyto benchmarky jsou z reálných měření našeho těžebního hardwaru. Přispěvky komunity jsou vítány.`, en: `These benchmarks are from real measurements on our mining hardware. Community benchmark submissions are welcome.` },
  filtersSorting: { cs: `Filtry a řazení`, en: `Filters & Sorting` },
  algorithm: { cs: `Algoritmus`, en: `Algorithm` },
  all: { cs: `Všechny`, en: `All` },
  hardwareType: { cs: `Typ hardwaru`, en: `Hardware Type` },
  all_2: { cs: `Vše`, en: `All` },
  sortBy: { cs: `Řadit podle`, en: `Sort By` },
  hashrate: { cs: `Hashrate`, en: `Hashrate` },
  efficiencyHW: { cs: `Efektivita (H/W)`, en: `Efficiency (H/W)` },
  profitabilityDay: { cs: `Ziskovost ($/den)`, en: `Profitability ($/day)` },
  bestGpuHashrate: { cs: `Nejlepší GPU hashrate`, en: `Best GPU hashrate` },
  bestCpuHashrate: { cs: `Nejlepší CPU hashrate`, en: `Best CPU hashrate` },
  noData: { cs: `Žádné měření`, en: `No data` },
  cpuBenchmarksPending: { cs: `CPU benchmarky očekávány`, en: `CPU benchmarks pending` },
  mostEfficientHW: { cs: `Nejefektivnější (H/W)`, en: `Most efficient (H/W)` },
  totalBenchmarks: { cs: `Celkem benchmarků`, en: `Total benchmarks` },
  verifiedMeasurements: { cs: `ověřených měření`, en: `verified measurements` },
  mainBenchmarkTable: { cs: `Hlavní tabulka benchmarků`, en: `Main Benchmark Table` },
  entries: { cs: `záznamů`, en: `entries` },
  hardware: { cs: `Hardware`, en: `Hardware` },
  type: { cs: `Typ`, en: `Type` },
  powerW: { cs: `Příkon (W)`, en: `Power (W)` },
  memory: { cs: `Paměť`, en: `Memory` },
  estZionDay: { cs: `Est. ZION/den`, en: `Est. ZION/day` },
  estDay: { cs: `Est. $/den`, en: `Est. $/day` },
  measured: { cs: `Měřeno`, en: `Measured` },
  estimated: { cs: `Odhad`, en: `Estimated` },
  architecture: { cs: `Architektura`, en: `Architecture` },
  backend: { cs: `Backend`, en: `Backend` },
  status: { cs: `Status`, en: `Status` },
  notes: { cs: `Poznámka`, en: `Notes` },
  power: { cs: `Příkon`, en: `Power` },
  efficiency: { cs: `Efektivita`, en: `Efficiency` },
  energyDay: { cs: `Energie/den`, en: `Energy/day` },
  noEntriesMatchTheSelectedFilte: { cs: `Žádné záznamy pro vybrané filtry.`, en: `No entries match the selected filters.` },
  clickARowForDetails: { cs: `Klikněte na řádek pro detail.`, en: `Click a row for details.` },
  onlyVerifiedMeasurementsAreSho: { cs: `Zobrazena pouze ověřená měření. Odhady/specifikace výrobce nejsou zahrnuty.`, en: `Only verified measurements are shown. Estimated/manufacturer specifications are not included.` },
  efficiencyChartHW: { cs: `Graf efektivity (H/W)`, en: `Efficiency Chart (H/W)` },
  best: { cs: `Nejlepší`, en: `Best` },
  mid: { cs: `Průměrný`, en: `Mid` },
  worst: { cs: `Nejhorší`, en: `Worst` },
  hashrateComparison: { cs: `Porovnání hashrate`, en: `Hashrate Comparison` },
  profitabilityCalculator: { cs: `Kalkulačka ziskovosti`, en: `Profitability Calculator` },
  electricityCostKwh: { cs: `Cena elektřiny ($/kWh)`, en: `Electricity Cost ($/kWh)` },
  zionPrice: { cs: `Cena ZION ($)`, en: `ZION Price ($)` },
  livePoolHashrate: { cs: `Pool hashrate (live):`, en: `Live pool hashrate:` },
  blocksDay: { cs: `Bloky/den:`, en: `Blocks/day:` },
  reward: { cs: `Odměna:`, en: `Reward:` },
  zionDay: { cs: `ZION/den`, en: `ZION/day` },
  elecDay: { cs: `Elektřina/den`, en: `Elec/day` },
  grossDay: { cs: `Hrubý $/den`, en: `Gross $/day` },
  netDay: { cs: `Čistý $/den`, en: `Net $/day` },
  benchmarkMethodology: { cs: `Metodika benchmarků`, en: `Benchmark Methodology` },
  benchmarkTool: { cs: `Benchmark nástroj`, en: `Benchmark Tool` },
  benchmarksRunWithEkamBenchMode: { cs: `Měření probíhá v režimu --ekam-bench (10sekundové měření, bez pool overhead). Miner commit: 9e307c4d. Výsledky představují horní mez — live stratum hashrate je nižší kvůli režii komunikace s pool.`, en: `Benchmarks run with --ekam-bench mode (10-second measurement, no pool overhead). Miner commit: 9e307c4d. Results represent an upper bound — live stratum hashrate is lower due to pool communication overhead.` },
  stratumVsBenchmarkDifference: { cs: `Stratum vs benchmark rozdíl`, en: `Stratum vs Benchmark Difference` },
  theEkamBenchBenchmarkUsesWorkS: { cs: `Benchmark --ekam-bench používá work_size přímo, zatímco live stratum mining omezuje nonce batch size (ZION_NONCE_COUNT=4096 pro CPU, ZION_NONCE_COUNT_GPU=262144 pro GPU). To snižuje efektivní hashrate cca o 10–30 %.`, en: `The --ekam-bench benchmark uses work_size directly, while live stratum mining limits nonce batch size (ZION_NONCE_COUNT=4096 for CPU, ZION_NONCE_COUNT_GPU=262144 for GPU). This reduces effective hashrate by roughly 10–30%.` },
  gpuBackends: { cs: `GPU backendy`, en: `GPU Backends` },
  amdGpusRdna1Rdna2Gcn: { cs: `AMD GPU (RDNA1/RDNA2, GCN)`, en: `AMD GPUs (RDNA1/RDNA2, GCN)` },
  nvidiaGpusPascalBlackwell: { cs: `NVIDIA GPU (Pascal → Blackwell)`, en: `NVIDIA GPUs (Pascal → Blackwell)` },
  appleSiliconM1M2M3: { cs: `Apple Silicon (M1/M2/M3)`, en: `Apple Silicon (M1/M2/M3)` },
  howToReproduce: { cs: `Jak reprodukovat`, en: `How to Reproduce` },
  runYourOwnBenchmark: { cs: `Spusťte vlastní benchmark`, en: `Run Your Own Benchmark` },
  downloadTheZionMinerCompileWit: { cs: `Stáhněte si ZION miner, zkompilujte s GPU podporou a změřte svůj hardware v režimu --ekam-bench.`, en: `Download the ZION miner, compile with GPU support, and measure your hardware in --ekam-bench mode.` },
  downloadMiner: { cs: `Stáhnout Miner`, en: `Download Miner` },
};

/* ═══════════════════════════════════════════════════════════
   ZION POOL · HARDWARE BENCHMARKS
   GPU & CPU performance results for Cosmic Harmony PoW
   ═══════════════════════════════════════════════════════════ */

const RC = '228, 30, 43'; // purple for pool
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

/* ─── Measured benchmark data ───────────────────────────────── */
/* Only real measurements from our mining hardware. Estimated/manufacturer
   specifications are NOT included. Community submissions welcome. */

const MEASURED_BENCHMARKS: BenchRow[] = [
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

export default function PoolBenchmarksClient({ embedded = false }: { embedded?: boolean } = {}) {
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
    let rows = MEASURED_BENCHMARKS.filter((r) => {
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
    const gpus = MEASURED_BENCHMARKS.filter((r) => r.type === 'GPU');
    const cpus = MEASURED_BENCHMARKS.filter((r) => r.type === 'CPU');
    const bestGpu = gpus.length > 0 ? gpus.reduce((m, r) => (r.hashrate > m.hashrate ? r : m), gpus[0]) : undefined;
    const bestCpu = cpus.length > 0 ? cpus.reduce((m, r) => (r.hashrate > m.hashrate ? r : m), cpus[0]) : undefined;
    const mostEff = MEASURED_BENCHMARKS.length > 0
      ? MEASURED_BENCHMARKS.reduce((m, r) => (efficiency(r) > efficiency(m) ? r : m), MEASURED_BENCHMARKS[0])
      : undefined;
    return {
      bestGpu,
      bestCpu,
      mostEff,
      total: MEASURED_BENCHMARKS.length,
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
    return [...MEASURED_BENCHMARKS].sort((a, b) => efficiency(b) - efficiency(a));
  }, []);

  const hashrateChartRows = useMemo(() => {
    return [...MEASURED_BENCHMARKS].sort((a, b) => b.hashrate - a.hashrate);
  }, []);

  const maxEff = Math.max(...MEASURED_BENCHMARKS.map(efficiency));
  const maxHash = Math.max(...MEASURED_BENCHMARKS.map((r) => r.hashrate));

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
    <div className={embedded ? "" : "zion-shell min-h-screen pt-28 md:pt-32 pb-24"}>
      <div className={embedded ? "space-y-10" : "zion-container max-w-7xl space-y-10"}>
        {!embedded && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="zion-rainbow-card p-8 md:p-10"
            style={rcStyle}
          >
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="w-14 h-14 rounded-2xl bg-zion-purple-500/15 flex items-center justify-center shrink-0">
                <Gauge className="w-7 h-7 text-zion-purple-400" />
              </div>
              <div className="flex-1">
                <div className="zion-kicker mb-3" style={{ borderColor: 'rgba(228,30,43,0.3)' }}>
                  <Cpu className="w-3.5 h-3.5 text-zion-purple-400" />
                  {PoolBenchmarksCopy.cosmicHarmonyPow[cs ? 'cs' : 'en']}
                </div>
                <h1 className="text-3xl md:text-5xl font-bold text-white mb-2">
                  {PoolBenchmarksCopy.hardwareBenchmarks[cs ? 'cs' : 'en']}
                </h1>
                <p className="text-gray-400 text-base md:text-lg max-w-2xl">
                  {PoolBenchmarksCopy.cosmicHarmonyPowGpuCpuPerforma[cs ? 'cs' : 'en']}
                </p>
              </div>
              <Link
                href="/pool"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zion-purple-400/30 bg-zion-purple-500/10 text-zion-purple-300 hover:bg-zion-purple-500/20 transition-colors text-sm font-medium shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
                {PoolBenchmarksCopy.backToPool[cs ? 'cs' : 'en']}
              </Link>
            </div>
          </motion.section>
        )}

        {/* ── A2. INFO BANNER ─────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.03 }}
          className="zion-rainbow-sub p-4 md:p-5 flex items-start gap-3"
          style={rcStyle}
        >
          <CheckCircle2 className="w-5 h-5 text-zion-cyan-400 shrink-0 mt-0.5" />
          <p className="text-sm text-gray-300 leading-relaxed">
            {PoolBenchmarksCopy.theseBenchmarksAreFromRealMeas[cs ? 'cs' : 'en']}
          </p>
        </motion.section>

        {/* ── B. FILTER BAR ───────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="zion-rainbow-sub p-5 md:p-6"
          style={rcStyle}
        >
          <div className="flex items-center gap-2 mb-4 text-zion-purple-300">
            <Filter className="w-4 h-4" />
            <span className="text-sm font-semibold uppercase tracking-wider">
              {PoolBenchmarksCopy.filtersSorting[cs ? 'cs' : 'en']}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Algorithm filter */}
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">
                {PoolBenchmarksCopy.algorithm[cs ? 'cs' : 'en']}
              </label>
              <select
                value={algoFilter}
                onChange={(e) => setAlgoFilter(e.target.value as AlgoFilter)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-zion-purple-400/50 focus:outline-none transition-colors"
              >
                <option value="all">{PoolBenchmarksCopy.all[cs ? 'cs' : 'en']}</option>
                <option value="deeksha_lite_v1">Deeksha Lite v1</option>
                <option value="deeksha_lite_fire">Deeksha Lite Fire</option>
                <option value="ekam_deeksha_v2">Ekam Deeksha v2</option>
              </select>
            </div>
            {/* Hardware type filter */}
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">
                {PoolBenchmarksCopy.hardwareType[cs ? 'cs' : 'en']}
              </label>
              <select
                value={hwFilter}
                onChange={(e) => setHwFilter(e.target.value as HwFilter)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-zion-purple-400/50 focus:outline-none transition-colors"
              >
                <option value="all">{PoolBenchmarksCopy.all_2[cs ? 'cs' : 'en']}</option>
                <option value="GPU">GPU</option>
                <option value="CPU">CPU</option>
              </select>
            </div>
            {/* Sort by */}
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">
                {PoolBenchmarksCopy.sortBy[cs ? 'cs' : 'en']}
              </label>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-zion-purple-400/50 focus:outline-none transition-colors"
              >
                <option value="hashrate">{PoolBenchmarksCopy.hashrate[cs ? 'cs' : 'en']}</option>
                <option value="efficiency">{PoolBenchmarksCopy.efficiencyHW[cs ? 'cs' : 'en']}</option>
                <option value="profitability">{PoolBenchmarksCopy.profitabilityDay[cs ? 'cs' : 'en']}</option>
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
            icon={<TrendingUp className="w-5 h-5 text-zion-cyan-400" />}
            label={PoolBenchmarksCopy.bestGpuHashrate[cs ? 'cs' : 'en']}
            value={summary.bestGpu ? `${summary.bestGpu.hashrate} KH/s` : '—'}
            sub={summary.bestGpu?.hardware}
            rc={rcStyle}
          />
          <SummaryCard
            icon={<Cpu className="w-5 h-5 text-zion-cyan-400" />}
            label={PoolBenchmarksCopy.bestCpuHashrate[cs ? 'cs' : 'en']}
            value={summary.bestCpu ? `${summary.bestCpu.hashrate} KH/s` : (PoolBenchmarksCopy.noData[cs ? 'cs' : 'en'])}
            sub={summary.bestCpu?.hardware ?? (PoolBenchmarksCopy.cpuBenchmarksPending[cs ? 'cs' : 'en'])}
            rc={rcStyle}
          />
          <SummaryCard
            icon={<Zap className="w-5 h-5 text-zion-gold-400" />}
            label={PoolBenchmarksCopy.mostEfficientHW[cs ? 'cs' : 'en']}
            value={summary.mostEff ? `${efficiency(summary.mostEff).toFixed(2)} KH/W` : '—'}
            sub={summary.mostEff?.hardware}
            rc={rcStyle}
          />
          <SummaryCard
            icon={<Server className="w-5 h-5 text-zion-purple-400" />}
            label={PoolBenchmarksCopy.totalBenchmarks[cs ? 'cs' : 'en']}
            value={`${summary.total}`}
            sub={PoolBenchmarksCopy.verifiedMeasurements[cs ? 'cs' : 'en']}
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
            <Activity className="w-5 h-5 text-zion-purple-400" />
            <h2 className="text-lg font-semibold text-white">
              {PoolBenchmarksCopy.mainBenchmarkTable[cs ? 'cs' : 'en']}
            </h2>
            <span className="ml-auto text-xs text-gray-500">
              {filteredRows.length} {PoolBenchmarksCopy.entries[cs ? 'cs' : 'en']}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-white/50 text-xs uppercase tracking-wider">
                  <th className="px-4 py-3">{PoolBenchmarksCopy.hardware[cs ? 'cs' : 'en']}</th>
                  <th className="px-4 py-3">{PoolBenchmarksCopy.type[cs ? 'cs' : 'en']}</th>
                  <th className="px-4 py-3">{PoolBenchmarksCopy.algorithm[cs ? 'cs' : 'en']}</th>
                  <SortHeader label={PoolBenchmarksCopy.hashrate[cs ? 'cs' : 'en']} active={sortKey === 'hashrate'} dir={sortDir} onClick={() => handleSort('hashrate')} align="right" />
                  <th className="px-4 py-3 text-right">{PoolBenchmarksCopy.powerW[cs ? 'cs' : 'en']}</th>
                  <SortHeader label={PoolBenchmarksCopy.efficiencyHW[cs ? 'cs' : 'en']} active={sortKey === 'efficiency'} dir={sortDir} onClick={() => handleSort('efficiency')} align="right" />
                  <th className="px-4 py-3">{PoolBenchmarksCopy.memory[cs ? 'cs' : 'en']}</th>
                  <th className="px-4 py-3 text-right">{PoolBenchmarksCopy.estZionDay[cs ? 'cs' : 'en']}</th>
                  <SortHeader label={PoolBenchmarksCopy.estDay[cs ? 'cs' : 'en']} active={sortKey === 'profitability'} dir={sortDir} onClick={() => handleSort('profitability')} align="right" />
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
                          expanded ? 'bg-zion-purple-500/[0.06]' : ''
                        }`}
                        onClick={() => setExpandedRow(expanded ? null : row.id)}
                      >
                        <td className="px-4 py-3 font-medium text-white whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {row.measured ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-zion-cyan-400 shrink-0" title={PoolBenchmarksCopy.measured[cs ? 'cs' : 'en']} />
                            ) : (
                              <span className="w-1.5 h-1.5 rounded-full bg-zion-gold-400/60 shrink-0" title={PoolBenchmarksCopy.estimated[cs ? 'cs' : 'en']} />
                            )}
                            {row.hardware}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            row.type === 'GPU' ? 'bg-zion-cyan-500/15 text-zion-cyan-300' : 'bg-zion-cyan-500/15 text-zion-cyan-300'
                          }`}>
                            {row.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white/60 whitespace-nowrap text-xs">
                          {ALGO_LABELS[row.algorithm][cs ? 'cs' : 'en']}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-zion-purple-300 text-base">
                          {row.hashrate} <span className="text-xs text-zion-purple-400/60 font-normal">KH/s</span>
                        </td>
                        <td className="px-4 py-3 text-right text-white/60">{row.power}</td>
                        <td className="px-4 py-3 text-right font-semibold text-zion-gold-300">
                          {efficiency(row).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-white/50 whitespace-nowrap text-xs">{row.memory}</td>
                        <td className="px-4 py-3 text-right text-white/70 font-mono text-xs">
                          {zionDay >= 0.001 ? zionDay.toFixed(4) : zionDay.toExponential(2)}
                        </td>
                        <td className={`px-4 py-3 text-right font-semibold font-mono text-xs ${usdDay >= 0 ? 'text-zion-cyan-400' : 'text-zion-purple-400'}`}>
                          {usdDay >= 0 ? '+' : ''}{usdDay.toFixed(4)}
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="bg-black/30">
                          <td colSpan={9} className="px-4 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                              <div>
                                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">{PoolBenchmarksCopy.architecture[cs ? 'cs' : 'en']}</div>
                                <div className="text-white/80">{row.arch}</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">{PoolBenchmarksCopy.backend[cs ? 'cs' : 'en']}</div>
                                <div className="text-white/80">{row.backend}</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">{PoolBenchmarksCopy.status[cs ? 'cs' : 'en']}</div>
                                <div className={row.measured ? 'text-zion-cyan-400' : 'text-zion-gold-400'}>
                                  {row.measured ? (PoolBenchmarksCopy.measured[cs ? 'cs' : 'en']) : (PoolBenchmarksCopy.estimated[cs ? 'cs' : 'en'])}
                                </div>
                              </div>
                              <div className="md:col-span-3">
                                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">{PoolBenchmarksCopy.notes[cs ? 'cs' : 'en']}</div>
                                <div className="text-white/60 leading-relaxed">{row.notes[cs ? 'cs' : 'en']}</div>
                              </div>
                              <div className="md:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-white/5">
                                <MiniStat label={PoolBenchmarksCopy.hashrate[cs ? 'cs' : 'en']} value={`${row.hashrate} KH/s`} />
                                <MiniStat label={PoolBenchmarksCopy.power[cs ? 'cs' : 'en']} value={`${row.power} W`} />
                                <MiniStat label={PoolBenchmarksCopy.efficiency[cs ? 'cs' : 'en']} value={`${efficiency(row).toFixed(2)} KH/W`} />
                                <MiniStat label={PoolBenchmarksCopy.energyDay[cs ? 'cs' : 'en']} value={`${((row.power / 1000) * 24).toFixed(2)} kWh`} />
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
                      {PoolBenchmarksCopy.noEntriesMatchTheSelectedFilte[cs ? 'cs' : 'en']}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-white/5 text-xs text-gray-500 flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-zion-cyan-400" /> {PoolBenchmarksCopy.measured[cs ? 'cs' : 'en']}
            </span>
            <span className="ml-auto">
              {PoolBenchmarksCopy.clickARowForDetails[cs ? 'cs' : 'en']}
            </span>
          </div>
          <div className="px-4 py-3 border-t border-white/5 flex items-center gap-2 text-xs text-gray-500">
            <AlertCircle className="w-3.5 h-3.5 text-zion-gold-400/70 shrink-0" />
            <span>
              {PoolBenchmarksCopy.onlyVerifiedMeasurementsAreSho[cs ? 'cs' : 'en']}
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
            <Zap className="w-5 h-5 text-zion-gold-400" />
            <h2 className="text-lg font-semibold text-white">
              {PoolBenchmarksCopy.efficiencyChartHW[cs ? 'cs' : 'en']}
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
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-zion-cyan-500" /> {PoolBenchmarksCopy.best[cs ? 'cs' : 'en']}</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-zion-gold-500" /> {PoolBenchmarksCopy.mid[cs ? 'cs' : 'en']}</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-zion-purple-500" /> {PoolBenchmarksCopy.worst[cs ? 'cs' : 'en']}</span>
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
            <TrendingUp className="w-5 h-5 text-zion-purple-400" />
            <h2 className="text-lg font-semibold text-white">
              {PoolBenchmarksCopy.hashrateComparison[cs ? 'cs' : 'en']}
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
                        background: 'linear-gradient(90deg, rgba(228,30,43,0.4), rgba(228,30,43,0.9))',
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
            <Calculator className="w-5 h-5 text-zion-purple-400" />
            <h2 className="text-lg font-semibold text-white">
              {PoolBenchmarksCopy.profitabilityCalculator[cs ? 'cs' : 'en']}
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">
                {PoolBenchmarksCopy.electricityCostKwh[cs ? 'cs' : 'en']}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={elecCost}
                onChange={(e) => setElecCost(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-zion-purple-400/50 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">
                {PoolBenchmarksCopy.zionPrice[cs ? 'cs' : 'en']}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={zionPrice}
                onChange={(e) => setZionPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-zion-purple-400/50 focus:outline-none transition-colors"
              />
            </div>
          </div>
          <div className="text-xs text-gray-500 mb-4 flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-zion-purple-400" />
            {PoolBenchmarksCopy.livePoolHashrate[cs ? 'cs' : 'en']}{' '}
            <span className="font-mono text-zion-purple-300">
              {(poolStats.poolHashrate / 1000).toFixed(2)} KH/s
            </span>
            {' · '}
            {PoolBenchmarksCopy.blocksDay[cs ? 'cs' : 'en']}{' '}
            <span className="font-mono text-zion-purple-300">{poolStats.blocksPerDay.toFixed(0)}</span>
            {' · '}
            {PoolBenchmarksCopy.reward[cs ? 'cs' : 'en']}{' '}
            <span className="font-mono text-zion-purple-300">{poolStats.rewardPerBlock} ZION</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-white/50 text-xs uppercase tracking-wider">
                  <th className="px-3 py-2">{PoolBenchmarksCopy.hardware[cs ? 'cs' : 'en']}</th>
                  <th className="px-3 py-2 text-right">{PoolBenchmarksCopy.zionDay[cs ? 'cs' : 'en']}</th>
                  <th className="px-3 py-2 text-right">{PoolBenchmarksCopy.elecDay[cs ? 'cs' : 'en']}</th>
                  <th className="px-3 py-2 text-right">{PoolBenchmarksCopy.grossDay[cs ? 'cs' : 'en']}</th>
                  <th className="px-3 py-2 text-right">{PoolBenchmarksCopy.netDay[cs ? 'cs' : 'en']}</th>
                </tr>
              </thead>
              <tbody>
                {MEASURED_BENCHMARKS.map((row) => {
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
                      <td className="px-3 py-2 text-right font-mono text-xs text-zion-purple-400/70">-${elec.toFixed(3)}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-white/70">${gross.toFixed(3)}</td>
                      <td className={`px-3 py-2 text-right font-mono text-xs font-semibold ${net >= 0 ? 'text-zion-cyan-400' : 'text-zion-purple-400'}`}>
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
            <Info className="w-5 h-5 text-zion-purple-400" />
            <h2 className="text-lg font-semibold text-white">
              {PoolBenchmarksCopy.benchmarkMethodology[cs ? 'cs' : 'en']}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="zion-tile">
              <h3 className="text-sm font-semibold text-zion-purple-300 mb-2 flex items-center gap-2">
                <span className="font-mono text-xs bg-zion-purple-500/15 px-2 py-0.5 rounded">--ekam-bench</span>
                {PoolBenchmarksCopy.benchmarkTool[cs ? 'cs' : 'en']}
              </h3>
              <p className="text-sm text-white/60 leading-relaxed">
                {PoolBenchmarksCopy.benchmarksRunWithEkamBenchMode[cs ? 'cs' : 'en']}
              </p>
            </div>
            <div className="zion-tile">
              <h3 className="text-sm font-semibold text-zion-purple-300 mb-2">
                {PoolBenchmarksCopy.stratumVsBenchmarkDifference[cs ? 'cs' : 'en']}
              </h3>
              <p className="text-sm text-white/60 leading-relaxed">
                {PoolBenchmarksCopy.theEkamBenchBenchmarkUsesWorkS[cs ? 'cs' : 'en']}
              </p>
            </div>
            <div className="zion-tile">
              <h3 className="text-sm font-semibold text-zion-purple-300 mb-2">
                {PoolBenchmarksCopy.gpuBackends[cs ? 'cs' : 'en']}
              </h3>
              <ul className="text-sm text-white/60 leading-relaxed space-y-1">
                <li>• <span className="font-mono text-zion-purple-300/80">OpenCL</span> — {PoolBenchmarksCopy.amdGpusRdna1Rdna2Gcn[cs ? 'cs' : 'en']}</li>
                <li>• <span className="font-mono text-zion-purple-300/80">CUDA</span> — {PoolBenchmarksCopy.nvidiaGpusPascalBlackwell[cs ? 'cs' : 'en']}</li>
                <li>• <span className="font-mono text-zion-purple-300/80">Metal</span> — {PoolBenchmarksCopy.appleSiliconM1M2M3[cs ? 'cs' : 'en']}</li>
              </ul>
            </div>
            <div className="zion-tile">
              <h3 className="text-sm font-semibold text-zion-purple-300 mb-2">
                {PoolBenchmarksCopy.howToReproduce[cs ? 'cs' : 'en']}
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

        {!embedded && (
          <>
            {/* ── I. CTA ──────────────────────────────────────────────── */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="zion-cta-banner"
            >
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
                {PoolBenchmarksCopy.runYourOwnBenchmark[cs ? 'cs' : 'en']}
              </h2>
              <p className="text-white/70 mb-6 max-w-xl mx-auto">
                {PoolBenchmarksCopy.downloadTheZionMinerCompileWit[cs ? 'cs' : 'en']}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href="/download"
                  className="zion-button-primary"
                >
                  <Download className="w-4 h-4" />
                  {PoolBenchmarksCopy.downloadMiner[cs ? 'cs' : 'en']}
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/pool"
                  className="zion-button-secondary"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {PoolBenchmarksCopy.backToPool[cs ? 'cs' : 'en']}
                </Link>
              </div>
            </motion.section>
          </>
        )}

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
  sub?: string;
  rc: React.CSSProperties;
}) {
  return (
    <div className="zion-rainbow-sub p-5" style={rc}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-gray-400 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white mb-1">{value}</div>
      {sub && <div className="text-xs text-gray-500 truncate" title={sub}>{sub}</div>}
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
        className={`inline-flex items-center gap-1 hover:text-white transition-colors ${active ? 'text-zion-purple-300' : ''}`}
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
