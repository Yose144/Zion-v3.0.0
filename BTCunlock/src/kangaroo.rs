//! Pollard's lambda ("kangaroo") method for the bounded ECDLP:
//! given `Q = k·G` on secp256k1 with `a ≤ k < b`, recover `k` in
//! `O(√(b−a))` group operations instead of `O(b−a)` sequential scans.
//!
//! **Requires the public key.** It cannot operate on address/hash160-only
//! targets — open puzzle entries whose pubkey was never revealed on-chain
//! (e.g. #71, `pubkey_known: false`) are out of reach for this method by
//! construction, not by missing implementation.
//!
//! Classic two-herd walk with distinguished points:
//!   tame  T_i = m·G + d_t·G      (m = interval midpoint)
//!   wild  W_i = Q   + d_w·G
//! Both take pseudo-random jumps s(P) = 2^(x(P) mod J); distinguished
//! points (x ≡ 0 mod 2^D) are stored. A tame/wild collision gives
//! k = m + d_t − d_w (mod n).

use anyhow::{bail, Result};
use bitcoin::secp256k1::{PublicKey, Secp256k1, SecretKey};
use bitcoin::{Address, Network};
use std::collections::HashMap;
use std::time::Instant;

use crate::keyscan::{fmt_rate, iso_time, open_600_append, write_600, U256};

/// secp256k1 group order n.
pub fn group_n() -> U256 {
    // fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141
    U256::from_hex("fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141")
        .expect("group order is a valid scalar")
}

pub struct KangaOpts {
    pub start: U256,
    pub end: U256,
    /// distinguished-point bits; 0 → auto from range size.
    pub dp_bits: u32,
    /// hard step cap; 0 → auto (16·√range).
    pub max_steps: u64,
    /// also write hits into this dir (mode-600 hits.jsonl + txt).
    pub hits_dir: Option<std::path::PathBuf>,
    /// optional hook command, same env contract as keyscan --hit-cmd.
    pub hit_cmd: Option<String>,
}

#[allow(dead_code)]
pub struct KangaHit {
    pub key: U256,
    pub steps: u64,
    pub dps: u64,
}

fn bits_of(v: &U256) -> u32 {
    for i in (0..8).rev() {
        if v.0[i] != 0 {
            return 32 - v.0[i].leading_zeros() + i as u32 * 32;
        }
    }
    0
}

impl U256 {
    pub fn add_assign_u256(&mut self, o: &U256) -> u32 {
        let mut c = 0u64;
        for i in 0..8 {
            c += self.0[i] as u64 + o.0[i] as u64;
            self.0[i] = c as u32;
            c >>= 32;
        }
        c as u32
    }

    pub fn shr1(&self) -> U256 {
        let mut r = [0u32; 8];
        let mut carry = 0u32;
        for i in (0..8).rev() {
            r[i] = (self.0[i] >> 1) | carry;
            carry = self.0[i] << 31;
        }
        U256(r)
    }
}

/// secp256k1 scalar math on the host — secret keys are just U256 in (0,n).
fn sk_from_u256(v: &U256) -> Result<SecretKey> {
    Ok(SecretKey::from_slice(&v.to_be_bytes())?)
}

fn pk_from_u256(secp: &Secp256k1<bitcoin::secp256k1::All>, v: &U256) -> Result<PublicKey> {
    Ok(PublicKey::from_secret_key(secp, &sk_from_u256(v)?))
}

/// a − b (mod n) where a,b < n and the true difference is within ±n.
fn sub_mod_n(a: &U256, b: &U256) -> U256 {
    if a >= b {
        a.saturating_sub(b)
    } else {
        group_n().saturating_sub(&b.saturating_sub(a))
    }
}

fn dp_index(pk: &PublicKey) -> usize {
    let s = pk.serialize();
    let mut lo = [0u8; 8];
    lo.copy_from_slice(&s[25..33]);
    u64::from_be_bytes(lo) as usize
}

fn dp_x(pk: &PublicKey) -> u64 {
    let s = pk.serialize();
    let mut lo = [0u8; 8];
    lo.copy_from_slice(&s[25..33]);
    u64::from_be_bytes(lo)
}

/// Run the tame/wild walk. Returns Ok(Some(hit)) when k is found and
/// re-verified, Ok(None) on clean exhaustion of the step cap.
pub fn solve(opts: &KangaOpts, pubkey: &PublicKey) -> Result<Option<KangaHit>> {
    let secp = Secp256k1::new();
    if !(opts.start < opts.end) {
        bail!("need start < end");
    }
    let width = opts.end.saturating_sub(&opts.start);
    let wbits = bits_of(&width);
    if wbits < 4 {
        bail!("range too small for kangaroo — use keyscan");
    }

    // jump set: J scalars 2^0..2^(J-1); mean jump ≈ 2^(J-2) ≈ √width/4.
    let jcount = ((wbits / 2).max(4)).min(63) as usize;
    let mut jump_s = Vec::with_capacity(jcount);
    let mut jump_p = Vec::with_capacity(jcount);
    for i in 0..jcount {
        let s = U256::pow2(i as u32)?;
        jump_s.push(s);
        jump_p.push(pk_from_u256(&secp, &s)?);
    }
    let sqrt_est = 2f64.powi((wbits / 2 + 1) as i32);
    let max_steps = if opts.max_steps > 0 {
        opts.max_steps
    } else {
        (16.0 * sqrt_est) as u64
    };
    // distinguished-point bits: expected DPs ≈ steps/2^D ≈ 32.
    let dp_bits = if opts.dp_bits > 0 {
        opts.dp_bits.min(31)
    } else {
        ((wbits / 2).saturating_sub(5)).clamp(1, 24)
    };
    let dp_mask = (1u64 << dp_bits) - 1;

    // tame starts at the midpoint; wild starts at Q.
    let mut mid = opts.start;
    mid.add_assign_u256(&width.shr1());
    let mut tame_p = pk_from_u256(&secp, &mid)?;
    let mut wild_p = *pubkey;
    let mut tame_d = U256::zero();
    let mut wild_d = U256::zero();

    let mut dps: HashMap<[u8; 33], (U256, bool)> = HashMap::new();
    let mut steps = 0u64;
    let mut dp_hits = 0u64;
    let t0 = Instant::now();
    let mut last_report = Instant::now();

    eprintln!(
        "kangaroo: range [0x{}, 0x{}) width 2^{} — jumps {jcount} (mean ~2^{}), dp_bits {dp_bits}, max_steps {max_steps}",
        opts.start.to_hex_short(),
        opts.end.to_hex_short(),
        wbits,
        jcount - 2
    );

    while steps < max_steps {
        // ---- tame step
        let i = dp_index(&tame_p) % jcount;
        tame_p = tame_p.combine(&jump_p[i])?;
        tame_d.add_assign_u256(&jump_s[i]);
        steps += 1;
        let x = dp_x(&tame_p);
        if x & dp_mask == 0 {
            dp_hits += 1;
            let k = tame_p.serialize();
            if let Some(&(d_w, false)) = dps.get(&k) {
                if let Some(h) = finish(&secp, opts, pubkey, &mid, &tame_d, &d_w, steps, dp_hits)? {
                    return Ok(Some(h));
                }
            } else {
                dps.insert(k, (tame_d, true));
            }
        }
        // ---- wild step
        let i = dp_index(&wild_p) % jcount;
        wild_p = wild_p.combine(&jump_p[i])?;
        wild_d.add_assign_u256(&jump_s[i]);
        steps += 1;
        let x = dp_x(&wild_p);
        if x & dp_mask == 0 {
            dp_hits += 1;
            let k = wild_p.serialize();
            if let Some(&(d_t, true)) = dps.get(&k) {
                if let Some(h) = finish(&secp, opts, pubkey, &mid, &d_t, &wild_d, steps, dp_hits)? {
                    return Ok(Some(h));
                }
            } else {
                dps.insert(k, (wild_d, false));
            }
        }

        if last_report.elapsed().as_secs() >= 2 {
            let rate = steps as f64 / t0.elapsed().as_secs_f64();
            let expect = 2.0 * sqrt_est;
            eprintln!(
                "  {} steps ({:.1}% of ~2√n) — {} — {} dps — {} s",
                steps,
                100.0 * steps as f64 / expect,
                fmt_rate(rate),
                dps.len(),
                t0.elapsed().as_secs()
            );
            last_report = Instant::now();
        }
    }
    eprintln!("kangaroo: exhausted {max_steps} steps without collision");
    Ok(None)
}

/// Candidate from a tame/wild collision: k = m + d_t − d_w (mod n).
/// Verify against the pubkey AND the interval; bad candidates just mean
/// "keep walking" (a stray same-herd reuse, or distance bookkeeping race).
fn finish(
    secp: &Secp256k1<bitcoin::secp256k1::All>,
    opts: &KangaOpts,
    pubkey: &PublicKey,
    mid: &U256,
    d_t: &U256,
    d_w: &U256,
    steps: u64,
    dps: u64,
) -> Result<Option<KangaHit>> {
    let mut a = *mid;
    a.add_assign_u256(d_t);
    let k = sub_mod_n(&a, d_w);
    if k < opts.start || k >= opts.end {
        return Ok(None);
    }
    if pk_from_u256(secp, &k)? != *pubkey {
        return Ok(None);
    }
    eprintln!(
        "\nKANGAROO HIT\n  key:    0x{}\n  steps:  {steps}\n  dps:    {dps}",
        k.to_hex_short()
    );
    let wif = wif_of(&k)?;
    let addr = addr_of(secp, &k);
    eprintln!("  WIF:    {wif}\n  addr:   {addr}");
    persist(opts, &k, &wif, &addr, steps);
    Ok(Some(KangaHit {
        key: k,
        steps,
        dps,
    }))
}

fn wif_of(k: &U256) -> Result<String> {
    let sk = sk_from_u256(k)?;
    Ok(bitcoin::PrivateKey::new(sk, Network::Bitcoin).to_wif())
}

fn addr_of(secp: &Secp256k1<bitcoin::secp256k1::All>, k: &U256) -> String {
    pk_from_u256(secp, k)
        .map(|pk| {
            Address::p2pkh(&bitcoin::PublicKey::new(pk), Network::Bitcoin).to_string()
        })
        .unwrap_or_else(|_| "?".into())
}

/// Same persistence contract as keyscan hits: hits.jsonl + one txt per
/// hit, both mode 600, plus the optional hook.
fn persist(opts: &KangaOpts, k: &U256, wif: &str, addr: &str, steps: u64) {
    let Some(dir) = &opts.hits_dir else { return };
    let epoch = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let iso = iso_time(epoch);
    let rec = serde_json::json!({
        "ts": epoch, "time": iso, "method": "kangaroo",
        "key": format!("0x{}", k.to_hex_short()), "key_hex": k.to_hex(),
        "wif": wif, "address": addr, "label": "kangaroo",
        "range_start": format!("0x{}", opts.start.to_hex_short()),
        "range_end": format!("0x{}", opts.end.to_hex_short()),
        "steps": steps,
    });
    if let Err(e) = std::fs::create_dir_all(dir) {
        eprintln!("hit-backup: mkdir {}: {e}", dir.display());
        return;
    }
    let jsonl = dir.join("hits.jsonl");
    match open_600_append(&jsonl).and_then(|mut f| {
        use std::io::Write;
        writeln!(f, "{rec}")?;
        f.sync_all()
    }) {
        Ok(()) => eprintln!("hit-backup: appended → {}", jsonl.display()),
        Err(e) => eprintln!("hit-backup: write {}: {e}", jsonl.display()),
    }
    let txt = dir.join(format!("hit-{}-0x{}.txt", iso.replace([':', '-'], ""), k.to_hex_short()));
    let body = format!(
        "BTCunlock kangaroo hit\n\
         time:   {iso}\n\
         key:    0x{}\n\
         keyhex: {}\n\
         WIF:    {wif}\n\
         addr:   {addr}\n\
         range:  [0x{}, 0x{})\n\
         steps:  {steps}\n",
        k.to_hex_short(),
        k.to_hex(),
        opts.start.to_hex_short(),
        opts.end.to_hex_short(),
    );
    match write_600(&txt, &body) {
        Ok(()) => eprintln!("hit-backup: wrote → {}", txt.display()),
        Err(e) => eprintln!("hit-backup: write {}: {e}", txt.display()),
    }
    if let Some(cmd) = &opts.hit_cmd {
        let st = std::process::Command::new("sh")
            .arg("-c")
            .arg(cmd)
            .env("BTCUNLOCK_KEY", format!("0x{}", k.to_hex_short()))
            .env("BTCUNLOCK_KEY_HEX", k.to_hex())
            .env("BTCUNLOCK_WIF", wif)
            .env("BTCUNLOCK_ADDRESS", addr)
            .env("BTCUNLOCK_TARGET", "kangaroo")
            .env("BTCUNLOCK_LABEL", "kangaroo")
            .status();
        match st {
            Ok(s) if s.success() => eprintln!("hit-backup: --hit-cmd ok"),
            other => eprintln!("hit-backup: --hit-cmd: {other:?}"),
        }
    }
}

/// Parse a public key from hex: 02/03+64 (compressed) or 04+128 (uncompressed).
pub fn parse_pubkey(s: &str) -> Result<PublicKey> {
    let s = s.trim().trim_start_matches("0x");
    let raw = hex::decode(s).map_err(|e| anyhow::anyhow!("pubkey hex: {e}"))?;
    Ok(PublicKey::from_slice(&raw)?)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Recover k from pubkey over a small interval — the only proof that
    /// matters: given 0x1fa5ee5·G (puzzle #25's real key), find 0x1fa5ee5.
    #[test]
    fn kangaroo_solves_small_interval() {
        let secp = Secp256k1::new();
        let k = U256::from_hex("1fa5ee5").unwrap(); // puzzle #25 private key
        let q = pk_from_u256(&secp, &k).unwrap();
        let opts = KangaOpts {
            start: U256::pow2(24).unwrap(),
            end: U256::pow2(25).unwrap(),
            dp_bits: 0,
            max_steps: 0,
            hits_dir: None,
            hit_cmd: None,
        };
        let hit = solve(&opts, &q).unwrap().expect("kangaroo must find it");
        assert_eq!(hit.key, k);
    }

    /// Interval [a,b) not aligned to powers of two + key near the edge.
    #[test]
    fn kangaroo_ragged_interval() {
        let secp = Secp256k1::new();
        let k = U256::from_hex("beef00").unwrap();
        let q = pk_from_u256(&secp, &k).unwrap();
        let opts = KangaOpts {
            start: U256::from_hex("abc000").unwrap(),
            end: U256::from_hex("f00000").unwrap(),
            dp_bits: 0,
            max_steps: 0,
            hits_dir: None,
            hit_cmd: None,
        };
        let hit = solve(&opts, &q).unwrap().expect("must find it");
        assert_eq!(hit.key, k);
    }

    #[test]
    fn sub_mod_n_wraps() {
        let n = group_n();
        let one = U256::one();
        // 0 - 1 mod n = n-1
        let r = sub_mod_n(&U256::zero(), &one);
        assert_eq!(r, n.saturating_sub(&one));
        // 5 - 3 = 2
        let five = U256::from_hex("5").unwrap();
        let three = U256::from_hex("3").unwrap();
        assert_eq!(sub_mod_n(&five, &three), U256::from_hex("2").unwrap());
    }
}
