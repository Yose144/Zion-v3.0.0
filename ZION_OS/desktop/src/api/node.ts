// Direct ZION L1 node JSON-RPC client.

import { jsonRpc, httpGet } from '../lib/client';
import { EDGE_NODE1, EDGE_NODE2, LOCAL_BACKUP_NODE, NODES, rpcUrl, healthUrl, type ServiceEndpoint } from '../config/services';

export interface ChainInfo {
  network: string;
  consensus_profile: string;
  chain_height: number;
  tip_hash: string;
  accepted_blocks: number;
  mempool_transactions: number;
  protocol_version: string;
  transaction_model: string;
  utxo_validation_available: boolean;
}

export interface NodeInfo {
  node_id: string;
  protocol_version: string;
  protocol_version_numeric: number;
  flowers_per_zion: number;
  network: string;
  chain_height: number;
  p2p_bind: string;
  rpc_bind: string;
  pool_bind: string;
  known_peers: number;
  accepted_blocks: number;
  mempool_transactions: number;
  transaction_model: string;
  balance_lookup: string;
}

export interface PeerInfo {
  address: string;
  version: string;
  chain_height?: number;
  connected?: boolean;
  last_seen?: number;
}

export interface Block {
  height: number;
  hash_hex: string;
  timestamp: number;
  previous_hash_hex: string;
  merkle_root: string;
  difficulty: number;
  nonce: number;
  miner_address: string;
  subsidy_zion: number;
  miner_reward_zion: number;
  humanitarian_address: string;
  issobella_address: string;
  pool_fee_address: string;
  transactions: AccountTx[];
  utxo_transactions: UtxoTx[];
}

export interface AccountTx {
  tx_id: string;
  from: string;
  to: string;
  amount_zion: number;
  fee_zion: number;
  memo?: string;
  timestamp: number;
}

export interface UtxoTx {
  id: string;
  inputs: { tx_hash: string; output_index: number; public_key: string }[];
  outputs: { address: string; amount: number; memo?: string }[];
}

export interface MempoolInfo {
  transactions?: AccountTx[];
  size?: number;
  bytes?: number;
}

export interface AddressInfo {
  address: string;
  balance_flowers: string;
  balance_zion: string;
  transaction_count: number;
  utxo_count: number;
  first_seen_height?: number;
  last_seen_height?: number;
  chain_height: number;
  transaction_model: string;
}

export interface Utxo {
  tx_hash: string;
  output_index: number;
  amount: number;
  address: string;
  height: number;
}

export interface UtxoInfo {
  address: string;
  utxos: Utxo[];
  count: number;
  total_amount: number;
  chain_height: number;
}

export interface BalanceInfo {
  address?: string;
  account_id?: string;
  balance_flowers?: string;
  balance_zion?: string;
  chain_height: number;
  transaction_model: string;
}

export interface NodeHealth {
  status?: string;
  uptime_s?: number;
}

export interface NodeStatus {
  endpoint: ServiceEndpoint;
  alive: boolean;
  chainInfo?: ChainInfo | null;
  nodeInfo?: NodeInfo | null;
  peers?: PeerInfo[];
  error?: string;
}

// ── Low-level RPC calls ───────────────────────────────────────────────────

export async function getChainInfo(endpoint: ServiceEndpoint): Promise<ChainInfo | null> {
  return jsonRpc<ChainInfo>(rpcUrl(endpoint), 'getChainInfo', {}, 2500);
}

export async function getNodeInfo(endpoint: ServiceEndpoint): Promise<NodeInfo | null> {
  return jsonRpc<NodeInfo>(rpcUrl(endpoint), 'getNodeInfo', {}, 2500);
}

export async function getPeerInfo(endpoint: ServiceEndpoint): Promise<PeerInfo[] | null> {
  return jsonRpc<PeerInfo[]>(rpcUrl(endpoint), 'getPeerInfo', {}, 2500);
}

export async function getBlockByHeight(endpoint: ServiceEndpoint, height: number): Promise<Block | null> {
  return jsonRpc<Block>(rpcUrl(endpoint), 'getBlockByHeight', { height }, 2500);
}

export async function getBlockByHash(endpoint: ServiceEndpoint, hash: string): Promise<Block | null> {
  return jsonRpc<Block>(rpcUrl(endpoint), 'getBlock', { hash }, 2500);
}

export async function getTransaction(endpoint: ServiceEndpoint, txid: string): Promise<unknown | null> {
  return jsonRpc<unknown>(rpcUrl(endpoint), 'getTransaction', { txid }, 2500);
}

export async function getAddressInfo(endpoint: ServiceEndpoint, address: string): Promise<AddressInfo | null> {
  return jsonRpc<AddressInfo>(rpcUrl(endpoint), 'getAddressInfo', { address }, 2500);
}

export async function getBalance(endpoint: ServiceEndpoint, address: string): Promise<BalanceInfo | null> {
  return jsonRpc<BalanceInfo>(rpcUrl(endpoint), 'getBalance', { address }, 2500);
}

export async function getUtxos(endpoint: ServiceEndpoint, address: string): Promise<UtxoInfo | null> {
  return jsonRpc<UtxoInfo>(rpcUrl(endpoint), 'getUtxos', { address }, 2500);
}

export async function getMempoolInfo(endpoint: ServiceEndpoint): Promise<MempoolInfo | null> {
  return jsonRpc<MempoolInfo>(rpcUrl(endpoint), 'getMempoolInfo', {}, 2500);
}

export async function getTransactionHistory(
  endpoint: ServiceEndpoint,
  address: string,
  offset = 0,
  limit = 50,
): Promise<{ address: string; transactions: unknown[]; total: number; offset: number; limit: number; has_more: boolean } | null> {
  return jsonRpc(rpcUrl(endpoint), 'getTransactionHistory', { address, offset, limit }, 4000);
}

export async function getSupplyInfo(endpoint: ServiceEndpoint): Promise<unknown | null> {
  return jsonRpc<unknown>(rpcUrl(endpoint), 'getSupplyInfo', {}, 2500);
}

export async function submitTransaction(endpoint: ServiceEndpoint, tx: unknown): Promise<unknown | null> {
  return jsonRpc<unknown>(rpcUrl(endpoint), 'submitTransaction', { transaction: tx }, 5000);
}

export async function checkNodeHealth(endpoint: ServiceEndpoint): Promise<boolean> {
  try {
    const h = await httpGet<NodeHealth>(healthUrl(endpoint), 1500);
    return !!h && (h.status === 'ok' || h.status === 'healthy');
  } catch {
    return false;
  }
}

// ── High-level helpers ────────────────────────────────────────────────────

export async function queryAllNodes(): Promise<NodeStatus[]> {
  return Promise.all(
    NODES.map(async (endpoint) => {
      try {
        const [alive, chainInfo, nodeInfo, peers] = await Promise.all([
          checkNodeHealth(endpoint),
          getChainInfo(endpoint),
          getNodeInfo(endpoint),
          getPeerInfo(endpoint),
        ]);
        return {
          endpoint,
          alive: alive || !!(chainInfo || nodeInfo),
          chainInfo,
          nodeInfo,
          peers: peers ?? [],
        };
      } catch (e) {
        return { endpoint, alive: false, chainInfo: null, nodeInfo: null, peers: [], error: String(e) };
      }
    }),
  );
}

export async function getHighestNode(): Promise<{ endpoint: ServiceEndpoint; chainInfo: ChainInfo } | null> {
  const statuses = await queryAllNodes();
  const withHeight = statuses
    .filter((s): s is NodeStatus & { chainInfo: ChainInfo } => !!s.chainInfo)
    .sort((a, b) => b.chainInfo.chain_height - a.chainInfo.chain_height);
  return withHeight[0] ?? null;
}

export async function getLocalOrEdgeChainInfo(): Promise<ChainInfo | null> {
  // Prefer local backup node.
  const local = await getChainInfo(LOCAL_BACKUP_NODE);
  if (local) return local;
  const edge = await getChainInfo(EDGE_NODE1);
  if (edge) return edge;
  return getChainInfo(EDGE_NODE2);
}

export async function getLocalOrEdgeNodeInfo(): Promise<NodeInfo | null> {
  const local = await getNodeInfo(LOCAL_BACKUP_NODE);
  if (local) return local;
  const edge = await getNodeInfo(EDGE_NODE1);
  if (edge) return edge;
  return getNodeInfo(EDGE_NODE2);
}
