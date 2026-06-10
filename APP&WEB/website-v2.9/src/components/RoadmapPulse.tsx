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
        ? 'Genesis 3.0.1 úspěšný 11. 6. 2026 — MainNet Core + Edge topologie běží'
        : 'Genesis 3.0.1 successful 11 Jun 2026 — MainNet Core + Edge topology live',
      cs
        ? 'Pool aktivní, 89/5/5/1 split ověřen, explorer synchronizován'
        : 'Pool active, 89/5/5/1 split verified, explorer synced',
      cs
        ? 'LWMA DAA, dual-algo mining, GPU/CPU stratum live'
        : 'LWMA DAA, dual-algo mining, GPU/CPU stratum live',
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
    focus: cs ? 'Mainnet genesis, Cosmic Harmony v3/v4, UTXO, zasoba 144B ZION' : 'MainNet Genesis, Cosmic Harmony v3/v4, UTXO, 144B ZION supply',
  },
  {
    title: '🌉 L2 Bridge, DAO & DeFi · 2026–2027',
    focus: cs ? 'wZION DEX na Base Mainnet, bridge relay, treasury rails a DAO governance vrstva' : 'wZION DEX on Base Mainnet, bridge relay, treasury rails, and the DAO governance layer',
  },
  {
    title: '🧠 L3 AI Native, WARP & NCL · 2027–2028',
    focus: cs ? 'Hiranyagarbha runtime, NCL compute lane, WARP relaye a agenticka orchestrace nad L1/L2' : 'Hiranyagarbha runtime, the NCL compute lane, WARP relays, and agentic orchestration above L1/L2',
  },
  {
    title: '🎮 L4 Oasis · 2029',
    focus: cs ? 'Golden Egg, XP ekonomika, Winners program, herni vrstva' : 'Golden Egg, XP economy, Winners program, game layer',
  },
  {
    title: '🌍 L5 Free World · 2030',
    focus: cs ? 'Humanitarni mise, free-energy R&D, off-grid komunity' : 'Humanitarian missions, free energy R&D, off-grid communities',
  },
  {
    title: '🔭 L6 Issobella · 2040+',
    focus: cs ? 'Orbitalni observator, LEO vyzkumna stanice, dlouhy mission layer' : 'Orbital observatory, LEO research station, long-range mission layer',
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
              v3.0.0 <span className="text-gradient">Mainnet Ready</span>
            </h2>
            <p className="text-lg text-gray-300 max-w-2xl">
              The current public line is a controlled V3 mainnet launch countdown on the v3.0.0 Mainnet Ready public line over the v2.9.9 Pure Code / Deeksha/Ekam canonical runtime.
              Public mainnet launch is scheduled for 31 December 2026 (New Year's Eve). Priority is final telemetry validation, documentation polish, security audit, and operational readiness.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/roadmap"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-linear-to-r from-zion-gold via-zion-purple to-zion-cyan text-sm font-semibold"
            >
              {cs ? 'Cela roadmapa' : 'Full Roadmap'}
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/explorer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl border border-white/10 bg-white/5 text-sm font-semibold"
            >
              <CalendarDays className="w-4 h-4 text-zion-cyan" />
              {cs ? 'Pruzkumnik blockchainu' : 'Block Explorer'}
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {phaseCards.map((phase, idx) => (
            <div
              key={phase.name}
              className="rounded-3xl border border-white/10 bg-black/50 p-6 space-y-4 backdrop-blur"
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

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Rocket className="w-6 h-6 text-zion-cyan" />
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-gray-400">{cs ? '6vrstva vize' : '6-Layer Vision'}</p>
              <h3 className="text-2xl font-semibold text-white">{cs ? '6vrstva vize po Pure Code baseline' : '6-layer vision — after the Pure Code baseline'}</h3>
            </div>
          </div>

          <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4">
            {timeline.map((entry) => (
              <div key={entry.title} className="rounded-2xl border border-white/10 bg-black/40 p-4">
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
