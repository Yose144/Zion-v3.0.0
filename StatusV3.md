# ZION V3 — Canonical Status (Mainnet Beta)

> **Datum poslední aktualizace:** 2026-08-10
> **Update (2026-08-10):** **VRSC share rejection eliminated + performance tuning +14% hashrate.** Dva bugy způsobovaly VRSC share reject (~86-97% accept rate): (1) race condition na sdíleném `ext_result_rx` kanálu — VRSC a ZANO výsledky se zaměňovaly; fix: per-coin kanály (`vrsc_result_rx`/`zano_result_rx`) + stale result draining. (2) `skip_stale` check `job_rx.has_changed()` se aktivoval při každém novém V3 job bundlu (i ZION-only) → validní VRSC share přeskočeny; fix: kontrola pouze když se změnil `cpu_external.job_id`. Performance tuning: `ZION_EXT_GPU_GAP_MS=0` (yield_now místo 50ms sleep — CUDA driver scheduling), `ZION_NONCE_COUNT=10M`, `ZION_EXT_CPU_NONCE_COUNT=10M`. Výsledek: **22-24 MH/s total (ZION 3.14 + ZANO 9.13 + VRSC 11.77), 100% accept rate napříč všemi 3 streamy**. Commity: `9cbaa6302` (VRSC fix), `4f6f8dd89` (perf tuning). `work_size=8192` testován ale horší (18-20 MH/s, VRAM bandwidth pressure) — reverted na 4096. GPU power limit 140W (throttle na 1493 MHz místo 1683 MHz boost) — pro increase na 170W potřebný sudo. Kompletní report: [`REPORT_2026-08-10_VRSC_REJECTION_FIX_AND_TUNING.md`](./REPORT_2026-08-10_VRSC_REJECTION_FIX_AND_TUNING.md).
>
> **Update (2026-08-10):** **Trinity Mining E2E — stale pool binary deploy fix a worker-name cleanup.** Na Edge běžel starý `zion-pool` binár bez posledních `pop_job()`/`touch_job_timestamp` změn; share se tak odesílaly na neaktuální upstream joby a LuckPool/HeroMiners je odmítaly (`job not found`, `Duplicate share`, `Job expired`). Fresh build z `V31/`, redeploy na `/opt/zion/V31/target/release/zion-pool` a restart `zion-v31-pool` — upstream nyní VRSC i ZANO share acceptuje. Worker pro upstream zjednodušen na `zion-pool` bez coin suffixu (`a5b3aa2c6`); HeroMiners zobrazuje worker `zion-pool` (~13 MH/s), LuckPool aktuálně `noname` z důvodu vlastní normalizace, kredity ale běží (~2 MH/s). Místní miner restartován přes `~/Desktop/Start.sh --bg` a připojen k poolu. Aktuální stav: ZION 100%, ZANO 100%, VRSC acceptováno upstream.
>
> **Update (2026-08-10):** **ZANO ProgPoW duplicate-share root cause fixed.** Multiple GPU miners on the same upstream `eth_getWork` job all started scanning from nonce 0, so the first miner to find the solution submitted it and every other miner received `duplicate share`. Fix in `V31/L1/miner/src/runtime.rs`: each new external GPU job resets the nonce cursor to a unique 64-bit base derived from `wallet + worker + job_id + process_id + counter` (blake3 hash). If the pool supplies an `extranonce1_hex` nonce offset, the miner uses it. Local miner rebuilt with `ZION_CPU_TARGET=native cargo build --release -p zion-miner --features gpu-cuda,native-all,tui`, restarted via `~/Desktop/Start.sh --bg`, and now produces non-overlapping ZANO nonce ranges. VRSC arch-aware autotune ported from V3 archive: `MinerConfig` now uses `gpu::verushash_cpu_tuning()` to pick thread count and nonce batch from physical/logical core layout and CPU vendor/model. First post-fix ZANO shares accepted upstream with nonce base ~1.34e19 and ~5.42e18. CUDA remains the default GPU backend for Stream 1 (deeksha) and Stream 2 (ZANO ProgPoW); OpenCL is available but CUDA is verified on the GTX 1070 Ti. **CUDA ProgPoW DAG disk cache added 2026-08-10:** `V31/L1/miner/src/gpu/cuda_external.rs` now persists generated DAGs to `$ZION_DAG_CACHE_DIR/{algo}_epoch{N}.bin` (default `~/.zion/dag-cache`) and loads them on the next start. Set `ZION_DAG_CACHE_DISABLE=1` to skip. First run generates on GPU (~10 s for ProgPoW epoch 126) and saves the cache (~2.7 s for the 2 GB file); subsequent starts load from disk and bypass GPU generation.
>
> **Update (2026-08-10):** **CUDA ProgPoW DAG disk cache validated in production.** Miner vygeneroval a uložil `progpow_epoch126.bin` (2.0 GB) za 2.7 s; následný restart načetl cache z disku, přeskočil ~10 s GPU generaci a začal těžit ZANO. Monitoring prvních minut: ZANO 1 accepted / 0 rejected (nonce `11049022021416437794`, vysoké z unikátního base), ZION ~60 accepted / 0 rejected, VRSC 5 accepted / 2 rejected (pre-existing `job not found`/`ntime out of range`, nikoliv duplicate). Žádný ZANO duplicate-share reject.
>
> **Update (2026-08-09):** **V31 Trinity Mining E2E — finální tuning complete.** Tři streamy (ZION/ZANO/VRSC) běží na Edge pool s celkovým accept rate **96.7%**. Kritický bug fix: `pop_job()` v `auxpow_bridge.rs` vracel nejstarší job z fronty místo nejnovějšího → VRSC "ntime out of range" a ZANO "Duplicate share" rejects. VRSC share difficulty override na 180M (pool-side, `ZION_VRSC_MIN_DIFF=180000000`) + 10 CPU threadů (`ZION_EXT_CPU_THREADS=10`). Dashboard Trinity Mining panel opraven (auth-exempt routes + hashrate format). Kompletní report: [`REPORT_2026-08-09_TRINITY_TUNING_FINAL.md`](./REPORT_2026-08-09_TRINITY_TUNING_FINAL.md). Accept rates: ZION 100%, VRSC 72.7%→83% (stále multi-hop latence), ZANO 100% (post-fix).
> **Update (2026-08-07):** **V31 3.2.0 "One Love" payout confirmation sweep nasazen a potvrzený.** Pool `/api/v1/payouts` označuje výplaty `confirmed` on-chain (37 confirmed / 13 unconfirmed při height ~87). Edge `zion-v31-node`/`zion-v31-pool`/`zion-v31-miner`/`zion-v31-multichain` jsou active, chain roste (height 94+). `zion-v31-dao`, `zion-v31-oasis`, `zion-edge-python-dashboard`, `zion-website`, `zion-oasis-web` a `zion-marketplace` rovněž active. Legacy V3 `zion-node`/`zion-pool` a `zion-dashboard-web` zůstávají failed (expected po cutoveru / port conflict). `logrotate.service` je failed na systémové úrovni, neblokuje ZION. Workspace verze je `3.1.0-beta`, protokol `zion-v3-node/3.1.0-alpha`. Root dokumentace rekonciliována s kódem a Edge realitou.
> **Update (2026-08-06):** **3.2.0 oficiálně pojmenováno "One Love"** — viz [`V31/PLAN_TO_3.2.md`](./V31/PLAN_TO_3.2.md). Název odkazuje na vizi jednoty a pokračování odkazu Boba Marleyho: spojení technologie, komunity a lidské solidarity. Forward plán na 3.2 Mainnet Stable je nyní kanonický.
> **Update (2026-08-06):** WARP non-EVM production hardening: `deploy-edge.sh` nyní builduje `warpd` a automaticky instaluje `/etc/zion/warp.toml` z `V31/L2/multichain/warp.example.toml`, `zion-v31-multichain.service` běží `warpd --config /etc/zion/warp.toml --listen 127.0.0.1:8453 --db /data/zion/warp.db`, nginx proxy `/api/warp/` → `127.0.0.1:8453`. Přidán Prometheus `/metrics` endpoint do `warp/server.rs` (text/plain s `Accept: application/json` fallback). Opraven clippy warning v `swap/dex.rs`. `cargo test -p zion-multichain` a `cargo clippy -p zion-multichain` čisté.
>
> **Update (2026-08-06):** ZionDex E2E integrace s `warpd` (Option 1): `warpd` nyní startuje i `MultichainService` a `ApiServer` DEX endpointy (`/v1/swap/quote`, `/v1/swap/intent`, `/v1/swap/intent/:id/bid`, `/v1/swap/intent/:id/settle`, `/v1/swap/intent/:id/execute`) na portu `listen_port + 1` (8454). `MultichainService` rozšířen o podporu EVM chainů (Arbitrum, Optimism, BSC, Polygon, Avalanche, zkSync, Linea) a tolerantně přeskakuje nepodporované adaptéry. nginx získá `/v1/` proxy na `127.0.0.1:8454`. `cargo test -p zion-multichain` a `cargo clippy -p zion-multichain` čisté.

> **Datum poslední aktualizace:** 2026-08-07
> **Update (2026-08-07):** V31 kanonický `EkamDeeksha` v3.2 aktivní na Edge: 512 KiB scratchpad, 2 AES passes, 128 random reads, Keccak256 final hash. CPU `ekam_deeksha.rs` (konstanty `SCRATCHPAD_SIZE=512 KiB`, `PASSES=2`, `RANDOM_READS=128` v `V31/L1/cosmic-harmony/src/algorithm/ekam_deeksha.rs`), OpenCL/CUDA/Metal kernely a `zion-miner` GPU backend mapování synchronizovány. `cargo test -p zion-cosmic-harmony -p zion-core -p zion-pool -p zion-miner` a `cargo clippy --workspace` čisté.
> **Update (2026-08-05):** **Fáze D E2E COMPLETE.** `cargo test --workspace` 2079 testů pass. V31 miner na Edge našel a odevzdal pool share s `WALLET.worker` autentizací (`zion1g5u0m3j5x5w2t730c8s4h4m5a5v4a7p6p0c07y7.v31-miner`), pool zapsal `share accepted`, block height 50+. Web `/api/health` `ok` po celou dobu, rpc_node i mining_pool healthy. **Playwright UI E2E 3/3 pass** (`app.zionterranova.com/pool/miner/[address]` se správně vykresluje). **30min smoke test PASS** — služby `zion-v31-miner`, `zion-v31-pool`, `zion-v31-node`, `zion-website` zůstaly `active`, `/api/health` zelený. **Edge backup + off-site sync COMPLETE** — denní backup `/opt/zion/backups/daily/zion-edge-20260805_213243.tar.gz` (47M, 117 souborů) a off-site sync do `~/2.9.6-main/backups/edge` (1.2G, integrity OK). **Dashboard `https://dashboard.zionterranova.com` komplexně napojen na V31 služby**: `/api/services`, `/api/health`, `/api/readiness` a `/api/v2/status` nyní správně reflektují `v31-miner` jako `running`, `/api/readiness` vrací **100 %**, checklist 13/17. Opraveny systemd mapy, `EDGE_SERVICE_ORDER`, `get_edge_server_status` a `_build_health_map` pro V31. Git tag `v3.1.0-alpha.2-phase-D`. Při rychlých rebuild/restartech se aktivoval `fail2ban`/`ufw`; aktuální dev IP `109.81.83.81` byla whitelisted a přidána do `V31/AGENTS.md`.
> **Update (2026-08-06):** V31 DAO governance runtime rozšířen o treasury, humanitarian, db, l1_scanner, metrics, executor, consent, co_admin, cross_layer a prizes. `zion-dao` má nyní 74 testů. `zion-dao` binárka otevírá SQLite DB, načítá návrhy/hlasy do `GovernanceRuntime`, persistuje všechny změny, spouští L1 memo scanner a předává mu hlasy přímo do runtimeu, vystavuje `/metrics`. Dashboard (`ZION_OS/dashboard/v31.py`) nyní zobrazuje i DAO metriky/health/stats a má `dao_api` port v `nodes.json`. **Fáze B hotova z hlediska kódu a testů** — GPU OpenCL/CUDA/Metal kompiluje, `zion-miner` triple-stream běží, profit switching a TUI/metriky zapojeny, `cargo test -p zion-miner` 92 pass. **Go/No-Go testy na reálném GPU/rigu (OpenCL/CUDA/Metal) zůstávají pending.** **Fáze C COMPLETE** — DAO governance runtime, ZionDex C2, HTLC endpoints, live profit oracle, bridge consensus, CLI wallet/tx/lifecycle, dashboard metriky. `zion-multichain` má 574 testů, celý `V31` workspace 2079 testů, `cargo clippy --workspace` čisté. **Dashboard UI/UX update do V31 hotov, nasazen na Edge a `/health` OK. V31 banner KPIs integrovány do full dashboardu. Nový "V31 Production" panel přidává detailní metriky, live log viewer pro V31 služby a vložený Grafana dashboard (`v31-mainnet`) přímo v `/dashboard`. Pool API/metrics port opraven z 8455 na 8080, Prometheus scrape target a Grafana provisioning nasazeny na Edge. **V31 cutover proveden**: V3 služby zastaveny a maskovány, `zion-v31-node` osamostatněn od V3, dashboard registry nastavena V31-first.** V31 GPU backend port — CUDA, OpenCL, Metal a nativní CPU shims nyní kompilují v `V31/L1/miner`. Kompletní report: [`REPORT_2026-08-06.md`](./docs/3.1/REPORT_2026-08-06.md). `cargo clippy --workspace` je čisté a `cargo test -p zion-multichain` prochází. Opraveny cudarc 0.12.1 závislosti, `progpow_codegen` viditelnost, `auxpow` feature gating, `kheavyhash::mine` argument order a macOS `block`/`objc` závislosti. `native-verushash` linkuje `-lomp` (vyžaduje libomp na macOS, na Linuxu bezproblémové). Viz `V31/STATUS.md`.
> **Verze:** 3.0.7 "Trinity All Green" (V3 archiv) / 3.1.0-beta (V31 Mainnet Alpha — LIVE na Edge, protokol 3.1.0-alpha) / 3.2.0 "One Love" (Mainnet Stable — ve vývoji)
> **Protokol:** `zion-v3-node/3.0.7` (V3 archiv) / `zion-v3-node/3.1.0-alpha` (V31)
> **Genesis hash (V3 compat, production):** `4cf7560f9140deb9376fa6567e76eacaa8bd1b733ca3c91b00830a08f332ef71`
> **Genesis hash (V31 native):** `96109423298542a836edc10b9ba5ff9b29a1970418db543c2ee5cd952fe35bdb`
> **Status:** Mainnet Beta — oficiální public launch **2026-12-31**
> **HARD GENESIS RESET (2026-08-06):** Kompletní rotace klíčů — nové premine (14), canonical (5), admin (3), DAO guardian (7), EVM validator (5) + escrow. Všechny adresy aktualizovány v kódu i na Edge serveru. Všech 5 V31 služeb active (node, pool, multichain, dao, oasis). OASIS RPC opraven (raw TCP místo HTTP). Klíče uloženy v `~/Desktop/ZION_KEYS_NEW_GENESIS_2026-08-06/` (chmod 600). Kompletní procedura: [`HARD_RESET_PLAYBOOK.md`](./HARD_RESET_PLAYBOOK.md). Předchozí genesis: `4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e` (2026-07-20 reset).
> **V31 CUTOVER (2026-08-04):** **V31 JE NYNÍ PRODUKČNÍ!** Public RPC (rpc.zionterranova.com:8443) ukazuje na V31 node. V31 pool běží na produkčním portu 8444. V31 miner těží (~800k H/s, 100 shares accepted za 5 min). V3 pool disabled. **D.2 Cutover COMPLETE** (D2.1-D2.4), **D.3 Post-cutover** (D3.1-D3.4 PASS, D3.5 running), **D.4 V3 archivace COMPLETE** (D4.1-D4.4, D4.6), **D.5 GitHub release v3.1.0-beta PUBLISHED**. V31 multichain /health 200 OK. Pool share logging: `share accepted — job=zion_8, worker=..., nonce=0000fc3e`. Miner response handling: `share accepted by pool`. Stratum v1 param order: [worker, job_id, extranonce2, ntime, nonce]. **Phase B+C+S+D COMPLETE**. Tags: `pre-v31-cutover`, `v3.1.0-beta`. Viz [`V31_P2P_SYNC_REPORT_2026-08-03.md`](./docs/3.1/V31_P2P_SYNC_REPORT_2026-08-03.md).
> **Hard genesis reset (historical):** 2026-07-20 — viz [`docs/3.0.5/INCIDENT_REPORT_2026-07-20_BLOCK_RETENTION_AND_GENESIS_RESET.md`](./docs/3.0.5/INCIDENT_REPORT_2026-07-20_BLOCK_RETENTION_AND_GENESIS_RESET.md). Bloky 0–~10913 předchozího řetězce jsou trvale ztraceny; aktuální chain startuje od genesis s unlimited retention.
> **Update (2026-07-30):** **PRL (Pearl) označen jako `disabled_reason` ve `V3/L1/cosmic-harmony/src/profit_router.rs`.** `ExternalCoin::disabled_reason()` vrací důvod pro PRL, `CoinProfile` má `disabled_reason` a `enabled=false` pro PRL, `select_best_coin` ho automaticky vynechává. Řeší 3.0.8 Go/No-Go "každý aktivní coin má accepted share nebo `disabled_reason`". VTC/ZCL zůstávají aktivní (GPU E2E accepted v 3.0.7). **AutonomousProfitRouter unit testy v `V3/L1/miner/src/autonomous.rs`:** `select_stream2`/`select_stream3` vybírají nejvýnosnější coin s hysteresí, `build_coin_preference` vrací zprávu, PRL není nikdy autonomně vybrán. **3.0.9 public subtree audit + push:** `docs/3.0.6/PUBLIC_SUBTREE_AUDIT_2026-07-30.md` — 1432 sdílených souborů, 113 se liší. `git subtree push --prefix=public public main` proběhl úspěšně; public README a `hardhat.config.ts` aktualizovány. **Ruční secrets scan:** `docs/3.0.6/SECRETS_SCAN_2026-07-30.md` — v `V3/` žádné hardcoded privátní klíče, dummy fallback v `hardhat.config.ts` odstraněn.
>
> **Update (2026-08-01):** **ERG Autolykos v2 — LIVE POOL TEST SUCCESS.** Three critical fixes enabled ERG GPU mining on 8 GB GTX 1070 Ti at production height 1,842,080:
> 1. **N_BASE fix (2^26→2^21):** `AUTOLYKOS_N_BASE` was set to 2^26 (Autolykos v1 value) instead of 2^21 (Autolykos v2 post-fork value). At height 1,842,080, N=6.76M → R table = 220 MB (was 6.93 GB → OOM). This was the root cause of all VRAM OOM issues.
> 2. **Auto→CUDA external fix:** The `Auto` backend fallback only tried `CudaDeekshaMiner` (which doesn't handle external algorithms). Now tries `CudaExternalMiner` for autolykos/blake3/kheavyhash, matching the explicit `Cuda` branch.
> 3. **Stream1 VRAM fix:** `TriGpuManager::new` always allocated the primary GPU (~2 GB deeksha scratchpad) even when `ZION_STREAM1_ENABLED=0`. Now passes `Cpu` kind when stream1 is disabled, freeing all VRAM for the external GPU thread.
>
> **Live test results:** R table 220 MB, ~21 MH/s, shares found (hashes `0000…` meeting easy target), submitted to debug pool, pool forwards to 2miners. `BelowTarget` from 2miners is expected (easy target ≠ network target). Run with: `ZION_STREAM1_ENABLED=0 ZION_STREAM2_ENABLED=1 ZION_MINER_GPU_COIN=ERG ./zion-miner --pool 62.171.141.136:8461 --wallet zion1… --gpu-coin ERG`. Commit `3d4e707fa`.
>
> **Previous (2026-08-01):** **ERG Autolykos v2 R table (DAG) kernel — 25.35 MH/s (1.76x).** Tableless kernel (14.37 MH/s) přepsán na two-kernel approach: `autolykos_precompute` (R table N×32B) + `autolykos_mine` (`uint4` table lookups místo on-the-fly blake2b). Optimalizace v3: `__ldg()` read-only cache, shared mem header, 4 nonces/thread pro latency hiding, `__launch_bounds__(64, 4)` pro 256 regs/thread (eliminuje spilling), `blake2b_256_from_words` skip byte arrays, `& 31` wrapping místo extended[]. GPU hash matches CPU reference (height=0). VRAM pre-check přes `cuMemGetInfo_v2`. Commit `b7fc2a180` + optimalizace. Report: [`docs/3.0.7/ERG_AUTOLYKOS_LIVE_POOL_REPORT.md`](./docs/3.0.7/ERG_AUTOLYKOS_LIVE_POOL_REPORT.md).
>
> **Dnešní update (2026-07-28):** **Trinity All Green — CUDA kernel verification complete.** Tři kritické bugy opraveny a pushnuty na `main`:
> 1. **KawPow pool-side share verify fix** — `share_forwarder.rs` používal `ethash_final_hash` místo `kawpow_final_hash_real` pro KawPow share verification → valid shares odmítány. Fix deploynut na Edge server.
> 2. **ProgPow kernel output_hash fix** — `progpow_kernel.cu` nepíše 32-byte final hash do `output_hash` bufferu → GPU vrací `0000000000000000` → CPU/GPU mismatch. Opraveno přidáním `keccak_f800_full()` + `output_hash` parametru. **3 varianty CPU_GPU_MATCH:** progpow, evrprogpow, meowpow.
> 3. **GPU init decoupled from stream1** — GPU se inicializuje pokud stream1 NEBO stream2 je enabled. External-only GPU mining (stream1=0, stream2=1) nyní funguje.
>
> **10/10 CUDA kernelů CPU/GPU MATCH** na GTX 1070 Ti: kheavyhash (638 MH/s), blake3_alph (1.58 GH/s), blake3_dcr (1.23 GH/s), autolykos (1.26 GH/s), zelhash (1.54 GH/s), ethash (117 MH/s), kawpow (93.5 MH/s), progpow (11.1 MH/s), evrprogpow (11.1 MH/s), meowpow (11.1 MH/s).
>
> Edge úklid a stabilizace: vypnut `zion-rtm-debug-pool` a vyčištěny failed `zion-edge-debug-pool@ERG/ETC/RTM`; opraven `/etc/logrotate.d/rsyslog` (`su root syslog`) a `/etc/rsyslog.d/10-zion-edge.conf` + `49-zion-pool-ratelimit.conf` pro správné `programname` (`node`/`server`); syslog přestal růst GB/hod, pool logy přesměrovány do `/var/log/zion-pool.log`; sníženy log levely node/pool z `debug` na `info`. Služby `zion-edge-*` potvrzeny jako aktuální produkční názvy. Výška chainu ~7342. Disk 80G/145G (56 %). Docker runtime image `zion-web:runtime` je 2.68 GB (377 MB označuje standalone build artefakt).
>
> **Update (2026-07-28):** **`native-ghostrider` (RTM) nyní kompiluje a funguje na Windows/MSVC.** Pět MSVC kompilačních chyb opraveno v `V3/L1/native-ffi/`: (1) VLA v `gr.c` (`bool selectedAlgo[algoCount]` → `bool selectedAlgo[15]`), (2) VLA v `sph/fugue.c` (`ROR` makro `tmp[n]` → `tmp[15]`), (3) `#ifdef WIN32` → `#ifdef _WIN32` v `oaes_lib.c`, (4) unguarded `#include <unistd.h>` ve 8 `cryptonight*.c` souborech, (5) `alloca` → `_alloca` define v `build.rs`. `/utf-8` flag přidán pro MSVC. Live E2E: miner s `--cpu-coin RTM` → Edge pool → zpool.ca upstream → **2 shares ACCEPTED** (`result=true`) při ~125–430 H/s. Build: `cargo build --release -p zion-miner --features "gpu-opencl,native-randomx,native-ghostrider,native-verushash"`.
>
> **Předchozí update (2026-07-27):** Verze bumped na 3.0.7. DAO integration test fix (`choice.clone()`). Workspace version, protocol version, miner UI/pool version a web package.json synchronizovány. All Green matice: ZION Deeksha live, EPIC/RVN/DCR/ERG/VTC/ZCL/RTM/QTC/NEXA/BEAM/QUAI/VRSC E2E accepted, ETC CPU/GPU hash match ověřen, XMR RandomX hash OK, PRL deferred do 3.1.0. **CUDA kernel verification sweep:** 10/10 GPU-relevant `--test-cuda-kernel` algorithms compile + benchmark PASS on GTX 1070 Ti (kheavyhash, blake3_alph, blake3_dcr, autolykos, zelhash, ethash, kawpow, progpow, evrprogpow, meowpow); ETC `ETHASH_CPU_GPU_MATCH` ~117.6 MH/s. `verushash` is CPU-only for VRSC; CUDA init FAIL is not a 3.0.7 blocker. **Autonomous profit router:** RTM je nyní CPU-compatible, CUDA `gpu_kernel_available` rozšířeno o EVR/MEWC/FLUX/EPIC/ZANO/CLORE/QUAI, přidána `ZION_STREAM3_FORCE_COIN` — build + unit testy PASS. **3.0.9 / V3.1 prep:** Vytvořen [`LAUNCH_CHECKLIST.md`](docs/3.0.8/LAUNCH_CHECKLIST.md), tag `pre-purification-3.0.9` pushnut na origin, základní secrets scan neodhalil plaintext klíče. Detail: [`archive/V3/docs/AUXPOW_ALGORITHM_VERIFICATION_REPORT.md`](./archive/V3/docs/AUXPOW_ALGORITHM_VERIFICATION_REPORT.md) §8.
> **Plánovaná V3.1 migrace (po 3.0.9):** [`V3.1_MIGRATION_PLAN.md`](./docs/3.0.6/V3.1_MIGRATION_PLAN.md) — migrace čistého kódu do nového adresáře `V31/` (nová větev). WARP a ZionDex přesunuty do L2, AuxPoW přímo v mineru, L3 vyhrazeno pro AI/orchestraci/automatizaci/NCL/PoC. L4 Oasis, L5 Free World a L6 Issobella zůstávají jako samostatné nadstavbové vrstvy. Detailní nativní propojení integrací: [`V3.1_INTEGRATION_PLAN.md`](./docs/3.0.6/V3.1_INTEGRATION_PLAN.md).
> **Předchozí archiv:** [`docs/3.0.5/StatusV3_archive_2026-07-13.md`](./docs/3.0.5/StatusV3_archive_2026-07-13.md) (5239 řádků, historické incident reporty)

---

## 1. Blockchain State

| Metric | Value |
|--------|-------|
| **Height** | 1000+ (2026-08-09, V31 P2P mesh on Edge + local backup) |
| **Native height** | 1000+ |
| **Accepted blocks** | 1000+ |
| **Protocol** | `zion-v3-node/3.1.0-alpha` (V31; workspace version `3.1.0-beta`) |
| **Genesis (V3 compat)** | `4cf7560f9140deb9376fa6567e76eacaa8bd1b733ca3c91b00830a08f332ef71` |
| **Genesis (V31 native)** | `96109423298542a836edc10b9ba5ff9b29a1970418db543c2ee5cd952fe35bdb` |
| **Decimals** | 6 (1 ZION = 1,000,000 flowers) |
| **Total Supply** | 144B ZION (144e15 flowers) |
| **Circulating** | ~16.78B ZION premine (přesné rozdělení viz `V31/L1/core/src/genesis.rs`) |
| **Block Reward** | 5400.067 ZION |
| **Fee Split** | 89% miner / 5% humanitarian / 5% issobella (science/space) / 1% burn (pool-fee slot, never minted) |
| **Difficulty** | LWMA-60 (integer, ±25% clamp, 30–120s solve) |
| **Consensus Algo** | `ekam_deeksha` (Ekam Deeksha v3.2) pro všechny výšky — 512 KiB scratchpad, 2 AES passes, 128 random reads, Keccak256 final |
| **Pool Advertised Algo** | `ekam_deeksha` |
| **Full/Ekam Algo** | `ekam_deeksha` — aktivní v produkci |
| **CHv4.2 Merkabah Dual-Spin** | Implemented; fork height `u64::MAX` — dormant, pending governance vote |

---

## 2. Network Topology

### Edge Server (Primary): `62.171.141.136`

**Hardware:** Contabo VPS (`vmi3425821.contaboserver.net`), 4× AMD EPYC, 7.8 GB RAM, 145 GB disk, Ubuntu 24.04.4 LTS

**IPv6 (fallback when IPv4 SSH refused):** `2a02:c207:2342:5821::1` (AAAA record of `vmi3425821.contaboserver.net`)

**SSH:** port `22` (default) + port `2222` (alias), IPv4 + IPv6 — `ssh zion-new` (key `~/.ssh/zion-edge-post-wipe-2026-07-29`, ed25519). **Incident 2026-07-19 (SSH + fail2ban):** Po rebootu sshd naslouchalo jen na `[::]:2222` (IPv6-only) kvůli `ssh.socket.d/override.conf` s `ListenStream=2222` bez IP specifikace → IPv4 SSH `Connection refused`. Opraveno: override.conf upraven na `0.0.0.0:2222` + `[::]:2222`, přidán `port22.conf` drop-in pro alias na default port 22. Root heslo resetnuto přes Contabo panel (uložit do 1Password). **fail2ban `zion-p2p` jail** (maxretry=50/10min, bantime=24h) banoval IPv4 `109.81.31.210` (Mac) při spuštění lokálního backup node — backup node dělal rychlé P2P connect/disconnect cykly na porty 8333/8334, fail2ban to vyhodnotil jako port scan. Opraveno: `ignoreip` v `/etc/fail2ban/jail.d/zion-p2p.conf` rozšířeno o `109.81.31.210` (Mac) + `109.81.27.87` (backup node) — **perzistentní, přežije reboot** (fail2ban enabled at boot). UFW pravidla `22/tcp` + `2222/tcp` ALLOW přidána do `/etc/ufw/user.rules` + `user6.rules` (perzistentní). VNC fallback: `95.111.232.25:63061` (RFB, password `h4neV76S`).

**fail2ban ignoreip whitelist (perzistentní v `/etc/fail2ban/jail.d/zion-p2p.conf`):** `127.0.0.1/8 ::1 109.81.31.210 109.81.27.87 109.81.20.92 109.81.89.176 109.81.83.205 109.81.28.144` — Mac, backup node, a další lokální IP jsou vyřazeny z P2P jail banování. Pokud se změní veřejná IP Macu nebo backup node, je třeba aktualizovat tento soubor a `systemctl reload fail2ban`. **07-21 incident:** `109.81.28.144` (lokální miner server) byl banován fail2ban zion-p2p jilem → všechny IPv4 připojení k Edge přerušeny (SSH, stratum pool 8444, debug pool 8460). VRSC shares se nedostaly k LuckPool → "low difficulty share" error 23. Opraveno: unban + přidáno do ignoreip. UFW pravidlo pro 8460/tcp přidáno (RTM debug pool).

| Service | Port(s) | Bind | Layer | Status |
|---------|---------|------|-------|--------|
| zion-v31-node | 8335 (P2P), 9445 (RPC) | P2P 0.0.0.0, RPC 127.0.0.1 | L1 (V31 PRODUCTION) | ✅ active (height 1000+, public RPC 8443 → 9445) |
| zion-v31-pool | 8444 (Stratum), 8080 (HTTP API) | 0.0.0.0 | L1 (V31 PRODUCTION) | ✅ active (shares accepted, payout sweep active) |
| zion-v31-miner | — | — | L1 (V31 PRODUCTION) | ✅ active (triple-stream) |
| zion-v31-multichain | 8453 (WARP API), 8454 (DEX API via `warpd`) | 0.0.0.0 | L3 (V31 PRODUCTION) | ✅ active |
| zion-v31-dao | 8456 (API) | 127.0.0.1 | L2 (V31 PRODUCTION) | ✅ active |
| zion-v31-oasis | 8094 (API), 9102 (metrics) | 127.0.0.1 | L4 (V31 PRODUCTION) | ✅ active |
| zion-edge-python-dashboard | 8766 | 0.0.0.0 | — | ✅ active (Python zero-dep dashboard) |
| zion-website | 3000 | 127.0.0.1 | — | ✅ active (Next.js, app.zionterranova.com) |
| zion-oasis-web | 3002 | 127.0.0.1 | — | ✅ active (Next.js standalone; public site served from /var/www/oasis static via nginx) |
| zion-marketplace | 3100 | 127.0.0.1 | — | ✅ active (Next.js, market.zionterranova.com) |
| fail2ban.service | — | — | — | ✅ active |
| zion-watchdog.timer | — | — | — | ✅ active (2 min) |
| nginx | 80, 443 | 0.0.0.0 | — | ✅ active |
| zion-agent.service | — | — | — | 🔄 activating (auto-restart) |
| zion-free-world | — | — | L5 | ⛔ inactive (disabled) |
| zion-issobella | — | — | L6 | ⛔ inactive (disabled) |
| zion-node (V3 legacy) | — | — | L1 | ⛔ failed (expected after V31 cutover) |
| zion-pool (V3 legacy) | — | — | L1 | ⛔ failed (expected after V31 cutover) |
| zion-dashboard-web (legacy Flask) | — | — | — | ⛔ failed (superseded by zion-edge-python-dashboard) |
| logrotate.service | — | — | — | ⛔ failed (system-level, does not block ZION) |
| zion-edge-* (V3/edge legacy) | various | — | — | ⛔ disabled / masked (replaced by zion-v31-*) |

### Local Backup Node: `zionserver-144` (109.81.27.87)

> **✅ ONLINE (2026-07-23):** `zion-backup-node` is running and synced with Edge. Active state DB is `V3/data/zion-node-state.db` (JSON), not the stale `~/.zion/node-state.db` (height 0, unused).

| Service | Port(s) | Status |
|---------|---------|--------|
| zion-backup-node | 8446 (RPC), 8333 (P2P) | ✅ synced |
| zion-dashboard | 8766 | ✅ active (local `ZION_OS/dashboard/app.py`) |
| zion-stack | L2/L3 services | — (runs on Edge) |
| zion-ssh-tunnel | 9 local + 2 reverse SSH forwards to Edge | ✅ active |

> **Backup node seed peers:** `ZION_SEED_PEERS='62.171.141.136:8333,62.171.141.136:8334'` (`scripts/start-backup-node.sh:25`). `known_peers` on Edge primary is healthy again.

### Public Endpoints

| Endpoint | URL | Notes |
|----------|-----|-------|
| Intro | `https://zionterranova.com` | OASIS intro landing page — `maintenance.html` from `/var/www/maintenance/` (system nginx) |
| Web2.9 | `https://app.zionterranova.com` | Full Next.js 16.2.9 website — `zion-website.service` on `127.0.0.1:3000`, nginx proxy |
| OASIS Web | `https://oasis.zionterranova.com` | Static OASIS web build in `/var/www/oasis/` (system nginx) |
| Dashboard | `https://dashboard.zionterranova.com` | Basic Auth — V31 Alpha node card integrated (4th node card, systemd status, live sync, restart/stop buttons) |
| RPC | `http://rpc.zionterranova.com:8443` | nginx HTTP proxy → `127.0.0.1:8447` read-only Python filter → `127.0.0.1:8443` node RPC (**plain HTTP**, no TLS) |
| Legacy newearth archive | `https://www.newearth.cz` | Root redirects to `https://zionterranova.com/`; `/V2/` served from `/var/www/newearth/` (2026-08-03) |
| Pool | `62.171.141.136:8444` | Stratum |

### Resource Usage

| Resource | Used | Total | % |
|----------|------|-------|---|
| RAM | ~3.5 GB | 7.8 GB | 45% |
| Disk | 43 GB | 145 GB | 30% |
| Node1 RSS | ~142 MB | — | stable (post memory-leak fix) |
| Node2 RSS | ~3.5 MB | — | stable |

---

## 3. Test Status

| Crate | Tests | Status |
|-------|-------|--------|
| zion-core | 501 | ✅ |
| zion-cosmic-harmony | 201 + 1 | ✅ |
| zion-pool | 38 | ✅ |
| zion-bridge | 193 | ✅ |
| zion-dao | 74 | ✅ |
| zion-atomic-swap | 18 | ✅ |
| zion-warp | 499 | ✅ |
| zion-ncl | 42 | ✅ |
| zion-ai-native | 337 (+2 ignored) + 8 doc = 345 ✅ (v2.4 Maestro MVP: 6 komponent, 55 tools, 32 sub-agents, 14 intents, 26 health services) | ✅ |
| zion-cli | 21 | ✅ |
| zion-miner | 59 | ✅ |
| zion-native-ffi | 13/28 | ✅ |
| zion-oasis | 124 | ✅ |
| AuXpow | 111+ (GPU: 16, ProgPow: 6) | ✅ |
| ZionDex Router | 28 | ✅ |
| ZionDex Contracts | 7 (Solidity) | ✅ |
| **Total** | **~2,066+** | **0 failures** |

---

## 4. DeFi Contracts (Base Mainnet, Chain 8453)

| Contract | Address | Status |
|----------|---------|--------|
| wZION (ERC-20) | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | ✅ Verified |
| ZIONBridge (5/5 multisig) | `0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467` | ✅ Verified |
| BridgeValidator | `0x9C138dC6ebA8A883AB3802F6Dcb79C772a835627` | ✅ Verified |
| ZIONGovernance | `0xB77eB4ab9468Ce03FBd7eCec70e976EFCfa623E8` | ✅ Verified |
| ZIONTreasury (3/3 multisig) | `0x455f465ac7e14fdA97dC46fdd74bCa78bfC0aEeD` | ✅ Verified |
| ZIONStaking (12% APR) | `0xbd5cEe7878337d22188BFBaF9aa9F39A850Be78B` | ✅ Verified |
| ZIONFarm (1 wZION/s) | `0x167B2753F5D8D9F8e62875cc9e379d7804308B08` | ✅ Verified |
| ZIONAtomicSwap | `0x3DE9Ad42716854083ab837706E3961d10B0e63Eb` (escrow funded 100K ZION) | ✅ Verified |

### Uniswap V3 Pools (Base)
| Pair | Fee | Pool Address |
|------|-----|--------------|
| wZION/USDC | 0.3% | `0x5eBdC6E1D516f42EEB54f14faCF8715AbD5B9d8d` |
| wZION/WETH | 1.0% | `0x18c0DaeF295E63F1bfBC7C39e71d0fabf4600699` (ACTIVE) |

### Multi-Chain wZION
Deployed on: Base, Arbitrum, Optimism, BSC, Polygon, Avalanche (6 chains live)

### Non-EVM Deployments
| Chain | Type | Address/ID | Status |
|-------|------|------------|--------|
| Solana | SPL Token | `HgfQZpH2JAqPdR3PcP4dEE8WRhznXh1QhJBiiwcHfT8H` | ✅ Deployed |
| Stellar | Native Asset | `ZION:GDDXUOJ7ERSHHDMUKS6PBIDSXV2PB5J7GOFOKMHW6BRVAS46CFSPAYJT` | ✅ Deployed |
| Tron | TRC-20 | — | ⏳ Pending |
| Cardano | Plutus | — | ⏳ Pending |
| Cosmos | CW20 | — | ⏳ Pending |
| Aptos | Move Coin | — | ⏳ Pending |
| Sui | Move Coin | — | ⏳ Pending |
| NEAR | NEP-141 | — | ⏳ Pending |
| TON | TEP-74 | — | ⏳ Pending |

**Status:** 2/9 non-EVM chains deployed. 6 EVM chains + 2 non-EVM = 8 chains total live.

### L1 Bridge Vault
- Address: `zion1j3w3h7k8m635h734y786j5804305m822t5uk546` (premine slot 14, mnemonic wallet)
- Balance: ~100M ZION

---

## 5. AuxPow + Stream Profit System

### Architecture
All revenue streams live INSIDE the Deeksha Chv3 hash pipeline. GPU always runs Deeksha Chv3; pipeline steps are parametrized by stream weights (profit-based). Pool sends weights to miners in job messages.

### Deeksha Chv3 Pipeline (6 steps, 100 work units)
| Step | Algorithm | Work Units | Revenue Source |
|------|-----------|------------|----------------|
| 1 | Keccak256 | 5u | KeccakBonus |
| 2 | SHA3-512 | 5u | Sha3Bonus |
| 3 | GoldenMatrix | 10u | Zion |
| 4 | MemoryHard | 55u | Zion |
| 5 | NpuMix | 15u | NclAi |
| 6 | CosmicFusion | 10u | Zion |

### Implementation Status

| Phase | Description | Status | Commit |
|-------|-------------|--------|--------|
| R1 | Stream profit system — weighted pipeline | ✅ DONE | `50df9b414` |
| R1b | Live API fetching (WhatToMine/CoinGecko) | ✅ DONE | `e1c28689b` |
| R1c | GPU kernel parametrizace (byproduct work) | ✅ DONE | `74a353205` |
| R2 | DCR revenue live (WoolyPooly) | ⏳ Pending | — |
| R3 | ALPH + KAS E2E (2miners) | ⏳ Pending | — |
| R4 | Stream telemetry revenue report | ✅ DONE | `d189712a7` |
| R5 | SMOS deploy + GPU mining | ✅ DONE | `32e9d07ac` |
| R6 | EthStratum protocol (ERG/EVR/MEWC/CLORE) | ✅ DONE | `5baa76d60` |
| R7 | B2b VRSC revenue (ZcashStratum, LuckPool) | ✅ DONE | `bb7d5407b` |
| R8 | True AuxPow consensus | 🔮 Future | — |

### Supported External Coins (24 total)

| Coin | Algorithm | Protocol | E2E Status |
|------|-----------|----------|------------|
| KAS | kheavyhash | Stratum | connect/auth/notify ✅, CUDA kernel **CPU/GPU MATCH** (638 MH/s), submit ⚠️ (pool difficulty too high for GTX 1070 Ti at 14.5 MH/s) |
| ALPH | blake3 (double) | Stratum | connect/auth/notify ✅, CUDA kernel **CPU/GPU MATCH** (1.58 GH/s), submit ⚠️ (CPU) |
| DCR | blake3 | Stratum | ✅ LIVE (embedded in pool stream, blake3 GPU kernel **CPU/GPU MATCH** 1.23 GH/s) |
| ERG | autolykos | Stratum | ✅ E2E (Autolykos v2 GPU thread, 2miners pool, `autolykos_kernel.cl` with memory-hard table, `ZION_POOL_AUXPOW_WALLET_ERG` env var) |
| RVN | kawpow | Stratum | CUDA kernel **CPU/GPU MATCH** (93.5 MH/s epoch 0); pool-side share verify fixed (`kawpow_final_hash_real`); E2E needs >8GB VRAM GPU (epoch 596 DAG = 5.66 GB) |
| ETC | ethash | Stratum | CUDA kernel **CPU/GPU MATCH** (117 MH/s); connect/auth/notify ✅, submit ⚠️ (CPU) |
| EVR | evrprogpow | EthStratum | CUDA kernel **CPU/GPU MATCH** (11.1 MH/s); protocol ✅ (R6), live E2E TODO |
| MEWC | meowpow | EthStratum | CUDA kernel **CPU/GPU MATCH** (11.1 MH/s); protocol ✅ (R6), live E2E TODO |
| CLORE | kawpow | EthStratum | CUDA kernel **CPU/GPU MATCH** (93.5 MH/s); protocol ✅ (R6), live E2E TODO |
| XMR | randomx | Stratum | ✅ Native RandomX (tevador/RandomX, JIT + HW AES + AVX2 + huge pages, per-thread VM). Pool E2E: MoneroOcean reachable, login+authorize+job OK. **RandomX hash verify OK** — shares pass pool-side target check with native-randomx (previously used blake3 fallback → "Low difficulty share"). **Stale job_id fix (2026-07-28):** Pool-side latest-job-only check (`ZION_XMR_LATEST_ONLY=1`, default on) — shares for superseded job_ids are silently skipped instead of forwarded to MoneroOcean (which rejects "Invalid job id"). Stale threshold reduced from 120s to 30s (`ZION_XMR_STALE_SECS=30`). Also: `parse_randomx_target_hex` now accepts 4-byte (32-bit) targets (MoneroOcean format). See [`docs/3.0.5/RANDOMX_PERF_OPTIMIZATION_2026-07-16.md`](./docs/3.0.5/RANDOMX_PERF_OPTIMIZATION_2026-07-16.md) |
| FLUX | zelhash | Stratum | CUDA kernel benchmark PASS (1.54 GH/s, no CPU ref); FLUX deprecated |
| VRSC | verushash v2.2 | ZcashStratum | ✅ LIVE + OPTIMIZED (LuckPool EU, CPU-only, two-stage mining hash + AVX2, 0.746 MH/s vs hellminer 0.669 MH/s, shares accepted). See [`docs/3.0.5/VRSC_SHARE_ACCEPTANCE_FIX_2026-07-16.md`](./docs/3.0.5/VRSC_SHARE_ACCEPTANCE_FIX_2026-07-16.md) and [`docs/3.0.5/VRSC_PERF_OPTIMIZATION_2026-07-16.md`](./docs/3.0.5/VRSC_PERF_OPTIMIZATION_2026-07-16.md) |
| EPIC | progpow | Stratum (custom HTTP) | ✅ LIVE (GPU ProgPow kernel **CPU/GPU MATCH** 11.1 MH/s, epoch 120 DAG, triple parallel with ZION+VRSC) |
| QUAI | kawpow | Stratum | ✅ Added (KawPoW GPU thread, 2miners pool, BTC payout, `ZION_POOL_AUXPOW_WALLET_QUAI` env var) |
| BEAM | beamhash III (Equihash 144,5 + SipHash-2-4) | BeamStratum (TLS) | ✅ Implemented + verifier fix (CPU/GPU `hash_beamhash` now matches upstream `beamHashIII_impl.cpp` 512-bit `apply_mix`; `auxpow_client.rs` handles `job`/`cancel` BeamStratum notifications; 11/11 `beamhash` unit tests pass; `zion-miner` with `gpu-opencl` builds; live GPU test pending) |
| PRL | pearlhash (PoUW MatMul) | PearlStratum (custom) | ★★★ PearlStratum ✅ + CPU hasher ✅ + GPU GEMM dispatch ✅ (`0bafbfe83`) + Merkle proof ✅ (`705bff572`) + pool-routed ✅ (`f524b7117`), full PoUW ZK TODO |
| **KLS** | KarlsenHashV2 (FishHashPlus+Blake3) | Stratum | ✅ OpenCL kernel `karlsenhash_kernel.cl` (604 lines) + DAG + GPU dispatch wired (`f6df75b64`) + E2E PASS (subscribe+auth OK, karlsencoin.cedric-crispin.com:4154, needs native Karlsen wallet for shares) |
| **ZCL** | EquihashZero 192,7 | ZcashStratum | ✅ OpenCL kernel `equihash_kernel.cl` (851 lines, adapted from silentarmy) + host-side multi-kernel Wagner dispatch (Blake2b state, 10-kernel sequence, double-SHA256 verification) (`f6df75b64`, host-side integration) + E2E PASS (zpool, BTC payout) |
| **QTC** | Qhash (quantum circuit sim) | Stratum | ✅ OpenCL kernel `qhash_kernel.cl` (370 lines, 16-qubit quantum circuit sim with RY/RZ/CNOT gates, 65536 complex amplitudes, 512KB state vector per work-item) + GPU dispatch wired (`0e5ef6c40`) + E2E PASS (suprnova) |
| **VTC** | Verthash (I/O-bound, 1.2GB dat) | Stratum | ✅ OpenCL kernel `verthash_kernel.cl` (289 lines) + SHA3 kernels + host-side 3-kernel dispatch (precompute→sha3_256→verthash_4w) + verthash.dat loader + MDIV computation (`646d14f59`, `e8e237448`) + E2E PASS (zpool, BTC payout) |
| **IRON** | FishHash (Blake3 DAG) | IronFishStratum v2 | ✅ OpenCL kernel `fishhash_kernel.cl` (580 lines) + DAG + GPU dispatch wired (`f6df75b64`) + IronFish stratum v2 protocol (body-based JSON-RPC, subscribe=auth, mining.notify/set_target/submit) (`c277a672a`). Pool: fr.grandpool.io:2027. E2E: subscribe OK, needs 64-char IronFish wallet. |
| **NEXA** | NexaPow (secp256k1 Schnorr) | Stratum | ✅ OpenCL kernel `nexapow_kernel.cl` (6164 lines, UltrafastSecp256k1 MIT) + GPU dispatch wired (`77613ad50`) + E2E PASS (nexa.2miners.com:5050) |
| **RTM** | GhostRider (15 algos + 6 CN) | Stratum | ✅ OpenCL kernel `ghostrider_kernel.cl` (580 lines, 15 x16r hash algos + 6 CryptoNight variants, 18-step hash chain, 1MB scratchpad per work-item) + GPU dispatch wired (`0e5ef6c40`) + E2E PASS (zpool) + **CPU E2E share verify PASS** (zpool.ca, accepted) — 7 bugs fixed (07-21): (1) `getAlgoString` reverted to yiimp REVERSED byte order (`b=(63-j)>>1`, high nibble first) matching Raptoreum daemon `GetNibble` — forward byte order was wrong (zpool runs yiimp, not cpuminer-gr-avx2); (2) hash output reversal removed in `ghostrider_wrapper.c`; (3) `meets_target_little_endian` reverse ONLY hash; (4) `native-ghostrider` feature in pool Cargo.toml; (5) per-coin target lookup via `latest_job_for_coin()`; (6) error 25 sanity check (`hash[30]|hash[31]==0`); (7) batch size + nonce_base preservation. Live: nonce=2660, hash=`2640c0ba...edb20000`, ACCEPTED. Separate RTM debug pool on Edge port 8460. Commits `58ea1eee5`, `0942c28fb`. Report: [`RTM_DEBUG_REPORT.md`](./docs/3.0.6/RTM_DEBUG_REPORT.md) |
| **DNX** | DynexSolve (neuromorphic PoUW) | CryptonoteStratum | ✅ OpenCL kernel `dynexsolve_kernel.cl` (430 lines, neuromorphic SAT solver via RK4 ODE integration, 3-SAT clause energy gradient descent, ~30KB per work-item) + GPU dispatch wired (`0e5ef6c40`) + Cryptonote stratum protocol (JSON-RPC login/submit/keepalived) (`c277a672a`). Pool: pool.deepminerz.com:3333. E2E: login OK, needs native DNX wallet. |

### AuXpow GPU Backend (2026-07-15)

**Crate:** `zion-auxpow` — cross-platform GPU mining (OpenCL + Metal + CUDA)

| Algorithm | Coin | OpenCL (H/s) | Metal (H/s) | CUDA |
|-----------|------|-------------|-------------|------|
| blake3 | ALPH | 640M | **18.1B** | ✅ **CPU/GPU MATCH** ~1.58 GH/s (work_size=262144) |
| blake3_dcr | DCR | 650M | **23.3B** | ✅ **CPU/GPU MATCH** ~1.23 GH/s (work_size=262144) |
| kheavyhash | KAS | 320M | **21.1B** | ✅ **CPU/GPU MATCH** ~638 MH/s (work_size=262144); known-answer vector matches CPU |
| autolykos | ERG | 82M | **18.4B** | ✅ **CPU/GPU MATCH** ~22 MH/s (R table kernel, height=0 N=2M); **LIVE POOL TEST** at height 1,842,080: N=6.76M, R table=220 MB, ~21 MH/s, shares found+submitted; N_BASE fix 2^26→2^21; `b7fc2a180`, `3d4e707fa` |
| ethash | ETC | — | — (needs DAG) | ✅ **CPU/GPU MATCH** ~117 MH/s; canonical `ethash` 0.4 crate reference |
| kawpow | RVN/CLORE/QUAI | — | — (needs DAG) | ✅ **CPU/GPU MATCH** ~93.5 MH/s (epoch 0); pool-side verify fixed (`kawpow_final_hash_real`); E2E needs >8GB VRAM GPU (epoch 596 DAG = 5.66 GB) |
| zelhash | FLUX | 495M | **19.5B** | ✅ benchmark PASS ~1.54 GH/s (work_size=262144); no CPU reference (FLUX deprecated) |
| progpow | EPIC/ZANO/EVR/MEWC | DAG ✅ (OpenMP) | — (needs DAG) | ✅ **CPU/GPU MATCH** ~11.1 MH/s (all 3 variants: progpow, evrprogpow, meowpow); output_hash fix 2026-07-28 |
| pearlhash | PRL | Placeholder | Placeholder | ❌ TODO (full PoUW) ★★★ |
| beamhash | BEAM | SipHash-2-4 ✅ | Equihash 144,5 ✅ | ✅ Implemented (`beamhash.rs` + `beamhash_kernel.cl`) |
| fishhash | IRON | Kernel ✅ (580 lines) | Stratum ✅ | 5-param submit ✅ — DAG-based, `fishhash_kernel.cl` |
| karlsenhash | KLS | Kernel ✅ (604 lines) | Stratum ✅ | 5-param submit ✅ — FishHashPlus+Blake3, `karlsenhash_kernel.cl` |
| nexapow | NEXA | Kernel ✅ (6164 lines) | Stratum ✅ | 5-param submit ✅ — secp256k1 Schnorr, `nexapow_kernel.cl` |
| verthash | VTC | Kernel ✅ (289 lines) | Stratum ✅ | 5-param submit ✅ — 1.2GB data file, `verthash_kernel.cl` |
| equihash192_7 | ZCL | Kernel ✅ (851 lines) | Host ✅ | ✅ Implemented — multi-kernel Wagner dispatch + Blake2b state + double-SHA256 verify + 28-byte extranonce2 + fd9001 varint submit format. OVERHEAD=2 (4GB VRAM, fits 8GB GPUs) |
| ghostrider | RTM | Kernel ✅ | Stratum ✅ | ✅ 5-param submit — 15 algos + 6 CN variants, zpool verified |
| qhash | QTC | Kernel ✅ | Stratum ✅ | ✅ 5-param submit — quantum circuit sim, suprnova verified |
| dynexsolve | DNX | Kernel ✅ | Stratum ✅ | ✅ 5-param submit — neuromorphic PoUW |

**Features:** `gpu-opencl`, `gpu-metal`, `gpu-cuda`, `gpu-all`
**Benchmark:** `cargo run --example gpu_benchmark -p zion-auxpow --features gpu-metal`
**Auto-detect:** CUDA > Metal > OpenCL (via `GpuBackend::detect_backend()`)
**ProgPow (EPIC):** CPU hasher (keccak_f800 + KISS99 + FNV1a) ✅, OpenCL + Metal kernel ✅, 6 unit testů ✅, DAG generation ✅ (**on GPU** via `ethash_calculate_dag_item_mod` OpenCL kernel — light cache on CPU ~16-100 MB, full DAG computed in parallel on GPU, seconds not minutes), GPU mining ✅ (RX 5600, 15000+ batches, 0 errors), `ensure_progpow_dag()` with separate disk cache (`progpow_epoch{N}.bin`)
**Pearl (PRL):** ★★★ HIGHEST PRIORITY — PoUW MatMul + BLAKE3, 22x profitabilnější než KAS.
**Status:** PearlStratum protocol ✅ (custom dialect: object params, no subscribe, plain_proof),
CPU hasher ✅ (BLAKE3), GPU GEMM dispatch ✅ (`0bafbfe83`, 50x speedup), Merkle proof reconstruction ✅ (`705bff572`),
pool-routed mode ✅ (`f524b7117`, SMOS v3.0.35-pearl-pool-routed), cosmic-harmony + server.rs integration ✅.
8/8 Pearl tests pass. Pearl proof format fixed to match official alpha-miner (`a8aa4d1d3`).
**E2E verified against suprnova** (prl.suprnova.cc:3373) — authorize ✅, notify ✅ (job 52f06ed4_2000000,
height 86340, 76-byte header), job parsing ✅. **Remaining:** full PoUW ZK kernels
(Plonky2 ZK proofs), share submission E2E, merge mining PRL+MDL.

### Stream Profit Env Vars
```bash
ZION_STREAM_PROFIT_SWITCH=true              # enable profit-based weights
ZION_STREAM_PROFIT_API_PROVIDER=whattomine  # whattomine|coingecko|fallback
ZION_STREAM_PROFIT_INTERVAL=120             # refresh interval (seconds)
ZION_STREAM_HYSTERESIS_PCT=15.0             # min improvement % for switch
ZION_STREAM_PROFIT_SOURCES=zion,keccak_bonus,sha3_bonus,ncl_ai,deeksha_lite,thermal_bonus
```

### AuxPow Env Vars
```bash
ZION_AUXPOW_ENABLED=1                       # enable AuxPow scheduler
ZION_AUXPOW_WALLET=<wallet>                 # mining wallet
ZION_AUXPOW_ALLOCATION=0.1                  # % hashrate allocation
ZION_AUXPOW_POOL_PREFERENCE=2miners         # preferred pool
ZION_AUXPOW_HYSTERESIS=0.15                 # profit-switch threshold
ZION_AUXPOW_CIRCUIT_BREAKER_THRESHOLD=5     # failures before cooldown
ZION_AUXPOW_CIRCUIT_BREAKER_COOLDOWN=300    # cooldown seconds
# VRSC B2b revenue (LuckPool, VerusHash v2.2, CPU-only)
ZION_VRSC_WALLET=<verus_wallet>             # VRSC payout wallet (required for VRSC)
ZION_VRSC_POOL_URL=eu.luckpool.net:3956     # LuckPool EU endpoint (default)
# Triple Parallel CPU bridge (Claymore-style: ZION GPU + EPIC GPU + VRSC CPU)
ZION_POOL_AUXPOW_CPU_COIN="VRSC"            # CPU-stream coin (default: VRSC)
ZION_POOL_AUXPOW_CPU_WALLET=<verus_wallet>  # CPU bridge payout wallet
ZION_POOL_AUXPOW_CPU_WORKER_NAME="zion_triple" # CPU bridge worker name
ZION_POOL_AUXPOW_CPU_REGION="eu"            # CPU bridge pool region
# QUAI (KawPoW, 2miners, BTC payout)
ZION_POOL_AUXPOW_WALLET_QUAI=<quai_wallet>  # QUAI payout wallet
ZION_POOL_AUXPOW_PASSWORD_QUAI=<password>   # QUAI pool password (optional)
# BEAM (BeamHash III, 2miners TLS, BTC payout)
ZION_POOL_AUXPOW_WALLET_BEAM=<beam_wallet>  # BEAM payout wallet
```

---

## 6. Key Configuration

### Node
```bash
ZION_BLOCK_RETENTION=0          # keep full chain history since 2026-07-20 hard genesis reset
ZION_MIGRATION_HEIGHT=1         # fresh chain post-3.0.4
ZION_BALANCE_CHECK_HEIGHT=0     # F5 balance check active from genesis
ZION_RPC_DEBUG=0                # verbose RPC logging (default off)
```

### Pool
```bash
ZION_POOL_BIND=0.0.0.0:8444
ZION_PPLNS_WINDOW_SIZE=500000   # for 10k miners
ZION_VARDIFF_TARGET_SECS=15
ZION_NONCE_COUNT=4096
ZION_MAX_SESSIONS_PER_IP=100
ZION_POOL_NO_SOLUTION_RECONNECT_COOLDOWN_SECS=300  # ban IP on NoSolution rate-limit
```

> **PPLNS composite keys (2026-07-14):** PPLNS and telemetry registry now key on `miner_id/worker_name` instead of `miner_id` alone. Previously, all workers sharing the same `miner_id` (e.g. `local-miner`) had their payout address overwritten by whichever worker connected last — all payouts went to one worker. Each worker now gets its own PPLNS entry, telemetry entry, and payout address. Verified on-chain: 5070Ti, barker, and vega-smos receive payouts to their respective addresses.

### WARP (Non-EVM)

> **Update (2026-08-06):** Testnet smoke-test Solana/Stellar/Bitcoin. `warpd` polluje všechny tři devnet/testnet. Stellar `execute_mint` PASS — 0.001 ZION odesláno na testnet (`tx 2cbe550f...8d34e`). Solana a Bitcoin jsou bez funds (devnet faucet `429`, BTC testnet 0 UTXO), takže live `execute_mint` zatím neproběhl. Detail v [`docs/3.0.5/CONTRACT_ADDRESSES.md`](./docs/3.0.5/CONTRACT_ADDRESSES.md) §9 a [`V31/L2/multichain/contracts/non-evm/DEPLOY.md`](./V31/L2/multichain/contracts/non-evm/DEPLOY.md).

```bash
WARP_SOL_ZION_MINT=HgfQZpH2JAqPdR3PcP4dEE8WRhznXh1QhJBiiwcHfT8H
WARP_SOL_RPC=https://api.mainnet-beta.solana.com
WARP_STELLAR_ZION_ISSUER=GDDXUOJ7ERSHHDMUKS6PBIDSXV2PB5J7GOFOKMHW6BRVAS46CFSPAYJT
WARP_STELLAR_ZION_CODE=ZION
WARP_STELLAR_RPC=https://horizon.stellar.org
```

---

## 7. Security Hardening

| Measure | Status |
|---------|--------|
| UFW Firewall (SSH/HTTP/HTTPS/P2P/Pool) | ✅ Active |
| SSH keys-only (ed25519) | ✅ Active |
| fail2ban | ✅ Active (8028+ blocked, 101 bans) |
| AppArmor (zion-node) | ✅ Complain mode |
| Private keys scrubbed (5 files) | ✅ Done |
| File permissions (600/700) | ✅ Done |
| RPC audit log | ✅ Gated behind ZION_RPC_DEBUG |
| Memory limits (cgroup 2GB/3GB) | ✅ Active |
| Swap file (4GB) | ✅ In fstab |
| Journald limited (200M) | ✅ Active |
| systemd User=zion | ⚠️ 10/12 services done (dashboard + dex still User=root) |
| External audit | ⏳ Before public launch |

---

## 8. Recent Milestones (2026-07)

| Date | Milestone | Key Commits |
|------|-----------|-------------|
| 08-07 | **V31 ProgPoW OpenCL kernel port + VRSC target fix** — Ported the full ProgPoW/Ethash/KawPow OpenCL kernel from V3/AuXpow to V31 as `auxpow/gpu_opencl_full.rs` (~7500 lines). `OpenClExternalMiner` in `gpu/mod.rs` now wraps `ExtGpuMiner` for ProgPoW/Ethash/KawPow with DAG management, epoch tracking, and period-based kernel recompilation. Key fixes: (1) **GWS cap** — ProgPoW kernel was hanging at GWS=2M (amdgpu TTD 30s timeout); capped to 262K (env `ZION_AUXPOW_PROGPOW_MAX_GWS`), eliminating hangs. (2) **DAG caching** — `generate_progpow_dag_on_gpu` / `generate_ethash_dag_on_gpu` skip regeneration if DAG for current epoch already exists. (3) **stream2_batch** increased from 100K to 1M for ProgPoW throughput. (4) **VRSC target parsing** — `nbits` from ZcashStratum may arrive as JSON number instead of hex string; added `as_u64()`/`as_i64()` fallback + debug log on parse failure. (5) **native-ffi cleanup** — removed OpenMP from etchash build (DAG now generated on GPU), added `NOMINMAX` for Windows MSVC, added VS 18 detection, `b.flag()` for `/FI` force-include. (6) **kHeavyHash/Autolykos host functions** — `generate_kheavy_matrix`, `autolykos_table_size`, `generate_autolykos_table` inlined into `gpu_opencl_full.rs` (were self-referential imports). **Status:** ProgPoW kernel runs without hangs on Vega 64 (gfx900) at ~26K H/s (performance optimization pending — expected ~10 MH/s). VRSC target fix deployed, pending verification. | (this commit) |
| 08-01 | **ERG Autolykos v2 — LIVE POOL TEST SUCCESS on 8 GB GPU** — Three critical fixes enabled ERG GPU mining at production height 1,842,080 on GTX 1070 Ti (8 GB): (1) **N_BASE fix:** `AUTOLYKOS_N_BASE` was 2^26 (Autolykos v1) instead of 2^21 (Autolykos v2 post-fork). At height 1,842,080, N=6.76M → R table = 220 MB (was 6.93 GB → OOM). Root cause of all previous VRAM OOM issues. (2) **Auto→CUDA external:** `Auto` backend fallback only tried `CudaDeekshaMiner` for all algorithms; now tries `CudaExternalMiner` for external algorithms (autolykos/blake3/kheavyhash). (3) **Stream1 VRAM:** `TriGpuManager::new` always allocated primary GPU (~2 GB) even when `ZION_STREAM1_ENABLED=0`; now passes `Cpu` kind when stream1 disabled. **Live test:** R table 220 MB, ~21 MH/s, shares found (hashes `0000…`), submitted to debug pool (62.171.141.136:8461), pool forwards to 2miners. `BelowTarget` from 2miners expected (easy target). Run: `ZION_STREAM1_ENABLED=0 ZION_STREAM2_ENABLED=1 ZION_MINER_GPU_COIN=ERG ./zion-miner --pool … --gpu-coin ERG`. | `3d4e707fa` |
| 08-01 | **ERG Autolykos v2 R table (DAG) kernel — 25.35 MH/s (1.76x)** — Rewrite of the tableless Autolykos v2 CUDA kernel (14.37 MH/s) to a two-kernel approach: `autolykos_precompute` builds an R table of N×32-byte elements (`takeRight(31, H(j || height || M))`), `autolykos_mine` uses `uint4` 128-bit table lookups instead of on-the-fly blake2b for each of the 33 index computations per nonce. Correctness verified: GPU hash matches CPU reference exactly at height=0 (N=2M, 64 MB table). Performance: **25.35 MH/s** on GTX 1070 Ti — 1.76x improvement over tableless. VRAM pre-check via `cuMemGetInfo_v2` added to host code (bails if table + 512 MB headroom exceeds free VRAM). Report: [`docs/3.0.7/ERG_AUTOLYKOS_LIVE_POOL_REPORT.md`](./docs/3.0.7/ERG_AUTOLYKOS_LIVE_POOL_REPORT.md) | `b7fc2a180` |
| 07-31 | **Trinity CPU coins E2E re-verified on Edge debug pool** — All three active external CPU coins (RTM, XMR, VRSC) submitted shares to upstream pools via the Edge debug pool on `62.171.141.136:8461` and were accepted. RTM (GhostRider) → zpool.ca: `auxpow_bridge: share_forwarded ... result=Accepted`. XMR (RandomX) → MoneroOcean: `external_share_accepted coin=XMR status=accepted`, `auxpow_bridge: share_forwarded ... result=Accepted` (using `ZION_XMR_LATEST_ONLY=1` + `ZION_XMR_STALE_SECS=30` drop-in). VRSC (VerusHash) → LuckPool: `external_share_accepted coin=VRSC status=accepted`, `auxpow_bridge: share_forwarded ... result=Accepted`. Local test command: `zion-miner --pool 62.171.141.136:8461 --wallet zion17285k3966560j5e4s4h3f2x3x5l0x8z8y4s84k5 --cpu-coin <COIN> --threads 12 --loops 1000 --gpu cpu --no-tui`. Debug-pool helper `edge-deploy/scripts/start-debug-pool.sh` used for VRSC; per-coin systemd drop-ins used for RTM/XMR. GPU stream remains blocked on local GTX 1070 Ti 8 GB due to `CUDA_ERROR_OUT_OF_MEMORY` in primary deeksha scratchpad allocation when GPU is enabled. | — |
| 07-28 | **Trinity All Green — 10/10 CUDA kernels CPU/GPU MATCH + 3 critical bug fixes** — Comprehensive CUDA kernel verification sweep on GTX 1070 Ti completed. Three critical bugs found and fixed: (1) **KawPow pool-side share verify** — `share_forwarder.rs` used `ethash_final_hash` instead of `kawpow_final_hash_real` for KawPow → valid shares rejected. Fixed + deployed to Edge. (2) **ProgPow kernel output_hash** — `progpow_kernel.cu` never wrote 32-byte final hash to `output_hash` buffer → GPU returned `0000000000000000` → CPU/GPU mismatch. Added `keccak_f800_full()` function + `output_hash` kernel parameter + little-endian output (matching CPU `st[i].to_le_bytes()`). All 3 ProgPow variants now CPU_GPU_MATCH: progpow, evrprogpow, meowpow. (3) **GPU init decoupled from stream1** — GPU was only initialized when `stream1_enabled=true`, preventing external-only GPU mining (stream1=0, stream2=1). Fixed: GPU inits if stream1 OR stream2 enabled; primary deeksha GPU skipped when stream1=0; fallback keeps `gpu_available=true` if stream2 active even when primary init fails. **Final CUDA kernel results (10/10 CPU/GPU MATCH):** kheavyhash 638 MH/s, blake3_alph 1.58 GH/s, blake3_dcr 1.23 GH/s, autolykos 1.26 GH/s (no CPU ref), zelhash 1.54 GH/s, ethash 117 MH/s, kawpow 93.5 MH/s, progpow 11.1 MH/s, evrprogpow 11.1 MH/s, meowpow 11.1 MH/s. RVN KawPow E2E pool test blocked: epoch 596 DAG = 5.66 GB, too large for GTX 1070 Ti 8GB VRAM on Windows (~6GB available). Kernel verified on epoch 0 (1GB DAG). E2E needs GPU with >8GB VRAM. | `cb98caad5`, `eb98dc694`, `0a5f710f` |
| 07-21 | **VRSC "low difficulty share" FIXED — fail2ban root cause + pending request cleanup** — VRSC shares to LuckPool were all rejected with error 23 "low difficulty share". Root cause: fail2ban `zion-p2p` jail banned local miner server IPv4 `109.81.28.144` due to P2P connect/disconnect from backup node → ALL IPv4 traffic to Edge blocked (SSH, stratum 8444, debug pool 8460). Miner disconnected but dashboard showed cached data → appeared alive but was not submitting shares. Fix: (1) `fail2ban-client set zion-p2p unbanip 109.81.28.144`, (2) added to `ignoreip` in `/etc/fail2ban/jail.d/zion-p2p.conf` (perzistentní), (3) UFW rule `8460/tcp` ALLOW added for RTM debug pool, (4) `pending_requests.drain()` on reconnect in `auxpow_client.rs` — cancels in-flight share submissions immediately instead of waiting 60s timeout. After fix: VRSC shares **ACCEPTED** by LuckPool at 94% efficiency (47/3 A/R, 7.92 MH/s). Also: RTM poll message diagnostic logging added (id, method, result, error, pending count). | `358c7064b` |
| 07-21 | **RTM GhostRider share ACCEPTED by zpool — 7 bugs fixed** — Comprehensive debugging of "Invalid share" (error 25) rejections across the GhostRider hashing pipeline. 7 distinct bugs identified and fixed: (1) `getAlgoString` byte order — reverted to yiimp's REVERSED byte order (`b = (63-j)>>1`, high nibble first), matching the Raptoreum daemon's `GetNibble` (`index = 63 - index`). Previous "fix" to forward byte order (matching cpuminer-gr-avx2) was WRONG — zpool runs yiimp as validator, not the miner. Also replicated yiimp's subtle bug where the last-selected algo is NOT written to the output string (break before sprintf). (2) `ghostrider_wrapper.c` hash output byte reversal removed (yiimp does `memcpy`, no reversal). (3) `meets_target_little_endian` comparison fixed — reverse ONLY hash (LE→BE), compare against BE target (was reversing both). (4) `native-ghostrider` feature added to pool Cargo.toml default (was using blake3 fallback). (5) Per-coin target lookup in `server.rs` — `external_stream_cpu_job` was a single overwritten variable; added `latest_job_for_coin()` to `MultiAuxPowBridge` for correct per-coin target. (6) yiimp error 25 sanity check (`hash[30] | hash[31] == 0`) added in share_forwarder, miner_harness, auxpow_scheduler, auxpow_client. (7) `rtm_live_test.rs` batch size + nonce_base preservation. Live verified: RTM share **ACCEPTED** by zpool.ca — nonce=2660, hash=`2640c0ba...edb20000`, 1188s @ 118.2 H/s. Separate RTM debug pool deployed on Edge (port 8460, `zion-rtm-debug-pool` service, RTM-only, doesn't interfere with main pool on 8444). Full report: [`RTM_DEBUG_REPORT.md`](./docs/3.0.6/RTM_DEBUG_REPORT.md) | `58ea1eee5`, `0942c28fb` |
| 07-19 | **RTM GhostRider CPU E2E share verify PASS** — 3 root causes fixed via online source verification (yiimp-ghostrider, xmrig, Monero StackExchange): (1) `share_forwarder.rs` RTM target check changed from `meets_target` (BE) to `meets_target_little_endian` (LE) — yiimp `get_hash_difficulty` reads `hash[22..29]` as LE uint64; (2) `ghostrider_wrapper.c` hash output reversed from BE (sphlib native) to LE (Bitcoin internal) — yiimp checks `hash_bin[30] | hash_bin[31] == 0` (MSB in LE); (3) `auxpow_client.rs` prevhash byte order changed from full 32-byte reversal to per-4-byte-word reversal matching yiimp's `ser_string_be`. Also: `native-ghostrider` feature added to miner Cargo.toml, `_GNU_SOURCE` define added to build.rs for Linux. Live verified: RTM share **ACCEPTED** by zpool.ca upstream pool. XMR RandomX connected but "Low difficulty share" — under investigation. | `51a34409a` |
| 07-19 | **XMR RandomX hash verify OK + target parse fix** — Root cause of "Low difficulty share" identified: miner binary was not built with `native-randomx` feature (blake3 fallback produced wrong hashes). Fixed: miner binary redeployed with native-randomx. Shares now pass pool-side target check (rejected as "Invalid job id" = stale, not "Low difficulty" = wrong hash). Also: `parse_randomx_target_hex` now accepts 4-byte (32-bit) targets (MoneroOcean format `b88d0600`), converting to 64-bit via xmrig's formula `u64::MAX / (u32::MAX / target_32)`. Remaining: stale job_id — pool receives new jobs every ~15-30s but miner submits with old job_id. Job propagation pipeline fix needed. | `7198f6863` |
| 07-19 | **EPIC ProgPow share acceptance pipeline complete** — Three-phase fix: (1) dedicated one-shot TLS connection for EPIC submit avoids TLS EOF race with poll loop (`epic_submit_dedicated()`), (2) `pool_io_thread` forwards external_stream jobs directly to GPU/CPU threads (~10s latency instead of ~14s), (3) full ProgPow final hash verification on pool before upstream submit — `ethash_final_hash()` computes `keccak256(keccak512(header || nonce_le) || mix_hash)` without needing DAG, drops GPU kernel u64 pre-check false positives locally instead of wasting ~14-min EPIC share windows on "low difficulty" rejections. Live verified: false positive dropped at 14:37. Report: [`docs/3.0.6/EPIC_PROGPOW_SHARE_FIX_REPORT_2026-07-19.md`](./docs/3.0.6/EPIC_PROGPOW_SHARE_FIX_REPORT_2026-07-19.md) | `736ae9fb7`, `1b7a0d454`, `1683f21ec` |
| 07-17 | **CryptonoteStratum + IronFishStratum protocols** — DNX pools use cryptonote-nodejs-pool protocol (JSON-RPC `login` method, not Stratum v1). IRON pools use IronFish stratum v2 (`body`-based JSON-RPC, subscribe includes wallet address, no separate authorize). Both protocols fully implemented: login/subscribe, job parse, submit, keepalived/keepalive, reconnect. Pool addresses updated: DNX→pool.deepminerz.com:3333, IRON→fr.grandpool.io:2027, KLS→karlsencoin.cedric-crispin.com:4154, VTC→verthash.eu.mine.zpool.ca:4533. E2E: 5/8 full PASS (ZCL, VTC, QTC, RTM, NEXA), 3/8 protocol verified (IRON/KLS/DNX auth fails on BTC address — needs native wallet). Cosmic-harmony profit router synced + fallback estimates added for 8 new coins. Edge server rebuilt + deployed. 175 AuXpow + 201 cosmic-harmony tests pass. | `c277a672a`, `e7089406f` |
| 07-16 | **All 22 coins now GPU-mineable + nonce_count fix** — Final 3 OpenCL kernels implemented: Qhash/QTC (16-qubit quantum circuit sim, 370 lines), GhostRider/RTM (15 x16r hash algos + 6 CryptoNight variants, 580 lines), DynexSolve/DNX (neuromorphic SAT solver via RK4 ODE integration, 430 lines). All 3 wired into `gpu_miner.rs` dispatch + `gpu_kernel_available()` updated. **22/22 coins** now have OpenCL GPU kernels. Also fixed critical nonce_count regression: default was 1024 (too small for GPU, double-buffering never activated → only 10 KH/s instead of 28-30 KH/s). Fix: nonce_count default = 4× gpu_work_size (32768 for RX 5700 XT) when GPU available. | `0e5ef6c40`, (nonce_count fix) |
| 07-16 | **AutonomousProfitRouter + CoinPreference pool protocol** — Autonomous miner mode (`ZION_AUTONOMOUS=1`): auto-detects hardware (GPU VRAM/backend, CPU AES/AVX2/threads), filters compatible coins, selects most profitable by revenue - electricity cost. `CoinPreference` pool message for runtime stream switching. `gpu_kernel_available()` completed for all 22 coins. Re-evaluation with hysteresis (15% threshold, 5 min interval). | `12eb49af7`, `fa126e5aa` |
| 07-16 | **8 new no-DAG GPU-mineable coins OpenCL kernels** — IRON (FishHash, 580 lines), KLS (KarlsenHashV2, 604 lines), NEXA (NexaPow secp256k1 Schnorr, 6164 lines from UltrafastSecp256k1 MIT), VTC (Verthash, 289 lines + SHA3 277 lines), ZCL (Equihash 192,7, 851 lines from silentarmy) fully integrated or kernel-ready. RTM/QTC/DNX documented placeholders. 3 commits, 9292 lines of OpenCL kernel code. 173/173 tests pass. Comprehensive report: [`docs/3.0.6/GPU_KERNEL_INTEGRATION_REPORT_2026-07-16.md`](./docs/3.0.6/GPU_KERNEL_INTEGRATION_REPORT_2026-07-16.md) | `f6df75b64`, `646d14f59`, `77613ad50` |
| 07-16 | **Stratum E2E tests for 8 new coins** — Live stratum connection tests from Edge server: 5/8 full E2E (NEXA✅, ZCL✅, RTM✅, QTC✅, VTC✅), 3/8 issues (IRON: herominers no response, KLS: EthStratum auth pending, DNX: all pools blocked from datacenter). VTC default pool changed to zpool (verthash.eu.mine.zpool.ca:4533), added to is_zpool()+supports_btc_payout(). KLS pool hostname fixed. | `1126bacca` |
| 07-16 | **8 new ExternalCoin variants + pool/profit routing** — KLS, ZCL, QTC, VTC, IRON, NEXA, RTM, DNX added to ExternalCoin enum, cosmic-harmony RevenueSource, pool server routing (26 sources), miner config, dashboard. Dynamic pool stream config polling. | (prior commits) |
| 07-16 | **Comprehensive share verification** — ZION: 178 shares, 100% accept rate (0 rejected). VRSC: 6 accepted, 4 stale (post-optimization, two-stage AVX2 path). XMR: E2E BLOCKED — MoneroOcean auto-switches to KawPow (more profitable than RandomX), all pure-RandomX pools (2miners, SupportXMR, Nanopool, Kryptex) unreachable from Edge server (datacenter IP blocking). XMR wallet configured (`ZION_POOL_AUXPOW_WALLET_XMR`), pool client connects and authorizes on MoneroOcean, but no RandomX jobs received. | (this commit) |
| 07-16 | **Miner hardware autotune + Claymore-style sticky header** — `auto_tune_work_sizes()` detects GPU CUs/VRAM/CPU cores/RAM, computes optimal WS/SWS/threads. `ZION_AUTOTUNE=1` default ON, `--auto-tune` CLI flag. Sticky header: alt screen buffer + stdout→/dev/null + tty_write() to /dev/tty (works in screen). `ZION_NO_STICKY=1` to disable. Report: [`docs/3.0.6/AUTOTUNE_STICKY_REPORT_2026-07-16.md`](./docs/3.0.6/AUTOTUNE_STICKY_REPORT_2026-07-16.md) | `818d5b272`, `a523ccbc2` |
| 07-16 | **DAG generation exclusively on GPU (never CPU)** — All Ethash/KawPow/ProgPow DAGs now generated on GPU via OpenCL `ethash_calculate_dag_item_mod` kernel. CPU only generates light cache (~16-100 MB, seconds). New: `ethash_generate_light_cache()`, `EthashLightCache`, `generate_ethash_dag_on_gpu()`, `generate_progpow_dag_on_gpu()`, `generate_dag_on_gpu_impl()`. `DagManager` rewritten — no CPU FFI. Report: [`docs/3.0.6/MINER_FIXES_REPORT_2026-07-16.md`](./docs/3.0.6/MINER_FIXES_REPORT_2026-07-16.md) §1 | `aa8ceb396` |
| 07-16 | **VRSC/QUAI external share accept bug fix** — `read_next_result()` only accepted `PoolMessage::Result`, but external stream shares receive `PoolMessage::ExternalResult`. Every VRSC/QUAI share was logged as `external_result_read_error` even though pool accepted it. Fix: added `ExternalResult` match arm. Shares now properly counted in hashrate tracker. Report: [`docs/3.0.6/MINER_FIXES_REPORT_2026-07-16.md`](./docs/3.0.6/MINER_FIXES_REPORT_2026-07-16.md) §2 | `7ad18ae1c` |
| 07-16 | **RandomX perf optimization (23x)** — AES-NI + AVX2/BMI/BMI2 build flags + LARGE_PAGES flag + fix `hash_with_seed` reinit-on-empty-seed bug. Benchmark: 7→161 H/s (vs XMRig 245 H/s). Huge pages configured (vm.nr_hugepages=1250). See [`docs/3.0.5/RANDOMX_PERF_OPTIMIZATION_2026-07-16.md`](./docs/3.0.5/RANDOMX_PERF_OPTIMIZATION_2026-07-16.md) | (this commit) |
| 07-16 | **VRSC VerusHash perf optimization (2.7x)** — Two-stage mining hash (`hash_half` + `prepare_key` + `hash_with_nonce`) based on ccminer/bloxminer. AVX2/BMI/BMI2 build flags added. Benchmark: 0.280→0.746 MH/s (vs hellminer 0.669 MH/s). 5 VRSC shares in 4 min, all accepted by LuckPool. See [`docs/3.0.5/VRSC_PERF_OPTIMIZATION_2026-07-16.md`](./docs/3.0.5/VRSC_PERF_OPTIMIZATION_2026-07-16.md) | `4341a8684` |
| 07-16 | **VRSC shares ACCEPTED by LuckPool** — `clear_verushash_pbaas()` fix deployed. Root cause: outdated binary missing PBaaS v7+ header normalization (zeroing non-canonical fields before VerusHash). TriGpuManager Cpu kind bug fixed (miner couldn't start in CPU-only mode). Legacy `zion-pool.service` disabled (port 8444 conflict). 4/4 VRSC shares accepted, 0 rejections. See [`docs/3.0.5/VRSC_SHARE_ACCEPTANCE_FIX_2026-07-16.md`](./docs/3.0.5/VRSC_SHARE_ACCEPTANCE_FIX_2026-07-16.md) | `071c50ebf`, `09217752a` |
| 07-15 | **QUAI (KawPoW) added** — 15th external coin. KawPoW GPU thread in miner (`kawpow_gpu_thread`), Stratum v1 protocol, 2miners pool (BTC payout). `ExternalCoin::QUAI` in AuXpow enum, pool server routing/algorithm/CH-coin mappings, miner channel+routing+share drain. Env vars: `ZION_POOL_AUXPOW_WALLET_QUAI`, `ZION_POOL_AUXPOW_PASSWORD_QUAI` | (this commit) |
| 07-15 | **BEAM (BeamHash III) added** — 16th external coin. Custom `BeamStratum` protocol (JSON-RPC 2.0 over TLS) for beam.2miners.com:5252. `ExternalCoin::BEAM` in AuXpow enum, `StratumProtocol::BeamStratum` variant, `beam_login()`/`parse_beam_job()`/Beam submit block, `RevenueSource::BeamHashExternal` in cosmic-harmony, pool server routing/algorithm/CH-coin/stats mappings. Env var: `ZION_POOL_AUXPOW_WALLET_BEAM` | (this commit) |
| 07-15 | **BeamHash III GPU kernel implemented** — SipHash-2-4 + Equihash 144,5 CPU hasher (`AuXpow/src/beamhash.rs`, 590 lines, 13 tests) + OpenCL kernel (`AuXpow/csrc/opencl/beamhash_kernel.cl`, SipHash-2-4 + hash generation) + GPU dispatch wired in `gpu_miner.rs` + `gpu_backend.rs` stub replaced with real `mine()` call. 159/159 AuXpow tests pass. | `525835d4e` |
| 07-15 | **EvrProgPow/MeowPow correct params** — `EVR_PROGPOW_PARAMS` (PERIOD=3, REGS=32, CNT_CACHE=11, CNT_MATH=18) + `MEOWPOW_PARAMS` (PERIOD=6, REGS=16, CNT_CACHE=6, CNT_MATH=9) in `progpow_codegen.rs`. `select_progpow_params()` dispatcher. `kawpow_kernel.cl` #ifndef guards for PROGPOW_REGS/CNT_MATH. Algorithm-aware `ensure_proque_progpow()` in `gpu_miner.rs`. 5 new tests. Previously EVR/MEWC used KawPow fallback (PERIOD=10) → wrong random math → shares rejected. | `305f4821e` |
| 07-15 | **GPU Benchmark M1 Metal** — blake3 24.7 GH/s, blake3_dcr 24.2 GH/s, kheavyhash 22.2 GH/s, autolykos 23.7 GH/s, zelhash 23.8 GH/s, pearlhash 25.2 GH/s, Pearl PoUW MatMul 1,516,269 tiles/s. `AuXpow/examples/gpu_benchmark.rs` | — |
| 07-15 | **E2E Edge audit** — Pool active (44,950 ZION shares, 99.97% accepted), EPIC+VRSC streams embedded in jobs ✓, but `src_progpow=0, src_verushash=0` — miners not submitting external shares (old binary without external stream support). Deploy fix needed. | — |
| 07-15 | **ERG (Autolykos v2) E2E complete** — `autolykos_gpu_thread()` (Stream 3e) added to miner. Uses existing `autolykos_kernel.cl` OpenCL kernel (BLAKE2b-256, memory-hard precomputed table, 4-nonce batch scanning, midstate precomputation). Routing: ERG/autolykos → `autolykos_tx` channel. Share collection + submit. Pool-side was already complete (`RevenueSource::AutolykosExternal`, Stratum v1, 2miners pool). Env var: `ZION_POOL_AUXPOW_WALLET_ERG` | `d4e03cb97` |
| 07-15 | **Triple Parallel AuxPoW LIVE** — Claymore-style 3-stream parallel mining: ZION (GPU DeekshaChv3) + EPIC (GPU ProgPow) + VRSC (CPU VerusHash) simultaneously. Second AuxPow bridge (`cpu_auxpow_bridge`) for CPU-only coins. `external_stream_cpu` field in `PoolMessage::Job`. OpenMP-parallel DAG generation (19 threads, epoch 120 ~2GB in ~4 min). All 3 streams verified live on Edge (rx5600-test miner, 99.7% ZION accept rate, EPIC ProgPow kernel 7169+ batches, VRSC CPU thread hashing) | (this commit) |
| 07-14 | **PPLNS payout bug fix** — composite `miner_id/worker_name` keys (all workers sharing same miner_id had payouts sent to last-registered address) + telemetry registry composite keys | `bd6f1dfb3`, `85250086d` |
| 07-14 | NoSolution reconnect cooldown — ban IP for 300s on rate-limit exceed | `49f8bfb57` |
| 07-14 | Dashboard fix: web-next port 3001→3000, miner health endpoint 8444→8455 — 14/14 UP | `0c17d445c` |
| 07-14 | AuXpow Metal backend — all 6 algorithms on Apple M1 (18–23 BH/s, 28–224x vs OpenCL) | `a3cbc790b` |
| 07-13 | Stream Profit R1b — live API fetching | `e1c28689b` |
| 07-13 | Stream Profit R1c — GPU kernel parametrizace | `74a353205`, `87bb2b2f0` |
| 07-13 | EthStratum R6 — eth_getWork/eth_submitWork/eth_submitHashrate | `5baa76d60` |
| 07-13 | R7: VRSC B2b revenue — ZcashStratum protocol, VerusHash v2.2, LuckPool | `bb7d5407b` |
| 07-13 | VerusHash C++ native build — Haraka+CLHash pipeline, `native-verushash` feature | `ea4e33bf4` |
| 07-13 | DCR Blake3 kernel ROTR/ROOT fix + SMOS env vars | `dfc9cf24d` |
| 07-13 | SMOS GPU RVN live — `--no-tui`, `--algorithm kawpow`, non-interactive wrapper | `15a035290`, `09ba930da`, `d0a5bc807` |
| 07-13 | Non-EVM deploy: Solana + Stellar mainnet LIVE | `bffde9263`, `9d7ce1686` |
| 07-12 | ZionDex L3 WARP integration + AMM routing + LND | `c54422094`, `dad8702db` |
| 07-11 | AuxPow merge mining pool+dashboard integration | `44371aa10`, `f14500db3` |
| 07-11 | Pool F1-F6 scalability optimizations (1000+ miners) | `673632525` |
| 07-09 | 3.0.5 "All Green" — 11/11 services + E2E memo tests | `d425faec` |
| 07-09 | Web deploy optimization (2.57GB → 377MB) | — |
| 07-09 | Memory leak fix (OOM kill resolution) | `348abc91`, `22a160f9` |
| 07-06 | 3.0.4 Hard genesis reset — new server | — |
| 06-30 | Multi-chain wZION deploy (6 EVM chains) | — |
| 06-29 | Reverse bridge E2E verified (100 wZION burn → L1 unlock) | — |
| 06-27 | 3.0.3 decimal fork (1e12 → 1e6) | — |

---

## 9. Pending Tasks

### Blocking (for public launch)
1. **EVM contract redeploy** — New contracts with new admin keys + multisig (owner action)
2. **External audit** — Genesis configuration audit before public launch
3. **systemd User=zion** — 10/12 services done, dashboard + dex still User=root (need file relocation from /root/)

### Non-Blocking
1. Deploy remaining 7 non-EVM chains (Tron, Cardano, Cosmos, Aptos, Sui, NEAR, TON)
2. Multi-sig (5/5 WARP validators) for Solana mint authority + Stellar issuer
3. LND node start on Edge (docker compose up + channels)
4. ZionDex Router service on Edge (port 8454) — ✅ DONE (live, 7 chains)
5. R2: DCR revenue live (WoolyPooly)
6. R3: ALPH + KAS E2E (2miners)
7. R4: Stream telemetry revenue report (dashboard + API) — ✅ DONE (`d189712a7`)
8. R5: SMOS deploy + GPU mining (done — Vega rig `vega-smos` live on `zion-miner-v3.0.5-gpu-r6.zip`)
9. R7: VRSC live E2E deploy — ✅ DONE (LuckPool shares accepted, `clear_verushash_pbaas` fix deployed 2026-07-16)
10. R8: True AuxPow consensus (future, 20-40h)

---

## 10. Documentation Index

| Document | Location | Description |
|----------|----------|-------------|
| **StatusV3.md** (this file) | Root | Canonical current status |
| StatusV3 archive | `docs/3.0.5/StatusV3_archive_2026-07-13.md` | Historical incident reports (5239 lines) |
| AGENTS.md | Root | Operating guidance for AI agents |
| ROADMAP.md | Root | Forward roadmap |
| AuxPlan.md | `docs/3.0.5/archive-root-md/` | AuxPow + Stream Profit development plan (archived) |
| FullRevenueAuxPow.md | Root | 3-stream parallel mining canonical architecture (ZION + Pearl + Verus) |
| AUXPOW_VRSC_B2B_PLAN.md | `docs/3.0.5/archive-root-md/` | VRSC B2b revenue integration design doc (archived) |
| ZionDex.md | `docs/3.0.5/archive-root-md/` | ZionDex DEX router documentation (archived) |
| Genesis reset runbook | `docs/3.0.4/GENESIS_HARD_RESET_CANONICAL.md` | Hard reset procedure |
| Security disclosures | `docs/security/SECURITY_DISCLOSURE_2026-07.md` | ZION-2026-001 through 005 |
| Contract addresses | `docs/3.0.5/CONTRACT_ADDRESSES.md` | All deployed contracts |
| AuxPow integration report | `docs/3.0.5/AUXPOW_INTEGRATION_REPORT_2026-07-11.md` | Pool+dashboard integration |
| Pool perf report | `docs/3.0.5/POOL_PERF_REPORT_2026-07-11.md` | F1-F6 optimizations |
| 3.0.5 all-green report | `docs/3.0.5/REPORT_3.0.5_ALL_GREEN_CZ.md` | Protocol upgrade verification |
| **VRSC share fix** | `docs/3.0.5/VRSC_SHARE_ACCEPTANCE_FIX_2026-07-16.md` | LuckPool `low difficulty share` root cause + fix (clear_verushash_pbaas) |
| **VRSC perf optimization** | `docs/3.0.5/VRSC_PERF_OPTIMIZATION_2026-07-16.md` | Two-stage mining hash + AVX2 (2.7x speedup, 0.746 MH/s) |
| **RandomX perf optimization** | `docs/3.0.5/RANDOMX_PERF_OPTIMIZATION_2026-07-16.md` | AES-NI + AVX2 + huge pages (23x speedup, 161 H/s) |
| **Miner autotune + sticky header** | `docs/3.0.6/AUTOTUNE_STICKY_REPORT_2026-07-16.md` | Hardware autotune + Claymore-style sticky header |
| **Miner DAG GPU + VRSC share fix** | `docs/3.0.6/MINER_FIXES_REPORT_2026-07-16.md` | DAG generation exclusively on GPU + ExternalResult share accept fix |
| **EPIC ProgPow share fix** | `docs/3.0.6/EPIC_PROGPOW_SHARE_FIX_REPORT_2026-07-19.md` | Dedicated TLS submit + stale job forwarding + full ProgPow hash verification on pool |
