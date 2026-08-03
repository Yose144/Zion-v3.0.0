// ZelHash (Equihash 125,4) parameters for Flux (FLUX)
// ZelHash is a modified Equihash 125,4 with "ZelProof" Blake2b personalization.
//
// Parameters: N=125, K=4
//   - 4 rounds of collision finding (rounds 0-3)
//   - Blake2b-512 hash function with ZelProof personalization
//   - 4 Xi values per Blake2b hash (512/125 = 4)
//   - Solution size: 2^4 * 26 bits = 52 bytes (compressed)
//   - Memory: ~3.2GB per hash table (with NR_ROWS_LOG=22, SLOT_LEN=24)
//   - Total VRAM: ~6.4GB (two hash tables) — fits 8GB GPUs
//
// References:
//   - Equihash paper: https://eprint.iacr.org/2014/942.pdf
//   - silentarmy: https://github.com/mbevand/silentarmy
//   - Flux ZelHash: https://github.com/RunOnFlux/fluxd
#ifndef ZELHASH_125_4_PARAM_H
#define ZELHASH_125_4_PARAM_H

#define PARAM_N                        125
#define PARAM_K                        4
#define PREFIX                          (PARAM_N / (PARAM_K + 1))  // 25

// Total initial entries = 4 Xi per hash × 2^PREFIX hashes = 4 × 2^25 = 2^27
#define NR_INPUTS                       (1 << PREFIX)  // 2^25 = 33554432
#define XI_PER_HASH                     4              // 512/125 = 4
#define TOTAL_INITIAL_ENTRIES           (NR_INPUTS * XI_PER_HASH)  // 2^27

// Hash table parameters
// NR_ROWS_LOG=22 → 4M rows, 32 entries/row avg, NR_SLOTS=32
// ENCODE_INPUTS: 22 + 5 + 5 = 32 bits (fits in uint32)
// Memory: 2^22 × 32 × 24 = 3.2GB per table
#define NR_ROWS_LOG                     22
#define NR_ROWS                         (1 << NR_ROWS_LOG)
#define OVERHEAD                        1
#define NR_SLOTS                        ((TOTAL_INITIAL_ENTRIES >> NR_ROWS_LOG) * OVERHEAD)
// = 2^(27-22) * 1 = 32

#define SLOT_LEN                        24  // 4 bytes ref + 16 bytes Xi + 4 pad
#define HT_SIZE                         (NR_ROWS * NR_SLOTS * SLOT_LEN)

// Block header (same structure as Zcash — 140 bytes)
#define ZCASH_BLOCK_HEADER_LEN          140
#define ZCASH_BLOCK_OFFSET_NTIME        (4 + 3 * 32)
#define ZCASH_NONCE_LEN                 32
#define ZCASH_NONCE_OFFSET              (ZCASH_BLOCK_HEADER_LEN - ZCASH_NONCE_LEN)
#define ZCASH_SOLSIZE_LEN               3

// Solution: 2^4 * (25+1) / 8 = 16 * 26 / 8 = 52 bytes
#define ZCASH_SOL_LEN                   ((1 << PARAM_K) * (PREFIX + 1) / 8)

// Hash output: full 64-byte Blake2b-512 (contains 4 Xi values of 125 bits each)
#define ZCASH_HASH_LEN                  64

// Collision prefix per round = PREFIX - NR_ROWS_LOG = 25 - 22 = 3 bits
#define COLLISION_BITS                  (PREFIX - NR_ROWS_LOG)  // 3
#define COLLISION_MASK                  ((1 << COLLISION_BITS) - 1)  // 0x07

// Row counter parameters
#if (NR_SLOTS < 16)
#define BITS_PER_ROW                    4
#define ROWS_PER_UINT                   8
#define ROW_MASK                        0x0F
#else
#define BITS_PER_ROW                    8
#define ROWS_PER_UINT                   4
#define ROW_MASK                        0xFF
#endif

// Max collisions per thread in equihash_round. With NR_SLOTS=32 and 3-bit
// collision prefix (8 buckets, ~4 entries each), expected ~48 collisions.
// Use 64 for margin. Local memory: 64 * 64 * 4 = 16KB per work group.
#define COLL_DATA_SIZE_PER_TH           64

// Xi bit offset in the stored slot (after the reference bytes)
// Round 0: 4 bytes (cnt + i)
// Round 1: 4 bytes (cnt + i)
// Round 2: 8 bytes (cnt + i + i)
// Round 3: 8 bytes (cnt + i + i)
#define xi_offset_for_round(round)      (8 + ((round) / 2) * 4)

// Solution parameters
#define SOL_SIZE                        ((1 << PARAM_K) * 4)
#define MAX_SOLS                        10
#define N_ZERO_BYTES                    12
#define BLAKE_WPS                       10
#define SHA256_TARGET_LEN               (256 / 8)

// Encode/decode references (22-bit row + 5-bit slots = 32 bits)
#define ENCODE_INPUTS(row, slot0, slot1) \
    ((row << 10) | ((slot1 & 0x1f) << 5) | (slot0 & 0x1f))
#define DECODE_ROW(REF)                 (REF >> 10)
#define DECODE_SLOT1(REF)               ((REF >> 5) & 0x1f)
#define DECODE_SLOT0(REF)               (REF & 0x1f)

// Solutions structure (matches host-side sols_t)
typedef struct sols_s {
    uint nr;
    uint likely_invalids;
    uchar valid[MAX_SOLS];
    uint values[MAX_SOLS][(1 << PARAM_K)];
} sols_t;

#endif // ZELHASH_125_4_PARAM_H
