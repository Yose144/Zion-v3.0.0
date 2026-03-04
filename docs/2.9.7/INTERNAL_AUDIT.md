# INTERNÍ AUDIT — ZION TerraNova v2.9.7

> **Typ:** Interní (není externit auditorem — interní tým, sesion 63+)  
> **Datum zahájení:** 2026-03-04  
> **Datum uzavření:** ❌ PROBÍHÁ  
> **Rozsah:** L1 Core · L1 Pool · L1 Miner · CHv4 Algoritmus · Infrastruktura · Revenue · Bezpečnost  
> **Gate:** ✅ Uzavřený audit → C-01/C-02 Genesis Ceremony povolena  
> **Autor:** Yose144

---

## Stav auditu

| Oblast | Položek | Zkontrolováno | Kritické open | Stav |
|--------|---------|---------------|---------------|------|
| A — Konsensus & Blockchain | 18 | 0 | — | 🔴 NESPUŠTĚNO |
| B — Algoritmus CHv4 | 12 | 0 | — | 🔴 NESPUŠTĚNO |
| C — Pool / Stratum | 14 | 0 | — | 🔴 NESPUŠTĚNO |
| D — Revenue Proxy | 10 | 0 | — | 🔴 NESPUŠTĚNO |
| E — Bezpečnost & Síť | 12 | 0 | — | 🔴 NESPUŠTĚNO |
| F — Infrastruktura & Docker | 10 | 0 | — | 🔴 NESPUŠTĚNO |
| G — Testy & Coverage | 8 | 0 | — | 🔴 NESPUŠTĚNO |
| H — Tokenomika & Premine | 10 | 0 | — | 🔴 NESPUŠTĚNO |
| I — L2/L3 Interface | 6 | 0 | — | 🔴 NESPUŠTĚNO |
| **CELKEM** | **100** | **0** | **—** | 🔴 |

**Legenda závažnosti:** 🔴 KRITICKÉ (musí být opraveno před ceremonií) · 🟡 STŘEDNÍ (opravit před mainnet) · 🟢 NÍZKÁ (post-mainnet)

---

## A — Konsensus & Blockchain Core

### A-01 · Validace bloků — `blockchain/validation.rs` (560 ř.)

| # | Kontrolní bod | Závažnost | Výsledek | Poznámka |
|---|--------------|-----------|----------|---------|
| A-01a | Výška bloku roste monotónně (žádné skoky / reorg exploit) | 🔴 | — | Zkontrolovat `validate_block_height()` |
| A-01b | Timestamp: `MAX_TIMESTAMP_DRIFT` = 7 200 s pro mainnet | 🔴 | — | `network.rs` — per-network ověřeno v kódu, ale live ověřit na mainnet cfg |
| A-01c | Block size limit 1 MB — enforcement před persistencí | 🔴 | — | `block.rs` limit check |
| A-01d | Coinbase maturity = 100 bloků vynucen při spend | 🔴 | — | `validation.rs` step? |
| A-01e | Double-spend check na úrovni bloku | 🔴 | — | `test_double_spend_block_level_rejected` EXISTS — ověřit runtime path |
| A-01f | `unwrap()` v produkční validaci (2x nalezeno) | 🟡 | — | Nahradit `?` nebo explicit error |
| A-01g | Fee validace — fee >= 0, fee <= tx_value | 🟡 | — | `fee.rs` |
| A-01h | Coinbase výška v outputs odpovídá block.height | 🔴 | — | Kritické pro SPV ověření |

### A-02 · Chain & Reorg — `blockchain/chain.rs` (551 ř.)

| # | Kontrolní bod | Závažnost | Výsledek | Poznámka |
|---|--------------|-----------|----------|---------|
| A-02a | `chain.rs` má 32× `unwrap()` — každý prověřit | 🔴 | — | Potenciální crash při I/O chybě nebo poškozené DB |
| A-02b | Reorg limit — maximální délka reorgu / checkpoint | 🟡 | — | Bez limitu = možný long-range attack |
| A-02c | LWMA DAA — edge case: méně než 60 bloků v okně | 🔴 | — | Genesis bootstrap window |
| A-02d | Fork-choice pravidlo deterministické při tie | 🟡 | — | Stejný timestamp / stejný hash? |
| A-02e | LMDB: write corruption při nečekaném shutdownu | 🔴 | — | `storage/lmdb.rs` — transakce? |

### A-03 · Mempool & Transakce — `tx/mod.rs`

| # | Kontrolní bod | Závažnost | Výsledek | Poznámka |
|---|--------------|-----------|----------|---------|
| A-03a | Mempool size limit (DoS — zahlcení transakcemi) | 🔴 | — | Existuje limit? Eviction policy? |
| A-03b | UTXO lookup atomic s validací (TOCTOU) | 🔴 | — | Race při souběžných blokách |
| A-03c | Transaction replacement (RBF) — politika definována? | 🟡 | — | Nebo žádný RBF = jednodušší, zdokumentovat |
| A-03d | Memo field — délka limit, sanitizace | 🟢 | — | Session 58 opraveno — zkontrolovat |
| A-03e | Podpis Ed25519 — správná křivka, reject malleable sigs | 🔴 | — | `crypto/keys.rs` |

---

## B — Algoritmus CHv4 / Cosmic Harmony

### B-01 · Parity (kód vs GPU vs C native)

| # | Kontrolní bod | Závažnost | Výsledek | Poznámka |
|---|--------------|-----------|----------|---------|
| B-01a | Rust (pool) == C native hash `134f268c...42a6db` | 🔴 | ✅ | commit `f0ebf20` — parity test existuje |
| B-01b | CUDA CHv4 == Rust hash (64/64 testy) | 🔴 | ✅ | commit `22f0515` |
| B-01c | OpenCL CHv4 == Rust hash (live mining ověřit) | 🔴 | — | Unit test existuje, live ověřit na GPU nodu |
| B-01d | Python GPU miner CHv4 == Rust (manual test) | 🟡 | — | `chv4_flag=1, mh_flag=1` — ověřit alespoň 1 hash |

### B-02 · Bezpečnost algoritmu

| # | Kontrolní bod | Závažnost | Výsledek | Poznámka |
|---|--------------|-----------|----------|---------|
| B-02a | CHv3 fork height = 100 000 — nelze obejít | 🔴 | ✅ | `CHV3_MEMORY_HARD_FORK_HEIGHT = 100_000` |
| B-02b | CHv4 fork height = 0 od genesis — ověřit v config | 🔴 | ✅ | `CHV4_NPU_FORK_HEIGHT=0` |
| B-02c | `env` override zakázán v `--release` | 🔴 | ✅ | commit `8a2b295` |
| B-02d | AES-128 software — konstantní čas (timing attack) | 🟡 | — | `aes` crate — je constant-time? |
| B-02e | NPU int8 two's complement overflow — správné chování | 🔴 | — | `(b as i8) as i32` — zkontrolovat všechny cesty |
| B-02f | Scratchpad velikost 512 KiB — ASIC cost model ověřit | 🟡 | — | Dostatečné pro ASIC-resistance? |
| B-02g | Mining loop — nemožné nekonečné cykly bez cancel | 🟡 | — | `miner/src/main.rs` — cancel propagace |
| B-02h | Difficulty adjustment — možné přetečení u32/u64 | 🔴 | — | Při extrémně nízkém hashrate |

---

## C — Pool / Stratum Server

### C-01 · Autentizace & relimit

| # | Kontrolní bod | Závažnost | Výsledek | Poznámka |
|---|--------------|-----------|----------|---------|
| C-01a | Rate limit příchozích spojení (DoS — 100 konexí/s) | 🔴 | — | `server_v2.rs` — existuje rate guard? |
| C-01b | Autentizace wallet adresy — validní `zion1` prefix | 🔴 | — | Nebo akceptuje libovolný řetězec? |
| C-01c | Session timeout pro idle těžaře | 🟡 | — | `session.rs` — keepalive? |
| C-01d | Maximální jobů na session (memory DoS) | 🟡 | — | Přeplnění job queue? |
| C-01e | `server_v2.rs` má 1× `unwrap()` — prověřit | 🟡 | — | Crash při parsing malformed JSON |

### C-02 · Share validace

| # | Kontrolní bod | Závažnost | Výsledek | Poznámka |
|---|--------------|-----------|----------|---------|
| C-02a | Replay attack — stejný share 2× accepted? | 🔴 | — | Share cache / Bloom filter? |
| C-02b | VarDiff — spodní hranice min 50 dif (Sybil cost) | 🟡 | ✅ | `ZION_VARDIFF_MIN_DIFFICULTY=50` v deploy |
| C-02c | Share timestamp validace (ne příliš starý/budoucí) | 🟡 | — | `session.rs` |
| C-02d | Pool payout PPLNS — čase okno správné (N=?) | 🟡 | — | `pplns/calculator.rs` |

### C-03 · Template Manager

| # | Kontrolní bod | Závažnost | Výsledek | Poznámka |
|---|--------------|-----------|----------|---------|
| C-03a | Block template refresh < 1 s po novém bloku | 🔴 | — | `template_manager.rs` — polling interval? |
| C-03b | Race: 2 těžaři submittují stejný block height | 🟡 | — | Idempotentní submit? |
| C-03c | Core RPC fallback při nedostupnosti core node | 🔴 | — | Co se stane při core crashu? Těžaři visí? |
| C-03d | Merkle tree výpočet — správná implementace | 🔴 | — | Chybný merkle = nevalidní block |

---

## D — Revenue Proxy

### D-01 · Konfigurace & bezpečnost

| # | Kontrolní bod | Závažnost | Výsledek | Poznámka |
|---|--------------|-----------|----------|---------|
| D-01a | BTC adresa `bc1q...hd8mw` — validní bech32 | 🔴 | ✅ | `ch3_revenue_settings.json` v3.2.0-E07 |
| D-01b | Žádná BTC adresa v git historii plaintext | 🔴 | — | `git log -S bc1q` — leakage check |
| D-01c | Konfig file permissions 640 na serveru | 🟡 | — | `/root/config/ch3_revenue_settings.json` |
| D-01d | Pool přihlašovací credentialy čitelné jen rootem | 🟡 | — | 2miners auth stringy |

### D-02 · Scheduler & Revenue stream

| # | Kontrolní bod | Závažnost | Výsledek | Poznámka |
|---|--------------|-----------|----------|---------|
| D-02a | 50/25/25 split — ověřit aritmetiku `stream_scheduler.rs` | 🔴 | — | Žádný float rounding error? |
| D-02b | WhatToMine API fail — fallback na default coin | 🟡 | — | Co se stane při výpadku API? |
| D-02c | CFX/ZANO `enabled: false` — nikdy se nepřipojí | 🔴 | ✅ | Disabled v config |
| D-02d | KAS IPv6 DNS issue — ošetřeno? | 🟡 | — | `kas.2miners.com` IPv6 fallback |
| D-02e | Revenue canary 72h — výsledky zaznamenat | 🔴 | — | Payout ověřit na 2miners dashboard |
| D-02f | BuyBack modul — limity čerpání nakonfigurovány | 🟡 | ✅ | `buyback.enabled=true`, risk limity v config |

---

## E — Bezpečnost & Síť

### E-01 · RPC / API autentizace

| # | Kontrolní bod | Závažnost | Výsledek | Poznámka |
|---|--------------|-----------|----------|---------|
| E-01a | `jsonrpc/mod.rs` — veřejné endpointy bez auth (DoS) | 🔴 | — | Submitblock / sendtx — IP whitelist? |
| E-01b | Write endpoints auth revize — jednotný token model | 🔴 | — | P1 z TODO — zkontrolovat stav |
| E-01c | Admin endpointy odděleny od veřejných | 🔴 | — | Nebo je vše na portu 8444? |
| E-01d | CORS — povoleno jen z důvěryhodných domén | 🟡 | — | HTTP headers check |
| E-01e | TLS — pool 3333 plaintext stratum (ok), core 8444 HTTP | 🟡 | — | Mainnet — zvážit TLS wrapping |

### E-02 · Síťová bezpečnost

| # | Kontrolní bod | Závažnost | Výsledek | Poznámka |
|---|--------------|-----------|----------|---------|
| E-02a | fail2ban aktivní na Helsinki | 🔴 | ✅ | Session 62 — sshd jail, 5 banned |
| E-02b | Firewall — základní iptables/ufw na všech nodech | 🔴 | — | USA + Asia zkontrolovat |
| E-02c | Redis heslo — jen na localhost / docker network | 🔴 | — | `ZionTestNet2025SecureR3d1s` — ne veřejně |
| E-02d | P2P peer spam — `193.201.105.84` (IBD spam) blokovat | 🟡 | — | Low priority, z TODO 0.0 |
| E-02e | SSH key-only login (no password auth) | 🔴 | — | `/etc/ssh/sshd_config` — ověřit |
| E-02f | Pravidelný key rotation plán | 🟢 | — | Post-mainnet |

---

## F — Infrastruktura & Docker

### F-01 · Container security

| # | Kontrolní bod | Závažnost | Výsledek | Poznámka |
|---|--------------|-----------|----------|---------|
| F-01a | Docker images běží jako non-root user | 🟡 | — | `zion` user v Dockerfile? |
| F-01b | `--restart unless-stopped` — loop crash neblokuje | 🟡 | — | Exponential backoff? |
| F-01c | Volume permissions — `/data/zion-pool` owner | 🟡 | — | Named volume ownership |
| F-01d | Secrets v env variables — ne v docker-compose.yml | 🔴 | — | Redis password, RPC URL — v env file? |
| F-01e | Docker image SHA-256 piny v compose files | 🟡 | — | `image: zion-pool:2.9.7` → přidat `@sha256:20db3a4d...` |

### F-02 · Helsinki server stav

| # | Kontrolní bod | Závažnost | Výsledek | Poznámka |
|---|--------------|-----------|----------|---------|
| F-02a | RAM usage < 80% při plné zátěži | 🔴 | — | 5.0/7.5 GiB — přidat RAM alert do alertmanager |
| F-02b | Disk usage `/data` < 80% | 🔴 | — | LMDB creep — ověřit aktuální stav |
| F-02c | KAS pool IPv6 DNS fix nebo force IPv4 | 🟡 | — | `--dns 8.8.8.8` nebo `GODEBUG=preferIPv4=1` |
| F-02d | Log rotation pro kontejnery | 🟢 | — | `--log-driver json-file --log-opt max-size=100m` |
| F-02e | SeedDE + Usa1 zcela od sítě odpojeny | 🔴 | — | Z CODE_FREEZE checklist — ověřit |

---

## G — Testy & Coverage

### G-01 · Test coverage výsledky

| # | Kontrolní bod | Závažnost | Výsledek | Poznámka |
|---|--------------|-----------|----------|---------|
| G-01a | `cargo test --release` — všechny testy PASS | 🔴 | — | Naposledy 64/64 na Session 62 — spustit fresh |
| G-01b | CHv4 parity test `test_chv4_vs_c_native_parity` PASS | 🔴 | ✅ | commit `f0ebf20` |
| G-01c | `tests/chv4_e2e.rs` 11/11 PASS | 🔴 | ✅ | commit Session 61 |
| G-01d | `sprint_1_2_test_suite.rs` — double-spend test PASS | 🔴 | — | Ověřit po posledních změnách |
| G-01e | Phase 1.12 live stress test — 100/100, 93.8% accept | 🔴 | ✅ | 2026-03-04, p99=230ms |
| G-01f | Phase 1.11 partition test (30 min izolace) | 🟡 | ❌ | NENÍ HOTOVO — naplánovat |
| G-01g | Regresní test: reorg na 6 bloků (orphan scenario) | 🔴 | — | Chybí — napsat nebo simulovat |
| G-01h | Memory leak test (24h pool run, heap profiler) | 🟡 | — | Pool `session.rs` 3× unwrap |

---

## H — Tokenomika & Premine

### H-01 · Premine & Time-lock

| # | Kontrolní bod | Závažnost | Výsledek | Poznámka |
|---|--------------|-----------|----------|---------|
| H-01a | `DAO_TREASURY_LOCK_HEIGHT = 525_600` vynucen v release | 🔴 | ✅ | commit `c521c38` — `is_transfer_allowed()` |
| H-01b | Premine adresy odpovídají `PREMINE_ADDRESSES_PUBLIC.txt` | 🔴 | — | Ověřovací skript spustit před ceremonií |
| H-01c | Premine celková suma odpovídá tokenomice (144M ZION) | 🔴 | — | `reward.rs` + `premine.rs` součet ověřit |
| H-01d | Decade decay emise — výpočet správný pro 10 let | 🟡 | — | `reward.rs` kalkulačka ověřit |
| H-01e | Žádné extra coinbase výstupy mimo premine + pool | 🔴 | — | Coinbase struktura auditovat |

### H-02 · Governance

| # | Kontrolní bod | Závažnost | Výsledek | Poznámka |
|---|--------------|-----------|----------|---------|
| H-02a | Constitution `docs/mainnet/MAINNET_CONSTITUTION.md` — FROZEN (SHA-256) | 🔴 | — | Ještě ne FROZEN — gate pro ceremonii |
| H-02b | Starší constitution `docs/MAINNET_CONSTITUTION.md` označena SUPERSEDED | 🟡 | ✅ | Session 50 |
| H-02c | `MAINNET_EXIT_CRITERIA.md` — všechny body splněny? | 🔴 | — | `docs/mainnet/MAINNET_EXIT_CRITERIA.md` |
| H-02d | Key persons sign-off list — kdo co podepsal | 🟡 | — | Jen Yose144 dosud — dostačující? |
| H-02e | Premine key custody — air-gapped machine, dual backup | 🔴 | — | Runbook `GENESIS_CEREMONY.md` — připraveno? |

---

## I — L2/L3 Interface (mainnet scope)

| # | Kontrolní bod | Závažnost | Výsledek | Poznámka |
|---|--------------|-----------|----------|---------|
| I-01 | L2 bridge kontrakty — mainnet scope IN/OUT? | 🟡 | — | Nebo L2 až v2.9.8? |
| I-02 | DAO kontrakty — mainnet aktivace | 🟡 | — | `L2/dao/` — stav? |
| I-03 | Atomic swap — testnet only nebo mainnet den 1? | 🟡 | — | `L2/atomic-swap/` |
| I-04 | L3 API gateway — oddělení od L1 mainnet gated? | 🟢 | — | `L3/` |
| I-05 | Cross-layer message auth — L1→L2 event integrity | 🔴 | — | Zkontrolovat bridge event signing |
| I-06 | L2 kontrakty audited (interně) před mainnet deploy | 🟡 | — | `L2/contracts/` — stav auditability |

---

## Findings Log

> Vyplňuj průběžně při auditu. Format: `[DATUM] [ZÁVAŽNOST] oblast: popis nálezu → řešení`

```
[NESPUŠTĚNO]
```

---

## Kritické blokátory (musí být ✅ před genesis ceremonií)

Toto jsou automatické gate podmínky. **Ceremonie NESMÍ proběhnout** dokud nejsou všechny ✅:

- [ ] A-02a: chain.rs `unwrap()` opraveny nebo zdůvodněny
- [ ] A-03e: Ed25519 malleable signature reject ověřen
- [ ] C-01a: Rate limit příchozích pool spojení existuje
- [ ] C-02a: Share replay attack test PASS
- [ ] C-03c: Core RPC failure graceful degradation
- [ ] E-01a: RPC write endpoints autorizace
- [ ] G-01a: `cargo test --release` PASS (fresh run)
- [ ] G-01g: Reorg 6-bloků regresní test PASS
- [ ] H-01c: Premine suma ověřena vs. tokenomika (144M)
- [ ] H-02a: Constitution FROZEN (SHA-256)
- [ ] H-02e: Premine key custody runbook připraven
- [ ] 1 týden canary bez incidentu (revenue)

---

## Timeline

| Krok | Termín | Gate |
|------|--------|------|
| Zahájení auditu (sekce A, B) | 2026-03-05 | — |
| Sekce C, D, E | 2026-03-06 | — |
| Sekce F, G, H, I | 2026-03-07 | — |
| Findings review + opravy | 2026-03-08 → 2026-03-12 | — |
| Audit uzavřen — všechny kritické ✅ | ~2026-03-13 | Gate pro ceremonii |
| **C-01/C-02 Genesis Ceremony** | Po auditu ✅ | 🚫 Blocked |
| **MainNet v3.0** | 31. 12. 2026 | — |

---

## Postup kontroly

Pro každý řádek v tabulkách:
1. Přejdi na příslušný soubor a řádek
2. Přečti kód / config
3. Zapiš výsledek: ✅ OK · ❌ BUG · ⚠️ RISK · N/A
4. Pokud ❌ nebo ⚠️: přidej do **Findings Log** s popisem a návrhem opravy
5. Po opravě: otestuj + znovu označuj ✅

*Pravidlo: žádná sekce nesmí mít ❌ KRITICKÉ před uzavřením auditu.*
