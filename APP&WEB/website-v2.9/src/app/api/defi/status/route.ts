export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

const HEADERS = { 'Cache-Control': 'no-store, max-age=0' };

const RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';

// Minimal contract interfaces for on-chain reads
const CALLS = {
  // wZION
  totalSupply:    '0x18160ddd', // totalSupply()
  decimals:       '0x313ce567', // decimals()
  // Bridge
  threshold:      '0x42cde4e8', // threshold()
  validatorCount: '0x0f43a677', // validatorCount()
  // Uni V3 Pool
  slot0:          '0x3850c7bd', // slot0()
  liquidity:      '0x1a686502', // liquidity()
};

// Updated 2026-06-29 — new bridge + pool addresses
const CONTRACTS: Record<string, string> = {
  wZION:          '0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6',
  WETH:           '0x4200000000000000000000000000000000000006',
  USDC:           '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  ZIONBridge:     '0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467',
  UniV3PoolWETH:  '0x18c0DaeF295E63F1bfBC7C39e71d0fabf4600699', // wZION/WETH 1%
  UniV3PoolUSDC:  '0x5eBdC6E1D516f42EEB54f14faCF8715AbD5B9d8d', // wZION/USDC 0.3%
  UniV3Router:    '0x2626664c2603336E57B271c5C0b26F421741e481',
  UniV3Factory:   '0x33128a8fC17869897dcE68Ed026d694621f6FDfD',
};

const CHAINLINK_WETH_USD = '0x71041dddad3595F9CEdDCDcF2012034b68dF6aFA';
const LATEST_ROUND_DATA = '0xfeaf968c';

async function ethCall(to: string, data: string): Promise<string | null> {
  try {
    const res = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [{ to, data }, 'latest'],
      }),
      signal: AbortSignal.timeout(5000),
    });
    const json = await res.json();
    return json?.result ?? null;
  } catch {
    return null;
  }
}

function hexToNumber(hex: string | null): number {
  if (!hex || hex === '0x') return 0;
  return Number(BigInt(hex));
}

function hexToDecimal18(hex: string | null): string {
  if (!hex || hex === '0x') return '0';
  const raw = BigInt(hex);
  const whole = raw / BigInt(1e18);
  const frac = raw % BigInt(1e18);
  const fracStr = frac.toString().padStart(18, '0').slice(0, 4);
  return `${whole}.${fracStr}`;
}

function decodeSlot0Tick(hex: string): number {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const tickRaw = BigInt('0x' + clean.slice(64, 128));
  const tick24 = tickRaw & 0xFFFFFFn;
  return tick24 >= 2n ** 23n ? Number(tick24 - 2n ** 24n) : Number(tick24);
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

export async function GET() {
  try {
    const [
      totalSupplyHex,
      thresholdHex,
      validatorCountHex,
      slot0WethHex,
      liquidityWethHex,
      slot0UsdcHex,
      liquidityUsdcHex,
      wethUsdHex,
    ] = await Promise.all([
      ethCall(CONTRACTS.wZION, CALLS.totalSupply),
      ethCall(CONTRACTS.ZIONBridge, CALLS.threshold),
      ethCall(CONTRACTS.ZIONBridge, CALLS.validatorCount),
      ethCall(CONTRACTS.UniV3PoolWETH, CALLS.slot0),
      ethCall(CONTRACTS.UniV3PoolWETH, CALLS.liquidity),
      ethCall(CONTRACTS.UniV3PoolUSDC, CALLS.slot0),
      ethCall(CONTRACTS.UniV3PoolUSDC, CALLS.liquidity),
      ethCall(CHAINLINK_WETH_USD, LATEST_ROUND_DATA),
    ]);

    // Parse WETH pool
    let wethPoolActive = false;
    let wethTick = 0;
    let wethLiquidity = 0n;
    let wethPriceUsd = 0.0002; // seed fallback
    if (slot0WethHex) {
      try {
        const clean = slot0WethHex.startsWith('0x') ? slot0WethHex.slice(2) : slot0WethHex;
        const sqrtPriceX96 = BigInt('0x' + clean.slice(0, 64));
        wethTick = decodeSlot0Tick(slot0WethHex);
        wethPoolActive = sqrtPriceX96 > 0n;
        if (wethPoolActive) {
          const Q96 = 2n ** 96n;
          const sqrtNum = Number(sqrtPriceX96) / Number(Q96);
          const wethPerWzion = sqrtNum * sqrtNum;
          const wethUsd = wethUsdHex ? decodeChainlinkAnswer(wethUsdHex) : 2000;
          wethPriceUsd = wethPerWzion * wethUsd;
        }
      } catch { /* decode failed */ }
    }
    wethLiquidity = liquidityWethHex ? decodeUint128(liquidityWethHex) : 0n;

    // Parse USDC pool
    let usdcPoolActive = false;
    let usdcTick = 0;
    let usdcLiquidity = 0n;
    if (slot0UsdcHex) {
      try {
        const clean = slot0UsdcHex.startsWith('0x') ? slot0UsdcHex.slice(2) : slot0UsdcHex;
        const sqrtPriceX96 = BigInt('0x' + clean.slice(0, 64));
        usdcTick = decodeSlot0Tick(slot0UsdcHex);
        usdcPoolActive = sqrtPriceX96 > 0n;
      } catch { /* decode failed */ }
    }
    usdcLiquidity = liquidityUsdcHex ? decodeUint128(liquidityUsdcHex) : 0n;

    const wethUsd = wethUsdHex ? decodeChainlinkAnswer(wethUsdHex) : 2000;

    return NextResponse.json({
      ok: true,
      network: 'base-mainnet',
      chainId: 8453,
      contracts: CONTRACTS,
      data: {
        wZION: {
          totalSupply: hexToDecimal18(totalSupplyHex),
          totalSupplyRaw: totalSupplyHex,
        },
        staking: {
          totalStaked: '0',
          apr: '—',
          cooldownDays: 7,
        },
        farm: {
          poolCount: 0,
          rewardPerSecond: '0',
        },
        governance: {
          proposalCount: 0,
        },
        bridge: {
          threshold: hexToNumber(thresholdHex),
          validatorCount: hexToNumber(validatorCountHex),
        },
        pools: {
          wzion_weth: {
            address: CONTRACTS.UniV3PoolWETH,
            fee: 10000,
            feeLabel: '1%',
            active: wethPoolActive,
            tick: wethTick,
            liquidity: wethLiquidity.toString(),
            price_usd: wethPriceUsd,
          },
          wzion_usdc: {
            address: CONTRACTS.UniV3PoolUSDC,
            fee: 3000,
            feeLabel: '0.3%',
            active: usdcPoolActive,
            tick: usdcTick,
            liquidity: usdcLiquidity.toString(),
          },
        },
        weth_usd: wethUsd,
      },
      fetchedAt: Date.now(),
    }, { headers: HEADERS });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to fetch DeFi data' },
      { status: 502, headers: HEADERS },
    );
  }
}
