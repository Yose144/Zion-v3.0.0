'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';

interface WarpFlashProps {
  active: boolean;
  worldName?: string;
}

/**
 * Enhanced warp flash with tunnel streaks and world name reveal.
 * Layered radial gradient + animated streak lines + world name display.
 */
export default function WarpFlash({ active, worldName }: WarpFlashProps) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="warp-flash"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="pointer-events-none fixed inset-0 z-[60] overflow-hidden"
        >
          {/* Layer 1: Radial gradient flash */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at center, rgba(255,250,230,0.95) 0%, rgba(245,158,11,0.35) 30%, rgba(168,85,247,0.15) 60%, transparent 100%)',
            }}
          />

          {/* Layer 2: Warp tunnel streaks — radiating from center */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative h-full w-full">
              {Array.from({ length: 24 }).map((_, i) => {
                const angle = (i / 24) * 360;
                return (
                  <motion.div
                    key={i}
                    className="absolute left-1/2 top-1/2 origin-left"
                    style={{
                      width: '60vw',
                      height: '2px',
                      background: `linear-gradient(to right, transparent, ${
                        i % 3 === 0 ? 'rgba(255,215,0,0.8)' : i % 3 === 1 ? 'rgba(6,182,212,0.7)' : 'rgba(168,85,247,0.6)'
                      }, transparent)`,
                      transform: `rotate(${angle}deg)`,
                    }}
                    initial={{ scaleX: 0, opacity: 0 }}
                    animate={{ scaleX: [0, 1, 0.3], opacity: [0, 1, 0] }}
                    transition={{ duration: 0.8, delay: i * 0.015, ease: 'easeOut' }}
                  />
                );
              })}
            </div>
          </div>

          {/* Layer 3: Expanding ring */}
          <motion.div
            className="absolute left-1/2 top-1/2 rounded-full border-2 border-oasis-gold/60"
            style={{ translateX: '-50%', translateY: '-50%' }}
            initial={{ width: 0, height: 0, opacity: 0.8 }}
            animate={{ width: ['0px', '120vw'], height: ['0px', '120vw'], opacity: [0.8, 0] }}
            transition={{ duration: 1.0, ease: 'easeOut' }}
          />

          {/* Layer 4: World name reveal */}
          {worldName && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: [0, 1, 1, 0], scale: [0.8, 1.05, 1, 1.1] }}
              transition={{ duration: 1.5, times: [0, 0.3, 0.7, 1], ease: 'easeOut' }}
            >
              <div className="text-center">
                <motion.div
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="mb-2 flex items-center justify-center gap-2"
                >
                  <Sparkles className="h-4 w-4 text-oasis-gold" />
                  <span className="text-xs font-bold uppercase tracking-[0.3em] text-oasis-gold/80">
                    Entering
                  </span>
                  <Sparkles className="h-4 w-4 text-oasis-gold" />
                </motion.div>
                <h2
                  className="text-4xl font-bold text-white sm:text-5xl"
                  style={{ textShadow: '0 0 30px rgba(255,215,0,0.6), 0 0 60px rgba(168,85,247,0.4)' }}
                >
                  {worldName}
                </h2>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
