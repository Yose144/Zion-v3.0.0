/**
 * ZION DeFi — Price Feed API (Uni V3 TWAP spot)
 *
 * Reads slot0 from the wZION/WETH Uni V3 pool and computes
 * the implied wZION price in WETH. Falls back to a cached
 * WETH/USD rate to provide an approximate USD price.
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

const RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';

// Contracts on Base Mainnet
const POOL = '0xa88C4C89EB4597Df2e29A8061895300FcDF44FBB';      // wZION/WETH 0.3%
const WETH = '0x4200000000000000000000000000000000000006';       // WETH
const WZION = '0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6';      // wZION
const CHAINLINK_WETH_USD = '0x71041dddad3595F9CEdDCDcF2012034b68dF6aFA'; // Base Mainnet

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

export async function GET() {
  try {
    const [slot0Hex, wethUsdHex] = await Promise.all([
      ethCall(POOL, SLOT0),
      ethCall(CHAINLINK_WETH_USD, LATEST_ROUND_DATA),
    ]);

    if (!slot0Hex) {
      return NextResponse.json({ ok: false, error: 'Pool slot0 call failed' }, { status: 502 });
    }

    const { sqrtPriceX96, tick } = decodeSlot0(slot0Hex);
    const Q96 = 2n ** 96n;

    // Determine token ordering
    // In Uni V3, token0 is the one with lower address
    const wzionIsToken0 = WZION.toLowerCase() < WETH.toLowerCase();

    // price = (sqrtPriceX96 / Q96) ^ 2
    // If wzion is token0, price = token1/token0 = WETH/wZION
    // We want wZION/WETH = 1 / price
    const priceRatioNum = Number(sqrtPriceX96) / Number(Q96);
    const priceToken1PerToken0 = priceRatioNum * priceRatioNum;

    let priceWZionPerWeth: number;
    if (wzionIsToken0) {
      // priceToken1PerToken0 = WETH per wZION
      priceWZionPerWeth = priceToken1PerToken0 > 0 ? 1 / priceToken1PerToken0 : 0;
    } else {
      // priceToken1PerToken0 = wZION per WETH
      priceWZionPerWeth = priceToken1PerToken0;
    }

    // WETH/USD from Chainlink
    let wethUsd = 0;
    if (wethUsdHex) {
      try { wethUsd = decodeChainlinkAnswer(wethUsdHex); } catch { /* ignore */ }
    }

    const priceUsd = wethUsd > 0 ? priceWZionPerWeth * wethUsd : 0;

    return NextResponse.json({
      ok: true,
      network: 'base-mainnet',
      chainId: 8453,
      pool: POOL,
      price: {
        wzion_per_weth: priceWZionPerWeth,
        weth_per_wzion: priceToken1PerToken0,
        usd_per_wzion: priceUsd,
        weth_usd: wethUsd,
        tick,
        sqrtPriceX96: sqrtPriceX96.toString(),
      },
      fetchedAt: Date.now(),
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=60' },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Price fetch failed' },
      { status: 502 },
    );
  }
}
