'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Gamepad2, Gem, Users, Zap, Sparkles, ArrowRight,
  Clock, Cpu, BookOpen,
  Layers, Swords, Trophy, MapPin, Shield, Star, Coins,
  Rocket, Globe2, Wifi, WifiOff, KeyRound, Orbit,
  Bot, Compass, Atom, Dna, Infinity as InfinityIcon,
  MonitorPlay, MousePointerClick
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

const OASIS_URL = 'https://oasis.zionterranova.com';

const L4OasisCopy = {
  gameLayerOfTheZionEcosystem: { cs: `Herní vrstva ZION ekosystému`, en: `Game layer of the ZION ecosystem` },
  zionOasisL4: { cs: `ZION Oasis — L4`, en: `ZION Oasis — L4` },
  oasisTagline: { cs: `Multivesmír, kde se hra stává iniciací.`, en: `A multiverse where play becomes initiation.` },
  heroDesc: { cs: `OASIS je persistentní online multivesmír postavený na ZION blockchainu — živá spirální galaxie s 400+ světy, 200 avatary s vlastními quest liniemi, loděmi, gildami a teritorii. V jádru všeho stojí honba za Zlatým vejcem: 108 kryptických stop napříč dimenzemi vede k hlavní ceně 1 miliarda ZION. Herní klient běží živě na oasis.zionterranova.com.`, en: `OASIS is a persistent online multiverse built on the ZION blockchain — a living spiral galaxy with 400+ worlds, 200 avatars with their own quest lines, ships, guilds, and territories. At its core lies the Golden Egg hunt: 108 cryptic clues across dimensions leading to a 1 billion ZION grand prize. The game client is live at oasis.zionterranova.com.` },
  oasisApi: { cs: `OASIS API`, en: `OASIS API` },
  webClient: { cs: `Web client`, en: `Web client` },
  checking: { cs: `kontrola…`, en: `checking…` },
  online: { cs: `online`, en: `online` },
  offline: { cs: `offline`, en: `offline` },
  enterOasis: { cs: `Vstoupit do OASIS`, en: `Enter OASIS` },

  liveClient: { cs: `Živý herní klient`, en: `Live Game Client` },
  oasisWebLive: { cs: `OASIS Web — Live`, en: `OASIS Web — Live` },
  liveClientDesc: { cs: `3D herní klient běží právě teď — spirálová galaxie s 30 000 částicemi, procedurální Strom života v centru, 8 herních zón a lodnice s 12 loděmi. Žádný download — otevřeš v prohlížeči.`, en: `The 3D game client is running right now — a spiral galaxy of 30,000 particles, a procedural Tree of Life at its center, 8 game zones and a hangar with 12 ships. No download — opens in your browser.` },
  zoneDashboard: { cs: `Dashboard`, en: `Dashboard` },
  zoneAvatars: { cs: `Avatáři`, en: `Avatars` },
  zoneQuests: { cs: `Questy`, en: `Quests` },
  zoneLeaderboard: { cs: `Žebříček`, en: `Leaderboard` },
  zoneTerritories: { cs: `Teritoria`, en: `Territories` },
  zoneGuilds: { cs: `Guildy`, en: `Guilds` },
  zoneGoldenEgg: { cs: `Zlaté vejce`, en: `Golden Egg` },
  zoneHangar: { cs: `Hangár`, en: `Hangar` },
  pilgrimRite: { cs: `Pilgrim Rite — onboarding`, en: `Pilgrim Rite — Onboarding` },
  pilgrimRiteDesc: { cs: `Vstup do OASIS je rituál: warp intro → setkání s průvodcem → volba modré nebo červené pilulky → customizace avatara (callsign, tělo, augmentace) → volba archetypu (warrior, trader, explorer, sage).`, en: `Entering OASIS is a rite: warp intro → meeting the guide → blue or red pill choice → avatar customization (callsign, body, augmentations) → archetype selection (warrior, trader, explorer, sage).` },
  redPill: { cs: `Červená pilulka — vstoupit do skutečného OASIS`, en: `Red pill — enter the real OASIS` },
  bluePill: { cs: `Modrá pilulka — zůstat v iluzi`, en: `Blue pill — stay in the illusion` },

  multiverse: { cs: `Multivesmír`, en: `Multiverse` },
  fiveLayersOfReality: { cs: `5 vrstev reality`, en: `5 Layers of Reality` },
  multiverseDesc: { cs: `OASIS není jedna planeta — je to stack pěti vrstev, mezi kterými se cestuje branami, loděmi i vědomím.`, en: `OASIS is not a single planet — it is a stack of five layers, travelled via gates, ships, and consciousness itself.` },
  layer1Title: { cs: `Vrstva 1 — Fyzická galaxie`, en: `Layer 1 — Physical Galaxy` },
  layer1Desc: { cs: `Hvězdné systémy, planety, letové vzdálenosti — Sirius, Alpha Centauri, Orion, Plejády, Arcturus.`, en: `Star systems, planets, flight distances — Sirius, Alpha Centauri, Orion, Pleiades, Arcturus.` },
  layer2Title: { cs: `Vrstva 2 — Paralelní dimenze`, en: `Layer 2 — Parallel Dimensions` },
  layer2Desc: { cs: `Alternativní verze týchž míst — kvantové větvení, Matrix vrstva.`, en: `Alternate versions of the same places — quantum branching, the Matrix layer.` },
  layer3Title: { cs: `Vrstva 3 — Časové linie`, en: `Layer 3 — Timelines` },
  layer3Desc: { cs: `Minulost a budoucnost — historické epochy, kolapsy i zlaté věky.`, en: `Past and future — historical epochs, collapses, and golden ages.` },
  layer4Title: { cs: `Vrstva 4 — Mýtické roviny`, en: `Layer 4 — Mythic Planes` },
  layer4Desc: { cs: `Podsvětí, nebe, akashické záznamy, avatárské sféry.`, en: `Underworlds, heavens, akashic records, avataric spheres.` },
  layer5Title: { cs: `Vrstva 5 — Hráčská tvorba`, en: `Layer 5 — Player Creation` },
  layer5Desc: { cs: `Vlastní dimenze, gildovní světy, modované planety — svět tvoří hráči.`, en: `Custom dimensions, guild worlds, modded planets — the world is built by players.` },
  worldRegistry: { cs: `Registr světů`, en: `World Registry` },
  starSystems: { cs: `hvězdných systémů`, en: `star systems` },
  planets: { cs: `planet`, en: `planets` },
  sectors: { cs: `sektorů`, en: `sectors` },
  worldsCount: { cs: `světů`, en: `worlds` },
  dimensions: { cs: `dimenzí`, en: `dimensions` },
  worldsRegistryDesc: { cs: `Každý svět je herní instance s vlastními pravidly, žánrem a vibe — od 8-bit Atari planet po kyberpunkové megacity, od starověkého Egypta po space operu.`, en: `Every world is a game instance with its own rules, genre, and vibe — from 8-bit Atari planets to cyberpunk megacities, from ancient Egypt to space opera.` },

  liveSystem: { cs: `Živý systém`, en: `Live System` },
  avatarSystemActive: { cs: `Avatar systém — Active`, en: `Avatar System — Active` },
  avatarSystemDesc: { cs: `200 avatarů s vlastní quest linií, výukou a schopnostmi. Každý avatar je NFT na ZION L1 — skutečné vlastnictví, on-chain metadata.`, en: `200 avatars with their own quest line, teaching, and abilities. Every avatar is an NFT on ZION L1 — true ownership, on-chain metadata.` },
  rarityRare: { cs: `Rare`, en: `Rare` },
  rarityEpic: { cs: `Epic`, en: `Epic` },
  rarityLegendary: { cs: `Legendary`, en: `Legendary` },
  rarityOneOfOne: { cs: `One of One`, en: `One of One` },
  avatarQuestsNote: { cs: `Quest linie pro každého avatara — PvE, exploration, crafting, social. Odměny v XP a ZION.`, en: `A quest line for every avatar — PvE, exploration, crafting, social. Rewards in XP and ZION.` },
  krishnaNote: { cs: `Krishna-Maitreya — „Integration of All Paths" — jediný One-of-One avatar, Final Boss a průvodce v skryté EKAM dimenzi. Vyžaduje CL9.`, en: `Krishna-Maitreya — "Integration of All Paths" — the only One-of-One avatar, Final Boss and guide in the hidden EKAM dimension. Requires CL9.` },

  treasure: { cs: `Poklad`, en: `Treasure` },
  goldenEggTitle: { cs: `Golden Egg — honba za Zlatým vejcem`, en: `Golden Egg — The Hunt for the Golden Egg` },
  goldenEggDesc: { cs: `Golden Egg je celosvětová honba za pokladem napříč celým ZION ekosystémem — 108 kryptických stop ukrytých v blockchainu, světech, knihách TerraNova i fyzických lokacích. Není to jen běh: je to iniciace. Vejce samo je metafora Hiranyagarbhy — kosmického zárodku a stavu vědomí.`, en: `The Golden Egg is a worldwide treasure hunt across the entire ZION ecosystem — 108 cryptic clues hidden in the blockchain, worlds, TerraNova books, and physical locations. It is not just a race: it is an initiation. The Egg itself is the metaphor of Hiranyagarbha — the cosmic seed and a state of consciousness.` },
  grandPrize: { cs: `Hlavní cena`, en: `Grand Prize` },
  totalPrizePool: { cs: `Celkem v tierach`, en: `Total Prize Tiers` },
  clues: { cs: `Stopy`, en: `Clues` },
  masterKeys: { cs: `Master Keys`, en: `Master Keys` },
  threePaths: { cs: `Tři stezky stop`, en: `Three Clue Paths` },
  ramayanaPath: { cs: `Ramayana — Dharma Path`, en: `Ramayana — Dharma Path` },
  mahabharataPath: { cs: `Mahabharata — Karma Path`, en: `Mahabharata — Karma Path` },
  unityPath: { cs: `Unity — Moksha Path`, en: `Unity — Moksha Path` },
  ramayanaDesc: { cs: `30 stop · Master Key od CL4`, en: `30 clues · Master Key from CL4` },
  mahabharataDesc: { cs: `35 stop · Master Key od CL6`, en: `35 clues · Master Key from CL6` },
  unityDesc: { cs: `43 stop · vyžaduje oba předchozí klíče`, en: `43 clues · requires both previous keys` },
  finalUnlock: { cs: `Finální odemčení: všechny 3 Master Keys + CL9 + schválení DAO (67 %).`, en: `Final unlock: all 3 Master Keys + CL9 + DAO approval (67%).` },
  prizeTiersTitle: { cs: `Prize tiers`, en: `Prize Tiers` },
  tierRank: { cs: `Tier`, en: `Tier` },
  tierTitle: { cs: `Titul`, en: `Title` },
  tierPrize: { cs: `Cena`, en: `Prize` },
  tierUnlock: { cs: `Odemčení`, en: `Unlock` },

  consciousness: { cs: `Vědomí`, en: `Consciousness` },
  nineLevels: { cs: `9 úrovní vědomí`, en: `9 Consciousness Levels` },
  consciousnessDesc: { cs: `Postup hráče je mapován na Strom života — každá úroveň odemyká nové herní funkce, násobiče odměn a přístup k vyšším stopám. XP získáváš za questy, průzkum, scan světů a objevy.`, en: `Player progression maps onto the Tree of Life — each level unlocks new game features, reward multipliers, and access to higher clues. XP is earned through quests, exploration, world scans, and discoveries.` },
  clName: { cs: `Úroveň`, en: `Level` },
  clXp: { cs: `XP práh`, en: `XP Threshold` },
  clMultiplier: { cs: `Multiplikátor`, en: `Multiplier` },
  clBonus: { cs: `Level-up bonus`, en: `Level-up Bonus` },

  rewards: { cs: `Odměny`, en: `Rewards` },
  oasisPool: { cs: `OASIS Reward Pool`, en: `OASIS Reward Pool` },
  oasisPoolDesc: { cs: `4.95 miliardy ZION vyhrazené pro herní ekonomiku — rozdělené do tří slotů po 33 %.`, en: `4.95 billion ZION reserved for the game economy — split into three 33% slots.` },
  poolMining: { cs: `Mining Rewards`, en: `Mining Rewards` },
  poolMiningDesc: { cs: `1.65B ZION — odměny za herní těžební aktivity a skill-based mining.`, en: `1.65B ZION — rewards for in-game mining activity and skill-based mining.` },
  poolChallenges: { cs: `Challenge Rewards`, en: `Challenge Rewards` },
  poolChallengesDesc: { cs: `1.65B ZION — questy, výzvy, eventy, leaderboardy, raid odměny.`, en: `1.65B ZION — quests, challenges, events, leaderboards, raid rewards.` },
  poolGuildTerritory: { cs: `Guild & Territory`, en: `Guild & Territory` },
  poolGuildTerritoryDesc: { cs: `1.65B ZION — gildovní treasury, territory claims, kontrola sektorů.`, en: `1.65B ZION — guild treasuries, territory claims, sector control.` },

  aiBridge: { cs: `AI bridge`, en: `AI Bridge` },
  hiranInsideOasis: { cs: `Hiranyagarbha uvnitř OASIS`, en: `Hiranyagarbha inside OASIS` },
  aiBridgeDesc: { cs: `L4 není izolovaná hra — OASIS má přímý most do L3. AI Native generuje quest narrativy, vede NPC dialogy a vyhodnocuje consciousness level hráčů.`, en: `L4 is not an isolated game — OASIS has a direct bridge into L3. AI Native generates quest narratives, drives NPC dialogue, and evaluates player consciousness levels.` },
  aiQuestNarrative: { cs: `AI Quest Narratives`, en: `AI Quest Narratives` },
  aiQuestNarrativeDesc: { cs: `Generativní quest příběhy šité na míru avatarovi a jeho úrovni.`, en: `Generative quest stories tailored to the avatar and its level.` },
  aiNpcDialogue: { cs: `AI NPC Dialogue`, en: `AI NPC Dialogue` },
  aiNpcDialogueDesc: { cs: `Živé dialogy postav poháněné Hiranem — kontext světa, questu i hráče.`, en: `Living character dialogue powered by Hiran — aware of world, quest, and player context.` },
  aiConsciousnessEval: { cs: `Consciousness Eval`, en: `Consciousness Eval` },
  aiConsciousnessEvalDesc: { cs: `AI vyhodnocení připravenosti hráče na vyšší úroveň vědomí.`, en: `AI evaluation of a player's readiness for a higher consciousness level.` },

  baselineProtocols: { cs: `Baseline protokoly`, en: `Baseline Protocols` },
  oasisGameProtocols: { cs: `Oasis Game Protocols`, en: `Oasis Game Protocols` },
  coreGameProtocolsForInteropera: { cs: `Základní herní protokoly pro interoperabilitu napříč ZION Oasis ekosystémem.`, en: `Core game protocols for interoperability across the ZION Oasis ecosystem.` },
  avatarMinting: { cs: `Avatar Minting`, en: `Avatar Minting` },
  everyAvatarIsAnNftOnZionL1Erc7: { cs: `Každý avatar je NFT na ZION L1 — on-chain metadata a skutečné vlastnictví.`, en: `Every avatar is an NFT on ZION L1 — on-chain metadata and true ownership.` },
  questEngine_2: { cs: `Quest Engine`, en: `Quest Engine` },
  questEngineDesc2: { cs: `Quest linie na avatara — generativní obsah, skóre, odměny v ZION.`, en: `Quest lines per avatar — generative content, scoring, ZION rewards.` },
  nftInventory: { cs: `NFT Inventory`, en: `NFT Inventory` },
  itemsWeaponsArmorAllAsNftsWith: { cs: `Itemy, lodě, vybavení — vše jako NFT s UTXO-backed ownership.`, en: `Items, ships, equipment — all as NFTs with UTXO-backed ownership.` },
  guildTreasury: { cs: `Guild Treasury`, en: `Guild Treasury` },
  guildsAsSubDaosOnChainTreasury: { cs: `Guildy jako sub-DAO — on-chain treasury, vote-weighted governance.`, en: `Guilds as sub-DAOs — on-chain treasury, vote-weighted governance.` },
  territoryClaims: { cs: `Territory Claims`, en: `Territory Claims` },
  digitalTerritoriesOnZionMapL1R: { cs: `Digitální teritoria na mapě OASIS — L1 záznam, guild ownership.`, en: `Digital territories on the OASIS map — L1 record, guild ownership.` },
  xpZionBridge: { cs: `XP → ZION Bridge`, en: `XP → ZION Bridge` },
  xpFromQuestsConvertibleToZionT: { cs: `XP z questů konvertovatelný na ZION tokeny — non-consensus ekonomika.`, en: `XP from quests convertible to ZION tokens — non-consensus economy.` },

  developmentPath: { cs: `Vývojová cesta`, en: `Development Path` },
  l4OasisRoadmap: { cs: `Roadmap L4 Oasis`, en: `L4 Oasis Roadmap` },
  alpha: { cs: `Alpha`, en: `Alpha` },
  beta: { cs: `Beta`, en: `Beta` },
  live: { cs: `Live`, en: `Live` },
  learnMoreAboutL4AndTheEcosyste: { cs: `Více o L4 a ekosystému`, en: `Learn more about L4 and the ecosystem` },
  shipsNote: { cs: `12 lodí ve webovém hangáru — od Pilgrim Scoutu po Star Destroyer. Odemykají se levelem a ZION kredity.`, en: `12 ships in the web hangar — from the Pilgrim Scout to a Star Destroyer-class capital. Unlocked by level and ZION credits.` },
  hiranKeysNote: { cs: `108 Hiranyagarbha klíčů je skryto napříč multivesmírem — v lodích, na planetách, v dimenzích. Klíč #1 už je ve hře.`, en: `108 Hiranyagarbha keys are hidden across the multiverse — in ships, on planets, in dimensions. Key #1 is already in the game.` },
};

type OasisStatus = 'checking' | 'online' | 'offline';

const WORLD_STATS = {
  total: '400+',
  starSystems: 56,
  planets: 54,
  sectors: 13,
  worlds: 58,
  dimensions: 226,
};

const AVATAR_COUNT = 200;
const AVATAR_RARITY = [
  { key: 'rarityRare' as const, count: 128, color: 'text-zion-cyan', badge: 'border-zion-cyan/30 bg-zion-cyan/10 text-zion-cyan' },
  { key: 'rarityEpic' as const, count: 47, color: 'text-zion-purple', badge: 'border-zion-purple/30 bg-zion-purple/10 text-zion-purple' },
  { key: 'rarityLegendary' as const, count: 24, color: 'text-zion-gold', badge: 'border-zion-gold/30 bg-zion-gold/10 text-zion-gold' },
  { key: 'rarityOneOfOne' as const, count: 1, color: 'text-white', badge: 'border-white/30 bg-white/10 text-white' },
];

const CLUE_PATHS = [
  { key: 'ramayanaPath' as const, descKey: 'ramayanaDesc' as const, clues: 30, color: 'text-zion-gold', rc: '255, 215, 0' },
  { key: 'mahabharataPath' as const, descKey: 'mahabharataDesc' as const, clues: 35, color: 'text-zion-cyan', rc: '6, 182, 212' },
  { key: 'unityPath' as const, descKey: 'unityDesc' as const, clues: 43, color: 'text-zion-purple', rc: '147, 51, 234' },
];

const PRIZE_TIERS = [
  { rank: 1, title: 'Hiranyagarbha Sovereign', prize: '1,000,000,000', unlock: '3 Keys + CL9 + DAO 67%' },
  { rank: 2, title: 'Cosmic Guardian', prize: '500,000,000', unlock: '2 Keys + CL8 + Top 2' },
  { rank: 3, title: 'Divine Strategist', prize: '250,000,000', unlock: '2 Keys + CL7 + Top 3' },
  { rank: 4, title: 'Star Mystic', prize: '100,000,000', unlock: '1 Key + CL6 + Top 10' },
  { rank: 5, title: 'Ascended Sage', prize: '50,000,000', unlock: '1 Key + CL5 + Top 20' },
  { rank: 6, title: 'Spiritual Warrior', prize: '25,000,000', unlock: 'CL4 + Top 50' },
  { rank: 7, title: 'Intuitional Seeker', prize: '10,000,000', unlock: 'CL3 + Top 100' },
  { rank: 8, title: 'Mental Adept', prize: '5,000,000', unlock: 'CL2 + Top 500' },
  { rank: 9, title: 'Emotional Healer', prize: '1,000,000', unlock: 'CL1 + Top 1000' },
  { rank: 10, title: 'Physical Initiate', prize: '100,000', unlock: 'CL1 + Participation' },
];

const CONSCIOUSNESS_LEVELS = [
  { name: 'Physical', xp: '0', mult: '1.0×', bonus: '—' },
  { name: 'Emotional', xp: '1,000', mult: '1.2×', bonus: '100' },
  { name: 'Mental', xp: '5,000', mult: '1.5×', bonus: '500' },
  { name: 'Intuitional', xp: '15,000', mult: '2.0×', bonus: '2,000' },
  { name: 'Spiritual', xp: '50,000', mult: '3.0×', bonus: '10,000' },
  { name: 'Cosmic', xp: '150,000', mult: '5.0×', bonus: '50,000' },
  { name: 'Divine', xp: '500,000', mult: '8.0×', bonus: '200,000' },
  { name: 'Unity', xp: '2,000,000', mult: '12.0×', bonus: '1,000,000' },
  { name: 'On The Star', xp: '10,000,000', mult: '15.0×', bonus: '5,000,000' },
];

const getMultiverseLayers = (cs: boolean) => [
  { title: L4OasisCopy.layer1Title[cs ? 'cs' : 'en'], desc: L4OasisCopy.layer1Desc[cs ? 'cs' : 'en'], icon: Orbit, color: 'text-zion-cyan' },
  { title: L4OasisCopy.layer2Title[cs ? 'cs' : 'en'], desc: L4OasisCopy.layer2Desc[cs ? 'cs' : 'en'], icon: Layers, color: 'text-zion-purple' },
  { title: L4OasisCopy.layer3Title[cs ? 'cs' : 'en'], desc: L4OasisCopy.layer3Desc[cs ? 'cs' : 'en'], icon: Clock, color: 'text-zion-gold' },
  { title: L4OasisCopy.layer4Title[cs ? 'cs' : 'en'], desc: L4OasisCopy.layer4Desc[cs ? 'cs' : 'en'], icon: Dna, color: 'text-zion-cyan' },
  { title: L4OasisCopy.layer5Title[cs ? 'cs' : 'en'], desc: L4OasisCopy.layer5Desc[cs ? 'cs' : 'en'], icon: InfinityIcon, color: 'text-zion-purple' },
];

const getZones = (cs: boolean) => [
  { name: L4OasisCopy.zoneDashboard[cs ? 'cs' : 'en'], icon: Compass },
  { name: L4OasisCopy.zoneAvatars[cs ? 'cs' : 'en'], icon: Star },
  { name: L4OasisCopy.zoneQuests[cs ? 'cs' : 'en'], icon: Swords },
  { name: L4OasisCopy.zoneLeaderboard[cs ? 'cs' : 'en'], icon: Trophy },
  { name: L4OasisCopy.zoneTerritories[cs ? 'cs' : 'en'], icon: MapPin },
  { name: L4OasisCopy.zoneGuilds[cs ? 'cs' : 'en'], icon: Users },
  { name: L4OasisCopy.zoneGoldenEgg[cs ? 'cs' : 'en'], icon: Gem },
  { name: L4OasisCopy.zoneHangar[cs ? 'cs' : 'en'], icon: Rocket },
];

const getAiBridge = (cs: boolean) => [
  { title: L4OasisCopy.aiQuestNarrative[cs ? 'cs' : 'en'], desc: L4OasisCopy.aiQuestNarrativeDesc[cs ? 'cs' : 'en'], icon: BookOpen, color: 'text-zion-cyan' },
  { title: L4OasisCopy.aiNpcDialogue[cs ? 'cs' : 'en'], desc: L4OasisCopy.aiNpcDialogueDesc[cs ? 'cs' : 'en'], icon: Bot, color: 'text-zion-purple' },
  { title: L4OasisCopy.aiConsciousnessEval[cs ? 'cs' : 'en'], desc: L4OasisCopy.aiConsciousnessEvalDesc[cs ? 'cs' : 'en'], icon: Sparkles, color: 'text-zion-gold' },
];

const getProtocols = (cs: boolean) => [
  { title: L4OasisCopy.avatarMinting[cs ? 'cs' : 'en'], desc: L4OasisCopy.everyAvatarIsAnNftOnZionL1Erc7[cs ? 'cs' : 'en'], icon: Star, color: 'text-zion-gold' },
  { title: L4OasisCopy.questEngine_2[cs ? 'cs' : 'en'], desc: L4OasisCopy.questEngineDesc2[cs ? 'cs' : 'en'], icon: Swords, color: 'text-zion-cyan' },
  { title: L4OasisCopy.nftInventory[cs ? 'cs' : 'en'], desc: L4OasisCopy.itemsWeaponsArmorAllAsNftsWith[cs ? 'cs' : 'en'], icon: Shield, color: 'text-zion-cyan' },
  { title: L4OasisCopy.guildTreasury[cs ? 'cs' : 'en'], desc: L4OasisCopy.guildsAsSubDaosOnChainTreasury[cs ? 'cs' : 'en'], icon: Coins, color: 'text-zion-purple' },
  { title: L4OasisCopy.territoryClaims[cs ? 'cs' : 'en'], desc: L4OasisCopy.digitalTerritoriesOnZionMapL1R[cs ? 'cs' : 'en'], icon: MapPin, color: 'text-zion-gold' },
  { title: L4OasisCopy.xpZionBridge[cs ? 'cs' : 'en'], desc: L4OasisCopy.xpFromQuestsConvertibleToZionT[cs ? 'cs' : 'en'], icon: Zap, color: 'text-zion-gold' },
];

const getPools = (cs: boolean) => [
  { title: L4OasisCopy.poolMining[cs ? 'cs' : 'en'], desc: L4OasisCopy.poolMiningDesc[cs ? 'cs' : 'en'], icon: Cpu, color: 'text-zion-cyan' },
  { title: L4OasisCopy.poolChallenges[cs ? 'cs' : 'en'], desc: L4OasisCopy.poolChallengesDesc[cs ? 'cs' : 'en'], icon: Swords, color: 'text-zion-gold' },
  { title: L4OasisCopy.poolGuildTerritory[cs ? 'cs' : 'en'], desc: L4OasisCopy.poolGuildTerritoryDesc[cs ? 'cs' : 'en'], icon: Users, color: 'text-zion-purple' },
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

export default function L4OasisPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const multiverseLayers = getMultiverseLayers(cs);
  const zones = getZones(cs);
  const aiBridge = getAiBridge(cs);
  const protocols = getProtocols(cs);
  const pools = getPools(cs);
  const roadmap = getRoadmap(cs);

  const [oasisStatus, setOasisStatus] = useState<OasisStatus>('checking');

  useEffect(() => {
    async function checkStatus() {
      try {
        const r = await fetch('/api/oasis/status', { cache: 'no-store' });
        const d = await r.json().catch(() => ({}));
        setOasisStatus(r.ok && d.available === true ? 'online' : 'offline');
      } catch {
        setOasisStatus('offline');
      }
    }
    checkStatus();
    const id = setInterval(checkStatus, 30000);
    return () => clearInterval(id);
  }, []);

  const statusPill = (status: OasisStatus, label: string) => (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs">
      {status === 'checking'
        ? <Clock className="h-3 w-3 text-zion-gold animate-spin" />
        : status === 'online'
          ? <Wifi className="h-3 w-3 text-zion-cyan" />
          : <WifiOff className="h-3 w-3 text-zion-purple" />}
      <span className={status === 'online' ? 'text-zion-cyan' : status === 'offline' ? 'text-zion-purple' : 'text-zion-gold'}>
        {label} · {status === 'checking' ? L4OasisCopy.checking[cs ? 'cs' : 'en'] : status === 'online' ? L4OasisCopy.online[cs ? 'cs' : 'en'] : L4OasisCopy.offline[cs ? 'cs' : 'en']}
      </span>
    </div>
  );

  return (
    <div className="pt-28 pb-24 overflow-x-hidden">
      <div className="zion-container max-w-7xl space-y-16">

        {/* ── HERO ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="zion-rainbow-card p-6 md:p-10"
          style={{ '--rc': '6, 105, 40' } as React.CSSProperties}
        >
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-zion-gold/40 bg-zion-gold/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-gold uppercase">
                <Gamepad2 className="h-4 w-4" />
                L4 · ZION Oasis · Game Layer
              </div>
              {statusPill(oasisStatus, L4OasisCopy.oasisApi[cs ? 'cs' : 'en'])}
              <a
                href={OASIS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-zion-cyan/30 bg-zion-cyan/10 px-3 py-1 text-xs text-zion-cyan hover:bg-zion-cyan/15 transition-colors"
              >
                <Globe2 className="h-3 w-3" />
                {L4OasisCopy.webClient[cs ? 'cs' : 'en']} · {L4OasisCopy.online[cs ? 'cs' : 'en']}
              </a>
            </div>
            <div className="max-w-3xl">
              <p className="text-sm uppercase tracking-[0.4em] text-gray-400">
                {L4OasisCopy.gameLayerOfTheZionEcosystem[cs ? 'cs' : 'en']}
              </p>
              <h1 className="text-3xl sm:text-5xl font-semibold text-gradient leading-tight">
                {L4OasisCopy.zionOasisL4[cs ? 'cs' : 'en']}
              </h1>
              <p className="mt-2 text-lg font-medium text-zion-gold/90">
                {L4OasisCopy.oasisTagline[cs ? 'cs' : 'en']}
              </p>
            </div>
            <p className="text-lg text-gray-300 max-w-3xl">
              {L4OasisCopy.heroDesc[cs ? 'cs' : 'en']}
            </p>
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="inline-flex items-center gap-2 rounded-full border border-zion-gold/30 bg-zion-gold/10 px-4 py-2 text-orange-200">
                <Star className="h-3 w-3" /> {AVATAR_COUNT} {cs ? 'avatarů' : 'avatars'}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-zion-cyan/30 bg-zion-cyan/10 px-4 py-2 text-cyan-200">
                <Globe2 className="h-3 w-3" /> {WORLD_STATS.total} {cs ? 'světů' : 'worlds'}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-zion-purple/30 bg-zion-purple/10 px-4 py-2 text-purple-200">
                <KeyRound className="h-3 w-3" /> 108 clues · 3 keys
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-zion-gold/30 bg-zion-gold/10 px-4 py-2 text-amber-200">
                <Gem className="h-3 w-3" /> 1B ZION {cs ? 'hlavní cena' : 'grand prize'}
              </span>
            </div>
            <div className="relative z-10 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
              <img
                src="/images/l4-oasis/hero.webp"
                alt={cs ? 'ZION Oasis — Strom života a Zlaté vejce ve spirální galaxii' : 'ZION Oasis — the Tree of Life and the Golden Egg in a spiral galaxy'}
                width={1280}
                height={720}
                loading="eager"
                decoding="async"
                fetchPriority="high"
                className="w-full object-cover"
              />
            </div>
          </div>
        </motion.section>

        {/* ── LIVE CLIENT ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="zion-rainbow-card p-8"
          style={{ '--rc': '6, 105, 40' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{L4OasisCopy.liveClient[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <MonitorPlay className="h-7 w-7 text-zion-cyan" />
              {L4OasisCopy.oasisWebLive[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400 max-w-3xl">{L4OasisCopy.liveClientDesc[cs ? 'cs' : 'en']}</p>
          </div>
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="zion-rainbow-sub p-6" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
              <p className="text-xs font-semibold uppercase tracking-wider text-zion-cyan mb-4">oasis.zionterranova.com</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {zones.map((z) => (
                  <div key={z.name} className="rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-center">
                    <z.icon className="h-5 w-5 text-zion-gold mx-auto mb-2" />
                    <span className="text-xs font-semibold text-white">{z.name}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-gray-500">{L4OasisCopy.shipsNote[cs ? 'cs' : 'en']}</p>
              <p className="mt-1 text-xs text-gray-500">{L4OasisCopy.hiranKeysNote[cs ? 'cs' : 'en']}</p>
            </div>
            <div className="zion-rainbow-sub p-6" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
              <div className="flex items-center gap-2 mb-3">
                <MousePointerClick className="h-4 w-4 text-zion-purple" />
                <span className="text-xs font-semibold uppercase tracking-wider text-zion-purple">{L4OasisCopy.pilgrimRite[cs ? 'cs' : 'en']}</span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed mb-4">{L4OasisCopy.pilgrimRiteDesc[cs ? 'cs' : 'en']}</p>
              <div className="flex flex-col gap-2">
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300">
                  {L4OasisCopy.redPill[cs ? 'cs' : 'en']}
                </div>
                <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-300">
                  {L4OasisCopy.bluePill[cs ? 'cs' : 'en']}
                </div>
              </div>
              <a
                href={OASIS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-zion-gold/90 px-4 py-2.5 text-sm font-bold text-black hover:bg-zion-gold transition-colors"
              >
                {L4OasisCopy.enterOasis[cs ? 'cs' : 'en']} <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </motion.section>

        {/* ── MULTIVERSE LAYERS + WORLD REGISTRY ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="zion-rainbow-card p-8"
          style={{ '--rc': '6, 105, 40' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{L4OasisCopy.multiverse[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Atom className="h-7 w-7 text-zion-purple" />
              {L4OasisCopy.fiveLayersOfReality[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400">{L4OasisCopy.multiverseDesc[cs ? 'cs' : 'en']}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-6">
            {multiverseLayers.map((l) => (
              <div key={l.title} className="zion-rainbow-sub p-5" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
                <l.icon className={`h-6 w-6 ${l.color} mb-3`} />
                <h3 className="text-sm font-semibold text-white mb-2">{l.title}</h3>
                <p className="text-xs text-gray-400 leading-relaxed">{l.desc}</p>
              </div>
            ))}
          </div>
          <div className="zion-rainbow-sub p-5" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="max-w-md">
                <p className="text-xs font-semibold uppercase tracking-wider text-zion-cyan mb-1">{L4OasisCopy.worldRegistry[cs ? 'cs' : 'en']} · {WORLD_STATS.total}</p>
                <p className="text-xs text-gray-400 leading-relaxed">{L4OasisCopy.worldsRegistryDesc[cs ? 'cs' : 'en']}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-zion-cyan/30 bg-zion-cyan/10 px-3 py-1.5 text-xs text-cyan-200">{WORLD_STATS.starSystems} {L4OasisCopy.starSystems[cs ? 'cs' : 'en']}</span>
                <span className="rounded-full border border-zion-gold/30 bg-zion-gold/10 px-3 py-1.5 text-xs text-amber-200">{WORLD_STATS.planets} {L4OasisCopy.planets[cs ? 'cs' : 'en']}</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-300">{WORLD_STATS.sectors} {L4OasisCopy.sectors[cs ? 'cs' : 'en']}</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-300">{WORLD_STATS.worlds} {L4OasisCopy.worldsCount[cs ? 'cs' : 'en']}</span>
                <span className="rounded-full border border-zion-purple/30 bg-zion-purple/10 px-3 py-1.5 text-xs text-purple-200">{WORLD_STATS.dimensions} {L4OasisCopy.dimensions[cs ? 'cs' : 'en']}</span>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ── AVATAR SYSTEM ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="zion-rainbow-card p-8"
          style={{ '--rc': '6, 105, 40' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{L4OasisCopy.liveSystem[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Star className="h-7 w-7 text-zion-gold" />
              {L4OasisCopy.avatarSystemActive[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400 max-w-3xl">{L4OasisCopy.avatarSystemDesc[cs ? 'cs' : 'en']}</p>
          </div>
          <div className="grid md:grid-cols-4 gap-4 mb-6">
            {AVATAR_RARITY.map((r) => (
              <div key={r.key} className="zion-rainbow-sub p-5 text-center" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold mb-3 ${r.badge}`}>
                  {L4OasisCopy[r.key][cs ? 'cs' : 'en']}
                </span>
                <p className={`text-3xl font-bold ${r.color}`}>{r.count}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-black/30 p-4 flex items-start gap-3">
              <Swords className="h-5 w-5 text-zion-cyan shrink-0 mt-0.5" />
              <p className="text-sm text-gray-400">{L4OasisCopy.avatarQuestsNote[cs ? 'cs' : 'en']}</p>
            </div>
            <div className="rounded-xl border border-zion-gold/20 bg-zion-gold/5 p-4 flex items-start gap-3">
              <Gem className="h-5 w-5 text-zion-gold shrink-0 mt-0.5" />
              <p className="text-sm text-gray-300">{L4OasisCopy.krishnaNote[cs ? 'cs' : 'en']}</p>
            </div>
          </div>
        </motion.section>

        {/* ── GOLDEN EGG ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="zion-rainbow-card p-8"
          style={{ '--rc': '255, 215, 0' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{L4OasisCopy.treasure[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Trophy className="h-7 w-7 text-zion-gold" />
              {L4OasisCopy.goldenEggTitle[cs ? 'cs' : 'en']}
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="zion-rainbow-sub p-4 text-center" style={{ '--rc': '255, 215, 0' } as React.CSSProperties}>
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">{L4OasisCopy.grandPrize[cs ? 'cs' : 'en']}</p>
              <p className="text-xl md:text-2xl font-bold text-zion-gold">1B ZION</p>
            </div>
            <div className="zion-rainbow-sub p-4 text-center" style={{ '--rc': '255, 215, 0' } as React.CSSProperties}>
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">{L4OasisCopy.totalPrizePool[cs ? 'cs' : 'en']}</p>
              <p className="text-xl md:text-2xl font-bold text-zion-gold">~1.94B ZION</p>
            </div>
            <div className="zion-rainbow-sub p-4 text-center" style={{ '--rc': '255, 215, 0' } as React.CSSProperties}>
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">{L4OasisCopy.clues[cs ? 'cs' : 'en']}</p>
              <p className="text-xl md:text-2xl font-bold text-zion-cyan">108</p>
            </div>
            <div className="zion-rainbow-sub p-4 text-center" style={{ '--rc': '255, 215, 0' } as React.CSSProperties}>
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">{L4OasisCopy.masterKeys[cs ? 'cs' : 'en']}</p>
              <p className="text-xl md:text-2xl font-bold text-zion-purple">3</p>
            </div>
          </div>
          <p className="text-sm text-gray-300 leading-relaxed mb-6 max-w-4xl">
            {L4OasisCopy.goldenEggDesc[cs ? 'cs' : 'en']}
          </p>

          <div className="grid gap-4 md:grid-cols-3 mb-6">
            {CLUE_PATHS.map((p) => (
              <div key={p.key} className="zion-rainbow-sub p-5" style={{ '--rc': p.rc } as React.CSSProperties}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className={`font-semibold ${p.color}`}>{L4OasisCopy[p.key][cs ? 'cs' : 'en']}</h3>
                  <span className={`text-2xl font-bold ${p.color}`}>{p.clues}</span>
                </div>
                <p className="text-xs text-gray-400">{L4OasisCopy[p.descKey][cs ? 'cs' : 'en']}</p>
              </div>
            ))}
          </div>

          <div className="zion-rainbow-sub p-5 overflow-x-auto mb-4" style={{ '--rc': '255, 215, 0' } as React.CSSProperties}>
            <p className="text-xs font-semibold uppercase tracking-wider text-zion-gold mb-3">{L4OasisCopy.prizeTiersTitle[cs ? 'cs' : 'en']}</p>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-gray-500">
                  <th className="pb-2 pr-4 font-medium">{L4OasisCopy.tierRank[cs ? 'cs' : 'en']}</th>
                  <th className="pb-2 pr-4 font-medium">{L4OasisCopy.tierTitle[cs ? 'cs' : 'en']}</th>
                  <th className="pb-2 pr-4 font-medium">{L4OasisCopy.tierPrize[cs ? 'cs' : 'en']}</th>
                  <th className="pb-2 font-medium">{L4OasisCopy.tierUnlock[cs ? 'cs' : 'en']}</th>
                </tr>
              </thead>
              <tbody>
                {PRIZE_TIERS.map((t) => (
                  <tr key={t.rank} className="border-b border-white/5">
                    <td className="py-2 pr-4 font-mono text-gray-400">#{t.rank}</td>
                    <td className="py-2 pr-4 font-semibold text-white">{t.title}</td>
                    <td className="py-2 pr-4 font-mono text-zion-gold">{t.prize} ZION</td>
                    <td className="py-2 text-gray-400">{t.unlock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="rounded-xl border border-zion-purple/20 bg-zion-purple/5 p-4 flex items-start gap-3">
            <KeyRound className="h-5 w-5 text-zion-purple shrink-0 mt-0.5" />
            <p className="text-sm text-gray-300">{L4OasisCopy.finalUnlock[cs ? 'cs' : 'en']}</p>
          </div>
        </motion.section>

        {/* ── CONSCIOUSNESS LEVELS ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="zion-rainbow-card p-8"
          style={{ '--rc': '147, 51, 234' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{L4OasisCopy.consciousness[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Sparkles className="h-7 w-7 text-zion-purple" />
              {L4OasisCopy.nineLevels[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400 max-w-3xl">{L4OasisCopy.consciousnessDesc[cs ? 'cs' : 'en']}</p>
          </div>
          <div className="zion-rainbow-sub p-5 overflow-x-auto" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-gray-500">
                  <th className="pb-2 pr-4 font-medium">#</th>
                  <th className="pb-2 pr-4 font-medium">{L4OasisCopy.clName[cs ? 'cs' : 'en']}</th>
                  <th className="pb-2 pr-4 font-medium">{L4OasisCopy.clXp[cs ? 'cs' : 'en']}</th>
                  <th className="pb-2 pr-4 font-medium">{L4OasisCopy.clMultiplier[cs ? 'cs' : 'en']}</th>
                  <th className="pb-2 font-medium">{L4OasisCopy.clBonus[cs ? 'cs' : 'en']}</th>
                </tr>
              </thead>
              <tbody>
                {CONSCIOUSNESS_LEVELS.map((cl, i) => (
                  <tr key={cl.name} className="border-b border-white/5">
                    <td className="py-2 pr-4 font-mono text-gray-500">CL{i + 1}</td>
                    <td className="py-2 pr-4 font-semibold text-white">{cl.name}</td>
                    <td className="py-2 pr-4 font-mono text-zion-cyan">{cl.xp} XP</td>
                    <td className="py-2 pr-4 font-mono text-zion-purple">{cl.mult}</td>
                    <td className="py-2 font-mono text-zion-gold">{cl.bonus === '—' ? '—' : `${cl.bonus} ZION`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.section>

        {/* ── REWARD POOLS ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="zion-rainbow-card p-8"
          style={{ '--rc': '6, 105, 40' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{L4OasisCopy.rewards[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Coins className="h-7 w-7 text-zion-gold" />
              {L4OasisCopy.oasisPool[cs ? 'cs' : 'en']} — 4.95B ZION
            </h2>
            <p className="text-sm text-gray-400">{L4OasisCopy.oasisPoolDesc[cs ? 'cs' : 'en']}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {pools.map((p) => (
              <div key={p.title} className="zion-rainbow-sub p-5" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
                <p.icon className={`h-6 w-6 ${p.color} mb-3`} />
                <h3 className="font-semibold text-white mb-2">{p.title}</h3>
                <p className="text-sm text-gray-400">{p.desc}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── AI BRIDGE ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="zion-rainbow-card p-8"
          style={{ '--rc': '6, 182, 212' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{L4OasisCopy.aiBridge[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Bot className="h-7 w-7 text-zion-cyan" />
              {L4OasisCopy.hiranInsideOasis[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400 max-w-3xl">{L4OasisCopy.aiBridgeDesc[cs ? 'cs' : 'en']}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {aiBridge.map((item) => (
              <div key={item.title} className="zion-rainbow-sub p-5" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
                <item.icon className={`h-6 w-6 ${item.color} mb-3`} />
                <h3 className="font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-gray-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── PROTOCOLS ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="zion-rainbow-card p-8"
          style={{ '--rc': '6, 105, 40' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{L4OasisCopy.baselineProtocols[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Shield className="h-7 w-7 text-zion-cyan" />
              {L4OasisCopy.oasisGameProtocols[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400">
              {L4OasisCopy.coreGameProtocolsForInteropera[cs ? 'cs' : 'en']}
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {protocols.map((p) => (
              <div key={p.title} className="zion-rainbow-sub p-5" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
                <div className="flex items-center gap-2 mb-2">
                  <p.icon className={`h-5 w-5 ${p.color}`} />
                  <h3 className="font-semibold text-white">{p.title}</h3>
                </div>
                <p className="text-sm text-gray-400">{p.desc}</p>
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
          style={{ '--rc': '6, 105, 40' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{L4OasisCopy.developmentPath[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Clock className="h-7 w-7 text-zion-cyan" />
              {L4OasisCopy.l4OasisRoadmap[cs ? 'cs' : 'en']}
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {roadmap.map((phase) => (
              <div key={phase.phase} className="zion-rainbow-sub p-5" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-lg font-bold text-white">{phase.phase}</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                    phase.status === 'planned'
                      ? 'bg-zion-gold/10 text-zion-gold border-zion-gold/20'
                      : 'bg-zion-purple/10 text-zion-purple border-zion-purple/20'
                  }`}>
                    {phase.period}
                  </span>
                </div>
                <ul className="space-y-3">
                  {phase.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-gray-400">
                      {phase.status === 'planned' ? (
                        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-zion-gold" />
                      ) : (
                        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-zion-purple" />
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
            <a
              href={OASIS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="zion-rainbow-sub inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
              style={{ '--rc': '6, 105, 40' } as React.CSSProperties}
            >
              <Gamepad2 className="h-4 w-4" /> {L4OasisCopy.enterOasis[cs ? 'cs' : 'en']}
            </a>
            <Link href="/l3-hiran" className="inline-flex items-center gap-2 rounded-2xl border border-zion-purple/30 bg-zion-purple/5 px-6 py-3 text-sm font-semibold text-purple-200 hover:bg-zion-purple/10 transition-colors">
              <Sparkles className="h-4 w-4" /> L3 Hiran
            </Link>
            <Link href="/l5-free-world" className="inline-flex items-center gap-2 rounded-2xl border border-zion-gold/30 bg-zion-gold/5 px-6 py-3 text-sm font-semibold text-amber-200 hover:bg-zion-gold/10 transition-colors">
              L5 Free World <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/terranova" className="inline-flex items-center gap-2 rounded-2xl border border-zion-cyan/30 bg-zion-cyan/5 px-6 py-3 text-sm font-semibold text-cyan-200 hover:bg-zion-cyan/10 transition-colors">
              <BookOpen className="h-4 w-4" /> TerraNova Book
            </Link>
          </div>
        </motion.section>

      </div>
    </div>
  );
}
