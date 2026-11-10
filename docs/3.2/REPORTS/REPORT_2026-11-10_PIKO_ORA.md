# Te Pīko Ora — hratelná laguna v Nirvaně (`/piko`)

**Datum:** 2026-11-10
**Rozsah:** `apps/nirvana` (pouze Nirvana — web ani Kingdom se nemění)
**Stav:** hotovo lokálně, otestováno; **nenasazeno na produkci**.

## Co to je

Nová routa `/piko` nabízí dvě vodní hry v jednom světě — polynéskou lagunu
Raiatea s vesnicí, palmami, molem, útesem a západem slunce.

| Hra | Mechanika | Skóre |
|---|---|---|
| **Va'a — kánoe** | šest bójí v pořadí, záběry v rytmu, kormidlo, brzda, boční vítr | 6 × 120 + časový bonus (plný do 100 s) |
| **Nalu — surf** | tři vlny, kapsa se posouvá, flow/násobič, vzdušné triky, balanc | vzdálenost + čas v kapse + triky + čistá jízda |

Obě hry se zapisují do **společné tabule `piko`** a do progrese přes
`recordRun` (žetony, rekord, denní výzva, level). Denní cíl je 600.

## Profi vrstva

- **Pas** (`core/piko/passport.ts`, `localStorage` `nirvana.piko.v1`):
  medaile (bronz/stříbro/zlato), rekord a nejlepší čas pro každý mód,
  počet jízd, odemčené skiny a uložený duch. Medaile se nikdy nesnižuje,
  skin se odemyká jen ve svém módu (bronzová kánoe neodemkne prkno).
- **Medaile:** kánoe 720/900/1050, surf 800/1100/1400. Surf je vyšší,
  protože triky umí přidat stovky bodů — bez toho by zlato padlo i bez rizika.
- **Skiny:** tři pro kánoi (`Koa`, `Moana`, `Ahi`) a tři pro prkno
  (`Nalu`, `Moana`, `Ahi`); mění barvu trupu/prkna i pádla/pruhu.
- **Duch** (`core/piko/ghost.ts`): při novém rekordu se uloží vzorkovaná
  dráha (0,2 s) a při další jízdě ji scéna přehraje jako průsvitný obrys.
  Vzorkování je časové, takže stejná jízda vypadá stejně na 30 i 144 fps.
- **Surf flow a triky:** pobyt v kapse zvedá flow 0→1 a násobič 1→3,
  zvedá rychlost a násobí bonus za vzdušný trik (`Space`/`F`; na dotyku
  páté tlačítko „trik“). Vzduch bere balanc; přistání mimo balanc = pád.
- **Vítr u kánoe:** boční vítr se v čase stáčí, unáší loď i bez záběru
  a HUD ukazuje jeho směr vůči přídi. Bez kormidlování kurz ujede.
- **Minimapa** (`PikoMinimap`, SVG): kánoe = laguna, šest bójí, hráč, duch
  a vítr; surf = průběh vlny, laterální pruh s kapsou, flow a metry.
- **Vizuál:** stříkající voda (pool 72 částic), camera shake při pádu,
  dynamický FOV podle rychlosti, odlesky a pěna z jedné canvas textury.
- **Zvuk:** nové `splash`, `trick` a `medal` ve sdíleném syntezátoru.

## Soubory

- `world.ts` — laguna, kurz, výška hladiny, barvy.
- `canoe.ts` — fyzika kánoe, vítr, skóre.
- `surf.ts` — kapsa, balanc, flow, triky, tři vlny, skóre.
- `passport.ts` — medaile, skiny, rekordy, odemykání, persistence.
- `ghost.ts` — záznam a interpolace nejlepší jízdy.
- `effects.ts` — pool stříkající vody (čistá čísla, testovatelné).
- `PikoMinimap.tsx` — SVG minimapa.
- `PikoScene.tsx` — jeden canvas pro obě hry (voda/obloha shadery, instancing).
- `app/piko/page.tsx` — menu, pas, HUD, dotyk, výsledky.
- `test/piko-sim.mjs` — 64 kontrol simulace.
- `test/piko-pro.mjs` — 54 kontrol pasu, ducha a částic.
- `e2e/piko-audit.mjs` — 48 kontrol v prohlížeči (obě hry, dojetí,
  medaile/skiny, duch, minimapa, pauza, dotyk, přesah, koncept, konzole).
- Registrace: `ParkGameId`, `emptyScores`, `/api/park/scores`,
  `challenge.ts`, `progress/boards.ts`, `games/links.ts`,
  `core/games/surfaces.ts`, `mobile-audit.mjs`.
- CTA z konceptu `/present/te-piko-ora` do hry.

## Ověření

- `npx tsx test/piko-sim.mjs` → **PASSED 64/64**.
- `npx tsx test/piko-pro.mjs` → **PASSED 54/54**.
- `npx tsx test/progress.mjs` → **PROGRESS OK**.
- `npx tsc --noEmit` v `apps/nirvana` → čisté.
- `npx next build` → úspěch, `/piko` v routách.
- `node e2e/piko-audit.mjs` → **48/48**:
  menu, kánoe (pádlo, rychlost, bóje), pauza, dojetí kurzu, výsledek,
  zápis do profilu, medaile/skiny, duch + minimapa, surf (vlna, pumpování,
  balanc), dojetí tří vln, pět dotykových tlačítek, přesah, HUD vs. ovládání,
  CTA z konceptu, konzole.
- Naměřeno (1440×900): **33 draw calls**, 26 902 trojúhelníků, 2 textury,
  37 geometrií — scéna je hluboko pod rozpočtem univerza.
- Screenshoty: `.artifacts/render/piko/{menu,canoe,result,surf,ghost,phone}.png`.

## Co se při ladění potvrdilo

1. **Snímek, ne kód.** Hory byly černé pyramidy, molo stálo v ose kamery
   a vlna přerůstala záběr. Všechno „fungovalo“ — jen se na to nedalo dívat.
2. **Vlna nesmí být mezi kamerou a surfařem.** Dlouhý pruh pěny v této pozici
   přerostl celý záběr; pěna je teď měkká (radiální canvas textura) a kamera
   je za surfařem, takže pozadím je břeh a vesnice.
3. **Kapsa potřebuje ukazatel.** Její rozkmit je ±20 m, takže často není
   v záběru; HUD má šipku `◀/▶`, ve scéně zlatý prstenec a minimapu.
4. **Barvu projeté bóje přes `instanceColor` jsem nerozchodil** — šest
   samostatných meshů je spolehlivějších a stojí šest draw callů.
5. **Držené pádlo = rytmus, ne plyn.** Bez cooldownu by se kánoe chovala jako
   auto a otočka by nebyla dovednost.
6. **Pěna musí být textura, ne kruh.** Ostrý okraj elipsy vypadal jako
   papírový výstřižek; radiální gradient v canvasu to spravil za jednu texturu.
7. **Částice chtějí vlastní shader.** `PointsMaterial` bez textury kreslí
   bílé čtverečky; shader s `gl_PointCoord` a `discard` dá měkké kapičky
   bez další textury.
8. **Pro panel na mobilu schoval start pod lištu.** `.game-hud` má
   `z-index: 55`, takže „Vyplout“ pod ním nešlo kliknout; `.piko-panel` má
   na ≤760 px spodní inset 6,5 rem, aby se akce daly odscrollovat nad lištu.
9. **Duch se na startu překrýval s hráčem** (obě jízdy začínají na stejných
   souřadnicích) — ukazuje se až po 0,4 s jízdy.
10. **Test flow musí kapsu sledovat.** Statické `x = pocketTarget` po 3 s
    ujede, protože kapsa se posouvá; test proto každý krok `x` dorovnává.
11. **Hra respektuje společnou pauzu** (`core/games/pause`): `useFrame` se
    při otevřeném hamburger menu přeskočí a klávesy se pouští, takže kánoe
    po zavření menu nevypluje sama.
12. **Registrace povrchu je dnes v `core/games/surfaces.ts`** (lišta i hamburger
    menu ji čtou odtamtud). Když se `/piko` přidá jen do `GameHud`, lišta se
    na stránce nevykreslí.

## Meze (co se nemá hlásit jako hotové)

- Žádný multiplayer (hlediště ani koop) — ghost je jen lokální.
- VR je připravené v kódu (`useXr`, `VROrigin`, syntetické klávesy),
  ale **netestované na headsetu**.
- Mobil je ověřený v headless Chromiu s emulací dotyku, ne na telefonu.
- Žádné lodě na obzoru, delfíni, ptáci ani hudba; zvuky jsou syntetizované.
- Skiny jsou jen barvy (žádné nové 3D modely).
- Produkční deploy neproveden.
