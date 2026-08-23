//! Payout sweep thread for the ZION stratum pool.
//!
//! Periodically drains the pool's pending PPLNS payouts, builds a single
//! multi-output V31 UTXO transaction, signs it with the pool wallet key, and
//! submits it to the connected Zion V31 L1 node.

use std::net::SocketAddr;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use anyhow::{anyhow, bail, Context, Result};
use serde_json::json;
use tokio::time::interval;
use tracing::{info, warn};
use zion_core::emission::COINBASE_MATURITY;
use zion_core::transaction::Transaction;
use zion_core::v31_wallet::{build_batch_payout, BatchRecipient, SpendableUtxo};

use crate::notifications::Notifier;
use crate::pool::Pool;
use crate::rpc_client::{jsonrpc_call, parse_rpc_addr};
use crate::store::{PayoutRecord, ShareStore};
use crate::v3_pplns::PayoutEntry;

/// Background task that sweeps pending payouts to the chain.
pub struct PayoutSweeper {
    pool: Arc<Mutex<Pool>>,
    interval: Duration,
    notifier: Option<Arc<Notifier>>,
    share_store: Option<Arc<ShareStore>>,
}

impl PayoutSweeper {
    pub fn new(pool: Arc<Mutex<Pool>>, interval: Duration) -> Self {
        Self {
            pool,
            interval,
            notifier: None,
            share_store: None,
        }
    }

    /// Set a Notifier for payout failure alerts.
    pub fn with_notifier(mut self, notifier: Arc<Notifier>) -> Self {
        self.notifier = Some(notifier);
        self
    }

    /// Attach an optional `ShareStore` to record confirmed payouts.
    pub fn with_share_store(mut self, store: Option<Arc<ShareStore>>) -> Self {
        self.share_store = store;
        self
    }

    /// Run the sweeper forever (or until the async runtime is cancelled).
    pub async fn run(self) {
        let mut tick = interval(self.interval);
        loop {
            tick.tick().await;
            if let Err(e) = self.sweep().await {
                warn!("payout sweep error: {}", e);
                if let Some(ref notifier) = self.notifier {
                    notifier.notify_payout_failed(0, &e.to_string());
                }
            }
        }
    }

    async fn sweep(&self) -> Result<()> {
        let (mut payouts, signing_key, pool_address, fee_flowers, rpc_url) = {
            let mut pool = self.pool.lock().expect("pool lock poisoned");
            (
                pool.take_pending_payouts(),
                pool.signing_key.clone(),
                pool.config.pool_address.clone(),
                pool.config.payout_tx_fee_flowers,
                pool.config.l1_rpc_url.clone().unwrap_or_default(),
            )
        };

        if !payouts.is_empty() {
            info!("payout_sweep_started pending={}", payouts.len());
        }

        if payouts.is_empty() {
            return Ok(());
        }

        let Some(signing_key) = signing_key else {
            warn!("payout sweep skipped: no pool_wallet_key configured");
            self.requeue(payouts);
            return Ok(());
        };

        if rpc_url.is_empty() {
            warn!("payout sweep skipped: no l1_rpc_url configured");
            self.requeue(payouts);
            return Ok(());
        }

        let rpc_addr = parse_rpc_addr(&rpc_url)?;
        let current_height = crate::deferred_payout::get_chain_height(&rpc_url).await.unwrap_or(0);

        // Self-sends do not require a transaction.
        payouts.retain(|(_, p)| p.address != pool_address.encoded);
        if payouts.is_empty() {
            return Ok(());
        }

        let pool_encoded = pool_address.encoded;
        let utxos = fetch_utxos(rpc_addr, &pool_encoded, current_height).await?;
        if utxos.is_empty() {
            warn!(
                "payout sweep skipped: no UTXOs available for pool wallet {}",
                pool_encoded
            );
            self.requeue(payouts);
            return Ok(());
        }

        // Respect the batch recipient cap imposed by the wallet.
        if payouts.len() > zion_core::v31_wallet::MAX_BATCH_RECIPIENTS {
            let overflow = payouts.split_off(zion_core::v31_wallet::MAX_BATCH_RECIPIENTS);
            warn!(
                "payout batch cap exceeded, requeuing {} overflow payouts",
                overflow.len()
            );
            self.requeue(overflow);
        }

        let recipients: Vec<BatchRecipient> = payouts
            .iter()
            .map(|(_, p)| BatchRecipient {
                address: p.address.clone(),
                amount: p.amount,
            })
            .collect();

        // Use a fee that covers the serialized transaction size, capped at a
        // fraction of the total payout to avoid operator misconfiguration or a
        // compromised fee oracle draining the pool wallet.
        const MAX_FEE_PERCENT: f64 = 0.10;
        let total_payout: u64 = recipients.iter().map(|r| r.amount).sum();
        let max_fee = (total_payout as f64 * MAX_FEE_PERCENT) as u64;
        let fee = zion_core::fee::minimum_fee_for_size(zion_core::fee::estimate_tx_size(
            utxos.len(),
            recipients.len() + 1,
        ))
        .max(fee_flowers)
        .min(max_fee);

        if fee == 0 {
            warn!("payout sweep skipped: fee is zero");
            self.requeue(payouts);
            return Ok(());
        }

        let build_result = build_batch_payout(
            &signing_key,
            &pool_encoded,
            &recipients,
            fee,
            &utxos,
        )
        .map_err(|e| anyhow!("failed to build batch payout: {}", e))?;

        let tx = build_result.transaction;
        let change = build_result.change_amount;
        info!(
            "payout_broadcast pool={} recipients={} inputs={} outputs={} fee={} change={}",
            pool_encoded,
            payouts.len(),
            tx.inputs.len(),
            tx.outputs.len(),
            fee,
            change
        );

        let response = submit_utxo_transaction(rpc_addr, &tx).await?;

        let tx_id = response
            .get("tx_id")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        if !Self::is_valid_tx_id(&tx_id) {
            warn!("payout submit response has invalid tx_id: {}", tx_id);
            self.requeue(payouts);
            return Err(anyhow!("invalid tx_id in submit response: {}", tx_id));
        }

        let block_height = payouts.first().map(|(h, _)| *h).unwrap_or(0);

        // Record payouts in the share store so /api/v1/payouts populates.
        if let Some(ref store) = self.share_store {
            let records: Vec<PayoutRecord> = payouts
                .iter()
                .map(|(_, p)| PayoutRecord {
                    miner_id: p.miner_id.clone(),
                    address: p.address.clone(),
                    amount_flowers: p.amount,
                    tx_id: tx_id.clone(),
                    height: block_height,
                    block_hash: String::new(),
                })
                .collect();
            let store = Arc::clone(store);
            tokio::task::spawn_blocking(move || {
                for rec in records {
                    if let Err(e) = store.record_payout(&rec) {
                        warn!("share_store record_payout failed: {}", e);
                    }
                }
            });
        }

        {
            let mut pool = self.pool.lock().expect("pool lock poisoned");
            for (height, payout) in &payouts {
                pool.mark_payout_sent(*height, &payout.address);
            }
        }

        info!(
            "payout_submitted height={} tx_id={} recipients={} inputs={} outputs={} fee={} change={} pool={}",
            block_height,
            tx_id,
            payouts.len(),
            tx.inputs.len(),
            tx.outputs.len(),
            fee,
            change,
            pool_encoded
        );

        Ok(())
    }

    fn is_valid_tx_id(tx_id: &str) -> bool {
        tx_id.len() == 64 && tx_id.chars().all(|c| c.is_ascii_hexdigit())
    }

fn requeue(&self, payouts: Vec<(u64, PayoutEntry)>) {
        if payouts.is_empty() {
            return;
        }
        info!("payout_requeue count={}", payouts.len());
        let mut pool = self.pool.lock().expect("pool lock poisoned");
        pool.requeue_payouts(payouts);
    }
}

/// Fetch UTXOs owned by the pool wallet from the L1 node RPC.
///
/// Only includes outputs that are mature: coinbase outputs require
/// `COINBASE_MATURITY` confirmations.
async fn fetch_utxos(
    rpc_addr: SocketAddr,
    address: &str,
    current_height: u64,
) -> Result<Vec<SpendableUtxo>> {
    let payload = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getUtxos",
        "params": { "address": address }
    });
    let resp = jsonrpc_call(rpc_addr, &payload).await?;

    if let Some(error) = resp.get("error").filter(|v| !v.is_null()) {
        let msg = error
            .get("message")
            .and_then(|m| m.as_str())
            .unwrap_or("unknown");
        bail!("getUtxos error: {}", msg);
    }

    let mut out = Vec::new();
    let mut skipped = 0u64;
    let count = resp
        .get("result")
        .and_then(|r| r.get("count"))
        .and_then(|v| v.as_u64())
        .unwrap_or(0);

    if let Some(utxos) = resp.get("result").and_then(|r| r.get("utxos")).and_then(|v| v.as_array())
    {
        for utxo in utxos {
            let tx_hash_hex = utxo
                .get("tx_hash")
                .and_then(|v| v.as_str())
                .unwrap_or_default();
            let output_index = utxo
                .get("output_index")
                .and_then(|v| v.as_u64())
                .unwrap_or_default() as u32;
            let amount = utxo
                .get("amount")
                .and_then(|v| v.as_u64())
                .unwrap_or_default();
            let block_height = utxo
                .get("block_height")
                .and_then(|v| v.as_u64())
                .unwrap_or_default();
            let is_coinbase = utxo
                .get("is_coinbase")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);

            // Skip immature coinbase outputs so the pool never builds an
            // invalid payout transaction.
            if is_coinbase && current_height.saturating_sub(block_height) < COINBASE_MATURITY {
                skipped += 1;
                continue;
            }

            let tx_hash = match hex::decode(tx_hash_hex)
                .ok()
                .and_then(|v| <[u8; 32]>::try_from(v).ok())
            {
                Some(h) => h,
                None => {
                    skipped += 1;
                    continue;
                }
            };

            out.push(SpendableUtxo {
                tx_hash,
                output_index,
                amount,
                address: address.to_string(),
                script: hex::decode(
                    utxo.get("script_hex")
                        .and_then(|v| v.as_str())
                        .unwrap_or(""),
                )
                .unwrap_or_default(),
                block_height,
                is_coinbase,
            });
        }
    }

    let total: u64 = out.iter().map(|u| u.amount).sum();
    info!(
        "payout_utxos_fetched address={} count={}/{} available={} skipped={}",
        address,
        out.len(),
        count,
        total,
        skipped
    );

    Ok(out)
}

/// Submit a signed V31 UTXO transaction to the node.
async fn submit_utxo_transaction(
    rpc_addr: SocketAddr,
    tx: &Transaction,
) -> Result<serde_json::Value> {
    let tx_json = serde_json::to_value(tx)?;
    let payload = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "submitUtxoTransaction",
        "params": { "transaction": tx_json }
    });
    let resp = jsonrpc_call(rpc_addr, &payload).await?;

    if let Some(error) = resp.get("error").filter(|v| !v.is_null()) {
        let msg = error
            .get("message")
            .and_then(|m| m.as_str())
            .unwrap_or("unknown");
        return Err(anyhow!("submitUtxoTransaction error: {}", msg));
    }

    resp.get("result")
        .cloned()
        .context("missing result in submitUtxoTransaction response")
}
