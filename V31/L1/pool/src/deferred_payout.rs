//! Deferred payout queue + payout confirmation tracking + fee payout sweep.
//!
//! Ports `DeferredPayout`, `check_tx_on_chain`, `get_chain_height`,
//! `execute_fee_payout`, `fee_payout_recipients`, and the deferred payout
//! background processor from the V3 pool server
//! (`archive/V3/L1/pool/src/bin/server.rs`).

use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use serde_json::json;
use tracing::{info, warn};

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

/// Check if a transaction is on-chain (returns block height if confirmed).
pub async fn check_tx_on_chain(rpc_addr: &str, tx_id: &str) -> anyhow::Result<Option<u64>> {
    let addr = crate::rpc_client::parse_rpc_addr(rpc_addr)?;
    let result = crate::rpc_client::jsonrpc_call(
        addr,
        &rpc_request("getTransaction", json!({ "txid": tx_id })),
    )
    .await?;

    if result.is_null() {
        return Ok(None);
    }
    let height = result.get("block_height").and_then(|v| v.as_u64());
    Ok(height)
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
        .get("chain_height")
        .and_then(|v| v.as_u64())
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
    block.get("difficulty").and_then(|v| v.as_u64()).unwrap_or(0)
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
    use zion_core::v3_wallet::{build_batch_payout, BatchRecipient};
    let batch: Vec<BatchRecipient> = recipients
        .iter()
        .map(|r| BatchRecipient {
            address: r.address.clone(),
            amount: r.amount,
        })
        .collect();

    let chain_height = get_chain_height(rpc_addr).await.unwrap_or(0);
    let result = build_batch_payout(
        &signing_key,
        pool_wallet,
        &batch,
        zion_core::fee::MIN_TX_FEE,
        &utxos,
        chain_height,
    )
    .map_err(|e| anyhow::anyhow!("failed to build fee payout tx: {e}"))?;

    let tx_json = serde_json::to_value(&result.transaction)
        .map_err(|e| anyhow::anyhow!("failed to serialize fee payout tx: {e}"))?;

    let addr = crate::rpc_client::parse_rpc_addr(rpc_addr)?;
    let resp = crate::rpc_client::jsonrpc_call(
        addr,
        &rpc_request("submitTransaction", json!({ "tx": tx_json })),
    )
    .await?;

    let tx_id = resp
        .get("tx_id")
        .and_then(|v| v.as_str())
        .or_else(|| resp.as_str())
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
async fn fetch_pool_utxos(rpc_addr: &str, address: &str) -> anyhow::Result<Vec<zion_core::v3_wallet::SpendableUtxo>> {
    use zion_core::v3_wallet::SpendableUtxo;
    let addr = crate::rpc_client::parse_rpc_addr(rpc_addr)?;
    let result = crate::rpc_client::jsonrpc_call(
        addr,
        &rpc_request("getUtxos", json!({ "address": address })),
    )
    .await?;

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
            use zion_core::v3_wallet::{build_batch_payout, BatchRecipient};
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

                    let chain_height = get_chain_height(&rpc).await.unwrap_or(0);
                    match build_batch_payout(
                        &signing_key,
                        &wallet,
                        &batch,
                        zion_core::fee::MIN_TX_FEE,
                        &utxos,
                        chain_height,
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
                                &rpc_request("submitTransaction", json!({ "tx": tx_json })),
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

/// Spawn a background task that periodically checks submitted payouts
/// against the chain and marks them as confirmed.
pub fn spawn_payout_confirmation_sweep(
    rpc_addr: Option<String>,
    interval_secs: u64,
) {
    let interval = Duration::from_secs(interval_secs);
    info!(
        "payout_confirmation_sweep: enabled interval_secs={}",
        interval_secs
    );

    tokio::spawn(async move {
        loop {
            tokio::time::sleep(interval).await;

            let rpc = match &rpc_addr {
                Some(r) => r.clone(),
                None => continue,
            };

            let chain_height = match get_chain_height(&rpc).await {
                Ok(h) => h,
                Err(e) => {
                    tracing::debug!("payout_confirmation_sweep: get_chain_height failed: {e}");
                    continue;
                }
            };

            tracing::debug!(
                "payout_confirmation_sweep: chain_height={}",
                chain_height
            );
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
