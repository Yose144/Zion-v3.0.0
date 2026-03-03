'use client';

import { motion } from 'framer-motion';
import { Brain, Cpu, Landmark, Rocket, Shield, Sparkles, Zap } from 'lucide-react';

const continuumTracks = [
  {
    title: 'Cosmic Harmony PoW',
    description: 'Custom multi-algorithm mining: RandomX + Yescrypt + Blake3, difficulty auto-retarget every 720 blocks.',
    icon: Brain,
    badge: 'L1 Core',
    spectrum: 'from-zion-cyan/20 via-zion-purple/10 to-transparent',
  },
  {
    title: 'Native Miner Fleet',
    description: 'Rust-compiled miners for macOS (ARM64), Linux (x86_64), and Windows with stratum-v2 pool protocol.',
    icon: Cpu,
    badge: 'TestNet',
    spectrum: 'from-zion-gold/20 via-orange-500/10 to-transparent',
  },
  {
    title: 'DAO Governance',
    description: 'On-chain voting for treasury allocation, protocol upgrades, and community proposals. Planned for Phase 3.',
    icon: Landmark,
    badge: 'Planned',
    spectrum: 'from-rose-500/20 via-zion-purple/10 to-transparent',
  },
  {
    title: 'WARP Bridges',
    description: 'Cross-chain bridges (ETH, SOL, Cosmos) via HTLC and relay protocols. Planned for L3 layer (2027+).',
    icon: Rocket,
    badge: 'L3 · 2027+',
    spectrum: 'from-emerald-500/20 via-zion-cyan/10 to-transparent',
  },
  {
    title: 'P2P Network',
    description: 'libp2p-based peer discovery, block propagation, and mempool sync across 2 EU validator nodes.',
    icon: Shield,
    badge: 'Live',
    spectrum: 'from-blue-500/20 via-cyan-400/10 to-transparent',
  },
  {
    title: 'Block Explorer',
    description: 'Real-time block, transaction, and address explorer with live telemetry dashboard and REST API.',
    icon: Sparkles,
    badge: 'Live',
    spectrum: 'from-violet-500/20 via-fuchsia-400/10 to-transparent',
  },
];

const timeline = [
  { phase: 'Fáze 1 · Now', detail: 'Hardened TestNet — Rust pool, Cosmic Harmony mining, P2P sync. 80 % done.' },
  { phase: 'Fáze 2–3 · Q2–Q3 2026', detail: 'Node UX, wallet CLI/GUI, infrastructure, security audits, legal.' },
  { phase: 'Fáze 4–5 · Q4 2026', detail: 'Dress rehearsal, genesis config, MainNet launch 31. 12. 2026.' },
];

export default function Features() {
  return (
    <section className="py-24 px-4">
      <div className="zion-container space-y-12">
        <div className="flex flex-col lg:flex-row lg:items-end gap-6">
          <div className="flex-1">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-400">Continuum</p>
            <h2 className="text-4xl md:text-5xl font-bold text-white">
              Pillars of the <span className="text-gradient">ZION Native Stack</span>
            </h2>
          </div>
          <p className="text-lg text-gray-300 max-w-2xl">
            Native Rust L1 infrastructure powering miners, P2P network, and block explorer.
            Everything open-source on TestNet 2.9.5 with 2 EU validator nodes.
          </p>
        </div>

        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-10">
          <div className="grid sm:grid-cols-2 gap-6">
            {continuumTracks.map((track, index) => (
              <motion.div
                key={track.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.05 }}
                className={`rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur hover:border-white/30 transition relative overflow-hidden`}
              >
                <div className={`absolute inset-0 bg-linear-to-br ${track.spectrum} opacity-70 pointer-events-none`} />
                <div className="relative space-y-3">
                  <div className="flex items-center justify-between">
                    <track.icon className="w-6 h-6 text-white" />
                    <span className="text-xs font-semibold tracking-wide text-zion-gold bg-zion-gold/10 rounded-full px-3 py-1">
                      {track.badge}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold text-white">{track.title}</h3>
                  <p className="text-sm text-gray-200 leading-relaxed">{track.description}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="rounded-[32px] border border-white/10 bg-black/50 backdrop-blur-xl p-8 space-y-6"
          >
            <div className="flex items-center gap-3 text-sm text-gray-400">
              <Zap className="w-5 h-5 text-zion-gold" />
              MainNet Timeline
            </div>

            <div className="space-y-5">
              {timeline.map((item) => (
                <div key={item.phase} className="rounded-2xl border border-white/10 p-5">
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{item.phase}</p>
                  <p className="text-base text-white mt-2">{item.detail}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-white/10 bg-linear-to-br from-zion-purple/20 to-zion-cyan/10 p-6 text-gray-100 text-sm">
              Community governance opens in Fáze 3. Join the discussion on GitHub
              to propose features, bounties, or protocol improvements.
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
