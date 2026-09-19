//! Search orchestration: batch loop over the combo space, checkpointing,
//! progress reporting, and target matching. Fully offline — nothing here
//! ever touches the network.

use crate::engine::{
    combo_phrase, cpu_seeds, match_seed, verify_phrase, DerivePlan, TargetSet, Template,
};
use anyhow::{Context, Result};
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

    while base < tpl.total_combos {
        let n = opts.batch.min((tpl.total_combos - base) as usize);
        let seeds = backend.derive(&tpl, &opts.passphrase, base, n)?;
        valid_seeds += seeds.len() as u64;
        for (combo, seed) in &seeds {
            for (path, addr) in match_seed(seed, &opts.plan, &opts.targets) {
                hit_count += 1;
                let phrase = combo_phrase(&tpl, *combo);
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
        base += n as u64;

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
    save_checkpoint(Path::new(&ckpt_path), &opts.phrase_template, base, tested, hit_count);
    eprintln!(
        "done — {} combos, {} hit(s), {:.1}s",
        tpl.total_combos,
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

}
