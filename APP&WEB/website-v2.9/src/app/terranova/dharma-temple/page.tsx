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

const TerranovaDharmaTempleCopy = {
  backToTerraNova: { cs: `Zpět na Terra Nova`, en: `Back to Terra Nova` },
  planning: { cs: `V přípravě`, en: `Planning` },
  dharmaIsNotAPathAwayFromTheWor: { cs: `"Dharma není cesta od světa. Je to způsob, jak být ve světě jinak."`, en: `"Dharma is not a path away from the world. It is a way of being in the world differently."` },
  laPalmaLaIslaBonita: { cs: `La Palma — La Isla Bonita`, en: `La Palma — La Isla Bonita` },
  laPalmaIsCalledTheBeautifulIsl: { cs: `La Palma je nazývána "Krásným ostrovem". Nejzelenější z Kanárských ostrovů, s bioreservací UNESCO, národním parkem Caldera de Taburiente a nocemi tak tmavými, že tu stojí jedno z nejlepších observatoří světa.`, en: `La Palma is called the "Beautiful Island". The greenest of the Canary Islands, with a UNESCO biosphere reserve, Caldera de Taburiente national park, and nights so dark it hosts one of the world\'s finest observatories.` },
  theVolcanicSoilRetainsHeatHold: { cs: `Vulkanická půda uchovává teplo, drží vlhkost a je extrémně úrodná — stromy tu rostou jako zázrakem. Voda teče z hor. Místo má přirozené podmínky pro život, které by v kontinentální Evropě trvalo dekády vybudovat.`, en: `The volcanic soil retains heat, holds moisture and is extremely fertile — trees grow here like magic. Water flows from the mountains. The place has natural conditions for life that would take decades to build in continental Europe.` },
  biosphere: { cs: `Bioreservace`, en: `Biosphere` },
  rainfall: { cs: `Srážky`, en: `Rainfall` },
  soil: { cs: `Půda`, en: `Soil` },
  volcanic: { cs: `Vulkanická`, en: `Volcanic` },
  observatory: { cs: `Observatoř`, en: `Observatory` },
  projectConcept: { cs: `Koncept projektu`, en: `Project Concept` },
  activitiesVision: { cs: `Aktivity & Vize`, en: `Activities & Vision` },
  developmentPhases: { cs: `Fáze rozvoje`, en: `Development Phases` },
  fromVisionToReality: { cs: `Od vize k realitě`, en: `From Vision to Reality` },
  now: { cs: `Nyní`, en: `Now` },
  terraNovaNetwork: { cs: `Sít Terra Nova`, en: `Terra Nova Network` },
  connectionWithZahradaGenesis: { cs: `Propojení se Zahradou Genesis`, en: `Connection with Zahrada Genesis` },
  dimension: { cs: `Dimenze`, en: `Dimension` },
  bothProjectsShareSourceCodeTer: { cs: `Oba projekty sdílejí zdrojový kód: Terra Nova etika, ZION blockchain, off-grid technologie, komunitní governance.`, en: `Both projects share source code: Terra Nova ethics, ZION blockchain, off-grid technology, community governance.` },
  blockchainIntegration: { cs: `Blockchain integrace`, en: `Blockchain Integration` },
  active: { cs: `Aktivní`, en: `Active` },
  planned: { cs: `Plánováno`, en: `Planned` },
  openQuestionsLookingForGuardia: { cs: `Otevřené otázky — hledáme Guardians`, en: `Open Questions — looking for Guardians` },
  specificLocationOnLaPalmaNorth: { cs: `Konkrétní lokace na La Palmě (sever / jih / nadmořská výška?)`, en: `Specific location on La Palma (north / south / altitude?)` },
  foundingGuardiansWhoIsTheCoreT: { cs: `Zakládající Guardians — kdo je core team?`, en: `Founding Guardians — who is the core team?` },
  legalFormSpanishAsociaciNSlCom: { cs: `Právní forma (španělská asociación / SL / komunitní nadace?)`, en: `Legal form (Spanish asociación / SL / community foundation?)` },
  phase01FinancingZionFundCrowdf: { cs: `Financování fáze 0–1 (ZION fond? crowdfunding? vlastní zdroje?)`, en: `Phase 0–1 financing (ZION fund? crowdfunding? own resources?)` },
  seedLibraryCoordinationWithZah: { cs: `Koordinace seed library se Zahradou Genesis`, en: `Seed library coordination with Zahrada Genesis` },
  areYouAGuardianWhoHearsLaPalma: { cs: `Jsi Guardian, který slyší volání La Palmy? Napiš nám.`, en: `Are you a Guardian who hears La Palma\'s call? Reach out.` },
  joinDiscord: { cs: `Připojit se na Discord`, en: `Join Discord` },
  zahradaGenesis: { cs: `Zahrada Genesis`, en: `Zahrada Genesis` },
};

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
    rgb: '252, 209, 22',
  },
  {
    icon: Droplets,
    titleCs: 'Off-grid voda & Energie',
    titleEn: 'Off-grid Water & Energy',
    descCs: 'Solar + mikrohydro ze srážek. La Palma má vydatné deště a výškový profil ideální pro průtočné turbíny.',
    descEn: 'Solar + micro-hydro from rainfall. La Palma has generous rain and elevation ideal for run-of-river turbines.',
    status: 'planned' as const,
    color: '#066928',
    rgb: '6,105,40',
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
  active: { cs: 'Aktivní', en: 'Active', color: '#10B981', bg: 'rgba(6, 105, 40,0.1)', border: 'rgba(6, 105, 40,0.25)' },
  planned: { cs: 'Plánováno', en: 'Planned', color: '#60A5FA', bg: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.25)' },
  place: { cs: 'Místo', en: 'Place', color: '#F97316', bg: 'rgba(252, 209, 22,0.1)', border: 'rgba(252, 209, 22,0.25)' },
};

export default function DharmaTemplePage() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  return (
    <div className="zion-page">
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
            className="inline-flex items-center gap-2 text-sm text-zion-gold/65 hover:text-zion-gold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {TerranovaDharmaTempleCopy.backToTerraNova[cs ? 'cs' : 'en']}
          </Link>
        </motion.div>

        {/* ═══ HERO ═══ */}
        <motion.header
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="mb-20 relative"
        >
          <div className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
            <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-8">
              {/* Icon column */}
              <div className="shrink-0">
                <div className="relative flex h-28 w-28 items-center justify-center zion-rainbow-sub" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                  <Orbit className="relative z-10 h-10 w-10 text-zion-gold" />
                  <Mountain className="absolute bottom-5 right-5 h-4 w-4 text-zion-cyan" />
                </div>
              </div>

              {/* Text column */}
              <div className="space-y-3 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="zion-badge">
                    L5 · Terra Nova Pioneer
                  </span>
                  <span className="zion-badge-gold">
                    🔵 {TerranovaDharmaTempleCopy.planning[cs ? 'cs' : 'en']}
                  </span>
                </div>

                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gradient">
                  Dharma Temple
                </h1>
                <p className="text-lg text-zion-cyan font-medium">Sanctuary · Terra Nova ®</p>

                <div className="flex items-center gap-1.5 text-white/70">
                  <MapPin className="w-4 h-4 text-zion-gold shrink-0" />
                  <span className="text-sm">La Palma · Kanárské ostrovy · Španělsko</span>
                </div>

                <blockquote className="mt-4 pl-4 border-l-2 border-white/10 text-sm text-white/70 italic leading-relaxed max-w-lg">
                  {TerranovaDharmaTempleCopy.dharmaIsNotAPathAwayFromTheWor[cs ? 'cs' : 'en']}
                </blockquote>

                <div className="grid gap-3 pt-3 sm:grid-cols-3">
                  {SIGNALS.map((signal) => {
                    const Icon = signal.icon;
                    return (
                      <div key={signal.labelCs} className="zion-rainbow-sub px-3 py-3" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
                        <div className="flex items-center gap-2 text-zion-gold">
                          <Icon className="h-4 w-4" />
                          <span className="text-sm font-semibold">{signal.value}</span>
                        </div>
                        <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-zion-gold/65">
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
          <div className="zion-rainbow-card p-6 md:p-8" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
            <div className="relative z-10 grid md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-3">
                <h3 className="text-lg font-bold text-zion-gold">
                  {TerranovaDharmaTempleCopy.laPalmaLaIslaBonita[cs ? 'cs' : 'en']}
                </h3>
                <p className="text-white/70 text-sm leading-relaxed">
                  {TerranovaDharmaTempleCopy.laPalmaIsCalledTheBeautifulIsl[cs ? 'cs' : 'en']}
                </p>
                <p className="text-zion-gold/65 text-sm leading-relaxed">
                  {TerranovaDharmaTempleCopy.theVolcanicSoilRetainsHeatHold[cs ? 'cs' : 'en']}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 content-start">
                {[
                  { label: 'UNESCO', val: TerranovaDharmaTempleCopy.biosphere[cs ? 'cs' : 'en'] },
                  { label: TerranovaDharmaTempleCopy.rainfall[cs ? 'cs' : 'en'], val: '700–1500mm' },
                  { label: TerranovaDharmaTempleCopy.soil[cs ? 'cs' : 'en'], val: TerranovaDharmaTempleCopy.volcanic[cs ? 'cs' : 'en'] },
                  { label: TerranovaDharmaTempleCopy.observatory[cs ? 'cs' : 'en'], val: 'ORM' },
                ].map((s) => (
                  <div key={s.label} className="text-center p-3 zion-rainbow-sub" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                    <p className="text-white/85 font-bold text-sm">{s.val}</p>
                    <p className="text-zion-gold/55 text-[10px]">{s.label}</p>
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
            <p className="text-[10px] uppercase tracking-[0.45em] text-zion-gold/65 mb-2">
              {TerranovaDharmaTempleCopy.projectConcept[cs ? 'cs' : 'en']}
            </p>
            <h2 className="text-2xl font-bold text-white">
              {TerranovaDharmaTempleCopy.activitiesVision[cs ? 'cs' : 'en']}
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
                  style={{ '--rc': '6, 105, 40' } as React.CSSProperties}
                >
                  <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-[50px] bg-white/5 group-hover:bg-white/10 transition-opacity duration-500" />

                  <div className="flex items-start justify-between relative z-10 gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center zion-rainbow-sub" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
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
                  <p className="text-white/70 text-sm leading-relaxed relative z-10">
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
            <p className="text-[10px] uppercase tracking-[0.45em] text-zion-gold/65 mb-2">
              {TerranovaDharmaTempleCopy.developmentPhases[cs ? 'cs' : 'en']}
            </p>
            <h2 className="text-2xl font-bold text-white">
              {TerranovaDharmaTempleCopy.fromVisionToReality[cs ? 'cs' : 'en']}
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
                      borderColor: p.active ? 'rgb(252,209,22)' : 'rgba(255,255,255,0.15)',
                      backgroundColor: p.active ? 'rgba(252,209,22,0.2)' : 'rgba(0,0,0,0.5)',
                    }}
                  >
                    {p.active && <div className="w-1.5 h-1.5 rounded-full bg-zion-cyan animate-pulse" />}
                  </div>

                  <div
                    className="zion-rainbow-sub p-4 space-y-1"
                    style={{ '--rc': '6, 105, 40' } as React.CSSProperties}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="text-xs font-bold tracking-wider"
                        style={{ color: p.active ? 'rgb(6,105,40)' : 'rgba(255,255,255,0.3)' }}
                      >
                        {cs ? `Fáze ${p.num}` : `Phase ${p.num}`}
                      </span>
                      <span className="text-sm font-semibold text-white/80">
                        {cs ? p.cs : p.en}
                      </span>
                      {p.active && <span className="text-zion-cyan text-xs animate-pulse">⚡ {TerranovaDharmaTempleCopy.now[cs ? 'cs' : 'en']}</span>}
                    </div>
                    <p className="text-zion-gold/65 text-xs">{cs ? p.descCs : p.descEn}</p>
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
            <p className="text-[10px] uppercase tracking-[0.45em] text-zion-gold/65 mb-2">
              {TerranovaDharmaTempleCopy.terraNovaNetwork[cs ? 'cs' : 'en']}
            </p>
            <h2 className="text-2xl font-bold text-white">
              {TerranovaDharmaTempleCopy.connectionWithZahradaGenesis[cs ? 'cs' : 'en']}
            </h2>
          </div>

          <div className="zion-rainbow-card overflow-hidden" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
            {/* Header row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 text-center text-[10px] uppercase tracking-[0.3em] font-semibold border-b border-white/10">
              <div className="p-3 text-zion-gold/65">{TerranovaDharmaTempleCopy.dimension[cs ? 'cs' : 'en']}</div>
              <div className="p-3 text-white/85 sm:border-l border-white/10">🌿 Zahrada Genesis</div>
              <div className="p-3 text-zion-gold sm:border-l border-white/10">🕌 Dharma Temple</div>
            </div>
            {COMPARE.map((row, i) => (
              <div
                key={i}
                className="grid grid-cols-1 sm:grid-cols-3 text-sm border-b border-white/5 last:border-0"
              >
                <div className="p-3 text-zion-gold/65 text-xs">{cs ? row.dim.cs : row.dim.en}</div>
                <div className="p-3 text-white/85 text-xs sm:border-l border-white/5">{cs ? row.genesis.cs : row.genesis.en}</div>
                <div className="p-3 text-white/85 text-xs sm:border-l border-white/5">{cs ? row.dharma.cs : row.dharma.en}</div>
              </div>
            ))}
          </div>

          <p className="text-zion-gold/55 text-xs text-center mt-4">
            {TerranovaDharmaTempleCopy.bothProjectsShareSourceCodeTer[cs ? 'cs' : 'en']}
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
            <p className="text-[10px] uppercase tracking-[0.45em] text-zion-gold/65 mb-2">
              {TerranovaDharmaTempleCopy.blockchainIntegration[cs ? 'cs' : 'en']}
            </p>
            <h2 className="text-2xl font-bold text-white">ZION Network</h2>
          </div>

          <div className="zion-rainbow-card p-6 md:p-8" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
            <div className="relative z-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ZION_ITEMS.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 zion-rainbow-sub p-3" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}
                >
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center zion-rainbow-sub" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                    <item.icon className="h-4 w-4 text-zion-gold" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white/80">{item.label}</p>
                    <p className="text-[10px] text-zion-gold/55 capitalize">
                      {item.status === 'active'
                        ? (TerranovaDharmaTempleCopy.active[cs ? 'cs' : 'en'])
                        : item.status === 'planned'
                        ? (TerranovaDharmaTempleCopy.planned[cs ? 'cs' : 'en'])
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
          <div className="zion-rainbow-card p-6 md:p-8 space-y-4" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
            <h3 className="text-lg font-bold text-zion-gold">
              {TerranovaDharmaTempleCopy.openQuestionsLookingForGuardia[cs ? 'cs' : 'en']}
            </h3>
            <ul className="space-y-2">
              {[
                TerranovaDharmaTempleCopy.specificLocationOnLaPalmaNorth[cs ? 'cs' : 'en'],
                TerranovaDharmaTempleCopy.foundingGuardiansWhoIsTheCoreT[cs ? 'cs' : 'en'],
                TerranovaDharmaTempleCopy.legalFormSpanishAsociaciNSlCom[cs ? 'cs' : 'en'],
                TerranovaDharmaTempleCopy.phase01FinancingZionFundCrowdf[cs ? 'cs' : 'en'],
                TerranovaDharmaTempleCopy.seedLibraryCoordinationWithZah[cs ? 'cs' : 'en'],
              ].map((q, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                  <span className="text-zion-gold shrink-0 mt-0.5">◇</span>
                  {q}
                </li>
              ))}
            </ul>
            <p className="text-zion-gold/55 text-xs pt-2">
              {TerranovaDharmaTempleCopy.areYouAGuardianWhoHearsLaPalma[cs ? 'cs' : 'en']}
            </p>
            <a
              href="https://discord.gg/eatGYDbd"
              target="_blank"
              rel="noopener noreferrer"
              className="zion-button-secondary"
            >
              <Users className="w-4 h-4" />
              {TerranovaDharmaTempleCopy.joinDiscord[cs ? 'cs' : 'en']}
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
            className="zion-button-secondary"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{TerranovaDharmaTempleCopy.zahradaGenesis[cs ? 'cs' : 'en']}</span>
          </Link>
          <Link
            href="/terranova/te-piko-ora"
            className="zion-button-secondary"
          >
            <span>Te Pīko Ora</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>

      </div>
    </div>
  );
}
