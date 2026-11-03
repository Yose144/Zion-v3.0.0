# Report — MOBA: itemy a obchod (F2, 2026-11-03)

> **Zadání:** „f2" — druhá fáze plánu `docs/3.3/MOBA-PRVNI-SVET-PLAN.md`.
> **Kde:** `apps/nirvana` (`core/moba/`) + `apps/nirvana-net`
> **Deployed:** net `20261103T014254Z` (proto 9) · app `20261103T014437Z`

---

## 1. Výchozí stav (a jeden mrtvý systém)

Obchod měl tři itemy (Čepel, Aegis, Sandály), každý kupovaný zvlášť, žádné
recepty, žádný limit slotů, žádný prodej.

**Větší nález:** v multiplayeru obchod **vůbec nefungoval**. Protokol zprávu
`buy` od protokolu 6 parsoval, ale `apps/nirvana-net/src/index.ts` ji nikdy
nezpracoval — server ji tiše zahodil. Test to maskoval, protože kontroloval
jen „bez zlata nekoupí", což platilo i bez handleru. Od F2 je tam `case 'buy'`
i nový `case 'sell'` a test kupuje Tesák (300 < startovní 320).

## 2. Co F2 přidala

### 14 itemů (6 základních + 8 složených)

| Základ | Cena | Bonus |
|---|---|---|
| Čepel | 400 | +25 % dmg |
| Tesák | 300 | +12 % dmg |
| Aegis | 400 | +250 HP, −10 % příchozího |
| Plášť | 500 | −12 % příchozího |
| Sandály | 400 | +15 % rychlosti |
| Runový kámen | 350 | +150 many |

| Složené | Z čeho | Cena | Bonus |
|---|---|---|---|
| Válečná čepel | Čepel + Tesák | 1100 | +45 % dmg |
| Bašta | Aegis + Plášť | 1350 | +450 HP, −24 % příchozího |
| Větrné sandály | Sandály + Runa | 1150 | +25 % speed, +150 many |
| Žezlo | Runa + Uhlík | 1400 | +25 % dmg, +300 many |

Samostatné: **Lotosový štít** (700, +200 HP, regenerace 4 HP/s), **Orlí oko**
(550, +6 m vidění — protihra mlhy), **Žhavý uhlík** (600, +18 % dmg, +8 %
speed), **Koruna** (1400, +30 % dmg, +300 HP).

### Mechanika

- **Bonusy se sčítají** (`itemTotals`) — poškození, obrana, rychlost, vidění
  i regenerace čtou z jednoho místa. Nový item = jeden záznam, ne nová větev.
- **Recepty:** vlastněné komponenty se spotřebují, platí se `cost − cena
  komponent`. Slot se tím uvolní, takže složení jde i s plným inventářem.
- **6 slotů**, **prodej za 60 %** kliknutím na slot (samostatné tlačítko by
  na mobilu nemělo místo).
- **Maxima se dopočítávají** (`recomputeHeroStats`) z levelu a itemů. Dřív se
  `maxHp += 250` přičítalo napřímo — po zavedení prodeje by hráč dostal HP
  navíc (koupit → prodat → zůstane 250).
- **HUD:** inventář (6 slotů, klik = prodej) + tlačítko Obchod s panelem
  rozděleným na **Základ** a **Složené**; u složených je vidět recept a cena
  po započtení vlastněných komponent.
- **Bots** kupují dál podle školy Q (z F1) a nové itemy jim nic nerozbily.

## 3. Ověření

| Test | Výsledek |
|---|---|
| `npx tsx apps/nirvana/test/moba-sim.mjs` | **92/92** (15 nových: recepty, spotřeba komponent, cena rozdílu, 6 slotů, sedmý ne, prodej 60 %, efekty HP/speed/vision/regen) |
| `apps/nirvana-net/test/moba.mjs` (lokální server) | **22/22** — nově `buy` (Tesák) i `sell` proti skutečnému serveru |
| `npx tsc --noEmit` (app i net) | čistý |
| `e2e/first-world.mjs` proti produkci | **13/13** — nově šest slotů inventáře a 14 itemů v panelu (reálné selektory, ne „nějaká tlačítka") |
| živě | `/net/health` → `proto 9`, app `20261103T014437Z`, smoke 200 |

## 4. Meze (poctivě)

- **Obchod jde otevřít kdekoli.** Standard (Dota/LoL) ho váže na základnu nebo
  couriera; u nás by to znamenalo buď doručovací timer, nebo návrat do báze —
  obojí patří do F3 (mapa + pohyb), ne do itemů. Zapsáno v plánu.
- **Žádné aktivní itemy** (kliknutím sesílané) — všechny bonusy jsou pasivní.
  Aktivní itemy chtějí novou klávesu a souhru s dotykem; to je samostatná fáze.
- **Neutrální itemy z dungeonů** nejsou — patří k F4 (objektivy).
- **Prodej vrací 60 % i u složených itemů** (komponenty se nevrací) — stejné
  pravidlo jako v Dotě pro složené itemy.
- **UI je ověřené selektorem, ne lidským klikáním** — inventář i panel se
  vykreslí, ale jestli je balanc dobrý, rozhodne sehrávka.

## 5. Co dál

- **F3 — mapa**: bushe (blokují vidění), řeka, T3 + inhibitory se super miniony,
  obchod v základně / doručení.
- **F4 — objektivy**: runy, boss s Aegis.
- **F5** — wardy, buyback, respawn scaling.

---

**Souvisí:** [`MOBA-PRVNI-SVET-PLAN.md`](../3.3/MOBA-PRVNI-SVET-PLAN.md) ·
`apps/nirvana/AGENTS.md` § PRVNÍ SVĚT — itemy a obchod ·
commity `25199fa50` (F2)
