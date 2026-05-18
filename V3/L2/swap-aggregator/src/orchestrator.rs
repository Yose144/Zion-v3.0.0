use std::sync::Arc;

use anyhow::Result;
use tokio::sync::Mutex;
use tracing::{info, warn};

use crate::db::SwapDb;
use crate::types::{QuoteRequest, QuoteResponse, SwapDirection, SwapId, SwapRecord, SwapStatus};

/// Configuration for the swap orchestrator
#[derive(Debug, Clone)]
pub struct OrchestratorConfig {
    pub bridge_api_url: String,
    pub base_rpc_url: String,
    pub wzion_address: String,
    pub univ3_pool_address: String,
    pub univ3_router_address: String,
    pub quoter_v2_address: String,
    pub weth_address: String,
    pub usdc_address: String,
    pub min_amount_atomic: u128,
    pub max_slippage_bps: u16,
}

impl Default for OrchestratorConfig {
    fn default() -> Self {
        Self {
            bridge_api_url: "http://localhost:8443".into(),
            base_rpc_url: "https://mainnet.base.org".into(),
            wzion_address: "0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6".into(),
            univ3_pool_address: "0xa88C4C89EB4597Df2e29A8061895300FcDF44FBB".into(),
            univ3_router_address: "0x2626664c2603336E57B271c5C0b26F421741e481".into(),
            quoter_v2_address: "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a".into(),
            weth_address: "0x4200000000000000000000000000000000000006".into(),
            usdc_address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913".into(),
            min_amount_atomic: 1_000_000_000_000, // 1 ZION
            max_slippage_bps: 500,                // 5%
        }
    }
}

/// Swap orchestrator that manages the end-to-end swap flow
pub struct SwapOrchestrator {
    pub config: OrchestratorConfig,
    pub db: Arc<Mutex<SwapDb>>,
    #[allow(dead_code)] // reserved for future EVM RPC calls
    client: reqwest::Client,
}

impl SwapOrchestrator {
    pub fn new(config: OrchestratorConfig, db: Arc<Mutex<SwapDb>>) -> Self {
        Self {
            config,
            db,
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .expect("valid reqwest client"),
        }
    }

    /// Create and persist a new swap request
    pub async fn create_swap(&self, req: crate::types::SwapRequest) -> Result<SwapRecord> {
        let record = SwapRecord::new(req);
        let db = self.db.lock().await;
        db.insert(&record)?;
        info!(swap_id = %record.id, "Created new swap request");
        Ok(record)
    }

    /// Get a swap by ID
    pub async fn get_swap(&self, id: &SwapId) -> Result<Option<SwapRecord>> {
        let db = self.db.lock().await;
        db.get(id)
    }

    /// List recent swaps
    pub async fn list_swaps(&self, limit: usize) -> Result<Vec<SwapRecord>> {
        let db = self.db.lock().await;
        db.list_recent(limit)
    }

    /// Get a price quote without executing
    pub async fn quote(&self, req: QuoteRequest) -> Result<QuoteResponse> {
        // For now, return a placeholder quote
        // In production, this would call Uni V3 QuoterV2
        let amount_in: u128 = req.amount_in.parse().unwrap_or(0);
        let estimated_out = amount_in / 10_000; // placeholder ratio

        let min_amount_out =
            estimated_out.saturating_mul((10_000 - self.config.max_slippage_bps as u128) / 10_000);

        Ok(QuoteResponse {
            amount_in: req.amount_in,
            amount_out: estimated_out.to_string(),
            output_token: req.output_token,
            price_impact_bps: 50,
            min_amount_out: min_amount_out.to_string(),
            slippage_bps: self.config.max_slippage_bps,
            route: "wZION→WETH→USDC".into(),
            fee_tier_bps: 30,
        })
    }

    /// Run the swap pipeline for a single swap
    pub async fn process_swap(&self, id: &SwapId) -> Result<()> {
        let mut record = {
            let db = self.db.lock().await;
            match db.get(id)? {
                Some(r) => r,
                None => {
                    warn!(swap_id = %id, "Swap not found for processing");
                    return Ok(());
                }
            }
        };

        if record.status != SwapStatus::Pending && record.status != SwapStatus::Locking {
            return Ok(());
        }

        match record.direction {
            SwapDirection::ZionToEvm => {
                self.process_zion_to_evm(&mut record).await?;
            }
            SwapDirection::EvmToZion => {
                self.process_evm_to_zion(&mut record).await?;
            }
        }

        Ok(())
    }

    async fn process_zion_to_evm(&self, record: &mut SwapRecord) -> Result<()> {
        // Step 1: Lock ZION on L1
        if record.status == SwapStatus::Pending {
            info!(swap_id = %record.id, "Step 1: Locking ZION on L1");
            {
                let db = self.db.lock().await;
                db.update_status(&record.id, SwapStatus::Locking)?;
            }
            record.status = SwapStatus::Locking;

            // Placeholder: in production, submit lock TX via bridge API
            tokio::time::sleep(std::time::Duration::from_secs(2)).await;
            record.l1_lock_tx = Some(format!("0xlock_{}", &record.id[..8]));
            {
                let db = self.db.lock().await;
                db.update_txs(&record.id, record.l1_lock_tx.as_deref(), None, None, None)?;
            }
        }

        // Step 2: Wait for bridge mint
        if record.status == SwapStatus::Locking {
            info!(swap_id = %record.id, "Step 2: Waiting for bridge mint");
            {
                let db = self.db.lock().await;
                db.update_status(&record.id, SwapStatus::Bridging)?;
            }
            record.status = SwapStatus::Bridging;

            // Placeholder: poll bridge status
            tokio::time::sleep(std::time::Duration::from_secs(2)).await;
            record.bridge_mint_tx = Some(format!("0xmint_{}", &record.id[..8]));
            {
                let db = self.db.lock().await;
                db.update_txs(
                    &record.id,
                    None,
                    record.bridge_mint_tx.as_deref(),
                    None,
                    None,
                )?;
            }
        }

        // Step 3: Swap on Uni V3
        if record.status == SwapStatus::Bridging {
            info!(swap_id = %record.id, "Step 3: Swapping on Uni V3");
            {
                let db = self.db.lock().await;
                db.update_status(&record.id, SwapStatus::Swapping)?;
            }
            record.status = SwapStatus::Swapping;

            // Placeholder: execute swap via EVM RPC
            tokio::time::sleep(std::time::Duration::from_secs(2)).await;
            record.swap_tx = Some(format!("0xswap_{}", &record.id[..8]));
            record.amount_out =
                Some((record.amount_in.parse::<u128>().unwrap_or(0) / 10_000).to_string());
            {
                let db = self.db.lock().await;
                db.update_txs(
                    &record.id,
                    None,
                    None,
                    record.swap_tx.as_deref(),
                    record.amount_out.as_deref(),
                )?;
                db.update_status(&record.id, SwapStatus::Completed)?;
            }
            record.status = SwapStatus::Completed;
            info!(swap_id = %record.id, "Swap completed successfully");
        }

        Ok(())
    }

    async fn process_evm_to_zion(&self, record: &mut SwapRecord) -> Result<()> {
        // EVM → ZION flow: swap ETH→wZION → burn wZION → wait for L1 unlock
        if record.status == SwapStatus::Pending {
            info!(swap_id = %record.id, "Step 1: Swapping ETH→wZION on Uni V3");
            {
                let db = self.db.lock().await;
                db.update_status(&record.id, SwapStatus::Swapping)?;
            }
            record.status = SwapStatus::Swapping;

            tokio::time::sleep(std::time::Duration::from_secs(2)).await;
            record.swap_tx = Some(format!("0xswap_{}", &record.id[..8]));
            {
                let db = self.db.lock().await;
                db.update_txs(&record.id, None, None, record.swap_tx.as_deref(), None)?;
            }
        }

        if record.status == SwapStatus::Swapping {
            info!(swap_id = %record.id, "Step 2: Burning wZION for bridge unlock");
            {
                let db = self.db.lock().await;
                db.update_status(&record.id, SwapStatus::Bridging)?;
            }
            record.status = SwapStatus::Bridging;

            tokio::time::sleep(std::time::Duration::from_secs(2)).await;
            record.bridge_mint_tx = Some(format!("0xburn_{}", &record.id[..8]));
            {
                let db = self.db.lock().await;
                db.update_txs(
                    &record.id,
                    None,
                    record.bridge_mint_tx.as_deref(),
                    None,
                    None,
                )?;
            }
        }

        if record.status == SwapStatus::Bridging {
            info!(swap_id = %record.id, "Step 3: Waiting for L1 unlock");
            tokio::time::sleep(std::time::Duration::from_secs(2)).await;
            record.l1_lock_tx = Some(format!("0xunlock_{}", &record.id[..8]));
            record.amount_out = Some(record.amount_in.clone()); // 1:1 after fees
            {
                let db = self.db.lock().await;
                db.update_txs(
                    &record.id,
                    record.l1_lock_tx.as_deref(),
                    None,
                    None,
                    record.amount_out.as_deref(),
                )?;
                db.update_status(&record.id, SwapStatus::Completed)?;
            }
            record.status = SwapStatus::Completed;
            info!(swap_id = %record.id, "Reverse swap completed successfully");
        }

        Ok(())
    }
}
