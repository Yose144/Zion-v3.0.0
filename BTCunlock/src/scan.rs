//! Derivation-path scanner: takes a valid mnemonic and walks the standard
//! BIP44/49/84 trees (accounts × external/change × index range), then checks
//! each derived address for balance/history via an esplora-compatible API.
//!
//! This is how most "lost" BTC is actually found — the seed is right, the
//! wallet software used a different path or script type than expected.

use anyhow::{bail, Context, Result};
use bip39::{Language, Mnemonic};
use bitcoin::bip32::{DerivationPath, Xpriv};
use bitcoin::secp256k1::Secp256k1;
use bitcoin::{Address, Network, PrivateKey, PublicKey};
use serde::Deserialize;
use std::str::FromStr;

#[derive(Deserialize)]
struct AddrStats {
    funded_txo_sum: u64,
    spent_txo_sum: u64,
    tx_count: u64,
}
#[derive(Deserialize)]
struct AddrInfo {
    chain_stats: AddrStats,
    mempool_stats: AddrStats,
}

fn net(s: &str) -> Result<Network> {
    match s {
        "mainnet" | "bitcoin" => Ok(Network::Bitcoin),
        "testnet" | "testnet3" | "testnet4" => Ok(Network::Testnet),
        "signet" => Ok(Network::Signet),
        other => bail!("unknown network '{other}' (mainnet|testnet|signet)"),
    }
}

fn default_api(network: Network) -> &'static str {
    match network {
        Network::Testnet => "https://mempool.space/testnet/api",
        Network::Signet => "https://mempool.space/signet/api",
        _ => "https://mempool.space/api",
    }
}

fn derive_addr(
    xpriv: &Xpriv,
    secp: &Secp256k1<bitcoin::secp256k1::All>,
    purpose: u32,
    coin: u32,
    account: u32,
    change: u32,
    index: u32,
    network: Network,
) -> Result<Address> {
    let path =
        DerivationPath::from_str(&format!("m/{purpose}'/{coin}'/{account}'/{change}/{index}"))?;
    let child = xpriv.derive_priv(secp, &path)?;
    let pk = PublicKey::new(child.private_key.public_key(secp));
    let addr = match purpose {
        44 => Address::p2pkh(&pk, network),
        49 => Address::p2shwpkh(&pk, network).context("p2shwpkh")?,
        84 => Address::p2wpkh(&pk, network).context("p2wpkh")?,
        _ => unreachable!(),
    };
    Ok(addr)
}

fn check_balance(api: &str, addr: &Address) -> Result<Option<(u64, u64)>> {
    let url = format!("{}/address/{}", api.trim_end_matches('/'), addr);
    let resp = reqwest::blocking::get(&url);
    match resp {
        Ok(r) if r.status().is_success() => {
            let info: AddrInfo = r.json()?;
            let funded = info.chain_stats.funded_txo_sum + info.mempool_stats.funded_txo_sum;
            let spent = info.chain_stats.spent_txo_sum + info.mempool_stats.spent_txo_sum;
            let txs = info.chain_stats.tx_count + info.mempool_stats.tx_count;
            if funded == 0 && txs == 0 {
                Ok(None)
            } else {
                Ok(Some((funded.saturating_sub(spent), txs)))
            }
        }
        Ok(r) => bail!("{} → HTTP {}", addr, r.status()),
        Err(e) => bail!("{} → {e}", addr),
    }
}

/// Scan `mnemonic` across BIP44/49/84 × coin type × accounts × change × index.
/// Prints only addresses with history/balance (plus a per-path summary).
pub fn scan_mnemonic(
    mnemonic: &str,
    network: &str,
    max_index: u32,
    accounts: u32,
    api: Option<&str>,
    offline: bool,
) -> Result<()> {
    let network = net(network)?;
    let m = Mnemonic::parse_in_normalized(Language::English, mnemonic)
        .context("invalid mnemonic (checksum)")?;
    let secp = Secp256k1::new();
    let seed = m.to_seed("");
    let xpriv = Xpriv::new_master(network, &seed)?;
    let coin = if network == Network::Bitcoin { 0 } else { 1 };
    let api = api.map(str::to_string).unwrap_or_else(|| default_api(network).into());
    let client_delay = std::time::Duration::from_millis(350); // be kind to public APIs

    let mut hits = 0usize;
    for purpose in [44u32, 49, 84] {
        for account in 0..accounts {
            for change in [0u32, 1] {
                let mut printed_path = false;
                for index in 0..max_index {
                    let addr =
                        derive_addr(&xpriv, &secp, purpose, coin, account, change, index, network)?;
                    if offline {
                        if !printed_path {
                            println!("m/{purpose}'/{coin}'/{account}'/{change}/…");
                            printed_path = true;
                        }
                        println!("  [{index}] {addr}");
                        continue;
                    }
                    match check_balance(&api, &addr) {
                        Ok(Some((bal, txs))) => {
                            if !printed_path {
                                println!("m/{purpose}'/{coin}'/{account}'/{change}/…");
                                printed_path = true;
                            }
                            println!(
                                "  [{index}] {addr}  balance={} sats  txs={txs}",
                                bal
                            );
                            hits += 1;
                        }
                        Ok(None) => {}
                        Err(e) => eprintln!("  warn: {e}"),
                    }
                    std::thread::sleep(client_delay);
                }
            }
        }
    }
    if offline {
        println!("offline scan complete (no balance checks)");
    } else {
        println!("scan complete — {hits} funded/used address(es) found");
    }
    Ok(())
}

/// Decode a WIF private key and show the addresses it controls.
pub fn wif_info(wif: &str) -> Result<()> {
    let pk = PrivateKey::from_wif(wif).context("invalid WIF")?;
    let secp = Secp256k1::new();
    let pubkey = PublicKey::new(pk.inner.public_key(&secp));
    println!("network:   {:?}", pk.network);
    println!("compressed: {}", pk.compressed);
    println!("pubkey:    {}", hex::encode(pubkey.inner.serialize()));
    println!("p2pkh:     {}", Address::p2pkh(&pubkey, pk.network));
    println!(
        "p2wpkh:    {}",
        Address::p2wpkh(&pubkey, pk.network).context("p2wpkh")?
    );
    Ok(())
}
