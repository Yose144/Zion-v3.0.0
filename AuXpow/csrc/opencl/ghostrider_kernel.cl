// =============================================================================
// GhostRider OpenCL kernel for Raptoreum (RTM) GPU mining.
//
// This file is the MAIN kernel entry point. It expects to be concatenated
// AFTER ghostrider_sph.cl (15 SPH core hash algorithms) and ghostrider_cn.cl
// (CryptoNight implementation with AES + extra hashes).
//
// GhostRider algorithm:
//   1. Select 15 core algos + 14 CN algos from header bytes 4-67
//   2. 18-step hash chain:
//      core[0..4] → CN[0] → core[5..9] → CN[1] → core[10..14] → CN[2]
//   3. After each CN step: zero bytes 8-31 of the 64-byte hash
//   4. First step uses 80-byte input, subsequent steps use 64-byte hash
//   5. Output: first 32 bytes of final hash
//
// Block header layout (80 bytes):
//   bytes 0-3:   version
//   bytes 4-35:  previous block hash
//   bytes 36-67: merkle root
//   bytes 68-71: timestamp
//   bytes 72-75: bits (difficulty target)
//   bytes 76-79: nonce (miner varies this)
// =============================================================================

// ── Algorithm selection (Fisher-Yates style from header nibbles) ────────────

inline void select_algo(uchar nibble, __private bool* selectedAlgos,
                        __private uchar* selectedIndex, int algoCount,
                        __private int* currentCount) {
    uchar algoDigit = (nibble & 0x0F) % algoCount;
    if (!selectedAlgos[algoDigit]) {
        selectedAlgos[algoDigit] = true;
        selectedIndex[currentCount[0]] = algoDigit;
        currentCount[0] = currentCount[0] + 1;
    }
    algoDigit = (nibble >> 4) % algoCount;
    if (!selectedAlgos[algoDigit]) {
        selectedAlgos[algoDigit] = true;
        selectedIndex[currentCount[0]] = algoDigit;
        currentCount[0] = currentCount[0] + 1;
    }
}

inline void get_algo_string(__private const uchar* mem, uint size,
                            __private uchar* selectedAlgoOutput, int algoCount) {
    uint len = size / 2;
    __private bool selectedAlgo[15]; // max 15 algos
    for (int z = 0; z < algoCount; z++) {
        selectedAlgo[z] = false;
    }
    int selectedCount = 0;
    for (uint i = 0; i < len; i++) {
        select_algo(mem[i], selectedAlgo, selectedAlgoOutput, algoCount, &selectedCount);
        if (selectedCount == algoCount) {
            break;
        }
    }
    if (selectedCount < algoCount) {
        for (uchar i = 0; i < algoCount; i++) {
            if (!selectedAlgo[i]) {
                selectedAlgoOutput[selectedCount] = i;
                selectedCount++;
            }
        }
    }
}

// ── Core hash dispatch ──────────────────────────────────────────────────────

inline void core_hash_dispatch(int algo, hash_t* hash, uint size) {
    switch (algo) {
        case 0:  gr_core_0(hash, size); break;
        case 1:  gr_core_1(hash, size); break;
        case 2:  gr_core_2(hash, size); break;
        case 3:  gr_core_3(hash, size); break;
        case 4:  gr_core_4(hash, size); break;
        case 5:  gr_core_5(hash, size); break;
        case 6:  gr_core_6(hash, size); break;
        case 7:  gr_core_7(hash, size); break;
        case 8:  gr_core_8(hash, size); break;
        case 9:  gr_core_9(hash, size); break;
        case 10: gr_core_10(hash, size); break;
        case 11: gr_core_11(hash, size); break;
        case 12: gr_core_12(hash, size); break;
        case 13: gr_core_13(hash, size); break;
        case 14: gr_core_14(hash, size); break;
        default: break; // algo=16: skip
    }
}

// ── Main GhostRider mining kernel ───────────────────────────────────────────

__kernel void ghostrider_mine(
    __global const uchar* header,
    uint header_len,
    ulong base_nonce,
    __global uchar* output_hash,
    __global uint* found_flag,
    __global ulong* output_nonce,
    __global const uchar* target,
    __global uchar* scratchpad_pool  // max 2MB per work-item
)
{
    uint gid = get_global_id(0);

    // Populate AES lookup tables in local memory (shared across work-group)
    __local uint AES0[256], AES1[256], AES2[256], AES3[256];
    cn_populate_aes_tables(AES0, AES1, AES2, AES3);

    if (gid == 0) found_flag[0] = 0;
    barrier(CLK_GLOBAL_MEM_FENCE);

    ulong nonce = base_nonce + (ulong)gid;

    // Each work-item gets its own scratchpad (max 2MB for CNFast)
    __global uchar* scratchpad = scratchpad_pool + (ulong)gid * 2097152;

    // Build 80-byte header with nonce at bytes 76-79
    hash_t hash;
    for (uint i = 0; i < 80 && i < header_len; i++) {
        hash.h1[i] = header[i];
    }
    // Set nonce at bytes 76-79 (little-endian)
    hash.h1[76] = (uchar)(nonce & 0xFF);
    hash.h1[77] = (uchar)((nonce >> 8) & 0xFF);
    hash.h1[78] = (uchar)((nonce >> 16) & 0xFF);
    hash.h1[79] = (uchar)((nonce >> 24) & 0xFF);

    // Select algorithms from header bytes 4-67 (prevhash + merkle root)
    __private uchar selectedAlgo[15];
    __private uchar selectedCNAlgo[14];
    get_algo_string(&hash.h1[4], 64, selectedAlgo, 15);
    get_algo_string(&hash.h1[4], 64, selectedCNAlgo, 14);

    // Execute 18-step hash chain
    // Steps 0-4: core algos (input = 80-byte header for step 0, 64-byte hash for rest)
    // Step 5: CN[0], then zero bytes 8-31
    // Steps 6-10: core algos
    // Step 11: CN[1], then zero bytes 8-31
    // Steps 12-16: core algos
    // Step 17: CN[2], then zero bytes 8-31

    uint size = 80;  // First step uses full 80-byte header

    // Steps 0-4: core[0..4]
    for (int i = 0; i < 5; i++) {
        core_hash_dispatch(selectedAlgo[i], &hash, size);
        size = 64;  // subsequent steps use 64-byte hash
    }

    // Step 5: CN[0]
    {
        uchar cn_out[32];
        cn_dispatch(selectedCNAlgo[0], hash.h1, size, cn_out, scratchpad,
                    AES0, AES1, AES2, AES3);
        // Copy CN output to hash (first 32 bytes)
        for (int j = 0; j < 32; j++) hash.h1[j] = cn_out[j];
        // Zero bytes 32-63 (C: memset(&hash[8], 0, 32) where hash is uint32_t[16])
        for (int j = 32; j < 64; j++) hash.h1[j] = 0;
    }

    // Steps 6-10: core[5..9]
    for (int i = 5; i < 10; i++) {
        core_hash_dispatch(selectedAlgo[i], &hash, size);
    }

    // Step 11: CN[1]
    {
        uchar cn_out[32];
        cn_dispatch(selectedCNAlgo[1], hash.h1, size, cn_out, scratchpad,
                    AES0, AES1, AES2, AES3);
        for (int j = 0; j < 32; j++) hash.h1[j] = cn_out[j];
        for (int j = 32; j < 64; j++) hash.h1[j] = 0;
    }

    // Steps 12-16: core[10..14]
    for (int i = 10; i < 15; i++) {
        core_hash_dispatch(selectedAlgo[i], &hash, size);
    }

    // Step 17: CN[2] (final)
    {
        uchar cn_out[32];
        cn_dispatch(selectedCNAlgo[2], hash.h1, size, cn_out, scratchpad,
                    AES0, AES1, AES2, AES3);
        for (int j = 0; j < 32; j++) hash.h1[j] = cn_out[j];
        // Final CN: zeroing happens for ALL CN steps including the last one
        for (int j = 32; j < 64; j++) hash.h1[j] = 0;
    }

    // Check target (first 32 bytes of hash vs target, big-endian comparison)
    bool valid = true;
    for (int i = 0; i < 32; i++) {
        if (hash.h1[i] < target[i]) break;
        if (hash.h1[i] > target[i]) { valid = false; break; }
    }

    if (valid && found_flag[0] == 0) {
        uint old = atomic_cmpxchg(found_flag, 0u, 1u);
        if (old == 0) {
            output_nonce[0] = nonce;
            for (int i = 0; i < 32; i++) output_hash[i] = hash.h1[i];
        }
    }
}

// ── Benchmark kernel (no target check, just compute hash for gid=0) ─────────

__kernel void ghostrider_benchmark(
    __global const uchar* header,
    uint header_len,
    ulong base_nonce,
    __global uchar* output_hash,
    __global uchar* scratchpad_pool
)
{
    uint gid = get_global_id(0);

    __local uint AES0[256], AES1[256], AES2[256], AES3[256];
    cn_populate_aes_tables(AES0, AES1, AES2, AES3);

    ulong nonce = base_nonce + (ulong)gid;
    __global uchar* scratchpad = scratchpad_pool + (ulong)gid * 2097152;

    hash_t hash;
    for (uint i = 0; i < 80 && i < header_len; i++) {
        hash.h1[i] = header[i];
    }
    hash.h1[76] = (uchar)(nonce & 0xFF);
    hash.h1[77] = (uchar)((nonce >> 8) & 0xFF);
    hash.h1[78] = (uchar)((nonce >> 16) & 0xFF);
    hash.h1[79] = (uchar)((nonce >> 24) & 0xFF);

    __private uchar selectedAlgo[15];
    __private uchar selectedCNAlgo[14];
    get_algo_string(&hash.h1[4], 64, selectedAlgo, 15);
    get_algo_string(&hash.h1[4], 64, selectedCNAlgo, 14);

    // Debug: output all 18 steps × 64 bytes = 1152 bytes + 29 bytes algos = 1181
    // output_hash[0..14]  = selectedAlgo[0..14]
    // output_hash[15..28] = selectedCNAlgo[0..13]
    // output_hash[29 + step*64 .. 29 + (step+1)*64] = hash after step
    if (gid == 0) {
        for (int i = 0; i < 15; i++) output_hash[i] = selectedAlgo[i];
        for (int i = 0; i < 14; i++) output_hash[15 + i] = selectedCNAlgo[i];
    }

    uint size = 80;

    // 18-step hash chain with debug output after each step
    for (int step = 0; step < 18; step++) {
        int coreSelection;
        int cnSelection = -1;
        if (step < 5) {
            coreSelection = step;
        } else if (step < 11) {
            coreSelection = step - 1;
        } else {
            coreSelection = step - 2;
        }
        if (step == 5) { coreSelection = -1; cnSelection = 0; }
        if (step == 11) { coreSelection = -1; cnSelection = 1; }
        if (step == 17) { coreSelection = -1; cnSelection = 2; }

        if (coreSelection >= 0) {
            core_hash_dispatch(selectedAlgo[coreSelection], &hash, size);
        }
        if (cnSelection >= 0) {
            uchar cn_out[32];
            cn_dispatch(selectedCNAlgo[cnSelection], hash.h1, size, cn_out, scratchpad,
                        AES0, AES1, AES2, AES3);
            for (int j = 0; j < 32; j++) hash.h1[j] = cn_out[j];
            for (int j = 32; j < 64; j++) hash.h1[j] = 0;
        }
        size = 64;

        if (gid == 0) {
            for (int i = 0; i < 64; i++) output_hash[29 + step * 64 + i] = hash.h1[i];
        }
    }
}

// ── SPH test kernel: compute single SPH hash for algo index ─────────────────
__kernel void ghostrider_sph_test(
    __global const uchar* header,
    uint header_len,
    uint algo_idx,
    __global uchar* output_hash
)
{
    uint gid = get_global_id(0);
    if (gid != 0) return;

    hash_t hash;
    for (uint i = 0; i < 80 && i < header_len; i++) {
        hash.h1[i] = header[i];
    }
    // Pad rest with zeros
    for (uint i = header_len; i < 80; i++) {
        hash.h1[i] = 0;
    }

    // Compute single SPH hash with actual size
    core_hash_dispatch(algo_idx, &hash, header_len);

    // Output 64-byte hash
    for (int i = 0; i < 64; i++) output_hash[i] = hash.h1[i];
}

// ── SIMD debug kernel: compute first compression only ────────────────────────
__kernel void simd_debug(
    __global const uchar* input,
    uint input_len,
    __global uchar* output_state
)
{
    uint gid = get_global_id(0);
    if (gid != 0) return;

    // Copy input to x buffer
    unsigned char x[128];
    for (uint i = 0; i < input_len && i < 128; i++)
        x[i] = input[i];
    for (uint i = input_len; i < 128; i++)
        x[i] = 0;

    s32 q[256];
    u32 A0 = C32(0x0BA16B95), A1 = C32(0x72F999AD), A2 = C32(0x9FECC2AE), A3 = C32(0xBA3264FC), A4 = C32(0x5E894929), A5 = C32(0x8E9F30E5), A6 = C32(0x2F1DAA37), A7 = C32(0xF0F2C558);
    u32 B0 = C32(0xAC506643), B1 = C32(0xA90635A5), B2 = C32(0xE25B878B), B3 = C32(0xAAB7878F), B4 = C32(0x88817F7A), B5 = C32(0x0A02892B), B6 = C32(0x559A7550), B7 = C32(0x598F657E);
    u32 C0 = C32(0x7EEF60A1), C1 = C32(0x6B70E3E8), C2 = C32(0x9C1714D1), C3 = C32(0xB958E2A8), C4 = C32(0xAB02675E), C5 = C32(0xED1C014F), C6 = C32(0xCD8D65BB), C7 = C32(0xFDB7A257);
    u32 D0 = C32(0x09254899), D1 = C32(0xD699C7BC), D2 = C32(0x9019B6DC), D3 = C32(0x2B9022E4), D4 = C32(0x8FA14956), D5 = C32(0x21BF9BD3), D6 = C32(0xB94D0943), D7 = C32(0x6FFDDC22);

    FFT256(0, 1, 0, ll1);
    for (int i = 0; i < 256; i ++)
    {
        s32 tq;
        tq = q[i] + yoff_b_n[i];
        tq = REDS2(tq);
        tq = REDS1(tq);
        tq = REDS1(tq);
        q[i] = (tq <= 128 ? tq : tq - 257);
    }

    // DEBUG: output all 256 q values
    __global u32* out = (__global u32*)output_state;
    for (int i = 0; i < 256; i++) out[i] = (u32)q[i];
    return;
}

// ── SIMD debug2: full 2-compression SIMD-512 for 80-byte input ───────────────
__kernel void simd_debug2(
    __global const uchar* header,
    uint header_len,
    __global uchar* output_state
)
{
    uint gid = get_global_id(0);
    if (gid != 0) return;

    // Block 1: data + zero padding (SIMD padding: no 0x80 byte)
    unsigned char x[128];
    for (uint i = 0; i < header_len && i < 80; i++)
        x[i] = header[i];
    for (uint i = header_len; i < 128; i++)
        x[i] = 0;

    s32 q[256];
    u32 A0 = C32(0x0BA16B95), A1 = C32(0x72F999AD), A2 = C32(0x9FECC2AE), A3 = C32(0xBA3264FC), A4 = C32(0x5E894929), A5 = C32(0x8E9F30E5), A6 = C32(0x2F1DAA37), A7 = C32(0xF0F2C558);
    u32 B0 = C32(0xAC506643), B1 = C32(0xA90635A5), B2 = C32(0xE25B878B), B3 = C32(0xAAB7878F), B4 = C32(0x88817F7A), B5 = C32(0x0A02892B), B6 = C32(0x559A7550), B7 = C32(0x598F657E);
    u32 C0 = C32(0x7EEF60A1), C1 = C32(0x6B70E3E8), C2 = C32(0x9C1714D1), C3 = C32(0xB958E2A8), C4 = C32(0xAB02675E), C5 = C32(0xED1C014F), C6 = C32(0xCD8D65BB), C7 = C32(0xFDB7A257);
    u32 D0 = C32(0x09254899), D1 = C32(0xD699C7BC), D2 = C32(0x9019B6DC), D3 = C32(0x2B9022E4), D4 = C32(0x8FA14956), D5 = C32(0x21BF9BD3), D6 = C32(0xB94D0943), D7 = C32(0x6FFDDC22);

    // === 1st compression (data+0x80, yoff_b_n) ===
    FFT256(0, 1, 0, ll1);
    for (int i = 0; i < 256; i++) {
        s32 tq = q[i] + yoff_b_n[i];
        tq = REDS2(tq); tq = REDS1(tq); tq = REDS1(tq);
        q[i] = (tq <= 128 ? tq : tq - 257);
    }
    A0 ^= ((u32)x[0]|(u32)x[1]<<8|(u32)x[2]<<16|(u32)x[3]<<24);
    A1 ^= ((u32)x[4]|(u32)x[5]<<8|(u32)x[6]<<16|(u32)x[7]<<24);
    A2 ^= ((u32)x[8]|(u32)x[9]<<8|(u32)x[10]<<16|(u32)x[11]<<24);
    A3 ^= ((u32)x[12]|(u32)x[13]<<8|(u32)x[14]<<16|(u32)x[15]<<24);
    A4 ^= ((u32)x[16]|(u32)x[17]<<8|(u32)x[18]<<16|(u32)x[19]<<24);
    A5 ^= ((u32)x[20]|(u32)x[21]<<8|(u32)x[22]<<16|(u32)x[23]<<24);
    A6 ^= ((u32)x[24]|(u32)x[25]<<8|(u32)x[26]<<16|(u32)x[27]<<24);
    A7 ^= ((u32)x[28]|(u32)x[29]<<8|(u32)x[30]<<16|(u32)x[31]<<24);
    B0 ^= ((u32)x[32]|(u32)x[33]<<8|(u32)x[34]<<16|(u32)x[35]<<24);
    B1 ^= ((u32)x[36]|(u32)x[37]<<8|(u32)x[38]<<16|(u32)x[39]<<24);
    B2 ^= ((u32)x[40]|(u32)x[41]<<8|(u32)x[42]<<16|(u32)x[43]<<24);
    B3 ^= ((u32)x[44]|(u32)x[45]<<8|(u32)x[46]<<16|(u32)x[47]<<24);
    B4 ^= ((u32)x[48]|(u32)x[49]<<8|(u32)x[50]<<16|(u32)x[51]<<24);
    B5 ^= ((u32)x[52]|(u32)x[53]<<8|(u32)x[54]<<16|(u32)x[55]<<24);
    B6 ^= ((u32)x[56]|(u32)x[57]<<8|(u32)x[58]<<16|(u32)x[59]<<24);
    B7 ^= ((u32)x[60]|(u32)x[61]<<8|(u32)x[62]<<16|(u32)x[63]<<24);
    C0 ^= ((u32)x[64]|(u32)x[65]<<8|(u32)x[66]<<16|(u32)x[67]<<24);
    C1 ^= ((u32)x[68]|(u32)x[69]<<8|(u32)x[70]<<16|(u32)x[71]<<24);
    C2 ^= ((u32)x[72]|(u32)x[73]<<8|(u32)x[74]<<16|(u32)x[75]<<24);
    C3 ^= ((u32)x[76]|(u32)x[77]<<8|(u32)x[78]<<16|(u32)x[79]<<24);
    C4 ^= ((u32)x[80]|(u32)x[81]<<8|(u32)x[82]<<16|(u32)x[83]<<24);
    C5 ^= ((u32)x[84]|(u32)x[85]<<8|(u32)x[86]<<16|(u32)x[87]<<24);
    C6 ^= ((u32)x[88]|(u32)x[89]<<8|(u32)x[90]<<16|(u32)x[91]<<24);
    C7 ^= ((u32)x[92]|(u32)x[93]<<8|(u32)x[94]<<16|(u32)x[95]<<24);
    D0 ^= ((u32)x[96]|(u32)x[97]<<8|(u32)x[98]<<16|(u32)x[99]<<24);
    D1 ^= ((u32)x[100]|(u32)x[101]<<8|(u32)x[102]<<16|(u32)x[103]<<24);
    D2 ^= ((u32)x[104]|(u32)x[105]<<8|(u32)x[106]<<16|(u32)x[107]<<24);
    D3 ^= ((u32)x[108]|(u32)x[109]<<8|(u32)x[110]<<16|(u32)x[111]<<24);
    D4 ^= ((u32)x[112]|(u32)x[113]<<8|(u32)x[114]<<16|(u32)x[115]<<24);
    D5 ^= ((u32)x[116]|(u32)x[117]<<8|(u32)x[118]<<16|(u32)x[119]<<24);
    D6 ^= ((u32)x[120]|(u32)x[121]<<8|(u32)x[122]<<16|(u32)x[123]<<24);
    D7 ^= ((u32)x[124]|(u32)x[125]<<8|(u32)x[126]<<16|(u32)x[127]<<24);

    ONE_ROUND_BIG(0_, 0,  3, 23, 17, 27);
    ONE_ROUND_BIG(1_, 1, 28, 19, 22,  7);
    ONE_ROUND_BIG(2_, 2, 29,  9, 15,  5);
    ONE_ROUND_BIG(3_, 3,  4, 13, 10, 25);

    STEP_BIG(C32(0x0BA16B95),C32(0x72F999AD),C32(0x9FECC2AE),C32(0xBA3264FC),C32(0x5E894929),C32(0x8E9F30E5),C32(0x2F1DAA37),C32(0xF0F2C558), IF, 4,13, PP8_4_);
    STEP_BIG(C32(0xAC506643),C32(0xA90635A5),C32(0xE25B878B),C32(0xAAB7878F),C32(0x88817F7A),C32(0x0A02892B),C32(0x559A7550),C32(0x598F657E), IF,13,10, PP8_5_);
    STEP_BIG(C32(0x7EEF60A1),C32(0x6B70E3E8),C32(0x9C1714D1),C32(0xB958E2A8),C32(0xAB02675E),C32(0xED1C014F),C32(0xCD8D65BB),C32(0xFDB7A257), IF,10,25, PP8_6_);
    STEP_BIG(C32(0x09254899),C32(0xD699C7BC),C32(0x9019B6DC),C32(0x2B9022E4),C32(0x8FA14956),C32(0x21BF9BD3),C32(0xB94D0943),C32(0x6FFDDC22), IF,25, 4, PP8_0_);

    // Save state after 1st compression as weights for 2nd
    u32 W_A0=A0,W_A1=A1,W_A2=A2,W_A3=A3,W_A4=A4,W_A5=A5,W_A6=A6,W_A7=A7;
    u32 W_B0=B0,W_B1=B1,W_B2=B2,W_B3=B3,W_B4=B4,W_B5=B5,W_B6=B6,W_B7=B7;
    u32 W_C0=C0,W_C1=C1,W_C2=C2,W_C3=C3,W_C4=C4,W_C5=C5,W_C6=C6,W_C7=C7;
    u32 W_D0=D0,W_D1=D1,W_D2=D2,W_D3=D3,W_D4=D4,W_D5=D5,W_D6=D6,W_D7=D7;

    // === 2nd compression (count block, yoff_b_f) ===
    for (int i = 0; i < 128; i++) x[i] = 0;
    uint bit_count = header_len << 3;
    x[0] = bit_count & 0xFF;
    x[1] = (bit_count >> 8) & 0xFF;
    x[2] = (bit_count >> 16) & 0xFF;
    x[3] = (bit_count >> 24) & 0xFF;

    FFT256(0, 1, 0, ll1);
    for (int i = 0; i < 256; i++) {
        s32 tq = q[i] + yoff_b_f[i];
        tq = REDS2(tq); tq = REDS1(tq); tq = REDS1(tq);
        q[i] = (tq <= 128 ? tq : tq - 257);
    }

    // Reset state to W_* (result of 1st compression) before XOR
    A0=W_A0; A1=W_A1; A2=W_A2; A3=W_A3; A4=W_A4; A5=W_A5; A6=W_A6; A7=W_A7;
    B0=W_B0; B1=W_B1; B2=W_B2; B3=W_B3; B4=W_B4; B5=W_B5; B6=W_B6; B7=W_B7;
    C0=W_C0; C1=W_C1; C2=W_C2; C3=W_C3; C4=W_C4; C5=W_C5; C6=W_C6; C7=W_C7;
    D0=W_D0; D1=W_D1; D2=W_D2; D3=W_D3; D4=W_D4; D5=W_D5; D6=W_D6; D7=W_D7;

    A0 ^= bit_count;

    ONE_ROUND_BIG(0_, 0,  3, 23, 17, 27);
    ONE_ROUND_BIG(1_, 1, 28, 19, 22,  7);
    ONE_ROUND_BIG(2_, 2, 29,  9, 15,  5);
    ONE_ROUND_BIG(3_, 3,  4, 13, 10, 25);

    // STEP_BIG uses W_* (1st compression output) as weights
    STEP_BIG(W_A0,W_A1,W_A2,W_A3,W_A4,W_A5,W_A6,W_A7, IF, 4,13, PP8_4_);
    STEP_BIG(W_B0,W_B1,W_B2,W_B3,W_B4,W_B5,W_B6,W_B7, IF,13,10, PP8_5_);
    STEP_BIG(W_C0,W_C1,W_C2,W_C3,W_C4,W_C5,W_C6,W_C7, IF,10,25, PP8_6_);
    STEP_BIG(W_D0,W_D1,W_D2,W_D3,W_D4,W_D5,W_D6,W_D7, IF,25, 4, PP8_0_);

    // Output final state (16 u32 = 64 bytes)
    __global u32* out2 = (__global u32*)output_state;
    out2[0]=A0; out2[1]=A1; out2[2]=A2; out2[3]=A3;
    out2[4]=A4; out2[5]=A5; out2[6]=A6; out2[7]=A7;
    out2[8]=B0; out2[9]=B1; out2[10]=B2; out2[11]=B3;
    out2[12]=B4; out2[13]=B5; out2[14]=B6; out2[15]=B7;
}

// ── CN test kernel: compute cn_hash_fast for a given input ──────────────────
__kernel void cn_test(
    __global const uchar* input,
    uint input_len,
    __global uchar* output_hash
)
{
    uint gid = get_global_id(0);
    if (gid != 0) return;

    __private uchar in_buf[200];
    for (uint i = 0; i < input_len && i < 200; i++) in_buf[i] = input[i];

    __private uchar out_buf[32];
    cn_hash_fast(in_buf, input_len, out_buf);

    for (int i = 0; i < 32; i++) output_hash[i] = out_buf[i];
}

// ── CN full test kernel: compute cn_hash_full for a given input ──────────────
__kernel void cn_full_test(
    __global const uchar* input,
    uint input_len,
    uint memory,
    uint iter_div,
    uint cn_aes_init,
    __global uchar* scratchpad_pool,
    __global uchar* output_hash,
    __global uchar* debug_state
)
{
    uint gid = get_global_id(0);
    if (gid != 0) return;

    // Debug marker: write unique values to debug_state to verify kernel recompilation
    if (debug_state) {
        debug_state[196] = 0xCC;
        debug_state[197] = 0xDD;
        debug_state[198] = 0xEE;
        debug_state[199] = 0xFF;
        // Save individual input bytes to debug_state[112..119] for verification
        // (use offsets that cn_hash_full won't overwrite)
        debug_state[112] = input[0];
        debug_state[113] = input[1];
        debug_state[114] = input[34];
        debug_state[115] = input[35];
        debug_state[116] = input[36];
        debug_state[117] = input[42];
        debug_state[118] = input[43];
        debug_state[119] = input[63];
    }

    __local uint AES0[256], AES1[256], AES2[256], AES3[256];
    cn_populate_aes_tables(AES0, AES1, AES2, AES3);

    __private uchar in_buf[200];
    for (uint i = 0; i < input_len && i < 200; i++) in_buf[i] = input[i];

    __private uchar out_buf[32];
    __global uchar* scratchpad = scratchpad_pool + (ulong)gid * 2097152;
    cn_hash_full(in_buf, input_len, out_buf, scratchpad, memory, iter_div, cn_aes_init,
                 AES0, AES1, AES2, AES3, debug_state, input);

    for (int i = 0; i < 32; i++) output_hash[i] = out_buf[i];
}

// ── Extra hash test kernel: test blake/groestl/jh/skein on 200-byte state ───
__kernel void extra_hash_test(
    __global const uchar* state_in,
    uint hash_sel,
    __global uchar* output_hash
)
{
    uint gid = get_global_id(0);
    if (gid != 0) return;

    __private uchar state[200];
    for (int i = 0; i < 200; i++) state[i] = state_in[i];

    __private uchar out_buf[32];
    if (hash_sel == 0) {
        blake256_hash(out_buf, state, 200);
    } else if (hash_sel == 1) {
        groestl256_hash(out_buf, state, 200);
    } else if (hash_sel == 2) {
        jh256_hash(out_buf, state, 200);
    } else {
        skein256_hash(out_buf, state, 200);
    }

    for (int i = 0; i < 32; i++) output_hash[i] = out_buf[i];
}
