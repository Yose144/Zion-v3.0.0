//! L1 Chain Watcher — monitors ZION L1 for bridge lock transactions.
//!
//! Uses canonical V3 raw TCP JSON-RPC (`getChainInfo`, `getBlockByHeight`) and
//! scans accepted UTXO transactions for outputs directed to the bridge vault.

use crate::config::L1Config;
use crate::types::{BridgeStatus, L1LockEvent};
use anyhow::{anyhow, Context, Result};
use chrono::Utc;
use ripemd::Ripemd160;
use serde::de::DeserializeOwned;
use serde::Deserialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;
use tokio::sync::mpsc;
use tracing::{debug, error, info, warn};

const ZION_BASE32_ALPHABET: &[u8; 32] = b"023456789acdefghjklmnpqrstuvwxyz";

#[derive(Debug, Deserialize)]
struct RpcResponse<T> {
    result: Option<T>,
    #[serde(default)]
    error: Option<Value>,
}

#[derive(Debug, Deserialize)]
struct ChainInfo {
    chain_height: u64,
}

#[derive(Debug, Deserialize)]
struct L1Block {
    pub height: u64,
    #[serde(alias = "hash_hex")]
    pub hash: String,
    #[serde(default)]
    pub utxo_transactions: Vec<L1Transaction>,
}

#[derive(Debug, Deserialize)]
struct L1Transaction {
    pub id: [u8; 32],
    #[serde(default)]
    pub inputs: Vec<L1TxInput>,
    pub outputs: Vec<L1TxOutput>,
}

#[derive(Debug, Deserialize)]
struct L1TxInput {
    #[serde(default)]
    pub public_key: Vec<u8>,
}

#[derive(Debug, Deserialize)]
struct L1TxOutput {
    pub address: String,
    pub amount: u64,
    #[serde(default)]
    pub memo: Option<String>,
}

/// L1 watcher that polls for lock transactions.
pub struct L1Watcher {
    config: L1Config,
    last_processed_height: u64,
    /// Pending lock events waiting for finality.
    pending_locks: HashMap<String, L1LockEvent>,
}

impl L1Watcher {
    pub fn new(config: L1Config, start_height: Option<u64>) -> Self {
        Self {
            config,
            last_processed_height: start_height.unwrap_or(0),
            pending_locks: HashMap::new(),
        }
    }

    /// Start the L1 watcher loop. Sends confirmed lock events to the channel.
    pub async fn run(&mut self, lock_tx: mpsc::Sender<L1LockEvent>) -> Result<()> {
        info!(
            "🔍 L1 Watcher started — monitoring {} for bridge locks to {}",
            self.config.rpc_url, self.config.bridge_address
        );
        info!(
            "   Finality: {} blocks, Poll interval: {}s, Start height: {}",
            self.config.finality_blocks, self.config.poll_interval_secs, self.last_processed_height,
        );

        loop {
            match self.poll_cycle(&lock_tx).await {
                Ok(()) => {}
                Err(e) => {
                    error!("L1 poll error: {:?}", e);
                }
            }
            tokio::time::sleep(std::time::Duration::from_secs(
                self.config.poll_interval_secs,
            ))
            .await;
        }
    }

    /// Single poll cycle: fetch new blocks, detect lock TXs, check finality.
    async fn poll_cycle(&mut self, lock_tx: &mpsc::Sender<L1LockEvent>) -> Result<()> {
        let current_height = self.get_chain_height().await?;

        if current_height <= self.last_processed_height {
            debug!("L1: no new blocks (height={})", current_height);
        } else {
            let from = self.last_processed_height + 1;
            let to = current_height;
            debug!("L1: scanning blocks {} → {}", from, to);

            for height in from..=to {
                match self.get_block(height).await {
                    Ok(block) => self.scan_block_for_locks(&block),
                    Err(e) => {
                        warn!("L1: failed to fetch block {}: {:?}", height, e);
                        break;
                    }
                }
            }

            self.last_processed_height = to;
        }

        let finalized_height = current_height.saturating_sub(self.config.finality_blocks);
        let mut finalized: Vec<String> = vec![];

        for (tx_hash, lock) in &self.pending_locks {
            if lock.l1_block_height <= finalized_height {
                info!(
                    "✅ L1 Lock finalized: {} ZION from {} → {} (TX: {})",
                    crate::types::conversion::flowers_to_zion_display(lock.amount_flowers),
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

        for tx_hash in finalized {
            self.pending_locks.remove(&tx_hash);
        }

        Ok(())
    }

    /// Scan a block for transactions to the bridge lock address.
    fn scan_block_for_locks(&mut self, block: &L1Block) {
        let _block_hash = &block.hash;

        for tx in &block.utxo_transactions {
            for output in &tx.outputs {
                if output.address != self.config.bridge_address {
                    continue;
                }

                let (target_chain, evm_recipient) = self
                    .parse_bridge_memo(output.memo.as_deref())
                    .unwrap_or(("base".into(), String::new()));

                let evm_recipient = if evm_recipient.is_empty() {
                    // Fallback: use configured default recipient for locks without memo
                    if let Some(ref default) = self.config.default_evm_recipient {
                        warn!(
                            "L1: Lock TX {} has no memo, using default EVM recipient: {}",
                            hex::encode(tx.id),
                            default,
                        );
                        default.clone()
                    } else {
                        warn!(
                            "L1: Lock TX {} has no valid EVM recipient in memo and no default configured, skipping",
                            hex::encode(tx.id),
                        );
                        continue;
                    }
                } else {
                    evm_recipient
                };

                let sender = tx
                    .inputs
                    .first()
                    .and_then(|input| zion_address_from_public_key(&input.public_key))
                    .unwrap_or_default();

                let tx_hash = hex::encode(tx.id);
                let lock_event = L1LockEvent {
                    l1_tx_hash: tx_hash.clone(),
                    l1_block_height: block.height,
                    l1_sender: sender,
                    amount_flowers: output.amount,
                    amount_wzion_wei: crate::types::conversion::flowers_to_wzion_wei(output.amount),
                    target_chain,
                    evm_recipient,
                    detected_at: Utc::now(),
                    status: BridgeStatus::Pending,
                    confirmations: 0,
                };

                info!(
                    "🔒 L1 Lock detected: {} ZION at height {} (TX: {}) — waiting {} blocks for finality",
                    crate::types::conversion::flowers_to_zion_display(output.amount),
                    block.height,
                    tx_hash,
                    self.config.finality_blocks,
                );

                self.pending_locks.insert(tx_hash, lock_event);
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
            if addr.starts_with("0x") && addr.len() == 42 {
                return Some((chain, addr));
            }
        }
        None
    }

    async fn get_chain_height(&self) -> Result<u64> {
        let info: ChainInfo = self.rpc("getChainInfo", json!({})).await?;
        Ok(info.chain_height)
    }

    async fn get_block(&self, height: u64) -> Result<L1Block> {
        self.rpc("getBlockByHeight", json!({ "height": height }))
            .await
    }

    async fn rpc<T: DeserializeOwned>(&self, method: &str, params: Value) -> Result<T> {
        let address = normalize_rpc_addr(&self.config.rpc_url);
        let mut stream = TcpStream::connect(&address)
            .await
            .with_context(|| format!("RPC connect failed to {}", address))?;

        let request = serde_json::to_string(&json!({
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
            "id": 1,
        }))?;

        stream.write_all(request.as_bytes()).await?;
        stream.write_all(b"\n").await?;

        let mut reader = BufReader::new(stream);
        let mut line = String::new();
        reader.read_line(&mut line).await?;

        let response: RpcResponse<T> = serde_json::from_str(line.trim())?;
        if let Some(err) = response.error {
            return Err(anyhow!("RPC error: {}", err));
        }

        response
            .result
            .ok_or_else(|| anyhow!("RPC returned null result"))
    }
}

fn normalize_rpc_addr(value: &str) -> String {
    let trimmed = value.trim().trim_end_matches('/');
    let trimmed = trimmed.strip_suffix("/jsonrpc").unwrap_or(trimmed);
    trimmed
        .strip_prefix("tcp://")
        .or_else(|| trimmed.strip_prefix("http://"))
        .or_else(|| trimmed.strip_prefix("https://"))
        .unwrap_or(trimmed)
        .to_string()
}

fn compute_address_checksum(body_35: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(b"zion1");
    hasher.update(body_35.as_bytes());
    let hash = hasher.finalize();
    let mut checksum = String::with_capacity(4);
    for &byte in &hash[..2] {
        checksum.push(ZION_BASE32_ALPHABET[(byte % 32) as usize] as char);
        checksum.push(ZION_BASE32_ALPHABET[((byte / 32) % 32) as usize] as char);
    }
    checksum
}

fn zion_address_from_public_key(public_key_bytes: &[u8]) -> Option<String> {
    if public_key_bytes.len() != 32 {
        return None;
    }

    let sha = Sha256::digest(public_key_bytes);
    let key_hash = Ripemd160::digest(sha);

    let mut body = String::with_capacity(40);
    for &byte in key_hash.as_slice() {
        body.push(ZION_BASE32_ALPHABET[(byte % 32) as usize] as char);
        body.push(ZION_BASE32_ALPHABET[((byte / 32) % 32) as usize] as char);
    }
    body.truncate(35);
    let checksum = compute_address_checksum(&body);
    Some(format!("zion1{body}{checksum}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::L1Config;

    fn test_watcher() -> L1Watcher {
        let config = L1Config {
            rpc_url: "127.0.0.1:8443".into(),
            rpc_url_backup: None,
            bridge_address: "zion1w0r0a560l3j2y6f3v2f457n2u4d0n5v2g79w0t0".into(),
            finality_blocks: 60,
            poll_interval_secs: 15,
            start_block_height: None,
            l1_rpc_token: None,
            default_evm_recipient: None,
        };
        L1Watcher::new(config, None)
    }

    #[test]
    fn test_parse_bridge_memo_valid_base() {
        let w = test_watcher();
        let result = w.parse_bridge_memo(Some(
            "BRIDGE:base:0x1234567890abcdef1234567890abcdef12345678",
        ));
        assert!(result.is_some());
        let (chain, addr) = result.unwrap();
        assert_eq!(chain, "base");
        assert_eq!(addr, "0x1234567890abcdef1234567890abcdef12345678");
    }

    #[test]
    fn test_parse_bridge_memo_valid_arbitrum() {
        let w = test_watcher();
        let result = w.parse_bridge_memo(Some(
            "BRIDGE:ARBITRUM:0xAbCdEf1234567890aBcDeF1234567890AbCdEf12",
        ));
        assert!(result.is_some());
        let (chain, addr) = result.unwrap();
        assert_eq!(chain, "arbitrum");
        assert_eq!(addr, "0xAbCdEf1234567890aBcDeF1234567890AbCdEf12");
    }

    #[test]
    fn test_parse_bridge_memo_valid_bsc() {
        let w = test_watcher();
        let result = w.parse_bridge_memo(Some(
            "BRIDGE:bsc:0x0000000000000000000000000000000000000001",
        ));
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
        assert!(w
            .parse_bridge_memo(Some(
                "TRANSFER:base:0x1234567890abcdef1234567890abcdef12345678"
            ))
            .is_none());
    }

    #[test]
    fn test_parse_bridge_memo_missing_chain() {
        let w = test_watcher();
        assert!(w
            .parse_bridge_memo(Some("BRIDGE:0x1234567890abcdef1234567890abcdef12345678"))
            .is_none());
    }

    #[test]
    fn test_parse_bridge_memo_invalid_address_too_short() {
        let w = test_watcher();
        assert!(w.parse_bridge_memo(Some("BRIDGE:base:0x1234")).is_none());
    }

    #[test]
    fn test_parse_bridge_memo_invalid_address_no_prefix() {
        let w = test_watcher();
        assert!(w
            .parse_bridge_memo(Some("BRIDGE:base:1234567890abcdef1234567890abcdef12345678"))
            .is_none());
    }

    #[test]
    fn test_parse_bridge_memo_case_insensitive_prefix() {
        let w = test_watcher();
        assert!(w
            .parse_bridge_memo(Some(
                "bridge:base:0x1234567890abcdef1234567890abcdef12345678"
            ))
            .is_none());
    }

    #[test]
    fn test_watcher_initial_height() {
        let config = L1Config {
            rpc_url: "127.0.0.1:8443".into(),
            rpc_url_backup: None,
            bridge_address: "zion1w0r0a560l3j2y6f3v2f457n2u4d0n5v2g79w0t0".into(),
            finality_blocks: 60,
            poll_interval_secs: 15,
            start_block_height: None,
            l1_rpc_token: None,
            default_evm_recipient: None,
        };
        let watcher = L1Watcher::new(config, Some(12345));
        assert_eq!(watcher.last_processed_height, 12345);
        assert!(watcher.pending_locks.is_empty());
    }

    #[test]
    fn test_normalize_rpc_addr() {
        assert_eq!(
            normalize_rpc_addr("http://127.0.0.1:8443/jsonrpc"),
            "127.0.0.1:8443"
        );
        assert_eq!(
            normalize_rpc_addr("https://204.168.245.175:8443/"),
            "204.168.245.175:8443"
        );
    }

    #[test]
    fn test_zion_address_derivation_shape() {
        let address = zion_address_from_public_key(&[7u8; 32]).unwrap();
        assert!(address.starts_with("zion1"));
        assert_eq!(address.len(), 44);
    }
}
