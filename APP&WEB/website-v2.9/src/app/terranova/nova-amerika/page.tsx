'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Compass,
  Feather,
  Globe2,
  Heart,
  Landmark,
  Leaf,
  LucideIcon,
  MapPin,
  Network,
  Radio,
  Satellite,
  Shield,
  Sparkles,
  Sun,
  Users,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';

const DocMarkdownArticle = dynamic(() => import('@/components/docs/DocMarkdownArticle'), { ssr: false });

const Copy = {
  backToTerraNova: { cs: `Zpět na Terra Nova`, en: `Back to Terra Nova` },
  planned2027: { cs: `Plánováno 2027+`, en: `Planned 2027+` },
  bridgeSubtitle: { cs: `Most Amerik · Kostarika · Terra Nova ®`, en: `Americas Bridge · Costa Rica · Terra Nova ®` },
  quote: {
    cs: `"Nejdřív poslouchat, pak stavět. Most nespojuje břehy — spojuje lidi."`,
    en: `"Listen first, then build. A bridge does not connect shores — it connects people."`,
  },
  locationLine: { cs: `Kostarika · pevninský most Amerik`, en: `Costa Rica · the land bridge of the Americas` },
  introTitle: { cs: `Šestý uzel — země mezi dvěma světy`, en: `The sixth node — land between two worlds` },
  introBody: {
    cs: `Nová Amerika je šestý a poslední plánovaný uzel L5 Free World — projekt pro nativní kultury obou Amerik. Kostarika leží na zeměpisném středobodu kontinentů: osm oficiálně uznávaných indiánských teritorií (Bribri, Cabécar, Boruca, Ngäbe-Buglé, Maleku, Huetar, Chorotega), země bez armády, ~98 % obnovitelné energie a dostupné rurální pozemky. Uzel se staví principem FPIC — svobodný, předem daný a informovaný souhlas kruhů starších.`,
    en: `Nová Amerika is the sixth and final planned node of L5 Free World — a project for the native cultures of both Americas. Costa Rica sits at the geographic midpoint of the continents: eight officially recognised indigenous territories (Bribri, Cabécar, Boruca, Ngäbe-Buglé, Maleku, Huetar, Chorotega), a country without an army, ~98% renewable energy and affordable rural land. The node is built on FPIC — free, prior and informed consent of the councils of elders.`,
  },
  featuresTitle: { cs: `Co uzel drží`, en: `What the node holds` },
  featuresSubtitle: { cs: `Aktivity & vize`, en: `Activities & Vision` },
  phasesTitle: { cs: `Fáze rozvoje`, en: `Development Phases` },
  phasesSubtitle: { cs: `Od naslouchání k síti`, en: `From listening to the network` },
  zionTitle: { cs: `Blockchain integrace`, en: `Blockchain Integration` },
  l6Title: { cs: `Sdílený pozemek s L6 Issobella`, en: `Shared land with L6 Issobella` },
  l6Body: {
    cs: `Na stejném pozemku je plánován pozemní segment L6 Issobella — výzkumný kampus s TT&C anténami, laboratoří a observatoří. L5 pod nohama, L6 nad hlavou: sdílená země, voda, energie a mesh — ale každý fond, governance a rozpočet zvlášť.`,
    en: `The same plot is planned to host the L6 Issobella ground segment — a research campus with TT&C antennas, a lab and an observatory. L5 underfoot, L6 overhead: shared land, water, energy and mesh — but separate fund, governance and budget.`,
  },
  l6Link: { cs: `Pozemní stanice Kostarika → L6 Issobella`, en: `Costa Rica Ground Station → L6 Issobella` },
  openTitle: { cs: `Otevřené otázky — hledáme Guardians`, en: `Open Questions — looking for Guardians` },
  openItems: {
    cs: [
      `Konkrétní lokalita — Talamanca (Bribri/Cabécar), Boruca či Guanacaste`,
      `FPIC dialog a kruh starších — partneři z indiánských teritorií`,
      `Právní forma v Kostarice (asociace / komunitní nadace / hybrid)`,
      `Pravidla sdílení pozemku a infrastruktury s L6 kampusem`,
      `Semenná knihovna Amerik — které odrůdy a partneři výměny`,
    ],
    en: [
      `Exact location — Talamanca (Bribri/Cabécar), Boruca or Guanacaste`,
      `FPIC dialogue and council of elders — partners from indigenous territories`,
      `Legal form in Costa Rica (association / community foundation / hybrid)`,
      `Rules for sharing land and infrastructure with the L6 campus`,
      `Seed Library of the Americas — which varieties and exchange partners`,
    ],
  },
  cta: {
    cs: `Slyšíš volání mostu? Jsi Guardian, který chce stavět uzel mezi dvěma Amerikami?`,
    en: `Do you hear the call of the bridge? Are you a Guardian who wants to build the node between the two Americas?`,
  },
  joinDiscord: { cs: `Připojit se na Discord`, en: `Join Discord` },
  documentation: { cs: `Dokumentace`, en: `Documentation` },
  documentationSubtitle: { cs: `Kompletní plán, koncept a specifikace Nové Ameriky.`, en: `Complete plan, concept and specification of Nová Amerika.` },
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
    icon: Users,
    titleCs: 'Kruh starších',
    titleEn: 'Council of Elders',
    descCs: 'Představitelé partnerských teritorií sedí u stolu od prvního dne. FPIC není formulář — je to způsob rozhodování.',
    descEn: 'Representatives of partner territories sit at the table from day one. FPIC is not a form — it is how decisions are made.',
    color: '#F59E0B',
    rgb: '252, 209, 22',
  },
  {
    icon: Leaf,
    titleCs: 'Semenná knihovna Amerik',
    titleEn: 'Seed Library of the Americas',
    descCs: 'Kakao, kukuřice, fazole, dýně a lokální odrůdy. Živá sbírka ve vlastnictví komunity, ve výměně s ostatními uzly.',
    descEn: 'Cacao, maize, beans, squash and local varieties. A living collection owned by the community, exchanged with other nodes.',
    color: '#066928',
    rgb: '6, 105, 40',
  },
  {
    icon: Sun,
    titleCs: 'Permakultura & agrolesnictví',
    titleEn: 'Permaculture & Agroforestry',
    descCs: 'Syntropické systémy inspirované tradičním kostarickým hospodařením — půda, která se zlepšuje každým rokem.',
    descEn: 'Syntropic systems inspired by traditional Costa Rican cultivation — soil that improves every year.',
    color: '#22D3EE',
    rgb: '34, 211, 238',
  },
  {
    icon: Heart,
    titleCs: 'Medical Table',
    titleEn: 'Medical Table',
    descCs: 'Most mezi tradiční medicínou a holistickými protokoly L5 — znalosti zůstávají majetkem komunit, které je nosí.',
    descEn: 'A bridge between traditional medicine and L5 holistic protocols — knowledge stays in the ownership of the communities that carry it.',
    color: '#F59E0B',
    rgb: '252, 209, 22',
  },
  {
    icon: Radio,
    titleCs: 'LoRa mesh + Guardian Node',
    titleEn: 'LoRa Mesh + Guardian Node',
    descCs: 'Off-grid komunikace a validace bloků — 90 % operátor / 10 % komunitní pokladna, stejně jako všechny L5 uzly.',
    descEn: 'Off-grid communication and block validation — 90% operator / 10% community treasury, same as all L5 nodes.',
    color: '#8B5CF6',
    rgb: '139, 92, 246',
  },
  {
    icon: Satellite,
    titleCs: 'L6 pozemní segment',
    titleEn: 'L6 Ground Segment',
    descCs: 'Na sdíleném pozemku později kampus Issobella — TT&C antény, laboratoř a observatoř pro budoucí orbitální stanici.',
    descEn: 'The shared plot later hosts the Issobella campus — TT&C antennas, a lab and an observatory for the future orbital station.',
    color: '#A78BFA',
    rgb: '167, 139, 250',
  },
];

const PHASES = [
  {
    num: '0',
    cs: 'Poslouchání',
    en: 'Listening',
    descCs: 'Mapování teritorií, FPIC dialog, scouting lokalit (Talamanca / Boruca / Guanacaste), právní rešerše. Žádná stavba před souhlasem.',
    descEn: 'Territory mapping, FPIC dialogue, site scouting (Talamanca / Boruca / Guanacaste), legal research. No building before consent.',
    active: true,
  },
  {
    num: '1',
    cs: 'Pozemek',
    en: 'Land',
    descCs: 'Akvizice soukromé půdy mimo teritoria (koupě / dlouhodobý pronájem), ustavení kruhu starších, voda a solar.',
    descEn: 'Acquisition of private land outside the territories (purchase / long-term lease), council of elders established, water and solar.',
    active: false,
  },
  {
    num: '2',
    cs: 'Komunita',
    en: 'Community',
    descCs: 'Farma, semenná knihovna, Guardian node, LoRa mesh, první rezidenční pobyty hostů z teritorií.',
    descEn: 'Farm, seed library, Guardian node, LoRa mesh, first residency stays for guests from the territories.',
    active: false,
  },
  {
    num: '3',
    cs: 'Síť',
    en: 'Network',
    descCs: 'Sesterské uzly v dalších teritoriích Amerik, výměnné programy s Te Pīko Ora a dalšími L5 komunitami.',
    descEn: 'Sister nodes in other territories of the Americas, exchange programmes with Te Pīko Ora and other L5 communities.',
    active: false,
  },
];

const ZION_ITEMS: { label: string; icon: LucideIcon }[] = [
  { label: 'ZION L1 Node', icon: Network },
  { label: 'DAO Governance', icon: Users },
  { label: 'Guardian Wallet', icon: Shield },
  { label: 'Medical Table', icon: Heart },
  { label: 'LoRa / Mesh', icon: Radio },
  { label: 'Seed Library', icon: Leaf },
  { label: 'L6 Ground Station', icon: Satellite },
];

const SISTERS = [
  { name: 'Genesis Garden', href: '/terranova/genesis', region: { cs: 'Algarve, Portugalsko', en: 'Algarve, Portugal' } },
  { name: 'Dharma Temple', href: '/terranova/dharma-temple', region: { cs: 'La Palma', en: 'La Palma' } },
  { name: 'Te Pīko Ora', href: '/terranova/te-piko-ora', region: { cs: 'Raiatea · Polynésie', en: 'Raiatea · Polynesia' } },
  { name: 'Golden Republic Bohemia', href: '/terranova/golden-republic-bohemia', region: { cs: 'Čechy', en: 'Bohemia' } },
  { name: 'Bodhi Lanka', href: '/terranova/bodhi-lanka', region: { cs: 'Srí Lanka', en: 'Sri Lanka' } },
];

export default function NovaAmerikaPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  const [doc, setDoc] = useState<string | null>(null);
  const [docError, setDocError] = useState(false);

  useEffect(() => {
    const file = cs ? '/docs/terranova/nova-amerika.cs.md' : '/docs/terranova/nova-amerika.en.md';
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
          <div className="zion-rainbow-card overflow-hidden" style={{ '--rc': '20, 184, 166' } as React.CSSProperties}>
            <div className="relative z-10 p-6 md:p-10">
              <div className="flex flex-col md:flex-row gap-8 items-start">
                <div className="shrink-0 w-20 h-20 flex items-center justify-center zion-rainbow-sub" style={{ '--rc': '20, 184, 166' } as React.CSSProperties}>
                  <Feather className="h-10 w-10 text-teal-300" />
                </div>

                <div className="space-y-3 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="zion-badge">L5 · Terra Nova · Americas Bridge</span>
                    <span className="zion-badge-gold inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {Copy.planned2027[cs ? 'cs' : 'en']}
                    </span>
                  </div>

                  <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gradient">
                    Nová Amerika
                  </h1>
                  <p className="text-lg text-teal-300 font-medium">
                    {Copy.bridgeSubtitle[cs ? 'cs' : 'en']}
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
                      { icon: Globe2, value: cs ? 'Středobod Amerik' : 'Midpoint of the Americas', labelCs: 'Osa', labelEn: 'Axis' },
                      { icon: Feather, value: cs ? 'Nativní kultury' : 'Native cultures', labelCs: 'Fokus', labelEn: 'Focus' },
                      { icon: Sparkles, value: '2027–2031', labelCs: 'Fáze 0–3', labelEn: 'Phases 0–3' },
                    ].map((signal) => {
                      const Icon = signal.icon;
                      return (
                        <div key={signal.labelCs} className="zion-rainbow-sub px-3 py-3" style={{ '--rc': '20, 184, 166' } as React.CSSProperties}>
                          <div className="flex items-center gap-2 text-teal-300">
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
          </div>
        </motion.header>

        {/* ═══ INTRO ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': '20, 184, 166' } as React.CSSProperties}>
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
              <Compass className="h-7 w-7 text-teal-300" />
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

        {/* ═══ PHASES ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': '20, 184, 166' } as React.CSSProperties}>
            <div className="mb-8">
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{Copy.phasesSubtitle[cs ? 'cs' : 'en']}</p>
              <h2 className="text-3xl font-semibold text-white">{Copy.phasesTitle[cs ? 'cs' : 'en']}</h2>
            </div>
            <div className="space-y-4">
              {PHASES.map((phase) => (
                <div key={phase.num} className="zion-rainbow-sub p-5 flex gap-4" style={{ '--rc': '20, 184, 166' } as React.CSSProperties}>
                  <div
                    className={`shrink-0 w-10 h-10 rounded-full border flex items-center justify-center font-bold text-sm ${
                      phase.active ? 'border-teal-400/40 bg-teal-400/10 text-teal-300' : 'border-white/10 bg-white/5 text-gray-500'
                    }`}
                  >
                    {phase.num}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">
                      {cs ? phase.cs : phase.en}
                      {phase.active && <span className="ml-2 text-[10px] uppercase tracking-widest text-teal-300">· {cs ? 'probíhá' : 'in progress'}</span>}
                    </h3>
                    <p className="text-sm text-gray-400">{cs ? phase.descCs : phase.descEn}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ═══ L6 SHARED LAND ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
            <h2 className="text-2xl md:text-3xl font-semibold text-white flex items-center gap-3 mb-4">
              <Satellite className="h-7 w-7 text-zion-purple" />
              {Copy.l6Title[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-gray-300 leading-relaxed mb-6">
              {Copy.l6Body[cs ? 'cs' : 'en']}
            </p>
            <Link
              href="/l6-issobella"
              className="inline-flex items-center gap-2 rounded-2xl border border-zion-purple/30 bg-zion-purple/5 px-6 py-3 text-sm font-semibold text-rose-200 hover:bg-zion-purple/10 transition-colors"
            >
              {Copy.l6Link[cs ? 'cs' : 'en']} <ArrowRight className="h-4 w-4" />
            </Link>
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
            <div className="zion-rainbow-card p-6" style={{ '--rc': '20, 184, 166' } as React.CSSProperties}>
              <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-4">
                <Network className="h-5 w-5 text-teal-300" />
                {Copy.zionTitle[cs ? 'cs' : 'en']}
              </h2>
              <div className="flex flex-wrap gap-2">
                {ZION_ITEMS.map((item) => (
                  <span key={item.label} className="inline-flex items-center gap-1.5 rounded-full border border-teal-400/30 bg-teal-400/10 px-3 py-1 text-xs text-teal-200">
                    <item.icon className="h-3 w-3" />
                    {item.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="zion-rainbow-card p-6" style={{ '--rc': '20, 184, 166' } as React.CSSProperties}>
              <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-4">
                <Landmark className="h-5 w-5 text-teal-300" />
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
          <div className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
            <div className="mb-6">
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{Copy.sisterSubtitle[cs ? 'cs' : 'en']}</p>
              <h2 className="text-2xl font-semibold text-white">{Copy.sisterTitle[cs ? 'cs' : 'en']}</h2>
              <p className="text-sm text-gray-400 mt-2">{Copy.sisterBody[cs ? 'cs' : 'en']}</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {SISTERS.map((s) => (
                <Link key={s.name} href={s.href} className="zion-rainbow-sub p-4 group hover:bg-white/5 transition-colors" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
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
                style={{ '--rc': '252, 209, 22' } as React.CSSProperties}
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
