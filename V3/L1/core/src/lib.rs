use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use zion_cosmic_harmony::{
    cosmic_harmony_ekam_deeksha, profile_name, RevenueCollector, RevenueEvent, RevenueStats,
    CHV_EKAM_FORK_HEIGHT, EKAM_FUSION_ROUNDS,
};

pub use zion_cosmic_harmony::RevenueSource;

pub mod crypto;
pub mod chain;
pub mod difficulty;
pub mod emission;
pub mod fee;
pub mod genesis;
pub mod ibd;
pub mod launch;
pub mod mempool_v2;
pub mod metrics;
pub mod node_builder;
pub mod orphan;
pub mod p2p_security;
pub mod peer_manager;
pub mod propagation;
pub mod rpc;
pub mod storage;
pub mod tx;
pub mod validation;
pub mod wallet;

pub const HEADER_SIZE: usize = 80;
pub const NODE_PROTOCOL_VERSION: &str = "zion-v3-node/0.1";
pub const MAX_TEMPLATE_TRANSACTIONS: usize = 16;
pub const MAX_MEMPOOL_TRANSACTIONS: usize = 4_096;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum NetworkId {
    Mainnet,
    Testnet,
    Devnet,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PeerEndpoint {
    pub host: String,
    pub port: u16,
}

impl PeerEndpoint {
    pub fn new(host: impl Into<String>, port: u16) -> Self {
        Self {
            host: host.into(),
            port,
        }
    }

    pub fn address(&self) -> String {
        format!("{}:{}", self.host, self.port)
    }

    pub fn parse(address: &str) -> Result<Self, String> {
        let (host, port) = address
            .rsplit_once(':')
            .ok_or_else(|| format!("invalid endpoint address: {address}"))?;
        let port = port
            .parse::<u16>()
            .map_err(|_| format!("invalid endpoint port in {address}"))?;
        Ok(Self::new(host, port))
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NodeConfig {
    pub network: NetworkId,
    pub p2p_bind: PeerEndpoint,
    pub rpc_bind: PeerEndpoint,
    pub pool_bind: PeerEndpoint,
    pub seed_peers: Vec<PeerEndpoint>,
}

impl NodeConfig {
    pub fn mainnet() -> Self {
        Self {
            network: NetworkId::Mainnet,
            p2p_bind: PeerEndpoint::new("0.0.0.0", 8334),
            rpc_bind: PeerEndpoint::new("127.0.0.1", 8332),
            pool_bind: PeerEndpoint::new("0.0.0.0", 8444),
            seed_peers: vec![
                // EU – Prague, CZ (primary)
                PeerEndpoint::new("91.98.122.165", 8334),
                // EU – Frankfurt, DE
                PeerEndpoint::new("seed-eu1.zionchain.org", 8334),
                // NA – US East
                PeerEndpoint::new("seed-us1.zionchain.org", 8334),
                // NA – US West
                PeerEndpoint::new("seed-us2.zionchain.org", 8334),
                // APAC – Singapore
                PeerEndpoint::new("seed-ap1.zionchain.org", 8334),
            ],
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct MiningHeader {
    pub version: u32,
    pub previous_hash: [u8; 32],
    pub merkle_root: [u8; 32],
    pub timestamp: u64,
    pub difficulty_bits: u32,
}

impl MiningHeader {
    pub fn to_bytes(self) -> [u8; HEADER_SIZE] {
        let mut bytes = [0u8; HEADER_SIZE];
        bytes[0..4].copy_from_slice(&self.version.to_le_bytes());
        bytes[4..36].copy_from_slice(&self.previous_hash);
        bytes[36..68].copy_from_slice(&self.merkle_root);
        bytes[68..76].copy_from_slice(&self.timestamp.to_le_bytes());
        bytes[76..80].copy_from_slice(&self.difficulty_bits.to_le_bytes());
        bytes
    }

    pub fn from_bytes(bytes: [u8; HEADER_SIZE]) -> Self {
        Self {
            version: u32::from_le_bytes(bytes[0..4].try_into().expect("header version slice")),
            previous_hash: bytes[4..36].try_into().expect("previous hash slice"),
            merkle_root: bytes[36..68].try_into().expect("merkle root slice"),
            timestamp: u64::from_le_bytes(bytes[68..76].try_into().expect("timestamp slice")),
            difficulty_bits: u32::from_le_bytes(
                bytes[76..80].try_into().expect("difficulty bits slice"),
            ),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct BlockCandidate {
    pub header: MiningHeader,
    pub nonce: u64,
}

impl BlockCandidate {
    pub fn hash(self) -> [u8; 32] {
        cosmic_harmony_ekam_deeksha(&self.header.to_bytes(), self.nonce).data
    }

    pub fn seal(self) -> SealedBlock {
        SealedBlock {
            header: self.header,
            nonce: self.nonce,
            hash: self.hash(),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct SealedBlock {
    pub header: MiningHeader,
    pub nonce: u64,
    pub hash: [u8; 32],
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct MiningJob {
    pub job_id: u64,
    pub header: MiningHeader,
    pub target: DifficultyTarget,
    pub start_nonce: u64,
    pub nonce_count: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct MiningSolution {
    pub job_id: u64,
    pub candidate: BlockCandidate,
    pub hash: [u8; 32],
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct DifficultyTarget {
    pub bytes: [u8; 32],
}

impl DifficultyTarget {
    pub const MAX: Self = Self { bytes: [0xFF; 32] };

    pub fn allows(&self, hash: &[u8; 32]) -> bool {
        hash <= &self.bytes
    }

    pub fn to_hex(self) -> String {
        hex(&self.bytes)
    }

    pub fn from_hex(raw: &str) -> Result<Self, String> {
        Ok(Self {
            bytes: parse_fixed_hex::<32>(raw, "difficulty target")?,
        })
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ConsensusConfig {
    pub profile: &'static str,
    pub ekam_fork_height: u64,
    pub fusion_rounds: usize,
    pub default_target: DifficultyTarget,
}

impl Default for ConsensusConfig {
    fn default() -> Self {
        Self {
            profile: profile_name(),
            ekam_fork_height: CHV_EKAM_FORK_HEIGHT,
            fusion_rounds: EKAM_FUSION_ROUNDS,
            default_target: DifficultyTarget::MAX,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RevenueSnapshot {
    pub total_earnings_usd: f64,
    pub zion_fees_usd: f64,
    pub miner_payout_usd: f64,
}

impl From<RevenueStats> for RevenueSnapshot {
    fn from(value: RevenueStats) -> Self {
        Self {
            total_earnings_usd: value.total_earnings_usd,
            zion_fees_usd: value.zion_fees_usd,
            miner_payout_usd: value.miner_payout_usd,
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
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Transaction {
    pub tx_id: String,
    pub from: String,
    pub to: String,
    pub amount_zion: u64,
    pub fee_zion: u64,
    pub nonce: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SubmittedTransaction {
    Account(Transaction),
    Utxo(tx::Transaction),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(untagged)]
enum RuntimeTransaction {
    Account(Transaction),
    Utxo(tx::Transaction),
}

impl SubmittedTransaction {
    pub fn parse_value(value: Value) -> Result<Self, String> {
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

    pub fn model(&self) -> &'static str {
        match self {
            Self::Account(_) => "account",
            Self::Utxo(_) => "utxo",
        }
    }

    pub fn tx_id(&self) -> String {
        match self {
            Self::Account(tx) => tx.tx_id.clone(),
            Self::Utxo(tx) => hex(&tx.id),
        }
    }
}

impl RuntimeTransaction {
    fn tx_id(&self) -> String {
        match self {
            Self::Account(tx) => tx.tx_id.clone(),
            Self::Utxo(tx) => hex(&tx.id),
        }
    }

    fn as_account(&self) -> Option<&Transaction> {
        match self {
            Self::Account(tx) => Some(tx),
            Self::Utxo(_) => None,
        }
    }

    #[cfg(test)]
    fn as_account_mut(&mut self) -> Option<&mut Transaction> {
        match self {
            Self::Account(tx) => Some(tx),
            Self::Utxo(_) => None,
        }
    }

    fn into_account(self) -> Option<Transaction> {
        match self {
            Self::Account(tx) => Some(tx),
            Self::Utxo(_) => None,
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

#[derive(Debug, Clone)]
struct TemplateState {
    template_id: u64,
    height: u64,
    header: MiningHeader,
    target: DifficultyTarget,
    difficulty: u64,
    reward_zion: u64,
    transactions: Vec<RuntimeTransaction>,
    total_fees_zion: u64,
}

#[derive(Debug, Clone)]
struct ChainState {
    height: u64,
    tip_hash: [u8; 32],
    next_template_id: u64,
    active_template: TemplateState,
    accepted_blocks: Vec<AcceptedBlock>,
    accepted_by_height: BTreeMap<u64, AcceptedBlock>,
    accepted_by_template_id: HashMap<u64, AcceptedBlock>,
    mempool: Vec<RuntimeTransaction>,
    mempool_by_id: HashMap<String, RuntimeTransaction>,
    /// Address to credit in coinbase transactions. Empty = no coinbase generated.
    miner_address: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
struct ChainStateSnapshot {
    height: u64,
    tip_hash_hex: String,
    next_template_id: u64,
    active_template: BlockTemplate,
    accepted_blocks: Vec<AcceptedBlock>,
    mempool: Vec<Transaction>,
}

#[derive(Debug, Clone)]
struct ChainStore {
    path: PathBuf,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum ChainJournalEntry {
    TransactionAccepted {
        transaction: RuntimeTransaction,
    },
    BlockAccepted {
        block: AcceptedBlock,
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

    pub fn consensus(&self) -> &ConsensusConfig {
        &self.consensus
    }

    pub fn consensus_profile(&self) -> &'static str {
        self.consensus.profile
    }

    pub fn hash_candidate(&self, candidate: BlockCandidate) -> [u8; 32] {
        candidate.hash()
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

    pub fn scan_nonce_range(&self, job: MiningJob) -> Option<MiningSolution> {
        for offset in 0..job.nonce_count {
            let candidate = BlockCandidate {
                header: job.header,
                nonce: job.start_nonce.wrapping_add(offset),
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

    pub fn validate_solution(&self, job: MiningJob, solution: MiningSolution) -> Option<SealedBlock> {
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
        self.revenue.track_event(RevenueEvent {
            source,
            value_usd,
            qualifies,
        });
    }

    pub fn revenue_snapshot(&self) -> RevenueSnapshot {
        self.revenue.get_stats().into()
    }
}

pub fn consensus_profile() -> &'static str {
    profile_name()
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
        // Rebuild active template to include coinbase for the current height.
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
        if self
            .known_peers
            .iter()
            .all(|known| known.address() != peer.address())
        {
            self.known_peers.push(peer);
        }
    }

    pub fn register_peers(&mut self, peers: impl IntoIterator<Item = PeerEndpoint>) {
        for peer in peers {
            self.register_peer(peer);
        }
    }

    // ── Peer persistence (Phase 11) ────────────────────────────────────

    /// Return the path for persisting known peers (sibling of chain state file).
    fn peers_path(&self) -> Option<PathBuf> {
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
        println!("peers_loaded count={count} total={}", self.known_peers.len());
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
            consensus_profile: self.core.consensus_profile().to_string(),
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

    pub fn needs_blocks_from(&self, peer_height: u64) -> bool {
        peer_height > self.chain_state.height
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

    fn persist_chain_update(&self, entry: &ChainJournalEntry) -> Result<(), String> {
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
                self.register_peer(PeerEndpoint::parse(&listen_addr)?);
                Ok(P2pMessage::Welcome {
                    node_id: self.node_id.clone(),
                    protocol_version: node_protocol_version().to_string(),
                    profile: self.core.consensus_profile().to_string(),
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
            other => Err(format!("unsupported inbound p2p message: {other:?}")),
        }
    }

    /// Handle an `AnnounceBlock` from a peer. Returns the newly accepted
    /// block if it was new (for relay), or `None` if it was a duplicate.
    /// The caller is responsible for relaying to other peers.
    pub fn handle_announce_block(&mut self, block: AcceptedBlock) -> Result<Option<AcceptedBlock>, String> {
        self.import_peer_block(block)
    }

    /// Return the last accepted block, if any. Useful after RPC
    /// `submit_candidate` to relay the newly mined block.
    pub fn last_accepted_block(&self) -> Option<&AcceptedBlock> {
        self.chain_state.accepted_blocks.last()
    }

    /// Import a single peer block. Returns `Ok(Some(block))` if the block
    /// was newly accepted (and should be relayed), `Ok(None)` if it was a
    /// duplicate, or `Err` on validation failure.
    fn import_peer_block(&mut self, block: AcceptedBlock) -> Result<Option<AcceptedBlock>, String> {
        let height_before = self.chain_state.height;
        self.chain_state.import_peer_block(&self.node_id, &self.core, block)?;
        self.persist_chain_state()?;
        if self.chain_state.height > height_before {
            Ok(self.chain_state.accepted_blocks.last().cloned())
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
            } => self.submit_candidate_rpc(template_id, &header_hex, nonce, &target_hex),
        }
    }

    pub fn submit_submitted_transaction(
        &mut self,
        transaction: SubmittedTransaction,
    ) -> RpcResponse {
        match transaction {
            SubmittedTransaction::Account(transaction) => self.submit_transaction_rpc(transaction),
            SubmittedTransaction::Utxo(transaction) => RpcResponse::TransactionResult {
                accepted: false,
                tx_id: hex(&transaction.id),
                reason: Some(
                    "UTXO transaction payloads are recognized but not accepted by the active account runtime yet"
                        .to_string(),
                ),
            },
        }
    }

    fn submit_candidate_rpc(
        &mut self,
        template_id: u64,
        header_hex: &str,
        nonce: u64,
        target_hex: &str,
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

        let target = match DifficultyTarget::from_hex(target_hex) {
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

        let candidate = BlockCandidate { header, nonce };
        let hash = self.core.hash_candidate(candidate);
        let sealed = self.core.validate_candidate(candidate, target);
        let accepted = sealed.is_some();

        if let Some(sealed_block) = sealed {
            let template_transactions = active_template.account_transactions();
            let accepted_block = AcceptedBlock {
                template_id,
                height: active_template.height,
                timestamp: active_template.header.timestamp,
                difficulty: active_template.difficulty,
                nonce: sealed_block.nonce,
                hash_hex: hex(&sealed_block.hash),
                header_hex: hex(&active_template.header.to_bytes()),
                previous_hash_hex: hex(&active_template.header.previous_hash),
                transaction_ids: active_template
                    .account_transactions()
                    .iter()
                    .map(|transaction| transaction.tx_id.clone())
                    .collect(),
                transactions: template_transactions.clone(),
                total_fees_zion: active_template.total_fees_zion,
                body_hash_hex: body_hash_hex(&template_transactions),
                subsidy_zion: active_template.reward_zion,
                miner_reward_zion: active_template.reward_zion,
                miner_address: self.miner_address.clone(),
            };
            if let Err(reason) = self
                .chain_state
                .accept_block(&self.node_id, &self.core, accepted_block, sealed_block)
            {
                return RpcResponse::SubmitResult {
                    accepted: false,
                    template_id,
                    block_height: None,
                    hash_hex: String::new(),
                    reason: Some(format!("locally mined block failed validation: {reason}")),
                };
            }
            if let Err(error) = self.persist_chain_update(&ChainJournalEntry::BlockAccepted {
                block: self
                    .chain_state
                    .accepted_blocks
                    .last()
                    .cloned()
                    .expect("accepted block should be recorded"),
            }) {
                eprintln!("node_state_persist_error={error}");
            }
        }

        RpcResponse::SubmitResult {
            accepted,
            template_id,
            block_height: accepted.then_some(self.chain_state.height),
            hash_hex: hex(&hash),
            reason: accepted.then_some(None).unwrap_or_else(|| Some("low difficulty".to_string())),
        }
    }

    fn submit_transaction_rpc(&mut self, transaction: Transaction) -> RpcResponse {
        let tx_id = transaction.tx_id.clone();
        match self.chain_state.insert_transaction(&self.node_id, &self.core, transaction) {
            Ok(()) => {
                if let Err(error) = self.persist_chain_update(&ChainJournalEntry::TransactionAccepted {
                    transaction: self
                        .chain_state
                        .mempool_by_id
                        .get(&tx_id)
                        .cloned()
                        .expect("accepted mempool transaction should be indexed"),
                }) {
                    eprintln!("node_state_persist_error={error}");
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

impl TemplateState {
    fn account_transactions(&self) -> Vec<Transaction> {
        self.transactions
            .iter()
            .filter_map(|transaction| transaction.as_account().cloned())
            .collect()
    }

    fn as_public(&self) -> BlockTemplate {
        let account_transactions = self.account_transactions();
        BlockTemplate {
            template_id: self.template_id,
            height: self.height,
            header_hex: hex(&self.header.to_bytes()),
            target_hex: self.target.to_hex(),
            reward_zion: self.reward_zion,
            transaction_ids: account_transactions
                .iter()
                .map(|transaction| transaction.tx_id.clone())
                .collect(),
            transaction_count: account_transactions.len(),
            total_fees_zion: self.total_fees_zion,
            body_hash_hex: body_hash_hex(&account_transactions),
            estimated_miner_reward_zion: self.reward_zion,
        }
    }
}

impl Transaction {
    fn validate(&self) -> Result<(), String> {
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
        if looks_like_utxo_address(&self.from) || looks_like_utxo_address(&self.to) {
            return Err(
                "transaction endpoints must use account-style wallet ids; zion1 UTXO addresses are not accepted by the active runtime"
                    .to_string(),
            );
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
        if self.fee_zion > self.amount_zion {
            return Err("transaction fee must not exceed transaction amount".to_string());
        }
        Ok(())
    }
}

impl ChainState {
    fn account_mempool_transactions(&self) -> Vec<Transaction> {
        self.mempool
            .iter()
            .filter_map(|transaction| transaction.as_account().cloned())
            .collect()
    }

    fn new(node_id: &str, core: &CoreRuntime) -> Self {
        let genesis = genesis::genesis_block();
        let genesis_hash = parse_fixed_hex::<32>(&genesis.hash_hex, "genesis hash")
            .expect("genesis hash must be valid hex");
        let mempool = Vec::new();
        let template =
            Self::build_template(node_id, core, 0, genesis_hash, 1, &mempool, &[genesis.clone()], "");
        let mut accepted_by_height = BTreeMap::new();
        accepted_by_height.insert(0, genesis.clone());
        Self {
            height: 0,
            tip_hash: genesis_hash,
            next_template_id: 2,
            active_template: template,
            accepted_blocks: vec![genesis],
            accepted_by_height,
            accepted_by_template_id: HashMap::new(),
            mempool,
            mempool_by_id: HashMap::new(),
            miner_address: String::new(),
        }
    }

    fn from_snapshot(
        node_id: &str,
        core: &CoreRuntime,
        snapshot: ChainStateSnapshot,
    ) -> Result<Self, String> {
        let persisted_transaction_ids = snapshot.active_template.transaction_ids.clone();
        let tip_hash = parse_fixed_hex::<32>(&snapshot.tip_hash_hex, "persisted tip hash")?;
        let header = MiningHeader::from_bytes(parse_fixed_hex::<HEADER_SIZE>(
            &snapshot.active_template.header_hex,
            "persisted active template header",
        )?);
        let target = DifficultyTarget::from_hex(&snapshot.active_template.target_hex)?;
        // Recover difficulty from accepted blocks via LWMA for the persisted template.
        let recovered_difficulty = if snapshot.accepted_blocks.is_empty() {
            difficulty::GENESIS_DIFFICULTY
        } else {
            let ab = &snapshot.accepted_blocks;
            let start = ab.len().saturating_sub(difficulty::LWMA_WINDOW + 1);
            let window: Vec<difficulty::BlockInfo> = ab[start..]
                .iter()
                .map(|b| difficulty::BlockInfo {
                    timestamp: b.timestamp,
                    difficulty: b.difficulty,
                })
                .collect();
            difficulty::lwma_next_difficulty(&window)
        };
        let mut chain_state = Self {
            height: snapshot.height,
            tip_hash,
            next_template_id: snapshot.next_template_id,
            active_template: TemplateState {
                template_id: snapshot.active_template.template_id,
                height: snapshot.active_template.height,
                header,
                target,
                difficulty: recovered_difficulty,
                reward_zion: snapshot.active_template.reward_zion,
                transactions: Vec::new(),
                total_fees_zion: snapshot.active_template.total_fees_zion,
            },
            accepted_blocks: snapshot.accepted_blocks,
            accepted_by_height: BTreeMap::new(),
            accepted_by_template_id: HashMap::new(),
            mempool: snapshot
                .mempool
                .into_iter()
                .map(RuntimeTransaction::from)
                .collect(),
            mempool_by_id: HashMap::new(),
            miner_address: String::new(),
        };
        chain_state.rebuild_mempool_index();
        chain_state.active_template.transactions = persisted_transaction_ids
            .iter()
            .filter_map(|tx_id| {
                chain_state
                    .mempool_by_id
                    .get(tx_id)
                    .cloned()
            })
            .collect();
        chain_state.sanitize_recovered_state(node_id, core)?;
        Ok(chain_state)
    }

    fn accept_block(
        &mut self,
        node_id: &str,
        core: &CoreRuntime,
        accepted_block: AcceptedBlock,
        sealed_block: SealedBlock,
    ) -> Result<(), String> {
        self.validate_peer_block(&accepted_block)?;
        self.accept_block_record(node_id, core, accepted_block, sealed_block.hash);
        Ok(())
    }

    fn accept_block_record(
        &mut self,
        node_id: &str,
        core: &CoreRuntime,
        accepted_block: AcceptedBlock,
        tip_hash: [u8; 32],
    ) {
        self.height = accepted_block.height;
        self.tip_hash = tip_hash;
        let mined_ids: HashSet<&str> = accepted_block
            .transaction_ids
            .iter()
            .map(String::as_str)
            .collect();
        self.mempool
            .retain(|transaction| !mined_ids.contains(transaction.tx_id().as_str()));
        self.rebuild_mempool_index();
        self.accepted_by_height
            .insert(accepted_block.height, accepted_block.clone());
        self.accepted_by_template_id
            .insert(accepted_block.template_id, accepted_block.clone());
        self.accepted_blocks.push(accepted_block);
        let next_template_id = self.next_template_id;
        let miner_addr = self.miner_address.clone();
        self.active_template = Self::build_template(
            node_id,
            core,
            self.height,
            self.tip_hash,
            next_template_id,
            &self.mempool,
            &self.accepted_blocks,
            &miner_addr,
        );
        self.next_template_id = self.next_template_id.wrapping_add(1);
    }

    fn apply_journal_entry(
        &mut self,
        node_id: &str,
        core: &CoreRuntime,
        entry: ChainJournalEntry,
    ) -> Result<(), String> {
        match entry {
            ChainJournalEntry::TransactionAccepted { transaction } => {
                if self.mempool_by_id.contains_key(&transaction.tx_id())
                    || self.accepted_blocks.iter().any(|block| {
                        block
                            .transaction_ids
                            .iter()
                            .any(|tx_id| tx_id == &transaction.tx_id())
                    })
                {
                    return Ok(());
                }
                match transaction {
                    RuntimeTransaction::Account(transaction) => {
                        self.insert_transaction(node_id, core, transaction)
                    }
                    RuntimeTransaction::Utxo(_) => Err(
                        "journal replay for UTXO transactions is not enabled in the active runtime yet"
                            .to_string(),
                    ),
                }
            }
            ChainJournalEntry::BlockAccepted { block } => {
                if let Some(existing) = self.accepted_by_template_id.get(&block.template_id) {
                    if existing.hash_hex == block.hash_hex {
                        return Ok(());
                    }
                    return Err(format!(
                        "journal block {} conflicts with existing accepted block",
                        block.template_id
                    ));
                }

                let tip_hash = parse_fixed_hex::<32>(&block.hash_hex, "journal block hash")?;
                self.accept_block_record(node_id, core, block, tip_hash);
                Ok(())
            }
        }
    }

    fn import_peer_block(
        &mut self,
        node_id: &str,
        core: &CoreRuntime,
        block: AcceptedBlock,
    ) -> Result<(), String> {
        self.validate_peer_block(&block)?;

        if let Some(existing) = self.accepted_by_height.get(&block.height) {
            if existing.hash_hex == block.hash_hex {
                return Ok(());
            }
            return Err(format!("conflicting peer block at height {}", block.height));
        }

        if block.height != self.height.saturating_add(1) {
            return Err(format!(
                "peer block height {} is not contiguous with local height {}",
                block.height, self.height
            ));
        }

        // Chain linkage: block must reference our current tip as parent.
        let tip_hex = hex(&self.tip_hash);
        if !block.previous_hash_hex.is_empty() {
            if block.previous_hash_hex != tip_hex {
                return Err(format!(
                    "peer block previous_hash {} does not link to local tip {}",
                    block.previous_hash_hex, tip_hex
                ));
            }
        } else if !block.header_hex.is_empty() {
            // Fall back to extracting previous_hash from header.
            let header_bytes = parse_fixed_hex::<HEADER_SIZE>(
                &block.header_hex,
                "peer block header for chain linkage",
            )?;
            let header = MiningHeader::from_bytes(header_bytes);
            if hex(&header.previous_hash) != tip_hex {
                return Err(format!(
                    "peer block header previous_hash does not link to local tip {}",
                    tip_hex
                ));
            }
        }

        let tip_hash = parse_fixed_hex::<32>(&block.hash_hex, "peer block hash")?;
        self.accept_block_record(node_id, core, block, tip_hash);
        Ok(())
    }

    fn import_peer_blocks(
        &mut self,
        node_id: &str,
        core: &CoreRuntime,
        blocks: Vec<AcceptedBlock>,
    ) -> Result<usize, String> {
        if blocks.is_empty() {
            return Ok(0);
        }

        // Skip any leading blocks we already have (e.g. genesis).
        let skip_count = blocks
            .iter()
            .take_while(|block| {
                self.accepted_by_height
                    .get(&block.height)
                    .map_or(false, |existing| existing.hash_hex == block.hash_hex)
            })
            .count();
        let blocks: Vec<AcceptedBlock> = blocks.into_iter().skip(skip_count).collect();
        if blocks.is_empty() {
            return Ok(0);
        }

        let mut expected_height = self.height.saturating_add(1);
        let mut seen_heights = HashSet::new();
        let mut seen_template_ids = HashSet::new();
        // Track the expected parent hash for chain linkage verification.
        let mut expected_parent_hex = hex(&self.tip_hash);
        for block in &blocks {
            self.validate_peer_block(block)?;
            if !seen_heights.insert(block.height) {
                return Err(format!("duplicate peer block height {} in batch", block.height));
            }
            if !seen_template_ids.insert(block.template_id) {
                return Err(format!(
                    "duplicate peer template id {} in batch",
                    block.template_id
                ));
            }
            if let Some(existing) = self.accepted_by_height.get(&block.height) {
                if existing.hash_hex != block.hash_hex {
                    return Err(format!("conflicting peer block at height {}", block.height));
                }
                return Err(format!(
                    "peer batch starts at already imported height {}",
                    block.height
                ));
            }
            if block.height != expected_height {
                return Err(format!(
                    "peer batch is not contiguous: expected height {}, got {}",
                    expected_height, block.height
                ));
            }
            // Chain linkage: every block must reference the previous one.
            let parent_hex = Self::extract_previous_hash_hex(block);
            if let Some(ref parent) = parent_hex {
                if parent != &expected_parent_hex {
                    return Err(format!(
                        "peer batch block at height {} does not link to expected parent {}",
                        block.height, expected_parent_hex
                    ));
                }
            }
            expected_parent_hex = block.hash_hex.clone();
            expected_height = expected_height.saturating_add(1);
        }

        let imported = blocks.len();
        for block in blocks {
            let tip_hash = parse_fixed_hex::<32>(&block.hash_hex, "peer block hash")?;
            self.accept_block_record(node_id, core, block, tip_hash);
        }
        Ok(imported)
    }

    /// Extract previous_hash_hex from a peer block, preferring the explicit
    /// field and falling back to header_hex extraction.  Returns `None` for
    /// legacy blocks that carry neither.
    fn extract_previous_hash_hex(block: &AcceptedBlock) -> Option<String> {
        if !block.previous_hash_hex.is_empty() {
            return Some(block.previous_hash_hex.clone());
        }
        if !block.header_hex.is_empty() {
            if let Ok(bytes) = parse_fixed_hex::<HEADER_SIZE>(&block.header_hex, "header") {
                let header = MiningHeader::from_bytes(bytes);
                return Some(hex(&header.previous_hash));
            }
        }
        None
    }

    fn validate_peer_block(&self, block: &AcceptedBlock) -> Result<(), String> {
        // Genesis block is hard-coded — only verify hash match.
        if block.height == 0 {
            let expected = genesis::genesis_block();
            if block.hash_hex != expected.hash_hex {
                return Err("genesis block hash does not match canonical genesis".to_string());
            }
            return Ok(());
        }

        // ── Checkpoint verification ────────────────────────────────────
        launch::verify_checkpoint(block.height, &block.hash_hex)?;

        // ── PoW verification (when header is available) ────────────────
        let block_hash = parse_fixed_hex::<32>(&block.hash_hex, "peer block hash")?;
        if !block.header_hex.is_empty() {
            let header_bytes = parse_fixed_hex::<HEADER_SIZE>(
                &block.header_hex,
                "peer block header",
            )?;
            let header = MiningHeader::from_bytes(header_bytes);

            // Header fields must be consistent with block metadata
            if header.timestamp != block.timestamp {
                return Err("peer block header timestamp does not match block timestamp".to_string());
            }
            let expected_target = difficulty::difficulty_to_target(block.difficulty);
            let expected_bits = difficulty::target_to_compact(&expected_target);
            if header.difficulty_bits != expected_bits {
                return Err(format!(
                    "peer block header difficulty_bits {} does not match expected {}",
                    header.difficulty_bits, expected_bits
                ));
            }

            // Verify PoW: recompute hash from header + nonce
            let candidate = BlockCandidate {
                header,
                nonce: block.nonce,
            };
            let computed_hash = candidate.hash();
            if computed_hash != block_hash {
                return Err(
                    "peer block hash does not match PoW computation from header and nonce"
                        .to_string(),
                );
            }

            // Verify hash meets difficulty target
            let target = difficulty::difficulty_to_target(block.difficulty);
            if !target.allows(&computed_hash) {
                return Err("peer block PoW hash does not meet difficulty target".to_string());
            }

            // Verify previous_hash_hex matches header.previous_hash
            if !block.previous_hash_hex.is_empty() {
                let header_prev = hex(&header.previous_hash);
                if block.previous_hash_hex != header_prev {
                    return Err(
                        "peer block previous_hash_hex does not match header previous_hash"
                            .to_string(),
                    );
                }
            }
        }

        // ── Timestamp sanity ───────────────────────────────────────────
        let current_time = now_secs();
        let median_time_past = if self.accepted_blocks.is_empty() {
            0
        } else {
            let start = self.accepted_blocks.len().saturating_sub(11);
            let mut timestamps: Vec<u64> = self.accepted_blocks[start..]
                .iter()
                .map(|b| b.timestamp)
                .collect();
            timestamps.sort_unstable();
            timestamps[timestamps.len() / 2]
        };
        validation::validate_timestamp(block.timestamp, median_time_past, current_time)
            .map_err(|e| format!("peer block timestamp invalid: {e}"))?;

        // ── Transaction structure ──────────────────────────────────────
        if block.transaction_ids.len() != block.transactions.len() {
            return Err("peer block transaction ids do not match block body length".to_string());
        }
        let expected_ids = block
            .transactions
            .iter()
            .map(|transaction| transaction.tx_id.clone())
            .collect::<Vec<_>>();
        if expected_ids != block.transaction_ids {
            return Err("peer block transaction ids do not match serialized transactions".to_string());
        }
        let mut seen_tx_ids = HashSet::new();
        let mut seen_sender_nonces = HashSet::new();
        let mut coinbase_count = 0usize;
        let total_fees_zion = block
            .transactions
            .iter()
            .enumerate()
            .map(|(index, transaction)| {
                if !seen_tx_ids.insert(transaction.tx_id.clone()) {
                    return Err(format!(
                        "peer block contains duplicate transaction id {}",
                        transaction.tx_id
                    ));
                }
                if transaction.from == "coinbase" {
                    coinbase_count = coinbase_count.saturating_add(1);
                    if transaction.tx_id.len() != 64
                        || !transaction.tx_id.chars().all(|ch| ch.is_ascii_hexdigit())
                    {
                        return Err("peer block coinbase transaction id must be exactly 64 hex chars"
                            .to_string());
                    }
                    if transaction.to.trim().is_empty() {
                        return Err(
                            "peer block coinbase recipient must not be empty".to_string(),
                        );
                    }
                    if !is_valid_account_id(&transaction.to) {
                        return Err(
                            "peer block coinbase recipient must use a 3-64 ascii wallet id"
                                .to_string(),
                        );
                    }
                    if index != 0 {
                        return Err("peer block coinbase transaction must be first".to_string());
                    }
                    if transaction.fee_zion != 0 {
                        return Err("peer block coinbase transaction must have zero fee".to_string());
                    }
                    if transaction.nonce != block.height {
                        return Err(format!(
                            "peer block coinbase nonce {} does not match block height {}",
                            transaction.nonce, block.height
                        ));
                    }
                    if block.miner_address.is_empty() {
                        return Err(
                            "peer block coinbase transaction requires miner_address metadata"
                                .to_string(),
                        );
                    }
                    if transaction.to != block.miner_address {
                        return Err(
                            "peer block coinbase recipient does not match miner_address"
                                .to_string(),
                        );
                    }
                    if transaction.amount_zion != block.subsidy_zion {
                        return Err(format!(
                            "peer block coinbase amount {} does not match subsidy {}",
                            transaction.amount_zion, block.subsidy_zion
                        ));
                    }
                    let coinbase_label =
                        format!("coinbase:{}:{}", block.height, block.miner_address);
                    let expected_coinbase_hash =
                        cosmic_harmony_ekam_deeksha(coinbase_label.as_bytes(), block.height);
                    let expected_coinbase_id = hex(&expected_coinbase_hash.data);
                    if transaction.tx_id != expected_coinbase_id {
                        return Err(
                            "peer block coinbase tx_id is not deterministic for height and miner_address"
                                .to_string(),
                        );
                    }
                } else {
                    transaction.validate()?;
                    if !seen_sender_nonces.insert((transaction.from.clone(), transaction.nonce)) {
                        return Err(format!(
                            "peer block reuses sender nonce {} for {}",
                            transaction.nonce, transaction.from
                        ));
                    }
                }
                Ok(transaction.fee_zion)
            })
            .collect::<Result<Vec<_>, String>>()?
            .into_iter()
            .sum::<u64>();
        if coinbase_count > 1 {
            return Err("peer block contains multiple coinbase transactions".to_string());
        }
        if !block.miner_address.is_empty() && coinbase_count == 0 {
            return Err("peer block miner_address is set but coinbase transaction is missing".to_string());
        }
        if total_fees_zion != block.total_fees_zion {
            return Err("peer block fee total does not match serialized transactions".to_string());
        }
        if block.body_hash_hex != body_hash_hex(&block.transactions) {
            return Err("peer block body hash does not match serialized transactions".to_string());
        }
        if block.miner_reward_zion != block.subsidy_zion {
            return Err("peer block miner reward must match subsidy only because fees are burned"
                .to_string());
        }
        let expected_subsidy = emission::block_subsidy(block.height);
        if block.subsidy_zion != expected_subsidy {
            return Err(format!(
                "peer block subsidy {} does not match emission schedule {} at height {}",
                block.subsidy_zion, expected_subsidy, block.height
            ));
        }
        // Validate difficulty against LWMA
        let expected_difficulty = if self.accepted_blocks.is_empty() {
            difficulty::GENESIS_DIFFICULTY
        } else {
            let start = self.accepted_blocks.len().saturating_sub(difficulty::LWMA_WINDOW + 1);
            let window: Vec<difficulty::BlockInfo> = self.accepted_blocks[start..]
                .iter()
                .map(|b| difficulty::BlockInfo {
                    timestamp: b.timestamp,
                    difficulty: b.difficulty,
                })
                .collect();
            difficulty::lwma_next_difficulty(&window)
        };
        if block.difficulty != expected_difficulty {
            return Err(format!(
                "peer block difficulty {} does not match expected {} at height {}",
                block.difficulty, expected_difficulty, block.height
            ));
        }
        Ok(())
    }

    fn insert_transaction(
        &mut self,
        node_id: &str,
        core: &CoreRuntime,
        transaction: Transaction,
    ) -> Result<(), String> {
        transaction.validate()?;
        if self.mempool.len() >= MAX_MEMPOOL_TRANSACTIONS {
            return Err(format!("mempool capacity reached: {MAX_MEMPOOL_TRANSACTIONS}"));
        }
        if self.mempool_by_id.contains_key(&transaction.tx_id) {
            return Err(format!("duplicate transaction id: {}", transaction.tx_id));
        }
        if self
            .accepted_blocks
            .iter()
            .any(|block| block.transaction_ids.iter().any(|tx_id| tx_id == &transaction.tx_id))
        {
            return Err(format!("transaction {} already mined", transaction.tx_id));
        }
        if self
            .mempool
            .iter()
            .filter_map(RuntimeTransaction::as_account)
            .any(|known| known.from == transaction.from && known.nonce == transaction.nonce)
        {
            return Err(format!(
                "transaction nonce {} for sender {} is already pending",
                transaction.nonce, transaction.from
            ));
        }
        if self.accepted_blocks.iter().any(|block| {
            block
                .transactions
                .iter()
                .any(|known| known.from == transaction.from && known.nonce == transaction.nonce)
        }) {
            return Err(format!(
                "transaction nonce {} for sender {} is already mined",
                transaction.nonce, transaction.from
            ));
        }

        self.mempool.push(RuntimeTransaction::from(transaction.clone()));
        self.mempool_by_id
            .insert(transaction.tx_id.clone(), RuntimeTransaction::from(transaction.clone()));
        let miner_addr = self.miner_address.clone();
        self.active_template = Self::build_template(
            node_id,
            core,
            self.height,
            self.tip_hash,
            self.active_template.template_id,
            &self.mempool,
            &self.accepted_blocks,
            &miner_addr,
        );
        Ok(())
    }

    fn rebuild_indexes(&mut self) {
        self.accepted_by_height.clear();
        self.accepted_by_template_id.clear();
        for block in &self.accepted_blocks {
            self.accepted_by_height.insert(block.height, block.clone());
            self.accepted_by_template_id
                .insert(block.template_id, block.clone());
        }
    }

    fn rebuild_mempool_index(&mut self) {
        self.mempool_by_id.clear();
        for transaction in &self.mempool {
            self.mempool_by_id
                .insert(transaction.tx_id(), transaction.clone());
        }
    }

    fn sanitize_recovered_state(&mut self, node_id: &str, core: &CoreRuntime) -> Result<(), String> {
        self.rebuild_indexes();

        let mined_ids: HashSet<&str> = self
            .accepted_blocks
            .iter()
            .flat_map(|block| block.transaction_ids.iter().map(String::as_str))
            .collect();
        let mut sender_nonces = HashSet::new();
        let mut seen = HashSet::new();
        self.mempool.retain(|transaction| {
            let Some(transaction) = transaction.as_account() else {
                return false;
            };
            transaction.validate().is_ok()
                && !mined_ids.contains(transaction.tx_id.as_str())
                && seen.insert(transaction.tx_id.clone())
                && sender_nonces.insert((transaction.from.clone(), transaction.nonce))
                && !self.accepted_blocks.iter().any(|block| {
                    block
                        .transactions
                        .iter()
                        .any(|known| known.from == transaction.from && known.nonce == transaction.nonce)
                })
        });
        self.rebuild_mempool_index();

        let mut template_transactions = Vec::new();
        for tx_id in &self.active_template.as_public().transaction_ids {
            let Some(transaction) = self
                .mempool_by_id
                .get(tx_id)
                .cloned()
                .and_then(RuntimeTransaction::into_account)
            else {
                let miner_addr = self.miner_address.clone();
                self.active_template = Self::build_template(
                    node_id,
                    core,
                    self.height,
                    self.tip_hash,
                    self.next_template_id.saturating_sub(1),
                    &self.mempool,
                    &self.accepted_blocks,
                    &miner_addr,
                );
                return Ok(());
            };
            template_transactions.push(RuntimeTransaction::from(transaction));
        }

        self.active_template.transactions = template_transactions;
        self.active_template.total_fees_zion = self
            .active_template
            .transactions
            .iter()
            .filter_map(|transaction| transaction.as_account().map(|transaction| transaction.fee_zion))
            .sum();

        if self.active_template.height != self.height.saturating_add(1) {
            let miner_addr = self.miner_address.clone();
            self.active_template = Self::build_template(
                node_id,
                core,
                self.height,
                self.tip_hash,
                self.next_template_id.saturating_sub(1),
                &self.mempool,
                &self.accepted_blocks,
                &miner_addr,
            );
        }

        Ok(())
    }

    fn snapshot(&self) -> ChainStateSnapshot {
        ChainStateSnapshot {
            height: self.height,
            tip_hash_hex: hex(&self.tip_hash),
            next_template_id: self.next_template_id,
            active_template: self.active_template.as_public(),
            accepted_blocks: self.accepted_blocks.clone(),
            mempool: self.account_mempool_transactions(),
        }
    }

    fn build_template(
        node_id: &str,
        _core: &CoreRuntime,
        current_height: u64,
        previous_hash: [u8; 32],
        template_id: u64,
        mempool: &[RuntimeTransaction],
        accepted_blocks: &[AcceptedBlock],
        miner_address: &str,
    ) -> TemplateState {
        let next_height = current_height.saturating_add(1);
        let mut selected_transactions = select_template_transactions(mempool);
        let total_fees_zion: u64 = selected_transactions.iter().map(|transaction| transaction.fee_zion).sum();

        // Phase 14: Generate coinbase transaction when miner_address is configured.
        if !miner_address.is_empty() {
            let subsidy = emission::block_subsidy(next_height);
            let coinbase_label = format!("coinbase:{}:{}", next_height, miner_address);
            let coinbase_hash =
                cosmic_harmony_ekam_deeksha(coinbase_label.as_bytes(), next_height);
            let coinbase_tx = Transaction {
                tx_id: hex(&coinbase_hash.data),
                from: "coinbase".to_string(),
                to: miner_address.to_string(),
                amount_zion: subsidy,
                fee_zion: 0,
                nonce: next_height,
            };
            selected_transactions.insert(0, coinbase_tx);
        }

        let transactions = selected_transactions
            .iter()
            .cloned()
            .map(RuntimeTransaction::from)
            .collect::<Vec<_>>();

        let merkle_root = derive_template_merkle_root(
            node_id,
            next_height,
            template_id,
            previous_hash,
            &selected_transactions,
        );

        let next_difficulty = if accepted_blocks.is_empty() {
            difficulty::GENESIS_DIFFICULTY
        } else {
            let start = accepted_blocks.len().saturating_sub(difficulty::LWMA_WINDOW + 1);
            let window: Vec<difficulty::BlockInfo> = accepted_blocks[start..]
                .iter()
                .map(|b| difficulty::BlockInfo {
                    timestamp: b.timestamp,
                    difficulty: b.difficulty,
                })
                .collect();
            difficulty::lwma_next_difficulty(&window)
        };
        let target = difficulty::difficulty_to_target(next_difficulty);
        let bits = difficulty::target_to_compact(&target);

        TemplateState {
            template_id,
            height: next_height,
            header: MiningHeader {
                version: 3,
                previous_hash,
                merkle_root,
                timestamp: now_secs(),
                difficulty_bits: bits,
            },
            target,
            difficulty: next_difficulty,
            reward_zion: emission::block_subsidy(next_height),
            transactions,
            total_fees_zion,
        }
    }
}

impl ChainStore {
    fn load_snapshot(&self) -> Result<Option<ChainStateSnapshot>, String> {
        if !self.path.exists() {
            return Ok(None);
        }

        let raw = fs::read_to_string(&self.path)
            .map_err(|error| format!("failed to read chain state {}: {error}", self.path.display()))?;
        let snapshot = serde_json::from_str::<ChainStateSnapshot>(&raw).map_err(|error| {
            format!(
                "failed to decode chain state {}: {error}",
                self.path.display()
            )
        })?;
        Ok(Some(snapshot))
    }

    fn journal_exists(&self) -> bool {
        journal_path(&self.path).exists()
    }

    fn load_journal_entries(&self) -> Result<Vec<ChainJournalEntry>, String> {
        let path = journal_path(&self.path);
        if !path.exists() {
            return Ok(Vec::new());
        }

        let raw = fs::read_to_string(&path)
            .map_err(|error| format!("failed to read chain journal {}: {error}", path.display()))?;
        let mut entries = Vec::new();
        for (index, line) in raw.lines().enumerate() {
            if line.trim().is_empty() {
                continue;
            }
            let entry = serde_json::from_str::<ChainJournalEntry>(line).map_err(|error| {
                format!(
                    "failed to decode chain journal {} at line {}: {error}",
                    path.display(),
                    index + 1
                )
            })?;
            entries.push(entry);
        }
        Ok(entries)
    }

    fn append_journal_entry(&self, entry: &ChainJournalEntry) -> Result<(), String> {
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent).map_err(|error| {
                format!("failed to create chain state dir {}: {error}", parent.display())
            })?;
        }
        let path = journal_path(&self.path);
        let line = encode_json_line(entry)
            .map_err(|error| format!("failed to encode chain journal entry {}: {error}", path.display()))?;
        use std::io::Write as _;
        let mut file = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&path)
            .map_err(|error| format!("failed to open chain journal {}: {error}", path.display()))?;
        file.write_all(line.as_bytes())
            .map_err(|error| format!("failed to append chain journal {}: {error}", path.display()))?;
        file.flush()
            .map_err(|error| format!("failed to flush chain journal {}: {error}", path.display()))?;
        Ok(())
    }

    fn clear_journal(&self) -> Result<(), String> {
        let path = journal_path(&self.path);
        if path.exists() {
            fs::remove_file(&path)
                .map_err(|error| format!("failed to remove chain journal {}: {error}", path.display()))?;
        }
        Ok(())
    }

    fn replay_journal(
        &self,
        node_id: &str,
        core: &CoreRuntime,
        chain_state: &mut ChainState,
    ) -> Result<(), String> {
        for entry in self.load_journal_entries()? {
            chain_state.apply_journal_entry(node_id, core, entry)?;
        }
        Ok(())
    }

    fn save_snapshot(&self, snapshot: &ChainStateSnapshot) -> Result<(), String> {
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent).map_err(|error| {
                format!("failed to create chain state dir {}: {error}", parent.display())
            })?;
        }

        let encoded = serde_json::to_string_pretty(snapshot).map_err(|error| {
            format!(
                "failed to encode chain state {}: {error}",
                self.path.display()
            )
        })?;
        let temp_path = snapshot_temp_path(&self.path);
        fs::write(&temp_path, encoded).map_err(|error| {
            format!("failed to write temp chain state {}: {error}", temp_path.display())
        })?;
        fs::rename(&temp_path, &self.path).map_err(|error| {
            format!(
                "failed to move chain state {} into place: {error}",
                self.path.display()
            )
        })?;
        Ok(())
    }
}

fn encode_json_line<T: Serialize>(message: &T) -> Result<String, serde_json::Error> {
    let mut line = serde_json::to_string(message)?;
    line.push('\n');
    Ok(line)
}

fn dedup_peers(peers: Vec<PeerEndpoint>) -> Vec<PeerEndpoint> {
    let mut seen = HashSet::new();
    let mut deduped = Vec::new();
    for peer in peers {
        if seen.insert(peer.address()) {
            deduped.push(peer);
        }
    }
    deduped
}

fn derive_template_merkle_root(
    node_id: &str,
    height: u64,
    template_id: u64,
    previous_hash: [u8; 32],
    transactions: &[Transaction],
) -> [u8; 32] {
    let mut seed = [0u8; HEADER_SIZE];
    seed[0..32].copy_from_slice(&previous_hash);
    seed[32..40].copy_from_slice(&height.to_le_bytes());
    seed[40..48].copy_from_slice(&template_id.to_le_bytes());
    let node_bytes = node_id.as_bytes();
    let copy_len = node_bytes.len().min(HEADER_SIZE - 48);
    seed[48..48 + copy_len].copy_from_slice(&node_bytes[..copy_len]);
    for transaction in transactions {
        let tx_hash = cosmic_harmony_ekam_deeksha(
            transaction.tx_id.as_bytes(),
            transaction.nonce ^ transaction.fee_zion ^ transaction.amount_zion,
        )
        .data;
        for (slot, value) in seed.iter_mut().zip(tx_hash.iter().cycle()) {
            *slot ^= *value;
        }
    }
    cosmic_harmony_ekam_deeksha(&seed, template_id ^ height ^ transactions.len() as u64).data
}

fn select_template_transactions(mempool: &[RuntimeTransaction]) -> Vec<Transaction> {
    let mut selected: Vec<Transaction> = mempool
        .iter()
        .filter_map(|transaction| transaction.as_account().cloned())
        .collect();
    selected.sort_by(|left, right| {
        right
            .fee_zion
            .cmp(&left.fee_zion)
            .then(left.nonce.cmp(&right.nonce))
            .then(left.tx_id.cmp(&right.tx_id))
    });
    selected.truncate(MAX_TEMPLATE_TRANSACTIONS);
    selected
}

fn body_hash_hex(transactions: &[Transaction]) -> String {
    let hash = derive_block_body_hash(transactions);
    hex(&hash)
}

fn derive_block_body_hash(transactions: &[Transaction]) -> [u8; 32] {
    let mut seed = [0u8; HEADER_SIZE];
    seed[0..8].copy_from_slice(&(transactions.len() as u64).to_le_bytes());
    for transaction in transactions {
        let tx_hash = cosmic_harmony_ekam_deeksha(
            transaction.tx_id.as_bytes(),
            transaction.nonce ^ transaction.amount_zion ^ transaction.fee_zion,
        )
        .data;
        for (slot, value) in seed.iter_mut().zip(tx_hash.iter().cycle()) {
            *slot ^= *value;
        }
    }
    cosmic_harmony_ekam_deeksha(&seed, transactions.len() as u64).data
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn snapshot_temp_path(path: &Path) -> PathBuf {
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("chain-state.json");
    path.with_file_name(format!("{file_name}.tmp"))
}

fn journal_path(path: &Path) -> PathBuf {
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("chain-state.json");
    path.with_file_name(format!("{file_name}.journal"))
}

fn is_valid_account_id(value: &str) -> bool {
    let len = value.len();
    (3..=64).contains(&len)
        && value
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.'))
}

fn looks_like_utxo_address(value: &str) -> bool {
    value.starts_with("zion1")
}

fn parse_fixed_hex<const N: usize>(raw: &str, label: &str) -> Result<[u8; N], String> {
    let normalized = raw.trim().trim_start_matches("0x");
    if normalized.len() != N * 2 {
        return Err(format!("{label} must be exactly {} hex chars", N * 2));
    }

    let mut bytes = [0u8; N];
    for (index, chunk) in normalized.as_bytes().chunks(2).enumerate() {
        let pair = std::str::from_utf8(chunk)
            .map_err(|_| format!("{label} contains non-utf8 hex"))?;
        bytes[index] =
            u8::from_str_radix(pair, 16).map_err(|_| format!("invalid hex byte '{pair}' in {label}"))?;
    }
    Ok(bytes)
}

pub(crate) fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{:02x}", byte)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use zion_cosmic_harmony::{generate_ekam_test_vector, EKAM_CANONICAL_TEST_VECTOR_HEX};

    fn sample_header() -> MiningHeader {
        MiningHeader {
            version: 3,
            previous_hash: [0x11; 32],
            merkle_root: [0x22; 32],
            timestamp: 1_762_000_000,
            difficulty_bits: 0x1f00ffff,
        }
    }

    fn sample_transaction(tx_id: &str, fee_zion: u64, nonce: u64) -> Transaction {
        let mut tx_hex = tx_id
            .as_bytes()
            .iter()
            .map(|byte| format!("{:02x}", byte))
            .collect::<String>();
        while tx_hex.len() < 64 {
            tx_hex.push('0');
        }
        tx_hex.truncate(64);
        Transaction {
            tx_id: tx_hex,
            from: "wallet.alpha".to_string(),
            to: "wallet.beta".to_string(),
            amount_zion: 25,
            fee_zion,
            nonce,
        }
    }

    #[test]
    fn core_uses_canonical_profile() {
        assert_eq!(consensus_profile(), "cosmic_harmony_ekam_deeksha");
    }

    #[test]
    fn mining_header_serializes_to_80_bytes() {
        let bytes = sample_header().to_bytes();
        assert_eq!(bytes.len(), HEADER_SIZE);
        assert_eq!(&bytes[0..4], &3u32.to_le_bytes());
    }

    #[test]
    fn mining_header_roundtrip_from_bytes() {
        let header = sample_header();
        assert_eq!(MiningHeader::from_bytes(header.to_bytes()), header);
    }

    #[test]
    fn runtime_hashes_candidate_with_ekam() {
        let runtime = CoreRuntime::default();
        let candidate = BlockCandidate {
            header: sample_header(),
            nonce: 42,
        };

        let direct = cosmic_harmony_ekam_deeksha(&candidate.header.to_bytes(), candidate.nonce);
        assert_eq!(runtime.hash_candidate(candidate), direct.data);
    }

    #[test]
    fn runtime_validates_target() {
        let runtime = CoreRuntime::default();
        let candidate = BlockCandidate {
            header: sample_header(),
            nonce: 7,
        };

        let sealed = runtime
            .validate_candidate(candidate, DifficultyTarget::MAX)
            .expect("max target should accept any hash");
        assert_eq!(sealed.hash, candidate.hash());
    }

    #[test]
    fn runtime_tracks_revenue() {
        let runtime = CoreRuntime::default();
        runtime.record_revenue(RevenueSource::ProfitSwitch, 100.0, true);

        let snapshot = runtime.revenue_snapshot();
        assert_eq!(snapshot.total_earnings_usd, 100.0);
        assert!((snapshot.zion_fees_usd - 2.0).abs() < 0.001);
    }

    #[test]
    fn canonical_vector_is_exposed_from_consensus_crate() {
        assert_eq!(generate_ekam_test_vector(), EKAM_CANONICAL_TEST_VECTOR_HEX);
    }

    #[test]
    fn node_config_mainnet_defaults_are_stable() {
        let config = NodeConfig::mainnet();
        assert_eq!(config.network, NetworkId::Mainnet);
        assert_eq!(config.p2p_bind.address(), "0.0.0.0:8334");
        assert_eq!(config.seed_peers[0].address(), "91.98.122.165:8334");
    }

    #[test]
    fn runtime_scans_nonce_range() {
        let runtime = CoreRuntime::default();
        let job = MiningJob {
            job_id: 1,
            header: sample_header(),
            target: DifficultyTarget::MAX,
            start_nonce: 100,
            nonce_count: 8,
        };

        let solution = runtime.scan_nonce_range(job).expect("max target must find a solution");
        assert_eq!(solution.job_id, 1);
        assert_eq!(solution.candidate.nonce, 100);
        assert_eq!(solution.hash, solution.candidate.hash());
    }

    #[test]
    fn runtime_validates_job_bound_solution() {
        let runtime = CoreRuntime::default();
        let job = MiningJob {
            job_id: 7,
            header: sample_header(),
            target: DifficultyTarget::MAX,
            start_nonce: 55,
            nonce_count: 4,
        };

        let solution = runtime.scan_nonce_range(job).expect("solution should exist");
        let sealed = runtime
            .validate_solution(job, solution)
            .expect("matching job solution must validate");
        assert_eq!(sealed.nonce, 55);
    }

    #[test]
    fn p2p_message_roundtrip_is_stable() {
        let status = NodeRuntime::new("node-a", NodeConfig::mainnet()).status();
        let message = P2pMessage::Status { status };
        let encoded = encode_p2p_message(&message).expect("encode p2p");
        let decoded = decode_p2p_message(&encoded).expect("decode p2p");
        assert_eq!(decoded, message);
    }

    /// Scan nonces to find one that meets the template target.
    fn find_valid_nonce(template: &BlockTemplate) -> u64 {
        let header = MiningHeader::from_bytes(
            parse_fixed_hex::<HEADER_SIZE>(&template.header_hex, "test header").unwrap(),
        );
        let target = DifficultyTarget::from_hex(&template.target_hex).unwrap();
        for nonce in 0..10_000_000 {
            let candidate = BlockCandidate { header, nonce };
            if target.allows(&candidate.hash()) {
                return nonce;
            }
        }
        panic!("no valid nonce found in 10M attempts");
    }

    #[test]
    fn rpc_submit_candidate_accepts_active_template() {
        let mut runtime = NodeRuntime::new("node-rpc", NodeConfig::mainnet());
        let template = runtime.active_template();
        let nonce = find_valid_nonce(&template);
        let header = MiningHeader::from_bytes(
            parse_fixed_hex::<HEADER_SIZE>(&template.header_hex, "template header")
                .expect("template header bytes"),
        );
        let candidate = BlockCandidate { header, nonce };

        let response = runtime.handle_rpc_request(RpcRequest::SubmitCandidate {
            template_id: template.template_id,
            header_hex: template.header_hex.clone(),
            nonce,
            target_hex: template.target_hex.clone(),
        });

        match response {
            RpcResponse::SubmitResult {
                accepted,
                template_id,
                block_height,
                hash_hex,
                reason,
            } => {
                assert!(accepted);
                assert_eq!(template_id, template.template_id);
                assert_eq!(block_height, Some(1));
                assert_eq!(hash_hex, hex(&candidate.hash()));
                assert_eq!(reason, None);
            }
            other => panic!("unexpected rpc response: {other:?}"),
        }
    }

    #[test]
    fn rpc_get_template_returns_active_template() {
        let mut runtime = NodeRuntime::new("node-template", NodeConfig::mainnet());
        let expected = runtime.active_template();
        let response = runtime.handle_rpc_request(RpcRequest::GetTemplate);

        match response {
            RpcResponse::Template { template } => assert_eq!(template, expected),
            other => panic!("unexpected template response: {other:?}"),
        }
    }

    #[test]
    fn rpc_submit_transaction_updates_mempool_and_template() {
        let mut runtime = NodeRuntime::new("node-mempool", NodeConfig::mainnet());
        let transaction = sample_transaction("tx-a", 9, 1);
        let response = runtime.handle_rpc_request(RpcRequest::SubmitTransaction {
            transaction: transaction.clone(),
        });

        assert!(matches!(
            response,
            RpcResponse::TransactionResult {
                accepted: true,
                reason: None,
                ..
            }
        ));
        assert!(matches!(
            runtime.chain_state.mempool.as_slice(),
            [RuntimeTransaction::Account(stored)] if stored.tx_id == transaction.tx_id
        ));

        match runtime.handle_rpc_request(RpcRequest::GetMempool) {
            RpcResponse::Mempool { transactions } => {
                assert_eq!(transactions.len(), 1);
                assert_eq!(transactions[0].tx_id, transaction.tx_id);
            }
            other => panic!("unexpected mempool response: {other:?}"),
        }

        let template = runtime.active_template();
        assert_eq!(template.transaction_count, 1);
        assert_eq!(template.transaction_ids, vec![transaction.tx_id]);
        assert_eq!(template.total_fees_zion, 9);
        assert_eq!(template.body_hash_hex, body_hash_hex(&[sample_transaction("tx-a", 9, 1)]));
        assert_eq!(template.estimated_miner_reward_zion, emission::block_subsidy(1));

        let status = runtime.status();
        assert_eq!(status.mempool_transactions, 1);
        assert_eq!(status.active_template_transactions, 1);
        assert_eq!(status.active_template_total_fees_zion, 9);
    }

    #[test]
    fn transaction_validation_rejects_bad_ids_and_sender_nonce_reuse() {
        let mut runtime = NodeRuntime::new("node-validate", NodeConfig::mainnet());

        let invalid = runtime.handle_rpc_request(RpcRequest::SubmitTransaction {
            transaction: Transaction {
                tx_id: "bad-id".to_string(),
                from: "wallet.alpha".to_string(),
                to: "wallet.beta".to_string(),
                amount_zion: 10,
                fee_zion: 1,
                nonce: 1,
            },
        });
        assert!(matches!(
            invalid,
            RpcResponse::TransactionResult {
                accepted: false,
                reason: Some(ref reason),
                ..
            } if reason.contains("64 hex chars")
        ));

        let utxo_like_endpoints = runtime.handle_rpc_request(RpcRequest::SubmitTransaction {
            transaction: Transaction {
                tx_id: sample_transaction("tx-utxo-like", 3, 1).tx_id,
                from: "zion1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq".to_string(),
                to: "wallet.beta".to_string(),
                amount_zion: 10,
                fee_zion: 1,
                nonce: 2,
            },
        });
        assert!(matches!(
            utxo_like_endpoints,
            RpcResponse::TransactionResult {
                accepted: false,
                reason: Some(ref reason),
                ..
            } if reason.contains("zion1") || reason.contains("UTXO")
        ));

        let first = sample_transaction("tx-nonce-a", 2, 9);
        let reused_nonce = Transaction {
            tx_id: sample_transaction("tx-nonce-b", 4, 9).tx_id,
            from: first.from.clone(),
            to: first.to.clone(),
            amount_zion: 22,
            fee_zion: 4,
            nonce: first.nonce,
        };
        assert!(matches!(
            runtime.handle_rpc_request(RpcRequest::SubmitTransaction {
                transaction: first.clone()
            }),
            RpcResponse::TransactionResult { accepted: true, .. }
        ));
        assert!(matches!(
            runtime.handle_rpc_request(RpcRequest::SubmitTransaction {
                transaction: reused_nonce
            }),
            RpcResponse::TransactionResult {
                accepted: false,
                reason: Some(ref reason),
                ..
            } if reason.contains("already pending")
        ));
    }

    #[test]
    fn template_prioritizes_high_fee_transactions() {
        let mut runtime = NodeRuntime::new("node-priority", NodeConfig::mainnet());
        let tx_low = sample_transaction("tx-low", 1, 2);
        let tx_high = sample_transaction("tx-high", 7, 1);
        let _ = runtime.handle_rpc_request(RpcRequest::SubmitTransaction {
            transaction: tx_low.clone(),
        });
        let _ = runtime.handle_rpc_request(RpcRequest::SubmitTransaction {
            transaction: tx_high.clone(),
        });

        let template = runtime.active_template();
        assert_eq!(template.transaction_ids, vec![tx_high.tx_id, tx_low.tx_id]);
        assert_eq!(template.total_fees_zion, 8);
    }

    #[test]
    fn accepted_submission_rotates_template_and_updates_tip() {
        let mut runtime = NodeRuntime::new("node-rotate", NodeConfig::mainnet());
        let mined_transaction = sample_transaction("tx-mined", 3, 1);
        let _ = runtime.handle_rpc_request(RpcRequest::SubmitTransaction {
            transaction: mined_transaction.clone(),
        });
        let first_template = runtime.active_template();
        assert_eq!(first_template.transaction_ids, vec![mined_transaction.tx_id.clone()]);
        let nonce = find_valid_nonce(&first_template);

        let response = runtime.handle_rpc_request(RpcRequest::SubmitCandidate {
            template_id: first_template.template_id,
            header_hex: first_template.header_hex.clone(),
            nonce,
            target_hex: first_template.target_hex.clone(),
        });

        assert!(matches!(response, RpcResponse::SubmitResult { accepted: true, .. }));
        assert_eq!(runtime.status().chain_height, 1);
        assert_eq!(runtime.accepted_blocks().len(), 2); // genesis + mined
        assert_ne!(runtime.active_template().template_id, first_template.template_id);
        assert_eq!(runtime.active_template().height, 2);
        assert!(runtime.active_template().transaction_ids.is_empty());
        assert_eq!(runtime.accepted_blocks()[1].transaction_ids, vec![mined_transaction.tx_id]);
        assert_eq!(runtime.accepted_blocks()[1].subsidy_zion, emission::block_subsidy(1));
        assert_eq!(runtime.accepted_blocks()[1].miner_reward_zion, emission::block_subsidy(1));
    }

    #[test]
    fn stale_template_submission_is_rejected() {
        let mut runtime = NodeRuntime::new("node-stale", NodeConfig::mainnet());
        let template = runtime.active_template();
        let nonce = find_valid_nonce(&template);
        let _ = runtime.handle_rpc_request(RpcRequest::SubmitCandidate {
            template_id: template.template_id,
            header_hex: template.header_hex.clone(),
            nonce,
            target_hex: template.target_hex.clone(),
        });

        let stale_response = runtime.handle_rpc_request(RpcRequest::SubmitCandidate {
            template_id: template.template_id,
            header_hex: template.header_hex,
            nonce: 19,
            target_hex: template.target_hex,
        });

        match stale_response {
            RpcResponse::SubmitResult {
                accepted,
                reason,
                ..
            } => {
                assert!(!accepted);
                assert!(reason.expect("stale reason").contains("stale template"));
            }
            other => panic!("unexpected stale response: {other:?}"),
        }
    }

    #[test]
    fn node_runtime_registers_peer_on_hello() {
        let mut runtime = NodeRuntime::new("node-core", NodeConfig::mainnet());

        let response = runtime
            .handle_p2p_message(P2pMessage::Hello {
                node_id: "peer-1".to_string(),
                protocol_version: node_protocol_version().to_string(),
                network: NetworkId::Mainnet,
                listen_addr: "10.0.0.9:9334".to_string(),
            })
            .expect("hello response");

        assert!(runtime
            .known_peers()
            .iter()
            .any(|peer| peer.address() == "10.0.0.9:9334"));
        assert!(matches!(response, P2pMessage::Welcome { .. }));
    }

    #[test]
    fn register_peer_ignores_own_bind_address() {
        let mut runtime = NodeRuntime::new("node-self", NodeConfig::mainnet());
        let before = runtime.known_peers().len();

        runtime.register_peer(runtime.config().p2p_bind.clone());

        assert_eq!(runtime.known_peers().len(), before);
        assert_eq!(
            runtime
                .known_peers()
                .iter()
                .filter(|peer| peer.address() == runtime.config().p2p_bind.address())
                .count(),
            0
        );
    }

    #[test]
    fn p2p_get_blocks_since_returns_accepted_blocks() {
        let mut runtime = NodeRuntime::new("node-sync-source", NodeConfig::mainnet());
        let first_tx = sample_transaction("tx-sync-1", 2, 1);
        let _ = runtime.handle_rpc_request(RpcRequest::SubmitTransaction {
            transaction: first_tx.clone(),
        });
        let first_template = runtime.active_template();
        let nonce1 = find_valid_nonce(&first_template);
        let _ = runtime.handle_rpc_request(RpcRequest::SubmitCandidate {
            template_id: first_template.template_id,
            header_hex: first_template.header_hex,
            nonce: nonce1,
            target_hex: first_template.target_hex,
        });

        let second_template = runtime.active_template();
        let nonce2 = find_valid_nonce(&second_template);
        let _ = runtime.handle_rpc_request(RpcRequest::SubmitCandidate {
            template_id: second_template.template_id,
            header_hex: second_template.header_hex,
            nonce: nonce2,
            target_hex: second_template.target_hex,
        });

        let response = runtime
            .handle_p2p_message(P2pMessage::GetBlocksSince {
                from_height: 0,
                limit: 8,
            })
            .expect("blocks since response");

        match response {
            P2pMessage::Blocks { blocks } => {
                assert_eq!(blocks.len(), 2);
                assert_eq!(blocks[0].height, 1);
                assert_eq!(blocks[0].transaction_ids, vec![first_tx.tx_id]);
                assert_eq!(blocks[1].height, 2);
            }
            other => panic!("unexpected blocks response: {other:?}"),
        }
    }

    #[test]
    fn p2p_announce_block_imports_contiguous_peer_block() {
        let mut source = NodeRuntime::new("node-source", NodeConfig::mainnet());
        let propagated_tx = sample_transaction("tx-peer-import", 4, 1);
        let _ = source.handle_rpc_request(RpcRequest::SubmitTransaction {
            transaction: propagated_tx,
        });
        let template = source.active_template();
        let nonce = find_valid_nonce(&template);
        let _ = source.handle_rpc_request(RpcRequest::SubmitCandidate {
            template_id: template.template_id,
            header_hex: template.header_hex,
            nonce,
            target_hex: template.target_hex,
        });

        let block = source.accepted_blocks()[1].clone(); // skip genesis
        let mut target = NodeRuntime::new("node-target", NodeConfig::mainnet());
        let response = target
            .handle_p2p_message(P2pMessage::AnnounceBlock { block: block.clone() })
            .expect("announce block response");

        match response {
            P2pMessage::Status { status } => {
                assert_eq!(status.chain_height, 1);
                assert_eq!(status.accepted_blocks, 2); // genesis + imported
            }
            other => panic!("unexpected announce response: {other:?}"),
        }
        assert_eq!(target.accepted_blocks()[1], block);
        assert_eq!(target.active_template().height, 2);
    }

    #[test]
    fn p2p_announce_block_rejects_conflicting_height() {
        let mut left = NodeRuntime::new("node-left", NodeConfig::mainnet());
        let left_template = left.active_template();
        let left_nonce = find_valid_nonce(&left_template);
        let _ = left.handle_rpc_request(RpcRequest::SubmitCandidate {
            template_id: left_template.template_id,
            header_hex: left_template.header_hex,
            nonce: left_nonce,
            target_hex: left_template.target_hex,
        });

        let mut right = NodeRuntime::new("node-right", NodeConfig::mainnet());
        let right_template = right.active_template();
        let right_nonce = find_valid_nonce(&right_template);
        let _ = right.handle_rpc_request(RpcRequest::SubmitCandidate {
            template_id: right_template.template_id,
            header_hex: right_template.header_hex,
            nonce: right_nonce,
            target_hex: right_template.target_hex,
        });

        let error = right
            .handle_p2p_message(P2pMessage::AnnounceBlock {
                block: left.accepted_blocks()[1].clone(), // skip genesis
            })
            .expect_err("conflicting height should fail");
        assert!(error.contains("conflicting peer block"));
    }

    #[test]
    fn import_peer_blocks_accepts_contiguous_batch() {
        let mut source = NodeRuntime::new("node-batch-source", NodeConfig::mainnet());
        let first_tx = sample_transaction("tx-batch-1", 3, 1);
        let second_tx = sample_transaction("tx-batch-2", 5, 2);
        let _ = source.handle_rpc_request(RpcRequest::SubmitTransaction {
            transaction: first_tx.clone(),
        });
        let first_template = source.active_template();
        let nonce1 = find_valid_nonce(&first_template);
        let _ = source.handle_rpc_request(RpcRequest::SubmitCandidate {
            template_id: first_template.template_id,
            header_hex: first_template.header_hex,
            nonce: nonce1,
            target_hex: first_template.target_hex,
        });
        let _ = source.handle_rpc_request(RpcRequest::SubmitTransaction {
            transaction: second_tx.clone(),
        });
        let second_template = source.active_template();
        let nonce2 = find_valid_nonce(&second_template);
        let _ = source.handle_rpc_request(RpcRequest::SubmitCandidate {
            template_id: second_template.template_id,
            header_hex: second_template.header_hex,
            nonce: nonce2,
            target_hex: second_template.target_hex,
        });

        let mut target = NodeRuntime::new("node-batch-target", NodeConfig::mainnet());
        let imported = target
            .import_peer_blocks(source.accepted_blocks().to_vec())
            .expect("batch import should succeed");

        assert_eq!(imported, 2); // genesis skipped, 2 new blocks imported
        assert_eq!(target.chain_height(), 2);
        assert_eq!(target.accepted_blocks().len(), 3); // genesis + 2
        assert_eq!(target.accepted_blocks()[1].transaction_ids, vec![first_tx.tx_id]);
        assert_eq!(target.accepted_blocks()[2].transaction_ids, vec![second_tx.tx_id]);
        assert_eq!(target.active_template().height, 3);
    }

    #[test]
    fn import_peer_blocks_rejects_non_contiguous_batch() {
        let mut source = NodeRuntime::new("node-gap-source", NodeConfig::mainnet());
        let first_template = source.active_template();
        let nonce1 = find_valid_nonce(&first_template);
        let _ = source.handle_rpc_request(RpcRequest::SubmitCandidate {
            template_id: first_template.template_id,
            header_hex: first_template.header_hex,
            nonce: nonce1,
            target_hex: first_template.target_hex,
        });
        let second_template = source.active_template();
        let nonce2 = find_valid_nonce(&second_template);
        let _ = source.handle_rpc_request(RpcRequest::SubmitCandidate {
            template_id: second_template.template_id,
            header_hex: second_template.header_hex,
            nonce: nonce2,
            target_hex: second_template.target_hex,
        });

        let mut target = NodeRuntime::new("node-gap-target", NodeConfig::mainnet());
        let error = target
            .import_peer_blocks(vec![source.accepted_blocks()[2].clone()]) // height 2, skip 1
            .expect_err("non-contiguous batch should fail");

        assert!(error.contains("not contiguous"));
        assert_eq!(target.accepted_blocks().len(), 1); // only genesis
        assert_eq!(target.chain_height(), 0);
    }

    #[test]
    fn accepted_block_indexes_are_available_after_submit() {
        let mut runtime = NodeRuntime::new("node-index", NodeConfig::mainnet());
        let template = runtime.active_template();
        let nonce = find_valid_nonce(&template);

        let response = runtime.handle_rpc_request(RpcRequest::SubmitCandidate {
            template_id: template.template_id,
            header_hex: template.header_hex,
            nonce,
            target_hex: template.target_hex,
        });

        assert!(matches!(response, RpcResponse::SubmitResult { accepted: true, .. }));
        let by_height = runtime
            .accepted_block_by_height(1)
            .expect("accepted block should be indexed by height");
        let by_template = runtime
            .accepted_block_by_template_id(template.template_id)
            .expect("accepted block should be indexed by template id");
        assert_eq!(by_height, by_template);
        assert_eq!(by_height.height, 1);
        assert_eq!(by_height.template_id, template.template_id);
    }

    #[test]
    fn node_runtime_persists_and_restores_chain_state() {
        let state_path = std::env::temp_dir().join(format!(
            "zion-v3-core-state-{}-{}.json",
            std::process::id(),
            now_secs()
        ));
        let mut runtime = NodeRuntime::with_chain_store(
            "node-persist",
            NodeConfig::mainnet(),
            &state_path,
        )
        .expect("runtime with chain store");
        let persisted_transaction = sample_transaction("tx-persist", 5, 1);
        let _ = runtime.handle_rpc_request(RpcRequest::SubmitTransaction {
            transaction: persisted_transaction.clone(),
        });
        let template = runtime.active_template();
        let nonce = find_valid_nonce(&template);

        let response = runtime.handle_rpc_request(RpcRequest::SubmitCandidate {
            template_id: template.template_id,
            header_hex: template.header_hex,
            nonce,
            target_hex: template.target_hex,
        });
        assert!(matches!(response, RpcResponse::SubmitResult { accepted: true, .. }));

        let mut restored = NodeRuntime::with_chain_store(
            "node-persist",
            NodeConfig::mainnet(),
            &state_path,
        )
        .expect("restored runtime with chain store");

        assert_eq!(restored.status().chain_height, 1);
        assert_eq!(restored.accepted_blocks().len(), 2); // genesis + 1
        assert!(restored.accepted_block_by_height(1).is_some());
        assert!(restored.accepted_block_by_template_id(template.template_id).is_some());
        assert_eq!(restored.accepted_blocks()[1].transaction_ids, vec![persisted_transaction.tx_id]);
        assert!(matches!(
            restored.handle_rpc_request(RpcRequest::GetMempool),
            RpcResponse::Mempool { ref transactions } if transactions.is_empty()
        ));

        fs::remove_file(&state_path).ok();
    }

    #[test]
    fn restored_state_sanitizes_duplicate_and_mined_mempool_entries() {
        let state_path = std::env::temp_dir().join(format!(
            "zion-v3-core-recovery-{}-{}.json",
            std::process::id(),
            now_secs()
        ));
        let tx_dup = sample_transaction("tx-dup", 6, 1);
        let tx_mined = sample_transaction("tx-mined", 2, 2);
        let snapshot = ChainStateSnapshot {
            height: 1,
            tip_hash_hex: hex(&[0x44; 32]),
            next_template_id: 3,
            active_template: BlockTemplate {
                template_id: 2,
                height: 2,
                header_hex: hex(&sample_header().to_bytes()),
                target_hex: DifficultyTarget::MAX.to_hex(),
                reward_zion: emission::block_subsidy(2),
                transaction_ids: vec![tx_dup.tx_id.clone(), tx_mined.tx_id.clone()],
                transaction_count: 2,
                total_fees_zion: 8,
                body_hash_hex: body_hash_hex(&[
                    tx_dup.clone(),
                    tx_mined.clone(),
                ]),
                estimated_miner_reward_zion: emission::block_subsidy(2),
            },
            accepted_blocks: vec![AcceptedBlock {
                template_id: 1,
                height: 1,
                timestamp: 1_700_000_000,
                difficulty: difficulty::GENESIS_DIFFICULTY,
                nonce: 77,
                hash_hex: hex(&[0x55; 32]),
                header_hex: String::new(),
                previous_hash_hex: String::new(),
                transaction_ids: vec![tx_mined.tx_id.clone()],
                transactions: vec![tx_mined.clone()],
                total_fees_zion: 2,
                body_hash_hex: body_hash_hex(&[tx_mined.clone()]),
                subsidy_zion: emission::block_subsidy(1),
                miner_reward_zion: emission::block_subsidy(1),
                miner_address: String::new(),
            }],
            mempool: vec![
                tx_dup.clone(),
                tx_dup.clone(),
                tx_mined.clone(),
            ],
        };
        fs::write(
            &state_path,
            serde_json::to_string_pretty(&snapshot).expect("encode recovery snapshot"),
        )
        .expect("write recovery snapshot");

        let restored = NodeRuntime::with_chain_store(
            "node-recovery",
            NodeConfig::mainnet(),
            &state_path,
        )
        .expect("restored runtime with sanitized state");

        match restored.active_template() {
            BlockTemplate {
                transaction_ids,
                transaction_count,
                ..
            } => {
                assert_eq!(transaction_ids, vec![tx_dup.tx_id]);
                assert_eq!(transaction_count, 1);
            }
        }

        fs::remove_file(&state_path).ok();
    }

    #[test]
    fn runtime_recovers_from_journal_when_snapshot_is_missing() {
        let state_path = std::env::temp_dir().join(format!(
            "zion-v3-core-journal-{}-{}.json",
            std::process::id(),
            now_secs()
        ));
        let tx = sample_transaction("tx-journal", 6, 1);
        let accepted_block = AcceptedBlock {
            template_id: 1,
            height: 1,
            timestamp: 1_700_000_060,
            difficulty: difficulty::GENESIS_DIFFICULTY,
            nonce: 42,
            hash_hex: hex(&[0x66; 32]),
            header_hex: String::new(),
            previous_hash_hex: String::new(),
            transaction_ids: vec![tx.tx_id.clone()],
            transactions: vec![tx.clone()],
            total_fees_zion: 6,
            body_hash_hex: body_hash_hex(&[tx.clone()]),
            subsidy_zion: emission::block_subsidy(1),
            miner_reward_zion: emission::block_subsidy(1),
            miner_address: String::new(),
        };
        let journal = [
            ChainJournalEntry::TransactionAccepted {
                transaction: RuntimeTransaction::from(tx.clone()),
            },
            ChainJournalEntry::BlockAccepted {
                block: accepted_block.clone(),
            },
        ];
        let journal_body = journal
            .iter()
            .map(|entry| encode_json_line(entry).expect("encode journal entry"))
            .collect::<String>();
        fs::write(journal_path(&state_path), journal_body).expect("write journal file");

        let restored = NodeRuntime::with_chain_store(
            "node-journal",
            NodeConfig::mainnet(),
            &state_path,
        )
        .expect("restore from journal");

        assert_eq!(restored.status().chain_height, 1);
        assert_eq!(restored.accepted_blocks().len(), 2); // genesis + journal block
        assert_eq!(restored.accepted_blocks()[1], accepted_block);
        assert!(restored.active_template().transaction_ids.is_empty());
        assert!(!journal_path(&state_path).exists());

        fs::remove_file(&state_path).ok();
    }

    #[test]
    fn peer_persistence_round_trip() {
        let dir = tempfile::tempdir().expect("tempdir");
        let state_path = dir.path().join("state.json");

        // Create runtime with chain store, add some peers
        let mut runtime = NodeRuntime::with_chain_store(
            "node-peers",
            NodeConfig::mainnet(),
            &state_path,
        )
        .expect("create runtime");

        // Register new peers beyond the seeds
        runtime.register_peer(PeerEndpoint::new("10.0.0.1", 8334));
        runtime.register_peer(PeerEndpoint::new("10.0.0.2", 8334));
        runtime.register_peer(PeerEndpoint::new("10.0.0.3", 8334));

        let saved_count = runtime.known_peers().len();
        runtime.persist_peers().expect("persist peers");

        // Verify peers.json was created
        let peers_path = dir.path().join("peers.json");
        assert!(peers_path.exists(), "peers.json should exist");

        // Create a new runtime from the same state path — peers should be loaded
        let restored = NodeRuntime::with_chain_store(
            "node-peers-2",
            NodeConfig::mainnet(),
            &state_path,
        )
        .expect("restore runtime");

        assert_eq!(restored.known_peers().len(), saved_count);
        assert!(
            restored.known_peers().iter().any(|p| p.address() == "10.0.0.1:8334"),
            "should contain persisted peer 10.0.0.1"
        );
        assert!(
            restored.known_peers().iter().any(|p| p.address() == "10.0.0.3:8334"),
            "should contain persisted peer 10.0.0.3"
        );
    }

    #[test]
    fn peer_persistence_no_state_path_is_noop() {
        let runtime = NodeRuntime::new("node-no-store", NodeConfig::mainnet());
        // Should succeed (no-op) without state path
        runtime.persist_peers().expect("persist should be no-op");
    }

    #[test]
    fn register_peers_deduplicates() {
        let mut runtime = NodeRuntime::new("node-dedup", NodeConfig::mainnet());
        let before = runtime.known_peers().len();

        runtime.register_peer(PeerEndpoint::new("192.168.1.1", 8334));
        assert_eq!(runtime.known_peers().len(), before + 1);

        // Duplicate should be ignored
        runtime.register_peer(PeerEndpoint::new("192.168.1.1", 8334));
        assert_eq!(runtime.known_peers().len(), before + 1);

        // Different port = different peer
        runtime.register_peer(PeerEndpoint::new("192.168.1.1", 9999));
        assert_eq!(runtime.known_peers().len(), before + 2);
    }

    #[test]
    fn get_peers_returns_known_list() {
        let mut runtime = NodeRuntime::new("node-getpeers", NodeConfig::mainnet());
        runtime.register_peer(PeerEndpoint::new("10.1.1.1", 8334));
        runtime.register_peer(PeerEndpoint::new("10.1.1.2", 8334));

        let response = runtime.handle_p2p_message(P2pMessage::GetPeers).unwrap();
        match response {
            P2pMessage::Peers { peers } => {
                assert!(peers.iter().any(|p| p.address() == "10.1.1.1:8334"));
                assert!(peers.iter().any(|p| p.address() == "10.1.1.2:8334"));
            }
            other => panic!("expected Peers, got {other:?}"),
        }
    }

    // ── Phase 12: Block Validation Hardening tests ─────────────────────

    /// Helper: mine a block on `source` and return its accepted blocks.
    fn mine_one_block(runtime: &mut NodeRuntime) {
        let template = runtime.active_template();
        let nonce = find_valid_nonce(&template);
        let response = runtime.handle_rpc_request(RpcRequest::SubmitCandidate {
            template_id: template.template_id,
            header_hex: template.header_hex.clone(),
            nonce,
            target_hex: template.target_hex.clone(),
        });
        assert!(
            matches!(response, RpcResponse::SubmitResult { accepted: true, .. }),
            "unexpected submit response: {response:?}"
        );
    }

    #[test]
    fn peer_block_has_header_hex_after_mining() {
        let mut runtime = NodeRuntime::new("node-hdr", NodeConfig::mainnet());
        mine_one_block(&mut runtime);
        let block = &runtime.accepted_blocks()[1];
        assert!(!block.header_hex.is_empty(), "mined block must have header_hex");
        assert_eq!(block.header_hex.len(), HEADER_SIZE * 2); // 80 bytes = 160 hex chars
    }

    #[test]
    fn peer_import_verifies_pow_via_header_hex() {
        let mut source = NodeRuntime::new("node-pow-src", NodeConfig::mainnet());
        mine_one_block(&mut source);

        // Import with valid header_hex should succeed
        let mut target = NodeRuntime::new("node-pow-tgt", NodeConfig::mainnet());
        let imported = target
            .import_peer_blocks(source.accepted_blocks().to_vec())
            .expect("import with valid PoW should succeed");
        assert_eq!(imported, 1);
    }

    #[test]
    fn peer_import_rejects_bad_pow_hash() {
        let mut source = NodeRuntime::new("node-badpow-src", NodeConfig::mainnet());
        mine_one_block(&mut source);

        let mut block = source.accepted_blocks()[1].clone();
        // Tamper with hash_hex while keeping header_hex intact
        block.hash_hex = hex(&[0xAA; 32]);

        let mut target = NodeRuntime::new("node-badpow-tgt", NodeConfig::mainnet());
        let err = target
            .import_peer_blocks(vec![block])
            .expect_err("tampered hash should be rejected");
        assert!(
            err.contains("PoW computation"),
            "expected PoW computation error, got: {err}"
        );
    }

    #[test]
    fn peer_import_rejects_bad_header_timestamp() {
        let mut source = NodeRuntime::new("node-badhdr-src", NodeConfig::mainnet());
        mine_one_block(&mut source);

        let mut block = source.accepted_blocks()[1].clone();
        // Tamper with header timestamp field (make it inconsistent with block.timestamp)
        let mut header_bytes = parse_fixed_hex::<HEADER_SIZE>(
            &block.header_hex,
            "test header",
        )
        .unwrap();
        // Overwrite timestamp bytes (offset 68..76) with a different value
        header_bytes[68..76].copy_from_slice(&(block.timestamp + 999).to_le_bytes());
        block.header_hex = hex(&header_bytes);

        let mut target = NodeRuntime::new("node-badhdr-tgt", NodeConfig::mainnet());
        let err = target
            .import_peer_blocks(vec![block])
            .expect_err("header with wrong timestamp should be rejected");
        assert!(
            err.contains("header timestamp"),
            "expected header timestamp error, got: {err}"
        );
    }

    #[test]
    fn peer_import_rejects_future_timestamp() {
        let mut source = NodeRuntime::new("node-future-src", NodeConfig::mainnet());
        mine_one_block(&mut source);

        let mut block = source.accepted_blocks()[1].clone();
        let far_future = now_secs() + validation::MAX_TIMESTAMP_DRIFT + 3_600;
        block.timestamp = far_future;
        // Rebuild header with the far-future timestamp so header consistency passes
        let mut header_bytes = parse_fixed_hex::<HEADER_SIZE>(
            &block.header_hex,
            "test header",
        )
        .unwrap();
        header_bytes[68..76].copy_from_slice(&far_future.to_le_bytes());
        let header = MiningHeader::from_bytes(header_bytes);
        // Re-mine to get a valid hash for the tampered header
        let target_val = difficulty::difficulty_to_target(block.difficulty);
        let mut found = false;
        for nonce in 0..10_000_000u64 {
            let candidate = BlockCandidate { header, nonce };
            let h = candidate.hash();
            if target_val.allows(&h) {
                block.nonce = nonce;
                block.hash_hex = hex(&h);
                block.header_hex = hex(&header.to_bytes());
                found = true;
                break;
            }
        }
        assert!(found, "should find valid nonce for tampered header");

        let mut target = NodeRuntime::new("node-future-tgt", NodeConfig::mainnet());
        let err = target
            .import_peer_blocks(vec![block])
            .expect_err("far-future timestamp should be rejected");
        assert!(
            err.contains("timestamp"),
            "expected timestamp error, got: {err}"
        );
    }

    #[test]
    fn peer_import_rejects_wrong_subsidy() {
        let mut source = NodeRuntime::new("node-subsidy-src", NodeConfig::mainnet());
        mine_one_block(&mut source);

        let mut block = source.accepted_blocks()[1].clone();
        block.subsidy_zion += 1; // inflate subsidy by 1

        let mut target = NodeRuntime::new("node-subsidy-tgt", NodeConfig::mainnet());
        let err = target
            .import_peer_blocks(vec![block])
            .expect_err("wrong subsidy should be rejected");
        assert!(
            err.contains("subsidy") || err.contains("reward"),
            "expected subsidy error, got: {err}"
        );
    }

    #[test]
    fn genesis_block_has_header_hex() {
        let genesis = genesis::genesis_block();
        assert!(!genesis.header_hex.is_empty(), "genesis must have header_hex");
        assert_eq!(genesis.header_hex.len(), HEADER_SIZE * 2);
    }

    #[test]
    fn peer_import_legacy_blocks_without_header_hex_still_accepted() {
        let mut source = NodeRuntime::new("node-legacy-src", NodeConfig::mainnet());
        mine_one_block(&mut source);

        let mut block = source.accepted_blocks()[1].clone();
        // Simulate legacy block without header_hex
        block.header_hex = String::new();

        let mut target = NodeRuntime::new("node-legacy-tgt", NodeConfig::mainnet());
        let imported = target
            .import_peer_blocks(vec![block])
            .expect("legacy block without header_hex should still be accepted");
        assert_eq!(imported, 1);
    }

    #[test]
    fn checkpoint_violation_rejects_peer_block() {
        // This test verifies the checkpoint check is wired in by importing
        // genesis with a wrong hash.
        let mut target = NodeRuntime::new("node-cp", NodeConfig::mainnet());
        let mut bad_genesis = genesis::genesis_block();
        bad_genesis.hash_hex = hex(&[0xBB; 32]);

        let err = target
            .import_peer_blocks(vec![bad_genesis])
            .expect_err("checkpoint violation should be rejected");
        assert!(
            err.contains("does not match canonical genesis") || err.contains("checkpoint"),
            "expected checkpoint or genesis hash error, got: {err}"
        );
    }

    // ── Phase 13: Chain Linkage Verification tests ─────────────────────

    #[test]
    fn mined_block_has_previous_hash_hex() {
        let mut runtime = NodeRuntime::new("node-prevh", NodeConfig::mainnet());
        mine_one_block(&mut runtime);
        let block = &runtime.accepted_blocks()[1]; // height 1
        assert!(!block.previous_hash_hex.is_empty(), "mined block must have previous_hash_hex");
        // previous_hash should be genesis hash
        let genesis = genesis::genesis_block();
        assert_eq!(block.previous_hash_hex, genesis.hash_hex);
    }

    #[test]
    fn genesis_block_has_zero_previous_hash() {
        let genesis = genesis::genesis_block();
        assert_eq!(genesis.previous_hash_hex, hex(&[0u8; 32]));
    }

    #[test]
    fn peer_import_verifies_chain_linkage() {
        let mut source = NodeRuntime::new("node-link-src", NodeConfig::mainnet());
        mine_one_block(&mut source);
        mine_one_block(&mut source);

        // Valid import: blocks link correctly genesis → h1 → h2
        let mut target = NodeRuntime::new("node-link-tgt", NodeConfig::mainnet());
        let imported = target
            .import_peer_blocks(source.accepted_blocks().to_vec())
            .expect("valid chain linkage should succeed");
        assert_eq!(imported, 2);
        assert_eq!(target.chain_height(), 2);
    }

    #[test]
    fn peer_import_rejects_broken_chain_linkage() {
        let mut source = NodeRuntime::new("node-break-src", NodeConfig::mainnet());
        mine_one_block(&mut source);

        let mut block = source.accepted_blocks()[1].clone();
        // Tamper with previous_hash_hex — make it point to wrong parent
        block.previous_hash_hex = hex(&[0xDD; 32]);

        let mut target = NodeRuntime::new("node-break-tgt", NodeConfig::mainnet());
        let err = target
            .import_peer_blocks(vec![block])
            .expect_err("broken chain linkage should be rejected");
        assert!(
            err.contains("does not link to") || err.contains("previous_hash"),
            "expected chain linkage error, got: {err}"
        );
    }

    #[test]
    fn peer_import_rejects_mismatched_previous_hash_in_header() {
        let mut source = NodeRuntime::new("node-hdr-mismatch-src", NodeConfig::mainnet());
        mine_one_block(&mut source);

        let mut block = source.accepted_blocks()[1].clone();
        // Set previous_hash_hex to something that doesn't match header.previous_hash
        block.previous_hash_hex = hex(&[0xEE; 32]);

        let mut target = NodeRuntime::new("node-hdr-mismatch-tgt", NodeConfig::mainnet());
        let err = target
            .import_peer_blocks(vec![block])
            .expect_err("header/previous_hash mismatch should be rejected");
        assert!(
            err.contains("previous_hash"),
            "expected previous_hash error, got: {err}"
        );
    }

    #[test]
    fn batch_import_verifies_intra_batch_chain_linkage() {
        let mut source = NodeRuntime::new("node-batch-link-src", NodeConfig::mainnet());
        mine_one_block(&mut source);
        mine_one_block(&mut source);

        let mut blocks = source.accepted_blocks().to_vec();
        // Tamper with block at height 2: make its previous_hash_hex point to wrong block
        blocks[2].previous_hash_hex = hex(&[0xCC; 32]);

        let mut target = NodeRuntime::new("node-batch-link-tgt", NodeConfig::mainnet());
        let err = target
            .import_peer_blocks(blocks)
            .expect_err("intra-batch broken linkage should be rejected");
        assert!(
            err.contains("does not link to") || err.contains("previous_hash"),
            "expected chain linkage error, got: {err}"
        );
    }

    #[test]
    fn peer_import_previous_hash_consistent_between_header_and_field() {
        let mut source = NodeRuntime::new("node-consist-src", NodeConfig::mainnet());
        mine_one_block(&mut source);
        let block = &source.accepted_blocks()[1];

        // Extract previous_hash from header_hex
        let header_bytes = parse_fixed_hex::<HEADER_SIZE>(&block.header_hex, "test header").unwrap();
        let header = MiningHeader::from_bytes(header_bytes);
        let header_prev = hex(&header.previous_hash);

        // Both should match
        assert_eq!(block.previous_hash_hex, header_prev);
    }

    #[test]
    fn legacy_block_without_previous_hash_still_accepted() {
        let mut source = NodeRuntime::new("node-legacy-prev-src", NodeConfig::mainnet());
        mine_one_block(&mut source);

        let mut block = source.accepted_blocks()[1].clone();
        // Simulate legacy block: no previous_hash_hex, no header_hex
        block.previous_hash_hex = String::new();
        block.header_hex = String::new();

        let mut target = NodeRuntime::new("node-legacy-prev-tgt", NodeConfig::mainnet());
        let imported = target
            .import_peer_blocks(vec![block])
            .expect("legacy block without previous_hash should still be accepted");
        assert_eq!(imported, 1);
    }

    // ── Phase 14: Coinbase transaction tests ──────────────────────────

    #[test]
    fn template_without_miner_address_has_no_coinbase() {
        let runtime = NodeRuntime::new("node-no-cb", NodeConfig::mainnet());
        let template = runtime.active_template();
        // With no miner_address configured, template should have no transactions
        assert!(
            template.transaction_ids.is_empty(),
            "template without miner_address must have no coinbase tx"
        );
    }

    #[test]
    fn template_with_miner_address_has_coinbase_tx() {
        let mut runtime = NodeRuntime::new("node-cb", NodeConfig::mainnet());
        runtime.set_miner_address("test-miner-wallet".to_string());
        let template = runtime.active_template();

        // Template should have exactly one transaction: the coinbase
        assert_eq!(template.transaction_count, 1, "template should have coinbase tx");
        assert_eq!(template.transaction_ids.len(), 1);
    }

    #[test]
    fn coinbase_tx_credits_correct_address_and_amount() {
        let mut runtime = NodeRuntime::new("node-cb-addr", NodeConfig::mainnet());
        runtime.set_miner_address("alice-wallet".to_string());

        // The active template is for height 1 (genesis is height 0).
        let height = runtime.active_template().height;
        assert_eq!(height, 1);

        // Mine a block to accept it.
        mine_one_block(&mut runtime);

        let block = &runtime.accepted_blocks()[1]; // genesis=0, mined=1
        assert_eq!(block.height, 1);
        assert_eq!(block.miner_address, "alice-wallet");

        // First transaction should be the coinbase.
        let coinbase = &block.transactions[0];
        assert_eq!(coinbase.from, "coinbase");
        assert_eq!(coinbase.to, "alice-wallet");
        assert_eq!(coinbase.fee_zion, 0);
        assert_eq!(coinbase.nonce, 1); // nonce = height

        // Amount = subsidy + fees (no user txs, so just subsidy).
        let expected_subsidy = emission::block_subsidy(1);
        assert_eq!(coinbase.amount_zion, expected_subsidy);
        assert_eq!(block.miner_reward_zion, expected_subsidy);
    }

    #[test]
    fn submit_candidate_rejects_locally_invalid_coinbase() {
        let mut runtime = NodeRuntime::new("node-local-validate", NodeConfig::mainnet());
        runtime.set_miner_address("local-wallet".to_string());
        runtime.chain_state.active_template.transactions[0]
            .as_account_mut()
            .expect("coinbase must stay account-based in current runtime")
            .amount_zion += 1;

        let template = runtime.active_template();
        let nonce = find_valid_nonce(&template);
        let response = runtime.handle_rpc_request(RpcRequest::SubmitCandidate {
            template_id: template.template_id,
            header_hex: template.header_hex,
            nonce,
            target_hex: template.target_hex,
        });

        assert!(matches!(
            response,
            RpcResponse::SubmitResult {
                accepted: false,
                reason: Some(ref reason),
                ..
            } if reason.contains("failed validation") && reason.contains("coinbase amount")
        ), "unexpected submit response: {response:?}");
    }

    #[test]
    fn coinbase_tx_id_is_deterministic() {
        let mut r1 = NodeRuntime::new("node-det-1", NodeConfig::mainnet());
        r1.set_miner_address("det-wallet".to_string());

        let mut r2 = NodeRuntime::new("node-det-2", NodeConfig::mainnet());
        r2.set_miner_address("det-wallet".to_string());

        // Both nodes at same height with same miner_address should produce
        // the same coinbase tx_id (deterministic from height + address).
        let t1 = r1.active_template();
        let t2 = r2.active_template();
        assert_eq!(t1.transaction_ids[0], t2.transaction_ids[0]);
    }

    #[test]
    fn coinbase_tx_id_differs_for_different_addresses() {
        let mut r1 = NodeRuntime::new("node-diff-1", NodeConfig::mainnet());
        r1.set_miner_address("wallet-a".to_string());

        let mut r2 = NodeRuntime::new("node-diff-2", NodeConfig::mainnet());
        r2.set_miner_address("wallet-b".to_string());

        let t1 = r1.active_template();
        let t2 = r2.active_template();
        assert_ne!(
            t1.transaction_ids[0], t2.transaction_ids[0],
            "different miner addresses must produce different coinbase tx_ids"
        );
    }

    #[test]
    fn mined_block_with_coinbase_flows_to_next_template() {
        let mut runtime = NodeRuntime::new("node-cb-flow", NodeConfig::mainnet());
        runtime.set_miner_address("flow-wallet".to_string());

        // Mine block 1.
        mine_one_block(&mut runtime);
        assert_eq!(runtime.accepted_blocks().len(), 2); // genesis + 1

        // Block 1 should have coinbase.
        let b1 = &runtime.accepted_blocks()[1];
        assert_eq!(b1.transactions[0].from, "coinbase");
        assert_eq!(b1.transactions[0].to, "flow-wallet");

        // Next template (height 2) should also have coinbase for height 2.
        let t2 = runtime.active_template();
        assert_eq!(t2.height, 2);
        assert_eq!(t2.transaction_count, 1); // coinbase only
        // Coinbase nonce should be the height.
        // We can verify by checking the tx_id is different from block 1's coinbase.
        assert_ne!(t2.transaction_ids[0], b1.transactions[0].tx_id);
    }

    #[test]
    fn genesis_block_has_no_coinbase() {
        let runtime = NodeRuntime::new("node-genesis-cb", NodeConfig::mainnet());
        let genesis = &runtime.accepted_blocks()[0];
        assert_eq!(genesis.height, 0);
        assert!(genesis.miner_address.is_empty());
        // Genesis should have premine transactions, none from "coinbase".
        assert!(!genesis.transactions.iter().any(|tx| tx.from == "coinbase"));
    }

    #[test]
    fn set_miner_address_rebuilds_active_template() {
        let mut runtime = NodeRuntime::new("node-rebuild", NodeConfig::mainnet());
        assert!(runtime.active_template().transaction_ids.is_empty());

        runtime.set_miner_address("rebuild-wallet".to_string());
        assert_eq!(runtime.miner_address(), "rebuild-wallet");
        assert_eq!(runtime.active_template().transaction_count, 1);
        assert_eq!(runtime.active_template().transaction_ids.len(), 1);
    }
}
