/**
 * ZION DeFi — Pool Stats API (V3)
 *
 * Queries real on-chain data from Uniswap V3 on Base Mainnet.
 * V4 positions were burned; V3 is the only source of real wZION DEX liquidity.
 *
 * Real data sources:
 * - Uniswap V3 pool slot0() and liquidity()
 * - Token balances held directly in each V3 pool contract
 * - PancakeSwap V3 pool (same pattern)
 * - wZION totalSupply, Staking/Farm/Treasury/Governance/Bridge/Deployer balances
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

const RPC_URL = process.env.BASE_RPC_URL || 'https://base.publicnode.com';

// Token contracts
const WZION  = '0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6';
const USDT   = '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2';
const WETH   = '0x4200000000000000000000000000000000000006';
const SOL    = '0x311935Cd80B76769bF2ecC9D8Ab7635b2139cf82';

// Uniswap V3 pools on Base Mainnet
const UNI_V3_USDT = '0x186b46c2f04153999d44D25179cD623fD62Bfda2'; // wZION/USDT 0.3% — primary
const UNI_V3_WETH = '0x18c0DaeF295E63F1bfBC7C39e71d0fabf4600699'; // wZION/WETH 1%
const UNI_V3_SOL  = '0xF38c56bbBBBC6d9FA11E7DE84bF7Bb70e1e8D2b3'; // wZION/SOL 0.01%

// PancakeSwap V3 pool on Base Mainnet
const PS_V3_USDT = '0x46cc98dec9d2a60f2850225c942d6017b82b6f47'; // wZION/USDT 0.25%

// DeFi contracts
const STAKING   = '0xbd5cEe7878337d22188BFBaF9aa9F39A850Be78B';
const FARM      = '0x167B2753F5D8D9F8e62875cc9e379d7804308B08';
const TREASURY  = '0x455f465ac7e14fdA97dC46fdd74bCa78bfC0aEeD';
const GOVERNANCE = '0xB77eB4ab9468Ce03FBd7eCec70e976EFCfa623E8';
const BRIDGE    = '0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467';
const DEPLOYER  = '0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186';

// Chainlink
const CHAINLINK_WETH = '0x71041dddad3595F9CEdDCDcF2012034b68dF6aFA';

// Function selectors
const BALANCE_OF    = '0x70a08231';
const TOTAL_SUPPLY  = '0x18160ddd';
const LATEST_ROUND  = '0xfeaf968c';
const SLOT0         = '0x3850c7bd';
const LIQUIDITY     = '0x1a686502';

interface TokenMeta {
  decimals: number;
  usd: number; // fallback until oracle is wired
}

const TOKENS: Record<string, TokenMeta> = {
  [WZION]: { decimals: 18, usd: 0 },
  [USDT]:  { decimals: 6,  usd: 1 },
  [WETH]:  { decimals: 18, usd: 0 },
  [SOL]:   { decimals: 9,  usd: 73.44 },
};

async function ethCall(to: string, data: string): Promise<string | null> {
  try {
    const res = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to, data }, 'latest'] }),
      signal: AbortSignal.timeout(8000),
    });
    const json = await res.json();
    return json?.result ?? null;
  } catch {
    return null;
  }
}

function encodeAddress(addr: string): string {
  return addr.toLowerCase().replace('0x', '').padStart(64, '0');
}

function hexToBigInt(hex: string | null): bigint {
  if (!hex || hex === '0x') return 0n;
  return BigInt(hex);
}

function toHuman(val: bigint, decimals: number): number {
  return Number(val) / 10 ** decimals;
}

function decodeChainlinkAnswer(hex: string): number {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const answer = BigInt('0x' + clean.slice(64, 128));
  const signed = answer >= 2n ** 255n ? answer - 2n ** 256n : answer;
  return Number(signed) / 1e8;
}

interface Slot0 {
  sqrtPriceX96: bigint;
  tick: number;
}

function decodeSlot0(hex: string | null): Slot0 | null {
  if (!hex || hex === '0x') return null;
  try {
    const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
    const sqrtPriceX96 = BigInt('0x' + clean.slice(0, 64));
    const tickRaw = BigInt('0x' + clean.slice(64, 128));
    const tick24 = tickRaw & 0xFFFFFFn;
    const tick = tick24 >= 2n ** 23n ? Number(tick24 - 2n ** 24n) : Number(tick24);
    return { sqrtPriceX96, tick };
  } catch {
    return null;
  }
}

function priceFromSqrtPriceX96(
  sqrtPriceX96: bigint,
  token0Decimals: number,
  token1Decimals: number,
  token1Usd: number,
): number {
  const Q96 = 2n ** 96n;
  const sqrtNum = Number(sqrtPriceX96) / Number(Q96);
  const rawPrice = sqrtNum * sqrtNum; // token1 / token0 in raw units
  const decimalAdjustment = 10 ** (token0Decimals - token1Decimals);
  return rawPrice * decimalAdjustment * token1Usd;
}

interface PoolResult {
  pair: string;
  dex: string;
  fee: number;
  feeLabel: string;
  active: boolean;
  tick: number;
  liquidity: string;
  balances: Record<string, number | string>;
  price_usd: number;
  tvl_usd: number;
}

async function readV3Pool(
  poolAddress: string,
  pair: string,
  dex: string,
  fee: number,
  feeLabel: string,
  token1Address: string,
  token1Symbol: string,
  wethUsd: number,
  solUsd: number,
): Promise<PoolResult> {
  const token1Usd = token1Address === USDT ? 1 : token1Address === WETH ? wethUsd : token1Address === SOL ? solUsd : 1;

  const [slot0Hex, liquidityHex, wzionBalHex, token1BalHex] = await Promise.all([
    ethCall(poolAddress, SLOT0),
    ethCall(poolAddress, LIQUIDITY),
    ethCall(WZION, BALANCE_OF + encodeAddress(poolAddress)),
    ethCall(token1Address, BALANCE_OF + encodeAddress(poolAddress)),
  ]);

  const slot0 = decodeSlot0(slot0Hex);
  const liquidity = hexToBigInt(liquidityHex);
  const wzionBal = toHuman(hexToBigInt(wzionBalHex), TOKENS[WZION].decimals);
  const token1Bal = toHuman(hexToBigInt(token1BalHex), TOKENS[token1Address].decimals);

  const active = wzionBal > 0 || token1Bal > 0;

  let priceUsd = 0;
  if (slot0 && slot0.sqrtPriceX96 > 0n) {
    priceUsd = priceFromSqrtPriceX96(
      slot0.sqrtPriceX96,
      TOKENS[WZION].decimals,
      TOKENS[token1Address].decimals,
      token1Usd,
    );
  }

  const tvlUsd = wzionBal * priceUsd + token1Bal * token1Usd;

  const balances: Record<string, number | string> = { wzion: wzionBal, token1: token1Bal, token1Symbol };
  if (token1Symbol === 'USDT') balances.usdt = token1Bal;
  if (token1Symbol === 'WETH') balances.weth = token1Bal;
  if (token1Symbol === 'SOL') balances.sol = token1Bal;

  return {
    pair,
    dex,
    fee,
    feeLabel,
    active,
    tick: slot0?.tick ?? 0,
    liquidity: liquidity.toString(),
    balances,
    price_usd: priceUsd,
    tvl_usd: tvlUsd,
  };
}

export async function GET() {
  // Fetch reference prices and contract balances in parallel
  const [wethUsdHex, wzionSupplyHex, stakingHex, farmHex, treasuryHex, govHex, bridgeHex, deployerHex] =
    await Promise.all([
      ethCall(CHAINLINK_WETH, LATEST_ROUND),
      ethCall(WZION, TOTAL_SUPPLY),
      ethCall(WZION, BALANCE_OF + encodeAddress(STAKING)),
      ethCall(WZION, BALANCE_OF + encodeAddress(FARM)),
      ethCall(WZION, BALANCE_OF + encodeAddress(TREASURY)),
      ethCall(WZION, BALANCE_OF + encodeAddress(GOVERNANCE)),
      ethCall(WZION, BALANCE_OF + encodeAddress(BRIDGE)),
      ethCall(WZION, BALANCE_OF + encodeAddress(DEPLOYER)),
    ]);

  let wethUsd = 2000;
  if (wethUsdHex) {
    try { wethUsd = decodeChainlinkAnswer(wethUsdHex); } catch { /* keep fallback */ }
  }
  const solUsd = TOKENS[SOL].usd;

  const wzionSupply = toHuman(hexToBigInt(wzionSupplyHex), 18);

  // Read all DEX pools in parallel
  const [uniUsdt, uniWeth, uniSol, psUsdt] = await Promise.all([
    readV3Pool(UNI_V3_USDT, 'wZION/USDT', 'Uniswap V3', 3000, '0.3%', USDT, 'USDT', wethUsd, solUsd),
    readV3Pool(UNI_V3_WETH, 'ETH/wZION', 'Uniswap V3', 10000, '1.0%', WETH, 'WETH', wethUsd, solUsd),
    readV3Pool(UNI_V3_SOL, 'wZION/SOL', 'Uniswap V3', 100, '0.01%', SOL, 'SOL', wethUsd, solUsd),
    readV3Pool(PS_V3_USDT, 'wZION/USDT', 'PancakeSwap V3', 2500, '0.25%', USDT, 'USDT', wethUsd, solUsd),
  ]);

  const allPools = [uniUsdt, uniWeth, uniSol, psUsdt];
  const activePools = allPools.filter((p) => p.active);
  const totalTvl = allPools.reduce((sum, p) => sum + p.tvl_usd, 0);
  const totalWzionLiquidity = allPools.reduce((sum, p) => sum + Number(p.balances.wzion ?? 0), 0);
  const primaryPool = activePools.length > 0
    ? activePools.sort((a, b) => b.tvl_usd - a.tvl_usd)[0]
    : null;

  return NextResponse.json({
    ok: true,
    network: 'base-mainnet',
    chainId: 8453,
    source: 'uniswap-v3-onchain',
    weth_usd: wethUsd,
    sol_usd: solUsd,
    primary_pool: primaryPool?.pair ?? 'wzion_usdt',
    primary_dex: primaryPool?.dex ?? 'Uniswap V3',
    summary: {
      total_tvl_usd: totalTvl,
      total_wzion_liquidity: totalWzionLiquidity,
      active_pools: activePools.length,
      total_pools: allPools.length,
      wzion_supply: wzionSupply,
      deployer_wzion: toHuman(hexToBigInt(deployerHex), 18),
    },
    pools: {
      wzion_usdt: uniUsdt,
      wzion_weth: uniWeth,
      wzion_sol: uniSol,
      ps_wzion_usdt: psUsdt,
    },
    contracts: {
      staking:   { wzion: toHuman(hexToBigInt(stakingHex), 18) },
      farm:      { wzion: toHuman(hexToBigInt(farmHex), 18) },
      treasury:  { wzion: toHuman(hexToBigInt(treasuryHex), 18) },
      governance:{ wzion: toHuman(hexToBigInt(govHex), 18) },
      bridge:    { wzion: toHuman(hexToBigInt(bridgeHex), 18) },
    },
    fetchedAt: Date.now(),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=60' },
  });
}
