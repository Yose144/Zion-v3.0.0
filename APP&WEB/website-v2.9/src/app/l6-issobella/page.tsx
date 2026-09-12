'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import {
  Rocket, Star, Globe2, Wallet, Shield, Sparkles, ArrowRight,
  CheckCircle2, Clock, Heart, Zap, Crown, BookOpen, FileText,
  Satellite, Orbit, Microscope, Atom, Magnet, Radar, Flame,
  Activity, Eye, Brain, Sun, Moon, Target, Users, Anchor,
  Cpu, Radio, Scale, ChevronRight, Compass, Gauge
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import L6StationPreviewLazy from '@/components/L6StationPreviewLazy';

const L6IssobellaCopy = {
  badge: { cs: 'L6 · Issobella · Space', en: 'L6 · Issobella · Space' },
  spaceLayer: { cs: 'Vesmírná vrstva ZION ekosystému', en: 'Space layer of the ZION ecosystem' },
  title: { cs: 'Issobella', en: 'Issobella' },
  titleAccent: { cs: '— L6', en: '— L6' },
  heroBody: { cs: `L6 je vesmírná vrstva ZION — orbitální stanice, SETI výzkum, orbital mining a Overview Effect protokoly. 5 % každého bloku financuje kosmický sen lidstva.`, en: `L6 is the space layer of ZION — an orbital station, SETI research, orbital mining, and Overview Effect protocols. 5% of every block funds humanity's cosmic dream.` },
  ctaDocs: { cs: 'Prozkoumat výzkumné podklady', en: 'Explore research docs' },
  ctaDao: { cs: 'DAO governance', en: 'DAO governance' },

  k5OfEveryBlock: { cs: '5 % z každého bloku', en: '5% of every block' },
  approxMonth: { cs: '~11,7 M ZION / měsíc', en: '~11.7M ZION / month' },
  unlockedBlock: { cs: 'Odemčeno blok ~525 600', en: 'Unlocked at block ~525,600' },

  spaceFund: { cs: 'Vesmírný fond', en: 'Space Fund' },
  fundTitle: { cs: 'Fond L6 Issobella', en: 'L6 Issobella Fund' },
  blockShare: { cs: 'Podíl z bloku', en: 'Block share' },
  everyBlockForever: { cs: 'každý blok, navždy', en: 'every block, forever' },
  governedBy: { cs: 'Správa', en: 'Governed by' },
  l6Council: { cs: 'L6 Rada', en: 'L6 Council' },
  fundWallet: { cs: 'Adresa fondu', en: 'Fund wallet' },

  missionsAndVision: { cs: 'Mise & vize', en: 'Missions & vision' },
  cosmicMissions: { cs: 'Kosmické mise', en: 'Cosmic missions' },
  orbitalStation: { cs: 'Orbitální stanice', en: 'Orbital station' },
  orbitalStationDesc: { cs: `ZION Issobella — decentralizovaná orbitální stanice financovaná block reward fondem. Výzkum, věda a Overview Effect.`, en: `ZION Issobella — a decentralized orbital station funded by block reward. Research, science, and the Overview Effect.` },
  setiDeepResearch: { cs: 'SETI + Deep Research', en: 'SETI + Deep Research' },
  setiDesc: { cs: `Decentralizovaný SETI program financovaný L6 fondem — komunita hlasuje o výzkumných projektech.`, en: `A decentralized SETI program funded by the L6 fund — the community votes on research projects.` },
  orbitalMining: { cs: 'Orbital Mining', en: 'Orbital Mining' },
  orbitalMiningDesc: { cs: `Vesmírná těžba zdrojů — asteroidy, regolit. ZION jako ekonomická vrstva pro off-world operace.`, en: `Space resource mining — asteroids, regolith. ZION as the economic layer for off-world operations.` },

  stationArchitecture: { cs: 'Architektura stanice', en: 'Station architecture' },
  modularStation: { cs: 'Modulární stanice LEO', en: 'Modular LEO station' },
  stationBody: { cs: `Issobella je modulární platforma na oběžné dráze 400–550 km. Integruje ZION ekosystém s kosmickým výzkumem, umělou gravitací a kvantovými technologiemi.`, en: `Issobella is a modular platform in a 400–550 km orbit. It integrates the ZION ecosystem with space research, artificial gravity, and quantum technologies.` },
  stationMockupCaption: { cs: 'První koncept vizualizace stanice Issobella nad Zemí', en: 'First concept render of the Issobella station above Earth' },
  coreModule: { cs: 'Core Module', en: 'Core Module' },
  coreModuleDesc: { cs: 'Velení, komunikace, navigace, ADCS a ZION Space Node na radiačně odolném FPGA.', en: 'Command, communications, navigation, ADCS, and the ZION Space Node on radiation-hardened FPGA.' },
  scienceLab: { cs: 'Science Lab', en: 'Science Lab' },
  scienceLabDesc: { cs: 'Mikrogravitace pro materiály, biologii, farmacii a krystalografii.', en: 'Microgravity for materials, biology, pharmacy, and crystallography.' },
  habitationTorus: { cs: 'Habitation Torus', en: 'Habitation Torus' },
  habitationTorusDesc: { cs: 'Rotující torus pro 0,38 g bydlení; rehabilitační zóny pro 1,0 g.', en: 'A rotating torus for 0.38 g living; rehabilitation zones for 1.0 g.' },
  quantumMotorBay: { cs: 'Quantum Motor Bay', en: 'Quantum Motor Bay' },
  quantumMotorBayDesc: { cs: 'Bezpečné testování kvantového pohonu a energetiky s izolací a senzory.', en: 'Safe testing of quantum propulsion and power with isolation and sensors.' },
  dockingLogistics: { cs: 'Docking & Logistics', en: 'Docking & Logistics' },
  dockingLogisticsDesc: { cs: 'Zásobovací porty, sklad, robotická ruka a crew docking.', en: 'Supply ports, storage, robotic arm, and crew docking.' },

  artificialGravity: { cs: 'Umělá gravitace', en: 'Artificial gravity' },
  agBody: { cs: 'Rotace stanice vytváří odstředivé zrychlení. Nižší RPM znamená menší Coriolis a pohodlnější pobyt.', en: 'Station rotation creates centrifugal acceleration. Lower RPM means less Coriolis and a more comfortable stay.' },
  agFormula: { cs: 'a = ω² × r', en: 'a = ω² × r' },
  agRecommended: { cs: 'Doporučená konfigurace', en: 'Recommended configuration' },
  agMainTorus: { cs: 'Hlavní torus', en: 'Main torus' },
  agTorusValue: { cs: '200 m průměr, 0,38 g, ~2,1 RPM', en: '200 m diameter, 0.38 g, ~2.1 RPM' },
  agCentrifuge: { cs: 'Rehabilitační centrifuga', en: 'Rehab centrifuge' },
  agCentrifugeValue: { cs: 'r = 12 m, 1,0 g, 12 RPM', en: 'r = 12 m, 1.0 g, 12 RPM' },
  agMicroLab: { cs: 'Mikrogravity lab', en: 'Microgravity lab' },
  agMicroLabValue: { cs: 'U těžiště trusu pro volný pád', en: 'At the truss center of gravity for free fall' },

  quantumMotor: { cs: 'Kvantový motor', en: 'Quantum motor' },
  qmBody: { cs: 'Výzkumný program s otevřenými fyzikálními otázkami, jasnými milníky a bezpečnostními branami G0–G5.', en: 'A research program with open physics questions, clear milestones, and G0–G5 safety gates.' },
  qmPathA: { cs: 'Kvantová vakuová energie', en: 'Quantum vacuum energy' },
  qmPathADesc: { cs: 'Casimir / zero-point — laboratorně měřitelné, energetický zisk otevřený.', en: 'Casimir / zero-point — measurable in the lab, energy gain still open.' },
  qmPathB: { cs: 'Iontový / plazmový motor', en: 'Ion / plasma thruster' },
  qmPathBDesc: { cs: 'Kvantově řízená plazma s vysokým Isp pro station-keeping.', en: 'Quantum-controlled plasma with high Isp for station-keeping.' },
  qmPathC: { cs: 'Hall / VASIMR', en: 'Hall / VASIMR' },
  qmPathCDesc: { cs: 'Ověřené elektromagnetické trysky pro orbitální manévry.', en: 'Proven electromagnetic thrusters for orbital maneuvers.' },
  qmPathD: { cs: 'Makroskopická koherence', en: 'Macroscopic coherence' },
  qmPathDDesc: { cs: 'Spekulativní — BEC, supratekuté helium, spin ice. Desetiletí výzkumu.', en: 'Speculative — BEC, superfluid helium, spin ice. Decades of research.' },
  qmRoadmap: { cs: 'Vývojová roadmap', en: 'Development roadmap' },

  humanFactors: { cs: 'Lidské faktory', en: 'Human factors' },
  hfBody: { cs: 'Zdraví posádky je základní pilíř. Umělá gravitace je primární countermeasure proti atrofii, VIIP a kardiodekondicionování.', en: 'Crew health is the foundation. Artificial gravity is the primary countermeasure against atrophy, VIIP, and cardiovascular deconditioning.' },
  hfRisk: { cs: 'Riziko', en: 'Risk' },
  hfCountermeasure: { cs: 'Countermeasure', en: 'Countermeasure' },

  researchLibrary: { cs: 'Výzkumná knihovna', en: 'Research library' },
  researchLibraryBody: { cs: 'Veřejné výzkumné podklady pro orbitální stanici, kvantový motor, umělou gravitaci a lidské faktory.', en: 'Public research materials for the orbital station, quantum motor, artificial gravity, and human factors.' },

  timeline: { cs: 'Časová osa', en: 'Timeline' },
  timelineBody: { cs: 'Od CubeSatu k orbitální stanici — desetiletí otevřené vědy financované ZION DAO.', en: 'From CubeSat to orbital station — decades of open science funded by ZION DAO.' },

  bottomCta: { cs: 'Od blockchainu ke hvězdám', en: 'From blockchain to the stars' },
  bottomBody: { cs: 'Issobella je fyzickým ztělesněním Hiranyagarbhy — zlatého zárodku kosmického vědomí. ZION AI a L6 fond společně financují přesah hranic planety.', en: 'Issobella is the physical embodiment of Hiranyagarbha — the golden egg of cosmic consciousness. ZION AI and the L6 fund together finance the transcendence of planetary boundaries.' },
  learnMore: { cs: 'Více o L6 a ekosystému', en: 'Learn more about L6 and the ecosystem' },
  network: { cs: 'Síť', en: 'Network' },
} as const;

const ISSOBELLA_WALLET = 'zion1z4s3a54266f2x7j4x7c27297k49752t7k52l0f0';

const getMissions = (cs: boolean) => [
  {
    id: 'station',
    name: L6IssobellaCopy.orbitalStation[cs ? 'cs' : 'en'],
    phase: cs ? 'Vize 2040+' : 'Vision 2040+',
    desc: L6IssobellaCopy.orbitalStationDesc[cs ? 'cs' : 'en'],
    image: '/docs/l6/img/Von_braun_station_2.jpg',
    tags: cs ? ['Stanice', 'LEO', 'DAO'] : ['Station', 'LEO', 'DAO'],
    color: 'border-zion-purple/30 bg-zion-purple/5',
    badgeColor: 'border-zion-purple/30 bg-zion-purple/10 text-zion-purple',
  },
  {
    id: 'seti',
    name: L6IssobellaCopy.setiDeepResearch[cs ? 'cs' : 'en'],
    phase: cs ? 'Vize 2035+' : 'Vision 2035+',
    desc: L6IssobellaCopy.setiDesc[cs ? 'cs' : 'en'],
    image: '/docs/l6/img/torsss1.jpg',
    tags: cs ? ['SETI', 'Deep Space', 'Komunita'] : ['SETI', 'Deep Space', 'Community'],
    color: 'border-zion-cyan/30 bg-zion-cyan/5',
    badgeColor: 'border-zion-cyan/30 bg-zion-cyan/10 text-zion-cyan',
  },
  {
    id: 'mining',
    name: L6IssobellaCopy.orbitalMining[cs ? 'cs' : 'en'],
    phase: cs ? 'Vize 2045+' : 'Vision 2045+',
    desc: L6IssobellaCopy.orbitalMiningDesc[cs ? 'cs' : 'en'],
    image: '/docs/l6/img/oa9d8jviznw51.jpg',
    tags: cs ? ['Asteroidy', 'Regolit', 'Ekonomika'] : ['Asteroids', 'Regolith', 'Economy'],
    color: 'border-zion-gold/30 bg-zion-gold/5',
    badgeColor: 'border-zion-gold/30 bg-zion-gold/10 text-zion-gold',
  },
];

const getModules = (cs: boolean) => [
  {
    title: L6IssobellaCopy.coreModule[cs ? 'cs' : 'en'],
    desc: L6IssobellaCopy.coreModuleDesc[cs ? 'cs' : 'en'],
    icon: Cpu,
    color: 'text-zion-cyan',
  },
  {
    title: L6IssobellaCopy.scienceLab[cs ? 'cs' : 'en'],
    desc: L6IssobellaCopy.scienceLabDesc[cs ? 'cs' : 'en'],
    icon: Microscope,
    color: 'text-zion-purple',
  },
  {
    title: L6IssobellaCopy.habitationTorus[cs ? 'cs' : 'en'],
    desc: L6IssobellaCopy.habitationTorusDesc[cs ? 'cs' : 'en'],
    icon: Orbit,
    color: 'text-zion-gold',
  },
  {
    title: L6IssobellaCopy.quantumMotorBay[cs ? 'cs' : 'en'],
    desc: L6IssobellaCopy.quantumMotorBayDesc[cs ? 'cs' : 'en'],
    icon: Atom,
    color: 'text-zion-cyan',
  },
  {
    title: L6IssobellaCopy.dockingLogistics[cs ? 'cs' : 'en'],
    desc: L6IssobellaCopy.dockingLogisticsDesc[cs ? 'cs' : 'en'],
    icon: Anchor,
    color: 'text-zion-purple',
  },
];

const getAgRows = (cs: boolean) => [
  { g: '1,0 g', r: '100 m', rpm: '3,0', delta: '~0,04 g' },
  { g: '0,5 g', r: '100 m', rpm: '2,1', delta: '~0,02 g' },
  { g: '0,38 g', r: '100 m', rpm: '1,9', delta: '~0,015 g' },
  { g: '1,0 g', r: '200 m', rpm: '2,1', delta: '~0,02 g' },
  { g: '0,38 g', r: '200 m', rpm: '1,3', delta: '~0,008 g' },
];

const getAgConfig = (cs: boolean) => [
  { label: L6IssobellaCopy.agMainTorus[cs ? 'cs' : 'en'], value: L6IssobellaCopy.agTorusValue[cs ? 'cs' : 'en'], icon: Orbit },
  { label: L6IssobellaCopy.agCentrifuge[cs ? 'cs' : 'en'], value: L6IssobellaCopy.agCentrifugeValue[cs ? 'cs' : 'en'], icon: Gauge },
  { label: L6IssobellaCopy.agMicroLab[cs ? 'cs' : 'en'], value: L6IssobellaCopy.agMicroLabValue[cs ? 'cs' : 'en'], icon: Microscope },
];

const getQuantumTracks = (cs: boolean) => [
  {
    name: L6IssobellaCopy.qmPathA[cs ? 'cs' : 'en'],
    desc: L6IssobellaCopy.qmPathADesc[cs ? 'cs' : 'en'],
    trl: 'TRL 1–2',
    icon: Atom,
    color: 'text-zion-purple',
    accent: 'border-zion-purple/30 bg-zion-purple/5',
    badge: 'border-zion-purple/30 bg-zion-purple/10 text-zion-purple',
  },
  {
    name: L6IssobellaCopy.qmPathB[cs ? 'cs' : 'en'],
    desc: L6IssobellaCopy.qmPathBDesc[cs ? 'cs' : 'en'],
    trl: 'TRL 4–6',
    icon: Zap,
    color: 'text-zion-cyan',
    accent: 'border-zion-cyan/30 bg-zion-cyan/5',
    badge: 'border-zion-cyan/30 bg-zion-cyan/10 text-zion-cyan',
  },
  {
    name: L6IssobellaCopy.qmPathC[cs ? 'cs' : 'en'],
    desc: L6IssobellaCopy.qmPathCDesc[cs ? 'cs' : 'en'],
    trl: 'TRL 5–7',
    icon: Flame,
    color: 'text-zion-gold',
    accent: 'border-zion-gold/30 bg-zion-gold/5',
    badge: 'border-zion-gold/30 bg-zion-gold/10 text-zion-gold',
  },
  {
    name: L6IssobellaCopy.qmPathD[cs ? 'cs' : 'en'],
    desc: L6IssobellaCopy.qmPathDDesc[cs ? 'cs' : 'en'],
    trl: 'TRL 1',
    icon: Sparkles,
    color: 'text-zion-purple',
    accent: 'border-zion-purple/30 bg-zion-purple/5',
    badge: 'border-zion-purple/30 bg-zion-purple/10 text-zion-purple',
  },
];

const getQuantumRoadmap = (cs: boolean) => [
  { year: '2030', label: cs ? 'L5 laboratoř — základní testy' : 'L5 lab — baseline tests', status: 'planned' },
  { year: '2033', label: cs ? 'První demonstrátor kvantového generátoru' : 'First quantum generator demonstrator', status: 'planned' },
  { year: '2035', label: cs ? 'CubeSat s iontovým / plazmovým pohonem' : 'CubeSat with ion/plasma thruster', status: 'planned' },
  { year: '2037', label: cs ? 'Open-source release hardwarových specifikací' : 'Open-source hardware specs release', status: 'planned' },
  { year: '2045', label: cs ? 'Výroba komponent stanice s kvantovou energií' : 'Station components with quantum power', status: 'vision' },
  { year: '2050+', label: cs ? 'Integrace na Issobella' : 'Integration on Issobella', status: 'vision' },
];

const getHumanRisks = (cs: boolean) => [
  { risk: cs ? 'Svalová atrofie' : 'Muscle atrophy', icon: Activity, measure: cs ? '0,38 g bydlení + cvičení' : '0.38 g living + exercise' },
  { risk: cs ? 'Ztráta kostní hmoty' : 'Bone loss', icon: Scale, measure: cs ? 'Umělá gravitace + vápník + vitamín D' : 'Artificial gravity + calcium + vitamin D' },
  { risk: 'VIIP', icon: Eye, measure: cs ? 'Umělá gravitace + monitoring tlaku' : 'Artificial gravity + pressure monitoring' },
  { risk: cs ? 'Kardiobevaskulární deconditioning' : 'Cardiovascular deconditioning', icon: Heart, measure: cs ? '0,38 g torus + centrifuga 1,0 g' : '0.38 g torus + 1.0 g centrifuge' },
  { risk: cs ? 'Radiace (GCR / SPE)' : 'Radiation (GCR / SPE)', icon: Shield, measure: cs ? 'Stínění, magnetický štít, LH2 tanky' : 'Shielding, magnetic shield, LH2 tanks' },
  { risk: cs ? 'Psychická zátěž' : 'Psychological stress', icon: Brain, measure: cs ? 'Zelené zóny, soukromí, rituály, telemedicína' : 'Green zones, privacy, rituals, telemedicine' },
];

const getLibraryDocs = (cs: boolean) => [
  { id: 'l6-readme', title: cs ? 'L6 — přehled' : 'L6 Overview', file: 'README.md', desc: cs ? 'Úvod do vize, financování a filosofie L6.' : 'Introduction to the L6 vision, funding, and philosophy.', icon: BookOpen },
  { id: 'l6-architecture', title: cs ? 'Architektura stanice' : 'Station architecture', file: 'Architektura.md', desc: cs ? 'Moduly, parametry, ZION Space Node, ECLSS.' : 'Modules, parameters, ZION Space Node, ECLSS.', icon: Satellite },
  { id: 'l6-quantum-motor', title: cs ? 'Kvantový motor' : 'Quantum motor', file: 'Kvantovy_Motor.md', desc: cs ? 'Výzkumné cesty, TRL, bezpečnostní brány, roadmap.' : 'Research paths, TRL, safety gates, roadmap.', icon: Atom },
  { id: 'l6-artificial-gravity', title: cs ? 'Umělá gravitace' : 'Artificial gravity', file: 'Umela_Gravitace.md', desc: cs ? 'Fyzika rotace, konfigurace, Coriolis, design.' : 'Physics of rotation, configurations, Coriolis, design.', icon: Orbit },
  { id: 'l6-human-factors', title: cs ? 'Lidské faktory' : 'Human factors', file: 'Lidske_Faktory.md', desc: cs ? 'Biomedicína, psychologie, ECLSS, etika.' : 'Biomedicine, psychology, ECLSS, ethics.', icon: Heart },
  { id: 'l6-history', title: cs ? 'Historie stanic' : 'Station history', file: 'Histori.md', desc: cs ? 'Von Braun, ISS, Skylab, Saljut, Freedom.' : 'Von Braun, ISS, Skylab, Saljut, Freedom.', icon: Clock },
];

const getTimeline = (cs: boolean) => [
  { year: '2026–2030', title: cs ? 'Feasibility & CubeSat' : 'Feasibility & CubeSat', body: cs ? 'Studie proveditelnosti, první CubeSaty, L5 laboratoř.' : 'Feasibility studies, first CubeSats, L5 lab.' },
  { year: '2030–2040', title: cs ? 'Kvantový generátor' : 'Quantum generator', body: cs ? 'Demonstrátory, LEO test modul, open-source hardware.' : 'Demonstrators, LEO test module, open-source hardware.' },
  { year: '2040–2050', title: cs ? 'Design & výroba' : 'Design & manufacturing', body: cs ? 'První moduly stanice, spin-up, 0,38 g validace.' : 'First station modules, spin-up, 0.38 g validation.' },
  { year: '2050–2076', title: cs ? 'Rozšíření & deep-space' : 'Expansion & deep-space', body: cs ? 'Rozšíření stanice, mezihvězdná síť, AI/Hiran.' : 'Station expansion, interstellar network, AI/Hiran.' },
  { year: '2126+', title: cs ? 'Tail emission' : 'Tail emission', body: cs ? '724,78 ZION/blok navždy — věčný L6 fond.' : '724.78 ZION/block forever — perpetual L6 fund.' },
];

export default function L6IssobellaPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const missions = getMissions(cs);
  const modules = getModules(cs);
  const agRows = getAgRows(cs);
  const agConfig = getAgConfig(cs);
  const qmTracks = getQuantumTracks(cs);
  const qmRoadmap = getQuantumRoadmap(cs);
  const humanRisks = getHumanRisks(cs);
  const libraryDocs = getLibraryDocs(cs);
  const timeline = getTimeline(cs);

  return (
    <div className="zion-page overflow-x-hidden">
      <div className="zion-container max-w-7xl space-y-20 pb-24">

        {/* ── HERO ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="zion-rainbow-card relative flex flex-col overflow-hidden p-0"
          style={{ '--rc': '147, 51, 234' } as React.CSSProperties}
        >
          <div className="relative z-10 bg-black/50 p-6 md:p-10 lg:p-14">
            <div className="max-w-3xl space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-zion-purple/40 bg-zion-purple/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-purple uppercase">
                <Rocket className="h-4 w-4" />
                {L6IssobellaCopy.badge[cs ? 'cs' : 'en']}
              </div>

              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-gray-400">
                  {L6IssobellaCopy.spaceLayer[cs ? 'cs' : 'en']}
                </p>
                <h1 className="zion-page-heading text-gradient leading-tight">
                  {L6IssobellaCopy.title[cs ? 'cs' : 'en']}
                  <span className="text-white"> {L6IssobellaCopy.titleAccent[cs ? 'cs' : 'en']}</span>
                </h1>
              </div>
            </div>
          </div>

          <div className="relative w-full aspect-video max-h-[80vh]">
            <Image
              src="/docs/l6/img/Issabela1stSkelet.png"
              alt={cs ? 'ZION Issobella — koncept orbitální stanice' : 'ZION Issobella — orbital station concept'}
              fill
              priority
              sizes="(max-width: 1280px) 100vw, 1280px"
              quality={90}
              className="object-contain object-center"
            />
          </div>

          <div className="relative z-10 bg-black/50 p-6 md:p-10 lg:p-14">
            <div className="max-w-3xl space-y-6">
              <p className="text-lg text-gray-300">
                {L6IssobellaCopy.heroBody[cs ? 'cs' : 'en']}
              </p>

              <div className="flex flex-wrap gap-3 text-xs">
                <span className="inline-flex items-center gap-2 rounded-full border border-zion-purple/30 bg-zion-purple/10 px-4 py-2 text-purple-200">
                  <Star className="h-3 w-3" /> {L6IssobellaCopy.k5OfEveryBlock[cs ? 'cs' : 'en']}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-zion-cyan/30 bg-zion-cyan/10 px-4 py-2 text-cyan-200">
                  <CheckCircle2 className="h-3 w-3" /> {L6IssobellaCopy.approxMonth[cs ? 'cs' : 'en']}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <Clock className="h-3 w-3" /> {L6IssobellaCopy.unlockedBlock[cs ? 'cs' : 'en']}
                </span>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/docs#l6-issobella"
                  className="zion-rainbow-sub inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                  style={{ '--rc': '147, 51, 234' } as React.CSSProperties}
              >
                  <BookOpen className="h-4 w-4 text-zion-cyan" />
                  {L6IssobellaCopy.ctaDocs[cs ? 'cs' : 'en']}
                  <ChevronRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/dao"
                  className="inline-flex items-center gap-2 rounded-2xl border border-zion-gold/30 bg-zion-gold/5 px-6 py-3 text-sm font-semibold text-amber-200 transition-colors hover:bg-zion-gold/10"
                >
                  <Crown className="h-4 w-4 text-zion-gold" />
                  {L6IssobellaCopy.ctaDao[cs ? 'cs' : 'en']}
                </Link>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ── FUND ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="zion-rainbow-card p-8"
          style={{ '--rc': '6, 182, 212' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{L6IssobellaCopy.spaceFund[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Wallet className="h-7 w-7 text-zion-cyan" />
              {L6IssobellaCopy.fundTitle[cs ? 'cs' : 'en']}
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="zion-rainbow-sub p-4 text-center" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">{L6IssobellaCopy.blockShare[cs ? 'cs' : 'en']}</p>
              <p className="text-4xl font-bold text-zion-cyan">5%</p>
              <p className="text-xs text-gray-500 mt-1">{L6IssobellaCopy.everyBlockForever[cs ? 'cs' : 'en']}</p>
            </div>
            <div className="zion-rainbow-sub p-4 text-center" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">{L6IssobellaCopy.approxMonth[cs ? 'cs' : 'en']}</p>
              <p className="text-4xl font-bold text-zion-gold">~11,7M</p>
              <p className="text-xs text-gray-500 mt-1">ZION</p>
            </div>
            <div className="zion-rainbow-sub p-4 text-center" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">{L6IssobellaCopy.governedBy[cs ? 'cs' : 'en']}</p>
              <p className="text-3xl font-bold text-zion-cyan">DAO</p>
              <p className="text-xs text-gray-500 mt-1">{L6IssobellaCopy.l6Council[cs ? 'cs' : 'en']}</p>
            </div>
          </div>

          <div className="zion-rainbow-sub p-4 text-sm text-gray-400 font-mono break-all" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
            <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">{L6IssobellaCopy.fundWallet[cs ? 'cs' : 'en']}</p>
            {ISSOBELLA_WALLET}
          </div>
        </motion.section>

        {/* ── MISSIONS ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{L6IssobellaCopy.missionsAndVision[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Compass className="h-7 w-7 text-zion-purple" />
              {L6IssobellaCopy.cosmicMissions[cs ? 'cs' : 'en']}
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {missions.map((mission) => (
              <div
                key={mission.name}
                className={`zion-rainbow-card overflow-hidden p-0 ${mission.color}`}
                style={{ '--rc': '147, 51, 234' } as React.CSSProperties}
              >
                <div className="relative h-44 overflow-hidden">
                  <img
                    src={mission.image}
                    alt={mission.name}
                    width={600}
                    height={350}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                  <span className={`absolute right-3 top-3 text-[10px] uppercase tracking-widest px-2 py-1 rounded-full font-semibold border ${mission.badgeColor}`}>
                    {mission.phase}
                  </span>
                </div>
                <div className="p-5">
                  <h3 className="font-semibold text-white mb-2">{mission.name}</h3>
                  <p className="text-sm text-gray-400 mb-4">{mission.desc}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {mission.tags.map((tag) => (
                      <span key={tag} className="text-[10px] rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-gray-400">{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── STATION ARCHITECTURE ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="zion-rainbow-card p-8"
          style={{ '--rc': '251, 191, 36' } as React.CSSProperties}
        >
          <div className="grid lg:grid-cols-2 gap-8 items-start">
            <div className="space-y-5">
              <div className="flex flex-col gap-2">
                <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{L6IssobellaCopy.stationArchitecture[cs ? 'cs' : 'en']}</p>
                <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
                  <Satellite className="h-7 w-7 text-zion-gold" />
                  {L6IssobellaCopy.modularStation[cs ? 'cs' : 'en']}
                </h2>
              </div>
              <p className="text-lg text-gray-300">
                {L6IssobellaCopy.stationBody[cs ? 'cs' : 'en']}
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                {modules.map((m) => (
                  <div key={m.title} className="zion-rainbow-sub p-4" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
                    <div className="flex items-center gap-2 mb-2">
                      <m.icon className={`h-5 w-5 ${m.color}`} />
                      <h3 className="font-semibold text-white">{m.title}</h3>
                    </div>
                    <p className="text-sm text-gray-400">{m.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <L6StationPreviewLazy lang={cs ? 'cs' : 'en'} className="w-full rounded-2xl" />
              <figure className="space-y-2">
                <Image
                  src="/docs/l6/img/1stMock.png"
                  alt={cs ? 'První vizualizace stanice Issobella' : 'First visualization of the Issobella station'}
                  width={1200}
                  height={675}
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  quality={85}
                  loading="lazy"
                  className="w-full h-auto rounded-2xl border border-white/10"
                />
                <figcaption className="text-center text-[10px] uppercase tracking-widest text-gray-500">
                  {L6IssobellaCopy.stationMockupCaption[cs ? 'cs' : 'en']}
                </figcaption>
              </figure>
            </div>
          </div>
        </motion.section>

        {/* ── ARTIFICIAL GRAVITY ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="zion-rainbow-card p-8"
          style={{ '--rc': '147, 51, 234' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{L6IssobellaCopy.artificialGravity[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Orbit className="h-7 w-7 text-zion-purple" />
              {L6IssobellaCopy.artificialGravity[cs ? 'cs' : 'en']}
            </h2>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            <div className="space-y-5">
              <p className="text-lg text-gray-300">
                {L6IssobellaCopy.agBody[cs ? 'cs' : 'en']}
              </p>
              <div className="rounded-2xl border border-zion-purple/30 bg-zion-purple/5 p-4 text-center font-mono text-zion-purple">
                {L6IssobellaCopy.agFormula[cs ? 'cs' : 'en']}
              </div>

              <div className="overflow-hidden rounded-2xl border border-white/10">
                <table className="w-full text-sm">
                  <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-gray-400">
                    <tr>
                      <th className="p-3">g</th>
                      <th className="p-3">r</th>
                      <th className="p-3">RPM</th>
                      <th className="p-3">Δg (2 m)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-gray-300">
                    {agRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-white/5">
                        <td className="p-3 font-semibold text-zion-cyan">{row.g}</td>
                        <td className="p-3">{row.r}</td>
                        <td className="p-3">{row.rpm}</td>
                        <td className="p-3 text-gray-400">{row.delta}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-5">
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                <img
                  src="/docs/l6/img/Von_braun_station_2.jpg"
                    alt={cs ? 'Rotační orbitální stanice' : 'Rotating orbital station'}
                    width={900}
                    height={700}
                    loading="lazy"
                    decoding="async"
                    className="w-full object-cover"
                  />
              </div>

              <div className="zion-rainbow-sub p-5" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
                <p className="text-xs uppercase tracking-wider text-gray-500 mb-3">{L6IssobellaCopy.agRecommended[cs ? 'cs' : 'en']}</p>
                <div className="space-y-3">
                  {agConfig.map((cfg) => (
                    <div key={cfg.label} className="flex items-start gap-3">
                      <cfg.icon className="h-5 w-5 text-zion-gold mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-white">{cfg.label}</p>
                        <p className="text-sm text-gray-400">{cfg.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ── QUANTUM MOTOR ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="zion-rainbow-card p-8"
          style={{ '--rc': '6, 182, 212' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{L6IssobellaCopy.quantumMotor[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Atom className="h-7 w-7 text-zion-cyan" />
              {L6IssobellaCopy.quantumMotor[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400">{L6IssobellaCopy.qmBody[cs ? 'cs' : 'en']}</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {qmTracks.map((track) => (
              <div key={track.name} className={`zion-rainbow-sub p-5 ${track.accent}`} style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
                <div className="flex items-start justify-between mb-3">
                  <track.icon className={`h-6 w-6 ${track.color}`} />
                  <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full font-semibold border ${track.badge}`}>{track.trl}</span>
                </div>
                <h3 className="font-semibold text-white mb-2">{track.name}</h3>
                <p className="text-sm text-gray-400">{track.desc}</p>
              </div>
            ))}
          </div>

          <div className="zion-rainbow-sub p-5" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
            <p className="text-xs uppercase tracking-wider text-gray-500 mb-4">{L6IssobellaCopy.qmRoadmap[cs ? 'cs' : 'en']}</p>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {qmRoadmap.map((item, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zion-cyan/30 bg-zion-cyan/10 text-[10px] font-bold text-zion-cyan leading-none text-center">
                    {item.year}
                  </div>
                  <p className="text-sm text-gray-400">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ── HUMAN FACTORS ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="zion-rainbow-card p-8"
          style={{ '--rc': '236, 72, 153' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{L6IssobellaCopy.humanFactors[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Heart className="h-7 w-7 text-pink-400" />
              {L6IssobellaCopy.humanFactors[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400">{L6IssobellaCopy.hfBody[cs ? 'cs' : 'en']}</p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-gray-400">
                <tr>
                  <th className="p-3">{L6IssobellaCopy.hfRisk[cs ? 'cs' : 'en']}</th>
                  <th className="p-3">{L6IssobellaCopy.hfCountermeasure[cs ? 'cs' : 'en']}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-gray-300">
                {humanRisks.map((row, idx) => (
                  <tr key={idx} className="hover:bg-white/5">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <row.icon className="h-4 w-4 text-zion-purple" />
                        <span className="font-semibold text-white">{row.risk}</span>
                      </div>
                    </td>
                    <td className="p-3 text-gray-400">{row.measure}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.section>

        {/* ── RESEARCH LIBRARY ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{L6IssobellaCopy.researchLibrary[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <BookOpen className="h-7 w-7 text-zion-cyan" />
              {L6IssobellaCopy.researchLibrary[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400">{L6IssobellaCopy.researchLibraryBody[cs ? 'cs' : 'en']}</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {libraryDocs.map((doc) => (
              <Link
                key={doc.id}
                href={`/docs#${doc.id}`}
                className="zion-rainbow-sub group block p-5 transition-colors hover:bg-white/5"
                style={{ '--rc': '6, 182, 212' } as React.CSSProperties}
              >
                <div className="flex items-center justify-between mb-3">
                  <doc.icon className="h-6 w-6 text-zion-cyan" />
                  <ChevronRight className="h-4 w-4 text-gray-500 transition-transform group-hover:translate-x-1" />
                </div>
                <h3 className="font-semibold text-white mb-2">{doc.title}</h3>
                <p className="text-sm text-gray-400">{doc.desc}</p>
              </Link>
            ))}
          </div>
        </motion.section>

        {/* ── TIMELINE ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="zion-rainbow-card p-8"
          style={{ '--rc': '251, 191, 36' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{L6IssobellaCopy.timeline[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Clock className="h-7 w-7 text-zion-gold" />
              {L6IssobellaCopy.timeline[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400">{L6IssobellaCopy.timelineBody[cs ? 'cs' : 'en']}</p>
          </div>

          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-px bg-zion-gold/30 md:left-1/2" />
            <div className="space-y-8">
              {timeline.map((item, idx) => (
                <div key={idx} className={`relative flex flex-col gap-2 md:flex-row ${idx % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'}`}>
                  <div className="md:w-1/2 md:px-8" />
                  <div className="absolute left-4 top-0 h-3 w-3 rounded-full bg-zion-gold ring-4 ring-black md:left-1/2 md:-translate-x-1.5" />
                  <div className="pl-10 md:w-1/2 md:pl-0 md:px-8">
                    <div className="zion-rainbow-sub p-5" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
                      <p className="text-xs font-bold text-zion-gold uppercase tracking-wider">{item.year}</p>
                      <h3 className="font-semibold text-white mb-1">{item.title}</h3>
                      <p className="text-sm text-gray-400">{item.body}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ── BOTTOM CTA ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="zion-cta-banner"
        >
          <Sparkles className="h-12 w-12 text-zion-purple mx-auto mb-4" />
          <h2 className="text-3xl font-semibold text-white mb-4">Hiranyagarbha · {L6IssobellaCopy.bottomCta[cs ? 'cs' : 'en']}</h2>
          <p className="text-gray-300 max-w-2xl mx-auto text-lg">
            {L6IssobellaCopy.bottomBody[cs ? 'cs' : 'en']}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <Link href="/docs#l6-issobella" className="zion-rainbow-sub inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
              <BookOpen className="h-4 w-4 text-zion-cyan" />
              {L6IssobellaCopy.ctaDocs[cs ? 'cs' : 'en']}
            </Link>
            <Link href="/dao" className="zion-rainbow-sub inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
              <Crown className="h-4 w-4 text-zion-gold" />
              {L6IssobellaCopy.ctaDao[cs ? 'cs' : 'en']}
            </Link>
            <Link href="/network" className="zion-rainbow-sub inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
              <Globe2 className="h-4 w-4 text-zion-cyan" />
              {L6IssobellaCopy.network[cs ? 'cs' : 'en']}
            </Link>
            <Link href="/l5-free-world" className="inline-flex items-center gap-2 rounded-2xl border border-zion-gold/30 bg-zion-gold/5 px-6 py-3 text-sm font-semibold text-amber-200 hover:bg-zion-gold/10 transition-colors">
              L5 Free World <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </motion.section>

      </div>
    </div>
  );
}
