'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import TahitiFlower from './TahitiFlower';
import VisionBar from './VisionBar';

const StargateLogo = dynamic(() => import('./StargateLogo'), {
  ssr: false,
  loading: () => (
    <div className="aspect-square w-full rounded-full border border-zion-cyan/20 bg-black/60" />
  ),
});

export default function HeroSection() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="relative z-15 pt-24 sm:pt-28 md:pt-32 pb-2 flex flex-col items-center overflow-hidden">
      <TahitiFlower
        className="mb-1"
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
      />

      <AnimatePresence mode="wait">
        {expanded && (
          <motion.div
            key="hero-panel"
            initial={{ opacity: 0, scale: 0.92, y: -16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: -16 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="w-full"
          >
            <div className="flex flex-col items-center pt-4 sm:pt-8 pb-6 sm:pb-10">
              <VisionBar />

              {/* Nadpis nad stargate */}
              <p className="mt-6 sm:mt-8 mb-4 sm:mb-8 text-xs sm:text-sm font-bold uppercase tracking-[0.25em] sm:tracking-[0.3em] text-zion-cyan/80 text-center px-4">
                ZION Stargate — Portál do Oasis
              </p>

              {/* Stargate — podle předlohy /doge-vs-zion */}
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="w-full px-4 max-w-[240px] sm:max-w-[300px] md:max-w-[360px]"
              >
                <StargateLogo className="w-full" />
              </motion.div>

              {/* Odkaz na Oasis pod stargate */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="mt-6 sm:mt-10 mb-8 sm:mb-12"
              >
                <a
                  href="/l4-oasis"
                  className="group inline-flex items-center gap-2 rounded-full border border-zion-cyan/30 bg-zion-cyan/5 px-4 sm:px-5 py-2 text-xs sm:text-sm font-bold text-zion-cyan transition-all hover:border-zion-cyan/60 hover:bg-zion-cyan/10 hover:shadow-[0_8px_30px_rgba(111,255,240,0.2)]"
                >
                  Vstoupit do Oasis
                  <span className="transition-transform group-hover:translate-x-1">→</span>
                </a>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
