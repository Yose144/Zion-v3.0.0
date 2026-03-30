# ZION v2.9.5 — Rust Status 22.1.2026 (real‑code aligned)

**Datum:** 22. ledna 2026  
**Účel:** jednotný, praktický status pro pokračování „Rust rewrite“ bez wishlistu; jasně rozlišit **běží v praxi** vs **existuje jako knihovna/FFI** vs **je jen plán**.

---

## 0) TL;DR

- **Rust native stack (core+pool) je reálně funkční pro ZION TestNet mining a NCL.**
- **NCL v1.0 kontrakt je definovaný a implementovaný (pool + miner).**
- **Multi‑chain (12 coinů) je zatím hlavně na úrovni knihoven/FFI a plánů; E2E „valid shares accepted“ mimo ZION není prokázané jako automatizovaný, opakovatelný test.**
- **E2E report/test skript aktuálně míří na porty produkčního python poolu (3333/8080), ne na native Rust pool (13333/18181). To je klíčový gap pro „rewrite proof“.**

---

## 1) Kanonické zdroje pro 2.9.5

- Real‑code status: [REAL_STATUS_v2.9.5.md](REAL_STATUS_v2.9.5.md)
- Rewrite plán: [REWRITE_PLAN_v2.9.5.md](REWRITE_PLAN_v2.9.5.md)
- Rewrite gapy/milníky (doc): [REWRITE_GAPS_AND_MILESTONES_v2.9.5_2026-01-19.md](REWRITE_GAPS_AND_MILESTONES_v2.9.5_2026-01-19.md)
- NCL kontrakt: [docs/NCL_CONTRACT_v1.0.md](docs/NCL_CONTRACT_v1.0.md)
- E2E report: [docs/E2E_TEST_REPORT.md](docs/E2E_TEST_REPORT.md)

Pozn.: CHv3 status dokumenty bereme jako **aspirační**, dokud nemají E2E testy.

---

## 2) Co je dnes reálně hotové (Rust 2.9.5)

### 2.1 Core (zion-native/core)

- Implementace core včetně PoW validace, template blob, storage (LMDB), JSON-RPC, P2P základů a reorg/rollback logiky je zapsaná v [REAL_STATUS_v2.9.5.md](REAL_STATUS_v2.9.5.md).
- **Praktický závěr:** Core je použitelné pro TestNet workflow „pool → getBlockTemplate → submitBlock“ (ale plné E2E „block found“ není zatím standardizovaný test, viz gapy níž).

### 2.2 Pool (zion-native/pool)

- Stratum server + share validace + Redis storage + PPLNS/payout pipeline + HTTP API + Prometheus metriky: viz [REAL_STATUS_v2.9.5.md](REAL_STATUS_v2.9.5.md).
- Share validator v Rust poolu explicitně pokrývá: RandomX, Yescrypt, Cosmic Harmony, Blake3, Autolykos v2: [zion-native/pool/src/shares/validator.rs](zion-native/pool/src/shares/validator.rs)

### 2.3 NCL (Neural Compute Layer)

- Stratum extension metody implementované v Rust poolu: `ncl.register/get_task/submit/status` v [zion-native/pool/src/stratum/server_v2.rs](zion-native/pool/src/stratum/server_v2.rs)
- NCL manager / schema / rate-limit / leaderboard endpointy jsou napojené do pool API v [zion-native/pool/src/main.rs](zion-native/pool/src/main.rs)
- Miner má NCL client a polling loop: [zion-universal-miner/src/ncl/mod.rs](zion-universal-miner/src/ncl/mod.rs)
- Kontrakt je popsaný v [docs/NCL_CONTRACT_v1.0.md](docs/NCL_CONTRACT_v1.0.md)

---

## 3) Kritické rozpory v dokumentaci (co je potřeba „od‑marketingovat“)

### 3.1 „12/12 algos implementováno“ vs real integrace

- [CH3_UNIFIED_STATUS.md](CH3_UNIFIED_STATUS.md) tvrdí 12/12 (knihovny). 
- [CH3_MULTICHAIN_NATIVE_IMPLEMENTATION.md](CH3_MULTICHAIN_NATIVE_IMPLEMENTATION.md) zároveň popisuje, že mimo ZION se dnes posílá intermediate hash a cílové pooly rejectují.

**Pravidlo pro DONE:**
- „Done“ = existuje automatizovaný E2E test, který pro daný coin/algoritmus prokáže **valid share accepted** na cílovém poolu (ne jen knihovna).

---

## 4) Největší gapy pro „kompletní Rust rewrite“

### 4.1 Gap: Native E2E testy míří na python porty

- E2E skript v [tests/e2e_stratum_test.py](tests/e2e_stratum_test.py) testuje `3333` a `/stats` na `8080`.
- Native Rust pool běží typicky na `13333` a `18181` (viz native compose a verify doc).

**Dopad:** aktuální E2E PASS != „Rust stack PASS“. Je potřeba přidat variantu E2E pro native porty.

### 4.2 Gap: „Block found“ / submitBlock pipeline není uzavřená jako test

- E2E report uvádí 0 bloků nalezených během testu: [docs/E2E_TEST_REPORT.md](docs/E2E_TEST_REPORT.md)
- Payout systém je tak zatím v praxi neaktivovaný (i když kód existuje).

**Dopad:** pro rewrite‑proof potřebujeme deterministický způsob, jak prokázat „block accepted & persisted“ (regtest / snížená obtížnost / kontrolovaný scenario test).

### 4.3 Gap: Multi‑chain (12 algos) je v mineru, ne v pool/core

- Universal miner má FFI enum pro 12 algo a feature‑gated linkování native libs: [zion-universal-miner/Cargo.toml](zion-universal-miner/Cargo.toml) a [zion-universal-miner/src/miner/native_algos.rs](zion-universal-miner/src/miner/native_algos.rs)
- Rust pool validator dnes není multi‑chain engine; ověřuje omezený set (viz výše).

**Dopad:** CHv3 multi‑chain je samostatný track; nesmí blokovat ZION TestNet stack.

### 4.4 Gap: NCL response shape vs doc

- Dokumentace popisuje `ncl.get_task` jako task přímo v `result`.
- Implementace vrací `result.task` (obal): [zion-native/pool/src/stratum/server_v2.rs](zion-native/pool/src/stratum/server_v2.rs)

**Dopad:** je potřeba buď upravit doc, nebo sjednotit response, aby to bylo dlouhodobě stabilní.

---

## 5) Doporučené milníky (autopilot backlog)

### P0 — „Rust stack E2E proof“ (nejvyšší priorita)

1) **Native E2E test suite (Stratum + API + NCL)**
   - Přidat nový test skript (vedle stávajícího), který míří na native porty (typicky 13333/18181).
   - Done: `login → job → submit` flow OK + `/stats` + `/metrics` OK + NCL register/get_task/submit OK.

2) **Block submit proof (regtest / test mode)**
   - Přidat režim/test, který prokáže: miner/pool dodá nonce → core `submitBlock` přijme → block uložen ve storage.
   - Done: automatizovaný test (ne ruční) vrátí PASS.

### P1 — „Provozní stabilita“

3) **P2P sync health (multi-region)**
   - Ošetřit a monitorovat lag (např. Helsinki) a sjednotit peer list/bootstrapping.
   - Done: žádný region nedriftuje o stovky+ bloků po dobu X hodin.

4) **NCL kontrakt sjednocení (doc vs wire)**
   - Sjednotit `ncl.get_task` response tvar a udržet backward compat.
   - Done: miner/pool + doc sedí; versioning je jasný.

### P2 — „CHv3 multi‑chain“ (neblokuje TestNet)

5) **Coin-by-coin E2E acceptance**
   - Pro každý coin definovat: job parsing, target conversion, submit payload, „accepted share“ test.
   - Done: tabulka `coin → E2E passing` + CI/skript běžící opakovaně.

---

## 6) Co spouštět / jak ověřovat rychle (prakticky)

- Native stack verify checklist: [VERIFY_USA_NATIVE_STACK_v2.9.5.md](VERIFY_USA_NATIVE_STACK_v2.9.5.md)
- NCL kontrakt: [docs/NCL_CONTRACT_v1.0.md](docs/NCL_CONTRACT_v1.0.md)

---

## 7) Otevřené rozhodnutí (aby autopilot jel bez zbytečných odboček)

1) „Kompletní rewrite“ pro Q1/Q2 = **ZION TestNet stack** (core+pool+miner+NCL), nebo už i **multi‑chain CHv3**?
2) Chceme upravit NCL doc podle reality (`result.task`), nebo upravit wire response podle doc?
