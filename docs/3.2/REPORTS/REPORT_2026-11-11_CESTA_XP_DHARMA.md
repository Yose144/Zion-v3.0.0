# Report — Cesta: XP a dharma validátor v Nirvaně — 2026-11-11

**Zadání:** 👤 „doplnit do nirvany XP a dharma validator, pak rozšiřuj dál".

**Stav před:** postup byl `runs` (počet dohraných her) → level, `tokens`
(žetony) a osobní rekordy. Hra za 2 body a hra za rekord daly stejný level
a o průběhu hry se nevědělo nic.

**Stav po:** level roste z **XP** (výkon, dokončení, rekord, dharma násobek)
a každý dohraný běh projde **dharma validátorem** s pěti pilíři.

---

## 1. XP (`core/progress/xp.ts`)

| Vstup | Efekt |
|---|---|
| základ světa | `GAME_XP` (14 pro kabinet, 90 pro MOBU) |
| skóre proti cíli světa | `0,4 + 0,6 × ratio`, strop 1,5× |
| dokončení | ×1,25 |
| osobní rekord | ×1,15 |
| dharma | ×(1 + 0…0,5) |

Level: `1 + ⌊√(xp / 120)⌋` — **stejná křivka** jako dřívější
`2·(L−1)²` her, takže migrace `xp = runs × 60` level nezmění
(test to ověřuje na deseti bodech křivky).

Jediná tabulka „co je dobrý výkon" je `CHALLENGE_TARGETS`
(v `core/park/challenge.ts`, dřív privátní `TARGETS`) — denní výzva i XP
čtou totéž číslo.

---

## 2. Dharma validátor (`core/progress/dharma.ts`)

Předloha: `PoC-lab/poc-verifier` — `DharmaValidator` s pěti testy nad
care proofem (Non-harm, Authenticity, Benefit, Consciousness-alignment,
Temporal-coherence). Tady stejná pětice nad **herním během**:

| Pilíř | Otázka | Zdroj |
|---|---|---|
| **Ahiṃsā** — neubližovat | Neodešel jsi? Neopakoval jsi pád? | `abandoned`, `setbacks` |
| **Satya** — pravda | Byl běh skutečný? (≥ 3 s, plně od 12 s) | `seconds` |
| **Hita** — prospěch | Přinesl něco? | `completed` / `objectives` / `score` |
| **Smṛti** — bdělost | Prošel jsi svět? Dal jsi druhým? | `objectives` ratio, `given` |
| **Kāla** — čas | Dává čas smysl? (8 s – 30 min) | `seconds` |

Verdikt: `seal` (všech 5 + ≥ 90 bodů) · `pass` (≥ 70) · `partial` (≥ 45) ·
`thin`. Násobek XP: +50 / +25 / +10 / 0 %.

**Pravidla, která to drží:**
- chybějící údaj **není nula** (nezměřený běh dostane 0,6–0,85),
- „nevíme skóre" ≠ „skóre je 0",
- pilíře **nikdy neodečítají** — jen násobí XP a dávají pečeť.

---

## 3. UI

- **★ v herní liště** je teď tlačítko → otevře panel **Cesta**:
  level, XP bar s „do dalšího N", počet pečetí a validací, poslední
  verdikt (stupeň + 0–100) a všech pět pilířů s otázkou a ✓/·.
- **Výsledek každé hry** nese `+N XP` a `☸ 4/5` (nebo `☸ dharma pečeť`)
  přes `describeRun()` — osm napojených povrchů to dostalo bez vlastního
  kódu.
- **Žebříčky** (🏆) se opravily mimochodem: oba panely byly uvnitř
  `.game-hud`, která má `backdrop-filter` → **containing block pro
  `position: fixed`** → backdrop se smrskl na 38 px a okno vyjelo pod
  obrazovku. Panely jsou teď sourozenci `<nav>`.
- **Profil se srovnává hned:** `saveProfile()` posílá `nirvana:profile`,
  HUD poslouchá. Dřív se čísla aktualizovala až při `focus`.

---

## 4. Napojené hry (metrics)

| Hra | co posílá |
|---|---|
| Neptun | čas, dno, světla/15 |
| Pluto | čas, srdce, lampy/9 |
| Lumi | čas, světla, darování |
| Piko | čas, bóje nebo vlny, wipy |
| Venuše | čas, kola |
| Mars | fragy/10, smrti |
| Merkur | kola (sólo i online), prohry |
| MOBA | výhra, zabití, smrti |

Park kabinety, tanky a flotila jdou doplnit stejným vzorem (jedno
`metrics` v `recordRun`).

---

## 5. Ověření

- `npx tsc --noEmit` 0 · `npm run build` OK
- `npx tsx test/dharma.mjs` — **52/52** (pilíře, chybějící údaje,
  hraniční časy, stupně, stav pečetí, XP křivka)
- `npx tsx test/progress.mjs` — **OK** (XP křivka, migrace starého
  profilu, dharma v `recordRun`, výzva, level up)
- `npx tsx test/neptun-dive.mjs` 75/75 · `test/pluto-light.mjs` 56/56
- `node e2e/path-audit.mjs` — **19/19** (panel, prázdný profil, dohraná
  hra zapíše XP i dharmu, panel po hře, telefon)
- `node e2e/mobile-audit.mjs` — PASSED (10 her, 390×844)
- Screenshoty: `.artifacts/render/path/{panel-empty,panel-after,panel-phone}.png`

---

## 6. Pasti

1. **`backdrop-filter` na `.game-hud`** dělá z lišty containing block pro
   `position: fixed` → modální okna uvnitř lišty nefungují (pre-existing
   bug u Žebříčků, odhalen až auditem Cesty).
2. **Profil se neaktualizoval bez navigace** — vyřešeno událostí
   `nirvana:profile` v `saveProfile()`.
3. **`validateRun({})` nesmí dát nulu** — jinak by každá hra bez metrik
   vypadala jako špatný běh; proto neutrální hodnoty a test, který to drží.
4. **Dvě úrovně „pravdy" o levelu** — `levelFor(runs)` byla nahrazena
   `levelFromXp`; test porovnává migraci na deseti bodech, aby starý
   profil po aktualizaci nezdegradoval.

---

## 7. Meze

- XP, dharma i pečeti jsou **jen v prohlížeči** (`localStorage`), stejně
  jako žetony a rekordy. Nic z toho není on-chain a nedá se směnit.
- Dharma validátor hodnotí **běh**, ne hráče — žádné trvalé skóre
  „dobrého člověka".
- Park kabinety, tanky a flotila metrics zatím neposílají (validátor
  u nich běží s neutrálními hodnotami).
