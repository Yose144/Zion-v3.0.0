// Ethash / Etchash (ETC/ETHW) OpenCL placeholder kernel.
//
// NOTE: This is a PHASE-2 SCAFFOLD.  It does NOT implement the real Ethash
// DAG-based algorithm; it computes a SHA3-256 of (header_blob || nonce)
// and checks the target.  It is functionally equivalent to the placeholder
// CPU hasher in zion_auxpow::external_hashers.
//
// The real Ethash algorithm requires a per-epoch light cache and a multi-GB
// DAG that is looked up during hashing.
//
// References:
//   - https://github.com/ethereum-mining/ethminer (libethash-cl/kernels/cl/ethash.cl)
//   - https://github.com/Genoil/cpp-ethereum (libethash-cl/ethash_cl_miner_kernel.cl)
//   - https://github.com/luminousmining/miner (sources/algo/ethash/opencl/)

#define ROTL64(x, n) (((x) << (n)) | ((x) >> (64 - (n))))

__constant const ulong KECCAK_RC[24] = {
    0x0000000000000001UL, 0x0000000000008082UL, 0x800000000000808aUL,
    0x8000000080008000UL, 0x000000000000808bUL, 0x0000000080000001UL,
    0x8000000080008081UL, 0x8000000000008009UL, 0x000000000000008aUL,
    0x0000000000000088UL, 0x0000000080008009UL, 0x000000008000000aUL,
    0x000000008000808bUL, 0x800000000000008bUL, 0x8000000000008089UL,
    0x8000000000008003UL, 0x8000000000008002UL, 0x8000000000000080UL,
    0x000000000000800aUL, 0x800000008000000aUL, 0x8000000080008081UL,
    0x8000000000008080UL, 0x0000000080000001UL, 0x8000000080008008UL
};

void keccak_f1600(ulong state[25]) {
    for (int round = 0; round < 24; round++) {
        ulong c[5], d[5];
        for (int x = 0; x < 5; x++)
            c[x] = state[x] ^ state[x+5] ^ state[x+10] ^ state[x+15] ^ state[x+20];
        for (int x = 0; x < 5; x++)
            d[x] = c[(x+4)%5] ^ ROTL64(c[(x+1)%5], 1);
        for (int i = 0; i < 25; i++) state[i] ^= d[i%5];

        ulong temp = state[1];
        for (int t = 0; t < 24; t++) {
            int idx = (t * 7 + 1) % 25;
            ulong tmp2 = state[idx];
            state[idx] = ROTL64(temp, ((t+1)*(t+2)/2) % 64);
            temp = tmp2;
        }

        for (int y = 0; y < 5; y++) {
            ulong row[5];
            for (int x = 0; x < 5; x++) row[x] = state[y*5+x];
            for (int x = 0; x < 5; x++)
                state[y*5+x] = row[x] ^ ((~row[(x+1)%5]) & row[(x+2)%5]);
        }
        state[0] ^= KECCAK_RC[round];
    }
}

void sha3_256(__global const uchar *input, const uint len, uchar *output) {
    ulong state[25];
    for (int i = 0; i < 25; i++) state[i] = 0;
    uint offset = 0;
    while (offset + 136 <= len) {
        for (int i = 0; i < 17; i++) {
            ulong block = 0;
            for (int j = 0; j < 8; j++)
                block |= ((ulong)input[offset + i*8 + j]) << (j*8);
            state[i] ^= block;
        }
        keccak_f1600(state);
        offset += 136;
    }
    uchar padded[136];
    for (int i = 0; i < 136; i++) padded[i] = 0;
    uint remaining = len - offset;
    for (int i = 0; i < remaining; i++) padded[i] = input[offset + i];
    padded[remaining] = 0x06;
    padded[135] |= 0x80;
    for (int i = 0; i < 17; i++) {
        ulong block = 0;
        for (int j = 0; j < 8; j++)
            block |= ((ulong)padded[i*8 + j]) << (j*8);
        state[i] ^= block;
    }
    keccak_f1600(state);
    for (int i = 0; i < 4; i++)
        for (int j = 0; j < 8; j++)
            output[i*8 + j] = (uchar)(state[i] >> (j*8));
}

__kernel void ethash_mine(
    __global const uchar *header_blob,
    const uint header_len,
    __global const uchar *target,
    ulong base_nonce,
    __global ulong *output_nonce,
    __global uchar *output_hash,
    __global volatile uint *found
)
{
    if (atomic_load(found)) return;
    ulong candidate = base_nonce + (ulong)get_global_id(0);

    uchar input[120];
    uint len = header_len;
    if (len > 112) len = 112;
    for (int i = 0; i < (int)len; i++) input[i] = header_blob[i];
    for (int i = 0; i < 8; i++) input[len + i] = (uchar)(candidate >> (i*8));
    len += 8;

    uchar hash[32];
    sha3_256(input, len, hash);

    int meets = 1;
    for (int i = 0; i < 32; i++) {
        if (hash[i] < target[i]) { meets = 1; break; }
        if (hash[i] > target[i]) { meets = 0; break; }
    }
    if (meets) {
        uint old = atomic_xchg(found, 1u);
        if (old == 0u) {
            *output_nonce = candidate;
            for (int i = 0; i < 32; i++) output_hash[i] = hash[i];
        }
    }
}
