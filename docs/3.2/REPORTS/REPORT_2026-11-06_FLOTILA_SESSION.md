# Flotila z marketu — souhrn session (2026-11-05 → 06)

**Rozsah:** `apps/MarketPlace` → `apps/nirvana` → `apps/nirvana-net`, plus konvertor a render pipeline.
**Detailní technický report:** [`REPORT_2026-11-05_FLEET_MARKETPLACE_SHIPS.md`](REPORT_2026-11-05_FLEET_MARKETPLACE_SHIPS.md)
**Stav:** nasazeno (net + app + marketplace), všechny testy zelené.

---

## 1. Co je hotové

### Lodě z marketu jako herní modely
7 produktů (`star-001…007`) bylo **laser-cut skládaček z překližky** — 1 175–4 429 samostatných
destiček, otevřené plochy, žádné UV/materiál/části, rozházené měřítko (x-wing v mm, zbytek v cm)
a nesjednocené osy. Konvertor `scripts/ops/starfighter-glb.py`:

* slití destiček → **1 draw call** na loď,
* ruční tabulka orientace (nos = +Z) ověřená renderem — heuristika na skládačce nefunguje,
* normalizace na délku 1,0,
* **panelový lak do vrcholových barev** (skládačka je *už* rozdělená na destičky, takže plátování
  vznikne zdarma a bez jediné textury),
* srovnání normál od středu trupu (polovina destiček je má dovnitř → černé fleky),
* vlastní GLB writer (trimesh zapisuje jen `POSITION`),
* **LOD** (mřížková kvantizace) pro cizí lodě.

Výsledek: 7 GLB, 0,44–1,04 MB, 113 263 tris celkem, 0 textur navíc.

### Hra `/fleet`
Volný let mezi **Nabukanem** (3 kotviště, pohyblivý rám) a **Issobellou** (stanice na rotujícím
prstenci). Doky jsou **funkce času** — kdyby si je simulace a scéna počítaly každá po svém, hráč
přistane do prázdna. Dokovací paprsek v okruhu 1,5 j. (bez něj se na dok nedalo doletět, protože
volnoběh táhne dopředu). Dokování drží 1,5 s, brzda je 2,2× silnější než plyn.

### Multiplayer (protokol 32)
Relay, ne autoritativní simulace: volný let nemá co podvádět. Server ověřuje rozsahy a `dockId`
proti seznamu doků, drží **jedno kotviště = jedna loď** (`occupied`/`conflict`), duchy odpojených
(3 s) a kapacitu 6 pilotů. Divák (`?watch=fleet-N`) nedostane sedlo, ale **dostane snapshoty**.

### Přístupnost a zvuk
`prefers-reduced-motion` se respektuje ve flotile i v náhledu marketu (dřív nikde).
Motor používá **existující** `startEngineLoop` (stejný jako Venuše), řízený plynem; boost má
`gust`. Vlastní `startThrusterLoop` jsem napsal a zase smazal — duplikát.

### Marketplace
Produktová karta ukazuje **stejný herní GLB** místo holého STL (ověřeno živě 9/9: katalog → klik →
stažení `/shop/models3d/xwing.glb` → náhled). Živý katalog ale čte **DB** (`ShopProduct.modelUrl`),
ne statický seed — proto se dělal cílený UPDATE se zálohou, ne plný re-seed. Popisy, které lhaly
o „STL náhledu" (a Falcon o náhledu, který neexistuje), opraveny.

### Vstup do hry
`FleetPortal` i `IssobellaPortal` mají hlavní CTA na `/fleet` — dřív se o hratelné flotile
nedalo z portálů dozvědět.

---

## 2. Naměřená čísla

| metrika | hodnota |
|---|---|
| sólo (1 loď) | 93 draw calls · 42 376 tris · 60 fps |
| plná místnost před LOD | 122 calls · 109 755 tris · 60 fps |
| plná místnost s LOD | **116 calls · 62 848 tris · 60 fps** |
| marketplace náhled | 1 GLB, 0 textur navíc |

| test | výsledek |
|---|---|
| `test/fleet-flight.mjs` (simulace) | 35/35 |
| `e2e/fleet.mjs` (sólo + výkon) | 19/19 |
| `e2e/fleet-mobile.mjs` (dotyk, 390×844 i 844×390) | 16/16 |
| `e2e/fleet-online.mjs` (appka ↔ net, hlediště, konflikt doku, reduced motion) | 19/19 |
| `e2e/fleet-load.mjs` (6 pilotů) | 5/5 |
| `nirvana-net/test/fleet.mjs` (server) | 29/29 |
| `MarketPlace/e2e/shop-3d.mjs` (proti produkci) | 9/9 |

---

## 3. Nasazení

| služba | release | poznámka |
|---|---|---|
| `zion-nirvana-net` | `20261106T115047Z` | proto 32, dock claims, divák |
| `zion-nirvana` | z HEAD `d8b7dd3bd` | hlediště, a11y, zvuk, LOD, portály |
| `zion-marketplace` | `20261106T14…` | 3D náhled z GLB + badge/DB |

Rollback stromy zůstávají v `/opt/zion/APP&WEB/<app>.before-<timestamp>`, DB zálohy
`/opt/zion/data/marketplace-{modelurl,desc}-backup-*.txt`.

---

## 4. Poučení (opakující se třídy chyb)

1. **Export, který „projde", ještě nezapsal data.** `trimesh` zapsal jen `POSITION`; pozná se to
   z JSON chunku GLB, ne z kódu. Model byl černý bez odlesků.
2. **Barevné prostory.** Paleta psaná jako sRGB v `COLOR_0` (lineární) dělá lak o dva stupně světlejší.
3. **Otevřené plochy.** Skládačka nemá objem — `watertight` kontroly padají a polovina normál
   míří dovnitř. `DoubleSide` + `orient_outward` je nutnost, ne kosmetika.
4. **Kov bez `scene.environment` je černý.** Světla to nespasí (marketplace i hra).
5. **HEAD byl dvakrát nebuildovatelný** (import bez souboru: `./copy`, `@/core/lumi/coop`).
   Build z pracovního stromu to maskuje — **důkaz je build z worktree**.
6. **Dva `next-server` umí sdílet port** (SO_REUSEPORT). Starší instance servíruje starý build
   a vrací „nemožné" 404 na soubory, které na disku jsou.
7. **Testovací stub s pevným portem se může připojit k cizí službě** (oracle 9099 → `valid:false`
   → test měřil ZAP bránu). Volný port to řeší.
8. **Test nesmí být „počet tlačítek".** U dotyku se měří důsledek (rychlost po stisku PLYN),
   u modelu stažení souboru (resource timing), u hlediště že divák nezabral sedlo.
9. **Prázdné pole je v JS truthy** — `waitFor` na seznam musí vracet `null`, dokud není neprázdný.
10. **Živý katalog ≠ seed.** DB je zdroj pravdy; změna v repu se neprojeví, dokud se nepropíše.

---

## 4b. Millennium Falcon — model z online zdroje

Produkt `star-008` neměl lokální geometrii (odkaz na Thingiverse). Thingiverse je dnes za
Cloudflare (403 i pro headless prohlížeč) a jeho API chce token, **ale Internet Archive má
archivované položky `thingiverse-<id>`** — odtud se dá stáhnout původní ZIP bez překážek.

Kandidáti (všechny CC):

| thing | obsah | tris | výsledek |
|---|---|---|---|
| 2179843 „minimalist" | 1 STL | 20 422 | **vyřazen** — po konverzi to vypadá jako dort, ne Falcon |
| 6771 „kit" | 4 STL (top/middle/bottom) | 12 359 | **vyřazen** — pláště bez objemu, slepenec nedrží tvar |
| **967387** | 1 STL `Falcon.stl` | **37 545** | **použit** — saucer, mandibuly, kokpit i radar sedí |

Dvě věci, které rozhodly až pohled na render:
1. **Osa.** U modelu 967387 je délka podél **Y** (bbox 52,8 × 69,1 × 14,8), ne podél X jako
   u stíhaček. Se `nose='x'` se saucer postavil na hranu a sheet vypadal jako dort.
2. **Kvalita.** „Minimalist" má sice správný počet trojúhelníků, ale po přemalování
   panelovým lakem nevypadá jako Falcon — použit byl detailnější model (37 545 tris).

Integrace: osmá loď v `ships.ts` (nákladní: max 9, obratnost 0,75, scale 0,62 — větší než
stíhačky), LOD 13 000 tris, náhled v marketu `/shop/models3d/falcon.glb` (produkt `star-008`
už neodkazuje na Thingiverse), atribuce v `apps/MarketPlace/public/shop/models3d/ATTRIBUTION.md`.
**Autor a licence (doplněno 👤):** model je od **Grahama Smitha, 2014** ([eigenbloom.com](https://eigenbloom.com)),
licence **CC BY-SA 3.0** — atribuce je povinná (jméno + rok + zdroj + stejná licence pro
odvozeniny, což zahrnuje náš přebarvený GLB i LOD). Zapsáno do
`apps/MarketPlace/public/shop/models3d/ATTRIBUTION.md` i `apps/nirvana/public/models/fleet/ATTRIBUTION.md`.

**Vedlejší nález:** stejný autor dělá i **dřevěné stíhačky** (`eigenbloom.com/woodenstarfighter`,
„Graham Smith 2014-15"), takže atribuce platí pro všech osm modelů — a licence kitů
v repu (`handpanda/wooden-starfighter`) **žádná není**, to zůstává blocker.

**Opraveno (2026-11-06, nasazeno):** obchod prodává **vypálené díly**, ne soubory. Proto
`filesUrl` (digitální dodávka) u všech sedmi stíhaček **NULL** a `instructionsUrl` vede na
autorovy plány (`eigenbloom.com/woodenstarfighter/`); popisy přepsané na „Sada vypálených
dílů … z 3mm překližky". E-mail navíc **fyzické zboží vyřazuje z „Digitálních stažení"**
(`digital: false` = rozhodnutí, text i HTML varianta) — dřív se kit objevil v digitální sekci
jen proto, že měl 3D náhled. Plaketa „Připraveno pro laser" už nevisí na `filesUrl`, ale na
kategorii. Ověřeno živě: API vrací `files: NULL` u `star-001…008`, modal ukazuje
`3D náhled (GLB)` + `Připraveno pro laser` + `PDF průvodce`, `shop-3d.mjs` proti produkci **10/10**.

**Návody „od nás" (2026-11-06):** 7 PDF stažených z autorova webu
(`eigenbloom.com/woodenstarfighter/instr/<loď>_instructions.pdf`) je uložených
v `apps/MarketPlace/public/shop/instr/` (7,2 MB) a `instructionsUrl` u `star-001…007`
míří **na nás** (`/shop/instr/*.pdf`). Plaketa „PDF průvodce" v modalu je od 2026-11-06
**skutečný odkaz** (`target=_blank`) — dřív to byl jen nápis, takže se k PDF nedalo dostat.
Ověřeno živě: PDF 200 `application/pdf`, v modalu `href="/shop/instr/xwing_instructions.pdf"`,
`shop-3d.mjs` **10/10**. **Laser files (SVG) záměrně nehostujeme** — prodáváme vypálené díly,
ne podklady k výpalu. Licenční otázku 👤 uzavřel („je to free"), autor a zdroj zůstávají uvedené.

**🔴 (původní nález) Rozbité odkazy v marketu:** produktová data u všech sedmi stíhaček odkazují na
`raw.githubusercontent.com/handpanda/wooden-starfighter/master/instr/*_instructions.pdf`
a `.../svg/*_svg.zip` — oba vrací **404** (repo obsahuje jen sedm STL, žádné `instr/` ani `svg/`).
`filesUrl` je přitom **dodávka digitálního zboží** v e-mailu po zaplacení. Neopravoval jsem to
sám, protože jde o obchodní rozhodnutí (odkázat na autorovu stránku vs. dodat vlastní kopie).

**Nasazeno (2026-11-06):** app z worktree na `dee420a75`; živě `/models/fleet/falcon.glb`
(1,38 MB) i `lod/falcon.glb` (215 kB) → 200, klient nese „Millennium Falcon".
Marketplace nasazen zvlášť (`star-008` → `/shop/models3d/falcon.glb`, DB záloha
`/opt/zion/data/marketplace-falcon-backup-*.txt`), E2E proti produkci **10/10**
(Falcon má 3D náhled a stáhl se `falcon.glb`).

---

## 4c. Herní LOD lucerny — Lumi 2 (2026-11-06)

Hra `/lumi` ještě načítala **v6** lucernu (`Lampion_Kralovstvi_srdce_v6.glb`, 4,3 MB,
242 648 tris, jeden krémový materiál) — model, který v marketu mezitím nahradil nový
**Lumi 2** s vyřezávanými vzory a třemi materiály (Překližka / Řez / Gravír).

Přegenerováno `scripts/ops/lumi-lantern-lod.py` s novým zdrojem
(`heros/shop/Lumi/Lumi_2.glb`, 22 dílů / 214 440 tris):

| | zdroj (Lumi 2) | herní LOD |
|---|---|---|
| trojúhelníky | 214 440 | **12 856** |
| velikost | 12,1 MB | **0,21 MB** |
| dílů / draw calls | 22 | 1 |
| redukce | — | **94 %** |

Clustering (mřížka) je u tenkých vyřezávaných panelů jediná rozumná cesta — quadrická
dekurace na nich končí na 65 % a vrací nekonzistentní indexy. Ověřeno **celým Lumi auditem**
(`.artifacts/probe/lumi-audit.mjs`, proti lokální instanci na `:3013`) — **LUMI AUDIT OK**,
včetně „model lucerny se načetl" a „scéna se vykreslila"; snímek letu potvrzuje, že lucerna
je v ruce a scéna jede.

---

## 5. Otevřené (mimo autonomní dosah)

* **Živý dvouklientový test místnosti** — potřebuje platný ZAP pas (cizí kódy se nepoužívají).
* **VR** — `<XR>` jde napojit, ale bez headsetu to nelze ověřit.
* **Star Wars IP + licence kitu** — dohodnutý blocker před veřejným launchem.
* **Millennium Falcon** — nemá lokální geometrii (produkt vede na Thingiverse); řeší se samostatně.
* **Mobil na skutečném zařízení** — ověřeno jen emulací `isMobile`/`hasTouch`.
