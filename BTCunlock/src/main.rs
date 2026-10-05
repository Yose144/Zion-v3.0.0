//! BTCunlock — OFFLINE recovery toolkit for YOUR OWN lost BTC wallets.
//!
//! Modes:
//!   recover       — brute-force `?` placeholders in a BIP39 phrase with
//!                   GPU acceleration (OpenCL); matches derived addresses
//!                   against YOUR known --target address(es). Never online.
//!   fix-mnemonic  — quick listing of checksum-valid completions (≤2 holes)
//!   scan          — derive a valid mnemonic across standard paths;
//!                   offline by default, `--online` opts into esplora
//!   wif           — decode a WIF key, show derived addresses
//!   bench         — measure seeds/s (GPU detection sanity check)
//!   gpu-list      — list OpenCL devices
//!
//! Legal use only: recovering wallets you own. Never run this against
//! phrases/keys that are not yours.

mod engine;
#[cfg(feature = "gpu")]
mod gpu;
mod kangaroo;
mod keyscan;
mod recover;
mod runner;
mod scan;

use anyhow::Result;
use bitcoin::Network;
use clap::{Parser, Subcommand};
use engine::{DerivePlan, TargetSet};

#[derive(Parser)]
#[command(
    name = "btcunlock",
    version,
    about = "OFFLINE BTC wallet recovery toolkit (own wallets only)"
)]
struct Cli {
    #[command(subcommand)]
    cmd: Cmd,
}

#[derive(Subcommand)]
enum Cmd {
    /// Brute-force `?` placeholders, GPU-accelerated, target-matched.
    /// Everything is computed locally — no network access, ever.
    Recover {
        /// Phrase template, e.g. "word1 ? word3 ..." — ? or _ or x mark holes.
        phrase: String,
        /// Known address(es) of the wallet (P2PKH/P2SH/P2WPKH or 40-hex
        /// hash160). Repeatable — the engine derives candidate addresses and
        /// reports only hits.
        #[arg(long = "target")]
        targets: Vec<String>,
        /// File with target addresses, one per line.
        #[arg(long)]
        target_file: Option<String>,
        /// BIP39 passphrase (25th word), if the wallet used one.
        #[arg(long, default_value = "")]
        pass: String,
        /// mainnet | testnet | signet
        #[arg(long, default_value = "mainnet")]
        network: String,
        /// Script purposes to try per seed (comma list, default 84,49,44).
        #[arg(long, default_value = "84,49,44")]
        purposes: String,
        /// Accounts per purpose.
        #[arg(long, default_value_t = 1)]
        accounts: u32,
        /// Address indices per (purpose,account,chain) — default 1.
        #[arg(long, default_value_t = 1)]
        max_index: u32,
        /// Also scan the change chain (doubles paths per seed).
        #[arg(long)]
        change_chain: bool,
        /// Use the OpenCL GPU backend (needs `--features gpu` build).
        #[arg(long)]
        gpu: bool,
        /// OpenCL device index (see `gpu-list`).
        #[arg(long, default_value_t = 0)]
        gpu_index: usize,
        /// Combos per batch (GPU work-size / CPU chunk). Larger batches
        /// saturate the GPU's PBKDF2 stage (needs ≥64k parallel seed
        /// chains); 16M ≈ 1.1 GB states buffer at the /8 result ceiling.
        #[arg(long, default_value_t = 1 << 24)]
        batch: usize,
        /// Checkpoint file path (default btcunlock.ckpt).
        #[arg(long)]
        checkpoint: Option<String>,
        /// Resume from checkpoint.
        #[arg(long)]
        resume: bool,
    },
    /// All words known, order unknown — tries every arrangement (n!).
    /// 12 words = 479M permutations (~1/16 pass checksum). CPU-only.
    Permute {
        /// The full word list, e.g. "w1 w2 ... w12" (any order).
        words: String,
        /// Known address(es) to match (P2PKH/P2SH/P2WPKH or hash160 hex).
        #[arg(long = "target")]
        targets: Vec<String>,
        /// File with target addresses, one per line.
        #[arg(long)]
        target_file: Option<String>,
        /// BIP39 passphrase, if used.
        #[arg(long, default_value = "")]
        pass: String,
        /// mainnet | testnet | signet
        #[arg(long, default_value = "mainnet")]
        network: String,
        /// Script purposes per seed (default 84,49,44).
        #[arg(long, default_value = "84,49,44")]
        purposes: String,
        #[arg(long, default_value_t = 1)]
        accounts: u32,
        #[arg(long, default_value_t = 1)]
        max_index: u32,
        #[arg(long)]
        change_chain: bool,
        /// Use the OpenCL GPU backend (needs `--features gpu` build).
        #[arg(long)]
        gpu: bool,
        /// OpenCL device index (see `gpu-list`).
        #[arg(long, default_value_t = 0)]
        gpu_index: usize,
        /// Perms per batch — 12-word phrases pass checksum ~1/16, so 4M
        /// combos ≈ 262k parallel PBKDF2 chains (GPU saturation point).
        #[arg(long, default_value_t = 1 << 22)]
        batch: usize,
        /// Stop after N permutations (default 0 = full n! space).
        #[arg(long, default_value_t = 0)]
        limit: u64,
        /// Checkpoint file path (default btcunlock-perm.ckpt).
        #[arg(long)]
        checkpoint: Option<String>,
        /// Resume from checkpoint.
        #[arg(long)]
        resume: bool,
    },
    /// Quick completion listing for ≤2 unknown words (checksum-valid only).
    FixMnemonic {
        /// The phrase, e.g. "word1 word2 ? word4 ..."
        phrase: String,
        /// Also derive the first BIP84 address for each valid candidate.
        #[arg(long)]
        derive: bool,
    },
    /// Derive a valid mnemonic across BIP44/49/84 paths. OFFLINE by default;
    /// `--online` additionally queries an esplora API for balances.
    Scan {
        /// Full valid mnemonic (quoted).
        mnemonic: String,
        /// mainnet | testnet | signet
        #[arg(long, default_value = "mainnet")]
        network: String,
        /// Max index per path (receive + change chains).
        #[arg(long, default_value_t = 20)]
        max_index: u32,
        /// Account count per script type.
        #[arg(long, default_value_t = 2)]
        accounts: u32,
        /// Enable esplora balance lookups (leaks which addresses you watch).
        #[arg(long)]
        online: bool,
        /// Esplora API base (implies --online; default mempool.space).
        #[arg(long)]
        api: Option<String>,
    },
    /// Decode a WIF private key: network, compression, P2PKH + P2WPKH addr.
    Wif { wif: String },
    /// Sequential private-key scan over [start, end) — the raw form of the
    /// Bitcoin puzzle search. Every key's compressed pubkey hash160 is
    /// matched against the target set; GPU does the EC walk on-device.
    /// Realistic reach: ~2^40 keys. Use only on ranges you have a reason
    /// to search (your own partially-known key, public bounty puzzles).
    Keyscan {
        /// First key to test, big-endian hex (with/without 0x).
        #[arg(long)]
        start: String,
        /// End key, hex — the scan covers [start, end). Default: start.
        #[arg(long)]
        end: Option<String>,
        /// Known address(es) — P2PKH/P2WPKH or 40-hex hash160. Repeatable.
        #[arg(long = "target")]
        targets: Vec<String>,
        /// File with target addresses, one per line.
        #[arg(long)]
        target_file: Option<String>,
        /// Use the OpenCL GPU backend.
        #[arg(long)]
        gpu: bool,
        /// OpenCL device index (see `gpu-list`).
        #[arg(long, default_value_t = 0)]
        gpu_index: usize,
        /// Keys each GPU work-item walks (batch inversion; 1–16).
        #[arg(long, default_value_t = 8)]
        stride: u32,
        /// Work-items per GPU launch / keys per CPU batch.
        #[arg(long, default_value_t = 1 << 20)]
        batch: usize,
        /// Checkpoint file (default btcunlock-keys.ckpt).
        #[arg(long)]
        checkpoint: Option<String>,
        /// Resume from checkpoint.
        #[arg(long)]
        resume: bool,
        /// Shell command run on every verified hit — env carries
        /// BTCUNLOCK_KEY/KEY_HEX/WIF/ADDRESS/TARGET/LABEL (e.g. a mailer,
        /// scp off-site copy, ntfy push…).
        #[arg(long)]
        hit_cmd: Option<String>,
    },
    /// Scan a 2015 Bitcoin-puzzle range: `puzzle 66` covers [2^65, 2^66)
    /// against the published puzzle address. Same engine as `keyscan`;
    /// solved puzzles double as self-tests.
    Puzzle {
        /// Puzzle number 1..=160.
        n: u32,
        /// Use the OpenCL GPU backend.
        #[arg(long)]
        gpu: bool,
        /// OpenCL device index (see `gpu-list`).
        #[arg(long, default_value_t = 0)]
        gpu_index: usize,
        /// Keys each GPU work-item walks (batch inversion; 1–16).
        #[arg(long, default_value_t = 8)]
        stride: u32,
        /// Work-items per GPU launch / keys per CPU batch.
        #[arg(long, default_value_t = 1 << 20)]
        batch: usize,
        /// Checkpoint file (default btcunlock-keys.ckpt).
        #[arg(long)]
        checkpoint: Option<String>,
        /// Resume from checkpoint.
        #[arg(long)]
        resume: bool,
        /// Shell command run on every verified hit — env carries
        /// BTCUNLOCK_KEY/KEY_HEX/WIF/ADDRESS/TARGET/LABEL.
        #[arg(long)]
        hit_cmd: Option<String>,
    },
    /// Pollard kangaroo (lambda) for a bounded ECDLP: given a PUBLIC KEY
    /// whose secret lies in [start, end), recover it in ~2√(b−a) group
    /// ops. Address-only targets (e.g. puzzle #71) cannot be solved this
    /// way — the method needs the key, not the hash160.
    Kangaroo {
        /// secp256k1 public key, hex: 02/03+64 (compressed) or 04+128.
        pubkey: String,
        /// Interval start, hex.
        #[arg(long)]
        start: String,
        /// Interval end, hex — secret k satisfies start ≤ k < end.
        #[arg(long)]
        end: String,
        /// Distinguished-point bits (memory/time trade-off; 0 = auto).
        #[arg(long, default_value_t = 0)]
        dp_bits: u32,
        /// Hard step cap (0 = auto ≈ 16√width).
        #[arg(long, default_value_t = 0)]
        max_steps: u64,
        /// Directory for mode-600 hit records (default: none — stdout only).
        #[arg(long)]
        hits_dir: Option<String>,
        /// Hook command on hit — same env contract as keyscan --hit-cmd.
        #[arg(long)]
        hit_cmd: Option<String>,
    },
    /// Measure seed-derivation throughput (GPU sanity check).
    Bench {
        #[arg(long)]
        gpu: bool,
        #[arg(long, default_value_t = 0)]
        gpu_index: usize,
        #[arg(long, default_value_t = 1 << 20)]
        batch: usize,
        #[arg(long, default_value_t = 8)]
        batches: usize,
    },
    /// List OpenCL GPU devices.
    GpuList,
}

fn net(s: &str) -> Result<Network> {
    match s {
        "mainnet" | "bitcoin" => Ok(Network::Bitcoin),
        "testnet" | "testnet3" | "testnet4" => Ok(Network::Testnet),
        "signet" => Ok(Network::Signet),
        other => anyhow::bail!("unknown network '{other}'"),
    }
}

fn main() -> Result<()> {
    let cli = Cli::parse();
    match cli.cmd {
        Cmd::Recover {
            phrase,
            targets,
            target_file,
            pass,
            network,
            purposes,
            accounts,
            max_index,
            change_chain,
            gpu,
            gpu_index,
            batch,
            checkpoint,
            resume,
        } => {
            let mut ts = TargetSet::default();
            for t in &targets {
                ts.add(t)?;
            }
            if let Some(f) = target_file {
                for line in std::fs::read_to_string(&f)?.lines() {
                    let line = line.trim();
                    if !line.is_empty() && !line.starts_with('#') {
                        ts.add(line)?;
                    }
                }
            }
            let mut purposes: Vec<u32> = purposes
                .split(',')
                .map(|p| p.trim().parse::<u32>())
                .collect::<std::result::Result<_, _>>()?;
            // P2TR targets need the BIP86 walk — add it implicitly.
            if !ts.xkeys.is_empty() && !purposes.contains(&86) {
                purposes.push(86);
            }
            let plan =
                DerivePlan::standard(net(&network)?, &purposes, accounts, max_index, change_chain)?;
            if !ts.xkeys.is_empty() && !purposes.contains(&86) {
                eprintln!(
                    "note: taproot (bc1p…) target given but --purposes lacks 86 \
                     — it can never match; add 86 to --purposes"
                );
            }
            runner::run(runner::RecoverOpts {
                phrase_template: phrase,
                passphrase: pass,
                targets: ts,
                plan,
                use_gpu: gpu,
                gpu_index,
                batch: batch.max(1 << 16),
                checkpoint,
                resume,
            })
        }
        Cmd::Permute {
            words,
            targets,
            target_file,
            pass,
            network,
            purposes,
            accounts,
            max_index,
            change_chain,
            gpu,
            gpu_index,
            batch,
            limit,
            checkpoint,
            resume,
        } => {
            let mut ts = TargetSet::default();
            for t in &targets {
                ts.add(t)?;
            }
            if let Some(f) = target_file {
                for line in std::fs::read_to_string(&f)?.lines() {
                    let line = line.trim();
                    if !line.is_empty() && !line.starts_with('#') {
                        ts.add(line)?;
                    }
                }
            }
            let mut purposes: Vec<u32> = purposes
                .split(',')
                .map(|p| p.trim().parse::<u32>())
                .collect::<std::result::Result<_, _>>()?;
            // P2TR targets need the BIP86 walk — add it implicitly.
            if !ts.xkeys.is_empty() && !purposes.contains(&86) {
                purposes.push(86);
            }
            let plan =
                DerivePlan::standard(net(&network)?, &purposes, accounts, max_index, change_chain)?;
            if !ts.xkeys.is_empty() && !purposes.contains(&86) {
                eprintln!(
                    "note: taproot (bc1p…) target given but --purposes lacks 86 \
                     — it can never match; add 86 to --purposes"
                );
            }
            runner::run_permute(runner::PermuteOpts {
                words: words.split_whitespace().map(String::from).collect(),
                passphrase: pass,
                targets: ts,
                plan,
                use_gpu: gpu,
                gpu_index,
                batch: batch.max(1 << 16),
                limit,
                checkpoint,
                resume,
            })
        }
        Cmd::FixMnemonic { phrase, derive } => recover::fix_mnemonic(&phrase, derive),
        Cmd::Scan {
            mnemonic,
            network,
            max_index,
            accounts,
            api,
            online,
        } => scan::scan_mnemonic(
            &mnemonic,
            &network,
            max_index,
            accounts,
            api.as_deref(),
            !(online || api.is_some()),
        ),
        Cmd::Wif { wif } => scan::wif_info(&wif),
        Cmd::Keyscan {
            start,
            end,
            targets,
            target_file,
            gpu,
            gpu_index,
            stride,
            batch,
            checkpoint,
            resume,
            hit_cmd,
        } => {
            let start = keyscan::U256::from_hex(&start)?;
            let end = match end {
                Some(e) => keyscan::U256::from_hex(&e)?,
                None => {
                    let mut e = start;
                    e.add_u64(1);
                    e
                }
            };
            let mut ts = TargetSet::default();
            for t in &targets {
                ts.add(t)?;
            }
            if let Some(f) = target_file {
                for line in std::fs::read_to_string(&f)?.lines() {
                    let line = line.trim();
                    if !line.is_empty() && !line.starts_with('#') {
                        ts.add(line)?;
                    }
                }
            }
            let mut sorted: Vec<[u8; 20]> = ts.hashes.iter().copied().collect();
            sorted.sort_unstable();
            let names: Vec<String> = sorted.iter().map(|h| hex::encode(h)).collect();
            keyscan::run_keyscan(keyscan::KeyscanOpts {
                start,
                end,
                targets: sorted,
                target_names: names,
                use_gpu: gpu,
                gpu_index,
                stride,
                batch: batch.max(1),
                checkpoint,
                resume,
                label: String::new(),
                hit_cmd,
            })
        }
        Cmd::Puzzle {
            n,
            gpu,
            gpu_index,
            stride,
            batch,
            checkpoint,
            resume,
            hit_cmd,
        } => {
            let (label, start, end, addr, solved) = keyscan::puzzle_range(n)?;
            if solved {
                eprintln!("note: {label} is already solved — self-test mode");
            }
            let mut ts = TargetSet::default();
            ts.add(&addr)?;
            let mut sorted: Vec<[u8; 20]> = ts.hashes.iter().copied().collect();
            sorted.sort_unstable();
            keyscan::run_keyscan(keyscan::KeyscanOpts {
                start,
                end,
                targets: sorted,
                target_names: vec![addr],
                use_gpu: gpu,
                gpu_index,
                stride,
                batch: batch.max(1),
                checkpoint,
                resume,
                label,
                hit_cmd,
            })
        }
        Cmd::Kangaroo {
            pubkey,
            start,
            end,
            dp_bits,
            max_steps,
            hits_dir,
            hit_cmd,
        } => {
            let pk = kangaroo::parse_pubkey(&pubkey)?;
            let start = keyscan::U256::from_hex(&start)?;
            let end = keyscan::U256::from_hex(&end)?;
            let hit = kangaroo::solve(
                &kangaroo::KangaOpts {
                    start,
                    end,
                    dp_bits,
                    max_steps,
                    hits_dir: hits_dir.map(std::path::PathBuf::from),
                    hit_cmd,
                },
                &pk,
            )?;
            if hit.is_none() {
                std::process::exit(1);
            }
            Ok(())
        }
        Cmd::Bench {
            gpu,
            gpu_index,
            batch,
            batches,
        } => bench(gpu, gpu_index, batch, batches),
        Cmd::GpuList => {
            #[cfg(feature = "gpu")]
            {
                let devs = gpu::list_devices();
                if devs.is_empty() {
                    println!("no OpenCL GPU devices");
                }
                for (i, d) in devs.iter().enumerate() {
                    println!("[{i}] {d}");
                }
            }
            #[cfg(not(feature = "gpu"))]
            println!("built without GPU support — cargo build --release --features gpu");
            Ok(())
        }
    }
}

fn bench(use_gpu: bool, gpu_index: usize, batch: usize, batches: usize) -> Result<()> {
    // 3-hole template → 8.6G combos; measures the real pipeline rate.
    let tpl = engine::parse_template(
        "abandon abandon abandon abandon abandon abandon abandon abandon \
         abandon abandon abandon abandon abandon abandon abandon abandon \
         abandon abandon abandon abandon abandon ? ? ?",
    )?;
    let t0 = std::time::Instant::now();
    let mut total_seeds = 0u64;
    let mut total_combos = 0u64;
    let mut run_batch = |backend: &mut dyn FnMut(u64, usize) -> Result<Vec<(u64, [u8; 64])>>,
                         tpl: &engine::Template| {
        for b in 0..batches {
            let base = (b as u64) * batch as u64;
            if base >= tpl.total_combos {
                break;
            }
            let n = batch.min((tpl.total_combos - base) as usize);
            total_seeds += backend(base, n)?.len() as u64;
            total_combos += n as u64;
        }
        Ok::<(), anyhow::Error>(())
    };
    let _ = gpu_index; // only used by the gpu feature build
    if use_gpu {
        #[cfg(feature = "gpu")]
        {
            let mut g = gpu::Gpu::init(gpu_index, batch)?;
            eprintln!("gpu: {}", g.device_name);
            g.bind(&tpl, "")?;
            run_batch(
                &mut |base, n| g.derive_batch(&tpl, base, n).map(|o| o.seeds),
                &tpl,
            )?;
        }
        #[cfg(not(feature = "gpu"))]
        anyhow::bail!("built without GPU support — cargo build --release --features gpu");
    } else {
        run_batch(
            &mut |base, n| Ok(engine::cpu_seeds(&tpl, "", base, n as u32)),
            &tpl,
        )?;
    }
    let dt = t0.elapsed().as_secs_f64();
    eprintln!(
        "{total_combos} combos in {dt:.2}s → {:.0} combos/s | {total_seeds} valid seeds → {:.0} seeds/s",
        total_combos as f64 / dt,
        total_seeds as f64 / dt
    );
    Ok(())
}
