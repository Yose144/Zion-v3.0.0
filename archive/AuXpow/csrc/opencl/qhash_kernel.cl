// =============================================================================
// Qhash OpenCL kernel for QubitCoin (QTC) quantum Proof-of-Work mining.
//
// Algorithm (from official qubitcoin-miner source):
//   1. SHA-256(80-byte header) → 32-byte initial_hash
//   2. Split 32-byte hash into 64 nibbles (4-bit values 0-15)
//   3. Quantum circuit simulation: 16 qubits, 2 layers
//      - State vector: 2^16 = 65536 complex amplitudes (float2)
//      - Per layer: RY rotations → RZ rotations → CNOT chain (adjacent qubits)
//      - RY angle = -nibble[idx] * PI/16, RZ angle = -nibble[idx] * PI/16
//   4. Extract Z-basis expectations: 16 float values in [-1, 1]
//   5. Convert to fixed-point int16 (× 32768)
//   6. Build 64-byte buffer: [initial_hash(32) | expectations(32)]
//   7. SHA-256(64-byte buffer) → 32-byte final hash
//   8. Check if final hash ≤ target
//
// Each work-item processes ONE nonce. State vector (512KB) in global memory.
// =============================================================================

#pragma OPENCL EXTENSION cl_khr_fp64 : enable

#define PI 3.14159265358979323846f
#define NUM_QUBITS 16
#define NUM_LAYERS 2
#define STATE_SIZE 65536  // 2^16
#define INPUT_SIZE 80

// ── SHA-256 ─────────────────────────────────────────────────────────────────

__constant uint K256[64] = {
    0x428a2f98u, 0x71374491u, 0xb5c0fbcfu, 0xe9b5dba5u, 0x3956c25bu, 0x59f111f1u, 0x923f82a4u, 0xab1c5ed5u,
    0xd807aa98u, 0x12835b01u, 0x243185beu, 0x550c7dc3u, 0x72be5d74u, 0x80deb1feu, 0x9bdc06a7u, 0xc19bf174u,
    0xe49b69c1u, 0xefbe4786u, 0x0fc19dc6u, 0x240ca1ccu, 0x2de92c6fu, 0x4a7484aau, 0x5cb0a9dcu, 0x76f988dau,
    0x983e5152u, 0xa831c66du, 0xb00327c8u, 0xbf597fc7u, 0xc6e00bf3u, 0xd5a79147u, 0x06ca6351u, 0x14292967u,
    0x27b70a85u, 0x2e1b2138u, 0x4d2c6dfcu, 0x53380d13u, 0x650a7354u, 0x766a0abbu, 0x81c2c92eu, 0x92722c85u,
    0xa2bfe8a1u, 0xa81a664bu, 0xc24b8b70u, 0xc76c51a3u, 0xd192e819u, 0xd6990624u, 0xf40e3585u, 0x106aa070u,
    0x19a4c116u, 0x1e376c08u, 0x2748774cu, 0x34b0bcb5u, 0x391c0cb3u, 0x4ed8aa4au, 0x5b9cca4fu, 0x682e6ff3u,
    0x748f82eeu, 0x78a5636fu, 0x84c87814u, 0x8cc70208u, 0x90befffau, 0xa4506cebu, 0xbef9a3f7u, 0xc67178f2u
};

typedef struct {
    uint h[8];
    uchar buf[64];
    uint buf_len;
    ulong total_len;
} SHA256Ctx;

inline uint sha256_rotr(uint x, uint n) { return (x >> n) | (x << (32 - n)); }
inline uint sha256_ch(uint x, uint y, uint z)  { return (x & y) ^ (~x & z); }
inline uint sha256_maj(uint x, uint y, uint z) { return (x & y) ^ (x & z) ^ (y & z); }
inline uint sha256_bsig0(uint x) { return sha256_rotr(x,2) ^ sha256_rotr(x,13) ^ sha256_rotr(x,22); }
inline uint sha256_bsig1(uint x) { return sha256_rotr(x,6) ^ sha256_rotr(x,11) ^ sha256_rotr(x,25); }
inline uint sha256_ssig0(uint x) { return sha256_rotr(x,7) ^ sha256_rotr(x,18) ^ (x >> 3); }
inline uint sha256_ssig1(uint x) { return sha256_rotr(x,17) ^ sha256_rotr(x,19) ^ (x >> 10); }

inline void sha256_compress(SHA256Ctx* ctx, const uchar block[64]) {
    uint w[64];
    for (int i = 0; i < 16; i++)
        w[i] = ((uint)block[i*4] << 24) | ((uint)block[i*4+1] << 16)
             | ((uint)block[i*4+2] << 8) | (uint)block[i*4+3];
    for (int i = 16; i < 64; i++)
        w[i] = sha256_ssig1(w[i-2]) + w[i-7] + sha256_ssig0(w[i-15]) + w[i-16];

    uint a=ctx->h[0], b=ctx->h[1], c=ctx->h[2], d=ctx->h[3];
    uint e=ctx->h[4], f=ctx->h[5], g=ctx->h[6], h=ctx->h[7];

    for (int i = 0; i < 64; i++) {
        uint t1 = h + sha256_bsig1(e) + sha256_ch(e,f,g) + K256[i] + w[i];
        uint t2 = sha256_bsig0(a) + sha256_maj(a,b,c);
        h=g; g=f; f=e; e=d+t1; d=c; c=b; b=a; a=t1+t2;
    }
    ctx->h[0]+=a; ctx->h[1]+=b; ctx->h[2]+=c; ctx->h[3]+=d;
    ctx->h[4]+=e; ctx->h[5]+=f; ctx->h[6]+=g; ctx->h[7]+=h;
}

inline void sha256_init(SHA256Ctx* ctx) {
    ctx->h[0]=0x6a09e667u; ctx->h[1]=0xbb67ae85u;
    ctx->h[2]=0x3c6ef372u; ctx->h[3]=0xa54ff53au;
    ctx->h[4]=0x510e527fu; ctx->h[5]=0x9b05688cu;
    ctx->h[6]=0x1f83d9abu; ctx->h[7]=0x5be0cd19u;
    ctx->buf_len = 0; ctx->total_len = 0;
}

inline void sha256_update(SHA256Ctx* ctx, const uchar* data, uint len) {
    ctx->total_len += len;
    uint i = 0;
    if (ctx->buf_len > 0) {
        while (ctx->buf_len < 64 && i < len) ctx->buf[ctx->buf_len++] = data[i++];
        if (ctx->buf_len == 64) { sha256_compress(ctx, ctx->buf); ctx->buf_len = 0; }
    }
    while (i + 64 <= len) { sha256_compress(ctx, data + i); i += 64; }
    while (i < len) ctx->buf[ctx->buf_len++] = data[i++];
}

inline void sha256_final(SHA256Ctx* ctx, uchar out[32]) {
    ulong bits = ctx->total_len * 8;
    uchar pad = 0x80;
    sha256_update(ctx, &pad, 1);
    uchar zero = 0;
    while (ctx->buf_len != 56) sha256_update(ctx, &zero, 1);
    uchar len_bytes[8];
    for (int i = 0; i < 8; i++) len_bytes[i] = (uchar)(bits >> (56 - i*8));
    sha256_update(ctx, len_bytes, 8);
    for (int i = 0; i < 8; i++) {
        out[i*4+0] = (uchar)(ctx->h[i] >> 24);
        out[i*4+1] = (uchar)(ctx->h[i] >> 16);
        out[i*4+2] = (uchar)(ctx->h[i] >> 8);
        out[i*4+3] = (uchar)(ctx->h[i]);
    }
}

// ── Quantum gate operations on state vector ─────────────────────────────────
// State vector: STATE_SIZE complex amplitudes (float2: x=real, y=imag)
// All gates operate in-place on the state vector.

// Apply RY rotation on qubit q by angle theta
// RY(theta) = [[cos(theta/2), -sin(theta/2)], [sin(theta/2), cos(theta/2)]]
inline void apply_ry(__global float2* state, int q, float theta) {
    float c = cos(theta * 0.5f);
    float s = sin(theta * 0.5f);
    int stride = 1 << q;
    int mask = stride - 1;
    for (int i = 0; i < STATE_SIZE; i += (stride << 1)) {
        for (int j = i; j < i + stride; j++) {
            int idx0 = j;           // bit q = 0
            int idx1 = j + stride;  // bit q = 1
            float2 a0 = state[idx0];
            float2 a1 = state[idx1];
            state[idx0].x = c * a0.x - s * a1.x;
            state[idx0].y = c * a0.y - s * a1.y;
            state[idx1].x = s * a0.x + c * a1.x;
            state[idx1].y = s * a0.y + c * a1.y;
        }
    }
}

// Apply RZ rotation on qubit q by angle theta
// RZ(theta) = diag(exp(-i*theta/2), exp(+i*theta/2))
// For bit=0: multiply by (cos(theta/2), -sin(theta/2))
// For bit=1: multiply by (cos(theta/2), +sin(theta/2))
inline void apply_rz(__global float2* state, int q, float theta) {
    float c = cos(theta * 0.5f);
    float s = sin(theta * 0.5f);
    int stride = 1 << q;
    for (int i = 0; i < STATE_SIZE; i += (stride << 1)) {
        for (int j = i; j < i + stride; j++) {
            int idx0 = j;           // bit q = 0 → phase = -theta/2
            int idx1 = j + stride;  // bit q = 1 → phase = +theta/2
            float2 a0 = state[idx0];
            float2 a1 = state[idx1];
            // exp(-i*theta/2) = cos(theta/2) - i*sin(theta/2)
            state[idx0].x = c * a0.x + s * a0.y;
            state[idx0].y = c * a0.y - s * a0.x;
            // exp(+i*theta/2) = cos(theta/2) + i*sin(theta/2)
            state[idx1].x = c * a1.x - s * a1.y;
            state[idx1].y = c * a1.y + s * a1.x;
        }
    }
}

// Apply CNOT gate: control=q_ctrl, target=q_tgt
// If bit q_ctrl is 1, flip bit q_tgt (swap amplitudes)
inline void apply_cnot(__global float2* state, int q_ctrl, int q_tgt) {
    int s_ctrl = 1 << q_ctrl;
    int s_tgt = 1 << q_tgt;
    for (int i = 0; i < STATE_SIZE; i++) {
        if ((i & s_ctrl) && !(i & s_tgt)) {
            int j = i | s_tgt;   // flip target bit to 1
            float2 tmp = state[i];
            state[i] = state[j];
            state[j] = tmp;
        }
    }
}

// Compute Z-basis expectation for qubit q:
// <Z_q> = sum over j where bit q=0 of (|amp[j]|^2 - |amp[j^(1<<q)]|^2)
inline float compute_expectation(__global float2* state, int q) {
    int stride = 1 << q;
    float exp_val = 0.0f;
    for (int i = 0; i < STATE_SIZE; i += (stride << 1)) {
        for (int j = i; j < i + stride; j++) {
            int idx0 = j;
            int idx1 = j + stride;
            float p0 = state[idx0].x * state[idx0].x + state[idx0].y * state[idx0].y;
            float p1 = state[idx1].x * state[idx1].x + state[idx1].y * state[idx1].y;
            exp_val += p0 - p1;
        }
    }
    return exp_val;
}

// ── Main Qhash mining kernel ────────────────────────────────────────────────
// Each work-item processes one nonce.
// state_vec_pool: pre-allocated STATE_SIZE * float2 per work-item
__kernel void qhash_mine(
    __global const uchar* header,       // 80-byte block header
    uint header_len,
    ulong base_nonce,
    __global uchar* output_hash,        // 32-byte output hash
    __global uint* found_flag,          // 1 if solution found
    __global ulong* output_nonce,       // winning nonce
    __global const uchar* target,       // 32-byte target (big-endian)
    __global float2* state_vec_pool     // STATE_SIZE * batch_size
)
{
    uint gid = get_global_id(0);
    if (gid == 0) found_flag[0] = 0;
    barrier(CLK_GLOBAL_MEM_FENCE);

    ulong nonce = base_nonce + (ulong)gid;

    // Each work-item gets its own state vector region
    __global float2* state = state_vec_pool + (ulong)gid * STATE_SIZE;

    // Step 1: SHA-256 of 80-byte header with nonce inserted at bytes 0-3
    uchar hdr[80];
    for (uint i = 0; i < 80 && i < header_len; i++) hdr[i] = header[i];
    // Insert nonce at bytes 0-3 (little-endian, Bitcoin-style)
    hdr[0] = (uchar)(nonce & 0xFF);
    hdr[1] = (uchar)((nonce >> 8) & 0xFF);
    hdr[2] = (uchar)((nonce >> 16) & 0xFF);
    hdr[3] = (uchar)((nonce >> 24) & 0xFF);

    SHA256Ctx ctx;
    sha256_init(&ctx);
    sha256_update(&ctx, hdr, 80);
    uchar initial_hash[32];
    sha256_final(&ctx, initial_hash);

    // Step 2: Split into 64 nibbles
    uchar nibbles[64];
    for (int i = 0; i < 32; i++) {
        nibbles[2*i]     = (initial_hash[i] >> 4) & 0xF;
        nibbles[2*i + 1] = initial_hash[i] & 0xF;
    }

    // Step 3: Initialize state vector to |00...0>
    for (int i = 0; i < STATE_SIZE; i++) {
        state[i].x = 0.0f;
        state[i].y = 0.0f;
    }
    state[0].x = 1.0f;  // |00...0>

    // Step 3b: Apply quantum circuit (2 layers)
    for (int l = 0; l < NUM_LAYERS; l++) {
        // Single-qubit RY rotations
        for (int i = 0; i < NUM_QUBITS; i++) {
            int idx = (2 * l * NUM_QUBITS + i) % 64;
            float angle = -(float)nibbles[idx] * PI / 16.0f;
            apply_ry(state, i, angle);
        }
        // Single-qubit RZ rotations
        for (int i = 0; i < NUM_QUBITS; i++) {
            int idx = ((2 * l + 1) * NUM_QUBITS + i) % 64;
            float angle = -(float)nibbles[idx] * PI / 16.0f;
            apply_rz(state, i, angle);
        }
        // CNOT chain on adjacent qubits
        for (int i = 0; i < NUM_QUBITS - 1; i++) {
            apply_cnot(state, i, i + 1);
        }
    }

    // Step 4: Extract Z-basis expectations
    float expectations[NUM_QUBITS];
    for (int i = 0; i < NUM_QUBITS; i++) {
        expectations[i] = compute_expectation(state, i);
    }

    // Step 5: Convert to fixed-point int16
    // Build 64-byte buffer: [initial_hash(32) | expectations(32)]
    uchar buf[64];
    for (int i = 0; i < 32; i++) buf[i] = initial_hash[i];
    for (int i = 0; i < NUM_QUBITS; i++) {
        float scaled = expectations[i] * 32768.0f;
        int16_t fixed = (int16_t)(scaled >= 0.0f ? (scaled + 0.5f) : (scaled - 0.5f));
        buf[32 + i*2]     = (uchar)(fixed & 0xFF);
        buf[32 + i*2 + 1] = (uchar)((fixed >> 8) & 0xFF);
    }

    // Step 6: SHA-256 of 64-byte buffer
    SHA256Ctx ctx2;
    sha256_init(&ctx2);
    sha256_update(&ctx2, buf, 64);
    uchar final_hash[32];
    sha256_final(&ctx2, final_hash);

    // Step 7: Check if hash ≤ target (big-endian comparison)
    bool valid = true;
    for (int i = 0; i < 32; i++) {
        if (final_hash[i] < target[i]) break;
        if (final_hash[i] > target[i]) { valid = false; break; }
    }

    if (valid && found_flag[0] == 0) {
        uint old = atomic_cmpxchg(found_flag, 0u, 1u);
        if (old == 0) {
            output_nonce[0] = nonce;
            for (int i = 0; i < 32; i++) output_hash[i] = final_hash[i];
        }
    }
}

// ── Benchmark kernel (no target check, just compute hash) ───────────────────
__kernel void qhash_benchmark(
    __global const uchar* header,
    uint header_len,
    ulong base_nonce,
    __global uchar* output_hash,
    __global float2* state_vec_pool
)
{
    uint gid = get_global_id(0);
    ulong nonce = base_nonce + (ulong)gid;
    __global float2* state = state_vec_pool + (ulong)gid * STATE_SIZE;

    uchar hdr[80];
    for (uint i = 0; i < 80 && i < header_len; i++) hdr[i] = header[i];
    hdr[0] = (uchar)(nonce & 0xFF);
    hdr[1] = (uchar)((nonce >> 8) & 0xFF);
    hdr[2] = (uchar)((nonce >> 16) & 0xFF);
    hdr[3] = (uchar)((nonce >> 24) & 0xFF);

    SHA256Ctx ctx;
    sha256_init(&ctx);
    sha256_update(&ctx, hdr, 80);
    uchar initial_hash[32];
    sha256_final(&ctx, initial_hash);

    uchar nibbles[64];
    for (int i = 0; i < 32; i++) {
        nibbles[2*i]     = (initial_hash[i] >> 4) & 0xF;
        nibbles[2*i + 1] = initial_hash[i] & 0xF;
    }

    for (int i = 0; i < STATE_SIZE; i++) {
        state[i].x = 0.0f;
        state[i].y = 0.0f;
    }
    state[0].x = 1.0f;

    for (int l = 0; l < NUM_LAYERS; l++) {
        for (int i = 0; i < NUM_QUBITS; i++) {
            int idx = (2 * l * NUM_QUBITS + i) % 64;
            float angle = -(float)nibbles[idx] * PI / 16.0f;
            apply_ry(state, i, angle);
        }
        for (int i = 0; i < NUM_QUBITS; i++) {
            int idx = ((2 * l + 1) * NUM_QUBITS + i) % 64;
            float angle = -(float)nibbles[idx] * PI / 16.0f;
            apply_rz(state, i, angle);
        }
        for (int i = 0; i < NUM_QUBITS - 1; i++) {
            apply_cnot(state, i, i + 1);
        }
    }

    float expectations[NUM_QUBITS];
    for (int i = 0; i < NUM_QUBITS; i++) {
        expectations[i] = compute_expectation(state, i);
    }

    uchar buf[64];
    for (int i = 0; i < 32; i++) buf[i] = initial_hash[i];
    for (int i = 0; i < NUM_QUBITS; i++) {
        float scaled = expectations[i] * 32768.0f;
        int16_t fixed = (int16_t)(scaled >= 0.0f ? (scaled + 0.5f) : (scaled - 0.5f));
        buf[32 + i*2]     = (uchar)(fixed & 0xFF);
        buf[32 + i*2 + 1] = (uchar)((fixed >> 8) & 0xFF);
    }

    SHA256Ctx ctx2;
    sha256_init(&ctx2);
    sha256_update(&ctx2, buf, 64);
    uchar final_hash[32];
    sha256_final(&ctx2, final_hash);

    if (gid == 0) {
        for (int i = 0; i < 32; i++) output_hash[i] = final_hash[i];
    }
}
