'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Network, Globe, RefreshCw, ZoomIn, ZoomOut } from 'lucide-react';
import { usePolling } from '@/hooks/usePolling';
import { useLang } from '@/contexts/LanguageContext';

const NetworkTopologyCopy = {
  topology: { cs: `Topologie`, en: `Topology` },
  p2pMeshTopology: { cs: `P2P síťová topologie`, en: `P2P Mesh Topology` },
  noPeersConnected: { cs: `Žádné peery nejsou připojeny.`, en: `No peers connected.` },
  retry: { cs: `Zkusit znovu`, en: `Retry` },
  interactiveForceDirectedGraphO: { cs: `Interaktivní graf P2P mesh spojení. Kolečka = peery (velikost podle počtu spojení), čáry = spojení (barva podle latence).`, en: `Interactive force-directed graph of P2P mesh connections. Circles = peers (sized by connection count), lines = links (colored by latency).` },
  noPeersConnectedShowingSeedNod: { cs: `Žádné peery nejsou připojeny — zobrazuji pouze seed uzly.`, en: `No peers connected — showing seed nodes only.` },
  peerDataUnavailableShowingSeed: { cs: `Peer data nedostupná — zobrazuji pouze seed uzly.`, en: `Peer data unavailable — showing seed nodes only.` },
  zoomIn: { cs: `Přiblížit`, en: `Zoom in` },
  zoomOut: { cs: `Oddálit`, en: `Zoom out` },
  reset: { cs: `Resetovat`, en: `Reset` },
  host: { cs: `Host`, en: `Host` },
  port: { cs: `Port`, en: `Port` },
  version: { cs: `Verze`, en: `Version` },
  latency: { cs: `Latence`, en: `Latency` },
  height: { cs: `Výška`, en: `Height` },
  connections: { cs: `Spojení`, en: `Connections` },
  latency_2: { cs: `Latence:`, en: `Latency:` },
  unknown: { cs: `neznámá`, en: `unknown` },
  seedNode: { cs: `Seed uzel`, en: `Seed node` },
  peer: { cs: `Peer`, en: `Peer` },
};

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
  latency: number; // 0 = unknown (no latency data available for this link)
}

/* ═══════════════════════════════════════════════════════════
   Real peer data — mirrors /api/blockchain/peers response
   ═══════════════════════════════════════════════════════════ */

interface PeerInfo {
  address: string;
  host: string;
  port: number;
  height: number;
  incoming: boolean;
  connected: boolean;
  state: string;
  sub_version: string;
  last_seen: number;
  idle_seconds: number;
  failed_attempts: number;
}

interface PeersResponse {
  count: number;
  connected_peers: number;
  peers: PeerInfo[];
}

/* Shorten a real peer address/host for compact display */
function shortPeerLabel(peer: PeerInfo, idx: number): string {
  const host = peer.host || peer.address?.split(':')[0] || '';
  if (host) {
    // Show last two octets of an IPv4, or a trimmed host
    const parts = host.split('.');
    if (parts.length === 4) return `…${parts[2]}.${parts[3]}`;
    return host.length > 12 ? `${host.slice(0, 10)}…` : host;
  }
  return `peer-${idx + 1}`;
}

/* ═══════════════════════════════════════════════════════════
   Build simulation graph from real network status + real peers
   ═══════════════════════════════════════════════════════════ */

function buildGraph(
  status: NetworkStatus,
  peers: PeerInfo[],
  width: number,
  height: number
): { nodes: SimNode[]; edges: SimEdge[] } {
  const cx = width / 2;
  const cy = height / 2;
  const nodes: SimNode[] = [];
  const edges: SimEdge[] = [];

  // Seed nodes (real — from /api/network)
  const seedNodes = status.nodes.map((n, i) => {
    const angle = (i / Math.max(status.nodes.length, 1)) * Math.PI * 2;
    const r = Math.min(width, height) * 0.25;
    return {
      id: n.id,
      label: n.name,
      shortAddr: n.host || n.id,
      version: '', // version not exposed by /api/network
      host: n.host,
      port: 8333,
      latency: n.rpcLatencyMs ?? 0, // 0 = unknown
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

  // Real peers (from /api/blockchain/peers) — attached to the first online seed.
  // Real peers have no lat/lon and no latency, so cluster them around their seed
  // and mark link latency as 0 (unknown).
  const anchorSeed = seedNodes.find((s) => s.online) ?? seedNodes[0];
  const connectedPeers = peers.filter((p) => p.connected);
  const peerList = connectedPeers.length > 0 ? connectedPeers : peers;

  peerList.forEach((peer, p) => {
    const angle = (p / Math.max(peerList.length, 1)) * Math.PI * 2;
    const r = 70 + (p % 3) * 35;
    const id = `peer-${p}`;
    const anchor = anchorSeed ?? { x: cx, y: cy };
    nodes.push({
      id,
      label: peer.incoming
        ? `in ${shortPeerLabel(peer, p)}`
        : `out ${shortPeerLabel(peer, p)}`,
      shortAddr: shortPeerLabel(peer, p),
      version: peer.sub_version || '',
      host: peer.host || peer.address?.split(':')[0] || '—',
      port: peer.port || 8333,
      latency: 0, // unknown — peers API exposes no latency
      height: peer.height || 0,
      connectionCount: 1,
      isSeed: false,
      online: peer.connected,
      x: anchor.x + Math.cos(angle) * r,
      y: anchor.y + Math.sin(angle) * r,
      vx: 0,
      vy: 0,
      fx: null,
      fy: null,
    });
    // Edge anchor seed -> peer (latency unknown → 0)
    if (anchorSeed) {
      edges.push({ source: anchorSeed.id, target: id, latency: 0 });
    }
  });

  // Inter-seed edges (real latencies where measured)
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

  return { nodes, edges };
}

/* ═══════════════════════════════════════════════════════════
   Latency color helper
   ═══════════════════════════════════════════════════════════ */

function latencyColor(ms: number): string {
  if (ms <= 0) return '#64748b'; // unknown / no data — slate
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
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [peersError, setPeersError] = useState(false);
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
      const [netRes, peersRes] = await Promise.all([
        fetch('/api/network', { cache: 'no-store' }),
        fetch('/api/blockchain/peers', { cache: 'no-store' }),
      ]);
      if (netRes.ok) {
        const data = await netRes.json();
        setStatus(data);
        setError(false);
      } else {
        setError(true);
      }
      if (peersRes.ok) {
        const pdata: PeersResponse = await peersRes.json();
        setPeers(Array.isArray(pdata.peers) ? pdata.peers : []);
        setPeersError(false);
      } else {
        setPeers([]);
        setPeersError(true);
      }
    } catch {
      setError(true);
      setPeersError(true);
    }
  }, []);

  usePolling(fetchStatus, 30_000);

  // Build graph when status or peers change
  const builtGraph = useMemo(() => {
    if (!status) return null;
    return buildGraph(status, peers, VIEW_W, VIEW_H);
  }, [status, peers]);

  useEffect(() => {
    if (!builtGraph) return;
    simNodes.current = builtGraph.nodes;
    simEdges.current = builtGraph.edges;
    // Sync graph structure to render state — required when topology changes
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
      <section className="zion-rainbow-card p-8" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
        <div className="flex flex-col gap-2 mb-6">
          <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{NetworkTopologyCopy.topology[cs ? 'cs' : 'en']}</p>
          <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
            <Network className="h-7 w-7 text-zion-cyan" />
            {NetworkTopologyCopy.p2pMeshTopology[cs ? 'cs' : 'en']}
          </h2>
        </div>
        <div className="flex items-center justify-center h-64">
          <Globe className="w-8 h-8 animate-spin text-zion-cyan" />
        </div>
      </section>
    );
  }

  /* ── No peers / error ── */
  if (error || (status && status.summary.online === 0)) {
    return (
      <section className="zion-rainbow-card p-8" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
        <div className="flex flex-col gap-2 mb-6">
          <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{NetworkTopologyCopy.topology[cs ? 'cs' : 'en']}</p>
          <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
            <Network className="h-7 w-7 text-zion-cyan" />
            {NetworkTopologyCopy.p2pMeshTopology[cs ? 'cs' : 'en']}
          </h2>
        </div>
        <div className="flex flex-col items-center justify-center gap-4 h-64">
          <p className="text-gray-400">{NetworkTopologyCopy.noPeersConnected[cs ? 'cs' : 'en']}</p>
          <button
            onClick={fetchStatus}
            className="zion-button-secondary"
          >
            <RefreshCw className="h-4 w-4" />
            {NetworkTopologyCopy.retry[cs ? 'cs' : 'en']}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="zion-rainbow-card p-8" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
      <div className="flex flex-col gap-2 mb-6">
        <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{NetworkTopologyCopy.topology[cs ? 'cs' : 'en']}</p>
        <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
          <Network className="h-7 w-7 text-zion-cyan" />
          {NetworkTopologyCopy.p2pMeshTopology[cs ? 'cs' : 'en']}
        </h2>
        <p className="text-sm text-gray-400">
          {NetworkTopologyCopy.interactiveForceDirectedGraphO[cs ? 'cs' : 'en']}
        </p>
        {peers.length === 0 && !peersError && (
          <p className="text-xs text-amber-400/80 inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            {NetworkTopologyCopy.noPeersConnectedShowingSeedNod[cs ? 'cs' : 'en']}
          </p>
        )}
        {peersError && (
          <p className="text-xs text-red-400/80 inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
            {NetworkTopologyCopy.peerDataUnavailableShowingSeed[cs ? 'cs' : 'en']}
          </p>
        )}
      </div>

      <div className="zion-rainbow-sub p-4" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
        <div className="relative">
          {/* Zoom controls */}
          <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
            <button
              onClick={() => handleZoomBtn(1.2)}
              className="zion-button-secondary w-8 h-8 p-0 flex items-center justify-center"
              title={NetworkTopologyCopy.zoomIn[cs ? 'cs' : 'en']}
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleZoomBtn(0.83)}
              className="zion-button-secondary w-8 h-8 p-0 flex items-center justify-center"
              title={NetworkTopologyCopy.zoomOut[cs ? 'cs' : 'en']}
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleReset}
              className="zion-button-secondary w-8 h-8 p-0 flex items-center justify-center text-xs"
              title={NetworkTopologyCopy.reset[cs ? 'cs' : 'en']}
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
                    {node.version && (
                      <text
                        y={radius + 22}
                        textAnchor="middle"
                        fill="rgba(160,160,180,0.4)"
                        fontSize="7"
                        fontFamily="monospace"
                      >
                        v{node.version}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Tooltip */}
          {hovered && (
            <div className="absolute top-2 left-2 z-10 bg-black/85 backdrop-blur border border-purple-400/20 rounded-xl p-3 text-xs space-y-1 min-w-0 sm:min-w-[180px]">
              <p className="text-white font-semibold text-sm">{hovered.label}</p>
              <p className="text-gray-400 font-mono">{hovered.shortAddr}</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 pt-1">
                <span className="text-gray-500">{NetworkTopologyCopy.host[cs ? 'cs' : 'en']}</span>
                <span className="text-gray-300 font-mono text-right">{hovered.host}</span>
                <span className="text-gray-500">{NetworkTopologyCopy.port[cs ? 'cs' : 'en']}</span>
                <span className="text-gray-300 font-mono text-right">{hovered.port}</span>
                <span className="text-gray-500">{NetworkTopologyCopy.version[cs ? 'cs' : 'en']}</span>
                <span className="text-gray-300 font-mono text-right">{hovered.version ? `v${hovered.version}` : '—'}</span>
                <span className="text-gray-500">{NetworkTopologyCopy.latency[cs ? 'cs' : 'en']}</span>
                <span className="font-mono text-right" style={{ color: latencyColor(hovered.latency) }}>{hovered.latency > 0 ? `${hovered.latency}ms` : '—'}</span>
                <span className="text-gray-500">{NetworkTopologyCopy.height[cs ? 'cs' : 'en']}</span>
                <span className="text-gray-300 font-mono text-right">{hovered.height > 0 ? hovered.height.toLocaleString() : '—'}</span>
                <span className="text-gray-500">{NetworkTopologyCopy.connections[cs ? 'cs' : 'en']}</span>
                <span className="text-gray-300 font-mono text-right">{hovered.connectionCount}</span>
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 mt-3 text-xs">
            <span className="text-gray-500">{NetworkTopologyCopy.latency_2[cs ? 'cs' : 'en']}</span>
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
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-slate-500" />
              <span className="text-gray-400">{NetworkTopologyCopy.unknown[cs ? 'cs' : 'en']}</span>
            </div>
            <div className="flex items-center gap-1.5 ml-4">
              <div className="w-3 h-3 rounded-full bg-zion-gold" />
              <span className="text-gray-400">{NetworkTopologyCopy.seedNode[cs ? 'cs' : 'en']}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-purple-600" />
              <span className="text-gray-400">{NetworkTopologyCopy.peer[cs ? 'cs' : 'en']}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
