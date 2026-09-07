# 🎯 ZION TerraNova v2.9.5 — Next Steps

> **Datum:** 15. února 2026  
> **Aktualizace:** 12. března 2026  
> **Stav:** Historický planning snapshot z poloviny února 2026. Aktuální verified stav je 114,520 Rust LOC a 1,379 Rust testů; viz `docs/STATUS_CURRENT_2026-03-12.md`.  
> **Cíl:** L1 MainNet Genesis — 31. prosince 2026  
> **Vygenerováno z:** Deep Scan projektu (14.2.2026)

---

## 📊 Aktuální Stav Projektu — Hloubková Analýza

### ✅ Co funguje solidně

| Oblast | Stav | Testů | Poznámka |
|--------|------|-------|----------|
| Core blockchain (UTXO, Ed25519, LMDB) | ✅ 90% | ~238 | Solidní základ, undo log, balance cache |
| LWMA DAA (60-block, ±25%) | ✅ 95% | 18 | Deterministické, dobře otestované |
| P2P síť (rate limiting, blacklist, IBD) | ✅ 85% | 55 | Escalating bans, stall detection |
| Wallet (UTXO select, signing, batch) | ✅ 85% | 27 | Ed25519, batch payouts, zeroize |
| Pool (Stratum v2, PPLNS, VarDiff) | ✅ 80% | — | Revenue proxy, profit switcher |
| Miner (CPU + GPU multichain) | ✅ 75% | — | 15 algoritmů, Metal + OpenCL |
| Cosmic Harmony v3 | ✅ 80% | — | Multichain revenue 50/25/25 |
| Stress & Security testy | ✅ | 21 | Partition, flood, reorg, mempool |
| CI/CD (build, test, clippy, audit) | ✅ | — | GitHub Actions, 3 workflows |
| Legal docs (5 souborů) | ✅ 80% | — | Disclaimer, Token-Not-Security, Risk |
| Fáze 0 + 1 (Sprint 0.0–1.9) | ✅ | **420** | Všechny sprinty hotové |

### 🔴 Kritické Bloky pro MainNet (P0)

| # | Problém | Kde | Dopad |
|---|---------|-----|-------|
| 1 | **TŘI různé CH implementace** — miner=v3, core validátor=v1, miner má inline f64 fallback | `cosmic-harmony/src/lib.rs` vs `core/src/algorithms/cosmic_harmony.rs` vs `miner/src/native_algos.rs` | 🔴 Miner vytěží blok který core odmítne! |
| 2 | **Nonce 32-bit vs 64-bit mismatch** — core=32bit, miner/pool=64bit | `core/src/algorithms/` vs `miner/src/stratum.rs` | 🔴 Tiché ořezání → nevalidní hashe |
| 3 | **Rotace algoritmů VYPNUTA** — `// TODO: Restore rotation for mainnet` | `core/src/blockchain/block.rs` L23 | 🔴 Rozhodnout před mainnet |
| 4 | **Premine adresy = testnet** — 12 walletů s testnet klíči | `core/src/blockchain/premine.rs` | 🔴 Nahradit cold-storage adresami |
| 5 | **DAO_ADDRESS = placeholder** — `zion1dao...treasury` | `core/src/blockchain/burn.rs` | 🔴 Nahradit multisig adresou |
| 6 | **Pouze 2 seed nody** — DNS záznamy neresolvují | `core/src/p2p/seeds.rs` | 🔴 Minimum 3 pro mainnet |
| 7 | **PREMINE_WALLETS_BACKUP.json na disku** — 16.78B ZION privátní klíče | kořen workspace | 🔴 Přesunout do offline vault |

### 🟡 Zbývající Pro Exit Fáze 1

| # | Úkol | Sprint | Stav |
|---|------|--------|------|
| 1 | 72h stability run (3+ nody, bez restartu) | 1.10.1 | ⬜ |
| 2 | Live network partition test (30min izolace) | 1.10.2 | ⬜ |
| 3 | 100 minerů stress test (simulace Stratum) | 1.10.3 | ⬜ |

### 🟡 Revenue Vrstva (Probíhající Práce)

- Pool revenue (VRSC/XMR/ETC) — revenue lock, share routing, varDiff tuning
- VRSC upstream: **E2E funkční** (submit + accepted shares potvrzeny). Hlavní riziko: stale `[21, "job not found"]` po `clean_jobs` (řešeno stale-drop guardem; dlouhodobě měřit stabilitu).
- CPU default pro Revenue: **VerusHash = 1 thread** (stabilita/latence), CHv3 používá plný počet threadů, když je aktivní.
- **Paralelní režim (současně ZION + Revenue):** pool podporuje per-miner skupiny + pin přes miner hint `g=` (CLI `--group zion|revenue|ncl`). Pro zapnutí PerMiner i se 2 sessions nastav v poolu `ZION_SCHEDULER_PERMINER_MIN_MINERS=2`.
- Buyback engine: logika existuje, DEX/CEX integrace je stub (`TODO: Phase 5.2`)

### 📝 TODO/FIXME v Kódu

| Soubor | Řádek | Problém | Závažnost |
|--------|-------|---------|-----------|
| `core/src/blockchain/block.rs` | L23 | `TODO: Restore rotation for mainnet` | 🔴 P0 |
| `core/src/state/mod.rs` | L137 | `TODO: Remove once RPC sendTransaction builds proper signed TXs` | 🟡 P1 |
| `pool/src/buyback.rs` | L559 | `TODO: Phase 5.2 — Execute buyback on DEX/CEX` | 🟡 P1 |
| `pool/src/profit_switcher.rs` | L150 | `TODO: Integrate with whattomine profit router` | 🟡 P1 |
| `miner/src/ncl.rs` | L127 | `TODO: Detect Intel NPU, AMD XDNA` | 🟢 P2 |
| `miner/src/stratum.rs` | L125 | `TODO: Send via pool connection` | 🟡 P1 |

---

## 🎯 Prioritizovaný Plán — Next Steps

### 🔥 TIER 1 — Kritické Konsenzuální Opravy (Tento Týden)
> **Bez těchto oprav mainnet nemůže fungovat — miner a core se neshodnou na validitě bloků.**

| # | Úkol | Proč | Effort | Soubory |
|---|------|------|--------|---------|
| **A** | **Sjednotit Cosmic Harmony na 1 implementaci** | Core validátor=v1, miner=v3 → odmítnuté bloky! | 1–2 dny | `core/src/algorithms/cosmic_harmony.rs`, `cosmic-harmony/src/lib.rs`, `miner/src/native_algos.rs` |
| **B** | **Sjednotit nonce na u64 všude** | 32-bit v core, 64-bit v miner/pool → tiché truncation | 4h | `core/src/algorithms/`, `core/src/blockchain/block.rs`, `miner/src/stratum.rs` |
| **C** | **Rozhodnout rotaci algoritmů** — single CH_v3 nebo multi-algo rotace? | TODO v block.rs blokuje konsenzus | 1h rozhodnutí + 2-4h implementace | `core/src/blockchain/block.rs` |

**Doporučení k bodu A:**
```
AKTUÁLNÍ:
  core/src/algorithms/cosmic_harmony.rs    → CH v1 (legacy)
  cosmic-harmony/src/lib.rs               → CH v3 (aktuální, multichain)
  miner/src/native_algos.rs               → inline f64 fallback

CÍL:
  cosmic-harmony/src/lib.rs               → JEDINÁ reference implementace
  core/ importuje cosmic-harmony crate    → cargo dependency
  miner/ importuje cosmic-harmony crate   → cargo dependency
  Smazat: core/src/algorithms/cosmic_harmony.rs (v1)
  Smazat: miner/src/native_algos.rs inline fallback
```

### ⚡ TIER 2 — Stabilizace & Hardening (Příští Týden)
> **Doladit to co funguje, připravit na 72h stability run.**

| # | Úkol | Proč | Effort |
|---|------|------|--------|
| **D** | **72h stability run** (Sprint 1.10.1) | Exit criteria Fáze 1 — 3 nody, CPU mining, žádný restart | 72h pasivně |
| **E** | **Config runtime loading z TOML** | Parametry jsou hardcoded, TOML soubory se nečtou runtime | 1 den |
| **F** | **TX recycling po reorgu** — rollback nevrací TX do mempoolu | Ztráta transakcí po reorgu | 4h |
| **G** | **Address→UTXO index** — O(n) full scan při cache miss | Na mainnetu s miliony UTXO bude pomalé | 1 den |
| **H** | **MAX_REORG_DEPTH: 50 → 10** | Checklist říká 10 pro mainnet, kód má 50 | 1h |

### 🛡️ TIER 3 — Bezpečnost & Infrastruktura (Tento Měsíc)
> **Security hardening a příprava produkční infrastruktury.**

| # | Úkol | Proč | Effort |
|---|------|------|--------|
| **I** | **BFG Repo-Cleaner** — smazat premine klíče z git historie | 16.78B ZION v plaintextu v historii! | 2h |
| **J** | **DNS seed nody** (seed1/2/3.zionterranova.com) | Minimum 3 pro mainnet, aktuálně 2 IP | 1 den |
| **K** | **Block Explorer backend** (Sprint 2.3) | Bez exploreru žádný CMC/CoinGecko listing | 1 týden |
| **L** | **Bech32 validace miner adres** v poolu | Pool přijme neplatné adresy bez kontroly | 4h |
| **M** | **Alertmanager** (Slack/Telegram) | Prometheus alerty existují ale nikam se neposílají | 4h |
| **N** | **P2P message MAC autentizace** | Plain JSON/TCP, žádný HMAC — message tampering | 2 dny |
| **O** | **Přesunout PREMINE_WALLETS_BACKUP.json** do offline vault | Na disku = bezpečnostní riziko | 1h |

### 🌍 TIER 4 — Node UX & Fáze 2 (Březen–Duben 2026)
> **Uživatelsky přívětivý node, explorer, dokumentace — Fáze 2 roadmapy.**

| # | Úkol | Sprint | Effort |
|---|------|--------|--------|
| **P** | Block Explorer frontend (web UI) | 2.3 | 1 týden |
| **Q** | "Run node in 10 min" README | 2.1.1 | 1 den |
| **R** | OpenAPI/Swagger RPC dokumentace | 2.1.5 | 2 dny |
| **S** | Mining guides (CPU/GPU/pool/solo) | 2.2.5 | 2 dny |
| **T** | Graceful shutdown + structured logging | 2.1.3-2.1.4 | 1 den |
| **U** | CLI interface (`zion-node start/status`) | 2.1.6 | 2 dny |
| **V** | Solo mining mode | 2.2.4 | 1 den |

### 🚀 TIER 5 — Exchange Readiness & Legal (Květen–Červen 2026)
> **Příprava na listing, legal dokumenty, bridge.**

| # | Úkol | Sprint | Effort |
|---|------|--------|--------|
| **W** | Supply API endpoint (`/api/supply`) | 3.4.8 | 4h |
| **X** | Whitepaper PDF finální verze | 3.4.2 | 1 den |
| **Y** | CMC/CoinGecko application | 3.4.3-3.4.4 | 2 dny |
| **Z** | wZION ERC-20 kontrakt + Bridge | 3.4.5-3.4.6 | 2 týdny |
| **AA** | Logo pack (SVG/PNG, CMC rozměry) | 3.4.7 | 1 den |
| **BB** | Node setup guide pro burzy | 3.4.1 | 1 den |

---

## 📅 Timeline Shrnutí

```
╔══════════════════════════════════════════════════════════════════╗
║              ZION MAINNET TIMELINE — 2026                        ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  ÚNOR        🔥 TIER 1: CH sjednocení, nonce fix, rotace        ║
║              ⚡ TIER 2: 72h stability, config, reorg TX          ║
║                                                                  ║
║  BŘEZEN      🛡️ TIER 3: BFG cleaner, seed DNS, explorer BE      ║
║              🌍 TIER 4: Node UX, explorer FE, mining guides      ║
║                                                                  ║
║  DUBEN       🌍 TIER 4: CLI, solo mining, structured logs        ║
║              📝 Fáze 2 Exit: node za 10 min, explorer běží       ║
║                                                                  ║
║  KVĚTEN      🚀 TIER 5: Supply API, whitepaper PDF, CMC app      ║
║                                                                  ║
║  ČERVEN      🚀 TIER 5: wZION bridge, exchange partnerships      ║
║              📝 Fáze 3 Exit: infra + legal hotovo                ║
║                                                                  ║
║  ČERVENEC    🔒 Code Freeze — tag v2.9.5-mainnet-rc1             ║
║              🧪 Finální security audit, fuzz testing              ║
║                                                                  ║
║  SRPEN       🔑 Genesis block sestavení, seed nody live           ║
║              📋 Pre-flight checklist — všechny P0 splněny         ║
║                                                                  ║
║  ZÁŘÍ–ŘÍJEN  🧪 Public testnet, bug bounty program               ║
║                                                                  ║
║  LISTOPAD    📢 Announcement, miner downloads, guides             ║
║                                                                  ║
║  PROSINEC    🟢 MAINNET GENESIS LAUNCH                           ║
║              🎄 31. 12. 2026 — L1 goes live                      ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
```

---

## 🏗️ Architektura — Workspace vs. Roadmap Reality Check

| Roadmap říká | Workspace realita | Gap |
|---|---|---|
| L1 blockchain PoW + UTXO | ✅ Existuje, 420 testů | — |
| Cosmic Harmony v3 ASIC-resistant | ✅ Implementováno | 🔴 Rotace vypnuta, 3 implementace! |
| LWMA DAA 60-block | ✅ Hotovo, 18 testů | — |
| Fee burning | ✅ Implementováno | — |
| Mining pool Stratum v2 + PPLNS | ✅ Funguje | 🟡 Revenue vrstva nestabilní |
| 16.78B genesis premine | ✅ V kódu | 🔴 Testnet adresy |
| Config runtime loading | ⚠️ TOML existují | 🟡 Nečtou se runtime |
| Block Explorer | ❌ Neexistuje | 🔴 Kritické pro listing |
| DNS seed nody | ❌ Neresolvují | 🔴 Kritické pro mainnet |
| 72h stability run | ❌ Nesplněno | 🟡 Fáze 1 exit criteria |
| L2 DEX & DeFi (2027) | ❌ Zatím nic | Plánované Q1 2027 |
| L3 Warp & AI Native | 🟡 NCL stub v mineru | Plánované Q3 2027 |
| L4 ZION Oasis (UE5) | 🟡 `ZionOasis_UE5/` existuje | Plánované 2029+ |

---

## 📋 Preflight Checklist Progress

Z [MAINNET_PREFLIGHT_CHECKLIST.md](MAINNET_PREFLIGHT_CHECKLIST.md) — **celkový audit skóre 5/10**:

| Oblast | Skóre | Vyřešeno z auditu |
|--------|-------|-------------------|
| Core Rust kód | 8/10 | ✅ Solidní |
| Consensus bezpečnost | 5/10 | ⚠️ Reorg pravidla, CH mismatch |
| Pool | 6/10 | ⚠️ Rate limit ✅, dual payout |
| P2P networking | 4/10 | ⚠️ 2 seedy, žádná auth |
| Storage | 6/10 | ⚠️ Balance cache ✅, UTXO index chybí |
| Miner | 7/10 | ⚠️ CH mismatch je P0! |
| Website bezpečnost | 4/10 → 7/10 | ✅ CSP, CORS, rate limit, admin auth |
| Secrets management | 2/10 | 🚨 Private keys stále na disku |
| Docker/Deploy | 5/10 → 7/10 | ✅ Non-root, resource limits, read_only |
| CI/CD | 6/10 | ✅ Rust CI OK, ❌ web CI chybí |
| Monitoring | 5/10 | ⚠️ Alertmanager nenastavený |
| **Celkové hodnocení** | **5/10** | **Potřeba ~25 oprav pro mainnet readiness** |

---

## 💡 Doporučený Okamžitý Next Step

**→ TIER 1-A: Sjednocení Cosmic Harmony implementací**

Toto je **nejkritičtější single blocker** pro celý projekt. Dokud existují 3 různé implementace PoW algoritmu, miner a core validátor se nemohou shodnout na validitě bloků. Vše ostatní (revenue, explorer, legal) je sekundární.

**Postup:**
1. `cosmic-harmony/src/lib.rs` = jediná reference implementace
2. `core/` přidá `cosmic-harmony` jako cargo dependency
3. Smazat `core/src/algorithms/cosmic_harmony.rs` (legacy v1)
4. Smazat inline f64 fallback v `miner/src/native_algos.rs`
5. Sjednotit nonce na `u64` (64-bit) všude
6. `cargo test --workspace` — ověřit 420+ testů
7. Deploy na testnet servery — ověřit block production

---

> **"Simple things should be simple, complex things should be possible."**  
> — Alan Kay
>
> L1 je srdce. Nikdy nekompromitujeme L1 kvůli vyšším vrstvám.

**Peace and One Love ☮️❤️ — Yeshua E.**
