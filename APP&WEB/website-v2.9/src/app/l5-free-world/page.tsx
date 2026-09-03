'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Globe2, Heart, Shield, Users, Wallet, ArrowRight,
  CheckCircle2, Sparkles, TreeDeciduous, Crown,
  Sprout, Activity, Radio, Brain, Music,
  Eye, Home, Wrench,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

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
  algarvePortugal: { cs: `Algarve, Portugalsko`, en: `Algarve, Portugal` },
  pioneerL5CommunityPermaculture: { cs: `Pionýrská L5 komunita — pernakulturní zahrada, lokální governance a ZION guardian node.`, en: `Pioneer L5 community — permaculture garden, local governance and ZION guardian node.` },
  educationalAndMeditationCenter: { cs: `Vzdělávací a meditační centrum s decentralizovanou správou a off-grid energetikou.`, en: `Educational and meditation center with decentralized governance and off-grid energy.` },
  tePikoOraPolynesianRevival: { cs: `Marine permakultura, wayfinding škola a polynéská kulturní obnova.`, en: `Marine permaculture, wayfinding school and Polynesian cultural revival.` },
  statusDevelopment: { cs: `Aktivní rozvoj`, en: `Active development` },
  statusPreparation: { cs: `V přípravě`, en: `In preparation` },
  statusVision: { cs: `Plánováno`, en: `Planned` },

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
};

const HUMANITARIAN_WALLET = 'zion1y3w4z0c755v4y7t3f0k6s54390x0h3k3y5hv8c8';

type CommunityStatus = 'development' | 'preparation' | 'vision';
type OnboardingStatus = 'live' | 'building' | 'horizon';

const getStatusStyle = (cs: boolean, status: CommunityStatus) => {
  const map = {
    development: {
      label: L5FreeWorldCopy.statusDevelopment[cs ? 'cs' : 'en'],
      class: 'border-zion-gold/30 bg-zion-gold/10 text-zion-gold',
    },
    preparation: {
      label: L5FreeWorldCopy.statusPreparation[cs ? 'cs' : 'en'],
      class: 'border-zion-cyan/30 bg-zion-cyan/10 text-zion-cyan',
    },
    vision: {
      label: L5FreeWorldCopy.statusVision[cs ? 'cs' : 'en'],
      class: 'border-zion-purple/30 bg-zion-purple/10 text-zion-purple',
    },
  };
  return map[status];
};

const getOnboardingStatusStyle = (cs: boolean, status: OnboardingStatus) => {
  const copy = L5FreeWorldCopy;
  const map = {
    live: {
      label: copy.onboardingStatusLive[cs ? 'cs' : 'en'],
      class: 'border-zion-cyan/30 bg-zion-cyan/10 text-zion-cyan',
    },
    building: {
      label: copy.onboardingStatusBuilding[cs ? 'cs' : 'en'],
      class: 'border-zion-gold/30 bg-zion-gold/10 text-zion-gold',
    },
    horizon: {
      label: copy.onboardingStatusHorizon[cs ? 'cs' : 'en'],
      class: 'border-zion-purple/30 bg-zion-purple/10 text-zion-purple',
    },
  };
  return map[status];
};

const getCommunities = (cs: boolean) => [
  {
    name: 'Genesis Garden',
    location: L5FreeWorldCopy.algarvePortugal[cs ? 'cs' : 'en'],
    status: 'development' as const,
    desc: L5FreeWorldCopy.pioneerL5CommunityPermaculture[cs ? 'cs' : 'en'],
    tags: ['Permaculture', 'Guardian Node', 'DAO Circle'],
    href: '/terranova/genesis',
    cover: '/images/genesis-garden/hero.png',
  },
  {
    name: 'Dharma Temple',
    location: 'La Palma — Terra Nova Sanctuary',
    status: 'preparation' as const,
    desc: L5FreeWorldCopy.educationalAndMeditationCenter[cs ? 'cs' : 'en'],
    tags: ['Education', 'Off-grid', 'Meditation'],
    href: '/terranova/dharma-temple',
    cover: '/images/dharma-temple/hero.png',
  },
  {
    name: 'Te Pīko Ora',
    location: 'Raiatea · French Polynesia',
    status: 'vision' as const,
    desc: L5FreeWorldCopy.tePikoOraPolynesianRevival[cs ? 'cs' : 'en'],
    tags: ['Cultural Revival', 'Heritage', 'L5 Fund'],
    href: '/terranova/te-piko-ora',
  },
  {
    name: 'Golden Republic Bohemia',
    location: cs ? 'Čechy, Česká republika' : 'Bohemia, Czech Republic',
    status: 'vision' as const,
    desc: cs
      ? 'Governance laboratoř Zlaté republiky — kruh rozhodování, česká moudrost a ZION protokol v srdci Evropy.'
      : 'Governance laboratory for the Golden Republic — decision circle, Czech wisdom and ZION protocol in the heart of Europe.',
    tags: ['Governance', 'DAO Circle', 'Golden Republic'],
    href: '/terranova/golden-republic-bohemia',
    cover: '/images/golden-republic-bohemia/hero.png',
  },
  {
    name: 'Bodhi Lanka',
    location: cs ? 'Srí Lanka' : 'Sri Lanka',
    status: 'vision' as const,
    desc: cs
      ? 'Akáša uzel — prostor, který drží všechny elementy. Nekonečná láska Ramy a Sity, nejstarší žijící strom na Zemi a ZION protokol.'
      : 'Akasha node — the space that holds all elements. Infinite love of Rama and Sita, the oldest living tree on Earth, and ZION protocol.',
    tags: ['Bhakti', 'Ayurveda', 'Bodhi Tree'],
    href: '/terranova/bodhi-lanka',
    cover: '/images/bodhi-lanka/hero.png',
  },
];

const getProtocols = (cs: boolean) => [
  {
    title: L5FreeWorldCopy.guardianNode[cs ? 'cs' : 'en'],
    desc: L5FreeWorldCopy.everyL5CommunityValidatesBlock[cs ? 'cs' : 'en'],
    icon: Shield,
    color: 'text-zion-cyan',
  },
  {
    title: L5FreeWorldCopy.seedLibrary[cs ? 'cs' : 'en'],
    desc: L5FreeWorldCopy.seedLibraryDesc[cs ? 'cs' : 'en'],
    icon: Sprout,
    color: 'text-zion-gold',
  },
  {
    title: L5FreeWorldCopy.medicalTable[cs ? 'cs' : 'en'],
    desc: L5FreeWorldCopy.medicalTableDesc[cs ? 'cs' : 'en'],
    icon: Activity,
    color: 'text-zion-cyan',
  },
  {
    title: L5FreeWorldCopy.mesh[cs ? 'cs' : 'en'],
    desc: L5FreeWorldCopy.meshDesc[cs ? 'cs' : 'en'],
    icon: Radio,
    color: 'text-zion-purple',
  },
  {
    title: L5FreeWorldCopy.sociocraticDao[cs ? 'cs' : 'en'],
    desc: L5FreeWorldCopy.hybridGovernanceOffChainCircle[cs ? 'cs' : 'en'],
    icon: Users,
    color: 'text-zion-purple',
  },
  {
    title: L5FreeWorldCopy.consciousnessAdmission[cs ? 'cs' : 'en'],
    desc: L5FreeWorldCopy.consciousnessAdmissionDesc[cs ? 'cs' : 'en'],
    icon: Brain,
    color: 'text-zion-gold',
  },
  {
    title: L5FreeWorldCopy.resonanceProtocol[cs ? 'cs' : 'en'],
    desc: L5FreeWorldCopy.soundAttunementBeforeGovernanc[cs ? 'cs' : 'en'],
    icon: Music,
    color: 'text-zion-cyan',
  },
];

const getOnboardingGates = (cs: boolean) => [
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
  const communities = getCommunities(cs);
  const protocols = getProtocols(cs);
  const onboarding = getOnboardingGates(cs);
  const rules = ONBOARDING_RULES[cs ? 'cs' : 'en'];
  const promises = ONBOARDING_PROMISES[cs ? 'cs' : 'en'];

  return (
    <div className="zion-page">
      <div className="zion-container max-w-7xl space-y-16">

        {/* ── HERO ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
          <div className="space-y-5 max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-zion-gold/40 bg-zion-gold/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-gold uppercase">
              <Globe2 className="h-4 w-4" />
              L5 · Terra Nova · Free World
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-gray-400">
                {L5FreeWorldCopy.physicalLayerOfTheZionEcosyste[cs ? 'cs' : 'en']}
              </p>
              <h1 className="text-3xl sm:text-5xl font-semibold text-gradient leading-tight">
                {L5FreeWorldCopy.freeWorldL5[cs ? 'cs' : 'en']}
              </h1>
            </div>
            <p className="text-lg text-gray-300">
              {L5FreeWorldCopy.l5IsThePhysicalLayerOfZionWher[cs ? 'cs' : 'en']}
            </p>
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="inline-flex items-center gap-2 rounded-full border border-zion-gold/30 bg-zion-gold/10 px-4 py-2 text-amber-200">
                <Heart className="h-3 w-3" /> {L5FreeWorldCopy.k5OfEveryBlockL5Fund[cs ? 'cs' : 'en']}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-zion-cyan/30 bg-zion-cyan/10 px-4 py-2 text-emerald-200">
                <CheckCircle2 className="h-3 w-3" /> {L5FreeWorldCopy.k117mZionMonth[cs ? 'cs' : 'en']}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                <Sparkles className="h-3 w-3" /> {L5FreeWorldCopy.fundActiveFromGenesis[cs ? 'cs' : 'en']}
              </span>
            </div>
          </div>
        </motion.section>

        {/* ── Fund Info ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="zion-rainbow-card p-8" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{L5FreeWorldCopy.humanitarianFund[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Heart className="h-7 w-7 text-zion-gold" />
              {L5FreeWorldCopy.l5Fund5BlockReward[cs ? 'cs' : 'en']}
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="zion-rainbow-sub p-4 text-center" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">{L5FreeWorldCopy.blockShare[cs ? 'cs' : 'en']}</p>
              <p className="text-3xl font-bold text-zion-gold">5%</p>
              <p className="text-xs text-gray-500 mt-1">{L5FreeWorldCopy.everyBlockForever[cs ? 'cs' : 'en']}</p>
            </div>
            <div className="zion-rainbow-sub p-4 text-center" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">{L5FreeWorldCopy.approxMonth[cs ? 'cs' : 'en']}</p>
              <p className="text-3xl font-bold text-zion-cyan">~11,7M</p>
              <p className="text-xs text-gray-500 mt-1">ZION</p>
            </div>
            <div className="zion-rainbow-sub p-4 text-center" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">{L5FreeWorldCopy.governedBy[cs ? 'cs' : 'en']}</p>
              <p className="text-2xl font-bold text-zion-cyan">DAO</p>
              <p className="text-xs text-gray-500 mt-1">{L5FreeWorldCopy.l5Council[cs ? 'cs' : 'en']}</p>
            </div>
          </div>
          <div className="zion-rainbow-sub p-4 text-sm text-gray-400 font-mono break-all" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
            <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">{L5FreeWorldCopy.fundWallet[cs ? 'cs' : 'en']}</p>
            {HUMANITARIAN_WALLET}
          </div>
          <p className="mt-4 text-xs text-gray-500">
            {L5FreeWorldCopy.fundDisbursementNote[cs ? 'cs' : 'en']}
          </p>
        </motion.section>

        {/* ── L5 Protocol suite ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="zion-rainbow-card p-8" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{L5FreeWorldCopy.sharedProtocols[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Shield className="h-7 w-7 text-zion-cyan" />
              {L5FreeWorldCopy.baselineL5Protocols[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400">{L5FreeWorldCopy.everyL5CommunityImplementsThes[cs ? 'cs' : 'en']}</p>
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
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{L5FreeWorldCopy.sevenGates[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <TreeDeciduous className="h-7 w-7 text-zion-cyan" />
              {L5FreeWorldCopy.sevenGates[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400 max-w-3xl">{L5FreeWorldCopy.sevenGatesSubtitle[cs ? 'cs' : 'en']}</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {onboarding.map((gate) => {
              const Icon = gate.icon;
              const status = getOnboardingStatusStyle(cs, gate.status);
              return (
                <div key={gate.title.en} className="zion-rainbow-sub p-4 flex flex-col justify-between" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-5 w-5 ${gate.color}`} />
                        <h3 className="font-semibold text-white text-sm leading-tight">{cs ? gate.title.cs : gate.title.en}</h3>
                      </div>
                      <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full font-semibold border ${status.class}`}>
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
              <h3 className="font-semibold text-white mb-3">{L5FreeWorldCopy.noRequirementsTitle[cs ? 'cs' : 'en']}</h3>
              <ul className="list-disc pl-4 text-sm text-gray-400 space-y-1">
                {rules.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="zion-rainbow-sub p-5" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
              <h3 className="font-semibold text-white mb-3">{L5FreeWorldCopy.noPromisesTitle[cs ? 'cs' : 'en']}</h3>
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
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{L5FreeWorldCopy.communities[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <TreeDeciduous className="h-7 w-7 text-zion-cyan" />
              {L5FreeWorldCopy.l5NodesCommunities[cs ? 'cs' : 'en']}
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {communities.map((community) => {
              const status = getStatusStyle(cs, community.status);
              const Card = (
                <div className={`zion-rainbow-sub p-5 transition-all duration-300 ${community.href ? 'cursor-pointer' : ''}`} style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                  {community.cover && (
                    <div className="-m-1 mb-3 overflow-hidden rounded-t-xl">
                      <img src={community.cover} alt={community.name} className="h-36 w-full object-cover" />
                    </div>
                  )}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-white">{community.name}</h3>
                      <p className="text-xs text-gray-500">{community.location}</p>
                    </div>
                    <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full font-semibold border ${status.class}`}>
                      {status.label}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mb-3">{community.desc}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {community.tags.map((tag) => (
                      <span key={tag} className="text-[10px] rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-gray-400">{tag}</span>
                    ))}
                  </div>
                  {community.href && (
                    <div className="mt-3 flex items-center gap-1 text-xs text-zion-gold/70 group-hover:text-zion-gold transition-colors">
                      <ArrowRight className="h-3 w-3" />
                      {L5FreeWorldCopy.details[cs ? 'cs' : 'en']}
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
            {L5FreeWorldCopy.wantToProposeANewL5CommunityOp[cs ? 'cs' : 'en']}
          </p>
        </motion.section>

        {/* ── Revenue model ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="zion-rainbow-card p-8" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
          <div className="flex items-center gap-3 mb-6">
            <Wallet className="h-7 w-7 text-zion-cyan" />
            <h2 className="text-3xl font-semibold text-white">{L5FreeWorldCopy.l5EconomicModel[cs ? 'cs' : 'en']}</h2>
          </div>
          <div className="space-y-3 text-sm font-mono">
            {[
              { label: L5FreeWorldCopy.blockRewardNetwork[cs ? 'cs' : 'en'], split: L5FreeWorldCopy.revenueNetworkSplit[cs ? 'cs' : 'en'], color: 'text-zion-cyan' },
              { label: L5FreeWorldCopy.guardianNodeLocal[cs ? 'cs' : 'en'], split: L5FreeWorldCopy.k90CommunityMiner10CommunityTre[cs ? 'cs' : 'en'], color: 'text-zion-cyan' },
              { label: L5FreeWorldCopy.communityTreasury[cs ? 'cs' : 'en'], split: L5FreeWorldCopy.k40Ops25Infra20Reserve10Tithe5[cs ? 'cs' : 'en'], color: 'text-zion-gold' },
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
          <h2 className="text-2xl font-semibold text-white text-center mb-6">{L5FreeWorldCopy.learnMoreAboutL5[cs ? 'cs' : 'en']}</h2>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/dao" className="zion-rainbow-sub inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
              <Crown className="h-4 w-4 text-zion-gold" /> DAO Governance
            </Link>
            <Link href="/network" className="zion-rainbow-sub inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
              <Globe2 className="h-4 w-4 text-zion-cyan" /> {L5FreeWorldCopy.network[cs ? 'cs' : 'en']}
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
