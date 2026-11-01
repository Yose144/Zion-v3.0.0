import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * ZŮSTATEK ZION PRO HERNÍ HUD.
 *
 * Pozor na past: `getBalance` je **account-model** a u UTXO peněženky vrací 0
 * (viz AGENTS). Jediná správná cesta je `getUtxos` → `total_amount` (flowers).
 * `limit: 0` znamená „nic neposílej, jen součty" — u whale adresy s 96 tisíci
 * UTXO by jinak odpověď měla megabajty.
 */

const PRIMARY = process.env.ZION_RPC_URL ?? 'http://127.0.0.1:9445';
const FALLBACK = process.env.ZION_RPC_URL_FALLBACK ?? 'https://rpc.zionterranova.com';
const FLOWERS_PER_ZION = BigInt(1_000_000);
const ADDRESS_RE = /^zion1[0-9a-z]{20,60}$/;

const attempts = new Map<string, { count: number; reset: number }>();
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 30;

function throttled(ip: string): boolean {
  const now = Date.now();
  if (attempts.size > 1024) {
    for (const [key, value] of attempts) if (value.reset < now) attempts.delete(key);
  }
  const entry = attempts.get(ip);
  if (!entry || entry.reset < now) {
    attempts.set(ip, { count: 1, reset: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

async function totalAt(url: string, address: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getUtxos',
        params: { address, limit: 0, offset: 0 },
      }),
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      result?: { total_amount?: string; total_count?: number };
    };
    const total = payload.result?.total_amount;
    if (typeof total !== 'string') return null;
    return { flowers: BigInt(total), utxos: Number(payload.result?.total_count ?? 0) };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** flowers → ZION s rozumnou přesností (BigInt kvůli celkovým částkám nad 2^53). */
function toZion(flowers: bigint): number {
  const whole = Number(flowers / FLOWERS_PER_ZION);
  const fraction = Number(flowers % FLOWERS_PER_ZION) / 1_000_000;
  return Math.round((whole + fraction) * 100) / 100;
}

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (throttled(ip)) {
    return NextResponse.json({ ok: false, reason: 'rate_limited' }, { status: 429 });
  }

  const address = request.nextUrl.searchParams.get('address')?.trim() ?? '';
  if (!ADDRESS_RE.test(address)) {
    return NextResponse.json({ ok: false, reason: 'bad_address' }, { status: 400 });
  }

  for (const [source, url] of [
    ['node', PRIMARY],
    ['public', FALLBACK],
  ] as const) {
    const total = await totalAt(url, address);
    if (!total) continue;
    return NextResponse.json(
      {
        ok: true,
        address,
        zion: toZion(total.flowers),
        flowers: total.flowers.toString(),
        utxos: total.utxos,
        source,
      },
      { headers: { 'cache-control': 'no-store' } },
    );
  }

  // HUD nesmí vypadat rozbitě — vrátíme 200 s `ok:false` a UI ukáže „—".
  return NextResponse.json(
    { ok: false, reason: 'rpc_unavailable' },
    { headers: { 'cache-control': 'no-store' } },
  );
}
