'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Apple } from 'lucide-react';
import { useGameStore } from '../store/gameStore';

/* Floating HUD widget showing fruit collection progress toward the next
   Tree Blessing. Sits in the bottom-left corner of the OASIS viewport. */
export default function FruitCounter() {
  const collectedFruits = useGameStore((s) => s.collectedFruits);
  const fruitThreshold = useGameStore((s) => s.fruitThreshold);
  const fruitBlessings = useGameStore((s) => s.fruitBlessings);

  const count = collectedFruits.length;
  const progress = Math.min(1, count / fruitThreshold);
  const isComplete = count >= fruitThreshold;

  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-30 select-none">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="zion-rainbow-card w-48 p-3"
        style={{ '--rc': '16, 185, 129' } as React.CSSProperties}
      >
        <div className="mb-1.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Apple className="h-3.5 w-3.5 text-emerald-400" />
            <span className="zion-kicker text-[9px] py-0.5 px-1.5">Fruit of the Tree</span>
          </div>
          {fruitBlessings > 0 && (
            <span className="zion-badge zion-badge-gold text-[8px] py-0.5 px-1.5">
              x{fruitBlessings}
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: isComplete
                ? 'linear-gradient(90deg, #fbbf24, #f59e0b, #fbbf24)'
                : 'linear-gradient(90deg, #10b981, #22d3ee)',
            }}
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        <div className="mt-1.5 flex items-center justify-between text-[10px]">
          <span className="text-gray-400">
            {count} / {fruitThreshold}
          </span>
          <AnimatePresence>
            {isComplete ? (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="font-semibold text-amber-400"
              >
                Blessing!
              </motion.span>
            ) : (
              <span className="text-gray-500">+50 XP each</span>
            )}
          </AnimatePresence>
        </div>

        <p className="mt-1 text-[9px] text-gray-500">
          Click glowing fruits on the Tree to collect
        </p>
      </motion.div>
    </div>
  );
}
