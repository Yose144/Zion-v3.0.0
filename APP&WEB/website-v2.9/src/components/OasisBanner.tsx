'use client';

import { motion } from 'framer-motion';
import { Leaf, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function OasisBanner() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, delay: 2.2 }}
      className="w-full max-w-4xl mx-auto px-4 mt-4"
    >
      <a
        href="https://oasis.zionterranova.com"
        target="_blank"
        rel="noopener noreferrer"
        className="zion-rainbow-card group relative flex flex-col sm:flex-row items-center gap-4 sm:gap-6 p-6 sm:p-8 transition-all duration-500"
        style={{ '--rc': '7, 137, 48' } as React.CSSProperties}
      >
        {/* animated glow orb */}
        <div className="absolute top-1/2 left-8 -translate-y-1/2 w-24 h-24 rounded-full bg-zion-cyan-500/10 blur-2xl opacity-60 group-hover:opacity-100 group-hover:scale-125 transition-all duration-700" />

        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-zion-cyan-400/25 bg-zion-cyan-500/10 ring-1 ring-zion-cyan-400/15 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3">
          <Leaf className="h-8 w-8 text-zion-cyan-300" />
        </div>

        <div className="relative flex-1 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-zion-cyan-400/20 bg-zion-cyan-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zion-cyan-300">
              <Loader2 className="h-3 w-3 animate-spin" />
              V přípravě
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            ZION Oasis
          </h3>
          <p className="mt-1 text-sm text-gray-400 group-hover:text-gray-300 transition-colors duration-300 max-w-lg">
            UE5 Metaverse, on-chain inventory, guild DAO, XP ekonomika. Příprava herní vrstvy ZION pro spuštění v roce 2027.
          </p>
        </div>

        <div className="relative shrink-0 flex flex-col items-center gap-1">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 transition-all duration-300 group-hover:bg-zion-cyan-500/15 group-hover:border-zion-cyan-400/30">
            <span className="text-lg font-bold text-zion-cyan-300">Q1</span>
          </div>
          <span className="text-[10px] uppercase tracking-wider text-gray-500">2027</span>
        </div>
      </a>
    </motion.div>
  );
}
