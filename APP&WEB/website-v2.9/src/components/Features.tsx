'use client';

import { Brain, Cpu, Landmark, Rocket, Shield, Sparkles, Zap } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

const FeaturesCopy = {
  cs: {
    badge: 'Kontinuum',
    title: 'Sedm vrstev protokolu',
    subtitle: 'Základní kontinuum ZION. Každá vrstva je samostatná a nezávislá.',
  },
  en: {
    badge: 'Continuum',
    title: 'Seven protocol layers',
    subtitle: 'The core continuum of ZION. Every layer is independent.',
  },
};

const tracks = [
  { id: 'CHv3', name: 'Cosmic Harmony', year: '2026', status: 'active', icon: Brain },
  { id: 'Miner', name: 'Universal Miner', year: '2026', status: 'active', icon: Cpu },
  { id: 'DAO', name: 'Governance', year: '2026', status: 'active', icon: Landmark },
  { id: 'AI', name: 'AI-native', year: '2026–27', status: 'active', icon: Zap },
  { id: 'WARP', name: 'Multichain', year: '2026–27', status: 'active', icon: Rocket },
  { id: 'P2P', name: 'Network', year: '2026', status: 'active', icon: Shield },
  { id: 'Explorer', name: 'eXplorer', year: '2026', status: 'active', icon: Sparkles },
];

const statusLabel = { active: { cs: 'Aktivní', en: 'Active' }, upcoming: { cs: 'Plánováno', en: 'Planned' } };

export default function Features() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const copy = cs ? FeaturesCopy.cs : FeaturesCopy.en;

  return (
    <section className="relative px-4 py-6">
      <div className="zion-container">
        <div className="zion-rainbow-card p-4 md:p-5" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
          <div className="mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gray-400">{copy.badge}</p>
            <h2 className="text-xl font-bold text-white">{copy.title}</h2>
            <p className="text-sm text-gray-400">{copy.subtitle}</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
            {tracks.map((track) => (
              <div
                key={track.id}
                className="zion-rainbow-sub p-3 ring-1 ring-white/5"
                style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
              >
                <div className="flex items-center justify-between">
                  <track.icon className="h-4 w-4 text-zion-cyan" />
                  <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-zion-cyan-400/10 text-zion-cyan-300">
                    {statusLabel.active[cs ? 'cs' : 'en']}
                  </span>
                </div>
                <p className="mt-2 text-xs font-mono text-zion-gold">{track.id}</p>
                <p className="text-sm font-semibold text-white truncate">{track.name}</p>
                <p className="text-[10px] text-gray-500">{track.year}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
