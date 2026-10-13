# Pearl (PRL) PoUW — canonical spec, gap analysis, integration plan

Status: **Edge infra deployed 2026-10-13** — `pearld` initial-syncing to
height 127001, `oyster` wallet created (`prl1pzy8mjq…`), `pearl-gateway`
serving `getMiningInfo` on `127.0.0.1:8477`, `zion-pool` rebuilt+deployed
and **live-parsing real gateway jobs** (`cert_version=1` while tip sits
below the salted-seed fork height). Kernel+host parity fixes done, CPU KAT
5/5 + GPU parity PASS, pool 219/219 tests.
Goal: Pearl as a native mining algo in zion-miner, OpenCL first, shares via ZION V3 pool bridge (:8444) → Pearl gateway on Edge → `prl1p…` payout wallet.

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

Difficulty: `bound = target_of_nbits / (tile_size × rank_penalty)` where
rank_penalty = `dot_product_len/rank × 128` — see `api/sanity_checks.rs`.

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
| G12 | Tile/proof mapping | `compute_leaf_indices_from_rows`, patterns partition | `auxpow/pearl.rs::leaf_indices_from_rows` + `tile_row_col_indices` (kernel 4×8 hash-tile decode) | ✅ DONE (E2E pending) |
| G13 | PlainProof bincode | serde bincode struct order + Option tag | `auxpow/pearl.rs::encode_plain_proof` + `proof_encoding_layout` test; pool `decode_plain_proof` decodes the same layout | ✅ DONE (E2E pending) |
| G14 | Config choice | common_dim/rank/patterns from `getMiningInfo` job | miner-chosen `PearlMineConfig` (env-overridable, default m=n=k=1024 rank=128); upstream-legal — `PlainProof` carries the dims | ✅ DONE |

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
   `auxpow/pearl.rs` — `PeriodicPattern`/`PearlMineConfig` (env-overridable,
   defaults m=n=k=1024 rank=128 rows [0,8,64,72] cols [0,1,8,9,64,65,72,73] —
   kernel tile is 4×8), keyed merkle tree + `multileaf_proof` (upstream
   sibling-order port), `build_plain_proof` + bincode encoder, tile-index →
   row/col decode. `GpuMiner::mine_pearl` (default bail, impl on
   `OpenClExternalMiner`), `"pearlhash"` added to `is_external_algorithm`,
   `V3PoolClient::submit_pearl_share` (PRL per-coin result channel),
   `mine_v3_pearl_attempt` dispatch inside `mine_v3_external_share` — one GPU
   call per attempt, spawn_blocking + persistent backend (same pattern as
   `try_gpu_ext_share`); effective kernel target = share_target ×
   `tile_size·(k/rank)·128` (rank-penalty adjustment, matches pool bound).
   12/12 miner pearl tests pass; pool 219/219.
6. ✅ Edge infra (2026-10-13, see §6); PPLNS accounting under coin `PRL`
   via `record_external_share` (weight `ZION_POOL_AUXPOW_WEIGHT_PRL`,
   fallback `ZION_POOL_AUXPOW_PPLNS_WEIGHT`, default 500).
7. Enable miner flag `--pearl` next to `--quantus` only after live
   `submitPlainProof` accepted (or upstream solo block) — **pending pearld
   initial sync** (ETA ~6h from 2026-10-13 05:15 UTC) and one GPU-miner
   E2E run.

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

### Still open before enabling `--pearl`

- pearld full sync (in progress, ~5 blk/s observed).
- Live `submitPlainProof` round-trip: block-meeting proof → gateway accept.
- Miner↔pool E2E KAT: `pearl_pouw_mine_native` → `build_plain_proof` →
  `zion_pool::pearl::verify_pearl_share` on a small config (todo list item).
- `profit.rs` `.with_disabled` flip for `ExternalCoin::Pearl`.

## 7. Open questions

- Does AlphaPool accept `submitPlainProof`-style shares directly, or is its
  stratum a different dialect? (Wire-capture `alpha-miner` if bridging
  upstream pool; not needed if we solo via our own `pearld`+gateway.)
- cert_version selection: jobs at V3 mandatory? (`CERT_V3` activation height.)
- Pool-side fast share-verify: recompute tile + jackpot from PlainProof rows
  (cost ~one tile matmul + few blake3) — feasible CPU-side per share.
- int8 wrap semantics for `A'`/`B'` vs int32: canonical adds noise in i8
  domain? — check `pearl_layout.rs`/`pearl_program.rs` add_overflow behavior.
