"""
ZION Cosmic Harmony v3 - GPU Mining via PyOpenCL
=================================================

High-performance GPU mining using OpenCL.
Supports AMD, NVIDIA, Intel GPUs.

Usage:
    from cosmic_harmony_v3_gpu import CosmicHarmonyV3GPU
    
    miner = CosmicHarmonyV3GPU()
    miner.list_devices()
    
    # Start mining
    miner.mine(block_header, target, start_nonce=0)
"""

import numpy as np
import os
import time
from typing import Optional, Tuple, List, Union
from dataclasses import dataclass

try:
    import pyopencl as cl
    GPU_AVAILABLE = True
except ImportError:
    GPU_AVAILABLE = False
    print("[WARN] PyOpenCL not available - install with: pip install pyopencl")


# OpenCL Kernel source (same as Rust version)
KERNEL_SOURCE = '''
// ============================================================================
// COSMIC HARMONY V3 - OpenCL Mining Kernel
// ============================================================================

#define KECCAK_ROUNDS 24
#define GOLDEN_RATIO 0x9E3779B97F4A7C15UL

__constant ulong KECCAK_RC[24] = {
    0x0000000000000001UL, 0x0000000000008082UL, 0x800000000000808AUL,
    0x8000000080008000UL, 0x000000000000808BUL, 0x0000000080000001UL,
    0x8000000080008081UL, 0x8000000000008009UL, 0x000000000000008AUL,
    0x0000000000000088UL, 0x0000000080008009UL, 0x000000008000000AUL,
    0x000000008000808BUL, 0x800000000000008BUL, 0x8000000000008089UL,
    0x8000000000008003UL, 0x8000000000008002UL, 0x8000000000000080UL,
    0x000000000000800AUL, 0x800000008000000AUL, 0x8000000080008081UL,
    0x8000000000008080UL, 0x0000000080000001UL, 0x8000000080008008UL
};

__constant int KECCAK_ROTC[24] = {
    1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 2, 14,
    27, 41, 56, 8, 25, 43, 62, 18, 39, 61, 20, 44
};

__constant int KECCAK_PILN[24] = {
    10, 7, 11, 17, 18, 3, 5, 16, 8, 21, 24, 4,
    15, 23, 19, 13, 12, 2, 20, 14, 22, 9, 6, 1
};

// PHI_POWERS_FP: matches L1/cosmic-harmony/src/algorithms_opt.rs PHI_POWERS_FP[16]
// Values = floor(phi^k * 2^32) for k=0..15, same as Python cosmic_harmony_v3_python.py
__constant ulong PHI_POWERS[16] = {
    4294967296UL,    6949403065UL,    11244370361UL,   18193773427UL,
    29438143788UL,   47631917215UL,   77070061004UL,   124701978219UL,
    201772039223UL,  326474017443UL,  528246056666UL,  854720074109UL,
    1382966130776UL, 2237686204885UL, 3620652335660UL, 5858338540545UL
};

__constant uchar COSMIC_XOR_MASK[32] = {
    0x74, 0x9D, 0x30, 0x60, 0x74, 0x9D, 0x30, 0x60,
    0x74, 0x9D, 0x30, 0x60, 0x74, 0x9D, 0x30, 0x60,
    0x74, 0x9D, 0x30, 0x60, 0x74, 0x9D, 0x30, 0x60,
    0x74, 0x9D, 0x30, 0x60, 0x74, 0x9D, 0x30, 0x60
};

// LE load/store helpers (used by memory-hard scratchpad)
#define LOAD_U64_LE(arr, off) \
    ( ((ulong)(arr)[(off)+0])        \
    | ((ulong)(arr)[(off)+1] <<  8)  \
    | ((ulong)(arr)[(off)+2] << 16)  \
    | ((ulong)(arr)[(off)+3] << 24)  \
    | ((ulong)(arr)[(off)+4] << 32)  \
    | ((ulong)(arr)[(off)+5] << 40)  \
    | ((ulong)(arr)[(off)+6] << 48)  \
    | ((ulong)(arr)[(off)+7] << 56)  )

#define STORE_U64_LE(arr, off, w) do { \
    (arr)[(off)+0] = (uchar)((w));        \
    (arr)[(off)+1] = (uchar)((w) >>  8);  \
    (arr)[(off)+2] = (uchar)((w) >> 16);  \
    (arr)[(off)+3] = (uchar)((w) >> 24);  \
    (arr)[(off)+4] = (uchar)((w) >> 32);  \
    (arr)[(off)+5] = (uchar)((w) >> 40);  \
    (arr)[(off)+6] = (uchar)((w) >> 48);  \
    (arr)[(off)+7] = (uchar)((w) >> 56);  \
} while (0)

inline ulong rotl64(ulong x, int n) {
    return (x << n) | (x >> (64 - n));
}

void keccak_f1600(__private ulong *state) {
    ulong t, bc[5];
    
    for (int round = 0; round < KECCAK_ROUNDS; round++) {
        bc[0] = state[0] ^ state[5] ^ state[10] ^ state[15] ^ state[20];
        bc[1] = state[1] ^ state[6] ^ state[11] ^ state[16] ^ state[21];
        bc[2] = state[2] ^ state[7] ^ state[12] ^ state[17] ^ state[22];
        bc[3] = state[3] ^ state[8] ^ state[13] ^ state[18] ^ state[23];
        bc[4] = state[4] ^ state[9] ^ state[14] ^ state[19] ^ state[24];
        
        for (int i = 0; i < 5; i++) {
            t = bc[(i + 4) % 5] ^ rotl64(bc[(i + 1) % 5], 1);
            state[i] ^= t;
            state[i + 5] ^= t;
            state[i + 10] ^= t;
            state[i + 15] ^= t;
            state[i + 20] ^= t;
        }
        
        t = state[1];
        for (int i = 0; i < 24; i++) {
            int j = KECCAK_PILN[i];
            bc[0] = state[j];
            state[j] = rotl64(t, KECCAK_ROTC[i]);
            t = bc[0];
        }
        
        for (int j = 0; j < 25; j += 5) {
            bc[0] = state[j];
            bc[1] = state[j + 1];
            bc[2] = state[j + 2];
            bc[3] = state[j + 3];
            bc[4] = state[j + 4];
            
            state[j] ^= (~bc[1]) & bc[2];
            state[j + 1] ^= (~bc[2]) & bc[3];
            state[j + 2] ^= (~bc[3]) & bc[4];
            state[j + 3] ^= (~bc[4]) & bc[0];
            state[j + 4] ^= (~bc[0]) & bc[1];
        }
        
        state[0] ^= KECCAK_RC[round];
    }
}

void keccak256(__private uchar *input, int input_len, __private uchar *output) {
    ulong state[25];
    for (int i = 0; i < 25; i++) state[i] = 0;
    
    for (int i = 0; i < input_len; i++) {
        ((uchar*)state)[i] ^= input[i];
    }
    ((uchar*)state)[input_len] ^= 0x01;
    ((uchar*)state)[135] ^= 0x80;
    
    keccak_f1600(state);
    
    for (int i = 0; i < 32; i++) {
        output[i] = ((uchar*)state)[i];
    }
}

void sha3_512(__private uchar *input, int input_len, __private uchar *output) {
    ulong state[25];
    for (int i = 0; i < 25; i++) state[i] = 0;
    
    for (int i = 0; i < input_len && i < 72; i++) {
        ((uchar*)state)[i] ^= input[i];
    }
    ((uchar*)state)[input_len] ^= 0x06;
    ((uchar*)state)[71] ^= 0x80;
    
    keccak_f1600(state);
    
    for (int i = 0; i < 64; i++) {
        output[i] = ((uchar*)state)[i];
    }
}

// golden_matrix: sum-based algorithm matching algorithms_opt.rs golden_matrix_opt
// result[i] = (sum_{j=0..7} input[i*8+j] * PHI_POWERS[i+j]) >> 32, stored LE
void golden_matrix(__private uchar *input, __private uchar *output) {
    for (int i = 0; i < 8; i++) {
        ulong sum = 0;
        for (int j = 0; j < 8; j++) {
            sum += (ulong)input[i*8+j] * PHI_POWERS[i+j];
        }
        ulong val = sum >> 32;
        output[i*8+0] = (uchar)(val);
        output[i*8+1] = (uchar)(val >>  8);
        output[i*8+2] = (uchar)(val >> 16);
        output[i*8+3] = (uchar)(val >> 24);
        output[i*8+4] = (uchar)(val >> 32);
        output[i*8+5] = (uchar)(val >> 40);
        output[i*8+6] = (uchar)(val >> 48);
        output[i*8+7] = (uchar)(val >> 56);
    }
}

// cosmic_fusion: Keccak-256 + static XOR mask (4 rounds) then SHA3-512
// Matches cosmic_harmony_v3_python.py cosmic_fusion() — the pool-validated reference
// Input: 64 bytes (only first 32 used); Output: 32 bytes
void cosmic_fusion(__private uchar *input, __private uchar *output) {
    uchar state[32];
    for (int i = 0; i < 32; i++) state[i] = input[i];

    for (int round = 0; round < 4; round++) {
        // kin = state[0..32] || round_byte  (33 bytes)
        uchar kin[33];
        for (int i = 0; i < 32; i++) kin[i] = state[i];
        kin[32] = (uchar)round;

        // intermediate = Keccak-256(kin)  (0x01 padding, rate=136)
        uchar intermediate[32];
        keccak256(kin, 33, intermediate);

        // state[i] = intermediate[i] ^ COSMIC_XOR_MASK[i]
        for (int i = 0; i < 32; i++) {
            state[i] = intermediate[i] ^ COSMIC_XOR_MASK[i];
        }
    }

    // final = SHA3-512(state[0..32]) → take first 32 bytes  (0x06 padding, rate=72)
    uchar final64[64];
    sha3_512(state, 32, final64);
    for (int i = 0; i < 32; i++) output[i] = final64[i];
}

// ============================================================================
// Memory-hard scratchpad  (512 KiB per thread in global memory)
// Mirrors Rust: cosmic-harmony/src/scratchpad.rs  memory_hard_transform()
// Active always from genesis (CHV3_MEMORY_HARD_FORK_HEIGHT = 0, CHV4_NPU_FORK_HEIGHT = 0)
// ============================================================================

#define CL_SCRATCHPAD_BYTES (512u * 1024u)   // 524288 bytes
#define CL_BLOCK_SIZE        64u
#define CL_BLOCK_COUNT       8192u           // SCRATCHPAD_BYTES / BLOCK_SIZE
#define CL_PASSES            4u
#define CL_RANDOM_READS      256u

// SHA3-512(state[64] ++ counter_u64_le)  –  exactly 72 bytes = 1 full rate block
void sha3_512_state_counter(const uchar state[64], ulong counter, uchar out64[64]) {
    ulong st[25];
    for (int i = 0; i < 25; i++) st[i] = 0;
    for (int i = 0; i < 8; i++) st[i] = LOAD_U64_LE(state, i*8);
    st[8] = counter;
    keccak_f1600(st);
    // Padding: second permutation block is empty → 0x06 at byte 0, 0x80 at byte 71
    st[0] ^= 0x06UL;
    st[8] ^= 0x8000000000000000UL;
    keccak_f1600(st);
    for (int i = 0; i < 8; i++) STORE_U64_LE(out64, i*8, st[i]);
}

// Keccak-256(acc[64] ++ chunk[64] ++ r_val[8])  =  136 bytes = 1 full rate block
void keccak256_136_mix(const uchar acc[64], const uchar chunk[64], ulong r_val, uchar out32[32]) {
    ulong st[25];
    for (int i = 0; i < 25; i++) st[i] = 0;
    for (int i = 0; i < 8; i++) st[i]   ^= LOAD_U64_LE(acc,   i*8);
    for (int i = 0; i < 8; i++) st[8+i] ^= LOAD_U64_LE(chunk, i*8);
    st[16] ^= r_val;
    keccak_f1600(st);
    // Padding: next block is empty → 0x01 at byte 0, 0x80 at byte 135 (word 16)
    st[0]  ^= 0x01UL;
    st[16] ^= 0x8000000000000000UL;
    keccak_f1600(st);
    STORE_U64_LE(out32,  0, st[0]);
    STORE_U64_LE(out32,  8, st[1]);
    STORE_U64_LE(out32, 16, st[2]);
    STORE_U64_LE(out32, 24, st[3]);
}

// SHA3-512(acc[64] ++ pad[0..63] ++ pad[SP-64..SP])  =  192 bytes
void sha3_512_random_final(
    const uchar acc[64],
    __global const uchar* pad_first,
    __global const uchar* pad_last,
    uchar out64[64])
{
    ulong st[25];
    for (int i = 0; i < 25; i++) st[i] = 0;
    // Block 1 (72 bytes): acc[0..63](8w) + pad_first[0..7](1w)
    for (int i = 0; i < 8; i++) st[i] ^= LOAD_U64_LE(acc, i*8);
    st[8] ^= LOAD_U64_LE(pad_first, 0);
    keccak_f1600(st);
    // Block 2 (72 bytes): pad_first[8..63](7w) + pad_last[0..15](2w)
    for (int i = 1; i < 8; i++) st[i-1] ^= LOAD_U64_LE(pad_first, i*8);
    st[7] ^= LOAD_U64_LE(pad_last, 0);
    st[8] ^= LOAD_U64_LE(pad_last, 8);
    keccak_f1600(st);
    // Partial (48 bytes): pad_last[16..63](6w) → padding at byte 48
    for (int i = 2; i < 8; i++) st[i-2] ^= LOAD_U64_LE(pad_last, i*8);
    st[6] ^= 0x06UL;
    st[8] ^= 0x8000000000000000UL;
    keccak_f1600(st);
    for (int i = 0; i < 8; i++) STORE_U64_LE(out64, i*8, st[i]);
}

// Step 1: fill 8192 × 64B blocks via SHA3-512 chain
void cl_init_scratchpad(__global uchar* pad, const uchar seed[64]) {
    uchar state[64];
    for (int i = 0; i < 64; i++) state[i] = seed[i];
    for (uint ci = 0; ci < CL_BLOCK_COUNT; ci++) {
        uchar block[64];
        sha3_512_state_counter(state, (ulong)ci, block);
        uint off = ci * CL_BLOCK_SIZE;
        for (int j = 0; j < 64; j++) {
            pad[off + j] = block[j];
            state[j]     = block[j];
        }
    }
}

// Mix one block: SHA3-512(current||prev||rand||pass||index) XOR'd into block
void cl_mix_block(
    __global uchar* pad,
    ulong cur_off, ulong prev_off, ulong rand_off,
    ulong pass_val, ulong index_val)
{
    ulong st[25];
    for (int i = 0; i < 25; i++) st[i] = 0;
    // Block 1 (72B): current[0..63] + prev[0..7]
    for (int i = 0; i < 8; i++) st[i] ^= LOAD_U64_LE(pad, cur_off + (ulong)(i*8));
    st[8] ^= LOAD_U64_LE(pad, prev_off);
    keccak_f1600(st);
    // Block 2 (72B): prev[8..63] + rand[0..15]
    for (int i = 1; i < 8; i++) st[i-1] ^= LOAD_U64_LE(pad, prev_off + (ulong)(i*8));
    st[7] ^= LOAD_U64_LE(pad, rand_off);
    st[8] ^= LOAD_U64_LE(pad, rand_off + 8UL);
    keccak_f1600(st);
    // Partial (64B): rand[16..63](6w) + pass(8B) + index(8B)
    for (int i = 2; i < 8; i++) st[i-2] ^= LOAD_U64_LE(pad, rand_off + (ulong)(i*8));
    st[6] ^= pass_val;
    st[7] ^= index_val;
    st[8] ^= 0x8000000000000006UL;  // 0x06 at byte 0, 0x80 at byte 7 of word 8
    keccak_f1600(st);
    for (int j = 0; j < 8; j++) {
        ulong existing = LOAD_U64_LE(pad, cur_off + (ulong)(j*8));
        ulong result   = existing ^ st[j];
        for (int b = 0; b < 8; b++)
            pad[cur_off + (ulong)(j*8 + b)] = (uchar)(result >> (b*8));
    }
}

// 4 sequential passes (even=forward, odd=backward)
void cl_sequential_passes(__global uchar* pad) {
    for (uint pass = 0; pass < CL_PASSES; pass++) {
        if ((pass & 1u) == 0u) {
            for (ulong i = 0; i < (ulong)CL_BLOCK_COUNT; i++) {
                ulong cur_off  = i * CL_BLOCK_SIZE;
                ulong prev_off = (i == 0 ? (ulong)(CL_BLOCK_COUNT - 1) : (i - 1)) * CL_BLOCK_SIZE;
                ulong idx_val  = LOAD_U64_LE(pad, cur_off);
                ulong rand_idx = (idx_val ^ (ulong)pass ^ i) % (ulong)CL_BLOCK_COUNT;
                cl_mix_block(pad, cur_off, prev_off, rand_idx * CL_BLOCK_SIZE, (ulong)pass, i);
            }
        } else {
            for (long ic = (long)(CL_BLOCK_COUNT - 1); ic >= 0; ic--) {
                ulong i        = (ulong)ic;
                ulong cur_off  = i * CL_BLOCK_SIZE;
                ulong next_i   = (i + 1 == (ulong)CL_BLOCK_COUNT) ? 0UL : (i + 1);
                ulong prev_off = next_i * CL_BLOCK_SIZE;
                ulong idx_val  = LOAD_U64_LE(pad, cur_off);
                ulong rand_idx = (idx_val ^ (ulong)pass ^ i) % (ulong)CL_BLOCK_COUNT;
                cl_mix_block(pad, cur_off, prev_off, rand_idx * CL_BLOCK_SIZE, (ulong)pass, i);
            }
        }
    }
}

// 256 pseudo-random reads + final SHA3-512
void cl_random_read_mix(const uchar seed[64], __global const uchar* pad, uchar out64[64]) {
    uchar acc[64];
    for (int i = 0; i < 64; i++) acc[i] = seed[i];
    ulong pos = (LOAD_U64_LE(seed, 0)) % (ulong)CL_BLOCK_COUNT;
    for (uint r = 0; r < CL_RANDOM_READS; r++) {
        ulong chunk_off = pos * CL_BLOCK_SIZE;
        uchar chunk[64];
        for (int j = 0; j < 64; j++) chunk[j] = pad[chunk_off + j];
        uchar d[32];
        keccak256_136_mix(acc, chunk, (ulong)r, d);
        for (int i = 0; i < 32; i++) acc[i]    ^= d[i];
        for (int i = 0; i < 32; i++) acc[32+i] += d[i];
        ulong next_word = LOAD_U64_LE(d, 0);
        pos = (next_word ^ pos ^ (ulong)r) % (ulong)CL_BLOCK_COUNT;
    }
    sha3_512_random_final(acc, pad, pad + (CL_SCRATCHPAD_BYTES - CL_BLOCK_SIZE), out64);
}

// Full memory-hard transform: golden_matrix_u64[8] → output_u64[8]
void cl_memory_hard_transform(
    const uchar gm_bytes[64],
    __global uchar* pad,
    uchar out64[64])
{
    cl_init_scratchpad(pad, gm_bytes);
    cl_sequential_passes(pad);
    cl_random_read_mix(gm_bytes, pad, out64);
}

// ============================================================================
// CHv4 NPU Mixing Step — INT8 MLP 64→128→64 + residual
// Mirrors Rust: L1/cosmic-harmony/src/algorithms_npu.rs :: npu_mixing_cpu_int8()
// Active always from genesis (CHV4_NPU_FORK_HEIGHT = 0)
// ============================================================================

// GELU approx: gelu(x) ≈ x*(128+x)/256, clamped [-128,127]
int gelu_int8_cl(int x) {
    int v = (x * (128 + x)) >> 8;
    if (v < -128) v = -128;
    if (v >  127) v =  127;
    return v;
}

// LayerNorm (stats-free integer, matches Rust layer_norm_int8)
void layer_norm_int8_cl(int *data, int n, __global const short* scale) {
    long sum = 0;
    for (int i = 0; i < n; i++) sum += (long)data[i];
    int mean = (int)(sum / (long)n);
    long var_sum = 0;
    for (int i = 0; i < n; i++) {
        long d = (long)(data[i] - mean);
        var_sum += d * d;
    }
    int std_approx = (int)sqrt((double)(var_sum / (long)n)) + 1;
    for (int i = 0; i < n; i++) {
        int normalized = ((data[i] - mean) * 128) / std_approx;
        data[i] = (normalized * (int)scale[i]) >> 8;
        if (data[i] < -128) data[i] = -128;
        if (data[i] >  127) data[i] =  127;
    }
}

// CHv4 NPU Mixing: INT8 MLP forward pass with residual add
// W1 [128*64], b1 [128], W2 [64*128], b2 [64], scale1 [128], scale2 [64]
void npu_mixing_step_cl(
    const uchar inp[64],
    uchar out64[64],
    __global const char*  w1,
    __global const char*  b1,
    __global const char*  w2,
    __global const char*  b2,
    __global const short* scale1,
    __global const short* scale2
) {
    // Input u8 → i32 (center: subtract 128)
    int input_i32[64];
    for (int i = 0; i < 64; i++) input_i32[i] = (int)inp[i] - 128;

    // ── Layer 1: Linear(64→128) ──────────────────────────────────
    int hidden[128];
    for (int i = 0; i < 128; i++) {
        int acc = (int)b1[i] * 32;        // bias upscale (Q5)
        for (int j = 0; j < 64; j++)
            acc += input_i32[j] * (int)w1[i * 64 + j];
        hidden[i] = acc >> 12;
        if (hidden[i] < -128) hidden[i] = -128;
        if (hidden[i] >  127) hidden[i] =  127;
    }
    // LayerNorm + GELU
    layer_norm_int8_cl(hidden, 128, scale1);
    for (int i = 0; i < 128; i++) hidden[i] = gelu_int8_cl(hidden[i]);

    // ── Layer 2: Linear(128→64) ──────────────────────────────────
    int output_i32[64];
    for (int i = 0; i < 64; i++) {
        int acc = (int)b2[i] * 32;
        for (int j = 0; j < 128; j++)
            acc += hidden[j] * (int)w2[i * 128 + j];
        output_i32[i] = acc >> 12;
        if (output_i32[i] < -128) output_i32[i] = -128;
        if (output_i32[i] >  127) output_i32[i] =  127;
    }
    layer_norm_int8_cl(output_i32, 64, scale2);

    // ── Residual add + output i32 → u8 ──────────────────────────
    for (int i = 0; i < 64; i++) {
        int v = output_i32[i] + input_i32[i];
        if (v < -128) v = -128;
        if (v >  127) v =  127;
        out64[i] = (uchar)(v + 128);
    }
}

// ============================================================================
// Mining kernels
// ============================================================================

__kernel void cosmic_harmony_v3_mine(
    __global const uchar *block_header,
    uint header_len,
    ulong start_nonce,
    uint target32,
    uint state0_big_endian,
    __global ulong *found_nonce,
    __global uchar *found_hash,
    __global uint *solution_count,
    uint memory_hard,
    __global uchar *scratchpad_buf,
    // CHv4 args — always active (CHV4_NPU_FORK_HEIGHT = 0, from genesis)
    uint chv4,
    __global const char*  npu_w1,
    __global const char*  npu_b1,
    __global const char*  npu_w2,
    __global const char*  npu_b2,
    __global const short* npu_scale1,
    __global const short* npu_scale2
) {
    uint gid = get_global_id(0);
    ulong nonce = start_nonce + gid;

    // Canonical CHv3 input (matches Rust `algorithms_opt::cosmic_harmony_v3`):
    // input = (first 80 bytes of header, zero-padded) || (nonce LE u64)
    // Total input length = 88 bytes.
    uchar input[88];
    uchar step1[32];
    uchar step2[64];
    uchar step3[64];
    uchar final_hash[32];

    for (int i = 0; i < 80; i++) {
        input[i] = 0;
    }

    uint copy_len = header_len;
    if (copy_len > 80) copy_len = 80;
    for (int i = 0; i < (int)copy_len; i++) {
        input[i] = block_header[i];
    }

    input[80] = (uchar)(nonce);
    input[81] = (uchar)(nonce >> 8);
    input[82] = (uchar)(nonce >> 16);
    input[83] = (uchar)(nonce >> 24);
    input[84] = (uchar)(nonce >> 32);
    input[85] = (uchar)(nonce >> 40);
    input[86] = (uchar)(nonce >> 48);
    input[87] = (uchar)(nonce >> 56);
    
    keccak256(input, 88, step1);
    sha3_512(step1, 32, step2);
    golden_matrix(step2, step3);

    if (chv4 && memory_hard) {
        // CHv4 od genesis: GoldenMatrix → MemoryHard → NPU Mixing → CosmicFusion
        __global uchar* my_pad = scratchpad_buf + (ulong)gid * (ulong)CL_SCRATCHPAD_BYTES;
        uchar step4[64];
        cl_memory_hard_transform(step3, my_pad, step4);
        uchar step5[64];
        npu_mixing_step_cl(step4, step5, npu_w1, npu_b1, npu_w2, npu_b2, npu_scale1, npu_scale2);
        cosmic_fusion(step5, final_hash);
    } else if (memory_hard) {
        // CHv3-only path (dead code: CHV3_MEMORY_HARD_FORK_HEIGHT=0, CHV4_NPU_FORK_HEIGHT=0 → vzždy oba flagy 1)
        __global uchar* my_pad = scratchpad_buf + (ulong)gid * (ulong)CL_SCRATCHPAD_BYTES;
        uchar step4[64];
        cl_memory_hard_transform(step3, my_pad, step4);
        cosmic_fusion(step4, final_hash);
    } else {
        // Legacy pipeline (height < 100k): GoldenMatrix → CosmicFusion
        cosmic_fusion(step3, final_hash);
    }

    // Pool target model for Cosmic Harmony v3: compare first 4 bytes (state0) against 32-bit target.
    uint state0 = 0;
    if (state0_big_endian != 0) {
        state0 = ((uint)final_hash[0] << 24) | ((uint)final_hash[1] << 16) | ((uint)final_hash[2] << 8) | (uint)final_hash[3];
    } else {
        state0 = ((uint)final_hash[3] << 24) | ((uint)final_hash[2] << 16) | ((uint)final_hash[1] << 8) | (uint)final_hash[0];
    }

    bool valid = (state0 <= target32);
    
    if (valid) {
        uint old = atomic_inc(solution_count);
        if (old == 0) {
            found_nonce[0] = nonce;
            for (int i = 0; i < 32; i++) {
                found_hash[i] = final_hash[i];
            }
        }
    }
}

__kernel void cosmic_harmony_v3_batch(
    __global const uchar *block_header,
    uint header_len,
    ulong start_nonce,
    __global uchar *output_hashes
) {
    uint gid = get_global_id(0);
    ulong nonce = start_nonce + gid;

    uchar input[88];
    uchar step1[32];
    uchar step2[64];
    uchar step3[64];
    uchar final_hash[32];

    for (int i = 0; i < 80; i++) {
        input[i] = 0;
    }

    uint copy_len = header_len;
    if (copy_len > 80) copy_len = 80;
    for (int i = 0; i < (int)copy_len; i++) {
        input[i] = block_header[i];
    }

    input[80] = (uchar)(nonce);
    input[81] = (uchar)(nonce >> 8);
    input[82] = (uchar)(nonce >> 16);
    input[83] = (uchar)(nonce >> 24);
    input[84] = (uchar)(nonce >> 32);
    input[85] = (uchar)(nonce >> 40);
    input[86] = (uchar)(nonce >> 48);
    input[87] = (uchar)(nonce >> 56);
    
    keccak256(input, 88, step1);
    sha3_512(step1, 32, step2);
    golden_matrix(step2, step3);
    cosmic_fusion(step3, final_hash);
    
    __global uchar *out = output_hashes + gid * 32;
    for (int i = 0; i < 32; i++) {
        out[i] = final_hash[i];
    }
}
'''


# ============================================================================
# CHv4 Weight Derivation  (matches Rust algorithms_npu.rs :: MlpWeights::from_genesis_seed)
# ============================================================================

def _derive_chv4_weights() -> dict:
    """
    Derive CHv4 INT8 MLP weights from genesis seed.
    Must match Rust exactly: blake3::Hasher::new_keyed(CHV4_MLP_GENESIS_SEED),
    update b"CHv4_weights_v1", then counter-based expansion.

    Returns dict with numpy arrays:
      w1     [128*64] int8   W1 matrix flattened
      b1     [128]    int8
      w2     [64*128] int8   W2 matrix flattened
      b2     [64]     int8
      scale1 [128]    int16  LayerNorm scale layer 1
      scale2 [64]     int16  LayerNorm scale layer 2
    """
    GENESIS_SEED = b"ZION_CHv4_mixing_v1_genesis_seed"  # 32 bytes
    TOTAL_CHUNKS = 17 * 32  # 544 × 32B = 17408 bytes (> 16768 needed)

    expanded = bytearray()
    try:
        import blake3 as _blake3  # pip install blake3
        hasher = _blake3.blake3(key=GENESIS_SEED)
        hasher.update(b"CHv4_weights_v1")
        for chunk_idx in range(TOTAL_CHUNKS):
            h = hasher.copy()
            h.update(chunk_idx.to_bytes(4, "little"))
            expanded.extend(h.digest())
    except ImportError:
        import hashlib, warnings
        warnings.warn(
            "\n[CHv4 GPU] blake3 Python package not installed.\n"
            "  CHv4 GPU weights use SHA3 fallback — will NOT match Rust/pool!\n"
            "  Fix: pip install blake3\n",
            RuntimeWarning, stacklevel=3,
        )
        # SHA3 fallback (consensus-incompatible — for testing only)
        base = hashlib.sha3_512(GENESIS_SEED + b"CHv4_weights_v1").digest()
        for chunk_idx in range(TOTAL_CHUNKS):
            chunk = hashlib.sha3_256(base + chunk_idx.to_bytes(4, "little")).digest()
            expanded.extend(chunk)

    pos = 0
    # W1 [128×64] int8
    w1 = np.frombuffer(bytes(expanded[pos: pos + 8192]), dtype=np.int8).copy()
    pos += 8192
    # b1 [128] int8
    b1 = np.frombuffer(bytes(expanded[pos: pos + 128]), dtype=np.int8).copy()
    pos += 128
    # W2 [64×128] int8
    w2 = np.frombuffer(bytes(expanded[pos: pos + 8192]), dtype=np.int8).copy()
    pos += 8192
    # b2 [64] int8
    b2 = np.frombuffer(bytes(expanded[pos: pos + 64]), dtype=np.int8).copy()
    pos += 64
    # scale1 [128] int16 — Q8: 224 + (byte & 0x3F)
    scale1 = np.array([224 + (expanded[pos + i] & 0x3F) for i in range(128)], dtype=np.int16)
    pos += 128
    # scale2 [64] int16
    scale2 = np.array([224 + (expanded[pos + i] & 0x3F) for i in range(64)], dtype=np.int16)

    return {"w1": w1, "b1": b1, "w2": w2, "b2": b2, "scale1": scale1, "scale2": scale2}


@dataclass
class GpuDevice:
    """GPU device information"""
    id: int
    name: str
    vendor: str
    compute_units: int
    max_work_group_size: int
    global_memory: int
    local_memory: int
    
    def __str__(self):
        return f"[{self.id}] {self.name} ({self.vendor}) - {self.compute_units} CUs, {self.global_memory // (1024*1024)} MB"


class CosmicHarmonyV3GPU:
    """GPU Miner for Cosmic Harmony v3"""
    
    def __init__(self, device_id: int = 0, batch_size: int = 1_000_000, work_group_size: int = 256,
                 mh_batch_size: Optional[int] = None):
        if not GPU_AVAILABLE:
            raise RuntimeError("PyOpenCL not available")
        
        self.device_id = device_id
        self.batch_size = batch_size
        self.work_group_size = work_group_size
        # Memory-hard batch: max threads when scratchpad is active (512 KiB each)
        self.mh_batch_size = max(
            1,
            mh_batch_size if mh_batch_size is not None
            else int(os.environ.get("ZION_GPU_MH_BATCH", "256"))
        )
        
        # Initialize OpenCL
        platforms = cl.get_platforms()
        if not platforms:
            raise RuntimeError("No OpenCL platforms found")
        
        # Collect all GPU devices
        all_devices = []
        for platform in platforms:
            try:
                devices = platform.get_devices(device_type=cl.device_type.GPU)
                all_devices.extend(devices)
            except cl.Error:
                continue
        
        if not all_devices:
            raise RuntimeError("No GPU devices found")
        
        if device_id >= len(all_devices):
            raise RuntimeError(f"Device ID {device_id} not found. Available: 0-{len(all_devices)-1}")
        
        self.device = all_devices[device_id]
        self.ctx = cl.Context([self.device])
        self.queue = cl.CommandQueue(self.ctx)
        
        # Build program
        self.program = cl.Program(self.ctx, KERNEL_SOURCE).build()
        # Cache kernel objects (avoid repeated kernel retrieval overhead/warnings)
        self.kernel_mine = cl.Kernel(self.program, "cosmic_harmony_v3_mine")
        self.kernel_batch = cl.Kernel(self.program, "cosmic_harmony_v3_batch")
        
        # Get device info
        self.device_info = GpuDevice(
            id=device_id,
            name=self.device.name,
            vendor=self.device.vendor,
            compute_units=self.device.max_compute_units,
            max_work_group_size=self.device.max_work_group_size,
            global_memory=self.device.global_mem_size,
            local_memory=self.device.local_mem_size,
        )
        
        print(f"[GPU] Initialized: {self.device_info}")
        
        # Allocate buffers (CHv3 uses only the first 80 bytes of the header)
        self.header_buf = cl.Buffer(self.ctx, cl.mem_flags.READ_ONLY, 80)
        self.found_nonce_buf = cl.Buffer(self.ctx, cl.mem_flags.WRITE_ONLY, 8)
        self.found_hash_buf = cl.Buffer(self.ctx, cl.mem_flags.WRITE_ONLY, 32)
        self.solution_count_buf = cl.Buffer(self.ctx, cl.mem_flags.READ_WRITE, 4)

        # Scratchpad buffer: 512 KiB × mh_batch_size (for memory-hard height >= 100k)
        _mh_sp_bytes = self.mh_batch_size * 512 * 1024
        try:
            self.scratchpad_buf = cl.Buffer(self.ctx, cl.mem_flags.READ_WRITE, _mh_sp_bytes)
            print(f"[GPU] Scratchpad buffer: {_mh_sp_bytes // (1024*1024)} MiB ({self.mh_batch_size} MH threads)")
        except cl.Error as e:
            print(f"[GPU] WARNING: failed to allocate scratchpad ({_mh_sp_bytes // (1024*1024)} MiB): {e}")
            print(f"[GPU]   Memory-hard mining (height>=100k) will FALL BACK to CPU verify.")
            self.scratchpad_buf = None
        # Pre-allocate tiny placeholder so mine() never has to allocate on the hot path
        self._dummy_sp_buf = cl.Buffer(self.ctx, cl.mem_flags.READ_WRITE, 64)

        # CHv4 NPU weight buffers (derived once from genesis seed, static for lifetime)
        _chv4_w = _derive_chv4_weights()
        _ro = cl.mem_flags.READ_ONLY | cl.mem_flags.COPY_HOST_PTR
        self.npu_w1_buf     = cl.Buffer(self.ctx, _ro, hostbuf=_chv4_w["w1"])    # 8192 B int8
        self.npu_b1_buf     = cl.Buffer(self.ctx, _ro, hostbuf=_chv4_w["b1"])    #  128 B int8
        self.npu_w2_buf     = cl.Buffer(self.ctx, _ro, hostbuf=_chv4_w["w2"])    # 8192 B int8
        self.npu_b2_buf     = cl.Buffer(self.ctx, _ro, hostbuf=_chv4_w["b2"])    #   64 B int8
        self.npu_scale1_buf = cl.Buffer(self.ctx, _ro, hostbuf=_chv4_w["scale1"])#  256 B int16
        self.npu_scale2_buf = cl.Buffer(self.ctx, _ro, hostbuf=_chv4_w["scale2"])#  128 B int16
        print(f"[GPU] CHv4 NPU weights loaded ({sum(a.nbytes for a in _chv4_w.values())} B)")

        # Reusable host-side buffers for deterministic transfer semantics.
        self._zero_u32 = np.array([0], dtype=np.uint32)
        self._solution_count_host = np.zeros(1, dtype=np.uint32)
        self._found_nonce_host = np.zeros(1, dtype=np.uint64)
        self._found_hash_host = np.zeros(32, dtype=np.uint8)
        
        # Stats
        self.total_hashes = 0
        self.solutions_found = 0
        self.last_batch_hashes = 0
        self.last_kernel_ms: float = 0.0
        self.last_global_size: int = 0
        self._warned_header_trim = False
        self._last_header_key: bytes = b''  # cached to skip redundant GPU header uploads
    
    @staticmethod
    def list_devices() -> List[GpuDevice]:
        """List all available GPU devices"""
        if not GPU_AVAILABLE:
            return []
        
        devices = []
        platforms = cl.get_platforms()
        
        device_idx = 0
        for platform in platforms:
            try:
                gpu_devices = platform.get_devices(device_type=cl.device_type.GPU)
                for device in gpu_devices:
                    devices.append(GpuDevice(
                        id=device_idx,
                        name=device.name,
                        vendor=device.vendor,
                        compute_units=device.max_compute_units,
                        max_work_group_size=device.max_work_group_size,
                        global_memory=device.global_mem_size,
                        local_memory=device.local_mem_size,
                    ))
                    device_idx += 1
            except cl.Error:
                continue
        
        return devices
    
    def mine(
        self,
        block_header: bytes,
        target: Union[int, bytes, bytearray],
        start_nonce: int = 0,
        state0_endian: str = "little",
        height: int = 0,
    ) -> Optional[Tuple[int, bytes]]:
        """
        Mine for a valid nonce.
        
        Returns (nonce, hash) if found, None otherwise.
        """
        if len(block_header) > 80 and not self._warned_header_trim:
            print(f"⚠️  CHv3 GPU: ignoring extra header bytes {len(block_header)} -> 80 (consensus)")
            self._warned_header_trim = True

        header_prefix = block_header[:80]
        header = np.zeros(80, dtype=np.uint8)
        header[:len(header_prefix)] = list(header_prefix)

        # Upload header only when job changes (every 500k-batch would waste GPU bandwidth)
        header_key = bytes(header)
        if header_key != self._last_header_key:
            cl.enqueue_copy(self.queue, self.header_buf, header)
            self._last_header_key = header_key

        # Reset solution count — non-blocking: queue ordering guarantees it runs before kernel
        cl.enqueue_copy(self.queue, self.solution_count_buf, self._zero_u32, is_blocking=False)

        # Normalize target to 32-bit, matching pool semantics (state0 vs u32 target).
        if isinstance(target, (bytes, bytearray)):
            if len(target) < 4:
                raise ValueError("Target bytes must be at least 4 bytes")
            target_int = int.from_bytes(bytes(target[:4]), "big", signed=False)
        else:
            target_int = int(target)

        # Execute kernel
        header_len = np.uint32(len(header_prefix))
        start = np.uint64(start_nonce)
        target32 = np.uint32(target_int & 0xFFFFFFFF)
        state0_big = np.uint32(1 if str(state0_endian).lower() == "big" else 0)

        # Determine memory-hard mode — always active from genesis (CHV3_MEMORY_HARD_FORK_HEIGHT = 0)
        mh_flag = np.uint32(1)
        if self.scratchpad_buf is None:
            # Scratchpad allocation failed at init → cannot do GPU MH, skip hash count
            mh_flag = np.uint32(0)

        # CHv4 flag — always active from genesis (CHV4_NPU_FORK_HEIGHT = 0)
        chv4_flag = np.uint32(1)
        if not mh_flag:
            # Guard: chv4 requires scratchpad (should not happen in normal ops)
            chv4_flag = np.uint32(0)

        # Adjust work group size to device limits
        max_wg = min(self.work_group_size, self.device.max_work_group_size)
        adjusted_batch = (self.batch_size // max_wg) * max_wg
        if adjusted_batch == 0:
            adjusted_batch = max_wg

        # When memory-hard: cap to mh_batch_size (VRAM budget: mh_batch_size * 512 KiB)
        if mh_flag:
            mh_cap = (self.mh_batch_size // max_wg) * max_wg
            if mh_cap == 0:
                mh_cap = max_wg
            adjusted_batch = min(adjusted_batch, mh_cap)

        global_size = (adjusted_batch,)
        local_size = (max_wg,)

        # Scratchpad buffer: use the real one (or dummy placeholder when unavailable)
        # kernel ignores it when memory_hard=0, so safe to pass always
        sp_buf = self.scratchpad_buf if self.scratchpad_buf is not None else self._dummy_sp_buf

        t0 = time.perf_counter()
        self.kernel_mine(
            self.queue,
            global_size,
            local_size,
            self.header_buf,
            header_len,
            start,
            target32,
            state0_big,
            self.found_nonce_buf,
            self.found_hash_buf,
            self.solution_count_buf,
            mh_flag,
            sp_buf,
            # CHv4 NPU mixing args
            chv4_flag,
            self.npu_w1_buf,
            self.npu_b1_buf,
            self.npu_w2_buf,
            self.npu_b2_buf,
            self.npu_scale1_buf,
            self.npu_scale2_buf,
        )
        self.queue.finish()
        kernel_ms = (time.perf_counter() - t0) * 1000.0
        self.last_batch_hashes = int(adjusted_batch)
        self.last_kernel_ms = kernel_ms
        self.last_global_size = int(adjusted_batch)
        self.total_hashes += int(adjusted_batch)

        # Check results
        cl.enqueue_copy(self.queue, self._solution_count_host, self.solution_count_buf, is_blocking=True)
        
        if self._solution_count_host[0] > 0:
            cl.enqueue_copy(self.queue, self._found_nonce_host, self.found_nonce_buf, is_blocking=True)
            cl.enqueue_copy(self.queue, self._found_hash_host, self.found_hash_buf, is_blocking=True)
            
            self.solutions_found += 1
            return int(self._found_nonce_host[0]), bytes(self._found_hash_host)
        
        return None
    
    def batch_hash(
        self,
        block_header: bytes,
        start_nonce: int,
        count: int,
    ) -> List[bytes]:
        """Compute batch of hashes"""
        if len(block_header) > 80 and not self._warned_header_trim:
            print(f"[WARN] CHv3 GPU: ignoring extra header bytes {len(block_header)} -> 80 (consensus)")
            self._warned_header_trim = True

        header_prefix = block_header[:80]
        header = np.zeros(80, dtype=np.uint8)
        header[:len(header_prefix)] = list(header_prefix)
        
        # Allocate output buffer
        output_buf = cl.Buffer(self.ctx, cl.mem_flags.WRITE_ONLY, 32 * count)
        
        # Upload header
        cl.enqueue_copy(self.queue, self.header_buf, header)
        
        # Execute kernel
        header_len = np.uint32(len(header_prefix))
        start = np.uint64(start_nonce)
        
        global_size = (count,)
        local_size = (min(self.work_group_size, count),)
        
        self.kernel_batch(
            self.queue,
            global_size,
            local_size,
            self.header_buf,
            header_len,
            start,
            output_buf,
        )
        
        self.queue.finish()
        
        # Read results
        output = np.zeros(32 * count, dtype=np.uint8)
        cl.enqueue_copy(self.queue, output, output_buf)
        
        # Split into hashes
        return [bytes(output[i*32:(i+1)*32]) for i in range(count)]
    
    def benchmark(self, duration: float = 5.0) -> float:
        """
        Benchmark GPU hashrate.
        
        Returns hashes per second.
        """
        block_header = b"ZION block header v2.9.5 benchmark test"
        target = 0xFFFFFFFF  # Easy target32 (always pass)
        
        # Warmup
        for _ in range(3):
            self.mine(block_header, target, 0)
        
        # Benchmark
        start_time = time.perf_counter()
        iterations = 0
        nonce = 0
        
        while time.perf_counter() - start_time < duration:
            self.mine(block_header, target, nonce)
            nonce += self.batch_size
            iterations += 1
        
        elapsed = time.perf_counter() - start_time
        total = iterations * self.batch_size
        hashrate = total / elapsed
        
        return hashrate


# ============================================================================
# CLI
# ============================================================================

if __name__ == "__main__":
    print("=" * 60)
    print("ZION Cosmic Harmony v3 - GPU Benchmark")
    print("=" * 60)
    
    if not GPU_AVAILABLE:
        print("[ERR] PyOpenCL not installed!")
        print("   Install with: pip install pyopencl")
        exit(1)
    
    # List devices
    print("\n>>> Available GPU Devices:")
    devices = CosmicHarmonyV3GPU.list_devices()
    if not devices:
        print("   No GPU devices found!")
        exit(1)
    
    for dev in devices:
        print(f"   {dev}")
    
    # Initialize miner
    try:
        miner = CosmicHarmonyV3GPU(
            device_id=0,
            batch_size=500_000,
            work_group_size=256,
        )
    except Exception as e:
        print(f"[ERR] Failed to initialize GPU: {e}")
        exit(1)
    
    # Benchmark
    print("\n>>> Running 5-second benchmark...")
    hashrate = miner.benchmark(5.0)
    
    print(f"\n>>> Results:")
    print(f"   Hashrate: {hashrate:,.0f} H/s ({hashrate/1_000_000:.2f} MH/s)")
    print(f"   Total hashes: {miner.total_hashes:,}")
    print(f"   Device: {miner.device_info.name}")
    
    # Verify hash correctness
    print("\n>>> Verifying hash correctness...")
    hashes = miner.batch_hash(b"ZION test", 0, 10)
    print(f"   First hash: {hashes[0].hex()[:32]}...")
    print(f"   Unique hashes: {len(set(h.hex() for h in hashes))}/10")
    
    print("\n✅ GPU mining ready!")
    print("=" * 60)
