/**
 * Shared DEX market data helpers.
 *
 * Used by:
 *  - /api/cex/listings
 *  - /api/listing/coingecko
 *  - /api/listing/coinmarketcap
 *
 * Fetches canonical wZION pool data from DexScreener and returns a
 * normalised market snapshot including best price, 24h volume, liquidity,
 * and weighted price change.
 */

const DEXSCREENER_API = 'https://api.dexscreener.com/latest/dex/tokens';

// wZION on Base (canonical EVM wrapper)
export const WZION_TOKEN = '0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6';

// Canonical Uniswap V3 pools on Base — only these are official.
// All other wZION pools (wrong fee tiers, inverted price, dust) are filtered out.
export const CANONICAL_POOLS = new Set([
  '0x186b46c2f04153999d44d25179cd623fd62bfda2', // wZION/USDT 0.3%  (primary)
  '0x18c0daef295e63f1bfbc7c39e71d0fabf4600699', // wZION/WETH 1.0%  (secondary)
  '0xf38c56bbbbbc6d9fa11e7de84bf7bb70e1e8d2b3', // wZION/SOL  0.01% (tertiary)
]);

export const FALLBACK_PRICE_USD = 0.0002;

interface DexPairRaw {
  pairAddress: string;
  dexId: string;
  baseToken: { address: string; symbol: string; name: string };
  quoteToken: { address: string; symbol: string; name: string };
  priceUsd?: string;
  priceNative?: string;
  liquidity?: { usd?: number; base?: number; quote?: number };
  volume?: { h24?: number; h6?: number; h1?: number; m15?: number };
  priceChange?: { h24?: number; h6?: number; h1?: number; m15?: number };
  txns?: { h24?: { buys?: number; sells?: number } };
  pairCreatedAt?: number;
  fdv?: number;
  marketCap?: number;
}

export interface DexPairDetail {
  address: string;
  dex: string;
  pair: string;
  price_usd: number;
  price_native: string;
  liquidity_usd: number;
  volume_24h: number;
  volume_6h: number;
  volume_1h: number;
  price_change_24h: number;
  price_change_1h: number;
  txns_24h: { buys: number; sells: number };
  fdv: number;
  market_cap: number;
  created_at: number;
}

export interface DexMarketData {
  source: 'dexscreener' | 'fallback';
  pairs: number;
  total_volume_24h: number;
  total_liquidity_usd: number;
  total_txns_24h: number;
  total_buys_24h: number;
  total_sells_24h: number;
  best_price_usd: number;
  price_change_24h: number;
  price_change_1h: number;
  pairs_detail: DexPairDetail[];
}

async function fetchDexPairsRaw(): Promise<DexPairRaw[]> {
  try {
    const res = await fetch(`${DEXSCREENER_API}/${WZION_TOKEN}`, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json?.pairs ?? [];
  } catch {
    return [];
  }
}

function isCanonicalBasePair(p: DexPairRaw): boolean {
  return (
    p.dexId === 'uniswap' &&
    p.baseToken?.address?.toLowerCase() === WZION_TOKEN.toLowerCase() &&
    CANONICAL_POOLS.has(p.pairAddress?.toLowerCase() ?? '')
  );
}

function parseBestPrice(basePairs: DexPairRaw[]): number {
  const order = [
    '0x18c0daef295e63f1bfbc7c39e71d0fabf4600699', // WETH
    '0x186b46c2f04153999d44d25179cd623fd62bfda2', // USDT
    '0xf38c56bbbbbc6d9fa11e7de84bf7bb70e1e8d2b3', // SOL
  ];
  for (const addr of order) {
    const p = basePairs.find((x) => x.pairAddress?.toLowerCase() === addr);
    const price = parseFloat(p?.priceUsd ?? '0');
    if (price > 0) return price;
  }
  const any = basePairs.find((p) => parseFloat(p.priceUsd ?? '0') > 0);
  if (any) return parseFloat(any.priceUsd ?? '0');
  return 0;
}

function weightedChange(basePairs: DexPairRaw[], field: 'h24' | 'h1'): number {
  const totalVolume = basePairs.reduce((acc, p) => acc + (p.volume?.[field] ?? 0), 0);
  if (totalVolume <= 0) return 0;
  const weighted = basePairs.reduce(
    (acc, p) => acc + (p.priceChange?.[field] ?? 0) * (p.volume?.[field] ?? 0),
    0,
  );
  return weighted / totalVolume;
}

export async function fetchDexMarketData(): Promise<DexMarketData> {
  const rawPairs = await fetchDexPairsRaw();

  // Filter to canonical Base chain pairs only — exclude rogue/dust pools
  const basePairs = rawPairs.filter(isCanonicalBasePair);

  if (basePairs.length === 0) {
    return {
      source: 'fallback',
      pairs: 0,
      total_volume_24h: 0,
      total_liquidity_usd: 0,
      total_txns_24h: 0,
      total_buys_24h: 0,
      total_sells_24h: 0,
      best_price_usd: FALLBACK_PRICE_USD,
      price_change_24h: 0,
      price_change_1h: 0,
      pairs_detail: [],
    };
  }

  const totalVolume24h = basePairs.reduce((acc, p) => acc + (p.volume?.h24 ?? 0), 0);
  const totalLiquidity = basePairs.reduce((acc, p) => acc + (p.liquidity?.usd ?? 0), 0);
  const totalBuys = basePairs.reduce((acc, p) => acc + (p.txns?.h24?.buys ?? 0), 0);
  const totalSells = basePairs.reduce((acc, p) => acc + (p.txns?.h24?.sells ?? 0), 0);

  const bestPrice = parseBestPrice(basePairs) || FALLBACK_PRICE_USD;

  const pairsDetail: DexPairDetail[] = basePairs.map((p) => ({
    address: p.pairAddress,
    dex: p.dexId,
    pair: `${p.baseToken.symbol}/${p.quoteToken.symbol}`,
    price_usd: parseFloat(p.priceUsd ?? '0'),
    price_native: p.priceNative ?? '0',
    liquidity_usd: p.liquidity?.usd ?? 0,
    volume_24h: p.volume?.h24 ?? 0,
    volume_6h: p.volume?.h6 ?? 0,
    volume_1h: p.volume?.h1 ?? 0,
    price_change_24h: p.priceChange?.h24 ?? 0,
    price_change_1h: p.priceChange?.h1 ?? 0,
    txns_24h: {
      buys: p.txns?.h24?.buys ?? 0,
      sells: p.txns?.h24?.sells ?? 0,
    },
    fdv: p.fdv ?? 0,
    market_cap: p.marketCap ?? 0,
    created_at: p.pairCreatedAt ?? 0,
  }));

  return {
    source: 'dexscreener',
    pairs: basePairs.length,
    total_volume_24h: totalVolume24h,
    total_liquidity_usd: totalLiquidity,
    total_txns_24h: totalBuys + totalSells,
    total_buys_24h: totalBuys,
    total_sells_24h: totalSells,
    best_price_usd: bestPrice,
    price_change_24h: weightedChange(basePairs, 'h24'),
    price_change_1h: weightedChange(basePairs, 'h1'),
    pairs_detail: pairsDetail,
  };
}
