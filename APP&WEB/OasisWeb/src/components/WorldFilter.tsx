'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, ChevronDown, ChevronUp, Layers, Globe2, Pickaxe, Activity, Download } from 'lucide-react';
import Link from 'next/link';
import type { WorldCategory, WorldLayer } from '../domain/types/world';
import { getHealth, getPlayer } from '../lib/api';
import { useGameStore } from '../store/gameStore';

const CATEGORIES: { id: WorldCategory; label: string; color: string; rgb: string; icon: string }[] = [
  { id: 'star-system', label: 'Stars', color: '#fcd116', rgb: '252, 209, 22', icon: '★' },
  { id: 'planet', label: 'Planets', color: '#078930', rgb: '7, 137, 48', icon: '●' },
  { id: 'sector', label: 'Sectors', color: '#e41e2b', rgb: '228, 30, 43', icon: '◆' },
  { id: 'world', label: 'Worlds', color: '#078930', rgb: '7, 137, 48', icon: '◈' },
  { id: 'dimension', label: 'Dimensions', color: '#e41e2b', rgb: '236, 72, 153', icon: '◊' },
];

const LAYERS: { id: WorldLayer; label: string; color: string; rgb: string; desc: string }[] = [
  { id: 1, label: 'Layer 1', color: '#fcd116', rgb: '252, 209, 22', desc: 'Core Galaxy' },
  { id: 2, label: 'Layer 2', color: '#078930', rgb: '7, 137, 48', desc: 'Inner Rim' },
  { id: 3, label: 'Layer 3', color: '#e41e2b', rgb: '228, 30, 43', desc: 'Temporal' },
  { id: 4, label: 'Layer 4', color: '#e41e2b', rgb: '236, 72, 153', desc: 'Mythic' },
  { id: 5, label: 'Layer 5', color: '#078930', rgb: '7, 137, 48', desc: 'Creative' },
];

const MINIMIZED_KEY = 'oasis-filter-minimized';

/* ── Miner Lite: compact mining status widget ── */
function MinerLite() {
  const address = useGameStore((s) => s.address);
  const [poolOnline, setPoolOnline] = useState<boolean | null>(null);
  const [blocks, setBlocks] = useState<number | null>(null);
  const [zion, setZion] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchMine = async () => {
      try {
        const health = await getHealth();
        if (cancelled) return;
        setPoolOnline(health !== null);
      } catch {
        if (!cancelled) setPoolOnline(false);
      }
      if (address) {
        try {
          const player = await getPlayer(address);
          if (cancelled) return;
          if (player) {
            setBlocks(player.blocks_mined);
            setZion(player.zion_earned);
          }
        } catch {
          // ignore
        }
      }
      if (!cancelled) setLoading(false);
    };
    fetchMine();
    const interval = setInterval(fetchMine, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [address]);

  const poolAddr = '62.171.141.136:8444';

  return (
    <div className="zion-hud-panel flex shrink-0 flex-col gap-1.5 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Pickaxe className="h-3 w-3 text-oasis-gold" />
          <span className="text-[9px] font-bold uppercase tracking-wider text-white/70">Miner</span>
        </div>
        <span
          className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8px] font-bold ${
            poolOnline
              ? 'bg-rasta-green/15 text-rasta-green'
              : poolOnline === false
              ? 'bg-rasta-red/15 text-rasta-red'
              : 'bg-white/5 text-white/60'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              poolOnline ? 'bg-rasta-green' : poolOnline === false ? 'bg-rasta-red' : 'bg-white/50'
            }`}
            style={{ boxShadow: poolOnline ? '0 0 6px #078930' : 'none' }}
          />
          {poolOnline ? 'ONLINE' : poolOnline === false ? 'OFFLINE' : '...'}
        </span>
      </div>

      {/* Pool address */}
      <div className="flex items-center justify-between rounded-md bg-black/30 px-2 py-1">
        <span className="text-[8px] text-white/60">Pool</span>
        <code className="font-mono text-[8px] text-oasis-cyan">{poolAddr}</code>
      </div>

      {/* Player mining stats */}
      {address && blocks !== null && (
        <div className="grid grid-cols-2 gap-1.5">
          <div className="rounded-md bg-black/30 px-2 py-1.5 text-center">
            <p className="text-[8px] uppercase tracking-wider text-white/60">Blocks</p>
            <p className="font-mono text-xs font-bold text-oasis-cyan">{blocks}</p>
          </div>
          <div className="rounded-md bg-black/30 px-2 py-1.5 text-center">
            <p className="text-[8px] uppercase tracking-wider text-white/60">ZION</p>
            <p className="font-mono text-xs font-bold text-oasis-gold">{zion}</p>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-1">
          <Activity className="h-3 w-3 animate-pulse text-white/50" />
        </div>
      )}

      {/* CTA links */}
      <div className="flex gap-1.5">
        <Link
          href="/miner"
          className="flex flex-1 items-center justify-center gap-1 rounded-md border border-oasis-gold/20 bg-oasis-gold/10 px-2 py-1.5 text-[9px] font-bold text-oasis-gold transition hover:bg-oasis-gold/20"
        >
          <Pickaxe className="h-3 w-3" />
          Mine
        </Link>
        <a
          href="/downloads/zion-public-miner-v3.0.6-linux-x86_64.AppImage"
          className="flex items-center justify-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-[9px] font-bold text-white/80 transition hover:bg-white/10"
          title="Download Desktop Miner"
        >
          <Download className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}

interface WorldFilterProps {
  active: WorldCategory[];
  onChange: (active: WorldCategory[]) => void;
  activeLayers?: WorldLayer[];
  onLayersChange?: (layers: WorldLayer[]) => void;
}

export default function WorldFilter({ active, onChange, activeLayers, onLayersChange }: WorldFilterProps) {
  const [minimized, setMinimized] = useState(false);
  const hasLayers = !!activeLayers && !!onLayersChange;
  const worlds = useGameStore((s) => s.worlds);

  const counts = CATEGORIES.map((cat) => worlds.filter((w) => w.category === cat.id).length);
  const layerCounts = LAYERS.map((l) => worlds.filter((w) => w.layer === l.id).length);

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(MINIMIZED_KEY) : null;
    if (saved === 'true') setMinimized(true);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem(MINIMIZED_KEY, String(minimized));
  }, [minimized]);

  const toggle = (id: WorldCategory) => {
    if (active.includes(id)) {
      onChange(active.filter((c) => c !== id));
    } else {
      onChange([...active, id]);
    }
  };

  const toggleLayer = (id: WorldLayer) => {
    if (!hasLayers) return;
    if (activeLayers!.includes(id)) {
      onLayersChange!(activeLayers!.filter((l) => l !== id));
    } else {
      onLayersChange!([...activeLayers!, id]);
    }
  };

  const allActive = active.length === CATEGORIES.length;
  const toggleAll = () => {
    onChange(allActive ? [] : CATEGORIES.map((c) => c.id));
  };

  const allLayersActive = hasLayers && activeLayers!.length === LAYERS.length;
  const toggleAllLayers = () => {
    if (!hasLayers) return;
    onLayersChange!(allLayersActive ? [] : LAYERS.map((l) => l.id));
  };

  const visibleCount = worlds.filter((w) => {
    const catOk = active.includes(w.category as WorldCategory);
    const layerOk = !hasLayers || activeLayers!.includes(w.layer);
    return catOk && layerOk;
  }).length;

  /* ── Minimized: small tab at bottom-right ── */
  if (minimized) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
        className="pointer-events-auto absolute bottom-4 right-2 z-20 sm:bottom-5 sm:right-5"
      >
        <button
          onClick={() => setMinimized(false)}
          className="zion-hud-panel flex items-center gap-2 px-3 py-2 text-[10px] font-semibold text-white/80 transition hover:text-white"
          title="Show world filters"
        >
          <Filter className="h-3.5 w-3.5 text-oasis-cyan" />
          <span className="font-mono">{visibleCount}/{worlds.length}</span>
          <ChevronUp className="h-3 w-3" />
        </button>
      </motion.div>
    );
  }

  /* ── Expanded: vertical panel on right side, opens upward above ControlHud ── */
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30, transition: { duration: 0.3, delay: 0 } }}
      transition={{ duration: 0.5, delay: 0.5 }}
      className="pointer-events-auto absolute bottom-56 right-2 z-20 flex max-h-[calc(100vh-18rem)] w-48 flex-col gap-2 overflow-y-auto sm:bottom-72 sm:right-5 sm:max-h-[calc(100vh-22rem)] sm:w-64"
      style={{ scrollbarWidth: 'thin' }}
    >
      {/* Header bar */}
      <div className="zion-hud-panel flex shrink-0 items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-oasis-cyan" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-white">World Filter</span>
        </div>
        <button
          onClick={() => setMinimized(true)}
          className="zion-button-ghost !p-1"
          title="Minimize filters"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Categories section */}
      <div className="zion-hud-panel flex shrink-0 flex-col gap-1.5 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Globe2 className="h-3 w-3 text-oasis-gold" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-white/70">Categories</span>
          </div>
          <button
            onClick={toggleAll}
            className={`zion-button-ghost text-[9px] uppercase tracking-wider ${allActive ? 'text-white bg-white/10' : ''}`}
          >
            {allActive ? 'All' : 'None'}
          </button>
        </div>
        <div className="flex flex-col gap-1">
          {CATEGORIES.map((cat, i) => {
            const isActive = active.includes(cat.id);
            return (
              <button
                key={cat.id}
                onClick={() => toggle(cat.id)}
                className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-[10px] uppercase tracking-wider transition"
                style={{
                  borderColor: isActive ? `rgba(${cat.rgb}, 0.35)` : 'rgba(255,255,255,0.06)',
                  backgroundColor: isActive ? `rgba(${cat.rgb}, 0.08)` : 'transparent',
                  color: isActive ? cat.color : '#6b6b6b',
                  boxShadow: isActive ? `0 0 12px rgba(${cat.rgb}, 0.12)` : 'none',
                }}
              >
                <span className="text-sm leading-none" style={{ color: cat.color, opacity: isActive ? 1 : 0.4 }}>
                  {cat.icon}
                </span>
                <span className="flex-1 text-left">{cat.label}</span>
                <span
                  className="rounded px-1.5 py-0.5 text-[9px] font-mono"
                  style={{
                    backgroundColor: isActive ? `rgba(${cat.rgb}, 0.12)` : 'rgba(255,255,255,0.04)',
                    color: isActive ? cat.color : '#4a4a4a',
                  }}
                >
                  {counts[i]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Layers / Sectors section */}
      {hasLayers && (
        <div className="zion-hud-panel flex shrink-0 flex-col gap-1.5 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Layers className="h-3 w-3 text-oasis-purple" />
              <span className="text-[9px] font-bold uppercase tracking-wider text-white/70">Galactic Layers</span>
            </div>
            <button
              onClick={toggleAllLayers}
              className={`zion-button-ghost text-[9px] uppercase tracking-wider ${allLayersActive ? 'text-white bg-white/10' : ''}`}
            >
              {allLayersActive ? 'All' : 'None'}
            </button>
          </div>
          <div className="flex flex-col gap-1">
            {LAYERS.map((layer, i) => {
              const isActive = activeLayers!.includes(layer.id);
              return (
                <button
                  key={layer.id}
                  onClick={() => toggleLayer(layer.id)}
                  className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-[10px] tracking-wider transition"
                  style={{
                    borderColor: isActive ? `rgba(${layer.rgb}, 0.35)` : 'rgba(255,255,255,0.06)',
                    backgroundColor: isActive ? `rgba(${layer.rgb}, 0.08)` : 'transparent',
                    color: isActive ? layer.color : '#6b6b6b',
                    boxShadow: isActive ? `0 0 12px rgba(${layer.rgb}, 0.12)` : 'none',
                  }}
                >
                  <span
                    className="flex h-4 w-4 items-center justify-center rounded text-[8px] font-bold"
                    style={{
                      backgroundColor: isActive ? `rgba(${layer.rgb}, 0.2)` : 'rgba(255,255,255,0.05)',
                      color: isActive ? layer.color : '#4a4a4a',
                    }}
                  >
                    {layer.id}
                  </span>
                  <span className="flex-1 text-left">
                    <span className="font-semibold">{layer.label}</span>
                    <span className="ml-1.5 text-[8px] opacity-60">{layer.desc}</span>
                  </span>
                  <span
                    className="rounded px-1.5 py-0.5 text-[9px] font-mono"
                    style={{
                      backgroundColor: isActive ? `rgba(${layer.rgb}, 0.12)` : 'rgba(255,255,255,0.04)',
                      color: isActive ? layer.color : '#4a4a4a',
                    }}
                  >
                    {layerCounts[i]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Visible count footer */}
      <div className="zion-hud-panel flex shrink-0 items-center justify-between px-3 py-2">
        <span className="text-[9px] font-bold uppercase tracking-wider text-white/70">Visible</span>
        <span className="font-mono text-[11px] font-bold text-oasis-cyan">
          {visibleCount} / {worlds.length}
        </span>
      </div>

      {/* Miner Lite section */}
      <MinerLite />
    </motion.div>
  );
}
