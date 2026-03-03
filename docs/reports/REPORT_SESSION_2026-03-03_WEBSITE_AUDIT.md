# Session Report — 2026-03-03 — Website CZ/EN Audit + Layer Fix

**Datum:** 3. března 2026  
**Branch:** `main`  
**Commity této session:** `c25a7af` · `3280285` · `b479b6d` · `ec30b16` · `da2f9b3` · `ce92cb9` · `bdfe51c` · `ae6f390` · `dbd9ba8` · `08dd3c3`  
**Server:** `root@77.42.31.72` — `zion-website Up (healthy)` · HTTP 200 ✅

---

## Souhrn session

Systematický audit celého webu `zionterranova.com` — stránka po stránce, komponenta po komponentě. Cíl: sjednotit všechny reference na 6-vrstvou architekturu, opravit překlepy a nekonzistence CZ/EN, zajistit kompletní i18n pokrytí.

**Celkový počet opravených souborů: 20**  
**Kategorie nálezů:**
1. Špatné layer názvy / roky (L2/L3 prohozeny, L4 špatný rok)
2. "Usa" místo "USA" — na 10+ místech v kódu
3. Chybějící i18n — hardcoded EN texty v navigaci, Hero, Footer
4. Nekonzistentní layer labels v docs markdown souborech
5. Syntax error v layout.tsx (dvojitá čárka → build failure)

---

## Kanonická 6-vrstvá architektura (ground truth = root README.md)

| Vrstva | Název | Rok | Klíčové info |
|--------|-------|-----|-------------|
| L1 | ⛏️ ZION TerraNova | 2026 | PoW, CHv3/CHv4, 144B supply |
| L2 | 🧠 NCL — Neural Conscious Layer | 2027 | AI-native, wZION bridge |
| L3 | 🏛️ ZION DAO | 2028 | Governance, Treasury 4B ZION |
| L4 | 🎮 ZION Oasis | 2029 | Golden Egg, XP economy |
| L5 | 🌍 ZION Free World | 2030 | Humanitarian, free energy |
| L6 | 🔭 ZION Issobella | 2040+ | Orbital observatory, LEO |

---

## 1. Dokumentace — Layer roky (`c25a7af`)

**Soubor:** `public/docs/v2.9.6/layer-architecture.md`

Předchozí stav měl L2/L3 prohozeny a L4 rok špatně:

| Layer | Bylo | Správně |
|-------|------|---------|
| L2 NCL | 2028 | 2027 |
| L3 DAO | 2027 | 2028 |
| L4 Oasis | 2026 "genesis ready" | 2029 |

---

## 2. Whitepaper v2.9.7 — Layer opravy (`3280285`)

**Soubor:** `public/docs/whitepaper/ZION_Whitepaper_v2.9.7.md`

- Abstract: "L6 Governance" → správný 6-layer popis (L6 = Issobella)
- "L3 — WARP Protocol" → "L3 — ZION DAO & WARP Protocol"
- Roadmap: opraveny roky L2/L3/L4/L5/L6

---

## 3. RoadmapPulse — v2.9.7 + 6-vrstvý timeline (`b479b6d`)

**Soubor:** `src/components/RoadmapPulse.tsx`

- Verze `2.9.6` → `2.9.7`
- 3 nové phase karty s reálným obsahem
- Timeline sekce: 4 generické položky → 6-vrstvý grid (L1–L6) se správnými roky
- Heading: "6-Layer Vision / On the Star — 100 let ke hvězdám"

---

## 4. i18n batch — Navigation, Hero, Footer, minor components (`ec30b16`)

### `src/lib/translations.ts`
Přidány chybějící klíče:
- Nav: `dashboard`, `warp`, `dao`, `bridge`, `pool`, `philosophy`, `ai_native`
- Hero buttons: `btn_warp`, `btn_guardian_docs`, `btn_native_miner`
- Footer: `tagline`

### `src/components/Navigation.tsx`
`navGroups` přesunuto dovnitř komponenty (po `useLang()`), všechny labely přes `tr('nav', key, lang)`.

### `src/components/Hero.tsx`
3 CTA tlačítka: hardcoded EN → `tr('hero', 'btn_*', lang)`.

### `src/components/Footer.tsx`
Přidáno `'use client'`, `useLang()`, tagline přes `tr()`.

### `src/components/WarpCorridors.tsx`
- "On the Star **2.9.6**" → "**2.9.7**"
- "**Usa**" → "**USA**" v node listu

### `src/app/roadmap/layout.tsx`
Metadata description: správné L1–L6 názvy a roky.

### `src/components/DocsRail.tsx`
"**Fáze** 0–5" → "**Phases** 0–5" (CZ slovo v EN kontextu)

---

## 5. roadmap/page.tsx — Kompletní layer + premine fix (`da2f9b3` · `ce92cb9`)

**Soubor:** `src/app/roadmap/page.tsx`

### layer stack
```
Bylo:   L2 = "DEX & DeFi"        L3 = "Warp & AI Native"
Správně: L2 = "NCL — Neural Conscious Layer (2027)"  L3 = "ZION DAO (2028)"
```

### L5 popis
Přepis: governance texty → humanitární mise + volná energie (canonical L5 = Free World).

### Premine čísla
| Položka | Bylo | Správně |
|---------|------|---------|
| Infrastructure | 2.5B / 15.4% | 2.59B / 15.9% |
| Humanitarian | 1.53B / 9.4% | 1.44B / 8.8% |

### componentStatus
`"warp/ (L3 multichain)"` → `"warp/ (L2 NCL multichain)"`

### Timeline header
`"Master Timeline 2026 – 2028"` → `"Master Timeline 2026 – 2040+"` (L6 Issobella je 2040+)

### Timeline vizuál
- L2: "DEX/DeFi" → "NCL · 2027 · Neural Conscious Layer"
- L3: "Warp/AI" → "ZION DAO · 2028 · Treasury 4B ZION"
- L5: "Governance · Sovereignty" → "Humanitární mise · Volná energie"

---

## 6. bridge/page.tsx — L2 label (`ce92cb9`)

`"L2 DEX — swap wZION"` → `"L2 NCL — wZION Swap DEX"`

---

## 7. USA kapitalizace — batch fix (`bdfe51c`)

Nalezeno "Usa" na **10 místech** v 6 souborech. Opraveno vše na "USA":

| Soubor | Výskyty |
|--------|---------|
| `src/app/network/page.tsx` | 4× (node title, RPC label, P2P label, hero text) |
| `src/app/warp/page.tsx` | 1× (Guardian Nodes detail) |
| `src/app/explorer/page.tsx` | 1× (node connectivity text) |
| `src/components/DashboardClient.tsx` | 1× (bullets popis) |
| `src/components/LiveDashboard.tsx` | 1× (seed nodes text) |
| `src/components/MissionControlDashboard.tsx` | 1× (ServerCard name) + L2/L3 timeline fix |

### MissionControlDashboard.tsx — timeline layers
```
Bylo:   L2 DEX / DeFi  · 2026 Q1–Q2
        L3 Warp / AI   · 2026 Q1–Q2
        L1 Blockchain  · Fáze 0 → 1 → 2–4

Správně: L2 NCL / Neural Conscious · 2027
         L3 ZION DAO                · 2028
         L1 Blockchain              · Phase 0 → 1 → 2–4 → MainNet
```

---

## 8. Syntax error fix — build failure (`ae6f390`)

**Soubor:** `src/app/roadmap/layout.tsx` — řádek 5

Dvojitá čárka způsobila Docker build failure:
```
description: '...',,   ← syntax error
```
Opraveno na:
```
description: '...',
```

Tato chyba zastavila celý Docker build. Opravena okamžitě po detekci z `/tmp/build.log`.

---

## 9. Docs markdown — layer labels + node names (`dbd9ba8`)

| Soubor | Oprava |
|--------|--------|
| `public/docs/mainnet/README.md` | "L2 DEX live" → "L2 NCL / wZION Bridge live" |
| `public/docs/v2.9.7/mainnet-gate.md` | "L3 Warp / AI ⏳" → "L3 ZION DAO / WARP ⏳" |
| `public/docs/v2.9.6/p2p.md` | "Usa1/Usa2" → "USA1/USA2" v node tabulce |

---

## 10. WEBSITE_ROADMAP_2026 — aktualizace (`08dd3c3`)

**Soubor:** `docs/WEBSITE_ROADMAP_2026.md`

- HEAD commit aktualizován na `dbd9ba8`
- "Aktuální stav" tabulka rozšířena o 13 nových řádků se session commity
- Phase 3 checkboxy: splněné označeny ✅ (useLang, Navigation, Hero, Footer, WP v2.9.7)
- Navigační struktura: Warp/Bridge/DAO doplněny správnými layer referencemi

---

## Deploy status

```
Container: zion-website Up (healthy)
HTTP:      200 OK
Server:    77.42.31.72 (Helsinki)
Build:     Docker compose up --build — SUCCESS
```

Všechny opravené soubory SCP'd na server před rebuild:
- `src/app/bridge/page.tsx` ✅
- `src/app/roadmap/page.tsx` ✅
- `src/app/roadmap/layout.tsx` ✅
- `src/app/network/page.tsx` ✅
- `src/app/warp/page.tsx` ✅
- `src/app/explorer/page.tsx` ✅
- `src/components/DashboardClient.tsx` ✅
- `src/components/LiveDashboard.tsx` ✅
- `src/components/MissionControlDashboard.tsx` ✅
- `public/docs/mainnet/README.md` ✅
- `public/docs/v2.9.7/mainnet-gate.md` ✅
- `public/docs/v2.9.6/p2p.md` ✅

---

## Zbývající TODO (příští session)

| Položka | Priorita | Poznámka |
|---------|----------|----------|
| Docs page: lang-aware file loading (CS/EN fallback) | 🔴 HIGH | Základ pro CoinGecko EN docs |
| `CHv4Upgrade.tsx` — `improvements` tabulka EN | 🟠 MEDIUM | Technické specs hardcoded |
| Architecture docs EN (`public/docs/architecture/`) | 🔴 HIGH | Due diligence investorů |
| CoinGecko checklist EN aktualizace | 🔴 HIGH | Listing příprava |
| OpenGraph HD banner | 🟠 MEDIUM | SEO + sociální sdílení |
| `sitemap.xml` pro `/docs/*` | 🟡 LOW | SEO |
| Wallet download page — reálné binaries | 🔴 HIGH | CoinGecko requirement |

---

*Vygenerováno: 3. 3. 2026 — ZION TerraNova Dev Session*
