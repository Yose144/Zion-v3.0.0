import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const GATEWAY =
  process.env.HIRAN_GATEWAY_URL?.trim().replace(/\/$/, '') ||
  'https://market.zionterranova.com';
/** Loopback on EDGE2 (nginx only exposes /v1/* publicly). */
const GATEWAY_INTERNAL =
  process.env.HIRAN_GATEWAY_INTERNAL?.trim().replace(/\/$/, '') ||
  'http://127.0.0.1:8007';

/** Static catalog fallback when gateway omits offline aliases. */
const KNOWN = [
  {
    id: 'hiran-mini',
    role: 'chat',
    context: 12288,
    price: 0.4,
    tags: ['live', 'hiran'],
  },
  {
    id: 'hiran-coder',
    role: 'code',
    context: 16384,
    price: 0.8,
    tags: ['coder'],
  },
  {
    id: 'hiran-amitabha',
    role: 'reason',
    context: 32768,
    price: 1.2,
    mockup: true,
    tags: ['trinity'],
  },
  {
    id: 'hiran-issobella',
    role: 'code',
    context: 32768,
    price: 1.5,
    mockup: true,
    tags: ['trinity'],
  },
  {
    id: 'hiran-maitreya',
    role: 'teacher',
    context: 32768,
    price: 1.2,
    mockup: true,
    tags: ['trinity'],
  },
];

/**
 * GET /api/hiran/models — proxy gateway /v1/models + /health for Market UI.
 */
export async function GET() {
  let modelsRaw: unknown = null;
  let healthRaw: unknown = null;
  let gatewayOk = false;

  try {
    const mRes = await fetch(`${GATEWAY}/v1/models`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (mRes.ok) {
      modelsRaw = await mRes.json();
      gatewayOk = true;
    }
  } catch {
    /* public /v1 failed */
  }

  try {
    const hRes = await fetch(`${GATEWAY_INTERNAL}/health`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    });
    if (hRes.ok) {
      healthRaw = await hRes.json();
      gatewayOk = true;
    }
  } catch {
    /* internal health only on EDGE2 */
  }

  const fromGw = new Map<string, Record<string, unknown>>();
  const data = (modelsRaw as { data?: unknown[] } | null)?.data;
  if (Array.isArray(data)) {
    for (const row of data) {
      if (row && typeof row === 'object' && 'id' in row) {
        const id = String((row as { id: string }).id);
        fromGw.set(id, row as Record<string, unknown>);
      }
    }
  }

  const upstreams = Array.isArray(
    (healthRaw as { upstreams?: unknown } | null)?.upstreams,
  )
    ? ((healthRaw as { upstreams: { alias?: string; live?: boolean }[] }).upstreams)
    : [];

  const aliasLive = new Map<string, boolean>();
  for (const u of upstreams) {
    if (!u?.alias) continue;
    const prev = aliasLive.get(u.alias) ?? false;
    aliasLive.set(u.alias, prev || Boolean(u.live));
  }

  const models = KNOWN.map((k) => {
    const gw = fromGw.get(k.id);
    const live =
      gw != null
        ? Boolean(gw['x-available'])
        : (aliasLive.get(k.id) ?? false);
    const mockup = Boolean(k.mockup || gw?.['x-mockup']);
    return {
      id: k.id,
      object: 'model',
      owned_by: 'hiranyagarbha',
      'x-context': Number(gw?.['x-context'] ?? k.context),
      'x-price-1m-usd': Number(gw?.['x-price-1m-usd'] ?? k.price),
      'x-role': String(gw?.['x-role'] ?? k.role),
      'x-tags': (gw?.['x-tags'] as string[]) ?? k.tags,
      'x-mockup': mockup,
      'x-available': mockup ? false : live,
      'x-degraded': Boolean(gw?.['x-degraded']),
    };
  });

  const miniLive = models.find((m) => m.id === 'hiran-mini')?.['x-available'] ?? false;
  const coderLive = models.find((m) => m.id === 'hiran-coder')?.['x-available'] ?? false;

  return NextResponse.json({
    success: true,
    data: {
      gateway_ok: gatewayOk,
      gateway_url: GATEWAY,
      badge: {
        mini: miniLive ? 'live' : gatewayOk ? 'down' : 'unreachable',
        coder: coderLive ? 'live' : 'offline',
      },
      models,
      settlement: 'dry-run',
      settlement_note:
        'Token settlement ZION/L2 is dry-run; billing today = Stripe / Base USDC plan tiers.',
    },
  });
}
