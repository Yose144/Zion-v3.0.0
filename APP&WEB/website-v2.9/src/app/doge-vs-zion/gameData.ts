// ─── ZION Defense — Tower Defense Game Data ───────────────────────────────────
// Defend the ZION node across L1→L6 layers

// ─── Types ────────────────────────────────────────────────────────────────────

export type TowerType = 'validator' | 'firewall' | 'bridge' | 'mining-rig' | 'guardian' | 'deeksha';
export type EnemyType = 'spam' | 'mev' | 'attacker' | 'exploiter' | 'quantum' | 'boss';
export type DamageType = 'physical' | 'fire' | 'ice' | 'energy' | 'pure';

export interface TowerDef {
  type: TowerType;
  name: string;
  emoji: string;
  description: string;
  cost: number;
  damage: number;
  range: number;       // in grid cells
  fireRate: number;    // shots per second
  damageType: DamageType;
  projectileSpeed: number;
  color: string;
  glowColor: string;
  splash?: number;     // splash radius (0 = none)
  slow?: number;       // slow factor 0-1 (0.5 = 50% speed)
  slowDuration?: number;
  income?: number;     // ZION per second (mining rig)
  auraBuff?: number;   // damage buff to nearby towers (1.1 = +10%)
  auraRange?: number;  // aura range in cells
  upgrades: TowerUpgradePath[];
}

export interface TowerUpgradePath {
  name: string;
  tiers: TowerUpgradeTier[];
}

export interface TowerUpgradeTier {
  cost: number;
  damageMult?: number;
  rangeMult?: number;
  fireRateMult?: number;
  splashAdd?: number;
  slowImprove?: number;
  incomeAdd?: number;
  auraBuffImprove?: number;
  description: string;
}

export interface EnemyDef {
  type: EnemyType;
  name: string;
  emoji: string;
  baseHp: number;
  speed: number;       // cells per second
  reward: number;      // ZION on kill
  damage: number;      // damage to node on reach
  color: string;
  size: number;        // radius in pixels
  resistances?: Partial<Record<DamageType, number>>; // 0.5 = takes 50% damage
  abilities?: EnemyAbility[];
}

export type EnemyAbility = 'heal' | 'shield' | 'split' | 'disable' | 'speed_boost';

export interface LevelDef {
  id: number;
  name: string;
  layer: string;
  emoji: string;
  description: string;
  path: { x: number; y: number }[];  // grid coordinates
  gridCols: number;
  gridRows: number;
  startZion: number;
  nodeHp: number;
  waves: WaveDef[];
  bgGradient: [string, string];
  pathColor: string;
  unlockAt: number; // level id to unlock (0 = always unlocked)
}

export interface WaveDef {
  enemies: { type: EnemyType; count: number; interval: number }[]; // interval in ms
  reward: number; // bonus ZION for clearing wave
}

// ─── Tower Definitions ────────────────────────────────────────────────────────

export const TOWERS: Record<TowerType, TowerDef> = {
  validator: {
    type: 'validator',
    name: 'Validator',
    emoji: '🛡️',
    description: '5/5 multisig validator. High damage, long range, slow fire rate. Consensus-based attacks.',
    cost: 100,
    damage: 25,
    range: 3.5,
    fireRate: 0.8,
    damageType: 'physical',
    projectileSpeed: 8,
    color: '#3b82f6',
    glowColor: '#60a5fa',
    upgrades: [
      {
        name: 'Consensus Path',
        tiers: [
          { cost: 80, damageMult: 1.5, description: '7/7 multisig — more validators, more damage' },
          { cost: 200, damageMult: 1.8, rangeMult: 1.2, description: 'Quantum signing — longer reach' },
          { cost: 500, damageMult: 2, rangeMult: 1.3, description: 'Quantum-resistant consensus — devastating' },
        ],
      },
      {
        name: 'Speed Path',
        tiers: [
          { cost: 80, fireRateMult: 1.5, description: 'Fast block validation' },
          { cost: 200, fireRateMult: 1.8, damageMult: 1.3, description: 'Sub-second finality' },
          { cost: 500, fireRateMult: 2.5, damageMult: 1.5, description: 'Instant finality — rapid fire' },
        ],
      },
    ],
  },
  firewall: {
    type: 'firewall',
    name: 'Firewall',
    emoji: '🔥',
    description: 'Rapid-fire wall. Short range, fast fire rate, splash damage. Burns through spam.',
    cost: 75,
    damage: 8,
    range: 2,
    fireRate: 4,
    damageType: 'fire',
    projectileSpeed: 12,
    color: '#ef4444',
    glowColor: '#f87171',
    splash: 0.5,
    upgrades: [
      {
        name: 'Inferno Path',
        tiers: [
          { cost: 60, damageMult: 1.5, splashAdd: 0.3, description: 'Wider blaze' },
          { cost: 150, damageMult: 2, splashAdd: 0.5, description: 'Firestorm' },
          { cost: 400, damageMult: 3, splashAdd: 1, description: 'Hellfire — massive AoE' },
        ],
      },
      {
        name: 'Rapid Path',
        tiers: [
          { cost: 60, fireRateMult: 1.6, description: 'Double filtering' },
          { cost: 150, fireRateMult: 2, damageMult: 1.3, description: 'Triple filtering' },
          { cost: 400, fireRateMult: 3, damageMult: 1.5, description: 'Quantum firewall — impossible to bypass' },
        ],
      },
    ],
  },
  bridge: {
    type: 'bridge',
    name: 'Bridge Node',
    emoji: '🌉',
    description: 'L1→L2 bridge relay. Slows enemies, medium damage. Crowd control specialist.',
    cost: 90,
    damage: 12,
    range: 2.5,
    fireRate: 1.5,
    damageType: 'ice',
    projectileSpeed: 6,
    color: '#06b6d4',
    glowColor: '#22d3ee',
    slow: 0.5,
    slowDuration: 2,
    upgrades: [
      {
        name: 'Frost Path',
        tiers: [
          { cost: 70, slowImprove: 0.15, description: 'Deeper freeze — 65% slow' },
          { cost: 180, slowImprove: 0.2, damageMult: 1.5, description: 'Absolute zero — 75% slow + damage' },
          { cost: 450, slowImprove: 0.25, damageMult: 2, rangeMult: 1.3, description: 'Cryo-bridge — 90% slow, huge range' },
        ],
      },
      {
        name: 'Relay Path',
        tiers: [
          { cost: 70, rangeMult: 1.4, fireRateMult: 1.3, description: 'Extended relay range' },
          { cost: 180, rangeMult: 1.6, fireRateMult: 1.5, description: 'Multi-relay — covers half the map' },
          { cost: 450, rangeMult: 2, fireRateMult: 2, description: 'Omni-relay — map-wide slow' },
        ],
      },
    ],
  },
  'mining-rig': {
    type: 'mining-rig',
    name: 'Mining Rig',
    emoji: '⛏️',
    description: 'Deeksha Lite miner. Generates ZION over time. No damage. Economy tower.',
    cost: 120,
    damage: 0,
    range: 0,
    fireRate: 0,
    damageType: 'pure',
    projectileSpeed: 0,
    color: '#f59e0b',
    glowColor: '#fbbf24',
    income: 5,
    upgrades: [
      {
        name: 'Hashrate Path',
        tiers: [
          { cost: 100, incomeAdd: 5, description: 'More GPUs — +5 ZION/s' },
          { cost: 250, incomeAdd: 10, description: 'ASIC upgrade — +10 ZION/s' },
          { cost: 600, incomeAdd: 25, description: 'Quantum mining — +25 ZION/s' },
        ],
      },
      {
        name: 'Efficiency Path',
        tiers: [
          { cost: 100, incomeAdd: 3, description: 'Optimized firmware — +3 ZION/s' },
          { cost: 250, incomeAdd: 8, description: 'Fire optimization — +8 ZION/s' },
          { cost: 600, incomeAdd: 20, description: 'Cosmic Harmony — +20 ZION/s' },
        ],
      },
    ],
  },
  guardian: {
    type: 'guardian',
    name: 'DAO Guardian',
    emoji: '🏛️',
    description: 'Governance guardian. Buffs nearby towers. Aura tower — no direct attack.',
    cost: 150,
    damage: 0,
    range: 0,
    fireRate: 0,
    damageType: 'pure',
    projectileSpeed: 0,
    color: '#a855f7',
    glowColor: '#c084fc',
    auraBuff: 1.15,
    auraRange: 2.5,
    upgrades: [
      {
        name: 'Buff Path',
        tiers: [
          { cost: 120, auraBuffImprove: 0.1, description: 'Governance vote — +25% buff' },
          { cost: 300, auraBuffImprove: 0.15, description: 'Treasury backing — +40% buff' },
          { cost: 700, auraBuffImprove: 0.25, description: 'Constitutional amendment — +65% buff' },
        ],
      },
      {
        name: 'Range Path',
        tiers: [
          { cost: 120, description: 'Wider governance — +1 range' },
          { cost: 300, description: 'Global governance — +2 range' },
          { cost: 700, description: 'Universal governance — +3 range' },
        ],
      },
    ],
  },
  deeksha: {
    type: 'deeksha',
    name: 'Deeksha Sentinel',
    emoji: '⚡',
    description: 'Ultimate defense. Massive damage, energy type, pierces resistances. Endgame tower.',
    cost: 300,
    damage: 50,
    range: 4,
    fireRate: 1.2,
    damageType: 'energy',
    projectileSpeed: 15,
    color: '#10b981',
    glowColor: '#34d399',
    splash: 0.8,
    upgrades: [
      {
        name: 'Power Path',
        tiers: [
          { cost: 250, damageMult: 1.8, description: 'Deeksha Lite Fire — inferno damage' },
          { cost: 600, damageMult: 2.5, splashAdd: 0.5, description: 'Cosmic Harmony — harmony blast' },
          { cost: 1500, damageMult: 4, splashAdd: 1, description: 'Genesis Deeksha — apocalyptic power' },
        ],
      },
      {
        name: 'Wisdom Path',
        tiers: [
          { cost: 250, rangeMult: 1.4, fireRateMult: 1.3, description: 'Hiran awareness — wider vision' },
          { cost: 600, rangeMult: 1.6, fireRateMult: 1.6, description: 'Enlightenment — supreme clarity' },
          { cost: 1500, rangeMult: 2, fireRateMult: 2, damageMult: 1.5, description: 'Transcendence — omniscient defense' },
        ],
      },
    ],
  },
};

// ─── Enemy Definitions ────────────────────────────────────────────────────────

export const ENEMIES: Record<EnemyType, EnemyDef> = {
  spam: {
    type: 'spam',
    name: 'Spam Transaction',
    emoji: '📨',
    baseHp: 30,
    speed: 1.5,
    reward: 8,
    damage: 1,
    color: '#94a3b8',
    size: 10,
  },
  mev: {
    type: 'mev',
    name: 'MEV Bot',
    emoji: '🤖',
    baseHp: 60,
    speed: 1.2,
    reward: 15,
    damage: 2,
    color: '#f59e0b',
    size: 12,
    resistances: { fire: 0.7 },
  },
  attacker: {
    type: 'attacker',
    name: '51% Attacker',
    emoji: '💀',
    baseHp: 150,
    speed: 0.8,
    reward: 30,
    damage: 5,
    color: '#dc2626',
    size: 14,
    resistances: { physical: 0.6 },
  },
  exploiter: {
    type: 'exploiter',
    name: 'Bridge Exploiter',
    emoji: '💻',
    baseHp: 100,
    speed: 1.0,
    reward: 25,
    damage: 3,
    color: '#7c3aed',
    size: 13,
    abilities: ['disable'],
    resistances: { ice: 0.5 },
  },
  quantum: {
    type: 'quantum',
    name: 'Quantum Hacker',
    emoji: '⚛️',
    baseHp: 200,
    speed: 1.8,
    reward: 50,
    damage: 4,
    color: '#06b6d4',
    size: 15,
    resistances: { physical: 0.3, fire: 0.3, ice: 0.5 },
  },
  boss: {
    type: 'boss',
    name: 'Genesis Thief',
    emoji: '👹',
    baseHp: 1000,
    speed: 0.6,
    reward: 200,
    damage: 20,
    color: '#be185d',
    size: 22,
    abilities: ['heal', 'shield', 'split'],
    resistances: { physical: 0.5, fire: 0.4, ice: 0.6 },
  },
};

// ─── Level Definitions (L1→L6) ────────────────────────────────────────────────

export const LEVELS: LevelDef[] = [
  // L1 — Earth
  {
    id: 0,
    name: 'Earth',
    layer: 'L1',
    emoji: '🌍',
    description: 'The genesis layer. Simple threats, gentle introduction.',
    gridCols: 16,
    gridRows: 10,
    startZion: 300,
    nodeHp: 20,
    unlockAt: 0,
    bgGradient: ['#0a1a0a', '#0d2818'],
    pathColor: '#1a3a1a',
    path: [
      { x: -1, y: 2 }, { x: 4, y: 2 }, { x: 4, y: 5 }, { x: 8, y: 5 },
      { x: 8, y: 2 }, { x: 12, y: 2 }, { x: 12, y: 7 }, { x: 16, y: 7 },
    ],
    waves: [
      { enemies: [{ type: 'spam', count: 8, interval: 800 }], reward: 50 },
      { enemies: [{ type: 'spam', count: 12, interval: 600 }], reward: 60 },
      { enemies: [{ type: 'spam', count: 8, interval: 500 }, { type: 'mev', count: 3, interval: 1000 }], reward: 80 },
      { enemies: [{ type: 'mev', count: 8, interval: 700 }], reward: 100 },
      { enemies: [{ type: 'spam', count: 15, interval: 400 }, { type: 'attacker', count: 2, interval: 1500 }], reward: 150 },
    ],
  },
  // L2 — Base
  {
    id: 1,
    name: 'Base',
    layer: 'L2',
    emoji: '⚡',
    description: 'Layer 2 — bridged to Base Mainnet. Bridge exploiters incoming.',
    gridCols: 16,
    gridRows: 10,
    startZion: 350,
    nodeHp: 18,
    unlockAt: 0,
    bgGradient: ['#0a0a1a', '#0d0d28'],
    pathColor: '#1a1a3a',
    path: [
      { x: -1, y: 1 }, { x: 3, y: 1 }, { x: 3, y: 4 }, { x: 6, y: 4 },
      { x: 6, y: 8 }, { x: 10, y: 8 }, { x: 10, y: 3 }, { x: 13, y: 3 },
      { x: 13, y: 6 }, { x: 16, y: 6 },
    ],
    waves: [
      { enemies: [{ type: 'spam', count: 10, interval: 600 }], reward: 60 },
      { enemies: [{ type: 'mev', count: 6, interval: 700 }, { type: 'exploiter', count: 2, interval: 1200 }], reward: 80 },
      { enemies: [{ type: 'spam', count: 15, interval: 400 }, { type: 'mev', count: 5, interval: 600 }], reward: 100 },
      { enemies: [{ type: 'exploiter', count: 6, interval: 800 }], reward: 120 },
      { enemies: [{ type: 'attacker', count: 4, interval: 1000 }, { type: 'mev', count: 8, interval: 500 }], reward: 180 },
      { enemies: [{ type: 'spam', count: 20, interval: 300 }, { type: 'attacker', count: 3, interval: 1200 }], reward: 220 },
    ],
  },
  // L3 — Hiran
  {
    id: 2,
    name: 'Hiran',
    layer: 'L3',
    emoji: '🧠',
    description: 'The cosmic mind layer. Consciousness-augmented threats.',
    gridCols: 18,
    gridRows: 11,
    startZion: 400,
    nodeHp: 15,
    unlockAt: 1,
    bgGradient: ['#1a0a1a', '#280d28'],
    pathColor: '#3a1a3a',
    path: [
      { x: -1, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 5 }, { x: 7, y: 5 },
      { x: 7, y: 1 }, { x: 11, y: 1 }, { x: 11, y: 8 }, { x: 14, y: 8 },
      { x: 14, y: 4 }, { x: 18, y: 4 },
    ],
    waves: [
      { enemies: [{ type: 'mev', count: 10, interval: 500 }], reward: 80 },
      { enemies: [{ type: 'exploiter', count: 6, interval: 700 }, { type: 'spam', count: 10, interval: 400 }], reward: 100 },
      { enemies: [{ type: 'quantum', count: 3, interval: 1000 }], reward: 150 },
      { enemies: [{ type: 'attacker', count: 5, interval: 800 }, { type: 'exploiter', count: 5, interval: 600 }], reward: 180 },
      { enemies: [{ type: 'quantum', count: 5, interval: 800 }, { type: 'mev', count: 10, interval: 400 }], reward: 220 },
      { enemies: [{ type: 'spam', count: 25, interval: 250 }, { type: 'quantum', count: 4, interval: 700 }], reward: 280 },
      { enemies: [{ type: 'attacker', count: 6, interval: 600 }, { type: 'boss', count: 1, interval: 0 }], reward: 400 },
    ],
  },
  // L4 — Oasis
  {
    id: 3,
    name: 'Oasis',
    layer: 'L4',
    emoji: '🏜️',
    description: 'The data desert. Find the oasis, defend the aquifer.',
    gridCols: 18,
    gridRows: 11,
    startZion: 450,
    nodeHp: 15,
    unlockAt: 2,
    bgGradient: ['#2a1a0a', '#3a280d'],
    pathColor: '#3a2a1a',
    path: [
      { x: -1, y: 5 }, { x: 2, y: 5 }, { x: 2, y: 1 }, { x: 5, y: 1 },
      { x: 5, y: 9 }, { x: 9, y: 9 }, { x: 9, y: 3 }, { x: 12, y: 3 },
      { x: 12, y: 8 }, { x: 15, y: 8 }, { x: 15, y: 2 }, { x: 18, y: 2 },
    ],
    waves: [
      { enemies: [{ type: 'mev', count: 12, interval: 450 }], reward: 100 },
      { enemies: [{ type: 'exploiter', count: 8, interval: 500 }], reward: 120 },
      { enemies: [{ type: 'quantum', count: 6, interval: 600 }, { type: 'spam', count: 15, interval: 300 }], reward: 180 },
      { enemies: [{ type: 'attacker', count: 6, interval: 600 }, { type: 'quantum', count: 4, interval: 800 }], reward: 220 },
      { enemies: [{ type: 'exploiter', count: 10, interval: 400 }, { type: 'attacker', count: 4, interval: 800 }], reward: 280 },
      { enemies: [{ type: 'quantum', count: 8, interval: 500 }, { type: 'mev', count: 15, interval: 300 }], reward: 350 },
      { enemies: [{ type: 'spam', count: 30, interval: 200 }, { type: 'attacker', count: 5, interval: 500 }], reward: 400 },
      { enemies: [{ type: 'quantum', count: 6, interval: 600 }, { type: 'boss', count: 1, interval: 0 }], reward: 600 },
    ],
  },
  // L5 — Free World
  {
    id: 4,
    name: 'Free World',
    layer: 'L5',
    emoji: '🗽',
    description: 'The liberated financial layer. Freedom isn\'t free — defend it.',
    gridCols: 20,
    gridRows: 12,
    startZion: 500,
    nodeHp: 12,
    unlockAt: 3,
    bgGradient: ['#0a1a2a', '#0d2838'],
    pathColor: '#1a3a5a',
    path: [
      { x: -1, y: 3 }, { x: 3, y: 3 }, { x: 3, y: 9 }, { x: 6, y: 9 },
      { x: 6, y: 1 }, { x: 10, y: 1 }, { x: 10, y: 10 }, { x: 14, y: 10 },
      { x: 14, y: 4 }, { x: 17, y: 4 }, { x: 17, y: 8 }, { x: 20, y: 8 },
    ],
    waves: [
      { enemies: [{ type: 'quantum', count: 8, interval: 500 }], reward: 150 },
      { enemies: [{ type: 'attacker', count: 8, interval: 500 }, { type: 'exploiter', count: 6, interval: 600 }], reward: 200 },
      { enemies: [{ type: 'quantum', count: 10, interval: 400 }, { type: 'spam', count: 20, interval: 250 }], reward: 250 },
      { enemies: [{ type: 'attacker', count: 10, interval: 400 }, { type: 'quantum', count: 6, interval: 600 }], reward: 300 },
      { enemies: [{ type: 'exploiter', count: 12, interval: 350 }, { type: 'attacker', count: 6, interval: 600 }], reward: 350 },
      { enemies: [{ type: 'quantum', count: 12, interval: 350 }, { type: 'mev', count: 20, interval: 250 }], reward: 400 },
      { enemies: [{ type: 'spam', count: 40, interval: 150 }, { type: 'quantum', count: 8, interval: 400 }], reward: 500 },
      { enemies: [{ type: 'attacker', count: 10, interval: 400 }, { type: 'boss', count: 1, interval: 0 }, { type: 'quantum', count: 5, interval: 600 }], reward: 800 },
    ],
  },
  // L6 — Issobella
  {
    id: 5,
    name: 'Issobella',
    layer: 'L6',
    emoji: '👑',
    description: 'The final frontier. Royal defense. Multiple bosses. Good luck.',
    gridCols: 20,
    gridRows: 12,
    startZion: 600,
    nodeHp: 10,
    unlockAt: 4,
    bgGradient: ['#2a0a1a', '#380d28'],
    pathColor: '#5a1a3a',
    path: [
      { x: -1, y: 6 }, { x: 2, y: 6 }, { x: 2, y: 1 }, { x: 6, y: 1 },
      { x: 6, y: 10 }, { x: 10, y: 10 }, { x: 10, y: 2 }, { x: 14, y: 2 },
      { x: 14, y: 9 }, { x: 17, y: 9 }, { x: 17, y: 4 }, { x: 20, y: 4 },
    ],
    waves: [
      { enemies: [{ type: 'quantum', count: 12, interval: 350 }], reward: 200 },
      { enemies: [{ type: 'attacker', count: 10, interval: 400 }, { type: 'exploiter', count: 10, interval: 350 }], reward: 250 },
      { enemies: [{ type: 'quantum', count: 15, interval: 300 }, { type: 'spam', count: 30, interval: 150 }], reward: 350 },
      { enemies: [{ type: 'boss', count: 1, interval: 0 }, { type: 'quantum', count: 8, interval: 400 }], reward: 500 },
      { enemies: [{ type: 'attacker', count: 15, interval: 300 }, { type: 'quantum', count: 10, interval: 350 }], reward: 450 },
      { enemies: [{ type: 'exploiter', count: 20, interval: 250 }, { type: 'attacker', count: 8, interval: 400 }], reward: 500 },
      { enemies: [{ type: 'quantum', count: 20, interval: 250 }, { type: 'mev', count: 30, interval: 150 }], reward: 600 },
      { enemies: [{ type: 'spam', count: 50, interval: 100 }, { type: 'quantum', count: 15, interval: 300 }], reward: 700 },
      { enemies: [{ type: 'attacker', count: 15, interval: 300 }, { type: 'boss', count: 2, interval: 2000 }], reward: 1000 },
      { enemies: [{ type: 'quantum', count: 20, interval: 200 }, { type: 'boss', count: 3, interval: 1500 }], reward: 1500 },
    ],
  },
];

// ─── Game Constants ───────────────────────────────────────────────────────────

export const CELL_SIZE = 42; // pixels per grid cell
export const CANVAS_PADDING = 20;

export const DAMAGE_COLORS: Record<DamageType, string> = {
  physical: '#3b82f6',
  fire: '#ef4444',
  ice: '#06b6d4',
  energy: '#10b981',
  pure: '#f59e0b',
};

export const DAMAGE_LABELS: Record<DamageType, string> = {
  physical: 'Consensus',
  fire: 'Fire',
  ice: 'Frost',
  energy: 'Energy',
  pure: 'Pure',
};

// ─── Helper Functions ─────────────────────────────────────────────────────────

export function getTowerStats(tower: TowerDef, upgradePath: number, upgradeTier: number) {
  let damage = tower.damage;
  let range = tower.range;
  let fireRate = tower.fireRate;
  let splash = tower.splash ?? 0;
  let slow = tower.slow ?? 0;
  let income = tower.income ?? 0;
  let auraBuff = tower.auraBuff ?? 1;
  let auraRange = tower.auraRange ?? 0;

  if (upgradeTier > 0 && tower.upgrades[upgradePath]) {
    for (let i = 0; i < upgradeTier; i++) {
      const tier = tower.upgrades[upgradePath].tiers[i];
      if (!tier) continue;
      if (tier.damageMult) damage *= tier.damageMult;
      if (tier.rangeMult) range *= tier.rangeMult;
      if (tier.fireRateMult) fireRate *= tier.fireRateMult;
      if (tier.splashAdd) splash += tier.splashAdd;
      if (tier.slowImprove) slow += tier.slowImprove;
      if (tier.incomeAdd) income += tier.incomeAdd;
      if (tier.auraBuffImprove) auraBuff += tier.auraBuffImprove;
    }
  }

  // Guardian range path: each tier adds +1 range
  if (tower.type === 'guardian' && upgradePath === 1) {
    auraRange = (tower.auraRange ?? 2.5) + upgradeTier;
  }

  return { damage, range, fireRate, splash, slow, income, auraBuff, auraRange };
}

export function getUpgradeCost(tower: TowerDef, upgradePath: number, currentTier: number): number {
  const path = tower.upgrades[upgradePath];
  if (!path || currentTier >= path.tiers.length) return 0;
  return path.tiers[currentTier].cost;
}

export function canUpgrade(tower: TowerDef, upgradePath: number, currentTier: number): boolean {
  const path = tower.upgrades[upgradePath];
  return !!path && currentTier < path.tiers.length;
}

export function getSellValue(tower: TowerDef, upgradePath: number, upgradeTier: number): number {
  let total = tower.cost;
  if (upgradeTier > 0 && tower.upgrades[upgradePath]) {
    for (let i = 0; i < upgradeTier; i++) {
      total += tower.upgrades[upgradePath].tiers[i]?.cost ?? 0;
    }
  }
  return Math.floor(total * 0.6); // 60% refund
}

// ─── Path helpers ─────────────────────────────────────────────────────────────

export function isOnPath(level: LevelDef, gridX: number, gridY: number): boolean {
  for (let i = 0; i < level.path.length - 1; i++) {
    const p1 = level.path[i];
    const p2 = level.path[i + 1];
    // Check if point is on segment p1->p2
    if (p1.x === p2.x) {
      // vertical segment
      const minY = Math.min(p1.y, p2.y);
      const maxY = Math.max(p1.y, p2.y);
      if (gridX === p1.x && gridY >= minY && gridY <= maxY) return true;
    } else if (p1.y === p2.y) {
      // horizontal segment
      const minX = Math.min(p1.x, p2.x);
      const maxX = Math.max(p1.x, p2.x);
      if (gridY === p1.y && gridX >= minX && gridX <= maxX) return true;
    }
  }
  return false;
}

export function getPathLength(level: LevelDef): number {
  let len = 0;
  for (let i = 0; i < level.path.length - 1; i++) {
    const p1 = level.path[i];
    const p2 = level.path[i + 1];
    len += Math.hypot(p2.x - p1.x, p2.y - p1.y);
  }
  return len;
}

// ─── Save/Load ────────────────────────────────────────────────────────────────

export interface SaveData {
  unlockedLevels: number[];
  levelStars: Record<number, number>; // levelId -> stars (0-3)
  totalZionEarned: number;
}

const SAVE_KEY = 'zion-defense-save';

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) return { unlockedLevels: [0], levelStars: {}, totalZionEarned: 0, ...JSON.parse(raw) };
  } catch { /* noop */ }
  return { unlockedLevels: [0], levelStars: {}, totalZionEarned: 0 };
}

export function saveSave(data: SaveData) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch { /* noop */ }
}
