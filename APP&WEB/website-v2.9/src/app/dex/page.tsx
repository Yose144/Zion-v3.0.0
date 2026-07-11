'use client';

/**
 * ZionDex — Cross-Chain DEX page
 * Main entry point for cross-chain swaps via ZionDex Router
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, Globe, Shield, TrendingUp, ArrowRight } from 'lucide-react';
import CrossChainSwapWidget from '@/components/dex/CrossChainSwapWidget';
import RecentSwaps from '@/components/dex/RecentSwaps';
import TransactionStatus from '@/components/dex/TransactionStatus';
import PriceChart from '@/components/dex/PriceChart';
import Link from 'next/link';

export default function DexPage() {
  const [activeSwapId, setActiveSwapId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] via-[#0d0d18] to-[#0a0a0f]">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-zinc-800/50">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-blue-500/5" />
        <div className="relative max-w-6xl mx-auto px-6 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-500/20 rounded-xl">
                <Zap className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">ZionDex</h1>
                <p className="text-zinc-400">Cross-Chain DEX powered by native L1 bridge</p>
              </div>
            </div>

            {/* Feature badges */}
            <div className="flex flex-wrap gap-3 mt-6">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/60 border border-zinc-700/30 rounded-full">
                <Globe className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs text-zinc-300">13 chains</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/60 border border-zinc-700/30 rounded-full">
                <Shield className="w-3.5 h-3.5 text-green-500" />
                <span className="text-xs text-zinc-300">Native bridge (no synthetic)</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/60 border border-zinc-700/30 rounded-full">
                <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-xs text-zinc-300">0.15% ZION pairs</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/60 border border-zinc-700/30 rounded-full">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs text-zinc-300">One-click cross-chain</span>
              </div>
            </div>
          </motion.div>
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
            <div className="bg-zinc-900/60 border border-zinc-700/30 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Quick Links</h3>
              <div className="space-y-2">
                <Link
                  href="/dex/liquidity"
                  className="flex items-center justify-between p-2 bg-zinc-800/40 rounded-lg hover:bg-zinc-800/60 transition-colors"
                >
                  <span className="text-sm text-zinc-300">Liquidity Pools</span>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
                </Link>
                <Link
                  href="/dex/portfolio"
                  className="flex items-center justify-between p-2 bg-zinc-800/40 rounded-lg hover:bg-zinc-800/60 transition-colors"
                >
                  <span className="text-sm text-zinc-300">My Portfolio</span>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
                </Link>
                <Link
                  href="/defi"
                  className="flex items-center justify-between p-2 bg-zinc-800/40 rounded-lg hover:bg-zinc-800/60 transition-colors"
                >
                  <span className="text-sm text-zinc-300">DeFi Hub</span>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
                </Link>
                <Link
                  href="/bridge"
                  className="flex items-center justify-between p-2 bg-zinc-800/40 rounded-lg hover:bg-zinc-800/60 transition-colors"
                >
                  <span className="text-sm text-zinc-300">Bridge (wZION ↔ ZION)</span>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
                </Link>
                <Link
                  href="/swap"
                  className="flex items-center justify-between p-2 bg-zinc-800/40 rounded-lg hover:bg-zinc-800/60 transition-colors"
                >
                  <span className="text-sm text-zinc-300">Atomic Swap (HTLC)</span>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
                </Link>
                <Link
                  href="/defi/staking"
                  className="flex items-center justify-between p-2 bg-zinc-800/40 rounded-lg hover:bg-zinc-800/60 transition-colors"
                >
                  <span className="text-sm text-zinc-300">Staking (12% APR)</span>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
                </Link>
                <Link
                  href="/defi/farming"
                  className="flex items-center justify-between p-2 bg-zinc-800/40 rounded-lg hover:bg-zinc-800/60 transition-colors"
                >
                  <span className="text-sm text-zinc-300">Farming (1 wZION/s)</span>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
                </Link>
              </div>
            </div>

            {/* Stats */}
            <div className="bg-zinc-900/60 border border-zinc-700/30 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-3">ZionDex Stats</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Supported chains</span>
                  <span className="text-white">13</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">ZION pair fee</span>
                  <span className="text-amber-400">0.15%</span>
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
            ZionDex is in development. Router API at{' '}
            <code className="text-zinc-400">localhost:8454</code>.
            Contracts ready for Base mainnet deploy.
          </p>
        </div>
      </div>
    </div>
  );
}
