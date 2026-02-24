'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  CircuitBoard,
  CloudLightning,
  Globe2,
  Lock,
  ShieldCheck,
  Sparkles,
  Zap
} from 'lucide-react';

const warpStats = [
  { label: 'Corridors Planned', value: '11', detail: 'BTC · ETH · SOL · L2 + Lightning', icon: CloudLightning },
  { label: 'Guardian Nodes', value: '3 / 3', detail: 'Helsinki · Usa · Asia', icon: ShieldCheck },
  { label: 'Development Phase', value: 'Phase 2', detail: 'Architecture + validator design', icon: Globe2 },
  { label: 'Target Launch', value: 'Q3 2026', detail: 'After security audit completion', icon: Zap }
];

const corridorRows = [
  {
    title: 'Bitcoin HTLC Bridge',
    subtitle: 'SegWit + Taproot',
    entries: [
      { label: 'Security Model', value: 'HTLC · 2-of-3 multi-sig · 24h timelock' },
      { label: 'Status', value: 'Architecture design — planned for Q3 2026' },
      { label: 'Use cases', value: 'Trustless swaps, Lightning exits, OTC bridging' }
    ]
  },
  {
    title: 'Ethereum Lock/Mint',
    subtitle: 'wZION ERC-20',
    entries: [
      { label: 'Validators', value: 'Multi-sig quorum · audit planned Q2–Q3 2026' },
      { label: 'Status', value: 'Smart contract development in progress' },
      { label: 'Integration', value: 'EVM wallets, DeFi routing, DAO treasury' }
    ]
  },
  {
    title: 'Solana SPL Program',
    subtitle: 'PDA-secured',
    entries: [
      { label: 'Finality', value: 'Tower BFT integration planned' },
      { label: 'Status', value: 'Research phase — after BTC + ETH bridges' },
      { label: 'Utility', value: 'Game assets, liquidity routing, warp swaps' }
    ]
  }
];

const onboarding = [
  {
    title: '1 · Provision access',
    items: [
      'Whitelist validators or fetch public endpoints',
      'Generate API tokens (read/transfer scopes)',
      'Download SDK from official GitHub'
    ]
  },
  {
    title: '2 · Wire liquidity',
    items: [
      'Lock assets into chosen corridor pool',
      'Set validator quorum + alert webhooks',
      'Run smoke test using sandbox chain pairs'
    ]
  },
  {
    title: '3 · Monitor + optimize',
    items: [
      'Subscribe to validator dashboard streams',
      'Enable compact block relay metrics',
      'Schedule weekly failover + incident drills'
    ]
  }
];

export default function WarpPage() {
  return (
    <div className="min-h-screen pt-32 pb-24 px-4">
      <div className="container mx-auto max-w-6xl space-y-16">
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl md:rounded-[32px] border border-white/10 bg-black/60 p-6 md:p-10 backdrop-blur-xl shadow-[0_30px_120px_rgba(0,0,0,0.45)]"
        >
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-zion-purple/40 bg-zion-purple/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-gold uppercase">
                <Sparkles className="h-4 w-4" />
                Warp 2.0 · Corridor Ops
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-gray-400">Cross-chain flight deck</p>
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-gradient leading-tight">
                  Liquidity without borders
                </h1>
              </div>
              <p className="text-lg text-gray-300 max-w-2xl">
                Trustless Bitcoin swaps, Ethereum lock/mint, Solana SPL mint, Lightning exits and AMM routing from one console.
                Corridors share validator telemetry, liquidity analytics, and automated alerts so treasury teams know exactly what is happening on every chain.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  href="/api-reference"
                  className="inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-zion-gold via-zion-purple to-zion-cyan px-6 py-3 text-sm font-semibold text-black"
                >
                  Explore bridge APIs
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/docs"
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white"
                >
                  Read validator guide
                </Link>
              </div>
            </div>
            <div className="grid w-full gap-4 sm:grid-cols-2 lg:w-auto">
              {warpStats.map((chip) => (
                <div key={chip.label} className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur">
                  <chip.icon className="h-6 w-6 text-zion-gold" />
                  <p className="mt-3 text-xs uppercase tracking-[0.3em] text-gray-400">{chip.label}</p>
                  <p className="text-3xl font-semibold text-white">{chip.value}</p>
                  <p className="text-sm text-gray-300">{chip.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="space-y-6"
        >
          <div className="flex flex-col gap-2">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Corridor grid</p>
            <h2 className="text-3xl font-semibold text-white">Validator-backed bridges</h2>
          </div>
          <div className="space-y-6">
            {corridorRows.map((row) => (
              <div key={row.title} className="rounded-3xl border border-white/10 bg-black/40 p-6">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{row.subtitle}</p>
                    <h3 className="text-2xl font-semibold text-white">{row.title}</h3>
                  </div>
                  <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-gray-300">
                    In development
                  </span>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  {row.entries.map((entry) => (
                    <div key={entry.label} className="rounded-2xl border border-white/5 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{entry.label}</p>
                      <p className="mt-2 text-sm text-gray-200 leading-relaxed">{entry.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="rounded-[32px] border border-white/10 bg-white/5 p-8"
        >
          <div className="flex flex-col gap-2">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Operations runbook</p>
            <h2 className="text-3xl font-semibold text-white">Bring a new corridor online</h2>
          </div>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {onboarding.map((block, idx) => (
              <div key={block.title} className="rounded-3xl border border-white/10 bg-black/30 p-6">
                <div className="flex items-center gap-3">
                  <CircuitBoard className="h-5 w-5 text-zion-cyan" />
                  <p className="text-xs uppercase tracking-[0.35em] text-gray-400">Stage {idx + 1}</p>
                </div>
                <h3 className="mt-3 text-xl font-semibold text-white">{block.title}</h3>
                <ul className="mt-4 space-y-2 text-sm text-gray-300">
                  {block.items.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <Lock className="h-4 w-4 text-zion-gold mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.25 }}
          className="rounded-[32px] border border-zion-gold/30 bg-linear-to-r from-zion-purple/30 via-zion-gold/10 to-zion-purple/30 p-10 text-center"
        >
          <Activity className="mx-auto h-12 w-12 text-zion-gold" />
          <h2 className="mt-6 text-3xl font-semibold text-white">Need custom routing or institutional onboarding?</h2>
          <p className="mt-4 text-gray-100 max-w-3xl mx-auto">
            The core team runs managed validators and can help bootstrap your corridor, connect OTC liquidity, or add
            new chains. Reach out via official channels or open an issue on the public GitHub with replication steps.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="https://github.com/Zion-TerraNova"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl bg-black/70 px-6 py-3 text-sm font-semibold text-white border border-white/20"
            >
              Open GitHub discussions
            </Link>
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 rounded-2xl bg-white/90 px-6 py-3 text-sm font-semibold text-gray-900"
            >
              Review integration docs
            </Link>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
