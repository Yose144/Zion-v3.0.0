'use client';

import { motion } from 'framer-motion';

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
  const petals = Array.from({ length: 7 }, (_, i) => i);
  return (
    <motion.div
      className={`pointer-events-none select-none ${className}`}
      aria-hidden
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1.2, ease: 'easeOut' }}
    >
      <motion.div
        animate={{ scale: [1, 1.03, 1], opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      >
        <svg
          viewBox="-60 -60 120 120"
          xmlns="http://www.w3.org/2000/svg"
          className="h-28 w-28 sm:h-36 sm:w-36"
          style={{ filter: 'drop-shadow(0 0 12px rgba(103,243,223,0.35))' }}
        >
          <defs>
            <radialGradient id="petalGrad" cx="50%" cy="20%" r="80%">
              <stop offset="0%" stopColor="rgba(165,243,252,0.85)" />
              <stop offset="50%" stopColor="rgba(103,243,223,0.55)" />
              <stop offset="100%" stopColor="rgba(147,51,234,0.25)" />
            </radialGradient>
            <radialGradient id="centerGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(255,235,160,0.9)" />
              <stop offset="100%" stopColor="rgba(249,168,38,0.4)" />
            </radialGradient>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Outer ring of petals */}
          <g filter="url(#glow)">
            {petals.map((i) => (
              <Petal key={i} angle={(i * 360) / 7} scale={1} />
            ))}
            {/* Inner ring offset */}
            {petals.map((i) => (
              <Petal key={`inner-${i}`} angle={(i * 360) / 7 + 360 / 14} scale={0.55} />
            ))}
            {/* Center bud */}
            <circle r={9} fill="url(#centerGrad)" opacity={0.75} />
          </g>

          {/* Subtle leaf */}
          <ellipse
            cx={-28}
            cy={18}
            rx={18}
            ry={8}
            transform="rotate(-35, -28, 18)"
            fill="rgba(6,182,212,0.2)"
            opacity={0.5}
          />
          <ellipse
            cx={28}
            cy={20}
            rx={16}
            ry={7}
            transform="rotate(35, 28, 20)"
            fill="rgba(147,51,234,0.2)"
            opacity={0.45}
          />
        </svg>
      </motion.div>
    </motion.div>
  );
}
