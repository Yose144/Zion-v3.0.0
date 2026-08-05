//! Payout sweep thread for the ZION stratum pool.
//!
//! Periodically drains the pool's pending PPLNS payouts, builds a single
//! multi-output UTXO transaction, signs it with the pool wallet key, and
//! submits it to the connected Zion L1 node.

use std::net::SocketAddr;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use anyhow::{anyhow, Context, Result};
use serde_json::json;
use tokio::time::interval;
use tracing::{info, warn};
use zion_core::v3_compat::{TxInput as UtxoTxInput, TxOutput as UtxoTxOutput, UtxoTransaction};
use zion_core::v3_wallet::{build_batch_payout, BatchRecipient, SpendableUtxo};

use crate::notifications::Notifier;
use crate::pool::Pool;
use crate::rpc_client::{jsonrpc_call, parse_rpc_addr};
use crate::v3_pplns::PayoutEntry;

/// Background task that sweeps pending payouts to the chain.
pub struct PayoutSweeper {
    pool: Arc<Mutex<Pool>>,
    interval: Duration,
    notifier: Option<Arc<Notifier>>,
}

impl PayoutSweeper {
    pub fn new(pool: Arc<Mutex<Pool>>, interval: Duration) -> Self {
        Self {
            pool,
            interval,
            notifier: None,
        }
    }

    /// Set a Notifier for payout failure alerts.
    pub fn with_notifier(mut self, notifier: Arc<Notifier>) -> Self {
        self.notifier = Some(notifier);
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

        // Self-sends do not require a transaction.
        payouts.retain(|(_, p)| p.address != pool_address.encoded);
        if payouts.is_empty() {
            return Ok(());
        }

        let pool_encoded = pool_address.encoded;
        let utxos = fetch_utxos(rpc_addr, &pool_encoded).await?;
        if utxos.is_empty() {
            warn!(
                "payout sweep skipped: no UTXOs available for pool wallet {}",
                pool_encoded
            );
            self.requeue(payouts);
            return Ok(());
        }

        // Respect the batch recipient cap imposed by the wallet.
        if payouts.len() > zion_core::v3_wallet::MAX_BATCH_RECIPIENTS {
            let overflow = payouts.split_off(zion_core::v3_wallet::MAX_BATCH_RECIPIENTS);
            self.requeue(overflow);
        }

        let recipients: Vec<BatchRecipient> = payouts
            .iter()
            .map(|(_, p)| BatchRecipient {
                address: p.address.clone(),
                amount: p.amount,
            })
            .collect();

        // Use a fee that covers the serialized transaction size.
        let fee = zion_core::fee::minimum_fee_for_size(zion_core::fee::estimate_tx_size(
            utxos.len(),
            recipients.len() + 1,
        ))
        .max(fee_flowers);

        // Use the first pending block height as the chain tip hint for version selection.
        let chain_tip = payouts.first().map(|(h, _)| *h).unwrap_or(0);

        let build_result = build_batch_payout(
            &signing_key,
            &pool_encoded,
            &recipients,
            fee,
            &utxos,
            chain_tip,
        )
        .map_err(|e| anyhow!("failed to build batch payout: {}", e))?;

        let utxo_tx = into_utxo_transaction(build_result.transaction)?;
        let response = submit_utxo_transaction(rpc_addr, &utxo_tx).await?;

        let tx_id = response
            .get("tx_id")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        {
            let mut pool = self.pool.lock().expect("pool lock poisoned");
            for (height, payout) in &payouts {
                pool.mark_payout_sent(*height, &payout.address);
            }
        }

        info!(
            "payout_submitted tx_id={} recipients={} fee={} pool={}",
            tx_id,
            payouts.len(),
            fee,
            pool_encoded
        );

        Ok(())
    }

    fn requeue(&self, payouts: Vec<(u64, PayoutEntry)>) {
        if payouts.is_empty() {
            return;
        }
        let mut pool = self.pool.lock().expect("pool lock poisoned");
        pool.requeue_payouts(payouts);
    }
}

/// Fetch UTXOs owned by the pool wallet from the L1 node RPC.
async fn fetch_utxos(rpc_addr: SocketAddr, address: &str) -> Result<Vec<SpendableUtxo>> {
    let payload = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getUtxos",
        "params": { "address": address }
    });
    let resp = jsonrpc_call(rpc_addr, &payload).await?;

    let mut out = Vec::new();
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

            let tx_hash = hex::decode(tx_hash_hex)
                .ok()
                .and_then(|v| <[u8; 32]>::try_from(v).ok())
                .context("invalid UTXO tx_hash")?;

            out.push(SpendableUtxo {
                tx_hash,
                output_index,
                amount,
                address: address.to_string(),
            });
        }
    }

    Ok(out)
}

/// Submit a signed UTXO transaction to the node.
async fn submit_utxo_transaction(
    rpc_addr: SocketAddr,
    tx: &UtxoTransaction,
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

/// Convert the native `v3_tx::Transaction` used by the wallet into the
/// `v3_compat::UtxoTransaction` shape expected by the RPC.
fn into_utxo_transaction(tx: zion_core::v3_tx::Transaction) -> Result<UtxoTransaction> {
    let inputs: Vec<UtxoTxInput> = tx
        .inputs
        .into_iter()
        .map(|i| UtxoTxInput {
            prev_tx_hash: i.prev_tx_hash,
            output_index: i.output_index,
            signature: i.signature,
            public_key: i.public_key,
        })
        .collect();

    let outputs: Vec<UtxoTxOutput> = tx
        .outputs
        .into_iter()
        .map(|o| UtxoTxOutput {
            amount: o.amount,
            address: o.address,
            memo: o.memo,
        })
        .collect();

    Ok(UtxoTransaction {
        id: tx.id,
        version: tx.version,
        inputs,
        outputs,
        fee: tx.fee,
        timestamp: tx.timestamp,
    })
}


