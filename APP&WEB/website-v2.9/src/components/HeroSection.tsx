'use client';

import { motion } from 'framer-motion';

export default function HeroSection() {
  return (
    <div className="relative z-15 pt-20 sm:pt-24 md:pt-28 pb-2 flex flex-col items-center overflow-hidden">
      {/* Placeholder for spacing previously used by the Tahiti flower */}
      <div className="h-12 sm:h-14 md:h-16" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="flex flex-col items-center pt-3 sm:pt-6 pb-5 sm:pb-8"
      >
        <p className="mb-3 sm:mb-6 text-[10px] sm:text-xs font-bold uppercase tracking-[0.25em] sm:tracking-[0.3em] text-zion-cyan/80 text-center px-4">
          ZION Stargate — Portál do Oasis
        </p>

        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="w-full px-4 max-w-[160px] sm:max-w-[220px] md:max-w-[300px]"
        >
          <div className="aspect-square w-full rounded-full border border-zion-cyan/20 bg-black/60" />
        </motion.div>
      </motion.div>
    </div>
  );
}
