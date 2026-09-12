/**
 * ZION Explorer — Lightweight balance API
 *
 * Returns only the wallet snapshot balance for an address (no tx/UTXO history).
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getZionRpc } from '@/lib/zion-rpc';

export async function GET(request: NextRequest) {
  const rpc = getZionRpc();

  try {
    const searchParams = request.nextUrl.searchParams;
    const address = searchParams.get('addr') || searchParams.get('address') || '';

    if (!address) {
      return NextResponse.json({ error: 'Address required' }, { status: 400 });
    }

    const walletSnapshot = await rpc.getWalletSnapshot(address).catch(() => null);

    return NextResponse.json(
      {
        address,
        balance: {
          total: walletSnapshot?.balance_zion ?? 0,
          total_atomic: walletSnapshot?.balance_atomic ?? 0,
          utxo_count: walletSnapshot?.utxo_count ?? 0,
        },
      },
      {
        headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30' },
      },
    );
  } catch (error) {
    console.error('Failed to fetch balance:', error);
    return NextResponse.json({ error: 'Failed to fetch balance' }, { status: 503 });
  }
}
