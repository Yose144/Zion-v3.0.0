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

/// Autolykos v2 CPU reference (Rust port of native-ffi autolykos_hash),
/// parameterized by N so the KAT can use a small table.  Cross-validated
/// against `zion_native_ffi::autolykos::hash` at mainnet N below.
#[cfg(feature = "gpu-opencl")]
fn autolykos_v2_hash(msg: &[u8], nonce: u64, height: u32, n: u32) -> [u8; 32] {
    use blake2::digest::{Update, VariableOutput};

    let b2b256 = |parts: &[&[u8]]| -> [u8; 32] {
        let mut h = blake2::Blake2bVar::new(32).unwrap();
        for p in parts {
            h.update(p);
        }
        let mut out = [0u8; 32];
        h.finalize_variable(&mut out).unwrap();
        out
    };

    // M = concat of i64-BE for i in 0..1024 (8192 bytes)
    let mut m = [0u8; 8192];
    for i in 0..1024u64 {
        m[i as usize * 8..i as usize * 8 + 8].copy_from_slice(&i.to_be_bytes());
    }

    let nonce_be = nonce.to_be_bytes();
    let height_be = height.to_be_bytes();

    // Step 1: h1 = b2b256(msg || nonce_BE); i0 = last8BE(h1) mod N
    let h1 = b2b256(&[msg, &nonce_be]);
    let prei8 = u64::from_be_bytes(h1[24..32].try_into().unwrap());
    let i0 = (prei8 % n as u64) as u32;

    // Element fn: T[i] = b2b256(i_BE4 || height_BE4 || M)[1..32)
    let element = |i: u32| -> [u8; 31] {
        let d = b2b256(&[&i.to_be_bytes(), &height_be, &m]);
        let mut e = [0u8; 31];
        e.copy_from_slice(&d[1..]);
        e
    };

    // Step 4: seed = f31 || msg || nonce_BE → h32 → ext = h32||h32[0..3)
    let f31 = element(i0);
    let h32 = b2b256(&[&f31, msg, &nonce_be]);
    let mut ext = [0u8; 35];
    ext[..32].copy_from_slice(&h32);
    ext[32..35].copy_from_slice(&h32[..3]);

    // Steps 5-7: idx[k] = BE4(ext[k..k+4]) mod N; sum += T[idx[k]] (BE, mod 2^256)
    let mut sum = [0u8; 32];
    for k in 0..32 {
        let raw = u32::from_be_bytes([ext[k], ext[k + 1], ext[k + 2], ext[k + 3]]);
        let e = element(raw % n);
        let mut carry = 0u16;
        for i in (0..31).rev() {
            let s = sum[1 + i] as u16 + e[i] as u16 + carry;
            sum[1 + i] = s as u8;
            carry = s >> 8;
        }
        sum[0] = sum[0].wrapping_add(carry as u8);
    }

    // Step 8: out = b2b256(sum)
    b2b256(&[&sum])
}

/// GhostRider CPU ref via native-ffi (sphlib + CryptoNight).
#[cfg(feature = "native-ghostrider")]
fn ghostrider_cpu(h: &[u8], n: u64) -> anyhow::Result<[u8; 32]> {
    Ok(zion_native_ffi::ghostrider::hash(h, n))
}
#[cfg(not(feature = "native-ghostrider"))]
fn ghostrider_cpu(_h: &[u8], _n: u64) -> anyhow::Result<[u8; 32]> {
    anyhow::bail!("no CPU ref; build with native-all")
}

/// Verthash CPU ref — loads verthash.dat once (same candidate paths as the
/// GPU setup below).
fn verthash_cpu(h: &[u8], n: u64) -> anyhow::Result<[u8; 32]> {
    static DAT: std::sync::OnceLock<Vec<u8>> = std::sync::OnceLock::new();
    let data = DAT.get_or_init(|| {
        for p in [
            std::env::var("VERTHASH_DAT").unwrap_or_default(),
            "/home/zionserver/verthash.dat".to_string(),
            "./verthash.dat".to_string(),
        ] {
            if !p.is_empty() {
                if let Ok(d) = std::fs::read(&p) {
                    return d;
                }
            }
        }
        Vec::new()
    });
    if data.is_empty() {
        anyhow::bail!("verthash.dat not loaded");
    }
    Ok(zion_miner::auxpow::verthash_ref::verthash_hash_ref(h, n, data))
}

#[cfg(feature = "gpu-opencl")]
fn real_main() {
    use zion_miner::auxpow::gpu_opencl_full::ExtGpuMiner;
    use zion_miner::auxpow::hasher;

    // Cross-validate the Rust Autolykos port against native-ffi at the
    // real mainnet N before trusting it as the KAT CPU reference.
    #[cfg(feature = "native-autolykos")]
    {
        let msg = [0x44u8; 39];
        for nonce in [0u64, 1, 12345, 0xDEAD_BEEF] {
            let ours = autolykos_v2_hash(&msg, nonce, 1, 1u32 << 26);
            let native = zion_native_ffi::autolykos::hash(&msg, nonce, 1);
            assert_eq!(
                ours, native,
                "autolykos_v2_hash port mismatch vs native at nonce {nonce}"
            );
        }
        println!("autolykos_v2_hash port ≡ native-ffi @ N=2^26");
    }

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
            // CPU ref: Rust port of Autolykos v2 (mirrors native-ffi spec),
            // N taken from extra[4..8] — small N keeps the GPU table tiny.
            // The port itself is cross-checked against native-ffi below.
            algo: "autolykos",
            header: vec![0x44u8; 39],
            extra: {
                let mut e = 1u32.to_le_bytes().to_vec(); // height = 1
                e.extend_from_slice(&16384u32.to_le_bytes()); // N = 2^14 (test)
                e
            },
            cpu: |h, e, n| {
                let height = u32::from_le_bytes(e[..4].try_into().unwrap());
                let n_size = u32::from_le_bytes(e[4..8].try_into().unwrap());
                Ok(autolykos_v2_hash(h, n, height, n_size))
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
            algo: "progpowz",
            header: vec![0x67u8; 32],
            extra: vec![],
            cpu: |_h, _e, _n| anyhow::bail!("via progpow branch"),
        },
        Case {
            algo: "evrprogpow",
            header: vec![0x78u8; 32],
            extra: vec![],
            cpu: |_h, _e, _n| anyhow::bail!("via kawpow branch"),
        },
        Case {
            algo: "meowpow",
            header: vec![0x79u8; 32],
            extra: vec![],
            cpu: |_h, _e, _n| anyhow::bail!("via kawpow branch"),
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
            cpu: |h, _e, n| ghostrider_cpu(h, n),
        },
        Case {
            algo: "qhash",
            header: vec![0x44u8; 32],
            extra: vec![],
            cpu: |h, _e, n| Ok(zion_miner::auxpow::qhash_ref::qhash_hash_ref(h, n)),
        },
        Case {
            algo: "eaglesong",
            header: vec![0x55u8; 32],
            extra: vec![],
            cpu: |h, _e, n| Ok(zion_miner::auxpow::eaglesong_ref::eaglesong_hash_ref(h, n)),
        },
        Case {
            algo: "neoscrypt",
            header: vec![0x66u8; 80],
            extra: vec![],
            cpu: |h, _e, n| Ok(zion_miner::auxpow::neoscrypt_ref::neoscrypt_hash_ref(h, n)),
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
            cpu: |h, _e, n| verthash_cpu(h, n),
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
    let base_nonce: u64 = std::env::var("ZION_KAT_NONCE")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(0);
    // Repeat count for probabilistic algos (equihash: solutions are
    // Poisson-distributed per header, a single EMPTY run is inconclusive).
    let repeats: u32 = std::env::var("ZION_KAT_REPEATS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(1);
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
    'cases: for c in &cases {
        if !args.is_empty() && !args.iter().any(|a| a == c.algo) {
            continue;
        }
        // NexaPow's 6k-line secp256k1 kernel takes >10 min in the NVIDIA JIT
        // compiler on every fresh process — exclude it from the default sweep
        // unless explicitly named (or ZION_KAT_SLOW=1).
        let explicit = args.iter().any(|a| a == c.algo);
        if c.algo == "nexapow" && !explicit && std::env::var("ZION_KAT_SLOW").is_err() {
            println!("{:<14} SKIP  nexapow (secp256k1 kernel JIT compile >10min; run `auxpow_kat nexapow` or ZION_KAT_SLOW=1)", c.algo);
            skip += 1;
            continue;
        }
        let t0 = std::time::Instant::now();
        // DAG-family algorithms need an epoch DAG uploaded first.
        #[cfg(feature = "native-hashers")]
        {
            // Release previously cached DAG/data buffers so multi-GB tables
        // don't accumulate across cases on an 8 GB card.
        miner.free_dag_caches();
        let dag_res = match c.algo {
                "ethash" | "etchash" | "octopus" => {
                    Some(miner.generate_ethash_dag_on_gpu(0))
                }
                "kawpow" | "evrprogpow" | "meowpow" => {
                    Some(miner.generate_kawpow_dag_on_gpu(0))
                }
                "progpow" | "progpowz" => Some(miner.generate_progpow_dag_on_gpu(0)),
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
        // Verthash bisect: verify the keccak input stage (sha3_512_256 →
        // io_hashes) against the CPU ref before running the full pipeline.
        if c.algo == "verthash" {
            match miner.verthash_io_hashes_debug(&c.header, base_nonce, 4) {
                Ok(io) => {
                    for (i, gpu_hash) in io.iter().enumerate() {
                        let want = zion_miner::auxpow::verthash_ref::verthash_io_hash_ref(
                            &c.header,
                            base_nonce + i as u64,
                        );
                        if *gpu_hash != want {
                            println!(
                                "{:<14} FAIL  io_hash[{}] mismatch gpu={} cpu={} (keccak input stage)",
                                c.algo,
                                i,
                                hex::encode(&gpu_hash[..8]),
                                hex::encode(&want[..8])
                            );
                            fail += 1;
                            continue 'cases;
                        }
                    }
                    eprintln!("  verthash io_hash ≡ CPU ref");
                }
                Err(e) => {
                    println!("{:<14} ERR   io_hash debug failed: {e}", c.algo);
                    fail += 1;
                    continue;
                }
            }
        }
        // Ethash: hashimoto CPU ref — verify the GPU kernel's mix_hash against
        // the standard spec (light cache + on-demand dataset items).
        if c.algo == "ethash" {
            match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                use zion_miner::auxpow::gpu_opencl_full::{
                    ethash_dag_entries, ethash_dataset_item, ethash_hash_ref,
                };
                let cache = zion_miner::auxpow::gpu_opencl_full::ethash_light_cache(0);
                let dag_items = ethash_dag_entries(0);
                // Bisect 1: GPU DAG entries ≡ CPU dataset items.
                for e in [0u64, 1, 7, 1024] {
                    let gpu_entry = miner.ethash_dag_read_slice(e, 1)?;
                    let mut gpu_bytes = [0u8; 128];
                    for (i, w) in gpu_entry.iter().enumerate() {
                        gpu_bytes[i * 8..i * 8 + 8].copy_from_slice(&w.to_le_bytes());
                    }
                    let d0 = ethash_dataset_item(&cache, (2 * e) as usize);
                    let d1 = ethash_dataset_item(&cache, (2 * e + 1) as usize);
                    if gpu_bytes[..64] != d0 || gpu_bytes[64..] != d1 {
                        anyhow::bail!(
                            "ethash DAG entry {e} mismatch: gpu={} cpu={}||{}",
                            hex::encode(&gpu_bytes[..8]),
                            hex::encode(&d0[..8]),
                            hex::encode(&d1[..8])
                        );
                    }
                }
                eprintln!("  ethash DAG items ≡ CPU ref");
                let share = miner
                    .mine("ethash", &c.header, &c.extra, &[0xffu8; 32], base_nonce, batch)?
                    .ok_or_else(|| anyhow::anyhow!("ethash mine: no share found"))?;
                let (mix_expect, _) =
                    ethash_hash_ref(&c.header, share.nonce, &cache, dag_items);
                let got = share.mix_hash.unwrap_or([0u8; 32]);
                if got != mix_expect {
                    anyhow::bail!(
                        "ethash mix mismatch nonce={}: gpu={} cpu={}",
                        share.nonce,
                        hex::encode(got),
                        hex::encode(mix_expect)
                    );
                }
                Ok::<_, anyhow::Error>(format!("mine mix_hash≡CPU nonce={}", share.nonce))
            })) {
                Ok(Ok(what)) => {
                    println!("{:<14} PASS  {what} ({:.0?})", c.algo, t0.elapsed());
                    pass += 1;
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
            continue;
        }

        // KawPow/ProgPow: verify the GPU digest against the ProgOp CPU
        // interpreter. The CPU ref consumes the SAME op sequence the codegen
        // renders into the kernel, so a match proves the kernel executes the
        // intended ProgPow math (fill_mix → 64 DAG loops → lane fold →
        // keccak_f800 bookends). DAG words are computed on demand via the
        // ethash dataset-item reference (the GPU DAG is built by the same
        // kawpow_dag.cl generator the KAT already verified byte-exact).
        if matches!(
            c.algo,
            "kawpow" | "evrprogpow" | "meowpow" | "progpow" | "progpowz"
        ) {
            match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                use std::collections::HashMap;
                use zion_miner::auxpow::gpu_opencl_full::{
                    ethash_dag_entries, ethash_dataset_item, ethash_light_cache,
                };
                use zion_miner::auxpow::progpow_codegen::{
                    kawpow_digest_ref, progpow_digest_ref, select_progpow_params,
                };
                let params = select_progpow_params(c.algo);

                let cache = ethash_light_cache(0);
                // Host: PROGPOW_DAG_ELEMENTS = size_entries/2 (entries=128B).
                let dag_elements = (ethash_dag_entries(0) / 2) as u32;
                // DAG word w: entry e = w/32, item = 2e + (w%32)/16,
                // word offset w%16 inside the 64-byte item.
                let mut item_memo: HashMap<usize, [u8; 64]> = HashMap::new();
                let cache_ref = &cache;
                let mut dag_word = |w: usize| -> u32 {
                    let e = w / 32;
                    let item = 2 * e + (w % 32) / 16;
                    let word = w % 16;
                    let bytes = item_memo
                        .entry(item)
                        .or_insert_with(|| ethash_dataset_item(cache_ref, item));
                    u32::from_le_bytes(bytes[word * 4..word * 4 + 4].try_into().unwrap())
                };

                let share = miner
                    .mine(c.algo, &c.header, &c.extra, &[0xffu8; 32], base_nonce, batch)?
                    .ok_or_else(|| anyhow::anyhow!("{} mine: no share found", c.algo))?;

                let (expect, _) = if matches!(c.algo, "kawpow" | "evrprogpow" | "meowpow") {
                    // KawPow-family: host packs header LE into 10 words; the
                    // kernel overwrites word 8 with gid; word 9 = header
                    // bytes 36..40 or 0.
                    let mut blob = [0u32; 10];
                    let hlen = c.header.len().min(40);
                    for i in (0..hlen).step_by(4) {
                        let rem = hlen - i;
                        if rem >= 4 {
                            blob[i / 4] =
                                u32::from_le_bytes(c.header[i..i + 4].try_into().unwrap());
                        } else {
                            let mut b = [0u8; 4];
                            b[..rem].copy_from_slice(&c.header[i..i + rem]);
                            blob[i / 4] = u32::from_le_bytes(b);
                        }
                    }
                    // KawPow kernel reports gid (batch-local index).
                    kawpow_digest_ref(
                        params,
                        0,
                        &blob,
                        share.nonce as u32,
                        dag_elements,
                        &mut dag_word,
                    )
                } else {
                    let mut h32 = [0u8; 32];
                    let copy = c.header.len().min(32);
                    h32[..copy].copy_from_slice(&c.header[..copy]);
                    progpow_digest_ref(
                        params,
                        0,
                        &h32,
                        share.nonce,
                        dag_elements,
                        &mut dag_word,
                        c.algo == "progpowz",
                    )
                };
                let got = share.mix_hash.unwrap_or([0u8; 32]);
                let mut expect_bytes = [0u8; 32];
                for (i, w) in expect.iter().enumerate() {
                    expect_bytes[i * 4..i * 4 + 4].copy_from_slice(&w.to_le_bytes());
                }
                if got != expect_bytes {
                    anyhow::bail!(
                        "{} digest mismatch nonce={}: gpu={} cpu={}",
                        c.algo,
                        share.nonce,
                        hex::encode(got),
                        hex::encode(expect_bytes)
                    );
                }
                Ok::<_, anyhow::Error>(format!("mine mix≡CPU nonce={}", share.nonce))
            })) {
                Ok(Ok(what)) => {
                    println!("{:<14} PASS  {what} ({:.0?})", c.algo, t0.elapsed());
                    pass += 1;
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
            continue;
        }

        // FishHash-family: verify the on-GPU `build` kernel against the CPU
        // dataset-item reference on a small slice (full DAG = 4.6 GB, so we
        // validate the construction path, not the full mining kernel).
        if c.algo == "fishhash" || c.algo == "karlsenhash" {
            match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                use zion_miner::auxpow::gpu_opencl_full::{
                    build_fishhash_light_cache, fishhash_dataset_item, fishhash_hash_ref,
                    karlsenhash_hash_ref,
                };
                // 1) DAG construction: GPU `build` kernel ≡ CPU dataset item ref.
                let nodes = miner.fishhash_build_dag_slice(0, 512)?; // 256 items
                let cache = build_fishhash_light_cache();
                let mut mismatches = 0usize;
                for item in 0..256usize {
                    let expect = fishhash_dataset_item(&cache, item);
                    let got = &nodes[item * 128..item * 128 + 128];
                    if got != expect {
                        if mismatches == 0 {
                            eprintln!(
                                "  {} item {item} mismatch: gpu={} cpu={}",
                                c.algo,
                                hex::encode(&got[..8]),
                                hex::encode(&expect[..8])
                            );
                        }
                        mismatches += 1;
                    }
                }
                if mismatches > 0 {
                    anyhow::bail!("{mismatches}/256 DAG items mismatch");
                }
                // 2) Mine kernel on a reduced DAG (4096 items = 512 KB):
                //    same code path as production (dagSize is a runtime arg),
                //    max target → every nonce is a share, then verify the hash.
                const ITEMS: usize = 4096;
                let dag = miner.fishhash_build_dag_slice(0, 2 * ITEMS as u32)?;
                miner.set_fishhash_dag(&dag, ITEMS as u32)?;
                let hlen = if c.algo == "fishhash" { 180 } else { 80 };
                let mut header = vec![0u8; hlen];
                let copy = c.header.len().min(hlen);
                header[..copy].copy_from_slice(&c.header[..copy]);
                for i in 0..hlen {
                    header[i] ^= 0x5au8.rotate_left((i % 8) as u32);
                }
                let share = miner
                    .mine(c.algo, &header, &c.extra, &[0xffu8; 32], base_nonce, batch)?
                    .ok_or_else(|| anyhow::anyhow!("{} mine: no share found", c.algo))?;
                let expect = if c.algo == "fishhash" {
                    fishhash_hash_ref(&header, share.nonce, &dag, ITEMS)
                } else {
                    karlsenhash_hash_ref(&header, share.nonce, &dag, ITEMS)
                };
                if share.hash != expect {
                    anyhow::bail!(
                        "{} hash mismatch nonce={}: gpu={} cpu={}",
                        c.algo,
                        share.nonce,
                        hex::encode(share.hash),
                        hex::encode(expect)
                    );
                }
                Ok::<_, anyhow::Error>(format!(
                    "DAG-slice≡CPU + mine≡CPU nonce={}",
                    share.nonce
                ))
            })) {
                Ok(Ok(what)) => {
                    println!("{:<14} PASS  {what} ({:.0?})", c.algo, t0.elapsed());
                    pass += 1;
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
            continue;
        }

        let mut res = Ok(Ok(None));
        for rep in 0..repeats {
            let nonce = base_nonce.wrapping_add(rep as u64);
            res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                miner.mine(c.algo, &c.header, &c.extra, &target, nonce, batch)
            }));
            // Stop on first found share or hard error; EMPTY retries.
            match &res {
                Ok(Ok(Some(_))) | Ok(Err(_)) | Err(_) => break,
                Ok(Ok(None)) => continue,
            }
        }
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
