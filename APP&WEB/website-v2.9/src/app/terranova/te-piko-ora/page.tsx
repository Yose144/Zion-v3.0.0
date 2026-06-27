'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Compass,
  Droplets,
  Globe,
  Heart,
  LucideIcon,
  MapPin,
  Network,
  Shield,
  Sparkles,
  Star,
  Sun,
  Users,
  Waves,
  Wind,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

type FeatureItem = {
  icon: LucideIcon;
  titleCs: string;
  titleEn: string;
  descCs: string;
  descEn: string;
  status: 'planned' | 'vision';
  color: string;
  rgb: string;
};

type IntegrationItem = {
  label: string;
  status: 'active' | 'planned' | 'tbd';
  icon: LucideIcon;
};

type SignalItem = {
  icon: LucideIcon;
  labelCs: string;
  labelEn: string;
  value: string;
};

const FEATURES: FeatureItem[] = [
  {
    icon: Compass,
    titleCs: 'Wayfinding škola',
    titleEn: 'Wayfinding School',
    descCs: 'Tradiční polynéská navigace — čtení hvězd, vln, větru a ptáků. Tisíce kilometrů bez přístrojů. Distribuovaný konsensus jako způsob života.',
    descEn: 'Traditional Polynesian navigation — reading stars, waves, wind and birds. Thousands of kilometres without instruments. Distributed consensus as a way of life.',
    status: 'planned' as const,
    color: '#22D3EE',
    rgb: '34,211,238',
  },
  {
    icon: Waves,
    titleCs: 'Marine permakultura',
    titleEn: 'Marine Permaculture',
    descCs: 'Regenerativní péče o laguny, korálové útesy a mořské ekosystémy. Potravní souverenita komunity z oceánu i ze země.',
    descEn: 'Regenerative care for lagoons, coral reefs and marine ecosystems. Community food sovereignty from ocean and land.',
    status: 'planned' as const,
    color: '#06B6D4',
    rgb: '6,182,212',
  },
  {
    icon: Globe,
    titleCs: 'Kulturní obnova',
    titleEn: 'Cultural Revival',
    descCs: 'Jazyk Reo Māohi, tatau jako živý ledger, va\'a (kánoe) governance. Polynéská moudrost a ZION blockchain — dva způsoby záznamu paměti.',
    descEn: 'Reo Māohi language, tatau as living ledger, va\'a (canoe) governance. Polynesian wisdom and ZION blockchain — two ways of recording memory.',
    status: 'planned' as const,
    color: '#F59E0B',
    rgb: '245,158,11',
  },
  {
    icon: Sun,
    titleCs: 'Solar & off-grid',
    titleEn: 'Solar & off-grid',
    descCs: 'Energetická soběstačnost — solární, větrná a přílivová energie. ZION node běžící lokálně, data neopouštějí komunitu.',
    descEn: 'Energy self-sufficiency — solar, wind and tidal energy. ZION node running locally, data stays in the community.',
    status: 'planned' as const,
    color: '#FBBF24',
    rgb: '251,191,36',
  },
  {
    icon: Heart,
    titleCs: 'Humanitární fond',
    titleEn: 'Humanitarian Fund',
    descCs: 'Komunitní fond napájený z ZION tithe — 5 % každého vytěženého bloku míří automaticky ke komunitám v nouzi.',
    descEn: 'Community fund powered by ZION tithe — 5% of every mined block flows automatically to communities in need.',
    status: 'planned' as const,
    color: '#EC4899',
    rgb: '236,72,153',
  },
  {
    icon: Shield,
    titleCs: 'Ochrana dědictví',
    titleEn: 'Heritage Protection',
    descCs: 'Záznamy na ZION blockchainu — immutable ledger pro kulturní dědictví, pozemková práva a komunitní rozhodnutí.',
    descEn: 'Records on ZION blockchain — immutable ledger for cultural heritage, land rights and community decisions.',
    status: 'vision' as const,
    color: '#8B5CF6',
    rgb: '139,92,246',
  },
];

const SIGNALS: SignalItem[] = [
  { icon: MapPin, value: 'Raiatea / Tahiti', labelCs: 'Lokalita', labelEn: 'Location' },
  { icon: Waves, value: 'Polynésie', labelCs: 'Region', labelEn: 'Region' },
  { icon: Star, value: '2027–2030', labelCs: 'Fáze 1', labelEn: 'Phase 1' },
];

const PHASES = [
  {
    num: '0',
    cs: 'Průzkum & Partnerství',
    en: 'Exploration & Partnerships',
    descCs: 'Kontakt s místními komunitami, polynéskými autoritami a ZION Guardians v regionu. Výběr lokality (Raiatea nebo Tahiti).',
    descEn: 'Contact with local communities, Polynesian authorities and ZION Guardians in the region. Site selection (Raiatea or Tahiti).',
    active: true,
  },
  {
    num: '1',
    cs: 'Základní infrastruktura',
    en: 'Core Infrastructure',
    descCs: 'Pozemek, solární energie, první fare (tradiční příbytek), ZION node, základní wayfinding škola.',
    descEn: 'Land, solar energy, first fare (traditional dwelling), ZION node, basic wayfinding school.',
    active: false,
  },
  {
    num: '2',
    cs: 'Živá komunita',
    en: 'Living Community',
    descCs: 'Marine permakultura, kulturní obnova, lokální governance — va\'a model. Propojení s Rapa Nui lekce programem.',
    descEn: 'Marine permaculture, cultural revival, local governance — va\'a model. Connection with Rapa Nui lessons program.',
    active: false,
  },
  {
    num: '3',
    cs: 'Sítový uzel',
    en: 'Network Node',
    descCs: 'Plně integrovaný L5 uzel v Terra Nova síti. Humanitární fond aktivity. Wayfinding school otevřena globálně.',
    descEn: 'Fully integrated L5 node in the Terra Nova network. Humanitarian fund activities. Wayfinding school open globally.',
    active: false,
  },
];

const STATUS_LABEL = {
  planned: {
    cs: 'Plánováno',
    en: 'Planned',
    color: '#22D3EE',
    border: 'rgba(34,211,238,0.3)',
    bg: 'rgba(34,211,238,0.08)',
  },
  vision: {
    cs: 'Vize',
    en: 'Vision',
    color: '#A78BFA',
    border: 'rgba(167,139,250,0.3)',
    bg: 'rgba(167,139,250,0.08)',
  },
};

const ZION_ITEMS: IntegrationItem[] = [
  { label: 'ZION L1 Node', status: 'planned', icon: Network },
  { label: 'DAO Governance', status: 'planned', icon: Users },
  { label: 'Humanitarian Fund', status: 'planned', icon: Heart },
  { label: 'Cultural Heritage Ledger', status: 'tbd', icon: Shield },
  { label: 'Wayfinding NFT / CL', status: 'tbd', icon: Compass },
  { label: 'Marine Seed Library', status: 'tbd', icon: Sparkles },
];

const RAPA_NUI_LESSONS = [
  {
    cs: 'Carrying capacity je zákon, ne doporučení.',
    en: 'Carrying capacity is law, not a recommendation.',
  },
  {
    cs: 'Dunbarovo číslo (~150) je přirozená hranice Ahu — překroč ji a řetěz se láme.',
    en: 'Dunbar\'s number (~150) is the natural Ahu boundary — exceed it and the chain breaks.',
  },
  {
    cs: 'Rotační autorita (Tangata manu) > dědičná moc.',
    en: 'Rotational authority (Tangata manu) > hereditary power.',
  },
  {
    cs: 'Immutable záznamy (Rongorongo) přežijí politické cykly.',
    en: 'Immutable records (Rongorongo) outlast political cycles.',
  },
  {
    cs: 'Obnova je možná — Rapa Nui přežila redukci na 111 obyvatel.',
    en: 'Restoration is possible — Rapa Nui survived reduction to 111 inhabitants.',
  },
];

export default function TePikoOraPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="relative z-10 mx-auto max-w-5xl px-4 py-12 md:px-8">

        {/* Back nav */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8 flex items-center gap-4"
        >
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{cs ? 'Domů' : 'Home'}</span>
          </Link>
          <span className="text-gray-700">|</span>
          <Link
            href="/terranova"
            className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Terra Nova</span>
          </Link>
        </motion.div>

        {/* ═══ HERO ═══ */}
        <motion.header
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <div className="relative zion-rainbow-card rounded-3xl md:rounded-[32px] p-6 md:p-10 overflow-hidden border border-white/10 bg-black/60 backdrop-blur-xl" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
            <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start">
              {/* Ocean symbol */}
              <div className="shrink-0 w-20 h-20 rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-black/50 to-black flex items-center justify-center text-4xl">
                🌊
              </div>

              {/* Text column */}
              <div className="space-y-3 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold tracking-[0.3em] text-gray-300 uppercase">
                    L5 · Terra Nova Pioneer
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-zion-gold/30 bg-zion-gold/10 px-3 py-1 text-[10px] font-semibold tracking-[0.2em] text-zion-gold uppercase">
                    📋 {cs ? 'Plánováno 2027+' : 'Planned 2027+'}
                  </span>
                </div>

                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gradient">
                  Te Pīko Ora
                </h1>
                <p className="text-lg text-zion-cyan font-medium">
                  {cs ? 'Živý střed · Polynésie · Terra Nova ®' : 'Living Centre · Polynesia · Terra Nova ®'}
                </p>

                <div className="flex items-center gap-1.5 text-gray-400">
                  <MapPin className="w-4 h-4 text-gray-300 shrink-0" />
                  <span className="text-sm">Raiatea · Francouzská Polynésie</span>
                </div>

                <blockquote className="mt-4 pl-4 border-l-2 border-white/10 text-sm text-gray-400 italic leading-relaxed max-w-lg">
                  {cs
                    ? '"Iorana. Zde je písek, zde je moře, zde je skála. Zde končí mapa. A zde začíná pravda."'
                    : '"Iorana. Here is the sand, here is the sea, here is the rock. Here the map ends. And here truth begins."'}
                </blockquote>

                <div className="grid gap-3 pt-3 sm:grid-cols-3">
                  {SIGNALS.map((signal) => {
                    const Icon = signal.icon;
                    return (
                      <div key={signal.labelCs} className="zion-rainbow-sub px-3 py-3" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
                        <div className="flex items-center gap-2 text-zion-gold">
                          <Icon className="h-4 w-4" />
                          <span className="text-sm font-semibold">{signal.value}</span>
                        </div>
                        <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-gray-500">
                          {cs ? signal.labelCs : signal.labelEn}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </motion.header>

        {/* ═══ POLYNÉSIE INFO ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.6 }}
          className="mb-16"
        >
          <div className="zion-rainbow-card rounded-3xl p-6 md:p-8 border border-white/10 relative overflow-hidden" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
            <div className="relative z-10 grid md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-3">
                <h3 className="text-lg font-bold text-gray-300">
                  {cs ? 'Francouzská Polynésie — Koruna Pacifiku' : 'French Polynesia — Crown of the Pacific'}
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  {cs
                    ? 'Pět souostroví, 118 ostrovů, 4 miliony km² oceánu. Polynézští navigátoři překonali Pacifik v kánoe bez kompasu — čtením hvězd, vln, větru a letícího ptactva. Tento wayfinding je nejstarší distribuovaný konsensus v dějinách lidstva.'
                    : 'Five archipelagos, 118 islands, 4 million km² of ocean. Polynesian navigators crossed the Pacific in canoes without a compass — reading stars, waves, wind and flying birds. This wayfinding is the oldest distributed consensus in human history.'}
                </p>
                <p className="text-gray-500 text-sm leading-relaxed">
                  {cs
                    ? 'Raiatea je posvátné srdce Polynésie — místo, odkud se říká, že vypluli první osadníci na Havaj, Nový Zéland a Velikonoční ostrov. Marae Taputapuātea je UNESCO světové dědictví. Laguna je jednou z největších ve Francouzské Polynésii.'
                    : 'Raiatea is the sacred heart of Polynesia — the place from which the first settlers are said to have sailed to Hawaii, New Zealand and Easter Island. Marae Taputapuātea is a UNESCO World Heritage Site. The lagoon is one of the largest in French Polynesia.'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 content-start">
                {[
                  { label: 'UNESCO', val: 'Marae Taputapuātea' },
                  { label: cs ? 'Ostrovů' : 'Islands', val: '118' },
                  { label: cs ? 'Oceán' : 'Ocean', val: '4M km²' },
                  { label: cs ? 'Kultura' : 'Culture', val: cs ? 'Polynésie' : 'Polynesia' },
                ].map((s) => (
                  <div key={s.label} className="text-center p-3 zion-tile">
                    <p className="text-gray-300 font-bold text-xs">{s.val}</p>
                    <p className="text-gray-600 text-[10px]">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        {/* ═══ POLYNÉSKÝ MODEL ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.6 }}
          className="mb-16"
        >
          <div className="text-center mb-8">
            <p className="text-[10px] uppercase tracking-[0.45em] text-gray-500 mb-2">
              {cs ? 'Inspirace' : 'Inspiration'}
            </p>
            <h2 className="text-2xl font-bold text-white">
              {cs ? 'Polynéský model & ZION' : 'Polynesian Model & ZION'}
            </h2>
          </div>

          <div className="zion-section overflow-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-3 text-center text-[10px] uppercase tracking-[0.3em] font-semibold bg-white/5 border-b border-white/10">
              <div className="p-3 text-gray-500">{cs ? 'Polynésie' : 'Polynesia'}</div>
              <div className="p-3 text-gray-300 sm:border-l border-white/10">{cs ? 'Princip' : 'Principle'}</div>
              <div className="p-3 text-gray-300 sm:border-l border-white/10">ZION</div>
            </div>
            {[
              {
                poly: { cs: 'Wayfinding (fa\'atere)', en: 'Wayfinding (fa\'atere)' },
                principle: { cs: 'Více signálů najednou — žádný jediný GPS', en: 'Multiple signals at once — no single GPS' },
                zion: { cs: 'Distribuovaný konsensus', en: 'Distributed consensus' },
              },
              {
                poly: { cs: 'Tatau (kožní záznamy)', en: 'Tatau (skin records)' },
                principle: { cs: 'Immutable ledger genealogií', en: 'Immutable genealogy ledger' },
                zion: { cs: 'Blockchain — nelze přepsat', en: 'Blockchain — cannot be rewritten' },
              },
              {
                poly: { cs: 'Va\'a (kánoe)', en: 'Va\'a (canoe)' },
                principle: { cs: 'Všichni pádlují — žádný kapitan', en: 'All paddle — no single captain' },
                zion: { cs: 'DAO governance', en: 'DAO governance' },
              },
              {
                poly: { cs: 'Tangata manu', en: 'Tangata manu' },
                principle: { cs: 'Rotační autorita — důkaz činem', en: 'Rotational authority — proof by deed' },
                zion: { cs: 'Proof of Work + CL systém', en: 'Proof of Work + CL system' },
              },
            ].map((row, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-3 text-sm border-b border-white/5 last:border-0">
                <div className="p-3 text-gray-300 text-xs">{cs ? row.poly.cs : row.poly.en}</div>
                <div className="p-3 text-gray-400 text-xs sm:border-l border-white/5">{cs ? row.principle.cs : row.principle.en}</div>
                <div className="p-3 text-gray-300 text-xs sm:border-l border-white/5">{cs ? row.zion.cs : row.zion.en}</div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ═══ FEATURES GRID ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="mb-16"
        >
          <div className="text-center mb-8">
            <p className="text-[10px] uppercase tracking-[0.45em] text-gray-500 mb-2">
              {cs ? 'Koncept projektu' : 'Project Concept'}
            </p>
            <h2 className="text-2xl font-bold text-white">
              {cs ? 'Aktivity & Vize' : 'Activities & Vision'}
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => {
              const s = STATUS_LABEL[f.status];
              const Icon = f.icon;
              return (
                <motion.div
                  key={f.titleCs}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.07, duration: 0.5 }}
                  className="relative zion-rainbow-sub p-5 space-y-3 overflow-hidden group hover:scale-[1.02] transition-transform duration-300"
                  style={{ '--rc': '16, 185, 129' } as React.CSSProperties}
                >
                  <div
                    className="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-[50px] opacity-20 group-hover:opacity-35 transition-opacity duration-500"
                    
                  />
                  <div className="flex items-start justify-between relative z-10 gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center zion-tile">
                      <Icon className="h-5 w-5 text-zion-gold" />
                    </span>
                    <span
                      className="rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.15em]"
                      style={{ color: s.color, borderColor: s.border, backgroundColor: s.bg }}
                    >
                      {cs ? s.cs : s.en}
                    </span>
                  </div>
                  <h3 className="font-bold text-zion-gold relative z-10">
                    {cs ? f.titleCs : f.titleEn}
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed relative z-10">
                    {cs ? f.descCs : f.descEn}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        {/* ═══ RAPA NUI LEKCE ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.6 }}
          className="mb-16"
        >
          <div className="zion-rainbow-card rounded-3xl p-6 md:p-8 border border-amber-500/15 relative overflow-hidden" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
            <div className="absolute inset-0 bg-gradient-to-br from-amber-900/15 to-transparent" />
            <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-[70px] bg-amber-500/10" />
            <div className="relative z-10 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🗿</span>
                <div>
                  <h3 className="text-lg font-bold text-amber-400">
                    {cs ? 'Rapa Nui lekce — wayfinding škola' : 'Rapa Nui Lessons — wayfinding school'}
                  </h3>
                  <p className="text-gray-500 text-xs">
                    {cs
                      ? 'Te Pīko Ora explicitně učí tyto lekce jako součást kurikula.'
                      : 'Te Pīko Ora explicitly teaches these lessons as part of the curriculum.'}
                  </p>
                </div>
              </div>
              <ul className="space-y-2">
                {RAPA_NUI_LESSONS.map((lesson, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                    <span className="text-gray-300 shrink-0 mt-0.5 font-bold">{i + 1}.</span>
                    {cs ? lesson.cs : lesson.en}
                  </li>
                ))}
              </ul>
              <p className="text-gray-600 text-xs pt-2">
                {cs
                  ? 'Dvě tváře jedné vlny: Te Pīko Ora (koruna, hojnost) + Rapa Nui (kořen, varování). Obojí potřebujeme.'
                  : 'Two faces of one wave: Te Pīko Ora (crown, abundance) + Rapa Nui (root, warning). We need both.'}
              </p>
            </div>
          </div>
        </motion.section>

        {/* ═══ PHASE TIMELINE ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="mb-16"
        >
          <div className="text-center mb-8">
            <p className="text-[10px] uppercase tracking-[0.45em] text-gray-500 mb-2">
              {cs ? 'Fáze rozvoje' : 'Development Phases'}
            </p>
            <h2 className="text-2xl font-bold text-white">
              {cs ? 'Od vize k realitě' : 'From Vision to Reality'}
            </h2>
          </div>

          <div className="relative">
            <div className="absolute left-6 top-4 bottom-4 w-px bg-gradient-to-b from-zion-gold/40 via-white/10 to-transparent" />
            <div className="space-y-4 pl-16">
              {PHASES.map((p, i) => (
                <motion.div
                  key={p.num}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + i * 0.08, duration: 0.5 }}
                  className="relative"
                >
                  <div
                    className="absolute -left-10 top-3 w-4 h-4 rounded-full border-2 flex items-center justify-center"
                    style={{
                      borderColor: p.active ? '#22D3EE' : 'rgba(255,255,255,0.15)',
                      backgroundColor: p.active ? 'rgba(34,211,238,0.2)' : 'rgba(0,0,0,0.5)',
                    }}
                  >
                    {p.active && <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />}
                  </div>

                  <div
                    className="rounded-2xl border p-4 space-y-1"
                    style={{
                      borderColor: p.active ? 'rgba(34,211,238,0.2)' : 'rgba(255,255,255,0.06)',
                      backgroundColor: p.active ? 'rgba(34,211,238,0.04)' : 'rgba(0,0,0,0.3)',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="text-xs font-bold tracking-wider"
                        style={{ color: p.active ? '#22D3EE' : 'rgba(255,255,255,0.3)' }}
                      >
                        {cs ? `Fáze ${p.num}` : `Phase ${p.num}`}
                      </span>
                      <span className="text-sm font-semibold text-white/80">
                        {cs ? p.cs : p.en}
                      </span>
                      {p.active && (
                        <span className="text-cyan-400 text-xs animate-pulse">
                          ⚡ {cs ? 'Právě hledáme' : 'Exploring now'}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-500 text-xs">{cs ? p.descCs : p.descEn}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ═══ ZION INTEGRATION ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="mb-16"
        >
          <div className="text-center mb-8">
            <p className="text-[10px] uppercase tracking-[0.45em] text-gray-500 mb-2">
              {cs ? 'Blockchain integrace' : 'Blockchain Integration'}
            </p>
            <h2 className="text-2xl font-bold text-white">ZION Network</h2>
          </div>

          <div className="zion-rainbow-card rounded-3xl p-6 md:p-8 border border-cyan-500/15 relative overflow-hidden" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/20 to-transparent" />
            <div className="absolute -top-16 -left-16 w-40 h-40 rounded-full blur-[80px] bg-cyan-500/10" />
            <div className="relative z-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ZION_ITEMS.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 zion-rainbow-sub p-3" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}
                >
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center zion-tile">
                    <item.icon className="h-4 w-4 text-cyan-200" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white/80">{item.label}</p>
                    <p className="text-[10px] text-gray-600 capitalize">
                      {item.status === 'active'
                        ? cs ? 'Aktivní' : 'Active'
                        : item.status === 'planned'
                        ? cs ? 'Plánováno' : 'Planned'
                        : 'TBD'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ═══ OPEN QUESTIONS ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.6 }}
          className="mb-16"
        >
          <div className="zion-rainbow-card rounded-3xl p-6 md:p-8 border border-cyan-500/15 space-y-4" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
            <h3 className="text-lg font-bold text-gray-300">
              {cs ? 'Otevřené otázky — hledáme Guardians' : 'Open Questions — looking for Guardians'}
            </h3>
            <ul className="space-y-2">
              {[
                cs ? 'Konkrétní lokace (Raiatea / Tahiti / jiný ostrov?)' : 'Specific location (Raiatea / Tahiti / another island?)',
                cs ? 'Polynézští partneři — místní komunity, marae správci, navigátoři' : 'Polynesian partners — local communities, marae stewards, navigators',
                cs ? 'Zakládající Guardians se znalostí oceánské kultury a zemědělství' : 'Founding Guardians with knowledge of ocean culture and farming',
                cs ? 'Právní forma ve Francouzské Polynésii (asociace / SAS / komunitní nadace?)' : 'Legal form in French Polynesia (association / SAS / community foundation?)',
                cs ? 'Financování fáze 0 (ZION fond? Humanitární grant? Vlastní zdroje?)' : 'Phase 0 financing (ZION fund? Humanitarian grant? Own resources?)',
              ].map((q, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                  <span className="text-cyan-500 shrink-0 mt-0.5">◇</span>
                  {q}
                </li>
              ))}
            </ul>
            <p className="text-gray-600 text-xs pt-2">
              {cs
                ? 'Slyšíš volání Pacifiku? Jsi Guardian, který chce stavět na okraji světa?'
                : 'Do you hear the call of the Pacific? Are you a Guardian who wants to build at the edge of the world?'}
            </p>
            <a
              href="https://discord.gg/eatGYDbd"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2 text-sm text-gray-300 transition-all duration-300"
            >
              <Users className="w-4 h-4" />
              {cs ? 'Připojit se na Discord' : 'Join Discord'}
            </a>
          </div>
        </motion.section>

        {/* ═══ BOTTOM NAV ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.5 }}
          className="flex items-center justify-between"
        >
          <Link
            href="/terranova/dharma-temple"
            className="inline-flex items-center gap-2 rounded-xl border border-violet-500/25 bg-violet-500/10 hover:bg-violet-500/20 px-4 py-2 text-sm text-violet-300 transition-all duration-300"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Dharma Temple</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{cs ? 'Domů' : 'Home'}</span>
            </Link>
            <span className="text-gray-700">|</span>
            <Link
              href="/terranova"
              className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
            >
              <span>{cs ? 'Terra Nova' : 'Terra Nova'}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
