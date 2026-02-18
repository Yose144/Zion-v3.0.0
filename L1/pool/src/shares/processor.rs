/// Share Processing Pipeline - Integration of validation + storage
///
/// Complete flow:
/// 1. Receive share from miner (via Stratum)
/// 2. Validate share (algorithm-specific)
/// 3. Store in Redis (if valid)
/// 4. Update miner stats
/// 5. Check for block (notify if found)
/// 6. Return result to miner
///
/// This module ties validator.rs + storage.rs together

use anyhow::Result;
use chrono::Utc;
use hex::FromHex;
use std::sync::Arc;

use super::storage::{BlockFound, RedisStorage, StoredShare};
use super::validator::{ShareResult, ShareValidator, SubmittedShare};
use crate::pplns::PPLNSCalculator;
use crate::blockchain::ZionRPCClient;
use crate::merged_mining::MergedMiningManager;
use zion_core::blockchain::block::Block;
use zion_core::blockchain::reward as core_reward;
use zion_core::tx::{Transaction, TxOutput};

#[derive(Debug, Clone)]
pub struct ProcessedShareOutcome {
    pub result: ShareResult,
}

/// Share processor - orchestrates validation + storage
pub struct ShareProcessor {
    validator: Arc<ShareValidator>,
    storage: Arc<RedisStorage>,
    rpc_client: Option<Arc<ZionRPCClient>>,
    merged_mining: Option<Arc<MergedMiningManager>>,
    pool_wallet: String,
    humanitarian_wallet: String,
    issobella_wallet: String,
    pool_fee_percent: f64,
    humanitarian_tithe_percent: f64,
    issobella_fund_percent: f64,
    pplns_window_shares: u64,
}

impl ShareProcessor {
    /// Create new share processor
    pub fn new(
        validator: Arc<ShareValidator>,
        storage: Arc<RedisStorage>,
        rpc_client: Option<Arc<ZionRPCClient>>,
        pool_wallet: String,
        humanitarian_wallet: String,
        pool_fee_percent: f64,
        humanitarian_tithe_percent: f64,
        pplns_window_shares: u64,
    ) -> Self {
        Self::new_with_merged_mining(
            validator,
            storage,
            rpc_client,
            None,
            pool_wallet,
            humanitarian_wallet,
            pool_fee_percent,
            humanitarian_tithe_percent,
            pplns_window_shares,
        )
    }

    /// Set L5/L6 ZION Issobella fund wallet and percentage.
    pub fn with_issobella_fund(mut self, wallet: String, percent: f64) -> Self {
        self.issobella_wallet = wallet;
        self.issobella_fund_percent = percent;
        self
    }

    /// Create new share processor with optional CHv3 byproduct/merged mining manager.
    pub fn new_with_merged_mining(
        validator: Arc<ShareValidator>,
        storage: Arc<RedisStorage>,
        rpc_client: Option<Arc<ZionRPCClient>>,
        merged_mining: Option<Arc<MergedMiningManager>>,
        pool_wallet: String,
        humanitarian_wallet: String,
        pool_fee_percent: f64,
        humanitarian_tithe_percent: f64,
        pplns_window_shares: u64,
    ) -> Self {
        let issobella_fund_percent = 5.0; // default L5/L6 ZION Issobella fund
        let miner_pct = 100.0 - pool_fee_percent - humanitarian_tithe_percent - issobella_fund_percent;
        tracing::info!(
            "💰 ShareProcessor fee split: miners={:.0}%, humanitarian={:.0}%, issobella={:.0}%, pool={:.0}%",
            miner_pct, humanitarian_tithe_percent, issobella_fund_percent, pool_fee_percent
        );
        if humanitarian_wallet.is_empty() {
            tracing::warn!("⚠️  No humanitarian_wallet configured — tithe will stay in pool wallet");
        }
        Self {
            validator,
            storage,
            rpc_client,
            merged_mining,
            pool_wallet,
            humanitarian_wallet,
            issobella_wallet: String::new(),
            pool_fee_percent,
            humanitarian_tithe_percent,
            issobella_fund_percent,
            pplns_window_shares,
        }
    }

    /// Process a submitted share (main entry point)
    pub async fn process_share(
        &self,
        share: &SubmittedShare,
        miner_address: &str,
    ) -> Result<ProcessedShareOutcome> {
        // Step 1: Validate share (miner_address used for per-miner dedup)
        let result = self.validator.validate_share(share, miner_address).await;

        // Step 2: Handle validation result
        if result.valid {
            // Store valid share
            let stored = StoredShare {
                job_id: share.job_id.clone(),
                miner_address: miner_address.to_string(),
                nonce: share.nonce.clone(),
                hash: result.hash_value.clone().unwrap_or_default(),
                difficulty: result.difficulty,
                algorithm: share.algorithm.clone(),
                timestamp: Utc::now().timestamp(),
                is_block: result.is_block,
                job_blob: Some(share.job_blob.clone()),
                height: share.height,
            };

            if let Err(e) = self.storage.store_share(&stored).await {
                tracing::error!("Failed to store share: {}", e);
                crate::metrics::prometheus::inc_redis_errors();
            }

            // Per-miner Prometheus metric
            crate::metrics::prometheus::inc_miner_share(miner_address, true);

            // CHv3 byproducts (safe scaffolding): observe valid shares and sample intermediates.
            // This does NOT affect share validity, payouts, or consensus.
            if let Some(mm) = &self.merged_mining {
                // Only for CHv3/ZION shares (avoid extra work on other algos)
                if share.algorithm.eq_ignore_ascii_case("cosmic_harmony")
                    || share.algorithm.eq_ignore_ascii_case("cosmic_harmony_v3")
                    || share.algorithm.eq_ignore_ascii_case("cosmic")
                {
                    let height = share.height.unwrap_or(0);
                    mm.observe_valid_chv3_share(&share.job_blob, &share.nonce, height);
                }
            }

            // Step 3: Check if it's a block
            if result.is_block {
                crate::metrics::prometheus::inc_block_submit_attempts();
                let accepted = self.handle_block_found(&stored, miner_address).await?;

                if accepted {
                    crate::metrics::prometheus::inc_blocks_found();
                    crate::metrics::prometheus::inc_miner_blocks(miner_address);
                } else {
                    crate::metrics::prometheus::inc_block_submit_rejected();
                    tracing::warn!(
                        "Block candidate rejected (or submit failed): miner={} job_id={}",
                        miner_address,
                        stored.job_id
                    );
                }
            }
        } else {
            // Increment invalid counter
            if let Err(e) = self.storage.increment_invalid(miner_address).await {
                tracing::error!("Failed to increment invalid: {}", e);
            }
            // Per-miner Prometheus metric
            crate::metrics::prometheus::inc_miner_share(miner_address, false);
        }

        Ok(ProcessedShareOutcome { result })
    }

    /// Handle block found notification
    async fn handle_block_found(&self, share: &StoredShare, miner_address: &str) -> Result<bool> {
        tracing::info!(
            "🎉 BLOCK FOUND by {} - hash: {}",
            miner_address,
            share.hash
        );

        let template = share.job_blob.as_deref().and_then(parse_template_blob);
        let (version, tpl_height, prev_hash, tpl_merkle, timestamp, difficulty) = match template {
            Some(parsed) => parsed,
            None => {
                tracing::warn!("Invalid template blob; cannot submit block");
                return Ok(false);
            }
        };

        // Height must match the core-provided template.
        let height = tpl_height;

        // Calculate on-chain reward
        let coinbase_reward = core_reward::calculate(height, difficulty);

        // Submit to core (optional in dev/test)
        if let Some(rpc) = &self.rpc_client {
            let nonce = u64::from_str_radix(&share.nonce, 16).unwrap_or(0);

            // Submit using blob + nonce + wallet as array
            // This ensures core reconstructs coinbase with matching merkle root
            if let Some(blob) = &share.job_blob {
                let accepted = rpc.submit_block_with_nonce(
                    blob,
                    nonce,
                    &self.pool_wallet,
                ).await.unwrap_or(false);
                
                if !accepted {
                    tracing::warn!(
                        "Block candidate rejected (or submit failed): miner={} job_id={}",
                        miner_address,
                        share.job_id
                    );
                    return Ok(false);
                }
            } else {
                tracing::warn!("No job blob available for block submission");
                return Ok(false);
            }
        }

        // Create block record
        let block = BlockFound {
            height,
            hash: share.hash.clone(),
            miner_address: miner_address.to_string(),
            reward: coinbase_reward,
            timestamp: share.timestamp,
            difficulty: share.difficulty,
        };

        // Store block
        let res = self.storage.store_block(&block).await;
        if res.is_err() {
            crate::metrics::prometheus::inc_redis_errors();
        }
        res?;

        // Calculate PPLNS payouts with proper fee split
        // Miner share = 100% - pool_fee - humanitarian_tithe - issobella_fund (default: 89%)
        let miner_pct = (100.0 - self.pool_fee_percent - self.humanitarian_tithe_percent - self.issobella_fund_percent) / 100.0;
        let miner_share = (coinbase_reward as f64 * miner_pct) as u64;
        let humanitarian_share = (coinbase_reward as f64 * (self.humanitarian_tithe_percent / 100.0)) as u64;
        let issobella_share = (coinbase_reward as f64 * (self.issobella_fund_percent / 100.0)) as u64;
        let pool_fee_share = coinbase_reward.saturating_sub(miner_share).saturating_sub(humanitarian_share).saturating_sub(issobella_share);

        tracing::info!(
            "💰 Block {} reward split: total={} | miners={}({:.0}%) | humanitarian={}({:.0}%) | issobella={}({:.0}%) | pool_fee={}({:.0}%)",
            height, coinbase_reward, miner_share, miner_pct * 100.0,
            humanitarian_share, self.humanitarian_tithe_percent,
            issobella_share, self.issobella_fund_percent,
            pool_fee_share, self.pool_fee_percent
        );

        let pplns = PPLNSCalculator::new(self.storage.clone(), self.pplns_window_shares);
        let payouts = pplns
            .calculate_distribution(
                height,
                block.hash.clone(),
                miner_share,
                miner_address.to_string(),
                block.timestamp,
            )
            .await?;
        pplns.queue_payouts(&payouts).await?;

        // Queue humanitarian tithe transfer (if wallet is configured)
        // P1-20: Retry with exponential backoff on failure (max 3 attempts)
        if !self.humanitarian_wallet.is_empty() && humanitarian_share > 0 {
            if let Some(rpc) = &self.rpc_client {
                let tithe_zion = humanitarian_share as f64 / 1_000_000.0;
                let mut tithe_sent = false;
                let max_retries: u32 = 3;
                for attempt in 0..max_retries {
                    match rpc.send_transaction(
                        &self.pool_wallet,
                        &self.humanitarian_wallet,
                        tithe_zion,
                        Some("humanitarian-tithe"),
                    ).await {
                        Ok(tx) => {
                            let tx_id = tx.get("tx_id")
                                .and_then(|v| v.as_str())
                                .or_else(|| tx.get("txid").and_then(|v| v.as_str()))
                                .unwrap_or("unknown");
                            tracing::info!(
                                "🕊️  Humanitarian tithe sent: {} ZION to {} (tx: {}, attempt {})",
                                tithe_zion, self.humanitarian_wallet, tx_id, attempt + 1
                            );
                            tithe_sent = true;
                            break;
                        }
                        Err(e) => {
                            let backoff_ms = 1000 * 2u64.pow(attempt);
                            tracing::warn!(
                                "⚠️  Humanitarian tithe attempt {}/{} failed: {} ZION to {} — {} (retry in {}ms)",
                                attempt + 1, max_retries, tithe_zion, self.humanitarian_wallet, e, backoff_ms
                            );
                            if attempt + 1 < max_retries {
                                tokio::time::sleep(tokio::time::Duration::from_millis(backoff_ms)).await;
                            }
                        }
                    }
                }
                if !tithe_sent {
                    tracing::error!(
                        "❌ Humanitarian tithe FAILED after {} attempts: {} ZION to {} — will be retried on next block",
                        max_retries, tithe_zion, self.humanitarian_wallet
                    );
                }
            }
        }

        Ok(true)
    }

    /// Get miner statistics
    pub async fn get_miner_stats(&self, address: &str) -> Result<super::storage::MinerStats> {
        self.storage.get_miner_stats(address).await
    }

    /// Get recent blocks
    pub async fn get_recent_blocks(&self, count: usize) -> Result<Vec<BlockFound>> {
        self.storage.get_recent_blocks(count).await
    }

    /// Health check
    pub async fn health_check(&self) -> Result<()> {
        self.storage.ping().await
    }
}

fn parse_template_blob(
    blob_hex: &str,
) -> Option<(u32, u64, String, String, u64, u64)> {
    let clean = blob_hex.trim_start_matches("0x");
    let bytes = Vec::from_hex(clean).ok()?;
    if bytes.len() < 156 {
        return None;
    }

    let version = u32::from_le_bytes(bytes[0..4].try_into().ok()?);
    let height = u64::from_le_bytes(bytes[4..12].try_into().ok()?);
    let prev_hash = String::from_utf8_lossy(&bytes[12..76])
        .trim_end_matches('\0')
        .to_string();
    let merkle_root = String::from_utf8_lossy(&bytes[76..140])
        .trim_end_matches('\0')
        .to_string();
    let timestamp = u64::from_le_bytes(bytes[140..148].try_into().ok()?);
    let difficulty = u64::from_le_bytes(bytes[148..156].try_into().ok()?);

    Some((version, height, prev_hash, merkle_root, timestamp, difficulty))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_processor_creation() {
        let validator = Arc::new(ShareValidator::new("big"));
        let storage = Arc::new(RedisStorage::new("redis://localhost", 1000).unwrap());
        let _processor = ShareProcessor::new(
            validator,
            storage,
            None,
            "ZION_TEST_WALLET".to_string(),
            "ZION_HUMANITARIAN_WALLET".to_string(),
            1.0,  // pool_fee_percent
            5.0,  // humanitarian_tithe_percent (5% humanitarian + 5% issobella = 10% social)
            1000,
        );
    }
}
