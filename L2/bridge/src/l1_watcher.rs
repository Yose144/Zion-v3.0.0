//! L1 Chain Watcher — monitors ZION L1 for lock transactions to the bridge address.
//!
//! Polls the L1 RPC endpoint at regular intervals to detect new transactions
//! where ZION is sent to the bridge lock address. After confirming finality
//! (60 blocks), the lock event is forwarded to the relayer for EVM minting.

use crate::config::L1Config;
use crate::types::{BridgeStatus, L1LockEvent};
use anyhow::Result;
use chrono::Utc;
use reqwest::Client;
use serde::Deserialize;
use std::collections::HashMap;
use tokio::sync::mpsc;
use tracing::{debug, error, info, warn};

/// L1 block data from RPC.
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct L1Block {
    pub height: u64,
    pub hash: String,
    pub timestamp: u64,
    pub transactions: Vec<L1Transaction>,
}

/// L1 transaction data from RPC.
#[derive(Debug, Deserialize)]
struct L1Transaction {
    pub hash: String,
    pub inputs: Vec<L1TxInput>,
    pub outputs: Vec<L1TxOutput>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct L1TxInput {
    pub address: String,
    pub amount: u64,
}

#[derive(Debug, Deserialize)]
struct L1TxOutput {
    pub address: String,
    pub amount: u64,
    /// Optional memo / OP_RETURN data (used to encode EVM recipient + target chain)
    pub memo: Option<String>,
}

/// L1 chain health response.
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct L1Health {
    pub height: u64,
    pub difficulty: u64,
    pub peers: u64,
    pub status: String,
}

/// L1 watcher that polls for lock transactions.
pub struct L1Watcher {
    config: L1Config,
    client: Client,
    last_processed_height: u64,
    /// Pending lock events waiting for finality
    pending_locks: HashMap<String, L1LockEvent>,
}

impl L1Watcher {
    pub fn new(config: L1Config, start_height: Option<u64>) -> Self {
        Self {
            config: config.clone(),
            client: Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .expect("Failed to create HTTP client"),
            last_processed_height: start_height.unwrap_or(0),
            pending_locks: HashMap::new(),
        }
    }

    /// Start the L1 watcher loop. Sends confirmed lock events to the channel.
    pub async fn run(
        &mut self,
        lock_tx: mpsc::Sender<L1LockEvent>,
    ) -> Result<()> {
        info!(
            "🔍 L1 Watcher started — monitoring {} for bridge locks to {}",
            self.config.rpc_url, self.config.bridge_address
        );
        info!(
            "   Finality: {} blocks, Poll interval: {}s, Start height: {}",
            self.config.finality_blocks,
            self.config.poll_interval_secs,
            self.last_processed_height,
        );

        loop {
            match self.poll_cycle(&lock_tx).await {
                Ok(()) => {}
                Err(e) => {
                    error!("L1 poll error: {:?}", e);
                    // Continue polling even on error
                }
            }
            tokio::time::sleep(std::time::Duration::from_secs(
                self.config.poll_interval_secs,
            ))
            .await;
        }
    }

    /// Single poll cycle: fetch new blocks, detect lock TXs, check finality.
    async fn poll_cycle(
        &mut self,
        lock_tx: &mpsc::Sender<L1LockEvent>,
    ) -> Result<()> {
        // Get current chain height
        let health = self.get_health().await?;
        let current_height = health.height;

        if current_height <= self.last_processed_height {
            debug!("L1: no new blocks (height={})", current_height);
            return Ok(());
        }

        // Process new blocks
        let from = self.last_processed_height + 1;
        let to = current_height;
        debug!("L1: scanning blocks {} → {}", from, to);

        for height in from..=to {
            match self.get_block(height).await {
                Ok(block) => {
                    self.scan_block_for_locks(&block);
                }
                Err(e) => {
                    warn!("L1: failed to fetch block {}: {:?}", height, e);
                    break; // Stop and retry next cycle
                }
            }
        }

        // Check finality for pending locks
        let finalized_height = current_height.saturating_sub(self.config.finality_blocks);
        let mut finalized: Vec<String> = vec![];

        for (tx_hash, lock) in &self.pending_locks {
            if lock.l1_block_height <= finalized_height {
                info!(
                    "✅ L1 Lock finalized: {} ZION from {} → {} (TX: {})",
                    crate::types::conversion::atomic_to_zion_display(lock.amount_atomic),
                    lock.l1_sender,
                    lock.evm_recipient,
                    tx_hash,
                );
                let mut confirmed_lock = lock.clone();
                confirmed_lock.status = BridgeStatus::Confirmed;

                if let Err(e) = lock_tx.send(confirmed_lock).await {
                    error!("Failed to send lock event: {:?}", e);
                }
                finalized.push(tx_hash.clone());
            }
        }

        // Remove finalized locks from pending
        for tx_hash in finalized {
            self.pending_locks.remove(&tx_hash);
        }

        self.last_processed_height = to;
        Ok(())
    }

    /// Scan a block for transactions to the bridge lock address.
    fn scan_block_for_locks(&mut self, block: &L1Block) {
        for tx in &block.transactions {
            for output in &tx.outputs {
                if output.address == self.config.bridge_address {
                    // This is a lock transaction!
                    let (target_chain, evm_recipient) = self
                        .parse_bridge_memo(output.memo.as_deref())
                        .unwrap_or(("base".into(), String::new()));

                    if evm_recipient.is_empty() {
                        warn!(
                            "L1: Lock TX {} has no valid EVM recipient in memo, skipping",
                            tx.hash
                        );
                        continue;
                    }

                    // Determine sender from inputs
                    let sender = tx
                        .inputs
                        .first()
                        .map(|i| i.address.clone())
                        .unwrap_or_default();

                    let lock_event = L1LockEvent {
                        l1_tx_hash: tx.hash.clone(),
                        l1_block_height: block.height,
                        l1_sender: sender,
                        amount_atomic: output.amount,
                        amount_wzion: crate::types::conversion::l1_atomic_to_wzion_wei(
                            output.amount,
                        ),
                        target_chain,
                        evm_recipient,
                        detected_at: Utc::now(),
                        status: BridgeStatus::Pending,
                        confirmations: 0,
                    };

                    info!(
                        "🔒 L1 Lock detected: {} ZION at height {} (TX: {}) — waiting {} blocks for finality",
                        crate::types::conversion::atomic_to_zion_display(output.amount),
                        block.height,
                        tx.hash,
                        self.config.finality_blocks,
                    );

                    self.pending_locks
                        .insert(tx.hash.clone(), lock_event);
                }
            }
        }
    }

    /// Parse bridge memo from TX output.
    /// Format: "BRIDGE:<chain>:<evm_address>"
    /// Example: "BRIDGE:base:0x1234...abcd"
    pub fn parse_bridge_memo(&self, memo: Option<&str>) -> Option<(String, String)> {
        let memo = memo?;
        let parts: Vec<&str> = memo.split(':').collect();
        if parts.len() >= 3 && parts[0] == "BRIDGE" {
            let chain = parts[1].to_lowercase();
            let addr = parts[2].to_string();
            // Basic EVM address validation
            if addr.starts_with("0x") && addr.len() == 42 {
                return Some((chain, addr));
            }
        }
        None
    }

    /// Get L1 chain health.
    async fn get_health(&self) -> Result<L1Health> {
        let url = format!("{}/health", self.config.rpc_url);
        let resp = self.client.get(&url).send().await?.json::<L1Health>().await?;
        Ok(resp)
    }

    /// Get L1 block by height.
    async fn get_block(&self, height: u64) -> Result<L1Block> {
        let url = format!("{}/api/block/height/{}", self.config.rpc_url, height);
        let resp = self.client.get(&url).send().await?.json::<L1Block>().await?;
        Ok(resp)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::L1Config;

    fn test_watcher() -> L1Watcher {
        let config = L1Config {
            rpc_url: "http://localhost:8444".into(),
            rpc_url_backup: None,
            bridge_address: "zion1bridge000000000000000000000000000vault".into(),
            finality_blocks: 60,
            poll_interval_secs: 15,
            start_block_height: None,
        };
        L1Watcher::new(config, None)
    }

    #[test]
    fn test_parse_bridge_memo_valid_base() {
        let w = test_watcher();
        let result = w.parse_bridge_memo(Some("BRIDGE:base:0x1234567890abcdef1234567890abcdef12345678"));
        assert!(result.is_some());
        let (chain, addr) = result.unwrap();
        assert_eq!(chain, "base");
        assert_eq!(addr, "0x1234567890abcdef1234567890abcdef12345678");
    }

    #[test]
    fn test_parse_bridge_memo_valid_arbitrum() {
        let w = test_watcher();
        let result = w.parse_bridge_memo(Some("BRIDGE:ARBITRUM:0xAbCdEf1234567890aBcDeF1234567890AbCdEf12"));
        assert!(result.is_some());
        let (chain, addr) = result.unwrap();
        assert_eq!(chain, "arbitrum"); // lowercased
        assert_eq!(addr, "0xAbCdEf1234567890aBcDeF1234567890AbCdEf12");
    }

    #[test]
    fn test_parse_bridge_memo_valid_bsc() {
        let w = test_watcher();
        let result = w.parse_bridge_memo(Some("BRIDGE:bsc:0x0000000000000000000000000000000000000001"));
        assert!(result.is_some());
        let (chain, _) = result.unwrap();
        assert_eq!(chain, "bsc");
    }

    #[test]
    fn test_parse_bridge_memo_none() {
        let w = test_watcher();
        assert!(w.parse_bridge_memo(None).is_none());
    }

    #[test]
    fn test_parse_bridge_memo_empty() {
        let w = test_watcher();
        assert!(w.parse_bridge_memo(Some("")).is_none());
    }

    #[test]
    fn test_parse_bridge_memo_wrong_prefix() {
        let w = test_watcher();
        assert!(w.parse_bridge_memo(Some("TRANSFER:base:0x1234567890abcdef1234567890abcdef12345678")).is_none());
    }

    #[test]
    fn test_parse_bridge_memo_missing_chain() {
        let w = test_watcher();
        assert!(w.parse_bridge_memo(Some("BRIDGE:0x1234567890abcdef1234567890abcdef12345678")).is_none());
    }

    #[test]
    fn test_parse_bridge_memo_invalid_address_too_short() {
        let w = test_watcher();
        // Address too short (not 42 chars)
        assert!(w.parse_bridge_memo(Some("BRIDGE:base:0x1234")).is_none());
    }

    #[test]
    fn test_parse_bridge_memo_invalid_address_no_prefix() {
        let w = test_watcher();
        // No 0x prefix
        assert!(w.parse_bridge_memo(Some("BRIDGE:base:1234567890abcdef1234567890abcdef12345678")).is_none());
    }

    #[test]
    fn test_parse_bridge_memo_case_insensitive_prefix() {
        let w = test_watcher();
        // "bridge" lowercase — currently expects uppercase "BRIDGE"
        assert!(w.parse_bridge_memo(Some("bridge:base:0x1234567890abcdef1234567890abcdef12345678")).is_none());
    }

    #[test]
    fn test_watcher_initial_height() {
        let config = L1Config {
            rpc_url: "http://localhost:8444".into(),
            rpc_url_backup: None,
            bridge_address: "zion1bridge000000000000000000000000000vault".into(),
            finality_blocks: 60,
            poll_interval_secs: 15,
            start_block_height: None,
        };

        let w = L1Watcher::new(config, Some(5000));
        assert_eq!(w.last_processed_height, 5000);

        let w2 = L1Watcher::new(L1Config {
            rpc_url: "http://localhost:8444".into(),
            rpc_url_backup: None,
            bridge_address: "zion1bridge000000000000000000000000000vault".into(),
            finality_blocks: 60,
            poll_interval_secs: 15,
            start_block_height: None,
        }, None);
        assert_eq!(w2.last_processed_height, 0);
    }

    #[test]
    fn test_scan_block_for_locks() {
        let mut w = test_watcher();

        let block = L1Block {
            height: 100,
            hash: "blockhash".into(),
            timestamp: 1000000,
            transactions: vec![
                L1Transaction {
                    hash: "tx_bridge_001".into(),
                    inputs: vec![L1TxInput {
                        address: "zion1qsender".into(),
                        amount: 5_000_000,
                    }],
                    outputs: vec![L1TxOutput {
                        address: "zion1bridge000000000000000000000000000vault".into(),
                        amount: 5_000_000,
                        memo: Some("BRIDGE:base:0x1234567890abcdef1234567890abcdef12345678".into()),
                    }],
                },
                // Non-bridge TX — different address
                L1Transaction {
                    hash: "tx_normal_001".into(),
                    inputs: vec![L1TxInput {
                        address: "zion1qsender2".into(),
                        amount: 1_000_000,
                    }],
                    outputs: vec![L1TxOutput {
                        address: "zion1qrecipient".into(),
                        amount: 1_000_000,
                        memo: None,
                    }],
                },
            ],
        };

        w.scan_block_for_locks(&block);

        assert_eq!(w.pending_locks.len(), 1);
        let lock = w.pending_locks.get("tx_bridge_001").unwrap();
        assert_eq!(lock.amount_atomic, 5_000_000);
        assert_eq!(lock.target_chain, "base");
        assert_eq!(lock.evm_recipient, "0x1234567890abcdef1234567890abcdef12345678");
        assert_eq!(lock.l1_sender, "zion1qsender");
        assert_eq!(lock.status, BridgeStatus::Pending);
    }

    #[test]
    fn test_scan_block_skip_no_memo() {
        let mut w = test_watcher();

        let block = L1Block {
            height: 200,
            hash: "blockhash2".into(),
            timestamp: 2000000,
            transactions: vec![L1Transaction {
                hash: "tx_no_memo".into(),
                inputs: vec![L1TxInput {
                    address: "zion1qsender".into(),
                    amount: 5_000_000,
                }],
                outputs: vec![L1TxOutput {
                    address: "zion1bridge000000000000000000000000000vault".into(),
                    amount: 5_000_000,
                    memo: None, // No memo — should be skipped
                }],
            }],
        };

        w.scan_block_for_locks(&block);
        assert_eq!(w.pending_locks.len(), 0);
    }

    #[test]
    fn test_scan_block_multiple_bridge_txs() {
        let mut w = test_watcher();

        let block = L1Block {
            height: 300,
            hash: "blockhash3".into(),
            timestamp: 3000000,
            transactions: vec![
                L1Transaction {
                    hash: "tx_a".into(),
                    inputs: vec![L1TxInput { address: "zion1qa".into(), amount: 1_000_000 }],
                    outputs: vec![L1TxOutput {
                        address: "zion1bridge000000000000000000000000000vault".into(),
                        amount: 1_000_000,
                        memo: Some("BRIDGE:base:0x1111111111111111111111111111111111111111".into()),
                    }],
                },
                L1Transaction {
                    hash: "tx_b".into(),
                    inputs: vec![L1TxInput { address: "zion1qb".into(), amount: 2_000_000 }],
                    outputs: vec![L1TxOutput {
                        address: "zion1bridge000000000000000000000000000vault".into(),
                        amount: 2_000_000,
                        memo: Some("BRIDGE:arbitrum:0x2222222222222222222222222222222222222222".into()),
                    }],
                },
            ],
        };

        w.scan_block_for_locks(&block);
        assert_eq!(w.pending_locks.len(), 2);
        assert!(w.pending_locks.contains_key("tx_a"));
        assert!(w.pending_locks.contains_key("tx_b"));
        assert_eq!(w.pending_locks["tx_b"].target_chain, "arbitrum");
    }
}
