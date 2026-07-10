'use client';

import { ArrowRight, CalendarDays, CheckCircle2, Rocket } from 'lucide-react';
import Link from 'next/link';
import { useLang } from '@/contexts/LanguageContext';

const getPhaseCards = (cs: boolean) => [
  {
    name: cs ? 'L1 TerraNova — Genesis 3.0.1' : 'L1 TerraNova — Genesis 3.0.1',
    window: cs ? 'Čer — Čvn 2026' : 'Mar — Jun 2026',
    progress: 100,
    highlights: [
      cs
        ? 'Genesis 3.0.1 úspěšný 11. 6. 2026 — MainNet Edge server topologie běží'
        : 'Genesis 3.0.1 successful 11 Jun 2026 — MainNet Edge server topology live',
      cs
        ? 'Pool aktivní, 89/5/5/1 split ověřen, explorer synchronizován'
        : 'Pool active, 89/5/5/1 split verified, explorer synced',
      cs
        ? 'LWMA DAA, dual-algo mining, GPU/CPU stratum live'
        : 'LWMA DAA, dual-algo mining, GPU/CPU stratum live',
    ],
  },
  {
    name: cs ? 'L2 Bridge, DeFi Run — v3.0.5' : 'L2 Bridge, DeFi Run — v3.0.5',
    window: cs ? 'Čvn 2026' : 'Jun 2026',
    progress: 100,
    highlights: [
      cs
        ? 'Bridge nasazen na Base Mainnet — wZION token live'
        : 'Bridge deployed on Base Mainnet — wZION token live',
      cs
        ? 'DeFi kontrakty aktivní — swap, bridge, portfolio'
        : 'DeFi contracts active — swap, bridge, portfolio',
      cs
        ? 'Atomic swap API funkční — cross-chain operace'
        : 'Atomic swap API functional — cross-chain operations',
    ],
  },
  {
    name: cs ? 'Launch Ops & Bezpečnostní uzávěr' : 'Launch Ops & Security Closure',
    window: cs ? 'Čvn — Pro 2026' : 'Jun — Dec 2026',
    progress: 40,
    highlights: [
      cs
        ? 'BFG scrub + genesis artefakty / checksumy v průběhu'
        : 'BFG scrub + genesis artifacts / checksums in progress',
      cs
        ? 'Externí bezpečnostní audit naplánován (Q4 2026)'
        : 'External security audit scheduled (Q4 2026)',
      cs
        ? 'Dokumentace, monitoring, bridge provisioning — odpočet k 31. 12. 2026'
        : 'Documentation, monitoring, bridge provisioning — countdown to 31 Dec 2026',
    ],
  },
  {
    name: cs ? 'Veřejný launch' : 'Public Launch Gate',
    window: cs ? '31. Pro 2026' : '31 Dec 2026',
    progress: 15,
    highlights: [
      cs
        ? 'Genesis freeze — všechny parametry finalizovány'
        : 'Genesis freeze — all parameters being finalized',
      cs
        ? 'Veřejný launch naplánován — odpočet aktivní'
        : 'Public launch scheduled — countdown active',
      cs
        ? 'CoinGecko listing + wZION bridge v přípravě'
        : 'CoinGecko listing + wZION bridge in preparation',
    ],
  },
];

const getTimeline = (cs: boolean) => [
  {
    title: '⛏️ L1 TerraNova · 2026',
    focus: cs ? 'Mainnet genesis, Cosmic Harmony v3/v4, UTXO, zásoba 144B ZION' : 'MainNet Genesis, Cosmic Harmony v3/v4, UTXO, 144B ZION supply',
  },
  {
    title: '🌉 L2 Bridge, DAO & DeFi · 2026',
    focus: cs ? 'wZION DEX na Base Mainnet live, bridge relay, treasury rails a DAO governance vrstva' : 'wZION DEX on Base Mainnet live, bridge relay, treasury rails, and the DAO governance layer',
  },
  {
    title: '🧠 L3 AI Native, WARP & NCL · 2027–2028',
    focus: cs ? 'Hiranyagarbha runtime, NCL compute lane, WARP relaye a agentická orchestrace nad L1/L2' : 'Hiranyagarbha runtime, the NCL compute lane, WARP relays, and agentic orchestration above L1/L2',
  },
  {
    title: '🎮 L4 Oasis · 2029',
    focus: cs ? 'Golden Egg, XP ekonomika, Winners program, herní vrstva' : 'Golden Egg, XP economy, Winners program, game layer',
  },
  {
    title: '🌍 L5 Free World · 2030',
    focus: cs ? 'Humanitární mise, free-energy R&D, off-grid komunity' : 'Humanitarian missions, free energy R&D, off-grid communities',
  },
  {
    title: '🔭 L6 Issobella · 2040+',
    focus: cs ? 'Orbitální observatoř, LEO výzkumná stanice, dlouhodobý misijní layer' : 'Orbital observatory, LEO research station, long-range mission layer',
  },
];

export default function RoadmapPulse() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const phaseCards = getPhaseCards(cs);
  const timeline = getTimeline(cs);

  return (
    <section className="py-20 px-4">
      <div className="zion-container space-y-12">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          <div className="flex-1 space-y-3">
            <p className="text-sm uppercase tracking-[0.4em] text-zion-gold">{cs ? 'Roadmapa' : 'Roadmap'}</p>
            <h2 className="text-4xl md:text-5xl font-bold text-white">
              3.0.5 <span className="text-gradient">Bridge, DeFi Run</span>
            </h2>
            <p className="text-base sm:text-lg text-gray-300 max-w-2xl">
              {cs
                ? 'MainNet Genesis 11. 6. 2026 úspěšný — public line 3.0.5 Bridge, DeFi Run nad kanonickou runtime v3.0.5 Deeksha/Ekam. Decimal fork 1e12→1e6 (6-decimal flowers) dokončen. Edge server topologie běží, pool aktivní, mining live. Bridge a DeFi protokoly nasazeny na Base Mainnet, wZION token live. Veřejný launch zůstává naplánován na 31. prosinec 2026 (Silvestr). Prioritou je finální validace telemetrie, doladění dokumentace, bezpečnostní audit a provozní připravenost.'
                : 'MainNet Genesis 11 Jun 2026 successful — public line 3.0.5 Bridge, DeFi Run over the canonical v3.0.5 Deeksha/Ekam runtime. Decimal fork 1e12→1e6 (6-decimal flowers) complete. Edge server topology running, pool active, mining live. Bridge and DeFi protocols deployed on Base Mainnet, wZION token live. Public launch remains scheduled for 31 December 2026 (New Year\'s Eve). Priority is final telemetry validation, documentation polish, security audit, and operational readiness.'}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/roadmap"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-linear-to-r from-zion-gold via-zion-purple to-zion-cyan text-sm font-semibold"
            >
              {cs ? 'Celá roadmapa' : 'Full Roadmap'}
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/explorer"
              className="zion-rainbow-sub inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold"
              style={{ '--rc': '249, 115, 22' } as React.CSSProperties}
            >
              <CalendarDays className="w-4 h-4 text-zion-cyan" />
              {cs ? 'Průzkumník blockchainu' : 'Block Explorer'}
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {phaseCards.map((phase, idx) => (
            <div
              key={phase.name}
              className="zion-rainbow-card p-6 space-y-4 backdrop-blur"
              style={{ '--rc': '249, 115, 22' } as React.CSSProperties}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-gray-400">{phase.window}</p>
                  <h3 className="text-xl font-semibold text-white">{phase.name}</h3>
                </div>
                <div className="px-3 py-1 text-xs font-semibold text-zion-gold bg-zion-gold/10 rounded-full">
                  {phase.progress}%
                </div>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  style={{ width: `${phase.progress}%` }}
                  className="h-full bg-linear-to-r from-zion-gold via-zion-purple to-zion-cyan"
                />
              </div>
              <ul className="space-y-2 text-sm text-gray-300">
                {phase.highlights.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-zion-cyan mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="zion-rainbow-card p-6" style={{ '--rc': '249, 115, 22' } as React.CSSProperties}>
          <div className="flex items-center gap-3 mb-6">
            <Rocket className="w-6 h-6 text-zion-cyan" />
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-gray-400">{cs ? '6vrstva vize' : '6-Layer Vision'}</p>
              <h3 className="text-2xl font-semibold text-white">{cs ? '6vrstva vize po Pure Code baseline' : '6-layer vision — after the Pure Code baseline'}</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {timeline.map((entry) => (
              <div key={entry.title} className="zion-rainbow-sub p-4" style={{ '--rc': '249, 115, 22' } as React.CSSProperties}>
                <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{entry.title}</p>
                <p className="text-sm text-gray-200 mt-3 leading-relaxed">{entry.focus}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
