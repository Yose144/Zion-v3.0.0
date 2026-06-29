/**
 * ZION DeFi — Price Feed API (Uni V3 spot)
 *
 * Reads slot0 from the primary wZION/USDT Uni V3 pool (0.3% fee) because
 * USDT is the most reliable/stable pair for pricing. Falls back to the
 * wZION/WETH pool if the USDT pool is uninitialized.
 *
 * Also reads pool liquidity() to compute TVL.
 *
 * Seed-price fallback ($0.0002 / ZION):
 *   When the pool sqrtPriceX96 is 0 (pool not yet seeded) or the pool call
 *   fails entirely, the API returns the official seed price so that the UI
 *   always has a sensible starting number to display.
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

const RPC_URL = process.env.BASE_RPC_URL || 'https://base.publicnode.com';

// Contracts on Base Mainnet — updated 2026-08-18
const POOL_USDT  = '0x186b46c2f04153999d44D25179cD623fD62Bfda2';  // wZION/USDT 0.3% fee — PRIMARY
const POOL_WETH  = '0x18c0DaeF295E63F1bfBC7C39e71d0fabf4600699';  // wZION/WETH 1% fee — fallback
const POOL_SOL   = '0xF38c56bbBBBC6d9FA11E7DE84bF7Bb70e1e8D2b3';  // wZION/SOL 0.01% fee — fallback
const WZION      = '0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6';
const WETH       = '0x4200000000000000000000000000000000000006';
const USDT       = '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2';
const SOL        = '0x311935Cd80B76769bF2ecC9D8Ab7635b2139cf82';
const CHAINLINK_WETH_USD = '0x71041dddad3595F9CEdDCDcF2012034b68dF6aFA';

// ── Seed price constants (updated 2026-08-18) ─────────────────────────────────
// Primary price source is wZION/USDT (USDT ≈ $1), so the seed sqrtPriceX96
// for that pool is sqrt(0.0002) * 2^96 = 1120455419495722778624, tick = -361501.
const SEED_PRICE_USD       = 0.0002;
const SEED_ETH_USD         = 2000;
const SEED_PRICE_ETH       = SEED_PRICE_USD / SEED_ETH_USD; // = 1e-7
const SEED_SQRT_PRICE_X96  = '1120455419495722778624';
const SEED_TICK            = -361501;

// ── Function selectors ────────────────────────────────────────────────────────
const SLOT0     = '0x3850c7bd';       // slot0()
const LIQUIDITY = '0x1a686502';       // liquidity()
const BALANCE_OF = '0x70a08231';     // balanceOf(address)
const LATEST_ROUND_DATA = '0xfeaf968c'; // Chainlink latestRoundData()

function encodeAddress(addr: string): string {
  return addr.toLowerCase().replace('0x', '').padStart(64, '0');
}

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

function hexToBigInt(hex: string | null): bigint {
  if (!hex || hex === '0x') return 0n;
  return BigInt(hex);
}

function decodeSlot0(hex: string): { sqrtPriceX96: bigint; tick: number } {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const sqrtPriceX96 = BigInt('0x' + clean.slice(0, 64));
  // tick is int24, ABI-encoded as sign-extended to 256 bits
  const tickRaw = BigInt('0x' + clean.slice(64, 128));
  // Mask to 24 bits, then interpret as signed int24
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

const SOL_USD_FALLBACK = 73.44;

// Token decimals for price adjustment
const DECIMALS = {
  wzion: 18,
  usdt: 6,
  weth: 18,
  sol: 9,
};

interface PoolPrice {
  pool: string;
  sqrtPriceX96: bigint;
  tick: number;
  liquidity: bigint;
}

function seedPriceResponse(wethUsd: number, source: 'seed-uninitialized' | 'seed-fallback', liquidity: bigint) {
  const ethUsd = wethUsd > 0 ? wethUsd : SEED_ETH_USD;
  return NextResponse.json({
    ok: true,
    network: 'base-mainnet',
    chainId: 8453,
    pool: POOL_USDT,
    pool_fallback: POOL_WETH,
    source,
    price: {
      usd_per_wzion:  SEED_PRICE_USD,
      weth_usd:       ethUsd,
      tick:           SEED_TICK,
      sqrtPriceX96:   SEED_SQRT_PRICE_X96,
    },
    liquidity: liquidity.toString(),
    tvl: {
      token1: 0,
      wzion: 0,
      usd: 0,
    },
    fetchedAt: Date.now(),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
  });
}

function priceFromSqrtPriceX96(sqrtPriceX96: bigint, token1Decimals: number, token0Decimals: number): number {
  const Q96 = 2n ** 96n;
  const sqrtNum = Number(sqrtPriceX96) / Number(Q96);
  const rawPrice = sqrtNum * sqrtNum; // token1 / token0 in raw units
  // Adjust for decimals: human price = raw * 10^(token0Decimals - token1Decimals)
  return rawPrice * 10 ** (token0Decimals - token1Decimals);
}

interface PoolSnapshot extends PoolPrice {
  token0: string;
  token1: string;
  token0Decimals: number;
  token1Decimals: number;
  balance0: bigint;
  balance1: bigint;
}

function buildPriceResponse(pool: string, sqrtPriceX96: bigint, tick: number, liquidity: bigint, token1Usd: number, source: string, wethUsd: number, token0Decimals: number, token1Decimals: number, balance0: bigint, balance1: bigint) {
  const token1PerWzion = priceFromSqrtPriceX96(sqrtPriceX96, token1Decimals, token0Decimals);
  const usdPerWzion = token1PerWzion * token1Usd;

  const balance0Human = Number(balance0) / 10 ** token0Decimals;
  const balance1Human = Number(balance1) / 10 ** token1Decimals;

  // TVL from actual pool balances (accurate)
  let tvlUsd = 0;
  if (pool === POOL_USDT) {
    tvlUsd = balance1Human + (balance0Human * usdPerWzion);
  } else if (pool === POOL_WETH) {
    tvlUsd = (balance1Human * wethUsd) + (balance0Human * usdPerWzion);
  } else if (pool === POOL_SOL) {
    tvlUsd = (balance1Human * SOL_USD_FALLBACK) + (balance0Human * usdPerWzion);
  }

  return NextResponse.json({
    ok: true,
    network: 'base-mainnet',
    chainId: 8453,
    pool,
    pool_fallback: POOL_WETH,
    source,
    price: {
      usd_per_wzion:  usdPerWzion,
      weth_usd:       wethUsd,
      tick,
      sqrtPriceX96:   sqrtPriceX96.toString(),
    },
    liquidity: liquidity.toString(),
    tvl: {
      token1: balance1Human,
      wzion: balance0Human,
      usd: tvlUsd,
    },
    fetchedAt: Date.now(),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=60' },
  });
}

async function tryPoolSnapshot(poolAddress: string, token0: string, token1: string, token0Decimals: number, token1Decimals: number): Promise<PoolSnapshot | null> {
  const [slot0Hex, liquidityHex, bal0Hex, bal1Hex] = await Promise.all([
    ethCall(poolAddress, SLOT0),
    ethCall(poolAddress, LIQUIDITY),
    ethCall(token0, BALANCE_OF + encodeAddress(poolAddress)),
    ethCall(token1, BALANCE_OF + encodeAddress(poolAddress)),
  ]);
  if (!slot0Hex) return null;
  try {
    const { sqrtPriceX96, tick } = decodeSlot0(slot0Hex);
    if (sqrtPriceX96 === 0n) return null;
    const liquidity = liquidityHex ? decodeUint128(liquidityHex) : 0n;
    const balance0 = bal0Hex ? BigInt(bal0Hex) : 0n;
    const balance1 = bal1Hex ? BigInt(bal1Hex) : 0n;
    return { pool: poolAddress, sqrtPriceX96, tick, liquidity, token0, token1, token0Decimals, token1Decimals, balance0, balance1 };
  } catch { return null; }
}

export async function GET() {
  // Fetch Chainlink WETH/USD (used for WETH fallback and display)
  const wethUsdHex = await ethCall(CHAINLINK_WETH_USD, LATEST_ROUND_DATA);
  let wethUsd = SEED_ETH_USD;
  if (wethUsdHex) {
    try { wethUsd = decodeChainlinkAnswer(wethUsdHex); } catch { /* keep seed ref */ }
  }

  // 1. Try primary USDT pool (USDT ≈ $1, most reliable)
  const usdtSnapshot = await tryPoolSnapshot(POOL_USDT, WZION, USDT, DECIMALS.wzion, DECIMALS.usdt);
  if (usdtSnapshot) {
    return buildPriceResponse(POOL_USDT, usdtSnapshot.sqrtPriceX96, usdtSnapshot.tick, usdtSnapshot.liquidity, 1, 'live-usdt', wethUsd, DECIMALS.wzion, DECIMALS.usdt, usdtSnapshot.balance0, usdtSnapshot.balance1);
  }

  // 2. Fallback to WETH pool
  const wethSnapshot = await tryPoolSnapshot(POOL_WETH, WZION, WETH, DECIMALS.wzion, DECIMALS.weth);
  if (wethSnapshot) {
    return buildPriceResponse(POOL_WETH, wethSnapshot.sqrtPriceX96, wethSnapshot.tick, wethSnapshot.liquidity, wethUsd, 'live-weth', wethUsd, DECIMALS.wzion, DECIMALS.weth, wethSnapshot.balance0, wethSnapshot.balance1);
  }

  // 3. Fallback to SOL pool
  const solSnapshot = await tryPoolSnapshot(POOL_SOL, WZION, SOL, DECIMALS.wzion, DECIMALS.sol);
  if (solSnapshot) {
    return buildPriceResponse(POOL_SOL, solSnapshot.sqrtPriceX96, solSnapshot.tick, solSnapshot.liquidity, SOL_USD_FALLBACK, 'live-sol', wethUsd, DECIMALS.wzion, DECIMALS.sol, solSnapshot.balance0, solSnapshot.balance1);
  }

  // 4. Seed fallback
  return seedPriceResponse(wethUsd, 'seed-fallback', 0n);
}
