'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Gauge, Target, Navigation, Rocket, Zap, Package, ScanLine,
  Power, Orbit, Sparkles, Radar, Fuel, Settings, ChevronUp, ChevronDown,
  Crosshair, ArrowUp,
} from 'lucide-react';
import type { CompassData } from './Compass';
import type { World } from '../domain/types/world';
import { useGameStore, type ShipLoadout } from '../store/gameStore';
import { useToastStore } from '../store/toastStore';

const ZION_CYAN = '#06b6d4';
const ZION_PURPLE = '#9333ea';
const ZION_GOLD = '#fbbf24';

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

export interface ControlHudProps {
  compassRef: React.RefObject<CompassData | null>;
  target: { x: number; y: number; z: number } | null;
  targetName: string;
  targetColor: string;
  flightMode: boolean;
  flightSpeed: number;
  maxSpeed: number;
  throttle: number;
  onThrottleChange: (v: number) => void;
  landTarget: World | null;
  onApproach: (world: World) => void;
  onExitFlight: () => void;
  onEnterFlight?: () => void;
  onWarp?: () => void;
  warping?: boolean;
}

type PanelMode = 'compact' | 'expanded';

export default function ControlHud({
  compassRef,
  target,
  targetName,
  targetColor,
  flightMode,
  flightSpeed,
  maxSpeed,
  throttle,
  onThrottleChange,
  landTarget,
  onApproach,
  onExitFlight,
  onEnterFlight,
  onWarp,
  warping = false,
}: ControlHudProps) {
  const { shipLoadout, credits } = useGameStore();
  const addToast = useToastStore((s) => s.add);
  const [heading, setHeading] = useState(0);
  const [bearing, setBearing] = useState(0);
  const [distance, setDistance] = useState(0);
  const [mode, setMode] = useState<PanelMode>('compact');
  const [warpCharge, setWarpCharge] = useState(0);
  const [warpReady, setWarpReady] = useState(false);

  // Compass tracking loop
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

  // Warp charge animation
  useEffect(() => {
    if (warping) {
      setWarpCharge(0);
      setWarpReady(false);
      let v = 0;
      const i = setInterval(() => {
        v += 0.08;
        if (v >= 1) {
          v = 1;
          setWarpReady(true);
          clearInterval(i);
        }
        setWarpCharge(v);
      }, 40);
      return () => clearInterval(i);
    } else {
      setWarpCharge(0);
      setWarpReady(false);
    }
  }, [warping]);

  const speedRatio = Math.min(1, Math.max(0, maxSpeed > 0 ? flightSpeed / maxSpeed : 0));

  const outerR = 78;
  const throttleR = 64;
  const speedArcRadius = 88;

  const ticks = useMemo(() => {
    const t: { deg: number; major: boolean }[] = [];
    for (let i = 0; i < 360; i += 10) {
      t.push({ deg: i, major: i % 30 === 0 });
    }
    return t;
  }, []);

  const throttleColor = throttle > 0.7 ? '#ef4444' : throttle > 0.35 ? ZION_GOLD : ZION_CYAN;
  const throttleCirc = 2 * Math.PI * throttleR;
  const speedCirc = 2 * Math.PI * speedArcRadius;
  const speedHalf = speedCirc / 2;

  const canApproach = !!landTarget;
  const canWarp = flightMode && distance > 5 && !warping;

  const handleWarp = useCallback(() => {
    if (!canWarp) return;
    onWarp?.();
    addToast('Warp drive engaged', 'info', 2000);
  }, [canWarp, onWarp, addToast]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="pointer-events-auto absolute bottom-4 left-1/2 z-40 flex -translate-x-1/2 flex-col items-center"
    >
      <div className="flex items-end gap-2">
        {/* ── Left wing: Ship status ── */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="zion-hud-panel !relative hidden flex-col gap-2 p-2.5 sm:flex"
          style={{ width: mode === 'expanded' ? '12rem' : '9rem' }}
        >
          <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-oasis-cyan">
            <Rocket className="h-3 w-3" />
            <span>Ship Status</span>
          </div>

          {/* Ship modules mini-grid */}
          <div className="grid grid-cols-3 gap-1">
            <div className="rounded-lg border border-oasis-cyan/20 bg-oasis-cyan/5 p-1 text-center" title="Boost">
              <Zap className="mx-auto h-3 w-3 text-oasis-cyan" />
              <p className="text-[9px] font-bold text-white">{shipLoadout.boost}</p>
            </div>
            <div className="rounded-lg border border-oasis-gold/20 bg-oasis-gold/5 p-1 text-center" title="Cargo">
              <Package className="mx-auto h-3 w-3 text-oasis-gold" />
              <p className="text-[9px] font-bold text-white">{shipLoadout.cargo}</p>
            </div>
            <div className="rounded-lg border border-oasis-purple/20 bg-oasis-purple/5 p-1 text-center" title="Scanner">
              <ScanLine className="mx-auto h-3 w-3 text-oasis-purple" />
              <p className="text-[9px] font-bold text-white">{shipLoadout.scanner}</p>
            </div>
          </div>

          {/* Hull color indicator */}
          <div className="flex items-center gap-1.5 rounded-lg border border-white/5 bg-white/[0.03] px-2 py-1">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: shipLoadout.color, boxShadow: `0 0 8px ${shipLoadout.color}` }} />
            <span className="text-[9px] text-gray-400">Hull</span>
          </div>

          {/* Credits */}
          <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.03] px-2 py-1">
            <span className="flex items-center gap-1 text-[9px] text-gray-400">
              <Fuel className="h-2.5 w-2.5" />
              Fuel
            </span>
            <span className="font-mono text-[10px] font-bold text-oasis-gold">{credits} Z</span>
          </div>

          {mode === 'expanded' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-1.5 border-t border-white/5 pt-2"
            >
              <p className="text-[8px] font-bold uppercase tracking-wider text-gray-500">Quick Tune</p>
              {(['boost', 'cargo', 'scanner'] as (keyof ShipLoadout)[]).map((k) => {
                const lvl = shipLoadout[k] as number;
                return (
                  <div key={k} className="flex items-center justify-between text-[9px]">
                    <span className="capitalize text-gray-400">{k}</span>
                    <div className="flex items-center gap-1">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <span
                            key={n}
                            className={`h-1 w-2 rounded-sm ${n <= lvl ? 'bg-oasis-cyan' : 'bg-white/10'}`}
                          />
                        ))}
                      </div>
                      <span className="font-mono text-white">L{lvl}</span>
                    </div>
                  </div>
                );
              })}
            </motion.div>
          )}
        </motion.div>

        {/* ── Center: Compass + target ── */}
        <div className="flex flex-col items-center">
          <div className="relative">
            <svg
              viewBox="-110 -110 220 220"
              className="h-36 w-36 sm:h-44 sm:w-44"
              style={{ overflow: 'visible' }}
            >
              <defs>
                <linearGradient id="ctrlHudSpeed" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={ZION_CYAN} />
                  <stop offset="100%" stopColor={ZION_PURPLE} />
                </linearGradient>
                <linearGradient id="ctrlHudWarp" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={ZION_GOLD} />
                  <stop offset="50%" stopColor={ZION_PURPLE} />
                  <stop offset="100%" stopColor={ZION_CYAN} />
                </linearGradient>
                <radialGradient id="ctrlHudGlow" cx="0.5" cy="0.5" r="0.5">
                  <stop offset="0%" stopColor="rgba(6, 182, 212, 0.15)" />
                  <stop offset="100%" stopColor="rgba(6, 182, 212, 0)" />
                </radialGradient>
              </defs>

              {/* Background glow */}
              <circle r={100} fill="url(#ctrlHudGlow)" />

              {/* Warp charge ring (outer, only when warping) */}
              {warping && (
                <>
                  <circle
                    r={95}
                    fill="none"
                    stroke="rgba(255,255,255,0.05)"
                    strokeWidth={3}
                  />
                  <circle
                    r={95}
                    fill="none"
                    stroke="url(#ctrlHudWarp)"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 95 * warpCharge} ${2 * Math.PI * 95}`}
                    transform="rotate(-90)"
                    style={{ filter: 'drop-shadow(0 0 6px rgba(168, 85, 247, 0.6))' }}
                  />
                </>
              )}

              {/* Speed arc (bottom 180°) — only in flight mode */}
              {flightMode && (
                <>
                  <circle
                    r={speedArcRadius}
                    fill="none"
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth={6}
                    strokeDasharray={`${speedHalf} ${speedCirc}`}
                    transform="rotate(180)"
                  />
                  <circle
                    r={speedArcRadius}
                    fill="none"
                    stroke="url(#ctrlHudSpeed)"
                    strokeWidth={6}
                    strokeLinecap="round"
                    strokeDasharray={`${speedHalf} ${speedCirc}`}
                    strokeDashoffset={speedHalf * (1 - speedRatio)}
                    transform="rotate(180)"
                  />
                </>
              )}

              {/* Throttle ring (only in flight mode) */}
              {flightMode && (
                <>
                  <circle
                    r={throttleR}
                    fill="none"
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth={4}
                  />
                  <circle
                    r={throttleR}
                    fill="none"
                    stroke={throttleColor}
                    strokeWidth={4}
                    strokeLinecap="round"
                    strokeDasharray={`${throttleCirc * throttle} ${throttleCirc}`}
                    transform="rotate(-90)"
                  />
                </>
              )}

              {/* Compass face */}
              <circle
                r={outerR}
                fill="rgba(5, 7, 10, 0.6)"
                stroke="rgba(255,255,255,0.15)"
                strokeWidth={1}
              />

              {/* Compass rose */}
              <g transform={`rotate(${-heading})`}>
                {ticks.map(({ deg, major }) => (
                  <line
                    key={deg}
                    x1={0}
                    y1={-outerR}
                    x2={0}
                    y2={-outerR + (major ? 7 : 3)}
                    stroke={major ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)'}
                    strokeWidth={major ? 1.5 : 1}
                    transform={`rotate(${deg})`}
                  />
                ))}

                <text x={0} y={-outerR - 4} textAnchor="middle" dominantBaseline="middle" fill="#ffffff" fontSize={11} fontWeight="bold" transform={`rotate(${heading}, 0, ${-outerR - 4})`}>N</text>
                <text x={outerR + 4} y={0} textAnchor="middle" dominantBaseline="middle" fill="#ffffff" fontSize={11} fontWeight="bold" transform={`rotate(${heading}, ${outerR + 4}, 0)`}>E</text>
                <text x={0} y={outerR + 4} textAnchor="middle" dominantBaseline="middle" fill="#ffffff" fontSize={11} fontWeight="bold" transform={`rotate(${heading}, 0, ${outerR + 4})`}>S</text>
                <text x={-outerR - 4} y={0} textAnchor="middle" dominantBaseline="middle" fill="#ffffff" fontSize={11} fontWeight="bold" transform={`rotate(${heading}, ${-outerR - 4}, 0)`}>W</text>
              </g>

              {/* Target needle */}
              <g transform={`rotate(${bearing})`}>
                <polygon points="0,-60 -5,-8 0,0 5,-8" fill={targetColor} opacity={0.92} />
                <circle cx={0} cy={-64} r={3} fill={targetColor} />
              </g>

              {/* Center crosshair */}
              <path d="M -7 0 L 7 0 M 0 -7 L 0 7" stroke="rgba(255,255,255,0.5)" strokeWidth={1} />
              <circle r={2} fill="rgba(255,255,255,0.9)" />

              {/* Heading readout */}
              <text x={0} y={18} textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.7)" fontSize={9} fontFamily="monospace">{heading}°</text>
            </svg>

            {/* Exit flight button */}
            {flightMode && (
              <button
                onClick={onExitFlight}
                className="zion-button-ghost absolute -right-1 -top-1 !p-1.5"
                aria-label="Exit flight"
                title="Exit flight (F / ESC)"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Target info below compass */}
          <div className="mt-1.5 zion-hud-panel !relative px-3 py-1.5 text-center">
            <p className="max-w-[160px] truncate text-xs font-semibold" style={{ color: targetColor }}>
              {targetName}
            </p>
            <p className="text-[10px] font-mono text-gray-400">
              {formatDistance(distance)} ly · {heading}°
            </p>
          </div>
        </div>

        {/* ── Right wing: Controls + Warp ── */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="zion-hud-panel !relative hidden flex-col gap-2 p-2.5 sm:flex"
          style={{ width: mode === 'expanded' ? '12rem' : '9rem' }}
        >
          <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-oasis-gold">
            <Orbit className="h-3 w-3" />
            <span>Navigation</span>
          </div>

          {/* Speed gauge (flight mode) */}
          {flightMode ? (
            <div className="rounded-lg border border-white/5 bg-white/[0.03] px-2 py-1.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-[9px] text-gray-400">
                  <Gauge className="h-3 w-3 text-oasis-cyan" />
                  SPD
                </span>
                <div className="text-right">
                  <span className="text-sm font-bold tabular-nums text-white">{flightSpeed.toFixed(1)}</span>
                  <span className="ml-0.5 text-[9px] text-gray-500">/{Math.round(maxSpeed)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-white/5 bg-white/[0.03] px-2 py-1.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-[9px] text-gray-400">
                  <Radar className="h-3 w-3 text-oasis-purple" />
                  Scan
                </span>
                <span className="text-[9px] text-gray-500">Idle</span>
              </div>
            </div>
          )}

          {/* Throttle slider (flight mode) */}
          {flightMode && (
            <div>
              <div className="mb-1 flex items-center justify-between text-[9px] text-gray-400">
                <span className="flex items-center gap-1">
                  <Rocket className="h-2.5 w-2.5" /> Throttle
                </span>
                <span className="font-mono">{Math.round(throttle * 100)}%</span>
              </div>
              <input
                type="range" min={0} max={1} step={0.05}
                value={throttle}
                onChange={(e) => onThrottleChange(Number(e.target.value))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-oasis-cyan"
              />
              <div className="mt-1 grid grid-cols-3 gap-1">
                <button onClick={() => onThrottleChange(0)} className="zion-button-ghost !py-1 text-[8px]" title="Stop (1)">STOP</button>
                <button onClick={() => onThrottleChange(0.5)} className="zion-button-ghost !py-1 text-[8px]" title="Half (2)">½</button>
                <button onClick={() => onThrottleChange(1)} className="zion-button-ghost !py-1 text-[8px] text-oasis-cyan" title="Full (3)">FULL</button>
              </div>
            </div>
          )}

          {/* Warp drive button */}
          <button
            onClick={handleWarp}
            disabled={!canWarp}
            className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[10px] font-bold transition ${
              warping
                ? 'border-oasis-purple/40 bg-oasis-purple/20 text-oasis-purple'
                : canWarp
                ? 'border-oasis-gold/30 bg-oasis-gold/10 text-oasis-gold hover:bg-oasis-gold/20'
                : 'border-white/10 bg-black/40 text-gray-600'
            }`}
            title={canWarp ? 'Warp to target' : 'Warp unavailable'}
          >
            {warping ? (
              <>
                <Sparkles className="h-3 w-3 animate-pulse" />
                {warpReady ? 'JUMP!' : `${Math.round(warpCharge * 100)}%`}
              </>
            ) : (
              <>
                <Power className="h-3 w-3" />
                WARP
              </>
            )}
          </button>

          {/* Approach / land button */}
          {flightMode ? (
            canApproach ? (
              <button
                onClick={() => landTarget && onApproach(landTarget)}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-oasis-emerald/30 bg-oasis-emerald/10 px-2 py-1.5 text-[10px] font-bold text-oasis-emerald transition hover:bg-oasis-emerald/20"
                title="Approach target (L)"
              >
                <Target className="h-3 w-3" />
                LAND
              </button>
            ) : (
              <button
                disabled
                className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-[10px] font-bold text-gray-600"
              >
                <Navigation className="h-3 w-3" />
                LAND
              </button>
            )
          ) : onEnterFlight ? (
            <button
              onClick={onEnterFlight}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-oasis-cyan/30 bg-oasis-cyan/10 px-2 py-1.5 text-[10px] font-bold text-oasis-cyan transition hover:bg-oasis-cyan/20"
              title="Enter flight mode (F)"
            >
              <Rocket className="h-3 w-3" />
              FLY
            </button>
          ) : null}

          {/* Expanded: keyboard hints */}
          {mode === 'expanded' && flightMode && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-0.5 border-t border-white/5 pt-1.5 text-[8px] text-gray-500"
            >
              <div className="flex justify-between"><span>WASD</span><span>move</span></div>
              <div className="flex justify-between"><span>Q/E</span><span>up/down</span></div>
              <div className="flex justify-between"><span>Space</span><span>boost</span></div>
              <div className="flex justify-between"><span>1/2/3</span><span>throttle</span></div>
              <div className="flex justify-between"><span>L</span><span>land</span></div>
              <div className="flex justify-between"><span>F</span><span>exit</span></div>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Expand/collapse toggle */}
      <button
        onClick={() => setMode((m) => (m === 'compact' ? 'expanded' : 'compact'))}
        className="mt-2 flex items-center gap-1 rounded-full border border-white/10 bg-black/60 px-3 py-1 text-[9px] font-semibold text-gray-400 backdrop-blur-md transition hover:bg-white/10 hover:text-white"
      >
        <Settings className="h-3 w-3" />
        {mode === 'expanded' ? 'Collapse' : 'Expand'}
        {mode === 'expanded' ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
      </button>
    </motion.div>
  );
}
