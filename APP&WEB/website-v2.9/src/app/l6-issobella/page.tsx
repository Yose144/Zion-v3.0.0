'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Rocket, Star, Globe2, Wallet, Shield, Sparkles, ArrowRight,
  CheckCircle2, Clock, Heart, Zap, Crown
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

const ISSOBELLA_WALLET = 'zion19242q4x0l3785003n8l0s873k3f5v8d4d8wz702';

const getMissions = (cs: boolean) => [
  {
    name: tr('l6Issobella', 'orbital_station', lang),
    phase: 'Vision 2040+',
    desc: cs
      ? 'ZION Issobella — decentralizovaná orbitální stanice financovaná block reward fondem. Výzkum, věda a Overview Effect.'
      : 'ZION Issobella — decentralized orbital station funded by block reward. Research, science, and the Overview Effect.',
    tags: ['Space Station', '5% Fund', 'Overview Effect'],
    color: 'border-rose-500/30 bg-rose-500/5',
    badgeColor: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  },
  {
    name: 'SETI + Deep Research',
    phase: 'Vision 2035+',
    desc: cs
      ? 'Decentralizovaný SETI program financovaný L6 fondem — komunita hlasuje o výzkumných projektech.'
      : 'Decentralized SETI program funded by L6 fund — community votes on research projects.',
    tags: ['SETI', 'Deep Space', 'DAO Research Grants'],
    color: 'border-purple-500/30 bg-purple-500/5',
    badgeColor: 'border-purple-500/30 bg-purple-500/10 text-purple-300',
  },
  {
    name: tr('l6Issobella', 'orbital_mining', lang),
    phase: 'Vision 2045+',
    desc: cs
      ? 'Vesmírná těžba zdrojů — asteroidy, regolit. ZION jako ekonomická vrstva pro off-world operace.'
      : 'Space resource mining — asteroids, regolith. ZION as the economic layer for off-world operations.',
    tags: ['Asteroid Mining', 'Resources', 'ZION Economy'],
    color: 'border-amber-500/30 bg-amber-500/5',
    badgeColor: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  },
];

const getPrinciples = (cs: boolean) => [
  {
    title: tr('l6Issobella', 'overview_effect', lang),
    desc: tr('l6Issobella', 'orbital_experience_shifts_consciousness_no_bo', lang),
    icon: Globe2,
    color: 'text-blue-400',
  },
  {
    title: tr('l6Issobella', '5_block_fund', lang),
    desc: tr('l6Issobella', 'every_mined_block_contributes_5_to_the_l6_iss', lang),
    icon: Wallet,
    color: 'text-rose-400',
  },
  {
    title: tr('l6Issobella', 'dao_governance', lang),
    desc: tr('l6Issobella', 'l6_council_governed_grants_and_projects_commu', lang),
    icon: Crown,
    color: 'text-zion-gold',
  },
  {
    title: tr('l6Issobella', 'decentralized_research', lang),
    desc: tr('l6Issobella', 'space_research_without_central_authority_open', lang),
    icon: Shield,
    color: 'text-cyan-400',
  },
  {
    title: tr('l6Issobella', 'cosmic_consciousness', lang),
    desc: tr('l6Issobella', 'l6_as_the_layer_for_transcending_planetary_bo', lang),
    icon: Sparkles,
    color: 'text-purple-400',
  },
  {
    title: tr('l6Issobella', 'cosmic_harmony_pow', lang),
    desc: tr('l6Issobella', 'zion_consensus_algorithm_is_designed_with_cos', lang),
    icon: Zap,
    color: 'text-emerald-400',
  },
];

export default function L6IssobellaPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const missions = getMissions(cs);
  const principles = getPrinciples(cs);

  return (
    <div className="pt-28 pb-24 overflow-x-hidden">
      <div className="zion-container max-w-7xl space-y-16">

        {/* ── HERO ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-rose-500/30 bg-gradient-to-br from-rose-500/10 via-black/60 to-purple-500/10 p-6 md:p-10 backdrop-blur-xl">
          <div className="space-y-5 max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/40 bg-rose-500/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-rose-300 uppercase">
              <Rocket className="h-4 w-4" />
              L6 · Issobella · Space
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-gray-400">
                {tr('l6Issobella', 'space_layer_of_the_zion_ecosystem', lang)}
              </p>
              <h1 className="text-3xl sm:text-5xl font-semibold leading-tight">
                <span className="text-gradient">Issobella</span>
                <span className="text-white"> — L6</span>
              </h1>
            </div>
            <p className="text-lg text-gray-300">
              {cs
                ? 'L6 je vesmírná vrstva ZION — orbitální stanice, SETI výzkum, orbital mining a Overview Effect protokoly. 5 % každého bloku financuje kosmický sen lidstva.'
                : 'L6 is the space layer of ZION — orbital station, SETI research, orbital mining, and Overview Effect protocols. 5% of every block funds humanity\'s cosmic dream.'}
            </p>
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-rose-200">
                <Star className="h-3 w-3" /> {tr('l6Issobella', '5_of_every_block_l6_fund', lang)}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-emerald-200">
                <CheckCircle2 className="h-3 w-3" /> {tr('l6Issobella', '11_7m_zion_month', lang)}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                <Clock className="h-3 w-3" /> {tr('l6Issobella', 'unlocked_block_525_600', lang)}
              </span>
            </div>
          </div>
        </motion.section>

        {/* ── Fund Info ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-[32px] border border-white/10 bg-black/40 p-8">
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tr('l6Issobella', 'space_fund', lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Rocket className="h-7 w-7 text-rose-400" />
              {tr('l6Issobella', 'l6_issobella_fund_5_block_reward', lang)}
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4 text-center">
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">{tr('l6Issobella', 'block_share', lang)}</p>
              <p className="text-3xl font-bold text-rose-400">5%</p>
              <p className="text-xs text-gray-500 mt-1">{tr('l6Issobella', 'every_block_forever', lang)}</p>
            </div>
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-center">
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">{tr('l6Issobella', 'approx_month', lang)}</p>
              <p className="text-3xl font-bold text-emerald-400">~11,7M</p>
              <p className="text-xs text-gray-500 mt-1">ZION</p>
            </div>
            <div className="rounded-2xl border border-purple-500/30 bg-purple-500/5 p-4 text-center">
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">{tr('l6Issobella', 'governed_by', lang)}</p>
              <p className="text-2xl font-bold text-purple-400">DAO</p>
              <p className="text-xs text-gray-500 mt-1">{tr('l6Issobella', 'l6_council', lang)}</p>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-gray-400 font-mono break-all">
            <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">{tr('l6Issobella', 'fund_wallet', lang)}</p>
            {ISSOBELLA_WALLET}
          </div>
        </motion.section>

        {/* ── Missions / Vision ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-[32px] border border-white/10 bg-white/5 p-8">
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tr('l6Issobella', 'missions_vision', lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Star className="h-7 w-7 text-rose-400" />
              {tr('l6Issobella', 'cosmic_missions', lang)}
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {missions.map((mission) => (
              <div key={mission.name} className={`rounded-2xl border p-5 ${mission.color}`}>
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-white">{mission.name}</h3>
                  <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full font-semibold border ${mission.badgeColor}`}>
                    {mission.phase}
                  </span>
                </div>
                <p className="text-sm text-gray-400 mb-3">{mission.desc}</p>
                <div className="flex flex-wrap gap-1.5">
                  {mission.tags.map((tag) => (
                    <span key={tag} className="text-[10px] rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-gray-400">{tag}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── Principles ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-[32px] border border-white/10 bg-black/40 p-8">
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tr('l6Issobella', 'principles', lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Sparkles className="h-7 w-7 text-purple-400" />
              {tr('l6Issobella', 'l6_layer_foundations', lang)}
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {principles.map((p) => (
              <div key={p.title} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <p.icon className={`h-5 w-5 ${p.color}`} />
                  <h3 className="font-semibold text-white">{p.title}</h3>
                </div>
                <p className="text-sm text-gray-400">{p.desc}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── Hiranyagarbha connection ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-[32px] border border-purple-500/30 bg-gradient-to-r from-purple-500/10 via-black/40 to-rose-500/10 p-10 text-center">
          <Sparkles className="h-12 w-12 text-purple-400 mx-auto mb-4" />
          <h2 className="text-3xl font-semibold text-white mb-4">Hiranyagarbha · {tr('l6Issobella', 'golden_egg', lang)}</h2>
          <p className="text-gray-300 max-w-2xl mx-auto text-lg">
            {cs
              ? 'L6 Issobella je fyzickým ztělesněním Hiranyagarbhy — zlatého zárodku kosmického vědomí. ZION AI (Hiran) a L6 fond společně financují přesah hranic planety.'
              : 'L6 Issobella is the physical embodiment of Hiranyagarbha — the golden egg of cosmic consciousness. ZION AI (Hiran) and the L6 fund together finance the transcendence of planetary boundaries.'}
          </p>
          <div className="mt-4 inline-flex items-center gap-2 text-xs text-purple-300 border border-purple-500/30 bg-purple-500/10 rounded-full px-4 py-2">
            <Heart className="h-3 w-3" /> Hiran v2.3 · Zion AI · L6 co-steward
          </div>
        </motion.section>

        {/* ── Links ── */}
        <motion.section initial={{ opacity: 0, scale: 0.98 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="rounded-[32px] border border-rose-500/30 bg-gradient-to-r from-rose-500/10 via-transparent to-purple-500/10 p-10">
          <h2 className="text-2xl font-semibold text-white text-center mb-6">{tr('l6Issobella', 'learn_more_about_l6_and_the_ecosystem', lang)}</h2>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/dao" className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors">
              <Crown className="h-4 w-4 text-zion-gold" /> DAO Governance
            </Link>
            <Link href="/network" className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors">
              <Globe2 className="h-4 w-4 text-cyan-400" /> {tr('l6Issobella', 'network', lang)}
            </Link>
            <Link href="/l5-free-world" className="inline-flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/5 px-6 py-3 text-sm font-semibold text-amber-200 hover:bg-amber-500/10 transition-colors">
              L5 Free World <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </motion.section>

      </div>
    </div>
  );
}
