'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Gauge, Target, Navigation, Rocket } from 'lucide-react';
import type { CompassData } from './Compass';
import type { World } from '../domain/types/world';

const ZION_CYAN = '#06b6d4';
const ZION_PURPLE = '#9333ea';

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

export interface ShipHudProps {
  compassRef: React.RefObject<CompassData | null>;
  target: { x: number; y: number; z: number } | null;
  targetName: string;
  targetColor: string;
  flightSpeed: number;
  maxSpeed: number;
  throttle: number;
  onThrottleChange: (v: number) => void;
  landTarget: World | null;
  onApproach: (world: World) => void;
  onExit: () => void;
}

export default function ShipHud({
  compassRef,
  target,
  targetName,
  targetColor,
  flightSpeed,
  maxSpeed,
  throttle,
  onThrottleChange,
  landTarget,
  onApproach,
  onExit,
}: ShipHudProps) {
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
      if (!data) return;

      setHeading(toDegrees(data.yaw));

      if (target) {
        const dx = target.x - data.position.x;
        const dy = target.y - data.position.y;
        const dz = target.z - data.position.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const targetYaw = Math.atan2(dx, -dz);
        const relativeBearing = normalizeAngle(targetYaw - data.yaw);
        setBearing(toDegrees(relativeBearing));
        setDistance(dist);
      } else {
        setBearing(0);
        setDistance(0);
      }
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [target, compassRef]);

  const speedRatio = Math.min(1, Math.max(0, maxSpeed > 0 ? flightSpeed / maxSpeed : 0));

  const outerR = 105;
  const throttleR = 88;
  const speedArcRadius = 115;

  const ticks = useMemo(() => {
    const t: { deg: number; major: boolean }[] = [];
    for (let i = 0; i < 360; i += 10) {
      t.push({ deg: i, major: i % 30 === 0 });
    }
    return t;
  }, []);

  const throttleColor = throttle > 0.7 ? '#ef4444' : throttle > 0.35 ? '#fbbf24' : ZION_CYAN;
  const throttleCirc = 2 * Math.PI * throttleR;
  const speedCirc = 2 * Math.PI * speedArcRadius;
  const speedHalf = speedCirc / 2;

  const canApproach = !!landTarget;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.5 }}
      className="pointer-events-none fixed left-1/2 top-1/2 z-50 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
    >
      <div className="pointer-events-auto zion-hud-panel flex flex-col items-center p-3 sm:p-4">
        <div className="relative">
          <svg
            viewBox="-130 -130 260 260"
            className="h-44 w-44 sm:h-60 sm:w-60"
            style={{ overflow: 'visible' }}
          >
            <defs>
              <linearGradient id="shipHudSpeed" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={ZION_CYAN} />
                <stop offset="100%" stopColor={ZION_PURPLE} />
              </linearGradient>
            </defs>

            {/* Throttle ring (0..1) */}
            <circle
              r={throttleR}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={6}
            />
            <circle
              r={throttleR}
              fill="none"
              stroke={throttleColor}
              strokeWidth={6}
              strokeLinecap="round"
              strokeDasharray={`${throttleCirc * throttle} ${throttleCirc}`}
              transform="rotate(-90)"
            />

            {/* Compass face background */}
            <circle
              r={outerR}
              fill="none"
              stroke="rgba(255,255,255,0.15)"
              strokeWidth={1}
            />

            {/* Speed arc (bottom 180°) */}
            <circle
              r={speedArcRadius}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={8}
              strokeDasharray={`${speedHalf} ${speedCirc}`}
              transform="rotate(180)"
            />
            <circle
              r={speedArcRadius}
              fill="none"
              stroke="url(#shipHudSpeed)"
              strokeWidth={8}
              strokeLinecap="round"
              strokeDasharray={`${speedHalf} ${speedCirc}`}
              strokeDashoffset={speedHalf * (1 - speedRatio)}
              transform="rotate(180)"
            />

            {/* Compass rose (rotated by negative heading so N stays fixed at top) */}
            <g transform={`rotate(${-heading})`}>
              {ticks.map(({ deg, major }) => (
                <line
                  key={deg}
                  x1={0}
                  y1={-outerR}
                  x2={0}
                  y2={-outerR + (major ? 8 : 4)}
                  stroke={major ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)'}
                  strokeWidth={major ? 1.5 : 1}
                  transform={`rotate(${deg})`}
                />
              ))}

              <text
                x={0}
                y={-outerR - 6}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#ffffff"
                fontSize={12}
                fontWeight="bold"
                transform={`rotate(${heading}, 0, ${-outerR - 6})`}
              >
                N
              </text>
              <text
                x={outerR + 6}
                y={0}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#ffffff"
                fontSize={12}
                fontWeight="bold"
                transform={`rotate(${heading}, ${outerR + 6}, 0)`}
              >
                E
              </text>
              <text
                x={0}
                y={outerR + 6}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#ffffff"
                fontSize={12}
                fontWeight="bold"
                transform={`rotate(${heading}, 0, ${outerR + 6})`}
              >
                S
              </text>
              <text
                x={-outerR - 6}
                y={0}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#ffffff"
                fontSize={12}
                fontWeight="bold"
                transform={`rotate(${heading}, ${-outerR - 6}, 0)`}
              >
                W
              </text>
            </g>

            {/* Target needle */}
            <g transform={`rotate(${bearing})`}>
              <polygon
                points="0,-82 -6,-12 0,0 6,-12"
                fill={targetColor}
                opacity={0.92}
              />
              <circle cx={0} cy={-86} r={3} fill={targetColor} />
            </g>

            {/* Center crosshair */}
            <path
              d="M -9 0 L 9 0 M 0 -9 L 0 9"
              stroke="rgba(255,255,255,0.5)"
              strokeWidth={1}
            />
            <circle r={2} fill="rgba(255,255,255,0.9)" />

            {/* Heading readout */}
            <text
              x={0}
              y={22}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="rgba(255,255,255,0.7)"
              fontSize={10}
              fontFamily="monospace"
            >
              {heading}°
            </text>
          </svg>

          <button
            onClick={onExit}
            className="zion-button-ghost absolute -right-1 -top-1 !p-1.5"
            aria-label="Exit flight"
            title="Exit flight (F / ESC)"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mt-1 flex max-w-[180px] flex-col items-center text-center sm:max-w-[220px]">
          <p className="truncate text-sm font-semibold" style={{ color: targetColor }}>
            {targetName}
          </p>
          <p className="text-xs font-mono text-gray-400">
            {formatDistance(distance)} ly · {heading}°
          </p>
        </div>

        <div className="mt-2 flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/60 px-3 py-1.5">
          <div className="flex items-center gap-1.5 text-oasis-cyan">
            <Gauge className="h-4 w-4" />
            <span className="text-[10px] uppercase tracking-wider text-gray-400">SPD</span>
          </div>
          <div className="text-right">
            <span className="text-lg font-bold tabular-nums text-white">{flightSpeed.toFixed(1)}</span>
            <span className="ml-1 text-xs text-gray-500">/ {Math.round(maxSpeed)}</span>
          </div>
        </div>

        <div className="mt-3 w-full">
          <div className="mb-1.5 flex items-center justify-between text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Rocket className="h-3 w-3" /> Throttle
            </span>
            <span className="font-mono">{Math.round(throttle * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={throttle}
            onChange={(e) => onThrottleChange(Number(e.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-oasis-cyan"
          />
        </div>

        <div className="mt-3 grid w-full grid-cols-4 gap-2">
          <button
            onClick={() => onThrottleChange(0)}
            className="zion-button-ghost text-[10px]"
            title="Stop (1)"
          >
            STOP
          </button>
          <button
            onClick={() => onThrottleChange(0.5)}
            className="zion-button-ghost text-[10px]"
            title="Half throttle (2)"
          >
            ½
          </button>
          <button
            onClick={() => onThrottleChange(1)}
            className="zion-button-ghost text-[10px] text-oasis-cyan"
            title="Full throttle (3)"
          >
            FULL
          </button>
          {canApproach ? (
            <button
              onClick={() => landTarget && onApproach(landTarget)}
              className="rounded-xl border border-oasis-gold/30 bg-oasis-gold/10 px-1 py-1.5 text-[10px] font-bold text-oasis-gold transition hover:bg-oasis-gold/20 sm:text-xs"
              title="Approach target (L)"
            >
              <Target className="mx-auto h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              disabled
              className="rounded-xl border border-white/10 bg-black/40 px-1 py-1.5 text-[10px] font-bold text-gray-600 sm:text-xs"
            >
              <Navigation className="mx-auto h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="mt-2 hidden flex-wrap justify-center gap-x-3 gap-y-1 text-[10px] text-gray-500 sm:flex">
          <span>WASD · move</span>
          <span>Q/E · up/down</span>
          <span>Space · boost</span>
          <span>1/2/3 · throttle</span>
          <span>L · approach</span>
        </div>
      </div>
    </motion.div>
  );
}
