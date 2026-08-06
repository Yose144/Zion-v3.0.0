'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Sprout, Landmark, Crown, Flower2, ArrowUpRight } from 'lucide-react';

const VISIONS = [
  {
    href: '/l4-oasis',
    icon: Flower2,
    label: 'Oasis',
    desc: 'Portal do L4 Oasis — vědomí, Ekam a Deeksha v bezpečném prostoru.',
    rc: '252, 209, 22', // orange
    accent: 'text-zion-gold-300',
  },
  {
    href: '/terranova/genesis',
    icon: Sprout,
    label: 'Zahrada Genesis',
    desc: 'Původní blockchainový kód, první blok, seed vědomí.',
    rc: '7, 137, 48', // cyan
    accent: 'text-zion-cyan-300',
  },
  {
    href: '/terranova/dharma-temple',
    icon: Landmark,
    label: 'Dharma Temple',
    desc: 'Chrám Dharmy — Ekam, Deeksha, Oneness, posvátná geometrie v kódu.',
    rc: '228, 30, 43', // violet
    accent: 'text-zion-purple-300',
  },
  {
    href: '/terranova/te-piko-ora',
    icon: Crown,
    label: 'Te Piko Ora',
    desc: 'Koruna života — vrcholná komunitní vize, Rapa Nui, Guardian Edge.',
    rc: '252, 209, 22', // amber
    accent: 'text-zion-gold-300',
  },
];

export default function VisionBar() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, delay: 0.3 }}
      className="w-full max-w-5xl mx-auto px-3 sm:px-4"
    >
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
        {VISIONS.map((v, i) => (
          <motion.div
            key={v.href}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 + i * 0.12 }}
          >
            <Link
              href={v.href}
              className="zion-rainbow-card group flex flex-col gap-2 sm:gap-3 p-3 sm:p-4"
              style={{ '--rc': v.rc } as React.CSSProperties}
            >
              <div className="relative flex items-center justify-between">
                <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 transition-transform duration-300 group-hover:scale-110">
                  <v.icon className={`h-4 w-4 ${v.accent}`} />
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 text-gray-500 transition-all duration-300 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>

              <div className="relative min-w-0">
                <span className={`text-xs sm:text-sm font-bold ${v.accent} tracking-wide`}>{v.label}</span>
                <p className="mt-0.5 text-[10px] sm:text-[11px] leading-snug text-gray-400 group-hover:text-gray-300 transition-colors duration-300 line-clamp-2">
                  {v.desc}
                </p>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
