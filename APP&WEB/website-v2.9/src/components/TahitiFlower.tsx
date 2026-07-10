'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

/* Real Tiare Tahiti (Gardenia taitensis) — national flower of French Polynesia */

export default function TahitiFlower({
  className = '',
  expanded = false,
  onToggle,
}: {
  className?: string;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      className={`flex flex-col items-center select-none cursor-pointer ${className}`}
      aria-hidden
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, ease: 'easeOut', delay: 0.6 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        onToggle?.();
      }}
    >
      {/* Real flower photo with glow */}
      <motion.div
        animate={{
          scale: hovered ? 1.08 : expanded ? 0.92 : 1,
          rotate: hovered ? [0, -2, 2, 0] : 0,
        }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="cursor-pointer relative"
        style={{ filter: 'drop-shadow(0 0 18px rgba(103,243,223,0.5))' }}
      >
        <Image
          src="/tiare-tahiti.jpg"
          alt="Tiare Tahiti — květina Francouzské Polynésie"
          width={96}
          height={96}
          className="h-16 w-16 sm:h-20 sm:w-20 md:h-24 md:w-24 rounded-full object-cover border-2 border-cyan-200/30"
          priority
        />
      </motion.div>

      {/* Label */}
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 0.8 }}
        className="mt-2 flex flex-col items-center"
      >
        <span className="font-mono text-sm font-light uppercase tracking-[0.42em] text-cyan-200/65">
          Aloha
        </span>
        <span className="mt-0.5 text-[9px] text-gray-500 tracking-wider">
          {expanded ? 'Klikni pro zavreni' : 'Klikni pro otevreni portalu'}
        </span>
      </motion.div>

      {/* hover tooltip */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="absolute -bottom-16 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-xl border border-white/10 bg-black/80 px-3 py-2 backdrop-blur-md z-40 max-w-[90vw] overflow-hidden"
          >
            <p className="text-[10px] font-semibold text-cyan-200 tracking-wide">
              Tiare Tahiti — květina Francouzské Polynésie
            </p>
            <p className="text-[9px] text-gray-400 mt-0.5">
              Symbol čistoty, krásy a ráje
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
