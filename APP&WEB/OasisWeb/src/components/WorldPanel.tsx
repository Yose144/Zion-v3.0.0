'use client';

import { motion } from 'framer-motion';
import { X, Globe, Layers, MapPin, Sparkles, Eye, Egg, Tag, Swords, Compass, Pickaxe, Brain, Users } from 'lucide-react';
import type { World } from '../domain/types/world';
import { generateQuests, type Quest } from '../domain/quests';
import { useGameStore, getLevel, getLevelProgress } from '../store/gameStore';

const TYPE_ICONS: Record<Quest['type'], typeof Compass> = {
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

function guessQuestType(text: string): Quest['type'] {
  const t = text.toLowerCase();
  if (t.includes('fight') || t.includes('battle') || t.includes('defend') || t.includes('combat')) return 'combat';
  if (t.includes('mine') || t.includes('harvest') || t.includes('collect') || t.includes('gather')) return 'harvest';
  if (t.includes('puzzle') || t.includes('solve') || t.includes('decode') || t.includes('riddle')) return 'puzzle';
  if (t.includes('help') || t.includes('meet') || t.includes('speak') || t.includes('negotiate') || t.includes('guide')) return 'social';
  return 'exploration';
}

function mapRealQuests(world: World, realQuests: any[]): Quest[] {
  const matches = realQuests.filter((q) => {
    const loc = (q.location ?? '').toLowerCase();
    const name = (q.avatar_name ?? '').toLowerCase();
    const wn = world.name.toLowerCase();
    return loc.includes(wn) || wn.includes(loc) || name.includes(wn) || wn.includes(name);
  });

  return matches.map((q) => ({
    id: q.quest_id,
    title: q.title,
    type: guessQuestType(`${q.title} ${q.description}`),
    difficulty: Math.min(10, Math.max(1, q.min_consciousness_level ?? 1)),
    reward: q.xp_reward ?? 100,
    description: q.description,
    real: true,
    avatarName: q.avatar_name,
  }));
}

export default function WorldPanel({ world, onClose, onEnter }: WorldPanelProps) {
  const color = CATEGORY_COLORS[world.category] || '#ffffff';
  const { xp, credits, completeQuest, completedQuests, realQuests, avatars, claimGoldenEgg, collectedEggs } = useGameStore();
  const generated = generateQuests(world);
  const real = mapRealQuests(world, realQuests);
  const quests = real.length > 0 ? real : generated;
  const firstRealQuest = real[0];
  const matchingAvatar = firstRealQuest?.avatarName
    ? avatars.find((a) => a.name?.toLowerCase() === firstRealQuest.avatarName?.toLowerCase())
    : null;
  const level = getLevel(xp);
  const levelProgress = getLevelProgress(xp);

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
          <div className="mt-2 w-24">
            <div className="flex items-center justify-between text-[10px] text-gray-400">
              <span>Level {level}</span>
              <span>{credits} Z</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full transition-all"
                style={{ width: `${levelProgress * 100}%`, backgroundColor: color }}
              />
            </div>
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

        {matchingAvatar && (
          <div
            className="flex items-start gap-3 rounded-xl border p-3"
            style={{ borderColor: `${color}30`, backgroundColor: `${color}10` }}
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-xs font-bold"
              style={{ borderColor: `${color}50`, color, backgroundColor: `${color}20` }}
            >
              {matchingAvatar.name?.slice(0, 2) ?? '??'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white">{matchingAvatar.name}</p>
              <p className="text-[10px] text-oasis-cyan">{matchingAvatar.subtitle}</p>
              <p className="mt-1 text-[10px] italic leading-snug text-gray-300">“{matchingAvatar.teaching}”</p>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Active Quests</p>
          <div className="space-y-2">
            {quests.map((quest) => {
              const Icon = TYPE_ICONS[quest.type];
              const done = completedQuests.includes(quest.id);
              return (
                <div
                  key={quest.id}
                  className={`flex items-start gap-2.5 rounded-lg p-2 transition ${done ? 'bg-white/[0.02]' : 'bg-white/5'}`}
                >
                  <div className="mt-0.5 rounded p-1" style={{ backgroundColor: `${color}20`, color }}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className={`text-xs font-semibold ${done ? 'text-gray-500 line-through' : 'text-white'}`}>{quest.title}</p>
                      {quest.real && (
                        <span className="rounded bg-oasis-gold/20 px-1 text-[9px] font-bold text-oasis-gold">LIVE</span>
                      )}
                    </div>
                    {quest.avatarName && (
                      <p className="text-[10px] text-oasis-cyan">From: {quest.avatarName}</p>
                    )}
                    <p className="text-[10px] text-gray-400">{quest.description}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-right text-[10px] text-gray-400">
                    <p style={{ color }}>★ {quest.difficulty}</p>
                    <p>{quest.reward} XP</p>
                    <button
                      onClick={() => !done && completeQuest(quest.id, quest.reward)}
                      disabled={done}
                      className={`rounded px-2 py-0.5 text-[10px] font-bold transition ${
                        done
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-oasis-cyan/20 text-oasis-cyan hover:bg-oasis-cyan/30'
                      }`}
                    >
                      {done ? 'Done' : 'Complete'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {world.goldenEggClue !== undefined && (
            <button
              onClick={() => claimGoldenEgg(world.id)}
              disabled={collectedEggs.includes(world.id) || credits < 100}
              className="flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition"
              style={{
                borderColor: `${color}30`,
                backgroundColor: collectedEggs.includes(world.id) ? `${color}10` : `${color}20`,
                opacity: collectedEggs.includes(world.id) || credits < 100 ? 0.6 : 1,
              }}
            >
              <Egg className="h-4 w-4" style={{ color }} />
              <div>
                <p className="text-[10px] uppercase tracking-wider" style={{ color: `${color}cc` }}>Golden Egg</p>
                <p className="text-sm font-semibold text-white">
                  {collectedEggs.includes(world.id) ? 'Collected' : `Clue ${world.goldenEggClue}`}
                </p>
                <p className="text-[9px] text-gray-400">
                  {collectedEggs.includes(world.id) ? '+500 XP' : '100 Z to claim'}
                </p>
              </div>
            </button>
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
