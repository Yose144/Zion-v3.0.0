//! Multi-chain keyring and address derivation.
//!
//! All keys are derived from a single BIP39 mnemonic. Each chain adapter
//! requests the appropriate key material from the keyring; the keyring never
//! exposes the master seed.

use zion_l1_types::{Address, ChainId};

use crate::error::{MultichainError, MultichainResult};

/// In-memory keyring stub. Real implementation stores seed encrypted at rest.
#[derive(Debug, Default)]
pub struct Keyring;

impl Keyring {
    pub fn new() -> Self {
        Self
    }

    pub fn address(
        &self,
        _chain: ChainId,
        _account: u32,
        _index: u32,
    ) -> MultichainResult<Address> {
        // Placeholder: derive chain-specific address from BIP44/SLIP44 path.
        Err(MultichainError::Unsupported(
            "address derivation not yet implemented".to_string(),
        ))
    }

    pub fn sign(&self, _chain: ChainId, _message: &[u8]) -> MultichainResult<Vec<u8>> {
        Err(MultichainError::Unsupported(
            "signing not yet implemented".to_string(),
        ))
    }
}
