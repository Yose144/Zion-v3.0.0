// Equihash 200,9 parameters for Zcash (ZEC)
// Adapted from silentarmy param.h (originally for 200,9)
// This is the ORIGINAL Equihash parameter set used by Zcash mainnet.
#define PARAM_N                        200
#define PARAM_K                        9
#define PREFIX                          (PARAM_N / (PARAM_K + 1))  // 20
#define NR_INPUTS                       (1 << PREFIX)  // 2^20 = 1048576
#define APX_NR_ELMS_LOG                 (PREFIX + 1)   // 21
#define NR_ROWS_LOG                     20

#define OPTIM_SIMPLIFY_ROUND            1

#define COLL_DATA_SIZE_PER_TH           (NR_SLOTS * 5)

#define NR_ROWS                         (1 << NR_ROWS_LOG)
// OVERHEAD controls the hash table slot multiplier. With Poisson mean
// λ=1 element/row (2^20 inputs / 2^20 rows), P(X > 4) ≈ 0.015, so
// OVERHEAD=4 (4 slots) captures ~99.99% of elements.
// NR_SLOTS must be ≤ 64 for NR_ROWS_LOG=20.
// VRAM: 2 × (2^20 × 4 × 32) = 2 × 128MB = 256MB total (fits any GPU).
#if NR_ROWS_LOG == 20 && OPTIM_SIMPLIFY_ROUND
#define OVERHEAD                        4
#else
#define OVERHEAD                        9
#endif
#define NR_SLOTS            ((1 << (APX_NR_ELMS_LOG - NR_ROWS_LOG)) * OVERHEAD)
#define SLOT_LEN                        32
#define HT_SIZE                         (NR_ROWS * NR_SLOTS * SLOT_LEN)
#define ZCASH_BLOCK_HEADER_LEN          140
#define ZCASH_BLOCK_OFFSET_NTIME        (4 + 3 * 32)
#define ZCASH_NONCE_LEN                 32
#define ZCASH_SOLSIZE_LEN               3
// Solution: 2^9 * (20+1) / 8 = 512 * 21 / 8 = 1344 bytes
#define ZCASH_SOL_LEN                   ((1 << PARAM_K) * (PREFIX + 1) / 8)
#define N_ZERO_BYTES                    12
#define ZCASH_HASH_LEN                  50
#define BLAKE_WPS                       10
#define MAX_SOLS                        10
#define SHA256_TARGET_LEN               (256 / 8)

#if (NR_SLOTS < 16)
#define BITS_PER_ROW 4
#define ROWS_PER_UINT 8
#define ROW_MASK 0x0F
#else
#define BITS_PER_ROW 8
#define ROWS_PER_UINT 4
#define ROW_MASK 0xFF
#endif

#define xi_offset_for_round(round)      (8 + ((round) / 2) * 4)
#define SOL_SIZE                        ((1 << PARAM_K) * 4)

typedef struct sols_s {
    uint nr;
    uint likely_invalids;
    uchar valid[MAX_SOLS];
    uint values[MAX_SOLS][(1 << PARAM_K)];
} sols_t;
