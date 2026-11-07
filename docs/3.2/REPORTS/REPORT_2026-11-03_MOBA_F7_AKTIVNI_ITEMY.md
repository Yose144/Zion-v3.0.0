# Report — MOBA: aktivní itemy (F7, 2026-11-03)

> **Zadání:** „pokračuj dál" — nad rámec plánu F1–F6, z otevřené fronty
> „kouzla dál": **aktivní itemy**.
> **Kde:** `apps/nirvana` (`core/moba/`) + `apps/nirvana-net`
> **Deployed:** net `20261103T040327Z` (proto 14) · app `20261103T040+`

---

## 1. Výchozí stav

Všech 15 itemů bylo **pasivních** — hráč měl jen build, žádnou schopnost
na klávese. Souboje proto rozhodovalo jen číslo (dmg/HP/rychlost), ne timing.

## 2. Co F7 přidala

| Item | Cena | Aktivní efekt | Cooldown |
|---|---|---|---|
| **Skok** | 900 | blink až 7 m kursoru | 12 s |
| **Bariéra** | 700 | +300 štítu na 4 s | 20 s |
| **Léčivý prach** | 600 | +250 HP (počítá se do léčení) | 25 s |
| **Příval** | 650 | +40 % rychlosti na 4 s | 18 s |

- **Klávesy 1–6** = sloty inventáře (standard MOBA).
- **Klik na slot** pošle stejnou syntetickou klávesu → **dotyk nepotřebuje
  druhý vstup** (stejný trik jako ward a kouzla).
- Prodej aktivního itemu je malé **×** v rohu slotu — kdyby prodával celý
  slot, hráč by item omylem vyhodil.
- **Server rozhoduje** o cooldownu i efektu (zpráva `use`); snapshot nese
  `itemCooldowns` (zbytek v ms), takže klient nikdy nepočítá vlastní časovač.
- HUD: číslo slotu, překryv cooldownu, zvýraznění aktivních itemů.

## 3. 🔴 Nalezená chyba: rychlostní buffy nikdy nefungovaly

`heroSpeed()` porovnával `buff.until` s **`Date.now()`**, ale buffy se ukládají
v **simulačním čase** (`state.now`, řádově 10⁶ vs. 10¹²). Každý rychlostní buff
byl proto považován za propadlý:

- **runy haste** od F4 nedělaly nic,
- **Příval** by nedělal nic,
- buffy z džungle (`speed` za malý tábor) taky ne.

Funkce teď bere `now` (sim čas) a sim předává `state.now`. Test na Příval to
odhalil hned napoprvé — číslo zůstalo 6,20 → 6,20.

Navíc **predikce v online** počítá rychlost z `itemTotals` (boty, runy,
Příval), ne z konstanty 6,2 — jinak by se postava se serverem rozejela.

## 4. Ověření

| Test | Výsledek |
|---|---|
| `npx tsx apps/nirvana/test/moba-sim.mjs` | **150/150** (10 nových: blink s limitem 7 m, cooldown blokuje druhé použití, štít, léčení + stat, rychlost, cizí/pasivní item) |
| `npx tsc --noEmit` (app i net) | čistý |
| `e2e/first-world.mjs` proti produkci | **16/16** (obchod 19 itemů) |
| živě | `/net/health` → **proto 14**, smoke 200 |

## 5. Meze (poctivě)

- **Boti aktivní itemy nekupují** — jejich build (`botBuild`) je pořád
  pasivní; hráč má tedy v sóle výhodu timingu. Dalo by se doplnit.
- **Blink nemá cílení „na místo"** — bere bod kurzoru; na dotyku to znamená
  poslední ťuk do země.
- **Aktivní itemy nemají vlastní panel** — jen sloty v inventáři; popis
  efektu je v tooltipu a v obchodě.
- **Bariéra nepřekrývá štíty z kouzel** (bere maximum, ne součet) — záměr,
  aby se nedalo nasčítat 800 štítu z jednoho kliknutí.

## 6. Co dál (otevřená fronta)

1. **Talent strom** — volba na 10./15. úrovni podle školy kouzel.
2. **Neviditelnost + sentry** — až bude mít hra stealth mechaniku.
3. **Boti a aktivní itemy** — doplnit build a používání.
4. **Replay/spectate**, den-noc cyklus.

---

**Souvisí:** [`MOBA-PRVNI-SVET-PLAN.md`](../../3.3/MOBA-PRVNI-SVET-PLAN.md) § 2b ·
`apps/nirvana/AGENTS.md` § PRVNÍ SVĚT — aktivní itemy · commit `7544ad541` (F7)
