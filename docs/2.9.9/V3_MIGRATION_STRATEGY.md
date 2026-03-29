# ZION v2.9.9 → v3.0 Mainnet — Migrační strategie

> Datum: 2026-03-12  
> Status: SCHVÁLENO  
> Rozhodnutí: Toto repo (2.9.6 workspace) = historický archiv. v3.0 = nové repo.

---

## Strategické rozhodnutí

### Tento repozitář (2.9.6) se dotáhne na 99% mainnet-ready a pak se zamrazí jako historický archiv.

Nové v3.0 Mainnet repo vznikne čistou migrací ověřeného kódu — žádný `git filter-branch`,
žádné přetahování historického balastu. Jen to, co prošlo auditem.

---

## Proč dva repozitáře

| Důvod | Detail |
|-------|--------|
| **Čistá git historie** | 2.9.x má stovky experimentálních commitů, rollbacků, hotfixů. v3.0 začíná od audited baseline. |
| **Audit scope** | Auditor dostane jeden commit s jasným obsahem, ne 18 měsíců historie. |
| **Nulové riziko regresu** | Archiv 2.9.x zůstává funkční pro referenci. v3.0 nezdědí žádný mrtvý kód. |
| **Parallel development** | Pokud se objeví 2.9.x hotfix potřeba, archiv je stále buildovatelný. |
| **Právní čistota** | License, copyright a dependency audit začíná na čistém listu. |

---

## Životní cyklus

```
┌─────────────────────────────────────────────────────────────┐
│  FÁZE 1: Dokončení 2.9.9 (tento repo)                      │
│                                                             │
│  ✅ Phase A — Rust dispatch konsolidace (HOTOVO)            │
│  ⏳ Phase D — GPU kernel sync audit                         │
│  ⏳ Phase F — Release gate (testy + benchmark)              │
│  ⏳ Pool E2E + parity verification                          │
│  ⏳ Internal Audit progress                                 │
│  → Výstup: repo tagged v2.9.9-archive, README updated      │
├─────────────────────────────────────────────────────────────┤
│  FÁZE 2: Vytvoření v3.0 Mainnet repo                       │
│                                                             │
│  - Nový git init (čistá historie)                           │
│  - Cherry-pick audited modules z 2.9.9:                     │
│      L1/cosmic-harmony/  (PoW + hugepages + GPU backends)   │
│      L1/core/            (chain, consensus, validation)     │
│      L1/pool/            (stratum, template, revenue)       │
│      L1/miner/           (GPU dispatch, native algos)       │
│  - Nový Cargo.toml workspace (version = "3.0.0")           │
│  - Žádné APP&WEB, žádné docs/2.9.x, žádné legacy scripts  │
│  → Výstup: v3.0.0-rc1 tag                                  │
├─────────────────────────────────────────────────────────────┤
│  FÁZE 3: Mainnet Genesis                                    │
│                                                             │
│  - Genesis ceremony (C-01/C-02 z interního auditu)          │
│  - Deploy na kanonický host (91.98.122.165)                 │
│  - 7-day canary run                                         │
│  - GO/NO-GO → v3.0.0 release                               │
│  → Výstup: ZION L1 Mainnet LIVE                             │
├─────────────────────────────────────────────────────────────┤
│  FÁZE 4: Archivace                                          │
│                                                             │
│  - 2.9.6 repo → public archive (read-only)                 │
│  - README: "Historical development archive. See v3.0 for   │
│    mainnet code."                                           │
│  - Zachovány všechny branch + tags pro referenci            │
│  → Výstup: dva repozitáře, jasná hranice                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Co migruje do v3.0

### ✅ MIGRUJE (audited, production-ready)

| Modul | Cesta v 2.9.x | Poznámka |
|-------|---------------|----------|
| Cosmic Harmony PoW | `L1/cosmic-harmony/src/` | Ekam Deeksha kanonický, hugepages, GPU backends |
| Blockchain core | `L1/core/src/` | Chain, consensus, validation, LWMA DAA |
| Pool + Stratum | `L1/pool/src/` | Template manager, stratum protocol, revenue |
| Miner runtime | `L1/miner/src/` | GPU dispatch, native algos, Python fallback |
| Metal shader | `L1/cosmic-harmony/src/gpu/metal_shader.metal` | Ekam kernely |
| OpenCL/CUDA kernely | `L1/cosmic-harmony/src/gpu/kernels/` | Deeksha kanonické |
| Config (mainnet) | `config/mainnet.toml` | Produkční konfigurace |
| Docker (produkce) | `docker/Dockerfile.*` + compose files | Deployment |
| Monitoring | `monitoring/` | Prometheus, Grafana, alerts |

### 🔒 ZŮSTÁVÁ V ARCHIVU (nemigruje)

| Oblast | Důvod |
|--------|-------|
| `APP&WEB/` (website, desktop-agent, mobile-app) | Oddělený frontend lifecycle |
| `docs/2.9.5/` – `docs/2.9.8/` | Historický kontext |
| `Zion-2.9.5-main/` | Archaická kopie |
| Legacy Python skripty | Archivovány, nevolány z produkce |
| Legacy .dylib knihovny | Archivovány pro referenci |
| `tools/`, `tests/` (exploratorní) | Přepsat pro v3.0 test suite |
| `scripts/` (deploy, dashboard) | v3.0 dostane nové CI/CD |

### ⚡ REFAKTORUJE SE PŘI MIGRACI

| Co | Jak |
|----|-----|
| `NativeAlgorithm` enum | Odstranit `CosmicHarmonyV42`, ponechat jen `CosmicHarmonyDeeksha` + aliasy |
| `PythonMinerVariant` | Jen `DeekshaCanonical` |
| `metal_miner.rs` | Smazat `mine_legacy_chv4()`, `has_ekam_kernels()` |
| Cargo.toml verze | 3.0.0 across workspace |
| Log messages | Odstranit "ekam", "legacy", "v42" prefix |

---

## Předpoklady pro zamrazení 2.9.9

Než se repo označí jako archiv, musí splnit:

- [ ] **GPU kernel sync audit** — 4 kopie Ekam kernelů = identické SHA-256
- [ ] **97/97 cosmic-harmony testů PASS** (aktuálně ✅)
- [ ] **11/11 pool E2E testů PASS**
- [ ] **GPU benchmark ≥ 25 kH/s** na hlavním GPU backendu (Apple M1 Metal ✅ 29.18 kH/s, NVIDIA RTX 5090 CUDA ✅ 30.37 kH/s)
- [ ] **Kanonický test vektor bit-perfect** na CPU + GPU
- [ ] **Internal Audit** — alespoň sekce A (consensus), B (algoritmus), G (testy) uzavřeny
- [ ] **README.md** aktualizován s archivním statusem
- [ ] **Tag `v2.9.9-archive`** vytvořen

---

## Timeline (orientační)

| Týden | Cíl |
|-------|-----|
| **Tento** | GPU kernel audit, pool E2E, MIGRATION_CHECKLIST update |
| **+1** | Internal Audit sekce A+B+G, desktop smoke test |
| **+2** | Freeze 2.9.9, tag archive, init v3.0 repo |
| **+3** | v3.0 cherry-pick + Cargo.toml 3.0.0 + CI setup |
| **+4** | v3.0-rc1 tag, genesis ceremony prep |
