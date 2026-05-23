'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Sprout, Landmark, Crown, ArrowUpRight } from 'lucide-react';

const VISIONS = [
  {
    href: '/terranova/genesis',
    icon: Sprout,
    label: 'Zahrada Genesis',
    desc: 'Puvodni blockchainovy kod, prvni blok, seed vedomi — zahrada stvoreni',
    accent: 'text-cyan-300',
    border: 'border-cyan-400/20',
    bg: 'from-cyan-500/10 via-cyan-500/3 to-transparent',
    glow: 'shadow-[0_0_28px_rgba(6,182,212,0.10)]',
    iconBg: 'bg-cyan-500/12',
    iconBorder: 'border-cyan-400/25',
    ring: 'ring-cyan-400/15',
  },
  {
    href: '/terranova/dharma-temple',
    icon: Landmark,
    label: 'Dharma Temple',
    desc: 'Chram Dharmy — Ekam, Deeksha, Oneness, posvatna geometrie v kodu',
    accent: 'text-violet-300',
    border: 'border-violet-400/20',
    bg: 'from-violet-500/10 via-violet-500/3 to-transparent',
    glow: 'shadow-[0_0_28px_rgba(139,92,246,0.10)]',
    iconBg: 'bg-violet-500/12',
    iconBorder: 'border-violet-400/25',
    ring: 'ring-violet-400/15',
  },
  {
    href: '/terranova/te-piko-ora',
    icon: Crown,
    label: 'Te Piko Ora',
    desc: 'Koruna zivota — vrcholna komunitni vize, Rapa Nui, Guardian Edge',
    accent: 'text-amber-300',
    border: 'border-amber-400/20',
    bg: 'from-amber-500/10 via-amber-500/3 to-transparent',
    glow: 'shadow-[0_0_28px_rgba(245,158,11,0.10)]',
    iconBg: 'bg-amber-500/12',
    iconBorder: 'border-amber-400/25',
    ring: 'ring-amber-400/15',
  },
];

export default function VisionBar() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, delay: 0.3 }}
      className="w-full max-w-4xl mx-auto px-4"
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {VISIONS.map((v, i) => (
          <motion.div
            key={v.href}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 + i * 0.12 }}
          >
            <Link
              href={v.href}
              className={`group relative flex flex-col gap-3 rounded-2xl border ${v.border} ${v.glow} bg-gradient-to-br ${v.bg} p-5 backdrop-blur-sm transition-all duration-300 hover:scale-[1.04] hover:border-white/20 hover:shadow-[0_0_40px_rgba(255,255,255,0.06)]`}
            >
              <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${v.bg} opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />
              <div className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,255,255,0.04),transparent_60%)]" />

              <div className="relative flex items-center justify-between">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${v.iconBorder} ${v.iconBg} ring-1 ${v.ring} transition-transform duration-300 group-hover:scale-110`}>
                  <v.icon className={`h-5 w-5 ${v.accent}`} />
                </div>
                <ArrowUpRight className="h-4 w-4 text-gray-500 transition-all duration-300 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>

              <div className="relative">
                <span className={`text-sm font-bold ${v.accent} tracking-wide`}>{v.label}</span>
                <p className="mt-1.5 text-[11px] leading-relaxed text-gray-400 group-hover:text-gray-300 transition-colors duration-300">
                  {v.desc}
                </p>
              </div>

              <div className={`relative mt-1 h-px w-full bg-gradient-to-r from-transparent via-current to-transparent opacity-10 group-hover:opacity-25 transition-opacity duration-300 ${v.accent}`} />
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
