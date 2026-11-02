# Report — navigační engine: planety, světy a L5 (2026-11-02)

> **Zadání:** „ne linky jako vizuální čáry — **odkazy**: planety na klik, světy,
> L5. Ten engine i design."
> **Aplikace:** `apps/nirvana` · **Větev:** main

---

## 1. Co bylo roztříštěné

| Cíl | Kde se registroval | Co udělal klik |
|---|---|---|
| Planeta | `SolarSystem.tsx` (vlastní `onSelectPlanet`) | přiletěl + `.planet-panel` |
| Svět L4/L6 | `OrbitalWorlds` / `IssobellaRing` (`onSelectWorld`) | otevřel `WorldPortal`, **kamera zůstala na Zemi** |
| L5 misie | `NewEarth.tsx` (`window.open`) | **otevřel nový tab** |
| L6 stanice | `IssobellaRing` | `IssobellaPortal` |
| Měsíc | `NewEarth` (`onOpenMatrix`) | `MatrixPortal` |
| Flotila / archa / brána | samostatné komponenty | vlastní portál |

Tři různé panely, dvě různé reakce kamery, jeden `window.open`.

---

## 2. Engine

`LinkEngine` je teď **registr navigačních cílů** (ne vizuálních čar):

```ts
LinkTarget = {
  id, kind: planet|world|mission|station|moon|fleet|ark|gate|sun|earth,
  anchor(ctx), size, framing, follow, label, cta, accent
}
```

- `focus` v `Shell`/`SceneRoot`/`Universe` je **`string`** — cíl může být
  `earth`, `mars`, `mission:<key>`, `world:<id>`. Přidání typu cíle =
  jeden záznam v registru, žádná změna tří typových unií.
- `registerWorldTargets(engine, worlds)` — volá `Universe` po načtení
  katalogu; vytvoří `world:<id>` pro L6 (prstenec) i L4 (oběžná dráha)
  a **smaže stale** cíle, které z katalogu zmizely.
- `mission:<key>` pro `EARTH_MISSIONS` — statické cíle na glóbu.

---

## 3. Rotace jako funkce času (jinak fokus míjí)

Scény dřív akumulovaly `rotation.y += delta * speed`. Fokus neměl z čeho
polohu spočítat. Teď:

| Prvek | Konstanta | Vzorec |
|---|---|---|
| glóbus Nové Země + misie | `GLOBE_SPIN_SPEED = 0,02` | `y = 0,02·t` |
| pás L4 světů | `ORBIT_BELT_SPEED = 0,05` | `y = 0,05·t` |
| prstenec Issobelly | `RING_SPIN_SPEED = 0,03` | `y = 0,03·t` |

`missionAnchor()` a `worldAnchor()` v `positions.ts` počítají **stejnou**
polohu (včetně `RING_TILT` a Euler rotace), jakou kreslí scéna.

---

## 4. Jedno chování kliknutí a jeden design

- **Planeta** → přiletět + `.planet-panel` (jako dřív).
- **Svět** → `selectWorld` nastaví `focus='world:<id>'` (přiletí) **a**
  otevře `WorldPortal`.
- **L5 misie** → `selectMission` nastaví `focus='mission:<key>'` (přiletí)
  a otevře **stejný `.planet-panel`** s názvem, stavem (barva
  `MISSION_STATUS_COLOR`), CTA na interní prezentaci a `← zpět k Zemi`.
  Už žádný `window.open`.
- Panel planety i misie mají stejnou strukturu (header + close, text,
  akce), takže „design“ je jeden.

---

## 5. Ověření

- `npx tsc --noEmit` → **0 chyb**
- `npm run build` → **OK**
- `npx tsx apps/nirvana/test/links.mjs` → **PASS 60/60**
  - `mission:uluru` v registru, anchor konečný, `flyTo` → `current=mission:uluru`, kamera < 10 j.
  - `world:w-ring`, `world:w-orbit` registrované, anchory konečné, `flyTo` funguje
  - stale svět zmizí, nový přibude
  - motion tokeny (dampFactor, ease, motionCss)
- Headless Chromium (produkční build, stub verify):
  - `window.__nirvanaLink` existuje
  - `flyTo('mission:uluru')` → `current=mission:uluru`, kamera se posunula > 3 j.
  - klik na planetu → `current=mercury`
  - jediná konzolová chyba: pre-existing `401` z `/api/auth/me`

---

## 6. Meze

- **Lokálně nelze otestovat klik na svět** — `/api/oasis/worlds` potřebuje
  OASIS backend (`127.0.0.1:8094`), který na dev boxu neběží. Registrace
  světů je proto ověřená unit testem (`registerWorldTargets`), ne klikem.
- **Klik na 3D marker v headless** je nespolehlivý (instancované meshe,
  raycast na přesné pixely) — testy používají `window.__nirvanaLink.flyTo`.
- **Moon/ocean/orbit misie** (Matrix, archa, flotila) mají vlastní cíle
  (`moon`, `archa`, `fleet`), ne `mission:` — jsou to jiné objekty.
- **Design panelu** je sjednocený pro planetu a misii; `WorldPortal` zůstává
  bohatší okno (seznam světů), protože to je jeho funkce.

---

*Vytvořeno 2026-11-02.*
