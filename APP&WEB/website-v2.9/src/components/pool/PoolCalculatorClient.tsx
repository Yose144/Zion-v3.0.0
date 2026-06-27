'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Calculator,
  TrendingUp,
  Zap,
  DollarSign,
  Cpu,
  Server,
  Activity,
  ArrowRight,
  ArrowLeft,
  Gauge,
  Coins,
  RotateCcw,
  Sparkles,
  Info,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { usePolling } from '@/hooks/usePolling';

/* ═══════════════════════════════════════════════════════════
   ZION MINING REWARD CALCULATOR
   Self-contained · purple theme · reactive
   ═══════════════════════════════════════════════════════════ */

const PURPLE_RC = '147, 51, 234' as const;
const purpleStyle = { '--rc': PURPLE_RC } as React.CSSProperties;

/* ─── Helpers (copied from PoolDashboard) ─── */
function parseHashrateInput(value: string): number {
  const cleaned = value.trim().replace(/,/g, '');
  if (!cleaned) return 0;
  const match = cleaned.match(/^([0-9]*\.?[0-9]+)\s*([kKmMgGtTpP])?$/);
  if (!match) return Number(cleaned) || 0;
  const base = Number(match[1]) || 0;
  const unit = (match[2] || '').toUpperCase();
  const mult: Record<string, number> = {
    '': 1,
    K: 1e3,
    M: 1e6,
    G: 1e9,
    T: 1e12,
    P: 1e15,
  };
  return base * (mult[unit] ?? 1);
}

function fmtHash(h?: number): string {
  if (!h || h <= 0) return '0 H/s';
  if (h >= 1e12) return `${(h / 1e12).toFixed(2)} TH/s`;
  if (h >= 1e9) return `${(h / 1e9).toFixed(2)} GH/s`;
  if (h >= 1e6) return `${(h / 1e6).toFixed(2)} MH/s`;
  if (h >= 1e3) return `${(h / 1e3).toFixed(2)} kH/s`;
  return `${h.toFixed(0)} H/s`;
}

function fmtNum(n?: number): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US');
}

function fmtUsd(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs !== 0 && abs < 0.01) return `$${n.toFixed(6)}`;
  if (abs < 1000) return `$${n.toFixed(digits)}`;
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: digits })}`;
}

function fmtZion(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs < 0.0001) return n.toExponential(2);
  if (abs < 1) return n.toFixed(6);
  if (abs < 1000) return n.toFixed(4);
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/* ─── Hardware presets ─── */
type HardwareType = 'cpu' | 'gpu' | 'asic';

interface HardwarePreset {
  id: string;
  label: string;
  type: HardwareType;
  hashrate: number; // H/s
  power: number; // W
  cost: number; // USD
}

const HARDWARE_PRESETS: HardwarePreset[] = [
  { id: 'ryzen9', label: 'CPU · Ryzen 9 7950X', type: 'cpu', hashrate: 2_000, power: 65, cost: 600 },
  { id: 'rx5700', label: 'GPU · RX 5700 XT', type: 'gpu', hashrate: 18_000, power: 180, cost: 350 },
  { id: 'rtx4090', label: 'GPU · RTX 4090', type: 'gpu', hashrate: 45_000, power: 450, cost: 1600 },
  { id: 'asic', label: 'ASIC · Hypothetical', type: 'asic', hashrate: 100_000, power: 500, cost: 3000 },
];

/* ─── Pool data shape (subset) ─── */
interface PoolStats {
  ok: boolean;
  aggregate?: { hashrate: number; hashrate_24h: number; active_miners: number };
  fee?: { pool_fee: number; miner_share: number };
  runtime?: { difficulty: number; network_hashrate?: number };
  recent_blocks?: { height: number; timestamp: number; reward: number }[];
}

/* ─── Mock price history (sparkline) ─── */
const MOCK_PRICE_HISTORY = [
  0.00018, 0.00019, 0.00021, 0.0002, 0.00022, 0.00024, 0.00023, 0.00021,
  0.0002, 0.00019, 0.0002, 0.00022, 0.00024, 0.00026, 0.00025, 0.00023,
  0.00022, 0.0002, 0.00021, 0.00023, 0.00025, 0.00027, 0.00026, 0.00024,
  0.00022, 0.0002, 0.00019, 0.0002, 0.00021, 0.0002,
];

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */
export default function PoolCalculatorClient() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  /* ─── Input state ─── */
  const [hashrateInput, setHashrateInput] = useState('18 K');
  const [hardwareType, setHardwareType] = useState<HardwareType>('gpu');
  const [powerW, setPowerW] = useState(180);
  const [elecCost, setElecCost] = useState(0.1);
  const [zionPrice, setZionPrice] = useState(0.0002);
  const [poolFee, setPoolFee] = useState(1);
  const [difficulty, setDifficulty] = useState(1);
  const [hardwareCost, setHardwareCost] = useState(0);
  const [rewardPerBlock, setRewardPerBlock] = useState(1000);

  /* ─── Live pool data ─── */
  const [poolStats, setPoolStats] = useState<PoolStats | null>(null);
  const [poolHashrate, setPoolHashrate] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchPool = useCallback(async () => {
    try {
      const res = await fetch('/api/pool/stats', { cache: 'no-store' });
      if (!res.ok) throw new Error('pool stats');
      const data: PoolStats = await res.json();
      setPoolStats(data);
      if (data.aggregate?.hashrate) setPoolHashrate(data.aggregate.hashrate);
      if (data.fee?.pool_fee) setPoolFee(data.fee.pool_fee);
      if (data.runtime?.difficulty) setDifficulty(data.runtime.difficulty);
    } catch {
      /* keep defaults */
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPrice = useCallback(async () => {
    try {
      const res = await fetch('/api/defi/price', { cache: 'no-store' });
      if (!res.ok) throw new Error('price');
      const data = await res.json();
      const p = typeof data === 'number' ? data : data?.price ?? data?.zionPrice ?? data?.usd;
      if (typeof p === 'number' && p > 0) setZionPrice(p);
    } catch {
      /* keep default 0.0002 */
    }
  }, []);

  usePolling(fetchPool, 30000);
  usePolling(fetchPrice, 30000);

  /* ─── Derived: my hashrate (H/s) ─── */
  const myHashrate = useMemo(() => parseHashrateInput(hashrateInput), [hashrateInput]);

  /* ─── Calculations ─── */
  const calc = useMemo(() => {
    const effectivePoolHash = poolHashrate > 0 ? poolHashrate : 50_000; // fallback
    const mySharePct = effectivePoolHash > 0 ? (myHashrate / effectivePoolHash) * 100 : 0;
    const blocksPerDay = 1440; // target ~1 min blocks
    const myBlocksPerDay = blocksPerDay * (mySharePct / 100);
    const minerSharePct = poolStats?.fee?.miner_share ?? 89;
    const myZionPerDay = myBlocksPerDay * rewardPerBlock * (minerSharePct / 100) * (1 - poolFee / 100);
    const myUsdPerDay = myZionPerDay * zionPrice;
    const electricityPerDay = (powerW / 1000) * 24 * elecCost;
    const netProfitPerDay = myUsdPerDay - electricityPerDay;

    return {
      mySharePct,
      blocksPerDay,
      myBlocksPerDay,
      myZionPerDay,
      myUsdPerDay,
      electricityPerDay,
      netProfitPerDay,
      myZionPerMonth: myZionPerDay * 30,
      myUsdPerMonth: myUsdPerDay * 30,
      electricityPerMonth: electricityPerDay * 30,
      netProfitPerMonth: netProfitPerDay * 30,
      myZionPerYear: myZionPerDay * 365,
      myUsdPerYear: myUsdPerDay * 365,
      electricityPerYear: electricityPerDay * 365,
      netProfitPerYear: netProfitPerDay * 365,
      breakEvenDays: hardwareCost > 0 && netProfitPerDay > 0 ? hardwareCost / netProfitPerDay : Infinity,
    };
  }, [myHashrate, poolHashrate, poolStats, rewardPerBlock, poolFee, zionPrice, powerW, elecCost, hardwareCost]);

  /* ─── Hardware comparison rows ─── */
  const hwComparison = useMemo(() => {
    const effectivePoolHash = poolHashrate > 0 ? poolHashrate : 50_000;
    const minerSharePct = poolStats?.fee?.miner_share ?? 89;
    return HARDWARE_PRESETS.map((hw) => {
      const sharePct = (hw.hashrate / effectivePoolHash) * 100;
      const blocksDay = 1440 * (sharePct / 100);
      const zionDay = blocksDay * rewardPerBlock * (minerSharePct / 100) * (1 - poolFee / 100);
      const usdDay = zionDay * zionPrice;
      const elecDay = (hw.power / 1000) * 24 * elecCost;
      const netMonth = (usdDay - elecDay) * 30;
      return { ...hw, zionDay, usdDay, netMonth };
    });
  }, [poolHashrate, poolStats, rewardPerBlock, poolFee, zionPrice, elecCost]);

  /* ─── Profitability timeline (365 days cumulative) ─── */
  const timeline = useMemo(() => {
    const points: { day: number; cum: number }[] = [];
    let cum = -hardwareCost;
    for (let d = 0; d <= 365; d += 7) {
      points.push({ day: d, cum });
      cum += calc.netProfitPerDay * 7;
    }
    return points;
  }, [calc.netProfitPerDay, hardwareCost]);

  const breakEvenDay = useMemo(() => {
    if (!Number.isFinite(calc.breakEvenDays)) return null;
    return Math.round(calc.breakEvenDays);
  }, [calc.breakEvenDays]);

  /* ─── Apply hardware preset ─── */
  const applyPreset = (hw: HardwarePreset) => {
    setHardwareType(hw.type);
    setPowerW(hw.power);
    setHardwareCost(hw.cost);
    setHashrateInput(hw.hashrate >= 1e6 ? `${(hw.hashrate / 1e6).toFixed(1)} M` : `${(hw.hashrate / 1e3).toFixed(1)} K`);
  };

  /* ─── Reset ─── */
  const reset = () => {
    setHashrateInput('18 K');
    setHardwareType('gpu');
    setPowerW(180);
    setElecCost(0.1);
    setZionPrice(0.0002);
    setPoolFee(poolStats?.fee?.pool_fee ?? 1);
    setHardwareCost(0);
  };

  /* ═══════════════════════ RENDER ═══════════════════════ */
  return (
    <div className="zion-shell min-h-screen pt-28 md:pt-32 pb-24">
      <div className="zion-container max-w-7xl space-y-10">
        {/* ════════ A. HERO ════════ */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="zion-rainbow-card p-8 md:p-10"
          style={purpleStyle}
        >
          <div className="relative z-[1] flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-3">
              <span className="zion-kicker">
                <Calculator className="h-3.5 w-3.5" />
                {cs ? 'Kalkulačka odměn' : 'Reward Calculator'}
              </span>
              <h1 className="zion-section-title text-3xl md:text-5xl">
                {cs ? 'Kalkulačka těžebních odměn' : 'Mining Reward Calculator'}
              </h1>
              <p className="zion-section-sub">
                {cs
                  ? 'Odhadněte své denní, měsíční a roční odměny z těžby ZION. Zadejte svůj výpočetní výkon, cenu elektřiny a získejte kompletní projekce ziskovosti včetně ROI.'
                  : 'Estimate your daily, monthly, and yearly ZION mining rewards. Enter your hashrate, electricity cost, and get full profitability projections including ROI.'}
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Link
                  href="/pool"
                  className="zion-button-secondary text-sm px-4 py-2.5"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {cs ? 'Zpět na pool' : 'Back to Pool'}
                </Link>
                <Link
                  href="/pool#start-mining"
                  className="zion-button-primary text-sm px-4 py-2.5"
                >
                  <Zap className="h-4 w-4" />
                  {cs ? 'Začít těžit' : 'Start Mining'}
                </Link>
              </div>
            </div>
            <div className="flex shrink-0 items-center justify-center">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-purple-500/20 blur-3xl" />
                <div className="relative grid h-28 w-28 place-items-center rounded-3xl border border-purple-400/30 bg-purple-500/10">
                  <TrendingUp className="h-12 w-12 text-purple-300" />
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ════════ B. INPUT PANEL ════════ */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="zion-rainbow-sub p-6 md:p-8"
          style={purpleStyle}
        >
          <div className="relative z-[1]">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                <Gauge className="h-5 w-5 text-purple-300" />
                {cs ? 'Vstupní parametry' : 'Input Parameters'}
              </h2>
              <button
                onClick={reset}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:border-white/20 hover:text-white"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {cs ? 'Reset' : 'Reset'}
              </button>
            </div>

            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {/* Hashrate */}
              <Field label={cs ? 'Váš výpočetní výkon' : 'Your hashrate'} hint={cs ? 'např. 18 K, 2 M, 1 G' : 'e.g. 18 K, 2 M, 1 G'}>
                <input
                  type="text"
                  value={hashrateInput}
                  onChange={(e) => setHashrateInput(e.target.value)}
                  placeholder="18 K"
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-purple-400/50 w-full"
                />
                <div className="mt-1 text-[11px] text-gray-500 font-mono">
                  {fmtHash(myHashrate)}
                </div>
              </Field>

              {/* Hardware type */}
              <Field label={cs ? 'Typ hardwaru' : 'Hardware type'}>
                <select
                  value={hardwareType}
                  onChange={(e) => setHardwareType(e.target.value as HardwareType)}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-purple-400/50 w-full"
                >
                  <option value="cpu" className="bg-zinc-900">CPU</option>
                  <option value="gpu" className="bg-zinc-900">GPU</option>
                  <option value="asic" className="bg-zinc-900">ASIC</option>
                </select>
              </Field>

              {/* Power */}
              <Field label={cs ? 'Spotřeba (W)' : 'Power consumption (W)'}>
                <input
                  type="number"
                  value={powerW}
                  min={0}
                  onChange={(e) => setPowerW(Number(e.target.value) || 0)}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-purple-400/50 w-full"
                />
              </Field>

              {/* Electricity cost */}
              <Field label={cs ? 'Cena elektřiny ($/kWh)' : 'Electricity cost ($/kWh)'}>
                <input
                  type="number"
                  step="0.01"
                  value={elecCost}
                  min={0}
                  onChange={(e) => setElecCost(Number(e.target.value) || 0)}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-purple-400/50 w-full"
                />
              </Field>

              {/* ZION price */}
              <Field label={cs ? 'Cena ZION ($)' : 'ZION price ($)'}>
                <input
                  type="number"
                  step="0.00001"
                  value={zionPrice}
                  min={0}
                  onChange={(e) => setZionPrice(Number(e.target.value) || 0)}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-purple-400/50 w-full"
                />
              </Field>

              {/* Pool fee */}
              <Field label={cs ? 'Pool poplatek (%)' : 'Pool fee (%)'}>
                <input
                  type="number"
                  step="0.1"
                  value={poolFee}
                  min={0}
                  onChange={(e) => setPoolFee(Number(e.target.value) || 0)}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-purple-400/50 w-full"
                />
              </Field>

              {/* Difficulty */}
              <Field label={cs ? 'Network difficulty' : 'Network difficulty'} hint={cs ? 'auto-fetch' : 'auto-fetched'}>
                <input
                  type="number"
                  step="0.01"
                  value={difficulty}
                  min={0}
                  onChange={(e) => setDifficulty(Number(e.target.value) || 0)}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-purple-400/50 w-full"
                />
              </Field>

              {/* Hardware cost */}
              <Field label={cs ? 'Cena hardwaru ($)' : 'Hardware cost ($)'} hint={cs ? 'pro výpočet ROI' : 'for ROI calc'}>
                <input
                  type="number"
                  step="50"
                  value={hardwareCost}
                  min={0}
                  onChange={(e) => setHardwareCost(Number(e.target.value) || 0)}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-purple-400/50 w-full"
                />
              </Field>

              {/* Reward per block */}
              <Field label={cs ? 'Odměna za blok (ZION)' : 'Reward per block (ZION)'}>
                <input
                  type="number"
                  step="1"
                  value={rewardPerBlock}
                  min={0}
                  onChange={(e) => setRewardPerBlock(Number(e.target.value) || 0)}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-purple-400/50 w-full"
                />
              </Field>
            </div>

            {/* Quick preset chips */}
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500">{cs ? 'Předvolby:' : 'Presets:'}</span>
              {HARDWARE_PRESETS.map((hw) => (
                <button
                  key={hw.id}
                  onClick={() => applyPreset(hw)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-gray-300 transition-colors hover:border-purple-400/40 hover:text-white"
                >
                  {hw.type === 'cpu' ? <Cpu className="h-3 w-3" /> : hw.type === 'gpu' ? <Server className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
                  {hw.label}
                </button>
              ))}
            </div>

            {/* Live data status */}
            <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
              <span className={`inline-block h-2 w-2 rounded-full ${loading ? 'bg-amber-400' : poolStats ? 'bg-emerald-400' : 'bg-gray-600'}`} />
              {loading
                ? cs ? 'Načítání pool dat…' : 'Loading pool data…'
                : poolStats
                ? cs ? `Pool: ${fmtHash(poolHashrate)} · ${poolStats.aggregate?.active_miners ?? 0} minerů` : `Pool: ${fmtHash(poolHashrate)} · ${poolStats.aggregate?.active_miners ?? 0} miners`
                : cs ? 'Pool data nedostupná — použity výchozí hodnoty' : 'Pool data unavailable — using defaults'}
            </div>
          </div>
        </motion.section>

        {/* ════════ C. RESULTS DASHBOARD ════════ */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="space-y-4"
        >
          <h2 className="flex items-center gap-2 text-xl font-semibold text-white">
            <Activity className="h-5 w-5 text-purple-300" />
            {cs ? 'Výsledky' : 'Results Dashboard'}
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Daily rewards */}
            <ResultCard
              style={purpleStyle}
              icon={<Coins className="h-4 w-4 text-purple-300" />}
              title={cs ? 'Denní odměny' : 'Daily Rewards'}
              big={fmtZion(calc.myZionPerDay)}
              bigLabel="ZION/day"
              sub={fmtUsd(calc.myUsdPerDay)}
              subLabel="USD/day"
            />

            {/* Monthly rewards */}
            <ResultCard
              style={purpleStyle}
              icon={<Coins className="h-4 w-4 text-purple-300" />}
              title={cs ? 'Měsíční odměny' : 'Monthly Rewards'}
              big={fmtZion(calc.myZionPerMonth)}
              bigLabel="ZION/month"
              sub={fmtUsd(calc.myUsdPerMonth)}
              subLabel="USD/month"
            />

            {/* Yearly rewards */}
            <ResultCard
              style={purpleStyle}
              icon={<Coins className="h-4 w-4 text-purple-300" />}
              title={cs ? 'Roční odměny' : 'Yearly Rewards'}
              big={fmtZion(calc.myZionPerYear)}
              bigLabel="ZION/year"
              sub={fmtUsd(calc.myUsdPerYear)}
              subLabel="USD/year"
            />

            {/* Electricity cost */}
            <ResultCard
              style={purpleStyle}
              icon={<Zap className="h-4 w-4 text-amber-400" />}
              title={cs ? 'Náklady na elektřinu' : 'Electricity Cost'}
              big={fmtUsd(calc.electricityPerDay)}
              bigLabel="$/day"
              sub={`${fmtUsd(calc.electricityPerMonth)} / ${fmtUsd(calc.electricityPerYear)}`}
              subLabel="$/month · $/year"
            />

            {/* Net profit */}
            <ResultCard
              style={purpleStyle}
              icon={<DollarSign className="h-4 w-4 text-emerald-400" />}
              title={cs ? 'Čistý zisk' : 'Net Profit'}
              big={fmtUsd(calc.netProfitPerDay)}
              bigLabel="$/day"
              sub={`${fmtUsd(calc.netProfitPerMonth)} / ${fmtUsd(calc.netProfitPerYear)}`}
              subLabel="$/month · $/year"
              highlight={calc.netProfitPerDay >= 0 ? 'positive' : 'negative'}
            />

            {/* ROI */}
            <ResultCard
              style={purpleStyle}
              icon={<TrendingUp className="h-4 w-4 text-cyan-300" />}
              title={cs ? 'ROI · Break-even' : 'ROI · Break-even'}
              big={breakEvenDay !== null ? `${fmtNum(breakEvenDay)} d` : '—'}
              bigLabel={cs ? 'dní do návratnosti' : 'days to break even'}
              sub={hardwareCost > 0 ? fmtUsd(hardwareCost) : cs ? 'zadejte cenu HW' : 'enter hardware cost'}
              subLabel={cs ? 'investice' : 'investment'}
            />

            {/* Pool share */}
            <ResultCard
              style={purpleStyle}
              icon={<Server className="h-4 w-4 text-purple-300" />}
              title={cs ? 'Podíl v poolu' : 'Pool Share'}
              big={`${calc.mySharePct.toFixed(4)}%`}
              bigLabel={cs ? 'z pool hashrate' : 'of pool hashrate'}
              sub={fmtHash(poolHashrate)}
              subLabel={cs ? 'celkový pool' : 'total pool'}
            />

            {/* Blocks per day */}
            <ResultCard
              style={purpleStyle}
              icon={<Activity className="h-4 w-4 text-purple-300" />}
              title={cs ? 'Bloky za den' : 'Blocks per Day'}
              big={calc.myBlocksPerDay > 0 ? calc.myBlocksPerDay.toFixed(6) : '0'}
              bigLabel={cs ? 'očekávané bloky' : 'expected blocks'}
              sub={`${calc.blocksPerDay}`}
              subLabel={cs ? 'celkem bloků/den' : 'total blocks/day'}
            />
          </div>
        </motion.section>

        {/* ════════ D. HARDWARE COMPARISON ════════ */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="zion-rainbow-card p-6 md:p-8"
          style={purpleStyle}
        >
          <div className="relative z-[1]">
            <h2 className="mb-5 flex items-center gap-2 text-lg font-semibold text-white">
              <Cpu className="h-5 w-5 text-purple-300" />
              {cs ? 'Srovnání hardwaru' : 'Hardware Comparison'}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-gray-400">
                    <th className="py-3 pr-4">{cs ? 'Hardware' : 'Hardware'}</th>
                    <th className="py-3 pr-4">{cs ? 'Výkon' : 'Hashrate'}</th>
                    <th className="py-3 pr-4">{cs ? 'Spotřeba' : 'Power'}</th>
                    <th className="py-3 pr-4">ZION/day</th>
                    <th className="py-3 pr-4">$/day</th>
                    <th className="py-3 pr-4">$/month</th>
                    <th className="py-3 pr-4">{cs ? 'Čistý zisk/měsíc' : 'Net profit/month'}</th>
                  </tr>
                </thead>
                <tbody>
                  {hwComparison.map((hw) => {
                    const isSelected = hw.type === hardwareType;
                    return (
                      <tr
                        key={hw.id}
                        className={`border-b border-white/5 transition-colors ${
                          isSelected ? 'bg-purple-500/10' : 'hover:bg-white/[0.03]'
                        }`}
                      >
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            {hw.type === 'cpu' ? <Cpu className="h-4 w-4 text-gray-400" /> : hw.type === 'gpu' ? <Server className="h-4 w-4 text-gray-400" /> : <Zap className="h-4 w-4 text-gray-400" />}
                            <span className={isSelected ? 'font-semibold text-white' : 'text-gray-200'}>{hw.label}</span>
                            {isSelected && (
                              <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[10px] font-medium text-purple-300">
                                {cs ? 'vybráno' : 'selected'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 pr-4 font-mono text-gray-300">{fmtHash(hw.hashrate)}</td>
                        <td className="py-3 pr-4 font-mono text-gray-300">{hw.power} W</td>
                        <td className="py-3 pr-4 font-mono text-gray-300">{fmtZion(hw.zionDay)}</td>
                        <td className="py-3 pr-4 font-mono text-gray-300">{fmtUsd(hw.usdDay)}</td>
                        <td className="py-3 pr-4 font-mono text-gray-300">{fmtUsd(hw.usdDay * 30)}</td>
                        <td className={`py-3 pr-4 font-mono font-semibold ${hw.netMonth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {fmtUsd(hw.netMonth)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 flex items-start gap-1.5 text-xs text-gray-500">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {cs
                ? 'Odhady jsou založeny na aktuálním pool hashrate a předpokládaných blocích. Skutečné výsledky se mohou lišit v závislosti na síťovém výkonu a pool štěstí.'
                : 'Estimates are based on current pool hashrate and assumed block cadence. Actual results vary with network performance and pool luck.'}
            </p>
          </div>
        </motion.section>

        {/* ════════ E + F. CHARTS ════════ */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="grid gap-6 lg:grid-cols-2"
        >
          {/* Price sparkline */}
          <div className="zion-rainbow-sub p-6" style={purpleStyle}>
            <div className="relative z-[1]">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-base font-semibold text-white">
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                  {cs ? 'Cena ZION (30d)' : 'ZION Price (30d)'}
                </h3>
                <span className="font-mono text-sm text-emerald-400">${zionPrice.toFixed(6)}</span>
              </div>
              <PriceSparkline values={MOCK_PRICE_HISTORY} current={zionPrice} />
              <div className="mt-3 flex justify-between text-xs text-gray-500">
                <span>30 {cs ? 'dní zpět' : 'days ago'}</span>
                <span>{cs ? 'dnes' : 'today'}</span>
              </div>
            </div>
          </div>

          {/* Profitability timeline */}
          <div className="zion-rainbow-sub p-6" style={purpleStyle}>
            <div className="relative z-[1]">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-base font-semibold text-white">
                  <Activity className="h-4 w-4 text-purple-300" />
                  {cs ? 'Časová osa ziskovosti (365d)' : 'Profitability Timeline (365d)'}
                </h3>
                {breakEvenDay !== null && (
                  <span className="rounded-full bg-purple-500/20 px-2.5 py-1 text-xs text-purple-300">
                    {cs ? `Break-even: ${breakEvenDay}d` : `Break-even: ${breakEvenDay}d`}
                  </span>
                )}
              </div>
              <ProfitTimeline points={timeline} />
              <div className="mt-3 flex justify-between text-xs text-gray-500">
                <span>{cs ? 'Den 0' : 'Day 0'}</span>
                <span>{cs ? 'Den 365' : 'Day 365'}</span>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ════════ G. CTA ════════ */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="zion-cta-banner"
        >
          <div className="relative z-[1] flex flex-col items-center gap-4 text-center">
            <span className="zion-kicker">
              <Sparkles className="h-3.5 w-3.5" />
              {cs ? 'Připraveni těžit?' : 'Ready to mine?'}
            </span>
            <h2 className="zion-section-title text-2xl md:text-4xl">
              {cs ? 'Začněte těžit ZION ještě dnes' : 'Start mining ZION today'}
            </h2>
            <p className="zion-section-sub mx-auto">
              {cs
                ? 'Připojte se k naší PPLNS pool s 89% podílem pro těžaře a podporujte humanitární těžbu.'
                : 'Join our PPLNS pool with 89% miner share and support humanitarian mining.'}
            </p>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <Link href="/pool#start-mining" className="zion-button-primary text-sm px-5 py-3">
                <Zap className="h-4 w-4" />
                {cs ? 'Začít těžit' : 'Start Mining'}
              </Link>
              <Link href="/pool" className="zion-button-secondary text-sm px-5 py-3">
                <Server className="h-4 w-4" />
                {cs ? 'Statistiky poolu' : 'View Pool Stats'}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════ */

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center justify-between text-xs font-medium text-gray-400">
        <span>{label}</span>
        {hint && <span className="text-[10px] text-gray-600">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function ResultCard({
  icon,
  title,
  big,
  bigLabel,
  sub,
  subLabel,
  style,
  highlight,
}: {
  icon: React.ReactNode;
  title: string;
  big: string;
  bigLabel: string;
  sub: string;
  subLabel: string;
  style: React.CSSProperties;
  highlight?: 'positive' | 'negative';
}) {
  const bigColor =
    highlight === 'positive'
      ? 'text-emerald-400'
      : highlight === 'negative'
      ? 'text-red-400'
      : 'text-white';
  return (
    <div className="zion-rainbow-sub p-5" style={style}>
      <div className="relative z-[1]">
        <div className="mb-3 flex items-center gap-2">
          {icon}
          <span className="text-xs font-medium text-gray-400">{title}</span>
        </div>
        <div className={`text-2xl font-bold font-mono ${bigColor}`}>{big}</div>
        <div className="mt-0.5 text-xs text-gray-500">{bigLabel}</div>
        <div className="mt-3 border-t border-white/5 pt-2">
          <div className="font-mono text-sm text-gray-300">{sub}</div>
          <div className="text-xs text-gray-500">{subLabel}</div>
        </div>
      </div>
    </div>
  );
}

/* ─── Price sparkline SVG ─── */
function PriceSparkline({ values, current }: { values: number[]; current: number }) {
  const W = 480;
  const H = 160;
  const PAD = { top: 12, right: 12, bottom: 16, left: 12 };
  const cw = W - PAD.left - PAD.right;
  const ch = H - PAD.top - PAD.bottom;
  const all = [...values, current];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const range = max - min || 1;
  const pts = all.map((v, i) => ({
    x: PAD.left + (i / Math.max(all.length - 1, 1)) * cw,
    y: PAD.top + ch - ((v - min) / range) * ch,
  }));
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = `${pathD} L ${pts[pts.length - 1].x} ${PAD.top + ch} L ${pts[0].x} ${PAD.top + ch} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height: 160 }}>
      <defs>
        <linearGradient id="price-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="price-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#price-grad)" />
      <path d={pathD} fill="none" stroke="url(#price-line)" strokeWidth="2" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="3" fill="#10b981" />
    </svg>
  );
}

/* ─── Profitability timeline SVG ─── */
function ProfitTimeline({ points }: { points: { day: number; cum: number }[] }) {
  const W = 480;
  const H = 160;
  const PAD = { top: 12, right: 12, bottom: 16, left: 12 };
  const cw = W - PAD.left - PAD.right;
  const ch = H - PAD.top - PAD.bottom;
  if (!points.length) return <div className="h-40" />;
  const vals = points.map((p) => p.cum);
  const min = Math.min(...vals, 0);
  const max = Math.max(...vals, 0);
  const range = max - min || 1;
  const yOf = (v: number) => PAD.top + ch - ((v - min) / range) * ch;
  const xOf = (i: number) => PAD.left + (i / Math.max(points.length - 1, 1)) * cw;
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i)} ${yOf(p.cum)}`).join(' ');
  const areaD = `${pathD} L ${xOf(points.length - 1)} ${PAD.top + ch} L ${xOf(0)} ${PAD.top + ch} Z`;
  const zeroY = yOf(0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height: 160 }}>
      <defs>
        <linearGradient id="profit-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9333ea" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#9333ea" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* zero line */}
      <line x1={PAD.left} x2={W - PAD.right} y1={zeroY} y2={zeroY} stroke="rgba(255,255,255,0.2)" strokeDasharray="3" />
      <text x={PAD.left + 2} y={zeroY - 3} fill="rgba(255,255,255,0.3)" fontSize="8" fontFamily="monospace">$0</text>
      <path d={areaD} fill="url(#profit-grad)" />
      <path d={pathD} fill="none" stroke="#a855f7" strokeWidth="2" strokeLinejoin="round" />
      <circle cx={xOf(points.length - 1)} cy={yOf(points[points.length - 1].cum)} r="3" fill="#a855f7" />
    </svg>
  );
}
