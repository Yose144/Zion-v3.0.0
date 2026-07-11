export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

const HEADERS = { 'Cache-Control': 'no-store, max-age=0' };

const RPC_URL = process.env.BASE_RPC_URL || 'https://base.publicnode.com';

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
  // Staking
  stakingTotalStaked:     '0x817b1cd2', // totalStaked()
  stakingRewardPool:      '0x7a5c08ae', // rewardPoolBalance()
  stakingAprBps:          '0x25ac1df2', // aprBps()
  stakingCooldown:        '0xb8221bc4', // cooldownSeconds()
  // Farm
  farmRewardPerSecond:    '0x8f10369a', // rewardPerSecond()
  farmPoolCount:          '0xf525cb68', // poolCount()
  farmTotalAllocPoints:   '0x1fa36cbe', // totalAllocPoints()
  farmRewardPool:         '0x7a5c08ae', // rewardPoolBalance()
  // Governance
  govProposalCount:       '0xda35c664', // proposalCount()
  govVotingPeriod:        '0x02a251a3', // votingPeriod()
};

// Updated 2026-08-18 — active bridge + pool addresses
const CONTRACTS: Record<string, string> = {
  wZION:          '0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6',
  WETH:           '0x4200000000000000000000000000000000000006',
  USDT:           '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
  SOL:            '0x311935Cd80B76769bF2ecC9D8Ab7635b2139cf82',
  ZIONBridge:     '0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467',
  ZIONStaking:    '0xbd5cEe7878337d22188BFBaF9aa9F39A850Be78B',
  ZIONFarm:       '0x167B2753F5D8D9F8e62875cc9e379d7804308B08',
  ZIONGovernance: '0xB77eB4ab9468Ce03FBd7eCec70e976EFCfa623E8',
  UniV3PoolWETH:  '0x18c0DaeF295E63F1bfBC7C39e71d0fabf4600699', // wZION/WETH 1%
  UniV3PoolUSDT:  '0x186b46c2f04153999d44D25179cD623fD62Bfda2', // wZION/USDT 0.3% — primary
  UniV3PoolSOL:   '0xF38c56bbBBBC6d9FA11E7DE84bF7Bb70e1e8D2b3', // wZION/SOL 0.01%
  UniV3Router:    '0x2626664c2603336E57B271c5C0b26F421741e481',
  UniV3Factory:   '0x33128a8fC17869897dcE68Ed026d694621f6FDfD',
};

const CHAINLINK_WETH_USD = '0x71041dddad3595F9CEdDCDcF2012034b68dF6aFA'; // DEPRECATED — no code at this address on Base
const LATEST_ROUND_DATA = '0xfeaf968c';
const POOL_WETH_USDC = '0x6c561B446416E1A00E8E93E221854d6eA4171372'; // WETH/USDC 0.3% — live ETH/USD price

async function ethCall(to: string, data: string): Promise<string | null> {
  try {
    const res = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
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
  if (!hex || hex === '0x' || hex === '0x0') return 0;
  try {
    return Number(BigInt(hex));
  } catch {
    return 0;
  }
}

function hexToDecimal18(hex: string | null): string {
  if (!hex || hex === '0x') return '0';
  try {
    const raw = BigInt(hex);
    const whole = raw / BigInt(1e18);
    const frac = raw % BigInt(1e18);
    const fracStr = frac.toString().padStart(18, '0').slice(0, 4);
    return `${whole}.${fracStr}`;
  } catch {
    return '0';
  }
}

function decodeSlot0Tick(hex: string): number {
  if (!hex || hex === '0x') return 0;
  try {
    const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
    if (clean.length < 128) return 0;
    const tickRaw = BigInt('0x' + clean.slice(64, 128));
    const tick24 = tickRaw & 0xFFFFFFn;
    return tick24 >= 2n ** 23n ? Number(tick24 - 2n ** 24n) : Number(tick24);
  } catch {
    return 0;
  }
}

function decodeUint128(hex: string): bigint {
  if (!hex || hex === '0x') return 0n;
  try {
    const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
    if (clean.length < 64) return 0n;
    return BigInt('0x' + clean.slice(0, 64));
  } catch {
    return 0n;
  }
}

function decodeChainlinkAnswer(hex: string): number {
  if (!hex || hex === '0x') return 2000;
  try {
    const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
    if (clean.length < 128) return 2000;
    const answer = BigInt('0x' + clean.slice(64, 128));
    const signed = answer >= 2n ** 255n ? answer - 2n ** 256n : answer;
    return Number(signed) / 1e8;
  } catch {
    return 2000;
  }
}

function decodeSqrtPriceX96(hex: string | null): bigint | null {
  if (!hex || hex === '0x') return null;
  try {
    const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
    if (clean.length < 64) return null;
    return BigInt('0x' + clean.slice(0, 64));
  } catch { return null; }
}

function sqrtPriceToUsdPerWzion(sqrtPriceX96: bigint, token1Usd: number, token1Decimals: number, token0Decimals: number): number {
  const Q96 = 2n ** 96n;
  const sqrtNum = Number(sqrtPriceX96) / Number(Q96);
  const rawPrice = sqrtNum * sqrtNum; // token1 / token0 in raw units
  // human price = raw * 10^(token0Decimals - token1Decimals)
  const decimalAdjustment = 10 ** (token0Decimals - token1Decimals);
  const humanPrice = rawPrice * decimalAdjustment;
  return humanPrice * token1Usd;
}

export async function GET() {
  try {
    const [
      totalSupplyHex,
      thresholdHex,
      validatorCountHex,
      slot0WethHex,
      liquidityWethHex,
      slot0UsdtHex,
      liquidityUsdtHex,
      slot0SolHex,
      liquiditySolHex,
      wethUsdcSlot0Hex,
      stakingTotalStakedHex,
      stakingRewardPoolHex,
      stakingAprBpsHex,
      stakingCooldownHex,
      farmRewardPerSecondHex,
      farmPoolCountHex,
      farmTotalAllocHex,
      farmRewardPoolHex,
      govProposalCountHex,
      govVotingPeriodHex,
    ] = await Promise.all([
      ethCall(CONTRACTS.wZION, CALLS.totalSupply),
      ethCall(CONTRACTS.ZIONBridge, CALLS.threshold),
      ethCall(CONTRACTS.ZIONBridge, CALLS.validatorCount),
      ethCall(CONTRACTS.UniV3PoolWETH, CALLS.slot0),
      ethCall(CONTRACTS.UniV3PoolWETH, CALLS.liquidity),
      ethCall(CONTRACTS.UniV3PoolUSDT, CALLS.slot0),
      ethCall(CONTRACTS.UniV3PoolUSDT, CALLS.liquidity),
      ethCall(CONTRACTS.UniV3PoolSOL, CALLS.slot0),
      ethCall(CONTRACTS.UniV3PoolSOL, CALLS.liquidity),
      ethCall(POOL_WETH_USDC, CALLS.slot0), // live ETH/USD from Uniswap WETH/USDC pool
      ethCall(CONTRACTS.ZIONStaking, CALLS.stakingTotalStaked),
      ethCall(CONTRACTS.ZIONStaking, CALLS.stakingRewardPool),
      ethCall(CONTRACTS.ZIONStaking, CALLS.stakingAprBps),
      ethCall(CONTRACTS.ZIONStaking, CALLS.stakingCooldown),
      ethCall(CONTRACTS.ZIONFarm, CALLS.farmRewardPerSecond),
      ethCall(CONTRACTS.ZIONFarm, CALLS.farmPoolCount),
      ethCall(CONTRACTS.ZIONFarm, CALLS.farmTotalAllocPoints),
      ethCall(CONTRACTS.ZIONFarm, CALLS.farmRewardPool),
      ethCall(CONTRACTS.ZIONGovernance, CALLS.govProposalCount),
      ethCall(CONTRACTS.ZIONGovernance, CALLS.govVotingPeriod),
    ]);

    // Live ETH/USD from Uniswap V3 WETH/USDC pool (replaces broken Chainlink oracle)
    let wethUsd = 2000;
    const wethUsdcSqrt = decodeSqrtPriceX96(wethUsdcSlot0Hex);
    if (wethUsdcSqrt && wethUsdcSqrt > 0n) {
      // WETH/USDC pool: token0 = WETH (18 dec), token1 = USDC (6 dec)
      // price = (sqrtPriceX96 / 2^96)^2 * 10^(18-6) = USDC per WETH = ETH/USD
      wethUsd = sqrtPriceToUsdPerWzion(wethUsdcSqrt, 1, 6, 18);
      if (wethUsd <= 0) wethUsd = 2000;
    }
    const solUsd = 73.44; // fallback — no reliable SOL/USD oracle on Base

    const wethSqrt = decodeSqrtPriceX96(slot0WethHex);
    const usdtSqrt = decodeSqrtPriceX96(slot0UsdtHex);
    const solSqrt = decodeSqrtPriceX96(slot0SolHex);

    const wethLiq = liquidityWethHex ? decodeUint128(liquidityWethHex) : 0n;
    const usdtLiq = liquidityUsdtHex ? decodeUint128(liquidityUsdtHex) : 0n;
    const solLiq  = liquiditySolHex ? decodeUint128(liquiditySolHex) : 0n;

    // Pool is active only if it has actual liquidity (not just an initialization price)
    const wethPoolActive = wethSqrt !== null && wethSqrt > 0n && wethLiq > 0n;
    const usdtPoolActive = usdtSqrt !== null && usdtSqrt > 0n && usdtLiq > 0n;
    const solPoolActive  = solSqrt  !== null && solSqrt  > 0n && solLiq  > 0n;

    // Staking on-chain data
    const stakingAprBps = hexToNumber(stakingAprBpsHex);
    const stakingCooldownSecs = hexToNumber(stakingCooldownHex);

    // Farm on-chain data
    const farmPoolCount = hexToNumber(farmPoolCountHex);
    const farmTotalAlloc = hexToNumber(farmTotalAllocHex);

    // Governance on-chain data
    const govProposalCount = hexToNumber(govProposalCountHex);
    const govVotingPeriod = hexToNumber(govVotingPeriodHex);

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
          totalStaked: hexToDecimal18(stakingTotalStakedHex),
          rewardPool: hexToDecimal18(stakingRewardPoolHex),
          apr: stakingAprBps > 0 ? `${(stakingAprBps / 100).toFixed(2)}%` : '—',
          aprBps: stakingAprBps,
          cooldownDays: Math.round(stakingCooldownSecs / 86400),
          cooldownSeconds: stakingCooldownSecs,
        },
        farm: {
          poolCount: farmPoolCount,
          totalAllocPoints: farmTotalAlloc,
          rewardPerSecond: hexToDecimal18(farmRewardPerSecondHex),
          rewardPool: hexToDecimal18(farmRewardPoolHex),
        },
        governance: {
          proposalCount: govProposalCount,
          votingPeriod: govVotingPeriod,
        },
        bridge: {
          threshold: hexToNumber(thresholdHex),
          validatorCount: hexToNumber(validatorCountHex),
        },
        pools: {
          wzion_usdt: {
            address: CONTRACTS.UniV3PoolUSDT,
            fee: 3000,
            feeLabel: '0.3%',
            active: usdtPoolActive,
            tick: usdtPoolActive ? decodeSlot0Tick(slot0UsdtHex!) : 0,
            liquidity: (liquidityUsdtHex ? decodeUint128(liquidityUsdtHex) : 0n).toString(),
            price_usd: usdtSqrt ? sqrtPriceToUsdPerWzion(usdtSqrt, 1, 6, 18) : 0.0002,
          },
          wzion_weth: {
            address: CONTRACTS.UniV3PoolWETH,
            fee: 10000,
            feeLabel: '1%',
            active: wethPoolActive,
            tick: wethPoolActive ? decodeSlot0Tick(slot0WethHex!) : 0,
            liquidity: (liquidityWethHex ? decodeUint128(liquidityWethHex) : 0n).toString(),
            price_usd: wethSqrt ? sqrtPriceToUsdPerWzion(wethSqrt, wethUsd, 18, 18) : 0.0002,
          },
          wzion_sol: {
            address: CONTRACTS.UniV3PoolSOL,
            fee: 100,
            feeLabel: '0.01%',
            active: solPoolActive,
            tick: solPoolActive ? decodeSlot0Tick(slot0SolHex!) : 0,
            liquidity: (liquiditySolHex ? decodeUint128(liquiditySolHex) : 0n).toString(),
            price_usd: solSqrt ? sqrtPriceToUsdPerWzion(solSqrt, solUsd, 9, 18) : 0.0002,
          },
        },
        weth_usd: wethUsd,
        sol_usd: solUsd,
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
