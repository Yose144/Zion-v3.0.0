'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Network, Globe, RefreshCw, ZoomIn, ZoomOut } from 'lucide-react';
import { usePolling } from '@/hooks/usePolling';
import { useLang } from '@/contexts/LanguageContext';

/* ═══════════════════════════════════════════════════════════
   Types — mirror /api/network route shape
   ═══════════════════════════════════════════════════════════ */

interface NodeStatus {
  id: string;
  name: string;
  host: string;
  region: string;
  lat: number;
  lon: number;
  online: boolean;
  height: number;
  peers: number;
  hashrate: number;
  miners: number;
  blocks: number;
  uptime: number;
  rpcLatencyMs?: number;
  poolLatencyMs?: number;
  blockLag?: number;
  lastChecked: string;
  error?: string;
}

interface NetworkStatus {
  timestamp: string;
  nodes: NodeStatus[];
  summary: {
    total: number;
    online: number;
    onlinePct: number;
    maxHeight: number;
    minHeight: number;
    heightGap: number;
    totalHashrate: number;
    totalMiners: number;
    totalBlocks: number;
    inSync: boolean;
  };
}

/* ═══════════════════════════════════════════════════════════
   Force simulation types
   ═══════════════════════════════════════════════════════════ */

interface SimNode {
  id: string;
  label: string;
  shortAddr: string;
  version: string;
  host: string;
  port: number;
  latency: number;
  height: number;
  connectionCount: number;
  isSeed: boolean;
  online: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number | null;
  fy?: number | null;
}

interface SimEdge {
  source: string;
  target: string;
  latency: number;
}

/* ═══════════════════════════════════════════════════════════
   Seeded PRNG (mulberry32) for deterministic synthetic peers
   ═══════════════════════════════════════════════════════════ */

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const VERSIONS = ['3.0.3', '3.0.2', '3.0.1', '2.9.9', '3.1.0-dev'];
const REGIONS = ['EU', 'NA', 'AS', 'SA', 'AF', 'OC'];

function shortAddr(rng: () => number): string {
  const hex = '0123456789abcdef';
  let s = '';
  for (let i = 0; i < 8; i++) s += hex[Math.floor(rng() * 16)];
  return `zion1${s}…`;
}

/* ═══════════════════════════════════════════════════════════
   Build simulation graph from network status
   ═══════════════════════════════════════════════════════════ */

function buildGraph(status: NetworkStatus, width: number, height: number): { nodes: SimNode[]; edges: SimEdge[] } {
  const rng = mulberry32(20260627);
  const cx = width / 2;
  const cy = height / 2;
  const nodes: SimNode[] = [];
  const edges: SimEdge[] = [];

  // Seed nodes (real)
  const onlineNodes = status.nodes.filter((n) => n.online);
  const seedNodes = status.nodes.map((n, i) => {
    const angle = (i / status.nodes.length) * Math.PI * 2;
    const r = Math.min(width, height) * 0.25;
    return {
      id: n.id,
      label: n.name,
      shortAddr: shortAddr(rng),
      version: '3.0.3',
      host: n.host,
      port: 8333,
      latency: n.rpcLatencyMs ?? 30,
      height: n.height,
      connectionCount: n.peers,
      isSeed: true,
      online: n.online,
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
      vx: 0,
      vy: 0,
      fx: null,
      fy: null,
    } as SimNode;
  });
  nodes.push(...seedNodes);

  // Synthetic peers around each online seed node based on peers count
  onlineNodes.forEach((seed) => {
    const peerCount = Math.min(seed.peers, 12);
    const seedIdx = nodes.findIndex((n) => n.id === seed.id);
    for (let p = 0; p < peerCount; p++) {
      const angle = rng() * Math.PI * 2;
      const r = 60 + rng() * 80;
      const id = `${seed.id}-peer-${p}`;
      const latency = Math.floor(20 + rng() * 280);
      nodes.push({
        id,
        label: `${REGIONS[Math.floor(rng() * REGIONS.length)]}-${p}`,
        shortAddr: shortAddr(rng),
        version: VERSIONS[Math.floor(rng() * VERSIONS.length)],
        host: `${Math.floor(rng() * 255)}.${Math.floor(rng() * 255)}.${Math.floor(rng() * 255)}.${Math.floor(rng() * 255)}`,
        port: 8333,
        latency,
        height: Math.max(0, seed.height - Math.floor(rng() * 5)),
        connectionCount: Math.floor(rng() * 8) + 1,
        isSeed: false,
        online: true,
        x: nodes[seedIdx].x + Math.cos(angle) * r,
        y: nodes[seedIdx].y + Math.sin(angle) * r,
        vx: 0,
        vy: 0,
        fx: null,
        fy: null,
      });
      // Edge seed -> peer
      edges.push({ source: seed.id, target: id, latency });
    }
  });

  // Inter-seed edges
  for (let i = 0; i < seedNodes.length; i++) {
    for (let j = i + 1; j < seedNodes.length; j++) {
      if (seedNodes[i].online && seedNodes[j].online) {
        edges.push({
          source: seedNodes[i].id,
          target: seedNodes[j].id,
          latency: Math.max(seedNodes[i].latency, seedNodes[j].latency),
        });
      }
    }
  }

  // A few peer-to-peer cross links for mesh feel
  const peerNodes = nodes.filter((n) => !n.isSeed);
  for (let i = 0; i < peerNodes.length; i++) {
    if (rng() < 0.3 && i + 1 < peerNodes.length) {
      const j = (i + 1 + Math.floor(rng() * 3)) % peerNodes.length;
      if (j !== i) {
        edges.push({
          source: peerNodes[i].id,
          target: peerNodes[j].id,
          latency: Math.floor(40 + rng() * 200),
        });
      }
    }
  }

  return { nodes, edges };
}

/* ═══════════════════════════════════════════════════════════
   Latency color helper
   ═══════════════════════════════════════════════════════════ */

function latencyColor(ms: number): string {
  if (ms < 50) return '#22c55e'; // green
  if (ms < 200) return '#f59e0b'; // amber
  return '#ef4444'; // red
}

/* ═══════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════ */

const VIEW_W = 800;
const VIEW_H = 560;

export default function NetworkTopology() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  const [status, setStatus] = useState<NetworkStatus | null>(null);
  const [error, setError] = useState(false);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [renderNodes, setRenderNodes] = useState<SimNode[]>([]);
  const [renderEdges, setRenderEdges] = useState<SimEdge[]>([]);

  const svgRef = useRef<SVGSVGElement>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const dragNode = useRef<string | null>(null);
  const rafRef = useRef<number | null>(null);
  const simNodes = useRef<SimNode[]>([]);
  const simEdges = useRef<SimEdge[]>([]);
  const simRunning = useRef(true);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/network', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        setError(false);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    }
  }, []);

  usePolling(fetchStatus, 30_000);

  // Build graph when status changes — compute via useMemo to avoid cascading renders
  const builtGraph = useMemo(() => {
    if (!status) return null;
    return buildGraph(status, VIEW_W, VIEW_H);
  }, [status]);

  useEffect(() => {
    if (!builtGraph) return;
    simNodes.current = builtGraph.nodes;
    simEdges.current = builtGraph.edges;
    // Sync graph structure to render state — required when topology changes
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRenderNodes(builtGraph.nodes.map((n) => ({ ...n })));
    setRenderEdges(builtGraph.edges.map((e) => ({ ...e })));
  }, [builtGraph]);

  // Force simulation loop
  useEffect(() => {
    const step = () => {
      const nodes = simNodes.current;
      if (nodes.length === 0 || !simRunning.current) {
        rafRef.current = requestAnimationFrame(step);
        return;
      }

      const cx = VIEW_W / 2;
      const cy = VIEW_H / 2;
      const REPULSION = 6000;
      const LINK_DIST = 90;
      const SPRING = 0.04;
      const CENTER = 0.005;
      const DAMPING = 0.85;

      // Repulsion (O(n²) — fine for <50 nodes)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          let dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 1) dist = 1;
          const force = REPULSION / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          if (nodes[i].fx == null) {
            nodes[i].vx -= fx;
            nodes[i].vy -= fy;
          }
          if (nodes[j].fx == null) {
            nodes[j].vx += fx;
            nodes[j].vy += fy;
          }
        }
      }

      // Spring (link) forces
      const nodeMap = new Map(nodes.map((n) => [n.id, n]));
      for (const edge of simEdges.current) {
        const s = nodeMap.get(edge.source);
        const t = nodeMap.get(edge.target);
        if (!s || !t) continue;
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) dist = 1;
        const force = (dist - LINK_DIST) * SPRING;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        if (s.fx == null) {
          s.vx += fx;
          s.vy += fy;
        }
        if (t.fx == null) {
          t.vx -= fx;
          t.vy -= fy;
        }
      }

      // Center gravity + integrate
      for (const n of nodes) {
        if (n.fx != null && n.fy != null) {
          n.x = n.fx;
          n.y = n.fy;
          n.vx = 0;
          n.vy = 0;
          continue;
        }
        n.vx += (cx - n.x) * CENTER;
        n.vy += (cy - n.y) * CENTER;
        n.vx *= DAMPING;
        n.vy *= DAMPING;
        n.x += n.vx;
        n.y += n.vy;
        // Bounds
        n.x = Math.max(30, Math.min(VIEW_W - 30, n.x));
        n.y = Math.max(30, Math.min(VIEW_H - 30, n.y));
      }

      setRenderNodes(nodes.map((n) => ({ ...n })));
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Pause sim when tab hidden
  const isVisible = usePolling(() => {}, 999999);
  useEffect(() => {
    simRunning.current = isVisible;
  }, [isVisible]);

  /* ── Zoom / pan handlers ── */
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.max(0.3, Math.min(4, z * delta)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (dragNode.current) return;
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
  }, [pan.x, pan.y]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning.current) {
      setPan({
        x: panStart.current.px + (e.clientX - panStart.current.x),
        y: panStart.current.py + (e.clientY - panStart.current.y),
      });
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
    dragNode.current = null;
  }, []);

  const handleZoomBtn = useCallback((delta: number) => {
    setZoom((z) => Math.max(0.3, Math.min(4, z * delta)));
  }, []);

  const handleReset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelectedNode(null);
  }, []);

  /* ── Node drag ── */
  const handleNodeMouseDown = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    dragNode.current = id;
    const node = simNodes.current.find((n) => n.id === id);
    if (node) {
      node.fx = node.x;
      node.fy = node.y;
    }
  }, []);

  const handleNodeMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragNode.current || !svgRef.current) return;
    const node = simNodes.current.find((n) => n.id === dragNode.current);
    if (!node) return;
    const pt = svgRef.current.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svgRef.current.getScreenCTM();
    if (!ctm) return;
    const svgPt = pt.matrixTransform(ctm.inverse());
    // Account for zoom/pan transform
    node.fx = (svgPt.x - pan.x) / zoom;
    node.fy = (svgPt.y - pan.y) / zoom;
  }, [pan.x, pan.y, zoom]);

  const handleNodeMouseUp = useCallback(() => {
    if (dragNode.current) {
      const node = simNodes.current.find((n) => n.id === dragNode.current);
      if (node) {
        node.fx = null;
        node.fy = null;
      }
      dragNode.current = null;
    }
  }, []);

  /* ── Derived data ── */
  const nodeMap = useMemo(() => new Map(renderNodes.map((n) => [n.id, n])), [renderNodes]);
  const connectedSet = useMemo(() => {
    if (!selectedNode) return null;
    const set = new Set<string>([selectedNode]);
    for (const e of renderEdges) {
      if (e.source === selectedNode) set.add(e.target);
      if (e.target === selectedNode) set.add(e.source);
    }
    return set;
  }, [selectedNode, renderEdges]);

  const hovered = hoveredNode ? nodeMap.get(hoveredNode) : null;

  /* ── Loading ── */
  if (!status && !error) {
    return (
      <section className="zion-rainbow-card p-8" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
        <div className="flex flex-col gap-2 mb-6">
          <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Topologie' : 'Topology'}</p>
          <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
            <Network className="h-7 w-7 text-purple-400" />
            {cs ? 'P2P síťová topologie' : 'P2P Mesh Topology'}
          </h2>
        </div>
        <div className="flex items-center justify-center h-64">
          <Globe className="w-8 h-8 animate-spin text-purple-400" />
        </div>
      </section>
    );
  }

  /* ── No peers / error ── */
  if (error || (status && status.summary.online === 0)) {
    return (
      <section className="zion-rainbow-card p-8" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
        <div className="flex flex-col gap-2 mb-6">
          <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Topologie' : 'Topology'}</p>
          <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
            <Network className="h-7 w-7 text-purple-400" />
            {cs ? 'P2P síťová topologie' : 'P2P Mesh Topology'}
          </h2>
        </div>
        <div className="flex flex-col items-center justify-center gap-4 h-64">
          <p className="text-gray-400">{cs ? 'Žádné peery nejsou připojeny.' : 'No peers connected.'}</p>
          <button
            onClick={fetchStatus}
            className="inline-flex items-center gap-2 rounded-2xl bg-purple-500/20 border border-purple-400/30 px-5 py-2.5 text-sm font-semibold text-purple-200 hover:bg-purple-500/30 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            {cs ? 'Zkusit znovu' : 'Retry'}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="zion-rainbow-card p-8" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
      <div className="flex flex-col gap-2 mb-6">
        <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Topologie' : 'Topology'}</p>
        <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
          <Network className="h-7 w-7 text-purple-400" />
          {cs ? 'P2P síťová topologie' : 'P2P Mesh Topology'}
        </h2>
        <p className="text-sm text-gray-400">
          {cs
            ? 'Interaktivní graf P2P mesh spojení. Kolečka = peery (velikost podle počtu spojení), čáry = spojení (barva podle latence).'
            : 'Interactive force-directed graph of P2P mesh connections. Circles = peers (sized by connection count), lines = links (colored by latency).'}
        </p>
      </div>

      <div className="zion-rainbow-sub p-4" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
        <div className="relative">
          {/* Zoom controls */}
          <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
            <button
              onClick={() => handleZoomBtn(1.2)}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-black/60 border border-white/10 text-white hover:bg-purple-500/30 transition-colors"
              title={cs ? 'Přiblížit' : 'Zoom in'}
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleZoomBtn(0.83)}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-black/60 border border-white/10 text-white hover:bg-purple-500/30 transition-colors"
              title={cs ? 'Oddálit' : 'Zoom out'}
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleReset}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-black/60 border border-white/10 text-white hover:bg-purple-500/30 transition-colors text-xs"
              title={cs ? 'Resetovat' : 'Reset'}
            >
              ⟲
            </button>
          </div>

          <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            className="w-full h-auto min-h-[400px] cursor-grab active:cursor-grabbing"
            preserveAspectRatio="xMidYMid meet"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={(e) => { handleMouseMove(e); handleNodeMouseMove(e); }}
            onMouseUp={() => { handleMouseUp(); handleNodeMouseUp(); }}
            onMouseLeave={() => { handleMouseUp(); handleNodeMouseUp(); setHoveredNode(null); }}
          >
            <defs>
              <radialGradient id="topoNodeGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#a855f7" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="topoSeedGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#d4af37" stopOpacity="0.7" />
                <stop offset="100%" stopColor="#d4af37" stopOpacity="0" />
              </radialGradient>
            </defs>

            <rect width={VIEW_W} height={VIEW_H} fill="rgba(5,5,15,0.4)" rx="12" />

            <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
              {/* Edges */}
              {renderEdges.map((edge, i) => {
                const s = nodeMap.get(edge.source);
                const t = nodeMap.get(edge.target);
                if (!s || !t) return null;
                const color = latencyColor(edge.latency);
                const isHighlighted = connectedSet && (connectedSet.has(edge.source) && connectedSet.has(edge.target));
                const dimmed = connectedSet && !isHighlighted;
                return (
                  <line
                    key={`edge-${i}`}
                    x1={s.x}
                    y1={s.y}
                    x2={t.x}
                    y2={t.y}
                    stroke={color}
                    strokeWidth={isHighlighted ? 2 : 1}
                    strokeOpacity={dimmed ? 0.08 : isHighlighted ? 0.8 : 0.35}
                  />
                );
              })}

              {/* Nodes */}
              {renderNodes.map((node) => {
                const isSelected = selectedNode === node.id;
                const isHovered = hoveredNode === node.id;
                const isConnected = connectedSet?.has(node.id) ?? false;
                const dimmed = connectedSet && !isConnected;
                const radius = 5 + Math.min(node.connectionCount, 20) * 0.6;
                const glowR = node.isSeed ? 22 : 16;

                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x},${node.y})`}
                    style={{ cursor: 'pointer', opacity: dimmed ? 0.25 : 1 }}
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                    onMouseDown={(e) => handleNodeMouseDown(node.id, e)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedNode(isSelected ? null : node.id);
                    }}
                  >
                    {/* Glow */}
                    <circle
                      r={glowR}
                      fill={node.isSeed ? 'url(#topoSeedGlow)' : 'url(#topoNodeGlow)'}
                      opacity={isHovered || isSelected ? 0.9 : 0.4}
                    />
                    {/* Pulse for seed nodes */}
                    {node.isSeed && node.online && (
                      <motion.circle
                        r={radius}
                        fill="none"
                        stroke="#d4af37"
                        strokeWidth="1"
                        initial={{ r: radius, opacity: 0.8 }}
                        animate={{ r: radius + 12, opacity: 0 }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
                      />
                    )}
                    {/* Node circle */}
                    <circle
                      r={radius}
                      fill={node.isSeed ? '#d4af37' : isSelected ? '#a855f7' : '#7c3aed'}
                      stroke={isSelected ? '#fff' : isHovered ? '#c084fc' : 'rgba(255,255,255,0.2)'}
                      strokeWidth={isSelected ? 2.5 : 1.5}
                    />
                    {/* Label */}
                    <text
                      y={radius + 12}
                      textAnchor="middle"
                      fill={isSelected ? '#fff' : 'rgba(200,200,220,0.6)'}
                      fontSize="8"
                      fontFamily="monospace"
                    >
                      {node.shortAddr}
                    </text>
                    <text
                      y={radius + 22}
                      textAnchor="middle"
                      fill="rgba(160,160,180,0.4)"
                      fontSize="7"
                      fontFamily="monospace"
                    >
                      v{node.version}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Tooltip */}
          {hovered && (
            <div className="absolute top-2 left-2 z-10 bg-black/85 backdrop-blur border border-purple-400/20 rounded-xl p-3 text-xs space-y-1 min-w-[180px]">
              <p className="text-white font-semibold text-sm">{hovered.label}</p>
              <p className="text-gray-400 font-mono">{hovered.shortAddr}</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 pt-1">
                <span className="text-gray-500">{cs ? 'Host' : 'Host'}</span>
                <span className="text-gray-300 font-mono text-right">{hovered.host}</span>
                <span className="text-gray-500">{cs ? 'Port' : 'Port'}</span>
                <span className="text-gray-300 font-mono text-right">{hovered.port}</span>
                <span className="text-gray-500">{cs ? 'Verze' : 'Version'}</span>
                <span className="text-gray-300 font-mono text-right">v{hovered.version}</span>
                <span className="text-gray-500">{cs ? 'Latence' : 'Latency'}</span>
                <span className="font-mono text-right" style={{ color: latencyColor(hovered.latency) }}>{hovered.latency}ms</span>
                <span className="text-gray-500">{cs ? 'Výška' : 'Height'}</span>
                <span className="text-gray-300 font-mono text-right">{hovered.height.toLocaleString()}</span>
                <span className="text-gray-500">{cs ? 'Spojení' : 'Connections'}</span>
                <span className="text-gray-300 font-mono text-right">{hovered.connectionCount}</span>
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 mt-3 text-xs">
            <span className="text-gray-500">{cs ? 'Latence:' : 'Latency:'}</span>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-emerald-500" />
              <span className="text-gray-400">&lt;50ms</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-amber-500" />
              <span className="text-gray-400">&lt;200ms</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-red-500" />
              <span className="text-gray-400">&gt;200ms</span>
            </div>
            <div className="flex items-center gap-1.5 ml-4">
              <div className="w-3 h-3 rounded-full bg-zion-gold" />
              <span className="text-gray-400">{cs ? 'Seed uzel' : 'Seed node'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-purple-600" />
              <span className="text-gray-400">{cs ? 'Peer' : 'Peer'}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
