'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';

interface DogeVsZionBannerProps {
  cs?: boolean;
}

// Inline SVG Dogecoin logo
function DogecoinLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="dogeGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F2C94C" />
          <stop offset="100%" stopColor="#E4A31B" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="46" fill="url(#dogeGold)" stroke="#C68E00" strokeWidth="2.5" />
      <path
        d="M31.5 35.5h22.5c12.5 0 19.5 8.5 19.5 18.5 0 10.5-7.5 18-19 18H37.5v-12.5H50c5.5 0 8.5-3.5 8.5-7.5 0-4.5-3.5-7.5-8.5-7.5H37.5v31.5H31.5V35.5z"
        fill="#C68E00"
      />
      <path
        d="M34.5 38.5h19.5c10.5 0 16.5 7 16.5 15.5 0 9-6.5 15.5-16 15.5H40.5v-9.5H52c6.5 0 10-4 10-8.5 0-5.5-4-8.5-10-8.5H40.5v25.5H34.5V38.5z"
        fill="#FEF5D6"
      />
    </svg>
  );
}

export default function DogeVsZionBanner({ cs = true }: DogeVsZionBannerProps) {
  const [active, setActive] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setActive((a) => !a)}
      className="group relative w-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-amber-500/10 via-black/40 to-zion-cyan/5 p-5 text-left transition-all hover:border-amber-400/30 hover:shadow-[0_20px_60px_rgba(245,158,11,0.18)] focus:outline-none focus:ring-2 focus:ring-amber-400/30"
      aria-label={cs ? 'Doge vs ZION interaktivní banner' : 'Doge vs ZION interactive banner'}
    >
      {/* Starfield background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 16 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: `${1 + (i % 2)}px`,
              height: `${1 + (i % 2)}px`,
              top: `${(i * 13.7) % 100}%`,
              left: `${(i * 23.1) % 100}%`,
            }}
            animate={{ opacity: [0.15, 0.55, 0.15], scale: [1, 1.4, 1] }}
            transition={{ duration: 2.5 + (i % 3), repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>

      {/* Top row: stats chips */}
      <div className="relative z-10 mb-5 flex flex-wrap items-center justify-center gap-2">
        <span className="rounded-full border border-amber-400/20 bg-black/40 px-3 py-1 text-[10px] font-bold text-amber-300 backdrop-blur-sm">
          🐕 Doge = 1 sig
        </span>
        <span className="rounded-full border border-emerald-400/20 bg-black/40 px-3 py-1 text-[10px] font-bold text-emerald-300 backdrop-blur-sm">
          🛡️ ZION = 5/5 sigs
        </span>
        <span className="rounded-full border border-zion-gold/20 bg-black/40 px-3 py-1 text-[10px] font-bold text-zion-gold backdrop-blur-sm">
          💰 $0.00002
        </span>
        <span className="rounded-full border border-cyan-400/20 bg-black/40 px-3 py-1 text-[10px] font-bold text-cyan-300 backdrop-blur-sm">
          🔒 100M ZION
        </span>
      </div>

      {/* Main row: Doge vs ZION */}
      <div className="relative z-10 flex items-center justify-center gap-3 md:gap-6">
        {/* Doge side */}
        <div className="flex flex-col items-center gap-2">
          <motion.div
            animate={active ? { rotate: [0, -8, 8, 0], scale: [1, 1.08, 1] } : { rotate: [0, -2, 2, 0], scale: 1 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="relative"
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-amber-400/30 bg-gradient-to-br from-amber-500/20 to-amber-700/20 shadow-[0_12px_40px_rgba(245,158,11,0.25)] transition-shadow group-hover:shadow-[0_18px_60px_rgba(245,158,11,0.4)] md:h-24 md:w-24">
              <DogecoinLogo className="h-14 w-14 md:h-16 md:w-16" />
            </div>
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-black/70 px-2 py-0.5 text-[8px] font-bold text-amber-300">
              DOGE
            </span>
          </motion.div>
          <p className="text-[10px] text-white/50">{cs ? '1 podpis' : '1 signature'}</p>
        </div>

        {/* Center bridge / VS */}
        <div className="relative flex flex-col items-center px-2 md:px-4">
          <motion.div
            className="mb-1 h-1 w-24 rounded-full bg-gradient-to-r from-amber-400/60 via-white/40 to-emerald-400/60 md:w-32"
            animate={active ? { opacity: [0.5, 1, 0.5], scaleX: [1, 1.08, 1] } : { opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <div className="rounded-full border border-white/10 bg-black/50 px-2.5 py-0.5 text-[10px] font-bold text-white/80 backdrop-blur-sm">
            VS
          </div>
          <motion.div
            className="mt-1 h-1 w-24 rounded-full bg-gradient-to-r from-amber-400/60 via-white/40 to-emerald-400/60 md:w-32"
            animate={active ? { opacity: [0.5, 1, 0.5], scaleX: [1, 1.08, 1] } : { opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
          />
        </div>

        {/* ZION side */}
        <div className="flex flex-col items-center gap-2">
          <motion.div
            animate={active ? { rotate: [0, 8, -8, 0], scale: [1, 1.08, 1] } : { rotate: [0, 2, -2, 0], scale: 1 }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
            className="relative"
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-emerald-400/30 bg-gradient-to-br from-emerald-500/20 to-zion-cyan/20 text-4xl shadow-[0_12px_40px_rgba(16,185,129,0.25)] transition-shadow group-hover:shadow-[0_18px_60px_rgba(16,185,129,0.4)] md:h-24 md:w-24">
              🚀
            </div>
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-black/70 px-2 py-0.5 text-[8px] font-bold text-emerald-300">
              ZION
            </span>
          </motion.div>
          <p className="text-[10px] text-white/50">{cs ? '5/5 multisig' : '5/5 multisig'}</p>
        </div>
      </div>

      {/* Bottom catchphrase */}
      <div className="relative z-10 mt-5 text-center">
        <p className="text-sm font-bold text-white md:text-base">
          {cs ? 'To the moon? Ne. To the stars.' : 'To the moon? No. To the stars.'}
        </p>
        <p className="mt-1 text-[10px] text-white/40">
          {cs ? 'Klikni pro raketový boost' : 'Click for rocket boost'}
        </p>
      </div>

      {/* Rocket particles on click */}
      {active && (
        <>
          {Array.from({ length: 10 }).map((_, i) => (
            <motion.div
              key={i}
              className="pointer-events-none absolute text-sm"
              initial={{ opacity: 1, x: '70%', y: '55%', scale: 0.6 }}
              animate={{
                opacity: 0,
                x: `${20 + i * 7}%`,
                y: `${20 + (i % 4) * 18}%`,
                scale: 1.3,
              }}
              transition={{ duration: 1 + i * 0.08, ease: 'easeOut' }}
            >
              {['✨', '🌟', '💫', '⚡', '🔥', '🌙', '🪐', '⭐', '🚀', '🌠'][i]}
            </motion.div>
          ))}
        </>
      )}
    </button>
  );
}
