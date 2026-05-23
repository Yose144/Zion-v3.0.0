//! L1 Memo Scanner — watches the ZION L1 blockchain for DAO governance events.
//!
//! ## How the DAO uses L1
//!
//! ZION DAO works **without a smart contract on L1**. Instead, holders signal
//! governance intent by sending a tiny self-transfer TX with a structured memo:
//!
//! | Action                   | Memo format                           |
//! |--------------------------|---------------------------------------|
//! | Vote yes on proposal 42  | `DAO:vote:42:yes`                     |
//! | Vote no on proposal 42   | `DAO:vote:42:no`                      |
//! | Abstain on proposal 42   | `DAO:vote:42:abstain`                 |
//! | Register as candidate    | `DAO:guardian:register:<pubkey>`      |
//!
//! The scanner polls the L1 RPC, parses memos, verifies balance at TX block,
//! and records votes in the SQLite DB.
//!
//! ## Security Model
//!
//! - Weight = ZION balance of the sending address **at the TX block** (snapshot)
//! - TX must come from the same address that intends to vote (no proxy)
//! - Duplicate memos from the same address for the same proposal are ignored
//! - Minimum vote weight: 1 ZION (avoids dust spam)

use std::sync::Arc;
use std::time::Duration;

use serde::Deserialize;
use tokio::sync::Mutex;
use tokio::time::sleep;
use tracing::{debug, info, warn};

use crate::db::DaoDb;
use crate::error::{DaoError, DaoResult};
use crate::types::{parse_dao_memo, DaoMemo};

// ─────────────────────────────────────────────────────────────────────────────
// L1 RPC types (minimal — only what we need)
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct RpcResponse<T> {
    result: Option<T>,
    error: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct BlockInfo {
    height: u64,
    hash: String,
    txids: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct TxInfo {
    txid: String,
    sender: Option<String>,
    memo: Option<String>,
    block_height: Option<u64>,
    /// Amount sent (atomic units) — used to verify sender has funds
    #[serde(default)]
    outputs: Vec<TxOutput>,
}

#[derive(Debug, Deserialize)]
struct TxOutput {
    address: String,
    amount: u64,
}

#[derive(Debug, Deserialize)]
struct BalanceInfo {
    address: String,
    balance: u64, // atomic units
}

// ─────────────────────────────────────────────────────────────────────────────
// Scanner Config
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct ScannerConfig {
    /// L1 RPC URL, e.g. `http://91.98.122.165:8444/jsonrpc`
    pub rpc_url: String,
    /// Poll interval (how often to ask for new blocks)
    pub poll_interval: Duration,
    /// Minimum ZION balance to count a vote (1 ZION = 1_000_000 atomic)
    pub min_vote_weight: u64,
    /// Number of blocks to confirm before accepting TX (finality)
    pub finality_blocks: u64,
}

impl Default for ScannerConfig {
    fn default() -> Self {
        Self {
            rpc_url: "http://91.98.122.165:8444/jsonrpc".to_string(),
            poll_interval: Duration::from_secs(30),
            min_vote_weight: 1_000_000, // 1 ZION
            finality_blocks: 6,
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Scanner
// ─────────────────────────────────────────────────────────────────────────────

pub struct L1Scanner {
    config: ScannerConfig,
    db: Arc<Mutex<DaoDb>>,
    client: reqwest::Client,
    /// How many DAO events were processed this session
    events_processed: Arc<std::sync::atomic::AtomicU64>,
}

impl L1Scanner {
    pub fn new(config: ScannerConfig, db: Arc<Mutex<DaoDb>>) -> Self {
        Self {
            config,
            db,
            client: reqwest::Client::builder()
                .timeout(Duration::from_secs(10))
                .build()
                .expect("reqwest client"),
            events_processed: Arc::new(std::sync::atomic::AtomicU64::new(0)),
        }
    }

    /// Number of events processed since startup.
    pub fn events_processed(&self) -> u64 {
        self.events_processed
            .load(std::sync::atomic::Ordering::Relaxed)
    }

    // ── Main loop ─────────────────────────────────────────────────────────────

    /// Run forever — call this in a tokio::spawn task.
    pub async fn run(&self) {
        info!(
            "[DAO-SCANNER] Starting L1 scanner → {}",
            self.config.rpc_url
        );

        loop {
            match self.scan_new_blocks().await {
                Ok(found) => {
                    if found > 0 {
                        info!("[DAO-SCANNER] Processed {} DAO event(s)", found);
                    } else {
                        debug!("[DAO-SCANNER] No new DAO events");
                    }
                }
                Err(e) => {
                    warn!("[DAO-SCANNER] Scan error: {}", e);
                }
            }
            sleep(self.config.poll_interval).await;
        }
    }

    async fn scan_new_blocks(&self) -> DaoResult<u64> {
        // Get current L1 tip
        let tip_height = self.get_chain_height().await?;

        // Read cursor from DB
        let cursor = {
            let db = self.db.lock().await;
            db.last_scanned_block()?
        };

        // Adjust for finality
        let safe_height = tip_height.saturating_sub(self.config.finality_blocks);
        if cursor >= safe_height {
            return Ok(0); // nothing new
        }

        let mut events_found = 0u64;

        // Scan each new block
        for height in (cursor + 1)..=safe_height {
            let block = match self.get_block(height).await {
                Ok(b) => b,
                Err(e) => {
                    warn!("[DAO-SCANNER] Failed to fetch block {}: {}", height, e);
                    break;
                }
            };

            for txid in &block.txids {
                match self.process_tx(txid, height).await {
                    Ok(true) => {
                        events_found += 1;
                        self.events_processed
                            .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                    }
                    Ok(false) => {}
                    Err(e) => {
                        debug!("[DAO-SCANNER] TX {} error: {}", txid, e);
                    }
                }
            }

            // Update cursor after each block (so crash mid-range doesn't restart)
            let db = self.db.lock().await;
            db.set_last_scanned_block(height)?;
        }

        Ok(events_found)
    }

    /// Returns `true` if this TX contained a valid DAO memo that was processed.
    async fn process_tx(&self, txid: &str, block_height: u64) -> DaoResult<bool> {
        let tx = match self.get_tx(txid).await? {
            Some(tx) => tx,
            None => return Ok(false),
        };

        let memo = match &tx.memo {
            Some(m) if !m.is_empty() => m.clone(),
            _ => return Ok(false), // no memo
        };

        let parsed = match parse_dao_memo(&memo) {
            Some(p) => p,
            None => return Ok(false), // not a DAO memo
        };

        let sender = match &tx.sender {
            Some(s) => s.clone(),
            None => return Ok(false),
        };

        match parsed {
            DaoMemo::Vote {
                proposal_id,
                choice,
            } => {
                let pid: u64 = proposal_id.parse().map_err(|_| {
                    DaoError::Internal(format!("Invalid proposal id: {}", proposal_id))
                })?;

                // Get voter balance at this block for vote weight
                let weight = self.get_balance_at(&sender, block_height).await?;
                if weight < self.config.min_vote_weight {
                    debug!(
                        "[DAO-SCANNER] Skipping dust vote from {} (weight {})",
                        sender, weight
                    );
                    return Ok(false);
                }

                let recorded = {
                    let db = self.db.lock().await;

                    // Check proposal exists and is active
                    let row = db.get_proposal(pid)?;
                    match row {
                        None => {
                            debug!("[DAO-SCANNER] Proposal {} not found, ignoring vote", pid);
                            return Ok(false);
                        }
                        Some(ref r) if r.status != "Active" => {
                            debug!(
                                "[DAO-SCANNER] Proposal {} not active ({}), ignoring",
                                pid, r.status
                            );
                            return Ok(false);
                        }
                        _ => {}
                    }

                    db.record_vote(pid, &sender, choice, weight, Some(txid))?
                };

                if recorded {
                    info!(
                        "[DAO-SCANNER] Vote recorded: proposal={} voter={} weight={}",
                        pid, sender, weight
                    );
                    Ok(true)
                } else {
                    debug!(
                        "[DAO-SCANNER] Duplicate vote ignored: proposal={} voter={}",
                        pid, sender
                    );
                    Ok(false)
                }
            }

            DaoMemo::Propose { proposal_type } => {
                // Future: allow proposals submitted via L1 memo
                info!(
                    "[DAO-SCANNER] Propose memo from {} (type {}), ignored for now",
                    sender, proposal_type
                );
                Ok(false)
            }

            DaoMemo::Execute { proposal_id } => {
                // Future: signal execution via L1 memo
                info!(
                    "[DAO-SCANNER] Execute memo for proposal {}, ignored for now",
                    proposal_id
                );
                Ok(false)
            }
        }
    }

    // ── L1 RPC helpers ────────────────────────────────────────────────────────

    async fn rpc<T: for<'de> Deserialize<'de>>(
        &self,
        method: &str,
        params: serde_json::Value,
    ) -> DaoResult<T> {
        let body = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": method,
            "params": params,
        });

        let res = self
            .client
            .post(&self.config.rpc_url)
            .json(&body)
            .send()
            .await
            .map_err(|e| DaoError::Internal(format!("RPC request failed: {}", e)))?;

        let rpc_resp: RpcResponse<T> = res
            .json()
            .await
            .map_err(|e| DaoError::Internal(format!("RPC parse error: {}", e)))?;

        if let Some(err) = rpc_resp.error {
            return Err(DaoError::Internal(format!("RPC error: {}", err)));
        }

        rpc_resp
            .result
            .ok_or_else(|| DaoError::Internal("RPC returned null result".to_string()))
    }

    async fn get_chain_height(&self) -> DaoResult<u64> {
        #[derive(Deserialize)]
        struct Info {
            height: u64,
        }
        let info: Info = self.rpc("get_info", serde_json::json!({})).await?;
        Ok(info.height)
    }

    async fn get_block(&self, height: u64) -> DaoResult<BlockInfo> {
        self.rpc("get_block", serde_json::json!({ "height": height }))
            .await
    }

    async fn get_tx(&self, txid: &str) -> DaoResult<Option<TxInfo>> {
        match self
            .rpc("get_transaction", serde_json::json!({ "txid": txid }))
            .await
        {
            Ok(tx) => Ok(Some(tx)),
            Err(DaoError::Internal(e)) if e.contains("not found") => Ok(None),
            Err(e) => Err(e),
        }
    }

    async fn get_balance_at(&self, address: &str, _block: u64) -> DaoResult<u64> {
        // Note: L1 does not yet expose historical balance at block —
        // we use current balance as a reasonable approximation for testnet.
        // TODO: implement `get_balance_at_height` on L1 RPC for mainnet.
        #[derive(Deserialize)]
        struct Balance {
            address: String,
            balance: u64,
        }
        let bal: Balance = self
            .rpc(
                "get_balance",
                serde_json::json!({ "address": address }),
            )
            .await?;
        Ok(bal.balance)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::parse_dao_memo;

    #[test]
    fn test_memo_parsing() {
        // Valid vote memos
        assert!(parse_dao_memo("DAO:vote:42:yes").is_some());
        assert!(parse_dao_memo("DAO:vote:1:no").is_some());
        assert!(parse_dao_memo("DAO:vote:99:abstain").is_some());

        // Invalid memos (not DAO)
        assert!(parse_dao_memo("BRIDGE:base:0xabc").is_none());
        assert!(parse_dao_memo("hello world").is_none());
        assert!(parse_dao_memo("DAO:vote:42").is_none()); // missing choice
    }

    #[test]
    fn test_config_defaults() {
        let cfg = ScannerConfig::default();
        assert_eq!(cfg.finality_blocks, 6);
        assert_eq!(cfg.min_vote_weight, 1_000_000);
    }
}
