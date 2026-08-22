/**
 * ZION Explorer V4 — TypeScript Types
 *
 * Canonical types for all explorer data shapes.
 * Used by the typed API client, SWR hooks, and UI components.
 */

// ── Blockchain Stats ────────────────────────────────────────────────────────

export interface ExplorerStats {
  block_height: number;
  top_block_hash: string;
  difficulty: number;
  cumulative_difficulty: number;
  premine_supply: number;
  mined_supply: number;
  circulating_supply: number;
  total_supply: number;
  max_supply: number;
  remaining_supply: number;
  emission_pct: string;
  network_hashrate: number;
  network_hashrate_formatted: string;
  target_block_time: number;
  avg_block_time: number;
  tx_count: number;
  tx_pool_size: number;
  incoming_connections: number;
  outgoing_connections: number;
  total_connections: number;
  white_peerlist_size: number;
  grey_peerlist_size: number;
  version: string;
  status: string;
  mainnet: boolean;
  testnet: boolean;
  pool_hashrate: number;
  pool_hashrate_formatted: string;
  active_miners: number;
  total_miners: number;
  pool_blocks_found: number;
  valid_shares: number;
  pool_uptime_s: number;
  pool_pplns_window: number;
  pool_pending_payouts_atomic: number;
  pool_pending_miners: number;
  block_size_limit: number;
  block_size_median: number;
  database_size: number;
  alt_blocks_count: number;
  connected: boolean;
  last_block: {
    height: number;
    hash: string;
    timestamp: number;
    difficulty: number;
    reward: number;
    num_txes: number;
    block_size: number;
  } | null;
  latest_block: {
    height: number;
    hash: string;
    timestamp: number;
  } | null;
  mempool_size: number;
  total_blocks: number;
  total_transactions: number;
}

// ── Block ───────────────────────────────────────────────────────────────────

export interface ExplorerBlockTx {
  tx_hash: string;
  type: string;
  fee: number;
  amount: number;
  timestamp?: number;
  from?: string;
  to?: string;
  nonce?: number;
  signature?: string;
  public_key?: string;
  amount_zion?: string;
  fee_zion?: number;
  transaction_model?: string;
  inputs?: Array<{ type: string; amount: number; key_image?: string }>;
  outputs?: Array<{ amount: number; key: string }>;
}

export interface ExplorerBlock {
  height: number;
  hash: string;
  prev_hash: string;
  timestamp: number;
  difficulty: number;
  nonce: number;
  reward: number;
  block_size: number;
  num_txes: number;
  orphan_status: boolean;
  depth: number;
  major_version: number;
  minor_version: number;
  miner_tx_hash: string;
  confirmations: number;
  status: string;
  miner: string;
  miner_address: string;
  miner_label: string | null;
  is_pool_block: boolean;
  tx_count: number;
  txs: ExplorerBlockTx[];
  tx_hashes: string[];
  total_fees: number;
  total_output: number;
}

export interface ExplorerBlockListItem {
  height: number;
  hash: string;
  prev_hash: string;
  timestamp: number;
  transactions: number;
  num_txes: number;
  miner: string;
  reward: number;
  difficulty: number;
  block_size: number;
  nonce: number;
  orphan_status: boolean;
  depth: number;
  status: string;
}

// ── Transaction ─────────────────────────────────────────────────────────────

export interface ExplorerTxInput {
  address?: string;
  amount: number;
  type: string;
  key_image?: string;
}

export interface ExplorerTxOutput {
  address?: string;
  amount: number;
  type: string;
  key?: string;
}

export interface ExplorerTransaction {
  hash: string;
  tx_id: string;
  tx_hash: string;
  block_height: number;
  block_hash: string;
  block_timestamp: number;
  timestamp: number;
  confirmations: number;
  in_pool: boolean;
  status: string;
  amount: number;
  amount_zion: string;
  fee: number;
  fee_zion: number;
  size: number;
  from: string;
  to: string;
  nonce: number;
  signature: string;
  public_key: string;
  transaction_model: string;
  type: string;
  from_label: string | null;
  to_label: string | null;
  inputs: ExplorerTxInput[];
  outputs: ExplorerTxOutput[];
  version: number;
  unlock_time: number;
  extra: number[];
  double_spend_seen: boolean;
}

export interface ExplorerTxListItem {
  tx_hash: string;
  type: string;
  from: string;
  to: string;
  amount: number;
  amount_zion: string;
  fee: number;
  fee_zion: number;
  nonce: number;
  block_height: number;
  timestamp: number;
  status: string;
  confirmations: number;
  transaction_model: string;
}

// ── Address ─────────────────────────────────────────────────────────────────

export interface ExplorerAddressBalance {
  total: number;
  total_atomic: number;
  utxo_count: number;
  pool_pending: number;
  pool_locked: number;
  pool_paid: number;
}

export interface ExplorerAddressMiningStats {
  blocks_found: number;
  accepted_shares: number;
  rejected_shares: number;
  worker_name: string;
  hashrate_1h: number;
  hashrate_formatted: string;
  consciousness_level: string;
  consciousness_multiplier: number;
}

export interface ExplorerAddress {
  address: string;
  known_label: string | null;
  known_type: string | null;
  balance: ExplorerAddressBalance;
  total_received: number;
  total_sent: number;
  net_balance: number;
  transaction_count: number;
  first_seen: number;
  last_seen: number;
  is_miner: boolean;
  mining_stats: ExplorerAddressMiningStats;
  transactions: ExplorerTxListItem[];
}

// ── Mempool ─────────────────────────────────────────────────────────────────

export interface ExplorerMempoolFeeStats {
  min: number;
  max: number;
  avg: number;
  median: number;
}

export interface ExplorerMempool {
  count: number;
  pool_size_bytes: number;
  total_fees: number;
  fee_stats: ExplorerMempoolFeeStats;
  transactions: ExplorerMempoolTx[];
}

export interface ExplorerMempoolTx {
  id_hash: string;
  fee: number;
  size: number;
  inputs?: number;
  outputs?: number;
  amount?: number;
  from?: string;
  to?: string;
}

// ── Peers ───────────────────────────────────────────────────────────────────

export interface ExplorerPeer {
  address: string;
  host: string;
  port: number;
  height: number;
  incoming: boolean;
  connected: boolean;
  state: string;
  sub_version: string;
  last_seen: number;
  idle_seconds: number;
  failed_attempts: number;
}

export interface ExplorerPeers {
  count: number;
  connected_peers: number;
  known_peers: number;
  peer_count: number;
  chain_height: number;
  peers: ExplorerPeer[];
}

// ── Rich List ───────────────────────────────────────────────────────────────

export interface ExplorerRichListEntry {
  rank: number;
  address: string;
  balance: number;
  balance_display: string;
  type: string;
  label: string | null;
  percentage: number;
}

export interface ExplorerRichList {
  rich_list: ExplorerRichListEntry[];
}

// ── Search ──────────────────────────────────────────────────────────────────

export interface ExplorerSearchResult {
  type: 'block' | 'transaction' | 'address' | 'not_found';
  found: boolean;
  block?: ExplorerBlock;
  transaction?: ExplorerTransaction;
  address?: ExplorerAddress;
  query: string;
}

// ── SSE Events ──────────────────────────────────────────────────────────────

export interface SseStatsEvent {
  height: number;
  tip_hash: string;
  difficulty: number;
  network_hashrate: number;
  mempool_size: number;
  mempool_bytes: number;
  protocol_version: string;
  consensus_profile: string;
  timestamp: number;
}

export interface SseNewBlockEvent {
  height: number;
  hash: string;
  prev_hash: string;
  timestamp: number;
  difficulty: number;
  reward: number;
  tx_count: number;
  miner: string;
}

export interface SseMempoolUpdateEvent {
  count: number;
  size_bytes: number;
  prev_count: number;
  timestamp: number;
}

export interface SsePingEvent {
  timestamp: number;
}

// ── Broadcast ───────────────────────────────────────────────────────────────

export interface BroadcastResult {
  accepted: boolean;
  tx_id: string;
  method?: string;
  model?: string;
  error?: string;
}

// ── Verify Message ──────────────────────────────────────────────────────────

export interface VerifyMessageResult {
  valid: boolean;
  publicKey: string;
  address: string;
  providedAddress: string | null;
  addressMatch?: boolean;
  message: string;
  algorithm: string;
  error?: string;
}

// ── Consensus ───────────────────────────────────────────────────────────────

export interface ConsensusNetworkInfo {
  mainnet: boolean;
  testnet: boolean;
  chain_height: number;
  current_difficulty: number;
  top_block_hash: string;
}

export interface ConsensusRewardSplit {
  miner: number;
  humanitarian: number;
  issobella: number;
  pool_fee: number;
}

export interface ConsensusDecade {
  index: number;
  reward: number;
  blocks: number;
  share: string;
}

export interface ConsensusParameters {
  daa: string;
  target_block_time: number;
  pow_algorithms: string[];
  reward_split: ConsensusRewardSplit;
  fee_burn: boolean;
  max_supply: number;
  tail_emission: number;
  decades: ConsensusDecade[];
}

export interface ExplorerConsensus {
  protocol: string;
  version: string;
  network: ConsensusNetworkInfo;
  consensus: ConsensusParameters;
  difficulty_chart: { labels: string[]; values: number[] } | null;
  fetched_at: number;
}

// ── Miners ───────────────────────────────────────────────────────────────────

export interface ExplorerMiner {
  rank: number;
  address: string;
  hashrate: number;
  hashrate_formatted: string;
  shares_accepted: number;
  shares_rejected: number;
  blocks_found: number;
  paid: number;
  pending: number;
  last_seen: number;
  worker_name?: string;
  label?: string | null;
  efficiency_pct: number;
  type: 'pool' | 'solo';
  balance: number;
}

export interface ExplorerMiners {
  miners: ExplorerMiner[];
  total_hashrate: number;
  total_hashrate_formatted: string;
  active_miners: number;
  blocks_found: number;
  total_shares: number;
  fetched_at: number;
}
