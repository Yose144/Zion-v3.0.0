# Report — Aréna: online zápas do progrese — 2026-11-12

**Zadání:** 👤 „pokračuj v aréně zatím."

**Stav před:** sólo aréna (Mars) do progrese zapisovala od začátku, ale
**multiplayer** byl jediné herní místo, které nedalo XP, dharma validaci
ani záznam na tabuli. Divák i hráč skončili zápas a nic se nestalo.

---

## 1. Co je nové

`MarsMultiplayer` dostal `onFinish` a po události `match_end` zapíše běh
přes stejný `recordRun()` jako sólo:

| pole | hodnota |
|---|---|
| `score` | `fragy × 100 − smrti × 25` (stejný vzorec jako sólo) |
| `seconds` | `MATCH_SECONDS − secondsLeft` ze serveru |
| `completed` | hráč je první v tabulce (výhra) |
| `objectives` | fragy, `objectivesTotal` = `FRAG_LIMIT` |
| `setbacks` | smrti |

Výhra navíc dává **+2 žetony** (jako sólo) a hláška s XP/dharmou se
ukáže plovoucí nad HUDem — multiplayer nemá výsledkovou kartu, svět běží dál.

---

## 2. Proč je výpočet samostatná funkce

`core/arena/mp-result.ts` → `mpResultOf({ frags, deaths, timeLeft, leaderId, youId })`.
Zápas končí až po **180 s** nebo po frag limitu **lidského** hráče, takže
v E2E by se `match_end` ověřoval jen obchvatem. Čistá funkce se testuje
bez hry (`test/arena-mp-result.mjs`, 16 kontrol): skóre, čas při vypršení
i při frag limitu, výhra podle vůdce tabulky, oříznutí záporných hodnot
a to, že z výsledku vznikne pečeť / prohra.

---

## 3. Detaily, které mohly tiše selhat

- **Divák se nesmí zapsat.** `subscribe` efekt má prázdné deps, takže
  `watch` v něm musí jít z refu (`watching`), ne z propu.
- **Jednou za zápas.** `recordedMatch` se resetuje až na `match_start` —
  jinak by se po každém `match_end` připsal další běh.
- **Když server nepošle `secondsLeft`**, bere se 0 → čas = celý zápas
  (bezpečnější než nula sekund, které by shodily pilíř Kāla).
- **`scoreboard` může chybět** (starý server) → `leaderId = null` → prohra;
  zápis ale proběhne, jen bez bonusu.

---

## 4. Ověření

- `npx tsc --noEmit` 0 · `npm run build` OK
- `npx tsx test/arena-mp-result.mjs` — **16/16**
- `npx tsx test/arena-weapons.mjs` — OK · `test/arena-maps.mjs` — OK
- `node e2e/mars-arena.mjs` — **PASSED** (s lokální net službou na :3011
  a buildem s `NEXT_PUBLIC_NIRVANA_NET_URL`)
- `node e2e/path-audit.mjs` — 26/26

---

## 5. Meze

- Online zápas se zapisuje **jen hráči**, který má sedlo; divák ne.
- Boti v místnosti se do skóre nepočítají (zapisuje se jen vlastní řádek).
- Vzdálený čas je serverový (`secondsLeft`), ale simulace běží na serveru —
  klient nemá důvod měřit vlastní hodiny.
- Kdyby se někdy zvedl `FRAG_LIMIT` nebo `MATCH_SECONDS`, obojí se čte
  z `core/arena/map.ts`, takže se nemusí měnit jinde.
