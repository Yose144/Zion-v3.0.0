//! Deferred payout queue + payout confirmation tracking + fee payout sweep.
//!
//! Ports `DeferredPayout`, `check_tx_on_chain`, `get_chain_height`,
//! `execute_fee_payout`, `fee_payout_recipients`, and the deferred payout
//! background processor from the V3 pool server
//! (`archive/V3/L1/pool/src/bin/server.rs`).

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use anyhow::anyhow;
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
    info!("payout_deferred_queued height={} miners={}", height, count);
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

/// First 20 characters of a tx id for logs — char-boundary safe
/// (`&tx_id[..20]` panics on multi-byte input).
fn short_tx_id(tx_id: &str) -> String {
    tx_id.chars().take(20).collect()
}

/// Parse a `submitUtxoTransaction` RPC envelope and return the accepted
/// tx_id.
///
/// `L1Endpoints::call` surfaces the raw envelope — a JSON-RPC `error`
/// field still arrives as `Ok`, so it must be rejected here explicitly.
/// Both `execute_fee_payout` and the deferred-payout processor share this
/// parser so a rejected or malformed submit can never be mistaken for a
/// paid-out batch.
///
/// Accepted forms:
/// * `{"result": {"accepted": true, "tx_id": "<hex>"}}` — canonical
/// * `{"result": "<tx_id>"}` — legacy bare-string success
///
/// Everything else is an error: a non-null `error` (even alongside a
/// `result`), a missing/null `result`, an object without an explicit
/// `accepted: true`, or a missing/wrong-type/blank `tx_id`.
pub fn parse_payout_submit_response(resp: &Value) -> anyhow::Result<String> {
    if let Some(err) = resp.get("error").filter(|e| !e.is_null()) {
        return Err(anyhow!("payout submit rejected by node: {err}"));
    }
    let result = resp
        .get("result")
        .filter(|r| !r.is_null())
        .ok_or_else(|| anyhow!("payout submit returned no result: {resp}"))?;

    // Legacy form: the node returns the tx id as a bare string.
    if let Some(tx_id) = result.as_str() {
        let tx_id = tx_id.trim();
        if tx_id.is_empty() {
            return Err(anyhow!("payout submit returned an empty tx_id"));
        }
        return Ok(tx_id.to_string());
    }

    // Canonical form: an object that explicitly accepted the tx.
    if result.get("accepted").and_then(|v| v.as_bool()) != Some(true) {
        let reason = result
            .get("reason")
            .and_then(|v| v.as_str())
            .unwrap_or("no reason given");
        return Err(anyhow!("payout submit not accepted: {reason}"));
    }
    let tx_id = result
        .get("tx_id")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| anyhow!("payout submit accepted but has no tx_id: {resp}"))?;
    Ok(tx_id.to_string())
}

/// Inclusion height + block hash from a `getTransaction` `result`.
///
/// Only a `confirmed: true` record with a positive `block_height` counts
/// as chain evidence (v3_rpc sets `confirmed`; a missing/false/non-bool
/// flag means the node is not attesting inclusion).
fn parse_tx_inclusion(result: &Value) -> Option<(u64, String)> {
    if result.get("confirmed").and_then(|v| v.as_bool()) != Some(true) {
        return None;
    }
    let height = result
        .get("block_height")
        .and_then(|v| v.as_u64())
        .filter(|h| *h > 0)?;
    let block_hash = result
        .get("block_hash")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    Some((height, block_hash))
}

/// Check if a transaction is on-chain.
///
/// Returns the block height and block hash (hex) only when the node
/// reports the transaction as `confirmed` at a positive `block_height`.
/// The response is read from the JSON-RPC `result` envelope.
pub async fn check_tx_on_chain(
    rpc_addr: &str,
    tx_id: &str,
) -> anyhow::Result<Option<(u64, String)>> {
    let eps = crate::rpc_client::L1Endpoints::from_urls(rpc_addr)
        .ok_or_else(|| anyhow::anyhow!("invalid L1 RPC URL: {}", rpc_addr))?;
    let resp = eps
        .call(&rpc_request("getTransaction", json!({ "txid": tx_id })))
        .await?;

    let result = resp.get("result").cloned().unwrap_or(Value::Null);
    Ok(parse_tx_inclusion(&result))
}

/// Get the current chain height from the node.
pub async fn get_chain_height(rpc_addr: &str) -> anyhow::Result<u64> {
    let eps = crate::rpc_client::L1Endpoints::from_urls(rpc_addr)
        .ok_or_else(|| anyhow::anyhow!("invalid L1 RPC URL: {}", rpc_addr))?;
    let result = eps.call(&rpc_request("getChainInfo", json!([]))).await?;

    result
        .get("result")
        .and_then(|r| {
            r.get("native_chain_height")
                .and_then(|v| v.as_u64())
                .or_else(|| r.get("chain_height").and_then(|v| v.as_u64()))
        })
        .ok_or_else(|| anyhow::anyhow!("missing chain_height in getChainInfo response"))
}

/// Get the network difficulty at the current tip.
pub async fn get_chain_difficulty(rpc_addr: &str) -> u64 {
    let height = match get_chain_height(rpc_addr).await {
        Ok(h) => h,
        Err(_) => return 0,
    };
    let eps = match crate::rpc_client::L1Endpoints::from_urls(rpc_addr) {
        Some(e) => e,
        None => return 0,
    };
    let block = match eps
        .call(&rpc_request(
            "getBlockByHeight",
            json!({ "height": height }),
        ))
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
        return Err(anyhow::anyhow!(
            "signing key must be 32 bytes, got {}",
            key_bytes.len()
        ));
    }
    let signing_key =
        ed25519_dalek::SigningKey::from_bytes(key_bytes.as_slice().try_into().unwrap());

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

    let eps = crate::rpc_client::L1Endpoints::from_urls(rpc_addr)
        .ok_or_else(|| anyhow::anyhow!("invalid L1 RPC URL: {}", rpc_addr))?;
    // Broadcast to all endpoints — mempools are node-local with no relay.
    let resp = eps
        .call_all(&rpc_request(
            "submitUtxoTransaction",
            json!({ "transaction": tx_json }),
        ))
        .await?;

    // `L1Endpoints::call_all` returns the raw envelope — a JSON-RPC `error`
    // field still arrives as Ok. A rejected submit must not fabricate a
    // tx_id and look like a paid-out batch to the caller.
    let tx_id = parse_payout_submit_response(&resp)?;

    info!(
        "fee_payout_executed height={} recipients={} tx_id={}",
        height,
        recipients.len(),
        short_tx_id(&tx_id)
    );

    Ok(tx_id)
}

/// Fetch spendable UTXOs for a pool wallet address from the node.
async fn fetch_pool_utxos(
    rpc_addr: &str,
    address: &str,
) -> anyhow::Result<Vec<zion_core::v31_wallet::SpendableUtxo>> {
    use zion_core::v31_wallet::SpendableUtxo;
    let eps = crate::rpc_client::L1Endpoints::from_urls(rpc_addr)
        .ok_or_else(|| anyhow::anyhow!("invalid L1 RPC URL: {}", rpc_addr))?;
    let resp = eps
        .call(&rpc_request("getUtxos", json!({ "address": address })))
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
                        script: hex::decode(u.get("script_hex")?.as_str().unwrap_or(""))
                            .unwrap_or_default(),
                        block_height: u.get("block_height")?.as_u64().unwrap_or(0),
                        is_coinbase: u.get("is_coinbase")?.as_bool().unwrap_or(false),
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
                (
                    deferred.height,
                    deferred.retry_count,
                    deferred.payouts.clone(),
                )
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
                        &format!(
                            "max_retries_exceeded ({} miners, {} flowers)",
                            payouts.len(),
                            total
                        ),
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
                            let eps = match crate::rpc_client::L1Endpoints::from_urls(&rpc) {
                                Some(e) => e,
                                None => {
                                    warn!("deferred_payout: invalid rpc addr: {}", rpc);
                                    continue;
                                }
                            };
                            match eps
                                .call_all(&rpc_request(
                                    "submitUtxoTransaction",
                                    json!({ "transaction": tx_json }),
                                ))
                                .await
                            {
                                Ok(resp) => {
                                    // `L1Endpoints::call` returns the raw
                                    // envelope — a JSON-RPC `error` field
                                    // still surfaces as Ok. The queue entry
                                    // is only dropped after the shared
                                    // parser confirms an accepted tx_id.
                                    match parse_payout_submit_response(&resp) {
                                        Ok(tx_id) => {
                                            info!(
                                                "payout_deferred_success height={} miners={} tx_id={} retry={}",
                                                height,
                                                payouts.len(),
                                                short_tx_id(&tx_id),
                                                retry
                                            );
                                            queue.lock().unwrap().remove(0);
                                        }
                                        Err(e) => {
                                            if retry % 10 == 0 || retry <= 3 {
                                                info!(
                                                    "payout_deferred_retry height={} miners={} retry={} error=unexpected_response: {}",
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

/// Inclusion height of `tx_id` on a UTXO entry: the entry's `tx_hash`
/// must match exactly and `block_height` must be a positive integer.
/// Entries with a missing, null, malformed or zero height are ignored —
/// they prove nothing about where the tx was included.
fn utxo_inclusion_height(utxo: &Value, tx_id: &str) -> Option<u64> {
    if utxo.get("tx_hash").and_then(|v| v.as_str())? != tx_id {
        return None;
    }
    utxo.get("block_height")
        .and_then(|v| v.as_u64())
        .filter(|h| *h > 0)
}

/// Confirmations for a tx included at `inclusion_height` when the chain
/// tip is `chain_height`. A future inclusion height (or 0) yields 0;
/// the result saturates at `u32::MAX`.
fn confirmations_at(chain_height: u64, inclusion_height: u64) -> u32 {
    if inclusion_height == 0 || inclusion_height > chain_height {
        return 0;
    }
    (chain_height - inclusion_height + 1).min(u32::MAX as u64) as u32
}

/// Return the inclusion height of `tx_id` as recorded on a matching
/// output in `address`'s UTXO set.
///
/// This is a fallback for nodes where `getTransaction` is not implemented
/// or returns null.  The UTXO `tx_hash` equals the transaction id and the
/// output's positive `block_height` is the tx's actual inclusion height —
/// using the payout's earning height instead would overstate
/// confirmations by the blocks between earning and broadcast.
async fn check_tx_on_chain_via_utxos(
    rpc_addr: &str,
    address: &str,
    tx_id: &str,
) -> anyhow::Result<Option<u64>> {
    let eps = crate::rpc_client::L1Endpoints::from_urls(rpc_addr)
        .ok_or_else(|| anyhow::anyhow!("invalid L1 RPC URL: {}", rpc_addr))?;
    let request = rpc_request("getUtxos", json!({ "address": address }));
    let resp = eps.call(&request).await?;

    if let Some(utxos) = resp
        .get("result")
        .and_then(|r| r.get("utxos"))
        .and_then(|v| v.as_array())
    {
        for utxo in utxos {
            if let Some(height) = utxo_inclusion_height(utxo, tx_id) {
                return Ok(Some(height));
            }
        }
    }
    Ok(None)
}

/// Spawn a background task that periodically checks submitted payouts
/// against the chain and marks them as confirmed.
///
/// Confirmations are computed from the transaction's actual inclusion
/// height — `block_height` from `getTransaction`, or the `block_height`
/// recorded on the matching output in the recipient's UTXO set. A UTXO
/// entry without a positive `block_height` is not treated as evidence and
/// the payout's earning height is never used as an inclusion height.
/// A payout group whose broadcast tx is provably dead — absent from the
/// chain AND the recipient UTXO set — and older than `stuck_age_secs` is
/// voided in the ledger and its entries re-queued so the next sweep builds
/// a fresh tx. The old tx cannot resurface: no node retains it (mempool
/// is volatile), so the fresh tx is the only payable path. Only `zion`
/// rows are re-queued — external payout chains own their sweeps.
fn resurrect_stuck_group(
    store: &ShareStore,
    pool: &Option<Arc<Mutex<crate::pool::Pool>>>,
    tx_id: &str,
    group: &[PayoutRow],
    stuck_age_secs: u64,
) {
    let Some(pool) = pool else {
        return;
    };
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    // Conservative: void only when every row of the dead tx is past the
    // stuck age (a mixed-age group means something else is going on).
    if !group.iter().all(|p| (now - p.ts) > stuck_age_secs as i64) {
        return;
    }
    let zion_rows: Vec<&PayoutRow> = group.iter().filter(|p| p.coin == "zion").collect();
    if zion_rows.is_empty() {
        return;
    }
    match store.void_payout_rows(tx_id) {
        Ok(0) => return,
        Ok(n) => info!(
            "payout_resurrect tx_id={} voided_rows={} requeue={} — broadcast tx never landed",
            tx_id,
            n,
            zion_rows.len()
        ),
        Err(e) => {
            warn!("payout_resurrect void failed for {tx_id}: {e}");
            return;
        }
    }
    let entries: Vec<(u64, PayoutEntry)> = zion_rows
        .iter()
        .map(|p| {
            (
                p.height,
                PayoutEntry {
                    miner_id: p.miner_id.clone(),
                    address: p.address.clone(),
                    amount: p.amount_flowers,
                    share_count: 0,
                    payout_chain: Some("zion".to_string()),
                    native_units: false,
                    coin: Some("zion".to_string()),
                    revenue_event: Some(format!("resurrect:{tx_id}")),
                },
            )
        })
        .collect();
    pool.lock()
        .expect("pool lock poisoned")
        .requeue_payouts(entries);
}

pub fn spawn_payout_confirmation_sweep(
    rpc_addr: Option<String>,
    interval_secs: u64,
    share_store: Option<Arc<ShareStore>>,
    pool: Option<Arc<Mutex<crate::pool::Pool>>>,
) {
    let interval = Duration::from_secs(interval_secs);
    let maturity_confirmations = std::env::var("ZION_PAYOUT_MATURITY")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(6u32);
    let stuck_age_secs = std::env::var("ZION_PAYOUT_STUCK_AGE_SECS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(7 * 86_400u64);

    info!(
        "payout_confirmation_sweep: enabled interval_secs={} maturity_confirmations={} stuck_age_secs={} resurrect={}",
        interval_secs, maturity_confirmations, stuck_age_secs, pool.is_some()
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
                    tracing::debug!(
                        "payout_confirmation_sweep: query_unconfirmed_payouts failed: {e}"
                    );
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
                        // Fallback: the tx's inclusion height as recorded on
                        // a matching output in the recipient's UTXO set.
                        let representative = &group[0];
                        match check_tx_on_chain_via_utxos(&rpc, &representative.address, &tx_id)
                            .await
                        {
                            Ok(Some(h)) => (h, String::new()),
                            Ok(None) => {
                                resurrect_stuck_group(
                                    &store,
                                    &pool,
                                    &tx_id,
                                    &group,
                                    stuck_age_secs,
                                );
                                continue;
                            }
                            Err(e) => {
                                tracing::debug!("payout_confirmation_sweep: getUtxos fallback failed for {}: {e}", representative.address);
                                continue;
                            }
                        }
                    }
                    Err(e) => {
                        tracing::debug!(
                            "payout_confirmation_sweep: check_tx_on_chain failed for {}: {e}",
                            tx_id
                        );
                        continue;
                    }
                };

                let confirmations = confirmations_at(chain_height, tx_height);

                if confirmations >= maturity_confirmations {
                    // Always record the inclusion height (schema v13): the
                    // UTXO-fallback path has it too (the output's recorded
                    // block_height), only block_hash may be empty.
                    let confirm = store.confirm_payout_with_block(
                        &tx_id,
                        confirmations,
                        &block_hash,
                        tx_height,
                    );
                    if let Err(e) = confirm {
                        warn!(
                            "payout_confirmation_sweep: confirm_payout failed for {}: {}",
                            tx_id, e
                        );
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
        let recipients =
            fee_payout_recipients(100, 50, 200, "human_addr", "issobella_addr", "pool_addr");
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
        let recipients =
            fee_payout_recipients(0, 50, 0, "human_addr", "issobella_addr", "pool_addr");
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
            payout_chain: None,
            native_units: false,
            coin: None,
            revenue_event: None,
        }];
        enqueue_deferred(&queue, payouts, 42);
        assert_eq!(queue.lock().unwrap().len(), 1);
        assert_eq!(queue.lock().unwrap()[0].height, 42);
        assert_eq!(queue.lock().unwrap()[0].retry_count, 0);
    }

    // ── parse_payout_submit_response ─────────────────────────────────

    #[test]
    fn parse_submit_accepts_canonical_object() {
        let resp = json!({"result": {"accepted": true, "tx_id": "abc123"}});
        assert_eq!(parse_payout_submit_response(&resp).unwrap(), "abc123");
    }

    #[test]
    fn parse_submit_accepts_legacy_string() {
        let resp = json!({"result": "deadbeef"});
        assert_eq!(parse_payout_submit_response(&resp).unwrap(), "deadbeef");
    }

    #[test]
    fn parse_submit_rejects_table() {
        // (envelope, why it must be rejected)
        let cases = vec![
            // Non-null envelope error — even alongside a valid result.
            (
                json!({"error": {"code": -1, "message": "rejected"}, "result": {"accepted": true, "tx_id": "x"}}),
                "error+result",
            ),
            (json!({"error": "bad tx"}), "error only"),
            (json!({}), "missing result"),
            (json!({"result": null}), "null result"),
            (
                json!({"result": {"accepted": false, "tx_id": "x", "reason": "dup"}}),
                "accepted false",
            ),
            (json!({"result": {"tx_id": "x"}}), "accepted missing"),
            (
                json!({"result": {"accepted": "true", "tx_id": "x"}}),
                "accepted wrong type",
            ),
            (json!({"result": {"accepted": true}}), "tx_id missing"),
            (
                json!({"result": {"accepted": true, "tx_id": 42}}),
                "tx_id wrong type",
            ),
            (
                json!({"result": {"accepted": true, "tx_id": ""}}),
                "tx_id empty",
            ),
            (
                json!({"result": {"accepted": true, "tx_id": "   "}}),
                "tx_id whitespace",
            ),
            (json!({"result": ""}), "legacy empty string"),
            (json!({"result": "   "}), "legacy whitespace string"),
            (
                json!({"result": {"accepted": true, "tx_id": null}}),
                "tx_id null",
            ),
        ];
        for (resp, why) in cases {
            assert!(
                parse_payout_submit_response(&resp).is_err(),
                "must reject: {why} ({resp})"
            );
        }
    }

    #[test]
    fn short_tx_id_is_char_safe() {
        // Multibyte chars must not panic the way `&s[..20]` does.
        let id = "žžžžžžžžžžšššššššššššš";
        assert_eq!(short_tx_id(id).chars().count(), 20);
        assert_eq!(short_tx_id("abc"), "abc");
    }

    // ── payout confirmation inclusion/confirmation math ──────────────

    #[test]
    fn utxo_inclusion_height_requires_match_and_positive_height() {
        let tx = "aa11";
        // Matched tx + positive height → actual inclusion height.
        assert_eq!(
            utxo_inclusion_height(&json!({"tx_hash": tx, "block_height": 199}), tx),
            Some(199)
        );
        // Missing / zero / malformed heights are not evidence.
        assert_eq!(
            utxo_inclusion_height(&json!({"tx_hash": tx}), tx),
            None,
            "missing block_height"
        );
        assert_eq!(
            utxo_inclusion_height(&json!({"tx_hash": tx, "block_height": 0}), tx),
            None,
            "zero block_height"
        );
        assert_eq!(
            utxo_inclusion_height(&json!({"tx_hash": tx, "block_height": "199"}), tx),
            None,
            "string block_height"
        );
        assert_eq!(
            utxo_inclusion_height(&json!({"tx_hash": tx, "block_height": null}), tx),
            None,
            "null block_height"
        );
        // Different tx → not a match.
        assert_eq!(
            utxo_inclusion_height(&json!({"tx_hash": "bb22", "block_height": 199}), tx),
            None
        );
    }

    #[test]
    fn confirmations_use_actual_inclusion_height() {
        // Payout earned at 100, tx included at 199, tip at 200 → 2
        // confirmations (the old earning-height fallback claimed 101).
        let inclusion =
            utxo_inclusion_height(&json!({"tx_hash": "t", "block_height": 199}), "t").unwrap();
        assert_eq!(confirmations_at(200, inclusion), 2);
        assert_ne!(
            confirmations_at(200, 100),
            2,
            "earning height must not be used"
        );
    }

    #[test]
    fn confirmations_immature_below_threshold() {
        let maturity = 6;
        // Included at 199: needs tip >= 204 for 6 confirmations.
        assert!(confirmations_at(203, 199) < maturity);
        assert!(confirmations_at(204, 199) >= maturity);
    }

    #[test]
    fn confirmations_future_height_is_zero() {
        // Inclusion above the tip (reorg/bad data) → 0, never inflated.
        assert_eq!(confirmations_at(200, 250), 0);
        assert_eq!(confirmations_at(200, 0), 0);
        assert_eq!(confirmations_at(200, 200), 1);
    }

    #[test]
    fn confirmations_saturate_at_u32_max() {
        assert_eq!(confirmations_at(u64::MAX, 1), u32::MAX);
    }

    #[test]
    fn tx_inclusion_requires_confirmed_and_positive_height() {
        // False confirmed → not chain evidence.
        assert_eq!(
            parse_tx_inclusion(
                &json!({"confirmed": false, "block_height": 199, "block_hash": "h"})
            ),
            None
        );
        // Missing confirmed → not evidence.
        assert_eq!(
            parse_tx_inclusion(&json!({"block_height": 199, "block_hash": "h"})),
            None
        );
        // Wrong-type confirmed → not evidence.
        assert_eq!(
            parse_tx_inclusion(&json!({"confirmed": "yes", "block_height": 199})),
            None
        );
        // Confirmed but zero/missing height → not evidence.
        assert_eq!(
            parse_tx_inclusion(&json!({"confirmed": true, "block_height": 0})),
            None
        );
        assert_eq!(parse_tx_inclusion(&json!({"confirmed": true})), None);
        // Valid record → (height, hash).
        assert_eq!(
            parse_tx_inclusion(&json!({"confirmed": true, "block_height": 199, "block_hash": "h"})),
            Some((199, "h".to_string()))
        );
    }
}
