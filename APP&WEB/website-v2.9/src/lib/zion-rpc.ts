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

import { getSeedNodesConfig, type SeedNodeConfig } from './network-config';
import { SITE_PRIMARY_POOL_API_URL } from './site';

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
  // ── V3 account-model fields ──
  from?: string;
  to?: string;
  amount_zion?: string;
  fee_zion?: number;
  nonce?: number;
  signature?: string;
  public_key?: string;
  tx_id?: string;
  transaction_model?: string;
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

export interface ZionWalletSnapshot {
  address: string;
  balance_atomic: number;
  balance_zion: number;
  chain_height: number;
  transaction_model: string;
  utxo_count: number;
  total_utxo_amount: number;
  utxos: Array<{
    tx_hash: string;
    output_index: number;
    amount: number;
    address: string;
    height: number;
  }>;
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
async function tcpJsonRpc(host: string, port: number, method: string, params: any = {}, timeoutMs = RPC_TIMEOUT_MS): Promise<any> {
  const net = await import('net');
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
async function tcpPoolMetrics(host: string, port: number, timeoutMs = POOL_TIMEOUT_MS): Promise<V3PoolRoutingStats> {
  const net = await import('net');
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

const ATOMIC_PER_ZION = 1_000_000;

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

function parseHostPort(urlOrHost: string | undefined, fallbackHost: string, fallbackPort: number): { host: string; port: number } {
  if (!urlOrHost) return { host: fallbackHost, port: fallbackPort };
  // Strip protocol (http:// or tcp://) and path.
  const stripped = urlOrHost.replace(/^https?:\/\//, '').replace(/^tcp:\/\//, '').split('/')[0];
  const [host, portStr] = stripped.split(':');
  const port = portStr ? parseInt(portStr, 10) : fallbackPort;
  return { host: host || fallbackHost, port: Number.isNaN(port) ? fallbackPort : port };
}

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
        const { host, port } = parseHostPort(node.rpcUrl, node.host, node.ports.rpc);
        const result = await tcpJsonRpc(host, port, method, params) as T;
        if (attempt > 0) this.primaryIndex = nodeIndex;
        return result;
      } catch (err: any) {
        errors.push(`${node.name}: ${err.message}`);
      }
    }
    throw new Error(`All RPC nodes failed: ${errors.join(' | ')}`);
  }

  private async poolHttpGet<T = any>(path: string): Promise<T | null> {
    try {
      const response = await fetch(`${SITE_PRIMARY_POOL_API_URL}${path}`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(4000),
      });

      if (!response.ok) {
        return null;
      }

      return await response.json() as T;
    } catch {
      return null;
    }
  }

  private normalizePoolStats(payload: any): any | null {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    if (payload.hashrate || payload.miners || payload.shares || payload.pool || payload.blockchain) {
      return {
        ok: payload.ok ?? true,
        hashrate: {
          pool: payload.hashrate?.pool ?? payload.hashrate?.pool_1h ?? payload.pool_hashrate ?? 0,
          pool_1h: payload.hashrate?.pool_1h ?? payload.hashrate?.pool ?? payload.pool_hashrate ?? 0,
          pool_24h: payload.hashrate?.pool_24h ?? payload.pool_hashrate_24h ?? 0,
        },
        miners: {
          active: payload.miners?.active ?? 0,
          total: payload.miners?.total ?? payload.miners?.active ?? 0,
        },
        shares: {
          valid: payload.shares?.valid ?? 0,
          invalid: payload.shares?.invalid ?? 0,
        },
        blocks: {
          found: payload.blocks?.found ?? 0,
          pending: payload.blocks?.pending ?? 0,
        },
        pool: payload.pool ?? null,
        uptime_s: payload.pool?.uptime_secs ?? payload.uptime_s ?? 0,
        routing: payload.routing ?? {
          submits: payload.shares?.valid ?? 0,
          accepted: payload.shares?.valid ?? 0,
          rejected: payload.shares?.invalid ?? 0,
          accept_rate_pct: 0,
          groups: {},
          sources: {},
        },
        pplns_window_size: payload.pplns_window_size ?? payload.pplns?.window_size ?? 0,
        payouts: payload.payouts ?? {
          pending_total_atomic: payload.pplns?.total_unpaid_flowers ?? 0,
          pending_miners: 0,
        },
      };
    }

    if ('submits' in payload || 'accepted' in payload || 'active_sessions' in payload) {
      return {
        ok: true,
        hashrate: { pool: 0, pool_1h: 0, pool_24h: 0 },
        miners: {
          active: payload.active_sessions ?? 0,
          total: payload.pplns?.registered_miners ?? payload.active_sessions ?? 0,
        },
        shares: {
          valid: payload.accepted ?? 0,
          invalid: payload.rejected ?? 0,
        },
        blocks: { found: 0, pending: 0 },
        pool: {
          fee: 1,
          humanitarian_tithe: 5,
          issobella_fund: 5,
          miner_share: 89,
          version: '3.0.5',
          uptime_secs: payload.uptime_s ?? 0,
        },
        uptime_s: payload.uptime_s ?? 0,
        routing: {
          submits: payload.submits ?? 0,
          accepted: payload.accepted ?? 0,
          rejected: payload.rejected ?? 0,
          accept_rate_pct: payload.accept_rate_pct ?? 0,
          groups: payload.groups ?? {},
          sources: payload.sources ?? {},
        },
        pplns_window_size: payload.pplns?.window_size ?? 0,
        payouts: {
          pending_total_atomic: payload.pplns?.total_unpaid_flowers ?? 0,
          pending_miners: 0,
        },
      };
    }

    return null;
  }

  // ─── High-Level API Methods ──────────────────────────────────────────────

  /** RPC call to a specific node by its config id. No failover. */
  async rpcCallNode<T = any>(nodeId: string, method: string, params: Record<string, any> = {}): Promise<T> {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) throw new Error(`Node ${nodeId} not found in config`);
    const { host, port } = parseHostPort(node.rpcUrl, node.host, node.ports.rpc);
    return tcpJsonRpc(host, port, method, params) as Promise<T>;
  }

  /** Get info for a specific node (no failover). */
  async getInfoForNode(nodeId: string): Promise<ZionNetworkInfo> {
    const [chainInfo, nodeInfo, peerInfo] = await Promise.all([
      this.rpcCallNode<any>(nodeId, 'getChainInfo'),
      this.rpcCallNode<any>(nodeId, 'getNodeInfo').catch(() => null),
      this.rpcCallNode<any>(nodeId, 'getPeerInfo').catch(() => null),
    ]);
    let difficulty = 0;
    const tipHeight = (chainInfo.chain_height || 1) - 1;
    if (tipHeight >= 0) {
      try {
        const tip = await this.rpcCallNode<any>(nodeId, 'getBlockByHeight', { height: tipHeight });
        difficulty = tip?.difficulty ?? 0;
      } catch { /* use 0 */ }
    }
    const peerCount = peerInfo?.count ?? nodeInfo?.known_peers ?? 0;
    const nettype = chainInfo.network ?? 'mainnet';
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
      mainnet: nettype !== 'testnet',
      testnet: nettype === 'testnet',
      stagenet: false,
      nettype,
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
    const nettype = chainInfo.network ?? 'mainnet';

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
      mainnet: nettype !== 'testnet',
      testnet: nettype === 'testnet',
      stagenet: false,
      nettype,
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

  /** Get recent V3 account-model transactions from latest blocks.
   *  Scans blocks and returns non-coinbase transactions with from/to/amount fields. */
  async getRecentV3Transactions(limit: number = 20): Promise<Array<{
    tx_id: string; from: string; to: string; amount_zion: string;
    fee_zion: number; nonce: number; block_height: number; timestamp: number;
    public_key: string; signature: string;
  }>> {
    const info = await this.getInfo();
    const chainHeight = info.height;
    const txs: any[] = [];
    // Scan last 20 blocks for non-coinbase transactions
    const startHeight = Math.max(0, chainHeight - 19);
    for (let h = chainHeight; h >= startHeight && txs.length < limit; h--) {
      try {
        const block = await this.rpcCall<any>('getBlockByHeight', { height: h });
        const blockTxs = block?.transactions ?? [];
        for (const tx of blockTxs) {
          if (tx.from && tx.from !== 'coinbase') {
            txs.push({
              tx_id: tx.tx_id,
              from: tx.from,
              to: tx.to,
              amount_zion: tx.amount_zion,
              fee_zion: tx.fee_zion ?? 0,
              nonce: tx.nonce ?? 0,
              block_height: h,
              timestamp: block?.timestamp ?? 0,
              public_key: tx.public_key ?? '',
              signature: tx.signature ?? '',
            });
            if (txs.length >= limit) break;
          }
        }
      } catch { /* skip unavailable block */ }
    }
    return txs;
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
        // V3 RPC expects { txid: ... } not { hash: ... }
        const res = await this.rpcCall<any>('getTransaction', { txid });
        const tx = res?.transaction ?? res ?? {};
        // V3 account-model response: { from, to, amount_zion, fee_zion, nonce, signature, public_key, tx_id }
        const amountAtomic = Number(tx.amount_zion ?? 0);
        const feeAtomic = Number(tx.fee_zion ?? 0);
        results.push({
          tx_hash: tx.tx_id ?? txid,
          block_height: res?.block_height ?? tx.block_height ?? 0,
          block_timestamp: tx.timestamp ?? 0,
          in_pool: !(res?.confirmed ?? true),
          double_spend_seen: false,
          output_indices: [],
          version: tx.version ?? 1,
          unlock_time: 0,
          vin: [],
          vout: [],
          extra: [],
          fee: feeAtomic,
          // V3 account-model fields
          from: tx.from,
          to: tx.to,
          amount_zion: tx.amount_zion,
          fee_zion: feeAtomic,
          nonce: tx.nonce,
          signature: tx.signature,
          public_key: tx.public_key,
          tx_id: tx.tx_id,
          transaction_model: res?.transaction_model ?? 'hybrid',
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
    const httpStats = this.normalizePoolStats(await this.poolHttpGet('/stats'));
    if (httpStats) {
      return httpStats;
    }

    const httpPool = this.normalizePoolStats(await this.poolHttpGet('/pool'));
    if (httpPool) {
      return httpPool;
    }

    const errors: string[] = [];
    for (const node of this.nodes) {
      if (!node.ports.pool_api || node.ports.pool_api === 0) continue;
      try {
        const { host, port } = parseHostPort(node.poolApiUrl, node.host, node.ports.pool_api);
        const metrics = await tcpPoolMetrics(host, port);
        return {
          ok: true,
          hashrate: { pool: 0, pool_24h: 0 },
          miners: { active: metrics.active_sessions ?? 0, total: metrics.active_sessions ?? 0 },
          shares: {
            valid: metrics.accepted ?? 0,
            invalid: metrics.rejected ?? 0,
          },
          blocks: { found: 0, pending: 0 },
          pool: { fee: 5, version: '3.0.5' },
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
    const statsPayload = await this.poolHttpGet<any>(`/api/v1/miner/${address}/stats`);
    const payoutsPayload = await this.poolHttpGet<any>(`/api/v1/miner/${address}/payouts`);

    if (statsPayload?.ok && statsPayload?.stats) {
      const minerStats = statsPayload.stats;
      const pendingPayouts = Array.isArray(payoutsPayload?.pending_payouts)
        ? payoutsPayload.pending_payouts
        : [];

      return {
        address,
        balance: {
          pending: (minerStats.pending_balance ?? 0) / 1e6,
          locked: 0,
          paid: (minerStats.total_paid ?? 0) / 1e6,
        },
        recent_payouts: pendingPayouts.map((payout: any) => ({
          amount: payout.amount ?? payout.amount_atomic ?? 0,
          tx_id: payout.tx_id,
          timestamp: payout.created_ts ?? payout.updated_ts ?? 0,
          status: payout.status ?? 'pending',
        })),
        blocks_found: minerStats.blocks_found ?? 0,
        accepted_shares: minerStats.valid_shares ?? 0,
        rejected_shares: minerStats.invalid_shares ?? 0,
        hashrate_1h: minerStats.hashrate_1h ?? 0,
        hashrate_24h: minerStats.hashrate_24h ?? 0,
        first_seen: 0,
        last_seen: minerStats.last_share_time ?? 0,
      };
    }

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
      const balanceAtomic = Number(res?.balance_flowers ?? res?.balance_atomic ?? 0);
      const balanceZion = typeof res?.balance_zion === 'number'
        ? res.balance_zion
        : balanceAtomic / ATOMIC_PER_ZION;
      const utxos = address.startsWith('zion1')
        ? await this.rpcCall<any>('getUtxos', { address }).catch(() => null)
        : null;
      return {
        balance_atomic: balanceAtomic,
        balance_zion: balanceZion,
        utxo_count: utxos?.count ?? utxos?.utxos?.length ?? 0,
      };
    } catch {
      return { balance_atomic: 0, balance_zion: 0, utxo_count: 0 };
    }
  }

  async getWalletSnapshot(address: string): Promise<ZionWalletSnapshot> {
    const [balance, utxos] = await Promise.all([
      this.rpcCall<any>('getBalance', { address }),
      address.startsWith('zion1')
        ? this.rpcCall<any>('getUtxos', { address }).catch(() => null)
        : Promise.resolve(null),
    ]);

    const balanceAtomic = Number(balance?.balance_flowers ?? balance?.balance_atomic ?? 0);
    const balanceZion = typeof balance?.balance_zion === 'number'
      ? balance.balance_zion
      : balanceAtomic / ATOMIC_PER_ZION;
    const rawUtxos = Array.isArray(utxos?.utxos) ? utxos.utxos : [];

    return {
      address,
      balance_atomic: balanceAtomic,
      balance_zion: balanceZion,
      chain_height: balance?.chain_height ?? utxos?.chain_height ?? 0,
      transaction_model: balance?.transaction_model ?? (address.startsWith('zion1') ? 'utxo' : 'account'),
      utxo_count: utxos?.count ?? rawUtxos.length,
      total_utxo_amount: utxos?.total_amount ?? rawUtxos.reduce((sum: number, item: any) => sum + Number(item?.amount ?? 0), 0),
      utxos: rawUtxos.map((item: any) => ({
        tx_hash: item.tx_hash ?? '',
        output_index: item.output_index ?? 0,
        amount: Number(item.amount ?? 0),
        address: item.address ?? address,
        height: item.height ?? 0,
      })),
    };
  }

  async submitSignedTransaction(transaction: unknown, method: 'submitTransaction' | 'submitAccountTransaction' | 'sendRawTransaction' = 'submitTransaction'): Promise<{ accepted: boolean; tx_id?: string }> {
    return this.rpcCall(method, { transaction });
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

// ─── WebSocket Subscriptions Client ────────────────────────────────────────────

export enum SubscriptionType {
  NewBlocks = 'new_blocks',
  PendingTransactions = 'pending_transactions',
  Address = 'address',
  NetworkStatus = 'network_status',
}

export interface WsMessage {
  notification?: {
    subscription: SubscriptionType;
    data: any;
  };
  subscribed?: {
    subscription: SubscriptionType;
  };
  unsubscribed?: {
    subscription: SubscriptionType;
  };
  error?: {
    code: number;
    message: string;
  };
  ping?: boolean;
  pong?: boolean;
}

export interface ClientMessage {
  subscribe?: {
    subscription: SubscriptionType;
  };
  unsubscribe?: {
    subscription: SubscriptionType;
  };
  ping?: boolean;
  pong?: boolean;
}

export class ZionWebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectInterval: number = 5000;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private subscriptions: Set<SubscriptionType> = new Set();
  private messageHandlers: Map<SubscriptionType, (data: any) => void> = new Map();
  private connectionState: 'connecting' | 'connected' | 'disconnected' = 'disconnected';

  constructor(url: string = 'ws://localhost:8445') {
    this.url = url;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      this.connectionState = 'connecting';

      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('[ZionWebSocket] Connected');
          this.connectionState = 'connected';
          
          // Re-subscribe to previous subscriptions
          this.subscriptions.forEach(sub => {
            this.sendSubscribe(sub);
          });

          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WsMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (err) {
            console.error('[ZionWebSocket] Failed to parse message:', err);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[ZionWebSocket] Error:', error);
          this.connectionState = 'disconnected';
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('[ZionWebSocket] Disconnected');
          this.connectionState = 'disconnected';
          this.scheduleReconnect();
        };
      } catch (err) {
        this.connectionState = 'disconnected';
        reject(err);
      }
    });
  }

  private handleMessage(message: WsMessage) {
    if (message.notification) {
      const { subscription, data } = message.notification;
      const handler = this.messageHandlers.get(subscription);
      if (handler) {
        handler(data);
      }
    } else if (message.subscribed) {
      console.log('[ZionWebSocket] Subscribed to:', message.subscribed.subscription);
    } else if (message.unsubscribed) {
      console.log('[ZionWebSocket] Unsubscribed from:', message.unsubscribed.subscription);
    } else if (message.error) {
      console.error('[ZionWebSocket] Error:', message.error);
    } else if (message.ping) {
      this.sendPong();
    }
  }

  private sendSubscribe(subscription: SubscriptionType) {
    const message: ClientMessage = {
      subscribe: { subscription },
    };
    this.send(message);
  }

  private sendUnsubscribe(subscription: SubscriptionType) {
    const message: ClientMessage = {
      unsubscribe: { subscription },
    };
    this.send(message);
  }

  private sendPong() {
    const message: ClientMessage = { pong: true };
    this.send(message);
  }

  private send(message: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) {
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(err => {
        console.error('[ZionWebSocket] Reconnect failed:', err);
      });
    }, this.reconnectInterval);
  }

  subscribe(subscription: SubscriptionType, handler: (data: any) => void): void {
    this.subscriptions.add(subscription);
    this.messageHandlers.set(subscription, handler);

    if (this.connectionState === 'connected') {
      this.sendSubscribe(subscription);
    } else if (this.connectionState === 'disconnected') {
      this.connect().catch(err => {
        console.error('[ZionWebSocket] Failed to connect:', err);
      });
    }
  }

  unsubscribe(subscription: SubscriptionType): void {
    this.subscriptions.delete(subscription);
    this.messageHandlers.delete(subscription);

    if (this.connectionState === 'connected') {
      this.sendUnsubscribe(subscription);
    }
  }

  subscribeToNewBlocks(handler: (data: any) => void): void {
    this.subscribe(SubscriptionType.NewBlocks, handler);
  }

  subscribeToPendingTransactions(handler: (data: any) => void): void {
    this.subscribe(SubscriptionType.PendingTransactions, handler);
  }

  subscribeToAddress(address: string, handler: (data: any) => void): void {
    const subscription = `${SubscriptionType.Address}:${address}` as SubscriptionType;
    this.subscribe(subscription, handler);
  }

  subscribeToNetworkStatus(handler: (data: any) => void): void {
    this.subscribe(SubscriptionType.NetworkStatus, handler);
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.connectionState = 'disconnected';
    this.subscriptions.clear();
    this.messageHandlers.clear();
  }

  isConnected(): boolean {
    return this.connectionState === 'connected';
  }

  getConnectionState(): 'connecting' | 'connected' | 'disconnected' {
    return this.connectionState;
  }
}

// Singleton instance
let wsClientInstance: ZionWebSocketClient | null = null;

export function getZionWebSocket(url?: string): ZionWebSocketClient {
  if (!wsClientInstance) {
    wsClientInstance = new ZionWebSocketClient(url);
  }
  return wsClientInstance;
}
