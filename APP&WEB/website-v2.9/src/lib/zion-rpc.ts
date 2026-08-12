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
import { estimateMinedSupplyAtHeight } from './supply';

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
  // V31 full reward split
  subsidy_zion?: number;
  miner_reward_zion?: number;
}

export interface ZionV3Transaction {
  tx_id: string;
  from: string;
  to: string;
  amount_zion: string;
  fee_zion: number;
  nonce: number;
  public_key: string;
  signature: string;
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
  // V3 account-model: raw transactions array from getBlockByHeight
  v3_transactions?: ZionV3Transaction[];
}

export interface ZionTransactionInput {
  type?: string;
  amount: number;
  key_image?: string;
  previous_output?: string;
  address?: string;
  output_index?: number;
}

export interface ZionTransactionOutput {
  amount: number;
  address: string;
  key?: string;
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
  // Normalized inputs/outputs for UI/explorer rendering
  inputs?: ZionTransactionInput[];
  outputs?: ZionTransactionOutput[];
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
    timestamp?: number;
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

    function finish(trimmed: string) {
      if (settled) return;
      if (!trimmed) { settled = true; clearTimeout(timer); socket.destroy(); reject(new Error('Empty RPC response')); return; }
      try {
        const json = JSON.parse(trimmed);
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        socket.destroy();
        if (json.error) reject(new Error(json.error.message || JSON.stringify(json.error)));
        else resolve(json.result);
      } catch {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        socket.destroy();
        reject(new Error(`Invalid JSON from RPC: ${trimmed.substring(0, 200)}`));
      }
    }

    socket.connect(port, host, () => {
      const req = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
      socket.write(req + '\n');
    });

    socket.on('data', (chunk) => {
      data += chunk.toString();
      // V3 and V31 nodes reply with one or more JSON lines terminated by newlines.
      // Buffer until we have at least one complete line before parsing.
      let newlineIdx;
      while ((newlineIdx = data.indexOf('\n')) >= 0) {
        const line = data.slice(0, newlineIdx).trim();
        data = data.slice(newlineIdx + 1);
        if (line) {
          finish(line);
          return;
        }
      }
    });

    socket.on('end', () => { if (data.trim()) finish(data.trim()); });
    socket.on('close', () => { if (data.trim()) finish(data.trim()); });
    socket.on('error', (err) => { if (!settled) { settled = true; clearTimeout(timer); socket.destroy(); reject(err); } });
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
  const minerRewardZion = normalizeRewardZion(block.miner_reward_zion ?? block.reward);
  const subsidyZion = normalizeRewardZion(block.subsidy_zion ?? block.miner_reward_zion ?? block.reward);
  const txCount = block.transaction_ids?.length ?? block.transactions?.length ?? 0;
  return {
    height: block.height ?? 0,
    hash: block.hash_hex ?? '',
    prev_hash: block.previous_hash_hex ?? block.prev_hash_hex ?? '',
    timestamp: block.timestamp ?? 0,
    difficulty: block.difficulty ?? 0,
    nonce: block.nonce ?? 0,
    reward: Math.round(minerRewardZion * ATOMIC_PER_ZION),
    miner_tx_hash: '',
    num_txes: Math.max(0, txCount),
    block_size: block.block_size ?? block.size ?? 0,
    orphan_status: false,
    depth: 0,
    major_version: 1,
    minor_version: 0,
    miner_address: block.miner_address ?? '',
    subsidy_zion: subsidyZion,
    miner_reward_zion: minerRewardZion,
  };
}

function mapV3BlockToFull(block: any): ZionBlock {
  const header = mapV3BlockToHeader(block);
  const rewardZion = normalizeRewardZion(block.miner_reward_zion ?? block.subsidy_zion ?? block.reward);
  const v3Txs: ZionV3Transaction[] = Array.isArray(block.transactions) ? block.transactions : [];
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
    v3_transactions: v3Txs,
  };
}

// ─── V31 Native (UTXO) Transaction Helpers ───────────────────────────────────

function bytesToHex(bytes: number[] | string | undefined): string {
  if (!bytes) return '';
  if (typeof bytes === 'string') return bytes.replace(/^0x/i, '').toLowerCase();
  return Array.from(bytes, (b) => (b & 0xff).toString(16).padStart(2, '0')).join('');
}

function amountToAtomic(raw: string | number | undefined): number {
  if (raw === undefined || raw === null) return 0;
  const n = typeof raw === 'string' ? Number(raw) : raw;
  return Number.isFinite(n) ? n : 0;
}

function parseV31Address(addr: any): string {
  if (typeof addr === 'string') return addr;
  if (!addr || typeof addr !== 'object') return '';
  if (typeof addr.encoded === 'string') return addr.encoded;
  return '';
}

function parseV31Output(out: any): { address: string; amount: number; key: string } {
  const amount = amountToAtomic(out?.amount);
  const address = parseV31Address(out?.address);
  return { address, amount, key: address };
}

function parseV31Input(inp: any): { type: string; amount: number; key_image: string | undefined; previous_output: string | undefined; output_index: number } {
  const previousOutput = bytesToHex(inp?.previous_output);
  return {
    type: previousOutput ? 'standard' : 'coinbase',
    amount: 0,
    key_image: previousOutput ? previousOutput : undefined,
    previous_output: previousOutput || undefined,
    output_index: typeof inp?.index === 'number' ? inp.index : 0,
  };
}

function isCoinbaseFromInputs(inputs: any[]): boolean {
  if (!Array.isArray(inputs) || inputs.length === 0) return true;
  return !inputs.some((inp) => bytesToHex(inp?.previous_output));
}

function decodeMemo(bytes: number[] | undefined): string {
  if (!Array.isArray(bytes)) return '';
  try {
    return String.fromCharCode(...bytes.filter((b) => b >= 32 && b < 127));
  } catch {
    return '';
  }
}

function parseV31NativeTransaction(
  raw: any,
  blockHeight = 0,
  blockTimestamp = 0,
  confirmed = true,
  txHashOverride?: string,
): ZionTransaction {
  const res = raw ?? {};
  const tx = res.transaction ?? raw ?? {};
  const inputsRaw = Array.isArray(tx.inputs) ? tx.inputs : [];
  const outputsRaw = Array.isArray(tx.outputs) ? tx.outputs : [];

  const outputs = outputsRaw.map(parseV31Output);
  const inputs = inputsRaw.map(parseV31Input);
  const isCoinbase = isCoinbaseFromInputs(inputsRaw);

  const totalOutputAtomic = outputs.reduce((s: number, o: { amount: number }) => s + o.amount, 0);
  // V31-native transactions do not expose input amounts in the RPC, so fee cannot
  // be calculated without looking up previous outputs. We report 0 fee for now.
  const feeAtomic = 0;

  const txHash = txHashOverride || tx.tx_id || res.tx_id || '';
  const memo = Array.isArray(tx.memo) ? tx.memo : [];
  const memoText = decodeMemo(memo);

  return {
    tx_hash: txHash,
    tx_id: txHash,
    block_height: res.block_height ?? blockHeight,
    block_timestamp: res.block_timestamp ?? blockTimestamp,
    in_pool: !confirmed,
    double_spend_seen: false,
    output_indices: [],
    version: tx.version ?? 1,
    unlock_time: 0,
    inputs: inputs.map((i: { type: string; amount: number; key_image: string | undefined; previous_output: string | undefined; address?: string; output_index: number }) => ({
      type: i.type,
      amount: i.amount,
      key_image: i.key_image,
      previous_output: i.previous_output,
      address: i.address ?? i.previous_output,
      output_index: i.output_index,
    })),
    outputs: outputs.map((o: { address: string; amount: number; key: string }) => ({
      amount: o.amount,
      address: o.address,
      key: o.key,
    })),
    vin: inputs.map((i: { type: string; amount: number; key_image: string | undefined; previous_output: string | undefined }) => ({ key: { amount: i.amount, key_offsets: [], k_image: i.key_image || '' } })),
    vout: outputs.map((o: { address: string; amount: number; key: string }) => ({ amount: o.amount, target: { key: o.key } })),
    extra: memo,
    fee: feeAtomic,
    // V3 account-model compatibility fields derived from UTXO data
    from: isCoinbase
      ? 'coinbase'
      : inputs.length > 0
        ? inputs.map((i: any) => i.address).filter(Boolean).join(', ')
        : '',
    to: outputs.map((o: { address: string }) => o.address).filter(Boolean).join(', '),
    amount_zion: String(totalOutputAtomic),
    fee_zion: 0,
    nonce: 0,
    signature: '',
    public_key: '',
    transaction_model: res.transaction_model ?? 'v31-native',
  };
}

function parseV31TransactionsFromBlock(block: any): ZionTransaction[] {
  if (!block || !Array.isArray(block.transactions)) return [];
  const txIds = Array.isArray(block.transaction_ids) ? block.transaction_ids : [];
  const blockHeight = block.height ?? 0;
  const blockTimestamp = block.timestamp ?? 0;
  return block.transactions.map((tx: any, idx: number) => {
    const wrapped = { transaction: tx, block_height: blockHeight, block_timestamp: blockTimestamp, confirmed: true, transaction_model: 'v31-native' };
    return parseV31NativeTransaction(wrapped, blockHeight, blockTimestamp, true, txIds[idx] ?? tx.tx_id ?? '');
  });
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

  private async poolHttpGet<T = any>(path: string, timeoutMs = 8000): Promise<T | null> {
    try {
      const response = await fetch(`${SITE_PRIMARY_POOL_API_URL}${path}`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        return null;
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/plain') || path === '/metrics') {
        const text = await response.text();
        return text as unknown as T;
      }

      return await response.json() as T;
    } catch {
      return null;
    }
  }

  private parsePrometheusMetrics(text: string): Record<string, number> {
    const metrics: Record<string, number> = {};
    if (!text) return metrics;
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const parts = trimmed.split(/\s+/);
      if (parts.length < 2) continue;
      const name = parts[0];
      const value = Number.parseFloat(parts[parts.length - 1]);
      if (!Number.isNaN(value)) {
        metrics[name] = value;
      }
    }
    return metrics;
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
          version: '3.0.6',
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
    // V31 hybrid: prefer native_chain_height when V3-compat chain is empty.
    const effectiveHeight =
      (chainInfo.native_chain_height ?? 0) > 0
        ? (chainInfo.native_chain_height as number)
        : (chainInfo.chain_height ?? 0);
    let difficulty = chainInfo.difficulty ?? 0;
    if (effectiveHeight > 0 && difficulty === 0) {
      try {
        const tip = await this.rpcCallNode<any>(nodeId, 'getBlockByHeight', { height: effectiveHeight });
        difficulty = tip?.difficulty ?? 0;
      } catch { /* use 0 */ }
    }
    const peerCount = peerInfo?.count ?? nodeInfo?.known_peers ?? 0;
    const nettype = chainInfo.network ?? 'mainnet';
    return {
      height: effectiveHeight,
      top_block_hash: chainInfo.tip_hash ?? chainInfo.native_tip_hash ?? '',
      difficulty,
      target: 60,
      tx_count: chainInfo.accepted_blocks ?? effectiveHeight ?? 0,
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

    // V31 hybrid node: prefer native_chain_height when the V3-compat chain is
    // empty (chain_height == 0). The RPC layer also surfaces the effective
    // height as chain_height, but we guard here for older node builds.
    const effectiveHeight =
      (chainInfo.native_chain_height ?? 0) > 0
        ? (chainInfo.native_chain_height as number)
        : (chainInfo.chain_height ?? 0);

    // Get tip block for difficulty and real TX count
    let difficulty = chainInfo.difficulty ?? 0;
    let txCount = 0;
    if (effectiveHeight > 0 && difficulty === 0) {
      try {
        const tip = await this.rpcCall<any>('getBlockByHeight', { height: effectiveHeight });
        difficulty = tip?.difficulty ?? 0;
        txCount = Array.isArray(tip?.transaction_ids)
          ? tip.transaction_ids.length
          : Array.isArray(tip?.transactions)
            ? tip.transactions.length
            : 0;
      } catch { /* use 0 */ }
    }

    const peerCount = peerInfo?.count ?? nodeInfo?.known_peers ?? 0;
    const nettype = chainInfo.network ?? 'mainnet';

    return {
      height: effectiveHeight,
      top_block_hash: chainInfo.tip_hash ?? chainInfo.native_tip_hash ?? '',
      difficulty,
      target: 60,
      tx_count: txCount,
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

  /** Estimate average block time from the last N blocks */
  async getAverageBlockTime(blocks = 30): Promise<number> {
    try {
      const info = await this.getInfo();
      const tip = info.height;
      if (tip <= 0) return 60;
      const count = Math.min(blocks, tip + 1);
      const headers = await this.getBlockHeaders(tip - count + 1, tip);
      if (headers.length < 2) return 60;
      let totalDelta = 0;
      let pairs = 0;
      for (let i = 1; i < headers.length; i++) {
        const delta = headers[i].timestamp - headers[i - 1].timestamp;
        if (delta > 0) {
          totalDelta += delta;
          pairs++;
        }
      }
      return pairs > 0 ? Math.round((totalDelta / pairs) * 10) / 10 : 60;
    } catch {
      return 60;
    }
  }

  /** Get last block header using chain height from getChainInfo */
  async getLastBlockHeader(): Promise<ZionBlockHeader> {
    const chainInfo = await this.rpcCall<any>('getChainInfo');
    // V31 hybrid: prefer native_chain_height when V3-compat chain is empty.
    const height = Math.max(
      0,
      (chainInfo.native_chain_height ?? 0) > 0
        ? (chainInfo.native_chain_height as number)
        : (chainInfo.chain_height ?? 0),
    );
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

  /** Get range of block headers (inclusive) — concurrency-limited V3 getBlockByHeight calls */
  async getBlockHeaders(startHeight: number, endHeight: number): Promise<ZionBlockHeader[]> {
    // Allow up to 500 blocks per call (needed for miner block scanning).
    const MAX_BLOCKS = 500;
    const clampedStart = Math.max(0, endHeight - (MAX_BLOCKS - 1));
    const start = Math.max(startHeight, clampedStart);

    // Concurrency-limited: process in chunks of 50 to avoid exhausting TCP connections
    const CONCURRENCY = 50;
    const results: (ZionBlockHeader | null)[] = [];
    for (let i = start; i <= endHeight; i += CONCURRENCY) {
      const chunkEnd = Math.min(i + CONCURRENCY - 1, endHeight);
      const promises: Promise<ZionBlockHeader | null>[] = [];
      for (let h = i; h <= chunkEnd; h++) {
        promises.push(this.getBlockHeaderByHeight(h).catch(() => null));
      }
      const chunk = await Promise.all(promises);
      results.push(...chunk);
    }
    return results.filter((b): b is ZionBlockHeader => b !== null);
  }

  /** Get full block with transaction info */
  async getBlock(heightOrHash: number | string): Promise<ZionBlock> {
    const block = typeof heightOrHash === 'number'
      ? await this.rpcCall<any>('getBlockByHeight', { height: heightOrHash })
      : await this.rpcCall<any>('getBlock', { hash: heightOrHash });
    const header = mapV3BlockToHeader(block);
    const v31Txs = parseV31TransactionsFromBlock(block);
    return {
      ...header,
      miner_tx: {
        version: 1,
        unlock_time: 0,
        vin: v31Txs[0]?.inputs?.length ? [] : [{ gen: { height: block.height ?? 0 } }],
        vout: v31Txs[0]?.outputs?.map((o) => ({ amount: Math.round(o.amount), target: { key: o.address ?? '' } })) ?? [{
          amount: Math.round(normalizeRewardZion(block.miner_reward_zion ?? block.subsidy_zion ?? block.reward) * ATOMIC_PER_ZION),
          target: { key: block.miner_address ?? '' },
        }],
        extra: v31Txs[0]?.extra ?? [],
      },
      tx_hashes: (block.transaction_ids ?? []).slice(1),
      v3_transactions: v31Txs as any,
    };
  }

  /** Get recent V31-native transactions from latest blocks.
   *  Scans blocks and returns both coinbase and transfer transactions with UTXO details. */
  async getRecentV3Transactions(limit: number = 20): Promise<Array<{
    tx_id: string; tx_hash: string; from: string; to: string; amount_zion: string;
    fee_zion: number; nonce: number; block_height: number; timestamp: number;
    public_key: string; signature: string; transaction_model: string;
    inputs: { address?: string; amount: number; key?: string; previous_output?: string }[];
    outputs: { address: string; amount: number; key?: string }[];
  }>> {
    const info = await this.getInfo();
    const chainHeight = info.height;
    const txs: any[] = [];
    const startHeight = Math.max(0, chainHeight - 199);
    for (let h = chainHeight; h >= startHeight && txs.length < limit; h--) {
      try {
        const block = await this.rpcCall<any>('getBlockByHeight', { height: h });
        const parsed = parseV31TransactionsFromBlock(block);
        for (const tx of parsed) {
          if (txs.length >= limit) break;
          const isCoinbase = tx.from === 'coinbase';
          txs.push({
            tx_id: tx.tx_hash,
            tx_hash: tx.tx_hash,
            from: isCoinbase ? 'coinbase' : '',
            to: tx.to ?? tx.outputs?.map((o) => o.address).filter(Boolean).join(', ') ?? '',
            amount_zion: tx.amount_zion ?? '0',
            fee_zion: tx.fee_zion ?? 0,
            nonce: 0,
            block_height: tx.block_height,
            timestamp: tx.block_timestamp,
            public_key: '',
            signature: '',
            transaction_model: tx.transaction_model ?? 'v31-native',
            inputs: tx.inputs,
            outputs: tx.outputs,
          });
        }
      } catch { /* skip unavailable block */ }
    }
    return txs;
  }

  /** Get chain height */
  async getBlockCount(): Promise<number> {
    const chainInfo = await this.rpcCall<any>('getChainInfo');
    // V31 hybrid: prefer native_chain_height when V3-compat chain is empty.
    return (chainInfo.native_chain_height ?? 0) > 0
      ? (chainInfo.native_chain_height as number)
      : (chainInfo.chain_height ?? 0);
  }

  /** Get transactions by hash via V3 getTransaction, with input address enrichment */
  async getTransactions(txHashes: string[]): Promise<ZionTransaction[]> {
    if (txHashes.length === 0) return [];
    const results: ZionTransaction[] = [];
    for (const txid of txHashes) {
      try {
        const res = await this.rpcCall<any>('getTransaction', { txid });
        if (!res || !res.transaction) continue;
        const tx = parseV31NativeTransaction(res, res.block_height ?? 0, 0, res.confirmed ?? false, txid);

        // Enrich input addresses from previous transaction outputs
        if (tx.inputs?.length && !tx.inputs.some((i) => i.address && i.address.startsWith('zion1'))) {
          await this.enrichInputAddresses(tx);
        }

        results.push(tx);
      } catch { /* skip unavailable tx */ }
    }
    return results;
  }

  private async enrichInputAddresses(tx: ZionTransaction): Promise<void> {
    const standardInputs = (tx.inputs || []).filter((i) => i.previous_output && i.type !== 'coinbase');
    if (!standardInputs.length) return;

    const CONCURRENCY = 10;
    for (let i = 0; i < standardInputs.length; i += CONCURRENCY) {
      const batch = standardInputs.slice(i, i + CONCURRENCY);
      const enriched = await Promise.all(
        batch.map(async (input) => {
          try {
            const prev = await this.rpcCall<any>('getTransaction', { txid: input.previous_output });
            const prevTx = prev?.transaction;
            if (!prevTx) return input;
            const outIndex = typeof (input as any).output_index === 'number' ? (input as any).output_index : 0;
            const outs = Array.isArray(prevTx.outputs) ? prevTx.outputs : [];
            const out = outs[outIndex] ?? outs[0];
            if (out) {
              input.address = parseV31Address(out?.address);
            }
            return input;
          } catch {
            return input;
          }
        })
      );
      for (const input of enriched) {
        const idx = tx.inputs?.findIndex((i) => i.previous_output === input.previous_output);
        if (idx != null && idx >= 0 && tx.inputs) tx.inputs[idx] = input;
      }
    }

    // Rebuild the account-model `from` field from enriched input addresses
    if (tx.inputs?.length) {
      const fromAddrs = tx.inputs
        .map((i) => i.address)
        .filter((addr): addr is string => typeof addr === 'string' && addr.startsWith('zion1'));
      tx.from = fromAddrs.length ? Array.from(new Set(fromAddrs)).join(', ') : tx.from;
    }
  }

  /** Get transaction history for an address via V3 getTransactionHistory RPC.
   *  Returns confirmed on-chain transactions (both incoming and outgoing)
   *  involving the given address, sorted newest-first. */
  async getTransactionHistory(address: string, limit = 50, offset = 0): Promise<{
    total: number; has_more: boolean; transactions: Array<{
      tx_id: string; from: string; to: string; amount_zion: string;
      fee_zion: number; nonce: number; block_height: number; timestamp: number;
      confirmed: boolean; tx_model: string; signature: string; public_key: string;
    }>;
  }> {
    const res = await this.rpcCall<any>('getTransactionHistory', { address, limit, offset });
    const txs = (res?.transactions ?? []).map((entry: any) => {
      const tx = entry?.transaction ?? {};
      return {
        tx_id: tx.tx_id ?? '',
        from: tx.from ?? '',
        to: tx.to ?? '',
        amount_zion: tx.amount_zion ?? '0',
        fee_zion: tx.fee_zion ?? 0,
        nonce: tx.nonce ?? 0,
        block_height: entry?.block_height ?? 0,
        timestamp: entry?.timestamp ?? 0,
        confirmed: entry?.confirmed ?? true,
        tx_model: entry?.tx_model ?? 'account',
        signature: tx.signature ?? '',
        public_key: tx.public_key ?? '',
      };
    });
    return {
      total: res?.total ?? txs.length,
      has_more: res?.has_more ?? false,
      transactions: txs,
    };
  }

  /** Get mempool info — V31 returns count only, no individual tx list */
  async getTransactionPool(): Promise<{ count: number; size: number; total_fees: number; transactions: ZionMempoolTx[] }> {
    try {
      const [mempoolInfo, chainInfo] = await Promise.all([
        this.rpcCall<any>('getMempoolInfo').catch(() => null),
        this.rpcCall<any>('getChainInfo').catch(() => null),
      ]);
      const count = chainInfo?.mempool_transactions ?? mempoolInfo?.size ?? 0;
      const templateCount = mempoolInfo?.template_transactions ?? 0;
      const totalFeesZion = mempoolInfo?.template_total_fees_zion ?? 0;
      return {
        count,
        size: count + templateCount,
        total_fees: totalFeesZion,
        transactions: [],
      };
    } catch {
      return { count: 0, size: 0, total_fees: 0, transactions: [] };
    }
  }

  /** Get connected peers via V3 getPeerInfo */
  async getConnections(): Promise<ZionPeer[]> {
    try {
      const res = await this.rpcCall<any>('getPeerInfo');
      const peers = res?.peers ?? [];
      return peers.map((p: any) => {
        const incoming = p.inbound === true || p.is_inbound === true || p.direction === 'inbound';
        const state = p.state ?? 'connected';
        return {
          host: p.host ?? '',
          port: p.port ?? 0,
          peer_id: p.address ?? `${p.host}:${p.port}`,
          recv_count: p.bytes_received ?? 0,
          send_count: p.bytes_sent ?? 0,
          state,
          live_time: p.connection_time ?? 0,
          avg_download: p.avg_download ?? 0,
          current_download: p.current_download ?? 0,
          avg_upload: p.avg_upload ?? 0,
          current_upload: p.current_upload ?? 0,
          connection_id: p.address ?? '',
          height: p.height ?? p.chain_height ?? 0,
          incoming,
          connected: p.connected ?? state === 'connected',
          address: p.address ?? `${p.host}:${p.port}`,
        };
      });
    } catch {
      return [];
    }
  }

  /** Estimate emission using Decade Decay model (V3 has no dedicated supply RPC) */
  async getCoinbaseTxSum(height: number, count: number): Promise<ZionEmission> {
    const chainInfo = await this.rpcCall<any>('getChainInfo');
    const chainHeight = chainInfo.chain_height ?? 0;
    // Post-3.0.3: 1 ZION = 1,000,000 flowers (6 decimals).
    const minedZion = estimateMinedSupplyAtHeight(chainHeight);
    return {
      emission_amount: minedZion * ATOMIC_PER_ZION,
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
    // Try HTTP pool API first (V31 pool exposes /stats, /metrics, /miners)
    const [statsPayload, metricsText, minersPayload] = await Promise.all([
      this.poolHttpGet<any>('/stats', 10000),
      this.poolHttpGet<string>('/metrics', 10000),
      this.poolHttpGet<any>('/miners?limit=200', 10000),
    ]);

    const metrics = this.parsePrometheusMetrics(metricsText || '');

    // If we got any of the HTTP endpoints, build a normalized stats object.
    if (statsPayload || metricsText || minersPayload) {
      const stats = statsPayload || {};
      const shares = stats.shares || {};
      const pplns = stats.pplns || {};
      const routing = stats.routing || {};
      const poolInfo = stats.pool || {};

      const accepted = shares.accepted ?? metrics['zion_pool_shares_accepted'] ?? routing.accepted ?? 0;
      const rejected = shares.rejected ?? metrics['zion_pool_shares_rejected'] ?? routing.rejected ?? 0;
      const totalShares = accepted + rejected;

      const miners = Array.isArray(minersPayload?.miners) ? minersPayload.miners : [];
      const metricActiveSessions = metrics['zion_pool_active_sessions'] ?? 0;
      const activeSessions = Math.max(
        metricActiveSessions,
        stats.sessions ?? 0,
        miners.length,
      );
      const registeredMiners = Math.max(
        pplns.registered_miners ?? metrics['zion_pool_pplns_registered_miners'] ?? 0,
        miners.length,
      );
      const blocksFound = metrics['zion_pool_blocks_found_total'] ?? 0;
      const hashratePool = metrics['zion_pool_hashrate_hps'] ?? 0;
      const hashrate1h = metrics['zion_pool_hashrate_1h_hps'] ?? 0;
      const uptimeSeconds = stats.uptime_s ?? metrics['zion_pool_uptime_s'] ?? 0;

      return {
        ok: true,
        hashrate: {
          pool: hashratePool,
          pool_1h: hashrate1h,
          pool_24h: 0,
        },
        miners: {
          active: activeSessions,
          total: registeredMiners,
        },
        shares: {
          valid: accepted,
          invalid: rejected,
        },
        blocks: {
          found: blocksFound,
          pending: 0,
        },
        pool: {
          fee: (poolInfo.fee_bps ?? 100) / 100,
          humanitarian_tithe: poolInfo.humanitarian_pct ?? 5,
          issobella_fund: poolInfo.issobella_pct ?? 5,
          miner_share: poolInfo.miner_pct ?? 89,
          version: '3.1.0',
          uptime_secs: uptimeSeconds,
        },
        uptime_s: uptimeSeconds,
        routing: {
          submits: totalShares,
          accepted: accepted,
          rejected: rejected,
          accept_rate_pct: totalShares > 0 ? (accepted / totalShares) * 100 : 0,
          groups: routing.groups ?? {},
          sources: routing.sources ?? {},
        },
        pplns_window_size: pplns.window_size ?? metrics['zion_pool_pplns_window_size'] ?? 0,
        payouts: {
          pending_total_atomic: pplns.total_unpaid_flowers ?? 0,
          pending_miners: 0,
        },
        miners_list: miners,
      };
    }

    // Fallback to raw TCP pool metrics (legacy)
    const errors: string[] = [];
    for (const node of this.nodes) {
      if (!node.ports.pool_api || node.ports.pool_api === 0) continue;
      try {
        const { host, port } = parseHostPort(node.poolApiUrl, node.host, node.ports.pool_api);
        const metrics = await tcpPoolMetrics(host, port);
        return {
          ok: true,
          hashrate: { pool: 0, pool_1h: 0, pool_24h: 0 },
          miners: { active: metrics.active_sessions ?? 0, total: metrics.active_sessions ?? 0 },
          shares: { valid: metrics.accepted ?? 0, invalid: metrics.rejected ?? 0 },
          blocks: { found: 0, pending: 0 },
          pool: { fee: 1, humanitarian_tithe: 5, issobella_fund: 5, miner_share: 89, version: '3.0.6' },
          uptime_s: metrics.uptime_s ?? 0,
          routing: {
            submits: metrics.submits ?? 0,
            accepted: metrics.accepted ?? 0,
            rejected: metrics.rejected ?? 0,
            accept_rate_pct: metrics.accept_rate_pct ?? 0,
            groups: metrics.groups ?? {},
            sources: metrics.sources ?? {},
          },
          pplns_window_size: 0,
          payouts: { pending_total_atomic: 0, pending_miners: 0 },
          miners_list: [],
        };
      } catch (err: any) {
        errors.push(`${node.name}: ${err.message}`);
      }
    }
    return null;
  }

  /** Scan on-chain account transactions for payouts from the pool wallet to a miner.
   *  This is authoritative when the pool's internal DB loses telemetry or partial data. */
  async getChainPayoutsForAddress(
    address: string,
    maxBlocks = 2000,
  ): Promise<{ totalPaidAtomic: number; payouts: Array<{ amount: number; amount_zion: number; tx_id: string; timestamp: number; status: string }> }> {
    const info = await this.getInfo().catch(() => null);
    const tipHeight = Math.max(0, info?.height ?? 0);
    const scanStart = Math.max(0, tipHeight - maxBlocks + 1);
    const poolWallet = (await import('@/lib/constants')).POOL_WALLET.toLowerCase();
    const target = address.toLowerCase();

    let totalPaidAtomic = 0n;
    const payouts: Array<{ amount: number; amount_zion: number; tx_id: string; timestamp: number; status: string }> = [];

    const BATCH_SIZE = 25;
    for (let start = scanStart; start <= tipHeight; start += BATCH_SIZE) {
      const batch: Promise<any>[] = [];
      for (let h = start; h <= tipHeight && batch.length < BATCH_SIZE; h++) {
        batch.push(this.rpcCall<any>('getBlockByHeight', { height: h }).catch(() => null));
      }
      const blocks = await Promise.all(batch);
      for (const block of blocks) {
        if (!block?.transactions) continue;
        for (const tx of block.transactions) {
          if (
            typeof tx.from === 'string' &&
            tx.from.toLowerCase() === poolWallet &&
            typeof tx.to === 'string' &&
            tx.to.toLowerCase() === target &&
            tx.amount_zion
          ) {
            const amountAtomic = BigInt(tx.amount_zion);
            totalPaidAtomic += amountAtomic;
            payouts.push({
              amount: Number(amountAtomic),
              amount_zion: Number(amountAtomic) / ATOMIC_PER_ZION,
              tx_id: tx.tx_id || tx.tx_hash || '',
              timestamp: block.timestamp || 0,
              status: 'confirmed',
            });
          }
        }
      }
    }

    payouts.sort((a, b) => b.timestamp - a.timestamp);
    const total = Number(totalPaidAtomic);
    return { totalPaidAtomic: Number.isFinite(total) ? total : 0, payouts };
  }

  /** Get miner info by address — try V3 getBalance */
  async getMinerInfo(address: string): Promise<any> {
    const lowerAddress = address.toLowerCase();

    // First try direct pool API by worker name/address and telemetry list.
    // Each call is wrapped so one slow/failing endpoint doesn't abort the others.
    const [statsPayload, payoutsPayload, minersList] = await Promise.all([
      this.poolHttpGet<any>(`/api/v1/miners/${encodeURIComponent(address)}`, 15000).catch(() => null),
      this.poolHttpGet<any>(`/api/v1/payouts?miner=${encodeURIComponent(address)}&limit=50`, 15000).catch(() => null),
      this.poolHttpGet<any>('/miners?limit=50', 15000).catch(() => null),
    ]);

    // Try to find the miner either from direct stats, telemetry list, or share store.
    // Prefer telemetry list because /api/v1/miners/{address} treats the address as a
    // worker name and returns empty data when the real worker name is address.something.
    let matched: any = null;
    if (minersList?.ok && Array.isArray(minersList.miners)) {
      matched = minersList.miners.find((m: any) =>
        (m.address || m.payout_address || m.miner_id || '').toLowerCase() === lowerAddress,
      );
      if (!matched) {
        // Partial match against worker field.
        matched = minersList.miners.find((m: any) =>
          (m.worker || m.worker_name || '').toLowerCase().includes(lowerAddress),
        );
      }
    }

    if (!matched && statsPayload?.ok) {
      matched = statsPayload.miner || statsPayload.stats;
    }

    const chainPayouts = await this.getChainPayoutsForAddress(address, 200).catch(() => ({ totalPaidAtomic: 0, payouts: [] }));

    if (matched) {
      const pendingPayouts = Array.isArray(payoutsPayload?.payouts)
        ? payoutsPayload.payouts
        : [];

      const poolTotalPaidAtomic = Number(matched.paid_total_atomic ?? matched.total_paid ?? 0);
      const totalPaidAtomic = chainPayouts.totalPaidAtomic || poolTotalPaidAtomic;

      const pending = pendingPayouts.map((payout: any) => ({
        amount: (payout.amount_zion ?? (payout.amount_flowers ?? payout.amount ?? 0) / 1_000_000),
        tx_id: payout.tx_id,
        timestamp: payout.ts ?? payout.created_ts ?? payout.updated_ts ?? 0,
        status: payout.confirmed ? 'confirmed' : (payout.status ?? 'pending'),
      }));

      const confirmed = chainPayouts.payouts.map((payout) => ({
        amount: payout.amount_zion,
        tx_id: payout.tx_id,
        timestamp: payout.timestamp,
        status: payout.status,
      }));

      const recentPayouts = [...pending, ...confirmed]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 50);

      return {
        address,
        worker: matched.worker || statsPayload?.worker || matched.worker_name || address,
        balance: {
          pending: (Number(matched.pending_balance ?? 0)) / 1_000_000,
          locked: 0,
          paid: totalPaidAtomic / 1_000_000,
        },
        recent_payouts: recentPayouts,
        blocks_found: matched.blocks_found ?? 0,
        accepted_shares: matched.valid_shares ?? 0,
        rejected_shares: matched.invalid_shares ?? 0,
        hashrate: matched.hashrate_hps ?? 0,
        hashrate_1h: matched.hashrate_1h_hps ?? 0,
        hashrate_24h: matched.hashrate_24h_hps ?? 0,
        first_seen: matched.first_seen_s ?? 0,
        last_seen: matched.last_seen_s ?? matched.last_share_time ?? 0,
      };
    }

    try {
      const balance = await this.rpcCall<any>('getBalance', { address });
      return {
        address,
        balance: balance?.balance_zion ?? 0,
        recent_payouts: chainPayouts.payouts.map((payout) => ({
          amount: payout.amount_zion,
          tx_id: payout.tx_id,
          timestamp: payout.timestamp,
          status: payout.status,
        })),
      };
    } catch {
      return {
        address,
        balance: 0,
        recent_payouts: chainPayouts.payouts.map((payout) => ({
          amount: payout.amount_zion,
          tx_id: payout.tx_id,
          timestamp: payout.timestamp,
          status: payout.status,
        })),
      };
    }
  }

  /** Get address balance from V3 */
  async getAddressBalance(address: string): Promise<{ balance_atomic: number; balance_zion: number; utxo_count: number }> {
    try {
      const [balance, utxos] = await Promise.all([
        this.rpcCall<any>('getBalance', { address }),
        address.startsWith('zion1')
          ? this.rpcCall<any>('getUtxos', { address }).catch(() => null)
          : Promise.resolve(null),
      ]);

      const rawUtxos = Array.isArray(utxos?.utxos) ? utxos.utxos : [];
      const utxoTotal = utxos?.total_amount ?? rawUtxos.reduce((sum: number, item: any) => sum + Number(item?.amount ?? 0), 0);
      const balanceAtomic = utxoTotal > 0
        ? utxoTotal
        : Number(balance?.balance_flowers ?? balance?.balance_atomic ?? balance?.balance ?? 0);
      const balanceZion = typeof balance?.balance_zion === 'number' && balance.balance_zion > 0
        ? balance.balance_zion
        : balanceAtomic / ATOMIC_PER_ZION;

      return {
        balance_atomic: balanceAtomic,
        balance_zion: balanceZion,
        utxo_count: utxos?.count ?? rawUtxos.length,
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

    const rawUtxos = Array.isArray(utxos?.utxos) ? utxos.utxos : [];
    const utxoTotal = utxos?.total_amount ?? rawUtxos.reduce((sum: number, item: any) => sum + Number(item?.amount ?? 0), 0);
    const balanceAtomic = utxoTotal > 0
      ? utxoTotal
      : Number(balance?.balance_flowers ?? balance?.balance_atomic ?? balance?.balance ?? 0);
    const balanceZion = typeof balance?.balance_zion === 'number' && balance.balance_zion > 0
      ? balance.balance_zion
      : balanceAtomic / ATOMIC_PER_ZION;

    return {
      address,
      balance_atomic: balanceAtomic,
      balance_zion: balanceZion,
      chain_height: balance?.chain_height ?? utxos?.chain_height ?? 0,
      transaction_model: balance?.transaction_model ?? (address.startsWith('zion1') ? 'utxo' : 'account'),
      utxo_count: utxos?.count ?? rawUtxos.length,
      total_utxo_amount: utxoTotal,
      utxos: rawUtxos.map((item: any) => ({
        tx_hash: item.tx_hash ?? '',
        output_index: item.output_index ?? 0,
        amount: Number(item.amount ?? 0),
        address: item.address ?? address,
        height: item.height ?? 0,
        timestamp: 0,
      })),
    };
  }

  /** Enrich UTXO metadata (height/timestamp) for a small list of tx hashes.
   *  Used by the explorer address page to show recent transaction details. */
  async enrichUtxoMetadata(txHashes: string[]): Promise<Map<string, { height: number; timestamp: number; inputs: any[]; outputs: any[] }>> {
    const map = new Map<string, { height: number; timestamp: number; inputs: any[]; outputs: any[] }>();
    const uniqueHashes = Array.from(new Set<string>(txHashes));
    const CONCURRENCY = 20;
    for (let i = 0; i < uniqueHashes.length; i += CONCURRENCY) {
      const batch = uniqueHashes.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (txHash: string) => {
          try {
            const txs = await this.getTransactions([txHash]);
            const tx = txs[0];
            if (!tx) return null;
            let ts = tx.block_timestamp ?? 0;
            const bh = tx.block_height ?? 0;
            if (!ts && bh > 0) {
              try {
                const block = await this.getBlock(bh);
                ts = block?.timestamp ?? 0;
              } catch { /* ignore */ }
            }
            return {
              tx_hash: txHash,
              height: bh,
              timestamp: ts,
              inputs: tx.inputs ?? [],
              outputs: tx.outputs ?? [],
            };
          } catch {
            return null;
          }
        })
      );
      for (const r of results) {
        if (r) map.set(r.tx_hash, { height: r.height, timestamp: r.timestamp, inputs: r.inputs, outputs: r.outputs });
      }
    }
    return map;
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

    const tipHeight = Math.max(0, info.height);
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

/**
 * Resolve the default WebSocket URL for Zion realtime subscriptions.
 * Prefers NEXT_PUBLIC_WS_URL, then derives a same-origin /ws endpoint
 * from the current window location, falling back to the legacy localhost
 * port only when no window is available (e.g. during SSR/build).
 */
export function getZionWebSocketUrl(): string {
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_WS_URL) {
    return process.env.NEXT_PUBLIC_WS_URL;
  }
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws`;
  }
  return 'ws://localhost:8445';
}

export class ZionWebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectInterval: number = 5000;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private subscriptions: Set<SubscriptionType> = new Set();
  private messageHandlers: Map<SubscriptionType, (data: any) => void> = new Map();
  private connectionState: 'connecting' | 'connected' | 'disconnected' = 'disconnected';

  constructor(url: string = getZionWebSocketUrl()) {
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
