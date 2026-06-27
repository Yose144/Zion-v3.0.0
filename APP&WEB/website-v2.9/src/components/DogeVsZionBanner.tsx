'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import StargatePortal from '@/components/StargatePortal';

interface DogeVsZionBannerProps {
  cs?: boolean;
}

export default function DogeVsZionBanner({ cs = true }: DogeVsZionBannerProps) {
  const [hover, setHover] = useState(false);

  return (
    <Link
      href="/doge-vs-zion"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="group relative block w-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-amber-500/10 via-black/40 to-emerald-500/5 p-5 transition-all hover:border-amber-400/30 hover:shadow-[0_20px_60px_rgba(245,158,11,0.18)]"
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

      <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
        {/* Doge logo */}
        <motion.div
          animate={hover ? { rotate: [0, -8, 8, 0], scale: 1.05 } : { rotate: [0, -3, 3, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-2 border-amber-400/30 bg-gradient-to-br from-amber-500/20 to-amber-700/20 shadow-[0_12px_40px_rgba(245,158,11,0.25)]"
        >
          <Image
            src="/dogecoin-logo.png"
            alt="Dogecoin"
            width={64}
            height={64}
            className="h-14 w-14 object-contain"
          />
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-black/70 px-2 py-0.5 text-[8px] font-bold text-amber-300">
            DOGE
          </span>
        </motion.div>

        {/* Center content */}
        <div className="flex-1 text-center">
          <div className="mb-2 flex flex-wrap items-center justify-center gap-2">
            <span className="rounded-full border border-amber-400/20 bg-black/40 px-2.5 py-0.5 text-[10px] font-bold text-amber-300 backdrop-blur-sm">
              🐕 1 sig
            </span>
            <span className="rounded-full border border-emerald-400/20 bg-black/40 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300 backdrop-blur-sm">
              🛡️ 5/5 sigs
            </span>
            <span className="rounded-full border border-zion-gold/20 bg-black/40 px-2.5 py-0.5 text-[10px] font-bold text-zion-gold backdrop-blur-sm">
              💰 $0.0002
            </span>
            <span className="rounded-full border border-cyan-400/20 bg-black/40 px-2.5 py-0.5 text-[10px] font-bold text-cyan-300 backdrop-blur-sm">
              🔒 100M ZION
            </span>
          </div>
          <h3 className="text-base font-bold text-white md:text-lg">
            {cs ? 'Doge vs ZION — kdo zamkne 100M ZION první?' : 'Doge vs ZION — who locks 100M ZION first?'}
          </h3>
          <p className="mt-1 text-xs text-white/50">
            {cs ? 'Klikni a hraj v Click Battle →' : 'Click and play the Click Battle →'}
          </p>
        </div>

        {/* ZION stargate portal */}
        <motion.div
          animate={hover ? { scale: 1.05 } : { scale: 1 }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
          className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-2 border-emerald-400/30 bg-gradient-to-br from-emerald-500/20 to-zion-cyan/20 shadow-[0_12px_40px_rgba(16,185,129,0.25)]"
        >
          <StargatePortal size={64} active={hover} />
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-black/70 px-2 py-0.5 text-[8px] font-bold text-emerald-300">
            ZION
          </span>
        </motion.div>

        {/* Arrow on desktop */}
        <ArrowRight className="hidden md:block h-5 w-5 text-white/30 group-hover:text-amber-300 group-hover:translate-x-1 transition-all" />
      </div>
    </Link>
  );
}
