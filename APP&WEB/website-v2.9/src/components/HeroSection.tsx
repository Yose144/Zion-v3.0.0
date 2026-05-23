'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TahitiFlower from './TahitiFlower';
import VisionBar from './VisionBar';
import StargateGate from './StargateGate';

export default function HeroSection() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="relative z-20 pt-28 pb-2 flex flex-col items-center">
      <TahitiFlower
        className="mb-1"
        expanded={expanded}
        onToggle={() => setExpanded((e) => !e)}
      />

      <AnimatePresence>
        {expanded && (
          <motion.div
            key="hero-panel"
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -10 }}
            transition={{ duration: 0.7, ease: 'easeInOut' }}
            className="w-full overflow-hidden"
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
