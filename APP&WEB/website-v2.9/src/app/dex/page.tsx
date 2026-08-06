'use client';

/**
 * ZionDex — Cross-Chain DEX page
 * Main entry point for cross-chain swaps via ZionDex Router
 */

import { useState, type CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { Zap, Globe, Shield, TrendingUp, ArrowRight, Info, Layers, AlertTriangle } from 'lucide-react';
import RecentSwaps from '@/components/dex/RecentSwaps';
import TransactionStatus from '@/components/dex/TransactionStatus';
import PriceChart from '@/components/dex/PriceChart';
import Link from 'next/link';

const CrossChainSwapWidget = dynamic(() => import('@/components/dex/CrossChainSwapWidget'), {
  ssr: false,
  loading: () => <div className="h-96 animate-pulse rounded-2xl bg-white/5" />,
});

export default function DexPage() {
  const [activeSwapId, setActiveSwapId] = useState<string | null>(null);

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-zinc-800/50">
        <div className="absolute inset-0 bg-gradient-to-br from-zion-gold-500/5 via-transparent to-zion-cyan-500/5" />
        <div className="relative max-w-6xl mx-auto px-6 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-zion-gold-500/20 rounded-xl">
                <Zap className="w-6 h-6 text-zion-gold-500" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">ZionDex</h1>
                <p className="text-zinc-400">Cross-Chain DEX powered by L3 WARP bridge</p>
              </div>
            </div>

            {/* Feature badges */}
            <div className="flex flex-wrap gap-3 mt-6">
              <div className="zion-badge-gold">
                <Globe className="w-3.5 h-3.5" />
                <span className="text-xs">13 chains</span>
              </div>
              <div className="zion-badge-green">
                <Shield className="w-3.5 h-3.5" />
                <span className="text-xs">L3 WARP bridge (no synthetic)</span>
              </div>
              <div className="zion-badge-cyan">
                <TrendingUp className="w-3.5 h-3.5" />
                <span className="text-xs">0.15% ZION pairs</span>
              </div>
              <div className="zion-badge-gold">
                <Zap className="w-3.5 h-3.5" />
                <span className="text-xs">One-click cross-chain</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Early Beta / Under Construction Banner */}
      <div className="max-w-6xl mx-auto px-6 pt-6">
        <div className="rounded-xl border border-zion-gold-500/30 bg-zion-gold-500/10 px-4 py-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-zion-gold-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-200">ZionDex — Under Construction / Early Beta</p>
              <p className="text-xs text-amber-200/70 mt-1">
                Cross-chain routing and the ZionDex AMM pools are still being deployed. Swaps currently route via existing external liquidity (e.g. Uniswap V3 on Base). Expect changes and use small amounts.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Swap widget */}
          <div className="lg:col-span-2">
            <CrossChainSwapWidget />

            {/* Price chart */}
            <div className="mt-6">
              <PriceChart token="wZION" vsToken="USDT" />
            </div>

            {/* Active swap status */}
            {activeSwapId && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-zinc-400 mb-3 uppercase tracking-wider">
                  Transaction Status
                </h3>
                <TransactionStatus
                  swapId={activeSwapId}
                  onComplete={(swap) => {
                    if (swap.status === 'completed') {
                      setTimeout(() => setActiveSwapId(null), 5000);
                    }
                  }}
                />
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <RecentSwaps />

            {/* Quick links */}
            <div className="zion-rainbow-card p-4" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
              <h3 className="text-sm font-semibold text-white mb-3">Quick Links</h3>
              <div className="space-y-2">
                <Link
                  href="/ziondex"
                  className="zion-rainbow-sub flex items-center justify-between p-2"
                  style={{ '--rc': '7, 137, 48' } as CSSProperties}
                >
                  <span className="flex items-center gap-2 text-sm text-zinc-300">
                    <Info className="w-3.5 h-3.5 text-zion-gold-500" />
                    About ZionDex
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
                </Link>
                <Link
                  href="/dex/liquidity"
                  className="zion-rainbow-sub flex items-center justify-between p-2"
                  style={{ '--rc': '7, 137, 48' } as CSSProperties}
                >
                  <span className="text-sm text-zinc-300">Liquidity Pools</span>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
                </Link>
                <Link
                  href="/dex/portfolio"
                  className="zion-rainbow-sub flex items-center justify-between p-2"
                  style={{ '--rc': '7, 137, 48' } as CSSProperties}
                >
                  <span className="text-sm text-zinc-300">My Portfolio</span>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
                </Link>
                <Link
                  href="/defi"
                  className="zion-rainbow-sub flex items-center justify-between p-2"
                  style={{ '--rc': '7, 137, 48' } as CSSProperties}
                >
                  <span className="text-sm text-zinc-300">DeFi Hub</span>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
                </Link>
                <Link
                  href="/bridge"
                  className="zion-rainbow-sub flex items-center justify-between p-2"
                  style={{ '--rc': '7, 137, 48' } as CSSProperties}
                >
                  <span className="text-sm text-zinc-300">Bridge (wZION ↔ ZION)</span>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
                </Link>
                <Link
                  href="/swap"
                  className="zion-rainbow-sub flex items-center justify-between p-2"
                  style={{ '--rc': '7, 137, 48' } as CSSProperties}
                >
                  <span className="text-sm text-zinc-300">Atomic Swap (HTLC)</span>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
                </Link>
                <Link
                  href="/defi"
                  className="zion-rainbow-sub flex items-center justify-between p-2"
                  style={{ '--rc': '7, 137, 48' } as CSSProperties}
                >
                  <span className="text-sm text-zinc-300">Staking & Farming (in DeFi Hub)</span>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
                </Link>
              </div>
            </div>

            {/* Stats */}
            <div className="zion-rainbow-sub p-4" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
              <h3 className="text-sm font-semibold text-white mb-3">ZionDex Stats</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Supported chains</span>
                  <span className="text-white">13</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">L3 WARP bridge</span>
                  <span className="flex items-center gap-1 text-zion-cyan-400">
                    <Layers className="w-3 h-3" />
                    port 8453
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">ZION pair fee</span>
                  <span className="text-zion-gold-400">0.15%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Standard fee</span>
                  <span className="text-zinc-300">0.30%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Bridge fee</span>
                  <span className="text-zinc-300">0.50%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Validator quorum</span>
                  <span className="text-zinc-300">5/5 (Ed25519)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Max slippage</span>
                  <span className="text-zinc-300">Configurable</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-zinc-800/50 mt-12">
        <div className="max-w-6xl mx-auto px-6 py-6 text-center">
          <p className="text-xs text-zinc-600">
            ZionDex Router API at{' '}
            <code className="text-zinc-400">zionterranova.com/dex-api</code>
            {' · '}
            L3 WARP Bridge at{' '}
            <code className="text-zinc-400">port 8453</code>
            {' · '}
            <Link href="/ziondex" className="text-zion-gold-500/80 hover:text-zion-gold-400">
              Learn more →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
