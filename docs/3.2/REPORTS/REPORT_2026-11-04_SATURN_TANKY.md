# SATURN — TANKY (oldschool 2D + 3D)

**Datum:** 2026-11-04 · **Kde:** `nirvana.zionterranova.com/saturn` → tlačítko
**Tanky** · **Stav:** nasazeno.

## 1. Zadání

Na Saturnu (Kroniky / Archiv kruhů) přidat tanky: **oldschool 2D** artilerii
(jeden mód) a **novou 3D** verzi. Obě mají hrát stejnou hru.

## 2. Rozhodnutí: jedna pravidla, dva renderery

`core/saturn/tanks.ts` je **jediný** modul pravidel — pohyb střely, gravitace,
vítr, krátery, poškození, střídání tahů, konec hry i botovo mířidlo. Oba
renderery (`TanksCanvas`, `TanksScene`) stav jen **čtou**.

Kdyby si 2D a 3D držely vlastní fyziku, rozešly by se dostřely a „v oldschoolu
to padá jinam" by byla pravda. Stejné pravidlo jako u arény, závodu a MOBA.

## 3. Pravidla

| Věc | Hodnota | Kde |
|---|---|---|
| Hřiště | 1000 × 560 jednotek, terén 161 vzorků | `WORLD_W`, `TERRAIN_COLS` |
| Gravitace | 260 j/s² | `GRAVITY` |
| Rychlost střely | 260–470 j/s podle síly | `SPEED_MIN/MAX` |
| Vítr | ±46 j/s², **mění se každý tah** | `WIND_MAX`, `beginTurn` |
| Výbuch | r = 80, max 40 poškození s poklesem | `BLAST_R/DAMAGE` |
| Životy | 100 HP, tři zásahy na kill | `TANK_HP` |
| Kráter | sníží terén na spodní hranu kružnice, dno 24 | `carve` |

Bot hledá mířidlo **hrubou mřížkou** (17 úhlů × 20 sil) a pak **jemně doladí**
(0,5° / 1 síla) — hrubá mřížka sama minula o desítky jednotek. Výsledek pak
„lidsky" rozladí (`error = 2,6`), takže netrefuje vždy.

## 4. Dvě verze

### Oldschool 2D (`TanksCanvas`)

- Retro vzhled: ploché barvy, rastrové linky přes obraz, dithering v zemi,
  monospace písmo, tečkovaná stopa střely.
- HUD je **v obraze** (tah, úhel, síla, vítr, skóre, rány).
- Na telefonu je plátno malé, takže se HUD kreslí v **DOM** a v obraze zůstane
  jen velký nápis tahu (`compact` prop) — text 16 px na 960 px širokém plátně
  je na 390 px displeji nečitelný.

### 3D (`TanksScene`)

- Terén je **jedna heightmapa** (`PlaneGeometry`), kterou zásahy přepisují:
  sim sníží výšky a scéna podle `terrain.version` přepíše vrcholy.
- Deska je **větší než hřiště** (1,7× šířka, 1500 hloubka) — jinak jsou vidět
  okraje a hřiště vypadá jako prkno ve vesmíru.
- Kamera jede za střelou (při letu blíž), jinak drží oba tanky v záběru.
- Stínová kamera směrového světla je zvětšená na ±700 — s výchozím rozměrem
  se do scény propisoval obdélník frusta a půlka mapy byla tmavá.

## 5. Ovládání

- Klávesnice: `←`/`→` úhel, `↑`/`↓` síla (držením se plynule mění), `mezerník`
  palba, `R` nová hra, `Esc` zpět na Kroniky.
- Dotyk: čtyři šipky + **PALBA**, po konci **NOVÁ HRA** nad ovládáním.
- Během hry je `body[data-playing='1']`, takže zmizí navigace i chat.

## 6. Ověření

| Test | Výsledek |
|---|---|
| `test/saturn-tanks.mjs` | **48/48** — determinismus mapy, dostřel, vítr, kráter, poškození, střídání tahů, konec hry, rematch, telemetrie |
| mobile audit (390×844) | **PASSED** — nově i `/saturn` (5 dotykových prvků), 0 JS chyb |
| mobil 390×844 / 844×390 | overflow **0 px**, 0 chyb |
| screenshoty | `.artifacts/render/tanks-2d.png`, `tanks-2d-let.png`, `tanks-3d.png`, `tanks-mobil-2d.png` |

## 7. Meze

- Hra je **sólo proti botovi** — žádný multiplayer (protokol by musel nést
  celý stav letu; dnes by to znamenalo bump `PROTO_VERSION`).
- 3D je jeden pohled (střela + nadhled), ne volná kamera; VR neřešeno.
- Na výšku telefonu je hřiště 16:9 malé (nutně) — ovládání je pod ním.
- Bez zvuku, bez animace pásů, bez vícenásobných zbraní (jeden mód, jak zadáno).
- Bot neumí „chytře" měnit taktiku (vítr řeší jen dosahem), takže na velký
  protivítr občas netrefí — to je záměr, ne bug.
