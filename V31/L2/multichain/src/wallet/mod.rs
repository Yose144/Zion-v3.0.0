//! Multi-chain keyring and address derivation.
//!
//! All keys are derived from a single BIP39 mnemonic. Each chain adapter
//! requests the appropriate key material from the keyring; the keyring never
//! exposes the master seed.

use std::str::FromStr;

use bip39::Mnemonic;
use bitcoin::bip32::{DerivationPath, Xpriv};
use bitcoin::secp256k1::Secp256k1;
use ed25519_dalek::{Signer as EdSigner, SigningKey as EdSigningKey};
use ethers::core::{types::PathOrString, utils::hash_message};
use ethers::signers::{coins_bip39::English, LocalWallet, MnemonicBuilder, Signer as EthSigner};
use ripemd::Ripemd160;
use sha2::{Digest, Sha256};
use sha3::Keccak256;
use zion_l1_types::{Address, ChainFamily, ChainId};

use crate::error::{MultichainError, MultichainResult};

/// In-memory keyring derived from a single BIP39 mnemonic.
#[derive(Clone)]
pub struct Keyring {
    mnemonic: Mnemonic,
    seed: Option<[u8; 64]>,
}

impl std::fmt::Debug for Keyring {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Keyring")
            .field("mnemonic", &"[REDACTED]")
            .finish_non_exhaustive()
    }
}

/// Load the canonical EVM relay/validator wallet from `WARP_EVM_RELAY_KEY`.
/// The key is a 32-byte secp256k1 private key in hex (with or without 0x).
pub fn evm_relay_wallet() -> MultichainResult<ethers::signers::LocalWallet> {
    let raw = std::env::var("WARP_EVM_RELAY_KEY")
        .map_err(|_| MultichainError::Config("WARP_EVM_RELAY_KEY not set".to_string()))?;
    let hex = raw.trim_start_matches("0x").trim();
    let bytes = hex::decode(hex)
        .map_err(|e| MultichainError::Config(format!("invalid WARP_EVM_RELAY_KEY hex: {e}")))?;
    LocalWallet::from_bytes(&bytes)
        .map_err(|e| MultichainError::Config(format!("invalid EVM relay key: {e}")))
}

impl Keyring {
    /// Generate a random 24-word English mnemonic.
    pub fn generate() -> MultichainResult<Self> {
        let entropy: [u8; 32] = rand::random();
        let mnemonic = Mnemonic::from_entropy(&entropy)
            .map_err(|e| MultichainError::Internal(e.to_string()))?;
        let seed = mnemonic.to_seed("");
        Ok(Self {
            mnemonic,
            seed: Some(seed),
        })
    }

    /// Parse an existing BIP39 mnemonic phrase.
    pub fn from_mnemonic(phrase: &str) -> MultichainResult<Self> {
        let mnemonic =
            Mnemonic::parse(phrase).map_err(|e| MultichainError::Internal(e.to_string()))?;
        let seed = mnemonic.to_seed("");
        Ok(Self {
            mnemonic,
            seed: Some(seed),
        })
    }

    /// Return the mnemonic phrase.
    pub fn mnemonic(&self) -> String {
        self.mnemonic.to_string()
    }

    /// Derive a chain-specific address for `account` / `index`.
    pub fn address(&self, chain: ChainId, account: u32, index: u32) -> MultichainResult<Address> {
        match chain.family() {
            ChainFamily::Evm => self.evm_address(chain, account, index),
            ChainFamily::Zion => self.zion_address(chain, account, index),
            ChainFamily::Utxo => self.bitcoin_address(chain, account, index),
            _ => Err(MultichainError::Unsupported(format!(
                "address derivation for {}",
                chain.as_str()
            ))),
        }
    }

    /// Sign `message` with the key derived for `account` / `index` on `chain`.
    pub fn sign(
        &self,
        chain: ChainId,
        message: &[u8],
        account: u32,
        index: u32,
    ) -> MultichainResult<Vec<u8>> {
        match chain.family() {
            ChainFamily::Evm => self.sign_evm(message, account, index),
            ChainFamily::Zion => self.sign_zion(message, account, index),
            _ => Err(MultichainError::Unsupported(format!(
                "signing for {}",
                chain.as_str()
            ))),
        }
    }

    pub(crate) fn evm_wallet(&self, account: u32, index: u32) -> MultichainResult<LocalWallet> {
        let path = format!("m/44'/60'/{account}'/0/{index}");
        MnemonicBuilder::<English>::default()
            .phrase(PathOrString::String(self.mnemonic.to_string()))
            .derivation_path(&path)
            .map_err(|e| MultichainError::Internal(e.to_string()))?
            .build()
            .map_err(|e| MultichainError::Internal(e.to_string()))
    }

    fn evm_address(&self, chain: ChainId, account: u32, index: u32) -> MultichainResult<Address> {
        let wallet = self.evm_wallet(account, index)?;
        let bytes = wallet.address().as_bytes().to_vec();
        let encoded = format!("0x{}", hex::encode(&bytes));
        Ok(Address::new(chain, bytes, encoded)?)
    }

    fn sign_evm(&self, message: &[u8], account: u32, index: u32) -> MultichainResult<Vec<u8>> {
        let wallet = self.evm_wallet(account, index)?;
        let hash = hash_message(message);
        let sig = wallet
            .sign_hash(hash)
            .map_err(|e| MultichainError::Internal(e.to_string()))?;
        Ok(sig.to_vec())
    }

    fn zion_seed(&self, account: u32, index: u32) -> [u8; 32] {
        let seed = self.seed.unwrap_or_else(|| self.mnemonic.to_seed(""));
        let path = format!("m/44'/9999'/{account}'/0/{index}");
        let mut hasher = Keccak256::new();
        hasher.update(path.as_bytes());
        hasher.update(seed);
        let hash = hasher.finalize();
        hash[..32].try_into().expect("keccak256 output is 32 bytes")
    }

    pub fn zion_signing_key(&self, account: u32, index: u32) -> MultichainResult<EdSigningKey> {
        let seed = self.zion_seed(account, index);
        Ok(EdSigningKey::from_bytes(&seed))
    }

    fn zion_address(&self, chain: ChainId, account: u32, index: u32) -> MultichainResult<Address> {
        let signing_key = self.zion_signing_key(account, index)?;
        let public = signing_key.verifying_key().to_bytes();
        let encoded = derive_zion_address(&public);
        Ok(Address::new(chain, Vec::new(), encoded)?)
    }

    /// Return the hex-encoded Ed25519 public key for the Zion L1 account.
    pub fn zion_public_key(&self, account: u32, index: u32) -> MultichainResult<String> {
        let signing_key = self.zion_signing_key(account, index)?;
        Ok(hex::encode(signing_key.verifying_key().to_bytes()))
    }

    fn sign_zion(&self, message: &[u8], account: u32, index: u32) -> MultichainResult<Vec<u8>> {
        let signing_key = self.zion_signing_key(account, index)?;
        Ok(EdSigner::sign(&signing_key, message).to_bytes().to_vec())
    }

    fn bitcoin_xpriv(
        &self,
        network: bitcoin::Network,
        account: u32,
        index: u32,
    ) -> MultichainResult<Xpriv> {
        let seed = self.seed.unwrap_or_else(|| self.mnemonic.to_seed(""));
        let master = Xpriv::new_master(network, &seed)
            .map_err(|e| MultichainError::Internal(format!("bitcoin xpriv: {e}")))?;
        let coin_type = if network == bitcoin::Network::Bitcoin {
            0
        } else {
            1
        };
        let path = format!("m/84'/{coin_type}'/{account}'/0/{index}");
        let derivation = DerivationPath::from_str(&path)
            .map_err(|e| MultichainError::Internal(format!("bitcoin derivation path: {e}")))?;
        let secp = Secp256k1::new();
        let xpriv = master
            .derive_priv(&secp, &derivation)
            .map_err(|e| MultichainError::Internal(format!("bitcoin derive: {e}")))?;
        Ok(xpriv)
    }

    fn bitcoin_address(
        &self,
        chain: ChainId,
        account: u32,
        index: u32,
    ) -> MultichainResult<Address> {
        let network = match chain {
            ChainId::Bitcoin => bitcoin::Network::Bitcoin,
            _ => bitcoin::Network::Testnet,
        };
        let xpriv = self.bitcoin_xpriv(network, account, index)?;
        let secp = Secp256k1::new();
        let private_key = bitcoin::PrivateKey::new(xpriv.private_key, xpriv.network);
        let public_key = bitcoin::PublicKey::from_private_key(&secp, &private_key);
        let btc_address = bitcoin::Address::p2wpkh(&public_key, xpriv.network)
            .map_err(|e| MultichainError::Internal(format!("bitcoin p2wpkh: {e}")))?;
        let encoded = btc_address.to_string();
        let bytes = btc_address.script_pubkey().as_bytes().to_vec();
        Ok(Address::new(chain, bytes, &encoded)?)
    }

    /// Derive a Bitcoin P2WPKH address for a specific `network`, `account` and `index`.
    pub fn bitcoin_address_for_network(
        &self,
        network: bitcoin::Network,
        account: u32,
        index: u32,
    ) -> MultichainResult<Address> {
        let xpriv = self.bitcoin_xpriv(network, account, index)?;
        let secp = Secp256k1::new();
        let private_key = bitcoin::PrivateKey::new(xpriv.private_key, xpriv.network);
        let public_key = bitcoin::PublicKey::from_private_key(&secp, &private_key);
        let btc_address = bitcoin::Address::p2wpkh(&public_key, xpriv.network)
            .map_err(|e| MultichainError::Internal(format!("bitcoin p2wpkh: {e}")))?;
        let encoded = btc_address.to_string();
        let bytes = btc_address.script_pubkey().as_bytes().to_vec();
        Ok(Address::new(ChainId::Bitcoin, bytes, &encoded)?)
    }

    /// Return the Bitcoin ECDSA private/public key pair for the default (0,0) address.
    pub fn bitcoin_key_pair(
        &self,
        network: bitcoin::Network,
        account: u32,
        index: u32,
    ) -> MultichainResult<(bitcoin::PrivateKey, bitcoin::PublicKey)> {
        let xpriv = self.bitcoin_xpriv(network, account, index)?;
        let secp = Secp256k1::new();
        let private_key = bitcoin::PrivateKey::new(xpriv.private_key, xpriv.network);
        let public_key = bitcoin::PublicKey::from_private_key(&secp, &private_key);
        Ok((private_key, public_key))
    }
}

const ZION_BASE32_ALPHABET: &[u8; 32] = b"023456789acdefghjklmnpqrstuvwxyz";

fn compute_address_checksum(body_35: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(b"zion1");
    hasher.update(body_35.as_bytes());
    let hash = hasher.finalize();
    let mut ck = String::with_capacity(4);
    for &byte in &hash[..2] {
        ck.push(ZION_BASE32_ALPHABET[(byte % 32) as usize] as char);
        ck.push(ZION_BASE32_ALPHABET[((byte / 32) % 32) as usize] as char);
    }
    ck
}

fn derive_zion_address(public_key_bytes: &[u8]) -> String {
    let sha = Sha256::digest(public_key_bytes);
    let key_hash = Ripemd160::digest(sha);
    let key_hash: &[u8] = key_hash.as_ref();

    let mut data = String::with_capacity(40);
    for &byte in key_hash {
        data.push(ZION_BASE32_ALPHABET[(byte % 32) as usize] as char);
        data.push(ZION_BASE32_ALPHABET[((byte / 32) % 32) as usize] as char);
    }
    data.truncate(35);

    let checksum = compute_address_checksum(&data);
    format!("zion1{data}{checksum}")
}

#[cfg(test)]
mod tests {
    use super::*;

    const TEST_MNEMONIC: &str =
        "fire evolve buddy tenant talent favorite ankle stem regret myth dream fresh";

    #[test]
    fn generates_and_round_trips_phrase() {
        let keyring = Keyring::generate().unwrap();
        let phrase = keyring.mnemonic();
        assert_eq!(phrase.split_whitespace().count(), 24);
        let parsed = Keyring::from_mnemonic(&phrase).unwrap();
        assert_eq!(parsed.mnemonic(), phrase);
    }

    #[test]
    fn evm_address_parses_as_ethers_address() {
        let keyring = Keyring::generate().unwrap();
        let addr = keyring.address(ChainId::Base, 0, 0).unwrap();
        let parsed: ethers::types::Address = addr.encoded.parse().unwrap();
        assert_eq!(parsed.as_bytes().to_vec(), addr.bytes);
    }

    #[test]
    fn evm_address_is_deterministic_for_known_mnemonic() {
        let keyring = Keyring::from_mnemonic(TEST_MNEMONIC).unwrap();
        let addr = keyring.address(ChainId::Ethereum, 0, 2).unwrap();
        let expected = "0x1D86AD5eBb2380dAdEAF52f61f4F428C485460E9";
        assert_eq!(addr.encoded.to_lowercase(), expected.to_lowercase());
    }

    #[test]
    fn same_mnemonic_yields_same_address() {
        let k1 = Keyring::from_mnemonic(TEST_MNEMONIC).unwrap();
        let k2 = Keyring::from_mnemonic(TEST_MNEMONIC).unwrap();
        assert_eq!(
            k1.address(ChainId::Base, 0, 1).unwrap(),
            k2.address(ChainId::Base, 0, 1).unwrap()
        );
    }

    #[test]
    fn zion_address_creates_successfully() {
        let keyring = Keyring::from_mnemonic(TEST_MNEMONIC).unwrap();
        let addr = keyring.address(ChainId::ZionL1, 0, 0).unwrap();
        assert_eq!(addr.family(), ChainFamily::Zion);
        assert!(addr.encoded.starts_with("zion1"));
        assert_eq!(addr.encoded.len(), 44);
        assert!(addr.bytes.is_empty());
    }

    #[test]
    fn sign_evm_returns_65_byte_signature() {
        let keyring = Keyring::from_mnemonic(TEST_MNEMONIC).unwrap();
        let sig = keyring.sign(ChainId::Base, b"hello zion", 0, 0).unwrap();
        assert_eq!(sig.len(), 65);
    }

    #[test]
    fn sign_zion_returns_64_byte_signature() {
        let keyring = Keyring::from_mnemonic(TEST_MNEMONIC).unwrap();
        let sig = keyring.sign(ChainId::ZionL1, b"hello zion", 0, 0).unwrap();
        assert_eq!(sig.len(), 64);
    }

    #[test]
    fn bitcoin_address_creates_successfully() {
        let keyring = Keyring::from_mnemonic(TEST_MNEMONIC).unwrap();
        let addr = keyring.address(ChainId::Bitcoin, 0, 0).unwrap();
        assert_eq!(addr.family(), ChainFamily::Utxo);
        assert!(addr.encoded.starts_with("bc1") || addr.encoded.starts_with("tb1"));
    }

    #[test]
    fn unsupported_family_returns_error() {
        let keyring = Keyring::from_mnemonic(TEST_MNEMONIC).unwrap();
        assert!(keyring.sign(ChainId::Bitcoin, b"x", 0, 0).is_err());
        assert!(keyring.sign(ChainId::Solana, b"x", 0, 0).is_err());
    }
}
