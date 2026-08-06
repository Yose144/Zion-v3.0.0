'use client';

import { ArrowRight, CalendarDays, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useLang } from '@/contexts/LanguageContext';

const RoadmapPulseCopy = {
  roadmap: { cs: `Roadmapa`, en: `Roadmap` },
  currentStatus: { cs: `Aktuální stav`, en: `Current status` },
  v31CutoverComplete: { cs: `One Love Mainnet Stable — node, pool i multichain běží v produkci. MainNet Genesis 11. 6. 2026 úspěšný, Bridge/DeFi Run 3.0.6 nasazen, wZION token live na Base Mainnet. Zbývá finální bezpečnostní audit, bridge validator provisioning a komunitní příprava na veřejný launch 31. 12. 2026.`, en: `One Love Mainnet Stable — node, pool, and multichain are production. MainNet Genesis 11 Jun 2026 successful, Bridge/DeFi Run 3.0.6 deployed, wZION token live on Base Mainnet. Final security audit, bridge validator provisioning, and community preparation for public launch 31 Dec 2026 remain.` },
  fullRoadmap: { cs: `Celá roadmapa`, en: `Full Roadmap` },
  blockExplorer: { cs: `Průzkumník blockchainu`, en: `Block Explorer` },
  phases: {
    phase1: {
      name: { cs: `Fáze 1 · Foundation`, en: `Phase 1 · Foundation` },
      window: { cs: `Dokončeno`, en: `Completed` },
      progress: 100,
      highlights: [
        { cs: `MainNet Genesis 11. 6. 2026 — Edge topologie běží`, en: `MainNet Genesis 11 Jun 2026 — Edge topology live` },
        { cs: `Pool aktivní, LWMA DAA, dual-algo mining`, en: `Pool active, LWMA DAA, dual-algo mining` },
        { cs: `Block explorer, supply API, 1 945+ testů`, en: `Block explorer, supply API, 1,945+ tests` },
      ],
    },
    phase2: {
      name: { cs: `Fáze 2 · Bridge & DeFi Run`, en: `Phase 2 · Bridge & DeFi Run` },
      window: { cs: `Dokončeno`, en: `Completed` },
      progress: 100,
      highlights: [
        { cs: `wZION bridge nasazen na Base Mainnet`, en: `wZION bridge deployed on Base Mainnet` },
        { cs: `DeFi UI — swap, bridge, portfolio`, en: `DeFi UI — swap, bridge, portfolio` },
        { cs: `Uniswap V3 wZION/WETH pool nasazen`, en: `Uniswap V3 wZION/WETH pool seeded` },
      ],
    },
    phase3: {
      name: { cs: `Fáze 3 · One Love Cutover`, en: `Phase 3 · One Love Cutover` },
      window: { cs: `Dokončeno 4. 8. 2026`, en: `Completed 4 Aug 2026` },
      progress: 100,
      highlights: [
        { cs: `Node a pool v produkci`, en: `Node and pool in production` },
        { cs: `Multichain /health OK`, en: `Multichain /health OK` },
        { cs: `Decimal fork 1e12→1e6 dokončen`, en: `Decimal fork 1e12→1e6 complete` },
      ],
    },
    phase4: {
      name: { cs: `Fáze 4 · Public Launch Gate`, en: `Phase 4 · Public Launch Gate` },
      window: { cs: `Cíl: 31. 12. 2026`, en: `Target: 31 Dec 2026` },
      progress: 35,
      highlights: [
        { cs: `Bezpečnostní audit — externí firma booked`, en: `Security audit — external firm booked` },
        { cs: `Bridge validator provisioning 3/5 threshold`, en: `Bridge validator provisioning 3/5 threshold` },
        { cs: `Finální dokumentace a komunitní příprava`, en: `Final documentation and community preparation` },
      ],
    },
  },
};

export default function RoadmapPulse() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  const phaseCards = [
    RoadmapPulseCopy.phases.phase1,
    RoadmapPulseCopy.phases.phase2,
    RoadmapPulseCopy.phases.phase3,
    RoadmapPulseCopy.phases.phase4,
  ];

  return (
    <section className="py-8 px-4">
      <div className="zion-container space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex-1 space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-zion-gold">{RoadmapPulseCopy.roadmap[cs ? 'cs' : 'en']}</p>
            <h2 className="text-2xl md:text-3xl font-bold text-white">
              3.1.0 <span className="text-gradient">{RoadmapPulseCopy.currentStatus[cs ? 'cs' : 'en']}</span>
            </h2>
            <p className="text-sm text-gray-300 max-w-2xl">
              {RoadmapPulseCopy.v31CutoverComplete[cs ? 'cs' : 'en']}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Link
              href="/roadmap"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-2xl bg-linear-to-r from-zion-gold via-zion-purple to-zion-cyan text-sm font-semibold"
            >
              {RoadmapPulseCopy.fullRoadmap[cs ? 'cs' : 'en']}
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/explorer"
              className="zion-rainbow-sub inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold"
              style={{ '--rc': '252, 209, 22' } as React.CSSProperties}
            >
              <CalendarDays className="w-4 h-4 text-zion-cyan" />
              {RoadmapPulseCopy.blockExplorer[cs ? 'cs' : 'en']}
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {phaseCards.map((phase) => (
            <div
              key={phase.name[cs ? 'cs' : 'en']}
              className="zion-rainbow-card p-4 space-y-3 backdrop-blur"
              style={{ '--rc': '252, 209, 22' } as React.CSSProperties}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400">{phase.window[cs ? 'cs' : 'en']}</p>
                  <h3 className="text-base font-semibold text-white">{phase.name[cs ? 'cs' : 'en']}</h3>
                </div>
                <div className="px-2 py-0.5 text-[10px] font-semibold text-zion-gold bg-zion-gold/10 rounded-full">
                  {phase.progress}%
                </div>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  style={{ width: `${phase.progress}%` }}
                  className="h-full bg-linear-to-r from-zion-gold via-zion-purple to-zion-cyan"
                />
              </div>
              <ul className="space-y-1.5 text-xs text-gray-300">
                {phase.highlights.map((item) => (
                  <li key={item[cs ? 'cs' : 'en']} className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-zion-cyan mt-0.5" />
                    <span>{item[cs ? 'cs' : 'en']}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
