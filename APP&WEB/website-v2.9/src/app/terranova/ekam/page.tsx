'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Compass,
  Feather,
  Heart,
  Landmark,
  Layers,
  LucideIcon,
  MapPin,
  Mountain,
  Network,
  Shield,
  Ship,
  Sparkles,
  Sun,
  Users,
  Waves,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';

const DocMarkdownArticle = dynamic(() => import('@/components/docs/DocMarkdownArticle'), { ssr: false });

const Copy = {
  backToTerraNova: { cs: `Zpět na Terra Nova`, en: `Back to Terra Nova` },
  builtStage: { cs: `Postaveno 2008 — předloha všech uzlů`, en: `Built 2008 — the template for all nodes` },
  subtitle: { cs: `Oneness Temple · Andhra Pradesh · Indie · Terra Nova ®`, en: `Oneness Temple · Andhra Pradesh · India · Terra Nova ®` },
  quote: {
    cs: `"Ostatní uzly stavíme — tento nás učí, jak."`,
    en: `"We build the other nodes — this one teaches us how."`,
  },
  locationLine: { cs: `Varadaiahpalem · distrikt Tirupati, Andhra Pradesh, Indie`, en: `Varadaiahpalem · Tirupati district, Andhra Pradesh, India` },
  introTitle: { cs: `Desátý uzel — jediný, který už stojí`, en: `The tenth node — the only one already standing` },
  introBody: {
    cs: `Ekam je desátý bod L5 Free World — a jediný, který fyzicky existuje. Chrám Jednoty u vesnice Varadaiahpalem byl otevřen 22. dubna 2008 jako Oneness Temple; dnes nese jméno Ekam — sanskrtské „Jedno". Bílý mramor na platformě 130×106 m, výška 33 m, vodní plochy jako „ostrov", bezsloupová meditační hala ~2 090 m² a na nejvyšším podlaží Zlatá koule. Ekam je vrchol Velké cesty — iniciace dokončení — a zároveň předloha: živý důkaz, že architektura navržená pro vědomí se dá postavit. A navazuje přímo na řetězec: proof-of-work ZIONu se jmenuje ekam_deeksha a genesis věta sítě zní „Om Namo Hiranyagarbha & Ekam Deeksha!".`,
    en: `Ekam is the tenth point of L5 Free World — and the only one that physically exists. The Temple of Oneness near the village of Varadaiahpalem opened on 22 April 2008 as the Oneness Temple; today it carries the name Ekam — Sanskrit for "One". White marble on a 130×106 m platform, 33 m tall, water moats forming an "island", a ~2,090 m² column-free meditation hall and, on the top floor, the Golden Orb. Ekam is the summit of the Great Route — the initiation of completion — and also the template: living proof that architecture designed for consciousness can be built. And it connects directly to the chain: ZION's proof-of-work is called ekam_deeksha and the network's genesis words read "Om Namo Hiranyagarbha & Ekam Deeksha!".`,
  },
  featuresTitle: { cs: `Co uzel drží`, en: `What the node holds` },
  featuresSubtitle: { cs: `Dokončení & předloha`, en: `Completion & template` },
  templateTitle: { cs: `Předloha — co se z Ekamu učí všechny uzly`, en: `The template — what every node learns from Ekam` },
  templateSubtitle: { cs: `Architektura jako technologie`, en: `Architecture as technology` },
  templateBody: {
    cs: `Chrám nevznikl jako svatyně jedné tradice — navrhl ho Prabhat Poddar z Auroville tak, aby v něm jakákoli vnitřní zkušenost mohla prohloubit. Zlatý řez v každé proporci, vaastu orientace podle světových stran, geobiologicky vybraná lokalita, tři podlaží jako architektura iniciace (příprava → přání → osvobození) a jeden nepřerušený prostor pro stovky lidí. Tyto principy informují design Genesis, Dharmy i všech budoucích uzlů — Ekam je kurátorovaný „reference design" sítě.`,
    en: `The temple was not designed as the shrine of one tradition — Prabhat Poddar of Auroville designed it so that any inner experience could deepen within it. Golden ratio in every proportion, Vaastu alignment to the cardinal directions, a geobiologically chosen site, three floors as an architecture of initiation (preparation → aspiration → liberation) and one uninterrupted space holding hundreds of people. These principles inform the design of Genesis, Dharma and every future node — Ekam is the network's curated "reference design".`,
  },
  templatePoints: {
    cs: [`Zlatý řez + vaastu + geobiologie — proporce jako nosič zkušenosti`, `Bezsloupová hala 2 090 m² — vzor pro sál každého uzlu`, `Tři podlaží = iniciační sekvence — příprava → přání → osvobození`],
    en: [`Golden ratio + Vaastu + geobiology — proportion as a carrier of experience`, `2,090 m² column-free hall — the pattern for every node's hall`, `Three floors = initiation sequence — preparation → aspiration → liberation`],
  },
  phasesTitle: { cs: `Fáze rozvoje`, en: `Development Phases` },
  phasesSubtitle: { cs: `Od vztahu k předloze`, en: `From relationship to template` },
  zionTitle: { cs: `Blockchain integrace`, en: `Blockchain Integration` },
  respectTitle: { cs: `Vztah, ne vlastnictví`, en: `Relationship, not ownership` },
  respectBody: {
    cs: `Ekam provozuje organizace Oneness/Ekam — ZION na něm nebuduje, nevlastní a nereprezentuje ho. Uzel funguje jako Uluru a Boa Esperança: destination node, návštěvy na podmínky provozovatele, žádný nárok na programy, symboly či dědictví. Silnější metafyzická tvrzení linie („generátor vědomí", „pole jednoty") uvádíme jako její učení — L5 z něj čerpá principy návrhu, ne empirické nároky.`,
    en: `Ekam is operated by the Oneness/Ekam organisation — ZION does not build on it, own it or represent it. The node works like Uluru and Boa Esperança: a destination node, visits on the operator's terms, no claim on programmes, symbols or heritage. The lineage's stronger metaphysical claims ("a generator of consciousness", "the oneness field") are presented as its teaching — L5 draws design principles from it, not empirical claims.`,
  },
  openTitle: { cs: `Otevřené otázky — hledáme Guardians`, en: `Open Questions — looking for Guardians` },
  openItems: {
    cs: [
      `Forma vztahu s provozovatelem kampusu — návštěva, dialog, výzkumná vazba`,
      `Poutní protokol — malé skupiny, Chennai kotviště, pozemní transfer 73 km`,
      `Co z architektury je přenositelné do designu ostatních uzlů (se souhlasem)`,
      `Jazyk pro deekshu a Zlatou kouli — respektovaně a přesně`,
      `Auroville linka — Matrimandir jako sesterský archetyp`,
    ],
    en: [
      `Form of relationship with the campus operator — visit, dialogue, research link`,
      `Pilgrim protocol — small groups, Chennai anchorage, 73 km overland transfer`,
      `Which architectural principles can inform other nodes (with consent)`,
      `Language for deeksha and the Golden Orb — respectful and precise`,
      `The Auroville link — Matrimandir as a sister archetype`,
    ],
  },
  cta: {
    cs: `Stál jsi někdy v místě, které bylo postavené pro vědomí? Jsi Guardian, který umí nést dokončení domů?`,
    en: `Have you ever stood in a place built for consciousness? Are you a Guardian who can carry completion home?`,
  },
  joinDiscord: { cs: `Připojit se na Discord`, en: `Join Discord` },
  documentation: { cs: `Dokumentace`, en: `Documentation` },
  documentationSubtitle: { cs: `Koncept a fakta uzlu Ekam — chrám Jednoty, Zlatá koule, architektura jako technologie, role na Velké cestě.`, en: `Concept and facts of the Ekam node — the Temple of Oneness, the Golden Orb, architecture as technology, its role on the Great Route.` },
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
    icon: Sun,
    titleCs: 'Zlatá koule',
    titleEn: 'The Golden Orb',
    descCs: 'Ø ~91 cm na horním podlaží Dharma Moksha — „čočka" soustředění a symbolický protějšek Hiranyagarbhy, Zlatého zárodku.',
    descEn: '~91 cm diameter on the Dharma Moksha top floor — a "lens" of focus and the symbolic counterpart of Hiranyagarbha, the Golden Seed.',
    color: '#F5DE82',
    rgb: '245, 222, 130',
  },
  {
    icon: Network,
    titleCs: 'Chain nese její jméno',
    titleEn: 'The chain carries its name',
    descCs: 'PoW mainnetu je ekam_deeksha — každý blok se těží pod jménem chrámu; genesis věta sítě děkuje této tradici.',
    descEn: 'The mainnet PoW is ekam_deeksha — every block is mined under the temple’s name; the network’s genesis words thank this lineage.',
    color: '#22D3EE',
    rgb: '34, 211, 238',
  },
  {
    icon: Landmark,
    titleCs: 'Jediný postavený',
    titleEn: 'The only one built',
    descCs: 'Otevřen 22. 4. 2008 před ~500 000 lidmi — Ekam je důkaz, že uzel L5 není utopie, ale stavitelný prostor.',
    descEn: 'Opened 22 April 2008 before ~500,000 people — Ekam is proof that an L5 node is not utopia but buildable space.',
    color: '#F5F5F4',
    rgb: '245, 245, 244',
  },
  {
    icon: Layers,
    titleCs: 'Tři podlaží iniciace',
    titleEn: 'Three floors of initiation',
    descCs: 'Příprava → Artha Kama (hala přání) → Dharma Moksha (osvobození) — architektura jako mapa vnitřní cesty.',
    descEn: 'Preparation → Artha Kama (hall of aspirations) → Dharma Moksha (liberation) — architecture as a map of the inner journey.',
    color: '#A78BFA',
    rgb: '167, 139, 250',
  },
  {
    icon: Waves,
    titleCs: 'Vodní ostrov',
    titleEn: 'Water island',
    descCs: 'Platforma 130×106 m obklopená vodními plochami — stavba v symbióze s vodním elementem; vzor pro design uzlů.',
    descEn: 'A 130×106 m platform ringed by water — a building in symbiosis with the water element; a pattern for node design.',
    color: '#2DD4BF',
    rgb: '45, 212, 191',
  },
  {
    icon: Sparkles,
    titleCs: 'Bezsloupová hala',
    titleEn: 'Column-free hall',
    descCs: '~2 090 m² jednoho nepřerušeného prostoru — stovky lidí v jednom vizuálním a akustickém poli; vzor pro sál uzlů.',
    descEn: '~2,090 m² of uninterrupted space — hundreds of people in a single visual and acoustic field; the pattern for node halls.',
    color: '#F59E0B',
    rgb: '245, 158, 11',
  },
  {
    icon: Ship,
    titleCs: 'Vrchol Velké cesty',
    titleEn: 'Summit of the Great Route',
    descCs: 'Iniciace 7 — Dokončení. Bodhi Lanka → Chennai kotviště → 73 km po souši. Satori se dokazuje návratem, ne odchodem.',
    descEn: 'Initiation 7 — Completion. Bodhi Lanka → Chennai anchorage → 73 km overland. Satori is proven by returning, not leaving.',
    color: '#0EA5E9',
    rgb: '14, 165, 233',
  },
  {
    icon: Heart,
    titleCs: 'Otevřený všem tradicím',
    titleEn: 'Open to all traditions',
    descCs: 'Chrám bez oltáře jednoho boha — jakákoli vnitřní zkušenost se tu může prohloubit. Princip, který nese každý uzel L5.',
    descEn: 'A temple with no altar to one deity — any inner experience can deepen here. The principle every L5 node carries.',
    color: '#F43F5E',
    rgb: '244, 63, 94',
  },
];

const PHASES = [
  {
    num: '0',
    cs: 'Vztah',
    en: 'Relationship',
    descCs: 'Kontakt s provozovatelem kampusu — návštěvní protokol pro malé skupiny poutníků na jejich podmínky.',
    descEn: 'Contact with the campus operator — a visit protocol for small pilgrim groups on their terms.',
    active: true,
  },
  {
    num: '1',
    cs: 'Poutní návštěvy',
    en: 'Pilgrim visits',
    descCs: 'První Guardian skupiny na Velké cestě — Chennai kotviště, pozemní transfer, návštěva chrámu.',
    descEn: 'First Guardian groups on the Great Route — Chennai anchorage, overland transfer, temple visit.',
    active: false,
  },
  {
    num: '2',
    cs: 'Dialog',
    en: 'Dialogue',
    descCs: 'Vzájemné učení — které principy architektury a programů jsou přenositelné do designu ostatních uzlů.',
    descEn: 'Mutual learning — which architectural and programme principles can inform the design of other nodes.',
    active: false,
  },
  {
    num: '3',
    cs: 'Předloha',
    en: 'The template',
    descCs: 'Ekam jako kurátorovaný reference design L5 — dokumentace principů pro Genesis, Dharma i budoucí uzly.',
    descEn: 'Ekam as the curated L5 reference design — documented principles informing Genesis, Dharma and future nodes.',
    active: false,
  },
];

const ZION_ITEMS: { label: string; icon: LucideIcon }[] = [
  { label: 'PoW ekam_deeksha', icon: Network },
  { label: 'Hiranyagarbha · L3', icon: Sun },
  { label: 'DAO Governance', icon: Users },
  { label: 'Guardian Wallet', icon: Shield },
  { label: 'Pilgrim Credential', icon: Feather },
  { label: 'L5 Humanitarian Tithe', icon: Heart },
];

const SISTERS = [
  { name: 'Genesis Garden', href: '/terranova/genesis', region: { cs: 'Algarve, Portugalsko', en: 'Algarve, Portugal' } },
  { name: 'Dharma Temple', href: '/terranova/dharma-temple', region: { cs: 'La Palma', en: 'La Palma' } },
  { name: 'Te Pīko Ora', href: '/terranova/te-piko-ora', region: { cs: 'Raiatea · Polynésie', en: 'Raiatea · Polynesia' } },
  { name: 'Bodhi Lanka', href: '/terranova/bodhi-lanka', region: { cs: 'Srí Lanka', en: 'Sri Lanka' } },
  { name: 'LUMI · Nová Amerika', href: '/terranova/nova-amerika', region: { cs: 'Kostarika', en: 'Costa Rica' } },
  { name: 'Uluru', href: '/terranova/uluru', region: { cs: 'Northern Territory, Austrálie', en: 'Northern Territory, Australia' } },
  { name: 'María del Camino', href: '/terranova/maria-del-camino', region: { cs: 'Světové oceány · Galicie', en: 'World oceans · Galicia' } },
  { name: 'Boa Esperança', href: '/terranova/boa-esperanca', region: { cs: 'Mys dobré naděje', en: 'Cape of Good Hope' } },
];

export default function EkamPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  const [doc, setDoc] = useState<string | null>(null);
  const [docError, setDocError] = useState(false);

  useEffect(() => {
    const file = cs ? '/docs/terranova/ekam.cs.md' : '/docs/terranova/ekam.en.md';
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
          <div className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': '245, 222, 130' } as React.CSSProperties}>
            <div className="relative z-10">
              <div className="flex flex-col md:flex-row gap-8 items-start">
                <div className="shrink-0 w-20 h-20 flex items-center justify-center zion-rainbow-sub" style={{ '--rc': '245, 222, 130' } as React.CSSProperties}>
                  <Sun className="h-10 w-10 text-amber-200" />
                </div>

                <div className="space-y-3 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="zion-badge">L5 · Terra Nova · India</span>
                    <span className="zion-badge-gold inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {Copy.builtStage[cs ? 'cs' : 'en']}
                    </span>
                  </div>

                  <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gradient">
                    Ekam
                  </h1>
                  <p className="text-lg text-amber-200 font-medium">
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
                      { icon: Calendar, value: '2008', labelCs: 'Otevřen', labelEn: 'Opened' },
                      { icon: Sparkles, value: '2 090 m²', labelCs: 'Bezsloupová hala', labelEn: 'Column-free hall' },
                      { icon: Sun, value: cs ? 'Zlatá koule' : 'Golden Orb', labelCs: 'Dharma Moksha', labelEn: 'Dharma Moksha' },
                    ].map((signal) => {
                      const Icon = signal.icon;
                      return (
                        <div key={signal.labelCs} className="zion-rainbow-sub px-3 py-3" style={{ '--rc': '245, 222, 130' } as React.CSSProperties}>
                          <div className="flex items-center gap-2 text-amber-200">
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
                src="/images/ekam/hero.webp"
                alt="Ekam — bílý mramorový chrám Jednoty se Zlatou koulí, Andhra Pradesh"
                width={1600}
                height={900}
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
          <div className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': '245, 222, 130' } as React.CSSProperties}>
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
              <Compass className="h-7 w-7 text-amber-300" />
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

        {/* ═══ THE TEMPLATE ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': '245, 222, 130' } as React.CSSProperties}>
            <div className="mb-4">
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{Copy.templateSubtitle[cs ? 'cs' : 'en']}</p>
              <h2 className="text-2xl md:text-3xl font-semibold text-white flex items-center gap-3 mt-1">
                <Landmark className="h-7 w-7 text-amber-300" />
                {Copy.templateTitle[cs ? 'cs' : 'en']}
              </h2>
            </div>
            <p className="text-gray-300 leading-relaxed mb-6">
              {Copy.templateBody[cs ? 'cs' : 'en']}
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {Copy.templatePoints[cs ? 'cs' : 'en'].map((point, i) => {
                const PointIcon = [Compass, Sparkles, Layers][i];
                return (
                  <div key={point} className="zion-rainbow-sub px-4 py-3" style={{ '--rc': '245, 222, 130' } as React.CSSProperties}>
                    <div className="flex items-center gap-2 text-amber-200 mb-1">
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
          <div className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': '245, 222, 130' } as React.CSSProperties}>
            <div className="mb-8">
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{Copy.phasesSubtitle[cs ? 'cs' : 'en']}</p>
              <h2 className="text-3xl font-semibold text-white">{Copy.phasesTitle[cs ? 'cs' : 'en']}</h2>
            </div>
            <div className="space-y-4">
              {PHASES.map((phase) => (
                <div key={phase.num} className="zion-rainbow-sub p-5 flex gap-4" style={{ '--rc': '245, 222, 130' } as React.CSSProperties}>
                  <div
                    className={`shrink-0 w-10 h-10 rounded-full border flex items-center justify-center font-bold text-sm ${
                      phase.active ? 'border-amber-200/40 bg-amber-200/10 text-amber-200' : 'border-white/10 bg-white/5 text-gray-500'
                    }`}
                  >
                    {phase.num}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">
                      {cs ? phase.cs : phase.en}
                      {phase.active && <span className="ml-2 text-[10px] uppercase tracking-widest text-amber-200">· {cs ? 'probíhá' : 'in progress'}</span>}
                    </h3>
                    <p className="text-sm text-gray-400">{cs ? phase.descCs : phase.descEn}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ═══ RELATIONSHIP NOT OWNERSHIP ═══ */}
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
            <div className="zion-rainbow-card p-6" style={{ '--rc': '245, 222, 130' } as React.CSSProperties}>
              <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-4">
                <Network className="h-5 w-5 text-amber-200" />
                {Copy.zionTitle[cs ? 'cs' : 'en']}
              </h2>
              <div className="flex flex-wrap gap-2">
                {ZION_ITEMS.map((item) => (
                  <span key={item.label} className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/30 bg-amber-200/10 px-3 py-1 text-xs text-amber-100">
                    <item.icon className="h-3 w-3" />
                    {item.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="zion-rainbow-card p-6" style={{ '--rc': '245, 222, 130' } as React.CSSProperties}>
              <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-4">
                <Landmark className="h-5 w-5 text-amber-200" />
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
          <div className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': '245, 222, 130' } as React.CSSProperties}>
            <div className="mb-6">
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{Copy.sisterSubtitle[cs ? 'cs' : 'en']}</p>
              <h2 className="text-2xl font-semibold text-white">{Copy.sisterTitle[cs ? 'cs' : 'en']}</h2>
              <p className="text-sm text-gray-400 mt-2">{Copy.sisterBody[cs ? 'cs' : 'en']}</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {SISTERS.map((s) => (
                <Link key={s.name} href={s.href} className="zion-rainbow-sub p-4 group hover:bg-white/5 transition-colors" style={{ '--rc': '245, 222, 130' } as React.CSSProperties}>
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
                style={{ '--rc': '245, 222, 130' } as React.CSSProperties}
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
