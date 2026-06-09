'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Gamepad2, Gem, Users, Zap, Sparkles, ArrowRight,
  CheckCircle2, Clock, Palette, Cpu, Globe2, BookOpen,
  Layers, Swords, Trophy, MapPin, Shield, Star, Coins
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

const AVATAR_COUNT_CORE = 51;
const AVATAR_COUNT_EXTENDED = 151;
const GOLDEN_EGG_CLUES = 108;
const GOLDEN_EGG_PRIZE = '8,250,000,000';

const getFeatures = (cs: boolean) => [
  {
    title: cs ? 'UE5 Metaverse' : 'UE5 Metaverse',
    desc: cs
      ? 'Unreal Engine 5 svět postavený na ZION — photorealistické prostředí, persistentní stav, on-chain inventory.'
      : 'Unreal Engine 5 world built on ZION — photorealistic environments, persistent state, on-chain inventory.',
    icon: Palette,
    color: 'text-orange-400',
    active: false,
  },
  {
    title: cs ? 'XP Ekonomie' : 'XP Economy',
    desc: cs
      ? 'Herní XP se převádí na ZION tokeny — skill-based mining, quest rewards, guild treasury.'
      : 'Game XP converts to ZION tokens — skill-based mining, quest rewards, guild treasury.',
    icon: Gem,
    color: 'text-yellow-400',
    active: false,
  },
  {
    title: cs ? 'On-Chain Inventory' : 'On-Chain Inventory',
    desc: cs
      ? 'Všechny herní předměty jsou NFT na ZION L1 — skutečné vlastnictví, obchodování na marketplace.'
      : 'All game items are NFTs on ZION L1 — true ownership, trading on marketplace.',
    icon: Cpu,
    color: 'text-cyan-400',
    active: false,
  },
  {
    title: cs ? 'Guild DAO' : 'Guild DAO',
    desc: cs
      ? 'Hráčské guildy jako DAO — společné treasury, hlasování o expanzi, territory claims.'
      : 'Player guilds as DAOs — shared treasury, expansion voting, territory claims.',
    icon: Users,
    color: 'text-purple-400',
    active: false,
  },
];

const getAvatarTypes = (cs: boolean) => [
  {
    name: cs ? 'Základní avataři' : 'Core Avatars',
    count: `${AVATAR_COUNT_CORE}`,
    desc: cs ? '51 unikátních základních avatarů s plnou animací a skillem.' : '51 unique core avatars with full animation and skill tree.',
    icon: Star,
    color: 'border-orange-500/30 bg-orange-500/5',
    badge: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
  },
  {
    name: cs ? 'Rozšíření avataři' : 'Extended Avatars',
    count: `${AVATAR_COUNT_EXTENDED}`,
    desc: cs ? '151 rozšířených avatarů s unikátními vlastnostmi a příběhem.' : '151 extended avatars with unique traits and backstory.',
    icon: Sparkles,
    color: 'border-purple-500/30 bg-purple-500/5',
    badge: 'border-purple-500/30 bg-purple-500/10 text-purple-300',
  },
  {
    name: cs ? 'Quest systém' : 'Quest Engine',
    count: '5',
    desc: cs ? '5 questů na každého avatara — PvE, exploration, crafting, social.' : '5 quests per avatar — PvE, exploration, crafting, social.',
    icon: Swords,
    color: 'border-cyan-500/30 bg-cyan-500/5',
    badge: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  },
];

const getGoldenEgg = (cs: boolean) => [
  { label: cs ? 'Celkový prize pool' : 'Total Prize Pool', value: `${GOLDEN_EGG_PRIZE} ZION`, color: 'text-zion-gold' },
  { label: cs ? 'Stop / Clues' : 'Clues', value: `${GOLDEN_EGG_CLUES}`, color: 'text-orange-400' },
  { label: cs ? 'Odhadovaný start' : 'Estimated Start', value: '2027', color: 'text-cyan-400' },
  { label: cs ? 'Typ' : 'Type', value: cs ? 'Celosvětová honba' : 'Global Treasure Hunt', color: 'text-purple-400' },
];

const getRoadmap = (cs: boolean) => [
  {
    phase: cs ? 'Alpha' : 'Alpha',
    period: '2027 Q3',
    status: 'planned',
    items: cs
      ? ['Základní UE5 svět', 'On-chain avatars', 'XP systém', 'Testovací síť']
      : ['Basic UE5 world', 'On-chain avatars', 'XP system', 'Test network'],
  },
  {
    phase: cs ? 'Beta' : 'Beta',
    period: '2028 Q2',
    status: 'planned',
    items: cs
      ? ['NFT inventory', 'Guild systém', 'PvE questy', 'ZION marketplace integrace']
      : ['NFT inventory', 'Guild system', 'PvE quests', 'ZION marketplace integration'],
  },
  {
    phase: cs ? 'Live' : 'Live',
    period: '2028 Q4',
    status: 'vision',
    items: cs
      ? ['Full economy', 'Cross-guild warfare', 'Land ownership', 'VR/AR podpora']
      : ['Full economy', 'Cross-guild warfare', 'Land ownership', 'VR/AR support'],
  },
];

const getProtocols = (cs: boolean) => [
  {
    title: cs ? 'Avatar Minting' : 'Avatar Minting',
    desc: cs ? 'Každý avatar je NFT na ZION L1 — ERC-721 kompatibilní, metadata on-chain.' : 'Every avatar is an NFT on ZION L1 — ERC-721 compatible, metadata on-chain.',
    icon: Star,
    color: 'text-orange-400',
  },
  {
    title: cs ? 'Quest Engine' : 'Quest Engine',
    desc: cs ? '5 questů na avatara — generativní obsah, skóre, odměny v ZION.' : '5 quests per avatar — generative content, scoring, ZION rewards.',
    icon: Swords,
    color: 'text-cyan-400',
  },
  {
    title: cs ? 'NFT Inventory' : 'NFT Inventory',
    desc: cs ? 'Itemy, zbraně, brnění — vše jako NFT s UTXO-backed ownership.' : 'Items, weapons, armor — all as NFTs with UTXO-backed ownership.',
    icon: Shield,
    color: 'text-emerald-400',
  },
  {
    title: cs ? 'Guild Treasury' : 'Guild Treasury',
    desc: cs ? 'Guildy jako sub-DAO — on-chain treasury, vote-weighted governance.' : 'Guilds as sub-DAOs — on-chain treasury, vote-weighted governance.',
    icon: Coins,
    color: 'text-purple-400',
  },
  {
    title: cs ? 'Territory Claims' : 'Territory Claims',
    desc: cs ? 'Digitální teritoria na ZION mapě — L1 záznam, guild ownership.' : 'Digital territories on ZION map — L1 record, guild ownership.',
    icon: MapPin,
    color: 'text-amber-400',
  },
  {
    title: cs ? 'XP → ZION Bridge' : 'XP → ZION Bridge',
    desc: cs ? 'XP z questů konvertovatelný na ZION tokeny — non-consensus ekonomika.' : 'XP from quests convertible to ZION tokens — non-consensus economy.',
    icon: Zap,
    color: 'text-yellow-400',
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
          className="rounded-3xl border border-orange-500/30 bg-gradient-to-br from-orange-500/10 via-black/60 to-yellow-500/10 p-6 md:p-10 backdrop-blur-xl"
        >
          <div className="space-y-5 max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/40 bg-orange-500/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-orange-300 uppercase">
              <Gamepad2 className="h-4 w-4" />
              L4 · ZION Oasis · Game Layer
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-gray-400">
                {cs ? 'Herní vrstva ZION ekosystému' : 'Game layer of the ZION ecosystem'}
              </p>
              <h1 className="text-3xl sm:text-5xl font-semibold text-gradient leading-tight">
                {cs ? 'ZION Oasis — L4' : 'ZION Oasis — L4'}
              </h1>
            </div>
            <p className="text-lg text-gray-300">
              {cs
                ? 'Metaverse postavený na ZION blockchainu. UE5 svět s on-chain inventory, XP ekonomií, guild DAO a Golden Egg pokladem. Avatar systém aktivní — 51 core + 151 extended avatarů s quest engine.'
                : 'Metaverse built on the ZION blockchain. UE5 world with on-chain inventory, XP economy, guild DAO, and Golden Egg treasure hunt. Avatar system active — 51 core + 151 extended avatars with quest engine.'}
            </p>
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-2 text-orange-200">
                <Star className="h-3 w-3" /> {cs ? `${AVATAR_COUNT_CORE + AVATAR_COUNT_EXTENDED} avatarů aktivních` : `${AVATAR_COUNT_CORE + AVATAR_COUNT_EXTENDED} avatars active`}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-zion-gold/30 bg-zion-gold/10 px-4 py-2 text-amber-200">
                <Gem className="h-3 w-3" /> {cs ? `${GOLDEN_EGG_PRIZE} ZION prize` : `${GOLDEN_EGG_PRIZE} ZION prize`}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                <Clock className="h-3 w-3" /> {cs ? 'UE5 integrace 2028–2029' : 'UE5 integration 2028–2029'}
              </span>
            </div>
          </div>
        </motion.section>

        {/* ── AVATAR SYSTEM ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-[32px] border border-white/10 bg-black/40 p-8"
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Živý systém' : 'Live System'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Star className="h-7 w-7 text-orange-400" />
              {cs ? 'Avatar systém — Active' : 'Avatar System — Active'}
            </h2>
            <p className="text-sm text-gray-400">
              {cs ? '51 core + 151 extended avatarů. Každý má 5 questů. REST API endpointy /avatars a /quests jsou aktivní.' : '51 core + 151 extended avatars. Each has 5 quests. REST API endpoints /avatars and /quests are active.'}
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            {avatarTypes.map((a) => (
              <div key={a.name} className={`rounded-2xl border p-5 ${a.color}`}>
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
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-gray-400 font-mono">
            <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">API</p>
            GET /avatars · GET /quests · POST /quests/complete · GET /avatars/&#123;id&#125;/stats
          </div>
        </motion.section>

        {/* ── GOLDEN EGG ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-[32px] border border-zion-gold/30 bg-gradient-to-br from-zion-gold/10 via-black/40 to-orange-500/10 p-8"
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Poklad' : 'Treasure'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Trophy className="h-7 w-7 text-zion-gold" />
              {cs ? 'Golden Egg — 108 stop, 8.25B ZION' : 'Golden Egg — 108 Clues, 8.25B ZION'}
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {goldenEgg.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-white/10 bg-black/30 p-4 text-center">
                <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">{stat.label}</p>
                <p className={`text-xl md:text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-300 leading-relaxed">
            {cs
              ? 'Golden Egg je masivní pokladová honba napříč celým ZION ekosystémem. 108 kryptických stop je ukryto v blockchainu, smart kontraktech, knihách TerraNova a fyzických lokacích. Vítěz získá 8,25 miliardy ZION — 50,7 % genesis reserve. Start plánován na 2027.'
              : 'Golden Egg is a massive treasure hunt across the entire ZION ecosystem. 108 cryptic clues are hidden in the blockchain, smart contracts, TerraNova books, and physical locations. The winner receives 8.25 billion ZION — 50.7% of the genesis reserve. Launch planned for 2027.'}
          </p>
        </motion.section>

        {/* ── PROTOCOLS ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-[32px] border border-white/10 bg-white/5 p-8"
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Baseline protokoly' : 'Baseline Protocols'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Shield className="h-7 w-7 text-cyan-400" />
              {cs ? 'Oasis Game Protocols' : 'Oasis Game Protocols'}
            </h2>
            <p className="text-sm text-gray-400">
              {cs ? 'Základní herní protokoly pro interoperabilitu napříč ZION Oasis ekosystémem.' : 'Core game protocols for interoperability across the ZION Oasis ecosystem.'}
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {protocols.map((p) => (
              <div key={p.title} className="rounded-2xl border border-white/10 bg-black/30 p-5">
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
          className="rounded-[32px] border border-white/10 bg-black/40 p-8"
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Vize' : 'Vision'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Palette className="h-7 w-7 text-yellow-400" />
              {cs ? 'Klíčové pilíře Oasis' : 'Oasis Key Pillars'}
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl border border-white/10 bg-black/30 p-5">
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
          className="rounded-[32px] border border-white/10 bg-black/40 p-8"
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Vývojová cesta' : 'Development Path'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Clock className="h-7 w-7 text-emerald-400" />
              {cs ? 'Roadmap L4 Oasis' : 'L4 Oasis Roadmap'}
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {roadmap.map((phase) => (
              <div key={phase.phase} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-lg font-bold text-white">{phase.phase}</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                    phase.status === 'planned'
                      ? 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20'
                      : 'bg-purple-500/10 text-purple-300 border-purple-500/20'
                  }`}>
                    {phase.period}
                  </span>
                </div>
                <ul className="space-y-3">
                  {phase.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-gray-400">
                      {phase.status === 'planned' ? (
                        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" />
                      ) : (
                        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-purple-400" />
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
          className="rounded-[32px] border border-orange-500/30 bg-gradient-to-r from-orange-500/10 via-transparent to-amber-500/10 p-10"
        >
          <h2 className="text-2xl font-semibold text-white text-center mb-6">
            {cs ? 'Více o L4 a ekosystému' : 'Learn more about L4 and the ecosystem'}
          </h2>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/l3-hiran" className="inline-flex items-center gap-2 rounded-2xl border border-purple-500/30 bg-purple-500/5 px-6 py-3 text-sm font-semibold text-purple-200 hover:bg-purple-500/10 transition-colors">
              <Sparkles className="h-4 w-4" /> L3 Hiran
            </Link>
            <Link href="/l5-free-world" className="inline-flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/5 px-6 py-3 text-sm font-semibold text-amber-200 hover:bg-amber-500/10 transition-colors">
              L5 Free World <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/terranova" className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors">
              <BookOpen className="h-4 w-4" /> TerraNova Book
            </Link>
          </div>
        </motion.section>

      </div>
    </div>
  );
}
