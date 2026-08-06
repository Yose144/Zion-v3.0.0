'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Globe, Wifi, WifiOff, ZoomIn, ZoomOut } from 'lucide-react';
import { usePolling } from '@/hooks/usePolling';
import { useLang } from '@/contexts/LanguageContext';

const NetworkMapCopy = {
  zionNetwork: { cs: `Síť ZION`, en: `ZION Network` },
  nodes: { cs: `uzlů`, en: `nodes` },
  zoomIn: { cs: `Přiblížit`, en: `Zoom in` },
  zoomOut: { cs: `Oddálit`, en: `Zoom out` },
  reset: { cs: `Resetovat`, en: `Reset` },
  height: { cs: `Výška`, en: `Height` },
  miners: { cs: `Mineři`, en: `Miners` },
  latency: { cs: `Latence`, en: `Latency` },
  online: { cs: `● Online`, en: `● Online` },
  offline: { cs: `● Offline`, en: `● Offline` },
  online_2: { cs: `Online`, en: `Online` },
  offline_2: { cs: `Offline`, en: `Offline` },
};

interface NodeStatus {
  id: string;
  name: string;
  host: string;
  region: string;
  lat: number;
  lon: number;
  online: boolean;
  height: number;
  hashrate: number;
  miners: number;
  peers?: number;
  rpcLatencyMs?: number;
  poolLatencyMs?: number;
  blockLag?: number;
}

interface NetworkStatus {
  nodes: NodeStatus[];
  summary: {
    online: number;
    total: number;
    inSync: boolean;
  };
}

interface NetworkMapProps {
  variant?: 'card' | 'hero';
  className?: string;
}

// World map coordinates (simplified Mercator projection)
const MAP_WIDTH = 800;
const MAP_HEIGHT = 400;

function latLonToXY(lat: number, lon: number): { x: number; y: number } {
  // Simple Mercator projection
  const x = ((lon + 180) / 360) * MAP_WIDTH;
  const latRad = (lat * Math.PI) / 180;
  const mercN = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
  const y = MAP_HEIGHT / 2 - (mercN * MAP_HEIGHT) / (2 * Math.PI);
  return { x, y };
}

function latencyColor(ms: number | undefined): string {
  if (ms == null) return '#f59e0b';
  if (ms < 50) return '#22c55e';
  if (ms < 200) return '#f59e0b';
  return '#ef4444';
}

export default function NetworkMap({ variant = 'card', className }: NetworkMapProps) {
  const { lang } = useLang();
  const cs = lang === 'cs';

  const [status, setStatus] = useState<NetworkStatus | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, px: 0, py: 0 });

  const isHero = variant === 'hero';
  const finalWrapper = [
    isHero
      ? 'pointer-events-none w-full h-full opacity-70'
      : 'relative zion-rainbow-card rounded-[32px] overflow-hidden',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  const svgClasses = isHero ? 'w-full h-full min-h-[320px]' : 'w-full h-auto min-h-[320px]';

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/network', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (e) {
      console.error('Failed to fetch network status:', e);
    }
  }, []);

  usePolling(fetchStatus, 30_000);

  /* ── Zoom / pan handlers ── */
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (isHero) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.max(0.5, Math.min(4, z * delta)));
  }, [isHero]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isHero) return;
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
  }, [isHero, pan.x, pan.y]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isHero) return;
    if (isPanning.current) {
      setPan({
        x: panStart.current.px + (e.clientX - panStart.current.x),
        y: panStart.current.py + (e.clientY - panStart.current.y),
      });
    }
  }, [isHero]);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  const handleZoomBtn = useCallback((delta: number) => {
    setZoom((z) => Math.max(0.5, Math.min(4, z * delta)));
  }, []);

  const handleReset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  /* ── Connection edges with latency colors ── */
  const onlineNodes = useMemo(() => status?.nodes.filter((n) => n.online) ?? [], [status]);
  const edges = useMemo(() => {
    const result: { x1: number; y1: number; x2: number; y2: number; latency: number; key: string }[] = [];
    for (let i = 0; i < onlineNodes.length; i++) {
      for (let j = i + 1; j < onlineNodes.length; j++) {
        const a = latLonToXY(onlineNodes[i].lat, onlineNodes[i].lon);
        const b = latLonToXY(onlineNodes[j].lat, onlineNodes[j].lon);
        const latency = Math.max(
          onlineNodes[i].rpcLatencyMs ?? 50,
          onlineNodes[j].rpcLatencyMs ?? 50
        );
        result.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, latency, key: `${onlineNodes[i].id}-${onlineNodes[j].id}` });
      }
    }
    return result;
  }, [onlineNodes]);

  if (!status) {
    return (
      <div className={`${finalWrapper} flex items-center justify-center`} style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
        <Globe className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className={finalWrapper} style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
      {!isHero && (
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-black/70 backdrop-blur px-3 py-2 rounded-2xl border border-purple-400/20">
          <Globe className="w-5 h-5 text-purple-400" />
          <span className="text-white font-semibold">{NetworkMapCopy.zionNetwork[cs ? 'cs' : 'en']}</span>
          <span className={`text-sm ${status.summary.inSync ? 'text-emerald-400' : 'text-yellow-400'}`}>
            {status.summary.online}/{status.summary.total} {NetworkMapCopy.nodes[cs ? 'cs' : 'en']}
          </span>
        </div>
      )}

      {/* Zoom controls */}
      {!isHero && (
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-1">
          <button
            onClick={() => handleZoomBtn(1.2)}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-black/60 border border-white/10 text-white hover:bg-purple-500/30 transition-colors"
            title={NetworkMapCopy.zoomIn[cs ? 'cs' : 'en']}
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleZoomBtn(0.83)}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-black/60 border border-white/10 text-white hover:bg-purple-500/30 transition-colors"
            title={NetworkMapCopy.zoomOut[cs ? 'cs' : 'en']}
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleReset}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-black/60 border border-white/10 text-white hover:bg-purple-500/30 transition-colors text-xs"
            title={NetworkMapCopy.reset[cs ? 'cs' : 'en']}
          >
            ⟲
          </button>
        </div>
      )}

      <svg
        ref={svgRef}
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        className={`${svgClasses} ${isHero ? '' : 'cursor-grab active:cursor-grabbing'}`}
        preserveAspectRatio="xMidYMid meet"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Background gradient */}
        <defs>
          <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#a855f7" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="nodeOffline" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#EF4444" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#EF4444" stopOpacity="0" />
          </radialGradient>
        </defs>

        <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
          {/* World outline (simplified) */}
          <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill={isHero ? 'rgba(3,7,18,0.75)' : '#050505'} />

          {/* Grid lines */}
          {[...Array(12)].map((_, i) => (
            <line
              key={`vline-${i}`}
              x1={(i + 1) * (MAP_WIDTH / 12)}
              y1={0}
              x2={(i + 1) * (MAP_WIDTH / 12)}
              y2={MAP_HEIGHT}
              stroke="#1a1a2e"
              strokeWidth="0.5"
            />
          ))}
          {[...Array(6)].map((_, i) => (
            <line
              key={`hline-${i}`}
              x1={0}
              y1={(i + 1) * (MAP_HEIGHT / 6)}
              x2={MAP_WIDTH}
              y2={(i + 1) * (MAP_HEIGHT / 6)}
              stroke="#1a1a2e"
              strokeWidth="0.5"
            />
          ))}

          {/* Connection lines between online nodes — colored by latency */}
          {edges.map((edge) => (
            <motion.line
              key={edge.key}
              x1={edge.x1}
              y1={edge.y1}
              x2={edge.x2}
              y2={edge.y2}
              stroke={latencyColor(edge.latency)}
              strokeWidth="1.5"
              strokeOpacity="0.4"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.4 }}
              transition={{ duration: 1.5, ease: 'easeOut' }}
            />
          ))}

          {/* Nodes */}
          {status.nodes.map((node) => {
            const pos = latLonToXY(node.lat, node.lon);
            const isHovered = hoveredNode === node.id;

            return (
              <g
                key={node.id}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                style={{ cursor: isHero ? 'default' : 'pointer' }}
              >
                {/* Glow effect */}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={isHovered ? 30 : 20}
                  fill={node.online ? 'url(#nodeGlow)' : 'url(#nodeOffline)'}
                  opacity={0.5}
                />

                {/* Pulse animation for online nodes */}
                {node.online && (
                  <motion.circle
                    cx={pos.x}
                    cy={pos.y}
                    r={8}
                    fill="none"
                    stroke="#a855f7"
                    strokeWidth="1"
                    initial={{ r: 8, opacity: 1 }}
                    animate={{ r: 25, opacity: 0 }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'easeOut',
                    }}
                  />
                )}

                {/* Node dot */}
                <motion.circle
                  cx={pos.x}
                  cy={pos.y}
                  r={isHovered ? 8 : 6}
                  fill={node.online ? '#a855f7' : '#EF4444'}
                  stroke={node.online ? '#FFF' : '#FCA5A5'}
                  strokeWidth="2"
                  animate={{ scale: isHero ? 1 : isHovered ? 1.2 : 1 }}
                />

                {!isHero && (
                  <text
                    x={pos.x}
                    y={pos.y + 20}
                    textAnchor="middle"
                    fill="#9CA3AF"
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    {node.name}
                  </text>
                )}

                {!isHero && isHovered && (
                  <g>
                    <rect
                      x={pos.x + 15}
                      y={pos.y - 50}
                      width="140"
                      height="85"
                      rx="6"
                      fill="#1F2937"
                      stroke="#a855f7"
                      strokeOpacity="0.3"
                    />
                    <text x={pos.x + 25} y={pos.y - 32} fill="#FFF" fontSize="11" fontWeight="bold">
                      {node.name}
                    </text>
                    <text x={pos.x + 25} y={pos.y - 18} fill="#9CA3AF" fontSize="9">
                      {NetworkMapCopy.height[cs ? 'cs' : 'en']}: {node.height ? node.height.toLocaleString() : '—'}
                    </text>
                    <text x={pos.x + 25} y={pos.y - 6} fill="#9CA3AF" fontSize="9">
                      {NetworkMapCopy.miners[cs ? 'cs' : 'en']}: {node.miners}
                    </text>
                    <text x={pos.x + 25} y={pos.y + 6} fill="#9CA3AF" fontSize="9">
                      {NetworkMapCopy.latency[cs ? 'cs' : 'en']}: {node.rpcLatencyMs != null ? `${node.rpcLatencyMs}ms` : '—'}
                    </text>
                    <text x={pos.x + 25} y={pos.y + 20} fill={node.online ? '#22C55E' : '#EF4444'} fontSize="9">
                      {node.online ? (NetworkMapCopy.online[cs ? 'cs' : 'en']) : (NetworkMapCopy.offline[cs ? 'cs' : 'en'])}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {!isHero && (
        <div className="absolute bottom-4 right-4 flex items-center gap-4 bg-black/70 backdrop-blur px-3 py-2 rounded-2xl border border-purple-400/20 text-sm">
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4 text-emerald-400" />
            <span className="text-gray-400">{NetworkMapCopy.online_2[cs ? 'cs' : 'en']}</span>
          </div>
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-red-400" />
            <span className="text-gray-400">{NetworkMapCopy.offline_2[cs ? 'cs' : 'en']}</span>
          </div>
          <div className="flex items-center gap-2 border-l border-white/10 pl-3">
            <div className="w-3 h-0.5 bg-emerald-500" />
            <span className="text-gray-400 text-xs">&lt;50ms</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-amber-500" />
            <span className="text-gray-400 text-xs">&lt;200ms</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-red-500" />
            <span className="text-gray-400 text-xs">&gt;200ms</span>
          </div>
        </div>
      )}
    </div>
  );
}
