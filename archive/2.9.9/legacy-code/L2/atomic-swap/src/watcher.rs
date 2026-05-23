//! L1 block watcher — scans for SWAP:LOCK, SWAP:CLAIM, SWAP:REFUND memos.
//!
//! The watcher loops over new L1 blocks, inspects every transaction output
//! whose `address` equals the escrow address, parses the memo, and writes
//! HTLC records into the database.  Claim and refund memos trigger the
//! executor asynchronously.

use crate::config::SwapConfig;
use crate::db::SwapDb;
use crate::error::SwapResult;
use crate::executor::SwapExecutor;
use crate::types::{HtlcRecord, L1Block, SwapMemo, SwapState};
use chrono::Utc;
use reqwest::Client;
use std::sync::Arc;
use tokio::time::{Duration, sleep};
use tracing::{debug, error, info, warn};

// ─── L1Watcher ───────────────────────────────────────────────────────────────

pub struct L1Watcher {
    cfg: Arc<SwapConfig>,
    db: Arc<SwapDb>,
    executor: Arc<SwapExecutor>,
    client: Client,
    escrow_address: String,
}

impl L1Watcher {
    pub fn new(
        cfg: Arc<SwapConfig>,
        db: Arc<SwapDb>,
        executor: Arc<SwapExecutor>,
        escrow_address: String,
    ) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(15))
            .build()
            .expect("Failed to build HTTP client");
        Self {
            cfg,
            db,
            executor,
            client,
            escrow_address,
        }
    }

    /// Run forever — call once from `tokio::spawn`.
    pub async fn run(&self) {
        let interval = Duration::from_secs(self.cfg.l1.poll_interval_secs);
        info!(
            "🔍 L1 watcher started — escrow={} poll={}s",
            self.escrow_address, self.cfg.l1.poll_interval_secs
        );
        loop {
            if let Err(e) = self.tick().await {
                error!("Watcher tick error: {e}");
            }
            sleep(interval).await;
        }
    }

    // ── Single poll iteration ─────────────────────────────────────────────

    async fn tick(&self) -> SwapResult<()> {
        let current_height = match self.fetch_chain_height().await {
            Ok(h) => h,
            Err(e) => {
                warn!("Cannot fetch chain height: {e}");
                return Ok(());
            }
        };

        let scan_from = self.db.get_scan_height()?;
        if scan_from >= current_height {
            debug!("Watcher up-to-date at height {current_height}");
            return Ok(());
        }

        let scan_to = (scan_from + self.cfg.l1.scan_batch_size).min(current_height);
        debug!("Scanning L1 blocks {scan_from}..{scan_to}");

        for height in (scan_from + 1)..=scan_to {
            if let Err(e) = self.scan_block(height).await {
                warn!("Error scanning block {height}: {e}");
                // Don't advance cursor past the failed block
                break;
            }
            self.db.set_scan_height(height)?;
        }
        Ok(())
    }

    // ── Block scanning ────────────────────────────────────────────────────

    async fn scan_block(&self, height: u64) -> SwapResult<()> {
        let block = self.fetch_block(height).await?;
        for tx in &block.transactions {
            for output in &tx.outputs {
                // Only consider outputs sent to the escrow address
                if output.address != self.escrow_address {
                    continue;
                }
                let memo = match &output.memo {
                    Some(m) => m.as_str(),
                    None => continue,
                };
                let parsed = match SwapMemo::parse(memo) {
                    Some(m) => m,
                    None => continue,
                };
                if let Err(e) = self
                    .handle_memo(parsed, tx.id.clone(), output.amount, height)
                    .await
                {
                    error!("Error handling memo '{}' in tx {}: {e}", memo, tx.id);
                }
            }
        }
        Ok(())
    }

    async fn handle_memo(
        &self,
        memo: SwapMemo,
        tx_id: String,
        amount: u64,
        block_height: u64,
    ) -> SwapResult<()> {
        match memo {
            // ── LOCK ──────────────────────────────────────────────────────
            SwapMemo::Lock {
                hash_hex,
                timeout_minutes,
                counterparty_chain,
                counterparty_addr,
            } => {
                // De-duplicate: if we already have this hash, skip
                if self.db.get_htlc(&hash_hex)?.is_some() {
                    debug!("LOCK {hash_hex} already registered — skipping");
                    return Ok(());
                }

                let expires_at =
                    Utc::now().timestamp() + (timeout_minutes as i64 * 60);

                // We need to discover the locker's address from the TX inputs.
                // For now we store the tx_id; the executor can look it up.
                // In the serialised L1 TX the locker's address is in the
                // input's public_key → zion1 address.  We derive it via the
                // full TX fetch.
                let locker_address = self
                    .fetch_tx_sender(&tx_id)
                    .await
                    .unwrap_or_else(|_| "unknown".into());

                // Sanity: enforce config bounds
                let min = self.cfg.swap.min_lock_atomic;
                let max = self.cfg.swap.max_lock_atomic;
                if amount < min || amount > max {
                    warn!(
                        "LOCK {hash_hex} amount {amount} outside [{min},{max}] — rejected"
                    );
                    return Ok(());
                }

                let now = Utc::now();
                let rec = HtlcRecord {
                    hash_hex: hash_hex.clone(),
                    locker_address,
                    amount_atomic: amount,
                    lock_tx_id: tx_id.clone(),
                    lock_block_height: block_height,
                    expires_at,
                    counterparty_chain,
                    counterparty_addr,
                    state: SwapState::Pending,
                    release_tx_id: None,
                    release_recipient: None,
                    preimage_hex: None,
                    created_at: now,
                    updated_at: now,
                };

                self.db.insert_htlc(&rec)?;
                info!("🔒 HTLC locked  hash={hash_hex} amount={amount} tx={tx_id}");
            }

            // ── CLAIM ─────────────────────────────────────────────────────
            SwapMemo::Claim {
                hash_hex,
                preimage_hex,
            } => {
                info!("🔑 CLAIM memo   hash={hash_hex} tx={tx_id}");
                // Identify who sent this TX (= claimer / Bob) to know
                // where to send the released ZION.
                let claimer = self
                    .fetch_tx_sender(&tx_id)
                    .await
                    .unwrap_or_else(|_| "unknown".into());

                let executor = Arc::clone(&self.executor);
                let db = Arc::clone(&self.db);
                tokio::spawn(async move {
                    if let Err(e) = executor
                        .execute_claim(&db, &hash_hex, &preimage_hex, &claimer)
                        .await
                    {
                        error!("Claim execution failed for {hash_hex}: {e}");
                        let _ = db.mark_error(&hash_hex, &e.to_string());
                    }
                });
            }

            // ── REFUND ────────────────────────────────────────────────────
            SwapMemo::Refund { hash_hex } => {
                info!("↩️  REFUND memo  hash={hash_hex} tx={tx_id}");
                let executor = Arc::clone(&self.executor);
                let db = Arc::clone(&self.db);
                tokio::spawn(async move {
                    if let Err(e) = executor.execute_refund(&db, &hash_hex).await {
                        error!("Refund execution failed for {hash_hex}: {e}");
                        let _ = db.mark_error(&hash_hex, &e.to_string());
                    }
                });
            }
        }
        Ok(())
    }

    // ── L1 RPC helpers ────────────────────────────────────────────────────

    async fn fetch_chain_height(&self) -> SwapResult<u64> {
        let url = format!("{}/stats", self.cfg.l1.rpc_url);
        let mut req = self.client.get(&url);
        if let Some(tok) = self.cfg.rpc_token() {
            req = req.bearer_auth(tok);
        }
        let resp: serde_json::Value = req.send().await?.json().await?;
        let h = resp["height"].as_u64().ok_or_else(|| {
            crate::error::SwapError::L1Rpc("Missing 'height' in /stats".into())
        })?;
        Ok(h)
    }

    async fn fetch_block(&self, height: u64) -> SwapResult<L1Block> {
        let url = format!("{}/api/block/height/{height}", self.cfg.l1.rpc_url);
        let mut req = self.client.get(&url);
        if let Some(tok) = self.cfg.rpc_token() {
            req = req.bearer_auth(tok);
        }
        let block: L1Block = req.send().await?.json().await?;
        Ok(block)
    }

    /// Derive the sender address from a TX's first input public key.
    async fn fetch_tx_sender(&self, tx_id: &str) -> SwapResult<String> {
        let url = format!("{}/api/tx/{tx_id}", self.cfg.l1.rpc_url);
        let mut req = self.client.get(&url);
        if let Some(tok) = self.cfg.rpc_token() {
            req = req.bearer_auth(tok);
        }
        let resp: serde_json::Value = req.send().await?.json().await?;
        // L1 TX JSON: { "tx": { "inputs": [{ "public_key": "hex..." }] } }
        let pk_hex = resp["tx"]["inputs"][0]["public_key"]
            .as_str()
            .ok_or_else(|| crate::error::SwapError::L1Rpc("No public_key in TX".into()))?;
        // Derive zion1 address from public key
        let pk_bytes = hex::decode(pk_hex)
            .map_err(|_| crate::error::SwapError::L1Rpc("Bad public_key hex".into()))?;
        let addr = zion1_address_from_pk(&pk_bytes);
        Ok(addr)
    }
}

// ─── Auto-refund background loop ─────────────────────────────────────────────

pub struct RefundLoop {
    cfg: Arc<SwapConfig>,
    db: Arc<SwapDb>,
    executor: Arc<SwapExecutor>,
}

impl RefundLoop {
    pub fn new(
        cfg: Arc<SwapConfig>,
        db: Arc<SwapDb>,
        executor: Arc<SwapExecutor>,
    ) -> Self {
        Self { cfg, db, executor }
    }

    pub async fn run(&self) {
        if !self.cfg.refund.auto_refund {
            info!("Auto-refund loop disabled by config");
            return;
        }
        let interval = Duration::from_secs(self.cfg.refund.check_interval_secs);
        info!(
            "♻️  Refund loop started — check every {}s grace={}s",
            self.cfg.refund.check_interval_secs, self.cfg.refund.grace_period_secs
        );
        loop {
            if let Err(e) = self.tick().await {
                error!("Refund loop tick error: {e}");
            }
            sleep(interval).await;
        }
    }

    async fn tick(&self) -> SwapResult<()> {
        let expired = self.db.get_expired_pending()?;
        for rec in expired {
            // Apply extra grace period
            let grace_end = rec.expires_at + self.cfg.refund.grace_period_secs as i64;
            if Utc::now().timestamp() < grace_end {
                continue;
            }
            info!("♻️  Auto-refunding expired HTLC {}", rec.hash_hex);
            let executor = Arc::clone(&self.executor);
            let db = Arc::clone(&self.db);
            let hash = rec.hash_hex.clone();
            tokio::spawn(async move {
                if let Err(e) = executor.execute_refund(&db, &hash).await {
                    error!("Auto-refund failed for {hash}: {e}");
                    let _ = db.mark_error(&hash, &e.to_string());
                }
            });
        }
        Ok(())
    }
}

// ─── Minimal zion1 address derivation (mirrors L1/core/src/crypto/keys.rs) ──

/// Derive a `zion1...` bech32-like address from a 32-byte Ed25519 public key.
/// This mirrors the logic in L1/core/src/crypto/keys.rs.
fn zion1_address_from_pk(pk_bytes: &[u8]) -> String {
    use sha2::{Digest, Sha256};
    if pk_bytes.len() != 32 {
        return "unknown".into();
    }
    // Double-SHA256 → take first 20 bytes → hex
    let h1 = Sha256::digest(pk_bytes);
    let h2 = Sha256::digest(&h1);
    let payload = hex::encode(&h2[..20]);
    format!("zion1{payload}")
}
