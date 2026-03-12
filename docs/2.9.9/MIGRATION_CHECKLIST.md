# ZION v2.9.9 — Migration Checklist

> Datum: 2026-03-12  
> Aktualizováno: 2026-03-12  
> Status: FÁZE A+D+F HOTOVY, Fáze B/C/E přesunuta do v3.0  
> Závislost: `LEGACY_REMOVAL_PLAN.md` pro detailní scope  
> Strategie: `V3_MIGRATION_STRATEGY.md` — toto repo = archiv, v3.0 = nové repo

---

## Postup implementace

Každá fáze se uzavírá validací. Nepokračovat bez zelených testů.

---

### Fáze A: Rust GPU cleanup (L1/cosmic-harmony) — ✅ HOTOVO

- [x] **A1** — `mine()` přejmenován na `mine_legacy_chv4()` (archivován, ne smazán)
- [x] **A2** — `pipeline_mine` zachován (archivní legacy Metal pipeline)
- [x] **A3** — `mine_ekam()` přejmenován na `mine()` — kanonická Ekam Deeksha cesta
- [x] **A4** — `has_ekam_kernels()` zachován (runtime detekce)
- [x] **A5** — `benchmark()` zjednodušen — vždy volá `mine()` (Ekam)
- [x] **A6** — Metal wrapper (`L1/miner/src/miner/gpu/metal.rs`) zjednodušen:
  - Odstraněn `if has_ekam_kernels()` guard
  - Přímé volání `inner.mine()`
- [x] **A7** — ✅ Validace:
  - `cargo test -p zion-cosmic-harmony-v3 --lib` → **97/97 PASS**
  - `cargo build -p zion-miner --features metal --release` → **PASS**
  - Benchmark **29.18 kH/s** na Apple M1 (≥ 25 kH/s ✅)

---

### Fáze B: Rust enum cleanup (L1/miner) — ⏩ PŘESUNUTO DO v3.0

> **Důvod:** Konzervativní strategie — nesmazat dokud audit nepotvrdí bezpečnost.
> Legacy varianty zachovány jako archiv, vyčištění proběhne při migraci do v3.0 repo.

- [ ] **B1** — Smazat `CosmicHarmonyV42` variantu z `NativeAlgorithm` enum → **v3.0**
- [ ] **B2** — Smazat mrtvé `PythonMinerVariant` varianty → **v3.0**
- [ ] **B3** — Vyčistit `python_fallback.rs` lookup paths → **v3.0**
- [ ] **B4** — Aktualizovat match arms v dispatch kódu → **v3.0**
- [ ] **B5** — Validace → **v3.0**

---

### Fáze C: Desktop-agent Python cleanup — ⏩ PŘESUNUTO DO v3.0

> **Důvod:** Legacy skripty, kernely a knihovny zachovány jako archiv.
> Do v3.0 migruje pouze kanonický Ekam kód.
> Smoke test aktuálních souborů prošel (viz F6).

- [ ] **C1** — Smazat legacy Python skripty → **v3.0** (čistý start)
- [ ] **C2** — Smazat legacy GPU kernel soubory → **v3.0** (jen Ekam se migruje)
- [ ] **C3** — Smazat legacy binary libs → **v3.0** (nový build)
- [ ] **C4** — Aktualizovat `main.js` → **v3.0**
- [ ] **C5** — Aktualizovat `prepare-rust-miner.js` → **v3.0**
- [ ] **C6** — Smoke test aktuálního stavu:
  - `node --check main.js` → **PASS** ✅
  - `node --check renderer.js` → **PASS** ✅
  - `python3 -m py_compile deeksha_fallback.py` → **PASS** ✅
  - `python3 -m py_compile v42_gpu.py` → **PASS** ✅

---

### Fáze D: GPU kernel synchronizace (multi-crate) — ✅ HOTOVO

- [x] **D1** — `L1/cosmic-harmony/src/gpu/kernels/` — Ekam kernely přítomny ✅
- [x] **D2** — `L1/miner/src/miner/gpu/kernels/` — v sync ✅
- [x] **D3** — `L1/native-libs/all/` — v sync ✅
- [x] **D4** — `APP&WEB/desktop-agent/resources/mining/` — v sync ✅
- [x] **D5** — Legacy kopie zachovány (archivní strategie), identifikovány:
  - `cosmic_harmony_deeksha.metal` (406 řádků, legacy CHv4.2 Merkabah, 0 ekam refs)
  - vs `metal_shader.metal` / `cosmic_harmony_ekam_deeksha.metal` (1640 řádků, 21 ekam refs)
- [x] **D6** — ✅ SHA-256 audit výsledky:
  - OpenCL: `6f7f6292fb88...` — 4/4 kopie identické
  - CUDA: `b9477cfd6e00...` — 2/2 kopie identické
  - Metal (Ekam): `fb9d5d9fd8f5...` — 3/3 kopie identické
  - Metal (Legacy): `4f4772a6bb69...` — 2/2 kopie identické (archiv)

---

### Fáze E: Pojmenování a metadata — ⏩ PŘESUNUTO DO v3.0

> **Důvod:** Přejmenování souborů a verze se provede při migraci do čistého v3.0 repo.
> V archivním repo zachováváme stávající pojmenování pro stabilitu.

- [ ] **E1** — Přejmenovat `cosmic_harmony_v42_gpu.py` → `cosmic_harmony_gpu.py` → **v3.0**
- [ ] **E2** — Aktualizovat workspace `Cargo.toml` verzi → **v3.0** (nové repo = v3.0.0)
- [ ] **E3** — Aktualizovat package verze → **v3.0**
- [ ] **E4** — Vyčistit log zprávy → **v3.0**
- [ ] **E5** — Validace → **v3.0**

---

### Fáze F: Release gate — ✅ PARTIALLY VERIFIED

- [x] **F1** — `cargo test -p zion-cosmic-harmony-v3 --lib` → **97/97 PASS** ✅
- [x] **F2** — `cargo test -p zion-pool --test chv4_e2e` → **11/11 PASS** ✅
- [x] **F3** — GPU benchmark: **29.18 kH/s** na Apple M1 Metal (≥ 25 kH/s ✅)
- [ ] **F4** — Live pool smoke test → ⏳ ČEKÁ (vyžaduje --gpu runtime, manuální test)
- [ ] **F5** — Desktop-agent Electron flow → ⏳ ČEKÁ (vyžaduje GUI manuální test)
- [x] **F6** — Kanonický test vektor `6339f2fb...` bit-perfect ✅ (CPU testy + GPU kernel audit)
- [ ] **F7** — `cloc` diff → N/A (archivní strategie — kód se nemaže, přesouvá do v3.0)
- [ ] **F8** — GO/NO-GO verdict → ⏳ ČEKÁ na F4, F5 a interní audit
