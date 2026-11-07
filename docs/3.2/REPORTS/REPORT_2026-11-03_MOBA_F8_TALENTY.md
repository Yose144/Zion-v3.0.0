# Report — MOBA: talent strom (F8, 2026-11-03)

> **Zadání:** „pokračuj 1" — z otevřené fronty **talent strom**.
> **Kde:** `apps/nirvana` (`core/moba/`) + `apps/nirvana-net`
> **Deployed:** net `20261103T093551Z` (proto 15) · app (stejný den)

---

## 1. Výchozí stav

Hrdina měl čtyři kouzla se stupni (F1), itemy s recepty (F2) a aktivní itemy
(F7) — ale **žádná volba, která by zápas otočila podle toho, jak ho hraje**.
Level 10 a 15 daly jen +55 HP a +18 many.

## 2. Co F8 přidala

**Dvě volby za zápas** (10. a 15. úroveň), nabídka podle **archetypu kouzel**
(odvozeno ze školy Q — žádná ruční tabulka pro 200 avatarů):

| Archetyp | Školy | 10. úroveň | 15. úroveň |
|---|---|---|---|
| **agresivní** | oheň, šíp, čepel, bouře, stín, bestie | +12 % dmg / +8 % speed | +20 % dmg / +12 % dmg +6 % speed |
| **podpůrný** | ward, příroda, píseň | +250 HP / +15 % síla kouzel | +400 HP +3 HP/s / +25 % síla kouzel |
| **kontrolní** | kosmické, mysl | +5 m vidění / +200 many | +8 m vidění +5 % dmg / +350 many +15 % síla kouzel |

- **Panel v HUD** se objeví, jakmile je volba dostupná, a zmizí po výběru.
  Hráč nemusí nic potvrzovat dopředu — hra běží dál.
- **Boti si volí sami** (deterministicky), takže po levelu 10 nezůstanou bez
  bonusů a hráč nemá nefér výhodu.
- Efekty se **sčítají na jednom místě** (`talentTotals`) a propisují se do
  poškození, rychlosti, maxim HP/many, vidění, regenerace i síly kouzel.

## 3. Ověření

| Test | Výsledek |
|---|---|
| `npx tsx apps/nirvana/test/moba-sim.mjs` | **162/162** (12 nových: čekání na 10/15, neplatný index, dvojitá volba, součet efektů, role ze školy, bot si vybere sám) |
| `npx tsc --noEmit` (app i net) | čistý |
| `e2e/first-world.mjs` proti produkci | **16/16** (0 chyb v konzoli) |
| živě | `/net/health` → **proto 15**, smoke 200 |

## 4. Meze (poctivě)

- **Talent se nedá odvolat** — volba je definitivní (jako v Dotě).
- **Panel neumí zobrazit už vybrané talenty** — hráč je vidí jen podle
  chování; scoreboard je neuvádí.
- **Jen dva stupně** (10 a 15); HotS má víc, ale zápas je 8minutový.
- **Nabídka je podle archetypu, ne podle konkrétní postavy** — dva hrdinové
  stejné školy mají stejné talenty.
- **Bot volí index podle `state.seq`**, ne podle situace (není to „smart" AI).

## 5. Otevřená fronta

1. **Boti + aktivní itemy** (doplní build a používání).
2. **Neviditelnost + sentry** (až bude stealth mechanika).
3. **Replay/spectate**, den-noc cyklus.
4. Balance sehrávkou (čísla ekonomiky, itemů a talentů jsou odhad).

---

**Souvisí:** [`MOBA-PRVNI-SVET-PLAN.md`](../../3.3/MOBA-PRVNI-SVET-PLAN.md) § 2c ·
`apps/nirvana/AGENTS.md` § PRVNÍ SVĚT — talent strom · commit `f70a0edc7` (F8)
