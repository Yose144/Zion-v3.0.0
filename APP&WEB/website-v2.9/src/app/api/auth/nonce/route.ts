/**
 * GET /api/auth/nonce?address=zion1...
 *
 * Returns a challenge nonce for wallet-based authentication.
 * The client must sign this nonce with their Ed25519 private key
 * and submit the signature to /api/auth/wallet.
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createNonce, cleanupNonces } from '@/lib/auth-storage';

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address');
  if (!address || !address.startsWith('zion1')) {
    return NextResponse.json({ error: 'Valid zion1 address required' }, { status: 400 });
  }

  // Cleanup old nonces occasionally
  cleanupNonces().catch(() => {});

  try {
    const nonce = await createNonce(address);
    return NextResponse.json({ nonce, address });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to generate nonce' }, { status: 500 });
  }
}
