/**
 * ZION Explorer — Lightweight balance API
 *
 * Returns only the wallet snapshot balance for an address (no tx/UTXO history).
 * Uses the paged `getWalletSnapshot` (see lib/zion-rpc) so whale wallets with
 * 100k+ UTXOs cannot stall the request.
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getZionRpc } from '@/lib/zion-rpc';
import { cacheControl } from '@/lib/server-cache';

export async function GET(request: NextRequest) {
  const rpc = getZionRpc();

  try {
    const searchParams = request.nextUrl.searchParams;
    const address = (searchParams.get('addr') || searchParams.get('address') || '').trim();

    if (!address) {
      return NextResponse.json(
        { error: 'Address required', hint: 'Použij ?addr=zion1...' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    if (/[…]/.test(address) || address.includes('...') || /\s/.test(address) || !/^[A-Za-z0-9]+$/.test(address)) {
      return NextResponse.json(
        {
          error: 'Address looks truncated',
          hint: 'Vložená adresa obsahuje výpustku nebo mezeru. Zkopíruj celou adresu.',
          code: 'invalid_address',
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    let walletSnapshot;
    try {
      walletSnapshot = await rpc.getWalletSnapshot(address);
    } catch {
      walletSnapshot = null;
    }

    if (!walletSnapshot) {
      return NextResponse.json(
        { error: 'Blockchain node is temporarily unavailable', code: 'node_unavailable', address },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    return NextResponse.json(
      {
        address,
        balance: {
          total: walletSnapshot.balance_zion ?? 0,
          total_atomic: walletSnapshot.balance_atomic ?? 0,
          utxo_count: walletSnapshot.utxo_count ?? 0,
        },
        partial: walletSnapshot.utxos_failed ?? false,
        chain_height: walletSnapshot.chain_height ?? 0,
      },
      {
        headers: { 'Cache-Control': cacheControl({ maxAge: 10, sMaxAge: 10, swr: 30 }) },
      },
    );
  } catch (error) {
    console.error('Failed to fetch balance:', error);
    return NextResponse.json(
      { error: 'Failed to fetch balance', code: 'internal_error' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
