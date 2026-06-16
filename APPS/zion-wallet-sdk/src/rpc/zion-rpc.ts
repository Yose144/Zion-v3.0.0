/**
 * ZION JSON-RPC 2.0 Client
 * Direct communication with ZION V3 blockchain nodes.
 */

export interface RpcConfig {
  nodes?: string[];
  timeout?: number;
}

const DEFAULT_NODES = [
  'https://rpc.zionterranova.com',
  'http://77.42.71.94:8443',      // Edge primary (Hetzner VPS)
  'http://100.76.16.108:8443',    // Edge VPN (Tailscale fallback)
];

export class ZionRPC {
  private nodes: string[];
  private currentIndex: number;
  private timeout: number;

  constructor(config: RpcConfig = {}) {
    this.nodes = config.nodes && config.nodes.length > 0 ? config.nodes : DEFAULT_NODES;
    this.currentIndex = 0;
    this.timeout = config.timeout ?? 15000;
  }

  private get url(): string {
    return this.nodes[this.currentIndex];
  }

  private nextNode(): void {
    this.currentIndex = (this.currentIndex + 1) % this.nodes.length;
  }

  /**
   * Send a JSON-RPC 2.0 request with automatic failover.
   */
  async call<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const maxRetries = this.nodes.length;
    let lastError: Error | null = null;

    for (let i = 0; i < maxRetries; i++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(`${this.url}/jsonrpc`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now(),
            method,
            params,
          }),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = (await response.json()) as {
          result?: T;
          error?: { message?: string; code?: number };
        };

        if (data.error) {
          throw new Error(data.error.message || `RPC Error ${data.error.code}`);
        }

        if (data.result === undefined) {
          throw new Error('RPC response missing result');
        }

        return data.result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.nextNode();
      }
    }

    throw new Error(`All RPC nodes failed: ${lastError?.message}`);
  }

  // ─── Blockchain Queries ───────────────────────────────────────────────

  async getBlockCount(): Promise<number> {
    const info = await this.call<Record<string, unknown>>('getChainInfo');
    return (info?.height ?? info?.chain_height ?? 0) as number;
  }

  async getBlock(height: number): Promise<Record<string, unknown>> {
    return this.call('getBlockByHeight', { height });
  }

  async getChainInfo(): Promise<Record<string, unknown>> {
    return this.call('getChainInfo');
  }

  // ─── Wallet Queries ─────────────────────────────────────────────────

  async getBalance(address: string): Promise<number> {
    const result = await this.call<Record<string, unknown>>('getBalance', { address });

    if (result?.balance_flowers !== undefined) {
      return (result.balance_flowers as number) / 1_000_000_000_000;
    }
    if (result?.balance_zion !== undefined) {
      return parseFloat(String(result.balance_zion)) || 0;
    }
    const raw = (result?.balance ?? result ?? 0) as number | string;
    return typeof raw === 'number' ? raw : parseFloat(String(raw)) || 0;
  }

  async getUtxos(address: string): Promise<Array<Record<string, unknown>>> {
    const result = await this.call<Record<string, unknown>>('getUtxos', { address });
    return (result?.utxos ?? result ?? []) as Array<Record<string, unknown>>;
  }

  async getTransactionHistory(address: string, limit = 50): Promise<Array<Record<string, unknown>>> {
    const result = await this.call<Record<string, unknown>>('getAccountTransaction', { address, limit });
    return (result?.transactions ?? result ?? []) as Array<Record<string, unknown>>;
  }

  async getTransaction(txHash: string): Promise<Record<string, unknown>> {
    return this.call('getTransaction', { txid: txHash });
  }

  // ─── Transaction Operations ───────────────────────────────────────────

  async broadcastTransaction(txPayload: Record<string, unknown>): Promise<string> {
    const result = await this.call<Record<string, unknown>>('submitTransaction', { transaction: txPayload });

    if (!result?.accepted && !result?.tx_id) {
      throw new Error((result?.error as string) || 'Failed to broadcast transaction');
    }

    return (result.tx_id ?? result.txid) as string;
  }

  async estimateFee(priority: 1 | 2 | 3 = 2): Promise<number> {
    try {
      const result = await this.call<Record<string, number>>('estimatefee', { priority });
      return result?.fee ?? 0;
    } catch {
      return priority === 1 ? 0.0005 : priority === 3 ? 0.005 : 0.001;
    }
  }

  // ─── Network Info ────────────────────────────────────────────────────

  async getNetworkStats(): Promise<Record<string, unknown>> {
    return this.call('getNetworkStats');
  }

  async getSupplyInfo(): Promise<Record<string, unknown>> {
    return this.call('getSupplyInfo');
  }

  async getAddressInfo(address: string): Promise<Record<string, unknown>> {
    return this.call('getAddressInfo', { address });
  }

  async getTokenInfo(): Promise<Record<string, unknown>> {
    return this.call('getTokenInfo');
  }

  async isConnected(): Promise<boolean> {
    try {
      await this.getBlockCount();
      return true;
    } catch {
      return false;
    }
  }

  async getSyncStatus(): Promise<{ synced: boolean; currentBlock: number; highestBlock: number; progress: number }> {
    try {
      const info = await this.getChainInfo();
      return {
        synced: (info?.synced as boolean) ?? true,
        currentBlock: (info?.blocks as number) ?? 0,
        highestBlock: (info?.headers as number) ?? (info?.blocks as number) ?? 0,
        progress: (info?.verificationprogress as number) ?? 1.0,
      };
    } catch {
      return { synced: true, currentBlock: 0, highestBlock: 0, progress: 1.0 };
    }
  }

  /**
   * Set custom RPC nodes.
   */
  setNodes(nodes: string[]): void {
    if (Array.isArray(nodes) && nodes.length > 0) {
      this.nodes = nodes;
      this.currentIndex = 0;
    }
  }
}
