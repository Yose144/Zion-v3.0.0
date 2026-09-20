//! Recovery engine — the compute core shared by the CPU and GPU backends.
//!
//! Pipeline per candidate combo (a `u64` counter decomposed base-2048 into
//! the `?` hole slots):
//!   1. assemble word indices (template + hole values)
//!   2. BIP39 checksum prefilter — SHA-256 of packed entropy (~1/2^CS pass)
//!   3. PBKDF2-HMAC-SHA512(phrase, "mnemonic"+passphrase, 2048) → seed
//!   4. BIP32 derive each configured path → pubkey hash160 /
//!      P2SH-P2WPKH script hash160 → match against the target set
//!
//! Stages 1-4 all run on the GPU (kernel.cl `derive_match` — secp256k1 +
//! RIPEMD-160 in OpenCL); the CPU backend does everything in rayon threads.
//! GPU hits still get a host-side re-derive for reporting (cheap — hits
//! are rare), which doubles as an independent confirmation.

use anyhow::{bail, Context, Result};
use bip39::{Language, Mnemonic};
use bitcoin::bip32::{ChildNumber, DerivationPath, Xpriv};
use bitcoin::hashes::{hash160, Hash};
use bitcoin::secp256k1::{All, Secp256k1};
use bitcoin::{Address, Network, PublicKey};
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::str::FromStr;

pub const WORDLIST: &str = include_str!("wordlist_en.txt");
pub const HOLE: u16 = 0xFFFF;
pub const MAX_WORDS: usize = 24;
/// Hard cap on `?` slots — kernel buffer bound. 4+ missing words is
/// infeasible anyway (2048^4 ≈ 1.7e13 combos, days on a GPU rig).
pub const MAX_HOLES: usize = 6;

pub fn word_index(w: &str) -> Option<u16> {
    WORDLIST
        .lines()
        .position(|l| l.trim() == w)
        .map(|i| i as u16)
}

pub fn word_at(i: u16) -> &'static str {
    WORDLIST.lines().nth(i as usize).unwrap().trim()
}

/// A parsed phrase template: fixed word indices + `HOLE` markers.
pub struct Template {
    pub indices: Vec<u16>,
    pub holes: Vec<usize>,
    pub total_combos: u64,
}

pub fn parse_template(phrase: &str) -> Result<Template> {
    let parts: Vec<&str> = phrase.split_whitespace().collect();
    if ![12, 15, 18, 21, 24].contains(&parts.len()) {
        bail!(
            "phrase has {} words — must be 12/15/18/21/24",
            parts.len()
        );
    }
    let mut indices = Vec::with_capacity(parts.len());
    let mut holes = Vec::new();
    for (i, w) in parts.iter().enumerate() {
        if matches!(*w, "?" | "_" | "x" | "X") {
            holes.push(i);
            indices.push(HOLE);
        } else {
            match word_index(w) {
                Some(idx) => indices.push(idx),
                None => bail!("'{w}' (position {}) is not a BIP39 word — mark it '?' if unknown", i + 1),
            }
        }
    }
    if holes.is_empty() {
        bail!("no placeholders — mark unknown words with ?");
    }
    if holes.len() > MAX_HOLES {
        bail!("{} unknown words — max {MAX_HOLES} supported", holes.len());
    }
    let total = 2048u64.checked_pow(holes.len() as u32).unwrap();
    Ok(Template {
        indices,
        holes,
        total_combos: total,
    })
}

/// Decompose `combo` into hole word indices (most-significant hole first)
/// and overlay them on the template. Returns the full index list.
pub fn combo_indices(tpl: &Template, mut combo: u64, out: &mut [u16; MAX_WORDS]) {
    out[..tpl.indices.len()].copy_from_slice(&tpl.indices);
    for &hp in tpl.holes.iter().rev() {
        out[hp] = (combo % 2048) as u16;
        combo /= 2048;
    }
}

/// Pack 11-bit word indices into entropy bytes (BIP39 §encoding).
/// Returns (entropy_bytes, checksum_bits_from_indices).
fn entropy_and_cs(indices: &[u16]) -> ([u8; 32], usize, u8, usize) {
    let n = indices.len();
    let total_bits = n * 11;
    let cs_bits = total_bits / 33; // ENT/32
    let ent_bits = total_bits - cs_bits;
    let ent_bytes = ent_bits / 8;
    let mut ent = [0u8; 32];
    for (i, &idx) in indices.iter().enumerate() {
        for b in 0..11 {
            let bit = (idx >> (10 - b)) & 1;
            let pos = i * 11 + b;
            if pos < ent_bits {
                ent[pos / 8] |= (bit as u8) << (7 - pos % 8);
            }
        }
    }
    // checksum bits = trailing cs_bits of the index stream
    let mut cs_val: u8 = 0;
    for b in 0..cs_bits {
        let pos = ent_bits + b;
        let word = pos / 11;
        let bit = (indices[word] >> (10 - pos % 11)) & 1;
        cs_val |= (bit as u8) << (7 - b);
    }
    (ent, ent_bytes, cs_val, cs_bits)
}

/// BIP39 checksum test on word indices — no string building needed.
pub fn indices_checksum_ok(indices: &[u16]) -> bool {
    let (ent, ent_bytes, cs_val, cs_bits) = entropy_and_cs(indices);
    let h = Sha256::digest(&ent[..ent_bytes]);
    let mask: u8 = if cs_bits == 8 { 0xFF } else { 0xFF << (8 - cs_bits) };
    (h[0] & mask) == cs_val
}

/// Build the phrase string for a combo (only for checksum-valid ones).
pub fn combo_phrase(tpl: &Template, combo: u64) -> String {
    let mut idx = [0u16; MAX_WORDS];
    combo_indices(tpl, combo, &mut idx);
    idx[..tpl.indices.len()]
        .iter()
        .map(|&i| word_at(i))
        .collect::<Vec<_>>()
        .join(" ")
}

/// PBKDF2-HMAC-SHA512 — identical to `Mnemonic::to_seed` without re-parse.
pub fn phrase_seed(phrase: &str, passphrase: &str, seed: &mut [u8; 64]) {
    let salt = format!("mnemonic{passphrase}");
    pbkdf2::pbkdf2_hmac::<sha2::Sha512>(phrase.as_bytes(), salt.as_bytes(), 2048, seed);
}

/// Decoded target: a 20-byte hash (pubkey hash or script hash).
#[derive(Default)]
pub struct TargetSet {
    pub hashes: HashSet<[u8; 20]>,
}

impl TargetSet {
    /// Accepts base58 P2PKH/P2SH, bech32 P2WPKH, or raw 40-hex hash160.
    pub fn add(&mut self, s: &str) -> Result<()> {
        let s = s.trim();
        if s.len() == 40 && s.chars().all(|c| c.is_ascii_hexdigit()) {
            let mut h = [0u8; 20];
            hex::decode_to_slice(s, &mut h)?;
            self.hashes.insert(h);
            return Ok(());
        }
        let addr = Address::from_str(s)
            .context("not an address / hash160")?
            .assume_checked();
        let spk = addr.script_pubkey();
        let b = spk.as_bytes();
        let h: Option<[u8; 20]> = if spk.is_p2pkh() {
            Some(b[3..23].try_into().unwrap())
        } else if spk.is_p2sh() {
            Some(b[2..22].try_into().unwrap())
        } else if spk.is_p2wpkh() {
            Some(b[2..22].try_into().unwrap())
        } else {
            None
        };
        match h {
            Some(h) => {
                self.hashes.insert(h);
                Ok(())
            }
            None => bail!("{s}: P2WSH/P2TR targets unsupported (v0.2 supports P2PKH/P2SH/P2WPKH)"),
        }
    }

    pub fn is_empty(&self) -> bool {
        self.hashes.is_empty()
    }
}

/// Which derivation paths each seed is checked against.
/// Structured so `match_seed` can share intermediate nodes: with
/// --change-chain/--max-index/--accounts the m/p'/coin'/acct' prefixes are
/// derived once per seed instead of once per leaf path (≈4-5x fewer CKDs
/// on wide scans; identical for the default single-path-per-purpose plan).
pub struct DerivePlan {
    pub purposes: Vec<u32>,
    pub coin: u32,
    pub accounts: u32,
    pub chains: Vec<u32>,
    pub max_index: u32,
    pub network: Network,
    /// Flattened leaf paths — kept for logging/diagnostics.
    pub paths: Vec<DerivationPath>,
}

impl DerivePlan {
    /// Standard recovery set: BIP44/49/84 × accounts × receive/change × index.
    pub fn standard(
        network: Network,
        purposes: &[u32],
        accounts: u32,
        max_index: u32,
        both_chains: bool,
    ) -> Result<Self> {
        let coin = if network == Network::Bitcoin { 0 } else { 1 };
        let changes: &[u32] = if both_chains { &[0, 1] } else { &[0] };
        let mut paths = Vec::new();
        for &p in purposes {
            for a in 0..accounts {
                for &c in changes {
                    for i in 0..max_index.max(1) {
                        paths.push(DerivationPath::from_str(&format!(
                            "m/{p}'/{coin}'/{a}'/{c}/{i}"
                        ))?);
                    }
                }
            }
        }
        Ok(DerivePlan {
            purposes: purposes.to_vec(),
            coin,
            accounts: accounts.max(1),
            chains: changes.to_vec(),
            max_index: max_index.max(1),
            network,
            paths,
        })
    }
}

fn check_leaf(
    child: &Xpriv,
    secp: &Secp256k1<All>,
    path: String,
    check_script_hash: bool,
    network: Network,
    targets: &TargetSet,
    hits: &mut Vec<(String, Address)>,
) {
    let pk = PublicKey::new(child.private_key.public_key(secp));
    let mut pk_hash = [0u8; 20];
    pk_hash.copy_from_slice(&hash160::Hash::hash(&pk.inner.serialize())[..]);
    // P2PKH / P2WPKH share the pubkey hash160 → one lookup covers both.
    if targets.hashes.contains(&pk_hash) {
        hits.push((path, Address::p2wpkh(&pk, network).expect("p2wpkh")));
        return;
    }
    // P2SH-P2WPKH (purpose 49 only): hash160 of the 0x0014<h160> redeem script.
    if !check_script_hash {
        return;
    }
    let mut redeem = [0u8; 22];
    redeem[1] = 0x14;
    redeem[2..].copy_from_slice(&pk_hash);
    let mut sh = [0u8; 20];
    sh.copy_from_slice(&hash160::Hash::hash(&redeem)[..]);
    if targets.hashes.contains(&sh) {
        hits.push((path, Address::p2shwpkh(&pk, network).expect("p2shwpkh")));
    }
}

/// Stage-4 host check with a caller-provided secp context (context creation
/// is not free — reuse it across seeds; see runner's `map_init`).
pub fn match_seed_ctx(
    seed: &[u8; 64],
    plan: &DerivePlan,
    targets: &TargetSet,
    secp: &Secp256k1<All>,
) -> Vec<(String, Address)> {
    let Ok(master) = Xpriv::new_master(plan.network, seed) else {
        return Vec::new();
    };
    let mut hits = Vec::new();
    for &p in &plan.purposes {
        let Ok(hp) = ChildNumber::from_hardened_idx(p) else {
            continue;
        };
        let Ok(np) = master.derive_priv(secp, &[hp]) else {
            continue;
        };
        let Ok(hc) = ChildNumber::from_hardened_idx(plan.coin) else {
            continue;
        };
        let Ok(npc) = np.derive_priv(secp, &[hc]) else {
            continue;
        };
        for a in 0..plan.accounts {
            let Ok(ha) = ChildNumber::from_hardened_idx(a) else {
                continue;
            };
            let Ok(na) = npc.derive_priv(secp, &[ha]) else {
                continue;
            };
            for &c in &plan.chains {
                let Ok(ncn) = ChildNumber::from_normal_idx(c) else {
                    continue;
                };
                let Ok(nc) = na.derive_priv(secp, &[ncn]) else {
                    continue;
                };
                for i in 0..plan.max_index {
                    let Ok(ni) = ChildNumber::from_normal_idx(i) else {
                        continue;
                    };
                    let Ok(child) = nc.derive_priv(secp, &[ni]) else {
                        continue;
                    };
                    check_leaf(
                        &child,
                        secp,
                        format!("m/{p}'/{}'/{a}'/{c}/{i}", plan.coin),
                        p == 49,
                        plan.network,
                        targets,
                        &mut hits,
                    );
                }
            }
        }
    }
    hits
}

/// Stage-4 host check: derive a seed over `plan`, return hits.
/// (tests + ad-hoc callers; the hot loop uses `match_seed_ctx` via rayon)
#[allow(dead_code)]
pub fn match_seed(
    seed: &[u8; 64],
    plan: &DerivePlan,
    targets: &TargetSet,
) -> Vec<(String, Address)> {
    let secp = Secp256k1::new();
    match_seed_ctx(seed, plan, targets, &secp)
}

/// Number of permutations of `n` word slots (n!, saturating at u64::MAX).
pub fn perm_total(n: usize) -> u64 {
    (1..=n as u64).try_fold(1u64, |a, b| a.checked_mul(b)).unwrap_or(u64::MAX)
}

/// Decode permutation number `p` (0 ≤ p < n!) into word indices via the
/// factoradic/Lehmer scheme. `words` must be the full known word list —
/// every p yields a distinct arrangement (duplicates produce dup phrases).
pub fn perm_indices(words: &[u16], mut p: u64, out: &mut [u16; MAX_WORDS]) {
    let n = words.len();
    let mut pool: Vec<u16> = words.to_vec();
    for (k, slot) in out.iter_mut().enumerate().take(n) {
        let m = (n - k) as u64;
        let i = (p % m) as usize;
        *slot = pool.remove(i);
        p /= m;
    }
}

/// Fast 64-bit FNV-1a over a word-index slice — phrase identity key for
/// dedupe (duplicate input words make many perm ids produce one phrase).
fn idx_key(idx: &[u16]) -> u64 {
    let mut h = 0xcbf29ce484222325u64;
    for &w in idx {
        h ^= w as u64;
        h = h.wrapping_mul(0x100000001b3);
    }
    h
}

/// CPU batch over the permutation domain: `base..base+count` permutation
/// numbers → checksum → dedupe → PBKDF2 → `(perm, seed)`.
/// `dedup` (when given) persists across batches so repeated phrases from
/// duplicate input words are PBKDF2'd only once per run.
pub fn perm_seeds(
    words: &[u16],
    pass: &str,
    base: u64,
    count: u32,
    dedup: Option<&mut std::collections::HashSet<u64>>,
) -> Vec<(u64, [u8; 64])> {
    use rayon::prelude::*;
    let n = words.len();
    // stage 1: parallel factoradic decode + checksum filter
    let cands: Vec<(u64, [u16; MAX_WORDS])> = (0..count as u64)
        .into_par_iter()
        .filter_map(|off| {
            let p = base + off;
            let mut idx = [0u16; MAX_WORDS];
            perm_indices(words, p, &mut idx);
            if !indices_checksum_ok(&idx[..n]) {
                return None;
            }
            Some((p, idx))
        })
        .collect();
    // stage 2: drop duplicate phrases, then PBKDF2 the survivors
    let mut dedup = dedup;
    let mut uniq: Vec<(u64, [u16; MAX_WORDS])> = Vec::with_capacity(cands.len());
    for (p, idx) in cands {
        if let Some(set) = dedup.as_deref_mut() {
            if !set.insert(idx_key(&idx[..n])) {
                continue;
            }
        }
        uniq.push((p, idx));
    }
    uniq.into_par_iter()
        .map(|(p, idx)| {
            let phrase = idx[..n]
                .iter()
                .map(|&i| word_at(i))
                .collect::<Vec<_>>()
                .join(" ");
            let mut seed = [0u8; 64];
            phrase_seed(&phrase, pass, &mut seed);
            (p, seed)
        })
        .collect()
}

/// Rebuild the phrase for a given permutation number (hit reporting).
pub fn perm_phrase(words: &[u16], p: u64) -> String {
    let mut idx = [0u16; MAX_WORDS];
    perm_indices(words, p, &mut idx);
    idx[..words.len()]
        .iter()
        .map(|&i| word_at(i))
        .collect::<Vec<_>>()
        .join(" ")
}

/// CPU batch: combos `base..base+count` → checksum+PBKDF2 → `(combo, seed)`.
/// Rayon-parallel; the GPU backend runs the same two stages in-kernel.
pub fn cpu_seeds(tpl: &Template, pass: &str, base: u64, count: u32) -> Vec<(u64, [u8; 64])> {
    use rayon::prelude::*;
    (0..count as u64)
        .into_par_iter()
        .filter_map(|off| {
            let combo = base + off;
            let mut idx = [0u16; MAX_WORDS];
            combo_indices(tpl, combo, &mut idx);
            if !indices_checksum_ok(&idx[..tpl.indices.len()]) {
                return None;
            }
            let phrase = idx[..tpl.indices.len()]
                .iter()
                .map(|&i| word_at(i))
                .collect::<Vec<_>>()
                .join(" ");
            let mut seed = [0u8; 64];
            phrase_seed(&phrase, pass, &mut seed);
            Some((combo, seed))
        })
        .collect()
}

/// Validate a finished phrase parses under bip39 (belt-and-suspenders on hit).
pub fn verify_phrase(phrase: &str) -> Result<Mnemonic> {
    Mnemonic::parse_in_normalized(Language::English, phrase).context("bip39 re-verify failed")
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Deterministic, valid 24-word phrase — a *test vector*, not a wallet.
    /// (abandon×23 + art is the canonical BIP39 zero-entropy-ish example.)
    const KNOWN: &str = "abandon abandon abandon abandon abandon abandon abandon abandon \
        abandon abandon abandon abandon abandon abandon abandon abandon \
        abandon abandon abandon abandon abandon abandon abandon art";

    #[test]
    fn known_phrase_is_valid() {
        Mnemonic::parse_in_normalized(Language::English, KNOWN).unwrap();
    }

    #[test]
    fn checksum_prefilter_matches_bip39() {
        let tpl = parse_template(&KNOWN.replacen("art", "?", 1)).unwrap();
        let mut valids = 0;
        let mut idx = [0u16; MAX_WORDS];
        for c in 0..2048u64 {
            combo_indices(&tpl, c, &mut idx);
            if indices_checksum_ok(&idx[..24]) {
                valids += 1;
                // prefilter must agree with the real parser
                let phrase = combo_phrase(&tpl, c);
                Mnemonic::parse_in_normalized(Language::English, &phrase).unwrap();
            }
        }
        assert!(valids > 0 && valids < 256); // 24 words → ~1/256 of 2048
    }

    #[test]
    fn seed_matches_bip39_crate() {
        let mut a = [0u8; 64];
        phrase_seed(KNOWN, "", &mut a);
        let m = Mnemonic::parse_in_normalized(Language::English, KNOWN).unwrap();
        assert_eq!(a, m.to_seed(""));
        // and with a passphrase
        phrase_seed(KNOWN, "toto", &mut a);
        assert_eq!(a, m.to_seed("toto"));
    }

    #[test]
    fn cpu_engine_finds_known_target() {
        // derive the test vector's own first BIP84 testnet address, mask the
        // last word, and require the engine to rediscover it by target match
        let m = Mnemonic::parse_in_normalized(Language::English, KNOWN).unwrap();
        let secp = Secp256k1::new();
        let seed = m.to_seed("");
        let xpriv = Xpriv::new_master(Network::Testnet, &seed).unwrap();
        let child = xpriv
            .derive_priv(&secp, &DerivationPath::from_str("m/84'/1'/0'/0/0").unwrap())
            .unwrap();
        let pk = PublicKey::new(child.private_key.public_key(&secp));
        let want = Address::p2wpkh(&pk, Network::Testnet).unwrap().to_string();

        let tpl = parse_template(&KNOWN.replacen("art", "?", 1)).unwrap();
        let mut targets = TargetSet::default();
        targets.add(&want).unwrap();
        let plan = DerivePlan::standard(Network::Testnet, &[84], 1, 1, false).unwrap();
        let seeds = cpu_seeds(&tpl, "", 0, 2048);
        let mut found = false;
        for (combo, seed) in seeds {
            for (path, addr) in match_seed(&seed, &plan, &targets) {
                found = true;
                let phrase = combo_phrase(&tpl, combo);
                verify_phrase(&phrase).unwrap();
                assert_eq!(phrase, KNOWN);
                assert_eq!(path, "m/84'/1'/0'/0/0");
                assert_eq!(addr.to_string(), want);
            }
        }
        assert!(found, "engine must rediscover the masked word");
    }
}
