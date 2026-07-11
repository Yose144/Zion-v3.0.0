import type { QuoteRequest, QuoteResponse, SwapRecord, HealthResponse, PoolInfo } from './types';

/// HTTP client for ZionDex Router API
export class RouterClient {
  private baseUrl: string;

  constructor(routerUrl: string) {
    this.baseUrl = routerUrl.replace(/\/$/, '');
  }

  /// POST /quote — get a price quote
  async quote(req: QuoteRequest): Promise<QuoteResponse> {
    const resp = await fetch(`${this.baseUrl}/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Quote failed (${resp.status}): ${text}`);
    }
    return resp.json();
  }

  /// POST /swap — execute a swap
  async swap(req: import('./types').SwapRequest): Promise<import('./types').SwapResponse> {
    const resp = await fetch(`${this.baseUrl}/swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Swap failed (${resp.status}): ${text}`);
    }
    return resp.json();
  }

  /// GET /swaps/:id — get swap status
  async getSwap(id: string): Promise<SwapRecord> {
    const resp = await fetch(`${this.baseUrl}/swaps/${id}`);
    if (!resp.ok) {
      throw new Error(`Get swap failed (${resp.status})`);
    }
    return resp.json();
  }

  /// GET /swaps — list recent swaps
  async listSwaps(limit: number = 20): Promise<SwapRecord[]> {
    const resp = await fetch(`${this.baseUrl}/swaps?limit=${limit}`);
    if (!resp.ok) {
      throw new Error(`List swaps failed (${resp.status})`);
    }
    return resp.json();
  }

  /// GET /health — health check
  async health(): Promise<HealthResponse> {
    const resp = await fetch(`${this.baseUrl}/health`);
    if (!resp.ok) {
      throw new Error(`Health check failed (${resp.status})`);
    }
    return resp.json();
  }

  /// GET /pools — list all known pools
  async listPools(): Promise<{ pools: PoolInfo[] }> {
    const resp = await fetch(`${this.baseUrl}/pools`);
    if (!resp.ok) {
      throw new Error(`List pools failed (${resp.status})`);
    }
    return resp.json();
  }

  /// GET /prices/:token — get token price across chains
  async getPrice(token: string): Promise<any> {
    const resp = await fetch(`${this.baseUrl}/prices/${token}`);
    if (!resp.ok) {
      throw new Error(`Get price failed (${resp.status})`);
    }
    return resp.json();
  }
}
