# QPOW — Quantus nativní integrace do Trinity (Stream 2)

Status: **live-validated na GTX 1070 Ti — CUDA kernel těží, ZION stream opraven**
Datum: 2026-10-30 (CUDA debug run 2026-10-03)

Quantus (QPoW = Poseidon2 nad Goldilocks polem) je plně integrovaný jako
`ExternalCoin::Quantus` na Trinity Stream 2 (GPU external). Těžba běží nativně —
vlastní CPU fast-path + dedikovaný CUDA kernel — bez externího miner binárky.

## Architektura

```
upstream pool (stratum login-dialekt)
  │  mining_hash 32B, target 64B BE, extranonce 4B, job_id, seq, difficulty
  ▼
miner: auxpow/client.rs (QuantusStratum)  →  Job{target_512}
  │  Stream 2: try_qpow_gpu_share (gpu-cuda) → QpowCudaMiner
  │            fallback: parallel::find_qpow_share (CPU fast-path)
  ▼
Share{nonce_512[64], hash_512[64]} (+ legacy u64/32B views pro metriky)
  │  V3 ExternalSubmit{nonce_hex 128c, hash_hex 128c}
  ▼
pool: stratum.rs → ShareForwardRequest{nonce_hex} → auxpow_bridge
  → auxpow_runtime::forward_share_to_upstream → submit_qpow_share
```

## Algoritmus (bit-exact vs. upstream `qp-poseidon-core 3.1.0`)

- Goldilocks pole, Poseidon2 WIDTH=12, RATE=8, output 4 felty/squeeze, 2 squeezy → 64B hash.
- Nonce: 64B / 512-bit BE. Layout: `extranonce(4B) + padding(54B) + low64(6B BE použito, zbytek prefix)`.
  Low 64 bitů iteruje miner (host-pack do LE u32/u64 limbů); prefix nese extranonce.
- Validita: **striktní `hash < target`** (U512 compare nad 64B BE poli).
- Fast-path: `mining_prestate_low64` předpočítá sponge stav z headeru + nonce prefixu →
  kandidát = absorb low64 + 3 permutace (místo 5).
- KAT: header=0,nonce=0 → `8e64e3d8e0f38f88…e8cc` (ověřeno i proti live poolu).

## Klíčové soubory

| Soubor | Obsah |
|---|---|
| `miner/src/auxpow/qpow.rs` | CPU hasher: `get_nonce_hash`, `mining_midstate`, `mining_prestate_low64`, `hash_from_prestate_low64`, `build_nonce`, `scan_low64`, `biguint_from_hex`, KAT testy |
| `miner/csrc/cuda/poseidon2_kernel.cu` | CUDA kernel — 1:1 port upstream `mining_u64.wgsl`, u64 Goldilocks, squeeze-early-out |
| `miner/src/gpu/qpow_cuda.rs` | `QpowCudaMiner`: NVRTC, U512 limb packing, CPU double-check safety net |
| `miner/src/runtime.rs` | `gpu_qpow`, `gpu_qpow_disabled`, `try_qpow_gpu_share`, target_512 decode z V3 `target_hex` |
| `miner/src/parallel.rs` | `find_qpow_share` — paralelní disjoint CPU ranges |
| `miner/src/auxpow/client.rs` | `StratumProtocol::QuantusStratum`, login/job-parse/submit (128-hex), `submit_qpow_share` |
| `miner/src/auxpow/types.rs` | `Job.target_512`, `Share.nonce_512/hash_512`, `ExternalAlgorithm::QPow` |
| `miner/src/v3_pool_client.rs`, `pool/src/v3_protocol.rs` | `ExternalSubmit.nonce_hex` |
| `pool/src/stratum.rs`, `auxpow_bridge.rs`, `auxpow_runtime.rs` | `nonce_hex` passthrough + dedikovaný `submit_qpow_share` branch |
| `cosmic-harmony/src/profit.rs` | `ExternalCoin::Quantus` (ticker **QTU** — QTC je Qubitcoin), fallback est., env override |

## Pooly

- `eu.quantus.k1pool.com:5660` (TCP+SSL stejný port, diff ~1–3G) — **aktivní upstream**;
  vyžaduje registraci, login = `Kr_WALLET.worker` (interní account wallet, ne qz adresa)
- `quantus.qelvhash.com:4444` (TLS 4443) — nejnižší diff, login-dialekt, testováno live
- `quantus.suprnova.cc:7071` (TLS 7074)
- `qtc.kryptex.network:7049`

Wire submit: `{"id":<session>, "job_id":…, "nonce":<128hex>, "result":<128hex>}` —
nonce je 64B BE hex, extranonce uvnitř prefixu.

## Nasazení (zion-pool → k1pool)

Pool-side bridge se řídí env v `/etc/zion/edge-environment.sh` (Edge) /
`V31/deploy/config/edge-environment.sh` (template). **Per-coin env suffix =
ticker, tedy `QTU`, ne `QUANTUS`:**

```sh
ZION_POOL_AUXPOW_COIN=QTU                              # Stream 2 = Quantus
ZION_POOL_AUXPOW_POOL_QTU=eu.quantus.k1pool.com:5660   # override CoinProfile defaultu
ZION_POOL_AUXPOW_WALLET_QTU=Kr…Fm                      # Kr_WALLET z k1pool účtu (NESMÍ do gitu)
ZION_POOL_AUXPOW_WORKER=zion-pool                      # login → "Kr….zion-pool"
```

⚠️ Pouze **jeden** non-CPU coin smí mít aktivní bridge — `is_cpu_coin` =
{XMR, VRSC}, vše ostatní jde do `build_external_stream_gpu`, který iteruje
`enabled_coins()` (HashMap, nondeterministic order) a vrátí první fresh job.
ZANO i Quantus současně → náhodný coin na Stream 2. ZANO proto vypnuto
(zakomentováno, re-enable = prohodit dvě řádky).

Login `Kr…Fm.zion-pool` proti `eu.quantus.k1pool.com:5660` **live ověřen
2026-10-30** — pool vrátil session id + job (`mining_hash` 32B, `target` 64B,
`extranonce` 4B, `difficulty` 3e9, `clean_jobs:true`).

Miner-side (rig 1070 Ti): `ZION_STREAM2_FORCE_COIN=quantus`
(`from_str_loose` přijímá `quantus`/`qtu`/`qpow`; job coin "QTU" parsuje
`from_ticker`).

## ENV

| Var | Význam |
|---|---|
| `ZION_STREAM2_FORCE_COIN=quantus` | force Stream 2 na Quantus (přijímá `quantus`/`qtu`/`qpow`) |
| `ZION_QTU_USD_PER_DAY=<x>` | profit override (generic: `ZION_<TICKER>_USD_PER_DAY`, env > live > fallback) |
| `ZION_CUDA_ARCH=sm_61` | NVRTC arch pro GTX 1070 Ti (Pascal) |
| `ZION_CUDA_BLOCK_SIZE`, `ZION_GPU_WORK_SIZE`, `ZION_EXT_GPU_GAP_MS` | kernel tuning / duty-cycle s llama |

## Ověřené

- KAT bit-exact (CPU + host-shim CUDA kernel, zero i nonzero vstupy)
- Kernel sponge-flow == `get_nonce_hash` (`midstate_kernel_flow_matches_reference`)
- Live qelvhash roundtrip: login + job + submit (below-target reject = validace chainu OK)
- Testy: 119 miner + 172 pool zelených; `gpu-cuda` feature compile čistý
- **2026-10-03 real-hardware (GTX 1070 Ti, driver 580.178, CUDA 13.0 / NVRTC 12.4):**
  NVRTC compile prošel autodetekcí `compute_61` (env `ZION_CUDA_ARCH` není
  potřeba), kernel launch + `mine_batch` běží, ~1.5–2.4 MH/s za sdíleného
  contextu se Stream 1 (`shared_cuda_device` — jeden `CudaDevice`, VRAM
  2184 MiB celkem, žádný druhý context). Koexistence s llama-serverem OK
  (GPU ~76 % util, 120 W). Accepted share na upstreamu zatím nepadl —
  miners minují přímo proti upstream `target_hex` (diff ~1e9), expected
  ~7 min/share; běží dál.
- **Kritický fix během debugu:** `V3PoolClient::next_job` měl invertovanou
  watch-semantiku — `rx.changed()` po resolvnutí sám označí hodnotu za seen,
  takže následný `has_changed()` je vždy false a loop hltal každý publikovaný
  bundle bez návratu → Stream 1 nikdy netěžil, session umírala na 60s job TTL.
  Postihlo by KAŽDÉHO na nové binárce (regrese watch refactoru), ne jen QPoW.
  Fix: po `changed()` číst rovnou `borrow()`, `has_changed()` jen jako
  fast-path před čekáním. Regresní test `next_job_returns_job_published_while_awaiting`.
  Po fixu: ZION stream live — stovky accepted sharů, 2 found blocky.

## TODO na 1070 Ti rigu (CUDA debug)

1. ~~`cargo build --release -p zion-miner --features gpu-cuda`~~ ✅
2. ~~NVRTC compile + kernel launch~~ ✅ (autodetect `compute_61`, log `gpu_qpow_cuda_init`)
3. Hashrate vs. SRBMiner-MULTI baseline; ladit `ZION_GPU_WORK_SIZE` / `ZION_CUDA_BLOCK_SIZE` — částečně: ~2 MH/s out-of-box, tuning teprve
4. Accepted share na upstreamu (k1pool přes zion-pool) — pending, čeká se na náhodu (diff ~1e9 @ ~2 MH/s)
5. ~~CUDA context sharing se Stream 1~~ ✅ (`shared_cuda_device`, jeden context)
6. Duty-cycle s llama ✅ implicitně ověřeno (llama + zion + qpow na kartě současně); `ZION_EXT_GPU_GAP_MS` pro jemné ladění

## Známé limity

- Pouze CUDA; OpenCL port = mechanický přepis kernelu (TODO).
- `share_forwarder.rs::try_forward` je dead code (validace u64-only); aktivní path je
  `forward_share_to_upstream` — pokud se forwarder někdy aktivuje, potřebuje qpow branch.
- Profit feed: WhatToMine/NiceHash QTU nemají → env override nebo custom pool-stats feed.
- Real-hardware NVRTC compile zatím neověřen (kernel ověřen host-shimem, ne na GPU).
