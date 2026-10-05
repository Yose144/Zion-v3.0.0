//! Raw private-key range scanning — the "Bitcoin puzzle" mode.
//!
//! For every k in [start, end) compute k·G → compressed pubkey → hash160 →
//! match against the target set. Sequential coverage, not ECDLP — a hit is
//! guaranteed iff the key lies inside the scanned range, so it is only
//! useful for range-bound searches (the 2015 puzzle funds, a key you
//! partially know, self-tests). Scanning a random funded address's whole
//! 2^256 space is mathematically hopeless by design.
//!
//! GPU: `key_scan` kernel — each work-item walks `stride` keys (one
//! fixed-base scalar mult + stride-1 Jacobian additions of G, sharing ONE
//! Montgomery batch inversion for the affine conversions).
//! CPU: rayon chunks — one scalar mult per chunk, then `PublicKey::combine`
//! steps of +G.

use anyhow::{bail, Context, Result};
use bitcoin::hashes::{hash160, Hash};
use bitcoin::secp256k1::{PublicKey, Secp256k1, SecretKey};
use bitcoin::{Address, Network};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::io::Write;
use std::time::Instant;

/// Work-items per GPU launch (keys per launch = batch × stride).
pub const KS_MAX_STRIDE: u32 = 16;

// ---------------------------------------------------------------- U256

/// 256-bit scalar as little-endian u32 limbs — same layout the kernel uses.
/// NOTE: `Ord` must compare from the most significant limb down — the
/// derived array ordering starts at limb 0 (the LSB) and is wrong.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct U256(pub [u32; 8]);

impl Ord for U256 {
    fn cmp(&self, o: &Self) -> std::cmp::Ordering {
        for i in (0..8).rev() {
            match self.0[i].cmp(&o.0[i]) {
                std::cmp::Ordering::Equal => continue,
                ord => return ord,
            }
        }
        std::cmp::Ordering::Equal
    }
}

impl PartialOrd for U256 {
    fn partial_cmp(&self, o: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(o))
    }
}

#[allow(dead_code)]
impl U256 {
    pub fn zero() -> Self {
        U256([0; 8])
    }

    pub fn one() -> Self {
        let mut v = [0u32; 8];
        v[0] = 1;
        U256(v)
    }

    /// 2^bit — puzzle range bounds are powers of two.
    pub fn pow2(bit: u32) -> Result<Self> {
        if bit >= 256 {
            bail!("2^{bit} overflows 256 bits");
        }
        let mut v = [0u32; 8];
        v[(bit / 32) as usize] = 1 << (bit % 32);
        Ok(U256(v))
    }

    /// Big-endian hex (with or without 0x) — the format block explorers use.
    pub fn from_hex(s: &str) -> Result<Self> {
        let s = s.trim().trim_start_matches("0x").trim_start_matches("0X");
        if s.is_empty() || s.len() > 64 || !s.chars().all(|c| c.is_ascii_hexdigit()) {
            bail!("'{s}' is not a ≤64-char hex scalar");
        }
        let mut v = [0u32; 8];
        let padded = format!("{:0>64}", s);
        for i in 0..8 {
            v[7 - i] = u32::from_str_radix(&padded[i * 8..i * 8 + 8], 16)?;
        }
        Ok(U256(v))
    }

    pub fn to_hex(&self) -> String {
        let mut s = String::with_capacity(64);
        for i in (0..8).rev() {
            s.push_str(&format!("{:08x}", self.0[i]));
        }
        s
    }

    /// Compact hex for progress lines (leading zeros stripped).
    pub fn to_hex_short(&self) -> String {
        let s = self.to_hex();
        let t = s.trim_start_matches('0');
        if t.is_empty() {
            "0".into()
        } else {
            t.into()
        }
    }

    pub fn to_be_bytes(&self) -> [u8; 32] {
        let mut b = [0u8; 32];
        for i in 0..8 {
            b[i * 4..i * 4 + 4].copy_from_slice(&self.0[7 - i].to_be_bytes());
        }
        b
    }

    /// Self += add (u64); returns the carry-out (>0 → overflowed 2^256).
    pub fn add_u64(&mut self, add: u64) -> u32 {
        let mut c = (self.0[0] as u64) + (add as u32) as u64;
        self.0[0] = c as u32;
        c = (c >> 32) + self.0[1] as u64 + (add >> 32);
        self.0[1] = c as u32;
        c >>= 32;
        for i in 2..8 {
            if c == 0 {
                return 0;
            }
            c += self.0[i] as u64;
            self.0[i] = c as u32;
            c >>= 32;
        }
        c as u32
    }

    /// Saturating self - other (only called when self ≥ other).
    pub fn saturating_sub(&self, o: &U256) -> U256 {
        let mut r = [0u32; 8];
        let mut br = 0i64;
        for i in 0..8 {
            let d = self.0[i] as i64 - o.0[i] as i64 - br;
            r[i] = d as u32;
            br = if d < 0 { -1 } else { 0 };
        }
        U256(r)
    }

    /// Float approximation for progress math (fine at these magnitudes).
    pub fn to_f64(&self) -> f64 {
        let mut v = 0f64;
        for i in (0..8).rev() {
            v = v * 4294967296.0 + self.0[i] as f64;
        }
        v
    }

    /// Truncated to u64 (saturating) — used for rayon chunk indexing.
    pub fn low_u64(&self) -> u64 {
        self.0[0] as u64 | ((self.0[1] as u64) << 32)
    }

    pub fn from_be_bytes(b: &[u8; 32]) -> Self {
        let mut v = [0u32; 8];
        for i in 0..8 {
            v[7 - i] = u32::from_be_bytes(b[i * 4..i * 4 + 4].try_into().unwrap());
        }
        U256(v)
    }
}

// ------------------------------------------------------------- CPU walk

fn hash160_pub(pk: &PublicKey) -> [u8; 20] {
    hash160::Hash::hash(&pk.serialize()).to_byte_array()
}

/// CPU scan of `count` keys starting at `start` — rayon over chunks; each
/// chunk does ONE SecretKey→PublicKey scalar mult then walks `combine(+G)`.
/// Returns (target_index, key) hits.
pub fn cpu_scan(start: &U256, count: u64, targets: &[[u8; 20]], chunk: u64) -> Vec<(usize, U256)> {
    let n_chunks = count.div_ceil(chunk);
    let g_pub = {
        let secp = Secp256k1::new();
        let mut one_be = [0u8; 32];
        one_be[31] = 1;
        let one = SecretKey::from_slice(&one_be).unwrap();
        PublicKey::from_secret_key(&secp, &one)
    };
    (0..n_chunks)
        .into_par_iter()
        .flat_map(|ci| {
            let mut key = *start;
            key.add_u64(ci * chunk);
            let n = chunk.min(count - ci * chunk);
            let secp = Secp256k1::new();
            let mut hits = Vec::new();
            // chunk head: full scalar mult (skip keys that can't be scalars)
            let Ok(sk) = SecretKey::from_slice(&key.to_be_bytes()) else {
                return hits;
            };
            let mut pk = PublicKey::from_secret_key(&secp, &sk);
            for j in 0..n {
                let h = hash160_pub(&pk);
                if let Some(t) = targets.iter().position(|t| *t == h) {
                    hits.push((t, key));
                }
                if j + 1 < n {
                    match pk.combine(&g_pub) {
                        Ok(p) => pk = p,
                        Err(_) => break,
                    }
                    key.add_u64(1);
                }
            }
            hits
        })
        .collect()
}

// ----------------------------------------------------------- checkpoint

#[derive(Serialize, Deserialize)]
struct KsCheckpoint {
    job_hash: String,
    next_key: String,
    tested: u64,
    hits: u64,
}

fn job_hash(start: &U256, end: &U256, targets: &[[u8; 20]]) -> String {
    let mut h = Sha256::new();
    h.update(start.to_hex());
    h.update(end.to_hex());
    for t in targets {
        h.update(t);
    }
    hex::encode(h.finalize())
}

// ------------------------------------------------------------- runner

pub struct KeyscanOpts {
    /// Inclusive start key.
    pub start: U256,
    /// Exclusive end key — the loop covers [start, end).
    pub end: U256,
    /// Sorted hash160 targets (same order the GPU buffer uses).
    pub targets: Vec<[u8; 20]>,
    /// Display names for targets (same order) — addresses for reporting.
    pub target_names: Vec<String>,
    pub use_gpu: bool,
    #[allow(dead_code)]
    pub gpu_index: usize,
    /// Keys per GPU work-item / ignored on CPU (fixed internal stride).
    pub stride: u32,
    /// Work-items per GPU launch, or keys per CPU batch.
    pub batch: usize,
    pub checkpoint: Option<String>,
    pub resume: bool,
    /// Label for the header line (e.g. "puzzle #66").
    pub label: String,
}

fn fmt_rate(r: f64) -> String {
    if r >= 1e9 {
        format!("{:.2} Gk/s", r / 1e9)
    } else if r >= 1e6 {
        format!("{:.2} Mk/s", r / 1e6)
    } else if r >= 1e3 {
        format!("{:.1} Kk/s", r / 1e3)
    } else {
        format!("{:.0} k/s", r)
    }
}

fn fmt_eta(secs: f64) -> String {
    if !secs.is_finite() || secs > 3.0e11 {
        return ">10k years".into();
    }
    if secs > 31_536_000.0 {
        return format!("{:.0} years", secs / 31_536_000.0);
    }
    if secs > 86400.0 {
        return format!("{:.1} days", secs / 86400.0);
    }
    if secs > 3600.0 {
        return format!("{:.1} h", secs / 3600.0);
    }
    if secs > 60.0 {
        return format!("{:.0} min", secs / 60.0);
    }
    format!("{secs:.0}s")
}

fn report_hit(key: &U256, network: Network) {
    let kb = key.to_be_bytes();
    let sk = SecretKey::from_slice(&kb);
    let secp = Secp256k1::new();
    let (wif, addr) = match sk {
        Ok(sk) => {
            let pk = PublicKey::from_secret_key(&secp, &sk);
            let privk = bitcoin::PrivateKey::new(sk, network);
            let a = Address::p2pkh(&bitcoin::PublicKey::new(pk), network);
            (privk.to_wif(), a.to_string())
        }
        Err(_) => ("<key ≥ group order — re-check>".into(), "?".into()),
    };
    let mut out = std::io::stdout().lock();
    let _ = writeln!(out, "HIT  key=0x{}", key.to_hex_short());
    let _ = writeln!(out, "     key hex: {}", key.to_hex());
    let _ = writeln!(out, "     WIF:     {wif}");
    let _ = writeln!(out, "     address: {addr}");
    let _ = out.flush();
}

/// Verify a GPU-reported hit on the host: recompute pubkey hash160 and
/// require it to land back on the same target index.
fn verify_hit(key: &U256, tidx: usize, targets: &[[u8; 20]]) -> bool {
    let Ok(sk) = SecretKey::from_slice(&key.to_be_bytes()) else {
        return false;
    };
    let secp = Secp256k1::new();
    let pk = PublicKey::from_secret_key(&secp, &sk);
    targets
        .get(tidx)
        .map(|t| *t == hash160_pub(&pk))
        .unwrap_or(false)
}

pub fn run_keyscan(opts: KeyscanOpts) -> Result<()> {
    if opts.targets.is_empty() {
        bail!("no targets — pass --target <address> or --target-file");
    }
    if opts.start >= opts.end {
        bail!(
            "empty range: start {} ≥ end {}",
            opts.start.to_hex_short(),
            opts.end.to_hex_short()
        );
    }
    let size = opts.end.saturating_sub(&opts.start);
    let size_f = size.to_f64();
    if opts.stride < 1 || opts.stride > KS_MAX_STRIDE {
        bail!("--stride must be 1..={KS_MAX_STRIDE}");
    }

    let ckpt_path = opts
        .checkpoint
        .clone()
        .unwrap_or_else(|| "btcunlock-keys.ckpt".into());
    let jhash = job_hash(&opts.start, &opts.end, &opts.targets);
    let mut cur = opts.start;
    let mut tested = 0u64;
    let mut hit_count = 0u64;
    if opts.resume {
        match std::fs::read_to_string(&ckpt_path)
            .ok()
            .and_then(|s| serde_json::from_str::<KsCheckpoint>(&s).ok())
        {
            Some(ck) if ck.job_hash == jhash => {
                cur = U256::from_hex(&ck.next_key)?;
                tested = ck.tested;
                hit_count = ck.hits;
                eprintln!("resuming at key 0x{}", cur.to_hex_short());
            }
            _ => eprintln!("no usable checkpoint at {ckpt_path} — starting fresh"),
        }
    }
    let save_ck = |next: &U256, tested: u64, hits: u64| {
        let ck = KsCheckpoint {
            job_hash: jhash.clone(),
            next_key: next.to_hex(),
            tested,
            hits,
        };
        if let Ok(s) = serde_json::to_string(&ck) {
            let _ = std::fs::write(&ckpt_path, s);
        }
    };

    // GPU backend: kernel does the whole walk on-device; hits come back.
    #[cfg(feature = "gpu")]
    let mut gpu_dev = if opts.use_gpu {
        let mut g = crate::gpu::Gpu::init(opts.gpu_index, opts.batch)?;
        eprintln!("gpu: {}", g.device_name);
        g.bind_targets(&opts.targets)?;
        eprintln!(
            "gpu: key_scan — stride {} keys/item, batch inversion",
            opts.stride
        );
        Some(g)
    } else {
        None
    };
    if opts.use_gpu && cfg!(not(feature = "gpu")) {
        bail!("built without GPU support — cargo build --release --features gpu");
    }
    #[cfg(not(feature = "gpu"))]
    let _ = &opts.gpu_index;

    eprintln!(
        "keyscan{}: [0x{} .. 0x{}) — ~{:.3e} keys | {} target(s)",
        if opts.label.is_empty() {
            String::new()
        } else {
            format!(" ({})", opts.label)
        },
        opts.start.to_hex_short(),
        opts.end.to_hex_short(),
        size_f,
        opts.targets.len(),
    );
    for (i, n) in opts.target_names.iter().take(8).enumerate() {
        eprintln!("  target #{i}: {n}");
    }
    if opts.target_names.len() > 8 {
        eprintln!("  … +{} more targets", opts.target_names.len() - 8);
    }

    let t0 = Instant::now();
    let mut last_report = Instant::now();

    while cur < opts.end {
        // keys remaining (f64 — range can exceed u64)
        let remain_f = opts.end.saturating_sub(&cur).to_f64();

        let mut scanned: u64 = 0;
        #[cfg(feature = "gpu")]
        let hits: Vec<(usize, U256)> = if let Some(g) = gpu_dev.as_mut() {
            let stride = opts.stride as u64;
            // keys covered this launch ≈ batch items × stride
            let want_keys = (opts.batch as u64).saturating_mul(stride);
            let n_keys = (want_keys as f64).min(remain_f) as u64;
            let n_items = n_keys.div_ceil(stride).min(opts.batch as u64).max(1) as usize;
            scanned = (n_items as u64)
                .saturating_mul(stride)
                .min(remain_f as u64)
                .max(1);
            g.key_scan(&cur.0, opts.stride, n_items)?
                .iter()
                .map(|&(t, kb)| (t as usize, U256::from_be_bytes(&kb)))
                .collect()
        } else {
            Vec::new()
        };
        #[cfg(not(feature = "gpu"))]
        let hits: Vec<(usize, U256)> = Vec::new();

        let cpu_hits = if cfg!(feature = "gpu") && opts.use_gpu {
            Vec::new()
        } else {
            let n = (opts.batch as u64).min(remain_f as u64).max(1);
            scanned = n;
            cpu_scan(&cur, n, &opts.targets, 1 << 16)
        };
        #[cfg(feature = "gpu")]
        if !opts.use_gpu {
            scanned = (opts.batch as u64).min(remain_f as u64).max(1);
        }

        for (t, key) in hits.iter().chain(cpu_hits.iter()) {
            if verify_hit(key, *t, &opts.targets) {
                hit_count += 1;
                let name = opts.target_names.get(*t).cloned().unwrap_or_default();
                eprintln!("hit for target #{t} {name}");
                report_hit(key, Network::Bitcoin);
            } else {
                eprintln!(
                    "gpu: hit failed host verification (0x{}) — skipping",
                    key.to_hex_short()
                );
            }
        }

        cur.add_u64(scanned);
        tested += scanned;
        if cur > opts.end {
            cur = opts.end;
        }

        if last_report.elapsed().as_secs() >= 2 {
            let dt = t0.elapsed().as_secs_f64();
            let rate = tested as f64 / dt;
            let left = opts.end.saturating_sub(&cur).to_f64();
            let done_pct = 100.0 * (1.0 - left / size_f);
            eprintln!(
                "  0x{} ({:.4}%) — {} — {} hits — eta {}",
                cur.to_hex_short(),
                done_pct,
                fmt_rate(rate),
                hit_count,
                fmt_eta(left / rate.max(1.0)),
            );
            save_ck(&cur, tested, hit_count);
            last_report = Instant::now();
        }
    }

    save_ck(&cur, tested, hit_count);
    eprintln!(
        "done — {:.3e} keys, {} hit(s), {:.1}s",
        tested as f64,
        hit_count,
        t0.elapsed().as_secs_f64()
    );
    Ok(())
}

// ------------------------------------------------------- puzzle catalog

/// Resolve a 2015-puzzle number into (label, range, target-address).
/// Puzzle N's key lies in [2^(N-1), 2^N).
pub fn puzzle_range(n: u32) -> Result<(String, U256, U256, String, bool)> {
    let (id, addr, solved) = PUZZLES
        .iter()
        .find(|(i, _, _)| *i == n)
        .copied()
        .with_context(|| format!("puzzle #{n} unknown (valid: 1–160)"))?;
    Ok((
        format!("puzzle #{id}"),
        U256::pow2(n - 1)?,
        U256::pow2(n)?,
        addr.to_string(),
        solved,
    ))
}

include!("puzzle_table.rs");

// ------------------------------------------------------------ tests

#[cfg(test)]
mod tests {
    use super::*;

    fn t(h: &str) -> [u8; 20] {
        let b = hex::decode(h).unwrap();
        b.try_into().unwrap()
    }

    #[test]
    fn u256_hex_and_cmp() {
        let a = U256::from_hex("0xff").unwrap();
        assert_eq!(a.0[0], 0xff);
        for i in 1..8 {
            assert_eq!(a.0[i], 0);
        }
        assert_eq!(
            a.to_hex(),
            "00000000000000000000000000000000000000000000000000000000000000ff"
        );
        let b = U256::from_hex("0000000000000000000000000000000000000000000000000000000000000100")
            .unwrap();
        assert_eq!(b.0[0], 0x100);
        assert!(a < b);
        // limbs: little-endian — limb 7 is the most significant
        let hi = U256::pow2(255).unwrap();
        assert_eq!(hi.0[7], 0x8000_0000);
        assert!(U256::from_hex("0x").is_err());
        // cross-limb comparison — the bug that killed the first p71 run:
        // 2^70 + 4M must stay < 2^71 even though limb 0 is nonzero
        let mut x = U256::pow2(70).unwrap();
        x.add_u64(4_194_304);
        assert!(x < U256::pow2(71).unwrap());
        assert!(x > U256::pow2(70).unwrap());
        // any nonzero low limb must not dominate
        let lo = U256::from_hex("0xffffffff").unwrap();
        let mut hi2 = U256::zero();
        hi2.0[1] = 1; // 2^32
        assert!(lo < hi2);
    }

    #[test]
    fn u256_add_sub() {
        let mut a = U256::from_hex("0xffffffffffffffff").unwrap();
        a.add_u64(1);
        assert_eq!(
            a.to_hex(),
            "0000000000000000000000000000000000000000000000010000000000000000"
        );
        // wrap-around at 2^256 saturates the module's math silently only if
        // callers let it — carry out of limb 7 is dropped; assert the limbs.
        let mut m = U256::pow2(255).unwrap();
        m.add_u64(0); // no-op
        let d = U256::from_hex("0x10")
            .unwrap()
            .saturating_sub(&U256::from_hex("0x1").unwrap());
        assert_eq!(
            d.to_hex(),
            "000000000000000000000000000000000000000000000000000000000000000f"
        );
    }

    #[test]
    fn cpu_scan_finds_key_one() {
        // puzzle #1: key 1 → 1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH
        let mut ts = crate::engine::TargetSet::default();
        ts.add("1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH").unwrap();
        let mut targets: Vec<[u8; 20]> = ts.hashes.iter().copied().collect();
        targets.sort_unstable();
        let hits = cpu_scan(&U256::from_hex("0x1").unwrap(), 32, &targets, 8);
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].0, 0);
        assert_eq!(hits[0].1, U256::from_hex("0x1").unwrap());
    }

    #[test]
    fn cpu_scan_respects_batch_bounds() {
        let mut ts = crate::engine::TargetSet::default();
        ts.add("1E6NuFjCi27W5zoXg8TRdcSRq84zJeBW3k").unwrap(); // key 0x15
        let targets: Vec<[u8; 20]> = ts.hashes.iter().copied().collect();
        // batch stops before the key
        assert!(cpu_scan(&U256::from_hex("0x10").unwrap(), 4, &targets, 8).is_empty());
        // key inside the batch
        let hits = cpu_scan(&U256::from_hex("0x10").unwrap(), 6, &targets, 8);
        assert_eq!(hits[0].1, U256::from_hex("0x15").unwrap());
    }

    #[test]
    fn puzzle_ranges() {
        let (_, s, e, addr, solved) = puzzle_range(1).unwrap();
        assert_eq!(s, U256::from_hex("0x1").unwrap());
        assert_eq!(e, U256::from_hex("0x2").unwrap());
        assert_eq!(addr, "1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH");
        assert!(solved);
        let (_, s, e, _, _) = puzzle_range(160).unwrap();
        assert_eq!(s, U256::pow2(159).unwrap());
        assert_eq!(e, U256::pow2(160).unwrap());
        assert!(puzzle_range(161).is_err());
    }

    #[test]
    fn hash160_targets_sorted() {
        // ensure the target lookup path works with >1 targets
        let h1 = t("751e76e8199196d454941c45d1b3a323f1433bd6"); // key 1
                                                                // hash160 of the compressed pubkey for key 0x15, derived in-test
        let secp = Secp256k1::new();
        let mut k15 = [0u8; 32];
        k15[31] = 0x15;
        let pk15 = PublicKey::from_secret_key(&secp, &SecretKey::from_slice(&k15).unwrap());
        let h15 = hash160_pub(&pk15);
        let mut targets = vec![h1, h15];
        targets.sort_unstable();
        let hits = cpu_scan(&U256::from_hex("0x1").unwrap(), 0x20, &targets, 8);
        assert_eq!(hits.len(), 2);
        assert!(hits
            .iter()
            .any(|(_, k)| *k == U256::from_hex("0x15").unwrap()));
    }
}
