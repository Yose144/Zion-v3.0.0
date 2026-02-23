//! EVM Chain Watcher — listens for wZION BridgeBurn events on EVM chains.
//!
//! Subscribes to BridgeBurn events from the wZION contract.
//! When a burn is detected and finalized, sends it to the relayer
//! to submit an L1 unlock transaction.
//!
//! ## Auto-reconnect (B-02)
//!
//! The watcher automatically reconnects on WebSocket failure using
//! exponential backoff: 5s → 10s → 20s → 40s → 80s (max 5 retries → error).
//! On successful poll, the backoff counter resets to 0.

use crate::config::EvmChainConfig;
use crate::types::{BridgeStatus, EvmBurnEvent};
use anyhow::Result;
use chrono::Utc;
use ethers::prelude::*;
use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::{debug, error, info, warn};

// ABI for the BridgeBurn event from wZION contract
abigen!(
    WZIONEvents,
    r#"[
        event BridgeBurn(address indexed from, uint256 amount, string l1Recipient, bytes32 indexed burnId, uint256 timestamp)
    ]"#
);

// ─────────────────────────────────────────────────────────────────────────────
// Auto-reconnect constants (B-02)
// ─────────────────────────────────────────────────────────────────────────────

/// Maximum block range per eth_getLogs call (publicnode limit: 50000).
const MAX_BLOCK_RANGE: u64 = 49_000;

/// Maximum reconnect attempts before giving up (returns Err to the caller
/// which will restart the task via the bridge daemon).
const MAX_RETRIES: u32 = 5;

/// Base backoff in seconds — doubles each attempt (5→10→20→40→80s).
const BACKOFF_BASE_SECS: u64 = 5;

/// EVM watcher for a single chain.
pub struct EvmWatcher {
    config: EvmChainConfig,
    last_processed_block: u64,
}

impl EvmWatcher {
    pub fn new(config: EvmChainConfig, start_block: Option<u64>) -> Self {
        Self {
            config,
            last_processed_block: start_block.unwrap_or(0),
        }
    }

    /// Start the EVM watcher loop with auto-reconnect (B-02).
    /// Sends confirmed burn events to the channel.
    pub async fn run(&mut self, burn_tx: mpsc::Sender<EvmBurnEvent>) -> Result<()> {
        info!(
            "👁️ EVM Watcher started — chain: {} ({}), wZION: {}, finality: {} blocks",
            self.config.name,
            self.config.evm_chain_id,
            self.config.wzion_address,
            self.config.finality_blocks,
        );

        let mut retry_count = 0u32;

        loop {
            match self.connect_and_watch(&burn_tx).await {
                Ok(()) => {
                    // Returned normally (shouldn't happen — loop is infinite)
                    info!("[{}] Watcher loop exited cleanly", self.config.name);
                    return Ok(());
                }
                Err(e) => {
                    retry_count += 1;
                    if retry_count > MAX_RETRIES {
                        error!(
                            "[{}] EVM Watcher exceeded {} retries — giving up. Last error: {}",
                            self.config.name, MAX_RETRIES, e
                        );
                        return Err(e);
                    }

                    let backoff_secs = BACKOFF_BASE_SECS * (1 << (retry_count - 1).min(6));
                    warn!(
                        "[{}] EVM Watcher error (attempt {}/{}): {} — reconnecting in {}s",
                        self.config.name, retry_count, MAX_RETRIES, e, backoff_secs
                    );
                    tokio::time::sleep(std::time::Duration::from_secs(backoff_secs)).await;
                }
            }
        }
    }

    /// Inner loop: connect to EVM RPC and poll for new burn events.
    /// Returns Err on any connectivity issue (triggering auto-reconnect).
    async fn connect_and_watch(&mut self, burn_tx: &mpsc::Sender<EvmBurnEvent>) -> Result<()> {
        let provider = Provider::<Ws>::connect(&self.config.rpc_url)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to connect to EVM RPC {}: {}", self.config.rpc_url, e))?;

        let provider = Arc::new(provider);
        let wzion_addr: Address = self
            .config
            .wzion_address
            .parse()
            .map_err(|e| anyhow::anyhow!("Invalid wZION address: {}", e))?;

        let filter = Filter::new()
            .address(wzion_addr)
            .event("BridgeBurn(address,uint256,string,bytes32,uint256)");

        info!("📡 Connected to {} — polling BridgeBurn events", self.config.name);

        let mut interval = tokio::time::interval(std::time::Duration::from_secs(12));
        let mut consecutive_errors = 0u32;

        loop {
            interval.tick().await;

            match self.poll_burns(&provider, &filter, burn_tx).await {
                Ok(count) => {
                    consecutive_errors = 0; // reset on success
                    if count > 0 {
                        info!("{}: processed {} burn events", self.config.name, count);
                    }
                }
                Err(e) => {
                    consecutive_errors += 1;
                    warn!(
                        "[{}] poll error #{}: {:?}",
                        self.config.name, consecutive_errors, e
                    );
                    // After 3 consecutive poll errors, trigger reconnect
                    if consecutive_errors >= 3 {
                        return Err(anyhow::anyhow!(
                            "3 consecutive poll errors on {}: {}",
                            self.config.name,
                            e
                        ));
                    }
                }
            }
        }
    }

    async fn poll_burns(
        &mut self,
        provider: &Arc<Provider<Ws>>,
        base_filter: &Filter,
        burn_tx: &mpsc::Sender<EvmBurnEvent>,
    ) -> Result<usize> {
        let current_block = provider.get_block_number().await?.as_u64();
        let finalized_block = current_block.saturating_sub(self.config.finality_blocks);

        if finalized_block <= self.last_processed_block {
            return Ok(0);
        }

        let from = self.last_processed_block + 1;
        let to = finalized_block;

        debug!(
            "{}: scanning blocks {} → {} (current: {}, finalized: {})",
            self.config.name, from, to, current_block, finalized_block
        );

        // Chunk requests to stay within publicnode limit of 50k blocks per getLogs call
        let mut total_count = 0usize;
        let mut chunk_from = from;

        while chunk_from <= to {
            let chunk_to = (chunk_from + MAX_BLOCK_RANGE - 1).min(to);
            if chunk_from < to {
                debug!(
                    "{}: chunk {} → {} (of {})",
                    self.config.name, chunk_from, chunk_to, to
                );
            }

            let filter = base_filter.clone().from_block(chunk_from).to_block(chunk_to);
            let logs = provider.get_logs(&filter).await?;
            let count = logs.len();
            total_count += count;

            for log in logs {
                match self.parse_burn_event(log) {
                    Ok(burn) => {
                        info!(
                            "🔥 Burn detected on {}: {} wZION → {} (burn_id: {})",
                            self.config.name, burn.amount_wzion, burn.l1_recipient, burn.burn_id,
                        );
                        if let Err(e) = burn_tx.send(burn).await {
                            error!("Failed to send burn event: {:?}", e);
                        }
                    }
                    Err(e) => {
                        warn!("{}: failed to parse burn event: {:?}", self.config.name, e);
                    }
                }
            }

            chunk_from = chunk_to + 1;
        }

        self.last_processed_block = to;
        Ok(total_count)
    }

    fn parse_burn_event(&self, log: Log) -> Result<EvmBurnEvent> {
        let from = Address::from(log.topics.get(1).copied().unwrap_or_default());
        let burn_id = log.topics.get(2).copied().unwrap_or_default();

        let data = &log.data;

        if data.len() < 128 {
            return Err(anyhow::anyhow!(
                "BridgeBurn event data too short: {} bytes (need ≥128)",
                data.len()
            ));
        }

        let amount = U256::from_big_endian(&data[0..32]);
        let string_offset = U256::from_big_endian(&data[32..64]).as_usize();
        let _timestamp = U256::from_big_endian(&data[64..96]);

        if data.len() < string_offset + 32 {
            return Err(anyhow::anyhow!(
                "BridgeBurn event data truncated at string offset {}",
                string_offset
            ));
        }
        let string_len = U256::from_big_endian(&data[string_offset..string_offset + 32]).as_usize();

        let string_start = string_offset + 32;
        let string_end = string_start + string_len;

        if data.len() < string_end {
            return Err(anyhow::anyhow!(
                "BridgeBurn event data truncated: need {} bytes for l1Recipient, have {}",
                string_end,
                data.len()
            ));
        }

        let l1_recipient = String::from_utf8(data[string_start..string_end].to_vec())
            .map_err(|e| anyhow::anyhow!("Invalid UTF-8 in l1Recipient: {}", e))?;

        if !l1_recipient.starts_with("zion1") {
            warn!(
                "Parsed l1_recipient '{}' does not start with 'zion1' — possible decoding error",
                l1_recipient
            );
        }

        let burn_event = EvmBurnEvent {
            evm_tx_hash: format!("{:?}", log.transaction_hash.unwrap_or_default()),
            evm_block_number: log.block_number.map(|n| n.as_u64()).unwrap_or(0),
            evm_chain: self.config.chain_id.clone(),
            evm_burner: format!("{:?}", from),
            amount_wzion: amount.to_string(),
            amount_l1_atomic: crate::types::conversion::wzion_wei_to_l1_atomic(&amount.to_string())
                .unwrap_or(0),
            l1_recipient,
            burn_id: format!("{:?}", burn_id),
            detected_at: Utc::now(),
            status: BridgeStatus::Confirmed,
            confirmations: 0,
        };

        Ok(burn_event)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_reconnect_constants() {
        // Backoff sequence: 5, 10, 20, 40, 80
        for attempt in 1u32..=5 {
            let secs = BACKOFF_BASE_SECS * (1 << (attempt - 1).min(6));
            assert!(secs <= 80, "Backoff at attempt {} should be ≤80s, got {}s", attempt, secs);
        }
    }

    #[test]
    fn test_max_retries_constant() {
        assert_eq!(MAX_RETRIES, 5);
    }

    #[test]
    fn test_watcher_new() {
        let config = EvmChainConfig {
            chain_id: "base".into(),
            name: "Base".into(),
            evm_chain_id: 8453,
            rpc_url: "wss://base-rpc.example.com".into(),
            rpc_url_backup: None,
            wzion_address: "0x742d35Cc6634C0532925a3b8D4C9C5B2C39b8F2".into(),
            bridge_contract_address: "0xabc".into(),
            finality_blocks: 12,
            enabled: true,
            gas_strategy: "eip1559".into(),
            max_gas_gwei: 100,
            start_block: None,
        };
        let watcher = EvmWatcher::new(config, Some(1_000_000));
        assert_eq!(watcher.last_processed_block, 1_000_000);
    }
}
