# DOC vs CODE CHECKLIST — 2026-11-10

> Kanonický checklist „co dokumentace tvrdí vs. co kód/live skutečně obsahuje".
> Nahrazuje [`DOC_VS_CODE_ANALYSIS_2026-11-02.md`](DOC_VS_CODE_ANALYSIS_2026-11-02.md) (historický snapshot).
> Metoda: cílené grep/JSON sondy do repa + read-only SSH sondy na EDGE1 (`62.171.141.136`) a EDGE2 (`207.180.217.100`) jako root. Žádné restarty, deploye ani financial akce.
> **Kanony pravdy:** `docs/3.2/StatusV3.md` → `PLAN.md` / `ROADMAP.md` / `V31/README.md` → `V31/docs/**` → `docs/3.3/*-PLAN.md` (detail) → starší docs.

## 0. Update 2026-11-11 — edge sonda + payout monitoring M2 nasazeno

Živé sondy obou boxů + deploy trojvrstvé opravy (👤 schváleno). **Stav měření níže = po deployi.**

| Oblast | 10. 11. | 11. 11. (ověřeno) |
|---|---|---|
| Chain tip | 118 163 | **118 687** (~60 s/blok; 6/6 RPC portů shodná výška) |
| G8 run #7 | 99,916 %, 5 incidentů | **99,9241 %**, evidence 100 %, `pending`, **stále 5× `chain_live` 60 s** (poslední 9. 11. 16:38Z — ~35 h čistě), cíl 6. 12. 14:51Z |
| Disky | 62 % / 58 % | **62 %** (89/145 G) / **58 %** (112/193 G) |
| apt upgradable | 70 / 13 | **72 / 13** |
| EDGE1 node-exporter | M1 slepé (dead 31. 10.) | **active od 7. 11. 20:49**; `up{job="node",instance="edge1"}=1` — M1 ✅ |
| Pool binárka | `d786449b0-g8fix` | **`ece8b6965`** (HEAD; rebuild přes docker `rust:1.97-bullseye`, `ZION_GIT_SHA` embed OK; restart ~10 s, **G8 0 incidentů**; RSS 3,6→0,91 GiB) |
| Payout monitoring M2 | slepé (`payouts_api_ok=0`, age chybí) | **✅ LIVE:** probe+rules+pool API — `payouts_api_ok=1`, `measurement_ok=1`, `last_payout_age_seconds` reálná; `ZionPoolPayoutMeasurementMissing`+`ZionWritepathProbeStale` nahrány a jednou **firing→resolved** (end-to-end důkaz) |
| Failed units | EDGE2 `networkd-wait-online` | beze změny (kosmetický) |
| Public HTTPS | — | 10/10 endpointů 200; `/api/g8` = state file; nirvana proto 34 `proto_match:true` |

**Nové pravdy pro kanon:** ExecStart writepath probe = `/usr/local/sbin/zion-writepath-probe.py` (ne `/opt/zion/V31/deploy/monitoring/` — ta je jen repo kopie, synchronizována). G8 state file `/opt/zion/data/g8_run.json` žije na **EDGE1** (ne EDGE2). `latest_recorded_ts` vyžaduje pool ≥ `1ce5b5eb2` — starší pool = `measurement_ok 0` a alert **poctivě** hlásí. Docker build na EDGE1: cache mount na `/cargo`+`CARGO_HOME` (NE `/usr/local/cargo` — shadowne image cargo). Report: [`docs/3.2/REPORTS/REPORT_2026-11-11_PAYOUT_MONITORING.md`](../3.2/REPORTS/REPORT_2026-11-11_PAYOUT_MONITORING.md).

## 1. Verify matrix — doc claim vs. realita (ověřeno 10. 11.)

| # | Oblast | Doc claim (kanon) | Ověřeno v kódu / live | Stav |
|---|---|---|---|---|
| 1 | V31 stupeň | `3.2.0` Mainnet Beta, wire `zion-v3-node/3.1.0-alpha` | `V31/Cargo.toml` `version = "3.2.0"`; workspace 18 members | ✅ |
| 2 | V31 crates | 18 workspace members | `V31/Cargo.toml` — L1×7, L2×2, L3×3, L4/L5/L6, smoke, sdk, cli | ✅ |
| 3 | Pool schema | v13 (`height`=reward, `inclusion_height`=inclusion) | `V31/L1/pool/src/store.rs:41` `SCHEMA_VERSION: u32 = 13` | ✅ |
| 4 | OASIS roster | 202 avatarů / 714 questů | `V31/L4/oasis/data/avatars.json` = **202** entries | ✅ |
| 5 | Nirvana proto | `PROTO_VERSION` sdílený klient↔net | `apps/nirvana/src/core/net/protocol.ts:86` = **34**; live EDGE `/net/health` proto=**34** (build `20261110T181100Z`), app `/api/health` `proto_match:true` | ✅ (repo=live) |
| 6 | G8 aktivní run | run #7 `g8-20261106T145125Z`, cíl 6. 12. 14:51Z | `/data/zion/g8_run.json` na EDGE: `running`, uptime **99,916 %**, evidence 100 %, 5× `chain_live` 60 s | ✅ |
| 7 | G8 run #6 | archivován `stopped`/`evidence_incomplete` | `g8_run.g8-20261029T234617Z.json`: `stopped`, `gate_reason=stopped_before_window_end`, 99,7629 %, 12 incidentů | ✅ |
| 8 | Topologie | EDGE2 = primary+web, EDGE = pool+followeři+ops | Oba boxy SSH OK; EDGE1 10/10 `zion-*` active; EDGE2 všechny `zion-*` active; EDGE2 `systemd-networkd-wait-online` failed = kosmetický | ✅ |
| 9 | Chain tip | ~118k, block ~60 s | `getBlockByHeight` tip **118 163**, timestamp sampling ≈ 60 s/blok | ✅ |
| 10 | Pool API | `/public/v1/coins` živé | EDGE `:8080` coins list OK; stratum 8444 `mining.subscribe` → `set_difficulty`+`notify` | ✅ |
| 11 | Release artifacts 9.B4 | `dist/v3.2.0-rc-w1.4/` 5 tarballů z `aa6599cce` | Na disku: aarch64 (default+gpu-metal), linux (default+gpu-opencl), windows-gnu; **chybí** `RELEASE-MATRIX.json` (starší formát) + x86_64-apple-darwin | ⚠️ viz §3 |
| 12 | Monitoring rules | rule soubory v `V31/deploy/monitoring/` | 7 rule souborů (`g8`, `zion-host`, `zion-pool`, `zion_writepath`, `zis`, `warp_btc_swap`, `zion-hiran-alerts`) + prom/alertmanager configy + testy | ✅ |
| 13 | `service-snapshot.sh` | existuje pro rollback | `scripts/ops/service-snapshot.sh` ✅ | ✅ |
| 14 | Deploy projekty | `V31/deploy/` aktivní, `infra/edge-deploy/` deprecated | `infra/edge-deploy/DEPRECATED.md` + guard existuje | ✅ |
| 15 | i18n | `Lang` = 5 jazyků | `apps/MarketPlace/src/lib/translations.ts` (ext. `Lang`) | ✅ |

## 2. Nalezené drifty (opraveno v tomto commitu)

| Doc | Tvrdilo | Realita | Akce |
|---|---|---|---|
| `PLAN.md`, `NIRVANA-V3.3-CHECKLIST.md`, `NIRVANA-V3.3-MAP.md`, `NIRVANA-V3.3-UNIFICATION.md`, `3.2.1-3.2.9_PLAN.md`, `EDGE1_EDGE2_ANALYSIS.md` | G8 **run #6** aktivní, konec 28. 11. | run #6 zastaven 6. 11. (`evidence_incomplete`); aktivní **run #7** do 6. 12. | synchronizováno na run #7 |
| `StatusV3.md` (update 7. 11.) | „proto 32 repo/app/net ve shodě" | `PROTO_VERSION=34` (bumpy 33/34 z commitů 9.–10. 11.); live net+app na 34 | nový update block 10. 11. |
| `StatusV3.md` (update 7. 11.) | „0 incidentů" v run #7 | 5× `chain_live` 60 s (8.–9. 11.) | nový update block 10. 11. |
| `NIRVANA-V3.3-MAP.md` §6 | kotva „konec run #6 28. 11." | kotva = **konec run #7 6. 12. 14:51Z** | tabulka + kritická cesta přepsány |
| `MAP.md` §6 | „expirace certu auth. 25. 11." | renewal proběhl ~26. 10. (cert do 24./25. 1. 2027) | řádek anotován |

## 3. Otevřené body (ne opraveno — vyžadují rozhodnutí/vstup)

1. **G8 `chain_live` incidenty ×5 (8.–9. 11.)** — `G8ChainStale` firing→resolved do ~1–2 min. Block-timestamp sampling kolem výšek ~115 580–115 760 a ~116 580–116 700 **neprokázal** >900 s gap; trigger pravděpodobně probe-side (RPC stall na 4jáDrovém EDGE při ~230 % mining CPU) nebo krátký block gap. **RCA otevřená** — kandidáti: `G8_PROBE_TIMEOUT_SECONDS=3` pod zátěží, timeout na `getStatus`+`getBlockByHeight` ×3 nodů současně. Source: `g8_probe_exporter.py` (`chain_tip_max_age=900`, `confirm_attempts=2`).
2. **Release artifact x86_64-apple-darwin** — clang cross `x86_64-apple-darwin` na arm64 Macu **ověřen funkční** (Mach-O výstup, rustup target nainstalován), ale **Data volume 100 % plný** (~115–121 MB volno) → `cargo build --release` lokálně nemožný. Řešení: vyčištění disku / build na EDGE/clean hostu / Intel Mac. Postup: `scripts/ops/build-release-artifacts.sh --isolate --from-commit <sha> --target x86_64-apple-darwin`.
3. **`dist/` starší drafty nemají `RELEASE-MATRIX.json`** — `verify-release-artifacts.py` na `v3.2.0-rc-w1.4` = FAIL (chybí matrix). Při RC rebuildu (povinný z RC commitu) matrix vznikne automaticky.
4. **EDGE1 `apt list --upgradable` = 72, EDGE2 = 13** (11. 11.) — `unattended-upgrades` aktivní; majority upgrade = 👤 rozhodnutí (kernel/reboot okno).
5. **EDGE2 `systemd-networkd-wait-online` failed** od 6. 11. — kosmetický (služby běží), ale `systemctl --failed` není čisté.
6. **Nirvana deploy párování** — `PROTO_VERSION` je sdílený soubor; client (`zion-nirvana`) a services (`zion-nirvana-net`) musí deployovat **spolu**, jinak `proto_mismatch` odmítne handshake. Dnes nasazeno obojí (net `20261110T181100Z`, app `proto_match:true`).

## 4. Co zůstává z autonomní fronty (stav 11. 11.)

> **Z auditu 7. 11. uzavřeno 11. 11.:** M1 EDGE1 node-exporter (již 7. 11.) a **M2 payout monitoring** — probe+rules+pool rebuild `ece8b6965`, viz §0 a `REPORT_2026-11-11_PAYOUT_MONITORING.md`. Otevřené z reportu zůstávají: PII orderId, atomický sklad, release verifier, proto preflight, archive content root, G8 state fail-loud, Lumi hlediště.

| Položka | Stav | Poznámka |
|---|---|---|
| G8 run #7 PASS | 🔄 běží | 99,9241 % (11. 11.), 5×60 s incidentů, do 6. 12. |
| RC artifacts z RC commitu | ⏸️ | blokováno: žádný RC tag (👤 9.S1) + Mac disk |
| P0-3 env subsety + rotace | 🔀 | audit hotový (`P0-3-SHARED-ENV-AUDIT.md`), rotace = 👤 |
| ZionDex funded E2E | 🔀 | QuoterV2/solvency/AMM-gate ✅ 31. 10.; funded E2E = 👤 (§7 rozhodnutí) |
| ZIS agent sub-accounts | 🤖 design ✅ | implementace = follow-up (schema+API draft existují) |
| Miner↔NCL spike, Dharma filter, Amitabha UI | 🤖 | kód-only, mimo G8 deploy freeze |
| Charta R9 factual/legal review | 🤖 | částečně autonomní (factual), legal = 👤 |
| CoinGecko re-apply package | 🤖/🔀 | 17 prerekvizit, balíček připraven |

## 5. Pravidla platná pro další session

- **G8 okno (do 6. 12.):** nic nesmí zasáhnout required služby (`chain_live`, `pool_http`, `pool_stratum`, `multichain`, `dao`, `zis`) bez rollbacku do 15 min.
- **Deployy Nirvany:** client+net spolu (sdílený `PROTO_VERSION`).
- **Mac disk:** nekopírovat velké artefakty/buildy, dokud se neuvolní místo.
- **EDGE SSH:** ControlMaster/ControlPersist (fail2ban), `zion-v6` = IPv6 alias.
- **`/proc/*/environ` čtení:** jen allowlist klíčů.
- **`.bak` v `sites-enabled/`:** NIKDY — nginx include glob je načte.
