//! ProgPow / KawPow random math code generator.
//!
//! Ports the C++ random math sequence generation from:
//! - xmrig: `src/backend/opencl/runners/tools/OclKawPow.cpp` (KawPowBuilder::getSource)
//! - EpicCash/progpow-rust: `lib/libprogpow/ProgPow.cpp` (ProgPow::getKern)
//!
//! The random math sequence changes every PROGPOW_PERIOD blocks. The host
//! generates OpenCL source code for the `progPowLoop` function (or inline code
//! for xmrig-style kernels) using a KISS99 RNG seeded from `block_height / PERIOD`.
//! The generated code is injected into the kernel source at compile time.

// ── KISS99 RNG ──────────────────────────────────────────────────────

#[derive(Clone, Copy)]
pub struct Kiss99 {
    pub z: u32,
    pub w: u32,
    pub jsr: u32,
    pub jcong: u32,
}

impl Kiss99 {
    pub fn new(z: u32, w: u32, jsr: u32, jcong: u32) -> Self {
        Self { z, w, jsr, jcong }
    }

    pub fn next(&mut self) -> u32 {
        self.z = 36969u32.wrapping_mul(self.z & 0xFFFF).wrapping_add(self.z >> 16);
        self.w = 18000u32.wrapping_mul(self.w & 0xFFFF).wrapping_add(self.w >> 16);
        let mwc = (self.z << 16).wrapping_add(self.w);
        self.jsr ^= self.jsr << 17;
        self.jsr ^= self.jsr >> 13;
        self.jsr ^= self.jsr << 5;
        self.jcong = 69069u32.wrapping_mul(self.jcong).wrapping_add(1234567);
        (mwc ^ self.jcong).wrapping_add(self.jsr)
    }
}

// ── FNV-1a ──────────────────────────────────────────────────────────

#[inline]
pub fn fnv1a(hash: &mut u32, data: u32) -> u32 {
    *hash = (*hash ^ data).wrapping_mul(0x01000193);
    *hash
}

// ── ProgPow parameters ──────────────────────────────────────────────

pub struct ProgPowParams {
    pub lanes: u32,
    pub regs: u32,
    pub dag_loads: u32,
    pub cnt_dag: u32,
    pub cnt_cache: u32,
    pub cnt_math: u32,
    pub period: u32,
}

/// KawPow (Ravencoin) parameters
pub const KAWPOW_PARAMS: ProgPowParams = ProgPowParams {
    lanes: 16,
    regs: 32,
    dag_loads: 4,
    cnt_dag: 64,
    cnt_cache: 11,
    cnt_math: 18,
    period: 10,
};

/// EPIC ProgPow parameters
pub const EPIC_PROGPOW_PARAMS: ProgPowParams = ProgPowParams {
    lanes: 16,
    regs: 32,
    dag_loads: 4,
    cnt_dag: 64,
    cnt_cache: 12,
    cnt_math: 20,
    period: 50,
};

/// ProgPoWZ (Zano) parameters.
/// Same as EPIC ProgPow 0.9.2: only the random-math operation indexes are
/// permuted (the DAG, keccak-f800, and final-hash structure are unchanged).
pub const PROGPOWZ_PARAMS: ProgPowParams = ProgPowParams {
    lanes: 16,
    regs: 32,
    dag_loads: 4,
    cnt_dag: 64,
    cnt_cache: 12,
    cnt_math: 20,
    period: 50,
};

/// EvrProgPow (Evrmore/EVR) parameters
/// Based on ProgPoW 0.9.4 with PERIOD=3 (vs KawPow=10) for 1-minute block time.
/// Epoch length: 12000 blocks (vs KawPow 7500). Starting DAG: 3 GB.
/// All other parameters match KawPow.
pub const EVR_PROGPOW_PARAMS: ProgPowParams = ProgPowParams {
    lanes: 16,
    regs: 32,
    dag_loads: 4,
    cnt_dag: 64,
    cnt_cache: 11,
    cnt_math: 18,
    period: 3,
};

/// MeowPow (MeowCoin/MEWC) parameters
/// Based on ProgPoW 0.9.4 with significantly reduced compute parameters.
/// PERIOD=6, REGS=16 (halved), CNT_CACHE=6 (halved), CNT_MATH=9 (halved).
/// Epoch length: 12000 blocks. Special DAG size transition at epoch 128.
pub const MEOWPOW_PARAMS: ProgPowParams = ProgPowParams {
    lanes: 16,
    regs: 16,
    dag_loads: 4,
    cnt_dag: 64,
    cnt_cache: 6,
    cnt_math: 9,
    period: 6,
};

// ── Code generation helpers ─────────────────────────────────────────

fn merge_code(a: &str, b: &str, r: u32) -> String {
    match r % 4 {
        0 => format!("{} = ({} * 33) + {};\n", a, a, b),
        1 => format!("{} = ({} ^ {}) * 33;\n", a, a, b),
        2 => format!(
            "{} = ROTL32({}, {}) ^ {};\n",
            a,
            a,
            (r >> 16) % 31 + 1,
            b
        ),
        3 => format!(
            "{} = ROTR32({}, {}) ^ {};\n",
            a,
            a,
            (r >> 16) % 31 + 1,
            b
        ),
        _ => unreachable!(),
    }
}

fn math_code(d: &str, a: &str, b: &str, r: u32) -> String {
    match r % 11 {
        0 => format!("{} = {} + {};\n", d, a, b),
        1 => format!("{} = {} * {};\n", d, a, b),
        2 => format!("{} = mul_hi({}, {});\n", d, a, b),
        3 => format!("{} = min({}, {});\n", d, a, b),
        4 => format!("{} = ROTL32({}, {});\n", d, a, b),
        5 => format!("{} = ROTR32({}, {});\n", d, a, b),
        6 => format!("{} = {} & {};\n", d, a, b),
        7 => format!("{} = {} | {};\n", d, a, b),
        8 => format!("{} = {} ^ {};\n", d, a, b),
        9 => format!("{} = clz({}) + clz({});\n", d, a, b),
        10 => format!("{} = popcount({}) + popcount({});\n", d, a, b),
        _ => unreachable!(),
    }
}

/// ProgPoWZ (Zano) math op selection.
///
/// The hyle-team/progminer reference (Zano official miner fork) permutes the
/// standard ProgPoW 0.9.2 math ops (clz/popcount moved to slots 0/1) and
/// explicitly masks the rotation count with `% 32` to match the CPU
/// `rotl32`/`rotr32` implementation. Without the mask NVIDIA's OpenCL
/// `rotate()` is implementation-defined for counts >= 32, producing wrong
/// mix hashes and rejected shares.
fn math_code_zano(d: &str, a: &str, b: &str, r: u32) -> String {
    match r % 11 {
        0 => format!("{} = clz({}) + clz({});\n", d, a, b),
        1 => format!("{} = popcount({}) + popcount({});\n", d, a, b),
        2 => format!("{} = {} + {};\n", d, a, b),
        3 => format!("{} = {} * {};\n", d, a, b),
        4 => format!("{} = mul_hi({}, {});\n", d, a, b),
        5 => format!("{} = min({}, {});\n", d, a, b),
        6 => format!("{} = ROTL32({}, ({} % 32));\n", d, a, b),
        7 => format!("{} = ROTR32({}, ({} % 32));\n", d, a, b),
        8 => format!("{} = {} & {};\n", d, a, b),
        9 => format!("{} = {} | {};\n", d, a, b),
        10 => format!("{} = {} ^ {};\n", d, a, b),
        _ => unreachable!(),
    }
}

// ── KawPow (xmrig-style) code generation ────────────────────────────
//
// Generates inline code that replaces XMRIG_INCLUDE_PROGPOW_RANDOM_MATH
// and XMRIG_INCLUDE_PROGPOW_DATA_LOADS in the xmrig kawpow.cl kernel.

/// Generate the random math + cache access code for KawPow (xmrig kernel).
/// Replaces XMRIG_INCLUDE_PROGPOW_RANDOM_MATH.
pub fn gen_kawpow_random_math(params: &ProgPowParams, prog_seed: u64) -> String {
    let seed0 = prog_seed as u32;
    let seed1 = (prog_seed >> 32) as u32;

    let mut fnv_hash = 0x811c9dc5u32;
    let mut rng = Kiss99::new(
        fnv1a(&mut fnv_hash, seed0),
        fnv1a(&mut fnv_hash, seed1),
        fnv1a(&mut fnv_hash, seed0),
        fnv1a(&mut fnv_hash, seed1),
    );

    // Create shuffled sequences for mix destinations and cache sources
    let regs = params.regs as usize;
    let mut mix_seq_dst: Vec<u32> = (0..regs as u32).collect();
    let mut mix_seq_cache: Vec<u32> = (0..regs as u32).collect();
    let mut mix_seq_dst_cnt = 0usize;
    let mut mix_seq_cache_cnt = 0usize;

    for i in (1..regs).rev() {
        let j = (rng.next() % (i as u32 + 1)) as usize;
        mix_seq_dst.swap(i, j);
        let j = (rng.next() % (i as u32 + 1)) as usize;
        mix_seq_cache.swap(i, j);
    }

    let mut ret = String::new();

    let max_ops = params.cnt_cache.max(params.cnt_math);
    for i in 0..max_ops {
        if i < params.cnt_cache {
            // Cached memory access
            let src = format!("mix[{}]", mix_seq_cache[mix_seq_cache_cnt % regs]);
            mix_seq_cache_cnt += 1;
            let dest = format!("mix[{}]", mix_seq_dst[mix_seq_dst_cnt % regs]);
            mix_seq_dst_cnt += 1;
            let r = rng.next();
            ret.push_str(&format!("offset = {} % PROGPOW_CACHE_WORDS;\n", src));
            ret.push_str("data = c_dag[offset];\n");
            ret.push_str(&merge_code(&dest, "data", r));
        }

        if i < params.cnt_math {
            // Random math — generate 2 unique sources
            let src_rnd = rng.next() % ((params.regs - 1) * params.regs);
            let src1 = src_rnd % params.regs;
            let mut src2 = src_rnd / params.regs;
            if src2 >= src1 {
                src2 += 1;
            }
            let src1_str = format!("mix[{}]", src1);
            let src2_str = format!("mix[{}]", src2);
            let r1 = rng.next();
            let dest = format!("mix[{}]", mix_seq_dst[mix_seq_dst_cnt % regs]);
            mix_seq_dst_cnt += 1;
            let r2 = rng.next();
            ret.push_str(&math_code("data", &src1_str, &src2_str, r1));
            ret.push_str(&merge_code(&dest, "data", r2));
        }
    }

    ret
}

/// Generate the DAG data load code for KawPow (xmrig kernel).
/// Replaces XMRIG_INCLUDE_PROGPOW_DATA_LOADS.
pub fn gen_kawpow_data_loads(params: &ProgPowParams, prog_seed: u64) -> String {
    let seed0 = prog_seed as u32;
    let seed1 = (prog_seed >> 32) as u32;

    let mut fnv_hash = 0x811c9dc5u32;
    let mut rng = Kiss99::new(
        fnv1a(&mut fnv_hash, seed0),
        fnv1a(&mut fnv_hash, seed1),
        fnv1a(&mut fnv_hash, seed0),
        fnv1a(&mut fnv_hash, seed1),
    );

    let regs = params.regs as usize;
    let mut mix_seq_dst: Vec<u32> = (0..regs as u32).collect();
    let mut mix_seq_cache: Vec<u32> = (0..regs as u32).collect();
    let mut mix_seq_dst_cnt = 0usize;
    let mut mix_seq_cache_cnt = 0usize;

    for i in (1..regs).rev() {
        let j = (rng.next() % (i as u32 + 1)) as usize;
        mix_seq_dst.swap(i, j);
        let j = (rng.next() % (i as u32 + 1)) as usize;
        mix_seq_cache.swap(i, j);
    }

    // Consume the same number of RNG values as gen_kawpow_random_math
    // so the RNG state is consistent for the data loads
    let max_ops = params.cnt_cache.max(params.cnt_math);
    for i in 0..max_ops {
        if i < params.cnt_cache {
            let _ = mix_seq_cache[mix_seq_cache_cnt % regs];
            mix_seq_cache_cnt += 1;
            let _ = mix_seq_dst[mix_seq_dst_cnt % regs];
            mix_seq_dst_cnt += 1;
            let _ = rng.next(); // r
        }
        if i < params.cnt_math {
            let _ = rng.next(); // src_rnd
            let _ = rng.next(); // r1
            let _ = mix_seq_dst[mix_seq_dst_cnt % regs];
            mix_seq_dst_cnt += 1;
            let _ = rng.next(); // r2
        }
    }

    // Now generate data load code
    let mut ret = String::new();

    let num_words_per_lane = 256 / (4 * params.lanes) as usize; // 256 bits / (uint32 * lanes)
    ret.push_str(&merge_code("mix[0]", "data_dag.s[0]", rng.next()));
    for i in 1..num_words_per_lane {
        let dest = format!("mix[{}]", mix_seq_dst[mix_seq_dst_cnt % regs]);
        mix_seq_dst_cnt += 1;
        let r = rng.next();
        ret.push_str(&merge_code(&dest, &format!("data_dag.s[{}]", i), r));
    }

    ret
}

// ── EPIC ProgPow code generation ────────────────────────────────────
//
// Generates inline random math and data load code for the EPIC kernel.
// Replaces PROGPOW_INCLUDE_RANDOM_MATH and PROGPOW_INCLUDE_DATA_LOADS.
// This mirrors the kawpow approach (inline code via placeholders) instead
// of a separate progPowLoop function — the SMOS OpenCL compiler may not
// inline functions containing barriers, causing GPU deadlock.

/// Generate the random math + cache load code for a ProgPow variant (inline).
fn gen_progpow_random_math_impl(
    params: &ProgPowParams,
    block_height: u64,
    math_code_fn: fn(&str, &str, &str, u32) -> String,
) -> String {
    let prog_seed = block_height / params.period as u64;
    let seed0 = prog_seed as u32;
    let seed1 = (prog_seed >> 32) as u32;

    let mut fnv_hash = 0x811c9dc5u32;
    let mut rng = Kiss99::new(
        fnv1a(&mut fnv_hash, seed0),
        fnv1a(&mut fnv_hash, seed1),
        fnv1a(&mut fnv_hash, seed0),
        fnv1a(&mut fnv_hash, seed1),
    );

    let regs = params.regs as usize;
    let mut mix_seq_dst: Vec<u32> = (0..regs as u32).collect();
    let mut mix_seq_cache: Vec<u32> = (0..regs as u32).collect();
    let mut mix_seq_dst_cnt = 0usize;
    let mut mix_seq_cache_cnt = 0usize;

    for i in (1..regs).rev() {
        let j = (rng.next() % (i as u32 + 1)) as usize;
        mix_seq_dst.swap(i, j);
        let j = (rng.next() % (i as u32 + 1)) as usize;
        mix_seq_cache.swap(i, j);
    }

    let mut ret = String::new();

    // Cache accesses + random math (inline, not in a function)
    let max_ops = params.cnt_cache.max(params.cnt_math);
    for i in 0..max_ops {
        if i < params.cnt_cache {
            let src = format!("mix[{}]", mix_seq_cache[mix_seq_cache_cnt % regs]);
            mix_seq_cache_cnt += 1;
            let dest = format!("mix[{}]", mix_seq_dst[mix_seq_dst_cnt % regs]);
            mix_seq_dst_cnt += 1;
            let r = rng.next();
            ret.push_str(&format!("// cache load {}\n", i));
            ret.push_str(&format!("offset = {} % PROGPOW_CACHE_WORDS;\n", src));
            ret.push_str("data = c_dag[offset];\n");
            ret.push_str(&merge_code(&dest, "data", r));
        }
        if i < params.cnt_math {
            let src_rnd = rng.next() % ((params.regs - 1) * params.regs);
            let src1 = src_rnd % params.regs;
            let mut src2 = src_rnd / params.regs;
            if src2 >= src1 {
                src2 += 1;
            }
            let src1_str = format!("mix[{}]", src1);
            let src2_str = format!("mix[{}]", src2);
            let r1 = rng.next();
            let dest = format!("mix[{}]", mix_seq_dst[mix_seq_dst_cnt % regs]);
            mix_seq_dst_cnt += 1;
            let r2 = rng.next();
            ret.push_str(&format!("// random math {}\n", i));
            ret.push_str(&math_code_fn("data", &src1_str, &src2_str, r1));
            ret.push_str(&merge_code(&dest, "data", r2));
        }
    }

    ret
}

/// Generate the random math + cache load code for EPIC ProgPow (inline).
/// Replaces PROGPOW_INCLUDE_RANDOM_MATH.
pub fn gen_epic_progpow_random_math(params: &ProgPowParams, block_height: u64) -> String {
    gen_progpow_random_math_impl(params, block_height, math_code)
}

/// Generate the random math + cache load code for ProgPoWZ / Zano (inline).
/// Replaces PROGPOW_INCLUDE_RANDOM_MATH.
pub fn gen_zano_progpow_random_math(params: &ProgPowParams, block_height: u64) -> String {
    gen_progpow_random_math_impl(params, block_height, math_code_zano)
}

/// Generate the data load (consume global load) code for EPIC ProgPow (inline).
/// Replaces PROGPOW_INCLUDE_DATA_LOADS.
pub fn gen_epic_progpow_data_loads(params: &ProgPowParams, block_height: u64) -> String {
    let prog_seed = block_height / params.period as u64;
    let seed0 = prog_seed as u32;
    let seed1 = (prog_seed >> 32) as u32;

    let mut fnv_hash = 0x811c9dc5u32;
    let mut rng = Kiss99::new(
        fnv1a(&mut fnv_hash, seed0),
        fnv1a(&mut fnv_hash, seed1),
        fnv1a(&mut fnv_hash, seed0),
        fnv1a(&mut fnv_hash, seed1),
    );

    let regs = params.regs as usize;
    let mut mix_seq_dst: Vec<u32> = (0..regs as u32).collect();
    let mut mix_seq_cache: Vec<u32> = (0..regs as u32).collect();
    let mut mix_seq_dst_cnt = 0usize;
    let mut mix_seq_cache_cnt = 0usize;

    for i in (1..regs).rev() {
        let j = (rng.next() % (i as u32 + 1)) as usize;
        mix_seq_dst.swap(i, j);
        let j = (rng.next() % (i as u32 + 1)) as usize;
        mix_seq_cache.swap(i, j);
    }

    // Advance the RNG past the random math section to maintain the same
    // sequence as the original gen_epic_progpow_loop.
    let max_ops = params.cnt_cache.max(params.cnt_math);
    for i in 0..max_ops {
        if i < params.cnt_cache {
            let _ = mix_seq_cache[mix_seq_cache_cnt % regs];
            mix_seq_cache_cnt += 1;
            let _ = mix_seq_dst[mix_seq_dst_cnt % regs];
            mix_seq_dst_cnt += 1;
            let _ = rng.next();
        }
        if i < params.cnt_math {
            let _ = rng.next();
            let _ = mix_seq_dst[mix_seq_dst_cnt % regs];
            mix_seq_dst_cnt += 1;
            let _ = rng.next();
            let _ = rng.next();
        }
    }

    // Consume global load data (inline)
    let mut ret = String::new();
    ret.push_str(&merge_code("mix[0]", "data_dag.s[0]", rng.next()));
    for i in 1..params.dag_loads {
        let dest = format!("mix[{}]", mix_seq_dst[mix_seq_dst_cnt % regs]);
        mix_seq_dst_cnt += 1;
        let r = rng.next();
        ret.push_str(&merge_code(&dest, &format!("data_dag.s[{}]", i), r));
    }

    ret
}

/// Generate the complete progPowLoop function for a ProgPow variant.
fn gen_progpow_loop_impl(
    params: &ProgPowParams,
    block_height: u64,
    math_code_fn: fn(&str, &str, &str, u32) -> String,
) -> String {
    let prog_seed = block_height / params.period as u64;
    let seed0 = prog_seed as u32;
    let seed1 = (prog_seed >> 32) as u32;

    let mut fnv_hash = 0x811c9dc5u32;
    let mut rng = Kiss99::new(
        fnv1a(&mut fnv_hash, seed0),
        fnv1a(&mut fnv_hash, seed1),
        fnv1a(&mut fnv_hash, seed0),
        fnv1a(&mut fnv_hash, seed1),
    );

    let regs = params.regs as usize;
    let mut mix_seq_dst: Vec<u32> = (0..regs as u32).collect();
    let mut mix_seq_cache: Vec<u32> = (0..regs as u32).collect();
    let mut mix_seq_dst_cnt = 0usize;
    let mut mix_seq_cache_cnt = 0usize;

    for i in (1..regs).rev() {
        let j = (rng.next() % (i as u32 + 1)) as usize;
        mix_seq_dst.swap(i, j);
        let j = (rng.next() % (i as u32 + 1)) as usize;
        mix_seq_cache.swap(i, j);
    }

    let mut ret = String::new();

    // Note: GROUP_SIZE, GROUP_SHARE, uint32_t, uint64_t, ROTL32, ROTR32,
    // dag_t, PROGPOW_* constants are already defined in the kernel header.
    // The progPowLoop function is injected after those definitions.

    // progPowLoop function
    ret.push_str(&format!(
        "// Inner loop for prog_seed {}\n",
        prog_seed
    ));
    ret.push_str("static inline __attribute__((always_inline))\n");
    ret.push_str("void progPowLoop(const uint32_t loop,\n");
    ret.push_str("        uint32_t mix[PROGPOW_REGS],\n");
    ret.push_str("        __global const dag_t *g_dag,\n");
    ret.push_str("        __local const uint32_t *c_dag,\n");
    ret.push_str("        __local uint64_t *share,\n");
    ret.push_str("        const bool hack_false)\n");
    ret.push_str("{\n");
    ret.push_str("dag_t data_dag;\n");
    ret.push_str("uint32_t offset, data;\n");
    ret.push_str("const uint32_t lane_id = get_local_id(0) & (PROGPOW_LANES-1);\n");
    ret.push_str("const uint32_t group_id = get_local_id(0) / PROGPOW_LANES;\n\n");

    ret.push_str("// global load\n");
    ret.push_str("#if defined(USE_AMD_BPERMUTE)\n");
    ret.push_str("offset = amd_wave_shuffle(mix[0], ((get_local_id(0) % WAVE_SIZE) & ~(uint32_t)(PROGPOW_LANES - 1)) + (loop % PROGPOW_LANES));\n");
    ret.push_str("#else\n");
    ret.push_str("if(lane_id == (loop % PROGPOW_LANES))\n");
    ret.push_str("    share[group_id] = mix[0];\n");
    ret.push_str("barrier(CLK_LOCAL_MEM_FENCE);\n");
    ret.push_str("offset = share[group_id];\n");
    ret.push_str("#endif\n");
    ret.push_str("offset %= PROGPOW_DAG_ELEMENTS;\n");
    ret.push_str("offset = offset * PROGPOW_LANES + (lane_id ^ loop) % PROGPOW_LANES;\n");
    ret.push_str("data_dag = g_dag[offset];\n");
    ret.push_str("// hack to prevent compiler from reordering LD and usage\n");
    ret.push_str("if (hack_false) barrier(CLK_LOCAL_MEM_FENCE);\n\n");

    let max_ops = params.cnt_cache.max(params.cnt_math);
    for i in 0..max_ops {
        if i < params.cnt_cache {
            let src = format!("mix[{}]", mix_seq_cache[mix_seq_cache_cnt % regs]);
            mix_seq_cache_cnt += 1;
            let dest = format!("mix[{}]", mix_seq_dst[mix_seq_dst_cnt % regs]);
            mix_seq_dst_cnt += 1;
            let r = rng.next();
            ret.push_str(&format!("// cache load {}\n", i));
            ret.push_str(&format!("offset = {} % PROGPOW_CACHE_WORDS;\n", src));
            ret.push_str("data = c_dag[offset];\n");
            ret.push_str(&merge_code(&dest, "data", r));
        }
        if i < params.cnt_math {
            let src_rnd = rng.next() % ((params.regs - 1) * params.regs);
            let src1 = src_rnd % params.regs;
            let mut src2 = src_rnd / params.regs;
            if src2 >= src1 {
                src2 += 1;
            }
            let src1_str = format!("mix[{}]", src1);
            let src2_str = format!("mix[{}]", src2);
            let r1 = rng.next();
            let dest = format!("mix[{}]", mix_seq_dst[mix_seq_dst_cnt % regs]);
            mix_seq_dst_cnt += 1;
            let r2 = rng.next();
            ret.push_str(&format!("// random math {}\n", i));
            ret.push_str(&math_code_fn("data", &src1_str, &src2_str, r1));
            ret.push_str(&merge_code(&dest, "data", r2));
        }
    }

    ret.push_str("// consume global load data\n");
    ret.push_str("// hack to prevent compiler from reordering LD and usage\n");
    ret.push_str("if (hack_false) barrier(CLK_LOCAL_MEM_FENCE);\n");
    ret.push_str(&merge_code("mix[0]", "data_dag.s[0]", rng.next()));
    for i in 1..params.dag_loads {
        let dest = format!("mix[{}]", mix_seq_dst[mix_seq_dst_cnt % regs]);
        mix_seq_dst_cnt += 1;
        let r = rng.next();
        ret.push_str(&merge_code(&dest, &format!("data_dag.s[{}]", i), r));
    }

    ret.push_str("}\n\n");

    ret
}

/// Generate the complete progPowLoop function for EPIC ProgPow.
/// Kept for backward compatibility / testing.
pub fn gen_epic_progpow_loop(params: &ProgPowParams, block_height: u64) -> String {
    gen_progpow_loop_impl(params, block_height, math_code)
}

/// Generate the complete progPowLoop function for ProgPoWZ / Zano.
pub fn gen_zano_progpow_loop(params: &ProgPowParams, block_height: u64) -> String {
    gen_progpow_loop_impl(params, block_height, math_code_zano)
}

// ── Kernel source preparation ───────────────────────────────────────

/// Prepare the KawPow kernel source by injecting random math code.
/// Replaces XMRIG_INCLUDE_PROGPOW_RANDOM_MATH and XMRIG_INCLUDE_PROGPOW_DATA_LOADS.
pub fn prepare_kawpow_kernel_source(
    base_source: &str,
    block_height: u64,
) -> String {
    let prog_seed = block_height / KAWPOW_PARAMS.period as u64;
    let random_math = gen_kawpow_random_math(&KAWPOW_PARAMS, prog_seed);
    let data_loads = gen_kawpow_data_loads(&KAWPOW_PARAMS, prog_seed);

    base_source
        .replace("XMRIG_INCLUDE_PROGPOW_RANDOM_MATH", &random_math)
        .replace("XMRIG_INCLUDE_PROGPOW_DATA_LOADS", &data_loads)
}

/// Prepare the EPIC ProgPow kernel source by injecting inline random math,
/// data load code, and the progPowLoop function. Replaces
/// PROGPOW_INCLUDE_PROGPOW_LOOP with the generated loop code,
/// PROGPOW_INCLUDE_RANDOM_MATH and PROGPOW_INCLUDE_DATA_LOADS.
pub fn prepare_epic_progpow_kernel_source(
    base_source: &str,
    block_height: u64,
) -> String {
    let random_math = gen_epic_progpow_random_math(&EPIC_PROGPOW_PARAMS, block_height);
    let data_loads = gen_epic_progpow_data_loads(&EPIC_PROGPOW_PARAMS, block_height);
    let progpow_loop = gen_epic_progpow_loop(&EPIC_PROGPOW_PARAMS, block_height);

    base_source
        .replace("PROGPOW_INCLUDE_PROGPOW_LOOP", &progpow_loop)
        .replace("PROGPOW_INCLUDE_RANDOM_MATH", &random_math)
        .replace("PROGPOW_INCLUDE_DATA_LOADS", &data_loads)
}

/// Prepare the ProgPoWZ (Zano) kernel source.
/// Same ProgPow 0.9.2 structure as EPIC, but uses the Zano math op permutation.
pub fn prepare_zano_progpow_kernel_source(
    base_source: &str,
    block_height: u64,
) -> String {
    let random_math = gen_zano_progpow_random_math(&PROGPOWZ_PARAMS, block_height);
    let data_loads = gen_epic_progpow_data_loads(&PROGPOWZ_PARAMS, block_height);
    let progpow_loop = gen_zano_progpow_loop(&PROGPOWZ_PARAMS, block_height);

    base_source
        .replace("PROGPOW_INCLUDE_PROGPOW_LOOP", &progpow_loop)
        .replace("PROGPOW_INCLUDE_RANDOM_MATH", &random_math)
        .replace("PROGPOW_INCLUDE_DATA_LOADS", &data_loads)
}

/// Prepare the ProgPow kernel source for a specific ProgPow variant.
/// Used for `progpow_kernel.cl` (EPIC and Zano).
pub fn prepare_progpow_kernel_source_for_algo(
    base_source: &str,
    algorithm: &str,
    block_height: u64,
) -> String {
    match algorithm {
        "progpow" | "progpow_epic" => prepare_epic_progpow_kernel_source(base_source, block_height),
        "progpowz" | "progpow_zano" => prepare_zano_progpow_kernel_source(base_source, block_height),
        _ => prepare_epic_progpow_kernel_source(base_source, block_height),
    }
}

/// Metal template for ProgPow / ProgPoWZ kernels.
/// Includes placeholders for the inline random math and data loads.
static PROGPOW_METAL_TEMPLATE: &str = include_str!("../csrc/metal/progpow_zano_kernel_template.metal");

/// Prepare a Metal ProgPow kernel source for a specific algorithm and block height.
/// The returned source can be passed directly to `MTLDevice::new_library_with_source`.
pub fn prepare_progpow_metal_kernel_source_for_algo(
    algorithm: &str,
    block_height: u64,
) -> String {
    prepare_progpow_kernel_source_for_algo(PROGPOW_METAL_TEMPLATE, algorithm, block_height)
}

/// Prepare the KawPow kernel source for a specific ProgPow variant.
/// Uses the xmrig kawpow_kernel.cl with XMRIG_INCLUDE_PROGPOW_RANDOM_MATH
/// and XMRIG_INCLUDE_PROGPOW_DATA_LOADS placeholders.
/// Selects the correct params based on the algorithm name.
pub fn prepare_kawpow_kernel_source_for_algo(
    base_source: &str,
    algorithm: &str,
    block_height: u64,
) -> String {
    let params = select_progpow_params(algorithm);
    let prog_seed = block_height / params.period as u64;
    let random_math = gen_kawpow_random_math(params, prog_seed);
    let data_loads = gen_kawpow_data_loads(params, prog_seed);

    base_source
        .replace("XMRIG_INCLUDE_PROGPOW_RANDOM_MATH", &random_math)
        .replace("XMRIG_INCLUDE_PROGPOW_DATA_LOADS", &data_loads)
}

/// Select the correct ProgPow parameters for the given algorithm name.
pub fn select_progpow_params(algorithm: &str) -> &'static ProgPowParams {
    match algorithm {
        "evrprogpow" | "evrprogpow_evr" => &EVR_PROGPOW_PARAMS,
        "meowpow" | "meowpow_mewc" => &MEOWPOW_PARAMS,
        "progpow" | "progpow_epic" => &EPIC_PROGPOW_PARAMS,
        "progpowz" | "progpow_zano" => &PROGPOWZ_PARAMS,
        // All KawPow variants (kawpow, kawpow_rvn, kawpow_clore, kawpow_evr, kawpow_mewc)
        // and fallback use standard KawPow params.
        _ => &KAWPOW_PARAMS,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_kiss99() {
        let mut rng = Kiss99::new(362436069, 521288629, 0, 380116160);
        let v1 = rng.next();
        let v2 = rng.next();
        assert_ne!(v1, v2, "KISS99 should produce different values");
    }

    #[test]
    fn test_fnv1a() {
        let mut h = 0x811c9dc5u32;
        let result = fnv1a(&mut h, 42);
        assert_ne!(result, 0x811c9dc5, "FNV1a should change the hash");
    }

    #[test]
    fn test_gen_kawpow_random_math() {
        let code = gen_kawpow_random_math(&KAWPOW_PARAMS, 0);
        assert!(code.contains("c_dag[offset]"), "Should have cache access");
        assert!(code.contains("mix["), "Should reference mix registers");
    }

    #[test]
    fn test_gen_epic_progpow_loop() {
        let code = gen_epic_progpow_loop(&EPIC_PROGPOW_PARAMS, 0);
        assert!(code.contains("void progPowLoop"), "Should define progPowLoop");
        assert!(code.contains("g_dag[offset]"), "Should have DAG access");
        assert!(code.contains("c_dag[offset]"), "Should have cache access");
    }

    #[test]
    fn test_prepare_kawpow_kernel() {
        let base = "XMRIG_INCLUDE_PROGPOW_RANDOM_MATH\nXMRIG_INCLUDE_PROGPOW_DATA_LOADS";
        let result = prepare_kawpow_kernel_source(base, 100);
        assert!(!result.contains("XMRIG_INCLUDE"), "Placeholders should be replaced");
    }

    #[test]
    fn test_prepare_epic_kernel() {
        let base = "PROGPOW_INCLUDE_PROGPOW_LOOP\n// rest of kernel";
        let result = prepare_epic_progpow_kernel_source(base, 100);
        assert!(!result.contains("PROGPOW_INCLUDE"), "Placeholder should be replaced");
        assert!(result.contains("progPowLoop"), "Should have progPowLoop function");
    }

    #[test]
    fn test_epic_kernel_full_source_lines() {
        let base = include_str!("../csrc/opencl/progpow_kernel.cl");
        let result = prepare_epic_progpow_kernel_source(base, 3621120);
        // Print first 20 lines for debugging
        for (i, line) in result.lines().take(20).enumerate() {
            println!("EPIC_SRC {:3}: {}", i + 1, line);
        }
        // Verify definitions appear before progPowLoop
        let def_line = result.lines().position(|l| l.contains("typedef unsigned int       uint32_t;"));
        let loop_line = result.lines().position(|l| l.contains("void progPowLoop"));
        println!("uint32_t typedef at line: {:?}", def_line);
        println!("progPowLoop at line: {:?}", loop_line);
        assert!(def_line.is_some(), "uint32_t typedef must be present");
        assert!(loop_line.is_some(), "progPowLoop must be present");
        assert!(def_line.unwrap() < loop_line.unwrap(), "typedef must come before progPowLoop");
    }

    #[test]
    fn test_kawpow_kernel_full_source_lines() {
        let base = include_str!("../csrc/opencl/kawpow_kernel.cl");
        let result = prepare_kawpow_kernel_source(base, 3621120);
        // Verify definitions appear before progPowSearch
        let def_line = result.lines().position(|l| l.contains("#define PROGPOW_LANES"));
        let search_line = result.lines().position(|l| l.contains("progpow_search"));
        println!("PROGPOW_LANES define at line: {:?}", def_line);
        println!("progpow_search at line: {:?}", search_line);
        assert!(def_line.is_some(), "PROGPOW_LANES define must be present");
        assert!(search_line.is_some(), "progpow_search must be present");
        assert!(def_line.unwrap() < search_line.unwrap(), "defines must come before kernel");
        // Verify no placeholder leakage in comments
        let placeholder_count = result.matches("XMRIG_INCLUDE_PROGPOW_RANDOM_MATH").count()
            + result.matches("XMRIG_INCLUDE_PROGPOW_DATA_LOADS").count();
        assert_eq!(placeholder_count, 0, "All placeholders should be replaced");
    }

    #[test]
    fn test_epic_kernel_no_duplicate_defs() {
        // The generated progPowLoop code should NOT include typedef/define
        // for uint32_t, uint64_t, ROTL32, ROTR32, GROUP_SIZE — those are
        // already in the kernel header. Duplicates would cause compile errors.
        let code = gen_epic_progpow_loop(&EPIC_PROGPOW_PARAMS, 0);
        let uint32_count = code.matches("typedef unsigned int").count();
        let rotl_count = code.matches("#define ROTL32").count();
        let group_size_count = code.matches("#define GROUP_SIZE").count();
        assert_eq!(uint32_count, 0, "Generated code should NOT redefine uint32_t");
        assert_eq!(rotl_count, 0, "Generated code should NOT redefine ROTL32");
        assert_eq!(group_size_count, 0, "Generated code should NOT redefine GROUP_SIZE");
    }

    #[test]
    fn test_kawpow_random_math_has_cache_and_math() {
        // KawPow: cnt_cache=11, cnt_math=18, so max_ops=18
        // Should have 11 cache loads and 18 math operations
        let code = gen_kawpow_random_math(&KAWPOW_PARAMS, 0);
        let cache_loads = code.matches("c_dag[offset]").count();
        assert_eq!(cache_loads, 11, "Should have exactly 11 cache loads (CNT_CACHE=11)");
    }

    #[test]
    fn test_epic_progpow_loop_has_cache_and_math() {
        // EPIC: cnt_cache=12, cnt_math=20, so max_ops=20
        let code = gen_epic_progpow_loop(&EPIC_PROGPOW_PARAMS, 0);
        let cache_loads = code.matches("c_dag[offset]").count();
        assert_eq!(cache_loads, 12, "Should have exactly 12 cache loads (CNT_CACHE=12)");
    }

    #[test]
    fn test_evr_progpow_params() {
        // EvrProgPow: PERIOD=3, REGS=32, CNT_CACHE=11, CNT_MATH=18
        assert_eq!(EVR_PROGPOW_PARAMS.period, 3, "EvrProgPow period should be 3");
        assert_eq!(EVR_PROGPOW_PARAMS.regs, 32, "EvrProgPow regs should be 32");
        assert_eq!(EVR_PROGPOW_PARAMS.cnt_cache, 11, "EvrProgPow cnt_cache should be 11");
        assert_eq!(EVR_PROGPOW_PARAMS.cnt_math, 18, "EvrProgPow cnt_math should be 18");
    }

    #[test]
    fn test_meowpow_params() {
        // MeowPow: PERIOD=6, REGS=16, CNT_CACHE=6, CNT_MATH=9
        assert_eq!(MEOWPOW_PARAMS.period, 6, "MeowPow period should be 6");
        assert_eq!(MEOWPOW_PARAMS.regs, 16, "MeowPow regs should be 16");
        assert_eq!(MEOWPOW_PARAMS.cnt_cache, 6, "MeowPow cnt_cache should be 6");
        assert_eq!(MEOWPOW_PARAMS.cnt_math, 9, "MeowPow cnt_math should be 9");
    }

    #[test]
    fn test_select_progpow_params() {
        let evr = select_progpow_params("evrprogpow");
        assert_eq!(evr.period, EVR_PROGPOW_PARAMS.period);
        assert_eq!(evr.regs, EVR_PROGPOW_PARAMS.regs);
        assert_eq!(evr.cnt_cache, EVR_PROGPOW_PARAMS.cnt_cache);
        assert_eq!(evr.cnt_math, EVR_PROGPOW_PARAMS.cnt_math);

        let evr2 = select_progpow_params("evrprogpow_evr");
        assert_eq!(evr2.period, EVR_PROGPOW_PARAMS.period);

        let mewc = select_progpow_params("meowpow");
        assert_eq!(mewc.period, MEOWPOW_PARAMS.period);
        assert_eq!(mewc.regs, MEOWPOW_PARAMS.regs);
        assert_eq!(mewc.cnt_cache, MEOWPOW_PARAMS.cnt_cache);
        assert_eq!(mewc.cnt_math, MEOWPOW_PARAMS.cnt_math);

        let mewc2 = select_progpow_params("meowpow_mewc");
        assert_eq!(mewc2.period, MEOWPOW_PARAMS.period);

        let epic = select_progpow_params("progpow");
        assert_eq!(epic.period, EPIC_PROGPOW_PARAMS.period);

        let epic2 = select_progpow_params("progpow_epic");
        assert_eq!(epic2.period, EPIC_PROGPOW_PARAMS.period);

        let kawpow = select_progpow_params("kawpow");
        assert_eq!(kawpow.period, KAWPOW_PARAMS.period);

        let kawpow2 = select_progpow_params("kawpow_rvn");
        assert_eq!(kawpow2.period, KAWPOW_PARAMS.period);

        let unknown = select_progpow_params("unknown");
        assert_eq!(unknown.period, KAWPOW_PARAMS.period);
    }

    #[test]
    fn test_prepare_kawpow_for_evrprogpow() {
        let base = "XMRIG_INCLUDE_PROGPOW_RANDOM_MATH\nXMRIG_INCLUDE_PROGPOW_DATA_LOADS";
        let result = prepare_kawpow_kernel_source_for_algo(base, "evrprogpow", 100);
        assert!(!result.contains("XMRIG_INCLUDE"), "Placeholders should be replaced");
        // EvrProgPow: period=3, so prog_seed = 100/3 = 33
        // Should have 11 cache loads (same as KawPow)
        let cache_loads = result.matches("c_dag[offset]").count();
        assert_eq!(cache_loads, 11, "EvrProgPow should have 11 cache loads");
    }

    #[test]
    fn test_prepare_kawpow_for_meowpow() {
        let base = "XMRIG_INCLUDE_PROGPOW_RANDOM_MATH\nXMRIG_INCLUDE_PROGPOW_DATA_LOADS";
        let result = prepare_kawpow_kernel_source_for_algo(base, "meowpow", 100);
        assert!(!result.contains("XMRIG_INCLUDE"), "Placeholders should be replaced");
        // MeowPow: period=6, so prog_seed = 100/6 = 16
        // Should have 6 cache loads (CNT_CACHE=6)
        let cache_loads = result.matches("c_dag[offset]").count();
        assert_eq!(cache_loads, 6, "MeowPow should have 6 cache loads");
    }
}
