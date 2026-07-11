'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Rocket, Star, Globe2, Wallet, Shield, Sparkles, ArrowRight,
  CheckCircle2, Clock, Heart, Zap, Crown
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

const ISSOBELLA_WALLET = 'zion1f7y7l5k678y0v408e8s654d2282346k375526t2';

const getMissions = (cs: boolean) => [
  {
    name: cs ? 'Orbitální stanice' : 'Orbital Station',
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
    name: cs ? 'Orbital Mining' : 'Orbital Mining',
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
    title: cs ? 'Overview Effect' : 'Overview Effect',
    desc: cs ? 'Zkušenost z oběžné dráhy mění vědomí — planety bez hranic, humanity jako celek.' : 'Orbital experience shifts consciousness — no borders, humanity as a whole.',
    icon: Globe2,
    color: 'text-blue-400',
  },
  {
    title: cs ? '5% Block Fund' : '5% Block Fund',
    desc: cs ? 'Každý vytěžený blok přispívá 5 % do L6 Issobella fondu — trvalé financování vesmírného výzkumu.' : 'Every mined block contributes 5% to the L6 Issobella fund — perpetual space research funding.',
    icon: Wallet,
    color: 'text-rose-400',
  },
  {
    title: cs ? 'DAO Governance' : 'DAO Governance',
    desc: cs ? 'L6 Radou řízené granty a projekty — komunita rozhoduje o alokaci fondu.' : 'L6 Council-governed grants and projects — community decides fund allocation.',
    icon: Crown,
    color: 'text-zion-gold',
  },
  {
    title: cs ? 'Decentralizovaný výzkum' : 'Decentralized Research',
    desc: cs ? 'Vesmírný výzkum bez centrální autority — otevřená věda, otevřená data.' : 'Space research without central authority — open science, open data.',
    icon: Shield,
    color: 'text-cyan-400',
  },
  {
    title: cs ? 'Kosmické vědomí' : 'Cosmic Consciousness',
    desc: cs ? 'L6 jako vrstva pro přesah hranic planety — Hiranyagarbha, Zlatý zárodek, kosmická vize.' : 'L6 as the layer for transcending planetary boundaries — Hiranyagarbha, Golden Egg, cosmic vision.',
    icon: Sparkles,
    color: 'text-purple-400',
  },
  {
    title: cs ? 'Cosmic Harmony PoW' : 'Cosmic Harmony PoW',
    desc: cs ? 'ZION consensus algoritmus je navržen s kosmickým vědomím — L6 je jeho duchovní destinace.' : 'ZION consensus algorithm is designed with cosmic consciousness — L6 is its spiritual destination.',
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
    <div className="zion-page">
      <div className="zion-container max-w-7xl space-y-16">

        {/* ── HERO ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
          <div className="space-y-5 max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/40 bg-rose-500/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-rose-300 uppercase">
              <Rocket className="h-4 w-4" />
              L6 · Issobella · Space
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-gray-400">
                {cs ? 'Vesmírná vrstva ZION ekosystému' : 'Space layer of the ZION ecosystem'}
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
                <Star className="h-3 w-3" /> {cs ? '5 % z každého bloku → L6 fond' : '5% of every block → L6 fund'}
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
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="zion-rainbow-card p-8" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Vesmírný fond' : 'Space Fund'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Rocket className="h-7 w-7 text-rose-400" />
              {cs ? 'Fond L6 Issobella — 5 % odměny za blok' : 'L6 Issobella Fund — 5% block reward'}
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="zion-rainbow-sub p-4 text-center" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">{cs ? 'Podíl z bloku' : 'Block share'}</p>
              <p className="text-3xl font-bold text-rose-400">5%</p>
              <p className="text-xs text-gray-500 mt-1">{cs ? 'každý blok, navždy' : 'every block, forever'}</p>
            </div>
            <div className="zion-rainbow-sub p-4 text-center" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">{cs ? 'Přibližně / měsíc' : 'Approx / month'}</p>
              <p className="text-3xl font-bold text-emerald-400">~11,7M</p>
              <p className="text-xs text-gray-500 mt-1">ZION</p>
            </div>
            <div className="zion-rainbow-sub p-4 text-center" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">{cs ? 'Správa' : 'Governed by'}</p>
              <p className="text-2xl font-bold text-purple-400">DAO</p>
              <p className="text-xs text-gray-500 mt-1">{cs ? 'L6 Radou' : 'L6 Council'}</p>
            </div>
          </div>
          <div className="zion-rainbow-sub p-4 text-sm text-gray-400 font-mono break-all" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
            <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">{cs ? 'Adresa fondu' : 'Fund wallet'}</p>
            {ISSOBELLA_WALLET}
          </div>
        </motion.section>

        {/* ── Missions / Vision ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="zion-rainbow-card p-8" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Mise & Vize' : 'Missions & Vision'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Star className="h-7 w-7 text-rose-400" />
              {cs ? 'Kosmické mise' : 'Cosmic Missions'}
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {missions.map((mission) => (
              <div key={mission.name} className={`zion-rainbow-sub p-5`} style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
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
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="zion-rainbow-card p-8" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Principy' : 'Principles'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Sparkles className="h-7 w-7 text-purple-400" />
              {cs ? 'Základy L6 vrstvy' : 'L6 Layer Foundations'}
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {principles.map((p) => (
              <div key={p.title} className="zion-rainbow-sub p-5" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
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
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="zion-cta-banner">
          <Sparkles className="h-12 w-12 text-purple-400 mx-auto mb-4" />
          <h2 className="text-3xl font-semibold text-white mb-4">Hiranyagarbha · {cs ? 'Zlatý zárodek' : 'Golden Egg'}</h2>
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
        <motion.section initial={{ opacity: 0, scale: 0.98 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="zion-cta-banner">
          <h2 className="text-2xl font-semibold text-white text-center mb-6">{cs ? 'Více o L6 a ekosystému' : 'Learn more about L6 and the ecosystem'}</h2>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/dao" className="zion-rainbow-sub inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
              <Crown className="h-4 w-4 text-zion-gold" /> DAO Governance
            </Link>
            <Link href="/network" className="zion-rainbow-sub inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
              <Globe2 className="h-4 w-4 text-cyan-400" /> {cs ? 'Síť' : 'Network'}
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
