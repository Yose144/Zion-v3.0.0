# 📋 ZION TerraNova — TODO (Konsolidovaný po hloubkové analýze)

> **Aktualizace:** 3. března 2026 (Session 59+60 — Chain restart + oprava algoritmu + CHv4 komplexní implementace do minera; všechny uzly v konsenzu)  
> **Cíl:** L1 MainNet Genesis **31. 12. 2026**  
> **Scope analýzy:** všechny hlavní mainnet roadmapy + reporty + live server check přes SSH

---

## 0.0) Infrastruktura — Oprava Chain (2026-03-03) ✅ HOTOVO

- [x] Chain reset na všech 3 serverech (výška 0, nová genesis `0742cf6b...`)
- [x] Synchronizace `algorithms_opt.rs` (1203 ř.) + `algorithms_npu.rs` z lokálního workspace na Usa
- [x] Přestavba `zion-pool:2.9.7` ARM64 na Helsinki
- [x] Přestavba `zion-core:2.9.7-amd64` AMD64 na Usa, přenos na Asia
- [x] Přestavba `zion-miner:2.9.7-amd64` AMD64 na Usa, přenos na Asia
- [x] Oprava `--difficulty 1` (pool-miner diff mismatch) → shares accepted ✅
- [x] Všechny 3 uzly v konsenzu, chain roste, ~108 ZION payout pending

### Follow-up (nízká priorita)
- [ ] Zablokovat peer `193.201.105.84` na Helsinki (IBD spam ze starého řetězu)
- [ ] Zvýšit `--difficulty` na 8–16 po stabilizaci VarDiff (>10 bloků in a row)
- [ ] Přidat CI check: `wc -l algorithms_opt.rs == 1203` před deployment

---

## 0.1) CHv3 ASIC Hardening + AES-NI ✅ HOTOVO

- [x] Fork height `CHV3_MEMORY_HARD_FORK_HEIGHT = 100_000` — commit `8a2b295`
- [x] Scratchpad: 512 KiB / 4 průchody / 256 random reads — commit `8a2b295`
- [x] Dynamic XOR maska (data-dependent per-round) — commit `8a2b295`
- [x] Env overrides zakázány v `--release` buildu — commit `8a2b295`
- [x] AES-NI Haraka-inspired maska v `fusion_round()` (`aes = "0.8.4"`) — commit `c6189c4`
- [x] 52/52 unit testů v release buildu (10.5 H/s 1T / 70.3 H/s 12T) — commit `55a5b75`
- [x] Windows/MSVC build fix (haraka.c, VLA, SDK cesty) — commit `243e4b8`
- [x] `cargo check`: zion-core ✅ / zion-pool ✅ / zion-miner ✅ — commit `243e4b8`

## 0.2) 2.9.7 Code Freeze — otevřené P0 blokkery

### Lze udělat lokálně (kód)
- [x] **A-05** — `peers: null` OPRAVENO — `#[serde(rename="peers")]` v `core_metrics.rs` — commit `c521c38` ✅ 2026-03-01
- [x] **B-01** — on-chain time-lock VYNUCEN — `DAO_TREASURY_LOCK_HEIGHT = 525_600`, `is_transfer_allowed()` v `premine.rs` — commit `c521c38` ✅ 2026-03-01
- [x] **B-02** — algo rotace zdokumentována — CosmicHarmony only, komentář v `block.rs::Algorithm::from_height()` + sekce v `CODE_FREEZE.md` — commit `c521c38` ✅ 2026-03-01
- [x] **B-05** — Prometheus rules PŘIDÁNY — `CoreBlocksRejectedHigh` (>5% 10min) + `CoreBlocksRejectedSurge` (>10/min 3min) v `monitoring/prometheus/rules/alerts.yml` — commit `c521c38` ✅ 2026-03-01
- [x] **C-03** — `docs/2.9.7/GENESIS_CEREMONY.md` VYTVOŘEN — 7396 B, klíčový ceremony runbook ✅ 2026-03-01
- [x] **C-04** — `docs/2.9.7/GENESIS_MESSAGE.txt` FINALIZOVÁN ✅ 2026-03-01
- [x] **D-04** — `docs/2.9.7/API_ENDPOINTS.md` VYTVOŘEN — 13726 B, canonical source ✅ 2026-03-01
- [x] **D-05** — 168h stability window ✅ PASS 2026-03-03 11:48 UTC

### Potřebuje server / ceremonii
- [ ] **A-03/A-04** — Alertmanager Telegram tokeny nastavit na Helsinki + test-incident
- [ ] **C-01/C-02** — `genesis.json` OFFLINE vytvořit + ověřit adresy vs. `PREMINE_ADDRESSES_PUBLIC.txt`
- [ ] **D-01** — Docker SHA-256 manifest (Helsinki `docker inspect`)
- [x] **D-05** — 168h stability window ✅ PASS 2026-03-03 11:48 UTC
- [ ] **D-06/D-07** — `v2.9.7-freeze` tag + `CODE_FREEZE.md` podpis

### Phase 1 exit criteria (11/11 cíl)
- [x] 1.0–1.10: Všechny dokončeny vč. 168h stability PASS ✅ 2026-03-03
- [ ] **1.11** — Live partition test (server access — Helsinki node isolation 30min + reconnect)
- [ ] **1.12** — 100 miners stress test — `tests/stress_100_miners.py` ✅ VYTVOŘEN 2026-03-03

### B-CRIT (MainNet gate — blokující)
- [x] **B-CRIT-01** — CHv4 activation policy — `CHV4_NPU_FORK_HEIGHT=0` od genesis ✅ 2026-03-03
- [x] **B-CRIT-01b** — CHv4 E2E test — `tests/chv4_e2e.rs` 11/11 PASS ✅ 2026-03-03
- [x] **B-CRIT-01b** — CHv4 implementace do Rust minera (CUDA/OpenCL), Python minera, desktop agenta ✅ 2026-03-03 (commit `78a4cb3`)
- [ ] **B-CRIT-02** — Revenue production activation (prod wallets + buyback + 72h canary)
- [ ] **B-CRIT-03** — Genesis ceremony + freeze artifacts (genesis.json offline + podpisy)

### Revenue (implementováno, aktivace v 2.9.8)
- [x] `revenue_proxy.rs` 1869 ř. — StratumProtocol EthStratum/CryptoNoteStratum/ZcashStratum
- [x] `stream_scheduler.rs` — 50/25/25, PerMiner/TimeSplit
- [x] `profit_switcher.rs` — WhatToMine API, GPU detekce, hysteresis
- [x] `config/ch3_revenue_settings.json` v3.0.0 — 5 streamů
- [ ] Produkční aktivace: wallet adresy, BuyBack, Mysterium/NKN (→ **2.9.8**)

---

## 0) Co bylo při této analýze ověřeno

### Dokumenty (roadmapy / checklisty / reporty)
- `docs/MAINNET_ROADMAP_2026.md`
- `docs/MAINNET_READINESS-ROADMAP.md`
- `docs/MAINNET_PREFLIGHT_CHECKLIST.md`
- `docs/MAINNET_CHECKLIST.md`
- `docs/mainnet/MAINNET_CHECKLIST.md`
- `docs/mainnet/COMPLETE_ROADMAP_TO_MAINNET.md`
- `docs/ROADMAP.md`
- `docs/L1-L4_ROADMAP.md`
- `docs/MAINNET_LAUNCH_PLAN_v2.9.5.md`
- `docs/MAINNET_CONSTITUTION.md`
- `docs/mainnet/MAINNET_CONSTITUTION.md`
- `REPORT.md`
- `docs/REPORT.md`
- `docs/REPORT_SESSION_9-17_FEB_2026.md`
- `docs/AUDIT_SERVERS_2026-02-12.md`
- `docs/AUDIT_2026_02_16.md`
- `SERVERS.md`

### Live servery (SSH + runtime snapshot)
- ✅ Helsinki `77.42.31.72`
- ✅ SeedDE `46.225.126.243`
- ✅ Usa1 `5.78.178.227`
- ✅ Usa2 `178.156.240.160`
- ✅ Asia3 `5.223.43.93`

---

## 1) Live stav serverů (24. 2. 2026 — Session 50)

### Sítě / chain
- ✅ Všechny 3 aktivní nody běží — Helsinki, Usa, Asia
- 🟡 **168h stability test IN PROGRESS** — start `2026-02-24 11:48 UTC`, target `2026-03-03 11:48 UTC`
- ✅ Topologie uzavřena: **3 servery** (Helsinki EU + Usa US-East + Asia AP-Singapore)
- ✅ P2P mesh obnoven po Session 54 fix (Helsinki⇔Usa⇔Asia, height=5209 na všech)
- ⚠️ Helsinki: health endpoint vrací `peers: null` — JSON klíč `peers` možné přejmenován, zkontrolovat

### Runtime / kapacita
- ✅ **Helsinki RAM v pořádku**: 5.0/7.5 GiB (bylo 7.2/7.5, minery odstaveny)
- ✅ Usa/Asia: `zion-core:2.9.6-amd64` (nativní x86, opraveno Session 54)
- ~~SeedDE~~ / ~~Usa1~~: decommissioned

### Kontejnery
- **Helsinki** (77.42.31.72): `zion-bridge` ✅, `zion-website` ✅, `zion-core` (`zion-core:2.9.6-fix2` arm64), `zion-pool:2.9.6-testnet` ✅ (Docker, 3333+8080), `zion-mysterium`, `zion-nkn`, `zion-redis`, `zion-grafana`, `zion-prometheus`
- **Usa** (178.156.240.160): `zion-core:2.9.6-amd64` ✅, `zion-miner`, `zion-mysterium`, `zion-xmr-x86`
- **Asia** (5.223.43.93): `zion-core:2.9.6-amd64` ✅, `zion-miner`, `zion-mysterium`, `zion-xmr-x86`
- ~~SeedDE (46.225.126.243)~~ — decommissioned
- ~~Usa1 (5.78.178.227)~~ — decommissioned po stability testu

---

## 2.5) Hloubkový scan kódu — nová zjištění Session 50

### Implementace L1 (stav k 24. 2. 2026)
| Komponenta | Soubor | Stav |
|-----------|--------|------|
| Emise / decade decay | `reward.rs` | ✅ Hotové |
| Premine alokace | `premine.rs` | ✅ Hotové |
| LWMA DAA | `consensus.rs` | ✅ Hotové |
| Reorg / fork-choice | `reorg.rs` | ✅ Hotové |
| Block validation | `validation.rs` | ✅ Hotové (1 MB limit, coinbase maturity 100) |
| GPU miner | `L1/miner/` | ✅ OpenCL build funguje |
| Genesis blok | GENESIS_MESSAGE.txt | ⚠️ Placeholder — formální genesis.json **CHYBÍ** |
| On-chain time-lock | `premine.rs` | ⚠️ Pole existuje, není vynuceno v2.9.5 |
| Algoritmus rotace | `block.rs` | ⚠️ Zakomentována (testnet = jen CHv3) — rozhodnutí před mainnet |
| MAX_TIMESTAMP_DRIFT | `validation.rs` | ⚠️ Testnet 86400 s; mainnet musí být 7200 s (komentář v kódu) |
| mainnet_exit_criteria.md | — | ❌ **CHYBÍ** — P0 blocker |
| Double-spend test | — | ❌ **CHYBÍ** |
| Alertmanager routing | prometheus config | ❌ **CHYBÍ** |

### Constitution conflict — OPRAVENO (Session 50)
- ✅ `docs/MAINNET_CONSTITUTION.md` označen jako SUPERSEDED, ukazuje na kanonickou verzi
- ✅ `docs/mainnet/MAINNET_CONSTITUTION.md` označen jako autorit. verze + clarification o time-lock
- ✅ `docs/mainnet/MAINNET_CHECKLIST.md` aktualizován dle skenu kódu (v1.1)
- ✅ `SERVERS.md` aktualizován (Helsinki role: bridge+website+monitoring, bez minerů)



### A) Dokumentační drift (kritický)
- 🔴 Různé dokumenty uvádějí odlišnou readiness (`~65%` až `~92%`).
- 🔴 Dva constitution dokumenty mají konflikt v premine pravidlech (immediate unlock vs. část time-lock).
- 🔴 Starší roadmapy obsahují dnes neaktuální baseline (3 seed nody, staré test-county, staré P0 stavy).

### B) P0/P1 status drift
- ✅ Prakticky: 5 seed nodů jsou aktivní (live ověřeno).
- ⚠️ Formálně: některé checklisty stále vedou seed část jako pending nebo s historickými IP.
- ⚠️ Některé body označené dříve jako hotové nemají jednotný důkaz v jednom „master“ checklistu.

### C) Největší aktuální operační rizika
1. 🔴 Helsinki resource pressure (RAM/load) = riziko nestability.
2. 🟡 SeedDE pool/API nesoulad oproti očekávanému role modelu.
3. 🔴 Chybí jednoznačný, jednotný „source of truth“ pro MainNet freeze parametry.
4. 🔴 Premine/keys governance a history hygiene musí být explicitně uzavřené před dress rehearsal.

---

## 3) Priorita P0 (teď)

### P0-01 — Canonical MainNet Source of Truth
- ✅ Vybrán autoritativní dokument: `docs/mainnet/MAINNET_CONSTITUTION.md`
- ✅ `docs/MAINNET_CONSTITUTION.md` označen SUPERSEDED + popis konfliktu
- ✅ Clarification time-lock enforcement přidán do kanonické constitution
- ✅ Zamknuty hodnoty: reward model (reward.rs), premine rozdely (premine.rs), genesis hash policy
- [ ] Přidat sekci „Superseded docs“ do starších roadmap dokumentů (MAINNET_ROADMAP_2026.md, MAINNET_CHECKLIST.md redundance)

### P0-02 — Helsinki stabilita
- ✅ RAM mitigace provedena (těžbní kontejnery odstaveny, RAM 5.0/7.5 GiB)
- [ ] Alert na RAM > 90% + load > vCPU (Alertmanager **nenastaven — blokujíce**)
- [ ] Sledovat `zion-dero-miner` restart trend (SeedDE měl restart 24 minut před checkem)

### P0-03 — SeedDE role korekce
- ✅ SeedDE decommissioned — uzavřeno (Session 53+54)
- ✅ SERVERS.md aktualizován, SEED_PEERS opraven na všech nodech

### P0-04 — MainNet exit criteria evidence
- [ ] **Vytvořit `docs/mainnet/MAINNET_EXIT_CRITERIA.md`** (P0 blocker, chybí úplně)
- [ ] Formalizovat metriku orphan/reject rate v dashboardu
- [ ] Přidat datum+důkaz pro každý P0 bod

### P0-05 — Nové blokkery z Session 50+51 (code scan)
- [ ] **Genesis blok vytvořit OFFLINE** před mainnet (genesis.json/genesis.rs neexistuje) — _blokující_
- [ ] **Rozhodnout algoritmus rotaci** (zakomentovaná, testnet = jen CHv3) — dokumentovat nebo aktivovat _(odsunuto po dohodě)_
- [x] **MAX_TIMESTAMP_DRIFT** — ověřeno, automaticky per-network (86400 s testnet / 7200 s mainnet) v `network.rs`
- [x] **Block-level double-spend** — check přidán do `validation.rs` (step 9b) + test `test_double_spend_block_level_rejected` v `sprint_1_2_test_suite.rs`
- [x] **`MAINNET_EXIT_CRITERIA.md`** vytvořen — `docs/mainnet/MAINNET_EXIT_CRITERIA.md`
- [x] **Alertmanager** — aktivován v prometheus.yml, service přidán do docker-compose.monitoring.yml, config s Telegram routing vytvořen (`monitoring/alertmanager/alertmanager.yml`)
- [ ] **Alertmanager Telegram tokeny nastavit na serveru** a otestovat test-incident (env: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`)
- [x] **Pool Docker spuštěn na Helsinki** — `zion-rpc-redirect.service` (socat) vypnut; `zion-pool:2.9.6-testnet` běží jako Docker (3333+8080, `zion-net`)
- [ ] **Docker images SHA-256 published** (release flow chybí)
- [ ] **`MAINNET_CONSTITUTION.md` označit FROZEN** (SHA-256 hash v signatování)

---

## 4) Priorita P1 (do 2–4 týdnů)

### Bezpečnost / release
- [ ] Premine key ceremony runbook (air-gapped, dual backup, sign-off).
- [ ] Dokončit write-endpoint auth revizi napříč core/pool/dao (jednotný token model).
- [ ] Připravit externí audit package (scope, frozen commit, threat model).

### Infra / observabilita
- [ ] Alertmanager routing (Telegram/Slack) + test incident cesty.
- [ ] Height divergence alert mezi 5 nody.
- [ ] Standardizace firewall politik na všech uzlech.

### Kvalita / release engineering
- [ ] Reproducible build checklist + SHA256 publishing flow.
- [ ] Windows artifact verifikace v release pipeline.
- [ ] Jednotné release note šablony (core/pool/miner/web).

---

## 5) Priorita P2 (post-mainnet / paralelně)

- [ ] L2 bridge/DAO produkční hardening (audit + integration soak).
- [ ] L3/L4 milestones držet odděleně od L1 freeze tracku.
- [ ] Cleanup starých roadmap duplicit do archivu `docs/ARCHIVE/`.

---

## 6) Konkrétní akce na další 72 hodin

- [ ] **Dnes:** publish „MainNet Canonical Checklist v1.0" + označit superseded dokumenty.
- [ ] **Dnes:** Helsinki performance triage (RAM/load) + mitigace + záznam do `REPORT.md`.
- [ ] **Zítra:** SeedDE role fix + verifikace API dostupnosti podle cílové role.
- [ ] **Do 48h:** aktualizovat `SERVERS.md` o live role mapu (core/pool/revenue/monitoring) včetně důkazů.
- [ ] **Do 72h:** přidat orphan/reject trend panel + alert threshold + odkaz do checklistu.

---

## 7) Stav po této aktualizaci

- ✅ Deep analýza roadmap/report dokumentů provedena
- ✅ Live server snapshot ověřen přes SSH
- ✅ TODO sjednoceno na aktuální realitu (24. 2. 2026)
- ✅ Sjednocení portů napříč config/API/E2E/website dokončeno (`bc450ce`, push na `main`)
- ✅ Canonical port matrix přidána do `docs/mainnet/PORT_MATRIX.md`
- ✅ Helsinki RAM emergency mitigace provedena (těžební kontejnery na Helsinki odstaveny)
- ✅ **Session 50:** Hloubkový scan kódu (reward.rs, premine.rs, consensus.rs, reorg.rs, validation.rs)
- ✅ **Session 50:** Constitution conflict vyřešen — SUPERSEDED oznamení, kanonická verze označena
- ✅ **Session 50:** MAINNET_CHECKLIST.md aktualizován na v1.1 podle skenu kódu
- ✅ **Session 50:** SERVERS.md aktualizován (Helsinki nové kontejnery, role)
- ✅ **Session 51:** `MAINNET_EXIT_CRITERIA.md` vytvořen (P0-A)
- ✅ **Session 51:** Block-level double-spend check do `validation.rs` + test (P0-B)
- ✅ **Session 51:** Alertmanager aktivován + Telegram config vytvořen (P0-C)
- ✅ **Session 51:** `MAX_TIMESTAMP_DRIFT` ověřen jako automaticky per-network (P0-D)
- ✅ **Session 52:** Pool Docker fix Helsinki (zion-rpc-redirect.service vypnut, zion-pool:2.9.6-testnet spuštěn)
- ✅ **Session 53:** 3-server topologie uzavřena (Helsinki+Usa+Asia), SeedDE+Usa1 decommissioned, docs/2.9.7/ vytvořena
- ✅ **Session 54:** P2P fix — arm64→amd64 image na Usa+Asia, SEED_PEERS opraven na všech 3 nodech, Helsinki compose file
- ✅ **Session 54:** `docs/2.9.7/STABILITY_LOG.md` vytvořen, 168h test spuštěn `2026-02-24 11:48 UTC`
- ✅ **Session 54:** SERVERS.md SSH klíč opraven: `zion_servers_ed25519` → `zion_server_key`
- ✅ **Session 55:** AI Afterburner `ai/zion_ai_afterburner.py` (813 ř.) — GPU power monitoring, live H/W výpočet
- ✅ **Session 56:** CHv3 ASIC hardening (fork@100k, 512KiB/4/256, dynamic XOR, env lockout) — commit `8a2b295`
- ✅ **Session 56:** AES-NI Haraka mask v `fusion_round()` (aes=0.8.4) — commit `c6189c4`
- ✅ **Session 56:** 52/52 testů v release, benchmark 10.5 H/s (1T) / 70.3 H/s (12T) — commit `55a5b75`
- ✅ **Session 56:** Windows MSVC build fix (haraka.c, VLA, SDK auto-detect) — commit `243e4b8`
- ✅ **Session 57:** `docs/2.9.7/` aktualizovány — revenue IS implemented, B-06/07/08, Skupina E, CHANGELOG_2.9.7.md — commit `43322cf`
- ✅ **Session 57:** L4 Oasis architektura, changelog, README aktualizovány — commit pushnut
  - ✅ **Session 58 (2026-03-03):** 8 test failures opraveny (TxOutput.memo, fee validation, PoW order, genesis verify, addr checksum, env race, blob size) — 252 tests passing — commit `26d3807`
  - ✅ **Session 58:** A-05 `peers:null` DONE, B-01 time-lock DONE, B-02 algo rotace DONE, B-05 alerts DONE, C-03/C-04/D-04 DONE — TODO.md aktualizován
  - ✅ **Session 58:** 168h stability ✅ PASS (2026-03-03 11:48 UTC), STABILITY_LOG.md T+168h zapsán
  - ✅ **Session 58:** `tests/stress_100_miners.py` VYTVOŘEN — Phase 1.12 (100 simulovaných minerů)
- ✅ **Session 59–60:** CHv4 kompletní implementace do Rust minera (CUDA kernel přepsán, cuda.rs 16-arg, opencl.rs komentář), Python minera (v2.9.6 banner, CHv4/revenue konstanty) a desktop agenta (algo `cosmic_harmony`, CHv4/revenue konstanty) — commit `78a4cb3`
- ⏭️ **Další P0 (lokálně):** B-CRIT-01 ✅ DONE; Phase 1.12 výsledky zaznamenat; Metal GPU CHv4 port (TODO)
- ⏭️ **Další P0 (server):** 1.11 partition test, Alertmanager Telegram tokeny, genesis.json OFFLINE, Docker SHA-256, constitution FROZEN, v2.9.7-freeze tag
- ⏭️ **Hlavní MainNet gate:** B-CRIT-02 revenue wallets + B-CRIT-03 genesis ceremony
