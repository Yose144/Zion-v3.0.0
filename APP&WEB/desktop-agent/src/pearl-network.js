// Pearl (PRL) network status for the Desktop Agent.
//
// Primary source: the public aggregate endpoint
//   GET https://app.zionterranova.com/api/prl[?addr=prl1…]
// which merges pearld node health (height/difficulty/hashps/peers) with the
// pool's native + upstream Pearl legs and optional per-address wallet data.
// Main-process fetch — no CORS, single call per refresh.
//
// Fallback: none direct — pearld RPC is localhost-only on the pool node and
// no public PRL RPC endpoint exists yet. If the app API is down we report
// `unreachable` and the UI degrades gracefully.

const APP_API_BASE = (process.env.ZION_APP_API_URL || 'https://app.zionterranova.com').replace(/\/+$/, '');

function _fetch(url, timeoutMs = 9000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  return fetch(url, { headers: { accept: 'application/json' }, signal: ctrl.signal })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
    .finally(() => clearTimeout(t));
}

/**
 * Fetch the aggregated PRL status.
 * @param {string} [addr] optional prl1… address — adds wallet balance+history
 * @returns {{ok:boolean, source:string, node?:object, pool?:object, wallet?:object, blocks?:object, ts:number}}
 */
async function fetchPrlStatus(addr) {
  const safe = (addr || '').trim().slice(0, 90);
  const url = `${APP_API_BASE}/api/prl${safe ? `?addr=${encodeURIComponent(safe)}` : ''}`;
  const [data, blocks] = await Promise.all([
    _fetch(url),
    _fetch(`${APP_API_BASE}/api/blocks?limit=30`),
  ]);
  if (data && data.ok) {
    return { ...data, source: 'app-api', blocks: blocks && blocks.ok ? blocks : null };
  }
  return {
    ok: false,
    source: 'unreachable',
    ts: Date.now(),
    node: null,
    pool: { available: false },
    wallet: safe ? { address: safe, valid: null } : null,
    blocks: null,
  };
}

module.exports = { fetchPrlStatus };
