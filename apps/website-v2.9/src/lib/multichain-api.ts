/**
 * ZION Multichain Wallet API client.
 *
 * Talks to the local Next.js proxy (`/api/multichain/*`) so the ZIS session
 * cookie is forwarded same-origin to the multichain daemon.
 */

export interface MultichainWalletAddress {
  address: {
    encoded: string;
    bytes?: string;
  };
  user_id: string;
  chain: string;
  chain_id?: string | null;
  purpose: 'deposit' | 'withdraw' | 'linked';
  public_key?: string | null;
  derivation_path: string;
  is_external: boolean;
  created_at: string;
}

export interface MultichainWalletBalance {
  asset_key: string;
  amount: string;
}

export interface MultichainDeposit {
  id: string;
  user_id: string;
  chain: string;
  chain_id?: string | null;
  tx_hash: string;
  asset_key: string;
  amount: string;
  confirmations: number;
  status: 'pending' | 'credited' | 'failed';
  created_at: string;
  credited_at?: string | null;
}

export interface MultichainWithdrawal {
  id: string;
  user_id: string;
  asset_key: string;
  amount: string;
  recipient_address: string;
  tx_hash?: string | null;
  status: 'pending' | 'sent' | 'failed';
  created_at: string;
  sent_at?: string | null;
}

export interface MultichainOrder {
  id: string;
  user_id: string;
  from_asset_key: string;
  to_asset_key: string;
  amount_in: string;
  amount_out: string;
  min_amount_out: string;
  recipient_address?: string | null;
  route: string[];
  tx_hash?: string | null;
  htlc_hash?: string | null;
  status: string;
  created_at: string;
  executed_at?: string | null;
}

export interface MultichainWalletSnapshot {
  user_id: string;
  addresses: MultichainWalletAddress[];
  balances: MultichainWalletBalance[];
  deposits: MultichainDeposit[];
  withdrawals: MultichainWithdrawal[];
  orders: MultichainOrder[];
}

export interface MultichainWithdrawInput {
  asset: string;
  amount: string;
  recipient: string;
}

export interface MultichainWithdrawResult {
  withdrawal_id: string;
  status: string;
}

export interface MultichainAddressInput {
  chain: string;
  account?: number;
  index?: number;
}

export interface MultichainAddressResult {
  chain: string;
  address: string;
  bytes?: string;
}

const MULTICHAIN_BASE = '/api/multichain';

async function multichainFetch(path: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(`${MULTICHAIN_BASE}${path}`, {
      ...init,
      credentials: 'include',
      signal: controller.signal,
    });
    clearTimeout(tid);
    return res;
  } catch (e) {
    clearTimeout(tid);
    throw e;
  }
}

/** Fetch the full wallet snapshot for the authenticated user. */
export async function getMultichainWallet(): Promise<MultichainWalletSnapshot | null> {
  try {
    const res = await multichainFetch('/wallet/me', { cache: 'no-store' });
    if (res.status === 401 || res.status === 403) return null;
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || data.message || `Wallet load failed: ${res.status}`);
    }
    return await res.json();
  } catch (e: any) {
    if (e.message === 'unauthenticated' || e.message?.includes('401')) return null;
    throw e;
  }
}

/** List DEX orders for the authenticated user. */
export async function getMultichainOrders(): Promise<MultichainOrder[]> {
  try {
    const res = await multichainFetch('/wallet/orders', { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.orders || [];
  } catch {
    return [];
  }
}

/** List deposits for the authenticated user. */
export async function getMultichainDeposits(): Promise<MultichainDeposit[]> {
  try {
    const res = await multichainFetch('/wallet/deposits', { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.deposits || [];
  } catch {
    return [];
  }
}

/** List withdrawals for the authenticated user. */
export async function getMultichainWithdrawals(): Promise<MultichainWithdrawal[]> {
  try {
    const res = await multichainFetch('/wallet/withdrawals', { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.withdrawals || [];
  } catch {
    return [];
  }
}

/** Request a new withdrawal. */
export async function requestMultichainWithdraw(
  input: MultichainWithdrawInput,
): Promise<MultichainWithdrawResult | { error: string }> {
  try {
    const res = await multichainFetch('/wallet/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        asset: input.asset,
        amount: input.amount,
        recipient: input.recipient,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { error: data.error || data.message || 'Withdrawal failed' };
    }
    return data as MultichainWithdrawResult;
  } catch (e: any) {
    return { error: e.message || 'Network error' };
  }
}

/** Derive a deposit address for a chain. */
export async function deriveMultichainAddress(
  input: MultichainAddressInput,
): Promise<MultichainAddressResult | null> {
  try {
    const res = await multichainFetch('/wallet/derive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chain: input.chain,
        account: input.account ?? 0,
        index: input.index ?? 0,
      }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Fetch a single address for a chain (uses linked address when available). */
export async function getMultichainAddress(
  input: MultichainAddressInput,
): Promise<MultichainAddressResult | null> {
  try {
    const res = await multichainFetch('/wallet/address', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chain: input.chain,
        account: input.account ?? 0,
        index: input.index ?? 0,
      }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
