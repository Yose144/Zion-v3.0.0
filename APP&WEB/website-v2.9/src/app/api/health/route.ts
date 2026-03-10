export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { SITE_VERSION } from '@/lib/site';

// Use actual production URLs - Helsinki server
const POOL_API =
  process.env.ZION_INTERNAL_POOL_URL || process.env.POOL_API_URL || 'http://77.42.31.72:8080';
const RPC_URL =
  process.env.ZION_INTERNAL_RPC_URL || process.env.BLOCKCHAIN_RPC_URL || 'http://77.42.31.72:8444/jsonrpc';

type DependencyStatus = {
  healthy: boolean;
  host?: string;
  port?: number;
  error?: string;
  meta?: Record<string, unknown>;
};

function parseHostPort(rawUrl: string): { host?: string; port?: number } {
  try {
    const url = new URL(rawUrl);
    const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80;
    return { host: url.hostname, port };
  } catch {
    return {};
  }
}

async function checkPool(): Promise<DependencyStatus> {
  const { host, port } = parseHostPort(POOL_API);

  try {
    const res = await fetch(`${POOL_API.replace(/\/$/, '')}/stats`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(2500),
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      return { healthy: false, host, port, error: `HTTP ${res.status}` };
    }

    const json = (await res.json()) as any;
    const height = json?.blockchain?.height ?? json?.block_height ?? null;

    return { healthy: true, host, port, meta: { height } };
  } catch (e) {
    return { healthy: false, host, port, error: e instanceof Error ? e.message : 'pool check failed' };
  }
}

async function checkRpc(): Promise<DependencyStatus> {
  const { host, port } = parseHostPort(RPC_URL);

  try {
    const res = await fetch(RPC_URL, {
      method: 'POST',
      cache: 'no-store',
      signal: AbortSignal.timeout(2500),
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: '1', method: 'get_info', params: [] }),
    });

    if (!res.ok) {
      return { healthy: false, host, port, error: `HTTP ${res.status}` };
    }

    const json = (await res.json()) as any;
    const height = json?.result?.height;

    return { healthy: json?.result?.status === 'OK', host, port, meta: { height } };
  } catch (e) {
    return { healthy: false, host, port, error: e instanceof Error ? e.message : 'rpc check failed' };
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
