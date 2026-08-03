# OASIS Mobile Debug Log

## Date: 2026-08-03

## Problem
OASIS preview na mobilu (https://oasis.zionterranova.com) — po intro "Enter the OASIS" černá obrazovka, jen mini tlačítka viditelná.

## Environment
- Server: 62.171.141.136:2222 (Contabo VPS)
- Site: https://oasis.zionterranova.com (static Next.js export)
- Mobile: width=375, isMobile=true (detekce funguje)
- Browser: mobilní Chrome/Safari (konkrétní verze neznámá)

## Debug Progress

### Test 1: Debug text v OasisClient
- **Přidáno:** Zelený debug text `phase=X mobile=X w=X view=X` + `bg-red-900` na container
- **Výsledek:** Text viditelný, `phase=scene mobile=true w=375 view=galaxy`
- **Závěr:** React renderuje správně, isMobile detekce funguje, phase je správná

### Test 2: Purple div + debug text v OasisScene
- **Přidáno:** `background: purple` na wrapper div + černý text "OASIS SCENE LOADED"
- **Výsledek:** Fialové pozadí + text viditelný
- **Závěr:** OasisScene komponenta renderuje, Canvas se ale nezobrazuje

### Test 3: Minimální Canvas (green bg + red cube)
- **Přidáno:** Canvas s `background: orange`, `clearColor: #00ff00`, červená kostka `[0, 0, -5]`, `meshBasicMaterial`
- **Výsledek:** Zelené pozadí + červená kostka viditelná!
- **Závěr:** WebGL funguje na mobilu! Problém je v některé komponentě scény

### Test 4: Plná scéna (všechny komponenty)
- **Přidáno:** CameraRig, OrbitControls, Stars, Galaxy, GalaxyCore, MatrixCore, Nebula, TreeOfLife, GalaxyMap, DistantGalaxies, TwinkleStars, ShootingStars, Environment, EffectComposer, FlightControls, PilgrimShip
- **Výsledek:** Černá obrazovka
- **Závěr:** Některá komponenta rozbíjí render loop

### Test 5: Minimální Canvas + CameraRig + OrbitControls (CURRENT)
- **Přidáno:** Červená kostka + CameraRig (OrbitControls + camera flight animation)
- **Výsledek:** Čeká se na test
- **Cíl:** Zjistit jestli CameraRig/OrbitControls rozbíjí scénu

## Co už víme
1. ✅ React renderuje správně (debug texty viditelné)
2. ✅ isMobile detekce funguje (mobile=true, w=375)
3. ✅ phase state machine funguje (intro → arrival → scene)
4. ✅ WebGL funguje na mobilu (minimální Canvas s kostkou renderuje)
5. ❌ Plná scéna s komponentami nerenderuje (černá obrazovka)
6. ✅ PilgrimRite skip na mobilu funguje (phase jde rovnou na scene)

## Co ještě nevíme
- Která konkrétní komponenta rozbíjí render loop
- Je to CameraRig/OrbitControls?
- Je to některá galaxy komponenta (Galaxy, GalaxyCore, TreeOfLife...)?
- Je to Environment (i když je skipnutý na mobilu)?
- Je to EffectComposer (i když je skipnutý na mobilu)?

## Další kroky
1. Test CameraRig + OrbitControls samostatně (Test 5 — current)
2. Pokud OK → přidat Stars (drei)
3. Pokud OK → přidat Galaxy
4. Pokud OK → přidat TreeOfLife
5. Pokud OK → přidat Nebula
6. Pokud OK → přidat GalaxyMap
7. Pokud fail → binary search na komponenty

## Změny v kódu (probíhající)

### OasisClient.tsx
- `isMobile` inicializován synchronně v `useState` (ne až v useEffect)
- `handleArrived`: na mobilu skip PilgrimRite → `setPhase('scene')` místo `'rite'`
- Container: `fixed inset-0 overflow-hidden` (místo `relative h-full w-full`)
- Na mobilu skryté: OnboardingHint, FruitCounter, WorldFilter, Hide UI button
- GamePanel: `isMobile` prop, na mobilu startuje minimalizovaný

### OasisScene.tsx
- Wrapper div: `position: absolute, inset: 0` (zajišťuje Canvas velikost na mobilu)
- Canvas: explicit `style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}`
- `Environment`: skip na mobilu + Suspense fallback
- `GalaxyCore`, `MatrixCore`, `TwinkleStars`: skip na mobilu (custom shaders / CPU heavy)
- `Galaxy`: `isMobile` prop, redukované particle count (12K místo 34K)
- `fog`: skip na mobilu
- `EffectComposer`: skip na mobilu (už dříve)
- `ambientLight`: 0.6 na mobilu (místo 0.15, kompenzuje chybějící Environment)

### Layout changes
- `(landing)/layout.tsx`: `100dvh` místo `h-screen`
- `(game)/layout.tsx`: `100dvh` místo `h-screen`
- `globals.css`: `@supports (height: 100dvh)` pro html/body

### GamePanel.tsx
- `isMobile` prop
- Na mobilu startuje minimalizovaný (jen `🚀 Lv1` tlačítko)
- ChevronLeft import přidán
- Close button pro minimalizaci
