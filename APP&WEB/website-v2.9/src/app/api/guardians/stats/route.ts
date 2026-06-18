import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/guardians/stats
 * Returns current 144k Guardians registry stats
 * 
 * NOTE: This endpoint is a stub — the DAO Guardians registry is not yet
 * implemented. Returns 501 Not Implemented until the registry is live.
 */
export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: 'Guardians registry not yet implemented',
      message: 'The 144k Guardians DAO registry is under development. This endpoint will return real data once the registry smart contract is deployed.',
      data: null,
      timestamp: new Date().toISOString(),
    },
    { status: 501 }
  );
}
