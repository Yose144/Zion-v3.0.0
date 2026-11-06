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

## 5. Otevřené (mimo autonomní dosah)

* **Živý dvouklientový test místnosti** — potřebuje platný ZAP pas (cizí kódy se nepoužívají).
* **VR** — `<XR>` jde napojit, ale bez headsetu to nelze ověřit.
* **Star Wars IP + licence kitu** — dohodnutý blocker před veřejným launchem.
* **Millennium Falcon** — nemá lokální geometrii (produkt vede na Thingiverse); řeší se samostatně.
* **Mobil na skutečném zařízení** — ověřeno jen emulací `isMobile`/`hasTouch`.
