'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import TahitiFlower from './TahitiFlower';
import VisionBar from './VisionBar';

const StargateLogo = dynamic(() => import('./StargateLogo'), {
  ssr: false,
  loading: () => (
    <div className="aspect-square w-full rounded-full border border-zion-cyan/20 bg-black/60" />
  ),
});

export default function AlohaOverlay() {
  const [expanded, setExpanded] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  /* Hide Aloha flower while the nav shrinks into a thin bar */
  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 60);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      {/* Aloha trigger — sits above the navigation bar, hides on scroll */}
      <div className={`fixed top-1 left-0 right-0 z-[60] flex justify-center pointer-events-none transition-all duration-300 ${scrolled ? '-translate-y-full opacity-0' : 'translate-y-0 opacity-100'}`}>
        <div className="pointer-events-auto scale-[0.55] sm:scale-[0.65] md:scale-75 origin-top">
          <TahitiFlower expanded={expanded} onToggle={() => setExpanded((v) => !v)} />
        </div>
      </div>

      {/* Fullscreen overlay — slides down from the top */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ y: '-100%' }}
            animate={{ y: 0 }}
            exit={{ y: '-100%' }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="fixed inset-0 z-[55] bg-black/95 backdrop-blur-2xl overflow-y-auto"
          >
            {/* Close zone at the top so users can click to dismiss */}
            <button
              onClick={() => setExpanded(false)}
              className="absolute top-0 left-0 right-0 h-24 cursor-pointer"
              aria-label="Close Aloha portal"
            />

            <div className="min-h-screen flex flex-col items-center justify-center px-4 py-24">
              <VisionBar />

              <p className="mt-8 mb-5 text-xs sm:text-sm font-bold uppercase tracking-[0.3em] text-zion-cyan/80 text-center">
                ZION Stargate — Portál do Oasis
              </p>

              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.15 }}
                className="w-full max-w-[160px] sm:max-w-[220px] md:max-w-[300px]"
              >
                <StargateLogo className="w-full" />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-8"
              >
                <a
                  href="https://oasis.zionterranova.com"
                  className="zion-rainbow-card group inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-cyan-300"
                  style={{ '--rc': '6, 182, 212' } as React.CSSProperties}
                >
                  Vstoupit do Oasis
                  <span className="transition-transform group-hover:translate-x-1">→</span>
                </a>
              </motion.div>

              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                onClick={() => setExpanded(false)}
                className="mt-12 text-xs text-gray-500 hover:text-white transition-colors uppercase tracking-widest"
              >
                Zavřít portál
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
