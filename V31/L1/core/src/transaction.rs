use serde::{Deserialize, Serialize};
use sha3::{Digest, Keccak256};

use zion_l1_types::{Address, Amount, Hash};

/// Reference to a previous unspent output.
#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct TransactionInput {
    pub previous_output: Hash,
    pub index: u32,
    pub script: Vec<u8>,
}

/// Output that assigns an amount to an address.
#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct TransactionOutput {
    pub amount: Amount,
    pub address: Address,
}

/// L1 account/UTXO transaction.
#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct Transaction {
    pub version: u32,
    pub inputs: Vec<TransactionInput>,
    pub outputs: Vec<TransactionOutput>,
    pub memo: Vec<u8>,
}

impl Transaction {
    pub fn new(
        version: u32,
        inputs: Vec<TransactionInput>,
        outputs: Vec<TransactionOutput>,
        memo: Vec<u8>,
    ) -> Self {
        Self {
            version,
            inputs,
            outputs,
            memo,
        }
    }

    /// Deterministic transaction hash used in merkle roots and UTXO outpoints.
    pub fn hash(&self) -> Hash {
        let mut bytes = Vec::new();
        bytes.extend_from_slice(&self.version.to_le_bytes());
        for input in &self.inputs {
            bytes.extend_from_slice(&input.previous_output.0);
            bytes.extend_from_slice(&input.index.to_le_bytes());
            bytes.extend_from_slice(&input.script);
        }
        for output in &self.outputs {
            bytes.extend_from_slice(&output.amount.0.to_le_bytes());
            bytes.extend_from_slice(output.address.encoded.as_bytes());
        }
        bytes.extend_from_slice(&self.memo);
        Hash::new(Keccak256::digest(bytes).into())
    }

    /// Hash of the transaction with all input scripts cleared.
    ///
    /// This is the message that must be signed by each input. Keeping the
    /// scripts out of the signed hash means the transaction ID (which includes
    /// the scripts) can vary without invalidating the signatures.
    pub fn signing_hash(&self) -> Hash {
        let mut bytes = Vec::new();
        bytes.extend_from_slice(&self.version.to_le_bytes());
        for input in &self.inputs {
            bytes.extend_from_slice(&input.previous_output.0);
            bytes.extend_from_slice(&input.index.to_le_bytes());
            // Exclude scripts from the signing message.
            bytes.extend_from_slice(&[]);
        }
        for output in &self.outputs {
            bytes.extend_from_slice(&output.amount.0.to_le_bytes());
            bytes.extend_from_slice(output.address.encoded.as_bytes());
        }
        bytes.extend_from_slice(&self.memo);
        Hash::new(Keccak256::digest(bytes).into())
    }

    /// A coinbase transaction has no inputs and creates new coins.
    pub fn is_coinbase(&self) -> bool {
        self.inputs.is_empty()
    }
}
