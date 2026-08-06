"use client";

import { useMemo, useState } from "react";
import { Crown, Sparkles, Sword, Heart, Zap, Brain, Eye, TreePine, Mountain, Shield } from "lucide-react";

// 🌟 Consciousness Levels mapped to Kabbalah Sephirot + DAO Circles
export const CONSCIOUSNESS_SEPHIROT = [
  {
    id: 'keter',
    name: 'KETER',
    title: 'Crown - Orbital Horizon',
    cl: 9,
    levelName: 'ON_THE_STAR',
    multiplier: 10.0,
    xpThreshold: 1000000,
    position: { x: 400, y: 60 },
    color: '#fbbf24',
    gradient: 'from-yellow-400 via-amber-500 to-orange-500',
    daoCircle: 'Guardians Council',
    description: 'Maitreya\'s Realm. Absolutní jednota. Guardians Council a dlouhodobé stewardství. 10× REWARDS!',
    icon: Crown,
    guardianCount: 0, // Will be updated from real data
  },
  {
    id: 'binah',
    name: 'BINAH',
    title: 'Understanding - Transcendent',
    cl: 8,
    levelName: 'TRANSCENDENT',
    multiplier: 5.0,
    xpThreshold: 500000,
    position: { x: 220, y: 160 },
    color: '#8b5cf6',
    gradient: 'from-purple-500 via-violet-600 to-fuchsia-600',
    daoCircle: 'Guardians Council',
    description: 'Beyond Duality. Governance voting power. Stewardship role.',
    icon: Eye,
    guardianCount: 0,
  },
  {
    id: 'chokhmah',
    name: 'CHOKHMAH',
    title: 'Wisdom - Transcendent',
    cl: 8,
    levelName: 'TRANSCENDENT',
    multiplier: 5.0,
    xpThreshold: 500000,
    position: { x: 580, y: 160 },
    color: '#8b5cf6',
    gradient: 'from-violet-500 via-purple-600 to-indigo-600',
    daoCircle: 'Guardians Council',
    description: 'Cosmic Wisdom. Council alignment and DAO guardianship.',
    icon: Sparkles,
    guardianCount: 0,
  },
  {
    id: 'daat',
    name: 'DA\'AT',
    title: 'Hidden Knowledge',
    cl: 7.5,
    levelName: 'DARK_NIGHT',
    multiplier: 4.0,
    xpThreshold: 375000,
    position: { x: 400, y: 240 },
    color: '#6366f1',
    gradient: 'from-indigo-600 via-blue-700 to-slate-800',
    daoCircle: 'Transition',
    description: 'The Abyss. Test between circles. Upgrade threshold.',
    icon: Shield,
    guardianCount: 0,
    hidden: true,
  },
  {
    id: 'chesed',
    name: 'CHESED',
    title: 'Mercy - Enlightened',
    cl: 7,
    levelName: 'ENLIGHTENED',
    multiplier: 3.0,
    xpThreshold: 250000,
    position: { x: 200, y: 320 },
    color: '#078930',
    gradient: 'from-cyan-400 via-teal-500 to-emerald-500',
    daoCircle: 'Builders Circle',
    description: 'Builders Circle. Core development and technical stewardship.',
    icon: Crown,
    guardianCount: 0,
  },
  {
    id: 'gevurah',
    name: 'GEVURAH',
    title: 'Strength - Cosmic',
    cl: 6,
    levelName: 'COSMIC',
    multiplier: 2.0,
    xpThreshold: 100000,
    position: { x: 600, y: 320 },
    color: '#ec4899',
    gradient: 'from-pink-500 via-rose-600 to-red-600',
    daoCircle: 'Builders Circle',
    description: 'Governance access. Protection of the realm.',
    icon: Sword,
    guardianCount: 0,
  },
  {
    id: 'tiferet',
    name: 'TIFERET',
    title: 'Beauty - Quantum',
    cl: 5,
    levelName: 'QUANTUM',
    multiplier: 1.5,
    xpThreshold: 40000,
    position: { x: 400, y: 420 },
    color: '#fbbf24',
    gradient: 'from-yellow-400 via-orange-500 to-amber-600',
    daoCircle: 'Community Guild',
    description: 'Heart Bodhisattva. Balance point. Community core.',
    icon: Heart,
    guardianCount: 0,
  },
  {
    id: 'netzach',
    name: 'NETZACH',
    title: 'Victory - Sacred',
    cl: 4,
    levelName: 'SACRED',
    multiplier: 1.25,
    xpThreshold: 15000,
    position: { x: 240, y: 540 },
    color: '#f59e0b',
    gradient: 'from-orange-400 via-amber-500 to-yellow-500',
    daoCircle: 'Community Guild',
    description: 'Community energy. Collaboration and shared growth.',
    icon: Zap,
    guardianCount: 0,
  },
  {
    id: 'hod',
    name: 'HOD',
    title: 'Glory - Mental',
    cl: 3,
    levelName: 'MENTAL',
    multiplier: 1.1,
    xpThreshold: 5000,
    position: { x: 560, y: 540 },
    color: '#078930',
    gradient: 'from-cyan-400 via-blue-500 to-indigo-500',
    daoCircle: 'Community Guild',
    description: 'Understanding blockchain. Entry point. Community member.',
    icon: Brain,
    guardianCount: 0,
  },
  {
    id: 'yesod',
    name: 'YESOD',
    title: 'Foundation - Emotional',
    cl: 2,
    levelName: 'EMOTIONAL',
    multiplier: 1.05,
    xpThreshold: 1000,
    position: { x: 400, y: 660 },
    color: '#a78bfa',
    gradient: 'from-purple-400 via-violet-500 to-purple-600',
    daoCircle: 'Seekers',
    description: 'First steps. Seeker. Curiosity awakens.',
    icon: TreePine,
    guardianCount: 0,
  },
  {
    id: 'malkuth',
    name: 'MALKUTH',
    title: 'Kingdom - Physical',
    cl: 1,
    levelName: 'PHYSICAL',
    multiplier: 1.0,
    xpThreshold: 0,
    position: { x: 400, y: 760 },
    color: '#10b981',
    gradient: 'from-emerald-400 via-green-500 to-teal-600',
    daoCircle: 'Seekers',
    description: 'Physical realm. Beginning. Invitation to join.',
    icon: Mountain,
    guardianCount: 0,
  },
];

// Lightning Flash paths (Tree of Life structure)
const LIGHTNING_PATHS = [
  ['keter', 'chokhmah'],
  ['chokhmah', 'binah'],
  ['binah', 'chesed'],
  ['chesed', 'tiferet'],
  ['tiferet', 'gevurah'],
  ['gevurah', 'hod'],
  ['hod', 'netzach'],
  ['netzach', 'yesod'],
  ['yesod', 'malkuth'],
];

interface ConsciousnessTreeKabbalahProps {
  guardianData?: {
    total144k: number;
    byTier: Record<string, number>;
  };
}

export default function ConsciousnessTreeKabbalah({ guardianData }: ConsciousnessTreeKabbalahProps) {
  const [hoveredSephira, setHoveredSephira] = useState<string | null>(null);

  // Update guardian counts from real data
  const sephirot = useMemo(
    () =>
      CONSCIOUSNESS_SEPHIROT.map((s) => ({
        ...s,
        guardianCount: guardianData?.byTier[s.daoCircle] || 0,
      })),
    [guardianData]
  );

  const sephirotById = useMemo(
    () => new Map(sephirot.map((item) => [item.id, item])),
    [sephirot]
  );

  return (
    <div className="relative mx-auto max-w-7xl">
      {/* Header Stats */}
      <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-zion-gold/10 to-black/80 p-6 text-center backdrop-blur-xl">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Shield className="w-5 h-5 text-zion-gold" />
            <span className="text-xs uppercase tracking-wider text-gray-400">Guardians</span>
          </div>
          <div className="text-4xl font-bold text-zion-gold">{guardianData?.total144k || 0}</div>
          <div className="text-sm text-gray-400">of 144,000 Chosen</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-zion-purple/10 to-black/80 p-6 text-center backdrop-blur-xl">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-zion-purple" />
            <span className="text-xs uppercase tracking-wider text-gray-400">Journey</span>
          </div>
          <div className="text-4xl font-bold text-zion-purple">9 Levels</div>
          <div className="text-sm text-gray-400">Consciousness Path</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/10 to-black/80 p-6 text-center backdrop-blur-xl">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Crown className="w-5 h-5 text-emerald-400" />
            <span className="text-xs uppercase tracking-wider text-gray-400">Max Power</span>
          </div>
          <div className="text-4xl font-bold text-emerald-400">10× Max</div>
          <div className="text-sm text-gray-400">Reward Multiplier</div>
        </div>
      </div>

      {/* SVG Tree */}
      <div className="relative rounded-3xl border border-white/10 bg-gradient-to-b from-black/80 to-black/60 p-8 backdrop-blur-xl">
        <svg
          viewBox="0 0 800 850"
          className="w-full h-auto"
          style={{ maxHeight: '900px' }}
        >
          {/* Definitions */}
          <defs>
            {/* Gradients for each Sephira */}
            {sephirot.map(s => (
              <radialGradient key={`grad-${s.id}`} id={`grad-${s.id}`}>
                <stop offset="0%" stopColor={s.color} stopOpacity="0.8" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0.3" />
              </radialGradient>
            ))}
            
            {/* Glow filter */}
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Pulse animation for Keter */}
            <animate
              id="pulse"
              attributeName="r"
              from="45"
              to="50"
              dur="2s"
              repeatCount="indefinite"
            />
          </defs>

          {/* Lightning Flash Paths */}
          {LIGHTNING_PATHS.map((path, idx) => {
            const from = sephirotById.get(path[0]);
            const to = sephirotById.get(path[1]);
            if (!from || !to) return null;

            return (
              <line
                key={`path-${idx}`}
                x1={from.position.x}
                y1={from.position.y}
                x2={to.position.x}
                y2={to.position.y}
                stroke="url(#grad-path)"
                strokeWidth="2"
                strokeOpacity="0.4"
                strokeDasharray="5,5"
              />
            );
          })}

          <defs>
            <linearGradient id="grad-path" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="50%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>

          {/* Sephirot Nodes */}
          {sephirot.map((sephira) => {
            if (sephira.hidden && !hoveredSephira) return null;

            const isHovered = hoveredSephira === sephira.id;
            const radius = isHovered ? 50 : 45;
            const opacity = sephira.hidden ? 0.5 : (isHovered ? 1 : 0.85);

            const Icon = sephira.icon;

            return (
              <g
                key={sephira.id}
                onMouseEnter={() => setHoveredSephira(sephira.id)}
                onMouseLeave={() => setHoveredSephira(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Outer glow */}
                <circle
                  cx={sephira.position.x}
                  cy={sephira.position.y}
                  r={radius + 10}
                  fill={sephira.color}
                  fillOpacity="0.2"
                  filter="url(#glow)"
                />

                {/* Main circle */}
                <circle
                  cx={sephira.position.x}
                  cy={sephira.position.y}
                  r={radius}
                  fill={`url(#grad-${sephira.id})`}
                  stroke={sephira.color}
                  strokeWidth="3"
                  opacity={opacity}
                  style={{ transition: 'all 0.3s ease' }}
                >
                  {sephira.id === 'keter' && <animate attributeName="r" from="45" to="50" dur="2s" repeatCount="indefinite" />}
                </circle>

                {/* Icon */}
                <foreignObject
                  x={sephira.position.x - 16}
                  y={sephira.position.y - 16}
                  width={32}
                  height={32}
                >
                  <div className="flex h-full w-full items-center justify-center">
                    <Icon className="h-6 w-6 text-white drop-shadow" />
                  </div>
                </foreignObject>

                {/* Name */}
                <text
                  x={sephira.position.x}
                  y={sephira.position.y - 60}
                  fontSize="14"
                  fontWeight="bold"
                  textAnchor="middle"
                  fill="white"
                >
                  {sephira.name}
                </text>

                {/* CL Level */}
                <text
                  x={sephira.position.x}
                  y={sephira.position.y + 70}
                  fontSize="12"
                  textAnchor="middle"
                  fill={sephira.color}
                  fontWeight="600"
                >
                  CL{Math.floor(sephira.cl)} · {sephira.multiplier}×
                </text>

                {/* Guardian Count */}
                {sephira.guardianCount > 0 && (
                  <text
                    x={sephira.position.x}
                    y={sephira.position.y + 88}
                    fontSize="11"
                    textAnchor="middle"
                    fill="#10b981"
                    fontWeight="500"
                  >
                    {sephira.guardianCount} guardians
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip */}
        {hoveredSephira && (
          <div className="absolute top-4 right-4 max-w-sm zion-rainbow-sub p-6 shadow-2xl animate-fadeIn" style={{ '--rc': '139, 92, 246' } as React.CSSProperties}>
            {(() => {
              const s = hoveredSephira ? sephirotById.get(hoveredSephira) : null;
              if (!s) return null;
              const Icon = s.icon;
              return (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`rounded-xl bg-gradient-to-br ${s.gradient} p-3`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">{s.name}</h3>
                      <p className="text-sm text-gray-400">{s.title}</p>
                    </div>
                  </div>
                  <div className="space-y-3 text-sm">
                    <p className="text-white/90 leading-relaxed">{s.description}</p>
                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/10">
                      <div className="rounded-lg bg-white/5 p-3">
                        <div className="text-xs text-gray-400 mb-1">Level</div>
                        <div className="font-semibold text-white">CL{Math.floor(s.cl)}</div>
                      </div>
                      <div className="rounded-lg bg-white/5 p-3">
                        <div className="text-xs text-gray-400 mb-1">Multiplier</div>
                        <div className="font-semibold text-zion-gold">{s.multiplier}×</div>
                      </div>
                      <div className="rounded-lg bg-white/5 p-3">
                        <div className="text-xs text-gray-400 mb-1">XP Required</div>
                        <div className="font-semibold text-zion-purple">{s.xpThreshold ? s.xpThreshold.toLocaleString() : '—'}</div>
                      </div>
                      <div className="rounded-lg bg-white/5 p-3">
                        <div className="text-xs text-gray-400 mb-1">Guardians</div>
                        <div className="font-semibold text-emerald-400">{s.guardianCount || 0}</div>
                      </div>
                    </div>
                    <div className="pt-3 border-t border-white/10">
                      <div className="text-xs text-gray-400 mb-2">DAO Circle</div>
                      <div className={`rounded-lg bg-gradient-to-r ${s.gradient} p-3`}>
                        <div className="font-medium text-white">{s.daoCircle}</div>
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-8 grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          {
            label: "Guardians Council",
            icon: Crown,
            gradient: "from-purple-500 to-fuchsia-600",
            count: guardianData?.byTier["Guardians Council"] || 0,
          },
          {
            label: "Builders Circle",
            icon: Zap,
            gradient: "from-cyan-400 to-emerald-500",
            count: guardianData?.byTier["Builders Circle"] || 0,
          },
          {
            label: "Community Guild",
            icon: Heart,
            gradient: "from-orange-400 to-yellow-500",
            count: guardianData?.byTier["Community Guild"] || 0,
          },
          {
            label: "Transition",
            icon: Shield,
            gradient: "from-indigo-600 to-slate-800",
            count: 0,
          },
          {
            label: "Seekers",
            icon: Eye,
            gradient: "from-emerald-400 to-teal-600",
            count: 0,
          },
        ].map((item) => (
          <div key={item.label} className="group rounded-xl border border-white/10 bg-black/40 p-4 text-center hover:border-white/20 transition-all hover:scale-105">
            <div className={`w-12 h-12 rounded-full mx-auto mb-3 bg-gradient-to-br ${item.gradient} flex items-center justify-center text-2xl shadow-lg group-hover:shadow-xl transition-shadow`}>
              <item.icon className="h-6 w-6 text-white" />
            </div>
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">{item.label}</div>
            <div className="text-2xl font-bold text-white">{item.count}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
