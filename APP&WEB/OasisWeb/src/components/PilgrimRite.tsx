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
  Rocket,
  User,
  Eye,
} from 'lucide-react';
import { useGameStore, type Archetype } from '@/store/gameStore';
import AvatarCustomizer from './AvatarCustomizer';
import { useAuth } from '@/contexts/AuthContext';

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
    color: '#e41e2b',
    rgb: '228, 30, 43',
    desc: 'Fight for truth and break through limits.',
    bonus: '+1 Engine Boost',
  },
  {
    id: 'trader',
    label: 'Trader',
    icon: Coins,
    color: '#fcd116',
    rgb: '252, 209, 22',
    desc: 'Move value across worlds and fleets.',
    bonus: '+1 Cargo Hold',
  },
  {
    id: 'explorer',
    label: 'Explorer',
    icon: Crosshair,
    color: '#078930',
    rgb: '7, 137, 48',
    desc: 'Uncover hidden signals and new frontiers.',
    bonus: '+1 Scanner Range',
  },
  {
    id: 'sage',
    label: 'Sage',
    icon: Brain,
    color: '#e41e2b',
    rgb: '228, 30, 43',
    desc: 'See the pattern and act with wisdom.',
    bonus: '+50 Z · +100 XP',
  },
];


interface PilgrimRiteProps {
  onEnter: () => void;
}

export function PilgrimRite({ onEnter }: PilgrimRiteProps) {
  const [step, setStep] = useState<Step>('morpheus');
  const applyArchetype = useGameStore((s) => s.applyArchetype);
  const { user } = useAuth();

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
          {step === 'morpheus' && (
            <motion.div
              key="morpheus"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.35 }}
              className="relative z-10 flex flex-col items-center text-center"
            >
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#9333ea]/30 bg-[#9333ea]/10 px-3 py-1 text-xs font-bold tracking-wider text-[#9333ea]">
                <Eye size={12} />
                THE GUIDE
              </div>
              <h2 className="mb-2 text-2xl font-black tracking-tight text-white sm:text-4xl">
                You made it this far, Pilgrim.
              </h2>
              <p className="mb-10 max-w-lg text-sm leading-relaxed text-white/80 sm:text-base">
                Beyond this threshold your identity becomes real — etched into the
                worlds you will walk. One last choice before the gates open.
              </p>

              <div className="flex w-full max-w-md flex-col gap-4 sm:flex-row">
                {/* Blue pill — keep the default form, skip customization */}
                <button
                  onClick={() => setStep('archetype')}
                  className="group flex-1 rounded-2xl border border-[#3b82f6]/40 bg-[#3b82f6]/10 p-5 text-left transition-all hover:-translate-y-1 hover:border-[#3b82f6]/70"
                >
                  <div className="mx-auto mb-3 h-4 w-10 rounded-full bg-[#3b82f6] shadow-[0_0_18px_#3b82f6aa] transition-transform group-hover:scale-110" />
                  <p className="mb-1 text-center text-sm font-black text-[#60a5fa]">Stay as you are</p>
                  <p className="text-center text-[11px] leading-snug text-white/60">
                    Enter with the default form. You can always reshape later.
                  </p>
                </button>
                {/* Red pill — forge a custom avatar first */}
                <button
                  onClick={() => setStep('customize')}
                  className="group flex-1 rounded-2xl border border-[#e41e2b]/40 bg-[#e41e2b]/10 p-5 text-left transition-all hover:-translate-y-1 hover:border-[#e41e2b]/70"
                >
                  <div className="mx-auto mb-3 h-4 w-10 rounded-full bg-[#e41e2b] shadow-[0_0_18px_#e41e2baa] transition-transform group-hover:scale-110" />
                  <p className="mb-1 text-center text-sm font-black text-[#f87171]">Forge your avatar</p>
                  <p className="text-center text-[11px] leading-snug text-white/60">
                    Choose a callsign, body, neon trim and augmentation.
                  </p>
                </button>
              </div>
            </motion.div>
          )}

          {step === 'customize' && (
            <motion.div
              key="customize"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.35 }}
              className="relative z-10 flex max-h-[80vh] flex-col overflow-y-auto"
            >
              <div className="mb-4 inline-flex items-center gap-2 self-center rounded-full border border-[#fcd116]/30 bg-[#fcd116]/10 px-3 py-1 text-xs font-bold tracking-wider text-[#fcd116]">
                <User size={12} />
                FORGE YOUR AVATAR
              </div>
              <h2 className="mb-2 text-center text-2xl font-black tracking-tight text-white sm:text-3xl">
                Who steps into the OASIS?
              </h2>
              <p className="mb-6 text-center text-sm leading-relaxed text-white/80">
                Shape your in-world identity — callsign, body, neon trim and augmentation.
                {user ? ' Synced to your ZIS identity.' : ''}
              </p>
              <AvatarCustomizer
                seed={user?.id}
                avatarSrc={user?.avatar}
                onDone={() => setStep('archetype')}
                doneLabel="Continue →"
              />
            </motion.div>
          )}

          {step === 'archetype' && (
            <motion.div
              key="archetype"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.35 }}
              className="relative z-10 flex flex-col items-center text-center"
            >
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#fcd116]/30 bg-[#fcd116]/10 px-3 py-1 text-xs font-bold tracking-wider text-[#fcd116]">
                <Rocket size={12} />
                CHOOSE YOUR PATH
              </div>
              <h2 className="mb-2 text-2xl font-black tracking-tight text-white sm:text-4xl">
                What kind of Pilgrim are you?
              </h2>
              <p className="mb-8 max-w-lg text-sm leading-relaxed text-white/80 sm:text-base">
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
                      <p className="mb-3 text-xs leading-snug text-white/80">
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
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
