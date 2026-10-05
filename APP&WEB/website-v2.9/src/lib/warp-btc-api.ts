/**
 * WARP BTC/ZION atomic swap API client.
 *
 * Talks to the Next.js proxy `/api/swap/btc/*` which forwards to
 * `/v1/multichain/swaps/btc/*` on the multichain daemon (port 8454).
 *
 * Flow (BTC → ZION):
 *   1. requestBtcQuote('btc_to_zion', sats) → signed operator quote
 *   2. submitBtcOffer({...quote, hashlock, user pubkeys}) → swap record
 *      with `btc_htlc_address` — user deposits BTC there
 *   3. Operator counter-locks ZION; user claims it via the generic HTLC
 *      claim endpoint (submitClaim in swap-api.ts) revealing the preimage
 *   4. Operator sees the revealed preimage and claims the BTC lock
 *
 * ZION → BTC: the user locks ZION first (generic HTLC lock flow), passes
 * `user_zion_lock_txid`, then claims BTC on-chain from their own wallet.
 */

export type BtcSwapDirection = 'btc_to_zion' | 'zion_to_btc';

export interface BtcSwapQuote {
  quote_id: string;
  direction: string;
  btc_sats: number;
  zion_flowers: number;
  expires_at: number;
  signer_pubkey_hex: string;
  signature_hex: string;
}

export interface BtcSwapRecord {
  swap_id: string;
  direction: BtcSwapDirection | string;
  phase: string;
  hashlock: string;
  btc_htlc_address: string;
  btc_cltv_timeout: number;
  btc_sats: number;
  zion_flowers: number;
  zion_timeout_ts: number;
  user_zion_address: string;
  btc_lock?: {
    txid: string;
    vout: number;
    value_sats: number;
    confirmations: number;
    block_height: number;
  } | null;
  zion_lock_tx?: string | null;
  btc_settle_tx?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BtcSwapListResponse {
  enabled: boolean;
  swaps: BtcSwapRecord[];
}

export interface BtcSwapMetrics {
  enabled: boolean;
  total?: number;
  active?: number;
  phases?: Record<string, number>;
  swaps_near_deadline?: number;
  swaps_stale?: number;
}

const SWAP_BASE = '/api/swap';

async function swapFetch(path: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`${SWAP_BASE}${path}`, { ...init, signal: controller.signal });
    clearTimeout(tid);
    return res;
  } catch (e) {
    clearTimeout(tid);
    throw e;
  }
}

export async function getBtcSwapList(): Promise<BtcSwapListResponse | null> {
  try {
    const res = await swapFetch('/btc/list', { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function getBtcSwapMetrics(): Promise<BtcSwapMetrics | null> {
  try {
    const res = await swapFetch('/btc/metrics', { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function getBtcSwap(swapId: string): Promise<BtcSwapRecord | null> {
  try {
    const res = await swapFetch(`/btc/${encodeURIComponent(swapId)}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function requestBtcQuote(
  direction: BtcSwapDirection,
  btcSats: number,
): Promise<{ ok: boolean; quote?: BtcSwapQuote; error?: string }> {
  try {
    const res = await swapFetch('/btc/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction, btc_sats: btcSats }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data.message || `Quote failed (${res.status})` };
    }
    return { ok: true, quote: data.quote as BtcSwapQuote };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error' };
  }
}

export interface BtcOfferInput {
  direction: BtcSwapDirection;
  hashHex: string;
  btcSats: number;
  zionFlowers: number;
  userBtcPubkeyHex: string;
  userZionPubkeyHex: string;
  userZionAddress: string;
  zionTimeoutTs: number;
  quote: BtcSwapQuote;
  userZionLockTxid?: string;
}

export async function submitBtcOffer(
  input: BtcOfferInput,
): Promise<{ ok: boolean; record?: BtcSwapRecord; error?: string }> {
  try {
    const res = await swapFetch('/btc/offer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        direction: input.direction,
        hash_hex: input.hashHex,
        btc_sats: input.btcSats,
        zion_flowers: input.zionFlowers,
        user_btc_pubkey_hex: input.userBtcPubkeyHex,
        user_zion_pubkey_hex: input.userZionPubkeyHex,
        user_zion_address: input.userZionAddress,
        zion_timeout_ts: input.zionTimeoutTs,
        quote: input.quote,
        ...(input.userZionLockTxid ? { user_zion_lock_txid: input.userZionLockTxid } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data.message || `Offer failed (${res.status})` };
    }
    return { ok: true, record: data as BtcSwapRecord };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error' };
  }
}
