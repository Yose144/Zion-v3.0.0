import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: 'Endpoint deprecated. Fair launch only.',
    },
    {
      status: 410,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  );
}
