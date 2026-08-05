'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import {
  Brain,
  Briefcase,
  Crosshair,
  Coins,
  Flame,
  Droplets,
  Rocket,
  Sparkles,
  User,
  Cpu,
  Eye,
  Zap,
  Heart,
  Wrench,
  Ghost,
} from 'lucide-react';
import { useGameStore, type Archetype, type BodyType, type Augmentation } from '@/store/gameStore';

type Step = 'morpheus' | 'customize' | 'archetype';

interface ArchetypeMeta {
  id: NonNullable<Archetype>;
  label: string;
  icon: LucideIcon;
  color: string;
  rgb: string;
  desc: string;
  bonus: string;
}

const ARCHETYPES: ArchetypeMeta[] = [
  {
    id: 'warrior',
    label: 'Warrior',
    icon: Flame,
    color: '#ef4444',
    rgb: '239, 68, 68',
    desc: 'Fight for truth and break through limits.',
    bonus: '+1 Engine Boost',
  },
  {
    id: 'trader',
    label: 'Trader',
    icon: Coins,
    color: '#fbbf24',
    rgb: '251, 191, 36',
    desc: 'Move value across worlds and fleets.',
    bonus: '+1 Cargo Hold',
  },
  {
    id: 'explorer',
    label: 'Explorer',
    icon: Crosshair,
    color: '#06b6d4',
    rgb: '6, 182, 212',
    desc: 'Uncover hidden signals and new frontiers.',
    bonus: '+1 Scanner Range',
  },
  {
    id: 'sage',
    label: 'Sage',
    icon: Brain,
    color: '#9333ea',
    rgb: '147, 51, 234',
    desc: 'See the pattern and act with wisdom.',
    bonus: '+50 Z · +100 XP',
  },
];

const BODY_TYPES: { id: BodyType; label: string; desc: string }[] = [
  { id: 'slim', label: 'Slim', desc: 'Agile — faster reflexes' },
  { id: 'standard', label: 'Standard', desc: 'Balanced — versatile' },
  { id: 'heavy', label: 'Heavy', desc: 'Resilient — more capacity' },
];

const NEON_COLORS = [
  { hex: '#06b6d4', label: 'Cyan' },
  { hex: '#d946ef', label: 'Magenta' },
  { hex: '#ffd700', label: 'Gold' },
  { hex: '#10b981', label: 'Emerald' },
  { hex: '#ef4444', label: 'Crimson' },
  { hex: '#a78bfa', label: 'Violet' },
];

const AUGMENTS: { id: Augmentation; label: string; icon: LucideIcon; desc: string }[] = [
  { id: 'reflexes', label: 'Reflexes', icon: Zap, desc: 'Faster reaction time' },
  { id: 'neural', label: 'Neural', icon: Brain, desc: 'Enhanced cognition' },
  { id: 'tech', label: 'Tech', icon: Wrench, desc: 'Gadget mastery' },
  { id: 'bio', label: 'Bio', icon: Heart, desc: 'Regenerative implants' },
  { id: 'stealth', label: 'Stealth', icon: Ghost, desc: 'Optical camouflage' },
];

interface PilgrimRiteProps {
  onEnter: () => void;
}

export function PilgrimRite({ onEnter }: PilgrimRiteProps) {
  const [step, setStep] = useState<Step>('archetype');
  const applyArchetype = useGameStore((s) => s.applyArchetype);

  const selectArchetype = (archetype: NonNullable<Archetype>) => {
    applyArchetype(archetype);
    onEnter();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="zion-hud-panel relative w-full max-w-3xl overflow-hidden p-6 sm:p-10"
      >
        <AnimatePresence mode="wait">
          <motion.div
              key="archetype"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.35 }}
              className="relative z-10 flex flex-col items-center text-center"
            >
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#ffd700]/30 bg-[#ffd700]/10 px-3 py-1 text-xs font-bold tracking-wider text-[#ffd700]">
                <Rocket size={12} />
                CHOOSE YOUR PATH
              </div>
              <h2 className="mb-2 text-2xl font-black tracking-tight text-white sm:text-4xl">
                What kind of Pilgrim are you?
              </h2>
              <p className="mb-8 max-w-lg text-sm leading-relaxed text-slate-300 sm:text-base">
                Your path shapes your starting ship and your first advantage.
                Choose wisely — it can be changed later, but never forgotten.
              </p>

              <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                {ARCHETYPES.map((a) => {
                  const Icon = a.icon;
                  return (
                    <button
                      key={a.id}
                      onClick={() => selectArchetype(a.id)}
                      className="zion-rainbow-card group p-4 text-left transition-transform hover:-translate-y-1 sm:p-5"
                      style={{ '--rc': a.rgb, borderColor: `${a.color}40` } as React.CSSProperties}
                    >
                      <div
                        className="mb-3 inline-flex rounded-lg p-2"
                        style={{
                          background: `${a.color}20`,
                          color: a.color,
                        }}
                      >
                        <Icon size={24} />
                      </div>
                      <h3
                        className="mb-1 text-lg font-black"
                        style={{ color: a.color }}
                      >
                        {a.label}
                      </h3>
                      <p className="mb-3 text-xs leading-snug text-slate-300">
                        {a.desc}
                      </p>
                      <div className="zion-badge inline-flex items-center gap-1 text-[10px]">
                        <Briefcase size={10} />
                        {a.bonus}
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
