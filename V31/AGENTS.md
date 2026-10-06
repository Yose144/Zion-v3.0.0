# AGENTS.md — V31 Mainnet Alpha

> **Působnost:** Tento soubor je určený pro Devina a operátory pracující s V31 Mainnet Alpha.
>
> **✅ 2026-10-06 SMOS MINER API ROZLUŠTĚNO — HASHRATE V DASHBOARDU (`09f681af9`, zip v3.4.14):** SMOS metriky se nespokojí s obecným cgminer JSON — přesný kontrakt vytěžen z `/root/utils/miner_api.sh` na rigu (exfil přes wrapper probe + Edge nginx access.log, probe po použití odstraněn): **branch `^teamredminer` (ř.~1154)** posílá `{"command":"devs+summary+devs2+summary2"}` přes `nc 127.0.0.1 4028` a parsuje **nested sekce per-command**: `hash=.summary.SUMMARY[]."KHS 30s"×1000`, `gpuHash=.devs.DEVS[]."KHS 30s"×1000`, `hash2/acc2/rej2/gpuHash2` analogicky z `.summary2`/`.devs2` (dualMine gate = `.summary2.SUMMARY != null`). Klíč **`"KHS 30s"` v KH/s** (ne `MHS av`!), `Accepted`/`Rejected` capital-A. DEVS pořadí = SMOS GPU sloty (PCI: GPU0=5600XT, GPU1=Vega). `MINER_NAME` = zip URL basename → `teamredminer-*` prefix povinný. Sidecar `smos_api.py` emituje kompletní MHS+KHS set per entry. **Live ověřeno:** `hash=47.9 MH/s` (QTU), `hash2=489 KH/s` (ZION), per-GPU h1/h2 správně per slot. Pozn.: agregát `hash2` jde z stream EMA (`zion.hashrate_hps` ~489K) zatímco `.devs2` ukazuje per-device 795K — drobná nekonzistence EMA vs instant, benign. **Beats diagnostika:** sidecar `api-beat` heartbeat na Edge access.log (req tag `d0-j1-m<MH>-q<q0>-<q1>-z<z0>-<z1>`, throttled 1/min) zůstal — jediný observability kanál pro polling. Per-GPU ZION dispatch: `ZION_QPOW_OCL_DEVICES=gfx900` = QPoW jen Vega; ZION `MultiGpuMiner` obě karty (`ZION_ZANO_RESERVE=0`), ale Vega skoro netěží ZION (QPoW saturuje) — z803-0/z802-0 v beats = 5600XT dělá ~800 KH/s, Vega ~0-5. Duty-cycle `ZION_EXT_GPU_TIME_DUTY_PCT` (sleep-based) nefunguje — fyzika sdílených CU; finální max config = QPoW dedikovaně Vega + ZION obě, duty=100.
>
> **✅ 2026-10-05 QPOW DUPLICATE-SHARE ROOT CAUSE FIX (DEPLOYED `08783ca49`):** dest-zion měl ~36% QTU rejectů, dominantně `duplicate share` — Edge journal ukázal identické `(job, nonce)` páry: vega-smos Accepted, dest-zion dup (a obráceně). Root cause v `runtime.rs::mine_v3_external_share`: GPU-ext nonce base = `parse_hex_u64(extranonce1_hex)` — upstream en1 je sdílené všemi V3 sessions na stejném jobu → všechny rigy skenují stejný low64 prostor ve stejném pořadí → první submitter vyhraje, ostatní jedou dup. Fix: `base = en1 ⊕-style wrapping_add(compute_gpu_ext_nonce_base)` — session salt (blake3 reward+worker+job+pid+counter+hostname) se míchá VŽDY, ne jen jako fallback při en1=0. Bonus: stale-job check (dřív jen CpuExternal/VRSC) teď i pro GpuExternal — share na rotate-nutém jobu se před submitem dropne, místo aby sbíral upstream `Invalid job id`. **Deploy:** dest-zion = atomic `cp+mv` do `APP&WEB/desktop-agent/resources/zion-miner` (agent auto-restartuje po SIGTERM, code≠0 → failover respawn); vega-smos = docker bullseye build LOKÁLNĚ (archive.debian.org — bullseye je EOL, `debian-security` suite je `bullseye-security` ne `bullseye/updates`; rsync exclude `archive` musí být anchored `/archive`, jinak chybí workspace member `V31/L1/archive/cosmic-harmony-v3`) → `/var/www/zion-miner/zion-miner-v31` (backup `.bak-pre-dupfix-20261005-202352`) → SMOS `/rigs/execute-command` wipe `custom_*` + `/rigs/execute-reload`. **Live ověřeno 12min:** dest-zion 50A/2R (jen stale racy), vega 33A/1R, 0 dupů; vega nonce prefixes per-session unikátní. Zbylé `Invalid job id`/`job not found` = nevyhnutelný race mezi nálezem share a upstream rotací jobu (~4%, normál).
>
> **✅ 2026-10-05 QPOW OPENCL NA AMD VEGA SMOS RIGU — DUAL ZION+QTU LIVE (`789d30e02` + `c79fc8faa` + `7d1dfecbb`):** Port `poseidon2_kernel.cu` → `csrc/opencl/poseidon2_kernel.cl` (Goldilocks u64/u32 carry aritmetika, 4+21+4+4 rundy, sparse inject, early-reject, `u32[9]` candidate buffer) + host `src/gpu/qpow_opencl.rs` (sdílí `pick_opencl_device` s ext minerem → `ZION_ZANO_DEVICE_NAME=vega` vybere gfx900; tuning `ZION_QPOW_OCL_LOCAL_SIZE`/`_NPT`; `ZION_STREAM2_BATCH` = launch size). Runtime `ZION_GPU_BACKEND=opencl` → `QpowGpuMiner` enum (CUDA/OpenCL). **Kritický bug:** `bswap32` maska `(v<<8)&0xFF000000` se ORovala s `(v<<24)` → nonce≠0 divergovala (nonce=0 prošla symetrií); fix `0x00FF0000` — pak bit-exact vs `qpow.rs` (hash±1 boundaries, carry boundary test). **SMOS deploy gotchas (DŮLEŽITÉ):** (1) rig 518837 patří do skupiny **1780844 "ZionTrinity"** (minerOptions `zion-trinity-smos-v10.zip` legacy), NE 1773590 "ZionLiteFire" — deploy script opraven. (2) **SMOS zip MUSÍ obsahovat složku** — naked `miner` soubor → `ls */` selže → restart loop "No folder found in ZIP". Formát: `zion-trinity-smos-v3.2.1/{miner,zion-miner}` (embedded binárka + wrapper; wrapper i tak curl-stáhne čerstvou z `/zion-miner/zion-miner-v31`). (3) Wrapper teď mapuje `ZION_*=V`/`RUST_*=V` tokeny z minerOptions do env před config defaults → tuning bez rebuildu zipu. **Build:** docker bullseye (glibc 2.31), `cargo build --release -p zion-miner --features gpu-opencl,native-hashers,native-cosmic-harmony,native-randomx,native-verushash,tui`, `CARGO_TARGET_DIR` absolute path (relativní cp selže), `RUSTFLAGS="-C target-cpu=x86-64"` (G4560 bez AVX). Deployed binary backup `/var/www/zion-miner/zion-miner-v31.bak-pre-qpow-20261005-190720`. **Live stav (Vega gfx900, LOCAL_SIZE=64 NPT=1 batch=4M):** QTU ~48–51 MH/s efektivní (~2.5–3 shares/min @ diff 1e9, k1pool vardiff občas bumpne na 2e9), ZION ~803 KH/s na gfx1010 netknuto, VRSC ~1.6 MH/s, ~99% accept (jen Invalid-job-id stale race), bloky 70294+ found. **Tuning matrix (share-rate @diff1e9, ~7min okna):** LS=64/NPT=1 ≈2.7/min, LS=256 ≈2.8/min, LS=64/NPT=2 ≈2.75/min — **flat, kernel je compute-bound na stropu gfx900** (~2× live rate 1070 Ti CUDA ~20–27 MH/s), defaults ponechány. QTU shares Accepted na k1pool. Rollback: group minerOptions zpět na `…/zion-trinity-smos-v10.zip` nebo `ZION_STREAM2_FORCE_COIN=ZANO` ve wrapperu + backup binárka.
>
> **✅ 2026-10-05 PER-SESSION AUXPOW COIN ROUTING — ZANO+QTU SOUČASNĚ (DEPLOYED `2fc502f78`):** V3 `Job` má jen jeden `external_stream` slot — `build_external_stream_gpu` vybíral první non-CPU coin z HashMapu (nondeterministicky) → po přepnutí poolu na QTU umřel GPU stream Vega rigu (stará v3.0.7 `qpow-poseidon2` neumí, 0 H/s). **Nově:** `enabled_coins` sortované podle tickeru; `build_external_stream(prefer, cpu, env_default)` vybírá session-pref → env default (`ZION_POOL_AUXPOW_COIN`/`_CPU_COIN`) → ticker order. `ZION_POOL_AUXPOW_GPU_COIN_ROUTE` / `_CPU_COIN_ROUTE` = `PATTERN=COIN,...` mapa (`*` glob, case-insensitive; matchuje worker tail, worker_name, miner_id, miner/worker) při Hello; `session_job_line` přepisuje broadcast per-session (initial replay, broadcasty, lagged resync — plain i TLS handler), preferovaný coin bez fresh jobu → `null` místo wrong-algo jobu. `CoinPreference` zpráva se reálně aplikuje na session (slotování podle coin class, ne fieldu). `JobFingerprint` nově obsahuje job-id všech coinů → rotace non-default coinu triggeruje broadcast. Miner posílá `CoinPreference` po Hello když je nastavený `ZION_STREAM{2,3}_FORCE_COIN`. **Edge deploy:** wt-main @ `2fc502f78` rebuild 7m13s, backup `zion-pool.bak-coinroute-20261005` (sha `688d5605…`), cp+mv swap, env: `WALLET_ZANO`+`POOL_ZANO=de.zano.herominers.com:1110` re-enabled, `GPU_COIN_ROUTE="vega-smos=ZANO"`, default zůstává `QTU`. **Live ověřeno:** `auxpow_runtime: 3 coins enabled`, ZANO bridge connected + job 3845871; rig po reconnect `v3_coin_route vega-smos gpu=Some("ZANO")` → ZANO share `Accepted` na herominers; dest-zion dál QTU `Accepted` na k1pool; VRSC netknuto. wt-main dirty-patch backup `/root/wt-main-dirty-20261005.patch` (obsah už commitnutý). Pozn.: pool restart shodí V3 sessions — stará binárka má pomalý backoff (~6 min u vega rigu), route se aplikuje na Hello.
>
> **⚠️ 2026-10-05 WATCHDOG PRIVATETMP BUG + SUBMIT_BLOCK CRIT-SECTION SHRINK + DASHBOARD DEADLINE (DEPLOYED):** Tři vzájemně se kryjící stabilizační fixy za jedním symptomem (recurring `getTemplate` wedge → stale ext joby → QTU `Invalid job id` / VRSC `job not found` rejecty). **(1) `watchdog.sh` multi-strike nikdy nerestartoval:** strike counter `/tmp/zion-wd-template-fails` byl za `PrivateTmp=yes` (per-invocation tmpfs namespace) → každý běh viděl čerstvý `/tmp` → věčně `fail 1/2` → wedge 2h+ trval. Fix: state na `/run/zion-watchdog/template-fails` (`/run` není namespacovaný). **(2) `submit_block` kritická sekce zmenšena (commit `1275007fa`):** po `dacaabd41` držela `utxo_set` přes storage put, 254K clone pro mempool revalidaci, mempool ops a template-cache clear → jakýkoliv pomalý await uvnitř zamrazil getTemplate/getUtxos pro všechny. Nově: stale-height prescreen před lockem (gossip fork spam se odbude bez utxo_set), mempool cleanup+revalidace+template-clear až PO `drop(set)` na post-apply snapshotu — atomicity potřebná jen pro tip-check→apply→commit zůstala. Deploy: wt-main rebuild 5m22s, cp+mv atomic swap (shared inode node1/2/3), rolling restart ×3. **(3) Dashboard `/api/pool/miners-dashboard` deadline:** `get_pool_registered_miners`/`enrich_miner_balances` volaly `getUtxos` per-adresu; `_rpc_with_fallback` zkouší 3 endpointy ×5s → ~15s/adresu → wedged node = endpoint visí 20s+ (timeout) a panel minerů prázdný. Nově 8s deadline na celý enrichment — balances se skipnou, zbytek se vykreslí. Deploy: app.py swap + `zion-edge-python-dashboard` restart → 200 za ~8s. **Lokální backup node vyléčen reorg healem:** fork `bca27336…`@68873 (1 blok hluboký) → `rolling back 1 block(s) to common ancestor h=68872` → canonical sync → tip identický s Edge. **Lokální node binárka MUSÍ být build z `V31/target` HEAD** — stará binárka (pre-`7210fe4df`) se na forku zasekne navždy, protože Edge banned map je per-IP in-memory (restart Edge ji smaže — peery se unbanují). CGNAT pozor: operátorova egress IP je per-flow (SSH refused ≠ box down — retryovat, porty 443/8444 fungují jako liveness sondu).
>
> **⚠️ 2026-10-04 SHALLOW REORG SELF-HEAL (DEPLOYED `7210fe4df`):** Same-height forky se teď hojí samy — `sync_peer` při divergence tipů projde walk-back přes `get_blocks(peer,h,h)` hash-compare k common ancestor (cap `MAX_REORG_DEPTH=64`, hlubší → warn + wipe runbook), `Node::rollback_to_height` odroluje fork suffix pod `utxo_set` lockem (`UtxoSet::unapply_block` = remove created outputs + restore spent z `tx_index`+block store — undo log není potřeba; admin-unlock efekty revertovány; necoinbase tx requeue do mempoolu po revalidaci), `Storage::delete_block` smaže tip blok + tx/output/address indexy + re-point `chain_state` na parent + invaliduje `native_utxo_cache_state` marker (další boot replay). Pak lineární sync připojí canonical větev. Live ověřeno 15:40 — followers reorg-probe běží (`reorg: ... rolling back 0 block(s) to common ancestor` + sync forward). Testy: `unapply_block_restores_spent_and_removes_created`, `rollback_restores_tip_and_accepts_competing_block` (341 lib zelených). Deploy stejný pattern: Edge rebuild 7m29s, cp+mv swap, rolling restart ×3 — žádná DB práce (followers už canonical). Snapshot-swap z předchozího entry zůstává runbook pro forky >64 bloků.
>
> **⚠️ 2026-10-04 SAME-HEIGHT TIP-REPLACE RACE — FOLLOWER FORK ROOT CAUSE (DEPLOYED `dacaabd41`):** Followers (node2/3) visely 818 bloků pozadu — jejich tip byl orphan blok na same-height forku, který lineární sync neumí přebít (žádný reorg; `p2p.rs` při `our_height >= peer_height` jen WARN). **Root cause:** TOCTOU race v `submit_block` — tip-height check a `storage.put` nebyly atomické; dva souběžné submity konkurenčních bloků stejné výšky (pool forwarduje shar(y) více workerů na jednom templatu) oba prošly checkem a druhý přes `INSERT OR REPLACE` (height je UNIQUE → SQLite REPLACE smaže konfliktující řádek) tiše přepsal tip. Vedlejší škoda: `apply` obou coinbasů → **phantom reward outputs v UTXO setu** (vč. persistované `native_utxo_cache`). **Fix:** celá kritická sekce submit_block pod `utxo_set` lockem — druhý submit uvidí nový tip a rejectne. Regression test `concurrent_same_height_submit_accepts_only_one` (339 lib testů zelených). **Deploy:** rebuild Edge (7m16s), cp+mv swap; **primary restartováno s vymazanými `native_utxo_cache*` tabulkami → replay rebuild 36.7s** (outputs=254617, phantom outputy vyčištěny — bez delete se phantom načte z cache zase). Followers: fork se nehojí sync-em → `sqlite3 .backup` snapshot z primary (415MB, online, bez downtime) → swap DB → boot replay ~4min (pomalý disk). Post-deploy: všechny 3 nody identický tip, live sync funguje (node2 accepted 69694 za ~3s po primary), 0 reject/diverge warns. Zbylé soubory k úklidu: `node{2,3}.db.forkbak`, `/tmp/node-snap*.db` (~1.2GB).
>
> **⚠️ 2026-10-04 NODE GETTEMPLATE WEDGE FIX + WATCHDOG MULTI-STRIKE (DEPLOYED):** Overnight restart-storm (~47× za noc): watchdog getTemplate probe (15s bound, přidaná lokálně na Edge 21:26, do té doby necommitnutá) restartovala node každých ~6-8 min. Wedge byl REÁLNÝ ale chronický — pool měl 200+ `getTemplate timed out` už před probes; root cause: `block_template` klonoval celý 254K-entry UTXO set per-call pod `utxo_set` lock → contention vs. block import, pool polluje ~1×/s. **Fix (commit `a67382404`, `core/src/node.rs`):** template cache servovaný MIMO `utxo_set` lock (opakované polly stejného minera → cached template); invalidace po každém `submit_block` (kryje gossip i sync); mempool revalidation po přijatém bloku zahazuje invalid txy. **Fix (`scripts/watchdog.sh`):** getTemplate probe vyžaduje **2 po sobě jdoucí 15s faile** (state `/tmp/zion-wd-template-fails`) — jeden transientní spike už nerestartuje. **Deploy gotcha:** `zion-v31-node2/3` followers sdílejí `/opt/zion/V31/target/release/zion-node` → obyčejný `cp` padá "Text file busy" i po stopu primary; použít `cp + mv` (atomický rename — běžící procesy drží starý inode, nový exec dostane nový binary). Rebuild na Edge z `wt-main` @ `a67382404` (11m26s, package je `zion-core`, binary `zion-node` — `-p zion-node` neexistuje). Post-deploy ověřeno: getTemplate p50 <1ms (cache hit), cold rebuild ~1s po novém bloku, QTU+VRSC bridgy běží, NRestarts=0.
>
> **⚠️ 2026-10-03 POOL DEPLOY PAST + GETTEMPLATE WEDGE + EXT TELEMETRIA (commit `2dfc3e52e`, DEPLOYED):** **Build past:** `zion-pool` se NESMÍ buildovat z `/opt/zion/V31` (Sept-1 checkout `d57f6b979` + dirty patche) — jeho `ExternalCoin` v `cosmic-harmony/profit.rs` **nemá `Quantus`** → build proběhne, ale `auxpow_runtime: 1 coins enabled` a QTU tiše umře (minerovi chybí stream2 joby). Správně buildovat ve **`/opt/zion/wt-main` @ `02d2a8f2e`** (nebo novějším worktree) a binárku atomicky přes `install`+`mv` nasadit do `/opt/zion/V31/target/release/zion-pool`. Backup před swapem povinný. **Node wedge (recurring, ~co 20 min):** node `getTemplate` se opakovaně zasekne (ostatní RPC žijí; pravděpodobně deadlock na `Storage.conn` = jeden globální `Mutex<rusqlite::Connection>` — kterýkoliv task držící conn přes blokující/dlouhý call zablokuje všechny storage calle). Pool-side mitigace deploynutá: `template_feed_loop` má **5s timeout na `getTemplate` + cache posledního template** → ext (AuxPoW) rotace se broadcastují i během L1 stallu, QTU přestalo dostávat `Invalid job id`. Pozor: cache se naplní až po prvním úspěšném template — po wedge bez něj loop dál skipne. **Watchdog rozšířen:** `/opt/zion/scripts/watchdog.sh` (v31 check) nově sondičkuje `getTemplate` s 15s bound → restart `zion-v31-node` při wedge (auto-recovery; wedge se sám nikdy neopraví, pozorováno 2h+). Backup `watchdog.sh.bak-20261003`. **Ext telemetrie:** ext share výsledky se nově zapisují přes `record_external_share` do coin-sdruženého `streams{}` bucketu (předtím `record_job_result` → vše pod "zion" + nulové hashrate vzorky ředily EMA). `/miners` i dashboard `/api/pool/miners-dashboard` (auth-exempt) nyní ukazují `{qtu,vrsc,zion}` per miner → Trinity panel viditelný. Live ověřeno: QTU `18890b9e` Accepted, VRSC Accepted, ZION accepted, vše přes desktop-agent miner (`zion1s6m…/dest-zion@g=zion`). **Node root-cause wedge = follow-up** — kandidát `submit_block`/`block_template` přes `utxo_set.lock()` vs storage conn serializace.
>
> **⚠️ 2026-10-03 QPOW CUDA LIVE NA 1070 Ti + KRITICKÝ FIX `next_job` (Stream 1 deadlock):** CUDA debug na rigu doběhl — `gpu-cuda` build (2m45s), NVRTC compile prošel **autodetekcí `compute_61`** (není třeba `ZION_CUDA_ARCH`), `gpu_qpow_cuda_init` + kernel launch OK, QPoW těží ~1,5–2,4 MH/s proti přímo forwardovanému upstream `target_hex` (diff ~1e9 → ~7 min/share; accepted share zatím čeká na náhodu). `shared_cuda_device` funguje — JEDEN CudaDevice pro Stream 1+2, VRAM 2184 MiB/proces, koexistence s llama OK. **KRITICKÝ BUG OPRAVEN:** `V3PoolClient::next_job` (`v3_pool_client.rs`) měl invertovanou watch sémantiku — `rx.changed()` při resolvnutí sám označí hodnotu seen → následný `has_changed()` vždy false → loop hltal každý publikovaný bundle bez návratu → **Stream 1 nikdy netěžil, každá session umřela na 60s job TTL, reconnect loop**. Postihovalo každého na nové binárce (regrese z watch refactoru mpsc→watch), ne jen QPoW; stará binárka (Sep-11) předchází refactoru a proto fungovala. Fix: po `changed()` číst `borrow()` přímo; `has_changed()` jen jako fast-path. Regresní test `next_job_returns_job_published_while_awaiting` (mock pool pošle 1 job do parknutého waiteru). Po fixu live: ZION stovky accepted sharů + 2 found blocky, QPoW 2+ MH/s, žádný reconnect. Vedlejší: `gpu_kernel_available("cuda")` zahrnuje Quantus (kosmetický WARN). Debug run: `ZION_STREAM2_FORCE_COIN=quantus ZION_GPU_BACKEND=cuda … --worker dest-zion-qpow --v3-trinity`, log `/tmp/qpow-debug-run4.log`.
>
> **⚠️ 2026-10-30 QUANTUS QPOW NA STREAM 2 (DEPLOYED):** Nativní Quantus integrace — bit-exact Poseidon2-Goldilocks (`qp-poseidon-core`, KAT `8e64e3d8…`), CPU fast-path + CUDA kernel (`miner/csrc/cuda/poseidon2_kernel.cu`, `gpu/qpow_cuda.rs`), U512 nonce/target/hash, strict `hash < target`, report `../QPOW.md`. **Edge `zion-v31-pool` přestavěn na Quantus upstream:** rebuild z `wt-main` @ `02d2a8f2e` (build na Edge 8m40s, backup `zion-pool.bak-…-pre-qpow`), `/etc/zion/edge-environment.sh` — `ZION_POOL_AUXPOW_COIN=QTU`, `ZION_POOL_AUXPOW_WALLET_QTU=<Kr_WALLET k1pool účtu>`, `ZION_POOL_AUXPOW_POOL_QTU=eu.quantus.k1pool.com:5660`; **ZANO vypnut** (jen 1 non-CPU coin smí mít bridge — `build_external_stream_gpu` iteruje HashMap nondeterministicky; re-enable = odkomentovat). VRSC CPU bridge beze změny. Env suffix je **QTU** (ticker), ne QUANTUS. k1pool vyžaduje registraci — login `Kr_WALLET.zion-pool`, `qz…` adresa je payout v accountu. Live ověřeno: login + job `18890552_3000000000` (diff 3e9). **Miner-side 2026-10-03 hotovo (GTX 1070 Ti):** kernel = port upstream `quantus-miner` engine-cuda G2 (`mining.cu`) — `__constant__` RC, inline-PTX carry, `reduce128`, sparse inject, early-reject po 1. squeeze, candidate-index results + CPU re-verify před submitem. Dispatch na sm_61: **1 nonce/thread, uncapped grid** (npt>1 je na Pascalu ~12 % pomalejší). Výkon: solo ~38–40 MH/s efektivní (upstream reference `quantus-miner benchmark --cuda-gpu` na stejné kartě 33.1 → jsme ~18 % nad), trinity live QTU ~20–27 MH/s + ZION ~1 MH/s současně. **QTU shares accepted na upstreamu** (k1pool, job `188908f9`…); občasný `Invalid job id` = stale race při rotaci jobů. Dva kritické fixy: (1) `V3PoolClient::next_job` watch-sémantika — `changed()` resolv ⇒ hodnota je už seen, `has_changed()` pak vždy false → Stream 1 netěžil a session umírala na 60s TTL (regrese watch refactoru); (2) `mine_auxpow_share_batch` po GPU `None` propadávalo na CPU scanner → po každých ~145 ms GPU práce 28 s CPU rescan 5.24M noncí (live metrika ~18 MH/s místo ~39) — nově živý QPoW CUDA backend vrací rovnou `NoAuxPoWSolution`. Desktop agent: nová binárka nasazena do `APP&WEB/desktop-agent/resources/zion-miner` (backup `zion-miner.bak-pre-g2-*`), v UI přidána volba `GPU: QTU` (gpuCoin=QTU → `ZION_STREAM2_FORCE_COIN=QTU`), nové config klíče `gpuStream2Batch`/`gpuExtGapMs`. `ZION_CUDA_ARCH` netřeba (autodetect compute_61). Kosmetika: `en1_trace … extranonce1 NOT set coin=QTU` WARN je benign — Quantus nese extranonce per-job, ne v subscribe.
>
> **2026-09-29 G8 EVIDENCE + NATIVE UTXO CACHE LIVE:** `zion-g8-probe.service` na Edge (`127.0.0.1:9105`) měří 3× native RPC, chain-tip age/live, pool HTTP+stratum, multichain, DAO a ZIS; Prometheus má job `zion_g8`, 5 alert rules, `40d/8GiB` retention, journald `40day/2G` a `zion-g8-evidence.timer`. Schema-v2 run odděluje časové okno od verdiktu a chybějící/stale vzorky počítá jako downtime; run #2 zatím **není spuštěn**. Node release `535e86830` (Edge SHA `4d025d4d…a395`, `/opt/zion/releases/535e86830/`) má tip-pinned `native_utxo_cache`, trusted replay pouze pro již přijaté DB bloky a duplicate-input guard; full live signature/HTLC validace zůstává. 337 lib testů + clippy clean; audit historie našel 0 duplicitních inputů. Rollout všude: node3 cold 111,2 s/warm 4,87 s, node2 114,3 s, primary 15,0 s, lokální backup 10,25 s; tipy/fund summaries/cache counts/SQLite integrity shodné. Node3 +1 Issobella UTXO drift byl replayem opraven. `getAdminUnlocks` nyní odpovídá na všech validátorech, `unlocked=[]`, žádný unlock nebyl broadcastován. Původní systemd `Requires=` kaskáda byla 2026-09-29 nahrazena `Wants=` u followerů/poolu/multichain bez restartu procesů; budoucí primary restart už tyto služby automaticky nezastaví. Kanonický checklist: `../V3.2checklistu.md`.
>
> **⚠️ 2026-09-29 L3 HIRANYAGARBHA LIVE (DEPLOYED):** Topologie: **LLM běží na operátorském PC (dest-zion, GTX 1070 Ti 8 GB, sdílí GPU s `zion-miner`)**, ne na Edge (Edge: 4 jádra, 7.8 GB RAM, bez swapu, bez GPU). (1) Lokálně user unit `zion-hiran-llm` (`~/.config/systemd/user/`, template `V31/deploy/local/zion-hiran-llm.service`): llama.cpp **b11065 Vulkan** (sha256 `2e2af38e…fb8d`) + oficiální **Qwen3-1.7B-Q8_0** (Apache-2.0), `127.0.0.1:8002`, `--alias zion-l3`, `-c 4096 --parallel 1 -ngl 999`, thinking vypnutý (`--chat-template-kwargs '{"enable_thinking":false}'`), ~25 tok/s, VRAM celkem ~7.2 GB (strop 7590 MiB, aby miner měl rezervu; hashrate beze změny ~16.6 MH/s). Qwen3-4B se nevešel (-ngl 30 → 5 tok/s). **Fine-tuned Hiran v2.1–v2.3 GGUF na `/run/media/.../Recovered/Hiran` jsou kompletně vynulované (poškozená obnova) — nepoužitelné**; přežil jen `hiran_curriculum_v2.1.jsonl`. (2) Lokálně user unit `zion-hiran-tunnel` (template `V31/deploy/local/zion-hiran-tunnel.service`): `ssh -R 127.0.0.1:8002:127.0.0.1:8002` na Edge jako **`hirantunnel`** (system user, `nologin`, klíč `~/.ssh/zion-hiran-tunnel`; authorized_keys `restrict,port-forwarding,permitlisten="127.0.0.1:8002",permitopen="127.0.0.1:9"` — ověřeno: shell odmítnut, jiný -R port odmítnut, -L "administratively prohibited"). Linger zapnutý → obě služby startují po bootu. Edge sshd nově `ClientAliveInterval 60/CountMax 3` (`/etc/ssh/sshd_config.d/zz-zion-clientalive.conf`) aby mrtvý tunel neblokoval port. (3) Edge `zion-v31-ai-native.service` (`V31/deploy/systemd/`), binárka `/opt/zion/V31/target/release/zion-ai-native-api` (sha256 `ac64c131…657e`, build v `rust:1.97-bullseye` kontejneru lokálně — glibc 2.30; rollback = `deps/zion_ai_native_api-a4eb8e25f251f3ab`), `127.0.0.1:8001`, `MemoryMax=512M` (reálně ~15 MB), BM25 RAG nad kurátorovaným korpusem `/opt/zion/data/l3-rag-docs` (49 souborů: docs/3.2 bez HARD_RESET/SECURITY*, MiseAmenti, StatusV3, V33 plán+gap, L2contracts, WARP status). Autotune vypnutý (přepisoval system prompt výstupem modelu). E2E ověřeno: /chat → tunel → GPU za ~9 s. (4) **Veřejný `/api/ai-chat` JE LIVE přes RAG routu** (2026-09-29, web rebuild+rsync+restart `zion-website`, backup `.next.bak-20260929T051557Z-l3-ai-chat`): Next.js route volá `127.0.0.1:8001/chat` (L3 → BM25 RAG → tunel → GPU), akceptuje jen nedegradovanou odpověď (`source==null` + ne echo-prefix), jinak 503; GET probe vyžaduje zdraví 8001 i 8002. Dřívější nginx 503 gate odstraněn (backup `/root/zion-edge-download.conf.bak-*-aichat-ungate`), rate-limit zóny `zion_ai_chat` (6 r/min/IP) + `zion_ai_chat_global` (20 r/min) **zůstávají aktivní**. E2E ověřeno přes public URL. **Bug fix:** `zion-hiran-llm.service` měl `After=default.target` + `WantedBy=default.target` = boot ordering cycle → systemd zahodil start job tunelu a po rebootu tunel nenaběhl; opraveno (After odstraněn, repo i live). Kvalita: 1.7B dělá faktické chyby i s RAG — L3 je operátorský nástroj, ne zdroj pravdy. Pozn.: web `/api/ncl/*` nyní proxuje na živé 8001 (NCL scheduler je in-memory, bez fondů).
>
> **⚠️ 2026-09-25 DAO TREASURY LOCK TRUTH (DEPLOYED):** `zion-dao` `/api/dao/treasury` nyní vrací `chain_height`, `unlock_height`, `time_locked`, `admin_unlock_known`, `admin_unlocked`, `spendable`, `spendable_*` a `utxo_balance_*`. Live ověření po sjednocení validátorů 2026-09-29: height 63 047, UTXO 1.5B ZION, unlock 144 000, time-locked, `admin_unlock_known=true`, `admin_unlocked=false`, spendable 0. Fallback pro starý L1 bez `getAdminUnlocks` zůstává fail-closed (`admin_unlock_known=false`), nikdy jako odemčený. `treasury_sigs` jsou approval records, ne kryptografické podpisy/L1 execution. Backend backup: `/opt/zion/V31/target/release/zion-dao.bak-20260925T152109Z-dao-parliament`; 81 lib + 2 smoke testů pass. Hiran/consent/co-admin/144k registry nejsou tímto deployem aktivovány.
>
> **⚠️ 2026-09-21 RECONCILIATION ALERT EXCLUSIONS (DEPLOYED):** Reconciliation podporuje `excluded_assets` v `[reconciliation]` sekci `warp.toml` — deprecated/test assety (`base:tZION`, `base:tUSDT`, `base:tWETH`, `base:tSOL`) dál produkují report řádek s reálným diffem, ale `alert=false` + poznámka `excluded from alerting`, takže přestaly spamovat WARN log každých 5 minut a maskovat reálný drift. Matching: přesný `chain:ticker:contract` klíč nebo `chain:ticker` prefix pro všechny contract varianty. **Reálné assety zůstávají alertovat** — `zion-l1:ZION` (−20M pool reserve), `base:wZION` (+75.5 surplus), `base:WETH` (−33 gwei) jsou legitimní drift vyžadující operátorské řešení (sweep/funding/ledger cleanup), ne potlačení. **Plumbing fix:** `WarpConfig` (warp/config.rs) neměl `reconciliation` pole — `[reconciliation]` sekce se tiše ignorovala a `build_multichain_config` vždy hardcodoval defaulty; nyní se sekce parsuje a mapuje (`warp.reconciliation.clone()`). Deployed na Edge 2026-09-21 (`warpd` rebuild, backup `warpd.bak-20260921-recon`, config `/etc/zion/warp.toml`), live ověřeno přes `POST /v1/admin/reconciliation/trigger`. Testy: `reconciliation_excluded_assets_do_not_alert`, `excluded_assets_match_full_key_and_ticker_prefix`, `test_reconciliation_section_in_toml`, `test_reconciliation_defaults_when_section_missing`.
>
> **⚠️ 2026-09-21 SOLVENCY DEPOSIT-ADDRESS FIX (DEPLOYED):** `SolvencyGuard::evaluate` dříve četl on-chain balance **jen z hot walletu**, zatímco reconciliation sčítá hot wallet + funded deposit adresy → `/v1/admin/solvency` hlásilo insolvent i assety se skutečným backingem v deposit adresách (wZION: 220 on-chain vs 124.5 claims). Nyní `evaluate` sčítá `token_balance` přes stejnou množinu adres jako reconciliation (`load_funded_deposit_addresses`, 150ms pacing proti public-RPC limitům, chyby propagují fail-closed). Live ověřeno: `base:wZION` nově `solvent=true`. Zbývající `solvent=false` jsou reálné položky (ZION pool reserve, WETH/USDT dust, t* test tokeny). Backup `warpd.bak-20260921-solvency`. Test: `solvency_counts_funded_deposit_addresses`. Současně: Edge `warp.toml` Base RPC přepnuto z rate-limitovaného `mainnet.base.org` na `https://base-rpc.publicnode.com` (backup `warp.toml.bak-20260921-rpc`) kvůli opakovaným `TimeoutError` v reconciliation sweepech; `zion-bitcoind` byl nalezen čistě zastavený na 55.5 % IBD (height 765136) a restartován — IBD pokračuje.
>
> **⚠️ 2026-09-20 POOL TELEMETRY + MINER RECONNECT FIX (DEPLOYED):** `zion-pool` `/stats` dříve hlásilo `sessions:0`, `total_connections:0`, `port:0` — `PoolApi` mělo vlastní čítače odpojené od stratumu a `config.port` bylo hardcoded 0. Čítače jsou nyní sdílené `SessionCounters` na `Pool` (primary + extra porty + TLS listenery je sdílí), dekrement přes RAII `ActiveSessionGuard`, `port` se nastavuje z reálně bound adresy listeneru. Současně opraven **kritický miner reconnect bug**: `run_v3_trinity_session` joinulo stream tasky až PO `shutdown.changed()`, takže chyba streamu (dropped pool connection) se nikdy nepropagovala a miner hashtoval offline donekonečna (`reconnects=0`). Nyní supervize přes `tokio::select!` — první stream error ukončí session a outer loop rekonnektuje s backoffem (ověřeno live: pool restart → auto-reconnect za 3s, shares accepted). Deployed na Edge 2026-09-20 (build na Edge, glibc), backups `zion-pool.bak-20260920-telemetry`, `zion-miner.bak-20260920-reconnect`. Testy: `zion-pool` 169 pass (vč. `session_counters_track_connections`, `session_counters_shared_across_listeners`, `stats_payload_reports_shared_counters_and_port`), `zion-miner` 105 pass. Legacy `MinerRuntime::run` (ř. ~1241) má stejný latentní vzor — nefixováno, není aktivní cesta.
>
> **⚠️ 2026-09-20 WARP BTC-SWAP SAFETY HOLD:** Nginx veřejně proxyuje `/v1/*`, proto ZIS autentizace sama není dostatečná autorizace pro offer, který může zamknout reálná aktiva. Edge má `WARP_BTC_SWAP_ENABLED=0`; hardened `warpd` je nasazený (2026-09-20, backup `warpd.bak-20260920-hardening`) a vyžaduje `WARP_BTC_SWAP_OFFER_KEY` přes `X-Warp-Key` (live 503 fail-closed), fail-closed backend observations a watch-only import preflight. Flow se nesmí znovu zapnout pouhým nastavením env flagu. Před re-enable jsou povinné externí audit, server-side signed quote/pricing/approval, dedikovaný offer key mimo repo, dokončený bitcoind IBD/lokální backend, production WIF/network review a explicitně schválený capped pilot. Viz `../WarpBeta/STATUS.md` a `../WarpBeta/AUDIT_PREP.md`.

Tento soubor je provozní a bezpečnostní pravidla pro pracovní prostor `V31` — čistý Mainnet Alpha track v `/home/zionserver/2.9.6-main/V31/`. V31 cutover je dokončen a produkční Edge běží na V31; historická V3 data zůstávají v `archive/V3/` a `v3_compat` pro checkpoint sync. Veškerá nová mainnet-track vývojárna patří do `V31/`. Historická topologie a incidenty jsou v kořenovém `/home/zionserver/2.9.6-main/AGENTS.md`.

> **Update (2026-08-22):** **Public archive Linux build unblocked + CLI wallet send E2E.** `archive/DesktopAgentP3.0.6/scripts/prepare-rust-miner.js` používá per-platform feature matrix místo `full` aliasu (bez `gpu-metal` na Linuxu/Windowsu). `zion-miner` solo-node mining opraven: `getBlockTemplate` dostává `--wallet` reward address místo placeholderu `zion1miner`. CLI `zion node start` má `--soft-fork-activation-height`. `npm run build:linux` prochází a produkuje `zion-public-miner-v3.2.0-linux-x86_64.AppImage` a `.deb`. Lokální `zion wallet send` E2E úspěšně odeslal 0.1 ZION a `submitUtxoTransaction` vrátil `accepted=true` s `model=v31-native`.

Aktuální stav V31 (2026-08-07): workspace verze `3.1.0-beta`, protokol `zion-v3-node/3.1.0-alpha`. `cargo clippy --workspace` je čisté (pouze pre-existing warnings) a `cargo test --workspace` prochází (0 failures). `zion-core` používá kanonický `EkamDeeksha` PoW (v3.2: 512 KiB scratchpad, 2 passy, 128 random reads, 2 AES rounds), `zion-miner` ho mapuje na kanonický `ekam_deeksha` OpenCL/CUDA/Metal backend. V31 je nasazen na Edge (public RPC, pool, multichain, DAO, OASIS, dashboard, web, marketplace). Historická V3 validace zůstává v `v3_compat`. `zion-pool` má rate limiting reconnect stormu a payout confirmation sweep s UTXO fallback. `zion-miner` nyní běží ve triple-stream režimu (ZION + GPU/CPU AuxPoW), má `ZION_STREAM3_FORCE_COIN`, profit switching s 15% hysteresí a TUI/metriky. `zion-dao` runtime načítá/persistuje návrhy a hlasy, spouští L1 scanner a vystavuje HTTP API/metriky. Fáze B i C jsou kompletní z hlediska kódu a testů; Go/No-Go na reálném GPU/rigu zůstává pending. Dashboard UI/UX je V31-first a je nasazen na Edge (`zion-edge-python-dashboard` active on 0.0.0.0:8766, `/health` OK). V31 banner KPIs a V31 Production panel (metriky, live logy, embedovaný Grafana `v31-mainnet`) jsou integrovány do full dashboardu. Pool API/metrics port je 8080, Prometheus scrape a Grafana provisioning nasazeny. **V31 cutover proveden**: V3 služby (`zion-edge-node1/2`, `zion-edge-pool`, bridge, DAO, atomic-swap, DEX, WARP, OASIS, starý dashboard) zastaveny a maskovány; `zion-v31-node` osamostatněn od V3 a běží nezávisle na portu 9445. Edge registry v dashboardu nastavena V31-first, přidány `zion-v31-miner`, `zion-v31-dao`, `zion-v31-oasis`, Prometheus/Grafana/website/marketplace. Opraveny systemd unit mapy (z `zion-edge-miner.service` na `zion-v31-miner.service`), `_build_health_map`, `build_checklist`, `build_readiness_score` a `build_alerts` pro V31. V31 pool, multichain, DAO, OASIS, web, marketplace a dashboard běží, `/api/services` i `/api/readiness` vrací V31 služby jako `primary` (readiness 100 %).
>
> **Edge V31 (2026-08-11):** `zion-v31-node` (height 1617+, `getStatus` V31), `zion-v31-pool` (HTTP API `127.0.0.1:8080`), `zion-v31-dao` (`127.0.0.1:8456`), `zion-v31-multichain` (WARP `127.0.0.1:8453`), `zion-v31-oasis` jsou active. `zion-v31-miner` je na Edge zastaven (CPU-only server). Edge secrets zabezpečeny (`chmod 600`, API klíče přesunuty do env), operátorské IP whitelisted v `ufw`/`fail2ban`. `ANKR_API_KEY` je legacy pro starý V3 bridge — `zion-v31-multichain` ho nepotřebuje, běží na veřejných RPC endpointech; doporučeno odstranit z Edge env. Nginx `/api/dao` proxy opraven na `127.0.0.1:8456`; public RPC vrací V31 data.
>
> **⚠️ 2026-08-27 Edge CPU miner re-activation:** `zion-v31-miner` je znovu aktivní na Edge v CPU-only režimu. Služba běží jako `zion` user, `--pool 127.0.0.1:8444 --wallet ${ZION_MINER_WALLET} --worker ${ZION_MINER_WORKER} --threads 4 --no-gpu --no-cpu`, `ZION_GPU_BACKEND=cpu`, `Nice=10`, `CPUQuota=400%` (max 4 jádra, nezahlušuje ostatní služby). Aktuálně ~1.0–1.2 MH/s, `accept_rate=100%`. Peněženka a worker se nastavují v `/etc/zion/edge-environment.sh` (`ZION_MINER_WALLET`, `ZION_MINER_WORKER`). Systemd template: `V31/deploy/systemd/zion-v31-miner.service`. Použitá binárka: `/opt/zion/V31/target/release/zion-miner`.
>
> **⚠️ NATIVE TX/ADDRESS INDEX 2026-08-14 (LATEST):** `zion-core` storage (`V31/L1/core/src/storage.rs`) přidává 3 nové SQLite tabulky pro nativní V31 UTXO chain: `tx_index` (tx_hash → height, O(1) lookup — `Node::find_transaction` už neskenuje celý chain od tipu), `output_index` (tx_hash+output_index → address+amount, trvalý — na rozdíl od in-memory `UtxoSet`, který smaže výstup jakmile je utracen) a `address_tx_index` (address → tx history, PK `(address, tx_hash)` — bez `direction` v PK, aby se self-transfery nezdvojovaly). Index se plní automaticky v `Storage::put()` při každém novém bloku; existující DB bez indexu se jednorázově backfillnou při startu (`Node::new` volá `backfill_tx_index()` když `tx_index_is_empty()`, ~25s pro 4850 bloků). `rpc.rs::get_transaction`/`get_native_block` nyní vrací server-side resolvované `input_addresses`/`input_amounts` (žádný N+1 round-trip z exploreru), a `getTransactionHistory` má nativní V31 handler (`get_transaction_history_native`) s fallbackem na V3 account-model handler pro adresy bez nativní aktivity. **Root cause opraveného bugu:** explorer transaction list (`getRecentV3Transactions`) nikdy nevolal input-address enrichment (na rozdíl od `getBlock`), takže `inputs[].address` obsahovalo `previous_output` hash placeholder a `from` bylo prázdné pro transfer transakce — vypadalo to jako poškozená data, ale šlo o chybějící enrichment krok. **Deploy:** Rust toolchain nově nainstalován na Edge (`rustup`, `$HOME/.cargo/env`) — binárky `zion-node` se odteď buildují přímo na Edge (glibc 2.39, Ubuntu 24.04), NE lokálně (lokální dev stroj má glibc 2.43 / Ubuntu 26.04 → binárka by na Edge nešla spustit, `GLIBC_2.4x not found`). Zdroj pro build: `rsync V31/ → /root/build/V31/` na Edge, `cargo build --release --bin zion-node`. Nasazeno postupně node3 → node2 → node1 (atomic binary swap přes `mv`, běžící procesy nedotčeny do restartu), s DB zálohou (`sqlite3 .backup`) před každým krokem. Ověřeno: `PRAGMA integrity_check` OK na zálohách, žádné duplikáty v `getTransactionHistory`, `getTransaction`/`getBlockByHeight` vrací resolvované adresy, pool/website nedotčeny. Testy: 5 nových unit testů ve `storage.rs` (`put_indexes_tx_and_address_history`, `backfill_tx_index_rebuilds_from_scratch`, `address_tx_history_dedupes_self_transfers`), `cargo test --workspace` a `cargo clippy --workspace --all-targets` čisté (jen pre-existing warnings).

---

## 1. Působnost a zdroje pravdy

1. V31 je aktivní Mainnet Alpha workspace. Všechny nové funkce, refaktoringy a opravy mainnet-tracku jdou sem.
2. V3 zůstává produkční běh na Edge. Do V3 sahat jen pro kritické hotfixy.
3. Zdroje pravdy pro provoz: `/home/zionserver/2.9.6-main/StatusV3.md`, `/home/zionserver/2.9.6-main/docs/3.2/ROADMAP.md` (dlouhodobý roadmap), `/home/zionserver/2.9.6-main/V31/PLAN_TO_3.2.md` (plán na 3.2) a tento soubor.
4. Kořenový `/home/zionserver/2.9.6-main/AGENTS.md` obsahuje historickou topologii, incidenty 2026-07-19 a 2026-07-20 a detailní pokyny k `public/`. Používejte ho jako referenci; toto je zkrácená a V31-specifická verze.

---

## 2. Model síťové bezpečnosti

**Základní postoj: default-deny.** Veřejně dosažitelné musí být pouze:

- veřejný pool stratum (`62.171.141.136:8444`);
- SSH pro operátorské IP adresy;
- veřejné webové služby (dashboard, web) pouze pro operátorské IP adresy, pokud nejsou veřejným frontendem.

Vše ostatní je uzavřené za firewallem, proxované přes nginx s IP allowlistem, nebo vázané na `127.0.0.1`.

### 2.1 Obecná pravidla firewallu

- Na serveru `62.171.141.136` (Contabo, IPv6 `2a02:c207:2342:5821::1`) používej default-deny `ufw` nebo `nftables`.
- Input chain: `DROP` jako výchozí politika, pak explicitní `ALLOW` pro známé služby a zdroje.
- Nepoužívej `ACCEPT` pro RPC port `9445` z internetu — ten je lokální (`127.0.0.1:9445`) a veřejný přístup jde přes nginx na `rpc.zionterranova.com:8443` s operátorským allowlistem.
- WARP / multichain API (`warpd`) běží na `127.0.0.1:8453` (WARP routes) a `127.0.0.1:8454` (DEX `/v1/*` routes) — není veřejně dostupné. Veřejný přístup jde přes nginx `location /api/warp/` a `location /v1/` na `zionterranova.com`.
- P2P porty `8333`/`8334` jsou otevřené jen pro známé peery / bootstrap seznam. Pokud možno filtruj podle whitelisted peer IPs a používej `fail2ban` jail `zion-p2p` pro detekci port scanu / reconnect stormu.
- SSH autentizace výhradně přes klíč. Žádné root heslo. SSH běží na portech `22` a `2222`, IPv4 i IPv6. Port `22` a `2222` musí mít `AddressFamily any` a správné `ListenStream` v `systemd` drop-ins (`/etc/systemd/system/ssh.socket.d/`), aby nedošlo k IPv6-only situaci.
- `fail2ban` musí být aktivní se jménem `zion-p2p` (maxretry=50/10min, bantime=24h dle provozní zkušenosti) a s aktuálními `ignoreip`.
- `fail2ban` `sshd` jail (maxretry=3/10min, bantime=24h) musí mít v `ignoreip` všechny `OPERATOR_IPS` včetně IPv6 — jinak rychlé SSH připojení z Mac/auditu vyvolá 24h lockout.
- nginx TCP stream pro RPC (`rpc.zionterranova.com:8443` → `127.0.0.1:9445`) musí mít allowlist nad rámec reverse proxy.
- Dashboard (`dashboard.zionterranova.com`) a web (`zionterranova.com`) jsou za nginx; používejte Basic Auth nebo IP allowlist dle služby.

---

## 3. Seznam povolených operátorů (`OPERATOR_IPS`)

Následující IP adresy jsou definovány jako `OPERATOR_IPS`. Musí být trvale uloženy v `ignoreip` v `/etc/fail2ban/jail.d/zion-p2p.conf` a v `allow` pravidlech firewallu. Jakákoliv změna vývojářského / Mac IP musí být okamžitě promítnuta do obou míst.

```bash
OPERATOR_IPS=(
  109.81.31.210
  109.81.27.87
  109.81.89.176
  109.81.83.205
  109.81.81.86
  109.81.83.81     # added 2026-08-05 during Phase D E2E / Playwright work
  109.81.24.189    # Devin session 2026-08-22 (dashboard/nginx incident)
  46.135.81.225     # Devin session 2026-08-11
  2a00:11b1:10e2:af49:b90b:20ed:4eee:b48b/128  # Devin session IPv6 2026-08-11
  2a02:c207:2342:5821::1/64
  2a00:102b:5005:3217:ce28:aaff:fe46:f739/128  # Devin session IPv6 2026-08-27
  109.81.31.156     # added 2026-09-03 (dashboard 403 fix)
  109.81.31.171     # Devin session IPv4 2026-09-04
  2a00:102b:5005:5db3:7cca:8777:6e6c:4adf/128  # Devin session IPv6 2026-09-03
  2a00:102b:5005:5db3::/64                       # Devin session IPv6 prefix 2026-09-04
)
```

**Pravidla:**

- [ ] `ignoreip` v `/etc/fail2ban/jail.d/zion-p2p.conf` obsahuje všechny `OPERATOR_IPS`.
- [ ] `ignoreip` v `/etc/fail2ban/jail.d/zion-sshd.conf` obsahuje všechny `OPERATOR_IPS` (IPv4 i IPv6); jinak rychlé SSH audity spustí 24h ban.
- [ ] `ufw` / `nftables` `allow` pravidla obsahují všechny `OPERATOR_IPS` pro SSH, RPC/dash a další operátorské služby.
- [ ] IPv6 `2a02:c207:2342:5821::1/64` pokrývá lokální síť / loopbackové rozhraní serveru a IPv6 fallback.
- [ ] Pokud se Mac IP změní, upravte `ignoreip` dříve, než spustíte lokální backup node nebo pool test.
- [ ] Nastavení fail2ban a firewallu musí přežít reboot (`systemctl enable fail2ban`, persistované pravidla).

---

## 4. Portová matice V31

| Služba | Port / Adresa | Proces | Dostupnost | Poznámka |
|---|---|---|---|---|
| SSH | `22` / `2222` | `sshd` | **operator-only** | Klíčová autentizace, žádné root heslo, IPv4 + IPv6. |
| Node P2P (V31) | `0.0.0.0:8335` | `zion-node` | **known-peers** | V31 Edge primary; legacy/backup may use `8333/8334`. fail2ban hlídá scan. |
| Node RPC (V31) | `127.0.0.1:9445` | `zion-node` | **localhost-only** | Nikdy přímo veřejný. Pouze interní L2 služby. |
| RPC přes nginx | `rpc.zionterranova.com:8443` → `127.0.0.1:9445` | `nginx` (TCP stream) | **operator-only** | TCP proxy; zakončení na V31 node RPC `9445` (ne historickém `9443`). |
| RPC alternativa | `127.0.0.1:9445` | `zion-node` | **localhost-only** | Výhradně lokální; veřejně přístupný jen přes nginx `8443`. |
| Pool stratum | `62.171.141.136:8444` | `zion-pool` | **public** | Hlavní veřejná služba pro minery. |
| Pool HTTP API / Prometheus | `127.0.0.1:8080` | `zion-pool` | **localhost-only** | `/stats`, `/metrics`, `/miners`; veřejně pouze přes nginx/IP allowlist. |
| WARP API + DEX API | `127.0.0.1:8453` (WARP), `127.0.0.1:8454` (DEX `/v1/*`) | `zion-multichain` (`warpd`) | **local** | Bind z `--listen 127.0.0.1:8453` + config; DEX běží na portu WARP+1. Public jen přes nginx. |
| DAO API | `127.0.0.1:8456` | `zion-dao` | **local** | `/api/dao/*` nginx proxy sem; nikdy veřejně bez allowlistu. |
| Free World (L5) | `127.0.0.1:8095` | `zion-free-world` | **operator-only** | Scans coinbase for humanitarian output. systemd `zion-v31-free-world.service`. |
| Issobella (L6) | `127.0.0.1:8097` | `zion-issobella` | **operator-only** | Scans coinbase for Issobella output. systemd `zion-v31-issobella.service`. |
| Dashboard | `443` → `127.0.0.1:8766` | `nginx` → dashboard | **operator-only** | Basic Auth nebo IP allowlist. |
| Web | `443` | `nginx` | **public** / **maintenance** | Případně maintenance mód, pokud je web vypnutý. |

### 4.1 Dostupnost — legendy

- **public:** Služba je dostupná z internetu bez IP restrikcí (pool stratum) nebo s veřejným DNS.
- **operator-only:** Dostupná pouze z `OPERATOR_IPS`, případně přes VPN/ssh tunnel; jinak default-deny.
- **localhost-only:** Vázána na `127.0.0.1` nebo `::1`; není dosažitelná zvenčí. Pouze interní služby / nginx upstream.
- **known-peers:** P2P porty jsou technicky otevřené, ale komunikace se řídí whitelisted peery a bootstrap seznamem; od neznámých zdrojů mohou být REJECT/DROP.

### 4.2 Nasazování nové služby

- Každá nová služba musí mít přiřazenou jednu z kategorií z tabulky.
- Default-deny: pokud není explicitně označená jako public/operator/localhost, považuj ji za zakázanou.
- Záznam o portu patří do tohoto souboru a do `StatusV3.md` (nebo `V31/STATUS.md`) při každé změně.

---

## 5. Nakládání s taji a citlivými daty

Nikdy nenahrávejte do repozitáře žádné tajné materiály.

### 5.1 Zakázané v commitech

- [ ] Mnemotechnické fráze, seed phrase nebo HD wallet klíče.
- [ ] GPG soukromé klíče nebo hesla k GPG (`/tmp/zion_gpg/` zůstává mimo repo).
- [ ] Soubory `.env`, `environment.sh`, `*.env.local` s API klíči, hesly nebo RPC secrets.
- [ ] Serverová hesla, root hesla nebo VNC hesla.
- [ ] API klíče třetích stran (Etherscan, Basescan, Infura, Alchemy, apod.).
- [ ] SSH soukromé klíče nebo obsah `~/.ssh/`.
- [ ] Konfigurace s `rpc.zionterranova.com` credentials, pokud by obsahovaly secrets.

### 5.2 Povolené umístění secrets

- Používejte `EnvironmentFile=` v systemd service files.
- Cesty pro systemd `EnvironmentFile`:
  - `/etc/zion/V31/*.env` nebo `/etc/zion/config/*.env`
  - `~/.zion/V31/*.env`
- Práva: `chmod 600` pro všechny `.env` a `*.sh` obsahující secrets.
- Vlastník: `root:root` pro system services, `zionserver:zionserver` pro user services.
- Globální konfigurace projektu:
  - `/etc/zion/config/*.toml`
  - `~/.config/devin/`
- V kódu čtěte secrets výhradně z proměnných prostředí nebo systemd `EnvironmentFile`; nikdy je nehardcodujte.

### 5.3 `.gitignore` a audit

- Ujistěte se, že `/home/zionserver/2.9.6-main/V31/.gitignore` obsahuje `.env`, `*.env`, `*.key`, `*.pem`, `*.secret`, `*.p12`, `*.gpg`, `*.asc` (soukromé klíče).
- Před každým push do `public/` subtree proveďte audit, že neunikla žádná tajná data ani interní IP adresy kromě veřejně dokumentovaného RPC/pool.

---

## 6. Pravidla zálohování

Zálohy jsou nedílnou součástí bezpečnosti. Používejte kanonické skripty a pravidelně testujte obnovu.

### 6.1 Kanonické skripty

- `/home/zionserver/2.9.6-main/ZION_OS/infra/scripts/backup-edge.sh`
- `/home/zionserver/2.9.6-main/ZION_OS/infra/scripts/sync-edge-backups.sh`

Tyto skripty jsou autoritativní. Jakýkoliv nový V31 backup skript by měl být jejich odvozeninou nebo je nahradit explicitním rozhodnutím operátora.

### 6.2 SQLite zálohy

- [ ] Pro SQLite DBs vždy používejte `sqlite3 .backup` (ne jen kopii souboru s WAL).
- [ ] `.backup` vytvoří konzistentní snapshot i při aktivním WAL.
- [ ] Zálohujte i `-wal` a `-shm` soubory pouze jako sekundární opatření, primární je `.backup` výstup.
- [ ] Po záloze spusťte `PRAGMA integrity_check` na kopii.

### 6.3 Co zálohovat pro V31

- [ ] SQLite databáze L1 uzlu (chain state, mempool index, account store).
- [ ] SQLite databáze poolu (`pplns-state.db` a test DB).
- [ ] `peers.json` a konfigurace nodu.
- [ ] Multichain HTLC SQLite persistence a WARP state.
- [ ] Environment files z `/etc/zion/` a `~/.zion/`.
- [ ] `/etc/zion/config/*.toml`, `chains.toml`, V31 `Cargo.toml` a `config/`.
- [ ] Systemd service/timers, nginx site configs, fail2ban jail.d.
- [ ] Let’s Encrypt certifikáty (`/etc/letsencrypt/live` a `archive`).

### 6.4 Off-site sync a retence

- [ ] Po lokální záloze spusťte `rsync` off-site pomocí `/home/zionserver/2.9.6-main/ZION_OS/infra/scripts/sync-edge-backups.sh`.
- [ ] Preferujte IPv6 fallback spojení (`ssh -6`) kvůli stabilitě při IPv4 banu.
- [ ] Edge retence: 14 denních + 4 týdenních; lokální retence: 30 denních + 8 týdenních.
- [ ] Zkontrolujte `tar tzf` a MD5/SHA256 kontrolní součty state souborů proti live Edge.

### 6.5 Test obnovy

- [ ] Alespoň jednou za 30 dní proveďte testovací restore na samostatný adresář / VM.
- [ ] Ověřte `PRAGMA integrity_check` na všech obnovených SQLite DB.
- [ ] Ověřte, že node startuje a dosahuje očekávané výšky bloku.
- [ ] Výsledek testu zaznamenejte do `/home/zionserver/2.9.6-main/StatusV3.md` nebo `V31/STATUS.md`.

---

## 7. Veřejný subtree `public/`

Kořenový adresář `/home/zionserver/2.9.6-main/public/` je git subtree repozitáře `github.com/Zion-TerraNova/v3-Mainnet` (MIT). Slouží pro publikování kódu, který je bezpečný pro veřejnost.

### 7.1 Pravidla pro `public/`

- [ ] Nikdy nepushujte tajnosti: žádné private keys, mnemonics, hesla, interní IP kromě veřejného `62.171.141.136:8444` a `rpc.zionterranova.com:8443`.
- [ ] Nepushujte cesty jako `/home/zionserver/2.9.6-main/` nebo osobní adresáře do `public/`.
- [ ] Nepushujte deploy konfigurace, systemd env files, nginx configs, fail2ban jails.
- [ ] Po každé změně v `V31/` kódu nebo dokumentaci, která se dotýká MIT-safe částí, proveďte subtree sync.
- [ ] Postup:
  1. Commit do `origin` (private) včetně změn v `V31/`.
  2. `git subtree push --prefix=public public main`
  3. Ověřte, že public commit obsahuje pouze MIT-safe soubory.

### 7.2 Co je MIT-safe pro V31

- Kód `V31/` (L1 core, L2 multichain, pool, miner, DAO skeleton).
- Dokumentace, whitepaper, LICENSE, README.
- `Cargo.toml` a build skripty bez secrets.
- Public contract addresses a RPC endpoint, které jsou určeny k publikování.

Co **není** MIT-safe:
- Konfigurace serveru, deploy runbooky s interními cestami, osobní IP adresy.
- Cokoliv v `ZION_OS/`, `edge-deploy/`, `scripts/` (kromě explicitně vybraných public build skriptů).

---

## 8. Bezpečnostní incidenty a ponaučení

Následující incidenty jsou shrnuty z kořenového `/home/zionserver/2.9.6-main/AGENTS.md`. Slouží jako ponaučení pro provoz V31.

### 8.1 Incident 2026-07-19 — SSH IPv6-only a fail2ban ban

**Průběh:**

- Po rebootu naslouchal `sshd` pouze na IPv6 (`[::]:2222`) kvůli chybnému `ssh.socket.d/override.conf` (`ListenStream=2222` bez explicitní IP → systemd `BindIPv6Only=ipv6-only`).
- IPv4 SSH vracel `Connection refused` a root heslo bylo ztraceno.
- Obnova probíhala přes Contabo panel reset root hesla, nalezení IPv6 `2a02:c207:2342:5821::1` přes `dig AAAA vmi3425821.contaboserver.net` a připojení `ssh -6 -p 2222 root@2a02:c207:2342:5821::1`.
- `override.conf` byl opraven na `0.0.0.0:2222` a `[::]:2222` a přidán `port22.conf` pro port `22`.
- Souběžně fail2ban jail `zion-p2p` (maxretry=50/10min, bantime=24h) zabanoval IPv4 `109.81.31.210` (Mac) kvůli rychlým P2P connect/disconnect lokálního backup nodu na porty `8333`/`8334`. Výsledek: REJECT na všechny porty pro IPv4 — SSH, web, RPC přestaly přes IPv4 fungovat; IPv6 fungovalo.

**Ponaučení:**

- [ ] SSH musí naslouchat explicitně na `0.0.0.0:2222` **a** `[::]:2222` v `ssh.socket.d/override.conf` a `port22.conf`.
- [ ] Žádné root heslo v rutinním provozu; pokud se resetuje, uložit do 1Password.
- [ ] `ignoreip` v `/etc/fail2ban/jail.d/zion-p2p.conf` musí být aktuální **před** spuštěním lokálního backup node.
- [ ] Při rychlém P2P reconnectu může fail2ban zabanovat IPv4 — vždy existuje fallback `ssh -6 -p 2222 root@2a02:c207:2342:5821::1`.
- [ ] Používejte klíčovou autentizaci a vypněte root password login v `/etc/ssh/sshd_config` (`PermitRootLogin prohibit-password` nebo `no`).

### 8.2 Incident 2026-07-20 — Chyba v block retention

**Průběh:**

- V `/home/zionserver/2.9.6-main/V3/L1/core/src/bin/node.rs:179` byla chyba:
  ```rust
  if config.block_retention > 0 { rt.set_block_retention(...) }
  ```
- Tento `> 0` guard přeskočil volání `set_block_retention(0)`, takže `ChainState` zůstal na defaultu `DEFAULT_BLOCK_RETENTION=1000`.
- Všechny uzly ořezávaly historii na posledních 1000 bloků i přes `ZION_BLOCK_RETENTION=0` v env.
- Oprava: odstraněn guard, volání `rt.set_block_retention(config.block_retention)` se provede vždy.
- Následek: bloky `0` až `~10913` byly trvale ztraceny, protože žádná záloha s plnou historií neexistovala. Od fixu (výška `~10914+`) se všechny bloky uchovávají.

**Ponaučení:**

- [ ] Nikdy nepředpokládejte, že `0` je neplatná hodnota pro konfiguraci; explicitně nastavujte vždy.
- [ ] Testujte defaulty: `cargo test` musí ověřit, že `block_retention=0` skutečně zakáže pruning.
- [ ] Env proměnná musí být propagována a ověřena logem při startu (`ZION_BLOCK_RETENTION=0`).
- [ ] Zálohy musí obsahovat plnou historii DB; po každé změně retention ověřte `PRAGMA page_count` a `PRAGMA freelist_count`.
- [ ] Před každým hard-forkem / mainnet resetem vytvořte cold zálohu a ověřte její integritu.

---

## 9. V31-specific coding rules

V31 je aktivní mainnet-track workspace. Tato pravidla zajišťují, že zůstane čistý, testovaný a bezpečný.

### 9.1 Workspace a přesměrování kódu

- [ ] Všechny nové funkce, refaktoringy a mainnet-track změny patří do `/home/zionserver/2.9.6-main/V31/`.
- [ ] V3 se neupravuje, pokud to není kritický hotfix pro produkční Edge.
- [ ] Pokud je potřeba backport z V31 do V3, vytvořte samostatný commit a dokumentujte důvod v `StatusV3.md`.
- [ ] Nepřidávejte žádné “náhodné” změny do `AuXpow/`, `ZionDex/`, `APP&WEB/`, `ZION_OS/` — pouze pokud je úkol explicitně zasáhne.

### 9.2 Testovací brána

- [ ] Před každým PR nebo merge do `V31/` spusťte `cargo test` přímo v `/home/zionserver/2.9.6-main/V31/`.
- [ ] Všechny workspace testy musí projít. Žádné `--ignored` skipnutí bez odůvodnění.
- [ ] Při změnách v `zion-core` ověřte `EkamDeeksha` unit testy (mine/verify + nonce-search stress) i integrační testy.
- [ ] Při změnách v `zion-pool` ověřte rate limiting reconnect stormu.
- [ ] Při změnách v `zion-miner` ověřte `ZION_STREAM3_FORCE_COIN` a disabled-coin chování.
- [ ] Při změnách v `zion-multichain` ověřte HTLC SQLite persistenci a ZionDex intent engine (`cargo test -p zion-multichain`, `cargo clippy -p zion-multichain`).

### 9.3 Závislosti a verze

- [ ] Nepřidávejte závislosti, které jsou mladší než 7 dní od vydání. Výjimka: bezpečnostní patch od důvěryhodného autora po explicitním schválení.
- [ ] Zakázány jsou plovoucí verzní rozsahy (`>= 0.1`, `*`, `~` mimo patch). Používejte přesné verze s lock file.
- [ ] `Cargo.lock` v `V31/` musí být commitnutý a validní. Po každé změně závislostí spusťte `cargo update` pouze pro konkrétní crate a ověřte diffové změny.
- [ ] Před nasazením nové závislosti proveďte audit `cargo audit` a `cargo tree` pro detekci duplicate / vulnerable crates.
- [ ] Rust edition a toolchain musí odpovídat `rust-toolchain.toml` nebo `V31/rust-toolchain` (pokud existuje).

### 9.4 Bezpečnost kódu

- [ ] Nenosťte secrets do zdrojáků; používejte proměnné prostředí.
- [ ] Všechny RPC endpointy a stratum message handling musí mít timeouty a rate limiting.
- [ ] P2P message validation musí být defenzivní — neočekávejte validní data od peerů.
- [ ] Kanonický `EkamDeeksha` PoW musí být otestován napříč reprezentativními výškami (stress nonce search); historická V3 validace zůstává pokrytá v `v3_compat` testech.
- [ ] Každá změna v `zion-dao` skeletonu musí být doplněna bezpečnostním review, než se zapne na mainnetu.

### 9.5 Dokumentace a status

- [ ] Při každé změně portu, RPC, nebo služby aktualizuj tento `V31/AGENTS.md` a `/home/zionserver/2.9.6-main/StatusV3.md`.
- [ ] Při každém incidentu založte záznam v kořenovém `AGENTS.md` nebo `StatusV3.md` a sem zkopírujte ponaučení.
- [ ] Všechny TODO a FIXME v kódu musí mít issue nebo `AGENTS.md` poznámku, aby nezůstávaly zapomenuty před Mainnet Alpha.

---

## 10. Kontrolní seznam pro operátory před nasazením V31

- [ ] Aktuální `OPERATOR_IPS` jsou v `ignoreip` a firewall allowlistu.
- [ ] `sshd` naslouchá na `0.0.0.0:22`, `0.0.0.0:2222`, `[::]:22`, `[::]:2222`.
- [ ] Root login zakázán / klíčový; root heslo uloženo v 1Password (pokud existuje).
- [ ] Node RPC `127.0.0.1:9445` není veřejně dosažitelný; nginx `8443` má IP allowlist.
- [ ] P2P porty `8333/8334` mají whitelisted peery a `fail2ban` `zion-p2p` jail.
- [ ] Pool stratum `8444` veřejný a funkční.
- [ ] `cargo test` prošlo v `/home/zionserver/2.9.6-main/V31/`.
- [ ] Zálohovací skripty `/home/zionserver/2.9.6-main/ZION_OS/infra/scripts/backup-edge.sh` a `sync-edge-backups.sh` jsou nastaveny a testovány.
- [ ] Žádné secrets nejsou v commitu; `public/` subtree audit proveden.
- [ ] Block retention je explicitně nastaveno a ověřeno logem při startu nodu.

---

## 11. Odkazy a zdroje pravdy

- Kořenový provozní soubor: `/home/zionserver/2.9.6-main/AGENTS.md`
- Status a topologie: `/home/zionserver/2.9.6-main/StatusV3.md`
- V31 workspace: `/home/zionserver/2.9.6-main/V31/`
- V3 produkční workspace: `/home/zionserver/2.9.6-main/V3/`
- Backup skripty: `/home/zionserver/2.9.6-main/ZION_OS/infra/scripts/backup-edge.sh`, `/home/zionserver/2.9.6-main/ZION_OS/infra/scripts/sync-edge-backups.sh`
- fail2ban config: `/etc/fail2ban/jail.d/zion-p2p.conf`
- SSH socket drop-ins: `/etc/systemd/system/ssh.socket.d/`
- Server: `62.171.141.136` (Contabo), IPv6 `2a02:c207:2342:5821::1`
- RPC: `rpc.zionterranova.com:8443` → `127.0.0.1:9445`
- Pool: `62.171.141.136:8444`

---

**Verze:** 2026-07-30 V31 Mainnet Alpha

## 12. Edge V31 deploy notes (2026-08-05)

- `V31/deploy/deploy-edge.sh` still references stale `zion-edge-*` units and an obsolete `--bin zion-bridge` target; manual deploy is currently more reliable.
- Working manual procedure:
  1. `rsync` local `V31/` to `/opt/zion` on the Edge.
  2. On Edge: `. /root/.cargo/env && cd /opt/zion/V31 && sed -i '/"cli",/d;/"smoke",/d' Cargo.toml` (these members are not needed on Edge).
  3. Build with `nohup cargo build -p zion-core -p zion-pool -p zion-miner -p zion-dao -p zion-multichain --release >/tmp/v31-build.log 2>&1 </dev/null &`.
  4. `chown -R zion:zion /opt/zion/V31/target/release` and `systemctl restart zion-v31-node zion-v31-multichain zion-v31-pool zion-v31-dao zion-v31-oasis`.
- For SSH to Edge, prefer IPv6 with `ControlMaster` + `ControlPersist` and `ServerAliveInterval` to avoid `Connection refused` from `fail2ban`/rate-limiting during rapid deploy commands:
  ```
  Host zion-v6
      HostName 2a02:c207:2342:5821::1
      User root
      Port 2222
      IdentityFile ~/.ssh/zion-edge-post-wipe-2026-07-29
      IdentitiesOnly yes
      ControlMaster auto
      ControlPath ~/.ssh/control-%r@%h:%p
      ControlPersist 10m
  ```
**Autorita:** Provozní pravidla pro Devin a operátory. Jakýkoliv rozpor s kořenovým `AGENTS.md` řešte aktualizací obou souborů; tento soubor má přednost pro V31, kořenový `AGENTS.md` pro historii a globální topologii.

---

## 13. DEX HTTP solver client, GPU OpenCL build a Desktop Agent V31 binaries (2026-08-06)

### 13.1 DEX off-chain solver network
- `HttpSolverClient` v `V31/L2/multichain/src/swap/dex/solver_network.rs` používá `reqwest` s timeoutem, posílá `SwapIntent` JSON na `{solver.url}/v1/swap/solve` a očekává `SolverBid` JSON.
- `204 No Content` = solver odmítl bid; HTTP/parse chyby se mapují na `MultichainError::Internal`.
- `V31/L2/multichain/src/server.rs` vystavuje:
  - `POST /v1/swap/solve` — solver strana, běží `DexRouter::quote`, vrací `SolverBid` s `PathHop` cestou (bridge hops `is_bridge=true`, AMM hops `dex: "amm"`).
  - `POST /v1/swap/intent/:id/broadcast` — buyer rozesílá pending intent všem registrovaným solverům a automaticky submitne vítězný bid.
- Env proměnné: `ZION_DEX_SOLVER_NAME`, `ZION_DEX_SOLVER_FEE_BPS`.
- Kanonické testy: `cargo test -p zion-multichain --test server -- http_solver_endpoint_returns_bid_for_valid_intent`, `cargo test -p zion-multichain --test solver_network_http`.

### 13.2 GPU miner build verification
- Build: `cargo build --release -p zion-miner --features auxpow,gpu-opencl,native-hashers,native-kheavyhash,native-blake3-algo,native-verushash` (`gpu-cuda` se automaticky povolí, když je `libnvrtc`).
- Lokální Go/No-Go: `cargo test -p zion-miner --features gpu-opencl --test gpu_opencl_detect -- --ignored --nocapture`.
- Výsledek na lokálním stroji (2026-08-06): **GO** — NVIDIA GeForce GTX 1070 Ti, Deeksha jádro zkompilováno a spuštěno, benchmark ~132 kh/s.

### 13.3 Desktop Agent V31 binaries
- Příprava: v `APP&WEB/desktop-agent/` spusť `npm run prepare:rust-miner` (volá `scripts/prepare-rust-miner.js --auto`); kopíruje V31 binárky do `APP&WEB/desktop-agent/resources/`.
- Test: `npm test`.
- Build Linux balíčků: `npm run build:linux` vytvoří `dist/zion-desktop-agent-v3.1.0-linux-x86_64.AppImage` a `dist/zion-desktop-agent-v3.1.0-linux-amd64.deb`.
- Pro jiné platformy viz `package.json` skripty (`build:win`, `build:mac`) a `.github/workflows/desktop-release.yml`.

### 13.4 Před každým nasazením těchto částí
- [ ] `cargo test --workspace` prochází.
- [ ] `cargo clippy --workspace -- -D warnings` je čisté.
- [ ] `cargo test -p zion-miner --features gpu-opencl` je zelené a `gpu_opencl_detect.rs` --ignored pass na cílovém GPU.
- [ ] `npm test` v `APP&WEB/desktop-agent/` je zelené.
- [ ] `npm run build:linux` vyprodukuje balíčky bez chyb.
- [ ] Binárky v `APP&WEB/desktop-agent/resources/` odpovídají V31 (`zion-miner --help`, `node --help`, `zion --help` vracejí V31 volby).
