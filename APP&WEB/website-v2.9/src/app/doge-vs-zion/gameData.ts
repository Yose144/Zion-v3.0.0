// ─── Game Data for Doge vs ZION Idle Miner ────────────────────────────────────
// Inspired by Dogeminer 2, adapted to ZION ecosystem theme
// "Much mine. Very wow. Such ZION. To the stars." — Doge

// ─── Types ────────────────────────────────────────────────────────────────────

export type Rarity = 'common' | 'improved' | 'rare' | 'epic' | 'legendary';

export interface Stats {
  dpc: number;
  dps: number;
  critChance: number;
  luck: number;
  lootFind: number;
  wow: number;
}

export interface Helper {
  id: string;
  name: string;
  emoji: string;
  baseCost: number;
  baseDps: number;
  description: string;
  location: number;
  upgrades: HelperUpgrade[];
}

export interface HelperUpgrade {
  id: string;
  name: string;
  cost: number;
  diamonds: number;
  dpsMult: number;
  description: string;
}

export interface Pickaxe {
  id: string;
  name: string;
  emoji: string;
  rarity: Rarity;
  dpc: number;
  critChance: number;
  luck: number;
  lootFind: number;
  wow: number;
}

export interface Fortune {
  id: string;
  name: string;
  emoji: string;
  rarity: Rarity;
  dpcMult: number;
  dpsMult: number;
  critChance: number;
  luck: number;
  lootFind: number;
  wow: number;
}

export interface Location {
  id: string;
  name: string;
  emoji: string;
  unlockAt: number;
  rockBaseHp: number;
  rockReward: number;
  description: string;
  rockEmoji: string;
  theme: 'doge' | 'zion';
}

// ─── Number Formatting ────────────────────────────────────────────────────────

const SUFFIXES = [
  '', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc',
  'UDc', 'DDc', 'TDc',
];

export function fmt(n: number): string {
  if (n < 1000) return Math.floor(n).toString();
  const tier = Math.floor(Math.log10(n) / 3);
  if (tier >= SUFFIXES.length) return n.toExponential(2);
  const scaled = n / Math.pow(1000, tier);
  return `${scaled.toFixed(scaled < 10 ? 2 : scaled < 100 ? 1 : 0)}${SUFFIXES[tier]}`;
}

export function fmtTime(s: number): string {
  if (s < 60) return `${Math.floor(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${Math.floor(s % 60)}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

// ─── Locations ────────────────────────────────────────────────────────────────

export const LOCATIONS: Location[] = [
  {
    id: 'earth',
    name: 'Earth',
    emoji: '🌍',
    unlockAt: 0,
    rockBaseHp: 100,
    rockReward: 50,
    description: 'Where it all begins. Doge mining on home turf. Much dirt. Very rock.',
    rockEmoji: '🪨',
    theme: 'doge',
  },
  {
    id: 'l2-base',
    name: 'L2 / Base',
    emoji: '⚡',
    unlockAt: 1_000_000,
    rockBaseHp: 5_000,
    rockReward: 10_000,
    description: 'Layer 2 — ZION bridged to Base Mainnet. 5/5 multisig secured. Very safe. Much layer.',
    rockEmoji: '💎',
    theme: 'zion',
  },
  {
    id: 'l3-hiran',
    name: 'L3 / Hiran',
    emoji: '🧠',
    unlockAt: 100_000_000,
    rockBaseHp: 250_000,
    rockReward: 2_000_000,
    description: 'Hiranyagarbha — the cosmic mind layer. Consciousness mining. Very deep. Such awareness.',
    rockEmoji: '🧩',
    theme: 'zion',
  },
  {
    id: 'l4-oasis',
    name: 'L4 / Oasis',
    emoji: '🏜️',
    unlockAt: 10_000_000_000,
    rockBaseHp: 10_000_000,
    rockReward: 500_000_000,
    description: 'The Oasis — infinite desert of data. Much sand. Very dry. Such data aquifer.',
    rockEmoji: '🏜️',
    theme: 'zion',
  },
  {
    id: 'l5-free-world',
    name: 'L5 / Free World',
    emoji: '🗽',
    unlockAt: 1_000_000_000_000,
    rockBaseHp: 500_000_000,
    rockReward: 100_000_000_000,
    description: 'The Free World — liberated financial layer. Much freedom. Very decentralized. Such liberty.',
    rockEmoji: '🏛️',
    theme: 'zion',
  },
  {
    id: 'l6-issobella',
    name: 'L6 / Issobella',
    emoji: '👑',
    unlockAt: 100_000_000_000_000,
    rockBaseHp: 25_000_000_000,
    rockReward: 20_000_000_000_000,
    description: 'Issobella — the final frontier. Royal mining grounds. Very crown. Much majesty. Such endgame.',
    rockEmoji: '👑',
    theme: 'zion',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const HELPERS: Helper[] = [
  // ── Earth (Doge themed) ──
  {
    id: 'mining-shibe',
    name: 'Mining Shibe',
    emoji: '⛏️🐕',
    baseCost: 50,
    baseDps: 1,
    description: 'A Shibe with a mining helmet. Very mine. Much wow. Such dig.',
    location: 0,
    upgrades: [
      { id: 'shibe-fedora', name: 'Euphoria Fedoras', cost: 1_000, diamonds: 1, dpsMult: 2, description: 'Replace helmets with fedoras. Much tip. Very style. Such euphoria.' },
      { id: 'shibe-gold-pick', name: 'Golden Pickaxes', cost: 3_500, diamonds: 1, dpsMult: 2, description: 'Golden pickaxes for golden Shibes. Very shiny. Much bling.' },
      { id: 'shibe-salary', name: 'Salary Raise', cost: 32_500, diamonds: 1, dpsMult: 3, description: 'Pay them more. They mine harder. Such capitalism. Very fair.' },
      { id: 'shibe-diamond-helm', name: 'Diamond Helmet', cost: 500_000, diamonds: 5, dpsMult: 5, description: 'Unbreakable diamond helmets. Very fancy. Much protection. Such bling.' },
    ],
  },
  {
    id: 'doge-kennels',
    name: 'Doge Kennels',
    emoji: '🏠🐕',
    baseCost: 400,
    baseDps: 5,
    description: 'Entire kennels of Doges mining ZION. Very efficiency. Much bark. Such pack.',
    location: 0,
    upgrades: [
      { id: 'kennels-axes', name: 'More Axes', cost: 1_100, diamonds: 1, dpsMult: 2, description: 'More pickaxes for the kennels. Very armed. Such sharp.' },
      { id: 'kennels-friendly', name: 'Friendlier Kennels', cost: 12_000, diamonds: 1, dpsMult: 2, description: 'Happier dogs mine harder. Much wag. Very tail. Such joy.' },
      { id: 'kennels-micro-rockets', name: 'Micro-Rockets', cost: 42_000, diamonds: 1, dpsMult: 3, description: 'Attach micro-rockets to dogs. TO THE MOON! Very fast. Such zoom.' },
      { id: 'kennels-jetpacks', name: 'Jet Packs', cost: 3_000_000, diamonds: 5, dpsMult: 5, description: 'Jet-pack dogs. Need I say more? Very whoosh. Much fly. Such wow.' },
    ],
  },
  {
    id: 'streamer-kittens',
    name: 'Streamer Kittens',
    emoji: '🐱🎮',
    baseCost: 12_000,
    baseDps: 50,
    description: 'Kittens streaming their mining sessions on Twitch. Very viral. Much meow. Such content.',
    location: 0,
    upgrades: [
      { id: 'kittens-better-stream', name: 'Better Stream Quality', cost: 50_000, diamonds: 1, dpsMult: 2, description: '1080p60 mining streams. Very crisp. Much pixel. Such HD.' },
      { id: 'kittens-sponsor', name: 'Sponsorship Deals', cost: 500_000, diamonds: 2, dpsMult: 3, description: 'Sponsored mining is profitable mining. Very brand. Much money. Such sellout.' },
      { id: 'kittens-merch', name: 'Merch Shop', cost: 5_000_000, diamonds: 3, dpsMult: 4, description: 'Mining kitten merch. It sells. Very hoodie. Much profit. Such cute.' },
    ],
  },
  {
    id: 'space-rocket',
    name: 'Space Rocket',
    emoji: '🚀',
    baseCost: 500_000,
    baseDps: 500,
    description: 'A rocket that mines ZION in orbit. Unlocks L2! Very thrust. Much space. Such zoom.',
    location: 0,
    upgrades: [
      { id: 'rocket-fuel', name: 'Premium Fuel', cost: 2_000_000, diamonds: 2, dpsMult: 2, description: 'Premium rocket fuel. Very burn. Much thrust. Such vroom.' },
      { id: 'rocket-mars', name: 'Mars Capability', cost: 20_000_000, diamonds: 3, dpsMult: 3, description: 'Reach Mars and beyond. Very red. Much planet. Such explore.' },
    ],
  },

  // ── L2 / Base (ZION themed) ──
  {
    id: 'zion-validator',
    name: 'ZION Validator',
    emoji: '🛡️',
    baseCost: 5_000_000,
    baseDps: 5_000,
    description: '5/5 multisig validator node. Securing the network. Very safe. Much consensus. Such trustless.',
    location: 1,
    upgrades: [
      { id: 'val-keys', name: 'More Validator Keys', cost: 25_000_000, diamonds: 3, dpsMult: 2, description: 'More keys, more security, more rewards. Very key. Much lock. Such secure.' },
      { id: 'val-staking', name: 'Staking Integration', cost: 200_000_000, diamonds: 5, dpsMult: 3, description: 'Stake rewards boost mining. Very yield. Much compound. Such rich.' },
      { id: 'val-quantum', name: 'Quantum Signing', cost: 5_000_000_000, diamonds: 10, dpsMult: 5, description: 'Quantum-resistant signatures. Very future. Much secure. Such Schrödinger.' },
    ],
  },
  {
    id: 'bridge-node',
    name: 'Bridge Node',
    emoji: '🌉',
    baseCost: 50_000_000,
    baseDps: 25_000,
    description: 'L1→L2 bridge node. Locking and minting wZION. Very bridge. Much lock. Such mint.',
    location: 1,
    upgrades: [
      { id: 'bridge-relay', name: 'Fast Relay', cost: 250_000_000, diamonds: 3, dpsMult: 2, description: 'Faster bridge transactions. Very zoom. Much relay. Such speed.' },
      { id: 'bridge-multisig', name: '7/7 Multisig', cost: 2_000_000_000, diamonds: 5, dpsMult: 3, description: 'Upgrade from 5/5 to 7/7 multisig. Very paranoid. Much secure. Such overkill.' },
      { id: 'bridge-batch', name: 'Batch Processing', cost: 50_000_000_000, diamonds: 10, dpsMult: 5, description: 'Process 1000 locks per block. Very efficient. Much batch. Such throughput.' },
    ],
  },
  {
    id: 'staking-pool',
    name: 'Staking Pool',
    emoji: '💧',
    baseCost: 500_000_000,
    baseDps: 150_000,
    description: 'DeFi staking pool. Yield farming ZION. Very liquid. Much yield. Such farm.',
    location: 1,
    upgrades: [
      { id: 'pool-rewards', name: 'Reward Boost', cost: 2_500_000_000, diamonds: 5, dpsMult: 2, description: 'notifyRewardAmount() finally called! Very bug. Much fix. Such reward.' },
      { id: 'pool-compound', name: 'Auto-Compound', cost: 20_000_000_000, diamonds: 8, dpsMult: 3, description: 'Auto-compounding rewards. Very lazy. Much efficient. Such passive.' },
      { id: 'pool-mega', name: 'Mega Pool', cost: 500_000_000_000, diamonds: 15, dpsMult: 5, description: 'The biggest staking pool in existence. Very deep. Much liquid. Such whale.' },
    ],
  },
  {
    id: 'dao-treasury',
    name: 'DAO Treasury',
    emoji: '🏛️',
    baseCost: 5_000_000_000,
    baseDps: 1_000_000,
    description: 'Governance treasury. Community-governed mining. Very vote. Much democracy. Such governance.',
    location: 1,
    upgrades: [
      { id: 'dao-vote', name: 'Voting Power', cost: 25_000_000_000, diamonds: 5, dpsMult: 2, description: 'More votes, more power. Very ballot. Much choice. Such democratic.' },
      { id: 'dao-proposal', name: 'Mining Proposal', cost: 200_000_000_000, diamonds: 10, dpsMult: 3, description: 'DAO-approved mining operations. Very proposal. Much debate. Such consensus.' },
      { id: 'dao-titan', name: 'Titan Treasury', cost: 5_000_000_000_000, diamonds: 20, dpsMult: 5, description: 'Treasury of titanic proportions. Very big. Much fund. Such titan.' },
    ],
  },

  // ── L3 / Hiran ──
  {
    id: 'hiran-miner',
    name: 'Hiran Miner',
    emoji: '🧙',
    baseCost: 50_000_000_000,
    baseDps: 10_000_000,
    description: 'Consciousness-augmented mining. Mind over matter. Very zen. Much aware. Such cosmic.',
    location: 2,
    upgrades: [
      { id: 'hiran-focus', name: 'Deep Focus', cost: 250_000_000_000, diamonds: 10, dpsMult: 2, description: 'Meditation boosts mining output. Very om. Much chakra. Such focus.' },
      { id: 'hiran-enlighten', name: 'Enlightenment', cost: 2_000_000_000_000, diamonds: 15, dpsMult: 3, description: 'Enlightened mining. Very Buddha. Much awareness. Such satori.' },
      { id: 'hiran-transcend', name: 'Transcendence', cost: 50_000_000_000_000, diamonds: 25, dpsMult: 5, description: 'Beyond mining. Pure consciousness. Very ascended. Much beyond. Such infinite.' },
    ],
  },
  {
    id: 'consciousness-tree',
    name: 'Consciousness Tree',
    emoji: '🌳',
    baseCost: 500_000_000_000,
    baseDps: 100_000_000,
    description: 'Tree of Life mining ZION through roots of awareness. Very rooted. Much grow. Such organic.',
    location: 2,
    upgrades: [
      { id: 'tree-roots', name: 'Deeper Roots', cost: 2_500_000_000_000, diamonds: 15, dpsMult: 2, description: 'Roots reach the core of the planet. Very deep. Much anchor. Such grounded.' },
      { id: 'tree-bloom', name: 'Eternal Bloom', cost: 20_000_000_000_000, diamonds: 20, dpsMult: 3, description: 'The tree blooms eternally. Very flower. Much blossom. Such beauty.' },
      { id: 'tree-cosmic', name: 'Cosmic Tree', cost: 500_000_000_000_000, diamonds: 30, dpsMult: 5, description: 'A tree that spans the cosmos. Very Yggdrasil. Much branch. Such infinite.' },
    ],
  },

  // ── L4 / Oasis ──
  {
    id: 'oasis-rig',
    name: 'Oasis Rig',
    emoji: '🏜️⚙️',
    baseCost: 5_000_000_000_000,
    baseDps: 1_000_000_000,
    description: 'Deep desert mining rig. Tapping the data aquifer. Very thirsty. Much drill. Such sand.',
    location: 3,
    upgrades: [
      { id: 'oasis-deep', name: 'Deep Drilling', cost: 25_000_000_000_000, diamonds: 20, dpsMult: 2, description: 'Drill deeper into the data sands. Very deep. Much bore. Such penetrate.' },
      { id: 'oasis-cooling', name: 'Cooling System', cost: 200_000_000_000_000, diamonds: 25, dpsMult: 3, description: 'Keep the rig cool in the desert heat. Very chill. Much frost. Such AC.' },
      { id: 'oasis-mega', name: 'Mega Rig', cost: 5_000_000_000_000_000, diamonds: 40, dpsMult: 5, description: 'The largest rig in the Oasis. Very huge. Much machine. Such industrial.' },
    ],
  },

  // ── L5 / Free World ──
  {
    id: 'free-miner',
    name: 'Free Miner',
    emoji: '🗽⛏️',
    baseCost: 500_000_000_000_000,
    baseDps: 100_000_000_000,
    description: 'Liberated mining in the Free World. Very free. Much liberty. Such independent.',
    location: 4,
    upgrades: [
      { id: 'free-liberty', name: 'Liberty Boost', cost: 2_500_000_000_000_000, diamonds: 30, dpsMult: 2, description: 'Freedom fuels mining. Very patriotic. Much liberty. Such independent.' },
      { id: 'free-justice', name: 'Justice System', cost: 20_000_000_000_000_000, diamonds: 40, dpsMult: 3, description: 'Fair mining for all. Very just. Much equal. Such balanced.' },
    ],
  },

  // ── L6 / Issobella ──
  {
    id: 'issobella-royal',
    name: 'Royal Miner',
    emoji: '👑⛏️',
    baseCost: 50_000_000_000_000_000,
    baseDps: 10_000_000_000_000,
    description: 'Royal mining operations. The crown mines ZION. Very majesty. Much royal. Such sovereign.',
    location: 5,
    upgrades: [
      { id: 'royal-crown', name: 'Crown Jewels', cost: 250_000_000_000_000_000, diamonds: 50, dpsMult: 2, description: 'Mining with the power of the crown. Very bling. Much jewel. Such sovereign.' },
      { id: 'royal-empire', name: 'Royal Empire', cost: 2_000_000_000_000_000_000, diamonds: 75, dpsMult: 3, description: 'An empire of mining. Very vast. Much domain. Such realm.' },
    ],
  },
];

// ─── Pickaxes (Mining Rigs) ───────────────────────────────────────────────────

export const PICKAXES: Pickaxe[] = [
  { id: 'wooden', name: 'Wooden Pickaxe', emoji: '🪵', rarity: 'common', dpc: 1, critChance: 0, luck: 0, lootFind: 0, wow: 0 },
  { id: 'iron', name: 'Iron Pickaxe', emoji: '⚒️', rarity: 'common', dpc: 5, critChance: 0.02, luck: 0.01, lootFind: 0, wow: 0 },
  { id: 'steel', name: 'Steel Pickaxe', emoji: '🔨', rarity: 'improved', dpc: 25, critChance: 0.03, luck: 0.02, lootFind: 0.01, wow: 0.01 },
  { id: 'gpu-rx570', name: 'GPU Rig RX 570', emoji: '💻', rarity: 'improved', dpc: 100, critChance: 0.05, luck: 0.03, lootFind: 0.02, wow: 0.02 },
  { id: 'gpu-rtx4090', name: 'GPU Rig RTX 4090', emoji: '🖥️', rarity: 'rare', dpc: 500, critChance: 0.08, luck: 0.05, lootFind: 0.04, wow: 0.03 },
  { id: 'asic-s9', name: 'ASIC Miner S9', emoji: '⚙️', rarity: 'rare', dpc: 2_000, critChance: 0.10, luck: 0.07, lootFind: 0.06, wow: 0.05 },
  { id: 'asic-s19', name: 'ASIC S19 Pro', emoji: '🔧', rarity: 'epic', dpc: 10_000, critChance: 0.12, luck: 0.10, lootFind: 0.08, wow: 0.07 },
  { id: 'quantum', name: 'Quantum Mining Rig', emoji: '⚛️', rarity: 'epic', dpc: 50_000, critChance: 0.15, luck: 0.15, lootFind: 0.12, wow: 0.10 },
  { id: 'cosmic-harmony', name: 'Cosmic Harmony Rig', emoji: '🌌', rarity: 'legendary', dpc: 500_000, critChance: 0.20, luck: 0.25, lootFind: 0.20, wow: 0.15 },
  { id: 'deeksha-lite', name: 'Deeksha Lite Fire Rig', emoji: '🔥', rarity: 'legendary', dpc: 5_000_000, critChance: 0.25, luck: 0.35, lootFind: 0.30, wow: 0.25 },
];

// ─── Fortunes (passive stat boosts) ───────────────────────────────────────────

export const FORTUNES: Fortune[] = [
  { id: 'lucky-coin', name: 'Lucky Coin', emoji: '🪙', rarity: 'common', dpcMult: 1.1, dpsMult: 1, critChance: 0, luck: 0.02, lootFind: 0, wow: 0 },
  { id: 'miners-charm', name: "Miner's Charm", emoji: '🔮', rarity: 'common', dpcMult: 1, dpsMult: 1.1, critChance: 0.01, luck: 0, lootFind: 0.01, wow: 0 },
  { id: 'golden-paw', name: 'Golden Paw', emoji: '🐾', rarity: 'improved', dpcMult: 1.25, dpsMult: 1.15, critChance: 0.02, luck: 0.05, lootFind: 0.02, wow: 0.02 },
  { id: 'diamond-eyes', name: 'Diamond Eyes', emoji: '💎', rarity: 'rare', dpcMult: 1.5, dpsMult: 1.3, critChance: 0.03, luck: 0.08, lootFind: 0.05, wow: 0.05 },
  { id: 'moon-blessing', name: 'Moon Blessing', emoji: '🌙', rarity: 'rare', dpcMult: 1.75, dpsMult: 1.5, critChance: 0.05, luck: 0.10, lootFind: 0.08, wow: 0.07 },
  { id: 'star-fortune', name: 'Star Fortune', emoji: '⭐', rarity: 'epic', dpcMult: 2.5, dpsMult: 2, critChance: 0.08, luck: 0.15, lootFind: 0.12, wow: 0.10 },
  { id: 'cosmic-fortune', name: 'Cosmic Fortune', emoji: '✨', rarity: 'epic', dpcMult: 4, dpsMult: 3, critChance: 0.10, luck: 0.20, lootFind: 0.18, wow: 0.15 },
  { id: 'genesis-fortune', name: 'Genesis Fortune', emoji: '🌟', rarity: 'legendary', dpcMult: 10, dpsMult: 7, critChance: 0.15, luck: 0.30, lootFind: 0.25, wow: 0.25 },
];

// ─── Rarity config ────────────────────────────────────────────────────────────

export const RARITY_CONFIG: Record<Rarity, { color: string; label: string; dropWeight: number; emoji: string }> = {
  common: { color: 'text-gray-400', label: 'Common', dropWeight: 100, emoji: '⬜' },
  improved: { color: 'text-green-400', label: 'Improved', dropWeight: 40, emoji: '🟩' },
  rare: { color: 'text-blue-400', label: 'Rare', dropWeight: 15, emoji: '🟦' },
  epic: { color: 'text-purple-400', label: 'Epic', dropWeight: 4, emoji: '🟪' },
  legendary: { color: 'text-amber-400', label: 'Legendary', dropWeight: 1, emoji: '🟨' },
};

// ─── Helper cost scaling ──────────────────────────────────────────────────────

export function helperCost(helper: Helper, owned: number): number {
  return Math.ceil(helper.baseCost * Math.pow(1.15, owned));
}

export function helperDps(helper: Helper, owned: number, upgradeLevels: number[]): number {
  let dps = helper.baseDps * owned;
  for (let i = 0; i < upgradeLevels.length; i++) {
    if (upgradeLevels[i] > 0) {
      dps *= helper.upgrades[i].dpsMult;
    }
  }
  return dps;
}

// ─── Loot generation ──────────────────────────────────────────────────────────

export type LootType = 'coins' | 'pickaxe' | 'fortune' | 'diamonds';

export interface LootDrop {
  type: LootType;
  amount?: number;
  pickaxeId?: string;
  fortuneId?: string;
  rarity: Rarity;
}

export const LOOT_THRESHOLDS = [0.90, 0.75, 0.50, 0.25, 0.0];

export function generateLoot(
  rockMaxHp: number,
  rockReward: number,
  luck: number,
  lootFind: number,
  locationIdx: number,
): LootDrop[] {
  const drops: LootDrop[] = [];
  const baseCoinDrop = rockReward * 0.5;

  drops.push({ type: 'coins', amount: Math.ceil(baseCoinDrop), rarity: 'common' });

  if (Math.random() < 0.05 + luck * 0.1) {
    drops.push({ type: 'diamonds', amount: 1 + Math.floor(Math.random() * 3), rarity: 'rare' });
  }

  if (Math.random() < 0.15 + lootFind * 0.3 + luck * 0.1) {
    const pickaxe = rollPickaxe(luck, locationIdx);
    drops.push({ type: 'pickaxe', pickaxeId: pickaxe.id, rarity: pickaxe.rarity });
  }

  if (Math.random() < 0.08 + lootFind * 0.2 + luck * 0.05) {
    const fortune = rollFortune(luck, locationIdx);
    drops.push({ type: 'fortune', fortuneId: fortune.id, rarity: fortune.rarity });
  }

  return drops;
}

function rollRarity(luck: number): Rarity {
  const roll = Math.random();
  const luckBonus = luck * 0.3;
  if (roll < 0.01 + luckBonus * 0.1) return 'legendary';
  if (roll < 0.05 + luckBonus * 0.3) return 'epic';
  if (roll < 0.20 + luckBonus * 0.5) return 'rare';
  if (roll < 0.50 + luckBonus * 0.3) return 'improved';
  return 'common';
}

function rollPickaxe(luck: number, locationIdx: number): Pickaxe {
  const rarity = rollRarity(luck);
  const maxIdx = Math.min(PICKAXES.length - 1, 2 + locationIdx * 2);
  const candidates = PICKAXES.slice(0, maxIdx + 1).filter((p) => p.rarity === rarity);
  if (candidates.length === 0) {
    const fallback = PICKAXES.slice(0, maxIdx + 1);
    return fallback[Math.floor(Math.random() * fallback.length)] ?? PICKAXES[0];
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function rollFortune(luck: number, _locationIdx: number): Fortune {
  const rarity = rollRarity(luck);
  const candidates = FORTUNES.filter((f) => f.rarity === rarity);
  if (candidates.length === 0) {
    return FORTUNES[Math.floor(Math.random() * FORTUNES.length)];
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// ─── Doge rival quotes (reactive + funny) ─────────────────────────────────────

export const DOGE_RIVAL_QUOTES = [
  'Much mine. Very wow.',
  'To the moon! 🚀 ...wait, no. To the stars!',
  'Such ZION. Very bridge. Much secure.',
  'Wow. Much hashpower. Very impress.',
  'Doge not impressed. Yet. Maybe soon. Possibly.',
  '1 sig? Doge laughs. Ha. Very laugh. Such single.',
  '5/5 multisig? Overkill? No. Very safe. Much paranoid.',
  'Much block. Very chain. Such consensus.',
  'Such idle. Very passive. Much lazy. Wow.',
  'Wow. You mine fast. Doge mine faster. Maybe. Probably.',
  'Very staking. Much yield. Such APY. Wow.',
  'Doge rally incoming... very soon... maybe... ok no.',
  'To the stars! Not the moon. Stars. Very far. Much lightyear.',
  'Such click. Very tap. Much finger. Wow. Carpal tunnel?',
  'Doge see you mining. Doge not worried. Very calm. Such chill.',
  'Much rock. Very break. Such smash. Wow.',
  'Doge has 1 job. Mine. Very simple. Such focused.',
  'Wow. You buy helper? Doge IS the helper. Very self-sufficient.',
  'Such loot. Very box. Much random. Wow. RNGesus bless.',
  'Doge mining since 2013. Very veteran. Much OG. Such experience.',
  'Much diamond. Very shiny. Such carbon. Wow.',
  'Doge not compete. Doge just vibe. Very zen. Such peaceful mining.',
  'Wow. You reached L2? Doge still on Earth. Very comfortable. Such home.',
  'Such progress. Very speed. Doge impressed. Maybe. A little.',
  'Much fortune. Very luck. Such blessed. Wow.',
  'Doge see your DPS. Doge not scared. Very brave. Such fearless.',
];

// ─── Doge rival reactions (triggered by events) ───────────────────────────────

export const DOGE_REACTIONS = {
  firstHelper: 'Wow! You hire friend! Very teamwork. Such cooperation. Doge approve. 👍',
  rockBreak: 'Much smash! Very break! Such destruction! Wow! 💥',
  legendaryLoot: 'LEGENDARY?! Very rare! Much lucky! Doge jealous. Very jealous. 😤',
  newLocation: 'New planet? Very explore! Much adventure! Doge want come too! 🌍',
  critHit: 'CRIT! Very damage! Much ouch! Poor rock. Such pain. ⚡',
  diamondDrop: 'Diamond! Very shiny! Much precious! Doge want bite. Very tempting. 💎',
  dogeAhead: 'Doge ahead! Very lead! Much faster! Such winning! Wow! 🏆',
  playerAhead: 'You ahead?! Very fast! Much speed! Doge concerned. Very worried. 😟',
  bigMilestone: 'MUCH MILESTONE! VERY ACHIEVE! SUCH PROGRESS! WOW! 🎉',
};

// ─── Achievements ─────────────────────────────────────────────────────────────

export interface Achievement {
  id: string;
  name: string;
  emoji: string;
  description: string;
  check: (state: { totalEarned: number; clicks: number; helpers: Record<string, { count: number }>; diamonds: number; ownedPickaxes: string[]; ownedFortunes: string[]; currentLocation: number; rockNumber: number }) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-click', name: 'Much Click', emoji: '👆', description: 'Mine your first ZION. Very first. Such click.', check: (s) => s.clicks >= 1 },
  { id: 'first-helper', name: 'Such Teamwork', emoji: '🐕', description: 'Hire your first helper. Very friend. Much cooperation.', check: (s) => Object.values(s.helpers).some((h) => h.count > 0) },
  { id: '100-clicks', name: 'Much Tap', emoji: '📱', description: '100 clicks. Very finger. Such stamina. Wow.', check: (s) => s.clicks >= 100 },
  { id: '1000-clicks', name: 'Carpal Tunnel', emoji: '🩺', description: '1000 clicks. Very ouch. Much repetitive. Such strain.', check: (s) => s.clicks >= 1000 },
  { id: 'first-diamond', name: 'Shiny!', emoji: '💎', description: 'Find your first diamond. Very precious. Much carbon.', check: (s) => s.diamonds >= 1 },
  { id: 'first-pickaxe', name: 'Upgrade!', emoji: '⚒️', description: 'Find a pickaxe from loot. Very lucky. Much drop.', check: (s) => s.ownedPickaxes.length >= 2 },
  { id: 'first-fortune', name: 'Fortune Favors', emoji: '🔮', description: 'Find your first fortune. Very blessed. Much lucky.', check: (s) => s.ownedFortunes.length >= 1 },
  { id: '10-helpers', name: 'Much Pack', emoji: '🐺', description: 'Own 10 helpers total. Very team. Much squad.', check: (s) => Object.values(s.helpers).reduce((a, h) => a + h.count, 0) >= 10 },
  { id: '50-helpers', name: 'Very Army', emoji: '⚔️', description: 'Own 50 helpers total. Very legion. Much force.', check: (s) => Object.values(s.helpers).reduce((a, h) => a + h.count, 0) >= 50 },
  { id: '100-helpers', name: 'Such Empire', emoji: '🏰', description: 'Own 100 helpers total. Very empire. Much domain.', check: (s) => Object.values(s.helpers).reduce((a, h) => a + h.count, 0) >= 100 },
  { id: 'rock-10', name: 'Rock Smasher', emoji: '💥', description: 'Break 10 rocks. Very smash. Much break.', check: (s) => s.rockNumber >= 10 },
  { id: 'rock-100', name: 'Rock Annihilator', emoji: '🌋', description: 'Break 100 rocks. Very destroy. Much demolish.', check: (s) => s.rockNumber >= 100 },
  { id: 'rock-1000', name: 'Rock God', emoji: '🗿', description: 'Break 1000 rocks. Very deity. Much supreme. Such Moai.', check: (s) => s.rockNumber >= 1000 },
  { id: 'reach-l2', name: 'To The Base!', emoji: '⚡', description: 'Reach L2 / Base. Very layer. Much bridge.', check: (s) => s.currentLocation >= 1 },
  { id: 'reach-l3', name: 'Cosmic Mind', emoji: '🧠', description: 'Reach L3 / Hiran. Very aware. Much consciousness.', check: (s) => s.currentLocation >= 2 },
  { id: 'reach-l4', name: 'Desert Dweller', emoji: '🏜️', description: 'Reach L4 / Oasis. Very sandy. Much dry.', check: (s) => s.currentLocation >= 3 },
  { id: 'reach-l5', name: 'Freedom Fighter', emoji: '🗽', description: 'Reach L5 / Free World. Very liberty. Much free.', check: (s) => s.currentLocation >= 4 },
  { id: 'reach-l6', name: 'Royal Miner', emoji: '👑', description: 'Reach L6 / Issobella. Very majesty. Much crown. SUCH ENDGAME.', check: (s) => s.currentLocation >= 5 },
  { id: 'millionaire', name: 'ZION Millionaire', emoji: '💰', description: 'Earn 1M ZION total. Very rich. Much money.', check: (s) => s.totalEarned >= 1_000_000 },
  { id: 'billionaire', name: 'ZION Billionaire', emoji: '🏦', description: 'Earn 1B ZION total. Very wealthy. Much fortune.', check: (s) => s.totalEarned >= 1_000_000_000 },
  { id: 'trillionaire', name: 'ZION Trillionaire', emoji: '👑', description: 'Earn 1T ZION total. Very titan. Much whale. Such rich.', check: (s) => s.totalEarned >= 1_000_000_000_000 },
  { id: 'all-pickaxes', name: 'Collector', emoji: '🎒', description: 'Own all pickaxes. Very complete. Much collection.', check: (s) => s.ownedPickaxes.length >= PICKAXES.length },
  { id: 'all-fortunes', name: 'Fortune Teller', emoji: '🔮', description: 'Own all fortunes. Very oracle. Much destiny.', check: (s) => s.ownedFortunes.length >= FORTUNES.length },
  { id: '10-diamonds', name: 'Diamond Hoarder', emoji: '💎', description: 'Own 10 diamonds. Very shiny. Much bling.', check: (s) => s.diamonds >= 10 },
  { id: '50-diamonds', name: 'Diamond Whale', emoji: '🐋', description: 'Own 50 diamonds. Very rich. Much carbon. Such investment.', check: (s) => s.diamonds >= 50 },
];
