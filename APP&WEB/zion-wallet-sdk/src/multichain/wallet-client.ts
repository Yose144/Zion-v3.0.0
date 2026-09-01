/**
 * Multichain Wallet Client
 * High-level REST client for the ZION L2 multichain wallet API.
 *
 * Talks to the L2 wallet service which aggregates balances, deposits,
 * withdrawals, DEX swaps, and bridge transfers across multiple chains.
 * Uses the built-in `fetch` (available in Node 18+ and modern browsers).
 */

import type {
  Balance,
  BridgeParams,
  BridgeResult,
  DepositAddress,
  Quote,
  SwapParams,
  SwapResult,
  WalletSnapshot,
  WithdrawParams,
  WithdrawResult,
} from './types.js';

export interface MultichainWalletClientConfig {
  /** Base URL of the L2 multichain wallet API, e.g. https://api.zionterranova.com */
  apiUrl: string;
  /** Optional ZIS base URL for auth-derivation. */
  zisUrl?: string;
  /** Optional API key for service-to-service auth. */
  apiKey?: string;
  /** Optional ZIS bearer session cookie/token. */
  sessionCookie?: string;
  /** Request timeout in ms. */
  timeout?: number;
}

interface ApiErrorBody {
  error?: string;
  message?: string;
}

export class MultichainWalletClient {
  private apiUrl: string;
  private apiKey?: string;
  private sessionCookie?: string;
  private timeout: number;

  constructor(config: MultichainWalletClientConfig) {
    if (!config.apiUrl) {
      throw new Error('MultichainWalletClient requires an apiUrl');
    }
    this.apiUrl = config.apiUrl.replace(/\/+$/, '');
    this.apiKey = config.apiKey;
    this.sessionCookie = config.sessionCookie;
    this.timeout = config.timeout ?? 20000;
  }

  /** Build auth headers for every request. */
  private authHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (this.sessionCookie) {
      headers['Authorization'] = `Bearer ${this.sessionCookie}`;
    }
    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }
    return headers;
  }

  /** Update the session token at runtime (e.g. after ZIS login). */
  setSessionToken(token: string): void {
    this.sessionCookie = token;
  }

  /** Core request helper with timeout and error normalisation. */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.apiUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: this.authHeaders(),
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const text = await response.text();
      const data = text ? (JSON.parse(text) as T & ApiErrorBody) : ({} as T & ApiErrorBody);

      if (!response.ok) {
        const msg = data.error || data.message || `HTTP ${response.status}`;
        throw new Error(`Multichain API error: ${msg}`);
      }
      return data as T;
    } finally {
      clearTimeout(timer);
    }
  }

  // ─── Wallet ───────────────────────────────────────────────────────────

  /** Fetch the full wallet snapshot (addresses, balances, orders, deposits, withdrawals). */
  async getWallet(): Promise<WalletSnapshot> {
    return this.request<WalletSnapshot>('GET', '/v1/wallet');
  }

  /** Fetch all balances across chains. */
  async getBalances(): Promise<Balance[]> {
    const result = await this.request<{ balances?: Balance[] } | Balance[]>(
      'GET',
      '/v1/wallet/balances',
    );
    return Array.isArray(result) ? result : (result.balances ?? []);
  }

  /** Fetch a single balance by asset key (e.g. "ethereum:USDC"). */
  async getBalance(assetKey: string): Promise<Balance> {
    return this.request<Balance>(
      'GET',
      `/v1/wallet/balances/${encodeURIComponent(assetKey)}`,
    );
  }

  /** Derive (or fetch the cached) deposit address for a chain. */
  async deriveAddress(chain: string): Promise<DepositAddress> {
    return this.request<DepositAddress>(
      'POST',
      '/v1/wallet/addresses',
      { chain },
    );
  }

  // ─── DEX ──────────────────────────────────────────────────────────────

  /** Request a quote for a swap. */
  async getQuote(from: string, to: string, amount: string): Promise<Quote> {
    return this.request<Quote>('GET', '/v1/dex/quote', { from, to, amount });
  }

  /** Execute a swap. */
  async executeSwap(params: SwapParams): Promise<SwapResult> {
    return this.request<SwapResult>('POST', '/v1/dex/swap', params);
  }

  /** Fetch a single order by id. */
  async getOrder(orderId: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'GET',
      `/v1/dex/orders/${encodeURIComponent(orderId)}`,
    );
  }

  /** Fetch all orders for the authenticated user. */
  async getOrders(): Promise<Record<string, unknown>[]> {
    const result = await this.request<{ orders?: Record<string, unknown>[] } | Record<string, unknown>[]>(
      'GET',
      '/v1/dex/orders',
    );
    return Array.isArray(result) ? result : (result.orders ?? []);
  }

  // ─── Withdraw ─────────────────────────────────────────────────────────

  /** Withdraw an asset to an external address. */
  async withdraw(params: WithdrawParams): Promise<WithdrawResult> {
    return this.request<WithdrawResult>('POST', '/v1/wallet/withdraw', params);
  }

  /** Fetch all withdrawals for the authenticated user. */
  async getWithdrawals(): Promise<Record<string, unknown>[]> {
    const result = await this.request<{ withdrawals?: Record<string, unknown>[] } | Record<string, unknown>[]>(
      'GET',
      '/v1/wallet/withdrawals',
    );
    return Array.isArray(result) ? result : (result.withdrawals ?? []);
  }

  // ─── Deposits ─────────────────────────────────────────────────────────

  /** Fetch all deposits for the authenticated user. */
  async getDeposits(): Promise<Record<string, unknown>[]> {
    const result = await this.request<{ deposits?: Record<string, unknown>[] } | Record<string, unknown>[]>(
      'GET',
      '/v1/wallet/deposits',
    );
    return Array.isArray(result) ? result : (result.deposits ?? []);
  }

  // ─── Bridge ───────────────────────────────────────────────────────────

  /** Initiate a cross-chain bridge transfer. */
  async bridge(params: BridgeParams): Promise<BridgeResult> {
    return this.request<BridgeResult>('POST', '/v1/bridge/transfer', params);
  }

  /** Fetch the status of an in-flight bridge transfer. */
  async getBridgeStatus(transferId: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'GET',
      `/v1/bridge/transfer/${encodeURIComponent(transferId)}`,
    );
  }
}
