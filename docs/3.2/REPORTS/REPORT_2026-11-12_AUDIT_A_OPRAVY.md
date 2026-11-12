# Report — Audit Nirvany a opravy bugů — 2026-11-12

**Zadání:** 👤 „projeď si Nirvanu komplexně a spíš teď opravuj bugy."

**Metoda:** `tsc` (+ `--noUnusedLocals`), kompletní sada 30 unit testů, 12 E2E
auditů, **sweep všech 33 rout** (status + konzole + 4xx), kontrola odkazů
a datových seznamů, ruční čtení rizikových míst.

**Výsledek:** 8 opravených chyb (3 uživatelsky viditelné), 1 nový regresní
test, 1 úklid mrtvého kódu. Vše zelené.

---

## 1. Online MOBA ignorovala vybraný battle spell

`MobaOnline` (wrapper) destrukuroval `battleSpell`, ale **nepředával ho**
do `OnlineController`. Server dostal `undefined` a použil výchozí Flicker —
hráč si před zápasem vybral Heal nebo Purify a ve hře měl jinou schopnost.

**Fix:** `battleSpell={battleSpell}` v předání. (Přesně ta třída chyby,
před kterou varuje `AGENTS.md` – „wrapper ztratí prop".)

---

## 2. Pouť neukazovala skóre Neptunu, Pluta a Flotily

`app/park/page.tsx` měl **vlastní šestou kopii** seznamu her (`TITLES`),
ve které chyběly tři nové hry. Důsledky: jejich skóre se na pouti vůbec
nezobrazilo a denní dharma cíl u nich vypsal syrové `id` místo názvu.

**Fix:** seznam se bere z `progress/boards.ts` (`GAME_ORDER` + `GAME_TITLES`),
do `GAME_TITLES` doplněny španělské názvy, mrtvá kopie smazána.
`e2e/park-fair.mjs` teď kontroluje, že tabule má **všech 17** her.

---

## 3. Třináct scén dělalo 404 při každém načtení

`SceneSoundToggle` posílal při mountu `HEAD /audio/<slug>.mp3`, ale zvukové
soubory v repu nejsou (ambience je syntetizovaná) → každá z 13 prezentací
vyrobila 404 v konzoli a zbytečný request.

**Fix:** sonda se dělá **až při prvním kliknutí** na „♪ zvuk" — zkusí track
přehrát, a když spadne, přepne na ambienci. „Přilož soubor a hraje" platí
dál, jen se to neptá předem. README v `public/audio/` aktualizován.

---

## 4. Střelnice posílala do dharma validátoru cizí čas

`startGallery` nenastavoval `startedAt`, takže `recordRun('gallery', …)`
poslal čas z **předchozí** arkádové hry (nebo žádný) — pilíře Satya a Kāla
pak hodnotily něco jiného, než se hrálo.

**Fix:** `startedAt.current = Date.now()` při startu střelnice (+ `l` v deps,
aby hláška nebyla v předchozím jazyce).

---

## 5. Neptun i Pluto odkazovaly na Uran jako „Dosier planety"

Obě stránky měly `<Link href="/uranus">Dosier planety</Link>` (copy-paste).
Na Plutu to nedávalo smysl vůbec.

**Fix:** odkaz vede na **předchozí planetu** a text to říká: Neptun →
„← Uran — archiv", Pluto → „← Neptun — Hlubina".

---

## 6. Denní dharma cíl mohl padnout na stejnou hru jako výzva

Komentář v kódu tvrdil, že jiná sůl zajistí jinou hru; měření přes rok
ukázalo **27/365 dní (7 %) shody**, takže jeden běh splnil oba cíle.

**Fix:** hra výzvy se z losování vynechává; test `consciousness.mjs` hlídá
**0 kolizí za 365 dní**.

---

## 7. Lumi a Uran neměly v liště nápovědu k ovládání

`CONTROLS` v `core/games/surfaces.ts` neměl záznam pro `/lumi` a `/uranus`
(obě jsou v `SURFACES`), takže se na nich nápověda nevykreslila.

**Fix:** doplněny texty (cs/en/es/pt/fr).

---

## 8. Menší úklid (mrtvý kód a rozejité konstanty)

- Pluto HUD dělil `channel` zkopírovanou konstantou `1,5` → import `LIGHT_TIME`.
- Nepoužitý import `WARMTH_MAX` v `PlutoScene`.
- Mrtvé CSS `.neptune-facts*` (po sjednocení na `.planet-facts`).

---

## 9. Nový regresní test: `test/game-lists.mjs` (28 kontrol)

Hlídá právě tu chybu z bodu 2: `GAME_ORDER`, `GAME_TITLES`, `GAME_XP`,
`emptyScores`, `CHALLENGE_GAMES` a `CHALLENGE_TARGETS` musí mít **stejnou
množinu her**, každá hra musí mít název, ikonu, XP i cíl výzvy; `GAME_LINKS`
nesmí odkazovat mimo `SURFACES`; NCL cíle musí mířit na existující hry
a být dosažitelné.

---

## 10. Ověření

- `npx tsc --noEmit` 0 · `npm run build` OK
- **30/30 unit testů** zelených (včetně nového `game-lists` 28/28)
- **sweep 33 rout**: 0 problémů (dřív 13× 404 na `/audio/*`)
- `park-fair` PASSED (nové kontroly 17 sloupců) · `pluto-audit` 30/30 ·
  `neptune-audit` 34/34 · `path-audit` 26/26 · `first-world` VŠE OK ·
  `mars-arena` PASSED (s net službou) · `mobile-audit` PASSED (390×844) ·
  `surfaces-audit` PASSED (390×844 i 1280×800) · `deep-links` PASSED
- **end-to-end pečeť**: sehrávka Pluta v prohlížeči dala
  `rekord · +6 žetonů · +410 XP · ☸ dharma pečeť · +4 NCL · dharma cíl +3 ·
  level 2 · CL 1` a profil `grade: seal`, 100/100, všech 5 pilířů

---

## 11. Co audit nenašel (a proč)

- žádné `TODO`/`FIXME`, žádný `console.log`, žádný `@ts-ignore` ani `: any`
  v `src/**`
- žádný rozbitý interní odkaz (12 statických `href` + `/present/*` proti
  datům `freeworld-sites.ts` — 0 neshod)
- `localStorage` s poškozeným profilem nespadne (`try/catch` + koerce)

**Zbývá (vědomě neopraveno, je to feature gap, ne bug):** online zápas arény
se zapisuje jen hráči se sedlem (divák ne), a `MarsMultiplayer` nemá
výsledkovou kartu — hláška plave nad HUDem.
