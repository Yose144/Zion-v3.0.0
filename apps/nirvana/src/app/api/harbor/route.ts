import { NextResponse } from 'next/server';

const BASE = (
  process.env.FREE_WORLD_PUBLIC_URL ?? 'https://app.zionterranova.com/api/free-world'
).replace(/\/$/, '');

async function pull(path: string): Promise<unknown> {
  const res = await fetch(`${BASE}/${path}`, {
    method: 'GET',
    cache: 'no-store',
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function GET() {
  try {
    const [grants, fund] = await Promise.all([pull('grants'), pull('fund/balance')]);
    if (grants == null && fund == null) {
      return NextResponse.json({ ok: false, grants: null, fund: null }, { status: 502 });
    }
    return NextResponse.json({ grants, fund }, { headers: { 'cache-control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false, grants: null, fund: null }, { status: 502 });
  }
}
