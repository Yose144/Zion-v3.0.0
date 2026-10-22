# F3 — Informační architektura: mapa rout → 7 kanonických sekcí

> Podklad: `docs/ECOSYSTEM-REBUILD-PLAN.md` §1 "Veřejný povrch — sjednocená IA".
> Inventar: 130 `page.tsx` + 77 route handlerů v `apps/website-v2.9` (změřeno 2026-10-22).
> Pravidlo: redirecty se přidávají **jen tam, kde cíl existuje**. `/market` a `/world` ještě neexistují → jejich přesuny jsou naplánované, ne provedené.

## Kanonické sekce (cílový stav)

| Sekce | Prefix | Slučuje |
|---|---|---|
| Síť | `/network` | explorer + pool + monitoring + miner-stats + g8 |
| Těžba | `/mining` | mining/* + download + node-setup + onboard + benchmarks |
| Trh | `/market` *(neexistuje)* | multichain + dex/ziondex/swap/defi/bridge/warp + cex + wallet + market app |
| DAO | `/dao` | dao/* + dashboard/dao-tree |
| Příběh | `/maitreya` | maitreya + nirvana + srdce-knihy + genesis + philosophy + whitepapers + tree-of-life + quantum-revolution + resonance + doge-vs-zion |
| Svět | `/world` *(neexistuje)* | l3-hiran + l4-oasis + l5-free-world + l6-issobella + ekam + ai-native + terranova uzly |
| Docs | `/docs` | docs/* + wiki + api-reference |

---

## Mapa rout → sekce / akce

### Síť (`/network`)

| Route | Stav | Akce |
|---|---|---|
| `/network` | live | **hub sekce** |
| `/explorer` + 23 sub | live | zůstává `/explorer/*` — přeskupit pod Síť v nav; api-docs → viz Docs |
| `/pool`, `/pool/miner/[address]` | live | zůstává; nav pod Síť |
| `/monitoring` | live | → `/network` (nebo `/network#monitoring`) |
| `/miner-stats` | live | → `/network` (miner lookup patří do pool/network povrchu) |
| `/g8` | live | → `/network` (public stability run) |
| `/dashboard` + 9 sub | live | **kde public → `/network`**; `dashboard/private` zůstává za ZIS |

### Těžba (`/mining`)

| Route | Stav | Akce |
|---|---|---|
| `/mining` + guides + node-setup | live | **hub sekce** |
| `/download` | live | → `/mining` (nebo `/mining#download`) |
| `/node-setup` | live | → `/mining/node-setup` |
| `/onboard` | live, sirotek | → `/mining` |
| `/benchmarks` | live | → `/mining` (GPU bench = mining téma) |

### Trh (`/market` — k vytvoření)

| Route | Stav | Akce |
|---|---|---|
| `/multichain` | live | → `/market` (hub; anchor sekce #swap/#bridge/#dex/#earn/#auction se zachovají) |
| `/dex/*` (3), `/ziondex`, `/swap`, `/defi/*` (4), `/bridge`, `/warp` | dead code | už redirect → `/multichain#*`; po vzniku `/market` přepnout cíl |
| `/cex` | live | → `/market#cex` nebo tab |
| `/wallet` | live | rozhodnout: Trh vs top-level utility |
| `/account` | live | ZIS account — top-level, mimo sekce |
| market.zionterranova.com | samostatná Next app | §4 otázka — zatím zůstává, link z `/market` |

### DAO (`/dao`)

| Route | Stav | Akce |
|---|---|---|
| `/dao` + `/dao/proposals/[id]` | live | **hub sekce** |
| `/dashboard/dao-tree` | live | → `/dao` |

### Příběh (`/maitreya`)

| Route | Stav | Akce |
|---|---|---|
| `/maitreya` + `/cist` + `[slug]` | live | **hub sekce** (sekční hub nasazen 2026-10-19: #cesta/#kniha/#nirvana/#plan-v33/#spolecnici/#souvislosti) |
| `/cesta` | code-level redirect | → config redirect `/maitreya#cesta` |
| `/nirvana` + sub | live | → `/maitreya#nirvana` |
| `/kralovstvi-srdce` + `/surta-srdce` (+cist/[slug]) | live | čtečky zůstávají; index → `/maitreya#kniha`/`#spolecnici` |
| `/genesis`, `/philosophy`, `/tree-of-life` | live | → Příběh sekce (hash nebo podstránka) |
| `/whitepapers` | live | → Příběh nebo Docs — **k posouzení** (jsou to technické papíry) |
| `/quantum-revolution`, `/resonance`, `/doge-vs-zion` | live | knihy → `/maitreya#spolecnici` nebo čtečka |
| `/terranova` + 16 sub | live | **k posouzení** — plán má /terranova v Příběh i "terranova uzly" ve Svět |

### Svět (`/world` — k vytvoření)

| Route | Stav | Akce |
|---|---|---|
| `/l5-free-world` | live | → `/world` (L5 portál `freeworld.` proxy sem) |
| `/l4-oasis` | live | → `/world` (landing → odkaz do `oasis.` portálu) |
| `/l3-hiran` | live | → `/world` (L3 AI vrstva) |
| `/l6-issobella` | live | → `/world` |
| `/ekam` + `/ekam/deeksha` | live | → `/world` (existuje i `/terranova/ekam` subsite — **k posouzení**) |
| `/ai-native` | live | → `/world` nebo Docs — **k posouzení** |

### Docs (`/docs`)

| Route | Stav | Akce |
|---|---|---|
| `/docs`, `/docs/[...slug]`, `/docs/view/[...path]` | live | **hub sekce** (Doc Link Engine) |
| `/wiki` | live, sirotek | → `/docs` |
| `/api-reference` | live | → `/docs` (nebo `/docs/api`) |
| `/explorer/api-docs` | live | → `/docs` |

### Mimo sekce (meta / servisní)

| Route | Stav | Akce |
|---|---|---|
| `/` | live | home |
| `/login` | live | ZIS |
| `/team`, `/news` + 2, `/roadmap` | live | meta — footer úroveň |
| `/roadmap-295` | live, sirotek | → `/roadmap` |
| `/admin/*` (4) | live | za ZIS, mimo IA |
| `/kompas` | code-level redirect | → config redirect `/terranova` |
| `/api/*` (74) | live | beze změny |

### Dead code za redirecty (čištění — samostatný krok)

`defi/*` (4 str.), `dex/*` (3 str.), `bridge`, `warp`, `swap`, `ziondex`, `app/health/route.ts` — routy nedosažitelné přes `next.config` permanentní redirecty. Smazat až po stabilizaci redirectů (historie v gitu zůstává).

---

## Redirect tabulka — fáze 1 (cíle existují, provedeno ihned)

| From | To | Typ | Poznámka |
|---|---|---|---|
| `/roadmap-295` | `/roadmap` | 301 | sirotek |
| `/wiki` | `/docs` | 301 | sirotek |
| `/onboard` | `/mining` | 301 | sirotek |
| `/kompas` | `/terranova` | 301 | přesun z in-page redirect |
| `/cesta` | `/maitreya#cesta` | 301 | přesun z in-page redirect |

## Redirect tabulka — fáze 2 (částečně provedeno 2026-10-22, `2ff61b679`)

✅ `/multichain`→`/market` (hub přejmenován; implementace přesunuta `defi/page.tsx`→`market/page.tsx`), retarget `/dex*/ziondex/swap/defi/bridge/warp`→`/market#*`, nav skupina → "Trh/Market".

✅ `/world` hub vytvořen (L3/L4/L5/L6 + TerraNova + Ekam + AI Native, nav + sitemap).

Zbývá rozhodnout/provést: `/cex`→`/market` (stránka má vlastní obsah — open Q), `/download /node-setup→/mining`, `/monitoring /miner-stats /g8→/network`, `/dashboard/*(public)→/network`, `/nirvana→/maitreya#nirvana`, `/api-reference→/docs`, `/dashboard/dao-tree→/dao`.

### Poznámka k /l* a obsahem stránek

`/l3-hiran`, `/l4-oasis`, `/l5-free-world`, `/l6-issobella`, `/ekam`, `/ai-native` **zůstávají živé samostatné stránky** — jejich obsah není ve `/world` (hub jen odkazuje). Redirect `/l*→/world` by obsah smazal; kanonizace tady znamená: `/world` = vstupní bod, l* = obsahové sub-destinace (nav už je seskupuje pod Layers/World). Totéž platí pro `/download`, `/monitoring`, `/miner-stats`, `/g8`, `/cex`, `/nirvana` a `/api-reference` — přímé 301 je možné teprve poté, co cílová sekce jejich obsah skutečně absorbuje (nebo po produktovém rozhodnutí obsah zahodit).

## K posouzení (otevřené)

1. `/terranova` (17 str.) — Příběh vs Svět; plán zmiňuje obojí
2. `/whitepapers` — Příběh vs Docs
3. `/ekam` standalone vs `/terranova/ekam`
4. `/ai-native` — Svět vs Docs
5. `/wallet`, `/account`, `/cex` — Trh vs top-level utility
6. `/team`, `/news`, `/roadmap` — meta úroveň (footer), ne sekce
7. pool.zionterranova.com — redirect na `/network#pool`? (plán §4)
