# Report — Reálný čas ve všech hrách (herní logika pro progresi) — 2026-11-12

**Zadání:** 👤 „jo přidej herní logiku a to všude … a pak nasadíme, kouknu na to."

**Kontext:** dharma validátor má pilíře **Satya** (běh je skutečný) a
**Kāla** (čas dával smysl). Do teď ale aréna, tanky, Merkur a MOBA posílaly
**odhad** — konstantu, ne měření. Validátor tak chválil i běh, který se
nestal, a naopak mohl potrestat pomalý stroj.

---

## 1. Co se změnilo

| Hra | před | po |
|---|---|---|
| Mars aréna | `seconds: 180` | `MATCH_SECONDS − timeLeft` (reálný čas, i při frag limitu) |
| Saturn tanky | `40 + výstřely × 4` | `TanksState.elapsed` (simulační hodiny) + fallback pro online |
| Merkur sólo | `30 + kola × 20` | `RagdollMatch.elapsed` v `SoloFinish` |
| Merkur online | `30 + kola × 20` | wall-clock klienta od prvního stavu (`onlineStart`) |
| MOBA | `240` | `MobaStats.time` ze snapshotu (platí i pro online) |

Zbytek her měřil správně už dřív: Venuše (`totalSeconds`), Piko, Lumi,
Neptun, Pluto (simulační čas), pouť (`startedAt`), flotila (`Date.now`
rozdíl — let nemá simulační hodiny).

---

## 2. Proč simulační hodiny a ne `Date.now()`

Fyzika všech her má `dt` zastropované (0,05 s). Na 15 fps by skutečné
hodiny nafoukly běh o desítky procent a čísla by přestala být srovnatelná
mezi stroji — přesně ta past, kterou řešila Venuše. Proto se čas bere
z `elapsed`/`time` simulace; výjimky jsou jen tam, kde simulační hodiny
nejsou (online duel) a je to v kódu označené.

---

## 3. Důsledek pro hráče

- Pečeť (dharma seal) teď jde získat i v aréně, tancích, Merkuru a MOBĚ —
  dřív u nich Satya/Kāla vycházely z konstanty, takže skóre pilířů
  neodpovídalo tomu, co hráč opravdu odehrál.
- NCL úlohy a XP se nemění (ty stojí na skóre a splněných cílech).

---

## 4. Ověření

- `npx tsc --noEmit` 0 · `npm run build` OK
- `npx tsx test/saturn-tanks.mjs` — 48/48 (nové `elapsed`)
- `npx tsx test/ragdoll.mjs` — PASSED (`SoloFinish.elapsed`)
- `npx tsx test/moba-sim.mjs` — OK
- `npx tsx test/arena-weapons.mjs` — OK · `test/arena-maps.mjs` — OK
- `node e2e/path-audit.mjs` — 26/26
- `node e2e/park-fair.mjs` — PASSED · `e2e/fleet.mjs` — 24/24
- **Poznámka:** `e2e/mars-arena.mjs` v multiplayerové části selhává
  z prostředí — vyžaduje běžící `nirvana-net` na :3011 a build
  s `NEXT_PUBLIC_NIRVANA_NET_URL`; sólo část prošla a v konzoli nejsou
  chyby. Není to regrese téhle změny.

---

## 5. Meze

- **Online duel (Merkur)** měří wall-clock klienta — server hodiny
  v protokolu nemá. Přesnější by bylo přidat `elapsed` do snapshotu
  (bump protokolu + deploy netu).
- **Online aréna** se do progrese nezapisuje vůbec (`MarsMultiplayer`
  nevrací `ArenaResult`) — samostatný krok.
- **Online tanky** používají fallback z výstřelů, protože klient sim
  neposouvá.
