use crate::crypto::{hash, keys, to_hex};
use serde::{Deserialize, Serialize};

/// Custom serde module for `amount: u128`.
///
/// serde_json 1.x without `arbitrary_precision` feature does not support
/// native u128 serialization/deserialization via `deserialize_u128`.
///
/// Strategy (uses `Serializer::is_human_readable()` to switch paths):
///
/// JSON (is_human_readable = true):
///   - Serialize: as JSON number if value ≤ u64::MAX, else as decimal string.
///   - Deserialize: `deserialize_any` with visitors for u64, string, f64 etc.
///     Handles both numeric JSON amounts sent by other nodes and string format.
///
/// Binary / bincode (is_human_readable = false):
///   - Serialize / Deserialize: native u128 (bincode 1.3+ stores 16 bytes).
///     This preserves LMDB wire-format compatibility with existing stored data.
mod amount_serde {
    use serde::{de, Deserializer, Serializer};
    use std::fmt;

    pub fn serialize<S: Serializer>(v: &u128, s: S) -> Result<S::Ok, S::Error> {
        if s.is_human_readable() {
            // JSON: emit a plain number when it fits in u64, else a decimal string.
            if *v <= u64::MAX as u128 {
                s.serialize_u64(*v as u64)
            } else {
                s.serialize_str(&v.to_string())
            }
        } else {
            // Binary (bincode 1.3+): native 16-byte u128.
            s.serialize_u128(*v)
        }
    }

    pub fn deserialize<'de, D: Deserializer<'de>>(d: D) -> Result<u128, D::Error> {
        if d.is_human_readable() {
            // JSON path: accept integer, string, or float representations.
            struct U128Visitor;
            impl<'de> de::Visitor<'de> for U128Visitor {
                type Value = u128;
                fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
                    write!(f, "a u128 value as JSON number or string")
                }
                fn visit_u64<E: de::Error>(self, v: u64) -> Result<u128, E> {
                    Ok(v as u128)
                }
                fn visit_u128<E: de::Error>(self, v: u128) -> Result<u128, E> {
                    Ok(v)
                }
                fn visit_i64<E: de::Error>(self, v: i64) -> Result<u128, E> {
                    if v >= 0 {
                        Ok(v as u128)
                    } else {
                        Err(E::custom("negative amount not allowed"))
                    }
                }
                fn visit_str<E: de::Error>(self, v: &str) -> Result<u128, E> {
                    v.parse::<u128>()
                        .map_err(|e| E::custom(format!("invalid u128 string: {}", e)))
                }
                fn visit_f64<E: de::Error>(self, v: f64) -> Result<u128, E> {
                    if v >= 0.0 && v <= u128::MAX as f64 {
                        Ok(v as u128)
                    } else {
                        Err(E::custom("f64 out of u128 range"))
                    }
                }
            }
            d.deserialize_any(U128Visitor)
        } else {
            // Binary path (bincode 1.3+): native 16-byte u128.
            struct U128Native;
            impl<'de> de::Visitor<'de> for U128Native {
                type Value = u128;
                fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
                    write!(f, "native u128")
                }
                fn visit_u128<E: de::Error>(self, v: u128) -> Result<u128, E> {
                    Ok(v)
                }
            }
            d.deserialize_u128(U128Native)
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TxInput {
    pub prev_tx_hash: String,
    pub output_index: u32,
    pub signature: String,  // Hex encoded 64-byte Ed25519 signature
    pub public_key: String, // Hex encoded 32-byte Ed25519 public key
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TxOutput {
    /// Amount in flowers (atomic units). u128 to accommodate premine amounts > u64::MAX.
    /// Serialized as a JSON number (u64 range) or string (larger). See `amount_serde`.
    #[serde(with = "amount_serde")]
    pub amount: u128,
    pub address: String,
    /// Optional memo / OP_RETURN data (e.g. "BRIDGE:base:0x..." for bridge locks)
    /// NOTE: no skip_serializing_if — bincode (LMDB) requires all fields present
    #[serde(default)]
    pub memo: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transaction {
    pub id: String, // Hash of the tx
    pub version: u32,
    pub inputs: Vec<TxInput>,
    pub outputs: Vec<TxOutput>,
    pub fee: u64,
    pub timestamp: u64,
}

impl Transaction {
    pub fn new() -> Self {
        Self {
            id: String::new(),
            version: 1,
            inputs: vec![],
            outputs: vec![],
            fee: 0,
            timestamp: 0,
        }
    }

    pub fn calculate_hash(&self) -> String {
        let mut data = Vec::new();
        data.extend_from_slice(&self.version.to_le_bytes());
        for input in &self.inputs {
            data.extend_from_slice(input.prev_tx_hash.as_bytes());
            data.extend_from_slice(&input.output_index.to_le_bytes());
            // Exclude signature from ID for now (simplified SegWit-style or just Mutable ID)
            // If we want ID to be immutable once signed, we must hash what is signed (inputs+outputs etc)
            // But if we hash the signature, the ID changes when we sign.
            // Standard Bitcoin: ID = Hash(SignedTx). This causes malleability.
            // Zion V1: Simple ID = Hash(Fields without signature).
            data.extend_from_slice(input.public_key.as_bytes());
        }
        for output in &self.outputs {
            data.extend_from_slice(&output.amount.to_le_bytes());
            data.extend_from_slice(output.address.as_bytes());
            if let Some(memo) = &output.memo {
                data.extend_from_slice(memo.as_bytes());
            }
        }
        data.extend_from_slice(&self.fee.to_le_bytes());
        data.extend_from_slice(&self.timestamp.to_le_bytes());

        to_hex(&hash::blake(&data))
    }

    pub fn verify_signatures(&self) -> bool {
        // The message being signed is the Transaction Hash (ID).
        // Since ID excludes signatures, it is safe to calculate it.
        // However, if we simply use self.id, we rely on it being correct.
        // Better to re-calculate.
        let msg_hash_hex = self.calculate_hash();
        if self.id != msg_hash_hex {
            return false;
        }

        let msg_bytes = match keys::from_hex(&msg_hash_hex) {
            Some(b) => b,
            None => return false,
        };

        for input in &self.inputs {
            let pk_bytes = match keys::from_hex(&input.public_key) {
                Some(b) => b,
                None => return false,
            };
            let sig_bytes = match keys::from_hex(&input.signature) {
                Some(b) => b,
                None => return false,
            };

            if !keys::verify(&pk_bytes, &msg_bytes, &sig_bytes) {
                return false;
            }
        }
        true
    }
}
