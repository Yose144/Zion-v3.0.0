/**
 * ZION Blockchain RPC Client
 * 
 * Direct communication with ZION daemon JSON-RPC (Monero-compatible).
 * This replaces the Pool API approach for accurate blockchain data.
 * 
 * RPC Methods:
 *  - get_info: Network overview (height, difficulty, hashrate, peers)
 *  - get_block_header_by_height: Single block header
 *  - get_block_headers_range: Range of block headers
 *  - get_last_block_header: Latest block header
 *  - get_block_count: Chain height
 *  - get_block: Full block with transactions
 *  - get_transactions: Transaction details by hash
 *  - get_transaction_pool: Mempool
 *  - get_connections: Connected peers
 *  - get_coinbase_tx_sum: Emission stats
 *  - get_fee_estimate: Fee estimation
 */

import { getSeedNodesConfig, type SeedNodeConfig } from './network-config';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ZionBlockHeader {
  height: number;
  hash: string;
  prev_hash: string;
  timestamp: number;
  difficulty: number;
  nonce: number;
  reward: number;
  miner_tx_hash: string;
  num_txes: number;
  block_size: number;
  orphan_status: boolean;
  depth: number;
  major_version: number;
  minor_version: number;
}

export interface ZionBlock extends ZionBlockHeader {
  miner_tx: {
    version: number;
    unlock_time: number;
    vin: Array<{ gen: { height: number } }>;
    vout: Array<{
      amount: number;
      target: { key: string };
    }>;
    extra: number[];
  };
  tx_hashes: string[];
}

export interface ZionTransaction {
  tx_hash: string;
  block_height: number;
  block_timestamp: number;
  in_pool: boolean;
  double_spend_seen: boolean;
  output_indices: number[];
  version: number;
  unlock_time: number;
  vin: Array<{
    key?: {
      amount: number;
      key_offsets: number[];
      k_image: string;
    };
    gen?: {
      height: number;
    };
  }>;
  vout: Array<{
    amount: number;
    target: { key: string };
  }>;
  extra: number[];
  fee: number;
  // ZION-specific fields

  humanitarian_tithe?: number;
}

export interface ZionNetworkInfo {
  height: number;
  top_block_hash: string;
  difficulty: number;
  target: number;
  tx_count: number;
  tx_pool_size: number;
  alt_blocks_count: number;
  outgoing_connections_count: number;
  incoming_connections_count: number;
  white_peerlist_size: number;
  grey_peerlist_size: number;
  mainnet: boolean;
  testnet: boolean;
  stagenet: boolean;
  nettype: string;
  cumulative_difficulty: number;
  block_size_limit: number;
  block_size_median: number;
  start_time: number;
  free_space: number;
  offline: boolean;
  status: string;
  version: string;
  // ZION-specific
  total_emission?: number;
  mining_speed?: number;
  database_size?: number;
}

export interface ZionMempoolTx {
  id_hash: string;
  tx_blob: string;
  tx_json: string;
  blob_size: number;
  fee: number;
  max_used_block_height: number;
  max_used_block_id_hash: string;
  kept_by_block: boolean;
  last_failed_height: number;
  last_failed_id_hash: string;
  receive_time: number;
  relayed: boolean;
  do_not_relay: boolean;
  double_spend_seen: boolean;
}

export interface ZionPeer {
  host: string;
  port: number;
  peer_id: string;
  recv_count: number;
  send_count: number;
  state: string;
  live_time: number;
  avg_download: number;
  current_download: number;
  avg_upload: number;
  current_upload: number;
  connection_id: string;
  height: number;
  incoming: boolean;
  address: string;
}

export interface ZionEmission {
  emission_amount: number;
  fee_amount: number;
  burn_amount?: number;
  status?: string;
}

// ─── RPC Client ──────────────────────────────────────────────────────────────

const TIMEOUT_MS = 8000;

class ZionRpcClient {
  private nodes: SeedNodeConfig[];
  private primaryIndex: number = 0;
  private failoverCounts: Map<string, number> = new Map();

  constructor() {
    this.nodes = getSeedNodesConfig();
  }

  private getRpcUrl(node: SeedNodeConfig): string {
    return node.rpcUrl || `http://${node.host}:${node.ports.rpc}/jsonrpc`;
  }

  private getPoolApiUrl(node: SeedNodeConfig): string {
    return (node.poolApiUrl || `http://${node.host}:${node.ports.pool_api}`).replace(/\/+$/, '');
  }

  /**
   * Make a JSON-RPC call with automatic failover across seed nodes
   */
  async rpcCall<T = any>(method: string, params: Record<string, any> = {}): Promise<T> {
    const errors: string[] = [];

    // Try primary node first, then failover to others
    for (let attempt = 0; attempt < this.nodes.length; attempt++) {
      const nodeIndex = (this.primaryIndex + attempt) % this.nodes.length;
      const node = this.nodes[nodeIndex];
      const url = this.getRpcUrl(node);

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: '0',
            method,
            params,
          }),
          signal: controller.signal,
          cache: 'no-store',
        });

        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const json = await response.json();

        if (json.error) {
          throw new Error(json.error.message || JSON.stringify(json.error));
        }

        // Success — promote this node to primary
        if (attempt > 0) {
          this.primaryIndex = nodeIndex;
        }
        this.failoverCounts.set(node.id, 0);

        return json.result as T;
      } catch (err: any) {
        const msg = `${node.name}: ${err.message || 'Unknown error'}`;
        errors.push(msg);

        // Track failures
        const count = (this.failoverCounts.get(node.id) || 0) + 1;
        this.failoverCounts.set(node.id, count);
      }
    }

    throw new Error(`All RPC nodes failed: ${errors.join(' | ')}`);
  }

  /**
   * Make a direct HTTP call (non-JSON-RPC endpoints like /get_transactions)
   */
  async httpCall<T = any>(path: string, body?: Record<string, any>): Promise<T> {
    const errors: string[] = [];

    for (let attempt = 0; attempt < this.nodes.length; attempt++) {
      const nodeIndex = (this.primaryIndex + attempt) % this.nodes.length;
      const node = this.nodes[nodeIndex];
      // Direct HTTP endpoints use the base host:rpc_port without /jsonrpc
      const baseUrl = `http://${node.host}:${node.ports.rpc}`;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

        const response = await fetch(`${baseUrl}${path}`, {
          method: body ? 'POST' : 'GET',
          headers: body ? { 'Content-Type': 'application/json' } : {},
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
          cache: 'no-store',
        });

        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const json = await response.json();

        if (attempt > 0) {
          this.primaryIndex = nodeIndex;
        }

        return json as T;
      } catch (err: any) {
        errors.push(`${node.name}: ${err.message}`);
      }
    }

    throw new Error(`All nodes failed for ${path}: ${errors.join(' | ')}`);
  }

  /**
   * Pool API call (for mining-specific data not available via RPC)
   * Only queries nodes that have a pool API configured (poolApiUrl set or pool_api port > 0).
   */
  async poolCall<T = any>(path: string): Promise<T> {
    const errors: string[] = [];

    for (let attempt = 0; attempt < this.nodes.length; attempt++) {
      const nodeIndex = (this.primaryIndex + attempt) % this.nodes.length;
      const node = this.nodes[nodeIndex];

      // Skip nodes without a pool API — avoids 8s timeout on port 0
      if (!node.poolApiUrl && (!node.ports.pool_api || node.ports.pool_api === 0)) continue;

      const baseUrl = this.getPoolApiUrl(node);

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

        const response = await fetch(`${baseUrl}${path}`, {
          signal: controller.signal,
          cache: 'no-store',
        });

        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        return (await response.json()) as T;
      } catch (err: any) {
        errors.push(`${node.name} pool: ${err.message}`);
      }
    }

    throw new Error(`All pool nodes failed for ${path}: ${errors.join(' | ')}`);
  }

  // ─── High-Level API Methods ──────────────────────────────────────────────

  /** Get network info (height, difficulty, hashrate, peers, tx_count, mempool size) */
  async getInfo(): Promise<ZionNetworkInfo> {
    // ZION daemon get_info returns minimal data, enrich with /stats
    const [rpcInfo, stats] = await Promise.all([
      this.rpcCall<any>('get_info').catch(() => null),
      this.httpCall<any>('/stats').catch(() => null),
    ]);
    // Merge both sources: /stats has peers_connected, mempool_size, tip, network
    // get_info has tx_count, tx_pool_size, connections, block_size, cumulative_difficulty
    const r = rpcInfo || {};
    const s = stats || {};
    return {
      height: s.height || r.height || 0,
      difficulty: s.difficulty || r.difficulty || 0,
      target: r.target || 60,
      tx_count: r.tx_count || s.height || 0,
      tx_pool_size: s.mempool_size || r.tx_pool_size || 0,
      incoming_connections_count: r.incoming_connections_count || 0,
      outgoing_connections_count: r.outgoing_connections_count || s.peers_connected || 0,
      white_peerlist_size: r.white_peerlist_size || 0,
      grey_peerlist_size: r.grey_peerlist_size || 0,
      mainnet: r.mainnet ?? (s.network !== 'testnet'),
      testnet: r.testnet ?? (s.network === 'testnet'),
      top_block_hash: r.top_block_hash || s.tip || '',
      cumulative_difficulty: r.cumulative_difficulty || 0,
      block_size_limit: r.block_size_limit || 0,
      block_size_median: r.block_size_median || 0,
      status: s.status || r.status || 'OK',
      version: r.version || '',
      start_time: r.start_time || 0,
      database_size: r.database_size || 0,
    } as ZionNetworkInfo;
  }

  /** Get last block header */
  async getLastBlockHeader(): Promise<ZionBlockHeader> {
    const info = await this.getInfo();
    const height = info.height > 0 ? info.height : 0;
    return this.getBlockHeaderByHeight(height);
  }

  /** Get block header by height — uses REST /api/block/height/:height */
  async getBlockHeaderByHeight(height: number): Promise<ZionBlockHeader> {
    const res = await this.httpCall<any>(`/api/block/height/${height}`);
    const h = res?.block?.header || {};
    const txs = res?.block?.transactions || [];
    const coinbaseTx = txs[0] || {};
    const reward = coinbaseTx.outputs?.[0]?.amount || 0;
    return {
      height: h.height || height,
      hash: h.hash || h.prev_hash || '',
      prev_hash: h.prev_hash || '',
      timestamp: h.timestamp || 0,
      difficulty: h.difficulty || 0,
      nonce: h.nonce || 0,
      reward,
      miner_tx_hash: coinbaseTx.id || '',
      num_txes: Math.max(0, txs.length - 1),
      block_size: 0,
      orphan_status: false,
      depth: 0,
      major_version: h.version || 1,
      minor_version: 0,
    };
  }

  /** Get block header by hash */
  async getBlockHeaderByHash(hash: string): Promise<ZionBlockHeader> {
    const res = await this.httpCall<any>(`/api/block/hash/${hash}`);
    const h = res?.block?.header || {};
    const txs = res?.block?.transactions || [];
    const coinbaseTx = txs[0] || {};
    const reward = coinbaseTx.outputs?.[0]?.amount || 0;
    return {
      height: h.height || 0,
      hash: h.hash || hash,
      prev_hash: h.prev_hash || '',
      timestamp: h.timestamp || 0,
      difficulty: h.difficulty || 0,
      nonce: h.nonce || 0,
      reward,
      miner_tx_hash: coinbaseTx.id || '',
      num_txes: Math.max(0, txs.length - 1),
      block_size: 0,
      orphan_status: false,
      depth: 0,
      major_version: h.version || 1,
      minor_version: 0,
    };
  }

  /** Get range of block headers (inclusive) — uses batch REST endpoint */
  async getBlockHeaders(startHeight: number, endHeight: number): Promise<ZionBlockHeader[]> {
    // Limit to max 100 blocks
    const clampedStart = Math.max(0, endHeight - 99);
    const start = Math.max(startHeight, clampedStart);

    try {
      // Try batch endpoint first (single request)
      const res = await this.httpCall<any>(`/api/blocks/range/${start}/${endHeight}`);
      if (res?.headers && Array.isArray(res.headers)) {
        return res.headers.map((h: any) => ({
          height: h.height || 0,
          hash: h.hash || '',
          prev_hash: h.prev_hash || '',
          timestamp: h.timestamp || 0,
          difficulty: h.difficulty || 0,
          nonce: h.nonce || 0,
          reward: h.reward || 0,
          miner_tx_hash: '',
          num_txes: h.num_txes || 0,
          block_size: 0,
          orphan_status: false,
          depth: 0,
          major_version: h.version || 1,
          minor_version: 0,
        }));
      }
    } catch {
      // Fallback: iterate individual blocks (for older daemons)
    }

    // Fallback to N×1 iteration (max 20)
    const fallbackStart = Math.max(start, endHeight - 19);
    const promises: Promise<ZionBlockHeader | null>[] = [];
    for (let h = fallbackStart; h <= endHeight; h++) {
      promises.push(this.getBlockHeaderByHeight(h).catch(() => null));
    }
    const results = await Promise.all(promises);
    return results.filter((b): b is ZionBlockHeader => b !== null);
  }

  /** Get full block with transaction hashes */
  async getBlock(heightOrHash: number | string): Promise<ZionBlock> {
    const res = typeof heightOrHash === 'number'
      ? await this.httpCall<any>(`/api/block/height/${heightOrHash}`)
      : await this.httpCall<any>(`/api/block/hash/${heightOrHash}`);
    const h = res?.block?.header || {};
    const txs = res?.block?.transactions || [];
    const coinbaseTx = txs[0] || {};
    const reward = coinbaseTx.outputs?.[0]?.amount || 0;
    return {
      height: h.height || 0,
      hash: h.hash || '',
      prev_hash: h.prev_hash || '',
      timestamp: h.timestamp || 0,
      difficulty: h.difficulty || 0,
      nonce: h.nonce || 0,
      reward,
      miner_tx_hash: coinbaseTx.id || '',
      num_txes: Math.max(0, txs.length - 1),
      block_size: 0,
      orphan_status: false,
      depth: 0,
      major_version: h.version || 1,
      minor_version: 0,
      miner_tx: {
        version: coinbaseTx.version || 1,
        unlock_time: 0,
        vin: [{ gen: { height: h.height || 0 } }],
        vout: (coinbaseTx.outputs || []).map((o: any) => ({
          amount: o.amount || 0,
          target: { key: o.address || '' },
        })),
        extra: [],
      },
      tx_hashes: txs.slice(1).map((t: any) => t.id || ''),
    };
  }

  /** Get block count (chain height) */
  async getBlockCount(): Promise<number> {
    const info = await this.getInfo();
    return info.height || 0;
  }

  /** Get transactions by hash — uses JSON-RPC getTx */
  async getTransactions(txHashes: string[]): Promise<ZionTransaction[]> {
    if (txHashes.length === 0) return [];

    const results: ZionTransaction[] = [];
    for (const txid of txHashes) {
      try {
        const res = await this.rpcCall<any>('getTx', { txid });
        const tx = res?.transaction || res || {};
        results.push({
          tx_hash: txid,
          block_height: tx.block_height || 0,
          block_timestamp: tx.timestamp || 0,
          in_pool: tx.in_pool || false,
          double_spend_seen: false,
          output_indices: [],
          version: tx.version || 1,
          unlock_time: 0,
          vin: tx.inputs || [],
          vout: tx.outputs || [],
          extra: [],
          fee: tx.fee || 0,
        });
      } catch {
        // Skip unavailable transactions
      }
    }
    return results;
  }

  /** Get mempool transactions — uses REST /api/mempool/info */
  async getTransactionPool(): Promise<ZionMempoolTx[]> {
    try {
      const res = await this.httpCall<any>('/api/mempool/info');
      const txids = res?.txids || res?.transactions || [];
      // Return minimal mempool tx info
      return txids.map((txid: string) => ({
        id_hash: txid,
        fee: 0,
        blob_size: 0,
        receive_time: Math.floor(Date.now() / 1000),
      }));
    } catch {
      return [];
    }
  }

  /** Get connected peers — uses JSON-RPC getPeerList for full peer details */
  async getConnections(): Promise<ZionPeer[]> {
    try {
      const res = await this.rpcCall<any>('getPeerList');
      // New getPeerList returns { count, active, known, chain_height, peers: [...] }
      const peerList = res?.peers || [];
      return peerList.map((p: any) => ({
        host: p.host || '',
        port: p.port || 0,
        peer_id: p.address || '',
        recv_count: 0,
        send_count: 0,
        state: p.state || 'normal',
        live_time: 0,
        avg_download: 0,
        current_download: 0,
        avg_upload: 0,
        current_upload: 0,
        connection_id: p.address || '',
        height: p.height || 0,
        incoming: p.incoming || false,
        address: p.address || `${p.host}:${p.port}`,
        // Extra fields from getPeerList
        sub_version: p.sub_version || '',
        last_seen: p.last_seen || 0,
        idle_seconds: p.idle_seconds || 0,
        connected: p.connected || false,
        failed_attempts: p.failed_attempts || 0,
      }));
    } catch {
      return [];
    }
  }

  /** Get coinbase emission / supply info — returns atomic units */
  async getCoinbaseTxSum(height: number, count: number): Promise<ZionEmission> {
    try {
      const res = await this.rpcCall<any>('getSupplyInfo');
      // ZION RPC returns: mined_so_far_atomic, mined_so_far_zion, burned_atomic, burned_zion
      // 1 ZION = 1,000,000 atomic (NOT 1e9 like Monero)
      const ATOMIC = 1_000_000;
      return {
        emission_amount: res?.mined_so_far_atomic || (res?.mined_so_far_zion || 0) * ATOMIC,
        fee_amount: res?.burned_atomic || (res?.burned_zion || 0) * ATOMIC,
        status: 'OK',
      };
    } catch {
      return { emission_amount: 0, fee_amount: 0, status: 'FAIL' };
    }
  }

  /** Get fee estimate (not implemented in ZION daemon) */
  async getFeeEstimate(): Promise<{ fee: number; quantization_mask: number }> {
    return { fee: 1000, quantization_mask: 1 };
  }

  /** Get sync info */
  async getSyncInfo(): Promise<any> {
    return this.httpCall('/api/sync/status');
  }

  // ─── Pool-Specific Methods (for mining stats not in daemon) ────────────

  /** Get pool statistics */
  async getPoolStats(): Promise<any> {
    return this.poolCall('/stats');
  }

  /** Get miner info by address */
  async getMinerInfo(address: string): Promise<any> {
    return this.poolCall(`/miner/${address}`);
  }

  /** Get address balance from blockchain (authoritative) */
  async getAddressBalance(address: string): Promise<{ balance_atomic: number; balance_zion: number; utxo_count: number }> {
    return this.httpCall(`/api/address/${address}/balance`);
  }

  /** Get pool blocks */
  async getPoolBlocks(): Promise<any> {
    return this.poolCall('/blocks');
  }

  /** Get pool payouts */
  async getPoolPayouts(limit: number = 50): Promise<any> {
    return this.poolCall(`/payouts?limit=${limit}`);
  }

  // ─── Computed / Derived Methods ────────────────────────────────────────

  /** Get comprehensive network summary for dashboard */
  async getNetworkSummary(): Promise<{
    info: ZionNetworkInfo;
    lastBlock: ZionBlockHeader;
    recentBlocks: ZionBlockHeader[];
    poolStats: any;
    emission: { total: number; fee: number } | null;
  }> {
    const info = await this.getInfo();
    if (!info || !info.height) {
      throw new Error('Failed to get network info');
    }

    const tipHeight = info.height > 0 ? info.height : 0;
    const [lastBlock, poolStats] = await Promise.all([
      this.getBlockHeaderByHeight(tipHeight).catch(() => null),
      this.getPoolStats().catch(() => null),
    ]);

    if (!lastBlock) {
      throw new Error('Failed to get last block');
    }

    // Get recent blocks (last 10)
    const startHeight = Math.max(0, tipHeight - 9);
    const recentBlocks = await this.getBlockHeaders(startHeight, tipHeight).catch(() => []);

    // Get emission (total mined coins)
    // getCoinbaseTxSum returns atomic units; 1 ZION = 1,000,000 atomic
    let emission: { total: number; fee: number } | null = null;
    try {
      const emissionData = await this.getCoinbaseTxSum(0, tipHeight + 1);
      emission = {
        total: emissionData.emission_amount / 1_000_000,
        fee: emissionData.fee_amount / 1_000_000,
      };
    } catch {
      // Emission endpoint might not be implemented yet
    }

    return {
      info,
      lastBlock,
      recentBlocks: recentBlocks.reverse(), // Newest first
      poolStats,
      emission,
    };
  }
}

// Singleton instance
let rpcClientInstance: ZionRpcClient | null = null;

export function getZionRpc(): ZionRpcClient {
  if (!rpcClientInstance) {
    rpcClientInstance = new ZionRpcClient();
  }
  return rpcClientInstance;
}

export default ZionRpcClient;
