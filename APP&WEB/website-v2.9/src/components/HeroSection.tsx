'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TahitiFlower from './TahitiFlower';
import VisionBar from './VisionBar';
import StargateLogo from './StargateLogo';

export default function HeroSection() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="relative z-15 pt-32 sm:pt-36 md:pt-40 pb-2 flex flex-col items-center overflow-hidden">
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
            <div className="flex flex-col items-center pt-8 pb-10">
              <VisionBar />

              {/* Nadpis nad stargate */}
              <p className="mt-8 mb-8 text-sm font-bold uppercase tracking-[0.3em] text-zion-cyan/80">
                ZION Stargate — Portál do Oasis
              </p>

              {/* Stargate — podle předlohy /doge-vs-zion */}
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="w-full max-w-[360px]"
              >
                <StargateLogo className="w-full" />
              </motion.div>

              {/* Odkaz na Oasis pod stargate */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="mt-10 mb-12"
              >
                <a
                  href="/l4-oasis"
                  className="group inline-flex items-center gap-2 rounded-full border border-zion-cyan/30 bg-zion-cyan/5 px-5 py-2 text-sm font-bold text-zion-cyan transition-all hover:border-zion-cyan/60 hover:bg-zion-cyan/10 hover:shadow-[0_8px_30px_rgba(111,255,240,0.2)]"
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
