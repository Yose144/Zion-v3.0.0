//! AuxPoW OpenCL kernel KAT — bit-exact GPU↔CPU verification.
//!
//! For each algorithm: mine one batch against a trivially-easy target
//! (0xFF…FF → first candidate always "hits"), then recompute the hash
//! on CPU via the real reference function and compare byte-for-byte.
//!
//!   cargo run --release -p zion-miner --features gpu-opencl --bin auxpow_kat [ALGO ...]
//!   env: ZION_KAT_BATCH (default 4096), ZION_OCL_PLATFORM_IDX/DEVICE_IDX

/// Diagnose an invalid Equihash 200,9 solution: decode the 21-bit index
/// stream, compute leaf Xi hashes with reference Blake2b semantics, and
/// report which pair levels actually collide on 20 bits.
#[cfg(feature = "gpu-opencl")]
fn equihash_debug_sol(hdr140: &[u8; 140], sol: &[u8], err: &str) {
    // Decode minimal-encoded indices: 21 bits each, MSB-first bit order.
    let n_idx = 512usize;
    let bits = 21usize;
    let mut indices = Vec::with_capacity(n_idx);
    for k in 0..n_idx {
        let bit_pos = k * bits;
        let mut v = 0u32;
        for b in 0..bits {
            let p = bit_pos + b;
            let bit = (sol[p / 8] >> (7 - p % 8)) & 1;
            v = (v << 1) | bit as u32;
        }
        indices.push(v);
    }
    // Leaf hash: blake2b(state(hdr140) ‖ (i/2)LE) → 50B → 25B slice i%2.
    let leaf = |i: u32| -> [u8; 25] {
        let mut params = blake2b_simd::Params::new();
        params.hash_length(50);
        let mut personal = b"ZcashPoW".to_vec();
        personal.extend_from_slice(&200u32.to_le_bytes());
        personal.extend_from_slice(&9u32.to_le_bytes());
        params.personal(&personal);
        let mut st = params.to_state();
        st.update(&hdr140[..]);
        st.update(&(i / 2).to_le_bytes());
        let h = st.finalize();
        let start = (i % 2) as usize * 25;
        let mut out = [0u8; 25];
        out.copy_from_slice(&h.as_bytes()[start..start + 25]);
        out
    };
    let n_bad = (0..n_idx / 2)
        .filter(|p| {
            let a = leaf(indices[p * 2]);
            let b = leaf(indices[p * 2 + 1]);
            // 20-bit collision: XOR of first 2 bytes zero + top 4 bits of third.
            !(a[0] == b[0] && a[1] == b[1] && (a[2] ^ b[2]) & 0xf0 == 0)
        })
        .count();
    // Walk the Wagner tree level by level on raw 25-byte Xi hashes.
    // Level l consumes the next 20 bits: byte offset = l*2.5 bytes.
    let mut nodes: Vec<[u8; 25]> = indices.iter().map(|&i| leaf(i)).collect();
    let mut level_report = String::new();
    for lvl in 0..9usize {
        // XOR window for this level: bits [lvl*20, lvl*20+20)
        let byte = lvl * 5 / 2; // 20 bits = 2.5 bytes
        let odd = (lvl * 20) % 8 != 0;
        let collide = |a: &[u8; 25], b: &[u8; 25]| -> bool {
            if !odd {
                a[byte] == b[byte]
                    && a[byte + 1] == b[byte + 1]
                    && (a[byte + 2] ^ b[byte + 2]) & 0xf0 == 0
            } else {
                (a[byte] ^ b[byte]) & 0x0f == 0
                    && a[byte + 1] == b[byte + 1]
                    && a[byte + 2] == b[byte + 2]
            }
        };
        let mut next = Vec::with_capacity(nodes.len() / 2);
        let mut bad = 0usize;
        for pair in nodes.chunks(2) {
            let (a, b) = (&pair[0], &pair[1]);
            if !collide(a, b) {
                bad += 1;
            }
            let mut x = [0u8; 25];
            for i in 0..25 {
                x[i] = a[i] ^ b[i];
            }
            next.push(x);
        }
        level_report.push_str(&format!(" L{}:bad={}/{}", lvl, bad, nodes.len() / 2));
        nodes = next;
        if bad > nodes.len() / 2 {
            break;
        }
    }
    // If level-1 fails, probe alternate quad groupings to learn the
    // extraction order the GPU emitted.
    let l1 = |a: &[u8; 25], b: &[u8; 25]| -> bool {
        // bits 20..40: byte2 low nibble, bytes 3,4
        (a[2] ^ b[2]) & 0x0f == 0 && a[3] == b[3] && a[4] == b[4]
    };
    let xor25 = |a: &[u8; 25], b: &[u8; 25]| -> [u8; 25] {
        let mut x = [0u8; 25];
        for i in 0..25 {
            x[i] = a[i] ^ b[i];
        }
        x
    };
    let leaves: Vec<[u8; 25]> = indices.iter().map(|&i| leaf(i)).collect();
    let mut probe = String::new();
    for q in 0..3usize {
        let n = &leaves[q * 4..q * 4 + 4];
        let cases = [
            ("01|23", xor25(&n[0], &n[1]), xor25(&n[2], &n[3])),
            ("02|13", xor25(&n[0], &n[2]), xor25(&n[1], &n[3])),
            ("03|12", xor25(&n[0], &n[3]), xor25(&n[1], &n[2])),
        ];
        for (name, a, b) in cases {
            probe.push_str(&format!(" q{}:{}={}", q, name, l1(&a, &b) as u8));
        }
    }
    // Level-1 nodes: XOR each adjacent leaf pair, then check how many of the
    // 256 resulting nodes have a level-1-colliding partner anywhere in the set.
    let l1_nodes: Vec<[u8; 25]> = leaves
        .chunks(2)
        .map(|p| xor25(&p[0], &p[1]))
        .collect();
    let mut with_partner = 0usize;
    for (i, a) in l1_nodes.iter().enumerate() {
        if l1_nodes
            .iter()
            .enumerate()
            .any(|(j, b)| j != i && l1(a, b))
        {
            with_partner += 1;
        }
    }
    probe.push_str(&format!(" l1_partnered={with_partner}/256"));
    eprintln!(
        "  equihash debug ({err}): pair0 idx=({}, {}) leaf_bad={n_bad}/256; tree:{level_report} quad_probe:{probe}",
        indices[0], indices[1]
    );
    // CPU solver on the same header+nonce for ground truth.
    if std::env::var("ZION_KAT_CPU_SOLVE").is_ok() {
        let mut once = Some(<[u8; 32]>::try_from(&hdr140[108..140]).unwrap());
        let sols = equihash::tromp::solve_200_9(&hdr140[..108], || once.take());
        eprintln!("  equihash cpu-solver: {} solution(s)", sols.len());
        for s in sols.iter().take(2) {
            eprintln!("    cpu sol first8={}", hex::encode(&s[..8]));
        }
    }
}

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
                "ethash" | "etchash" => Some(miner.generate_ethash_dag_on_gpu(0)),
                "octopus" => {
                    // Stage-0 Octopus DAG; real dataset is ~4 GiB — the KAT
                    // builds a reduced-size prefix (node contents identical,
                    // only page count shrinks) to fit VRAM.
                    let kat_nodes: u64 = std::env::var("ZION_KAT_OCTOPUS_NODES")
                        .ok()
                        .and_then(|v| v.parse().ok())
                        .unwrap_or(1 << 16);
                    let kat_height: u64 = std::env::var("ZION_KAT_OCTOPUS_HEIGHT")
                        .ok()
                        .and_then(|v| v.parse().ok())
                        .unwrap_or(0);
                    Some(miner.generate_octopus_dag_on_gpu(kat_height, kat_nodes))
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
        // GhostRider per-stage bisect: ZION_GR_BISECT=1 runs each of the 15
        // core SPH hashes on the case header and prints hex for diffing
        // against a native sphlib harness.
        if c.algo == "ghostrider"
            && std::env::var("ZION_GR_BISECT").ok().as_deref() == Some("1")
        {
            let names = [
                "blake", "bmw", "groestl", "jh", "keccak", "skein", "luffa",
                "cubehash", "shavite", "simd", "echo", "hamsi", "fugue",
                "shabal", "whirlpool",
            ];
            let hdr_len: u32 = std::env::var("ZION_GR_HDRLEN")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(c.header.len() as u32);
            let mut hdr_buf = [0u8; 80];
            let copy = (hdr_len as usize).min(80).min(c.header.len());
            hdr_buf[..copy].copy_from_slice(&c.header[..copy]);
            for (i, name) in names.iter().enumerate() {
                match miner.ghostrider_sph_test(&hdr_buf[..hdr_len as usize], i as u32) {
                    Ok(h) => println!("{i:>2} {name:<10} {}", hex::encode(h)),
                    Err(e) => println!("{i:>2} {name:<10} ERR {e}"),
                }
            }
            continue 'cases;
        }
        // GhostRider CN-variant bisect: ZION_GR_BISECT=cn runs cn_full_test
        // for each of the 6 consensus variants with their native parameters.
        if c.algo == "ghostrider" && std::env::var("ZION_GR_BISECT").ok().as_deref() == Some("cn") {
            // (name, memory, iter_div, cn_aes_init) per native cryptonight_*.c
            let variants: [(&str, u32, u32, u32); 6] = [
                ("dark", 524288, 131072, 32768),
                ("darklite", 524288, 131072, 16384),
                ("fast", 2097152, 262144, 131072),
                ("lite", 1048576, 262144, 65536),
                ("turtle", 262144, 65536, 16384),
                ("turtlelite", 262144, 65536, 8192),
            ];
            // ZION_GR_INPUT=<hex> overrides the CN input (default: case header).
            let raw: Vec<u8> = std::env::var("ZION_GR_INPUT")
                .ok()
                .and_then(|h| hex::decode(h).ok())
                .unwrap_or_else(|| c.header.to_vec());
            let hdr_len: u32 = std::env::var("ZION_GR_HDRLEN")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(raw.len() as u32);
            let mut hdr_buf = vec![0u8; hdr_len as usize];
            let copy = (hdr_len as usize).min(raw.len());
            hdr_buf[..copy].copy_from_slice(&raw[..copy]);
            for (name, mem, iter, aes_init) in variants {
                match miner.ghostrider_cn_full_test(
                    &hdr_buf[..hdr_len as usize],
                    hdr_len,
                    mem,
                    iter,
                    aes_init,
                ) {
                    Ok((h, dbg)) => {
                        println!("{name:<10} {}", hex::encode(h));
                        if std::env::var("ZION_GR_PHASES").is_ok() {
                            println!("  A {}", hex::encode(&dbg[0..200]));
                            println!("  D {}", hex::encode(&dbg[200..400]));
                            println!("  E {}", hex::encode(&dbg[400..600]));
                            println!("  C {}", hex::encode(&dbg[600..664]));
                        }
                    }
                    Err(e) => println!("{name:<10} ERR {e}"),
                }
            }
            continue 'cases;
        }
        // GhostRider extra-hash bisect: ZION_GR_BISECT=extra runs the four
        // CN final hashes (blake/groestl/jh/skein) on a 200-byte state
        // (case header zero-padded).
        if c.algo == "ghostrider"
            && std::env::var("ZION_GR_BISECT").ok().as_deref() == Some("extra")
        {
            let names = ["blake", "groestl", "jh", "skein"];
            for (i, name) in names.iter().enumerate() {
                match miner.extra_hash_test(&c.header, i as u32) {
                    Ok(h) => println!("{i} {name:<8} {}", hex::encode(h)),
                    Err(e) => println!("{i} {name:<8} ERR {e}"),
                }
            }
            continue 'cases;
        }
        // GhostRider full-pipeline bisect: ZION_GR_BISECT=pipe dumps the
        // selected algo lists and all 18 stage intermediates (64B each) for
        // diffing against a native gr.c harness.
        if c.algo == "ghostrider"
            && std::env::var("ZION_GR_BISECT").ok().as_deref() == Some("pipe")
        {
            let nonce: u64 = std::env::var("ZION_KAT_NONCE")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(0);
            match miner.ghostrider_single_hash(&c.header, nonce) {
                Ok(dump) => {
                    print!("core:");
                    for i in 0..15 {
                        print!(" {}", dump[i]);
                    }
                    println!();
                    print!("cn:  ");
                    for i in 0..6 {
                        print!(" {}", dump[15 + i]);
                    }
                    println!();
                    for st in 0..18 {
                        println!("st{:<2} {}", st, hex::encode(&dump[29 + st * 64..29 + st * 64 + 64]));
                    }
                }
                Err(e) => println!("pipe ERR {e}"),
            }
            continue 'cases;
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

        // Octopus (CFX / CIP-3): verify the GPU DAG node contents and the
        // mined digest against the CPU reference port of Conflux-Rust
        // `hash_compute` (SipHash warp matrix + remap/powmod + polynomial
        // evaluation + 256B DAG mix). The DAG prefix on the GPU is built by
        // the shared ethash-item generator which octopus reuses verbatim.
        if c.algo == "octopus" {
            match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                use zion_miner::auxpow::octopus_ref::{
                    octopus_cache_size, octopus_dag_item, octopus_hash_ref,
                    octopus_ident, octopus_make_cache,
                };
                let kat_nodes: u64 = std::env::var("ZION_KAT_OCTOPUS_NODES")
                    .ok()
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(1 << 16);
                let kat_nodes = kat_nodes & !3u64;
                let kat_height: u64 = std::env::var("ZION_KAT_OCTOPUS_HEIGHT")
                    .ok()
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(0);
                let cache_nodes = (octopus_cache_size(kat_height) / 64) as usize;
                let ident = octopus_ident(kat_height / (1 << 19));
                let cache = octopus_make_cache(cache_nodes, &ident);

                // Bisect 1: GPU DAG nodes ≡ CPU dataset items.
                for e in [0u64, 1, 3, 17, kat_nodes - 1] {
                    let gpu = miner.octopus_dag_read_slice(e, 1)?;
                    let mut gpu_node = [0u8; 64];
                    for (i, w) in gpu.iter().enumerate() {
                        gpu_node[i * 8..i * 8 + 8].copy_from_slice(&w.to_le_bytes());
                    }
                    let want = octopus_dag_item(&cache, e);
                    if gpu_node != want {
                        anyhow::bail!(
                            "octopus DAG node {e} mismatch: gpu={} cpu={}",
                            hex::encode(&gpu_node[..8]),
                            hex::encode(&want[..8])
                        );
                    }
                }
                eprintln!("  octopus DAG nodes ≡ CPU ref");

                // Bisect 2: mined digest ≡ CPU hash_compute on the same DAG.
                let mut h32 = [0u8; 32];
                let copy = c.header.len().min(32);
                h32[..copy].copy_from_slice(&c.header[..copy]);
                let cache_ref = &cache;
                let dag_item = |i: u64| octopus_dag_item(cache_ref, i);
                let share = miner
                    .mine("octopus", &c.header, &c.extra, &[0xffu8; 32], base_nonce, batch)?
                    .ok_or_else(|| anyhow::anyhow!("octopus mine: no share found"))?;
                let expect = octopus_hash_ref(&h32, share.nonce, kat_nodes, &dag_item);
                if share.hash != expect {
                    anyhow::bail!(
                        "octopus hash mismatch nonce={}: gpu={} cpu={}",
                        share.nonce,
                        hex::encode(share.hash),
                        hex::encode(expect)
                    );
                }
                Ok::<_, anyhow::Error>(format!(
                    "DAG≡CPU + mine≡CPU nonce={}",
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

        // Equihash 200,9: verify the GPU Wagner solution with the consensus
        // `equihash` crate (collision tree + ordering + ZcashPoW Blake2b
        // personalization) and re-check the sha256d share hash.
        if c.algo == "equihash" {
            match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                for rep in 0..repeats {
                    let nonce = base_nonce.wrapping_add(rep as u64);
                    if std::env::var("ZION_KAT_CPU_SOLVE").is_ok() {
                        // Ground truth: does a valid solution exist for this nonce?
                        let mut hdr = [0u8; 140];
                        let copy = c.header.len().min(140);
                        hdr[..copy].copy_from_slice(&c.header[..copy]);
                        hdr[108..140].fill(0);
                        hdr[108..116].copy_from_slice(&nonce.to_le_bytes());
                        let mut once =
                            Some(<[u8; 32]>::try_from(&hdr[108..140]).unwrap());
                        let sols = equihash::tromp::solve_200_9(&hdr[..108], || once.take());
                        eprintln!("  cpu-solve nonce={nonce}: {} sol(s)", sols.len());
                        if let Ok(path) = std::env::var("ZION_EQ_DUMP_IDX") {
                            for (si, s) in sols.iter().enumerate() {
                                let mut idx = Vec::with_capacity(512);
                                for k in 0..512usize {
                                    let mut v = 0u32;
                                    for b in 0..21 {
                                        let p = k * 21 + b;
                                        v = (v << 1)
                                            | ((s[p / 8] >> (7 - p % 8)) & 1) as u32;
                                    }
                                    idx.push(v);
                                }
                                let bytes: Vec<u8> =
                                    idx.iter().flat_map(|i| i.to_le_bytes()).collect();
                                let _ = std::fs::write(
                                    format!("{path}.cpu.{nonce}.{si}.bin"),
                                    &bytes,
                                );
                            }
                        }
                        // Sanity: run my leaf/XOR tree check on a REAL solution.
                        if let Some(s) = sols.first() {
                            let mut idx = Vec::with_capacity(512);
                            for k in 0..512usize {
                                let mut v = 0u32;
                                for b in 0..21 {
                                    let p = k * 21 + b;
                                    v = (v << 1) | ((s[p / 8] >> (7 - p % 8)) & 1) as u32;
                                }
                                idx.push(v);
                            }
                            let leaf = |i: u32| -> [u8; 25] {
                                let mut personal = b"ZcashPoW".to_vec();
                                personal.extend_from_slice(&200u32.to_le_bytes());
                                personal.extend_from_slice(&9u32.to_le_bytes());
                                let mut st = blake2b_simd::Params::new()
                                    .hash_length(50)
                                    .personal(&personal)
                                    .to_state();
                                st.update(&hdr[..]);
                                st.update(&(i / 2).to_le_bytes());
                                let h = st.finalize();
                                let start = (i % 2) as usize * 25;
                                let mut o = [0u8; 25];
                                o.copy_from_slice(&h.as_bytes()[start..start + 25]);
                                o
                            };
                            let mut nodes: Vec<[u8; 25]> =
                                idx.iter().map(|&i| leaf(i)).collect();
                            let mut rep = String::new();
                            for lvl in 0..9usize {
                                let byte = lvl * 5 / 2;
                                let odd = (lvl * 20) % 8 != 0;
                                let col = |a: &[u8; 25], b: &[u8; 25]| {
                                    if !odd {
                                        a[byte] == b[byte]
                                            && a[byte + 1] == b[byte + 1]
                                            && (a[byte + 2] ^ b[byte + 2]) & 0xf0 == 0
                                    } else {
                                        (a[byte] ^ b[byte]) & 0x0f == 0
                                            && a[byte + 1] == b[byte + 1]
                                            && a[byte + 2] == b[byte + 2]
                                    }
                                };
                                let mut bad = 0usize;
                                let mut next = Vec::new();
                                for p in nodes.chunks(2) {
                                    if !col(&p[0], &p[1]) {
                                        bad += 1;
                                    }
                                    let mut x = [0u8; 25];
                                    for i in 0..25 {
                                        x[i] = p[0][i] ^ p[1][i];
                                    }
                                    next.push(x);
                                }
                                rep.push_str(&format!(" L{lvl}:bad={bad}"));
                                nodes = next;
                            }
                            eprintln!("  cpu-sol tree check:{rep}");
                            if let Ok(path) = std::env::var("ZION_EQ_DUMP_IDX") {
                                let bytes: Vec<u8> =
                                    idx.iter().flat_map(|i| i.to_le_bytes()).collect();
                                let _ = std::fs::write(
                                    format!("{path}.cpu.{nonce}.bin"),
                                    &bytes,
                                );
                            }
                        }
                    }
                    let share = match miner
                        .mine("equihash", &c.header, &c.extra, &target, nonce, batch)
                    {
                        Ok(Some(s)) => s,
                        Ok(None) => continue,
                        Err(e) => anyhow::bail!("mine err: {e}"),
                    };
                    // Reconstruct the 140-byte Zcash header the host used:
                    // input prefix = [0..108], nonce field = [108..140] with
                    // the share nonce in the first 8 bytes (LE), rest zero.
                    let mut hdr = [0u8; 140];
                    let copy = c.header.len().min(140);
                    hdr[..copy].copy_from_slice(&c.header[..copy]);
                    hdr[108..140].fill(0);
                    hdr[108..116].copy_from_slice(&share.nonce.to_le_bytes());
                    let sol = share
                        .solution
                        .as_deref()
                        .ok_or_else(|| anyhow::anyhow!("share has no solution"))?;
                    if let Err(e) =
                        equihash::is_valid_solution(200, 9, &hdr[..108], &hdr[108..140], sol)
                    {
                        // Diagnose: decode the 21-bit index stream and check
                        // whether adjacent leaves collide on 20 bits using the
                        // reference Blake2b personalization.
                        equihash_debug_sol(&hdr, sol, &e.to_string());
                        if let Ok(path) = std::env::var("ZION_KAT_DUMP_SOL") {
                            let mut d = hdr.to_vec();
                            d.extend_from_slice(&share.nonce.to_le_bytes());
                            d.extend_from_slice(sol);
                            std::fs::write(&path, &d).ok();
                        }
                        anyhow::bail!("solution invalid: {e}");
                    }
                    // Re-verify sha256d(hdr ‖ varint(1344) ‖ sol) == share.hash
                    use sha2::{Digest, Sha256};
                    let mut buf = Vec::with_capacity(140 + 3 + sol.len());
                    buf.extend_from_slice(&hdr);
                    buf.extend_from_slice(&[0xfd, 0x40, 0x05]); // varint 1344
                    buf.extend_from_slice(sol);
                    let h1 = Sha256::digest(&buf);
                    let h2: [u8; 32] = Sha256::digest(&h1).into();
                    if h2 != share.hash {
                        anyhow::bail!(
                            "sha256d mismatch: gpu={} cpu={}",
                            hex::encode(&share.hash[..8]),
                            hex::encode(&h2[..8])
                        );
                    }
                    return Ok::<_, anyhow::Error>(format!(
                        "Wagner sol valid + sha256d≡ nonce={}",
                        share.nonce
                    ));
                }
                anyhow::bail!("no solution in {repeats} reps")
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
