'use client';

import { motion } from 'framer-motion';

interface StargatePortalProps {
  size?: number;
  className?: string;
  active?: boolean;
}

export default function StargatePortal({ size = 80, className = '', active = false }: StargatePortalProps) {
  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      {/* Outer glow */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-zion-purple/30 via-zion-cyan/20 to-zion-gold/20 blur-2xl" />

      {/* Rotating outer ring with chevrons */}
      <motion.svg
        viewBox="0 0 100 100"
        className="absolute inset-0"
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
      >
        <defs>
          <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="50%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
        {/* Main ring */}
        <circle cx="50" cy="50" r="42" fill="none" stroke="url(#ringGradient)" strokeWidth="2" opacity="0.8" />
        <circle cx="50" cy="50" r="36" fill="none" stroke="#ffffff" strokeWidth="0.5" opacity="0.3" />

        {/* Chevrons / glyphs */}
        {Array.from({ length: 9 }).map((_, i) => {
          const angle = (i * 40 * Math.PI) / 180;
          const x1 = 50 + 38 * Math.cos(angle);
          const y1 = 50 + 38 * Math.sin(angle);
          const x2 = 50 + 46 * Math.cos(angle);
          const y2 = 50 + 46 * Math.sin(angle);
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#f59e0b"
              strokeWidth="2"
              strokeLinecap="round"
            />
          );
        })}
      </motion.svg>

      {/* Counter-rotating inner ring */}
      <motion.svg
        viewBox="0 0 100 100"
        className="absolute inset-0"
        animate={{ rotate: -360 }}
        transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
      >
        <circle cx="50" cy="50" r="28" fill="none" stroke="#06b6d4" strokeWidth="1" opacity="0.5" strokeDasharray="4 4" />
      </motion.svg>

      {/* Pulsing core */}
      <motion.div
        className="absolute inset-0 m-auto rounded-full bg-gradient-to-br from-white/20 to-zion-cyan/10"
        style={{ width: size * 0.5, height: size * 0.5 }}
        animate={active ? { scale: [1, 1.2, 1], opacity: [0.6, 1, 0.6] } : { scale: [1, 1.05, 1], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Center star */}
      <motion.div
        className="absolute inset-0 m-auto flex items-center justify-center"
        style={{ width: size * 0.3, height: size * 0.3 }}
        animate={{ rotate: [0, 180, 360] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
      >
        <svg viewBox="0 0 24 24" className="h-full w-full text-zion-gold drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]">
          <path fill="currentColor" d="M12 2l2.4 7.2h7.6l-6 4.8 2.4 7.2-6-4.8-6 4.8 2.4-7.2-6-4.8h7.6z" />
        </svg>
      </motion.div>
    </div>
  );
}
