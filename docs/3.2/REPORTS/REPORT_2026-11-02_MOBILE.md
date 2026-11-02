# REPORT — Mobilní ovládání a responsivita všech her (2026-11-02)

## Zadání

👤: „spíš teď doladíme responsivitu a ovládání na mobilech pro všechny hry komplexně".

Tedy ne jedna hra, ale **všechny herní povrchy**: `/park`, `/mars`, `/venus`,
`/mercury`, `/avatars`.

## Výchozí stav (audit, ne dojem)

Nejdřív audit na 390×844 s `isMobile` + `hasTouch`:

| Povrch | Ovládání na dotyku | Verdikt |
|---|---|---|
| `/mars` | **žádné** | FPS s `requestPointerLock` — na mobilu se nedá rozhlédnout |
| `/venus` | **žádné** | čte jen `keydown` (WASD) |
| `/mercury` | 6 tlačítek | jediná hra, která dotyk měla |
| `/park` | **žádné** | `pointerRef` se nikde nenastavoval → arkády nereagovaly ani myší |
| `/avatars` | — | jen seznam, ovládání nepotřebuje |

K tomu tři layoutové chyby, které audit odhalil až na screenshotech:

1. **`.game-hud` se na mobilu ořezával** (`overflow-x: auto`), takže žetony
   a ZION zůstaly za okrajem — nevidět vůbec nic z nich.
2. **Herní HUD seděl DOLE** (`bottom: 1,1rem`) — přesně v místě, kam patří
   joystick a PALBA. Hráč si zakryl zdraví i munici.
3. **3D popisky scény** (`drei <Html>`) lezly nad hlavičku — „RUSKÉ KOLO"
   se překrývalo s titulem „JUPITER STATION".

---

## 1. Dvě strategie ovládání, ne jedna

Hry čtou vstup dvěma různými způsoby a nutit je do jednoho mechanismu by
znamenalo přepsat fyziku. Proto dva moduly:

### `core/games/TouchPad.tsx` — syntetická klávesa

`TouchButton` pošle `keydown`/`keyup` na `window`, takže hra, která čte
klávesnici (Venuše, pouť), nemusí mít **druhý vstup**. `stopPropagation`
je povinné — bez něj stisk v inputu rozjede hru (přesně tahle chyba se
stala u chatu na Venuši).

Použito: **Venuše** (PLYN/BRZDA/←/→), **pouť** (D-pad ←→↑↓ + AKCE).

### `core/arena/ArenaTouch.tsx` — spojitý vstup

Pro FPS to nestačí: pohled potřebuje **spojitý pohyb**, ne stisk klávesy.
A `requestPointerLock` na mobilu neexistuje, takže bez vlastní vrstvy by
se hráč v aréně vůbec nerozhlédl.

- **levý spodní roh** = joystick (pohyb, výchylka → `moveX`/`moveY`),
- **pravá polovina** = tažení = rozhlížení (`lookX`/`lookY`),
- **pravý spodní roh** = PALBA / SKOK / ZB.

Stav jde **refem**, ne React state — jinak by se 60× za sekundu překresloval
celý 3D strom (stejná lekce jako u síťových snapshotů). `readTouch()` stav
přečte a **aplikuje ho do stejných refů**, které používá klávesnice, takže
`MarsArena`/`MarsMultiplayer` nemají dvě větve vstupu.

---

## 2. Reálná chyba v pouti: žádný pointer vstup

`apps/nirvana/src/app/park/page.tsx` měl `pointerRef`, který se čte
(`handleRef.current.pointer(pointerRef.current)`), ale **nikde se
nenastavoval**. Arkády (Pong, Breakout, Asteroidy) tedy nereagovaly na
myš ani na dotyk — jen na klávesy. Nebyla to mobilní regrese, byla to
chyba, kterou mobil jen odhalil.

Oprava: `onCanvasPointer` na plátně (`pointermove` + `pointerdown`) →
`pointerRef.current` v rozsahu 0..1 (hry to tak čekají: pong
`pointer * GAME_W`, asteroidy `(pointerX - 0.5) * 3`).

---

## 3. Během hry patří obrazovka hře

Na dotykovém zařízení se při hraní schová navigační lišta i chat
(`body[data-playing='1']`). Nastavuje se ve všech čtyřech hrách a uklízí
v `useEffect` cleanupu, takže po odchodu ze hry nezůstane viset.

Bez toho zbývalo na hru ~640 px z 844 a joystick ležel na liště.

---

## 4. Layout na mobilu

| Co | Dřív | Teď |
|---|---|---|
| `.game-hud` | `overflow-x: auto` → žetony za okrajem | `flex-wrap`, dvouřádková lišta |
| `.arena-hud` / `.race-hud` | `bottom: 1,1rem` (v ovládání) | nahoře, `flex-wrap` |
| `.arena-tip` | pod HUDem dole | pod HUDem nahoře |
| `.arena-board` / `.race-board` | `top: 1rem` (tlouklo se s HUDem) | `top: 4,6rem` |
| `.park-panel` | `bottom: 0,6rem` (pod lištou) | `bottom: 8,4rem` |
| `.park-chrome` | `z-index: 12` | `20` (nad 3D popisky) |
| 3D popisky pouti | přetahovaly hlavičku | `zIndexRange={[11, 0]}`, na ≤760 px `display: none` |
| `.avatars` | lišta zakrývala konec seznamu | `padding-bottom: 8,8rem` |
| `.arena-vr` | VR tlačítko na telefonu | skryté |

Na šířku (`max-height: 480px`) se joystick i tlačítka zmenší — jinak
v 390 px výšky sežerou celou scénu.

---

## 5. Audit jako test, ne jako screenshot

`apps/nirvana/e2e/mobile-audit.mjs` (nový) **reálně vstoupí do hry**
(klikne na start) a pak počítá ovládací prvky:

```
OK   Mars aréna   overflow=0px ovládání=4 chyby=0
OK   Venuše       overflow=0px ovládání=4 chyby=0
OK   Merkur       overflow=0px ovládání=6 chyby=0
OK   Pouť         overflow=0px ovládání=5 chyby=0
OK   Avatar       overflow=0px ovládání=0 chyby=0
```

Kontroluje: horizontální přesah, existenci a počet prvků
(`.arena-touch`/`.touch-pad`/`.duel-touch`/`.park-touch`), že navigační
lišta je **během hry skrytá**, a JS chyby.

**Pozor na falešnou zelenou:** první verze auditu „prošla", protože
počítala tlačítka ve spodní půlce obrazovky — a ta jediná byla tlačítko
chatu. Audit, který nepočítá konkrétní selektor, nic nedokazuje.

---

## 6. Ověření

**Lokálně:** `tsc --noEmit` čistý, `next build --webpack` OK, audit 5/5.

**Produkce:** app deploy `20261102T002534Z` (commit `ee1f097c6`),
net deploy `20261102T023824Z`, živě:

```
/ /park /mars /venus /mercury /avatars /earth -> 200
/net/health -> {"proto":5,"connections":0,"rooms":0}
WS hello proto 5 -> welcome, join arena -> snapshot (4 hráči: 1 člověk + 3 boti)
```

Audit proti `https://nirvana.zionterranova.com`: **5/5 OK**, 0 chyb.
Screenshoty: `.artifacts/render/mobile-20261102/`.

---

## 6b. Incident při nasazení: proto 5 vs proto 4

**Co se stalo:** paralelní session (MOBA „První svět" online) dělala
`git add` přes celý strom a **strhla moje staged soubory do svého commitu**
— a naopak její proto-5 změny (`core/net/protocol.ts`, `useNet.tsx`,
`MobaOnline.tsx`) skončily **v mém** commitu `ee1f097c6`. Net jsem
nenasazoval, protože moje dávka protokol nemění — jenže appka z toho
commitu už `PROTO_VERSION = 5` posílá, zatímco produkční net byl proto 4.

**Důsledek (reálně naměřeno):**

```
WS hello proto 5 -> {"t":"error","code":"proto_mismatch","message":"server mluví proto 4"}
```

Chat i multiplayer byly pro uživatele mimo provoz ~35 minut.

**Oprava:** nasadit net (`deploy-nirvana-net.sh`) → proto 5. Po nasazení
handshake i aréna fungují (viz §6). Appka se nevracela, protože by to
vzalo i mobilní práci.

**Pravidlo:** po každém commitu, do kterého mohla paralelní session
přispět, **zkontroluj `PROTO_VERSION` proti živému `/net/health`**:

```bash
grep PROTO_VERSION apps/nirvana/src/core/net/protocol.ts   # klient
curl -s https://nirvana.zionterranova.com/net/health        # server
```

Nerovnají-li se, je produkce rozbitá, i když je „jen" jeden z povrchů
nasazený.

---

## 6c. Flaky test MOBA, který to zamaskoval

`apps/nirvana-net/test/moba.mjs` padal ~1 ze 3 běhů na
„projektil je ve snapshotu". Nebyla to chyba serveru: projektil na
blízkého miniona doletí dřív, než test po 500 ms vzorkuje, takže
`projectiles.length > 0` záviselo na štěstí.

Oprava testu: `castFrom = a.inbox.length` před sesláním a pak se ptáme,
jestli projektil byl v **kterémkoli** snapshotu po seslání — ne v jednom
náhodném vzorku. Po opravě 2/2 běhy `VŠE OK`.

---

## 7. Pasti, které to stálo čas

### `standalone/node_modules` může být symlink

Deploy z **git worktree** (kvůli cizí WIP v pracovním stromu) selhal:
`Error: Cannot find module 'next'` → rollback. Důvod: ve worktree bylo
`node_modules` symlinkem na hlavní strom, a Next si toho symlinku **všiml
i ve standalone stromu** — `.next/standalone/node_modules` byl symlink,
takže se `next` do artefaktu vůbec nezkopíroval a na serveru chyběl.

Navíc `cp -a src/next "$FLAT/node_modules/next"` psalo **přes** symlink
do hlavního stromu (do `apps/nirvana/node_modules/`). Uklizeno.

**Řešení:** worktree s `cp -al` (hardlink klon) `node_modules`, ne symlink.
Pak je standalone strom reálný (81 MB místo 26 MB) a `next` v něm je.

### `-a` v rsyncu symlinky zachová

`rsync -a` symlink nefollowuje. Artefakt, který obsahuje symlink do
`/Users/...`, se na serveru rozbije. Před deployem je nutné ověřit
`ls -ld artifact/node_modules` = `drwx`, ne `lrwx`.

---

## 8. Meze (co hotové není)

- **Netestováno na skutečném telefonu.** Vše je headless Chromium
  s emulací `isMobile`/`hasTouch` (390×844, DPR 3). Skutečný prst,
  palm rejection a iOS safe-area jsou neověřené.
- **Landscape jen media query.** `max-height: 480px` je odladěné podle
  CSS, ne na otočeném telefonu.
- **Citlivost pohledu je konstanta** (`LOOK_SENSITIVITY = 0.0034`),
  není v nastavení. Na tabletu bude pravděpodobně pomalá.
- **Bez gyroskopu, bez haptiky, bez gamepadu.**
- **VR netestováno na headsetu** (platilo už dřív) a na mobilu je VR
  tlačítko schované — headset se tímhle netýká.
- **`/earth` (MOBA) je doděláno ve druhé vlně** (viz §10) — má joystick,
  kouzla a ÚTOK, ověřeno i funkčně (kouzlo sníží manu).
- **Merkur měl dotyk už dřív** (`duel-touch`); přibylo mu jen skrytí
  navigace během duelu.
- **Multiplayer s dotykem** je zapojený (stejné refy), ale boti v MP se
  na dotyku netestovali — testy běží na klávesnici.

---

## 9. Soubory

| Soubor | Změna |
|---|---|
| `src/core/arena/ArenaTouch.tsx` | **nový** — joystick, look, PALBA/SKOK/ZB, `readTouch` |
| `src/core/games/TouchPad.tsx` | **nový** — `TouchButton` (syntetická klávesa), `TouchPad` |
| `src/core/arena/MarsArena.tsx` | `touch` prop + merge do vstupu |
| `src/core/arena/MarsMultiplayer.tsx` | totéž |
| `src/app/mars/page.tsx` | `coarse`, `ArenaTouchControls`, `data-playing` |
| `src/app/venus/page.tsx` | `TouchPad` (PLYN/BRZDA/←/→), `data-playing` |
| `src/app/mercury/page.tsx` | `data-playing` |
| `src/app/park/page.tsx` | **oprava pointer vstupu**, D-pad + AKCE, `data-playing` |
| `src/core/scene/park/ParkScene.tsx` | `zIndexRange` na 4 `<Html>` |
| `src/app/globals.css` | ~200 řádků mobilních pravidel |
| `e2e/mobile-audit.mjs` | **nový** — audit, který do hry opravdu vstoupí |


---

## 10. Druhá vlna — MOBA `/earth` a pojistky

### 10.1 Blokující chyba: `W` bylo pohyb i kouzlo

```js
keys.current.add(event.code);                        // WASD = pohyb
if (event.code === 'KeyW') queuedCast.current = { slot: 'W' };  // i kouzlo W
```

Chůze vpřed tedy **neustále frontovala kouzlo W** — na desktopu samočinné
sesílání, na mobilu neřešitelné (tlačítko W by hrdinu zároveň poslalo
dopředu). Kouzla teď mají vlastní mapu `core/moba/keys.ts`:

| slot | klávesa | proč |
|---|---|---|
| Q | `Q` | volná |
| W | **`F`** | `W` patří pohybu vpřed |
| E | `E` | volná |
| R | `R` | volná |

Sloty zůstávají `Q/W/E/R` — je to identita kouzla v sim, snapshotu
i protokolu; měnit ji by znamenalo sáhnout na síť. UI ale zobrazuje
`SPELL_LABEL` (tedy „F"), ne slot.

### 10.2 Dotyk: posílat hře tytéž události, ne přepisovat smyčku

`core/moba/MobaTouch.tsx` needituje vstup hry — posílá jí **to, co by
poslala klávesnice a myš**:

- joystick → syntetické `keydown`/`keyup` na `KeyW/A/S/D` (rozdílově,
  aby se neposílalo 60×/s totéž),
- kouzlo → `keydown` na klávesu ze `SPELL_KEY`,
- ÚTOK → syntetický `pointerdown` na plátno, **držený 140 ms** (hra čte
  `attack` jednou za snímek; krátký ťuk by propadl).

Dvě věci, bez kterých to nefunguje:

1. **Zamíření se jen odposlouchává, nesbírá.** Vrstva s `pointer-events:
   auto` nad plátnem by sežrala ťuk a hra by vůbec nezaútočila. Řešení:
   `pointerdown` listener na `window` (capture) si jen pamatuje souřadnice.
2. **Klepnutí bez pohybu nenastaví `pointer`.** Hra aktualizovala pozici
   jen na `pointermove`, takže ťuk (a klik bez pohybu myši) seslal kouzlo
   na poslední staré místo. `downPointer` teď volá i `move(event)`.

### 10.3 HUD na mobilu: každá věc vlastní řádek

Původně se na 390 px tlouklo všechno navzájem: Menu leželo na časovači,
uzly L5 na maně, obchod přetékal přes hrdinu. Teď:

```
Menu | ZION · čas · OPOZICE      ← 1. řádek
Kailash · Uluru · Ekam          ← 2. řádek (uzly)
HP · mana · zlato · obchod      ← 3. řádek (obchod scrolluje)
minimapa                        ← pod HUDem vpravo
...hra...
joystick            Q F E R ÚTOK ← dole
```

Seznam kouzel v HUD se na dotyku schovává — nahrazují ho tlačítka.
Nápověda přestala tvrdit „WASD a levé tlačítko", na dotyku říká
„joystick · Q/F/E/R · ÚTOK".

### 10.4 Jak je to ověřené (ne jen spočítané prvky)

Audit u `/earth` nově dělá **funkční** kontrolu:

1. dotkne se joysticku → musí odejít `keydown` s `KeyW`,
2. klepne doprostřed scény, pak na kouzlo Q → **musí spadnout mana**:
   `kouzlo: mana 482 → 455 (dotyk prošel do simulace)`.

To je důkaz, že cesta dotyk → syntetická událost → `queuedCast` → simulace
opravdu vede, ne že tam jen existuje tlačítko.

### 10.5 Pojistka proti rozpadu protokolu

`scripts/ops/nirvana-proto-check.sh` + pre-flight v `deploy-nirvana.sh`.
Rozlišuje dvě situace, protože každá chce jiný zásah:

| stav | co to znamená | co skript udělá |
|---|---|---|
| klient == server | v pořádku | pustí deploy |
| klient > server | appka by mluvila nověji než net | **BLOKUJE** deploy, řekne „nasaď net" |
| klient < server | net je napřed | varuje, řekne „nasaď appku" |

Obejít se dá jen vědomě: `ZION_SKIP_PROTO_CHECK=1`.

### 10.6 Citlivost pohledu a šířka

- Citlivost je násobek 0,4–2,5× (`core/arena/settings.ts`, localStorage),
  ovladač v panelu arény, audit kontroluje, že se hodnota opravdu uloží.
- Audit umí `MOBILE_LANDSCAPE=1` (844×390). Na šířku i na výšku prochází
  všech 6 povrchů bez přesahu.

### 10.7 Incident: zmizel `node_modules` i Chromium

Během práce někdo uklidil disk — `node_modules`, `.next` a puppeteer cache
byly pryč. Build i audit tím umřely. Co z toho plyne:

- `npm ci` padal na `ENOENT ... zion-wallet-sdk-2.0.0.tgz`: lockfile držel
  záznam na tgz, kterou K1.2 smazal (zdroj je workspace link). Záznam
  odstraněn → `npm ci` projde (2067 balíčků).
- Audit teď zkouší `CHROME_PATH` → puppeteer cache → systémový Chrome.
- **Deploy ordering se tím nezměnil, ale ověření ano:** po každém úklidu
  je potřeba `npm ci` (s `--ignore-scripts`, jinak padá
  `db:generate -w zion-marketplace`, protože Prisma ještě není).

---

## 11. Meze druhé vlny

- **Skutečný telefon pořád chybí** — vše je headless Chrome s emulací.
- **Kouzlo se sesílá na poslední klepnutí**, ne na „táhni a pusť" jako
  v jiných MOBA. Je to použitelné, ale ne plynulé.
- **Obchod na mobilu scrolluje vodorovně** — ověřeno jen vizuálně, nákup
  dotykem jsem netestoval (gold 320 < cena 400, takže by ani neprošel).
- **Online 3v3 na dotyku** — ověřeno jen sólo; síťová cesta používá
  stejný `MobaOnline`, ale dotyk v něm testovaný není.
- **Landscape HUD MOBA** je zmenšený media query, ne odladěný na otočeném
  telefonu.
