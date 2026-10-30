import { NextResponse } from 'next/server';

const OASIS = process.env.OASIS_API_URL ?? 'https://oasis.zionterranova.com';

export async function GET() {
  try {
    const upstream = await fetch(`${OASIS.replace(/\/$/, '')}/api/v1/oasis/worlds`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json' },
    });
  } catch {
    return NextResponse.json({ success: false, data: [] }, { status: 502 });
  }
}
