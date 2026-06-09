'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLang } from '@/contexts/LanguageContext';

/* ═══════════════════════════════════════════════════════════
   Zlatý Kompas — 7 Directions of TerraNova
   Rich interactive SVG compass visualization
   ═══════════════════════════════════════════════════════════ */

export interface Direction {
  id: string;
  titleCs: string;
  titleEn: string;
  descCs: string;
  descEn: string;
  color: string;
  rgb: string;          // "r,g,b" for rgba usage
  symbol: string;       // unicode symbol
}

export const DIRECTIONS: Direction[] = [
  {
    id: 'pravdivost',
    titleCs: 'Pravdivost',
    titleEn: 'Truthfulness',
    descCs: 'Nepsat nic, co odporuje skutečnosti jen proto, že to zní krásněji.',
    descEn: 'Never write anything that contradicts reality just because it sounds more beautiful.',
    color: '#FFD700',
    rgb: '255,215,0',
    symbol: '◈',
  },
  {
    id: 'pece',
    titleCs: 'Péče',
    titleEn: 'Care',
    descCs: 'Stavět vše tak, aby to neslo život, ne jen výkon.',
    descEn: 'Build everything so it carries life, not just performance.',
    color: '#34D399',
    rgb: '52,211,153',
    symbol: '❋',
  },
  {
    id: 'disciplina',
    titleCs: 'Disciplína',
    titleEn: 'Discipline',
    descCs: 'Držet rytmus, údržbu a provoz, bez kterých se každá vize rozpadá.',
    descEn: 'Maintain the rhythm, upkeep, and operation without which every vision crumbles.',
    color: '#60A5FA',
    rgb: '96,165,250',
    symbol: '⬡',
  },
  {
    id: 'komunita',
    titleCs: 'Komunita',
    titleEn: 'Community',
    descCs: 'Přestat si představovat budoucnost jako individualistický upgrade.',
    descEn: 'Stop imagining the future as an individualistic upgrade.',
    color: '#A78BFA',
    rgb: '167,139,250',
    symbol: '⊛',
  },
  {
    id: 'otevrenost',
    titleCs: 'Otevřenost',
    titleEn: 'Openness',
    descCs: 'Sdílet znalosti, chyby i průlomové vzory.',
    descEn: 'Share knowledge, mistakes, and breakthrough patterns alike.',
    color: '#F472B6',
    rgb: '244,114,182',
    symbol: '✦',
  },
  {
    id: 'odvaha',
    titleCs: 'Odvaha',
    titleEn: 'Courage',
    descCs: 'Nezmenšovat horizont jen proto, že je velký.',
    descEn: 'Do not shrink the horizon just because it is vast.',
    color: '#FB923C',
    rgb: '251,146,60',
    symbol: '△',
  },
  {
    id: 'mira',
    titleCs: 'Míra',
    titleEn: 'Measure',
    descCs: 'Nezvětšovat jazyk víc, než kolik unese realita.',
    descEn: 'Do not inflate language beyond what reality can bear.',
    color: '#22D3EE',
    rgb: '34,211,238',
    symbol: '◎',
  },
];

/* ─── Geometry helpers ─── */
const CX = 350;
const CY = 350;
const R_OUTER = 290;       // outermost tick ring
const R_RING = 270;        // main orbit ring
const R_NODES = 220;       // node placement
const R_INNER = 130;       // inner decorative ring
const NODE_R = 30;
const TICK_COUNT = 72;

function pt(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function nodePos(i: number) {
  return pt(CX, CY, R_NODES, i * (360 / 7));
}

/* ─── Component ─── */
interface ZlatyKompasProps {
  selected: number | null;
  onSelect: (i: number | null) => void;
}

export default function ZlatyKompas({ selected, onSelect }: ZlatyKompasProps) {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const [hovered, setHovered] = useState<number | null>(null);
  const highlighted = selected ?? hovered;

  /* Slow-rotating bezel angle */
  const [rotation, setRotation] = useState(0);
  useEffect(() => {
    let raf: number;
    let start: number | null = null;
    const tick = (ts: number) => {
      if (!start) start = ts;
      setRotation(((ts - start) / 120) % 360);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleNodeClick = useCallback((i: number) => {
    onSelect(selected === i ? null : i);
  }, [selected, onSelect]);

  /* Build heptagon polygon + inner star polygon */
  const heptPts = DIRECTIONS.map((_, i) => nodePos(i));
  const heptStr = heptPts.map(p => `${p.x},${p.y}`).join(' ');
  // Inner star: connect every-other node (skip 2)
  const starPts = DIRECTIONS.map((_, i) => {
    const target = (i * 3) % 7;
    return nodePos(target);
  });
  const starStr = starPts.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <svg
      viewBox="0 0 700 700"
      className="w-full h-auto select-none"
      role="img"
      aria-label={tr('APP_WEB_website_v2_9_src_components_Zlat', 'golden_compass_seven_directions_of_terranova', lang)}
    >
      <defs>
        {/* Central radial glow */}
        <radialGradient id="zk-center" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255,215,0,0.25)" />
          <stop offset="40%" stopColor="rgba(147,51,234,0.08)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>

        {/* Per-direction radial glows */}
        {DIRECTIONS.map((d, i) => {
          const p = nodePos(i);
          return (
            <radialGradient key={`rg-${d.id}`} id={`rg-${d.id}`} cx={p.x / 700} cy={p.y / 700} r="0.15" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={`rgba(${d.rgb},0.25)`} />
              <stop offset="100%" stopColor={`rgba(${d.rgb},0)`} />
            </radialGradient>
          );
        })}

        {/* Glow filter */}
        <filter id="zk-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="zk-glow-sm" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>

        {/* Gradient spokes */}
        {DIRECTIONS.map((d) => (
          <linearGradient key={`lg-${d.id}`} id={`lg-${d.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,215,0,0.15)" />
            <stop offset="100%" stopColor={`rgba(${d.rgb},0.5)`} />
          </linearGradient>
        ))}
      </defs>

      {/* ── Layer 0: Ambient background glow ── */}
      <circle cx={CX} cy={CY} r={280} fill="url(#zk-center)" />

      {/* Direction ambient glows (visible when highlighted) */}
      {DIRECTIONS.map((d, i) => {
        const p = nodePos(i);
        return (
          <circle
            key={`amb-${d.id}`}
            cx={p.x}
            cy={p.y}
            r={80}
            fill={`rgba(${d.rgb},${highlighted === i ? 0.12 : 0})`}
            style={{ transition: 'fill 0.5s' }}
          />
        );
      })}

      {/* ── Layer 1: Rotating outer tick ring ── */}
      <g style={{ transform: `rotate(${rotation}deg)`, transformOrigin: `${CX}px ${CY}px` }}>
        {Array.from({ length: TICK_COUNT }).map((_, i) => {
          const a = i * (360 / TICK_COUNT);
          const major = i % 9 === 0;
          const p1 = pt(CX, CY, R_OUTER, a);
          const p2 = pt(CX, CY, R_OUTER - (major ? 14 : 7), a);
          return (
            <line
              key={`tick-${i}`}
              x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
              stroke={major ? 'rgba(255,215,0,0.3)' : 'rgba(255,255,255,0.08)'}
              strokeWidth={major ? 1.5 : 0.8}
            />
          );
        })}
      </g>

      {/* ── Layer 2: Static outer orbit ring ── */}
      <circle cx={CX} cy={CY} r={R_RING} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      <circle cx={CX} cy={CY} r={R_RING - 4} fill="none" stroke="rgba(255,215,0,0.06)" strokeWidth="0.5" strokeDasharray="2 6" />

      {/* ── Layer 3: Inner decorative ring ── */}
      <circle cx={CX} cy={CY} r={R_INNER} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.8" />
      <circle cx={CX} cy={CY} r={R_INNER - 20} fill="none" stroke="rgba(147,51,234,0.06)" strokeWidth="0.5" strokeDasharray="3 8" />

      {/* ── Layer 4: Heptagon + inner star web ── */}
      <polygon points={heptStr} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      <polygon points={heptStr} fill="rgba(255,215,0,0.015)" />
      <polygon points={starStr} fill="none" stroke="rgba(255,215,0,0.06)" strokeWidth="0.7" />

      {/* ── Layer 5: Gradient spokes from center to nodes ── */}
      {DIRECTIONS.map((d, i) => {
        const p = nodePos(i);
        const isHl = highlighted === i;
        // Compute angle for gradient direction
        const angle = Math.atan2(p.y - CY, p.x - CX);
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const gid = `spoke-g-${d.id}`;
        return (
          <g key={`spoke-${d.id}`}>
            <linearGradient id={gid} x1={CX / 700} y1={CY / 700} x2={p.x / 700} y2={p.y / 700} gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={isHl ? `rgba(${d.rgb},0.5)` : 'rgba(255,215,0,0.08)'} />
              <stop offset="100%" stopColor={isHl ? `rgba(${d.rgb},0.8)` : `rgba(${d.rgb},0.15)`} />
            </linearGradient>
            <line
              x1={CX} y1={CY} x2={p.x} y2={p.y}
              stroke={`url(#${gid})`}
              strokeWidth={isHl ? 2.5 : 1.2}
              filter={isHl ? 'url(#zk-glow-sm)' : undefined}
              style={{ transition: 'stroke-width 0.4s' }}
            />
            {/* Midpoint diamond */}
            {(() => {
              const mx = CX + (p.x - CX) * 0.55;
              const my = CY + (p.y - CY) * 0.55;
              return (
                <circle
                  cx={mx} cy={my} r={isHl ? 2.5 : 1.5}
                  fill={isHl ? d.color : 'rgba(255,255,255,0.12)'}
                  style={{ transition: 'all 0.3s' }}
                />
              );
            })()}
          </g>
        );
      })}

      {/* ── Layer 6: Center compass rose ── */}
      <g>
        {/* Outer ring */}
        <circle cx={CX} cy={CY} r={42} fill="rgba(0,0,0,0.5)" stroke="rgba(255,215,0,0.25)" strokeWidth="1.5" />
        <circle cx={CX} cy={CY} r={36} fill="rgba(0,0,0,0.7)" stroke="rgba(255,215,0,0.15)" strokeWidth="1" />

        {/* Cardinal compass arms (decorative cross) */}
        {[0, 90, 180, 270].map((a) => {
          const inner = pt(CX, CY, 10, a);
          const outer = pt(CX, CY, 30, a);
          return (
            <line key={`arm-${a}`} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
              stroke={a === 0 ? 'rgba(255,215,0,0.7)' : 'rgba(255,255,255,0.2)'}
              strokeWidth={a === 0 ? 2 : 1}
            />
          );
        })}

        {/* North arrow */}
        <polygon
          points={`${CX},${CY - 32} ${CX - 6},${CY - 18} ${CX + 6},${CY - 18}`}
          fill="rgba(255,215,0,0.8)"
          filter="url(#zk-glow-sm)"
        />
        <polygon
          points={`${CX},${CY + 32} ${CX - 5},${CY + 20} ${CX + 5},${CY + 20}`}
          fill="rgba(255,255,255,0.15)"
        />

        {/* Center diamond */}
        <polygon
          points={`${CX},${CY - 6} ${CX + 6},${CY} ${CX},${CY + 6} ${CX - 6},${CY}`}
          fill="#FFD700"
          opacity={0.9}
        />

        {/* N / S labels */}
        <text x={CX} y={CY - 39} textAnchor="middle" fill="rgba(255,215,0,0.6)" fontSize="9" fontWeight="700" fontFamily="var(--font-mono), monospace">N</text>
        <text x={CX} y={CY + 47} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="8" fontWeight="600" fontFamily="var(--font-mono), monospace">S</text>
      </g>

      {/* ── Layer 7: Direction nodes ── */}
      {DIRECTIONS.map((d, i) => {
        const p = nodePos(i);
        const isHl = highlighted === i;
        const isActive = selected === i;
        const title = cs ? d.titleCs : d.titleEn;

        // Label position — pushed further out
        const angle = i * (360 / 7);
        const lp = pt(CX, CY, R_NODES + 60, angle);

        return (
          <g
            key={d.id}
            className="cursor-pointer"
            onClick={() => handleNodeClick(i)}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            role="button"
            tabIndex={0}
            aria-label={title}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleNodeClick(i);
              }
            }}
          >
            {/* Pulse ring (active) */}
            {isActive && (
              <circle
                cx={p.x} cy={p.y} r={NODE_R + 16}
                fill="none"
                stroke={d.color}
                strokeWidth="1"
                opacity={0.3}
              >
                <animate attributeName="r" from={String(NODE_R + 10)} to={String(NODE_R + 24)} dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.4" to="0" dur="2s" repeatCount="indefinite" />
              </circle>
            )}

            {/* Outer glow ring */}
            <circle
              cx={p.x} cy={p.y} r={NODE_R + 10}
              fill="none"
              stroke={`rgba(${d.rgb},${isHl ? 0.35 : 0})`}
              strokeWidth="1.5"
              style={{ transition: 'stroke 0.4s' }}
            />

            {/* Node body */}
            <circle
              cx={p.x} cy={p.y} r={NODE_R}
              fill={isHl ? `rgba(${d.rgb},0.12)` : 'rgba(0,0,0,0.65)'}
              stroke={isHl ? d.color : 'rgba(255,255,255,0.12)'}
              strokeWidth={isHl ? 2.5 : 1.2}
              filter={isHl ? 'url(#zk-glow)' : undefined}
              style={{ transition: 'all 0.35s' }}
            />

            {/* Symbol */}
            <text
              x={p.x} y={p.y + 1}
              textAnchor="middle"
              dominantBaseline="central"
              fill={isHl ? d.color : 'rgba(255,255,255,0.4)'}
              fontSize="18"
              style={{ transition: 'fill 0.3s' }}
            >
              {d.symbol}
            </text>

            {/* Label */}
            <text
              x={lp.x} y={lp.y}
              textAnchor="middle"
              dominantBaseline="central"
              fill={isHl ? d.color : 'rgba(255,255,255,0.45)'}
              fontSize="12.5"
              fontWeight={isHl ? '700' : '500'}
              letterSpacing="0.06em"
              style={{ transition: 'fill 0.3s' }}
            >
              {title}
            </text>

            {/* Subtle connecting arc to label */}
            {isHl && (() => {
              const ep = pt(CX, CY, R_NODES + 42, angle);
              return (
                <line
                  x1={p.x + (ep.x - p.x) * 0.6}
                  y1={p.y + (ep.y - p.y) * 0.6}
                  x2={ep.x}
                  y2={ep.y}
                  stroke={`rgba(${d.rgb},0.25)`}
                  strokeWidth="0.8"
                  strokeDasharray="2 3"
                />
              );
            })()}
          </g>
        );
      })}
    </svg>
  );
}
