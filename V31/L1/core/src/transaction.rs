use serde::{Deserialize, Serialize};

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
}
