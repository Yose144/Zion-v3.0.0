/**
 * ZION DeFi — Price Feed API (Uni V3 spot)
 *
 * Reads slot0 from the primary wZION/USDT Uni V3 pool (0.3% fee) because
 * USDT is the most reliable/stable pair for pricing.
 *
 * ETH/USD price is fetched live from the Uniswap V3 WETH/USDC 0.3% pool
 * (high liquidity, reliable). Previously used a Chainlink oracle that was
 * not deployed at the configured address on Base, causing a hardcoded
 * $2000 fallback.
 *
 * Pools with zero liquidity are skipped to prevent stale prices from
 * empty (burned) pools being used for valuation.
 *
 * Seed-price fallback ($0.0002 / ZION):
 *   When the USDT pool sqrtPriceX96 is 0, has zero liquidity, or the pool
 *   call fails entirely, the API returns the official seed price so that
 *   the UI always has a sensible starting number to display.
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

const RPC_URL = process.env.BASE_RPC_URL || 'https://base.publicnode.com';

// Contracts on Base Mainnet — updated 2026-07-11
const POOL_USDT       = '0x186b46c2f04153999d44D25179cD623fD62Bfda2';  // wZION/USDT 0.3% fee — PRIMARY (only pool with liquidity)
const POOL_WETH_USDC  = '0x6c561B446416E1A00E8E93E221854d6eA4171372';  // WETH/USDC 0.3% fee — for live ETH/USD price
const WZION      = '0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6';
const WETH       = '0x4200000000000000000000000000000000000006';
const USDT       = '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2';
const USDC       = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// ── Seed price constants ─────────────────────────────────────────────────────
// Primary price source is wZION/USDT (USDT ≈ $1), so the seed sqrtPriceX96
// for that pool is sqrt(0.0002) * 2^96 = 1120455419495722778624, tick = -361501.
const SEED_PRICE_USD       = 0.0002;
const SEED_ETH_USD         = 2000;
const SEED_SQRT_PRICE_X96  = '1120455419495722778624';
const SEED_TICK            = -361501;

// Minimum liquidity threshold — pools below this are considered empty/stale
const MIN_LIQUIDITY = 1n;

// ── Function selectors ────────────────────────────────────────────────────────
const SLOT0     = '0x3850c7bd';       // slot0()
const LIQUIDITY = '0x1a686502';       // liquidity()
const BALANCE_OF = '0x70a08231';     // balanceOf(address)

function encodeAddress(addr: string): string {
  return addr.toLowerCase().replace('0x', '').padStart(64, '0');
}

async function ethCall(to: string, data: string): Promise<string | null> {
  try {
    const res = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
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
  // Mask to 24 bits, then interpret as signed int24
  const tick24 = tickRaw & 0xFFFFFFn;
  const tick = tick24 >= 2n ** 23n ? Number(tick24 - 2n ** 24n) : Number(tick24);
  return { sqrtPriceX96, tick };
}

function decodeUint128(hex: string): bigint {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  return BigInt('0x' + clean.slice(0, 64));
}

// Token decimals for price adjustment
const DECIMALS = {
  wzion: 18,
  usdt: 6,
  weth: 18,
  usdc: 6,
};

/**
 * Fetch live ETH/USD price from the Uniswap V3 WETH/USDC 0.3% pool.
 * This pool has deep liquidity on Base and provides a reliable spot price.
 * Falls back to SEED_ETH_USD if the call fails.
 */
async function fetchEthUsd(): Promise<number> {
  const slot0Hex = await ethCall(POOL_WETH_USDC, SLOT0);
  if (!slot0Hex) return SEED_ETH_USD;
  try {
    const { sqrtPriceX96 } = decodeSlot0(slot0Hex);
    if (sqrtPriceX96 === 0n) return SEED_ETH_USD;
    // WETH/USDC pool: token0 = WETH (18 dec), token1 = USDC (6 dec)
    // price = (sqrtPriceX96 / 2^96)^2 = USDC_raw per WETH_raw
    // human = price * 10^(18-6) = USDC per WETH = ETH/USD
    const ethUsd = priceFromSqrtPriceX96(sqrtPriceX96, DECIMALS.usdc, DECIMALS.weth);
    return ethUsd > 0 ? ethUsd : SEED_ETH_USD;
  } catch {
    return SEED_ETH_USD;
  }
}

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
    pool_fallback: null,
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
  // USDT pool: token1 = USDT (≈ $1), so TVL = USDT + wZION*price
  const tvlUsd = balance1Human + (balance0Human * usdPerWzion);

  return NextResponse.json({
    ok: true,
    network: 'base-mainnet',
    chainId: 8453,
    pool,
    pool_fallback: null,
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
    // Skip pools with zero liquidity — their sqrtPriceX96 is stale from initialization
    if (liquidity < MIN_LIQUIDITY) return null;
    const balance0 = bal0Hex ? BigInt(bal0Hex) : 0n;
    const balance1 = bal1Hex ? BigInt(bal1Hex) : 0n;
    return { pool: poolAddress, sqrtPriceX96, tick, liquidity, token0, token1, token0Decimals, token1Decimals, balance0, balance1 };
  } catch { return null; }
}

export async function GET() {
  // Fetch live ETH/USD from Uniswap V3 WETH/USDC pool (replaces broken Chainlink oracle)
  const wethUsd = await fetchEthUsd();

  // 1. Try primary USDT pool (USDT ≈ $1, most reliable)
  //    This is the ONLY wZION pool with active liquidity on Base.
  //    Empty pools (WETH, USDC, SOL) are skipped by tryPoolSnapshot due to liquidity check.
  const usdtSnapshot = await tryPoolSnapshot(POOL_USDT, WZION, USDT, DECIMALS.wzion, DECIMALS.usdt);
  if (usdtSnapshot) {
    return buildPriceResponse(POOL_USDT, usdtSnapshot.sqrtPriceX96, usdtSnapshot.tick, usdtSnapshot.liquidity, 1, 'live-usdt', wethUsd, DECIMALS.wzion, DECIMALS.usdt, usdtSnapshot.balance0, usdtSnapshot.balance1);
  }

  // 2. Seed fallback — no pool with active liquidity found
  return seedPriceResponse(wethUsd, 'seed-fallback', 0n);
}
