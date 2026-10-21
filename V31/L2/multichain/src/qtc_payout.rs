//! QTC (Quantus) pool payout sweeper.
//!
//! Miners can register a Quantus payout target on the pool via a
//! `qtc:<ss58>`/`qtu:<ss58>` worker wallet or a bare `qz…` SS58-189 address
//! (v3 Hello `payout_address` supported too).  Their ZION-share rewards
//! stay denominated in flowers in the pool's PPLNS queue; this sweeper
//! drains the external-chain queue (`POST /admin/external-payouts`) and
//! settles each entry on Quantus mainnet with a native
//! `balances.transfer_keep_alive` signed by the payout keyring
//! (`keyring.quantus_keypair(0,0)`, fallback `QUANTUS_SEED`).
//!
//! Fail-closed idempotency: drained entries are written to the
//! `ext_payout_records` ledger *before* any on-chain submission, keyed
//! `{chain}:{height}:{miner_id}`.  A 'queued' row that survives a restart
//! is promoted to 'stalled' — a crash between `author_submitExtrinsic` and
//! the ledger update is indistinguishable from a crash before it, so
//! automatic redelivery could double-pay.  Stalled rows need operator
//! review (check the chain, then resubmit or refund).
//!
//! Treasury gate: before submitting, the sweeper reads the payout
//! account's free balance; rows that can't afford `amount + fee` are
//! parked as 'deferred' (attempts=0, never submitted — safe across
//! restarts) and go out once collected rewards fund the treasury.
//!
//! Pool fee accounting stays in ZION: `amount_flowers` is the miner's
//! post-fee share; the operator's fee never leaves the pool wallet.

use std::sync::Arc;
use std::time::Duration;

use tokio::sync::Mutex;

use serde::Deserialize;
use tracing::{info, warn};

use crate::chain::adapters::quantus::QuantusAdapter;
use crate::chain::ChainAdapter;
use crate::db::Db;
use crate::error::{MultichainError, MultichainResult};
use zion_l1_types::{Address, Amount, ChainId};

/// Sweeper configuration — all values from env (`QTC_PAYOUT_*`).
#[derive(Debug, Clone)]
pub struct QtcPayoutConfig {
    /// `QTC_PAYOUT_ENABLED=1` required to spawn.
    pub enabled: bool,
    /// Pool admin API base URL, e.g. `http://127.0.0.1:PORT`
    /// (`QTC_PAYOUT_POOL_API`).
    pub pool_api: String,
    /// Pool admin key (`QTC_PAYOUT_ADMIN_KEY`) — sent as `X-Admin-Key`.
    pub admin_key: String,
    /// Planks (QTC base unit, 12 decimals) paid per flower of pool reward
    /// (`QTC_PLANKS_PER_FLOWER`).  Required when enabled — there is no
    /// safe default rate.  Accepts decimals ("1.2386" → 12386/10000) —
    /// stored as exact rational so sub-1 rates don't lose precision.
    pub planks_per_flower_num: u128,
    pub planks_per_flower_den: u128,
    /// Poll interval (`QTC_PAYOUT_INTERVAL_S`, default 60).
    pub interval: Duration,
    /// Minimum per-payout planks — entries below stay 'queued' as dust
    /// (`QTC_PAYOUT_MIN_PLANKS`, default 0 = pay everything).
    pub min_planks: u128,
    /// Max submit attempts per record before 'stalled'
    /// (`QTC_PAYOUT_MAX_ATTEMPTS`, default 3).
    pub max_attempts: u32,
    /// Pool fee on the QTC leg, basis points of the converted amount
    /// (`QTC_PAYOUT_FEE_BPS`, e.g. 200 = 2%; default 0).  The fee stays
    /// on the payout account (we simply send less).
    pub fee_bps: u64,
    /// Max acceptable per-tx fee in planks (`QTC_PAYOUT_MAX_FEE_PLANKS`;
    /// default 0 = no cap).  Checked via `payment_queryInfo` before
    /// broadcast — over-cap rows stay 'queued' for the next tick.
    pub max_fee_planks: u128,
}

/// Parse a decimal string into an exact (num, den) ratio — "1.2386" →
/// (12386, 10_000).  Rejects empty/garbage; den is always ≥ 1.
fn parse_decimal_ratio(s: &str) -> Option<(u128, u128)> {
    if s.is_empty() || s.starts_with(['+', '-']) {
        return None;
    }
    let (int, frac) = s.split_once('.').unwrap_or((s, ""));
    if int.is_empty() && frac.is_empty() {
        return None;
    }
    if !int.chars().all(|c| c.is_ascii_digit()) || !frac.chars().all(|c| c.is_ascii_digit()) {
        return None;
    }
    let num: u128 = format!("{}{}", int, frac).parse().ok()?;
    let den = 10u128.checked_pow(frac.len() as u32)?;
    Some((num, den))
}

impl QtcPayoutConfig {
    pub fn from_env() -> MultichainResult<Option<Self>> {
        if std::env::var("QTC_PAYOUT_ENABLED").ok().as_deref() != Some("1") {
            return Ok(None);
        }
        let pool_api = std::env::var("QTC_PAYOUT_POOL_API")
            .map_err(|_| MultichainError::Config("QTC_PAYOUT_POOL_API not set".into()))?;
        let admin_key = std::env::var("QTC_PAYOUT_ADMIN_KEY")
            .map_err(|_| MultichainError::Config("QTC_PAYOUT_ADMIN_KEY not set".into()))?;
        let rate_raw = std::env::var("QTC_PLANKS_PER_FLOWER")
            .map_err(|_| MultichainError::Config("QTC_PLANKS_PER_FLOWER not set".into()))?;
        let (planks_per_flower_num, planks_per_flower_den) = parse_decimal_ratio(rate_raw.trim())
            .ok_or_else(|| {
            MultichainError::Config(format!("bad QTC_PLANKS_PER_FLOWER: {rate_raw}"))
        })?;
        if planks_per_flower_num == 0 {
            return Err(MultichainError::Config(
                "QTC_PLANKS_PER_FLOWER must be > 0".into(),
            ));
        }
        let interval_s: u64 = std::env::var("QTC_PAYOUT_INTERVAL_S")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(60);
        let min_planks: u128 = std::env::var("QTC_PAYOUT_MIN_PLANKS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(0);
        let max_attempts: u32 = std::env::var("QTC_PAYOUT_MAX_ATTEMPTS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(3);
        let fee_bps: u64 = std::env::var("QTC_PAYOUT_FEE_BPS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(0)
            .min(10_000);
        let max_fee_planks: u128 = std::env::var("QTC_PAYOUT_MAX_FEE_PLANKS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(0);
        Ok(Some(Self {
            enabled: true,
            pool_api: pool_api.trim_end_matches('/').to_string(),
            admin_key,
            planks_per_flower_num,
            planks_per_flower_den,
            interval: Duration::from_secs(interval_s.max(5)),
            min_planks,
            max_attempts,
            fee_bps,
            max_fee_planks,
        }))
    }
}

#[derive(Debug, Deserialize)]
struct DrainResponse {
    ok: bool,
    #[serde(default)]
    payouts: Vec<DrainEntry>,
}

#[derive(Debug, Deserialize)]
struct DrainEntry {
    #[serde(default)]
    outbox_id: Option<String>,
    height: u64,
    miner_id: String,
    address: String,
    amount_flowers: u64,
    /// "native" = amount is already in QTC planks (per-coin revenue
    /// distribution); anything else = ZION flowers needing FX conversion.
    #[serde(default)]
    unit: String,
    /// Source coin for native payouts (e.g. "qtu") — informational.
    #[serde(default)]
    coin: Option<String>,
    /// Revenue event id for native payouts — feeds the ledger key so
    /// multiple events at the same reference height can't collide.
    #[serde(default)]
    event: Option<String>,
}

/// Decide `(ledger_id, gross_planks)` for a drained entry — `None` when
/// the entry must be skipped.  `unit:"native"` entries arrive already
/// denominated in planks (no FX conversion) and carry a revenue `event`
/// id that scopes the ledger key, so two events at the same reference
/// height can't collapse into one row.
fn plan_entry(p: &DrainEntry, config: &QtcPayoutConfig) -> Option<(String, u128)> {
    let native = p.unit == "native";
    if native {
        // Native-unit entries come from a coin's own revenue event —
        // sanity-check the coin actually settles on Quantus.
        let coin = p.coin.as_deref().unwrap_or("");
        if !matches!(coin, "qtu" | "qtc" | "quantus") {
            warn!(
                miner = %p.miner_id,
                coin,
                "qtc_sweeper skipping native entry for non-quantus coin"
            );
            return None;
        }
    }
    let id = match p.event.as_deref() {
        Some(ev) if native => format!("quantus:rev:{ev}:{}", p.miner_id),
        _ => format!("quantus:{}:{}", p.height, p.miner_id),
    };
    let gross_planks = if native {
        p.amount_flowers as u128
    } else {
        (p.amount_flowers as u128)
            .checked_mul(config.planks_per_flower_num)
            .unwrap_or(u128::MAX)
            / config.planks_per_flower_den
    };
    Some((id, gross_planks))
}

/// Spawn the sweeper task.  `adapter` is shared with the registry-registered
/// Quantus adapter (same keyring → same payout account).
pub fn spawn_qtc_payout_sweeper(
    config: QtcPayoutConfig,
    adapter: Arc<QuantusAdapter>,
    db: Arc<Mutex<Db>>,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        // Restart guard: 'queued' rows are ambiguous (crash may have happened
        // after author_submitExtrinsic but before the ledger write) →
        // promote to 'stalled' instead of risking a double-pay.
        match stall_orphaned_queued(&db).await {
            Ok(0) => {}
            Ok(n) => warn!(stalled = n, "qtc_sweeper stalled orphaned queued payouts"),
            Err(e) => warn!("qtc_sweeper stall pass failed: {e}"),
        }

        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());
        info!(
            interval_s = config.interval.as_secs(),
            "qtc payout sweeper started"
        );
        loop {
            if let Err(e) = tick(&config, &adapter, &db, &http).await {
                warn!("qtc payout sweep error: {e}");
            }
            tokio::time::sleep(config.interval).await;
        }
    })
}

async fn stall_orphaned_queued(db: &Arc<Mutex<Db>>) -> MultichainResult<usize> {
    let now = now_secs();
    let db = db.lock().await;
    let n = db.conn().execute(
        "UPDATE ext_payout_records SET status='stalled', \
         error='restart while queued — manual review', updated_at=?1 \
         WHERE chain='quantus' AND status='queued'",
        rusqlite::params![now as i64],
    )?;
    Ok(n)
}

fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

async fn tick(
    config: &QtcPayoutConfig,
    adapter: &Arc<QuantusAdapter>,
    db: &Arc<Mutex<Db>>,
    http: &reqwest::Client,
) -> MultichainResult<()> {
    // 1. Drain fresh entries from the pool.
    let url = format!("{}/admin/external-payouts?chain=quantus", config.pool_api);
    let resp: DrainResponse = http
        .post(&url)
        .header("X-Admin-Key", &config.admin_key)
        .send()
        .await
        .map_err(|e| MultichainError::Internal(format!("pool drain: {e}")))?
        .json()
        .await
        .map_err(|e| MultichainError::Internal(format!("pool drain decode: {e}")))?;
    if !resp.ok {
        return Err(MultichainError::Internal("pool drain not ok".into()));
    }
    if !resp.payouts.is_empty() {
        info!(count = resp.payouts.len(), "qtc_sweeper drained payouts");
    }

    // 2. Ledger each drained entry (queued) before touching the chain.
    let mut ack_ids = Vec::new();
    for p in &resp.payouts {
        let Some((id, gross_planks)) = plan_entry(p, config) else {
            continue;
        };
        // Pool fee on the QTC leg: deducted from the converted amount;
        // it never leaves the payout account (we simply send less).
        let fee_planks = gross_planks.saturating_mul(config.fee_bps as u128) / 10_000;
        let planks = gross_planks.saturating_sub(fee_planks);
        let status = if planks < config.min_planks {
            "dust"
        } else {
            "queued"
        };
        let now = now_secs() as i64;
        let db = db.lock().await;
        db.conn().execute(
            "INSERT OR IGNORE INTO ext_payout_records \
             (id, chain, source_height, miner_id, address, amount_flowers, \
              amount_native, fee_native, status, created_at, updated_at) \
             VALUES (?1,'quantus',?2,?3,?4,?5,?6,?7,?8,?9,?9)",
            rusqlite::params![
                id,
                p.height as i64,
                p.miner_id,
                p.address,
                p.amount_flowers as i64,
                planks.to_string(),
                fee_planks.to_string(),
                status,
                now
            ],
        )?;
        if let Some(outbox_id) = p.outbox_id.as_ref() {
            ack_ids.push(outbox_id.clone());
        }
    }

    // Unsupported entries remain pending for operator review rather than
    // being silently discarded.
    if !ack_ids.is_empty() {
        let ack_url = format!("{}/admin/external-payouts/ack", config.pool_api);
        let ack: serde_json::Value = http
            .post(&ack_url)
            .header("X-Admin-Key", &config.admin_key)
            .json(&serde_json::json!({"chain": "quantus", "ids": ack_ids}))
            .send()
            .await
            .map_err(|e| MultichainError::Internal(format!("pool outbox ACK: {e}")))?
            .json()
            .await
            .map_err(|e| MultichainError::Internal(format!("pool outbox ACK decode: {e}")))?;
        if ack.get("ok").and_then(|v| v.as_bool()) != Some(true) {
            return Err(MultichainError::Internal(format!(
                "pool outbox ACK rejected: {ack}"
            )));
        }
    }

    // 3. Submit due rows (bounded attempts). 'deferred' = parked by the
    // treasury-balance gate — never submitted, safe to keep across restarts.
    struct Row {
        id: String,
        address: String,
        planks: String,
        attempts: u32,
        deferred: bool,
    }
    let due: Vec<Row> = {
        let db = db.lock().await;
        let mut stmt = db.conn().prepare(
            "SELECT id, address, amount_native, attempts, status FROM ext_payout_records \
             WHERE chain='quantus' AND status IN ('queued','deferred') \
             AND amount_native IS NOT NULL ORDER BY created_at LIMIT 50",
        )?;
        let rows = stmt
            .query_map([], |r| {
                Ok(Row {
                    id: r.get(0)?,
                    address: r.get(1)?,
                    planks: r.get(2)?,
                    attempts: r.get::<_, u32>(3)?,
                    deferred: r.get::<_, String>(4)? == "deferred",
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        rows
    };

    // Treasury balance gate: with an unfunded payout account every submission
    // deterministically fails InsufficientFunds and would burn attempts
    // toward 'stalled'. Defer instead — rows stay 'queued' and go out once
    // collected rewards land. A failed balance query fails closed (no sends).
    let mut treasury_free: Option<u128> = match adapter.signer_account_id() {
        Ok(acct) => {
            let ss58 = crate::chain::adapters::quantus::ss58_encode(
                &acct,
                crate::chain::adapters::quantus::QUANTUS_SS58_PREFIX,
            );
            match Address::new(ChainId::Quantus, acct.to_vec(), ss58) {
                Ok(a) => match adapter.balance(&a).await {
                    Ok(bal) => Some(bal.0),
                    Err(e) => {
                        warn!("qtc treasury balance query failed — deferring sends: {e}");
                        None
                    }
                },
                Err(e) => {
                    warn!("qtc treasury address build failed — deferring sends: {e}");
                    None
                }
            }
        }
        Err(e) => {
            warn!("qtc signer unavailable — deferring sends: {e}");
            None
        }
    };

    for row in due {
        let planks: u128 = row.planks.parse().unwrap_or(0);
        let account = match crate::chain::adapters::quantus::ss58_decode(&row.address) {
            Ok((acct, _)) => acct,
            Err(e) => {
                mark_error(
                    db,
                    &row.id,
                    &format!("bad ss58: {e}"),
                    row.attempts,
                    config.max_attempts,
                )
                .await;
                continue;
            }
        };
        let to = Address::new(ChainId::Quantus, account.to_vec(), row.address.clone())
            .map_err(|e| MultichainError::Validation(format!("bad payout addr: {e}")))?;

        // Fee estimate via payment_queryInfo: over-cap rows stay 'queued'
        // and retry next tick (fee market may settle). The estimate also
        // feeds the treasury-balance check below.
        let mut est_fee = 2_000_000_000u128; // observed mainnet fee ~0.8–1.0e9
        match adapter.estimate_transfer_fee(&to, planks).await {
            Ok(est) => {
                est_fee = est.partial_fee.max(1);
                if config.max_fee_planks > 0 && est.partial_fee > config.max_fee_planks {
                    warn!(
                        id = %row.id,
                        fee = est.partial_fee,
                        cap = config.max_fee_planks,
                        "qtc payout fee over cap — deferring"
                    );
                    continue;
                }
            }
            Err(e) => {
                // Estimation failing is transient — don't block the
                // payout on it, just log and proceed.
                warn!(id = %row.id, "qtc fee estimate failed, sending anyway: {e}");
            }
        }

        // Balance check: amount + fee must fit the current free balance.
        match treasury_free {
            Some(free) if planks.saturating_add(est_fee) <= free => {
                treasury_free = Some(free.saturating_sub(planks.saturating_add(est_fee)));
            }
            _ => {
                info!(
                    id = %row.id,
                    planks,
                    treasury_free,
                    "qtc payout deferred — treasury balance insufficient/unknown"
                );
                // Only never-submitted rows may park as 'deferred' — a row
                // with attempts>0 may have already landed on-chain and
                // must stay 'queued' so a restart stalls it for review.
                if row.attempts == 0 {
                    mark_deferred(db, &row.id, "awaiting treasury funding").await;
                }
                continue;
            }
        }

        // A 'deferred' row was never submitted — but a crash between
        // send_payment() and the ledger write below is ambiguous. Record
        // the submit intent ('queued') first so a restart stalls it
        // instead of resubmitting a possibly-landed payment.
        if row.deferred {
            let db = db.lock().await;
            db.conn().execute(
                "UPDATE ext_payout_records SET status='queued', updated_at=?2 WHERE id=?1",
                rusqlite::params![row.id, now_secs() as i64],
            )?;
        }

        match adapter.send_payment(&to, Amount(planks)).await {
            Ok(hash) => {
                let now = now_secs() as i64;
                let db = db.lock().await;
                db.conn().execute(
                    "UPDATE ext_payout_records SET status='submitted', tx_hash=?2, \
                     attempts=?3, error=NULL, updated_at=?4 WHERE id=?1",
                    rusqlite::params![row.id, hash.to_hex(), row.attempts + 1, now],
                )?;
                info!(id = %row.id, tx = %hash.to_hex(), "qtc payout submitted");
            }
            Err(e) => {
                mark_error(
                    db,
                    &row.id,
                    &e.to_string(),
                    row.attempts,
                    config.max_attempts,
                )
                .await;
            }
        }
    }

    // 4. Confirm 'submitted' rows.
    let submitted: Vec<(String, String)> = {
        let db = db.lock().await;
        let mut stmt = db.conn().prepare(
            "SELECT id, tx_hash FROM ext_payout_records \
             WHERE chain='quantus' AND status='submitted' AND tx_hash IS NOT NULL \
             ORDER BY updated_at LIMIT 50",
        )?;
        let rows = stmt
            .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?
            .collect::<Result<Vec<_>, _>>()?;
        rows
    };
    for (id, txh) in submitted {
        let Some(hash) = zion_l1_types::Hash::from_hex(&txh) else {
            continue;
        };
        let confs = adapter.confirmations(&hash).await.unwrap_or(0);
        if confs >= 30 {
            let now = now_secs() as i64;
            let db = db.lock().await;
            db.conn().execute(
                "UPDATE ext_payout_records SET status='confirmed', updated_at=?2 WHERE id=?1",
                rusqlite::params![id, now],
            )?;
            info!(id = %id, tx = %txh, confs, "qtc payout confirmed");
        }
    }
    Ok(())
}

/// Park a never-submitted row as 'deferred' — the payout is recorded and
/// pending, but the treasury lacks funds. Unlike 'queued', a deferred row
/// survives restarts (it is unambiguously not on-chain).
async fn mark_deferred(db: &Arc<Mutex<Db>>, id: &str, reason: &str) {
    let now = now_secs() as i64;
    let db = db.lock().await;
    let _ = db.conn().execute(
        "UPDATE ext_payout_records SET status='deferred', error=?2, updated_at=?3 \
         WHERE id=?1 AND attempts=0",
        rusqlite::params![id, reason, now],
    );
}

async fn mark_error(db: &Arc<Mutex<Db>>, id: &str, error: &str, attempts: u32, max_attempts: u32) {
    // Submission RPC errors are ambiguous (the extrinsic may have landed
    // before the error surfaced) — after `max_attempts` we stall rather
    // than risk a duplicate payment.
    let next = attempts + 1;
    let status = if next >= max_attempts {
        "stalled"
    } else {
        "queued"
    };
    let now = now_secs() as i64;
    let db = db.lock().await;
    let _ = db.conn().execute(
        "UPDATE ext_payout_records SET status=?2, attempts=?3, error=?4, updated_at=?5 \
         WHERE id=?1",
        rusqlite::params![id, status, next, error, now],
    );
    if status == "stalled" {
        warn!(id = %id, error = %error, "qtc payout stalled — manual review");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(Clone)]
    struct AckTestState {
        db: Arc<Mutex<Db>>,
        ack_saw_ledger: Arc<std::sync::atomic::AtomicBool>,
    }

    async fn drain_outbox() -> axum::Json<serde_json::Value> {
        axum::Json(serde_json::json!({
            "ok": true,
            "payouts": [{
                "outbox_id": "qtc-outbox-1",
                "height": 42,
                "miner_id": "alice",
                "address": "invalid-address",
                "amount_flowers": 1000,
                "unit": "native",
                "coin": "qtu",
                "event": "qtu:bal:0:1k"
            }]
        }))
    }

    async fn ack_outbox(
        axum::extract::State(state): axum::extract::State<AckTestState>,
        axum::Json(_payload): axum::Json<serde_json::Value>,
    ) -> axum::Json<serde_json::Value> {
        let db = state.db.lock().await;
        let ledgered = db
            .conn()
            .query_row(
                "SELECT COUNT(*) FROM ext_payout_records \
                 WHERE id='quantus:rev:qtu:bal:0:1k:alice'",
                [],
                |row| row.get::<_, i64>(0),
            )
            .unwrap()
            > 0;
        state
            .ack_saw_ledger
            .store(ledgered, std::sync::atomic::Ordering::SeqCst);
        axum::Json(serde_json::json!({"ok": true}))
    }

    fn cfg() -> QtcPayoutConfig {
        QtcPayoutConfig {
            enabled: true,
            pool_api: "http://x".into(),
            admin_key: "k".into(),
            planks_per_flower_num: 2,
            planks_per_flower_den: 1,
            interval: Duration::from_secs(60),
            min_planks: 0,
            max_attempts: 3,
            fee_bps: 0,
            max_fee_planks: 0,
        }
    }

    fn entry(unit: &str, coin: Option<&str>, event: Option<&str>) -> DrainEntry {
        DrainEntry {
            outbox_id: None,
            height: 42,
            miner_id: "alice".into(),
            address: "qz1alice".into(),
            amount_flowers: 1_000,
            unit: unit.into(),
            coin: coin.map(|c| c.into()),
            event: event.map(|e| e.into()),
        }
    }

    #[test]
    fn flowers_entry_fx_converts() {
        let (id, planks) = plan_entry(&entry("flowers", None, None), &cfg()).unwrap();
        assert_eq!(id, "quantus:42:alice");
        assert_eq!(planks, 2_000); // 1000 flowers × 2 planks
    }

    #[test]
    fn native_entry_skips_fx_and_scopes_key() {
        let (id, planks) =
            plan_entry(&entry("native", Some("qtu"), Some("qtu:bal:0:1k")), &cfg()).unwrap();
        assert_eq!(id, "quantus:rev:qtu:bal:0:1k:alice");
        assert_eq!(planks, 1_000); // already planks — no conversion
    }

    #[test]
    fn native_wrong_coin_skipped() {
        assert!(plan_entry(&entry("native", Some("prl"), Some("e1")), &cfg()).is_none());
    }

    #[tokio::test]
    async fn durable_outbox_is_ledgered_before_ack() {
        use axum::routing::post;

        let db = Arc::new(Mutex::new(Db::open_in_memory().unwrap()));
        let ack_saw_ledger = Arc::new(std::sync::atomic::AtomicBool::new(false));
        let app = axum::Router::new()
            .route("/admin/external-payouts", post(drain_outbox))
            .route("/admin/external-payouts/ack", post(ack_outbox))
            .with_state(AckTestState {
                db: db.clone(),
                ack_saw_ledger: ack_saw_ledger.clone(),
            });
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let server = tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });

        let mut config = cfg();
        config.pool_api = format!("http://{addr}");
        let result = tick(
            &config,
            &Arc::new(QuantusAdapter::new("http://127.0.0.1:1")),
            &db,
            &reqwest::Client::new(),
        )
        .await;
        server.abort();

        result.unwrap();
        assert!(ack_saw_ledger.load(std::sync::atomic::Ordering::SeqCst));
        let db = db.lock().await;
        let status: String = db
            .conn()
            .query_row(
                "SELECT status FROM ext_payout_records \
                 WHERE id='quantus:rev:qtu:bal:0:1k:alice'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(status, "queued");
    }

    #[test]
    fn decimal_ratio_parses_exact() {
        assert_eq!(parse_decimal_ratio("1"), Some((1, 1)));
        assert_eq!(parse_decimal_ratio("1.2386"), Some((12386, 10_000)));
        assert_eq!(parse_decimal_ratio("0.5"), Some((5, 10)));
        assert_eq!(parse_decimal_ratio("12."), Some((12, 1)));
        assert_eq!(parse_decimal_ratio(".5"), Some((5, 10)));
        // invalid
        assert_eq!(parse_decimal_ratio(""), None);
        assert_eq!(parse_decimal_ratio("-1.5"), None);
        assert_eq!(parse_decimal_ratio("1.2.3"), None);
        assert_eq!(parse_decimal_ratio("abc"), None);
        assert_eq!(parse_decimal_ratio("1,5"), None);
    }

    #[test]
    fn decimal_ratio_applies_sub_one_rate() {
        // QTC at ~$161 vs ZION $0.0002 → ~1.24 planks per flower.
        // 10 ZION (10e6 flowers) must convert to ~12.4e6 planks, not 10e6.
        let (num, den) = parse_decimal_ratio("1.2386").unwrap();
        let flowers: u128 = 10_000_000;
        let planks = flowers.checked_mul(num).unwrap() / den;
        assert_eq!(planks, 12_386_000);
    }
}
