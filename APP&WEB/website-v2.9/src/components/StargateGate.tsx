'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

/* Holographic Stargate — inspired by public_html/stargate.css, rendered as SVG */

function Chevron({ angle, active }: { angle: number; active: boolean }) {
  const rad = (angle * Math.PI) / 180;
  const cx = Math.cos(rad) * 145;
  const cy = Math.sin(rad) * 145;
  return (
    <g transform={`translate(${cx}, ${cy}) rotate(${angle + 90})`}>
      <path
        d="M -8 0 L 0 -18 L 8 0"
        fill="none"
        stroke={active ? '#6ffff0' : '#4a5568'}
        strokeWidth={active ? 2.5 : 1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: active ? 'drop-shadow(0 0 4px rgba(111,255,240,0.6))' : 'none' }}
      />
      {active && (
        <circle cx={0} cy={-10} r={3} fill="#6ffff0" opacity={0.8}>
          <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" />
        </circle>
      )}
    </g>
  );
}

function Glyph({ angle, char }: { angle: number; char: string }) {
  const rad = (angle * Math.PI) / 180;
  const x = Math.cos(rad) * 168;
  const y = Math.sin(rad) * 168;
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="central"
      fill="rgba(165,243,252,0.45)"
      fontSize="10"
      fontFamily="monospace"
      transform={`rotate(${angle + 90}, ${x}, ${y})`}
    >
      {char}
    </text>
  );
}

function RotatingRing({
  radius,
  segments,
  speed,
  direction,
  color,
  opacity,
  strokeWidth,
}: {
  radius: number;
  segments: number;
  speed: number;
  direction: 'cw' | 'ccw';
  color: string;
  opacity: number;
  strokeWidth: number;
}) {
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    let raf: number;
    let last = performance.now();
    const animate = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setRotation((prev) => {
        const dir = direction === 'cw' ? 1 : -1;
        return (prev + dt * speed * dir) % 360;
      });
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [speed, direction]);

  const step = 360 / segments;
  const dash = (2 * Math.PI * radius) / segments - 2;

  return (
    <g transform={`rotate(${rotation})`}>
      <circle
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={`${dash} ${2 * Math.PI * radius / segments - dash}`}
        opacity={opacity}
        style={{ filter: `drop-shadow(0 0 6px ${color})` }}
      />
    </g>
  );
}

export default function StargateGate() {
  const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');
  const glyphAngles = Array.from({ length: glyphs.length }, (_, i) => (i * 360) / glyphs.length);
  const chevronAngles = Array.from({ length: 9 }, (_, i) => i * 40);
  const [activeChevrons, setActiveChevrons] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveChevrons((prev) => (prev + 1) % 10);
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1.2, ease: 'easeOut', delay: 0.6 }}
      className="relative mx-auto w-full max-w-[400px] aspect-square"
    >
      <svg viewBox="-200 -200 400 400" className="h-full w-full" style={{ overflow: 'visible' }}>
        <defs>
          <radialGradient id="portalGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(6,182,212,0.35)" />
            <stop offset="40%" stopColor="rgba(147,51,234,0.2)" />
            <stop offset="80%" stopColor="rgba(6,182,212,0.05)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(111,255,240,0.25)" />
            <stop offset="50%" stopColor="rgba(139,92,246,0.1)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <filter id="stargateGlow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Outer ring body */}
        <circle r={180} fill="none" stroke="url(#portalGrad)" strokeWidth={18} opacity={0.6} />
        <circle r={170} fill="none" stroke="rgba(100,116,139,0.25)" strokeWidth={1} />
        <circle r={160} fill="none" stroke="rgba(100,116,139,0.15)" strokeWidth={0.5} />

        {/* Rotating segmented rings */}
        <RotatingRing radius={152} segments={12} speed={4} direction="cw" color="rgba(111,255,240,0.35)" opacity={0.5} strokeWidth={1.5} />
        <RotatingRing radius={140} segments={18} speed={6} direction="ccw" color="rgba(139,92,246,0.3)" opacity={0.4} strokeWidth={1} />
        <RotatingRing radius={128} segments={24} speed={3} direction="cw" color="rgba(245,215,142,0.25)" opacity={0.35} strokeWidth={0.8} />
        <RotatingRing radius={118} segments={9} speed={8} direction="ccw" color="rgba(111,255,240,0.2)" opacity={0.3} strokeWidth={2} />

        {/* Center portal glow */}
        <circle r={105} fill="url(#centerGlow)" opacity={0.6}>
          <animate attributeName="opacity" values="0.4;0.7;0.4" dur="4s" repeatCount="indefinite" />
        </circle>
        <circle r={90} fill="none" stroke="rgba(111,255,240,0.15)" strokeWidth={0.5}>
          <animate attributeName="r" values="90;95;90" dur="3s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.15;0.3;0.15" dur="3s" repeatCount="indefinite" />
        </circle>

        {/* Event horizon */}
        <circle r={75} fill="none" stroke="rgba(6,182,212,0.2)" strokeWidth={1} opacity={0.5}>
          <animate attributeName="r" values="75;85;75" dur="5s" repeatCount="indefinite" />
        </circle>
        <circle r={50} fill="rgba(6,182,212,0.08)" opacity={0.4}>
          <animate attributeName="r" values="50;58;50" dur="3.5s" repeatCount="indefinite" />
        </circle>

        {/* Glyphs ring */}
        {glyphs.map((char, i) => (
          <Glyph key={i} angle={glyphAngles[i]} char={char} />
        ))}

        {/* Chevrons */}
        {chevronAngles.map((angle, i) => (
          <Chevron key={i} angle={angle} active={i < activeChevrons} />
        ))}
      </svg>

      {/* Bottom label */}
      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
        <span className="text-[10px] font-mono uppercase tracking-[0.4em] text-cyan-200/40">
          ZION Portal
        </span>
      </div>
    </motion.div>
  );
}
