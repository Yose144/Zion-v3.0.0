'use client';

import { motion } from 'framer-motion';
import { X, Globe, Layers, MapPin, Sparkles, Eye, Egg, Tag, Swords, Compass, Pickaxe, Brain, Users, Shield, Cpu, Gem, Users2, ScrollText, Zap, ScanLine } from 'lucide-react';
import type { World } from '../domain/types/world';
import { generateQuests, type Quest } from '../domain/quests';
import { useGameStore, getLevel, getLevelProgress } from '../store/gameStore';
import { awardPlayerXp, completePlayerQuest } from '../lib/api';
import { useAudio } from './AudioEngine';
import { useToastStore } from '../store/toastStore';

const TYPE_ICONS: Record<Quest['type'], typeof Compass> = {
  exploration: Compass,
  combat: Swords,
  harvest: Pickaxe,
  puzzle: Brain,
  social: Users,
};

/* ZION-theme-aligned functional colors */
const CATEGORY_COLORS: Record<string, string> = {
  'star-system': '#fbbf24',
  'planet': '#06b6d4',
  'sector': '#9333ea',
  'world': '#10b981',
  'dimension': '#ec4899',
};

const CATEGORY_RGB: Record<string, string> = {
  'star-system': '251, 191, 36',
  'planet': '6, 182, 212',
  'sector': '147, 51, 234',
  'world': '16, 185, 129',
  'dimension': '236, 72, 153',
};

const CATEGORY_LABELS: Record<string, string> = {
  'star-system': 'Star System',
  'planet': 'Planet',
  'sector': 'Sector',
  'world': 'World',
  'dimension': 'Dimension',
};

/* ── Nova Zeme L5 Pioneer Projects (from web2.9 TerraNova) ── */
const NOVA_ZEME_PROJECTS = [
  {
    id: 'genesis',
    name: 'Zahrada Genesis',
    location: 'Algarve · Portugalsko',
    color: '#22c55e',
    status: 'Active',
    desc: 'Atlantický uzel Terra Nova — organická farma, glamping, solar off-grid, surf a sázení stromů. První dlouhodobá komunitní infrastruktura.',
    href: 'https://app.zionterranova.com/terranova/genesis',
  },
  {
    id: 'dharma',
    name: 'Dharma Temple',
    location: 'La Palma · Kanárské ostrovy',
    color: '#a855f7',
    status: 'Prep',
    desc: 'Spirituální a vzdělávací uzel — meditace, syntropic zahrada, dharma governance, vulkanická krajina, off-grid voda. UNESCO Biosphere Reserve.',
    href: 'https://app.zionterranova.com/terranova/dharma-temple',
  },
  {
    id: 'piko-ora',
    name: 'Te Pīko Ora',
    location: 'Tahiti · Francouzská Polynésie',
    color: '#06b6d4',
    status: 'Planned',
    desc: 'Tichomořský uzel — ochrana mořského i pozemského dědictví, regenerativní komunita, kulturní most mezi Polynésií a ZION.',
    href: 'https://app.zionterranova.com/terranova/te-piko-ora',
  },
];

interface WorldPanelProps {
  world: World;
  onClose: () => void;
  onEnter: () => void;
}

/* ── World Intel generation ── */
function generateWorldIntel(world: World) {
  const seed = world.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const rng = (n: number) => ((seed * 9301 + 49297 + n * 233280) % 233280) / 233280;

  const dangerBase: Record<string, number> = { 'star-system': 3, 'planet': 4, 'sector': 5, 'world': 6, 'dimension': 8 };
  const techBase: Record<string, number> = { 'star-system': 5, 'planet': 4, 'sector': 7, 'world': 3, 'dimension': 9 };
  const resourceBase: Record<string, number> = { 'star-system': 6, 'planet': 8, 'sector': 5, 'world': 7, 'dimension': 4 };
  const popBase: Record<string, string> = {
    'star-system': 'Sparse outposts',
    'planet': 'Colonial settlements',
    'sector': 'Diverse guilds',
    'world': 'Ancient tribes',
    'dimension': 'Beyond counting',
  };

  const danger = Math.min(10, Math.max(1, Math.round((dangerBase[world.category] ?? 5) + world.layer * 0.5 + rng(1) * 3)));
  const tech = Math.min(10, Math.max(1, Math.round((techBase[world.category] ?? 5) + rng(2) * 4 - 1)));
  const resources = Math.min(10, Math.max(1, Math.round((resourceBase[world.category] ?? 5) + rng(3) * 4 - 1)));
  const population = popBase[world.category] ?? 'Unknown';

  return { danger, tech, resources, population };
}

/* ── Lore fragment generation ── */
const LORE_FRAGMENTS: Record<string, string[]> = {
  'star-system': [
    'Ancient star-charts mark this system as a convergence point for hyperspace lanes. Pilgrims who navigate its outer rings report hearing resonant frequencies that predate known civilization.',
    'The central star pulses with an unusual cadence, as if transmitting a message. Local explorers have built shrines on the inner planets, believing the light carries instructions from the first architects.',
    'Deep within the asteroid belt, dormant probes drift in silent formation — relics of a survey mission that vanished three centuries ago. Their data cores remain sealed.',
  ],
  'planet': [
    'Beneath the surface of {name}, vast crystalline networks hum with stored energy. The first settlers called them the Veins of Light, and they have powered every civilization that has risen here.',
    'The atmosphere of {name} shifts through spectral colors at dawn, a phenomenon the indigenous people read as omens. Today\'s hue suggests a time of gathering.',
    'Orbital scans reveal geometric patterns carved into the polar ice — too precise to be natural. Whoever left them had technology that rivaled our own, millennia before the first colony ship arrived.',
  ],
  'sector': [
    'This sector sits at the crossroads of three major trade routes. Guilds have fought over its relay stations for generations, but none have held them for long. The sector remembers.',
    'Hidden within the nebula clouds of {name}, a decommissioned battlestation drifts in silent orbit. Its weapons are cold, but its archives are said to contain maps to lost worlds.',
    'The comm buoys in this sector transmit fragments of an old dialect — one that no living linguist can fully parse. Some words match the chants used by Pilgrims during their Rite of Passage.',
  ],
  'world': [
    'The elders of {name} speak of a time before the Layering, when this world existed in a single dimension. They guard the memory stones that hold those fragments of history.',
    'Every cycle, the sacred geometry of {name} realigns. Pilgrims who witness the alignment report visions of their own future, though few can interpret what they see.',
    'Beneath the temple ruins, a living consciousness stirs. It does not speak in words, but in patterns of light and warmth. Those who approach with reverence receive its blessing.',
  ],
  'dimension': [
    'This dimension folds upon itself in ways that defy three-dimensional logic. Time here is not a river but an ocean, and those who enter may emerge before they arrived.',
    'The walls between {name} and adjacent realities grow thin. Pilgrims report seeing echoes of themselves living different lives, making different choices, walking different paths.',
    'At the center of this dimension lies a point of pure stillness — a place where all possibilities converge. Some call it the Nexus. Others call it the Throne. None have reached it and returned unchanged.',
  ],
};

function generateLore(world: World): string {
  const pool = LORE_FRAGMENTS[world.category] ?? LORE_FRAGMENTS['world'];
  const seed = world.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return pool[seed % pool.length].replace('{name}', world.name);
}

/* ── Stat bar component ── */
function StatBar({ icon: Icon, label, value, color }: { icon: typeof Shield; label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[9px]">
        <span className="flex items-center gap-1 text-gray-400">
          <Icon className="h-2.5 w-2.5" style={{ color }} />
          {label}
        </span>
        <span className="font-mono font-bold" style={{ color }}>{value}/10</span>
      </div>
      <div className="zion-progress mt-0.5">
        <div style={{ width: `${value * 10}%`, backgroundColor: color }} />
      </div>
    </div>
  );
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
  const rc = CATEGORY_RGB[world.category] || '255, 255, 255';
  const { xp, credits, address, completeQuest, completedQuests, realQuests, avatars, claimGoldenEgg, collectedEggs, syncPlayer, shipLoadout, addXp, addCredits } = useGameStore();
  const { playQuestComplete } = useAudio();
  const addToast = useToastStore((s) => s.add);
  const generated = generateQuests(world);
  const real = mapRealQuests(world, realQuests);
  const quests = real.length > 0 ? real : generated;
  const firstRealQuest = real[0];
  const matchingAvatar = firstRealQuest?.avatarName
    ? avatars.find((a) => a.name?.toLowerCase() === firstRealQuest.avatarName?.toLowerCase())
    : null;
  const level = getLevel(xp);
  const levelProgress = getLevelProgress(xp);
  const intel = generateWorldIntel(world);
  const lore = generateLore(world);

  return (
    <motion.div
      initial={{ opacity: 0, y: -30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -30 }}
      transition={{ duration: 0.4 }}
      className="pointer-events-auto absolute left-1/2 top-2 z-[60] max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] -translate-x-1/2 overflow-y-auto p-4 sm:top-5 sm:w-[28rem] sm:max-h-[calc(100dvh-2.5rem)] sm:p-5 zion-hud-panel"
    >
      <div className="mb-4 flex items-start justify-between">
        <div>
          <span
            className="zion-badge text-[9px]"
            style={{
              borderColor: `rgba(${rc}, 0.35)`,
              backgroundColor: `rgba(${rc}, 0.1)`,
              color,
            }}
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
            <Layers className="h-3 w-3" style={{ color }} />
            <span>Layer {world.layer}</span>
          </div>
          <div className="mt-2 w-24">
            <div className="flex items-center justify-between text-[10px] text-gray-400">
              <span>Level {level}</span>
              <span>{credits} Z</span>
            </div>
            <div className="zion-progress mt-1">
              <div style={{ width: `${levelProgress * 100}%`, backgroundColor: color }} />
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="zion-button-ghost !p-2 text-gray-400"
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

        <div className="zion-rainbow-sub p-3.5" style={{ '--rc': rc } as React.CSSProperties}>
          <p className="text-sm leading-relaxed text-gray-200">{world.summary}</p>
        </div>

        {/* ── Nova Zeme Pioneer Projects (L5) ── */}
        {world.id === 'NOVA_ZEME' && (
          <div className="zion-rainbow-sub p-3.5" style={{ '--rc': '34, 197, 94' } as React.CSSProperties}>
            <div className="mb-3 flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-emerald-400" />
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                L5 Pioneer Projects · Terra Nova Nodes
              </p>
            </div>
            <div className="space-y-2.5">
              {NOVA_ZEME_PROJECTS.map((p) => (
                <a
                  key={p.id}
                  href={p.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg border border-white/5 bg-white/[0.02] p-3 transition hover:border-white/15 hover:bg-white/[0.04]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ background: p.color, boxShadow: `0 0 8px ${p.color}` }}
                        />
                        <h4 className="text-sm font-bold text-white">{p.name}</h4>
                      </div>
                      <p className="mt-0.5 text-[10px] text-gray-500">{p.location}</p>
                      <p className="mt-1.5 text-[11px] leading-snug text-gray-400">{p.desc}</p>
                    </div>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider"
                      style={{
                        border: `1px solid ${p.color}40`,
                        background: `${p.color}10`,
                        color: p.color,
                      }}
                    >
                      {p.status}
                    </span>
                  </div>
                </a>
              ))}
            </div>
            <p className="mt-3 text-[9px] text-gray-500">
              Klikni na projekt → otevře detail na zionterranova.com
            </p>
          </div>
        )}

        {/* ── World Intel ── */}
        <div className="zion-rainbow-sub p-3" style={{ '--rc': rc } as React.CSSProperties}>
          <div className="mb-2 flex items-center gap-1.5">
            <Compass className="h-3 w-3" style={{ color }} />
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-300">World Intel</p>
          </div>
          <div className="space-y-2">
            <StatBar icon={Shield} label="Danger" value={intel.danger} color="#ef4444" />
            <StatBar icon={Cpu} label="Tech Level" value={intel.tech} color="#06b6d4" />
            <StatBar icon={Gem} label="Resources" value={intel.resources} color="#fbbf24" />
          </div>
          <div className="mt-2 flex items-center gap-1.5 border-t border-white/5 pt-2 text-[9px]">
            <Users2 className="h-2.5 w-2.5" style={{ color }} />
            <span className="text-gray-400">Population:</span>
            <span className="font-semibold text-white">{intel.population}</span>
          </div>
        </div>

        {/* ── Lore Fragment ── */}
        <div className="zion-rainbow-sub p-3.5" style={{ '--rc': rc } as React.CSSProperties}>
          <div className="mb-1.5 flex items-center gap-1.5">
            <ScrollText className="h-3 w-3" style={{ color }} />
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-300">Lore Fragment</p>
          </div>
          <p className="text-[11px] italic leading-relaxed text-gray-300">{lore}</p>
        </div>

        {world.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {world.tags.map((tag) => (
              <span
                key={tag}
                className="zion-badge text-[10px]"
              >
                <Tag className="h-2.5 w-2.5" />
                {tag}
              </span>
            ))}
          </div>
        )}

        {matchingAvatar && (
          <div
            className="zion-rainbow-sub p-3"
            style={{ '--rc': rc } as React.CSSProperties}
          >
            <div className="flex items-start gap-3">
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
          </div>
        )}

        <div className="zion-rainbow-sub p-3" style={{ '--rc': rc } as React.CSSProperties}>
          <div className="mb-2 flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" style={{ color }} />
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-300">Active Quests</p>
          </div>
          <div className="space-y-2">
            {quests.map((quest) => {
              const Icon = TYPE_ICONS[quest.type];
              const done = completedQuests.includes(quest.id);
              return (
                <div
                  key={quest.id}
                  className={`zion-rainbow-sub flex items-start gap-2.5 p-2 ${done ? 'opacity-60' : ''}`}
                  style={{ '--rc': rc } as React.CSSProperties}
                >
                  <div className="mt-0.5 rounded p-1" style={{ backgroundColor: `${color}20`, color }}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className={`text-xs font-semibold ${done ? 'text-gray-500 line-through' : 'text-white'}`}>{quest.title}</p>
                      {quest.real && (
                        <span className="zion-badge zion-badge-gold text-[8px] py-0.5 px-1">LIVE</span>
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
                      onClick={async () => {
                        if (!done) {
                          completeQuest(quest.id, quest.reward);
                          playQuestComplete();
                          addToast(`Quest completed: +${quest.reward} XP`, 'success', 3000);
                          if (address && quest.real) {
                            await completePlayerQuest(address, quest.id);
                            await syncPlayer();
                          }
                        }
                      }}
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
              onClick={async () => {
                const ok = claimGoldenEgg(world.id);
                if (ok) {
                  addToast(`Golden Egg found on ${world.name}: +500 XP`, 'success', 4000);
                  if (address) {
                    await awardPlayerXp(address, 50, 'golden_egg', { world: world.name });
                    await syncPlayer();
                  }
                } else if (credits < 100) addToast('Not enough credits (100 Z needed)', 'warning', 3000);
              }}
              disabled={collectedEggs.includes(world.id) || credits < 100}
              className="zion-rainbow-sub flex items-center gap-2.5 p-2.5 text-left transition"
              style={{ '--rc': rc } as React.CSSProperties}
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

          <div
            className="zion-rainbow-sub flex items-center gap-2.5 p-2.5"
            style={{ '--rc': rc } as React.CSSProperties}
          >
            <Sparkles className="h-4 w-4" style={{ color }} />
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400">Archetype</p>
              <p className="text-sm font-semibold text-white">{CATEGORY_LABELS[world.category]}</p>
            </div>
          </div>
        </div>

        {/* ── Quick Actions ── */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={async () => {
              const xpGain = 25 + shipLoadout.scanner * 10;
              addXp(xpGain);
              addToast(`Deep scan: +${xpGain} XP`, 'success', 2500);
              if (address) {
                await awardPlayerXp(address, Math.min(50, Math.round(xpGain / 10)), 'scan', { world: world.name });
                await syncPlayer();
              }
            }}
            className="zion-rainbow-sub flex flex-col items-center gap-1 rounded-lg p-2.5 transition hover:scale-105"
            style={{ '--rc': rc } as React.CSSProperties}
          >
            <ScanLine className="h-4 w-4 text-oasis-cyan" />
            <span className="text-[9px] font-bold text-gray-300">Scan</span>
            <span className="text-[8px] text-gray-500">+{25 + shipLoadout.scanner * 10} XP</span>
          </button>
          <button
            onClick={async () => {
              const xpGain = 40 + level * 5;
              const creditGain = Math.round(intel.resources * 15 + Math.random() * 50);
              addXp(xpGain);
              addCredits(creditGain);
              addToast(`Exploration: +${xpGain} XP, +${creditGain} Z`, 'success', 3000);
              if (address) {
                await awardPlayerXp(address, Math.min(80, Math.round(xpGain / 10)), 'explore', { world: world.name });
                await syncPlayer();
              }
            }}
            className="zion-rainbow-sub flex flex-col items-center gap-1 rounded-lg p-2.5 transition hover:scale-105"
            style={{ '--rc': rc } as React.CSSProperties}
          >
            <Compass className="h-4 w-4 text-oasis-emerald" />
            <span className="text-[9px] font-bold text-gray-300">Explore</span>
            <span className="text-[8px] text-gray-500">XP + Z</span>
          </button>
          <button
            onClick={async () => {
              const creditGain = Math.round(intel.resources * 25 + shipLoadout.cargo * 20);
              addCredits(creditGain);
              addToast(`Harvested: +${creditGain} Z`, 'success', 2500);
              if (address) {
                await awardPlayerXp(address, 5, 'harvest', { world: world.name });
                await syncPlayer();
              }
            }}
            className="zion-rainbow-sub flex flex-col items-center gap-1 rounded-lg p-2.5 transition hover:scale-105"
            style={{ '--rc': rc } as React.CSSProperties}
          >
            <Gem className="h-4 w-4 text-oasis-gold" />
            <span className="text-[9px] font-bold text-gray-300">Harvest</span>
            <span className="text-[8px] text-gray-500">+{intel.resources * 25 + shipLoadout.cargo * 20} Z</span>
          </button>
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
