'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  CircuitBoard,
  Gauge,
  Satellite,
  ShieldHalf,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useObservatory } from '@/contexts/ObservatoryContext';
import type { ObservatoryMode } from '@/contexts/ObservatoryContext';

const missionSignals = [
  {
    title: 'L1 Core',
    status: 'Fáze 1 · 80 %',
    value: '46 690 LOC · 512 testů · Rust',
    accent: 'text-emerald-300',
  },
  {
    title: 'Validator Grid',
    status: '2 / 2 nodes online',
    value: '5 seed nodes synced',  // Helsinki, SeedDE, Usa1, Usa2, Asia3
    accent: 'text-zion-cyan',
  },
  {
    title: 'MainNet Goal',
    status: '31. 12. 2026',
    value: 'Fáze 2–5 in pipeline',
    accent: 'text-zion-purple',
  },
];

const heroMetrics = [
  { label: 'LOC (Rust)', value: '46 690', icon: Zap },
  { label: 'Nodes Online', value: '2 / 2', icon: Satellite },
  { label: 'Tests Passing', value: '512', icon: Gauge },
];

const observatoryMeta: Record<
  ObservatoryMode,
  { signal: string; focus: string; halo: string }
> = {
  'deep-space': {
    signal: 'Interstellar anomaly hunting',
    focus: 'Cosmic miner orchestration',
    halo: 'from-zion-blue/20 via-zion-purple/20 to-transparent',
  },
  'planet-orbit': {
    signal: 'Orbital AI relay + pool sync',
    focus: 'WARP bridges & liquidity',
    halo: 'from-cyan-500/20 via-emerald-400/10 to-transparent',
  },
  'galactic-core': {
    signal: 'DAO chambers + warp council',
    focus: 'Governance + sacred ledgers',
    halo: 'from-pink-500/20 via-orange-400/10 to-transparent',
  },
};

export default function Hero() {
  const { mode, setMode, availableModes } = useObservatory();
  const active = observatoryMeta[mode];

  return (
    <section className="relative pt-32 pb-24 px-4">
      <div className="container mx-auto">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-12 xl:gap-20 items-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-8"
          >
            <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-6 py-2 text-sm uppercase tracking-wide text-zion-gold">
              <Sparkles className="w-4 h-4 animate-pulse" />
              On the Star v2.9.6 · Testnet Live
            </div>

            <div>
              <p className="text-lg md:text-xl text-zion-cyan font-semibold mb-2">Native Rust Mining Infrastructure</p>
              <h1 className="text-4xl md:text-6xl xl:text-7xl font-bold leading-tight">
                <span className="text-gradient">ZION</span>
                <span className="block text-white">Terra Nova ® On the Star</span>
              </h1>
            </div>

            <p className="text-lg md:text-xl text-gray-300 max-w-2xl leading-relaxed">
              Native Rust L1 blockchain with Cosmic Harmony PoW algorithm, real-time P2P network,
              and mining pool infrastructure. TestNet 2.9.5 is live on 2 EU nodes with
              1 220+ blocks mined — preparing for MainNet launch 31. 12. 2026.
            </p>

            <div className="flex flex-col lg:flex-row flex-wrap gap-4">
              <Link
                href="/warp"
                className="group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-linear-to-r from-zion-gold via-zion-purple to-zion-cyan text-lg font-semibold shadow-[0_0_40px_rgba(147,51,234,0.35)]"
              >
                Launch WARP Deck
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/docs"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl border border-white/10 bg-white/5 text-lg font-semibold hover:border-white/30"
              >
                <ShieldHalf className="w-5 h-5 text-zion-cyan" />
                Guardian Docs
              </Link>
              <Link
                href="/download"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl border border-white/10 text-lg font-semibold hover:border-zion-gold/60"
              >
                <CircuitBoard className="w-5 h-5 text-zion-gold" />
                Native Miner
              </Link>
              <Link
                href="https://github.com/Zion-TerraNova"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl border border-white/10 bg-black/40 text-lg font-semibold hover:border-white/30"
              >
                <CircuitBoard className="w-5 h-5 text-zion-cyan" />
                Official GitHub
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {heroMetrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur hover:border-white/25 transition"
                >
                  <metric.icon className="w-5 h-5 text-zion-gold mb-3" />
                  <div className="text-2xl font-bold text-white">{metric.value}</div>
                  <div className="text-sm uppercase tracking-wide text-gray-400">{metric.label}</div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.2 }}
            className="relative"
          >
            <div className="absolute -inset-6 rounded-[32px] bg-linear-to-br from-zion-purple/30 via-zion-cyan/20 to-transparent blur-3xl" />
            <div className="relative rounded-[28px] border border-white/10 bg-black/50 backdrop-blur-xl p-6 space-y-6 shadow-[0_25px_80px_rgba(0,0,0,0.45)] hud-grid">
              <header className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase text-gray-400 tracking-[0.3em]">Observatory Mode</p>
                  <h3 className="text-2xl font-semibold text-white">{availableModes.find((m) => m.id === mode)?.label}</h3>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">Signal Focus</p>
                  <p className="text-sm text-zion-cyan font-semibold">{active.focus}</p>
                </div>
              </header>

              <div className="rounded-2xl border border-white/5 bg-linear-to-br from-white/5 to-white/0 p-4">
                <p className="text-sm text-gray-400">Current Scanline</p>
                <p className="text-base text-white">{active.signal}</p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {availableModes.map((availableMode) => (
                  <button
                    key={availableMode.id}
                    onClick={() => setMode(availableMode.id)}
                    className={`group flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                      mode === availableMode.id
                        ? 'border-zion-gold/50 bg-white/10 shadow-[0_15px_40px_rgba(249,217,118,0.15)]'
                        : 'border-white/10 hover:border-white/25'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-semibold text-white flex items-center gap-2">
                        <span className="inline-block h-2 w-2 rounded-full bg-zion-cyan animate-pulse" />
                        {availableMode.label}
                      </p>
                      <p className="text-xs text-gray-400">{availableMode.description}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-white" />
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-3">
                {missionSignals.map((signal) => (
                  <div
                    key={signal.title}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm text-white">{signal.title}</p>
                      <p className="text-xs text-gray-400">{signal.value}</p>
                    </div>
                    <span className={`text-xs font-semibold ${signal.accent}`}>{signal.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
