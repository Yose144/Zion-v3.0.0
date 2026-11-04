# REPORT — Zion Archive W5 (Začni tady) + W4 (tisk/PDF)

**Datum:** 2026-11-04 · **Kód:** `apps/website-v2.9`

## 1. W5 — „Začni tady"

- V knihovně (`#knihovna`) tři kurátorské vstupy pro první návštěvu:
  1. **Genesis** — proč existujeme,
  2. **Nirvana, Epizoda 1** — příběh Nové Země,
  3. **Sůl této země** — kmenový kanon a kompas.
- Každá karta má akcent, číslo, krátký popis a CTA; pod nimi odkaz „Celá cesta" → `#cesta`.
- Bilingvní (CZ/EN), ověřeno headless: 3 karty, 20 karet knih, 0 chyb, mobil 390×844 bez přesahu.

## 2. W4 — tisk/PDF kapitoly

- Tlačítko **Tisk / PDF** v hlavičce kapitoly (`window.print()`).
- Print stylesheet v `globals.css`:
  - skryje `header`, `footer`, `nav`, `aside` a tlačítka,
  - bílé pozadí a černý text i pro sépia/světlý režim,
  - zruší gradienty nadpisů (`-webkit-text-fill-color`), orámování karet a stíny,
  - citace a odkazy zůstávají čitelné.
- Ověřeno: klik zavolá `window.print()` (stub), v `media=print` je navigace skrytá.

## 3. Poznámky

- Tiskne se aktuální kapitola včetně TOC v sidebaru? Ne — sidebar je v printu skrytý.
- Celá kniha naráz (PDF se všemi kapitolami) zůstává v backlogu W3 (generování edic).
