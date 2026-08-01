'use client';

import { motion, AnimatePresence } from 'framer-motion';

interface WarpFlashProps {
  active: boolean;
}

export default function WarpFlash({ active }: WarpFlashProps) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="warp-flash"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="pointer-events-none fixed inset-0 z-[60]"
          style={{
            background:
              'radial-gradient(circle at center, rgba(255,250,230,0.95) 0%, rgba(245,158,11,0.35) 30%, rgba(168,85,247,0.15) 60%, transparent 100%)',
          }}
        />
      )}
    </AnimatePresence>
  );
}
