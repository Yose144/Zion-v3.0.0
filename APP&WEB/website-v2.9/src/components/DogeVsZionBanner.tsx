'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import StargateLogo from '@/components/StargateLogo';

const DogeVsZionBannerCopy = {
  dogeVsZionWhoLocks100mZionFirs: { cs: `Doge vs ZION — kdo zamkne 100M ZION první?`, en: `Doge vs ZION — who locks 100M ZION first?` },
  clickAndPlayTheClickBattle: { cs: `Klikni a hraj v Click Battle →`, en: `Click and play the Click Battle →` },
};

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
      className="group relative block w-full overflow-hidden rounded-2xl border border-zion-gold/30 bg-zion-blue/50 p-5 transition-all hover:border-zion-gold/60 hover:shadow-[0_20px_60px_rgba(252,209,22,0.28)]"
    >
      {/* Rasta shimmer overlay */}
      <div className="absolute inset-0 pointer-events-none rasta-shimmer opacity-20" />

      {/* Starfield background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 16 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-zion-gold"
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

      {/* Top & bottom tri-color rasta lines */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-linear-to-r from-zion-purple via-zion-gold to-zion-cyan pointer-events-none z-[5]" />
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-linear-to-r from-zion-cyan via-zion-gold to-zion-purple pointer-events-none z-[5]" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
        {/* Doge logo */}
        <motion.div
          animate={hover ? { rotate: [0, -8, 8, 0], scale: 1.05 } : { rotate: [0, -3, 3, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-2 border-zion-gold/30 bg-zion-gold/20 shadow-[0_12px_40px_rgba(252,209,22,0.25)]"
        >
          <Image
            src="/dogecoin-logo.png"
            alt="Dogecoin"
            width={64}
            height={64}
            sizes="64px"
            className="h-14 w-14 object-contain"
          />
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full border border-zion-gold/30 bg-zion-blue/70 px-2 py-0.5 text-[8px] font-bold text-zion-gold z-20 animate-pulse-glow">
            DOGE
          </span>
        </motion.div>

        {/* Center content */}
        <div className="flex-1 text-center">
          <div className="mb-1.5 flex flex-wrap items-center justify-center gap-1.5">
            <span className="rounded-full border border-zion-gold/20 bg-zion-gold/10 px-2 py-0.5 text-[8px] font-bold text-zion-gold backdrop-blur-sm">
              🐕 1 sig
            </span>
            <span className="rounded-full border border-zion-cyan/20 bg-zion-cyan/10 px-2 py-0.5 text-[8px] font-bold text-zion-cyan backdrop-blur-sm">
              🛡️ 5/5 sigs
            </span>
            <span className="rounded-full border border-zion-purple/20 bg-zion-purple/10 px-2 py-0.5 text-[8px] font-bold text-zion-purple backdrop-blur-sm">
              💰 $0.0002
            </span>
            <span className="rounded-full border border-zion-cyan/20 bg-zion-cyan/10 px-2 py-0.5 text-[8px] font-bold text-zion-cyan backdrop-blur-sm">
              🔒 100M ZION
            </span>
          </div>
          <h3 className="text-sm font-bold text-gradient md:text-base">
            {DogeVsZionBannerCopy.dogeVsZionWhoLocks100mZionFirs[cs ? 'cs' : 'en']}
          </h3>
          <p className="mt-1 text-[10px] text-zion-gold/60">
            {DogeVsZionBannerCopy.clickAndPlayTheClickBattle[cs ? 'cs' : 'en']}
          </p>
        </div>

        {/* ZION stargate */}
        <motion.div
          animate={hover ? { scale: 1.05 } : { scale: 1 }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
          className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-full border-2 border-zion-cyan/30 bg-zion-cyan/10 shadow-[0_12px_40px_rgba(7,137,48,0.25)] overflow-hidden"
        >
          <StargateLogo className="w-full h-full" />
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full border border-zion-cyan/30 bg-zion-blue/70 px-2 py-0.5 text-[8px] font-bold text-zion-cyan z-20 animate-pulse-glow">
            ZION
          </span>
        </motion.div>

        {/* Arrow on desktop */}
        <ArrowRight className="hidden md:block h-5 w-5 text-zion-gold/50 group-hover:text-zion-gold group-hover:translate-x-1 transition-all" />
      </div>
    </Link>
  );
}
