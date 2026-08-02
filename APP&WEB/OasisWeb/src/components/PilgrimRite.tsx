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
  const [step, setStep] = useState<Step>('morpheus');
  const [blueNote, setBlueNote] = useState(false);
  const applyArchetype = useGameStore((s) => s.applyArchetype);
  const avatarConfig = useGameStore((s) => s.avatarConfig);
  const setAvatarConfig = useGameStore((s) => s.setAvatarConfig);

  const choosePill = (pill: 'red' | 'blue') => {
    if (pill === 'blue') {
      setBlueNote(true);
      return;
    }
    setStep('customize');
  };

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
          {step === 'morpheus' ? (
            <motion.div
              key="morpheus"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.35 }}
              className="relative z-10 flex flex-col items-center text-center"
            >
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#ffd700]/30 bg-[#ffd700]/10 px-3 py-1 text-xs font-bold tracking-wider text-[#ffd700]">
                <Sparkles size={12} />
                PILGRIM RITE
              </div>
              <h2 className="mb-2 text-2xl font-black tracking-tight text-white sm:text-4xl">
                You stand at the threshold.
              </h2>
              <p className="mb-8 max-w-lg text-sm leading-relaxed text-slate-300 sm:text-base">
                The OASIS is more than a map. It is a mirror. One choice opens
                the real path. The other keeps you in the illusion.
              </p>

              {blueNote ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mb-8 w-full max-w-lg rounded-xl border border-cyan-500/30 bg-cyan-950/30 p-5 text-cyan-100"
                >
                  <p className="mb-4 text-sm">
                    You hold the blue pill. The illusion remains intact, and you
                    may still enter as a visitor.
                  </p>
                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                    <button
                      onClick={() => setBlueNote(false)}
                      className="zion-button-ghost"
                    >
                      I want the truth
                    </button>
                    <button onClick={onEnter} className="zion-button-secondary">
                      Enter as visitor
                    </button>
                  </div>
                </motion.div>
              ) : (
                <div className="grid w-full max-w-lg grid-cols-1 gap-4 sm:grid-cols-2">
                  <button
                    onClick={() => choosePill('red')}
                    className="group relative flex flex-col items-center gap-3 rounded-2xl border border-red-500/40 bg-red-950/40 p-6 transition-all hover:border-red-500 hover:bg-red-900/50 hover:shadow-[0_0_30px_rgba(239,68,68,0.3)]"
                  >
                    <Flame className="text-red-400" size={32} />
                    <span className="text-lg font-bold text-red-100">
                      Red pill
                    </span>
                    <span className="text-xs text-red-200/70">
                      Enter the real OASIS
                    </span>
                  </button>

                  <button
                    onClick={() => choosePill('blue')}
                    className="group relative flex flex-col items-center gap-3 rounded-2xl border border-cyan-500/40 bg-cyan-950/40 p-6 transition-all hover:border-cyan-500 hover:bg-cyan-900/50 hover:shadow-[0_0_30px_rgba(6,182,212,0.3)]"
                  >
                    <Droplets className="text-cyan-400" size={32} />
                    <span className="text-lg font-bold text-cyan-100">
                      Blue pill
                    </span>
                    <span className="text-xs text-cyan-200/70">
                      Stay in the illusion
                    </span>
                  </button>
                </div>
              )}
            </motion.div>
          ) : step === 'customize' ? (
            <motion.div
              key="customize"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.35 }}
              className="relative z-10 flex w-full max-w-2xl flex-col items-center text-center"
            >
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#d946ef]/30 bg-[#d946ef]/10 px-3 py-1 text-xs font-bold tracking-wider text-[#d946ef]">
                <Cpu size={12} />
                AVATAR CONFIGURATION
              </div>
              <h2 className="mb-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
                Build your vessel
              </h2>
              <p className="mb-6 max-w-md text-sm leading-relaxed text-slate-300">
                Neon rain falls on chrome towers. Your body is a canvas —
                sculpt it, augment it, make it yours.
              </p>

              {/* Callsign */}
              <div className="mb-4 w-full max-w-md text-left">
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <User size={12} /> Callsign
                </label>
                <input
                  type="text"
                  value={avatarConfig.callsign}
                  onChange={(e) => setAvatarConfig({ callsign: e.target.value.slice(0, 20) })}
                  placeholder="Enter your callsign..."
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-gray-600 outline-none transition focus:border-[#d946ef]/50"
                />
              </div>

              {/* Body Type */}
              <div className="mb-4 w-full max-w-md text-left">
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <Cpu size={12} /> Body Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {BODY_TYPES.map((bt) => {
                    const selected = avatarConfig.bodyType === bt.id;
                    return (
                      <button
                        key={bt.id}
                        onClick={() => setAvatarConfig({ bodyType: bt.id })}
                        className={`rounded-lg border px-2 py-2 text-center transition ${
                          selected
                            ? 'border-[#d946ef] bg-[#d946ef]/15'
                            : 'border-white/5 bg-white/[0.02] hover:border-white/15'
                        }`}
                      >
                        <p className={`text-xs font-bold ${selected ? 'text-[#d946ef]' : 'text-gray-300'}`}>
                          {bt.label}
                        </p>
                        <p className="mt-0.5 text-[9px] leading-tight text-gray-500">{bt.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Neon Accent Color */}
              <div className="mb-4 w-full max-w-md text-left">
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <Sparkles size={12} /> Neon Accent
                </label>
                <div className="flex flex-wrap gap-2">
                  {NEON_COLORS.map((c) => {
                    const selected = avatarConfig.neonColor === c.hex;
                    return (
                      <button
                        key={c.hex}
                        onClick={() => setAvatarConfig({ neonColor: c.hex })}
                        className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition ${
                          selected ? 'border-white' : 'border-transparent'
                        }`}
                        style={{
                          backgroundColor: c.hex,
                          boxShadow: selected ? `0 0 12px ${c.hex}` : 'none',
                        }}
                        title={c.label}
                      >
                        {selected && <div className="h-2 w-2 rounded-full bg-white" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Augmentation */}
              <div className="mb-6 w-full max-w-md text-left">
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <Eye size={12} /> Augmentation
                </label>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {AUGMENTS.map((aug) => {
                    const selected = avatarConfig.augmentation === aug.id;
                    const Icon = aug.icon;
                    return (
                      <button
                        key={aug.id}
                        onClick={() => setAvatarConfig({ augmentation: aug.id })}
                        className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition ${
                          selected
                            ? 'border-[#d946ef] bg-[#d946ef]/15'
                            : 'border-white/5 bg-white/[0.02] hover:border-white/15'
                        }`}
                      >
                        <div
                          className="rounded p-1"
                          style={{
                            color: selected ? '#d946ef' : '#64748b',
                            background: selected ? '#d946ef20' : 'transparent',
                          }}
                        >
                          <Icon size={14} />
                        </div>
                        <div>
                          <p className={`text-xs font-bold ${selected ? 'text-[#d946ef]' : 'text-gray-300'}`}>
                            {aug.label}
                          </p>
                          <p className="text-[9px] leading-tight text-gray-500">{aug.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={() => setStep('archetype')}
                className="zion-button-primary"
              >
                Proceed to path selection
              </button>

              <button
                onClick={() => setStep('morpheus')}
                className="mt-4 text-xs text-slate-500 underline underline-offset-4 transition-colors hover:text-[#d946ef]"
              >
                Go back
              </button>
            </motion.div>
          ) : (
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

              <button
                onClick={() => setStep('customize')}
                className="mt-6 text-xs text-slate-500 underline underline-offset-4 transition-colors hover:text-[#ffd700]"
              >
                Go back to avatar config
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
