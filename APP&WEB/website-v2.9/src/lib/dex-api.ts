/**
 * Shared DEX API helpers for ZionDex liquidity + portfolio pages.
 *
 * The Next.js proxy at /api/swap/[...path] forwards to the V31 multichain
 * DEX server (port 8454) under /v1/swap/{...}.  The backend expects
 * zion_l1_types::Asset / Amount / Address shaped JSON bodies.
 */

import { CONTRACTS } from './defi-contracts';
import { TOKENS_BY_CHAIN } from '@/components/dex/TokenSelector';

// ─── Token contract registry ────────────────────────────────────────────────

export const TOKEN_CONTRACTS: Record<string, Record<string, string | null>> = {
  base: {
    wZION: CONTRACTS.wZION,
    USDT: CONTRACTS.USDT,
    USDC: CONTRACTS.USDC,
    WETH: CONTRACTS.WETH,
    // Beta test tokens — have active AMM pools with liquidity
    tZION: '0xC5E79b8C6475137aC3a982651097a219B63b0c33',
    tUSDT: '0x677693fbFDe6a9EeA655033fffF93054B559552C',
    tWETH: '0xcE5Df8e83B87f462835b51Ac6B2A4c53fafA620F',
  },
  arbitrum: {
    wZION: CONTRACTS.wZION,
    USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    WETH: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  },
  bsc: {
    wZION: CONTRACTS.wZION,
    USDT: '0x55d398326f99059fF775485246999027B3197955',
  },
  polygon: {
    wZION: CONTRACTS.wZION,
    USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    WMATIC: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
  },
  optimism: {
    wZION: CONTRACTS.wZION,
    USDC: '0x0b2C639c533813f4Aa9D7837CAbe68763ed8Fff1',
    WETH: '0x4200000000000000000000000000000000000006',
  },
  avalanche: {
    wZION: CONTRACTS.wZION,
    USDC: '0xB97EF9Ef8734C71904D800722F4eF32e8f4A1B44',
    WAVAX: '0xB31f66AA3C1e785abF6950e3C83D0d7b48bb84a9',
  },
  solana: {
    ZION: null,
    USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    SOL: null,
    USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  },
  tron: {
    ZION: null,
    USDT: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    TRX: null,
  },
  stellar: { ZION: null, USDC: null, XLM: null },
  cardano: { ZION: null, ADA: null },
  cosmos: { ZION: null, ATOM: null },
  aptos: { ZION: null, USDC: null, APT: null },
  sui: { ZION: null, USDC: null, SUI: null },
  near: { ZION: null, USDC: null, NEAR: null },
  ton: { ZION: null, USDT: null, TON: null },
  zion: { ZION: null },
  bitcoin: { BTC: null },
  lightning: { BTC: null },
};

// Map UI chain ids to the canonical ChainId enum strings used by the Rust API.
export const CHAIN_API_NAMES: Record<string, string> = {
  zion: 'zion_l1',
  base: 'base',
  arbitrum: 'arbitrum',
  bsc: 'bsc',
  polygon: 'polygon',
  optimism: 'optimism',
  avalanche: 'avalanche',
  solana: 'solana',
  tron: 'tron',
  stellar: 'stellar',
  cardano: 'cardano',
  cosmos: 'cosmos',
  aptos: 'aptos',
  sui: 'sui',
  near: 'near',
  ton: 'ton',
  bitcoin: 'bitcoin',
  lightning: 'lightning',
};

export const API_TO_UI_CHAIN: Record<string, string> = Object.fromEntries(
  Object.entries(CHAIN_API_NAMES).map(([ui, api]) => [api, ui]),
);

// ─── Types matching the Rust backend ────────────────────────────────────────

export interface AssetId {
  chain: string;
  contract: string | null;
  ticker: string;
}

export interface Asset {
  id: AssetId;
  decimals: number;
  name: string;
}

export interface EvmAddress {
  chain: string;
  bytes: number[];
  encoded: string;
}

// ─── Deployed ZIONDex contracts (Base Mainnet) ──────────────────────────────

export const ZIONDEX_FACTORY = CONTRACTS.ZIONDexFactory;
export const ZIONDEX_ROUTER = CONTRACTS.ZIONDexRouter;

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = '/api/swap';

export function getTokenMeta(chain: string, symbol: string) {
  return TOKENS_BY_CHAIN[chain]?.find(t => t.symbol === symbol);
}

export function buildAsset(chain: string, symbol: string): Asset {
  const meta = getTokenMeta(chain, symbol);
  const chainApi = CHAIN_API_NAMES[chain] ?? chain;
  const contract = TOKEN_CONTRACTS[chain]?.[symbol] ?? null;
  return {
    id: {
      chain: chainApi,
      contract,
      ticker: symbol,
    },
    decimals: meta?.decimals ?? 18,
    name: meta?.name ?? symbol,
  };
}

/** Convert a human-readable amount string to atomic (smallest unit) string. */
export function toAtomicAmount(amount: string, decimals: number): string {
  const value = parseFloat(amount);
  if (Number.isNaN(value) || value <= 0) return '0';

  const [intPart = '0', fracPart = ''] = amount.split('.');
  const cleanInt = intPart.replace(/^0+/, '') || '0';
  const cleanFrac = (fracPart || '').replace(/0+$/, '').slice(0, decimals);
  const paddedFrac = cleanFrac.padEnd(decimals, '0');

  if (cleanInt === '0' && !cleanFrac) return '0';
  return (cleanInt + paddedFrac).replace(/^0+/, '') || '0';
}

/** Convert an atomic amount string back to human-readable. */
export function fromAtomicAmount(atomic: string, decimals: number): string {
  const n = BigInt(atomic || '0');
  if (n === 0n) return '0';
  const divisor = 10n ** BigInt(decimals);
  const intPart = n / divisor;
  const fracPart = n % divisor;
  const fracStr = fracPart.toString().padStart(decimals, '0').replace(/0+$/, '');
  return fracStr ? `${intPart}.${fracStr}` : intPart.toString();
}

/** Build an EvmAddress object for the Rust backend. */
export function buildEvmAddress(chain: string, encoded: string): EvmAddress {
  const chainApi = CHAIN_API_NAMES[chain] ?? chain;
  const hex = encoded.replace(/^0x/i, '');
  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.slice(i, i + 2), 16));
  }
  return { chain: chainApi, bytes, encoded };
}

// ─── API calls ──────────────────────────────────────────────────────────────

export interface Pool {
  chain: string;
  dex: string;
  token_a: string;
  token_b: string;
  address: string;
  fee_bps: number;
  enabled: boolean;
  amm_pair?: string | null;
}

export async function fetchPools(): Promise<Pool[]> {
  const resp = await fetch(`${API_BASE}/pools`);
  if (!resp.ok) return [];
  const data = await resp.json();
  return data.pools || [];
}

export interface AddLiquidityParams {
  chain: string;
  routerAddress: string;
  tokenA: string;
  tokenB: string;
  amountADesired: string;
  amountBDesired: string;
  amountAMin?: string;
  amountBMin?: string;
  recipient?: string;
  deadline?: number;
}

export interface AddLiquidityResult {
  ok: boolean;
  tx_hash?: string;
  amount_a?: string;
  amount_b?: string;
  lp_tokens?: string;
  error?: string;
}

export async function addLiquidity(params: AddLiquidityParams): Promise<AddLiquidityResult> {
  const assetA = buildAsset(params.chain, params.tokenA);
  const assetB = buildAsset(params.chain, params.tokenB);
  const body: Record<string, unknown> = {
    chain: CHAIN_API_NAMES[params.chain] ?? params.chain,
    router_address: params.routerAddress,
    token_a: assetA,
    token_b: assetB,
    amount_a_desired: params.amountADesired,
    amount_b_desired: params.amountBDesired,
  };
  if (params.amountAMin) body.amount_a_min = params.amountAMin;
  if (params.amountBMin) body.amount_b_min = params.amountBMin;
  if (params.recipient) body.recipient = buildEvmAddress(params.chain, params.recipient);
  if (params.deadline) body.deadline = params.deadline;

  const resp = await fetch(`${API_BASE}/liquidity/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  return resp.json();
}

export interface RemoveLiquidityParams {
  chain: string;
  routerAddress: string;
  tokenA: string;
  tokenB: string;
  liquidity: string;
  amountAMin?: string;
  amountBMin?: string;
  recipient?: string;
  deadline?: number;
}

export interface RemoveLiquidityResult {
  ok: boolean;
  tx_hash?: string;
  amount_a?: string;
  amount_b?: string;
  error?: string;
}

export async function removeLiquidity(params: RemoveLiquidityParams): Promise<RemoveLiquidityResult> {
  const assetA = buildAsset(params.chain, params.tokenA);
  const assetB = buildAsset(params.chain, params.tokenB);
  const body: Record<string, unknown> = {
    chain: CHAIN_API_NAMES[params.chain] ?? params.chain,
    router_address: params.routerAddress,
    token_a: assetA,
    token_b: assetB,
    liquidity: params.liquidity,
  };
  if (params.amountAMin) body.amount_a_min = params.amountAMin;
  if (params.amountBMin) body.amount_b_min = params.amountBMin;
  if (params.recipient) body.recipient = buildEvmAddress(params.chain, params.recipient);
  if (params.deadline) body.deadline = params.deadline;

  const resp = await fetch(`${API_BASE}/liquidity/remove`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  return resp.json();
}

export interface GetAmmPairResult {
  ok: boolean;
  pair_address: string | null;
  error?: string;
}

export async function getAmmPair(
  chain: string,
  factoryAddress: string,
  tokenA: string,
  tokenB: string,
): Promise<GetAmmPairResult> {
  const assetA = buildAsset(chain, tokenA);
  const assetB = buildAsset(chain, tokenB);
  const body = {
    chain: CHAIN_API_NAMES[chain] ?? chain,
    factory_address: factoryAddress,
    token_a: assetA,
    token_b: assetB,
  };
  const resp = await fetch(`${API_BASE}/amm/pair`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  return resp.json();
}
