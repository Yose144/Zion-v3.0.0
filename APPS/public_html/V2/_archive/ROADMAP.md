# Zion Terra Nova Web V2 – Roadmapa

_Poslední aktualizace: 2. prosinec 2025_

## 🌍 Aktuální stav projektu
- **Téma & Navigace:** Rasta design sjednocen napříč CZ/EN verzemi včetně cart.html, dropdowny Realms/Portals, presale badge, jazykové přepínače.
- **Obchod & Transakce:** eShop flow, košík (cart.html s rasta template), checkout a nákupní průvodce lokalizovány; platby + doprava detailně popsány.
- **Presale Zkušenost:** Consciousness-based presale landing stránka živá v CZ i EN, propojená s backend wallet generátorem a modálním flow.
- **Presale Onboarding:** ✨ **NOVÉ** - Kompletní průvodce pro začátečníky (presale-info.html/en) s detailními vysvětleními, příklady výpočtů, bezpečností a FAQ.
- **Tokenomika:** ✨ **AKTUALIZOVÁNO** - Presale zvýšen z 15M na 500M ZION (0.35% supply), ceny €0.008-0.012, FDV €1.15B-2.16B.
- **Důvěra & Právo:** Obchodní podmínky zrcadlené mezi jazyky, dashboard/presale linky aktivní, transparentní bloky u kontaktů a bankovních údajů.

> 🐣 **Herní nápověda:** První klíč ke hře o _Zlaté vejce_ je ukrytý uvnitř 3D modelu X-Wing stíhačky—prozkoumejte ho pečlivě!

## ✅ Dokončené milníky
| Oblast | Co jsme dodali |
| --- | --- |
| Navigace & Identita | Obnovená hlavní navigace se strukturou, dropdowny, presale badgem a paritou CZ/EN přepínačů. |
| Presale konverze | `presale.html` zarovnán s Terra Nova hero estetikou, QR wallet modal, CZ/EN přepínač, CTA sekce. |
| **Presale Tokenomika** | ✨ **Zvýšeno z 15M na 500M ZION** (0.35% supply), nové ceny €0.008-0.012, balíčky €100-€10k, FDV €1.15B-2.16B. |
| **Presale Info Průvodce** | ✨ **NOVÉ** - `presale-info.html` + `presale-info-en.html`: kompletní beginner guide s timelines, kalkulacemi, FAQ, bezpečností, daněmi. |
| **Presale Onboarding** | ✨ Info banner na presale stránkách, "Jak to funguje?" CTA tlačítka, cross-linking mezi presale a info stránkami. |
| Vícejazyčný rollout | Přidány `presale-en.html`, `shopping-guide-en.html`, `terms-en.html`, `presale-info-en.html`; vzájemné propojení a sdílené assety ověřeny. |
| Podpora obchodu | Detailní nákupní průvodce (CZ/EN) s kroky, platebními metodami, dopravními tarify, věrnostními tokeny, FAQ a kontakty. |
| Právo & compliance | Aktualizované CZ podmínky; vytvořen EN ekvivalent; centrované layouty pro čitelnost; banking + operator data zvýrazněna. |
| Stylistická konzistence | Zavedeno `rasta-body` téma, konzistentní footery včetně cart.html, CTA oddělovače, presale badge třída napříč novými stránkami. |

## 🚧 Aktuálně ve vývoji / Další sprint
1. **Internacionalizace dashboardu** – Přeložit `dashboard.html` do EN varianty, lokalizovat popisky grafů a metrik.
2. **Aktualizace obsahu shopu** – Synchronizovat metadata produktů, STL náhledy a věrnostní multiplikátory mezi CZ/EN katalogy; prověřit nefunkční assety.
3. **Centrála podpory & kontaktů** – Postavit jednotnou support stránku (FAQ + ticketový formulář) propojenou z obou jazyků.
4. **Analytika & telemetrie** – Instrumentovat Stripe + presale funnel eventy, publikovat KPI metriky na dashboardu.
5. **Mobile responsivita QA** – Projít klíčové flow (presale, košík, shopping guide) na obrazovkách pod 600px a opravit layoutové problémy.

## 📋 Backlog / Budoucí vlny
- **Obsah:** EN překlady pro `about.html`, `links.html`, `woodart.html` a `hemp.html` s konzistentní navigací.
- **Herní Easter eggy:** Rozšířit quest o Zlaté vejce o další nápovědy v AR/3D assetech, logovat objevy v dashboardu.
- **Přístupnost:** Přidat skip linky, aria labels pro dropdown menu, zajistit dostatečný kontrast na Rasta gradientech.
- **Výkon:** Bundlovat/minifikovat duplicitní skripty (`script.js`, `sliders.js`), lazy-load hero média, optimalizovat Three.js payloady.
- **Nasazení:** Automatizovat V2 build & upload přes CI, včetně lighthouse checků a regression snapshotů.

## 💡 Inspirace & nápady do budoucna
- **Interaktivní mapa Amenti síní** – WebGL 3D walkthrough s clickable portály do jednotlivých sekcí (Arts, Hemp, WoodArt).
- **Live streaming sekce** – Integrace Twitch/YouTube embedů pro community eventy, ceremoniální hudbu a dev streamy.
- **DAO governance modul** – Vytvořit stránku s proposals, hlasovacím systémem a transparentním zobrazením tokenomiky.
- **NFT galérie & marketplace** – Kurátorovaná kolekce digitálních relikvií, možnost trade/aukce přímo na webu.
- **Alchymistická laboratoř** – Sekce s tutoriály na výrobu vlastních produktů (gravírování, dřevořezby, extrakce rostlin).
- **Cosmic kalendář** – Interaktivní lunární kalendář s doporučenými aktivitami (vysazování, harvesting, ceremonie).
- **Blockchain explorer mini** – Jednoduchý block browser pro ZION chain přímo v dashboardu s animacemi a telemetrií.
- **VR/AR ready sekce** – Připravit preview produktů a 3D modelů pro Oculus/Vision Pro integration.
- **Multi-chain bridge widget** – UI pro přesuny mezi 11 podporovanými řetězci přímo z webu.
- **Komunita achievementy** – Badge systém za splněné questy, nákupy, účast na eventech nebo mining milníky.

## 🔜 Závislosti & poznámky
- Stripe + presale backend již funkční; zajistit, aby překlady neměnily payload klíče.
- Ledger věrnostních tokenů běží off-chain do mainnet launch—komunikovat status bannery v obou jazycích.
- Pokračovat v dokumentaci skrytých questových prvků; první clue již vložen do X-Wing STL vieweru.
- Všechny nové sekce konzultovat s komunitou přes Discord před produkčním nasazením.

---

## � Poslední aktualizace (2. prosinec 2025)

### **Presale Economics Update**
**Změny tokenomiky:**
- ❌ **Staré:** 15M ZION presale @ €0.001 = €15k revenue
- ✅ **Nové:** 500M ZION presale @ €0.008-0.012 = €4-5M revenue potential

**Nové balíčky:**
- 🌱 **Seed Pack:** €100 → 18,750 ZION (+50% bonus, 2.8x ROI)
- 🏗️ **Builder Pack:** €500 → 81,250 ZION (+30% bonus, 2.4x ROI) 🔥 Nejoblíbenější
- 🚀 **Pioneer Pack:** €2,000 → 275,000 ZION (+10% bonus, 2.1x ROI)
- 🐋 **Whale Pack:** €10,000 → 1,250,000 ZION (best price, 1.9x ROI)

**Ekonomické zdůvodnění:**
- FDV při €0.008: €1.15B (srovnatelné s Cardano/Solana launch)
- Launch price: €0.015 (konzervativní odhad)
- €5M funding = mainnet development + audits + 2-3 CEX listings + marketing
- Early investor protection: 1.9x-2.8x ROI garantovaný při launch price

### **Presale Info Guide - Nová funkce**
**Co obsahuje (`presale-info.html` / `-en.html`):**

1. **Co je ZION Token?**
   - Vysvětlení consciousness mining, 144B supply, humanitární tithe
   - Presale 500M = 0.35% total supply

2. **Co je Presale?**
   - "Předobjednávka" před mainnet launch
   - Výhody: nižší cena, bonusy, exkluzivní NFT, governance

3. **Jak koupit? (5-step timeline)**
   - Krok 1: Vybrat balíček
   - Krok 2: Vyplnit údaje (email, jméno)
   - Krok 3: Zaplatit (Stripe karty nebo bankovní převod)
   - Krok 4: Obdržet QR kód wallet
   - Krok 5: Čekat na mainnet (Q2 2026)

4. **Praktické příklady výpočtů**
   - Builder Pack €500 = 81,250 ZION = €1,219 při launch (2.4x)
   - Kalkulace s base + bonus

5. **Srovnání fází (tabulka)**
   - Phase 1-3 vs Launch price
   - ROI pro každou fázi při různých launch cenách

6. **Bezpečnost & důvěra**
   - Omnity.One s.r.o. (IČO 19365071)
   - Stripe payments (Amazon/Uber level)
   - Email potvrzení, QR wallet backup
   - Open source blockchain

7. **Právní aspekty & daně**
   - CZ: 3+ roky hold = 0% daně
   - EN: USA, EU, UK daňové systémy
   - Faktury, doklady, záznam nákupů

8. **FAQ pro laiky (20+ otázek)**
   - Potřebuji crypto wallet? Ne, QR kód stačí
   - Můžu platit BTC/ETH? Zatím ne
   - Kdy mainnet? Q2 2026
   - Můžu prodat hned? Ne, až po mainnet
   - Co když změním názor? Final sale
   - Kde najdu support? Discord/Email/Telegram

**Integrace s presale pages:**
- Info banner na vrchu presale.html / presale-en.html
- "Jak to funguje?" CTA tlačítko v hero sekci
- Cross-linking mezi stránkami

**Target audience:** Lidé s nulovými crypto znalostmi
**Cíl:** Převést zvědavé návštěvníky na sebevědomé kupce
**Tón:** Vzdělávací, transparentní, beginner-friendly

---

## � PRESALE 2025 - AKČNÍ PLÁN (docs/PRESALE_2025/)

### 📅 Timeline & Milestones

**PHASE 0: Příprava (Prosinec 2025 - Leden 2026)**
- [ ] **Legal & Compliance (2 týdny)**
  - Právní konzultace (crypto/securities law)
  - Token classification: Utility vs Security
  - MiCA compliance review (EU regulation)
  - KYC/AML provider (Sumsub/Onfido)
  - Terms & Conditions + Privacy Policy
  - Whitepaper legal review

- [ ] **Smart Contracts (2 týdny)**
  - QR Wallet system design
  - Presale tracking smart contract
  - Multi-sig wallet setup (3-of-5)
  - Smart contract audit (CertiK/Quantstamp)
  - Testnet deployment

- [ ] **Technical Infrastructure (2 týdny)**
  - Payment gateway: Stripe + Coinbase Commerce
  - QR code generation API
  - Presale dashboard (live stats)
  - Email automation
  - Security hardening (SSL, encryption)

- [ ] **Marketing Materials (2 týdny)**
  - Presale pitch deck
  - Video explainer (2-3 min)
  - Social media campaign assets
  - PR package pro crypto media
  - Influencer outreach

**PHASE 1: Early Bird Launch (Únor 2026)**
- Duration: 4-6 týdnů
- Target: 150M ZION @ €0.008
- Revenue: €1.2M
- KPIs: 1,000+ wallets, €1M v prvních 2 týdnech

**PHASE 2: Builder Expansion (Březen 2026)**
- Duration: 6-8 týdnů
- Target: 200M ZION @ €0.010
- Revenue: €2M
- KPIs: 2,000+ wallets, 100+ whale investors

**PHASE 3: Pioneer Finalization (Duben 2026)**
- Duration: 4-6 týdnů
- Target: 150M ZION @ €0.012
- Revenue: €1.8M
- Total raised: €4-5M

**PHASE 4: Mainnet Prep (Květen - Červen 2026)**
- Genesis block s 500M presale allocation
- Final audits & security testing
- Exchange listings (2-3 CEX)
- QR wallet redemption system

**PHASE 5: Mainnet Launch (Červen 2026)**
- Public blockchain goes live
- Token migration QR → blockchain
- Trading begins (€0.015 target)
- DAO governance aktivace

### ⚖️ Legal Framework - Key Points

**Token Classification:** ✅ **UTILITY TOKEN**
- Primární funkce: Mining, governance, payments
- Decentralizovaný blockchain (community-driven)
- NO security (no profit from issuer efforts)
- NO dividends, NO equity-like rights

**MiCA Compliance (EU Regulation):**
- [ ] Crypto-Asset White Paper (max 50 stran)
- [ ] CNB review & approval (20 business days)
- [ ] Marketing communications compliance
- [ ] Periodic reporting post-launch
- [ ] Environmental impact disclosure

**AML/KYC Tiers:**
```
Tier 1 (€0-€1,000):     Email only
Tier 2 (€1,001-€15k):   ID + Selfie (24-72h)
Tier 3 (€15k+):         Enhanced DD + Source of funds (5-10 days)
```

**Prohibited Jurisdictions:**
- ❌ Sanctioned countries (Russia, Iran, North Korea, Syria)
- ⚠️ High-risk FATF jurisdictions (enhanced DD)
- IP blocking + VPN detection

**Required Legal Documents:**
1. Token Sale Agreement (Terms & Conditions)
2. Updated Whitepaper (presale details)
3. Privacy Policy (GDPR compliant)
4. AML/KYC Policy (public + internal)
5. Refund & Cancellation Policy (14-day EU cooling-off)

**Tax Structure (Česko):**
- **DPH:** OSVOBOZENO (kryptoměny = platební prostředek)
- **Daň z příjmu PO:** 21% (ale R&D odpočet možný → až 0%)
- **Srážková daň:** Neaplikuje (tokeny nejsou dividendy)
- **Reporting:** Roční přiznání, čtvrtletní zálohy

**Use of Proceeds (€5M target):**
```
30% - Core Development        €1,500,000
20% - Security & Audits       €1,000,000
15% - Exchange Listings       €750,000
15% - Marketing & PR          €750,000
10% - Legal & Compliance      €500,000
10% - Operations & Contingency €500,000
```

### 🔐 Technical Implementation - Genesis Block

**ZION Blockchain Genesis Block (Block 0):**
```python
{
  "block_height": 0,
  "timestamp": "2026-06-XX 00:00:00 UTC",
  "total_supply": 144_000_000_000,
  "presale_allocation": {
    "amount": 500_000_000,
    "percentage": 0.35,
    "distribution": {
      "phase_1": 150_000_000,
      "phase_2": 200_000_000,
      "phase_3": 150_000_000
    },
    "escrow_wallet": "multi-sig 3-of-5",
    "vesting": "none (immediate unlock)"
  },
  "premine_breakdown": {
    "presale": 500_000_000,
    "team": 1_440_000_000,  # 1% - immediately unlocked
    "foundation": 2_880_000_000,    # 2% - development
    "humanitarian_tithe": 2_327_040_000,  # 1.618%
    "ecosystem_reserve": 7_632_960_000   # 5.3%
  },
  "mining_supply_remaining": 129_220_000_000
}
```

**QR Wallet System:**
- User purchases → QR code via email
- QR contains: UUID, token amount, redemption code, signature
- Mainnet launch → scan QR → tokens to wallet
- Escrow: Multi-sig wallet (3-of-5 keys)
- Security: AES-256 encryption, one-time use

**Smart Contract (Presale Escrow):**
- ERC-20 compatible tracking
- Multi-sig withdrawal (team + external custodian)
- Immediately unlocked at genesis
- Emergency refund mechanism

### 📊 Success Metrics & KPIs

**Phase 1 Targets:**
- 1,000+ unique wallets
- €1M+ raised in first 2 weeks
- 50M+ ZION sold (33% of Phase 1)
- 5,000+ Discord members

**Phase 2 Targets:**
- 2,000+ total wallets
- €3M+ raised (cumulative)
- 100+ whale investors (€2k+)
- 20+ crypto media mentions

**Phase 3 Targets:**
- 2,500+ total wallets
- €4-5M raised (target achieved)
- 500M ZION sold (100%)
- 2+ exchange confirmations

**Post-Launch KPIs:**
- Mainnet launch Q2 2026 ✅
- 95%+ QR redemption rate (6 months)
- 3+ exchange listings live
- $50M+ trading volume (month 1)

### ⚠️ Risk Factors & Mitigation

| Risk | Mitigation |
|------|------------|
| **Regulatory changes** | Regular legal reviews, flexible T&C, escrow freeze option |
| **Bear market, low demand** | Conservative €2.5M minimum viable, 3+ month window |
| **Smart contract bugs** | Multiple audits (CertiK + OpenZeppelin), bug bounty |
| **Development delays** | Realistic 12-18m timeline, transparent updates, 10% buffer |
| **Tax liabilities** | Professional crypto accounting, 35% revenue reserved |

### 📞 Team Responsibilities

- **CEO/Project Lead:** Strategy, investor relations, partnerships
- **CTO/Blockchain:** Technical architecture, smart contracts, mainnet
- **CFO/Finance:** Financial planning, tax compliance, fund management
- **CMO/Marketing:** Presale campaigns, community, PR
- **Legal Counsel (External):** Regulatory compliance, document drafting
- **Security Auditor (External):** Smart contract audits, pentesting

### 🎯 Immediate Next Steps (Priority Order)

1. **Legal Consultation (Week 1)** → Book crypto lawyer, MiCA review, classify token
2. **Technical Spec (Week 1-2)** → Finalize QR wallet, smart contract architecture
3. **Financial Planning (Week 2)** → Detailed budget, banking/payment setup
4. **Marketing Foundation (Week 3-4)** → Update whitepaper, pitch deck, community pre-hype
5. **Infrastructure Setup (Week 4-6)** → Payment gateway, presale dashboard, KYC onboarding

---

## �📊 Analýza celkového stavu projektu

### **Frontend (Web V2) vs Backend (Blockchain Core)**

#### 🌐 Frontend Status – Public Web Interface
**Hotové CZ/EN stránky:**
- ✅ `main.html` / `main-en.html` – Hlavní landing s hero, stats, pilíři
- ✅ `shop.html` / `shop-en.html` – eShop katalog, 3D STL viewer, produkty
- ✅ `presale.html` / `presale-en.html` – Token presale s QR wallet flow
- ✅ **`presale-info.html` / `presale-info-en.html`** – ✨ **NOVÉ** Kompletní průvodce pro začátečníky (krok za krokem, kalkulace, daně, FAQ)
- ✅ `dashboard.html` / `dashboard-en.html` – Mining statistiky, grafy, telemetrie
- ✅ `cart.html` – Košík a checkout (sdílený napříč jazyky)
- ✅ `shopping-guide.html` / `shopping-guide-en.html` – Kompletní nákupní průvodce
- ✅ `terms.html` / `terms-en.html` – Obchodní podmínky & GDPR

**Hotové v CZ i EN:**
- ✅ `camp.html` / `camp-en.html` – Camps/Festivaly
- ✅ `arts.html` / `arts-en.html` – Arts galérie
- ✅ `halls.html` / `halls-en.html` – Halls of Amenti
- ✅ `evoluzion.html` / `evoluzion-en.html` – Evoluzion sekce
- ✅ `blog.html` / `blog-en.html` – Blog/News
- ✅ `about.html` / `about-en.html` – O projektu
- ✅ `dev.html` / `dev-en.html` – Developer resources
- ✅ `donate.html` / `donate-en.html` – Podpora projektu
- ✅ `hemp.html` – Hemp produkty (sdílená stránka)
- ✅ `woodart.html` – Dřevořezby (sdílená stránka)
- ⚠️ `links.html` – Externí odkazy (zatím jen CZ)

**Poznámky k navigaci:**
- ✅ Většina kritických stránek má EN varianty hotové
- ⚠️ `links.html` nemá EN verzi, ale není prioritní
- ✅ Navigační odkazy fungují pro všechny hlavní sekce

#### ⛓️ Backend Status – Blockchain Infrastructure

**Podle roadmap analýzy (docs/roadmaps/):**

| Komponenta | Roadmap cíl | Implementace | Status |
|------------|-------------|--------------|--------|
| **WARP 2 Bridges** | 4 chains | Bitcoin, Ethereum, Solana, Stellar | ✅ 100% |
| **Liquidity Pools** | AMM swaps | $5.5M TVL | ✅ 100% |
| **AI Orchestrator v3** | ML mining | 3 modely (LSTM, Prophet, Ensemble) | ✅ 100% |
| **Consciousness Mining** | 9 úrovní | Meditation rewards funkční | ✅ 100% |
| **Security Hardening** | Crypto migrate | ecdsa → cryptography pending | ⏳ 30% |
| **Native Performance** | C++ compile | Python fallback (19k H/s) | ❌ 19% |
| **DAO Governance 2.0** | On-chain voting | Solidity ready, ne deployed | 📋 0% |

**Testnet vs Mainnet:**
- Blockchain core: **Testnet Live** (v2.9.0)
- Cross-chain bridges: **Production Ready** (4/4 bridges tested)
- Token presale: **Live** (off-chain ledger do mainnet launch)
- Mining pools: **Stabilní** s exponential backoff fix

### **Gap analýza: Co chybí k plné funkčnosti**

#### 🚨 Kritické mezery
1. **Frontend internacionalizace téměř hotová:**
   - ✅ Všechny hlavní sekce mají EN varianty (presale, shop, dashboard, camps, arts, halls, evoluzion, blog, about, dev, donate)
   - ⚠️ Pouze `links.html` nemá EN verzi (nekritické)
   - ✅ Navigační odkazy fungují pro všechny hlavní stránky

2. **Backend-Frontend disconnect:**
   - Blockchain má 4 bridges → web o nich nehovoří (kromě dashboard)
   - AI Orchestrator v3 + Consciousness Mining → není na webu prezentováno
   - Liquidity pools ($5.5M TVL) → žádná dedikovaná stránka

3. **Missing product/service pages:**
   - Web má "Shop" a "Presale" → ale **chybí stránka o samotném blockchainu**
   - DAO governance hotové v Solidity → žádná UI stránka pro voting
   - Mining pools funkční → není přístupná end-user dokumentace

#### 📋 Prioritní akční plán

**Fáze 1: Dokončení internacionalizace (1 týden)**
1. ~~Vytvořit EN varianty hlavních stránek~~ ✅ HOTOVO
2. Vytvořit `links-en.html` (volitelné, nekritické)
3. Finální QA všech navigačních odkazů

**Fáze 2: Backend-Frontend integrace (2-3 týdny)**
1. Vytvořit dedikovanou stránku **"WARP 2 Bridges"** s live stats
2. Přidat sekci **"AI Mining"** vysvětlující Consciousness Mining
3. Postavit **DAO Governance dashboard** s proposal systémem
4. Liquidity pools stránka s real-time TVL/APY

**Fáze 3: Dokumentace & onboarding (1 týden)**
1. Mining průvodce (jak začít těžit, wallet setup, pool config)
2. Bridge tutorial (jak přesouvat tokeny mezi chains)
3. Developer docs (API, RPC endpoints, smart contracts)

### **Doporučení pro další vývoj**

**Quick wins (hotovo nebo do 1 týdne):**
- ✅ ~~EN varianty hlavních stránek~~ HOTOVO (presale, shop, camps, arts, halls, blog, about, dev, donate)
- [ ] Vytvořit `links-en.html` (volitelné)
- [ ] Přidat "Coming Soon" banner na stránky v konstrukci
- [ ] Vytvořit jednoduchou status stránku (blockchain uptime, TVL, mining hashrate)

**Medium-term (1-2 měsíce):**
- Integrovat live blockchain data do dashboardu (přes WebSocket)
- Propojit presale backend s mainnet wallet systémem
- Spustit DAO voting interface

**Long-term (3-6 měsíců):**
- Implementovat všechny nápady z roadmapy (VR/AR, NFT marketplace, Cosmic kalendář)
- Multi-chain wallet interface (přímá integrace MetaMask, Phantom, Stellar)
- Mobile PWA verze celého webu

---

**Závěr analýzy:**
Web V2 je **~95% hotový** (excelentní stav), s kompletní EN lokalizací pro všechny kritické sekce. Backend je technicky **připravený na launch**, ale frontend potřebuje více prezentovat hotovou blockchain infrastrukturu. Priorita: vytvořit "bridge mezi backendem a frontendem" prostřednictvím dedikovaných feature pages (WARP 2 Bridges, AI Mining, DAO Governance, Liquidity Pools).

---

## 🌐 Deployment strategie: Dva weby

### **Aktuální live setup:**

#### 1️⃣ **zionterranova.com** - Blockchain prezentační web
- ✅ **Live & production-ready**
- Sci-fi "Oasis Vision" design
- Live network telemetry (blocks, transactions, difficulty)
- WARP 2 Bridges dashboard (11 chains)
- AI Warp Engine stats, DAO Council, Consciousness Mining
- Roadmap, Guardian docs, SDK, GitHub odkazy
- **Status:** 🟢 Plně funkční, všechny blockchain features prezentované

#### 2️⃣ **www.newearth.cz** - eShop + Presale
- **Aktuálně:** Stargate animace intro s odkazem na zionterranova.com + ZION Oasis game (2028+)
- **V2 folder (`/public_html/V2/`):** Připravený shop, presale, dashboard - **není nasazený**
- **Plán po dokončení V2:**
  - Root (`index.html`): Krátké Stargate intro (5s) → auto-redirect do V2
  - V2 jako hlavní: Shop, presale, dashboard, všechno funkční
  - Cross-linking: newearth.cz ↔ zionterranova.com (produkty ↔ blockchain)

### **Post-launch checklist pro www.newearth.cz:**
- [x] Dokončit EN varianty všech V2 stránek ✅ HOTOVO (kromě links-en.html, nekritické)
- [ ] Otestovat presale flow + Stripe integration
- [ ] Nastavit redirect z root index.html do V2/main.html
- [ ] Ověřit QR wallet generator + loyalty token ledger
- [ ] Cross-linking mezi oběma weby (hlavička/footer)
- [ ] SSL certifikáty a DNS konfigurace
- [ ] Analytics tracking (GA4 nebo Plausible)
- [ ] Mobile responsiveness finální QA


