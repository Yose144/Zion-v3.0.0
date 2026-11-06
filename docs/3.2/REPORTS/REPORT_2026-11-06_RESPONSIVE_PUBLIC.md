# Responsivní doladění veřejných povrchů

**Datum:** 2026-11-06
**Rozsah:** veřejný web, intro, freeworld, market, pool, Oáza, Nirvana, Kingdom (brána a svět)
**Stav:** změřeno v prohlížeči, **nenasazeno**. Kód jde do gitu spolu s veřejnými jazyky. Mimo záběr zůstaly dashboard, peněženka a Electron.

Šířky: telefon **390**, tablet **768**, desktop **1280**. Hry navíc tablet na výšku **768×1024** a na šířku **1024×768**. Rasta pill navíc **900** a **1024**. Měření je emulace v headless Chromu (dotyk zapnutý pod 1024). Skutečný telefon ani VR headset v tomhle průchodu nebyly.

## Co se opravilo

**Oáza, let.** Na 390 i 768 středový shluk boost/exit (104×48) ležel celý přes čip cíle „Galactic Core … ly“ (překryv 104×45). HUD v letu je pod `lg` zvednutý na `bottom-16`, od `lg` zůstává `bottom-4`. Po dohrání výstupní animace (měřeno až po 1,6 s, panely s opacity ≤ 0,2 se nepočítají) je mezera asi 24 px, překryv 0, přesah stránky 0, tlačítko odchodu je na obrazovce. Joysticky 90 px a středová tlačítka jsou nad 44 px a s čipem se vodorovně nepotkají.

Procedurální prstenec motoru je `MeshBasicMaterial` a nemá `emissive`. Každý snímek letu házel chybu a zasekl dev server. `PilgrimShip` teď `emissive` nastaví jen když ho materiál má.

**Market, 3D náhled.** Plátno `StarfighterViewer` má třídu `touch-none` a po mountu `touch-action: none`. Spočítaný styl na otevřené kartě A-Wing je `none` na 390, 768 i 1024, přesah stránky 0. Lokální katalog nejde z databáze (`DATABASE_URL` chybí, API vrací 500), takže seznam produktů v prohlížeči dodal mock jedné položky se stejným `modelUrl`. Otevřít `/shop` je potřeba přes `localhost`, ne `127.0.0.1` — Next na tomhle dev serveru jinak zablokuje dev resources a stránka zůstane na „Načítání“.

## Co se neměnilo, protože se to vešlo

**Rasta pill.** Zlom v `apps/shared/ui/rasta-nav.css` zůstává **868 px**. Na 900 a 1024 je desktop menu `flex` a vejde se: market má asi 345 px rezervy, pool asi 146 px. Na 768 je hamburger. Pool na 390/768/900/1024/1280 nemá přesah stránky.

**Nirvana, tablet.** `AUDIT_TABLET=1` proti `next dev` na `:3010` s `ZION_RENDER_AUDIT=1`: **PASSED**, 768 i 1024, 0 px přesah, ovládání vidět (Mars 4, Venuše 4, Merkur 6, Pouť 5, Země 10, Saturn 5, Flotila 7), kouzlo na Zemi sníží manu 482 → 456, konzole bez přesahu. Kód Nirvany se kvůli tomu neměnil, telefonní běh se nespouštěl znovu. První běh spadl proto, že dev server mezitím skončil a klient mířil na cizí net na `:3012` (WebSocket 403). Po čistém startu bez `NEXT_PUBLIC_NIRVANA_NET_URL` ty chyby nejsou.

**App** (`next build --webpack`, pak `next start` na `:3125`), stránky `/`, `/zion-archive/kralovstvi-srdce/cist`, `/explorer`, `/market`, `/l4-oasis/avatars`, `/l5-free-world` na 390/768/1280: přesah 0, bez pageerror. Na 390 se otevře dialog avatara a menu na homepage, přesah zůstane 0. Fakta ve čtečce jsou `grid-cols-1 sm:grid-cols-3`. Turbopack `next build` i `next dev` na `:3124` padají na volitelných modulech peněženky a na aliasu `net` → prázdný modul, který rozbije serverový `import('net')` v `zion-rpc.ts`. Stuby do `node_modules` se nepřidávaly. Webpack build je zelený.

**Intro** (`:3001`) na 390/768/1280: přesah 0 i po sjetí na patičku. Stargate stránku neroztahuje. `public/assets/css/main.css` se nepřepisoval. Ikony GitHub/Discord v `intro-rasta.css` mají teď nejméně 44×44 (dřív 39–42). Plovoucí menu na 390 je 46×44. Řádek „L5 Free World“ v textu zůstává výška řádku, není to tlačítko.

**Freeworld.** Šablona v `src/` má `window.FW_SITES = <!--GEN:SITES_JSON-->` a v prohlížeči hlásí `Unexpected end of input`. Měřil se build (`npm run build` → `dist/`). Na 390/768/1280 je přesah 0, mapa i QV se doscrollují. Pod 940 px je hamburger 44×44, značka v liště 44 px, odkazy v šuplíku a přepínač jazyka taky nejméně 44. Zavřený `.fw-nav-mobile` na 1280 leží mimo viewport a scroll stránky nezvětší.

**Kingdom.** Brána `/` a `/world/amenti` na 390/768: přesah 0. Pod 780 px mají lišta, značka, „Vejdi dovnitř“, odkazy brány a návrat ze světa nejméně 44 px (vstup je 132×44). Středové logo brány na 390 je 44×44 (dřív 37×37).

## Build

| App | Příkaz | Výsledek |
|---|---|---|
| `apps/OasisWeb` | `npx next build` | exit 0 |
| `apps/MarketPlace` | `npx next build` | exit 0 (varování traceru u `zion-l1.ts`, build doběhl) |
| `apps/website-v2.9` | `npx next build --webpack` | exit 0 |
| Nirvana | — | kód se neměnil, tabletový audit stačil |

## Meze

Emulace, ne telefon v ruce. VR her se nespouštělo. Deploy se nedělal. Pětijazyčný `Lang` v marketu a z něj plynoucí `tsc` webu se nesahaly. `next dev` sám připsal `apps/OasisWeb/AGENTS.md`, `apps/pool-ui/AGENTS.md` a `next-env.d.ts` — do commitu nepatří.
