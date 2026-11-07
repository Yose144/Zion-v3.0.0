# Report — MOBA: boti a aktivní itemy (F9, 2026-11-03)

> **Zadání:** „1" — z otevřené fronty **boti + aktivní itemy**.
> **Kde:** `apps/nirvana` (`core/moba/sim.ts`) — **bez změny protokolu**
> **Deployed:** net `20261103T101004Z` · app (stejný den)

---

## 1. Výchozí stav

Po F7 uměl aktivní itemy jen **hráč**. Bot měl pasivní build (čepel/boty/
aegis) a žádné aktivity — takže měl jen staty, ale ne timing. Hráč mohl
bariérou přežít burst a skokem utéct; bot ne.

## 2. Co F9 přidala

### Build podle archetypu

| Archetyp | Pořadí nákupu |
|---|---|
| **agresivní** | čepel → boty → **skok** → aegis |
| **podpůrný** | aegis → **bariéra** → boty → čepel |
| **kontrolní** | boty → **bariéra** → čepel → aegis |

### Reaktivní používání

| Situace | Item |
|---|---|
| HP pod **55 %** | léčivý prach |
| HP pod **70 %** | bariéra (štít) |
| cíl 8–14 m daleko | skok na dotahovačku |
| útěk (HP pod prahem obtížnosti) | skok pryč od cíle |
| cíl dál než 5 m | Příval (rychlost) |

- Všechno jde přes `useItem`, takže **cooldowny hlídá sim** — bot si nevede
  vlastní časovač (druhá pravda = rozjeté chování).
- `activeItemOf(hero, kind)` hledá item podle **druhu schopnosti** (`shield`,
  `heal`, `haste`, `blink`), ne podle id, takže přidání dalšího štítu bota
  nerozbije.
- Rozhodování zůstává **deterministické** (žádné `Math.random`) — simulace
  i testy jsou reprodukovatelné.

## 3. Ověření

| Test | Výsledek |
|---|---|
| `npx tsx apps/nirvana/test/moba-sim.mjs` | **166/166** (4 nové: bot koupí aktivum, vyléčí se v ohrožení, skočí na cíl, neutratí všechny sloty) |
| `npx tsc --noEmit` (app i net) | čistý |
| `e2e/first-world.mjs` proti produkci | **16/16** (0 chyb v konzoli) |
| živě | `/net/health` → **proto 15** (beze změny), smoke 200 |

**Protokol se neměnil** — jde o chování serverové simulace, ne o formát zpráv.

## 4. Meze (poctivý seznam)

- **Bot neumí odhadnout souboj** — používá itemy podle prahů HP a vzdálenosti,
  ne podle toho, jestli zrovna prohraje nebo vyhraje.
- **Bariéru používá i mimo boj** (když je pod 70 % HP a jde po laně).
- **Skok na útěk** míří „zrcadlově“ od cíle, ne k vlastní základně — může
  skočit do zdi mapy (clamp ho zastaví, ale není to chytré).
- **Bot nekupuje spotřební ward** — vidění řeší dál jen item Orlí oko, pokud
  ho má v buildu (nemá).
- **Obtížnost mění jen přesnost/kadenci** (F6), ne agresivitu používání itemů.

## 5. Otevřená fronta

1. **Neviditelnost + sentry** — až bude stealth mechanika (wardy už jsou).
2. **Replay/spectate**, den-noc cyklus.
3. **Balance sehrávkou** — ekonomika, itemy, talenty a teď i botí aktiva jsou
   odhad; sehrávka rozhodne.

---

**Souvisí:** [`MOBA-PRVNI-SVET-PLAN.md`](../../3.3/MOBA-PRVNI-SVET-PLAN.md) § 2d ·
`apps/nirvana/AGENTS.md` § PRVNÍ SVĚT — boti a aktivní itemy · commit `7d6b5ebb3`
