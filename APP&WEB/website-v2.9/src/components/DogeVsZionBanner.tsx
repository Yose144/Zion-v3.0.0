'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';

interface DogeVsZionBannerProps {
  cs?: boolean;
}

export default function DogeVsZionBanner({ cs = true }: DogeVsZionBannerProps) {
  const [active, setActive] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setActive((a) => !a)}
      className="group relative w-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-amber-500/8 via-purple-500/5 to-transparent p-5 text-left transition-all hover:border-amber-400/30 hover:shadow-[0_20px_60px_rgba(245,158,11,0.15)] focus:outline-none focus:ring-2 focus:ring-amber-400/30"
      aria-label={cs ? 'Doge vs ZION interaktivní banner' : 'Doge vs ZION interactive banner'}
    >
      {/* Animated star field background */}
      <div className="pointer-events-none absolute inset-0">
        {Array.from({ length: 14 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-white/60"
            style={{
              width: `${1 + (i % 2)}px`,
              height: `${1 + (i % 2)}px`,
              top: `${(i * 17) % 100}%`,
              left: `${(i * 29) % 100}%`,
            }}
            animate={{
              opacity: [0.2, 0.8, 0.2],
              scale: [1, 1.3, 1],
            }}
            transition={{
              duration: 2 + (i % 3),
              repeat: Infinity,
              delay: i * 0.2,
            }}
          />
        ))}
      </div>

      {/* Bridge beam */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-60">
        <motion.div
          className="h-px w-3/5 bg-gradient-to-r from-transparent via-amber-400/60 to-transparent"
          animate={active ? { opacity: [0.4, 1, 0.4], scaleX: [1, 1.05, 1] } : { opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </div>

      {/* Floating stat badges */}
      <motion.div
        className="pointer-events-none absolute left-[18%] top-3 rounded-full border border-amber-400/20 bg-black/40 px-2.5 py-1 text-[10px] font-bold text-amber-300 backdrop-blur-sm"
        animate={{ y: [0, -4, 0], rotate: [-2, 2, -2] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        🐕 1 sig
      </motion.div>
      <motion.div
        className="pointer-events-none absolute right-[18%] top-3 rounded-full border border-emerald-400/20 bg-black/40 px-2.5 py-1 text-[10px] font-bold text-emerald-300 backdrop-blur-sm"
        animate={{ y: [0, -5, 0], rotate: [2, -2, 2] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        🛡️ 5/5 sigs
      </motion.div>
      <motion.div
        className="pointer-events-none absolute bottom-3 left-[35%] rounded-full border border-zion-gold/20 bg-black/40 px-2.5 py-1 text-[10px] font-bold text-zion-gold backdrop-blur-sm"
        animate={{ y: [0, 3, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        💰 $0.00002
      </motion.div>
      <motion.div
        className="pointer-events-none absolute bottom-3 right-[35%] rounded-full border border-cyan-400/20 bg-black/40 px-2.5 py-1 text-[10px] font-bold text-cyan-300 backdrop-blur-sm"
        animate={{ y: [0, 4, 0] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
      >
        🔒 100M ZION
      </motion.div>

      {/* Doge planet */}
      <motion.div
        className="absolute left-[8%] top-1/2 -translate-y-1/2"
        animate={{ rotate: active ? [0, -10, 10, 0] : [0, -3, 3, 0], scale: active ? [1, 1.15, 1] : 1 }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full border-2 border-amber-500/30 bg-gradient-to-br from-amber-500/20 to-amber-700/20 text-5xl shadow-[0_12px_40px_rgba(245,158,11,0.25)] group-hover:shadow-[0_18px_60px_rgba(245,158,11,0.4)] transition-shadow">
          🐕
          <motion.div
            className="absolute -right-1 -top-1 rounded-full border border-white/10 bg-black/60 px-1.5 py-0.5 text-[8px] font-bold text-amber-300"
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            DOGE
          </motion.div>
        </div>
      </motion.div>

      {/* ZION stargate */}
      <motion.div
        className="absolute right-[8%] top-1/2 -translate-y-1/2"
        animate={{ rotate: active ? [0, 10, -10, 0] : [0, 3, -3, 0], scale: active ? [1, 1.15, 1] : 1 }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full border-2 border-zion-gold/30 bg-gradient-to-br from-zion-gold/20 to-zion-cyan/20 text-5xl shadow-[0_12px_40px_rgba(16,185,129,0.25)] group-hover:shadow-[0_18px_60px_rgba(16,185,129,0.4)] transition-shadow">
          🚀
          <motion.div
            className="absolute -right-1 -top-1 rounded-full border border-white/10 bg-black/60 px-1.5 py-0.5 text-[8px] font-bold text-emerald-300"
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 2.2, repeat: Infinity }}
          >
            ZION
          </motion.div>
        </div>
      </motion.div>

      {/* Rocket particles when active */}
      {active && (
        <>
          {Array.from({ length: 8 }).map((_, i) => (
            <motion.div
              key={i}
              className="pointer-events-none absolute text-sm"
              initial={{ opacity: 1, x: '80%', y: '50%', scale: 0.5 }}
              animate={{ opacity: 0, x: `${20 + i * 8}%`, y: `${20 + (i % 3) * 20}%`, scale: 1.2 }}
              transition={{ duration: 1 + i * 0.1, ease: 'easeOut' }}
            >
              {['✨', '🌟', '💫', '⚡', '🔥', '🌙', '🪐', '⭐'][i]}
            </motion.div>
          ))}
        </>
      )}

      {/* Center text bubble */}
      <div className="relative z-10 mx-auto max-w-[45%] text-center">
        <motion.div
          className="rounded-2xl border border-white/10 bg-black/50 px-4 py-3 backdrop-blur-md"
          animate={active ? { scale: [1, 1.05, 1] } : { scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <p className="text-xs font-bold text-white">{cs ? 'Doge šel na Měsíc' : 'Doge went to the Moon'}</p>
          <p className="text-[10px] text-amber-300">{cs ? 's 1 podpisem' : 'with 1 signature'}</p>
          <div className="my-2 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <p className="text-xs font-bold text-white">{cs ? 'ZION letí na Base' : 'ZION flies to Base'}</p>
          <p className="text-[10px] text-emerald-300">{cs ? 's 5/5 multisig' : 'with 5/5 multisig'}</p>
        </motion.div>
      </div>

      {/* Click hint */}
      <p className="pointer-events-none absolute bottom-1.5 left-0 right-0 text-center text-[9px] text-white/30">
        {cs ? 'Klikni pro raketový boost' : 'Click for rocket boost'}
      </p>
    </button>
  );
}
