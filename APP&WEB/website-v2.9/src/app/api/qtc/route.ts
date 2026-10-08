export const dynamic = 'force-dynamic';
export const maxDuration = 15;

import { NextRequest, NextResponse } from 'next/server';
import { blake2b } from '@noble/hashes/blake2.js';

// ── Quantus (QTC) status proxy ─────────────────────────────────────────────
// Server-side aggregation for the public /pool QTC tab. Sources:
//   • local Quantus node RPC (Safe methods) — QTC_RPC_URL
//   • pool /stats auxpow section               — ZION_POOL_API_URL
//   • sqm.quantus.com squid indexer            — QTC_INDEXER_URL
// All upstream calls are bounded; each section fails soft. `?addr=qz…`
// adds System.Account balance + bidirectional history for that address.

const QTC_RPC = process.env.QTC_RPC_URL || 'http://127.0.0.1:9944';
const POOL_API = (process.env.ZION_POOL_API_URL || 'http://127.0.0.1:8080').replace(/\/$/, '');
const QTC_INDEXER = process.env.QTC_INDEXER_URL || 'https://sqm.quantus.com/v1/graphql';
// Public chain data (printed in node logs, visible in the indexer).
const QTC_REWARDS_ADDRESS =
  process.env.QTC_REWARDS_ADDRESS || 'qzk8Rna5KBtuqb5g6eEzEVRAsdbpCo5Mhn7k6eggeR4ZVn2aP';

async function rpc(method: string, params: unknown[] = [], timeoutMs = 4000): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(QTC_RPC, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
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

async function indexer(query: string, timeoutMs = 8000): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(QTC_INDEXER, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'zion-app' },
      body: JSON.stringify({ query }),
      signal: ctrl.signal,
      cache: 'no-store',
    });
    const j = await res.json();
    return j.data || {};
  } catch {
    return {};
  } finally {
    clearTimeout(t);
  }
}

// ── ss58-189 decode → 32-byte account id ───────────────────────────────────
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function ss58DecodeAccount(addr: string): Buffer | null {
  try {
    if (!/^qz[0-9A-Za-z]{40,60}$/.test(addr)) return null;
    let num = 0n;
    for (const ch of addr) {
      const d = B58.indexOf(ch);
      if (d < 0) return null;
      num = num * 58n + BigInt(d);
    }
    let hex = num.toString(16);
    if (hex.length % 2) hex = '0' + hex;
    let raw = Buffer.from(hex, 'hex');
    const zeros = addr.length - addr.replace(/^1+/, '').length;
    raw = Buffer.concat([Buffer.alloc(zeros), raw]);
    if (raw.length !== 35 && raw.length !== 36) return null;
    const plen = (raw[0] & 0x40) === 0 ? 1 : 2;
    const prefix = plen === 1 ? raw[0] : ((raw[0] & 0x3f) << 2) | (raw[1] >> 6) | ((raw[1] & 0x3f) << 8);
    if (prefix !== 189) return null;
    const account = raw.subarray(plen, plen + 32);
    if (account.length !== 32) return null;
    // checksum: blake2b-512("SS58PRE" + prefix+account), first 2 bytes
    const ctx = Buffer.concat([Buffer.from('SS58PRE'), raw.subarray(0, plen + 32)]);
    const sum = Buffer.from(blake2b(ctx, { dkLen: 64 }));
    if (raw[plen + 32] !== sum[0] || raw[plen + 33] !== sum[1]) return null;
    return account;
  } catch {
    return null;
  }
}

// twox128("System") ‖ twox128("Account") — constant on every Substrate chain
const SYS_ACCT_PREFIX = '26aa394eea5630e07c48ae0c9558cef7' + 'b99d880ec681799c0cf30e888fb1cb00';

async function accountBalance(account: Buffer): Promise<{ free_qtc: number; nonce: number } | null> {
  const h16 = Buffer.from(blake2b(account, { dkLen: 16 }));
  const key = '0x' + SYS_ACCT_PREFIX + h16.toString('hex') + account.toString('hex');
  const st = await rpc('state_getStorage', [key]);
  if (typeof st !== 'string' || st.length < 164) {
    return { free_qtc: 0, nonce: 0 }; // no System.Account entry (wormhole-only or unfunded)
  }
  const raw = Buffer.from(st.slice(2), 'hex');
  if (raw.length < 80) return null;
  const nonce = raw.readUInt32LE(0);
  const free = BigInt('0x' + Buffer.from(raw.subarray(16, 32)).reverse().toString('hex') || '0');
  return { free_qtc: Number(free) / 1e12, nonce };
}

const qtc = (v: string | number | null | undefined) => Math.round((Number(v || 0) / 1e12) * 1e6) / 1e6;
const esc = (s: string) => s.replace(/["\\{}]/g, '');

export async function GET(req: NextRequest) {
  const addr = (req.nextUrl.searchParams.get('addr') || '').trim().slice(0, 64);

  const [health, head, version, chain, runtime, poolStats, feed, rewards] = await Promise.all([
    rpc('system_health'),
    rpc('chain_getHeader'),
    rpc('system_version'),
    rpc('system_chain'),
    rpc('state_getRuntimeVersion'),
    fetch(`${POOL_API}/stats`, { cache: 'no-store', signal: AbortSignal.timeout(4000) })
      .then((r) => r.json())
      .catch(() => null),
    indexer('{ transfer(order_by: {timestamp: desc}, limit: 10) { amount fee from_id to_id block_height timestamp extrinsic_id } }'),
    QTC_REWARDS_ADDRESS
      ? indexer(
          `{ transfer(where: {to_id: {_eq: "${esc(QTC_REWARDS_ADDRESS)}"}, extrinsic_id: {_is_null: true}}, order_by: {timestamp: desc}, limit: 8) { amount block_height timestamp leaf_index }
             agg: transfer_aggregate(where: {to_id: {_eq: "${esc(QTC_REWARDS_ADDRESS)}"}, extrinsic_id: {_is_null: true}}) { aggregate { count } } }`
        )
      : Promise.resolve({}),
  ]);

  // ── node ──
  const height = head?.number ? parseInt(head.number, 16) : null;
  const node = {
    ok: !!(health && !health._error),
    peers: health?.peers ?? null,
    syncing: health?.isSyncing ?? null,
    height,
    version: typeof version === 'string' ? version : null,
    chain: typeof chain === 'string' ? chain : null,
    spec_version: runtime?.specVersion ?? null,
    tx_version: runtime?.transactionVersion ?? null,
  };

  // ── pool QTU leg (public /stats → auxpow.coin_details) ──
  let pool: any = { available: false };
  const details = poolStats?.auxpow?.coin_details;
  if (Array.isArray(details)) {
    const c = details.find((x: any) => x.ticker === 'QTU');
    if (c) {
      pool = {
        available: true,
        upstream: c.upstream ?? null,
        upstream_job_id: c.job_id ?? null,
        upstream_job_age_ms: c.job_age_ms ?? null,
        upstream_fresh: c.job_fresh ?? null,
        native: c.native ?? null,
        pending_payouts: poolStats?.external_payouts?.quantus?.pending ?? null,
      };
    }
  }

  // ── rewards (wormhole leaves on our rewards address) ──
  const rwRows = rewards?.transfer ?? [];
  const rewardsOut = {
    address: QTC_REWARDS_ADDRESS || null,
    mined_count: rewards?.agg?.aggregate?.count ?? null,
    last_ts: rwRows[0]?.timestamp ?? null,
    recent: rwRows.map((r: any) => ({
      amount_qtc: qtc(r.amount),
      height: r.block_height,
      ts: r.timestamp,
      leaf: r.leaf_index,
    })),
  };

  // ── network feed ──
  const netRows = feed?.transfer ?? [];
  const networkFeed = netRows.map((r: any) => ({
    amount_qtc: qtc(r.amount),
    from: r.from_id,
    to: r.to_id,
    height: r.block_height,
    ts: r.timestamp,
    is_reward: !r.extrinsic_id,
  }));

  // ── optional per-address lookup ──
  let wallet: any = null;
  if (addr) {
    const account = ss58DecodeAccount(addr);
    if (account) {
      const [bal, hist] = await Promise.all([
        accountBalance(account),
        indexer(
          `{ transfer(where: {_or: [{from_id: {_eq: "${esc(addr)}"}}, {to_id: {_eq: "${esc(addr)}"}}]}, order_by: {timestamp: desc}, limit: 15)
             { amount fee from_id to_id block_height timestamp extrinsic_id leaf_index } }`
        ),
      ]);
      wallet = {
        address: addr,
        valid: true,
        balance: bal,
        history: (hist?.transfer ?? []).map((r: any) => ({
          direction: r.to_id === addr ? 'in' : 'out',
          counterparty: r.to_id === addr ? r.from_id : r.to_id,
          amount_qtc: qtc(r.amount),
          fee_qtc: qtc(r.fee),
          height: r.block_height,
          ts: r.timestamp,
          extrinsic: r.extrinsic_id || null,
          leaf: r.leaf_index || null,
        })),
      };
    } else {
      wallet = { address: addr, valid: false };
    }
  }

  return NextResponse.json(
    { ok: true, ts: Date.now(), node, pool, rewards: rewardsOut, network_feed: networkFeed, wallet },
    { headers: { 'cache-control': 'public, s-maxage=10, stale-while-revalidate=20' } }
  );
}
