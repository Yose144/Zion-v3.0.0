//! BIP39 mnemonic completion: `?` placeholders are brute-filled from the
//! English wordlist and kept only when the checksum validates.
//!
//! Search space: 1 unknown = 2048 candidates, 2 unknowns = ~4.2M.
//! More than 2 unknowns is rejected — beyond that the legitimate use case
//! (a miswritten word or two) is gone and it becomes impractical anyway.

use anyhow::{bail, Context, Result};
use bip39::{Language, Mnemonic};
use bitcoin::bip32::{DerivationPath, Xpriv};
use bitcoin::secp256k1::Secp256k1;
use bitcoin::{Address, Network, PublicKey};
use std::str::FromStr;

/// BIP39 English wordlist (2048 words), vendored.
const WORDLIST: &str = include_str!("wordlist_en.txt");

fn words() -> impl Iterator<Item = &'static str> {
    WORDLIST.lines().map(str::trim).filter(|w| !w.is_empty())
}

/// Fill `?`/`_` slots in `phrase`, keep checksum-valid candidates.
pub fn fix_mnemonic(phrase: &str, derive_addr: bool) -> Result<()> {
    let parts: Vec<String> = phrase.split_whitespace().map(str::to_string).collect();
    let n = parts.len();
    if ![12, 15, 18, 21, 24].contains(&n) {
        bail!("phrase has {n} words — must be 12/15/18/21/24");
    }
    let holes: Vec<usize> = parts
        .iter()
        .enumerate()
        .filter(|(_, w)| matches!(w.as_str(), "?" | "_"))
        .map(|(i, _)| i)
        .collect();
    if holes.is_empty() {
        bail!("no placeholders — use ? or _ for unknown words");
    }
    if holes.len() > 2 {
        bail!("{} unknown words — max 2 supported", holes.len());
    }

    // Validate the known words early — a typo'd word is itself the common case.
    let wordset: std::collections::HashSet<&str> = words().collect();
    for (i, w) in parts.iter().enumerate() {
        if !holes.contains(&i) && !wordset.contains(w.as_str()) {
            println!("note: '{w}' is not in the BIP39 wordlist (position {})", i + 1);
        }
    }

    let word_vec: Vec<&str> = words().collect();
    let mut found = 0usize;
    let mut tested = 0u64;

    match holes.len() {
        1 => {
            for w in &word_vec {
                let mut cand = parts.clone();
                cand[holes[0]] = w.to_string();
                tested += 1;
                if let Ok(m) = Mnemonic::parse_in_normalized(Language::English, &cand.join(" ")) {
                    report(&cand.join(" "), &m, derive_addr);
                    found += 1;
                }
            }
        }
        2 => {
            for w1 in &word_vec {
                for w2 in &word_vec {
                    let mut cand = parts.clone();
                    cand[holes[0]] = w1.to_string();
                    cand[holes[1]] = w2.to_string();
                    tested += 1;
                    if let Ok(m) = Mnemonic::parse_in_normalized(Language::English, &cand.join(" "))
                    {
                        report(&cand.join(" "), &m, derive_addr);
                        found += 1;
                    }
                }
            }
        }
        _ => unreachable!(),
    }

    println!("tested {tested} combinations, {found} checksum-valid candidate(s)");
    Ok(())
}

fn report(phrase: &str, m: &Mnemonic, derive_addr: bool) {
    println!("VALID: {phrase}");
    if derive_addr {
        if let Ok(addr) = first_bip84(m) {
            println!("       m/84'/0'/0'/0/0 → {addr}");
        }
    }
}

/// First external BIP84 P2WPKH address (mainnet).
fn first_bip84(m: &Mnemonic) -> Result<Address> {
    let secp = Secp256k1::new();
    let seed = m.to_seed("");
    let xpriv = Xpriv::new_master(Network::Bitcoin, &seed)?;
    let path = DerivationPath::from_str("m/84'/0'/0'/0/0")?;
    let child = xpriv.derive_priv(&secp, &path)?;
    let pk = PublicKey::new(child.private_key.public_key(&secp));
    Address::p2wpkh(&pk, Network::Bitcoin).context("p2wpkh")
}
