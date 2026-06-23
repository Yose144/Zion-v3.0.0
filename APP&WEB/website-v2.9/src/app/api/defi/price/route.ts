/**
 * ZION DeFi — Price Feed API (Uni V3 spot)
 *
 * Reads slot0 from the wZION/WETH Uni V3 pool and computes
 * the implied wZION price in WETH. Falls back to a cached
 * WETH/USD rate from Chainlink to provide an approximate USD price.
 *
 * Seed-price fallback ($0.00002 / ZION):
 *   When the pool sqrtPriceX96 is 0 (pool not yet seeded) or the pool call
 *   fails entirely, the API returns the official seed price so that the UI
 *   always has a sensible starting number to display.
 *
 * Seed price derivation (2026-06-24, ETH = $1 656):
 *   sqrtPriceX96 = 8_706_917_217_488_994_866_036_736
 *   tick         = -182_328
 *   usd_per_wzion = 0.000020
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

const RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';

// Contracts on Base Mainnet
const POOL = '0xa88C4C89EB4597Df2e29A8061895300FcDF44FBB';      // wZION/WETH 0.3%
const WETH = '0x4200000000000000000000000000000000000006';       // WETH
const WZION = '0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6';      // wZION
const CHAINLINK_WETH_USD = '0x71041dddad3595F9CEdDCDcF2012034b68dF6aFA'; // Base Mainnet

// ── Seed price constants (single source of truth) ─────────────────────────────
// If the pool has not been initialised yet, we serve the intended seed price
// so that all UIs show a consistent, correct starting value.
const SEED_PRICE_USD       = 0.00002;          // $0.00002 / wZION
const SEED_ETH_USD         = 1656;             // ETH/USD at derivation time
const SEED_PRICE_ETH       = SEED_PRICE_USD / SEED_ETH_USD; // ≈ 1.2077e-8
const SEED_SQRT_PRICE_X96  = '8706917217488994866036736';
const SEED_TICK            = -182328;

// slot0() selector
const SLOT0 = '0x3850c7bd';
// latestRoundData() selector for Chainlink
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

function hexToBigInt(hex: string | null): bigint {
  if (!hex || hex === '0x') return 0n;
  return BigInt(hex);
}

/**
 * Decode slot0 return data:
 * (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality,
 *  uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)
 * We only need sqrtPriceX96 (first 32 bytes after offset 0).
 */
function decodeSlot0(hex: string): { sqrtPriceX96: bigint; tick: number } {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const sqrtPriceX96 = BigInt('0x' + clean.slice(0, 64));
  const tickRaw = BigInt('0x' + clean.slice(64, 128));
  // int24 = signed 24-bit
  const tick = tickRaw >= 2n ** 23n ? Number(tickRaw - 2n ** 24n) : Number(tickRaw);
  return { sqrtPriceX96, tick };
}

/**
 * Decode Chainlink latestRoundData:
 * (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
 * answer is at bytes 32..64.
 */
function decodeChainlinkAnswer(hex: string): number {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const answer = BigInt('0x' + clean.slice(64, 128));
  // answer is int256, but for WETH/USD it's positive
  const signed = answer >= 2n ** 255n ? answer - 2n ** 256n : answer;
  return Number(signed) / 1e8; // Chainlink prices have 8 decimals
}

/** Build a seed-price response (pool not yet seeded or call failed). */
function seedPriceResponse(wethUsd: number, source: 'seed-uninitialized' | 'seed-fallback') {
  // At seed time wZION is token0, WETH is token1 → weth_per_wzion = SEED_PRICE_ETH
  const ethUsd = wethUsd > 0 ? wethUsd : SEED_ETH_USD;
  return NextResponse.json({
    ok: true,
    network: 'base-mainnet',
    chainId: 8453,
    pool: POOL,
    source,
    price: {
      wzion_per_weth: 1 / SEED_PRICE_ETH,         // ≈ 82,788,000 wZION per WETH
      weth_per_wzion: SEED_PRICE_ETH,              // ≈ 1.2077e-8
      usd_per_wzion:  SEED_PRICE_USD,              // $0.00002
      weth_usd:       ethUsd,
      tick:           SEED_TICK,                   // -182328
      sqrtPriceX96:   SEED_SQRT_PRICE_X96,
    },
    fetchedAt: Date.now(),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
  });
}

export async function GET() {
  // Always fetch Chainlink WETH/USD in parallel with pool slot0
  const [slot0Hex, wethUsdHex] = await Promise.all([
    ethCall(POOL, SLOT0),
    ethCall(CHAINLINK_WETH_USD, LATEST_ROUND_DATA),
  ]);

  // Parse Chainlink ETH/USD — fall back to seed reference rate if unavailable
  let wethUsd = SEED_ETH_USD;
  if (wethUsdHex) {
    try { wethUsd = decodeChainlinkAnswer(wethUsdHex); } catch { /* keep seed ref */ }
  }

  // If the pool slot0 call failed entirely, serve seed price
  if (!slot0Hex) {
    return seedPriceResponse(wethUsd, 'seed-fallback');
  }

  try {
    const { sqrtPriceX96, tick } = decodeSlot0(slot0Hex);

    // Pool not yet initialised (sqrtPriceX96 == 0) → serve seed price
    if (sqrtPriceX96 === 0n) {
      return seedPriceResponse(wethUsd, 'seed-uninitialized');
    }

    const Q96 = 2n ** 96n;

    // wZION (token0) < WETH (token1) by address
    // price = (sqrtPriceX96 / Q96)^2  →  WETH per wZION
    const sqrtNum = Number(sqrtPriceX96) / Number(Q96);
    const wethPerWzion = sqrtNum * sqrtNum;
    const wzionPerWeth = wethPerWzion > 0 ? 1 / wethPerWzion : 0;
    const usdPerWzion  = wethPerWzion * wethUsd;

    return NextResponse.json({
      ok: true,
      network: 'base-mainnet',
      chainId: 8453,
      pool: POOL,
      source: 'live',
      price: {
        wzion_per_weth: wzionPerWeth,
        weth_per_wzion: wethPerWzion,
        usd_per_wzion:  usdPerWzion,
        weth_usd:       wethUsd,
        tick,
        sqrtPriceX96:   sqrtPriceX96.toString(),
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
