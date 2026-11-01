# REPORT 2026-11-01 — `/vast-rigs` polish pass (IntroPage)

**Surface:** https://zionterranova.com/vast-rigs/ (ops dashboard, `apps/IntroPage/src/app/vast-rigs/`)
**Status:** DEPLOYED (intro deploy, EDGE2 `/var/www/zion-maintenance`), live verified desktop + mobile.

## Co bylo rozbité (nálezy z živé sondy, ne z dojmu)

1. **`/vast-ops/*` panely visely navždy.** AI inference i GPU market volají `/vast-ops/api/*`, což je
   nginx `auth_basic`. Neautentizovaný `fetch()` v Chromiu **nefailuje** — zaparkuje request a čeká na
   přihlašovací dialog. Panely proto zůstaly na `Checking…` / `Searching…` (naměřeno: `fetch` se
   nedořešil ani po 120 s) a polling každých 10 s zkoušel dokola.
2. **Celý dashboard byl vycentrovaný.** `public/assets/css/main.css` (HTML5UP reset) dává
   `text-align: center` na `<body>` **a `margin: 0 auto` na každý `div`/`section`**. Karty, hlavičky
   karet a KPI ve `vast-dashboard-shell` se proto posouvaly doprostřed řádku.
3. **Mobil: tabulka rigů řezala obsah.** `min-w-[840px]` + `nowrap` badge → vodorovný scroll
   (Shares/GPU mimo obraz); rozbalený panel přetékal ještě víc (Spark 150 px, `shrink-0` etime,
   tlačítko „Full deploy“ s `white-space: nowrap` z tématu) → `scrollWidth` 397 vs 375.
4. **Nepravdivý první paint:** statické HTML tvrdilo `0 active rigs`, i když snapshot ještě nepřišel;
   gramatika „1 active rigs“; `<title>vast rigs</title>`.
5. **Kosmetika v tabulkách:** „Pool miners by hashrate“ vypisoval celou session identitu
   (`zion1d2k…zion1d2k…vega-smos`) a hashrate natvrdo v TH/s (47 kH/s se zobrazilo jako `—`);
   „Pool fee“ ukazoval jen `miner 89 · charity 5 %` (issobella chyběla).
6. **Rasta nav:** zděděný `a { border-bottom: dotted }` z intro tématu kreslil tečkovanou čáru
   pod mobilním logem.

## Co je opravené

| # | Fix | Soubor |
|---|---|---|
| 1 | `opsFetch()` — každé volání `/vast-ops/*` má `AbortSignal.timeout` (12 s, první AI probe 6 s); 401/403/abort → jeden stav **„Ops API not reachable“** + polling se zastaví (2 requesty a dost) + tlačítko Retry | `Dashboard.tsx` |
| 2 | `.vast-dashboard-shell { text-align: left }` + `margin-left/right: 0` pro blokové potomky (Tailwind `mx-auto`/`ml-auto` dál vyhrávají) | `globals.css` |
| 3 | Responzivní tabulka: `Cost` skrytý < `sm`, `GPU` < `md`, `Shares` < `lg`, `min-w` 840 → 340; `cost`/`shares` doplněny do rozbaleného meta baru; badge A/R skryté na mobilu; rozbalený panel `max-w-[calc(100vw-2.5rem)]`; `Spark` skrytý < `sm`; „Full deploy“ `whitespace-normal` | `Dashboard.tsx` |
| 4 | `—` místo `0` dokud snapshot nedorazí, `1 active rig` / `N active rigs`, titulek `Vast.ai rigs · ZION OPS` + description | `Dashboard.tsx`, `page.tsx` |
| 5 | `shortWorker()` (`wallet…zkratka · worker`), `fmtHps()` místo TH/s, fee split `miner 89 % · charity 5 % · issobella 5 %` | `Dashboard.tsx` |
| 6 | `.rasta-nav a, .rasta-nav button { border-bottom: 0 }` | `apps/shared/ui/rasta-nav.css` |
| – | `/dashboard/` (redirect na dashboard.zionterranova.com) byl na serveru jen jako pozůstatek starého exportu → přesunut do `public/dashboard/index.html`, aby ho `rsync --delete` nesmazal | `public/dashboard/index.html` |

## Ověření

- `npx tsc --noEmit` čistý, `npm run build` 48/48 stránek.
- Lokálně (statický `dist/`): všechny 4 záložky, `#mining|#ai|#market|#pool` deep-link, žádný
  vodorovný přesah (`document.documentElement.scrollWidth === 390` na mobilu), 0 pageerror.
- Simulovaná auth zeď (lokální server vracející 401 + `WWW-Authenticate`): panel přejde do
  „Ops API not reachable“ a **polling se zastaví** (2 requesty, pak nic).
- Live po deployi: `/vast-rigs/`, `/vast-rigs/status.json`, `/dashboard/`, `/amenti/`, `/` = 200,
  titulek `Vast.ai rigs · ZION OPS`, konzole bez chyb, desktop i mobil (390×844) bez přesahu,
  pool tab bez regrese (krátké názvy workerů, čitelné hashrate, fee split).

## Poznámka pro provoz

Panely `/vast-ops/*` (AI inference, GPU market, SMOS konzole, fleet agenti) fungují jen s
**HTTP basic auth** uloženou v prohlížeči — operátor se jednou přihlásí na `/vast-ops/` a tím se
odemknou i z `/vast-rigs/`. Anonymní návštěvník dostane vysvětlující stav místo věčného spinneru.
Kdyby se to mělo chovat hezky i pro anonymy, je potřeba na nginxu vrátit u `/vast-ops/api/` 401
**bez** `WWW-Authenticate` (aby prohlížeč nevyskakoval dialog) — to je změna konfigurace EDGE2,
nedělal jsem ji.
