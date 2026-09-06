# ZION — Hloubková analýza: Dokumentace vs. Kód

**Datum:** 2026-03-12  
**Rozsah:** v2.9.5 → v2.9.8 (Deeksha)  
**Metoda:** Automatické skenování 250+ markdown dokumentů × skutečný stav kódu (grep, LOC count, `#[test]` count)

---

## 1. SOUHRN

| Metrika | Dokumentace tvrdí | Skutečnost v kódu | Verdikt |
|---------|-------------------|-------------------|---------|
| **Celkem Rust LOC** | 15 350 – 70 991 (dle dokumentu) | **114 520** | ⚠️ Všechny docs zastaralé |
| **Celkem Rust testů** | 108 – 850 (dle dokumentu) | **1 379 `#[test]`** | ⚠️ Všechny docs zastaralé |
| **L2/L3/L4 stav** | „Skeleton" (10–25 %) | **39 535 LOC, 650 testů** | ❌ Výrazný rozpor |
| **Topologie** | 3 nody (Helsinki/USA/Asia) | **Jeden primární host 91.98.122.165** | ❌ Stale v min. 3 docs |
| **Workspace verze** | v2.9.8 (v docs i website) | **Cargo.toml = 2.9.6** | ⚠️ Nesoulad |
| **.rs souborů** | Neuvedeno | **340 souborů** | — |
| **Solidity kontrakty** | 7 (správně) | **7 vlastních .sol** + testy | ✅ Odpovídá |

---

## 2. ROZPORY V POČTU ŘÁDKŮ KÓDU (LOC)

Každý dokument uvádí jinou hodnotu LOC, žádná neodpovídá realitě:

| Dokument | Datum | Tvrzený LOC | Skutečný LOC | Odchylka |
|----------|-------|-------------|-------------|----------|
| `REAL_STATUS_v2.9.5.md` | Leden 2026 | ~15 350 | 114 520 | **−86 % (7.5× podhodnoceno)** |
| `DEEP_PROJECT_ANALYSIS.md` | 3. únor 2026 | 17 245 | 114 520 | **−85 %** |
| `MAINNET_READINESS-ROADMAP.md` | 17. únor 2026 | 66 489 | 114 520 | **−42 %** |
| `ROADMAP.md` | 17. únor 2026 | 70 991 | 114 520 | **−38 %** |
| `L1-L4_ROADMAP.md` | 16. únor 2026 | ~53k (L1 only) | 74 985 (L1) | **−29 %** |

### Skutečné LOC per vrstva:

| Vrstva | Skutečné LOC | Nejnovější doc tvrdí |
|--------|-------------|---------------------|
| **L1 celkem** | 74 985 | ~53k (L1-L4_ROADMAP) |
| — L1/core | 22 684 | ~16 202 (READINESS) → ~17k (website) |
| — L1/pool | 19 546 | ~14 441 (READINESS) → ~12k (website) |
| — L1/miner | 14 480 | ~10 233 (READINESS) → ~6k (website) |
| — L1/cosmic-harmony | 17 944 | ~12 421 (READINESS) → ~11k (website) |
| **L2 celkem** | 21 387 | ~4 212 (READINESS) |
| **L3 celkem** | 14 654 | ~6 645 (READINESS) |
| **L4 celkem** | 3 494 | ~2 335 (READINESS) |

---

## 3. ROZPORY V POČTU TESTŮ

| Dokument | Datum | Tvrzený počet | Skutečný `#[test]` | Odchylka |
|----------|-------|---------------|-------------------|----------|
| `REAL_STATUS_v2.9.5.md` | Leden 2026 | 108 | 1 379 | **−92 %** |
| `ROADMAP.md` | Únor 2026 | 377 | 1 379 | **−73 %** |
| `ROADMAP_2.9.7.md` | Březen 2026 | 241+ | 1 379 | **−83 %** |
| `MAINNET_READINESS-ROADMAP.md` | Únor 2026 | 850 | 1 379 | **−38 %** |

### Skutečné testy per vrstva:

| Vrstva / Crate | Skutečné `#[test]` | Website roadmap tvrdí |
|---|---|---|
| **L1 celkem** | **729** | — |
| — L1/core | 433 | 275 |
| — L1/pool | 115 | 132 |
| — L1/miner | 79 | 73 |
| — L1/cosmic-harmony | 95 | 68 |
| **L2 celkem** | **245** | Neuvedeno na webu |
| — L2/bridge | 167 | — |
| — L2/dao | 63 | — |
| — L2/atomic-swap | 15 | — |
| **L3 celkem** | **356** | Částečně (warp: 252 → skutečnost 237) |
| — L3/warp | 237 | 252 |
| — L3/ncl | 37 | — |
| — L3/ai-native | 82 | — |
| **L4/oasis** | **49** | Neuvedeno |
| **CELKEM RUST** | **1 379** | ~800 (website součet) |

> **Poznámka:** Website roadmap page zobrazuje L2/L3/L4 jen částečně — chybí bridge, dao, atomic-swap, ncl, ai-native, oasis.

---

## 4. ROZPOR: L2/L3/L4 „SKELETON" vs. REALITA

Více dokumentů označuje L2–L4 jako „skeleton" s 10–25% readiness:

| Dokument | Tvrzení | Skutečnost |
|----------|---------|-----------|
| `MAINNET_READINESS-ROADMAP.md` | L2/bridge: „Skeleton + tests" 25 % | **21 387 LOC, 245 testů — reálný bridge + DAO + atomic swap** |
| `MAINNET_READINESS-ROADMAP.md` | L3/warp: „Skeleton + tests" 15 % | **14 654 LOC, 356 testů — 7-chain adapter + NCL + AI-native** |
| `MAINNET_READINESS-ROADMAP.md` | L4/oasis: „Skeleton" 10 % | **3 494 LOC, 49 testů — consciousness gaming se guildy, territory, leaderboards** |
| `L1-L4_ROADMAP.md` | L2/L3/L4 = 🟡 Skeleton | Všechny mají binární entry pointy (main.rs), SQLite DB, REST API |

**Verdikt:** Tyto vrstvy dávno přerostly „skeleton" fázi. Mají tisíce řádků produkčního kódu, stovky testů, a reálné funkce (governance voting, HTLC atomic swaps, 7-chain bridge, AI task marketplace, gaming leaderboards).

---

## 5. ROZPORY V TOPOLOGII

Infrastruktura byla konsolidována na jeden host (91.98.122.165), ale min. 3 klíčové 2.9.8 dokumenty stále referují starou 3-nodovou topologii:

| Dokument | Stará reference | Skutečnost |
|----------|----------------|-----------|
| `docs/2.9.8/DEPLOY_REPORT_2.9.8.md` | Helsinki 77.42.31.72, USA 178.156.240.160, Asia 5.223.43.93 — „all 3 UP healthy" | Jediný primární host 91.98.122.165 |
| `docs/2.9.8/GO_NO_GO_2.9.8.md` | „3-node chain sync Helsinki/USA/Asia" | Konsolidováno na Zion2 |
| `docs/2.9.8/COSMIC_HARMONY_DEEKSHA_SPEC.md` | Testováno na 3 serverech | Jediný host |

> **STATUS_REPORT_2026-03-10.md** i **site.ts** správně reflektují single-host topologii. Deploy report a GO_NO_GO jsou pozůstatky pre-konsolidace.

---

## 6. ROZPORY VE VERZÍCH

| Komponenta | Verze | Komentář |
|------------|-------|---------|
| **Cargo.toml (workspace)** | **2.9.6** | Vývojový základ |
| **cosmic-harmony Cargo.toml** | **3.0.0** | Vlastní crate verze¹ |
| **Website package.json** | **2.9.8** | Napřed oproti Cargo |
| **Desktop-agent package.json** | **2.9.7** | Zaostává za website |
| **site.ts `SITE_VERSION`** | **v2.9.8** | Napřed oproti Cargo |
| **Docs / release notes** | **2.9.8** | Napřed oproti Cargo |
| **README.md subtitle** | **v2.9.6 "On the Star"** | Zaostává za release notes |

¹ cosmic-harmony má odlišný versioning (v3.0.0) oproti workspace (v2.9.6). To je záměr — crate je interně verze 3 kvůli CHv3/v4 evoluci. Není to chyba.

**Klíčový rozpor:** Cargo workspace je stále 2.9.6, ale veškerá dokumentace, website, i runtime referují 2.9.8 Deeksha. Buď bumpit Cargo na 2.9.8, nebo explicitně zdokumentovat, že Cargo workspace verze != release verze.

---

## 7. WEBSITE ROADMAP vs. KÓD

Stránka `/roadmap` (roadmap/page.tsx) obsahuje komponentní tabulku s outdated čísly:

| Komponenta (website) | Website LOC | Skutečné LOC | Website testy | Skutečné testy |
|---|---|---|---|---|
| core/ (blockchain) | ~17k | **22 684** | 275 | **433** |
| cosmic-harmony/ (PoW) | ~11k | **17 944** | 68 | **95** |
| pool/ (mining pool) | ~12k | **19 546** | 132 | **115** |
| miner/ (universal) | ~6k | **14 480** | 73 | **79** |
| warp/ (L2 NCL multichain) | ~9k | **14 654³** | 252 | **237** (jen warp) |

³ Website ukazuje warp jako jedinou L3 položku, ale ve skutečnosti L3 = warp + ncl + ai-native.

**Chybějící na webu:** bridge (167 testů), dao (63), atomic-swap (15), ncl (37), ai-native (82), oasis (49).

### Jazykové problémy na roadmap stránce:

Některé fáze stále obsahují **český text** na anglické veřejné stránce:
- Phase 1: *„155 testů, 8 commitů..."*
- Phase 2: *„Sprint 1.10 uzavřen, zbývá partition + 100 miners."*
- Phase 4: *„Primary-host infrastruktura běží..."*
- Phase 6: *„Genesis block vytvořen OFFLINE (air-gapped)..."*

---

## 8. STALE MAINNET GATE DOKUMENTY

| Dokument | Verdikt | Aktuálnost |
|----------|---------|-----------|
| `GO_NO_GO_2.9.7.md` | **NO-GO** (revenue canary + genesis pending) | ⚠️ Nikdy aktualizován na GO/CLOSED |
| `GO_NO_GO_2.9.8.md` | **GO** (2026-03-10) | ✅ Ale stará topologie |
| `MAINNET_READINESS_UNIFIED.md` | ~70-75 % | ⚠️ Neaktualizován od 2.9.7 |
| `MAINNET_GO_NO_GO.md` | NO-GO, sign-off table all TBD | ⚠️ Nikdy podepsáno |

---

## 9. DOKUMENTY S OUTDATED REPO NÁZVEM

Následující docs/ soubory stále referují starý repo název nebo URL:

| Vzor | Kde se vyskytuje |
|------|-----------------|
| `2.9.5-NativeAwakening` | ✅ Opraveno ve website public/docs (tento session) |
| `pool.zionterranova.com` | ✅ Opraveno ve website public/docs |
| Staré IPs v docs/ root | ⚠️ Deploy report, GO_NO_GO, DEPLOY_CHECKLIST stále referují staré IPs |

---

## 10. KONZISTENTNÍ A SPRÁVNÉ VĚCI

Některé oblasti **odpovídají** mezi docs a kódem:

| Oblast | Status |
|--------|--------|
| **Tokenomics** (144B supply, 5400 ZION/block, decade decay) | ✅ Konzistentní v README, whitepaper, Genesis, kód |
| **Konsenzus algoritmus** (Cosmic Harmony Deeksha, fork height = 0) | ✅ Konzistentní v spec, deeksha.rs, site.ts |
| **Scratchpad parametry** (64 KiB, 1024 blocks, 2 passes, 64 reads) | ✅ Spec = kód |
| **Solidity kontrakty** (7 custom) | ✅ Docs = kód |
| **Desktop agent M1 benchmark** (5575.5 H/s) | ✅ Docs = STATUS_REPORT |
| **Single-host topologie** (91.98.122.165) | ✅ site.ts, STATUS_REPORT konzistentní |
| **Fee policy** (100% burn) | ✅ Docs = kód |
| **Premine** (16.78B ZION, 11.65%) | ✅ Docs = Genesis = PREMINE_ADDRESSES |
| **Legal docs** (7 files) | ✅ Kompletní |

---

## 11. SOUHRNNÁ DOPORUČENÍ

### 🔴 Kritické (opravit brzy)

1. **Aktualizovat LOC/test čísla na website roadmap stránce** — všechny hodnoty jsou 30–60 % pod realitou
2. **Přehodit L2/L3/L4 z „Skeleton" na „Active"** minimálně v MAINNET_READINESS a L1-L4_ROADMAP
3. **Odstranit staré 3-node reference z DEPLOY_REPORT a GO_NO_GO 2.9.8** nebo je označit jako historické

### 🟡 Důležité

4. **Rozhodnout version alignment**: Cargo workspace 2.9.6 vs. runtime/docs 2.9.8 — buď bumpit, nebo zdokumentovat záměr
5. **Přeložit české texty v roadmap stránce** do angličtiny (user-facing)
6. **Přidat chybějící komponenty na web roadmap**: bridge, dao, atomic-swap, ncl, ai-native, oasis
7. **Uzavřít GO_NO_GO_2.9.7** formálně (aktualizovat na SUPERSEDED nebo CLOSED)

### 🟢 Nice-to-have

8. **Konsolidovat LOC/test reporty** do jednoho kanonického souboru (tento dokument?)
9. **Archivovat docs z v2.9.5** do docs/archive/ — 34 souborů, většina outdated
10. **Aktualizovat DEEP_PROJECT_ANALYSIS** — uvádí 17k LOC, skutečnost je 114k

---

## PŘÍLOHA: Statistický přehled kódu

```
ZION 2.9.6 → 2.9.8 Deeksha — Stav kódu k 12. březnu 2026

Rust souborů:      340
Rust LOC:          114 520
  L1:               74 985 (core 22.6k, pool 19.5k, miner 14.5k, CH 17.9k, verushash 0.3k)
  L2:               21 387 (bridge 167t, dao 63t, atomic-swap 15t)
  L3:               14 654 (warp 237t, ncl 37t, ai-native 82t)
  L4:                3 494 (oasis 49t)

Rust #[test]:      1 379
  L1:                 729
  L2:                 245
  L3:                 356
  L4:                  49

Solidity:            7 vlastních kontraktů + 5 test suites
Desktop agent:     ~1200 LOC JS (Electron, v2.9.7)
Website:           Next.js 16, v2.9.8, 51 static pages
Dokumentace:       ~250+ markdown souborů
Docker compose:      8 funkčních compose files
Genesis:           Definován, fork height = 0
```
