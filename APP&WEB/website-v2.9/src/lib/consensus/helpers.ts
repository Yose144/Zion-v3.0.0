/**
 * Shared consensus/economics helpers for the explorer.
 */

export interface ConsensusDecade {
  index: number;
  reward: number;
  blocks: number;
  share: string;
}

export interface ConsensusParameters {
  daa: string;
  target_block_time: number;
  pow_algorithms: string[];
  reward_split: {
    miner: number;
    humanitarian: number;
    issobella: number;
    pool_fee: number;
  };
  fee_burn: boolean;
  max_supply: number;
  tail_emission: number;
  decades: ConsensusDecade[];
}

export const CONSENSUS_PARAMS: ConsensusParameters = {
  daa: 'LWMA',
  target_block_time: 60,
  pow_algorithms: ['Deeksha Lite', 'Deeksha Lite Fire', 'Cosmic Harmony Ekam Deeksha v2'],
  reward_split: {
    miner: 89,
    humanitarian: 5,
    issobella: 5,
    pool_fee: 1,
  },
  fee_burn: true,
  max_supply: 144_000_000_000,
  tail_emission: 724.785,
  decades: [
    { index: 0, reward: 5400.067, blocks: 525_600, share: '20%' },
    { index: 1, reward: 4320.054, blocks: 525_600, share: '16%' },
    { index: 2, reward: 3456.043, blocks: 525_600, share: '12.8%' },
    { index: 3, reward: 2764.834, blocks: 525_600, share: '10.24%' },
    { index: 4, reward: 2211.867, blocks: 525_600, share: '8.19%' },
    { index: 5, reward: 1769.494, blocks: 525_600, share: '6.55%' },
    { index: 6, reward: 1415.595, blocks: 525_600, share: '5.24%' },
    { index: 7, reward: 1132.476, blocks: 525_600, share: '4.19%' },
    { index: 8, reward: 905.981, blocks: 525_600, share: '3.36%' },
    { index: 9, reward: 724.785, blocks: 525_600, share: '2.68%' },
    { index: 10, reward: 724.785, blocks: 0, share: 'Tail ∞' },
  ],
};

export interface ChartPoint {
  label: string;
  value: number;
}

export function buildDifficultyChart(
  headers: Array<{ timestamp: number; difficulty: number }>,
  rangeLabel: string,
): { labels: string[]; values: number[] } {
  return {
    labels: headers.map((h) => new Date(h.timestamp * 1000).toISOString()),
    values: headers.map((h) => h.difficulty),
  };
}
