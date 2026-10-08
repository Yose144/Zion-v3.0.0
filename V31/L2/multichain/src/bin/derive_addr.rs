//! `zion-derive-addr` — multichain derivation/signing helper for the native
//! ZION wallet (desktop agent + tooling). Reads a BIP39 mnemonic via STDIN
//! (never argv) and emits per-chain addresses/keys/signatures.
//!
//! Modes:
//!   (none)                legacy line output `addr= pk= sk= qtc=` per mnemonic
//!   --json                one JSON object per mnemonic — full native bundle:
//!                         zion (wallet-compat seed[0:32]), evm, bitcoin,
//!                         solana, quantus + `custodial` reference addresses
//!   --sign <chain>        stdin line 1 mnemonic, line 2 hex message → `sig=<hex>`
//!                         chains: zion | zion-keyring | evm | bitcoin | solana | quantus
//!   --qtc-send <to> <planks>  submit a QTC balances.transfer_keep_alive via
//!                             the Planck RPC (`QUANTUS_RPC` env override).
//!
//! Derivation spec (native wallet — MUST match the JS implementation):
//!   zion    seed[0:32] → ed25519 → zion1…   (existing desktop/web wallet compat)
//!   evm     BIP32 m/44'/60'/0'/0/0 → secp256k1 (MetaMask-compatible)
//!   bitcoin BIP84 m/84'/0'/0'/0/0 → secp256k1 → P2WPKH bc1q…
//!   solana  SLIP-0010 m/44'/501'/0'/0' → ed25519 → base58 pubkey (Phantom-compatible)
//!   quantus keccak256("m/44'/189'/0'/0/0"‖seed) → ML-DSA-87 → ss58-189 qz…
//!
//! `custodial` addresses use the warpd keyring paths (keccak path for zion) —
//! they differ from native ones by design (different construction).
use std::io::Read;

use bip39::Mnemonic;
use ed25519_dalek::{Signer as EdSigner, SigningKey as EdSigningKey};
use ethers::core::types::PathOrString;
use ethers::signers::{coins_bip39::English, MnemonicBuilder, Signer};
use sha2::{Digest, Sha512};
use zion_l1_types::ChainId;
use zion_multichain::chain::adapters::quantus::{
    QuantusAdapter, QuantusKeypair,
};
use zion_multichain::wallet::{derive_zion_address, Keyring};

const DEFAULT_QUANTUS_RPC: &str = "https://a1-planck.quantus.cat";

fn usage() -> ! {
    eprintln!(
        "usage: zion-derive-addr [--json] | --sign <chain> | --qtc-send <dest> <planks>\n\
         mnemonic is read from stdin (never argv)."
    );
    std::process::exit(2);
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let mut input = String::new();
    std::io::stdin()
        .read_to_string(&mut input)
        .unwrap_or_else(|e| {
            eprintln!("ERROR reading stdin: {e}");
            std::process::exit(1);
        });
    let mut lines = input.lines();

    match args.get(1).map(String::as_str) {
        Some("--json") => {
            for line in lines.by_ref() {
                let m = line.trim();
                if m.is_empty() || m.starts_with('#') {
                    continue;
                }
                match derive_bundle(m) {
                    Ok(j) => println!("{j}"),
                    Err(e) => eprintln!("ERROR: {} — {e}", &m[..m.len().min(30)]),
                }
            }
        }
        Some("--sign") => {
            let chain = args.get(2).map(String::as_str).unwrap_or_else(|| usage());
            let account = args
                .get(3)
                .and_then(|s| s.parse::<u32>().ok())
                .unwrap_or(0);
            let index = args
                .get(4)
                .and_then(|s| s.parse::<u32>().ok())
                .unwrap_or(0);
            let mnemonic = lines.next().unwrap_or("").trim().to_string();
            let msg_hex = lines.next().unwrap_or("").trim().to_string();
            let msg = match hex::decode(msg_hex.trim_start_matches("0x")) {
                Ok(m) => m,
                Err(e) => {
                    eprintln!("ERROR bad hex message: {e}");
                    std::process::exit(1);
                }
            };
            match sign_message(&mnemonic, chain, &msg, account, index) {
                Ok(sig) => println!("sig={}", hex::encode(sig)),
                Err(e) => {
                    eprintln!("ERROR sign: {e}");
                    std::process::exit(1);
                }
            }
        }
        Some("--qtc-send") => {
            let dest = args.get(2).cloned().unwrap_or_else(|| usage());
            let planks: u128 = args
                .get(3)
                .and_then(|s| s.parse().ok())
                .unwrap_or_else(|| usage());
            let mnemonic = lines.next().unwrap_or("").trim().to_string();
            let rpc = std::env::var("QUANTUS_RPC")
                .unwrap_or_else(|_| DEFAULT_QUANTUS_RPC.to_string());
            let rt = tokio::runtime::Runtime::new().expect("tokio runtime");
            let res = rt.block_on(async {
                let kr = Keyring::from_mnemonic(&mnemonic).map_err(|e| e.to_string())?;
                let adapter = QuantusAdapter::new(rpc).with_keyring(kr);
                adapter
                    .send_transfer(&dest, planks)
                    .await
                    .map_err(|e| e.to_string())
            });
            match res {
                Ok(hash) => println!("txhash=0x{}", hex::encode(hash.0)),
                Err(e) => {
                    eprintln!("ERROR qtc-send: {e}");
                    std::process::exit(1);
                }
            }
        }
        Some(_) => usage(),
        None => {
            for line in lines.by_ref() {
                let m = line.trim();
                if m.is_empty() || m.starts_with('#') {
                    continue;
                }
                match Keyring::from_mnemonic(m) {
                    Ok(k) => {
                        let addr = k.address(ChainId::ZionL1, 0, 0).unwrap();
                        let pk = k.zion_public_key(0, 0).unwrap();
                        let sk = k.zion_signing_key(0, 0).unwrap();
                        // Quantus (QTC) address from the same keyring — deterministic
                        // ML-DSA-87 derivation m/44'/189'/0'/0/0, identical to the
                        // custodial ZIS wallet path.
                        let qtc = k
                            .address(ChainId::Quantus, 0, 0)
                            .map(|a| a.encoded)
                            .unwrap_or_else(|_| String::new());
                        println!(
                            "addr={} pk={} sk={} qtc={}",
                            addr.encoded,
                            pk,
                            hex::encode(sk.to_bytes()),
                            qtc,
                        );
                    }
                    Err(e) => eprintln!("ERROR: {} — {}", &m[..m.len().min(30)], e),
                }
            }
        }
    }
}

/// Full native-wallet bundle for one mnemonic.
fn derive_bundle(mnemonic: &str) -> Result<String, String> {
    let kr = Keyring::from_mnemonic(mnemonic).map_err(|e| e.to_string())?;
    let parsed = Mnemonic::parse(mnemonic).map_err(|e| e.to_string())?;
    let seed = parsed.to_seed("");

    // zion — wallet-compat: first 32 bytes of the BIP39 seed → ed25519.
    // (This is what wallet-generator.js / the web wallet do; it deliberately
    // differs from the custodial keyring keccak path.)
    let mut zion_seed = [0u8; 32];
    zion_seed.copy_from_slice(&seed[..32]);
    let zion_sk = EdSigningKey::from_bytes(&zion_seed);
    let zion_pk = zion_sk.verifying_key().to_bytes();
    let zion_addr = derive_zion_address(&zion_pk);

    // evm — BIP32 m/44'/60'/0'/0/0 (MetaMask-compatible). Built directly via
    // MnemonicBuilder (Keyring::evm_wallet is crate-private).
    let evm_wallet = MnemonicBuilder::<English>::default()
        .phrase(PathOrString::String(mnemonic.to_string()))
        .derivation_path("m/44'/60'/0'/0/0")
        .map_err(|e| e.to_string())?
        .build()
        .map_err(|e| e.to_string())?;
    let evm_addr = format!("0x{}", hex::encode(evm_wallet.address().as_bytes()));
    let evm_priv = format!("0x{}", hex::encode(evm_wallet.signer().to_bytes()));

    // bitcoin — BIP84 m/84'/0'/0'/0/0 → P2WPKH.
    let (btc_priv, _btc_pub) = kr
        .bitcoin_key_pair(bitcoin::Network::Bitcoin, 0, 0)
        .map_err(|e| e.to_string())?;
    let btc_addr = kr
        .bitcoin_address_for_network(bitcoin::Network::Bitcoin, 0, 0)
        .map_err(|e| e.to_string())?;

    // solana — SLIP-0010 m/44'/501'/0'/0' → ed25519 → base58 pubkey.
    let sol_seed = slip10_ed25519(&seed, &[44 | HARD, 501 | HARD, 0 | HARD, 0 | HARD]);
    let sol_sk = EdSigningKey::from_bytes(&sol_seed);
    let sol_pk = sol_sk.verifying_key().to_bytes();
    let sol_addr = bs58::encode(&sol_pk).into_string();
    let mut sol_secret = Vec::with_capacity(64);
    sol_secret.extend_from_slice(&sol_seed);
    sol_secret.extend_from_slice(&sol_pk);

    // quantus — keyring ML-DSA-87 (custodial-compatible path).
    let qtc_kp: QuantusKeypair = kr.quantus_keypair(0, 0);
    let qtc_addr = qtc_kp.ss58_address();
    let qtc_pk = hex::encode(qtc_kp.public_key());

    // custodial reference addresses (warpd keyring paths — different by design).
    let zion_keyring_addr = kr
        .address(ChainId::ZionL1, 0, 0)
        .map(|a| a.encoded)
        .unwrap_or_default();

    let out = serde_json::json!({
        "zion": {
            "chain": "zion-l1",
            "address": zion_addr,
            "publicKey": hex::encode(zion_pk),
            "secretKey": hex::encode(zion_seed),
            "path": "bip39-seed[0:32]",
            "standard": "zion-native (desktop/web wallet compatible)",
        },
        "evm": {
            "chain": "evm",
            "address": evm_addr,
            "privateKey": evm_priv,
            "path": "m/44'/60'/0'/0/0",
            "standard": "bip44 — same address on all EVM chains (eth/base/bsc/…)",
        },
        "bitcoin": {
            "chain": "bitcoin",
            "address": btc_addr.encoded,
            "privateKey": hex::encode(btc_priv.inner.secret_bytes()),
            "privateKeyWif": btc_priv.to_wif(),
            "path": "m/84'/0'/0'/0/0",
            "standard": "bip84 p2wpkh",
        },
        "solana": {
            "chain": "solana",
            "address": sol_addr,
            "secretKey": bs58::encode(&sol_secret).into_string(),
            "path": "m/44'/501'/0'/0'",
            "standard": "slip-0010 ed25519 (Phantom-compatible)",
        },
        "quantus": {
            "chain": "quantus",
            "address": qtc_addr,
            "publicKey": qtc_pk,
            "path": "m/44'/189'/0'/0/0",
            "standard": "ml-dsa-87 — signing via helper only",
        },
        "custodial": {
            "zionKeyring": zion_keyring_addr,
            "note": "warpd keyring-path derivations — differ from native by design",
        },
    });
    Ok(out.to_string())
}

fn sign_message(
    mnemonic: &str,
    chain: &str,
    msg: &[u8],
    account: u32,
    index: u32,
) -> Result<Vec<u8>, String> {
    let parsed = Mnemonic::parse(mnemonic).map_err(|e| e.to_string())?;
    let seed = parsed.to_seed("");
    match chain {
        // Native zion key (wallet-compat seed[0:32]) — for ZIS account linking.
        "zion" => {
            let mut s = [0u8; 32];
            s.copy_from_slice(&seed[..32]);
            Ok(EdSigner::sign(&EdSigningKey::from_bytes(&s), msg)
                .to_bytes()
                .to_vec())
        }
        "solana" => {
            let s = slip10_ed25519(&seed, &[44 | HARD, 501 | HARD, 0 | HARD, index | HARD]);
            Ok(EdSigner::sign(&EdSigningKey::from_bytes(&s), msg)
                .to_bytes()
                .to_vec())
        }
        // Custom ZIS link proof-of-key: 65B compact recoverable ECDSA over
        // sha256("ZION-BTC-LINK-V1" ‖ 0x00 ‖ msg). Server recomputes P2WPKH.
        "bitcoin" => {
            let kr = Keyring::from_mnemonic(mnemonic).map_err(|e| e.to_string())?;
            let (priv_key, _pub) = kr
                .bitcoin_key_pair(bitcoin::Network::Bitcoin, account, index)
                .map_err(|e| e.to_string())?;
            let digest = sha2::Sha256::digest(
                [
                    b"ZION-BTC-LINK-V1".as_slice(),
                    &[0u8],
                    msg,
                ]
                .concat(),
            );
            let secp = bitcoin::secp256k1::Secp256k1::new();
            let m = bitcoin::secp256k1::Message::from_digest(digest.into());
            let sig = secp.sign_ecdsa_recoverable(&m, &priv_key.inner);
            let (recid, compact) = sig.serialize_compact();
            let mut out = compact.to_vec();
            out.push(recid.to_i32() as u8);
            Ok(out)
        }
        "evm" | "zion-keyring" | "quantus" => {
            let kr = Keyring::from_mnemonic(mnemonic).map_err(|e| e.to_string())?;
            let cid = match chain {
                "evm" => ChainId::Base,
                "zion-keyring" => ChainId::ZionL1,
                _ => ChainId::Quantus,
            };
            kr.sign(cid, msg, account, index).map_err(|e| e.to_string())
        }
        _ => Err(format!("unsupported chain '{chain}'")),
    }
}

const HARD: u32 = 0x8000_0000;

/// SLIP-0010 ed25519 derivation (hardened-only) without an `hmac` dep.
fn slip10_ed25519(seed: &[u8], path: &[u32]) -> [u8; 32] {
    let mut i = hmac_sha512(b"ed25519 seed", seed);
    for &index in path {
        let mut data = Vec::with_capacity(37);
        data.push(0x00);
        data.extend_from_slice(&i[..32]);
        data.extend_from_slice(&index.to_be_bytes());
        i = hmac_sha512(&i[32..], &data);
    }
    i[..32].try_into().expect("slip10 output is 64 bytes")
}

fn hmac_sha512(key: &[u8], data: &[u8]) -> [u8; 64] {
    const BLOCK: usize = 128;
    let mut k = [0u8; BLOCK];
    if key.len() > BLOCK {
        let h = Sha512::digest(key);
        k[..64].copy_from_slice(&h);
    } else {
        k[..key.len()].copy_from_slice(key);
    }
    let mut inner = Sha512::new();
    for &b in &k {
        inner.update([b ^ 0x36]);
    }
    inner.update(data);
    let inner_hash = inner.finalize();
    let mut outer = Sha512::new();
    for &b in &k {
        outer.update([b ^ 0x5c]);
    }
    outer.update(inner_hash);
    outer.finalize().into()
}
