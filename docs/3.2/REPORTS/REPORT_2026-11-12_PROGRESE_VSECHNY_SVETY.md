# Report — Progrese: flotila, pouť a tanky — 2026-11-12

**Zadání:** 👤 „pokračujeme dál" (po XP + dharma + CL + NCL).

**Cíl:** dokončit napojení progrese na **všechny** herní povrchy. Po
předchozím kroku chybělo:

- **flotila** se nezapisovala vůbec (nemá `ParkGameId`, takže se nedala
  dostat na tabuli ani do XP),
- **pouť** posílala jen skóre (žádný čas, žádné dokončení),
- **tanky** zapisovaly bez metrik.

---

## 1. Flotila — „dohraný běh" = přistání

Flotila nemá skóre, souboj ani konec. Jediná měřitelná událost je
**přistání**, takže se z něj stal dohraný běh:

```
score = uletěná vzdálenost + 150
metrics = { seconds, completed: true, objectives: 1, objectivesTotal: 1 }
```

- **Práh 25 jednotek** brání farmení (odpojit → přistát na místě → „výhra").
- `travelled` se čte z refu (`telemetry`), protože `onDock` je `useCallback`
  a stav v něm byl o snímek starý.
- Zápis je **jednou za let** (`recorded` ref), ne za každé přistání.
- V hledišti (`?watch=`) se nezapisuje — divák neletí.

`fleet` je nový `ParkGameId`, takže prošel stejnou registrací jako každá
jiná hra: `types.ts`, `emptyScores`, `GAMES` + `emptyBoard`
v `/api/park/scores`, `CHALLENGE_GAMES` + `CHALLENGE_TARGETS` (cíl 300),
`GAME_TITLES` + `GAME_ORDER`, `GAME_XP` (45).

---

## 2. Pouť — čas a dokončení

Arkáda nemá „dno" ani „výhru"; dohrání je cíl, ale **bez času** by dharma
validátor nepoznal „dvě vteřiny pro body". `recordRun` v pouti teď měří
čas od `startedAt` a posílá `completed: value > 0`.

---

## 3. Tanky — kola a výstřely

Duel nemá ve stavu čas, takže se bere `40 + shots × 4` s; `completed`
znamená víc vyhraných kol než prohraných. Metriky jdou do stejného
`recordRun` (XP + dharma + NCL).

---

## 4. Co to znamená pro hráče

| Povrch | před | po |
|---|---|---|
| Flotila | žádný záznam, žádná tabule | přistání = běh, skóre, XP, dharma, tabule |
| Pouť | jen skóre | skóre + čas + dokončení (plná validace) |
| Tanky | skóre bez metrik | skóre + kola + prohry |

NCL úloha „Celý systém" (12 různých světů) je teď dosažitelná i s flotilou
a tabule má 17 her místo 16.

---

## 5. Ověření

- `npx tsc --noEmit` 0 · `npm run build` OK
- `node e2e/fleet.mjs` — **24/24** (nová sekce „přistání = dohraný běh":
  `best.fleet`, XP, `plays.fleet`, dharma validace)
- `node e2e/park-fair.mjs` — **PASSED** (beze změny)
- `npx tsx test/consciousness.mjs` 66/66 · `test/progress.mjs` OK
- `npx tsx test/dharma.mjs` 52/52 · `test/neptun-dive.mjs` 75/75 ·
  `test/pluto-light.mjs` 56/56

---

## 6. Meze

- Vše zůstává v prohlížeči (`localStorage`) — nic z toho není on-chain.
- Flotila se zapisuje jen při **prvním** přistání v daném letu; delší
  „expedice" s více doky je jeden běh, ne tři.
- Tanky odhadují čas z počtu výstřelů — přesnější by bylo měřit čas kola
  v `tanks.ts` (samostatný krok).
- Questy jsou pořád jen data (`ready: false`) — zapnou se v OASIS.
