/**
 * ZIS session for the Nirvana shell.
 * Same cookie and paths as OasisWeb: `zion_session` via same-origin
 * `/api/auth/*` (`/me`, `/logout`, `/challenge`, `/verify/ed25519`).
 */

export const ZIS_SESSION_COOKIE = 'zion_session';

export interface ZisUser {
  id: string;
  primaryAddress: string;
  displayName?: string | null;
  role?: string;
}

async function zisFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = new Error(`ZIS ${res.status}`) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export async function getCurrentUser(): Promise<ZisUser | null> {
  try {
    const body = await zisFetch<ZisUser | { user?: ZisUser }>('/api/auth/me');
    if (!body) return null;
    if ('primaryAddress' in body && typeof body.primaryAddress === 'string') return body;
    if ('user' in body && body.user && typeof body.user.primaryAddress === 'string') return body.user;
    return null;
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 401 || status === 403) return null;
    return null;
  }
}

export async function logout(): Promise<void> {
  try {
    await zisFetch('/api/auth/logout', { method: 'POST' });
  } catch {
    // A missing session is already logged out.
  }
}

export async function getChallenge(address: string): Promise<string> {
  const body = await zisFetch<{ challenge?: string }>('/api/auth/challenge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, chainType: 'zion-l1' }),
  });
  if (!body?.challenge) throw new Error('ZIS challenge missing');
  return body.challenge;
}

export async function verifyEd25519(address: string, publicKey: string, signature: string): Promise<void> {
  await zisFetch('/api/auth/verify/ed25519', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, publicKey, signature }),
  });
}
