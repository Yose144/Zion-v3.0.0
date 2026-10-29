/**
 * Resolve Hiran caller: ZIS session cookie OR X-API-Key (zis_*).
 */

import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  createMarketApiKey,
  getMarketUser,
  isAuthDenied,
  requireMarketAuth,
  ZIS_URL,
  type ZisUser,
} from '@/lib/zis';

export type HiranCaller = {
  user: ZisUser | null;
  /** Raw zis_* when authenticated via header (for hashing); null for session-only. */
  apiKey: string | null;
  keyHash: string | null;
  via: 'session' | 'api_key';
};

function hashKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

async function verifyApiKey(apiKey: string): Promise<ZisUser | null> {
  const res = await fetch(`${ZIS_URL}/api/keys/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ apiKey }),
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { valid?: boolean; user?: ZisUser };
  if (!body.valid || !body.user) return null;
  return body.user;
}

export function extractApiKey(request: NextRequest): string | null {
  const h = request.headers.get('x-api-key')?.trim();
  if (h) return h;
  const auth = request.headers.get('authorization')?.trim();
  if (auth?.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  return null;
}

/**
 * Session preferred; else valid X-API-Key.
 */
export async function requireHiranCaller(
  request: NextRequest,
): Promise<HiranCaller | NextResponse> {
  const user = await getMarketUser();
  if (user) {
    return { user, apiKey: null, keyHash: null, via: 'session' };
  }

  const apiKey = extractApiKey(request);
  if (apiKey) {
    const keyUser = await verifyApiKey(apiKey);
    if (!keyUser) {
      return NextResponse.json(
        { success: false, error: 'Invalid API key' },
        { status: 401 },
      );
    }
    return {
      user: keyUser,
      apiKey,
      keyHash: hashKey(apiKey),
      via: 'api_key',
    };
  }

  return NextResponse.json(
    { success: false, error: 'ZIS authentication or X-API-Key required' },
    { status: 401 },
  );
}

export async function mintOrReuseKey(
  caller: HiranCaller,
  label: string,
): Promise<{ apiKey: string; keyHash: string; minted: boolean }> {
  if (caller.apiKey && caller.keyHash) {
    return { apiKey: caller.apiKey, keyHash: caller.keyHash, minted: false };
  }
  // Session path — require auth then mint.
  const auth = await requireMarketAuth();
  if (isAuthDenied(auth)) {
    throw new Error('UNAUTHORIZED');
  }
  const created = await createMarketApiKey(label);
  return {
    apiKey: created.apiKey,
    keyHash: hashKey(created.apiKey),
    minted: true,
  };
}

export { hashKey as hiranKeyHash };
