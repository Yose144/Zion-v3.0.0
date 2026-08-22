//! HTLC (Hash Time-Lock Contract) atomic-swap coordinator.
//!
//! Ports the production V3 atomic-swap logic into the V31 multichain layer.
//! Instead of a standalone daemon, HTLC execution is driven through the
//! `ChainAdapter` trait — `initiate` locks on the source chain, `claim`
//! releases on the target chain after preimage verification, `refund`
//! returns funds after timelock expiry.
//!
//! Memo format (L1 account transactions):
//!   `SWAP:LOCK:<hash_hex>:<timeout_min>:<chain>:<addr>[:<claimant_zion>]`
//!   `SWAP:CLAIM:<hash_hex>:<preimage_hex>`
//!   `SWAP:REFUND:<hash_hex>`

use crate::chain::ChainAdapterRegistry;
use crate::db::Db;
use crate::error::{MultichainError, MultichainResult};
use crate::types::{Transfer, TransferDirection, TransferStatus};

use chrono::Utc;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use zion_l1_types::Hash;

// ---------------------------------------------------------------------------
// Hash / Preimage newtypes
// ---------------------------------------------------------------------------

/// 32-byte SHA-256 hash that locks the HTLC.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct SwapHash(pub [u8; 32]);

impl SwapHash {
    /// Parse from a 64-char hex string.
    pub fn from_hex(s: &str) -> Option<Self> {
        let bytes = hex::decode(s).ok()?;
        let arr: [u8; 32] = bytes.try_into().ok()?;
        Some(Self(arr))
    }

    pub fn to_hex(&self) -> String {
        hex::encode(self.0)
    }
}

impl From<Hash> for SwapHash {
    fn from(h: Hash) -> Self {
        Self(h.0)
    }
}

impl From<SwapHash> for Hash {
    fn from(h: SwapHash) -> Self {
        Hash::new(h.0)
    }
}

/// 32-byte preimage that unlocks the HTLC (`SHA-256(preimage) == hash`).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwapPreimage(pub [u8; 32]);

impl SwapPreimage {
    /// Parse from a hex string (32 bytes = 64 chars).
    pub fn from_hex(s: &str) -> Option<Self> {
        let bytes = hex::decode(s).ok()?;
        let arr: [u8; 32] = bytes.try_into().ok()?;
        Some(Self(arr))
    }

    pub fn to_hex(&self) -> String {
        hex::encode(self.0)
    }

    /// Hash this preimage with SHA-256 and return the resulting [`SwapHash`].
    pub fn hash(&self) -> SwapHash {
        let mut h = Sha256::new();
        h.update(self.0);
        SwapHash(h.finalize().into())
    }

    /// Generate a random preimage (for testing / CLI `create` command).
    pub fn random() -> Self {
        let mut bytes = [0u8; 32];
        // Use SHA-256 of timestamp + counter as a cheap CSPRNG substitute.
        // Real callers should use `rand::rngs::OsRng` — kept minimal here to
        // avoid adding a `rand` dependency to the multichain crate.
        let now = Utc::now().timestamp_nanos_opt().unwrap_or(0);
        let mut h = Sha256::new();
        h.update(now.to_le_bytes());
        h.update(b"zion-htlc-preimage-v31");
        bytes.copy_from_slice(&h.finalize());
        Self(bytes)
    }
}

// ---------------------------------------------------------------------------
// HTLC state machine
// ---------------------------------------------------------------------------

/// Lifecycle state of a single HTLC record.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SwapState {
    /// LOCK TX seen, waiting for counterparty to act.
    Pending,
    /// Preimage revealed; funds released to claimer — terminal.
    Claimed,
    /// Timelock expired; funds returned to locker — terminal.
    Refunded,
    /// Internal error during execution; manual intervention needed.
    Error(String),
}

impl std::fmt::Display for SwapState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Pending => write!(f, "pending"),
            Self::Claimed => write!(f, "claimed"),
            Self::Refunded => write!(f, "refunded"),
            Self::Error(e) => write!(f, "error:{e}"),
        }
    }
}

// ---------------------------------------------------------------------------
// HTLC record
// ---------------------------------------------------------------------------

/// A single Hash-Time-Lock-Contract record.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HtlcRecord {
    /// Hash H (hex) — primary key.
    pub hash_hex: String,
    /// Address that created the LOCK (gets refund if expired).
    pub locker_address: String,
    /// Amount locked in atomic units.
    pub amount: u64,
    /// LOCK transaction ID.
    pub lock_tx_id: String,
    /// Block height where LOCK was confirmed.
    pub lock_block_height: u64,
    /// UNIX timestamp (secs) after which a refund may be issued.
    pub expires_at: i64,
    /// Counterparty chain identifier (e.g. `"btc"`, `"eth"`, `"base"`).
    pub counterparty_chain: String,
    /// Counterparty address.
    pub counterparty_addr: String,
    /// Optional pre-committed claimant address. When set at LOCK time, only
    /// this address may receive the released funds on CLAIM — prevents
    /// front-running by observers who steal the preimage from the
    /// counterparty chain.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub claimant_address: Option<String>,
    /// Current lifecycle state.
    pub state: SwapState,
    /// TX hash of the CLAIM or REFUND release transaction.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub release_tx_id: Option<String>,
    /// Address that received the released funds.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub release_recipient: Option<String>,
    /// Revealed preimage (hex) — set on claim.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preimage_hex: Option<String>,
    /// Wall-clock timestamp of record creation (ISO-8601).
    pub created_at: chrono::DateTime<Utc>,
    /// Wall-clock timestamp of last state transition.
    pub updated_at: chrono::DateTime<Utc>,
}

impl HtlcRecord {
    /// Returns true if the HTLC timelock has expired (refund eligible).
    pub fn is_expired(&self) -> bool {
        Utc::now().timestamp() >= self.expires_at
    }

    /// Returns true if the HTLC is in a terminal state.
    pub fn is_terminal(&self) -> bool {
        matches!(self.state, SwapState::Claimed | SwapState::Refunded)
    }
}

// ---------------------------------------------------------------------------
// Memo parser
// ---------------------------------------------------------------------------

/// A parsed L1 TX memo related to atomic swaps.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SwapMemo {
    /// `SWAP:LOCK:<hash_hex>:<timeout_min>:<chain>:<addr>[:<claimant_zion>]`
    Lock {
        hash_hex: String,
        timeout_minutes: u64,
        counterparty_chain: String,
        counterparty_addr: String,
        claimant_address: Option<String>,
    },
    /// `SWAP:CLAIM:<hash_hex>:<preimage_hex>`
    Claim {
        hash_hex: String,
        preimage_hex: String,
    },
    /// `SWAP:REFUND:<hash_hex>`
    Refund { hash_hex: String },
}

impl SwapMemo {
    /// Parse a raw memo string. Returns `None` if not a swap memo.
    pub fn parse(memo: &str) -> Option<Self> {
        let parts: Vec<&str> = memo.splitn(7, ':').collect();
        if parts.first() != Some(&"SWAP") {
            return None;
        }
        match parts.get(1).copied() {
            Some("LOCK") => {
                let hash_hex = parts.get(2).map(|s| s.to_string())?;
                let timeout_minutes: u64 = parts.get(3)?.parse().ok()?;
                let counterparty_chain = parts.get(4).map(|s| s.to_string())?;
                let counterparty_addr = parts.get(5).map(|s| s.to_string())?;
                // Validate hash length (64 hex chars = 32 bytes)
                if hash_hex.len() != 64 || hex::decode(&hash_hex).is_err() {
                    return None;
                }
                // Sanity bounds: 1 min .. 7 days
                if timeout_minutes == 0 || timeout_minutes > 10_080 {
                    return None;
                }
                // Optional pre-committed claimant address (6th field).
                let claimant_address = parts.get(6).and_then(|s| {
                    let t = s.trim();
                    if t.starts_with("zion1") && t.len() >= 8 {
                        Some(t.to_string())
                    } else {
                        None
                    }
                });
                Some(Self::Lock {
                    hash_hex,
                    timeout_minutes,
                    counterparty_chain,
                    counterparty_addr,
                    claimant_address,
                })
            }
            Some("CLAIM") => {
                let hash_hex = parts.get(2).map(|s| s.to_string())?;
                let preimage_hex = parts.get(3).map(|s| s.to_string())?;
                if hash_hex.len() != 64 || hex::decode(&hash_hex).is_err() {
                    return None;
                }
                if preimage_hex.len() != 64 || hex::decode(&preimage_hex).is_err() {
                    return None;
                }
                Some(Self::Claim {
                    hash_hex,
                    preimage_hex,
                })
            }
            Some("REFUND") => {
                let hash_hex = parts.get(2).map(|s| s.to_string())?;
                if hash_hex.len() != 64 || hex::decode(&hash_hex).is_err() {
                    return None;
                }
                Some(Self::Refund { hash_hex })
            }
            _ => None,
        }
    }
}

// ---------------------------------------------------------------------------
// HTLC coordinator
// ---------------------------------------------------------------------------

/// HTLC atomic-swap coordinator with on-chain execution via `ChainAdapter`.
///
/// Records are persisted to SQLite if `db` is provided, otherwise kept
/// in memory (useful for tests and dev mode).
pub struct HtlcSwap {
    records: Arc<Mutex<HashMap<String, HtlcRecord>>>,
    adapters: Arc<ChainAdapterRegistry>,
    db: Option<Arc<Mutex<Db>>>,
}

impl HtlcSwap {
    /// Create a new coordinator backed by the given adapter registry.
    pub fn new(adapters: Arc<ChainAdapterRegistry>) -> Self {
        Self {
            records: Arc::new(Mutex::new(HashMap::new())),
            adapters,
            db: None,
        }
    }

    /// Create a coordinator with an optional database for persistence.
    pub fn with_db(adapters: Arc<ChainAdapterRegistry>, db: Arc<Mutex<Db>>) -> Self {
        Self {
            records: Arc::new(Mutex::new(HashMap::new())),
            adapters,
            db: Some(db),
        }
    }

    /// Create a coordinator with no adapters (for unit tests of pure logic).
    pub fn new_offline() -> Self {
        Self {
            records: Arc::new(Mutex::new(HashMap::new())),
            adapters: Arc::new(ChainAdapterRegistry::new()),
            db: None,
        }
    }

    /// Set the database after construction.
    pub fn set_db(&mut self, db: Arc<Mutex<Db>>) {
        self.db = Some(db);
    }

    /// Persist a record to the DB if configured.
    async fn persist(&self, record: &HtlcRecord) {
        if let Some(db) = &self.db {
            if let Err(e) = db.lock().await.save_htlc(record) {
                tracing::warn!(
                    "[HtlcSwap] failed to persist record {}: {}",
                    record.hash_hex,
                    e
                );
            }
        }
    }

    /// Load all records from DB into memory.
    pub async fn load_from_db(&self) -> MultichainResult<()> {
        let db = self
            .db
            .as_ref()
            .ok_or_else(|| MultichainError::Internal("no HTLC database configured".to_string()))?;
        let stored = db.lock().await.list_htlc()?;
        let mut records = self.records.lock().await;
        for r in stored {
            records.insert(r.hash_hex.clone(), r);
        }
        Ok(())
    }

    // ── Initiate (lock funds on source chain) ──────────────────────────

    /// Initiate an HTLC by locking funds on the source chain.
    ///
    /// Records the HTLC and calls `execute_outbound` on the source chain
    /// adapter to lock the funds.
    pub async fn initiate(&self, transfer: &mut Transfer) -> MultichainResult<Hash> {
        if transfer.direction != TransferDirection::Htlc {
            return Err(MultichainError::Unsupported(
                "HTLC initiate called on non-HTLC transfer".to_string(),
            ));
        }
        let hashlock = transfer
            .hashlock
            .ok_or_else(|| MultichainError::Validation("HTLC requires hashlock".to_string()))?;
        let timelock = transfer
            .timelock
            .ok_or_else(|| MultichainError::Validation("HTLC requires timelock".to_string()))?;

        let now = Utc::now().timestamp() as u64;
        if timelock <= now {
            return Err(MultichainError::Validation(format!(
                "HTLC timelock must be in the future (now={now}, timelock={timelock})"
            )));
        }

        let hash_hex = hashlock.to_hex();

        // Execute the lock on the source chain via adapter.
        let source_chain = transfer.source.address.chain;
        let lock_tx = if let Some(adapter) = self.adapters.get(source_chain) {
            adapter.execute_outbound(transfer).await?
        } else {
            // Offline mode (tests): synthesize a fake tx hash.
            Hash::new(Sha256::digest(format!("lock:{hash_hex}").as_bytes()).into())
        };

        let record = HtlcRecord {
            hash_hex: hash_hex.clone(),
            locker_address: transfer.source.address.to_string(),
            amount: transfer.source.amount.0 as u64,
            lock_tx_id: lock_tx.to_hex(),
            lock_block_height: 0,
            expires_at: timelock as i64,
            counterparty_chain: format!("{:?}", transfer.target.address.chain),
            counterparty_addr: transfer.target.address.to_string(),
            claimant_address: None,
            state: SwapState::Pending,
            release_tx_id: None,
            release_recipient: None,
            preimage_hex: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        self.records
            .lock()
            .await
            .insert(hash_hex.clone(), record.clone());
        self.persist(&record).await;
        transfer.status = TransferStatus::Executing;
        Ok(hashlock)
    }

    // ── Claim (release funds after preimage verification) ───────────────

    /// Claim the HTLC by revealing the preimage.
    ///
    /// Verifies `SHA-256(preimage) == hashlock`, checks the claimant address
    /// if pre-committed, then releases funds on the target chain via
    /// `execute_outbound`.
    pub async fn claim(
        &self,
        secret: &[u8],
        recipient: &str,
        transfer: &mut Transfer,
    ) -> MultichainResult<()> {
        let hashlock = transfer
            .hashlock
            .ok_or_else(|| MultichainError::Validation("HTLC missing hashlock".to_string()))?;

        // 1. Verify preimage.
        let actual = hash_sha256(secret);
        if actual != hashlock {
            return Err(MultichainError::Validation(
                "HTLC secret does not match hashlock".to_string(),
            ));
        }

        // 2. Look up record.
        let hash_hex = hashlock.to_hex();
        let mut records = self.records.lock().await;
        let record = records
            .get_mut(&hash_hex)
            .ok_or_else(|| MultichainError::TransferNotFound(hash_hex.clone()))?;

        // 3. Guard: already settled?
        if record.is_terminal() {
            return Err(MultichainError::Validation(format!(
                "HTLC already settled: {}",
                record.state
            )));
        }

        // 4. Guard: timelock expired?
        if record.is_expired() {
            return Err(MultichainError::Validation(format!(
                "HTLC timelock expired for {hash_hex}"
            )));
        }

        // 5. Guard: pre-committed claimant (C1 security patch).
        if let Some(ref expected) = record.claimant_address {
            if expected != recipient {
                return Err(MultichainError::Validation(format!(
                    "recipient {recipient} does not match committed claimant {expected}"
                )));
            }
        }

        // 6. Release funds on target chain via adapter.
        let preimage_hex = hex::encode(secret);
        transfer.preimage = Some(hash_sha256(secret));
        let target_chain = transfer.target.address.chain;
        let release_tx = if let Some(adapter) = self.adapters.get(target_chain) {
            adapter.execute_outbound(transfer).await?
        } else {
            // Offline mode (tests): synthesize a fake tx hash.
            Hash::new(Sha256::digest(format!("claim:{hash_hex}").as_bytes()).into())
        };

        // 7. Persist state.
        record.state = SwapState::Claimed;
        record.release_tx_id = Some(release_tx.to_hex());
        record.release_recipient = Some(recipient.to_string());
        record.preimage_hex = Some(preimage_hex);
        record.updated_at = Utc::now();

        // Need to drop the records guard before persist() can acquire it.
        let record = record.clone();
        drop(records);
        self.records
            .lock()
            .await
            .insert(hash_hex.clone(), record.clone());
        self.persist(&record).await;

        transfer.status = TransferStatus::Completed;
        Ok(())
    }

    // ── Refund (return funds after timelock expiry) ─────────────────────

    /// Refund the HTLC after timelock expiry.
    ///
    /// Verifies the timelock has expired, then returns funds to the locker
    /// via `execute_outbound` on the source chain.
    pub async fn refund(&self, transfer: &mut Transfer) -> MultichainResult<()> {
        let hashlock = transfer
            .hashlock
            .ok_or_else(|| MultichainError::Validation("HTLC missing hashlock".to_string()))?;
        let timelock = transfer
            .timelock
            .ok_or_else(|| MultichainError::Validation("HTLC missing timelock".to_string()))?;

        let now = Utc::now().timestamp() as u64;
        if now < timelock {
            return Err(MultichainError::Validation(format!(
                "HTLC timelock not expired ({now} < {timelock})"
            )));
        }

        let hash_hex = hashlock.to_hex();
        let mut records = self.records.lock().await;
        let record = records
            .get_mut(&hash_hex)
            .ok_or_else(|| MultichainError::TransferNotFound(hash_hex.clone()))?;

        if record.is_terminal() {
            return Err(MultichainError::Validation(format!(
                "HTLC already settled: {}",
                record.state
            )));
        }

        // Refund to locker on source chain.
        let source_chain = transfer.source.address.chain;
        let release_tx = if let Some(adapter) = self.adapters.get(source_chain) {
            adapter.execute_outbound(transfer).await?
        } else {
            Hash::new(Sha256::digest(format!("refund:{hash_hex}").as_bytes()).into())
        };

        record.state = SwapState::Refunded;
        record.release_tx_id = Some(release_tx.to_hex());
        record.release_recipient = Some(record.locker_address.clone());
        record.updated_at = Utc::now();

        // Need to drop the records guard before persist() can acquire it.
        let record = record.clone();
        drop(records);
        self.records
            .lock()
            .await
            .insert(hash_hex.clone(), record.clone());
        self.persist(&record).await;

        transfer.status = TransferStatus::Refunded;
        Ok(())
    }

    // ── Query helpers ───────────────────────────────────────────────────

    /// Look up an HTLC record by hash.
    pub async fn get_record(&self, hash_hex: &str) -> Option<HtlcRecord> {
        self.records.lock().await.get(hash_hex).cloned()
    }

    /// List all pending HTLCs (for auto-refund loop).
    pub async fn pending_records(&self) -> Vec<HtlcRecord> {
        self.records
            .lock()
            .await
            .values()
            .filter(|r| r.state == SwapState::Pending)
            .cloned()
            .collect()
    }

    /// List all expired pending HTLCs (refund candidates).
    pub async fn expired_pending(&self) -> Vec<HtlcRecord> {
        self.records
            .lock()
            .await
            .values()
            .filter(|r| r.state == SwapState::Pending && r.is_expired())
            .cloned()
            .collect()
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn hash_sha256(data: &[u8]) -> Hash {
    Hash::new(Sha256::digest(data).into())
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::TransferEndpoint;
    use zion_l1_types::{Address, Amount, Asset, ChainId};

    /// Build an HTLC transfer with a far-future timelock (year 2099).
    fn htlc_transfer(secret: &[u8]) -> Transfer {
        htlc_transfer_with_timelock(secret, 4_077_782_400) // 2099-01-01
    }

    /// Build an HTLC transfer with an explicit timelock.
    fn htlc_transfer_with_timelock(secret: &[u8], timelock: u64) -> Transfer {
        let hashlock = hash_sha256(secret);
        let source = TransferEndpoint {
            address: Address::new(ChainId::Bitcoin, vec![0u8; 20], "bc1qtest").unwrap(),
            asset: Asset::native(ChainId::Bitcoin, "BTC", 8, "Bitcoin"),
            amount: Amount::new(1000),
        };
        let target = TransferEndpoint {
            address: Address::new(ChainId::Ethereum, vec![0u8; 20], "0xdead").unwrap(),
            asset: Asset::native(ChainId::Ethereum, "ETH", 18, "Ether"),
            amount: Amount::new(1000),
        };
        let mut t = Transfer::new("htlc-1", TransferDirection::Htlc, source, target);
        t.hashlock = Some(hashlock);
        t.timelock = Some(timelock);
        t
    }

    #[tokio::test]
    async fn htlc_initiate_claim_succeeds() {
        let secret = b"preimage";
        let mut transfer = htlc_transfer(secret);
        let swap = HtlcSwap::new_offline();

        swap.initiate(&mut transfer).await.unwrap();
        assert_eq!(transfer.status, TransferStatus::Executing);

        swap.claim(secret, "0xdead", &mut transfer).await.unwrap();
        assert_eq!(transfer.status, TransferStatus::Completed);

        let record = swap
            .get_record(&hash_sha256(secret).to_hex())
            .await
            .unwrap();
        assert_eq!(record.state, SwapState::Claimed);
        assert_eq!(record.preimage_hex, Some(hex::encode(secret)));
    }

    #[tokio::test]
    async fn htlc_claim_fails_with_invalid_secret() {
        let secret = b"preimage";
        let mut transfer = htlc_transfer(secret);
        let swap = HtlcSwap::new_offline();

        swap.initiate(&mut transfer).await.unwrap();
        let err = swap.claim(b"wrong", "0xdead", &mut transfer).await;
        assert!(matches!(err, Err(MultichainError::Validation(_))));
    }

    #[tokio::test]
    async fn htlc_refund_fails_before_timelock() {
        let mut transfer = htlc_transfer(b"preimage");
        let swap = HtlcSwap::new_offline();

        swap.initiate(&mut transfer).await.unwrap();
        let err = swap.refund(&mut transfer).await;
        assert!(matches!(err, Err(MultichainError::Validation(_))));
    }

    #[tokio::test]
    async fn htlc_refund_succeeds_after_timelock() {
        let secret = b"preimage";
        let mut transfer = htlc_transfer(secret);
        let swap = HtlcSwap::new_offline();

        swap.initiate(&mut transfer).await.unwrap();

        // Force the record's expires_at into the past to simulate timeout.
        let hash_hex = hash_sha256(secret).to_hex();
        swap.records
            .lock()
            .await
            .get_mut(&hash_hex)
            .unwrap()
            .expires_at = 0;
        // Mirror in transfer so refund() timelock check passes.
        transfer.timelock = Some(1);

        swap.refund(&mut transfer).await.unwrap();
        assert_eq!(transfer.status, TransferStatus::Refunded);
    }

    #[tokio::test]
    async fn htlc_claim_fails_after_refund() {
        let secret = b"preimage";
        let mut transfer = htlc_transfer(secret);
        let swap = HtlcSwap::new_offline();

        swap.initiate(&mut transfer).await.unwrap();

        // Force expiry.
        let hash_hex = hash_sha256(secret).to_hex();
        swap.records
            .lock()
            .await
            .get_mut(&hash_hex)
            .unwrap()
            .expires_at = 0;
        transfer.timelock = Some(1);

        swap.refund(&mut transfer).await.unwrap();

        let err = swap.claim(secret, "0xdead", &mut transfer).await;
        assert!(matches!(err, Err(MultichainError::Validation(_))));
    }

    #[tokio::test]
    async fn htlc_claimant_address_enforced() {
        let secret = b"preimage";
        let mut transfer = htlc_transfer(secret);
        let swap = HtlcSwap::new_offline();

        swap.initiate(&mut transfer).await.unwrap();

        // Inject a pre-committed claimant.
        let hash_hex = hash_sha256(secret).to_hex();
        swap.records
            .lock()
            .await
            .get_mut(&hash_hex)
            .unwrap()
            .claimant_address = Some("zion1claimant".to_string());

        // Wrong recipient → rejected.
        let err = swap.claim(secret, "0xwrong", &mut transfer).await;
        assert!(matches!(err, Err(MultichainError::Validation(_))));

        // Correct recipient → accepted.
        swap.claim(secret, "zion1claimant", &mut transfer)
            .await
            .unwrap();
        assert_eq!(transfer.status, TransferStatus::Completed);
    }

    #[tokio::test]
    async fn htlc_expired_pending_returns_expired_only() {
        let swap = HtlcSwap::new_offline();

        // Expired record.
        let mut t1 = htlc_transfer(b"secret1");
        swap.initiate(&mut t1).await.unwrap();
        let h1 = hash_sha256(b"secret1").to_hex();
        swap.records.lock().await.get_mut(&h1).unwrap().expires_at = 0;

        // Active record.
        let mut t2 = htlc_transfer(b"secret2");
        swap.initiate(&mut t2).await.unwrap();

        let expired = swap.expired_pending().await;
        assert_eq!(expired.len(), 1);
        assert_eq!(expired[0].hash_hex, h1);
    }

    // ── Memo parser tests ───────────────────────────────────────────────

    #[test]
    fn memo_parse_lock() {
        let hash = "a".repeat(64);
        let memo = format!("SWAP:LOCK:{hash}:60:btc:bc1qxyz");
        let parsed = SwapMemo::parse(&memo).unwrap();
        match parsed {
            SwapMemo::Lock {
                hash_hex,
                timeout_minutes,
                counterparty_chain,
                counterparty_addr,
                claimant_address,
            } => {
                assert_eq!(hash_hex, hash);
                assert_eq!(timeout_minutes, 60);
                assert_eq!(counterparty_chain, "btc");
                assert_eq!(counterparty_addr, "bc1qxyz");
                assert!(claimant_address.is_none());
            }
            _ => panic!("expected Lock"),
        }
    }

    #[test]
    fn memo_parse_lock_with_claimant() {
        let hash = "b".repeat(64);
        let memo = format!("SWAP:LOCK:{hash}:120:base:0xabc:zion1claimant");
        let parsed = SwapMemo::parse(&memo).unwrap();
        match parsed {
            SwapMemo::Lock {
                claimant_address, ..
            } => {
                assert_eq!(claimant_address, Some("zion1claimant".to_string()));
            }
            _ => panic!("expected Lock"),
        }
    }

    #[test]
    fn memo_parse_claim() {
        let hash = "c".repeat(64);
        let preimage = "d".repeat(64);
        let memo = format!("SWAP:CLAIM:{hash}:{preimage}");
        let parsed = SwapMemo::parse(&memo).unwrap();
        match parsed {
            SwapMemo::Claim {
                hash_hex,
                preimage_hex,
            } => {
                assert_eq!(hash_hex, hash);
                assert_eq!(preimage_hex, preimage);
            }
            _ => panic!("expected Claim"),
        }
    }

    #[test]
    fn memo_parse_refund() {
        let hash = "e".repeat(64);
        let memo = format!("SWAP:REFUND:{hash}");
        let parsed = SwapMemo::parse(&memo).unwrap();
        match parsed {
            SwapMemo::Refund { hash_hex } => assert_eq!(hash_hex, hash),
            _ => panic!("expected Refund"),
        }
    }

    #[test]
    fn memo_parse_rejects_invalid() {
        assert!(SwapMemo::parse("not a swap").is_none());
        assert!(SwapMemo::parse("SWAP:UNKNOWN:stuff").is_none());
        // Short hash
        assert!(SwapMemo::parse("SWAP:LOCK:abc:60:btc:bc1qxyz").is_none());
        // Zero timeout
        let hash = "f".repeat(64);
        assert!(SwapMemo::parse(&format!("SWAP:LOCK:{hash}:0:btc:bc1qxyz")).is_none());
        // Timeout > 7 days
        assert!(SwapMemo::parse(&format!("SWAP:LOCK:{hash}:10081:btc:bc1qxyz")).is_none());
    }

    #[test]
    fn memo_parse_rejects_non_swap_prefix() {
        assert!(SwapMemo::parse("BRIDGE:LOCK:abc").is_none());
    }

    // ── SwapHash / SwapPreimage tests ────────────────────────────────────

    #[test]
    fn swap_hash_roundtrip() {
        let preimage = SwapPreimage::random();
        let hash = preimage.hash();
        let hex = hash.to_hex();
        let recovered = SwapHash::from_hex(&hex).unwrap();
        assert_eq!(hash, recovered);
    }

    #[test]
    fn swap_preimage_hash_is_deterministic() {
        let preimage = SwapPreimage([0xAB; 32]);
        let h1 = preimage.hash();
        let h2 = preimage.hash();
        assert_eq!(h1, h2);
    }

    #[test]
    fn swap_preimage_hex_roundtrip() {
        let preimage = SwapPreimage([0x42; 32]);
        let hex = preimage.to_hex();
        let recovered = SwapPreimage::from_hex(&hex).unwrap();
        assert_eq!(preimage.0, recovered.0);
    }

    // ── HTLC persistence tests ─────────────────────────────────────────────

    #[tokio::test]
    async fn htlc_persists_and_reloads_from_db() {
        use crate::db::Db;
        use std::sync::Arc;
        use tokio::sync::Mutex;

        let db = Arc::new(Mutex::new(Db::open_in_memory().unwrap()));
        let preimage = SwapPreimage::random();
        let hash = preimage.hash();
        let secret = preimage.0;

        // First coordinator creates a record.
        {
            let swap = HtlcSwap::with_db(Arc::new(ChainAdapterRegistry::new()), db.clone());
            let mut transfer = htlc_transfer_with_timelock(&secret, 4_077_782_400);
            swap.initiate(&mut transfer).await.unwrap();

            let record = swap.get_record(&hash.to_hex()).await.unwrap();
            assert_eq!(record.state, SwapState::Pending);

            // Advance to claimed with same preimage.
            swap.claim(&secret, "recipient1", &mut transfer)
                .await
                .unwrap();

            let record = swap.get_record(&hash.to_hex()).await.unwrap();
            assert_eq!(record.state, SwapState::Claimed);
        }

        // Second coordinator loads the same DB.
        {
            let swap = HtlcSwap::with_db(Arc::new(ChainAdapterRegistry::new()), db.clone());
            swap.load_from_db().await.unwrap();
            let record = swap.get_record(&hash.to_hex()).await.unwrap();
            assert_eq!(record.state, SwapState::Claimed);
            assert_eq!(record.release_recipient, Some("recipient1".to_string()));
            assert_eq!(record.preimage_hex, Some(preimage.to_hex()));
        }
    }

    #[tokio::test]
    async fn htlc_refund_persists_to_db() {
        use crate::db::Db;
        use std::sync::Arc;
        use tokio::sync::Mutex;

        let db = Arc::new(Mutex::new(Db::open_in_memory().unwrap()));
        let preimage = SwapPreimage::random();
        let hash = preimage.hash();
        let secret = preimage.0;

        let swap = HtlcSwap::with_db(Arc::new(ChainAdapterRegistry::new()), db);
        let mut transfer = htlc_transfer_with_timelock(&secret, 4_077_782_400);
        swap.initiate(&mut transfer).await.unwrap();

        // Force record and transfer timelock to the past so refund() passes.
        swap.records
            .lock()
            .await
            .get_mut(&hash.to_hex())
            .unwrap()
            .expires_at = 0;
        transfer.timelock = Some(0);

        swap.refund(&mut transfer).await.unwrap();

        let record = swap.get_record(&hash.to_hex()).await.unwrap();
        assert_eq!(record.state, SwapState::Refunded);
        assert_eq!(record.preimage_hex, None);
    }
}
