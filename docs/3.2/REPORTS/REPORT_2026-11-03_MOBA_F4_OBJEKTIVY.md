# Report — MOBA: objektivy a kouzla (F4, 2026-11-03)

> **Zadání:** „pokračuj v módu F4, kouzla a další" — čtvrtá fáze plánu
> `docs/3.3/MOBA-PRVNI-SVET-PLAN.md` + hlubší kouzla.
> **Kde:** `apps/nirvana` (`core/moba/`) + `apps/nirvana-net`
> **Deployed:** net `20261103T023456Z` (proto 11) · app `20261103T023632Z`

---

## 1. Výchozí stav

Mapa měla linky, jungle, uzly L5 i inhibitory — ale **žádný objektiv uprostřed
hry**: nedalo se nic vyhrát ani ukrást, souboje byly jen o hp. Kouzla měla
pevnou cenu a cooldown bez ohledu na stupeň.

## 2. Co F4 přidala

### Runy (každé 2 minuty, 2 místa)

| Runa | Efekt |
|---|---|
| **bounty** | +120 zlata |
| **haste** | +35 % rychlosti na 10 s |
| **power** | +30 % poškození na 10 s |

- Sebere ji **první hrdina do 2,4 m** — o runy se proto soupeří.
- Druh se posouvá deterministicky s cyklem (`makeRunes`), takže obě strany
  hrají stejnou hru.
- Existují **už na startu** zápasu (ne až prvním tickem).

### Boss — Prastarý strážce

- Sedí v řece na jihu (`BOSS_SPOT`), **3200 HP**, respawn **8 minut**.
- **Sílí s časem**: +14 % HP a +8 % poškození za každou minutu zápasu
  (škáluje se při respawnu, ne během souboje).
- Zabití dá **250 zlata, 220 XP a Aegis**.
- **Aegis = jednorázové vzkříšení** na 60 % HP místo smrti: nezapočítá se
  smrt, nestrhne se zlato. Hrdina má zlatý prstenec, dokud ji drží.

### Kouzla — stupňování i v ceně

Dřív stupeň měnil jen poškození/štít/léčení. Teď:

| | 1. stupeň | 4. stupeň |
|---|---|---|
| mana | 100 % | **145 %** |
| cooldown | 100 % | **79 %** |
| poškození | 100 % | 166 % (z F1) |

Mana i cooldown počítá **stejná funkce** (`spellMana`, `spellCooldown`)
v sim i v HUD — klient nemůže ukazovat jinou cenu, než jakou server strhne.

### Vykreslení

- **Scéna:** runy jako orby v barvě efektu, boss jako fialový krystal
  s prstencem (zmenšuje se s ubývajícím HP), Aegis jako zlatý prstenec
  pod hrdinou.
- **Minimapa:** runy (barevné tečky) a boss (fialový kruh) — musíš vidět,
  o co se hraje, dřív než to soupeř sebere.
- **Debug háček** nese `runes` a `boss`, takže E2E ověří objektivy bez klikání.

## 3. Ověření

| Test | Výsledek |
|---|---|
| `npx tsx apps/nirvana/test/moba-sim.mjs` | **119/119** (14 nových: runy na startu, sebrání, boss scaling/zabití, Aegis bez smrti, stupňování many i cooldownu) |
| `apps/nirvana-net/test/moba.mjs` | **22/22** (proto 11) |
| `npx tsc --noEmit` (app i net) | čistý |
| `e2e/first-world.mjs` proti produkci | **15/15** — nově dvě runy na startu a boss na mapě |
| živě | `/net/health` → **proto 11**, app `20261103T023632Z`, smoke 200 |

## 4. Co se cestou pokazilo

**Net build spadl** na ručním literálu prázdného snapshotu (chyběly mu `runes`
a `boss`). Místo doplnění polí na dvě místa je teď `emptyMobaSnapshot()`
v `sim.ts` — další pole snapshotu rozbije **jedno** místo.

Druhá past: test zabití bosse neprošel, protože `advance()` posílá `NO_INPUT`
a hrdina bez `attack: true` neútočí (jen stojí a boss ho mlátí). Je to
správné chování, jen to test musí říct nahlas.

## 5. Meze (poctivě)

- **Runy se nedají „ukrást" nepříteli** — kdo je sebere, má je; žádné
  zneškodnění po sebrání.
- **Boss neumí schopnosti** (jen útok na blízko) a neútočí na miniony.
- **Aegis nemá UI slot** — pozná se podle zlatého prstence; v HUD chybí
  ikona/číslo.
- **Kouzla nemají talent strom** ani aktivní itemy — jen stupeň (mana,
  cooldown, poškození).
- **Runy nejsou na minimapě odlišené ikonou**, jen barvou.

## 6. Co dál

- **F5** — wardy (vidění), buyback (návrat do hry za zlato), respawn scaling.
- **F6** — scoreboard (GPM/XPM), pozápasový souhrn, obtížnosti botů.
- **Kouzla dál** — aktivní itemy (klávesa navíc), talent strom, ukazatel
  dostřelu při míření.

---

**Souvisí:** [`MOBA-PRVNI-SVET-PLAN.md`](../3.3/MOBA-PRVNI-SVET-PLAN.md) ·
`apps/nirvana/AGENTS.md` § PRVNÍ SVĚT — objektivy · commity `736b97e22` (F4),
`c7cc754fc` (prázdný snapshot)
