# Report — jednotný design přechodů a linek (2026-11-02)

> **Cíl:** stejný design a stejná čísla pro **všechny přechody** (kamera, CSS)
> a **všechny linky** (dráhy, osy, trasy, stopy, prstence, spoje) v aplikaci —
> ne jen ve vesmírné scéně.
> **Aplikace:** `apps/nirvana` · **Větev:** main

---

## 1. Problém

Každý povrch měl vlastní číslo a vlastní barvu:

| Povrch | Přechod kamery | Zdroj |
|---|---|---|
| Venuše (sólo) | `Math.min(1, dt * 4.5)` | `VenusRace.tsx` |
| Venuše (MP) | `Math.min(1, dt * 4.5)` | `VenusMultiplayer.tsx` |
| Pouť — dock | `lerp(pos, 0.15)` | `ParkScene.tsx` |
| Pouť — gondola | `Math.min(1, delta * 9)` | `ParkScene.tsx` |
| Merkur | `1 - exp(-6 * …)` | `DuelStage.tsx` |
| Vesmír | `easeOutCubic`, `1.6 s` | `LinkEngine.ts` |

CSS: `220ms`, `320ms`, `340ms`, `0.18s`, `0.2s`, `0.3s` na různých místech.

Linky: `links.ts` měl jen barvu/šířku; druhy linek si každý renderer vymýšlel
sám (`LINK_OPACITY * 0.55`, hardcoded `0.035`, `#ffb46a`…).

---

## 2. Řešení — dva design moduly

### 2.1 `core/design/motion.ts`

```ts
MOTION = {
  fast: 0.16, base: 0.24, slow: 0.36, veil: 0.45,
  fly: 1.6, followRate: 9,
  easeCss, easeOutCss,
}
dampFactor(delta, rate?)   // 1 - e^(-rate·Δt), frame-rate independent
damp(current, target, …)   // skalární
dampVec3(...)              // vektorové
easeOutCubic / easeInOutCubic
motionCss(0.24) -> "240ms"
```

CSS protějšek v `globals.css`:
```
--zion-motion-fast: 160ms; --zion-motion-base: 240ms; --zion-motion-slow: 360ms;
--zion-motion-veil: 450ms; --zion-ease: cubic-bezier(0.4,0,0.2,1);
--zion-ease-out: cubic-bezier(0.16,1,0.3,1);
```

### 2.2 `core/design/links.ts`

Přeneseno z `scene/universe/links.ts` (ten je teď re-export) + nově:

```ts
LINK_KINDS = {
  orbit:     { width: LINK_WIDTH,          opacity: 0.45, activeOpacity: 0.9 },
  axis:      { width: LINK_WIDTH,          opacity: 0.45, activeOpacity: 0.9 },
  route:     { width: LINK_RADIUS,         opacity: 0.2475, activeOpacity: 0.9 },
  trail:     { width: LINK_RADIUS,         opacity: 0.36, activeOpacity: 0.9 },
  ring:      { width: LINK_RADIUS,         opacity: 0.1575, activeOpacity: 0.9 },
  connector: { width: LINK_WIDTH * 0.6,    opacity: 0.45, activeOpacity: 0.9 },
}
```

---

## 3. Co se přepnulo na tokeny

| Soubor | Změna |
|---|---|
| `VenusRace.tsx` | `dt*4.5` → `dampFactor(dt)` |
| `VenusMultiplayer.tsx` | `dt*4.5` → `dampFactor(dt)` |
| `DuelStage.tsx` | `1-exp(-6·…)` → `dampFactor(delta)` |
| `ParkScene.tsx` | `0.15` a `delta*9` → `dampFactor(delta)` |
| `LinkEngine.ts` | `DEFAULT_DURATION = MOTION.fly`, `easeOut = easeOutCubic` |
| `LinkLayer.tsx` | styl spoje z `LINK_KINDS[edge.kind]` |
| `globals.css` | `--zion-motion-*` + `--zion-ease*`; `.portal-veil`, `.planet-chip`, `.link-nav-*` |
| `scene/universe/links.ts` | re-export z `@/core/design/links` |

---

## 4. Ověření

- `npx tsc --noEmit` → **0 chyb**
- `npm run build` → **OK**
- `npx tsx apps/nirvana/test/links.mjs` → **PASS 37/37**
  (nově `motionCss(0.24)='240ms'`, `dampFactor(60 fps)≈0,14`,
  `dampFactor(0)=0`, monotonie, konvergence `damp`, `easeOutCubic` 0/1/monotonie)

---

## 5. Meze (co záměrně zůstává mimo)

- **Ornamenty** — Śrí jantra, prstence Slunce, Issobella ring, stanice, brána.
  Jsou to předměty, ne linky; jejich barvy nesou význam (zlato = Hiran,
  fialová = L6).
- **Herní geometrie** — okraj tratě (`TrackStage` `#ffb46a`), klec Merkuru,
  Nexy. Je to gameplay, ne vodicí linka.
- **Interaktivní tint planety** — hover prstenec nese barvu planety, aby seděl
  k chipu.
- **MobaStage** — kamera se nastavuje absolutně (top-down), přechod není.
- **Route transition mezi stránkami** (Next navigace) — zatím bez animace;
  případný další krok (`view-transition-name` nebo overlay) by měl použít
  `--zion-motion-base`/`--zion-ease`.

---

*Vytvořeno 2026-11-02.*
