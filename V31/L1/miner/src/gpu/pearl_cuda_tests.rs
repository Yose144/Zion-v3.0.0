use super::*;
use crate::auxpow::pearl::pearl_kat::tile_jackpot_ref;
use crate::auxpow::pearl::PearlMineConfig;
use std::time::Duration;

#[test]
fn pearl_selector_keeps_unverified_turing_opt_in() {
    assert_eq!(select_mine_version(None, 7, 5, 128, 2048), "v4");
    assert_eq!(select_mine_version(None, 8, 6, 128, 2048), "v6");
    for version in ["v6", "v7"] {
        assert_eq!(select_mine_version(Some(version), 7, 5, 128, 2048), version);
        assert_eq!(select_mine_version(Some(version), 7, 0, 128, 2048), "v4");
        assert_eq!(select_mine_version(Some(version), 6, 1, 128, 2048), "v4");
        assert_eq!(select_mine_version(Some(version), 8, 6, 32, 2048), "v4");
        assert_eq!(select_mine_version(Some(version), 8, 6, 128, 2050), "v4");
    }
    for version in ["v8", "v9", "v10"] {
        assert_eq!(select_mine_version(Some(version), 7, 5, 128, 2048), "v4");
        assert_eq!(select_mine_version(Some(version), 8, 0, 128, 2048), version);
    }
    assert_eq!(select_mine_version(Some("v5"), 7, 5, 256, 4096), "v4");
    assert_eq!(select_mine_version(Some("v5"), 7, 5, 32, 2048), "v5");
    assert_eq!(select_mine_version(Some("unknown"), 8, 6, 128, 2048), "v4");
    assert_eq!(select_mine_version(Some("v3"), 6, 1, 32, 64), "v3");
    assert_eq!(select_mine_version(None, 8, 6, 32, 64), "v4");
}

#[test]
fn pearl_cumulative_mma_requires_explicit_one() {
    assert!(cumulative_mma_enabled(Some("1")));
    for value in [None, Some("0"), Some(""), Some("true"), Some("v6")] {
        assert!(!cumulative_mma_enabled(value), "value={value:?}");
    }
}

const MMA_PROBE: &str = r#"
extern "C" __global__ void pearl_test_mma_fragment(
    const signed char* a, const signed char* bt,
    const uint* initial, uint* output, uint cases)
{
    uint index = blockIdx.x * (blockDim.x >> 5) + (threadIdx.x >> 5);
    if (index >= cases) return;
    uint lane = threadIdx.x & 31u;
    uint gid = lane >> 2, ka = (lane & 3u) * 4u;
    a += index * 16u * 32u;
    bt += index * 8u * 32u;
    uint offset = index * 128u + gid * 8u + (lane & 3u) * 2u;
    uint d0 = initial[offset], d1 = initial[offset + 1u];
    uint d2 = initial[offset + 64u], d3 = initial[offset + 65u];
    uint a0 = *(const uint*)(a + gid * 32u + ka);
    uint a1 = *(const uint*)(a + (gid + 8u) * 32u + ka);
    uint a2 = *(const uint*)(a + gid * 32u + ka + 16u);
    uint a3 = *(const uint*)(a + (gid + 8u) * 32u + ka + 16u);
    uint b0 = *(const uint*)(bt + gid * 32u + ka);
    uint b1 = *(const uint*)(bt + gid * 32u + ka + 16u);
    mma_s8_m16n8k32(d0, d1, d2, d3, a0, a1, a2, a3, b0, b1);
    output[offset] = d0;
    output[offset + 1u] = d1;
    output[offset + 64u] = d2;
    output[offset + 65u] = d3;
}
"#;

fn tensor_device() -> Arc<CudaDevice> {
    let dev = CudaDevice::new(0).expect("CUDA device required");
    let major = dev
        .attribute(CUdevice_attribute::CU_DEVICE_ATTRIBUTE_COMPUTE_CAPABILITY_MAJOR)
        .unwrap();
    let minor = dev
        .attribute(CUdevice_attribute::CU_DEVICE_ATTRIBUTE_COMPUTE_CAPABILITY_MINOR)
        .unwrap();
    assert!(
        major >= 8 || (major == 7 && minor >= 5),
        "this gate requires an SM75+ INT8 tensor device, got {major}.{minor}"
    );
    dev
}

#[test]
#[ignore = "requires an isolated SM75+ CUDA device"]
fn pearl_cuda_tensor_fragment_matches_cpu() {
    const CASES: usize = 32;
    let dev = tensor_device();
    let source = format!("{}\n{MMA_PROBE}", preprocess_kernel(PEARL_CU));
    let ptx = compile_ptx_with_opts(
        &source,
        CompileOptions {
            options: vec![
                "--use_fast_math".into(),
                format!("-arch={}", detect_cuda_arch(&dev)),
                "--std=c++14".into(),
            ],
            ..Default::default()
        },
    )
    .expect("compile fragment probe");
    dev.load_ptx(ptx, "pearl_fragment_test", &["pearl_test_mma_fragment"])
        .expect("load fragment probe");
    let mut random = 0xa076_1d64_78bd_642fu64;
    let mut next = || {
        random ^= random << 13;
        random ^= random >> 7;
        random ^= random << 17;
        random
    };
    let mut a = vec![0i8; CASES * 16 * 32];
    let mut bt = vec![0i8; CASES * 8 * 32];
    for (index, value) in a.iter_mut().enumerate() {
        *value = match index / (16 * 32) {
            0 => -127,
            1 => 127,
            2 => {
                if index & 1 == 0 {
                    -127
                } else {
                    127
                }
            }
            _ => ((next() % 255) as i16 - 127) as i8,
        };
    }
    for (index, value) in bt.iter_mut().enumerate() {
        *value = match index / (8 * 32) {
            0 => 127,
            1 => -127,
            2 => {
                if index & 1 == 0 {
                    127
                } else {
                    -127
                }
            }
            _ => ((next() % 255) as i16 - 127) as i8,
        };
    }
    let initial: Vec<u32> = (0..CASES * 128)
        .map(|_| ((next() % 100_001) as i32 - 50_000) as u32)
        .collect();
    let a_gpu = dev.htod_sync_copy(&a).expect("A upload");
    let bt_gpu = dev.htod_sync_copy(&bt).expect("BT upload");
    let initial_gpu = dev.htod_sync_copy(&initial).expect("C upload");
    let mut output = dev.alloc_zeros::<u32>(CASES * 128).expect("output");
    let function = dev
        .get_func("pearl_fragment_test", "pearl_test_mma_fragment")
        .unwrap();
    unsafe {
        function
            .launch(
                LaunchConfig {
                    grid_dim: ((CASES as u32).div_ceil(4), 1, 1),
                    block_dim: (128, 1, 1),
                    shared_mem_bytes: 0,
                },
                (&a_gpu, &bt_gpu, &initial_gpu, &mut output, CASES as u32),
            )
            .expect("fragment probe launch");
    }
    let output = dev.dtoh_sync_copy(&output).expect("fragment readback");
    for case in 0..CASES {
        for row in 0..16 {
            for col in 0..8 {
                let offset = case * 128 + row * 8 + col;
                let mut expected = initial[offset] as i32;
                for k in 0..32 {
                    expected +=
                        a[case * 512 + row * 32 + k] as i32 * bt[case * 256 + col * 32 + k] as i32;
                }
                assert_eq!(
                    output[offset], expected as u32,
                    "case={case} row={row} col={col}"
                );
            }
        }
    }
    eprintln!("pearl_tensor_fragment cases={CASES} outputs_per_case=128");
}

#[test]
#[ignore = "requires an isolated SM75+ device; default kernel v6"]
fn pearl_cuda_tensor_batch_slots_match_cpu() {
    const BATCH: usize = 16;
    let cfg = PearlMineConfig::from_env().expect("Pearl configuration");
    assert_eq!((cfg.m, cfg.n, cfg.k, cfg.rank), (1024, 1024, 2048, 128));
    let dev = tensor_device();
    let mut miner = PearlCudaMiner::new_with_device(cfg.k, dev).expect("Pearl miner");
    let request = std::env::var("ZION_PEARL_MINE").ok();
    // The selected kernel must equal the REQUESTED one — a silent fallback
    // must never pass this parity gate.
    assert_eq!(
        select_mine_version(
            request.as_deref(),
            miner.compute_capability.0,
            miner.compute_capability.1,
            cfg.rank,
            cfg.k,
        ),
        request.as_deref().unwrap_or("v6"),
        "requested kernel must be the selected kernel (no fallback allowed)"
    );
    let row_offsets = cfg.row_offsets();
    let col_offsets = cfg.col_offsets();
    let rows_base = cfg.rows_base();
    let cols_base = cfg.cols_base();
    let mut input = PearlPouwNativeInput {
        nonce: 0x7100,
        m: cfg.m,
        n: cfg.n,
        k: cfg.k,
        rank: cfg.rank,
        job_key: [0x77; 32],
        target: [0xff; 32],
        row_offsets: &row_offsets,
        col_offsets: &col_offsets,
        rows_base: &rows_base,
        cols_base: &cols_base,
        seed_label_a: PEARL_SEED_LABEL_A,
        seed_label_b: PEARL_SEED_LABEL_B,
        seed_derivation: PearlSeedDerivation::Salted,
    };
    miner.ensure_bufs(&input).expect("buffers");
    miner.prep_job(&input, BATCH).expect("prepare batch");
    for slot in 0..BATCH {
        miner
            .queue_attempt(&input, input.nonce + slot as u64, slot, slot)
            .expect("queue attempt");
    }
    miner.sync_pipes().expect("synchronize batch");
    let buffers = miner.bufs.as_ref().unwrap();
    let found = miner
        .dev
        .dtoh_sync_copy(&buffers.found.slice(0..BATCH))
        .expect("found readback");
    let tiles = miner
        .dev
        .dtoh_sync_copy(&buffers.output_tile.slice(0..BATCH))
        .expect("tile readback");
    let jackpots = miner
        .dev
        .dtoh_sync_copy(&buffers.output_jackpot.slice(0..BATCH * 32))
        .expect("jackpot readback");
    for slot in 0..BATCH {
        assert_eq!(found[slot], 1, "slot={slot}");
        let tile = tiles[slot] as usize;
        assert!(tile < row_offsets.len() * col_offsets.len());
        let expected = tile_jackpot_ref(
            input.nonce + slot as u64,
            cfg.m,
            cfg.n,
            cfg.k,
            cfg.rank,
            &input.job_key,
            row_offsets[tile / col_offsets.len()],
            col_offsets[tile % col_offsets.len()],
            &rows_base,
            &cols_base,
            true,
        );
        assert_eq!(
            &jackpots[slot * 32..(slot + 1) * 32],
            &expected,
            "batch slot={slot} tile={tile}"
        );
    }
    input.nonce += BATCH as u64;
    input.target = [0; 32];
    let (result, attempts) = miner
        .mine_native_batch(&input, BATCH)
        .expect("zero-target batch");
    assert_eq!(attempts, BATCH);
    assert!(result.is_none(), "all batch found flags must be reset");
}

#[test]
#[ignore = "16-second exclusive-GPU benchmark; not a correctness gate"]
fn pearl_cuda_bench_sustained_windows() {
    const BATCH: usize = 16;
    const WINDOWS: usize = 16;
    const WARMUP_WINDOWS: usize = 4;
    assert!(
        std::env::var_os("ZION_PEARL_STAGE_TIMING").is_none(),
        "unset stage timing for an uninstrumented throughput measurement"
    );
    let cfg = PearlMineConfig::from_env().expect("Pearl configuration");
    cfg.validate().expect("valid Pearl configuration");
    assert_eq!((cfg.m, cfg.n, cfg.k, cfg.rank), (1024, 1024, 2048, 128));
    let mut miner = PearlCudaMiner::new(cfg.k).expect("Pearl CUDA miner");
    let row_offsets = cfg.row_offsets();
    let col_offsets = cfg.col_offsets();
    let rows_base = cfg.rows_base();
    let cols_base = cfg.cols_base();
    let request = std::env::var("ZION_PEARL_MINE").ok();
    let selected = select_mine_version(
        request.as_deref(),
        miner.compute_capability.0,
        miner.compute_capability.1,
        cfg.rank,
        cfg.k,
    );
    let mut input = PearlPouwNativeInput {
        nonce: 0x10000,
        m: cfg.m,
        n: cfg.n,
        k: cfg.k,
        rank: cfg.rank,
        job_key: [0x77; 32],
        target: [0; 32],
        row_offsets: &row_offsets,
        col_offsets: &col_offsets,
        rows_base: &rows_base,
        cols_base: &cols_base,
        seed_label_a: PEARL_SEED_LABEL_A,
        seed_label_b: PEARL_SEED_LABEL_B,
        seed_derivation: PearlSeedDerivation::Salted,
    };
    eprintln!(
        "pearl_cuda_bench_config batch={BATCH} windows={WINDOWS} warmup={WARMUP_WINDOWS} \
         requested={request:?} selected={selected} cc={:?} streams={} cumulative_mma={}",
        miner.compute_capability,
        miner.streams.len(),
        miner.cumulative_mma,
    );
    for window in 0..WINDOWS {
        let start = Instant::now();
        let mut attempts = 0usize;
        while start.elapsed() < Duration::from_secs(1) {
            let (result, executed) = miner
                .mine_native_batch(&input, BATCH)
                .expect("benchmark batch");
            assert!(result.is_none(), "zero-target benchmark found a share");
            assert_eq!(executed, BATCH);
            input.nonce = input.nonce.checked_add(executed as u64).unwrap();
            attempts += executed;
        }
        eprintln!(
            "pearl_cuda_window index={window} warmup={} attempts={attempts} wall_ns={}",
            window < WARMUP_WINDOWS,
            start.elapsed().as_nanos(),
        );
    }
}
