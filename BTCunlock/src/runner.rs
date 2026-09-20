//! Search orchestration: batch loop over the combo space, checkpointing,
//! progress reporting, and target matching. Fully offline — nothing here
//! ever touches the network.

use crate::engine::{
    combo_phrase, cpu_seeds, match_seed_ctx, verify_phrase, DerivePlan, TargetSet, Template,
};
use anyhow::{Context, Result};
use bitcoin::secp256k1::Secp256k1;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::io::Write;
use std::path::Path;
use std::time::Instant;

#[derive(Serialize, Deserialize)]
struct Checkpoint {
    /// SHA-256 of the template phrase — refuses to resume a different search.
    template_hash: String,
    next_combo: u64,
    tested: u64,
    hits: u64,
}

fn template_hash(phrase: &str) -> String {
    hex::encode(Sha256::digest(phrase.as_bytes()))
}

fn load_checkpoint(path: &Path, phrase: &str) -> Result<Checkpoint> {
    let s = std::fs::read_to_string(path).context("read checkpoint")?;
    let ck: Checkpoint = serde_json::from_str(&s).context("parse checkpoint")?;
    if ck.template_hash != template_hash(phrase) {
        anyhow::bail!("checkpoint belongs to a different phrase template");
    }
    Ok(ck)
}

fn save_checkpoint(path: &Path, phrase: &str, next: u64, tested: u64, hits: u64) {
    let ck = Checkpoint {
        template_hash: template_hash(phrase),
        next_combo: next,
        tested,
        hits,
    };
    if let Ok(s) = serde_json::to_string(&ck) {
        let _ = std::fs::write(path, s);
    }
}

/// Batch source — GPU kernel or CPU threads, same stage-1/2 semantics.
enum Backend {
    Cpu,
    #[cfg(feature = "gpu")]
    Gpu(crate::gpu::Gpu),
}

impl Backend {
    fn derive(
        &mut self,
        tpl: &Template,
        pass: &str,
        base: u64,
        n: usize,
    ) -> Result<Vec<(u64, [u8; 64])>> {
        match self {
            Backend::Cpu => Ok(cpu_seeds(tpl, pass, base, n as u32)),
            #[cfg(feature = "gpu")]
            Backend::Gpu(g) => g.derive_batch(tpl, base, n),
        }
    }
}

pub struct RecoverOpts {
    pub phrase_template: String,
    pub passphrase: String,
    pub targets: TargetSet,
    pub plan: DerivePlan,
    pub use_gpu: bool,
    #[allow(dead_code)]
    pub gpu_index: usize,
    pub batch: usize,
    pub checkpoint: Option<String>,
    pub resume: bool,
}

pub fn run(opts: RecoverOpts) -> Result<()> {
    let tpl = crate::engine::parse_template(&opts.phrase_template)?;
    if opts.targets.is_empty() {
        anyhow::bail!("no targets — pass --target <address> (repeatable) or --target-file");
    }

    // resume
    let ckpt_path = opts.checkpoint.clone().unwrap_or_else(|| "btcunlock.ckpt".into());
    let mut base = 0u64;
    let mut tested = 0u64;
    let mut hit_count = 0u64;
    if opts.resume {
        if let Ok(ck) = load_checkpoint(Path::new(&ckpt_path), &opts.phrase_template) {
            base = ck.next_combo.min(tpl.total_combos);
            tested = ck.tested;
            hit_count = ck.hits;
            eprintln!("resuming at combo {base} ({tested} previously tested)");
        } else {
            eprintln!("no usable checkpoint at {ckpt_path} — starting fresh");
        }
    }

    // backend
    let mut backend = if opts.use_gpu {
        #[cfg(feature = "gpu")]
        {
            let mut gpu_dev = crate::gpu::Gpu::init(opts.gpu_index, opts.batch)?;
            eprintln!("gpu: {}", gpu_dev.device_name);
            gpu_dev.bind(&tpl, &opts.passphrase)?;
            Backend::Gpu(gpu_dev)
        }
        #[cfg(not(feature = "gpu"))]
        {
            anyhow::bail!(
                "built without GPU support — rebuild: cargo build --release --features gpu"
            );
        }
    } else {
        Backend::Cpu
    };

    eprintln!(
        "search: {} holes → {} combos | {} path(s)/seed | {} target(s)",
        tpl.holes.len(),
        tpl.total_combos,
        opts.plan.paths.len(),
        opts.targets.hashes.len()
    );

    let t0 = Instant::now();
    let mut last_report = Instant::now();
    let mut valid_seeds = 0u64;
    let stdout = std::io::stdout();

    // Feeder pipeline: the backend (GPU batch or CPU rayon chunk) lives on a
    // worker thread; job/result channels give one batch of lookahead so the
    // GPU derives batch k+1 while the host matches batch k on all cores.
    type Batch = Result<(u64, usize, Vec<(u64, [u8; 64])>)>;
    let (job_tx, job_rx) = std::sync::mpsc::channel::<(u64, usize)>();
    let (res_tx, res_rx) = std::sync::mpsc::channel::<Batch>();
    let worker = {
        let tpl_w = Template {
            indices: tpl.indices.clone(),
            holes: tpl.holes.clone(),
            total_combos: tpl.total_combos,
        };
        let pass_w = opts.passphrase.clone();
        std::thread::spawn(move || {
            while let Ok((b, n)) = job_rx.recv() {
                let r = backend.derive(&tpl_w, &pass_w, b, n).map(|s| (b, n, s));
                if res_tx.send(r).is_err() {
                    break;
                }
            }
        })
    };
    let mut send_base = base;
    let mut dispatch = || -> bool {
        let n = opts.batch.min((tpl.total_combos - send_base) as usize);
        if n > 0 {
            let _ = job_tx.send((send_base, n));
            send_base += n as u64;
            return true;
        }
        false
    };
    // outstanding = batches sent but not yet received. recv only happens
    // when a result is guaranteed in-flight — the channels never disconnect
    // until after the loop, so a bare `while let Ok` would deadlock.
    let mut outstanding = dispatch() as u64;
    while outstanding > 0 {
        outstanding += dispatch() as u64; // keep the worker busy on k+1 while we match k
        let (b, n, seeds) = match res_rx.recv() {
            Ok(r) => r?,
            Err(_) => anyhow::bail!("derive worker died"),
        };
        outstanding -= 1;
        valid_seeds += seeds.len() as u64;
        let hits: Vec<(u64, Vec<(String, bitcoin::Address)>)> = seeds
            .par_iter()
            .map_init(Secp256k1::new, |secp, (combo, seed)| {
                (*combo, match_seed_ctx(seed, &opts.plan, &opts.targets, secp))
            })
            .filter(|(_, h)| !h.is_empty())
            .collect();
        for (combo, paths) in hits {
            for (path, addr) in paths {
                hit_count += 1;
                let phrase = combo_phrase(&tpl, combo);
                let _ = verify_phrase(&phrase); // sanity — bip39 re-parse
                let mut out = stdout.lock();
                let _ = writeln!(out, "HIT  combo={combo}");
                let _ = writeln!(out, "     mnemonic: {phrase}");
                let _ = writeln!(out, "     path:     {path}");
                let _ = writeln!(out, "     address:  {addr}");
                let _ = out.flush();
            }
        }
        tested += n as u64;
        base = b + n as u64; // consumed prefix end (results arrive in order)

        if last_report.elapsed().as_secs() >= 2 {
            let dt = t0.elapsed().as_secs_f64();
            let rate = tested as f64 / dt;
            let remain = tpl.total_combos.saturating_sub(base) as f64 / rate.max(1.0);
            eprintln!(
                "  {}/{} combos ({:.1}%) — {:.0}/s — {} valid seeds — {} hits — eta {:.0}s",
                base,
                tpl.total_combos,
                100.0 * base as f64 / tpl.total_combos as f64,
                rate,
                valid_seeds,
                hit_count,
                remain
            );
            save_checkpoint(Path::new(&ckpt_path), &opts.phrase_template, base, tested, hit_count);
            last_report = Instant::now();
        }
    }
    drop(dispatch);
    drop(job_tx);
    worker.join().map_err(|_| anyhow::anyhow!("derive worker panicked"))?;
    save_checkpoint(Path::new(&ckpt_path), &opts.phrase_template, base, tested, hit_count);
    eprintln!(
        "done — {} combos, {} hit(s), {:.1}s",
        tpl.total_combos,
        hit_count,
        t0.elapsed().as_secs_f64()
    );
    Ok(())
}

pub struct PermuteOpts {
    /// All known words (any order) — the search covers every arrangement.
    pub words: Vec<String>,
    pub passphrase: String,
    pub targets: TargetSet,
    pub plan: DerivePlan,
    pub use_gpu: bool,
    #[allow(dead_code)]
    pub gpu_index: usize,
    pub batch: usize,
    /// Optional cap on permutations scanned (0 = full n! space).
    pub limit: u64,
    pub checkpoint: Option<String>,
    pub resume: bool,
}

/// Permutation search: "I have all the words but not the order."
/// Iterates n! arrangements (factoradic), checksum filter, PBKDF2, derive.
/// GPU path uses the `permute_filter` kernel; CPU falls back to rayon.
pub fn run_permute(opts: PermuteOpts) -> Result<()> {
    if opts.targets.is_empty() {
        anyhow::bail!("no targets — pass --target <address>");
    }
    let mut widx = Vec::with_capacity(opts.words.len());
    for w in &opts.words {
        let i = crate::engine::word_index(w)
            .with_context(|| format!("'{w}' is not a BIP39 word"))?;
        widx.push(i);
    }
    let n = widx.len();
    if ![12, 15, 18, 21, 24].contains(&n) {
        anyhow::bail!("permute expects a full-length phrase (12/15/18/21/24 words), got {n}");
    }
    widx.sort_unstable();
    let total = crate::engine::perm_total(n);
    let scan_total = if opts.limit > 0 { total.min(opts.limit) } else { total };

    // backend selection — a boxed derive closure keeps the loop backend-free
    #[cfg(feature = "gpu")]
    let gpu_dev = if opts.use_gpu {
        let mut g = crate::gpu::Gpu::init(opts.gpu_index, opts.batch)?;
        eprintln!("gpu: {}", g.device_name);
        g.bind_permute(&widx, &opts.passphrase)?;
        Some(g)
    } else {
        None
    };
    if opts.use_gpu && cfg!(not(feature = "gpu")) {
        anyhow::bail!("built without GPU support — cargo build --release --features gpu");
    }
    #[cfg(not(feature = "gpu"))]
    let _ = opts.gpu_index;

    let key = opts.words.join(" ");
    let ckpt_path = opts.checkpoint.clone().unwrap_or_else(|| "btcunlock-perm.ckpt".into());
    let mut base = 0u64;
    let mut hit_count = 0u64;
    if opts.resume {
        if let Ok(ck) = load_checkpoint(Path::new(&ckpt_path), &key) {
            base = ck.next_combo.min(scan_total);
            hit_count = ck.hits;
            eprintln!("resuming at permutation {base}");
        }
    }

    eprintln!(
        "permute: {n} words → {scan_total}/{total} permutations | {} path(s)/seed | {} target(s)",
        opts.plan.paths.len(),
        opts.targets.hashes.len()
    );

    let t0 = Instant::now();
    let mut last_report = Instant::now();
    let mut valid_seeds = 0u64;
    let stdout = std::io::stdout();
    // Duplicate input words ⇒ many perm ids decode to the same phrase.
    // CPU dedupes before PBKDF2 (in perm_seeds); GPU output is deduped here
    // on the seed prefix (a seed is bijective with its phrase). With all
    // distinct words both stay empty — zero overhead.
    let has_dup = {
        let mut s = widx.clone();
        s.sort_unstable();
        s.dedup();
        s.len() < n
    };
    let mut phrase_seen = has_dup.then(std::collections::HashSet::new); // CPU: pre-PBKDF2
    let mut seed_seen = has_dup.then(std::collections::HashSet::new); // GPU: post-PBKDF2

    // Same feeder pipeline as run(): the derive backend lives on a worker
    // thread; one batch of lookahead overlaps GPU PBKDF2 with host matching.
    type Batch = Result<(u64, u64, Vec<(u64, [u8; 64])>)>;
    let (job_tx, job_rx) = std::sync::mpsc::channel::<(u64, u64)>();
    let (res_tx, res_rx) = std::sync::mpsc::channel::<Batch>();
    let worker = {
        let widx_w = widx.clone();
        let pass_w = opts.passphrase.clone();
        #[cfg(feature = "gpu")]
        let mut gpu_w = gpu_dev;
        std::thread::spawn(move || {
            while let Ok((b, cnt)) = job_rx.recv() {
                #[cfg(feature = "gpu")]
                let r = match gpu_w.as_mut() {
                    Some(g) => g.derive_perm_batch(n, b, cnt as usize),
                    None => Ok(crate::engine::perm_seeds(
                        &widx_w, &pass_w, b, cnt as u32, phrase_seen.as_mut(),
                    )),
                };
                #[cfg(not(feature = "gpu"))]
                let r = Ok(crate::engine::perm_seeds(
                    &widx_w, &pass_w, b, cnt as u32, phrase_seen.as_mut(),
                ));
                if res_tx.send(r.map(|s| (b, cnt, s))).is_err() {
                    break;
                }
            }
        })
    };
    let mut send_base = base;
    let mut dispatch = || -> bool {
        let cnt = (opts.batch as u64).min(scan_total - send_base);
        if cnt > 0 {
            let _ = job_tx.send((send_base, cnt));
            send_base += cnt;
            return true;
        }
        false
    };
    let mut outstanding = dispatch() as u64;
    while outstanding > 0 {
        outstanding += dispatch() as u64; // keep the worker busy on k+1 while we match k
        let (b, cnt, seeds) = match res_rx.recv() {
            Ok(r) => r?,
            Err(_) => anyhow::bail!("derive worker died"),
        };
        outstanding -= 1;
        valid_seeds += seeds.len() as u64;
        // serial dedupe (dup input words → repeated phrases) before the par
        // match — the HashSet can't be mutated from inside par_iter.
        let kept: Vec<(u64, [u8; 64])> = match seed_seen.as_mut() {
            Some(set) => seeds
                .iter()
                .filter(|(_, seed)| set.insert(u64::from_le_bytes(seed[..8].try_into().unwrap())))
                .copied()
                .collect(),
            None => seeds,
        };
        let hits: Vec<(u64, Vec<(String, bitcoin::Address)>)> = kept
            .par_iter()
            .map_init(Secp256k1::new, |secp, (p, seed)| {
                (*p, match_seed_ctx(seed, &opts.plan, &opts.targets, secp))
            })
            .filter(|(_, h)| !h.is_empty())
            .collect();
        for (p, paths) in hits {
            for (path, addr) in paths {
                hit_count += 1;
                let phrase = crate::engine::perm_phrase(&widx, p);
                let _ = verify_phrase(&phrase);
                let mut out = stdout.lock();
                let _ = writeln!(out, "HIT  perm={p}");
                let _ = writeln!(out, "     mnemonic: {phrase}");
                let _ = writeln!(out, "     path:     {path}");
                let _ = writeln!(out, "     address:  {addr}");
                let _ = out.flush();
            }
        }
        base = b + cnt;

        if last_report.elapsed().as_secs() >= 2 {
            let dt = t0.elapsed().as_secs_f64();
            let rate = base as f64 / dt;
            let remain = (scan_total - base) as f64 / rate.max(1.0);
            eprintln!(
                "  {}/{} perms ({:.1}%) — {:.0}/s — {} valid seeds — {} hits — eta {:.0}s",
                base,
                scan_total,
                100.0 * base as f64 / scan_total as f64,
                rate,
                valid_seeds,
                hit_count,
                remain
            );
            save_checkpoint(Path::new(&ckpt_path), &key, base, base, hit_count);
            last_report = Instant::now();
        }
    }
    drop(dispatch);
    drop(job_tx);
    worker.join().map_err(|_| anyhow::anyhow!("derive worker panicked"))?;
    save_checkpoint(Path::new(&ckpt_path), &key, base, base, hit_count);
    eprintln!(
        "done — {} perms, {} hit(s), {:.1}s",
        scan_total,
        hit_count,
        t0.elapsed().as_secs_f64()
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::{DerivePlan, TargetSet};
    use bip39::{Language, Mnemonic};
    use bitcoin::bip32::DerivationPath;
    use bitcoin::secp256k1::Secp256k1;
    use bitcoin::{Address, Network, PublicKey};
    use std::str::FromStr;

    const KNOWN: &str = "abandon abandon abandon abandon abandon abandon abandon abandon \
        abandon abandon abandon abandon abandon abandon abandon abandon \
        abandon abandon abandon abandon abandon abandon abandon art";

    /// End-to-end: mask word, target the address it derives, runner must hit.
    #[test]
    fn runner_finds_masked_word() {
        let m = Mnemonic::parse_in_normalized(Language::English, KNOWN).unwrap();
        let secp = Secp256k1::new();
        let xp = bitcoin::bip32::Xpriv::new_master(Network::Bitcoin, &m.to_seed("")).unwrap();
        let child = xp
            .derive_priv(&secp, &DerivationPath::from_str("m/84'/0'/0'/0/0").unwrap())
            .unwrap();
        let pk = PublicKey::new(child.private_key.public_key(&secp));
        let want = Address::p2wpkh(&pk, Network::Bitcoin).unwrap().to_string();

        let mut ts = TargetSet::default();
        ts.add(&want).unwrap();
        let ckpt = format!("{}/test-{}.ckpt", std::env::temp_dir().display(), std::process::id());
        let _ = std::fs::remove_file(&ckpt);
        run(RecoverOpts {
            phrase_template: KNOWN.replacen("art", "?", 1),
            passphrase: String::new(),
            targets: ts,
            plan: DerivePlan::standard(Network::Bitcoin, &[84], 1, 1, false).unwrap(),
            use_gpu: false,
            gpu_index: 0,
            batch: 1 << 16,
            checkpoint: Some(ckpt.clone()),
            resume: false,
        })
        .unwrap();
        let _ = std::fs::remove_file(&ckpt);
        // reaching here without panic + the HIT printed to stdout = pass
    }

    /// Permute end-to-end: scrambled words of the canonical 12-word vector
    /// must hit its own BIP84 address (perm 0 decodes to the valid order).
    #[test]
    fn permute_finds_known() {
        let words: Vec<String> =
            "about abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon"
                .split_whitespace()
                .map(String::from)
                .collect();
        // derive the address that "abandon×11 about" produces at m/84'/0'/0'/0/0
        let m = Mnemonic::parse_in_normalized(
            Language::English,
            "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
        )
        .unwrap();
        let secp = Secp256k1::new();
        let xp = bitcoin::bip32::Xpriv::new_master(Network::Bitcoin, &m.to_seed("")).unwrap();
        let child = xp
            .derive_priv(&secp, &DerivationPath::from_str("m/84'/0'/0'/0/0").unwrap())
            .unwrap();
        let pk = PublicKey::new(child.private_key.public_key(&secp));
        let want = Address::p2wpkh(&pk, Network::Bitcoin).unwrap().to_string();

        let mut ts = TargetSet::default();
        ts.add(&want).unwrap();
        let ckpt = format!("{}/perm-{}.ckpt", std::env::temp_dir().display(), std::process::id());
        let _ = std::fs::remove_file(&ckpt);
        run_permute(PermuteOpts {
            words,
            passphrase: String::new(),
            targets: ts,
            plan: DerivePlan::standard(Network::Bitcoin, &[84], 1, 1, false).unwrap(),
            use_gpu: false,
            gpu_index: 0,
            batch: 1 << 16,
            limit: 1 << 16, // hit is at perm 0 — first batch suffices
            checkpoint: Some(ckpt.clone()),
            resume: false,
        })
        .unwrap();
        let _ = std::fs::remove_file(&ckpt);
    }

}
