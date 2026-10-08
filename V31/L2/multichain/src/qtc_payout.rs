//! QTC (Quantus) pool payout sweeper.
//!
//! Miners can register a Quantus payout target on the pool via a
//! `qtc:<ss58>`/`qtu:<ss58>` worker wallet or a bare `qz…` SS58-189 address
//! (v3 Hello `payout_address` supported too).  Their ZION-share rewards
//! stay denominated in flowers in the pool's PPLNS queue; this sweeper
//! drains the external-chain queue (`POST /admin/external-payouts`) and
//! settles each entry on Quantus Planck with a native
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
    /// safe default rate.
    pub planks_per_flower: u128,
    /// Poll interval (`QTC_PAYOUT_INTERVAL_S`, default 60).
    pub interval: Duration,
    /// Minimum per-payout planks — entries below stay 'queued' as dust
    /// (`QTC_PAYOUT_MIN_PLANKS`, default 0 = pay everything).
    pub min_planks: u128,
    /// Max submit attempts per record before 'stalled'
    /// (`QTC_PAYOUT_MAX_ATTEMPTS`, default 3).
    pub max_attempts: u32,
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
        let planks_per_flower: u128 = std::env::var("QTC_PLANKS_PER_FLOWER")
            .map_err(|_| MultichainError::Config("QTC_PLANKS_PER_FLOWER not set".into()))?
            .parse()
            .map_err(|e| MultichainError::Config(format!("bad QTC_PLANKS_PER_FLOWER: {e}")))?;
        if planks_per_flower == 0 {
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
        Ok(Some(Self {
            enabled: true,
            pool_api: pool_api.trim_end_matches('/').to_string(),
            admin_key,
            planks_per_flower,
            interval: Duration::from_secs(interval_s.max(5)),
            min_planks,
            max_attempts,
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
    height: u64,
    miner_id: String,
    address: String,
    amount_flowers: u64,
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
    for p in &resp.payouts {
        let id = format!("quantus:{}:{}", p.height, p.miner_id);
        let planks = (p.amount_flowers as u128)
            .checked_mul(config.planks_per_flower)
            .unwrap_or(u128::MAX);
        if planks < config.min_planks {
            continue; // dust — record nothing, keep queue small
        }
        let now = now_secs() as i64;
        let db = db.lock().await;
        db.conn().execute(
            "INSERT OR IGNORE INTO ext_payout_records \
             (id, chain, source_height, miner_id, address, amount_flowers, \
              amount_native, status, created_at, updated_at) \
             VALUES (?1,'quantus',?2,?3,?4,?5,?6,'queued',?7,?7)",
            rusqlite::params![
                id,
                p.height as i64,
                p.miner_id,
                p.address,
                p.amount_flowers as i64,
                planks.to_string(),
                now
            ],
        )?;
    }

    // 3. Submit due 'queued' rows (bounded attempts).
    struct Row {
        id: String,
        address: String,
        planks: String,
        attempts: u32,
    }
    let due: Vec<Row> = {
        let db = db.lock().await;
        let mut stmt = db.conn().prepare(
            "SELECT id, address, amount_native, attempts FROM ext_payout_records \
             WHERE chain='quantus' AND status='queued' AND amount_native IS NOT NULL \
             ORDER BY created_at LIMIT 50",
        )?;
        let rows = stmt
            .query_map([], |r| {
                Ok(Row {
                    id: r.get(0)?,
                    address: r.get(1)?,
                    planks: r.get(2)?,
                    attempts: r.get::<_, u32>(3)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        rows
    };

    for row in due {
        let planks: u128 = row.planks.parse().unwrap_or(0);
        let account = match crate::chain::adapters::quantus::ss58_decode(&row.address) {
            Ok((acct, _)) => acct,
            Err(e) => {
                mark_error(db, &row.id, &format!("bad ss58: {e}"), row.attempts, config.max_attempts).await;
                continue;
            }
        };
        let to = Address::new(ChainId::Quantus, account.to_vec(), row.address.clone())
            .map_err(|e| MultichainError::Validation(format!("bad payout addr: {e}")))?;
        match adapter
            .send_payment(&to, Amount(planks))
            .await
        {
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
                mark_error(db, &row.id, &e.to_string(), row.attempts, config.max_attempts).await;
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

async fn mark_error(
    db: &Arc<Mutex<Db>>,
    id: &str,
    error: &str,
    attempts: u32,
    max_attempts: u32,
) {
    // Submission RPC errors are ambiguous (the extrinsic may have landed
    // before the error surfaced) — after `max_attempts` we stall rather
    // than risk a duplicate payment.
    let next = attempts + 1;
    let status = if next >= max_attempts { "stalled" } else { "queued" };
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
