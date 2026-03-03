'use client';

import { motion } from 'framer-motion';
import { ArrowRight, CalendarDays, CheckCircle2, Rocket, Target } from 'lucide-react';
import Link from 'next/link';

const phaseCards = [
  {
    name: 'On the Star TestNet',
    window: 'Jan 2026 – Now',
    progress: 90,
    highlights: [
      'Rust mining pool with Cosmic Harmony algorithm',
      'P2P network with libp2p + real-time sync',
      'Native miner binaries for all platforms',
    ],
  },
  {
    name: 'Security & Audit Phase',
    window: 'Q2 2026',
    progress: 15,
    highlights: [
      'Security audit (external firm TBD)',
      'Hardware wallet integration (Ledger/Trezor)',
      'Bug bounty program launch',
    ],
  },
  {
    name: 'MainNet Preparation',
    window: 'Q3–Q4 2026',
    progress: 5,
    highlights: [
      'Full P2P network stress testing',
      'Genesis block configuration',
      'MainNet launch Q4 2026',
    ],
  },
];

const timeline = [
  {
    title: 'Phase 1 · Q1 2026',
    focus: 'Native Rust pool deployment, Cosmic Harmony mining',
  },
  {
    title: 'Phase 2 · Q2 2026',
    focus: 'Security audits, wallet integrations, WARP bridges',
  },
  {
    title: 'Phase 3 · Q3-Q4 2026',
    focus: 'Performance optimization, network stress testing',
  },
  {
    title: 'Phase 4 · Q4 2026',
    focus: 'MainNet launch, full P2P network, production mining live',
  },
];

export default function RoadmapPulse() {
  return (
    <section className="py-24 px-4">
      <div className="zion-container space-y-12">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          <div className="flex-1 space-y-3">
            <p className="text-sm uppercase tracking-[0.4em] text-zion-gold">Roadmap</p>
            <h2 className="text-4xl md:text-5xl font-bold text-white">
              On the Star <span className="text-gradient">v2.9.6 → MainNet 2026</span>
            </h2>
            <p className="text-lg text-gray-300 max-w-2xl">
              TestNet live with native Rust pool, Cosmic Harmony mining, and P2P network.
              Security audits and performance optimization in progress for MainNet Q4 2026.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/roadmap"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-linear-to-r from-zion-gold via-zion-purple to-zion-cyan text-lg font-semibold"
            >
              Full Roadmap
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/explorer"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl border border-white/10 bg-white/5 text-lg font-semibold"
            >
              <CalendarDays className="w-5 h-5 text-zion-cyan" />
              Block Explorer
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {phaseCards.map((phase, idx) => (
            <motion.div
              key={phase.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: idx * 0.05 }}
              className="rounded-3xl border border-white/10 bg-black/50 p-6 space-y-4 backdrop-blur"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-gray-400">{phase.window}</p>
                  <h3 className="text-xl font-semibold text-white">{phase.name}</h3>
                </div>
                <div className="px-3 py-1 text-xs font-semibold text-zion-gold bg-zion-gold/10 rounded-full">
                  {phase.progress}%
                </div>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${phase.progress}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: 0.2 + idx * 0.05 }}
                  className="h-full bg-linear-to-r from-zion-gold via-zion-purple to-zion-cyan"
                />
              </div>
              <ul className="space-y-2 text-sm text-gray-300">
                {phase.highlights.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-zion-cyan mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="rounded-3xl border border-white/10 bg-white/5 p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <Rocket className="w-6 h-6 text-zion-cyan" />
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-gray-400">Sprint Timeline</p>
              <h3 className="text-2xl font-semibold text-white">30-day execution tapes</h3>
            </div>
          </div>

          <div className="grid md:grid-cols-4 gap-4">
            {timeline.map((entry, idx) => (
              <div key={entry.title} className="rounded-2xl border border-white/10 bg-black/40 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{entry.title}</p>
                <p className="text-sm text-gray-200 mt-3 leading-relaxed">{entry.focus}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
