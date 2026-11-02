# Report — jednotný LinkEngine a přepínání kamery (2026-11-02)

> **Cíl:** vymyslet a implementovat jednotný engine pro **všechny linky** ve
> vesmírné scéně a **přepnutí kamery na označenou planetu nebo bod**.
> **Větev:** main · **Aplikace:** `apps/nirvana`

---

## 1. Problém (stav před)

Kamera i linky byly roztříštěné na třech místech a vzájemně si odporovaly:

| Místo | Co dělalo | Problém |
|---|---|---|
| `Shell.tsx` | 7× `flyTo(id, { camera: null as any, … })` | `null` kamera → přelet házel/nefungoval; `archa`/`issobella` se přebily `focus='earth'` |
| `SolarSystem.tsx` | `flyTo(id, { camera: window.__nirvanaCamera, … })` | půjčená globální kamera, druhý výpočet fokusu |
| `Universe.tsx` | ruční posun kamery za Zemí + `linkEngine.update` | dvě větve sledování, `focusRef` race |
| `LinkEngine.ts` | `getFocus` per cíl, duplikovaná `distance = max(3.6, size*3.4+1.6)` | 8× stejný vzorec, mrtvý kód `dx = ex - ex` |
| `links.ts` | jen styl (barva/šířka) | žádná data „co je s čím spojené“ |

**Reálné chyby nalezené při auditu:**
1. Klik na Jupiter poslal kameru k **Slunci** — `focus` byl `'park'`, engine
   takový cíl neměl a spadl na `toTarget=(0,0,0)`. (Ověřeno: oprava → dist od
   Slunce 69,5.)
2. `flyTo('archa'/'issobella')` se po `setFocus('earth')` přepsal zpět.
3. Fokus na archu míjel loď — aproximace `earthPos+(12,0.8,6)` vs skutečná
   dráha `SailingArk` na nakloněné rovině.

---

## 2. Návrh — jeden engine, tři vrstvy

```
             ┌─────────────────────────────────────────────┐
  data       │  LinkEngine (registry)                      │
             │   · LinkTarget[] — id, kind, anchor(ctx),    │
             │     size, framing, follow, label, cta        │
             │   · LinkEdge[] — co je s čím spojené         │
             └───────────────┬─────────────────────────────┘
                             │ anchor() každý frame
        ┌────────────────────┼─────────────────────┐
        ▼                    ▼                     ▼
  frameFor()           LinkLayer             LinkNavHud
  (kamera)             (spoje)               (označený bod + ← Země)
```

### 2.1 Klíčová rozhodnutí

- **`anchor(ctx)` místo `getFocus(ctx)`.** Jeden zdroj pravdy o poloze; framing
  se počítá z něj. Pohyblivé cíle (planety, flotila, Měsíc, archa, brána) vrací
  živou pozici stejným vzorcem jako scéna (`positions.ts`).
- **`flyTo(id)` bez kontextu.** Engine si kontext vezme z `update(ctx, delta)`
  uvnitř `<Canvas>`. Komponenty nemusí shánět kameru.
- **Sledování pohyblivého cíle = delta anchoru.** Posune se kamera i
  `controls.target` o stejný vektor → cíl zůstane v záběru a uživatel může
  rotovat/zoomovat. (Dřív lerp na pevný offset s myší bojoval.)
- **Jeden typ `UniverseFocus`** pro `Shell`, `SceneRoot`, `Universe`.
- **Katalog planet mimo renderer** (`planetCatalog.ts`) — jinak by vznikl
  kruhový import `SolarSystem ↔ LinkEngine`.

### 2.2 Framing

```ts
frameFor(target, ctx):
  anchor = target.anchor(ctx)
  dist   = max(minDistance ?? 3.6, size * (radius ?? 3.4) + 1.6)
  cam    = anchor + dist * offset          // offset [0.75, 0.5, 1]
  target = anchor + (0, size*0.4, 0)
```

Fleet/Měsíc/brána mají `compute()` override (radiální odstup, aby kamera
stála vně soustavy). Slunce má pevný `(17,8,17)`. Země `offset [11/4,6/4,19/4]`
(kvůli `size=4`).

---

## 3. Implementace (soubory)

| Soubor | Změna |
|---|---|
| `planetCatalog.ts` | **nový** — `PlanetDef`, `PLANETS`, `orbitRadius`, `planetIndex`, `JUPITER` |
| `LinkEngine.ts` | **přepsán** — registry, `frameFor`, `flyTo(id)`, `update`, `subscribe`, `snapTo`, `getLastCtx`, `DEFAULT_LINK_EDGES`, `useLinkFocus` |
| `LinkLayer.tsx` | **nový** — kreslí `LinkEdge` spoje z předalokovaných bufferů |
| `LinkNavHud.tsx` | **přepsán** — `subscribe`, tlačítko `← Země`, `Escape` |
| `positions.ts` | `arkPosition(t)`, `ISSOBELLA_FOCUS` (jedna formule se scénou) |
| `SolarSystem.tsx` | import z katalogu, re-export, **odebrány** `flyTo` hacky |
| `Universe.tsx` | **odebráno** ruční sledování Země, přidán `LinkLayer` |
| `Shell.tsx` | `PORTAL_FOCUS` mapa, `UniverseFocus`, žádné `camera: null` |
| `SceneRoot.tsx` | `UniverseFocus` |
| `globals.css` | `.link-nav-back` (klikatelné přes `pointer-events:none` HUD) |
| `test/links.mjs` | **nový** — 26 kontrol bez prohlížeče |

---

## 4. Ověření

### 4.1 TypeScript + build
- `npx tsc --noEmit` → **0 chyb**
- `npm run build` → **OK** (všech 20+ rout)

### 4.2 Unit test (`npx tsx apps/nirvana/test/links.mjs`)
**PASS — 26/26**
- registry má Zemi/Jupiter/bránu/archu
- všechny anchory konečné (žádné NaN)
- přelet na Mars skončí u Marsu (< 12 j.), ne u Slunce
- návrat na Zemi (`current='earth'`, target u Země)
- sledování pohyblivého cíle (posun Země +2 → kamera i target +2)
- `frameFor` respektuje velikost objektu
- `arkPosition(0)` == `THREE.Euler(ARK_TILT)` (jedna formule)

### 4.3 Headless Chromium (produkční build, stub verify)
- `/` render: **175 draw calls, 90 444 tris, 40 textur, 0 invalid vertices, tier A**
- 4 interaktivní planet chips, 1 canvas
- klik na Merkur → kamera se posune >5 j., panel „Merkur“ se otevře, HUD +
  `← Země` viditelné
- klik na Jupiter → kamera u Jupiteru (**dist od Slunce 69,5** — starý bug letěl
  k Slunci), `← Země` se vrátí, HUD zmizí
- jediná konzolová chyba: pre-existing `401` z `/api/auth/me`

---

## 5. Meze (co engine neumí)

- **Neřeší portálová okna** — ta zůstávají v `Shell` (DOM), engine jen letí.
- **Neumí trasu mezi dvěma body** (letět z Marsu na Venuši obloukem) — přelet
  je vždy z aktuální kamery do framingu cíle. Trasa flotily (`FleetRoute`) je
  samostatná animace konceptu, ne součást enginu.
- **Vzdálené planety (Saturn–Neptun) nejsou cíle** — nemají vstup do hry a
  nejsou v registru. Přidat = jeden záznam (a `UniverseFocus` člen).
- **`world` body** nejsou v registru — klik na svět otevírá portál, ne přelet.
- **Edge spoje jsou jen dekorativní** (`kind:'orbit'`), nejde po nich „skočit“.
- Netestováno na skutečném telefonu ani VR headsetu.

---

## 6. Další krok (návrh)

- Přidat `world` body do registru (přiblížení k prstencovým/orbitálním světům).
- Volitelně: „skoč po spoji“ — klik na `LinkEdge` přiblíží cílový bod.
- Zvážit, zda `Saturn/Neptun` mají být cíle (dnes jen dekorace).

---

*Vytvořeno 2026-11-02.*
