'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Droplets,
  Globe,
  Landmark,
  LucideIcon,
  MapPin,
  Mountain,
  Network,
  Orbit,
  Sprout,
  Trees,
  Users,
  Zap,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

type FeatureItem = {
  icon: LucideIcon;
  titleCs: string;
  titleEn: string;
  descCs: string;
  descEn: string;
  status: 'planned' | 'place';
  color: string;
  rgb: string;
};

type IntegrationItem = {
  label: string;
  status: 'active' | 'planned' | 'tbd';
  icon: LucideIcon;
};

const FEATURES: FeatureItem[] = [
  {
    icon: Orbit,
    titleCs: 'Meditace & Ticho',
    titleEn: 'Meditation & Silence',
    descCs: 'Denní praxe, silence retreaty, meditační buňky v přírodě. Místo kde se vnitřní práce stává rutinou.',
    descEn: 'Daily practice, silence retreats, meditation cells in nature. A place where inner work becomes routine.',
    status: 'planned' as const,
    color: '#A78BFA',
    rgb: '167,139,250',
  },
  {
    icon: Sprout,
    titleCs: 'Syntropic zahrada',
    titleEn: 'Syntropic Garden',
    descCs: 'Vícevrstvý agroforestry systém na vulkanické půdě La Palmy — jedné z nejúrodnějších půd Atlantiku.',
    descEn: 'Multi-layer agroforestry system on La Palma volcanic soil — one of the most fertile soils in the Atlantic.',
    status: 'planned' as const,
    color: '#34D399',
    rgb: '52,211,153',
  },
  {
    icon: Network,
    titleCs: 'Retreaty & Dharma',
    titleEn: 'Retreats & Dharma',
    descCs: 'Spirituální programy, dharma circle, ceremonie. Mezinárodní hosté přicházejí pro hlubší zastavení.',
    descEn: 'Spiritual programs, dharma circle, ceremonies. International guests come for deeper stillness.',
    status: 'planned' as const,
    color: '#C084FC',
    rgb: '192,132,252',
  },
  {
    icon: Mountain,
    titleCs: 'Vulkanická energie',
    titleEn: 'Volcanic Energy',
    descCs: 'La Palma — ostrov UNESCO bioreservace. Vulkanická krajina jako přirozený partner spirituální praxe.',
    descEn: 'La Palma — UNESCO biosphere reserve island. Volcanic landscape as a natural partner for spiritual practice.',
    status: 'place' as const,
    color: '#F97316',
    rgb: '249,115,22',
  },
  {
    icon: Droplets,
    titleCs: 'Off-grid voda & Energie',
    titleEn: 'Off-grid Water & Energy',
    descCs: 'Solar + mikrohydro ze srážek. La Palma má vydatné deště a výškový profil ideální pro průtočné turbíny.',
    descEn: 'Solar + micro-hydro from rainfall. La Palma has generous rain and elevation ideal for run-of-river turbines.',
    status: 'planned' as const,
    color: '#06B6D4',
    rgb: '6,182,212',
  },
  {
    icon: Landmark,
    titleCs: 'Dharma Governance',
    titleEn: 'Dharma Governance',
    descCs: 'Sociokracie + dharma council. Kruhové rozhodování bez hierarchie. Přijímání nových členů přes DAO.',
    descEn: 'Sociocracy + dharma council. Circular decision-making without hierarchy. New member admission via DAO.',
    status: 'planned' as const,
    color: '#F472B6',
    rgb: '244,114,182',
  },
];

const PHASES = [
  { num: 0, cs: 'Zárodek', en: 'Seed', descCs: 'Identifikace pozemku, legal základ, core Guardians', descEn: 'Land identification, legal base, core Guardians', active: true },
  { num: 1, cs: 'Kořeny', en: 'Roots', descCs: 'Solar, voda, základní ubytování, zahrada', descEn: 'Solar, water, basic accommodation, garden' },
  { num: 2, cs: 'Komunita', en: 'Community', descCs: 'Stálí obyvatelé, denní praxe, ZION node', descEn: 'Permanent residents, daily practice, ZION node' },
  { num: 3, cs: 'Síť', en: 'Network', descCs: 'Propojení se Zahradou Genesis, Rhizom síť', descEn: 'Connection with Zahrada Genesis, Rhizome network' },
  { num: 4, cs: 'Výzařování', en: 'Radiance', descCs: 'Retreaty, výukové programy, mezinárodní hosté', descEn: 'Retreats, educational programs, international guests' },
];

const ZION_ITEMS: IntegrationItem[] = [
  { label: 'ZION Node', status: 'planned', icon: Network },
  { label: 'Guardian Wallet', status: 'tbd', icon: Landmark },
  { label: 'Medical Table', status: 'planned', icon: Zap },
  { label: 'LoRa / Meshtastic', status: 'planned', icon: Globe },
  { label: 'Seed Library Exchange', status: 'planned', icon: Sprout },
  { label: 'Knowledge Commons', status: 'planned', icon: Trees },
];

const SIGNALS = [
  { icon: Mountain, value: 'UNESCO', labelCs: 'Bioreservace', labelEn: 'Biosphere' },
  { icon: Droplets, value: '700–1500', labelCs: 'mm srážek', labelEn: 'mm rainfall' },
  { icon: Orbit, value: 'Retreat', labelCs: 'Ticho & praxe', labelEn: 'Silence & practice' },
];

const COMPARE = [
  { dim: { cs: 'Energie místa', en: 'Place Energy' }, genesis: { cs: 'Atlantický vítr & oceán', en: 'Atlantic wind & ocean' }, dharma: { cs: 'Vulkanické ticho & hory', en: 'Volcanic silence & mountains' } },
  { dim: { cs: 'Primární role', en: 'Primary Role' }, genesis: { cs: 'Base Camp', en: 'Base Camp' }, dharma: { cs: 'Sanctuary', en: 'Sanctuary' } },
  { dim: { cs: 'Klíčová aktivita', en: 'Key Activity' }, genesis: { cs: 'Farma, surf, community', en: 'Farm, surf, community' }, dharma: { cs: 'Meditace, dharma, vzdělávání', en: 'Meditation, dharma, education' } },
];

const STATUS_LABEL = {
  open: { cs: 'Otevřeno', en: 'Open', color: '#34D399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.25)' },
  active: { cs: 'Aktivní', en: 'Active', color: '#10B981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)' },
  planned: { cs: 'Plánováno', en: 'Planned', color: '#60A5FA', bg: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.25)' },
  place: { cs: 'Místo', en: 'Place', color: '#F97316', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.25)' },
};

export default function DharmaTemplePage() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  return (
    <div className="pt-28 md:pt-28 pb-24 overflow-x-hidden">
      <div className="relative z-10 zion-container max-w-5xl">

        {/* Back nav */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-10"
        >
          <Link
            href="/terranova"
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-zion-gold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {cs ? 'Zpět na Terra Nova' : 'Back to Terra Nova'}
          </Link>
        </motion.div>

        {/* ═══ HERO ═══ */}
        <motion.header
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="mb-20 relative"
        >
          <div className="relative zion-panel rounded-3xl md:rounded-[32px] p-6 md:p-10 overflow-hidden border border-white/10 bg-black/60 backdrop-blur-xl">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-8">
              {/* Icon column */}
              <div className="shrink-0">
                <div className="relative flex h-28 w-28 items-center justify-center rounded-[32px] border border-white/10 bg-gradient-to-br from-white/10 via-black/50 to-black shadow-[0_0_60px_rgba(255,215,0,0.12)]">
                  <Orbit className="relative z-10 h-10 w-10 text-zion-gold" />
                  <Mountain className="absolute bottom-5 right-5 h-4 w-4 text-zion-cyan" />
                </div>
              </div>

              {/* Text column */}
              <div className="space-y-3 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold tracking-[0.3em] text-gray-300 uppercase">
                    L5 · Terra Nova Pioneer
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-zion-gold/30 bg-zion-gold/10 px-3 py-1 text-[10px] font-semibold tracking-[0.2em] text-zion-gold uppercase">
                    🔵 {cs ? 'V přípravě' : 'Planning'}
                  </span>
                </div>

                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gradient">
                  Dharma Temple
                </h1>
                <p className="text-lg text-zion-cyan font-medium">Sanctuary · Terra Nova ®</p>

                <div className="flex items-center gap-1.5 text-gray-400">
                  <MapPin className="w-4 h-4 text-zion-gold shrink-0" />
                  <span className="text-sm">La Palma · Kanárské ostrovy · Španělsko</span>
                </div>

                <blockquote className="mt-4 pl-4 border-l-2 border-white/10 text-sm text-gray-400 italic leading-relaxed max-w-lg">
                  {cs
                    ? '"Dharma není cesta od světa. Je to způsob, jak být ve světě jinak."'
                    : '"Dharma is not a path away from the world. It is a way of being in the world differently."'}
                </blockquote>

                <div className="grid gap-3 pt-3 sm:grid-cols-3">
                  {SIGNALS.map((signal) => {
                    const Icon = signal.icon;
                    return (
                      <div key={signal.labelCs} className="rounded-2xl border border-white/10 bg-black/60 px-3 py-3 backdrop-blur-sm">
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

        {/* ═══ LA PALMA INFO ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.6 }}
          className="mb-16"
        >
          <div className="zion-panel rounded-3xl p-6 md:p-8 border border-white/10 relative overflow-hidden">
            <div className="relative z-10 grid md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-3">
                <h3 className="text-lg font-bold text-zion-gold">
                  {cs ? 'La Palma — La Isla Bonita' : 'La Palma — La Isla Bonita'}
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  {cs
                    ? 'La Palma je nazývána "Krásným ostrovem". Nejzelenější z Kanárských ostrovů, s bioreservací UNESCO, národním parkem Caldera de Taburiente a nocemi tak tmavými, že tu stojí jedno z nejlepších observatoří světa.'
                    : 'La Palma is called the "Beautiful Island". The greenest of the Canary Islands, with a UNESCO biosphere reserve, Caldera de Taburiente national park, and nights so dark it hosts one of the world\'s finest observatories.'}
                </p>
                <p className="text-gray-500 text-sm leading-relaxed">
                  {cs
                    ? 'Vulkanická půda uchovává teplo, drží vlhkost a je extrémně úrodná — stromy tu rostou jako zázrakem. Voda teče z hor. Místo má přirozené podmínky pro život, které by v kontinentální Evropě trvalo dekády vybudovat.'
                    : 'The volcanic soil retains heat, holds moisture and is extremely fertile — trees grow here like magic. Water flows from the mountains. The place has natural conditions for life that would take decades to build in continental Europe.'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 content-start">
                {[
                  { label: 'UNESCO', val: cs ? 'Bioreservace' : 'Biosphere' },
                  { label: cs ? 'Srážky' : 'Rainfall', val: '700–1500mm' },
                  { label: cs ? 'Půda' : 'Soil', val: cs ? 'Vulkanická' : 'Volcanic' },
                  { label: cs ? 'Observatoř' : 'Observatory', val: 'ORM' },
                ].map((s) => (
                  <div key={s.label} className="text-center p-3 rounded-xl bg-black/60 border border-white/10">
                    <p className="text-gray-300 font-bold text-sm">{s.val}</p>
                    <p className="text-gray-600 text-[10px]">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
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
                  className="relative rounded-[32px] border border-white/10 bg-black/60 backdrop-blur-xl p-5 space-y-3 overflow-hidden group hover:scale-[1.02] transition-transform duration-300"
                >
                  <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-[50px] bg-white/5 group-hover:bg-white/10 transition-opacity duration-500" />

                  <div className="flex items-start justify-between relative z-10 gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/20">
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
                      borderColor: p.active ? 'rgb(255,215,0)' : 'rgba(255,255,255,0.15)',
                      backgroundColor: p.active ? 'rgba(255,215,0,0.2)' : 'rgba(0,0,0,0.5)',
                    }}
                  >
                    {p.active && <div className="w-1.5 h-1.5 rounded-full bg-zion-cyan animate-pulse" />}
                  </div>

                  <div
                    className="rounded-2xl border border-white/10 bg-black/60 backdrop-blur-sm p-4 space-y-1"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="text-xs font-bold tracking-wider"
                        style={{ color: p.active ? 'rgb(6,182,212)' : 'rgba(255,255,255,0.3)' }}
                      >
                        {cs ? `Fáze ${p.num}` : `Phase ${p.num}`}
                      </span>
                      <span className="text-sm font-semibold text-white/80">
                        {cs ? p.cs : p.en}
                      </span>
                      {p.active && <span className="text-zion-cyan text-xs animate-pulse">⚡ {cs ? 'Nyní' : 'Now'}</span>}
                    </div>
                    <p className="text-gray-500 text-xs">{cs ? p.descCs : p.descEn}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ═══ COMPARE WITH GENESIS ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.6 }}
          className="mb-16"
        >
          <div className="text-center mb-8">
            <p className="text-[10px] uppercase tracking-[0.45em] text-gray-500 mb-2">
              {cs ? 'Sít Terra Nova' : 'Terra Nova Network'}
            </p>
            <h2 className="text-2xl font-bold text-white">
              {cs ? 'Propojení se Zahradou Genesis' : 'Connection with Zahrada Genesis'}
            </h2>
          </div>

          <div className="rounded-2xl border border-white/10 overflow-hidden">
            {/* Header row */}
            <div className="grid grid-cols-3 text-center text-[10px] uppercase tracking-[0.3em] font-semibold bg-white/5 border-b border-white/10">
              <div className="p-3 text-gray-500">{cs ? 'Dimenze' : 'Dimension'}</div>
              <div className="p-3 text-gray-300 border-l border-white/10">🌿 Zahrada Genesis</div>
              <div className="p-3 text-zion-gold border-l border-white/10">🕌 Dharma Temple</div>
            </div>
            {COMPARE.map((row, i) => (
              <div
                key={i}
                className="grid grid-cols-3 text-sm border-b border-white/5 last:border-0"
              >
                <div className="p-3 text-gray-500 text-xs">{cs ? row.dim.cs : row.dim.en}</div>
                <div className="p-3 text-gray-300 text-xs border-l border-white/5">{cs ? row.genesis.cs : row.genesis.en}</div>
                <div className="p-3 text-gray-300 text-xs border-l border-white/5">{cs ? row.dharma.cs : row.dharma.en}</div>
              </div>
            ))}
          </div>

          <p className="text-gray-600 text-xs text-center mt-4">
            {cs
              ? 'Oba projekty sdílejí zdrojový kód: Terra Nova etika, ZION blockchain, off-grid technologie, komunitní governance.'
              : 'Both projects share source code: Terra Nova ethics, ZION blockchain, off-grid technology, community governance.'}
          </p>
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

          <div className="zion-panel rounded-3xl p-6 md:p-8 border border-violet-500/15 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-900/20 to-transparent" />
            <div className="absolute -top-16 -left-16 w-40 h-40 rounded-full blur-[80px] bg-violet-500/10" />

            <div className="relative z-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ZION_ITEMS.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/60 p-3"
                >
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-violet-400/12 bg-violet-400/8">
                    <item.icon className="h-4 w-4 text-violet-200" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white/80">{item.label}</p>
                    <p className="text-[10px] text-gray-600 capitalize">
                      {item.status === 'active'
                        ? (cs ? 'Aktivní' : 'Active')
                        : item.status === 'planned'
                        ? (cs ? 'Plánováno' : 'Planned')
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
          <div className="zion-panel rounded-3xl p-6 md:p-8 border border-violet-500/15 space-y-4">
            <h3 className="text-lg font-bold text-zion-gold">
              {cs ? 'Otevřené otázky — hledáme Guardians' : 'Open Questions — looking for Guardians'}
            </h3>
            <ul className="space-y-2">
              {[
                cs ? 'Konkrétní lokace na La Palmě (sever / jih / nadmořská výška?)' : 'Specific location on La Palma (north / south / altitude?)',
                cs ? 'Zakládající Guardians — kdo je core team?' : 'Founding Guardians — who is the core team?',
                cs ? 'Právní forma (španělská asociación / SL / komunitní nadace?)' : 'Legal form (Spanish asociación / SL / community foundation?)',
                cs ? 'Financování fáze 0–1 (ZION fond? crowdfunding? vlastní zdroje?)' : 'Phase 0–1 financing (ZION fund? crowdfunding? own resources?)',
                cs ? 'Koordinace seed library se Zahradou Genesis' : 'Seed library coordination with Zahrada Genesis',
              ].map((q, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                  <span className="text-violet-500 shrink-0 mt-0.5">◇</span>
                  {q}
                </li>
              ))}
            </ul>
            <p className="text-gray-600 text-xs pt-2">
              {cs
                ? 'Jsi Guardian, který slyší volání La Palmy? Napiš nám.'
                : "Are you a Guardian who hears La Palma's call? Reach out."}
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
            href="/terranova/genesis"
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 hover:bg-emerald-500/20 px-4 py-2 text-sm text-emerald-300 transition-all duration-300"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{cs ? 'Zahrada Genesis' : 'Zahrada Genesis'}</span>
          </Link>
          <Link
            href="/terranova/te-piko-ora"
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/25 bg-cyan-500/10 hover:bg-cyan-500/20 px-4 py-2 text-sm text-cyan-300 transition-all duration-300"
          >
            <span>Te Pīko Ora</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>

      </div>
    </div>
  );
}
