export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { PROTO_VERSION } from '@/core/net/protocol';

/**
 * Health endpoint pro monitoring.
 *
 * Vrací stav klienta a reálný stav realtime služby `zion-nirvana-net`.
 * `PROTO_VERSION` je zde schválně: klient i služba importují stejný
 * soubor, takže rozjetá verze (klient > server) se pozná právě tady —
 * viz `scripts/ops/nirvana-proto-check.sh`.
 */
const NET_HEALTH_URL = process.env.ZION_NET_HEALTH_URL ?? 'http://127.0.0.1:3011';

type NetStatus = {
  ok: boolean;
  proto?: number;
  connections?: number;
  rooms?: number;
  error?: string;
};

async function checkNet(): Promise<NetStatus> {
  try {
    const res = await fetch(`${NET_HEALTH_URL}/net/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(2_000),
    });
    if (!res.ok) return { ok: false, error: `http ${res.status}` };
    const body = (await res.json()) as Partial<NetStatus>;
    return {
      ok: true,
      proto: body.proto,
      connections: body.connections,
      rooms: body.rooms,
    };
  } catch {
    return { ok: false, error: 'unreachable' };
  }
}

export async function GET() {
  const net = await checkNet();
  const protoMatch = net.proto === PROTO_VERSION;
  const healthy = net.ok && protoMatch;

  return NextResponse.json(
    {
      ok: healthy,
      service: 'zion-nirvana',
      proto: PROTO_VERSION,
      net,
      // klient i server musí mluvit stejnou verzí protokolu
      proto_match: protoMatch,
    },
    { status: healthy ? 200 : 503, headers: { 'cache-control': 'no-store' } },
  );
}
