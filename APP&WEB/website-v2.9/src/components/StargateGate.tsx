'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Leaf, ArrowRight } from 'lucide-react';

/* Holographic Stargate — inspired by public_html/stargate.css */

function Chevron({ angle, active }: { angle: number; active: boolean }) {
  const rad = (angle * Math.PI) / 180;
  const cx = Math.cos(rad) * 158;
  const cy = Math.sin(rad) * 158;
  return (
    <g transform={`translate(${cx}, ${cy}) rotate(${angle + 90})`}>
      {/* outer chevron shape */}
      <path
        d="M -10 0 L 0 -24 L 10 0"
        fill="none"
        stroke={active ? '#6ffff0' : '#475569'}
        strokeWidth={active ? 3 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: active ? 'drop-shadow(0 0 6px rgba(7, 137, 48,0.7))' : 'none' }}
      />
      {/* inner chevron */}
      <path
        d="M -7 2 L 0 -18 L 7 2"
        fill="none"
        stroke={active ? '#a8fff8' : '#334155'}
        strokeWidth={1.5}
        strokeLinecap="round"
        style={{ opacity: active ? 0.9 : 0.5 }}
      />
      {/* glow dot */}
      {active && (
        <>
          <circle cx={0} cy={-14} r={3.5} fill="#6ffff0" opacity={0.9}>
            <animate attributeName="opacity" values="0.5;1;0.5" dur="1.5s" repeatCount="indefinite" />
          </circle>
          <circle cx={0} cy={-14} r={6} fill="none" stroke="#6ffff0" strokeWidth={0.5} opacity={0.4}>
            <animate attributeName="r" values="4;8;4" dur="2s" repeatCount="indefinite" />
          </circle>
        </>
      )}
    </g>
  );
}

function Glyph({ angle, char, active }: { angle: number; char: string; active: boolean }) {
  const rad = (angle * Math.PI) / 180;
  const x = Math.cos(rad) * 182;
  const y = Math.sin(rad) * 182;
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="central"
      fill={active ? 'rgba(165,243,252,0.85)' : 'rgba(165,243,252,0.35)'}
      fontSize={active ? 11 : 10}
      fontFamily="monospace"
      fontWeight={active ? 'bold' : 'normal'}
      transform={`rotate(${angle + 90}, ${x}, ${y})`}
      style={{ transition: 'all 0.3s' }}
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
  glow = false,
}: {
  radius: number;
  segments: number;
  speed: number;
  direction: 'cw' | 'ccw';
  color: string;
  opacity: number;
  strokeWidth: number;
  glow?: boolean;
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
        style={{ filter: glow ? `drop-shadow(0 0 8px ${color})` : 'none' }}
      />
    </g>
  );
}

export default function StargateGate() {
  const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');
  const glyphAngles = Array.from({ length: glyphs.length }, (_, i) => (i * 360) / glyphs.length);
  const chevronAngles = Array.from({ length: 9 }, (_, i) => i * 40);
  const [activeChevrons, setActiveChevrons] = useState(0);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveChevrons((prev) => (prev + 1) % 10);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Stargate SVG */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: 'easeOut', delay: 0.6 }}
        className="relative mx-auto w-full max-w-[300px] sm:max-w-[380px] md:max-w-[420px] aspect-square overflow-hidden"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <svg viewBox="-210 -210 420 420" className="h-full w-full">
          <defs>
            <radialGradient id="portalGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(7,137,48,0.4)" />
              <stop offset="40%" stopColor="rgba(228,30,43,0.25)" />
              <stop offset="80%" stopColor="rgba(7,137,48,0.08)" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
            <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(7, 137, 48,0.3)" />
              <stop offset="50%" stopColor="rgba(228, 30, 43,0.15)" />
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

          {/* Outer metallic ring body */}
          <circle r={190} fill="none" stroke="url(#portalGrad)" strokeWidth={22} opacity={0.5} />
          <circle r={180} fill="none" stroke="rgba(100,116,139,0.3)" strokeWidth={2} />
          <circle r={172} fill="none" stroke="rgba(71,85,105,0.2)" strokeWidth={1} />

          {/* Sri Yantra inspired inner rings (like rotate23-28 in original) */}
          <RotatingRing radius={165} segments={6} speed={3} direction="cw" color="rgba(228, 30, 43,0.2)" opacity={0.3} strokeWidth={1.5} />
          <RotatingRing radius={160} segments={6} speed={5} direction="ccw" color="rgba(7,137,48,0.15)" opacity={0.25} strokeWidth={1} />

          {/* Main rotating segmented rings (like rotate1-22 in original) */}
          <RotatingRing radius={155} segments={12} speed={4} direction="cw" color="rgba(7, 137, 48,0.4)" opacity={0.55} strokeWidth={2} glow />
          <RotatingRing radius={148} segments={18} speed={6} direction="ccw" color="rgba(228, 30, 43,0.3)" opacity={0.45} strokeWidth={1.5} glow />
          <RotatingRing radius={140} segments={24} speed={2.5} direction="cw" color="rgba(245,215,142,0.25)" opacity={0.4} strokeWidth={1} glow />
          <RotatingRing radius={134} segments={9} speed={8} direction="ccw" color="rgba(7, 137, 48,0.2)" opacity={0.35} strokeWidth={2.5} glow />
          <RotatingRing radius={128} segments={15} speed={5} direction="cw" color="rgba(228,30,43,0.18)" opacity={0.3} strokeWidth={1} />
          <RotatingRing radius={122} segments={8} speed={7} direction="ccw" color="rgba(7,137,48,0.15)" opacity={0.25} strokeWidth={1.5} />

          {/* Inner event horizon glow */}
          <circle r={115} fill="url(#centerGlow)" opacity={0.5}>
            <animate attributeName="opacity" values="0.35;0.65;0.35" dur="4s" repeatCount="indefinite" />
          </circle>

          {/* Pulsing rings */}
          <circle r={105} fill="none" stroke="rgba(7, 137, 48,0.12)" strokeWidth={1} opacity={0.4}>
            <animate attributeName="r" values="105;112;105" dur="3s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.12;0.3;0.12" dur="3s" repeatCount="indefinite" />
          </circle>
          <circle r={95} fill="none" stroke="rgba(228, 30, 43,0.1)" strokeWidth={0.5}>
            <animate attributeName="r" values="95;102;95" dur="4s" repeatCount="indefinite" />
          </circle>

          {/* Event horizon center */}
          <circle r={80} fill="none" stroke="rgba(7,137,48,0.18)" strokeWidth={1} opacity={0.5}>
            <animate attributeName="r" values="80;90;80" dur="5s" repeatCount="indefinite" />
          </circle>
          <circle r={55} fill="rgba(7,137,48,0.06)" opacity={0.4}>
            <animate attributeName="r" values="55;65;55" dur="3.5s" repeatCount="indefinite" />
          </circle>
          <circle r={35} fill="rgba(7, 137, 48,0.04)" opacity={0.3}>
            <animate attributeName="r" values="35;42;35" dur="2.5s" repeatCount="indefinite" />
          </circle>

          {/* Glyphs ring */}
          {glyphs.map((char, i) => (
            <Glyph key={i} angle={glyphAngles[i]} char={char} active={hovered && i % 9 < activeChevrons} />
          ))}

          {/* Chevrons */}
          {chevronAngles.map((angle, i) => (
            <Chevron key={i} angle={angle} active={i < activeChevrons} />
          ))}

          {/* Central lock / kawoosh hint */}
          <circle r={8} fill="#6ffff0" opacity={activeChevrons >= 9 ? 0.8 : 0.15}>
            <animate attributeName="opacity" values={activeChevrons >= 9 ? "0.5;1;0.5" : "0.1;0.2;0.1"} dur="1.5s" repeatCount="indefinite" />
          </circle>
        </svg>

        {/* Hover overlay glow */}
        <div className={`absolute inset-0 rounded-full transition-opacity duration-500 pointer-events-none ${hovered ? 'opacity-100' : 'opacity-0'}`}>
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,rgba(7, 137, 48,0.08),transparent_70%)]" />
        </div>
      </motion.div>

      {/* ZION Oasis interactive link */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 1.4 }}
      >
        <a
          href="https://oasis.zionterranova.com"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-3 rounded-2xl border border-zion-cyan/20 bg-gradient-to-br from-zion-cyan/8 via-zion-cyan/4 to-transparent px-6 py-3 backdrop-blur-sm transition-all duration-300 hover:border-zion-cyan/40 hover:shadow-[0_0_36px_rgba(7, 137, 48,0.15)] hover:scale-[1.03]"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-zion-cyan/25 bg-zion-cyan/12 ring-1 ring-zion-cyan/15 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
            <Leaf className="h-5 w-5 text-zion-cyan" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-zion-cyan tracking-wide">ZION Oasis</span>
            <span className="text-[10px] text-gray-400 group-hover:text-gray-300 transition-colors">UE5 Metaverse · On-chain · Guild DAO</span>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-500 transition-all duration-300 group-hover:text-zion-cyan group-hover:translate-x-1" />
        </a>
      </motion.div>
    </div>
  );
}
