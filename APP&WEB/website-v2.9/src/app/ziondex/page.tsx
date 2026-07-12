import React from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Zap,
  Github,
  ArrowRight,
  ArrowLeftRight,
  Droplets,
  Wallet,
  TrendingUp,
  Layers,
  Shield,
  Globe,
  Coins,
  Repeat,
  CheckCircle2,
} from 'lucide-react';

export const metadata = {
  title: 'ZionDex — Cross-Chain DEX Hub | ZION TerraNova',
  description: 'Universal cross-chain DEX powered by L3 WARP bridge. Swap, provide liquidity, track portfolio, bridge assets, and explore DeFi — all from one hub.',
};

const dexCards = [
  {
    href: '/dex',
    title: 'Swap',
    description: 'Cross-chain token swaps via ZionDex Router and L3 WARP. 13 chain families, live price chart.',
    icon: Zap,
    rc: '245, 158, 11',
    cta: 'Open Swap',
  },
  {
    href: '/dex/liquidity',
    title: 'Liquidity Pools',
    description: 'Add or remove liquidity in ZionDex AMM pools. Earn fees and ZDX rewards.',
    icon: Droplets,
    rc: '16, 185, 129',
    cta: 'Manage Pools',
  },
  {
    href: '/dex/portfolio',
    title: 'Portfolio',
    description: 'Track your swap history, LP positions, fees, and cross-chain volume.',
    icon: Wallet,
    rc: '6, 182, 212',
    cta: 'View Portfolio',
  },
  {
    href: '/bridge',
    title: 'WARP Bridge',
    description: 'Native L1 ↔ Base bridge with no synthetic wrapped tokens. 5/5 validator quorum.',
    icon: ArrowLeftRight,
    rc: '147, 51, 234',
    cta: 'Bridge Assets',
  },
  {
    href: '/swap',
    title: 'Atomic Swap',
    description: 'Trustless HTLC atomic swaps between ZION and other chains. No custodian.',
    icon: Repeat,
    rc: '251, 191, 36',
    cta: 'Swap Atomically',
  },
  {
    href: '/defi',
    title: 'DeFi Hub',
    description: 'Staking, farming, DAO governance, and treasury metrics in one place.',
    icon: TrendingUp,
    rc: '16, 185, 129',
    cta: 'Explore DeFi',
  },
];

const builtItems = [
  { label: 'L3 WARP Bridge', value: '13 chain families, port 8453, 5/5 quorum', done: true },
  { label: 'ZionDex Router', value: 'Rust, 14/14 tests, 9 API endpoints', done: true },
  { label: 'EVM Swap Execution', value: 'ethers-rs signing, Uniswap V3 SwapRouter', done: true },
  { label: 'Solana Swap', value: 'Jupiter aggregator API (Raydium/Orca)', done: true },
  { label: 'ZionDex AMM Contracts', value: '7/7 Foundry tests, 0.15% ZION pair fee', done: true },
  { label: 'Web + Mobile + Desktop', value: 'Next.js, React Native, Electron clients', done: true },
  { label: 'Bridge Vault', value: '~100M ZION locked on L1', done: true },
  { label: 'TypeScript SDK', value: '@zion/dex-sdk with full type definitions', done: true },
];

const roadmap = [
  { phase: 'Phase 1', date: 'Q3 2026', title: 'Liquidity Bootstrapping', status: 'active' },
  { phase: 'Phase 2', date: 'Q4 2026', title: 'ZionDex Router + Cross-Chain Swap', status: 'done' },
  { phase: 'Phase 3', date: 'Q1 2027', title: 'Custom AMM + ZDX Token', status: 'active' },
  { phase: 'Phase 4', date: 'Q2 2027', title: 'Intent-Based Execution + Aggregator', status: 'planned' },
  { phase: 'Phase 5', date: 'Q3 2027', title: 'Multi-Chain AMM Deployment', status: 'planned' },
];

export default function ZionDexPage() {
  return (
    <div className="zion-page">
      <div className="zion-container max-w-6xl space-y-12">
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
            ZionDex Hub
          </h1>
          <p className="mt-4 text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto">
            First universal cross-chain DEX powered by L3 WARP bridge.
            Swap, bridge, pool, and track — all from one place.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/dex" className="zion-button-primary text-sm">
              <Zap className="h-4 w-4" />
              Open Swap
            </Link>
            <Link href="/dex/liquidity" className="zion-button-secondary text-sm text-gray-300">
              <Droplets className="h-4 w-4" />
              Liquidity
            </Link>
            <Link href="/bridge" className="zion-button-secondary text-sm text-gray-300">
              <ArrowLeftRight className="h-3 w-3" />
              WARP Bridge
            </Link>
            <a
              href="https://github.com/Zion-TerraNova/v3-Mainnet"
              target="_blank"
              rel="noreferrer"
              className="zion-button-secondary text-sm text-gray-300"
            >
              <Github className="h-4 w-4" />
              Source
            </a>
          </div>
        </section>

        {/* DEX Hub panels */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-emerald-400" />
            <h2 className="text-2xl font-semibold text-white">DEX Hub</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {dexCards.map((card) => (
              <Link
                key={card.title}
                href={card.href}
                className="zion-rainbow-sub group p-5 flex flex-col"
                style={{ '--rc': card.rc } as React.CSSProperties}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <card.icon className="h-5 w-5" />
                    <h3 className="font-semibold text-white">{card.title}</h3>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-500 group-hover:text-white transition-colors" />
                </div>
                <p className="text-sm text-gray-400 flex-1">{card.description}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold group-hover:text-white transition-colors">
                  {card.cta}
                  <ArrowRight className="h-3 w-3" />
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Why ZionDex */}
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">The Problem</h2>
            <div
              className="zion-rainbow-sub p-6"
              style={{ '--rc': '239, 68, 68' } as React.CSSProperties}
            >
              <p className="text-gray-300">
                Swapping <span className="text-white font-semibold">USDC (Solana) → ETH (Base)</span> today means:
              </p>
              <ol className="mt-4 space-y-2 text-sm text-gray-400">
                <li>1. Swap USDC → SOL on Raydium</li>
                <li>2. Bridge SOL via Wormhole/Portal</li>
                <li>3. Swap ETH → USDC on Uniswap</li>
                <li className="text-red-400 font-semibold">→ 3 transactions, 3x fees, 3x waiting, 3x risk</li>
              </ol>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">The Solution</h2>
            <div
              className="zion-rainbow-sub p-6"
              style={{ '--rc': '16, 185, 129' } as React.CSSProperties}
            >
              <p className="text-gray-300">
                With <span className="text-emerald-400 font-semibold">ZionDex + L3 WARP</span>:
              </p>
              <ol className="mt-4 space-y-2 text-sm text-gray-400">
                <li>1. <span className="text-white font-semibold">One transaction</span> — Router finds the best path</li>
                <li>2. L3 WARP bridges ZION natively (no wrapped synthetic)</li>
                <li>3. AMM swaps locally on each chain (Uniswap V3 / Jupiter / ZionDex AMM)</li>
                <li className="text-emerald-400 font-semibold">→ Cross-chain swap in one TX</li>
              </ol>
            </div>
          </div>
        </section>

        {/* Built now */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <h2 className="text-2xl font-semibold text-white">What&apos;s Built — Live Now</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {builtItems.map((item) => (
              <div
                key={item.label}
                className="zion-rainbow-sub p-4"
                style={{ '--rc': '16, 185, 129' } as React.CSSProperties}
              >
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm font-semibold text-white">{item.label}</span>
                </div>
                <p className="text-xs text-gray-400">{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Architecture */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-indigo-400" />
            <h2 className="text-2xl font-semibold text-white">Architecture</h2>
          </div>
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
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-indigo-400" />
            <h2 className="text-2xl font-semibold text-white">Roadmap</h2>
          </div>
          <div className="space-y-3">
            {roadmap.map((p) => (
              <div
                key={p.phase}
                className={`zion-rainbow-sub p-4 flex items-center justify-between ${p.status === 'planned' ? 'opacity-50' : ''}`}
                style={{ '--rc': p.status === 'done' ? '16, 185, 129' : '99, 102, 241' } as React.CSSProperties}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                      p.status === 'done'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
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
                {p.status === 'active' && (
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
            <Link href="/dex" className="zion-button-primary">
              <Zap className="h-4 w-4" />
              Open Swap
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/dex/liquidity" className="zion-button-secondary">
              <Coins className="h-4 w-4" />
              Liquidity Pools
            </Link>
            <Link href="/dex/portfolio" className="zion-button-secondary">
              <Wallet className="h-4 w-4" />
              Portfolio
            </Link>
            <Link href="/bridge" className="zion-button-secondary">
              <ArrowLeftRight className="h-4 w-4" />
              WARP Bridge
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
