# Apps audit — responzivita, funkčnost, optimalizace, CS/EN

**Datum:** 1. 11. 2026
**Stav:** implementováno a ověřeno; zbývající mezery vypsané v §6
**Rozsah:** `apps/*` (website-v2.9, MarketPlace, nirvana, OasisWeb, pool-ui, IntroPage,
desktop-agent, public-miner, mobile-app, identity, update-server, shared, zion-wallet-sdk)

## 1. Metodika

Statická analýza:

- `tsc --noEmit` pro každou TS aplikaci
- extrakce i18n slovníků (`translations.ts`) a porovnání klíčů CS/EN, hledání
  nepoužitých klíčů a referencí na neexistující klíče
- sken českých stringů v komponentách (odfiltrování legitimních `{cs, en}` párů)
- sken responzivních antipatternů (`grid-cols-N` bez breakpointu, pevné
  `w-[Npx]`, `h-screen`, `whitespace-nowrap`, `<table>` bez `overflow-x`,
  `text-[Npx]` pod 10 px, `target="_blank"` bez `rel`)
- kontrola interních odkazů proti route manifestu

Runtime:

- headless Chrome (Playwright, `channel: chrome`) na 390×844, 768×1024, 1440×900
- 12 route website + 10 route MarketPlace + 4 route nirvana
- měření `scrollWidth - clientWidth`, elementů přetékajících viewport, fontů < 10 px a konzolových chyb

## 2. Výchozí stav (nálezy)

| App | Routes | `tsc` | Horiz. overflow | CS/EN |
|---|---|---|---|---|
| website-v2.9 | 137 + 79 API | ✅ | 0/36 | 389 klíčů kompletní |
| MarketPlace | 25 + 53 API | ✅ | 1 nález | 724 klíčů kompletní, část UI CZ-only |
| nirvana | 15 + 9 API | ✅ | 0/12 | 49 klíčů + manifest kompletní |
| OasisWeb | 11 | ✅ | – | žádné i18n (viz §6) |
| pool-ui | 17 | nelze (bez `node_modules`) | – | kompletní (`t(cs,en)`) |
| IntroPage | 11 | nelze (bez `node_modules`) | – | převážně inline CS/EN |
| desktop-agent / public-miner | Electron | – | – | jednojazyčné, míchá CZ/EN |

Klíčová zjištění:

- **Žádný horizontální overflow** napříč 48 kombinacemi route × viewport kromě
  jediného nálezu (`/ai` na MarketPlace, 83 px).
- Interní odkazy jsou v pořádku — „mrtvé" odkazy z auditu jsou 301 redirecty
  v `next.config` nebo soubory v `public/`.
- Slovníky jsou kompletní: žádný klíč nemá prázdný nebo chybějící překlad;
  „identické cs == en" jsou pouze brandy (ZION, DEX, WARP, OASIS…).
- Mezery byly v **pokrytí** (komponenty se stringy natvrdo), ne ve slovníku.

## 3. Co bylo opraveno

### 3.1 Funkčnost / responzivita

| Soubor | Problém | Fix |
|---|---|---|
| `apps/MarketPlace/src/app/ai/page.tsx` | `<pre>` s dlouhým curl příkladem roztlačil grid (položka gridu má `min-width:auto`) → 83 px overflow na 390 px | `min-w-0` na obou sloupcích |
| `apps/shared/ui/rasta-nav.css` | Navbar přidával na `<body>` třídu `rasta-menu-open`, která nebyla nikde stylovaná → scroll stránky pod otevřeným menu | `body.rasta-menu-open { overflow: hidden }` |
| `apps/OasisWeb/src/components/WorldFilter.tsx` | odkaz na `/downloads/zion-public-miner-v3.0.6-linux-x86_64.AppImage` = **404** | odkaz na `app.zionterranova.com/download` |
| `apps/website-v2.9/src/lib/translations.ts` | `tr()` dělal `entry[lang]` bez kontroly → překlep v klíči = `TypeError` a pád stránky | fail-soft, vrací `section.key` |
| `apps/mobile-app/App.js` | `react-native-safe-area-context` nainstalovaný, ale bez `SafeAreaProvider` → obsah pod notchem / home indikátorem | přidán `SafeAreaProvider` |

### 3.2 CS/EN — právní a FAQ stránky Marketplace

Sedm informačních stránek bylo jen česky a hlavičku měly natvrdo `tr(..., 'cs')`
(10 volání), takže v EN režimu zůstal český nadpis i tělo.

- nová klientská komponenta `apps/MarketPlace/src/components/info/T.tsx`
  (`<T cs=… en=… />`) — obsah zůstává v serverové komponentě, takže funguje
  `export const metadata`, a klient přepíná podle `useLang()`
- `InfoPage` rozšířen o `titleKey` / `subtitleKey` (nadpis ze slovníku)
- přeloženo: `/about`, `/faq`, `/terms`, `/gdpr`, `/legal`, `/shopping-guide`,
  `/reklamace`
- u `/terms` a `/gdpr` je v EN verzi poznámka, že **závazné je české znění**
- `lib/translations.ts` += `info.complaintsTitle` / `info.complaintsSubtitle`

Ověřeno Playwrightem pro 7 stránek × 2 jazyky (H1 i nadpisy sekcí se přepínají).
`next build` prošel, stránky zůstaly staticky prerenderované (971 B každá).

### 3.3 CS/EN — transakční e-maily

- nový `apps/MarketPlace/src/lib/email-lang.ts`
  - `EmailLang = 'cs' | 'en'`
  - rozlišení: `order.lang` → `SHOP_EMAIL_LANG` → `cs`
  - `emailLangFromAcceptLanguage()` pro checkout
- `lib/email.ts` — 6 zákaznických e-mailů plně CS/EN: potvrzení objednávky,
  platba přijata, faktura, token bonus, odeslání zásilky, peněženka (seed).
  Lokalizované jsou předměty i názvy příloh (`faktura-…` / `invoice-…`).
- `lib/v2-email.ts` — celá V2 order confirmation (HTML **i** plaintext),
  `<html lang>` podle jazyka, čísla `cs-CZ` / `en-GB`.
- `api/shop/orders` předává jazyk z `Accept-Language`, takže anglický prohlížeč
  dostane anglické potvrzení.
- admin notifikace zůstává česky (interní).
- `api/email-preview` umí `?lang=en|cs` a nespadne, když není DB (theme fallback).

Ověřeno na obou mutacích (EN: *Order details / Payment information / What
happens next*, CS: *Detaily objednávky / Informace o platbě…*), formát
`1,000 Kč`, datum `01/11/2026`.

### 3.4 A11y, čitelnost, výkon

| Oblast | Změna |
|---|---|
| Čitelnost | 270× `text-[6..9px]` → `text-[10px]` (všechny appky); 460× `text-[10px]` → `text-[11px]` na obsahových stránkách website. Hry (`doge-vs-zion`) a kabalistický diagram (`tree-of-life`) vynechány — pevně pozicovaná grafika |
| `lang` atribut | MarketPlace `<html lang="en">` → `cs` (default UI je čeština) + `suppressHydrationWarning` |
| iOS viewport | drawer website `h-screen` → `h-screen h-dvh` |
| Menu a11y | MarketPlace: `Escape` zavírá, focus trap, návrat focusu na hamburger, zavření při změně routy, `aria-controls` |
| Výkon | `StarfieldCanvas`: pauza při skryté kartě (`visibilitychange`) + respektuje `prefers-reduced-motion` (statický frame místo smyčky) |
| Nirvana | `PassGate` (první obrazovka pro platícího zákazníka) byl jen česky → 12 klíčů v `core/i18n` a plné CS/EN |

## 4. Ověření

| Kontrola | Výsledek |
|---|---|
| `tsc --noEmit` website-v2.9 / MarketPlace / nirvana / OasisWeb | ✅ čisté |
| `next build` MarketPlace | ✅ EXIT=0, info stránky statické |
| Overflow 390/768/1440 po zvětšení fontů (`/market`, `/network`, `/cex`, `/docs`, `/roadmap`) | ✅ 0 přetečení |
| Právní stránky CS/EN (Playwright) | ✅ 7/7 |
| E-mail CS/EN render | ✅ oba jazyky, správný `lang`, formát čísel a dat |

Poznámka k lokálnímu dev prostředí website: `next dev` bez `--webpack` padá na
`zion-wallet-sdk` (lokální `.tgz`); build i `next dev --webpack` fungují.

## 5. Změněné soubory (výběr)

- MarketPlace: `app/{about,faq,terms,gdpr,legal,shopping-guide,reklamace}/page.tsx`,
  `app/{ai,layout}.tsx`, `app/api/{email-preview,shop/orders}/route.ts`,
  `components/{Navbar,StarfieldCanvas,ConnectButton}.tsx`,
  `components/info/{InfoPage,T}.tsx`, `lib/{email,email-lang,v2-email,translations}.ts`
- shared: `ui/rasta-nav.css`
- nirvana: `core/i18n/index.tsx`, `core/shell/PassGate.tsx`
- mobile-app: `App.js`
- website-v2.9: `lib/translations.ts`, `components/Navigation.tsx`, 63 obsahových stránek (font floor)
- IntroPage, OasisWeb: font floor + opravený odkaz

## 6. Zůstává otevřené (mimo zadání nebo vyžaduje rozhodnutí)

1. **Jazyk po-nákupních e-mailů** (platba, odeslání, faktura) se bere z
   `SHOP_EMAIL_LANG` nebo `order.lang`; objednávka v DB nemá uložený locale.
   Pro plně per-order jazyk doporučuji přidat sloupec `locale` do `ShopOrder`
   (migrace na EDGE2) a ukládat ho při vytvoření objednávky.
2. **OasisWeb nemá i18n** (~670 českých stringů v 11 souborech) — vědomě
   vynecháno v této dávce.
3. **Úklid assetů**: `apps/website-v2.9/public` 73 MB, z toho ~43 MB
   pravděpodobně nepoužitých PNG (web servíruje `.webp`); `apps/IntroPage/public`
   466 MB (legacy PDF/STL) — vědomě vynecháno.
4. **Metadata** (`<title>`, description) jsou staticky česká; nelze je
   přepínat klientským přepínačem. Volitelně bilingvní titulky.
5. **Admin UI** MarketPlace je jen česky (interní, pravděpodobně v pořádku).
6. **Zbývající drobnosti**: `Escape`/focus trap v draweru website už existuje;
   marketplace používá `next/image` vypnuté (`unoptimized`) — vědomé rozhodnutí
   kvůli Image Optimization RCE třídě.
