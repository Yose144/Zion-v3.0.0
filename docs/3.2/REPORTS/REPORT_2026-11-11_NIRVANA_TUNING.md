# Nirvana — tuning všech her (2026-11-11)

**Rozsah:** `apps/nirvana` + testovací infrastruktura. Cizí soubory paralelní
session (net/aréna/Mercury WIP) jsem needitoval.
**Stav:** opraveno a ověřeno lokálně; **produkční deploy pozastaven** (viz konec).

## Metoda

Nejdřív měření, pak opravy:

1. Všech 22 unit testů (`npx tsx test/*.mjs`) — 22/22 OK.
2. Mobilní audit na třech viewportech: telefon 390×844, na šířku 844×390,
   tablet 768×1024 a 1024×768.
3. `surfaces-audit` (ostatní povrchy), `responsive.mjs` (10 rout × 4 viewporty),
   `draw-calls.mjs` (draw calls/fps).
4. Herní E2E: pouť, Mars, Merkur, První svět, flotila, Piko, vesmírné odkazy,
   deep links, mobilní flotila, online duel a online MOBA.
5. Po opravách znovu to samé (regrese).

## Co bylo rozbité a co se opravilo

1. **Start hry na mobilu se schoval pod pevnou lištu.**
   `.game-hud` má `z-index: 55`, herní panel je scrollovatelný a poslední akce
   („Na start“, „Spustit zápas“, „Vyplout“) skončily pod lištou. Na telefonu
   proto nešlo vůbec kliknout; audit to ukazoval jako „chybí dotykové ovládání“.
   → `.arena-panel` má na ≤760 px `padding-bottom: 6.5rem` (inset je uvnitř
   scrollu, takže se akce dají odscrollovat nad lištu). Platí pro všechny hry,
   ne jen Piko.

2. **Merkur: mobilní audit hledal starý text startu.** Tlačítko se jmenuje
   „Spustit zápas“, test čekal „Cvičit proti botovi“ → klik se nikdy nestal.
   → regex v `e2e/mobile-audit.mjs` přijímá obě varianty (i anglickou).

3. **MOBA nabízela jen 8 hrdinů místo 12.** Čtyři startovní ID (82/84/85/86)
   nemají 3D model a filtr `PLAYABLE` je vyhodil. → nahrazeny Vyásou (17),
   Saint Germainem (26), Lumi (40) a Kanaloou (66) — všechny mají model,
   různé školy i palety. `first-world` znovu vidí 12 karet.

4. **Souboj na Merkuru se nepauzoval.** Aréna, závod, MOBA, Lumi, flotila,
   tanky i pouť čtou `isGamePaused()`, ale `MercurySolo`/`MercuryDuel` ne.
   → přidána pauza do obou smyček (v online režimu se pauzuje klient, server
   běží dál, jak říká menu).

5. **Type error v `MercuryDuel` blokoval build.** `lastRoundReason` neznal
   `'ringout'`, který posílá server po Sumo kole. → rozšířen union.

6. **Testovací prohlížeč měl dvě API podle backendu.** `evaluateOnNewDocument`
   a `emulateMediaFeatures` jsou Puppeteer API; pod Playwrightem tiše nic
   nedělaly (flotila padala na `prefers-reduced-motion`). → `_browser.mjs`
   normalizuje obě metody (`addInitScript`, `emulateMedia({reducedMotion})`).

7. **Testy driftly od nové UI.**
   - MOBA obchod se otevírá tlačítkem (panel s doporučením + všemi itemy),
     test počítal `.moba-shop-item` bez otevření → otevře panel a kontroluje
     ≥3 itemy + zamčený dražší item.
   - Mana po kouzle: hrdina stál ve fontáně (~90 many/s), takže „hodnota po
     900 ms“ byla zase plná. Test hrdinu odvede z fontány, zamíří do scény
     a hledá **dip** napříč snapshoty.
   - `meAfter` chyběl po přepsání testu (ReferenceError) → dopočítá se
     z posledního snapshotu.
   - Čekání na „B vidí vlastní id“: počká se na snapshot, kde je **vlastní
     hrdina**, ne jen „nějaký hrdina“.
   - Merkur: test tvrdil `selfHp < 100`, ale ragdoll balance má max 150;
     teď se měří pokles proti HP před úderem.

## Naměřené hodnoty

- `draw-calls.mjs` (swiftshader, 390×844): `/` 133, `/park` 46, `/mars` 30,
  `/venus` 5, `/mercury` 7, `/saturn` 20, `/hiran` 31, `/lumi` 38,
  `/fleet` 0 (bez plátna do startu), `/avatars` 1.
- `responsive.mjs`: jediný nález je známý tablet 768×1024 na `/park`
  (2 prvky z 3D `<Html>` popisků pár px mimo viewport; obsah není ztracený,
  panel je vypisuje). Telefon, šířka i desktop jsou bez přesahu.
- `mobile-audit`: telefon PASSED, šířka PASSED, tablet PASSED.
- `surfaces-audit`: PASSED.

## Zbývající známé flaky

- `e2e/moba-online.mjs` občas spadne na „B: zápas běží“ / „B vidí vlastní id“.
  V net logu je vidět reconnect s **novým** `conn.id` a `resume expired` po
  45s grace; vypadá to na resume/session issue v realtime službě (proto 36,
  práce paralelní session). Při druhém běhu test prošel. Není to regrese
  z tohoto tuningu a neopravoval jsem cizí net logiku.

## Deploy — proč pozastaven

HEAD je dnes **proto 36**, live net je **34**. Aplikace i net se musí
deployovat spolu; net 36 nese změny paralelní session a výše uvedený resume
problém. Do produkce bych to pustil až po jejich stabilizaci (nebo po
samostatném testu resume/reconnectu), ne uprostřed jejich práce.

## Soubory

- `src/app/globals.css` — mobilní inset herních panelů.
- `src/app/earth/page.tsx` — dvanáct startovních hrdinů s modely.
- `src/core/fight/MercurySolo.tsx`, `MercuryDuel.tsx` — pauza + typ ringout.
- `e2e/_browser.mjs` — shim mediálních/init API.
- `e2e/mobile-audit.mjs` — start Merkuru.
- `e2e/moba-online.mjs`, `e2e/mercury-duel.mjs` — robustnější testy.
- `apps/nirvana/AGENTS.md` — poznatky.
