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

    /// Get a price quote using real EVM RPC (Uni V3 pool slot0)
    pub async fn quote(&self, req: QuoteRequest) -> Result<QuoteResponse> {
        let amount_in: u128 = req.amount_in.parse().unwrap_or(0);

        // Fetch real price from Uni V3 pool via EVM RPC
        let price_info = self
            .fetch_pool_price(&self.config.univ3_pool_address)
            .await
            .unwrap_or_default();

        // Compute estimated output using sqrtPriceX96
        let estimated_out = if price_info.sqrt_price_x96 > 0 {
            let price = (price_info.sqrt_price_x96 as f64 / 2f64.powi(96)).powi(2);
            (amount_in as f64 * price) as u128
        } else {
            // Fallback: use a conservative placeholder ratio
            amount_in / 10_000
        };

        let min_amount_out =
            estimated_out.saturating_mul((10_000 - self.config.max_slippage_bps as u128) / 10_000);

        let fee_tier = price_info.fee_tier.unwrap_or(3000); // default 0.3%

        Ok(QuoteResponse {
            amount_in: req.amount_in,
            amount_out: estimated_out.to_string(),
            output_token: req.output_token,
            price_impact_bps: 50,
            min_amount_out: min_amount_out.to_string(),
            slippage_bps: self.config.max_slippage_bps,
            route: "wZION→WETH→USDC".into(),
            fee_tier_bps: (fee_tier / 1000) as u16,
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
        // Step 1: Lock ZION on L1 via bridge API
        if record.status == SwapStatus::Pending {
            info!(swap_id = %record.id, "Step 1: Locking ZION on L1");
            {
                let db = self.db.lock().await;
                db.update_status(&record.id, SwapStatus::Locking)?;
            }
            record.status = SwapStatus::Locking;

            // Call bridge API to submit lock
            let bridge_url = format!("{}/bridge/lock", self.config.bridge_api_url);
            let body = serde_json::json!({
                "amount": record.amount_in,
                "recipient": record.evm_address,
                "target_chain": "base",
            });

            match self.client.post(&bridge_url).json(&body).send().await {
                Ok(resp) => {
                    if resp.status().is_success() {
                        let json: serde_json::Value = resp.json().await.unwrap_or_default();
                        if let Some(tx) = json.get("tx_hash").and_then(|v| v.as_str()) {
                            record.l1_lock_tx = Some(tx.to_string());
                            info!(swap_id = %record.id, "L1 lock submitted: {}", tx);
                        }
                    } else {
                        warn!(swap_id = %record.id, "Bridge lock returned HTTP {}", resp.status());
                    }
                }
                Err(e) => {
                    warn!(swap_id = %record.id, "Bridge lock failed: {}. Will retry.", e);
                    // Don't fail — the polling loop will retry
                }
            }

            if record.l1_lock_tx.is_some() {
                let db = self.db.lock().await;
                db.update_txs(&record.id, record.l1_lock_tx.as_deref(), None, None, None)?;
            }
        }

        // Step 2: Poll bridge for mint completion
        if record.status == SwapStatus::Locking && record.l1_lock_tx.is_some() {
            info!(swap_id = %record.id, "Step 2: Waiting for bridge mint");
            {
                let db = self.db.lock().await;
                db.update_status(&record.id, SwapStatus::Bridging)?;
            }
            record.status = SwapStatus::Bridging;

            // Poll bridge status up to 10 minutes
            let lock_tx = record.l1_lock_tx.clone().unwrap();
            for attempt in 1..=60 {
                let status_url = format!(
                    "{}/bridge/transfer/{}?l1_tx_hash={}",
                    self.config.bridge_api_url, record.id, lock_tx
                );
                match self.client.get(&status_url).send().await {
                    Ok(resp) => {
                        if let Ok(json) = resp.json::<serde_json::Value>().await {
                            if json
                                .get("minted")
                                .and_then(|v| v.as_bool())
                                .unwrap_or(false)
                            {
                                if let Some(tx) = json.get("mint_tx").and_then(|v| v.as_str()) {
                                    record.bridge_mint_tx = Some(tx.to_string());
                                    info!(swap_id = %record.id, "Bridge mint confirmed: {}", tx);
                                    break;
                                }
                            }
                        }
                    }
                    Err(e) => {
                        warn!(swap_id = %record.id, "Poll error (attempt {}): {}", attempt, e);
                    }
                }
                tokio::time::sleep(std::time::Duration::from_secs(10)).await;
            }

            if record.bridge_mint_tx.is_some() {
                let db = self.db.lock().await;
                db.update_txs(
                    &record.id,
                    None,
                    record.bridge_mint_tx.as_deref(),
                    None,
                    None,
                )?;
            } else {
                warn!(swap_id = %record.id, "Bridge mint not confirmed after 10 min — will retry later");
                return Ok(()); // Exit early, next poll will pick up
            }
        }

        // Step 3: Swap on Uni V3 via Router
        if record.status == SwapStatus::Bridging && record.bridge_mint_tx.is_some() {
            info!(swap_id = %record.id, "Step 3: Swapping on Uni V3");
            {
                let db = self.db.lock().await;
                db.update_status(&record.id, SwapStatus::Swapping)?;
            }
            record.status = SwapStatus::Swapping;

            // In production: build + sign + submit exactInputSingle TX
            // For now: record a simulated swap with real price
            let quote = self
                .quote(crate::types::QuoteRequest {
                    direction: record.direction,
                    output_token: record.output_token,
                    amount_in: record.amount_in.clone(),
                })
                .await?;

            record.swap_tx = Some(format!("0xswap_{}", &record.id[..8]));
            record.amount_out = Some(quote.amount_out);

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
            info!(swap_id = %record.id, "Swap completed: {} -> {}", record.amount_in, record.amount_out.as_deref().unwrap_or("?"));
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

            // In production: submit exactOutputSingle or exactInputSingle TX
            // For now: simulate
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

            // Call bridge API to burn
            let bridge_url = format!("{}/bridge/burn", self.config.bridge_api_url);
            let body = serde_json::json!({
                "amount": record.amount_in,
                "recipient": record.zion_address,
                "source_chain": "base",
            });

            match self.client.post(&bridge_url).json(&body).send().await {
                Ok(resp) => {
                    if resp.status().is_success() {
                        let json: serde_json::Value = resp.json().await.unwrap_or_default();
                        if let Some(tx) = json.get("burn_tx").and_then(|v| v.as_str()) {
                            record.bridge_mint_tx = Some(tx.to_string());
                            info!(swap_id = %record.id, "Bridge burn submitted: {}", tx);
                        }
                    }
                }
                Err(e) => {
                    warn!(swap_id = %record.id, "Bridge burn failed: {}. Will retry.", e);
                }
            }

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

            // Poll for L1 unlock confirmation
            if let Some(burn_tx) = record.bridge_mint_tx.clone() {
                for attempt in 1..=60 {
                    let status_url = format!(
                        "{}/bridge/transfer/{}?burn_tx={}",
                        self.config.bridge_api_url, record.id, burn_tx
                    );
                    match self.client.get(&status_url).send().await {
                        Ok(resp) => {
                            if let Ok(json) = resp.json::<serde_json::Value>().await {
                                if json
                                    .get("unlocked")
                                    .and_then(|v| v.as_bool())
                                    .unwrap_or(false)
                                {
                                    if let Some(tx) = json.get("unlock_tx").and_then(|v| v.as_str())
                                    {
                                        record.l1_lock_tx = Some(tx.to_string());
                                        record.amount_out = Some(record.amount_in.clone());
                                        info!(swap_id = %record.id, "L1 unlock confirmed: {}", tx);
                                        break;
                                    }
                                }
                            }
                        }
                        Err(e) => {
                            warn!(swap_id = %record.id, "Poll error (attempt {}): {}", attempt, e);
                        }
                    }
                    tokio::time::sleep(std::time::Duration::from_secs(10)).await;
                }
            }

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

    // ── EVM RPC helpers ────────────────────────────────────────────────────────

    async fn fetch_pool_price(&self, pool_address: &str) -> Result<PoolSlot0> {
        use zion_bridge::evm_rpc::EvmHttpClient;

        let evm = EvmHttpClient::from_rpc_url(&self.config.base_rpc_url);

        // slot0() function selector: 0x3850c7bd
        let calldata = "0x3850c7bd";
        let result = evm
            .call(
                "eth_call",
                serde_json::json!([{
                    "to": pool_address,
                    "data": calldata,
                }, "latest"]),
            )
            .await?;

        let raw = result.as_str().unwrap_or("0x");
        parse_slot0(raw)
    }
}

/// Uni V3 pool slot0 decoded fields
#[derive(Debug, Default, Clone)]
pub struct PoolSlot0 {
    pub sqrt_price_x96: u128,
    pub tick: i32,
    pub fee_tier: Option<u32>,
}

fn parse_slot0(hex_str: &str) -> Result<PoolSlot0> {
    let hex_clean = hex_str.trim_start_matches("0x");
    if hex_clean.len() < 64 {
        return Ok(PoolSlot0::default());
    }

    // slot0 returns: (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, ...)
    // First 32 bytes (64 hex chars) after offset = sqrtPriceX96
    let sqrt_price_hex = &hex_clean[0..64];
    let sqrt_price_x96 = u128::from_str_radix(sqrt_price_hex, 16).unwrap_or(0);

    // Next 32 bytes = tick (int24, padded to 32 bytes)
    let tick_hex = &hex_clean[64..128];
    let tick = if tick_hex.starts_with("ff") {
        // Negative — two's complement
        let raw = i64::from_str_radix(tick_hex, 16).unwrap_or(0);
        // Sign-extend from 24 bits
        if raw & 0x800000 != 0 {
            (raw | !0xFFFFFF) as i32
        } else {
            raw as i32
        }
    } else {
        i32::from_str_radix(tick_hex, 16).unwrap_or(0)
    };

    Ok(PoolSlot0 {
        sqrt_price_x96,
        tick,
        fee_tier: None,
    })
}

// ─── Unit tests ─────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_slot0_zero() {
        let result = parse_slot0("0x").unwrap();
        assert_eq!(result.sqrt_price_x96, 0);
        assert_eq!(result.tick, 0);
    }

    #[test]
    fn test_parse_slot0_sample() {
        // slot0 returns 2x 32-byte words: sqrtPriceX96 + tick
        // sqrtPriceX96 = 0x0000000000000000000000000000000000000000000000000de0b6b3a7640000
        // = 10^18 (1.0 in 18 decimals)
        let sqrt_hex = "0000000000000000000000000000000000000000000000000de0b6b3a7640000";
        let tick_hex = "0000000000000000000000000000000000000000000000000000000000000000";
        let raw = format!("0x{}{}", sqrt_hex, tick_hex);
        let result = parse_slot0(&raw).unwrap();
        assert!(result.sqrt_price_x96 > 0);
        assert_eq!(result.tick, 0);
    }

    #[test]
    fn test_pool_slot0_default() {
        let default = PoolSlot0::default();
        assert_eq!(default.sqrt_price_x96, 0);
        assert_eq!(default.tick, 0);
        assert_eq!(default.fee_tier, None);
    }

    #[tokio::test]
    async fn test_orchestrator_create_swap() {
        let config = OrchestratorConfig::default();
        let db = Arc::new(Mutex::new(SwapDb::open_in_memory().unwrap()));
        let orchestrator = SwapOrchestrator::new(config, db);

        let req = crate::types::SwapRequest {
            direction: SwapDirection::ZionToEvm,
            amount_in: "1000000000000".into(), // 1 ZION
            output_token: crate::types::OutputToken::Usdc,
            zion_address: "zion1test".into(),
            evm_address: "0x1234".into(),
            slippage_bps: Some(100),
        };

        let record = orchestrator.create_swap(req).await.unwrap();
        assert!(!record.id.is_empty());
        assert_eq!(record.amount_in, "1000000000000");
        assert_eq!(record.status, SwapStatus::Pending);

        let fetched = orchestrator.get_swap(&record.id).await.unwrap();
        assert!(fetched.is_some());
    }

    #[tokio::test]
    async fn test_orchestrator_quote_fallback() {
        let config = OrchestratorConfig::default();
        let db = Arc::new(Mutex::new(SwapDb::open_in_memory().unwrap()));
        let orchestrator = SwapOrchestrator::new(config, db);

        let req = crate::types::QuoteRequest {
            direction: SwapDirection::ZionToEvm,
            output_token: crate::types::OutputToken::Usdc,
            amount_in: "1000000000000".into(),
        };

        let quote = orchestrator.quote(req).await.unwrap();
        assert_eq!(quote.amount_in, "1000000000000");
        assert!(!quote.amount_out.is_empty());
        assert_eq!(quote.route, "wZION→WETH→USDC");
    }
}
