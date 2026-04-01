'use client';

import { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Globe, Wifi, WifiOff } from 'lucide-react';
import { usePolling } from '@/hooks/usePolling';

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

export default function NetworkMap({ variant = 'card', className }: NetworkMapProps) {
  const [status, setStatus] = useState<NetworkStatus | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const isHero = variant === 'hero';
  const wrapperClasses = [
    isHero
      ? 'pointer-events-none w-full h-full opacity-70'
      : 'relative rounded-[32px] border border-white/10 bg-black/50 backdrop-blur-xl overflow-hidden',
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

  if (!status) {
    return (
      <div className={`${wrapperClasses} flex items-center justify-center`}>
        <Globe className="w-8 h-8 animate-spin text-zion-gold" />
      </div>
    );
  }

  return (
    <div className={wrapperClasses}>
      {!isHero && (
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-black/70 backdrop-blur px-3 py-2 rounded-2xl border border-white/10">
          <Globe className="w-5 h-5 text-zion-gold" />
          <span className="text-white font-semibold">ZION Network</span>
          <span className={`text-sm ${status.summary.inSync ? 'text-emerald-400' : 'text-yellow-400'}`}>
            {status.summary.online}/{status.summary.total} nodes
          </span>
        </div>
      )}

      <svg
        ref={svgRef}
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        className={svgClasses}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Background gradient */}
        <defs>
          <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="nodeOffline" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#EF4444" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#EF4444" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="connectionLine" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.1" />
            <stop offset="50%" stopColor="#D4AF37" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#D4AF37" stopOpacity="0.1" />
          </linearGradient>
        </defs>

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

        {/* Connection lines between online nodes */}
        {status.nodes
          .filter(n => n.online)
          .map((node, i, arr) => {
            const pos = latLonToXY(node.lat, node.lon);
            return arr.slice(i + 1).map(other => {
              const otherPos = latLonToXY(other.lat, other.lon);
              return (
                <motion.line
                  key={`${node.id}-${other.id}`}
                  x1={pos.x}
                  y1={pos.y}
                  x2={otherPos.x}
                  y2={otherPos.y}
                  stroke="url(#connectionLine)"
                  strokeWidth="1"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                />
              );
            });
          })}

        {/* Nodes */}
        {status.nodes.map(node => {
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
                  stroke="#D4AF37"
                  strokeWidth="1"
                  initial={{ r: 8, opacity: 1 }}
                  animate={{ r: 25, opacity: 0 }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeOut"
                  }}
                />
              )}

              {/* Node dot */}
              <motion.circle
                cx={pos.x}
                cy={pos.y}
                r={isHovered ? 8 : 6}
                fill={node.online ? '#D4AF37' : '#EF4444'}
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
                    y={pos.y - 40}
                    width="120"
                    height="70"
                    rx="4"
                    fill="#1F2937"
                    stroke="#374151"
                  />
                  <text x={pos.x + 25} y={pos.y - 22} fill="#FFF" fontSize="11" fontWeight="bold">
                    {node.name}
                  </text>
                  <text x={pos.x + 25} y={pos.y - 8} fill="#9CA3AF" fontSize="9">
                    Height: {node.height ? node.height.toLocaleString() : '—'}
                  </text>
                  <text x={pos.x + 25} y={pos.y + 6} fill="#9CA3AF" fontSize="9">
                    Miners: {node.miners}
                  </text>
                  <text x={pos.x + 25} y={pos.y + 20} fill={node.online ? '#22C55E' : '#EF4444'} fontSize="9">
                    {node.online ? '● Online' : '● Offline'}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {!isHero && (
        <div className="absolute bottom-4 right-4 flex items-center gap-4 bg-black/70 backdrop-blur px-3 py-2 rounded-2xl border border-white/10 text-sm">
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4 text-emerald-400" />
            <span className="text-gray-400">Online</span>
          </div>
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-red-400" />
            <span className="text-gray-400">Offline</span>
          </div>
        </div>
      )}
    </div>
  );
}
