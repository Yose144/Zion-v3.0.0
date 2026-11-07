# Report — MOBA: neviditelnost a sentry (F10, 2026-11-03)

> **Zadání:** „1" — z otevřené fronty **neviditelnost + sentry**, poslední
> chybějící mechanika.
> **Kde:** `apps/nirvana` (`core/moba/`) + `apps/nirvana-net`
> **Deployed:** net `20261103T102729Z` (proto 16) · app (stejný den)

---

## 1. Výchozí stav

Hra měla mlhu (F1) a wardy (F5), ale **žádnou neviditelnost** — každá jednotka
byla vždy vidět, pokud na ni dosáhlo vidění. Stealth je přitom půlka toho, co
dělá gank nebezpečným.

## 2. Co F10 přidala

| Prvek | Cena | Efekt | Klávesa |
|---|---|---|---|
| **Závoj** (aktivní item) | 800 | neviditelnost na **6 s**, cooldown 30 s | 1–6 (slot) |
| **Strážné oko / sentry** (spotřební) | 120, max 2 | odhalí neviditelné do **8 m** na **60 s** | **H** / 🕯 |

- **Neviditelnost je filtr vidění, ne nová vrstva stavu.** Jedna funkce
  `isHidden()` rozhoduje za snapshot, cílení, věže, miniony i bosse. Kdyby
  existovala dvakrát, hráč by soupeře neviděl na mapě, ale věž by ho mlátila.
- **Vlastní tým vidí vždy** — neviditelnost je jen proti soupeři.
- **Sentry je jediná protihra**: neposkytuje vidění (to je ward), jen odhaluje
  neviditelné v okruhu. Bez něj soupeř doslova zmizí.
- **HUD**: počet sentry vedle wardů, badge **NEVIDITELNÝ**, sentry v obchodě
  se zásobou `x/2`, na dotyku tlačítko 🕯.

## 3. Ověření

| Test | Výsledek |
|---|---|
| `npx tsx apps/nirvana/test/moba-sim.mjs` | **177/177** (11 nových: Závoj skryje, vlastní tým vidí, sentry odhalí, nepřítel nevidí skrytého, expirace 60 s, skrytý nejde zasáhnout) |
| `npx tsc --noEmit` (app i net) | čistý |
| `e2e/first-world.mjs` proti produkci | **16/16** (obchod 21 itemů, 0 chyb v konzoli) |
| živě | `/net/health` → **proto 16**, smoke 200 |

## 4. Meze (poctivě)

- **Neviditelnost nemá částečný efekt** (jako „fade“ v Dotě) — buď jsi skrytý,
  nebo ne; útok neviditelnost neruší (v Dotě ano).
- **Sentry nejde zničit** — nepřítel ho nevidí a nemá prostředek, jak ho
  zlikvidovat (stejné jako ward).
- **Boti Závoj nekupují** ani sentry nepokládají — neviditelnost je zatím
  jen hráčská výhoda (v buildu mají skok/bariéru).
- **Skrytý hrdina nezmizí z minimapy vlastního týmu** (to je správně), ale
  nepřítel ho nevidí ani tam (snapshot ho neobsahuje).
- **Kouzla ho nezasáhnou jen proto, že ho nejde zamířit** — AoE na zemi
  (ring) ho zasáhne i skrytého; to je vědomé (stealth není imunita).

## 5. Stav hry

Hotové vrstvy: ekonomika → itemy s recepty → mapa s bushe/inhibitory →
objektivy (runy, boss, Aegis) → wardy, buyback, respawn → scoreboard,
obtížnosti botů → aktivní itemy → talenty → boti s aktivy → neviditelnost
a sentry.

Zbývá z fronty: **replay/spectate**, **den-noc cyklus** a **balance
sehrávkou** (čísla jsou odhad a chtějí sehrát).

---

**Souvisí:** [`MOBA-PRVNI-SVET-PLAN.md`](../../3.3/MOBA-PRVNI-SVET-PLAN.md) § 2e ·
`apps/nirvana/AGENTS.md` § PRVNÍ SVĚT — neviditelnost · commit `f2d2911a1`
