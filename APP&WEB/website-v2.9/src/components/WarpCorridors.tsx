'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Activity, ArrowRight, Shield, SignalHigh, Waves } from 'lucide-react';
import { SITE_RELEASE_LABEL } from '@/lib/site';

const corridorStats = [
  {
    label: 'Planned Lanes',
    value: '11',
    detail: 'ETH · SOL · XLM · ADA · BSC · Polygon · Cosmos · NEAR · TON · XRPL · Avalanche',
  },
  {
    label: 'Target Throughput',
    value: 'Multi-chain',
    detail: 'HTLC-grade warp bridges with adaptive fee curves',
  },
  {
    label: 'Guardian Mesh',
    value: '2 / 2',
    detail: 'Primary host plus internal quorum lanes on the current Zion2 runtime',
  },
];

const warpCorridors = [
  { chain: 'Ethereum', mode: 'LayerZero HTLC', status: 'Planned', liquidity: 'Phase 2', color: 'text-zion-cyan' },
  { chain: 'Solana', mode: 'SPL Warp Program', status: 'Planned', liquidity: 'Phase 2', color: 'text-zion-cyan' },
  { chain: 'Stellar', mode: 'Soroswap Rail', status: 'Research', liquidity: 'Phase 3', color: 'text-zion-gold' },
  { chain: 'Cardano', mode: 'Hydra Head', status: 'Research', liquidity: 'Phase 3', color: 'text-zion-purple' },
  { chain: 'Cosmos', mode: 'IBC Relayer', status: 'Planned', liquidity: 'Phase 2', color: 'text-zion-cyan' },
  { chain: 'NEAR', mode: 'Rainbow Bridge', status: 'Research', liquidity: 'Phase 3', color: 'text-zion-purple' },
  { chain: 'XRPL', mode: 'Hooks / AMM', status: 'Research', liquidity: 'Phase 3', color: 'text-zion-gold' },
  { chain: 'Avalanche', mode: 'Warp Messaging', status: 'Research', liquidity: 'Phase 3', color: 'text-zion-purple' },
];

const validatorDeck = [
  {
    title: 'Guardian Runtime',
    value: 'Zion2 quorum',
    description: 'Single public host with internal validator lanes on the live network',
  },
  {
    title: 'Telemetry',
    value: '30s avg',
    description: 'Node health monitoring with auto-refresh dashboard and stability tracking',
  },
];

export default function WarpCorridors() {
  return (
    <section className="py-24 px-4">
      <div className="zion-container space-y-12">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          <div className="flex-1 space-y-3">
            <p className="text-sm uppercase tracking-[0.4em] text-zion-cyan">WARP NETWORK</p>
            <h2 className="text-4xl md:text-5xl font-bold text-white">
              Liquidity corridors tuned for{' '}
              <span className="text-gradient">{SITE_RELEASE_LABEL}</span>
            </h2>
            <p className="text-lg text-gray-300 max-w-2xl">
              HTLC-grade swaps, SPL warp programs, and DAO-guarded liquidity pools stitched into a single
              command deck. Validators stream proofs every 2.4 seconds with auto-escalation on anomaly.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/warp"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-linear-to-r from-zion-gold via-zion-purple to-zion-cyan text-lg font-semibold shadow-[0_0_40px_rgba(228,30,43,0.35)]"
            >
              Launch Warp Deck
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/dao"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl border border-white/10 bg-white/5 text-lg font-semibold hover:border-white/30"
            >
              <Shield className="w-5 h-5 text-zion-cyan" />
              DAO Council Brief
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {corridorStats.map((stat) => (
            <div key={stat.label} className="zion-rainbow-sub p-6" style={{ '--rc': '217, 70, 239' } as React.CSSProperties}>
              <p className="text-sm uppercase tracking-[0.4em] text-gray-400">{stat.label}</p>
              <p className="text-3xl font-semibold text-white mt-2">{stat.value}</p>
              <p className="text-sm text-gray-400 mt-3 leading-relaxed">{stat.detail}</p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="zion-rainbow-card p-6 space-y-4 hud-grid" style={{ '--rc': '217, 70, 239' } as React.CSSProperties}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-gray-400">Corridors</p>
                <h3 className="text-2xl font-semibold text-white">Live + Integrating</h3>
              </div>
              <div className="inline-flex items-center gap-2 text-xs text-gray-300">
                <SignalHigh className="w-4 h-4 text-zion-gold" />
                Adaptive Fees v2
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              {warpCorridors.map((lane, idx) => (
                <div
                  key={lane.chain}
                  className="zion-rainbow-sub p-4 flex flex-col gap-2" style={{ '--rc': '217, 70, 239' } as React.CSSProperties}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-base font-semibold text-white">{lane.chain}</p>
                    <span className={`text-xs font-semibold ${lane.color}`}>{lane.status}</span>
                  </div>
                  <p className="text-sm text-gray-400">{lane.mode}</p>
                  <div className="text-xs text-gray-500">Roadmap Phase</div>
                  <p className="text-lg font-semibold text-zion-gold">{lane.liquidity}</p>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="zion-rainbow-card p-6 space-y-6" style={{ '--rc': '217, 70, 239' } as React.CSSProperties}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-gray-400">Validator Mesh</p>
                <h3 className="text-2xl font-semibold text-white">Guardian Pulse</h3>
              </div>
              <Activity className="w-6 h-6 text-zion-cyan" />
            </div>

            {validatorDeck.map((block) => (
              <div key={block.title} className="zion-rainbow-sub p-4" style={{ '--rc': '217, 70, 239' } as React.CSSProperties}>
                <p className="text-sm text-gray-400">{block.title}</p>
                <p className="text-2xl font-semibold text-white">{block.value}</p>
                <p className="text-sm text-gray-300 mt-2 leading-relaxed">{block.description}</p>
              </div>
            ))}

            <div className="zion-rainbow-sub p-4 flex items-center gap-4 text-sm text-gray-300" style={{ '--rc': '217, 70, 239' } as React.CSSProperties}>
              <Waves className="w-5 h-5 text-zion-gold" />
              Warp liquidity is governed by DAO orbits. Validators upload proofs to GitHub + IPFS, mirrored via Ansible runbooks every hour.
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
