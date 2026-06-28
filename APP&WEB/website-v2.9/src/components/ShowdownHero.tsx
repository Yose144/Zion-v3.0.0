'use client';

import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { useEffect, useRef } from 'react';

/**
 * ShowdownHero — cosmic "Doge vs ZION" hero background.
 * Deep space with two colliding energy cores (amber Doge vs purple ZION),
 * nebula clouds, stargate rings, and parallax stars.
 * Sophisticated, not childish.
 */
export default function ShowdownHero({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 30, damping: 18 });
  const sy = useSpring(my, { stiffness: 30, damping: 18 });

  const starsX = useTransform(sx, [-0.5, 0.5], [-12, 12]);
  const starsY = useTransform(sy, [-0.5, 0.5], [-8, 8]);
  const nebulaX = useTransform(sx, [-0.5, 0.5], [-30, 30]);
  const dogeX = useTransform(sx, [-0.5, 0.5], [20, -20]);
  const zionX = useTransform(sx, [-0.5, 0.5], [-20, 20]);
  const ringX = useTransform(sx, [-0.5, 0.5], [-15, 15]);
  const ringY = useTransform(sy, [-0.5, 0.5], [-10, 10]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      mx.set((e.clientX - r.left) / r.width - 0.5);
      my.set((e.clientY - r.top) / r.height - 0.5);
    };
    el.addEventListener('mousemove', onMove);
    return () => el.removeEventListener('mousemove', onMove);
  }, [mx, my]);

  return (
    <div ref={ref} className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {/* Deep space gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#06030f] via-[#0d0820] to-[#1a0a2e]" />

      {/* Nebula clouds — purple left, amber right */}
      <motion.div style={{ x: nebulaX }} className="absolute inset-0">
        <div className="absolute left-[5%] top-[10%] h-[300px] w-[300px] rounded-full bg-purple-600/10 blur-[80px]" />
        <div className="absolute left-[15%] top-[30%] h-[200px] w-[200px] rounded-full bg-fuchsia-600/8 blur-[60px]" />
        <div className="absolute right-[5%] top-[15%] h-[280px] w-[280px] rounded-full bg-amber-500/8 blur-[80px]" />
        <div className="absolute right-[20%] top-[40%] h-[180px] w-[180px] rounded-full bg-orange-500/6 blur-[60px]" />
      </motion.div>

      {/* Stars (parallax) */}
      <motion.div style={{ x: starsX, y: starsY }} className="absolute inset-0">
        {Array.from({ length: 80 }).map((_, i) => {
          const size = 0.5 + (i % 4) * 0.5;
          return (
            <motion.div
              key={i}
              className="absolute rounded-full bg-white"
              style={{
                width: size,
                height: size,
                top: `${(i * 11.3) % 100}%`,
                left: `${(i * 19.7) % 100}%`,
                opacity: 0.15 + (i % 5) * 0.1,
              }}
              animate={{ opacity: [0.1, 0.6, 0.1], scale: [1, 1.3, 1] }}
              transition={{ duration: 3 + (i % 4), repeat: Infinity, delay: i * 0.05, ease: 'easeInOut' }}
            />
          );
        })}
      </motion.div>

      {/* Collision center — energy crack */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <motion.div
          className="h-[2px] w-[400px] bg-gradient-to-r from-amber-500/0 via-white/30 to-purple-500/0"
          animate={{ scaleX: [0.3, 1, 0.3], opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Doge energy core (left, amber) */}
      <motion.div style={{ x: dogeX }} className="absolute left-[12%] top-1/2 -translate-y-1/2">
        <div className="relative h-32 w-32">
          <div className="absolute inset-0 rounded-full bg-amber-500/15 blur-[40px]" />
          <motion.div
            className="absolute inset-4 rounded-full border border-amber-500/30"
            animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute inset-8 rounded-full bg-gradient-to-br from-amber-400/20 to-amber-600/10 blur-md"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      </motion.div>

      {/* ZION energy core (right, purple) */}
      <motion.div style={{ x: zionX }} className="absolute right-[12%] top-1/2 -translate-y-1/2">
        <div className="relative h-32 w-32">
          <div className="absolute inset-0 rounded-full bg-purple-500/15 blur-[40px]" />
          <motion.div
            className="absolute inset-4 rounded-full border border-purple-500/30"
            animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
          />
          <motion.div
            className="absolute inset-8 rounded-full bg-gradient-to-br from-purple-400/20 to-fuchsia-600/10 blur-md"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
          />
        </div>
      </motion.div>

      {/* Central stargate ring (parallax) */}
      <motion.div style={{ x: ringX, y: ringY }} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <motion.svg
          viewBox="0 0 200 200"
          className="h-48 w-48 opacity-30"
          animate={{ rotate: 360 }}
          transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
        >
          <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(147,51,234,0.3)" strokeWidth="1" strokeDasharray="3 6" />
          <circle cx="100" cy="100" r="75" fill="none" stroke="rgba(6,182,212,0.2)" strokeWidth="0.5" />
        </motion.svg>
        <motion.svg
          viewBox="0 0 200 200"
          className="absolute inset-0 h-48 w-48 opacity-20"
          animate={{ rotate: -360 }}
          transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
        >
          <circle cx="100" cy="100" r="60" fill="none" stroke="rgba(245,158,11,0.3)" strokeWidth="1" strokeDasharray="2 8" />
        </motion.svg>
      </motion.div>

      {/* Vignette */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-black/40" />
    </div>
  );
}
