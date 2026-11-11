'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Globe2, Heart, Shield, Users, Wallet, ArrowRight,
  CheckCircle2, Sparkles, TreeDeciduous, Crown,
  Sprout, Activity, Radio, Brain, Music,
  Eye, Home, Wrench, MapPin, FileCheck2, Vote,
} from 'lucide-react';
import { useLang, type Lang } from '@/contexts/LanguageContext';
import { tx5, t5, t5a } from '@/lib/i18n-tx';
import FundBalance, { FundBalanceSum } from '@/components/FundBalance';
import FreeWorldMap from '@/components/FreeWorldMap';
import L5FundTracker from '@/components/L5FundTracker';
import FreeWorldRegistry from '@/components/FreeWorldRegistry';
import QvSection from '@/components/QvSection';

const L5FreeWorldCopy = {
  physicalLayerOfTheZionEcosyste: { cs: `Fyzická vrstva ZION ekosystému`, en: `Physical layer of the ZION ecosystem` },
  freeWorldL5: { cs: `Svobodný svět — L5`, en: `Free World — L5` },
  l5IsThePhysicalLayerOfZionWher: { cs: `L5 je fyzická vrstva ZION — kde blockchainový konsenzus potkává půdu, vodu a lidskou správu. Fyzické komunity využívají ZION jako svou nativní ekonomiku a koordinační vrstvu.`, en: `L5 is the physical layer of ZION — where blockchain consensus meets soil, water, and human governance. Physical communities use ZION as their native economy and coordination layer.` },
  k5OfEveryBlockL5Fund: { cs: `5 % z každého bloku → L5 fond`, en: `5% of every block → L5 fund` },
  k117mZionMonth: { cs: `~11,7 M ZION / měsíc`, en: `~11.7M ZION / month` },
  fundActiveFromGenesis: { cs: `Aktivní od genesis`, en: `Active from genesis` },

  humanitarianFund: { cs: `Humanitární fond`, en: `Humanitarian Fund` },
  l5Fund5BlockReward: { cs: `L5 Fond — 5 % block reward`, en: `L5 Fund — 5% block reward` },
  blockShare: { cs: `Podíl z bloku`, en: `Block share` },
  everyBlockForever: { cs: `každý blok, navždy`, en: `every block, forever` },
  approxMonth: { cs: `Přibližně / měsíc`, en: `Approx / month` },
  governedBy: { cs: `Správa`, en: `Governed by` },
  l5Council: { cs: `L5 Radou`, en: `L5 Council` },
  fundWallet: { cs: `Adresa fondu`, en: `Fund wallet` },
  fundDisbursementNote: { cs: `Fond roste s každým blokem. Výplata je možná až po DAO návrhu, hlasování, timelocku a guardian multisig.`, en: `The fund grows with every block. Disbursement requires a DAO proposal, vote, timelock, and guardian multisig.` },
  liveBalance: { cs: `Aktuální zůstatek`, en: `Live balance` },
  liveGenesisBalance: { cs: `Live genesis zůstatek`, en: `Live genesis balance` },

  genesisAllocation: { cs: `Genesis alokace`, en: `Genesis allocation` },
  l5PremineTitle: { cs: `L5 Free World — 3,3 mld ZION z genesis`, en: `L5 Free World — 3.3B ZION from genesis` },
  l5PremineIntro: { cs: `Nad rámec průběžného 5% podílu z každého bloku má L5 vlastní alokaci přímo v genesis bloku. Sloty 4 a 5 (2 × 1,65 mld ZION) byly převedeny z OASIS na L5 Free World Projects — šest zakládajících komunit po 500M a rezervní fond 300M, který se stal founding rezervou plujícího uzlu María del Camino.`, en: `Beyond the ongoing 5% share of every block, L5 has its own allocation directly in the genesis block. Slots 4 and 5 (2 × 1.65B ZION) were repurposed from OASIS to L5 Free World Projects — six founding communities of 500M each and a 300M reserve fund, now committed as the founding reserve of the María del Camino vessel node.` },
  perProjectAmount: { cs: `na projekt`, en: `per project` },
  l5ReserveFund: { cs: `L5 rezervní fond`, en: `L5 reserve fund` },
  l5ReserveFundDesc: { cs: `Nealokovaná rezerva pro budoucí uzly a rozvoj stávajících komunit (původně 800 mil. — 500 mil. je záměr pro Novou Ameriku).`, en: `Unallocated reserve for future nodes and growth of existing communities (originally 800M — 500M is intended for Nová Amerika).` },
  totalL5Allocation: { cs: `Celkem L5`, en: `Total L5` },
  l5PremineNote: { cs: `Alokace je admin-locked — uvolnění vyžaduje DAO návrh, hlasování a guardian multisig. Správce jednotlivých projektů jmenuje Trustee; jména budou zveřejněna při dosažení bodu globální expanze.`, en: `The allocation is admin-locked — release requires a DAO proposal, vote, and guardian multisig. Project stewards are appointed by the Trustee; names will be published once the global expansion milestone is reached.` },

  sharedProtocols: { cs: `Sdílené protokoly`, en: `Shared Protocols` },
  baselineL5Protocols: { cs: `Baseline L5 protokoly`, en: `Baseline L5 Protocols` },
  everyL5CommunityImplementsThes: { cs: `Každá L5 komunita implementuje tyto sdílené protokoly pro interoperabilitu.`, en: `Every L5 community implements these shared protocols for interoperability.` },
  guardianNode: { cs: `Guardian Node`, en: `Guardian Node` },
  everyL5CommunityValidatesBlock: { cs: `Každá L5 komunita validuje bloky — 10 % odměn do komunitní pokladny.`, en: `Every L5 community validates blocks — 10% of rewards go to the community treasury.` },
  sociocraticDao: { cs: `Sociocratic DAO`, en: `Sociocratic DAO` },
  hybridGovernanceOffChainCircle: { cs: `Hybridní governance: off-chain kruhy + on-chain treasury hlasování.`, en: `Hybrid governance: off-chain circles + on-chain treasury votes.` },
  seedLibrary: { cs: `Semenná knihovna`, en: `Seed Library` },
  seedLibraryDesc: { cs: `Výměna lokálních odrůd mezi uzly; odolnost proti monopolům.`, en: `Exchange local seed varieties between nodes; resilience against monopolies.` },
  medicalTable: { cs: `Medical Table`, en: `Medical Table` },
  medicalTableDesc: { cs: `Holistické zdravotní protokoly, bylinná medicína a první pomoc.`, en: `Holistic health protocols, herbal medicine, and first aid.` },
  mesh: { cs: `LoRa / Meshtastic mesh`, en: `LoRa / Meshtastic mesh` },
  meshDesc: { cs: `Off-grid komunikace v komunitě i mezi uzly; bez závislosti na blockchainu.`, en: `Off-grid communication within and between nodes; no blockchain dependency.` },
  consciousnessAdmission: { cs: `Consciousness Admission`, en: `Consciousness Admission` },
  consciousnessAdmissionDesc: { cs: `Vstup podle věku, dharmické principy a slib péče pro strážce.`, en: `Age-based entry, dharmic principles, and care vow for Guardians.` },
  resonanceProtocol: { cs: `Rezonanční protokol`, en: `Resonance Protocol` },
  soundAttunementBeforeGovernanc: { cs: `Zvukové ladění před governance, Fibonacci Time Capsules, Youth–Elder Bridge.`, en: `Sound attunement before governance, Fibonacci Time Capsules, Youth–Elder Bridge.` },

  communities: { cs: `Komunity`, en: `Communities` },
  l5NodesCommunities: { cs: `L5 uzly — komunity`, en: `L5 Nodes — Communities` },
  details: { cs: `Podrobnosti`, en: `Details` },
  wantToProposeANewL5CommunityOp: { cs: `Chceš navrhnout novou L5 komunitu? Otevři PR do public/V3/L5/docs/COMMUNITIES/.`, en: `Want to propose a new L5 community? Open a PR to public/V3/L5/docs/COMMUNITIES/.` },
  algarvePortugal: { cs: `Sabacheira · Tomar, Portugalsko`, en: `Sabacheira · Tomar, Portugal` },
  pioneerL5CommunityPermaculture: { cs: `Pionýrská L5 komunita — pernakulturní zahrada, lokální governance a ZION guardian node.`, en: `Pioneer L5 community — permaculture garden, local governance and ZION guardian node.` },
  educationalAndMeditationCenter: { cs: `Vzdělávací a meditační centrum s decentralizovanou správou a off-grid energetikou.`, en: `Educational and meditation center with decentralized governance and off-grid energy.` },
  tePikoOraPolynesianRevival: { cs: `Marine permakultura, wayfinding škola a polynéská kulturní obnova.`, en: `Marine permaculture, wayfinding school and Polynesian cultural revival.` },
  statusDevelopment: { cs: `Aktivní rozvoj`, en: `Active development` },
  statusPreparation: { cs: `V přípravě`, en: `In preparation` },
  statusVision: { cs: `Plánováno`, en: `Planned` },
  statusBuilt: { cs: `Postaveno`, en: `Built` },

  sevenGates: { cs: `Sedm bran do L5`, en: `Seven Gates into L5` },
  sevenGatesSubtitle: { cs: `Onboarding není funnel. Je to Hanumanův most — dost jednoduchý, aby po něm přešel nováček, dost poctivý, aby na něm neztratil orientaci.`, en: `Onboarding is not a funnel. It is Hanuman's bridge — simple enough for a newcomer, honest enough to stay oriented.` },
  onboardingStatusLive: { cs: `Živé`, en: `Live` },
  onboardingStatusBuilding: { cs: `Stavba`, en: `Building` },
  onboardingStatusHorizon: { cs: `Horizont`, en: `Horizon` },
  noRequirementsTitle: { cs: `Co po tobě nikdo nesmí chtít`, en: `What no one may ask of you` },
  noPromisesTitle: { cs: `Co ti nikdo nesmí slíbit`, en: `What no one may promise you` },

  l5EconomicModel: { cs: `Ekonomický model L5`, en: `L5 Economic Model` },
  blockRewardNetwork: { cs: `Block reward (síť)`, en: `Block reward (network)` },
  revenueNetworkSplit: { cs: `89 % těžař · 5 % L5 humanitární · 5 % L6 Issobella · 1 % poplatek poolu`, en: `89% miner · 5% L5 humanitarian · 5% L6 Issobella · 1% pool fee` },
  guardianNodeLocal: { cs: `Guardian Node (místní)`, en: `Guardian Node (local)` },
  k90CommunityMiner10CommunityTre: { cs: `90 % komunitní těžař · 10 % → komunitní pokladna`, en: `90% community miner · 10% → community treasury` },
  communityTreasury: { cs: `Komunitní pokladna`, en: `Community Treasury` },
  k40Ops25Infra20Reserve10Tithe5: { cs: `40 % provoz · 25 % infrastruktura · 20 % rezerva · 10 % humanitární desátek · 5 % vzdělání`, en: `40% operations · 25% infrastructure · 20% reserve · 10% humanitarian tithe · 5% education` },
  learnMoreAboutL5: { cs: `Více o L5`, en: `Learn more about L5` },
  network: { cs: `Síť`, en: `Network` },

  planetaryMap: { cs: `Planetární mapa`, en: `Planetary map` },
  sixNodesOnPlanet: { cs: `Dvanáct bodů na planetě`, en: `Twelve nodes on the planet` },
  l5MapDesc: {
    cs: `Zakládající L5 komunity napříč kontinenty — od údolí Nabão po poušť Ngari pod Kailashem a síň záznamu na plateu Gízy. Šest financovaných uzlů je v přípravě do roku 2028, stavba začíná nejdříve v roce 2029 po OASIS. Uluru, Boa Esperança, Kailash a Amenti zůstávají vizemi — vztahové uzly na posvátných a historických místech; Amenti je dvanáctý bod na pevnině. Ekam je jediný uzel, který už stojí — chrám z roku 2008 slouží jako předloha všem ostatním. María del Camino — plující uzel se solárními plachtami — všechny body fyzicky spojuje přes oceány. A třináctý uzel není na mapě, protože je na vodě: archa Království srdce · Nirvana, plující kolonie do sta lidí, která se vrací pro ty, kdo zůstali ve vodě — a její trasu určují keporkaci.`,
    en: `The L5 communities across the continents — from the Nabão valley to the Ngari desert under Kailash and the hall of records on the Giza plateau. The six funded nodes are in preparation until 2028, construction starts no earlier than 2029 after OASIS. Uluru, Boa Esperança, Kailash and Amenti remain visions — relationship nodes on sacred and historic ground; Amenti is the twelfth point on land. Ekam is the only node already standing — a temple built in 2008 that serves as the template for all the others. María del Camino — a sailing node on solar sails — physically connects every point across the oceans. And the thirteenth node is not on the map, because it is on the water: the ark Království srdce · Nirvana, a sailing colony of up to one hundred people that returns for those left in the water — its route set by the humpback whales.`,
  },
  liveRegistry: { cs: `Živý registr`, en: `Live registry` },
  projectsAndGrants: { cs: `Projekty & granty`, en: `Projects & Grants` },
  registryDesc: {
    cs: `Transparentní registr L5 projektů a žádostí o financování — přímo z Free World služby.`,
    en: `Transparent registry of L5 projects and funding requests — straight from the Free World service.`,
  },
  quadraticVoting: { cs: `Kvadratické hlasování`, en: `Quadratic Voting` },
  qvTitle: { cs: `Hlas komunity o alokaci fondu`, en: `Community voice on fund allocation` },
};

const HUMANITARIAN_WALLET = 'zion1y3w4z0c755v4y7t3f0k6s54390x0h3k3y5hv8c8';
const L5_PREMINE_WALLETS = [
  'zion1h7r3v595y3g0z3e3l8p005h4c6l7l6s4s2xh708',
  'zion1x535z563d3p6r6u3v6x0g0y445f507w8h6g8388',
] as const;

type CommunityStatus = 'development' | 'preparation' | 'vision' | 'built';
type OnboardingStatus = 'live' | 'building' | 'horizon';

const getStatusStyle = (cs: boolean, lang: Lang, status: CommunityStatus) => {
  const map = {
    development: {
      label: tx5(L5FreeWorldCopy.statusDevelopment, lang),
      class: 'border-zion-gold/30 bg-zion-gold/10 text-zion-gold',
    },
    preparation: {
      label: tx5(L5FreeWorldCopy.statusPreparation, lang),
      class: 'border-zion-cyan/30 bg-zion-cyan/10 text-zion-cyan',
    },
    vision: {
      label: tx5(L5FreeWorldCopy.statusVision, lang),
      class: 'border-zion-purple/30 bg-zion-purple/10 text-zion-purple',
    },
    built: {
      label: tx5(L5FreeWorldCopy.statusBuilt, lang),
      class: 'border-amber-200/40 bg-amber-100/10 text-amber-200',
    },
  };
  return map[status];
};

const getOnboardingStatusStyle = (cs: boolean, lang: Lang, status: OnboardingStatus) => {
  const copy = L5FreeWorldCopy;
  const map = {
    live: {
      label: tx5(copy.onboardingStatusLive, lang),
      class: 'border-zion-cyan/30 bg-zion-cyan/10 text-zion-cyan',
    },
    building: {
      label: tx5(copy.onboardingStatusBuilding, lang),
      class: 'border-zion-gold/30 bg-zion-gold/10 text-zion-gold',
    },
    horizon: {
      label: tx5(copy.onboardingStatusHorizon, lang),
      class: 'border-zion-purple/30 bg-zion-purple/10 text-zion-purple',
    },
  };
  return map[status];
};

const getCommunities = (cs: boolean, lang: Lang) => [
  {
    name: 'Genesis Garden',
    location: tx5(L5FreeWorldCopy.algarvePortugal, lang),
    status: 'preparation' as const,
    desc: tx5(L5FreeWorldCopy.pioneerL5CommunityPermaculture, lang),
    tags: t5a(['Permaculture', 'Guardian Node', 'DAO Circle'], lang),
    href: '/terranova/genesis',
    cover: '/images/genesis-garden/hero.webp?v=engine-v1',
  },
  {
    name: 'Dharma Temple',
    location: 'La Palma — Terra Nova Sanctuary',
    status: 'preparation' as const,
    desc: tx5(L5FreeWorldCopy.educationalAndMeditationCenter, lang),
    tags: t5a(['Education', 'Off-grid', 'Meditation'], lang),
    href: '/terranova/dharma-temple',
    cover: '/images/dharma-temple/hero.webp?v=engine-v1',
  },
  {
    name: 'Te Pīko Ora',
    location: 'Raiatea · French Polynesia',
    status: 'preparation' as const,
    desc: tx5(L5FreeWorldCopy.tePikoOraPolynesianRevival, lang),
    tags: t5a(['Cultural Revival', 'Heritage', 'L5 Fund'], lang),
    href: '/terranova/te-piko-ora',
    cover: '/images/te-piko-ora/hero.webp?v=engine-v1',
  },
  {
    name: 'Golden Republic Bohemia',
    location: cs ? 'Čechy, Česká republika' : t5('Bohemia, Czech Republic', lang),
    status: 'preparation' as const,
    desc: cs ? 'Governance laboratoř Zlaté republiky — kruh rozhodování, česká moudrost a ZION protokol v srdci Evropy.' : t5('Governance laboratory for the Golden Republic — decision circle, Czech wisdom and ZION protocol in the heart of Europe.', lang),
    tags: t5a(['Governance', 'DAO Circle', 'Golden Republic'], lang),
    href: '/terranova/golden-republic-bohemia',
    cover: '/images/golden-republic-bohemia/hero.webp?v=engine-v1',
  },
  {
    name: 'Bodhi Lanka',
    location: cs ? 'Srí Lanka' : t5('Sri Lanka', lang),
    status: 'preparation' as const,
    desc: cs ? 'Akáša uzel — prostor, který drží všechny elementy. Nekonečná láska Ramy a Sity, nejstarší žijící strom na Zemi a ZION protokol.' : t5('Akasha node — the space that holds all elements. Infinite love of Rama and Sita, the oldest living tree on Earth, and ZION protocol.', lang),
    tags: t5a(['Bhakti', 'Ayurveda', 'Bodhi Tree'], lang),
    href: '/terranova/bodhi-lanka',
    cover: '/images/bodhi-lanka/hero.webp?v=engine-v1',
  },
  {
    name: 'Ekam · Oneness Temple',
    location: cs ? 'Varadaiahpalem, Andhra Pradesh, Indie' : t5('Varadaiahpalem, Andhra Pradesh, India', lang),
    status: 'built' as const,
    desc: cs ? 'Jediný uzel, který už stojí — chrám Jednoty postavený 2008: bílý mramor, zlatý řez, bezsloupová hala a Zlatá koule. Předloha pro všechny uzly a místo, které pojmenovalo samotný chain (ekam_deeksha).' : t5('The only node already standing — the Temple of Oneness built in 2008: white marble, golden ratio, a column-free hall and the Golden Orb. The template for every node and the place that named the chain itself (ekam_deeksha).', lang),
    tags: t5a(['Built 2008', 'The Template', 'Golden Orb'], lang),
    href: '/terranova/ekam',
    cover: '/images/ekam/hero.webp?v=engine-v1',
  },
  {
    name: 'LUMI',
    location: cs ? 'Kostarika · Nová Amerika' : t5('Costa Rica · Nová Amerika', lang),
    status: 'preparation' as const,
    desc: cs ? 'Most Amerik — projekt pro nativní kultury (Bribri, Cabécar, Boruca) na zeměpisném středobodu kontinentů, sdílený pozemek s pozemní stanicí Issobella.' : t5('Americas bridge — a project for the native cultures (Bribri, Cabécar, Boruca) at the geographic midpoint of the continents, sharing land with the Issobella ground station.', lang),
    tags: t5a(['Native Cultures', 'FPIC', 'Americas Bridge'], lang),
    href: '/terranova/nova-amerika',
    cover: '/images/nova-amerika/hero.webp?v=engine-v1',
  },
  {
    name: 'Uluru',
    location: cs ? 'Northern Territory, Austrálie' : t5('Northern Territory, Australia', lang),
    status: 'vision' as const,
    desc: cs ? 'Poselství protinožců — odkaz domorodé Austrálie: Tjukurpa, songlines, škola vnímání a každoroční festival oslavy života. Uzel jako vztah, ne stavba.' : t5('Message from the antipodes — the heritage of Aboriginal Australia: Tjukurpa, songlines, a school of perception and an annual celebration-of-life festival. A node as a relationship, not a construction.', lang),
    tags: t5a(['Tjukurpa', 'Songlines', 'Indigenous Heritage'], lang),
    href: '/terranova/uluru',
    cover: '/images/uluru/hero.webp?v=engine-v1',
  },
  {
    name: 'María del Camino',
    location: cs ? 'Světové oceány · domovský přístav Galicie' : t5('World oceans · home port Galicia', lang),
    status: 'preparation' as const,
    desc: cs ? 'Osmý bod sítě — plující uzel, flotila Tres Marias: atlantická plachetnice Santa María la Mayor, pacifický solární katamarán Nossa Senhora de Fátima a indickooceánská María de las Nieves. ~50 poutníků na trup spojuje všechny uzly sítě po mořském Caminu.' : t5('The eighth point of the network — a sailing node, the Tres Marias fleet: the Atlantic tall ship Santa María la Mayor, the Pacific solar catamaran Nossa Senhora de Fátima and the Indian-ocean María de las Nieves. ~50 pilgrims per hull connecting every node of the network on a sea Camino.', lang),
    tags: t5a(['Sea Camino', 'Solar Sails', 'Mobile Node'], lang),
    href: '/terranova/maria-del-camino',
    cover: '/images/maria-del-camino/hero.webp?v=engine-v1',
  },
  {
    name: 'Boa Esperança',
    location: cs ? 'Mys dobré naděje, Jihoafrická republika' : t5('Cape of Good Hope, South Africa', lang),
    status: 'vision' as const,
    desc: cs ? 'Devátý bod sítě — druhý šev světa, kde se bouře přejmenovává na naději a dvě Marie se setkávají na vodě. Domov nejstarší lidské linie (Khoisan), fynbos zahrada a kelp seaforest, vodní laboratoř Day Zero. Uzel jako vztah, ne stavba.' : t5('The ninth point of the network — the second seam of the world, where the storm is renamed hope and the two Marias meet at sea. Home of humanity’s oldest lineage (Khoisan), a fynbos garden and kelp seaforest, a Day-Zero water lab. A node as a relationship, not a construction.', lang),
    tags: t5a(['Hope', 'Two Oceans', 'Khoisan'], lang),
    href: '/terranova/boa-esperanca',
    cover: '/images/boa-esperanca/hero.webp?v=engine-v1',
  },
  {
    name: 'Kailash',
    location: cs ? 'Ngari, Tibet' : t5('Ngari, Tibet', lang),
    status: 'vision' as const,
    desc: cs ? 'Jedenáctý bod sítě — poušť očištění kolem jediné hory, na kterou se nikdy nevylezlo. Gang Rinpoche drží shodu čtyř tradic (hindu, buddha, bön, džina); poutník ji nechodí na ni, ale kolem — kora. U prastarého ohně sedí mistři všech linií Šambhaly. Uzel jako vztah, ne stavba.' : t5('The eleventh point of the network — the desert of purification around the only mountain never climbed. Gang Rinpoche holds the agreement of four traditions (Hindu, Buddhist, Bön, Jain); the pilgrim walks around it, not up — the kora. At the primordial fire sit the masters of all Shambhala lineages. A node as a relationship, not a construction.', lang),
    tags: t5a(['Purification', 'Kora', 'Shambhala'], lang),
    href: '/terranova/kailash',
    cover: '/images/kailash/hero.webp?v=engine-v1',
  },
  {
    name: 'Amenti',
    location: cs ? 'Gíza, Egypt' : t5('Giza, Egypt', lang),
    status: 'vision' as const,
    desc: cs ? 'Dvanáctý a poslední bod sítě — kolébka záznamu na plateu Gízy: poslední dochovaný div antického světa (~4 500 let) a v mýtické geografii sítě Síně Amenti pod pískem — síně, kde 32 Dětí Světla hlídá Kvetoucí Plamen. Sedm Pánů = sedm ctností implementovaných v L3; Amenti Library už sítí běží. Uzel jako vztah, ne stavba.' : t5('The twelfth and final point of the network — the cradle of the record on the Giza plateau: the last surviving Wonder of the ancient world (~4,500 yrs) and, in the network’s mythic geography, the Halls of Amenti beneath the sand — where the 32 Children of Light keep the Flower of Light. Seven Lords = seven virtues implemented in L3; the Amenti Library already runs on the network. A node as a relationship, not a construction.', lang),
    tags: t5a(['Remembrance', 'Halls of Records', 'Emerald Tablets'], lang),
    href: '/terranova/amenti',
    cover: '/images/amenti/hero.webp?v=engine-v1',
  },
  {
    name: 'Království srdce · Archa',
    location: cs ? 'Světové oceány · velrybí koridor' : t5('World oceans · whale corridor', lang),
    status: 'vision' as const,
    desc: cs ? 'Třináctý uzel sítě — a jediný, který je na vodě. Archa Nirvana: plující kolonie do sta lidí, semenný archiv při −18 °C, knihovna civilizace a plný uzel řetězce. Čtvrté plavidlo vedle Tres Marías, které se vrací pro ty, kdo zůstali ve vodě; trasu mu určují keporkaci — sezónně mezi tropy a mírným pásmem, v rytmu cyklónových oken obou hemisfér. Koncept se čtyřmi pracovními studiemi, bez položeného kýlu.' : t5('The thirteenth node of the network — and the only one on the water. The ark Nirvana: a sailing colony of up to one hundred people, a seed vault at −18 °C, a library of civilisation and a full chain node. The fourth vessel beside the Tres Marías, returning for those left in the water; its route is set by the humpbacks — seasonally between the tropics and the temperate band, in the rhythm of both hemispheres’ cyclone windows. A concept with four working studies and no keel laid.', lang),
    tags: t5a(['The Ark', 'Whale circuit', 'Colony of one hundred'], lang),
    href: '/terranova/kralovstvi-srdce',
    cover: '/images/kralovstvi-srdce/hero.webp?v=engine-v1',
  },
];

const getPremineAllocation = (cs: boolean, lang: Lang) => [
  { name: 'Genesis Garden', amount: cs ? '500 mil.' : t5('500M', lang), href: '/terranova/genesis' },
  { name: 'Dharma Temple', amount: cs ? '500 mil.' : t5('500M', lang), href: '/terranova/dharma-temple' },
  { name: 'Te Pīko Ora', amount: cs ? '500 mil.' : t5('500M', lang), href: '/terranova/te-piko-ora' },
  { name: 'Golden Republic Bohemia', amount: cs ? '500 mil.' : t5('500M', lang), href: '/terranova/golden-republic-bohemia' },
  { name: 'Bodhi Lanka', amount: cs ? '500 mil.' : t5('500M', lang), href: '/terranova/bodhi-lanka' },
  { name: 'LUMI (Nová Amerika)', amount: cs ? '500 mil.' : t5('500M', lang), href: '/terranova/nova-amerika' },
  { name: 'María del Camino', amount: cs ? '300 mil.' : t5('300M', lang), href: '/terranova/maria-del-camino' },
];

const getProtocols = (cs: boolean, lang: Lang) => [
  {
    title: tx5(L5FreeWorldCopy.guardianNode, lang),
    desc: tx5(L5FreeWorldCopy.everyL5CommunityValidatesBlock, lang),
    icon: Shield,
    color: 'text-zion-cyan',
  },
  {
    title: tx5(L5FreeWorldCopy.seedLibrary, lang),
    desc: tx5(L5FreeWorldCopy.seedLibraryDesc, lang),
    icon: Sprout,
    color: 'text-zion-gold',
  },
  {
    title: tx5(L5FreeWorldCopy.medicalTable, lang),
    desc: tx5(L5FreeWorldCopy.medicalTableDesc, lang),
    icon: Activity,
    color: 'text-zion-cyan',
  },
  {
    title: tx5(L5FreeWorldCopy.mesh, lang),
    desc: tx5(L5FreeWorldCopy.meshDesc, lang),
    icon: Radio,
    color: 'text-zion-purple',
  },
  {
    title: tx5(L5FreeWorldCopy.sociocraticDao, lang),
    desc: tx5(L5FreeWorldCopy.hybridGovernanceOffChainCircle, lang),
    icon: Users,
    color: 'text-zion-purple',
  },
  {
    title: tx5(L5FreeWorldCopy.consciousnessAdmission, lang),
    desc: tx5(L5FreeWorldCopy.consciousnessAdmissionDesc, lang),
    icon: Brain,
    color: 'text-zion-gold',
  },
  {
    title: tx5(L5FreeWorldCopy.resonanceProtocol, lang),
    desc: tx5(L5FreeWorldCopy.soundAttunementBeforeGovernanc, lang),
    icon: Music,
    color: 'text-zion-cyan',
  },
];

const getOnboardingGates = (cs: boolean, lang: Lang) => [
  {
    title: { cs: `1. Pozorovatel`, en: `1. Observer` },
    desc: { cs: `Čti komunitní dokumenty, ověř fond v exploreru, porovnej web s chainem.`, en: `Read community docs, verify the fund in the explorer, compare web vs chain.` },
    status: 'live' as const,
    icon: Eye,
    color: 'text-zion-cyan',
  },
  {
    title: { cs: `2. Host / návštěvník`, en: `2. Guest / Visitor` },
    desc: { cs: `Přijeď na pobyt do Zahrady Genesis (glamping) nebo na retreat. Jasná cena, možnost kdykoliv odejít.`, en: `Come for a stay at Genesis Garden (glamping) or a retreat. Clear price, free to leave.` },
    status: 'building' as const,
    icon: Home,
    color: 'text-zion-gold',
  },
  {
    title: { cs: `3. Pracovní výměna`, en: `3. Work Exchange` },
    desc: { cs: `25–30 h/týden → ubytování a jídlo. Poměr musí být jasný, práce dobrovolná.`, en: `25–30 h/week → accommodation and food. Ratio must be clear, work is voluntary.` },
    status: 'building' as const,
    icon: Wrench,
    color: 'text-zion-gold',
  },
  {
    title: { cs: `4. Strážce na místě`, en: `4. On-site Guardian` },
    desc: { cs: `Čtyři brány vstupu, zkušební pobyt, souhlas kruhu. Zatím horizont — žádný node v komunitě dnes neběží.`, en: `Four gates of entry, probationary stay, circle consent. Horizon for now — no node runs in a community today.` },
    status: 'horizon' as const,
    icon: Shield,
    color: 'text-zion-purple',
  },
  {
    title: { cs: `5. Vzdálený strážce`, en: `5. Remote Guardian` },
    desc: { cs: `Pomoc s uzlem, meshem, solarem, rozpočtem, granty. Čtvrtletní návštěvy / měsíční hovory.`, en: `Help with node, mesh, solar, budget, grants. Quarterly visits / monthly calls.` },
    status: 'horizon' as const,
    icon: Radio,
    color: 'text-zion-purple',
  },
  {
    title: { cs: `6. Hlasující / DAO`, en: `6. Voter / DAO` },
    desc: { cs: `Čti L5 návrhy; až bude DAO UI, hlasuj o alokaci fondu. Fond dnes nerozdává.`, en: `Read L5 proposals; when DAO UI is ready, vote on fund allocation. The fund does not disburse today.` },
    status: 'horizon' as const,
    icon: Crown,
    color: 'text-zion-purple',
  },
  {
    title: { cs: `7. Dárce / podporovatel`, en: `7. Donor / Supporter` },
    desc: { cs: `Peníze, semínka, nářadí, čas — komunitě přímo. Nic z toho není investice.`, en: `Money, seeds, tools, time — directly to the community. None of this is an investment.` },
    status: 'building' as const,
    icon: Heart,
    color: 'text-zion-gold',
  },
  {
    title: { cs: `+ Hráč v OASIS`, en: `+ OASIS Player` },
    desc: { cs: `Avatar Sítá / Hanuman, Zahrada Hiranyagarbha, stopy Zlatého vejce. Body se nesměňují za hlínu.`, en: `Sītā / Hanuman avatar, Garden of Hiranyagarbha, Golden Egg clues. Points do not convert to soil.` },
    status: 'live' as const,
    icon: Sparkles,
    color: 'text-zion-cyan',
  },
];

const ONBOARDING_RULES = {
  cs: [
    'KYC, kádrový posudek, geografickou blokaci.',
    'Nákup ZIONu nebo držení tokenu.',
    'Víru nebo doktrínu.',
    'Mlčení o rizicích.',
  ],
  en: [
    'KYC, background checks, or geo-blocking.',
    'Buying ZION or holding the token.',
    'Faith or doctrine.',
    'Silence about risks.',
  ],
};

const ONBOARDING_PROMISES = {
  cs: [
    'Výnos, podíl nebo „tokenizovanou půdu".',
    'Dopad bez veřejného impact packetu.',
    'Ráj nebo hotové dveře.',
    'Směnu OASIS bodů za hlínu nebo půdu.',
  ],
  en: [
    'Yield, share, or “tokenized land”.',
    'Impact without a public impact packet.',
    'Paradise or finished doors.',
    'Swapping OASIS points for soil or land.',
  ],
};

export default function L5FreeWorldPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const communities = getCommunities(cs, lang);
  const premineAllocation = getPremineAllocation(cs, lang);
  const protocols = getProtocols(cs, lang);
  const onboarding = getOnboardingGates(cs, lang);
  const rules = lang === 'cs' ? ONBOARDING_RULES.cs : ONBOARDING_RULES.en;
  const promises = lang === 'cs' ? ONBOARDING_PROMISES.cs : ONBOARDING_PROMISES.en;

  return (
    <div className="zion-page">
      <div className="zion-container max-w-7xl space-y-16">

        {/* ── HERO ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
          <div className="space-y-5">
            <div className="space-y-5 max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-zion-gold/40 bg-zion-gold/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-gold uppercase">
                <Globe2 className="h-4 w-4" />
                L5 · Terra Nova · Free World
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-gray-400">
                  {tx5(L5FreeWorldCopy.physicalLayerOfTheZionEcosyste, lang)}
                </p>
                <h1 className="text-3xl sm:text-5xl font-semibold text-gradient leading-tight">
                  {tx5(L5FreeWorldCopy.freeWorldL5, lang)}
                </h1>
              </div>
              <p className="text-lg text-gray-300">
                {tx5(L5FreeWorldCopy.l5IsThePhysicalLayerOfZionWher, lang)}
              </p>
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="inline-flex items-center gap-2 rounded-full border border-zion-gold/30 bg-zion-gold/10 px-4 py-2 text-amber-200">
                  <Heart className="h-3 w-3" /> {tx5(L5FreeWorldCopy.k5OfEveryBlockL5Fund, lang)}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-zion-cyan/30 bg-zion-cyan/10 px-4 py-2 text-emerald-200">
                  <CheckCircle2 className="h-3 w-3" /> {tx5(L5FreeWorldCopy.k117mZionMonth, lang)}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                  <Sparkles className="h-3 w-3" /> {tx5(L5FreeWorldCopy.fundActiveFromGenesis, lang)}
                </span>
              </div>
            </div>
            <div className="relative z-10 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
              <img
                src="/images/kralovstvi-srdce/hero.webp?v=engine-v1"
                srcSet="/images/kralovstvi-srdce/hero-m.webp?v=engine-v1 960w, /images/kralovstvi-srdce/hero.webp?v=engine-v1 1600w"
                sizes="(max-width: 1320px) calc(100vw - 2rem), 1280px"
                alt={cs ? 'L5 Free World — třináctý uzel: archa Království srdce · Nirvana, keporkaci a břeh Nové země' : t5('L5 Free World — the thirteenth node: the ark Kingdom of the Heart · Nirvana, humpback whales and the shore of the new world', lang)}
                width={1600}
                height={640}
                loading="eager"
                decoding="async"
                fetchPriority="high"
                className="w-full object-cover"
              />
            </div>
          </div>
        </motion.section>

        {/* ── Fund Info ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="zion-rainbow-card p-8" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tx5(L5FreeWorldCopy.humanitarianFund, lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Heart className="h-7 w-7 text-zion-gold" />
              {tx5(L5FreeWorldCopy.l5Fund5BlockReward, lang)}
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="zion-rainbow-sub p-4 text-center transition-colors hover:bg-white/5" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">{tx5(L5FreeWorldCopy.blockShare, lang)}</p>
              <p className="text-3xl font-bold text-zion-gold">5%</p>
              <p className="text-xs text-gray-500 mt-1">{tx5(L5FreeWorldCopy.everyBlockForever, lang)}</p>
            </div>
            <div className="zion-rainbow-sub p-4 text-center transition-colors hover:bg-white/5" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">{tx5(L5FreeWorldCopy.approxMonth, lang)}</p>
              <p className="text-3xl font-bold text-zion-cyan">~11,7M</p>
              <p className="text-xs text-gray-500 mt-1">ZION</p>
            </div>
            <div className="zion-rainbow-sub p-4 text-center transition-colors hover:bg-white/5" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">{tx5(L5FreeWorldCopy.governedBy, lang)}</p>
              <p className="text-2xl font-bold text-zion-cyan">DAO</p>
              <p className="text-xs text-gray-500 mt-1">{tx5(L5FreeWorldCopy.l5Council, lang)}</p>
            </div>
            <FundBalance address={HUMANITARIAN_WALLET} rc="252, 209, 22" label={tx5(L5FreeWorldCopy.liveBalance, lang)} />
          </div>
          <div className="zion-rainbow-sub p-4 text-sm text-gray-400 font-mono break-all" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
            <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">{tx5(L5FreeWorldCopy.fundWallet, lang)}</p>
            {HUMANITARIAN_WALLET}
          </div>
          <div className="mt-4">
            <L5FundTracker />
          </div>
          <p className="mt-4 text-xs text-gray-500">
            {tx5(L5FreeWorldCopy.fundDisbursementNote, lang)}
          </p>
        </motion.section>

        {/* ── Planetary map ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="zion-rainbow-card p-8" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tx5(L5FreeWorldCopy.planetaryMap, lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <MapPin className="h-7 w-7 text-emerald-400" />
              {tx5(L5FreeWorldCopy.sixNodesOnPlanet, lang)}
            </h2>
            <p className="text-sm text-gray-400 max-w-3xl">{tx5(L5FreeWorldCopy.l5MapDesc, lang)}</p>
          </div>
          <FreeWorldMap />
        </motion.section>

        {/* ── Genesis premine allocation ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="zion-rainbow-card p-8" style={{ '--rc': '20, 184, 166' } as React.CSSProperties}>
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tx5(L5FreeWorldCopy.genesisAllocation, lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Wallet className="h-7 w-7 text-teal-300" />
              {tx5(L5FreeWorldCopy.l5PremineTitle, lang)}
            </h2>
            <p className="text-sm text-gray-400">{tx5(L5FreeWorldCopy.l5PremineIntro, lang)}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {premineAllocation.map((item) => (
              <Link key={item.name} href={item.href} className="zion-rainbow-sub p-5 group hover:bg-white/5 transition-colors" style={{ '--rc': '20, 184, 166' } as React.CSSProperties}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-white text-sm">{item.name}</h3>
                  <ArrowRight className="h-4 w-4 text-teal-300/60 group-hover:translate-x-1 transition-transform" />
                </div>
                <p className="text-2xl font-bold text-teal-300">{item.amount}</p>
                <p className="text-xs text-gray-500 mt-1">ZION · {tx5(L5FreeWorldCopy.perProjectAmount, lang)}</p>
              </Link>
            ))}
            <div className="zion-rainbow-sub p-5" style={{ '--rc': '20, 184, 166' } as React.CSSProperties}>
              <div className="flex items-center gap-2 mb-2">
                <Sprout className="h-4 w-4 text-teal-300" />
                <h3 className="font-semibold text-white text-sm">{tx5(L5FreeWorldCopy.l5ReserveFund, lang)}</h3>
              </div>
              <p className="text-2xl font-bold text-teal-300">{cs ? '300 mil.' : t5('300M', lang)}</p>
              <p className="text-xs text-gray-500 mt-1">{cs ? 'Vyhrazeno jako founding rezerva plujícího uzlu María del Camino.' : t5('Earmarked as the founding reserve of the María del Camino vessel node.', lang)}</p>
            </div>
          </div>
          <div className="mt-6 grid sm:grid-cols-2 gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-3 zion-rainbow-sub p-4" style={{ '--rc': '20, 184, 166' } as React.CSSProperties}>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-500">{tx5(L5FreeWorldCopy.totalL5Allocation, lang)}</p>
              <p className="text-2xl font-bold text-teal-300">{cs ? '3 300 000 000 ZION' : t5('3,300,000,000 ZION', lang)}</p>
            </div>
            <FundBalanceSum addresses={[...L5_PREMINE_WALLETS]} rc="20, 184, 166" label={tx5(L5FreeWorldCopy.liveGenesisBalance, lang)} />
          </div>
          <p className="mt-4 text-xs text-gray-500">
            {tx5(L5FreeWorldCopy.l5PremineNote, lang)}
          </p>
        </motion.section>

        {/* ── L5 Protocol suite ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="zion-rainbow-card p-8" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tx5(L5FreeWorldCopy.sharedProtocols, lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Shield className="h-7 w-7 text-zion-cyan" />
              {tx5(L5FreeWorldCopy.baselineL5Protocols, lang)}
            </h2>
            <p className="text-sm text-gray-400">{tx5(L5FreeWorldCopy.everyL5CommunityImplementsThes, lang)}</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {protocols.map((p) => (
              <div key={p.title} className="zion-rainbow-sub p-5" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                <div className="flex items-center gap-2 mb-2">
                  <p.icon className={`h-5 w-5 ${p.color}`} />
                  <h3 className="font-semibold text-white">{p.title}</h3>
                </div>
                <p className="text-sm text-gray-400">{p.desc}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── Onboarding: Seven Gates ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="zion-rainbow-card p-8" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tx5(L5FreeWorldCopy.sevenGates, lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <TreeDeciduous className="h-7 w-7 text-zion-cyan" />
              {tx5(L5FreeWorldCopy.sevenGates, lang)}
            </h2>
            <p className="text-sm text-gray-400 max-w-3xl">{tx5(L5FreeWorldCopy.sevenGatesSubtitle, lang)}</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {onboarding.map((gate) => {
              const Icon = gate.icon;
              const status = getOnboardingStatusStyle(cs, lang, gate.status);
              return (
                <div key={gate.title.en} className="zion-rainbow-sub p-4 flex flex-col justify-between" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-5 w-5 ${gate.color}`} />
                        <h3 className="font-semibold text-white text-sm leading-tight">{cs ? gate.title.cs : gate.title.en}</h3>
                      </div>
                      <span className={`text-[11px] uppercase tracking-widest px-2 py-1 rounded-full font-semibold border ${status.class}`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400">{cs ? gate.desc.cs : gate.desc.en}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <div className="zion-rainbow-sub p-5" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
              <h3 className="font-semibold text-white mb-3">{tx5(L5FreeWorldCopy.noRequirementsTitle, lang)}</h3>
              <ul className="list-disc pl-4 text-sm text-gray-400 space-y-1">
                {rules.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="zion-rainbow-sub p-5" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
              <h3 className="font-semibold text-white mb-3">{tx5(L5FreeWorldCopy.noPromisesTitle, lang)}</h3>
              <ul className="list-disc pl-4 text-sm text-gray-400 space-y-1">
                {promises.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </motion.section>

        {/* ── Communities ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="zion-rainbow-card p-8" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tx5(L5FreeWorldCopy.communities, lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <TreeDeciduous className="h-7 w-7 text-zion-cyan" />
              {tx5(L5FreeWorldCopy.l5NodesCommunities, lang)}
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {communities.map((community) => {
              const status = getStatusStyle(cs, lang, community.status);
              const Card = (
                <div className={`zion-rainbow-sub p-5 transition-all duration-300 ${community.href ? 'cursor-pointer' : ''}`} style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                  {community.cover && (
                    <div className="-m-1 mb-3 overflow-hidden rounded-t-xl">
                      <img
                        src={community.cover.replace('/hero.webp?v=engine-v1', '/hero-m.webp?v=engine-v1')}
                        srcSet={`${community.cover.replace('/hero.webp?v=engine-v1', '/hero-m.webp?v=engine-v1')} 960w, ${community.cover} 1600w`}
                        sizes="(min-width: 768px) 33vw, calc(100vw - 4rem)"
                        alt={community.name}
                        width={1400}
                        height={900}
                        loading="lazy"
                        decoding="async"
                        className="h-36 w-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-white">{community.name}</h3>
                      <p className="text-xs text-gray-500">{community.location}</p>
                    </div>
                    <span className={`text-[11px] uppercase tracking-widest px-2 py-1 rounded-full font-semibold border ${status.class}`}>
                      {status.label}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mb-3">{community.desc}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {community.tags.map((tag) => (
                      <span key={tag} className="text-[11px] rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-gray-400">{tag}</span>
                    ))}
                  </div>
                  {community.href && (
                    <div className="mt-3 flex items-center gap-1 text-xs text-zion-gold/70 group-hover:text-zion-gold transition-colors">
                      <ArrowRight className="h-3 w-3" />
                      {tx5(L5FreeWorldCopy.details, lang)}
                    </div>
                  )}
                </div>
              );
              return community.href ? (
                <Link key={community.name} href={community.href} className="group block">
                  {Card}
                </Link>
              ) : (
                <div key={community.name}>{Card}</div>
              );
            })}
          </div>
          <p className="text-xs text-gray-500 mt-4 text-center">
            {tx5(L5FreeWorldCopy.wantToProposeANewL5CommunityOp, lang)}
          </p>
        </motion.section>

        {/* ── Live registry: projects & grants ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="zion-rainbow-card p-8" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tx5(L5FreeWorldCopy.liveRegistry, lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <FileCheck2 className="h-7 w-7 text-emerald-400" />
              {tx5(L5FreeWorldCopy.projectsAndGrants, lang)}
            </h2>
            <p className="text-sm text-gray-400 max-w-3xl">{tx5(L5FreeWorldCopy.registryDesc, lang)}</p>
          </div>
          <FreeWorldRegistry />
        </motion.section>

        {/* ── Quadratic voting ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="zion-rainbow-card p-8" style={{ '--rc': '168, 85, 247' } as React.CSSProperties}>
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tx5(L5FreeWorldCopy.quadraticVoting, lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Vote className="h-7 w-7 text-zion-purple" />
              {tx5(L5FreeWorldCopy.qvTitle, lang)}
            </h2>
          </div>
          <QvSection />
        </motion.section>

        {/* ── Revenue model ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="zion-rainbow-card p-8" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
          <div className="flex items-center gap-3 mb-6">
            <Wallet className="h-7 w-7 text-zion-cyan" />
            <h2 className="text-3xl font-semibold text-white">{tx5(L5FreeWorldCopy.l5EconomicModel, lang)}</h2>
          </div>
          <div className="space-y-3 text-sm font-mono">
            {[
              { label: tx5(L5FreeWorldCopy.blockRewardNetwork, lang), split: tx5(L5FreeWorldCopy.revenueNetworkSplit, lang), color: 'text-zion-cyan' },
              { label: tx5(L5FreeWorldCopy.guardianNodeLocal, lang), split: tx5(L5FreeWorldCopy.k90CommunityMiner10CommunityTre, lang), color: 'text-zion-cyan' },
              { label: tx5(L5FreeWorldCopy.communityTreasury, lang), split: tx5(L5FreeWorldCopy.k40Ops25Infra20Reserve10Tithe5, lang), color: 'text-zion-gold' },
            ].map((row) => (
              <div key={row.label} className="zion-rainbow-sub p-4" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                <p className={`text-xs uppercase tracking-wider mb-1 ${row.color}`}>{row.label}</p>
                <p className="text-gray-300">{row.split}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── Links ── */}
        <motion.section initial={{ opacity: 0, scale: 0.98 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="zion-cta-banner">
          <h2 className="text-2xl font-semibold text-white text-center mb-6">{tx5(L5FreeWorldCopy.learnMoreAboutL5, lang)}</h2>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/dao" className="zion-rainbow-sub inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
              <Crown className="h-4 w-4 text-zion-gold" /> DAO Governance
            </Link>
            <Link href="/network" className="zion-rainbow-sub inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
              <Globe2 className="h-4 w-4 text-zion-cyan" /> {tx5(L5FreeWorldCopy.network, lang)}
            </Link>
            <Link href="/l6-issobella" className="inline-flex items-center gap-2 rounded-2xl border border-zion-purple/30 bg-zion-purple/5 px-6 py-3 text-sm font-semibold text-rose-200 hover:bg-zion-purple/10 transition-colors">
              L6 Issobella <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </motion.section>

      </div>
    </div>
  );
}
