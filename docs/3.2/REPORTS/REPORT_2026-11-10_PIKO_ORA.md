# Te Pīko Ora — hratelná laguna v Nirvaně (`/piko`)

**Datum:** 2026-11-10
**Rozsah:** `apps/nirvana` (pouze Nirvana — web ani Kingdom se nemění)
**Stav:** hotovo lokálně, otestováno; **nenasazeno na produkci**.

## Co to je

Nová routa `/piko` nabízí dvě vodní hry v jednom světě — polynéskou lagunu
Raiatea s vesnicí, palmami, molem, útesem a západem slunce.

| Hra | Mechanika | Skóre |
|---|---|---|
| **Va'a — kánoe** | šest bójí v pořadí, záběry v rytmu, kormidlo, brzda | 6 × 120 + časový bonus (plný do 100 s) |
| **Nalu — surf** | tři vlny, kapsa se posouvá, řez bere balanc, pumpování zrychluje | vzdálenost + čas v kapse + čistá jízda |

Obě hry se zapisují do **společné tabule `piko`** a do progrese přes
`recordRun` (žetony, rekord, denní výzva, level). Denní cíl je 600.

## Soubory

- `apps/nirvana/src/core/piko/world.ts` — laguna, kurz, výška hladiny, barvy.
- `apps/nirvana/src/core/piko/canoe.ts` — fyzika kánoe + skóre.
- `apps/nirvana/src/core/piko/surf.ts` — kapsa, balanc, tři vlny + skóre.
- `apps/nirvana/src/core/piko/copy.ts` — texty (cs/en/es, fallback pro pt/fr).
- `apps/nirvana/src/core/piko/PikoScene.tsx` — scéna (jeden canvas pro obě hry).
- `apps/nirvana/src/app/piko/page.tsx` — menu, HUD, dotyk, výsledky.
- `apps/nirvana/test/piko-sim.mjs` — 53 kontrol simulace bez prohlížeče.
- `apps/nirvana/e2e/piko-audit.mjs` — 34 kontrol v prohlížeči (obě hry,
  dojetí kurzu i sady vln, zápis do profilu, pauza společným menu, dotyk,
  přesah, HUD vs. ovládání, koncept → hra, konzole).
- Registrace hry: `ParkGameId`, `emptyScores`, `/api/park/scores`,
  `mobile-audit.mjs` (dotykový běh `/piko`),
  `challenge.ts`, `progress/boards.ts`, `games/links.ts` a
  `core/games/surfaces.ts` (`SURFACES` + `CONTROLS`).
- Zvuky: `stroke`, `gate`, `swell`, `wipeout` ve `core/audio/engine.ts`.
- CTA z konceptu `/present/te-piko-ora` do hry.

## Ověření

- `npx tsx test/piko-sim.mjs` → **PASSED 53/53**.
- `npx tsc --noEmit` v `apps/nirvana` → čisté.
- `npx next build` → úspěch, `/piko` v routách.
- `node e2e/piko-audit.mjs` → **34/34**:
  menu, kánoe (pádlo, rychlost, bóje), dojetí kurzu, výsledková karta,
  zápis do profilu + rekord, surf (vlna, pumpování, balanc), dojetí tří vln,
  pauza hamburger menu (kánoe stojí a po zavření jede dál), čtyři dotyková
  tlačítka, žádný vodorovný přesah, HUD nad ovládáním, CTA z konceptu,
  žádné chyby v konzoli.
- Naměřeno (`swiftshader`, 1440×900): **32 draw calls**, 26 902 trojúhelníků,
  2 textury, 36 geometrií — scéna je hluboko pod rozpočtem univerza.
- Screenshoty: `.artifacts/render/piko/{menu,canoe,result,surf,phone}.png`.

## Co se při ladění potvrdilo

1. **Snímek, ne kód.** Hory byly černé pyramidy, molo stálo v ose kamery
   a vlna přerůstala záběr. Všechno „fungovalo“ — jen se na to nedalo dívat.
2. **Vlna nesmí být mezi kamerou a surfařem.** Dlouhý pruh pěny v této pozici
   přerostl celý záběr; pěna je teď měkká (radiální canvas textura) a kamera
   je za surfařem, takže pozadím je břeh a vesnice.
3. **Kapsa potřebuje ukazatel.** Její rozkmit je ±20 m, takže často není
   v záběru; HUD má proto šipku `◀/▶` a ve scéně je zlatý prstenec.
4. **Barvu projeté bóje přes `instanceColor` jsem nerozchodil** — šest
   samostatných meshů je spolehlivějších a stojí šest draw callů.
5. **Držené pádlo = rytmus, ne plyn.** Bez cooldownu by se kánoe chovala jako
   auto a otočka by nebyla dovednost.
6. **Pěna musí být textura, ne kruh.** Ostrý okraj elipsy vypadal jako
   papírový výstřižek; radiální gradient v canvasu to spravil za jednu texturu.
7. **Hra respektuje společnou pauzu** (`core/games/pause`): `useFrame` se
   při otevřeném hamburger menu přeskočí a klávesy se pouští, takže kánoe
   po zavření menu nevypluje sama.
8. **Registrace povrchu je dnes v `core/games/surfaces.ts`** (lišta i hamburger
   menu ji čtou odtamtud). Když se `/piko` přidá jen do `GameHud`, lišta se
   na stránce nevykreslí.

## Meze (co se nemá hlásit jako hotové)

- Žádný multiplayer (hlediště ani koop).
- VR je připravené v kódu (`useXr`, `VROrigin`, syntetické klávesy),
  ale **netestované na headsetu**.
- Mobil je ověřený v headless Chromiu s emulací dotyku, ne na telefonu.
- Žádné lodě na obzoru, delfíni, ptáci ani hudba; zvuky jsou syntetizované.
- Produkční deploy neproveden.
