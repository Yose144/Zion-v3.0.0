//! WARP Beta — ZION↔BTC atomic swap orchestrator.
//!
//! Two directions, both driven by this flow (the operator side of the swap):
//!
//! **BTC→ZION** — the user deposits BTC into a per-swap P2WSH HTLC
//! (claimant = our BTC key, refund = user's key, CLTV expires *later* than
//! the ZION leg). Once the funding tx reaches `min_btc_confs`, we lock ZION
//! via `HtlcSwap::initiate`. The user claims ZION through the existing
//! `/v1/multichain/swaps/htlc/claim` API, which reveals the preimage; we then
//! claim the BTC lock with `BtcSigner::claim_htlc`.
//!
//! **ZION→BTC** — the user locks ZION (claimant = our ZION key). After the
//! user lock is attached, we lock BTC (claimant = user's BTC key, CLTV
//! expires *earlier* than the ZION leg). The user claims BTC, revealing the
//! preimage in the spend witness; `detect_htlc_spend` extracts it and we
//! claim the user's ZION lock via `HtlcSwap::claim_source`.
//!
//! The pure transition table lives in [`decide`] so it can be unit-tested
//! without network access; [`BtcSwapFlow::poll_once`] gathers observations
//! and executes the resulting actions.

use crate::error::MultichainError;
use crate::swap::htlc::{HtlcSwap, SwapState};
use crate::types::{Transfer, TransferDirection, TransferEndpoint};
use crate::warp::adapter::bitcoin::{BitcoinAdapter, BtcHtlcLock, BtcHtlcSpend};
use crate::warp::adapter::ChainAdapter;
use crate::warp::btc_htlc::{
    cltv_before_zion_timeout, cltv_from_zion_timeout, BtcHtlc, HtlcUtxo, DEFAULT_MARGIN_BLOCKS,
};
use crate::warp::btc_signer::BtcSigner;
use crate::warp::error::{WarpError, WarpResult};

use bitcoin::{Address as BtcAddress, Network, OutPoint, PublicKey, Txid};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::str::FromStr;
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{info, warn};
use zion_l1_types::{Address, Amount, Asset, ChainId, Hash};

fn err(reason: impl Into<String>) -> WarpError {
    WarpError::AdapterError {
        chain: "bitcoin".into(),
        reason: reason.into(),
    }
}

fn mc_err(e: MultichainError) -> WarpError {
    WarpError::AdapterError {
        chain: "zion-l1".into(),
        reason: e.to_string(),
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BtcSwapDirection {
    /// User deposits BTC, receives ZION.
    BtcToZion,
    /// User deposits ZION, receives BTC.
    ZionToBtc,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BtcSwapPhase {
    /// Offer registered; waiting for the user's lock on their chain.
    AwaitingUserLock,
    /// Both legs locked; waiting for the user to claim our lock.
    Locked,
    /// Terminal: both legs settled.
    Settled,
    /// Terminal: locks refunded.
    Refunded,
    /// Terminal: unrecoverable failure (manual review needed).
    Failed(String),
}

impl BtcSwapPhase {
    pub fn is_terminal(&self) -> bool {
        matches!(
            self,
            Self::Settled | Self::Refunded | Self::Failed(_)
        )
    }
}

/// Parameters of a BTC→ZION offer (user locks BTC first).
#[derive(Debug, Clone)]
pub struct OfferBtcToZion {
    /// SHA-256 hashlock chosen by the user (`SHA-256(preimage)`).
    pub hashlock: [u8; 32],
    pub btc_sats: u64,
    pub zion_flowers: u64,
    /// User's BTC refund pubkey (gets BTC back after CLTV).
    pub user_btc_refund: PublicKey,
    /// User's ZION Ed25519 pubkey (claims our ZION HTLC).
    pub user_zion_claim: [u8; 32],
    /// User's ZION payout address.
    pub user_zion_address: String,
    /// Agreed ZION-leg timeout (UNIX secs) — must sit comfortably before the
    /// derived BTC CLTV (the BTC leg always expires later).
    pub zion_timeout_ts: u64,
}

/// Parameters of a ZION→BTC offer (user locks ZION first).
#[derive(Debug, Clone)]
pub struct OfferZionToBtc {
    pub hashlock: [u8; 32],
    pub zion_flowers: u64,
    pub btc_sats: u64,
    /// User's BTC pubkey (claims our BTC HTLC).
    pub user_btc_claim: PublicKey,
    /// User's ZION Ed25519 pubkey (refund on their ZION lock).
    pub user_zion_refund: [u8; 32],
    /// User's ZION lock transaction id (they locked before offering).
    pub user_zion_lock_txid: String,
    /// User's ZION refund address.
    pub user_zion_address: String,
    /// Timeout of the user's ZION lock (UNIX secs) — our BTC CLTV is placed
    /// strictly before it minus the safety margin.
    pub zion_timeout_ts: u64,
}

/// A tracked swap.
#[derive(Debug, Clone)]
pub struct BtcSwapRecord {
    /// Hashlock hex — also the swap id.
    pub swap_id: String,
    pub direction: BtcSwapDirection,
    pub phase: BtcSwapPhase,
    pub btc_htlc: BtcHtlc,
    pub btc_sats: u64,
    pub zion_flowers: u64,
    pub zion_timeout_ts: u64,
    /// User's ZION pubkey (claim key for BtcToZion, refund key for ZionToBtc).
    pub user_zion_pubkey: [u8; 32],
    pub user_zion_address: String,
    /// User's ZION lock txid (ZionToBtc only).
    pub user_zion_lock_txid: Option<String>,
    /// Best-known funding output on the HTLC address.
    pub btc_lock: Option<BtcHtlcLock>,
    /// Our ZION lock txid (BtcToZion), once broadcast.
    pub zion_lock_tx: Option<String>,
    /// Revealed preimage, once known.
    pub preimage: Option<[u8; 32]>,
    /// Our settlement txid on the BTC leg (claim or refund).
    pub btc_settle_tx: Option<String>,
    pub created_at: chrono::DateTime<Utc>,
    pub updated_at: chrono::DateTime<Utc>,
}

/// Serializable snapshot of a [`BtcSwapRecord`] for SQLite persistence.
/// The `BtcHtlc` is represented by its canonical witness script hex and is
/// rebuilt via `BtcHtlc::from_witness_script` on load (round-trip validated).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BtcSwapSnapshot {
    pub swap_id: String,
    pub direction: BtcSwapDirection,
    pub phase: BtcSwapPhase,
    pub witness_script_hex: String,
    pub btc_network: String,
    pub btc_sats: u64,
    pub zion_flowers: u64,
    pub zion_timeout_ts: u64,
    pub user_zion_pubkey_hex: String,
    pub user_zion_address: String,
    pub user_zion_lock_txid: Option<String>,
    pub btc_lock: Option<BtcHtlcLock>,
    pub zion_lock_tx: Option<String>,
    pub preimage_hex: Option<String>,
    pub btc_settle_tx: Option<String>,
    pub created_at: chrono::DateTime<Utc>,
    pub updated_at: chrono::DateTime<Utc>,
}

impl BtcSwapSnapshot {
    /// Phase label for the DB index column.
    pub fn phase_tag(&self) -> String {
        match &self.phase {
            BtcSwapPhase::AwaitingUserLock => "awaiting_user_lock".into(),
            BtcSwapPhase::Locked => "locked".into(),
            BtcSwapPhase::Settled => "settled".into(),
            BtcSwapPhase::Refunded => "refunded".into(),
            BtcSwapPhase::Failed(_) => "failed".into(),
        }
    }
}

impl BtcSwapRecord {
    /// Snapshot for persistence.
    pub fn to_snapshot(&self) -> BtcSwapSnapshot {
        BtcSwapSnapshot {
            swap_id: self.swap_id.clone(),
            direction: self.direction,
            phase: self.phase.clone(),
            witness_script_hex: hex::encode(self.btc_htlc.witness_script.as_bytes()),
            btc_network: self.btc_htlc.address.network().to_string(),
            btc_sats: self.btc_sats,
            zion_flowers: self.zion_flowers,
            zion_timeout_ts: self.zion_timeout_ts,
            user_zion_pubkey_hex: hex::encode(self.user_zion_pubkey),
            user_zion_address: self.user_zion_address.clone(),
            user_zion_lock_txid: self.user_zion_lock_txid.clone(),
            btc_lock: self.btc_lock.clone(),
            zion_lock_tx: self.zion_lock_tx.clone(),
            preimage_hex: self.preimage.map(hex::encode),
            btc_settle_tx: self.btc_settle_tx.clone(),
            created_at: self.created_at,
            updated_at: self.updated_at,
        }
    }

    /// Rebuild a record from a persisted snapshot. Fails on malformed script
    /// or network mismatch (strict round-trip, same as `from_witness_script`).
    pub fn from_snapshot(snap: &BtcSwapSnapshot) -> WarpResult<Self> {
        let network: Network = snap
            .btc_network
            .parse()
            .map_err(|e| err(format!("btc network '{}': {e}", snap.btc_network)))?;
        let script_bytes = hex::decode(&snap.witness_script_hex)
            .map_err(|e| err(format!("witness_script_hex: {e}")))?;
        let btc_htlc = BtcHtlc::from_witness_script(&script_bytes, network)?;
        if hex::encode(btc_htlc.hashlock) != snap.swap_id {
            return Err(err("snapshot hashlock/swap_id mismatch"));
        }
        let user_zion_pubkey: [u8; 32] = hex::decode(&snap.user_zion_pubkey_hex)
            .ok()
            .and_then(|b| b.try_into().ok())
            .ok_or_else(|| err("bad user_zion_pubkey_hex"))?;
        let preimage = match &snap.preimage_hex {
            Some(h) => Some(
                hex::decode(h)
                    .ok()
                    .and_then(|b| <[u8; 32]>::try_from(b.as_slice()).ok())
                    .ok_or_else(|| err("bad preimage_hex"))?,
            ),
            None => None,
        };
        Ok(Self {
            swap_id: snap.swap_id.clone(),
            direction: snap.direction,
            phase: snap.phase.clone(),
            btc_htlc,
            btc_sats: snap.btc_sats,
            zion_flowers: snap.zion_flowers,
            zion_timeout_ts: snap.zion_timeout_ts,
            user_zion_pubkey,
            user_zion_address: snap.user_zion_address.clone(),
            user_zion_lock_txid: snap.user_zion_lock_txid.clone(),
            btc_lock: snap.btc_lock.clone(),
            zion_lock_tx: snap.zion_lock_tx.clone(),
            preimage,
            btc_settle_tx: snap.btc_settle_tx.clone(),
            created_at: snap.created_at,
            updated_at: snap.updated_at,
        })
    }

    /// JSON projection for API responses.
    pub fn to_json(&self) -> serde_json::Value {
        serde_json::json!({
            "swap_id": self.swap_id,
            "direction": self.direction,
            "phase": self.phase,
            "hashlock": hex::encode(self.btc_htlc.hashlock),
            "btc_htlc_address": self.btc_htlc.address.to_string(),
            "btc_cltv_timeout": self.btc_htlc.cltv_timeout,
            "btc_sats": self.btc_sats,
            "zion_flowers": self.zion_flowers,
            "zion_timeout_ts": self.zion_timeout_ts,
            "user_zion_address": self.user_zion_address,
            "btc_lock": self.btc_lock.as_ref().map(|l| serde_json::json!({
                "txid": l.txid,
                "vout": l.vout,
                "value_sats": l.value_sats,
                "confirmations": l.confirmations,
                "block_height": l.block_height,
            })),
            "zion_lock_tx": self.zion_lock_tx,
            "btc_settle_tx": self.btc_settle_tx,
            "created_at": self.created_at.to_rfc3339(),
            "updated_at": self.updated_at.to_rfc3339(),
        })
    }
}

/// Flow configuration.
#[derive(Debug, Clone)]
pub struct BtcSwapConfig {
    pub btc_network: Network,
    /// Required confirmations on the user's BTC lock before we counter-lock.
    pub min_btc_confs: u64,
    /// CLTV safety margin in BTC blocks (≈ `margin * 10min`).
    pub margin_blocks: u32,
    /// Operator ZION Ed25519 pubkey (refund key on our locks, claimant key on
    /// the user's locks).
    pub operator_zion_pubkey: [u8; 32],
    /// Operator ZION address (must match the zion-l1 adapter keyring).
    pub operator_zion_address: String,
    /// BTC destination for our claims/refunds (default: relay wallet).
    pub operator_btc_dest: Option<BtcAddress>,
    /// Minimum accepted BTC leg size (below this the HTLC is dust-risk).
    pub min_btc_sats: u64,
    /// Maximum accepted BTC leg size (beta safety cap).
    pub max_btc_sats: u64,
    /// Maximum number of non-terminal swaps tracked at once.
    pub max_active_swaps: usize,
    /// zion-node JSON-RPC endpoint (`host:port`, TCP line protocol) used to
    /// verify the user's ZION HTLC lock on-chain before `LockBtc`. `None`
    /// skips verification — intended only for offline tests; production
    /// wiring always sets it from `l1_rpc_url`.
    pub zion_rpc_url: Option<String>,
    /// Minimum confirmations required on the user's ZION lock before we
    /// counter-lock BTC (shallow-reorg protection).
    pub min_zion_lock_confs: u64,
}

impl Default for BtcSwapConfig {
    fn default() -> Self {
        Self {
            btc_network: Network::Bitcoin,
            min_btc_confs: 2,
            margin_blocks: DEFAULT_MARGIN_BLOCKS,
            operator_zion_pubkey: [0u8; 32],
            operator_zion_address: String::new(),
            operator_btc_dest: None,
            min_btc_sats: 2_000,
            max_btc_sats: 10_000_000,
            max_active_swaps: 32,
            zion_rpc_url: None,
            min_zion_lock_confs: 2,
        }
    }
}

/// Observed outside world for one record during a poll.
#[derive(Debug, Default)]
pub struct SwapView {
    pub btc_lock: Option<BtcHtlcLock>,
    pub btc_spend: Option<BtcHtlcSpend>,
    /// Coordinator state (present once the ZION leg was initiated/registered).
    pub coordinator_claimed: bool,
    /// Preimage revealed through the coordinator (user claimed our ZION lock).
    pub preimage: Option<[u8; 32]>,
    pub btc_tip: u64,
    pub now_ts: u64,
}

/// What [`decide`] wants done for one swap.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum NextAction {
    Wait,
    /// Broadcast the ZION HTLC lock via `HtlcSwap::initiate`.
    LockZion,
    /// Broadcast the BTC HTLC lock via `BtcSigner::lock_htlc`.
    LockBtc,
    /// Claim the user's BTC lock with the revealed preimage.
    ClaimBtc,
    /// Claim the user's ZION lock via `HtlcSwap::claim_source`.
    ClaimZion,
    /// Refund our expired BTC lock.
    RefundBtc,
    /// Refund our expired ZION lock via `HtlcSwap::refund`.
    RefundZion,
    /// Move to `Settled` without broadcasting (spend already on-chain).
    MarkSettled,
    /// Move to `Refunded` without broadcasting.
    MarkRefunded,
    /// Move to `Failed`.
    Fail(String),
}

/// Pure transition table — the heart of the orchestrator.
pub fn decide(rec: &BtcSwapRecord, v: &SwapView, cfg: &BtcSwapConfig) -> NextAction {
    use BtcSwapDirection::*;
    use BtcSwapPhase::*;
    match (rec.direction, &rec.phase) {
        // ── BTC→ZION: user locks BTC, we lock ZION, user claims ZION, we claim BTC
        (BtcToZion, AwaitingUserLock) => match &v.btc_lock {
            Some(l) if l.confirmations >= cfg.min_btc_confs => {
                // The ZION timeout was agreed at offer time; if it has already
                // passed (user locked very late), initiating would produce an
                // invalid/expired lock — fail instead.
                if v.now_ts >= rec.zion_timeout_ts {
                    NextAction::Fail("zion timeout passed before btc lock confirmed".into())
                } else {
                    NextAction::LockZion
                }
            }
            _ => NextAction::Wait,
        },
        (BtcToZion, Locked) => {
            // A spend on the *user's* BTC lock: only our claim can succeed
            // before CLTV (we are the claimant). If one is already on-chain
            // (e.g. we crashed after broadcasting), settle directly.
            match &v.btc_spend {
                Some(BtcHtlcSpend::Claim { .. }) => NextAction::MarkSettled,
                Some(BtcHtlcSpend::Refund { .. }) => NextAction::MarkRefunded,
                None => {
                    if v.preimage.is_some() {
                        NextAction::ClaimBtc
                    } else if v.now_ts >= rec.zion_timeout_ts {
                        NextAction::RefundZion
                    } else {
                        NextAction::Wait
                    }
                }
            }
        }

        // ── ZION→BTC: user locks ZION, we lock BTC, user claims BTC, we claim ZION
        (ZionToBtc, AwaitingUserLock) => {
            if rec.user_zion_lock_txid.is_some() {
                NextAction::LockBtc
            } else {
                NextAction::Wait
            }
        }
        (ZionToBtc, Locked) => match &v.btc_spend {
            // User claimed our BTC lock → the preimage is public; claim their
            // ZION lock before it expires.
            Some(BtcHtlcSpend::Claim { .. }) => NextAction::ClaimZion,
            // Our refund already landed (crash recovery).
            Some(BtcHtlcSpend::Refund { .. }) => NextAction::MarkRefunded,
            None => {
                if v.btc_tip >= rec.btc_htlc.cltv_timeout as u64 {
                    NextAction::RefundBtc
                } else {
                    NextAction::Wait
                }
            }
        },
        _ => NextAction::Wait,
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// User ZION lock verification
// ─────────────────────────────────────────────────────────────────────────────

/// Result of verifying the user's ZION HTLC lock against the chain.
#[derive(Debug)]
enum LockCheck {
    /// Lock output found in the UTXO set and all fields match the offer.
    Verified,
    /// No matching output yet — keep waiting (tx may be unconfirmed/propagating).
    NotFound,
    /// Output exists but a field mismatches — never lock BTC against it.
    Invalid(String),
}

/// Parse a native V31 HTLC output script.
///
/// Layout: `[0x01][32B hashlock][8B timeout LE][32B claimant pk][32B refund pk]`
/// (mirrors `zion_core::v31_wallet::htlc_output_script`; kept local so the
/// wire format is verified byte-for-byte, not via a builder round-trip).
fn parse_htlc_script(script: &[u8]) -> Option<([u8; 32], u64, [u8; 32], [u8; 32])> {
    if script.len() != 105 || script[0] != 0x01 {
        return None;
    }
    Some((
        script[1..33].try_into().ok()?,
        u64::from_le_bytes(script[33..41].try_into().ok()?),
        script[41..73].try_into().ok()?,
        script[73..105].try_into().ok()?,
    ))
}

/// Minimal zion-node JSON-RPC call (TCP newline-delimited, same wire protocol
/// as `ZionL1Adapter::call`). Kept standalone so the orchestrator can verify
/// user locks without reaching through the adapter registry.
async fn zion_rpc_call(rpc: &str, method: &str, params: serde_json::Value) -> WarpResult<serde_json::Value> {
    use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
    use tokio::net::TcpStream;

    let addr = {
        let s = rpc.trim();
        let s = s
            .strip_prefix("http://")
            .or_else(|| s.strip_prefix("https://"))
            .unwrap_or(s);
        s.split('/').next().unwrap_or(s).to_string()
    };
    let mut stream = TcpStream::connect(&addr)
        .await
        .map_err(|e| err(format!("zion rpc connect failed: {e}")))?;
    let body = serde_json::json!({"jsonrpc": "2.0", "id": 1, "method": method, "params": params});
    stream
        .write_all(format!("{body}\n").as_bytes())
        .await
        .map_err(|e| err(format!("zion rpc write failed: {e}")))?;
    stream
        .flush()
        .await
        .map_err(|e| err(format!("zion rpc flush failed: {e}")))?;

    let mut line = String::new();
    BufReader::new(&mut stream)
        .read_line(&mut line)
        .await
        .map_err(|e| err(format!("zion rpc read failed: {e}")))?;
    let env: serde_json::Value = serde_json::from_str(line.trim())
        .map_err(|e| err(format!("zion rpc decode failed: {e}")))?;
    if let Some(e) = env.get("error").filter(|e| !e.is_null()) {
        return Err(err(format!("zion rpc {method} error: {e}")));
    }
    env.get("result")
        .cloned()
        .or(Some(env))
        .ok_or_else(|| err("zion rpc missing result"))
}

// ─────────────────────────────────────────────────────────────────────────────
// Orchestrator
// ─────────────────────────────────────────────────────────────────────────────

pub struct BtcSwapFlow {
    btc: Arc<BitcoinAdapter>,
    signer: Arc<BtcSigner>,
    swaps: Arc<HtlcSwap>,
    cfg: BtcSwapConfig,
    records: Arc<Mutex<HashMap<String, BtcSwapRecord>>>,
    /// Optional SQLite persistence — set via [`Self::set_db`].
    db: Option<Arc<Mutex<crate::db::Db>>>,
}

/// Outcome of one poll iteration for a swap.
#[derive(Debug)]
pub struct PollOutcome {
    pub swap_id: String,
    pub action: NextAction,
    pub detail: Option<String>,
}

impl BtcSwapFlow {
    pub fn new(
        btc: Arc<BitcoinAdapter>,
        signer: Arc<BtcSigner>,
        swaps: Arc<HtlcSwap>,
        cfg: BtcSwapConfig,
    ) -> Self {
        Self {
            btc,
            signer,
            swaps,
            cfg,
            records: Arc::new(Mutex::new(HashMap::new())),
            db: None,
        }
    }

    /// Attach SQLite persistence (records survive restarts).
    pub fn set_db(&mut self, db: Arc<Mutex<crate::db::Db>>) {
        self.db = Some(db);
    }

    /// Load persisted records into memory (idempotent — later snapshots win).
    pub async fn load_from_db(&self) -> WarpResult<usize> {
        let Some(db) = &self.db else { return Ok(0) };
        let snaps = db
            .lock()
            .await
            .list_btc_swaps()
            .map_err(|e| err(format!("load btc swaps: {e}")))?;
        let n = snaps.len();
        let mut records = self.records.lock().await;
        for snap in &snaps {
            match BtcSwapRecord::from_snapshot(snap) {
                Ok(rec) => {
                    records.insert(rec.swap_id.clone(), rec);
                }
                Err(e) => warn!("[WARP][btc-swap] skipping corrupt record {}: {e}", snap.swap_id),
            }
        }
        Ok(n)
    }

    /// Persist one record (no-op when no db attached; logs errors).
    async fn persist(&self, rec: &BtcSwapRecord) {
        if let Some(db) = &self.db {
            if let Err(e) = db.lock().await.save_btc_swap(&rec.to_snapshot()) {
                warn!("[WARP][btc-swap] persist {} failed: {e}", rec.swap_id);
            }
        }
    }

    /// Reject offers outside the configured BTC size band (dust / beta cap).
    fn check_amount(&self, sats: u64) -> WarpResult<()> {
        if sats < self.cfg.min_btc_sats || sats > self.cfg.max_btc_sats {
            return Err(err(format!(
                "btc_sats {sats} outside limits [{}, {}]",
                self.cfg.min_btc_sats, self.cfg.max_btc_sats
            )));
        }
        Ok(())
    }

    /// Reject a duplicate hashlock and cap concurrent active swaps.
    async fn check_offer_admission(&self, swap_id: &str) -> WarpResult<()> {
        let records = self.records.lock().await;
        if records.contains_key(swap_id) {
            return Err(err(format!("swap {swap_id} already registered")));
        }
        let active = records.values().filter(|r| !r.phase.is_terminal()).count();
        if active >= self.cfg.max_active_swaps {
            return Err(err(format!(
                "active swap cap reached ({}/{})",
                active, self.cfg.max_active_swaps
            )));
        }
        Ok(())
    }

    /// Register a BTC→ZION offer and return the swap record (the user sends
    /// BTC to `record.btc_htlc.address`).
    ///
    /// `now_ts`/`btc_tip` are supplied by the caller (or via
    /// [`Self::offer_btc_to_zion_live`]).
    pub fn offer_btc_to_zion(
        &self,
        p: OfferBtcToZion,
        now_ts: u64,
        btc_tip: u64,
    ) -> WarpResult<BtcSwapRecord> {
        self.check_amount(p.btc_sats)?;
        if p.zion_timeout_ts <= now_ts {
            return Err(err("zion_timeout_ts must be in the future"));
        }
        let cltv = cltv_from_zion_timeout(
            p.zion_timeout_ts,
            now_ts,
            btc_tip,
            self.cfg.margin_blocks,
        );
        let htlc = BtcHtlc::new(
            p.hashlock,
            *self.signer.public_key_btc(), // claimant = operator
            p.user_btc_refund,
            cltv,
            self.cfg.btc_network,
        )?;
        let rec = BtcSwapRecord {
            swap_id: hex::encode(p.hashlock),
            direction: BtcSwapDirection::BtcToZion,
            phase: BtcSwapPhase::AwaitingUserLock,
            btc_htlc: htlc,
            btc_sats: p.btc_sats,
            zion_flowers: p.zion_flowers,
            zion_timeout_ts: p.zion_timeout_ts,
            user_zion_pubkey: p.user_zion_claim,
            user_zion_address: p.user_zion_address,
            user_zion_lock_txid: None,
            btc_lock: None,
            zion_lock_tx: None,
            preimage: None,
            btc_settle_tx: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        Ok(rec)
    }

    /// Same as [`Self::offer_btc_to_zion`] but fetches the BTC tip itself.
    pub async fn offer_btc_to_zion_live(&self, p: OfferBtcToZion) -> WarpResult<BtcSwapRecord> {
        self.check_offer_admission(&hex::encode(p.hashlock)).await?;
        let tip = self.btc.current_height().await?;
        let rec = self.offer_btc_to_zion(p, Utc::now().timestamp() as u64, tip)?;
        self.insert_record(rec.clone()).await;
        Ok(rec)
    }

    /// Register a ZION→BTC offer (user already locked ZION).
    pub fn offer_zion_to_btc(
        &self,
        p: OfferZionToBtc,
        now_ts: u64,
        btc_tip: u64,
    ) -> WarpResult<BtcSwapRecord> {
        self.check_amount(p.btc_sats)?;
        // Our BTC leg must expire strictly *before* the user's ZION timeout.
        let cltv = cltv_before_zion_timeout(
            p.zion_timeout_ts,
            now_ts,
            btc_tip,
            self.cfg.margin_blocks,
        )?;
        let htlc = BtcHtlc::new(
            p.hashlock,
            p.user_btc_claim,                 // claimant = user
            *self.signer.public_key_btc(),    // refund = operator
            cltv,
            self.cfg.btc_network,
        )?;
        let rec = BtcSwapRecord {
            swap_id: hex::encode(p.hashlock),
            direction: BtcSwapDirection::ZionToBtc,
            phase: BtcSwapPhase::AwaitingUserLock,
            btc_htlc: htlc,
            btc_sats: p.btc_sats,
            zion_flowers: p.zion_flowers,
            zion_timeout_ts: p.zion_timeout_ts,
            user_zion_pubkey: p.user_zion_refund,
            user_zion_address: p.user_zion_address,
            user_zion_lock_txid: Some(p.user_zion_lock_txid),
            btc_lock: None,
            zion_lock_tx: None,
            preimage: None,
            btc_settle_tx: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        Ok(rec)
    }

    /// Same as [`Self::offer_zion_to_btc`] but fetches the BTC tip itself.
    /// When a ZION RPC is configured, a provably-invalid user lock is rejected
    /// immediately; `NotFound`/RPC errors are tolerated here because the poll
    /// loop re-verifies before `LockBtc`.
    pub async fn offer_zion_to_btc_live(&self, p: OfferZionToBtc) -> WarpResult<BtcSwapRecord> {
        self.check_offer_admission(&hex::encode(p.hashlock)).await?;
        let tip = self.btc.current_height().await?;
        let rec = self.offer_zion_to_btc(p, Utc::now().timestamp() as u64, tip)?;
        if self.cfg.zion_rpc_url.is_some() {
            match self.verify_user_zion_lock(&rec).await {
                Ok(LockCheck::Invalid(reason)) => {
                    return Err(err(format!("invalid user zion lock: {reason}")));
                }
                Ok(_) => {}
                Err(e) => {
                    warn!("[WARP][btc-swap] user zion lock pre-check failed ({e}); deferring to poll loop");
                }
            }
        }
        self.insert_record(rec.clone()).await;
        Ok(rec)
    }

    pub async fn insert_record(&self, rec: BtcSwapRecord) {
        self.persist(&rec).await;
        self.records
            .lock()
            .await
            .insert(rec.swap_id.clone(), rec);
    }

    pub async fn record(&self, swap_id: &str) -> Option<BtcSwapRecord> {
        self.records.lock().await.get(swap_id).cloned()
    }

    pub async fn active_records(&self) -> Vec<BtcSwapRecord> {
        self.records
            .lock()
            .await
            .values()
            .filter(|r| !r.phase.is_terminal())
            .cloned()
            .collect()
    }

    /// All records including terminal ones (for status/listing).
    pub async fn all_records(&self) -> Vec<BtcSwapRecord> {
        self.records.lock().await.values().cloned().collect()
    }

    // ── Poll loop ────────────────────────────────────────────────────────

    /// One iteration over all non-terminal swaps: gather observations, decide,
    /// execute the action, persist the new phase. Individual failures are
    /// captured in the outcome and never abort the loop.
    pub async fn poll_once(&self) -> Vec<PollOutcome> {
        let ids: Vec<String> = {
            let records = self.records.lock().await;
            records
                .values()
                .filter(|r| !r.phase.is_terminal())
                .map(|r| r.swap_id.clone())
                .collect()
        };
        let mut outcomes = Vec::new();
        for id in ids {
            let outcome = match self.poll_one(&id).await {
                Ok(o) => o,
                Err(e) => PollOutcome {
                    swap_id: id.clone(),
                    action: NextAction::Wait,
                    detail: Some(format!("poll error: {e}")),
                },
            };
            outcomes.push(outcome);
        }
        outcomes
    }

    async fn poll_one(&self, swap_id: &str) -> WarpResult<PollOutcome> {
        let rec = self
            .record(swap_id)
            .await
            .ok_or_else(|| WarpError::TransferNotFound(swap_id.to_string()))?;

        // ── Gather observations ──────────────────────────────────────────
        let btc_tip = self.btc.current_height().await.unwrap_or(0);
        let now_ts = Utc::now().timestamp() as u64;
        let btc_lock = self
            .btc
            .detect_htlc_lock(&rec.btc_htlc, rec.btc_sats)
            .await
            .unwrap_or(None);
        let btc_spend = match rec.btc_lock.as_ref().or(btc_lock.as_ref()) {
            Some(lock) => self
                .btc
                .detect_htlc_spend(&rec.btc_htlc, lock)
                .await
                .unwrap_or(None),
            None => None,
        };
        let coord = self.swaps.get_record(swap_id).await;
        let preimage = self.swaps.revealed_preimage(swap_id).await;

        let view = SwapView {
            btc_lock,
            btc_spend,
            coordinator_claimed: coord
                .as_ref()
                .map(|r| r.state == SwapState::Claimed)
                .unwrap_or(false),
            preimage,
            btc_tip,
            now_ts,
        };

        let mut rec = rec;
        if let Some(l) = &view.btc_lock {
            rec.btc_lock = Some(l.clone());
        }
        if let Some(p) = view.preimage {
            rec.preimage = Some(p);
        }

        let mut action = decide(&rec, &view, &self.cfg);
        let mut detail = None;

        // Never broadcast our BTC lock against a user ZION lock we have not
        // independently verified on-chain — a fake or malformed
        // `user_zion_lock_txid` would let the user claim our BTC while we
        // hold nothing claimable.
        if action == NextAction::LockBtc {
            match self.verify_user_zion_lock(&rec).await? {
                LockCheck::Verified => {}
                LockCheck::NotFound => {
                    action = NextAction::Wait;
                    detail = Some("user zion lock not yet visible on-chain".into());
                }
                LockCheck::Invalid(reason) => {
                    action = NextAction::Fail(format!("invalid user zion lock: {reason}"));
                }
            }
        }

        match &action {
            NextAction::Wait => {}
            NextAction::LockZion => {
                let txid = self.exec_lock_zion(&rec).await?;
                rec.zion_lock_tx = Some(txid.clone());
                rec.phase = BtcSwapPhase::Locked;
                detail = Some(txid);
            }
            NextAction::LockBtc => {
                let lock = self.exec_lock_btc(&rec).await?;
                rec.btc_lock = Some(lock.clone());
                rec.phase = BtcSwapPhase::Locked;
                detail = Some(lock.txid);
            }
            NextAction::ClaimBtc => {
                let txid = self.exec_claim_btc(&rec).await?;
                rec.btc_settle_tx = Some(txid.clone());
                rec.phase = BtcSwapPhase::Settled;
                detail = Some(txid);
            }
            NextAction::ClaimZion => {
                let txid = self.exec_claim_zion(&rec, &view).await?;
                rec.phase = BtcSwapPhase::Settled;
                detail = Some(txid);
            }
            NextAction::RefundBtc => {
                let txid = self.exec_refund_btc(&rec).await?;
                rec.btc_settle_tx = Some(txid.clone());
                rec.phase = BtcSwapPhase::Refunded;
                detail = Some(txid);
            }
            NextAction::RefundZion => {
                let txid = self.exec_refund_zion(&rec).await?;
                rec.phase = BtcSwapPhase::Refunded;
                detail = Some(txid);
            }
            NextAction::MarkSettled => {
                rec.phase = BtcSwapPhase::Settled;
                info!("[WARP][btc-swap] {swap_id} settled (spend already on-chain)");
            }
            NextAction::MarkRefunded => {
                rec.phase = BtcSwapPhase::Refunded;
                warn!("[WARP][btc-swap] {swap_id} refunded (spend already on-chain)");
            }
            NextAction::Fail(reason) => {
                rec.phase = BtcSwapPhase::Failed(reason.clone());
                warn!("[WARP][btc-swap] {swap_id} failed: {reason}");
            }
        }

        rec.updated_at = Utc::now();
        self.persist(&rec).await;
        self.records
            .lock()
            .await
            .insert(rec.swap_id.clone(), rec);

        Ok(PollOutcome {
            swap_id: swap_id.to_string(),
            action,
            detail,
        })
    }

    // ── Action executors ─────────────────────────────────────────────────

    fn zion_endpoint(&self, address: &str, amount: u64) -> WarpResult<TransferEndpoint> {
        Ok(TransferEndpoint {
            address: Address::new(
                ChainId::ZionL1,
                address.as_bytes().to_vec(),
                address.to_string(),
            )
            .map_err(|e| err(format!("zion address: {e}")))?,
            asset: Asset::native(ChainId::ZionL1, "ZION", 6, "ZION"),
            amount: Amount::new(amount as u128),
        })
    }

    /// Broadcast the operator's ZION HTLC lock via the coordinator.
    async fn exec_lock_zion(&self, rec: &BtcSwapRecord) -> WarpResult<String> {
        let hash = Hash::new(rec.btc_htlc.hashlock);
        let mut t = Transfer::new(
            format!("htlc-lock-{}", rec.swap_id),
            TransferDirection::Htlc,
            self.zion_endpoint(&self.cfg.operator_zion_address, rec.zion_flowers)?,
            self.zion_endpoint(&rec.user_zion_address, rec.zion_flowers)?,
        );
        t.hashlock = Some(hash);
        t.timelock = Some(rec.zion_timeout_ts);
        t.source_pubkey = Some(self.cfg.operator_zion_pubkey); // our refund key
        t.target_pubkey = Some(rec.user_zion_pubkey); // user claim key

        self.swaps.initiate(&mut t).await.map_err(mc_err)?;

        // Annotate the user's BTC lock so `claim`'s source_confirmed guard
        // passes; expiry is an approximate wall-clock projection of the CLTV
        // height (bookkeeping only — the BTC leg is enforced by consensus).
        if let Some(lock) = &rec.btc_lock {
            let approx_expiry = rec
                .zion_timeout_ts
                .saturating_add(self.cfg.margin_blocks as u64 * 600);
            self.swaps
                .set_source_lock(&rec.swap_id, &lock.txid, approx_expiry as i64)
                .await
                .map_err(mc_err)?;
        }
        Ok(t.lock_tx_id.clone().unwrap_or_default())
    }

    /// Broadcast the operator's BTC HTLC lock.
    async fn exec_lock_btc(&self, rec: &BtcSwapRecord) -> WarpResult<BtcHtlcLock> {
        let (txid, vout, value) = self
            .signer
            .lock_htlc(
                self.btc.client(),
                self.btc.api_url(),
                &rec.btc_htlc,
                rec.btc_sats,
            )
            .await?;
        let lock = BtcHtlcLock {
            txid,
            vout,
            value_sats: value,
            confirmations: 0,
            block_height: 0,
        };

        // Register with the coordinator (bookkeeping for our external lock)
        // and annotate the user's ZION source lock so `claim_source` can run.
        let hash = Hash::new(rec.btc_htlc.hashlock);
        self.swaps
            .register_external_lock(
                hash,
                &self.cfg.operator_zion_address,
                rec.btc_sats,
                &lock.txid,
                rec.btc_htlc.cltv_timeout as i64, // height — bookkeeping only
                "zion-l1",
                &rec.user_zion_address,
                None,
                None,
            )
            .await
            .map_err(mc_err)?;
        if let Some(user_lock) = &rec.user_zion_lock_txid {
            self.swaps
                .set_source_details(
                    &rec.swap_id,
                    &rec.user_zion_address,
                    "zion-l1",
                    rec.zion_flowers,
                    Some(rec.user_zion_pubkey),           // user refund key
                    Some(self.cfg.operator_zion_pubkey),  // we claim
                )
                .await
                .map_err(mc_err)?;
            self.swaps
                .set_source_lock(&rec.swap_id, user_lock, rec.zion_timeout_ts as i64)
                .await
                .map_err(mc_err)?;
        }
        Ok(lock)
    }

    /// Verify the user's ZION HTLC lock exists on-chain and matches the offer
    /// before we counter-lock BTC. `getUtxos` only returns confirmed unspent
    /// outputs, so a hit proves the lock is mined and still spendable.
    async fn verify_user_zion_lock(&self, rec: &BtcSwapRecord) -> WarpResult<LockCheck> {
        let Some(rpc) = self.cfg.zion_rpc_url.as_deref() else {
            // Offline/test path — production wiring always sets the URL.
            warn!("[WARP][btc-swap] {} zion_rpc_url unset — user lock NOT verified", rec.swap_id);
            return Ok(LockCheck::Verified);
        };
        let Some(txid) = rec.user_zion_lock_txid.as_deref() else {
            return Ok(LockCheck::Invalid("missing user_zion_lock_txid".into()));
        };

        let resp = zion_rpc_call(
            rpc,
            "getUtxos",
            serde_json::json!({"address": rec.user_zion_address}),
        )
        .await?;
        let utxos = resp
            .get("utxos")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();
        let Some(u) = utxos
            .iter()
            .find(|u| u.get("tx_hash").and_then(|h| h.as_str()) == Some(txid))
        else {
            return Ok(LockCheck::NotFound);
        };

        // Confirmation-depth check — a shallow reorg could otherwise evict a
        // 1-block lock after we already broadcast our BTC leg.
        let lock_height = u.get("block_height").and_then(|v| v.as_u64()).unwrap_or(0);
        let tip = zion_rpc_call(rpc, "getChainInfo", serde_json::json!([]))
            .await?
            .get("chain_height")
            .and_then(|v| v.as_u64())
            .unwrap_or(0);
        if tip.saturating_sub(lock_height) < self.cfg.min_zion_lock_confs.saturating_sub(1) {
            return Ok(LockCheck::NotFound);
        }

        let script_hex = u
            .get("script_hex")
            .and_then(|v| v.as_str())
            .unwrap_or_default();
        let script = hex::decode(script_hex).unwrap_or_default();
        let Some((hashlock, timeout, claimant, refund)) = parse_htlc_script(&script) else {
            return Ok(LockCheck::Invalid("lock output is not an HTLC script".into()));
        };
        if hashlock != rec.btc_htlc.hashlock {
            return Ok(LockCheck::Invalid("hashlock mismatch".into()));
        }
        if claimant != self.cfg.operator_zion_pubkey {
            return Ok(LockCheck::Invalid(
                "claimant pubkey is not the operator".into(),
            ));
        }
        if refund != rec.user_zion_pubkey {
            return Ok(LockCheck::Invalid(
                "refund pubkey is not the user's".into(),
            ));
        }
        if timeout != rec.zion_timeout_ts {
            return Ok(LockCheck::Invalid(format!(
                "timeout {timeout} != agreed {}",
                rec.zion_timeout_ts
            )));
        }
        let amount = u.get("amount").and_then(|v| v.as_u64()).unwrap_or(0);
        if amount < rec.zion_flowers {
            return Ok(LockCheck::Invalid(format!(
                "lock amount {amount} < agreed {}",
                rec.zion_flowers
            )));
        }
        Ok(LockCheck::Verified)
    }

    /// Claim the user's BTC lock with the revealed preimage.
    async fn exec_claim_btc(&self, rec: &BtcSwapRecord) -> WarpResult<String> {
        let preimage = rec
            .preimage
            .ok_or_else(|| err("claim_btc without preimage"))?;
        let lock = rec
            .btc_lock
            .clone()
            .ok_or_else(|| err("claim_btc without btc lock"))?;
        let utxo = HtlcUtxo {
            outpoint: OutPoint::new(
                Txid::from_str(&lock.txid).map_err(|e| err(format!("txid: {e}")))?,
                lock.vout,
            ),
            value_sats: lock.value_sats,
        };
        let dest = self
            .cfg
            .operator_btc_dest
            .clone()
            .unwrap_or_else(|| self.signer.address().clone());
        self.signer
            .claim_htlc(
                self.btc.client(),
                self.btc.api_url(),
                &utxo,
                &rec.btc_htlc,
                preimage,
                &dest,
            )
            .await
    }

    /// Claim the user's ZION lock with the preimage revealed on BTC.
    async fn exec_claim_zion(&self, rec: &BtcSwapRecord, view: &SwapView) -> WarpResult<String> {
        let preimage = match &view.btc_spend {
            Some(BtcHtlcSpend::Claim { preimage, .. }) => *preimage,
            _ => return Err(err("claim_zion without revealed preimage")),
        };
        let mut t = Transfer::new(
            format!("htlc-claim-{}", rec.swap_id),
            TransferDirection::Htlc,
            self.zion_endpoint(&rec.user_zion_address, rec.zion_flowers)?,
            self.zion_endpoint(&self.cfg.operator_zion_address, rec.zion_flowers)?,
        );
        t.hashlock = Some(Hash::new(rec.btc_htlc.hashlock));
        self.swaps
            .claim_source(&preimage, &self.cfg.operator_zion_address, &mut t)
            .await
            .map_err(mc_err)?;
        Ok(t.lock_tx_id.clone().unwrap_or_default())
    }

    /// Refund our BTC lock after CLTV expiry.
    async fn exec_refund_btc(&self, rec: &BtcSwapRecord) -> WarpResult<String> {
        let lock = rec
            .btc_lock
            .clone()
            .ok_or_else(|| err("refund_btc without btc lock"))?;
        let utxo = HtlcUtxo {
            outpoint: OutPoint::new(
                Txid::from_str(&lock.txid).map_err(|e| err(format!("txid: {e}")))?,
                lock.vout,
            ),
            value_sats: lock.value_sats,
        };
        let dest = self
            .cfg
            .operator_btc_dest
            .clone()
            .unwrap_or_else(|| self.signer.address().clone());
        self.signer
            .refund_htlc(
                self.btc.client(),
                self.btc.api_url(),
                &utxo,
                &rec.btc_htlc,
                &dest,
            )
            .await
    }

    /// Refund our ZION lock after its timeout via the coordinator.
    async fn exec_refund_zion(&self, rec: &BtcSwapRecord) -> WarpResult<String> {
        let mut t = Transfer::new(
            format!("htlc-refund-{}", rec.swap_id),
            TransferDirection::Htlc,
            self.zion_endpoint(&self.cfg.operator_zion_address, rec.zion_flowers)?,
            self.zion_endpoint(&rec.user_zion_address, rec.zion_flowers)?,
        );
        t.hashlock = Some(Hash::new(rec.btc_htlc.hashlock));
        t.timelock = Some(rec.zion_timeout_ts);
        self.swaps.refund(&mut t).await.map_err(mc_err)?;
        Ok(t.lock_tx_id.clone().unwrap_or_default())
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::warp::adapter::bitcoin::BtcHtlcLock;
    use bitcoin::PrivateKey;
    use rand::RngCore;
    use sha2::Digest as _;

    fn signer() -> BtcSigner {
        BtcSigner::from_wif(
            "KwDiBf89QgGbjEhKnhXJuH7LrciVrZi3qYjgd9M7rFU73sVHnoWn",
            Network::Bitcoin,
        )
        .unwrap()
    }

    fn user_btc_key() -> PublicKey {
        let sk = bitcoin::secp256k1::SecretKey::from_slice(&[0x02u8; 32]).unwrap();
        PrivateKey::new(sk, Network::Bitcoin).public_key(&Secp256k1::new())
    }

    use bitcoin::secp256k1::Secp256k1;

    fn cfg() -> BtcSwapConfig {
        BtcSwapConfig {
            btc_network: Network::Bitcoin,
            min_btc_confs: 2,
            margin_blocks: 36,
            operator_zion_pubkey: [0x11; 32],
            operator_zion_address: "zion1operator".into(),
            operator_btc_dest: None,
            ..BtcSwapConfig::default()
        }
    }

    fn btc_to_zion_rec(s: &BtcSigner, cfg: &BtcSwapConfig) -> BtcSwapRecord {
        let flow = BtcSwapFlow::new(
            Arc::new(BitcoinAdapter::new()),
            Arc::new(s.clone()),
            Arc::new(HtlcSwap::new_offline()),
            cfg.clone(),
        );
        let mut preimage = [0u8; 32];
        rand::rngs::OsRng.fill_bytes(&mut preimage);
        let hashlock: [u8; 32] = sha2::Sha256::digest(preimage).into();
        flow.offer_btc_to_zion(
            OfferBtcToZion {
                hashlock,
                btc_sats: 100_000,
                zion_flowers: 50_000_000,
                user_btc_refund: user_btc_key(),
                user_zion_claim: [0x22; 32],
                user_zion_address: "zion1user".into(),
                zion_timeout_ts: 1_800_000_000,
            },
            1_700_000_000, // now
            850_000,       // btc tip
        )
        .unwrap()
    }

    fn lock(confs: u64) -> Option<BtcHtlcLock> {
        Some(BtcHtlcLock {
            txid: "aa".repeat(32),
            vout: 0,
            value_sats: 100_000,
            confirmations: confs,
            block_height: 850_000,
        })
    }

    #[test]
    fn btc_to_zion_waits_without_lock() {
        let s = signer();
        let c = cfg();
        let rec = btc_to_zion_rec(&s, &c);
        let v = SwapView {
            now_ts: 1_700_000_000,
            btc_tip: 850_000,
            ..Default::default()
        };
        assert_eq!(decide(&rec, &v, &c), NextAction::Wait);
    }

    #[test]
    fn btc_to_zion_waits_for_confs() {
        let s = signer();
        let c = cfg();
        let rec = btc_to_zion_rec(&s, &c);
        let v = SwapView {
            btc_lock: lock(1), // < min_btc_confs
            now_ts: 1_700_000_000,
            btc_tip: 850_000,
            ..Default::default()
        };
        assert_eq!(decide(&rec, &v, &c), NextAction::Wait);
    }

    #[test]
    fn btc_to_zion_locks_zion_after_confs() {
        let s = signer();
        let c = cfg();
        let rec = btc_to_zion_rec(&s, &c);
        let v = SwapView {
            btc_lock: lock(3),
            now_ts: 1_700_000_000,
            btc_tip: 850_000,
            ..Default::default()
        };
        assert_eq!(decide(&rec, &v, &c), NextAction::LockZion);
    }

    #[test]
    fn btc_to_zion_fails_if_zion_timeout_passed() {
        let s = signer();
        let c = cfg();
        let rec = btc_to_zion_rec(&s, &c);
        let v = SwapView {
            btc_lock: lock(5),
            now_ts: 1_800_000_001, // past zion_timeout_ts
            btc_tip: 850_000,
            ..Default::default()
        };
        assert!(matches!(decide(&rec, &v, &c), NextAction::Fail(_)));
    }

    #[test]
    fn btc_to_zion_claims_btc_with_preimage() {
        let s = signer();
        let c = cfg();
        let mut rec = btc_to_zion_rec(&s, &c);
        rec.phase = BtcSwapPhase::Locked;
        rec.btc_lock = lock(3);
        rec.preimage = Some([0xAB; 32]);
        let v = SwapView {
            preimage: Some([0xAB; 32]),
            now_ts: 1_700_000_000,
            btc_tip: 850_000,
            ..Default::default()
        };
        assert_eq!(decide(&rec, &v, &c), NextAction::ClaimBtc);
    }

    #[test]
    fn btc_to_zion_refunds_zion_after_timeout() {
        let s = signer();
        let c = cfg();
        let mut rec = btc_to_zion_rec(&s, &c);
        rec.phase = BtcSwapPhase::Locked;
        rec.btc_lock = lock(3);
        let v = SwapView {
            now_ts: 1_800_000_001, // zion timeout passed, no preimage
            btc_tip: 850_000,
            ..Default::default()
        };
        assert_eq!(decide(&rec, &v, &c), NextAction::RefundZion);
    }

    #[test]
    fn zion_to_btc_refunds_after_cltv() {
        let s = signer();
        let c = cfg();
        let flow = BtcSwapFlow::new(
            Arc::new(BitcoinAdapter::new()),
            Arc::new(s.clone()),
            Arc::new(HtlcSwap::new_offline()),
            c.clone(),
        );
        let mut preimage = [0u8; 32];
        rand::rngs::OsRng.fill_bytes(&mut preimage);
        let hashlock: [u8; 32] = sha2::Sha256::digest(preimage).into();
        let mut rec = flow
            .offer_zion_to_btc(
                OfferZionToBtc {
                    hashlock,
                    zion_flowers: 50_000_000,
                    btc_sats: 100_000,
                    user_btc_claim: user_btc_key(),
                    user_zion_refund: [0x22; 32],
                    user_zion_lock_txid: "cc".repeat(32),
                    user_zion_address: "zion1user".into(),
                    zion_timeout_ts: 1_800_000_000,
                },
                1_700_000_000,
                850_000,
            )
            .unwrap();
        // BTC cltv = tip + zion_blocks(100M s / 600) − margin(36)
        //          = 850_000 + 166_666 − 36 = 1_016_630
        assert_eq!(rec.btc_htlc.cltv_timeout, 1_016_630);
        rec.phase = BtcSwapPhase::Locked;
        rec.btc_lock = lock(2);
        let v = SwapView {
            btc_tip: rec.btc_htlc.cltv_timeout as u64, // at expiry
            now_ts: 1_700_000_000,
            ..Default::default()
        };
        assert_eq!(decide(&rec, &v, &c), NextAction::RefundBtc);
    }

    #[test]
    fn zion_to_btc_claims_zion_on_user_claim() {
        let s = signer();
        let c = cfg();
        let flow = BtcSwapFlow::new(
            Arc::new(BitcoinAdapter::new()),
            Arc::new(s.clone()),
            Arc::new(HtlcSwap::new_offline()),
            c.clone(),
        );
        let mut preimage = [0u8; 32];
        rand::rngs::OsRng.fill_bytes(&mut preimage);
        let hashlock: [u8; 32] = sha2::Sha256::digest(preimage).into();
        let mut rec = flow
            .offer_zion_to_btc(
                OfferZionToBtc {
                    hashlock,
                    zion_flowers: 50_000_000,
                    btc_sats: 100_000,
                    user_btc_claim: user_btc_key(),
                    user_zion_refund: [0x22; 32],
                    user_zion_lock_txid: "cc".repeat(32),
                    user_zion_address: "zion1user".into(),
                    zion_timeout_ts: 1_800_000_000,
                },
                1_700_000_000,
                850_000,
            )
            .unwrap();
        rec.phase = BtcSwapPhase::Locked;
        rec.btc_lock = lock(2);
        let v = SwapView {
            btc_spend: Some(BtcHtlcSpend::Claim {
                txid: "dd".repeat(32),
                preimage,
            }),
            btc_tip: 850_100,
            now_ts: 1_700_000_000,
            ..Default::default()
        };
        assert_eq!(decide(&rec, &v, &c), NextAction::ClaimZion);
    }

    #[test]
    fn offer_rejects_past_zion_timeout() {
        let s = signer();
        let c = cfg();
        let flow = BtcSwapFlow::new(
            Arc::new(BitcoinAdapter::new()),
            Arc::new(s),
            Arc::new(HtlcSwap::new_offline()),
            c,
        );
        let err = flow.offer_btc_to_zion(
            OfferBtcToZion {
                hashlock: [0; 32],
                btc_sats: 1,
                zion_flowers: 1,
                user_btc_refund: user_btc_key(),
                user_zion_claim: [0; 32],
                user_zion_address: "zion1u".into(),
                zion_timeout_ts: 100,
            },
            1_700_000_000,
            850_000,
        );
        assert!(err.is_err());
    }

    // ── Persistence (C7b) ────────────────────────────────────────────────

    #[test]
    fn snapshot_roundtrip_preserves_record() {
        let s = signer();
        let c = cfg();
        let mut rec = btc_to_zion_rec(&s, &c);
        rec.btc_lock = lock(3);
        rec.preimage = Some([0x42; 32]);
        rec.zion_lock_tx = Some("bb".repeat(32));

        let snap = rec.to_snapshot();
        let json = serde_json::to_string(&snap).unwrap();
        let snap2: BtcSwapSnapshot = serde_json::from_str(&json).unwrap();
        let rec2 = BtcSwapRecord::from_snapshot(&snap2).unwrap();

        assert_eq!(rec2.swap_id, rec.swap_id);
        assert_eq!(rec2.direction, rec.direction);
        assert_eq!(rec2.phase, rec.phase);
        // Witness script round-trips byte-exact → same address + params.
        assert_eq!(
            rec2.btc_htlc.witness_script.as_bytes(),
            rec.btc_htlc.witness_script.as_bytes()
        );
        assert_eq!(rec2.btc_htlc.address.to_string(), rec.btc_htlc.address.to_string());
        assert_eq!(rec2.btc_htlc.cltv_timeout, rec.btc_htlc.cltv_timeout);
        assert_eq!(rec2.btc_lock.unwrap().txid, "aa".repeat(32));
        assert_eq!(rec2.preimage, Some([0x42; 32]));
        assert_eq!(rec2.zion_lock_tx, Some("bb".repeat(32)));
    }

    #[test]
    fn snapshot_rejects_corrupt_script() {
        let s = signer();
        let c = cfg();
        let rec = btc_to_zion_rec(&s, &c);
        let mut snap = rec.to_snapshot();
        snap.witness_script_hex = "deadbeef".into();
        assert!(BtcSwapRecord::from_snapshot(&snap).is_err());
    }

    #[tokio::test]
    async fn db_persist_and_reload() {
        use crate::db::Db;
        let db = Arc::new(Mutex::new(Db::open_in_memory().unwrap()));
        let s = signer();
        let c = cfg();

        let mut flow = BtcSwapFlow::new(
            Arc::new(BitcoinAdapter::new()),
            Arc::new(s.clone()),
            Arc::new(HtlcSwap::new_offline()),
            c.clone(),
        );
        flow.set_db(db.clone());
        let rec = btc_to_zion_rec(&s, &c);
        let swap_id = rec.swap_id.clone();
        flow.insert_record(rec).await;

        // Fresh flow on the same DB reloads the record.
        let mut flow2 = BtcSwapFlow::new(
            Arc::new(BitcoinAdapter::new()),
            Arc::new(s),
            Arc::new(HtlcSwap::new_offline()),
            c,
        );
        flow2.set_db(db);
        assert_eq!(flow2.load_from_db().await.unwrap(), 1);
        let rec2 = flow2.record(&swap_id).await.unwrap();
        assert_eq!(rec2.phase, BtcSwapPhase::AwaitingUserLock);
        assert_eq!(rec2.btc_sats, 100_000);
    }

    // ── Offer admission guards (hardening) ─────────────────────────────

    #[test]
    fn offer_rejects_out_of_band_amount() {
        let s = signer();
        let c = cfg(); // default limits: [2_000, 10_000_000]
        let flow = BtcSwapFlow::new(
            Arc::new(BitcoinAdapter::new()),
            Arc::new(s.clone()),
            Arc::new(HtlcSwap::new_offline()),
            c.clone(),
        );
        let mut preimage = [0u8; 32];
        rand::rngs::OsRng.fill_bytes(&mut preimage);
        let hashlock: [u8; 32] = sha2::Sha256::digest(preimage).into();
        for bad in [546u64, 1_999, 10_000_001, u64::MAX] {
            let r = flow.offer_btc_to_zion(
                OfferBtcToZion {
                    hashlock,
                    btc_sats: bad,
                    zion_flowers: 50_000_000,
                    user_btc_refund: user_btc_key(),
                    user_zion_claim: [0x22; 32],
                    user_zion_address: "zion1user".into(),
                    zion_timeout_ts: 1_800_000_000,
                },
                1_700_000_000,
                850_000,
            );
            assert!(r.is_err(), "amount {bad} should be rejected");
        }
        let ok = flow.offer_btc_to_zion(
            OfferBtcToZion {
                hashlock,
                btc_sats: 10_000_000,
                zion_flowers: 50_000_000,
                user_btc_refund: user_btc_key(),
                user_zion_claim: [0x22; 32],
                user_zion_address: "zion1user".into(),
                zion_timeout_ts: 1_800_000_000,
            },
            1_700_000_000,
            850_000,
        );
        assert!(ok.is_ok());
    }

    #[tokio::test]
    async fn offer_rejects_duplicate_hashlock() {
        let s = signer();
        let c = cfg();
        let flow = BtcSwapFlow::new(
            Arc::new(BitcoinAdapter::new()),
            Arc::new(s),
            Arc::new(HtlcSwap::new_offline()),
            c,
        );
        let mut preimage = [0u8; 32];
        rand::rngs::OsRng.fill_bytes(&mut preimage);
        let hashlock: [u8; 32] = sha2::Sha256::digest(preimage).into();
        flow.insert_record(btc_to_zion_rec_at(&signer(), &cfg(), hashlock)).await;
        let dup = flow
            .check_offer_admission(&hex::encode(hashlock))
            .await;
        assert!(dup.is_err());
    }

    #[tokio::test]
    async fn offer_caps_active_swaps() {
        let s = signer();
        let mut c = cfg();
        c.max_active_swaps = 2;
        let flow = BtcSwapFlow::new(
            Arc::new(BitcoinAdapter::new()),
            Arc::new(s.clone()),
            Arc::new(HtlcSwap::new_offline()),
            c,
        );
        for i in 0..2u8 {
            let mut rec = btc_to_zion_rec(&s, &cfg());
            rec.swap_id = format!("swap-{i}");
            flow.insert_record(rec).await;
        }
        let full = flow.check_offer_admission(&"ff".repeat(32)).await;
        assert!(full.is_err());
        // Terminal records don't count towards the cap.
        let mut done = btc_to_zion_rec(&s, &cfg());
        done.swap_id = "swap-0".into();
        done.phase = BtcSwapPhase::Settled;
        flow.insert_record(done).await;
        let ok = flow.check_offer_admission(&"ee".repeat(32)).await;
        assert!(ok.is_ok());
    }

    /// Helper: build a BtcToZion record with an explicit hashlock.
    fn btc_to_zion_rec_at(s: &BtcSigner, cfg: &BtcSwapConfig, hashlock: [u8; 32]) -> BtcSwapRecord {
        let flow = BtcSwapFlow::new(
            Arc::new(BitcoinAdapter::new()),
            Arc::new(s.clone()),
            Arc::new(HtlcSwap::new_offline()),
            cfg.clone(),
        );
        flow.offer_btc_to_zion(
            OfferBtcToZion {
                hashlock,
                btc_sats: 100_000,
                zion_flowers: 50_000_000,
                user_btc_refund: user_btc_key(),
                user_zion_claim: [0x22; 32],
                user_zion_address: "zion1user".into(),
                zion_timeout_ts: 1_800_000_000,
            },
            1_700_000_000,
            850_000,
        )
        .unwrap()
    }

    // ── User ZION lock verification (audit P1) ───────────────────────

    fn zion_to_btc_rec(s: &BtcSigner, c: &BtcSwapConfig, lock_txid: &str) -> BtcSwapRecord {
        let flow = BtcSwapFlow::new(
            Arc::new(BitcoinAdapter::new()),
            Arc::new(s.clone()),
            Arc::new(HtlcSwap::new_offline()),
            c.clone(),
        );
        flow.offer_zion_to_btc(
            OfferZionToBtc {
                hashlock: [0x33; 32],
                zion_flowers: 50_000_000,
                btc_sats: 10_000,
                user_btc_claim: user_btc_key(),
                user_zion_refund: [0x22; 32],
                user_zion_lock_txid: lock_txid.into(),
                user_zion_address: "zion1user".into(),
                zion_timeout_ts: 1_800_000_000,
            },
            1_700_000_000,
            850_000,
        )
        .unwrap()
    }

    fn utxo_json(txid: &str, script: &[u8], amount: u64) -> serde_json::Value {
        serde_json::json!({
            "tx_hash": txid,
            "output_index": 0,
            "amount": amount,
            "address": "zion1user",
            "script_hex": hex::encode(script),
            "block_height": 100,
            "is_coinbase": false,
        })
    }

    /// `getUtxos`/`getChainInfo` responder on an ephemeral port; returns `addr`.
    /// Reports tip height 1_000 so `block_height: 100` UTXOs pass the confs check.
    async fn mock_zion_rpc(utxos: serde_json::Value) -> String {
        use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap().to_string();
        tokio::spawn(async move {
            while let Ok((mut s, _)) = listener.accept().await {
                let mut line = String::new();
                let _ = BufReader::new(&mut s).read_line(&mut line).await;
                let method = serde_json::from_str::<serde_json::Value>(&line)
                    .ok()
                    .and_then(|v| v.get("method").and_then(|m| m.as_str()).map(str::to_string))
                    .unwrap_or_default();
                let result = if method == "getChainInfo" {
                    serde_json::json!({"chain_height": 1_000})
                } else {
                    serde_json::json!({"utxos": utxos.clone()})
                };
                let resp = serde_json::json!({"jsonrpc": "2.0", "id": 1, "result": result});
                let _ = s.write_all(format!("{resp}\n").as_bytes()).await;
                let _ = s.flush().await;
            }
        });
        addr
    }

    #[test]
    fn htlc_script_parse_roundtrip() {
        let (hashlock, claimant, refund) = ([0x11; 32], [0x22; 32], [0x33; 32]);
        let script = zion_core::v31_wallet::htlc_output_script(
            &hashlock, 1_800_000_000, &claimant, &refund,
        );
        let (h, t, c, r) = parse_htlc_script(&script).unwrap();
        assert_eq!(h, hashlock);
        assert_eq!(t, 1_800_000_000);
        assert_eq!(c, claimant);
        assert_eq!(r, refund);
        // Wrong length / wrong opcode are rejected.
        assert!(parse_htlc_script(&script[..104]).is_none());
        let mut bad = script.clone();
        bad[0] = 0x00;
        assert!(parse_htlc_script(&bad).is_none());
    }

    #[tokio::test]
    async fn verify_accepts_valid_user_lock() {
        let s = signer();
        let mut c = cfg();
        let rec = zion_to_btc_rec(&s, &c, &"ab".repeat(32));
        let script = zion_core::v31_wallet::htlc_output_script(
            &rec.btc_htlc.hashlock,
            rec.zion_timeout_ts,
            &c.operator_zion_pubkey,
            &rec.user_zion_pubkey,
        );
        let rpc = mock_zion_rpc(serde_json::json!([
            utxo_json(&"ab".repeat(32), &script, rec.zion_flowers)
        ]))
        .await;
        c.zion_rpc_url = Some(rpc);
        let flow = BtcSwapFlow::new(
            Arc::new(BitcoinAdapter::new()),
            Arc::new(s),
            Arc::new(HtlcSwap::new_offline()),
            c,
        );
        let check = flow.verify_user_zion_lock(&rec).await.unwrap();
        assert!(matches!(check, LockCheck::Verified));
    }

    #[tokio::test]
    async fn verify_waits_for_unseen_lock() {
        let s = signer();
        let mut c = cfg();
        // Fake txid → not in the UTXO set → keep waiting (never LockBtc).
        let rec = zion_to_btc_rec(&s, &c, &"ff".repeat(32));
        let rpc = mock_zion_rpc(serde_json::json!([])).await;
        c.zion_rpc_url = Some(rpc);
        let flow = BtcSwapFlow::new(
            Arc::new(BitcoinAdapter::new()),
            Arc::new(s),
            Arc::new(HtlcSwap::new_offline()),
            c,
        );
        let check = flow.verify_user_zion_lock(&rec).await.unwrap();
        assert!(matches!(check, LockCheck::NotFound));
    }

    #[tokio::test]
    async fn verify_rejects_malformed_locks() {
        let s = signer();
        let mut c = cfg();
        let rec = zion_to_btc_rec(&s, &c, &"ab".repeat(32));
        let good = zion_core::v31_wallet::htlc_output_script(
            &rec.btc_htlc.hashlock,
            rec.zion_timeout_ts,
            &c.operator_zion_pubkey,
            &rec.user_zion_pubkey,
        );
        let wrong_hashlock = zion_core::v31_wallet::htlc_output_script(
            &[0x99; 32],
            rec.zion_timeout_ts,
            &c.operator_zion_pubkey,
            &rec.user_zion_pubkey,
        );
        let wrong_claimant = zion_core::v31_wallet::htlc_output_script(
            &rec.btc_htlc.hashlock,
            rec.zion_timeout_ts,
            &[0x99; 32],
            &rec.user_zion_pubkey,
        );
        let wrong_refund = zion_core::v31_wallet::htlc_output_script(
            &rec.btc_htlc.hashlock,
            rec.zion_timeout_ts,
            &c.operator_zion_pubkey,
            &[0x99; 32],
        );
        let wrong_timeout = zion_core::v31_wallet::htlc_output_script(
            &rec.btc_htlc.hashlock,
            rec.zion_timeout_ts + 600,
            &c.operator_zion_pubkey,
            &rec.user_zion_pubkey,
        );
        let txid = "ab".repeat(32);
        let cases: Vec<(Vec<u8>, u64)> = vec![
            (vec![0x00; 20], rec.zion_flowers),   // not an HTLC script
            (wrong_hashlock, rec.zion_flowers),
            (wrong_claimant, rec.zion_flowers),
            (wrong_refund, rec.zion_flowers),
            (wrong_timeout, rec.zion_flowers),
            (good.clone(), rec.zion_flowers - 1), // underfunded
        ];
        for (i, (script, amount)) in cases.into_iter().enumerate() {
            let rpc = mock_zion_rpc(serde_json::json!([utxo_json(&txid, &script, amount)])).await;
            c.zion_rpc_url = Some(rpc);
            let flow = BtcSwapFlow::new(
                Arc::new(BitcoinAdapter::new()),
                Arc::new(s.clone()),
                Arc::new(HtlcSwap::new_offline()),
                c.clone(),
            );
            let check = flow.verify_user_zion_lock(&rec).await.unwrap();
            assert!(matches!(check, LockCheck::Invalid(_)), "case {i} must be Invalid");
        }
    }

    #[tokio::test]
    async fn verify_skips_without_rpc() {
        let s = signer();
        let c = cfg(); // zion_rpc_url: None
        let rec = zion_to_btc_rec(&s, &c, &"ab".repeat(32));
        let flow = BtcSwapFlow::new(
            Arc::new(BitcoinAdapter::new()),
            Arc::new(s),
            Arc::new(HtlcSwap::new_offline()),
            c,
        );
        let check = flow.verify_user_zion_lock(&rec).await.unwrap();
        assert!(matches!(check, LockCheck::Verified));
    }
}
