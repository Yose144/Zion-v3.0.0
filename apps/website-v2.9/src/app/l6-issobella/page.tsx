'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import {
  Rocket, Star, Globe2, Wallet, Shield, Sparkles, ArrowRight,
  CheckCircle2, Clock, Heart, Zap, Crown, BookOpen, FileText,
  Satellite, Orbit, Microscope, Atom, Magnet, Radar, Flame,
  Activity, Eye, Brain, Sun, Moon, Target, Users, Anchor,
  Cpu, Radio, Scale, ChevronRight, Compass, Gauge, Leaf
} from 'lucide-react';
import { useLang, type Lang } from '@/contexts/LanguageContext';
import { tx5, t5 } from '@/lib/i18n-tx';
import L6StationPreviewLazy from '@/components/L6StationPreviewLazy';
import FundBalance, { BalanceText } from '@/components/FundBalance';

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
  unlockedBlock: { cs: 'Genesis fond 2,5 mld · time-lock blok 144 000', en: '2.5B genesis fund · time-locked until block 144,000' },

  spaceFund: { cs: 'Vesmírný fond', en: 'Space Fund' },
  fundTitle: { cs: 'Fond L6 Issobella', en: 'L6 Issobella Fund' },
  blockShare: { cs: 'Podíl z bloku', en: 'Block share' },
  everyBlockForever: { cs: 'každý blok, navždy', en: 'every block, forever' },
  governedBy: { cs: 'Správa', en: 'Governed by' },
  l6Council: { cs: 'L6 Rada', en: 'L6 Council' },
  fundWallet: { cs: 'Adresa fondu', en: 'Fund wallet' },
  genesisPremine: { cs: 'Genesis alokace', en: 'Genesis allocation' },
  genesisPremineAmount: { cs: '2,5 mld ZION', en: '2.5B ZION' },
  genesisPremineDesc: { cs: 'Premine slot 6 — převeden z DAO Treasury (Community Governance) na L6 Issobella. Time-lock do bloku 144 000 + admin multisig (3-of-3) + DAO vote.', en: 'Premine slot 6 — repurposed from DAO Treasury (Community Governance) to L6 Issobella. Time-locked until block 144,000 + admin multisig (3-of-3) + DAO vote.' },
  liveBalance: { cs: 'Aktuální zůstatek', en: 'Live balance' },

  missionsAndVision: { cs: 'Mise & vize', en: 'Missions & vision' },
  cosmicMissions: { cs: 'Kosmické mise', en: 'Cosmic missions' },
  orbitalStation: { cs: 'Orbitální stanice', en: 'Orbital station' },
  orbitalStationDesc: { cs: `ZION Issobella — decentralizovaná orbitální stanice financovaná block reward fondem. Výzkum, věda a Overview Effect.`, en: `ZION Issobella — a decentralized orbital station funded by block reward. Research, science, and the Overview Effect.` },
  setiDeepResearch: { cs: 'SETI + Deep Research', en: 'SETI + Deep Research' },
  setiDesc: { cs: `Decentralizovaný SETI program financovaný L6 fondem — komunita hlasuje o výzkumných projektech.`, en: `A decentralized SETI program funded by the L6 fund — the community votes on research projects.` },
  orbitalMining: { cs: 'Orbital Mining', en: 'Orbital Mining' },
  orbitalMiningDesc: { cs: `Vesmírná těžba zdrojů — asteroidy, regolit. ZION jako ekonomická vrstva pro off-world operace.`, en: `Space resource mining — asteroids, regolith. ZION as the economic layer for off-world operations.` },
  groundStation: { cs: 'Pozemní stanice Kostarika', en: 'Costa Rica Ground Station' },
  groundStationDesc: { cs: `První fyzická stopa L6 na Zemi — výzkumný kampus, TT&C antény a observatoř na středobodu Amerik, na pozemku sdíleném s L5 komunitou Nová Amerika.`, en: `The first physical footprint of L6 on Earth — a research campus, TT&C antennas and an observatory at the midpoint of the Americas, on land shared with the L5 community Nová Amerika.` },

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

  study02Subtitle: { cs: 'Koncepční studie 02', en: 'Concept study 02' },
  study02Title: { cs: 'Řezy a interiéry — zahradní město', en: 'Sections & interiors — garden city' },
  study02Body: { cs: 'Druhá koncepční deska Issobelly: průřez prstencové stanice s botanickými kopulemi, promenádou, kajutami, jídelnou, laboratořemi a centrálním uzlem — doplněná řezy obytného sektoru a uzlu.', en: 'The second Issobella concept board: a cutaway of the ring station with botanical domes, a promenade, cabins, a dining hall, labs and a central node — with sections of the residential sector and the node.' },
  study02Note: { cs: 'Umělecká architektonická vize — dispozice i umělá gravitace jsou k ověření; na oběžné dráze zatím žádný modul není.', en: 'An artistic architectural vision — the layout and artificial gravity are still to be verified; no module is in orbit yet.' },

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
const ISSOBELLA_PREMINE_WALLET = 'zion1f5h5k6t8q3t3d8c5y667z6p2x8t3y3p8c7633g5';

const HERO_STARS = [
  { x: 6, y: 18, size: 2, d: 2.4, delay: 0 },
  { x: 14, y: 42, size: 1.5, d: 3.2, delay: 0.4 },
  { x: 24, y: 10, size: 2, d: 2.8, delay: 0.9 },
  { x: 38, y: 30, size: 1.5, d: 3.6, delay: 0.2 },
  { x: 52, y: 12, size: 2, d: 2.6, delay: 1.1 },
  { x: 66, y: 40, size: 1.5, d: 3.4, delay: 0.6 },
  { x: 78, y: 18, size: 2, d: 2.9, delay: 0.8 },
  { x: 88, y: 36, size: 1.5, d: 3.1, delay: 0.3 },
  { x: 94, y: 8, size: 2, d: 2.5, delay: 1.4 },
  { x: 32, y: 58, size: 1.5, d: 3.3, delay: 1.0 },
  { x: 70, y: 64, size: 1.5, d: 2.7, delay: 0.5 },
] as const;

const getMissions = (cs: boolean, lang: Lang) => [
  {
    id: 'ground',
    name: tx5(L6IssobellaCopy.groundStation, lang),
    phase: cs ? 'Vize 2027+' : t5('Vision 2027+', lang),
    desc: tx5(L6IssobellaCopy.groundStationDesc, lang),
    image: '/images/l6-issobella/ground-station.webp',
    tags: cs ? ['Kostarika', 'TT&C', 'Observatoř'] : ['Costa Rica', 'TT&C', 'Observatory'],
    color: 'border-teal-400/30 bg-teal-400/5',
    badgeColor: 'border-teal-400/30 bg-teal-400/10 text-teal-300',
  },
  {
    id: 'station',
    name: tx5(L6IssobellaCopy.orbitalStation, lang),
    phase: cs ? 'Vize 2040+' : t5('Vision 2040+', lang),
    desc: tx5(L6IssobellaCopy.orbitalStationDesc, lang),
    image: '/images/l6-issobella/artificial-gravity.webp',
    tags: cs ? ['Stanice', 'LEO', 'DAO'] : ['Station', 'LEO', 'DAO'],
    color: 'border-zion-purple/30 bg-zion-purple/5',
    badgeColor: 'border-zion-purple/30 bg-zion-purple/10 text-zion-purple',
  },
  {
    id: 'seti',
    name: tx5(L6IssobellaCopy.setiDeepResearch, lang),
    phase: cs ? 'Vize 2035+' : t5('Vision 2035+', lang),
    desc: tx5(L6IssobellaCopy.setiDesc, lang),
    image: '/images/l6-issobella/seti-observatory.webp',
    tags: cs ? ['SETI', 'Deep Space', 'Komunita'] : ['SETI', 'Deep Space', 'Community'],
    color: 'border-zion-cyan/30 bg-zion-cyan/5',
    badgeColor: 'border-zion-cyan/30 bg-zion-cyan/10 text-zion-cyan',
  },
  {
    id: 'mining',
    name: tx5(L6IssobellaCopy.orbitalMining, lang),
    phase: cs ? 'Vize 2045+' : t5('Vision 2045+', lang),
    desc: tx5(L6IssobellaCopy.orbitalMiningDesc, lang),
    image: '/images/l6-issobella/mining-asteroid.webp',
    tags: cs ? ['Asteroidy', 'Regolit', 'Ekonomika'] : ['Asteroids', 'Regolith', 'Economy'],
    color: 'border-zion-gold/30 bg-zion-gold/5',
    badgeColor: 'border-zion-gold/30 bg-zion-gold/10 text-zion-gold',
  },
];

const getModules = (cs: boolean, lang: Lang) => [
  {
    title: tx5(L6IssobellaCopy.coreModule, lang),
    desc: tx5(L6IssobellaCopy.coreModuleDesc, lang),
    icon: Cpu,
    color: 'text-zion-cyan',
  },
  {
    title: tx5(L6IssobellaCopy.scienceLab, lang),
    desc: tx5(L6IssobellaCopy.scienceLabDesc, lang),
    icon: Microscope,
    color: 'text-zion-purple',
  },
  {
    title: tx5(L6IssobellaCopy.habitationTorus, lang),
    desc: tx5(L6IssobellaCopy.habitationTorusDesc, lang),
    icon: Orbit,
    color: 'text-zion-gold',
  },
  {
    title: tx5(L6IssobellaCopy.quantumMotorBay, lang),
    desc: tx5(L6IssobellaCopy.quantumMotorBayDesc, lang),
    icon: Atom,
    color: 'text-zion-cyan',
  },
  {
    title: tx5(L6IssobellaCopy.dockingLogistics, lang),
    desc: tx5(L6IssobellaCopy.dockingLogisticsDesc, lang),
    icon: Anchor,
    color: 'text-zion-purple',
  },
];

const getAgRows = (cs: boolean, lang: Lang) => [
  { g: '1,0 g', r: '100 m', rpm: '3,0', delta: '~0,04 g' },
  { g: '0,5 g', r: '100 m', rpm: '2,1', delta: '~0,02 g' },
  { g: '0,38 g', r: '100 m', rpm: '1,9', delta: '~0,015 g' },
  { g: '1,0 g', r: '200 m', rpm: '2,1', delta: '~0,02 g' },
  { g: '0,38 g', r: '200 m', rpm: '1,3', delta: '~0,008 g' },
];

const getAgConfig = (cs: boolean, lang: Lang) => [
  { label: tx5(L6IssobellaCopy.agMainTorus, lang), value: tx5(L6IssobellaCopy.agTorusValue, lang), icon: Orbit },
  { label: tx5(L6IssobellaCopy.agCentrifuge, lang), value: tx5(L6IssobellaCopy.agCentrifugeValue, lang), icon: Gauge },
  { label: tx5(L6IssobellaCopy.agMicroLab, lang), value: tx5(L6IssobellaCopy.agMicroLabValue, lang), icon: Microscope },
];

const getStudy02Zones = (cs: boolean, lang: Lang) => [
  { name: cs ? 'Botanické kopule' : t5('Botanical domes', lang), detail: cs ? 'Uzavřené ekosystémy' : t5('Closed ecosystems', lang) },
  { name: cs ? 'Promenáda' : t5('Promenade', lang), detail: cs ? 'Obytný okruh' : t5('The residential circuit', lang) },
  { name: cs ? 'Obytné moduly' : t5('Residential modules', lang), detail: cs ? 'Kajuty a apartmány' : t5('Cabins and apartments', lang) },
  { name: cs ? 'Společná jídelna' : t5('Common dining', lang), detail: cs ? 'A společenské prostory' : t5('And social spaces', lang) },
  { name: cs ? 'Výzkumné laboratoře' : t5('Research labs', lang), detail: cs ? 'Botanika a ekosystémy' : t5('Botany and ecosystems', lang) },
  { name: cs ? 'Technické prostory' : t5('Technical spaces', lang), detail: cs ? 'Podpora života' : t5('Life support', lang) },
  { name: cs ? 'Radiální most' : t5('Radial bridge', lang), detail: cs ? 'Spojení s centrálním uzlem' : t5('Link to the central node', lang) },
  { name: cs ? 'Centrální uzel' : t5('Central node', lang), detail: cs ? 'Řídicí, obytné a společné prostory' : t5('Command, residential and common spaces', lang) },
];

const getQuantumTracks = (cs: boolean, lang: Lang) => [
  {
    name: tx5(L6IssobellaCopy.qmPathA, lang),
    desc: tx5(L6IssobellaCopy.qmPathADesc, lang),
    trl: 'TRL 1–2',
    icon: Atom,
    color: 'text-zion-purple',
    accent: 'border-zion-purple/30 bg-zion-purple/5',
    badge: 'border-zion-purple/30 bg-zion-purple/10 text-zion-purple',
  },
  {
    name: tx5(L6IssobellaCopy.qmPathB, lang),
    desc: tx5(L6IssobellaCopy.qmPathBDesc, lang),
    trl: 'TRL 4–6',
    icon: Zap,
    color: 'text-zion-cyan',
    accent: 'border-zion-cyan/30 bg-zion-cyan/5',
    badge: 'border-zion-cyan/30 bg-zion-cyan/10 text-zion-cyan',
  },
  {
    name: tx5(L6IssobellaCopy.qmPathC, lang),
    desc: tx5(L6IssobellaCopy.qmPathCDesc, lang),
    trl: 'TRL 5–7',
    icon: Flame,
    color: 'text-zion-gold',
    accent: 'border-zion-gold/30 bg-zion-gold/5',
    badge: 'border-zion-gold/30 bg-zion-gold/10 text-zion-gold',
  },
  {
    name: tx5(L6IssobellaCopy.qmPathD, lang),
    desc: tx5(L6IssobellaCopy.qmPathDDesc, lang),
    trl: 'TRL 1',
    icon: Sparkles,
    color: 'text-zion-purple',
    accent: 'border-zion-purple/30 bg-zion-purple/5',
    badge: 'border-zion-purple/30 bg-zion-purple/10 text-zion-purple',
  },
];

const getQuantumRoadmap = (cs: boolean, lang: Lang) => [
  { year: '2030', label: cs ? 'L5 laboratoř — základní testy' : t5('L5 lab — baseline tests', lang), status: 'planned' },
  { year: '2033', label: cs ? 'První demonstrátor kvantového generátoru' : t5('First quantum generator demonstrator', lang), status: 'planned' },
  { year: '2035', label: cs ? 'CubeSat s iontovým / plazmovým pohonem' : t5('CubeSat with ion/plasma thruster', lang), status: 'planned' },
  { year: '2037', label: cs ? 'Open-source release hardwarových specifikací' : t5('Open-source hardware specs release', lang), status: 'planned' },
  { year: '2045', label: cs ? 'Výroba komponent stanice s kvantovou energií' : t5('Station components with quantum power', lang), status: 'vision' },
  { year: '2050+', label: cs ? 'Integrace na Issobella' : t5('Integration on Issobella', lang), status: 'vision' },
];

const getHumanRisks = (cs: boolean, lang: Lang) => [
  { risk: cs ? 'Svalová atrofie' : t5('Muscle atrophy', lang), icon: Activity, measure: cs ? '0,38 g bydlení + cvičení' : t5('0.38 g living + exercise', lang) },
  { risk: cs ? 'Ztráta kostní hmoty' : t5('Bone loss', lang), icon: Scale, measure: cs ? 'Umělá gravitace + vápník + vitamín D' : t5('Artificial gravity + calcium + vitamin D', lang) },
  { risk: 'VIIP', icon: Eye, measure: cs ? 'Umělá gravitace + monitoring tlaku' : t5('Artificial gravity + pressure monitoring', lang) },
  { risk: cs ? 'Kardiobevaskulární deconditioning' : t5('Cardiovascular deconditioning', lang), icon: Heart, measure: cs ? '0,38 g torus + centrifuga 1,0 g' : t5('0.38 g torus + 1.0 g centrifuge', lang) },
  { risk: cs ? 'Radiace (GCR / SPE)' : t5('Radiation (GCR / SPE)', lang), icon: Shield, measure: cs ? 'Stínění, magnetický štít, LH2 tanky' : t5('Shielding, magnetic shield, LH2 tanks', lang) },
  { risk: cs ? 'Psychická zátěž' : t5('Psychological stress', lang), icon: Brain, measure: cs ? 'Zelené zóny, soukromí, rituály, telemedicína' : t5('Green zones, privacy, rituals, telemedicine', lang) },
];

const getLibraryDocs = (cs: boolean, lang: Lang) => [
  { id: 'l6-readme', title: cs ? 'L6 — přehled' : t5('L6 Overview', lang), file: 'README.md', desc: cs ? 'Úvod do vize, financování a filosofie L6.' : t5('Introduction to the L6 vision, funding, and philosophy.', lang), icon: BookOpen },
  { id: 'l6-architecture', title: cs ? 'Architektura stanice' : t5('Station architecture', lang), file: 'Architektura.md', desc: cs ? 'Moduly, parametry, ZION Space Node, ECLSS.' : t5('Modules, parameters, ZION Space Node, ECLSS.', lang), icon: Satellite },
  { id: 'l6-quantum-motor', title: cs ? 'Kvantový motor' : t5('Quantum motor', lang), file: 'Kvantovy_Motor.md', desc: cs ? 'Výzkumné cesty, TRL, bezpečnostní brány, roadmap.' : t5('Research paths, TRL, safety gates, roadmap.', lang), icon: Atom },
  { id: 'l6-artificial-gravity', title: cs ? 'Umělá gravitace' : t5('Artificial gravity', lang), file: 'Umela_Gravitace.md', desc: cs ? 'Fyzika rotace, konfigurace, Coriolis, design.' : t5('Physics of rotation, configurations, Coriolis, design.', lang), icon: Orbit },
  { id: 'l6-human-factors', title: cs ? 'Lidské faktory' : t5('Human factors', lang), file: 'Lidske_Faktory.md', desc: cs ? 'Biomedicína, psychologie, ECLSS, etika.' : t5('Biomedicine, psychology, ECLSS, ethics.', lang), icon: Heart },
  { id: 'l6-history', title: cs ? 'Historie stanic' : t5('Station history', lang), file: 'Histori.md', desc: cs ? 'Von Braun, ISS, Skylab, Saljut, Freedom.' : t5('Von Braun, ISS, Skylab, Saljut, Freedom.', lang), icon: Clock },
  { id: 'l6-ground-station', title: cs ? 'Pozemní stanice Kostarika' : t5('Costa Rica Ground Station', lang), file: 'Pozemni_Stanice_Kostarika.md', desc: cs ? 'Ground segment L6 — kampus, TT&C, observatoř, sdílený pozemek s L5.' : t5('L6 ground segment — campus, TT&C, observatory, land shared with L5.', lang), icon: Radar },
];

const getTimeline = (cs: boolean, lang: Lang) => [
  { year: '2026–2030', title: cs ? 'Feasibility & CubeSat' : t5('Feasibility & CubeSat', lang), body: cs ? 'Studie proveditelnosti, první CubeSaty, L5 laboratoř.' : t5('Feasibility studies, first CubeSats, L5 lab.', lang) },
  { year: '2030–2040', title: cs ? 'Kvantový generátor' : t5('Quantum generator', lang), body: cs ? 'Demonstrátory, LEO test modul, open-source hardware.' : t5('Demonstrators, LEO test module, open-source hardware.', lang) },
  { year: '2040–2050', title: cs ? 'Design & výroba' : t5('Design & manufacturing', lang), body: cs ? 'První moduly stanice, spin-up, 0,38 g validace.' : t5('First station modules, spin-up, 0.38 g validation.', lang) },
  { year: '2050–2076', title: cs ? 'Rozšíření & deep-space' : t5('Expansion & deep-space', lang), body: cs ? 'Rozšíření stanice, mezihvězdná síť, AI/Hiran.' : t5('Station expansion, interstellar network, AI/Hiran.', lang) },
  { year: '2126+', title: cs ? 'Tail emission' : t5('Tail emission', lang), body: cs ? '724,78 ZION/blok navždy — věčný L6 fond.' : t5('724.78 ZION/block forever — perpetual L6 fund.', lang) },
];

export default function L6IssobellaPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const missions = getMissions(cs, lang);
  const modules = getModules(cs, lang);
  const agRows = getAgRows(cs, lang);
  const agConfig = getAgConfig(cs, lang);
  const study02Zones = getStudy02Zones(cs, lang);
  const qmTracks = getQuantumTracks(cs, lang);
  const qmRoadmap = getQuantumRoadmap(cs, lang);
  const humanRisks = getHumanRisks(cs, lang);
  const libraryDocs = getLibraryDocs(cs, lang);
  const timeline = getTimeline(cs, lang);

  return (
    <div className="zion-page overflow-x-hidden">
      <div className="zion-container max-w-7xl space-y-14 pb-24 md:space-y-20">

        {/* ── HERO ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="zion-rainbow-card relative flex flex-col overflow-hidden p-0"
          style={{ '--rc': '147, 51, 234' } as React.CSSProperties}
        >
          <div className="relative z-10 bg-black/50 p-6 md:p-8 lg:p-10">
            <div className="pointer-events-none absolute inset-0" aria-hidden="true">
              {HERO_STARS.map((star, i) => (
                <motion.span
                  key={i}
                  className="absolute rounded-full bg-white/70"
                  style={{ left: `${star.x}%`, top: `${star.y}%`, width: star.size, height: star.size }}
                  animate={{ opacity: [0.15, 0.9, 0.15] }}
                  transition={{ duration: star.d, repeat: Infinity, delay: star.delay, ease: 'easeInOut' }}
                />
              ))}
            </div>
            <div className="relative max-w-3xl space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-zion-purple/40 bg-zion-purple/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-purple uppercase">
                <Rocket className="h-4 w-4" />
                {tx5(L6IssobellaCopy.badge, lang)}
              </div>

              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-gray-400">
                  {tx5(L6IssobellaCopy.spaceLayer, lang)}
                </p>
                <h1 className="zion-page-heading text-gradient leading-tight">
                  {tx5(L6IssobellaCopy.title, lang)}
                  <span className="text-white"> {tx5(L6IssobellaCopy.titleAccent, lang)}</span>
                </h1>
              </div>
            </div>
          </div>

          <div className="relative w-full aspect-video max-h-[80vh] bg-black">
            <Image
              src="/docs/l6/img/Issabela1stSkelet.png"
              alt={cs ? 'ZION Issobella — koncept orbitální stanice' : t5('ZION Issobella — orbital station concept', lang)}
              fill
              priority
              sizes="(max-width: 1280px) 100vw, 1280px"
              quality={90}
              className="object-contain object-center"
            />
          </div>

          <div className="relative z-10 bg-black/50 p-6 md:p-8 lg:p-10">
            <div className="max-w-3xl space-y-6">
              <p className="text-lg text-gray-300">
                {tx5(L6IssobellaCopy.heroBody, lang)}
              </p>

              <div className="flex flex-wrap gap-3 text-xs">
                <span className="inline-flex items-center gap-2 rounded-full border border-zion-purple/30 bg-zion-purple/10 px-4 py-2 text-purple-200">
                  <Star className="h-3 w-3" /> {tx5(L6IssobellaCopy.k5OfEveryBlock, lang)}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-zion-cyan/30 bg-zion-cyan/10 px-4 py-2 text-cyan-200">
                  <CheckCircle2 className="h-3 w-3" /> {tx5(L6IssobellaCopy.approxMonth, lang)}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <Clock className="h-3 w-3" /> {tx5(L6IssobellaCopy.unlockedBlock, lang)}
                </span>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/docs#l6-issobella"
                  className="zion-rainbow-sub inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                  style={{ '--rc': '147, 51, 234' } as React.CSSProperties}
              >
                  <BookOpen className="h-4 w-4 text-zion-cyan" />
                  {tx5(L6IssobellaCopy.ctaDocs, lang)}
                  <ChevronRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/dao"
                  className="inline-flex items-center gap-2 rounded-2xl border border-zion-gold/30 bg-zion-gold/5 px-6 py-3 text-sm font-semibold text-amber-200 transition-colors hover:bg-zion-gold/10"
                >
                  <Crown className="h-4 w-4 text-zion-gold" />
                  {tx5(L6IssobellaCopy.ctaDao, lang)}
                </Link>
                <Link
                  href="/l6-issobella/papers"
                  className="inline-flex items-center gap-2 rounded-2xl border border-zion-cyan/30 bg-zion-cyan/5 px-6 py-3 text-sm font-semibold text-cyan-200 transition-colors hover:bg-zion-cyan/10"
                >
                  <Anchor className="h-4 w-4 text-zion-cyan" />
                  {cs ? 'Papers · L1 kotva' : t5('Papers · L1 anchor', lang)}
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
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="zion-rainbow-card p-5 md:p-8"
          style={{ '--rc': '6, 182, 212' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tx5(L6IssobellaCopy.spaceFund, lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Wallet className="h-7 w-7 text-zion-cyan" />
              {tx5(L6IssobellaCopy.fundTitle, lang)}
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="zion-rainbow-sub p-4 text-center transition-colors hover:bg-white/5" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">{tx5(L6IssobellaCopy.blockShare, lang)}</p>
              <p className="text-4xl font-bold text-zion-cyan">5%</p>
              <p className="text-xs text-gray-500 mt-1">{tx5(L6IssobellaCopy.everyBlockForever, lang)}</p>
            </div>
            <div className="zion-rainbow-sub p-4 text-center transition-colors hover:bg-white/5" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">{tx5(L6IssobellaCopy.approxMonth, lang)}</p>
              <p className="text-4xl font-bold text-zion-gold">~11,7M</p>
              <p className="text-xs text-gray-500 mt-1">ZION</p>
            </div>
            <div className="zion-rainbow-sub p-4 text-center transition-colors hover:bg-white/5" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">{tx5(L6IssobellaCopy.governedBy, lang)}</p>
              <p className="text-3xl font-bold text-zion-cyan">DAO</p>
              <p className="text-xs text-gray-500 mt-1">{tx5(L6IssobellaCopy.l6Council, lang)}</p>
            </div>
            <FundBalance address={ISSOBELLA_WALLET} rc="6, 182, 212" />
          </div>

          <div className="zion-rainbow-sub p-4 text-sm text-gray-400 font-mono break-all" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
            <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">{tx5(L6IssobellaCopy.fundWallet, lang)}</p>
            {ISSOBELLA_WALLET}
          </div>

          <div className="zion-rainbow-sub p-4 mt-4" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
            <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
              <p className="text-xs uppercase tracking-wider text-gray-500">{tx5(L6IssobellaCopy.genesisPremine, lang)}</p>
              <p className="text-xl font-bold text-zion-purple">{tx5(L6IssobellaCopy.genesisPremineAmount, lang)}</p>
            </div>
            <p className="text-sm text-gray-400">{tx5(L6IssobellaCopy.genesisPremineDesc, lang)}</p>
            <p className="text-xs font-mono text-gray-500 break-all mt-2">{ISSOBELLA_PREMINE_WALLET}</p>
            <p className="text-xs text-gray-400 mt-2">
              {tx5(L6IssobellaCopy.liveBalance, lang)}: <BalanceText address={ISSOBELLA_PREMINE_WALLET} className="text-zion-purple font-semibold" compact /> <span className="text-gray-500">ZION</span>
            </p>
          </div>
        </motion.section>

        {/* ── MISSIONS ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tx5(L6IssobellaCopy.missionsAndVision, lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Compass className="h-7 w-7 text-zion-purple" />
              {tx5(L6IssobellaCopy.cosmicMissions, lang)}
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {missions.map((mission) => (
              <div
                key={mission.name}
                className={`zion-rainbow-card group overflow-hidden p-0 transition-transform duration-300 hover:-translate-y-1 ${mission.color}`}
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
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                  <span className={`absolute right-3 top-3 text-[11px] uppercase tracking-widest px-2 py-1 rounded-full font-semibold border ${mission.badgeColor}`}>
                    {mission.phase}
                  </span>
                </div>
                <div className="p-5">
                  <h3 className="font-semibold text-white mb-2">{mission.name}</h3>
                  <p className="text-sm text-gray-400 mb-4">{mission.desc}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {mission.tags.map((tag) => (
                      <span key={tag} className="text-[11px] rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-gray-400">{tag}</span>
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
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="zion-rainbow-card p-5 md:p-8"
          style={{ '--rc': '251, 191, 36' } as React.CSSProperties}
        >
          <div className="grid lg:grid-cols-2 gap-8 items-start">
            <div className="space-y-5">
              <div className="flex flex-col gap-2">
                <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tx5(L6IssobellaCopy.stationArchitecture, lang)}</p>
                <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
                  <Satellite className="h-7 w-7 text-zion-gold" />
                  {tx5(L6IssobellaCopy.modularStation, lang)}
                </h2>
              </div>
              <p className="text-lg text-gray-300">
                {tx5(L6IssobellaCopy.stationBody, lang)}
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                {modules.map((m) => (
                  <div key={m.title} className="zion-rainbow-sub p-4 transition-colors hover:bg-white/5" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
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
              <L6StationPreviewLazy lang={lang} className="w-full rounded-2xl" />
              <figure className="group space-y-2">
                <Image
                  src="/docs/l6/img/1stMock.png"
                  alt={cs ? 'První vizualizace stanice Issobella' : t5('First visualization of the Issobella station', lang)}
                  width={1200}
                  height={675}
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  quality={85}
                  loading="lazy"
                  className="w-full h-auto rounded-2xl border border-white/10 transition-transform duration-500 group-hover:scale-[1.02]"
                />
                <figcaption className="text-center text-[11px] uppercase tracking-widest text-gray-500">
                  {tx5(L6IssobellaCopy.stationMockupCaption, lang)}
                </figcaption>
              </figure>
            </div>
          </div>
        </motion.section>

        {/* ── CONCEPT STUDY 02 ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="zion-rainbow-card p-5 md:p-8"
          style={{ '--rc': '16, 185, 129' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tx5(L6IssobellaCopy.study02Subtitle, lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Leaf className="h-7 w-7 text-emerald-400" />
              {tx5(L6IssobellaCopy.study02Title, lang)}
            </h2>
            <p className="text-sm text-gray-400">{tx5(L6IssobellaCopy.study02Body, lang)}</p>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 mb-4">
            <img
              src="/images/l6-issobella/study-02.webp"
              srcSet="/images/l6-issobella/study-02-m.webp 960w, /images/l6-issobella/study-02.webp 1536w"
              sizes="(max-width: 1100px) calc(100vw - 2rem), 1024px"
              alt={cs
                ? 'Koncepční studie 02 — řezy prstencové stanice Issobella s botanickými kopulemi, kajutami, jídelnou a centrálním uzlem'
                : 'Concept study 02 — sections of the Issobella ring station with botanical domes, cabins, a dining hall and a central node'}
              width={1536}
              height={1024}
              loading="lazy"
              decoding="async"
              className="w-full object-contain"
            />
          </div>
          <p className="mb-6 text-center text-xs leading-relaxed text-white/50">
            {tx5(L6IssobellaCopy.study02Note, lang)}
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {study02Zones.map((zone, i) => (
              <div key={zone.name} className="zion-rainbow-sub flex items-start gap-3 p-4" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/10 text-[11px] font-bold text-emerald-300 leading-none">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{zone.name}</p>
                  <p className="text-sm text-gray-400">{zone.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── ARTIFICIAL GRAVITY ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="zion-rainbow-card p-5 md:p-8"
          style={{ '--rc': '147, 51, 234' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tx5(L6IssobellaCopy.artificialGravity, lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Orbit className="h-7 w-7 text-zion-purple" />
              {tx5(L6IssobellaCopy.artificialGravity, lang)}
            </h2>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            <div className="space-y-5">
              <p className="text-lg text-gray-300">
                {tx5(L6IssobellaCopy.agBody, lang)}
              </p>
              <div className="rounded-2xl border border-zion-purple/30 bg-zion-purple/5 p-4 text-center font-mono text-zion-purple">
                {tx5(L6IssobellaCopy.agFormula, lang)}
              </div>

              <div className="overflow-x-auto rounded-2xl border border-white/10">
                <table className="w-full min-w-[480px] text-sm">
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
              <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                <img
                  src="/images/l6-issobella/artificial-gravity.webp"
                    alt={cs ? 'Uvnitř prstence — umělá gravitace, Issobella vize 2040' : t5('Inside the ring — artificial gravity, Issobella vision 2040', lang)}
                    width={1600}
                    height={900}
                    loading="lazy"
                    decoding="async"
                    className="w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
              </div>

              <div className="zion-rainbow-sub p-5 transition-colors hover:bg-white/5" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
                <p className="text-xs uppercase tracking-wider text-gray-500 mb-3">{tx5(L6IssobellaCopy.agRecommended, lang)}</p>
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
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="zion-rainbow-card p-5 md:p-8"
          style={{ '--rc': '6, 182, 212' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tx5(L6IssobellaCopy.quantumMotor, lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Atom className="h-7 w-7 text-zion-cyan" />
              {tx5(L6IssobellaCopy.quantumMotor, lang)}
            </h2>
            <p className="text-sm text-gray-400">{tx5(L6IssobellaCopy.qmBody, lang)}</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {qmTracks.map((track) => (
              <div key={track.name} className={`zion-rainbow-sub p-5 transition-colors hover:bg-white/5 ${track.accent}`} style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
                <div className="flex items-start justify-between mb-3">
                  <track.icon className={`h-6 w-6 ${track.color}`} />
                  <span className={`text-[11px] uppercase tracking-widest px-2 py-1 rounded-full font-semibold border ${track.badge}`}>{track.trl}</span>
                </div>
                <h3 className="font-semibold text-white mb-2">{track.name}</h3>
                <p className="text-sm text-gray-400">{track.desc}</p>
              </div>
            ))}
          </div>

          <div className="zion-rainbow-sub p-5" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
            <p className="text-xs uppercase tracking-wider text-gray-500 mb-4">{tx5(L6IssobellaCopy.qmRoadmap, lang)}</p>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {qmRoadmap.map((item, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zion-cyan/30 bg-zion-cyan/10 text-[11px] font-bold text-zion-cyan leading-none text-center">
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
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="zion-rainbow-card p-5 md:p-8"
          style={{ '--rc': '236, 72, 153' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tx5(L6IssobellaCopy.humanFactors, lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Heart className="h-7 w-7 text-pink-400" />
              {tx5(L6IssobellaCopy.humanFactors, lang)}
            </h2>
            <p className="text-sm text-gray-400">{tx5(L6IssobellaCopy.hfBody, lang)}</p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-gray-400">
                <tr>
                  <th className="p-3">{tx5(L6IssobellaCopy.hfRisk, lang)}</th>
                  <th className="p-3">{tx5(L6IssobellaCopy.hfCountermeasure, lang)}</th>
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
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tx5(L6IssobellaCopy.researchLibrary, lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <BookOpen className="h-7 w-7 text-zion-cyan" />
              {tx5(L6IssobellaCopy.researchLibrary, lang)}
            </h2>
            <p className="text-sm text-gray-400">{tx5(L6IssobellaCopy.researchLibraryBody, lang)}</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {libraryDocs.map((doc) => (
              <Link
                key={doc.id}
                href={`/docs#${doc.id}`}
                className="zion-rainbow-sub group block p-5 transition duration-300 hover:-translate-y-1 hover:bg-white/5"
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
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="zion-rainbow-card p-5 md:p-8"
          style={{ '--rc': '251, 191, 36' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tx5(L6IssobellaCopy.timeline, lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Clock className="h-7 w-7 text-zion-gold" />
              {tx5(L6IssobellaCopy.timeline, lang)}
            </h2>
            <p className="text-sm text-gray-400">{tx5(L6IssobellaCopy.timelineBody, lang)}</p>
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

        {/* ── UZLY L6 — stanice + flotila ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="zion-rainbow-card p-5 md:p-8"
          style={{ '--rc': '56, 189, 248' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Uzly L6' : t5('L6 nodes', lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Orbit className="h-7 w-7 text-sky-300" />
              {cs ? 'Dva uzly nebe' : t5('Two nodes of the sky', lang)}
            </h2>
            <p className="text-sm text-gray-400">
              {cs
                ? 'Stanice stojí, flotila se hýbe. Issobella drží prstenec, Nabukano drží osu k zemi — dohromady tvoří nebe, ke kterému se dá vrátit.'
                : 'The station stands, the fleet moves. Issobella holds the ring, Nabukano holds the axis to the ground — together they form a sky you can return to.'}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="zion-rainbow-sub p-5" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
              <div className="flex items-center justify-between mb-3">
                <Satellite className="h-6 w-6 text-zion-purple" />
                <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] uppercase tracking-widest text-white/55">
                  {cs ? 'Horizont' : t5('Horizon', lang)}
                </span>
              </div>
              <h3 className="font-semibold text-white mb-2">Issobella</h3>
              <p className="text-sm text-gray-400">
                {cs
                  ? 'Orbitální stanice L6: prstenec ~200 m napříč, ~2 otáčky za minutu, cíl 0,38 g. Nahoře žádný modul neexistuje — roadmapa 2030–2045+ je horizont.'
                  : 'The L6 orbital station: a ring ~200 m across, ~2 revolutions per minute, 0.38 g target. Nothing is up there yet — the 2030–2045+ roadmap is a horizon.'}
              </p>
            </div>

            <Link
              href="/terranova/nabukano"
              className="zion-rainbow-sub group block p-5 transition duration-300 hover:-translate-y-1 hover:bg-white/5"
              style={{ '--rc': '56, 189, 248' } as React.CSSProperties}
            >
              <div className="flex items-center justify-between mb-3">
                <Orbit className="h-6 w-6 text-sky-300" />
                <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] uppercase tracking-widest text-white/55">
                  {cs ? 'Vize' : t5('Vision', lang)}
                </span>
              </div>
              <h3 className="font-semibold text-white mb-2">Nabukano · {cs ? 'Nebeská flotila' : t5('Sky fleet', lang)}</h3>
              <p className="text-sm text-gray-400">
                {cs
                  ? 'Pohyblivý uzel nebe: mateřská loď s dokovacím rámem a tři nebeské Marie. Svislá osa začíná u pozemního uzlu LUMI v Kostarice. Kýl položený není.'
                  : 'A mobile node of the sky: a mother ship with a docking frame and three sky Marías. The vertical axis begins at the LUMI ground node in Costa Rica. No keel has been laid.'}
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm text-sky-300 group-hover:gap-2 transition-all">
                {cs ? 'Podrobnosti' : t5('Details', lang)} <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          </div>
        </motion.section>

        {/* ── BOTTOM CTA ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="zion-cta-banner"
        >
          <Sparkles className="h-12 w-12 text-zion-purple mx-auto mb-4" />
          <h2 className="text-3xl font-semibold text-white mb-4">Hiranyagarbha · {tx5(L6IssobellaCopy.bottomCta, lang)}</h2>
          <p className="text-gray-300 max-w-2xl mx-auto text-lg">
            {tx5(L6IssobellaCopy.bottomBody, lang)}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <Link href="/docs#l6-issobella" className="zion-rainbow-sub inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
              <BookOpen className="h-4 w-4 text-zion-cyan" />
              {tx5(L6IssobellaCopy.ctaDocs, lang)}
            </Link>
            <Link href="/dao" className="zion-rainbow-sub inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
              <Crown className="h-4 w-4 text-zion-gold" />
              {tx5(L6IssobellaCopy.ctaDao, lang)}
            </Link>
            <Link href="/network" className="zion-rainbow-sub inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
              <Globe2 className="h-4 w-4 text-zion-cyan" />
              {tx5(L6IssobellaCopy.network, lang)}
            </Link>
            <Link href="/terranova/nabukano" className="zion-rainbow-sub inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors" style={{ '--rc': '56, 189, 248' } as React.CSSProperties}>
              <Sparkles className="h-4 w-4 text-sky-300" />
              Nabukano · Nebeská flotila
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
