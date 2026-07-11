'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useState, useCallback, useEffect } from 'react';
import {
  ArrowLeftRight,
  Wallet,
  Layers,
  ExternalLink,
  Activity,
  RefreshCw,
  BarChart3,
  Flame,
  Link2,
  Lock,
  CheckCircle2,
  ArrowRight,
  PiggyBank,
  Sprout,
  Scale,
  Droplets,
  AlertTriangle,
  TrendingUp,
  Gavel,
  Clock,
  Trophy,
  ChefHat,
  Globe,
  Sparkles,
  Zap,
  ShieldCheck,
  HelpCircle,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { useWallet } from '@/contexts/WalletContext';
import SwapWidget from '@/components/SwapWidget';
import LiFiWidget from '@/components/LiFiWidget';
import BridgeBurnWidget from '@/components/BridgeBurnWidget';
import DefiBalances from '@/components/DefiBalances';
import StakingPanel from '@/components/StakingPanel';
import FarmingPanel from '@/components/FarmingPanel';
import GovernancePanel from '@/components/GovernancePanel';
import { CONTRACTS, SEED_PRICE_USD, CCA_AUCTION_PARAMS, PANCAKE_V3 } from '@/lib/defi-contracts';
import { useNetworkStatus } from '@/hooks/useWebSocketSubscription';

// ─── Price Sparkline (SVG, no deps) ──────────────────────────────────────────

function PriceSparkline({
  prices,
  width = 400,
  height = 80,
}: {
  prices: number[];
  width?: number;
  height?: number;
}) {
  if (prices.length < 2) return null;
  const pad = 4;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || max * 0.01;
  const pts = prices.map((p, i) => {
    const x = pad + (i / (prices.length - 1)) * w;
    const y = pad + h - ((p - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const polyline = pts.join(' ');
  // Fill area
  const first = pts[0];
  const last = pts[pts.length - 1];
  const fillPts = `${first} ${polyline} ${last.split(',')[0]},${pad + h} ${pad},${pad + h}`;
  const up = prices[prices.length - 1] >= prices[0];
  const stroke = up ? '#10b981' : '#f87171';
  const fillId = `spark-fill-${Math.random().toString(36).slice(2, 7)}`;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.25" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <polygon points={fillPts} fill={`url(#${fillId})`} />
      <polyline points={polyline} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      {/* last dot */}
      <circle
        cx={parseFloat(pts[pts.length - 1].split(',')[0])}
        cy={parseFloat(pts[pts.length - 1].split(',')[1])}
        r="2.5"
        fill={stroke}
      />
    </svg>
  );
}

// ─── Stat Card helper (matches /pool) ───────────────────────────────────────

function StatCard({
  icon,
  colorClass,
  bgClass,
  label,
  value,
  sub,
  tip,
}: {
  icon: React.ReactNode;
  colorClass: string;
  bgClass: string;
  label: string;
  value: string;
  sub?: string;
  tip?: string;
}) {
  return (
    <div className="zion-rainbow-sub p-4" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
      <div className={`flex items-center justify-center h-8 w-8 rounded-xl ${bgClass} mb-3 ${colorClass}`}>
        {icon}
      </div>
      <div className="flex items-center gap-1 mb-0.5">
        <p className="text-[11px] text-gray-500 uppercase tracking-wider">{label}</p>
        {tip && (
          <div className="relative group/tooltip">
            <HelpCircle className="h-3 w-3 text-gray-600 cursor-help" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/tooltip:block w-44 rounded-lg border border-white/10 bg-black/90 backdrop-blur-xl px-2 py-1.5 text-[10px] text-gray-300 shadow-xl z-20">
              {tip}
            </div>
          </div>
        )}
      </div>
      <p className="text-lg font-bold text-white font-mono mt-0.5">{value}</p>
      {sub && <p className="text-[11px] text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── DeFi Sections (same pattern as /pool) ──────────────────────────────────

type SectionTab = 'overview' | 'swap' | 'earn' | 'bridge' | 'governance' | 'pools' | 'auction';

const SECTIONS: { key: SectionTab; labelCs: string; labelEn: string; icon: typeof Activity }[] = [
  { key: 'overview', labelCs: 'Přehled', labelEn: 'Overview', icon: Activity },
  { key: 'swap', labelCs: 'Swap', labelEn: 'Swap', icon: RefreshCw },
  { key: 'earn', labelCs: 'Výnosy', labelEn: 'Earn', icon: TrendingUp },
  { key: 'bridge', labelCs: 'Bridge', labelEn: 'Bridge', icon: ArrowLeftRight },
  { key: 'governance', labelCs: 'Governance', labelEn: 'Governance', icon: Scale },
  { key: 'pools', labelCs: 'Pooly', labelEn: 'Pools', icon: Droplets },
  { key: 'auction', labelCs: 'Aukce', labelEn: 'Auction', icon: Gavel },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function DefiPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const { connected, account, isBaseMainnet, connect, switchToBase } = useWallet();
  const [activeTab, setActiveTab] = useState<SectionTab>('overview');
  const [wZIONSupply, setWZIONSupply] = useState<string | null>(null);
  const [wZIONPrice, setWZIONPrice] = useState<{ wzion_per_weth: number; usd_per_wzion: number } | null>(null);
  // Chart data from GeckoTerminal OHLCV (loaded immediately, refreshed every 60s)
  const [chartPrices, setChartPrices] = useState<number[]>([]);
  const [chartLoading, setChartLoading] = useState(true);
  const [bridgeStatus, setBridgeStatus] = useState<{
    online: boolean;
    l1_locks_detected: number;
    l1_locks_finalized: number;
    evm_mints_confirmed: number;
    evm_burns_detected: number;
    l1_unlocks_submitted: number;
    l1_unlocks_confirmed: number;
    last_l1_height: number;
    errors_total: number;
  } | null>(null);
  interface PoolEntry {
    pair: string;
    dex: string;
    fee: number;
    feeLabel: string;
    active: boolean;
    tick: number;
    balances: Record<string, number | string>;
    price_usd: number;
    tvl_usd: number;
  }

  const [poolStats, setPoolStats] = useState<{
    tvl_usd: number;
    total_wzion_liquidity: number;
    active_pools: number;
    total_pools: number;
    wzion_supply: number;
    deployer_wzion: number;
    primary_price_usd: number;
    primary_dex: string;
    pools: {
      wzion_usdt: PoolEntry;
      wzion_weth: PoolEntry;
      wzion_sol: PoolEntry;
      ps_wzion_usdt: PoolEntry;
    };
    contracts?: {
      staking: { wzion: number };
      farm: { wzion: number };
      treasury: { wzion: number };
      governance: { wzion: number };
      bridge: { wzion: number };
    };
  } | null>(null);
  const [auctionData, setAuctionData] = useState<{
    clearingPriceUsd: number;
    currencyRaised: number;
    totalCleared: number;
    remainingSupply: number;
    isGraduated: boolean;
    wzionBalance: number;
    usdcBalance: number;
    currentBlock: number;
    progressPct: number;
    daysRemaining: number;
    pctSold: number;
  } | null>(null);

  // ── WebSocket subscription for real-time network status ─────────────────────
  const { data: _networkStatus, isConnected: wsConnected } = useNetworkStatus(true);

  // ── Fetch wZION total supply from API ──────────────────────────────────────

  const fetchSupply = useCallback(async () => {
    try {
      const res = await fetch('/api/defi/status');
      if (!res.ok) return null;
      const data = await res.json();
      return data.ok ? data.data?.wZION?.totalSupply ?? null : null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const refreshSupply = async () => {
      const supply = await fetchSupply();
      if (!cancelled) setWZIONSupply(supply);
    };

    const refreshPrice = async () => {
      try {
        const res = await fetch('/api/defi/price');
        if (!res.ok) return;
        const data = await res.json();
        if (data.ok && !cancelled) {
          setWZIONPrice({
            wzion_per_weth: data.price.wzion_per_weth,
            usd_per_wzion: data.price.usd_per_wzion,
          });
        }
      } catch { /* ignore */ }
    };

    const refreshChart = async () => {
      try {
        const res = await fetch('/api/defi/chart', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.ok && Array.isArray(data.prices) && data.prices.length > 0) {
          setChartPrices(data.prices);
          setChartLoading(false);
        } else if (!cancelled) {
          setChartLoading(false);
        }
      } catch {
        if (!cancelled) setChartLoading(false);
      }
    };

    void refreshSupply();
    void refreshPrice();
    void refreshChart();

    const refreshBridge = async () => {
      try {
        const res = await fetch('/api/bridge/status', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setBridgeStatus(data);
      } catch { /* ignore */ }
    };
    void refreshBridge();

    const refreshPools = async () => {
      try {
        const res = await fetch('/api/defi/pools', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.ok) {
          const primary = data.pools?.wzion_usdt?.active ? data.pools.wzion_usdt : null;
          setPoolStats({
            tvl_usd: data.summary?.total_tvl_usd ?? 0,
            total_wzion_liquidity: data.summary?.total_wzion_liquidity ?? 0,
            active_pools: data.summary?.active_pools ?? 0,
            total_pools: data.summary?.total_pools ?? 0,
            wzion_supply: data.summary?.wzion_supply ?? 0,
            deployer_wzion: data.summary?.deployer_wzion ?? 0,
            primary_price_usd: primary?.price_usd ?? data.pools?.wzion_usdt?.price_usd ?? 0,
            primary_dex: data.primary_dex ?? 'Uniswap V3',
            pools: {
              wzion_usdt: data.pools?.wzion_usdt ?? defaultPoolEntry('wZION/USDT', '0.3%'),
              wzion_weth: data.pools?.wzion_weth ?? defaultPoolEntry('ETH/wZION', '1.0%'),
              wzion_sol: data.pools?.wzion_sol ?? defaultPoolEntry('wZION/SOL', '0.01%'),
              ps_wzion_usdt: data.pools?.ps_wzion_usdt ?? defaultPoolEntry('wZION/USDT', '0.25%'),
            },
            contracts: data.contracts,
          });
        }
      } catch { /* ignore */ }
    };

    function defaultPoolEntry(pair: string, feeLabel: string): PoolEntry {
      return {
        pair,
        dex: 'Uniswap V3',
        fee: 0,
        feeLabel,
        active: false,
        tick: 0,
        balances: { wzion: 0, token1: 0, token1Symbol: 'USDT' },
        price_usd: 0,
        tvl_usd: 0,
      };
    }
    void refreshPools();

    const refreshAuction = async () => {
      try {
        const res = await fetch('/api/defi/auction', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.ok) setAuctionData({
          clearingPriceUsd: data.clearingPriceUsd ?? 0,
          currencyRaised: data.currencyRaised ?? 0,
          totalCleared: data.totalCleared ?? 0,
          remainingSupply: data.remainingSupply ?? 0,
          isGraduated: data.isGraduated ?? false,
          wzionBalance: data.wzionBalance ?? 0,
          usdcBalance: data.usdcBalance ?? 0,
          currentBlock: data.currentBlock ?? 0,
          progressPct: data.progressPct ?? 0,
          daysRemaining: data.daysRemaining ?? 0,
          pctSold: data.pctSold ?? 0,
        });
      } catch { /* ignore */ }
    };
    void refreshAuction();

    const interval = setInterval(() => {
      void refreshSupply();
      void refreshPrice();
      void refreshBridge();
      void refreshPools();
      void refreshChart();
      void refreshAuction();
    }, 60_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [fetchSupply]);

  return (
    <div className="zion-page bg-black text-white">
      {/* Background glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-36 -left-28 h-[520px] w-[520px] rounded-full bg-zion-purple/18 blur-3xl" />
        <div className="absolute top-40 -right-24 h-[420px] w-[420px] rounded-full bg-zion-cyan/14 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-[420px] w-[620px] rounded-full bg-zion-gold/10 blur-3xl" />
      </div>

      {/* ═══════ HERO ═══════ */}
      <section className="zion-container relative z-10 mb-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="zion-rainbow-card p-6 md:p-10"
          style={{ '--rc': '147, 51, 234' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-zion-gold/40 bg-zion-gold/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-gold uppercase">
                <Sparkles className="h-4 w-4" />
                {cs ? 'DeFi Hub · Base Mainnet' : 'DeFi Hub · Base Mainnet'}
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-gray-400">{cs ? 'wZION ekosystém' : 'wZION ecosystem'}</p>
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-gradient leading-tight">
                  {cs ? 'Spravuj wZION' : 'Manage wZION'}
                </h1>
              </div>
              <p className="text-lg text-gray-300 max-w-2xl">
                {cs
                  ? 'Swapuj, přemosťuj a spravuj wZION na Base. Reálné kontrakty, reálná likvidita, živé ceny z on-chain poolů.'
                  : 'Swap, bridge, and manage wZION on Base. Real contracts, real liquidity, live prices from on-chain pools.'}
              </p>
              <div className="flex flex-wrap gap-3 text-xs">
                <span className={wsConnected ? 'zion-badge-green' : 'zion-badge'}>
                  <Zap className={`h-3 w-3 ${wsConnected ? 'text-emerald-400' : 'text-zion-gold'}`} />
                  {wsConnected ? (cs ? 'Živě' : 'Live') : (cs ? 'Polling' : 'Polling')}
                </span>
                <span className="zion-badge">
                  <RefreshCw className="h-3 w-3 text-emerald-400" /> {cs ? 'Auto-refresh 60 s' : 'Auto-Refresh 60s'}
                </span>
                <span className="zion-badge">
                  <Globe className="h-3 w-3 text-zion-cyan" /> Base
                </span>
                <span className="zion-badge-green">
                  {cs ? 'wZION/USDT · Uniswap V3' : 'wZION/USDT · Uniswap V3'}
                </span>
              </div>
            </div>

            {/* Quick info / connect side card */}
            <div className="w-full lg:max-w-md space-y-3">
              <div className="zion-rainbow-sub p-5" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">{cs ? 'Rychlý přehled' : 'Quick Overview'}</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between zion-rainbow-sub p-3" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <BarChart3 className="h-4 w-4 text-amber-400" />
                      {cs ? 'Cena' : 'Price'}
                    </div>
                    <span className="font-mono text-white">
                      ${(poolStats?.primary_price_usd ?? wZIONPrice?.usd_per_wzion ?? SEED_PRICE_USD).toFixed(5)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between zion-rainbow-sub p-3" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <Droplets className="h-4 w-4 text-amber-400" />
                      TVL
                    </div>
                    <span className="font-mono text-white">${(poolStats?.tvl_usd ?? 0).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between zion-rainbow-sub p-3" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <Activity className="h-4 w-4 text-amber-400" />
                      {cs ? 'Supply' : 'Supply'}
                    </div>
                    <span className="font-mono text-white">{wZIONSupply ?? '—'}</span>
                  </div>
                  {connected ? (
                    <div className="zion-rainbow-sub p-3" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="font-mono text-xs text-emerald-300">
                            {account?.slice(0, 6)}…{account?.slice(-4)}
                          </span>
                        </div>
                        {isBaseMainnet ? (
                          <span className="text-[10px] text-gray-400">Base</span>
                        ) : (
                          <button
                            onClick={switchToBase}
                            className="zion-button-secondary !px-2 !py-1 !text-[10px]"
                          >
                            {cs ? 'Přepnout' : 'Switch'}
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={connect}
                      className="w-full zion-button-primary"
                    >
                      <Wallet className="h-3.5 w-3.5" />
                      {cs ? 'Připojit peněženku' : 'Connect Wallet'}
                    </button>
                  )}
                </div>
                <a
                  href={`https://app.uniswap.org/swap?chain=base&inputCurrency=ETH&outputCurrency=${CONTRACTS.wZION}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-2 text-sm text-zion-cyan hover:text-white transition-colors"
                >
                  {cs ? 'Otevřít Uniswap' : 'Open Uniswap'} <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ═══════ DeFi SECTION TABS ═══════ */}
      <section className="zion-container relative z-10 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.02 }}
          className="zion-rainbow-card p-4 md:p-5"
          style={{ '--rc': '147, 51, 234' } as React.CSSProperties}
        >
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <span className="text-[10px] uppercase tracking-[0.3em] text-gray-500 mr-1 hidden sm:inline">
              {cs ? 'DeFi sekce' : 'DeFi sections'}
            </span>
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              const isActive = activeTab === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => setActiveTab(s.key)}
                  className={`inline-flex items-center gap-2 rounded-xl px-3 md:px-4 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'zion-rainbow-sub'
                      : 'border border-white/10 bg-black/40 text-gray-300 hover:border-white/25 hover:text-white'
                  }`}
                  style={isActive ? ({ '--rc': '147, 51, 234' } as React.CSSProperties) : undefined}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {cs ? s.labelCs : s.labelEn}
                </button>
              );
            })}
          </div>
        </motion.div>
      </section>

      {activeTab === 'overview' && (
      <>
        {/* ═══════ Low Liquidity Warning ═══════ */}
        {(poolStats?.tvl_usd ?? 0) < 500 && (
          <section className="zion-container relative z-10 mb-6">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.03 }}
              className="zion-rainbow-card p-4"
              style={{ '--rc': '245, 158, 11' } as React.CSSProperties}
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-amber-200 mb-1">
                    {cs ? 'Nízká DEX likvidita' : 'Low DEX Liquidity'}
                  </h3>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    {cs
                      ? `Aktuální aktivní likvidita na DEX je nízká (~$${(poolStats?.tvl_usd ?? 0).toFixed(2)} TVL). Velké swapy mohou mít výrazný price impact. Doporučujeme používat malé částky nebo přidat likviditu do Uniswap V3 wZION/USDT poolu.`
                      : `Current active DEX liquidity is low (~$${(poolStats?.tvl_usd ?? 0).toFixed(2)} TVL). Large swaps may have significant price impact. Consider small amounts or add liquidity to the Uniswap V3 wZION/USDT pool.`}
                  </p>
                </div>
              </div>
            </motion.div>
          </section>
        )}

        {/* ═══════ DeFi TELEMETRY ═══════ */}
        <section className="zion-container relative z-10 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 }}
            className="zion-rainbow-card p-5 md:p-6"
            style={{ '--rc': '147, 51, 234' } as React.CSSProperties}
          >
            <div className="flex flex-col gap-2 mb-6">
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Telemetrie' : 'Telemetry'}</p>
              <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
                <Activity className="h-7 w-7 text-emerald-400" />
                {cs ? 'DeFi telemetrie' : 'DeFi Telemetry'}
              </h2>
              <p className="text-sm text-gray-400">
                {cs
                  ? 'Metriky wZION agregované z Base kontraktů, pool API a bridge relayeru v reálném čase.'
                  : 'wZION metrics aggregated from Base contracts, pool API, and bridge relayer in real time.'}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <StatCard
                icon={<TrendingUp className="h-5 w-5" />}
                colorClass="text-zion-gold"
                bgClass="bg-zion-gold/10"

                label={cs ? 'Cena' : 'Price'}
                value={`$${(poolStats?.primary_price_usd ?? wZIONPrice?.usd_per_wzion ?? SEED_PRICE_USD).toFixed(6)}`}
                sub="USDT / wZION"
                tip={cs ? 'Aktuální cena z primárního wZION/USDT poolu nebo seed cena.' : 'Current price from the primary wZION/USDT pool or seed price.'}
              />
              <StatCard
                icon={<Droplets className="h-5 w-5" />}
                colorClass="text-zion-cyan"
                bgClass="bg-zion-cyan/10"

                label="TVL"
                value={`$${(poolStats?.tvl_usd ?? 0).toFixed(2)}`}
                sub={cs ? 'celkem v poolech' : 'total in pools'}
              />
              <StatCard
                icon={<Activity className="h-5 w-5" />}
                colorClass="text-emerald-400"
                bgClass="bg-emerald-400/10"

                label={cs ? 'Likvidita' : 'Liquidity'}
                value={`${(poolStats?.total_wzion_liquidity ?? 0).toFixed(0)}`}
                sub="wZION"
              />
              <StatCard
                icon={<Layers className="h-5 w-5" />}
                colorClass="text-purple-400"
                bgClass="bg-purple-400/10"

                label={cs ? 'Pooly' : 'Pools'}
                value={String(poolStats?.active_pools ?? 0)}
                sub={cs ? 'aktivní' : 'active'}
              />
              <StatCard
                icon={<Wallet className="h-5 w-5" />}
                colorClass="text-pink-400"
                bgClass="bg-pink-400/10"

                label={cs ? 'wZION Supply' : 'wZION Supply'}
                value={wZIONSupply ?? '—'}
                sub={cs ? 'celkový oběh' : 'total circulating'}
              />
              <StatCard
                icon={<ArrowLeftRight className="h-5 w-5" />}
                colorClass="text-orange-400"
                bgClass="bg-orange-400/10"

                label={cs ? 'Bridge' : 'Bridge'}
                value={bridgeStatus?.online ? (cs ? 'Online' : 'Online') : (cs ? 'Offline' : 'Offline')}
                sub={cs ? '5/5 validátorů' : '5/5 validators'}
              />
              <StatCard
                icon={<ShieldCheck className="h-5 w-5" />}
                colorClass="text-blue-400"
                bgClass="bg-blue-400/10"

                label={cs ? 'Validátoři' : 'Validators'}
                value="5/5"
                sub={cs ? 'Guardian relay' : 'Guardian relay'}
              />
              <StatCard
                icon={<Gavel className="h-5 w-5" />}
                colorClass="text-amber-400"
                bgClass="bg-amber-400/10"

                label={cs ? 'Aukce' : 'Auction'}
                value={`${(auctionData?.pctSold ?? 0).toFixed(2)}%`}
                sub={cs ? 'prodáno CCA' : 'CCA sold'}
              />
            </div>
          </motion.div>
        </section>

        {/* ═══════ wZION/USDT Price Chart ═══════ */}
        <section className="zion-container relative z-10 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }}
            className="zion-rainbow-card p-5"
            style={{ '--rc': '147, 51, 234' } as React.CSSProperties}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <TrendingUp className="h-4 w-4 text-zion-gold" />
                <span className="text-sm font-semibold text-white">wZION / USDT</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-zion-gold/20 text-zion-gold border border-zion-gold/30">
                  {cs ? 'primární' : 'primary'}
                </span>
                <span className="text-[10px] text-gray-500">0.3% fee · Base Mainnet</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-lg font-bold font-mono text-white">
                    ${(poolStats?.primary_price_usd ?? wZIONPrice?.usd_per_wzion ?? SEED_PRICE_USD).toFixed(6)}
                  </p>
                  {chartPrices.length >= 2 && (() => {
                    const chg = ((chartPrices[chartPrices.length - 1] - chartPrices[0]) / chartPrices[0]) * 100;
                    return (
                      <p className={`text-[10px] text-right ${chg >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {chg >= 0 ? '+' : ''}{chg.toFixed(2)}% ({cs ? '1h' : '1h'})
                      </p>
                    );
                  })()}
                </div>
                <a
                  href={`https://dexscreener.com/base/${CONTRACTS.UniV3PoolUSDT}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
                >
                  DexScreener <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            <div className="relative h-48 w-full">
              {chartPrices.length >= 2 ? (
                <PriceSparkline prices={chartPrices} height={192} />
              ) : chartLoading ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-xs text-gray-600 animate-pulse">
                    {cs ? 'Načítám cenová data…' : 'Loading price data…'}
                  </p>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <p className="text-xs text-gray-600">
                    {cs ? 'Cenová data zatím nedostupná' : 'Price data not available yet'}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
              <div className="zion-rainbow-sub p-2" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                <p className="text-gray-500 mb-0.5">TVL</p>
                <p className="text-white font-mono">${(poolStats?.tvl_usd ?? 0).toFixed(2)}</p>
              </div>
              <div className="zion-rainbow-sub p-2" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                <p className="text-gray-500 mb-0.5">{cs ? 'Likvidita' : 'Liquidity'}</p>
                <p className="text-white font-mono">
                  {(poolStats?.total_wzion_liquidity ?? 0) > 0
                    ? `${(poolStats!.total_wzion_liquidity).toLocaleString(undefined, { maximumFractionDigits: 0 })} wZION`
                    : '—'}
                </p>
              </div>
              <div className="zion-rainbow-sub p-2" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                <p className="text-gray-500 mb-0.5">USDT</p>
                <p className="text-white font-mono">
                  {(Number(poolStats?.pools?.wzion_usdt?.balances?.usdt ?? 0)) > 0
                    ? (Number(poolStats!.pools.wzion_usdt.balances.usdt)).toLocaleString(undefined, { maximumFractionDigits: 2 })
                    : '—'}
                </p>
              </div>
              <div className="zion-rainbow-sub p-2" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                <p className="text-gray-500 mb-0.5">Tick</p>
                <p className="text-white font-mono">{poolStats?.pools?.wzion_usdt?.tick ?? '—'}</p>
              </div>
              <div className="zion-rainbow-sub p-2" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                <p className="text-gray-500 mb-0.5">{cs ? 'Stav' : 'Status'}</p>
                <p className={poolStats?.pools?.wzion_usdt?.active ? 'text-emerald-400' : 'text-amber-400'}>
                  {poolStats?.pools?.wzion_usdt?.active ? (cs ? 'aktivní' : 'active') : (poolStats ? (cs ? 'neaktivní' : 'inactive') : (cs ? 'načítám' : 'loading'))}
                </p>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ═══════ Contract Addresses ═══════ */}
        <section className="zion-container relative z-10 mb-20">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
          >
            <div className="flex flex-col gap-2 mb-6">
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Kontrakty' : 'Contracts'}</p>
              <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
                <Layers className="h-7 w-7 text-zion-cyan" />
                {cs ? 'Kontrakty na Base Mainnet' : 'Base Mainnet Contracts'}
              </h2>
            </div>
            <div className="zion-rainbow-card overflow-hidden p-0" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5">
                      <th className="p-4 text-left font-medium text-gray-400">{cs ? 'Kontrakt' : 'Contract'}</th>
                      <th className="p-4 text-left font-medium text-gray-400">{cs ? 'Adresa' : 'Address'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(CONTRACTS).map(([name, addr]) => (
                      <tr key={name} className="border-b border-white/5 hover:bg-white/3">
                        <td className="p-4 font-mono text-gray-200">{name}</td>
                        <td className="p-4">
                          <a
                            href={`https://basescan.org/address/${addr}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-xs text-zion-gold/80 transition-colors hover:text-zion-gold inline-flex items-center gap-1"
                          >
                            {addr}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ═══════ CTA ═══════ */}
        <section className="zion-container relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="zion-cta-banner"
          >
            <h2 className="text-2xl font-bold mb-3">
              {cs ? 'Obchoduj wZION' : 'Trade wZION'}
            </h2>
            <p className="mx-auto mb-6 max-w-lg text-gray-100">
              {cs
                ? 'wZION je k dispozici na Uniswap V3 (Base). Primární pool wZION/USDT s 0.3% fee.'
                : 'wZION is available on Uniswap V3 (Base). Primary wZION/USDT pool with 0.3% fee.'}
            </p>
            <div className="flex justify-center gap-4 flex-wrap">
              <a
                href={`https://app.uniswap.org/swap?chain=base&inputCurrency=${CONTRACTS.USDT}&outputCurrency=${CONTRACTS.wZION}`}
                target="_blank"
                rel="noopener noreferrer"
                className="zion-button-primary"
              >
                {cs ? 'Otevřít Uniswap' : 'Open Uniswap'}
                <ExternalLink className="h-4 w-4" />
              </a>
              <a
                href={`https://dexscreener.com/base/${CONTRACTS.UniV3PoolUSDT}`}
                target="_blank"
                rel="noopener noreferrer"
                className="zion-button-secondary"
              >
                DexScreener
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </motion.div>
        </section>
      </>
      )}

      {activeTab === 'swap' && (
      <>
        {/* ═══════ TRADE wZION ═══════ */}
        <section className="zion-container relative z-10 mb-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="flex flex-col gap-2 mb-6">
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Obchodování' : 'Trade'}</p>
              <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
                <RefreshCw className="h-7 w-7 text-zion-cyan" />
                {cs ? 'Obchoduj wZION' : 'Trade wZION'}
              </h2>
              <p className="text-sm text-gray-400">{cs ? 'Swapuj, obchoduj na DEX a sleduj cenu wZION na Base Mainnet.' : 'Swap, trade on DEX, and track the wZION price on Base Mainnet.'}</p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div
                className="zion-rainbow-card p-5"
                style={{ '--rc': '147, 51, 234' } as React.CSSProperties}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/20">
                      <RefreshCw className="h-5 w-5 text-purple-400" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-white">{cs ? 'Swap wZION' : 'Swap wZION'}</h3>
                      <p className="text-[11px] text-gray-500">{cs ? 'LiFi + Uniswap integrace' : 'LiFi + Uniswap integration'}</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-[10px] font-semibold text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {cs ? 'Živě' : 'Live'}
                  </span>
                </div>
                <p className="text-sm text-gray-300 leading-relaxed mb-3">{cs ? 'Okamžitý swap mezi wZION, ETH, USDT a dalšími tokeny. LiFi agreguje 30+ DEX a 20+ bridge.' : 'Instant swap between wZION, ETH, USDT, and other tokens. LiFi aggregates 30+ DEX and 20+ bridges.'}</p>
                <div className="flex items-center gap-2 text-sm text-zion-cyan hover:text-white transition-colors">
                  <span>{cs ? 'Swap níže' : 'Swap below'}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </div>

              <Link
                href="https://app.uniswap.org/swap?chain=base&inputCurrency=ETH&outputCurrency=0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6"
                target="_blank"
                rel="noopener noreferrer"
                className="zion-rainbow-card p-5 transition-transform duration-200 hover:scale-[1.01] block"
                style={{ '--rc': '245, 158, 11' } as React.CSSProperties}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20">
                      <Droplets className="h-5 w-5 text-amber-400" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-white">{cs ? 'DEX Pooly' : 'DEX Pools'}</h3>
                      <p className="text-[11px] text-gray-500">{cs ? 'Uniswap V3' : 'Uniswap V3'}</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-[10px] font-semibold text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {cs ? 'Živě' : 'Live'}
                  </span>
                </div>
                <p className="text-sm text-gray-300 leading-relaxed mb-3">{cs ? 'wZION/USDT primární pool na Uniswap V3. Sekundární pooly WETH/SOL jsou inicializované, ale bez aktivní likvidity.' : 'wZION/USDT primary pool on Uniswap V3. Secondary WETH/SOL pools are initialized but carry no active liquidity.'}</p>
                <div className="flex items-center gap-2 text-sm text-zion-cyan hover:text-white transition-colors">
                  <span>{cs ? 'Otevřít Uniswap' : 'Open Uniswap'}</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </div>
              </Link>

              <Link
                href={CCA_AUCTION_PARAMS.uniswapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="zion-rainbow-card p-5 transition-transform duration-200 hover:scale-[1.01] block"
                style={{ '--rc': '245, 158, 11' } as React.CSSProperties}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20">
                      <Gavel className="h-5 w-5 text-amber-400" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-white">{cs ? 'CCA Aukce' : 'CCA Auction'}</h3>
                      <p className="text-[11px] text-gray-500">{cs ? '66.47M wZION za USDC' : '66.47M wZION for USDC'}</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 px-3 py-1 text-[10px] font-semibold text-amber-400">
                    <Clock className="h-3.5 w-3.5" />
                    {cs ? 'Aktivní' : 'Active'}
                  </span>
                </div>
                <p className="text-sm text-gray-300 leading-relaxed mb-3">{cs ? 'Continuous Clearing Auction na Uniswap. Vyklízecí cena se kontinuálně upravuje podle poptávky.' : 'Continuous Clearing Auction on Uniswap. Clearing price continuously adjusts based on demand.'}</p>
                <div className="flex items-center gap-2 text-sm text-zion-cyan hover:text-white transition-colors">
                  <span>{cs ? 'Přihazovat' : 'Place bids'}</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </div>
              </Link>

              <Link
                href={PANCAKE_V3.swapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="zion-rainbow-card p-5 transition-transform duration-200 hover:scale-[1.01] block"
                style={{ '--rc': '245, 158, 11' } as React.CSSProperties}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20">
                      <ChefHat className="h-5 w-5 text-amber-400" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-white">PancakeSwap V3</h3>
                      <p className="text-[11px] text-gray-500">{cs ? '2. největší DEX na Base' : '2nd largest DEX on Base'}</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-[10px] font-semibold text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {cs ? 'Živě' : 'Live'}
                  </span>
                </div>
                <p className="text-sm text-gray-300 leading-relaxed mb-3">{cs ? 'wZION/USDT pool na PancakeSwap V3. Další možnost likvidity a swapu pro wZION.' : 'wZION/USDT pool on PancakeSwap V3. Another liquidity and swap option for wZION.'}</p>
                <div className="flex items-center gap-2 text-sm text-zion-cyan hover:text-white transition-colors">
                  <span>{cs ? 'Swap na PancakeSwap' : 'Swap on PancakeSwap'}</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </div>
              </Link>
            </div>
          </motion.div>
        </section>

        {/* ═══════ Real Swap Widgets ═══════ */}
        <section className="zion-container relative z-10 mb-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="space-y-6 max-w-5xl"
          >
            <div className="zion-rainbow-card p-5 md:p-6" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
              <div className="flex items-center gap-2 mb-4">
                <RefreshCw className="h-4 w-4 text-purple-400" />
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider">{cs ? 'Cross-chain swap' : 'Cross-chain Swap'}</h3>
              </div>
              <LiFiWidget />
            </div>
            <div className="zion-rainbow-card p-5" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
              <div className="flex items-center gap-2 mb-4">
                <Droplets className="h-4 w-4 text-zion-purple" />
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider">{cs ? 'Direct swap + zůstatky' : 'Direct Swap + Balances'}</h3>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SwapWidget />
                <div className="space-y-6">
                  <DefiBalances />
                </div>
              </div>
            </div>
          </motion.div>
        </section>
      </>
      )}

      {activeTab === 'earn' && (
      <>
        {/* ═══════ EARN wZION ═══════ */}
        <section className="zion-container relative z-10 mb-10 space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col gap-2 mb-2"
          >
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Výnosy' : 'Yield'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <PiggyBank className="h-7 w-7 text-zion-gold" />
              {cs ? 'Získej wZION' : 'Earn wZION'}
            </h2>
            <p className="text-sm text-gray-400">{cs ? 'Stakeuj nebo farm wZION a získej pravidelné odměny.' : 'Stake or farm wZION to earn regular rewards.'}</p>
          </motion.div>

          <div className="zion-rainbow-card p-6" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
            <div className="zion-rainbow-sub p-4 mb-4" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-amber-400" />
                <h3 className="text-base font-semibold text-white">{cs ? 'Staking' : 'Staking'}</h3>
              </div>
            </div>
            <StakingPanel />
          </div>

          <div className="zion-rainbow-card p-6" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
            <div className="zion-rainbow-sub p-4 mb-4" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
              <div className="flex items-center gap-2">
                <Sprout className="h-5 w-5 text-amber-400" />
                <h3 className="text-base font-semibold text-white">{cs ? 'Farming' : 'Farming'}</h3>
              </div>
            </div>
            <FarmingPanel />
          </div>
        </section>
      </>
      )}

      {activeTab === 'bridge' && (
      <>
      {/* ═══════ BRIDGE PRODUCT ═══════ */}
      <section className="zion-container relative z-10 mb-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Infrastruktura' : 'Infrastructure'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <ArrowLeftRight className="h-7 w-7 text-zion-cyan" />
              {cs ? 'wZION Bridge' : 'wZION Bridge'}
            </h2>
            <p className="text-sm text-gray-400">{cs ? 'Přenos mezi L1 a L2 a on-chain řízení protokolu.' : 'Move between L1 and L2 and govern the protocol on-chain.'}</p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Link
              href="/bridge"
              className="zion-rainbow-card p-6 transition-transform duration-200 hover:scale-[1.01] block"
              style={{ '--rc': '147, 51, 234' } as React.CSSProperties}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/20">
                  <ArrowLeftRight className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">{cs ? 'wZION Bridge' : 'wZION Bridge'}</h3>
                  <p className="text-[11px] text-gray-500">{cs ? 'L1 ↔ Base · 5/5 validátorů' : 'L1 ↔ Base · 5/5 validators'}</p>
                </div>
              </div>
              <p className="text-sm text-gray-300 leading-relaxed mb-3">{cs ? 'Zamkni ZION na L1 a získej wZION na Base. Spal wZION pro odemčení zpět na L1. 1:1 peg, multi-validátorový relay.' : 'Lock ZION on L1 and receive wZION on Base. Burn wZION to unlock back to L1. 1:1 peg, multi-validator relay.'}</p>
              <div className="flex items-center gap-2 text-sm text-zion-cyan hover:text-white transition-colors">
                <span>{cs ? 'Otevřít bridge' : 'Open bridge'}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </Link>

            <div
              className="zion-rainbow-card p-6"
              style={{ '--rc': '245, 158, 11' } as React.CSSProperties}
            >
              <div className="flex items-center gap-2 mb-4">
                <Flame className="h-5 w-5 text-amber-400" />
                <h3 className="font-semibold text-white text-sm">
                  {cs ? 'Jak Bridge funguje' : 'How Bridge Works'}
                </h3>
              </div>
              <div className="space-y-3 text-xs text-gray-300 leading-relaxed">
                <div className="flex gap-3">
                  <span className="shrink-0 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 text-emerald-400 font-mono text-[10px]">L1→L2</span>
                  <p>{cs ? 'Zamkni ZION na L1 → relay mintne wZION na Base (1:1 peg)' : 'Lock ZION on L1 → relay mints wZION on Base (1:1 peg)'}</p>
                </div>
                <div className="flex gap-3">
                  <span className="shrink-0 rounded-lg bg-orange-500/10 border border-orange-500/20 px-2 py-1 text-orange-400 font-mono text-[10px]">L2→L1</span>
                  <p>{cs ? 'Spal wZION na Base → relay odemkne ZION na L1 (do ~5 min)' : 'Burn wZION on Base → relay unlocks ZION on L1 (within ~5 min)'}</p>
                </div>
              </div>
              <div className="pt-4 flex flex-wrap gap-2">
                <a
                  href={`https://basescan.org/address/${CONTRACTS.ZIONBridge}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="zion-button-secondary !px-3 !py-1.5 !text-[10px] !rounded-lg !text-gray-400 hover:!text-white"
                >
                  Bridge Contract <ExternalLink className="h-2.5 w-2.5" />
                </a>
                <a
                  href={`https://basescan.org/token/${CONTRACTS.wZION}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="zion-button-secondary !px-3 !py-1.5 !text-[10px] !rounded-lg !text-gray-400 hover:!text-white"
                >
                  wZION Token <ExternalLink className="h-2.5 w-2.5" />
                </a>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ═══════ Bridge Vault Status + Burn Widget ═══════ */}
      <section className="zion-container relative z-10 mb-20">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="space-y-6 max-w-5xl"
        >
          {/* Bridge Vault Status */}
          <div className="zion-rainbow-card p-6" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
            <div className="flex items-center gap-2 mb-4">
              <Lock className="h-5 w-5 text-purple-400" />
              <h3 className="font-semibold text-white text-sm">
                {cs ? 'Bridge Vault · 100M ZION' : 'Bridge Vault · 100M ZION'}
              </h3>
              <span className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-semibold ${
                bridgeStatus?.online
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${bridgeStatus?.online ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
                {bridgeStatus?.online ? (cs ? 'Relay Online' : 'Relay Online') : (cs ? 'Relay Offline' : 'Relay Offline')}
              </span>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              {cs
                ? '6 UTXO lock transakcí (~16.67M ZION každá) odesláno na bridge vault v blocích 11611–11612. Relay mintne wZION na Base po dosažení finality (60 bloků).'
                : '6 UTXO lock transactions (~16.67M ZION each) sent to the bridge vault in blocks 11611–11612. Relay mints wZION on Base after finality (60 blocks).'}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="zion-rainbow-sub p-3" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                <p className="text-[10px] uppercase tracking-wider text-gray-500">{cs ? 'Zamčeno' : 'Locked'}</p>
                <p className="text-base font-semibold text-white mt-1">~100M</p>
                <p className="text-[10px] text-gray-500">ZION</p>
              </div>
              <div className="zion-rainbow-sub p-3" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                <p className="text-[10px] uppercase tracking-wider text-gray-500">{cs ? 'Lock TX' : 'Lock TXs'}</p>
                <p className="text-base font-semibold text-white mt-1">6</p>
                <p className="text-[10px] text-gray-500">UTXO</p>
              </div>
              <div className="zion-rainbow-sub p-3" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                <p className="text-[10px] uppercase tracking-wider text-gray-500">{cs ? 'wZION Mints' : 'wZION Mints'}</p>
                <p className="text-base font-semibold text-white mt-1 flex items-center gap-1">
                  {bridgeStatus?.evm_mints_confirmed ?? '—'}
                  {bridgeStatus && bridgeStatus.evm_mints_confirmed > 0 && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  )}
                </p>
                <p className="text-[10px] text-gray-500">{cs ? 'potvrzeno' : 'confirmed'}</p>
              </div>
              <div className="zion-rainbow-sub p-3" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                <p className="text-[10px] uppercase tracking-wider text-gray-500">{cs ? 'L1 Odemčeno' : 'L1 Unlocks'}</p>
                <p className="text-base font-semibold text-white mt-1 flex items-center gap-1">
                  {bridgeStatus?.l1_unlocks_confirmed ?? '—'}
                  {bridgeStatus && (bridgeStatus.l1_unlocks_confirmed ?? 0) > 0 && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  )}
                </p>
                <p className="text-[10px] text-gray-500">{cs ? 'potvrzeno' : 'confirmed'}</p>
              </div>
              <div className="zion-rainbow-sub p-3" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                <p className="text-[10px] uppercase tracking-wider text-gray-500">L1 {cs ? 'blok' : 'block'}</p>
                <p className="text-base font-semibold text-white mt-1">{bridgeStatus?.last_l1_height ?? '—'}</p>
                <p className="text-[10px] text-gray-500">{cs ? 'poslední scan' : 'last scan'}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-[10px] text-gray-500">
              <span className="inline-flex items-center gap-1">
                <Link2 className="h-3 w-3" />
                wZION: <span className="text-gray-400 font-mono">{CONTRACTS.wZION?.slice(0, 8)}…{CONTRACTS.wZION?.slice(-4)}</span>
              </span>
              <span className="text-gray-600">·</span>
              <span>{cs ? 'Vault' : 'Vault'}: <span className="text-gray-400 font-mono">zion1w0r0…w0t0</span></span>
              <span className="text-gray-600">·</span>
              <span>{cs ? 'Finality: 60 bloků' : 'Finality: 60 blocks'}</span>
              <span className="text-gray-600">·</span>
              <span className="inline-flex items-center gap-1 text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                {cs ? 'Reverse bridge ověřen E2E (2026-06-29)' : 'Reverse bridge E2E verified (2026-06-29)'}
              </span>
            </div>
          </div>

          {/* Burn widget + How it works */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <BridgeBurnWidget />
            <div className="zion-rainbow-card p-6 space-y-4" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
              <div className="flex items-center gap-2 mb-2">
                <Flame className="h-5 w-5 text-amber-400" />
                <h3 className="font-semibold text-white text-sm">
                  {cs ? 'Jak Bridge funguje' : 'How Bridge Works'}
                </h3>
              </div>
              <div className="space-y-3 text-xs text-gray-300 leading-relaxed">
                <div className="flex gap-3">
                  <span className="shrink-0 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 text-emerald-400 font-mono text-[10px]">L1→L2</span>
                  <p>{cs ? 'Zamkni ZION na L1 → relay mintne wZION na Base (1:1 peg)' : 'Lock ZION on L1 → relay mints wZION on Base (1:1 peg)'}</p>
                </div>
                <div className="flex gap-3">
                  <span className="shrink-0 rounded-lg bg-orange-500/10 border border-orange-500/20 px-2 py-1 text-orange-400 font-mono text-[10px]">L2→L1</span>
                  <p>{cs ? 'Spal wZION na Base → relay odemkne ZION na L1 (do ~5 min)' : 'Burn wZION on Base → relay unlocks ZION on L1 (within ~5 min)'}</p>
                </div>
              </div>
              <div className="pt-2 flex flex-wrap gap-2">
                <a
                  href={`https://basescan.org/address/${CONTRACTS.ZIONBridge}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="zion-button-secondary !px-3 !py-1.5 !text-[10px] !rounded-lg !text-gray-400 hover:!text-white"
                >
                  Bridge Contract <ExternalLink className="h-2.5 w-2.5" />
                </a>
                <a
                  href={`https://basescan.org/token/${CONTRACTS.wZION}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="zion-button-secondary !px-3 !py-1.5 !text-[10px] !rounded-lg !text-gray-400 hover:!text-white"
                >
                  wZION Token <ExternalLink className="h-2.5 w-2.5" />
                </a>
              </div>
            </div>
          </div>
        </motion.div>
      </section>
      </>
      )}

      {activeTab === 'governance' && (
      <>
        {/* ═══════ GOVERNANCE ═══════ */}
        <section className="zion-container relative z-10 mb-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="flex flex-col gap-2 mb-6">
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Governance' : 'Governance'}</p>
              <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
                <Scale className="h-7 w-7 text-purple-400" />
                {cs ? 'wZION Governance' : 'wZION Governance'}
              </h2>
              <p className="text-sm text-gray-400">{cs ? 'Hlasuj o parametrech protokolu a sleduj treasury na Base Mainnet.' : 'Vote on protocol parameters and monitor the treasury on Base Mainnet.'}</p>
            </div>
          </motion.div>
          <div className="zion-rainbow-card p-6" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
            <div className="zion-rainbow-sub p-4 mb-4" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
              <div className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-amber-400" />
                <h3 className="text-base font-semibold text-white">{cs ? 'Governance panel' : 'Governance Panel'}</h3>
              </div>
            </div>
            <GovernancePanel />
          </div>
        </section>
      </>
      )}

      {activeTab === 'pools' && (
      <>
        {/* ═══════ DEX POOLS ═══════ */}
        <section className="zion-container relative z-10 mb-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="flex flex-col gap-2 mb-6">
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Likvidita' : 'Liquidity'}</p>
              <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
                <Droplets className="h-7 w-7 text-zion-cyan" />
                {cs ? 'DEX pooly' : 'DEX Pools'}
              </h2>
              <p className="text-sm text-gray-400">{cs ? 'wZION/USDT na Uniswap V3 a PancakeSwap V3. Aktuální aktivní likvidita: ~240 tis. wZION + ~44 USDT.' : 'wZION/USDT on Uniswap V3 and PancakeSwap V3. Current active liquidity: ~240k wZION + ~44 USDT.'}</p>
            </div>
          </motion.div>
        </section>

        {/* ── PancakeSwap V3 ── */}
        <section className="zion-container relative z-10 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 }}
            className="zion-rainbow-card p-6"
            style={{ '--rc': '245, 158, 11' } as React.CSSProperties}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <ChefHat className="h-6 w-6 text-amber-400" />
                <div>
                  <h2 className="text-lg font-bold text-white">
                    PancakeSwap V3
                  </h2>
                  <p className="text-[10px] text-gray-500">
                    {cs ? '2. největší DEX na Base · $115M denní volume' : '2nd largest DEX on Base · $115M daily volume'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {cs ? 'Live' : 'Live'}
                </span>
                <a
                  href={PANCAKE_V3.swapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="zion-button-primary !px-4 !py-2 !text-xs"
                >
                  {cs ? 'Swap na PancakeSwap' : 'Swap on PancakeSwap'}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <div className="zion-rainbow-sub p-3" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">{cs ? 'Pool adresa' : 'Pool address'}</p>
                <p className="text-sm font-semibold text-white font-mono">0x46cc...6f47</p>
                <p className="text-[10px] text-gray-500">wZION/USDT · 0.25% fee · NFT #2054747</p>
              </div>
              <div className="zion-rainbow-sub p-3" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">{cs ? 'Cena' : 'Price'}</p>
                <p className="text-sm font-semibold text-white font-mono">$0.0002</p>
                <p className="text-[10px] text-gray-500">{cs ? 'seed price' : 'seed price'}</p>
              </div>
              <div className="zion-rainbow-sub p-3" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">{cs ? 'Fee tiers' : 'Fee tiers'}</p>
                <p className="text-sm font-semibold text-white">0.01% · 0.05% · 0.25% · 1%</p>
                <p className="text-[10px] text-gray-500">{cs ? 'multi-tier' : 'multi-tier'}</p>
              </div>
            </div>

            {/* Links */}
            <div className="flex flex-wrap gap-2">
              <a
                href={PANCAKE_V3.swapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="zion-button-secondary !px-3 !py-1.5 !text-[10px] !rounded-lg !text-gray-400 hover:!text-white"
              >
                {cs ? 'Swap wZION' : 'Swap wZION'} <ExternalLink className="h-2.5 w-2.5" />
              </a>
              <a
                href={PANCAKE_V3.addLiquidityUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="zion-button-secondary !px-3 !py-1.5 !text-[10px] !rounded-lg !text-gray-400 hover:!text-white"
              >
                {cs ? 'Přidat likviditu' : 'Add Liquidity'} <ExternalLink className="h-2.5 w-2.5" />
              </a>
              <a
                href={`https://basescan.org/address/${CONTRACTS.PancakeV3PoolUSDT}`}
                target="_blank"
                rel="noopener noreferrer"
                className="zion-button-secondary !px-3 !py-1.5 !text-[10px] !rounded-lg !text-gray-400 hover:!text-white"
              >
                {cs ? 'Pool na Basescan' : 'Pool on Basescan'} <ExternalLink className="h-2.5 w-2.5" />
              </a>
              <a
                href={`https://basescan.org/address/${PANCAKE_V3.factory}`}
                target="_blank"
                rel="noopener noreferrer"
                className="zion-button-secondary !px-3 !py-1.5 !text-[10px] !rounded-lg !text-gray-400 hover:!text-white"
              >
                {cs ? 'Factory kontrakt' : 'Factory Contract'} <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>

            {/* Status note */}
            <div className="mt-4 flex items-start gap-3 zion-rainbow-sub p-3" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[10px] text-gray-400 leading-relaxed">
                {cs
                  ? 'PancakeSwap V3 pool byl vytvořen a inicializován, ale NFT pozice #2054747 byla spálena. V poolu aktuálně není žádná aktivní likvidita. Primární likvidita zůstává na Uniswap V3 wZION/USDT.'
                  : 'PancakeSwap V3 pool was created and initialized, but NFT position #2054747 has been burned. There is currently no active liquidity in the pool. Primary liquidity remains on Uniswap V3 wZION/USDT.'}
              </p>
            </div>
          </motion.div>
        </section>

        {/* ── Active Pools Detail ── */}
        <section className="zion-container relative z-10 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }}
          >
            <div className="flex flex-col gap-2 mb-4">
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Uniswap V3' : 'Uniswap V3'}</p>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Droplets className="h-5 w-5 text-zion-cyan" />
                {cs ? 'Uniswap V3 pooly' : 'Uniswap V3 pools'}
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* wZION/USDT — active V3 pool */}
              <div
                className="zion-rainbow-card p-4"
                style={{ '--rc': '147, 51, 234' } as React.CSSProperties}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-white">{poolStats?.pools?.wzion_usdt?.pair ?? 'wZION/USDT'}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      {cs ? 'primární' : 'primary'}
                    </span>
                    <span className="text-[10px] text-gray-400">{poolStats?.pools?.wzion_usdt?.feeLabel ?? '0.3%'}</span>
                  </div>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">{cs ? 'Cena' : 'Price'}:</span>
                    <span className="font-mono text-white">${(poolStats?.pools?.wzion_usdt?.price_usd ?? 0).toFixed(6)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">{cs ? 'Likvidita' : 'Liquidity'}:</span>
                    <span className="font-mono text-white">
                      {(Number(poolStats?.pools?.wzion_usdt?.balances?.wzion ?? 0)) > 0
                        ? `${(Number(poolStats!.pools.wzion_usdt.balances.wzion)).toLocaleString(undefined, { maximumFractionDigits: 0 })} wZION`
                        : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">USDT:</span>
                    <span className="font-mono text-white">
                      {(Number(poolStats?.pools?.wzion_usdt?.balances?.usdt ?? 0)) > 0
                        ? (Number(poolStats!.pools.wzion_usdt.balances.usdt)).toLocaleString(undefined, { maximumFractionDigits: 2 })
                        : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">TVL:</span>
                    <span className="font-mono text-white">${(poolStats?.pools?.wzion_usdt?.tvl_usd ?? 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Tick:</span>
                    <span className="font-mono text-white">{poolStats?.pools?.wzion_usdt?.tick ?? '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">{cs ? 'Stav' : 'Status'}:</span>
                    <span className={poolStats?.pools?.wzion_usdt?.active ? 'text-emerald-400' : 'text-amber-400'}>
                      {poolStats?.pools?.wzion_usdt?.active ? (cs ? 'aktivní' : 'active') : (cs ? 'neaktivní' : 'inactive')}
                    </span>
                  </div>
                </div>
              </div>

              {/* ETH/wZION — initialized, no liquidity */}
              <div
                className="zion-rainbow-card p-4 opacity-70"
                style={{ '--rc': '245, 158, 11' } as React.CSSProperties}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-white">{poolStats?.pools?.wzion_weth?.pair ?? 'ETH/wZION'}</span>
                  <span className="text-[10px] text-gray-400">{poolStats?.pools?.wzion_weth?.feeLabel ?? '1.0%'}</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">{cs ? 'Likvidita' : 'Liquidity'}:</span>
                    <span className="font-mono text-gray-500">0</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">{cs ? 'Stav' : 'Status'}:</span>
                    <span className="text-amber-400/70">{cs ? 'inicializovaný, bez likvidity' : 'initialized, no liquidity'}</span>
                  </div>
                </div>
              </div>

              {/* wZION/SOL — initialized, no liquidity */}
              <div
                className="zion-rainbow-card p-4 opacity-70"
                style={{ '--rc': '245, 158, 11' } as React.CSSProperties}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-white">{poolStats?.pools?.wzion_sol?.pair ?? 'wZION/SOL'}</span>
                  <span className="text-[10px] text-gray-400">{poolStats?.pools?.wzion_sol?.feeLabel ?? '0.01%'}</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">{cs ? 'Likvidita' : 'Liquidity'}:</span>
                    <span className="font-mono text-gray-500">0</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">{cs ? 'Stav' : 'Status'}:</span>
                    <span className="text-amber-400/70">{cs ? 'inicializovaný, bez likvidity' : 'initialized, no liquidity'}</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>
      </>
      )}

      {activeTab === 'auction' && (
      <>
        {/* ═══════ CCA AUCTION ═══════ */}
        <section className="zion-container relative z-10 mb-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="flex flex-col gap-2 mb-6">
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Aukce' : 'Auction'}</p>
              <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
                <Gavel className="h-7 w-7 text-amber-400" />
                {cs ? 'Uniswap CCA Aukce' : 'Uniswap CCA Auction'}
              </h2>
              <p className="text-sm text-gray-400">{cs ? 'Continuous Clearing Auction · 66.47M wZION za USDC.' : 'Continuous Clearing Auction · 66.47M wZION for USDC.'}</p>
            </div>
          </motion.div>
        </section>

        {/* ── Uniswap CCA Auction ── */}
        <section className="zion-container relative z-10 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 }}
            className="zion-rainbow-card p-6"
            style={{ '--rc': '245, 158, 11' } as React.CSSProperties}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <Gavel className="h-6 w-6 text-amber-400" />
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {cs ? 'Uniswap CCA Aukce' : 'Uniswap CCA Auction'}
                  </h2>
                  <p className="text-[10px] text-gray-500">
                    {cs ? 'Continuous Clearing Auction · 66.47M wZION za USDC' : 'Continuous Clearing Auction · 66.47M wZION for USDC'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-semibold ${
                  auctionData?.isGraduated
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${auctionData?.isGraduated ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
                  {auctionData?.isGraduated
                    ? (cs ? 'Graduováno' : 'Graduated')
                    : (cs ? 'Aktivní' : 'Active')}
                </span>
                <a
                  href={CCA_AUCTION_PARAMS.uniswapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="zion-button-primary !px-4 !py-2 !text-xs"
                >
                  {cs ? 'Přiházet na Uniswap' : 'Bid on Uniswap'}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            {/* Key metrics grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {/* Clearing price */}
              <div className="zion-rainbow-sub p-3" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp className="h-3 w-3 text-amber-400" />
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">{cs ? 'Vyklízecí cena' : 'Clearing Price'}</p>
                </div>
                <p className="text-lg font-bold text-white font-mono">
                  ${(auctionData?.clearingPriceUsd ?? 0).toFixed(7)}
                </p>
                <p className="text-[10px] text-gray-500">USDC / wZION</p>
              </div>

              {/* USDC raised */}
              <div className="zion-rainbow-sub p-3" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Droplets className="h-3 w-3 text-emerald-400" />
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">{cs ? 'USDC vybráno' : 'USDC Raised'}</p>
                </div>
                <p className="text-lg font-bold text-white font-mono">
                  ${(auctionData?.currencyRaised ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </p>
                <p className="text-[10px] text-gray-500">{cs ? 'celkem' : 'total'}</p>
              </div>

              {/* wZION sold */}
              <div className="zion-rainbow-sub p-3" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Activity className="h-3 w-3 text-zion-gold" />
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">{cs ? 'wZION prodáno' : 'wZION Sold'}</p>
                </div>
                <p className="text-lg font-bold text-white font-mono">
                  {(auctionData?.totalCleared ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
                <p className="text-[10px] text-gray-500">
                  {cs ? 'z' : 'of'} {CCA_AUCTION_PARAMS.totalSupply.toLocaleString()} ({(auctionData?.pctSold ?? 0).toFixed(4)}%)
                </p>
              </div>

              {/* Time remaining */}
              <div className="zion-rainbow-sub p-3" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock className="h-3 w-3 text-orange-400" />
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">{cs ? 'Zbývá' : 'Remaining'}</p>
                </div>
                <p className="text-lg font-bold text-white font-mono">
                  {(auctionData?.daysRemaining ?? 184).toFixed(0)}
                </p>
                <p className="text-[10px] text-gray-500">{cs ? 'dní (~6 měsíců)' : 'days (~6 months)'}</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-4">
              <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                <span>{cs ? 'Blok' : 'Block'} {auctionData?.currentBlock?.toLocaleString() ?? '…'}</span>
                <span>{(auctionData?.progressPct ?? 0).toFixed(3)}%</span>
                <span>{cs ? 'Konec' : 'End'} {CCA_AUCTION_PARAMS.endBlock.toLocaleString()}</span>
              </div>
              <div className="h-2 bg-black/40 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, auctionData?.progressPct ?? 0)}%` }}
                />
              </div>
            </div>

            {/* Auction details + links */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Left: How it works */}
              <div className="space-y-2">
                <h3 className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">
                  {cs ? 'Jak CCA aukce funguje' : 'How CCA Auction Works'}
                </h3>
                <div className="flex gap-2 text-gray-300">
                  <span className="shrink-0 rounded-lg bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 text-amber-400 font-mono text-[9px]">1</span>
                  <p>{cs ? 'Účastníci přihazují USDC za wZION s max cenou' : 'Participants bid USDC for wZION with a max price'}</p>
                </div>
                <div className="flex gap-2 text-gray-300">
                  <span className="shrink-0 rounded-lg bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 text-amber-400 font-mono text-[9px]">2</span>
                  <p>{cs ? 'Vyklízecí cena se kontinuálně upravuje na základě poptávky' : 'Clearing price continuously adjusts based on demand'}</p>
                </div>
                <div className="flex gap-2 text-gray-300">
                  <span className="shrink-0 rounded-lg bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 text-amber-400 font-mono text-[9px]">3</span>
                  <p>{cs ? 'Po graduaci → LBP pool na Uniswap V3 + USDC pro tým' : 'After graduation → LBP pool on Uniswap V3 + USDC for team'}</p>
                </div>
                <div className="flex gap-2 text-gray-300">
                  <span className="shrink-0 rounded-lg bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 text-amber-400 font-mono text-[9px]">4</span>
                  <p>{cs ? 'Negrace? exitBid() vrátí USDC, sweepUnsoldTokens() vrátí wZION' : 'No graduation? exitBid() refunds USDC, sweepUnsoldTokens() returns wZION'}</p>
                </div>
              </div>

              {/* Right: Contract info */}
              <div className="space-y-2">
                <h3 className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">
                  {cs ? 'Detaily kontraktu' : 'Contract Details'}
                </h3>
                <div className="flex justify-between">
                  <span className="text-gray-400">{cs ? 'Aukce' : 'Auction'}</span>
                  <a
                    href={CCA_AUCTION_PARAMS.basescanUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-amber-400/80 hover:text-amber-400 inline-flex items-center gap-1"
                  >
                    {CCA_AUCTION_PARAMS.auctionContract.slice(0, 8)}…{CCA_AUCTION_PARAMS.auctionContract.slice(-4)}
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">{cs ? 'Token' : 'Token'}</span>
                  <span className="font-mono text-gray-300">wZION (18d)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">{cs ? 'Měna' : 'Currency'}</span>
                  <span className="font-mono text-gray-300">USDC (6d, Base)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">{cs ? 'Start blok' : 'Start block'}</span>
                  <span className="font-mono text-gray-300">{CCA_AUCTION_PARAMS.startBlock.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">{cs ? 'End blok' : 'End block'}</span>
                  <span className="font-mono text-gray-300">{CCA_AUCTION_PARAMS.endBlock.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">{cs ? 'Floor price' : 'Floor price'}</span>
                  <span className="font-mono text-gray-300">$0.00019/wZION</span>
                </div>
              </div>
            </div>

            {/* Warning about 184-day duration */}
            <div className="mt-4 flex items-start gap-3 zion-rainbow-sub p-3" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[10px] text-gray-400 leading-relaxed">
                {cs
                  ? 'Poznámka: END_BLOCK je immutable a nelze změnit — aukce běží ~184 dní (zamýšleno 30). Po END_BLOCK lze exitBid() pro refund nebo sweepUnsoldTokens() pro vrácení neprodaných wZION. Viz AUCTION_CCA_BASE.md.'
                  : 'Note: END_BLOCK is immutable and cannot be changed — auction runs ~184 days (intended 30). After END_BLOCK, exitBid() for refund or sweepUnsoldTokens() to reclaim unsold wZION. See AUCTION_CCA_BASE.md.'}
              </p>
            </div>
          </motion.div>
        </section>
      </>
      )}

    </div>
  );
}
