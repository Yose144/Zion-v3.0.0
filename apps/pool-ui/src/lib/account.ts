// Pool account API client — ZIS API-key authenticated.
//
// The pool's /public/v1/account* endpoints take a `zis_*` API key in the
// POST body (verified service-to-service against ZIS /api/keys/verify).
// The browser session is an httpOnly cookie we can't read, so we mint a
// dedicated API key once (POST /api/keys/ — cookie-auth'd) and keep the
// raw key in localStorage. The key only unlocks the owner's own wallets.

const KEY_STORAGE = 'pool-account-key';
const FLOWERS = 1e6;

export interface AlertSub {
  id: number;
  worker: string;
  channel: 'telegram' | 'webhook' | string;
  target: string;
  offline_secs: number;
  state: string;
}

export interface AccountView {
  ok: boolean;
  sub?: string;
  wallets?: string[];
  /** wallet → { min_payout_flowers } */
  settings?: Record<string, { min_payout_flowers: string }>;
  /** wallet → alert subscriptions */
  alerts?: Record<string, AlertSub[]>;
}

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`/public/v1${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok || (json as { ok?: boolean }).ok === false) {
    throw new Error(json.error ?? `pool ${res.status}`);
  }
  return json;
}

/** Stored pool API key, or null. */
export function poolApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(KEY_STORAGE);
}

/** Mint (or reuse) the `zis_*` key the pool account endpoints need.
 *  Requires an active ZIS session (cookie). Throws when not signed in. */
export async function ensurePoolKey(): Promise<string> {
  const existing = poolApiKey();
  if (existing) {
    // Verify the stored key still works — a revoked key falls through to
    // re-mint instead of dead-locking the settings UI.
    try {
      await accountView(existing);
      return existing;
    } catch {
      localStorage.removeItem(KEY_STORAGE);
    }
  }
  const res = await fetch('/api/keys/', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label: 'pool-ui' }),
  });
  if (!res.ok) throw new Error(`key mint failed (${res.status})`);
  const { apiKey } = (await res.json()) as { apiKey: string };
  localStorage.setItem(KEY_STORAGE, apiKey);
  return apiKey;
}

export function forgetPoolKey(): void {
  localStorage.removeItem(KEY_STORAGE);
}

export function accountView(token: string): Promise<AccountView> {
  return post<AccountView>('/account', { token });
}

/** `minPayout` in ZION units (converted to flowers here); 0 clears the
 *  override and returns the wallet to the pool default. */
export function setThreshold(token: string, wallet: string, minPayout: number) {
  return post('/account/threshold', {
    token,
    wallet,
    min_payout: Math.round(minPayout * FLOWERS),
  });
}

export function upsertAlert(
  token: string,
  wallet: string,
  a: { worker?: string; channel: 'telegram' | 'webhook'; target: string; offline_secs: number },
) {
  return post('/account/alert', { token, wallet, ...a });
}

export function deleteAlert(token: string, wallet: string, id: number) {
  return post('/account/alert/delete', { token, wallet, id });
}

export function flowersToZion(flowers: string): number {
  return Number(flowers) / FLOWERS;
}
