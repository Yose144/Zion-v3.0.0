/**
 * ZION Atomic Swap (HTLC) API Client
 * Connects to Next.js API proxy which forwards requests to the Rust atomic-swap daemon (port 8452).
 */

export interface HtlcRecord {
  hash_hex: string;
  amount_flowers: number;
  timeout_mins: number;
  target_chain: string;
  recipient_addr: string;
  state: 'locked' | 'claimed' | 'refunded' | 'expired';
  preimage_hex?: string;
  release_tx_id?: string;
  created_at: string;
}

export interface EscrowAddressResponse {
  status: string;
  escrow_address: string;
  memo_format: string;
}

const SWAP_BASE = '/api/swap';

async function swapFetch(path: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${SWAP_BASE}${path}`, {
      ...init,
      signal: controller.signal,
    });
    clearTimeout(tid);
    return res;
  } catch (e) {
    clearTimeout(tid);
    throw e;
  }
}

/** Get the L1 escrow address from daemon */
export async function getEscrowAddress(): Promise<EscrowAddressResponse | null> {
  try {
    const res = await swapFetch('/escrow-address', { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Query HTLC status by hash */
export async function getHtlcStatus(hashHex: string): Promise<HtlcRecord | null> {
  try {
    const res = await swapFetch(`/${hashHex}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return data.htlc || null;
  } catch {
    return null;
  }
}

/** List pending HTLCs */
export async function getPendingHtlcs(): Promise<HtlcRecord[]> {
  try {
    const res = await swapFetch('/pending', { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.htlcs || [];
  } catch {
    return [];
  }
}

/** Submit claim with preimage */
export async function submitClaim(input: {
  hashHex: string;
  preimageHex: string;
  recipient: string;
  token?: string;
}): Promise<{ success: boolean; message: string; release_tx_id?: string }> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (input.token) {
      headers['Authorization'] = `Bearer ${input.token}`;
    }
    const res = await swapFetch('/claim', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        hash_hex: input.hashHex,
        preimage_hex: input.preimageHex,
        recipient: input.recipient,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, message: data.message || 'Claim failed' };
    }
    return {
      success: true,
      message: 'Claim processed successfully',
      release_tx_id: data.release_tx_id,
    };
  } catch (e: any) {
    return { success: false, message: e.message || 'Network error' };
  }
}

/** Submit refund for expired HTLC */
export async function submitRefund(input: {
  hashHex: string;
  token?: string;
}): Promise<{ success: boolean; message: string; release_tx_id?: string }> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (input.token) {
      headers['Authorization'] = `Bearer ${input.token}`;
    }
    const res = await swapFetch('/refund', {
      method: 'POST',
      headers,
      body: JSON.stringify({ hash_hex: input.hashHex }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, message: data.message || 'Refund failed' };
    }
    return {
      success: true,
      message: 'Refund processed successfully',
      release_tx_id: data.release_tx_id,
    };
  } catch (e: any) {
    return { success: false, message: e.message || 'Network error' };
  }
}
