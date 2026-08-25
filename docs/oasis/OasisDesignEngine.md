# OASIS Design Engine — Redesign vstupu do hry

## Datum: 2026-08-03
## Status: Active — redesign vstupu do OASIS hry

## Kontext

OASIS Web (https://oasis.zionterranova.com) je **preview** plné hry v Unreal Engine 5.
Pro mobil ještě hledáme engine (možná Unity / Godot / Babylon.js).
Tento web je tedy **vizuální preview + light game layer** nad ZION blockchainem.

## Problémy (od uživatele)

1. **Warp intro je matoucí** — hvězdy létají, "Enter the OASIS" tlačítko, ale nejasné co se děje
2. **Galaxy view bez kontextu** — vidím galaxii a strom, ale nevím co jsou světy, co mám dělat
3. **PilgrimRite zdlouhavý** — avatar config (archetype, body type) je moc komplexní před hrou
4. **GamePanel nepřehledný** — HUD panel, nevím co znamenají staty, co dělají tlačítka

## Rozhodnutí (od uživatele)

- **Zachovat 3D galaxii** jako hlavní vstup
- **Warp intro nechat**, jen upravit okno s textem (jemnější)
- **Klíčová myšlenka:** přidat výraznou planetu **NOVA ZEME** s **Issobelou** na oběžné dráze
- **Na zemi NOVA ZEME:** naše 3 projekty — L4 OASIS, L5 Free World, L6 Issobella
- **Jednodušší PilgrimRite** — nezdržovat před hrou
- **Přehlednější GamePanel** — jasné staty, jasné akce

## Architektura ZION ekosystému (z web2.9)

```
L1 — Blockchain (ZION native, Rust, Cosmic Harmony PoW)
L2 — DeFi (WARP bridge, DAO, ZionDex, swap, atomic-swap)
L3 — Hiran (AI vrstva, consciousness mining)
L4 — OASIS (Game layer — UE5 metaverse, avatars, quests, XP → ZION)
L5 — Free World (Fyzická vrstva — komunity, permaculture, guardian nodes)
L6 — Issobella (Vesmírná vrstva — orbitální stanice, SETI, orbital mining)
```

## NOVA ZEME — centrální planeta

**NOVA ZEME** je výrazná planeta v galaxii, která reprezentuje L5 Free World.
Kolem ní obíhá **Issobela** (L6 — orbitální stanice, menší objekt/satelit).
Na povrchu NOVA ZEME jsou 3 projekty:

1. **L4 OASIS** — Game layer ( Strom života, avatari, questy)
2. **L5 Free World** — Komunity (permaculture, guardian nodes, sociocratic DAO)
3. **L6 Issobella** — Vesmír (orbitální stanice, SETI, Overview Effect)

### Vizuální koncept NOVA ZEME v 3D galaxii

```
        ☄️ Issobela (L6 — satelit na oběžné dráze, zářící)
       /
      /  oběžná dráha
     /
    🌍 NOVA ZEME (L5 — velká planeta, zelená/modrá, živá)
       ├── 🌳 Strom života (L4 OASIS — na povrchu)
       ├── 🌱 Permaculture (L5 — zelené plochy)
       └── 🛰️ Orbitální stanice (L6 — Issobela nad ní)
```

NOVA ZEME by měla být:
- Výrazně větší než ostatní světy v galaxii
- Zeleno-modrá (země s vegetací a vodou)
- S atmosférou (glow/halo efekt)
- Strom života viditelný na povrchu
- Issobela jako zářící satelit na oběžné dráze
- Kliknutelná — otevře panel s 3 projekty

## Redesign — krok po kroku

### 1. WarpIntro (jemnější)
- **Nechat** warp efekt (hvězdy létají)
- **Upravit textové okno:** jemnější, méně agresivní
- **Přidat kontext:** "OASIS Preview — explore 55 worlds, find Golden Egg, build community"
- **Tlačítko:** "Enter the OASIS" (zůstává)

### 2. Galaxy View (kontext)
- **Onboarding hint:** "Tap a world to explore. Pinch to zoom. Drag to rotate."
- **NOVA ZEME** jako výrazný objekt ve středu poblíž stromu života
- **Issobela** obíhající kolem NOVA ZEME
- **World tooltips:** při tap na svět → krátký popisek (name, layer, vibe)
- **Filter panel** (desktop): kategorie světů (star-system, planet, dimension...)

### 3. PilgrimRite (zjednodušit)
- **Skip na mobilu** (už funguje)
- **Na desktopu:** zjednodušit na 1 krok — vyber si archetyp (Warrior/Trader/Explorer/Sage)
- **Žádný body type, augmentation** — to přijde později v plné hře
- **Rychlý:** 1 obrazovka, 4 tlačítka, "Enter OASIS"

### 4. GamePanel (přehlednější)
- **Minimalizovaný:** jen ikona 🚀 Lv1 (už funguje)
- **Expand:** jasné sekce:
  - **Stats:** XP, Level, Credits, Worlds discovered
  - **Actions:** Enter Flight, Scan World, Warp to World
  - **Ship:** loadout (boost, cargo, scanner, color)
  - **Audio:** mute/unmute
- **Jasné ikony a labely** — ne jen zkratky

### 5. NOVA ZEME komponenta
- **NovaZeme.tsx** — 3D planeta s:
  - Velká sphere geometry (poloměr ~3-4 jednotky)
  - Zeleno-modrá textura (procedural nebo shader)
  - Atmosféra glow (sprite nebo shader)
  - Strom života na povrchu (mini verze)
  - Issobela satelit na oběžné dráze
- **Kliknutí** → WorldPanel s 3 projekty (L4, L5, L6)
- **Poloha** v galaxii: blízko stromu života, výrazná

### 6. WorldPanel redesign
- **Při tap na svět:** panel vpravo s:
  - Jméno, kategorie, layer
  - Vibe (krátký tagline)
  - Summary (1 odstavec)
  - Tags
  - "Enter World" tlačítko
  - "Scan" tlačítko (+XP)
- **Pro NOVA ZEME:** speciální panel s 3 kartami projektů

## Priorita implementace

1. **NOVA ZEME + Issobela** v 3D galaxii (nová komponenta)
2. **WarpIntro** text upravit (jemnější)
3. **PilgrimRite** zjednodušit (1 krok)
4. **GamePanel** přehlednější labely
5. **Onboarding hint** pro galaxy view
6. **WorldPanel** s NOVA ZEME 3 projekty

## Technické poznámky

- 3D galaxie: R3F (React Three Fiber) + drei
- Mobil: bez drei OrbitControls (crashne), vlastní MobileTouchControls
- ErrorBoundary kolem všech komponent
- Static export (Next.js) — žádné API routes na klientu
- API volání jdou na Edge server (zionterranova.com)
- Světy: 55 světů v `src/domain/config/worlds.ts`
- Světy mají: id, name, category, layer, location, vibe, summary, tags, galaxyPosition

## Soubory k upravit

- `src/components/OasisScene.tsx` — přidat NOVA ZEME do galaxie
- `src/components/NovaZeme.tsx` — NOVÝ — 3D planeta + Issobela
- `src/components/WarpIntro.tsx` — upravit text
- `src/components/PilgrimRite.tsx` — zjednodušit na 1 krok
- `src/components/GamePanel.tsx` — přehlednější labely
- `src/components/WorldPanel.tsx` — speciální panel pro NOVA ZEME
- `src/components/OasisClient.tsx` — onboarding hint
- `src/domain/config/worlds.ts` — přidat NOVA_ZEME svět (pokud není)
