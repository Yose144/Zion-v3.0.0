use serde::{Deserialize, Serialize};

/// Node status returned by `getStatus` RPC.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeStatus {
    pub height: u64,
    pub best_hash: String,
    pub difficulty: f64,
    pub mempool_size: usize,
    pub connections: usize,
    pub version: String,
}

/// Block template returned by `getBlockTemplate` RPC.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockTemplate {
    pub template_id: String,
    pub header_hex: String,
    pub header_json: String,
    pub target_hex: String,
    pub block_reward: u64,
    pub height: u64,
}

/// Result of submitting a block.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubmitBlockResult {
    pub accepted: bool,
    pub block_hash: Option<String>,
    pub error: Option<String>,
}
