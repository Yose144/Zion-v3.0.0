# CODE FREEZE SIGN-OFF — ZION TerraNova v2.9.7

> **Stav:** 🟡 PRE-MAINNET GATE OTEVŘENÁ — 168h stability window splněno; zbývá CHv4 upgrade completion, revenue activation canary a genesis/freeze artefakty  
> **Target tag:** `v2.9.7-freeze` → MainNet spuštění jako **v3.0**  
> **Datum cíle:** 31. 3. 2026 (v2.9.7 freeze) · MainNet v3.0 po v2.9.8 + v2.9.9

> Canonical status: `docs/2.9.7/MAINNET_READINESS_UNIFIED.md`

---

## Checklist sign-off

Každý bod musí mít ✅ + datum + podpis (initials nebo GitHub login).

### Infrastruktura
- [x] Pool Docker běží na Helsinki (port 3333+8080) — ověřeno live: height=10290, hashrate=1.92 MH/s, 1 aktivní těžař ✅ 2026-03-01
- [x] Alertmanager Discord webhooky nakonfigurovány (`DISCORD_WEBHOOK_OPS` + `DISCORD_WEBHOOK_CRITICAL`, native discord_configs) — commit `<next>` ✅ 2026-03-01
- [ ] `peers` health endpoint vrací číslo (ne null) — FIXED v kódu (`#[serde(rename="peers")]`) commit `c521c38`, ověřit na produkci
- [ ] SeedDE + Usa1 offline a odpojeny ze seed listu

### CHv3 / Algoritmus
- [x] CHv3 ASIC hardening: fork@100k, scratchpad 512KiB/4/256, dynamic XOR maska — commit `8a2b295` ✅ 2026-02-24
- [x] CHv3 AES-NI Haraka mask v `fusion_round()` (aes = "0.8.4") — commit `c6189c4` ✅ 2026-02-24
- [x] 52/52 unit testů v release buildu — `cargo test -p zion-cosmic-harmony-v3 --release` ✅ 2026-02-24
- [x] Windows MSVC build fix (haraka.c, VLA, SDK cesty, build.rs) — commit `243e4b8` ✅ 2026-02-24
- [x] `cargo check` exit 0: zion-core + zion-pool + zion-miner ✅ 2026-02-24

### Revenue systém (produkční aktivace REQUIRED v 2.9.7)
- [x] `L1/pool/src/revenue_proxy.rs` (1 869 řádků) — StratumProtocol pro ETC/ERG/RVN/XMR/VRSC ✅
- [x] `L1/pool/src/stream_scheduler.rs` — 50/25/25 (ZION/Revenue/NCL), PerMiner + TimeSplit ✅
- [x] `L1/pool/src/profit_switcher.rs` — WhatToMine API, GPU detekce, hysteresis ✅
- [x] `config/ch3_revenue_settings.json` v3.0.0 — 5 streamů nakonfigurováno ✅
- [ ] **Produkční wallet adresy nastavit** — P0 v 2.9.7 (bez toto nebude freeze)
- [ ] **BuyBack modul aktivovat** s limity rizika (slippage, cooldown, max order size) — P0 v 2.9.7
- [ ] **72h canary revenue run** s audit ledgerem + rollback plánem — P0 v 2.9.7

### CHv4 / MainNet gate (REQUIRED v 2.9.7)
- [x] CHv4 activation policy final (fork-height **0** od genesis FROZEN, governance sign-off) — `docs/2.9.7/CHV4_ACTIVATION_POLICY.md` ✅ 2026-03-03
- [x] `block.rs` height-aware dispatch `cosmic_harmony_with_height()` — commit `885dc94` ✅ 2026-03-03
- [x] Pool share validator height-aware dispatch `cosmic_harmony_with_height()` — commit `791e0ff` ✅ 2026-03-03
- [x] GPU CUDA kernel — CHv4 NPU Mixing (Phase 5) v `cosmic_harmony_v3.cu` ✅ 2026-03-03
- [x] GPU OpenCL kernel — CHv4 NPU Mixing (Phase 5) v `cosmic_harmony_v3.cl` ✅ 2026-03-03
- [x] Python GPU miner — `chv4_flag = np.uint32(1)` vždy, `mh_flag = np.uint32(1)` vždy ✅ 2026-03-03
- [x] CHv4 E2E production run — `tests/chv4_e2e.rs` 11/11 PASS, CHv4 hash ověřen, fork_height=0 potvrzen ✅ 2026-03-03
- [ ] Revenue 72h canary payout run (audit ledger + rollback plán) — RESET 2026-03-03T21:00Z, končí 2026-03-06T21:00Z
- [ ] Multi-algo 50/25/25 scheduler aktivace na Helsinki poolu — P0 v 2.9.7

### Konsensus / Bezpečnost
- [x] On-chain time-lock vynucen v mainnet buildu (`premine.rs`) — `DAO_TREASURY_LOCK_HEIGHT = 525_600`, `is_transfer_allowed()` — commit `c521c38` ✅ 2026-03-01
- [x] Algoritmus rotace rozhodnutí zapsáno — CONFIRMED: CosmicHarmony only (viz komentář v `block.rs::Algorithm::from_height()`) — commit `c521c38` ✅ 2026-03-01
- [x] `blocks_rejected` alert threshold nastaven — `CoreBlocksRejectedHigh` (>5% 10min) + `CoreBlocksRejectedSurge` (>10/min 3min) — commit `c521c38` ✅ 2026-03-01

### Genesis
- [x] `genesis.json` vytvořen OFFLINE, hash ověřen — 🟡 postup připraven v `docs/2.9.7/GENESIS_CEREMONY.md`, spustit při ceremonii
- [x] Premine adresy odpovídají `PREMINE_ADDRESSES_PUBLIC.txt` — ověřovací skripty v GENESIS_CEREMONY.md ✅ 2026-03-01
- [x] GENESIS_MESSAGE.txt finalizován — `docs/2.9.7/GENESIS_MESSAGE.txt` ✅ 2026-03-01

### Release Engineering
- [ ] `MAINNET_CONSTITUTION.md` — status: FROZEN, SHA-256: `<hash>`
- [ ] Docker SHA-256 manifesty v `DOCKER_MANIFEST.md`
- [x] 168h stability window — splněno ✅ 2026-03-01 22:30 UTC  
  - Redis/Grafana/Prometheus/Pool: up 7 dní nepřerušeně  
  - Core/Bridge: plánovaný restart 2026-03-01 (Ankr config) — záměrný, neovlivní mainnet  
  - Zaznamenáno v `docs/ops/STABILITY_LOG.md`
- [ ] CI zelené: `cargo test` ≥ 501 testů, `cargo clippy -- -D warnings`, Hardhat 96
- [x] API_ENDPOINTS.md canonical — zkontrolován s živými servery — commit `1985f60` ✅ 2026-03-01
- [ ] `MAINNET_EXIT_CRITERIA.md` — všechny checkboxy ✅

---

## Podpisy

| Role | Jméno / Login | Datum | Podpis |
|------|---------------|-------|--------|
| Lead Dev | | | |
| Infra | | | |
| Security | | | |

---

## Poznámky hotfixů po freeze

Pokud je po podpisu nalezena kritická chyba, zaznamenat zde:

| Datum | Popis | Hotfix verze | Commit |
|-------|-------|--------------|--------|
| — | — | — | — |
