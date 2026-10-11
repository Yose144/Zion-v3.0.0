# Ekam Deeksha v3.2 — Algorithm Specification for SRBMiner Integration

**Audience:** SRBMiner-MULTI maintainer (doktor83) / any third-party miner implementing ZION PoW.
**Scope:** Everything needed to implement, verify, and submit shares for ZION (L1) mining —
hash function, wire protocol, test vectors, and reference code.
**Status:** Canonical — this is the live mainnet algorithm. `algorithm_for_height()` returns
`"ekam_deeksha"` unconditionally; the pool validator (`ShareValidator::zion_hash`) runs this
exact pipeline.

---

## 1. Network parameters

| Parameter | Value |
|---|---|
| Target block time | 60 s (LWMA retarget, window 60 blocks, solve-time clamp 6–360 s) |
| Minimum difficulty | 10 |
| PoW input | 80-byte header ‖ 8-byte nonce (LE) — **88-byte input** |
| Hash output | 32 bytes; share valid iff `hash <= target` (lexicographic big-endian u256) |
| Base block reward | 5400.067 ZION (`BASE_REWARD = 5_400_067_000` in 1e-6 units), tail ~724.785 |
| Coinbase split | 89 % miner · 5 % humanitarian · 5 % Issobella fund · 1 % pool/node |
| Reward scheme | PPLNS (`ZION_POOL_FEE_BPS`, default 100 = 1 %) |
| Payout address | `zion1…` bech32, 44 chars |
| Public pool | `stratum+tcp://62.171.141.136:8444` |

## 2. Wire header layout (what the pool sends)

`header_hex` in `mining.notify` is `MiningHeader::to_bytes()` — **80 bytes**:

```
[0..4]   version         u32 LE
[4..36]  previous_hash   32 B
[36..68] merkle_root     32 B
[68..76] timestamp       u64 LE
[76..80] difficulty_bits u32 LE
```

The miner **must not reinterpret** these fields — it hashes the 80 bytes verbatim
with the nonce appended. (Note: the node's internal `BlockHeader::pow_header()` uses
a different layout `prev|merkle|height|ts`; the stratum wire form above is the one
the pool and validator use.)

Hash input construction (`step1_keccak`):

```
input[88] = 0
input[0..hlen]  = header[0..hlen]   // hlen = min(80, header.len()); short headers zero-padded
input[80..88]   = nonce.to_le_bytes()
s1[32] = Keccak256(input)
```

## 3. Ekam Deeksha v3.2 pipeline — exact semantics

Constants: `SCRATCHPAD = 512 KiB`, `BLOCK_SIZE = 32`, `BLOCK_COUNT = 16384`,
`PASSES = 2`, `RANDOM_READS = 128`, `AES_ROUNDS = 2`.

> ⚠️ The scratchpad is seeded by `s1`, which depends on the nonce — **pad content
> is per-nonce**. Buffers may be reused across nonces (allocation reuse), but the
> pad must be refilled every hash. This is the ASIC-resistance property.

### Stage 1 — seed

```
s1 = Keccak256( pow_header[0..80] ‖ nonce_le[0..8] )
```

### Stage 2 — memory-hard scratchpad → `s2[32]`

**Phase A — SHA3-512 chain fill** (sequential):

```
state[64] = s1 ‖ 0x00×32
for blk in 0..16384:
    inp[0..64] = state
    inp[64]    = blk & 0xFF
    out        = SHA3-512(inp)          // 64 B
    pad[blk*32 .. blk*32+32] = out[0..32]
    state[0..32]             = out[0..32]
```

**Phase B — sequential XOR passes:**

Forward:
```
pad[0]      ^= pad[16383]             // wrap
pad[i]      ^= pad[i-1]   for i in 1..16384
```
Backward (PASSES ≥ 2):
```
pad[16383]  ^= pad[0]                 // wrap
pad[i]      ^= pad[i+1]   for i in (0..16383).rev()
```

**Phase C — 128 random reads:**

```
acc[32] = s1
pos = 0
for r in 0..128:
    acc[0..32] ^= pad[pos*32 .. pos*32+32]
    idx = u64_le(acc[0..8])
    pos = (idx ^ pos ^ r) mod 16384
s2 = acc
```

### Stage 3 — AES-128 CTR mix → `s3[32]`

```
key[16]     = s2[0..16]
counter[16] = nonce_le[0..8] ‖ s2[16..24]
block0 = counter
block1 = counter + 1          // byte-wise carry propagation, LSB-first
1 full AES-128 round on block0, block1 (sub_bytes→shift_rows→mix_columns→add round key)
1 final round on block0, block1 (same, minus mix_columns)
s3[0..16]  = block0
s3[16..32] = block1
s3 ^= s2[0..32]
```

AES uses the standard FIPS-197 S-box; `aes_round`/`aes_final_round` are textbook
rounds — see `ekam_deeksha.rs` for the exact table definitions.

### Stage 4 — final

```
hash = Keccak256(s3);   valid = hash <= target
```

## 4. Design properties

- **ASIC/FPGA resistance:** 512 KiB per-nonce scratchpad + sequential dependency
  chain + 128 scattered reads → memory-latency bound (CryptoNight-style hardness
  argument on SHA3/AES primitives).
- **GPU-viable:** all three kernels (OpenCL/CUDA/Metal) ship in-tree with byte
  parity to the CPU reference — verified by the locked KAT below.
- **Cheap validation:** pool recomputes the hash in ~ms on CPU — no GPU needed
  on the validation path.

## 5. Known-answer test vectors (locked — locked means: if your output differs,
your implementation is wrong, not the vectors)

Header for the 5-vector set: `LITE_KAT_HEADER = "ZION_LITE_KAT_V1"` (16 bytes;
shorter than 80 → zero-padded into bytes [16..80]):

| nonce | expected hash (hex) |
|---|---|
| `0` | `cd2de414f1e9c74e4023cedced65883c5295be2c3c94729c8de8c98518872c73` |
| `1` | `908f214814ccd24c03f2ef16223535c2846862cf1d1ab057e80bd597ba8a21aa` |
| `42` | `6edcfb4c5210b417ccadfd1620fbe51205a425cdae4c58151f14799c6e7290bf` |
| `0xDEADBEEF` | `c1bca4b577a925c28e6522e4bb9aaa0930ab7de638465074f3e1b591f10c747b` |
| `0xFFFFFFFFFFFFFFFF` | `92865072325f71769b4fd5896f87a9ed7227aa7bf016f87e78587d8a37891b87` |

Additional canonical vector — header `ZION_DEEKSHA_LITE_TEST_V1`,
nonce `0x123456789ABCDEF0` →

```
9cd303283063f36f7ea2b696b70b95c294c9143a53b884a1112cd2a7e357e224
```

Pool-side share validation recomputes the full hash — a divergent implementation
yields 100 % rejects.

## 6. Stratum wire protocol (ZION simplified-V1 dialect)

JSON-RPC over TCP, `\n`-delimited. Endpoint `stratum+tcp://62.171.141.136:8444`.
This dialect is a deliberately trimmed Stratum-V1: same method names, different
param shapes — bind it as a dedicated algorithm, not as generic sha256d/kheavy.

**Handshake:**

```json
→ {"id":1,"method":"mining.subscribe","params":["SRBMiner-MULTI/x.y"]}
← {"id":1,"result":[[["mining.set_difficulty","s1"],["mining.notify","s1"]],"<extranonce1-8hex>",4],"error":null}
→ {"id":2,"method":"mining.authorize","params":["zion1<44B-address>.<worker>","x"]}
← {"id":2,"result":true,"error":null}
```

**Job dispatch** — 5-param notify:

```json
{"method":"mining.notify","params":["<job_id>","<header_hex-160>","<target_hex-64>",<height>,true]}
```

`header_hex` = 160 hex chars (80 B) from §2; `target_hex` = 64 hex chars (32 B,
big-endian); `true` = clean_jobs (abort in-flight work).

**Difficulty:** `mining.set_difficulty [u64]` and `mining.set_target [64hex]`
push notifications are informational; the per-job `target_hex` is authoritative.

**Share submit** — simplified 4-param (a standard 5+-param form
`[worker, job_id, extranonce2, ntime, nonce, …]` is also accepted):

```json
→ {"id":N,"method":"mining.submit","params":["<worker>","<job_id>","<nonce_hex-16>","<hash_hex-64>"]}
← {"id":N,"result":true,"error":null}
← {"id":N,"result":null,"error":{...}}     // stale / low-diff / invalid
```

`nonce_hex` = the winning 64-bit nonce as 16 hex chars; `hash_hex` = the miner's
computed hash (64 hex chars) — the pool recomputes rather than trusting it.

## 7. Reference implementations (all in-tree)

| Component | Path (repo `github.com/Yose144/Zion-v3.0.0`) |
|---|---|
| CPU reference (canonical) | `V31/L1/cosmic-harmony/src/algorithm/ekam_deeksha.rs` |
| OpenCL kernel | `V31/L1/cosmic-harmony/src/gpu/kernels/ekam_deeksha.cl` |
| CUDA kernel | `V31/L1/miner/src/gpu/kernels/cuda/ekam_deeksha.cu` |
| Metal kernel | `V31/L1/miner/src/gpu/kernels/metal/ekam_deeksha.metal` |
| Pool validator | `V31/L1/pool/src/validator.rs` → `EkamDeeksha` |
| Stratum codec | `V31/L1/pool/src/stratum_v1.rs` |

GPU kernels are byte-parity ports — identical scratchpad schedule and AES rounds;
only the work-item mapping differs.

## 8. Observed performance

| Hardware | ZION hashrate (solo, Ekam Deeksha) |
|---|---|
| GTX 1070 Ti 8 GB (CUDA, SMOS) | ~210 KH/s |
| RX 5600 XT 6 GB (OpenCL) | ~120 KH/s |
| CPU per-thread | KH/s-scale (memory-bound) |

Memory-latency-bound profile: hash/watt and hash/byte-of-LDS scale with memory
subsystem, not ALU count.

## 9. Dual-mining note (QTC + ZION pairing)

- **Quantus (QPoW/Poseidon2)** is ALU-bound — tiny state, high IPC.
- **Ekam Deeksha** is memory-latency-bound — large per-nonce scratchpad traffic.

The two consume almost disjoint bottlenecks, so a `quantus + ekam_deeksha` dual
pair should approach additive throughput on RDNA/CDNA parts. Both algos' pools
live on the same endpoint; Quantus uses the miningcore-style `login`/`job`/`submit`
JSON-RPC binding that SRBMiner already speaks (shares accepted in production),
ZION uses the simplified-V1 dialect in §6 — one process, two stratum dialects.

## 10. Handoff

- Maintainer: ZION core team via `github.com/Yose144/Zion-v3.0.0`.
- Algorithm is **frozen for mainnet**; any spec change ships through a network
  upgrade with public notice — never silently.
- Everything required for integration is public in-tree; the test vectors are
  the contract.
