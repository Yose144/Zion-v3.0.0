export const dynamic = 'force-dynamic';
export const maxDuration = 15;

import { NextRequest, NextResponse } from 'next/server';

// ── Pearl (PRL) status proxy ───────────────────────────────────────────────
// Server-side aggregation for the public /pool PRL tab. Sources:
//   • local Pearl node RPC (btcd-style)   — PRL_RPC_URL + PRL_RPC_USER/PASS
//   • pool /stats auxpow.pearl section    — ZION_POOL_API_URL
// All upstream calls are bounded; each section fails soft.

const PRL_RPC = process.env.PRL_RPC_URL || 'http://127.0.0.1:44107';
const PRL_USER = process.env.PRL_RPC_USER || '';
const PRL_PASS = process.env.PRL_RPC_PASS || '';
const POOL_API = (process.env.ZION_POOL_API_URL || 'http://127.0.0.1:8080').replace(/\/$/, '');

async function rpc(method: string, params: unknown[] = [], timeoutMs = 4000): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (PRL_USER) headers['authorization'] = 'Basic ' + Buffer.from(`${PRL_USER}:${PRL_PASS}`).toString('base64');
    const res = await fetch(PRL_RPC, {
      method: 'POST',
      headers,
      body: JSON.stringify({ jsonrpc: '1.0', id: 1, method, params }),
      signal: ctrl.signal,
      cache: 'no-store',
    });
    const j = await res.json();
    return j.error ? { _error: j.error.message || j.error } : j.result;
  } catch (e) {
    return { _error: e instanceof Error ? e.message.slice(0, 120) : 'rpc failed' };
  } finally {
    clearTimeout(t);
  }
}

// pearld subversion "/pearlwire:0.5.0/pearld:1.4.12/" → "pearld 1.4.12"
function parseSubver(s: string | undefined): string | null {
  if (!s) return null;
  const m = s.match(/pearld:([0-9.]+)/);
  return m ? `pearld ${m[1]}` : s.replaceAll('/', '');
}

export async function GET(_req: NextRequest) {
  const [blocks, chainInfo, miningInfo, netInfo, poolStats] = await Promise.all([
    rpc('getblockcount'),
    rpc('getblockchaininfo'),
    rpc('getmininginfo'),
    rpc('getnetworkinfo'),
    fetch(`${POOL_API}/stats`, { cache: 'no-store', signal: AbortSignal.timeout(4000) })
      .then((r) => r.json())
      .catch(() => null),
  ]);

  const rpcOk = typeof blocks === 'number' && !blocks?._error;
  const node = {
    ok: rpcOk && !!chainInfo && !chainInfo._error,
    height: typeof blocks === 'number' ? blocks : (chainInfo?.blocks ?? null),
    headers: chainInfo?.headers ?? null,
    chain: chainInfo?.chain ?? null,
    difficulty: chainInfo?.difficulty ?? miningInfo?.difficulty ?? null,
    best_block: chainInfo?.bestblockhash ?? null,
    mediantime: chainInfo?.mediantime ?? null,
    network_hashps: miningInfo?.networkhashps ?? null,
    mempool_tx: miningInfo?.pooledtx ?? null,
    block_tx: miningInfo?.currentblocktx ?? null,
    connections: netInfo?.connections ?? null,
    version: parseSubver(netInfo?.subversion),
  };

  // ── pool pearl leg (public /stats → auxpow.pearl) ──
  const pearl = poolStats?.auxpow?.pearl;
  const pool = pearl
    ? {
        available: true,
        native: {
          enabled: pearl?.native?.enabled ?? false,
          job_id: pearl?.native?.job_id ?? null,
          job_age_ms: pearl?.native?.job_age_ms ?? null,
          share_pct: pearl?.native?.share_pct ?? null,
        },
        upstream: {
          enabled: pearl?.upstream?.enabled ?? false,
          connected: pearl?.upstream?.connected ?? false,
          job_id: pearl?.upstream?.job_id ?? null,
          job_age_ms: pearl?.upstream?.job_age_ms ?? null,
          pending_submits: pearl?.upstream?.pending_submits ?? null,
        },
        pending_payouts: poolStats?.external_payouts?.pearl?.pending ?? null,
      }
    : { available: false };

  return NextResponse.json(
    { ok: true, ts: Date.now(), node, pool },
    { headers: { 'cache-control': 'public, s-maxage=10, stale-while-revalidate=20' } }
  );
}
