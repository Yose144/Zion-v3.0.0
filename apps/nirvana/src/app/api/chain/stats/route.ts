import { NextResponse } from 'next/server';

const STATS_URL =
  process.env.ZION_EXPLORER_STATS_URL ?? 'https://app.zionterranova.com/api/blockchain/stats';

export async function GET() {
  try {
    const res = await fetch(STATS_URL, { cache: 'no-store', signal: AbortSignal.timeout(8_000) });
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: {
        'content-type': res.headers.get('content-type') ?? 'application/json',
        'cache-control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json({ ok: false }, { status: 502 });
  }
}
