'use client';

import { ArrowRight, CalendarDays, CheckCircle2, Rocket } from 'lucide-react';
import Link from 'next/link';
import { useLang } from '@/contexts/LanguageContext';
import { tr } from '@/lib/translations';

const getPhaseCards = (cs: boolean) => [
  {
    name: 'L1 TerraNova — Controlled Mainnet',
    window: 'Mar — May 2026',
    progress: 100,
    highlights: [
      'v3.0.0 Mainnet Ready deployed — controlled V3 mainnet launch line',
      'Core + Edge mainnet topology active, pool telemetry, and explorer synced',
      'On-chain 89/5/5/1 split verified; mainnet launch countdown active',
    ],
  },
  {
    name: 'Launch Ops & Security Closure',
    window: 'May — Dec 2026',
    progress: 65,
    highlights: [
      'BFG scrub + genesis artifacts / checksums in progress',
      'External security audit scheduled (Q4 2026)',
      'Closure evidence being collected; countdown to 31 Dec 2026',
    ],
  },
  {
    name: 'Public Launch Gate',
    window: '31 Dec 2026',
    progress: 35,
    highlights: [
      'Genesis freeze — all parameters being finalized',
      'Public launch scheduled — Launch Countdown active',
      'CoinGecko listing + wZION bridge in preparation',
    ],
  },
];

const getTimeline = (cs: boolean) => [
  {
    title: '⛏️ L1 TerraNova · 2026',
    focus: tr('APP_WEB_website_v2_9_src_components_Road', 'mainnet_genesis_cosmic_harmony_v3_v4_utxo_144b_zio', lang),
  },
  {
    title: '🌉 L2 Bridge, DAO & DeFi · 2026–2027',
    focus: tr('APP_WEB_website_v2_9_src_components_Road', 'wzion_dex_on_base_mainnet_bridge_relay_treasury_ra', lang),
  },
  {
    title: '🧠 L3 AI Native, WARP & NCL · 2027–2028',
    focus: tr('APP_WEB_website_v2_9_src_components_Road', 'hiranyagarbha_runtime_the_ncl_compute_lane_warp_re', lang),
  },
  {
    title: '🎮 L4 Oasis · 2029',
    focus: tr('APP_WEB_website_v2_9_src_components_Road', 'golden_egg_xp_economy_winners_program_game_layer', lang),
  },
  {
    title: '🌍 L5 Free World · 2030',
    focus: tr('APP_WEB_website_v2_9_src_components_Road', 'humanitarian_missions_free_energy_r_d_off_grid_com', lang),
  },
  {
    title: '🔭 L6 Issobella · 2040+',
    focus: tr('APP_WEB_website_v2_9_src_components_Road', 'orbital_observatory_leo_research_station_long_rang', lang),
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
            <p className="text-sm uppercase tracking-[0.4em] text-zion-gold">{tr('APP_WEB_website_v2_9_src_components_Road', 'roadmap', lang)}</p>
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
              {tr('APP_WEB_website_v2_9_src_components_Road', 'full_roadmap', lang)}
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/explorer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl border border-white/10 bg-white/5 text-sm font-semibold"
            >
              <CalendarDays className="w-4 h-4 text-zion-cyan" />
              {tr('APP_WEB_website_v2_9_src_components_Road', 'block_explorer', lang)}
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
              <p className="text-xs uppercase tracking-[0.4em] text-gray-400">{tr('APP_WEB_website_v2_9_src_components_Road', '6_layer_vision', lang)}</p>
              <h3 className="text-2xl font-semibold text-white">{tr('APP_WEB_website_v2_9_src_components_Road', '6_layer_vision_after_the_pure_code_baseline', lang)}</h3>
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
