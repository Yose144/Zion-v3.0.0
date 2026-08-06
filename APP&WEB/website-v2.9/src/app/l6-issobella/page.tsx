'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Rocket, Star, Globe2, Wallet, Shield, Sparkles, ArrowRight,
  CheckCircle2, Clock, Heart, Zap, Crown
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

const L6IssobellaCopy = {
  orbitalStation: { cs: `Orbitální stanice`, en: `Orbital Station` },
  zionIssobellaDecentralizedOrbi: { cs: `ZION Issobella — decentralizovaná orbitální stanice financovaná block reward fondem. Výzkum, věda a Overview Effect.`, en: `ZION Issobella — decentralized orbital station funded by block reward. Research, science, and the Overview Effect.` },
  decentralizedSetiProgramFunded: { cs: `Decentralizovaný SETI program financovaný L6 fondem — komunita hlasuje o výzkumných projektech.`, en: `Decentralized SETI program funded by L6 fund — community votes on research projects.` },
  orbitalMining: { cs: `Orbital Mining`, en: `Orbital Mining` },
  spaceResourceMiningAsteroidsRe: { cs: `Vesmírná těžba zdrojů — asteroidy, regolit. ZION jako ekonomická vrstva pro off-world operace.`, en: `Space resource mining — asteroids, regolith. ZION as the economic layer for off-world operations.` },
  overviewEffect: { cs: `Overview Effect`, en: `Overview Effect` },
  orbitalExperienceShiftsConscio: { cs: `Zkušenost z oběžné dráhy mění vědomí — planety bez hranic, humanity jako celek.`, en: `Orbital experience shifts consciousness — no borders, humanity as a whole.` },
  k5BlockFund: { cs: `5% Block Fund`, en: `5% Block Fund` },
  everyMinedBlockContributes5ToT: { cs: `Každý vytěžený blok přispívá 5 % do L6 Issobella fondu — trvalé financování vesmírného výzkumu.`, en: `Every mined block contributes 5% to the L6 Issobella fund — perpetual space research funding.` },
  daoGovernance: { cs: `DAO Governance`, en: `DAO Governance` },
  l6CouncilGovernedGrantsAndProj: { cs: `L6 Radou řízené granty a projekty — komunita rozhoduje o alokaci fondu.`, en: `L6 Council-governed grants and projects — community decides fund allocation.` },
  decentralizedResearch: { cs: `Decentralizovaný výzkum`, en: `Decentralized Research` },
  spaceResearchWithoutCentralAut: { cs: `Vesmírný výzkum bez centrální autority — otevřená věda, otevřená data.`, en: `Space research without central authority — open science, open data.` },
  cosmicConsciousness: { cs: `Kosmické vědomí`, en: `Cosmic Consciousness` },
  l6AsTheLayerForTranscendingPla: { cs: `L6 jako vrstva pro přesah hranic planety — Hiranyagarbha, Zlatý zárodek, kosmická vize.`, en: `L6 as the layer for transcending planetary boundaries — Hiranyagarbha, Golden Egg, cosmic vision.` },
  cosmicHarmonyPow: { cs: `Cosmic Harmony PoW`, en: `Cosmic Harmony PoW` },
  zionConsensusAlgorithmIsDesign: { cs: `ZION consensus algoritmus je navržen s kosmickým vědomím — L6 je jeho duchovní destinace.`, en: `ZION consensus algorithm is designed with cosmic consciousness — L6 is its spiritual destination.` },
  spaceLayerOfTheZionEcosystem: { cs: `Vesmírná vrstva ZION ekosystému`, en: `Space layer of the ZION ecosystem` },
  l6IsTheSpaceLayerOfZionOrbital: { cs: `L6 je vesmírná vrstva ZION — orbitální stanice, SETI výzkum, orbital mining a Overview Effect protokoly. 5 % každého bloku financuje kosmický sen lidstva.`, en: `L6 is the space layer of ZION — orbital station, SETI research, orbital mining, and Overview Effect protocols. 5% of every block funds humanity\'s cosmic dream.` },
  k5OfEveryBlockL6Fund: { cs: `5 % z každého bloku → L6 fond`, en: `5% of every block → L6 fund` },
  k117mZionMonth: { cs: `~11,7 M ZION / měsíc`, en: `~11.7M ZION / month` },
  unlockedBlock525600: { cs: `Odemčeno blok ~525 600`, en: `Unlocked block ~525,600` },
  spaceFund: { cs: `Vesmírný fond`, en: `Space Fund` },
  l6IssobellaFund5BlockReward: { cs: `Fond L6 Issobella — 5 % odměny za blok`, en: `L6 Issobella Fund — 5% block reward` },
  blockShare: { cs: `Podíl z bloku`, en: `Block share` },
  everyBlockForever: { cs: `každý blok, navždy`, en: `every block, forever` },
  approxMonth: { cs: `Přibližně / měsíc`, en: `Approx / month` },
  governedBy: { cs: `Správa`, en: `Governed by` },
  l6Council: { cs: `L6 Radou`, en: `L6 Council` },
  fundWallet: { cs: `Adresa fondu`, en: `Fund wallet` },
  missionsVision: { cs: `Mise & Vize`, en: `Missions & Vision` },
  cosmicMissions: { cs: `Kosmické mise`, en: `Cosmic Missions` },
  principles: { cs: `Principy`, en: `Principles` },
  l6LayerFoundations: { cs: `Základy L6 vrstvy`, en: `L6 Layer Foundations` },
  goldenEgg: { cs: `Zlatý zárodek`, en: `Golden Egg` },
  l6IssobellaIsThePhysicalEmbodi: { cs: `L6 Issobella je fyzickým ztělesněním Hiranyagarbhy — zlatého zárodku kosmického vědomí. ZION AI (Hiran) a L6 fond společně financují přesah hranic planety.`, en: `L6 Issobella is the physical embodiment of Hiranyagarbha — the golden egg of cosmic consciousness. ZION AI (Hiran) and the L6 fund together finance the transcendence of planetary boundaries.` },
  learnMoreAboutL6AndTheEcosyste: { cs: `Více o L6 a ekosystému`, en: `Learn more about L6 and the ecosystem` },
  network: { cs: `Síť`, en: `Network` },
};

const ISSOBELLA_WALLET = 'zion173g835z228z6u303z59603y236r5e854l36g604';

const getMissions = (cs: boolean) => [
  {
    name: L6IssobellaCopy.orbitalStation[cs ? 'cs' : 'en'],
    phase: 'Vision 2040+',
    desc: L6IssobellaCopy.zionIssobellaDecentralizedOrbi[cs ? 'cs' : 'en'],
    tags: ['Space Station', '5% Fund', 'Overview Effect'],
    color: 'border-zion-purple-500/30 bg-zion-purple-500/5',
    badgeColor: 'border-zion-purple-500/30 bg-zion-purple-500/10 text-zion-purple-300',
  },
  {
    name: 'SETI + Deep Research',
    phase: 'Vision 2035+',
    desc: L6IssobellaCopy.decentralizedSetiProgramFunded[cs ? 'cs' : 'en'],
    tags: ['SETI', 'Deep Space', 'DAO Research Grants'],
    color: 'border-zion-purple-500/30 bg-zion-purple-500/5',
    badgeColor: 'border-zion-purple-500/30 bg-zion-purple-500/10 text-zion-purple-300',
  },
  {
    name: L6IssobellaCopy.orbitalMining[cs ? 'cs' : 'en'],
    phase: 'Vision 2045+',
    desc: L6IssobellaCopy.spaceResourceMiningAsteroidsRe[cs ? 'cs' : 'en'],
    tags: ['Asteroid Mining', 'Resources', 'ZION Economy'],
    color: 'border-zion-gold-500/30 bg-zion-gold-500/5',
    badgeColor: 'border-zion-gold-500/30 bg-zion-gold-500/10 text-zion-gold-300',
  },
];

const getPrinciples = (cs: boolean) => [
  {
    title: L6IssobellaCopy.overviewEffect[cs ? 'cs' : 'en'],
    desc: L6IssobellaCopy.orbitalExperienceShiftsConscio[cs ? 'cs' : 'en'],
    icon: Globe2,
    color: 'text-zion-purple-400',
  },
  {
    title: L6IssobellaCopy.k5BlockFund[cs ? 'cs' : 'en'],
    desc: L6IssobellaCopy.everyMinedBlockContributes5ToT[cs ? 'cs' : 'en'],
    icon: Wallet,
    color: 'text-zion-purple-400',
  },
  {
    title: L6IssobellaCopy.daoGovernance[cs ? 'cs' : 'en'],
    desc: L6IssobellaCopy.l6CouncilGovernedGrantsAndProj[cs ? 'cs' : 'en'],
    icon: Crown,
    color: 'text-zion-gold',
  },
  {
    title: L6IssobellaCopy.decentralizedResearch[cs ? 'cs' : 'en'],
    desc: L6IssobellaCopy.spaceResearchWithoutCentralAut[cs ? 'cs' : 'en'],
    icon: Shield,
    color: 'text-zion-cyan-400',
  },
  {
    title: L6IssobellaCopy.cosmicConsciousness[cs ? 'cs' : 'en'],
    desc: L6IssobellaCopy.l6AsTheLayerForTranscendingPla[cs ? 'cs' : 'en'],
    icon: Sparkles,
    color: 'text-zion-purple-400',
  },
  {
    title: L6IssobellaCopy.cosmicHarmonyPow[cs ? 'cs' : 'en'],
    desc: L6IssobellaCopy.zionConsensusAlgorithmIsDesign[cs ? 'cs' : 'en'],
    icon: Zap,
    color: 'text-zion-cyan-400',
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
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
          <div className="space-y-5 max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-zion-purple-500/40 bg-zion-purple-500/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-purple-300 uppercase">
              <Rocket className="h-4 w-4" />
              L6 · Issobella · Space
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-gray-400">
                {L6IssobellaCopy.spaceLayerOfTheZionEcosystem[cs ? 'cs' : 'en']}
              </p>
              <h1 className="text-3xl sm:text-5xl font-semibold leading-tight">
                <span className="text-gradient">Issobella</span>
                <span className="text-white"> — L6</span>
              </h1>
            </div>
            <p className="text-lg text-gray-300">
              {L6IssobellaCopy.l6IsTheSpaceLayerOfZionOrbital[cs ? 'cs' : 'en']}
            </p>
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="inline-flex items-center gap-2 rounded-full border border-zion-purple-500/30 bg-zion-purple-500/10 px-4 py-2 text-rose-200">
                <Star className="h-3 w-3" /> {L6IssobellaCopy.k5OfEveryBlockL6Fund[cs ? 'cs' : 'en']}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-zion-cyan-500/30 bg-zion-cyan-500/10 px-4 py-2 text-emerald-200">
                <CheckCircle2 className="h-3 w-3" /> {L6IssobellaCopy.k117mZionMonth[cs ? 'cs' : 'en']}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                <Clock className="h-3 w-3" /> {L6IssobellaCopy.unlockedBlock525600[cs ? 'cs' : 'en']}
              </span>
            </div>
          </div>
        </motion.section>

        {/* ── Fund Info ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="zion-rainbow-card p-8" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{L6IssobellaCopy.spaceFund[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Rocket className="h-7 w-7 text-zion-purple-400" />
              {L6IssobellaCopy.l6IssobellaFund5BlockReward[cs ? 'cs' : 'en']}
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="zion-rainbow-sub p-4 text-center" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">{L6IssobellaCopy.blockShare[cs ? 'cs' : 'en']}</p>
              <p className="text-3xl font-bold text-zion-purple-400">5%</p>
              <p className="text-xs text-gray-500 mt-1">{L6IssobellaCopy.everyBlockForever[cs ? 'cs' : 'en']}</p>
            </div>
            <div className="zion-rainbow-sub p-4 text-center" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">{L6IssobellaCopy.approxMonth[cs ? 'cs' : 'en']}</p>
              <p className="text-3xl font-bold text-zion-cyan-400">~11,7M</p>
              <p className="text-xs text-gray-500 mt-1">ZION</p>
            </div>
            <div className="zion-rainbow-sub p-4 text-center" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">{L6IssobellaCopy.governedBy[cs ? 'cs' : 'en']}</p>
              <p className="text-2xl font-bold text-zion-purple-400">DAO</p>
              <p className="text-xs text-gray-500 mt-1">{L6IssobellaCopy.l6Council[cs ? 'cs' : 'en']}</p>
            </div>
          </div>
          <div className="zion-rainbow-sub p-4 text-sm text-gray-400 font-mono break-all" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
            <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">{L6IssobellaCopy.fundWallet[cs ? 'cs' : 'en']}</p>
            {ISSOBELLA_WALLET}
          </div>
        </motion.section>

        {/* ── Missions / Vision ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="zion-rainbow-card p-8" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{L6IssobellaCopy.missionsVision[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Star className="h-7 w-7 text-zion-purple-400" />
              {L6IssobellaCopy.cosmicMissions[cs ? 'cs' : 'en']}
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {missions.map((mission) => (
              <div key={mission.name} className={`zion-rainbow-sub p-5`} style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
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
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="zion-rainbow-card p-8" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{L6IssobellaCopy.principles[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Sparkles className="h-7 w-7 text-zion-purple-400" />
              {L6IssobellaCopy.l6LayerFoundations[cs ? 'cs' : 'en']}
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {principles.map((p) => (
              <div key={p.title} className="zion-rainbow-sub p-5" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
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
          <Sparkles className="h-12 w-12 text-zion-purple-400 mx-auto mb-4" />
          <h2 className="text-3xl font-semibold text-white mb-4">Hiranyagarbha · {L6IssobellaCopy.goldenEgg[cs ? 'cs' : 'en']}</h2>
          <p className="text-gray-300 max-w-2xl mx-auto text-lg">
            {L6IssobellaCopy.l6IssobellaIsThePhysicalEmbodi[cs ? 'cs' : 'en']}
          </p>
          <div className="mt-4 inline-flex items-center gap-2 text-xs text-zion-purple-300 border border-zion-purple-500/30 bg-zion-purple-500/10 rounded-full px-4 py-2">
            <Heart className="h-3 w-3" /> Hiran v2.3 · Zion AI · L6 co-steward
          </div>
        </motion.section>

        {/* ── Links ── */}
        <motion.section initial={{ opacity: 0, scale: 0.98 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="zion-cta-banner">
          <h2 className="text-2xl font-semibold text-white text-center mb-6">{L6IssobellaCopy.learnMoreAboutL6AndTheEcosyste[cs ? 'cs' : 'en']}</h2>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/dao" className="zion-rainbow-sub inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
              <Crown className="h-4 w-4 text-zion-gold" /> DAO Governance
            </Link>
            <Link href="/network" className="zion-rainbow-sub inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
              <Globe2 className="h-4 w-4 text-zion-cyan-400" /> {L6IssobellaCopy.network[cs ? 'cs' : 'en']}
            </Link>
            <Link href="/l5-free-world" className="inline-flex items-center gap-2 rounded-2xl border border-zion-gold-500/30 bg-zion-gold-500/5 px-6 py-3 text-sm font-semibold text-amber-200 hover:bg-zion-gold-500/10 transition-colors">
              L5 Free World <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </motion.section>

      </div>
    </div>
  );
}
