# ZION TerraNova — Website Roadmap 2026

**Stav k:** 3. 3. 2026 (aktualizováno)  
**Repo:** `2.9.6-main` / branch `main` · HEAD: `dbd9ba8`  
**Live:** https://zionterranova.com  

---

## Přehled cíle

Cílem je mít plně lokalizovaný, profesionální web připravený pro:
- **MainNet Launch** (cíl: 31. 12. 2026)
- **CoinGecko / CoinMarketCap listingovou registraci** (Q2–Q3 2026)
- **Komunitu** (CZ primárně, EN pro mezinárodní investory)

---

## Aktuální stav (hotovo)

| Co | Stav |
|----|------|
| Homepage v2.9.7 — redesign, CHv4 sekce, CosmicFlowers animace | ✅ `f1e3979` |
| Codename "Pre-MainNet Gate" všude správně | ✅ `043e8e8` |
| Docs stránka — Version Tree (v2.8.x → v2.9.7) | ✅ |
| Historical docs (v2.8.x, v2.9, v2.9.5, v2.9.6) | ✅ |
| Navigation: Mission / Stacks / Knowledge — plně i18n | ✅ `ec30b16` |
| Server Helsinki — Docker deploy, HTTPS | ✅ |
| **translations.ts** — nav + hero button klíče (CZ/EN) | ✅ `ec30b16` |
| **Hero.tsx** — 3 CTA tlačítka přeložena přes `tr()` | ✅ `ec30b16` |
| **Footer.tsx** — tagline přes `tr()`, `use client` | ✅ `ec30b16` |
| **WarpCorridors.tsx** — verze 2.9.7, USA kapitalizace | ✅ `ec30b16` |
| **DocsRail.tsx** — "Fáze 0–5" → "Phases 0–5" (EN fix) | ✅ `ec30b16` |
| **roadmap/layout.tsx** — správná metadata L1–L6 | ✅ `ec30b16` |
| **roadmap/page.tsx** — L2 NCL/L3 DAO layer stack, premine, timeline 2026–2040+ | ✅ `da2f9b3` · `ce92cb9` |
| **bridge/page.tsx** — "L2 NCL — wZION Swap DEX" | ✅ `ce92cb9` |
| **network/warp/explorer/components** — USA kapitalizace všude | ✅ `bdfe51c` |
| **MissionControlDashboard.tsx** — L2 NCL · L3 DAO v timeline | ✅ `bdfe51c` |
| **docs/mainnet, v2.9.7, v2.9.6** — layer labels, USA1/USA2 | ✅ `dbd9ba8` |
| **layer-architecture.md** — L2=2027, L3=2028, L4=2029 | ✅ `c25a7af` |
| **ZION_Whitepaper_v2.9.7.md** — L3 DAO+WARP, roadmap roky | ✅ `3280285` |

---

## PHASE 2 — Docs rozšíření (únor–duben 2026)

### 2.1 Sidebar — nová záložka "Resources"

Vedle **Version Tree** přidat záložku **Resources** se sekcemi:

```
Resources
├── 📄 WhitePaper
│   ├── Whitepaper v2.9.7 (current, EN+CS)
│   ├── Whitepaper v2.9.5 (full, archiv)
│   └── Whitepaper Lite (krátký přehled, CS)
│
├── 🏗️ Architecture
│   ├── 6-Layer Stack (L1–L6 přehled)
│   ├── CHv3 → CHv4 Roadmap
│   └── Network Protocol (P2P, WARP, Bridge)
│
├── 🚀 MainNet Launch
│   ├── Pre-MainNet Checklist (živý stav)
│   ├── MainNet Constitution
│   └── Launch Timeline 2026
│
├── 📊 Listing (CoinGecko / CMC)
│   ├── CoinGecko Checklist
│   ├── Token Info Sheet
│   └── Asset & Logo Guidelines
│
└── ⚖️ Legal
    ├── Disclaimer
    ├── Risk Disclosure
    └── Token Not Security
```

### 2.2 Nové soubory k vytvoření

| Soubor | Obsah |
|--------|-------|
| `public/docs/whitepaper/ZION_Whitepaper_v2.9.7.md` | Whitepaper aktuální verze (EN) |
| `public/docs/architecture/README.md` | 6-Layer Stack overview |
| `public/docs/architecture/consensus.md` | CHv3 → CHv4 |
| `public/docs/mainnet/README.md` | Launch přehled + timeline |
| `public/docs/mainnet/coingecko.md` | CoinGecko submission checklist |
| `public/docs/mainnet/constitution.md` | MainNet Constitution summary |
| `public/docs/legal/disclaimer.md` | Disclaimer (z `/legal/`) |
| `public/docs/legal/risk.md` | Risk disclosure |

---

## PHASE 3 — CZ / EN Lokalizace

### Strategie

**Doporučený přístup:** Language Context + content flags  
(bez nutnosti Next.js i18n rerouting — méně složité, rychlé nasazení)

#### Implementace

1. **`LanguageContext`** (`src/contexts/LanguageContext.tsx`)
   ```tsx
   type Lang = 'cs' | 'en';
   const LanguageContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>(...)
   ```

2. **Language toggle** v navigaci (vlajka CS 🇨🇿 / EN 🇬🇧), persistent v `localStorage`

3. **Docs stránka** — souborová cesta se přizpůsobí:
   - CS: `public/docs/cs/whitepaper.md`
   - EN: `public/docs/en/whitepaper.md`
   - Fallback: aktuální soubor (při chybějícím EN překladu)

4. **Homepage texty** — `Hero.tsx`, `CHv4Upgrade.tsx`, `Features.tsx` dostanou prop `lang` a vrátí odpovídající obsah

#### Priorita stránek dle dopadu

| Stránka | Priorita | Důvod |
|---------|----------|-------|
| Docs → Whitepaper | 🔴 HIGH | CoinGecko vyžaduje EN whitepaper |
| Docs → Architecture | 🔴 HIGH | Technická due diligence investorů |
| Docs → Listing | 🔴 HIGH | Příprava na listing |
| Homepage Hero | 🟠 MEDIUM | První dojem pro EN komunitu |
| Roadmap | 🟠 MEDIUM | Viditelnost vývoje |
| Genesis / Philosophy | 🟡 LOW | Komunita primárně CZ |

#### Fáze lokalizace

```
WEEK 1 — Infrastructure
  - [x] LanguageContext → implementováno jako `useLang()` + `translations.ts`
  - [x] Navigation.tsx: všechny položky přes `tr('nav', key, lang)`
  - [x] Hero.tsx: 3 CTA tlačítka přeložena
  - [x] Footer.tsx: tagline přeložen
  - [ ] Docs page: lang-aware file loading (CS/EN fallback)

WEEK 2–3 — Kritický obsah (EN)
  - [x] Whitepaper v2.9.7 EN — `public/docs/whitepaper/ZION_Whitepaper_v2.9.7.md`
  - [ ] Architecture docs EN
  - [ ] CoinGecko checklist EN

WEEK 4+ — Zbylé stránky
  - [ ] Hero EN texty rozšířit
  - [ ] CHv4Upgrade EN (`improvements` tabulka)
  - [ ] Roadmap stránka EN překlad
```

---

## PHASE 4 — MainNet Launch příprava (Q4 2026)

| Funkce | Popis | Priorita |
|--------|-------|----------|
| Live blockchain explorer | Block/TX search, místo mockup | HIGH |
| Wallet download page | Binaries pro Win/Mac/Linux | HIGH |
| DEX integrace (WARP) | Live bridge / swap widget | MEDIUM |
| DAO voting UI | Návrhy + hlasování on-chain | MEDIUM |
| Staking dashboard | Pool rewards, compound | LOW |
| Mobile app | React Native, základní wallet | LOW |

---

## Navigační struktura — cílový stav

```
Mission
├── Home
├── Dashboard (live stats)
├── Network (node mapa)
└── Roadmap

Stacks  
├── Warp (WARP Protocol · L3 DAO 2028)
├── DAO (L3 ZION DAO · Treasury 4B)
├── Bridge (wZION ↔ ETH · L2 NCL)
├── Pool (mining pool)
├── Mining & Node
└── Download

Knowledge
├── Docs ← hlavní hub (whitepaper, architecture, mainnet, history)
├── Explorer
├── Genesis
├── API Reference
└── Philosophy
```

---

## Metadata / SEO opravy

| Soubor | Co opravit |
|--------|-----------|
| `layout.tsx` title | `On the Star` → `Pre-MainNet Gate` |
| `layout.tsx` description | aktualizovat na v2.9.7 |
| OpenGraph image | dodat HD banner  |
| `robots.txt` | přidat sitemap link |
| `sitemap.xml` | vygenerovat pro /docs/* stránky |

---

## CoinGecko / CMC Požadavky

### CoinGecko Listing Checklist

- [ ] **Whitepaper (EN)** — veřejně přístupný URL
- [ ] **GitHub repo** — public, aktivní commits (< 30 dní)
- [ ] **Block explorer** — funkční, veřejný
- [ ] **Logo** — PNG 200×200, transparentní pozadí
- [ ] **Website** — HTTPS, funkční
- [ ] **Contract/Chain info** — blok čas, supply, algorithm
- [ ] **Social links** — Twitter/X, Telegram, Discord
- [ ] **Max supply** — 144 000 000 000 ZION (jasně uvedeno)
- [ ] **Circulating supply API** — endpoint `/supply` vracející číslo
- [ ] **Team info** — alespoň pseudonymní (nebo doxxed)
- [ ] **Audit** — bezpečnostní audit (máme: 0 findings)

### CMC navíc vyžaduje

- [ ] **Logo 64×64 PNG** + **200×200 PNG**
- [ ] **Popis max 500 znaků** (EN)
- [ ] **One-pager** PDF nebo stránka

---

*Poslední aktualizace: 3. 3. 2026 — ZION TerraNova Dev Team*
