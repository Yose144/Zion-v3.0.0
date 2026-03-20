export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { SITE_VERSION } from '@/lib/site';
import { getZionRpc } from '@/lib/zion-rpc';

type DependencyStatus = {
  healthy: boolean;
  host?: string;
  port?: number;
  error?: string;
  meta?: Record<string, unknown>;
};

async function checkRpc(): Promise<DependencyStatus> {
  try {
    const rpc = getZionRpc();
    const info = await rpc.getInfo();
    return { healthy: true, meta: { height: info.height, status: info.status } };
  } catch (e) {
    return { healthy: false, error: e instanceof Error ? e.message : 'rpc check failed' };
  }
}

async function checkPool(): Promise<DependencyStatus> {
  try {
    const rpc = getZionRpc();
    const stats = await rpc.getPoolStats();
    return { healthy: !!stats, meta: { accepted: stats?.routing?.accepted ?? 0 } };
  } catch (e) {
    return { healthy: false, error: e instanceof Error ? e.message : 'pool check failed' };
  }
}

export async function GET() {
  const [rpc, mining_pool] = await Promise.all([checkRpc(), checkPool()]);

  const ok = rpc.healthy && mining_pool.healthy;
  const degraded = (rpc.healthy && !mining_pool.healthy) || (!rpc.healthy && mining_pool.healthy);

  const status = ok ? 'ok' : degraded ? 'degraded' : 'down';

  return NextResponse.json({
    status,
    version: process.env.NEXT_PUBLIC_APP_VERSION || SITE_VERSION,
    environment: process.env.NODE_ENV || 'production',
    uptime_seconds: Math.floor(process.uptime()),
    dependencies: {
      rpc_node: rpc,
      mining_pool,
    },
  });
}
