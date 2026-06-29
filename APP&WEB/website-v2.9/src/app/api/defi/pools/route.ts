/**
 * ZION DeFi — Pool Stats API
 *
 * Returns detailed stats for both Uniswap V3 pools:
 * - wZION/WETH (1% fee) — active two-sided liquidity
 * - wZION/USDC (0.3% fee) — single-sided (above price)
 *
 * For each pool: slot0 (sqrtPriceX96, tick), liquidity, fee, token balances,
 * TVL estimate, and NFT position info.
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

const RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';

// Pool addresses (Base Mainnet — created 2026-06-29)
const POOLS = {
  wzion_weth: {
    address: '0x18c0DaeF295E63F1bfBC7C39e71d0fabf4600699',
    fee: 10000,
    feeLabel: '1%',
    token0: '0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6', // wZION
    token1: '0x4200000000000000000000000000000000000006',  // WETH
    token0Symbol: 'wZION',
    token1Symbol: 'WETH',
    token0Decimals: 18,
    token1Decimals: 18,
    nftPositions: [
      { id: 5431093, type: 'single-sided', tickLower: -161000, tickUpper: -160000, wzion: 1_000_000 },
      { id: 5431714, type: 'two-sided', tickLower: -162000, tickUpper: -160000, wzion: 100_000, weth: 0.0069 },
    ],
  },
  wzion_usdc: {
    address: '0x5eBdC6E1D516f42EEB54f14faCF8715AbD5B9d8d',
    fee: 3000,
    feeLabel: '0.3%',
    token0: '0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6', // wZION
    token1: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',  // USDC
    token0Symbol: 'wZION',
    token1Symbol: 'USDC',
    token0Decimals: 18,
    token1Decimals: 6,
    nftPositions: [
      { id: 5431091, type: 'single-sided', tickLower: -361440, tickUpper: -360000, wzion: 1_000_000 },
    ],
  },
};

const CHAINLINK_WETH_USD = '0x71041dddad3595F9CEdDCDcF2012034b68dF6aFA';

// Function selectors
const SLOT0     = '0x3850c7bd';
const LIQUIDITY = '0x1a686502';
const BALANCE_OF = '0x70a08231'; // balanceOf(address)
const LATEST_ROUND_DATA = '0xfeaf968c';

async function ethCall(to: string, data: string): Promise<string | null> {
  try {
    const res = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to, data }, 'latest'] }),
      signal: AbortSignal.timeout(5000),
    });
    const json = await res.json();
    return json?.result ?? null;
  } catch {
    return null;
  }
}

function decodeSlot0(hex: string): { sqrtPriceX96: bigint; tick: number } {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const sqrtPriceX96 = BigInt('0x' + clean.slice(0, 64));
  // tick is int24, ABI-encoded as sign-extended to 256 bits
  const tickRaw = BigInt('0x' + clean.slice(64, 128));
  const tick24 = tickRaw & 0xFFFFFFn;
  const tick = tick24 >= 2n ** 23n ? Number(tick24 - 2n ** 24n) : Number(tick24);
  return { sqrtPriceX96, tick };
}

function decodeUint128(hex: string): bigint {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  return BigInt('0x' + clean.slice(0, 64));
}

function decodeChainlinkAnswer(hex: string): number {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const answer = BigInt('0x' + clean.slice(64, 128));
  const signed = answer >= 2n ** 255n ? answer - 2n ** 256n : answer;
  return Number(signed) / 1e8;
}

function encodeAddress(addr: string): string {
  return addr.toLowerCase().replace('0x', '').padStart(64, '0');
}

async function getPoolStats(poolConfig: typeof POOLS[keyof typeof POOLS], wethUsd: number) {
  const poolAddr = poolConfig.address;

  // Fetch slot0, liquidity, and token balances in parallel
  const [slot0Hex, liquidityHex, bal0Hex, bal1Hex] = await Promise.all([
    ethCall(poolAddr, SLOT0),
    ethCall(poolAddr, LIQUIDITY),
    ethCall(poolConfig.token0, BALANCE_OF + encodeAddress(poolAddr)),
    ethCall(poolConfig.token1, BALANCE_OF + encodeAddress(poolAddr)),
  ]);

  const liquidity = liquidityHex ? decodeUint128(liquidityHex) : 0n;
  const balance0 = bal0Hex ? BigInt(bal0Hex) : 0n;
  const balance1 = bal1Hex ? BigInt(bal1Hex) : 0n;

  let sqrtPriceX96 = 0n;
  let tick = 0;
  let active = false;

  if (slot0Hex) {
    try {
      const decoded = decodeSlot0(slot0Hex);
      sqrtPriceX96 = decoded.sqrtPriceX96;
      tick = decoded.tick;
      active = sqrtPriceX96 > 0n;
    } catch { /* decode failed */ }
  }

  // Calculate price
  const Q96 = 2n ** 96n;
  let priceToken1PerToken0 = 0;
  let priceUsd = 0;

  if (sqrtPriceX96 > 0n) {
    const sqrtNum = Number(sqrtPriceX96) / Number(Q96);
    priceToken1PerToken0 = sqrtNum * sqrtNum;

    if (poolConfig.token1Symbol === 'WETH') {
      priceUsd = priceToken1PerToken0 * wethUsd;
    } else if (poolConfig.token1Symbol === 'USDC') {
      priceUsd = priceToken1PerToken0; // USDC ≈ $1
    }
  }

  // Token balances in human-readable units
  const balance0Human = Number(balance0) / 10 ** poolConfig.token0Decimals;
  const balance1Human = Number(balance1) / 10 ** poolConfig.token1Decimals;

  // TVL: use token balances held by pool (actual deposited amounts)
  let tvlUsd = 0;
  if (poolConfig.token1Symbol === 'WETH') {
    tvlUsd = (balance1Human * wethUsd) + (balance0Human * priceUsd);
  } else if (poolConfig.token1Symbol === 'USDC') {
    tvlUsd = balance1Human + (balance0Human * priceUsd);
  }

  return {
    address: poolAddr,
    fee: poolConfig.fee,
    feeLabel: poolConfig.feeLabel,
    pair: `${poolConfig.token0Symbol}/${poolConfig.token1Symbol}`,
    token0: { address: poolConfig.token0, symbol: poolConfig.token0Symbol, decimals: poolConfig.token0Decimals },
    token1: { address: poolConfig.token1, symbol: poolConfig.token1Symbol, decimals: poolConfig.token1Decimals },
    active,
    sqrtPriceX96: sqrtPriceX96.toString(),
    tick,
    liquidity: liquidity.toString(),
    price: {
      token1_per_token0: priceToken1PerToken0,
      usd_per_wzion: priceUsd,
    },
    balances: {
      token0: balance0Human,
      token1: balance1Human,
    },
    tvl: {
      token0: balance0Human,
      token1: balance1Human,
      usd: tvlUsd,
    },
    nft_positions: poolConfig.nftPositions,
  };
}

export async function GET() {
  // Fetch Chainlink WETH/USD
  const wethUsdHex = await ethCall(CHAINLINK_WETH_USD, LATEST_ROUND_DATA);
  let wethUsd = 2000; // fallback
  if (wethUsdHex) {
    try { wethUsd = decodeChainlinkAnswer(wethUsdHex); } catch { /* keep fallback */ }
  }

  // Fetch both pool stats in parallel
  const [wethPool, usdcPool] = await Promise.all([
    getPoolStats(POOLS.wzion_weth, wethUsd),
    getPoolStats(POOLS.wzion_usdc, wethUsd),
  ]);

  return NextResponse.json({
    ok: true,
    network: 'base-mainnet',
    chainId: 8453,
    weth_usd: wethUsd,
    pools: {
      wzion_weth: wethPool,
      wzion_usdc: usdcPool,
    },
    summary: {
      total_tvl_usd: wethPool.tvl.usd + usdcPool.tvl.usd,
      total_wzion_liquidity: wethPool.balances.token0 + usdcPool.balances.token0,
      active_pools: (wethPool.active ? 1 : 0) + (usdcPool.active ? 1 : 0),
      total_nft_positions: wethPool.nft_positions.length + usdcPool.nft_positions.length,
    },
    fetchedAt: Date.now(),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=60' },
  });
}
