/**
 * ZION DeFi — Pool Stats API
 *
 * Returns detailed stats for all active Uniswap V3 pools on Base:
 * - wZION/USDT (0.3% fee) — primary stablecoin pair
 * - wZION/WETH (1% fee) — secondary volatile pair
 * - wZION/SOL (0.01% fee) — tertiary volatile pair
 *
 * For each pool: slot0 (sqrtPriceX96, tick), liquidity, fee, token balances,
 * TVL estimate, and NFT position info.
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

const RPC_URL = process.env.BASE_RPC_URL || 'https://base.publicnode.com';

// Pool addresses (Base Mainnet — updated 2026-08-18)
const POOLS = {
  wzion_usdt: {
    address: '0x186b46c2f04153999d44D25179cD623fD62Bfda2',
    fee: 3000,
    feeLabel: '0.3%',
    token0: '0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6', // wZION
    token1: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',  // USDT
    token0Symbol: 'wZION',
    token1Symbol: 'USDT',
    token0Decimals: 18,
    token1Decimals: 6,
    nftPositions: [
      { id: 5434637, type: 'two-sided', tickLower: -366600, tickUpper: -356580, wzion: 100_000, usdt: 3.14 },
    ],
  },
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
      { id: 5431714, type: 'depleted', tickLower: -162000, tickUpper: -160000, wzion: 0, weth: 0 },
      { id: 5434576, type: 'two-sided', tickLower: -164000, tickUpper: -158000, wzion: 200_000, weth: 0.020 },
    ],
  },
  wzion_sol: {
    address: '0xF38c56bbBBBC6d9FA11E7DE84bF7Bb70e1e8D2b3',
    fee: 100,
    feeLabel: '0.01%',
    token0: '0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6', // wZION
    token1: '0x311935Cd80B76769bF2ecC9D8Ab7635b2139cf82',  // SOL
    token0Symbol: 'wZION',
    token1Symbol: 'SOL',
    token0Decimals: 18,
    token1Decimals: 9,
    nftPositions: [
      { id: 5434872, type: 'two-sided', tickLower: -340387, tickUpper: -330387, wzion: 100_000, sol: 0.272 },
    ],
  },
};

const CHAINLINK_WETH_USD = '0x71041dddad3595F9CEdDCDcF2012034b68dF6aFA';
// SOL/USD fallback until Chainlink feed is wired in
const SOL_USD_FALLBACK = 73.44;

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

async function getPoolStats(poolConfig: typeof POOLS[keyof typeof POOLS], wethUsd: number, solUsd: number) {
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
    // Raw price is token1/token0 in raw units; adjust for decimals
    // human price = raw * 10^(token0Decimals - token1Decimals)
    const decimalAdjustment = 10 ** (poolConfig.token0Decimals - poolConfig.token1Decimals);
    priceToken1PerToken0 = sqrtNum * sqrtNum * decimalAdjustment;

    if (poolConfig.token1Symbol === 'WETH') {
      priceUsd = priceToken1PerToken0 * wethUsd;
    } else if (poolConfig.token1Symbol === 'USDT') {
      priceUsd = priceToken1PerToken0; // USDT ≈ $1
    } else if (poolConfig.token1Symbol === 'SOL') {
      priceUsd = priceToken1PerToken0 * solUsd;
    }
  }

  // Token balances in human-readable units
  const balance0Human = Number(balance0) / 10 ** poolConfig.token0Decimals;
  const balance1Human = Number(balance1) / 10 ** poolConfig.token1Decimals;

  // TVL: use token balances held by pool (actual deposited amounts)
  let tvlUsd = 0;
  if (poolConfig.token1Symbol === 'WETH') {
    tvlUsd = (balance1Human * wethUsd) + (balance0Human * priceUsd);
  } else if (poolConfig.token1Symbol === 'USDT') {
    tvlUsd = balance1Human + (balance0Human * priceUsd);
  } else if (poolConfig.token1Symbol === 'SOL') {
    tvlUsd = (balance1Human * solUsd) + (balance0Human * priceUsd);
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

  // SOL/USD fallback until Chainlink feed is wired in
  const solUsd = SOL_USD_FALLBACK;

  // Fetch all three pool stats in parallel
  const [usdtPool, wethPool, solPool] = await Promise.all([
    getPoolStats(POOLS.wzion_usdt, wethUsd, solUsd),
    getPoolStats(POOLS.wzion_weth, wethUsd, solUsd),
    getPoolStats(POOLS.wzion_sol, wethUsd, solUsd),
  ]);

  const pools = {
    wzion_usdt: usdtPool,
    wzion_weth: wethPool,
    wzion_sol: solPool,
  };

  const allPoolStats = [usdtPool, wethPool, solPool];

  return NextResponse.json({
    ok: true,
    network: 'base-mainnet',
    chainId: 8453,
    weth_usd: wethUsd,
    sol_usd: solUsd,
    primary_pool: 'wzion_usdt',
    pools,
    summary: {
      total_tvl_usd: allPoolStats.reduce((sum, p) => sum + p.tvl.usd, 0),
      total_wzion_liquidity: allPoolStats.reduce((sum, p) => sum + p.balances.token0, 0),
      active_pools: allPoolStats.filter((p) => p.active).length,
      total_nft_positions: allPoolStats.reduce((sum, p) => sum + p.nft_positions.length, 0),
    },
    fetchedAt: Date.now(),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=60' },
  });
}
