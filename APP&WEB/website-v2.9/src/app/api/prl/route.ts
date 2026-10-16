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

// ── optional per-address wallet lookup (?addr=prl1…) ───────────────────────
// Pearl is a btcd-derived UTXO chain: validateaddress for validity,
// searchrawtransactions (address index) for history, gettxout to
// distinguish spent vs unspent outputs → derived spendable balance.
const PRL_ADDR_RE = /^prl1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{6,87}$/;

async function pearlWallet(addr: string): Promise<any> {
  const wallet: any = { address: addr, valid: false };
  if (!PRL_ADDR_RE.test(addr)) return wallet;

  const va = await rpc('validateaddress', [addr]);
  if (!va || va._error || va.isvalid !== true) return wallet;
  wallet.valid = true;
  wallet.is_script = va.isscript === true;
  wallet.is_witness = va.iswitness === true;

  // Address-indexed history (verbose=1 so vout scriptPubKey addresses decode).
  const raw = await rpc('searchrawtransactions', [addr, 1, 0, 20], 8000);
  const txs: any[] = Array.isArray(raw) ? raw : [];

  const history: any[] = [];
  const outs: { txid: string; n: number; value: number; confirmations: number; blockhash: string | null }[] = [];
  for (const tx of txs) {
    let received = 0;
    let spent = 0;
    const vouts: any[] = Array.isArray(tx?.vout) ? tx.vout : [];
    for (const v of vouts) {
      const addrs: string[] = v?.scriptPubKey?.addresses ?? [];
      if (addrs.includes(addr)) {
        received += Number(v.value || 0);
        outs.push({
          txid: tx.txid,
          n: Number(v.n ?? 0),
          value: Number(v.value || 0),
          confirmations: Number(tx.confirmations || 0),
          blockhash: tx.blockhash ?? null,
        });
      }
    }
    const vins: any[] = Array.isArray(tx?.vin) ? tx.vin : [];
    for (const vi of vins) {
      const addrs: string[] = vi?.prevout?.scriptPubKey?.addresses ?? [];
      if (addrs.includes(addr)) spent += Number(vi.prevout.value || 0);
    }
    history.push({
      txid: tx.txid ?? null,
      height: null, // txindex replies carry blockhash, not height — resolved via hash below if needed
      blockhash: tx.blockhash ?? null,
      confirmations: Number(tx.confirmations || 0),
      ts: tx.blocktime ? Number(tx.blocktime) * 1000 : (tx.time ? Number(tx.time) * 1000 : null),
      direction: spent > 0 ? 'out' : 'in',
      amount_prl: Math.round((spent > 0 ? spent : received) * 1e8) / 1e8,
    });
  }

  // UTXO balance: gettxout returns null for spent outputs — check the last
  // 40 received outputs (bounded) and sum the unspent ones.
  let balance = 0;
  let unspent = 0;
  const recent = outs.slice(0, 40);
  const spentChecks = await Promise.all(
    recent.map((o) => rpc('gettxout', [o.txid, o.n], 3000))
  );
  recent.forEach((o, i) => {
    const r = spentChecks[i];
    if (r && !r._error) {
      balance += o.value;
      unspent += 1;
    }
  });

  wallet.balance = {
    confirmed_prl: Math.round(balance * 1e8) / 1e8,
    utxo_checked: recent.length,
    utxo_unspent: unspent,
    note: outs.length > recent.length ? `balance covers latest ${recent.length} of ${outs.length} outputs` : null,
  };
  wallet.history = history;
  return wallet;
}

export async function GET(_req: NextRequest) {
  const addr = (_req.nextUrl.searchParams.get('addr') || '').trim().slice(0, 90);
  const [blocks, chainInfo, miningInfo, netInfo, poolStats, wallet] = await Promise.all([
    rpc('getblockcount'),
    rpc('getblockchaininfo'),
    rpc('getmininginfo'),
    rpc('getnetworkinfo'),
    fetch(`${POOL_API}/stats`, { cache: 'no-store', signal: AbortSignal.timeout(4000) })
      .then((r) => r.json())
      .catch(() => null),
    addr ? pearlWallet(addr) : Promise.resolve(null),
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
    { ok: true, ts: Date.now(), node, pool, wallet },
    { headers: { 'cache-control': 'public, s-maxage=10, stale-while-revalidate=20' } }
  );
}
