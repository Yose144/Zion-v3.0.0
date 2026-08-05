'use client';

import { Layers } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

const copy = {
  cs: {
    badge: 'Architektura',
    title: 'Šest vrstev protokolu',
    subtitle: 'Základní stack ZION ekosystému. Každá vrstva je nezávislá.',
    layers: [
      { id: 'L1', name: 'TerraNova', year: '2026', status: 'active', desc: 'L1 blockchain · PoW · UTXO' },
      { id: 'L2', name: 'Bridge & DeFi', year: '2026', status: 'active', desc: 'wZION · DEX · DAO' },
      { id: 'L3', name: 'AI / WARP / NCL', year: '2026–27', status: 'active', desc: 'Agenti · multichain · inference' },
      { id: 'L4', name: 'Oasis', year: '2028+', status: 'upcoming', desc: 'Hry · avataři · XP ekonomika' },
      { id: 'L5', name: 'Free World', year: '2030+', status: 'upcoming', desc: 'Komunity · free energy · mise' },
      { id: 'L6', name: 'Issobella', year: '2040+', status: 'upcoming', desc: 'Orbitální stanice · vesmír' },
    ],
    statuses: { active: 'Aktivní', upcoming: 'Plánováno' },
  },
  en: {
    badge: 'Architecture',
    title: 'Six protocol layers',
    subtitle: 'The core stack of the ZION ecosystem. Every layer is independent.',
    layers: [
      { id: 'L1', name: 'TerraNova', year: '2026', status: 'active', desc: 'L1 blockchain · PoW · UTXO' },
      { id: 'L2', name: 'Bridge & DeFi', year: '2026', status: 'active', desc: 'wZION · DEX · DAO' },
      { id: 'L3', name: 'AI / WARP / NCL', year: '2026–27', status: 'active', desc: 'Agents · multichain · inference' },
      { id: 'L4', name: 'Oasis', year: '2028+', status: 'upcoming', desc: 'Games · avatars · XP economy' },
      { id: 'L5', name: 'Free World', year: '2030+', status: 'upcoming', desc: 'Communities · free energy · missions' },
      { id: 'L6', name: 'Issobella', year: '2040+', status: 'upcoming', desc: 'Orbital station · space' },
    ],
    statuses: { active: 'Active', upcoming: 'Planned' },
  },
};

export default function HomeProtocolLayers() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const c = cs ? copy.cs : copy.en;

  return (
    <section className="relative px-4 py-6">
      <div className="zion-container">
        <div className="zion-rainbow-card p-4 md:p-5" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
          <div className="flex items-center gap-2 mb-4">
            <Layers className="h-4 w-4 text-zion-cyan" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gray-400">{c.badge}</p>
          </div>
          <div className="mb-4">
            <h2 className="text-xl font-bold text-white">{c.title}</h2>
            <p className="text-sm text-gray-400">{c.subtitle}</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {c.layers.map((layer) => (
              <div
                key={layer.id}
                className={`zion-rainbow-sub p-3 ${layer.status === 'active' ? 'ring-1 ring-emerald-500/20' : ''}`}
                style={{ '--rc': '147, 51, 234' } as React.CSSProperties}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-zion-gold">{layer.id}</span>
                  <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full ${layer.status === 'active' ? 'bg-emerald-400/10 text-emerald-300' : 'bg-white/5 text-gray-500'}`}>
                    {c.statuses[layer.status]}
                  </span>
                </div>
                <p className="mt-1.5 text-sm font-semibold text-white truncate">{layer.name}</p>
                <p className="text-[10px] text-gray-500">{layer.year}</p>
                <p className="mt-1 text-xs text-gray-400 line-clamp-2">{layer.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
