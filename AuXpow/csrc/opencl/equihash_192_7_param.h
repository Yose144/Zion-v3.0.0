// Equihash 192,7 parameters for Zclassic (ZCL)
// Adapted from silentarmy param.h (originally for 200,9)
#define PARAM_N                        192
#define PARAM_K                        7
#define PREFIX                          (PARAM_N / (PARAM_K + 1))  // 24
#define NR_INPUTS                       (1 << PREFIX)  // 2^24 = 16777216
#define APX_NR_ELMS_LOG                 (PREFIX + 1)   // 25
#define NR_ROWS_LOG                     20

#define OPTIM_SIMPLIFY_ROUND            1

#define COLL_DATA_SIZE_PER_TH           (NR_SLOTS * 5)

#define NR_ROWS                         (1 << NR_ROWS_LOG)
// OVERHEAD controls the hash table slot multiplier. With Poisson mean
// λ=32 elements/row (2^24 inputs / 2^20 rows), P(X > 64) ≈ 1.5e-9, so
// OVERHEAD=2 (64 slots) captures essentially all elements.
// NR_SLOTS must be ≤ 64 for NR_ROWS_LOG=20 (ENCODE_INPUTS packs row(20b)
// + 2 slots(6b each) into 32 bits). OVERHEAD=2 → NR_SLOTS=64 → fits.
// VRAM: 2 × (2^20 × 64 × 32) = 2 × 2GB = 4GB total (fits 8GB GPUs).
#if NR_ROWS_LOG == 20 && OPTIM_SIMPLIFY_ROUND
#define OVERHEAD                        2
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
// Solution: 2^7 * (24+1) / 8 = 128 * 25 / 8 = 400 bytes
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
