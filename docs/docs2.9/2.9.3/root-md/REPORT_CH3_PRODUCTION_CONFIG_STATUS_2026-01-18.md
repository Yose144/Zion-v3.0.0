# REPORT: CH3 Production Config Status
**Date:** 18. ledna 2026  
**Scope:** aktuální stav `ch3` konfigurace v produkci (Helsinki + Singapore)

---

## ✅ Shrnutí
- CH3 je na obou serverech **zapnuté** (`ch3.enabled = true`).
- Merged mining:
  - `etc` je **enabled** a má nastavený wallet.
  - `nxs` je **disabled** (wallet prázdný).
- Dynamic GPU:
  - režim je **auto**, ale reálně je **enabled jen RVN** (Ravencoin) – ostatní coiny jsou disabled / bez wallet.

---

## 🇸🇬 Singapore (5.223.56.122 / zion-pool-singapore)
**CH3:** enabled = `true`

**Merged mining:**
- `etc`: enabled = `true`, wallet = `0x79021A00024Ed82b0C9f4631ad9D0fB6B6A484A8`
- `nxs`: enabled = `false`, wallet = *(empty)*

**Dynamic GPU:** enabled = `true`, mode = `auto`
- `rvn`: enabled = `true`, wallet = `RBv3HUypznKQ8gHnATNiDu145hs7pZj6DZ`
- `erg`: enabled = `false`, wallet = *(empty)*
- `kas`: enabled = `false`, wallet = *(empty)*
- `alph`: enabled = `false`, wallet = *(empty)*

---

## 🇫🇮 Helsinki (77.42.31.72)
**CH3:** enabled = `true`

**Merged mining:**
- `etc`: enabled = `true`, wallet = `0x79021A00024Ed82b0C9f4631ad9D0fB6B6A484A8`
- `nxs`: enabled = `false`, wallet = *(empty)*

**Dynamic GPU:** enabled = `true`, mode = `auto`
- `rvn`: enabled = `true`, wallet = `RBv3HUypznKQ8gHnATNiDu145hs7pZj6DZ`
- `erg`: enabled = `false`, wallet = *(empty)*
- `kas`: enabled = `false`, wallet = *(empty)*

---

## 🧠 Poznámka k „algům“
V Python pool configu (`ch3.merged_mining.*`, `ch3.dynamic_gpu.coins.*`) se používají coin-klíče (`etc`, `nxs`, `rvn`, `erg`, `kas`, `alph`).

V Rust CHv3 (autorouter/profit switching) tomu odpovídají `AlgorithmType`:
- `etc` → `Ethash` (WhatToMine: Etchash)
- `rvn` → `KawPow`
- `erg` → `Autolykos2`
- `kas` → `KHeavyHash`
- `alph` → `Blake3`

---

## ✅ Doporučený další krok (pokud chceme víc než RVN)
- Nastavit wallet + enabled pro `erg` (a případně `kas`/`alph`) a udělat krátký smoke test submitu na externí pool.
