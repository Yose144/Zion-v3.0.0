'use client';

import { motion } from 'framer-motion';
import {
  Atom,
  BrainCircuit,
  ChevronRight,
  FlaskConical,
  Layers3,
  Rocket,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import t, { tr, tx } from '@/lib/translations';

const phases = [
  {
    id: '01',
    name: 'Quantum Seed',
    desc: 'Deterministic 256-bit header hash · Blake3 pre-image',
    color: 'from-zion-purple-500/20 to-violet-900/5',
    border: 'border-zion-purple-500/30',
    icon: Atom,
    iconColor: 'text-zion-purple-400',
    status: 'stable',
  },
  {
    id: '02',
    name: 'Galactic Matrix',
    desc: '4 MB scratchpad · AES-NI · CPU/GPU optimal · 2× CHv3',
    color: 'from-zion-cyan-500/20 to-cyan-900/5',
    border: 'border-zion-cyan-500/30',
    icon: Layers3,
    iconColor: 'text-zion-cyan-400',
    status: 'upgraded',
    badge: '4 MB ↑',
  },
  {
    id: '03',
    name: 'Neural Bloom',
    desc: 'NEW — 8-round Feistel perceptron · anti-ASIC barrier',
    color: 'from-zion-purple-500/20 to-pink-900/5',
    border: 'border-zion-purple-500/30',
    icon: BrainCircuit,
    iconColor: 'text-zion-purple-400',
    status: 'new',
    badge: 'NEW',
  },
  {
    id: '04',
    name: 'Stellar Harmony',
    desc: 'Argon2id KDF + Salsa20 mixing layer · 512 KB buffer',
    color: 'from-zion-gold-500/20 to-amber-900/5',
    border: 'border-zion-gold-500/30',
    icon: FlaskConical,
    iconColor: 'text-zion-gold-400',
    status: 'stable',
  },
  {
    id: '05',
    name: 'Cosmic Proof',
    desc: 'Ed448-Goldilocks + VRF output · 32-byte final hash',
    color: 'from-zion-cyan-500/20 to-emerald-900/5',
    border: 'border-zion-cyan-500/30',
    icon: ShieldCheck,
    iconColor: 'text-zion-cyan-400',
    status: 'upgraded',
    badge: 'Ed448',
  },
];

const improvements = [
  { label: 'Memory hardness', before: '2 MB', after: '4 MB', pct: '+100%' },
  { label: 'ASIC resistance', before: 'CHv3 baseline', after: 'Neural Bloom layer', pct: '∞' },
  { label: 'Hash iterations', before: '8 rounds', after: '16 rounds', pct: '+100%' },
  { label: 'Estimated GPU speed', before: '~2 MH/s', after: '~1.4 MH/s*', pct: 'deliberate ↓' },
];

const statusColors: Record<string, string> = {
  stable: 'bg-white/10 text-gray-400',
  upgraded: 'bg-zion-cyan-500/15 text-zion-cyan-300',
  new: 'bg-zion-purple-500/15 text-zion-purple-300',
};

export default function CHv4Upgrade() {
  const { lang } = useLang();
  return (
    <section className="relative py-32 px-4 overflow-hidden">
      {/* background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] rounded-full bg-zion-purple-600/8 blur-3xl" />
        <div className="absolute right-0 top-0 w-[400px] h-[400px] rounded-full bg-zion-purple-500/6 blur-3xl" />
      </div>

      <div className="zion-container relative z-10">
        {/* header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="text-center mb-16 space-y-5"
        >
          <div className="inline-flex items-center gap-2 bg-zion-purple-500/10 border border-zion-purple-500/25 rounded-full px-5 py-2 text-xs uppercase tracking-widest text-zion-purple-300 font-semibold">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            {tr('chv4', 'badge', lang)}
          </div>

          <h2 className="text-4xl md:text-5xl xl:text-6xl font-bold">
            <span className="block text-white">Cosmic Harmony</span>
            <span className="text-gradient">v4 — Neural Bloom</span>
          </h2>

          <p className="text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
            {tr('chv4', 'subheading', lang)}
          </p>
        </motion.div>

        {/* phase pipeline */}
        <div className="flex flex-col gap-3 max-w-3xl mx-auto mb-16">
          {phases.map((phase, i) => (
            <motion.div
              key={phase.id}
              initial={{ opacity: 0, x: -24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className={`relative flex items-center gap-5 rounded-2xl border ${phase.border} bg-gradient-to-r ${phase.color} p-5 backdrop-blur-sm`}
            >
              <div className={`flex-none w-10 h-10 rounded-xl bg-black/40 flex items-center justify-center`}>
                <phase.icon className={`w-5 h-5 ${phase.iconColor}`} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs text-gray-500 font-mono">Phase {phase.id}</span>
                  {phase.badge && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusColors[phase.status]}`}>
                      {phase.badge === 'NEW' ? tx(t.chv4.new_badge, lang) : phase.badge}
                    </span>
                  )}
                </div>
                <p className="text-white font-semibold">{phase.name}</p>
                <p className="text-sm text-gray-400 truncate">{phase.desc}</p>
              </div>

              {i < phases.length - 1 && (
                <ChevronRight className="hidden lg:block flex-none w-4 h-4 text-gray-600 absolute -right-2 top-1/2 -translate-y-1/2 z-10" />
              )}
            </motion.div>
          ))}
        </div>

        {/* comparison table */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.2 }}
          style={{ '--rc': '7, 137, 48' } as React.CSSProperties}
          className="zion-rainbow-card max-w-3xl mx-auto p-6 md:p-8 space-y-6"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-white flex items-center gap-2">
              <Rocket className="w-5 h-5 text-zion-gold" />
              CHv3 → CHv4 Upgrade
            </h3>
            <span className="text-xs text-gray-500 font-mono">spec comparison</span>
          </div>

          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-6 gap-y-3">
            <div className="text-xs uppercase tracking-widest text-gray-500">Metric</div>
            <div className="text-xs uppercase tracking-widest text-gray-500 text-right">CHv3</div>
            <div className="text-xs uppercase tracking-widest text-zion-cyan-400 text-right">CHv4</div>
            <div className="text-xs uppercase tracking-widest text-zion-gold text-right">Δ</div>

            {improvements.map((row) => (
              <>
                <div key={`lbl-${row.label}`} className="text-sm text-gray-300 py-2 border-t border-white/5">{row.label}</div>
                <div key={`bef-${row.label}`} className="text-sm text-gray-500 py-2 border-t border-white/5 text-right font-mono">{row.before}</div>
                <div key={`aft-${row.label}`} className="text-sm text-zion-cyan-300 py-2 border-t border-white/5 text-right font-mono">{row.after}</div>
                <div key={`pct-${row.label}`} className="text-sm text-zion-gold py-2 border-t border-white/5 text-right font-mono font-semibold">{row.pct}</div>
              </>
            ))}
          </div>

          <p className="text-xs text-gray-600">
            * Lower GPU speed is intentional — 4 MB scratchpad creates memory bandwidth bottleneck that advantages CPU nodes and
            increases decentralisation.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
