# REPORT 2026-11-01 — Navigace webu: responzivita + zabalovací podskupiny

> **Stav:** hotové, ověřené lokálně (dev + produkční build) na 13 šířkách.
> **Rozsah:** `apps/website-v2.9` — `src/components/Navigation.tsx`, `src/app/globals.css`.
> **Nenasazeno v době sepsání** — deploy níže.

## 1. Co bylo špatně

Uživatelský nález: „menu už vylétává z obrazovky, podskupiny se nedají zabalit".

| # | Problém | Dopad |
|---|---|---|
| 1 | Dropdown skupiny byl `w-[min(20rem,90vw)]` **bez `max-height`** | skupina „Vrstvy" má 13 chrámů → panel přetekl pod okraj viewportu (13 × ~40 px + hlavička) |
| 2 | Podskupiny (Síť, Přehled trhu, L5 Free World, Strom života) byly **vždy rozbalené** | nedaly se zabalit; dlouhý seznam nešel zkrátit |
| 3 | Textová lišta skupin `hidden xl:flex` | mezi 1024–1279 px (malé notebooky, tablet na šířku) zbyl jen hamburger |
| 4 | Panel skupin se renderoval i při otevřeném mobilním draweru (sdílený stav `openGroup`) | na tabletu se pod drawerem objevoval osiřelý panel |
| 5 | Ikony v hlavní liště měly vždy popisek | v pásmu `xl` tlačilo 6 popisků + logo + pravý cluster na hranu |

## 2. Co je teď

### 2.1 Desktop / notebook (≥1024 px) — „mega" panel

- šířka `min(46rem, 94vw)`, pozice `left-1/2 -translate-x-1/2` pod lištou skupin,
- **výška omezená na `calc(100dvh - 14.5rem)`** + `overflow-y-auto` (`overscroll-contain`) → panel **nikdy nepřeteče**; rezerva ~24 px nad spodní hranou,
- vlastní scrollbar (`.nav-scroll`, tenký zlatý) + **fade indikace** na spodku, ale jen když `scrollHeight > clientHeight` (měřeno v efektu, ne naslepo),
- hlavička panelu v barvě skupiny (rasta akcent, stejná barva jako tečka u pilulky) + tlačítko zavřít,
- **podskupiny jsou zabalovací**: řádek = odkaz na nadřazenou stránku + samostatné tlačítko s chevronem a **počtem položek** (`13`, `6`, `3`), obsah se rozbalí do **2 sloupců** (13 chrámů = 7 řádků),
- automaticky se rozbalí podskupina, ve které se právě nacházíš (`openSub` se dopočítá při otevření skupiny),
- delší seznamy se dělí do **2 sloupců**, ale jen když to nezanechá děru v mřížce (položka s podskupinou zabírá celou šířku; pravidlo: použij 2 sloupce, jen když index „span" položky je sudý) — proto Síť/Trh/Učení 2 sloupce, Vrstvy 1 sloupec.

### 2.2 Breakpointy

| Šířka | Chování |
|---|---|
| `< 1024` | hamburger + drawer (podskupiny zabalovací, badge s počtem) |
| `1024–1279` | lišta skupin **nově vidět** (`lg`), hero ikony skryté, hamburger zůstává (přístup k dashboardu/guardianu) |
| `1280–1535` | lišta + hero ikony **bez popisků** (tooltip na hover) |
| `≥1536` | hero ikony s popisky (`2xl`) |

### 2.3 Mobil

- v draweru jde každá podskupina zabalit samostatným tlačítkem (44×44 px) s počtem položek,
- aktivní podskupina se rozbalí sama,
- drawer má stejný `nav-scroll`,
- tap targety drží ≥44 px i na 320 px.

### 2.4 Opravy chování

- panel se nerenderuje, když je otevřený drawer (`activeGroup && !isOpen`),
- `linkMatches()` nově rozlišuje **hash** (`/market#swap` není aktivní na `/market`); hash se čte až po mountu (`hashchange` listener) → žádný hydration mismatch,
- Escape / click-outside / změna routy zavírají i podskupinu (`openSub` se resetuje spolu se skupinou),
- odstraněn nepoužitý `next/image` import.

## 3. Ověření

**Statické brány**

```
npx tsc --noEmit                     → čisté
npx eslint src/components/Navigation.tsx → 0 errors (jen pre-existing no-img-element warning)
npm run build (next build --webpack) → EXIT 0, 342 stránek
```

**Headless audit (Chrome, Playwright) — 320/360/390/430/768/834/1024/1180/1280/1366/1440/1536/1920 px**

| Metrika | Výsledek |
|---|---|
| horizontální overflow dokumentu (`scrollWidth - clientWidth`) | **0** na všech šířkách |
| ovládací prvky mimo viewport | **0** |
| panel `fitsX` / `fitsY` | **true** všude |
| panel na krátkých viewportem (1024×600, 1280×600, 1440×700, 1536×730) | spodní hrana **−24 px** od okraje |
| focus trap, scroll-lock, Escape, click-outside | beze změny funkční |

Vizuálně zkontrolováno: 4 skupiny (Síť, Trh, Vrstvy, Učení) rozbalené i zabalené, mobil 320/390 drawer se zabalenou i rozbalenou podskupinou, 1920 s popisky ikon.

## 4. Soubory

| Soubor | Změna |
|---|---|
| `apps/website-v2.9/src/components/Navigation.tsx` | přepsané menu (mega panel, zabalovací podskupiny, `lg` breakpoint, fade, oprava dvojího renderu panelu, hash-aware aktivita) |
| `apps/website-v2.9/src/app/globals.css` | `+ .nav-scroll` (tenký zlatý scrollbar pro panel i drawer) |

## 5. Meze (poctivě)

- Panel se otevírá **klikem**, ne hoverem (vědomě — hover menu je na dotykových zařízeních past).
- Šířka panelu je pro všechny skupiny stejná (`46rem`); obsah se přizpůsobuje sloupcům, panel sám „neskakuje".
- `Podskupiny jsou jeden level` — vnořené pod-podskupiny by si vyžádaly změnu datového modelu `NavItem`.
