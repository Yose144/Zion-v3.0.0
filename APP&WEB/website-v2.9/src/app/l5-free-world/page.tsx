'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Globe2, Heart, Shield, Leaf, Users, Wallet, ArrowRight,
  CheckCircle2, Clock, Sparkles, TreeDeciduous, Map, Crown
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

const HUMANITARIAN_WALLET = 'zion1e0u5q5s660k4m4a634p2c2v358r8g59564054z7';

const getCommunities = (cs: boolean) => [
  {
    name: 'Genesis Garden',
    location: cs ? 'Střední Evropa' : 'Central Europe',
    status: 'planned',
    desc: cs
      ? 'Pionýrská L5 komunita — pernakulturní zahrada, lokální governance a ZION guardian node.'
      : 'Pioneer L5 community — permaculture garden, local governance and ZION guardian node.',
    tags: ['Permaculture', 'Guardian Node', 'DAO Circle'],
  },
  {
    name: 'Dharma Temple',
    location: cs ? 'Jižní Asie' : 'South Asia',
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
    title: cs ? 'Guardian Node' : 'Guardian Node',
    desc: cs ? 'Každá L5 komunita validuje bloky — 10 % odměn do komunitní pokladny.' : 'Every L5 community validates blocks — 10% of rewards go to the community treasury.',
    icon: Shield,
    color: 'text-cyan-400',
  },
  {
    title: cs ? 'Sociocratic DAO' : 'Sociocratic DAO',
    desc: cs ? 'Hybridní governance: off-chain kruhy + on-chain treasury hlasování.' : 'Hybrid governance: off-chain circles + on-chain treasury votes.',
    icon: Users,
    color: 'text-purple-400',
  },
  {
    title: cs ? 'Free Energy' : 'Free Energy',
    desc: cs ? 'Solární, větrná a lokální energetická autonomie — sdílená přes L5 síť.' : 'Solar, wind, and local energy autonomy — shared across the L5 network.',
    icon: Sparkles,
    color: 'text-amber-400',
  },
  {
    title: cs ? 'Komunitní pokladna' : 'Community Treasury',
    desc: cs ? '10 % z guardian node odměn → místní projekty, údržba, zásoby.' : '10% of guardian node rewards → local projects, maintenance, reserves.',
    icon: Wallet,
    color: 'text-emerald-400',
  },
  {
    title: cs ? 'Rezonanční protokol' : 'Resonance Protocol',
    desc: cs ? 'Zvukové ladění před governance, Fibonacci Time Capsules, Youth–Elder Bridge.' : 'Sound attunement before governance, Fibonacci Time Capsules, Youth–Elder Bridge.',
    icon: Leaf,
    color: 'text-rose-400',
  },
  {
    title: cs ? 'Kartografické záznamy' : 'Cartographic Records',
    desc: cs ? 'Lokální ekologické a komunitní mapy uložené on-chain jako UTXO metadata.' : 'Local ecological and community maps stored on-chain as UTXO metadata.',
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
    <div className="zion-page">
      <div className="zion-container max-w-7xl space-y-16">

        {/* ── HERO ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
          <div className="space-y-5 max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-amber-300 uppercase">
              <Globe2 className="h-4 w-4" />
              L5 · Terra Nova · Free World
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-gray-400">
                {cs ? 'Fyzická vrstva ZION ekosystému' : 'Physical layer of the ZION ecosystem'}
              </p>
              <h1 className="text-3xl sm:text-5xl font-semibold text-gradient leading-tight">
                {cs ? 'Svobodný svět — L5' : 'Free World — L5'}
              </h1>
            </div>
            <p className="text-lg text-gray-300">
              {cs
                ? 'L5 je fyzická vrstva ZION — kde blockchainový konsenzus potkává půdu, vodu a lidskou správu. Fyzické komunity využívají ZION jako svou nativní ekonomiku a koordinační vrstvu.'
                : 'L5 is the physical layer of ZION — where blockchain consensus meets soil, water, and human governance. Physical communities use ZION as their native economy and coordination layer.'}
            </p>
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-amber-200">
                <Heart className="h-3 w-3" /> {cs ? '5 % z každého bloku → L5 fond' : '5% of every block → L5 fund'}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-emerald-200">
                <CheckCircle2 className="h-3 w-3" /> {cs ? '~11,7 M ZION / měsíc' : '~11.7M ZION / month'}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                <Clock className="h-3 w-3" /> {cs ? 'Odemčeno blok ~525 600' : 'Unlocked block ~525,600'}
              </span>
            </div>
          </div>
        </motion.section>

        {/* ── Fund Info ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="zion-rainbow-card p-8" style={{ '--rc': '14, 165, 233' } as React.CSSProperties}>
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Humanitární fond' : 'Humanitarian Fund'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Heart className="h-7 w-7 text-amber-400" />
              {cs ? 'L5 Fond — 5 % block reward' : 'L5 Fund — 5% block reward'}
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="zion-rainbow-sub p-4 text-center" style={{ '--rc': '14, 165, 233' } as React.CSSProperties}>
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">{cs ? 'Podíl z bloku' : 'Block share'}</p>
              <p className="text-3xl font-bold text-amber-400">5%</p>
              <p className="text-xs text-gray-500 mt-1">{cs ? 'každý blok, navždy' : 'every block, forever'}</p>
            </div>
            <div className="zion-rainbow-sub p-4 text-center" style={{ '--rc': '14, 165, 233' } as React.CSSProperties}>
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">{cs ? 'Přibližně / měsíc' : 'Approx / month'}</p>
              <p className="text-3xl font-bold text-emerald-400">~11,7M</p>
              <p className="text-xs text-gray-500 mt-1">ZION</p>
            </div>
            <div className="zion-rainbow-sub p-4 text-center" style={{ '--rc': '14, 165, 233' } as React.CSSProperties}>
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">{cs ? 'Správa' : 'Governed by'}</p>
              <p className="text-2xl font-bold text-cyan-400">DAO</p>
              <p className="text-xs text-gray-500 mt-1">{cs ? 'L5 Radou' : 'L5 Council'}</p>
            </div>
          </div>
          <div className="zion-rainbow-sub p-4 text-sm text-gray-400 font-mono break-all" style={{ '--rc': '14, 165, 233' } as React.CSSProperties}>
            <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">{cs ? 'Adresa fondu' : 'Fund wallet'}</p>
            {HUMANITARIAN_WALLET}
          </div>
        </motion.section>

        {/* ── L5 Protocol suite ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="zion-rainbow-card p-8" style={{ '--rc': '14, 165, 233' } as React.CSSProperties}>
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Sdílené protokoly' : 'Shared Protocols'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Shield className="h-7 w-7 text-cyan-400" />
              {cs ? 'Baseline L5 protokoly' : 'Baseline L5 Protocols'}
            </h2>
            <p className="text-sm text-gray-400">{cs ? 'Každá L5 komunita implementuje tyto sdílené protokoly pro interoperabilitu.' : 'Every L5 community implements these shared protocols for interoperability.'}</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {protocols.map((p) => (
              <div key={p.title} className="zion-rainbow-sub p-5" style={{ '--rc': '14, 165, 233' } as React.CSSProperties}>
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
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="zion-rainbow-card p-8" style={{ '--rc': '14, 165, 233' } as React.CSSProperties}>
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Komunity' : 'Communities'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <TreeDeciduous className="h-7 w-7 text-emerald-400" />
              {cs ? 'L5 uzly — komunity' : 'L5 Nodes — Communities'}
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {communities.map((community) => {
              const Card = (
                <div className={`zion-rainbow-sub p-5 transition-all duration-300 ${community.href ? 'cursor-pointer' : ''}`} style={{ '--rc': '14, 165, 233' } as React.CSSProperties}>
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
                      {cs ? 'Podrobnosti' : 'Details'}
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
            {cs ? 'Chceš navrhnout novou L5 komunitu? Otevři PR do V3/L5/docs/COMMUNITIES/' : 'Want to propose a new L5 community? Open a PR to V3/L5/docs/COMMUNITIES/'}
          </p>
        </motion.section>

        {/* ── Revenue model ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="zion-rainbow-card p-8" style={{ '--rc': '14, 165, 233' } as React.CSSProperties}>
          <div className="flex items-center gap-3 mb-6">
            <Wallet className="h-7 w-7 text-emerald-400" />
            <h2 className="text-3xl font-semibold text-white">{cs ? 'Ekonomický model L5' : 'L5 Economic Model'}</h2>
          </div>
          <div className="space-y-3 text-sm font-mono">
            {[
              { label: cs ? 'Block reward (síť)' : 'Block reward (network)', split: '89% miner · 5% L5 humanitarian · 5% L6 Issobella · 1% pool fee', color: 'text-cyan-400' },
              { label: cs ? 'Guardian Node (místní)' : 'Guardian Node (local)', split: cs ? '90% komunitní těžař · 10% → komunitní pokladna' : '90% community miner · 10% → community treasury', color: 'text-emerald-400' },
              { label: cs ? 'Komunitní pokladna' : 'Community Treasury', split: cs ? '60% projekty · 30% rezervy · 10% humanitární příspěvek (L5 global)' : '60% projects · 30% reserves · 10% humanitarian tithe (L5 global)', color: 'text-amber-400' },
            ].map((row) => (
              <div key={row.label} className="zion-rainbow-sub p-4" style={{ '--rc': '14, 165, 233' } as React.CSSProperties}>
                <p className={`text-xs uppercase tracking-wider mb-1 ${row.color}`}>{row.label}</p>
                <p className="text-gray-300">{row.split}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── Links ── */}
        <motion.section initial={{ opacity: 0, scale: 0.98 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="zion-cta-banner" style={{ borderColor: 'rgba(245, 158, 11, 0.35)', background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.22), rgba(16, 185, 129, 0.12) 50%, rgba(245, 158, 11, 0.22))', boxShadow: '0 24px 80px rgba(245, 158, 11, 0.18)' }}>
          <h2 className="text-2xl font-semibold text-white text-center mb-6">{cs ? 'Více o L5' : 'Learn more about L5'}</h2>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/dao" className="zion-rainbow-sub inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors" style={{ '--rc': '14, 165, 233' } as React.CSSProperties}>
              <Crown className="h-4 w-4 text-zion-gold" /> DAO Governance
            </Link>
            <Link href="/network" className="zion-rainbow-sub inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors" style={{ '--rc': '14, 165, 233' } as React.CSSProperties}>
              <Globe2 className="h-4 w-4 text-cyan-400" /> {cs ? 'Síť' : 'Network'}
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
