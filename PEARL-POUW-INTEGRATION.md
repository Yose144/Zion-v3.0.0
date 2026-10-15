# Pearl (PRL) PoUW — canonical spec, gap analysis, integration plan

Status: **2026-10-14 — LIVE CUDA → SUPRNOVA: 3 ACCEPTED SHARES,
ALL 3 INDEPENDENTLY VERIFIED BY THE OFFICIAL V3 VERIFIER** (see §10 and
`PEARL-POUW-LIVE-VERIFICATION.json`). The isolated diagnostic used the
GTX 1070 Ti native CUDA backend and real cert3 jobs. This establishes
external-pool share acceptance, **not** live ZION `PearlSubmit` acceptance
or a block accepted by `pearld`. Production PRL auto-routing remains
disabled. No production binary, SMOS group/wrapper, Hiran/SRBMiner
configuration, pool/gateway environment, or running service was changed.
The local-fixes-only stage in §9 is historical; its last recorded node
sample was `blocks=headers=127309`. Height 127856 in §10 belongs to the
external pool's captured job, not a fresh measurement of our node's tip.
Goal: Pearl as a native mining algo in zion-miner — OpenCL **and** a
dedicated NVIDIA CUDA backend — shares via ZION V3 pool bridge (:8444) →
Pearl gateway on Edge → `prl1p…` payout wallet.

Upstream reference: `zk-pow` crate (Pearl Research Labs monorepo, cloned to `/tmp/pearl`).
Canonical miner entry: `zk-pow/src/ffi/mine.rs::try_mine_one` (+ `_moe` variant).

---

## 1. Canonical algorithm (dense, non-MoE)

Per attempt — there is **no nonce field**: each attempt draws fresh random
matrices (OS RNG in reference). Our deterministic `PCG32(nonce)` matrixgen is
spec-legal because the verifier never checks the generator, only the committed
rows.

```
A[m×k], B[k×n]         i8 in [-64, 64]   (m=n=k = common_dim, e.g. 4096)
job_key                = blake3(header_76B || config_52B)          [unkeyed, 128B = 1 chunk/2 blocks]
padded_A, padded_Bt    = zero-pad row-major bytes to 1024B boundary (i8 → raw byte)
hash_a, hash_b         = keyed-blake3 Merkle roots (key=job_key)
salted roots (V3)      = bind_root_a = blake3_keyed(SEED_SALT_A, hash_a || m:u32LE || 28×00)
                       = bind_root_b = blake3_keyed(SEED_SALT_B, hash_b || n:u32LE || 28×00)
b_noise_seed           = blake3(job_key || hash_b_eff)             [unkeyed, 64B]
a_noise_seed           = blake3(b_noise_seed || hash_a_eff)        [unkeyed, 64B]
E_AL[m×rank], E_BR[n×rank]  uniform noise:  (blake3_keyed(seed_a/b, msg) byte & 63) - 32
E_AR, E_BL             sparse permutations (see §3)
A' = A + E_AL·E_AR     B' = B + E_BL·E_BR    (i8 wrap? → int32 accum)
tile matmul            for each rank-chunk ll ∈ {rank, 2·rank, …, k}:
                         tile[u][v] += Σ_{l∈[ll-rank,ll)} A'[row][l]·B'[l][col]
                         xored = XOR-fold all tile i32 (as u32)
                         tid = (ll/rank - 1) % 16
                         jackpot[tid] = rotl32(jackpot[tid], 13) ^ xored
jackpot_hash           = blake3_keyed(a_noise_seed, jackpot[16×u32 LE])   (64B msg)
accept iff             U256::from_little_endian(jackpot_hash) ≤ target    [LE hash]
proof                  = PlainProof{m,n,k,rank, a:MatrixMerkleProof,
                       bt:MatrixMerkleProof, moe:None}
```

Constants: `JACKPOT_SIZE=16`, `LROT_PER_TILE=13`, `PENALTY_BASE_RANK=128`,
`CHUNK_LEN=1024`, `NOISE_RANGE=128`, `UNIFORM range=64`, `ZERO_POINT=32`,
`RANGE_MASK=63`, `IDXS_PER_COL=2`.

Difficulty: effective jackpot bound =
`min(base_target * tile_size * (dpl/rank) * 128, U256_MAX)` where
`dpl = k - k % rank` (dot-product length) — see `api/sanity_checks.rs`.
At rank 128 the multiplier reduces to `tile_size * dpl`. The pool's share
target is `min(block_target * share_ease, U256_MAX)` — saturation, never
modulo — and the network block target itself is never modified.

## 2. Wire formats

- `IncompleteBlockHeader::to_bytes()` **76B**: `version u32LE | prev_block rev | merkle_root rev | timestamp u32LE | nbits u32LE` (hashes stored display-order → reversed).
- `MiningConfiguration::to_bytes()` **52B**: `common_dim u32LE | rank u16LE | mma_type u16LE (0=Int7) | rows_pattern 6B | cols_pattern 6B | trailer 32B (e u16LE|top_k u16LE|zeros → MoE only)`.
- `PeriodicPattern::to_bytes()` **6B**: 3 dims × `(factor-1, length-1)`, cumulative `min_stride`.
- `PeriodicPattern::to_list()`: offsets via cartesian `res += i*stride`.
- Gateway JSON-RPC (`pearl-gateway`, line-delimited TCP/UDS):
  `getMiningInfo` → `submitPlainProof{plain_proof: base64(bincode(PlainProof)), mining_job:{incomplete_header_bytes, target, cert_version}}`.
- `PlainProof` bincode layout: `m,n,k,noise_rank:usize(8B LE each) | a: MatrixMerkleProof | bt: MatrixMerkleProof | moe:Option` (None tag `0x00`; legacy V1 blobs get the tag appended → `deserialize_compat`).

## 3. Noise details (`circuit/pearl_noise.rs`)

- `get_random_hash(seed, key, prepend_idx, hash_idx)`: `msg[4·prepend_idx..+4] = (1+hash_idx):u32LE` (8 slots, other 28B zero), `msg[32..64] = seed`; out = `blake3_keyed(key, msg)` (64B).
- Uniform matrix: values = `(byte & 63) - 32` from successive hash blocks.
- Sparse perm row `i` (rank `r`, pow2): `first = u32_i & (r-1)`; `second = first ^ (1 + hi32((r-1) * u32_i))` — **uses mul-hi of same random word**, then `noise_out[x] = E[x][first] - E[x][second]`.
- Canonical computes `E_AL·E_AR` (A-side) and `E_BL·E_BR` (B-side) as low-rank product — our kernel applies the equivalent sparse-matvec directly.

## 4. Our implementation status

Kernel: `V31/L1/miner/csrc/opencl/pearl_pouw_native.cl` (~1100 lines).
Host: `V31/L1/miner/src/auxpow/gpu_opencl_full.rs` (buffers, proof build).
Pool: `V31/L1/pool/src/pearl.rs` (PlainProof bincode decode + full local
share verifier — merkle proofs → salted seed chain → noise → tile jackpot →
penalized bound; 4/4 unit tests), `V31/L1/pool/src/pearl_gateway.rs`
(`PearlRuntime` — line-delimited JSON-RPC `getMiningInfo` poller,
`submitPlainProof` forwarder, `ExternalStreamJob` translation; env
`ZION_POOL_PEARL_GATEWAY`/`_POLL_MS`/`_SHARE_EASE`/`_JOB_TTL_MS`).
Stratum wiring: `ExternalCoin::Pearl` injected into the V3 external_stream
coin list, `PearlSubmit` handler verifies locally then forwards
block-meeting proofs, `all_external_job_ids` fingerprints `PRL:<id>` so a
gateway template rotation triggers a rebroadcast (1s feed loop).
`ExternalCoin::Pearl` still `.with_disabled` in profit.rs until live-tested.

### Confirmed gaps (must fix before any live share)

| # | Item | Canonical | Ours | Status |
|---|------|-----------|------|--------|
| G1 | **V3 salted roots** | `bind_root_a/b` keyed by `SEED_SALT_A/B` — required for cert_version=3 (current chain) | `PearlSeedDerivation::{Legacy,Salted}` + `PEARL_SEED_SALT_A/B`; CPU bind in host (single + batched), KAT-pinned vs upstream | ✅ FIXED |
| G2 | **Chunk counter** | `hash_chunks`: leaf chunk #i compressed with `counter=i` (non-root CV) | kernel now passes `(ulong)gid` as counter; `single_root` flag adds ROOT for 1-chunk matrices | ✅ FIXED |
| G3 | Odd-leaf propagation | `combine_layer` pushes unpaired CV up unchanged; root only via `merge_subtrees_root` when 2 remain | merge kernel: `ceil(n/2)`, odd child propagates unchanged, `is_root` flag; host loops updated | ✅ FIXED |
| G4 | Noise seed order | `b=blake3(job_key‖hash_b)`, `a=blake3(b_seed‖hash_a)` | CPU-side derivation in host; noise kernels get (seed=label, key=noise_seed) — was swapped | ✅ FIXED |
| G5 | Target endian | `U256::from_little_endian(hash) ≤ bound` | GPU parity test passes with LE-hash vs target compare | ✅ VERIFIED |
| G6 | `get_random_hash` prepend slot | `u32` at `4·prepend_idx`, seed at 32..64 | kernel writes seed at words 8..15, prepend word index — likely OK | ✅ likely |
| G7 | Perm noise `mul_hi` | `hi32((r-1)*u32)` same word | `pearl_gen_permutation` matches exactly | ✅ MATCH |
| G8 | Uniform noise | `(b&63)-32` | `pearl_gen_uniform_noise` matches | ✅ MATCH |
| G9 | Sparse noise matvec | `E[x][first]-E[x][second]` | `pearl_apply_noise_a/b` match | ✅ MATCH |
| G10 | Jackpot accum | `rotl13 ^ xor-fold`, `tid=(ll/rank-1)%16` | exact match incl. `LROT=13` | ✅ MATCH |
| G11 | Jackpot hash | `blake3_keyed(a_noise_seed, 64B)` | `blake3_keyed_hash_64_gpu` match | ✅ MATCH |
| G12 | Tile/proof mapping | `compute_leaf_indices_from_rows`, patterns partition | `auxpow/pearl.rs::leaf_indices_from_rows` + `tile_row_col_indices` (kernel 4×8 hash-tile decode) | ✅ External CUDA pool + official V3 verified (§10); live ZION path pending |
| G13 | PlainProof bincode | serde bincode struct order + Option tag | `auxpow/pearl.rs::encode_plain_proof` + `proof_encoding_layout` test; pool `decode_plain_proof` decodes the same layout | ✅ External CUDA pool + official V3 verified (§10); live ZION path pending |
| G14 | Config choice | miner chooses geometry/config; `getMiningInfo` supplies header, target and cert_version | miner-chosen `PearlMineConfig` (env-overridable, current default m=n=1024, k=2048, rank=128 — the prior k=1024/rank=128 was invalid: upstream `public_params_sanity_check` requires `k >= 16·rank`); upstream-legal — `PlainProof` carries the dims | ✅ DONE |

### Fixes applied beyond gap table (2026-10-12)

- **Keyed Merkle parents**: merge kernel CV = job_key words, flags `PARENT|KEYED_HASH(+ROOT)` (was unkeyed `BLAKE3_IV`).
- **1-chunk root**: chunk kernel writes directly to `root_a/b_buf` with ROOT flag (canonical `merge_subtrees_root` single-leaf path).
- **A/B scratch aliasing**: added `merkle_buf2` — A merge wrote into the buffer holding B chunk hashes.
- **Matrix zero-padding**: `matrix_a/b` buffers allocated `num_chunks*1024` + `.fill_val(0)` (kernel reads full 1024B chunks; tail must be zeros, not OOB).
- **Launch legality**: `enq_pow2` helper (`safe_lws` divisor + `round_up_gws`) applied to all Pearl launches — fixes `CL_INVALID_WORK_GROUP_SIZE` when gws < lws.
- KAT (`pearl_kat` mod): `pearl_commitment_hash_upstream_pinned`, `pearl_get_random_hash_layout`, `pearl_seed_labels_are_padded`, `pearl_seed_salts_match_context_strings`, `pearl_merkle_root_is_keyed_blake3` — **5/5 pass**; `pearl_gpu_parity_vs_cpu_reference` — **PASS** (Apple OpenCL CPU device, 2.5s).

### Biggest risks

1. G1+G2 invalidate every proof on today's chain → fix first, then KAT.
2. AlphaPool stratum wire is closed-source (`alpha-miner`) — but gateway
   JSON-RPC is public; pool bridge can talk gateway protocol directly (or run
   `pearld`+`pearl-gateway` on Edge for solo).
3. `getMiningInfo` response shape (mining job, config fields, cert_version) —
   extract from `pearl-gateway` schemas before wiring job-serve.

## 5. Plan (ordered)

1. ✅ Spec extraction (this doc).
2. ✅ G1–G5 + aliasing/padding/launch fixes (single + batched paths); CPU KAT
   5/5 + GPU parity PASS on Apple OpenCL device.
3. KAT vs upstream `try_mine_one` replay (stronger end-to-end; current KAT is
   local CPU reference + upstream-pinned constants) — still open.
4. ✅ Pearl wallet (2026-10-13): `oyster --createfromfile` non-interactive →
   pool payout addr `prl1pzy8mjq96a0yhw6luuv2m55xqvsujw23u0mqsa2rw4jxsefd82chqca7a5m`;
   mnemonic + create-file in `/etc/zion/pearl-wallet-*.txt|.json` (600, Edge only,
   never repo).
5. ⏳ Pool bridge (DONE server-side 2026-10-12): V3 `PearlSubmit` → local
   verify → gateway `submitPlainProof`; `getMiningInfo` → V3
   `ExternalStreamJob` (header 76B hex in `header_hex`, share target 32B BE
   in `target_hex`, cert_version in `eq_params`, `algorithm="pearlhash"`,
   `protocol="pearlgw"`); PRL shares credit PPLNS via `record_external_share`
   (`ZION_POOL_AUXPOW_WEIGHT_PRL` override) + telemetry +
   `RevenueSource::PearlExternal` routing. **Miner side DONE (2026-10-12):**
   `auxpow/pearl.rs` — `PeriodicPattern`/`PearlMineConfig` (env-overridable;
   prior default m=n=k=1024 rank=128 — superseded by k=2048, see §9 — rows
   [0,8,64,72] cols [0,1,8,9,64,65,72,73], unchanged — kernel tile is 4×8;
   tile grid is 256 row groups × 128 col groups at m=n=1024), keyed merkle
   tree + `multileaf_proof` (upstream sibling-order port),
   `build_plain_proof` + bincode encoder, tile-index → row/col decode.
   `GpuMiner::mine_pearl` (default bail, impl on `OpenClExternalMiner` and
   `PearlCudaMiner`), `"pearlhash"` added to `is_external_algorithm`,
   `V3PoolClient::submit_pearl_share` (PRL per-coin result channel),
   `mine_v3_pearl_attempt` dispatch inside `mine_v3_external_share` — one GPU
   call per attempt, spawn_blocking + persistent backend (same pattern as
   `try_gpu_ext_share`); effective kernel bound =
   `min(share_target * tile_size * (dpl/rank) * 128, U256_MAX)`
   (rank-penalty adjustment, matches pool bound — see §1).
6. ✅ Edge infra (2026-10-13, see §6); PPLNS accounting under coin `PRL`
   via `record_external_share` (weight `ZION_POOL_AUXPOW_WEIGHT_PRL`,
   fallback `ZION_POOL_AUXPOW_PPLNS_WEIGHT`, default 500).
7. Enable miner flag `--pearl` next to `--quantus` only after live
   `submitPlainProof` accepted (or upstream solo block). pearld initial
   sync is done (tip 127309 at last sample); the remaining gates are the
   live round-trips listed under §6 "Still open" — all user-deferred, no
   production routing change made in this continuation.

## 6. Edge deployment (2026-10-13)

Upstream monorepo lives at **`/opt/pearl`** (outside `/opt/zion` — a nested
checkout under the ZION workspace breaks cargo resolution:
`workspace.package` inheritance errors). Build chain:

- `zk-pow`: `cargo build --release --bin build_cache` → run it → writes
  `src/circuit/v2_cache.bin` + `src/v1/v1_cache.bin` (2.4MB each,
  gitignored, **required before** building `bindings/go` which enables
  `embedded_cache`/`include_bytes!`). Then `cd zk-pow/bindings/go &&
  cargo build --release` → `libzk_pow_ffi.a` (89MB staticlib).
- `xmss`: `make` → `libxmss.a`.
- `go build -buildvcs=false -tags xmss,zkpow` → `bin/pearld`,
  `bin/prlctl` (CGO links via `#cgo` relative paths; `-buildvcs=false`
  needed — git safe.directory).
- Wallet: `go build -tags xmss,zkpow` in `wallet/` → `bin/oyster`,
  `bin/oystercli`.
- Gateway: `uv sync --package pearl-gateway` → `/opt/pearl/.venv` (4.7G,
  pulls torch+CUDA wheels).

Systemd units (all enabled, logs `/var/log/zion-pearl-*.log`):

| unit | binary | config/env | listens |
|---|---|---|---|
| `zion-pearld` | `/opt/pearl/bin/pearld --configfile=/opt/pearl/pearld.conf` | generated rpcuser/rpcpass, `notls=1`, datadir `/opt/pearl/data` | RPC `127.0.0.1:44107`, P2P `0.0.0.0:44108` (UFW allowed) |
| `zion-pearl-oyster` | `/opt/pearl/bin/oyster --configfile=/opt/pearl/oyster.conf` | `noservertls`+`noclienttls`, rpcconnect→pearld | RPC `127.0.0.1:44207` |
| `zion-pearl-gateway` | `/opt/pearl/.venv/bin/pearl-gateway start` (subcommand required!) | `EnvironmentFile=/etc/zion/pearl-environment.sh` | miner_rpc TCP `127.0.0.1:8477` |

`/etc/zion/pearl-environment.sh` (600): `PEARLD_RPC_URL/USER/PASSWORD`,
`PEARLD_MINING_ADDRESS=prl1pzy8mjq…`, `MINER_RPC_{TRANSPORT=tcp,HOST=127.0.0.1,
PORT=8477}` — note **8477 not 8337** (8337 is V31 node3 P2P).

Pool side: `zion-v31-pool` env added `ZION_POOL_PEARL_{GATEWAY=127.0.0.1:8477,
POLL_MS=2000,SHARE_EASE=256,JOB_TTL_MS=30000}` (edge-environment.sh, backup
`.bak-pearl-20261013`); binary rebuilt from `8354fc5cb`, backup
`zion-pool.bak-pre-pearl-*`.

### Bugs found during live bring-up

- **U256 `target` vs serde_json**: `serde_json::Number` stores >u64 values as
  f64 → `to_string()` yields scientific notation → `BigUint` parse fail
  ("bad target: invalid digit"). Fix `8354fc5cb`: `quote_target_digits()`
  rewrites bare `"target":NNN…` (>15 digits) to a string literal on the raw
  response line before `serde_json::from_str`; `PearlJob.target_dec` keeps
  the verbatim decimal for `submitPlainProof` echo (which is sent as a bare
  number in hand-assembled JSON).
- **`gpu-opencl` feature gate**: `runtime.rs`/`gpu/mod.rs` referenced
  `auxpow::gpu_opencl_full::Pearl*` types — the module is gated → pool build
  (zion-miner as dep w/o feature) failed E0432. Fix `f1c8a4263`: plain data
  types (`PearlPouwNativeInput/Result`, `PearlSeedDerivation`,
  `PEARL_SEED_{LABEL,SALT}_{A,B}`) moved to ungated `auxpow::pearl`;
  `gpu_opencl_full` re-exports.
- **`--nousb` flag** doesn't exist on pearld (btcd leftover) — removed from
  unit.
- **pearld RPC TLS**: enabled by default; gateway+wallet expect plain HTTP on
  localhost → `notls=1` on pearld, `noservertls`+`noclienttls` on oyster.
- **`pearl-gateway` CLI**: requires `start` subcommand (bare binary prints
  usage and exits 1).

### Live verification so far

- `getMiningInfo` → `{"incomplete_header_bytes":"<b64,76B>","target":411369…
  (78-digit U256),"cert_version":1}` — parsed by `PearlJob::from_rpc_result`.
- Pool log: `pearl_gateway: new job cert_version=1 header=AAA…` —
  `latest` job populated → V3 `ext_stream` broadcasts include `PRL:<id>` in
  the fingerprint → rebroadcast on rotation works.
- `cert_version=1` while pearld tip is under the salted-seed fork height —
  miner maps `>=3→Salted`, else `Legacy`; pool verifier likewise.

### Still open before enabling `--pearl` (all user-deferred 2026-10-13)

- Live miner→pool `PearlSubmit` accepted (a real share acknowledged by the
  pool) — not yet verified; production routing stays disabled.
- Live `submitPlainProof` round-trip: block-meeting proof → gateway enqueue
  → **node `Accepted`**. Note the gateway `miner_rpc/server.py` answers
  `submitted` immediately and processes asynchronously; upstream
  `submission_service.py` logs `Block accepted by node!` only after pearld
  acceptance. An RPC enqueue acknowledgement is NOT block acceptance.
- `profit.rs` `.with_disabled` flip for `ExternalCoin::Pearl` — do NOT
  enable before an actual node `Accepted`.

Done since this list was written: pearld full sync (last recorded sample
`blocks=headers=127309`), on-device CUDA parity + default-config runs on
the 1070 Ti (§7, §9).

## 7. CUDA backend (2026-10-13, commit `61a9ee31c`)

The CUDA implementation mirrors the OpenCL pipeline. On-device parity on
the GTX 1070 Ti is verified for the two fixtures below, not every possible
GPU or geometry. The rig is CUDA-first (NVRTC JIT through `cudarc`, same
pattern as the QPoW CUDA backend). Files:

| piece | path |
|---|---|
| kernel | `V31/L1/miner/csrc/cuda/pearl_pouw_native.cu` — 9-kernel port of the `.cl` (gen_matrix, keyed chunk/merge/small BLAKE3, gen_uniform/gen_permutation, apply_noise A/B, `pearl_pouw_mine_native_v3` tile matmul + jackpot + LE target check). Scalar params for the mine kernel are packed into a `u32[4]` device buffer (cudarc launch-tuple arity). |
| host | `V31/L1/miner/src/gpu/pearl_cuda.rs` — `PearlCudaMiner` mirrors `pearl_pouw_mine_native` step-for-step: zero-padded matrix buffers, `chunk_hashes`/`merkle`/`merkle2` ping-pong (B leaf layer must not alias A's merge scratch), salted bind on CPU, `b→a` seed chain via `small_hash`, readback only on `found`. |
| dispatch | `gpu/mod.rs` — `"pearlhash"` routes to `PearlCudaMiner` under `GpuBackendKind::Cuda` **before** `CudaExtAlgo::from_name` (dedicated pipeline, not a `mine_batch` hasher). `shared_cuda_device` exposed so Stream 1 shares the context. |
| runtime | `ZION_EXT_GPU_BACKEND` env overrides the external-stream backend (mirrors `ZION_QPOW_BACKEND`) — allows e.g. ZION on OpenCL + Pearl on CUDA on the same rig. |

CPU KAT reference (`pearl_kat`) moved to `auxpow/pearl.rs` as
`pub(crate)` — OpenCL and CUDA on-device parity tests share ONE consensus
reference (duplicating it is how the `0x44`/`0x48` salt-typo class of bugs
happens). CUDA parity test `pearl_cuda_parity_vs_cpu_reference` is
`#[ignore]`d — runs where a CUDA device exists (the 1070 Ti rig). Its
small fixture (m=48, n=64, k=64, rank=32 — 6 tiles) is a **mathematical
parity check only**, not a consensus-valid network configuration (k=64
violates `k >= 16·rank` and `k >= 1024`); the production-geometry run is
`pearl_cuda_default_config_repeated_attempts` (m=n=1024, k=2048, r=128) —
both executed on the 1070 Ti, see §9.

Cross-crate wire test (`pool/pearl.rs::pearl_miner_wire_proof_accepted`):
miner's production `build_plain_proof` + `encode_plain_proof` → base64 →
pool `decode_plain_proof` → `verify_pearl_share` → `is_block` — proves the
independently-compiled encoders agree on the wire format.

## 8. Open questions

- Does AlphaPool accept `submitPlainProof`-style shares directly, or is its
  stratum a different dialect? (Wire-capture `alpha-miner` if bridging
  upstream pool; not needed if we solo via our own `pearld`+gateway.)
- cert_version selection: jobs at V3 mandatory? (`CERT_V3` activation height.)
- Pool-side fast share-verify: recompute tile + jackpot from PlainProof rows
  (cost ~one tile matmul + few blake3) — feasible CPU-side per share.
- int8 wrap semantics for `A'`/`B'` vs int32: canonical adds noise in i8
  domain? — check `pearl_layout.rs`/`pearl_program.rs` add_overflow behavior.

## 9. Continuation 2026-10-13 — confirmed fixes, hardware + offline upstream proof

All changes are **code + tests only** — nothing deployed: no pool restart,
no Edge `SHARE_EASE` change, no SMOS reload/config change, no real pool
submissions, no production routing enablement. Production mining, Hiran
llama-server, SRBMiner, and the reverse tunnel on the rig were left running
throughout.

### Confirmed fixes (local, tested — not yet live)

- **Pool gateway job TTL**: a healthy but *unchanged* `getMiningInfo`
  response no longer expires after 30 s. The job cache is now atomic —
  `(PearlJob, Instant)` in a single `RwLock` — and refreshed on every
  successfully parsed poll (`run` delegates to `poll_once`), never after a
  malformed result or JSON-RPC error.
- **Share target**: `share_ease` is `u64` (the `as u32` narrowing is gone);
  `min(block_target * share_ease, U256_MAX)` — saturation, never modulo —
  and `ext_stream_job` serializes the full 32-byte padded BE target without
  truncation.
- **Consensus-valid defaults + guards**: miner default `PearlMineConfig`
  is m=n=1024, **k=2048**, rank=128 (the old k=1024 violated upstream
  `public_params_sanity_check`'s `k >= 16·rank`); `validate()` enforces the
  upstream ranges, and `verify_pearl_share` rejects out-of-range dims/rank/k,
  bad tile geometry, oversized worker input, and matrix signal outside
  `[-64, 64]` (a guard our verifier previously omitted, upstream
  `api/verify.rs` parity).
- **Miner runtime**: stream 2 idles on `mark_idle` and awaits the next job
  bundle (or shutdown) instead of busy-looping when a bundle carries no
  `gpu_external` work. The reported PRL rate now counts **completed matrix
  attempts** — one attempt = one work unit — so the legacy `H/s` figure is
  attempts/s, NOT the full 32768-tile sweep (the kernel early-exits on a
  winning tile). Switching coins clears the stale QTU rate. Stream task
  joins are consumed exactly once (`joined[]` tracking in the supervision
  loop), and a dropped pool connection terminates the session instead of
  hanging.
- **CUDA kernel unchanged** — no `.cu`/`.cl` edits. No kernel or readback
  hang was reproduced by the fixture tests; the earlier early-return
  divergence hypothesis remains unconfirmed. These fixes close real
  pipeline defects, but do not prove they were the runtime's sole cause —
  that requires a live E2E run (deferred).

### Frozen probability correction

Authoritative sampled block target (frozen snapshot
`/tmp/pearl-debug-target-snapshot.json`):
`11808963921168079528047055725729053840763347721829482496` (~1.18e55).
For this sampled target, using the old k=1024/r=128 and share_ease 1e9,
expected success is ~1.094987e-4 per matrix attempt ≈ **~9133 attempts per
share** (assuming independent cryptographic jackpots — not a measured
hashrate). This ease does NOT make nearly every attempt win. Without a
measured count of completed attempts, a short run with no submissions
cannot by itself establish a broken kernel or share pipeline; earlier
near-constant-share estimates were incorrect. A proposed future isolated
test ease of `100000000000000000` (1e17) was NOT applied — source default
stays 256 and no deployed env changed.

### Evidence and tests

- Unit/integration gates: `zion-miner` `auxpow::pearl` **15/15**; runtime
  regressions **4/4** (`pearl_attempt_records_progress_without_share`,
  `coin_change_resets_stream_hashrate`,
  `stream2_idles_without_ext_job_and_resumes`,
  `session_errors_when_pool_disconnects`); `zion-pool`
  `pearl_gateway::tests` **7/7**; final pool-lib suite **229/229**.
- Feature compile `gpu-cuda,gpu-opencl` lib: OK. `git diff --check` clean.
  Whole-file rustfmt shows pre-existing violations (unchanged, no churn).
  No full workspace suite claimed.
- On-device (GTX 1070 Ti, real CUDA — no skip path):
  `pearl_cuda_parity_vs_cpu_reference` PASS (1.8 s) and
  `pearl_cuda_default_config_repeated_attempts` PASS (6.6 s — three
  consecutive salted attempts at m=n=1024/k=2048/r=128 plus a zero-target
  found-reset). Run on the rig as:
  `timeout 180 nice -n 19 <test-bin> <filter> --ignored --nocapture --test-threads 1`
- Independent offline upstream check (diagnostic checker using the
  deployed official `pearl_mining` library on Edge, no RPC/submission):
  the frozen CUDA proof verifies `valid=true` at the easy target and at
  the upper `nbits_override 0x1e38fb51`, and `valid=false` at the adjacent
  lower `0x1e38fb50` ("Jackpot condition not satisfied: hash does not meet
  difficulty target") — same GPU jackpot and immutable header throughout.
  Fixture sha256 `d9d36c49…b209c`, proof sha256 `f07b80d2…d5f4`
  (26 321 bytes), m=n=1024/k=2048/r=128, tile 4×8, factor 65536.
- Local evidence dir: `/tmp/pearl-cuda-evidence/` —
  `pearl-test.log`, `pearl-test2.log`, `miner-screen-hardcopy.txt`,
  `rig-test-output.txt`, `rework-verification.txt`, `final-pool-tests.txt`,
  `pearl-kat-proof.json` (emitted via `ZION_PEARL_KAT_PROOF_OUT`),
  `upstream-verification.json`.
- Reproducible filters:
  `cargo test --locked --manifest-path V31/Cargo.toml -p zion-pool --lib`
  `cargo test --locked --manifest-path V31/Cargo.toml -p zion-miner --lib auxpow::pearl`
  `cargo test --locked --manifest-path V31/Cargo.toml -p zion-miner --lib -- runtime::tests::<name>`
  `cargo test --locked --manifest-path V31/Cargo.toml -p zion-miner --features gpu-cuda --lib --no-run`

## 10. Live external-pool verification (2026-10-14)

### Observed workflow and scope

```text
GTX 1070 Ti native CUDA → isolated pearl_pool_probe
  → Suprnova mining.submit → 3 matching-id accepted responses
frozen submitted PlainProofs → official Pearl V3 verifier → all 3 valid
```

This is not a live test of the ZION V3 pool/gateway/node path. The custom
ZION `PearlSubmit` round-trip and an actual Pearl block accepted by our
node remain unobserved. Gateway `submitted` is still only an asynchronous
enqueue acknowledgement. `profit.rs` PRL auto-routing stays disabled.

The bounded run requested three accepted shares, with `--max-seconds 300`
and the default 250 ms idle gap. It stopped with `shares_target_met`:
**3 submitted, 3 accepted, 0 rejected, 0 stale results discarded, 8 completed
matrix attempts**. The reported mining-session time was 2.257974394 s;
this original binary started that timer after CUDA init and authorization.
This small, success-stopped sample on one easy-target job is **not a
hashrate, profitability, or network-block yield benchmark**.

### Frozen wire evidence

- Pool `prl.suprnova.cc:3370`, worker `zion-prl-cuda-probe`.
- Job `1cc53726_20000`, external-pool height **127856**, `cert_version=3`.
- Header 76 bytes; share target 32-byte BE; GPU jackpot interpreted LE.
- Dimensions `(m,n,k,rank)=(1024,1024,2048,128)`, tile 4×8; adjustment factor
  `4 * 8 * (2048 / 128) * 128 = 65536`. Each proof is **26,321 bytes**.
- Issued target:
  `00000000d1b71758e219652bd3c36113404ea4a8c154c985f06f694467381d7d`.
- Kernel target, exactly issued target ×65536, without overflow:
  `0000d1b71758e219652bd3c36113404ea4a8c154c985f06f694467381d7d0000`.

| submit id | nonce (matrix selector) | tile | literal pool response |
|---|---|---|---|
| 2 | 1792011319289854184 | 28565 | `{"error":null,"id":2,"result":true}` |
| 3 | 1792011319289854185 | 12004 | `{"error":null,"id":3,"result":true}` |
| 4 | 1792011319289854191 | 22430 | `{"error":null,"id":4,"result":true}` |

All receipts have `request_written=true`, matching request/response IDs,
`method=mining.submit`, matching job/proof fields, and no transport error.
These are not authorization responses or locally inferred accepts.

### Independent official V3 verification

The checker decodes each saved proof with official `pearl_mining`, checks
V3 eligibility, exact dimensions/tile/factor and header round-trip, and
confirms the recorded GPU jackpot is within the exact kernel target.
The official verifier accepts all three at `nbits_override=0x1d00d1b7`:
this compact target rounds the issued pool target **down**, so its success
proves validity under a slightly stricter bound, not a relaxed one.
The immutable header is retained; only the verifier's difficulty override
changes for these offline checks. No RPC or further shares were submitted.

| id | adjacent lower compact target (reject) | upper compact target (accept) | proof SHA-256 |
|---|---|---|---|
| 2 | `0x1d00be9b` | `0x1d00be9c` | `c37423d18de0656f6bb1ac11f709dd2c80aaf0addbe9300a36f3de71c689b6f1` |
| 3 | `0x1c7df4d7` | `0x1c7df4d8` | `3c5b568e5576006b4b4fa4f010cad8f90e171f957df329af7093a260dc1aa84d` |
| 4 | `0x1c3e0c8a` | `0x1c3e0c8b` | `97a48409a6c8b93e31dc8d31b821bcf05ca342be2d08eacab82e768f16131fd0` |

Every lower-bound rejection reports `Jackpot condition not satisfied: hash
does not meet difficulty target`. Every upper/floor check reports `Mining
solution verified successfully`. `node_acceptance` remains `not_observed`.
The committed `PEARL-POUW-LIVE-VERIFICATION.json` pins the responses,
receipt/proof hashes, geometry, and independent verification outcomes.

### Isolation and artifact identity

- Live binary MD5 **`43151874688fda1705d746f43ac78cb2`**, 1,738,672 bytes,
  max required `GLIBC_2.30`; installed under an isolated probe filename,
  not the production miner path. Subsequent control-flow hardening is a
  separate build, not another live mining sample.
- Before/after: free GPU memory **909 MiB**, temperature **72°C**, Hiran
  `/health` OK; unchanged PIDs for Hiran `2723173`, production miner
  `2762270`, SRBMiner `2746741`. No inference latency/throughput benchmark
  was made; process continuity and health do not establish zero contention.
- No SMOS group/wrapper changes, service restarts, production binary swaps,
  or pool/gateway/share-ease environment changes during this probe.
- Raw local artifacts: `/tmp/pearl-cuda-evidence/live-probe-v1/run.log`,
  `evidence/submit-{2,3,4}.json`, `evidence/summary.json`, and
  `official-v3-verification.json`; pre/postflight logs are in the parent
  directory. Original copies were left on the rig at
  `/home/miner/pearl-probe-evidence-v1/` and on Edge at
  `/tmp/pearl-probe-evidence-v1/`. Raw proof payloads are outside Git;
  the committed snapshot records their hashes.

Remaining production gates: live ZION `PearlSubmit` acknowledgement,
block-meeting proof forwarding through the gateway, and actual node
`Accepted`. External-pool share acceptance does not waive these gates.

### Reproducing the offline checks

`V31/L1/miner/verify_pearl_pool_proofs.py` is byte-identical to the checker
used for the frozen verification above. It requires the official
`pearl_mining` package in the execution interpreter, or `--remote` can
reuse Edge's existing `/opt/pearl/.venv`. Only frozen input bytes travel
over SSH; it makes no pool/node RPC calls or mining submissions.

```sh
python3 V31/L1/miner/verify_pearl_pool_proofs.py --self-test
python3 V31/L1/miner/verify_pearl_pool_proofs.py \
  --remote zion-new --output /tmp/pearl-official-v3-recheck.json \
  /tmp/pearl-cuda-evidence/live-probe-v1/evidence/submit-{2,3,4}.json
```

Use the original receipt files, not the hash-only committed snapshot, as
inputs. Choose a fresh output filename: existing evidence is never
overwritten. Arithmetic self-test needs no upstream package; it is not
itself proof verification. Python `-O` is rejected so validation assertions
cannot silently disappear.

### Diagnostic control hardening and final build (2026-10-15)

The external protocol client is `src/auxpow/pearl_pool.rs` and the
`gpu-cuda`-gated diagnostic binary is `src/bin/pearl_pool_probe.rs` (paths
relative to `V31/L1/miner`). This does not wire Suprnova into production
routing. The client caches pre-authorization jobs, validates cert versions
before narrowing, bounds frames/proofs, rejects target multiplication
overflow, and only counts a matching `mining.submit` response as accepted.

The final probe preserves one shutdown future across startup, mining,
proof building and submit waits. Expired/cancelled checkpoints prevent new
GPU/proof work and submissions; an in-flight owned task is drained once
without resetting the GPU. Notification floods cannot starve cancellation.
Unwritten/cancelled submits clear stale request state, do not fabricate
receipts or rejection counts, and retain the real stop reason. Transport
failure is not labelled as timeout. Startup/session errors pass through a
single summary-writing boundary; existing evidence is never overwritten.
The deadline bounds new work and I/O, not forced preemption of a hung GPU
kernel; storage failure can still prevent evidence from being written.

Focused verification: **29/29** Pearl/protocol library tests and **15/15**
probe regression tests passed, including pre/post-write cancellation,
ready-task priority, notification floods, stale jobs, no-request outcome
mapping and summary/error handling. `git diff --check` passed; new Rust
files were formatted without unrelated churn. The versioned Python
checker passed its arithmetic self-test and byte-identity check against
the exact checker that produced the frozen official verification. No full
workspace suite or additional live mining run is claimed.

Final diagnostic artifact on Edge:
`/tmp/pearl-cuda-out/pearl_pool_probe-hardened-final`, **1,759,576 bytes**,
MD5 `a8f77f173ea3de4ec73a9e19b265a07f`, SHA-256
`e07fbd1ef587f9fc032f51ca71333b29a5a1066fb8bbf173a36a3f10ec399bd2`.
Built `--release --locked --features gpu-cuda` with generic x86-64 CPU
flags; `--help` passed and maximum required GLIBC is **2.30**, compatible
with the rig's 2.31. This final control-flow build was **not** deployed or
live-mined; the three accepted shares belong to the original MD5 `43151874…`
artifact above. Final elapsed time now includes startup, unlike that
original sample's mining-only timer.

Raw verification artifacts in `/tmp/pearl-cuda-evidence/`:
`probe-final-test-raw.txt`, `probe-final-build-dockerlog-raw.txt`,
`probe-final-edge-raw.txt`; the library gate and review history are in
`probe-hardening-verification.txt`. These record successful command exit
statuses separately from the frozen mining evidence.
