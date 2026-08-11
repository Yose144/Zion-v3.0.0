/**
 * Known ZION addresses used by the explorer (richlist, labels, etc).
 * Sourced from canonical genesis / V31 deployment config.
 */

export interface KnownAddress {
  address: string;
  type: 'premine' | 'miner' | 'pool' | 'dao' | 'humanitarian' | 'bridge';
  label: string;
  expected_balance_zion?: number;
  category?: string;
}

export const KNOWN_ADDRESSES: KnownAddress[] = [
  // OASIS + Golden Egg (5 slots × 1.65B = 8.25B)
  { address: 'zion1s0t7f8q680t4h6v7g240p4k7g2s0a4z8g3cc5h5', type: 'premine', label: 'ZION OASIS + Winners Golden Egg/XP (Slot 1)', expected_balance_zion: 1_650_000_000, category: 'oasis_golden_egg' },
  { address: 'zion1s7x735r6v86485k7t36008l682g777g3q8pu3q0', type: 'premine', label: 'ZION OASIS + Winners Golden Egg/XP (Slot 2)', expected_balance_zion: 1_650_000_000, category: 'oasis_golden_egg' },
  { address: 'zion1e0f4h6w3w394d4p355z2r440k4s2f6v5h4rl8f4', type: 'premine', label: 'ZION OASIS + Winners Golden Egg/XP (Slot 3)', expected_balance_zion: 1_650_000_000, category: 'oasis_golden_egg' },
  { address: 'zion1h7r3v595y3g0z3e3l8p005h4c6l7l6s4s2xh708', type: 'premine', label: 'ZION OASIS + Winners Golden Egg/XP (Slot 4)', expected_balance_zion: 1_650_000_000, category: 'oasis_golden_egg' },
  { address: 'zion1x535z563d3p6r6u3v6x0g0y445f507w8h6g8388', type: 'premine', label: 'ZION OASIS + Winners Golden Egg/XP (Slot 5)', expected_balance_zion: 1_650_000_000, category: 'oasis_golden_egg' },

  // DAO Treasury (3 slots = 4.0B)
  { address: 'zion1f5h5k6t8q3t3d8c5y667z6p2x8t3y3p8c7633g5', type: 'dao', label: 'DAO Treasury — Community Governance', expected_balance_zion: 2_500_000_000, category: 'dao_treasury' },
  { address: 'zion1s27490u7n823g098w42077h8f2n824w0y75w0s3', type: 'dao', label: 'DAO Treasury — Grants & Bounties', expected_balance_zion: 1_000_000_000, category: 'dao_treasury' },
  { address: 'zion1n0r7k274z3t030h4v4g3g5h704c737z658aa238', type: 'dao', label: 'DAO Treasury — Ecosystem Bootstrap', expected_balance_zion: 500_000_000, category: 'dao_treasury' },

  // Infrastructure (3 slots = 2.59B)
  { address: 'zion1k752909323x66062k5j7074096f003z095ax8m7', type: 'premine', label: 'Core Development Fund', expected_balance_zion: 1_000_000_000, category: 'infrastructure' },
  { address: 'zion1z3a4w726w5u4r4s4z644s8p897v4a2k045rt706', type: 'premine', label: 'Network Infrastructure — P2P Seed Nodes', expected_balance_zion: 1_000_000_000, category: 'infrastructure' },
  { address: 'zion122v8f8g55398f4g884k7j482h3z845j6c6ta4f8', type: 'premine', label: 'Genesis Projects — Dharma Temple, Piko de Ora + DAO', expected_balance_zion: 590_000_000, category: 'infrastructure' },

  // Humanitarian (1 slot = 1.44B)
  { address: 'zion1h6644748u5x6p4p784n6g2l7j77625w6a0k80s8', type: 'humanitarian', label: 'Children Future Fund — Humanitarian DAO', expected_balance_zion: 1_440_000_000, category: 'humanitarian' },

  // Bridge Seed Fund (0.4B)
  { address: 'zion1t6z3c0f0p3h0v233a3h432k5h764j0r3n5ml756', type: 'bridge', label: 'Bridge Seed Fund — EVM Bridge Liquidity', expected_balance_zion: 400_000_000, category: 'bridge_seed' },

  // Bridge Vault UTXO Seed (0.1B)
  { address: 'zion1j3w3h7k8m635h734y786j5804305m822t5uk546', type: 'bridge', label: 'Bridge Vault UTXO Seed — EVM Bridge Unlock Liquidity', expected_balance_zion: 100_000_000, category: 'bridge_vault_utxo' },

  // Canonical pool / coinbase recipients (operational, not premine)
  { address: 'zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6', type: 'pool', label: 'Canonical Pool Payout Wallet' },
  { address: 'zion1y3w4z0c755v4y7t3f0k6s54390x0h3k3y5hv8c8', type: 'humanitarian', label: 'Humanitarian Coinbase Recipient' },
  { address: 'zion1z4s3a54266f2x7j4x7c27297k49752t7k52l0f0', type: 'premine', label: 'Issobella Coinbase Recipient' },
  { address: 'zion1l0h428f536s6u3x7h5f0d5c2z644j7t8u8va3x0', type: 'pool', label: 'Pool Fee Wallet' },
];

export const KNOWN_ADDRESS_MAP = new Map<string, KnownAddress>(
  KNOWN_ADDRESSES.map((k) => [k.address, k])
);
