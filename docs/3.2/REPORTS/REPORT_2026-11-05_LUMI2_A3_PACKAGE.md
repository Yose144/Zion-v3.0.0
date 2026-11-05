# REPORT 2026-11-05 — Lumi 2 A3 balení pro výpal (fyzický produkt)

> **Rozsah:** `heros/shop/Lumi/Lumi_2_A3_balicek_pro_vypalovani/` — kompletní výrobní balíček pro laserové řezání/balení svítidla **Lumi 2 · Království srdce** z překližky 3 mm.
> **Stav:** digitálně kompletní (SVG ≡ DXF ověřeno), **fyzická zkouška výpalu a sestavy dosud zbývá** — balíček sám v `ZACNI_ZDE.md` varuje, že tovární test na reálném materiálu je nutný.

---

## 1. Co balíček obsahuje

| Složka | Soubory | Účel |
|---|---|---|
| `ZACNI_ZDE.md` | 1 | Rychlý návod: import, měřítko, barvy řezů, postup gravíru |
| `01_Vypalovani/` | `Lumi_2_A3_3mm_1ku1.svg` + `.dxf` | Výrobek na jedné desce A3 (420×297 mm); **SVG a DXF obsahují tentýž úplný výrobek** (`both_exports_compared: true`) |
| `02_Nahledy/` | `Rozlozeni_A3.png`, `Sest_sten.png` | Vizuální kontrola rozkladu a sestavy |
| `03_Navody/` | `Navod.pdf`, `Navod.md`, `NAVOD_PRO_AI.md` | Návod pro člověka i strojově čitelná varianta pro AI |
| `04_Kontrola/` | `Rozmery.json` | Změřené kontrolní údaje (okraje stěn 4,0 mm, porovnání exportů) |

## 2. Specifikace výrobku (z `ZACNI_ZDE.md` + `Rozmery.json`)

- Materiál: **baltová překliha 3 mm**, jeden kus z jedné desky A3
- Rozklad: **6 stěn** + zdobený vršek s **otvorem Ø 90 mm** + dno + **samostatný testovací proužek**
- Kontrolní rozměr: šířka šestihranného dna přes protilehlé vrcholy = **140 mm**
- Drážky testovacího proužku: shora **2,8–3,2 mm** po 0,1 mm (ladění tloušťky materiálu)
- Barvy pro stroj: **modrá ENGRAVE** = mělký linkový gravír, **červená CUT** = průchozí řez; pořadí gravír → vnitřní otvory → vnější obrysy
- Nastavení: mm, měřítko 100 %

## 3. Stav a další krok

- **Hotovo:** digitální podklady kompletní, dva exportní formáty vzájemně ověřené, rozměrová kontrola zaznamenaná.
- **Chybí:** fyzická zkouška výpalu na konkrétní překlice a montážní zkouška — balíček to explicitně vyžaduje před sériovou výrobou.
- **Navazující:** produkt je v `heros/shop/` (fyzický merchandise pro ZION shop), souvisí s herní postavou **Lumi** v Nirvaně (`/lumi`), jejíž herní balíčky byly commitnuty v předchozí vlně.

---
*Přidáno do repa v rámci dávky 2026-11-05 (spolu s `/fleet` ve Nirvaně). Detaily viz `ZACNI_ZDE.md` v balíčku.*
