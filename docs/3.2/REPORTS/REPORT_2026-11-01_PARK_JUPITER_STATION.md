# REPORT 2026-11-01 — JUPITER STATION (první hratelné místo v Nirvaně)

> **Stav:** hotové a ověřené lokálně (produkční build, M1 / ANGLE Metal).
> **Route:** `/park` (veřejná, mimo ZAP pass gate). Do vesmíru přidána pozvánka:
> dlaždice **Pouť** + prstenec u Jupitera, klik = fokus na planetu a okno pouti.
> **Nenasazeno v době sepsání** — deploy na EDGE následuje.

## 1. Co to je

Nirvana byla prohlídka: přiletět, podívat se, odejít. Jupiter Station je první
místo, kde se dá **hrát** — a první místo, které má smyčku:

```
přiletíš → vybereš skříň → dohraješ → žetony + zápis do tabule → jedeš na kole
```

**Scéna** (`apps/nirvana/src/core/scene/park/ParkScene.tsx`): kruhová plošina
v kosmu, tři arkádové skříně, ruské kolo s deseti gondolami, tabule skóre
a Jupiter jako obloha (jediná textura v celé scéně).

**Hry** (`apps/nirvana/src/core/park/games/`): Pong, Breakout, Snake — čistý
canvas 2D, žádné assety, žádná knihovna.

Klíčový trik: **jeden canvas, dva pohledy.** Hra se kreslí do canvasu, který je
zároveň `CanvasTexture` na obrazovce skříně. Proto ji vidí i hráč ve VR —
obrazovka je skutečný povrch, ne DOM.

## 2. Ovládání

| Vstup | Co dělá |
|---|---|
| myš / dotyk | paddle u Pongu a Breakoutu (poloha ukazatele) |
| šipky / WASD | totéž + Snake |
| klik na skříň ve 3D | otevře hru (funguje i paprskem ve VR) |
| klik na kolo | jízda (stojí 1 žeton) |
| VR tlačítko | přepne canvas do XR session (`@react-three/xr` už v projektu byl) |

## 3. Žetony a tabule

- **1 žeton** za dohranou hru, **+2** za osobní rekord, **+1** denně za první návštěvu.
- Žetony žijí **jen v prohlížeči** (`localStorage`) a nekupují nic, co má hodnotu.
- Jízda na kole stojí 1 žeton.
- **Tabule** `/api/park/scores`: top 10 na hru, přezdívka (max 12 znaků, očištěná),
  rate limit 20/min na IP. Bez účtů, bez peněz.
- **Persistence:** soubor, pokud je nastaven `NIRVANA_PARK_SCORES_PATH`
  (musí být zapisovatelný pro uživatele služby); jinak jen v paměti procesu —
  restart = prázdná tabule. To je poctivé, ne falešná sláva.

## 4. Co to **nedělá** (a proč)

- **Žádné kasino s reálnými ZION.** Výplata by z hračky udělala money-path
  (RNG důvěryhodnost, audit, limity, právo). Park zůstává hrou.
- **Neobchází ZAP pass.** Brány do světů zůstávají za pasem; pouť jen ukazuje,
  že existují.
- **Nedotýká se L1**, emisí, genesis ani výplat.

## 5. Naměřeno / ověřeno (lokálně)

| Věc | Výsledek |
|---|---|
| Pong | hraje se, skóre se počítá, konec do 7 |
| Breakout | paddle + cihly + 3 životy, skóre 10/cihla |
| Snake | klávesy, jablko 25, náraz = konec |
| Žetony | 1 → 2 po dohrání (award funguje) |
| „Hrát znovu" / „Ukončit" | obě cesty ověřené |
| Kolo | jízda se spustí, kamera jede v gondole, „Sesednout" vrací |
| Vesmír | dlaždice **Pouť** → fokus na Jupiter → okno → `/park` |
| API | `GET/POST /api/park/scores` 200, rank spočítán |
| Mobil 390×844 | panel i dok se vejdou, Snake hratelný |
| Konzole | jen pre-existing `401` z `/api/auth/me` |

## 6. Známe meze

- **VR netestováno na headsetu** — XR session se otevře, ale ověření paprskem
  na skutečném zařízení chybí. Interakce jsou psané jako raycast, takže by měly
  fungovat; tvrdit víc by bylo nepoctivé.
- **Skříně jsou stylizované boxy**, ne modely — procedura (canon: žádné assety).
- **Gondoly se nehoupou**, jen obíhají (fyzika je na jindy).
- **Tabule bez perzistence**, dokud operátor nenastaví cestu k souboru.
- Hry nemají zvuk.

## 7. Kde to je v kódu

| Soubor | Role |
|---|---|
| `apps/nirvana/src/app/park/page.tsx` | stránka: plátno, XR, dok s hrou, panel, žetony, tabule |
| `apps/nirvana/src/core/scene/park/ParkScene.tsx` | svět: plošina, skříně, kolo, Jupiter, jízda |
| `apps/nirvana/src/core/park/games/{types,pong,breakout,snake,index}.ts` | hry |
| `apps/nirvana/src/core/park/profile.ts` | žetony a rekordy v prohlížeči |
| `apps/nirvana/src/core/park/scores.ts` | typy tabule |
| `apps/nirvana/src/app/api/park/scores/route.ts` | top 10, rate limit, volitelný soubor |
| `apps/nirvana/src/portals/park/ParkPortal.tsx` | okno ve vesmíru |
| `apps/nirvana/src/core/scene/universe/SolarSystem.tsx` | prstenec u Jupitera (`JupiterStation`) |
| `apps/nirvana/src/core/scene/universe/positions.ts` | `planetPosition()` — stejný vzorec pro scénu i fokus |

## 8. Změnový log

| Datum | Změna |
|---|---|
| 2026-11-01 | Vznik: tři hry, kolo, žetony, tabule, XR, pozvánka ve vesmíru |
