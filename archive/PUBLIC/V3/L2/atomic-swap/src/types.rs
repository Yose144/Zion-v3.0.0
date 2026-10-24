//! Core HTLC types and V3 RPC helpers.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

// Re-export shared helpers from zion-l1-types (eliminates duplication across
// bridge / dao / atomic-swap watchers).
pub use zion_l1_types::{bytes_to_hex, normalize_rpc_addr, zion_address_from_public_key};

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
    pub amount_flowers: u64,

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

    /// Optional pre-committed ZION L1 claimant address. When set at LOCK
    /// time, only this address may receive the released ZION on CLAIM —
    /// prevents front-running by observers who steal the preimage from the
    /// counterparty chain. When `None` (legacy memos), claims are still
    /// accepted but mainnet requires `bearer_token` auth on the HTTP API.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub claimant_address: Option<String>,

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
    /// `SWAP:LOCK:<hash_hex>:<timeout_min>:<chain>:<counterparty_addr>[:<claimant_zion>]`
    ///
    /// The optional 6th field `<claimant_zion>` pre-commits the ZION L1
    /// address that may receive the claim. Recommended for all new locks;
    /// when absent (legacy), mainnet enforces bearer_token auth instead.
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
    /// Parse a raw memo string.  Returns `None` if not a swap memo.
    pub fn parse(memo: &str) -> Option<Self> {
        let parts: Vec<&str> = memo.splitn(7, ':').collect();
        if parts.first() != Some(&"SWAP") {
            return None;
        }
        match parts.get(1).copied() {
            Some("LOCK") => {
                // SWAP:LOCK:<hash>:<timeout>:<chain>:<addr>[:<claimant_zion>]
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
                // Optional pre-committed claimant ZION address (6th field).
                // Must be a non-empty zion1 address; otherwise ignored.
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

// ─── L1 lightweight types (mirrored from V3/L1/core) ────────────────────────

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct RpcResponse<T> {
    pub result: Option<T>,
    #[serde(default)]
    pub error: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct L1ChainInfo {
    pub chain_height: u64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct L1TxInput {
    pub prev_tx_hash: [u8; 32],
    pub output_index: u32,
    pub signature: Vec<u8>,
    pub public_key: Vec<u8>,
}

/// Minimal L1 transaction output (deserialized from L1 RPC responses).
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct L1TxOutput {
    pub amount: u64,
    pub address: String,
    #[serde(default)]
    pub memo: Option<String>,
}

/// Minimal L1 UTXO transaction (deserialized from L1 RPC responses).
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct L1UtxoTransaction {
    pub id: [u8; 32],
    pub version: u32,
    #[serde(default)]
    pub inputs: Vec<L1TxInput>,
    pub outputs: Vec<L1TxOutput>,
    pub fee: u64,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct L1SpendableUtxo {
    pub tx_hash: String,
    pub output_index: u32,
    pub amount: u64,
    pub address: String,
    pub height: u64,
}

/// Minimal L1 account transaction (deserialized from getBlockByHeight).
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct L1AccountTransaction {
    pub tx_id: String,
    pub from: String,
    pub to: String,
    pub amount_zion: u128,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub memo: Option<String>,
}

/// Minimal L1 block header (deserialized from getBlockByHeight).
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct L1Block {
    pub height: u64,
    #[serde(alias = "hash_hex")]
    pub hash: String,
    #[serde(default)]
    pub utxo_transactions: Vec<L1UtxoTransaction>,
    #[serde(default)]
    pub account_transactions: Vec<L1AccountTransaction>,
}

pub fn canonical_utxo_tx_hash(
    version: u32,
    inputs: &[L1TxInput],
    outputs: &[L1TxOutput],
    fee: u64,
    timestamp: u64,
) -> [u8; 32] {
    let mut data = Vec::new();
    data.extend_from_slice(&version.to_le_bytes());
    for input in inputs {
        data.extend_from_slice(&input.prev_tx_hash);
        data.extend_from_slice(&input.output_index.to_le_bytes());
        data.extend_from_slice(&input.public_key);
    }
    for output in outputs {
        data.extend_from_slice(&output.amount.to_le_bytes());
        data.extend_from_slice(output.address.as_bytes());
        if let Some(memo) = &output.memo {
            data.extend_from_slice(memo.as_bytes());
        }
    }
    data.extend_from_slice(&fee.to_le_bytes());
    data.extend_from_slice(&timestamp.to_le_bytes());
    *blake3::hash(&data).as_bytes()
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
                claimant_address: None,
            }
        );
    }

    #[test]
    fn parse_lock_memo_with_claimant() {
        let hash = "a".repeat(64);
        let memo = format!("SWAP:LOCK:{hash}:120:btc:bc1qtest:zion1claimantaddr");
        let parsed = SwapMemo::parse(&memo).unwrap();
        assert_eq!(
            parsed,
            SwapMemo::Lock {
                hash_hex: hash,
                timeout_minutes: 120,
                counterparty_chain: "btc".into(),
                counterparty_addr: "bc1qtest".into(),
                claimant_address: Some("zion1claimantaddr".into()),
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

    #[test]
    fn normalize_rpc_addr_strips_scheme_and_path() {
        assert_eq!(
            normalize_rpc_addr("http://127.0.0.1:8443/jsonrpc"),
            "127.0.0.1:8443"
        );
        assert_eq!(
            normalize_rpc_addr("https://203.0.113.1:8443/"),
            "203.0.113.1:8443"
        );
        assert_eq!(
            normalize_rpc_addr("tcp://198.51.100.2:8443"),
            "198.51.100.2:8443"
        );
    }

    #[test]
    fn zion_address_derivation_matches_v3_shape() {
        let address = zion_address_from_public_key(&[7u8; 32]).unwrap();
        assert!(address.starts_with("zion1"));
        assert_eq!(address.len(), 44);
    }

    #[test]
    fn canonical_utxo_hash_is_stable() {
        let inputs = vec![L1TxInput {
            prev_tx_hash: [1u8; 32],
            output_index: 0,
            signature: vec![],
            public_key: vec![2u8; 32],
        }];
        let outputs = vec![L1TxOutput {
            amount: 1_000,
            address: "zion1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq235g".into(),
            memo: Some("SWAP:RELEASE:test".into()),
        }];
        assert_eq!(
            canonical_utxo_tx_hash(1, &inputs, &outputs, 100, 1_700_000_000),
            canonical_utxo_tx_hash(1, &inputs, &outputs, 100, 1_700_000_000),
        );
    }
}
