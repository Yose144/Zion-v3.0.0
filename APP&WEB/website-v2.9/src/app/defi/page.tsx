'use client';

import { motion } from 'framer-motion';
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
  Wifi,
  WifiOff,
  Link2,
  Lock,
  CheckCircle2,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { useWallet } from '@/contexts/WalletContext';
import SwapWidget from '@/components/SwapWidget';
import LiFiWidget from '@/components/LiFiWidget';
import BridgeBurnWidget from '@/components/BridgeBurnWidget';
import DefiBalances from '@/components/DefiBalances';
import { CONTRACTS, SEED_PRICE_USD, CCA_AUCTION_PARAMS, PANCAKE_V3 } from '@/lib/defi-contracts';
import { AlertTriangle, Droplets, TrendingUp, Gavel, Clock, Trophy, ChefHat } from 'lucide-react';
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

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'swap' | 'bridge' | 'portfolio';

const TABS: { key: Tab; labelCs: string; labelEn: string; icon: typeof RefreshCw }[] = [
  { key: 'swap', labelCs: 'Swap', labelEn: 'Swap', icon: RefreshCw },
  { key: 'bridge', labelCs: 'Bridge', labelEn: 'Bridge', icon: ArrowLeftRight },
  { key: 'portfolio', labelCs: 'Portfolio', labelEn: 'Portfolio', icon: BarChart3 },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function DefiPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const { connected, account, isBaseMainnet, connect, switchToBase } = useWallet();
  const [tab, setTab] = useState<Tab>('swap');
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
  const [poolStats, setPoolStats] = useState<{
    tvl_usd: number;
    total_wzion_liquidity: number;
    active_pools: number;
    wzion_supply: number;
    deployer_wzion: number;
    primary_price_usd: number;
    pools: {
      wzion_usdt: { pair: string; fee: number; feeLabel: string; active: boolean; nft_id: number; nft_owner: string | null; tick: number; balances: { wzion: number; usdt: number }; price_usd: number; tvl_usd: number };
      wzion_weth: { pair: string; fee: number; feeLabel: string; active: boolean; nft_id: number; nft_owner: string | null; balances: { wzion: number; weth: number }; price_usd: number; tvl_usd: number };
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
  const { data: networkStatus, isConnected: wsConnected } = useNetworkStatus(true);

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
        if (!cancelled && data.ok) setPoolStats({
          tvl_usd: data.summary?.total_tvl_usd ?? 0,
          total_wzion_liquidity: data.summary?.total_wzion_liquidity ?? 0,
          active_pools: data.summary?.active_pools ?? 0,
          wzion_supply: data.summary?.wzion_supply ?? 0,
          deployer_wzion: data.summary?.deployer_wzion ?? 0,
          primary_price_usd: data.pools?.wzion_usdt?.price_usd ?? 0,
          pools: {
            wzion_usdt: {
              pair: data.pools?.wzion_usdt?.pair ?? 'wZION/USDT',
              fee: data.pools?.wzion_usdt?.fee ?? 3000,
              feeLabel: data.pools?.wzion_usdt?.feeLabel ?? '0.3%',
              active: data.pools?.wzion_usdt?.active ?? false,
              nft_id: data.pools?.wzion_usdt?.nft_id ?? 0,
              nft_owner: data.pools?.wzion_usdt?.nft_owner ?? null,
              tick: data.pools?.wzion_usdt?.tick ?? 0,
              balances: data.pools?.wzion_usdt?.balances ?? { wzion: 0, usdt: 0 },
              price_usd: data.pools?.wzion_usdt?.price_usd ?? 0,
              tvl_usd: data.pools?.wzion_usdt?.tvl_usd ?? 0,
            },
            wzion_weth: {
              pair: data.pools?.wzion_weth?.pair ?? 'ETH/wZION',
              fee: data.pools?.wzion_weth?.fee ?? 3000,
              feeLabel: data.pools?.wzion_weth?.feeLabel ?? '0.3%',
              active: data.pools?.wzion_weth?.active ?? false,
              nft_id: data.pools?.wzion_weth?.nft_id ?? 0,
              nft_owner: data.pools?.wzion_weth?.nft_owner ?? null,
              balances: data.pools?.wzion_weth?.balances ?? { wzion: 0, weth: 0 },
              price_usd: data.pools?.wzion_weth?.price_usd ?? 0,
              tvl_usd: data.pools?.wzion_weth?.tvl_usd ?? 0,
            },
          },
          contracts: data.contracts,
        });
      } catch { /* ignore */ }
    };
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

      {/* ── Hero ── */}
      <section className="zion-container relative z-10 mb-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="mb-4 flex items-center gap-3">
            <Layers className="h-5 w-5 text-zion-gold" />
            <span className="text-xs uppercase tracking-[0.35em] text-gray-400">
              ZION L2 · Base Mainnet
            </span>
          </div>

          <h1 className="mb-4 text-4xl font-bold md:text-5xl lg:text-6xl">
            <span className="text-gradient">DeFi Hub</span>
          </h1>

          <p className="mb-6 max-w-2xl text-lg leading-relaxed text-gray-300">
            {cs
              ? 'Swapuj, přemosťuj a spravuj wZION na Base. Reálné kontrakty, reálná likvidita.'
              : 'Swap, bridge, and manage wZION on Base. Real contracts, real liquidity.'}
          </p>

          {/* Wallet bar + stats */}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {connected ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5">
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-mono text-xs text-emerald-300">
                  {account?.slice(0, 6)}…{account?.slice(-4)}
                </span>
                {isBaseMainnet ? (
                  <span className="text-[10px] text-gray-400">Base</span>
                ) : (
                  <button
                    onClick={switchToBase}
                    className="text-[10px] text-orange-400 hover:text-orange-300 underline"
                  >
                    {cs ? 'Přepnout na Base' : 'Switch to Base'}
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={connect}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-1.5 text-sm text-white hover:bg-white/10 transition-colors"
              >
                <Wallet className="h-3.5 w-3.5" />
                {cs ? 'Připojit peněženku' : 'Connect Wallet'}
              </button>
            )}

            {/* WebSocket connection status */}
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
              {wsConnected ? (
                <>
                  <Wifi className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-[10px] text-gray-400">Live</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3.5 w-3.5 text-orange-400" />
                  <span className="text-[10px] text-gray-400">Polling</span>
                </>
              )}
            </div>

            {wZIONSupply && (
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                <Activity className="h-3.5 w-3.5 text-zion-gold" />
                <span className="text-gray-300">wZION Supply:</span>
                <span className="font-mono text-white">{wZIONSupply}</span>
              </div>
            )}
            {/* Price badge — shows live Uni V3 price or seed price as fallback */}
            {(wZIONPrice?.usd_per_wzion != null || true) && (
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                <BarChart3 className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-gray-300">{cs ? 'Cena' : 'Price'}:</span>
                <span className="font-mono text-white">
                  ${(wZIONPrice?.usd_per_wzion ?? SEED_PRICE_USD).toFixed(5)}
                </span>
                {wZIONPrice?.usd_per_wzion != null && wZIONPrice.usd_per_wzion > 0 ? (
                  <span className="text-[10px] text-emerald-400/70">live USDT</span>
                ) : (
                  <span className="text-[10px] text-amber-400/70">seed</span>
                )}
              </div>
            )}

            <a
              href={`https://app.uniswap.org/swap?chain=base&inputCurrency=ETH&outputCurrency=${CONTRACTS.wZION}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-gray-400 hover:text-white transition-colors"
            >
              <span className="text-xs">Uniswap</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </motion.div>
      </section>

      {/* ── Pool Stats Overview ── */}
      <section className="zion-container relative z-10 mb-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="zion-rainbow-card p-4" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-zion-gold" />
              <span className="text-[10px] uppercase tracking-wider text-gray-400">{cs ? 'Cena' : 'Price'}</span>
            </div>
            <p className="text-xl font-bold text-white">
              ${(poolStats?.primary_price_usd ?? wZIONPrice?.usd_per_wzion ?? SEED_PRICE_USD).toFixed(6)}
            </p>
            <p className="text-[10px] text-gray-500">USDT / wZION</p>
          </div>
          <div className="zion-rainbow-card p-4" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
            <div className="flex items-center gap-2 mb-2">
              <Droplets className="h-4 w-4 text-zion-cyan" />
              <span className="text-[10px] uppercase tracking-wider text-gray-400">{cs ? 'TVL' : 'TVL'}</span>
            </div>
            <p className="text-xl font-bold text-white">${(poolStats?.tvl_usd ?? 0).toFixed(2)}</p>
            <p className="text-[10px] text-gray-500">{cs ? 'celkem v poolech' : 'total in pools'}</p>
          </div>
          <div className="zion-rainbow-card p-4" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-4 w-4 text-emerald-400" />
              <span className="text-[10px] uppercase tracking-wider text-gray-400">{cs ? 'Likvidita' : 'Liquidity'}</span>
            </div>
            <p className="text-xl font-bold text-white">{(poolStats?.total_wzion_liquidity ?? 0).toFixed(0)}</p>
            <p className="text-[10px] text-gray-500">wZION</p>
          </div>
          <div className="zion-rainbow-card p-4" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
            <div className="flex items-center gap-2 mb-2">
              <Layers className="h-4 w-4 text-zion-purple" />
              <span className="text-[10px] uppercase tracking-wider text-gray-400">{cs ? 'Pooly' : 'Pools'}</span>
            </div>
            <p className="text-xl font-bold text-white">{poolStats?.active_pools ?? 0}</p>
            <p className="text-[10px] text-gray-500">{cs ? 'aktivní' : 'active'}</p>
          </div>
        </div>
      </section>

      {/* ── wZION/USDT Price Chart ── */}
      <section className="zion-container relative z-10 mb-8">
        <div className="zion-rainbow-card p-5" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
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

          {/* Price chart — GeckoTerminal OHLCV */}
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

          {/* Pool metrics row */}
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
            <div className="bg-black/30 rounded-lg p-2">
              <p className="text-gray-500 mb-0.5">TVL</p>
              <p className="text-white font-mono">${(poolStats?.tvl_usd ?? 0).toFixed(2)}</p>
            </div>
            <div className="bg-black/30 rounded-lg p-2">
              <p className="text-gray-500 mb-0.5">{cs ? 'Likvidita' : 'Liquidity'}</p>
              <p className="text-white font-mono">
                {(poolStats?.total_wzion_liquidity ?? 0) > 0
                  ? `${(poolStats!.total_wzion_liquidity).toLocaleString(undefined, { maximumFractionDigits: 0 })} wZION`
                  : '—'}
              </p>
            </div>
            <div className="bg-black/30 rounded-lg p-2">
              <p className="text-gray-500 mb-0.5">USDT</p>
              <p className="text-white font-mono">
                {(poolStats?.pools?.wzion_usdt?.balances?.usdt ?? 0) > 0
                  ? (poolStats!.pools.wzion_usdt.balances.usdt).toLocaleString(undefined, { maximumFractionDigits: 2 })
                  : '—'}
              </p>
            </div>
            <div className="bg-black/30 rounded-lg p-2">
              <p className="text-gray-500 mb-0.5">Tick</p>
              <p className="text-white font-mono">{poolStats?.pools?.wzion_usdt?.tick ?? '—'}</p>
            </div>
            <div className="bg-black/30 rounded-lg p-2">
              <p className="text-gray-500 mb-0.5">{cs ? 'Stav' : 'Status'}</p>
              <p className={poolStats?.pools?.wzion_usdt?.active ? 'text-emerald-400' : 'text-amber-400'}>
                {poolStats?.pools?.wzion_usdt?.active ? (cs ? 'aktivní' : 'active') : (poolStats ? (cs ? 'neaktivní' : 'inactive') : (cs ? 'načítám' : 'loading'))}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Uniswap CCA Auction ── */}
      <section className="zion-container relative z-10 mb-8">
        <div className="zion-rainbow-card p-6" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
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
                className="inline-flex items-center gap-1.5 rounded-lg bg-linear-to-r from-amber-500 to-orange-500 px-4 py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
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
                className="h-full bg-linear-to-r from-amber-500 to-orange-500 transition-all duration-500"
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
                <p>{cs ? 'Po graduaci → LBP pool na Uniswap V4 + USDC pro tým' : 'After graduation → LBP pool on Uniswap V4 + USDC for team'}</p>
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
          <div className="mt-4 flex items-start gap-3 rounded-lg bg-amber-500/5 border border-amber-500/15 p-3">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-gray-400 leading-relaxed">
              {cs
                ? 'Poznámka: END_BLOCK je immutable a nelze změnit — aukce běží ~184 dní (zamýšleno 30). Po END_BLOCK lze exitBid() pro refund nebo sweepUnsoldTokens() pro vrácení neprodaných wZION. Viz AUCTION_CCA_BASE.md.'
                : 'Note: END_BLOCK is immutable and cannot be changed — auction runs ~184 days (intended 30). After END_BLOCK, exitBid() for refund or sweepUnsoldTokens() to reclaim unsold wZION. See AUCTION_CCA_BASE.md.'}
            </p>
          </div>
        </div>
      </section>

      {/* ── PancakeSwap V3 ── */}
      <section className="zion-container relative z-10 mb-8">
        <div className="zion-rainbow-card p-6" style={{ '--rc': '255, 199, 0' } as React.CSSProperties}>
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
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-semibold bg-green-500/10 text-green-400 border border-green-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                {cs ? 'Live' : 'Live'}
              </span>
              <a
                href={PANCAKE_V3.swapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-linear-to-r from-amber-500 to-yellow-500 px-4 py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
              >
                {cs ? 'Swap na PancakeSwap' : 'Swap on PancakeSwap'}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div className="zion-rainbow-sub p-3" style={{ '--rc': '255, 199, 0' } as React.CSSProperties}>
              <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">{cs ? 'Pool adresa' : 'Pool address'}</p>
              <p className="text-sm font-semibold text-white font-mono">0x46cc...6f47</p>
              <p className="text-[10px] text-gray-500">wZION/USDT · 0.25% fee · NFT #2054747</p>
            </div>
            <div className="zion-rainbow-sub p-3" style={{ '--rc': '255, 199, 0' } as React.CSSProperties}>
              <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">{cs ? 'Cena' : 'Price'}</p>
              <p className="text-sm font-semibold text-white font-mono">$0.0002</p>
              <p className="text-[10px] text-gray-500">{cs ? 'seed price' : 'seed price'}</p>
            </div>
            <div className="zion-rainbow-sub p-3" style={{ '--rc': '255, 199, 0' } as React.CSSProperties}>
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
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] text-gray-400 hover:text-white transition-colors"
            >
              {cs ? 'Swap wZION' : 'Swap wZION'} <ExternalLink className="h-2.5 w-2.5" />
            </a>
            <a
              href={PANCAKE_V3.addLiquidityUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] text-gray-400 hover:text-white transition-colors"
            >
              {cs ? 'Přidat likviditu' : 'Add Liquidity'} <ExternalLink className="h-2.5 w-2.5" />
            </a>
            <a
              href={`https://basescan.org/address/${CONTRACTS.PancakeV3PoolUSDT}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] text-gray-400 hover:text-white transition-colors"
            >
              {cs ? 'Pool na Basescan' : 'Pool on Basescan'} <ExternalLink className="h-2.5 w-2.5" />
            </a>
            <a
              href={`https://basescan.org/address/${PANCAKE_V3.factory}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] text-gray-400 hover:text-white transition-colors"
            >
              {cs ? 'Factory kontrakt' : 'Factory Contract'} <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>

          {/* Status note */}
          <div className="mt-4 flex items-start gap-3 rounded-lg bg-green-500/5 border border-green-500/15 p-3">
            <Trophy className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-gray-400 leading-relaxed">
              {cs
                ? 'PancakeSwap V3 pool je LIVE na Base Mainnet! wZION/USDT pool s 0.25% fee je vytvořen a inicializován na ceně $0.0002/wZION. NFT pozice #2054747. wZION je nyní dostupný na 2 DEX platformách (Uniswap V4 + PancakeSwap V3) + LiFi agregátor s 30+ DEX. PancakeSwap je 2. největší DEX na Base s $115M denním volume.'
                : 'PancakeSwap V3 pool is LIVE on Base Mainnet! wZION/USDT pool with 0.25% fee is created and initialized at $0.0002/wZION. NFT position #2054747. wZION is now available on 2 DEX platforms (Uniswap V4 + PancakeSwap V3) + LiFi aggregator with 30+ DEX. PancakeSwap is the 2nd largest DEX on Base with $115M daily volume.'}
            </p>
          </div>
        </div>
      </section>

      {/* ── Active Pools Detail ── */}
      <section className="zion-container relative z-10 mb-8">
        <h2 className="mb-4 text-lg font-semibold text-white">
          {cs ? 'Uniswap V4 pooly' : 'Uniswap V4 pools'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* wZION/USDT — active V4 pool */}
          <div
            className="zion-rainbow-card p-4 border-zion-gold/30"
            style={{ '--rc': '16, 185, 129' } as React.CSSProperties}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-white">{poolStats?.pools?.wzion_usdt?.pair ?? 'wZION/USDT'}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-zion-gold/20 text-zion-gold border border-zion-gold/30">
                {cs ? 'primární' : 'primary'}
              </span>
              <span className="text-[10px] text-gray-400">{poolStats?.pools?.wzion_usdt?.feeLabel ?? '0.3%'}</span>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">{cs ? 'Cena' : 'Price'}:</span>
                <span className="font-mono text-white">${(poolStats?.pools?.wzion_usdt?.price_usd ?? 0).toFixed(6)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">{cs ? 'Likvidita' : 'Liquidity'}:</span>
                <span className="font-mono text-white">
                  {(poolStats?.pools?.wzion_usdt?.balances?.wzion ?? 0) > 0
                    ? `${(poolStats!.pools.wzion_usdt.balances.wzion).toLocaleString(undefined, { maximumFractionDigits: 0 })} wZION`
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">USDT:</span>
                <span className="font-mono text-white">
                  {(poolStats?.pools?.wzion_usdt?.balances?.usdt ?? 0) > 0
                    ? (poolStats!.pools.wzion_usdt.balances.usdt).toLocaleString(undefined, { maximumFractionDigits: 2 })
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
                  {poolStats?.pools?.wzion_usdt?.active ? (cs ? 'aktivní' : 'active') : (cs ? 'načítám' : 'loading')}
                </span>
              </div>
              {poolStats?.pools?.wzion_usdt?.nft_owner && (
                <div className="pt-2 mt-2 border-t border-white/10 space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">
                    {cs ? 'V4 NFT pozice' : 'V4 NFT position'}
                  </p>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-gray-500 font-mono">#{poolStats.pools.wzion_usdt.nft_id}</span>
                    <span className="text-emerald-400 font-mono">
                      {cs ? 'aktivní' : 'active'} · {poolStats.pools.wzion_usdt.nft_owner.slice(0, 8)}…{poolStats.pools.wzion_usdt.nft_owner.slice(-4)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ETH/wZION — burned V4 position */}
          <div
            className="zion-rainbow-card p-4 opacity-50"
            style={{ '--rc': '100, 100, 100' } as React.CSSProperties}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-white">{poolStats?.pools?.wzion_weth?.pair ?? 'ETH/wZION'}</span>
              <span className="text-[10px] text-gray-400">{poolStats?.pools?.wzion_weth?.feeLabel ?? '0.3%'}</span>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">{cs ? 'Likvidita' : 'Liquidity'}:</span>
                <span className="font-mono text-gray-500">0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">{cs ? 'Stav' : 'Status'}:</span>
                <span className="text-red-400/70">{cs ? 'vypálena' : 'burned'}</span>
              </div>
              <div className="pt-2 mt-2 border-t border-white/10 space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-gray-600">
                  {cs ? 'V4 NFT pozice' : 'V4 NFT position'}
                </p>
                <div className="flex justify-between text-[10px]">
                  <span className="text-gray-600 font-mono">#{poolStats?.pools?.wzion_weth?.nft_id ?? 2740380}</span>
                  <span className="text-red-400/70 font-mono">{cs ? 'spálena' : 'burned'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Tab Navigation ── */}
      <section className="zion-container relative z-10 mb-8">
        <div className="flex gap-1 zion-tile p-1 w-fit">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all ${
                  active
                    ? 'bg-white/10 text-white shadow-lg'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="h-4 w-4" />
                {cs ? t.labelCs : t.labelEn}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Active Tab Content ── */}
      <section className="zion-container relative z-10 mb-20">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {tab === 'swap' && (
            <div className="space-y-6 max-w-5xl">
              {/* LI.FI Cross-Chain Swap + Bridge — aggregates 30+ DEX and 20+ bridges */}
              <LiFiWidget />
              {/* Original Uniswap V3 swap widget — direct pool swap for wZION/ETH */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SwapWidget />
                <div className="space-y-6">
                  <DefiBalances />
                </div>
              </div>
            </div>
          )}

          {tab === 'bridge' && (
            <div className="space-y-6 max-w-5xl">
              {/* Bridge Vault Status */}
              <div className="zion-rainbow-card p-6" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
                <div className="flex items-center gap-2 mb-4">
                  <Lock className="h-5 w-5 text-zion-gold" />
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
                  <div className="zion-rainbow-sub p-3" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
                    <p className="text-[10px] uppercase tracking-wider text-gray-500">{cs ? 'Zamčeno' : 'Locked'}</p>
                    <p className="text-base font-semibold text-white mt-1">~100M</p>
                    <p className="text-[10px] text-gray-500">ZION</p>
                  </div>
                  <div className="zion-rainbow-sub p-3" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
                    <p className="text-[10px] uppercase tracking-wider text-gray-500">{cs ? 'Lock TX' : 'Lock TXs'}</p>
                    <p className="text-base font-semibold text-white mt-1">6</p>
                    <p className="text-[10px] text-gray-500">UTXO</p>
                  </div>
                  <div className="zion-rainbow-sub p-3" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
                    <p className="text-[10px] uppercase tracking-wider text-gray-500">{cs ? 'wZION Mints' : 'wZION Mints'}</p>
                    <p className="text-base font-semibold text-white mt-1 flex items-center gap-1">
                      {bridgeStatus?.evm_mints_confirmed ?? '—'}
                      {bridgeStatus && bridgeStatus.evm_mints_confirmed > 0 && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      )}
                    </p>
                    <p className="text-[10px] text-gray-500">{cs ? 'potvrzeno' : 'confirmed'}</p>
                  </div>
                  <div className="zion-rainbow-sub p-3" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
                    <p className="text-[10px] uppercase tracking-wider text-gray-500">{cs ? 'L1 Odemčeno' : 'L1 Unlocks'}</p>
                    <p className="text-base font-semibold text-white mt-1 flex items-center gap-1">
                      {bridgeStatus?.l1_unlocks_confirmed ?? '—'}
                      {bridgeStatus && (bridgeStatus.l1_unlocks_confirmed ?? 0) > 0 && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      )}
                    </p>
                    <p className="text-[10px] text-gray-500">{cs ? 'potvrzeno' : 'confirmed'}</p>
                  </div>
                  <div className="zion-rainbow-sub p-3" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
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
                <div className="zion-rainbow-card p-6 space-y-4" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
                  <div className="flex items-center gap-2 mb-2">
                    <Flame className="h-5 w-5 text-cyan-400" />
                    <h3 className="font-semibold text-white text-sm">
                      {cs ? 'Jak Bridge funguje' : 'How Bridge Works'}
                    </h3>
                  </div>
                  <div className="space-y-3 text-xs text-gray-300 leading-relaxed">
                    <div className="flex gap-3">
                      <span className="shrink-0 rounded-lg bg-cyan-500/10 border border-cyan-500/20 px-2 py-1 text-cyan-400 font-mono text-[10px]">L1→L2</span>
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
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] text-gray-400 hover:text-white transition-colors"
                    >
                      Bridge Contract <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                    <a
                      href={`https://basescan.org/token/${CONTRACTS.wZION}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] text-gray-400 hover:text-white transition-colors"
                    >
                      wZION Token <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'portfolio' && (
            <div className="max-w-2xl">
              <DefiBalances />
            </div>
          )}
        </motion.div>
      </section>

      {/* ── Contract Addresses ── */}
      <section className="zion-container relative z-10 mb-20">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="mb-6 text-2xl font-bold">
            {cs ? 'Kontrakty na Base Mainnet' : 'Base Mainnet Contracts'}
          </h2>
          <div className="overflow-hidden zion-rainbow-card" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/2">
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

      {/* ── CTA ── */}
      <section className="zion-container relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="zion-rainbow-card p-8"
          style={{ '--rc': '16, 185, 129' } as React.CSSProperties}
        >
          <h2 className="text-2xl font-bold mb-3">
            {cs ? 'Obchoduj wZION' : 'Trade wZION'}
          </h2>
          <p className="mx-auto mb-6 max-w-lg text-gray-300">
            {cs
              ? 'wZION je k dispozici na Uniswap V3 (Base). Primární pool wZION/USDT s 0.3% fee.'
              : 'wZION is available on Uniswap V3 (Base). Primary wZION/USDT pool with 0.3% fee.'}
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            <a
              href={`https://app.uniswap.org/swap?chain=base&inputCurrency=${CONTRACTS.USDT}&outputCurrency=${CONTRACTS.wZION}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-zion-gold via-zion-purple to-zion-cyan px-6 py-3 font-semibold text-white shadow-[0_12px_35px_rgba(147,51,234,0.35)] transition-shadow hover:shadow-[0_18px_45px_rgba(147,51,234,0.45)]"
            >
              {cs ? 'Otevřít Uniswap' : 'Open Uniswap'}
              <ExternalLink className="h-4 w-4" />
            </a>
            <a
              href={`https://dexscreener.com/base/${CONTRACTS.UniV3PoolUSDT}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 px-6 py-3 text-white transition-colors hover:border-zion-cyan/45"
            >
              DexScreener
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
