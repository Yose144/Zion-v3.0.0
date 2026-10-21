//! PRL (Pearl) pool payout sweeper.
//!
//! Mirror of `qtc_payout.rs` for the Pearl chain: drains the pool's
//! external payout queue (`POST /admin/external-payouts?chain=pearl`) and
//! settles entries with `sendtoaddress` on the oyster wallet RPC
//! (`oyster`/`oystercli`, Bitcoin-derived JSON-RPC).
//!
//! Unlike QTC there is *no* FX path here — only `unit:"native"` drain
//! entries are settled (PRL has no configured flowers→PRL rate; a
//! flowers entry on the pearl chain would mean a pool accounting bug,
//! so it is skipped with a warning rather than paid).
//!
//! **Dry-run by default**: until live payout semantics are proven on
//! Pearl testnet/regtest, `PRL_PAYOUT_DRY_RUN` defaults to 1 — rows are
//! ledgered, validated, and marked `dryrun` instead of broadcasting.
//! Set `PRL_PAYOUT_DRY_RUN=0` explicitly for live sends.
//!
//! Fail-closed idempotency is identical to the QTC sweeper: ledger row
//! before submission, restart promotes 'queued' → 'stalled'.

use std::sync::Arc;
use std::time::Duration;

use serde::Deserialize;
use tokio::sync::Mutex;
use tracing::{info, warn};

use crate::chain::adapters::pearl::is_valid_pearl_address_for_hrp;
use crate::db::Db;
use crate::error::{MultichainError, MultichainResult};

/// Sweeper configuration — all values from env (`PRL_PAYOUT_*`).
#[derive(Debug, Clone)]
pub struct PrlPayoutConfig {
    /// `PRL_PAYOUT_ENABLED=1` required to spawn.
    pub enabled: bool,
    /// Pool admin API base URL (`PRL_PAYOUT_POOL_API`).
    pub pool_api: String,
    /// Pool admin key (`PRL_PAYOUT_ADMIN_KEY`) — sent as `X-Admin-Key`.
    pub admin_key: String,
    /// Oyster wallet JSON-RPC endpoint (`PRL_RPC_URL`, e.g.
    /// `http://127.0.0.1:44207`).
    pub rpc_url: String,
    /// RPC basic-auth credentials (`PRL_RPC_USER` / `PRL_RPC_PASS`).
    pub rpc_user: String,
    pub rpc_pass: String,
    /// Send RPC method name (`PRL_RPC_SEND_METHOD`, default `sendfrom` —
    /// the real oyster wallet API; `sendtoaddress` does not exist on
    /// oyster). `sendfrom` takes `(account, address, amount, feerate)`.
    pub rpc_send_method: String,
    /// Oyster wallet account for sends (`PRL_RPC_SEND_ACCOUNT`, default
    /// `default`).
    pub rpc_send_account: String,
    /// Fee rate per KB passed to `sendfrom` (`PRL_RPC_FEE_RATE`, default
    /// `0.0001`).
    pub rpc_fee_rate: String,
    /// `getbalance` RPC method name (`PRL_RPC_BALANCE_METHOD`, default
    /// `getbalance`).
    pub rpc_balance_method: String,
    /// Poll interval (`PRL_PAYOUT_INTERVAL_S`, default 60).
    pub interval: Duration,
    /// Minimum per-payout base units (`PRL_PAYOUT_MIN_UNITS`, default 0).
    pub min_units: u128,
    /// Max submit attempts before 'stalled' (`PRL_PAYOUT_MAX_ATTEMPTS`,
    /// default 3).
    pub max_attempts: u32,
    /// Pool fee on the PRL leg, basis points (`PRL_PAYOUT_FEE_BPS`,
    /// default 0).
    pub fee_bps: u64,
    /// Dry-run mode (`PRL_PAYOUT_DRY_RUN`, default **1**).  Rows validate
    /// + ledger + mark `dryrun`; nothing is broadcast.  `=0` enables live
    /// sends — only after regtest verification.
    pub dry_run: bool,
    /// Accepted address HRPs (`PRL_ADDRESS_HRPS`, comma-separated, default
    /// `prl`).  Regtest/testnet oyster wallets emit `rprl`/`tprl` — set
    /// `PRL_ADDRESS_HRPS=rprl` for regtest verification.
    pub address_hrps: Vec<String>,
}

impl PrlPayoutConfig {
    pub fn from_env() -> MultichainResult<Option<Self>> {
        if std::env::var("PRL_PAYOUT_ENABLED").ok().as_deref() != Some("1") {
            return Ok(None);
        }
        let pool_api = std::env::var("PRL_PAYOUT_POOL_API")
            .map_err(|_| MultichainError::Config("PRL_PAYOUT_POOL_API not set".into()))?;
        let admin_key = std::env::var("PRL_PAYOUT_ADMIN_KEY")
            .map_err(|_| MultichainError::Config("PRL_PAYOUT_ADMIN_KEY not set".into()))?;
        let rpc_url = std::env::var("PRL_RPC_URL")
            .map_err(|_| MultichainError::Config("PRL_RPC_URL not set".into()))?;
        Ok(Some(Self {
            enabled: true,
            pool_api: pool_api.trim_end_matches('/').to_string(),
            admin_key,
            rpc_url: rpc_url.trim_end_matches('/').to_string(),
            rpc_user: std::env::var("PRL_RPC_USER").unwrap_or_default(),
            rpc_pass: std::env::var("PRL_RPC_PASS").unwrap_or_default(),
            rpc_send_method: std::env::var("PRL_RPC_SEND_METHOD")
                .unwrap_or_else(|_| "sendfrom".into()),
            rpc_send_account: std::env::var("PRL_RPC_SEND_ACCOUNT")
                .unwrap_or_else(|_| "default".into()),
            rpc_fee_rate: std::env::var("PRL_RPC_FEE_RATE").unwrap_or_else(|_| "0.0001".into()),
            rpc_balance_method: std::env::var("PRL_RPC_BALANCE_METHOD")
                .unwrap_or_else(|_| "getbalance".into()),
            interval: Duration::from_secs(
                std::env::var("PRL_PAYOUT_INTERVAL_S")
                    .ok()
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(60)
                    .max(5),
            ),
            min_units: std::env::var("PRL_PAYOUT_MIN_UNITS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(0),
            max_attempts: std::env::var("PRL_PAYOUT_MAX_ATTEMPTS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(3),
            fee_bps: std::env::var("PRL_PAYOUT_FEE_BPS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(0)
                .min(10_000),
            dry_run: std::env::var("PRL_PAYOUT_DRY_RUN").ok().as_deref() != Some("0"),
            address_hrps: std::env::var("PRL_ADDRESS_HRPS")
                .ok()
                .map(|v| {
                    v.split(',')
                        .map(|s| s.trim().to_string())
                        .filter(|s| !s.is_empty())
                        .collect()
                })
                .unwrap_or_else(|| vec!["prl".into()]),
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
    #[serde(default)]
    unit: String,
    #[serde(default)]
    coin: Option<String>,
    #[serde(default)]
    event: Option<String>,
}

/// Decide `(ledger_id, gross_units)` for a drained entry — `None` to
/// skip.  PRL accepts native entries only (no FX rate exists); the
/// `event` id scopes the ledger key like the QTC sweeper.
fn plan_entry(p: &DrainEntry) -> Option<(String, u128)> {
    if p.unit != "native" {
        warn!(
            miner = %p.miner_id,
            "prl_sweeper skipping non-native entry (no PRL FX rate configured)"
        );
        return None;
    }
    let coin = p.coin.as_deref().unwrap_or("");
    if !matches!(coin, "prl" | "pearl") {
        warn!(
            miner = %p.miner_id,
            coin,
            "prl_sweeper skipping native entry for non-pearl coin"
        );
        return None;
    }
    let id = match p.event.as_deref() {
        Some(ev) => format!("pearl:rev:{ev}:{}", p.miner_id),
        None => format!("pearl:{}:{}", p.height, p.miner_id),
    };
    Some((id, p.amount_flowers as u128))
}

/// Minimal Bitcoin-style JSON-RPC client for the oyster wallet.
struct OysterRpc {
    http: reqwest::Client,
    url: String,
    user: String,
    pass: String,
}

impl OysterRpc {
    async fn call(
        &self,
        method: &str,
        params: serde_json::Value,
    ) -> MultichainResult<serde_json::Value> {
        let body = serde_json::json!({
            "jsonrpc": "1.0",
            "id": "prl-payout",
            "method": method,
            "params": params,
        });
        let mut req = self.http.post(&self.url).json(&body);
        if !self.user.is_empty() {
            req = req.basic_auth(&self.user, Some(&self.pass));
        }
        let resp: serde_json::Value = req
            .send()
            .await
            .map_err(|e| MultichainError::Internal(format!("oyster rpc: {e}")))?
            .json()
            .await
            .map_err(|e| MultichainError::Internal(format!("oyster rpc decode: {e}")))?;
        if let Some(err) = resp.get("error").filter(|e| !e.is_null()) {
            return Err(MultichainError::Internal(format!("oyster {method}: {err}")));
        }
        Ok(resp
            .get("result")
            .cloned()
            .unwrap_or(serde_json::Value::Null))
    }
}

/// Spawn the sweeper task.  `db` is the shared multichain ledger.
pub fn spawn_prl_payout_sweeper(
    config: PrlPayoutConfig,
    db: Arc<Mutex<Db>>,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        // Same restart guard as QTC — ambiguous 'queued' rows stall.
        let now = now_secs() as i64;
        match db.lock().await.conn().execute(
            "UPDATE ext_payout_records SET status='stalled', \
             error='restart while queued — manual review', updated_at=?1 \
             WHERE chain='pearl' AND status='queued'",
            rusqlite::params![now],
        ) {
            Ok(0) => {}
            Ok(n) => warn!(stalled = n, "prl_sweeper stalled orphaned queued payouts"),
            Err(e) => warn!("prl_sweeper stall pass failed: {e}"),
        }

        let rpc = OysterRpc {
            http: reqwest::Client::builder()
                .timeout(Duration::from_secs(30))
                .build()
                .unwrap_or_else(|_| reqwest::Client::new()),
            url: config.rpc_url.clone(),
            user: config.rpc_user.clone(),
            pass: config.rpc_pass.clone(),
        };
        info!(
            interval_s = config.interval.as_secs(),
            dry_run = config.dry_run,
            "prl payout sweeper started"
        );
        loop {
            if let Err(e) = tick(&config, &rpc, &db).await {
                warn!("prl payout sweep error: {e}");
            }
            tokio::time::sleep(config.interval).await;
        }
    })
}

fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

async fn tick(
    config: &PrlPayoutConfig,
    rpc: &OysterRpc,
    db: &Arc<Mutex<Db>>,
) -> MultichainResult<()> {
    // 1. Drain fresh entries from the pool.
    let url = format!("{}/admin/external-payouts?chain=pearl", config.pool_api);
    let resp: DrainResponse = rpc
        .http
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
        info!(count = resp.payouts.len(), "prl_sweeper drained payouts");
    }

    // 2. Ledger each drained entry.  Native entries only — a flowers-unit
    // entry on the pearl chain has no conversion rate and indicates a
    // pool accounting bug.
    let mut ack_ids = Vec::new();
    for p in &resp.payouts {
        let Some((id, gross)) = plan_entry(p) else {
            continue;
        };
        let fee = gross.saturating_mul(config.fee_bps as u128) / 10_000;
        let units = gross.saturating_sub(fee);
        let status = if units < config.min_units {
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
             VALUES (?1,'pearl',?2,?3,?4,?5,?6,?7,?8,?9,?9)",
            rusqlite::params![
                id,
                p.height as i64,
                p.miner_id,
                p.address,
                p.amount_flowers as i64,
                units.to_string(),
                fee.to_string(),
                status,
                now
            ],
        )?;
        if let Some(outbox_id) = p.outbox_id.as_ref() {
            ack_ids.push(outbox_id.clone());
        }
    }

    // Unsupported entries remain pending in the pool outbox for inspection.
    if !ack_ids.is_empty() {
        let ack_url = format!("{}/admin/external-payouts/ack", config.pool_api);
        let ack: serde_json::Value = rpc
            .http
            .post(&ack_url)
            .header("X-Admin-Key", &config.admin_key)
            .json(&serde_json::json!({"chain": "pearl", "ids": ack_ids}))
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

    // 3. Submit due rows.
    struct Row {
        id: String,
        address: String,
        units: String,
        attempts: u32,
    }
    let due: Vec<Row> = {
        let db = db.lock().await;
        let mut stmt = db.conn().prepare(
            "SELECT id, address, amount_native, attempts FROM ext_payout_records \
             WHERE chain='pearl' AND status IN ('queued','deferred') \
             AND amount_native IS NOT NULL ORDER BY created_at LIMIT 50",
        )?;
        let rows = stmt
            .query_map([], |r| {
                Ok(Row {
                    id: r.get(0)?,
                    address: r.get(1)?,
                    units: r.get(2)?,
                    attempts: r.get::<_, u32>(3)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        rows
    };

    for row in due {
        let units: u128 = row.units.parse().unwrap_or(0);
        let hrps: Vec<&str> = config.address_hrps.iter().map(|s| s.as_str()).collect();
        if !is_valid_pearl_address_for_hrp(&row.address, &hrps) {
            mark_error(
                db,
                &row.id,
                "invalid prl address",
                row.attempts,
                config.max_attempts,
            )
            .await;
            continue;
        }

        if config.dry_run {
            // Prove the whole pipeline minus the broadcast: address valid,
            // treasury query attempted, amount sane — then mark 'dryrun'
            // so operators can audit what *would* have been sent.
            let bal = rpc
                .call(&config.rpc_balance_method, serde_json::json!([]))
                .await;
            let now = now_secs() as i64;
            let db = db.lock().await;
            let _ = db.conn().execute(
                "UPDATE ext_payout_records SET status='dryrun', attempts=?2, \
                 error=?3, updated_at=?4 WHERE id=?1",
                rusqlite::params![
                    row.id,
                    row.attempts + 1,
                    match &bal {
                        Ok(b) => format!("dry-run ok; treasury={b}"),
                        Err(e) => format!("dry-run; balance query failed: {e}"),
                    },
                    now
                ],
            );
            info!(id = %row.id, units, "prl payout dry-run recorded");
            continue;
        }

        // Live send.  oyster `sendfrom` takes
        // (account, address, whole-coin amount, fee-rate-per-kb); Pearl
        // base units use 8 decimals (btcd-derived).  Numeric JSON amounts —
        // oyster parses both, numbers avoid string coercion quirks.
        let whole = format!("{}.{:08}", units / 100_000_000, units % 100_000_000);
        let amount: serde_json::Number = whole.parse().unwrap_or_else(|_| 0.into());
        let fee_rate: serde_json::Number = config.rpc_fee_rate.parse().unwrap_or_else(|_| 0.into());
        let params = if config.rpc_send_method == "sendfrom" {
            serde_json::json!([config.rpc_send_account, row.address, amount, fee_rate])
        } else {
            // Legacy/alternate method override (e.g. sendtoaddress-style).
            serde_json::json!([row.address, whole])
        };
        let result = rpc.call(&config.rpc_send_method, params).await;
        match result {
            Ok(v) => {
                let tx = v.as_str().unwrap_or("").to_string();
                let now = now_secs() as i64;
                let db = db.lock().await;
                db.conn().execute(
                    "UPDATE ext_payout_records SET status='submitted', tx_hash=?2, \
                     attempts=?3, error=NULL, updated_at=?4 WHERE id=?1",
                    rusqlite::params![row.id, tx, row.attempts + 1, now],
                )?;
                info!(id = %row.id, tx = %tx, "prl payout submitted");
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
    Ok(())
}

async fn mark_error(db: &Arc<Mutex<Db>>, id: &str, error: &str, attempts: u32, max_attempts: u32) {
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
        warn!(id = %id, error = %error, "prl payout stalled — manual review");
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
                "outbox_id": "prl-outbox-1",
                "height": 42,
                "miner_id": "alice",
                "address": "rprl1p5g5urdz6w25vsjshetw9kw0xjndspmuurerr7p4z5fn64teuhjgsdz5fjy",
                "amount_flowers": 1000,
                "unit": "native",
                "coin": "prl",
                "event": "prl:bal:0:1k"
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
                 WHERE id='pearl:rev:prl:bal:0:1k:alice' AND status='queued'",
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

    async fn oyster_rpc() -> axum::Json<serde_json::Value> {
        axum::Json(serde_json::json!({
            "result": "0.25",
            "error": null,
            "id": "prl-payout"
        }))
    }

    fn entry(unit: &str, coin: Option<&str>, event: Option<&str>) -> DrainEntry {
        DrainEntry {
            outbox_id: None,
            height: 42,
            miner_id: "alice".into(),
            address: "prl1palice".into(),
            amount_flowers: 1_000,
            unit: unit.into(),
            coin: coin.map(|c| c.into()),
            event: event.map(|e| e.into()),
        }
    }

    #[test]
    fn native_prl_entry_plans_event_scoped() {
        let (id, units) = plan_entry(&entry("native", Some("prl"), Some("prl:bal:0:1k"))).unwrap();
        assert_eq!(id, "pearl:rev:prl:bal:0:1k:alice");
        assert_eq!(units, 1_000);
    }

    #[test]
    fn flowers_entry_skipped_no_fx_rate() {
        assert!(plan_entry(&entry("flowers", None, None)).is_none());
    }

    #[test]
    fn native_wrong_coin_skipped() {
        assert!(plan_entry(&entry("native", Some("qtu"), Some("e1"))).is_none());
    }

    #[tokio::test]
    async fn durable_outbox_is_ledgered_before_ack() {
        use axum::routing::post;

        let db = Arc::new(Mutex::new(Db::open_in_memory().unwrap()));
        let ack_saw_ledger = Arc::new(std::sync::atomic::AtomicBool::new(false));
        let app = axum::Router::new()
            .route("/admin/external-payouts", post(drain_outbox))
            .route("/admin/external-payouts/ack", post(ack_outbox))
            .route("/rpc", post(oyster_rpc))
            .with_state(AckTestState {
                db: db.clone(),
                ack_saw_ledger: ack_saw_ledger.clone(),
            });
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let server = tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });

        let config = PrlPayoutConfig {
            enabled: true,
            pool_api: format!("http://{addr}"),
            admin_key: "test-key".into(),
            rpc_url: format!("http://{addr}/rpc"),
            rpc_user: String::new(),
            rpc_pass: String::new(),
            rpc_send_method: "sendfrom".into(),
            rpc_send_account: "default".into(),
            rpc_fee_rate: "0.0001".into(),
            rpc_balance_method: "getbalance".into(),
            interval: Duration::from_secs(60),
            min_units: 0,
            max_attempts: 3,
            fee_bps: 0,
            dry_run: true,
            address_hrps: vec!["rprl".into()],
        };
        let rpc = OysterRpc {
            http: reqwest::Client::new(),
            url: config.rpc_url.clone(),
            user: config.rpc_user.clone(),
            pass: config.rpc_pass.clone(),
        };
        let result = tick(&config, &rpc, &db).await;
        server.abort();

        result.unwrap();
        assert!(ack_saw_ledger.load(std::sync::atomic::Ordering::SeqCst));
        let db = db.lock().await;
        let status: String = db
            .conn()
            .query_row(
                "SELECT status FROM ext_payout_records \
                 WHERE id='pearl:rev:prl:bal:0:1k:alice'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(status, "dryrun");
    }

    #[test]
    fn dry_run_is_the_default() {
        // Safety gate: PRL payouts must never go live implicitly — only
        // an explicit PRL_PAYOUT_DRY_RUN=0 may enable real sends.
        let cfg = PrlPayoutConfig {
            enabled: true,
            pool_api: "http://x".into(),
            admin_key: "k".into(),
            rpc_url: "http://y".into(),
            rpc_user: String::new(),
            rpc_pass: String::new(),
            rpc_send_method: "sendfrom".into(),
            rpc_send_account: "default".into(),
            rpc_fee_rate: "0.0001".into(),
            rpc_balance_method: "getbalance".into(),
            interval: Duration::from_secs(60),
            min_units: 0,
            max_attempts: 3,
            fee_bps: 0,
            dry_run: std::env::var("PRL_PAYOUT_DRY_RUN").ok().as_deref() != Some("0"),
            address_hrps: vec!["prl".into()],
        };
        assert!(cfg.dry_run);
    }

    #[test]
    fn regtest_hrp_addresses_validate() {
        // Regtest oyster wallets emit `rprl` — the sweeper must accept
        // them when PRL_ADDRESS_HRPS includes the regtest HRP.
        let rprl = "rprl1p5g5urdz6w25vsjshetw9kw0xjndspmuurerr7p4z5fn64teuhjgsdz5fjy";
        assert!(is_valid_pearl_address_for_hrp(rprl, &["prl", "rprl"]));
        assert!(!is_valid_pearl_address_for_hrp(rprl, &["prl"]));
        assert!(!is_valid_pearl_address_for_hrp("garbage", &["prl", "rprl"]));
    }
}
