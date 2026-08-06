'use client';

import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { useEffect, useRef } from 'react';

/**
 * OasisAmbientScene — dekorativní interaktivní scéna s oázou.
 * Používá se jako hero background na game page.
 * - Hvězdné nebe s parallaxem na pohyb myši
 * - Oáza (voda) s vlnami a odlesky
 * - Palma silueta
 * - Plovoucí částice (světlušky)
 * - Stargate portal v pozadí
 */
export default function OasisAmbientScene({ className = '' }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);

  // Spring pro plynulý parallax
  const sx = useSpring(mx, { stiffness: 40, damping: 20 });
  const sy = useSpring(my, { stiffness: 40, damping: 20 });

  // Vrstvy parallax — různá hloubka
  const starsX = useTransform(sx, [-0.5, 0.5], [-15, 15]);
  const starsY = useTransform(sy, [-0.5, 0.5], [-10, 10]);
  const dunesX = useTransform(sx, [-0.5, 0.5], [-25, 25]);
  const dunesY = useTransform(sy, [-0.5, 0.5], [-8, 8]);
  const waterX = useTransform(sx, [-0.5, 0.5], [-35, 35]);
  const palmX = useTransform(sx, [-0.5, 0.5], [-45, 45]);
  const portalX = useTransform(sx, [-0.5, 0.5], [-20, 20]);
  const portalY = useTransform(sy, [-0.5, 0.5], [-15, 15]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      mx.set((e.clientX - rect.left) / rect.width - 0.5);
      my.set((e.clientY - rect.top) / rect.height - 0.5);
    };
    el.addEventListener('mousemove', onMove);
    return () => el.removeEventListener('mousemove', onMove);
  }, [mx, my]);

  return (
    <div
      ref={containerRef}
      className={`pointer-events-auto relative overflow-hidden rounded-3xl border border-white/10 ${className}`}
      style={{ minHeight: 320 }}
    >
      {/* ─── Gradient nebe (noc → úsvit) ─── */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a2e] via-[#1a1040] to-[#3d1f5c]" />

      {/* ─── Hvězdy (parallax vrstva 1 — nejdál) ─── */}
      <motion.div style={{ x: starsX, y: starsY }} className="absolute inset-0">
        {Array.from({ length: 60 }).map((_, i) => {
          const size = 1 + (i % 3) * 0.6;
          return (
            <motion.div
              key={i}
              className="absolute rounded-full bg-white"
              style={{
                width: size,
                height: size,
                top: `${(i * 13.7) % 70}%`,
                left: `${(i * 23.1) % 100}%`,
              }}
              animate={{ opacity: [0.2, 0.9, 0.2], scale: [1, 1.4, 1] }}
              transition={{ duration: 2 + (i % 5), repeat: Infinity, delay: i * 0.08, ease: 'easeInOut' }}
            />
          );
        })}
      </motion.div>

      {/* ─── Měsíc / planet ─── */}
      <motion.div
        style={{ x: portalX, y: portalY }}
        className="absolute right-[12%] top-[12%]"
      >
        <div className="relative h-16 w-16 rounded-full bg-gradient-to-br from-amber-100/80 to-zion-gold/40 shadow-[0_0_60px_rgba(252, 209, 22,0.3)]">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-transparent to-black/30" />
          {/* Krátery */}
          <div className="absolute left-3 top-4 h-2 w-2 rounded-full bg-black/15" />
          <div className="absolute left-8 top-7 h-1.5 w-1.5 rounded-full bg-black/10" />
          <div className="absolute left-5 top-9 h-1 w-1 rounded-full bg-black/10" />
        </div>
      </motion.div>

      {/* ─── Stargate portal v pozadí (vzdálený) ─── */}
      <motion.div
        style={{ x: portalX, y: portalY }}
        className="absolute left-[8%] top-[20%] opacity-40"
      >
        <div className="relative h-24 w-24">
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-zion-cyan/40"
            animate={{ rotate: 360 }}
            transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
          >
            {Array.from({ length: 8 }).map((_, i) => {
              const a = (i * 45 * Math.PI) / 180;
              return (
                <div
                  key={i}
                  className="absolute h-1.5 w-1.5 rounded-full bg-zion-gold"
                  style={{
                    left: `calc(50% + ${Math.cos(a) * 46}px - 3px)`,
                    top: `calc(50% + ${Math.sin(a) * 46}px - 3px)`,
                  }}
                />
              );
            })}
          </motion.div>
          <motion.div
            className="absolute inset-3 rounded-full bg-gradient-to-br from-zion-cyan/20 to-zion-purple/20 blur-md"
            animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      </motion.div>

      {/* ─── Dunes (pouštní duny — parallax vrstva 2) ─── */}
      <motion.svg
        style={{ x: dunesX, y: dunesY }}
        viewBox="0 0 1200 200"
        preserveAspectRatio="none"
        className="absolute bottom-0 left-0 w-full"
      >
        <defs>
          <linearGradient id="duneGrad1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5b2c6f" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#2a1240" stopOpacity="1" />
          </linearGradient>
          <linearGradient id="duneGrad2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7d3c98" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#3a1a50" stopOpacity="1" />
          </linearGradient>
        </defs>
        {/* Vzdálené duny */}
        <path d="M0,120 Q300,60 600,100 T1200,90 L1200,200 L0,200 Z" fill="url(#duneGrad2)" />
        {/* Blízké duny */}
        <path d="M0,150 Q200,100 500,130 T1000,120 L1200,140 L1200,200 L0,200 Z" fill="url(#duneGrad1)" />
      </motion.svg>

      {/* ─── Oáza — voda (parallax vrstva 3) ─── */}
      <motion.div
        style={{ x: waterX }}
        className="absolute bottom-[18%] left-1/2 -translate-x-1/2"
      >
        <div className="relative w-[280px] h-[60px]">
          {/* Vodní hladina */}
          <div className="absolute inset-0 rounded-[50%] bg-gradient-to-b from-zion-cyan/40 to-zion-purple/30 blur-[2px]" />
          {/* Vlny */}
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute inset-0 rounded-[50%] border border-cyan-200/20"
              animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 4, repeat: Infinity, delay: i * 1.3, ease: 'easeOut' }}
            />
          ))}
          {/* Odlesk hvězd na vodě */}
          <motion.div
            className="absolute left-1/2 top-1/2 h-1 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/30 blur-sm"
            animate={{ opacity: [0.2, 0.5, 0.2], scaleX: [1, 1.2, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      </motion.div>

      {/* ─── Palma silueta (parallax vrstva 4 — nejbližší) ─── */}
      <motion.div
        style={{ x: palmX }}
        className="absolute bottom-[15%] right-[18%]"
      >
        <svg width="80" height="120" viewBox="0 0 80 120" className="drop-shadow-[0_0_20px_rgba(0,0,0,0.5)]">
          {/* Kmen */}
          <path d="M38,120 Q36,80 40,50 Q42,30 38,15" stroke="#1a0a2e" strokeWidth="4" fill="none" strokeLinecap="round" />
          {/* Listy */}
          {[
            { d: 'M38,15 Q15,5 0,18', delay: 0 },
            { d: 'M38,15 Q60,2 78,15', delay: 0.5 },
            { d: 'M38,15 Q20,0 10,-8', delay: 1 },
            { d: 'M38,15 Q58,0 68,-6', delay: 1.5 },
            { d: 'M38,15 Q38,-5 36,-15', delay: 2 },
          ].map((leaf, i) => (
            <motion.path
              key={i}
              d={leaf.d}
              stroke="#2a1a4e"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              animate={{ rotate: [0, 3, 0, -3, 0] }}
              transition={{ duration: 5, repeat: Infinity, delay: leaf.delay, ease: 'easeInOut' }}
              style={{ transformOrigin: '38px 15px' }}
            />
          ))}
        </svg>
      </motion.div>

      {/* ─── Světlušky / částice (foreground) ─── */}
      <div className="absolute inset-0">
        {Array.from({ length: 15 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-zion-gold"
            style={{
              width: 2 + (i % 2),
              height: 2 + (i % 2),
              left: `${10 + (i * 6.7) % 80}%`,
              top: `${20 + (i * 11.3) % 50}%`,
              boxShadow: '0 0 6px rgba(252, 209, 22,0.8)',
            }}
            animate={{
              y: [0, -30, 0],
              x: [0, (i % 2 ? 15 : -15), 0],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 6 + (i % 4),
              repeat: Infinity,
              delay: i * 0.4,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      {/* ─── Vignette ─── */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
    </div>
  );
}
