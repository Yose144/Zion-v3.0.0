//! UTXO transaction model for ZION V3.
//!
//! Bitcoin-style UTXO model with SegWit-style transaction IDs (signatures
//! excluded from hash preimage to prevent malleability).
//!
//! - `TxInput`  — references a previous output + Ed25519 signature
//! - `TxOutput` — amount in flowers + `zion1...` destination address
//! - `Transaction` — inputs, outputs, fee, timestamp; ID = BLAKE3 hash

use serde::{Deserialize, Serialize};
use crate::crypto;

// ── Structures ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TxInput {
    /// Hash of the transaction containing the output being spent.
    pub prev_tx_hash: [u8; 32],
    /// Index of the output within that transaction.
    pub output_index: u32,
    /// Ed25519 signature (64 bytes) over the transaction hash (SegWit-style).
    pub signature: Vec<u8>,
    /// Ed25519 public key (32 bytes) of the spender.
    pub public_key: Vec<u8>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TxOutput {
    /// Amount in flowers (atomic units). u64 is sufficient for all amounts
    /// since total supply fits in u64 (144B × 10^12 = 1.44 × 10^23 > u64::MAX).
    /// For premine outputs that need > u64, genesis uses special handling.
    pub amount: u64,
    /// Destination address (`zion1...` 44-char format).
    pub address: String,
    /// Optional memo / OP_RETURN data.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub memo: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Transaction {
    /// BLAKE3 hash of the canonical serialization (excluding signatures).
    pub id: [u8; 32],
    /// Transaction format version.
    pub version: u32,
    /// Inputs (UTXOs being spent). Empty for coinbase.
    pub inputs: Vec<TxInput>,
    /// Outputs (new UTXOs created).
    pub outputs: Vec<TxOutput>,
    /// Explicit fee in flowers (must match inputs_sum - outputs_sum).
    pub fee: u64,
    /// Unix timestamp (seconds).
    pub timestamp: u64,
}

impl Transaction {
    /// Compute the canonical transaction hash (SegWit-style: excludes signatures).
    pub fn calculate_hash(&self) -> [u8; 32] {
        let mut data = Vec::new();
        data.extend_from_slice(&self.version.to_le_bytes());
        for input in &self.inputs {
            data.extend_from_slice(&input.prev_tx_hash);
            data.extend_from_slice(&input.output_index.to_le_bytes());
            // Exclude signature — SegWit-style immutable ID
            data.extend_from_slice(&input.public_key);
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
        crypto::blake3_hash(&data)
    }

    /// Recalculate and set the transaction ID.
    pub fn finalize_id(&mut self) {
        self.id = self.calculate_hash();
    }

    /// True if this is a coinbase transaction (no inputs).
    pub fn is_coinbase(&self) -> bool {
        self.inputs.is_empty()
    }

    /// Verify all input signatures against the transaction hash.
    ///
    /// For each input:
    ///   - The message is the 32-byte transaction hash (ID).
    ///   - The signature must be valid Ed25519 over that hash.
    ///   - The public key must correspond to the address owning the UTXO.
    ///     (UTXO ownership is checked separately during block validation.)
    pub fn verify_signatures(&self) -> bool {
        if self.is_coinbase() {
            return true;
        }

        // Re-derive the hash to verify ID integrity
        let expected_hash = self.calculate_hash();
        if self.id != expected_hash {
            return false;
        }

        for input in &self.inputs {
            if !crypto::verify(&input.public_key, &self.id, &input.signature) {
                return false;
            }
        }
        true
    }

    /// Sum of all output amounts.
    pub fn total_output(&self) -> u64 {
        self.outputs.iter().map(|o| o.amount).sum()
    }
}

// ── tests ──────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::{generate_keypair, sign, derive_address};

    fn make_signed_tx() -> Transaction {
        let (sk, vk) = generate_keypair();
        let addr = derive_address(vk.as_bytes());

        let mut tx = Transaction {
            id: [0u8; 32],
            version: 1,
            inputs: vec![TxInput {
                prev_tx_hash: [0xAA; 32],
                output_index: 0,
                signature: vec![],
                public_key: vk.as_bytes().to_vec(),
            }],
            outputs: vec![TxOutput {
                amount: 1_000_000_000_000, // 1 ZION
                address: addr,
                memo: None,
            }],
            fee: 1_000,
            timestamp: 1_700_000_000,
        };
        tx.finalize_id();
        // Sign with the tx hash as message
        let sig = sign(&sk, &tx.id);
        tx.inputs[0].signature = sig.to_vec();
        tx
    }

    #[test]
    fn tx_hash_excludes_signatures() {
        let tx = make_signed_tx();
        // Clear signature and re-hash — should match original ID
        let mut tx2 = tx.clone();
        tx2.inputs[0].signature = vec![0u8; 64]; // different sig
        assert_eq!(tx.calculate_hash(), tx2.calculate_hash());
    }

    #[test]
    fn tx_hash_deterministic() {
        let tx = make_signed_tx();
        assert_eq!(tx.calculate_hash(), tx.calculate_hash());
    }

    #[test]
    fn tx_hash_different_for_different_amounts() {
        let mut tx = make_signed_tx();
        let h1 = tx.calculate_hash();
        tx.outputs[0].amount += 1;
        let h2 = tx.calculate_hash();
        assert_ne!(h1, h2);
    }

    #[test]
    fn verify_signatures_valid() {
        let tx = make_signed_tx();
        assert!(tx.verify_signatures());
    }

    #[test]
    fn verify_signatures_rejects_tampered_amount() {
        let mut tx = make_signed_tx();
        tx.outputs[0].amount += 1;
        // ID no longer matches hash
        assert!(!tx.verify_signatures());
    }

    #[test]
    fn verify_signatures_rejects_wrong_sig() {
        let mut tx = make_signed_tx();
        tx.inputs[0].signature = vec![0u8; 64];
        assert!(!tx.verify_signatures());
    }

    #[test]
    fn coinbase_has_no_inputs() {
        let tx = Transaction {
            id: [0u8; 32],
            version: 1,
            inputs: vec![],
            outputs: vec![TxOutput {
                amount: 5_400_067_000_000_000,
                address: "zion1test".to_string(),
                memo: None,
            }],
            fee: 0,
            timestamp: 1_700_000_000,
        };
        assert!(tx.is_coinbase());
        assert!(tx.verify_signatures()); // coinbase always valid
    }

    #[test]
    fn total_output_sums_correctly() {
        let tx = Transaction {
            id: [0u8; 32],
            version: 1,
            inputs: vec![],
            outputs: vec![
                TxOutput { amount: 100, address: "a".into(), memo: None },
                TxOutput { amount: 200, address: "b".into(), memo: None },
                TxOutput { amount: 300, address: "c".into(), memo: None },
            ],
            fee: 0,
            timestamp: 0,
        };
        assert_eq!(tx.total_output(), 600);
    }

    #[test]
    fn finalize_id_sets_correct_hash() {
        let mut tx = Transaction {
            id: [0u8; 32],
            version: 1,
            inputs: vec![],
            outputs: vec![TxOutput {
                amount: 1000,
                address: "addr".into(),
                memo: Some("hello".into()),
            }],
            fee: 100,
            timestamp: 12345,
        };
        let expected = tx.calculate_hash();
        tx.finalize_id();
        assert_eq!(tx.id, expected);
    }

    #[test]
    fn memo_affects_hash() {
        let base = Transaction {
            id: [0u8; 32],
            version: 1,
            inputs: vec![],
            outputs: vec![TxOutput {
                amount: 1000,
                address: "addr".into(),
                memo: None,
            }],
            fee: 100,
            timestamp: 12345,
        };
        let mut with_memo = base.clone();
        with_memo.outputs[0].memo = Some("memo data".into());
        assert_ne!(base.calculate_hash(), with_memo.calculate_hash());
    }
}
