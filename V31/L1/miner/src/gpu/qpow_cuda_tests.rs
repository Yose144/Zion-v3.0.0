use super::*;
use std::time::{Duration, Instant};

const PROBE_MODULE: &str = "qpow_direct_tests";

#[test]
fn qpow_single_nonce_is_opt_in_and_requires_npt_one() {
    assert!(single_nonce_enabled(Some("1")));
    for value in [None, Some("0"), Some(""), Some("true")] {
        assert!(!single_nonce_enabled(value));
    }
    assert_eq!(select_qpow_kernel(true, 1), QPOW_SINGLE_NONCE_KERNEL);
    for npt in [0, 1, 2, 4, 8] {
        assert_eq!(select_qpow_kernel(false, npt), QPOW_KERNEL);
        if npt != 1 {
            assert_eq!(select_qpow_kernel(true, npt), QPOW_KERNEL);
        }
    }
}

const ARITH_PROBE: &str = r#"
extern "C" __global__ void qpow_test_arithmetic(
    const u64* input, u64* output, u32 count)
{
    u32 id = blockIdx.x * blockDim.x + threadIdx.x;
    if (id >= count) return;
    u64 a = input[4 * id], b = input[4 * id + 1];
    Wide w;
    w.l0 = (u32)input[4 * id + 2];
    w.l1 = (u32)(input[4 * id + 2] >> 32);
    w.h = (u32)input[4 * id + 3];
    u32 r0, r1, r2, r3;
    mul64wide(a, b, r0, r1, r2, r3);
    u64* out = output + 8 * id;
    out[0] = ((u64)r1 << 32) | r0;
    out[1] = ((u64)r3 << 32) | r2;
    out[2] = reduce128(r0, r1, r2, r3);
    out[3] = gf64_sqr(a);
    mul128_add_wide(a, b, w, r0, r1, r2, r3);
    out[4] = ((u64)r1 << 32) | r0;
    out[5] = ((u64)r3 << 32) | r2;
    mul64wide(a, b, r0, r1, r2, r3);
    add128_wide(r0, r1, r2, r3, w);
    out[6] = ((u64)r1 << 32) | r0;
    out[7] = ((u64)r3 << 32) | r2;
}
"#;

const FIRST_SQUEEZE_PROBE: &str = r#"
extern "C" __global__ void qpow_test_first_squeeze(
    const u32* prestate, u64 base, u32* output)
{
    u32 id = blockIdx.x * blockDim.x + threadIdx.x;
    if (id >= 64u) return;
    u64 mid[12], st[12];
    #pragma unroll
    for (int i = 0; i < 12; i++)
        mid[i] = ((u64)prestate[2 * i + 1] << 32) | prestate[2 * i];
    #pragma unroll
    for (int path = 0; path < 2; path++) {
        #pragma unroll
        for (int i = 0; i < 12; i++) st[i] = mid[i];
        // The single-nonce production entry consumes its prestate in place.
        if (path == 0) eval_nonce_state(mid, base + id, st);
        else eval_nonce_state(st, base + id, st);
        #pragma unroll
        for (int i = 0; i < 4; i++) {
            u64 c = gf64_canon(st[i]);
            output[16 * id + path * 8 + 2 * i] = (u32)c;
            output[16 * id + path * 8 + 2 * i + 1] = (u32)(c >> 32);
        }
    }
}
"#;

fn load_probe(source: &str, name: &'static str) -> Arc<CudaDevice> {
    let dev = CudaDevice::new(0).expect("CUDA device required");
    let mut options = vec![
        "--use_fast_math".to_string(),
        format!("-arch={}", detect_cuda_arch(&dev)),
        "--std=c++14".to_string(),
    ];
    if let Ok(extra) = std::env::var("QPOW_NVRTC_OPTS") {
        options.extend(extra.split_whitespace().map(str::to_string));
    }
    let source = format!("{}\n{source}", preprocess_kernel(POSEIDON2_CU));
    let ptx = compile_ptx_with_opts(
        &source,
        CompileOptions {
            options,
            ..Default::default()
        },
    )
    .expect("compile direct QPoW probe");
    dev.load_ptx(ptx, PROBE_MODULE, &[name])
        .expect("load direct QPoW probe");
    dev
}

fn lazy_reduce_reference(product: u128) -> u64 {
    let low = product as u64;
    let (sum, carry) = low.overflowing_add(((product >> 64) as u32 as u64) * 0xffff_ffff);
    let correction = ((product >> 96) as u32).wrapping_add(u32::from(carry));
    sum.wrapping_add(u64::from(carry) << 32)
        .wrapping_sub(correction as u64)
}

#[test]
#[ignore = "requires an isolated CUDA device"]
fn cuda_fused_mds_arithmetic_matches_wide_reference() {
    const EDGES: [u64; 15] = [
        0,
        1,
        2,
        0xffff_ffff,
        0x1_0000_0000,
        0x1_0000_0001,
        0xffff_ffff_0000_0000,
        0xffff_ffff_0000_0001,
        0xffff_ffff_0000_0002,
        u64::MAX - 1,
        u64::MAX,
        0x8000_0000_0000_0000,
        0xffff_fffe,
        0x1_0000_0002,
        0xffff_fffe_ffff_ffff,
    ];
    const DIAG: [u64; 12] = [
        0xc3b6c08e23ba9300,
        0xd84b5de94a324fb6,
        0x0d0c371c5b35b84f,
        0x7964f570e7188037,
        0x5daf18bbd996604b,
        0x6743bc47b9595257,
        0x5528b9362c59bb70,
        0xac45e25b7127b68b,
        0xa2077d7dfbb606b5,
        0xf3faac6faee378ae,
        0x0c6388b51545e883,
        0xd27dbb6944917b60,
    ];
    // The fused helper promises exact products for MDS multipliers and
    // small 96-bit row sums, not arbitrary unbounded 96-bit addends.
    let mut cases = Vec::new();
    for (ai, &a) in EDGES.iter().enumerate() {
        for (bi, &b) in DIAG.iter().enumerate() {
            for high in [0u64, 1, 12, 15] {
                for &low in &[0, EDGES[(ai + bi) % EDGES.len()], u64::MAX] {
                    cases.extend_from_slice(&[a, b, low, high]);
                }
            }
        }
    }
    let mut random = 0xd1b5_4a32_d192_ed03u64;
    let mut next = || {
        random ^= random << 13;
        random ^= random >> 7;
        random ^= random << 17;
        random
    };
    for _ in 0..65_536 {
        let a = next();
        let b = DIAG[(next() % DIAG.len() as u64) as usize];
        let low = next();
        let high = next() & 15;
        cases.extend_from_slice(&[a, b, low, high]);
    }
    let count = cases.len() / 4;
    let dev = load_probe(ARITH_PROBE, "qpow_test_arithmetic");
    let input = dev.htod_sync_copy(&cases).expect("arithmetic input");
    let mut output = dev.alloc_zeros::<u64>(count * 8).expect("output");
    let function = dev.get_func(PROBE_MODULE, "qpow_test_arithmetic").unwrap();
    unsafe {
        function
            .launch(
                LaunchConfig::for_num_elems(count as u32),
                (&input, &mut output, count as u32),
            )
            .expect("arithmetic probe launch");
    }
    let output = dev.dtoh_sync_copy(&output).expect("arithmetic readback");
    for (case, words) in cases.chunks_exact(4).enumerate() {
        let [a, b, low, high] = <[u64; 4]>::try_from(words).unwrap();
        let product = (a as u128) * (b as u128);
        let sum = product + (low as u128 | ((high as u128) << 64));
        let expected = [
            product as u64,
            (product >> 64) as u64,
            lazy_reduce_reference(product),
            lazy_reduce_reference((a as u128) * (a as u128)),
            sum as u64,
            (sum >> 64) as u64,
            sum as u64,
            (sum >> 64) as u64,
        ];
        assert_eq!(
            &output[case * 8..(case + 1) * 8],
            &expected,
            "case={case} a={a:#018x} b={b:#018x} sum={high:#x}:{low:#018x}"
        );
    }
    eprintln!("qpow_cuda_arithmetic cases={count} outputs_per_case=8");
}

#[test]
#[ignore = "requires an isolated CUDA device"]
fn cuda_first_squeeze_matches_cpu_corpus() {
    let headers: [[u8; 32]; 4] = [
        [0; 32],
        [0xff; 32],
        std::array::from_fn(|i| i as u8),
        std::array::from_fn(|i| (i as u8).wrapping_mul(17).wrapping_add(3)),
    ];
    let mut extra_nonce = [0u8; 64];
    extra_nonce[..4].copy_from_slice(&[0xde, 0xad, 0xbe, 0xef]);
    for (i, byte) in extra_nonce.iter_mut().enumerate().take(56).skip(32) {
        *byte = i as u8;
    }
    let prefixes: [[u8; 64]; 4] = [
        [0; 64],
        [0xff; 64],
        extra_nonce,
        std::array::from_fn(|i| (i as u8).wrapping_mul(13).wrapping_add(7)),
    ];
    let bases = [0, 0xffff_fffc, 0x0123_4567_89ab_cdef, u64::MAX - 63];
    let dev = load_probe(FIRST_SQUEEZE_PROBE, "qpow_test_first_squeeze");
    let mut prestate = dev.alloc_zeros::<u32>(24).expect("prestate");
    let mut output = dev.alloc_zeros::<u32>(64 * 16).expect("output");
    let function = dev
        .get_func(PROBE_MODULE, "qpow_test_first_squeeze")
        .unwrap();
    let mut checked = 0;
    for (hi, header) in headers.iter().enumerate() {
        for (pi, prefix) in prefixes.iter().enumerate() {
            for base in bases {
                let mut nonce = *prefix;
                nonce[56..64].copy_from_slice(&base.to_be_bytes());
                let mid = qpow::mining_prestate_low64(header, &nonce);
                let packed: Vec<u32> = mid
                    .iter()
                    .flat_map(|&value| [value as u32, (value >> 32) as u32])
                    .collect();
                dev.htod_copy_into(packed, &mut prestate)
                    .expect("prestate upload");
                unsafe {
                    function
                        .clone()
                        .launch(
                            LaunchConfig {
                                grid_dim: (1, 1, 1),
                                block_dim: (64, 1, 1),
                                shared_mem_bytes: 0,
                            },
                            (&prestate, base, &mut output),
                        )
                        .expect("first-squeeze probe launch");
                }
                let words = dev.dtoh_sync_copy(&output).expect("squeeze readback");
                for index in 0..64usize {
                    nonce[56..64].copy_from_slice(&(base + index as u64).to_be_bytes());
                    let hash = qpow::get_nonce_hash(header, &nonce);
                    for path in 0..2 {
                        for word in 0..8 {
                            let expected = u32::from_le_bytes(
                                hash[word * 4..word * 4 + 4].try_into().unwrap(),
                            );
                            assert_eq!(
                                words[index * 16 + path * 8 + word],
                                expected,
                                "header={hi} prefix={pi} base={base:#018x} index={index} path={path} word={word}"
                            );
                        }
                    }
                    checked += 1;
                }
            }
        }
    }
    assert_eq!(checked, 4096);
    eprintln!("qpow_cuda_first_squeeze checked={checked} paths=2");
}

#[test]
#[ignore = "16-second exclusive-GPU benchmark; not a correctness gate"]
fn cuda_bench_sustained_windows() {
    const BATCH: u64 = 1 << 22;
    const WINDOWS: usize = 16;
    const WARMUP_WINDOWS: usize = 4;
    let dev = CudaDevice::new(0).expect("CUDA device required");
    let mut miner = QpowCudaMiner::new_with_device(BATCH as usize, dev).expect("miner");
    let header = [0u8; 32];
    let mut target = [0u8; 64];
    target[63] = 1;
    let mut nonce = [0u8; 64];
    let mut cursor = 0u64;
    eprintln!(
        "qpow_cuda_bench_config batch={BATCH} windows={WINDOWS} warmup={WARMUP_WINDOWS} \
         nvrtc={:?} tpb={:?} npt={:?} single_nonce={}",
        std::env::var("QPOW_NVRTC_OPTS").ok(),
        std::env::var("QPOW_TPB").ok(),
        std::env::var("QPOW_NPT").ok(),
        miner.single_nonce,
    );
    for window in 0..WINDOWS {
        let start = Instant::now();
        let mut nonces = 0u64;
        while start.elapsed() < Duration::from_secs(1) {
            nonce[56..64].copy_from_slice(&cursor.to_be_bytes());
            let hit = miner
                .mine_batch(&header, &nonce, &target, BATCH)
                .expect("benchmark batch");
            assert!(
                hit.is_none(),
                "target-1 benchmark unexpectedly found a share"
            );
            cursor = cursor.checked_add(BATCH).expect("nonce cursor overflow");
            nonces += BATCH;
        }
        eprintln!(
            "qpow_cuda_window index={window} warmup={} nonces={nonces} wall_ns={}",
            window < WARMUP_WINDOWS,
            start.elapsed().as_nanos(),
        );
    }
}
