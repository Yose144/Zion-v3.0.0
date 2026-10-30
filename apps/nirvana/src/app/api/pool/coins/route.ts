import { NextResponse } from 'next/server';

const POOL = process.env.ZION_POOL_PUBLIC_URL ?? 'https://pool.zionterranova.com';

export async function GET() {
  try {
    const base = POOL.replace(/\/$/, '');
    const [coinsRes, zionRes] = await Promise.all([
      fetch(`${base}/public/v1/coins`, { headers: { Accept: 'application/json' }, cache: 'no-store' }),
      fetch(`${base}/public/v1/coins/zion/stats`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      }),
    ]);
    const coinsBody: unknown = coinsRes.ok ? await coinsRes.json() : { ok: false, coins: [] };
    const coins =
      coinsBody && typeof coinsBody === 'object' ? (coinsBody as Record<string, unknown>) : { coins: [] };
    const zionBody: unknown = zionRes.ok ? await zionRes.json() : null;
    const zion = zionBody && typeof zionBody === 'object' ? zionBody : null;
    return NextResponse.json({ ...coins, zion });
  } catch {
    return NextResponse.json({ ok: false, coins: [] }, { status: 502 });
  }
}
