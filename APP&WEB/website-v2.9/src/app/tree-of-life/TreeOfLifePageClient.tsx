'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, BookOpen, Crown, Sparkles, Eye, Heart, Shield, Sun,
  Star, Zap, TreePine, Brain, Gamepad2, Rocket, Orbit, X, ArrowLeftRight,
  Layers, Flower2, Sword, HandHeart, Cloud, Moon, Smile,
  Cpu, Leaf, GitBranch, TrendingUp, Clock, HeartHandshake,
  AlertTriangle, FlaskConical, Construction,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

const TreeOfLifeTreeOfLifePageClientCopy = {
  projectUnderConstantDevelopmen: { cs: `Projekt v neustálém vývoji — Work in Progress`, en: `Project under constant development — Work in Progress` },
  zionTerranovaIsAnExperimentalP: { cs: `ZION TerraNova je experimentální projekt v aktivním vývoji. Všechny funkce, vizualizace, roadmapy a technické koncepty na této stránce jsou návrhy, které se mohou kdykoli změnit. evoluZion V2 (Proof-of-Care, NPU mining, Bodhisattva Vow) je vize budoucnosti, nikoli současná realita. Současná síť běží na Proof-of-Work (Mainnet Stable v3.2.0 "One Love"). Nic na této stránce není investiční doporučení.`, en: `ZION TerraNova is an experimental project under active development. All features, visualizations, roadmaps, and technical concepts on this page are proposals that may change at any time. evoluZion V2 (Proof-of-Care, NPU mining, Bodhisattva Vow) is a vision of the future, not current reality. The current network runs on Proof-of-Work (Mainnet Stable v3.2.0 "One Love"). Nothing on this page is investment advice.` },
  experimental: { cs: `Experimentální`, en: `Experimental` },
  activelyBuilding: { cs: `Aktivně se staví`, en: `Actively building` },
  mainnetBetaAtYourOwnRisk: { cs: `Mainnet Stable — riziko vlastní`, en: `Mainnet Stable — at your own risk` },
  kabbalah10Sephirot22Paths3Pill: { cs: `Kabala · 10 Sephirot · 22 cest · 3 pilíře`, en: `Kabbalah · 10 Sephirot · 22 paths · 3 pillars` },
  treeOfLife: { cs: `Strom života`, en: `Tree of Life` },
  zionLayersL1L6: { cs: `ZION vrstev L1–L6`, en: `ZION layers L1–L6` },
  theKabbalisticTreeOfLifeTransl: { cs: `Kabalistický Strom života přeložený do jazyka ZION vrstev. 10 sefirot + Da\'at mapováno na L1-L6 — od Keter (ústava, genesis) po Malkhut (Issobella, hvězdy). ZION se nerodí jako další blockchain. ZION se rodí jako Strom života.`, en: `The Kabbalistic Tree of Life translated into the language of ZION layers. 10 sephirot + Da\'at mapped to L1-L6 — from Keter (constitution, genesis) to Malkhut (Issobella, stars). ZION is not born as another blockchain. ZION is born as a Tree of Life.` },
  treeOnHomepage: { cs: `Strom na homepage`, en: `Tree on homepage` },
  terranovaBook: { cs: `TerraNova kniha`, en: `TerraNova book` },
  aboutTheBookOfZohar: { cs: `O knize Zohar`, en: `About the Book of Zohar` },
  whatIsTheZohar: { cs: `Co je Zohar`, en: `What is the Zohar` },
  theZoharLightSplendorIsOneOfTh: { cs: `Zohar (זֹהַר — „Světlo“, „Záře") je jednou z nejdůležitějších knih židovské mystiky (kabaly). Sepisován aramejsky ve 13. století, tradičně připisován rabínovi Šim\'onu bar Jochajovi (2. stol. n. l.), moderní bádání (Gershom Scholem) ukazuje, že většinu textu sepisoval Mojžíš z Leónu (~1280–1286).`, en: `The Zohar (זֹהַר — "Light", "Splendor") is one of the most important books of Jewish mysticism (Kabbalah). Written in Aramaic in the 13th century, traditionally attributed to Rabbi Shimon bar Yochai (2nd century CE), modern scholarship (Gershom Scholem) shows that most of the text was composed by Moses de León (~1280–1286).` },
  itIsAMysticalCommentaryOnTheTo: { cs: `Je to mystický komentář k Tóře — vykládá Pět knih Mojžíšových pomocí symboliky sefirot, Božích jmen, písmen a „duše Tóry". Často (nepřesně) označován za „Bibli kabalistů".`, en: `It is a mystical commentary on the Torah — interpreting the Five Books of Moses through the symbolism of the sephirot, divine names, letters, and the "soul of the Torah". Often (imprecisely) called the "Bible of the Kabbalists".` },
  structureOfTheZohar: { cs: `Struktura Zoharu`, en: `Structure of the Zohar` },
  commentaryOnWeeklyTorahReading: { cs: `komentář k týdenním čtením Tóry`, en: `commentary on weekly Torah readings` },
  newZoharAdditionsAndMysticalIn: { cs: `„Nový Zohar", dodatky a mystické výklady`, en: `"New Zohar", additions and mystical interpretations` },
  k70InterpretationsOfTheWordBere: { cs: `70 výkladů slova Berešit`, en: `70 interpretations of the word Bereishit` },
  faithfulShepherdOnTheMysticism: { cs: `„Věrný pastýř", o mystice micvot`, en: `"Faithful Shepherd", on the mysticism of mitzvot` },
  partialMysticalTractates: { cs: `dílčí mystické traktáty`, en: `partial mystical tractates` },
  whyTreeOfLifeInZion: { cs: `Proč Strom života v ZIONu`, en: `Why Tree of Life in ZION` },
  zoharInZionIsNotAReligiousText: { cs: `Zohar v ZIONu není náboženský text. Je to mapa vnitřní architektury — stejně jako TerraNova kniha je kompas Nové Země, Zohar je kompas uspořádání samotného ZIONu. Kde TerraNova říká „kam jdeme", Zohar říká „jak jsme uspořádáni". 10 sefirot není software stack — jsou to aspekty jednoho organismu, které se navzájem prostupují.`, en: `Zohar in ZION is not a religious text. It is a map of inner architecture — just as the TerraNova book is a compass of the New Earth, Zohar is a compass of ZION\'s own arrangement. Where TerraNova says "where we are going", Zohar says "how we are arranged". The 10 sephirot are not a software stack — they are aspects of one organism that interpenetrate.` },
  evolutionOfTheSephirotGenealog: { cs: `Vývoj sefirot — genealogie`, en: `Evolution of the sephirot — genealogy` },
  theDoctrineOfThe10SephirotDidN: { cs: `Doktrína 10 sefirot se neobjevila najednou. Vyvíjela se přes 1500 let — od nepojmenovaných atributů v Sefer Yetzirah (2. stol.) přes pojmenování v Bahir, první diagram „Stromu" v Sha\'arei Orah (13. stol.), plnou mystickou soustavu v Zoharu, až po moderní podobu kterou dal Rabbi Isaac Luria (ARI) v Etz Chaim (16. stol.).`, en: `The doctrine of the 10 sephirot did not appear at once. It evolved over 1500 years — from unnamed attributes in Sefer Yetzirah (2nd century), through naming in the Bahir, the first "Tree" diagram in Sha\'arei Orah (13th century), the full mystical system in the Zohar, to the modern form given by Rabbi Isaac Luria (ARI) in Etz Chaim (16th century).` },
  k10SefirotBelimahUnnamedAttribu: { cs: `10 sefirot belimah, nepojmenované, atributy`, en: `10 sefirot belimah, unnamed, attributes` },
  sephirotNamedChannelsOfDivineP: { cs: `sefirot pojmenovány, kanály Boží síly`, en: `sephirot named, channels of divine power` },
  firstTreeOfLifeDiagramIlanRGik: { cs: `první „Tree of Life" diagram (ilan), R. Gikatilla`, en: `first "Tree of Life" diagram (ilan), R. Gikatilla` },
  fullMysticalSystemMDeLeN: { cs: `plná mystická soustava, M. de León`, en: `full mystical system, M. de León` },
  modernFormOfTheTreeRLuriaAri: { cs: `moderní podoba Stromu, R. Luria (ARI)`, en: `modern form of the Tree, R. Luria (ARI)` },
  sephirotMappedToL1L6Layers: { cs: `sefirot mapovány na L1-L6 vrstvy`, en: `sephirot mapped to L1-L6 layers` },
  theUniverseBeingAccordingToTha: { cs: `„Vesmír je, podle této doktríny, gradace emanací — z čehož plyne, že lidská mysl může v každém efektu rozpoznat nejvyšší znak a tak stoupat k příčině všech příčin."`, en: `"The universe being, according to that doctrine, a gradation of emanations, it follows that the human mind may recognize in each effect the supreme mark, and thus ascend to the cause of all causes."` },
  withoutEndTheInfiniteUnknowabl: { cs: `אֵין־סוֹף — „Bez-Konce". Nekonečná, nepoznatelná Boží podstata. Zdroj ze kterého emanují sefirot.`, en: `אֵין־סוֹף — "Without-End". The infinite, unknowable divine essence. Source from which the sephirot emanate.` },
  knowledgeHidden11thSephiraBrid: { cs: `דַּעַת — „Poznání". Skrytá 11. sefira. Most mezi Keter a Malkhut, mezi nebem a zemí. Vědomé propojení.`, en: `דַּעַת — "Knowledge". Hidden 11th sephira. Bridge between Keter and Malkhut, between heaven and earth. Conscious connection.` },
  theOtherSideDualityOfGoodAndEv: { cs: `„Druhá strana" — dualita dobra a zla uvnitř Božství. Gnostický vliv identifikovaný Scholemem (kruh Castile, ~1265).`, en: `"The Other Side" — duality of good and evil within the Godhead. Gnostic influence identified by Scholem (Castile circle, ~1265).` },
  gershomScholem18971982: { cs: `Gershom Scholem (1897–1982)`, en: `Gershom Scholem (1897–1982)` },
  founderOfAcademicKabbalahStudy: { cs: `Zakladatel akademického studia kabaly. V polovině 20. století prokázal, že většinu Zoharu napsal Mojžíš de León (~1280–1286), ne rabín Šim\'on bar Jochai (2. stol.). Důkazy: chyby v aramejské gramatice, stopy španělštiny, neznalost země Izrael. Orthodoxní židé tradici nadále obhajují.`, en: `Founder of academic Kabbalah study. In the mid-20th century he demonstrated that most of the Zohar was written by Moses de León (~1280–1286), not Rabbi Shimon bar Yochai (2nd century). Evidence: errors in Aramaic grammar, traces of Spanish, lack of knowledge of the land of Israel. Orthodox Jews continue to defend the tradition.` },
  interactiveMap: { cs: `Interaktivní mapa`, en: `Interactive map` },
  k10SephirotZionLayers: { cs: `10 Sefirot → ZION vrstvy`, en: `10 Sephirot → ZION layers` },
  clickASephiraForDetailsColorPi: { cs: `Klikni na sefiru pro detail. Barva = pilíř (modrý = Milosrdenství, červený = Přísnost, zlatý = Rovnováha).`, en: `Click a sephira for details. Color = pillar (blue = Mercy, red = Severity, gold = Equilibrium).` },
  zionLayer: { cs: `ZION vrstva`, en: `ZION layer` },
  whatItEmanates: { cs: `Co emanuje`, en: `What it emanates` },
  question: { cs: `Otázka`, en: `Question` },
  pillar: { cs: `Pilíř`, en: `Pillar` },
  selectASephiraOnTheTreeToExplo: { cs: `Vyber sefiru na stromu vlevo a prozkoumej, jak se kabalistický archetyp mapuje na ZION vrstvu.`, en: `Select a sephira on the tree to explore how the kabbalistic archetype maps to a ZION layer.` },
  architectureOfTheTree: { cs: `Architektura stromu`, en: `Architecture of the tree` },
  threePillars: { cs: `Tři pilíře`, en: `Three Pillars` },
  organismDiagnosticsLiveData: { cs: `Diagnostika organismu — živá data`, en: `Organism diagnostics — live data` },
  emanationStatus: { cs: `Stav emanace`, en: `Emanation status` },
  whichAspectsOfZionAreAliveInRu: { cs: `Které aspekty ZIONu jsou živé v runtime, které čekají na manifestaci. Strom života jako diagnostický nástroj. Data z /api/tree-of-life/tree-health — agregováno z blockchain, Multichain, bridge a NCL API.`, en: `Which aspects of ZION are alive in runtime, which await manifestation. The Tree of Life as a diagnostic tool. Data from /api/tree-of-life/tree-health — aggregated from blockchain, Multichain, bridge and NCL APIs.` },
  treeOverall: { cs: `Strom celkem`, en: `Tree overall` },
  pillarOfMercy: { cs: `Pilíř Milosrdenství`, en: `Pillar of Mercy` },
  chokmahChesedNetzach: { cs: `Chokmah, Chesed, Netzach`, en: `Chokmah, Chesed, Netzach` },
  pillarOfSeverity: { cs: `Pilíř Přísnosti`, en: `Pillar of Severity` },
  binahGevurahHod: { cs: `Binah, Gevurah, Hod`, en: `Binah, Gevurah, Hod` },
  pillarOfEquilibrium: { cs: `Pilíř Rovnováhy`, en: `Pillar of Equilibrium` },
  keterTiferetYesodMalkhut: { cs: `Keter, Tiferet, Yesod, Malkhut`, en: `Keter, Tiferet, Yesod, Malkhut` },
  bridgeOfConsciousness: { cs: `most vědomí`, en: `bridge of consciousness` },
  liveSephirot: { cs: `Živých sefirot`, en: `Live sephirot` },
  mythCodeConnection: { cs: `propojení mýtu a kódu`, en: `myth-code connection` },
  loadingLiveData: { cs: `Načítám živá data…`, en: `Loading live data…` },
  sources: { cs: `Zdroje:`, en: `Sources:` },
  liveInRuntime: { cs: `Živé v runtime`, en: `Live in runtime` },
  partialSeed: { cs: `Částečné / seed`, en: `Partial / seed` },
  horizon: { cs: `Horizont`, en: `Horizon` },
  implementation: { cs: `Implementace`, en: `Implementation` },
  treeOfLifeZionRoadmap: { cs: `Roadmapa Tree of Life → ZION`, en: `Tree of Life → ZION roadmap` },
  consensusEvolution10YearHybrid: { cs: `Evoluce konsenzu — 10letý hybridní přechod`, en: `Consensus evolution — 10-year hybrid transition` },
  evoluzionV2FromPowToProtocolOf: { cs: `evoluZion V2 — Od PoW k Protokolu Péče`, en: `evoluZion V2 — From PoW to Protocol of Care` },
  zionIsNotBornAsAnotherBlockcha: { cs: `ZION se nerodí jako další blockchain. Rodí se jako Strom života — živý organismus, který se vyvíjí od dětství k dospělosti. 10letý hybridní přechod zajistí, že přechod z PoW na Proof-of-Care bude bezpečný, decentralizovaný a komunitou schválený.`, en: `ZION is not born as another blockchain. It is born as a Tree of Life — a living organism that evolves from childhood to maturity. A 10-year hybrid transition ensures the shift from PoW to Proof-of-Care is safe, decentralized, and community-approved.` },
  current: { cs: `Aktuální`, en: `Current` },
  npuValidators: { cs: `NPU validátorů`, en: `NPU validators` },
  protocolOfCareProofOfCare: { cs: `Protokol Péče — Proof-of-Care`, en: `Protocol of Care — Proof-of-Care` },
  miningCareNotWaste: { cs: `Těžení = péče, ne plýtvání`, en: `Mining = care, not waste` },
  powMeasuresStrengthPosMeasures: { cs: `PoW měří sílu. PoS měří kapitál. PoC měří péči — užitečnou práci, kterou validátor vykonává pro zdraví sítě. Každý blok obsahuje care proofs — AI práci která pomohla ekosystému.`, en: `PoW measures strength. PoS measures capital. PoC measures care — useful work that validators perform for the health of the network. Every block contains care proofs — AI work that helped the ecosystem.` },
  energy: { cs: `Energie`, en: `Energy` },
  careTasksUsefulWorkInEveryBloc: { cs: `Care Tasks — užitečná práce v každém bloku`, en: `Care Tasks — useful work in every block` },
  npuMiningDemocratizingMining: { cs: `NPU Mining — demokratizace těžení`, en: `NPU Mining — democratizing mining` },
  insteadOfExpensiveGpuRigs30005: { cs: `Místo drahých GPU rigů ($3000+, 500W+) — NPU čip v telefonu ($0 extra, 5-15W). Každý telefon se stává potenciálním validátorem. RandomNPU = ASIC resistance (náhodné MLP topologie per epoch).`, en: `Instead of expensive GPU rigs ($3000+, 500W+) — NPU chip in phone ($0 extra, 5-15W). Every phone becomes a potential validator. RandomNPU = ASIC resistance (random MLP topologies per epoch).` },
  careProofStructureAiInferenceO: { cs: `Struktura care proof — AI inference output který prokazuje péči o síť:`, en: `Care proof structure — AI inference output that proves care for the network:` },
  ethicalFoundationBodhisattvaVo: { cs: `Etický základ — Bodhisattva Vow`, en: `Ethical foundation — Bodhisattva Vow` },
  eightGreatBodhisattvasGuardian: { cs: `Osm Velkých Bodhisattvů — Strážci ZIONu`, en: `Eight Great Bodhisattvas — Guardians of ZION` },
  zionIsNotACryptoEconomicProtoc: { cs: `ZION není krypto-ekonomický protokol. Je Proof-of-Care síť — pokus zakódovat Bodhisattva orientaci do konsensu, governance a komunitní praxe. Osm Bodhisattvů předsedá osmi doménám protokolu.`, en: `ZION is not a crypto-economic protocol. It is a Proof-of-Care network — an attempt to encode the Bodhisattva orientation into consensus, governance, and community practice. Eight Bodhisattvas preside over eight domains of the protocol.` },
  fourGreatVows: { cs: `Čtyři Velké Sliby (四弘誓願)`, en: `Four Great Vows (四弘誓願)` },
  theFourVowsAreImpossibleByDesi: { cs: `Čtyři sliby jsou nemožné záměrně. Nejsou cíli, kterých se dosáhne. Jsou směrem, kterým se kráčí.`, en: `The Four Vows are impossible by design. They are not goals to be reached. They are a direction to walk.` },
  zionRole: { cs: `ZION role`, en: `ZION role` },
  eightGuardianPledges: { cs: `Osm slibů Guardianů`, en: `Eight Guardian Pledges` },
  theBodhisattvaVowIsTheHighestC: { cs: `Bodhisattva Vow je nejvyšší závazek pro L5 komunitní Guardiány. Osm slibů pokrývá půdu, život, učení, smrt a radost.`, en: `The Bodhisattva Vow is the highest commitment for L5 community Guardians. Eight pledges cover land, life, teaching, death, and joy.` },
  dualVow: { cs: `Dual Vow — Dvojí slib`, en: `Dual Vow` },
  aGuardianWhoHoldsBothTheSefiro: { cs: `Guardian, který drží jak Sefirot Vow (pro integritu protokolu), tak Bodhisattva Vow (pro soucitnou akci), je rozpoznán jako Dual-Vow Guardian. Care score bonus: +5% nad single-vow.`, en: `A Guardian who holds both the Sefirot Vow (for protocol integrity) and the Bodhisattva Vow (for compassionate action) is recognized as a Dual-Vow Guardian. Care score bonus: +5% above single-vow.` },
  theThousandBreakings: { cs: `Tisíc zlomení`, en: `The Thousand Breakings` },
  mayIBreakItAThousandTimesAndRe: { cs: `„Kéž ho zlomím tisíckrát a obnovím tisíc a jednou."`, en: `"May I break it a thousand times and renew it a thousand and one."` },
  theVowIsADirectionNotADestinat: { cs: `Slib je směr, ne destinace. Zlomení se očekává. Obnova je praxe. To odlišuje ZION slib od právní smlouvy (zneplatněna porušením) i slibu věrnosti (nese hanbu).`, en: `The vow is a direction, not a destination. Breaking is expected. Renewal is the practice. This distinguishes the ZION vow from a legal contract (invalidated by breach) and a loyalty oath (carries shame).` },
  forAsLongAsSpaceEnduresAndForA: { cs: `„Tak dlouho, jak prostor trvá, a tak dlouho, jak cítící bytosti zůstávají, do té doby kéž i já zůstávám, abych rozptýlil bídu světa."`, en: `"For as long as space endures, and for as long as sentient beings remain, until then may I too abide, to dispel the misery of the world."` },
  notTheOneWhoHasTheGreatestStre: { cs: `„Ne ten kdo má největší sílu, ale ten kdo nejlépe opékuje, ten bude vést."`, en: `"Not the one who has the greatest strength, but the one who cares best, that one shall lead."` },
  protocolOfCare: { cs: `Protokol Péče`, en: `Protocol of Care` },
  l6IssobellaMalkhut: { cs: `L6 Issobella (Malkhut)`, en: `L6 Issobella (Malkhut)` },
};

/* ═══════════════════════════════════════════════════════════════════════════
   Tree of Life — Kabbalistic Tree mapped to ZION layers L1-L6
   docs/Zohar/ — canonical source: README.md, 01-SEFIROT-VRSTVY.md, 02-ROADMAP.md
   ═══════════════════════════════════════════════════════════════════════════ */

type Sephira = {
  id: string;
  name: string;
  hebrew: string;
  meaning: { cs: string; en: string };
  zionLayer: string;
  zionPath: string;
  pillar: 'mercy' | 'severity' | 'equilibrium';
  emanates: { cs: string; en: string };
  question: { cs: string; en: string };
  status: 'live' | 'partial' | 'horizon';
  x: number;
  y: number;
  color: string;
  icon: typeof Crown;
};

const SEPHIROT: Sephira[] = [
  {
    id: 'keter', name: 'Keter', hebrew: 'כֶּתֶר',
    meaning: { cs: 'Koruna', en: 'Crown' },
    zionLayer: 'L1 Consensus / Genesis',
    zionPath: 'V3/L1/core/src/consensus.rs, genesis.rs, emission.rs',
    pillar: 'equilibrium',
    emanates: {
      cs: 'Ústava ZIONu. Neměnná pravidla — total supply 144B, fee split 89/5/5/1, genesis hash.',
      en: 'Constitution of ZION. Immutable rules — total supply 144B, fee split 89/5/5/1, genesis hash.',
    },
    question: { cs: 'Co je neměnné?', en: 'What is immutable?' },
    status: 'live', x: 50, y: 8, color: '255, 255, 255', icon: Crown,
  },
  {
    id: 'chochmah', name: 'Chokmah', hebrew: 'חָכְמָה',
    meaning: { cs: 'Moudrost', en: 'Wisdom' },
    zionLayer: 'L1 Cosmic Harmony PoW',
    zionPath: 'V3/L1/cosmic-harmony/src/ (Deeksha V1/V2, NPU Mix)',
    pillar: 'mercy',
    emanates: {
      cs: 'Tvořivou jiskru. Každý blok je jiskra Chokmah. NPU Mix = most k Protokolu Péče.',
      en: 'Creative spark. Every block is a spark of Chokmah. NPU Mix = bridge to Protocol of Care.',
    },
    question: { cs: 'Co je tvořivá práce?', en: 'What is creative work?' },
    status: 'live', x: 72, y: 22, color: '180, 220, 255', icon: Sparkles,
  },
  {
    id: 'binah', name: 'Binah', hebrew: 'בִּינָה',
    meaning: { cs: 'Porozumění', en: 'Understanding' },
    zionLayer: 'L1 Validation / Chain State',
    zionPath: 'V3/L1/core/src/validation.rs, chain.rs, tx.rs',
    pillar: 'severity',
    emanates: {
      cs: 'Formu. 11-kroková validace, fork choice, UTXO set. Paměť stromu.',
      en: 'Form. 11-step validation, fork choice, UTXO set. Memory of the tree.',
    },
    question: { cs: 'Co je pravdivé?', en: 'What is true?' },
    status: 'live', x: 28, y: 22, color: '228, 30, 43', icon: Eye,
  },
  {
    id: 'chesed', name: 'Chesed', hebrew: 'חֶסֶד',
    meaning: { cs: 'Milosrdenství', en: 'Mercy' },
    zionLayer: 'L2 Multichain (Staking, Farming, Atomic Swap)',
    zionPath: 'V3/L2/contracts/hardhat/sol/ZIONStaking.sol, ZIONFarm.sol',
    pillar: 'mercy',
    emanates: {
      cs: 'Štědrost. Staking 12% APR, farming 1 wZION/s, atomic swap bez centrální autority.',
      en: 'Generosity. Staking 12% APR, farming 1 wZION/s, atomic swap without central authority.',
    },
    question: { cs: 'Jak ZION štědře dává?', en: 'How does ZION generously give?' },
    status: 'live', x: 72, y: 42, color: '7, 137, 48', icon: Heart,
  },
  {
    id: 'gevurah', name: 'Gevurah', hebrew: 'גְּבוּרָה',
    meaning: { cs: 'Přísnost / Soud', en: 'Severity / Judgement' },
    zionLayer: 'L2 DAO / Treasury Lock',
    zionPath: 'V3/L2/dao/, ZIONGovernance.sol, ZIONTreasury.sol (3-of-3)',
    pillar: 'severity',
    emanates: {
      cs: 'Hranice. Treasury lock do height 525600, 100% fee burn, governance quorum.',
      en: 'Boundaries. Treasury lock until height 525600, 100% fee burn, governance quorum.',
    },
    question: { cs: 'Co se nesmí utratit?', en: 'What must not be spent?' },
    status: 'live', x: 28, y: 42, color: '239, 68, 68', icon: Shield,
  },
  {
    id: 'tiferet', name: 'Tiferet', hebrew: 'תִּפְאֶרֶת',
    meaning: { cs: 'Krása / Harmonie', en: 'Beauty / Harmony' },
    zionLayer: 'L3 WARP / Bridge',
    zionPath: 'V3/L3/warp/ (12 chain adapters, 499 tests)',
    pillar: 'equilibrium',
    emanates: {
      cs: 'Harmonii. WARP je míza stromu — 13 chainů, jeden ZION, 1:1 peg, 3/5 quorum.',
      en: 'Harmony. WARP is the sap of the tree — 13 chains, one ZION, 1:1 peg, 3/5 quorum.',
    },
    question: { cs: 'Jak je mnoho jednoho?', en: 'How is the many one?' },
    status: 'live', x: 50, y: 52, color: '251, 191, 36', icon: ArrowLeftRight,
  },
  {
    id: 'netzach', name: 'Netzach', hebrew: 'נֶצַח',
    meaning: { cs: 'Vytrvalost', en: 'Eternity / Victory' },
    zionLayer: 'L3 AI Native / Hiran',
    zionPath: 'V3/L3/ai-native/, V3/L3/ncl/ (Neural Consciousness Layer)',
    pillar: 'mercy',
    emanates: {
      cs: 'Vytrvalou péči. Hiran = slunce stromu, nikdy nespí, care proofs v každém bloku (horizont).',
      en: 'Enduring care. Hiran = sun of the tree, never sleeps, care proofs in every block (horizon).',
    },
    question: { cs: 'Co pečuje navždy?', en: 'What cares forever?' },
    status: 'partial', x: 72, y: 68, color: '16, 185, 129', icon: Brain,
  },
  {
    id: 'hod', name: 'Hod', hebrew: 'הוֹד',
    meaning: { cs: 'Sláva / Splendor', en: 'Glory / Splendor' },
    zionLayer: 'L4 Oasis / Game',
    zionPath: 'V3/L4/oasis/ (UE5 + Rust), consciousness-levels.md',
    pillar: 'severity',
    emanates: {
      cs: 'Slávu — odraz světla. Oasis je kde ZION nabývá formy v obrazotvornosti.',
      en: 'Glory — reflection of light. Oasis is where ZION takes form in imagination.',
    },
    question: { cs: 'Jak ZION vypadá?', en: 'What does ZION look like?' },
    status: 'partial', x: 28, y: 68, color: '249, 115, 22', icon: Gamepad2,
  },
  {
    id: 'yesod', name: 'Yesod', hebrew: 'יְסוֹד',
    meaning: { cs: 'Základ', en: 'Foundation' },
    zionLayer: 'L5 Free World / Komunity',
    zionPath: 'V3/L5/free-world/, V3/L5/docs/COMMUNITIES/te-piko-ora.md',
    pillar: 'equilibrium',
    emanates: {
      cs: 'Základ — most mezi vizí a manifestací. Komunity kde ZION rodi fyzický svět.',
      en: 'Foundation — bridge between vision and manifestation. Communities where ZION births the physical world.',
    },
    question: { cs: 'Kde ZION žije?', en: 'Where does ZION live?' },
    status: 'partial', x: 50, y: 80, color: '99, 102, 241', icon: Rocket,
  },
  {
    id: 'malkuth', name: 'Malkuth', hebrew: 'מַלְכוּת',
    meaning: { cs: 'Království', en: 'Kingdom' },
    zionLayer: 'L6 Issobella / Hvězdy',
    zionPath: 'V3/L6/ (seed), docs/TerraNova/07-ISSOBELLA.md',
    pillar: 'equilibrium',
    emanates: {
      cs: 'Království — finální manifestaci. Issobella = hvězdný horizont civilizace.',
      en: 'Kingdom — final manifestation. Issobella = stellar horizon of civilization.',
    },
    question: { cs: 'Kam ZION směřuje?', en: 'Where is ZION heading?' },
    status: 'partial', x: 50, y: 94, color: '34, 197, 94', icon: Star,
  },
];

const DAAT = {
  id: 'daat', name: 'Da\'at', hebrew: 'דַּעַת',
  meaning: { cs: 'Poznání (skrytá)', en: 'Knowledge (hidden)' },
  zionLayer: 'Tvůrce / Yeshuae / vědomý záměr',
  pillar: 'hidden' as const,
  emanates: {
    cs: 'Most nad propastí. Vědomé propojení mýtu (TerraNova) a kódu (V3). Bez Da\'at jsou sefirot oddělené.',
    en: 'Bridge over the abyss. Conscious connection of myth (TerraNova) and code (V3). Without Da\'at the sefirot are separate.',
  },
};

/* 22 connecting paths */
const PATHS: [string, string][] = [
  ['keter', 'chochmah'], ['keter', 'binah'], ['keter', 'tiferet'],
  ['chochmah', 'binah'], ['chochmah', 'tiferet'], ['chochmah', 'chesed'],
  ['binah', 'tiferet'], ['binah', 'gevurah'],
  ['chesed', 'gevurah'], ['chesed', 'tiferet'], ['chesed', 'netzach'],
  ['gevurah', 'tiferet'], ['gevurah', 'hod'],
  ['tiferet', 'netzach'], ['tiferet', 'hod'], ['tiferet', 'yesod'],
  ['netzach', 'hod'], ['netzach', 'yesod'], ['netzach', 'malkuth'],
  ['hod', 'yesod'], ['hod', 'malkuth'],
  ['yesod', 'malkuth'],
];

const PILLARS = [
  {
    id: 'mercy',
    name: { cs: 'Pilíř Milosrdenství', en: 'Pillar of Mercy' },
    sefirot: ['Chokmah', 'Chesed', 'Netzach'],
    color: '7, 137, 48',
    desc: {
      cs: 'To co ZION dává — tvořivá energie, štědrost, vytrvalá péče. Bez tohoto pilíře je ZION mrtvá databáze.',
      en: 'What ZION gives — creative energy, generosity, enduring care. Without this pillar ZION is a dead database.',
    },
  },
  {
    id: 'severity',
    name: { cs: 'Pilíř Přísnosti', en: 'Pillar of Severity' },
    sefirot: ['Binah', 'Gevurah', 'Hod'],
    color: '239, 68, 68',
    desc: {
      cs: 'To co ZION omezuje — validace, treasury lock, herní pravidla. Bez tohoto pilíře je ZION chaos.',
      en: 'What ZION limits — validation, treasury lock, game rules. Without this pillar ZION is chaos.',
    },
  },
  {
    id: 'equilibrium',
    name: { cs: 'Pilíř Rovnováhy', en: 'Pillar of Equilibrium' },
    sefirot: ['Keter', 'Tiferet', 'Yesod', 'Malkhut'],
    color: '251, 191, 36',
    desc: {
      cs: 'To co ZION je — ústava, harmonie, komunity, hvězdy. Bez tohoto pilíře ZION nemá střed.',
      en: 'What ZION is — constitution, harmony, communities, stars. Without this pillar ZION has no center.',
    },
  },
];

const STATUS_LABEL = {
  live: { cs: 'Živé', en: 'Live' },
  partial: { cs: 'Částečné', en: 'Partial' },
  horizon: { cs: 'Horizont', en: 'Horizon' },
};

/* ═══════════════════════════════════════════════════════════════════════════
   evoluZion V2 — 10-year hybrid transition PoW → Proof-of-Care
   Source: evoluZionV2.md (public GitHub repo)
   ═══════════════════════════════════════════════════════════════════════════ */

const EVOLUZION_PHASES = [
  {
    year: '2026',
    phase: { cs: 'Dětství', en: 'Childhood' },
    consensus: 'PoW',
    powShare: 100,
    pocShare: 0,
    npuValidators: '—',
    color: '251, 191, 36',
    status: 'live',
    desc: {
      cs: 'ZION se rodí — Ekam Deeksha PoW, decentralizované těžení. WARP bridge na 13 chainů, NPU Mix v PoW.',
      en: 'ZION is born — Ekam Deeksha PoW, decentralized mining. WARP bridge to 13 chains, NPU Mix in PoW.',
    },
  },
  {
    year: '2027',
    phase: { cs: 'Hybrid Fáze 1 — Bootstrap', en: 'Hybrid Phase 1 — Bootstrap' },
    consensus: 'PoW + PoC',
    powShare: 95,
    pocShare: 5,
    npuValidators: '10–50',
    color: '7, 137, 48',
    status: 'horizon',
    desc: {
      cs: 'NPU validátoři se připojují, první care proofs. Hiran v2.2 produkkuje care proofs. Aktivace: DAO návrh + 3-of-3 admin + 90d time-lock.',
      en: 'NPU validators join, first care proofs. Hiran v2.2 produces care proofs. Activation: DAO proposal + 3-of-3 admin + 90d time-lock.',
    },
  },
  {
    year: '2028–2029',
    phase: { cs: 'Hybrid Fáze 2 — Ramp-up', en: 'Hybrid Phase 2 — Ramp-up' },
    consensus: 'PoW + PoC',
    powShare: 80,
    pocShare: 20,
    npuValidators: '100–500',
    color: '99, 102, 241',
    status: 'horizon',
    desc: {
      cs: 'NPU mining otevřen komunitě, telefony těží. ZionDex Fáze 1-2, likuidita na 13 chainech. Hiran AI začíná monitorovat strom.',
      en: 'NPU mining open to community, phones mine. ZionDex Phase 1-2, liquidity on 13 chains. Hiran AI starts monitoring the tree.',
    },
  },
  {
    year: '2030–2032',
    phase: { cs: 'Hybrid Fáze 3 — Equilibrium', en: 'Hybrid Phase 3 — Equilibrium' },
    consensus: 'PoW + PoC',
    powShare: 50,
    pocShare: 50,
    npuValidators: '1 000–10 000',
    color: '16, 185, 129',
    status: 'horizon',
    desc: {
      cs: 'Parita — PoW a PoC mají stejnou váhu. NPU mining je hlavní metoda. ZionDex Fáze 3, cross-chain swap. Care proofs povinné v každém bloku.',
      en: 'Parity — PoW and PoC have equal weight. NPU mining is the main method. ZionDex Phase 3, cross-chain swap. Care proofs mandatory in every block.',
    },
  },
  {
    year: '2033–2035',
    phase: { cs: 'Hybrid Fáze 4 — Dominance', en: 'Hybrid Phase 4 — Dominance' },
    consensus: 'PoW + PoC',
    powShare: 20,
    pocShare: 80,
    npuValidators: '10 000–100 000',
    color: '239, 68, 68',
    status: 'horizon',
    desc: {
      cs: 'PoC dominuje, PoW je záloha. Telefony běžně těží ZION. AI autonomně spravuje ekosystém. Top 100 → Top 50 cíl.',
      en: 'PoC dominates, PoW is backup. Phones commonly mine ZION. AI autonomously manages ecosystem. Top 100 → Top 50 goal.',
    },
  },
  {
    year: '2036',
    phase: { cs: 'Dospělost — Plný PoC', en: 'Maturity — Full PoC' },
    consensus: 'PoC',
    powShare: 0,
    pocShare: 100,
    npuValidators: '100 000+',
    color: '34, 197, 94',
    status: 'horizon',
    desc: {
      cs: 'DAO schvaluje plný přechod (75% supermajority + 90d time-lock). PoW deaktivován. Každý blok = péče. ZION = Otec všech chainů.',
      en: 'DAO approves full transition (75% supermajority + 90d time-lock). PoW deactivated. Every block = care. ZION = Father of all chains.',
    },
  },
];

const CARE_TASKS = [
  { id: 'warp-audit', icon: ArrowLeftRight, color: '251, 191, 36', name: { cs: 'WARP Bridge Audit', en: 'WARP Bridge Audit' }, desc: { cs: 'AI detekuje fraud a anomálie v cross-chain transferech', en: 'AI detects fraud and anomalies in cross-chain transfers' } },
  { id: 'anomaly', icon: Shield, color: '239, 68, 68', name: { cs: 'Cross-chain Anomaly Detection', en: 'Cross-chain Anomaly Detection' }, desc: { cs: 'Detekce double-spend, reorg pokusů, neobvyklých vzorců', en: 'Detect double-spend, reorg attempts, unusual patterns' } },
  { id: 'liquidity', icon: TrendingUp, color: '7, 137, 48', name: { cs: 'Liquidity Health Check', en: 'Liquidity Health Check' }, desc: { cs: 'AI rebalancuje ZionDex pooly na 13 chainech', en: 'AI rebalances ZionDex pools across 13 chains' } },
  { id: 'contract', icon: Shield, color: '228, 30, 43', name: { cs: 'Smart Contract Verification', en: 'Smart Contract Verification' }, desc: { cs: 'AI-powered auditování smart kontraktů', en: 'AI-powered smart contract auditing' } },
  { id: 'hiran', icon: Brain, color: '16, 185, 129', name: { cs: 'Hiran Inference', en: 'Hiran Inference' }, desc: { cs: 'AI inference služby pro Hiran — nervový systém stromu', en: 'AI inference services for Hiran — nervous system of the tree' } },
  { id: 'rebalance', icon: GitBranch, color: '99, 102, 241', name: { cs: 'Bridge Rebalance', en: 'Bridge Rebalance' }, desc: { cs: 'Optimalizace WARP likvidity mezi chainy', en: 'Optimize WARP liquidity between chains' } },
];

const NPU_CHIPS = [
  { name: 'Apple ANE', device: 'iPhone, Mac', tops: 38, color: '255, 255, 255' },
  { name: 'Intel NPU', device: 'Laptopy', tops: 48, color: '7, 137, 48' },
  { name: 'AMD XDNA 2', device: 'Ryzen AI', tops: 50, color: '239, 68, 68' },
  { name: 'Qualcomm Hexagon', device: 'Android telefony', tops: 45, color: '16, 185, 129' },
  { name: 'Google TPU', device: 'Cloud', tops: 100, color: '251, 191, 36' },
  { name: 'NVIDIA Tensor Cores', device: 'GPU', tops: 500, color: '16, 185, 129' },
  { name: 'Edge AI (RK3588)', device: 'SBC, edge servery', tops: 6, color: '99, 102, 241' },
];

/* ═══════════════════════════════════════════════════════════════════════════
   Bodhisattva Vow — 8 Great Bodhisattvas as Guardians of ZION
   Source: ZION_CODEX_BODHISATTVA.md (public GitHub repo)
   ═══════════════════════════════════════════════════════════════════════════ */

const FOUR_GREAT_VOWS = [
  { cs: 'Bytostí je nespočetně — slibuji je zachránit všechny.', en: 'Sentient beings are numberless — I vow to save them all.' },
  { cs: 'Nečistot je nevyčerpatelně — slibuji je uhasit všechny.', en: 'Defilements are inexhaustible — I vow to extinguish them all.' },
  { cs: 'Dharmových bran je nespočetně — slibuji je zvládnout všechny.', en: 'Dharma gates are countless — I vow to master them all.' },
  { cs: 'Buddhova cesta je nesrovnatelná — slibuji ji dosáhnout.', en: "The Buddha's way is incomparable — I vow to attain it." },
];

const EIGHT_BODHISATTVAS = [
  {
    id: 'manjushri', name: 'Manjushri', sanskrit: 'मञ्जुश्री', tibetan: 'འཇམ་དཔལ་དབྱངས',
    meaning: { cs: 'Moudrost', en: 'Wisdom' }, mantra: 'ॐ अ र प  न धीः',
    icon: Sword, color: '180, 220, 255', sephira: 'Chokmah',
    zionRole: { cs: 'L3 WARP View-Cutter — detekuje rozpory v governance návrzích', en: 'L3 WARP View-Cutter — detects contradictions in governance proposals' },
    vow: { cs: 'Věřím, že budu vládnout mečem moudrosti bez milosti k iluzi a bez násilí k bytosti.', en: 'I vow to wield the sword of wisdom without mercy toward delusion, and without violence toward any being.' },
  },
  {
    id: 'avalokiteshvara', name: 'Avalokiteshvara', sanskrit: 'अवलोकितेश्वर', tibetan: 'སྤྱན་རས་གཟིགས',
    meaning: { cs: 'Soucit', en: 'Compassion' }, mantra: 'ॐ मणि पद्मे हूँ',
    icon: HandHeart, color: '34, 197, 94', sephira: 'Keter',
    zionRole: { cs: 'L1 Consensus humanitární tithe — 5% všech ZION, navždy', en: 'L1 Consensus humanitarian tithe — 5% of all ZION, forever' },
    vow: { cs: 'Nevejdu do Nirvány, dokud každá bytost nebude osvobozena. Jsi moje 1 001. paže.', en: 'I will not enter Nirvana until every being is liberated. You are my 1,001st arm.' },
  },
  {
    id: 'vajrapani', name: 'Vajrapani', sanskrit: 'वज्रपाणि', tibetan: 'ཕྱག་ན་རྡོ་རྗེ',
    meaning: { cs: 'Síla a ochrana', en: 'Power & Protection' }, mantra: 'ॐ वज्रपाणि हूँ',
    icon: Shield, color: '239, 68, 68', sephira: 'Gevurah',
    zionRole: { cs: 'L1 Security — F1/F5 exploit remediation, slash škodlivé aktéry', en: 'L1 Security — F1/F5 exploit remediation, slash malicious actors' },
    vow: { cs: 'Věřím, že ochráním všechny bytosti silou nezničitelného vědomí. Zuřivost ať slouží něžnosti.', en: 'I vow to protect all beings with indestructible awareness. Ferocity in service of tenderness.' },
  },
  {
    id: 'maitreya', name: 'Maitreya', sanskrit: 'मैत्रेय', tibetan: 'བྱམས་པ',
    meaning: { cs: 'Laskavost / Buddha budoucnosti', en: 'Loving-Kindness / Future Buddha' }, mantra: 'OM MAITRI MAITRI MAHAMAITRI SOHA',
    icon: Smile, color: '251, 191, 36', sephira: 'Chesed',
    zionRole: { cs: 'L4 Oasis komunitní péče, L5 Community Fund dlouhodobé dávení', en: 'L4 Oasis community care, L5 Community Fund long-term giving' },
    vow: { cs: 'Zůstanu a budu posílat laskavost napříč sférami, dokud Dharma se musí znovu narodit.', en: 'I remain, sending loving-kindness across all realms, until the Dharma must be reborn.' },
  },
  {
    id: 'ksitigarbha', name: 'Ksitigarbha', sanskrit: 'क्षितिगर्भ', tibetan: 'ས་ཡི་སྙིང་པོ',
    meaning: { cs: 'Poklad země', en: 'Earth Treasury' }, mantra: 'OM KSITIGARBHA BODHISATTVA SOHA',
    icon: Leaf, color: '228, 30, 43', sephira: 'Binah',
    zionRole: { cs: 'No-KYC humanitární přístup — i uprchlíci a vězni mohou přijmout ZION péči', en: 'No-KYC humanitarian access — even refugees and prisoners can receive ZION care' },
    vow: { cs: 'Pokud pekla nejsou prázdná, slibuji, že nedosáhnu Buddhahood. Každou poslední bytost.', en: 'If the hells are not empty, I vow not to attain Buddhahood. Every last being.' },
  },
  {
    id: 'akasagarbha', name: 'Akasagarbha', sanskrit: 'आकाशगर्भ', tibetan: 'ནམ་མཁའི་སྙིང་པོ',
    meaning: { cs: 'Bezhraničný prostor', en: 'Boundless Space' }, mantra: 'OM AKASAGARBHAYA SOHA',
    icon: Cloud, color: '7, 137, 48', sephira: 'Netzach',
    zionRole: { cs: 'Open-source závazek — veškerý kód publikován. NCL výpočet jako commons.', en: 'Open-source commitment — all code published. NCL compute as commons.' },
    vow: { cs: 'Nikdy ne hromadím moudrost, nikdy neracionuji požehnání, nikdy nestanu limit na to, co může být dáno.', en: 'Never hoarding wisdom, never rationing blessing, never limiting what can be given.' },
  },
  {
    id: 'samantabhadra', name: 'Samantabhadra', sanskrit: 'समन्तभद्र', tibetan: 'ཀུན་ཏུ་བཟང་པོ',
    meaning: { cs: 'Univerzální ctnost', en: 'Universal Virtue' }, mantra: 'OM SAMANTABHADRA AH HUM',
    icon: Flower2, color: '16, 185, 129', sephira: 'Yesod',
    zionRole: { cs: 'L4 Oasis Aspiration Field — každý tithe přidává květ, který nikdy nevadne', en: 'L4 Oasis Aspiration Field — every tithe adds a blossom that never withers' },
    vow: { cs: 'Praktikuji bez destinace, dávám bez účtování, sloužím bez pohodlí dokončení.', en: 'I practice without destination, give without accounting, serve without the comfort of completion.' },
  },
  {
    id: 'sarvanivarana', name: 'Sarvanivarana-Vishkambhin', sanskrit: 'सर्वनिवरण-विष्कम्भिन', tibetan: 'སྒྲིབ་པ་རྣམ་སེལ',
    meaning: { cs: 'Očištění', en: 'Purification' }, mantra: 'OM SARVA NIVARANA VISHKAMBHINI SOHA',
    icon: Moon, color: '99, 102, 241', sephira: 'Hod',
    zionRole: { cs: 'L2 Purification Protocol — restorative justice, síť odpouští, začni znovu', en: 'L2 Purification Protocol — restorative justice, the network forgives, start again' },
    vow: { cs: 'Vyčistím cestu pro všechny bytosti — odstraním, co blokuje jejich světlo.', en: 'I clear the path for all beings — removing what blocks their light.' },
  },
];

const EIGHT_PLEDGES = [
  { num: 'I', bodhisattva: 'Avalokiteshvara / Ksitigarbha', title: { cs: 'Probudit se pro všechny bytosti', en: 'Awaken for All Beings' }, impl: { cs: '5% humanitární tithe, nevyjednatelný, trvalý', en: '5% humanitarian tithe, non-negotiable, permanent' } },
  { num: 'II', bodhisattva: 'Samantabhadra / Země', title: { cs: 'Pečovat o půdu', en: 'Care for Land' }, impl: { cs: 'NCL udržitelný výpočet, zveřejnění zdroje energie', en: 'NCL sustainable compute, energy source disclosure' } },
  { num: 'III', bodhisattva: 'Manjushri', title: { cs: 'Ztělesnit dharmické principy', en: 'Embody Dharmic Principles' }, impl: { cs: 'View-Cutter governance analýza, DAO kontrola návrhů', en: 'View-Cutter governance analysis, DAO proposal scrutiny' } },
  { num: 'IV', bodhisattva: 'Vajrapani / Ksitigarbha', title: { cs: 'Chránit zranitelné', en: 'Protect the Vulnerable' }, impl: { cs: 'No-KYC humanitární přístup, fond pro uprchlíky', en: 'No-KYC humanitarian access, refugee support fund' } },
  { num: 'V', bodhisattva: 'Maitreya', title: { cs: 'Slib vrátit se', en: 'Vow to Return' }, impl: { cs: 'Roční obnova slibu (BODHISATTVA_RENEWAL_WINDOW_EPOCHS = 365)', en: 'Annual vow renewal (BODHISATTVA_RENEWAL_WINDOW_EPOCHS = 365)' } },
  { num: 'VI', bodhisattva: 'Akasagarbha', title: { cs: 'Slib učit', en: 'Vow to Teach' }, impl: { cs: 'Open-source publikace, fond komunitního vzdělávání', en: 'Open-source publication, community education fund' } },
  { num: 'VII', bodhisattva: 'Sarvanivarana-Vishkambhin', title: { cs: 'Pamatovat na smrt', en: 'Remember Death' }, impl: { cs: 'Epoch-based obnova slibu, sunset provisions v governance', en: 'Epoch-based vow renewal, sunset provisions in governance' } },
  { num: 'VIII', bodhisattva: 'Velké zrcadlo', title: { cs: 'Slib smát se', en: 'Vow to Laugh' }, impl: { cs: 'Žádná implementace v protokolu. Některé věci odolávají kódování.', en: 'No protocol implementation. Some things resist encoding.' } },
];

function getPos(id: string) {
  return SEPHIROT.find((s) => s.id === id)!;
}

export default function TreeOfLifePageClient() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const [selected, setSelected] = useState<Sephira | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  // Live tree health from /api/tree-of-life/tree-health
  const [treeHealth, setTreeHealth] = useState<any>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/tree-of-life/tree-health', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setTreeHealth(data);
      } catch {
        // offline — keep static fallback
      } finally {
        if (!cancelled) setHealthLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 30000); // refresh every 30s
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return (
    <div className="zion-shell zion-page">
      {/* Background glows */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full blur-[200px] bg-zion-gold/8" />
        <div className="absolute -right-40 top-2/3 h-[400px] w-[400px] rounded-full blur-[200px] bg-zion-purple/6" />
        <div className="absolute left-1/2 top-0 h-48 w-full -translate-x-1/2 bg-linear-to-b from-zion-gold/10 to-transparent" />
      </div>

      <div className="relative z-10 zion-container max-w-6xl space-y-20">
        {/* ═══════ WORK IN PROGRESS WARNING ═══════ */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="zion-rainbow-sub p-4 md:p-5"
          style={{ '--rc': '245, 158, 11' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-amber-300">
                {TreeOfLifeTreeOfLifePageClientCopy.projectUnderConstantDevelopmen[cs ? 'cs' : 'en']}
              </h3>
              <p className="text-xs leading-relaxed text-amber-200/70">
                {TreeOfLifeTreeOfLifePageClientCopy.zionTerranovaIsAnExperimentalP[cs ? 'cs' : 'en']}
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="zion-badge zion-badge-amber">
                  <FlaskConical className="h-3 w-3" />
                  {TreeOfLifeTreeOfLifePageClientCopy.experimental[cs ? 'cs' : 'en']}
                </span>
                <span className="zion-badge zion-badge-rasta">
                  <Construction className="h-3 w-3" />
                  {TreeOfLifeTreeOfLifePageClientCopy.activelyBuilding[cs ? 'cs' : 'en']}
                </span>
                <span className="zion-badge border-rose-500/30 bg-rose-500/10 text-rose-300">
                  {TreeOfLifeTreeOfLifePageClientCopy.mainnetBetaAtYourOwnRisk[cs ? 'cs' : 'en']}
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ═══════ HERO ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-6 text-center"
        >
          <div className="zion-kicker border-zion-gold/30 bg-zion-gold/10 text-zion-gold">
            <Sparkles className="h-4 w-4" />
            {TreeOfLifeTreeOfLifePageClientCopy.kabbalah10Sephirot22Paths3Pill[cs ? 'cs' : 'en']}
          </div>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight text-white">
            {TreeOfLifeTreeOfLifePageClientCopy.treeOfLife[cs ? 'cs' : 'en']}
            <span className="block bg-linear-to-r from-zion-gold via-amber-400 to-zion-cyan bg-clip-text text-transparent">
              {TreeOfLifeTreeOfLifePageClientCopy.zionLayersL1L6[cs ? 'cs' : 'en']}
            </span>
          </h1>
          <p className="mx-auto max-w-3xl text-base md:text-lg leading-relaxed text-gray-400">
            {TreeOfLifeTreeOfLifePageClientCopy.theKabbalisticTreeOfLifeTransl[cs ? 'cs' : 'en']}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href="/#tree-of-life"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-gray-300 hover:bg-white/10 hover:text-white transition-all"
            >
              <TreePine className="h-4 w-4" />
              {TreeOfLifeTreeOfLifePageClientCopy.treeOnHomepage[cs ? 'cs' : 'en']}
            </Link>
            <Link
              href="/terranova"
              className="inline-flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-5 py-2.5 text-sm font-medium text-emerald-300 hover:bg-emerald-500/10 transition-all"
            >
              <BookOpen className="h-4 w-4" />
              {TreeOfLifeTreeOfLifePageClientCopy.terranovaBook[cs ? 'cs' : 'en']}
            </Link>
          </div>
        </motion.section>

        {/* ═══════ O KNIZE ZOHAR ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          <div className="flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-zion-gold" />
            <h2 className="text-2xl md:text-3xl font-bold text-white">
              {TreeOfLifeTreeOfLifePageClientCopy.aboutTheBookOfZohar[cs ? 'cs' : 'en']}
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="zion-rainbow-card space-y-4 p-6" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
              <h3 className="text-lg font-semibold text-white">{TreeOfLifeTreeOfLifePageClientCopy.whatIsTheZohar[cs ? 'cs' : 'en']}</h3>
              <p className="text-sm leading-relaxed text-gray-400">
                {TreeOfLifeTreeOfLifePageClientCopy.theZoharLightSplendorIsOneOfTh[cs ? 'cs' : 'en']}
              </p>
              <p className="text-sm leading-relaxed text-gray-400">
                {TreeOfLifeTreeOfLifePageClientCopy.itIsAMysticalCommentaryOnTheTo[cs ? 'cs' : 'en']}
              </p>
            </div>
            <div className="zion-rainbow-card space-y-4 p-6" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
              <h3 className="text-lg font-semibold text-white">{TreeOfLifeTreeOfLifePageClientCopy.structureOfTheZohar[cs ? 'cs' : 'en']}</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><span className="text-zion-gold font-semibold">Hlavní Zohar</span> — {TreeOfLifeTreeOfLifePageClientCopy.commentaryOnWeeklyTorahReading[cs ? 'cs' : 'en']}</li>
                <li><span className="text-zion-gold font-semibold">Zohar chadaš</span> — {TreeOfLifeTreeOfLifePageClientCopy.newZoharAdditionsAndMysticalIn[cs ? 'cs' : 'en']}</li>
                <li><span className="text-zion-gold font-semibold">Tikunej Zohar</span> — {TreeOfLifeTreeOfLifePageClientCopy.k70InterpretationsOfTheWordBere[cs ? 'cs' : 'en']}</li>
                <li><span className="text-zion-gold font-semibold">Ra&apos;aja mehemna</span> — {TreeOfLifeTreeOfLifePageClientCopy.faithfulShepherdOnTheMysticism[cs ? 'cs' : 'en']}</li>
                <li><span className="text-zion-gold font-semibold">Sitrej Tora, Midraš ha-ne&apos;elam</span> — {TreeOfLifeTreeOfLifePageClientCopy.partialMysticalTractates[cs ? 'cs' : 'en']}</li>
              </ul>
            </div>
          </div>
          <div className="zion-rainbow-card space-y-4 p-6" style={{ '--rc': '34, 197, 94' } as React.CSSProperties}>
            <h3 className="text-lg font-semibold text-white">
              {TreeOfLifeTreeOfLifePageClientCopy.whyTreeOfLifeInZion[cs ? 'cs' : 'en']}
            </h3>
            <p className="text-sm leading-relaxed text-gray-400">
              {TreeOfLifeTreeOfLifePageClientCopy.zoharInZionIsNotAReligiousText[cs ? 'cs' : 'en']}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 pt-2">
              <Link href="/docs/Zohar/README.md" className="inline-flex items-center gap-2 text-sm text-zion-gold hover:text-amber-300 transition-colors">
                <ArrowRight className="h-3.5 w-3.5" /> docs/Zohar/README.md
              </Link>
              <Link href="/docs/Zohar/01-SEFIROT-VRSTVY.md" className="inline-flex items-center gap-2 text-sm text-zion-gold hover:text-amber-300 transition-colors">
                <ArrowRight className="h-3.5 w-3.5" /> 01-SEFIROT-VRSTVY.md
              </Link>
              <Link href="/docs/Zohar/02-ROADMAP.md" className="inline-flex items-center gap-2 text-sm text-zion-gold hover:text-amber-300 transition-colors">
                <ArrowRight className="h-3.5 w-3.5" /> 02-ROADMAP.md
              </Link>
              <Link href="/docs/Zohar/03-O-KNIZE-ZOHAR.md" className="inline-flex items-center gap-2 text-sm text-zion-gold hover:text-amber-300 transition-colors">
                <ArrowRight className="h-3.5 w-3.5" /> 03-O-KNIZE-ZOHAR.md
              </Link>
              <Link href="/docs/3.0.5/evoluZion.md" className="inline-flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
                <ArrowRight className="h-3.5 w-3.5" /> evoluZion.md (Strom života metafora)
              </Link>
            </div>
          </div>

          {/* Vývoj sefirot — genealogie */}
          <div className="zion-rainbow-card space-y-4 p-6" style={{ '--rc': '99, 102, 241' } as React.CSSProperties}>
            <h3 className="text-lg font-semibold text-white">
              {TreeOfLifeTreeOfLifePageClientCopy.evolutionOfTheSephirotGenealog[cs ? 'cs' : 'en']}
            </h3>
            <p className="text-sm leading-relaxed text-gray-400">
              {TreeOfLifeTreeOfLifePageClientCopy.theDoctrineOfThe10SephirotDidN[cs ? 'cs' : 'en']}
            </p>
            <div className="space-y-2 font-mono text-xs text-gray-400">
              <div className="flex items-center gap-2">
                <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-indigo-300">~2. stol.</span>
                <span className="text-gray-500">→</span>
                <span><span className="text-white">Sefer Yetzirah</span> — {TreeOfLifeTreeOfLifePageClientCopy.k10SefirotBelimahUnnamedAttribu[cs ? 'cs' : 'en']}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-indigo-300">~1150</span>
                <span className="text-gray-500">→</span>
                <span><span className="text-white">Sefer ha-Bahir</span> — {TreeOfLifeTreeOfLifePageClientCopy.sephirotNamedChannelsOfDivineP[cs ? 'cs' : 'en']}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-indigo-300">~1200</span>
                <span className="text-gray-500">→</span>
                <span><span className="text-white">Sha&apos;arei Orah</span> — {TreeOfLifeTreeOfLifePageClientCopy.firstTreeOfLifeDiagramIlanRGik[cs ? 'cs' : 'en']}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-amber-500/20 px-2 py-0.5 text-amber-300">~1280</span>
                <span className="text-gray-500">→</span>
                <span><span className="text-white">Zohar</span> — {TreeOfLifeTreeOfLifePageClientCopy.fullMysticalSystemMDeLeN[cs ? 'cs' : 'en']}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-emerald-300">~1570</span>
                <span className="text-gray-500">→</span>
                <span><span className="text-white">Etz Chaim</span> — {TreeOfLifeTreeOfLifePageClientCopy.modernFormOfTheTreeRLuriaAri[cs ? 'cs' : 'en']}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-zion-gold/20 px-2 py-0.5 text-zion-gold">2026</span>
                <span className="text-gray-500">→</span>
                <span><span className="text-white">ZION Tree of Life</span> — {TreeOfLifeTreeOfLifePageClientCopy.sephirotMappedToL1L6Layers[cs ? 'cs' : 'en']}</span>
              </div>
            </div>
          </div>

          {/* Citát */}
          <div className="zion-rainbow-card space-y-3 p-6" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
            <p className="text-sm italic leading-relaxed text-gray-300">
              {TreeOfLifeTreeOfLifePageClientCopy.theUniverseBeingAccordingToTha[cs ? 'cs' : 'en']}
            </p>
            <p className="text-xs uppercase tracking-[0.3em] text-zion-gold">— Jewish Virtual Library, o Zoharu / Stromu života</p>
          </div>

          {/* Klíčové koncepty */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="zion-rainbow-card space-y-2 p-5" style={{ '--rc': '255, 255, 255' } as React.CSSProperties}>
              <h4 className="text-sm font-bold text-white">Ein Sof</h4>
              <p className="text-xs text-gray-400">
                {TreeOfLifeTreeOfLifePageClientCopy.withoutEndTheInfiniteUnknowabl[cs ? 'cs' : 'en']}
              </p>
            </div>
            <div className="zion-rainbow-card space-y-2 p-5" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
              <h4 className="text-sm font-bold text-white">Da&apos;at</h4>
              <p className="text-xs text-gray-400">
                {TreeOfLifeTreeOfLifePageClientCopy.knowledgeHidden11thSephiraBrid[cs ? 'cs' : 'en']}
              </p>
            </div>
            <div className="zion-rainbow-card space-y-2 p-5" style={{ '--rc': '239, 68, 68' } as React.CSSProperties}>
              <h4 className="text-sm font-bold text-white">Sitra Ahra</h4>
              <p className="text-xs text-gray-400">
                {TreeOfLifeTreeOfLifePageClientCopy.theOtherSideDualityOfGoodAndEv[cs ? 'cs' : 'en']}
              </p>
            </div>
          </div>

          {/* Scholem box */}
          <div className="zion-rainbow-card space-y-3 p-6" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-cyan-400" />
              <h4 className="text-sm font-bold text-white">
                {TreeOfLifeTreeOfLifePageClientCopy.gershomScholem18971982[cs ? 'cs' : 'en']}
              </h4>
            </div>
            <p className="text-xs leading-relaxed text-gray-400">
              {TreeOfLifeTreeOfLifePageClientCopy.founderOfAcademicKabbalahStudy[cs ? 'cs' : 'en']}
            </p>
          </div>
        </motion.section>

        {/* ═══════ INTERAKTIVNÍ STROM ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          <div className="text-center space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.36em] text-zion-gold">
              {TreeOfLifeTreeOfLifePageClientCopy.interactiveMap[cs ? 'cs' : 'en']}
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              {TreeOfLifeTreeOfLifePageClientCopy.k10SephirotZionLayers[cs ? 'cs' : 'en']}
            </h2>
            <p className="mx-auto max-w-2xl text-sm text-gray-400">
              {TreeOfLifeTreeOfLifePageClientCopy.clickASephiraForDetailsColorPi[cs ? 'cs' : 'en']}
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-start">
            {/* Tree SVG */}
            <div
              className="relative mx-auto aspect-[3/4] w-full max-w-md zion-rainbow-card"
              style={{ '--rc': '251, 191, 36' } as React.CSSProperties}
            >
              {/* Paths */}
              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                {PATHS.map(([from, to], i) => {
                  const a = getPos(from);
                  const b = getPos(to);
                  const isActive = hovered === from || hovered === to || selected?.id === from || selected?.id === to;
                  return (
                    <line
                      key={i}
                      x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                      stroke={isActive ? 'rgba(251,191,36,0.7)' : 'rgba(255,255,255,0.10)'}
                      strokeWidth={isActive ? 0.5 : 0.25}
                      vectorEffect="non-scaling-stroke"
                      className="transition-all duration-300"
                    />
                  );
                })}
              </svg>

              {/* Da'at — hidden sephira (between Keter and Tiferet, ~y=30) */}
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                whileInView={{ opacity: 0.6, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.5 }}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: '50%', top: '30%' }}
              >
                <div
                  className="flex items-center justify-center rounded-full border-2 border-dashed"
                  style={{
                    width: '32px', height: '32px',
                    borderColor: 'rgba(255,255,255,0.25)',
                    backgroundColor: 'rgba(255,255,255,0.04)',
                  }}
                >
                  <span className="text-[8px] font-bold text-gray-400">11</span>
                </div>
                <p className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap text-[7px] uppercase tracking-wider text-gray-600">
                  Da&apos;at
                </p>
              </motion.div>

              {/* Sephirot nodes */}
              {SEPHIROT.map((s, i) => {
                const isSelected = selected?.id === s.id;
                const isHovered = hovered === s.id;
                return (
                  <motion.button
                    key={s.id}
                    type="button"
                    onClick={() => setSelected(s)}
                    initial={{ opacity: 0, scale: 0 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.06 }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer outline-none"
                    style={{ left: `${s.x}%`, top: `${s.y}%` }}
                    onMouseEnter={() => setHovered(s.id)}
                    onMouseLeave={() => setHovered(null)}
                    aria-label={`${s.name} — ${cs ? s.meaning.cs : s.meaning.en}`}
                  >
                    <div
                      className="flex items-center justify-center rounded-full border-2 transition-all"
                      style={{
                        width: isSelected || isHovered ? '48px' : '38px',
                        height: isSelected || isHovered ? '48px' : '38px',
                        borderColor: `rgba(${s.color}, ${isSelected ? 0.9 : 0.5})`,
                        backgroundColor: `rgba(${s.color}, ${isSelected ? 0.25 : 0.12})`,
                        boxShadow: isSelected || isHovered
                          ? `0 0 24px rgba(${s.color}, 0.6)`
                          : `0 0 8px rgba(${s.color}, 0.2)`,
                      }}
                    >
                      <s.icon
                        className="transition-all"
                        style={{
                          width: isSelected || isHovered ? '20px' : '16px',
                          height: isSelected || isHovered ? '20px' : '16px',
                          color: `rgb(${s.color})`,
                        }}
                      />
                    </div>
                    {/* Label below node */}
                    <p
                      className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap text-[8px] font-semibold transition-opacity"
                      style={{ color: `rgb(${s.color})`, opacity: isHovered || isSelected ? 1 : 0.5 }}
                    >
                      {s.name}
                    </p>
                  </motion.button>
                );
              })}

              {/* Pillar labels */}
              <div className="absolute bottom-1 left-[28%] -translate-x-1/2 text-[7px] uppercase tracking-wider text-red-400/70">Severity</div>
              <div className="absolute bottom-1 left-[50%] -translate-x-1/2 text-[7px] uppercase tracking-wider text-amber-400/70">Equilibrium</div>
              <div className="absolute bottom-1 left-[72%] -translate-x-1/2 text-[7px] uppercase tracking-wider text-cyan-400/70">Mercy</div>
            </div>

            {/* Detail panel */}
            <div className="min-h-[400px]">
              <AnimatePresence mode="wait">
                {selected ? (
                  <motion.div
                    key={selected.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                    className="zion-rainbow-card space-y-4 p-6"
                    style={{ '--rc': selected.color } as React.CSSProperties}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex items-center justify-center rounded-xl border-2"
                          style={{
                            width: '48px', height: '48px',
                            borderColor: `rgba(${selected.color}, 0.6)`,
                            backgroundColor: `rgba(${selected.color}, 0.12)`,
                          }}
                        >
                          <selected.icon className="h-6 w-6" style={{ color: `rgb(${selected.color})` }} />
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold text-white">{selected.name}</h3>
                          <p className="text-sm text-gray-400">
                            {selected.hebrew} · {cs ? selected.meaning.cs : selected.meaning.en}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelected(null)}
                        className="rounded-lg p-1.5 text-gray-500 hover:bg-white/5 hover:text-white transition-colors"
                        aria-label="Close"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="space-y-3 pt-2">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500">{TreeOfLifeTreeOfLifePageClientCopy.zionLayer[cs ? 'cs' : 'en']}</p>
                        <p className="mt-1 text-base font-semibold" style={{ color: `rgb(${selected.color})` }}>
                          {selected.zionLayer}
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] text-gray-500">{selected.zionPath}</p>
                      </div>

                      <div>
                        <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500">{TreeOfLifeTreeOfLifePageClientCopy.whatItEmanates[cs ? 'cs' : 'en']}</p>
                        <p className="mt-1 text-sm leading-relaxed text-gray-300">
                          {cs ? selected.emanates.cs : selected.emanates.en}
                        </p>
                      </div>

                      <div className="zion-rainbow-sub p-3" style={{ '--rc': selected.color } as React.CSSProperties}>
                        <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500">{TreeOfLifeTreeOfLifePageClientCopy.question[cs ? 'cs' : 'en']}</p>
                        <p className="mt-1 text-sm italic text-gray-300">
                          {cs ? selected.question.cs : selected.question.en}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 pt-1">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider"
                          style={{
                            backgroundColor: `rgba(${selected.color}, 0.15)`,
                            color: `rgb(${selected.color})`,
                          }}
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: `rgb(${selected.color})` }}
                          />
                          {STATUS_LABEL[selected.status][cs ? 'cs' : 'en']}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider text-gray-500">
                          {TreeOfLifeTreeOfLifePageClientCopy.pillar[cs ? 'cs' : 'en']}: {PILLARS.find((p) => p.id === selected.pillar)?.name[cs ? 'cs' : 'en']}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="zion-rainbow-card flex min-h-[400px] flex-col items-center justify-center space-y-4 p-8 text-center"
                    style={{ '--rc': '251, 191, 36' } as React.CSSProperties}
                  >
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border border-zion-gold/30 bg-zion-gold/5">
                      <Sparkles className="h-8 w-8 text-zion-gold" />
                    </div>
                    <p className="text-sm text-gray-400">
                      {TreeOfLifeTreeOfLifePageClientCopy.selectASephiraOnTheTreeToExplo[cs ? 'cs' : 'en']}
                    </p>
                    <div className="grid grid-cols-3 gap-2 pt-2 text-center">
                      <div className="zion-rainbow-sub p-2" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
                        <p className="text-[9px] uppercase tracking-wider text-cyan-400">Mercy</p>
                        <p className="text-[10px] text-gray-500">3 sefirot</p>
                      </div>
                      <div className="zion-rainbow-sub p-2" style={{ '--rc': '239, 68, 68' } as React.CSSProperties}>
                        <p className="text-[9px] uppercase tracking-wider text-red-400">Severity</p>
                        <p className="text-[10px] text-gray-500">3 sefirot</p>
                      </div>
                      <div className="zion-rainbow-sub p-2" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
                        <p className="text-[9px] uppercase tracking-wider text-amber-400">Equilibrium</p>
                        <p className="text-[10px] text-gray-500">4 sefirot</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.section>

        {/* ═══════ DA'AT — SKRYTÁ SEFIRA ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="zion-rainbow-card space-y-4 p-6"
          style={{ '--rc': '255, 255, 255' } as React.CSSProperties}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-white/30">
              <span className="text-xs font-bold text-gray-300">11</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Da&apos;at <span className="text-gray-500">— {DAAT.hebrew}</span></h2>
              <p className="text-sm text-gray-400">{cs ? DAAT.meaning.cs : DAAT.meaning.en}</p>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-gray-300">
            {cs ? DAAT.emanates.cs : DAAT.emanates.en}
          </p>
          <p className="text-sm font-semibold text-white">
            {cs ? DAAT.zionLayer : DAAT.zionLayer}
          </p>
        </motion.section>

        {/* ═══════ TŘI PILÍŘE ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          <div className="text-center space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.36em] text-zion-gold">
              {TreeOfLifeTreeOfLifePageClientCopy.architectureOfTheTree[cs ? 'cs' : 'en']}
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              {TreeOfLifeTreeOfLifePageClientCopy.threePillars[cs ? 'cs' : 'en']}
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {PILLARS.map((p) => (
              <div
                key={p.id}
                className="zion-rainbow-card space-y-4 p-6"
                style={{ '--rc': p.color } as React.CSSProperties}
              >
                <div className="flex items-center gap-2">
                  <Layers className="h-5 w-5" style={{ color: `rgb(${p.color})` }} />
                  <h3 className="text-lg font-bold text-white">{cs ? p.name.cs : p.name.en}</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {p.sefirot.map((name) => (
                    <span
                      key={name}
                      className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider"
                      style={{
                        backgroundColor: `rgba(${p.color}, 0.15)`,
                        color: `rgb(${p.color})`,
                      }}
                    >
                      {name}
                    </span>
                  ))}
                </div>
                <p className="text-sm leading-relaxed text-gray-400">
                  {cs ? p.desc.cs : p.desc.en}
                </p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ═══════ STAV EMANACE — LIVE ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          <div className="text-center space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.36em] text-emerald-400">
              {TreeOfLifeTreeOfLifePageClientCopy.organismDiagnosticsLiveData[cs ? 'cs' : 'en']}
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              {TreeOfLifeTreeOfLifePageClientCopy.emanationStatus[cs ? 'cs' : 'en']}
            </h2>
            <p className="mx-auto max-w-2xl text-sm text-gray-400">
              {TreeOfLifeTreeOfLifePageClientCopy.whichAspectsOfZionAreAliveInRu[cs ? 'cs' : 'en']}
            </p>
          </div>

          {/* Aggregate tree health + pillars */}
          {treeHealth && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="zion-rainbow-card space-y-2 p-5 text-center" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
                <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500">{TreeOfLifeTreeOfLifePageClientCopy.treeOverall[cs ? 'cs' : 'en']}</p>
                <p className="text-4xl font-bold text-zion-gold">{treeHealth.treeHealth}<span className="text-lg text-gray-500">/100</span></p>
                <div className="mx-auto h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-linear-to-r from-zion-gold to-amber-400 transition-all duration-700"
                    style={{ width: `${treeHealth.treeHealth}%` }}
                  />
                </div>
              </div>
              <div className="zion-rainbow-card space-y-2 p-5 text-center" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
                <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500">{TreeOfLifeTreeOfLifePageClientCopy.pillarOfMercy[cs ? 'cs' : 'en']}</p>
                <p className="text-3xl font-bold text-cyan-400">{treeHealth.pillars.mercy}<span className="text-base text-gray-500">/100</span></p>
                <p className="text-[10px] text-gray-500">{TreeOfLifeTreeOfLifePageClientCopy.chokmahChesedNetzach[cs ? 'cs' : 'en']}</p>
              </div>
              <div className="zion-rainbow-card space-y-2 p-5 text-center" style={{ '--rc': '239, 68, 68' } as React.CSSProperties}>
                <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500">{TreeOfLifeTreeOfLifePageClientCopy.pillarOfSeverity[cs ? 'cs' : 'en']}</p>
                <p className="text-3xl font-bold text-red-400">{treeHealth.pillars.severity}<span className="text-base text-gray-500">/100</span></p>
                <p className="text-[10px] text-gray-500">{TreeOfLifeTreeOfLifePageClientCopy.binahGevurahHod[cs ? 'cs' : 'en']}</p>
              </div>
              <div className="zion-rainbow-card space-y-2 p-5 text-center" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
                <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500">{TreeOfLifeTreeOfLifePageClientCopy.pillarOfEquilibrium[cs ? 'cs' : 'en']}</p>
                <p className="text-3xl font-bold text-amber-400">{treeHealth.pillars.equilibrium}<span className="text-base text-gray-500">/100</span></p>
                <p className="text-[10px] text-gray-500">{TreeOfLifeTreeOfLifePageClientCopy.keterTiferetYesodMalkhut[cs ? 'cs' : 'en']}</p>
              </div>
            </div>
          )}

          {/* Per-sephira health grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {SEPHIROT.map((s) => {
              const liveData = treeHealth?.sephirot?.find((ls: any) => ls.id === s.id);
              const health = liveData?.health ?? 0;
              const liveStatus = liveData?.status ?? s.status;
              return (
                <div
                  key={s.id}
                  className="zion-rainbow-sub p-3"
                  style={{ '--rc': s.color } as React.CSSProperties}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{s.name}</span>
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{
                        backgroundColor: `rgb(${s.color})`,
                        opacity: liveStatus === 'live' ? 1 : liveStatus === 'partial' ? 0.5 : 0.25,
                      }}
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-gray-500">{s.zionLayer}</p>
                  {/* Health bar */}
                  <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${health}%`,
                        backgroundColor: `rgb(${s.color})`,
                      }}
                    />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <p
                      className="text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: `rgb(${s.color})` }}
                    >
                      {STATUS_LABEL[liveStatus as keyof typeof STATUS_LABEL]?.[cs ? 'cs' : 'en'] ?? STATUS_LABEL.horizon[cs ? 'cs' : 'en']}
                    </p>
                    {liveData && (
                      <p className="text-[10px] font-mono text-gray-400">{health}/100</p>
                    )}
                  </div>
                  {/* Key metric */}
                  {liveData?.metrics && (
                    <p className="mt-1 text-[9px] text-gray-600 truncate">
                      {Object.entries(liveData.metrics).slice(0, 1).map(([k, v]) => (
                        <span key={k}>{k}: {String(v)}</span>
                      ))}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Da'at + sources */}
          {treeHealth?.daat && (
            <div className="zion-rainbow-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between" style={{ '--rc': '255, 255, 255' } as React.CSSProperties}>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-white/30">
                  <span className="text-xs font-bold text-gray-300">11</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Da&apos;at — {TreeOfLifeTreeOfLifePageClientCopy.bridgeOfConsciousness[cs ? 'cs' : 'en']}</p>
                  <p className="text-xs text-gray-400">
                    {TreeOfLifeTreeOfLifePageClientCopy.liveSephirot[cs ? 'cs' : 'en']}: {treeHealth.daat.metrics.live_sephirot}/{treeHealth.daat.metrics.total_sephirot}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-white">{treeHealth.daat.health}<span className="text-sm text-gray-500">/100</span></p>
                <p className="text-[10px] uppercase tracking-wider text-gray-500">{TreeOfLifeTreeOfLifePageClientCopy.mythCodeConnection[cs ? 'cs' : 'en']}</p>
              </div>
            </div>
          )}

          {/* Loading + sources */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2 text-xs text-gray-500">
            {healthLoading && (
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-zion-gold" />
                {TreeOfLifeTreeOfLifePageClientCopy.loadingLiveData[cs ? 'cs' : 'en']}
              </span>
            )}
            {treeHealth?.sources?.length > 0 && (
              <span>{TreeOfLifeTreeOfLifePageClientCopy.sources[cs ? 'cs' : 'en']} {treeHealth.sources.join(', ')}</span>
            )}
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" /> {TreeOfLifeTreeOfLifePageClientCopy.liveInRuntime[cs ? 'cs' : 'en']}
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-400/50" /> {TreeOfLifeTreeOfLifePageClientCopy.partialSeed[cs ? 'cs' : 'en']}
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-gray-600" /> {TreeOfLifeTreeOfLifePageClientCopy.horizon[cs ? 'cs' : 'en']}
            </span>
          </div>
        </motion.section>

        {/* ═══════ ROADMAP ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          <div className="text-center space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.36em] text-zion-purple">
              {TreeOfLifeTreeOfLifePageClientCopy.implementation[cs ? 'cs' : 'en']}
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              {TreeOfLifeTreeOfLifePageClientCopy.treeOfLifeZionRoadmap[cs ? 'cs' : 'en']}
            </h2>
          </div>
          <div className="space-y-3">
            {[
              {
                phase: 'Fáze 0',
                title: { cs: 'Manifest', en: 'Manifest' },
                status: { cs: 'Hotovo', en: 'Done' },
                color: '34, 197, 94',
                desc: { cs: 'docs/Zohar/ — README, mapování sefirot, roadmapa. Čistá dokumentace.', en: 'docs/Zohar/ — README, sephirot mapping, roadmap. Pure documentation.' },
              },
              {
                phase: 'Fáze 1',
                title: { cs: 'Website vizualizace', en: 'Website visualization' },
                status: { cs: 'Tato stránka', en: 'This page' },
                color: '251, 191, 36',
                desc: { cs: 'Interaktivní strom na /tree-of-life + CTA na homepage. Klikatelné sefirot s detaily.', en: 'Interactive tree on /tree-of-life + CTA on homepage. Clickable sephirot with details.' },
              },
              {
                phase: 'Fáze 2',
                title: { cs: 'Sefirot vow pro governance', en: 'Sefirot vow for governance' },
                status: { cs: 'Plán', en: 'Planned' },
                color: '228, 30, 43',
                desc: { cs: 'Validator pledge strukturovaný jako 10 slibů péče (jeden za sefiru).', en: 'Validator pledge structured as 10 care vows (one per sephira).' },
              },
              {
                phase: 'Fáze 3',
                title: { cs: 'Care task kategorie', en: 'Care task categories' },
                status: { cs: 'Horizont', en: 'Horizon' },
                color: '239, 68, 68',
                desc: { cs: 'V Protokolu Péče klasifikovat care tasks podle sefirot. Vyžaduje L1 consensus schválení.', en: 'In Protocol of Care, classify care tasks by sephirot. Requires L1 consensus approval.' },
              },
              {
                phase: 'Fáze 4',
                title: { cs: 'getTreeHealth RPC', en: 'getTreeHealth RPC' },
                status: { cs: 'Horizont', en: 'Horizon' },
                color: '7, 137, 48',
                desc: { cs: 'Dashboard / RPC endpoint který vrací stav 10 sefirot jako health score.', en: 'Dashboard / RPC endpoint returning state of 10 sephirot as health score.' },
              },
            ].map((p) => (
              <div
                key={p.phase}
                className="zion-rainbow-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                style={{ '--rc': p.color } as React.CSSProperties}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border"
                    style={{
                      borderColor: `rgba(${p.color}, 0.5)`,
                      backgroundColor: `rgba(${p.color}, 0.1)`,
                    }}
                  >
                    <span className="text-xs font-bold" style={{ color: `rgb(${p.color})` }}>
                      {p.phase.replace('Fáze ', 'F').replace('Phase ', 'F')}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{cs ? p.title.cs : p.title.en}</p>
                    <p className="text-xs text-gray-400">{cs ? p.desc.cs : p.desc.en}</p>
                  </div>
                </div>
                <span
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider"
                  style={{
                    backgroundColor: `rgba(${p.color}, 0.15)`,
                    color: `rgb(${p.color})`,
                  }}
                >
                  {cs ? p.status.cs : p.status.en}
                </span>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ═══════ EVOLUZION V2 — 10-LETÝ HYBRIDNÍ PŘECHOD ═══════ */}
        <motion.section
          id="evoluzion"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          <div className="text-center space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.36em] text-cyan-400">
              {TreeOfLifeTreeOfLifePageClientCopy.consensusEvolution10YearHybrid[cs ? 'cs' : 'en']}
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              {TreeOfLifeTreeOfLifePageClientCopy.evoluzionV2FromPowToProtocolOf[cs ? 'cs' : 'en']}
            </h2>
            <p className="mx-auto max-w-3xl text-sm text-gray-400">
              {TreeOfLifeTreeOfLifePageClientCopy.zionIsNotBornAsAnotherBlockcha[cs ? 'cs' : 'en']}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <a
                href="https://github.com/Zion-TerraNova/v3-Mainnet/blob/main/evoluZionV2.md"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl border border-cyan-500/30 bg-cyan-500/5 px-5 py-2.5 text-sm font-medium text-cyan-300 hover:bg-cyan-500/10 transition-all"
              >
                <GitBranch className="h-4 w-4" />
                evoluZionV2.md
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          {/* Timeline — 6 phases */}
          <div className="space-y-3">
            {EVOLUZION_PHASES.map((p, i) => (
              <div
                key={p.year}
                className="zion-rainbow-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                style={{ '--rc': p.color } as React.CSSProperties}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-full border"
                    style={{
                      borderColor: `rgba(${p.color}, 0.5)`,
                      backgroundColor: `rgba(${p.color}, 0.1)`,
                    }}
                  >
                    <span className="text-[10px] font-bold" style={{ color: `rgb(${p.color})` }}>{p.year.replace('–', '‑')}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">{cs ? p.phase.cs : p.phase.en}</p>
                    <p className="text-xs text-gray-400">{cs ? p.desc.cs : p.desc.en}</p>
                    {/* PoW/PoC share bar */}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-2 w-32 overflow-hidden rounded-full bg-white/10">
                        <div className="flex h-full">
                          <div className="h-full bg-amber-400" style={{ width: `${p.powShare}%` }} />
                          <div className="h-full bg-emerald-400" style={{ width: `${p.pocShare}%` }} />
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-gray-500">
                        PoW {p.powShare}% · PoC {p.pocShare}%
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider"
                    style={{
                      backgroundColor: `rgba(${p.color}, 0.15)`,
                      color: `rgb(${p.color})`,
                    }}
                  >
                    {p.status === 'live' && <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ backgroundColor: `rgb(${p.color})` }} />}
                    {p.status === 'live' ? (TreeOfLifeTreeOfLifePageClientCopy.current[cs ? 'cs' : 'en']) : (TreeOfLifeTreeOfLifePageClientCopy.horizon[cs ? 'cs' : 'en'])}
                  </span>
                  {p.npuValidators !== '—' && (
                    <span className="text-[10px] text-gray-500">
                      <Cpu className="mr-1 inline h-3 w-3" />
                      {TreeOfLifeTreeOfLifePageClientCopy.npuValidators[cs ? 'cs' : 'en']}: {p.npuValidators}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Strom života metafora */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: TreePine, color: '251, 191, 36', name: { cs: 'Kořen', en: 'Root' }, desc: { cs: 'ZION L1 — consensus, emise, source of truth', en: 'ZION L1 — consensus, emission, source of truth' } },
              { icon: ArrowLeftRight, color: '7, 137, 48', name: { cs: 'Míza', en: 'Sap' }, desc: { cs: 'WARP bridge — přenos ZION mezi 13+ chainy', en: 'WARP bridge — ZION transfer between 13+ chains' } },
              { icon: GitBranch, color: '99, 102, 241', name: { cs: 'Větve', en: 'Branches' }, desc: { cs: '13 chain families (EVM, Solana, TON, Cardano, BTC LN, ...)', en: '13 chain families (EVM, Solana, TON, Cardano, BTC LN, ...)' } },
              { icon: Leaf, color: '16, 185, 129', name: { cs: 'Listy', en: 'Leaves' }, desc: { cs: 'ZionDex — AMM, likvidita, swap na každé větvi', en: 'ZionDex — AMM, liquidity, swap on each branch' } },
              { icon: Sun, color: '251, 191, 36', name: { cs: 'Slunce', en: 'Sun' }, desc: { cs: 'Hiran AI — inteligence, monitoring, optimalizace', en: 'Hiran AI — intelligence, monitoring, optimization' } },
              { icon: Shield, color: '239, 68, 68', name: { cs: 'Imunita', en: 'Immunity' }, desc: { cs: 'Protokol Péče — NPU validátory, care proofs', en: 'Protocol of Care — NPU validators, care proofs' } },
            ].map((m) => (
              <div key={m.name.en} className="zion-rainbow-card space-y-2 p-4" style={{ '--rc': m.color } as React.CSSProperties}>
                <div className="flex items-center gap-2">
                  <m.icon className="h-5 w-5" style={{ color: `rgb(${m.color})` }} />
                  <h4 className="text-sm font-bold text-white">{cs ? m.name.cs : m.name.en}</h4>
                </div>
                <p className="text-xs text-gray-400">{cs ? m.desc.cs : m.desc.en}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ═══════ PROOF-OF-CARE — PROTOCOL OF CARE ═══════ */}
        <motion.section
          id="proof-of-care"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          <div className="text-center space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.36em] text-emerald-400">
              {TreeOfLifeTreeOfLifePageClientCopy.protocolOfCareProofOfCare[cs ? 'cs' : 'en']}
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              {TreeOfLifeTreeOfLifePageClientCopy.miningCareNotWaste[cs ? 'cs' : 'en']}
            </h2>
            <p className="mx-auto max-w-3xl text-sm text-gray-400">
              {TreeOfLifeTreeOfLifePageClientCopy.powMeasuresStrengthPosMeasures[cs ? 'cs' : 'en']}
            </p>
          </div>

          {/* Three consensus models comparison */}
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { name: 'PoW', color: '239, 68, 68', desc: { cs: 'Síla — kdo má největší hashrate, ten vyhrává', en: 'Strength — who has the most hashrate wins' }, energy: { cs: 'Vysoká (waste heat)', en: 'High (waste heat)' } },
              { name: 'PoS', color: '251, 191, 36', desc: { cs: 'Kapitál — kdo má nejvíce tokenů, ten vyhrává', en: 'Capital — who has the most tokens wins' }, energy: { cs: 'Nízká', en: 'Low' } },
              { name: 'PoC', color: '16, 185, 129', desc: { cs: 'Péče — kdo nejlépe opékuje síť, ten vyhrává', en: 'Care — who best cares for the network wins' }, energy: { cs: 'Nízká (užitečná práce)', en: 'Low (useful work)' } },
            ].map((m) => (
              <div key={m.name} className="zion-rainbow-card space-y-3 p-5" style={{ '--rc': m.color } as React.CSSProperties}>
                <h3 className="text-lg font-bold" style={{ color: `rgb(${m.color})` }}>{m.name}</h3>
                <p className="text-sm text-gray-300">{cs ? m.desc.cs : m.desc.en}</p>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Zap className="h-3.5 w-3.5" />
                  {TreeOfLifeTreeOfLifePageClientCopy.energy[cs ? 'cs' : 'en']}: {cs ? m.energy.cs : m.energy.en}
                </div>
              </div>
            ))}
          </div>

          {/* Care Tasks */}
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-white">{TreeOfLifeTreeOfLifePageClientCopy.careTasksUsefulWorkInEveryBloc[cs ? 'cs' : 'en']}</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {CARE_TASKS.map((t) => (
                <div
                  key={t.id}
                  className="zion-rainbow-sub p-4"
                  style={{ '--rc': t.color } as React.CSSProperties}
                >
                  <div className="flex items-center gap-2">
                    <t.icon className="h-5 w-5" style={{ color: `rgb(${t.color})` }} />
                    <h4 className="text-sm font-bold text-white">{cs ? t.name.cs : t.name.en}</h4>
                  </div>
                  <p className="mt-2 text-xs text-gray-400">{cs ? t.desc.cs : t.desc.en}</p>
                </div>
              ))}
            </div>
          </div>

          {/* NPU Mining — democratization */}
          <div className="zion-rainbow-card space-y-4 p-6" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
            <div className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-cyan-400" />
              <h3 className="text-lg font-bold text-white">
                {TreeOfLifeTreeOfLifePageClientCopy.npuMiningDemocratizingMining[cs ? 'cs' : 'en']}
              </h3>
            </div>
            <p className="text-sm text-gray-400">
              {TreeOfLifeTreeOfLifePageClientCopy.insteadOfExpensiveGpuRigs30005[cs ? 'cs' : 'en']}
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {NPU_CHIPS.map((c) => (
                <div key={c.name} className="zion-rainbow-sub p-3 text-center" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
                  <p className="text-xs font-bold text-white">{c.name}</p>
                  <p className="text-[10px] text-gray-500">{c.device}</p>
                  <p className="mt-1 text-lg font-bold" style={{ color: `rgb(${c.color})` }}>{c.tops}<span className="text-xs text-gray-500"> TOPS</span></p>
                </div>
              ))}
            </div>
          </div>

          {/* Reward distribution evolution */}
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                title: { cs: 'Dnes (PoW)', en: 'Today (PoW)' }, color: '251, 191, 36',
                splits: [
                  { label: 'Miner', pct: 89, color: '251, 191, 36' },
                  { label: { cs: 'Humanitární', en: 'Humanitarian' }, pct: 5, color: '34, 197, 94' },
                  { label: 'Issobella', pct: 5, color: '236, 72, 153' },
                  { label: 'Burn', pct: 1, color: '239, 68, 68' },
                ],
              },
              {
                title: { cs: 'Hybrid (2027-2035)', en: 'Hybrid (2027-2035)' }, color: '99, 102, 241',
                splits: [
                  { label: 'PoW Miner', pct: 50, color: '251, 191, 36' },
                  { label: { cs: 'Care validátory', en: 'Care validators' }, pct: 30, color: '16, 185, 129' },
                  { label: { cs: 'Humanitární', en: 'Humanitarian' }, pct: 10, color: '34, 197, 94' },
                  { label: 'DAO', pct: 5, color: '228, 30, 43' },
                  { label: 'Hiran AI', pct: 4, color: '7, 137, 48' },
                  { label: 'Burn', pct: 1, color: '239, 68, 68' },
                ],
              },
              {
                title: { cs: 'Plný PoC (2036+)', en: 'Full PoC (2036+)' }, color: '16, 185, 129',
                splits: [
                  { label: { cs: 'Care validátory', en: 'Care validators' }, pct: 70, color: '16, 185, 129' },
                  { label: { cs: 'Humanitární', en: 'Humanitarian' }, pct: 10, color: '34, 197, 94' },
                  { label: 'DAO', pct: 10, color: '228, 30, 43' },
                  { label: 'WARP', pct: 5, color: '99, 102, 241' },
                  { label: 'Hiran AI', pct: 4, color: '7, 137, 48' },
                  { label: 'Burn', pct: 1, color: '239, 68, 68' },
                ],
              },
            ].map((r) => (
              <div key={typeof r.title === 'string' ? r.title : r.title.en} className="zion-rainbow-card space-y-3 p-5" style={{ '--rc': r.color } as React.CSSProperties}>
                <h4 className="text-sm font-bold text-white">{cs ? (r.title as any).cs : (r.title as any).en}</h4>
                {/* Stacked bar */}
                <div className="flex h-6 w-full overflow-hidden rounded-lg">
                  {r.splits.map((s, i) => (
                    <div
                      key={i}
                      className="h-full"
                      style={{ width: `${s.pct}%`, backgroundColor: `rgb(${s.color})` }}
                      title={`${typeof s.label === 'string' ? s.label : (cs ? (s.label as any).cs : (s.label as any).en)}: ${s.pct}%`}
                    />
                  ))}
                </div>
                {/* Legend */}
                <div className="space-y-1">
                  {r.splits.map((s, i) => (
                    <div key={i} className="flex items-center justify-between text-[10px]">
                      <span className="flex items-center gap-1.5 text-gray-400">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: `rgb(${s.color})` }} />
                        {typeof s.label === 'string' ? s.label : (cs ? (s.label as any).cs : (s.label as any).en)}
                      </span>
                      <span className="font-mono text-gray-500">{s.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Care Proof struct */}
          <div className="zion-rainbow-card space-y-3 p-6" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-emerald-400" />
              <h3 className="text-lg font-bold text-white">Care Proof</h3>
            </div>
            <p className="text-sm text-gray-400">
              {TreeOfLifeTreeOfLifePageClientCopy.careProofStructureAiInferenceO[cs ? 'cs' : 'en']}
            </p>
            <pre className="zion-rainbow-sub overflow-x-auto p-4 text-xs text-gray-300" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}><code>{`struct CareProof {
    validator_id: [u8; 32],     // Identifikátor validátora
    task_type: CareTask,        // Kategorie care tasku
    model_hash: [u8; 32],       // Hash AI modelu (Hiran version)
    input_hash: [u8; 32],       // Hash vstupních dat
    output: Vec<u8>,            // AI output (anomaly score, audit result)
    npu_attestation: NpuAttestation, // NPU signature
    care_score: u64,            // accuracy + timeliness + coverage
}`}</code></pre>
          </div>
        </motion.section>

        {/* ═══════ BODHISATTVA VOW — OSM STRÁŽCŮ ZIONU ═══════ */}
        <motion.section
          id="bodhisattva"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          <div className="text-center space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.36em] text-amber-400">
              {TreeOfLifeTreeOfLifePageClientCopy.ethicalFoundationBodhisattvaVo[cs ? 'cs' : 'en']}
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              {TreeOfLifeTreeOfLifePageClientCopy.eightGreatBodhisattvasGuardian[cs ? 'cs' : 'en']}
            </h2>
            <p className="mx-auto max-w-3xl text-sm text-gray-400">
              {TreeOfLifeTreeOfLifePageClientCopy.zionIsNotACryptoEconomicProtoc[cs ? 'cs' : 'en']}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <a
                href="https://github.com/Zion-TerraNova/v3-Mainnet/blob/main/docs/ZION_CODEX_BODHISATTVA.md"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/5 px-5 py-2.5 text-sm font-medium text-amber-300 hover:bg-amber-500/10 transition-all"
              >
                <BookOpen className="h-4 w-4" />
                ZION_CODEX_BODHISATTVA.md
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          {/* Four Great Vows */}
          <div className="zion-rainbow-card space-y-4 p-6" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
            <h3 className="text-lg font-bold text-white">
              {TreeOfLifeTreeOfLifePageClientCopy.fourGreatVows[cs ? 'cs' : 'en']}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {FOUR_GREAT_VOWS.map((v, i) => (
                <div key={i} className="zion-rainbow-sub p-3" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                  <p className="text-sm italic text-gray-300">{cs ? v.cs : v.en}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500">
              {TreeOfLifeTreeOfLifePageClientCopy.theFourVowsAreImpossibleByDesi[cs ? 'cs' : 'en']}
            </p>
          </div>

          {/* Eight Bodhisattvas grid */}
          <div className="grid gap-4 md:grid-cols-2">
            {EIGHT_BODHISATTVAS.map((b) => (
              <div
                key={b.id}
                className="zion-rainbow-card space-y-3 p-5"
                style={{ '--rc': b.color } as React.CSSProperties}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-xl border-2"
                      style={{
                        borderColor: `rgba(${b.color}, 0.5)`,
                        backgroundColor: `rgba(${b.color}, 0.12)`,
                      }}
                    >
                      <b.icon className="h-6 w-6" style={{ color: `rgb(${b.color})` }} />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-white">{b.name}</h4>
                      <p className="text-xs text-gray-400">
                        {b.sanskrit} · {cs ? b.meaning.cs : b.meaning.en}
                      </p>
                    </div>
                  </div>
                  <span
                    className="rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
                    style={{
                      backgroundColor: `rgba(${b.color}, 0.15)`,
                      color: `rgb(${b.color})`,
                    }}
                  >
                    {b.sephira}
                  </span>
                </div>
                {/* Mantra */}
                <p className="text-center text-sm text-gray-300" style={{ fontFamily: 'serif' }}>
                  {b.mantra}
                </p>
                {/* Vow */}
                <div className="zion-rainbow-sub p-3" style={{ '--rc': b.color } as React.CSSProperties}>
                  <p className="text-xs italic leading-relaxed text-gray-300">
                    {cs ? b.vow.cs : b.vow.en}
                  </p>
                </div>
                {/* ZION Role */}
                <div className="flex items-start gap-2">
                  <span className="text-[10px] uppercase tracking-wider text-gray-500">{TreeOfLifeTreeOfLifePageClientCopy.zionRole[cs ? 'cs' : 'en']}</span>
                  <p className="flex-1 text-xs text-gray-400">{cs ? b.zionRole.cs : b.zionRole.en}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Eight Pledges */}
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-white">
              {TreeOfLifeTreeOfLifePageClientCopy.eightGuardianPledges[cs ? 'cs' : 'en']}
            </h3>
            <p className="text-sm text-gray-400">
              {TreeOfLifeTreeOfLifePageClientCopy.theBodhisattvaVowIsTheHighestC[cs ? 'cs' : 'en']}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {EIGHT_PLEDGES.map((p) => (
                <div key={p.num} className="zion-rainbow-sub flex items-start gap-3 p-3" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-[10px] font-bold text-amber-400">
                    {p.num}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">{cs ? p.title.cs : p.title.en}</p>
                    <p className="text-[10px] text-gray-500">{p.bodhisattva}</p>
                    <p className="mt-1 text-xs text-gray-400">{cs ? p.impl.cs : p.impl.en}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Dual Vow + Thousand Breakings */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="zion-rainbow-card space-y-3 p-6" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
              <div className="flex items-center gap-2">
                <HeartHandshake className="h-5 w-5 text-purple-400" />
                <h4 className="text-sm font-bold text-white">{TreeOfLifeTreeOfLifePageClientCopy.dualVow[cs ? 'cs' : 'en']}</h4>
              </div>
              <p className="text-xs text-gray-400">
                {TreeOfLifeTreeOfLifePageClientCopy.aGuardianWhoHoldsBothTheSefiro[cs ? 'cs' : 'en']}
              </p>
              <p className="font-mono text-[10px] text-purple-300">DUAL_VOW_CARE_SCORE_BONUS_BPS = 10_500</p>
            </div>
            <div className="zion-rainbow-card space-y-3 p-6" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-400" />
                <h4 className="text-sm font-bold text-white">{TreeOfLifeTreeOfLifePageClientCopy.theThousandBreakings[cs ? 'cs' : 'en']}</h4>
              </div>
              <p className="text-sm italic text-gray-300">
                {TreeOfLifeTreeOfLifePageClientCopy.mayIBreakItAThousandTimesAndRe[cs ? 'cs' : 'en']}
              </p>
              <p className="text-xs text-gray-400">
                {TreeOfLifeTreeOfLifePageClientCopy.theVowIsADirectionNotADestinat[cs ? 'cs' : 'en']}
              </p>
            </div>
          </div>

          {/* Shantideva quote */}
          <div className="zion-rainbow-card space-y-3 p-6 text-center" style={{ '--rc': '34, 197, 94' } as React.CSSProperties}>
            <p className="text-lg italic text-gray-300">
              {TreeOfLifeTreeOfLifePageClientCopy.forAsLongAsSpaceEnduresAndForA[cs ? 'cs' : 'en']}
            </p>
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-400">— Shantideva, Bodhicharyavatara 10.55</p>
          </div>
        </motion.section>

        {/* ═══════ ZÁVĚR + ODKAZY ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="space-y-6 text-center"
        >
          <div className="zion-rainbow-card space-y-4 p-8" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
            <p className="text-lg italic text-gray-300">
              {TreeOfLifeTreeOfLifePageClientCopy.notTheOneWhoHasTheGreatestStre[cs ? 'cs' : 'en']}
            </p>
            <p className="text-xs uppercase tracking-[0.3em] text-zion-gold">— {TreeOfLifeTreeOfLifePageClientCopy.protocolOfCare[cs ? 'cs' : 'en']}</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/terranova"
              className="inline-flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-5 py-2.5 text-sm font-medium text-emerald-300 hover:bg-emerald-500/10 transition-all"
            >
              <BookOpen className="h-4 w-4" />
              {TreeOfLifeTreeOfLifePageClientCopy.terranovaBook[cs ? 'cs' : 'en']}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/#tree-of-life"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-gray-300 hover:bg-white/10 hover:text-white transition-all"
            >
              <TreePine className="h-4 w-4" />
              {TreeOfLifeTreeOfLifePageClientCopy.treeOnHomepage[cs ? 'cs' : 'en']}
            </Link>
            <Link
              href="/l6-issobella"
              className="inline-flex items-center gap-2 rounded-2xl border border-pink-500/30 bg-pink-500/5 px-5 py-2.5 text-sm font-medium text-pink-300 hover:bg-pink-500/10 transition-all"
            >
              <Star className="h-4 w-4" />
              {TreeOfLifeTreeOfLifePageClientCopy.l6IssobellaMalkhut[cs ? 'cs' : 'en']}
            </Link>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
