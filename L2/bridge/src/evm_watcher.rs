//! EVM Chain Watcher — listens for wZION BridgeBurn events on EVM chains.
//!
//! Subscribes to BridgeBurn events from the wZION contract.
//! When a burn is detected and finalized, sends it to the relayer
//! to submit an L1 unlock transaction.

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

    /// Start the EVM watcher loop. Sends confirmed burn events to the channel.
    pub async fn run(&mut self, burn_tx: mpsc::Sender<EvmBurnEvent>) -> Result<()> {
        info!(
            "👁️ EVM Watcher started — chain: {} ({}), wZION: {}, finality: {} blocks",
            self.config.name,
            self.config.evm_chain_id,
            self.config.wzion_address,
            self.config.finality_blocks,
        );

        let provider = Provider::<Ws>::connect(&self.config.rpc_url)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to connect to EVM RPC: {}", e))?;

        let provider = Arc::new(provider);
        let wzion_addr: Address = self
            .config
            .wzion_address
            .parse()
            .map_err(|e| anyhow::anyhow!("Invalid wZION address: {}", e))?;

        // Build event filter for BridgeBurn
        let filter = Filter::new()
            .address(wzion_addr)
            .event("BridgeBurn(address,uint256,string,bytes32,uint256)");

        info!(
            "📡 Subscribing to BridgeBurn events on {}",
            self.config.name
        );

        // Use polling for broader compatibility
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(12));

        loop {
            interval.tick().await;

            match self.poll_burns(&provider, &filter, &burn_tx).await {
                Ok(count) => {
                    if count > 0 {
                        info!("{}: processed {} burn events", self.config.name, count);
                    }
                }
                Err(e) => {
                    error!("{}: poll error: {:?}", self.config.name, e);
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

        let filter = base_filter.clone().from_block(from).to_block(to);

        let logs = provider.get_logs(&filter).await?;
        let count = logs.len();

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

        self.last_processed_block = to;
        Ok(count)
    }

    fn parse_burn_event(&self, log: Log) -> Result<EvmBurnEvent> {
        // Parse indexed topics:
        //   topic[0] = event signature hash
        //   topic[1] = from (address, indexed)
        //   topic[2] = burnId (bytes32, indexed)
        let from = Address::from(log.topics.get(1).copied().unwrap_or_default());
        let burn_id = log.topics.get(2).copied().unwrap_or_default();

        // Parse non-indexed data: ABI-encoded (uint256 amount, string l1Recipient, uint256 timestamp)
        //
        // ABI layout for (uint256, string, uint256):
        //   [0..32]    = amount (uint256)
        //   [32..64]   = offset to string data (always 0x60 = 96 for this layout)
        //   [64..96]   = timestamp (uint256)
        //   [96..128]  = string length (uint256)
        //   [128..]    = string data (UTF-8, padded to 32-byte boundary)
        let data = &log.data;

        if data.len() < 128 {
            return Err(anyhow::anyhow!(
                "BridgeBurn event data too short: {} bytes (need ≥128)",
                data.len()
            ));
        }

        // Slot 0: amount (uint256)
        let amount = U256::from_big_endian(&data[0..32]);

        // Slot 1: offset to string data (should be 0x60 = 96)
        let string_offset = U256::from_big_endian(&data[32..64]).as_usize();

        // Slot 2: timestamp (uint256)
        let _timestamp = U256::from_big_endian(&data[64..96]);

        // At string_offset: string length + string bytes
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

        // Validate l1_recipient looks like a ZION address (starts with "zion1")
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
