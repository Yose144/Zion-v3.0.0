# REPORT — Zion Archive: Království srdce má oficiální angličtinu

**Datum:** 2026-11-04 · **Workstream:** W2 (CZ/EN parita) · **Kód:** `apps/website-v2.9`

## 1. Zdroj

V repu je **oficiální anglické vydání** klasické (10kapitolové) verze:

`canon/Kralovstvi_srdce_Zion_CZ_EN_FR_ES_PT_PRODEJ/EDITION/klasicka/EN/Kingdom_of_the_Heart_klasicka_EN.md`

Struktura 1:1 s českými kapitolami v readeru (`# 1 · …` … `# Epilogue · …`), takže ji lze
namapovat bez zásahu do textu.

## 2. Co je hotové

- EN text rozdělen podle h1 na 11 souborů v
  `apps/website-v2.9/archive-content/en/books/kralovstvi-srdce/kapitoly/`:
  `00-README` + `01-Tesar-z-Nazareta` … `09-Flotila-se-Schazi` + `10-Epilog-Kde-Lod-Kotvi`.
- `KRAL_BOOK`: kicker i fakt „Jazyky" → **CZ + EN**.
- `library.ts`: kniha už není `czOnly`, popis říká „Česky i anglicky".
- Reader v EN režimu načítá anglický text (bez fallback hlášky), CZ zůstává kanonický.

## 3. Ověření

- `GET /api/archive/audit` (admin): `kralovstvi-srdce` → **enCoverage 100 %**, `missingEn: []`,
  `missingCs: []`.
- Reader `…/kralovstvi-srdce/cist#01-Tesar-z-Nazareta` v EN režimu: heading
  **„The carpenter of Nazareth"**.
- Soubory: 11 EN souborů, 2,5–3,5 kB na kapitolu (odpovídá CZ).

## 4. Poznámky

- ZIP v marketplace obsahuje **ilustrovanou 24kapitolovou edici** (jiná struktura) i klasickou;
  reader používá klasickou 10kapitolovou, protože ta odpovídá české čtečce.
- Další knihy s oficiálním EN překladem v `canon/` je možné napojit stejným postupem
  (split podle h1 → `archive-content/en/<kniha>/kapitoly/`).
