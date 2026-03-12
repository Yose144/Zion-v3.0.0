# ZION v2.9.9 — Pure Code

> Status: FÁZE 1 AKTIVNÍ  
> Datum: 2026-03-12  
> Předchůdce: v2.9.8 Ekam Deeksha (kanonická PoW cesta)  
> Cíl: Dotáhnout repo na 99% mainnet-ready, zamrazit jako archiv, migrovat do v3.0.

---

## Manifest

v2.9.9 **neopravuje žádný bug a nepřidává žádný feature**.

Odstraňuje mrtvý kód, sjednocuje pojmenování a uzavírá Ekam Deeksha pipeline tak,
aby 3.0 mainnet mohl stavět na čistém, auditovatelném základu.

Analogie: Totéž co v XMRig aktivace hugepages — posledním krokem nebylo změnit
algoritmus, ale **odemknout plný výkon** stávající cesty.

---

## Dokumenty

| Dokument | Obsah |
|----------|-------|
| [INDEX.md](INDEX.md) | Tento rozcestník |
| [PURE_CODE_MANIFEST.md](PURE_CODE_MANIFEST.md) | Filozofie čistého kódu, motivace, pravidla |
| [LEGACY_REMOVAL_PLAN.md](LEGACY_REMOVAL_PLAN.md) | Co se maže, co se přejmenovává, co zůstává |
| [MIGRATION_CHECKLIST.md](MIGRATION_CHECKLIST.md) | Krok-po-kroku implementační checklist |
| [FINAL_ARCHITECTURE.md](FINAL_ARCHITECTURE.md) | Cílová architektura po úklidu — co v repozitáři zůstane |
| [EKAM_DISPATCH_FIX.md](EKAM_DISPATCH_FIX.md) | Dokumentace posledního optimalizačního upgradu (Metal Ekam dispatch) |
| [HUGEPAGES.md](HUGEPAGES.md) | HugePages scratchpad allocator — XMRig-style paměťová optimalizace |
| [V3_MIGRATION_STRATEGY.md](V3_MIGRATION_STRATEGY.md) | **Strategie: 2.9.9 archiv → v3.0 Mainnet nové repo** |
| [MAINNET_READINESS_99.md](MAINNET_READINESS_99.md) | **99% readiness souhrn — co je hotovo, co zbývá, skóre** |
| [V3_PURE_CODE_AUDIT.md](V3_PURE_CODE_AUDIT.md) | **V3 hloubkový audit — kompletní inventář co je/co není vs ústava** |

---

## Klíčová rozhodnutí

1. **Jeden PoW profil** — `cosmic_harmony` = Ekam Deeksha (Blake3 XOF + 8-round Cosmic Fusion). Žádné legacy varianty.
2. **Jeden GPU dispatch** — `mine_ekam()` je jediná cesta. Legacy `mine()` se odstraní.
3. **Jeden Python fallback** — `cosmic_harmony_deeksha_fallback.py`. Všechny starší skripty se smažou.
4. **Jeden shader per backend** — Metal: `cosmic_harmony_ekam_deeksha.metal`, OpenCL: `cosmic_harmony_deeksha.cl`, CUDA: `cosmic_harmony_deeksha.cu`.
5. **Čistý enum** — `NativeAlgorithm` ponechá aliasy pro zpětnou pool kompatibilitu, ale odstraní mrtvé varianty.

---

## Design principy 2.9.9

1. **Odeber, nepřidávej** — každý řádek kódu, který není potřeba, je bug čekající na svou příležitost.
2. **Auditovatelnost** — 3.0 mainnet audit musí procházet čistým kódem, ne historickými vrstvami.
3. **Jeden zdroj pravdy** — žádné duplicitní soubory, aliasy nebo fallbacky na neexistující cesty.
4. **Zpětná kompatibilita poolu** — pool přijímá staré `algo=cosmic_harmony` loginy, ale interně je okamžitě Ekam.
5. **Nulový výkonový dopad** — čistě refactoring, žádné změny v consensus nebo hash výstupu.
