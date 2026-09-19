//! One-shot: generate a BIP39 mnemonic and derive the WARP BTC operator
//! wallet for testnet (m/84'/1'/0'/0/0) and mainnet (m/84'/0'/0'/0/0).
//! Prints WIF + P2WPKH address for each network. Keep output secret.

use bip39::Mnemonic;
use bitcoin::bip32::{DerivationPath, ExtendedPrivKey};
use bitcoin::secp256k1::Secp256k1;
use bitcoin::{Address, Network, PrivateKey, PublicKey};
use rand::RngCore;
use std::str::FromStr;

fn derive(xpriv: &ExtendedPrivKey, path: &str, network: Network, label: &str) {
    let secp = Secp256k1::new();
    let path = DerivationPath::from_str(path).unwrap();
    let child = xpriv.derive_priv(&secp, &path).unwrap();
    let privkey = PrivateKey::new(child.private_key, network);
    let wif = privkey.to_wif();
    let pubkey = PublicKey::new(child.private_key.public_key(&secp));
    let addr = Address::p2wpkh(&pubkey, network).unwrap();
    println!("{label}");
    println!("  path:    {path}");
    println!("  wif:     {wif}");
    println!("  address: {addr}");
}

fn main() {
    let mut entropy = [0u8; 32]; // 256 bits → 24 words
    rand::rngs::OsRng.fill_bytes(&mut entropy);
    let mnemonic = Mnemonic::from_entropy_in(bip39::Language::English, &entropy).unwrap();
    let phrase = mnemonic.to_string();
    let seed = mnemonic.to_seed("");
    println!("mnemonic: {phrase}");
    println!();

    // The seed is network-agnostic; the derivation path determines coin type.
    let xpriv = ExtendedPrivKey::new_master(Network::Bitcoin, &seed).unwrap();
    derive(&xpriv, "m/84'/1'/0'/0/0", Network::Testnet, "TESTNET (BIP84 coin 1)");
    println!();
    derive(&xpriv, "m/84'/0'/0'/0/0", Network::Bitcoin, "MAINNET (BIP84 coin 0)");
}
