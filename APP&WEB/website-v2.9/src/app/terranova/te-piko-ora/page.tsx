'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Circle,
  Compass,
  Dot,
  Globe,
  Heart,
  Landmark,
  LucideIcon,
  MapPin,
  Network,
  PlayCircle,
  Shield,
  Sparkles,
  Star,
  Sun,
  Users,
  Waves,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';

const DocMarkdownArticle = dynamic(() => import('@/components/docs/DocMarkdownArticle'), { ssr: false });

const TerranovaTePikoOraCopy = {
  home: { cs: `Domů`, en: `Home` },
  planned2027: { cs: `Plánováno 2027+`, en: `Planned 2027+` },
  livingCentrePolynesiaTerraNova: { cs: `Živý střed · Polynésie · Terra Nova ®`, en: `Living Centre · Polynesia · Terra Nova ®` },
  ioranaHereIsTheSandHereIsTheSe: { cs: `"Iorana. Zde je písek, zde je moře, zde je skála. Zde končí mapa. A zde začíná pravda."`, en: `"Iorana. Here is the sand, here is the sea, here is the rock. Here the map ends. And here truth begins."` },
  frenchPolynesiaCrownOfThePacif: { cs: `Francouzská Polynésie — Koruna Pacifiku`, en: `French Polynesia — Crown of the Pacific` },
  fiveArchipelagos118Islands4Mil: { cs: `Pět souostroví, 118 ostrovů, 4 miliony km² oceánu. Polynézští navigátoři překonali Pacifik v kánoe bez kompasu — čtením hvězd, vln, větru a letícího ptactva. Tento wayfinding je nejstarší distribuovaný konsensus v dějinách lidstva.`, en: `Five archipelagos, 118 islands, 4 million km² of ocean. Polynesian navigators crossed the Pacific in canoes without a compass — reading stars, waves, wind and flying birds. This wayfinding is the oldest distributed consensus in human history.` },
  raiateaIsTheSacredHeartOfPolyn: { cs: `Raiatea je posvátné srdce Polynésie — místo, odkud se říká, že vypluli první osadníci na Havaj, Nový Zéland a Velikonoční ostrov. Marae Taputapuātea je UNESCO světové dědictví. Laguna je jednou z největších ve Francouzské Polynésii.`, en: `Raiatea is the sacred heart of Polynesia — the place from which the first settlers are said to have sailed to Hawaii, New Zealand and Easter Island. Marae Taputapuātea is a UNESCO World Heritage Site. The lagoon is one of the largest in French Polynesia.` },
  islands: { cs: `Ostrovů`, en: `Islands` },
  ocean: { cs: `Oceán`, en: `Ocean` },
  culture: { cs: `Kultura`, en: `Culture` },
  polynesia: { cs: `Polynésie`, en: `Polynesia` },
  inspiration: { cs: `Inspirace`, en: `Inspiration` },
  polynesianModelZion: { cs: `Polynéský model & ZION`, en: `Polynesian Model & ZION` },
  principle: { cs: `Princip`, en: `Principle` },
  projectConcept: { cs: `Koncept projektu`, en: `Project Concept` },
  activitiesVision: { cs: `Aktivity & Vize`, en: `Activities & Vision` },
  rapaNuiLessonsWayfindingSchool: { cs: `Rapa Nui lekce — wayfinding škola`, en: `Rapa Nui Lessons — wayfinding school` },
  tePKoOraExplicitlyTeachesThese: { cs: `Te Pīko Ora explicitně učí tyto lekce jako součást kurikula.`, en: `Te Pīko Ora explicitly teaches these lessons as part of the curriculum.` },
  twoFacesOfOneWaveTePKoOraCrown: { cs: `Dvě tváře jedné vlny: Te Pīko Ora (koruna, hojnost) + Rapa Nui (kořen, varování). Obojí potřebujeme.`, en: `Two faces of one wave: Te Pīko Ora (crown, abundance) + Rapa Nui (root, warning). We need both.` },
  developmentPhases: { cs: `Fáze rozvoje`, en: `Development Phases` },
  fromVisionToReality: { cs: `Od vize k realitě`, en: `From Vision to Reality` },
  exploringNow: { cs: `Právě hledáme`, en: `Exploring now` },
  blockchainIntegration: { cs: `Blockchain integrace`, en: `Blockchain Integration` },
  active: { cs: `Aktivní`, en: `Active` },
  planned: { cs: `Plánováno`, en: `Planned` },
  openQuestionsLookingForGuardia: { cs: `Otevřené otázky — hledáme Guardians`, en: `Open Questions — looking for Guardians` },
  specificLocationRaiateaTahitiA: { cs: `Konkrétní lokace (Raiatea / Tahiti / jiný ostrov?)`, en: `Specific location (Raiatea / Tahiti / another island?)` },
  polynesianPartnersLocalCommuni: { cs: `Polynézští partneři — místní komunity, marae správci, navigátoři`, en: `Polynesian partners — local communities, marae stewards, navigators` },
  foundingGuardiansWithKnowledge: { cs: `Zakládající Guardians se znalostí oceánské kultury a zemědělství`, en: `Founding Guardians with knowledge of ocean culture and farming` },
  legalFormInFrenchPolynesiaAsso: { cs: `Právní forma ve Francouzské Polynésii (asociace / SAS / komunitní nadace?)`, en: `Legal form in French Polynesia (association / SAS / community foundation?)` },
  phase0FinancingZionFundHumanit: { cs: `Financování fáze 0 (ZION fond? Humanitární grant? Vlastní zdroje?)`, en: `Phase 0 financing (ZION fund? Humanitarian grant? Own resources?)` },
  doYouHearTheCallOfThePacificAr: { cs: `Slyšíš volání Pacifiku? Jsi Guardian, který chce stavět na okraji světa?`, en: `Do you hear the call of the Pacific? Are you a Guardian who wants to build at the edge of the world?` },
  joinDiscord: { cs: `Připojit se na Discord`, en: `Join Discord` },
  backToTerraNova: { cs: `Zpět na Terra Nova`, en: `Back to Terra Nova` },
  terraNovaNetwork: { cs: `Síť Terra Nova`, en: `Terra Nova Network` },
  connectionWithSisterProjects: { cs: `Propojení se sesterskými projekty`, en: `Connection with sister projects` },
  dimension: { cs: `Dimenze`, en: `Dimension` },
  bothProjectsShareSourceCodeTer: { cs: `Oba projekty sdílejí zdrojový kód: Terra Nova etika, ZION blockchain, off-grid technologie, komunitní governance a seed library.`, en: `Both projects share source code: Terra Nova ethics, ZION blockchain, off-grid technology, community governance and seed library.` },
  sitePlan: { cs: `Architektonický koncept`, en: `Architectural concept` },
  sitePlanSubtitle: { cs: `První konceptový board: půdorysy, řezy a energetický systém.`, en: `First concept board: floor plans, sections and energy system.` },
  documentation: { cs: `Dokumentace`, en: `Documentation` },
  documentationSubtitle: { cs: `Kompletní plán, koncept a specifikace Te Pīko Ora.`, en: `Complete plan, concept and specification of Te Pīko Ora.` },
  documentationLoading: { cs: `Načítání dokumentace…`, en: `Loading documentation…` },
  documentationError: { cs: `Dokumentaci se nepodařilo načíst.`, en: `Failed to load documentation.` },
  terraNova: { cs: `Terra Nova`, en: `Terra Nova` },
};

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
    color: '#066928',
    rgb: '6,105,40',
  },
  {
    icon: Globe,
    titleCs: 'Kulturní obnova',
    titleEn: 'Cultural Revival',
    descCs: 'Jazyk Reo Māohi, tatau jako živý ledger, va\'a (kánoe) governance. Polynéská moudrost a ZION blockchain — dva způsoby záznamu paměti.',
    descEn: 'Reo Māohi language, tatau as living ledger, va\'a (canoe) governance. Polynesian wisdom and ZION blockchain — two ways of recording memory.',
    status: 'planned' as const,
    color: '#F59E0B',
    rgb: '252, 209, 22',
  },
  {
    icon: Sun,
    titleCs: 'Solar & off-grid',
    titleEn: 'Solar & off-grid',
    descCs: 'Energetická soběstačnost — solární, větrná a přílivová energie. ZION node běžící lokálně, data neopouštějí komunitu.',
    descEn: 'Energy self-sufficiency — solar, wind and tidal energy. ZION node running locally, data stays in the community.',
    status: 'planned' as const,
    color: '#FBBF24',
    rgb: '252, 209, 22',
  },
  {
    icon: Heart,
    titleCs: 'Humanitární fond',
    titleEn: 'Humanitarian Fund',
    descCs: 'Komunitní fond napájený z ZION tithe — 5 % každého vytěženého bloku míří automaticky ke komunitám v nouzi.',
    descEn: 'Community fund powered by ZION tithe — 5% of every mined block flows automatically to communities in need.',
    status: 'planned' as const,
    color: '#EC4899',
    rgb: '228, 30, 43',
  },
  {
    icon: Shield,
    titleCs: 'Ochrana dědictví',
    titleEn: 'Heritage Protection',
    descCs: 'Záznamy na ZION blockchainu — immutable ledger pro kulturní dědictví, pozemková práva a komunitní rozhodnutí.',
    descEn: 'Records on ZION blockchain — immutable ledger for cultural heritage, land rights and community decisions.',
    status: 'vision' as const,
    color: '#8B5CF6',
    rgb: '228, 30, 43',
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

const COMPARE = [
  { dim: { cs: 'Energie místa', en: 'Place Energy' }, genesis: { cs: 'Atlantický vítr & oceán', en: 'Atlantic wind & ocean' }, tepiko: { cs: 'Větrné vlny & laguny', en: 'Wind waves & lagoons' } },
  { dim: { cs: 'Primární role', en: 'Primary Role' }, genesis: { cs: 'Base Camp', en: 'Base Camp' }, tepiko: { cs: 'Wayfinding School', en: 'Wayfinding School' } },
  { dim: { cs: 'Klíčová aktivita', en: 'Key Activity' }, genesis: { cs: 'Farma, surf, community', en: 'Farm, surf, community' }, tepiko: { cs: 'Navigace, marine permakultura', en: 'Navigation, marine permaculture' } },
  { dim: { cs: 'Architektonický symbol', en: 'Architectural symbol' }, genesis: { cs: '3 pyramidy — Memory / Consciousness / Future', en: '3 pyramids — Memory / Consciousness / Future' }, tepiko: { cs: 'Va\'a kánoe + marae', en: 'Va\'a canoe + marae' } },
];

export default function TePikoOraPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  const [doc, setDoc] = useState<string | null>(null);
  const [docError, setDocError] = useState(false);

  useEffect(() => {
    const file = cs ? '/docs/terranova/te-piko-ora.cs.md' : '/docs/terranova/te-piko-ora.en.md';
    fetch(file)
      .then((res) => {
        if (!res.ok) throw new Error('not found');
        return res.text();
      })
      .then((text) => setDoc(text))
      .catch(() => setDocError(true));
  }, [cs]);

  return (
    <div className="zion-page text-white">
      <div className="relative z-10 mx-auto max-w-5xl px-4 md:px-8">

        {/* Back nav */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-10"
        >
          <Link
            href="/terranova"
            className="inline-flex items-center gap-2 text-sm text-zion-gold/65 hover:text-zion-cyan transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {TerranovaTePikoOraCopy.backToTerraNova[cs ? 'cs' : 'en']}
          </Link>
        </motion.div>

        {/* ═══ HERO ═══ */}
        <motion.header
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <div className="zion-rainbow-card overflow-hidden" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
            <div className="relative h-48 md:h-64 overflow-hidden">
              <img
                src="/images/te-piko-ora/hero.png"
                alt="Te Pīko Ora"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
            </div>
            <div className="relative z-10 p-6 md:p-10">
              <div className="flex flex-col md:flex-row gap-8 items-start">
                {/* Ocean symbol */}
                <div className="shrink-0 w-20 h-20 flex items-center justify-center zion-rainbow-sub" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                  <Compass className="h-10 w-10 text-zion-gold" />
                </div>

                {/* Text column */}
                <div className="space-y-3 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="zion-badge">
                    L5 · Terra Nova Pioneer
                  </span>
                  <span className="zion-badge-gold inline-flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {TerranovaTePikoOraCopy.planned2027[cs ? 'cs' : 'en']}
                  </span>
                </div>

                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gradient">
                  Te Pīko Ora
                </h1>
                <p className="text-lg text-zion-cyan font-medium">
                  {TerranovaTePikoOraCopy.livingCentrePolynesiaTerraNova[cs ? 'cs' : 'en']}
                </p>

                <div className="flex items-center gap-1.5 text-white/70">
                  <MapPin className="w-4 h-4 text-white/85 shrink-0" />
                  <span className="text-sm">Raiatea · Francouzská Polynésie</span>
                </div>

                <blockquote className="mt-4 pl-4 border-l-2 border-white/10 text-sm text-white/70 italic leading-relaxed max-w-lg">
                  {TerranovaTePikoOraCopy.ioranaHereIsTheSandHereIsTheSe[cs ? 'cs' : 'en']}
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
          </div>
        </motion.header>

        {/* ═══ POLYNÉSIE INFO ═══ */}
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
                  {TerranovaTePikoOraCopy.frenchPolynesiaCrownOfThePacif[cs ? 'cs' : 'en']}
                </h3>
                <p className="text-white/70 text-sm leading-relaxed">
                  {TerranovaTePikoOraCopy.fiveArchipelagos118Islands4Mil[cs ? 'cs' : 'en']}
                </p>
                <p className="text-zion-gold/65 text-sm leading-relaxed">
                  {TerranovaTePikoOraCopy.raiateaIsTheSacredHeartOfPolyn[cs ? 'cs' : 'en']}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 content-start">
                {[
                  { label: 'UNESCO', val: 'Marae Taputapuātea' },
                  { label: TerranovaTePikoOraCopy.islands[cs ? 'cs' : 'en'], val: '118' },
                  { label: TerranovaTePikoOraCopy.ocean[cs ? 'cs' : 'en'], val: '4M km²' },
                  { label: TerranovaTePikoOraCopy.culture[cs ? 'cs' : 'en'], val: TerranovaTePikoOraCopy.polynesia[cs ? 'cs' : 'en'] },
                ].map((s) => (
                  <div key={s.label} className="text-center p-3 zion-rainbow-sub" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                    <p className="text-white/85 font-bold text-xs">{s.val}</p>
                    <p className="text-zion-gold/55 text-[10px]">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        {/* ═══ ARCHITECTURAL CONCEPT ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.6 }}
          className="mb-16"
        >
          <div className="zion-rainbow-card p-4 md:p-5" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
            <div className="relative z-10 mb-4 text-center">
              <p className="text-[10px] uppercase tracking-[0.45em] text-zion-gold/65 mb-1">
                {TerranovaTePikoOraCopy.sitePlan[cs ? 'cs' : 'en']}
              </p>
              <h2 className="text-xl font-bold text-white">
                {TerranovaTePikoOraCopy.sitePlanSubtitle[cs ? 'cs' : 'en']}
              </h2>
            </div>
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30">
              <img
                src="/images/te-piko-ora/concept-og.png"
                alt={cs ? 'Návrh Te Pīko Ora' : 'Te Pīko Ora concept'}
                className="w-full object-contain"
              />
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
            <p className="text-[10px] uppercase tracking-[0.45em] text-zion-gold/65 mb-2">
              {TerranovaTePikoOraCopy.inspiration[cs ? 'cs' : 'en']}
            </p>
            <h2 className="text-2xl font-bold text-white">
              {TerranovaTePikoOraCopy.polynesianModelZion[cs ? 'cs' : 'en']}
            </h2>
          </div>

          <div className="zion-rainbow-card overflow-hidden" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
            <div className="grid grid-cols-1 sm:grid-cols-3 text-center text-[10px] uppercase tracking-[0.3em] font-semibold border-b border-white/10">
              <div className="p-3 text-zion-gold/65">{TerranovaTePikoOraCopy.polynesia[cs ? 'cs' : 'en']}</div>
              <div className="p-3 text-white/85 sm:border-l border-white/10">{TerranovaTePikoOraCopy.principle[cs ? 'cs' : 'en']}</div>
              <div className="p-3 text-white/85 sm:border-l border-white/10">ZION</div>
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
                <div className="p-3 text-white/85 text-xs">{cs ? row.poly.cs : row.poly.en}</div>
                <div className="p-3 text-white/70 text-xs sm:border-l border-white/5">{cs ? row.principle.cs : row.principle.en}</div>
                <div className="p-3 text-white/85 text-xs sm:border-l border-white/5">{cs ? row.zion.cs : row.zion.en}</div>
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
            <p className="text-[10px] uppercase tracking-[0.45em] text-zion-gold/65 mb-2">
              {TerranovaTePikoOraCopy.projectConcept[cs ? 'cs' : 'en']}
            </p>
            <h2 className="text-2xl font-bold text-white">
              {TerranovaTePikoOraCopy.activitiesVision[cs ? 'cs' : 'en']}
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
                  <div
                    className="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-[50px] opacity-20 group-hover:opacity-35 transition-opacity duration-500 bg-zion-gold"
                    
                  />
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

        {/* ═══ RAPA NUI LEKCE ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.6 }}
          className="mb-16"
        >
          <div className="zion-rainbow-card p-6 md:p-8" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
            <div className="relative z-10 space-y-4">
              <div className="flex items-center gap-3">
                <Landmark className="h-8 w-8 text-zion-gold" />
                <div>
                  <h3 className="text-lg font-bold text-zion-gold">
                    {TerranovaTePikoOraCopy.rapaNuiLessonsWayfindingSchool[cs ? 'cs' : 'en']}
                  </h3>
                  <p className="text-zion-gold/65 text-xs">
                    {TerranovaTePikoOraCopy.tePKoOraExplicitlyTeachesThese[cs ? 'cs' : 'en']}
                  </p>
                </div>
              </div>
              <ul className="space-y-2">
                {RAPA_NUI_LESSONS.map((lesson, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-white/85">
                    <span className="text-white/85 shrink-0 mt-0.5 font-bold">{i + 1}.</span>
                    {cs ? lesson.cs : lesson.en}
                  </li>
                ))}
              </ul>
              <p className="text-zion-gold/55 text-xs pt-2">
                {TerranovaTePikoOraCopy.twoFacesOfOneWaveTePKoOraCrown[cs ? 'cs' : 'en']}
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
            <p className="text-[10px] uppercase tracking-[0.45em] text-zion-gold/65 mb-2">
              {TerranovaTePikoOraCopy.developmentPhases[cs ? 'cs' : 'en']}
            </p>
            <h2 className="text-2xl font-bold text-white">
              {TerranovaTePikoOraCopy.fromVisionToReality[cs ? 'cs' : 'en']}
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
                    {p.active && <div className="w-1.5 h-1.5 rounded-full bg-zion-cyan animate-pulse" />}
                  </div>

                  <div
                    className="zion-rainbow-sub p-4 space-y-1"
                    style={{ '--rc': p.active ? '6, 105, 40' : '6, 105, 40' } as React.CSSProperties}
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
                      {p.active ? (
                        <span className="inline-flex items-center gap-1 text-zion-cyan text-xs animate-pulse">
                          <PlayCircle className="w-3.5 h-3.5" />
                          {TerranovaTePikoOraCopy.exploringNow[cs ? 'cs' : 'en']}
                        </span>
                      ) : (
                        <Circle className="w-3.5 h-3.5 text-white/30" />
                      )}
                    </div>
                    <p className="text-zion-gold/65 text-xs">{cs ? p.descCs : p.descEn}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ═══ TERRA NOVA NETWORK ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.38, duration: 0.6 }}
          className="mb-16"
        >
          <div className="text-center mb-8">
            <p className="text-[10px] uppercase tracking-[0.45em] text-zion-gold/65 mb-2">
              {TerranovaTePikoOraCopy.terraNovaNetwork[cs ? 'cs' : 'en']}
            </p>
            <h2 className="text-2xl font-bold text-white">
              {TerranovaTePikoOraCopy.connectionWithSisterProjects[cs ? 'cs' : 'en']}
            </h2>
          </div>

          <div className="zion-rainbow-card overflow-hidden" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
            {/* Header row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 text-center text-[10px] uppercase tracking-[0.3em] font-semibold border-b border-white/10">
              <div className="p-3 text-zion-gold/65">{TerranovaTePikoOraCopy.dimension[cs ? 'cs' : 'en']}</div>
              <div className="p-3 text-white/85 sm:border-l border-white/10"><span className="inline-flex items-center gap-1"><Network className="w-3 h-3" /> Zahrada Genesis</span></div>
              <div className="p-3 text-zion-gold sm:border-l border-white/10"><span className="inline-flex items-center gap-1"><Network className="w-3 h-3" /> Te Pīko Ora</span></div>
            </div>
            {COMPARE.map((row, i) => (
              <div
                key={i}
                className="grid grid-cols-1 sm:grid-cols-3 text-sm border-b border-white/5 last:border-0"
              >
                <div className="p-3 text-zion-gold/65 text-xs">{cs ? row.dim.cs : row.dim.en}</div>
                <div className="p-3 text-white/85 text-xs sm:border-l border-white/5">{cs ? row.genesis.cs : row.genesis.en}</div>
                <div className="p-3 text-white/85 text-xs sm:border-l border-white/5">{cs ? row.tepiko.cs : row.tepiko.en}</div>
              </div>
            ))}
          </div>

          <p className="text-zion-gold/55 text-xs text-center mt-4">
            {TerranovaTePikoOraCopy.bothProjectsShareSourceCodeTer[cs ? 'cs' : 'en']}
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
              {TerranovaTePikoOraCopy.blockchainIntegration[cs ? 'cs' : 'en']}
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
                        ? TerranovaTePikoOraCopy.active[cs ? 'cs' : 'en']
                        : item.status === 'planned'
                        ? TerranovaTePikoOraCopy.planned[cs ? 'cs' : 'en']
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
              {TerranovaTePikoOraCopy.openQuestionsLookingForGuardia[cs ? 'cs' : 'en']}
            </h3>
            <ul className="space-y-2">
              {[
                TerranovaTePikoOraCopy.specificLocationRaiateaTahitiA[cs ? 'cs' : 'en'],
                TerranovaTePikoOraCopy.polynesianPartnersLocalCommuni[cs ? 'cs' : 'en'],
                TerranovaTePikoOraCopy.foundingGuardiansWithKnowledge[cs ? 'cs' : 'en'],
                TerranovaTePikoOraCopy.legalFormInFrenchPolynesiaAsso[cs ? 'cs' : 'en'],
                TerranovaTePikoOraCopy.phase0FinancingZionFundHumanit[cs ? 'cs' : 'en'],
              ].map((q, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                  <Dot className="w-4 h-4 text-zion-gold shrink-0 mt-0.5" />
                  {q}
                </li>
              ))}
            </ul>
            <p className="text-zion-gold/55 text-xs pt-2">
              {TerranovaTePikoOraCopy.doYouHearTheCallOfThePacificAr[cs ? 'cs' : 'en']}
            </p>
            <a
              href="https://discord.gg/eatGYDbd"
              target="_blank"
              rel="noopener noreferrer"
              className="zion-button-secondary"
            >
              <Users className="w-4 h-4" />
              {TerranovaTePikoOraCopy.joinDiscord[cs ? 'cs' : 'en']}
            </a>
          </div>
        </motion.section>

        {/* ═══ DOCUMENTATION ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.42, duration: 0.6 }}
          className="mb-16"
        >
          <div className="zion-rainbow-card p-4 md:p-5" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
            <div className="relative z-10 mb-4 text-center">
              <p className="text-[10px] uppercase tracking-[0.45em] text-zion-gold/65 mb-1">
                {TerranovaTePikoOraCopy.documentation[cs ? 'cs' : 'en']}
              </p>
              <h2 className="text-xl font-bold text-white">
                {TerranovaTePikoOraCopy.documentationSubtitle[cs ? 'cs' : 'en']}
              </h2>
            </div>
            <div className="relative z-10 rounded-2xl border border-white/10 bg-black/40 p-4 md:p-6">
              {docError ? (
                <p className="text-sm text-zion-red">{TerranovaTePikoOraCopy.documentationError[cs ? 'cs' : 'en']}</p>
              ) : doc ? (
                <DocMarkdownArticle content={doc} className="zion-docs-prose max-w-4xl mx-auto" />
              ) : (
                <p className="text-sm text-white/60">{TerranovaTePikoOraCopy.documentationLoading[cs ? 'cs' : 'en']}</p>
              )}
            </div>
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
            className="zion-button-secondary"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Dharma Temple</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-white/85 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{TerranovaTePikoOraCopy.home[cs ? 'cs' : 'en']}</span>
            </Link>
            <span className="text-zion-gold/45">|</span>
            <Link
              href="/terranova"
              className="inline-flex items-center gap-2 text-sm text-white/85 hover:text-white transition-colors"
            >
              <span>{TerranovaTePikoOraCopy.terraNova[cs ? 'cs' : 'en']}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
