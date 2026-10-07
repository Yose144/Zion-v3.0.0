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

    #[allow(clippy::should_implement_trait)]
    pub fn next(&mut self) -> u32 {
        self.z = 36969u32
            .wrapping_mul(self.z & 0xFFFF)
            .wrapping_add(self.z >> 16);
        self.w = 18000u32
            .wrapping_mul(self.w & 0xFFFF)
            .wrapping_add(self.w >> 16);
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

// ── Shared op sequence ──────────────────────────────────────────────
// Single source of truth: the random math/cache/dag-load sequence is
// generated ONCE as structured ops and then either rendered to OpenCL
// source (for the GPU kernels) or interpreted directly on the CPU (for
// the KAT reference). This guarantees the CPU ref can never drift from
// the generated kernel code.

/// One step of the generated progPow loop body.
#[derive(Clone, Copy, Debug)]
pub enum ProgOp {
    /// offset = mix[src] % PROGPOW_CACHE_WORDS; data = c_dag[offset];
    /// mix[dst] = merge(mix[dst], data, r)
    Cache { src: u32, dst: u32, r: u32 },
    /// data = math(mix[src1], mix[src2], r1); mix[dst] = merge(mix[dst], data, r2)
    Math {
        src1: u32,
        src2: u32,
        dst: u32,
        r1: u32,
        r2: u32,
    },
    /// mix[dst] = merge(mix[dst], data_dag.s[word], r)
    Dag { dst: u32, word: u32, r: u32 },
}

/// Generate the op sequence for one progPowLoop iteration.
///
/// Returns `(loop_ops, dag_load_ops)`. Consumes the KISS99 stream in
/// exactly the same order as the original inline generators.
pub fn progpow_ops(params: &ProgPowParams, prog_seed: u64) -> (Vec<ProgOp>, Vec<ProgOp>) {
    let seed0 = prog_seed as u32;
    let seed1 = (prog_seed >> 32) as u32;

    let mut fnv_hash = 0x811c9dc5u32;
    let mut rng = Kiss99::new(
        fnv1a(&mut fnv_hash, seed0),
        fnv1a(&mut fnv_hash, seed1),
        fnv1a(&mut fnv_hash, seed0),
        fnv1a(&mut fnv_hash, seed1),
    );

    let regs = params.regs;
    let mut mix_seq_dst: Vec<u32> = (0..regs).collect();
    let mut mix_seq_cache: Vec<u32> = (0..regs).collect();
    let mut dst_cnt = 0usize;
    let mut cache_cnt = 0usize;

    for i in (1..regs as usize).rev() {
        let j = (rng.next() % (i as u32 + 1)) as usize;
        mix_seq_dst.swap(i, j);
        let j = (rng.next() % (i as u32 + 1)) as usize;
        mix_seq_cache.swap(i, j);
    }

    let mut loop_ops = Vec::new();
    let max_ops = params.cnt_cache.max(params.cnt_math);
    for i in 0..max_ops {
        if i < params.cnt_cache {
            let src = mix_seq_cache[cache_cnt % regs as usize];
            cache_cnt += 1;
            let dst = mix_seq_dst[dst_cnt % regs as usize];
            dst_cnt += 1;
            let r = rng.next();
            loop_ops.push(ProgOp::Cache { src, dst, r });
        }
        if i < params.cnt_math {
            let src_rnd = rng.next() % ((params.regs - 1) * params.regs);
            let src1 = src_rnd % params.regs;
            let mut src2 = src_rnd / params.regs;
            if src2 >= src1 {
                src2 += 1;
            }
            let r1 = rng.next();
            let dst = mix_seq_dst[dst_cnt % regs as usize];
            dst_cnt += 1;
            let r2 = rng.next();
            loop_ops.push(ProgOp::Math {
                src1,
                src2,
                dst,
                r1,
                r2,
            });
        }
    }

    let mut dag_ops = Vec::new();
    dag_ops.push(ProgOp::Dag {
        dst: 0,
        word: 0,
        r: rng.next(),
    });
    for i in 1..params.dag_loads {
        let dst = mix_seq_dst[dst_cnt % regs as usize];
        dst_cnt += 1;
        dag_ops.push(ProgOp::Dag {
            dst,
            word: i,
            r: rng.next(),
        });
    }

    (loop_ops, dag_ops)
}

// ── Code generation helpers ─────────────────────────────────────────

fn merge_code(a: &str, b: &str, r: u32) -> String {
    match r % 4 {
        0 => format!("{} = ({} * 33) + {};\n", a, a, b),
        1 => format!("{} = ({} ^ {}) * 33;\n", a, a, b),
        2 => format!("{} = ROTL32({}, {}) ^ {};\n", a, a, (r >> 16) % 31 + 1, b),
        3 => format!("{} = ROTR32({}, {}) ^ {};\n", a, a, (r >> 16) % 31 + 1, b),
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

/// Render the loop ops (cache loads + random math) to OpenCL source.
fn render_loop_ops(ops: &[ProgOp], math_code_fn: fn(&str, &str, &str, u32) -> String, comments: bool) -> String {
    let mut ret = String::new();
    let mut cache_i = 0u32;
    let mut math_i = 0u32;
    for op in ops {
        match *op {
            ProgOp::Cache { src, dst, r } => {
                if comments {
                    ret.push_str(&format!("// cache load {cache_i}\n"));
                }
                cache_i += 1;
                ret.push_str(&format!("offset = mix[{src}] % PROGPOW_CACHE_WORDS;\n"));
                ret.push_str("data = c_dag[offset];\n");
                ret.push_str(&merge_code(&format!("mix[{dst}]"), "data", r));
            }
            ProgOp::Math {
                src1,
                src2,
                dst,
                r1,
                r2,
            } => {
                if comments {
                    ret.push_str(&format!("// random math {math_i}\n"));
                }
                math_i += 1;
                ret.push_str(&math_code_fn(
                    "data",
                    &format!("mix[{src1}]"),
                    &format!("mix[{src2}]"),
                    r1,
                ));
                ret.push_str(&merge_code(&format!("mix[{dst}]"), "data", r2));
            }
            ProgOp::Dag { .. } => unreachable!("dag ops are rendered separately"),
        }
    }
    ret
}

/// Render the DAG-load merge ops to OpenCL source.
fn render_dag_ops(ops: &[ProgOp]) -> String {
    let mut ret = String::new();
    for op in ops {
        if let ProgOp::Dag { dst, word, r } = *op {
            ret.push_str(&merge_code(
                &format!("mix[{dst}]"),
                &format!("data_dag.s[{word}]"),
                r,
            ));
        }
    }
    ret
}

/// Generate the random math + cache access code for KawPow (xmrig kernel).
/// Replaces XMRIG_INCLUDE_PROGPOW_RANDOM_MATH.
pub fn gen_kawpow_random_math(params: &ProgPowParams, prog_seed: u64) -> String {
    let (loop_ops, _) = progpow_ops(params, prog_seed);
    render_loop_ops(&loop_ops, math_code, false)
}

/// Generate the DAG data load code for KawPow (xmrig kernel).
/// Replaces XMRIG_INCLUDE_PROGPOW_DATA_LOADS.
pub fn gen_kawpow_data_loads(params: &ProgPowParams, prog_seed: u64) -> String {
    let (_, dag_ops) = progpow_ops(params, prog_seed);
    render_dag_ops(&dag_ops)
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
    let (loop_ops, _) = progpow_ops(params, prog_seed);
    render_loop_ops(&loop_ops, math_code_fn, true)
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
    let (_, dag_ops) = progpow_ops(params, prog_seed);
    render_dag_ops(&dag_ops)
}

/// Generate the complete progPowLoop function for a ProgPow variant.
fn gen_progpow_loop_impl(
    params: &ProgPowParams,
    block_height: u64,
    math_code_fn: fn(&str, &str, &str, u32) -> String,
) -> String {
    let prog_seed = block_height / params.period as u64;
    let (loop_ops, dag_ops) = progpow_ops(params, prog_seed);

    let mut ret = String::new();

    // Note: GROUP_SIZE, GROUP_SHARE, uint32_t, uint64_t, ROTL32, ROTR32,
    // dag_t, PROGPOW_* constants are already defined in the kernel header.
    // The progPowLoop function is injected after those definitions.

    // progPowLoop function
    ret.push_str(&format!("// Inner loop for prog_seed {}\n", prog_seed));
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

    ret.push_str(&render_loop_ops(&loop_ops, math_code_fn, true));

    ret.push_str("// consume global load data\n");
    ret.push_str("// hack to prevent compiler from reordering LD and usage\n");
    ret.push_str("if (hack_false) barrier(CLK_LOCAL_MEM_FENCE);\n");
    ret.push_str(&render_dag_ops(&dag_ops));

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
pub fn prepare_kawpow_kernel_source(base_source: &str, block_height: u64) -> String {
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
pub fn prepare_epic_progpow_kernel_source(base_source: &str, block_height: u64) -> String {
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
pub fn prepare_zano_progpow_kernel_source(base_source: &str, block_height: u64) -> String {
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
        "progpowz" | "progpow_zano" => {
            prepare_zano_progpow_kernel_source(base_source, block_height)
        }
        _ => prepare_epic_progpow_kernel_source(base_source, block_height),
    }
}

/// Metal template for ProgPow / ProgPoWZ kernels.
/// Includes placeholders for the inline random math and data loads.
static PROGPOW_METAL_TEMPLATE: &str =
    include_str!("../../csrc/metal/progpow_zano_kernel_template.metal");

/// Prepare a Metal ProgPow kernel source for a specific algorithm and block height.
/// The returned source can be passed directly to `MTLDevice::new_library_with_source`.
pub fn prepare_progpow_metal_kernel_source_for_algo(algorithm: &str, block_height: u64) -> String {
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
        .replace(
            "XMRIG_INCLUDE_OFFSET_MOD_DAG_ELEMENTS",
            "offset %= PROGPOW_DAG_ELEMENTS;",
        )
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

// ── CPU reference implementation (KAT) ──────────────────────────────
//
// Bit-exact interpreter of the generated OpenCL: the GPU kernel and this
// reference consume the SAME ProgOp sequence (progpow_ops), so a KAT
// match proves the kernel performs the intended ProgPow-family math.

const FNV_OFFSET: u32 = 0x811c9dc5;
const FNV_PRIME: u32 = 0x01000193;
const PROGPOW_LANES: u32 = 16;
const PROGPOW_CNT_DAG: u32 = 64;
/// Both kernels define PROGPOW_CACHE_WORDS = 4096 (16 KB of the DAG head).
const PROGPOW_CACHE_WORDS: usize = 4096;

/// Ravencoin keccak padding ("RAVENCOINKAWPOW" + 0).
const RAVENCOIN_RNDC: [u32; 15] = [
    0x00000072, 0x00000041, 0x00000056, 0x00000045, 0x0000004e, 0x00000043, 0x0000004f, 0x00000049,
    0x0000004e, 0x0000004b, 0x00000041, 0x00000057, 0x00000050, 0x0000004f, 0x00000057,
];

// keccak-f800 round constants (low 32 bits of keccak-f1600 RCs), rot/piln
// tables from the OpenCL kernels.
const KECCAKF800_RNDC: [u32; 22] = [
    0x00000001, 0x00008082, 0x0000808a, 0x80008000, 0x0000808b, 0x80000001, 0x80008081, 0x00008009,
    0x0000008a, 0x00000088, 0x80008009, 0x8000000a, 0x8000808b, 0x0000008b, 0x00008089, 0x00008003,
    0x00008002, 0x00000080, 0x0000800a, 0x8000000a, 0x80008081, 0x00008080,
];
const KECCAKF_ROTC: [u32; 24] = [
    1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 2, 14, 27, 41, 56, 8, 25, 43, 62, 18, 39, 61, 20, 44,
];
const KECCAKF_PILN: [usize; 24] = [
    10, 7, 11, 17, 18, 3, 5, 16, 8, 21, 24, 4, 15, 23, 19, 13, 12, 2, 20, 14, 22, 9, 6, 1,
];

fn keccak_f800_round(st: &mut [u32; 25], r: usize) {
    // Theta
    let mut bc = [0u32; 5];
    for i in 0..5 {
        bc[i] = st[i] ^ st[i + 5] ^ st[i + 10] ^ st[i + 15] ^ st[i + 20];
    }
    for i in 0..5 {
        let t = bc[(i + 4) % 5] ^ bc[(i + 1) % 5].rotate_left(1);
        for j in (0..25).step_by(5) {
            st[j + i] ^= t;
        }
    }
    // Rho Pi
    let mut t = st[1];
    for i in 0..24 {
        let j = KECCAKF_PILN[i];
        bc[0] = st[j];
        st[j] = t.rotate_left(KECCAKF_ROTC[i]);
        t = bc[0];
    }
    // Chi
    for j in (0..25).step_by(5) {
        for i in 0..5 {
            bc[i] = st[j + i];
        }
        for i in 0..5 {
            st[j + i] ^= !bc[(i + 1) % 5] & bc[(i + 2) % 5];
        }
    }
    // Iota
    st[0] ^= KECCAKF800_RNDC[r];
}

fn keccak_f800(st: &mut [u32; 25]) {
    for r in 0..22 {
        keccak_f800_round(st, r);
    }
}

#[inline]
fn fnv1a_val(h: u32, d: u32) -> u32 {
    (h ^ d).wrapping_mul(FNV_PRIME)
}

#[inline]
fn merge_val(a: u32, b: u32, r: u32) -> u32 {
    match r % 4 {
        0 => a.wrapping_mul(33).wrapping_add(b),
        1 => (a ^ b).wrapping_mul(33),
        2 => a.rotate_left((r >> 16) % 31 + 1) ^ b,
        _ => a.rotate_right((r >> 16) % 31 + 1) ^ b,
    }
}

#[inline]
fn math_val(sel: u32, a: u32, b: u32, zano: bool) -> u32 {
    if zano {
        match sel % 11 {
            0 => a.leading_zeros() + b.leading_zeros(),
            1 => a.count_ones() + b.count_ones(),
            2 => a.wrapping_add(b),
            3 => a.wrapping_mul(b),
            4 => ((a as u64 * b as u64) >> 32) as u32,
            5 => a.min(b),
            6 => a.rotate_left(b % 32),
            7 => a.rotate_right(b % 32),
            8 => a & b,
            9 => a | b,
            _ => a ^ b,
        }
    } else {
        match sel % 11 {
            0 => a.wrapping_add(b),
            1 => a.wrapping_mul(b),
            2 => ((a as u64 * b as u64) >> 32) as u32,
            3 => a.min(b),
            4 => a.rotate_left(b & 31),
            5 => a.rotate_right(b & 31),
            6 => a & b,
            7 => a | b,
            8 => a ^ b,
            9 => a.leading_zeros() + b.leading_zeros(),
            _ => a.count_ones() + b.count_ones(),
        }
    }
}

fn fill_mix_ref(seed_lo: u32, seed_hi: u32, lane_id: u32, mix: &mut [u32]) {
    let mut fnv = FNV_OFFSET;
    let z = fnv1a_val_fnv(&mut fnv, seed_lo);
    let w = fnv1a_val_fnv(&mut fnv, seed_hi);
    let jsr = fnv1a_val_fnv(&mut fnv, lane_id);
    let jcong = fnv1a_val_fnv(&mut fnv, lane_id);
    let mut st = Kiss99::new(z, w, jsr, jcong);
    for m in mix.iter_mut() {
        *m = st.next();
    }
}

#[inline]
fn fnv1a_val_fnv(h: &mut u32, d: u32) -> u32 {
    *h = (*h ^ d).wrapping_mul(FNV_PRIME);
    *h
}

/// Core ProgPow mix: simulates all 16 lanes of one hash on the CPU.
///
/// `dag_word(w)` returns the DAG u32 word at index `w` (dag_t = 4 words,
/// c_dag is just words 0..PROGPOW_CACHE_WORDS). Lazy closure form so the
/// caller can compute ethash dataset items on demand.
/// `dag_elements` — the PROGPOW_DAG_ELEMENTS build define (dag_t_count/16).
/// Returns the per-hash 8-word digest (the kernel's `output_mix`).
fn progpow_mix_ref(
    params: &ProgPowParams,
    prog_seed: u64,
    hash_seed: u64,
    dag_elements: u32,
    dag_word: &mut dyn FnMut(usize) -> u32,
    zano: bool,
) -> [u32; 8] {
    let (loop_ops, dag_ops) = progpow_ops(params, prog_seed);
    let lanes = PROGPOW_LANES as usize;
    let regs = params.regs as usize;

    // One 16-lane mix set for this hash.
    let mut mixes = vec![vec![0u32; regs]; lanes];
    for lane in 0..lanes {
        fill_mix_ref(
            hash_seed as u32,
            (hash_seed >> 32) as u32,
            lane as u32,
            &mut mixes[lane],
        );
    }

    for l in 0..PROGPOW_CNT_DAG {
        // Broadcast mix[0] of lane (l % LANES) to all lanes.
        let src0 = mixes[(l % PROGPOW_LANES) as usize][0];
        let base = src0 % dag_elements;
        for (lane, mix) in mixes.iter_mut().enumerate() {
            let off = (base as usize) * lanes + ((lane as u32 ^ l) % PROGPOW_LANES) as usize;
            let data_dag: Vec<u32> =
                (0..params.dag_loads as usize).map(|i| dag_word(off * 4 + i)).collect();
            for op in &loop_ops {
                match *op {
                    ProgOp::Cache { src, dst, r } => {
                        let offset = (mix[src as usize] as usize) % PROGPOW_CACHE_WORDS;
                        let data = dag_word(offset);
                        let d = merge_val(mix[dst as usize], data, r);
                        mix[dst as usize] = d;
                    }
                    ProgOp::Math {
                        src1,
                        src2,
                        dst,
                        r1,
                        r2,
                    } => {
                        let data = math_val(r1, mix[src1 as usize], mix[src2 as usize], zano);
                        let d = merge_val(mix[dst as usize], data, r2);
                        mix[dst as usize] = d;
                    }
                    ProgOp::Dag { .. } => unreachable!(),
                }
            }
            for op in &dag_ops {
                if let ProgOp::Dag { dst, word, r } = *op {
                    let d = merge_val(mix[dst as usize], data_dag[word as usize], r);
                    mix[dst as usize] = d;
                }
            }
        }
    }

    // Reduce each lane to a 32-bit mix_hash, then fold lanes into digest.
    let mut digest = [FNV_OFFSET; 8];
    for lane in 0..lanes {
        let mut mix_hash = FNV_OFFSET;
        for &v in &mixes[lane] {
            mix_hash = fnv1a_val(mix_hash, v);
        }
        digest[lane % 8] = fnv1a_val(digest[lane % 8], mix_hash);
    }
    digest
}

/// KawPow reference digest + final compare value for one gid.
///
/// `job_blob` — 10 LE u32 words (header ≤ 40 B, packed like the host does).
/// The kernel overwrites word 8 with `gid` and appends RAVENCOIN_RNDC.
/// Returns (digest[8], result_u64) — result compares `<= target` (bswap64).
pub fn kawpow_digest_ref(
    params: &ProgPowParams,
    prog_seed: u64,
    job_blob: &[u32; 10],
    gid: u32,
    dag_elements: u32,
    dag_word: &mut dyn FnMut(usize) -> u32,
) -> ([u32; 8], u64) {
    let mut st = [0u32; 25];
    st[..10].copy_from_slice(job_blob);
    st[8] = gid;
    st[10..25].copy_from_slice(&RAVENCOIN_RNDC);
    keccak_f800(&mut st);
    let state2: [u32; 8] = st[..8].try_into().unwrap();
    let seed = (state2[1] as u64) << 32 | state2[0] as u64;

    let digest = progpow_mix_ref(params, prog_seed, seed, dag_elements, dag_word, false);

    let mut st = [0u32; 25];
    st[..8].copy_from_slice(&state2);
    st[8..16].copy_from_slice(&digest);
    st[16..25].copy_from_slice(&RAVENCOIN_RNDC[..9]);
    keccak_f800(&mut st);
    let res = ((st[1] as u64) << 32 | st[0] as u64).swap_bytes();
    (digest, res)
}

/// EPIC/Zano ProgPow reference digest + final compare value.
///
/// `header` — 32-byte pre-hashed header (the kernel hashes it with
/// keccak_f800(header ‖ nonce ‖ digest=0)). Returns (digest, result_u64).
pub fn progpow_digest_ref(
    params: &ProgPowParams,
    prog_seed: u64,
    header: &[u8; 32],
    nonce: u64,
    dag_elements: u32,
    dag_word: &mut dyn FnMut(usize) -> u32,
    zano: bool,
) -> ([u32; 8], u64) {
    let mut st = [0u32; 25];
    for i in 0..8 {
        st[i] = u32::from_le_bytes(header[i * 4..i * 4 + 4].try_into().unwrap());
    }
    st[8] = nonce as u32;
    st[9] = (nonce >> 32) as u32;
    keccak_f800(&mut st);
    let seed = ((st[1] as u64) << 32 | st[0] as u64).swap_bytes();

    let digest = progpow_mix_ref(params, prog_seed, seed, dag_elements, dag_word, zano);

    let mut st = [0u32; 25];
    for i in 0..8 {
        st[i] = u32::from_le_bytes(header[i * 4..i * 4 + 4].try_into().unwrap());
    }
    st[8] = seed as u32;
    st[9] = (seed >> 32) as u32;
    st[10..18].copy_from_slice(&digest);
    keccak_f800(&mut st);
    let res = ((st[1] as u64) << 32 | st[0] as u64).swap_bytes();
    (digest, res)
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
        assert!(
            code.contains("void progPowLoop"),
            "Should define progPowLoop"
        );
        assert!(code.contains("g_dag[offset]"), "Should have DAG access");
        assert!(code.contains("c_dag[offset]"), "Should have cache access");
    }

    #[test]
    fn test_prepare_kawpow_kernel() {
        let base = "XMRIG_INCLUDE_PROGPOW_RANDOM_MATH\nXMRIG_INCLUDE_PROGPOW_DATA_LOADS";
        let result = prepare_kawpow_kernel_source(base, 100);
        assert!(
            !result.contains("XMRIG_INCLUDE"),
            "Placeholders should be replaced"
        );
    }

    #[test]
    fn test_prepare_epic_kernel() {
        let base = "PROGPOW_INCLUDE_PROGPOW_LOOP\n// rest of kernel";
        let result = prepare_epic_progpow_kernel_source(base, 100);
        assert!(
            !result.contains("PROGPOW_INCLUDE"),
            "Placeholder should be replaced"
        );
        assert!(
            result.contains("progPowLoop"),
            "Should have progPowLoop function"
        );
    }

    #[test]
    fn test_epic_kernel_full_source_lines() {
        let base = include_str!("../../csrc/opencl/progpow_kernel.cl");
        let result = prepare_epic_progpow_kernel_source(base, 3621120);
        // Print first 20 lines for debugging
        for (i, line) in result.lines().take(20).enumerate() {
            println!("EPIC_SRC {:3}: {}", i + 1, line);
        }
        // Verify definitions appear before progPowLoop
        let def_line = result
            .lines()
            .position(|l| l.contains("typedef unsigned int       uint32_t;"));
        let loop_line = result.lines().position(|l| l.contains("void progPowLoop"));
        println!("uint32_t typedef at line: {:?}", def_line);
        println!("progPowLoop at line: {:?}", loop_line);
        assert!(def_line.is_some(), "uint32_t typedef must be present");
        assert!(loop_line.is_some(), "progPowLoop must be present");
        assert!(
            def_line.unwrap() < loop_line.unwrap(),
            "typedef must come before progPowLoop"
        );
    }

    #[test]
    fn test_kawpow_kernel_full_source_lines() {
        let base = include_str!("../../csrc/opencl/kawpow_kernel.cl");
        let result = prepare_kawpow_kernel_source(base, 3621120);
        // Verify definitions appear before progPowSearch
        let def_line = result
            .lines()
            .position(|l| l.contains("#define PROGPOW_LANES"));
        let search_line = result.lines().position(|l| l.contains("progpow_search"));
        println!("PROGPOW_LANES define at line: {:?}", def_line);
        println!("progpow_search at line: {:?}", search_line);
        assert!(def_line.is_some(), "PROGPOW_LANES define must be present");
        assert!(search_line.is_some(), "progpow_search must be present");
        assert!(
            def_line.unwrap() < search_line.unwrap(),
            "defines must come before kernel"
        );
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
        assert_eq!(
            uint32_count, 0,
            "Generated code should NOT redefine uint32_t"
        );
        assert_eq!(rotl_count, 0, "Generated code should NOT redefine ROTL32");
        assert_eq!(
            group_size_count, 0,
            "Generated code should NOT redefine GROUP_SIZE"
        );
    }

    #[test]
    fn test_kawpow_random_math_has_cache_and_math() {
        // KawPow: cnt_cache=11, cnt_math=18, so max_ops=18
        // Should have 11 cache loads and 18 math operations
        let code = gen_kawpow_random_math(&KAWPOW_PARAMS, 0);
        let cache_loads = code.matches("c_dag[offset]").count();
        assert_eq!(
            cache_loads, 11,
            "Should have exactly 11 cache loads (CNT_CACHE=11)"
        );
    }

    #[test]
    fn test_epic_progpow_loop_has_cache_and_math() {
        // EPIC: cnt_cache=12, cnt_math=20, so max_ops=20
        let code = gen_epic_progpow_loop(&EPIC_PROGPOW_PARAMS, 0);
        let cache_loads = code.matches("c_dag[offset]").count();
        assert_eq!(
            cache_loads, 12,
            "Should have exactly 12 cache loads (CNT_CACHE=12)"
        );
    }

    #[test]
    fn test_evr_progpow_params() {
        // EvrProgPow: PERIOD=3, REGS=32, CNT_CACHE=11, CNT_MATH=18
        assert_eq!(
            EVR_PROGPOW_PARAMS.period, 3,
            "EvrProgPow period should be 3"
        );
        assert_eq!(EVR_PROGPOW_PARAMS.regs, 32, "EvrProgPow regs should be 32");
        assert_eq!(
            EVR_PROGPOW_PARAMS.cnt_cache, 11,
            "EvrProgPow cnt_cache should be 11"
        );
        assert_eq!(
            EVR_PROGPOW_PARAMS.cnt_math, 18,
            "EvrProgPow cnt_math should be 18"
        );
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
        assert!(
            !result.contains("XMRIG_INCLUDE"),
            "Placeholders should be replaced"
        );
        // EvrProgPow: period=3, so prog_seed = 100/3 = 33
        // Should have 11 cache loads (same as KawPow)
        let cache_loads = result.matches("c_dag[offset]").count();
        assert_eq!(cache_loads, 11, "EvrProgPow should have 11 cache loads");
    }

    #[test]
    fn test_prepare_kawpow_for_meowpow() {
        let base = "XMRIG_INCLUDE_PROGPOW_RANDOM_MATH\nXMRIG_INCLUDE_PROGPOW_DATA_LOADS";
        let result = prepare_kawpow_kernel_source_for_algo(base, "meowpow", 100);
        assert!(
            !result.contains("XMRIG_INCLUDE"),
            "Placeholders should be replaced"
        );
        // MeowPow: period=6, so prog_seed = 100/6 = 16
        // Should have 6 cache loads (CNT_CACHE=6)
        let cache_loads = result.matches("c_dag[offset]").count();
        assert_eq!(cache_loads, 6, "MeowPow should have 6 cache loads");
    }

    #[test]
    fn test_dump_cuda_progpow_source() {
        let base_src = include_str!("../../csrc/cuda/progpow_kernel.cu");
        let prepared = prepare_progpow_kernel_source_for_algo(base_src, "progpow_zano", 3785945);
        std::fs::write("/tmp/progpow_cuda_source.cu", &prepared).unwrap();

        // Check where injected code ends up
        for (i, line) in prepared.lines().enumerate() {
            let trimmed = line.trim();
            if trimmed.starts_with("offset = mix")
                || trimmed.starts_with("data = c_dag")
                || trimmed.contains("PROGPOW_INCLUDE")
                || trimmed.contains("progpow_mine")
                || trimmed.contains("extern \"C\"")
            {
                println!("Line {}: {}", i + 1, line);
            }
        }
        assert!(
            !prepared.contains("PROGPOW_INCLUDE"),
            "Placeholders should be replaced"
        );
    }
}
