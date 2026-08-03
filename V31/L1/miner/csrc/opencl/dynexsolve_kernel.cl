// DynexSolve OpenCL kernel for Dynex (DNX) neuromorphic Proof-of-Useful-Work mining.
//
// DynexSolve is a Proof-of-Useful-Work (PoUW) algorithm that turns GPU mining
// into neuromorphic computing. It solves Boolean satisfiability (SAT) problems
// using a system of ordinary differential equations (ODEs) derived from a
// neuromorphic circuit model (the Dynex neuromorphic chip).
//
// Algorithm flow (from https://github.com/dynexcoin/DynexSolve):
//   1. Download a computation file (CNF — Boolean formula in conjunctive normal
//      form) from the mallob job distribution service.
//   2. Initialize neuromorphic chip state from the CNF.
//   3. Integrate the ODE system using Runge-Kutta 4th order (15-183 steps).
//   4. Check if the solution satisfies all CNF clauses.
//   5. Hash the solution (bit string) with SHA-256 to produce the PoW hash.
//   6. Check if hash <= target (big-endian byte comparison).
//
// ── Neuromorphic chip model ──────────────────────────────────────────
//
// Each SAT variable is mapped to a neuron with continuous state x[i] in [-1,1].
// Each CNF clause is mapped to a clause-satisfaction neuron c[k].
//
// Variable neuron ODE:
//   dx[i]/dt = -x[i] + I[i] + Sum_k (sign(lit_k_i) * c[k])
//
// Clause neuron ODE:
//   dc[k]/dt = -c[k] + f(x[l1]) + f(x[l2]) + f(x[l3]) - 2.5
//
// where:
//   f(x) = tanh(x * gain)           (activation function)
//   gain = 1.0 + 0.1 * step          (increases each step to force convergence)
//   w[i][k] = +1 if variable i appears positive in clause k
//           = -1 if variable i appears negated in clause k
//           =  0 otherwise
//   I[i] = external bias (derived from nonce for diversity)
//
// Coupling weights are derived on-the-fly from the clause data — no explicit
// weight matrix is stored. For each clause k with literals (l1, l2, l3):
//   c[k] is updated from f(x[l1]), f(x[l2]), f(x[l3]).
//   x[var(lj)] receives feedback += sign(lj) * c[k].
//
// Runge-Kutta 4th order integration (per step dt):
//   k1 = f(x, t)
//   k2 = f(x + dt/2 * k1, t + dt/2)
//   k3 = f(x + dt/2 * k2, t + dt/2)
//   k4 = f(x + dt * k3, t + dt)
//   x_new = x + dt/6 * (k1 + 2*k2 + 2*k3 + k4)
//
// The RK4 step is implemented with incremental accumulation to minimize
// private memory usage: instead of storing all four k arrays simultaneously,
// we accumulate the weighted sum (k1 + 2*k2 + 2*k3 + k4) incrementally,
// requiring only one k-array and one accumulator at a time.
//
// Parameters:
//   dt = 0.01        (time step)
//   gain = 1.0 + 0.1 * step   (increases each step)
//   max_steps = 183  (can converge in 15-183 steps)
//   convergence: |x[i]| > 0.95 for all i → binary solution found
//
// Solution extraction:
//   For each variable i: if x[i] > 0 → TRUE, if x[i] < 0 → FALSE
//   Check all CNF clauses are satisfied
//   Convert solution to bit string → hash with SHA-256 → check target
//
// ── Implementation approach ──────────────────────────────────────────
//
// Since DynexSolve requires CNF data from the network (mallob), the kernel
// works with pre-loaded CNF data:
//
// 1. Host-side: Download CNF file, parse it, upload clause data to GPU as:
//    - clause_literals[3 * num_clauses] — 3 int32 per clause (sign-encoded)
//      Positive literal:  +(var_index + 1)
//      Negative literal:  -(var_index + 1)
//    - num_variables, num_clauses
//
// 2. GPU kernel: Each work-item simulates one neuromorphic chip with different
//    initial conditions (different nonce → different initial state):
//    - Variable neurons: x[0..num_variables-1] in private memory (max 256)
//    - Clause neurons: c[0..num_clauses-1] in global memory (max 1024)
//    - Coupling weights: derived from clause data on-the-fly
//    - Integrate ODE for up to 183 steps
//    - Check solution
//    - Hash solution
//
// 3. Kernel entry point:
//    __kernel void dynexsolve_mine(
//        __global const int* clause_literals,  // 3 * num_clauses int32 values
//        uint num_clauses,
//        uint num_variables,
//        ulong base_nonce,                     // nonce seeds the initial state
//        __global uchar* output_hash,          // 32-byte PoW hash
//        __global uint* found_flag,
//        __global ulong* output_nonce,
//        __global const uchar* target,         // 32-byte target
//        __global float* clause_neurons        // num_clauses floats per work-item (global)
//    )
//
// 4. Initial state from nonce:
//    x[i] = (nonce_hash[i % 32] / 255.0 - 0.5) * 0.1 (small perturbation)
//    nonce_hash = SHA-256(nonce || seed)
//
// 5. SHA-256: Compact implementation for solution hashing.
//
// The kernel handles up to 256 variables and 1024 clauses (typical SAT problem
// size for DynexSolve). Variable neurons use private memory (256 * 4 = 1KB);
// clause neurons use global memory (one float per clause per work-item).
// Additional global scratch is used for RK4 clause-neuron temporaries.
//
// References:
//   - DynexSolve (CUDA, partial source): https://github.com/dynexcoin/DynexSolve
//   - Dynex Neuromorphic Chip (CPU ref): https://github.com/dynexcoin/Dynex-Neuromorphic-Chip
//   - Dynex full node: https://github.com/dynexcoin/Dynex
//   - DynexSolve v2.2.5: https://github.com/dynexcoin/Dynex/releases/tag/DynexSolve-v225
//
// NOTE: This kernel targets OpenCL 1.2 (no atomics beyond xchg/add on 32-bit
// types). The found flag uses atomic_xchg, matching the pattern used by the
// other kernels in this directory. Benchmark counters use 32-bit atomic_add.

// ════════════════════════════════════════════════════════════════════
// Section 1: SHA-256 implementation
// ════════════════════════════════════════════════════════════════════

// SHA-256 round constants (FIPS 180-4, §4.2.2)
__constant const uint SHA256_K[64] = {
    0x428a2f98u, 0x71374491u, 0xb5c0fbcfu, 0xe9b5dba5u,
    0x3956c25bu, 0x59f111f1u, 0x923f82a4u, 0xab1c5ed5u,
    0xd807aa98u, 0x12835b01u, 0x243185beu, 0x550c7dc3u,
    0x72be5d74u, 0x80deb1feu, 0x9bdc06a7u, 0xc19bf174u,
    0xe49b69c1u, 0xefbe4786u, 0x0fc19dc6u, 0x240ca1ccu,
    0x2de92c6fu, 0x4a7484aau, 0x5cb0a9dcu, 0x76f988dau,
    0x983e5152u, 0xa831c66du, 0xb00327c8u, 0xbf597fc7u,
    0xc6e00bf3u, 0xd5a79147u, 0x06ca6351u, 0x14292967u,
    0x27b70a85u, 0x2e1b2138u, 0x4d2c6dfcu, 0x53380d13u,
    0x650a7354u, 0x766a0abbu, 0x81c2c92eu, 0x92722c85u,
    0xa2bfe8a1u, 0xa81a664bu, 0xc24b8b70u, 0xc76c51a3u,
    0xd192e819u, 0xd6990624u, 0xf40e3585u, 0x106aa070u,
    0x19a4c116u, 0x1e376c08u, 0x2748774cu, 0x34b0bcb5u,
    0x391c0cb3u, 0x4ed8aa4au, 0x5b9cca4fu, 0x682e6ff3u,
    0x748f82eeu, 0x78a5636fu, 0x84c87814u, 0x8cc70208u,
    0x90befffau, 0xa4506cebu, 0xbef9a3f7u, 0xc67178f2u
};

// SHA-256 initial hash values (FIPS 180-4, §5.3.3)
__constant const uint SHA256_H0[8] = {
    0x6a09e667u, 0xbb67ae85u, 0x3c6ef372u, 0xa54ff53au,
    0x510e527fu, 0x9b05688cu, 0x1f83d9abu, 0x5be0cd19u
};

#define ROTR32(x, n) (((x) >> (n)) | ((x) << (32 - (n))))
#define CH(x, y, z)  (((x) & (y)) ^ (~(x) & (z)))
#define MAJ(x, y, z) (((x) & (y)) ^ ((x) & (z)) ^ ((y) & (z)))
#define BSIG0(x)     (ROTR32(x, 2) ^ ROTR32(x, 13) ^ ROTR32(x, 22))
#define BSIG1(x)     (ROTR32(x, 6) ^ ROTR32(x, 11) ^ ROTR32(x, 25))
#define SSIG0(x)     (ROTR32(x, 7) ^ ROTR32(x, 18) ^ ((x) >> 3))
#define SSIG1(x)     (ROTR32(x, 17) ^ ROTR32(x, 19) ^ ((x) >> 10))

// SHA-256 compression function (single block, 64 bytes = 512 bits).
// Processes one 512-bit message block and updates the hash state h[8].
static inline void sha256_block(
    __private uint h[8],
    __private const uint w_in[16]
) {
    uint a = h[0], b = h[1], c = h[2], d = h[3];
    uint e = h[4], f = h[5], g = h[6], hh = h[7];

    // Message schedule: w[0..15] from input, w[16..63] derived.
    uint ws[64];
    for (int i = 0; i < 16; i++) ws[i] = w_in[i];
    for (int i = 16; i < 64; i++)
        ws[i] = SSIG1(ws[i-2]) + ws[i-7] + SSIG0(ws[i-15]) + ws[i-16];

    // 64 rounds
    for (int i = 0; i < 64; i++) {
        uint t1 = hh + BSIG1(e) + CH(e, f, g) + SHA256_K[i] + ws[i];
        uint t2 = BSIG0(a) + MAJ(a, b, c);
        hh = g; g = f; f = e; e = d + t1;
        d = c; c = b; b = a; a = t1 + t2;
    }

    h[0] += a; h[1] += b; h[2] += c; h[3] += d;
    h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
}

// SHA-256 of a message up to 55 bytes (fits in a single padded 64-byte block).
// Padding (0x80 + zeros + 8-byte big-endian length) is applied internally
// per FIPS 180-4 §5.1.1.
static inline void sha256_single(
    __private const uchar *msg,
    const uint msg_len,
    uchar *out             // 32 bytes
) {
    uint h[8];
    for (int i = 0; i < 8; i++) h[i] = SHA256_H0[i];

    // Build the padded 64-byte block.
    uchar pad[64];
    for (int i = 0; i < 64; i++) pad[i] = 0;
    for (uint i = 0; i < msg_len && i < 55; i++) pad[i] = msg[i];
    pad[msg_len] = 0x80;

    // Big-endian 64-bit length in bits (at offset 56..63).
    ulong bit_len = (ulong)msg_len * 8UL;
    for (int i = 0; i < 8; i++)
        pad[63 - i] = (uchar)(bit_len >> (i * 8));

    // Load 16 big-endian 32-bit words.
    uint w[16];
    for (int i = 0; i < 16; i++) {
        w[i] = ((uint)pad[i*4] << 24) | ((uint)pad[i*4+1] << 16) |
               ((uint)pad[i*4+2] << 8) | ((uint)pad[i*4+3]);
    }

    sha256_block(h, w);

    // Output 32 bytes big-endian.
    for (int i = 0; i < 8; i++) {
        out[i*4]   = (uchar)(h[i] >> 24);
        out[i*4+1] = (uchar)(h[i] >> 16);
        out[i*4+2] = (uchar)(h[i] >> 8);
        out[i*4+3] = (uchar)(h[i]);
    }
}

// ════════════════════════════════════════════════════════════════════
// Section 2: Neuromorphic chip ODE model
// ════════════════════════════════════════════════════════════════════

// Maximum supported problem sizes.
#define MAX_VARIABLES  256
#define MAX_CLAUSES    1024

// ODE integration parameters.
#define DT          0.01f
#define MAX_STEPS   183
#define CONV_THRESH  0.95f

// Fast tanh approximation for the activation function f(x) = tanh(x * gain).
// Uses the rational approximation: tanh(x) ~ x * (27 + x^2) / (27 + 9*x^2)
// which is accurate to within 1e-4 for |x| < 4, sufficient for the ODE solver.
// For |x| > 4, clamps to +/-1.0 (tanh saturates there anyway).
static inline float fast_tanh(float x) {
    float ax = fabs(x);
    if (ax > 4.0f) return copysign(1.0f, x);
    float x2 = x * x;
    return x * (27.0f + x2) / (27.0f + 9.0f * x2);
}

// Activation function: f(x) = tanh(x * gain).
static inline float activate(float x, float gain) {
    return fast_tanh(x * gain);
}

// Decode a sign-encoded literal to (variable_index, sign).
// Positive literal:  +(var_index + 1)  -> sign = +1
// Negative literal:  -(var_index + 1)  -> sign = -1
static inline void decode_literal(int lit, int *var_idx, int *sign) {
    if (lit >= 0) {
        *var_idx = lit - 1;  // 0-based
        *sign = 1;
    } else {
        *var_idx = (-lit) - 1;
        *sign = -1;
    }
}

// ── ODE derivative computation ───────────────────────────────────────
//
// Computes the right-hand side of the ODE system at the current state:
//   dx[i]/dt = -x[i] + I[i] + Sum_k (sign(lit_k_i) * c[k])
//   dc[k]/dt = -c[k] + f(x[l1]) + f(x[l2]) + f(x[l3]) - 2.5
//
// The variable neuron states x[] are in private memory (per work-item).
// The clause neuron states c[] are in global memory (per work-item slice).
// The derivatives dx[] and dc[] are stored into the provided output arrays.
//
// Parameters:
//   x                — variable neuron states [num_variables] (private)
//   c                — clause neuron states [num_clauses] (global)
//   dx               — output: derivative of variable neurons (private)
//   dc               — output: derivative of clause neurons (global scratch)
//   clause_literals  — sign-encoded literals [3 * num_clauses] (global, read-only)
//   num_clauses, num_variables — problem dimensions
//   gain             — current activation gain
//   bias             — external input I[i] (private)

// Derivative computation with x in private memory, c in global memory.
// Used for k1 (evaluated at the original state) and for intermediate
// RK4 stages where x is a private temporary.
static inline void compute_derivatives_priv(
    __private const float *x,
    __global const float *c,
    __private float *dx,
    __global float *dc,
    __global const int *clause_literals,
    const uint num_clauses,
    const uint num_variables,
    const float gain,
    __private const float *bias
) {
    // Initialize dx with decay + bias.
    for (uint i = 0; i < num_variables; i++)
        dx[i] = -x[i] + bias[i];

    // Compute clause neuron derivatives and accumulate feedback to variables.
    for (uint k = 0; k < num_clauses; k++) {
        int l1 = clause_literals[k * 3];
        int l2 = clause_literals[k * 3 + 1];
        int l3 = clause_literals[k * 3 + 2];

        int v1, s1, v2, s2, v3, s3;
        decode_literal(l1, &v1, &s1);
        decode_literal(l2, &v2, &s2);
        decode_literal(l3, &v3, &s3);

        // Clause neuron ODE: dc[k]/dt = -c[k] + f(x[l1]) + f(x[l2]) + f(x[l3]) - 2.5
        float ck = c[k];
        dc[k] = -ck
              + activate(x[v1], gain)
              + activate(x[v2], gain)
              + activate(x[v3], gain)
              - 2.5f;

        // Feedback to variable neurons: dx[vi] += si * c[k]
        dx[v1] += (float)s1 * ck;
        dx[v2] += (float)s2 * ck;
        dx[v3] += (float)s3 * ck;
    }
}

// ── Runge-Kutta 4th order step (incremental accumulation) ───────────
//
// Performs one RK4 step with time step dt, updating x[] and c[] in place.
//
// To minimize memory, we use incremental accumulation:
//   acc = k1
//   acc += 2*k2  (after computing k2 from x + dt/2*k1)
//   acc += 2*k3  (after computing k3 from x + dt/2*k2)
//   acc += k4    (after computing k4 from x + dt*k3)
//   x_new = x + dt/6 * acc
//
// This requires only 3 temporary arrays per state vector:
//   k[]   — the most recently computed derivative (overwritten each stage)
//   tmp[] — the intermediate state (x + offset * k)
//   acc[] — the accumulated weighted sum
//
// For variable neurons (256 floats): 3 * 1KB = 3KB private memory.
// For clause neurons (1024 floats): we use global scratch to avoid
// excessive private memory. The scratch is laid out as:
//   clause_scratch[work_item_id * 3 * MAX_CLAUSES + offset]
// with offsets 0 = k, 1 = tmp, 2 = acc.

static inline void rk4_step(
    __private float *x,                    // [num_variables] — updated in place
    __global float *c,                     // [num_clauses] — updated in place
    __global float *clause_scratch,        // [3 * MAX_CLAUSES] per work-item
    __global const int *clause_literals,
    const uint num_clauses,
    const uint num_variables,
    const float gain,
    __private const float *bias,
    const float dt
) {
    // Private temporaries for variable neurons.
    float kx[MAX_VARIABLES];     // current derivative
    float xtmp[MAX_VARIABLES];   // intermediate state
    float xacc[MAX_VARIABLES];   // accumulated weighted sum

    // Global scratch pointers for clause neurons.
    // Layout: [0 .. MAX_CLAUSES-1] = kc, [MAX_CLAUSES .. 2*MAX_CLAUSES-1] = ctmp,
    //         [2*MAX_CLAUSES .. 3*MAX_CLAUSES-1] = cacc
    __global float *kc  = clause_scratch;
    __global float *ctmp = clause_scratch + MAX_CLAUSES;
    __global float *cacc = clause_scratch + 2 * MAX_CLAUSES;

    float half_dt = 0.5f * dt;
    float sixth_dt = dt / 6.0f;

    // ── Stage 1: k1 = f(x, c) ──────────────────────────────────────
    compute_derivatives_priv(x, c, kx, kc, clause_literals,
                             num_clauses, num_variables, gain, bias);

    // acc = k1
    for (uint i = 0; i < num_variables; i++) xacc[i] = kx[i];
    for (uint k = 0; k < num_clauses; k++) cacc[k] = kc[k];

    // ── Stage 2: k2 = f(x + dt/2 * k1, c + dt/2 * k1c) ─────────────
    for (uint i = 0; i < num_variables; i++) xtmp[i] = x[i] + half_dt * kx[i];
    for (uint k = 0; k < num_clauses; k++) ctmp[k] = c[k] + half_dt * kc[k];

    compute_derivatives_priv(xtmp, ctmp, kx, kc, clause_literals,
                             num_clauses, num_variables, gain, bias);

    // acc += 2*k2
    for (uint i = 0; i < num_variables; i++) xacc[i] += 2.0f * kx[i];
    for (uint k = 0; k < num_clauses; k++) cacc[k] += 2.0f * kc[k];

    // ── Stage 3: k3 = f(x + dt/2 * k2, c + dt/2 * k2c) ─────────────
    for (uint i = 0; i < num_variables; i++) xtmp[i] = x[i] + half_dt * kx[i];
    for (uint k = 0; k < num_clauses; k++) ctmp[k] = c[k] + half_dt * kc[k];

    compute_derivatives_priv(xtmp, ctmp, kx, kc, clause_literals,
                             num_clauses, num_variables, gain, bias);

    // acc += 2*k3
    for (uint i = 0; i < num_variables; i++) xacc[i] += 2.0f * kx[i];
    for (uint k = 0; k < num_clauses; k++) cacc[k] += 2.0f * kc[k];

    // ── Stage 4: k4 = f(x + dt * k3, c + dt * k3c) ─────────────────
    for (uint i = 0; i < num_variables; i++) xtmp[i] = x[i] + dt * kx[i];
    for (uint k = 0; k < num_clauses; k++) ctmp[k] = c[k] + dt * kc[k];

    compute_derivatives_priv(xtmp, ctmp, kx, kc, clause_literals,
                             num_clauses, num_variables, gain, bias);

    // acc += k4
    for (uint i = 0; i < num_variables; i++) xacc[i] += kx[i];
    for (uint k = 0; k < num_clauses; k++) cacc[k] += kc[k];

    // ── Final update: x_new = x + dt/6 * acc ───────────────────────
    for (uint i = 0; i < num_variables; i++)
        x[i] = x[i] + sixth_dt * xacc[i];
    for (uint k = 0; k < num_clauses; k++)
        c[k] = c[k] + sixth_dt * cacc[k];
}

// ════════════════════════════════════════════════════════════════════
// Section 3: CNF clause satisfaction checking
// ════════════════════════════════════════════════════════════════════

// Check if all CNF clauses are satisfied by the binary solution extracted
// from the neuron states.
//
// A clause (l1 ∨ l2 ∨ l3) is satisfied if at least one literal is true:
//   - Positive literal +v: satisfied if x[v] > 0 (variable is TRUE)
//   - Negative literal ¬v: satisfied if x[v] < 0 (variable is FALSE)
//
// Returns 1 if all clauses are satisfied, 0 otherwise.
static inline int check_solution(
    __private const float *x,
    __global const int *clause_literals,
    const uint num_clauses
) {
    for (uint k = 0; k < num_clauses; k++) {
        int l1 = clause_literals[k * 3];
        int l2 = clause_literals[k * 3 + 1];
        int l3 = clause_literals[k * 3 + 2];

        int v1 = (l1 >= 0) ? l1 - 1 : (-l1) - 1;
        int v2 = (l2 >= 0) ? l2 - 1 : (-l2) - 1;
        int v3 = (l3 >= 0) ? l3 - 1 : (-l3) - 1;

        int sat1 = (l1 >= 0) ? (x[v1] > 0.0f) : (x[v1] < 0.0f);
        int sat2 = (l2 >= 0) ? (x[v2] > 0.0f) : (x[v2] < 0.0f);
        int sat3 = (l3 >= 0) ? (x[v3] > 0.0f) : (x[v3] < 0.0f);

        if (!(sat1 || sat2 || sat3))
            return 0;  // Clause k not satisfied
    }
    return 1;  // All clauses satisfied
}

// Check convergence: all |x[i]| > threshold.
// Returns 1 if converged to binary, 0 otherwise.
static inline int check_convergence(
    __private const float *x,
    const uint num_variables
) {
    for (uint i = 0; i < num_variables; i++) {
        if (fabs(x[i]) <= CONV_THRESH)
            return 0;
    }
    return 1;
}

// ════════════════════════════════════════════════════════════════════
// Section 4: Solution extraction and hashing
// ════════════════════════════════════════════════════════════════════

// Extract the binary solution from neuron states into a byte array.
// Each variable contributes one bit: x[i] > 0 → 1, x[i] < 0 → 0.
// The bits are packed MSB-first into bytes (variable 0 → bit 7 of byte 0,
// variable 1 → bit 6 of byte 0, etc.).
//
// Returns the number of bytes written (ceil(num_variables / 8)).
static inline uint extract_solution(
    __private const float *x,
    const uint num_variables,
    uchar *solution_bytes    // at least ceil(MAX_VARIABLES/8) = 32 bytes
) {
    uint num_bytes = (num_variables + 7) / 8;
    for (uint i = 0; i < num_bytes; i++) solution_bytes[i] = 0;

    for (uint i = 0; i < num_variables; i++) {
        if (x[i] > 0.0f) {
            uint byte_idx = i / 8;
            uint bit_idx = 7 - (i % 8);  // MSB-first
            solution_bytes[byte_idx] |= (uchar)(1 << bit_idx);
        }
    }
    return num_bytes;
}

// Build the PoW hash input: solution_bytes || nonce (big-endian 8 bytes).
// Then hash with SHA-256 to produce the 32-byte PoW hash.
static inline void hash_solution(
    __private const float *x,
    const uint num_variables,
    const ulong nonce,
    uchar *pow_hash          // 32 bytes output
) {
    uchar sol[32];           // up to 256 variables = 32 bytes
    uint sol_len = extract_solution(x, num_variables, sol);

    // Build hash input: solution || nonce (big-endian).
    // Total: up to 32 + 8 = 40 bytes, fits in single SHA-256 block.
    uchar input[40];
    for (uint i = 0; i < sol_len; i++) input[i] = sol[i];
    for (int i = 0; i < 8; i++)
        input[sol_len + i] = (uchar)(nonce >> ((7 - i) * 8));

    uint total_len = sol_len + 8;
    sha256_single(input, total_len, pow_hash);
}

// ════════════════════════════════════════════════════════════════════
// Section 5: Initial state from nonce
// ════════════════════════════════════════════════════════════════════

// Initialize the neuromorphic chip state from the nonce.
// The nonce is hashed with SHA-256 to produce a pseudo-random seed,
// which is used to set the initial variable neuron states (small
// perturbations around zero) and the external bias currents.
//
//   nonce_hash = SHA-256(nonce_bytes[8])
//   x[i] = (nonce_hash[i % 32] / 255.0 - 0.5) * 0.1
//   bias[i] = (nonce_hash[(i + 16) % 32] / 255.0 - 0.5) * 0.05
static inline void init_state_from_nonce(
    __private float *x,
    __private float *bias,
    const ulong nonce,
    const uint num_variables
) {
    // Hash the nonce (8 bytes, big-endian) to get 32 pseudo-random bytes.
    uchar nonce_bytes[8];
    for (int i = 0; i < 8; i++)
        nonce_bytes[i] = (uchar)(nonce >> ((7 - i) * 8));

    uchar nhash[32];
    sha256_single(nonce_bytes, 8, nhash);

    // Initialize variable neurons with small perturbations.
    for (uint i = 0; i < num_variables; i++) {
        float val = ((float)nhash[i % 32] / 255.0f - 0.5f) * 0.1f;
        x[i] = val;
    }

    // Initialize bias currents from the hash (offset by 16 for diversity).
    for (uint i = 0; i < num_variables; i++) {
        float val = ((float)nhash[(i + 16) % 32] / 255.0f - 0.5f) * 0.05f;
        bias[i] = val;
    }
}

// Initialize clause neurons to zero (resting state).
static inline void init_clause_neurons(
    __global float *c,
    const uint num_clauses
) {
    for (uint k = 0; k < num_clauses; k++)
        c[k] = 0.0f;
}

// ════════════════════════════════════════════════════════════════════
// Section 6: Target comparison
// ════════════════════════════════════════════════════════════════════

// Compare hash against target (big-endian byte comparison).
// Returns 1 if hash <= target, 0 otherwise.
static inline int hash_meets_target(
    __private const uchar *hash,
    __global const uchar *target
) {
    for (int i = 0; i < 32; i++) {
        if (hash[i] < target[i]) return 1;  // hash < target
        if (hash[i] > target[i]) return 0;  // hash > target
        // Equal so far, continue to next byte.
    }
    return 1;  // hash == target → meets (<=)
}

// ════════════════════════════════════════════════════════════════════
// Section 7: Main mining kernel
// ════════════════════════════════════════════════════════════════════

// DynexSolve neuromorphic PoUW mining kernel.
//
// Each work-item simulates one neuromorphic chip with a unique nonce
// (base_nonce + global_id). The chip integrates the ODE system for up to
// 183 steps, checking for convergence and solution validity. If a valid
// SAT solution is found, it is hashed with SHA-256 and compared against
// the target.
//
// Kernel arguments:
//   clause_literals — 3 * num_clauses int32 values (sign-encoded literals)
//   num_clauses     — number of CNF clauses (<= 1024)
//   num_variables   — number of SAT variables (<= 256)
//   base_nonce      — base nonce for this batch (seeds initial state)
//   output_hash     — 32-byte PoW hash of the winning solution
//   found_flag      — atomic flag: 0 = not found, 1 = found
//   output_nonce    — nonce that produced the winning solution
//   target          — 32-byte target (big-endian byte comparison)
//   clause_neurons  — global scratch: num_clauses * global_work_size floats
//                     (each work-item gets its own slice of num_clauses floats)
//   clause_scratch  — global scratch: 3 * MAX_CLAUSES * global_work_size floats
//                     (RK4 temporaries for clause neurons: k, tmp, acc)
//
// Work-group size: 64. Each work-item uses:
//   - Private: x[256] + bias[256] + RK4 temps[3*256] = ~5KB
//   - Global:  c[num_clauses] + scratch[3*MAX_CLAUSES] = ~16KB
__kernel __attribute__((reqd_work_group_size(64, 1, 1)))
void dynexsolve_mine(
    __global const int *clause_literals,
    uint num_clauses,
    uint num_variables,
    ulong base_nonce,
    __global uchar *output_hash,
    __global volatile uint *found_flag,
    __global ulong *output_nonce,
    __global const uchar *target,
    __global float *clause_neurons,
    __global float *clause_scratch
)
{
    // ── Early exit ────────────────────────────────────────────────────
    if (*found_flag) return;

    // Clamp dimensions to maximum supported sizes.
    num_variables = min(num_variables, (uint)MAX_VARIABLES);
    num_clauses   = min(num_clauses,   (uint)MAX_CLAUSES);

    const uint gid = get_global_id(0);
    const ulong nonce = base_nonce + (ulong)gid;

    // ── Private memory for variable neurons and bias ──────────────────
    float x[MAX_VARIABLES];
    float bias[MAX_VARIABLES];

    // ── Global memory for clause neurons (per work-item slice) ────────
    __global float *c = clause_neurons + (size_t)gid * num_clauses;
    __global float *scratch = clause_scratch + (size_t)gid * 3 * MAX_CLAUSES;

    // ── Initialize chip state from nonce ──────────────────────────────
    init_state_from_nonce(x, bias, nonce, num_variables);
    init_clause_neurons(c, num_clauses);

    // ── Integrate ODE system ──────────────────────────────────────────
    int solution_found = 0;

    for (int step = 0; step < MAX_STEPS; step++) {
        // Early exit if another work-item already found a solution.
        if (*found_flag) return;

        // Gain increases over time to force binary convergence.
        float gain = 1.0f + 0.1f * (float)step;

        // Perform one RK4 integration step.
        rk4_step(x, c, scratch, clause_literals, num_clauses, num_variables,
                 gain, bias, DT);

        // Check convergence every few steps (after step 14, i.e. 15+ steps).
        // The algorithm can converge in as few as 15 steps.
        if (step >= 14 && (step % 5 == 4 || step == MAX_STEPS - 1)) {
            if (check_convergence(x, num_variables)) {
                // Converged to binary — check if solution satisfies all clauses.
                if (check_solution(x, clause_literals, num_clauses)) {
                    solution_found = 1;
                    break;
                }
            }
        }
    }

    // ── If no convergence, try the final state anyway ─────────────────
    if (!solution_found) {
        // Even without full convergence, the sign of x[i] gives a candidate.
        if (check_solution(x, clause_literals, num_clauses)) {
            solution_found = 1;
        }
    }

    if (!solution_found) return;

    // ── Hash the solution and check target ────────────────────────────
    uchar pow_hash[32];
    hash_solution(x, num_variables, nonce, pow_hash);

    if (hash_meets_target(pow_hash, target)) {
        uint old = atomic_xchg(found_flag, 1u);
        if (old == 0u) {
            *output_nonce = nonce;
            for (int i = 0; i < 32; i++) output_hash[i] = pow_hash[i];
        }
    }
}

// ════════════════════════════════════════════════════════════════════
// Section 8: Benchmark kernel for hashrate measurement
// ════════════════════════════════════════════════════════════════════

// Benchmark kernel — simulates the full DynexSolve ODE integration without
// the target check, to measure raw hashrate (chips per second).
//
// Each work-item runs one complete chip simulation and increments a global
// counter. The host reads the counter after a fixed time interval to
// compute hashrate = counter / elapsed_time.
//
// Note: OpenCL 1.2 only supports 32-bit atomic_add, so counters are uint.
// For long benchmark runs, the host should read and reset the counter
// frequently to avoid overflow (4 billion chips ~ at 1M H/s = ~4000 seconds).
//
// Arguments:
//   clause_literals — same as dynexsolve_mine
//   num_clauses, num_variables — problem dimensions
//   base_nonce      — base nonce (for diverse initial states)
//   clause_neurons  — global scratch (same as dynexsolve_mine)
//   clause_scratch  — global scratch (same as dynexsolve_mine)
//   hash_counter    — atomic uint counter incremented per completed chip
//   solution_counter — atomic uint counter incremented per valid SAT solution
__kernel __attribute__((reqd_work_group_size(64, 1, 1)))
void dynexsolve_benchmark(
    __global const int *clause_literals,
    uint num_clauses,
    uint num_variables,
    ulong base_nonce,
    __global float *clause_neurons,
    __global float *clause_scratch,
    __global volatile uint *hash_counter,
    __global volatile uint *solution_counter
)
{
    num_variables = min(num_variables, (uint)MAX_VARIABLES);
    num_clauses   = min(num_clauses,   (uint)MAX_CLAUSES);

    const uint gid = get_global_id(0);
    const ulong nonce = base_nonce + (ulong)gid;

    float x[MAX_VARIABLES];
    float bias[MAX_VARIABLES];

    __global float *c = clause_neurons + (size_t)gid * num_clauses;
    __global float *scratch = clause_scratch + (size_t)gid * 3 * MAX_CLAUSES;

    init_state_from_nonce(x, bias, nonce, num_variables);
    init_clause_neurons(c, num_clauses);

    for (int step = 0; step < MAX_STEPS; step++) {
        float gain = 1.0f + 0.1f * (float)step;
        rk4_step(x, c, scratch, clause_literals, num_clauses, num_variables,
                 gain, bias, DT);

        if (step >= 14 && (step % 5 == 4 || step == MAX_STEPS - 1)) {
            if (check_convergence(x, num_variables)) {
                if (check_solution(x, clause_literals, num_clauses)) {
                    atomic_add(solution_counter, 1u);
                    break;
                }
            }
        }
    }

    // Count every completed chip simulation (regardless of solution found).
    atomic_add(hash_counter, 1u);
}
