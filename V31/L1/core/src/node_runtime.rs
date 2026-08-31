#![allow(dead_code)]
#![allow(unused_imports)]
#![allow(unused_variables)]
#![allow(clippy::large_enum_variant)]
//! NodeRuntime, CoreRuntime and supporting types — ported from V3 lib.rs.
//!
//! This module is not yet wired into the V31 node runtime. It compiles but
//! functionality will come when all V3 modules are wired together.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::chain_state::{
    self, body_hash_hex, confirmed_balance_from_blocks, dedup_peers, derive_block_body_hash,
    derive_template_merkle_root, encode_json_line, filter_balance_sufficient,
    genesis_accepted_block, hex, is_valid_account_id, journal_path, now_secs, parse_fixed_hex,
    select_template_transactions, select_template_utxo_transactions, snapshot_temp_path,
    ChainJournalEntry, ChainState, ChainStateSnapshot, ChainStore, SpendableUtxo, TemplateState,
};
use crate::crypto;
use crate::difficulty;
use crate::emission;
use crate::fee;
use crate::launch;
use crate::v3_bridge as bridge;
use crate::v3_bridge::{BridgeUnlockRequest, BridgeValidatorProof};
use crate::v3_compat::{
    self as compat, BlockCandidate, DifficultyTarget, MiningHeader, MiningJob, MiningSolution,
    SealedBlock,
};
pub use crate::v3_p2p::{NetworkId, PeerEndpoint};
use crate::v3_tx as tx;
use crate::v3_validation as validation;
use crate::websocket::WebSocketServer;

use zion_cosmic_harmony::{EkamDeeksha, CANONICAL_ALGORITHM as EKAM_DEEKSHA_ALGORITHM};
use zion_cosmic_harmony_v3::{
    account_tx_memo_v1_active, body_root_v2_active, cosmic_harmony_with_height,
    profile_name_for_height, tx_hash_v2_active, NclStats, RevenueCollector, RevenueEvent,
    RevenueStats, CHV3_FORK_HEIGHT, CHV_EKAM_FORK_HEIGHT, EKAM_FUSION_ROUNDS, FIRE_FORK_HEIGHT,
};

pub use zion_cosmic_harmony::ExternalCoin;
pub use zion_cosmic_harmony_v3::NclStats as NclSnapshot;
pub use zion_cosmic_harmony_v3::RevenueSource;

pub const HEADER_SIZE: usize = MiningHeader::HEADER_SIZE;
pub const NODE_PROTOCOL_VERSION: &str = "zion-v3-node/3.1.0-alpha";
pub const PROTOCOL_VERSION: u32 = 2;
pub const LEGACY_PROTOCOL_VERSION: u32 = 1;
pub const MAX_TEMPLATE_TRANSACTIONS: usize = 16;
pub const MAX_MEMPOOL_TRANSACTIONS: usize = 4_096;
pub const MAX_TEMPLATE_UTXO_TRANSACTIONS: usize = 16;
pub const DEFAULT_BLOCK_RETENTION: usize = 1000;
pub const MAX_REORG_DEPTH: u64 = 500;

// ── Helper functions for V31 compatibility ─────────────────────────────

/// Convert a DifficultyTarget to hex string (V31's v3_compat doesn't have to_hex).
fn difficulty_target_to_hex(target: &DifficultyTarget) -> String {
    hex(&target.bytes)
}

/// Parse a DifficultyTarget from hex string (V31's v3_compat doesn't have from_hex).
fn difficulty_target_from_hex(raw: &str) -> Result<DifficultyTarget, String> {
    Ok(DifficultyTarget {
        bytes: parse_fixed_hex::<32>(raw, "difficulty target")?,
    })
}

/// Hash a block candidate with the canonical Ekam Deeksha v3.2 algorithm.
///
/// Legacy names (`deeksha_lite_v1`, `deeksha_chv3`, `deeksha_lite_fire`,
/// `cosmic_harmony_v3`, `cosmic_harmony_ekam_deeksha_v2`) are accepted as
/// aliases for the canonical algorithm; they all resolve to the same v3.2 hash.
fn hash_candidate_with_algorithm(candidate: BlockCandidate, algorithm: &str) -> [u8; 32] {
    let header_bytes = candidate.header.to_bytes();
    match algorithm {
        "ekam_deeksha"
        | "deeksha_lite_v1"
        | "deeksha_lite"
        | "deeksha_chv3"
        | "deeksha_lite_fire"
        | "cosmic_harmony_v3"
        | "cosmic_harmony_ekam_deeksha_v2" => {
            EkamDeeksha::hash_bytes(&header_bytes, candidate.nonce)
        }
        _ => EkamDeeksha::hash_bytes(&header_bytes, candidate.nonce),
    }
}

/// Parse a PeerEndpoint from an address string (V31's v3_p2p doesn't have parse).
fn parse_peer_endpoint(address: &str) -> Result<PeerEndpoint, String> {
    let (host, port) = address
        .rsplit_once(':')
        .ok_or_else(|| format!("invalid endpoint address: {address}"))?;
    let port = port
        .parse::<u16>()
        .map_err(|_| format!("invalid endpoint port in {address}"))?;
    Ok(PeerEndpoint::new(host, port))
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NodeConfig {
    pub network: NetworkId,
    pub p2p_bind: PeerEndpoint,
    pub rpc_bind: PeerEndpoint,
    pub pool_bind: PeerEndpoint,
    pub websocket_bind: PeerEndpoint,
    pub seed_peers: Vec<PeerEndpoint>,
}

impl NodeConfig {
    pub fn mainnet() -> Self {
        Self {
            network: NetworkId::Mainnet,
            p2p_bind: PeerEndpoint::new("0.0.0.0", 8333),
            rpc_bind: PeerEndpoint::new("0.0.0.0", 8443),
            pool_bind: PeerEndpoint::new("0.0.0.0", 8444),
            websocket_bind: PeerEndpoint::new("0.0.0.0", 8445),
            seed_peers: vec![
                // 3.0.4 canonical mainnet server (public P2P entrypoint).
                // Old Edge (77.42.71.94) decommissioned 2026-07-07 hard reset.
                PeerEndpoint::new("62.171.141.136", 8333),
                // Local fallback for same-machine or LAN bootstrap
                PeerEndpoint::new("127.0.0.1", 8333),
            ],
        }
    }
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ConsensusConfig {
    pub profile: &'static str,
    pub ekam_fork_height: u64,
    pub chv3_fork_height: u64,
    pub fire_fork_height: u64,
    pub fusion_rounds: usize,
    pub default_target: DifficultyTarget,
}

impl Default for ConsensusConfig {
    fn default() -> Self {
        Self {
            profile: EKAM_DEEKSHA_ALGORITHM,
            ekam_fork_height: CHV_EKAM_FORK_HEIGHT,
            chv3_fork_height: CHV3_FORK_HEIGHT,
            fire_fork_height: FIRE_FORK_HEIGHT,
            fusion_rounds: EKAM_FUSION_ROUNDS,
            default_target: DifficultyTarget::MAX,
        }
    }
}

impl ConsensusConfig {
    pub fn profile_for_height(&self, height: u64) -> &'static str {
        profile_name_for_height(height)
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RevenueSnapshot {
    pub total_earnings_usd: f64,
    pub zion_fees_usd: f64,
    pub miner_payout_usd: f64,
    // ZION-denominated fields (flowers).
    pub total_zion: u64,
    pub zion_fees_zion: u64,
    pub humanitarian_zion: u64,
    pub issobella_zion: u64,
    pub miner_payout_zion: u64,
    pub blocks_found: u64,
    // Audit fields.
    pub last_block_height: u64,
    pub last_block_ts: Option<String>,
}

impl From<RevenueStats> for RevenueSnapshot {
    fn from(value: RevenueStats) -> Self {
        Self {
            total_earnings_usd: value.total_earnings_usd,
            zion_fees_usd: value.zion_fees_usd,
            miner_payout_usd: value.miner_payout_usd,
            total_zion: value.total_zion,
            zion_fees_zion: value.zion_fees_zion,
            humanitarian_zion: value.humanitarian_zion,
            issobella_zion: value.issobella_zion,
            miner_payout_zion: value.miner_payout_zion,
            blocks_found: value.blocks_found,
            last_block_height: value.last_block_height,
            last_block_ts: value.last_block_ts,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct NodeStatus {
    pub node_id: String,
    pub network: NetworkId,
    pub protocol_version: String,
    pub consensus_profile: String,
    pub chain_height: u64,
    pub tip_hash_hex: String,
    pub active_template_id: u64,
    pub active_template_height: u64,
    pub accepted_blocks: usize,
    pub mempool_transactions: usize,
    pub active_template_transactions: usize,
    pub active_template_total_fees_zion: u64,
    pub p2p_bind: PeerEndpoint,
    pub rpc_bind: PeerEndpoint,
    pub pool_bind: PeerEndpoint,
    pub known_peers: Vec<PeerEndpoint>,
    pub revenue: RevenueSnapshot,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BlockTemplate {
    pub template_id: u64,
    pub height: u64,
    pub header_hex: String,
    pub target_hex: String,
    pub reward_zion: u64,
    pub transaction_ids: Vec<String>,
    pub transaction_count: usize,
    pub total_fees_zion: u64,
    pub body_hash_hex: String,
    pub estimated_miner_reward_zion: u64,
    pub utxo_transaction_ids: Vec<String>,
    pub utxo_transaction_count: usize,
    pub total_utxo_fees: u64,
}
/// Re-export the shared `u128` serde helper from `zion_l1_types`.
use zion_l1_types::u128_str;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Transaction {
    pub tx_id: String,
    pub from: String,
    pub to: String,
    #[serde(with = "u128_str")]
    pub amount_zion: u128,
    pub fee_zion: u64,
    pub nonce: u64,
    /// Ed25519 signature (hex, 128 chars). Required for non-coinbase transactions.
    #[serde(default)]
    pub signature: String,
    /// Ed25519 public key (hex, 64 chars). Required for non-coinbase transactions.
    #[serde(default)]
    pub public_key: String,
    /// Optional protocol memo (account-model). When present, included in the
    /// signed tx_id preimage. ASCII-only, max 256 bytes. Activated by
    /// `ACCOUNT_TX_MEMO_V1_ACTIVATION_HEIGHT`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub memo: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "model", content = "data", rename_all = "snake_case")]
pub enum SubmittedTransaction {
    Account(Transaction),
    Utxo(tx::Transaction),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum RuntimeTransaction {
    Account(Transaction),
    Utxo(tx::Transaction),
}

impl SubmittedTransaction {
    pub(crate) fn parse_value(value: Value) -> Result<Self, String> {
        if value.is_string() {
            return Err(
                "raw hex transactions are not supported by the current runtime; submit a transaction object"
                    .into(),
            );
        }

        if let Ok(account_tx) = serde_json::from_value::<Transaction>(value.clone()) {
            return Ok(Self::Account(account_tx));
        }

        if let Ok(utxo_tx) = serde_json::from_value::<tx::Transaction>(value) {
            return Ok(Self::Utxo(utxo_tx));
        }

        Err("invalid transaction payload for both account and UTXO models".into())
    }

    pub(crate) fn model(&self) -> &'static str {
        match self {
            Self::Account(_) => "account",
            Self::Utxo(_) => "utxo",
        }
    }

    pub(crate) fn tx_id(&self) -> String {
        match self {
            Self::Account(tx) => tx.tx_id.clone(),
            Self::Utxo(tx) => hex(&tx.id),
        }
    }
}

impl RuntimeTransaction {
    pub(crate) fn tx_id(&self) -> String {
        match self {
            Self::Account(tx) => tx.tx_id.clone(),
            Self::Utxo(tx) => hex(&tx.id),
        }
    }

    pub(crate) fn as_account(&self) -> Option<&Transaction> {
        match self {
            Self::Account(tx) => Some(tx),
            Self::Utxo(_) => None,
        }
    }

    #[cfg(test)]
    pub(crate) fn as_account_mut(&mut self) -> Option<&mut Transaction> {
        match self {
            Self::Account(tx) => Some(tx),
            Self::Utxo(_) => None,
        }
    }

    pub(crate) fn into_account(self) -> Option<Transaction> {
        match self {
            Self::Account(tx) => Some(tx),
            Self::Utxo(_) => None,
        }
    }

    pub(crate) fn as_utxo(&self) -> Option<&tx::Transaction> {
        match self {
            Self::Utxo(tx) => Some(tx),
            Self::Account(_) => None,
        }
    }
}

impl From<Transaction> for RuntimeTransaction {
    fn from(value: Transaction) -> Self {
        Self::Account(value)
    }
}

impl From<tx::Transaction> for RuntimeTransaction {
    fn from(value: tx::Transaction) -> Self {
        Self::Utxo(value)
    }
}
fn default_ekam_deeksha() -> String {
    EKAM_DEEKSHA_ALGORITHM.to_string()
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AcceptedBlock {
    pub template_id: u64,
    pub height: u64,
    pub timestamp: u64,
    pub difficulty: u64,
    pub nonce: u64,
    pub hash_hex: String,
    /// Serialized 80-byte MiningHeader as hex. Enables PoW verification for
    /// peer-imported blocks.  Empty for legacy persisted blocks (pre-Phase 12).
    #[serde(default)]
    pub header_hex: String,
    /// Hash of the parent block (hex). Enables chain-linkage verification.
    /// Empty for legacy persisted blocks (pre-Phase 13). All-zeros hex for genesis.
    #[serde(default)]
    pub previous_hash_hex: String,
    /// Mining algorithm used for this block (e.g. "ekam_deeksha").
    #[serde(default = "default_ekam_deeksha")]
    pub algorithm: String,
    pub transaction_ids: Vec<String>,
    pub transactions: Vec<Transaction>,
    pub total_fees_zion: u64,
    pub body_hash_hex: String,
    pub subsidy_zion: u64,
    pub miner_reward_zion: u64,
    /// Address credited by the coinbase transaction. Empty for legacy blocks
    /// (pre-Phase 14) and for blocks mined without a configured miner address.
    #[serde(default)]
    pub miner_address: String,
    /// Humanitarian fund address (5% coinbase). Empty for legacy/single-output blocks.
    #[serde(default)]
    pub humanitarian_address: String,
    /// Issobella fund address (5% coinbase). Empty for legacy/single-output blocks.
    #[serde(default)]
    pub issobella_address: String,
    /// Pool fee address (1% coinbase). Empty for legacy/single-output blocks.
    #[serde(default)]
    pub pool_fee_address: String,
    /// UTXO transaction IDs included in this block (Phase 16). Empty for
    /// account-only blocks or legacy blocks.
    #[serde(default)]
    pub utxo_transaction_ids: Vec<String>,
    /// Full UTXO transactions included in this block.
    #[serde(default)]
    pub utxo_transactions: Vec<tx::Transaction>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum P2pMessage {
    Hello {
        node_id: String,
        protocol_version: String,
        network: NetworkId,
        listen_addr: String,
    },
    Welcome {
        node_id: String,
        protocol_version: String,
        profile: String,
        peers: Vec<PeerEndpoint>,
    },
    Ping {
        nonce: u64,
    },
    Pong {
        nonce: u64,
    },
    GetPeers,
    Peers {
        peers: Vec<PeerEndpoint>,
    },
    GetStatus,
    Status {
        status: NodeStatus,
    },
    GetBlocksSince {
        from_height: u64,
        limit: u16,
    },
    Blocks {
        blocks: Vec<AcceptedBlock>,
    },
    AnnounceBlock {
        block: AcceptedBlock,
    },
    AnnounceTx {
        tx_id: String,
        transaction: SubmittedTransaction,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "method", rename_all = "snake_case")]
pub enum RpcRequest {
    GetStatus,
    GetPeers,
    GetRevenue,
    GetMempool,
    GetTemplate,
    SubmitTransaction {
        transaction: Transaction,
    },
    SubmitCandidate {
        template_id: u64,
        header_hex: String,
        nonce: u64,
        target_hex: String,
        algorithm: String,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum RpcResponse {
    Status {
        status: NodeStatus,
    },
    Peers {
        peers: Vec<PeerEndpoint>,
    },
    Revenue {
        revenue: RevenueSnapshot,
    },
    Mempool {
        transactions: Vec<Transaction>,
    },
    Template {
        template: BlockTemplate,
    },
    TransactionResult {
        accepted: bool,
        tx_id: String,
        reason: Option<String>,
    },
    SubmitResult {
        accepted: bool,
        template_id: u64,
        block_height: Option<u64>,
        hash_hex: String,
        reason: Option<String>,
    },
}
pub struct CoreRuntime {
    consensus: ConsensusConfig,
    revenue: RevenueCollector,
}

pub struct NodeRuntime {
    node_id: String,
    config: NodeConfig,
    core: CoreRuntime,
    known_peers: Vec<PeerEndpoint>,
    chain_state: ChainState,
    chain_store: Option<ChainStore>,
    miner_address: String,
    humanitarian_address: String,
    issobella_address: String,
    pool_fee_address: String,
    ws_notifier: Option<std::sync::Arc<crate::websocket::WebSocketServer>>,
}

impl Default for CoreRuntime {
    fn default() -> Self {
        Self::new(ConsensusConfig::default())
    }
}

impl CoreRuntime {
    pub fn new(consensus: ConsensusConfig) -> Self {
        Self {
            consensus,
            revenue: RevenueCollector::new(),
        }
    }

    /// Create a CoreRuntime with an env-configured RevenueJournal and replay
    /// all persisted events so the revenue collector resumes from where it
    /// left off after a restart.
    pub fn new_with_journal_replay(consensus: ConsensusConfig) -> Self {
        let collector = RevenueCollector::with_env_journal();
        collector.replay();
        Self {
            consensus,
            revenue: collector,
        }
    }

    pub fn consensus(&self) -> &ConsensusConfig {
        &self.consensus
    }

    pub fn consensus_profile(&self) -> &'static str {
        self.consensus.profile
    }

    pub fn consensus_profile_for_height(&self, height: u64) -> &'static str {
        self.consensus.profile_for_height(height)
    }

    pub fn hash_candidate(&self, candidate: BlockCandidate) -> [u8; 32] {
        candidate.hash()
    }

    pub fn hash_candidate_with_algorithm(
        &self,
        candidate: BlockCandidate,
        algorithm: &str,
    ) -> [u8; 32] {
        hash_candidate_with_algorithm(candidate, algorithm)
    }

    pub fn validate_candidate(
        &self,
        candidate: BlockCandidate,
        target: DifficultyTarget,
    ) -> Option<SealedBlock> {
        let sealed = candidate.seal();
        if target.allows(&sealed.hash) {
            Some(sealed)
        } else {
            None
        }
    }

    pub fn validate_candidate_with_algorithm(
        &self,
        candidate: BlockCandidate,
        target: DifficultyTarget,
        algorithm: &str,
    ) -> Option<SealedBlock> {
        let hash = hash_candidate_with_algorithm(candidate, algorithm);
        if target.allows(&hash) {
            Some(SealedBlock {
                header: candidate.header,
                nonce: candidate.nonce,
                hash,
            })
        } else {
            None
        }
    }

    pub fn validate_candidate_for_height(
        &self,
        candidate: BlockCandidate,
        target: DifficultyTarget,
        height: u64,
    ) -> Option<SealedBlock> {
        let algorithm = self.consensus_profile_for_height(height);
        self.validate_candidate_with_algorithm(candidate, target, algorithm)
    }

    pub fn scan_nonce_range(&self, job: MiningJob) -> Option<MiningSolution> {
        for offset in 0..job.nonce_count {
            let candidate = BlockCandidate {
                header: job.header,
                nonce: job.start_nonce.wrapping_add(offset),
                height: job.height,
            };
            let hash = self.hash_candidate(candidate);
            if job.target.allows(&hash) {
                return Some(MiningSolution {
                    job_id: job.job_id,
                    candidate,
                    hash,
                });
            }
        }
        None
    }

    pub fn validate_solution(
        &self,
        job: MiningJob,
        solution: MiningSolution,
    ) -> Option<SealedBlock> {
        if solution.job_id != job.job_id || solution.candidate.header != job.header {
            return None;
        }

        let sealed = self.validate_candidate(solution.candidate, job.target)?;
        if sealed.hash == solution.hash {
            Some(sealed)
        } else {
            None
        }
    }

    pub fn record_revenue(&self, source: RevenueSource, value_usd: f64, qualifies: bool) {
        self.revenue
            .track_event(RevenueEvent::new(source, value_usd, qualifies));
    }

    /// Record revenue from an external pool (e.g. 2miners, NiceHash).
    /// `external_coin` is the ticker of the mined coin (e.g. "DCR", "KAS", "ETC").
    /// This is used for multi-algo revenue tracking with BTC payout.
    pub fn record_external_revenue(
        &self,
        source: RevenueSource,
        value_usd: f64,
        external_coin: Option<&str>,
    ) {
        let mut event = RevenueEvent::new(source, value_usd, true);
        if let Some(coin) = external_coin {
            event = event.with_external_coin(coin);
        }
        self.revenue.track_event(event);
    }

    /// Record a canonical ZION Deeksha block reward in the revenue collector.
    /// `tx_hash` may be `None` if the on-chain tx hash is not yet known.
    pub fn record_zion_block_revenue(
        &self,
        height: u64,
        subsidy: u64,
        pool_fee_pct: u64,
        tx_hash: Option<String>,
    ) {
        self.revenue
            .track_zion_block(height, subsidy, pool_fee_pct, tx_hash);
    }

    pub fn revenue_snapshot(&self) -> RevenueSnapshot {
        self.revenue.get_stats().into()
    }

    /// Record a Neural Compute Layer (NCL) inference task that produced
    /// revenue.  `value_usd` is the gross customer payment for the task;
    /// the standard NCL fee rate (`NCL_FEE = 10 %`) is applied internally.
    /// Set `success = false` to record a failed task — this still bumps
    /// the failure counter (and trips the circuit breaker after enough
    /// consecutive failures) but contributes zero revenue.
    pub fn record_ncl_task_revenue(
        &self,
        value_usd: f64,
        tokens_in: u64,
        tokens_out: u64,
        latency_ms: u64,
        success: bool,
    ) {
        self.revenue
            .track_ncl_task_detailed(value_usd, tokens_in, tokens_out, latency_ms, success);
    }

    /// Snapshot of the NCL task / token / latency telemetry counters.
    pub fn ncl_stats(&self) -> NclStats {
        self.revenue.ncl_stats()
    }

    /// Clone of the underlying revenue collector handle.  Inexpensive
    /// (`RevenueCollector` is `Arc`-internal) and intended for async
    /// subsystems — e.g. the pool's NCL gateway dispatcher — that need
    /// to push events into the same accounting state as the main
    /// `CoreRuntime` without coupling to its full lifecycle.
    pub fn revenue_handle(&self) -> RevenueCollector {
        self.revenue.clone()
    }
}

pub fn consensus_profile() -> &'static str {
    EKAM_DEEKSHA_ALGORITHM
}

/// Height-aware canonical profile name.
///
/// V31 uses `ekam_deeksha` for all heights.
pub fn consensus_profile_for_height(_height: u64) -> &'static str {
    EKAM_DEEKSHA_ALGORITHM
}

pub fn node_protocol_version() -> &'static str {
    NODE_PROTOCOL_VERSION
}

pub fn encode_p2p_message(message: &P2pMessage) -> Result<String, serde_json::Error> {
    encode_json_line(message)
}

pub fn decode_p2p_message(line: &str) -> Result<P2pMessage, serde_json::Error> {
    serde_json::from_str(line.trim())
}

pub fn encode_rpc_request(message: &RpcRequest) -> Result<String, serde_json::Error> {
    encode_json_line(message)
}

pub fn decode_rpc_request(line: &str) -> Result<RpcRequest, serde_json::Error> {
    serde_json::from_str(line.trim())
}

pub fn encode_rpc_response(message: &RpcResponse) -> Result<String, serde_json::Error> {
    encode_json_line(message)
}

pub fn decode_rpc_response(line: &str) -> Result<RpcResponse, serde_json::Error> {
    serde_json::from_str(line.trim())
}
impl NodeRuntime {
    pub(crate) fn uses_strict_mainnet_seed_peers(&self) -> bool {
        self.config.network == NetworkId::Mainnet && !self.config.seed_peers.is_empty()
    }

    pub(crate) fn is_allowed_peer(&self, peer: &PeerEndpoint) -> bool {
        if !self.uses_strict_mainnet_seed_peers() {
            return true;
        }

        self.config
            .seed_peers
            .iter()
            .any(|allowed| allowed.address().eq_ignore_ascii_case(&peer.address()))
    }

    pub(crate) fn prune_known_peers(&mut self) {
        if !self.uses_strict_mainnet_seed_peers() {
            return;
        }

        self.known_peers = dedup_peers(
            self.known_peers
                .iter()
                .filter(|peer| self.is_allowed_peer(peer))
                .cloned()
                .collect(),
        );
    }

    pub fn new(node_id: impl Into<String>, config: NodeConfig) -> Self {
        let node_id = node_id.into();
        let known_peers = dedup_peers(config.seed_peers.clone());
        let core = CoreRuntime::default();
        let chain_state = ChainState::new(&node_id, &core);
        Self {
            node_id,
            config,
            core,
            known_peers,
            chain_state,
            chain_store: None,
            miner_address: String::new(),
            humanitarian_address: String::new(),
            issobella_address: String::new(),
            pool_fee_address: String::new(),
            ws_notifier: None,
        }
    }

    /// Set the in-memory block retention window.
    /// 0 = unlimited (default), N = keep only last N blocks in memory.
    /// Old blocks are pruned from RAM but remain in LMDB persistent storage.
    pub fn set_block_retention(&mut self, retention: usize) {
        self.chain_state.block_retention = retention;
        // Immediately prune if we're already over the limit
        self.chain_state.prune_old_blocks();
    }

    pub fn with_websocket_notifier(
        node_id: impl Into<String>,
        config: NodeConfig,
        ws_notifier: std::sync::Arc<crate::websocket::WebSocketServer>,
    ) -> Self {
        let node_id = node_id.into();
        let known_peers = dedup_peers(config.seed_peers.clone());
        let core = CoreRuntime::default();
        let chain_state = ChainState::new(&node_id, &core);
        Self {
            node_id,
            config,
            core,
            known_peers,
            chain_state,
            chain_store: None,
            miner_address: String::new(),
            humanitarian_address: String::new(),
            issobella_address: String::new(),
            pool_fee_address: String::new(),
            ws_notifier: Some(ws_notifier),
        }
    }

    pub fn with_chain_store(
        node_id: impl Into<String>,
        config: NodeConfig,
        state_path: impl Into<PathBuf>,
    ) -> Result<Self, String> {
        let node_id = node_id.into();
        let known_peers = dedup_peers(config.seed_peers.clone());
        let core = CoreRuntime::default();
        let chain_store = ChainStore {
            path: state_path.into(),
        };
        let snapshot = match chain_store.load_snapshot() {
            Ok(snapshot) => snapshot,
            Err(error) => {
                if chain_store.journal_exists() {
                    eprintln!("node_state_snapshot_recovery_fallback={error}");
                    None
                } else {
                    return Err(error);
                }
            }
        };
        let mut chain_state = match snapshot {
            Some(snapshot) => ChainState::from_snapshot(&node_id, &core, snapshot)?,
            None => ChainState::new(&node_id, &core),
        };
        chain_store.replay_journal(&node_id, &core, &mut chain_state)?;

        let mut runtime = Self {
            node_id,
            config,
            core,
            known_peers,
            chain_state,
            chain_store: Some(chain_store),
            miner_address: String::new(),
            humanitarian_address: String::new(),
            issobella_address: String::new(),
            pool_fee_address: String::new(),
            ws_notifier: None,
        };
        runtime.persist_chain_state()?;
        runtime.load_persisted_peers();
        Ok(runtime)
    }

    pub fn with_chain_store_and_websocket_notifier(
        node_id: impl Into<String>,
        config: NodeConfig,
        state_path: impl Into<PathBuf>,
        ws_notifier: std::sync::Arc<crate::websocket::WebSocketServer>,
    ) -> Result<Self, String> {
        let node_id = node_id.into();
        let known_peers = dedup_peers(config.seed_peers.clone());
        let core = CoreRuntime::default();
        let chain_store = ChainStore {
            path: state_path.into(),
        };
        let snapshot = match chain_store.load_snapshot() {
            Ok(snapshot) => snapshot,
            Err(error) => {
                if chain_store.journal_exists() {
                    eprintln!("node_state_snapshot_recovery_fallback={error}");
                    None
                } else {
                    return Err(error);
                }
            }
        };
        let mut chain_state = match snapshot {
            Some(snapshot) => ChainState::from_snapshot(&node_id, &core, snapshot)?,
            None => ChainState::new(&node_id, &core),
        };
        chain_store.replay_journal(&node_id, &core, &mut chain_state)?;

        let mut runtime = Self {
            node_id,
            config,
            core,
            known_peers,
            chain_state,
            chain_store: Some(chain_store),
            miner_address: String::new(),
            humanitarian_address: String::new(),
            issobella_address: String::new(),
            pool_fee_address: String::new(),
            ws_notifier: Some(ws_notifier),
        };
        runtime.persist_chain_state()?;
        runtime.load_persisted_peers();
        Ok(runtime)
    }

    /// Set the wallet id that receives coinbase rewards for mined blocks.
    /// When set, every new block template will include a coinbase transaction
    /// crediting the block subsidy to this wallet id.
    pub fn set_miner_address(&mut self, addr: String) {
        self.miner_address = addr.clone();
        self.chain_state.miner_address = addr;
        self.rebuild_active_template();
    }

    /// Set the per-instance F5 balance-check activation height for the
    /// underlying chain state. Use 0 to enable from genesis, or `u64::MAX`
    /// to disable (default).
    pub fn set_balance_check_height(&mut self, height: u64) {
        self.chain_state.balance_check_height = height;
    }

    /// Set the per-instance F4.7 max-tx-amount cap activation height for the
    /// underlying chain state. Use 0 to enable from genesis, or `u64::MAX`
    /// to disable (default).
    pub fn set_max_tx_amount_height(&mut self, height: u64) {
        self.chain_state.max_tx_amount_height = height;
    }

    /// Set the WebSocket notifier for real-time event broadcasting.
    pub fn set_websocket_notifier(
        &mut self,
        ws_notifier: std::sync::Arc<crate::websocket::WebSocketServer>,
    ) {
        self.ws_notifier = Some(ws_notifier);
    }

    /// Set the fee split destination addresses.
    /// When set, coinbase is split: 89% miner, 5% humanitarian, 5% issobella, 1% pool fee.
    pub fn set_fee_addresses(&mut self, humanitarian: String, issobella: String, pool_fee: String) {
        self.humanitarian_address = humanitarian.clone();
        self.issobella_address = issobella.clone();
        self.pool_fee_address = pool_fee.clone();
        self.chain_state.humanitarian_address = humanitarian;
        self.chain_state.issobella_address = issobella;
        self.chain_state.pool_fee_address = pool_fee;
        self.rebuild_active_template();
    }

    pub(crate) fn rebuild_active_template(&mut self) {
        let next_id = self.chain_state.next_template_id.saturating_sub(1);
        self.chain_state.active_template = ChainState::build_template(
            &self.node_id,
            &self.core,
            self.chain_state.height,
            self.chain_state.tip_hash,
            next_id,
            &self.chain_state.mempool,
            &self.chain_state.accepted_blocks,
            &self.chain_state.miner_address,
            &self.chain_state.humanitarian_address,
            &self.chain_state.issobella_address,
            &self.chain_state.pool_fee_address,
            self.chain_state.balance_check_height,
        );
    }

    pub fn miner_address(&self) -> &str {
        &self.miner_address
    }

    pub fn config(&self) -> &NodeConfig {
        &self.config
    }

    pub fn node_id(&self) -> &str {
        &self.node_id
    }

    pub fn known_peers(&self) -> &[PeerEndpoint] {
        &self.known_peers
    }

    pub fn register_peer(&mut self, peer: PeerEndpoint) {
        if peer.address() == self.config.p2p_bind.address() {
            return;
        }
        if !self.is_allowed_peer(&peer) {
            return;
        }
        if self
            .known_peers
            .iter()
            .all(|known| known.address() != peer.address())
        {
            self.known_peers.push(peer);
            // Cap known_peers to prevent unbounded growth from peer announcements
            if self.known_peers.len() > 500 {
                self.known_peers.drain(0..self.known_peers.len() - 500);
            }
        }
    }

    pub fn register_peers(&mut self, peers: impl IntoIterator<Item = PeerEndpoint>) {
        for peer in peers {
            self.register_peer(peer);
        }
    }

    // ── Peer persistence (Phase 11) ────────────────────────────────────

    /// Return the path for persisting known peers (sibling of chain state file).
    pub(crate) fn peers_path(&self) -> Option<PathBuf> {
        self.chain_store.as_ref().map(|cs| {
            let mut p = cs.path.clone();
            p.set_file_name("peers.json");
            p
        })
    }

    /// Save known_peers to disk as JSON. No-op if no state_path configured.
    pub fn persist_peers(&self) -> Result<(), String> {
        let path = match self.peers_path() {
            Some(p) => p,
            None => return Ok(()),
        };
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("peers mkdir: {e}"))?;
        }
        let json = serde_json::to_string_pretty(&self.known_peers)
            .map_err(|e| format!("peers encode: {e}"))?;
        fs::write(&path, json.as_bytes()).map_err(|e| format!("peers write: {e}"))?;
        Ok(())
    }

    /// Load persisted peers from disk and merge into known_peers.
    /// Called once at startup after `with_chain_store`.
    pub fn load_persisted_peers(&mut self) {
        let path = match self.peers_path() {
            Some(p) => p,
            None => return,
        };
        let raw = match fs::read_to_string(&path) {
            Ok(r) => r,
            Err(_) => return, // no file yet — first run
        };
        let peers: Vec<PeerEndpoint> = match serde_json::from_str(&raw) {
            Ok(p) => p,
            Err(e) => {
                eprintln!("peers_load_err path={} err={e}", path.display());
                return;
            }
        };
        let count = peers.len();
        self.register_peers(peers);
        self.prune_known_peers();
        println!(
            "peers_loaded count={count} total={}",
            self.known_peers.len()
        );
    }

    /// Number of known peers (for diagnostics).
    pub fn peer_count(&self) -> usize {
        self.known_peers.len()
    }

    pub fn status(&self) -> NodeStatus {
        NodeStatus {
            node_id: self.node_id.clone(),
            network: self.config.network,
            protocol_version: node_protocol_version().to_string(),
            consensus_profile: self
                .core
                .consensus_profile_for_height(self.chain_state.height)
                .to_string(),
            chain_height: self.chain_state.height,
            tip_hash_hex: hex(&self.chain_state.tip_hash),
            active_template_id: self.chain_state.active_template.template_id,
            active_template_height: self.chain_state.active_template.height,
            accepted_blocks: self.chain_state.accepted_blocks.len(),
            mempool_transactions: self.chain_state.mempool.len(),
            active_template_transactions: self.chain_state.active_template.transactions.len(),
            active_template_total_fees_zion: self.chain_state.active_template.total_fees_zion,
            p2p_bind: self.config.p2p_bind.clone(),
            rpc_bind: self.config.rpc_bind.clone(),
            pool_bind: self.config.pool_bind.clone(),
            known_peers: self.known_peers.clone(),
            revenue: self.core.revenue_snapshot(),
        }
    }

    pub fn active_template(&self) -> BlockTemplate {
        self.chain_state.active_template.as_public()
    }

    pub fn accepted_blocks(&self) -> &[AcceptedBlock] {
        &self.chain_state.accepted_blocks
    }

    /// Returns indices of blocks that contain transactions for the given address.
    /// Uses the in-memory address_tx_index for O(1) lookup instead of scanning
    /// all blocks. Returns an empty vec if the address has no transactions.
    pub fn block_indices_for_address(&self, address: &str) -> Vec<usize> {
        self.chain_state
            .block_indices_for_address(address)
            .cloned()
            .unwrap_or_default()
    }

    pub fn accepted_blocks_since(&self, from_height: u64, limit: usize) -> Vec<AcceptedBlock> {
        self.chain_state
            .accepted_blocks
            .iter()
            .filter(|block| block.height > from_height)
            .take(limit)
            .cloned()
            .collect()
    }

    pub fn accepted_block_by_height(&self, height: u64) -> Option<&AcceptedBlock> {
        self.chain_state.accepted_by_height.get(&height)
    }

    pub fn accepted_block_by_template_id(&self, template_id: u64) -> Option<&AcceptedBlock> {
        self.chain_state.accepted_by_template_id.get(&template_id)
    }

    pub fn chain_height(&self) -> u64 {
        self.chain_state.height
    }

    pub fn utxo_balance(&self, address: &str) -> u128 {
        self.chain_state.utxo_balance(address)
    }

    pub fn spendable_utxos(&self, address: &str) -> Vec<SpendableUtxo> {
        self.chain_state.spendable_utxos(address)
    }

    pub fn needs_blocks_from(&self, peer_height: u64) -> bool {
        peer_height > self.chain_state.height
    }

    /// Return the current tip hash as hex string.
    pub fn tip_hash_hex(&self) -> String {
        hex(&self.chain_state.tip_hash)
    }

    /// Wipe chain state back to genesis and persist the clean slate.
    /// Used for fork recovery when the local chain has diverged beyond
    /// MAX_REORG_DEPTH and automatic reorg is impossible.
    pub fn reset_to_genesis(&mut self) -> Result<(), String> {
        eprintln!(
            "fork_recovery_reset height={} tip={}",
            self.chain_state.height,
            hex(&self.chain_state.tip_hash),
        );
        self.chain_state = ChainState::new(&self.node_id, &self.core);
        // Restore wallet addresses so post-IBD mining works
        self.chain_state.miner_address = self.miner_address.clone();
        self.chain_state.humanitarian_address = self.humanitarian_address.clone();
        self.chain_state.issobella_address = self.issobella_address.clone();
        self.chain_state.pool_fee_address = self.pool_fee_address.clone();
        self.persist_chain_state()?;
        if let Some(ref chain_store) = self.chain_store {
            chain_store.clear_journal()?;
        }
        eprintln!("fork_recovery_reset_complete new_height=0");
        Ok(())
    }

    pub fn persist_chain_state(&self) -> Result<(), String> {
        match &self.chain_store {
            Some(chain_store) => chain_store.save_snapshot(&self.chain_state.snapshot())?,
            None => return Ok(()),
        }
        if let Some(chain_store) = &self.chain_store {
            chain_store.clear_journal()?;
        }
        Ok(())
    }

    pub(crate) fn persist_chain_update(&self, entry: &ChainJournalEntry) -> Result<(), String> {
        match &self.chain_store {
            Some(chain_store) => {
                chain_store.append_journal_entry(entry)?;
                chain_store.save_snapshot(&self.chain_state.snapshot())?;
                chain_store.clear_journal()
            }
            None => Ok(()),
        }
    }

    pub fn p2p_hello(&self) -> P2pMessage {
        P2pMessage::Hello {
            node_id: self.node_id.clone(),
            protocol_version: node_protocol_version().to_string(),
            network: self.config.network,
            listen_addr: self.config.p2p_bind.address(),
        }
    }

    pub fn handle_p2p_message(&mut self, message: P2pMessage) -> Result<P2pMessage, String> {
        match message {
            P2pMessage::Hello {
                network,
                listen_addr,
                ..
            } => {
                if network != self.config.network {
                    return Err(format!(
                        "network mismatch: expected {:?}, got {:?}",
                        self.config.network, network
                    ));
                }
                self.register_peer(parse_peer_endpoint(&listen_addr)?);
                Ok(P2pMessage::Welcome {
                    node_id: self.node_id.clone(),
                    protocol_version: node_protocol_version().to_string(),
                    profile: self
                        .core
                        .consensus_profile_for_height(self.chain_state.height)
                        .to_string(),
                    peers: self.known_peers.clone(),
                })
            }
            P2pMessage::Ping { nonce } => Ok(P2pMessage::Pong { nonce }),
            P2pMessage::GetPeers => Ok(P2pMessage::Peers {
                peers: self.known_peers.clone(),
            }),
            P2pMessage::GetStatus => Ok(P2pMessage::Status {
                status: self.status(),
            }),
            P2pMessage::GetBlocksSince { from_height, limit } => Ok(P2pMessage::Blocks {
                blocks: self.accepted_blocks_since(from_height, limit.max(1) as usize),
            }),
            P2pMessage::AnnounceBlock { block } => {
                let _newly_accepted = self.import_peer_block(block)?;
                Ok(P2pMessage::Status {
                    status: self.status(),
                })
            }
            P2pMessage::AnnounceTx { tx_id, transaction } => {
                let response = self.submit_submitted_transaction(transaction);
                match &response {
                    RpcResponse::TransactionResult { accepted, .. } if *accepted => {
                        Ok(P2pMessage::Status {
                            status: self.status(),
                        })
                    }
                    RpcResponse::TransactionResult { reason, .. } => Err(format!(
                        "tx {} rejected: {}",
                        tx_id,
                        reason.as_deref().unwrap_or("unknown")
                    )),
                    _ => Err("unexpected response from submit_submitted_transaction".into()),
                }
            }
            other => Err(format!("unsupported inbound p2p message: {other:?}")),
        }
    }

    /// Handle an `AnnounceBlock` from a peer. Returns the newly accepted
    /// block if it was new (for relay), or `None` if it was a duplicate.
    /// The caller is responsible for relaying to other peers.
    pub fn handle_announce_block(
        &mut self,
        block: AcceptedBlock,
    ) -> Result<Option<AcceptedBlock>, String> {
        self.import_peer_block(block)
    }

    /// Handle an `AnnounceTx` from a peer. Returns `true` if the
    /// transaction was accepted into the mempool (and should be relayed).
    pub fn handle_announce_tx(&mut self, _tx_id: &str, transaction: SubmittedTransaction) -> bool {
        let response = self.submit_submitted_transaction(transaction);
        matches!(&response, RpcResponse::TransactionResult { accepted, .. } if *accepted)
    }

    /// Return the last accepted block, if any. Useful after RPC
    /// `submit_candidate` to relay the newly mined block.
    pub fn last_accepted_block(&self) -> Option<&AcceptedBlock> {
        self.chain_state.accepted_blocks.last()
    }

    /// Import a single peer block. Returns `Ok(Some(block))` if the block
    /// was newly accepted (and should be relayed), `Ok(None)` if it was a
    /// duplicate, or `Err` on validation failure.
    pub(crate) fn import_peer_block(
        &mut self,
        block: AcceptedBlock,
    ) -> Result<Option<AcceptedBlock>, String> {
        let height_before = self.chain_state.height;
        self.chain_state
            .import_peer_block(&self.node_id, &self.core, block)?;
        self.persist_chain_state()?;
        if self.chain_state.height > height_before {
            let accepted_block = self.chain_state.accepted_blocks.last().cloned();

            // Notify WebSocket subscribers about new block
            if let (Some(ws_notifier), Some(block)) = (&self.ws_notifier, &accepted_block) {
                // TODO: needs V3 websocket method: ws_notifier.notify_new_block(block);
            }

            Ok(accepted_block)
        } else {
            Ok(None)
        }
    }

    pub fn import_peer_blocks(&mut self, blocks: Vec<AcceptedBlock>) -> Result<usize, String> {
        let imported = self
            .chain_state
            .import_peer_blocks(&self.node_id, &self.core, blocks)?;
        if imported > 0 {
            self.persist_chain_state()?;

            // Notify WebSocket subscribers about newly accepted blocks
            if let Some(ws_notifier) = &self.ws_notifier {
                for block in self.chain_state.accepted_blocks.iter().rev().take(imported) {
                    // TODO: needs V3 websocket method: ws_notifier.notify_new_block(block);
                }
            }
        }
        Ok(imported)
    }

    pub fn handle_rpc_request(&mut self, request: RpcRequest) -> RpcResponse {
        match request {
            RpcRequest::GetStatus => RpcResponse::Status {
                status: self.status(),
            },
            RpcRequest::GetPeers => RpcResponse::Peers {
                peers: self.known_peers.clone(),
            },
            RpcRequest::GetRevenue => RpcResponse::Revenue {
                revenue: self.core.revenue_snapshot(),
            },
            RpcRequest::GetMempool => RpcResponse::Mempool {
                transactions: self.chain_state.account_mempool_transactions(),
            },
            RpcRequest::GetTemplate => RpcResponse::Template {
                template: self.active_template(),
            },
            RpcRequest::SubmitTransaction { transaction } => {
                self.submit_submitted_transaction(SubmittedTransaction::Account(transaction))
            }
            RpcRequest::SubmitCandidate {
                template_id,
                header_hex,
                nonce,
                target_hex,
                algorithm,
            } => {
                self.submit_candidate_rpc(template_id, &header_hex, nonce, &target_hex, &algorithm)
            }
        }
    }

    pub fn submit_submitted_transaction(
        &mut self,
        transaction: SubmittedTransaction,
    ) -> RpcResponse {
        match transaction {
            SubmittedTransaction::Account(transaction) => self.submit_transaction_rpc(transaction),
            SubmittedTransaction::Utxo(transaction) => {
                self.submit_utxo_transaction_rpc(transaction)
            }
        }
    }

    pub(crate) fn submit_utxo_transaction_rpc(
        &mut self,
        transaction: tx::Transaction,
    ) -> RpcResponse {
        let tx_id = hex(&transaction.id);
        match self
            .chain_state
            .insert_utxo_transaction(&self.node_id, &self.core, transaction)
        {
            Ok(()) => {
                // The transaction was accepted into the mempool, so it
                // *should* be present in mempool_by_id. If it isn't (e.g.
                // a future state-machine bug, or an in-flight eviction),
                // log the inconsistency and skip journaling rather than
                // panicking — the tx is already accepted, the caller
                // deserves a successful response. (Audit finding F5.)
                match self.chain_state.mempool_by_id.get(&tx_id).cloned() {
                    Some(transaction) => {
                        if let Err(error) =
                            self.persist_chain_update(&ChainJournalEntry::TransactionAccepted {
                                transaction: transaction.clone(),
                            })
                        {
                            eprintln!("node_state_persist_error={error}");
                        }

                        // Notify WebSocket subscribers about pending transaction
                        if let Some(ws_notifier) = &self.ws_notifier {
                            // TODO: needs V3 websocket method: ws_notifier.notify_pending_transaction(&transaction);
                        }
                    }
                    None => {
                        eprintln!(
                            "node_state_persist_skipped: accepted UTXO transaction {tx_id} \
                             missing from mempool_by_id index"
                        );
                    }
                }
                RpcResponse::TransactionResult {
                    accepted: true,
                    tx_id,
                    reason: None,
                }
            }
            Err(reason) => RpcResponse::TransactionResult {
                accepted: false,
                tx_id,
                reason: Some(reason),
            },
        }
    }

    pub fn submit_bridge_unlock(
        &mut self,
        request: BridgeUnlockRequest,
        proofs: Vec<BridgeValidatorProof>,
    ) -> RpcResponse {
        match self
            .chain_state
            .build_bridge_unlock_transaction(&request, &proofs)
        {
            Ok(transaction) => self.submit_utxo_transaction_rpc(transaction),
            Err(reason) => RpcResponse::TransactionResult {
                accepted: false,
                tx_id: String::new(),
                reason: Some(reason),
            },
        }
    }

    pub(crate) fn submit_candidate_rpc(
        &mut self,
        template_id: u64,
        header_hex: &str,
        nonce: u64,
        target_hex: &str,
        algorithm: &str,
    ) -> RpcResponse {
        let header = match parse_fixed_hex::<HEADER_SIZE>(header_hex, "rpc header") {
            Ok(bytes) => MiningHeader::from_bytes(bytes),
            Err(reason) => {
                return RpcResponse::SubmitResult {
                    accepted: false,
                    template_id,
                    block_height: None,
                    hash_hex: String::new(),
                    reason: Some(reason),
                }
            }
        };

        let target = match difficulty_target_from_hex(target_hex) {
            Ok(target) => target,
            Err(reason) => {
                return RpcResponse::SubmitResult {
                    accepted: false,
                    template_id,
                    block_height: None,
                    hash_hex: String::new(),
                    reason: Some(reason),
                }
            }
        };

        let active_template = &self.chain_state.active_template;
        if template_id != active_template.template_id {
            return RpcResponse::SubmitResult {
                accepted: false,
                template_id,
                block_height: None,
                hash_hex: String::new(),
                reason: Some(format!(
                    "stale template: expected {}, got {}",
                    active_template.template_id, template_id
                )),
            };
        }

        if header != active_template.header {
            return RpcResponse::SubmitResult {
                accepted: false,
                template_id,
                block_height: None,
                hash_hex: String::new(),
                reason: Some("candidate header does not match active template".to_string()),
            };
        }

        if target != active_template.target {
            return RpcResponse::SubmitResult {
                accepted: false,
                template_id,
                block_height: None,
                hash_hex: String::new(),
                reason: Some("candidate target does not match active template".to_string()),
            };
        }

        let candidate = BlockCandidate {
            header,
            nonce,
            height: active_template.height,
        };
        let hash = self
            .core
            .hash_candidate_with_algorithm(candidate, algorithm);
        let sealed = self
            .core
            .validate_candidate_with_algorithm(candidate, target, algorithm);
        let accepted = sealed.is_some();

        if let Some(sealed_block) = sealed {
            let template_transactions = active_template.account_transactions();
            let template_utxo_transactions = active_template.utxo_transactions();
            let miner_reward_zion = template_transactions
                .first()
                .filter(|transaction| transaction.from == "coinbase")
                .map(|transaction| transaction.amount_zion)
                .map(|amount| u64::try_from(amount).unwrap_or(active_template.reward_zion))
                .unwrap_or(active_template.reward_zion);
            let accepted_block = AcceptedBlock {
                template_id,
                height: active_template.height,
                timestamp: active_template.header.timestamp,
                difficulty: active_template.difficulty,
                nonce: sealed_block.nonce,
                hash_hex: hex(&sealed_block.hash),
                header_hex: hex(&active_template.header.to_bytes()),
                previous_hash_hex: hex(&active_template.header.previous_hash),
                algorithm: algorithm.to_string(),
                transaction_ids: active_template
                    .account_transactions()
                    .iter()
                    .map(|transaction| transaction.tx_id.clone())
                    .collect(),
                transactions: template_transactions.clone(),
                total_fees_zion: active_template.total_fees_zion,
                body_hash_hex: body_hash_hex(&template_transactions),
                subsidy_zion: active_template.reward_zion,
                miner_reward_zion,
                miner_address: self.miner_address.clone(),
                humanitarian_address: self.humanitarian_address.clone(),
                issobella_address: self.issobella_address.clone(),
                pool_fee_address: self.pool_fee_address.clone(),
                utxo_transaction_ids: template_utxo_transactions
                    .iter()
                    .map(|tx| hex(&tx.id))
                    .collect(),
                utxo_transactions: template_utxo_transactions,
            };
            if let Err(reason) = self.chain_state.accept_block(
                &self.node_id,
                &self.core,
                accepted_block,
                sealed_block,
            ) {
                return RpcResponse::SubmitResult {
                    accepted: false,
                    template_id,
                    block_height: None,
                    hash_hex: String::new(),
                    reason: Some(format!("locally mined block failed validation: {reason}")),
                };
            }
            // Soft-fail rather than panic if the just-accepted block
            // somehow isn't at the back of accepted_blocks (e.g. a future
            // pruning interaction). The block was already accepted; we
            // owe the caller a successful response. (Audit finding F5.)
            match self.chain_state.accepted_blocks.last().cloned() {
                Some(block) => {
                    if let Err(error) =
                        self.persist_chain_update(&ChainJournalEntry::BlockAccepted { block })
                    {
                        eprintln!("node_state_persist_error={error}");
                    }
                }
                None => {
                    eprintln!(
                        "node_state_persist_skipped: locally accepted block missing from \
                         accepted_blocks tail"
                    );
                }
            }
        }

        RpcResponse::SubmitResult {
            accepted,
            template_id,
            block_height: accepted.then_some(self.chain_state.height),
            hash_hex: hex(&hash),
            reason: if accepted {
                None
            } else {
                Some("low difficulty".to_string())
            },
        }
    }

    pub(crate) fn submit_transaction_rpc(&mut self, transaction: Transaction) -> RpcResponse {
        let tx_id = transaction.tx_id.clone();
        match self
            .chain_state
            .insert_transaction(&self.node_id, &self.core, transaction)
        {
            Ok(()) => {
                // Same soft-fail pattern as submit_utxo_transaction_rpc:
                // the tx was accepted into the mempool, so log + skip
                // journaling rather than panic if the index lookup
                // misses. (Audit finding F5.)
                match self.chain_state.mempool_by_id.get(&tx_id).cloned() {
                    Some(transaction) => {
                        if let Err(error) =
                            self.persist_chain_update(&ChainJournalEntry::TransactionAccepted {
                                transaction: transaction.clone(),
                            })
                        {
                            eprintln!("node_state_persist_error={error}");
                        }

                        // Notify WebSocket subscribers about pending transaction
                        if let Some(ws_notifier) = &self.ws_notifier {
                            // TODO: needs V3 websocket method: ws_notifier.notify_pending_transaction(&transaction);
                        }
                    }
                    None => {
                        eprintln!(
                            "node_state_persist_skipped: accepted account transaction {tx_id} \
                             missing from mempool_by_id index"
                        );
                    }
                }
                RpcResponse::TransactionResult {
                    accepted: true,
                    tx_id,
                    reason: None,
                }
            }
            Err(reason) => RpcResponse::TransactionResult {
                accepted: false,
                tx_id,
                reason: Some(reason),
            },
        }
    }
}
impl Transaction {
    pub(crate) fn validate(&self) -> Result<(), String> {
        if self.tx_id.trim().is_empty() {
            return Err("transaction id must not be empty".to_string());
        }
        if self.tx_id.len() != 64 || !self.tx_id.chars().all(|ch| ch.is_ascii_hexdigit()) {
            return Err("transaction id must be exactly 64 hex chars".to_string());
        }
        if self.from.trim().is_empty() || self.to.trim().is_empty() {
            return Err("transaction endpoints must not be empty".to_string());
        }
        if !is_valid_account_id(&self.from) || !is_valid_account_id(&self.to) {
            return Err("transaction endpoints must use 3-64 ascii wallet ids".to_string());
        }
        if self.from == self.to {
            return Err("transaction sender and recipient must differ".to_string());
        }
        if self.amount_zion == 0 {
            return Err("transaction amount must be greater than zero".to_string());
        }
        if self.fee_zion == 0 {
            return Err("transaction fee must be greater than zero".to_string());
        }
        if (self.fee_zion as u128) > self.amount_zion {
            return Err("transaction fee must not exceed transaction amount".to_string());
        }
        if let Some(ref memo) = self.memo {
            if memo.len() > 256 {
                return Err("transaction memo must not exceed 256 bytes".to_string());
            }
            if !memo.is_ascii() {
                return Err("transaction memo must be ASCII only".to_string());
            }
        }
        Ok(())
    }

    /// Verify Ed25519 signature for non-coinbase transactions.
    /// Coinbase transactions (from == "coinbase") are always valid.
    /// Returns true if the signature is valid or if the transaction is coinbase.
    pub fn verify_signature(&self) -> bool {
        if self.from == "coinbase" {
            return true;
        }
        if self.signature.len() != 128 || self.public_key.len() != 64 {
            return false;
        }
        let pk_bytes = match hex::decode(&self.public_key) {
            Ok(v) if v.len() == 32 => v,
            _ => return false,
        };
        let sig_bytes = match hex::decode(&self.signature) {
            Ok(v) if v.len() == 64 => v,
            _ => return false,
        };
        // CRITICAL: the public key must derive to the sender address. Without
        // this check, any account balance can be spent by signing with an
        // unrelated key.
        let derived_from = crypto::derive_address(&pk_bytes);
        if derived_from != self.from {
            return false;
        }
        crypto::verify(&pk_bytes, self.tx_id.as_bytes(), &sig_bytes)
    }
}
