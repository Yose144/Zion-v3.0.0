# Report — Neptun: Hlubina (`/neptune`) — 2026-11-11

**Zadání:** 👤 „pojďme teď pokračovat na Nirvaně a rozšiřování her" → z nabídky
vybráno **„Neptun — Hlubina (doporučeno)"**.

**Stav před:** `/neptune` byl jen dosier vnější planety (`OuterWorldPage`,
`core/outer/`). Kód to měl i okomentované („Co tu záměrně není: hra").
Neptun tak byl jediné těleso sluneční soustavy s vlastním vchodem a **bez**
hry (Uran má Lumi, Jupiter pouť, Pluto je jen místo).

**Stav po:** `/neptune` je hratelný sestup; dosier planety zůstal uvnitř menu
(6 faktů z NASA/JPL + text o hlubině), takže svět nepřišel o obsah.

---

## 1. Pravidla hry

| Prvek | Chování |
|---|---|
| Klesání | vždy (i bez vstupu); `W` zrychlí (11 → 18 m/s), `S` přibrzdí (na 5 m/s) |
| Vítr | 4,5–10,5 m/s podle vrstvy, dvě sinusoidy; `A`/`D` kormidluje proti němu |
| Ulička | 52 m (`LANE = 26`); mimo ni tlak ohne plášť (15/s) |
| Lucerna | **palivo na metr** (~0,10–0,16/m), světla ji dobíjí (+18, strop 140) |
| Plášť | chyba: stěna proudu, okraj víru (9/s uvnitř víru) |
| Světla | 15 statických, deterministických; +90 skóre každé |
| Víry | 5 statických; táhnou ke středu, berou lucernu (17/s) i plášť |
| Konec | dno 900 m (bonus +500), zhasnutá lucerna, prasklý plášť |

Pět vrstev: metanový opar (0–170), amoniakové krystaly (170–360), vodní clona
(360–540), iontová tma (540–720), tichá hlubina (720–900). Čísla jsou
v `core/neptun/world.ts`.

**Skóre:** `metry + světla × 90 + 500 (dno)`. Denní výzva: 600.

### Proč lucerna za metr, ne za sekundu

První verze spotřebovávala energii za sekundu. Změřená sehrávka (skript
„bot, který jde po světlech") ukázala, že pak je `W` **vždy** nejlepší volba:
rychlý sestup = kratší čas = méně energie, takže brzda nemá žádný smysl
a lucerna nikdy není problém (končila na 143/150). Po přepočtu na metr je
lucerna rozpočet na **vzdálenost**; rychlost rozhoduje jen o riziku.

---

## 2. Balance (měřeno simulací, ne odhadem)

| Strategie | Konec | Hloubka | Světla | Čas | Lucerna | Plášť | Skóre |
|---|---|---|---|---|---|---|---|
| jde po světlech + `W` | dno | 900 m | 15 | 50 s | 129 | 94 | 2750 |
| jde po světlech, bez `W` | dno | 900 m | 15 | 82 s | 129 | 100 | 2750 |
| jen `W`, bez kormidlování | dno | 900 m | 4 | 50 s | 44 | 57 | 1760 |
| bez vstupu | plášť | 745 m | 5 | 68 s | 64 | 0 | 1195 |
| **bez světel** + `W` | **lucerna** | ~770 m | 0 | — | 0 | — | — |

Z toho plyne design: **světla jsou palivo** (bez nich se na dno nedoletí)
a **kormidlování je povinné** (pasivní sestup skončí o stěnu proudu).
Test `test/neptun-dive.mjs` tenhle záměr hlídá dvěma kontrolami
(„bez světel lucerna na dno nedojde" / „kdo sbírá světla, doletí").

---

## 3. Soubory

**Nové**

- `apps/nirvana/src/core/neptun/world.ts` — vrstvy, světla, víry, čísla, `windAt`, `drainAt`
- `apps/nirvana/src/core/neptun/dive.ts` — čistá simulace (`stepDive`, `scoreOf`, `nextMote`)
- `apps/nirvana/src/core/neptun/NeptuneScene.tsx` — scéna (zvon, clony, sníh, šmouhy, světla, víry)
- `apps/nirvana/src/core/neptun/copy.ts` — texty cs/en/es
- `apps/nirvana/test/neptun-dive.mjs` — 75 kontrol simulace
- `apps/nirvana/e2e/neptune-audit.mjs` — 34 kontrol v prohlížeči

**Změněné**

- `apps/nirvana/src/app/neptune/page.tsx` — z dosieru na hru (menu + HUD + výsledek)
- `apps/nirvana/src/app/globals.css` — blok `.neptune-*`
- `apps/nirvana/src/core/games/links.ts`, `surfaces.ts` — popisek + `CONTROLS`/`SURFACES`
- `apps/nirvana/src/core/park/games/types.ts`, `park/scores.ts`, `park/challenge.ts`,
  `progress/boards.ts`, `src/app/api/park/scores/route.ts` — registrace hry (pět seznamů)
- `apps/nirvana/src/core/shell/Shell.tsx` — text panelu planety
- `apps/nirvana/e2e/mobile-audit.mjs` — `/neptune` do `PAGES`

---

## 4. Ověření

- `npx tsc --noEmit` — 0 chyb
- `npm run build` — OK (`/neptune` v seznamu rout)
- `npx tsx test/neptun-dive.mjs` — **75/75**
- `node e2e/neptune-audit.mjs` — **34/34** (menu, klesání, `W`, kormidlo,
  světlo, pauza hamburger menu, hluboké vrstvy, dno + zápis do profilu
  i tabule, dotyk, 0 chyb v konzoli, 0× 4xx/5xx)
- `node e2e/mobile-audit.mjs` — PASSED na 390×844 (přesah 0 px, 4 dotyková
  tlačítka) i 844×390
- Screenshoty: `.artifacts/render/neptune/{menu,dive,deep,result,phone}.png`
  (M1 Metal, 1440×900)

---

## 5. Pasti, které to odhalilo

1. **Mořský sníh musí být ukotvený ke kameře.** První verze nechala `Points`
   ve světovém počátku; v hloubce 70 m byl sníh 70 m nad kamerou a sestup
   vypadal jako statický obrázek. Odhalil to screenshot, ne kód.
2. **`PointsMaterial` bez `map`** kreslí bílé čtverečky → měkká radiální
   textura + `alphaTest`.
3. **Ztmavení pozadí v lineárním prostoru** (three default) je vizuálně skoro
   bez efektu; správně `convertLinearToSRGB → multiply → convertSRGBToLinear`.
4. **Clony jen na hranicích vrstev** = 170 m prázdna → clony každých 70 m.
5. **`.race-go` hláška seděla na zvonu** (top 42 %) → `.neptune-toast` na 68 %.
6. **Debug háček se registruje až po init WebGL**, takže „hloubka 0" na startu
   není 0 — test musí měřit `< 6 m`, ne `=== 0`.
7. **`/api/park/scores` je za ZAP branou** — Node `fetch` v auditu potřebuje
   cookie, jinak dostane HTML a `JSON.parse` spadne.

---

## 6. Meze

- **Sólo.** Žádný multiplayer (hra nemá soupeře ani kooperaci, takže by šlo
  jen o relay pozic — samostatný krok).
- **VR jen kód.** `<XR>` + `VrButton` jsou zapojené, ale na headsetu
  neověřené (stejně jako ostatní hry).
- **Zvuk je syntéza** ze sdíleného enginu (`lightPickup`, `gust`, `wall`,
  `splash`, `shrineOpen`) — žádné soubory.
- **Mobil je emulovaný** headless Chromiem (`isMobile`/`hasTouch`), ne skutečný
  telefon.
