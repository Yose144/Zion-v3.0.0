'use client';

import { ArrowRight, CalendarDays, CheckCircle2, Rocket } from 'lucide-react';
import Link from 'next/link';
import { useLang } from '@/contexts/LanguageContext';

const getPhaseCards = (cs: boolean) => [
  {
    name: cs ? 'L1 TerraNova — kontrolovany test mainnet' : 'L1 TerraNova — Controlled Test Mainnet',
    window: cs ? 'Bre 2026 – nyni' : 'Mar 2026 – Now',
    progress: 96,
    highlights: [
      cs ? 'Nasazena v2.9.9 Pure Code verejna linie kontrolovaneho V3 test-mainnetu' : 'v2.9.9 Pure Code deployed — controlled V3 test-mainnet line',
      cs ? 'Aktivni 3-node rehearsal mesh, pool telemetrie a synchronizovany explorer' : '3-node rehearsal mesh active, pool telemetry, and explorer synced',
      cs ? 'Overen on-chain split 89/5/5/1; wZION DEX live na Base Mainnet' : 'On-chain 89/5/5/1 split verified; wZION DEX live on Base Mainnet',
    ],
  },
  {
    name: cs ? 'Launch ops a bezpecnostni closure' : 'Launch Ops & Security Closure',
    window: 'Q2–Q3 2026',
    progress: 20,
    highlights: [
      cs ? 'BFG scrub + genesis artefakty / checksumy' : 'BFG scrub + genesis artifacts / checksums',
      cs ? 'Externi bezpecnostni audit (Q2 2026)' : 'External security audit (Q2 2026)',
      cs ? 'Mereny 48–72h closure report + evidence recovery scenaru' : 'Measured 48–72h closure report + recovery evidence',
    ],
  },
  {
    name: cs ? 'Gate verejneho launchu' : 'Public Launch Gate',
    window: 'Q4 2026',
    progress: 5,
    highlights: [
      cs ? 'Dress rehearsal + genesis freeze' : 'Dress rehearsal + genesis freeze',
      cs ? 'Rozhodnuti o verejnem launchi az po splneni closure kriterii' : 'Public launch decision only after closure criteria',
      cs ? 'CoinGecko listing + wZION bridge az po verejne genesis' : 'CoinGecko listing + wZION bridge after public genesis',
    ],
  },
];

const getTimeline = (cs: boolean) => [
  {
    title: '⛏️ L1 TerraNova · 2026',
    focus: cs ? 'Mainnet genesis, Cosmic Harmony v3/v4, UTXO, zasoba 144B ZION' : 'MainNet Genesis, Cosmic Harmony v3/v4, UTXO, 144B ZION supply',
  },
  {
    title: '🧠 L2 NCL & DeFi · 2026–2027',
    focus: cs ? 'wZION DEX na Base Mainnet (live), Bridge relay, NCL AI-native protokol' : 'wZION DEX on Base Mainnet (live), Bridge relay, NCL AI-native protocol',
  },
  {
    title: '🏛️ L3 DAO · 2028',
    focus: cs ? 'Komunitni governance, treasury 4B ZION, on-chain hlasovani' : 'Community governance, Treasury 4B ZION, on-chain voting',
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
              v2.9.9 <span className="text-gradient">Pure Code</span>
            </h2>
            <p className="text-lg text-gray-300 max-w-2xl">
              {cs
                ? 'Aktualni verejna linie je kontrolovana V3 test-mainnet rehearsal na v2.9.9 Pure Code vetvi nad kanonickym runtime v2.9.8 Deeksha/Ekam. Prioritou jsou closure evidence, telemetrie, dokumentace a operacni disciplina pred jakymkoli rozhodnutim o verejnem launchi.'
                : 'The current public line is a controlled V3 test-mainnet rehearsal on the v2.9.9 Pure Code public line over the v2.9.8 Deeksha/Ekam canonical runtime. Priority is closure evidence, telemetry, documentation, and operational discipline before any public launch decision.'}
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
