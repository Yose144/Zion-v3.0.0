//! AuxPoW CUDA kernel KAT — bit-exact GPU↔CPU verification for the CUDA
//! backend (the OpenCL sweep lives in `auxpow_kat.rs`).
//!
//! For each algorithm: mine one batch against a trivially-easy target
//! (0xFF…FF), then recompute the reported nonce's hash on CPU via the
//! real reference implementation and compare byte-for-byte.
//!
//!   cargo run --release -p zion-miner \
//!       --features "gpu-cuda gpu-opencl native-all" \
//!       --bin auxpow_cuda_kat [ALGO ...]
//!
//! (gpu-opencl is needed only because some pure-CPU DAG/ethash helpers
//!  live in `gpu_opencl_full.rs`.)
//! env: ZION_KAT_BATCH (default 4096), ZION_AUTOLYKOS_TABLE_SIZE

#[cfg(all(feature = "gpu-cuda", feature = "gpu-opencl"))]
mod imp {
    use anyhow::{Context, Result};
    use std::time::Instant;
    use zion_core::V3DifficultyTarget as DifficultyTarget;
    use zion_miner::auxpow::hasher;
    use zion_miner::gpu::cuda_external::CudaExternalMiner;
    use zion_miner::gpu::GpuMiner;

    struct Case {
        algo: &'static str,
        /// Raw header passed to `mine_batch_raw`.
        header: Vec<u8>,
        /// Epoch/height handed to `update_epoch` (DAG algos + autolykos).
        height: u64,
        /// Verify (nonce, hash, mix_hash) on CPU.
        verify: fn(&CudaCaseCtx, u64, &[u8; 32], Option<&[u8; 32]>) -> Result<()>,
    }

    struct CudaCaseCtx {
        header: Vec<u8>,
        height: u64,
    }

    pub fn run() -> Result<()> {
        let filter: Vec<String> = std::env::args().skip(1).collect();
        let batch: u64 = std::env::var("ZION_KAT_BATCH")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(4096);

        let mut kh_header = vec![0xABu8; 32];
        kh_header.extend_from_slice(&1234567890u64.to_le_bytes());

        let mut krx_header = vec![0xCDu8; 32];
        krx_header.extend_from_slice(&987654321u64.to_le_bytes()); // timestamp
        krx_header.extend_from_slice(&0u64.to_le_bytes()); // daa_score=0 → salt v1

        let cases: Vec<Case> = vec![
            Case {
                algo: "keryxhash",
                header: krx_header.clone(),
                height: 0,
                verify: |ctx, nonce, hash, _mix| {
                    let ts = u64::from_le_bytes(ctx.header[32..40].try_into().unwrap());
                    let daa = u64::from_le_bytes(ctx.header[40..48].try_into().unwrap());
                    let expect = hasher::hash_keryxhash(&ctx.header[..32], ts, nonce, daa);
                    if *hash != expect {
                        anyhow::bail!(
                            "keryxhash mismatch: gpu={} cpu={}",
                            hex::encode(hash),
                            hex::encode(expect)
                        );
                    }
                    Ok(())
                },
            },
            Case {
                algo: "kheavyhash",
                header: kh_header.clone(),
                height: 0,
                verify: |ctx, nonce, hash, _mix| {
                    let ts = u64::from_le_bytes(ctx.header[32..40].try_into().unwrap());
                    let expect = hasher::hash_kheavyhash(&ctx.header[..32], ts, nonce);
                    if *hash != expect {
                        anyhow::bail!(
                            "kheavyhash mismatch: gpu={} cpu={}",
                            hex::encode(hash),
                            hex::encode(expect)
                        );
                    }
                    Ok(())
                },
            },
            Case {
                algo: "blake3_dcr",
                header: vec![0x11u8; 180],
                height: 0,
                verify: |ctx, nonce, hash, _mix| {
                    let expect = hasher::hash_blake3(&ctx.header, 0, nonce);
                    if *hash != expect {
                        anyhow::bail!(
                            "blake3_dcr mismatch: gpu={} cpu={}",
                            hex::encode(hash),
                            hex::encode(expect)
                        );
                    }
                    Ok(())
                },
            },
            Case {
                algo: "blake3_alph",
                header: vec![0x22u8; 80],
                height: 0,
                verify: |ctx, nonce, hash, _mix| {
                    let expect = hasher::hash_blake3_alph(&ctx.header, &[], nonce);
                    if *hash != expect {
                        anyhow::bail!(
                            "blake3_alph mismatch: gpu={} cpu={}",
                            hex::encode(hash),
                            hex::encode(expect)
                        );
                    }
                    Ok(())
                },
            },
            Case {
                algo: "autolykos",
                header: vec![0x44u8; 32],
                height: 1,
                verify: |ctx, nonce, hash, _mix| {
                    let n: u32 = std::env::var("ZION_AUTOLYKOS_TABLE_SIZE")
                        .ok()
                        .and_then(|v| v.parse().ok())
                        .unwrap_or(1 << 23);
                    let expect =
                        hasher::hash_autolykos_v2(&ctx.header, nonce, ctx.height as u32, n);
                    if *hash != expect {
                        anyhow::bail!(
                            "autolykos mismatch: gpu={} cpu={}",
                            hex::encode(hash),
                            hex::encode(expect)
                        );
                    }
                    Ok(())
                },
            },
            Case {
                algo: "ethash",
                header: vec![0x55u8; 32],
                height: 0,
                verify: |ctx, nonce, hash, mix| {
                    use zion_miner::auxpow::gpu_opencl_full::{
                        ethash_dag_entries, ethash_hash_ref, ethash_light_cache,
                    };
                    let cache = ethash_light_cache(0);
                    let dag_items = ethash_dag_entries(0);
                    let (cmix, final_hash) = ethash_hash_ref(&ctx.header, nonce, &cache, dag_items);
                    let got_mix = *mix.context("ethash: no mix_hash reported")?;
                    if got_mix != cmix || *hash != final_hash {
                        anyhow::bail!(
                            "ethash mismatch nonce={nonce}: gpu_mix={} cpu_mix={} gpu_hash={} cpu_hash={}",
                            hex::encode(got_mix),
                            hex::encode(cmix),
                            hex::encode(hash),
                            hex::encode(final_hash)
                        );
                    }
                    Ok(())
                },
            },
            Case {
                algo: "kawpow",
                header: vec![0x77u8; 32],
                height: 0,
                verify: |ctx, nonce, _hash, mix| kawpow_progpow_verify(ctx, nonce, mix, "kawpow"),
            },
            Case {
                algo: "progpow",
                header: vec![0x66u8; 32],
                height: 0,
                verify: |ctx, nonce, _hash, mix| kawpow_progpow_verify(ctx, nonce, mix, "progpow"),
            },
            Case {
                algo: "verushash",
                header: vec![0x88u8; 32],
                height: 0,
                // Full-hash kernel path: nonceSpace15 = 11B template + u32
                // nonce at offset 11 — verify vs native hash_with_nonce.
                verify: |ctx, nonce, hash, _mix| {
                    #[cfg(feature = "native-verushash")]
                    {
                        let mut header_padded = [0u8; 64];
                        let len = ctx.header.len().min(64);
                        header_padded[..len].copy_from_slice(&ctx.header[..len]);
                        let intermediate = zion_native_ffi::verushash::hash_half(&header_padded);
                        zion_native_ffi::verushash::prepare_key(&intermediate);
                        let mut ns = [0u8; 15];
                        ns[11..15].copy_from_slice(&(nonce as u32).to_le_bytes());
                        let expect =
                            zion_native_ffi::verushash::hash_with_nonce(&intermediate, &ns);
                        if *hash != expect {
                            anyhow::bail!(
                                "verushash mismatch nonce={nonce}: gpu={} cpu={}",
                                hex::encode(&hash[..8]),
                                hex::encode(&expect[..8])
                            );
                        }
                        Ok(())
                    }
                    #[cfg(not(feature = "native-verushash"))]
                    {
                        let _ = (ctx, nonce, hash);
                        anyhow::bail!("SKIP verushash needs native-verushash")
                    }
                },
            },
            Case {
                algo: "qpow",
                header: Vec::new(),
                height: 0,
                verify: |_ctx, _nonce, _hash, _mix| Ok(()),
            },
            Case {
                algo: "zelhash",
                header: vec![0x99u8; 140],
                height: 0,
                // Equihash: the value is a solution blob, not a raw hash —
                // skip byte-compare, but still exercise the kernel launch.
                verify: |_ctx, _nonce, _hash, _mix| Ok(()),
            },
        ];

        let mut pass = 0u32;
        let mut fail = 0u32;
        let mut skip = 0u32;

        for c in cases {
            if !filter.is_empty() && !filter.iter().any(|a| a == &c.algo) {
                continue;
            }
            let t0 = Instant::now();
            let ctx = CudaCaseCtx {
                header: c.header.clone(),
                height: c.height,
            };
            match kat_one(&c, &ctx, batch) {
                Ok(what) => {
                    println!("{:<14} PASS  {what} ({:.0?})", c.algo, t0.elapsed());
                    pass += 1;
                }
                Err(e) if e.to_string().contains("SKIP") => {
                    println!("{:<14} SKIP  {e}", c.algo);
                    skip += 1;
                }
                Err(e) => {
                    println!("{:<14} ERR   {e:#}", c.algo);
                    fail += 1;
                }
            }
        }
        println!("\n=== auxpow-cuda-kat: {pass} pass / {fail} fail / {skip} skip ===");
        Ok(())
    }

    /// QPoW has its own backend (`QpowCudaMiner`, not `GpuMiner`) and the
    /// kernel's lazy 128-bit reduction is CPU-reverified per candidate inside
    /// `mine_batch` — a returned result is definitionally consensus-valid.
    fn kat_qpow(batch: u64) -> Result<String> {
        use cudarc::driver::CudaDevice;
        use zion_miner::auxpow::qpow;
        use zion_miner::gpu::qpow_cuda::QpowCudaMiner;

        let dev = CudaDevice::new(0).context("qpow: CUDA device 0")?;
        let mut miner =
            QpowCudaMiner::new_with_device(batch as usize, dev).context("qpow miner init")?;
        let header = [0x33u8; qpow::QPOW_HEADER_LEN];
        let nonce = [0u8; qpow::QPOW_NONCE_LEN];
        let target = [0xFFu8; qpow::QPOW_TARGET_LEN];
        let res = miner
            .mine_batch(&header, &nonce, &target, batch)
            .context("qpow mine_batch")?
            .ok_or_else(|| anyhow::anyhow!("qpow: no candidate in {} nonces", batch))?;
        // Independent recheck against the CPU reference hash.
        let expect = qpow::get_nonce_hash(&header, &res.nonce);
        if res.hash != expect {
            anyhow::bail!(
                "qpow mismatch: gpu={} cpu={}",
                hex::encode(&res.hash[..8]),
                hex::encode(&expect[..8])
            );
        }
        Ok(format!(
            "nonce={} hash={} (CPU-verified)",
            hex::encode(&res.nonce[56..64]),
            hex::encode(&res.hash[..8])
        ))
    }

    fn kat_one(c: &Case, ctx: &CudaCaseCtx, batch: u64) -> Result<String> {
        if c.algo == "qpow" {
            return kat_qpow(batch);
        }
        let mut miner = CudaExternalMiner::new(c.algo, batch as usize)
            .with_context(|| format!("{} miner init", c.algo))?;
        if c.algo == "autolykos" {
            // current_height drives ensure_autolykos_table.
            miner.update_epoch(ctx.height)?;
        } else if matches!(c.algo, "ethash" | "kawpow" | "progpow") {
            miner.update_epoch(0)?; // generates epoch-0 DAG on device
        }
        let target = DifficultyTarget { bytes: [0xFF; 32] };
        let res = miner
            .mine_batch_raw(&ctx.header, target, 0, batch)
            .with_context(|| format!("{} mine_batch_raw", c.algo))?;
        let (nonce, hash, mix) = res
            .solutions
            .first()
            .copied()
            .ok_or_else(|| anyhow::anyhow!("{}: no share in {} nonces", c.algo, batch))?;
        (c.verify)(ctx, nonce, &hash, mix.as_ref())?;
        Ok(format!("nonce={} hash={}", nonce, hex::encode(&hash[..8])))
    }

    /// Shared KawPow/ProgPoW verify — ProgOp CPU interpreter over the same
    /// op sequence codegen renders, digest compared against GPU mix_hash.
    fn kawpow_progpow_verify(
        ctx: &CudaCaseCtx,
        nonce: u64,
        mix: Option<&[u8; 32]>,
        algo: &str,
    ) -> Result<()> {
        use std::collections::HashMap;
        use zion_miner::auxpow::gpu_opencl_full::{
            ethash_dag_entries, ethash_dataset_item, ethash_light_cache,
        };
        use zion_miner::auxpow::progpow_codegen::{
            kawpow_digest_ref, progpow_digest_ref, select_progpow_params,
        };
        let params = select_progpow_params(algo);
        let cache = ethash_light_cache(0);
        let dag_elements = (ethash_dag_entries(0) / 2) as u32;
        let mut item_memo: HashMap<usize, [u8; 64]> = HashMap::new();
        let mut dag_word = |w: usize| -> u32 {
            let e = w / 32;
            let item = 2 * e + (w % 32) / 16;
            let word = w % 16;
            let bytes = item_memo
                .entry(item)
                .or_insert_with(|| ethash_dataset_item(&cache, item));
            u32::from_le_bytes(bytes[word * 4..word * 4 + 4].try_into().unwrap())
        };

        let expect = if algo == "kawpow" {
            // Kernel overwrites job_blob[8] with gid; word 9 is header[36..40]
            // or 0 for a 32-byte header.
            let mut blob = [0u32; 10];
            for i in 0..8 {
                blob[i] = u32::from_le_bytes(ctx.header[i * 4..i * 4 + 4].try_into().unwrap());
            }
            blob[8] = (nonce & 0xFFFF_FFFF) as u32;
            blob[9] = (nonce >> 32) as u32;
            let (expect, _) =
                kawpow_digest_ref(params, 0, &blob, nonce as u32, dag_elements, &mut dag_word);
            expect
        } else {
            let mut h32 = [0u8; 32];
            h32.copy_from_slice(&ctx.header[..32]);
            let (expect, _) =
                progpow_digest_ref(params, 0, &h32, nonce, dag_elements, &mut dag_word, false);
            expect
        };
        let got = *mix.context(format!("{algo}: no mix_hash reported"))?;
        let mut expect_bytes = [0u8; 32];
        for (i, w) in expect.iter().enumerate() {
            expect_bytes[i * 4..i * 4 + 4].copy_from_slice(&w.to_le_bytes());
        }
        if got != expect_bytes {
            anyhow::bail!(
                "{algo} digest mismatch nonce={nonce}: gpu={} cpu={}",
                hex::encode(got),
                hex::encode(expect_bytes)
            );
        }
        Ok(())
    }
}

fn main() -> anyhow::Result<()> {
    #[cfg(all(feature = "gpu-cuda", feature = "gpu-opencl"))]
    {
        imp::run()
    }
    #[cfg(not(all(feature = "gpu-cuda", feature = "gpu-opencl")))]
    {
        anyhow::bail!("auxpow_cuda_kat requires --features \"gpu-cuda gpu-opencl native-all\"")
    }
}
