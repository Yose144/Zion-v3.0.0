/**
 * ZION DeFi — Pool Stats API (V4)
 *
 * Queries real on-chain data from Uniswap V4 on Base Mainnet.
 * V3 pools are empty — all liquidity migrated to V4.
 *
 * Real data sources:
 * - V4 PoolManager token balances (wZION, USDT held by singleton)
 * - V4 PositionManager NFT ownerOf (check if positions are active or burned)
 * - wZION totalSupply, Staking/Farm/Treasury balances
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

const RPC_URL = process.env.BASE_RPC_URL || 'https://base.publicnode.com';

// V4 contracts on Base Mainnet
const V4_POOL_MANAGER     = '0x498581fF718922c3f8e6A244956aF099B2652b2b';
const V4_POSITION_MANAGER = '0x7C5f5A4bBd8fD63184577525326123B519429BdC';

// V3 USDT pool (still has valid slot0 price even though liquidity=0)
const V3_POOL_USDT = '0x186b46c2f04153999d44D25179cD623fD62Bfda2';

// Token contracts
const WZION  = '0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6';
const USDT   = '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2';
const WETH   = '0x4200000000000000000000000000000000000006';
const SOL    = '0x311935Cd80B76769bF2ecC9D8Ab7635b2139cf82';

// DeFi contracts
const STAKING   = '0xbd5cEe7878337d22188BFBaF9aa9F39A850Be78B';
const FARM      = '0x167B2753F5D8D9F8e62875cc9e379d7804308B08';
const TREASURY  = '0x455f465ac7e14fdA97dC46fdd74bCa78bfC0aEeD';
const GOVERNANCE = '0xB77eB4ab9468Ce03FBd7eCec70e976EFCfa623E8';
const BRIDGE    = '0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467';
const DEPLOYER  = '0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186';

// V4 NFT position IDs
const NFT_USDT = 2740371; // wZION/USDT 0.3% — active
const NFT_WETH = 2740380; // ETH/wZION 0.3% — burned

// Function selectors
const BALANCE_OF    = '0x70a08231';
const TOTAL_SUPPLY  = '0x18160ddd';
const OWNER_OF      = '0x6352211e';
const LATEST_ROUND  = '0xfeaf968c';
const SLOT0         = '0x3850c7bd';
const CHAINLINK_WETH = '0x71041dddad3595F9CEdDCDcF2012034b68dF6aFA';

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

function encodeUint256(n: number): string {
  return BigInt(n).toString(16).padStart(64, '0');
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

export async function GET() {
  // Fetch all real on-chain data in parallel
  const [
    wzionSupplyHex,
    poolMgrWzionHex, poolMgrUsdtHex, poolMgrWethHex, poolMgrSolHex,
    stakingWzionHex, farmWzionHex, treasuryWzionHex, govWzionHex, bridgeWzionHex,
    deployerWzionHex,
    nftUsdtOwnerHex, nftWethOwnerHex,
    wethUsdHex,
    v3Slot0Hex,
  ] = await Promise.all([
    ethCall(WZION, TOTAL_SUPPLY),
    ethCall(WZION, BALANCE_OF + encodeAddress(V4_POOL_MANAGER)),
    ethCall(USDT, BALANCE_OF + encodeAddress(V4_POOL_MANAGER)),
    ethCall(WETH, BALANCE_OF + encodeAddress(V4_POOL_MANAGER)),
    ethCall(SOL, BALANCE_OF + encodeAddress(V4_POOL_MANAGER)),
    ethCall(WZION, BALANCE_OF + encodeAddress(STAKING)),
    ethCall(WZION, BALANCE_OF + encodeAddress(FARM)),
    ethCall(WZION, BALANCE_OF + encodeAddress(TREASURY)),
    ethCall(WZION, BALANCE_OF + encodeAddress(GOVERNANCE)),
    ethCall(WZION, BALANCE_OF + encodeAddress(BRIDGE)),
    ethCall(WZION, BALANCE_OF + encodeAddress(DEPLOYER)),
    ethCall(V4_POSITION_MANAGER, OWNER_OF + encodeUint256(NFT_USDT)),
    ethCall(V4_POSITION_MANAGER, OWNER_OF + encodeUint256(NFT_WETH)),
    ethCall(CHAINLINK_WETH, LATEST_ROUND),
    ethCall(V3_POOL_USDT, SLOT0),
  ]);

  // Parse real balances
  const wzionSupply = toHuman(hexToBigInt(wzionSupplyHex), 18);
  const poolMgrWzion = toHuman(hexToBigInt(poolMgrWzionHex), 18);
  const poolMgrUsdt = toHuman(hexToBigInt(poolMgrUsdtHex), 6);
  const poolMgrWeth = toHuman(hexToBigInt(poolMgrWethHex), 18);
  const poolMgrSol = toHuman(hexToBigInt(poolMgrSolHex), 9);
  const stakingWzion = toHuman(hexToBigInt(stakingWzionHex), 18);
  const farmWzion = toHuman(hexToBigInt(farmWzionHex), 18);
  const treasuryWzion = toHuman(hexToBigInt(treasuryWzionHex), 18);
  const govWzion = toHuman(hexToBigInt(govWzionHex), 18);
  const bridgeWzion = toHuman(hexToBigInt(bridgeWzionHex), 18);
  const deployerWzion = toHuman(hexToBigInt(deployerWzionHex), 18);

  // Check NFT ownership (real on-chain)
  const nftUsdtOwner = nftUsdtOwnerHex && hexToBigInt(nftUsdtOwnerHex) !== 0n
    ? '0x' + nftUsdtOwnerHex.slice(26).toLowerCase()
    : null;
  const nftWethOwner = nftWethOwnerHex && hexToBigInt(nftWethOwnerHex) !== 0n
    ? '0x' + nftWethOwnerHex.slice(26).toLowerCase()
    : null;

  // WETH price from Chainlink
  let wethUsd = 2000;
  if (wethUsdHex) {
    try { wethUsd = decodeChainlinkAnswer(wethUsdHex); } catch { /* fallback */ }
  }

  // Price from V3 USDT pool slot0 (still valid even with liquidity=0)
  // V3 pool: token0=wZION(18), token1=USDT(6)
  // price = (sqrtPriceX96 / Q96)^2 * 10^(token0Decimals - token1Decimals)
  let priceUsd = 0;
  let tick = 0;
  if (v3Slot0Hex) {
    try {
      const clean = v3Slot0Hex.startsWith('0x') ? v3Slot0Hex.slice(2) : v3Slot0Hex;
      const sqrtPriceX96 = BigInt('0x' + clean.slice(0, 64));
      const tickRaw = BigInt('0x' + clean.slice(64, 128));
      const tick24 = tickRaw & 0xFFFFFFn;
      tick = tick24 >= 2n ** 23n ? Number(tick24 - 2n ** 24n) : Number(tick24);
      if (sqrtPriceX96 > 0n) {
        const Q96 = 2n ** 96n;
        const sqrtNum = Number(sqrtPriceX96) / Number(Q96);
        const decimalAdjustment = 10 ** (18 - 6); // wZION 18, USDT 6
        priceUsd = sqrtNum * sqrtNum * decimalAdjustment; // USDT ≈ $1
      }
    } catch { /* decode failed */ }
  }

  // TVL: wZION in V4 PoolManager (only our pools use wZION) * price * 2
  // (both sides of the pool: wZION + USDT, roughly equal value)
  // V4 PoolManager is a singleton — USDT includes all V4 pools on Base,
  // so we can't use the raw USDT balance. We estimate USDT side = wZION * price.
  const wzionValueUsd = poolMgrWzion * priceUsd;
  const tvlUsd = wzionValueUsd * 2;

  // Determine active pools from NFT ownership
  const usdtActive = nftUsdtOwner !== null;
  const wethActive = nftWethOwner !== null;

  return NextResponse.json({
    ok: true,
    network: 'base-mainnet',
    chainId: 8453,
    source: 'uniswap-v4-onchain',
    weth_usd: wethUsd,
    primary_pool: 'wzion_usdt',
    summary: {
      total_tvl_usd: tvlUsd,
      total_wzion_liquidity: poolMgrWzion,
      active_pools: (usdtActive ? 1 : 0) + (wethActive ? 1 : 0),
      wzion_supply: wzionSupply,
      deployer_wzion: deployerWzion,
    },
    pools: {
      wzion_usdt: {
        pair: 'wZION/USDT',
        fee: 3000,
        feeLabel: '0.3%',
        active: usdtActive,
        nft_id: NFT_USDT,
        nft_owner: nftUsdtOwner,
        tick,
        balances: {
          wzion: poolMgrWzion,
          usdt: poolMgrUsdt,
        },
        price_usd: priceUsd,
        tvl_usd: wzionValueUsd * 2,
      },
      wzion_weth: {
        pair: 'ETH/wZION',
        fee: 3000,
        feeLabel: '0.3%',
        active: wethActive,
        nft_id: NFT_WETH,
        nft_owner: nftWethOwner,
        balances: {
          wzion: 0,
          weth: 0,
        },
        price_usd: 0,
        tvl_usd: 0,
      },
    },
    contracts: {
      staking: { wzion: stakingWzion },
      farm: { wzion: farmWzion },
      treasury: { wzion: treasuryWzion },
      governance: { wzion: govWzion },
      bridge: { wzion: bridgeWzion },
    },
    v4_addresses: {
      poolManager: V4_POOL_MANAGER,
      positionManager: V4_POSITION_MANAGER,
    },
    fetchedAt: Date.now(),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=60' },
  });
}
