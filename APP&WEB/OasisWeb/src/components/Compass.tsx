'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowUp, Crosshair } from 'lucide-react';

export interface CompassData {
  position: { x: number; y: number; z: number };
  forward: { x: number; y: number; z: number };
  yaw: number;
  pitch: number;
}

export interface CompassProps {
  target: { x: number; y: number; z: number } | null;
  targetName: string;
  targetColor: string;
  compassRef: React.RefObject<CompassData | null>;
}

function normalizeAngle(a: number) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a <= -Math.PI) a += Math.PI * 2;
  return a;
}

function toDegrees(rad: number) {
  let deg = (rad * 180 / Math.PI) % 360;
  if (deg < 0) deg += 360;
  return Math.round(deg);
}

function formatDistance(d: number) {
  if (!isFinite(d)) return '--';
  if (d > 1000) return `${Math.round(d)}`;
  return d.toFixed(1);
}

export default function Compass({ target, targetName, targetColor, compassRef }: CompassProps) {
  const [heading, setHeading] = useState(0);
  const [bearing, setBearing] = useState(0);
  const [distance, setDistance] = useState(0);

  useEffect(() => {
    let raf: number;
    let last = performance.now();

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 80) return;
      last = now;

      const data = compassRef.current;
      if (!data || !target) return;

      const dx = target.x - data.position.x;
      const dy = target.y - data.position.y;
      const dz = target.z - data.position.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      const targetYaw = Math.atan2(dx, -dz);
      const relativeBearing = normalizeAngle(targetYaw - data.yaw);

      setHeading(toDegrees(data.yaw));
      setBearing(toDegrees(relativeBearing));
      setDistance(dist);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [target, compassRef]);

  if (!target) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="pointer-events-auto flex flex-col items-center"
    >
      <div className="relative h-28 w-28 rounded-full zion-hud-panel p-1 sm:h-32 sm:w-32">
        {/* Rotating compass rose */}
        <div
          className="absolute inset-2"
          style={{ transform: `rotate(${-heading}deg)` }}
        >
          <span
            className="absolute left-1/2 top-0 text-[10px] font-bold text-white"
            style={{ transform: `translateX(-50%) rotate(${heading}deg)` }}
          >
            N
          </span>
          <span
            className="absolute right-0 top-1/2 text-[10px] font-bold text-white"
            style={{ transform: `translateY(-50%) rotate(${heading}deg)` }}
          >
            E
          </span>
          <span
            className="absolute bottom-0 left-1/2 text-[10px] font-bold text-white"
            style={{ transform: `translateX(-50%) rotate(${heading}deg)` }}
          >
            S
          </span>
          <span
            className="absolute left-0 top-1/2 text-[10px] font-bold text-white"
            style={{ transform: `translateY(-50%) rotate(${heading}deg)` }}
          >
            W
          </span>

          {/* Minor ticks */}
          {[30, 60, 120, 150, 210, 240, 300, 330].map((deg) => (
            <div
              key={deg}
              className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2"
              style={{ transform: `rotate(${deg}deg)` }}
            >
              <div className="mx-auto mt-1.5 h-1 w-px bg-white/20" />
            </div>
          ))}
        </div>

        {/* Outer ring tick */}
        <div className="absolute inset-0 rounded-full border border-white/10" />

        {/* Target needle */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ transform: `translate(-50%, -50%) rotate(${bearing}deg)` }}
        >
          <ArrowUp className="h-14 w-14 drop-shadow-[0_0_6px_rgba(0,0,0,0.8)]" color={targetColor} strokeWidth={2.5} />
        </div>

        {/* Center dot / heading */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          <Crosshair className="h-4 w-4 text-white/60" />
          <span className="mt-3 block text-[10px] font-mono text-white/80">{heading}°</span>
        </div>
      </div>

      <div className="mt-2 zion-hud-panel px-3 py-1.5 text-center">
        <p className="max-w-[150px] truncate text-xs font-semibold" style={{ color: targetColor }}>
          {targetName}
        </p>
        <p className="text-[10px] font-mono text-white/70">
          {formatDistance(distance)} ly
        </p>
      </div>
    </motion.div>
  );
}
