/**
 * ZION DeFi — Price Feed API (Uni V3 spot)
 *
 * Reads slot0 from the wZION/WETH Uni V3 pool (1% fee, created 2026-06-29)
 * and computes the implied wZION price in WETH. Falls back to a cached
 * WETH/USD rate from Chainlink to provide an approximate USD price.
 *
 * Also reads pool liquidity() to compute TVL.
 *
 * Seed-price fallback ($0.0002 / ZION):
 *   When the pool sqrtPriceX96 is 0 (pool not yet seeded) or the pool call
 *   fails entirely, the API returns the official seed price so that the UI
 *   always has a sensible starting number to display.
 *
 * Seed price derivation (2026-06-29, ETH = $2000):
 *   sqrtPriceX96 = 25054144837504793613172736
 *   tick         = -161190
 *   usd_per_wzion = 0.000200
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

const RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';

// Contracts on Base Mainnet — updated 2026-06-29
const POOL_WETH  = '0x18c0DaeF295E63F1bfBC7C39e71d0fabf4600699';  // wZION/WETH 1% fee (ACTIVE liquidity)
const POOL_USDC  = '0x5eBdC6E1D516f42EEB54f14faCF8715AbD5B9d8d';  // wZION/USDC 0.3% fee (single-sided)
const WETH       = '0x4200000000000000000000000000000000000006';
const WZION       = '0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6';
const CHAINLINK_WETH_USD = '0x71041dddad3595F9CEdDCDcF2012034b68dF6aFA';

// ── Seed price constants (updated 2026-06-29) ─────────────────────────────────
const SEED_PRICE_USD       = 0.0002;
const SEED_ETH_USD         = 2000;
const SEED_PRICE_ETH       = SEED_PRICE_USD / SEED_ETH_USD; // = 1e-7
const SEED_SQRT_PRICE_X96  = '25054144837504793613172736';
const SEED_TICK            = -161190;

// ── Function selectors ────────────────────────────────────────────────────────
const SLOT0     = '0x3850c7bd';       // slot0()
const LIQUIDITY = '0x1a686502';       // liquidity()
const LATEST_ROUND_DATA = '0xfeaf968c'; // Chainlink latestRoundData()

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
  const tickRaw = BigInt('0x' + clean.slice(64, 128));
  const tick = tickRaw >= 2n ** 23n ? Number(tickRaw - 2n ** 24n) : Number(tickRaw);
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

function seedPriceResponse(wethUsd: number, source: 'seed-uninitialized' | 'seed-fallback', liquidity: bigint) {
  const ethUsd = wethUsd > 0 ? wethUsd : SEED_ETH_USD;
  return NextResponse.json({
    ok: true,
    network: 'base-mainnet',
    chainId: 8453,
    pool: POOL_WETH,
    pool_usdc: POOL_USDC,
    source,
    price: {
      wzion_per_weth: 1 / SEED_PRICE_ETH,
      weth_per_wzion: SEED_PRICE_ETH,
      usd_per_wzion:  SEED_PRICE_USD,
      weth_usd:       ethUsd,
      tick:           SEED_TICK,
      sqrtPriceX96:   SEED_SQRT_PRICE_X96,
    },
    liquidity: liquidity.toString(),
    tvl: {
      weth: 0,
      wzion: 0,
      usd: 0,
    },
    fetchedAt: Date.now(),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
  });
}

export async function GET() {
  // Fetch slot0, liquidity, and Chainlink WETH/USD in parallel
  const [slot0Hex, liquidityHex, wethUsdHex] = await Promise.all([
    ethCall(POOL_WETH, SLOT0),
    ethCall(POOL_WETH, LIQUIDITY),
    ethCall(CHAINLINK_WETH_USD, LATEST_ROUND_DATA),
  ]);

  let wethUsd = SEED_ETH_USD;
  if (wethUsdHex) {
    try { wethUsd = decodeChainlinkAnswer(wethUsdHex); } catch { /* keep seed ref */ }
  }

  const liquidity = liquidityHex ? decodeUint128(liquidityHex) : 0n;

  if (!slot0Hex) {
    return seedPriceResponse(wethUsd, 'seed-fallback', liquidity);
  }

  try {
    const { sqrtPriceX96, tick } = decodeSlot0(slot0Hex);

    if (sqrtPriceX96 === 0n) {
      return seedPriceResponse(wethUsd, 'seed-uninitialized', liquidity);
    }

    const Q96 = 2n ** 96n;

    // wZION (token0) < WETH (token1) by address
    // price = (sqrtPriceX96 / Q96)^2  →  WETH per wZION
    const sqrtNum = Number(sqrtPriceX96) / Number(Q96);
    const wethPerWzion = sqrtNum * sqrtNum;
    const wzionPerWeth = wethPerWzion > 0 ? 1 / wethPerWzion : 0;
    const usdPerWzion  = wethPerWzion * wethUsd;

    // TVL calculation from liquidity and sqrtPriceX96
    // For a Uni V3 pool at current price:
    //   amount0 (wZION) = L * (1/sqrtPrice - 1/sqrtPriceUpper)  [simplified for full range]
    //   amount1 (WETH)  = L * (sqrtPrice - sqrtPriceLower)      [simplified for full range]
    // For active liquidity at current tick, a rough TVL estimate:
    //   TVL_WETH ≈ L * sqrtPrice / Q96  (if price is in range)
    //   TVL_wZION ≈ L * Q96 / sqrtPrice
    // This is an approximation — exact values require tick range math.
    const sqrtPrice = Number(sqrtPriceX96) / Number(Q96);
    const tvlWeth = liquidity > 0n ? Number(liquidity) * sqrtPrice / 1e18 : 0;
    const tvlWzion = liquidity > 0n && sqrtPrice > 0 ? Number(liquidity) / sqrtPrice / 1e18 : 0;
    const tvlUsd = tvlWeth * wethUsd;

    return NextResponse.json({
      ok: true,
      network: 'base-mainnet',
      chainId: 8453,
      pool: POOL_WETH,
      pool_usdc: POOL_USDC,
      source: 'live',
      price: {
        wzion_per_weth: wzionPerWeth,
        weth_per_wzion: wethPerWzion,
        usd_per_wzion:  usdPerWzion,
        weth_usd:       wethUsd,
        tick,
        sqrtPriceX96:   sqrtPriceX96.toString(),
      },
      liquidity: liquidity.toString(),
      tvl: {
        weth: tvlWeth,
        wzion: tvlWzion,
        usd: tvlUsd,
      },
      fetchedAt: Date.now(),
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=60' },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Price decode failed' },
      { status: 502 },
    );
  }
}
