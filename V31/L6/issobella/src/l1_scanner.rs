//! L1 blockchain scanner for Issobella fund accumulation.
//!
//! Watches L1 coinbase transactions for the 5% L5/L6 Issobella fund output
//! and accumulates the running total in the local database.

use crate::db::IssobellaDb;
use crate::error::IssobellaResult;
use serde::Deserialize;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;
use tokio::time::sleep;
use tracing::{debug, info, warn};

#[derive(Clone)]
pub struct ScannerConfig {
    pub rpc_url: String,
    pub poll_interval: Duration,
    pub fund_address: String,
    pub finality_blocks: u64,
}

impl Default for ScannerConfig {
    fn default() -> Self {
        Self {
            rpc_url: "127.0.0.1:9445".to_string(),
            poll_interval: Duration::from_secs(30),
            fund_address: "zion1z4s3a54266f2x7j4x7c27297k49752t7k52l0f0".to_string(),
            finality_blocks: 6,
        }
    }
}

pub struct L1Scanner {
    config: ScannerConfig,
    db: Arc<Mutex<IssobellaDb>>,
    blocks_scanned: Arc<std::sync::atomic::AtomicU64>,
}

impl L1Scanner {
    pub fn new(config: ScannerConfig, db: Arc<Mutex<IssobellaDb>>) -> Self {
        Self {
            config,
            db,
            blocks_scanned: Arc::new(std::sync::atomic::AtomicU64::new(0)),
        }
    }

    pub async fn run(&self) {
        info!(
            "[ISS-SCANNER] Starting L1 scanner → {} (fund={})",
            self.config.rpc_url, self.config.fund_address
        );

        loop {
            match self.scan_new_blocks().await {
                Ok(found) => {
                    if found > 0 {
                        info!("[ISS-SCANNER] Accumulated {} tithe(s)", found);
                    } else {
                        debug!("[ISS-SCANNER] No new blocks");
                    }
                }
                Err(e) => {
                    warn!("[ISS-SCANNER] Scan error: {}", e);
                }
            }
            sleep(self.config.poll_interval).await;
        }
    }

    async fn scan_new_blocks(&self) -> IssobellaResult<u64> {
        let tip_height = self.get_chain_height().await?;

        let cursor = {
            let db = self.db.lock().unwrap();
            db.get_fund_balance()?.last_block_height
        };

        let safe_height = tip_height.saturating_sub(self.config.finality_blocks);
        if cursor >= safe_height {
            return Ok(0);
        }

        let mut tithes_found = 0u64;

        for height in (cursor + 1)..=safe_height {
            let block = match self.get_block(height).await {
                Ok(b) => b,
                Err(e) => {
                    warn!("[ISS-SCANNER] Failed to fetch block {}: {}", height, e);
                    break;
                }
            };

            // The coinbase is the first transaction and contains the miner,
            // humanitarian, Issobella, and (post-activation) node-reward outputs.
            // We scan all transactions and all outputs to avoid depending on the
            // exact position of the coinbase or the response field name.
            for tx in &block.transactions {
                for output in &tx.outputs {
                    if output.address == self.config.fund_address {
                        let db = self.db.lock().unwrap();
                        let mut balance = db.get_fund_balance()?;
                        balance.total_accumulated += output.amount;
                        balance.last_block_height = height;
                        balance.updated_at = chrono::Utc::now().to_rfc3339();
                        db.update_fund_balance(&balance)?;
                        tithes_found += 1;
                        info!(
                            "[ISS-SCANNER] Tithe @ block {}: {} flowers → total {} flowers",
                            height, output.amount, balance.total_accumulated
                        );
                    }
                }
            }

            self.blocks_scanned
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        }

        Ok(tithes_found)
    }

    // ── L1 RPC helpers ──

    async fn rpc<T: for<'de> Deserialize<'de>>(
        &self,
        method: &str,
        params: serde_json::Value,
    ) -> IssobellaResult<T> {
        let request = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": method,
            "params": params,
        })
        .to_string();

        let addr = normalize_rpc_addr(&self.config.rpc_url);
        let mut stream = TcpStream::connect(&addr)
            .await
            .map_err(|e| crate::error::IssobellaError::L1Rpc(format!("connect: {}", e)))?;
        stream
            .write_all(request.as_bytes())
            .await
            .map_err(|e| crate::error::IssobellaError::L1Rpc(format!("write: {}", e)))?;
        stream
            .write_all(b"\n")
            .await
            .map_err(|e| crate::error::IssobellaError::L1Rpc(format!("newline: {}", e)))?;

        let mut reader = BufReader::new(stream);
        let mut line = String::new();
        reader
            .read_line(&mut line)
            .await
            .map_err(|e| crate::error::IssobellaError::L1Rpc(format!("read: {}", e)))?;

        #[derive(Deserialize)]
        struct RpcResponse<T> {
            result: Option<T>,
            error: Option<serde_json::Value>,
        }

        let rpc_resp: RpcResponse<T> = serde_json::from_str(line.trim())
            .map_err(|e| crate::error::IssobellaError::L1Rpc(format!("parse: {}", e)))?;

        if let Some(err) = rpc_resp.error {
            return Err(crate::error::IssobellaError::L1Rpc(format!(
                "rpc error: {}",
                err
            )));
        }

        rpc_resp
            .result
            .ok_or_else(|| crate::error::IssobellaError::L1Rpc("null result".to_string()))
    }

    async fn get_chain_height(&self) -> IssobellaResult<u64> {
        #[derive(Deserialize)]
        struct Info {
            chain_height: u64,
        }
        let info: Info = self.rpc("getChainInfo", serde_json::json!({})).await?;
        Ok(info.chain_height)
    }

    async fn get_block(&self, height: u64) -> IssobellaResult<BlockInfo> {
        self.rpc("getBlockByHeight", serde_json::json!({ "height": height }))
            .await
    }
}

fn normalize_rpc_addr(raw: &str) -> String {
    raw.trim()
        .trim_start_matches("http://")
        .trim_start_matches("https://")
        .trim_start_matches("tcp://")
        .split('/')
        .next()
        .unwrap_or(raw)
        .to_string()
}

#[derive(Debug, Deserialize)]
struct BlockInfo {
    /// V31 native blocks return the coinbase (and all other transactions)
    /// under `transactions`. Keep `utxo_transactions` as a fallback for
    /// legacy/V3-compat responses.
    #[serde(default, alias = "utxo_transactions")]
    transactions: Vec<UtxoTransaction>,
}

#[derive(Debug, Deserialize)]
struct UtxoTransaction {
    #[serde(default)]
    outputs: Vec<TxOutput>,
}

#[derive(Debug, Deserialize)]
struct TxOutput {
    address: String,
    amount: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_v31_native_block_transactions() {
        let raw = r#"{
            "height": 1234,
            "transactions": [
                {
                    "tx_id": "abc",
                    "inputs": [],
                    "outputs": [
                        { "amount": 480506000, "address": "zion1miner" },
                        { "amount": 27000350, "address": "zion1y3w4z0c755v4y7t3f0k6s54390x0h3k3y5hv8c8" },
                        { "amount": 27000350, "address": "zion1z4s3a54266f2x7j4x7c27297k49752t7k52l0f0" }
                    ]
                }
            ]
        }"#;
        let block: BlockInfo = serde_json::from_str(raw).unwrap();
        assert_eq!(block.transactions.len(), 1);
        assert_eq!(block.transactions[0].outputs.len(), 3);
    }

    #[test]
    fn parse_legacy_utxo_transactions() {
        let raw = r#"{
            "height": 1234,
            "utxo_transactions": [
                { "outputs": [{ "amount": 1000, "address": "zion1z4s3a54266f2x7j4x7c27297k49752t7k52l0f0" }] }
            ]
        }"#;
        let block: BlockInfo = serde_json::from_str(raw).unwrap();
        assert_eq!(block.transactions.len(), 1);
        assert_eq!(block.transactions[0].outputs[0].amount, 1000);
    }

    #[test]
    fn normalize_rpc_addr_strips_http_and_path() {
        assert_eq!(
            normalize_rpc_addr("http://127.0.0.1:9445/jsonrpc"),
            "127.0.0.1:9445"
        );
        assert_eq!(
            normalize_rpc_addr("https://rpc.example.com:8443"),
            "rpc.example.com:8443"
        );
        assert_eq!(normalize_rpc_addr("tcp://127.0.0.1:9445"), "127.0.0.1:9445");
    }
}
