# OASIS Mobile Debug Log

## Date: 2026-08-03

## Problem
OASIS preview na mobilu (https://oasis.zionterranova.com) — po intro "Enter the OASIS" černá obrazovka, jen mini tlačítka viditelná.

## Environment
- Server: zionterranova.com:2222 (Contabo VPS)
- Site: https://oasis.zionterranova.com (static Next.js export)
- Mobile: width=375, isMobile=true (detekce funguje)
- Browser: mobilní Chrome/Safari (konkrétní verze neznámá)

## Root Cause Found!
**CameraRig + OrbitControls (drei)** rozbíjejí WebGL render loop na mobilu.
Minimální Canvas bez CameraRig funguje. S CameraRig černá obrazovka.

## Solution
Na mobilu:
- **Skip CameraRig/OrbitControls** — kamera je fixní na `[0, 4, 22]`, FOV 60°, lookAt `[0, 0.5, 0]`
- **MobileArrivalTrigger** — zavolá `onArrived` hned po mountu (místo camera flight animace)
- **Skip UniverseRotator** na mobilu (závisí na groupRef z CameraRig)
- Všechny komponenty zabaleny v **R3FErrorBoundary** (pro případ crashu)

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

### Test 5: Minimální Canvas + CameraRig + OrbitControls
- **Přidáno:** Červená kostka + CameraRig (OrbitControls + camera flight animation)
- **Výsledek:** Černá obrazovka
- **Závěr:** **CameraRig/OrbitControls je root cause!**

### Test 6: Plná scéna bez CameraRig + ErrorBoundary + debug cube
- **Přidáno:** Všechny komponenty s R3FErrorBoundary, fixní kamera `[0, 0, 8]`, červená kostka 3x3x3, tmavě modré pozadí `#001a33`
- **Výsledek:** Vše viditelné — modré pozadí, červená kostka, zelený text, hvězdy/galaxie/strom
- **Závěr:** Potvrzeno — CameraRig/OrbitControls byl problém

### Test 7: Finální — bez debug, kamera na galaxii
- **Změněno:** Kamera `[0, 4, 22]` FOV 60° lookAt `[0, 0.5, 0]`, odstraněna kostka a debug texty
- **Výsledek:** Viditelný strom života + galaxie, ale kamera se nehýbe (fixní)
- **Status:** Funguje! Další krok — přidat touch ovládání kamery

### Test 8: MobileTouchControls (FINAL — WORKING!)
- **Přidáno:** Vlastní `MobileTouchControls.tsx` — pinch zoom + drag rotate + pan, bez drei OrbitControls
- **Výsledek:** Vše funguje na mobilu! Rotace, zoom, pan plynulé
- **Status:** ✅ OASIS mobile preview je funkční!

## Co už víme
1. ✅ React renderuje správně (debug texty viditelné)
2. ✅ isMobile detekce funguje (mobile=true, w=375)
3. ✅ phase state machine funguje (intro → arrival → scene)
4. ✅ WebGL funguje na mobilu (minimální Canvas s kostkou renderuje)
5. ✅ Plná scéna funguje bez CameraRig/OrbitControls
6. ❌ CameraRig/OrbitControls (drei) rozbíjí render loop na mobilu
7. ✅ PilgrimRite skip na mobilu funguje
8. ✅ R3FErrorBoundary zachytává crash komponent

## Co ještě nevíme
- Proč přesně CameraRig/OrbitControls crashne na mobilu (možná drei OrbitControls touch event handler?)
- Jak implementovat touch ovládání kamery bez drei OrbitControls

## Další kroky
1. Implementovat touch ovládání kamery (bez drei OrbitControls)
   - Pinch zoom
   - Touch drag rotate
   - Možná použít `useThree` + manuální event listenery
2. Otestovat flight mode na mobilu (FlightControls komponenta)
3. Optimalizovat výkon na mobilu (FPS)

## Změny v kódu

### OasisScene.tsx
- Wrapper div: `position: absolute, inset: 0` (zajišťuje Canvas velikost na mobilu)
- Canvas: explicit `style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}`
- Na mobilu: fixní kamera `[0, 4, 22]` FOV 60° lookAt `[0, 0.5, 0]`
- Na mobilu: skip CameraRig, OrbitControls, UniverseRotator
- Na mobilu: MobileArrivalTrigger (setTimeout onArrived)
- `Environment`: skip na mobilu + Suspense fallback
- `GalaxyCore`, `MatrixCore`, `TwinkleStars`: skip na mobilu
- `Galaxy`: `isMobile` prop, redukované particle count (12K místo 34K)
- `fog`: skip na mobilu
- `EffectComposer`: skip na mobilu
- `ambientLight`: 0.8 na mobilu
- Všechny komponenty v R3FErrorBoundary

### OasisClient.tsx
- `isMobile` inicializován synchronně v `useState`
- `handleArrived`: na mobilu skip PilgrimRite → `setPhase('scene')`
- Container: `fixed inset-0 overflow-hidden`
- Na mobilu skryté: OnboardingHint, FruitCounter, WorldFilter, Hide UI button

### GamePanel.tsx
- `isMobile` prop, na mobilu startuje minimalizovaný

### R3FErrorBoundary.tsx (NEW)
- Error boundary pro R3F komponenty uvnitř Canvas
- Zachytí crash bez zabití render loopu

### Layout changes
- `(landing)/layout.tsx`: `100dvh` místo `h-screen`
- `(game)/layout.tsx`: `100dvh` místo `h-screen`
- `globals.css`: `@supports (height: 100dvh)` pro html/body
