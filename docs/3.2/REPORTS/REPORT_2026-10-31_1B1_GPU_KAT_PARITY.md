# 1.B1 — GPU KAT: parity CPU/OpenCL/CUDA/Metal na referenčních vektorech

**Datum:** 2026-10-31 · **Audit item:** 1.B1 (Beta exit) · **Verdikt: PASS s documented residuals**

## Hardware matrix (lokální host)

| Karta | Backend | CC/arch | Využito |
|---|---|---|---|
| NVIDIA GP104 (GTX 1070 Ti, driver 580.178.04) | CUDA + OpenCL | sm_61 | plná KAT suite |
| AMD Navi 10 (RX 5600 XT, gfx1010, AMD-APP) | OpenCL | gfx1010 | plná KAT suite |
| Apple Metal | — | — | **N/A — žádné Apple GPU na hostu** |

## Ekam Deeksha v3.2 (main chain PoW) — **BIT-IDENTICKÝ**

| Test | CUDA sm_61 | OpenCL AMD | OpenCL NVIDIA |
|---|---|---|---|
| `gpu_kat_verify` (KAT vektory + s1/s2/s3 scratchpad stage) | **ALL PASS** | — | — |
| `opencl_deeksha_nonce_zero_matches_cpu` | — | **PASS** | **PASS** |

Všechny KAT vektory (včetně nonce=0 i nonce=u64::MAX) produkují **bit-identické** hashe CPU↔GPU, včetně mezistavů scratchpadu.

## QPoW (Quantus auxpow) — **PARITY PASS**

| Gate | CUDA | OpenCL AMD |
|---|---|---|
| `cuda_kernel_matches_cpu_golden_and_boundaries` | PASS | — |
| `cuda_first_squeeze` / `dual_squeeze_matches_cpu_corpus` | PASS | — |
| `cuda_fused_mds_arithmetic_matches_wide_reference` | PASS | — |
| `opencl_kernel_matches_cpu_golden_and_boundaries` | — | PASS |
| `opencl_arithmetic_matches_lazy_reference` | — | PASS |
| `opencl_first_squeeze_matches_cpu_corpus` | — | PASS |
| `auxpow_kat qpow` mine_batch≡CPU (1024 nonců) | PASS | PASS |

## Pearl PoUW — **PARITY PASS**

| Gate | CUDA | OpenCL AMD | OpenCL NVIDIA |
|---|---|---|---|
| `pearl_cuda_parity_vs_cpu_reference` | PASS | — | — |
| `pearl_cuda_default_config_repeated_attempts` | PASS | — | — |
| `pearl_cuda_bench_sustained_windows` | PASS | — | — |
| `pearl_gpu_parity_vs_cpu_reference` | — | PASS | PASS |
| `auxpow_kat pearlhash` | — | PASS | PASS |
| tensor gates (`tensor_fragment`/`batch_slots`) | **SKIP** (sm_61 nemá INT8 tensor cores — gate teď čistě skipuje, viz fix níže) | — | — |

## AuxPoW sweep (`auxpow_kat`, batch 1024, repeats 4)

### AMD OpenCL (gfx1010) — 16/16 ověřitelných PASS

`kheavyhash, keryxhash, blake3_dcr, blake3_alph, pearlhash, autolykos, qhash, eaglesong, neoscrypt, karlsenhash, beamhash, dynexsolve, fishhash, qpow, nexapow, equihash` — vše **bit-identické** vs CPU ref (nexapow: 346 s JIT, pak PASS; **equihash 200,9: Wagner sol valid + sha256d≡ — vyřešeno, viz fix #7/#8**).

- `zelhash` (125,4): **SKIP — HW kapacita** — 2× 3.2 GB tabulky + counters ≈ 6.5 GB > 5.98 GiB VRAM karty; nově čistý bail přes `check_vram_fits` místo ROCm page-fault SIGABRT (fix #9)
- `equihashzero` (192,7): RUN, deterministický výstup — *unverifiable* (žádný CPU ref pro Wagner multi-kernel — stejné na všech platformách)
- `verushash`: SKIP — žádný GPU kernel (by design)
- `ghostrider`: RUN — *unverifiable* (CPU ref vyžaduje `native-all` build)
- DAG-family (`ethash, kawpow, progpow, progpowz, evrprogpow, meowpow, octopus, verthash`): ERR = **host-env** — harness negeneruje DAG/data soubory (`set_*_dag`), není to GPU defect

### NVIDIA OpenCL (GP104) — vše ověřitelné PASS

`kheavyhash, keryxhash, blake3_dcr, blake3_alph, pearlhash, autolykos, eaglesong, neoscrypt, karlsenhash, fishhash, dynexsolve, qpow` + deeksha/pearl gates. Několik SKIP = VRAM contention (karta ~96 % obsazená cizími procesy — host limit, ne defect).

### CUDA (GP104) — 7 PASS + deeksha ALL PASS

`keryxhash, kheavyhash, blake3_dcr, blake3_alph, autolykos, qpow (CPU-verified), zelhash`; 4 ERR = host-env (ethash/kawpow/progpow OOM na obsazené kartě; verushash chybí `native-verushash` feature).

## Reálné bugy nalezené a opravené během KAT

Audit item se změnil z "run KAT" na "fix KAT" — pět oprav:

1. **`auxpow_kat.rs` — k256 0.14 compat:** `k256::FieldElement` zaniklo v 0.14 (privátní `arithmetic` mod) → přes `hazmat::FieldArithmetic::FieldElement` assoc type. *(committed `308e6bc75` — paralelní session commitla během práce)*
2. **`pearl_cuda_tests.rs` — tensor gates:** `assert!` na SM75+ → panic=FAIL i tam, kde tensor cores neexistují → `tensor_device() -> Option`, čistý SKIP. *(committed `308e6bc75`)*
3. **`gpu_miner.rs` — `reqd_work_group_size` launch bug:** `OpenClState::mine` zmenšoval `local_size` pod zkompilovaný `LOCAL_SIZE` (kernel deklaruje `reqd_work_group_size(LOCAL_SIZE,1,1)`) → `CL_INVALID_WORK_GROUP_SIZE` na chunk < local. Fix = produkční pattern z `gpu/mod.rs`: `local_size` vždy = kompilovaná hodnota, global round-up, extra gid early-exit.
4. **ROCm `inline` hidden-symbol (autolykos + nexapow):** C99 `inline` bez `static` neemituje out-of-line definici → `ld.lld: undefined hidden symbol`. Fix: `inline` → `static inline` (autolykos 6×; nexapow `FORCE_INLINE` macro + 140 bare-inline). autolykos **PASS**, nexapow **PASS** (346 s JIT).
5. **ROCm strict kernel-arg introspection:** ocl knihovna validuje element typ bufferu proti deklarovanému `__global` typu — `Buffer<u8>` (uchar*) proti `float2*`/`uint16*`/`uint8*`/`char*` failuje:
   - qhash `state_vec_pool` → `Buffer<Float2>` **PASS**
   - fishhash `_Cache` → `Buffer<Uint16>`, `dag` → `Buffer<Uint8>`, `blockHeader` → `Buffer<Uint16>` **PASS** (karlsenhash stejná cesta **PASS**)
   - zelhash/equihash200 dead-var `__global char *hcounters[2] = {uint*, uint*}` (typový bug, nikdy nepoužitá) — smazáno; `__global char` → `__global uchar` pro sjednocení se sdílenou equihash tabulkou
6. **`pearl_pouw_native.cl` v2 smem 49 476 B > 48 KiB (GP104):** ptxas odmítne celý program i když v2 nikdy neběží → `#ifndef PEARL_DISABLE_V2` guard + host `device_local_mem_size() < 49_476` → auto `-DPEARL_DISABLE_V2`. NVIDIA OCL pearl parity následně **PASS**.
7. **`auxpow_kat.rs` — KAT harness varint bug (equihash "invalid solution"):** `share.solution` = stratum **wire format** = CompactSize varint (`fd4005`) + 1344 B soln = 1347 B; KAT předával celý wire buffer do `is_valid_solution` i do debug index-dekodéru → všechny 21-bit indexy posunuté o 3 B (`leaf_bad=256/256`, "invalid parameters", nulový overlap s CPU řešeními). GPU řešení byla validní celou dobu. Fix = strip varint prefixu před verifikací/dekódováním; produkční `share.solution` zůstává wire-format (správně). Po fixu **equihash 200,9 PASS** (Wagner sol valid + sha256d≡, 118–791 ms).
8. **Blake2b σ[3] round-4 `tail0` misplacement (3 Wagner kernely):** v `equihash_kernel.cl`, `equihash200_kernel.cl`, `zelhash_prod_kernel.cl` měla round σ[3] `tail0` v G8 (`v[3],v[4],v[9],v[14]`) místo G7 (`v[2],v[7],v[8],v[13]`, kde σ[3] s13=0) — transkripční chyba digestu. Pro KAT headery `tail0==0` → numericky neviditelná; pro headery s nenulovými bytes 128..136 = reálný defect. Audit všech 12 roundů: jediná odchylka. Opraveno ve všech 3 souborech.
9. **ROCm VRAM overcommit page-fault (zelhash):** `clCreateBuffer` na ROCm alokuje lazy — 2× 3.2 GB tabulky "projdou" i na 5.98 GiB kartě a kernel faultuje až při přístupu → SIGABRT zabije miner proces. Fix = `check_vram_fits()` (`CL_DEVICE_GLOBAL_MEM_SIZE` − 10 % headroom) před alokacemi v `mine_zelhash_prod` i `mine_equihash_impl` → čistý error → KAT klasifikuje jako SKIP ("insufficient memory" přidáno do `env_skip_reason`). Zelhash na AMD = **HW kapacita, ne defect**; na CUDA (8 GB) PASS.

## Otevřené residuály (tracked, ne blocking)

| Item | Stav | Poznámka |
|---|---|---|
| `zelhash` (125,4) na AMD | **HW kapacita** | potřebuje ~6.5 GB > 5.98 GiB karty — čistý SKIP, ne fault. CUDA `zelhash` PASS = algoritmus zdravý; AMD vyžaduje kartu ≥8 GB |
| `nexapow` JIT 346 s | OK | secp256k1 kernel je 6k-line; JIT čas dokumentovaný v kódu |
| Metal | **N/A** | žádné Apple GPU — Metal path existuje (`metal_deeksha_lite`, `qpow_metal` gates `#[ignore]`), ověřit při dostupném Apple hw |
| DAG-family algos | host-env | `set_*_dag`/data file harness — není GPU defect |
| `ghostrider`/`equihashzero` CPU refs | unverifiable | GPU běží deterministicky; CPU ref vyžaduje `native-all` FFI build |
| NVIDIA OCL equihash | env SKIP | VRAM contention na sdílené kartě (alloc fail) — host limit, ne defect |
| `live_qpow_qelvhash_roundtrip` | env-gated | live stratum login — ne KAT item |

## Reprodukce

```bash
cd V31
cargo build --release -p zion-miner --features gpu-opencl,gpu-cuda \
  --bin auxpow_kat --bin auxpow_cuda_kat --bin gpu_kat_verify

# CUDA (GTX 1070 Ti)
./target/release/gpu_kat_verify
./target/release/auxpow_cuda_kat

# OpenCL — AMD (platforma 0) / NVIDIA (platforma 1)
ZION_OCL_PLATFORM_IDX=0 ./target/release/auxpow_kat          # AMD sweep
ZION_OCL_PLATFORM_IDX=1 ./target/release/auxpow_kat          # NVIDIA sweep

# Lib GPU gates (isolated GPU, --ignored)
cargo test --release -p zion-miner --features gpu-cuda --lib \
  -- --ignored pearl_cuda qpow_cuda --test-threads=1
cargo test --release -p zion-miner --features gpu-opencl --lib \
  -- --ignored pearl_gpu_parity opencl_deeksha opencl_kernel \
     opencl_arithmetic opencl_first_squeeze --test-threads=1
```

## Verdikt

**PASS** — main-chain Ekam Deeksha bit-identický na všech dostupných backendech (CUDA + 2× OpenCL), QPoW a Pearl parity PASS, **16 auxpow algoritmů bit-identických na AMD** (vč. equihash 200,9 — Wagner sol valid + sha256d≡) + 12 na NVIDIA + 7 na CUDA. Metal = N/A (no hw). Devět reálných defect classes opravených cestou — včetně KAT-harness varint bugu, který maskoval validní GPU řešení, a Blake2b σ[3] transkripční chyby ve všech 3 Wagner kernelech. Zbývající residual: **zelhash na AMD = HW kapacita** (potřebuje ~6.5 GB > 5.98 GiB; čistý SKIP přes `check_vram_fits`, na CUDA 8 GB PASS) — žádný otevřený correctness defect.
