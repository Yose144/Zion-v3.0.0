export const dynamic = 'force-dynamic';
export const revalidate = 300; // cache 5 min

import { NextResponse } from 'next/server';
import { fetchDexMarketData, type DexMarketData } from '@/lib/market';

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

// ─── DEX market data
// Shared DEX logic lives in src/lib/market.ts (DexScreener canonical wZION pools).

function buildDexResponse(market: DexMarketData) {
  if (market.source === 'dexscreener') {
    return { ...market };
  }
  return {
    source: 'unavailable',
    pairs: 0,
    total_volume_24h: 0,
    total_liquidity_usd: 0,
  };
}

export async function GET() {
  try {
    const market = await fetchDexMarketData();

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
      dex: buildDexResponse(market),
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
