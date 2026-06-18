import {
  ATOMIC_UNITS_PER_ZION,
  BLOCK_REWARD_ZION,
  BLOCKS_PER_DECADE,
  BLOCKS_PER_YEAR,
  DECAY_FACTOR,
  GENESIS_PREMINE_ZION,
  MAX_DECAY_DECADES,
  MINING_HORIZON_LABEL,
  TAIL_REWARD_ZION,
  TOTAL_SUPPLY_ZION,
} from '@/lib/constants';

interface RpcSupplyClient {
  rpcCall<T = unknown>(method: string, params?: Record<string, unknown> | unknown[]): Promise<T>;
  getCoinbaseTxSum(height: number, count: number): Promise<{ emission_amount: number; fee_amount: number }>;
}

export interface SupplySnapshot {
  minedSupply: number;
  premineSupply: number;
  circulatingSupply: number;
  maxSupply: number;
  remainingSupply: number;
  emissionPct: number;
  estimatedYearsRemaining: number;
  estimatedFullEmissionDate: string;
  miningHorizonLabel: string;
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function estimateMinedSupplyAtHeight(height: number): number {
  let remainingBlocks = Math.max(0, Math.floor(height));
  let minedSupply = 0;
  let decadeIndex = 0;

  while (remainingBlocks > 0 && decadeIndex < MAX_DECAY_DECADES) {
    const blocksThisDecade = Math.min(remainingBlocks, BLOCKS_PER_DECADE);
    const reward = BLOCK_REWARD_ZION * Math.pow(DECAY_FACTOR, decadeIndex);
    minedSupply += blocksThisDecade * reward;
    remainingBlocks -= blocksThisDecade;
    decadeIndex += 1;
  }

  if (remainingBlocks > 0) {
    minedSupply += remainingBlocks * TAIL_REWARD_ZION;
  }

  const maxMineableSupply = Math.max(0, TOTAL_SUPPLY_ZION - GENESIS_PREMINE_ZION);
  return clamp(minedSupply, 0, maxMineableSupply);
}

export function estimateCirculatingSupplyAtHeight(height: number, premineSupply = GENESIS_PREMINE_ZION): number {
  const circulatingSupply = premineSupply + estimateMinedSupplyAtHeight(height);
  return clamp(circulatingSupply, 0, TOTAL_SUPPLY_ZION);
}

export function estimateRemainingMiningYears(chainHeight: number, minedSupply: number, premineSupply = GENESIS_PREMINE_ZION): number {
  const maxMineableSupply = Math.max(0, TOTAL_SUPPLY_ZION - premineSupply);
  let remainingMineable = Math.max(0, maxMineableSupply - minedSupply);

  if (remainingMineable <= 0) {
    return 0;
  }

  let blocksRemaining = 0;
  let currentHeight = Math.max(0, chainHeight);
  let decadeIndex = currentHeight > 0 ? Math.floor((currentHeight - 1) / BLOCKS_PER_DECADE) : 0;

  while (decadeIndex < MAX_DECAY_DECADES && remainingMineable > 0) {
    const reward = BLOCK_REWARD_ZION * Math.pow(DECAY_FACTOR, decadeIndex);
    const decadeStartHeight = decadeIndex * BLOCKS_PER_DECADE;
    const blocksProducedThisDecade = Math.max(0, currentHeight - decadeStartHeight);
    const blocksLeftThisDecade = Math.max(0, BLOCKS_PER_DECADE - blocksProducedThisDecade);

    if (blocksLeftThisDecade === 0) {
      decadeIndex += 1;
      currentHeight = decadeIndex * BLOCKS_PER_DECADE;
      continue;
    }

    const supplyLeftThisDecade = blocksLeftThisDecade * reward;
    if (remainingMineable <= supplyLeftThisDecade) {
      blocksRemaining += remainingMineable / reward;
      return blocksRemaining / BLOCKS_PER_YEAR;
    }

    blocksRemaining += blocksLeftThisDecade;
    remainingMineable -= supplyLeftThisDecade;
    decadeIndex += 1;
    currentHeight = decadeIndex * BLOCKS_PER_DECADE;
  }

  if (remainingMineable > 0) {
    blocksRemaining += remainingMineable / TAIL_REWARD_ZION;
  }

  return blocksRemaining / BLOCKS_PER_YEAR;
}

export async function resolveSupplySnapshot(rpc: RpcSupplyClient, chainHeight: number): Promise<SupplySnapshot> {
  const estimatedMinedSupply = Math.max(0, chainHeight * BLOCK_REWARD_ZION);
  let premineSupply = GENESIS_PREMINE_ZION;
  let minedSupply = estimatedMinedSupply;

  try {
    const supplyInfo = await rpc.rpcCall<Record<string, unknown>>('getSupplyInfo');
    const reportedPremine = asFiniteNumber(supplyInfo?.premine);
    if (reportedPremine != null && reportedPremine >= 0) {
      premineSupply = reportedPremine;
    }

    const reportedMined =
      asFiniteNumber(supplyInfo?.mined_supply) ??
      asFiniteNumber(supplyInfo?.emission_amount);

    const reportedCirculating = asFiniteNumber(supplyInfo?.circulating_supply);
    const minedFromCirculating = reportedCirculating == null
      ? null
      : reportedCirculating > premineSupply
        ? reportedCirculating - premineSupply
        : reportedCirculating;

    const minedCandidate = reportedMined ?? minedFromCirculating;
    if (minedCandidate != null && minedCandidate >= 0) {
      minedSupply = minedCandidate;
    }
  } catch {
    // Fall through to emission or height-based estimate.
  }

  if (minedSupply === estimatedMinedSupply && chainHeight > 0) {
    try {
      const emission = await rpc.getCoinbaseTxSum(0, chainHeight);
      const candidate = emission.emission_amount / ATOMIC_UNITS_PER_ZION;
      if (Number.isFinite(candidate) && candidate > 0) {
        minedSupply = candidate;
      }
    } catch {
      // Keep estimated mined supply.
    }
  }

  const maxMineableSupply = Math.max(0, TOTAL_SUPPLY_ZION - premineSupply);
  minedSupply = clamp(minedSupply, 0, maxMineableSupply);

  const circulatingSupply = clamp(premineSupply + minedSupply, 0, TOTAL_SUPPLY_ZION);
  const remainingSupply = Math.max(0, TOTAL_SUPPLY_ZION - circulatingSupply);
  const emissionPct = (circulatingSupply / TOTAL_SUPPLY_ZION) * 100;
  const estimatedYearsRemaining = estimateRemainingMiningYears(chainHeight, minedSupply, premineSupply);
  const estimatedFullEmissionDate = new Date(
    Date.now() + estimatedYearsRemaining * 365.25 * 24 * 60 * 60 * 1000,
  ).toISOString().split('T')[0];

  return {
    minedSupply,
    premineSupply,
    circulatingSupply,
    maxSupply: TOTAL_SUPPLY_ZION,
    remainingSupply,
    emissionPct,
    estimatedYearsRemaining,
    estimatedFullEmissionDate,
    miningHorizonLabel: MINING_HORIZON_LABEL,
  };
}