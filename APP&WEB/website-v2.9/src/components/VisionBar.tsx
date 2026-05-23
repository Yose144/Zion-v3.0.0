'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Leaf, Sprout, Landmark, Crown } from 'lucide-react';

const VISIONS = [
  {
    href: '/l5-free-world',
    icon: Leaf,
    label: 'L5 Free World',
    desc: 'Komunitní vrstva — Terra Nova off-grid, autonomní zóny, P2P ekonomika',
    accent: 'text-emerald-300',
    border: 'border-emerald-500/20',
    bg: 'from-emerald-500/8 via-transparent',
    glow: 'shadow-[0_0_24px_rgba(16,185,129,0.08)]',
  },
  {
    href: '/genesis',
    icon: Sprout,
    label: 'Genesis',
    desc: 'Zahrada stvoření — původní blockchainový kód, první blok, seed vědomí',
    accent: 'text-cyan-300',
    border: 'border-cyan-500/20',
    bg: 'from-cyan-500/8 via-transparent',
    glow: 'shadow-[0_0_24px_rgba(6,182,212,0.08)]',
  },
  {
    href: '/terranova/dharma-temple',
    icon: Landmark,
    label: 'Dharma Temple',
    desc: 'Chrám Dharmy — Ekam, Deeksha, Oneness, posvátná geometrie v kódu',
    accent: 'text-violet-300',
    border: 'border-violet-500/20',
    bg: 'from-violet-500/8 via-transparent',
    glow: 'shadow-[0_0_24px_rgba(139,92,246,0.08)]',
  },
  {
    href: '/terranova/te-piko-ora',
    icon: Crown,
    label: 'Te Pīko Ora',
    desc: 'Koruna života — vrcholná komunitní vize, Rapa Nui, Guardian Edge',
    accent: 'text-amber-300',
    border: 'border-amber-500/20',
    bg: 'from-amber-500/8 via-transparent',
    glow: 'shadow-[0_0_24px_rgba(245,158,11,0.08)]',
  },
];

export default function VisionBar() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, delay: 1.4 }}
      className="w-full max-w-4xl mx-auto"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 px-4">
        {VISIONS.map((v, i) => (
          <motion.div
            key={v.href}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 1.6 + i * 0.1 }}
          >
            <Link
              href={v.href}
              className={`group flex flex-col gap-2 rounded-2xl border ${v.border} ${v.glow} bg-gradient-to-br ${v.bg} to-transparent p-4 backdrop-blur-sm transition-all hover:scale-[1.03] hover:bg-white/5`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5`}>
                  <v.icon className={`h-4 w-4 ${v.accent}`} />
                </div>
                <span className={`text-sm font-bold ${v.accent}`}>{v.label}</span>
              </div>
              <p className="text-[11px] leading-relaxed text-gray-400 group-hover:text-gray-300 transition-colors">
                {v.desc}
              </p>
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
