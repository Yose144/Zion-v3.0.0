//! Deferred payout queue + payout confirmation tracking + fee payout sweep.
//!
//! Ports `DeferredPayout`, `check_tx_on_chain`, `get_chain_height`,
//! `execute_fee_payout`, `fee_payout_recipients`, and the deferred payout
//! background processor from the V3 pool server
//! (`archive/V3/L1/pool/src/bin/server.rs`).

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use serde_json::{json, Value};
use tracing::{info, warn};

use crate::store::{PayoutRow, ShareStore};
use crate::v3_pplns::PayoutEntry;

// ── DeferredPayout ─────────────────────────────────────────────────

/// A batch of payouts that failed to execute immediately (usually because
/// the pool wallet balance hasn't been credited yet by the node).
/// Retried periodically until success or max retries exceeded.
#[derive(Debug, Clone)]
pub struct DeferredPayout {
    pub payouts: Vec<PayoutEntry>,
    pub height: u64,
    pub queued_at: Instant,
    pub retry_count: u32,
}

pub type DeferredPayoutQueue = Arc<Mutex<Vec<DeferredPayout>>>;

/// Configuration for the deferred payout processor.
#[derive(Debug, Clone)]
pub struct DeferredPayoutConfig {
    pub max_retries: u32,
    pub retry_interval: Duration,
}

impl Default for DeferredPayoutConfig {
    fn default() -> Self {
        Self {
            max_retries: 300,
            retry_interval: Duration::from_secs(2),
        }
    }
}

impl DeferredPayoutConfig {
    pub fn from_env() -> Self {
        Self {
            max_retries: std::env::var("ZION_PAYOUT_MAX_RETRIES")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(300),
            retry_interval: Duration::from_millis(
                std::env::var("ZION_PAYOUT_RETRY_INTERVAL_MS")
                    .ok()
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(2000),
            ),
        }
    }
}

/// Push a batch of failed payouts onto the deferred queue.
pub fn enqueue_deferred(queue: &DeferredPayoutQueue, payouts: Vec<PayoutEntry>, height: u64) {
    let count = payouts.len();
    let entry = DeferredPayout {
        payouts,
        height,
        queued_at: Instant::now(),
        retry_count: 0,
    };
    queue.lock().unwrap().push(entry);
    info!(
        "payout_deferred_queued height={} miners={}",
        height,
        count
    );
}

// ── Chain query helpers ────────────────────────────────────────────

/// Build a JSON-RPC request value.
fn rpc_request(method: &str, params: serde_json::Value) -> serde_json::Value {
    json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": method,
        "params": params,
    })
}

/// Check if a transaction is on-chain.
///
/// Returns the block height and block hash (hex) if the node reports the
/// transaction in a confirmed block. The response is read from the JSON-RPC
/// `result` envelope.
pub async fn check_tx_on_chain(
    rpc_addr: &str,
    tx_id: &str,
) -> anyhow::Result<Option<(u64, String)>> {
    let addr = crate::rpc_client::parse_rpc_addr(rpc_addr)?;
    let resp = crate::rpc_client::jsonrpc_call(
        addr,
        &rpc_request("getTransaction", json!({ "txid": tx_id })),
    )
    .await?;

    let result = resp.get("result").cloned().unwrap_or(Value::Null);
    if result.is_null() {
        return Ok(None);
    }
    let height = result.get("block_height").and_then(|v| v.as_u64());
    let block_hash = result
        .get("block_hash")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    Ok(height.map(|h| (h, block_hash)))
}

/// Get the current chain height from the node.
pub async fn get_chain_height(rpc_addr: &str) -> anyhow::Result<u64> {
    let addr = crate::rpc_client::parse_rpc_addr(rpc_addr)?;
    let result = crate::rpc_client::jsonrpc_call(
        addr,
        &rpc_request("getChainInfo", json!([])),
    )
    .await?;

    result
        .get("result")
        .and_then(|r| r.get("native_chain_height").and_then(|v| v.as_u64()).or_else(|| r.get("chain_height").and_then(|v| v.as_u64())))
        .ok_or_else(|| anyhow::anyhow!("missing chain_height in getChainInfo response"))
}

/// Get the network difficulty at the current tip.
pub async fn get_chain_difficulty(rpc_addr: &str) -> u64 {
    let height = match get_chain_height(rpc_addr).await {
        Ok(h) => h,
        Err(_) => return 0,
    };
    let addr = match crate::rpc_client::parse_rpc_addr(rpc_addr) {
        Ok(a) => a,
        Err(_) => return 0,
    };
    let block = match crate::rpc_client::jsonrpc_call(
        addr,
        &rpc_request("getBlockByHeight", json!({ "height": height })),
    )
    .await
    {
        Ok(b) => b,
        Err(_) => return 0,
    };
    block
        .get("result")
        .and_then(|r| r.get("difficulty"))
        .and_then(|v| v.as_u64())
        .unwrap_or(0)
}

// ── Fee payout ─────────────────────────────────────────────────────

/// Fee payout recipient (humanitarian / issobella / pool fee).
#[derive(Debug, Clone)]
pub struct FeePayoutRecipient {
    pub address: String,
    pub amount: u64,
}

/// Build the list of fee payout recipients from the fee splits.
pub fn fee_payout_recipients(
    humanitarian: u64,
    issobella: u64,
    pool_fee: u64,
    humanitarian_wallet: &str,
    issobella_wallet: &str,
    pool_fee_wallet: &str,
) -> Vec<FeePayoutRecipient> {
    let mut recipients = Vec::new();
    if humanitarian > 0 && !humanitarian_wallet.is_empty() {
        recipients.push(FeePayoutRecipient {
            address: humanitarian_wallet.to_string(),
            amount: humanitarian,
        });
    }
    if issobella > 0 && !issobella_wallet.is_empty() {
        recipients.push(FeePayoutRecipient {
            address: issobella_wallet.to_string(),
            amount: issobella,
        });
    }
    if pool_fee > 0 && !pool_fee_wallet.is_empty() {
        recipients.push(FeePayoutRecipient {
            address: pool_fee_wallet.to_string(),
            amount: pool_fee,
        });
    }
    recipients
}

/// Execute a fee payout (humanitarian + issobella + pool fee) as a single
/// batch UTXO transaction. Returns the tx_id on success.
pub async fn execute_fee_payout(
    rpc_addr: &str,
    pool_wallet: &str,
    signing_key_hex: &str,
    recipients: &[FeePayoutRecipient],
    height: u64,
) -> anyhow::Result<String> {
    if recipients.is_empty() {
        return Err(anyhow::anyhow!("no fee recipients"));
    }

    // Parse signing key
    let key_bytes = hex::decode(signing_key_hex.trim_start_matches("0x"))
        .map_err(|e| anyhow::anyhow!("invalid signing key hex: {e}"))?;
    if key_bytes.len() != 32 {
        return Err(anyhow::anyhow!("signing key must be 32 bytes, got {}", key_bytes.len()));
    }
    let signing_key = ed25519_dalek::SigningKey::from_bytes(
        key_bytes.as_slice().try_into().unwrap(),
    );

    // Fetch UTXOs
    let utxos = fetch_pool_utxos(rpc_addr, pool_wallet).await?;
    if utxos.is_empty() {
        return Err(anyhow::anyhow!(
            "pool payout wallet {} has no spendable UTXOs for fee payout",
            pool_wallet,
        ));
    }

    // Build batch recipients
    use zion_core::v31_wallet::{build_batch_payout, BatchRecipient};
    let batch: Vec<BatchRecipient> = recipients
        .iter()
        .map(|r| BatchRecipient {
            address: r.address.clone(),
            amount: r.amount,
        })
        .collect();

    let result = build_batch_payout(
        &signing_key,
        pool_wallet,
        &batch,
        zion_core::fee::MIN_TX_FEE,
        &utxos,
    )
    .map_err(|e| anyhow::anyhow!("failed to build fee payout tx: {e}"))?;

    let tx_json = serde_json::to_value(&result.transaction)
        .map_err(|e| anyhow::anyhow!("failed to serialize fee payout tx: {e}"))?;

    let addr = crate::rpc_client::parse_rpc_addr(rpc_addr)?;
    let resp = crate::rpc_client::jsonrpc_call(
        addr,
        &rpc_request("submitUtxoTransaction", json!({ "transaction": tx_json })),
    )
    .await?;

    let tx_id = resp
        .get("result")
        .and_then(|r| r.get("tx_id"))
        .and_then(|v| v.as_str())
        .or_else(|| resp.get("result").and_then(|r| r.as_str()))
        .unwrap_or("unknown")
        .to_string();

    info!(
        "fee_payout_executed height={} recipients={} tx_id={}",
        height,
        recipients.len(),
        &tx_id[..tx_id.len().min(20)]
    );

    Ok(tx_id)
}

/// Fetch spendable UTXOs for a pool wallet address from the node.
async fn fetch_pool_utxos(rpc_addr: &str, address: &str) -> anyhow::Result<Vec<zion_core::v31_wallet::SpendableUtxo>> {
    use zion_core::v31_wallet::SpendableUtxo;
    let addr = crate::rpc_client::parse_rpc_addr(rpc_addr)?;
    let resp = crate::rpc_client::jsonrpc_call(
        addr,
        &rpc_request("getUtxos", json!({ "address": address })),
    )
    .await?;

    let result = resp.get("result").cloned().unwrap_or(Value::Null);
    let utxos = result
        .get("utxos")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|u| {
                    let tx_hash_hex = u.get("tx_hash")?.as_str()?;
                    let tx_hash = hex::decode(tx_hash_hex).ok()?;
                    if tx_hash.len() != 32 {
                        return None;
                    }
                    let mut arr = [0u8; 32];
                    arr.copy_from_slice(&tx_hash);
                    Some(SpendableUtxo {
                        tx_hash: arr,
                        output_index: u.get("output_index")?.as_u64()? as u32,
                        amount: u.get("amount")?.as_u64()?,
                        address: address.to_string(),
                    })
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    Ok(utxos)
}

// ── Deferred payout processor ──────────────────────────────────────

/// Spawn the deferred payout background processor.
///
/// Retries failed payouts every `retry_interval` until success or
/// `max_retries` exceeded. On permanent failure, logs an alert.
pub fn spawn_deferred_payout_processor(
    queue: DeferredPayoutQueue,
    config: DeferredPayoutConfig,
    rpc_addr: Option<String>,
    pool_wallet: Option<String>,
    signing_key_hex: Option<String>,
    notifier: Option<Arc<crate::notifications::Notifier>>,
) {
    let max_retries = config.max_retries;
    let retry_interval = config.retry_interval;

    info!(
        "deferred_payout_processor: enabled max_retries={} interval_ms={}",
        max_retries,
        retry_interval.as_millis()
    );

    tokio::spawn(async move {
        loop {
            tokio::time::sleep(retry_interval).await;

            let (height, retry, payouts) = {
                let mut queue_guard = queue.lock().unwrap();
                if queue_guard.is_empty() {
                    continue;
                }
                let deferred = queue_guard.first_mut().unwrap();
                deferred.retry_count += 1;
                (deferred.height, deferred.retry_count, deferred.payouts.clone())
            };

            if retry > max_retries {
                warn!(
                    "payout_deferred_giveup height={} miners={} reason=max_retries_exceeded",
                    height,
                    payouts.len()
                );
                if let Some(ref notifier) = notifier {
                    let total: u64 = payouts.iter().map(|p| p.amount).sum();
                    notifier.notify_payout_failed(
                        height,
                        &format!("max_retries_exceeded ({} miners, {} flowers)", payouts.len(), total),
                    );
                }
                queue.lock().unwrap().remove(0);
                continue;
            }

            // Need RPC + wallet + key to retry
            let (rpc, wallet, key) = match (&rpc_addr, &pool_wallet, &signing_key_hex) {
                (Some(r), Some(w), Some(k)) => (r.clone(), w.clone(), k.clone()),
                _ => continue,
            };

            // Attempt to re-execute the payout
            use zion_core::v31_wallet::{build_batch_payout, BatchRecipient};
            let batch: Vec<BatchRecipient> = payouts
                .iter()
                .map(|p| BatchRecipient {
                    address: p.address.clone(),
                    amount: p.amount,
                })
                .collect();

            match fetch_pool_utxos(&rpc, &wallet).await {
                Ok(utxos) if !utxos.is_empty() => {
                    let key_bytes = match hex::decode(key.trim_start_matches("0x")) {
                        Ok(b) if b.len() == 32 => b,
                        _ => {
                            warn!("deferred_payout: invalid signing key");
                            continue;
                        }
                    };
                    let signing_key = ed25519_dalek::SigningKey::from_bytes(
                        key_bytes.as_slice().try_into().unwrap(),
                    );

                    match build_batch_payout(
                        &signing_key,
                        &wallet,
                        &batch,
                        zion_core::fee::MIN_TX_FEE,
                        &utxos,
                    ) {
                        Ok(result) => {
                            let tx_json = match serde_json::to_value(&result.transaction) {
                                Ok(v) => v,
                                Err(e) => {
                                    warn!("deferred_payout: failed to serialize tx: {e}");
                                    continue;
                                }
                            };
                            let addr = match crate::rpc_client::parse_rpc_addr(&rpc) {
                                Ok(a) => a,
                                Err(e) => {
                                    warn!("deferred_payout: invalid rpc addr: {e}");
                                    continue;
                                }
                            };
                            match crate::rpc_client::jsonrpc_call(
                                addr,
                                &rpc_request("submitUtxoTransaction", json!({ "transaction": tx_json })),
                            )
                            .await
                            {
                                Ok(resp) => {
                                    let tx_id = resp
                                        .get("tx_id")
                                        .and_then(|v| v.as_str())
                                        .or_else(|| resp.as_str())
                                        .unwrap_or("unknown")
                                        .to_string();
                                    info!(
                                        "payout_deferred_success height={} miners={} tx_id={} retry={}",
                                        height,
                                        payouts.len(),
                                        &tx_id[..tx_id.len().min(20)],
                                        retry
                                    );
                                    queue.lock().unwrap().remove(0);
                                }
                                Err(e) => {
                                    if retry % 10 == 0 || retry <= 3 {
                                        info!(
                                            "payout_deferred_retry height={} miners={} retry={} error={}",
                                            height,
                                            payouts.len(),
                                            retry,
                                            e
                                        );
                                    }
                                }
                            }
                        }
                        Err(e) => {
                            if retry % 10 == 0 || retry <= 3 {
                                info!(
                                    "payout_deferred_retry height={} miners={} retry={} error=build_failed: {e}",
                                    height,
                                    payouts.len(),
                                    retry
                                );
                            }
                        }
                    }
                }
                _ => {
                    if retry % 10 == 0 || retry <= 3 {
                        info!(
                            "payout_deferred_retry height={} miners={} retry={} reason=no_utxos",
                            height,
                            payouts.len(),
                            retry
                        );
                    }
                }
            }
        }
    });
}

// ── Payout confirmation sweep ──────────────────────────────────────

/// Check whether a transaction is present in the chain by looking for one of
/// its outputs in the recipient's UTXO set.
///
/// This is a fallback for nodes where `getTransaction` is not implemented or
/// returns null.  The UTXO `tx_hash` equals the transaction id, so a matching
/// unspent output proves the tx is on-chain.
async fn check_tx_on_chain_via_utxos(rpc_addr: &str, address: &str, tx_id: &str) -> anyhow::Result<bool> {
    let addr = crate::rpc_client::parse_rpc_addr(rpc_addr)?;
    let request = rpc_request(
        "getUtxos",
        json!({ "address": address }),
    );
    let resp = crate::rpc_client::jsonrpc_call(addr, &request).await?;

    if let Some(utxos) = resp
        .get("result")
        .and_then(|r| r.get("utxos"))
        .and_then(|v| v.as_array())
    {
        for utxo in utxos {
            if let Some(tx_hash) = utxo.get("tx_hash").and_then(|v| v.as_str()) {
                if tx_hash == tx_id {
                    return Ok(true);
                }
            }
        }
    }
    Ok(false)
}

/// Spawn a background task that periodically checks submitted payouts
/// against the chain and marks them as confirmed.
///
/// Confirmations are computed from the payout block height when the exact
/// transaction block height is unavailable.  This is intentionally conservative:
/// a payout transaction can only appear in a block *at or after* the block it
/// pays out, so `chain_height - payout_height + 1` is a safe upper bound on the
/// number of confirmations.
pub fn spawn_payout_confirmation_sweep(
    rpc_addr: Option<String>,
    interval_secs: u64,
    share_store: Option<Arc<ShareStore>>,
) {
    let interval = Duration::from_secs(interval_secs);
    let maturity_confirmations = std::env::var("ZION_PAYOUT_MATURITY")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(6u32);

    info!(
        "payout_confirmation_sweep: enabled interval_secs={} maturity_confirmations={}",
        interval_secs, maturity_confirmations
    );

    tokio::spawn(async move {
        loop {
            tokio::time::sleep(interval).await;

            let rpc = match &rpc_addr {
                Some(r) => r.clone(),
                None => continue,
            };

            let store = match &share_store {
                Some(s) => s.clone(),
                None => continue,
            };

            let chain_height = match get_chain_height(&rpc).await {
                Ok(h) => h,
                Err(e) => {
                    tracing::debug!("payout_confirmation_sweep: get_chain_height failed: {e}");
                    continue;
                }
            };

            let payouts = match store.query_unconfirmed_payouts() {
                Ok(p) => p,
                Err(e) => {
                    tracing::debug!("payout_confirmation_sweep: query_unconfirmed_payouts failed: {e}");
                    continue;
                }
            };

            if payouts.is_empty() {
                continue;
            }

            // Group by tx_id so a single UTXO check can confirm a whole batch.
            let mut by_tx: HashMap<String, Vec<PayoutRow>> = HashMap::new();
            for p in payouts {
                by_tx.entry(p.tx_id.clone()).or_default().push(p);
            }

            for (tx_id, group) in by_tx {
                // First try the exact getTransaction RPC.
                let (tx_height, block_hash) = match check_tx_on_chain(&rpc, &tx_id).await {
                    Ok(Some((h, hash))) => (h, hash),
                    Ok(None) => {
                        // Fallback: look for the tx hash in any recipient UTXO set.
                        let representative = &group[0];
                        match check_tx_on_chain_via_utxos(&rpc, &representative.address, &tx_id).await {
                            Ok(true) => (representative.height, String::new()),
                            Ok(false) => continue,
                            Err(e) => {
                                tracing::debug!("payout_confirmation_sweep: getUtxos fallback failed for {}: {e}", representative.address);
                                continue;
                            }
                        }
                    }
                    Err(e) => {
                        tracing::debug!("payout_confirmation_sweep: check_tx_on_chain failed for {}: {e}", tx_id);
                        continue;
                    }
                };

                let confirmations = if chain_height >= tx_height {
                    (chain_height - tx_height + 1) as u32
                } else {
                    0u32
                };

                if confirmations >= maturity_confirmations {
                    let confirm = if block_hash.is_empty() {
                        store.confirm_payout(&tx_id, confirmations)
                    } else {
                        store.confirm_payout_with_block(&tx_id, confirmations, &block_hash, tx_height)
                    };
                    if let Err(e) = confirm {
                        warn!("payout_confirmation_sweep: confirm_payout failed for {}: {}", tx_id, e);
                    } else {
                        info!(
                            "payout_confirmed tx_id={} height={} chain_height={} confirmations={} block_hash={}",
                            tx_id, tx_height, chain_height, confirmations, block_hash
                        );
                    }
                }
            }
        }
    });
}

// ── Tests ──────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deferred_payout_config_defaults() {
        let cfg = DeferredPayoutConfig::default();
        assert_eq!(cfg.max_retries, 300);
        assert_eq!(cfg.retry_interval, Duration::from_secs(2));
    }

    #[test]
    fn fee_payout_recipients_builds_correctly() {
        let recipients = fee_payout_recipients(100, 50, 200, "human_addr", "issobella_addr", "pool_addr");
        assert_eq!(recipients.len(), 3);
        assert_eq!(recipients[0].address, "human_addr");
        assert_eq!(recipients[0].amount, 100);
        assert_eq!(recipients[1].address, "issobella_addr");
        assert_eq!(recipients[1].amount, 50);
        assert_eq!(recipients[2].address, "pool_addr");
        assert_eq!(recipients[2].amount, 200);
    }

    #[test]
    fn fee_payout_recipients_skips_zero() {
        let recipients = fee_payout_recipients(0, 50, 0, "human_addr", "issobella_addr", "pool_addr");
        assert_eq!(recipients.len(), 1);
        assert_eq!(recipients[0].address, "issobella_addr");
    }

    #[test]
    fn fee_payout_recipients_skips_empty_wallet() {
        let recipients = fee_payout_recipients(100, 50, 200, "", "issobella_addr", "pool_addr");
        assert_eq!(recipients.len(), 2);
        assert_eq!(recipients[0].address, "issobella_addr");
    }

    #[test]
    fn enqueue_deferred_adds_to_queue() {
        let queue: DeferredPayoutQueue = Arc::new(Mutex::new(Vec::new()));
        let payouts = vec![PayoutEntry {
            miner_id: "miner1".to_string(),
            address: "addr1".to_string(),
            amount: 100,
            share_count: 1,
        }];
        enqueue_deferred(&queue, payouts, 42);
        assert_eq!(queue.lock().unwrap().len(), 1);
        assert_eq!(queue.lock().unwrap()[0].height, 42);
        assert_eq!(queue.lock().unwrap()[0].retry_count, 0);
    }
}
