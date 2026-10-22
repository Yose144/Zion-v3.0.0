/**
 * ZION Identity Service (ZIS) Client
 * REST client for authentication and linked-address management.
 *
 * ZIS supports multiple auth methods:
 *  - Ed25519 (ZION L1 native)
 *  - SIWE (Sign-In with Ethereum)
 *  - Google OAuth (ID token)
 *  - API key (service-to-service)
 *
 * Uses the built-in `fetch` (Node 18+ and modern browsers).
 */

export interface ZisUser {
  id: string;
  primaryAddress: string;
  displayName?: string;
  email?: string;
  role: string;
  linkedAddresses: LinkedAddress[];
}

export interface LinkedAddress {
  id: string;
  address: string;
  chainType: string;
  chainId?: string;
  verifiedAt: string;
}

export interface AuthResult {
  token: string;
  user: ZisUser;
}

export interface ChallengeResult {
  nonce: string;
  message: string;
}

export interface ApiKeyVerifyResult {
  valid: boolean;
  user: ZisUser;
}

export interface AddressProof {
  publicKey?: string;
  signature?: string;
  message?: string;
}

interface ApiErrorBody {
  error?: string;
  message?: string;
}

export class ZisClient {
  private zisUrl: string;
  private timeout: number;

  constructor(zisUrl: string, timeout: number = 15000) {
    if (!zisUrl) {
      throw new Error('ZisClient requires a zisUrl');
    }
    this.zisUrl = zisUrl.replace(/\/+$/, '');
    this.timeout = timeout;
  }

  /** Core request helper. */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    token?: string,
  ): Promise<T> {
    const url = `${this.zisUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const text = await response.text();
      const data = text ? (JSON.parse(text) as T & ApiErrorBody) : ({} as T & ApiErrorBody);

      if (!response.ok) {
        const msg = data.error || data.message || `HTTP ${response.status}`;
        throw new Error(`ZIS error: ${msg}`);
      }
      return data as T;
    } finally {
      clearTimeout(timer);
    }
  }

  // ─── Auth ─────────────────────────────────────────────────────────────

  /** Request a sign-in challenge (nonce + message) for an address. */
  async challenge(address: string, chainType: string): Promise<ChallengeResult> {
    return this.request<ChallengeResult>('POST', '/v1/auth/challenge', {
      address,
      chainType,
    });
  }

  /** Verify an Ed25519 (ZION L1) signature and obtain a session token. */
  async verifyEd25519(
    address: string,
    publicKey: string,
    signature: string,
  ): Promise<AuthResult> {
    return this.request<AuthResult>('POST', '/v1/auth/verify/ed25519', {
      address,
      publicKey,
      signature,
    });
  }

  /** Verify a SIWE message + signature and obtain a session token. */
  async verifySiwe(message: string, signature: string): Promise<AuthResult> {
    return this.request<AuthResult>('POST', '/v1/auth/verify/siwe', {
      message,
      signature,
    });
  }

  /** Verify a Google OAuth ID token and obtain a session token. */
  async verifyGoogle(idToken: string): Promise<AuthResult> {
    return this.request<AuthResult>('POST', '/v1/auth/verify/google', {
      idToken,
    });
  }

  /** Verify an API key. Returns validity + the associated user. */
  async verifyApiKey(key: string): Promise<ApiKeyVerifyResult> {
    return this.request<ApiKeyVerifyResult>('POST', '/v1/auth/verify/api-key', {
      key,
    });
  }

  /** Fetch the currently authenticated user for a token. */
  async getMe(token: string): Promise<ZisUser> {
    return this.request<ZisUser>('GET', '/v1/auth/me', undefined, token);
  }

  /** Invalidate a session token. */
  async logout(token: string): Promise<void> {
    await this.request<void>('POST', '/v1/auth/logout', undefined, token);
  }

  // ─── Linked Addresses ─────────────────────────────────────────────────

  /** Link a new address to the authenticated user (with optional proof). */
  async linkAddress(
    token: string,
    address: string,
    chainType: string,
    chainId: string,
    proof: AddressProof,
  ): Promise<void> {
    await this.request<void>(
      'POST',
      '/v1/addresses',
      { address, chainType, chainId, proof },
      token,
    );
  }

  /** List all addresses linked to the authenticated user. */
  async getLinkedAddresses(token: string): Promise<LinkedAddress[]> {
    const result = await this.request<{ addresses?: LinkedAddress[] } | LinkedAddress[]>(
      'GET',
      '/v1/addresses',
      undefined,
      token,
    );
    return Array.isArray(result) ? result : (result.addresses ?? []);
  }
}
