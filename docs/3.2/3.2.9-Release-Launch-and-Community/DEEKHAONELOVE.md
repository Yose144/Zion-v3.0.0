# Ekam Deeksha One Love — Algorithm canonicalization audit & plan

**Date:** 2026-08-18  
**Author:** Devin  
**Status:** In progress — `cosmic-harmony-v3` crate archived, full canonicalization pending  
**Canonical spec:** `Ekam Deeksha v3.2` — 512 KiB scratchpad, 2 AES passes, 128 random reads, Keccak-256 final

---

## 1. Goal

Make `Ekam Deeksha v3.2` the single, unambiguous canonical ZION PoW in `V31/`. Move or remove all older/parallel algorithm names (`deeksha_lite_v1`, `deeksha_lite_fire`, `deeksha_chv3`, `cosmic_harmony_ekam_deeksha_v2`, `cosmic_harmony_ekam_deeksha_v3`) so they do not appear in active code paths or user-facing strings. Archive everything that must remain for V3 compatibility.

---

## 2. Done already

- Moved legacy crate `V31/L1/cosmic-harmony-v3` → `V31/L1/archive/cosmic-harmony-v3`.
- Updated `V31/Cargo.toml` workspace members.
- Updated `V31/L1/core/Cargo.toml` dependency path.
- Verified `cargo check --workspace` passes.

---

## 3. Source of truth for v3.2

| Component | File(s) | Notes |
|-----------|---------|-------|
| CPU reference | `V31/L1/cosmic-harmony/src/algorithm/ekam_deeksha.rs` | Implements `PowAlgorithm` trait, 512 KiB / 2 passes / 128 reads / 2 AES rounds. |
| CPU scratchpad helper | `V31/L1/cosmic-harmony/src/scratchpad_ekam.rs` | `memory_hard_transform_ekam_light` used by canonical path. |
| Rust trait | `V31/L1/cosmic-harmony/src/algorithm/mod.rs` | `PowAlgorithm`, `DynPowAlgorithm`, `EkamDeeksha`, `PocAlgorithm`. |
| CUDA kernel | `V31/L1/miner/src/gpu/kernels/cuda/deeksha_lite.cu` | 512 KiB / 2 passes / 128 reads — canonical, but mis-named. |
| Metal kernel | `V31/L1/miner/src/gpu/kernels/metal/deeksha_lite.metal` | 512 KiB / 2 passes / 128 reads — canonical, but mis-named. |
| OpenCL kernel | `V31/L1/cosmic-harmony/src/gpu/kernels/deeksha_lite.cl` | Needs verification (see §4). |
| AGENTS spec | `V31/AGENTS.md` line 7 | Confirms `EkamDeeksha` PoW (v3.2). |

---

## 4. Inventory of remaining legacy surface

### 4.1 `V31/L1/cosmic-harmony` — canonical crate still exports legacy items

`src/lib.rs` currently re-exports:

- `deeksha_lite::deeksha_lite`
- `deeksha_lite_fire::deeksha_lite_fire`
- `algorithms_opt::cosmic_harmony_with_height`
- `CANONICAL_ALGORITHM` = `algorithm::ekam_deeksha::ALGORITHM_NAME` (`"ekam_deeksha"`)

Legacy modules inside the crate:

- `src/deeksha.rs` — contains fork gates (`tx_hash_v2_active`, `body_root_v2_active`, etc.) and ALSO old v2/v3 hash functions:
  - `cosmic_harmony_ekam_deeksha_v2`
  - `cosmic_harmony_ekam_deeksha_v3`
- `src/deeksha_lite.rs` — 256 KiB / 2 passes / 64 reads / 4 AES rounds (DeekshaLite v1).
- `src/deeksha_lite_fire.rs` — 128 KiB + thermal loop (DeekshaLite Fire).
- `src/algorithms_opt.rs` — wraps the old v2 hash; provides `cosmic_harmony_with_height`.
- `src/algorithms_npu.rs` — old NPU mixing scaffolding.
- `src/hic.rs` — old HIC auxiliary.
- `src/gpu/kernels/` — old OpenCL kernels:
  - `deeksha_chv3.cl`
  - `deeksha_lite_fire.cl`
  - `cosmic_harmony_deeksha.cl`
  - `deeksha_lite.cl` (probably canonical, must verify)

### 4.2 `V31/L1/miner` — user-facing strings and GPU loader

Strings and defaults still using old names:

- `src/runtime.rs:257` — `unwrap_or_else(|_| "deeksha_lite_v1".to_string())`
- `src/runtime.rs:1238` — `let algorithm = "deeksha_lite_v1".to_string();`
- `src/setup_menu.rs:95` — `prompt("deeksha_lite_v1", "Algorithm")`
- `src/interactive.rs:259-261` — algorithm list: `deeksha_lite_v1`, `deeksha_lite_fire`, `cosmic_harmony_ekam_deeksha_v2`
- `src/interactive.rs:1077-1079` — display mapping for old names
- `src/ui.rs:779` — comment: `"deeksha_lite_v1", "progpow", "verushash"`
- `src/ui.rs:795` — TUI line shows `deeksha_lite_v1`
- `src/gpu_guard.rs:233-253` — `Algorithm` enum maps `deeksha_lite_v1`, `deeksha_lite_fire`, etc.

GPU kernel loading:

- `src/gpu/mod.rs:6483` — `cuda_deeksha` module loads `cosmic_harmony_deeksha.cu` (128 KiB / 1 pass / 32 reads — old v2).
- `src/gpu/mod.rs:7260` — `cuda_deeksha_lite` module loads `deeksha_lite.cu` (512/2/128 — canonical, mis-named).
- `src/gpu/mod.rs:7703` — `metal` path loads `ekam_deeksha.metal` (128 KiB / 1 pass / 32 reads — old, but file name suggests canonical).
- `src/gpu/metal_deeksha_lite.rs` — loads `deeksha_lite.metal` (512/2/128 — canonical, mis-named).
- `src/bin/gpu_kat_verify.rs:15` — includes `deeksha_lite.cu`.
- `src/auxpow/gpu_miner.rs` — tests for old v1/v2 algorithms.
- `src/parallel.rs` — test uses `cosmic_harmony_ekam_deeksha_v3`.

GPU kernel files in `V31/L1/miner/src/gpu/kernels/`:

- `cuda/deeksha_lite.cu` — canonical v3.2, should be `ekam_deeksha.cu`.
- `cuda/deeksha_lite_fire.cu` — old fire.
- `cuda/cosmic_harmony_deeksha.cu` — old v2.
- `metal/deeksha_lite.metal` — canonical v3.2, should be `ekam_deeksha.metal`.
- `metal/deeksha_lite_fire.metal` — old fire.
- `metal/ekam_deeksha.metal` — old v2, name is misleading.

### 4.3 `V31/L1/core`

- `src/node_runtime.rs:40-45` — imports from `zion_cosmic_harmony_v3` (old fork helpers and revenue types).
- `src/node_runtime.rs:76-97` — `hash_candidate_with_algorithm` dispatches `deeksha_chv3`, `deeksha_lite_v1`, `deeksha_lite_fire`, `cosmic_harmony_v3`, `cosmic_harmony_ekam_deeksha_v2`. Does **not** handle `ekam_deeksha`.
- `src/v3_compat.rs` — depends on `zion_cosmic_harmony_v3` for V3 block validation (legitimate use; crate is archived but still a dependency).
- `src/rpc.rs:445` — `"consensus_profile": "cosmic_harmony_v3"`.

### 4.4 Other

- `V31/L1/pool/src/stratum.rs` — comment references `deeksha_lite_v1`.
- `V31/L1/native-ffi` — `native-cosmic-harmony` feature; needs verification whether it calls old v2 or canonical v3.2.
- `V31/scripts/smos/wrapper_v31_trinity.sh:53` — `ZION_MINER_ALGORITHM=deeksha_lite_v1`.
- `V31/deploy/config/edge-environment.sh` — comments mention `deeksha_lite_v1`.
- `V31/STATUS.md` — references old re-exports and `cosmic_harmony_ekam_deeksha_v2`.
- `V31/README.md` — table describes `cosmic-harmony-v3` as legacy.

---

## 5. Step-by-step plan

### Phase A — Rename canonical GPU kernels and clean kernel directory

Goal: the files called `ekam_deeksha.*` must be v3.2; old kernels must be removed or archived.

1. `V31/L1/miner/src/gpu/kernels/cuda/`
   - Rename `deeksha_lite.cu` → `ekam_deeksha.cu`.
   - Delete `deeksha_lite_fire.cu`.
   - Delete `cosmic_harmony_deeksha.cu`.
2. `V31/L1/miner/src/gpu/kernels/metal/`
   - Rename `deeksha_lite.metal` → `ekam_deeksha.metal` (overwrites the old legacy file of the same name).
   - Delete `deeksha_lite_fire.metal`.
3. `V31/L1/miner/src/gpu/kernels/opencl/` — create if needed; move canonical OpenCL from `cosmic-harmony` and delete old ones.
4. Update all `include_str!` paths in:
   - `V31/L1/miner/src/gpu/mod.rs`
   - `V31/L1/miner/src/gpu/metal_deeksha_lite.rs`
   - `V31/L1/miner/src/bin/gpu_kat_verify.rs`

### Phase B — Clean `V31/L1/cosmic-harmony` canonical crate

1. Keep and clearly mark as canonical:
   - `src/algorithm/ekam_deeksha.rs`
   - `src/algorithm/mod.rs`
   - `src/scratchpad_ekam.rs`
2. Move legacy PoW modules to `src/archive/`:
   - `deeksha_lite.rs`
   - `deeksha_lite_fire.rs`
   - `algorithms_npu.rs`
   - `algorithms_opt.rs` (or keep only generic `keccak256_opt`/`sha3_512_opt` helpers if truly generic)
   - `hic.rs`
3. Split `src/deeksha.rs`:
   - Keep consensus fork gates (`tx_hash_v2_active`, `body_root_v2_active`, `account_tx_memo_v1_active`, `balance_check_active`) in `src/consensus_rules.rs` (or rename `deeksha.rs` → `fork_gates.rs`).
   - Move old v2/v3 hash functions to `src/archive/legacy_hash.rs`.
4. Update `src/lib.rs`:
   - Remove re-exports of `deeksha_lite`, `deeksha_lite_fire`, `cosmic_harmony_with_height`.
   - Keep `EkamDeeksha`, `PocAlgorithm`, `PowAlgorithm`, `DynPowAlgorithm`.
   - Keep revenue/profit/stream modules (AuxPoW uses them).

### Phase C — Update miner runtime, CLI, TUI

1. Replace default algorithm string: `deeksha_lite_v1` → `ekam_deeksha`.
2. Update `src/gpu_guard.rs`:
   - Remove `DeekshaLiteV1`, `DeekshaLiteFire` enum variants.
   - Rename canonical variant to `EkamDeeksha`.
   - Map input strings `ekam_deeksha`, `deeksha_lite`, `deeksha_lite_v1` to canonical with a deprecation warning.
3. Update `src/interactive.rs` algorithm list and display map.
4. Update `src/setup_menu.rs` prompt default.
5. Update `src/ui.rs` TUI banner and status line.
6. Remove or update old tests in `src/auxpow/gpu_miner.rs` and `src/parallel.rs`.
7. Update `src/runtime.rs` to create the canonical `EkamDeeksha` CPU/GPU backend.

### Phase D — Update `V31/L1/core`

1. `src/node_runtime.rs`:
   - Stop dispatching old algorithms.
   - `hash_candidate_with_algorithm` should use canonical `EkamDeeksha` for V31 and delegate V3 legacy validation to `src/v3_compat.rs`.
   - Import `NclStats` / `RevenueSource` from `zion_cosmic_harmony` (canonical crate) instead of `zion_cosmic_harmony_v3` where types are identical.
2. `src/consensus.rs` — already canonical; add a test asserting `EkamDeeksha::name() == "ekam_deeksha"`.
3. `src/rpc.rs` — change `consensus_profile` to `"ekam_deeksha"`.

### Phase E — Auxiliary files

1. `V31/scripts/smos/wrapper_v31_trinity.sh` — `ZION_MINER_ALGORITHM=ekam_deeksha`.
2. `V31/deploy/config/edge-environment.sh` — update comments.
3. `V31/STATUS.md`, `V31/README.md`, `V31/AGENTS.md` — refresh descriptions.
4. `V31/L1/pool/src/stratum.rs` — update algorithm comments.
5. `V31/L1/native-ffi` — verify it calls canonical `ekam_deeksha` not old `cosmic_harmony`.

### Phase F — Verification

1. `cargo check --workspace`
2. `cargo clippy --workspace`
3. `cargo test --workspace`
4. Optional: build a miner with `gpu-cuda` feature if CUDA toolchain is available.

---

## 6. Risks

- GPU kernel `include_str!` paths must be updated exactly; otherwise build fails at compile time.
- `core/src/node_runtime.rs` and `v3_compat.rs` rely on legacy hash functions for V3 checkpoint sync; those must remain reachable (in archived crate or `cosmic-harmony/src/archive/`).
- `zion-miner` has many feature combinations (`gpu-opencl`, `gpu-cuda`, `gpu-metal`, `auxpow`, `tui`, `native-all`); `cargo check` with `--all-features` should be run.
- Any change to `ALGORITHM_NAME` (`"ekam_deeksha"`) propagates to pool stratum, miner UI, and RPC; do not change it unless coordinated with pool/Edge.

---

## 7. Acceptance criteria

- `grep -R "deeksha_lite_v1\|deeksha_lite_fire\|deeksha_chv3\|cosmic_harmony_ekam_deeksha_v2\|cosmic_harmony_ekam_deeksha_v3" V31/L1` returns **only** archive/legacy paths or intentional V3-compat references.
- `cargo test --workspace` passes with 0 failures.
- `zion-miner --help` / TUI shows algorithm `ekam_deeksha`.
- `V31/L1/miner/src/gpu/kernels/` contains only `ekam_deeksha.{cu,metal,cl}` plus AuxPoW external-coin kernels.
