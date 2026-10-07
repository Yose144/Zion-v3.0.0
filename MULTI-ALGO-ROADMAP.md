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

### Kernel E2E matrix — výsledky (2026-10-06, GTX 1070 Ti OpenCL)

Legenda: **KAT** = `auxpow_kat` GPU↔CPU bit-exact; **RUN** = kernel běží, CPU ref chybí;
**Stratum** = `stratum_probe` connect+authorize+job (fake wallet → authorize fail je OK signál).

| Algo (coin) | Kernel | KAT | Stratum probe | Live E2E | Poznámka |
|---|---|---|---|---|---|
| kheavyhash (KAS) | ✅ | ✅ PASS | ✅ OK (real wallet) | ✅ **100/100 fake-pool accepted**, live connected | consensus-exact, ~249 MH/s GPU |
| keryxhash (KRX) | ✅ | ✅ PASS | ✅ OK (zpool, fake wallet OK) | pending live | per-block matrix fix |
| blake3_dcr (DCR) | ✅ | ✅ PASS | ⏱️ woolypooly timeout | pending | 180B header, nonce@140 |
| blake3_alph (ALPH) | ✅ | ✅ PASS | ⏱️ woolypooly timeout | pending | en1-high nonce |
| pearlhash (PRL) | ✅ | ✅ PASS | ⏱️ alphapool timeout | pending | user fix BLAKE3 state layout `[12]=cnt_lo,[13]=cnt_hi,[14]=len,[15]=flags` |
| autolykos (ERG) | ✅ | ✅ **PASS** | ❌ authorize (wallet) | pending | **consensus-exact rewrite**: GPU table-gen (T[j]=b2b256(j‖h‖M)) + mining kernel (bigint sum mod 2²⁵⁶); GPU ≡ Rust port ≡ native-ffi @ N=2²⁶ ✓ |
| ethash (ETC) | ✅ | ⚠️ RUN (mix≠0 ✓) | ❌ authorize (wallet) | pending | DAG gen OK; hash=0 by-design (mix_hash je artefakt) |
| kawpow (RVN) | ✅ | ⚠️ RUN (mix≠0 ✓) | ❌ authorize (wallet) | pending | **DAG gen implementován** (sdílí ethash light-cache; epoch 7500) |
| progpow (EPIC/ZANO) | ✅ | ⚠️ RUN | ZANO ✅ live dřív | ✅ ZANO | DAG OOM při sweep (DAG buffery se kumulují — samostatný run OK) |
| zelhash (FLUX) | ✅ compile | ❌ VRAM | ❌ TCP connect (woolypooly mrtvý) | blocked | potřebuje ~6.5GB volné VRAM; na busy kartě OOM |
| verushash (VRSC) | — | n/a (no kernel) | ✅ OK (luckpool, zcashstratum) | ✅ **CPU path live** | 1487B header; GPU kernel absent |
| equihashzero (ZCL) | ⚠️ compile | ❌ VRAM | ✅ OK (zpool) | blocked | 2×2GB tabulky > volná VRAM (192,7 NR_SLOTS=64); args-at-build + EQ_WG_SIZE=32 hotovo |
| equihash 200,9 (ZEC) | ✅ | ⚠️ **RUN** (řešení nalezeno) | ❌ TCP connect (port mrtvý) | pending | **Wagner pipeline kompletní**: init→r0→r1-7→r8→sols; host/kernel NR_SLOTS mismatch fix (4→8); K=9 rounds doplněny |
| qhash (QTC) | ✅ | ⚠️ RUN | ✅ OK (suprnova) | pending | produkuje kandidáty; CPU ref chybí |
| ghostrider (RTM) | ✅ | ⚠️ RUN | ✅ OK (zpool) | pending | **fixed**: batch cap 128 WI (2MB scratchpad/WI) — byl OOM |
| neoscrypt (PHX) | ✅ | ⚠️ RUN | ✅ OK (zpool) | pending | **dispatch doplněn** (byl "unsupported") |
| eaglesong (CKB) | ✅ | ⚠️ RUN | ❌ authorize (wallet) | pending | **dispatch doplněn** |
| dynexsolve (DNX) | ✅ | EMPTY (kernel běží) | ❌ authorize (wallet) | pending | **ABI fix**: 12→10 args, 1-based literály; syntetický SAT bez řešení v batchi = očekávané |
| nexapow (NEXA) | ✅ compile | ⏳ neprakticky pomalé | ❌ authorize (wallet) | blocked | secp256k1 Schnorr per-nonce; 128 nonce > 10min → potřeba timeout+microbench |
| octopus (CFX) | ✅ | ⚠️ RUN | ❌ TCP connect (port) | pending | **dispatch + DAG wiring** (sdílí ethash DAG) |
| verthash (VTC) | ✅ | ⚠️ **RUN** | ✅ OK (zpool) | pending | verthash.dat stažen (1.28GB); early-dispatch fix; CPU ref chybí |
| fishhash (IRON) | ✅ kernel | — | ❌ authorize (wallet) | blocked | FishHash DAG gen absent (4.6GB, generátor k portu) |
| karlsenhash (KLS) | ✅ kernel | — | ❌ authorize (wallet) | blocked | DAG gen absent |
| beamhash (BEAM) | ✅ solver | ❌ VRAM | ⏱️ beam.2miners timeout | blocked | solver tabulky 2×2.28GB=4.56GB; **pre_pow fix hotový**; potřeba volná karta |
| randomx (XMR) | CPU only | n/a | ⚠️ authorized, no job | — | cryptonote login OK; stub GPU |
| quai (QUAI) | kawpow path | — | ❌ TCP connect | blocked | port mrtvý |
| evrprogpow (EVR) | kawpow fallback | — | ⚠️ authorized, no job | pending | per-coin progpow params chybí |
| meowpow (MEWC) | kawpow fallback | — | ⚠️ authorized, no job | pending | dto. |
| sha256d (BTC) | — | — | SKIP | — | merge-mining, žádný pool |
| quantus (QTU) | qpow native | ✅ live | ⚠️ login: potřeba 36B wallet | ✅ produkce | QuantusStratum custom |
| epic (EPIC) | progpow | — | ⚠️ authorized, no job | pending | EpicStratum job parse? |
| monero (XMR) | CPU randomx | — | ⚠️ authorized, no job | — | cryptonote OK |

### Stratum probe — mapa connectivity (2026-10-06, fake wallet `zion1probe`)

- **OK s fake wallet (pool nevaliduje adresu):** VTC, VRSC, ZCL, QTC, RTM, PHX, KRX
- **Authorize fail (pool validuje formát adresy):** KAS, RVN, ETC, ERG, KLS, IRON, NEXA, DNX, CKB — pro share-level E2E potřeba validní adresa
- **TCP connect fail (mrtvý endpoint):** CLORE, FLUX, NEOX, QUAI, CFX, ZEC:7070 — default_pool() potřebuje update
- **Timeout:** ALPH, DCR, PRL, BEAM (woolypooly/beam.2miners nedostupné odsud)
- **Authorized, žádný job:** XMR, EPIC, MEWC, EVR — možný job-parse gap
- **QTU:** Quantus login vyžaduje dekódovatelnou 36B adresu

### kHeavyHash — opravené defekty (commit 749d112b1)

1. **Matice per-block**: `Matrix::generate(pre_pow_hash)` (xoshiro256++, rank-64 retry) místo statického `sha3("KHeavyHash")` seedu — Rust + OpenCL host + CUDA host + obě C kopie (miner + native-ffi, které sdílely symbol `kheavyhash_mine` → link-time kolize).
2. **maxTarget 2²²⁴−1** (bridge `hasher.rs`), ne 2²⁴⁸ — způsobovalo "Low difficulty share".
3. **LE u256 compare**: `meets_target_kaspa` — pool čte hash jako `Uint256::from_le_bytes`.
4. **en1 v HIGH bytes** u64 nonce (bridge concat: `en1_hex ‖ nonce_hex`).
5. **difficulty→target** přepsáno na bridge formuli `(max·1e18)/(diff·1e18)` — fractional diff dřív kolabovala na max target.
6. **CPU scan dedup**: `start_nonce` se reálně používá (dříve se rescanovalo od 0 → duplicate-submit flood).
7. **Stratum job channel** mpsc(8) → `watch` (latest-wins) — KaspaStratum notify spam deadlockoval session před submity.
8. **GPU path zapnut** pro kheavyhash: ts z `header[32..40]`, en1 složené do `base_nonce`.

### Checklist — co máme / co ne (2026-10-07)

**✅ Consensus-ověřené GPU kernely (KAT PASS bit-exact):**
kheavyhash, keryxhash, blake3_dcr, blake3_alph, pearlhash, **autolykos** (GPU table-gen + bigint-sum; ≡ native-ffi @ N=2²⁶)

**✅ Kernel běží, produkuje kandidáty/řešení (RUN — čeká CPU ref):**
qhash, ghostrider, neoscrypt, eaglesong, octopus, verthash, ethash+kawpow (mix_hash), progpow, **equihash 200,9** (Wagner kompletní, řešení nalezeno)

**⚠️ Kernel spustitelný, ale široké oprávnění chybí:**
- dynexsolve — běží, syntetický SAT bez řešení (EMPTY = OK signál)

**❌ Reálné defekty k opravě:**
- **nexapow** — secp256k1 Schnorr/nonce → neprakticky pomalé/hang, potřeba timeout + microbench

**⛔ Externí blockery (ne code bug):**
- zelhash — potřeba ~6.5GB VRAM (busy karta); samostatný run nutný
- equihashzero (192,7) — 2×2GB tabulky > volná VRAM
- beamhash — 2×2.28GB solver tabulky; pre_pow fix hotový
- fishhash/karlsenhash — FishHash DAG generátor absent (4.6GB DAG)
- Stratum authorize = nevalidní test wallet (KAS/RVN/ETC/ERG/KLS/IRON/NEXA/DNX/CKB); mrtvé endpointy: CLORE/FLUX/NEOX/QUAI/CFX/ZEC

**Opraveno v tomto sweepu (tohle + předchozí commity):**
- dispatch pro eaglesong/neoscrypt/octopus + output_nonce v kernelu
- dynexsolve ABI 12→10 + 1-based literály (byl context crash)
- ghostrider batch cap 512→128 (OOM fix)
- verthash/equihash/zelhash early-dispatch před generickou kompilací
- equihash: args deklarované při buildu + EQ_WG_SIZE=32 (84KB→43KB local pod NVIDIA limit) + K=9 rounds 6-8 + sols_buf dynamicky + blake (200,9) + **NR_SLOTS host fix 4→8** (OOB write = round0 context crash) + k_rounds loop bound (1..=K-2)
- octopus: ethash DAG wiring v mine()
- **autolykos consensus rewrite**: `autolykos_gen_table` (streaming b2b256, 65 blocks/entry) + `autolykos_mine` (f31 seed, sliding-window genIndexes, 31B bigint sum, height-N calc); miner csrc copy synced (měl špatný rotate-scheme genIndexes ≠ Scala sliding-window)
- KAT: autolykos Rust ref + native cross-check @2²⁶, kawpow DAG wiring, ZION_KAT_REPEATS/NONCE env

**Zbývá:** fishhash DAG gen (4.6GB), nexapow timeout/microbench, VRAM-blocked algos potřebují volnou kartu, live share-level E2E pro RUN algos s validními wallets.

Testy: `kheavyhash_official_vector` (e097f2e4…), `kheavyhash_share_roundtrip_pool_semantics`, `kheavyhash_matches_native`, KAT GPU≡CPU — vše PASS.
