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
    title: tr('l4Oasis', 'ue5_metaverse', lang),
    desc: cs
      ? 'Unreal Engine 5 svět postavený na ZION — photorealistické prostředí, persistentní stav, on-chain inventory.'
      : 'Unreal Engine 5 world built on ZION — photorealistic environments, persistent state, on-chain inventory.',
    icon: Palette,
    color: 'text-orange-400',
    active: false,
  },
  {
    title: tr('l4Oasis', 'xp_economy', lang),
    desc: cs
      ? 'Herní XP se převádí na ZION tokeny — skill-based mining, quest rewards, guild treasury.'
      : 'Game XP converts to ZION tokens — skill-based mining, quest rewards, guild treasury.',
    icon: Gem,
    color: 'text-yellow-400',
    active: false,
  },
  {
    title: tr('l4Oasis', 'on_chain_inventory', lang),
    desc: cs
      ? 'Všechny herní předměty jsou NFT na ZION L1 — skutečné vlastnictví, obchodování na marketplace.'
      : 'All game items are NFTs on ZION L1 — true ownership, trading on marketplace.',
    icon: Cpu,
    color: 'text-cyan-400',
    active: false,
  },
  {
    title: tr('l4Oasis', 'guild_dao', lang),
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
    name: tr('l4Oasis', 'core_avatars', lang),
    count: `${AVATAR_COUNT_CORE}`,
    desc: tr('l4Oasis', '51_unique_core_avatars_with_full_animation_an', lang),
    icon: Star,
    color: 'border-orange-500/30 bg-orange-500/5',
    badge: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
  },
  {
    name: tr('l4Oasis', 'extended_avatars', lang),
    count: `${AVATAR_COUNT_EXTENDED}`,
    desc: tr('l4Oasis', '151_extended_avatars_with_unique_traits_and_b', lang),
    icon: Sparkles,
    color: 'border-purple-500/30 bg-purple-500/5',
    badge: 'border-purple-500/30 bg-purple-500/10 text-purple-300',
  },
  {
    name: tr('l4Oasis', 'quest_engine', lang),
    count: '5',
    desc: tr('l4Oasis', '5_quests_per_avatar_pve_exploration_crafting_', lang),
    icon: Swords,
    color: 'border-cyan-500/30 bg-cyan-500/5',
    badge: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  },
];

const getGoldenEgg = (cs: boolean) => [
  { label: tr('l4Oasis', 'total_prize_pool', lang), value: `${GOLDEN_EGG_PRIZE} ZION`, color: 'text-zion-gold' },
  { label: tr('l4Oasis', 'clues', lang), value: `${GOLDEN_EGG_CLUES}`, color: 'text-orange-400' },
  { label: tr('l4Oasis', 'estimated_start', lang), value: '2027', color: 'text-cyan-400' },
  { label: tr('l4Oasis', 'type', lang), value: tr('l4Oasis', 'global_treasure_hunt', lang), color: 'text-purple-400' },
];

const getRoadmap = (cs: boolean) => [
  {
    phase: tr('l4Oasis', 'alpha', lang),
    period: '2027 Q3',
    status: 'planned',
    items: cs
      ? ['Základní UE5 svět', 'On-chain avatars', 'XP systém', 'Testovací síť']
      : ['Basic UE5 world', 'On-chain avatars', 'XP system', 'Test network'],
  },
  {
    phase: tr('l4Oasis', 'beta', lang),
    period: '2028 Q2',
    status: 'planned',
    items: cs
      ? ['NFT inventory', 'Guild systém', 'PvE questy', 'ZION marketplace integrace']
      : ['NFT inventory', 'Guild system', 'PvE quests', 'ZION marketplace integration'],
  },
  {
    phase: tr('l4Oasis', 'live', lang),
    period: '2028 Q4',
    status: 'vision',
    items: cs
      ? ['Full economy', 'Cross-guild warfare', 'Land ownership', 'VR/AR podpora']
      : ['Full economy', 'Cross-guild warfare', 'Land ownership', 'VR/AR support'],
  },
];

const getProtocols = (cs: boolean) => [
  {
    title: tr('l4Oasis', 'avatar_minting', lang),
    desc: tr('l4Oasis', 'every_avatar_is_an_nft_on_zion_l1_erc_721_com', lang),
    icon: Star,
    color: 'text-orange-400',
  },
  {
    title: tr('l4Oasis', 'quest_engine_1', lang),
    desc: tr('l4Oasis', '5_quests_per_avatar_generative_content_scorin', lang),
    icon: Swords,
    color: 'text-cyan-400',
  },
  {
    title: tr('l4Oasis', 'nft_inventory', lang),
    desc: tr('l4Oasis', 'items_weapons_armor_all_as_nfts_with_utxo_bac', lang),
    icon: Shield,
    color: 'text-emerald-400',
  },
  {
    title: tr('l4Oasis', 'guild_treasury', lang),
    desc: tr('l4Oasis', 'guilds_as_sub_daos_on_chain_treasury_vote_wei', lang),
    icon: Coins,
    color: 'text-purple-400',
  },
  {
    title: tr('l4Oasis', 'territory_claims', lang),
    desc: tr('l4Oasis', 'digital_territories_on_zion_map_l1_record_gui', lang),
    icon: MapPin,
    color: 'text-amber-400',
  },
  {
    title: tr('l4Oasis', 'xp_zion_bridge', lang),
    desc: tr('l4Oasis', 'xp_from_quests_convertible_to_zion_tokens_non', lang),
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
                {tr('l4Oasis', 'game_layer_of_the_zion_ecosystem', lang)}
              </p>
              <h1 className="text-3xl sm:text-5xl font-semibold text-gradient leading-tight">
                {tr('l4Oasis', 'zion_oasis_l4', lang)}
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
                <Clock className="h-3 w-3" /> {tr('l4Oasis', 'ue5_integration_2028_2029', lang)}
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
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tr('l4Oasis', 'live_system', lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Star className="h-7 w-7 text-orange-400" />
              {tr('l4Oasis', 'avatar_system_active', lang)}
            </h2>
            <p className="text-sm text-gray-400">
              {tr('l4Oasis', '51_core_151_extended_avatars_each_has_5_quest', lang)}
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
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tr('l4Oasis', 'treasure', lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Trophy className="h-7 w-7 text-zion-gold" />
              {tr('l4Oasis', 'golden_egg_108_clues_8_25b_zion', lang)}
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
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tr('l4Oasis', 'baseline_protocols', lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Shield className="h-7 w-7 text-cyan-400" />
              {tr('l4Oasis', 'oasis_game_protocols', lang)}
            </h2>
            <p className="text-sm text-gray-400">
              {tr('l4Oasis', 'core_game_protocols_for_interoperability_acro', lang)}
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
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tr('l4Oasis', 'vision', lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Palette className="h-7 w-7 text-yellow-400" />
              {tr('l4Oasis', 'oasis_key_pillars', lang)}
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
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tr('l4Oasis', 'development_path', lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Clock className="h-7 w-7 text-emerald-400" />
              {tr('l4Oasis', 'l4_oasis_roadmap', lang)}
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
            {tr('l4Oasis', 'learn_more_about_l4_and_the_ecosystem', lang)}
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
