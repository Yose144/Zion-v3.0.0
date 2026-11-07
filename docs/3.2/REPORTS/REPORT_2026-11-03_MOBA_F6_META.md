# Report — MOBA: meta, scoreboard a obtížnost (F6, 2026-11-03)

> **Zadání:** „f6" — poslední fáze plánu `docs/3.3/MOBA-PRVNI-SVET-PLAN.md`.
> **Kde:** `apps/nirvana` (`core/moba/`) + `apps/nirvana-net`
> **Deployed:** net `20261103T033852Z` (proto 13) · app `20261103T034041Z`

---

## 1. Výchozí stav

Hra ukazovala jen svoje HP, manu, zlato a K/D. **Nebylo kde zjistit, kdo jak
hraje** (poškození, léčení, zlato za minutu), po zápase zůstal jen banner
a bot byl jen jeden — bez možnosti zvolit si obtížnost.

## 2. Co F6 přidala

### Scoreboard (Tab nebo tlačítko Σ)

Dvě tabulky týmů, každý hrdina s **Lv, K/D, zlatem, GPM, XPM, poškozením
a léčením**. Tvůj řádek je zvýrazněný. Data jdou celá ze snapshotu — klient
si nic nevymýšlí.

- `damageDone` sim počítal už dřív, ale **neposílal**; teď je ve snapshotu
  jako `damage`.
- `healingDone` je nový (počítá se i regenerace z Lotosu).
- **GPM/XPM** se dopočítávají z času zápasu a `totalXpAt(level, xp)` — bez
  té funkce by XPM nešlo spočítat.

### Pozápasový souhrn

Stejné tabulky i na obrazovce vítězství — hráč vidí, kdo zápas odnesl
a proč (poškození vs. léčení vs. zlato).

### Obtížnost botů (easy / normal / hard)

Mění **jen rozhodování**, nikdy poškození:

| | přesnost míření | pauza mezi kouzly | ustoupí pod |
|---|---|---|---|
| easy | ±3,2 m | 1100 ms | 30 % HP |
| normal | ±1,4 m | 450 ms | 55 % HP |
| hard | ±0,45 m | 120 ms | 72 % HP |

- V **sólu** si obtížnost vybereš na pick screenu.
- V **online** drží server `normal` (protokol se nemění).
- Míření je deterministické (sin-hash z času a pozice), takže stejná hra dá
  stejný výsledek — testy na tom staví.

## 3. Nalezená chyba: wrapper zahazoval requesty

`MobaGame` je jen obal nad `SoloController` a **nepřeposílal `sellRequest`
ani `buybackRequest`**. Stránka je předávala, ale komponenta je zahodila —
takže **prodej itemů (F2) a buyback (F5) v sólu vůbec nefungovaly**. Obojí
je teď přeposlané a prochází všemi vrstvami.

## 4. Ověření

| Test | Výsledek |
|---|---|
| `npx tsx apps/nirvana/test/moba-sim.mjs` | **140/140** (7 nových: řád obtížnosti, hard sešle víc kouzel, damage/healing ve snapshotu, `totalXpAt`) |
| `npx tsc --noEmit` (app i net) | čistý |
| `e2e/first-world.mjs` proti produkci | **16/16** — nově „scoreboard: dvě tabulky týmů" |
| živě | `/net/health` → **proto 13**, app `20261103T034041Z`, smoke 200 |

## 5. Co se cestou pokazilo

- **E2E padal na `Identifier already declared`** — patch se aplikoval dvakrát,
  protože se kotvil na řetězec, který je v souboru dvakrát (otevření/zavření
  obchodu). Poučení: u `str.replace` v testech vždy ověřit počet výskytů.
- **Overlay vítězství se objevil o snímek později** (tabulky = delší render),
  takže test na jeden dotaz selhal. Test teď čeká na selektor, ne na okamžik.

## 6. Meze (poctivě)

- **Asistence se nepočítají** — scoreboard má K/D, ne KDA (asistenci by
  musel sim evidovat per hrdina).
- **Replay/spectate a den-noc** zůstávají volitelné nad rámec F6.
- **GPM/XPM jsou orientační** — nezahrnují zlato utracené před koncem.
- **Obtížnost v online nejde nastavit** (server drží normal); pro 5v5 by to
  chtělo parametr místnosti.
- **Scoreboard se nedá řadit** (řadí se podle zabití, pak zlata).

## 7. Stav plánu

F1–F6 hotové: ekonomika → itemy → mapa → objektivy → vidění/smrt → meta.
Plán `docs/3.3/MOBA-PRVNI-SVET-PLAN.md` je tím naplněný; co zůstává, jsou
věci, které plán **záměrně** odkládal (aktivní itemy, talent strom,
neviditelnost a sentry, replay, den-noc cyklus).

---

**Souvisí:** [`MOBA-PRVNI-SVET-PLAN.md`](../../3.3/MOBA-PRVNI-SVET-PLAN.md) ·
`apps/nirvana/AGENTS.md` § PRVNÍ SVĚT — meta · commit `fbd820e8b` (F6)
