'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BrainCircuit,
  CircuitBoard,
  Gauge,
  Rocket,
  Satellite,
  ShieldHalf,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useObservatory } from '@/contexts/ObservatoryContext';
import type { ObservatoryMode } from '@/contexts/ObservatoryContext';
import CosmicFlowers from './CosmicFlowers';

const missionSignals = [
  {
    title: 'L1 Core',
    status: 'Phase 1 · 82 %',
    value: '52 590 LOC · 780+ tests · Rust',
    accent: 'text-emerald-300',
  },
  {
    title: 'Validator Grid',
    status: '3 / 3 nodes online',
    value: 'Helsinki · USA · Asia',
    accent: 'text-zion-cyan',
  },
  {
    title: 'MainNet Gate',
    status: '31. 12. 2026',
    value: 'Phases 2–5 in pipeline',
    accent: 'text-zion-purple',
  },
];

const heroMetrics = [
  { label: 'Rust LOC', value: '52 590', icon: Zap },
  { label: 'Nodes Online', value: '3 / 3', icon: Satellite },
  { label: 'Tests Passing', value: '780+', icon: Gauge },
];

const observatoryMeta: Record<
  ObservatoryMode,
  { signal: string; focus: string }
> = {
  'deep-space': {
    signal: 'Interstellar anomaly hunting',
    focus: 'Cosmic miner orchestration',
  },
  'planet-orbit': {
    signal: 'Orbital AI relay + pool sync',
    focus: 'WARP bridges & liquidity',
  },
  'galactic-core': {
    signal: 'DAO chambers + warp council',
    focus: 'Governance + sacred ledgers',
  },
};

/* ─── tiny floating petal accent ─── */
function MiniPetal({
  cx, cy, delay, size, color,
}: { cx: number; cy: number; delay: number; size: number; color: string }) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        left: `${cx}%`,
        top: `${cy}%`,
        width: size,
        height: size * 2.4,
        background: color,
        borderRadius: '50% 50% 50% 50% / 80% 80% 20% 20%',
        filter: 'blur(1px)',
      }}
      animate={{
        y: [0, -14, 0],
        rotate: [0, 20, 0],
        opacity: [0.35, 0.7, 0.35],
      }}
      transition={{ duration: 5 + delay, repeat: Infinity, ease: 'easeInOut', delay }}
    />
  );
}

const miniPetals = [
  { cx: 8,  cy: 30, delay: 0,   size: 6, color: 'rgba(147,51,234,0.7)' },
  { cx: 12, cy: 55, delay: 1.2, size: 4, color: 'rgba(6,182,212,0.6)'  },
  { cx: 5,  cy: 75, delay: 2.4, size: 7, color: 'rgba(255,215,0,0.55)' },
  { cx: 91, cy: 20, delay: 0.6, size: 5, color: 'rgba(6,182,212,0.65)' },
  { cx: 95, cy: 50, delay: 1.8, size: 8, color: 'rgba(147,51,234,0.6)' },
  { cx: 88, cy: 78, delay: 3,   size: 4, color: 'rgba(255,215,0,0.5)'  },
  { cx: 50, cy: 5,  delay: 0.9, size: 5, color: 'rgba(147,51,234,0.5)' },
  { cx: 48, cy: 92, delay: 2.1, size: 6, color: 'rgba(6,182,212,0.55)' },
];

export default function Hero() {
  const { mode, setMode, availableModes } = useObservatory();
  const active = observatoryMeta[mode];

  return (
    <section className="relative pt-32 pb-28 px-4 overflow-hidden">
      {/* ── ambient gradients ── */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[700px] h-[700px] rounded-full bg-violet-700/12 blur-3xl" />
        <div className="absolute top-60 -right-32 w-[500px] h-[500px] rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-[600px] h-[400px] rounded-full bg-zion-gold/6 blur-3xl" />
      </div>

      {/* ── animated SVG flowers ── */}
      <CosmicFlowers className="z-0" />

      {/* ── mini floating petals ── */}
      {miniPetals.map((p, i) => (
        <MiniPetal key={i} {...p} />
      ))}

      <div className="zion-container relative z-10">
        {/* ─── top badge row ─── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-wrap items-center gap-3 mb-12 justify-center lg:justify-start"
        >
          <div className="inline-flex items-center gap-2 bg-zion-gold/10 border border-zion-gold/25 rounded-full px-5 py-2 text-xs uppercase tracking-widest text-zion-gold font-semibold">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            On the Star · v2.9.7 · TestNet Live
          </div>
          <div className="inline-flex items-center gap-2 bg-pink-500/10 border border-pink-500/25 rounded-full px-5 py-2 text-xs uppercase tracking-widest text-pink-300 font-semibold">
            <BrainCircuit className="w-3.5 h-3.5 animate-pulse" />
            CHv4 Neural Bloom — roadmap 2026
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-14 xl:gap-24 items-start">
          {/* ─── LEFT col ─── */}
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85 }}
            className="space-y-8"
          >
            {/* headline */}
            <div>
              <p className="text-lg md:text-xl text-zion-cyan font-semibold mb-3 tracking-wide">
                Native Rust Mining Infrastructure
              </p>
              <h1 className="text-5xl md:text-6xl xl:text-7xl font-extrabold leading-[1.06] tracking-tight">
                <span className="text-gradient">ZION</span>
                <span className="block text-white mt-1">Terra Nova</span>
                <span className="block text-2xl md:text-3xl xl:text-4xl font-semibold text-white/60 mt-2 tracking-normal">
                  On the Star &nbsp;·&nbsp; v2.9.7
                </span>
              </h1>
            </div>

            {/* paragraph */}
            <p className="text-lg md:text-xl text-gray-300 max-w-xl leading-relaxed">
              52 590 lines of native Rust. 780+ tests. Cosmic Harmony PoW algorithm, real-time
              P2P network, and a mining pool running on 3 live EU/US/Asia nodes.
              CHv4 <span className="text-pink-300 font-semibold">Neural Bloom</span> algorithm
              upgrade targets MainNet hard-fork 2026 — doubling memory hardness with an
              anti-ASIC perceptron barrier.
            </p>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row flex-wrap gap-3">
              <Link
                href="/warp"
                className="group inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-gradient-to-r from-zion-gold via-zion-purple to-zion-cyan text-base font-semibold shadow-[0_0_45px_rgba(147,51,234,0.40)] hover:shadow-[0_0_60px_rgba(147,51,234,0.55)] transition-shadow"
              >
                Launch WARP Deck
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/docs"
                className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl border border-white/15 bg-white/5 text-base font-semibold hover:border-white/35 transition"
              >
                <ShieldHalf className="w-5 h-5 text-zion-cyan" />
                Guardian Docs
              </Link>
              <Link
                href="/download"
                className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl border border-white/15 text-base font-semibold hover:border-zion-gold/60 transition"
              >
                <CircuitBoard className="w-5 h-5 text-zion-gold" />
                Native Miner
              </Link>
            </div>

            {/* CHv4 teaser card */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="relative rounded-2xl border border-pink-500/25 bg-gradient-to-br from-pink-500/10 via-violet-500/8 to-transparent p-5 backdrop-blur overflow-hidden"
            >
              <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-pink-500/15 to-violet-600/10 blur-sm pointer-events-none" />
              <div className="relative flex items-start gap-4">
                <div className="flex-none w-10 h-10 rounded-xl bg-pink-500/15 flex items-center justify-center">
                  <BrainCircuit className="w-5 h-5 text-pink-300" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-white">CHv4 Neural Bloom</span>
                    <span className="text-xs bg-pink-500/20 text-pink-300 px-2 py-0.5 rounded-full font-semibold">
                      Roadmap
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    5-phase algorithm · 4 MB scratchpad · 8-round Feistel perceptron · Ed448-Goldilocks ·
                    Planned MainNet activation hard-fork.
                  </p>
                </div>
                <a
                  href="#chv4"
                  className="flex-none ml-auto text-xs text-pink-300 hover:text-pink-200 flex items-center gap-1 transition"
                >
                  Details <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </motion.div>

            {/* metrics strip */}
            <div className="grid grid-cols-3 gap-3">
              {heroMetrics.map((metric, i) => (
                <motion.div
                  key={metric.label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.5 + i * 0.1 }}
                  className="group rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur hover:border-white/25 hover:bg-white/8 transition cursor-default"
                >
                  <metric.icon className="w-4 h-4 text-zion-gold mb-2" />
                  <div className="text-xl font-bold text-white">{metric.value}</div>
                  <div className="text-xs uppercase tracking-wide text-gray-500 mt-0.5">{metric.label}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* ─── RIGHT col — Observatory HUD ─── */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.25 }}
            className="relative"
          >
            {/* outer halo glow */}
            <div className="absolute -inset-6 rounded-[32px] bg-gradient-to-br from-violet-600/25 via-cyan-500/15 to-transparent blur-3xl pointer-events-none" />

            <div className="relative rounded-[28px] border border-white/10 bg-black/55 backdrop-blur-2xl p-6 space-y-5 shadow-[0_30px_90px_rgba(0,0,0,0.5)]">
              {/* HUD header */}
              <header className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase text-gray-500 tracking-[0.3em] mb-1">Observatory Mode</p>
                  <h3 className="text-xl font-bold text-white">
                    {availableModes.find((m) => m.id === mode)?.label}
                  </h3>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 mb-1">Signal Focus</p>
                  <p className="text-sm text-zion-cyan font-semibold">{active.focus}</p>
                </div>
              </header>

              {/* scanline */}
              <div className="rounded-xl border border-white/6 bg-gradient-to-br from-white/5 to-transparent p-4">
                <p className="text-xs text-gray-500 mb-1">Current Scanline</p>
                <p className="text-sm text-white">{active.signal}</p>
              </div>

              {/* mode buttons */}
              <div className="grid grid-cols-1 gap-2">
                {availableModes.map((availableMode) => (
                  <button
                    key={availableMode.id}
                    onClick={() => setMode(availableMode.id)}
                    className={`group flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-all ${
                      mode === availableMode.id
                        ? 'border-zion-gold/45 bg-white/10 shadow-[0_10px_35px_rgba(249,217,118,0.12)]'
                        : 'border-white/8 hover:border-white/22 hover:bg-white/5'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-semibold text-white flex items-center gap-2">
                        <span
                          className={`inline-block h-1.5 w-1.5 rounded-full ${
                            mode === availableMode.id ? 'bg-zion-gold animate-pulse' : 'bg-zion-cyan/50'
                          }`}
                        />
                        {availableMode.label}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{availableMode.description}</p>
                    </div>
                    <ArrowRight
                      className={`w-4 h-4 transition-all ${
                        mode === availableMode.id ? 'text-zion-gold translate-x-0.5' : 'text-gray-600 group-hover:text-white'
                      }`}
                    />
                  </button>
                ))}
              </div>

              {/* mission signals */}
              <div className="space-y-2">
                <p className="text-xs uppercase text-gray-600 tracking-[0.2em]">Mission Status</p>
                {missionSignals.map((signal) => (
                  <div
                    key={signal.title}
                    className="flex items-center justify-between rounded-xl border border-white/8 bg-white/4 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm text-white font-medium">{signal.title}</p>
                      <p className="text-xs text-gray-500">{signal.value}</p>
                    </div>
                    <span className={`text-xs font-semibold ${signal.accent}`}>{signal.status}</span>
                  </div>
                ))}
              </div>

              {/* version pill */}
              <div className="flex items-center gap-2 pt-1">
                <Rocket className="w-4 h-4 text-zion-gold" />
                <span className="text-xs text-gray-400">
                  Pre-MainNet Gate · v2.9.7 · CHv4 upgrade in dev
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
