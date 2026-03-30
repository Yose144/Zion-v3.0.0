# 🧭 ZION v2.9.5 — Roadmap až k MainNetu (DRAFT)

**Datum:** 2026-02-03  
**Scope:** Native Rust stack v `2.9.5/` (core + pool + universal miner + NCL + CHv3) + deploy obálky.

Toto je **náčrt**, opřený o rychlou kontrolu reálných souborů. Cíl: mít jednu „mapu cesty“ a seznam gapů, které si pak projdeme detailněji a rozpadneme na konkrétní issue/task list.

---

## 1) Co už reálně máme (inventory v2.9.5)

### Core node (Rust)
- Kód: `2.9.5/zion-native/core/`
- RPC router obsahuje i `/health`, `/metrics`, `/readiness`, `/liveness`: `2.9.5/zion-native/core/src/metrics/endpoints.rs`
- P2P seed discovery + hardcoded seedy: `2.9.5/zion-native/core/src/p2p/seeds.rs`

Poznámka: Entrypoint `2.9.5/zion-native/core/src/main.rs` má default porty sjednocené na `8444/8334` a umí je přepsat přes env (`ZION_RPC_PORT`, `ZION_P2P_PORT`, `ZION_DATA_DIR`, `ZION_P2P_SEEDS`).

### Pool (Rust)
- Kód: `2.9.5/zion-native/pool/`
- Pool API obsahuje `/health`, `/metrics`, `/stats`, a další endpointy: `2.9.5/zion-native/pool/src/main.rs`
- PPLNS + payout queue + metriky existují (indikace z kódu): `2.9.5/zion-native/pool/src/shares/processor.rs`, `2.9.5/zion-native/pool/src/metrics/prometheus.rs`
- VarDiff je konfigurovatelný env proměnnými: `2.9.5/zion-native/pool/src/vardiff.rs`

### Universal miner (Rust)
- Kód: `2.9.5/zion-universal-miner/`
- Má feature flagy pro GPU (`gpu`, `cuda`, `gpu-all`) a používá `zion-core` + `zion-cosmic-harmony-v3`: `2.9.5/zion-universal-miner/Cargo.toml`

### E2E testy / smoke
- Python E2E pro pool (HTTP + Stratum + volitelně NCL): `2.9.5/tests/e2e_native_pool_test.py`

### Production obálka (docker-compose + deploy)
- Compose pro core+pool+api+web+redis+nginx: `2.9.5/docker-compose.native-2.9.5.yml`
- Deploy skript na Hetzner: `2.9.5/deploy-native-2.9.5.sh`

---

## 2) Kritické gapy/rizika (z rychlé kontroly)

### P0 — Konfigurace/porty jsou dnes driftující (musí se sjednotit)

**Core (container vs binárka):**
- Dockerfile nastavuje env `ZION_RPC_PORT=8444`, `ZION_P2P_PORT=8334`, `ZION_DATA_DIR=/var/lib/zion/data`: `2.9.5/zion-native/Dockerfile.core`
- `2.9.5/zion-native/core/src/main.rs` tyto env proměnné **čte** (override po parsování CLI) a defaulty jsou sjednocené na `8444/8334`.

**Pool (compose vs Config::load):**
- Compose posílá kanonické `ZION_POOL_LISTEN`, `ZION_POOL_API`, `ZION_REDIS_URL`, `ZION_CORE_RPC=...`: `2.9.5/docker-compose.native-2.9.5.yml`
- Pool config čte kanonické proměnné a navíc má fallback na legacy (`ZION_LISTEN`, `ZION_API_LISTEN`, `REDIS_URL`, `POOL_FEE`, `POOL_MIN_PAYOUT`) pro kompatibilitu: `2.9.5/zion-native/pool/src/config.rs`

**E2E testy mají jiné default porty než compose:**
- E2E pool test defaultně míří na `13333/18181` (`DEFAULT_REGIONS`): `2.9.5/tests/e2e_native_pool_test.py`
- Compose používá `3333/8080` a core `8334/8444`: `2.9.5/docker-compose.native-2.9.5.yml`

➡️ MainNet roadmapa musí začít “sjednocením konfigurace + port matrix” jako absolutní P0, jinak budou deploye a testy nepredikovatelné.

### P0 — Konsensus/genesis/DAA jsou zjevně v „testnet/dev“ režimu
- `Algorithm::from_height` je fixně Cosmic Harmony a má TODO pro mainnet rotaci: `2.9.5/zion-native/core/src/blockchain/block.rs`
- Genesis blok je placeholder (timestamp=0, outputs prázdné): `2.9.5/zion-native/core/src/blockchain/block.rs`
- Difficulty/target model má v `consensus.rs` explicitní poznámku, že je zjednodušený pro E2E a pool-side normalizaci: `2.9.5/zion-native/core/src/blockchain/consensus.rs`

➡️ Pro MainNet musíme uzamknout chain params + provést „genesis rehearsal“ s deterministickým buildem.

### P1 — Síťová bezpečnost (P2P encryption, peer scoring, hardening)
- Seedy existují a discovery zkouší TCP connect: `2.9.5/zion-native/core/src/p2p/seeds.rs`
- Encryption/TLS/noise handshake není z téhle rychlé kontroly patrný.

### P1 — Payouty a wallet story
- Pool má PPLNS a payout queue, ale MainNet vyžaduje jasnou odpověď:
  - kdo a čím podepisuje výplaty (pool hot wallet / multisig / custody),
  - jak probíhá recovery a audit.

---

## 3) Roadmapa (milníky + exit criteria)

Níže je postup od „dnes“ až po MainNet. Doporučení: držet se gate/exit criteria a teprve pak dávat datum.

### M0 — „Reality Lock“ (1–3 dny)
Cíl: udělat z konfigurace a portů jednu pravdu.

Deliverables:
- [ ] Potvrdit kanonickou port-matrix a zapsat ji jako jediný zdroj pravdy: `docs/2.9.4/meta/PORT_MATRIX_TESTNET_v2.9.5.md`
- [ ] Sjednotit názvy env proměnných (core + pool + compose + e2e testy) a napsat tabulku „env → význam“
- [ ] Rozhodnout, jestli core/pool konfig bude primárně:
  - (A) `--cli args` (compose předává `command:`), nebo
  - (B) env vars, nebo
  - (C) config JSON/TOML soubor.

Exit criteria:
- `docker compose up -d` z `2.9.5/docker-compose.native-2.9.5.yml` projde healthchecky bez ručních zásahů.

### M1 — Konsensus & ekonomika “spec freeze” (1–2 týdny)
Cíl: jasně popsat a implementačně uzamknout pravidla, která nejdou později měnit bez forku.

Deliverables:
- [ ] MainNet chain params (chain_id/network_id, block time, DAA parametry, max block size)
- [ ] Emission model: base reward, consciousness bonus, tithe, pool fee pravidla
- [ ] Algoritmická politika (rotace vs fix; pokud rotace, definice podle height)
- [ ] Genesis definice (timestamp, initial difficulty/target, premine pravidla a způsob distribuce)

Exit criteria:
- Deterministické testy pro DAA/target/algo schedule + dokumentovaný “MainNet params” soubor.

### M2 — Core correctness & reorg suite (2–4 týdny)
Cíl: prokázat, že chain zvládá reorgy, rollbacky a edge-cases.

Deliverables:
- [ ] Reorg testy (forky, chain selection, rollback UTXO)
- [ ] Fuzzing/robustness pro parsing (template blob, JSON-RPC, P2P message framing)
- [ ] Snapshot/fast-sync návrh (minimálně: definovat, co je MVP pro MainNet)

Exit criteria:
- Simulovaný reorg v CI (nejen lokálně), bez ztráty konzistence.

### M3 — Pool public hardening (2–4 týdny)
Cíl: pool je vystavitelný na internet bez toho, aby byl triviálně zneužitelný.

Deliverables:
- [ ] Anti-spam pro Stratum (rate limits, invalid-share flood, dup shares, scanner traffic klasifikace)
- [ ] VarDiff tuning + metriky (accept/reject breakdown, latency)
- [ ] Jasná definice payout lifecycle (pending → sent → confirmed)

Exit criteria:
- 72h veřejný test s řízeným zatížením (např. stovky až tisíce minerů) bez degradace.

### M4 — Wallet MVP (2–6 týdnů, paralelně)
Cíl: MainNet bez minimální wallet story nejde.

Deliverables:
- [ ] CLI wallet: create/import/export, address validation, send, fee estimation
- [ ] Bezpečný key management + backup/recovery
- [ ] Integrace s core RPC (verze endpointů)

Exit criteria:
- End-to-end: vytvořím wallet → pošlu TX → potvrdí se → vidím balance.

### M5 — Observabilita & ops (1–3 týdny)
Cíl: provozní připravenost pro incidenty.

Deliverables:
- [ ] Prometheus/Grafana dashboardy (core + pool), alerting
- [ ] Backup/restore runbooky (DB, config, certy)
- [ ] Release proces (verze, changelog, migrace)

Exit criteria:
- On-call runbook + drill (restart, rollback, snapshot restore).

### M6 — Security audit prep + audit (čas dle scope)
Cíl: threat model + minimální externí audit nejkritičtějších částí.

Deliverables:
- [ ] Threat model (P2P, RPC, pool payout, wallet keys)
- [ ] Audit scope + remediation plán

Exit criteria:
- High/critical findings zavřené nebo s explicitní mitigací.

### M7 — MainNet Genesis Rehearsal (1 týden)
Cíl: nanečisto si projet MainNet launch jako proceduru.

Deliverables:
- [ ] Izolovaná síť se seed nody, genesis parametry finální
- [ ] Runbook: freeze → build → deploy → verify → Go/No-Go → rollback

Exit criteria:
- Rehearsal je opakovatelný a skriptovatelný.

### M8 — MainNet Launch
Cíl: řízené spuštění + postupné otevření.

Go/No-Go (minimum):
- [ ] Všechny P0/P1 věci z M0–M7 splněné
- [ ] Seed nodes běží ve 3 regionech
- [ ] Explorer/RPC endpointy stabilní
- [ ] Pool payout pipeline ověřená

---

## 4) Návrh „detailního průzkumu“ pro další iteraci

Až půjdeme do detailu, doporučuju společně projít tyhle bloky v tomto pořadí:
1) Config/port matrix: core + pool + compose + e2e testy
2) Genesis + ekonomika + algo schedule (co je dnes placeholder vs. hotové)
3) P2P hardening + reorg suite
4) Pool payout signing + wallet MVP
5) Release engineering + ops + security audit scope

