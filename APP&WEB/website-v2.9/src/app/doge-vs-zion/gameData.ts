// ─── Game Data for Doge vs ZION Idle Miner ────────────────────────────────────
// Inspired by Dogeminer 2, adapted to ZION ecosystem theme

// ─── Types ────────────────────────────────────────────────────────────────────

export type Rarity = 'common' | 'improved' | 'rare' | 'epic' | 'legendary';

export interface Stats {
  dpc: number;        // ZION per click
  dps: number;        // ZION per second (from helpers)
  critChance: number; // 0-1, chance for 2.5x click
  luck: number;       // 0-1, improves loot quality
  lootFind: number;   // 0-1, improves loot drop chance
  wow: number;        // 0-1, improves stats on found loot
}

export interface Helper {
  id: string;
  name: string;
  emoji: string;
  baseCost: number;
  baseDps: number;
  description: string;
  location: number; // index into LOCATIONS
  upgrades: HelperUpgrade[];
}

export interface HelperUpgrade {
  id: string;
  name: string;
  cost: number;
  diamonds: number;
  dpsMult: number; // multiplier applied to helper dps
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
  unlockAt: number; // total ZION earned to unlock
  rockBaseHp: number;
  rockReward: number; // ZION per rock cleared
  description: string;
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
    description: 'Where it all begins. Doge mining on home turf.',
    theme: 'doge',
  },
  {
    id: 'l2-base',
    name: 'L2 / Base',
    emoji: '⚡',
    unlockAt: 1_000_000,
    rockBaseHp: 5_000,
    rockReward: 10_000,
    description: 'Layer 2 — ZION bridged to Base Mainnet. 5/5 multisig secured.',
    theme: 'zion',
  },
  {
    id: 'l3-hiran',
    name: 'L3 / Hiran',
    emoji: '🧠',
    unlockAt: 100_000_000,
    rockBaseHp: 250_000,
    rockReward: 2_000_000,
    description: 'Hiranyagarbha — the cosmic mind layer. Consciousness mining.',
    theme: 'zion',
  },
  {
    id: 'l4-oasis',
    name: 'L4 / Oasis',
    emoji: '🏜️',
    unlockAt: 10_000_000_000,
    rockBaseHp: 10_000_000,
    rockReward: 500_000_000,
    description: 'The Oasis — infinite desert of data. Deep mining territory.',
    theme: 'zion',
  },
  {
    id: 'l5-free-world',
    name: 'L5 / Free World',
    emoji: '🗽',
    unlockAt: 1_000_000_000_000,
    rockBaseHp: 500_000_000,
    rockReward: 100_000_000_000,
    description: 'The Free World — liberated financial layer.',
    theme: 'zion',
  },
  {
    id: 'l6-issobella',
    name: 'L6 / Issobella',
    emoji: '👑',
    unlockAt: 100_000_000_000_000,
    rockBaseHp: 25_000_000_000,
    rockReward: 20_000_000_000_000,
    description: 'Issobella — the final frontier. Royal mining grounds.',
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
    description: 'A Shibe with a mining helmet. Very mine. Much wow.',
    location: 0,
    upgrades: [
      { id: 'shibe-fedora', name: 'Euphoria', cost: 1_000, diamonds: 1, dpsMult: 2, description: 'Replace helmets with fedoras for increased tipping.' },
      { id: 'shibe-gold-pick', name: 'Golden Pickaxes', cost: 3_500, diamonds: 1, dpsMult: 2, description: 'Golden pickaxes for golden mining.' },
      { id: 'shibe-salary', name: 'Salary Raise', cost: 32_500, diamonds: 1, dpsMult: 3, description: 'Better pay, better work ethic.' },
      { id: 'shibe-diamond-helm', name: 'Diamond Helmet', cost: 500_000, diamonds: 5, dpsMult: 5, description: 'Unbreakable diamond helmets.' },
    ],
  },
  {
    id: 'doge-kennels',
    name: 'Doge Kennels',
    emoji: '🏠🐕',
    baseCost: 400,
    baseDps: 5,
    description: 'Entire kennels to mine ZION. Very efficiency.',
    location: 0,
    upgrades: [
      { id: 'kennels-axes', name: 'More Axes', cost: 1_100, diamonds: 1, dpsMult: 2, description: 'More pickaxes for the kennels.' },
      { id: 'kennels-friendly', name: 'Friendlier Kennels', cost: 12_000, diamonds: 1, dpsMult: 2, description: 'Happier dogs mine harder.' },
      { id: 'kennels-micro-rockets', name: 'Micro-Rockets', cost: 42_000, diamonds: 1, dpsMult: 3, description: 'Attach micro-rockets. To the moon!' },
      { id: 'kennels-jetpacks', name: 'Jet Packs', cost: 3_000_000, diamonds: 5, dpsMult: 5, description: 'Jet-pack dogs. Need I say more?' },
    ],
  },
  {
    id: 'streamer-kittens',
    name: 'Streamer Kittens',
    emoji: '🐱🎮',
    baseCost: 12_000,
    baseDps: 50,
    description: 'Kittens streaming their mining sessions. Very viral.',
    location: 0,
    upgrades: [
      { id: 'kittens-better-stream', name: 'Better Stream Quality', cost: 50_000, diamonds: 1, dpsMult: 2, description: '1080p60 mining streams.' },
      { id: 'kittens-sponsor', name: 'Sponsorship Deals', cost: 500_000, diamonds: 2, dpsMult: 3, description: 'Sponsored mining is profitable mining.' },
      { id: 'kittens-merch', name: 'Merch Shop', cost: 5_000_000, diamonds: 3, dpsMult: 4, description: 'Mining kitten merch. It sells.' },
    ],
  },
  {
    id: 'space-rocket',
    name: 'Space Rocket',
    emoji: '🚀',
    baseCost: 500_000,
    baseDps: 500,
    description: 'A rocket that mines ZION in orbit. Unlocks L2!',
    location: 0,
    upgrades: [
      { id: 'rocket-fuel', name: 'Better Fuel', cost: 2_000_000, diamonds: 2, dpsMult: 2, description: 'Premium rocket fuel.' },
      { id: 'rocket-mars', name: 'Mars Capability', cost: 20_000_000, diamonds: 3, dpsMult: 3, description: 'Reach Mars and beyond.' },
    ],
  },

  // ── L2 / Base (ZION themed) ──
  {
    id: 'zion-validator',
    name: 'ZION Validator',
    emoji: '🛡️',
    baseCost: 5_000_000,
    baseDps: 5_000,
    description: '5/5 multisig validator node. Securing the network.',
    location: 1,
    upgrades: [
      { id: 'val-keys', name: 'More Validator Keys', cost: 25_000_000, diamonds: 3, dpsMult: 2, description: 'More keys, more security, more rewards.' },
      { id: 'val-staking', name: 'Staking Integration', cost: 200_000_000, diamonds: 5, dpsMult: 3, description: 'Stake rewards boost mining.' },
      { id: 'val-quantum', name: 'Quantum Signing', cost: 5_000_000_000, diamonds: 10, dpsMult: 5, description: 'Quantum-resistant signatures.' },
    ],
  },
  {
    id: 'bridge-node',
    name: 'Bridge Node',
    emoji: '🌉',
    baseCost: 50_000_000,
    baseDps: 25_000,
    description: 'L1→L2 bridge node. Locking and minting wZION.',
    location: 1,
    upgrades: [
      { id: 'bridge-relay', name: 'Fast Relay', cost: 250_000_000, diamonds: 3, dpsMult: 2, description: 'Faster bridge transactions.' },
      { id: 'bridge-multisig', name: '7/7 Multisig', cost: 2_000_000_000, diamonds: 5, dpsMult: 3, description: 'Upgrade from 5/5 to 7/7 multisig.' },
      { id: 'bridge-batch', name: 'Batch Processing', cost: 50_000_000_000, diamonds: 10, dpsMult: 5, description: 'Process 1000 locks per block.' },
    ],
  },
  {
    id: 'staking-pool',
    name: 'Staking Pool',
    emoji: '💧',
    baseCost: 500_000_000,
    baseDps: 150_000,
    description: 'DeFi staking pool. Yield farming ZION.',
    location: 1,
    upgrades: [
      { id: 'pool-rewards', name: 'Reward Boost', cost: 2_500_000_000, diamonds: 5, dpsMult: 2, description: 'notifyRewardAmount() finally called!' },
      { id: 'pool-compound', name: 'Auto-Compound', cost: 20_000_000_000, diamonds: 8, dpsMult: 3, description: 'Auto-compounding rewards.' },
      { id: 'pool-mega', name: 'Mega Pool', cost: 500_000_000_000, diamonds: 15, dpsMult: 5, description: 'The biggest staking pool in existence.' },
    ],
  },
  {
    id: 'dao-treasury',
    name: 'DAO Treasury',
    emoji: '🏛️',
    baseCost: 5_000_000_000,
    baseDps: 1_000_000,
    description: 'Governance treasury. Community-governed mining.',
    location: 1,
    upgrades: [
      { id: 'dao-vote', name: 'Voting Power', cost: 25_000_000_000, diamonds: 5, dpsMult: 2, description: 'More votes, more power.' },
      { id: 'dao-proposal', name: 'Mining Proposal', cost: 200_000_000_000, diamonds: 10, dpsMult: 3, description: 'DAO-approved mining operations.' },
      { id: 'dao-titan', name: 'Titan Treasury', cost: 5_000_000_000_000, diamonds: 20, dpsMult: 5, description: 'Treasury of titanic proportions.' },
    ],
  },

  // ── L3 / Hiran ──
  {
    id: 'hiran-miner',
    name: 'Hiran Miner',
    emoji: '🧙',
    baseCost: 50_000_000_000,
    baseDps: 10_000_000,
    description: 'Consciousness-augmented mining. Mind over matter.',
    location: 2,
    upgrades: [
      { id: 'hiran-focus', name: 'Deep Focus', cost: 250_000_000_000, diamonds: 10, dpsMult: 2, description: 'Meditation boosts mining output.' },
      { id: 'hiran-enlighten', name: 'Enlightenment', cost: 2_000_000_000_000, diamonds: 15, dpsMult: 3, description: 'Enlightened mining. Very zen.' },
      { id: 'hiran-transcend', name: 'Transcendence', cost: 50_000_000_000_000, diamonds: 25, dpsMult: 5, description: 'Beyond mining. Pure consciousness.' },
    ],
  },
  {
    id: 'consciousness-tree',
    name: 'Consciousness Tree',
    emoji: '🌳',
    baseCost: 500_000_000_000,
    baseDps: 100_000_000,
    description: 'Tree of Life mining ZION through roots of awareness.',
    location: 2,
    upgrades: [
      { id: 'tree-roots', name: 'Deeper Roots', cost: 2_500_000_000_000, diamonds: 15, dpsMult: 2, description: 'Roots reach the core of the planet.' },
      { id: 'tree-bloom', name: 'Eternal Bloom', cost: 20_000_000_000_000, diamonds: 20, dpsMult: 3, description: 'The tree blooms eternally.' },
      { id: 'tree-cosmic', name: 'Cosmic Tree', cost: 500_000_000_000_000, diamonds: 30, dpsMult: 5, description: 'A tree that spans the cosmos.' },
    ],
  },

  // ── L4 / Oasis ──
  {
    id: 'oasis-rig',
    name: 'Oasis Rig',
    emoji: '🏜️⚙️',
    baseCost: 5_000_000_000_000,
    baseDps: 1_000_000_000,
    description: 'Deep desert mining rig. Tapping the data aquifer.',
    location: 3,
    upgrades: [
      { id: 'oasis-deep', name: 'Deep Drilling', cost: 25_000_000_000_000, diamonds: 20, dpsMult: 2, description: 'Drill deeper into the data sands.' },
      { id: 'oasis-cooling', name: 'Cooling System', cost: 200_000_000_000_000, diamonds: 25, dpsMult: 3, description: 'Keep the rig cool in the desert heat.' },
      { id: 'oasis-mega', name: 'Mega Rig', cost: 5_000_000_000_000_000, diamonds: 40, dpsMult: 5, description: 'The largest rig in the Oasis.' },
    ],
  },

  // ── L5 / Free World ──
  {
    id: 'free-miner',
    name: 'Free Miner',
    emoji: '🗽⛏️',
    baseCost: 500_000_000_000_000,
    baseDps: 100_000_000_000,
    description: 'Liberated mining in the Free World.',
    location: 4,
    upgrades: [
      { id: 'free-liberty', name: 'Liberty Boost', cost: 2_500_000_000_000_000, diamonds: 30, dpsMult: 2, description: 'Freedom fuels mining.' },
      { id: 'free-justice', name: 'Justice System', cost: 20_000_000_000_000_000, diamonds: 40, dpsMult: 3, description: 'Fair mining for all.' },
    ],
  },

  // ── L6 / Issobella ──
  {
    id: 'issobella-royal',
    name: 'Royal Miner',
    emoji: '👑⛏️',
    baseCost: 50_000_000_000_000_000,
    baseDps: 10_000_000_000_000,
    description: 'Royal mining operations. The crown mines ZION.',
    location: 5,
    upgrades: [
      { id: 'royal-crown', name: 'Crown Jewels', cost: 250_000_000_000_000_000, diamonds: 50, dpsMult: 2, description: 'Mining with the power of the crown.' },
      { id: 'royal-empire', name: 'Royal Empire', cost: 2_000_000_000_000_000_000, diamonds: 75, dpsMult: 3, description: 'An empire of mining.' },
    ],
  },
];

// ─── Pickaxes (Mining Rigs) ───────────────────────────────────────────────────

export const PICKAXES: Pickaxe[] = [
  // Starting pickaxe
  { id: 'wooden', name: 'Wooden Pickaxe', emoji: '🪵', rarity: 'common', dpc: 1, critChance: 0, luck: 0, lootFind: 0, wow: 0 },
  // Loot-dropped pickaxes (sorted by power)
  { id: 'iron', name: 'Iron Pickaxe', emoji: '⚒️', rarity: 'common', dpc: 5, critChance: 0.02, luck: 0.01, lootFind: 0, wow: 0 },
  { id: 'steel', name: 'Steel Pickaxe', emoji: '🔨', rarity: 'improved', dpc: 25, critChance: 0.03, luck: 0.02, lootFind: 0.01, wow: 0.01 },
  { id: 'gpu-rx570', name: 'GPU Rig RX 570', emoji: '💻', rarity: 'improved', dpc: 100, critChance: 0.05, luck: 0.03, lootFind: 0.02, wow: 0.02 },
  { id: 'gpu-rtx4090', name: 'GPU Rig RTX 4090', emoji: '🖥️', rarity: 'rare', dpc: 500, critChance: 0.08, luck: 0.05, lootFind: 0.04, wow: 0.03 },
  { id: 'asic-s9', name: 'ASIC Miner S9', emoji: '⚙️', rarity: 'rare', dpc: 2_000, critChance: 0.10, luck: 0.07, lootFind: 0.06, wow: 0.05 },
  { id: 'asic-s19', name: 'ASIC Miner S19 Pro', emoji: '🔧', rarity: 'epic', dpc: 10_000, critChance: 0.12, luck: 0.10, lootFind: 0.08, wow: 0.07 },
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

export const RARITY_CONFIG: Record<Rarity, { color: string; label: string; dropWeight: number }> = {
  common: { color: 'text-gray-400', label: 'Common', dropWeight: 100 },
  improved: { color: 'text-green-400', label: 'Improved', dropWeight: 40 },
  rare: { color: 'text-blue-400', label: 'Rare', dropWeight: 15 },
  epic: { color: 'text-purple-400', label: 'Epic', dropWeight: 4 },
  legendary: { color: 'text-amber-400', label: 'Legendary', dropWeight: 1 },
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
  amount?: number;       // for coins/diamonds
  pickaxeId?: string;    // for pickaxe
  fortuneId?: string;    // for fortune
  rarity: Rarity;
}

// Rock HP thresholds where loot drops (like Dogeminer 2)
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

  // Coins always drop
  drops.push({ type: 'coins', amount: Math.ceil(baseCoinDrop), rarity: 'common' });

  // Diamond chance (rare, increases with luck)
  if (Math.random() < 0.05 + luck * 0.1) {
    drops.push({ type: 'diamonds', amount: 1 + Math.floor(Math.random() * 3), rarity: 'rare' });
  }

  // Pickaxe drop chance (based on lootFind + luck)
  if (Math.random() < 0.15 + lootFind * 0.3 + luck * 0.1) {
    const pickaxe = rollPickaxe(luck, locationIdx);
    drops.push({ type: 'pickaxe', pickaxeId: pickaxe.id, rarity: pickaxe.rarity });
  }

  // Fortune drop chance (rarer than pickaxe)
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
  // Filter pickaxes by rarity, and only allow pickaxes that are "appropriate" for the location
  const maxIdx = Math.min(PICKAXES.length - 1, 2 + locationIdx * 2);
  const candidates = PICKAXES.slice(0, maxIdx + 1).filter((p) => p.rarity === rarity);
  if (candidates.length === 0) {
    // Fallback: return a pickaxe of any rarity within range
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

// ─── Doge rival (flavor) ──────────────────────────────────────────────────────

export const DOGE_RIVAL_QUOTES = [
  'Much mine. Very wow.',
  'To the moon! 🚀',
  'Such ZION. Very bridge.',
  'Wow. Much hashpower.',
  'Doge not impressed. Yet.',
  '1 sig? Doge laughs. Ha.',
  '5/5 multisig? Doge has 1/1. Faster. Maybe.',
  'Much block. Very chain.',
  'Such idle. Very passive.',
  'Wow. You mine fast. Doge mine faster.',
  'Very staking. Much yield.',
  'Doge rally incoming...',
  'To the stars! Not the moon. Stars.',
];
