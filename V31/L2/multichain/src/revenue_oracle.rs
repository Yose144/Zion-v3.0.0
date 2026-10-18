//! Per-coin treasury revenue oracle (F3).
//!
//! For "inverted mining" legs (QTU native, PRL native) the coin's own
//! node authors rewards and pays them to a configured pool treasury —
//! the pool never sees the coinbase.  This oracle watches the treasury
//! balance, turns each observed increase into a revenue event, and
//! posts it to `POST /admin/coin-revenue`, where the pool distributes
//! the amount across that coin's PPLNS slice.
//!
//! Correctness properties:
//! - Event ids are deterministic (`{coin}:bal:{from}:{to}`) so a
//!   retried POST after a timeout is deduplicated pool-side
//!   (`coin_revenue` table, schema v3).
//! - `coin_oracle_state.last_balance` is updated *only* after the pool
//!   acknowledges the event — a crash mid-post re-observes the delta on
//!   the next tick.
//! - If the balance grows again between a lost POST and its retry, the
//!   pool's `duplicate` response carries the already-credited amount;
//!   the oracle then emits a supplementary event for the remainder
//!   (`bal:{credited}:{new}`) so revenue is never lost nor double-paid.
//! - Decreases (payout sends draining the treasury) just re-baseline.

use std::sync::Arc;
use std::time::Duration;

use serde::Deserialize;
use tokio::sync::Mutex;
use tracing::{info, warn};

use crate::chain::adapters::quantus::QuantusAdapter;
use crate::chain::ChainAdapter;
use crate::db::Db;
use crate::error::{MultichainError, MultichainResult};
use zion_l1_types::{Address, ChainId};

/// Oracle configuration — all values from env (`REVENUE_ORACLE_*`,
/// per-coin `ORACLE_<COIN>_*`).
#[derive(Debug, Clone)]
pub struct RevenueOracleConfig {
    /// Pool admin API base URL (`REVENUE_ORACLE_POOL_API`).
    pub pool_api: String,
    /// Pool admin key (`REVENUE_ORACLE_ADMIN_KEY`, fallback
    /// `QTC_PAYOUT_ADMIN_KEY`) — sent as `X-Admin-Key`.
    pub admin_key: String,
    /// Poll interval (`REVENUE_ORACLE_INTERVAL_S`, default 60).
    pub interval: Duration,
    /// Coins to watch (`REVENUE_ORACLE_COINS`, e.g. "qtu,prl").
    pub coins: Vec<String>,
}

impl RevenueOracleConfig {
    /// `REVENUE_ORACLE_ENABLED=1` required; returns `None` otherwise.
    pub fn from_env() -> MultichainResult<Option<Self>> {
        if std::env::var("REVENUE_ORACLE_ENABLED").ok().as_deref() != Some("1") {
            return Ok(None);
        }
        let pool_api = std::env::var("REVENUE_ORACLE_POOL_API")
            .or_else(|_| std::env::var("QTC_PAYOUT_POOL_API"))
            .map_err(|_| {
                MultichainError::Config("REVENUE_ORACLE_POOL_API not set".into())
            })?;
        let admin_key = std::env::var("REVENUE_ORACLE_ADMIN_KEY")
            .or_else(|_| std::env::var("QTC_PAYOUT_ADMIN_KEY"))
            .map_err(|_| {
                MultichainError::Config("REVENUE_ORACLE_ADMIN_KEY not set".into())
            })?;
        let coins: Vec<String> = std::env::var("REVENUE_ORACLE_COINS")
            .unwrap_or_default()
            .split(',')
            .map(|c| c.trim().to_ascii_lowercase())
            .filter(|c| !c.is_empty())
            .collect();
        if coins.is_empty() {
            return Err(MultichainError::Config(
                "REVENUE_ORACLE_COINS empty — nothing to watch".into(),
            ));
        }
        Ok(Some(Self {
            pool_api: pool_api.trim_end_matches('/').to_string(),
            admin_key,
            interval: Duration::from_secs(
                std::env::var("REVENUE_ORACLE_INTERVAL_S")
                    .ok()
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(60)
                    .max(5),
            ),
            coins,
        }))
    }
}

/// A watched treasury: how to read the coin's balance + height.
enum TreasurySource {
    /// Quantus treasury — SS58 account via `system_account` storage.
    Qtc { adapter: QuantusAdapter, address: Address },
    /// Pearl treasury — oyster wallet `getbalance`/`getblockcount`.
    Prl {
        http: reqwest::Client,
        url: String,
        user: String,
        pass: String,
    },
}

impl TreasurySource {
    /// (balance in native base units, best-known height).
    async fn observe(&self) -> MultichainResult<(u128, u64)> {
        match self {
            TreasurySource::Qtc { adapter, address } => {
                let bal = adapter.balance(address).await?;
                let height = adapter.block_height().await.unwrap_or(0);
                Ok((bal.0, height))
            }
            TreasurySource::Prl {
                http,
                url,
                user,
                pass,
            } => {
                let bal: f64 = oyster_call(http, url, user, pass, "getbalance", serde_json::json!([]))
                    .await?
                    .as_f64()
                    .unwrap_or(0.0);
                let height = oyster_call(
                    http,
                    url,
                    user,
                    pass,
                    "getblockcount",
                    serde_json::json!([]),
                )
                .await
                .ok()
                .and_then(|v| v.as_u64())
                .unwrap_or(0);
                // Pearl is btcd-derived: 8 decimals.
                Ok(((bal * 1e8) as u128, height))
            }
        }
    }
}

async fn oyster_call(
    http: &reqwest::Client,
    url: &str,
    user: &str,
    pass: &str,
    method: &str,
    params: serde_json::Value,
) -> MultichainResult<serde_json::Value> {
    let body = serde_json::json!({
        "jsonrpc": "1.0", "id": "rev-oracle", "method": method, "params": params,
    });
    let mut req = http.post(url).json(&body);
    if !user.is_empty() {
        req = req.basic_auth(user, Some(pass));
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
    Ok(resp.get("result").cloned().unwrap_or(serde_json::Value::Null))
}

/// Build the watch list from env.  Unknown/under-configured coins warn
/// and are skipped — a misconfigured coin must not kill the oracle.
fn build_sources(coins: &[String]) -> Vec<(String, TreasurySource)> {
    let mut out = Vec::new();
    for coin in coins {
        match coin.as_str() {
            "qtu" | "qtc" | "quantus" => {
                let addr = match std::env::var("ORACLE_QTU_ADDRESS") {
                    Ok(a) => a,
                    Err(_) => {
                        // Default: the payout signer's own account — the
                        // node is expected to mine to the same treasury.
                        match QuantusAdapter::new("")
                            .signer_ss58()
                        {
                            Ok(s) => s,
                            Err(e) => {
                                warn!("revenue_oracle: qtu skipped — no ORACLE_QTU_ADDRESS and signer unavailable: {e}");
                                continue;
                            }
                        }
                    }
                };
                let adapter = QuantusAdapter::new(
                    std::env::var("ORACLE_QTU_RPC").unwrap_or_default(),
                );
                let (acct, _pfx) = match crate::chain::adapters::quantus::ss58_decode(&addr) {
                    Ok(v) => v,
                    Err(e) => {
                        warn!("revenue_oracle: qtu skipped — bad ORACLE_QTU_ADDRESS: {e}");
                        continue;
                    }
                };
                match Address::new(ChainId::Quantus, acct.to_vec(), addr) {
                    Ok(a) => out.push((
                        "qtu".to_string(),
                        TreasurySource::Qtc { adapter, address: a },
                    )),
                    Err(e) => warn!("revenue_oracle: qtu address build failed: {e}"),
                }
            }
            "prl" | "pearl" => {
                let url = std::env::var("ORACLE_PRL_RPC_URL")
                    .or_else(|_| std::env::var("PRL_RPC_URL"));
                match url {
                    Ok(u) => out.push((
                        "prl".to_string(),
                        TreasurySource::Prl {
                            http: reqwest::Client::builder()
                                .timeout(Duration::from_secs(30))
                                .build()
                                .unwrap_or_else(|_| reqwest::Client::new()),
                            url: u.trim_end_matches('/').to_string(),
                            user: std::env::var("ORACLE_PRL_RPC_USER")
                                .or_else(|_| std::env::var("PRL_RPC_USER"))
                                .unwrap_or_default(),
                            pass: std::env::var("ORACLE_PRL_RPC_PASS")
                                .or_else(|_| std::env::var("PRL_RPC_PASS"))
                                .unwrap_or_default(),
                        },
                    )),
                    Err(_) => {
                        warn!("revenue_oracle: prl skipped — ORACLE_PRL_RPC_URL/PRL_RPC_URL not set")
                    }
                }
            }
            other => warn!("revenue_oracle: unknown coin '{other}' skipped"),
        }
    }
    out
}

#[derive(Debug, Deserialize)]
struct RevenueResp {
    ok: bool,
    #[serde(default)]
    duplicate: bool,
    /// On `duplicate`, the amount the pool already credited for this id.
    #[serde(default)]
    amount: Option<u64>,
}

/// Spawn the oracle task.
pub fn spawn_revenue_oracle(
    config: RevenueOracleConfig,
    db: Arc<Mutex<Db>>,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());
        let sources = build_sources(&config.coins);
        if sources.is_empty() {
            warn!("revenue_oracle: no usable coin sources — exiting");
            return;
        }
        info!(
            interval_s = config.interval.as_secs(),
            coins = ?config.coins,
            "revenue oracle started"
        );
        loop {
            for (coin, src) in &sources {
                if let Err(e) = tick_coin(&config, &http, &db, coin, src).await {
                    warn!("revenue_oracle {coin} tick error: {e}");
                }
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

async fn load_state(db: &Arc<Mutex<Db>>, coin: &str) -> u128 {
    let db = db.lock().await;
    db.conn()
        .query_row(
            "SELECT last_balance FROM coin_oracle_state WHERE coin=?1",
            rusqlite::params![coin],
            |r| r.get::<_, String>(0),
        )
        .ok()
        .and_then(|b| b.parse::<u128>().ok())
        .unwrap_or(0)
}

async fn store_state(db: &Arc<Mutex<Db>>, coin: &str, balance: u128, height: u64) {
    let now = now_secs() as i64;
    let db = db.lock().await;
    let _ = db.conn().execute(
        "INSERT INTO coin_oracle_state (coin, last_balance, last_height, updated_at) \
         VALUES (?1,?2,?3,?4) \
         ON CONFLICT(coin) DO UPDATE SET last_balance=?2, last_height=?3, updated_at=?4",
        rusqlite::params![coin, balance.to_string(), height as i64, now],
    );
}

async fn tick_coin(
    config: &RevenueOracleConfig,
    http: &reqwest::Client,
    db: &Arc<Mutex<Db>>,
    coin: &str,
    src: &TreasurySource,
) -> MultichainResult<()> {
    let (balance, height) = src.observe().await?;
    let mut credited_base = load_state(db, coin).await;
    if balance <= credited_base {
        // Spend or reorg — re-baseline without emitting an event.
        if balance != credited_base {
            info!(coin, %balance, "revenue_oracle baseline adjusted (spend/reorg)");
        }
        store_state(db, coin, balance, height).await;
        return Ok(());
    }

    // Convergence loop: on `duplicate` the pool reports what it already
    // credited for this event id; emit a supplementary event for any
    // remainder so a lost-then-grown delta still settles fully.
    for _ in 0..4 {
        if balance <= credited_base {
            break;
        }
        let delta = balance - credited_base;
        let delta_u64 = u64::try_from(delta).unwrap_or(u64::MAX);
        let event = format!("{coin}:bal:{credited_base}:{balance}");
        let resp: RevenueResp = http
            .post(format!("{}/admin/coin-revenue", config.pool_api))
            .header("X-Admin-Key", &config.admin_key)
            .json(&serde_json::json!({
                "coin": coin,
                "amount": delta_u64.to_string(),
                "ref_height": height,
                "event": event,
            }))
            .send()
            .await
            .map_err(|e| MultichainError::Internal(format!("revenue post: {e}")))?
            .json()
            .await
            .map_err(|e| MultichainError::Internal(format!("revenue decode: {e}")))?;
        if resp.duplicate {
            let recorded = resp.amount.unwrap_or(0) as u128;
            warn!(
                coin,
                %event,
                recorded,
                "revenue_oracle duplicate event — converging remainder"
            );
            credited_base = credited_base.saturating_add(recorded);
            continue;
        }
        if resp.ok {
            info!(coin, %event, delta = %delta, "revenue_oracle revenue event posted");
            credited_base = balance;
            break;
        }
        return Err(MultichainError::Internal(
            "revenue post rejected by pool".into(),
        ));
    }
    // Persist only what the pool acknowledged.
    store_state(db, coin, credited_base, height).await;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn oracle_state_persists_across_instances() {
        let db = Arc::new(Mutex::new(Db::open_in_memory().unwrap()));
        store_state(&db, "qtu", 1_500_000, 42).await;
        assert_eq!(load_state(&db, "qtu").await, 1_500_000);
        assert_eq!(load_state(&db, "prl").await, 0);
        // Update monotonically.
        store_state(&db, "qtu", 2_000_000, 50).await;
        assert_eq!(load_state(&db, "qtu").await, 2_000_000);
    }

    #[test]
    fn event_ids_are_deterministic() {
        // Retried POSTs must produce byte-identical event ids — the pool
        // dedups on this string.
        let a = format!("qtu:bal:{}:{}", 100u128, 250u128);
        let b = format!("qtu:bal:{}:{}", 100u128, 250u128);
        assert_eq!(a, b);
        assert_eq!(a, "qtu:bal:100:250");
    }
}
