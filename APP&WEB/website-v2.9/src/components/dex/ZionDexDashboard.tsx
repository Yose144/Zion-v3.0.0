'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Zap,
  Droplets,
  Wallet,
  ArrowLeftRight,
  Repeat,
  Sparkles,
  Globe,
  Shield,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import CrossChainSwapWidget from './CrossChainSwapWidget';
import RecentSwaps from './RecentSwaps';
import PriceChart from './PriceChart';
import Link from 'next/link';

const ROUTER_URL = process.env.NEXT_PUBLIC_ZIONDEX_ROUTER_URL || 'https://zionterranova.com/dex-api';

type DexTab = 'swap' | 'liquidity' | 'portfolio' | 'bridge' | 'atomic';

const tabs: { id: DexTab; label: string; icon: typeof Zap }[] = [
  { id: 'swap', label: 'Swap', icon: Zap },
  { id: 'liquidity', label: 'Liquidity', icon: Droplets },
  { id: 'portfolio', label: 'Portfolio', icon: Wallet },
  { id: 'bridge', label: 'WARP Bridge', icon: ArrowLeftRight },
  { id: 'atomic', label: 'Atomic Swap', icon: Repeat },
];

export default function ZionDexDashboard() {
  const [activeTab, setActiveTab] = useState<DexTab>('swap');
  const [activeSwapId, setActiveSwapId] = useState<string | null>(null);

  return (
    <div className="min-h-screen">
      {/* Hero header */}
      <div className="relative overflow-hidden border-b border-zinc-800/50">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-cyan-500/5" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
              <div className="p-3 bg-amber-500/20 rounded-2xl w-fit">
                <Sparkles className="w-7 h-7 text-amber-500" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-white">ZionDex Hub</h1>
                <p className="text-zinc-400 text-sm mt-1">
                  Universal cross-chain DEX powered by L3 WARP bridge
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-4">
              <div className="zion-badge-gold">
                <Globe className="w-3.5 h-3.5" />
                <span className="text-xs">13 chain families</span>
              </div>
              <div className="zion-badge-green">
                <Shield className="w-3.5 h-3.5" />
                <span className="text-xs">L3 WARP bridge</span>
              </div>
              <div className="zion-badge-cyan">
                <TrendingUp className="w-3.5 h-3.5" />
                <span className="text-xs">0.15% ZION pairs</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Under Construction / Early Beta Banner */}
      <div className="border-b border-zinc-800/50 bg-amber-500/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-200">ZionDex — Under Construction / Early Beta</p>
              <p className="text-xs text-amber-200/70 mt-1">
                The ZionDex AMM and cross-chain router service are still being deployed. Current quotes may route through external liquidity. Use small amounts and expect changes.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-[6.5rem] z-30 bg-black/80 backdrop-blur-xl border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1 overflow-x-auto no-scrollbar py-2">
            {tabs.map((t) => {
              const Icon = t.icon;
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {activeTab === 'swap' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid lg:grid-cols-3 gap-6"
          >
            <div className="lg:col-span-2 space-y-6">
              <CrossChainSwapWidget />
              <PriceChart token="wZION" vsToken="USDT" />
            </div>
            <div className="space-y-6">
              <RecentSwaps />
            </div>
          </motion.div>
        )}

        {activeTab === 'liquidity' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <Droplets className="w-12 h-12 text-zinc-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white">Liquidity panel</h2>
            <p className="text-zinc-400 mt-2 max-w-md mx-auto">
              Full liquidity management is being consolidated here. For now use the standalone page.
            </p>
            <Link
              href="/dex/liquidity"
              className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-colors"
            >
              Open Liquidity Pools
            </Link>
          </motion.div>
        )}

        {activeTab === 'portfolio' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <Wallet className="w-12 h-12 text-zinc-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white">Portfolio panel</h2>
            <p className="text-zinc-400 mt-2 max-w-md mx-auto">
              Track your swap history and LP positions here. For now use the standalone page.
            </p>
            <Link
              href="/dex/portfolio"
              className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-colors"
            >
              Open Portfolio
            </Link>
          </motion.div>
        )}

        {activeTab === 'bridge' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <ArrowLeftRight className="w-12 h-12 text-zinc-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white">WARP Bridge</h2>
            <p className="text-zinc-400 mt-2 max-w-md mx-auto">
              Native L1 ↔ Base bridge with no synthetic wrapped tokens. 5/5 validator quorum.
            </p>
            <Link
              href="/bridge"
              className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-colors"
            >
              Open Bridge
            </Link>
          </motion.div>
        )}

        {activeTab === 'atomic' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <Repeat className="w-12 h-12 text-zinc-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white">Atomic Swap</h2>
            <p className="text-zinc-400 mt-2 max-w-md mx-auto">
              Trustless HTLC atomic swaps between ZION and other chains. No custodian.
            </p>
            <Link
              href="/swap"
              className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-colors"
            >
              Open Atomic Swap
            </Link>
          </motion.div>
        )}
      </div>

      {/* Footer note */}
      <div className="border-t border-zinc-800/50 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 text-center">
          <p className="text-xs text-zinc-600">
            ZionDex Router API at <code className="text-zinc-400">{ROUTER_URL}</code>
          </p>
        </div>
      </div>
    </div>
  );
}
