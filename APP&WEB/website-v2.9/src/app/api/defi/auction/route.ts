/**
 * ZION DeFi — Uniswap CCA Auction API
 *
 * Reads on-chain state from the Uniswap Continuous Clearing Auction contract
 * on Base Mainnet. Returns:
 *   - clearingPrice (Q96 → USD per wZION)
 *   - currencyRaised (USDC raised so far)
 *   - totalCleared (wZION sold so far)
 *   - remainingSupply (wZION remaining in auction)
 *   - isGraduated (whether auction met graduation threshold)
 *   - currentBlock + progress percentage
 *   - token/currency balances of the auction contract
 *
 * Contract: 0x4eD4EbBaa975d20cEA746E3569802D51768e1f93
 * Source:   https://github.com/Uniswap/continuous-clearing-auction
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

const RPC_URL = process.env.BASE_RPC_URL || 'https://base.publicnode.com';

// ── Contract addresses ────────────────────────────────────────────────────────
const AUCTION = '0x4eD4EbBaa975d20cEA746E3569802D51768e1f93';
const WZION   = '0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6';
const USDC    = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// ── Immutable parameters (from AUCTION_CCA_BASE.md) ───────────────────────────
const START_BLOCK  = 48_013_356;
const END_BLOCK    = 55_959_126;
const CLAIM_BLOCK  = 55_959_126;
const TOTAL_SUPPLY = 66_466_631.15; // wZION deposited (18 decimals)

// ── Function selectors (keccak256 first 4 bytes) ──────────────────────────────
const CLEARING_PRICE   = '0x32a0f2d7'; // clearingPrice()
const CURRENCY_RAISED  = '0x998ba4fc'; // currencyRaised()
const TOTAL_CLEARED    = '0x3e9d9174'; // totalCleared()
const REMAINING_SUPPLY = '0xda0239a6'; // remainingSupply()
const IS_GRADUATED     = '0x9e5f2602'; // isGraduated()
const BALANCE_OF       = '0x70a08231'; // balanceOf(address)
const BLOCK_NUMBER     = 'eth_blockNumber';

// ── Helpers ───────────────────────────────────────────────────────────────────

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

async function ethBlockNumber(): Promise<number> {
  try {
    const res = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: BLOCK_NUMBER, params: [] }),
      signal: AbortSignal.timeout(5000),
    });
    const json = await res.json();
    return parseInt(json?.result ?? '0x0', 16);
  } catch {
    return 0;
  }
}

function hexToBigInt(hex: string | null): bigint {
  if (!hex || hex === '0x') return 0n;
  return BigInt(hex);
}

// ── Q96 price conversion ──────────────────────────────────────────────────────
// clearingPrice is in Q96 format: price = clearingPrice / 2^96
// This gives the raw price in currency units per token unit.
// wZION has 18 decimals, USDC has 6 decimals.
// Human price (USD per wZION) = (clearingPrice / Q96) * 10^(wZION_decimals - USDC_decimals)
//                              = (clearingPrice / Q96) * 10^12
const Q96 = 2n ** 96n;

function q96ToUsdPerWzion(clearingPriceQ96: bigint): number {
  if (clearingPriceQ96 === 0n) return 0;
  // Use Number for human-readable price (precision is sufficient for display)
  const rawPrice = Number(clearingPriceQ96) / Number(Q96);
  return rawPrice * 10 ** 12; // adjust for decimal difference (18 - 6 = 12)
}

// ── API handler ───────────────────────────────────────────────────────────────

export async function GET() {
  // Fetch all data in parallel
  const [
    clearingPriceHex,
    currencyRaisedHex,
    totalClearedHex,
    remainingSupplyHex,
    isGraduatedHex,
    wzionBalanceHex,
    usdcBalanceHex,
    currentBlock,
  ] = await Promise.all([
    ethCall(AUCTION, CLEARING_PRICE),
    ethCall(AUCTION, CURRENCY_RAISED),
    ethCall(AUCTION, TOTAL_CLEARED),
    ethCall(AUCTION, REMAINING_SUPPLY),
    ethCall(AUCTION, IS_GRADUATED),
    ethCall(WZION, BALANCE_OF + encodeAddress(AUCTION)),
    ethCall(USDC, BALANCE_OF + encodeAddress(AUCTION)),
    ethBlockNumber(),
  ]);

  const clearingPriceQ96 = hexToBigInt(clearingPriceHex);
  const currencyRaised   = hexToBigInt(currencyRaisedHex);
  const totalCleared     = hexToBigInt(totalClearedHex);
  const remainingSupply  = hexToBigInt(remainingSupplyHex);
  const isGraduated      = hexToBigInt(isGraduatedHex) !== 0n;
  const wzionBalance     = hexToBigInt(wzionBalanceHex);
  const usdcBalance      = hexToBigInt(usdcBalanceHex);

  // Convert to human-readable
  const clearingPriceUsd = q96ToUsdPerWzion(clearingPriceQ96);
  const currencyRaisedHuman = Number(currencyRaised) / 1e6;   // USDC 6 decimals
  const totalClearedHuman   = Number(totalCleared) / 1e18;     // wZION 18 decimals
  const remainingSupplyHuman = Number(remainingSupply) / 1e18; // wZION 18 decimals
  const wzionBalanceHuman   = Number(wzionBalance) / 1e18;
  const usdcBalanceHuman    = Number(usdcBalance) / 1e6;

  // Progress calculation
  const blocksElapsed = Math.max(0, currentBlock - START_BLOCK);
  const totalBlocks   = END_BLOCK - START_BLOCK;
  const progressPct   = totalBlocks > 0 ? (blocksElapsed / totalBlocks) * 100 : 0;
  const blocksRemaining = Math.max(0, END_BLOCK - currentBlock);
  // Base = ~2s/block → 43200 blocks/day
  const daysRemaining = blocksRemaining / 43200;

  // Percentage sold
  const pctSold = TOTAL_SUPPLY > 0 ? (totalClearedHuman / TOTAL_SUPPLY) * 100 : 0;

  return NextResponse.json({
    ok: true,
    network: 'base-mainnet',
    chainId: 8453,
    auction: AUCTION,
    token: WZION,
    currency: USDC,
    // Immutable params
    startBlock: START_BLOCK,
    endBlock: END_BLOCK,
    claimBlock: CLAIM_BLOCK,
    totalSupply: TOTAL_SUPPLY,
    // Live on-chain state
    clearingPriceQ96: clearingPriceQ96.toString(),
    clearingPriceUsd,
    currencyRaised: currencyRaisedHuman,
    totalCleared: totalClearedHuman,
    remainingSupply: remainingSupplyHuman,
    isGraduated,
    // Balances (more accurate than view functions for some cases)
    wzionBalance: wzionBalanceHuman,
    usdcBalance: usdcBalanceHuman,
    // Progress
    currentBlock,
    blocksElapsed,
    blocksRemaining,
    progressPct,
    daysRemaining,
    pctSold,
    fetchedAt: Date.now(),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
  });
}
