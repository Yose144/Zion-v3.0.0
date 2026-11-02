# Report — jednotný hover kruh pro odkazy, bez vizuálních spojnic (2026-11-02)

> **Zadání:** „tu vizuální linku odstraň. Všechny nápisy s interaktivními odkazy
> sjednotit — jako hry (Mars, Venuše). Ale nedávej pod ně jména, jen rozliš
> barvou. Najedeš na Slunce a zobrazí se kruh jako u Marsu — je jasné, že je to
> hyperlink na další svět. Sjednotit na všechny světy."

---

## 1. Co se odstranilo

- **`LinkLayer`** — spoje mezi body (čáry Země→Měsíc, →flotila, →Issobella…).
- **`LinkTrail`** — stopa za kamerou při přeletu.

Oba soubory smazány; `Universe` je už nevykresluje. Data `DEFAULT_LINK_EDGES`
zůstávají jen pro HUD „skoč na…“ (navigace, ne vizuál).

---

## 2. Co se sjednotilo

### `NavHalo` — jediný hover indikátor

```
core/scene/universe/NavHalo.tsx
  active, color, radius, thickness, position
  → dvojitý billboard prstenec, aditivní blend, fade in/out
```

Použit na **všech** odkazech:

| Objekt | Soubor | Barva |
|---|---|---|
| planety (Mars/Venuše/Jupiter/Merkur) | `SolarSystem` | tint planety |
| Jupiter Station | `SolarSystem` | `#ffb46a` |
| Slunce / Hiran | `HiranSun` | `#ffd166` |
| světy L4 (pás) | `OrbitalWorlds` | barva vrstvy |
| světy L6 + stanice | `IssobellaRing` / `IssobellaStation` | barva vrstvy / `#c084fc` |
| L5 misie na glóbu | `NewEarth` | barva stavu |
| Měsíc / Matrix | `NewEarth` | barva stavu |
| Nebeská flotila | `SkyFleet` | `#38bdf8` |
| Archa | `SailingArk` | `#1d8fb3` |
| Brána do OASIS | `StarGate` | `#fcd116` |

### Žádná jména pod odkazy

- Planety s herním vstupem: **odebrán HTML chip** (`.planet-chip` s názvem
  a CTA).
- Světy, L5 misie, Měsíc, flotila, archa, brána, Slunce, Jupiter Station:
  **odebrány 3D `TextLabel`** s názvem.
- Neinteraktivní planety (Saturn/Uran/Neptun) si **nechaly tlumené jméno** —
  nejsou to odkazy, slouží k orientaci.
- Jméno se ukáže **až v panelu** po kliknutí.

---

## 3. Vedlejší přínos (měřeno)

Každý `TextLabel` je vlastní `CanvasTexture`; jejich odebrání uvolnilo scénu:

| Metrika | Před | Po |
|---|---|---|
| textury | 40 | **21** |
| draw calls | 175 | **153** |
| triangles | 90 444 | 90 410 |
| invalid vertices | 0 | 0 |

---

## 4. Ověření

- `npx tsc --noEmit` → **0 chyb**
- `npm run build` → **OK**
- `npx tsx apps/nirvana/test/links.mjs` → **PASS 60/60**
- Headless Chromium (produkční build, stub verify):
  - engine má cíle `earth`, `sun`, `mars`, `mission:uluru`, `gate`, `issobella`
  - `.planet-chip` = **0** (chipy opravdu zmizely)
  - canvas 1, 0 reálných chyb (jen pre-existing 401)
  - **klik na projekci Merkuru** (3D hit-sféra) → `focus=mercury`, `.planet-panel` se otevřel
  - hover sweep myší po plátně bez chyb

---

## 5. Meze

- **Hover v headless nelze vizuálně ověřit** (WebGL canvas se nedá snadno
  číst) — ověřeno je, že se scéna renderuje bez chyb a klik funguje.
- **Mobil** nemá hover; kruh se objeví jen při dotyku (pointerover) a hned
  následuje panel. To je stejné chování jako u her.
- **Jména jsou jen v panelu** — kdo chce názvy přímo ve scéně, musí se vrátit
  k labelům (vědomé rozhodnutí podle zadání).

---

*Vytvořeno 2026-11-02.*
