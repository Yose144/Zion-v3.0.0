//! Core HTLC types and memo parser.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

// ─── Newtype wrappers ────────────────────────────────────────────────────────

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
}

// ─── HTLC state machine ─────────────────────────────────────────────────────

/// Lifecycle state of a single HTLC record.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SwapState {
    /// LOCK TX seen on L1, waiting for counterparty to act.
    Pending,
    /// Preimage revealed; ZION released to claimer — terminal.
    Claimed,
    /// Timelock expired; ZION returned to locker — terminal.
    Refunded,
    /// Internal error during release; manual intervention needed.
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

// ─── HTLC record ─────────────────────────────────────────────────────────────

/// A single Hash-Time-Lock-Contract record stored in SQLite.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HtlcRecord {
    /// Hash H (hex) — primary key.
    pub hash_hex: String,

    /// L1 address that created the LOCK (gets refund if expired).
    pub locker_address: String,

    /// Amount locked in atomic units.
    pub amount_atomic: u64,

    /// L1 LOCK transaction ID.
    pub lock_tx_id: String,

    /// L1 block height where LOCK was confirmed.
    pub lock_block_height: u64,

    /// UNIX timestamp (secs) after which a refund may be issued.
    pub expires_at: i64,

    /// Counterparty chain identifier (e.g. `"btc"`, `"eth"`, `"base"`).
    pub counterparty_chain: String,

    /// Counterparty address (BTC address, EVM address, …).
    pub counterparty_addr: String,

    /// Current lifecycle state.
    pub state: SwapState,

    /// L1 TX hash of the CLAIM or REFUND release transaction.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub release_tx_id: Option<String>,

    /// Address that received the released ZION.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub release_recipient: Option<String>,

    /// Revealed preimage (hex) — set on claim.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preimage_hex: Option<String>,

    /// Wall-clock timestamp of record creation (ISO-8601).
    pub created_at: DateTime<Utc>,

    /// Wall-clock timestamp of last state transition.
    pub updated_at: DateTime<Utc>,
}

impl HtlcRecord {
    /// Returns true if the HTLC timelock has expired (refund eligible).
    pub fn is_expired(&self) -> bool {
        let now = Utc::now().timestamp();
        now >= self.expires_at
    }

    /// Returns true if the HTLC is in a terminal state.
    pub fn is_terminal(&self) -> bool {
        matches!(self.state, SwapState::Claimed | SwapState::Refunded)
    }
}

// ─── Memo parser ─────────────────────────────────────────────────────────────

/// A parsed L1 TX memo related to atomic swaps.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SwapMemo {
    /// `SWAP:LOCK:<hash_hex>:<timeout_min>:<chain>:<counterparty_addr>`
    Lock {
        hash_hex: String,
        timeout_minutes: u64,
        counterparty_chain: String,
        counterparty_addr: String,
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
    /// Parse a raw memo string.  Returns `None` if not a swap memo.
    pub fn parse(memo: &str) -> Option<Self> {
        let parts: Vec<&str> = memo.splitn(6, ':').collect();
        if parts.first() != Some(&"SWAP") {
            return None;
        }
        match parts.get(1).copied() {
            Some("LOCK") => {
                // SWAP:LOCK:<hash>:<timeout>:<chain>:<addr>
                let hash_hex = parts.get(2).map(|s| s.to_string())?;
                let timeout_minutes: u64 = parts.get(3)?.parse().ok()?;
                let counterparty_chain = parts.get(4).map(|s| s.to_string())?;
                let counterparty_addr = parts.get(5).map(|s| s.to_string())?;
                // Validate hash length (64 hex chars = 32 bytes)
                if hash_hex.len() != 64 || hex::decode(&hash_hex).is_err() {
                    return None;
                }
                // Sanity bounds
                if timeout_minutes == 0 || timeout_minutes > 10_080 {
                    // 0 … 7 days
                    return None;
                }
                Some(Self::Lock {
                    hash_hex,
                    timeout_minutes,
                    counterparty_chain,
                    counterparty_addr,
                })
            }
            Some("CLAIM") => {
                // SWAP:CLAIM:<hash>:<preimage>
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

// ─── L1 lightweight types (mirrored from L1/core) ───────────────────────────

/// Minimal L1 transaction output (deserialized from L1 RPC responses).
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct L1TxOutput {
    pub amount: u64,
    pub address: String,
    #[serde(default)]
    pub memo: Option<String>,
}

/// Minimal L1 transaction (deserialized from L1 RPC responses).
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct L1Transaction {
    pub id: String,
    pub version: u32,
    pub outputs: Vec<L1TxOutput>,
    pub fee: u64,
    pub timestamp: u64,
}

/// Minimal L1 block header (deserialized from /api/block/height/:h).
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct L1Block {
    pub height: u64,
    pub hash: String,
    pub transactions: Vec<L1Transaction>,
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preimage_hash_round_trip() {
        let preimage = SwapPreimage([42u8; 32]);
        let hash = preimage.hash();
        // SHA-256 of 32×0x2A bytes — deterministic
        let expected = {
            let mut h = Sha256::new();
            h.update([42u8; 32]);
            SwapHash(h.finalize().into())
        };
        assert_eq!(hash, expected);
    }

    #[test]
    fn parse_lock_memo() {
        let hash = "a".repeat(64);
        let memo = format!("SWAP:LOCK:{hash}:120:btc:bc1qtest");
        let parsed = SwapMemo::parse(&memo).unwrap();
        assert_eq!(
            parsed,
            SwapMemo::Lock {
                hash_hex: hash,
                timeout_minutes: 120,
                counterparty_chain: "btc".into(),
                counterparty_addr: "bc1qtest".into(),
            }
        );
    }

    #[test]
    fn parse_claim_memo() {
        let hash = "b".repeat(64);
        let preimage = "c".repeat(64);
        let memo = format!("SWAP:CLAIM:{hash}:{preimage}");
        let parsed = SwapMemo::parse(&memo).unwrap();
        assert_eq!(
            parsed,
            SwapMemo::Claim {
                hash_hex: hash,
                preimage_hex: preimage,
            }
        );
    }

    #[test]
    fn parse_refund_memo() {
        let hash = "d".repeat(64);
        let memo = format!("SWAP:REFUND:{hash}");
        let parsed = SwapMemo::parse(&memo).unwrap();
        assert_eq!(parsed, SwapMemo::Refund { hash_hex: hash });
    }

    #[test]
    fn invalid_memo_returns_none() {
        assert!(SwapMemo::parse("BRIDGE:base:0xabc").is_none());
        assert!(SwapMemo::parse("SWAP:UNKNOWN").is_none());
        // bad hash length
        assert!(SwapMemo::parse("SWAP:LOCK:abc:120:btc:addr").is_none());
    }
}
