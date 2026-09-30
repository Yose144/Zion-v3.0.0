'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Compass,
  Ear,
  Feather,
  Heart,
  Landmark,
  LucideIcon,
  MapPin,
  Mountain,
  Music,
  Network,
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
  visionStage: { cs: `Vize — nejdřív naslouchat`, en: `Vision — listen first` },
  subtitle: { cs: `Uluru · Tjukurpa · Songlines · Austrálie · Terra Nova ®`, en: `Uluru · Tjukurpa · Songlines · Australia · Terra Nova ®` },
  quote: {
    cs: `"Země není něco, co vlastníme. Země je něco, čím jsme."`,
    en: `"The land is not something we own. The land is something we are."`,
  },
  locationLine: { cs: `Uluru-Kata Tjuṯa · Northern Territory, Austrálie`, en: `Uluru-Kata Tjuṯa · Northern Territory, Australia` },
  introTitle: { cs: `Sedmý uzel — poselství od protinožců`, en: `The seventh node — the message from the antipodes` },
  introBody: {
    cs: `Uluru je sedmý bod L5 Free World — a záměrně je to vize, ne stavební plán. Červený monolit v srdci Austrálie je domovem Aňangu, tradičních custodiánů, a Tjukurpy — Snění, které nese zákon, příběhy a mapu krajiny starší než šedesát tisíc let. Songlines, pěvecké stezky, nesou poselství přes celý kontinent — od protinožců k protinožcům. Tento uzel nevzniká na posvátné zemi; vzniká jako vztah. Nejdřív poslouchat — teprve pak případně stavět, někde jinde, jinak.`,
    en: `Uluru is the seventh point of L5 Free World — and deliberately a vision, not a building plan. The red monolith at the heart of Australia is the home of the Aṉangu, the traditional custodians, and of Tjukurpa — the Dreaming that carries law, stories and a map of the land older than sixty thousand years. Songlines, the singing tracks, carry the message across the whole continent — from antipode to antipode. This node is not built on sacred land; it is born as a relationship. Listen first — then, maybe, build, somewhere else, differently.`,
  },
  featuresTitle: { cs: `Co uzel drží`, en: `What the node holds` },
  featuresSubtitle: { cs: `Dědictví & poselství`, en: `Heritage & Message` },
  phasesTitle: { cs: `Fáze rozvoje`, en: `Development Phases` },
  phasesSubtitle: { cs: `Od naslouchání k vztahu`, en: `From listening to relationship` },
  zionTitle: { cs: `Blockchain integrace`, en: `Blockchain Integration` },
  respectTitle: { cs: `Posvátná země zůstává nedotčena`, en: `Sacred land stays untouched` },
  respectBody: {
    cs: `Uluru samotné je posvátný — od roku 2019 se na něj nesmí vystoupit a Aňangu o něm rozhodují v národním parku Uluru-Kata Tjuṯa (UNESCO za přírodní i kulturní dědictví). Uzel L5 proto neznamená stavbu u monolitu. Znamená uznání: že mapa lidstva není kompletní bez jeho nejstarší žijící kultury, a že její poselství — odpovědnost za zemi, kanyini — je přesně to, co Free World potřebuje slyšet.`,
    en: `Uluru itself is sacred — climbing it has been closed since 2019 and the Aṉangu govern it within the Uluru-Kata Tjuṯa National Park (UNESCO listed for both natural and cultural heritage). The L5 node therefore does not mean a construction by the monolith. It means recognition: that the map of humanity is not complete without its oldest living culture, and that its message — responsibility for the land, kanyini — is exactly what the Free World needs to hear.`,
  },
  openTitle: { cs: `Otevřené otázky — hledáme Guardians`, en: `Open Questions — looking for Guardians` },
  openItems: {
    cs: [
      `Je fyzický uzel vůbec správný? Může být vazbou, ne místem.`,
      `FPIC dialog — kruhy starších a tradiční custodiáni (Aňangu a další)`,
      `Partnerské území mimo národní park — střední Austrálie nebo pobřeží`,
      `Songlines jako mapa: které příběhy smí být sdíleny, a pod čí kontrolou`,
      `Souhlas a vlastnictví — znalosti zůstávají majetkem jejich nositelů`,
    ],
    en: [
      `Is a physical node even right? It may be a relationship, not a site.`,
      `FPIC dialogue — councils of elders and traditional custodians (Aṉangu and beyond)`,
      `Partner territory outside the national park — central Australia or the coast`,
      `Songlines as a map: which stories may be shared, and under whose control`,
      `Consent and ownership — knowledge stays in the custody of its carriers`,
    ],
  },
  cta: {
    cs: `Slyšíš píseň protinožců? Jsi Guardian, který umí nejdřív poslouchat?`,
    en: `Do you hear the song of the antipodes? Are you a Guardian who knows how to listen first?`,
  },
  joinDiscord: { cs: `Připojit se na Discord`, en: `Join Discord` },
  documentation: { cs: `Dokumentace`, en: `Documentation` },
  documentationSubtitle: { cs: `Koncept a vize uzlu Uluru — Dreamtime, songlines a poselství protinožců.`, en: `Concept and vision of the Uluru node — Dreamtime, songlines and the message of the antipodes.` },
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
    icon: Music,
    titleCs: 'Songlines',
    titleEn: 'Songlines',
    descCs: 'Pěvecké stezky nesoucí příběh, mapu i zákon přes celý kontinent — nejstarší síť poselství na Zemi.',
    descEn: 'Singing tracks carrying story, map and law across the whole continent — the oldest message network on Earth.',
    color: '#EA580C',
    rgb: '234, 88, 12',
  },
  {
    icon: Mountain,
    titleCs: 'Tjukurpa — Snění',
    titleEn: 'Tjukurpa — the Dreaming',
    descCs: 'Zákon předků, který není minulostí, ale trvající přítomnost: vztah mezi člověkem, zemí a příběhem.',
    descEn: 'The law of the ancestors — not the past but a continuing present: the relation between people, land and story.',
    color: '#F59E0B',
    rgb: '252, 209, 22',
  },
  {
    icon: Users,
    titleCs: 'Kruh custodiánů',
    titleEn: 'Council of custodians',
    descCs: 'Aňangu a další tradiční vlastníci rozhodují od prvního dne — FPIC není formulář, je to způsob existence vztahu.',
    descEn: 'The Aṉangu and other traditional owners decide from day one — FPIC is not a form, it is how the relationship exists at all.',
    color: '#066928',
    rgb: '6, 105, 40',
  },
  {
    icon: Ear,
    titleCs: 'Naslouchání jako praxe',
    titleEn: 'Listening as practice',
    descCs: 'Šedesát tisíc let kontinuity se nedá „osvojit" — dá se jenom vyslechnout. L5 přichází jako žák, ne jako zakladatel.',
    descEn: 'Sixty thousand years of continuity cannot be "adopted" — it can only be listened to. L5 arrives as a student, not a founder.',
    color: '#22D3EE',
    rgb: '34, 211, 238',
  },
  {
    icon: Heart,
    titleCs: 'Kanyini — odpovědnost',
    titleEn: 'Kanyini — responsibility',
    descCs: 'Propojenost a povinnost pečovat o zemi, rodinu a příběh — princip, který L5 tithe ztělesňuje v protokolu.',
    descEn: 'Connectedness and the duty to care for land, family and story — the principle the L5 tithe embodies in protocol.',
    color: '#A78BFA',
    rgb: '167, 139, 250',
  },
  {
    icon: Sparkles,
    titleCs: 'Paměť krajiny',
    titleEn: 'Memory of the land',
    descCs: 'Nejstarší žijící kultura planety drží vědění o poušti, vodě a ohni, které žádná knihovna neobsáhne.',
    descEn: 'The oldest living culture on the planet holds knowledge of desert, water and fire that no library contains.',
    color: '#8B5CF6',
    rgb: '139, 92, 246',
  },
];

const PHASES = [
  {
    num: '0',
    cs: 'Naslouchání',
    en: 'Listening',
    descCs: 'Uznání a vzdání holdu. Žádné jednání bez FPIC dialogu s tradičními custodiány — a žádný termín.',
    descEn: 'Acknowledgement and respect. No action without FPIC dialogue with the traditional custodians — and no deadline.',
    active: true,
  },
  {
    num: '1',
    cs: 'Vztah',
    en: 'Relationship',
    descCs: 'Pokud custodiáni chtějí: výměnné pobyty, kulturní dialog, podpora komunitou vedených projektů.',
    descEn: 'If the custodians wish: exchange visits, cultural dialogue, support for community-led projects.',
    active: false,
  },
  {
    num: '2',
    cs: 'Podpora',
    en: 'Support',
    descCs: 'Granty a nástroje L5 pro Aboriginal-led iniciativy — jazyky, krajina, oheň. Prostředky bez podmínek vlastnictví.',
    descEn: 'L5 grants and tools for Aboriginal-led initiatives — language, land, fire. Resources with no ownership strings.',
    active: false,
  },
  {
    num: '3',
    cs: 'Síť',
    en: 'Network',
    descCs: 'Uluru jako poselství v síti — songlines se setkávají s Te Pīko Ora, LUMI a ostatními uzly. Směr určují custodiáni.',
    descEn: 'Uluru as a message inside the network — songlines meeting Te Pīko Ora, LUMI and the other nodes. Direction set by the custodians.',
    active: false,
  },
];

const ZION_ITEMS: { label: string; icon: LucideIcon }[] = [
  { label: 'ZION L1 Node', icon: Network },
  { label: 'DAO Governance', icon: Users },
  { label: 'Guardian Wallet', icon: Shield },
  { label: 'L5 Humanitarian Tithe', icon: Heart },
  { label: 'Cultural Grants', icon: Feather },
  { label: 'Community Registry', icon: Landmark },
];

const SISTERS = [
  { name: 'Genesis Garden', href: '/terranova/genesis', region: { cs: 'Algarve, Portugalsko', en: 'Algarve, Portugal' } },
  { name: 'Dharma Temple', href: '/terranova/dharma-temple', region: { cs: 'La Palma', en: 'La Palma' } },
  { name: 'Te Pīko Ora', href: '/terranova/te-piko-ora', region: { cs: 'Raiatea · Polynésie', en: 'Raiatea · Polynesia' } },
  { name: 'Golden Republic Bohemia', href: '/terranova/golden-republic-bohemia', region: { cs: 'Čechy', en: 'Bohemia' } },
  { name: 'Bodhi Lanka', href: '/terranova/bodhi-lanka', region: { cs: 'Srí Lanka', en: 'Sri Lanka' } },
  { name: 'LUMI · Nová Amerika', href: '/terranova/nova-amerika', region: { cs: 'Kostarika', en: 'Costa Rica' } },
];

export default function UluruPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  const [doc, setDoc] = useState<string | null>(null);
  const [docError, setDocError] = useState(false);

  useEffect(() => {
    const file = cs ? '/docs/terranova/uluru.cs.md' : '/docs/terranova/uluru.en.md';
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
          <div className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': '234, 88, 12' } as React.CSSProperties}>
            <div className="relative z-10">
              <div className="flex flex-col md:flex-row gap-8 items-start">
                <div className="shrink-0 w-20 h-20 flex items-center justify-center zion-rainbow-sub" style={{ '--rc': '234, 88, 12' } as React.CSSProperties}>
                  <Mountain className="h-10 w-10 text-orange-300" />
                </div>

                <div className="space-y-3 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="zion-badge">L5 · Terra Nova · Antipodes</span>
                    <span className="zion-badge-gold inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {Copy.visionStage[cs ? 'cs' : 'en']}
                    </span>
                  </div>

                  <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gradient">
                    Uluru
                  </h1>
                  <p className="text-lg text-orange-300 font-medium">
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
                      { icon: Sun, value: cs ? '60 000+ let' : '60,000+ years', labelCs: 'Paměť', labelEn: 'Memory' },
                      { icon: Mountain, value: 'Uluru', labelCs: 'Srdce', labelEn: 'Heart' },
                      { icon: Sparkles, value: cs ? 'Vize' : 'Vision', labelCs: 'Stav', labelEn: 'Status' },
                    ].map((signal) => {
                      const Icon = signal.icon;
                      return (
                        <div key={signal.labelCs} className="zion-rainbow-sub px-3 py-3" style={{ '--rc': '234, 88, 12' } as React.CSSProperties}>
                          <div className="flex items-center gap-2 text-orange-300">
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
          <div className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': '234, 88, 12' } as React.CSSProperties}>
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
              <Compass className="h-7 w-7 text-orange-400" />
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
          <div className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': '234, 88, 12' } as React.CSSProperties}>
            <div className="mb-8">
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{Copy.phasesSubtitle[cs ? 'cs' : 'en']}</p>
              <h2 className="text-3xl font-semibold text-white">{Copy.phasesTitle[cs ? 'cs' : 'en']}</h2>
            </div>
            <div className="space-y-4">
              {PHASES.map((phase) => (
                <div key={phase.num} className="zion-rainbow-sub p-5 flex gap-4" style={{ '--rc': '234, 88, 12' } as React.CSSProperties}>
                  <div
                    className={`shrink-0 w-10 h-10 rounded-full border flex items-center justify-center font-bold text-sm ${
                      phase.active ? 'border-orange-400/40 bg-orange-400/10 text-orange-300' : 'border-white/10 bg-white/5 text-gray-500'
                    }`}
                  >
                    {phase.num}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">
                      {cs ? phase.cs : phase.en}
                      {phase.active && <span className="ml-2 text-[10px] uppercase tracking-widest text-orange-300">· {cs ? 'probíhá' : 'in progress'}</span>}
                    </h3>
                    <p className="text-sm text-gray-400">{cs ? phase.descCs : phase.descEn}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ═══ SACRED LAND ═══ */}
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
            <div className="zion-rainbow-card p-6" style={{ '--rc': '234, 88, 12' } as React.CSSProperties}>
              <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-4">
                <Network className="h-5 w-5 text-orange-300" />
                {Copy.zionTitle[cs ? 'cs' : 'en']}
              </h2>
              <div className="flex flex-wrap gap-2">
                {ZION_ITEMS.map((item) => (
                  <span key={item.label} className="inline-flex items-center gap-1.5 rounded-full border border-orange-400/30 bg-orange-400/10 px-3 py-1 text-xs text-orange-200">
                    <item.icon className="h-3 w-3" />
                    {item.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="zion-rainbow-card p-6" style={{ '--rc': '234, 88, 12' } as React.CSSProperties}>
              <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-4">
                <Landmark className="h-5 w-5 text-orange-300" />
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
