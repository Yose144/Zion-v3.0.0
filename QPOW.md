# QPOW — Quantus nativní integrace do Trinity (Stream 2)

Status: **implementováno, čeká na CUDA runtime debug na GTX 1070 Ti**
Datum: 2026-10-30

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

- `quantus.qelvhash.com:4444` (TLS 4443) — nejnižší diff, login-dialekt, testováno live
- `quantus.suprnova.cc:7071` (TLS 7074)
- `qtc.kryptex.network:7049`

Wire submit: `{"id":<session>, "job_id":…, "nonce":<128hex>, "result":<128hex>}` —
nonce je 64B BE hex, extranonce uvnitř prefixu.

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

## TODO na 1070 Ti rigu (CUDA debug)

1. `cargo build --release -p zion-miner --features gpu-cuda`
2. `ZION_STREAM2_FORCE_COIN=quantus ZION_CUDA_ARCH=sm_61` run → ověřit NVRTC compile + kernel launch (logy `qpow_cuda`)
3. Hashrate vs. SRBMiner-MULTI baseline; ladit `ZION_GPU_WORK_SIZE` / `ZION_CUDA_BLOCK_SIZE`
4. Accepted share na `quantus.qelvhash.com:4444` (nejen below-target reject)
5. CUDA context sharing se Stream 1 (zion kernel) — ověřit že `shared_cuda_device` reuse funguje, ne dva contexty na jedné kartě
6. Duty-cycle s llama: `ZION_EXT_GPU_GAP_MS` (VRAM OK — kernel nemá DAG)

## Známé limity

- Pouze CUDA; OpenCL port = mechanický přepis kernelu (TODO).
- `share_forwarder.rs::try_forward` je dead code (validace u64-only); aktivní path je
  `forward_share_to_upstream` — pokud se forwarder někdy aktivuje, potřebuje qpow branch.
- Profit feed: WhatToMine/NiceHash QTU nemají → env override nebo custom pool-stats feed.
- Real-hardware NVRTC compile zatím neověřen (kernel ověřen host-shimem, ne na GPU).
