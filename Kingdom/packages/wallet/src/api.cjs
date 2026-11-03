// ZION public HTTPS API client — Kingdom desktop wallet.
// Mirrors apps/desktop-agent/src/main.js fetchWalletSnapshotPublic /
// broadcastTransactionPublic. Runs in the Electron main process only —
// never bundle into renderer or SSR code.

const PUBLIC_API_BASE = process.env.ZION_PUBLIC_API_BASE || 'https://app.zionterranova.com';
const PUBLIC_API_ADDRESS = `${PUBLIC_API_BASE}/api/blockchain/address`;
const PUBLIC_API_BROADCAST = `${PUBLIC_API_BASE}/api/blockchain/broadcast`;

/**
 * GET /api/blockchain/address?address=…
 * Returns the normalized snapshot { balance, utxos, … } or throws.
 */
async function fetchWalletSnapshot(address, timeoutMs = 10_000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${PUBLIC_API_ADDRESS}?address=${encodeURIComponent(address)}`, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`Public API HTTP ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * POST /api/blockchain/broadcast with { transaction, model }.
 */
async function broadcastTransaction(transaction, model, timeoutMs = 15_000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(PUBLIC_API_BROADCAST, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ transaction, model }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      const err = new Error(data.error || `Broadcast HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { fetchWalletSnapshot, broadcastTransaction, PUBLIC_API_BASE };
