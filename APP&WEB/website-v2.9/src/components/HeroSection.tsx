'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TahitiFlower from './TahitiFlower';
import VisionBar from './VisionBar';
import StargateGate from './StargateGate';

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
            <div className="flex flex-col items-center gap-5 pt-5 pb-2">
              <VisionBar />
              <StargateGate />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
