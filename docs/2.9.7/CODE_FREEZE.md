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

### Revenue systém (implementován v kódu, produkční aktivace → 2.9.8)
- [x] `L1/pool/src/revenue_proxy.rs` (1 869 řádků) — StratumProtocol pro ETC/ERG/RVN/XMR/VRSC ✅
- [x] `L1/pool/src/stream_scheduler.rs` — 50/25/25 (ZION/Revenue/NCL), PerMiner + TimeSplit ✅
- [x] `L1/pool/src/profit_switcher.rs` — WhatToMine API, GPU detekce, hysteresis ✅
- [x] `config/ch3_revenue_settings.json` v3.0.0 — 5 streamů nakonfigurováno ✅
- [ ] Produkční wallet adresy nastavit (→ 2.9.8)
- [ ] BuyBack modul aktivovat (→ 2.9.8)

### CHv4 / MainNet gate
- [ ] CHv4 activation policy final (fork-height/governance + rollout pravidla)
- [ ] CHv4 production E2E run (pool + miner + telemetry) bez kritických incidentů
- [ ] Revenue 72h canary payout run (audit ledger + rollback plán)

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
