'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Crown,
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

const TerranovaGoldenRepublicBohemiaCopy = {
  home: { cs: `Domů`, en: `Home` },
  planned2027: { cs: `Plánováno 2027+`, en: `Planned 2027+` },
  livingCentreBohemiaTerraNova: { cs: `Živý střed · Čechy · Terra Nova ®`, en: `Living Centre · Bohemia · Terra Nova ®` },
  saltOnTheTableABridgeBetweenMy: { cs: `"Sůl na stole. Most mezi mýtem a protokolem. Kruh bez trůnu."`, en: `"Salt on the table. A bridge between myth and protocol. A circle without a throne."` },
  bohemiaHeartOfEurope: { cs: `Čechy — Srdce Evropy`, en: `Bohemia — Heart of Europe` },
  bohemiaIsTheLandWhereTheSaltOf: { cs: `Čechy jsou zemí, kde se narodila sůl země — kde král byl oráč, kde císař postavil most mezi nebem a zemí, a kde univerzita otevřela dveře všem národům. Říp (456 m) je osa: hora, kam Libuše poslala pro oráče Přemysla. Symbiotická hranice mezi mýtem a půdou.`, en: `Bohemia is the land where the salt of the earth was born — where the king was a ploughman, where an emperor built a bridge between heaven and earth, and where a university opened its doors to all nations. Říp (456 m) is the axis: the mountain where Libuše sent for the ploughman Přemysl. A symbiotic boundary between myth and soil.` },
  ripIsANationalCulturalMonument: { cs: `Říp je národní kulturní památka, veřejně přístupná. Labské údolí v pozadí — krajina, kde se potkává česká mytologie, řeky a pole.`, en: `Říp is a national cultural monument, publicly accessible. The Elbe valley in the background — a landscape where Czech mythology, rivers and fields meet.` },
  axis: { cs: `Osa`, en: `Axis` },
  layer: { cs: `Vrstva`, en: `Layer` },
  region: { cs: `Region`, en: `Region` },
  bohemia: { cs: `Čechy`, en: `Bohemia` },
  inspiration: { cs: `Inspirace`, en: `Inspiration` },
  czechWisdomZion: { cs: `Česká moudrost & ZION`, en: `Czech Wisdom & ZION` },
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
  exactGpsCoordinatesAndLandArea: { cs: `Přesné GPS souřadnice a výměra pozemku (v jednání — Říp region / střední Čechy / Vysočina?)`, en: `Exact GPS coordinates and land area (in negotiation — Říp region / central Bohemia / Vysočina?)` },
  legalFormZsAssociationVsZuInsti: { cs: `Právní forma: z.s. (spolek) vs z.ú. (ústav) vs komunitní nadace vs hybrid`, en: `Legal form: z.s. (association) vs z.ú. (institute) vs community foundation vs hybrid` },
  zionNodeCoordinatorRecruitingA: { cs: `Koordinátor ZION node — nábor Tech Guardiana s vazbou na českou developer komunitu`, en: `ZION node coordinator — recruiting a Tech Guardian with ties to the Czech developer community` },
  partnershipsWithCzechUniversit: { cs: `Partnerství s českými univerzitami (Charles University, ČZU) pro governance výzkum`, en: `Partnerships with Czech universities (Charles University, ČZU) for governance research` },
  seedLibraryWhichCzechHeritageV: { cs: `Semenná knihovna: které české odrůdy a partneři výměny (Genobanka Praha, SEMO, lokální šlechtitelé)`, en: `Seed library: which Czech heritage varieties and exchange partners (Genobanka Praha, SEMO, local breeders)` },
  doYouHearTheCallOfTheCircleAre: { cs: `Slyšíš volání kruhu? Jsi Guardian, který chce stavět governance laboratoř v srdci Evropy?`, en: `Do you hear the call of the circle? Are you a Guardian who wants to build a governance laboratory in the heart of Europe?` },
  joinDiscord: { cs: `Připojit se na Discord`, en: `Join Discord` },
  terraNova: { cs: `Terra Nova`, en: `Terra Nova` },
  documentation: { cs: `Dokumentace`, en: `Documentation` },
  documentationSubtitle: { cs: `Kompletní plán, koncept a specifikace Golden Republic Bohemia.`, en: `Complete plan, concept and specification of Golden Republic Bohemia.` },
  sitePlan: { cs: `Architektonický koncept`, en: `Architectural concept` },
  sitePlanSubtitle: { cs: `První konceptový board: půdorysy, řezy a energetický systém.`, en: `First concept board: floor plans, sections and energy system.` },
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
    icon: Crown,
    titleCs: 'Governance kruh',
    titleEn: 'Governance Circle',
    descCs: 'Kamenný amfiteátr pod širým nebem — kruh rozhodování bez trůnu. Sůl na dubovém stole, oheň uprostřed. Sociokratické kruhy a ZION DAO jako primární governance.',
    descEn: 'Stone amphitheater under the open sky — a decision circle without a throne. Salt on an oak table, fire in the middle. Sociocratic circles and ZION DAO as primary governance.',
    status: 'planned' as const,
    color: '#F59E0B',
    rgb: '252, 209, 22',
  },
  {
    icon: Leaf,
    titleCs: 'Permakultura',
    titleEn: 'Permaculture',
    descCs: 'České odrůdy, ovocné sady, bylinkové zahrady, včely. Půda, která živí kruh. 1 ha permakultury a agrolesnictví → 3 ha syntropický systém.',
    descEn: 'Czech heritage varieties, orchards, herb gardens, bees. Soil that feeds the circle. 1 ha permaculture and agroforestry → 3 ha syntropic system.',
    status: 'planned' as const,
    color: '#066928',
    rgb: '6, 105, 40',
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
    descCs: 'Most (governance), Univerzita (vědění), Zlatá bula (protokol). Originální současné struktury evokující most/triadu a svatou geometrii — bez kopírování existujících symbolů.',
    descEn: 'Bridge (governance), University (knowledge), Golden Bull (protocol). Original contemporary structures evoking a bridge/triad and sacred geometry — without copying existing symbols.',
    status: 'planned' as const,
    color: '#8B5CF6',
    rgb: '139, 92, 246',
  },
  {
    icon: TreePine,
    titleCs: 'Lipová alej',
    titleEn: 'Linden Avenue',
    descCs: 'Stromy zasazované při každém novém strážci — živý ledger komunity. Lipový čaj, lipový med, lipové dřevo — strom, který je s Čechami tisíc let.',
    descEn: 'Trees planted for each new guardian — a living ledger of the community. Linden tea, linden honey, linden wood — a tree that has been with Bohemia for a thousand years.',
    status: 'planned' as const,
    color: '#F59E0B',
    rgb: '252, 209, 22',
  },
  {
    icon: Sun,
    titleCs: 'Solar & off-grid',
    titleEn: 'Solar & off-grid',
    descCs: 'Energetická soběstačnost — solar 8 kWp + 16 kWh LiFePO4, dešťová cisterna 30 m³, pramen, kořenová čistírna. Soběstačnost jako podmínka svobody rozhodování.',
    descEn: 'Energy self-sufficiency — solar 8 kWp + 16 kWh LiFePO4, rainwater cistern 30 m³, spring, reed-bed filter. Self-sufficiency as a condition of free decision-making.',
    status: 'planned' as const,
    color: '#22D3EE',
    rgb: '34, 211, 238',
  },
];

const SIGNALS: SignalItem[] = [
  { icon: MapPin, value: 'Říp / Čechy', labelCs: 'Osa', labelEn: 'Axis' },
  { icon: Crown, value: 'Čechy', labelCs: 'Region', labelEn: 'Region' },
  { icon: Sparkles, value: '2027–2030', labelCs: 'Fáze 1', labelEn: 'Phase 1' },
];

const PHASES = [
  {
    num: '0',
    cs: 'Zárodek',
    en: 'Seed',
    descCs: 'Core team 3–5 strážců, scouting Čechy, právní rešerše (z.s. vs z.ú. vs komunitní nadace), rozpočet 60 000 EUR, zkušební záhony 0,2 ha.',
    descEn: 'Core team 3–5 guardians, scouting Bohemia, legal research (z.s. vs z.ú. vs community foundation), budget 60 000 EUR, trial plots 0.2 ha.',
    active: true,
  },
  {
    num: '1',
    cs: 'Kořeny',
    en: 'Roots',
    descCs: 'Pozemek (koupě / dlouhodobý nájem), registrace, solar 8 kWp, cisterna, eko-chaty 4–6 jednotek, 1 ha, první hosté Q3 2027, ZION wallet + DAO rámec.',
    descEn: 'Land (purchase / long-term lease), registration, solar 8 kWp, cistern, eco-cabins 4–6 units, 1 ha, first guests Q3 2027, ZION wallet + DAO framework.',
    active: false,
  },
  {
    num: '2',
    cs: 'Komunita',
    en: 'Community',
    descCs: 'Guardian node, stálé bydlení 3–5 chat, měsíční governance program, LoRa mesh, Medical Table pavilon, propojení s Genesis Garden a Dharma Temple.',
    descEn: 'Guardian node, permanent housing 3–5 cabins, monthly governance program, LoRa mesh, Medical Table pavilion, connection with Genesis Garden and Dharma Temple.',
    active: false,
  },
  {
    num: '3',
    cs: 'Síť',
    en: 'Network',
    descCs: '3 ha, semenná síť 3+ uzlů, vzdělávací centrum (Wayfinding Governance škola), druhý uzel v Čechách nebo na Slovensku.',
    descEn: '3 ha, seed network 3+ nodes, education center (Wayfinding Governance school), second node in Bohemia or Slovakia.',
    active: false,
  },
  {
    num: '4',
    cs: 'Vyzařování',
    en: 'Radiance',
    descCs: 'Governance retreat centrum 40+ hostů, ZION platby jako výchozí, knowledge commons, 1 % přebytku → L6, první prototyp Zlaté republiky v praxi.',
    descEn: 'Governance retreat center 40+ guests, ZION payments as default, knowledge commons, 1% surplus → L6, first working prototype of the Golden Republic in practice.',
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
  { label: 'Medical Table', status: 'planned', icon: Heart },
  { label: 'LoRa / Mesh', status: 'planned', icon: Sparkles },
  { label: 'Seed Library', status: 'planned', icon: Leaf },
  { label: 'Golden Republic Protocol', status: 'vision', icon: Crown },
];

const CZECH_WISDOM = [
  {
    czech: { cs: 'Sůl na stole (berit melach)', en: 'Salt on the table (berit melach)' },
    principle: { cs: 'Smlouva, která platí beze slov', en: 'A covenant that holds without words' },
    zion: { cs: 'ZION jako sůl — zaručuje, že pravidla platí', en: 'ZION as salt — guarantees the rules hold' },
  },
  {
    czech: { cs: 'Karlův most (1-3-5-7-9-7-5-3-1)', en: 'Charles Bridge (1-3-5-7-9-7-5-3-1)' },
    principle: { cs: 'Most spojuje, nerozděluje', en: 'A bridge connects, does not divide' },
    zion: { cs: 'ZION je most mezi komunitami, ne zeď', en: 'ZION is a bridge between communities, not a wall' },
  },
  {
    czech: { cs: 'Charles University (1348)', en: 'Charles University (1348)' },
    principle: { cs: 'Vzdělání jako právo, ne komodita', en: 'Education as a right, not a commodity' },
    zion: { cs: 'Knowledge commons — open access', en: 'Knowledge commons — open access' },
  },
  {
    czech: { cs: 'Zlatá bula (1356)', en: 'Golden Bull (1356)' },
    principle: { cs: 'Psaná pravidla, distribuovaná moc', en: 'Written rules, distributed power' },
    zion: { cs: 'Proto-DAO — stabilita strukturou', en: 'Proto-DAO — stability through structure' },
  },
];

export default function GoldenRepublicBohemiaPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  const [doc, setDoc] = useState<string | null>(null);
  const [docError, setDocError] = useState(false);

  useEffect(() => {
    const file = cs ? '/docs/terranova/golden-republic-bohemia.cs.md' : '/docs/terranova/golden-republic-bohemia.en.md';
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
            <span>{TerranovaGoldenRepublicBohemiaCopy.home[cs ? 'cs' : 'en']}</span>
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
          <div className="zion-rainbow-card overflow-hidden" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
            <div className="relative h-48 md:h-64 overflow-hidden">
              <img
                src="/images/golden-republic-bohemia/hero.jpg"
                alt="Golden Republic Bohemia"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
            </div>
            <div className="relative z-10 p-6 md:p-10">
              <div className="flex flex-col md:flex-row gap-8 items-start">
                {/* Crown symbol */}
                <div className="shrink-0 w-20 h-20 flex items-center justify-center text-4xl zion-rainbow-sub" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                  👑
                </div>

                {/* Text column */}
                <div className="space-y-3 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="zion-badge">
                      L5 · Terra Nova Governance Lab
                    </span>
                    <span className="zion-badge-gold">
                      📋 {TerranovaGoldenRepublicBohemiaCopy.planned2027[cs ? 'cs' : 'en']}
                    </span>
                  </div>

                  <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gradient">
                    Golden Republic Bohemia
                  </h1>
                  <p className="text-lg text-zion-gold font-medium">
                    {TerranovaGoldenRepublicBohemiaCopy.livingCentreBohemiaTerraNova[cs ? 'cs' : 'en']}
                  </p>

                  <div className="flex items-center gap-1.5 text-white/70">
                    <MapPin className="w-4 h-4 text-white/85 shrink-0" />
                    <span className="text-sm">Čechy · Česká republika</span>
                  </div>

                  <blockquote className="mt-4 pl-4 border-l-2 border-white/10 text-sm text-white/70 italic leading-relaxed max-w-lg">
                    {TerranovaGoldenRepublicBohemiaCopy.saltOnTheTableABridgeBetweenMy[cs ? 'cs' : 'en']}
                  </blockquote>

                  <div className="grid gap-3 pt-3 sm:grid-cols-3">
                    {SIGNALS.map((signal) => {
                      const Icon = signal.icon;
                      return (
                        <div key={signal.labelCs} className="zion-rainbow-sub px-3 py-3" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
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

        {/* ═══ ČECHY INFO ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.6 }}
          className="mb-16"
        >
          <div className="zion-rainbow-card p-6 md:p-8" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
            <div className="relative z-10 grid md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-3">
                <h3 className="text-lg font-bold text-zion-gold">
                  {TerranovaGoldenRepublicBohemiaCopy.bohemiaHeartOfEurope[cs ? 'cs' : 'en']}
                </h3>
                <p className="text-white/70 text-sm leading-relaxed">
                  {TerranovaGoldenRepublicBohemiaCopy.bohemiaIsTheLandWhereTheSaltOf[cs ? 'cs' : 'en']}
                </p>
                <p className="text-zion-gold/65 text-sm leading-relaxed">
                  {TerranovaGoldenRepublicBohemiaCopy.ripIsANationalCulturalMonument[cs ? 'cs' : 'en']}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 content-start">
                {[
                  { label: 'Říp', val: '456 m' },
                  { label: TerranovaGoldenRepublicBohemiaCopy.axis[cs ? 'cs' : 'en'], val: 'Národní památka' },
                  { label: TerranovaGoldenRepublicBohemiaCopy.layer[cs ? 'cs' : 'en'], val: 'L5' },
                  { label: TerranovaGoldenRepublicBohemiaCopy.region[cs ? 'cs' : 'en'], val: TerranovaGoldenRepublicBohemiaCopy.bohemia[cs ? 'cs' : 'en'] },
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
          <div className="zion-rainbow-card p-4 md:p-5" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
            <div className="relative z-10 mb-4 text-center">
              <p className="text-[10px] uppercase tracking-[0.45em] text-zion-gold/65 mb-1">
                {TerranovaGoldenRepublicBohemiaCopy.sitePlan[cs ? 'cs' : 'en']}
              </p>
              <h2 className="text-xl font-bold text-white">
                {TerranovaGoldenRepublicBohemiaCopy.sitePlanSubtitle[cs ? 'cs' : 'en']}
              </h2>
            </div>
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30">
              <img
                src="/images/golden-republic-bohemia/concept-og.jpg"
                alt={cs ? 'Návrh Golden Republic Bohemia' : 'Golden Republic Bohemia concept'}
                className="w-full object-contain"
              />
            </div>
          </div>
        </motion.section>

        {/* ═══ ČESKÁ MOUDROST ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.6 }}
          className="mb-16"
        >
          <div className="text-center mb-8">
            <p className="text-[10px] uppercase tracking-[0.45em] text-zion-gold/65 mb-2">
              {TerranovaGoldenRepublicBohemiaCopy.inspiration[cs ? 'cs' : 'en']}
            </p>
            <h2 className="text-2xl font-bold text-white">
              {TerranovaGoldenRepublicBohemiaCopy.czechWisdomZion[cs ? 'cs' : 'en']}
            </h2>
          </div>

          <div className="zion-rainbow-card overflow-hidden" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
            <div className="grid grid-cols-1 sm:grid-cols-3 text-center text-[10px] uppercase tracking-[0.3em] font-semibold border-b border-white/10">
              <div className="p-3 text-zion-gold/65">{TerranovaGoldenRepublicBohemiaCopy.bohemia[cs ? 'cs' : 'en']}</div>
              <div className="p-3 text-white/85 sm:border-l border-white/10">{TerranovaGoldenRepublicBohemiaCopy.principle[cs ? 'cs' : 'en']}</div>
              <div className="p-3 text-white/85 sm:border-l border-white/10">ZION</div>
            </div>
            {CZECH_WISDOM.map((row, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-3 text-sm border-b border-white/5 last:border-0">
                <div className="p-3 text-white/85 text-xs">{cs ? row.czech.cs : row.czech.en}</div>
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
              {TerranovaGoldenRepublicBohemiaCopy.projectConcept[cs ? 'cs' : 'en']}
            </p>
            <h2 className="text-2xl font-bold text-white">
              {TerranovaGoldenRepublicBohemiaCopy.activitiesVision[cs ? 'cs' : 'en']}
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
                  style={{ '--rc': '252, 209, 22' } as React.CSSProperties}
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

        {/* ═══ PHASE TIMELINE ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="mb-16"
        >
          <div className="text-center mb-8">
            <p className="text-[10px] uppercase tracking-[0.45em] text-zion-gold/65 mb-2">
              {TerranovaGoldenRepublicBohemiaCopy.developmentPhases[cs ? 'cs' : 'en']}
            </p>
            <h2 className="text-2xl font-bold text-white">
              {TerranovaGoldenRepublicBohemiaCopy.fromVisionToReality[cs ? 'cs' : 'en']}
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
                    style={{ '--rc': p.active ? '252, 209, 22' : '252, 209, 22' } as React.CSSProperties}
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
                          ⚡ {TerranovaGoldenRepublicBohemiaCopy.exploringNow[cs ? 'cs' : 'en']}
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
              {TerranovaGoldenRepublicBohemiaCopy.blockchainIntegration[cs ? 'cs' : 'en']}
            </p>
            <h2 className="text-2xl font-bold text-white">ZION Network</h2>
          </div>

          <div className="zion-rainbow-card p-6 md:p-8" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
            <div className="relative z-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ZION_ITEMS.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 zion-rainbow-sub p-3" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}
                >
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center zion-rainbow-sub" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                    <item.icon className="h-4 w-4 text-zion-gold" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white/80">{item.label}</p>
                    <p className="text-[10px] text-zion-gold/55 capitalize">
                      {item.status === 'active'
                        ? TerranovaGoldenRepublicBohemiaCopy.active[cs ? 'cs' : 'en']
                        : item.status === 'planned'
                        ? TerranovaGoldenRepublicBohemiaCopy.planned[cs ? 'cs' : 'en']
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
          <div className="zion-rainbow-card p-4 md:p-5" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
            <div className="relative z-10 mb-4 text-center">
              <p className="text-[10px] uppercase tracking-[0.45em] text-zion-gold/65 mb-1">
                {TerranovaGoldenRepublicBohemiaCopy.documentation[cs ? 'cs' : 'en']}
              </p>
              <h2 className="text-xl font-bold text-white">
                {TerranovaGoldenRepublicBohemiaCopy.documentationSubtitle[cs ? 'cs' : 'en']}
              </h2>
            </div>
            <div className="relative z-10 rounded-2xl border border-white/10 bg-black/40 p-4 md:p-6">
              {docError ? (
                <p className="text-sm text-zion-red">{TerranovaGoldenRepublicBohemiaCopy.documentationError[cs ? 'cs' : 'en']}</p>
              ) : doc ? (
                <DocMarkdownArticle content={doc} className="zion-docs-prose max-w-4xl mx-auto" />
              ) : (
                <p className="text-sm text-white/60">{TerranovaGoldenRepublicBohemiaCopy.documentationLoading[cs ? 'cs' : 'en']}</p>
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
          <div className="zion-rainbow-card p-6 md:p-8 space-y-4" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
            <h3 className="text-lg font-bold text-zion-gold">
              {TerranovaGoldenRepublicBohemiaCopy.openQuestionsLookingForGuardia[cs ? 'cs' : 'en']}
            </h3>
            <ul className="space-y-2">
              {[
                TerranovaGoldenRepublicBohemiaCopy.exactGpsCoordinatesAndLandArea[cs ? 'cs' : 'en'],
                TerranovaGoldenRepublicBohemiaCopy.legalFormZsAssociationVsZuInsti[cs ? 'cs' : 'en'],
                TerranovaGoldenRepublicBohemiaCopy.zionNodeCoordinatorRecruitingA[cs ? 'cs' : 'en'],
                TerranovaGoldenRepublicBohemiaCopy.partnershipsWithCzechUniversit[cs ? 'cs' : 'en'],
                TerranovaGoldenRepublicBohemiaCopy.seedLibraryWhichCzechHeritageV[cs ? 'cs' : 'en'],
              ].map((q, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                  <span className="text-zion-gold shrink-0 mt-0.5">◇</span>
                  {q}
                </li>
              ))}
            </ul>
            <p className="text-zion-gold/55 text-xs pt-2">
              {TerranovaGoldenRepublicBohemiaCopy.doYouHearTheCallOfTheCircleAre[cs ? 'cs' : 'en']}
            </p>
            <a
              href="https://discord.gg/eatGYDbd"
              target="_blank"
              rel="noopener noreferrer"
              className="zion-button-secondary"
            >
              <Users className="w-4 h-4" />
              {TerranovaGoldenRepublicBohemiaCopy.joinDiscord[cs ? 'cs' : 'en']}
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
            href="/terranova/te-piko-ora"
            className="zion-button-secondary"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Te Pīko Ora</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-white/85 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{TerranovaGoldenRepublicBohemiaCopy.home[cs ? 'cs' : 'en']}</span>
            </Link>
            <span className="text-zion-gold/45">|</span>
            <Link
              href="/terranova"
              className="inline-flex items-center gap-2 text-sm text-white/85 hover:text-white transition-colors"
            >
              <span>{TerranovaGoldenRepublicBohemiaCopy.terraNova[cs ? 'cs' : 'en']}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
