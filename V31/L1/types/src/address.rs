use serde::{Deserialize, Serialize};

use crate::chain::{ChainFamily, ChainId};
use crate::error::{L1Error, L1Result};

/// A chain-agnostic address.
///
/// `bytes` holds the raw decoded address bytes; `encoded` holds the canonical
/// string representation for the chain (base58, bech32, hex EIP-55, etc.).
/// Validation is family-aware but minimal: the caller (adapter/signer) is
/// responsible for checksum and format-specific checks.
#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct Address {
    pub chain: ChainId,
    pub bytes: Vec<u8>,
    pub encoded: String,
}

impl Address {
    /// Create an address. Performs only length validation per family.
    pub fn new(chain: ChainId, bytes: Vec<u8>, encoded: impl Into<String>) -> L1Result<Self> {
        let encoded = encoded.into();
        let family = chain.family();
        let expected = expected_length(family);
        if !expected.is_empty() && !expected.contains(&bytes.len()) {
            return Err(L1Error::InvalidAddressLength {
                family: format!("{:?}", family),
                got: bytes.len(),
                expected: expected.to_vec(),
            });
        }
        Ok(Self {
            chain,
            bytes,
            encoded,
        })
    }

    pub fn family(&self) -> ChainFamily {
        self.chain.family()
    }

    pub fn as_str(&self) -> &str {
        &self.encoded
    }
}

impl std::fmt::Display for Address {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}:{}", self.chain.as_str(), self.encoded)
    }
}

fn expected_length(family: ChainFamily) -> &'static [usize] {
    match family {
        ChainFamily::Evm => &[20],
        ChainFamily::Solana | ChainFamily::Near => &[32],
        // Zion, UTXO, Cosmos, Move, etc. use string-encoded addresses with
        // variable or chain-specific byte lengths. Adapters validate the encoded
        // form; this layer only rejects known fixed-length mismatches.
        _ => &[],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn evm_address_validates_length() {
        let bytes = vec![0u8; 20];
        let addr = Address::new(ChainId::Base, bytes, "0x...").unwrap();
        assert_eq!(addr.family(), ChainFamily::Evm);
    }

    #[test]
    fn evm_address_rejects_wrong_length() {
        let bytes = vec![0u8; 19];
        let err = Address::new(ChainId::Base, bytes, "0x...").unwrap_err();
        assert!(matches!(err, L1Error::InvalidAddressLength { .. }));
    }
}
