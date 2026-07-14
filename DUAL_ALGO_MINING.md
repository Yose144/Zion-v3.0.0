# Dual-Algo Parallel Mining — ZION + Pearl (PRL) PoUW

> **Status:** Active — ZION Deeksha shares + Pearl PoUW proofs mined in parallel on a single rig.
> **Last updated:** 2026-07-14

## Overview

The ZION miner supports **parallel dual-algo mining**: ZION Deeksha/PoW shares are submitted to the ZION pool while Pearl (PRL) Proof-of-Useful-Work proofs are simultaneously submitted to AlphaPool — all from a single process, on independent threads, with no GPU required (CPU fallback works).

```
┌─────────────────────────────────────────────────────────┐
│                   zion-miner process                     │
│                                                          │
│  ┌─────────────────┐     ┌──────────────────────────┐   │
│  │  ZION main loop │     │  Pearl PoUW stream       │   │
│  │  (deeksha_v1)   │     │  (pearl_real_pouw)       │   │
│  │                 │     │                          │   │
│  │  CPU hashing    │     │  BLAKE3 Merkle tree      │   │
│  │  → ZION pool    │     │  Noise generation        │   │
│  │  → shares       │     │  Noisy GEMM (int8)       │   │
│  │                 │     │  Jackpot hash check      │   │
│  │                 │     │  PlainProof serialize    │   │
│  │                 │     │  → AlphaPool submit      │   │
│  └────────┬────────┘     └───────────┬──────────────┘   │
│           │                           │                  │
└───────────┼───────────────────────────┼──────────────────┘
            │                           │
            ▼                           ▼
   62.171.141.136:8444        us2.alphapool.tech:5566
        (ZION pool)              (AlphaPool PPLNS)
```

## Quick Start

```bash
./target/release/zion-miner \
  --wallet zion1g5z6n3a6e240g676n0573070u284n0j7q3y27q4 \
  --pool 62.171.141.136:8444 \
  --algorithm deeksha_lite_v1 \
  --loops 1000000 \
  --pearl "us2.alphapool.tech:5566:prl1pk5t3amreqnqlp0q0l5zcauy2nyszlalux3rlcw93spwtr9mrlywsdesmmp"
```

### Flags

| Flag | Purpose |
|------|---------|
| `--wallet` | ZION payout address (`zion1...`) |
| `--pool` | ZION stratum pool (`HOST:PORT`) |
| `--algorithm` | ZION consensus algorithm (`deeksha_lite_v1`, `cosmic_harmony_ekam_deeksha_v2`, etc.) |
| `--loops` | Iteration count (use large value for continuous mining) |
| `--pearl` | Pearl PoUW stream config (`HOST:PORT:WALLET`) |
| `--threads` | CPU thread count (default: auto-detect) |
| `--gpu` | GPU backend: `auto`, `opencl`, `cpu` (default: `auto`) |

### Pearl Wallet Address

Pearl uses **bech32m** Taproot addresses with HRP `prl` (prefix `prl1p`):

```
prl1pk5t3amreqnqlp0q0l5zcauy2nyszlalux3rlcw93spwtr9mrlywsdesmmp
```

Generate a new one with Python:

```python
import os
CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"
def bech32_polymod(values):
    GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]
    chk = 1
    for v in values:
        b = chk >> 25
        chk = (chk & 0x1ffffff) << 5 ^ v
        for i in range(5):
            chk ^= GEN[i] if ((b >> i) & 1) else 0
    return chk
def bech32_hrp_expand(hrp):
    return [ord(x) >> 5 for x in hrp] + [0] + [ord(x) & 31 for x in hrp]
def bech32_create_checksum(hrp, data, spec):
    const = 0x2bc830a3 if spec == 'bech32m' else 1
    values = bech32_hrp_expand(hrp) + data
    polymod = bech32_polymod(values + [0]*6) ^ const
    return [(polymod >> 5 * (5 - i)) & 31 for i in range(6)]
def bech32_encode(hrp, data, spec):
    combined = data + bech32_create_checksum(hrp, data, spec)
    return hrp + '1' + ''.join([CHARSET[d] for d in combined])
def convertbits(data, frombits, tobits, pad=True):
    acc = bits = 0; ret = []; maxv = (1 << tobits) - 1
    for value in data:
        acc = (acc << frombits) | value; bits += frombits
        while bits >= tobits:
            bits -= tobits; ret.append((acc >> bits) & maxv)
    if pad and bits: ret.append((acc << (tobits - bits)) & maxv)
    return ret
witness_program = list(os.urandom(32))
data = [1] + convertbits(witness_program, 8, 5)
print(bech32_encode('prl', data, 'bech32m'))
```

## Architecture

### ZION Main Loop (`V3/L1/miner/src/main.rs`)

Standard ZION mining loop:
1. Connects to ZION stratum pool (`62.171.141.136:8444`)
2. Receives block templates via `zion-v3-stratum/0.2` protocol
3. Hashes with Deeksha/CosmicHarmony algorithm
4. Submits shares when hash meets target

### Pearl PoUW Stream (`AuXpow/src/pearl_real_pouw.rs`)

Independent parallel thread spawned by `--pearl` flag:

1. **Connect** to AlphaPool (`us2.alphapool.tech:5566`)
2. **Receive `pearl.challenge`** — `{seed, difficulty}` pushed immediately on connect
3. **Send `mining.authorize`** — fire-and-forget (AlphaPool doesn't respond with matching id)
4. **PoUW Mining Pipeline:**
   - Parse `IncompleteBlockHeader` (76 bytes) from challenge seed
   - Build `MiningConfiguration` (m=512, n=512, k=4096, noise_rank=256)
   - Compute `job_key = blake3(header || config)`
   - Generate random int8 matrices A (m×k) and B (k×n)
   - Build BLAKE3 keyed Merkle trees for A and B^T
   - Derive noise seeds: `noise_seed_b = blake3(job_key || hash_b)`, `noise_seed_a = blake3(noise_seed_b || hash_a)`
   - Generate noise matrices: E_AL (m×r), E_AR (r×k), E_BL (k×r), E_BR (r×n)
   - **Noisy GEMM:** C' = (A + E_AL·E_AR) × (B + E_BL·E_BR), tiled with jackpot hash per tile
   - **Jackpot hash:** XOR reduction of int32 tiles → rotl_xor into 16-element transcript → BLAKE3 keyed hash → compare to target
5. **Create PlainProof** — Merkle proofs for sampled rows/cols of A and B^T
6. **Serialize** — bincode → base64 (~178KB)
7. **Submit** via `submitPlainProof` JSON-RPC 2.0 method

### AlphaPool Protocol (pearl.challenge)

AlphaPool uses a custom protocol, NOT standard Stratum v1:

```
Server → Client:  {"id":null,"method":"pearl.challenge","params":{"seed":"<hex>","difficulty":32}}
Client → Server:  {"id":1,"method":"mining.authorize","params":{"wallet":"prl1p...","worker":"...","pass":"x","agent":"..."}}
Server → Client:  {"id":null,"method":"pearl.challenge","params":{"seed":"<hex>","difficulty":32}}  (re-sent, no authorize ack)
Client → Server:  {"id":2,"method":"submitPlainProof","params":{"plain_proof":"<base64>","mining_job":{"incomplete_header_bytes":"<base64>","target":<int>,"cert_version":0}}}
```

Key differences from suprnova Pearl stratum:
- **No `mining.subscribe`** — go straight to authorize
- **No authorize response** — AlphaPool ignores authorize and re-sends challenge
- **`pearl.challenge`** instead of `mining.notify` — seed + difficulty (leading zero bits)
- **`submitPlainProof`** instead of `mining.submit` — JSON-RPC 2.0 with `mining_job` object
- **No `mining.set_difficulty`** — difficulty is in the challenge

### AlphaPool Endpoints

| Region | Host | Port |
|--------|------|------|
| US East | `us1.alphapool.tech` | 5566 (PPLNS) / 5567 (SOLO) |
| US West | `us2.alphapool.tech` | 5566 / 5567 |
| Europe | `eu1.alphapool.tech` | 5566 / 5567 |
| Europe 2 | `eu2.alphapool.tech` | 5566 / 5567 |
| Russia | `ru1.alphapool.tech` | 5566 / 5567 |
| India | `in1.alphapool.tech` | 5566 / 5567 |
| Asia | `sg1.alphapool.tech` | 5566 / 5567 |

**Never use `pearl.alphapool.tech` as stratum host** — it's HTTPS/Cloudflare (dashboard), not TCP stratum.

## PoUW Algorithm Details

### Standard Configuration

| Parameter | Value | Description |
|-----------|-------|-------------|
| m | 512 | Output rows (A rows) |
| n | 512 | Output cols (B cols) |
| k | 4096 | Common dimension (dot product length) |
| noise_rank | 256 | Noise matrix inner dimension |
| noise_range | 128 | Value range for uniform random noise |
| hash_tile_h | 16 | Hash tile height |
| hash_tile_w | 16 | Hash tile width |

### Pipeline Steps

1. **Job Key Derivation**
   ```
   job_key = blake3(incomplete_header_bytes || mining_config_bytes)
   ```

2. **Merkle Tree Construction**
   - Pad matrix data to 1024-byte chunk boundary
   - Build BLAKE3 keyed Merkle tree (key = job_key)
   - Root hash = commitment to matrix contents

3. **Noise Seed Derivation**
   ```
   noise_seed_b = blake3(job_key || merkle_root_b)
   noise_seed_a = blake3(noise_seed_b || merkle_root_a)
   ```

4. **Noise Matrix Generation** (BLAKE3 PRNG)
   - E_AL: m×r uniform random int8 (range [-64, 63])
   - E_AR: r×k permutation matrix (±1 entries, one +1 and one -1 per column)
   - E_BL: k×r permutation matrix (±1 entries, one +1 and one -1 per row)
   - E_BR: r×n uniform random int8 (transposed)

5. **Noisy GEMM**
   ```
   A' = A + E_AL × E_AR    (int8, wrapping add)
   B' = B + E_BL × E_BR    (int8, wrapping add)
   C' = A' × B'            (int32 accumulation, tiled)
   ```

6. **Jackpot Hash** (per 16×16 hash tile within 256×256 output tiles)
   ```
   inner_hash = XOR_reduction(tile_int32_values)
   transcript[reduction_count % 16] = rotl(transcript[reduction_count % 16], 13) ^ inner_hash
   jackpot = blake3_keyed(transcript_bytes, key=noise_seed_a)
   if jackpot <= target: BLOCK FOUND
   ```

7. **PlainProof Construction**
   - Sample rows of A (hash tile rows) and columns of B^T (hash tile cols)
   - Generate multi-leaf BLAKE3 Merkle proofs for sampled rows/cols
   - Serialize as bincode → base64

## File Layout

| File | Purpose |
|------|---------|
| `AuXpow/src/pearl_real_pouw.rs` | Real Pearl PoUW pipeline (Merkle, noise, GEMM, jackpot, PlainProof) |
| `AuXpow/src/auxpow_client.rs` | Stratum client with PearlStratum + AlphaPool protocol support |
| `V3/L1/miner/src/main.rs` | Miner entry point with `--pearl` flag and `pearl_pouw_stream()` |
| `AuXpow/Cargo.toml` | Dependencies: blake3, bincode, base64, bytemuck, serde |

## Performance Notes

- **CPU mode:** Full PoUW pipeline runs on CPU. A single mining attempt (m=512, n=512, k=4096, rank=256) takes ~30-60 seconds on a 12-thread CPU. This is sufficient for testing but not competitive for real mining.
- **GPU mode (future):** OpenCL kernel for int8 GEMM on AMD GPU is planned. The CPU implementation is the reference; GPU will accelerate the noisy GEMM step.
- **Memory:** Each mining attempt allocates ~4MB for matrices A, B, noise matrices, and intermediate GEMM results.
- **Proof size:** ~178KB base64-encoded PlainProof (matches expected ~137KB binary size).

## Testing

### Unit Tests

```bash
cd AuXpow && cargo test pearl_real_pouw
```

8 tests covering:
- BLAKE3 Merkle tree (single/multi-chunk)
- Merkle proof verification
- Periodic pattern roundtrip
- Block header serialization
- Noise generation (all 4 matrices)
- PlainProof serialization (bincode + base64)
- Transcript rotl_xor accumulation

### E2E Test Against AlphaPool

```bash
./target/release/zion-miner \
  --pearl "us2.alphapool.tech:5566:prl1pk5t3amreqnqlp0q0l5zcauy2nyszlalux3rlcw93spwtr9mrlywsdesmmp" \
  --loops 1000000 \
  --algorithm deeksha_lite_v1 \
  --wallet zion1g5z6n3a6e240g676n0573070u284n0j7q3y27q4 \
  --pool 62.171.141.136:8444
```

Expected output:
```
pearl_stream: connecting to us2.alphapool.tech:5566 wallet=prl1p...
auxpow: PRL authorize sent (fire-and-forget for AlphaPool)
pearl_stream: connected and authorized
auxpow: PRL pearl.challenge — job=pearl_... seed_len=32 difficulty=32
auxpow: PRL real PoUW mining — m=512 n=512 k=4096 rank=256
auxpow: PRL mined proof — b64_len=178500
auxpow: PRL submit — job=pearl_... proof_b64_len=178500
```

## Troubleshooting

### Connection closed by AlphaPool

AlphaPool closes connections that:
- Send invalid JSON
- Send `submitPlainProof` with malformed `mining_job`
- Send `getMiningInfo` (not supported by AlphaPool, only by pearl-gateway)
- Idle for too long without submitting

### Invalid wallet address

AlphaPool requires `prl1p...` bech32m addresses. Bitcoin `bc1q...` addresses are rejected. Generate a Pearl address using the Python script above.

### No share found

With difficulty=32 (default), the target is `0x00000000FFFFFFFF...` which requires 32 leading zero bits in the jackpot hash. On CPU, this may take many attempts. The miner submits a dummy proof if no share is found, which AlphaPool will reject — this is expected behavior.

## References

- [Pearl Protocol Paper](https://arxiv.org/abs/2504.09971)
- [Pearl Open Source](https://github.com/alexpwrd/pearl) (node, wallet, miner, zk-pow)
- [AlphaPool](https://pearl.alphapool.tech/) (mining pool, 0% fee, PPLNS)
- [alpha-miner](https://github.com/AlphaMine-Tech/alpha-miner) (reference NVIDIA CUDA miner)
- [Pearl Stratum Spec (suprnova)](https://prl.suprnova.cc/stratum-spec.html)
- [Empirical Study of Pearl PoUW](https://arxiv.org/html/2606.04819v2)
