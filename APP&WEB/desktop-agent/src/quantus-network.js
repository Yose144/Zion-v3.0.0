// Quantus (QTC) network status for the Desktop Agent.
//
// Primary source: the public aggregate endpoint
//   GET https://app.zionterranova.com/api/qtc[?addr=qz…]
// which already merges node health, the pool's native Quantus leg,
// wormhole rewards, the indexer network feed and optional per-address
// balance+history. Main-process fetch — no CORS, single call per refresh.
//
// Fallback: if the app API is unreachable we still probe the public
// Quantus RPC directly for a minimal node liveness picture (height,
// peers, spec version). Everything fails soft — callers get whatever
// sections could be fetched.

const APP_API_BASE = (process.env.ZION_APP_API_URL || 'https://app.zionterranova.com').replace(/\/+$/, '');
const PUBLIC_RPC = process.env.QTC_PUBLIC_RPC || 'https://rpc.zionterranova.com/qtc';

function _fetch(url, opts = {}, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  return fetch(url, { ...opts, signal: ctrl.signal })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
    .finally(() => clearTimeout(t));
}

async function _rpcFallback() {
  const call = (method) =>
    _fetch(
      PUBLIC_RPC,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: [] }),
      },
      4000
    );
  const [health, head, version] = await Promise.all([
    call('system_health'),
    call('chain_getHeader'),
    call('system_version'),
  ]);
  if (!head?.result?.number && !health?.result) return null;
  return {
    ok: true,
    peers: health?.result?.peers ?? null,
    syncing: health?.result?.isSyncing ?? null,
    height: head?.result?.number ? parseInt(head.result.number, 16) : null,
    version: version?.result ?? null,
    chain: 'Quantus',
    spec_version: null,
    tx_version: null,
    _source: 'rpc-fallback',
  };
}

/**
 * Fetch the aggregated QTC status.
 * @param {string} [addr] optional qz… address — adds wallet balance + history
 * @returns {{ok:boolean, source:string, node?:object, pool?:object, rewards?:object, network_feed?:array, wallet?:object, ts:number}}
 */
async function fetchQtcStatus(addr) {
  const safe = (addr || '').trim().slice(0, 64);
  const url = `${APP_API_BASE}/api/qtc${safe ? `?addr=${encodeURIComponent(safe)}` : ''}`;
  const data = await _fetch(url, { headers: { accept: 'application/json' } }, 9000);
  if (data && data.ok) {
    return { ...data, source: 'app-api' };
  }
  // App API down — degrade to node-only via the public RPC.
  const node = await _rpcFallback();
  return {
    ok: !!node,
    source: node ? 'rpc-fallback' : 'unreachable',
    ts: Date.now(),
    node,
    pool: { available: false },
    rewards: { address: null, mined_count: null, last_ts: null, recent: [] },
    network_feed: [],
    wallet: safe ? { address: safe, valid: null } : null,
  };
}

module.exports = { fetchQtcStatus };
