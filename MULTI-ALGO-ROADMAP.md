# Multi-Algo Expansion Roadmap — Trinity Engine, Pool, ZIS + Multichain

**Datum:** 2026-10-06 · **Stav:** plán schválený, fáze 0 ve výrobě
**Baseline:** `QPOW-ENGINE-REPORT.md`, `MINING-REPORT-2026-10-06.md`

## 0. Inventář (co už existuje)

### Miner — `ExternalCoin` (cosmic-harmony/profit.rs): 33 coinů

| Backend | Počet coinů s kernel_map | Poznámka |
|---|---|---|
| OpenCL | ~28 | plná sbírka v `csrc/opencl/` |
| CUDA | ~16 | `csrc/cuda/` + nativní `qpow_cuda.rs` |
| Metal | 3 | jen blake3-rodina |
| CPU | 3 | VRSC, XMR(stub), RTM |

**Ověřené E2E (pool→upstream accepted):** QTU (QPoW), ZANO (ProgPoWz, herominers), VRSC (verushash). Všechno ostatní = kernel existuje, ale E2E neprokázán.

### Známé nedostatky v kódu (z kernel_info komentářů)

- `evrprogpow`/`meowpow` → fallback na kawpow kernel, per-coin ProgPoW parametry chybí
- `pearlhash` → placeholder kernel (BLAKE3); skutečný PoUW je `pearl_pouw_native.cl` mimo kernel_info path
- `equihashzero`/`equihash`/`zelhash` → vyžadují multi-kernel host orchestraci (Wagner), zelhash prod path existuje (`zelhash_prod_kernel.cl`)
- `verthash` → kernel OK, ale chybí 1.2 GB data-file loading na hostu
- `randomx` → jen stub
- `bitcoin` → sha256d nemá žádný pool endpoint (merge-mining speciální)
- `pearl` stream je v mineru disabled (`ZION_STREAM2_ENABLED` legacy)

### Pool — `auxpow_runtime.rs` + `auxpow_bridge.rs`

- `ZION_POOL_AUXPOW_COINS` (multi-coin set), `ZION_POOL_AUXPOW_COIN` (GPU default), `_CPU_COIN`
- Per-session routing: `ZION_POOL_AUXPOW_GPU_COIN_ROUTE`/`_CPU_COIN_ROUTE` (`PATTERN=COIN,...`)
- Upstream bridge: `StratumClient` z `zion_miner::auxpow` — **jeden client per coin**, protokolové varianty se liší per algo (kawpow/ethash stratum, zcash-stratum VRSC, qpow custom, blake3 DCR/ALPH...)

### Desktop agent — `main.js`

- `gpuCoin` config → `ZION_STREAM2_FORCE_COIN`; `cpuCoin` → stream3; UI volba existuje pro QTU, dynamický `_coinAlgo`/`_coinStreamIndex` mapování už je částečně generické.

## 1. Fáze

### Fáze A — Kernel E2E matrix na 1070 Ti (teď)

Cíl: pro **každý algo s kernelem** prokázat `init → mine_batch → valid share candidate` na lokální GTX 1070 Ti (OpenCL platform 0 = NVIDIA CUDA OpenCL + nativní CUDA kde existuje).

Metodika:
1. **Non-trinity direct-pool E2E:** `zion-miner --no-zion --no-cpu --auxpow-pool <public pool> --gpu opencl/cuda` + `ZION_STREAM2_FORCE_COIN=<coin>` — pooly 2miners/woolypooly/zpool přijímají anonymní wallet login → reálný Accepted/Rejected je definitivní E2E.
2. **Lokální kernel smoke:** kde direct-pool nejde (chybí účet), syntetický job přes auxpow harness — kernel běží, vrací kandidáty, host verify path je zkontroluje.
3. Výstup: tabulka `algo → {builds, launches, produces candidates, upstream Accepted}`.

Pořadí testů (podle dostupnosti poolů + pravděpodobnost funkčnosti):
1. KAS (kheavyhash) — 2miners/nicehash
2. ALPH, DCR (blake3) — woolypooly
3. RVN (kawpow) — 2miners
4. ETC (etchash) — 2miners
5. ERG (autolykos) — 2miners
6. KLS (karlsenhash) — cedric-crispin
7. FLUX (zelhash prod) — woolypooly
8. BEAM, ZANO (re-verify), QTC (qhash), IRON (fishhash), NEXA, CKB, CFX, ZEC, PHX, KRX, DNX

Fix smyčka: kernel launch fail → log OpenCL compile error → fix `csrc/opencl/*.cl` nebo host dispatch v `gpu_opencl_full.rs`.

### Fáze B — Pool multi-coin upstream bridge

1. `ZION_POOL_AUXPOW_COINS` rozšířit o ověřené coiny; každý coin potřebuje `ZION_POOL_AUXPOW_POOL_<T>` + `ZION_POOL_AUXPOW_WALLET_<T>`.
2. Stratum protokolové varianty: sjednotit `StratumClient` — některé algos mají custom job parsing (kheavyhash BFF-header, equihash solutions, progpow epoch DAG). Každý upstream connect = coin-profile.
3. Session routing už hotové (`GPU_COIN_ROUTE`) — stačí přidat coiny.
4. Share forward path per-algo: `ShareForwardRequest` musí nést algo-specific payload (equihash solution hex, extranonce2, atd.) — už částečně je.

### Fáze C — ZIS auth + multichain payouts

1. **ZIS (Zion Identity):** miner→pool session auth přes ZIS token místo plain wallet string; pool ověří identity přes G8/ZIS endpoint → per-user accounting, ban/allow list, worker naming.
2. **Multichain payout:** miner těží libovolný externí coin → příslušnost připsaná v ZION na PPLNS účet (existující `payout.rs`/`v3_pplns.rs`) — koň zůstane skrz `deferred_payout`/`revenue_proxy`; alternativa: direct payout v nativním coinu přes multichain bridge (warpd surface).
3. Definice úspěchu: miner s `gpuCoin=KAS` dostane accepted share na upstream + ZION credit na poolu.

### Fáze D — Desktop agent multi-algo E2E

1. UI: coin picker pro `gpuCoin`/`cpuCoin` z `ExternalCoin::ALL` (jen gpu_kernel_available pro zvolený backend) — dropdown v nastavení.
2. Per-coin tuning presets (batch, duty, gap).
3. `miner_config.json` schéma: multi-algo profile store.
4. Status panel: per-stream coin+algo+pool+A/R (už částečně je přes `_coinAlgo`).
5. **E2E self-test mode v agentovi:** tlačítko "Test kernel" → spawn krátký miner run s `--no-zion --no-cpu` proti veřejnému poolu → report accepted/latency/MH/s.

## 2. Rizika a limity

- DAG algos (kawpow/ethash/progpow/fishhash) potřebují epoch DAG build — na 1070 Ti 8 GB VRAM OK pro všechny kromě budoucích epochů.
- Equihash/zelhash multi-kernel orchestrace je největší zbývající kus práce.
- Některé default_pool() endpointy můžou být mrtvé — každý se ověří při E2E sweepu.
- Krypto-legitimita: anonymní mining na veřejné pooly s placeholder wallet = shares jdou do void — jen pro testování, ~minuty per coin.

## 3. Aktuální stav (running log)

| Krok | Stav |
|---|---|
| Inventář miner/pool/agent | ✅ hotovo |
| Kernel E2E matrix | ⏳ fáze A právě běží |
| Pool multi-coin enable | pending |
| ZIS auth | pending |
| Multichain payout | pending |
| Agent multi-algo UI | pending |
