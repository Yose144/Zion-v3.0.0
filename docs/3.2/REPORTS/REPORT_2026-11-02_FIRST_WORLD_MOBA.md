# PRVNÍ SVĚT — MOBA na Zemi (L4 × L5)

**Datum:** 2026-11-02 · **Route:** `/earth` · **Stav:** hratelné sólo proti botovi, lokálně ověřeno

## Zadání

👤: „hlavně by každá z avatarů měla umět kouzla… a tak mě napadá první hra, která
by mohla být best of prvního světa OASIS, a to je něco na způsob LOL, pojďme ji
postavit… třeba přímo na Zemi a zahrneme do toho L5 uzle."

## Co je hotové

### 1. Každá postava umí čtyři kouzla — z kánonu

`core/moba/spells.ts` bere **ability z `avatars.json`** (`Dharma Shield`,
`Agni Pariksha`, `Cosmic Vision`, `Bajrang Bali`…) a překládá ji na sadu
**Q / W / E / R**:

- 11 škol (`ward`, `fire`, `arrow`, `blade`, `cosmic`, `mind`, `nature`, `storm`,
  `song`, `shadow`, `beast`) — rozhoduje text schopnosti, ne náhoda;
- každá škola má vlastní jména (`Lotus Awakening`, `Thousand Arrows`,
  `All Timelines at Once`, `Final Verdict`…), čísla a chování;
- poškození, štít, heal, zpomalení, dosah, cooldown i cena manasu;
- barva VFX = paprsek postavy, takže kouzlo „patří" hrdinovi;
- **deterministické**: stejné id dá vždy stejnou sadu, takže cizí hráč jde
  vykreslit jen z `avatarId` (stejné pravidlo jako u modelu).

### 2. Mapa: Země, tři linky, tři uzly L5

`core/moba/map.ts` — rovina 84 × 60 m, tři linky (`top`, `mid`, `bottom`),
**12 věží + 2 Nexy**, spawn vlny každých 24 s (3 minioni na linku).

**Uzly L5** jsou herní mechanika, ne dekorace: `Kailash`, `Uluru`, `Ekam`.
Kdo u uzlu stojí **2,6 s**, převezme ho; každý držený uzel dává týmu **+5 %
poškození**. Klíče sedí na `FREE_WORLD_MISSIONS`, takže uzel jde dohledat
na komunitní stránce.

### 3. Simulace (`core/moba/sim.ts`)

Jeden modul pro všechny (pravidlo M2a): pohyb, kouzla, vlny, věže, Nexy,
převzetí uzlů, XP a levely, respawn, konec zápasu. Klient posílá jen vstup;
poškození, smrt i vítězství počítá sim. Konec nastane pádem Nexy **nebo** po
8 minutách podle zbylého HP Nexů.

### 4. Klient a HUD

`/earth` — výběr z 12 startovních hrdinů, izometrická kamera, WASD pohyb,
Q/W/E/R na kurzor, držené levé tlačítko = útok. HUD: HP/mana, level, K/D,
dvě lišty Nexů, čas, vlna, tři chipy uzlů (barva = kdo je drží), lišta kouzel
s cooldownem a cenou manasu, bannery („Vlna 2", „Kailash převzat") a výsledková
obrazovka. Route je zařazená do `core/games/links.ts` (dock, konzole, pouť).

## Ověření

| Co | Výsledek |
|---|---|
| `tsc --noEmit` (nirvana) | čisté |
| `next build` (nirvana) | OK, `/earth` 200 |
| `npx tsx apps/nirvana/test/moba-sim.mjs` | **21/21** (kouzla, vlny, Q zásah, štít, věž, uzel, konec, limit) |
| `node apps/nirvana/e2e/first-world.mjs` | **11/11** headless (start, vlna, kouzlo, uzel, vítězství, 0 chyb) |
| Screenshoty | `.artifacts/render/first-world-20261102/{start,fight,victory}.png` |

## Meze (nehlasit jako hotové)

- **Jen sólo proti botovi.** Multiplayer (2v2/3v3 přes `nirvana-net`) je další
  krok a vyžádá si `PROTO_VERSION` bump + serverovou autoritu jako u arény.
- **Žádný obchod, itemy, úrovně kouzel ani mlha války.** Záměr: nejdřív
  ověřit, že základní smyčka baví.
- **Bez zvuku**, bez dotykového ovládání na mobilu, bez VR.
- Věže a minioni mají jednoduchou AI (nejbližší cíl), nepushují linky takticky.
- Modely hrdinů jsou procedurální (`AvatarModel`) — finální charaktery přijdou
  s portréty.

## Reprodukce

```bash
cd apps/nirvana && npm run build && npx next start -p 3010
npx tsx apps/nirvana/test/moba-sim.mjs          # pravidla
node apps/nirvana/e2e/first-world.mjs           # hra v prohlížeči
# ladění: http://127.0.0.1:3010/earth?mobaDebug=1  → window.__mobaDebug()
```
