'use client';

import { motion } from 'framer-motion';
import { X, Globe, Layers, MapPin, Sparkles, Eye, Egg } from 'lucide-react';
import type { World } from '../domain/types/world';

const CATEGORY_COLORS: Record<string, string> = {
  'star-system': '#f59e0b',
  'planet': '#22d3ee',
  'sector': '#a855f7',
  'world': '#10b981',
  'dimension': '#ec4899',
};

const CATEGORY_LABELS: Record<string, string> = {
  'star-system': 'Star System',
  'planet': 'Planet',
  'sector': 'Sector',
  'world': 'World',
  'dimension': 'Dimension',
};

interface WorldPanelProps {
  world: World;
  onClose: () => void;
  onEnter: () => void;
}

export default function WorldPanel({ world, onClose, onEnter }: WorldPanelProps) {
  const color = CATEGORY_COLORS[world.category] || '#ffffff';

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.4 }}
      className="pointer-events-auto absolute right-6 top-6 z-30 w-80 overflow-hidden rounded-2xl border border-white/10 bg-black/85 p-5 shadow-2xl backdrop-blur-xl"
    >
      <div className="mb-4 flex items-start justify-between">
        <div>
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
            style={{ backgroundColor: `${color}22`, color }}
          >
            <Globe className="h-3 w-3" />
            {CATEGORY_LABELS[world.category]}
          </span>
          <h2 className="mt-2 text-2xl font-bold text-white" style={{ textShadow: `0 0 18px ${color}66` }}>
            {world.name}
          </h2>
          <p className="text-xs text-gray-400">Layer {world.layer}</p>
        </div>
        <button
          onClick={onClose}
          className="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4">
        <div className="flex items-start gap-2 text-sm text-gray-300">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-oasis-cyan" />
          <span>{world.location}</span>
        </div>

        <div className="flex items-start gap-2 text-sm text-gray-300">
          <Eye className="mt-0.5 h-4 w-4 shrink-0 text-oasis-purple" />
          <span className="italic">{world.vibe}</span>
        </div>

        <div className="rounded-xl border border-white/5 bg-white/5 p-3">
          <p className="text-sm leading-relaxed text-gray-200">{world.summary}</p>
        </div>

        {world.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {world.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-gray-300"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {world.goldenEggClue !== undefined && (
            <div className="flex items-center gap-2 rounded-xl border border-oasis-gold/20 bg-oasis-gold/10 p-2.5">
              <Egg className="h-4 w-4 text-oasis-gold" />
              <div>
                <p className="text-[10px] uppercase tracking-wider text-oasis-gold">Golden Egg</p>
                <p className="text-sm font-semibold text-white">Clue {world.goldenEggClue}</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-2.5">
            <Layers className="h-4 w-4 text-oasis-cyan" />
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400">Layer</p>
              <p className="text-sm font-semibold text-white">{world.layer}</p>
            </div>
          </div>
        </div>

        <button
          onClick={onEnter}
          className="group mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-bold text-white transition-shadow"
          style={{ backgroundColor: color, boxShadow: `0 0 24px ${color}44` }}
          onMouseEnter={(e) => (e.currentTarget.style.boxShadow = `0 0 40px ${color}66`)}
          onMouseLeave={(e) => (e.currentTarget.style.boxShadow = `0 0 24px ${color}44`)}
        >
          <Sparkles className="h-4 w-4" />
          Enter this world
        </button>
      </div>
    </motion.div>
  );
}
