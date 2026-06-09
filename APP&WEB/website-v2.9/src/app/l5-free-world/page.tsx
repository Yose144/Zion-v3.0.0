'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Globe2, Heart, Shield, Leaf, Users, Wallet, ArrowRight,
  CheckCircle2, Clock, Sparkles, TreeDeciduous, Map, Crown
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

const HUMANITARIAN_WALLET = 'zion1c245e7f5d8h427r4p4s2s607d7v4c255z7x96t3';

const getCommunities = (cs: boolean) => [
  {
    name: 'Genesis Garden',
    location: tr('l5FreeWorld', 'central_europe', lang),
    status: 'planned',
    desc: cs
      ? 'Pionýrská L5 komunita — permakultivní zahrada, lokální governance a ZION guardian node.'
      : 'Pioneer L5 community — permaculture garden, local governance and ZION guardian node.',
    tags: ['Permaculture', 'Guardian Node', 'DAO Circle'],
  },
  {
    name: 'Dharma Temple',
    location: tr('l5FreeWorld', 'south_asia', lang),
    status: 'planned',
    desc: cs
      ? 'Vzdělávací a meditační centrum s decentralizovanou správou a free energy projekty.'
      : 'Educational and meditation center with decentralized governance and free energy projects.',
    tags: ['Education', 'Free Energy', 'Meditation'],
    href: '/terranova/dharma-temple',
  },
  {
    name: 'Te Pīko Ora',
    location: 'Rapa Nui',
    status: 'vision',
    desc: cs
      ? 'Kulturní obnova Rapa Nui skrze ZION protokol, místní fond a ochranu dědictví.'
      : 'Rapa Nui cultural revival through ZION protocol, local fund, and heritage protection.',
    tags: ['Cultural Revival', 'Heritage', 'L5 Fund'],
    href: '/terranova/te-piko-ora',
  },
];

const getProtocols = (cs: boolean) => [
  {
    title: tr('l5FreeWorld', 'guardian_node', lang),
    desc: tr('l5FreeWorld', 'every_l5_community_validates_blocks_10_of_rew', lang),
    icon: Shield,
    color: 'text-cyan-400',
  },
  {
    title: tr('l5FreeWorld', 'sociocratic_dao', lang),
    desc: tr('l5FreeWorld', 'hybrid_governance_off_chain_circles_on_chain_', lang),
    icon: Users,
    color: 'text-purple-400',
  },
  {
    title: tr('l5FreeWorld', 'free_energy', lang),
    desc: tr('l5FreeWorld', 'solar_wind_and_local_energy_autonomy_shared_a', lang),
    icon: Sparkles,
    color: 'text-amber-400',
  },
  {
    title: tr('l5FreeWorld', 'community_treasury', lang),
    desc: tr('l5FreeWorld', '10_of_guardian_node_rewards_local_projects_ma', lang),
    icon: Wallet,
    color: 'text-emerald-400',
  },
  {
    title: tr('l5FreeWorld', 'resonance_protocol', lang),
    desc: tr('l5FreeWorld', 'sound_attunement_before_governance_fibonacci_', lang),
    icon: Leaf,
    color: 'text-rose-400',
  },
  {
    title: tr('l5FreeWorld', 'cartographic_records', lang),
    desc: tr('l5FreeWorld', 'local_ecological_and_community_maps_stored_on', lang),
    icon: Map,
    color: 'text-blue-400',
  },
];

export default function L5FreeWorldPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const communities = getCommunities(cs);
  const protocols = getProtocols(cs);

  return (
    <div className="pt-28 pb-24 overflow-x-hidden">
      <div className="zion-container max-w-7xl space-y-16">

        {/* ── HERO ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-black/60 to-emerald-500/10 p-6 md:p-10 backdrop-blur-xl">
          <div className="space-y-5 max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-amber-300 uppercase">
              <Globe2 className="h-4 w-4" />
              L5 · Terra Nova · Free World
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-gray-400">
                {tr('l5FreeWorld', 'physical_layer_of_the_zion_ecosystem', lang)}
              </p>
              <h1 className="text-3xl sm:text-5xl font-semibold text-gradient leading-tight">
                {tr('l5FreeWorld', 'free_world_l5', lang)}
              </h1>
            </div>
            <p className="text-lg text-gray-300">
              {cs
                ? 'L5 je fyzická vrstva ZION — kde blockchainový konsenzus potkává půdu, vodu a lidskou správu. Fyzické komunity využívají ZION jako svou nativní ekonomiku a koordinační vrstvu.'
                : 'L5 is the physical layer of ZION — where blockchain consensus meets soil, water, and human governance. Physical communities use ZION as their native economy and coordination layer.'}
            </p>
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-amber-200">
                <Heart className="h-3 w-3" /> {tr('l5FreeWorld', '5_of_every_block_l5_fund', lang)}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-emerald-200">
                <CheckCircle2 className="h-3 w-3" /> {tr('l5FreeWorld', '11_7m_zion_month', lang)}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                <Clock className="h-3 w-3" /> {tr('l5FreeWorld', 'unlocked_block_525_600', lang)}
              </span>
            </div>
          </div>
        </motion.section>

        {/* ── Fund Info ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-[32px] border border-white/10 bg-black/40 p-8">
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tr('l5FreeWorld', 'humanitarian_fund', lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Heart className="h-7 w-7 text-amber-400" />
              {tr('l5FreeWorld', 'l5_fund_5_block_reward', lang)}
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-center">
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">{tr('l5FreeWorld', 'block_share', lang)}</p>
              <p className="text-3xl font-bold text-amber-400">5%</p>
              <p className="text-xs text-gray-500 mt-1">{tr('l5FreeWorld', 'every_block_forever', lang)}</p>
            </div>
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-center">
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">{tr('l5FreeWorld', 'approx_month', lang)}</p>
              <p className="text-3xl font-bold text-emerald-400">~11,7M</p>
              <p className="text-xs text-gray-500 mt-1">ZION</p>
            </div>
            <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-4 text-center">
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">{tr('l5FreeWorld', 'governed_by', lang)}</p>
              <p className="text-2xl font-bold text-cyan-400">DAO</p>
              <p className="text-xs text-gray-500 mt-1">{tr('l5FreeWorld', 'l5_council', lang)}</p>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-gray-400 font-mono break-all">
            <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">{tr('l5FreeWorld', 'fund_wallet', lang)}</p>
            {HUMANITARIAN_WALLET}
          </div>
        </motion.section>

        {/* ── L5 Protocol suite ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-[32px] border border-white/10 bg-white/5 p-8">
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tr('l5FreeWorld', 'shared_protocols', lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Shield className="h-7 w-7 text-cyan-400" />
              {tr('l5FreeWorld', 'baseline_l5_protocols', lang)}
            </h2>
            <p className="text-sm text-gray-400">{tr('l5FreeWorld', 'every_l5_community_implements_these_shared_pr', lang)}</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {protocols.map((p) => (
              <div key={p.title} className="rounded-2xl border border-white/10 bg-black/30 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <p.icon className={`h-5 w-5 ${p.color}`} />
                  <h3 className="font-semibold text-white">{p.title}</h3>
                </div>
                <p className="text-sm text-gray-400">{p.desc}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── Communities ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-[32px] border border-white/10 bg-black/40 p-8">
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tr('l5FreeWorld', 'communities', lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <TreeDeciduous className="h-7 w-7 text-emerald-400" />
              {tr('l5FreeWorld', 'l5_nodes_communities', lang)}
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {communities.map((community) => {
              const Card = (
                <div className={`rounded-2xl border p-5 transition-all duration-300 ${community.status === 'planned' ? 'border-amber-500/30 bg-amber-500/5' : 'border-white/10 bg-white/5'} ${community.href ? 'hover:border-amber-500/50 hover:bg-amber-500/10 cursor-pointer' : ''}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-white">{community.name}</h3>
                      <p className="text-xs text-gray-500">{community.location}</p>
                    </div>
                    <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full font-semibold ${community.status === 'planned' ? 'border border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border border-white/10 bg-white/5 text-gray-400'}`}>
                      {community.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mb-3">{community.desc}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {community.tags.map((tag) => (
                      <span key={tag} className="text-[10px] rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-gray-400">{tag}</span>
                    ))}
                  </div>
                  {community.href && (
                    <div className="mt-3 flex items-center gap-1 text-xs text-amber-300/70 group-hover:text-amber-300 transition-colors">
                      <ArrowRight className="h-3 w-3" />
                      {tr('l5FreeWorld', 'details', lang)}
                    </div>
                  )}
                </div>
              );
              return community.href ? (
                <Link key={community.name} href={community.href} className="group block">
                  {Card}
                </Link>
              ) : (
                <div key={community.name}>{Card}</div>
              );
            })}
          </div>
          <p className="text-xs text-gray-500 mt-4 text-center">
            {tr('l5FreeWorld', 'want_to_propose_a_new_l5_community_open_a_pr_', lang)}
          </p>
        </motion.section>

        {/* ── Revenue model ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-[32px] border border-emerald-500/20 bg-emerald-500/5 p-8">
          <div className="flex items-center gap-3 mb-6">
            <Wallet className="h-7 w-7 text-emerald-400" />
            <h2 className="text-3xl font-semibold text-white">{tr('l5FreeWorld', 'l5_economic_model', lang)}</h2>
          </div>
          <div className="space-y-3 text-sm font-mono">
            {[
              { label: tr('l5FreeWorld', 'block_reward_network', lang), split: '89% miner · 5% L5 humanitarian · 5% L6 Issobella · 1% pool fee', color: 'text-cyan-400' },
              { label: tr('l5FreeWorld', 'guardian_node_local', lang), split: tr('l5FreeWorld', '90_community_miner_10_community_treasury', lang), color: 'text-emerald-400' },
              { label: tr('l5FreeWorld', 'community_treasury', lang), split: tr('l5FreeWorld', '60_projects_30_reserves_10_humanitarian_tithe', lang), color: 'text-amber-400' },
            ].map((row) => (
              <div key={row.label} className="rounded-xl border border-white/10 bg-black/30 p-4">
                <p className={`text-xs uppercase tracking-wider mb-1 ${row.color}`}>{row.label}</p>
                <p className="text-gray-300">{row.split}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── Links ── */}
        <motion.section initial={{ opacity: 0, scale: 0.98 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="rounded-[32px] border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-transparent to-emerald-500/10 p-10">
          <h2 className="text-2xl font-semibold text-white text-center mb-6">{tr('l5FreeWorld', 'learn_more_about_l5', lang)}</h2>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/dao" className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors">
              <Crown className="h-4 w-4 text-zion-gold" /> DAO Governance
            </Link>
            <Link href="/network" className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors">
              <Globe2 className="h-4 w-4 text-cyan-400" /> {tr('l5FreeWorld', 'network', lang)}
            </Link>
            <Link href="/l6-issobella" className="inline-flex items-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/5 px-6 py-3 text-sm font-semibold text-rose-200 hover:bg-rose-500/10 transition-colors">
              L6 Issobella <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </motion.section>

      </div>
    </div>
  );
}
