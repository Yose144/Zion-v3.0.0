use std::sync::Arc;

use zion_l1_types::ChainId;
use zion_multichain::Keyring;

use crate::error::{SdkError, SdkResult};

/// High-level wallet client wrapping `zion-multichain::Keyring`.
pub struct WalletClient {
    keyring: Arc<Keyring>,
}

impl WalletClient {
    /// Create a new wallet from a BIP39 mnemonic.
    pub fn from_mnemonic(mnemonic: &str) -> SdkResult<Self> {
        let keyring =
            Keyring::from_mnemonic(mnemonic).map_err(|e| SdkError::Wallet(e.to_string()))?;
        Ok(Self {
            keyring: Arc::new(keyring),
        })
    }

    /// Generate a new random wallet.
    pub fn generate() -> SdkResult<Self> {
        let keyring = Keyring::generate().map_err(|e| SdkError::Wallet(e.to_string()))?;
        Ok(Self {
            keyring: Arc::new(keyring),
        })
    }

    /// Derive a chain-specific address for `account` / `index`.
    pub fn address(&self, chain: ChainId, account: u32, index: u32) -> SdkResult<String> {
        let addr = self
            .keyring
            .address(chain, account, index)
            .map_err(|e| SdkError::Wallet(e.to_string()))?;
        Ok(addr.encoded)
    }

    /// Get the ZION L1 address for `(account, index)`.
    pub fn zion_address(&self, account: u32, index: u32) -> SdkResult<String> {
        self.address(ChainId::ZionL1, account, index)
    }

    /// Get the EVM (Base) address for `(account, index)`.
    pub fn evm_address(&self, account: u32, index: u32) -> SdkResult<String> {
        self.address(ChainId::Base, account, index)
    }

    /// Return the hex-encoded Ed25519 public key for the Zion L1 account.
    pub fn zion_public_key(&self, account: u32, index: u32) -> SdkResult<String> {
        self.keyring
            .zion_public_key(account, index)
            .map_err(|e| SdkError::Wallet(e.to_string()))
    }

    /// Return the mnemonic phrase (handle with care).
    pub fn mnemonic(&self) -> String {
        self.keyring.mnemonic()
    }

    /// Access the underlying keyring for advanced operations.
    pub fn keyring(&self) -> &Keyring {
        &self.keyring
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generate_wallet() {
        let w = WalletClient::generate().unwrap();
        let addr = w.zion_address(0, 0).unwrap();
        assert!(addr.starts_with("zion1"));
    }

    #[test]
    fn evm_address_works() {
        let w = WalletClient::generate().unwrap();
        let addr = w.evm_address(0, 0).unwrap();
        assert!(addr.starts_with("0x"));
    }

    #[test]
    fn mnemonic_roundtrip() {
        let w = WalletClient::generate().unwrap();
        let mnemonic = w.mnemonic();
        let w2 = WalletClient::from_mnemonic(&mnemonic).unwrap();
        assert_eq!(
            w.zion_address(0, 0).unwrap(),
            w2.zion_address(0, 0).unwrap()
        );
    }
}
