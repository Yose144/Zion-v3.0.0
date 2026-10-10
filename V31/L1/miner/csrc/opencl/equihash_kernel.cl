// Equihash 192,7 OpenCL kernel for Zclassic (ZCL) mining.
//
// Wagner's algorithm adapted for byte-aligned PREFIX=24.  Unlike the
// silentarmy 200,9 original (PREFIX=20, nibble-packed slots), the 192,7
// parameter set consumes exactly 3 bytes of Xi per round, so the slot
// layout stores the Xi tail starting at a whole-byte boundary and the
// per-row collision compare is a single uniform 4-bit nibble.
//
// Equihash: N=192, K=7 — 2^7 = 128-leaf solutions, 400-byte encoded soln.
//   - blake2b output 48 bytes → 2 Xi of 24 B per hash
//   - NR_INPUTS = 2^24 blake blocks → 2^25 leaf indices
//   - 2^20 bucket rows × NR_SLOTS slots × 28 B → ~1.32 GB per table
//
// Slot layout (SLOT_LEN = 28) — staggered ref/tail, following silentarmy:
// each round stores its 4-byte "i" ref immediately before its Xi tail, and
// the tail start marches right every two rounds.  Because round r+2 writes
// strictly to the right of round r's ref field, all earlier refs survive in
// the slot head even though tables ping-pong between just two buffers —
// expand_refs() therefore only ever reads ref fields, never Xi bytes.
//
//   ref_off(r)  = 4*(r>>1)         → 0,0,4,4, 8, 8,12  for r = 0..6
//   tail_off(r) = ref_off(r)+4     → 4,4,8,8,12,12,16
//   tail bytes  = X[3r+2 .. 24)    → 22,19,16,13,10,7,4 B
//
//   buffer ht0 slots: r0 ref@0 | r2 ref@4 | r4 ref@8 | r6 ref@12 | r6 tail
//   buffer ht1 slots: r1 ref@0 | r3 ref@4 | r5 ref@8 | r5 tail
//
// Tail byte 0 of a table-r entry = X[3r+2]: high nibble is row bits,
// low nibble is the 4-bit intra-row compare value for the *next* round.
//
// Window W_r = X bytes [3r .. 3r+3).  Round r (r>=1) pairs table_{r-1}
// entries sharing row (W_{r-1} top 20 bits) AND tail[0]&0xf equal (the
// remaining 4 bits) — a full 24-bit W_{r-1} collision.

// (inlined equihash_192_7_param.h)
#define PARAM_N                        192
#define PARAM_K                        7
#define PREFIX                          (PARAM_N / (PARAM_K + 1))  // 24
#define NR_INPUTS                       (1 << PREFIX)  // 2^24 blake blocks
#define APX_NR_ELMS_LOG                 (PREFIX + 1)   // 25
#define NR_ROWS_LOG                     20

#define OPTIM_SIMPLIFY_ROUND            1

#ifndef EQ_WG_SIZE
#define EQ_WG_SIZE 64
#endif
#define COLL_DATA_SIZE_PER_TH           (NR_SLOTS * 5)

#define NR_ROWS                         (1 << NR_ROWS_LOG)
// Poisson mean lambda=32 elements/row (2^25 Xis / 2^20 rows).
// 48 slots/row ≈ +2.8σ headroom → ~0.2% rows drop one tail element.
// SLOT_LEN=28 fits the largest stored tail (4B ref + 22B Xi tail = 26B)
// and keeps every slot 4-byte aligned; two tables then take ~2.63 GiB,
// leaving VRAM headroom for co-resident streams on 8 GB cards.
#define NR_SLOTS                        48
#define SLOT_LEN                        28
#define HT_SIZE                         (NR_ROWS * NR_SLOTS * SLOT_LEN)
#define ZCASH_BLOCK_HEADER_LEN          140
#define ZCASH_NONCE_LEN                 32
// Solution: 2^7 * (24+1) / 8 = 128 * 25 / 8 = 400 bytes
#define ZCASH_SOL_LEN                   ((1 << PARAM_K) * (PREFIX + 1) / 8)
// blake2b digest length for (192,7): (512/N)*N/8 = 48 bytes.
#define ZCASH_HASH_LEN                  48
#define MAX_SOLS                        10

// Row counters: 8 bits per row packed 4-per-uint.
#define BITS_PER_ROW 8
#define ROWS_PER_UINT 4
#define ROW_MASK 0xFF

// Per-round byte offsets inside a slot.  The 4-byte "i" ref sits
// immediately before the round's Xi tail; the tail start advances 4 bytes
// every two rounds so that a buffer reused by rounds r, r+2, r+4… keeps a
// surviving ref log at distinct offsets (see the layout comment above).
#define xi_offset_for_round(round)      (4 * ((round) >> 1) + 4)
#define ref_offset_for_round(round)     (xi_offset_for_round(round) - 4)

#define SOL_SIZE                        ((1 << PARAM_K) * 4)

typedef struct sols_s {
    uint nr;
    uint likely_invalids;
    uchar valid[MAX_SOLS];
    uint values[MAX_SOLS][(1 << PARAM_K)];
} sols_t;

#pragma OPENCL EXTENSION cl_khr_global_int32_base_atomics : enable
#pragma OPENCL EXTENSION cl_khr_local_int32_base_atomics : enable

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
void kernel_init_ht(__global uchar *ht, __global uint *rowCounters)
{
    rowCounters[get_global_id(0)] = 0;
}

/*
** Byte b of a little-endian ulong (b in 0..7).
*/
#define B(x, b)   (((x) >> (8 * (b))) & 0xffUL)

/*
** Store one element in table `ht`.  `xj0..xj2` are 3 little-endian ulongs
** holding the 24 bytes of the "incoming" value:
**
**   round 0:   incoming = full Xi (24 B); row from bytes 0,1,2hi;
**              stores tail = X[2..24) — 22 B.
**   round r>=1: incoming = XOR tail from table_{r-1}, i.e. X[3r-1..24)
**              where byte 0 = consumed W_{r-1} byte (0 for true pairs);
**              row from bytes 1,2,3hi; stores tail = X[3r+2..24).
**
** `off` is the byte index of the row triple inside the incoming window:
** 2 for round 0, 3 for later rounds.  The stored tail begins at byte off,
** and its byte 0 keeps [row hi nibble | next-round compare nibble].
**
** Return 0 if stored, 1 if the row overflowed.
*/
uint ht_store(uint round, __global uchar *ht, uint i,
	ulong xj0, ulong xj1, ulong xj2, __global uint *rowCounters)
{
    uint    row;
    __global uchar       *p;
    uint                cnt;
    const uint off = (round == 0) ? 2 : 3;
    // tail length = 24 - (3r + 2) → 22,19,16,13,10,7,4 for r=0..6
    const uint tail_len = (round == 0) ? 22 : (22 - 3 * round);

    // row = incoming[off-2]<<12 | incoming[off-1]<<4 | incoming[off]>>4
    // incoming byte n sits in xj word n/8, byte n%8.
    ulong words[3] = { xj0, xj1, xj2 };
    uint b0 = (uint)B(words[(off - 2) / 8], (off - 2) % 8);
    uint b1 = (uint)B(words[(off - 1) / 8], (off - 1) % 8);
    uint b2 = (uint)B(words[off / 8], off % 8);
    row = (b0 << 12) | (b1 << 4) | (b2 >> 4);

    p = ht + row * NR_SLOTS * SLOT_LEN;
    uint rowIdx = row / ROWS_PER_UINT;
    uint rowOffset = BITS_PER_ROW * (row % ROWS_PER_UINT);
    uint xcnt = atomic_add(rowCounters + rowIdx, 1 << rowOffset);
    cnt = (xcnt >> rowOffset) & ROW_MASK;
    if (cnt >= NR_SLOTS)
      {
	// avoid overflows
	atomic_sub(rowCounters + rowIdx, 1 << rowOffset);
	return 1;
      }
    p += cnt * SLOT_LEN;
    // Store "i" (4-byte ref) right before this round's Xi tail — the
    // staggered offsets keep every round's ref alive in the slot head.
    const uint xoff = xi_offset_for_round(round);
    *(__global uint *)(p + xoff - 4) = i;
    __global uchar *t = p + xoff;

    // Shift the incoming 24-byte window right by `off` bytes and store the
    // first tail_len bytes.  Assemble ulongs s0 = incoming[off..off+8) etc.
    ulong s0, s1, s2;
    if (off == 2) {
	s0 = (xj0 >> 16) | (xj1 << 48);
	s1 = (xj1 >> 16) | (xj2 << 48);
	s2 = (xj2 >> 16);
    } else {
	s0 = (xj0 >> 24) | (xj1 << 40);
	s1 = (xj1 >> 24) | (xj2 << 40);
	s2 = (xj2 >> 24);
    }
    // Tail write: tail_len ∈ {22,19,16,13,10,7,4} bytes starting at t
    // (4-byte aligned).  Store whole u32s then the 0-3 spare bytes.
    uint w[6] = {
	(uint)(s0 & 0xffffffff), (uint)(s0 >> 32),
	(uint)(s1 & 0xffffffff), (uint)(s1 >> 32),
	(uint)(s2 & 0xffffffff), (uint)(s2 >> 32)
    };
    uint full4 = tail_len / 4;
    for (uint wi = 0; wi < full4; wi++)
	*(__global uint *)(t + 4 * wi) = w[wi];
    uint rem = tail_len & 3;
    for (uint b = 0; b < rem; b++)
	t[4 * full4 + b] = (uchar)(w[full4] >> (8 * b));
    return 0;
}

#define mix(va, vb, vc, vd, x, y) \
    va = (va + vb + x); \
vd = rotate((vd ^ va), (ulong)64 - 32); \
vc = (vc + vd); \
vb = rotate((vb ^ vc), (ulong)64 - 24); \
va = (va + vb + y); \
vd = (vd ^ va); vd = rotate(vd, (ulong)64 - 16); \
vc = (vc + vd); \
vb = (vb ^ vc); vb = rotate(vb, (ulong)64 - 63);

/*
** Execute round 0 (blake).
**
** The host uploads `blake_state` = the blake2b midstate after absorbing the
** first 128 bytes of the 140-byte header (digest length 48, personal
** "ZcashPoW" || LE32(N) || LE32(K)).  Each work-item finishes the second
** (final) block = header[128..140] || block_index; the 48-byte digest yields
** two 24-byte Xis: X[0..24) for leaf 2i and X[24..48) for leaf 2i+1.
**
** tail0 carries header[128..136], tail1 carries header[136..140] in its low
** 32 bits; the block index occupies the high 32 bits of the second word.
*/
__kernel __attribute__((reqd_work_group_size(EQ_WG_SIZE, 1, 1)))
void kernel_round0(__global ulong *blake_state, __global uchar *ht,
	__global uint *rowCounters, __global uint *debug,
	ulong tail0, ulong tail1)
{
    uint                tid = get_global_id(0);
    ulong               v[16];
    uint                inputs_per_thread = NR_INPUTS / get_global_size(0);
    uint                input = tid * inputs_per_thread;
    uint                input_end = (tid + 1) * inputs_per_thread;
    uint                dropped = 0;
    while (input < input_end)
      {
	ulong word1 = tail1 | ((ulong)input << 32);
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
	// mix in total length: 140 header bytes + 4 index bytes
	v[12] ^= ZCASH_BLOCK_HEADER_LEN + 4;
	// last block
	v[14] ^= (ulong)-1;

	// round 1
	mix(v[0], v[4], v[8],  v[12], tail0, word1);
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
	mix(v[1], v[6], v[11], v[12], tail0, 0);
	mix(v[2], v[7], v[8],  v[13], 0, 0);
	mix(v[3], v[4], v[9],  v[14], 0, 0);
	// round 3
	mix(v[0], v[4], v[8],  v[12], 0, 0);
	mix(v[1], v[5], v[9],  v[13], 0, tail0);
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
	mix(v[3], v[4], v[9],  v[14], 0, tail0);
	// round 5
	mix(v[0], v[4], v[8],  v[12], 0, tail0);
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
	mix(v[2], v[6], v[10], v[14], tail0, 0);
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
	mix(v[0], v[5], v[10], v[15], tail0, 0);
	mix(v[1], v[6], v[11], v[12], 0, 0);
	mix(v[2], v[7], v[8],  v[13], 0, 0);
	mix(v[3], v[4], v[9],  v[14], 0, 0);
	// round 8
	mix(v[0], v[4], v[8],  v[12], 0, 0);
	mix(v[1], v[5], v[9],  v[13], 0, 0);
	mix(v[2], v[6], v[10], v[14], 0, word1);
	mix(v[3], v[7], v[11], v[15], 0, 0);
	mix(v[0], v[5], v[10], v[15], 0, tail0);
	mix(v[1], v[6], v[11], v[12], 0, 0);
	mix(v[2], v[7], v[8],  v[13], 0, 0);
	mix(v[3], v[4], v[9],  v[14], 0, 0);
	// round 9
	mix(v[0], v[4], v[8],  v[12], 0, 0);
	mix(v[1], v[5], v[9],  v[13], 0, 0);
	mix(v[2], v[6], v[10], v[14], 0, 0);
	mix(v[3], v[7], v[11], v[15], tail0, 0);
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
	mix(v[3], v[4], v[9],  v[14], 0, tail0);
	// round 11
	mix(v[0], v[4], v[8],  v[12], tail0, word1);
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
	mix(v[1], v[6], v[11], v[12], tail0, 0);
	mix(v[2], v[7], v[8],  v[13], 0, 0);
	mix(v[3], v[4], v[9],  v[14], 0, 0);

	// compress — 48-byte digest = two 24-byte Xis.
	ulong h[6];
	h[0] = blake_state[0] ^ v[0] ^ v[8];
	h[1] = blake_state[1] ^ v[1] ^ v[9];
	h[2] = blake_state[2] ^ v[2] ^ v[10];
	h[3] = blake_state[3] ^ v[3] ^ v[11];
	h[4] = blake_state[4] ^ v[4] ^ v[12];
	h[5] = blake_state[5] ^ v[5] ^ v[13];

	// leaf 2i   = Xi bytes [0,24)  = h[0],h[1],h[2]
	// leaf 2i+1 = Xi bytes [24,48) = h[3],h[4],h[5]
	dropped += ht_store(0, ht, input * 2,
		h[0], h[1], h[2], rowCounters);
	dropped += ht_store(0, ht, input * 2 + 1,
		h[3], h[4], h[5], rowCounters);

	// KAT hook: dump raw digests for inputs 0 and 388 (leaves 0,1 and
	// 776,777) into debug[0..12) / debug[12..24) so the host can compare
	// GPU digests bit-exactly against the reference leaf hashes.
	uint dbase;
	if (input == 0) dbase = 0;
	else if (input == 388) dbase = 12;
	else dbase = 0xffffffff;
	if (dbase != 0xffffffff)
	  {
	    // raw word1 the compression actually consumed
	    debug[dbase + 24] = (uint)(word1 & 0xffffffff);
	    debug[dbase + 25] = (uint)(word1 >> 32);
	    // raw midstate words actually read from the __global buffer
	    debug[dbase + 26] = (uint)(blake_state[0] & 0xffffffff);
	    debug[dbase + 27] = (uint)(blake_state[0] >> 32);
	    debug[dbase + 28] = (uint)(blake_state[1] & 0xffffffff);
	    debug[dbase + 29] = (uint)(blake_state[1] >> 32);
	    debug[dbase + 30] = (uint)(tail0 & 0xffffffff);
	    debug[dbase + 31] = (uint)(tail0 >> 32);
	    debug[dbase + 0] = (uint)(h[0] & 0xffffffff);
	    debug[dbase + 1] = (uint)(h[0] >> 32);
	    debug[dbase + 2] = (uint)(h[1] & 0xffffffff);
	    debug[dbase + 3] = (uint)(h[1] >> 32);
	    debug[dbase + 4] = (uint)(h[2] & 0xffffffff);
	    debug[dbase + 5] = (uint)(h[2] >> 32);
	    debug[dbase + 6] = (uint)(h[3] & 0xffffffff);
	    debug[dbase + 7] = (uint)(h[3] >> 32);
	    debug[dbase + 8] = (uint)(h[4] & 0xffffffff);
	    debug[dbase + 9] = (uint)(h[4] >> 32);
	    debug[dbase + 10] = (uint)(h[5] & 0xffffffff);
	    debug[dbase + 11] = (uint)(h[5] >> 32);
	  }

	input++;
      }

#ifdef ENABLE_DEBUG
    debug[tid * 2] = 0;
    debug[tid * 2 + 1] = dropped;
#endif
}

/*
** Reference encoding: row(20b) | slot_a(6b) | slot_b(6b).
*/
#define ENCODE_INPUTS(row, slot0, slot1) \
    ((row << 12) | ((slot1 & 0x3f) << 6) | (slot0 & 0x3f))
#define DECODE_ROW(REF)   (REF >> 12)
#define DECODE_SLOT1(REF) ((REF >> 6) & 0x3f)
#define DECODE_SLOT0(REF) (REF & 0x3f)

/*
** Read `len` bytes from the 4-byte-aligned pointer `p` as up to three
** little-endian ulongs (via two aligned u32 loads per ulong).
*/
ulong half_aligned_long(__global ulong *p, uint offset)
{
    return
	(((ulong)*(__global uint *)((__global uchar *)p + offset + 0)) << 0) |
	(((ulong)*(__global uint *)((__global uchar *)p + offset + 4)) << 32);
}

/*
** XOR a colliding pair of table_{round-1} tails and store the result in
** table_{round}.  Each source tail is (25 - 3r) bytes long starting at
** xi_offset_for_round(round - 1); the incoming XOR value covers
** X[3r-1 .. 24) where byte 0 is the consumed W_{r-1} byte (zero for true
** pairs).
**
** Returns 1 if the pair is discarded (all-zero XOR = duplicate-input tree).
*/
uint xor_and_store(uint round, __global uchar *ht_dst, uint row,
	uint slot_a, uint slot_b, __global uchar *a, __global uchar *b,
	__global uint *rowCounters)
{
    // Source tail length = 25 - 3r bytes (r=1..6 → 22,19,16,13,10,7).
    // Load only whole-ulong pieces covering it; mask any tail spill so
    // out-of-tail bytes of the neighbouring slot can't corrupt the XOR.
    ulong xj0, xj1, xj2;
    xj0 = half_aligned_long((__global ulong *)a, 0)
	^ half_aligned_long((__global ulong *)b, 0);
    xj1 = xj2 = 0;
    if (round <= 2)
      {
	xj1 = half_aligned_long((__global ulong *)a, 8)
	    ^ half_aligned_long((__global ulong *)b, 8);
	xj2 = half_aligned_long((__global ulong *)a, 16)
	    ^ half_aligned_long((__global ulong *)b, 16);
	// r=1 tail 22 B: keep xj2's low 6 bytes. r=2 tail 19 B: low 3 bytes.
	ulong spill = (round == 1) ? 48 : 24;
	xj2 &= (1UL << spill) - 1;
      }
    else if (round <= 5)
      {
	// r=3 tail 16 B / r=4 tail 13 B / r=5 tail 10 B — xj1 covers them.
	xj1 = half_aligned_long((__global ulong *)a, 8)
	    ^ half_aligned_long((__global ulong *)b, 8);
	if (round == 4)
	    xj1 &= (1UL << 40) - 1;
	else if (round == 5)
	    xj1 &= (1UL << 16) - 1;
      }
    // r=6 source tail 7 B → xj0 alone suffices
    else
      {
	xj0 &= (1UL << 56) - 1;
      }

    // all-zero XOR = the pair shares a leaf tree (invalid solution)
    if (!xj0 && !xj1 && !xj2)
	return 1;
    return ht_store(round, ht_dst, ENCODE_INPUTS(row, slot_a, slot_b),
	    xj0, xj1, xj2, rowCounters);
}

/*
** Execute one Equihash round.  Read table_{round-1}, find in-row pairs whose
** tail byte0 low nibble matches (the 4 prefix bits not covered by the row
** index), XOR them, and store into table_{round}.
*/
void equihash_round(uint round,
	__global uchar *ht_src,
	__global uchar *ht_dst,
	__global uint *debug,
	__local uchar *first_words_data,
	__local uint *collisionsData,
	__local uint *collisionsNum,
	__global uint *rowCountersSrc,
	__global uint *rowCountersDst)
{
    uint		tid = get_global_id(0);
    uint		tlid = get_local_id(0);
    __global uchar	*p;
    uint		cnt;
    __local uchar	*first_words = &first_words_data[(NR_SLOTS+2)*tlid];
    uint		i, j;
    uint		dropped_stor = 0;
    __global uchar	*a, *b;
    // read compare nibbles (tail byte0 low nibble) of the source row;
    // table_{round-1} tails sit at their own staggered offset
    const uint src_xi_off = xi_offset_for_round(round - 1);
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
    p += src_xi_off;
    for (i = 0; i < cnt; i++, p += SLOT_LEN)
	first_words[i] = (*(__global uchar *)p) & 0x0f;
    // find collisions — pack (tid20 | i6 | j6): tid < 2^20, slots < 64
    for (i = 0; i + 1 < cnt; i++)
      {
	uchar data_i = first_words[i];
	uint collision = (tid << 12) | (i << 6) | (i + 1);
	for (j = i + 1; j < cnt; j++)
	  {
	    if (data_i == first_words[j])
	      {
		uint index = atomic_inc(collisionsNum);
		if (index < COLL_DATA_SIZE_PER_TH * EQ_WG_SIZE)
		    collisionsData[index] = collision;
		else
		    atomic_dec(collisionsNum);
	      }
	    collision++;
	  }
      }

part2:
    barrier(CLK_LOCAL_MEM_FENCE);
    uint totalCollisions = *collisionsNum;
    if (totalCollisions > COLL_DATA_SIZE_PER_TH * EQ_WG_SIZE)
	totalCollisions = COLL_DATA_SIZE_PER_TH * EQ_WG_SIZE;
    for (uint index = tlid; index < totalCollisions;
	    index += get_local_size(0))
      {
	uint collision = collisionsData[index];
	uint collisionThreadId = collision >> 12;
	uint i = (collision >> 6) & 0x3F;
	uint j = collision & 0x3F;
	__global uchar *ptr = ht_src + collisionThreadId * NR_SLOTS * SLOT_LEN;
	a = ptr + src_xi_off + i * SLOT_LEN;
	b = ptr + src_xi_off + j * SLOT_LEN;
	dropped_stor += xor_and_store(round, ht_dst, collisionThreadId,
		i, j, a, b, rowCountersDst);
      }
#ifdef ENABLE_DEBUG
    debug[tid * 2] = 0;
    debug[tid * 2 + 1] = dropped_stor;
#endif
}

/*
** kernel_round1 .. kernel_round5 — collision rounds (no sols argument).
*/
#define KERNEL_ROUND(N) \
__kernel __attribute__((reqd_work_group_size(EQ_WG_SIZE, 1, 1))) \
void kernel_round ## N(__global uchar *ht_src, __global uchar *ht_dst, \
	__global uint *rowCountersSrc, __global uint *rowCountersDst, \
       	__global uint *debug) \
{ \
    __local uchar first_words_data[(NR_SLOTS+2)*EQ_WG_SIZE]; \
    __local uint    collisionsData[COLL_DATA_SIZE_PER_TH * EQ_WG_SIZE]; \
    __local uint    collisionsNum; \
    equihash_round(N, ht_src, ht_dst, debug, first_words_data, collisionsData, \
	    &collisionsNum, rowCountersSrc, rowCountersDst); \
}
KERNEL_ROUND(1)
KERNEL_ROUND(2)
KERNEL_ROUND(3)
KERNEL_ROUND(4)
KERNEL_ROUND(5)

/*
** kernel_round6 — final collision round for K=7; also zeroes sols->nr.
*/
__kernel __attribute__((reqd_work_group_size(EQ_WG_SIZE, 1, 1)))
void kernel_round6(__global uchar *ht_src, __global uchar *ht_dst,
	__global uint *rowCountersSrc, __global uint *rowCountersDst,
	__global uint *debug, __global uchar *sols_raw)
{
    __global sols_t *sols = (__global sols_t *)sols_raw;
    uint		tid = get_global_id(0);
    __local uchar	first_words_data[(NR_SLOTS+2)*EQ_WG_SIZE];
    __local uint	collisionsData[COLL_DATA_SIZE_PER_TH * EQ_WG_SIZE];
    __local uint	collisionsNum;
    equihash_round(6, ht_src, ht_dst, debug, first_words_data, collisionsData,
	    &collisionsNum, rowCountersSrc, rowCountersDst);
    if (!tid)
	sols->nr = sols->likely_invalids = 0;
}

/*
** expand_ref: the "i" ref u32 that round `round` stored at its staggered
** offset.  Table `ht` is the buffer holding table_round — earlier rounds'
** refs in the same slot are at *lower* offsets and must not be read here.
*/
uint expand_ref(__global uchar *ht, uint round, uint row, uint slot)
{
    return *(__global uint *)(ht + row * NR_SLOTS * SLOT_LEN +
	    slot * SLOT_LEN + ref_offset_for_round(round));
}

/*
** Expand references to inputs.  Returns 1 while the solution appears valid
** (a duplicate leaf index detected at round 0 disqualifies it).
*/
uint expand_refs(uint *ins, uint nr_inputs, __global uchar **htabs,
	uint round)
{
    __global uchar	*ht = htabs[round % 2];
    uint		i = nr_inputs - 1;
    uint		j = nr_inputs * 2 - 1;
    int			dup_to_watch = -1;
    do
      {
	ins[j] = expand_ref(ht, round, DECODE_ROW(ins[i]),
		DECODE_SLOT1(ins[i]));
	ins[j - 1] = expand_ref(ht, round, DECODE_ROW(ins[i]),
		DECODE_SLOT0(ins[i]));
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
void potential_sol(__global uchar **htabs, __global sols_t *sols,
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
** Scan the final hash table (round K-1 = 6 → table0) for solutions.
** A solution requires the remaining 4-byte tail (X[20..24)) to be fully
** equal — same row covers X[18..19]+X[20]hi, so comparing the stored tail
** catches X[20]lo and the last window X[21..24).
*/
__kernel __attribute__((reqd_work_group_size(EQ_WG_SIZE, 1, 1)))
void kernel_sols(__global uchar *ht0, __global uchar *ht1,
	__global uchar *sols_raw,
	__global uint *rowCountersSrc, __global uint *rowCountersDst)
{
    uint		tid = get_global_id(0);
    __global sols_t	*sols = (__global sols_t *)sols_raw;
    __global uchar	*htabs[2] = { ht0, ht1 };
    uint		cnt;
    uint		i, j;
    __global uchar	*a, *b;
    uint		ref_i, ref_j;
    ulong		collisions;

    // final table = ht0 (round 6 is even); row counters live in
    // rowCountersSrc == rc0.  Table_6 tails sit at xi_offset_for_round(6)
    // = 16, their 4-byte refs at offset 12.
    const uint final_xi_off = xi_offset_for_round(PARAM_K - 1);
    a = ht0 + tid * NR_SLOTS * SLOT_LEN;
    uint rowIdx = tid/ROWS_PER_UINT;
    uint rowOffset = BITS_PER_ROW*(tid%ROWS_PER_UINT);
    cnt = (rowCountersSrc[rowIdx] >> rowOffset) & ROW_MASK;
    cnt = min(cnt, (uint)NR_SLOTS);
    a += final_xi_off;
    for (i = 0; i < cnt; i++, a += SLOT_LEN)
      {
	uint a_data = *(__global uint *)a;
	ref_i = *(__global uint *)(a - 4);
	for (j = i + 1, b = a + SLOT_LEN; j < cnt; j++, b += SLOT_LEN)
	  {
	    if (a_data == *(__global uint *)b)
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
