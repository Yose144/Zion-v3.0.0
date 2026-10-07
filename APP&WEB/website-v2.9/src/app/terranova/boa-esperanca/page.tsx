'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Compass,
  Droplets,
  Feather,
  Heart,
  Landmark,
  Leaf,
  LucideIcon,
  MapPin,
  Mountain,
  Network,
  Shield,
  Ship,
  Sparkles,
  Sun,
  Sunrise,
  Users,
  Waves,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';

const DocMarkdownArticle = dynamic(() => import('@/components/docs/DocMarkdownArticle'), { ssr: false });

const Copy = {
  backToTerraNova: { cs: `Zpět na Terra Nova`, en: `Back to Terra Nova` },
  visionStage: { cs: `Vize — uzel jako vztah`, en: `Vision — a node as relationship` },
  subtitle: { cs: `Mys dobré naděje · Obrat · Šev dvou oceánů · Terra Nova ®`, en: `Cape of Good Hope · the Turn · Seam of two oceans · Terra Nova ®` },
  quote: {
    cs: `"Mys bouří dostal své jméno od strachu. Dobrou naději od toho, co za ním stojí."`,
    en: `"The Cape of Storms was named by fear. Good Hope was named by what lay beyond it."`,
  },
  locationLine: { cs: `Western Cape · Jihoafrická republika`, en: `Western Cape · South Africa` },
  introTitle: { cs: `Devátý uzel — místo, kde se bouře přejmenovává`, en: `The ninth node — where the storm is renamed` },
  introBody: {
    cs: `Boa Esperança je devátý bod L5 Free World — a záměrně je to vize, ne stavební plán. Roku 1488 Bartolomeu Dias objel mys v bouři a pojmenoval ho Cabo das Tormentas; král Jan II. ho přejmenoval na Boa Esperança, protože zeď na konci světa otevřela mořskou cestu do Indie. Uzel nese Obrat — moment Velké cesty, kdy se poutník po dokončení v Ekamu otáčí domů. Je to druhý šev světa: LUMI spojuje oceány po souši, Mys je jediné místo, kde se dvě Marie mohou setkat na vodě. A drží nejstarší kořen lidstva — Khoisan linii a kolébku symbolického myšlení v Blombos. Uzel vzniká jako vztah s custodiány, ne jako stavba.`,
    en: `Boa Esperança is the ninth point of L5 Free World — and deliberately a vision, not a building plan. In 1488 Bartolomeu Dias rounded the cape in a storm and named it Cabo das Tormentas; King John II renamed it Boa Esperança, because the wall at the end of the world had opened the sea road to India. The node carries the Turn — the moment of the Great Route when the pilgrim, after completion at Ekam, turns home. It is the second seam of the world: LUMI bridges the oceans overland, the Cape is the only place the two Marias can meet at sea. And it holds humanity's oldest root — the Khoisan lineage and the cradle of symbolic thought at Blombos. The node is born as a relationship with custodians, not as a construction.`,
  },
  featuresTitle: { cs: `Co uzel drží`, en: `What the node holds` },
  featuresSubtitle: { cs: `Naděje & paměť`, en: `Hope & memory` },
  turnTitle: { cs: `Scháziště flotily — obrat na švu oceánů`, en: `The fleet rendezvous — the turn on the seam of oceans` },
  turnSubtitle: { cs: `Druhý šev světa`, en: `The second seam of the world` },
  turnBody: {
    cs: `LUMI je šev na souši — Mys je šev na vodě. Atlantická Santa María la Mayor sem pluje z jihu, indickooceánská María de las Nieves z Indie; potkají se tam, kde se potkávají oceány. Je to jediné místo Velké cesty, kde se dva trupy střetnou bez Panamy — a odkud se cesta otáčí domů: přes St Helenu a Azory zpět do Pontevedry. Ceremonie obratu: razítko credencialu „bouře přejmenována".`,
    en: `LUMI is the seam on land — the Cape is the seam at sea. The Atlantic Santa María la Mayor sails up from the south, the Indian-ocean María de las Nieves down from India; they meet where the oceans meet. It is the only place on the Great Route where two hulls can rendezvous without Panama — and where the journey turns homeward: via St Helena and the Azores back to Pontevedra. The turning ceremony: the credential stamp "the storm renamed".`,
  },
  turnPoints: {
    cs: [`Jediné setkání obou trupů na vodě — bez Panamy`, `Agulhas — místo, kde jehla ukazovala pravý sever`, `Obrat domů — Cape → St Helena → Azory → Pontevedra`],
    en: [`The only at-sea meeting of both hulls — no Panama`, `Agulhas — where the needle read true north`, `The turn home — Cape → St Helena → Azores → Pontevedra`],
  },
  phasesTitle: { cs: `Fáze rozvoje`, en: `Development Phases` },
  phasesSubtitle: { cs: `Od vztahu k scházišti`, en: `From relationship to rendezvous` },
  zionTitle: { cs: `Blockchain integrace`, en: `Blockchain Integration` },
  respectTitle: { cs: `Nejstarší lidé vedou`, en: `The first people lead` },
  respectBody: {
    cs: `Pobřeží Mysu je domovem Khoisan — pravděpodobně nejstarší kontinuální lidské linie planety — a Blombos ukrývá první symbolické umění lidstva (~75–100 tisíc let). Uzel L5 proto znamená vztah, ne pozemek: FPIC od prvního dne, custodiáni rozhodují co se sdílí a jak, žádná tokenizace dědictví. Přicházíme jako žáci — jako na Uluru.`,
    en: `The Cape coast is home to the Khoisan — arguably the oldest continuous human lineage on the planet — and Blombos holds humanity's first symbolic art (~75–100 thousand years). The L5 node therefore means relationship, not land: FPIC from day one, custodians decide what is shared and how, no tokenization of heritage. We arrive as students — as at Uluru.`,
  },
  openTitle: { cs: `Otevřené otázky — hledáme Guardians`, en: `Open Questions — looking for Guardians` },
  openItems: {
    cs: [
      `Khoisan partnerství — kdo jsou custodiáni a na jakých podmínkách (FPIC)`,
      `Lokalita: Cape Peninsula vs. Agulhas (čistý šev) vs. False Bay (kelp lesy)`,
      `Přístavní protokol pro flotilu — kotviště, resupply, sezónní okna Roaring Forties`,
      `Vodní laboratoř Day Zero — protokoly přenositelné do celé sítě`,
      `Fynbos sanctuary + kelp program — s kým a jak začít`,
    ],
    en: [
      `Khoisan partnership — who are the custodians and on what terms (FPIC)`,
      `Site: Cape Peninsula vs. Agulhas (the true seam) vs. False Bay (kelp forests)`,
      `Harbour protocol for the fleet — anchorage, resupply, Roaring Forties windows`,
      `Day-Zero water lab — protocols transferable to the whole network`,
      `Fynbos sanctuary + kelp program — with whom, and how to begin`,
    ],
  },
  cta: {
    cs: `Umíš přejmenovat bouři na naději? Jsi Guardian pro obrat Velké cesty?`,
    en: `Can you rename a storm into hope? Are you a Guardian for the Great Route's turn?`,
  },
  joinDiscord: { cs: `Připojit se na Discord`, en: `Join Discord` },
  documentation: { cs: `Dokumentace`, en: `Documentation` },
  documentationSubtitle: { cs: `Koncept a vize uzlu Boa Esperança — šev dvou oceánů, nejstarší linie lidí, vodní resilience.`, en: `Concept and vision of the Boa Esperança node — the seam of two oceans, humanity's oldest lineage, water resilience.` },
  documentationLoading: { cs: `Načítání dokumentace…`, en: `Loading documentation…` },
  documentationError: { cs: `Dokumentaci se nepodařilo načíst.`, en: `Failed to load documentation.` },
  sisterTitle: { cs: `Síť Terra Nova`, en: `Terra Nova Network` },
  sisterSubtitle: { cs: `Propojení se sesterskými projekty`, en: `Connection with sister projects` },
  sisterBody: {
    cs: `Všechny uzly sdílejí zdrojový kód: Terra Nova etika, ZION blockchain, off-grid technologie, komunitní governance a seed library.`,
    en: `All nodes share the same source code: Terra Nova ethics, ZION blockchain, off-grid technology, community governance and the seed library.`,
  },
};

type FeatureItem = {
  icon: LucideIcon;
  titleCs: string;
  titleEn: string;
  descCs: string;
  descEn: string;
  color: string;
  rgb: string;
};

const FEATURES: FeatureItem[] = [
  {
    icon: Sunrise,
    titleCs: 'Naděje jako navigace',
    titleEn: 'Hope as navigation',
    descCs: 'Cabo das Tormentas → Boa Esperança: stejné místo, jiné jméno. Iniciace Obratu — Guardian se učí, že naděje je navigační nástroj, ne pocit.',
    descEn: 'Cabo das Tormentas → Boa Esperança: same place, new name. The initiation of the Turn — the Guardian learns that hope is a navigational instrument, not a feeling.',
    color: '#F59E0B',
    rgb: '245, 158, 11',
  },
  {
    icon: Compass,
    titleCs: 'Agulhas — pravý sever',
    titleEn: 'Agulhas — true north',
    descCs: 'Geografický šev Atlantiku a Indického oceánu; „jehly" — kolem r. 1500 tu střelka ukazovala skutečný sever. Na švu světa se kompas kalibruje na pravdu.',
    descEn: 'The geographic seam of the Atlantic and Indian Oceans; "needles" — around 1500 the needle read true north here. At the seam of the world the compass is calibrated to truth.',
    color: '#22D3EE',
    rgb: '34, 211, 238',
  },
  {
    icon: Users,
    titleCs: 'Khoisan — nejstarší linie',
    titleEn: 'Khoisan — the oldest lineage',
    descCs: 'Původní lidé pobřeží a pravděpodobně nejstarší kontinuální lidská linie planety. Custodiáni vedou — FPIC jako forma existence vztahu.',
    descEn: 'The first people of the coast and arguably the oldest continuous human lineage on Earth. Custodians lead — FPIC as the form the relationship exists in.',
    color: '#EA580C',
    rgb: '234, 88, 12',
  },
  {
    icon: Sparkles,
    titleCs: 'Blombos — kolébka symbolů',
    titleEn: 'Blombos — cradle of symbols',
    descCs: 'Ochrové rytiny a mušlové korálky staré 75–100 tisíc let — první symbolické umění lidstva, první „razítko na credencialu" v historii druhu.',
    descEn: 'Ochre engravings and shell beads 75–100 thousand years old — humanity’s first symbolic art, the first "credential stamp" in the history of our species.',
    color: '#A78BFA',
    rgb: '167, 139, 250',
  },
  {
    icon: Leaf,
    titleCs: 'Fynbos — květena Mysu',
    titleEn: 'Fynbos — the Cape flora',
    descCs: 'Cape Floristic Region — nejmenší, ale na druhy nejbohatší florální říše planety. Zahrada uzlu jako její pokračování.',
    descEn: 'The Cape Floristic Region — the smallest yet richest-per-area floral kingdom on Earth. The node’s garden as its continuation.',
    color: '#34D399',
    rgb: '52, 211, 153',
  },
  {
    icon: Waves,
    titleCs: 'Kelp seaforest',
    titleEn: 'Kelp seaforest',
    descCs: 'Great African Seaforest ve False Bay — zahrada pod hladinou. Uzel spojuje péči o pevninu s péčí o mořský les.',
    descEn: 'The Great African Seaforest of False Bay — the garden below the waterline. The node joins care for the land to care for the sea forest.',
    color: '#2DD4BF',
    rgb: '45, 212, 191',
  },
  {
    icon: Droplets,
    titleCs: 'Day Zero laboratoř',
    titleEn: 'Day Zero lab',
    descCs: 'Cape Town 2018 málem vyschol a kolektivní disciplínou vodu ubránil — naděje jako praktikovaný protokol. Know-how vodní resilience pro celou síť.',
    descEn: 'Cape Town nearly ran dry in 2018 and collective discipline held the water — hope as a practised protocol. Water-resilience know-how for the whole network.',
    color: '#60A5FA',
    rgb: '96, 165, 250',
  },
  {
    icon: Ship,
    titleCs: 'Scháziště flotily',
    titleEn: 'Fleet rendezvous',
    descCs: 'Jediné místo, kde se dvě Marie setkávají na vodě bez Panamy — a odkud Velká cesta míří domů. Útočiště a resupply pro nejtěžší legy.',
    descEn: 'The only place the two Marias meet at sea without Panama — and where the Great Route turns home. Refuge and resupply for the hardest legs.',
    color: '#0EA5E9',
    rgb: '14, 165, 233',
  },
];

const PHASES = [
  {
    num: '0',
    cs: 'Vztah',
    en: 'Relationship',
    descCs: 'Dialog s Khoisan custodiány a ekokomunitami Western Cape — uzel existuje jako vzájemné učení, ne stavba. Žádný termín.',
    descEn: 'Dialogue with Khoisan custodians and Western Cape eco-communities — the node exists as mutual learning, not construction. No deadline.',
    active: true,
  },
  {
    num: '1',
    cs: 'Pobřežní kruh',
    en: 'Coastal circle',
    descCs: 'Malý uzlový kruh — fynbos zahrada, kelp program, vodní lab. Custodiáni vedou vše, co se dotýká jejich země a příběhů.',
    descEn: 'A small node circle — fynbos garden, kelp program, water lab. Custodians lead everything touching their land and stories.',
    active: false,
  },
  {
    num: '2',
    cs: 'Přístavní protokol',
    en: 'Harbour protocol',
    descCs: 'Kotviště a resupply pro flotilu — logistika Velké cesty, sezónní okna Roaring Forties.',
    descEn: 'Anchorage and resupply for the fleet — Great Route logistics, Roaring Forties seasonal windows.',
    active: false,
  },
  {
    num: '3',
    cs: 'Scháziště',
    en: 'The Rendezvous',
    descCs: 'První setkání obou trupů na švu oceánů — ceremonie obratu a razítko credencialu „bouře přejmenována".',
    descEn: 'The first meeting of both hulls on the seam of oceans — the turning ceremony and the credential stamp "the storm renamed".',
    active: false,
  },
];

const ZION_ITEMS: { label: string; icon: LucideIcon }[] = [
  { label: 'ZION L1 Node', icon: Network },
  { label: 'DAO Governance', icon: Users },
  { label: 'Guardian Wallet', icon: Shield },
  { label: 'L5 Humanitarian Tithe', icon: Heart },
  { label: 'Pilgrim Credential', icon: Feather },
  { label: 'Water Commons', icon: Droplets },
];

const SISTERS = [
  { name: 'Genesis Garden', href: '/terranova/genesis', region: { cs: 'Sabacheira · Tomar, Portugalsko', en: 'Sabacheira · Tomar, Portugal' } },
  { name: 'Dharma Temple', href: '/terranova/dharma-temple', region: { cs: 'La Palma', en: 'La Palma' } },
  { name: 'Te Pīko Ora', href: '/terranova/te-piko-ora', region: { cs: 'Raiatea · Polynésie', en: 'Raiatea · Polynesia' } },
  { name: 'Bodhi Lanka', href: '/terranova/bodhi-lanka', region: { cs: 'Srí Lanka', en: 'Sri Lanka' } },
  { name: 'LUMI · Nová Amerika', href: '/terranova/nova-amerika', region: { cs: 'Kostarika', en: 'Costa Rica' } },
  { name: 'María del Camino', href: '/terranova/maria-del-camino', region: { cs: 'Světové oceány · Galicie', en: 'World oceans · Galicia' } },
  { name: 'Uluru', href: '/terranova/uluru', region: { cs: 'Northern Territory, Austrálie', en: 'Northern Territory, Australia' } },
  { name: 'Ekam · Oneness Temple', href: '/terranova/ekam', region: { cs: 'Andhra Pradesh, Indie', en: 'Andhra Pradesh, India' } },
  { name: 'Kailash', href: '/terranova/kailash', region: { cs: 'Ngari, Tibet', en: 'Ngari, Tibet' } },
];

export default function BoaEsperancaPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  const [doc, setDoc] = useState<string | null>(null);
  const [docError, setDocError] = useState(false);

  useEffect(() => {
    const file = cs ? '/docs/terranova/boa-esperanca.cs.md' : '/docs/terranova/boa-esperanca.en.md';
    setDoc(null);
    setDocError(false);
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
            className="inline-flex items-center gap-2 text-sm text-zion-gold/65 hover:text-zion-gold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {Copy.backToTerraNova[cs ? 'cs' : 'en']}
          </Link>
        </motion.div>

        {/* ═══ HERO ═══ */}
        <motion.header
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <div className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
            <div className="relative z-10">
              <div className="flex flex-col md:flex-row gap-8 items-start">
                <div className="shrink-0 w-20 h-20 flex items-center justify-center zion-rainbow-sub" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                  <Sunrise className="h-10 w-10 text-amber-300" />
                </div>

                <div className="space-y-3 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="zion-badge">L5 · Terra Nova · Two Oceans</span>
                    <span className="zion-badge-gold inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {Copy.visionStage[cs ? 'cs' : 'en']}
                    </span>
                  </div>

                  <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gradient">
                    Boa Esperança
                  </h1>
                  <p className="text-lg text-amber-300 font-medium">
                    {Copy.subtitle[cs ? 'cs' : 'en']}
                  </p>

                  <div className="flex items-center gap-1.5 text-white/70">
                    <MapPin className="w-4 h-4 text-white/85 shrink-0" />
                    <span className="text-sm">{Copy.locationLine[cs ? 'cs' : 'en']}</span>
                  </div>

                  <blockquote className="mt-4 pl-4 border-l-2 border-white/10 text-sm text-white/70 italic leading-relaxed max-w-lg">
                    {Copy.quote[cs ? 'cs' : 'en']}
                  </blockquote>

                  <div className="grid gap-3 pt-3 sm:grid-cols-3">
                    {[
                      { icon: Mountain, value: cs ? '~100 tis. let' : '~100k years', labelCs: 'Lidské kořeny', labelEn: 'Human roots' },
                      { icon: Waves, value: cs ? 'Dva oceány' : 'Two oceans', labelCs: 'Šev světa', labelEn: 'Seam of the world' },
                      { icon: Sparkles, value: cs ? 'Vize' : 'Vision', labelCs: 'Stav', labelEn: 'Status' },
                    ].map((signal) => {
                      const Icon = signal.icon;
                      return (
                        <div key={signal.labelCs} className="zion-rainbow-sub px-3 py-3" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                          <div className="flex items-center gap-2 text-amber-300">
                            <Icon className="h-4 w-4" />
                            <span className="text-sm font-semibold">{signal.value}</span>
                          </div>
                          <p className="text-[10px] uppercase tracking-widest text-gray-500 mt-1">
                            {cs ? signal.labelCs : signal.labelEn}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            <div className="relative z-10 mt-6 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
              <img
                src="/images/boa-esperanca/hero.webp"
                alt="Boa Esperança — úsvit nad Mysem dobré naděje, šev dvou oceánů"
                width={1672}
                height={941}
                loading="eager"
                decoding="async"
                fetchPriority="high"
                className="w-full object-cover"
              />
            </div>
          </div>
        </motion.header>

        {/* ═══ INTRO ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
            <h2 className="text-2xl md:text-3xl font-semibold text-white mb-4">
              {Copy.introTitle[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-gray-300 leading-relaxed">
              {Copy.introBody[cs ? 'cs' : 'en']}
            </p>
          </div>
        </motion.section>

        {/* ═══ FEATURES ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{Copy.featuresSubtitle[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Compass className="h-7 w-7 text-amber-400" />
              {Copy.featuresTitle[cs ? 'cs' : 'en']}
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {FEATURES.map((f) => (
              <div key={f.titleCs} className="zion-rainbow-sub p-5" style={{ '--rc': f.rgb } as React.CSSProperties}>
                <div className="flex items-center gap-2 mb-2">
                  <f.icon className="h-5 w-5" style={{ color: f.color }} />
                  <h3 className="font-semibold text-white">{cs ? f.titleCs : f.titleEn}</h3>
                </div>
                <p className="text-sm text-gray-400">{cs ? f.descCs : f.descEn}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ═══ THE TURN ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
            <div className="mb-4">
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{Copy.turnSubtitle[cs ? 'cs' : 'en']}</p>
              <h2 className="text-2xl md:text-3xl font-semibold text-white flex items-center gap-3 mt-1">
                <Ship className="h-7 w-7 text-amber-400" />
                {Copy.turnTitle[cs ? 'cs' : 'en']}
              </h2>
            </div>
            <p className="text-gray-300 leading-relaxed mb-6">
              {Copy.turnBody[cs ? 'cs' : 'en']}
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {Copy.turnPoints[cs ? 'cs' : 'en'].map((point, i) => {
                const PointIcon = [Ship, Compass, Sunrise][i];
                return (
                  <div key={point} className="zion-rainbow-sub px-4 py-3" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                    <div className="flex items-center gap-2 text-amber-300 mb-1">
                      <PointIcon className="h-4 w-4" />
                      <span className="text-[10px] uppercase tracking-widest text-gray-500">{cs ? 'Princip' : 'Principle'} {i + 1}</span>
                    </div>
                    <p className="text-sm text-gray-300">{point}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.section>

        {/* ═══ PHASES ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
            <div className="mb-8">
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{Copy.phasesSubtitle[cs ? 'cs' : 'en']}</p>
              <h2 className="text-3xl font-semibold text-white">{Copy.phasesTitle[cs ? 'cs' : 'en']}</h2>
            </div>
            <div className="space-y-4">
              {PHASES.map((phase) => (
                <div key={phase.num} className="zion-rainbow-sub p-5 flex gap-4" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                  <div
                    className={`shrink-0 w-10 h-10 rounded-full border flex items-center justify-center font-bold text-sm ${
                      phase.active ? 'border-amber-400/40 bg-amber-400/10 text-amber-300' : 'border-white/10 bg-white/5 text-gray-500'
                    }`}
                  >
                    {phase.num}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">
                      {cs ? phase.cs : phase.en}
                      {phase.active && <span className="ml-2 text-[10px] uppercase tracking-widest text-amber-300">· {cs ? 'probíhá' : 'in progress'}</span>}
                    </h3>
                    <p className="text-sm text-gray-400">{cs ? phase.descCs : phase.descEn}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ═══ FIRST PEOPLE LEAD ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
            <h2 className="text-2xl md:text-3xl font-semibold text-white flex items-center gap-3 mb-4">
              <Shield className="h-7 w-7 text-zion-purple" />
              {Copy.respectTitle[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-gray-300 leading-relaxed">
              {Copy.respectBody[cs ? 'cs' : 'en']}
            </p>
          </div>
        </motion.section>

        {/* ═══ ZION INTEGRATION + OPEN QUESTIONS ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="grid md:grid-cols-2 gap-4">
            <div className="zion-rainbow-card p-6" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
              <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-4">
                <Network className="h-5 w-5 text-amber-300" />
                {Copy.zionTitle[cs ? 'cs' : 'en']}
              </h2>
              <div className="flex flex-wrap gap-2">
                {ZION_ITEMS.map((item) => (
                  <span key={item.label} className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs text-amber-200">
                    <item.icon className="h-3 w-3" />
                    {item.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="zion-rainbow-card p-6" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
              <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-4">
                <Landmark className="h-5 w-5 text-amber-300" />
                {Copy.openTitle[cs ? 'cs' : 'en']}
              </h2>
              <ul className="list-disc pl-4 text-sm text-gray-400 space-y-2">
                {Copy.openItems[cs ? 'cs' : 'en'].map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </motion.section>

        {/* ═══ DOCUMENTATION ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-white">{Copy.documentation[cs ? 'cs' : 'en']}</h2>
            <p className="text-sm text-gray-500">{Copy.documentationSubtitle[cs ? 'cs' : 'en']}</p>
          </div>
          {doc ? (
            <DocMarkdownArticle content={doc} className="zion-docs-prose max-w-4xl mx-auto" />
          ) : docError ? (
            <p className="text-sm text-gray-500">{Copy.documentationError[cs ? 'cs' : 'en']}</p>
          ) : (
            <p className="text-sm text-gray-500">{Copy.documentationLoading[cs ? 'cs' : 'en']}</p>
          )}
        </motion.section>

        {/* ═══ SISTERS + CTA ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
            <div className="mb-6">
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{Copy.sisterSubtitle[cs ? 'cs' : 'en']}</p>
              <h2 className="text-2xl font-semibold text-white">{Copy.sisterTitle[cs ? 'cs' : 'en']}</h2>
              <p className="text-sm text-gray-400 mt-2">{Copy.sisterBody[cs ? 'cs' : 'en']}</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {SISTERS.map((s) => (
                <Link key={s.name} href={s.href} className="zion-rainbow-sub p-4 group hover:bg-white/5 transition-colors" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-white text-sm">{s.name}</h3>
                      <p className="text-xs text-gray-500">{cs ? s.region.cs : s.region.en}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-zion-gold/60 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              ))}
            </div>
            <div className="mt-8 text-center">
              <p className="text-gray-300 mb-4">{Copy.cta[cs ? 'cs' : 'en']}</p>
              <a
                href="https://discord.gg/zionterranova"
                target="_blank"
                rel="noopener noreferrer"
                className="zion-rainbow-sub inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
                style={{ '--rc': '245, 158, 11' } as React.CSSProperties}
              >
                {Copy.joinDiscord[cs ? 'cs' : 'en']} <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </motion.section>

      </div>
    </div>
  );
}
