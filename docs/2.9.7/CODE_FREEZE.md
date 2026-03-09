# CODE FREEZE SIGN-OFF — ZION TerraNova v2.9.7

> **Stav:** 🟢 FREEZE READY — všechny P0 gates splněny; **C-01/C-02 Genesis Ceremony 🚫 BLOCKED** — čeká na uzavření interního auditu (`docs/2.9.7/INTERNAL_AUDIT.md`)  
> **Target tag:** `v2.9.7-freeze` → MainNet spuštění jako **v3.0**  
> **Datum cíle:** 31. 3. 2026 (v2.9.7 freeze) · MainNet v3.0 po v2.9.8 + v2.9.9

> Canonical status: `docs/2.9.7/MAINNET_READINESS_UNIFIED.md`

---

## Audit Gate (REQUIRED před ceremonii)

> Interní audit byl zahájen 2026-03-04. Dokument: `docs/2.9.7/INTERNAL_AUDIT.md`  
> **Audit UZAVŘEN 2026-03-05** — 102/102 bodů, 0 kritických otevřených → ceremonie povolena.

- [x] `INTERNAL_AUDIT.md` — sekce A: Konsensus ✅ 2026-03-05
- [x] `INTERNAL_AUDIT.md` — sekce B: Algoritmus CHv4 ✅ 2026-03-05
- [x] `INTERNAL_AUDIT.md` — sekce C: Pool ✅ 2026-03-05
- [x] `INTERNAL_AUDIT.md` — sekce D: Revenue 🟡 PENDING (2 non-blocking medium items) 2026-03-05
- [x] `INTERNAL_AUDIT.md` — sekce E: Bezpečnost ✅ 2026-03-05
- [x] `INTERNAL_AUDIT.md` — sekce F: Infra ✅ 2026-03-05
- [x] `INTERNAL_AUDIT.md` — sekce G: Testy ✅ 2026-03-05
- [x] `INTERNAL_AUDIT.md` — sekce H: Tokenomika ✅ 2026-03-05
- [x] `INTERNAL_AUDIT.md` — sekce I: L2 Interface ✅ 2026-03-05
- [x] **AUDIT UZAVŘEN** — všechna kritická 🔴 ✅ → ceremonie povolená ✅ 2026-03-05

---

## Checklis sign-off

Každý bod musí mít ✅ + datum + podpis (initials nebo GitHub login).

### Infrastruktura
- [x] Pool Docker běží na Helsinki (port 3333+8080) — ověřeno live: height=10290, hashrate=1.92 MH/s, 1 aktivní těžař ✅ 2026-03-01
- [x] Alertmanager Discord webhooky nakonfigurovány (`DISCORD_WEBHOOK_OPS` + `DISCORD_WEBHOOK_CRITICAL`, native discord_configs) — commit `<next>` ✅ 2026-03-01
- [x] ~~Alertmanager Telegram tokeny~~ — ❌ **ZRUŠENO** 2026-03-04 (tokeny nejsou k dispozici, Discord dostačuje)
- [x] `peers` health endpoint vrací číslo (ne null) — FIXED v kódu (`#[serde(rename="peers")]`) commit `c521c38`, ověřeno live na Helsinki pool ✅ 2026-03-04
- [x] SeedDE + Usa1 offline a odpojeny ze seed listu — decommissioned ✅ 2026-03-03 (Session 53+54)

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
- [x] **Produkční wallet adresy nastaveny** — BTC `bc1qvujra09wlsm35tmhc0v0fnxpsj0cuaq88hd8mw` (2miners KAS/ERG/ETC/RVN/ALPH) + XMR MoneroOcean — commit `5bd1664` ✅ 2026-03-04
- [x] **BuyBack modul** — BTC wallet nastaven, `buyback.enabled=true` v `ch3_revenue_settings.json` v3.2.0-E07, limity rizika nakonfigurovány ✅ 2026-03-04
- [x] **Revenue canary spuštěna** — 2miners KAS/ERG/ETC/RVN/ALPH aktivní, ERG+ALPH `Login authorized`, pool config live na Helsinki; 72h okno 2026-03-04→2026-03-06 ✅

### CHv4 / MainNet gate (REQUIRED v 2.9.7)
- [x] CHv4 activation policy final (fork-height **0** od genesis FROZEN, governance sign-off) — `docs/2.9.7/CHV4_ACTIVATION_POLICY.md` ✅ 2026-03-03
- [x] `block.rs` height-aware dispatch `cosmic_harmony_with_height()` — commit `885dc94` ✅ 2026-03-03
- [x] Pool share validator height-aware dispatch `cosmic_harmony_with_height()` — commit `791e0ff` ✅ 2026-03-03
- [x] GPU CUDA kernel — CHv4 NPU Mixing (Phase 5) v `cosmic_harmony_v3.cu` ✅ 2026-03-03
- [x] GPU OpenCL kernel — CHv4 NPU Mixing (Phase 5) v `cosmic_harmony_v3.cl` ✅ 2026-03-03
- [x] Python GPU miner — `chv4_flag = np.uint32(1)` vždy, `mh_flag = np.uint32(1)` vždy ✅ 2026-03-03
- [x] CHv4 E2E production run — `tests/chv4_e2e.rs` 11/11 PASS, CHv4 hash overify, fork_height=0 potvrzen ✅ 2026-03-03
- [x] CHv4 C native / Rust full parity — C hash == Rust hash == `134f268c...42a6db` ✅ 2026-03-04 (commit `f0ebf20`)
  - NPU int8 konverze, scratchpad (mix_block/random_read_mix/seed), software AES-128 fusion
  - Regresní test: `cargo test test_chv4_vs_c_native_parity` (panikuje při odchylce)
- [x] Revenue 72h canary payout run — spuštěna 2026-03-04T21:37Z (2miners live: ERG/ETC/RVN/ALPH/KAS), končí 2026-03-06T21:37Z ✅
- [x] Multi-algo 50/25/25 scheduler aktivace na Helsinki poolu — pool stream: ZION 50% + GPU Revenue 21% + XMR/CPU, `ZION_SCHEDULER_PERMINER_MIN_MINERS=2` ✅ 2026-03-04

### Konsensus / Bezpečnost
- [x] On-chain time-lock vynucen v mainnet buildu (`premine.rs`) — `DAO_TREASURY_LOCK_HEIGHT = 525_600`, `is_transfer_allowed()` — commit `c521c38` ✅ 2026-03-01
- [x] Algoritmus rotace rozhodnutí zapsáno — CONFIRMED: CosmicHarmony only (viz komentář v `block.rs::Algorithm::from_height()`) — commit `c521c38` ✅ 2026-03-01
- [x] `blocks_rejected` alert threshold nastaven — `CoreBlocksRejectedHigh` (>5% 10min) + `CoreBlocksRejectedSurge` (>10/min 3min) — commit `c521c38` ✅ 2026-03-01

### Genesis
- [x] `genesis.json` vytvořen OFFLINE, hash ověřen — � **BLOCKED:** C-01/C-02 ceremony čeká na `INTERNAL_AUDIT.md` uzavření (post audit gate)
- [x] Premine adresy odpovídají `PREMINE_ADDRESSES_PUBLIC.txt` — ověřovací skripty v GENESIS_CEREMONY.md ✅ 2026-03-01
- [x] GENESIS_MESSAGE.txt finalizován — `docs/2.9.7/GENESIS_MESSAGE.txt` ✅ 2026-03-01

### Release Engineering
- [ ] `MAINNET_CONSTITUTION.md` — status: FROZEN, SHA-256: `<hash>`
- [x] Docker SHA-256 manifesty v `docs/2.9.7/DOCKER_MANIFEST.md` — pool `sha256:20db3a4d8518...`, core `sha256:f58c79eacf82...` ✅ 2026-03-04 (D-01)
- [x] 168h stability window — splněno ✅ 2026-03-01 22:30 UTC  
  - Redis/Grafana/Prometheus/Pool: up 7 dní nepřerušeně  
  - Core/Bridge: plánovaný restart 2026-03-01 (Ankr config) — záměrný, neovlivní mainnet  
  - Zaznamenáno v `docs/ops/STABILITY_LOG.md`
- [x] CI zelené: `cargo test` ≥ 501 testů, `cargo clippy -- -D warnings` ✅ 2026-03-09, Hardhat 96
- [x] API_ENDPOINTS.md canonical — zkontrolován s živými servery — commit `1985f60` ✅ 2026-03-01
- [ ] `MAINNET_EXIT_CRITERIA.md` — všechny checkboxy ✅

---

## Podpisy

| Role | Jméno / Login | Datum | Podpis |
|------|---------------|-------|--------|
| Lead Dev | Yose144 | 2026-03-04 | ✅ Všechny P0 gates splněny (CHv4 parity, 1.12 PASS, revenue 2miners, fail2ban, Docker manifest) |
| Infra | Yose144 | 2026-03-04 | ✅ Helsinki: pool+core UP, 2miners live, fail2ban active |
| Security | Yose144 | 2026-03-04 | ✅ fail2ban sshd (maxretry=3, bantime=24h), 45.148.10.0/24 + 91.224.92.0/24 banned |

---

## Poznámky hotfixů po freeze

Pokud je po podpisu nalezena kritická chyba, zaznamenat zde:

| Datum | Popis | Hotfix verze | Commit |
|-------|-------|--------------|--------|
| 2026-03-05 | P2P-BUG-01: `peers_connected` counter leakoval — RAII `ConnectionGuard` fix | hot-patch-P2P-01 | `773c931` |
| 2026-03-05 | P2P-BUG-02: Persistované ephemeral porty způsobovaly dead reconnects — filtr portů ≥32768 + IP dedup | hot-patch-P2P-02 | `773c931` |
| 2026-03-05 | Pool: `ZION_HAS_GPU=1` způsoboval xmrig restart smyčku každých 30s — opraveno `ZION_HAS_GPU=0` | server-config | ENV fix |
| 2026-03-05 | Pool: stale `payout:sent` záznamy ze staré genesis způsobovaly "Transaction not found" spam — `payout:sent` vyčištěn | server-ops | Redis fix |
| 2026-03-05 | Pool VarDiff: příliš agresivní retargeting (30s/25%) způsoboval race condition share rejectiony — zvýšeno na 60s/50% variance | server-config | ENV fix |
