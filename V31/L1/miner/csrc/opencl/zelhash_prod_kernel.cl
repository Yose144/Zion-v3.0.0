// ZelHash (Equihash 125,4) OpenCL kernel for Flux (FLUX) mining.
//
// Adapted from silentarmy (https://github.com/mbevand/silentarmy)
// which was originally for Equihash 200,9. Modified for 125,4 parameters
// with ZelProof Blake2b personalization.
//
// Equihash is a memory-hard PoW based on the generalized birthday problem
// (Wagner's algorithm). Parameters for FLUX: N=125, K=4
//   - 4 rounds of collision finding
//   - Blake2b-512 hash function with ZelProof personalization
//   - Solution size: 2^4 * 26 bits = 52 bytes (compressed)
//   - Memory requirement: ~4GB GPU VRAM (with NR_ROWS_LOG=20)
//
// References:
//   - silentarmy: https://github.com/mbevand/silentarmy
//   - Equihash paper: https://eprint.iacr.org/2014/942.pdf
//   - Flux ZelHash: https://github.com/RunOnFlux/fluxd
//   - Zcash Stratum Protocol: ZIP 301

// === BEGIN INLINED zelhash_125_4_param.h ===
// (inlined for embedded kernel support — no #include at runtime)

#define PARAM_N                        125
#define PARAM_K                        4
#define PREFIX                          (PARAM_N / (PARAM_K + 1))  // 25

#define NR_INPUTS                       (1 << PREFIX)  // 2^25 = 33554432
#define XI_PER_HASH                     4              // 512/125 = 4
#define TOTAL_INITIAL_ENTRIES           (NR_INPUTS * XI_PER_HASH)  // 2^27

#define NR_ROWS_LOG                     22
#define NR_ROWS                         (1 << NR_ROWS_LOG)
#define OVERHEAD                        1
#define NR_SLOTS                        ((TOTAL_INITIAL_ENTRIES >> NR_ROWS_LOG) * OVERHEAD)

#define SLOT_LEN                        24  // 4 bytes ref + 16 bytes Xi + 4 pad
#define HT_SIZE                         (NR_ROWS * NR_SLOTS * SLOT_LEN)

#define ZCASH_BLOCK_HEADER_LEN          140
#define ZCASH_BLOCK_OFFSET_NTIME        (4 + 3 * 32)
#define ZCASH_NONCE_LEN                 32
#define ZCASH_NONCE_OFFSET              (ZCASH_BLOCK_HEADER_LEN - ZCASH_NONCE_LEN)
#define ZCASH_SOLSIZE_LEN               3

#define ZCASH_SOL_LEN                   ((1 << PARAM_K) * (PREFIX + 1) / 8)

#define ZCASH_HASH_LEN                  64

#define COLLISION_BITS                  (PREFIX - NR_ROWS_LOG)  // 3
#define COLLISION_MASK                  ((1 << COLLISION_BITS) - 1)  // 0x07

#if (NR_SLOTS < 16)
#define BITS_PER_ROW                    4
#define ROWS_PER_UINT                   8
#define ROW_MASK                        0x0F
#else
#define BITS_PER_ROW                    8
#define ROWS_PER_UINT                   4
#define ROW_MASK                        0xFF
#endif

#define COLL_DATA_SIZE_PER_TH           64

#define xi_offset_for_round(round)      (8 + ((round) / 2) * 4)

#define SOL_SIZE                        ((1 << PARAM_K) * 4)
#define MAX_SOLS                        10
#define N_ZERO_BYTES                    12
#define BLAKE_WPS                       10
#define SHA256_TARGET_LEN               (256 / 8)

#define ENCODE_INPUTS(row, slot0, slot1) \
    ((row << 10) | ((slot1 & 0x1f) << 5) | (slot0 & 0x1f))
#define DECODE_ROW(REF)                 (REF >> 10)
#define DECODE_SLOT1(REF)               ((REF >> 5) & 0x1f)
#define DECODE_SLOT0(REF)               (REF & 0x1f)

typedef struct sols_s {
    uint nr;
    uint likely_invalids;
    uchar valid[MAX_SOLS];
    uint values[MAX_SOLS][(1 << PARAM_K)];
} sols_t;

// === END INLINED zelhash_125_4_param.h ===

#pragma OPENCL EXTENSION cl_khr_global_int32_base_atomics : enable

/*
** ZelHash 125,4 hash table slot layout (SLOT_LEN=24 bytes):
**
** For N=125, K=4, each Xi is 125 bits, stored as 16 bytes (128 bits, top 3
** bits zero-padded). The row is the first NR_ROWS_LOG=22 bits of the Xi.
** After ht_store, the Xi is shifted right by 22 bits (removing row bits).
** The collision prefix is PREFIX - NR_ROWS_LOG = 3 bits, always at the
** start of the stored Xi. The mask for collision detection is 0x07.
**
** round 0: cnt(4) i(4)      Xi(16) pad(4)   — 125-bit Xi, row=22 bits
** round 1: cnt(4) i(4)      Xi(16) pad(4)   — 103-bit Xi after 22-bit shift
** round 2: cnt(4) i(4) i(4) Xi(16) pad(0)   — 78-bit Xi after 25-bit total shift
** round 3: cnt(4) i(4) i(4) Xi(16) pad(0)   — 53-bit Xi after 50-bit total shift
**
** Each round removes PREFIX=25 bits (3-bit collision prefix + 22-bit row).
** After 4 rounds: 125 - 4*25 = 25 bits remain, checked for zero in kernel_sols.
**
** - cnt: atomic counter in first slot only; subsequent slots use 4 pad bytes
** - i: 4-byte reference (input index or encoded row/slot pair)
** - Xi: 16 bytes (2 ulongs), shifted right by 22 bits after row extraction
*/

__constant ulong blake_iv[] =
{
    0x6a09e667f3bcc908, 0xbb67ae8584caa73b,
    0x3c6ef372fe94f82b, 0xa54ff53a5f1d36f1,
    0x510e527fade682d1, 0x9b05688c2b3e6c1f,
    0x1f83d9abfb41bd6b, 0x5be0cd19137e2179,
};

/*
** Reset counters in hash table.
*/
__kernel
void kernel_init_ht(__global char *ht, __global uint *rowCounters)
{
    rowCounters[get_global_id(0)] = 0;
}

/*
** Store a Xi value in the hash table for ZelHash 125,4.
**
** For N=125, each Xi is 125 bits stored in 2 ulongs (128 bits, top 3 bits
** zero-padded). The row is the first NR_ROWS_LOG=22 bits of xi0.
** After extracting the row, the Xi is shifted right by 22 bits.
**
** The stored Xi always occupies 16 bytes (2 ulongs), regardless of round.
*  After each round, the Xi has fewer valid bits, but the storage is fixed
*  at 16 bytes for simplicity.
**
** Return 0 if successfully stored, or 1 if the row overflowed.
*/
uint ht_store(uint round, __global char *ht, uint i,
	ulong xi0, ulong xi1, __global uint *rowCounters)
{
    uint    row;
    __global char       *p;
    uint                cnt;
    // Row is always the first NR_ROWS_LOG bits of xi0.
    // For all rounds, the Xi passed to ht_store has the collision prefix
    // from the previous round already removed (by xor_and_store), so the
    // first NR_ROWS_LOG bits are the row for the current round.
    row = xi0 & ((1 << NR_ROWS_LOG) - 1);  // first 22 bits
    // Shift Xi right by NR_ROWS_LOG to remove row bits
    xi0 = (xi0 >> NR_ROWS_LOG) | (xi1 << (64 - NR_ROWS_LOG));
    xi1 = (xi1 >> NR_ROWS_LOG);
    p = ht + row * NR_SLOTS * SLOT_LEN;
    uint rowIdx = row/ROWS_PER_UINT;
    uint rowOffset = BITS_PER_ROW*(row%ROWS_PER_UINT);
    uint xcnt = atomic_add(rowCounters + rowIdx, 1 << rowOffset);
    xcnt = (xcnt >> rowOffset) & ROW_MASK;
    cnt = xcnt;
    if (cnt >= NR_SLOTS)
      {
	// avoid overflows
	atomic_sub(rowCounters + rowIdx, 1 << rowOffset);
	return 1;
      }
    p += cnt * SLOT_LEN + xi_offset_for_round(round);
    // store "i" (always 4 bytes before Xi)
    *(__global uint *)(p - 4) = i;
    // store 16 bytes (2 ulongs) of Xi for all rounds
    *(__global ulong *)(p + 0) = xi0;
    *(__global ulong *)(p + 8) = xi1;
    return 0;
}

#define mix(va, vb, vc, vd, x, y) \
    va = (va + vb + x); \
vd = rotate((vd ^ va), (ulong)64 - 32); \
vc = (vc + vd); \
vb = rotate((vb ^ vc), (ulong)64 - 24); \
va = (va + vb + y); \
vd = rotate((vd ^ va), (ulong)64 - 16); \
vc = (vc + vd); \
vb = rotate((vb ^ vc), (ulong)64 - 63);

/*
** Execute round 0 (blake).
**
** Note: making the work group size less than or equal to the wavefront size
** allows the OpenCL compiler to remove the barrier() calls, see "2.2 Local
** Memory (LDS) Optimization 2-10" in:
** http://developer.amd.com/tools-and-sdks/opencl-zone/amd-accelerated-parallel-processing-app-sdk/opencl-optimization-guide/
*/
__kernel __attribute__((reqd_work_group_size(64, 1, 1)))
void kernel_round0(__global ulong *blake_state, __global char *ht,
	__global uint *rowCounters, __global uint *debug)
{
    uint                tid = get_global_id(0);
    ulong               v[16];
    uint                inputs_per_thread = NR_INPUTS / get_global_size(0);
    uint                input = tid * inputs_per_thread;
    uint                input_end = (tid + 1) * inputs_per_thread;
    uint                dropped = 0;
    while (input < input_end)
      {
	// shift "i" to occupy the high 32 bits of the second ulong word in the
	// message block
	ulong word1 = (ulong)input << 32;
	// init vector v
	v[0] = blake_state[0];
	v[1] = blake_state[1];
	v[2] = blake_state[2];
	v[3] = blake_state[3];
	v[4] = blake_state[4];
	v[5] = blake_state[5];
	v[6] = blake_state[6];
	v[7] = blake_state[7];
	v[8] =  blake_iv[0];
	v[9] =  blake_iv[1];
	v[10] = blake_iv[2];
	v[11] = blake_iv[3];
	v[12] = blake_iv[4];
	v[13] = blake_iv[5];
	v[14] = blake_iv[6];
	v[15] = blake_iv[7];
	// mix in length of data
	v[12] ^= ZCASH_BLOCK_HEADER_LEN + 4 /* length of "i" */;
	// last block
	v[14] ^= (ulong)-1;

	// round 1
	mix(v[0], v[4], v[8],  v[12], 0, word1);
	mix(v[1], v[5], v[9],  v[13], 0, 0);
	mix(v[2], v[6], v[10], v[14], 0, 0);
	mix(v[3], v[7], v[11], v[15], 0, 0);
	mix(v[0], v[5], v[10], v[15], 0, 0);
	mix(v[1], v[6], v[11], v[12], 0, 0);
	mix(v[2], v[7], v[8],  v[13], 0, 0);
	mix(v[3], v[4], v[9],  v[14], 0, 0);
	// round 2
	mix(v[0], v[4], v[8],  v[12], 0, 0);
	mix(v[1], v[5], v[9],  v[13], 0, 0);
	mix(v[2], v[6], v[10], v[14], 0, 0);
	mix(v[3], v[7], v[11], v[15], 0, 0);
	mix(v[0], v[5], v[10], v[15], word1, 0);
	mix(v[1], v[6], v[11], v[12], 0, 0);
	mix(v[2], v[7], v[8],  v[13], 0, 0);
	mix(v[3], v[4], v[9],  v[14], 0, 0);
	// round 3
	mix(v[0], v[4], v[8],  v[12], 0, 0);
	mix(v[1], v[5], v[9],  v[13], 0, 0);
	mix(v[2], v[6], v[10], v[14], 0, 0);
	mix(v[3], v[7], v[11], v[15], 0, 0);
	mix(v[0], v[5], v[10], v[15], 0, 0);
	mix(v[1], v[6], v[11], v[12], 0, 0);
	mix(v[2], v[7], v[8],  v[13], 0, word1);
	mix(v[3], v[4], v[9],  v[14], 0, 0);
	// round 4
	mix(v[0], v[4], v[8],  v[12], 0, 0);
	mix(v[1], v[5], v[9],  v[13], 0, word1);
	mix(v[2], v[6], v[10], v[14], 0, 0);
	mix(v[3], v[7], v[11], v[15], 0, 0);
	mix(v[0], v[5], v[10], v[15], 0, 0);
	mix(v[1], v[6], v[11], v[12], 0, 0);
	mix(v[2], v[7], v[8],  v[13], 0, 0);
	mix(v[3], v[4], v[9],  v[14], 0, 0);
	// round 5
	mix(v[0], v[4], v[8],  v[12], 0, 0);
	mix(v[1], v[5], v[9],  v[13], 0, 0);
	mix(v[2], v[6], v[10], v[14], 0, 0);
	mix(v[3], v[7], v[11], v[15], 0, 0);
	mix(v[0], v[5], v[10], v[15], 0, word1);
	mix(v[1], v[6], v[11], v[12], 0, 0);
	mix(v[2], v[7], v[8],  v[13], 0, 0);
	mix(v[3], v[4], v[9],  v[14], 0, 0);
	// round 6
	mix(v[0], v[4], v[8],  v[12], 0, 0);
	mix(v[1], v[5], v[9],  v[13], 0, 0);
	mix(v[2], v[6], v[10], v[14], 0, 0);
	mix(v[3], v[7], v[11], v[15], 0, 0);
	mix(v[0], v[5], v[10], v[15], 0, 0);
	mix(v[1], v[6], v[11], v[12], 0, 0);
	mix(v[2], v[7], v[8],  v[13], 0, 0);
	mix(v[3], v[4], v[9],  v[14], word1, 0);
	// round 7
	mix(v[0], v[4], v[8],  v[12], 0, 0);
	mix(v[1], v[5], v[9],  v[13], word1, 0);
	mix(v[2], v[6], v[10], v[14], 0, 0);
	mix(v[3], v[7], v[11], v[15], 0, 0);
	mix(v[0], v[5], v[10], v[15], 0, 0);
	mix(v[1], v[6], v[11], v[12], 0, 0);
	mix(v[2], v[7], v[8],  v[13], 0, 0);
	mix(v[3], v[4], v[9],  v[14], 0, 0);
	// round 8
	mix(v[0], v[4], v[8],  v[12], 0, 0);
	mix(v[1], v[5], v[9],  v[13], 0, 0);
	mix(v[2], v[6], v[10], v[14], 0, word1);
	mix(v[3], v[7], v[11], v[15], 0, 0);
	mix(v[0], v[5], v[10], v[15], 0, 0);
	mix(v[1], v[6], v[11], v[12], 0, 0);
	mix(v[2], v[7], v[8],  v[13], 0, 0);
	mix(v[3], v[4], v[9],  v[14], 0, 0);
	// round 9
	mix(v[0], v[4], v[8],  v[12], 0, 0);
	mix(v[1], v[5], v[9],  v[13], 0, 0);
	mix(v[2], v[6], v[10], v[14], 0, 0);
	mix(v[3], v[7], v[11], v[15], 0, 0);
	mix(v[0], v[5], v[10], v[15], 0, 0);
	mix(v[1], v[6], v[11], v[12], 0, 0);
	mix(v[2], v[7], v[8],  v[13], word1, 0);
	mix(v[3], v[4], v[9],  v[14], 0, 0);
	// round 10
	mix(v[0], v[4], v[8],  v[12], 0, 0);
	mix(v[1], v[5], v[9],  v[13], 0, 0);
	mix(v[2], v[6], v[10], v[14], 0, 0);
	mix(v[3], v[7], v[11], v[15], word1, 0);
	mix(v[0], v[5], v[10], v[15], 0, 0);
	mix(v[1], v[6], v[11], v[12], 0, 0);
	mix(v[2], v[7], v[8],  v[13], 0, 0);
	mix(v[3], v[4], v[9],  v[14], 0, 0);
	// round 11
	mix(v[0], v[4], v[8],  v[12], 0, word1);
	mix(v[1], v[5], v[9],  v[13], 0, 0);
	mix(v[2], v[6], v[10], v[14], 0, 0);
	mix(v[3], v[7], v[11], v[15], 0, 0);
	mix(v[0], v[5], v[10], v[15], 0, 0);
	mix(v[1], v[6], v[11], v[12], 0, 0);
	mix(v[2], v[7], v[8],  v[13], 0, 0);
	mix(v[3], v[4], v[9],  v[14], 0, 0);
	// round 12
	mix(v[0], v[4], v[8],  v[12], 0, 0);
	mix(v[1], v[5], v[9],  v[13], 0, 0);
	mix(v[2], v[6], v[10], v[14], 0, 0);
	mix(v[3], v[7], v[11], v[15], 0, 0);
	mix(v[0], v[5], v[10], v[15], word1, 0);
	mix(v[1], v[6], v[11], v[12], 0, 0);
	mix(v[2], v[7], v[8],  v[13], 0, 0);
	mix(v[3], v[4], v[9],  v[14], 0, 0);

	// compress v into the blake state; this produces the full 64-byte
	// Blake2b-512 hash (8 ulong words). For N=125, we extract 4 Xi values
	// of 125 bits each from the 512-bit hash.
	ulong h[8];
	h[0] = blake_state[0] ^ v[0] ^ v[8];
	h[1] = blake_state[1] ^ v[1] ^ v[9];
	h[2] = blake_state[2] ^ v[2] ^ v[10];
	h[3] = blake_state[3] ^ v[3] ^ v[11];
	h[4] = blake_state[4] ^ v[4] ^ v[12];
	h[5] = blake_state[5] ^ v[5] ^ v[13];
	h[6] = blake_state[6] ^ v[6] ^ v[14];
	h[7] = blake_state[7] ^ v[7] ^ v[15];

	// Extract 4 Xi values from the 512-bit hash.
	// Each Xi is 125 bits, stored as 2 ulongs (128 bits, top 3 bits zero).
	// Xi_k starts at bit offset k*125 in the hash.
	//
	// Xi0 (offset 0):     h[0], h[1] & 0x1FFFFFFFFFFFFFF
	// Xi1 (offset 125):   (h[1]>>61)|(h[2]<<3), (h[2]>>61)|(h[3]<<3) & mask
	// Xi2 (offset 250):   (h[3]>>58)|(h[4]<<6), (h[4]>>58)|(h[5]<<6) & mask
	// Xi3 (offset 375):   (h[5]>>55)|(h[6]<<9), (h[6]>>55)|(h[7]<<9) & mask
#define XI_MASK_125 0x1FFFFFFFFFFFFFFUL  // mask top 3 bits (125 valid)

	// Xi0: bits 0-124
	dropped += ht_store(0, ht, input * 4 + 0,
		h[0],
		h[1] & XI_MASK_125, rowCounters);

	// Xi1: bits 125-249 (offset 125 = 64+61)
	dropped += ht_store(0, ht, input * 4 + 1,
		(h[1] >> 61) | (h[2] << 3),
		((h[2] >> 61) | (h[3] << 3)) & XI_MASK_125, rowCounters);

	// Xi2: bits 250-374 (offset 250 = 192+58)
	dropped += ht_store(0, ht, input * 4 + 2,
		(h[3] >> 58) | (h[4] << 6),
		((h[4] >> 58) | (h[5] << 6)) & XI_MASK_125, rowCounters);

	// Xi3: bits 375-499 (offset 375 = 320+55)
	dropped += ht_store(0, ht, input * 4 + 3,
		(h[5] >> 55) | (h[6] << 9),
		((h[6] >> 55) | (h[7] << 9)) & XI_MASK_125, rowCounters);

	input++;
      }
#ifdef ENABLE_DEBUG
    debug[tid * 2] = 0;
    debug[tid * 2 + 1] = dropped;
#endif
}

/*
** XOR a pair of Xi values from the previous round and store the result.
**
** For N=125, the stored Xi is always 16 bytes (2 ulongs). We XOR both
** ulongs, then shift right by COLLISION_BITS (3 bits) to remove the
** collision prefix that was matched in this round.
**
** Return 0 if successfully stored, or 1 if the row overflowed.
*/
uint xor_and_store(uint round, __global char *ht_dst, uint row,
	uint slot_a, uint slot_b, __global ulong *a, __global ulong *b,
	__global uint *rowCounters)
{
    ulong xi0, xi1;
    // XOR 16 bytes (2 ulongs) — same for all rounds
    xi0 = a[0] ^ b[0];
    xi1 = a[1] ^ b[1];
    // invalid solutions (duplicate inputs) xor to zero, discard them
    if (!xi0 && !xi1)
	return 0;
    // Shift right by COLLISION_BITS (3 bits) to remove the collision prefix
    // that was matched in this round. The remaining Xi starts at the next
    // PREFIX block.
    xi0 = (xi0 >> COLLISION_BITS) | (xi1 << (64 - COLLISION_BITS));
    xi1 = (xi1 >> COLLISION_BITS);
    return ht_store(round, ht_dst, ENCODE_INPUTS(row, slot_a, slot_b),
	    xi0, xi1, rowCounters);
}

/*
** Execute one Equihash round. Read from ht_src, XOR colliding pairs of Xi,
** store them in ht_dst.
*/
void equihash_round(uint round,
	__global char *ht_src,
	__global char *ht_dst,
	__global uint *debug,
	__local uchar *first_words_data,
	__local uint *collisionsData,
	__local uint *collisionsNum,
	__global uint *rowCountersSrc,
	__global uint *rowCountersDst)
{
    uint		tid = get_global_id(0);
    uint		tlid = get_local_id(0);
    __global char	*p;
    uint		cnt;
    __local uchar	*first_words = &first_words_data[(NR_SLOTS+2)*tlid];
    uchar		mask;
    uint		i, j;
    // NR_SLOTS is already oversized (by a factor of OVERHEAD), but we want to
    // make it even larger
    uint		n;
    uint		dropped_coll = 0;
    uint		dropped_stor = 0;
    __global ulong	*a, *b;
    uint		xi_offset;
    // read first words of Xi from the previous (round - 1) hash table
    xi_offset = xi_offset_for_round(round - 1);
    // the mask is also computed to read data from the previous round
    // For N=125, NR_ROWS_LOG=22: collision prefix = 3 bits, always at the
    // start of the stored Xi (which was shifted by 22 bits in ht_store).
    // The mask keeps the first 3 bits (0x07) for all rounds.
    mask = COLLISION_MASK;  // 0x07
    uint thCollNum = 0;
    *collisionsNum = 0;
    barrier(CLK_LOCAL_MEM_FENCE);
    p = (ht_src + tid * NR_SLOTS * SLOT_LEN);
    uint rowIdx = tid/ROWS_PER_UINT;
    uint rowOffset = BITS_PER_ROW*(tid%ROWS_PER_UINT);
    cnt = (rowCountersSrc[rowIdx] >> rowOffset) & ROW_MASK;
    cnt = min(cnt, (uint)NR_SLOTS); // handle possible overflow in prev. round
    if (!cnt)
	// no elements in row, no collisions
	goto part2;
    p += xi_offset;
    for (i = 0; i < cnt; i++, p += SLOT_LEN)
	first_words[i] = (*(__global uchar *)p) & mask;
    // find collisions
    for (i = 0; i < cnt-1 && thCollNum < COLL_DATA_SIZE_PER_TH; i++)
      {
	uchar data_i = first_words[i];
	uint collision = (tid << 10) | (i << 5) | (i + 1);
	for (j = i+1; (j+4) < cnt;)
	  {
	      {
		uint isColl = ((data_i == first_words[j]) ? 1 : 0);
		if (isColl)
		  {
		    thCollNum++;
		    uint index = atomic_inc(collisionsNum);
		    collisionsData[index] = collision;
		  }
		collision++;
		j++;
	      }
	      {
		uint isColl = ((data_i == first_words[j]) ? 1 : 0);
		if (isColl)
		  {
		    thCollNum++;
		    uint index = atomic_inc(collisionsNum);
		    collisionsData[index] = collision;
		  }
		collision++;
		j++;
	      }
	      {
		uint isColl = ((data_i == first_words[j]) ? 1 : 0);
		if (isColl)
		  {
		    thCollNum++;
		    uint index = atomic_inc(collisionsNum);
		    collisionsData[index] = collision;
		  }
		collision++;
		j++;
	      }
	      {
		uint isColl = ((data_i == first_words[j]) ? 1 : 0);
		if (isColl)
		  {
		    thCollNum++;
		    uint index = atomic_inc(collisionsNum);
		    collisionsData[index] = collision;
		  }
		collision++;
		j++;
	      }
	  }
	for (; j < cnt; j++)
	  {
	    uint isColl = ((data_i == first_words[j]) ? 1 : 0);
	    if (isColl)
	      {
		thCollNum++;
		uint index = atomic_inc(collisionsNum);
		collisionsData[index] = collision;
	      }
	    collision++;
	  }
      }

part2:
    barrier(CLK_LOCAL_MEM_FENCE);
    uint totalCollisions = *collisionsNum;
    for (uint index = tlid; index < totalCollisions; index += get_local_size(0))
      {
	uint collision = collisionsData[index];
	uint collisionThreadId = collision >> 10;
	uint i = (collision >> 5) & 0x1F;
	uint j = collision & 0x1F;
	__global uchar *ptr = ht_src + collisionThreadId * NR_SLOTS * SLOT_LEN +
	    xi_offset;
	a = (__global ulong *)(ptr + i * SLOT_LEN);
	b = (__global ulong *)(ptr + j * SLOT_LEN);
	dropped_stor += xor_and_store(round, ht_dst, collisionThreadId, i, j,
		a, b, rowCountersDst);
      }
#ifdef ENABLE_DEBUG
    debug[tid * 2] = dropped_coll;
    debug[tid * 2 + 1] = dropped_stor;
#endif
}

/*
** This defines kernel_round1 through kernel_round3 (collision finding rounds
** that do NOT need the sols argument). For ZelHash 125,4 (K=4), the loop
** runs rounds 0..K-1 = 0..3. Round 0 is kernel_round0 (Blake2b), rounds 1-3
** are the macro-generated collision rounds, and round 3 is the final round
** (kernel_round3_final below) that takes the extra sols argument.
*/
#define KERNEL_ROUND(N) \
__kernel __attribute__((reqd_work_group_size(64, 1, 1))) \
void kernel_round ## N(__global char *ht_src, __global char *ht_dst, \
	__global uint *rowCountersSrc, __global uint *rowCountersDst, \
       	__global uint *debug) \
{ \
    __local uchar first_words_data[(NR_SLOTS+2)*64]; \
    __local uint    collisionsData[COLL_DATA_SIZE_PER_TH * 64]; \
    __local uint    collisionsNum; \
    equihash_round(N, ht_src, ht_dst, debug, first_words_data, collisionsData, \
	    &collisionsNum, rowCountersSrc, rowCountersDst); \
}
KERNEL_ROUND(1)
KERNEL_ROUND(2)

// kernel_round3 is the final round for K=4 (round K-1 = 3).
// It takes an extra argument "sols" and initializes sols->nr = 0.
__kernel __attribute__((reqd_work_group_size(64, 1, 1)))
void kernel_round3(__global char *ht_src, __global char *ht_dst,
	__global uint *rowCountersSrc, __global uint *rowCountersDst,
	__global uint *debug, __global sols_t *sols)
{
    uint		tid = get_global_id(0);
    __local uchar	first_words_data[(NR_SLOTS+2)*64];
    __local uint	collisionsData[COLL_DATA_SIZE_PER_TH * 64];
    __local uint	collisionsNum;
    equihash_round(3, ht_src, ht_dst, debug, first_words_data, collisionsData,
	    &collisionsNum, rowCountersSrc, rowCountersDst);
    if (!tid)
	sols->nr = sols->likely_invalids = 0;
}

uint expand_ref(__global char *ht, uint xi_offset, uint row, uint slot)
{
    return *(__global uint *)(ht + row * NR_SLOTS * SLOT_LEN +
	    slot * SLOT_LEN + xi_offset - 4);
}

/*
** Expand references to inputs. Return 1 if so far the solution appears valid,
** or 0 otherwise (an invalid solution would be a solution with duplicate
** inputs, which can be detected at the last step: round == 0).
*/
uint expand_refs(uint *ins, uint nr_inputs, __global char **htabs,
	uint round)
{
    __global char	*ht = htabs[round % 2];
    uint		i = nr_inputs - 1;
    uint		j = nr_inputs * 2 - 1;
    uint		xi_offset = xi_offset_for_round(round);
    int			dup_to_watch = -1;
    do
      {
	ins[j] = expand_ref(ht, xi_offset,
		DECODE_ROW(ins[i]), DECODE_SLOT1(ins[i]));
	ins[j - 1] = expand_ref(ht, xi_offset,
		DECODE_ROW(ins[i]), DECODE_SLOT0(ins[i]));
	if (!round)
	  {
	    if (dup_to_watch == -1)
		dup_to_watch = ins[j];
	    else if (ins[j] == dup_to_watch || ins[j - 1] == dup_to_watch)
		return 0;
	  }
	if (!i)
	    break ;
	i--;
	j -= 2;
      }
    while (1);
    return 1;
}

/*
** Verify if a potential solution is in fact valid.
*/
void potential_sol(__global char **htabs, __global sols_t *sols,
	uint ref0, uint ref1)
{
    uint	nr_values;
    uint	values_tmp[(1 << PARAM_K)];
    uint	sol_i;
    uint	i;
    nr_values = 0;
    values_tmp[nr_values++] = ref0;
    values_tmp[nr_values++] = ref1;
    uint round = PARAM_K - 1;
    do
      {
	round--;
	if (!expand_refs(values_tmp, nr_values, htabs, round))
	    return ;
	nr_values *= 2;
      }
    while (round > 0);
    // solution appears valid, copy it to sols
    sol_i = atomic_inc(&sols->nr);
    if (sol_i >= MAX_SOLS)
	return ;
    for (i = 0; i < (1 << PARAM_K); i++)
	sols->values[sol_i][i] = values_tmp[i];
    sols->valid[sol_i] = 1;
}

/*
** Scan the hash tables to find Equihash solutions.
*/
__kernel __attribute__((reqd_work_group_size(64, 1, 1)))
void kernel_sols(__global char *ht0, __global char *ht1, __global sols_t *sols,
	__global uint *rowCountersSrc, __global uint *rowCountersDst)
{
    uint		tid = get_global_id(0);
    __global char	*htabs[2] = { ht0, ht1 };
    __global char	*hcounters[2] = { rowCountersSrc, rowCountersDst };
    uint		ht_i = (PARAM_K - 1) % 2; // table filled at last round
    uint		cnt;
    uint		xi_offset = xi_offset_for_round(PARAM_K - 1);
    uint		i, j;
    __global char	*a, *b;
    uint		ref_i, ref_j;
    // it's ok for the collisions array to be so small, as if it fills up
    // the potential solutions are likely invalid (many duplicate inputs)
    ulong		collisions;
    uint		coll;
    // For N=125, K=4: after round 3, the stored Xi has 28 bits remaining
    // (125 - 3*25 = 50 bits before ht_store, 50 - 22 = 28 after 22-bit shift).
    // We look for pairs where all 28 bits match (XOR = 0 → valid solution).
    // The 28 bits = 3-bit collision prefix + 25-bit remaining (must be zero).
    uint		mask = 0x0FFFFFFF;  // 28 bits
    a = htabs[ht_i] + tid * NR_SLOTS * SLOT_LEN;
    uint rowIdx = tid/ROWS_PER_UINT;
    uint rowOffset = BITS_PER_ROW*(tid%ROWS_PER_UINT);
    cnt = (rowCountersSrc[rowIdx] >> rowOffset) & ROW_MASK;
    cnt = min(cnt, (uint)NR_SLOTS); // handle possible overflow in last round
    coll = 0;
    a += xi_offset;
    for (i = 0; i < cnt; i++, a += SLOT_LEN)
      {
	uint a_data = ((*(__global uint *)a) & mask);
	ref_i = *(__global uint *)(a - 4);
	for (j = i + 1, b = a + SLOT_LEN; j < cnt; j++, b += SLOT_LEN)
	  {
	    if (a_data == ((*(__global uint *)b) & mask))
	      {
		ref_j = *(__global uint *)(b - 4);
		collisions = ((ulong)ref_i << 32) | ref_j;
		goto exit1;
	      }
	  }
      }
    return;

exit1:
    potential_sol(htabs, sols, collisions >> 32, collisions & 0xffffffff);
}
