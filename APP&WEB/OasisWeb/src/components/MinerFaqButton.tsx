'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Pickaxe } from 'lucide-react';

export default function MinerFaqButton() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.8, duration: 0.5 }}
      className="pointer-events-auto fixed bottom-4 left-4 z-40 sm:bottom-6 sm:left-6"
    >
      <Link
        href="/miner"
        aria-label="Open the public miner page"
        className="group flex items-center gap-2 rounded-full border border-white/10 bg-[#0d0d0d]/85 px-3 py-2 text-sm font-bold text-white shadow-2xl backdrop-blur-xl transition hover:border-oasis-cyan/30 hover:bg-oasis-cyan/10 sm:px-4 sm:py-2.5"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-oasis-cyan/20 sm:h-8 sm:w-8">
          <Pickaxe className="h-3.5 w-3.5 text-oasis-cyan sm:h-4 sm:w-4" />
        </span>
        <span className="hidden sm:inline">Miner</span>
      </Link>
    </motion.div>
  );
}
