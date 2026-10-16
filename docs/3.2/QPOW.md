# QPOW — Quantus nativní integrace do Trinity (Stream 2)

Status: **CPU + CUDA + OpenCL + Metal nativní backendy; OpenCL obsahuje ověřenou
AMD ISA implementaci — zatím nenasazenou do produkce, SRBMiner parity pending**
Datum: 2026-10-11 (historické CUDA debug runy 2026-10-03 / live E2E viz níže)

Quantus (QPoW = Poseidon2 nad Goldilocks polem) je plně integrovaný jako
`ExternalCoin::Quantus` na Trinity Stream 2 (GPU external). Těžba běží nativně —
vlastní CPU fast-path + GPU backendy (CUDA / OpenCL / Metal) — bez externího
miner binárky.

## Architektura

```
upstream pool (stratum login-dialekt)
  │  mining_hash 32B, target 64B BE, extranonce 4B, job_id, seq, difficulty
  ▼
miner: auxpow/client.rs (QuantusStratum)  →  Job{target_512}
  │  Stream 2: try_qpow_gpu_share → QpowGpuMiner (CUDA/OpenCL/Metal/Multi)
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
- Nonce: 64B / 512-bit BE. Layout z `build_nonce`: první 4B = extranonce,
  dalších 52B = fixní prefix, posledních 8B = low64 big-endian
  (`nonce[56..64]`). Low 64 bitů iteruje miner (host-pack do LE u32/u64 limbů);
  prefix nese extranonce.
- Validita: **striktní `hash < target`** (U512 compare nad 64B BE poli).
- Fast-path: `mining_prestate_low64` předpočítá sponge stav z headeru + nonce prefixu →
  kandidát = absorb low64 + 3 permutace (místo 5).
- GPU kernel počítá 2 povinné permutace pro první squeeze (nelze přeskočit);
  plný CPU hash `get_nonce_hash` zahrnuje i permutaci druhého squeeze.
- KAT: header=0,nonce=0 → `8e64e3d8e0f38f88…e8cc` (ověřeno i proti live poolu).

## Klíčové soubory

Cesty jsou relativní k `V31/L1`.

| Soubor | Obsah |
|---|---|
| `miner/src/auxpow/qpow.rs` | CPU hasher: `get_nonce_hash`, `mining_midstate`, `mining_prestate_low64`, `hash_from_prestate_low64`, `build_nonce`, `scan_low64`, `biguint_from_hex`, KAT testy |
| `miner/csrc/cuda/poseidon2_kernel.cu` | CUDA kernel — port upstream `quantus-miner` engine-cuda G2 (`mining.cu`): `__constant__` RC tabulky, inline-PTX carry, `reduce128`, sparse nonce inject, early-reject po 1. squeeze, candidate-index results |
| `miner/src/gpu/qpow_cuda.rs` | `QpowCudaMiner`: NVRTC, U512 limb packing, CPU double-check safety net |
| `miner/csrc/opencl/poseidon2_kernel.cl` | OpenCL kernel — stejná aritmetika + `QPOW_GCN_NATIVE` větev (8 AMD ISA helperů; source default 0, auto-gated) |
| `miner/src/gpu/qpow_opencl.rs` | `QpowOpenclMiner`: OpenCL host, AMD auto-detekce, portable fallback, CPU re-verifikace |
| `miner/csrc/metal/poseidon2_kernel.metal` | Metal kernel — line-level MSL port (`metal::mulhi`, `atomic_uint`) |
| `miner/src/gpu/qpow_metal.rs` | `QpowMetalMiner`: Metal host; na macOS `auto` zkouší Metal první |
| `miner/src/gpu/mod.rs` | `QpowGpuMiner` enum + `Multi` hashrate-weighted nonce partition |
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

## Nasazení (zion-pool → k1pool) — historický příklad

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
| `ZION_QPOW_OCL_NATIVE=0` | vynutí portable OpenCL build (vypne AMD ISA větev) |
| `ZION_QPOW_OCL_SRC=<path>` | vlastní kernel source — úspěšný override potlačí automatickou injektáž native maker, manuální build opts zůstávají |
| `ZION_OCL_PLATFORM_IDX`, `ZION_OCL_DEVICE_IDX`, `ZION_OCL_DEVICE_NAME` | výběr OpenCL platformy / zařízení; jmenný filtr má přednost před indexem |
| `ZION_QPOW_OCL_DEVICES=gfx900,gfx1010` | filtr zařízení pro multi-GPU partition |
| `ZION_QPOW_OCL_LOCAL_SIZE`, `ZION_QPOW_OCL_NPT` | local size / nonces-per-thread (defaulty 64 / 1) |

## AMD ISA (nativní GCN/RDNA aritmetika) — ověřeno 2026-10-11

OpenCL kernel má `QPOW_GCN_NATIVE` větev (source default `0`): 8 nativních
aritmetických helperů (schoolbook partial products + carry trees),
7-instrukční carry-only `reduce128` a fused `mul128_add_wide` použitý v
`int_round_p`. Lazy reducer sémantika, konstanty, počet kol, nonce/target/
results ABI i CPU re-verifikace kandidátů jsou nezměněné; portable násobení
zůstává `a*b` + `mul_hi`.

- Automatický výběr: jen platforma `AMD Accelerated Parallel Processing` +
  arch `gfx1010` (wave32) nebo `gfx900` (wave64), case-insensitive; jinde portable.
- `ZION_QPOW_OCL_NATIVE=0` → vynucený portable build. Selhání native compile →
  retry s `-DQPOW_GCN_NATIVE=0`; selhání portable buildu se propaguje.
  Úspěšný `ZION_QPOW_OCL_SRC` override potlačí automatickou injektáž maker.
- CPU safety: každý GPU kandidát se před submitem znovu ověří CPU hashem —
  native větev nemůže odeslat nevalidní share.

### Zmrazené výsledky (lokální benchmark, ne sustained pool rate)

| Zařízení | Medián |
|---|---|
| gfx1010 (RX 5600 XT) | 82.07 MH/s |
| gfx900 (RX Vega 64) | 103.125 MH/s |

Metoda: batch 4 194 304, local size 64, NPT 1, 128 iterací, prvních 16
zahozeno, 112 steady vzorků na zařízení. Starší SRBMiner reference jsou
~105/137 MH/s — parity **nebyla** dosažena. Kód není nasazený do produkčních
binárek ani do agent/engine/OC konfigurace.

### Verifikace

- `cargo test --release --locked -p zion-miner --features gpu-opencl --lib
  -- --test-threads=1` → 157 passed / 0 failed / 11 ignored.
- GPU gates na obou kartách (native i forced-portable): aritmetika
  68 162 edge/random párů × 14 výstupů, první squeeze 4 096 nonců vs CPU,
  golden hash ±1 + nonce-boundary.
- Strict clippy `-D warnings` selhává na 87 pre-existing chybách mimo
  `qpow_opencl.rs` (v novém kódu žádné).

### Reprodukce (GPU testy — izolovaný rig)

Z `V31`:

```sh
ZION_OCL_PLATFORM_IDX=0 ZION_OCL_DEVICE_IDX=0 cargo test --release --locked \
  -p zion-miner --features gpu-opencl --lib \
  opencl_arithmetic_matches_lazy_reference -- --ignored --nocapture --test-threads=1
```

Stejně `opencl_first_squeeze_matches_cpu_corpus` a
`opencl_kernel_matches_cpu_golden_and_boundaries`; pro druhou kartu
`ZION_OCL_DEVICE_IDX=1`. Forced-portable: prefix `ZION_QPOW_OCL_NATIVE=0`.
Pro auto-selection test nesmí být nastavený `ZION_QPOW_OCL_SRC` ani ruční
build overrides.

Benchmark: `QPOW_BENCH_BATCH=4194304 QPOW_BENCH_ITERS=128` na existující test
`qpow_bench_effective_throughput` (stejný cargo příkaz); prvních 16 iterací
zahodit dle receptu, nepoužívat best-of-N.

## Ověřené (historické záznamy — CUDA live/E2E 2026-10-03, ne aktuální měření)

- KAT bit-exact (CPU + host-shim CUDA kernel, zero i nonzero vstupy)
- Kernel sponge-flow == `get_nonce_hash` (`midstate_kernel_flow_matches_reference`)
- Live qelvhash roundtrip: login + job + submit (below-target reject = validace chainu OK)
- Testy: 119 miner + 172 pool zelených; `gpu-cuda` feature compile čistý
- **2026-10-03 real-hardware (GTX 1070 Ti, driver 580.178, CUDA 13.0 / NVRTC 12.4):**
  NVRTC compile prošel autodetekcí `compute_61` (env `ZION_CUDA_ARCH` není
  potřeba), kernel launch + `mine_batch` běží, sdílený context se Stream 1
  (`shared_cuda_device` — jeden `CudaDevice`, VRAM 2184 MiB celkem, žádný
  druhý context). Koexistence s llama-serverem OK.
- **2026-10-03 G2 kernel + tuning (stejná karta):** port upstream
  `quantus-miner/crates/engine-cuda` `mining.cu` (post-opt revize) na
  Trinity ABI: `results[9]` = count + indexy kandidátů, `prestate[24]` z
  `mining_prestate_low64`, cap na low64-carry hranici, CPU re-verifikace
  každého indexu před submitem. Dispatch tuning na Pascal: **1 nonce /
  thread, uncapped grid** (na sm_61 je npt>1 ~12–15 % pomalejší — j-loop
  s 12-lane u64 stavem zbytečně zvedá register pressure; měřeno přes
  `qpow_bench_effective_throughput`, env `QPOW_BENCH_BATCH`).
  **Naměřené rychlosti (effective, vč. host overheadu):**
  - starý kernel (1:1 WGSL port): ~2.3 MH/s live
  - G2 port, solo (`--no-zion --no-cpu`, `ZION_EXT_GPU_GAP_MS=0`):
    **~38–40 MH/s** — referenční `quantus-miner benchmark --cuda-gpu`
    na stejné kartě: 33.1 MH/s → jsme ~18 % NAD upstreamem
  - Trinity live (ZION GPU stream + QPoW, gap 50 ms): **QTU ~20–27 MH/s**
    + ZION ~0.9–1.1 MH/s současně, oba 99.9–100 % accept
  - Accepted QTU shares na upstreamu (k1pool přes zion-pool): potvrzeno
    (job `188908f9_…`, `188908fb`, `188908fc`); občasný
    `Invalid job id` = stale-job race při rotaci upstream jobů.
- **Kritický fix #2 (stream throughput):** `mine_auxpow_share_batch` po
  neúspěšném GPU batchi (`None`) propadávalo na generický CPU scanner —
  QPoW tak po každých ~145 ms GPU práce rescanovalo 5.24M noncí na CPU
  (~190 kH/s, ~28 s stall). Nově: živý QPoW CUDA backend → rovnou
  `NoAuxPoWSolution`, CPU fallback jen při selhání GPU init.
  To byl hlavní důvod, proč live metrika ukazovala ~13–18 MH/s místo ~39.
- **Kritický fix během debugu:** `V3PoolClient::next_job` měl invertovanou
  watch-semantiku — `rx.changed()` po resolvnutí sám označí hodnotu za seen,
  takže následný `has_changed()` je vždy false a loop hltal každý publikovaný
  bundle bez návratu → Stream 1 nikdy netěžil, session umírala na 60s job TTL.
  Postihlo by KAŽDÉHO na nové binárce (regrese watch refactoru), ne jen QPoW.
  Fix: po `changed()` číst rovnou `borrow()`, `has_changed()` jen jako
  fast-path před čekáním. Regresní test `next_job_returns_job_published_while_awaiting`.
  Po fixu: ZION stream live — stovky accepted sharů, 2 found blocky.
- **2026-10-03 desktop-agent E2E (triple stream, TUI spawn):** `npm run tui`
  nad `~/.config/zion-desktop-agent/miner_config.json` (`tripleStream:true`,
  `gpuCoin:"QTU"`, `cpuCoin:"VRSC"`) → spawn args `--v3-trinity` bez
  `--no-gpu/--no-cpu`, env `/proc/<pid>/environ` ověřen:
  `ZION_STREAM2_FORCE_COIN=QTU`, `ZION_STREAM3_FORCE_COIN=VRSC`,
  `ZION_AUTONOMOUS=0`, `ZION_(GPU_)BACKEND=cuda`. TUI streams tabulka:
  ZION ~4–5 MH/s (534 acc, 99.8 %) + GPU BOOST 1 `qpow-poseidon2`
  **28 MH/s (4 QTU acc)** + CPU BOOST 2 `verushash` ~5 MH/s
  (**22 VRSC acc, 100 %**). Celkem 37 MH/s, 99.6 %.
- **⚠️ Feature-parity gotcha:** miner buildnutý jen s `--features gpu-cuda`
  nemá `native-verushash` → `mine_verushash` je stub vracející `None`
  okamžitě → Stream 3 „těží" prázdnou smyčkou a metrika ukazuje falešné
  desítky GH/s (`batch/µs`). Agentův `prepare-rust-miner.js` builduje s
  `native-all` — packaged binárka v `resources/zion-miner` musí být buildnutá
  stejnými features (`public_build,auxpow,gpu-opencl,native-all,tui,gpu-cuda`).
- **TUI (src/tui/index.js):** doplněno čtení/persist `gpuCoin`, `cpuCoin`,
  `gpuStream2Batch`, `gpuExtGapMs` + env `ZION_STREAM2_FORCE_COIN`,
  `ZION_STREAM3_FORCE_COIN`, `ZION_STREAM2_BATCH`, `ZION_EXT_GPU_GAP_MS` —
  stejná semantika jako `main.js` spawn.
- **2026-10-03 reject stabilization + batch tuning (produkce, Edge):**
  - `auxpow_runtime` drainoval `share_rx` až PO `wait_for_job(1s)` → share
    čekal v kanálu ~1 s než se forwardnul upstream. Při QTU rotaci jobů
    ~5–15 s a VRSC notifies co ~2–20 s to přímo generovalo `Invalid job id`
    / `job not found`. Fix: drain na začátek iterace + poll timeout 100 ms
    (`wait_for_job` se budí okamžitě přes Notify, fresh joby netrpí).
    Deploy wt-main → sha `688d5605…`.
  - `ZION_STREAM2_BATCH=1048576` (1M) — na sm_61 je 1M batch rychlejší než
    auto 5.24M i solo (bench ~39–40 vs ~35 MH/s) a pod kontencí se krátké
    QPoW kernely lépe proplétají se ZION kerneli → **QTU ~28–30 MH/s**
    (↑ z ~24) a současně **ZION ~5.5–5.9 MH/s** (↑ z ~4). Win-win.
  - Výsledek: 50 ext shares Accepted / 0 Rejected za ~14 min okna
    (předtím ~8–17 % stale). Zbylé teoretické rejecty = inherentní rasa
    (upstream job žil jen ~1.4 s — nelze napravit, jen snížit pravděpodobnost).
  - `cpuStream3Batch` → `ZION_EXT_CPU_NONCE_COUNT` přidáno do
    main.js + TUI (opt-in ≥100 k; 2M v configu) — kratší refresh granularity
    pro VRSC; projeví se až po restartu Electron agenta (main.js je require'd
    při startu, env se nedá doplnit živému spawnu).

## TODO na 1070 Ti rigu (CUDA debug)

1. ~~`cargo build --release -p zion-miner --features gpu-cuda`~~ ✅
2. ~~NVRTC compile + kernel launch~~ ✅ (autodetect `compute_61`, log `gpu_qpow_cuda_init`)
3. ~~Hashrate tuning~~ ✅ — G2 kernel + dispatch: ~39 MH/s solo / ~22–27 MH/s v trinity (baseline upstream reference miner 33.1 MH/s solo)
4. ~~Accepted share na upstreamu~~ ✅ — QTU shares accepted na k1pool přes zion-pool
5. ~~CUDA context sharing se Stream 1~~ ✅ (`shared_cuda_device`, jeden context)
6. Duty-cycle s llama ✅ implicitně ověřeno (llama + zion + qpow na kartě současně); `ZION_EXT_GPU_GAP_MS` pro jemné ladění

## Známé limity

- AMD ISA větev OpenCL kernelu je ověřená, ale **není nasazená** do produkčních
  binárek; SRBMiner parity pending (82.07/103.125 MH/s vs ~105/137 MH/s
  reference — viz AMD ISA sekce).
- `share_forwarder.rs::try_forward` je dead code (validace u64-only); aktivní path je
  `forward_share_to_upstream` — pokud se forwarder někdy aktivuje, potřebuje qpow branch.
- Profit feed: WhatToMine/NiceHash QTU nemají → env override nebo custom pool-stats feed.
- Real-hardware NVRTC compile ověřen 2026-10-03 na GTX 1070 Ti (viz historická
  sekce výše).
