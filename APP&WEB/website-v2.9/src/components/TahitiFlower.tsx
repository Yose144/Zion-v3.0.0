'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* Holographic Tiare Tahiti (Gardenia taitensis) — national flower of French Polynesia */

function Petal({ angle, scale = 1 }: { angle: number; scale?: number }) {
  const rad = (angle * Math.PI) / 180;
  const cx = Math.cos(rad) * 34 * scale;
  const cy = Math.sin(rad) * 34 * scale;
  return (
    <ellipse
      cx={cx}
      cy={cy}
      rx={10 * scale}
      ry={24 * scale}
      transform={`rotate(${angle + 90}, ${cx}, ${cy})`}
      fill="url(#petalGrad)"
      opacity={0.65}
    />
  );
}

export default function TahitiFlower({ className = '' }: { className?: string }) {
  const [hovered, setHovered] = useState(false);
  const [clicked, setClicked] = useState(false);
  const petals = Array.from({ length: 7 }, (_, i) => i);

  return (
    <motion.div
      className={`flex flex-col items-center select-none ${className}`}
      aria-hidden
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, ease: 'easeOut', delay: 0.6 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setClicked(false); }}
      onClick={() => setClicked((c) => !c)}
    >
      {/* flower */}
      <motion.div
        animate={{
          scale: hovered ? 1.12 : clicked ? 0.95 : 1,
          rotate: hovered ? [0, -3, 3, 0] : 0,
        }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="cursor-pointer"
      >
        <svg
          viewBox="-60 -60 120 120"
          xmlns="http://www.w3.org/2000/svg"
          className="h-20 w-20 sm:h-24 sm:w-24"
          style={{ filter: 'drop-shadow(0 0 14px rgba(103,243,223,0.45))' }}
        >
          <defs>
            <radialGradient id="petalGrad" cx="50%" cy="20%" r="80%">
              <stop offset="0%" stopColor="rgba(165,243,252,0.9)" />
              <stop offset="50%" stopColor="rgba(103,243,223,0.6)" />
              <stop offset="100%" stopColor="rgba(147,51,234,0.3)" />
            </radialGradient>
            <radialGradient id="centerGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(255,235,160,0.95)" />
              <stop offset="100%" stopColor="rgba(249,168,38,0.5)" />
            </radialGradient>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <g filter="url(#glow)">
            {petals.map((i) => (
              <Petal key={i} angle={(i * 360) / 7} scale={1} />
            ))}
            {petals.map((i) => (
              <Petal key={`inner-${i}`} angle={(i * 360) / 7 + 360 / 14} scale={0.55} />
            ))}
            <circle r={9} fill="url(#centerGrad)" opacity={0.8} />
          </g>

          <ellipse cx={-28} cy={18} rx={18} ry={8} transform="rotate(-35, -28, 18)" fill="rgba(6,182,212,0.25)" opacity={0.5} />
          <ellipse cx={28} cy={20} rx={16} ry={7} transform="rotate(35, 28, 20)" fill="rgba(147,51,234,0.25)" opacity={0.45} />
        </svg>
      </motion.div>

      {/* greeting label */}
      <AnimatePresence>
        <motion.div
          key="greeting"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.8 }}
          className="mt-1.5 flex flex-col items-center"
        >
          <span className="text-[10px] font-medium uppercase tracking-[0.35em] text-cyan-200/60">
            Maeva
          </span>
          <span className="mt-0.5 text-[11px] text-amber-200/70">
            Vítejte v ráji
          </span>
        </motion.div>
      </AnimatePresence>

      {/* hover tooltip */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="absolute -bottom-16 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-xl border border-white/10 bg-black/80 px-3 py-2 backdrop-blur-md z-40"
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
