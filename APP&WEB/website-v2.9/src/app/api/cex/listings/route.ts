export const dynamic = 'force-dynamic';
export const revalidate = 300; // cache 5 min

import { NextResponse } from 'next/server';

const HEADERS = { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' };

// ─── CEX Listing Registry ────────────────────────────────────────────────────
// Single source of truth for CEX listing status.
// Update this when exchange status changes.

interface CexListing {
  name: string;
  logo: string;
  url: string;
  status: 'listed' | 'applied' | 'planned' | 'rejected';
  pairs: string[];
  volume24h?: number;
  updated: string;
  notes?: string;
  kyc_required: boolean;
  countries?: string;
  fee_spot?: string;
}

const CEX_LISTINGS: CexListing[] = [
  {
    name: 'XT.COM',
    logo: 'XT',
    url: 'https://www.xt.com',
    status: 'planned',
    pairs: ['ZION/USDT', 'ZION/USDC'],
    updated: '2026-06-29',
    notes: 'Initial listing application prepared. Awaiting token audit completion.',
    kyc_required: true,
    countries: 'Global (excl. US)',
    fee_spot: '0.1%',
  },
  {
    name: 'Azbit',
    logo: 'AZ',
    url: 'https://azbit.com',
    status: 'planned',
    pairs: ['ZION/USDT', 'ZION/BTC'],
    updated: '2026-06-29',
    notes: 'Listing agreement draft stage.',
    kyc_required: true,
    countries: 'Global',
    fee_spot: '0.15%',
  },
  {
    name: 'P2B',
    logo: 'P2',
    url: 'https://p2pb2b.com',
    status: 'planned',
    pairs: ['ZION/USDT'],
    updated: '2026-06-29',
    notes: 'Community vote campaign planned.',
    kyc_required: true,
    countries: 'Global (excl. US)',
    fee_spot: '0.2%',
  },
  {
    name: 'Binance',
    logo: 'BN',
    url: 'https://www.binance.com',
    status: 'planned',
    pairs: ['ZION/USDT', 'ZION/USDC', 'ZION/ETH'],
    updated: '2026-06-29',
    notes: 'Long-term target. Requires full security audit + market cap threshold.',
    kyc_required: true,
    countries: 'Global (excl. US)',
    fee_spot: '0.1%',
  },
  {
    name: 'KuCoin',
    logo: 'KC',
    url: 'https://www.kucoin.com',
    status: 'planned',
    pairs: ['ZION/USDT'],
    updated: '2026-06-29',
    notes: 'Fast-track listing candidate after DEX volume threshold.',
    kyc_required: true,
    countries: 'Global',
    fee_spot: '0.1%',
  },
  {
    name: 'Gate.io',
    logo: 'GT',
    url: 'https://www.gate.io',
    status: 'planned',
    pairs: ['ZION/USDT'],
    updated: '2026-06-29',
    notes: 'Community-driven listing via Gate Startup.',
    kyc_required: true,
    countries: 'Global (excl. US)',
    fee_spot: '0.2%',
  },
];

// ─── DexScreener Integration ─────────────────────────────────────────────────
// Fetches real trading data from DexScreener API for the wZION/WETH pool.

const DEXSCREENER_API = 'https://api.dexscreener.com/latest/dex/tokens';
const WZION_TOKEN = '0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6';

interface DexPair {
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

async function fetchDexData(): Promise<DexPair[]> {
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

export async function GET() {
  try {
    const dexPairs = await fetchDexData();

    // Filter to Base chain pairs only
    const basePairs = dexPairs.filter(p =>
      p.dexId === 'uniswap' &&
      p.baseToken?.address?.toLowerCase() === WZION_TOKEN.toLowerCase()
    );

    // Aggregate DEX stats
    const dexStats = basePairs.length > 0
      ? {
          pairs: basePairs.length,
          total_volume_24h: basePairs.reduce((acc, p) => acc + (p.volume?.h24 ?? 0), 0),
          total_liquidity_usd: basePairs.reduce((acc, p) => acc + (p.liquidity?.usd ?? 0), 0),
          total_txns_24h: basePairs.reduce((acc, p) => {
            const buys = p.txns?.h24?.buys ?? 0;
            const sells = p.txns?.h24?.sells ?? 0;
            return acc + buys + sells;
          }, 0),
          total_buys_24h: basePairs.reduce((acc, p) => acc + (p.txns?.h24?.buys ?? 0), 0),
          total_sells_24h: basePairs.reduce((acc, p) => acc + (p.txns?.h24?.sells ?? 0), 0),
          best_price_usd: basePairs
            .map(p => parseFloat(p.priceUsd ?? '0'))
            .filter(p => p > 0)
            .sort((a, b) => b - a)[0] ?? 0,
          pairs_detail: basePairs.map(p => ({
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
          })),
        }
      : null;

    // CEX summary
    const listedCount = CEX_LISTINGS.filter(e => e.status === 'listed').length;
    const plannedCount = CEX_LISTINGS.filter(e => e.status === 'planned').length;
    const appliedCount = CEX_LISTINGS.filter(e => e.status === 'applied').length;
    const totalPairs = CEX_LISTINGS.reduce((acc, e) => acc + e.pairs.length, 0);

    return NextResponse.json({
      ok: true,
      cex: {
        listings: CEX_LISTINGS,
        summary: {
          total_exchanges: CEX_LISTINGS.length,
          listed: listedCount,
          applied: appliedCount,
          planned: plannedCount,
          total_pairs: totalPairs,
        },
      },
      dex: dexStats
        ? {
            source: 'dexscreener',
            ...dexStats,
          }
        : {
            source: 'unavailable',
            pairs: 0,
            total_volume_24h: 0,
            total_liquidity_usd: 0,
          },
      fetchedAt: Date.now(),
    }, { headers: HEADERS });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to fetch CEX data',
        cex: { listings: CEX_LISTINGS, summary: { total_exchanges: CEX_LISTINGS.length, listed: 0, applied: 0, planned: CEX_LISTINGS.length, total_pairs: 0 } },
        dex: { source: 'error', pairs: 0, total_volume_24h: 0, total_liquidity_usd: 0 },
      },
      { status: 200, headers: HEADERS },
    );
  }
}
