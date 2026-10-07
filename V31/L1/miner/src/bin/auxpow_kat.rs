//! AuxPoW OpenCL kernel KAT — bit-exact GPU↔CPU verification.
//!
//! For each algorithm: mine one batch against a trivially-easy target
//! (0xFF…FF → first candidate always "hits"), then recompute the hash
//! on CPU via the real reference function and compare byte-for-byte.
//!
//!   cargo run --release -p zion-miner --features gpu-opencl --bin auxpow_kat [ALGO ...]
//!   env: ZION_KAT_BATCH (default 4096), ZION_OCL_PLATFORM_IDX/DEVICE_IDX

fn main() {
    #[cfg(not(feature = "gpu-opencl"))]
    {
        eprintln!("requires --features gpu-opencl");
        std::process::exit(1);
    }
    #[cfg(feature = "gpu-opencl")]
    real_main();
}

#[cfg(feature = "gpu-opencl")]
fn real_main() {
    use zion_miner::auxpow::gpu_opencl_full::ExtGpuMiner;
    use zion_miner::auxpow::hasher;

    // Each case: (algo, header, extra, cpu_verify closure index).
    // Layout must match ExtGpuMiner::mine() contract:
    //  - kheavyhash/keryxhash: header = 32B pre_pow_hash, extra = ts(8 LE)
    //    (+ daa(8 LE) for keryxhash)
    //  - blake3_dcr: header = 180B DCR header (nonce slot at 140)
    //  - blake3_alph: header = blob; nonce is internal 8B BE of 24B nonce
    //  - autolykos: extra = height u32 LE + optional table-size u32
    //  - pearlhash: header ≤248B, blake3(header||nonce_le)
    struct Case {
        algo: &'static str,
        header: Vec<u8>,
        extra: Vec<u8>,
        cpu: fn(&[u8], &[u8], u64) -> anyhow::Result<[u8; 32]>,
    }

    let cases: Vec<Case> = vec![
        Case {
            algo: "kheavyhash",
            header: vec![0xABu8; 32],
            extra: 1234567890u64.to_le_bytes().to_vec(),
            cpu: |h, e, n| {
                let ts = u64::from_le_bytes(e[..8].try_into().unwrap());
                Ok(hasher::hash_kheavyhash(&h[..32], ts, n))
            },
        },
        Case {
            algo: "keryxhash",
            header: vec![0x33u8; 32],
            extra: {
                let mut e = 777u64.to_le_bytes().to_vec();
                e.extend_from_slice(&hasher::KERYX_SALT_V4_ACTIVATION_DAA.to_le_bytes());
                e
            },
            cpu: |h, e, n| {
                let ts = u64::from_le_bytes(e[..8].try_into().unwrap());
                let daa = u64::from_le_bytes(e[8..16].try_into().unwrap());
                Ok(hasher::hash_keryxhash(&h[..32], ts, n, daa))
            },
        },
        Case {
            algo: "blake3_dcr",
            header: vec![0x11u8; 180],
            extra: vec![],
            cpu: |h, _e, n| Ok(hasher::hash_blake3(h, 0, n)),
        },
        Case {
            algo: "blake3_alph",
            header: vec![0x22u8; 80],
            extra: vec![],
            cpu: |h, _e, n| Ok(hasher::hash_blake3_alph(h, &[], n)),
        },
        Case {
            algo: "pearlhash",
            header: vec![0xAAu8; 32],
            extra: vec![],
            cpu: |h, _e, n| {
                let mut h32 = [0u8; 32];
                h32.copy_from_slice(&h[..32]);
                Ok(hasher::hash_pearl(&h32, n))
            },
        },
        Case {
            // CPU ref: real Autolykos v2 via native-ffi when available
            // (generates the table internally — slow for high heights,
            // fine for height=1 KAT).
            algo: "autolykos",
            header: vec![0x44u8; 39],
            extra: 1u32.to_le_bytes().to_vec(),
            cpu: |h, e, n| {
                #[cfg(feature = "native-autolykos")]
                {
                    let height = u32::from_le_bytes(e[..4].try_into().unwrap());
                    Ok(zion_native_ffi::autolykos::hash(h, n, height))
                }
                #[cfg(not(feature = "native-autolykos"))]
                {
                    let _ = (h, e, n);
                    anyhow::bail!("no real CPU ref (native-autolykos off)")
                }
            },
        },
        Case {
            algo: "verushash",
            header: vec![0x88u8; 32],
            extra: vec![],
            cpu: |_h, _e, _n| anyhow::bail!("no GPU kernel"),
        },
        Case {
            algo: "zelhash",
            header: vec![0x99u8; 140],
            extra: vec![],
            cpu: |_h, _e, _n| anyhow::bail!("no real CPU ref (blake3 stub)"),
        },
        Case {
            algo: "ethash",
            header: vec![0x55u8; 32],
            extra: vec![],
            cpu: |_h, _e, _n| anyhow::bail!("no real CPU ref (keccak stub)"),
        },
        Case {
            algo: "kawpow",
            header: vec![0x77u8; 32],
            extra: vec![],
            cpu: |_h, _e, _n| anyhow::bail!("no real CPU ref (keccak stub)"),
        },
        Case {
            algo: "progpow",
            header: vec![0x66u8; 32],
            extra: vec![],
            cpu: |_h, _e, _n| anyhow::bail!("no real CPU ref (keccak stub)"),
        },
        Case {
            algo: "nexapow",
            header: vec![0x11u8; 32],
            extra: vec![],
            cpu: |_h, _e, _n| anyhow::bail!("no CPU ref"),
        },
        Case {
            algo: "ghostrider",
            header: vec![0x22u8; 76],
            extra: vec![],
            cpu: |_h, _e, _n| anyhow::bail!("no CPU ref"),
        },
        Case {
            algo: "qhash",
            header: vec![0x44u8; 32],
            extra: vec![],
            cpu: |_h, _e, _n| anyhow::bail!("no CPU ref"),
        },
        Case {
            algo: "eaglesong",
            header: vec![0x55u8; 32],
            extra: vec![],
            cpu: |_h, _e, _n| anyhow::bail!("no CPU ref"),
        },
        Case {
            algo: "neoscrypt",
            header: vec![0x66u8; 80],
            extra: vec![],
            cpu: |_h, _e, _n| anyhow::bail!("no CPU ref"),
        },
        Case {
            algo: "karlsenhash",
            header: vec![0x77u8; 32],
            extra: vec![],
            cpu: |_h, _e, _n| anyhow::bail!("no CPU ref; needs fishhash DAG"),
        },
        Case {
            algo: "verthash",
            header: vec![0x88u8; 80],
            extra: vec![],
            cpu: |_h, _e, _n| anyhow::bail!("no CPU ref; needs data file"),
        },
        Case {
            algo: "beamhash",
            header: vec![0x99u8; 64],
            extra: vec![],
            cpu: |_h, _e, _n| anyhow::bail!("no CPU ref; host stub pre_pow=0"),
        },
        Case {
            algo: "dynexsolve",
            header: vec![0xAAu8; 32],
            extra: vec![],
            cpu: |_h, _e, _n| anyhow::bail!("no CPU ref"),
        },
        Case {
            algo: "octopus",
            header: vec![0xBBu8; 32],
            extra: vec![],
            cpu: |_h, _e, _n| anyhow::bail!("no CPU ref; DAG-based"),
        },
        Case {
            algo: "equihashzero",
            header: vec![0xCCu8; 140],
            extra: vec![],
            cpu: |_h, _e, _n| anyhow::bail!("no CPU ref; Wagner multi-kernel"),
        },
        Case {
            algo: "equihash",
            header: vec![0xDDu8; 140],
            extra: vec![],
            cpu: |_h, _e, _n| anyhow::bail!("no CPU ref; Equihash 200,9 Wagner"),
        },
        Case {
            algo: "fishhash",
            header: vec![0xEEu8; 32],
            extra: vec![],
            cpu: |_h, _e, _n| anyhow::bail!("no CPU ref; needs fishhash DAG"),
        },
    ];

    let args: Vec<String> = std::env::args().skip(1).collect();
    let batch: u64 = std::env::var("ZION_KAT_BATCH")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(4096);
    let target = [0xFFu8; 32];

    let mut miner = match ExtGpuMiner::new() {
        Ok(m) => m,
        Err(e) => {
            eprintln!("GPU init failed: {e}");
            std::process::exit(2);
        }
    };

    let mut pass = 0;
    let mut fail = 0;
    let mut skip = 0;
    for c in &cases {
        if !args.is_empty() && !args.iter().any(|a| a == c.algo) {
            continue;
        }
        let t0 = std::time::Instant::now();
        // DAG-family algorithms need an epoch DAG uploaded first.
        #[cfg(feature = "native-hashers")]
        {
            let dag_res = match c.algo {
                "ethash" | "etchash" | "octopus" => {
                    Some(miner.generate_ethash_dag_on_gpu(0))
                }
                "kawpow" => Some(miner.generate_kawpow_dag_on_gpu(0)),
                "progpow" => Some(miner.generate_progpow_dag_on_gpu(0)),
                "verthash" => {
                    // Verthash needs the ~1.2GB static data file. Look for it
                    // in the usual locations; skip cleanly if absent.
                    let candidates = [
                        std::env::var("VERTHASH_DAT").unwrap_or_default(),
                        "/home/zionserver/verthash.dat".to_string(),
                        "./verthash.dat".to_string(),
                    ];
                    let found = candidates.iter().find(|p| {
                        !p.is_empty() && std::path::Path::new(p.as_str()).exists()
                    });
                    match found {
                        Some(path) => match std::fs::read(path) {
                            Ok(data) => Some(miner.set_verthash_data(&data)),
                            Err(e) => Some(Err(anyhow::anyhow!("read {path}: {e}"))),
                        },
                        None => {
                            println!(
                                "{:<14} SKIP  verthash.dat not found (set VERTHASH_DAT)",
                                c.algo
                            );
                            skip += 1;
                            continue;
                        }
                    }
                }
                _ => None,
            };
            if let Some(Err(e)) = dag_res {
                println!("{:<14} ERR   DAG/data gen failed: {e}", c.algo);
                fail += 1;
                continue;
            }
        }
        let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            miner.mine(c.algo, &c.header, &c.extra, &target, 0, batch)
        }));
        match res {
            Ok(Ok(Some(share))) => match (c.cpu)(&c.header, &c.extra, share.nonce) {
                Ok(cpu_hash) if cpu_hash == share.hash => {
                    println!(
                        "{:<14} PASS  nonce={} hash={} ({:.0?})",
                        c.algo,
                        share.nonce,
                        hex::encode(&share.hash[..8]),
                        t0.elapsed()
                    );
                    pass += 1;
                }
                Ok(cpu_hash) => {
                    println!(
                        "{:<14} FAIL  nonce={} gpu={} cpu={}",
                        c.algo,
                        share.nonce,
                        hex::encode(&share.hash[..8]),
                        hex::encode(&cpu_hash[..8])
                    );
                    fail += 1;
                }
                Err(e) => {
                    let mix_tag = share
                        .mix_hash
                        .map(|m| format!(" mix={}", hex::encode(&m[..8])))
                        .unwrap_or_default();
                    println!(
                        "{:<14} RUN   nonce={} gpu={}{} (unverifiable: {e})",
                        c.algo,
                        share.nonce,
                        hex::encode(&share.hash[..8]),
                        mix_tag
                    );
                    skip += 1;
                }
            },
            Ok(Ok(None)) => {
                println!("{:<14} EMPTY (no candidate in {batch} nonces)", c.algo);
                fail += 1;
            }
            Ok(Err(e)) => {
                println!("{:<14} ERR   {e}", c.algo);
                fail += 1;
            }
            Err(_) => {
                println!("{:<14} PANIC", c.algo);
                fail += 1;
            }
        }
    }
    println!("\n=== auxpow-kat: {pass} pass / {fail} fail / {skip} unverifiable ===");
    std::process::exit(if fail > 0 { 1 } else { 0 });
}
