'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Gamepad2, Gem, Users, Zap, Sparkles, ArrowRight,
  CheckCircle2, Clock, Palette, Cpu, Globe2, BookOpen,
  Layers, Swords, Trophy, MapPin, Shield, Star, Coins
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

const L4OasisCopy = {
  ue5Metaverse: { cs: `UE5 Metaverse`, en: `UE5 Metaverse` },
  unrealEngine5WorldBuiltOnZionP: { cs: `Unreal Engine 5 svět postavený na ZION — photorealistické prostředí, persistentní stav, on-chain inventory.`, en: `Unreal Engine 5 world built on ZION — photorealistic environments, persistent state, on-chain inventory.` },
  xpEconomy: { cs: `XP Ekonomie`, en: `XP Economy` },
  gameXpConvertsToZionTokensSkil: { cs: `Herní XP se převádí na ZION tokeny — skill-based mining, quest rewards, guild treasury.`, en: `Game XP converts to ZION tokens — skill-based mining, quest rewards, guild treasury.` },
  onChainInventory: { cs: `On-Chain Inventory`, en: `On-Chain Inventory` },
  allGameItemsAreNftsOnZionL1Tru: { cs: `Všechny herní předměty jsou NFT na ZION L1 — skutečné vlastnictví, obchodování na marketplace.`, en: `All game items are NFTs on ZION L1 — true ownership, trading on marketplace.` },
  guildDao: { cs: `Guild DAO`, en: `Guild DAO` },
  playerGuildsAsDaosSharedTreasu: { cs: `Hráčské guildy jako DAO — společné treasury, hlasování o expanzi, territory claims.`, en: `Player guilds as DAOs — shared treasury, expansion voting, territory claims.` },
  coreAvatars: { cs: `Základní avataři`, en: `Core Avatars` },
  k51UniqueCoreAvatarsWithFullAni: { cs: `51 unikátních základních avatarů s plnou animací a skillem.`, en: `51 unique core avatars with full animation and skill tree.` },
  extendedAvatars: { cs: `Rozšíření avataři`, en: `Extended Avatars` },
  k151ExtendedAvatarsWithUniqueTr: { cs: `151 rozšířených avatarů s unikátními vlastnostmi a příběhem.`, en: `151 extended avatars with unique traits and backstory.` },
  questEngine: { cs: `Quest systém`, en: `Quest Engine` },
  k5QuestsPerAvatarPveExploration: { cs: `5 questů na každého avatara — PvE, exploration, crafting, social.`, en: `5 quests per avatar — PvE, exploration, crafting, social.` },
  totalPrizePool: { cs: `Celková výhra`, en: `Total Prize Pool` },
  clues: { cs: `Stopy / indicie`, en: `Clues` },
  estimatedStart: { cs: `Odhadovaný start`, en: `Estimated Start` },
  type: { cs: `Typ`, en: `Type` },
  globalTreasureHunt: { cs: `Celosvětová honba`, en: `Global Treasure Hunt` },
  alpha: { cs: `Alpha`, en: `Alpha` },
  beta: { cs: `Beta`, en: `Beta` },
  live: { cs: `Live`, en: `Live` },
  avatarMinting: { cs: `Avatar Minting`, en: `Avatar Minting` },
  everyAvatarIsAnNftOnZionL1Erc7: { cs: `Každý avatar je NFT na ZION L1 — ERC-721 kompatibilní, metadata on-chain.`, en: `Every avatar is an NFT on ZION L1 — ERC-721 compatible, metadata on-chain.` },
  questEngine_2: { cs: `Quest Engine`, en: `Quest Engine` },
  k5QuestsPerAvatarGenerativeCont: { cs: `5 questů na avatara — generativní obsah, skóre, odměny v ZION.`, en: `5 quests per avatar — generative content, scoring, ZION rewards.` },
  nftInventory: { cs: `NFT Inventory`, en: `NFT Inventory` },
  itemsWeaponsArmorAllAsNftsWith: { cs: `Itemy, zbraně, brnění — vše jako NFT s UTXO-backed ownership.`, en: `Items, weapons, armor — all as NFTs with UTXO-backed ownership.` },
  guildTreasury: { cs: `Guild Treasury`, en: `Guild Treasury` },
  guildsAsSubDaosOnChainTreasury: { cs: `Guildy jako sub-DAO — on-chain treasury, vote-weighted governance.`, en: `Guilds as sub-DAOs — on-chain treasury, vote-weighted governance.` },
  territoryClaims: { cs: `Territory Claims`, en: `Territory Claims` },
  digitalTerritoriesOnZionMapL1R: { cs: `Digitální teritoria na ZION mapě — L1 záznam, guild ownership.`, en: `Digital territories on ZION map — L1 record, guild ownership.` },
  xpZionBridge: { cs: `XP → ZION Bridge`, en: `XP → ZION Bridge` },
  xpFromQuestsConvertibleToZionT: { cs: `XP z questů konvertovatelný na ZION tokeny — non-consensus ekonomika.`, en: `XP from quests convertible to ZION tokens — non-consensus economy.` },
  gameLayerOfTheZionEcosystem: { cs: `Herní vrstva ZION ekosystému`, en: `Game layer of the ZION ecosystem` },
  zionOasisL4: { cs: `ZION Oasis — L4`, en: `ZION Oasis — L4` },
  metaverseBuiltOnTheZionBlockch: { cs: `Metaverse postavený na ZION blockchainu. UE5 svět s on-chain inventory, XP ekonomií, guild DAO a Golden Egg pokladem. Avatar systém aktivní — 51 core + 151 extended avatarů s quest engine.`, en: `Metaverse built on the ZION blockchain. UE5 world with on-chain inventory, XP economy, guild DAO, and Golden Egg treasure hunt. Avatar system active — 51 core + 151 extended avatars with quest engine.` },
  ue5Integration20282029: { cs: `UE5 integrace 2028–2029`, en: `UE5 integration 2028–2029` },
  liveSystem: { cs: `Živý systém`, en: `Live System` },
  avatarSystemActive: { cs: `Avatar systém — Active`, en: `Avatar System — Active` },
  k51Core151ExtendedAvatarsEachHa: { cs: `51 core + 151 extended avatarů. Každý má 5 questů. REST API endpointy /avatars a /quests jsou aktivní.`, en: `51 core + 151 extended avatars. Each has 5 quests. REST API endpoints /avatars and /quests are active.` },
  treasure: { cs: `Poklad`, en: `Treasure` },
  goldenEgg108Clues825bZion: { cs: `Golden Egg — 108 stop, 8.25B ZION`, en: `Golden Egg — 108 Clues, 8.25B ZION` },
  goldenEggIsAMassiveTreasureHun: { cs: `Golden Egg je masivní honba za pokladem napříč celým ZION ekosystémem. 108 kryptických stop je ukryto v blockchainu, smart kontraktech, knihách TerraNova a fyzických lokacích. Vítěz získá 8,25 miliardy ZION — 50,7 % genesis rezervy. Start plánován na 2027.`, en: `Golden Egg is a massive treasure hunt across the entire ZION ecosystem. 108 cryptic clues are hidden in the blockchain, smart contracts, TerraNova books, and physical locations. The winner receives 8.25 billion ZION — 50.7% of the genesis reserve. Launch planned for 2027.` },
  baselineProtocols: { cs: `Baseline protokoly`, en: `Baseline Protocols` },
  oasisGameProtocols: { cs: `Oasis Game Protocols`, en: `Oasis Game Protocols` },
  coreGameProtocolsForInteropera: { cs: `Základní herní protokoly pro interoperabilitu napříč ZION Oasis ekosystémem.`, en: `Core game protocols for interoperability across the ZION Oasis ecosystem.` },
  vision: { cs: `Vize`, en: `Vision` },
  oasisKeyPillars: { cs: `Klíčové pilíře Oasis`, en: `Oasis Key Pillars` },
  developmentPath: { cs: `Vývojová cesta`, en: `Development Path` },
  l4OasisRoadmap: { cs: `Roadmap L4 Oasis`, en: `L4 Oasis Roadmap` },
  learnMoreAboutL4AndTheEcosyste: { cs: `Více o L4 a ekosystému`, en: `Learn more about L4 and the ecosystem` },
};

const AVATAR_COUNT_CORE = 51;
const AVATAR_COUNT_EXTENDED = 151;
const GOLDEN_EGG_CLUES = 108;
const GOLDEN_EGG_PRIZE = '8,250,000,000';

const getFeatures = (cs: boolean) => [
  {
    title: L4OasisCopy.ue5Metaverse[cs ? 'cs' : 'en'],
    desc: L4OasisCopy.unrealEngine5WorldBuiltOnZionP[cs ? 'cs' : 'en'],
    icon: Palette,
    color: 'text-zion-gold-400',
    active: false,
  },
  {
    title: L4OasisCopy.xpEconomy[cs ? 'cs' : 'en'],
    desc: L4OasisCopy.gameXpConvertsToZionTokensSkil[cs ? 'cs' : 'en'],
    icon: Gem,
    color: 'text-zion-gold-400',
    active: false,
  },
  {
    title: L4OasisCopy.onChainInventory[cs ? 'cs' : 'en'],
    desc: L4OasisCopy.allGameItemsAreNftsOnZionL1Tru[cs ? 'cs' : 'en'],
    icon: Cpu,
    color: 'text-zion-cyan-400',
    active: false,
  },
  {
    title: L4OasisCopy.guildDao[cs ? 'cs' : 'en'],
    desc: L4OasisCopy.playerGuildsAsDaosSharedTreasu[cs ? 'cs' : 'en'],
    icon: Users,
    color: 'text-zion-purple-400',
    active: false,
  },
];

const getAvatarTypes = (cs: boolean) => [
  {
    name: L4OasisCopy.coreAvatars[cs ? 'cs' : 'en'],
    count: `${AVATAR_COUNT_CORE}`,
    desc: L4OasisCopy.k51UniqueCoreAvatarsWithFullAni[cs ? 'cs' : 'en'],
    icon: Star,
    color: 'border-zion-gold-500/30 bg-zion-gold-500/5',
    badge: 'border-zion-gold-500/30 bg-zion-gold-500/10 text-zion-gold-300',
  },
  {
    name: L4OasisCopy.extendedAvatars[cs ? 'cs' : 'en'],
    count: `${AVATAR_COUNT_EXTENDED}`,
    desc: L4OasisCopy.k151ExtendedAvatarsWithUniqueTr[cs ? 'cs' : 'en'],
    icon: Sparkles,
    color: 'border-zion-purple-500/30 bg-zion-purple-500/5',
    badge: 'border-zion-purple-500/30 bg-zion-purple-500/10 text-zion-purple-300',
  },
  {
    name: L4OasisCopy.questEngine[cs ? 'cs' : 'en'],
    count: '5',
    desc: L4OasisCopy.k5QuestsPerAvatarPveExploration[cs ? 'cs' : 'en'],
    icon: Swords,
    color: 'border-zion-cyan-500/30 bg-zion-cyan-500/5',
    badge: 'border-zion-cyan-500/30 bg-zion-cyan-500/10 text-zion-cyan-300',
  },
];

const getGoldenEgg = (cs: boolean) => [
  { label: L4OasisCopy.totalPrizePool[cs ? 'cs' : 'en'], value: `${GOLDEN_EGG_PRIZE} ZION`, color: 'text-zion-gold' },
  { label: L4OasisCopy.clues[cs ? 'cs' : 'en'], value: `${GOLDEN_EGG_CLUES}`, color: 'text-zion-gold-400' },
  { label: L4OasisCopy.estimatedStart[cs ? 'cs' : 'en'], value: '2027', color: 'text-zion-cyan-400' },
  { label: L4OasisCopy.type[cs ? 'cs' : 'en'], value: L4OasisCopy.globalTreasureHunt[cs ? 'cs' : 'en'], color: 'text-zion-purple-400' },
];

const getRoadmap = (cs: boolean) => [
  {
    phase: L4OasisCopy.alpha[cs ? 'cs' : 'en'],
    period: '2027 Q3',
    status: 'planned',
    items: cs
      ? ['Základní UE5 svět', 'On-chain avatars', 'XP systém', 'Testovací síť']
      : ['Basic UE5 world', 'On-chain avatars', 'XP system', 'Test network'],
  },
  {
    phase: L4OasisCopy.beta[cs ? 'cs' : 'en'],
    period: '2028 Q2',
    status: 'planned',
    items: cs
      ? ['NFT inventory', 'Guild systém', 'PvE questy', 'ZION marketplace integrace']
      : ['NFT inventory', 'Guild system', 'PvE quests', 'ZION marketplace integration'],
  },
  {
    phase: L4OasisCopy.live[cs ? 'cs' : 'en'],
    period: '2028 Q4',
    status: 'vision',
    items: cs
      ? ['Full economy', 'Cross-guild warfare', 'Land ownership', 'VR/AR podpora']
      : ['Full economy', 'Cross-guild warfare', 'Land ownership', 'VR/AR support'],
  },
];

const getProtocols = (cs: boolean) => [
  {
    title: L4OasisCopy.avatarMinting[cs ? 'cs' : 'en'],
    desc: L4OasisCopy.everyAvatarIsAnNftOnZionL1Erc7[cs ? 'cs' : 'en'],
    icon: Star,
    color: 'text-zion-gold-400',
  },
  {
    title: L4OasisCopy.questEngine_2[cs ? 'cs' : 'en'],
    desc: L4OasisCopy.k5QuestsPerAvatarGenerativeCont[cs ? 'cs' : 'en'],
    icon: Swords,
    color: 'text-zion-cyan-400',
  },
  {
    title: L4OasisCopy.nftInventory[cs ? 'cs' : 'en'],
    desc: L4OasisCopy.itemsWeaponsArmorAllAsNftsWith[cs ? 'cs' : 'en'],
    icon: Shield,
    color: 'text-zion-cyan-400',
  },
  {
    title: L4OasisCopy.guildTreasury[cs ? 'cs' : 'en'],
    desc: L4OasisCopy.guildsAsSubDaosOnChainTreasury[cs ? 'cs' : 'en'],
    icon: Coins,
    color: 'text-zion-purple-400',
  },
  {
    title: L4OasisCopy.territoryClaims[cs ? 'cs' : 'en'],
    desc: L4OasisCopy.digitalTerritoriesOnZionMapL1R[cs ? 'cs' : 'en'],
    icon: MapPin,
    color: 'text-zion-gold-400',
  },
  {
    title: L4OasisCopy.xpZionBridge[cs ? 'cs' : 'en'],
    desc: L4OasisCopy.xpFromQuestsConvertibleToZionT[cs ? 'cs' : 'en'],
    icon: Zap,
    color: 'text-zion-gold-400',
  },
];

export default function L4OasisPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const features = getFeatures(cs);
  const avatarTypes = getAvatarTypes(cs);
  const goldenEgg = getGoldenEgg(cs);
  const roadmap = getRoadmap(cs);
  const protocols = getProtocols(cs);

  return (
    <div className="pt-28 pb-24 overflow-x-hidden">
      <div className="zion-container max-w-7xl space-y-16">

        {/* ── HERO ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="zion-rainbow-card p-6 md:p-10"
          style={{ '--rc': '7, 137, 48' } as React.CSSProperties}
        >
          <div className="space-y-5 max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-zion-gold-500/40 bg-zion-gold-500/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-gold-300 uppercase">
              <Gamepad2 className="h-4 w-4" />
              L4 · ZION Oasis · Game Layer
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-gray-400">
                {L4OasisCopy.gameLayerOfTheZionEcosystem[cs ? 'cs' : 'en']}
              </p>
              <h1 className="text-3xl sm:text-5xl font-semibold text-gradient leading-tight">
                {L4OasisCopy.zionOasisL4[cs ? 'cs' : 'en']}
              </h1>
            </div>
            <p className="text-lg text-gray-300">
              {L4OasisCopy.metaverseBuiltOnTheZionBlockch[cs ? 'cs' : 'en']}
            </p>
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="inline-flex items-center gap-2 rounded-full border border-zion-gold-500/30 bg-zion-gold-500/10 px-4 py-2 text-orange-200">
                <Star className="h-3 w-3" /> {cs ? `${AVATAR_COUNT_CORE + AVATAR_COUNT_EXTENDED} avatarů aktivních` : `${AVATAR_COUNT_CORE + AVATAR_COUNT_EXTENDED} avatars active`}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-zion-gold/30 bg-zion-gold/10 px-4 py-2 text-amber-200">
                <Gem className="h-3 w-3" /> {cs ? `${GOLDEN_EGG_PRIZE} ZION prize` : `${GOLDEN_EGG_PRIZE} ZION prize`}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                <Clock className="h-3 w-3" /> {L4OasisCopy.ue5Integration20282029[cs ? 'cs' : 'en']}
              </span>
            </div>
          </div>
        </motion.section>

        {/* ── AVATAR SYSTEM ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="zion-rainbow-card p-8"
          style={{ '--rc': '7, 137, 48' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{L4OasisCopy.liveSystem[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Star className="h-7 w-7 text-zion-gold-400" />
              {L4OasisCopy.avatarSystemActive[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400">
              {L4OasisCopy.k51Core151ExtendedAvatarsEachHa[cs ? 'cs' : 'en']}
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            {avatarTypes.map((a) => (
              <div key={a.name} className="zion-rainbow-sub p-5" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <a.icon className="h-5 w-5 text-gray-300" />
                    <h3 className="font-semibold text-white">{a.name}</h3>
                  </div>
                  <span className={`text-xs uppercase tracking-widest px-2 py-1 rounded-full font-semibold border ${a.badge}`}>
                    {a.count}
                  </span>
                </div>
                <p className="text-sm text-gray-400">{a.desc}</p>
              </div>
            ))}
          </div>
          <div className="zion-rainbow-sub p-4 text-sm text-gray-400 font-mono" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
            <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">API</p>
            GET /avatars · GET /quests · POST /quests/complete · GET /avatars/&#123;id&#125;/stats
          </div>
        </motion.section>

        {/* ── GOLDEN EGG ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="zion-rainbow-card p-8"
          style={{ '--rc': '7, 137, 48' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{L4OasisCopy.treasure[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Trophy className="h-7 w-7 text-zion-gold" />
              {L4OasisCopy.goldenEgg108Clues825bZion[cs ? 'cs' : 'en']}
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {goldenEgg.map((stat) => (
              <div key={stat.label} className="zion-rainbow-sub p-4 text-center" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
                <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">{stat.label}</p>
                <p className={`text-xl md:text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-300 leading-relaxed">
            {L4OasisCopy.goldenEggIsAMassiveTreasureHun[cs ? 'cs' : 'en']}
          </p>
        </motion.section>

        {/* ── PROTOCOLS ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="zion-rainbow-card p-8"
          style={{ '--rc': '7, 137, 48' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{L4OasisCopy.baselineProtocols[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Shield className="h-7 w-7 text-zion-cyan-400" />
              {L4OasisCopy.oasisGameProtocols[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400">
              {L4OasisCopy.coreGameProtocolsForInteropera[cs ? 'cs' : 'en']}
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {protocols.map((p) => (
              <div key={p.title} className="zion-rainbow-sub p-5" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
                <div className="flex items-center gap-2 mb-2">
                  <p.icon className={`h-5 w-5 ${p.color}`} />
                  <h3 className="font-semibold text-white">{p.title}</h3>
                </div>
                <p className="text-sm text-gray-400">{p.desc}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── FEATURES ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="zion-rainbow-card p-8"
          style={{ '--rc': '7, 137, 48' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{L4OasisCopy.vision[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Palette className="h-7 w-7 text-zion-gold-400" />
              {L4OasisCopy.oasisKeyPillars[cs ? 'cs' : 'en']}
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((f) => (
              <div key={f.title} className="zion-rainbow-sub p-5" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
                <f.icon className={`h-8 w-8 ${f.color} mb-3`} />
                <h3 className="font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-gray-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── ROADMAP ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="zion-rainbow-card p-8"
          style={{ '--rc': '7, 137, 48' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{L4OasisCopy.developmentPath[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Clock className="h-7 w-7 text-zion-cyan-400" />
              {L4OasisCopy.l4OasisRoadmap[cs ? 'cs' : 'en']}
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {roadmap.map((phase) => (
              <div key={phase.phase} className="zion-rainbow-sub p-5" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-lg font-bold text-white">{phase.phase}</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                    phase.status === 'planned'
                      ? 'bg-zion-gold-500/10 text-zion-gold-300 border-zion-gold-500/20'
                      : 'bg-zion-purple-500/10 text-zion-purple-300 border-zion-purple-500/20'
                  }`}>
                    {phase.period}
                  </span>
                </div>
                <ul className="space-y-3">
                  {phase.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-gray-400">
                      {phase.status === 'planned' ? (
                        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-zion-gold-400" />
                      ) : (
                        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-zion-purple-400" />
                      )}
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── LINKS ── */}
        <motion.section
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="zion-cta-banner"
        >
          <h2 className="text-2xl font-semibold text-white text-center mb-6">
            {L4OasisCopy.learnMoreAboutL4AndTheEcosyste[cs ? 'cs' : 'en']}
          </h2>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/l3-hiran" className="inline-flex items-center gap-2 rounded-2xl border border-zion-purple-500/30 bg-zion-purple-500/5 px-6 py-3 text-sm font-semibold text-purple-200 hover:bg-zion-purple-500/10 transition-colors">
              <Sparkles className="h-4 w-4" /> L3 Hiran
            </Link>
            <Link href="/l5-free-world" className="inline-flex items-center gap-2 rounded-2xl border border-zion-gold-500/30 bg-zion-gold-500/5 px-6 py-3 text-sm font-semibold text-amber-200 hover:bg-zion-gold-500/10 transition-colors">
              L5 Free World <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/terranova" className="zion-rainbow-sub inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
              <BookOpen className="h-4 w-4" /> TerraNova Book
            </Link>
          </div>
        </motion.section>

      </div>
    </div>
  );
}
