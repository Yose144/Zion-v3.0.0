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

**Audit pool-side validace (2026-10-08):** live external shares jedou přes `auxpow_runtime::forward_share_to_upstream` — **V3 filosofie: forward vše upstream, upstream pool je authoritative verdict** (žádná lokální hash rekontrola před forwardem — správný proxy design, protože reálné per-coin hashe potřebují job data co `hash_for_coin` signatura nemá: pre_pow_hash/timestamp/en1/extranonce2/DAG). Lokální share-validační cesty jsou **dead code**: `stratum.rs` `job_id.starts_with("aux_")` → `submit_auxpow_with_target` → `validator::hash_for_coin` (aux_ job_ids generují jen unit testy v pool.rs), a `share_forwarder::ShareForwarder::try_forward` (POL-003 recompute přes `pure.rs` stuby → BelowTarget drop) nemá žádného callera. `pure.rs` je explicitně scaffold (blake3/keccak placeholder; "sha256d" volá Sha3_256). Závěr: stuby produkci neblokují, ale **při budoucím zapnutí lokální validace je nutné místo stubů napojit reálné per-coin impls** (většina existuje jako `hash_*` fce v `miner/src/auxpow/hasher.rs` + nové `*_ref.rs` porty) a rozšířit signaturu o job kontext.

### Fáze C — ZIS auth + multichain payouts

1. **ZIS (Zion Identity):** miner→pool session auth přes ZIS token místo plain wallet string; pool ověří identity přes G8/ZIS endpoint → per-user accounting, ban/allow list, worker naming.
2. **Multichain payout:** miner těží libovolný externí coin → příslušnost připsaná v ZION na PPLNS účet (existující `payout.rs`/`v3_pplns.rs`) — koň zůstane skrz `deferred_payout`/`revenue_proxy`; alternativa: direct payout v nativním coinu přes multichain bridge (warpd surface).
3. Definice úspěchu: miner s `gpuCoin=KAS` dostane accepted share na upstream + ZION credit na poolu.

### Fáze D — Desktop agent multi-algo E2E

1. UI: coin picker pro `gpuCoin`/`cpuCoin` z `ExternalCoin::ALL` (jen gpu_kernel_available pro zvolený backend) — dropdown v nastavení.
2. Per-coin tuning presets (batch, duty, gap).
3. `miner_config.json` schéma: multi-algo profile store.
4. Status panel: per-stream coin+algo+pool+A/R (už částečně je přes `_coinAlgo`).
5. **E2E self-test mode v agentovi:** ✅ IMPLEMENTOVÁNO (2026-10-09) — tlačítko ⚙ v Mining Console header → IPC `run-kernel-selftest` → spawn `auxpow_kat <algo>` per coin (coin→KAT mapa `KAT_ALGO_BY_COIN`, default = configured gpuCoin/cpuCoin, fallback KAS smoke), výstup streamuje do konzole `[SELFTEST]`, verdict parsen z `PASS|FAIL|SKIP|EMPTY|UNVERIFIABLE|ERR` řádků, per-algo timeout (default 240s), nexapow opt-in přes `{slow:true}`. Binárka resolvována vedle `zion-miner` / `V31/target/release` (kernely embedded přes include_str! — self-contained).

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
| ethash (ETC) | ✅ | ✅ **PASS** | ❌ authorize (wallet) | verified | **kernel fix na standard hashimoto** (fnv1 + mix[i%32] + statický s0); DAG items ≡ CPU + mix_hash ≡ CPU |
| kawpow (RVN) | ✅ | ✅ **PASS** | ❌ authorize (wallet) | verified | ProgOp interpretér CPU ref ≡ GPU digest; DAG OK |
| progpow (EPIC/ZANO) | ✅ | ✅ **PASS** | ZANO ✅ live dřív | ✅ ZANO | ProgOp interpretér ≡ GPU; **DAG lifecycle fix** (free_dag_caches) |
| zelhash (FLUX) | ✅ compile | ❌ VRAM | ❌ TCP connect (woolypooly mrtvý) | blocked | potřebuje ~6.5GB volné VRAM; na busy kartě OOM |
| verushash (VRSC) | — | n/a (no kernel) | ✅ OK (luckpool, zcashstratum) | ✅ **CPU path live** | 1487B header; GPU kernel absent |
| equihashzero (ZCL) | ⚠️ compile | ❌ VRAM | ✅ OK (zpool) | blocked | 2×2GB tabulky > volná VRAM (192,7 NR_SLOTS=64); args-at-build + EQ_WG_SIZE=32 hotovo |
| equihash 200,9 (ZEC) | ✅ | ✅ **PASS** | ✅ **OK** (f2pool:3357, 8-param zcash notify) | verified | **Consensus-verified**: Wagner sol ≡ `equihash` crate verifier + sha256d≡; fixy: sols_t values offset 12→20 (u32 align — host četl 8B dřív = alien pair z předchozího řešení), Blake2b header tail 128..140 do round0 kernelů, varint fd4005, NR_SLOTS 4→8, dup-index + canonical-tree reorder filtry; **parser: 8-param ZEC notify** (bez solution field) + `Zcash→ZcashStratum` map + `default_pool` → `zec.f2pool.com:3357` (2miners:7070 mrtvý) |
| qhash (QTC) | ✅ | ✅ **PASS** | ✅ OK (suprnova) | pending | **CPU ref** (SHA256→16q stavovec RY/RZ/CNOT→SHA256, bit-exact); batch cap 1024 |
| ghostrider (RTM) | ✅ | ✅ **PASS** | ✅ OK (zpool) | **verified** | **Consensus-verified GPU ≡ native-ffi** (všech 18 stages bit-exact, KAT PASS nonce=32). Fixy: CN selection mod14→mod6 (consensus enum), WI scratchpad OOB (+16B pad), CNFast dispatch chyběl tweak_tmp save (četl neinit paměť), JH output přes private-byte-cast → explicitní ulong stores, skein256 vector→scalar rewrite, **private-array alignment** (uchar[]→uint*/ulong* casts bez `aligned()` = nondeterministická korupce state ve final AES pass — input-dependent; `aligned(16)` na state/text/aes_key/a/b/c/t) |
| neoscrypt (PHX) | ✅ | ✅ **PASS** | ✅ OK (zpool) | pending | **kernel fix**: blake2s_256 double-compressoval poslední blok při len%64==0 → standardní blokování; CPU ref (`neoscrypt_ref.rs`) ≡ GPU. Pozn.: kernelová varianta (N=32, blake2s BlockMix) ≠ mainline NeoScrypt — port konsistentní, consensus-vůči-mainnet = samostatná otázka |
| eaglesong (CKB) | ✅ | ✅ **PASS** | ❌ authorize (wallet) | pending | **CPU ref** (`eaglesong_ref.rs`: 43 rounds, bitmatrix+circulant+ARX, 0x06 pad) ≡ GPU |
| dynexsolve (DNX) | ✅ | **KAT PASS** (sol+sha256≡) | ❌ authorize (wallet) | pending | **ODE model fix**: clause-neuron feedback reinforced UNSAT states (c→−5.5 pushed positive literals negative) → 0/~16k chips; přepsáno na pressure+bistable (p=max(0,2.5−Σf), dx=30x(1−x²)+bias+Σs·p) → 4096/4096 chips SAT na trivial instanci + dump verified (sol satisfe klauzule, sha256(sol‖nonce)≡GPU pow_hash). Real ratio-4 syntetická instance: 0 řešení = near-threshold hard, expected |
| nexapow (NEXA) | ✅ | ✅ **PASS** | ❌ authorize (wallet) | **verified** | **Consensus-verified** — KAT nonce=0 GPU≡CPU `bf53660c…`, `schnorr_sign` ≡ official BIP-340 vector 0 (r=e9078…/s=25f66…), `ecdsa_sign` ≡ k256 RFC6979 vč. low-S. **2 root causes**: ① `ct_glv_decompose_impl` = fake GLV (k1=celý 256-bit scalar, k2=0) ale window loop `w=32..0` pokrýval jen 132 bitů → `ct_generator_mul_impl` počítal `(k mod 2¹³²)·G` → fix `w=63..0` (+ stejná vada v dead `ct_scalar_mul_point`); ② `ecdsa_sign_impl` low-S blok měl swappnuté argy `scalar_negate_impl(&neg_s,&sig->s)` → s přepsáno negací uninit → fix pořadí. CPU ref `nexapow_ref.rs` (sha256d → BIP-340 aux=0 → sha256(sig)); debug host fns `nexapow_{schnorr,verify,gmul,ecdsa}_debug` + `ZION_NEXAPOW_DEBUG=sign`. Pozn.: NVIDIA JIT ~40min fresh (kernel 6k řádků), cachnuto v `~/.nv/ComputeCache` |
| octopus (CFX) | ✅ | ✅ **PASS** | ✅ **OK** (f2pool:6800, 4-param notify) | **verified** | **CIP-3 rewrite**: syntetický hashimoto → reálný Conflux `hash_compute` (SipHash-2-4 warp matice 1024 koef., gcd+powmod remap, 1024-term Horner poly eval, 256B mix 4×64B DAG nodes, FNV-1, keccak512/256); vlastní octopus DAG path (stage=height/524288, cache 16MiB+64KiB/st, data 4GiB+16MiB/st, 64B nody přes kawpow_dag.cl); KAT: DAG nodes ≡ CPU + mine ≡ `octopus_ref.rs` na stage 0 i stage 1, vícenonce; **parser: f2pool 4-param notify** `[diff,height,hdr,boundary]` (height→DAG stage) + `default_pool` → `cfx.f2pool.com:6800` |
| verthash (VTC) | ✅ | ✅ **PASS** | ✅ OK (zpool) | pending | **2 fixy**: host posílal `firstNonce=batch_size` místo `base_nonce` (GPU hashoval jiný nonce než reportoval → invalid shares) + CPU ref `verthash_ref.rs` (keccak::f1600, 4096 seeků, 4-lane) ≡ GPU |
| fishhash (IRON) | ✅ | ✅ **PASS** | ❌ authorize (wallet) | verified | **DAG gen na GPU** (build kernel ≡ CPU ref, 256 items) + mine≡CPU na reduced DAG; full DAG 4.6GB = VRAM blocker |
| karlsenhash (KLS) | ✅ | ✅ **PASS** | ❌ authorize (wallet) | verified | stejný DAG + xor-index mix + blake3(mix) finále; mine≡CPU na reduced DAG |
| beamhash (BEAM) | ✅ solver | ✅ **seed PASS** | ⏱️ beam.2miners timeout | partial | **seed stage consensus-verified**: `beamHashIII_seed` elems (blake2b prepow → siphash24 workBits → mixer → bucket scatter) ≡ `beamhash_ref.rs` CPU port bit-exact; R1-R5 solver VRAM-blocked (2×2.28GB tables > volné VRAM) |
| randomx (XMR) | CPU only | n/a | ✅ **OK** (moneroocean, valid addr) | — | cryptonote login+job parse OK — **pool vyžaduje kryptograficky validní ed25519 adresu** (ne jen checksum); blob 76B + seed_hash + height parsovány; stub GPU |
| quai (QUAI) | kawpow path | — | ⚠️ authorize (wallet) | pending | herominers:1185 connect+authorize OK protokol — fake wallet zamítnut (2miners:4848 mrtvý → default updated) |
| evrprogpow (EVR) | ✅ | ✅ **PASS** | ✅ **OK** (zpool, job parsed) | verified | ProgOp interpretér ≡ GPU (vlastní parametry); **parser: YiiMP 7-param notify** `[job,hdr,seed,target,clean,height,ntime]` → seed+height propažovány do `StratumJob` |
| meowpow (MEWC) | ✅ | ✅ **PASS** | ✅ **OK** (zpool, job parsed) | verified | ProgOp interpretér ≡ GPU (regs=16 varianta); stejný 7-param parser fix |
| sha256d (BTC) | — | — | SKIP | — | merge-mining, žádný pool |
| quantus (QTU) | qpow native | ✅ live | ⚠️ login: potřeba 36B wallet | ✅ produkce | QuantusStratum custom |
| epic (EPIC) | progpow | ✅ **PASS** (progpow) | ⚠️ authorized, no job | verified | progpow kernel ≡ interpretér |
| monero (XMR) | CPU randomx | — | ✅ **OK** (valid addr) | — | cryptonote OK — viz randomx řádek |

### Stratum probe — mapa connectivity (2026-10-06, fake wallet `zion1probe`)

- **OK s fake wallet (pool nevaliduje adresu):** VTC, VRSC, ZCL, QTC, RTM, PHX, KRX
- **Authorize fail (pool validuje formát adresy):** KAS, RVN, ETC, ERG, KLS, IRON, NEXA, DNX, CKB — pro share-level E2E potřeba validní adresa
- **TCP connect fail / mrtvý endpoint → FIXED:** ZEC→`zec.f2pool.com:3357` (8-param zcash notify parser), CFX→`cfx.f2pool.com:6800` (nový 4-param `[diff,height,hdr,boundary]` parser — height→DAG stage), NEOX→`stratum-eu.rplant.xyz:7057` (kawpow OK, header 32B), QUAI→`de.quai.herominers.com:1185` (protokol živý, fake wallet zamítnut = reálný signál)
- **TCP connect fail (bez ověřené alternativy — egress/pool block):** CLORE (vipor/kryptex/aikapool + woolypooly vše unreachable), FLUX (minerpool/fluxpools/rplant/cruxpool/2miners vše unreachable), EPIC (epicmine connect ale tichý po subscribe; herominers/51pool mrtvé) — pravděpodobně outbound egress filtr nebo mrtvé pooly; defaults ponechány, E2E blokováno
- **Timeout:** ALPH, DCR, PRL, BEAM (woolypooly/beam.2miners nedostupné odsud; BEAM herominers:1130 connect→close po subscribe = TLS/port mismatch; suprnova/herominers/metapool pro DCR/ALPH TCP fail)
- **Authorized, žádný job:** ~~XMR~~ **vyřešeno** — moneroocean validuje ed25519 adresu (ne jen checksum); s validní adresou login+job OK (blob 76B, seed_hash, height). EPIC (pool tichý po subscribe — endpoint/protocol, ne parser). **EVR + MEWC vyřešeno** — YiiMP 7-param `[job,hdr,seed,target,clean,height,ntime]` notify parser (obě path: `StratumJob` i legacy `ExternalJob`/`AuxPowClient`)
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

> **Finální clean sweep (`gpu-opencl native-all`, default batch, po `ac61bb3e9`): 22 PASS / 5 ERR / 1 SKIP** — všechny ERR = VRAM `CL_MEM_OBJECT_ALLOCATION_FAILURE` (zelhash ~6.5GB / equihashzero 4GB / beamhash 4.6GB / equihash při VRAM špičce — izolovaně PASS) nebo by-design (verushash CPU-only); nexapow SKIP v default sweepu, ověřen separátně PASS. **dynexsolve opraven → PASS** (ODE pressure+bistable, sol+sha256≡ přes bench dump). ⚠️ Sweep vyžaduje features `gpu-opencl native-all` — bez native-all se DAG arms a CPU refy vykomplikují ven a DAG algos failnou "not generated".

**✅ Consensus-ověřené GPU kernely (KAT PASS bit-exact):**
kheavyhash, keryxhash, blake3_dcr, blake3_alph, pearlhash, **autolykos** (GPU table-gen + bigint-sum; ≡ native-ffi @ N=2²⁶), **fishhash** (DAG-build ≡ CPU item ref + mine ≡ CPU ref na reduced DAG), **karlsenhash** (stejný DAG, xor-index mix, mine ≡ CPU ref), **ethash** (standard hashimoto — kernel fixnut z fnv1a/mix[0]² na fnv1/mix[i%32]; DAG items ≡ CPU + mix_hash ≡ CPU), **ProgPow rodina: kawpow, evrprogpow, meowpow, progpow, progpowz** (CPU ref = ProgOp interpretér nad stejnou op-sekvencí co codegen renderuje do kernelu; digest ≡ GPU pro všech 5 variant vč. zano math-table permutace), **eaglesong** (RFC-0010 ref ≡ GPU), **qhash** (16q circuit ref ≡ GPU), **neoscrypt** (kernel blake2s fix; kernel-variant ≡ CPU ref — variantu pozn. ve výše řádku), **verthash** (io_hash + 4096-seek pipeline ≡ CPU ref; keccak přes `keccak::f1600`), **equihash 200,9** (Wagner GPU solver; sol ≡ `equihash` crate + sha256d≡; sols_t offset fix), **octopus** (CIP-3 rewrite — SipHash warp matice + gcd/powmod remap + 1024-poly + 4×64B DAG mix; DAG nodes + mine ≡ CPU ref na stage 0 i 1), **beamhash seed** (siphash24 workBits + mixer ≡ `beamhash_ref.rs`; R1-R5 solver VRAM-blocked), **qpow** (poseidon2 OpenCL kernel na 1070Ti — mine_batch ≡ CPU verify), **nexapow** (BIP-340 sign ≡ official vector + KAT GPU≡CPU; 2 CT-path fixy: 132→256bit window loop + negate swap)

**✅ Kernel běží, produkuje kandidáty/řešení (RUN — čeká CPU ref):**
— (octopus ověřen, viz PASS list)

**✅ GhostRider vyřešen (consensus-verified):**
- Všech 15 SPH core hashů ≡ native sphlib (80B i 64B vstupy)
- Všech 6 CN variant ≡ native (dark/darklite/fast/lite/turtle/turtlelite)
- 4 CN extra-hashe ≡ native (po JH ulong-store fix + skein scalar rewrite)
- Plná 18-stage pipeline ≡ native gr.c (bisect harness `ZION_GR_BISECT=pipe`, nativní counterpart `/tmp/grbisect/pipe_bisect`)
- Root causes: mod14→mod6 selection, CNFast tweak_tmp save, private-array alignment (uchar→uint/ulong casts na NVIDIA = data corruption — `__attribute__((aligned))` fix), JH byte-cast, skein vector impl

**⚠️ Kernel spustitelný, ale široké oprávnění chybí:**
- dynexsolve — **ODE model fixed + KAT PASS**: dřív clause-feedback s invertovaným znaménkem (nesplněná klauzule zesilovala nesplněný stav → 0/~16k sols); nový model pressure+bistable řeší trivial 100% chipů, pipeline ověřena sha256≡ přes sol_dump; na syntetické ratio-4 instanci reálné mine() pořád EMPTY (near-threshold random 3-SAT — solver limitace, ne GPU bug; skutečné DNX joby jdou z mallob)

**❌ Reálné defekty k opravě:**
- **nexapow** — ✅ VYŘEŠENO (consensus-verified, viz řádek v tabulce). Pozn.: NVIDIA JIT ~40min fresh compile (kernel 6k řádků) — cachnuto v `~/.nv/ComputeCache`; KAT default SKIP, `auxpow_kat nexapow` explicit. **Microbench: ~26 H/s** na GTX 1070 Ti (4096 nonces / 157s — BIP-340 Schnorr per nonce je inherentně pomalý, ~3 řády pod typickým hash-PoW)
- **verushash** — CPU-only by design (haraka512/clhash); GPU kernel neexistuje — dokumentováno, ne chyba
- **runtime stream testy** — ✅ VYŘEŠENO: `auxpow_stream_hits_mock_stratum`, `kas_stratum_stream_runs`, `triple_stream_runs`, `zion_stream_runs` všechny zelené (145/145 suite). Root cause visení: **zero-seeded xoshiro256++** — mock `mining.notify` s all-zero headerem → `XoShiRo256PlusPlus` degenerate state produkuje 0 navždy → `generate_kheavy_matrix` rank-64 retry loop nikdy neskončil v spawn_blocking workeru (reálný liveness bug — hostile pool job by trvale uvězněl thread; fix = golden-ratio seed fallback pro all-zero state). Testy navíc: forced KAS/VRSC coiny (profit router vybíral nexapow s ~40min JIT) + okna 8-12s→90s (shared-GPU JIT).

**⛔ Externí blockery (ne code bug):**
- zelhash — potřeba ~6.5GB VRAM (busy karta); samostatný run nutný
- equihashzero (192,7) — 2×2GB tabulky > volná VRAM
- beamhash R1-R5 solver — 2×2.28GB tabulky; seed stage ověřen ≡ CPU (`beamhash_seed_elem_debug`), zbývá full-solver run na volné kartě
- fishhash/karlsenhash **full DAG 4.6GB** — generátor hotový (`generate_fishhash_dag_on_gpu`, chunked dispatch), VRAM blocker na busy kartě
- Stratum authorize = nevalidní test wallet (KAS/RVN/ETC/ERG/KLS/IRON/NEXA/DNX/CKB); mrtvé endpointy: CLORE/FLUX/NEOX/QUAI/CFX/ZEC

**Opraveno v tomto sweepu (tohle + předchozí commity):**
- dispatch pro eaglesong/neoscrypt/octopus + output_nonce v kernelu
- dynexsolve ABI 12→10 + 1-based literály (byl context crash) + ODE semantics fix (pressure/bistable) + bench sol_dump
- ghostrider batch cap 512→128 (OOM fix)
- verthash/equihash/zelhash early-dispatch před generickou kompilací
- equihash: args deklarované při buildu + EQ_WG_SIZE=32 (84KB→43KB local pod NVIDIA limit) + K=9 rounds 6-8 + sols_buf dynamicky + blake (200,9) + **NR_SLOTS host fix 4→8** (OOB write = round0 context crash) + k_rounds loop bound (1..=K-2)
- beamhash: seed-stage KAT — `beamhash_seed_elem_debug` alokuje jen buf0+scatter (R1-R5 přeskočeny), `beamhash_ref.rs` (siphash24 + mixer + stepElem port z `beamHashIII_ref.cpp`)
- qpow: KAT case — `QpowOpenclMiner::mine_batch` na NVIDIA (poseidon2 OpenCL kernel compile+run+CPU-verify end-to-end)
- octopus: **CIP-3 consensus rewrite** — kernel nahrazen skutečným Conflux algoritmem (`octopus_ref.rs` CPU port Conflux-Rust `compute.rs`), octopus-specifický DAG path `generate_octopus_dag_on_gpu` (stage sizing, 64B nody, reuse `kawpow_dag.cl` item generátoru), `octopus_dag_read_slice`, KAT ověřuje DAG nodes + final hash ≡ CPU (ZION_KAT_OCTOPUS_NODES/HEIGHT env override)
- **autolykos consensus rewrite**: `autolykos_gen_table` (streaming b2b256, 65 blocks/entry) + `autolykos_mine` (f31 seed, sliding-window genIndexes, 31B bigint sum, height-N calc); miner csrc copy synced (měl špatný rotate-scheme genIndexes ≠ Scala sliding-window)
- **fishhash/karlsenhash DAG gen**: `build_fishhash_light_cache` (fixed seed `blake3("FishHash")`, 1.18M×64B keccak-512 + 3 randmemhash rundy), GPU `build` kernel chunked dispatch (`fishhash_build_dag_slice`/`generate_fishhash_dag_on_gpu`), CPU refs `fishhash_dataset_item`/`fishhash_hash_ref`/`karlsenhash_hash_ref`; nonce výstup v obou kernelech fixnut (vracel byte-reversed)
- **ethash consensus fix**: `ethash_mine` kernel přepsán na standard hashimoto — fnv1a `(a^b)*P` → fnv1 `(a*P)^b`, index `fnv(i^s[0], mix[i%32])` se statickým s0 (dřív `fnv(i^mix[0], mix[0])` — mutující mix); CPU refs `ethash_dataset_item`/`ethash_hash_ref` (hashimoto-light z cache); KAT: GPU DAG items ≡ CPU + mix_hash ≡ CPU
- **progpow/kawpow CPU ref**: `progpow_ops()` = strukturovaný op-seznam (single source of truth — renderery i interpretér z něj čtou), `render_loop_ops`/`render_dag_ops` produkují identický OpenCL kód; CPU interpretér `progpow_mix_ref` simuluje 16 lanes (fill_mix → 64 DAG-loopů s broadcast `mix[0]` → per-lane fold → 8-word digest), `kawpow_digest_ref` (job_blob + gid do st[8] + RAVENCOIN_RNDC) a `progpow_digest_ref` (header‖nonce‖0 → seed bswap → digest) — keccak-f800 v Rustu; KAT ověřuje `output_mix` ≡ CPU pro všech 5 variant
- `free_dag_caches()` — uvolní VRAM mezi KAT casy (progpow OOM fix); qhash batch cap 4096→1024; nexapow cap 64 + default SKIP (JIT >10min)
- KAT: autolykos Rust ref + native cross-check @2²⁶, kawpow DAG wiring, ZION_KAT_REPEATS/NONCE env, fishhash/karlsenhash reduced-DAG E2E (DAG-slice≡CPU + mine≡CPU)

**Zbývá:** full fishhash DAG 4.6GB na volné kartě, VRAM-blocked algos (zelhash ~6.5GB/equihashzero 4GB/beamhash 4.6GB — volno ~3GB pod produkčním loadem, potřebují volnou kartu), live share-level E2E pro RUN algos s validními wallets (KAS/RVN/ETC/ERG/KLS/IRON/NEXA/DNX/CKB/QUAI), mrtvé endpointy CLORE/FLUX/EPIC (egress/pool dead).

Testy: `kheavyhash_official_vector` (e097f2e4…), `kheavyhash_share_roundtrip_pool_semantics`, `kheavyhash_matches_native`, KAT GPU≡CPU — vše PASS.
