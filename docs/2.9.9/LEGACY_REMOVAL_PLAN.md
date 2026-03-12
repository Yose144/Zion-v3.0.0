# ZION v2.9.9 — Pure Code Legacy Plan (Conservative)

> Datum: 2026-03-12  
> Aktualizováno: 2026-03-12 (archivní strategie)  
> Status: FÁZE A IMPLEMENTOVÁNA  
> Předpoklad: v2.9.8 Ekam Deeksha je stabilní a živě běží

---

## Filozofie: Archivovat, ne mazat

**Zásada: Žádný kód se nemaže. Legacy kód se archivuje pro možnou budoucí aktivaci.**

- Revenue system: **NEDOTČEN** (všech 5 streamů zůstává funkčních)
- Nativní knihovny (.dylib/.so): **NEDOTČENY** (všechny zachovány)
- Python skripty: **ZACHOVÁNY** (možná budoucí aktivace)
- GPU kernely: **ZACHOVÁNY** (legacy shadery zůstávají v resources)
- Rust enum varianty: **ZACHOVÁNY** (backward compatible aliasy)
- PythonMinerVariant: **ZACHOVÁNY** (všechny 4 varianty)

---

## Přehled

Tento dokument kategorizuje legací kód podle typu změny.
Konzervativní přístup: přejmenovat a archivovat, nikdy smazat.

- ✅ **HOTOVO** — Přejmenováno/konsolidováno v rámci Phase A
- 🟡 **ARCHIV** — Zachováno pro možnou budoucí aktivaci
- 🟢 **NEDOTČENO** — Funkční kód, beze změny

---

## 🟡 Python skripty — ARCHIV (zachovány)

### Desktop-agent resources/mining/

Všechny Python skripty zůstávají na místě pro možnou budoucí aktivaci:

| Soubor | Status | Poznámka |
|--------|--------|----------|
| `cosmic_harmony_v3_gpu.py` | 🟡 ARCHIV | Starý OpenCL-only wrapper |
| `cosmic_harmony_v3_python.py` | 🟡 ARCHIV | Starý CPU Python miner |
| `cosmic_harmony_v4_metal_gpu.py` | 🟡 ARCHIV | Pre-Ekam Metal wrapper |
| `cosmic_harmony_v4_native.py` | 🟡 ARCHIV | Pre-Deeksha native lib wrapper |
| `cosmic_harmony_native.py` | 🟡 ARCHIV | v3 native wrapper |
| `cosmic_harmony_deeksha_fallback.py` | ✅ AKTIVNÍ | Kanonický Deeksha fallback |
| `cosmic_harmony_v42_gpu.py` | ✅ AKTIVNÍ | Kanonický GPU wrapper (Ekam) |

### GPU kernely — ARCHIV (zachovány)

Všechny GPU kernel soubory zůstávají:

| Soubor | Status | Poznámka |
|--------|--------|----------|
| `cosmic_harmony_v42.metal` | 🟡 ARCHIV | CHv4.2 Merkabah shader |
| `cosmic_harmony_v42.cu` | 🟡 ARCHIV | CHv4.2 CUDA kernel |
| `cosmic_harmony_v42.cl` | 🟡 ARCHIV | CHv4.2 OpenCL kernel |
| `cosmic_harmony_deeksha_canonical.cl` | 🟡 ARCHIV | Duplicitní kopie |
| `metal_shader.metal` | ✅ AKTIVNÍ | Kanonický Ekam Deeksha + legacy CHv4 |
| `cosmic_harmony_deeksha.cl` | ✅ AKTIVNÍ | Kanonický Ekam Deeksha OpenCL |
| `cosmic_harmony_deeksha.cu` | ✅ AKTIVNÍ | Kanonický Ekam Deeksha CUDA |

### Nativní knihovny — VŠECHNY ZACHOVÁNY

Všechny binární knihovny zůstávají nedotčeny:

| Soubor | Status | Poznámka |
|--------|--------|----------|
| `libcosmic_harmony.dylib` | 🟡 ARCHIV | Pre-Deeksha varianta |
| `libcosmic_harmony_v42.dylib` | 🟡 ARCHIV | CHv4.2 Merkabah build |
| `libcosmic_harmony_zion.dylib` | 🟡 ARCHIV | Archaická varianta |
| `libcosmicharmony.dylib` | 🟡 ARCHIV | Typo/neznámý původ |
| `libcosmic_harmony_v4_metal.dylib` | 🟡 ARCHIV | Obsoletní Metal wrapper |
| `libcosmic_harmony_deeksha.dylib` | ✅ AKTIVNÍ | Kanonická Ekam Deeksha (v2.9.8) |
| `librandomx_zion.dylib` | ✅ AKTIVNÍ | XMR mining (Revenue) |
| `libyescrypt_zion.dylib` | ✅ AKTIVNÍ | LTC mining (Revenue) |

---

## ✅ Phase A — IMPLEMENTOVÁNO (Rust dispatch konsolidace)

### A.1 Rust: MetalMiner — přejmenování (archivováno, ne smazáno)

**Soubor:** `L1/cosmic-harmony/src/gpu/metal_miner.rs`

| Změna | Detail |
|-------|--------|
| Přejmenováno | `mine()` → `mine_legacy_chv4()` (archivováno) |
| Přejmenováno | `mine_ekam()` → `mine()` (kanonická cesta) |
| Přejmenováno | `batch_hash()` → `batch_hash_legacy_chv4()` (archivováno) |
| Přejmenováno | `batch_hash_ekam()` → `batch_hash()` (kanonická cesta) |
| Zachováno | `has_ekam_kernels()` (runtime detekce) |
| Zachováno | `pipeline_mine` + `pipeline_ekam_mine` fields |
| Zachováno | `parity_check_legacy()` + `parity_check_with_height()` |
| Zjednodušeno | `benchmark()` — vždy volá `mine()` (Ekam) |

### A.2 Rust: Miner wrapper — zjednodušený dispatch

**Soubor:** `L1/miner/src/miner/gpu/metal.rs`

Před:
```rust
let result = if inner.has_ekam_kernels() {
    inner.mine_ekam(header, target, nonce_start, height)
} else {
    inner.mine(header, target, nonce_start, height)
};
```

Po:
```rust
let result = inner.mine(header, target, nonce_start, height);
```

Legacy cesta `mine_legacy_chv4()` zůstává dostupná pro budoucí aktivaci.

---

## 🟢 NEDOTČENO — Zachováno beze změny

### Revenue System (všech 5 streamů)

| Modul | Poznámka |
|-------|----------|
| `L1/cosmic-harmony/src/revenue.rs` | RevenueCollector + RevenueBreakdown |
| `L1/cosmic-harmony/src/ncl_integration.rs` | NCL AI Bonus (5. stream) |
| `L1/miner/src/ncl/mod.rs` | NCL AI client (40%→20% target) |
| `L1/miner/src/miner/stream_aware.rs` | ZION vs Revenue stream routing |
| `L1/miner/src/miner/dual_stream.rs` | Non-revenue job handling |
| `L1/miner/src/miner/external_pool.rs` | Revenue model + pool routing |
| `L1/pool/src/profit_switcher.rs` | Profitability switching (BTC/USD 24h) |

### NativeAlgorithm Enum

Všechny varianty zachovány včetně `CosmicHarmonyV42` — `from_str()` aliasy
zajišťují backward kompatibilitu s pooly a staršími klienty.

### PythonMinerVariant Enum

Všechny 4 varianty zachovány: `Chv3Gpu`, `Chv42`, `DeekshaCanonical`, `Legacy`.
Skript discovery logic v `find_script()` gracefully handí chybějící soubory.

### Desktop-agent main.js

Beze změny. Fallback chain zůstává původní.

### Nativní knihovny

Všechny .dylib zachovány (viz tabulka výše).

---

## Validační strategie

Po každém TIER kroku:

1. `cargo test -p zion-cosmic-harmony-v3 --lib` — 96+ testů PASS
2. `cargo test -p zion-pool --test chv4_e2e` — 11+ testů PASS
3. `cargo build -p zion-miner --features metal --release` — kompilace bez chyb
4. `node --check APP&WEB/desktop-agent/src/main.js` — syntax OK
5. Benchmark: `cargo run -p zion-miner --features metal --release -- benchmark` → ≥25 kH/s na M1
6. Kanonický test vektor: hash `6339f2fb...` musí projít na všech cestách

---

## Rizika

| Riziko | Mitigace |
|--------|----------|
| Pool přestane přijímat staré `algo=cosmic_harmony` loginy | Ponechat aliasy v `from_str()`, nemaže se pool-facing parsing |
| Desktop-agent packaging se rozbije | Aktualizovat `prepare-rust-miner.js` a `package.json` resources spolu se smazanými soubory |
| Starý miner se nepřipojí | Pool backward-compatible, miner se aktualizuje celý |
| GPU shader přestane kompilovat | Smoke test na Metal/OpenCL po každém kernel smazání |
