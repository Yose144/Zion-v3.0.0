'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Droplets,
  Flower,
  Heart,
  Landmark,
  Leaf,
  LucideIcon,
  MapPin,
  Network,
  Shield,
  Sparkles,
  Sun,
  TreePine,
  Users,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';

const DocMarkdownArticle = dynamic(() => import('@/components/docs/DocMarkdownArticle'), { ssr: false });

const TerranovaBodhiLankaCopy = {
  home: { cs: `Domů`, en: `Home` },
  planned2027: { cs: `Plánováno 2027+`, en: `Planned 2027+` },
  akasaSriLankaTerraNova: { cs: `Akáša · Srí Lanka · Terra Nova ®`, en: `Akasha · Sri Lanka · Terra Nova ®` },
  loveIsTheElementFireCannotBurn: { cs: `"Láska je element, který oheň nemůže spálit. Most nespojil ostrovy — spojil srdce."`, en: `"Love is the element fire cannot burn. The bridge did not connect islands — it connected hearts."` },
  sriLankaPearlOfTheIndianOcean: { cs: `Srí Lanka — Perla Indického oceánu`, en: `Sri Lanka — Pearl of the Indian Ocean` },
  sriLankaIsATropicalParadiseWhe: { cs: `Srí Lanka je tropický ráj, kde se potkává buddhismus, hinduismus a tisíciletá moudrost. Anuradhapura je posvátné město — místo, kde rostl výhonek Bodhi stromu pod kterým Buddha dosáhl osvícení, zasazený v roce 288 př. n. l. Sri Maha Bodhi je nejstarší žijící strom na Zemi s known planting date.`, en: `Sri Lanka is a tropical paradise where Buddhism, Hinduism and millennia of wisdom meet. Anuradhapura is the sacred city — the place where a sapling of the Bodhi tree under which the Buddha attained enlightenment was planted in 288 BC. Sri Maha Bodhi is the oldest living tree on Earth with a known planting date.` },
  ramaSetuIsTheBridgeThatConnect: { cs: `Rama Setu (Adamův most) spojuje Indii a Srí Ladku — most, který postavil Rama se svou armádou opic, aby zachránil Sítu. Bhakti — nekonečná láska a oddanost — je element, který prostupuje vše. Akáša je pátý element: prostor, který drží všechny ostatní.`, en: `Rama Setu (Adam's Bridge) connects India and Sri Lanka — a bridge that Rama built with his army of monkeys to rescue Sita. Bhakti — infinite love and devotion — is the element that permeates everything. Akasha is the fifth element: the space that holds all the others.` },
  axis: { cs: `Osa`, en: `Axis` },
  layer: { cs: `Vrstva`, en: `Layer` },
  region: { cs: `Region`, en: `Region` },
  sriLanka: { cs: `Srí Lanka`, en: `Sri Lanka` },
  inspiration: { cs: `Inspirace`, en: `Inspiration` },
  symbolismZion: { cs: `Symbolismus & ZION`, en: `Symbolism & ZION` },
  principle: { cs: `Princip`, en: `Principle` },
  projectConcept: { cs: `Koncept projektu`, en: `Project Concept` },
  activitiesVision: { cs: `Aktivity & Vize`, en: `Activities & Vision` },
  developmentPhases: { cs: `Fáze rozvoje`, en: `Development Phases` },
  fromVisionToReality: { cs: `Od vize k realitě`, en: `From Vision to Reality` },
  exploringNow: { cs: `Právě hledáme`, en: `Exploring now` },
  blockchainIntegration: { cs: `Blockchain integrace`, en: `Blockchain Integration` },
  active: { cs: `Aktivní`, en: `Active` },
  planned: { cs: `Plánováno`, en: `Planned` },
  openQuestionsLookingForGuardia: { cs: `Otevřené otázky — hledáme Guardians`, en: `Open Questions — looking for Guardians` },
  exactGpsCoordinatesAndLandArea: { cs: `Přesné GPS souřadnice a výměra pozemku (v jednání — Anuradhapura / Kandy / Cultural Triangle?)`, en: `Exact GPS coordinates and land area (in negotiation — Anuradhapura / Kandy / Cultural Triangle?)` },
  legalFormInSriLankaNgoTrustCom: { cs: `Právní forma na Srí Lance (NGO / trust / komunitní nadace vs hybrid)`, en: `Legal form in Sri Lanka (NGO / trust / community foundation vs hybrid)` },
  zionNodeCoordinatorRecruitingA: { cs: `Koordinátor ZION node — nábor Tech Guardiana s vazbou na srílanskou developer komunitu`, en: `ZION node coordinator — recruiting a Tech Guardian with ties to the Sri Lankan developer community` },
  partnershipsWithSriLankanUniver: { cs: `Partnerství se srílanskými univerzitami a ayurvedskými institucemi pro governance výzkum`, en: `Partnerships with Sri Lankan universities and Ayurvedic institutions for governance research` },
  seedLibraryWhichSriLankanHerita: { cs: `Semenná knihovna: které srílanské odrůdy a partneři výměny (lokální šlechtitelé, ayurvedské zahrady)`, en: `Seed library: which Sri Lankan heritage varieties and exchange partners (local breeders, Ayurvedic gardens)` },
  bhaktiProtocolDesignHowDevotio: { cs: `Bhakti Protocol design — jak se oddanost (bhakti) překládá do governance struktury`, en: `Bhakti Protocol design — how devotion (bhakti) translates into governance structure` },
  doYouHearTheCallOfTheBodhiTree: { cs: `Slyšíš volání Bodhi stromu? Jsi Guardian, který chce stavět prostor lásky v srdci Indického oceánu?`, en: `Do you hear the call of the Bodhi tree? Are you a Guardian who wants to build a space of love in the heart of the Indian Ocean?` },
  joinDiscord: { cs: `Připojit se na Discord`, en: `Join Discord` },
  terraNova: { cs: `Terra Nova`, en: `Terra Nova` },
  sitePlan: { cs: `Architektonický koncept`, en: `Architectural concept` },
  sitePlanSubtitle: { cs: `První konceptový board: půdorysy, řezy a energetický systém.`, en: `First concept board: floor plans, sections and energy system.` },
  documentation: { cs: `Dokumentace`, en: `Documentation` },
  documentationSubtitle: { cs: `Kompletní plán, koncept a specifikace Bodhi Lanka.`, en: `Complete plan, concept and specification of Bodhi Lanka.` },
  documentationLoading: { cs: `Načítání dokumentace…`, en: `Loading documentation…` },
  documentationError: { cs: `Dokumentaci se nepodařilo načíst.`, en: `Failed to load documentation.` },
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
    icon: TreePine,
    titleCs: 'Bodhi strom',
    titleEn: 'Bodhi Tree',
    descCs: 'Živý strom zasazený při založení komunity — pokračování linie Sri Maha Bodhi. Strom osvícení jako osa místa, pod nímž se konají governance kruhy a meditace.',
    descEn: 'A living tree planted at the community founding — a continuation of the Sri Maha Bodhi lineage. The tree of enlightenment as the axis of the place, under which governance circles and meditation are held.',
    status: 'planned' as const,
    color: '#066928',
    rgb: '6, 105, 40',
  },
  {
    icon: Leaf,
    titleCs: 'Ayurvedská zahrada',
    titleEn: 'Ayurvedic Garden',
    descCs: 'Tradiční ayurvedské byliny, koření, kurkuma, neem, holy basil. Zahrada, která živí tělo i ducha. Spojení s Medical Table protokolem — holistické zdraví jako právo.',
    descEn: 'Traditional Ayurvedic herbs, spices, turmeric, neem, holy basil. A garden that feeds body and spirit. Connection with the Medical Table protocol — holistic health as a right.',
    status: 'planned' as const,
    color: '#10B981',
    rgb: '16, 185, 129',
  },
  {
    icon: Network,
    titleCs: 'ZION node',
    titleEn: 'ZION Node',
    descCs: 'Guardian Node — validace bloků, LoRa relay, Starlink + 4G failover. Split 90 % operátor / 10 % komunitní pokladna. Data neopouštějí komunitu.',
    descEn: 'Guardian Node — block validation, LoRa relay, Starlink + 4G failover. Split 90% operator / 10% community treasury. Data stays in the community.',
    status: 'planned' as const,
    color: '#22D3EE',
    rgb: '34, 211, 238',
  },
  {
    icon: Landmark,
    titleCs: 'Tři pavilony',
    titleEn: 'Three Pavilions',
    descCs: 'Bodhi (meditace), Ayurveda (léčivá zahrada), Bhakti (oddanost/governance). Originální současné struktury evokující triádu elementů a svatou geometrii — bez kopírování existujících symbolů.',
    descEn: 'Bodhi (meditation), Ayurveda (healing garden), Bhakti (devotion/governance). Original contemporary structures evoking a triad of elements and sacred geometry — without copying existing symbols.',
    status: 'planned' as const,
    color: '#8B5CF6',
    rgb: '139, 92, 246',
  },
  {
    icon: Droplets,
    titleCs: 'Lotusové jezero',
    titleEn: 'Lotus Pond',
    descCs: 'Vodní prvek s lotosy — odráží nebe (Akáša). Dešťová cisterna 30 m³, kořenová čistírna. Voda jako zrcadlo prostoru, který drží všechny elementy.',
    descEn: 'Water element with lotuses — reflecting the sky (Akasha). Rainwater cistern 30 m³, reed-bed filter. Water as a mirror of the space that holds all elements.',
    status: 'planned' as const,
    color: '#EC4899',
    rgb: '236, 72, 153',
  },
  {
    icon: Sun,
    titleCs: 'Solar & off-grid',
    titleEn: 'Solar & off-grid',
    descCs: 'Energetická soběstačnost — solar 8 kWp + 16 kWh LiFePO4, dešťová cisterna 30 m³, pramen, kořenová čistírna. Soběstačnost jako podmínka svobody rozhodování.',
    descEn: 'Energy self-sufficiency — solar 8 kWp + 16 kWh LiFePO4, rainwater cistern 30 m³, spring, reed-bed filter. Self-sufficiency as a condition of free decision-making.',
    status: 'planned' as const,
    color: '#F59E0B',
    rgb: '252, 209, 22',
  },
];

const SIGNALS: SignalItem[] = [
  { icon: MapPin, value: 'Anuradhapura', labelCs: 'Osa', labelEn: 'Axis' },
  { icon: Heart, value: 'Srí Lanka', labelCs: 'Region', labelEn: 'Region' },
  { icon: Sparkles, value: '2027–2030', labelCs: 'Fáze 1', labelEn: 'Phase 1' },
];

const PHASES = [
  {
    num: '0',
    cs: 'Zárodek',
    en: 'Seed',
    descCs: 'Core team 3–5 strážců, scouting Srí Lanka, právní rešerše (NGO vs trust vs komunitní nadace), rozpočet 60 000 EUR, zkušební záhony 0,2 ha, kontakt s ayurvedskými institucemi.',
    descEn: 'Core team 3–5 guardians, scouting Sri Lanka, legal research (NGO vs trust vs community foundation), budget 60 000 EUR, trial plots 0.2 ha, contact with Ayurvedic institutions.',
    active: true,
  },
  {
    num: '1',
    cs: 'Kořeny',
    en: 'Roots',
    descCs: 'Pozemek (koupě / dlouhodobý nájem), registrace, solar 8 kWp, cisterna, eko-chaty 4–6 jednotek, 1 ha, první hosté Q3 2027, ZION wallet + DAO rámec, výsadba Bodhi stromu.',
    descEn: 'Land (purchase / long-term lease), registration, solar 8 kWp, cistern, eco-cabins 4–6 units, 1 ha, first guests Q3 2027, ZION wallet + DAO framework, Bodhi tree planting.',
    active: false,
  },
  {
    num: '2',
    cs: 'Komunita',
    en: 'Community',
    descCs: 'Guardian node, stálé bydlení 3–5 chat, měsíční governance program, LoRa mesh, Ayurvedic pavilon, lotusové jezero, propojení s Genesis Garden a Dharma Temple.',
    descEn: 'Guardian node, permanent housing 3–5 cabins, monthly governance program, LoRa mesh, Ayurvedic pavilion, lotus pond, connection with Genesis Garden and Dharma Temple.',
    active: false,
  },
  {
    num: '3',
    cs: 'Síť',
    en: 'Network',
    descCs: '3 ha, semenná síť 3+ uzlů, vzdělávací centrum (Bhakti Governance škola), druhý uzel v Indii nebo jihovýchodní Asii.',
    descEn: '3 ha, seed network 3+ nodes, education center (Bhakti Governance school), second node in India or Southeast Asia.',
    active: false,
  },
  {
    num: '4',
    cs: 'Vyzařování',
    en: 'Radiance',
    descCs: 'Retreat centrum 40+ hostů, ZION platby jako výchozí, knowledge commons, 1 % přebytku → L6, první protokol Bhakti v praxi — láska jako governance princip.',
    descEn: 'Retreat center 40+ guests, ZION payments as default, knowledge commons, 1% surplus → L6, first Bhakti protocol in practice — love as a governance principle.',
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
  { label: 'Guardian Wallet', status: 'tbd', icon: Shield },
  { label: 'Medical Table / Ayurveda', status: 'planned', icon: Heart },
  { label: 'LoRa / Mesh', status: 'planned', icon: Sparkles },
  { label: 'Seed Library', status: 'planned', icon: Leaf },
  { label: 'Bhakti Protocol', status: 'vision', icon: Flower },
];

const SYMBOLISM = [
  {
    symbol: { cs: 'Rama + Sita', en: 'Rama + Sita' },
    principle: { cs: 'Láska jako smlouva, oddanost, která drží', en: 'Love as covenant, devotion that holds' },
    zion: { cs: 'ZION jako protokol lásky — pravidla platí, protože jsou milována', en: 'ZION as love protocol — rules hold because they are loved' },
  },
  {
    symbol: { cs: 'Sri Maha Bodhi (288 př. n. l.)', en: 'Sri Maha Bodhi (288 BC)' },
    principle: { cs: 'Živá moudrost, 2300+ let', en: 'Living wisdom, 2300+ years' },
    zion: { cs: 'Knowledge commons — otevřený přístup, živá tradice', en: 'Knowledge commons — open access, living tradition' },
  },
  {
    symbol: { cs: 'Rama Setu (most)', en: 'Rama Setu (bridge)' },
    principle: { cs: 'Most spojuje, nerozděluje', en: 'A bridge connects, does not divide' },
    zion: { cs: 'ZION je most mezi komunitami, ne zeď', en: 'ZION is a bridge between communities, not a wall' },
  },
  {
    symbol: { cs: 'Akáša (pátý element)', en: 'Akasha (fifth element)' },
    principle: { cs: 'Prostor, který drží všechny elementy', en: 'The space that holds all elements' },
    zion: { cs: 'ZION jako prostor, který drží všechny vrstvy (L1–L6)', en: 'ZION as the space that holds all layers (L1–L6)' },
  },
];

export default function BodhiLankaPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  const [doc, setDoc] = useState<string | null>(null);
  const [docError, setDocError] = useState(false);

  useEffect(() => {
    const file = cs ? '/docs/terranova/bodhi-lanka.cs.md' : '/docs/terranova/bodhi-lanka.en.md';
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
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8 flex items-center gap-4"
        >
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-white/85 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{TerranovaBodhiLankaCopy.home[cs ? 'cs' : 'en']}</span>
          </Link>
          <span className="text-zion-gold/45">|</span>
          <Link
            href="/terranova"
            className="inline-flex items-center gap-2 text-sm text-white/85 hover:text-white transition-colors"
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
          <div className="zion-rainbow-card overflow-hidden" style={{ '--rc': '139, 92, 246' } as React.CSSProperties}>
            <div className="relative h-48 md:h-64 overflow-hidden">
              <img
                src="/images/bodhi-lanka/hero.jpg"
                alt="Bodhi Lanka"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
            </div>
            <div className="relative z-10 p-6 md:p-10">
              <div className="flex flex-col md:flex-row gap-8 items-start">
                {/* Lotus symbol */}
                <div className="shrink-0 w-20 h-20 flex items-center justify-center text-4xl zion-rainbow-sub" style={{ '--rc': '139, 92, 246' } as React.CSSProperties}>
                  🪷
                </div>

                {/* Text column */}
                <div className="space-y-3 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="zion-badge">
                      L5 · Terra Nova Akasha Node
                    </span>
                    <span className="zion-badge-gold">
                      📋 {TerranovaBodhiLankaCopy.planned2027[cs ? 'cs' : 'en']}
                    </span>
                  </div>

                  <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gradient">
                    Bodhi Lanka
                  </h1>
                  <p className="text-lg text-zion-gold font-medium">
                    {TerranovaBodhiLankaCopy.akasaSriLankaTerraNova[cs ? 'cs' : 'en']}
                  </p>

                  <div className="flex items-center gap-1.5 text-white/70">
                    <MapPin className="w-4 h-4 text-white/85 shrink-0" />
                    <span className="text-sm">Srí Lanka · Indický oceán</span>
                  </div>

                  <blockquote className="mt-4 pl-4 border-l-2 border-white/10 text-sm text-white/70 italic leading-relaxed max-w-lg">
                    {TerranovaBodhiLankaCopy.loveIsTheElementFireCannotBurn[cs ? 'cs' : 'en']}
                  </blockquote>

                  <div className="grid gap-3 pt-3 sm:grid-cols-3">
                    {SIGNALS.map((signal) => {
                      const Icon = signal.icon;
                      return (
                        <div key={signal.labelCs} className="zion-rainbow-sub px-3 py-3" style={{ '--rc': '139, 92, 246' } as React.CSSProperties}>
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

        {/* ═══ SRÍ LANKA INFO ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.6 }}
          className="mb-16"
        >
          <div className="zion-rainbow-card p-6 md:p-8" style={{ '--rc': '139, 92, 246' } as React.CSSProperties}>
            <div className="relative z-10 grid md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-3">
                <h3 className="text-lg font-bold text-zion-gold">
                  {TerranovaBodhiLankaCopy.sriLankaPearlOfTheIndianOcean[cs ? 'cs' : 'en']}
                </h3>
                <p className="text-white/70 text-sm leading-relaxed">
                  {TerranovaBodhiLankaCopy.sriLankaIsATropicalParadiseWhe[cs ? 'cs' : 'en']}
                </p>
                <p className="text-zion-gold/65 text-sm leading-relaxed">
                  {TerranovaBodhiLankaCopy.ramaSetuIsTheBridgeThatConnect[cs ? 'cs' : 'en']}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 content-start">
                {[
                  { label: 'Sri Maha Bodhi', val: '288 BC' },
                  { label: TerranovaBodhiLankaCopy.axis[cs ? 'cs' : 'en'], val: 'Anuradhapura' },
                  { label: TerranovaBodhiLankaCopy.layer[cs ? 'cs' : 'en'], val: 'L5' },
                  { label: TerranovaBodhiLankaCopy.region[cs ? 'cs' : 'en'], val: TerranovaBodhiLankaCopy.sriLanka[cs ? 'cs' : 'en'] },
                ].map((s) => (
                  <div key={s.label} className="text-center p-3 zion-rainbow-sub" style={{ '--rc': '139, 92, 246' } as React.CSSProperties}>
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
          <div className="zion-rainbow-card p-4 md:p-5" style={{ '--rc': '139, 92, 246' } as React.CSSProperties}>
            <div className="relative z-10 mb-4 text-center">
              <p className="text-[10px] uppercase tracking-[0.45em] text-zion-gold/65 mb-1">
                {TerranovaBodhiLankaCopy.sitePlan[cs ? 'cs' : 'en']}
              </p>
              <h2 className="text-xl font-bold text-white">
                {TerranovaBodhiLankaCopy.sitePlanSubtitle[cs ? 'cs' : 'en']}
              </h2>
            </div>
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30">
              <img
                src="/images/bodhi-lanka/concept-og.jpg"
                alt={cs ? 'Návrh Bodhi Lanka' : 'Bodhi Lanka concept'}
                className="w-full object-contain"
              />
            </div>
          </div>
        </motion.section>

        {/* ═══ SYMBOLISM ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.6 }}
          className="mb-16"
        >
          <div className="text-center mb-8">
            <p className="text-[10px] uppercase tracking-[0.45em] text-zion-gold/65 mb-2">
              {TerranovaBodhiLankaCopy.inspiration[cs ? 'cs' : 'en']}
            </p>
            <h2 className="text-2xl font-bold text-white">
              {TerranovaBodhiLankaCopy.symbolismZion[cs ? 'cs' : 'en']}
            </h2>
          </div>

          <div className="zion-rainbow-card overflow-hidden" style={{ '--rc': '139, 92, 246' } as React.CSSProperties}>
            <div className="grid grid-cols-1 sm:grid-cols-3 text-center text-[10px] uppercase tracking-[0.3em] font-semibold border-b border-white/10">
              <div className="p-3 text-zion-gold/65">{TerranovaBodhiLankaCopy.sriLanka[cs ? 'cs' : 'en']}</div>
              <div className="p-3 text-white/85 sm:border-l border-white/10">{TerranovaBodhiLankaCopy.principle[cs ? 'cs' : 'en']}</div>
              <div className="p-3 text-white/85 sm:border-l border-white/10">ZION</div>
            </div>
            {SYMBOLISM.map((row, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-3 text-sm border-b border-white/5 last:border-0">
                <div className="p-3 text-white/85 text-xs">{cs ? row.symbol.cs : row.symbol.en}</div>
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
              {TerranovaBodhiLankaCopy.projectConcept[cs ? 'cs' : 'en']}
            </p>
            <h2 className="text-2xl font-bold text-white">
              {TerranovaBodhiLankaCopy.activitiesVision[cs ? 'cs' : 'en']}
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
                  style={{ '--rc': '139, 92, 246' } as React.CSSProperties}
                >
                  <div
                    className="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-[50px] opacity-20 group-hover:opacity-35 transition-opacity duration-500 bg-zion-gold"
                    
                  />
                  <div className="flex items-start justify-between relative z-10 gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center zion-rainbow-sub" style={{ '--rc': '139, 92, 246' } as React.CSSProperties}>
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
              {TerranovaBodhiLankaCopy.developmentPhases[cs ? 'cs' : 'en']}
            </p>
            <h2 className="text-2xl font-bold text-white">
              {TerranovaBodhiLankaCopy.fromVisionToReality[cs ? 'cs' : 'en']}
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
                    style={{ '--rc': p.active ? '139, 92, 246' : '139, 92, 246' } as React.CSSProperties}
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
                        <span className="text-zion-cyan text-xs animate-pulse">
                          ⚡ {TerranovaBodhiLankaCopy.exploringNow[cs ? 'cs' : 'en']}
                        </span>
                      )}
                    </div>
                    <p className="text-zion-gold/65 text-xs">{cs ? p.descCs : p.descEn}</p>
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
            <p className="text-[10px] uppercase tracking-[0.45em] text-zion-gold/65 mb-2">
              {TerranovaBodhiLankaCopy.blockchainIntegration[cs ? 'cs' : 'en']}
            </p>
            <h2 className="text-2xl font-bold text-white">ZION Network</h2>
          </div>

          <div className="zion-rainbow-card p-6 md:p-8" style={{ '--rc': '139, 92, 246' } as React.CSSProperties}>
            <div className="relative z-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ZION_ITEMS.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 zion-rainbow-sub p-3" style={{ '--rc': '139, 92, 246' } as React.CSSProperties}
                >
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center zion-rainbow-sub" style={{ '--rc': '139, 92, 246' } as React.CSSProperties}>
                    <item.icon className="h-4 w-4 text-zion-gold" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white/80">{item.label}</p>
                    <p className="text-[10px] text-zion-gold/55 capitalize">
                      {item.status === 'active'
                        ? TerranovaBodhiLankaCopy.active[cs ? 'cs' : 'en']
                        : item.status === 'planned'
                        ? TerranovaBodhiLankaCopy.planned[cs ? 'cs' : 'en']
                        : 'TBD'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
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
          <div className="zion-rainbow-card p-4 md:p-5" style={{ '--rc': '139, 92, 246' } as React.CSSProperties}>
            <div className="relative z-10 mb-4 text-center">
              <p className="text-[10px] uppercase tracking-[0.45em] text-zion-gold/65 mb-1">
                {TerranovaBodhiLankaCopy.documentation[cs ? 'cs' : 'en']}
              </p>
              <h2 className="text-xl font-bold text-white">
                {TerranovaBodhiLankaCopy.documentationSubtitle[cs ? 'cs' : 'en']}
              </h2>
            </div>
            <div className="relative z-10 rounded-2xl border border-white/10 bg-black/40 p-4 md:p-6">
              {docError ? (
                <p className="text-sm text-zion-red">{TerranovaBodhiLankaCopy.documentationError[cs ? 'cs' : 'en']}</p>
              ) : doc ? (
                <DocMarkdownArticle content={doc} className="zion-docs-prose max-w-4xl mx-auto" />
              ) : (
                <p className="text-sm text-white/60">{TerranovaBodhiLankaCopy.documentationLoading[cs ? 'cs' : 'en']}</p>
              )}
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
          <div className="zion-rainbow-card p-6 md:p-8 space-y-4" style={{ '--rc': '139, 92, 246' } as React.CSSProperties}>
            <h3 className="text-lg font-bold text-zion-gold">
              {TerranovaBodhiLankaCopy.openQuestionsLookingForGuardia[cs ? 'cs' : 'en']}
            </h3>
            <ul className="space-y-2">
              {[
                TerranovaBodhiLankaCopy.exactGpsCoordinatesAndLandArea[cs ? 'cs' : 'en'],
                TerranovaBodhiLankaCopy.legalFormInSriLankaNgoTrustCom[cs ? 'cs' : 'en'],
                TerranovaBodhiLankaCopy.zionNodeCoordinatorRecruitingA[cs ? 'cs' : 'en'],
                TerranovaBodhiLankaCopy.partnershipsWithSriLankanUniver[cs ? 'cs' : 'en'],
                TerranovaBodhiLankaCopy.seedLibraryWhichSriLankanHerita[cs ? 'cs' : 'en'],
                TerranovaBodhiLankaCopy.bhaktiProtocolDesignHowDevotio[cs ? 'cs' : 'en'],
              ].map((q, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                  <span className="text-zion-gold shrink-0 mt-0.5">◇</span>
                  {q}
                </li>
              ))}
            </ul>
            <p className="text-zion-gold/55 text-xs pt-2">
              {TerranovaBodhiLankaCopy.doYouHearTheCallOfTheBodhiTree[cs ? 'cs' : 'en']}
            </p>
            <a
              href="https://discord.gg/eatGYDbd"
              target="_blank"
              rel="noopener noreferrer"
              className="zion-button-secondary"
            >
              <Users className="w-4 h-4" />
              {TerranovaBodhiLankaCopy.joinDiscord[cs ? 'cs' : 'en']}
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
            href="/terranova/golden-republic-bohemia"
            className="zion-button-secondary"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Golden Republic Bohemia</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-white/85 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{TerranovaBodhiLankaCopy.home[cs ? 'cs' : 'en']}</span>
            </Link>
            <span className="text-zion-gold/45">|</span>
            <Link
              href="/terranova"
              className="inline-flex items-center gap-2 text-sm text-white/85 hover:text-white transition-colors"
            >
              <span>{TerranovaBodhiLankaCopy.terraNova[cs ? 'cs' : 'en']}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
