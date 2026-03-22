/**
 * ZION V3 Blockchain RPC Client
 *
 * Direct TCP communication with ZION V3 daemon (line-delimited JSON-RPC 2.0).
 * V3 node speaks raw TCP, not HTTP. Pool metrics also speak raw TCP.
 *
 * V3 RPC Methods:
 *  - getChainInfo: Chain overview (height, tip, mempool, protocol)
 *  - getNodeInfo: Node configuration and state
 *  - getBlockByHeight: Block data by height
 *  - getBlock: Block data by hash
 *  - getTransaction: Transaction by hash
 *  - getMempoolInfo: Mempool statistics
 *  - getPeerInfo: Connected peers
 *  - getBalance / getAccountBalance: Address balance
 *  - getUtxos: UTXOs for address
 *  - submitBlock / submitTransaction: Submission endpoints
 */

import * as net from 'net';
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
  miner_address?: string;
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

// ─── V3 Pool Routing Stats (raw shape from pool metrics TCP endpoint) ────────

export interface V3PoolRoutingStats {
  submits: number;
  accepted: number;
  rejected: number;
  accept_rate_pct: number;
  active_sessions: number;
  uptime_s: number;
  groups: Record<string, { submits: number; accepted: number }>;
  sources: Record<string, { submits: number; accepted: number }>;
}

// ─── TCP Transport ───────────────────────────────────────────────────────────

const RPC_TIMEOUT_MS = 8000;
const POOL_TIMEOUT_MS = 5000;

/**
 * Send a JSON-RPC 2.0 request over raw TCP to the V3 node.
 * Protocol: single request per connection — write JSON line, read response, close.
 */
function tcpJsonRpc(host: string, port: number, method: string, params: any = {}, timeoutMs = RPC_TIMEOUT_MS): Promise<any> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let data = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) { settled = true; socket.destroy(); reject(new Error(`TCP RPC timeout (${method})`)); }
    }, timeoutMs);

    socket.connect(port, host, () => {
      const req = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
      socket.write(req + '\n');
    });

    socket.on('data', (chunk) => { data += chunk.toString(); });

    function settle() {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      const trimmed = data.trim();
      if (!trimmed) { reject(new Error('Empty RPC response')); return; }
      try {
        const json = JSON.parse(trimmed);
        if (json.error) reject(new Error(json.error.message || JSON.stringify(json.error)));
        else resolve(json.result);
      } catch { reject(new Error(`Invalid JSON from RPC: ${trimmed.substring(0, 200)}`)); }
    }

    socket.on('end', settle);
    socket.on('close', settle);
    socket.on('error', (err) => { if (!settled) { settled = true; clearTimeout(timer); reject(err); } });
  });
}

/**
 * Read V3 pool routing metrics over raw TCP.
 * The pool serves HTTP on its metrics port — send GET / and parse the JSON body.
 */
function tcpPoolMetrics(host: string, port: number, timeoutMs = POOL_TIMEOUT_MS): Promise<V3PoolRoutingStats> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let data = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) { settled = true; socket.destroy(); reject(new Error('Pool metrics timeout')); }
    }, timeoutMs);

    socket.connect(port, host, () => {
      socket.write(`GET / HTTP/1.0\r\nHost: ${host}\r\n\r\n`);
    });

    socket.on('data', (chunk) => {
      data += chunk.toString();
    });

    socket.on('end', () => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      // Strip HTTP headers — body starts after \r\n\r\n
      const bodyIdx = data.indexOf('\r\n\r\n');
      const body = bodyIdx >= 0 ? data.slice(bodyIdx + 4).trim() : data.trim();
      if (body) { try { resolve(JSON.parse(body)); } catch { reject(new Error('Invalid pool metrics JSON')); } }
      else reject(new Error('Pool metrics: empty response'));
    });

    socket.on('error', (err) => { if (!settled) { settled = true; clearTimeout(timer); reject(err); } });
  });
}

// ─── Block Mapping Helpers ───────────────────────────────────────────────────

const ATOMIC_PER_ZION = 1_000_000_000_000;

function normalizeRewardZion(rawReward: unknown): number {
  if (typeof rawReward !== 'number' || !Number.isFinite(rawReward) || rawReward <= 0) {
    return 5400.067;
  }

  // Some V3 RPC surfaces expose reward in atomic flowers despite the field name.
  // Treat very large values as atomic and convert them back to ZION.
  if (rawReward >= ATOMIC_PER_ZION) {
    return rawReward / ATOMIC_PER_ZION;
  }

  return rawReward;
}

function mapV3BlockToHeader(block: any): ZionBlockHeader {
  const rewardZion = normalizeRewardZion(block.miner_reward_zion ?? block.subsidy_zion ?? block.reward);
  const txCount = block.transaction_ids?.length ?? block.transactions?.length ?? 0;
  return {
    height: block.height ?? 0,
    hash: block.hash_hex ?? '',
    prev_hash: block.previous_hash_hex ?? '',
    timestamp: block.timestamp ?? 0,
    difficulty: block.difficulty ?? 0,
    nonce: block.nonce ?? 0,
    reward: Math.round(rewardZion * ATOMIC_PER_ZION),
    miner_tx_hash: '',
    num_txes: Math.max(0, txCount - 1),
    block_size: 0,
    orphan_status: false,
    depth: 0,
    major_version: 1,
    minor_version: 0,
    miner_address: block.miner_address ?? '',
  };
}

function mapV3BlockToFull(block: any): ZionBlock {
  const header = mapV3BlockToHeader(block);
  const rewardZion = normalizeRewardZion(block.miner_reward_zion ?? block.subsidy_zion ?? block.reward);
  return {
    ...header,
    miner_tx: {
      version: 1,
      unlock_time: 0,
      vin: [{ gen: { height: block.height ?? 0 } }],
      vout: [{
        amount: Math.round(rewardZion * ATOMIC_PER_ZION),
        target: { key: block.miner_address ?? '' },
      }],
      extra: [],
    },
    tx_hashes: (block.transaction_ids ?? []).slice(1),
  };
}

// ─── RPC Client ──────────────────────────────────────────────────────────────

class ZionRpcClient {
  private nodes: SeedNodeConfig[];
  private primaryIndex: number = 0;

  constructor() {
    this.nodes = getSeedNodesConfig();
  }

  /**
   * Make a V3 JSON-RPC call over TCP with automatic failover across seed nodes.
   */
  async rpcCall<T = any>(method: string, params: Record<string, any> = {}): Promise<T> {
    const errors: string[] = [];

    for (let attempt = 0; attempt < this.nodes.length; attempt++) {
      const nodeIndex = (this.primaryIndex + attempt) % this.nodes.length;
      const node = this.nodes[nodeIndex];
      try {
        const result = await tcpJsonRpc(node.host, node.ports.rpc, method, params) as T;
        if (attempt > 0) this.primaryIndex = nodeIndex;
        return result;
      } catch (err: any) {
        errors.push(`${node.name}: ${err.message}`);
      }
    }
    throw new Error(`All RPC nodes failed: ${errors.join(' | ')}`);
  }

  // ─── High-Level API Methods ──────────────────────────────────────────────

  /** Get network info by combining V3 getChainInfo + getNodeInfo + tip block + getPeerInfo */
  async getInfo(): Promise<ZionNetworkInfo> {
    const [chainInfo, nodeInfo, peerInfo] = await Promise.all([
      this.rpcCall<any>('getChainInfo'),
      this.rpcCall<any>('getNodeInfo').catch(() => null),
      this.rpcCall<any>('getPeerInfo').catch(() => null),
    ]);

    // Get tip block for difficulty
    let difficulty = 0;
    const tipHeight = (chainInfo.chain_height || 1) - 1;
    if (tipHeight >= 0) {
      try {
        const tip = await this.rpcCall<any>('getBlockByHeight', { height: tipHeight });
        difficulty = tip?.difficulty ?? 0;
      } catch { /* use 0 */ }
    }

    const peerCount = peerInfo?.count ?? nodeInfo?.known_peers ?? 0;
    const isTestnet = chainInfo.network === 'testnet';

    return {
      height: chainInfo.chain_height ?? 0,
      top_block_hash: chainInfo.tip_hash ?? '',
      difficulty,
      target: 60,
      tx_count: chainInfo.accepted_blocks ?? chainInfo.chain_height ?? 0,
      tx_pool_size: chainInfo.mempool_transactions ?? 0,
      alt_blocks_count: 0,
      outgoing_connections_count: peerCount,
      incoming_connections_count: 0,
      white_peerlist_size: peerCount,
      grey_peerlist_size: 0,
      mainnet: !isTestnet,
      testnet: isTestnet,
      stagenet: false,
      nettype: chainInfo.network ?? 'testnet',
      cumulative_difficulty: 0,
      block_size_limit: 0,
      block_size_median: 0,
      start_time: 0,
      free_space: 0,
      offline: false,
      status: 'OK',
      version: chainInfo.protocol_version ?? '',
    } as ZionNetworkInfo;
  }

  /** Get last block header using chain height from getChainInfo */
  async getLastBlockHeader(): Promise<ZionBlockHeader> {
    const chainInfo = await this.rpcCall<any>('getChainInfo');
    const height = Math.max(0, (chainInfo.chain_height ?? 1) - 1);
    return this.getBlockHeaderByHeight(height);
  }

  /** Get block header by height via V3 getBlockByHeight */
  async getBlockHeaderByHeight(height: number): Promise<ZionBlockHeader> {
    const block = await this.rpcCall<any>('getBlockByHeight', { height });
    return mapV3BlockToHeader(block);
  }

  /** Get block header by hash via V3 getBlock */
  async getBlockHeaderByHash(hash: string): Promise<ZionBlockHeader> {
    const block = await this.rpcCall<any>('getBlock', { hash });
    return mapV3BlockToHeader(block);
  }

  /** Get range of block headers (inclusive) — sequential V3 getBlockByHeight calls */
  async getBlockHeaders(startHeight: number, endHeight: number): Promise<ZionBlockHeader[]> {
    const clampedStart = Math.max(0, endHeight - 99);
    const start = Math.max(startHeight, clampedStart);

    const promises: Promise<ZionBlockHeader | null>[] = [];
    for (let h = start; h <= endHeight; h++) {
      promises.push(this.getBlockHeaderByHeight(h).catch(() => null));
    }
    const results = await Promise.all(promises);
    return results.filter((b): b is ZionBlockHeader => b !== null);
  }

  /** Get full block with transaction info */
  async getBlock(heightOrHash: number | string): Promise<ZionBlock> {
    const block = typeof heightOrHash === 'number'
      ? await this.rpcCall<any>('getBlockByHeight', { height: heightOrHash })
      : await this.rpcCall<any>('getBlock', { hash: heightOrHash });
    return mapV3BlockToFull(block);
  }

  /** Get chain height */
  async getBlockCount(): Promise<number> {
    const chainInfo = await this.rpcCall<any>('getChainInfo');
    return chainInfo.chain_height ?? 0;
  }

  /** Get transactions by hash via V3 getTransaction */
  async getTransactions(txHashes: string[]): Promise<ZionTransaction[]> {
    if (txHashes.length === 0) return [];
    const results: ZionTransaction[] = [];
    for (const txid of txHashes) {
      try {
        const res = await this.rpcCall<any>('getTransaction', { hash: txid });
        const tx = res?.transaction ?? res ?? {};
        results.push({
          tx_hash: txid,
          block_height: res?.block_height ?? tx.block_height ?? 0,
          block_timestamp: tx.timestamp ?? 0,
          in_pool: !(res?.confirmed ?? true),
          double_spend_seen: false,
          output_indices: [],
          version: tx.version ?? 1,
          unlock_time: 0,
          vin: tx.inputs ?? [],
          vout: tx.outputs ?? [],
          extra: [],
          fee: tx.fee ?? 0,
        });
      } catch { /* skip unavailable tx */ }
    }
    return results;
  }

  /** Get mempool info — V3 only returns count, not individual txs */
  async getTransactionPool(): Promise<ZionMempoolTx[]> {
    try {
      const info = await this.rpcCall<any>('getMempoolInfo');
      // V3 getMempoolInfo returns { size, template_transactions, template_total_fees_zion }
      // No individual tx details available — return empty for now
      return [];
    } catch {
      return [];
    }
  }

  /** Get connected peers via V3 getPeerInfo */
  async getConnections(): Promise<ZionPeer[]> {
    try {
      const res = await this.rpcCall<any>('getPeerInfo');
      const peers = res?.peers ?? [];
      return peers.map((p: any) => ({
        host: p.host ?? '',
        port: p.port ?? 0,
        peer_id: p.address ?? `${p.host}:${p.port}`,
        recv_count: 0,
        send_count: 0,
        state: 'connected',
        live_time: 0,
        avg_download: 0,
        current_download: 0,
        avg_upload: 0,
        current_upload: 0,
        connection_id: p.address ?? '',
        height: 0,
        incoming: false,
        address: p.address ?? `${p.host}:${p.port}`,
      }));
    } catch {
      return [];
    }
  }

  /** Estimate emission from block reward × height (V3 has no dedicated supply RPC) */
  async getCoinbaseTxSum(height: number, count: number): Promise<ZionEmission> {
    const chainInfo = await this.rpcCall<any>('getChainInfo');
    const chainHeight = chainInfo.chain_height ?? 0;
    // BLOCK_REWARD_ATOMIC = 5,400,067,000,000,000 flowers (5400.067 ZION)
    const BLOCK_REWARD_ATOMIC = 5_400_067_000_000_000;
    return {
      emission_amount: chainHeight * BLOCK_REWARD_ATOMIC,
      fee_amount: 0,
      status: 'OK',
    };
  }

  /** Fee estimate — V3 doesn't have this yet */
  async getFeeEstimate(): Promise<{ fee: number; quantization_mask: number }> {
    return { fee: 0, quantization_mask: 1 };
  }

  // ─── Pool Methods (V3 raw TCP pool metrics) ────────────────────────────

  /** Get pool routing statistics via TCP from the pool metrics port */
  async getPoolStats(): Promise<any> {
    const errors: string[] = [];
    for (const node of this.nodes) {
      if (!node.ports.pool_api || node.ports.pool_api === 0) continue;
      try {
        const metrics = await tcpPoolMetrics(node.host, node.ports.pool_api);
        return {
          ok: true,
          hashrate: { pool: 0, pool_24h: 0 },
          miners: { active: metrics.active_sessions ?? 0, total: metrics.active_sessions ?? 0 },
          shares: {
            valid: metrics.accepted ?? 0,
            invalid: metrics.rejected ?? 0,
          },
          blocks: { found: 0, pending: 0 },
          pool: { fee: 5, version: '2.9.8' },
          uptime_s: metrics.uptime_s ?? 0,
          routing: {
            submits: metrics.submits ?? 0,
            accepted: metrics.accepted ?? 0,
            rejected: metrics.rejected ?? 0,
            accept_rate_pct: metrics.accept_rate_pct ?? 0,
            groups: metrics.groups ?? {},
            sources: metrics.sources ?? {},
          },
        };
      } catch (err: any) {
        errors.push(`${node.name}: ${err.message}`);
      }
    }
    return null;
  }

  /** Get miner info by address — try V3 getBalance */
  async getMinerInfo(address: string): Promise<any> {
    try {
      const balance = await this.rpcCall<any>('getBalance', { address });
      return {
        address,
        balance: balance?.balance_zion ?? 0,
        recent_payouts: [],
      };
    } catch {
      return { address, balance: 0, recent_payouts: [] };
    }
  }

  /** Get address balance from V3 */
  async getAddressBalance(address: string): Promise<{ balance_atomic: number; balance_zion: number; utxo_count: number }> {
    try {
      const res = await this.rpcCall<any>('getBalance', { address });
      return {
        balance_atomic: res?.balance_flowers ?? 0,
        balance_zion: res?.balance_zion ?? 0,
        utxo_count: 0,
      };
    } catch {
      return { balance_atomic: 0, balance_zion: 0, utxo_count: 0 };
    }
  }

  /** Get pool blocks — not available in V3 pool metrics */
  async getPoolBlocks(): Promise<any> { return { blocks: [] }; }

  /** Get pool payouts — not available in V3 pool metrics */
  async getPoolPayouts(limit: number = 50): Promise<any> { return { payouts: [] }; }

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

    const tipHeight = Math.max(0, info.height - 1);
    const [lastBlock, poolStats] = await Promise.all([
      this.getBlockHeaderByHeight(tipHeight).catch(() => null),
      this.getPoolStats().catch(() => null),
    ]);

    if (!lastBlock) {
      throw new Error('Failed to get last block');
    }

    const startHeight = Math.max(0, tipHeight - 9);
    const recentBlocks = await this.getBlockHeaders(startHeight, tipHeight).catch(() => []);

    // Estimate emission from block rewards
    const BLOCK_REWARD_ZION = 5400.067;
    const emission = {
      total: info.height * BLOCK_REWARD_ZION,
      fee: 0,
    };

    return {
      info,
      lastBlock,
      recentBlocks: recentBlocks.reverse(),
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
