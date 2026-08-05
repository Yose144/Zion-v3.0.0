'use client';

import { Brain, Cpu, Landmark, Rocket, Shield, Sparkles, Zap } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import t, { tx, tr } from '@/lib/translations';

const FeaturesCopy = {
  continuum: { cs: `Kontinuum`, en: `Continuum` },
};


export default function Features() {
  const { lang } = useLang();

  const continuumTracks = [
    {
      title: tx(t.features.tracks.chv3.title, lang),
      description: tx(t.features.tracks.chv3.desc, lang),
      icon: Brain,
      badge: tx(t.features.tracks.chv3.badge, lang),
      spectrum: 'from-zion-cyan/20 via-zion-purple/10 to-transparent',
    },
    {
      title: tx(t.features.tracks.miner.title, lang),
      description: tx(t.features.tracks.miner.desc, lang),
      icon: Cpu,
      badge: tx(t.features.tracks.miner.badge, lang),
      spectrum: 'from-zion-gold/20 via-orange-500/10 to-transparent',
    },
    {
      title: tx(t.features.tracks.dao.title, lang),
      description: tx(t.features.tracks.dao.desc, lang),
      icon: Landmark,
      badge: tx(t.features.tracks.dao.badge, lang),
      spectrum: 'from-rose-500/20 via-zion-purple/10 to-transparent',
    },
    {
      title: tx(t.features.tracks.ai_native.title, lang),
      description: tx(t.features.tracks.ai_native.desc, lang),
      icon: Zap,
      badge: tx(t.features.tracks.ai_native.badge, lang),
      spectrum: 'from-fuchsia-500/20 via-zion-cyan/10 to-transparent',
    },
    {
      title: tx(t.features.tracks.warp.title, lang),
      description: tx(t.features.tracks.warp.desc, lang),
      icon: Rocket,
      badge: tx(t.features.tracks.warp.badge, lang),
      spectrum: 'from-emerald-500/20 via-zion-cyan/10 to-transparent',
    },
    {
      title: tx(t.features.tracks.p2p.title, lang),
      description: tx(t.features.tracks.p2p.desc, lang),
      icon: Shield,
      badge: tx(t.features.tracks.p2p.badge, lang),
      spectrum: 'from-blue-500/20 via-cyan-400/10 to-transparent',
    },
    {
      title: tx(t.features.tracks.explorer.title, lang),
      description: tx(t.features.tracks.explorer.desc, lang),
      icon: Sparkles,
      badge: tx(t.features.tracks.explorer.badge, lang),
      spectrum: 'from-violet-500/20 via-fuchsia-400/10 to-transparent',
    },
  ];

  const timeline = [
    { phase: tx(t.features.timeline.ph1.phase, lang), detail: tx(t.features.timeline.ph1.detail, lang) },
    { phase: tx(t.features.timeline.ph2.phase, lang), detail: tx(t.features.timeline.ph2.detail, lang) },
    { phase: tx(t.features.timeline.ph3.phase, lang), detail: tx(t.features.timeline.ph3.detail, lang) },
  ];

  return (
    <section className="py-8 px-4">
      <div className="zion-container space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-end gap-3">
          <div className="flex-1">
            <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{FeaturesCopy.continuum[lang === 'cs' ? 'cs' : 'en']}</p>
            <h2 className="text-2xl md:text-3xl font-bold text-white">
              <span className="text-gradient">{tr('features', 'heading', lang)}</span>
            </h2>
          </div>
          <p className="text-sm text-gray-300 max-w-2xl">
            {tr('features', 'subheading', lang)}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {continuumTracks.map((track) => (
              <div
                key={track.title}
                className="zion-rainbow-card p-4 backdrop-blur relative overflow-hidden"
                style={{ '--rc': '99, 102, 241' } as React.CSSProperties}
              >
                <div className={`absolute inset-0 bg-linear-to-br ${track.spectrum} opacity-70 pointer-events-none`} />
                  <div className="relative space-y-2">
                  <div className="flex items-center justify-between">
                    <track.icon className="w-5 h-5 text-white" />
                    <span className="text-[10px] font-semibold tracking-wide text-zion-gold bg-zion-gold/10 rounded-full px-2 py-0.5">
                      {track.badge}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-white">{track.title}</h3>
                  <p className="text-xs text-gray-200 leading-relaxed">{track.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="zion-rainbow-card backdrop-blur-xl p-4 space-y-4" style={{ '--rc': '99, 102, 241' } as React.CSSProperties}>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Zap className="w-4 h-4 text-zion-gold" />
              {tr('features', 'upgrade_heading', lang)}
            </div>

            <div className="space-y-3">
              {timeline.map((item) => (
                <div key={item.phase} className="zion-rainbow-sub p-3" style={{ '--rc': '99, 102, 241' } as React.CSSProperties}>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400">{item.phase}</p>
                  <p className="text-sm text-white mt-1">{item.detail}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-white/10 bg-linear-to-br from-zion-purple/20 to-zion-cyan/10 p-4 text-gray-100 text-xs">
              {tr('features', 'community_cta', lang)}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
