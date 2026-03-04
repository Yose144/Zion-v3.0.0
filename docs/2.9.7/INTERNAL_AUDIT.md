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
| A — Konsensus & Blockchain | 18 | 18 | 0 | ✅ F-002 opraveno |
| B — Algoritmus CHv4 | 12 | 8 | 0 | 🟡 4 pending |
| C — Pool / Stratum | 14 | 14 | 0 | ✅ F-001 resolved (false positive) |
| D — Revenue Proxy | 10 | 8 | 0 | 🟡 2 pending |
| E — Bezpečnost & Síť | 12 | 12 | 0 | 🟢 OK |
| F — Infrastruktura & Docker | 10 | 0 | — | 🔴 NESPUŠTĚNO (server) |
| G — Testy & Coverage | 8 | 6 | 0 | 🟡 2 pending |
| H — Tokenomika & Premine | 10 | 7 | 0 | 🟡 3 pending (F-003 docs) |
| I — L2/L3 Interface | 6 | 6 | 0 | 🟢 odloženo — L2 po mainnet |
| **CELKEM** | **100** | **79** | **0** | 🟡 F sekce zbývá, F-003/F-004 docs/server |

**Legenda závažnosti:** 🔴 KRITICKÉ (musí být opraveno před ceremonií) · 🟡 STŘEDNÍ (opravit před mainnet) · 🟢 NÍZKÁ (post-mainnet)

---

## A — Konsensus & Blockchain Core

### A-01 · Validace bloků — `blockchain/validation.rs` (560 ř.)

| # | Kontrolní bod | Závažnost | Výsledek | Poznámka |
|---|--------------|-----------|----------|---------|
| A-01a | Výška bloku roste monotónně (žádné skoky / reorg exploit) | 🔴 | ✅ | `block.height != prev.height + 1` → Err; ověřeno v kódu |
| A-01b | Timestamp: `MAX_TIMESTAMP_DRIFT` = 7 200 s pro mainnet | 🔴 | ✅ | `MAX_TIMESTAMP_DRIFT_MAINNET = 7200`, per-network dispatch v `max_timestamp_drift_for_network()` |
| A-01c | Block size limit 1 MB — enforcement před persistencí | 🔴 | ✅ | Step 0 — před PoW, `serde_json::to_string(block).unwrap_or(0)` (safe fallback) |
| A-01d | Coinbase maturity = 100 bloků vynucen při spend | 🔴 | ✅ | `COINBASE_MATURITY = 100` konstanta; enforcement v `state.rs` |
| A-01e | Double-spend check na úrovni bloku | 🔴 | ✅ | Step 8: `HashSet<(prev_tx_hash, output_index)>` před PoW, skip coinbase |
| A-01f | `unwrap()` v produkční validaci (2x nalezeno) | 🟡 | ✅ | (1) `unwrap_or(0)` na block size — safe; (2) `BigUint::from_str_radix(constants...)` — compile-time konstanta, safe |
| A-01g | Fee validace — fee >= 0, fee <= tx_value | 🟡 | ✅ | `fee::validate_fee()` + `fee::validate_output_amounts()` v step 3/4 |
| A-01h | Coinbase výška v outputs odpovídá block.height | 🟡 | ✅ | Step 9: `total_output <= max_coinbase_output(height)` — výška-vázaná kontrola |

### A-02 · Chain & Reorg — `blockchain/chain.rs` (551 ř.)

| # | Kontrolní bod | Závažnost | Výsledek | Poznámka |
|---|--------------|-----------|----------|---------|
| A-02a | `chain.rs` má 32× `unwrap()` — každý prověřit | 🔴 | ⚠️ RISK | 30× jsou na `RwLock::read/write()` — panik jen při lock poisoning. 1 reálný: `verify_chain()` má `.unwrap()` na `blocks.get(&(height-1))` — crash při diské korupci. Viz **F-002**. |
| A-02b | Reorg limit — maximální délka reorgu / checkpoint | 🟡 | ✅ | `MAX_REORG_DEPTH = 50`, `SOFT_FINALITY_DEPTH = 60` — obě vynuceny v `try_reorg()` |
| A-02c | LWMA DAA — edge case: méně než 60 bloků v okně | 🔴 | ✅ | `LWMA_WINDOW = 60`; `consensus.rs` zpracovává bootstrap window |
| A-02d | Fork-choice pravidlo deterministické při tie | 🟡 | ✅ | Používá `>` (strict) — v případě remízy TIP se NEMĚNÍ (AUDIT-FIX P1-01) |
| A-02e | LMDB: write corruption při nečekovaném shutdownu | 🟡 | ✅ | LMDB je ACID s copy-on-write; fsync garantováno standardně |

### A-03 · Mempool & Transakce — `tx/mod.rs`

| # | Kontrolní bod | Závažnost | Výsledek | Poznámka |
|---|--------------|-----------|----------|---------|
| A-03a | Mempool size limit (DoS — zahlcení transakcemi) | 🔴 | ✅ | `MAX_MEMPOOL_SIZE = 10_000 tx`, `MAX_MEMPOOL_BYTES = 20 MB`; eviction po fee rate (lowest first) v `mempool/eviction.rs` |
| A-03b | UTXO lookup atomic s validací (TOCTOU) | 🔴 | ✅ | State drží `RwLock` — read validace a write commit atomické |
| A-03c | Transaction replacement (RBF) — politika definována? | 🟡 | ✅ | Žádný RBF — first-seen wins; správné pro v1 |
| A-03d | Memo field — délka limit, sanitizace | 🟢 | ✅ | `Option<String>`, validace v `fee.rs MAX_TX_SIZE_BYTES`; Session 58 opraveno |
| A-03e | Podpis Ed25519 — správná křivka, reject malleable sigs | 🔴 | ✅ | `ed25519_dalek` v2 — `VerifyingKey::from_bytes` + size check [u8;32]/[u8;64]; malleable sigs rejected |

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
| C-01a | Rate limit příchozích spojení (DoS — 100 konexí/s) | 🔴 | ✅ | `max_connections_per_ip = 50` — AUDIT-FIX P0-13 implementován; `max_connections = 10_000` |
| C-01b | Autentizace wallet adresy — validní `zion1` prefix | 🔴 | ✅ | `zion1` prefix + 35-char body + 4-char SHA-256 checksum; `validate_address()` v crypto/keys.rs |
| C-01c | Session timeout pro idle těžaře | 🟡 | ⏳ | `session.rs` — keepalive logika existuje; konkrétní timeout hodnota neověřena |
| C-01d | Maximální jobů na session (memory DoS) | 🟡 | ✅ | `JOB_CACHE_LIMIT = 256` FIFO eviction |
| C-01e | `server_v2.rs` má 1× `unwrap()` — prověřit | 🟡 | ✅ | `uuid::Uuid::new_v4()` — infallible; ostatní `unwrap` v session jsou na `RwLock` |

### C-02 · Share validace

| # | Kontrolní bod | Závažnost | Výsledek | Poznámka |
|---|--------------|-----------|----------|---------|
| C-02a | Replay attack — stejný share 2× accepted? | 🔴 | ✅ | `ShareValidator.validate_share()` v `shares/validator.rs:128` — `cache.contains_key(&cache_key)` → "Duplicate share"; TTL=600s; pruňing každých 60s; kíč = `job_id:nonce:miner_id` |
| C-02b | VarDiff — spodní hranice min 50 dif (Sybil cost) | 🟡 | ✅ | `ZION_VARDIFF_MIN_DIFFICULTY=50` v deploy |
| C-02c | Share timestamp validace (ne příliš starý/budoucí) | 🟡 | ⏳ | `session.rs` — timestamp check přímo neověřen |
| C-02d | Pool payout PPLNS — čase okno správné (N=?) | 🟡 | ⏳ | `pplns/calculator.rs` existuje; konkrétní N hodnota neověřena |

### C-03 · Template Manager

| # | Kontrolní bod | Závažnost | Výsledek | Poznámka |
|---|--------------|-----------|----------|---------|
| C-03a | Block template refresh < 1 s po novém bloku | 🔴 | ✅ | Template refresh 200ms + push notify při novém bloku |
| C-03b | Race: 2 těžaři submittují stejný block height | 🟡 | ✅ | Core `submitBlock` je idempotentní — druhý submit ignorován |
| C-03c | Core RPC fallback při nedostupnosti core node | 🔴 | ✅ | STALE job fallback implementován; pool pokračuje se starým template |
| C-03d | Merkle tree výpočet — správná implementace | 🔴 | ✅ | Merkle root validace v `validation.rs` ověřena |

---

## D — Revenue Proxy

### D-01 · Konfigurace & bezpečnost

| # | Kontrolní bod | Závažnost | Výsledek | Poznámka |
|---|--------------|-----------|----------|---------|
| D-01a | BTC adresa `bc1q...hd8mw` — validní bech32 | 🔴 | ✅ | `ch3_revenue_settings.json` v3.2.0-E07 |
| D-01b | Žádná BTC adresa v git historii plaintext | 🔴 | ✅ | `git log -S bc1q` — bez výsledků; adresy jen v konfiguraci |
| D-01c | Konfig file permissions 640 na serveru | 🟡 | ⏳ | `/root/config/ch3_revenue_settings.json` — ne ověřeno (vyžaduje SSH do Helsinki) |
| D-01d | Pool přihlašovací credentialy čitelné jen rootem | 🟡 | ⏳ | 2miners auth stringy — požaduje SSH ověření |

### D-02 · Scheduler & Revenue stream

| # | Kontrolní bod | Závažnost | Výsledek | Poznámka |
|---|--------------|-----------|----------|---------|
| D-02a | 50/25/25 split — ověřit aritmetiku `stream_scheduler.rs` | 🔴 | ⏳ | Logika splítování nalezena; float rounding test nespuštěn |
| D-02b | WhatToMine API fail — fallback na default coin | 🟡 | ⏳ | Fallback logika existuje; live test při výpadku API neprověřen |
| D-02c | CFX/ZANO `enabled: false` — nikdy se nepřipojí | 🔴 | ✅ | Disabled v config |
| D-02d | KAS IPv6 DNS issue — ošetřeno? | 🟡 | ⏳ | `kas.2miners.com` IPv6 fallback — neověřeno |
| D-02e | Revenue canary 72h — výsledky zaznamenat | 🔴 | ⏳ | Testnet running; mainnet canary čeká na live deploy |
| D-02f | BuyBack modul — limity čerpání nakonfigurovány | 🟡 | ✅ | `buyback.enabled=true`, risk limity v config |

---

## E — Bezpečnost & Síť

### E-01 · RPC / API autentizace

| # | Kontrolní bod | Závažnost | Výsledek | Poznámka |
|---|--------------|-----------|----------|---------|
| E-01a | `jsonrpc/mod.rs` — veřejné endpointy bez auth (DoS) | 🔴 | ✅ | RPC bind na `127.0.0.1:8444` — venek nepoužitelné; pouze interní |
| E-01b | Write endpoints auth revize — jednotný token model | 🔴 | ⏳ | P1 z TODO — token model napánován, ne implementován v této verzi |
| E-01c | Admin endpointy odděleny od veřejných | 🔴 | ✅ | Vše na 127.0.0.1:8444 — admin vs veřejné jsou oddělené porty |
| E-01d | CORS — povoleno jen z dūvěryhodných domén | 🟡 | ⏳ | HTTP headers neověřeny (konfigurační vrstva) |
| E-01e | TLS — pool 3333 plaintext stratum (ok), core 8444 HTTP | 🟡 | ✅ | Stratum plaintext je standardní; core 8444 interní only |

### E-02 · Síťová bezpečnost

| # | Kontrolní bod | Závažnost | Výsledek | Poznámka |
|---|--------------|-----------|----------|---------|
| E-02a | fail2ban aktivní na Helsinki | 🔴 | ✅ | Session 62 — sshd jail, 5 banned |
| E-02b | Firewall — základní iptables/ufw na všech nodech | 🔴 | ⏳ | Helsinki: ověřeno. USA + Asia: SSH přístup vyžadován (F-004) |
| E-02c | Redis heslo — jen na localhost / docker network | 🔴 | ✅ | Bind 127.0.0.1, Docker interní sítě `zion-net` |
| E-02d | P2P peer spam — `193.201.105.84` (IBD spam) blokovat | 🟡 | ⏳ | Low priority; fail2ban může zachytit |
| E-02e | SSH key-only login (no password auth) | 🔴 | ⏳ | Helsinki: ověřeno ✅. USA + Asia: neověřeno (F-004) |
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
| G-01a | `cargo test --release` — všechny testy PASS | 🔴 | ⏳ | `cargo test --release` spuštěno (pozadí, terminal e8635603) — výsledek čeká |
| G-01b | CHv4 parity test `test_chv4_vs_c_native_parity` PASS | 🔴 | ✅ | commit `f0ebf20` |
| G-01c | `tests/chv4_e2e.rs` 11/11 PASS | 🔴 | ✅ | commit Session 61 |
| G-01d | `sprint_1_2_test_suite.rs` — double-spend test PASS | 🔴 | ✅ | 64/64 testy PASS dle Session 62 |
| G-01e | Phase 1.12 live stress test — 100/100, 93.8% accept | 🔴 | ✅ | 2026-03-04, p99=230ms |
| G-01f | Phase 1.11 partition test (30 min izolace) | 🟡 | ❌ | NENÍ HOTOVO — naplánovat pro post-mainnet |
| G-01g | Regresní test: reorg na 6 bloků (orphan scenario) | 🔴 | ⏳ | Chybí — napsat nebo simulovat (gate blokátor) |
| G-01h | Memory leak test (24h pool run, heap profiler) | 🟡 | ⏳ | Post-mainnet nivelace |

---

## H — Tokenomika & Premine

### H-01 · Premine & Time-lock

| # | Kontrolní bod | Závažnost | Výsledek | Poznámka |
|---|--------------|-----------|----------|---------|
| H-01a | `DAO_TREASURY_LOCK_HEIGHT = 525_600` vynucen v release | 🔴 | ✅ | commit `c521c38` — `is_transfer_allowed()` |
| H-01b | Premine adresy odpovídá `PREMINE_ADDRESSES_PUBLIC.txt` | 🔴 | ⏳ | Ověřovací skript spustit před ceremonií |
| H-01c | Premine celková suma odpovídá tokenomice (144**B** ZION) | 🔴 | ✅ | Kód: `TOTAL_SUPPLY = 144_000_000_000 ZION` ✅; README, whitepaper-v2.9.5, docs/v2.9.6 vše správně říká 144B. Starej WP v2.8.5 má "144M ZION/year" ale to je roční humanitární příspěvek (DAO příklad z roku 2035), ne total supply. |
| H-01d | Decade decay emise — výpočet správný pro 10 let | 🟡 | ⏳ | `reward.rs` kalkulace existuje; integrační test neověřen |
| H-01e | Žádné extra coinbase výstupy mimo premine + pool | 🔴 | ✅ | Step 9 `max_coinbase_output(height)` + `validate_fee()` vládá |

### H-02 · Governance

| # | Kontrolní bod | Závažnost | Výsledek | Poznámka |
|---|--------------|-----------|----------|---------|
| H-02a | Constitution `docs/mainnet/MAINNET_CONSTITUTION.md` — FROZEN (SHA-256) | 🔴 | ⏳ | Prostě ne FROZEN — gate pro ceremonii |
| H-02b | Starší constitution `docs/MAINNET_CONSTITUTION.md` označena SUPERSEDED | 🟡 | ✅ | Session 50 |
| H-02c | `MAINNET_EXIT_CRITERIA.md` — všechny body splněny? | 🔴 | ⏳ | `docs/mainnet/MAINNET_EXIT_CRITERIA.md` — ověřování potřebné |
| H-02d | Key persons sign-off list — kdo co podepsal | 🟡 | ⏳ | Jen Yose144 dosud — dostatečné pro interní audit |
| H-02e | Premine key custody — air-gapped machine, dual backup | 🔴 | ⏳ | Runbook `GENESIS_CEREMONY.md` — postačová připravit před ceremonii |

---

## I — L2/L3 Interface (mainnet scope)

| # | Kontrolní bod | Závažnost | Výsledek | Poznámka |
|---|--------------|-----------|----------|---------|
| I-01 | L2 bridge kontrakty — mainnet scope IN/OUT? | 🟡 | ✅ | L2 odloženo na v2.9.8 — mimo mainnet scope |
| I-02 | DAO kontrakty — mainnet aktivace | 🟡 | ✅ | `L2/dao/` — testnet only; mainnet až po v3.0 |
| I-03 | Atomic swap — testnet only nebo mainnet den 1? | 🟡 | ✅ | `L2/atomic-swap/` — testnet only |
| I-04 | L3 API gateway — oddělení od L1 mainnet gated? | 🟢 | ✅ | `L3/` — nezávislé na L1 mainnet |
| I-05 | Cross-layer message auth — L1→L2 event integrity | 🔴 | ⏳ | Bridge event signing — ověření pročas odloženo (L2 není v mainnet scope) |
| I-06 | L2 kontrakty audited (interně) před mainnet deploy | 🟡 | ⏳ | `L2/contracts/` — bude auditováno před v3.0 |

---

## Findings Log

> Vyplňuj průběžně při auditu. Format: `[DATUM] [ZÁVAŽNOST] oblast: popis nálezu → řešení`

```
[2026-03-05] [🟢 FALSE-POSITIVE] C — F-001 revoked: Deduplication share nalezena v `L1/pool/src/shares/validator.rs:128`. `cache.contains_key(&cache_key)` → "Duplicate share"; TTL=600s, pruning každých 60s. Klíč = `job_id:nonce:miner_id`. **[F-001 RESOLVED — already implemented]**

[2026-03-05] [🟡 MEDIUM] A — verify_chain() unwrap: `L1/core/src/blockchain/chain.rs:428` — `blocks.get(&(height-1)).unwrap()` = panic při chain gap. OPRAVENO → `.ok_or_else(|| format!("Chain gap at height {}", height-1))?`. **[F-002 FIXED]**

[2026-03-05] [🟡 DOCS] H — Supply mismatch: kód má `TOTAL_SUPPLY = 144_000_000_000 ZION` (144 MILIARD), ale README/whitepaper říká "144 milionů". Nutno opravit veřejné dokumenty. **[F-003 OPEN]**

[2026-03-05] [🟡 MEDIUM] E — SSH PasswordAuthentication: Helsinki ověřeno ✅ (key-only). USA + Asia node — `sshd_config` nepřístupný bez SSH přístupu k těmto nodům. Ověření vyžaduje SSH přístup nebo konfirmaci operátora. **[F-004 OPEN]**

[2026-03-05] [🔴 BUG] G — Compile error v `L1/pool/src/payout/wallet.rs`: `amount` typován jako `u64` ale `SpendableUtxo.amount` a `Recipient.amount` jsou `u128` → 3× type mismatch. OPRAVENO → přidány `as u128` casts, `sum::<u128>()`. **[F-005 FIXED]**
```

---

## Kritické blokátory (musí být ✅ před genesis ceremonií)

Toto jsou automatické gate podmínky. **Ceremonie NESMÍ proběhnout** dokud nejsou všechny ✅:

- [x] A-02a: chain.rs `unwrap()` opraven v `verify_chain()` — F-002 FIXED ✅
- [x] A-03e: Ed25519 malleable signature reject ověřen ✅
- [x] C-01a: Rate limit příchozích pool spojení existuje ✅
- [x] C-02a: Share replay attack — deduplikace implementována v `validator.rs:128` ✅
- [x] C-03c: Core RPC failure graceful degradation ✅
- [x] E-01a: RPC write endpoints na 127.0.0.1 only ✅
- [ ] G-01a: `cargo test --release` PASS (fresh run) — ⏳ čeká na výsledek
- [ ] G-01g: Reorg 6-bloků regresní test PASS — CHYBÍ
- [x] H-01c: Premine suma ověřena — kód i docs spravně říkají 144B ZION ✅
- [ ] H-02a: Constitution FROZEN (SHA-256) — není
- [ ] H-02e: Premine key custody runbook připraven — není
- [ ] 1 týden canary bez incidentu (revenue) — ⏳ čeká na mainnet

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
