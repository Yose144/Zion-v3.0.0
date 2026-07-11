import React from 'react';
import { Sparkles, Github, ArrowLeftRight, ArrowRightLeft, Coins, Zap, CheckCircle2, ArrowRight } from 'lucide-react';

export const metadata = {
  title: 'ZionDex — Cross-Chain DEX | ZION TerraNova',
  description: 'First universal cross-chain DEX powered by L3 WARP bridge. Swap any token on any chain in one transaction. Live Beta.',
};

export default function ZionDexPage() {
  return (
    <div className="zion-page">
      <div className="zion-container max-w-4xl space-y-12">
        {/* Hero */}
        <section
          className="zion-rainbow-card p-6 sm:p-10 text-center"
          style={{ '--rc': '16, 185, 129' } as React.CSSProperties}
        >
          <div className="zion-kicker border-emerald-500/30 bg-emerald-500/10 text-emerald-400 mx-auto inline-flex">
            <Sparkles className="h-4 w-4" />
            Live Beta — Backend + Frontend Complete
          </div>
          <h1 className="mt-6 text-4xl sm:text-6xl font-semibold text-gradient leading-tight">
            ZionDex
          </h1>
          <p className="mt-4 text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto">
            First universal cross-chain DEX powered by L3 WARP bridge.
            Swap any token on any chain — in one transaction.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="/dex"
              className="zion-button-primary text-sm"
            >
              <Zap className="h-4 w-4" />
              Open Swap Interface
            </a>
            <a
              href="https://github.com/Zion-TerraNova/v3-Mainnet"
              target="_blank"
              rel="noreferrer"
              className="zion-button-secondary text-sm text-gray-300"
            >
              <Github className="h-4 w-4" />
              Source on GitHub
            </a>
            <a
              href="/bridge"
              className="zion-button-secondary text-sm text-gray-300"
            >
              <ArrowLeftRight className="h-3 w-3" />
              WARP Bridge
            </a>
          </div>
        </section>

        {/* The Problem */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">The Problem</h2>
          <div
            className="zion-rainbow-sub p-6"
            style={{ '--rc': '239, 68, 68' } as React.CSSProperties}
          >
            <p className="text-gray-300">
              Today, swapping <span className="text-white font-semibold">USDC (Solana) → ETH (Base)</span> requires:
            </p>
            <ol className="mt-4 space-y-2 text-sm text-gray-400">
              <li>1. Swap USDC → SOL on Raydium</li>
              <li>2. Bridge SOL Solana → Ethereum (Wormhole/Portal)</li>
              <li>3. Swap ETH → USDC on Uniswap</li>
              <li className="text-red-400 font-semibold">→ 3 transactions, 3x fees, 3x waiting, 3x risk</li>
            </ol>
          </div>
        </section>

        {/* The Solution */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">The Solution</h2>
          <div
            className="zion-rainbow-sub p-6"
            style={{ '--rc': '16, 185, 129' } as React.CSSProperties}
          >
            <p className="text-gray-300">
              With <span className="text-emerald-400 font-semibold">ZionDex + L3 WARP</span>:
            </p>
            <ol className="mt-4 space-y-2 text-sm text-gray-400">
              <li>1. <span className="text-white font-semibold">One transaction</span> — ZionDex Router finds the best path</li>
              <li>2. L3 WARP bridges ZION natively between chains (no wrapped synthetic)</li>
              <li>3. AMM swaps locally on each chain (Uniswap V3 / Jupiter / ZionDex AMM)</li>
              <li className="text-emerald-400 font-semibold">→ Cross-chain swap in one TX</li>
            </ol>
            <p className="mt-4 text-xs text-gray-500">
              Nobody else does this. THORChain does cross-chain swaps but only for 5-6 assets.
              Wormhole bridges but doesn't swap. LI.FI aggregates but doesn't transfer native L1 assets.
            </p>
          </div>
        </section>

        {/* What's Built */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">What&apos;s Built — Live Now</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: 'L3 WARP Bridge', value: '13 chain families, port 8453, 5/5 quorum', icon: '🌐', done: true },
              { label: 'ZionDex Router', value: 'Rust, 14/14 tests, 9 API endpoints', icon: '⚡', done: true },
              { label: 'EVM Swap Execution', value: 'ethers-rs signing, Uniswap V3 SwapRouter', icon: '🔗', done: true },
              { label: 'Solana Swap', value: 'Jupiter aggregator API (Raydium/Orca)', icon: '☀️', done: true },
              { label: 'ZionDex AMM Contracts', value: '7/7 Foundry tests, 0.15% ZION pair fee', icon: '💧', done: true },
              { label: 'TypeScript SDK', value: '@zion/dex-sdk — full type defs', icon: '📦', done: true },
              { label: 'Web Swap UI', value: '/dex — Next.js, 16 chains, price chart', icon: '🖥️', done: true },
              { label: 'Mobile Swap', value: 'React Native DexScreen, bottom nav', icon: '📱', done: true },
              { label: 'Desktop Swap', value: 'Electron dex-view, sidebar nav', icon: '💻', done: true },
              { label: 'Liquidity Pools UI', value: '/dex/liquidity — add/remove LP', icon: '🏊', done: true },
              { label: 'Portfolio Tracker', value: '/dex/portfolio — LP positions + history', icon: '📊', done: true },
              { label: 'Bridge Vault', value: '~100M ZION locked on L1', icon: '🏦', done: true },
            ].map((item) => (
              <div
                key={item.label}
                className="zion-rainbow-sub p-4"
                style={{ '--rc': '16, 185, 129' } as React.CSSProperties}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{item.icon}</span>
                  <span className="text-sm font-semibold text-white">{item.label}</span>
                  {item.done && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 ml-auto" />}
                </div>
                <p className="text-xs text-gray-400">{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Architecture */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">Architecture</h2>
          <div
            className="zion-rainbow-sub p-6 font-mono text-xs text-gray-400 overflow-x-auto"
            style={{ '--rc': '99, 102, 241' } as React.CSSProperties}
          >
            <pre className="whitespace-pre">{`┌─────────────────────────────────────────────────────────┐
│                    ZionDex Frontend                       │
│   Web (/dex)  ·  Mobile  ·  Desktop                      │
├─────────────────────────────────────────────────────────┤
│                  ZionDex Router (Rust)                     │
│    Path finding · Price discovery · Fee estimation        │
├──────────────┬──────────────┬────────────────────────────┤
│  AMM Layer   │  L3 WARP     │  Aggregator Layer          │
│  (per-chain) │  Bridge      │  (3rd-party DEXs)         │
├──────────────┼──────────────┼────────────────────────────┤
│ ZionDex AMM  │  WARP Router │  Uniswap V3 (EVM)         │
│ (0.15% fee)  │  (port 8453) │  Jupiter (Solana)         │
│ Uni V4 hooks │  13 chains   │  + 10 more DEXs           │
└──────────────┴──────────────┴────────────────────────────┘`}</pre>
          </div>
        </section>

        {/* Roadmap */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">Roadmap</h2>
          <div className="space-y-3">
            {[
              { phase: 'Phase 1', date: 'Q3 2026', title: 'Liquidity Bootstrapping', status: 'active' },
              { phase: 'Phase 2', date: 'Q4 2026', title: 'ZionDex Router + Cross-Chain Swap', status: 'done' },
              { phase: 'Phase 3', date: 'Q1 2027', title: 'Custom AMM + ZDX Token', status: 'active' },
              { phase: 'Phase 4', date: 'Q2 2027', title: 'Intent-Based Execution + Aggregator', status: 'planned' },
              { phase: 'Phase 5', date: 'Q3 2027', title: 'Multi-Chain AMM Deployment', status: 'planned' },
            ].map((p) => (
              <div
                key={p.phase}
                className={`zion-rainbow-sub p-4 flex items-center justify-between ${p.status === 'planned' ? 'opacity-50' : ''}`}
                style={{ '--rc': p.status === 'done' ? '16, 185, 129' : p.status === 'active' ? '99, 102, 241' : '99, 102, 241' } as React.CSSProperties}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                      p.status === 'done'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : p.status === 'active'
                          ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                          : 'bg-white/5 text-gray-500 border border-white/10'
                    }`}
                  >
                    {p.phase.split(' ')[1]}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">{p.title}</p>
                    <p className="text-xs text-gray-500">{p.date}</p>
                  </div>
                </div>
                {p.status === 'done' && (
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
                    Done
                  </span>
                )}
                {p.status === 'active' && p.phase !== 'Phase 1' && (
                  <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-400 uppercase tracking-wider">
                    In Progress
                  </span>
                )}
                {p.status === 'active' && p.phase === 'Phase 1' && (
                  <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-400 uppercase tracking-wider">
                    In Progress
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="zion-cta-banner">
          <h2 className="text-3xl font-semibold text-white">Try it now</h2>
          <p className="mt-4 text-gray-100 max-w-2xl mx-auto">
            ZionDex Router, AMM contracts, and frontend are complete.
            The L3 WARP bridge is live. Start swapping across 13 chain families.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <a
              href="/dex"
              className="zion-button-primary"
            >
              <Zap className="h-4 w-4" />
              Open Swap Interface
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="/dex/liquidity"
              className="zion-button-secondary"
            >
              <Coins className="h-4 w-4" />
              Liquidity Pools
            </a>
            <a
              href="/dex/portfolio"
              className="zion-button-secondary"
            >
              <ArrowRightLeft className="h-4 w-4" />
              Portfolio
            </a>
            <a
              href="/bridge"
              className="zion-button-secondary"
            >
              <ArrowLeftRight className="h-4 w-4" />
              WARP Bridge
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
