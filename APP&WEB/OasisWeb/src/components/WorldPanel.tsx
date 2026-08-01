'use client';

import { motion } from 'framer-motion';
import { X, Globe, Layers, MapPin, Sparkles, Eye, Egg, Tag, Swords, Compass, Pickaxe, Brain, Users } from 'lucide-react';
import type { World } from '../domain/types/world';
import { generateQuests } from '../domain/quests';

const TYPE_ICONS = {
  exploration: Compass,
  combat: Swords,
  harvest: Pickaxe,
  puzzle: Brain,
  social: Users,
};

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
  const quests = generateQuests(world);

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.4 }}
      className="pointer-events-auto absolute left-2.5 right-2.5 top-2.5 z-30 max-w-full overflow-hidden rounded-2xl border border-white/10 bg-[#05060f]/90 p-4 shadow-2xl shadow-black/60 backdrop-blur-2xl sm:left-auto sm:right-5 sm:top-5 sm:w-80 sm:p-5"
    >
      <div className="mb-4 flex items-start justify-between">
        <div>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
            style={{ backgroundColor: `${color}18`, color, boxShadow: `0 0 12px ${color}22` }}
          >
            <Globe className="h-3 w-3" />
            {CATEGORY_LABELS[world.category]}
          </span>
          <h2
            className="mt-2 text-2xl font-bold text-white"
            style={{ textShadow: `0 0 16px ${color}55` }}
          >
            {world.name}
          </h2>
          <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
            <Layers className="h-3 w-3" />
            <span>Layer {world.layer}</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3.5">
        <div className="flex items-start gap-2.5 text-sm text-gray-300">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" style={{ color }} />
          <span className="leading-snug">{world.location}</span>
        </div>

        <div className="flex items-start gap-2.5 text-sm text-gray-300">
          <Eye className="mt-0.5 h-4 w-4 shrink-0" style={{ color }} />
          <span className="leading-snug italic">{world.vibe}</span>
        </div>

        <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3.5">
          <p className="text-sm leading-relaxed text-gray-200">{world.summary}</p>
        </div>

        {world.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {world.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-gray-300"
              >
                <Tag className="h-2.5 w-2.5" />
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Active Quests</p>
          <div className="space-y-2">
            {quests.map((quest, i) => {
              const Icon = TYPE_ICONS[quest.type];
              return (
                <div key={quest.id} className="flex items-start gap-2.5 rounded-lg bg-white/5 p-2">
                  <div className="mt-0.5 rounded p-1" style={{ backgroundColor: `${color}20`, color }}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white">{quest.title}</p>
                    <p className="text-[10px] text-gray-400">{quest.description}</p>
                  </div>
                  <div className="text-right text-[10px] text-gray-400">
                    <p style={{ color }}>★ {quest.difficulty}</p>
                    <p>{quest.reward} XP</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {world.goldenEggClue !== undefined && (
            <div className="flex items-center gap-2.5 rounded-xl border p-2.5" style={{ borderColor: `${color}30`, backgroundColor: `${color}10` }}>
              <Egg className="h-4 w-4" style={{ color }} />
              <div>
                <p className="text-[10px] uppercase tracking-wider" style={{ color: `${color}cc` }}>Golden Egg</p>
                <p className="text-sm font-semibold text-white">Clue {world.goldenEggClue}</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 p-2.5">
            <Sparkles className="h-4 w-4 text-oasis-cyan" />
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400">Archetype</p>
              <p className="text-sm font-semibold text-white">{CATEGORY_LABELS[world.category]}</p>
            </div>
          </div>
        </div>

        <button
          onClick={onEnter}
          className="group mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white transition-all"
          style={{
            backgroundColor: color,
            boxShadow: `0 0 28px ${color}44`,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.boxShadow = `0 0 44px ${color}66`)}
          onMouseLeave={(e) => (e.currentTarget.style.boxShadow = `0 0 28px ${color}44`)}
        >
          <Sparkles className="h-4 w-4" />
          Enter this world
        </button>
      </div>
    </motion.div>
  );
}
