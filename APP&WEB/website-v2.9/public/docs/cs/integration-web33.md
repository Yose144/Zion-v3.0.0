# Integrace Web3.3 a další plány

Strategický dokument popisující současnou architekturu, integrační toky a rozvojovou roadmapu pro verzi web3.3 platformy ZION TerraNova.

> **Mapování roadmapy**: Tento plán je synchronizovaný s dokumenty `ROADMAP.md` (master roadmap 2025-2030), `ROADMAP_2.8.6-2.8.9.md` (pipeline stabilizace → polish) a `ROADMAP_v2.9.0.md` (Quantum Leap). Všechny milníky jsou označené podle těchto zdrojů.

## Architektonický přehled

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS v4, komponenty pro dynamické pozadí (Starfield, MeteorShower, BubbleOverlay, ThemePanel).
- **Obsahová vrstva**: Markdown renderer (`react-markdown`, `remark-gfm`) s aliasy na whitepaper, ukládání v `content/docs/**` a `content/whitepaper/**`.
- **Dokumentace**: Dynamická navigace (`MDXLayout`) s bočním panelem, generování tras `/docs/[...slug]` přes `getMarkdownContent`.
- **DevOps**: `npm run lint`, `npm run build`, `npm run dev`; nasazení plánováno na Vercel + CDN, statický export pro cache.

## Zarovnání s globální roadmapou

- **Q4 2025 (Roadmap 2.8.6–2.8.9)**: Web3.3 front-end běží paralelně s bugfix/performance/feature/polish cyklem backendu. Klíčové je dokončit stabilizační úkoly (2.8.6) a performance optimalizace (2.8.7), aby dashboard a dokumentace stály na spolehlivých API.
- **Q1 2026 (Roadmap v2.9.0 “Quantum Leap”)**: Security hardening, Solana/Stellar bridge a multi-sig peněženky se promítnou do integračních sekcí (SDK, tutoriály, dashboard). Web3.3 musí poskytovat návody a UI hooky pro nová API.
- **Q2–Q4 2026 (Master Roadmap)**: Dashboard a dokumentace postupně reflektují humanitární mosty (Stellar), Cardano/Tron integrace, mobile wallet release a přípravu na mainnet.

### Mapování iniciativ

| Web3.3 komponenta | Roadmap reference | Poznámka |
| --- | --- | --- |
| `/docs` markdown pipeline | `ROADMAP_2.8.6-2.8.9` (Dokumentace overhaul) | Plní se během v2.8.9 “Polish”. |
| Tutorials (First dApp, další) | `ROADMAP_v2.9.0` Phase 5.3 Developer Grants | Tutoriály podporují růst developer komunity. |
| Dashboard metriky | `ROADMAP.md` Q1 2026 Security & Bridge, Q2 2026 Testnet v3.0 | Dashboard zobrazí bridge throughput, testnet KPI. |
| Theme/visual effects | Brand kontinuum (ROADMAP master) | Zajišťuje konzistentní UX pro marketingové kampaně. |

## Integrační toky

1. **Synchronizace dokumentace**
   - Kopíruj upstream markdown z repozitářů `Zion-2.8.5/docs` a whitepaperu.
   - Aktualizuj aliasy v `src/lib/getMarkdownContent.ts` pro nové mapování.
   - Přidej odkazy do `NAV_STRUCTURE` a `content/docs/index.md`.

2. **Vizualizační komponenty**
   - `Starfield`, `MeteorShower`, `BubbleOverlay`, `ThemePanel` mají vlastní toggly v landing page.
   - Integrace vyžaduje ověření výkonu (FPS profiling, `requestAnimationFrame` throttling na mobilu).

3. **API & SDK napojení**
   - Připrav klientský modul `@zion-terranova/sdk` s lazy-loadingem (dynamic import) pro interaktivní příklady.
   - V tutorials sekci využij backend API layer (`express`, `ZionSDK`) jako referenci.

4. **Dashboard koncept**
   - Nový route `/dashboard` (Work-in-progress) slouží k vizualizaci metrik TestNetu.
   - Plánované moduly: stav těžby (hashrate, validátoři), governance (hlasování), akadémie.

5. **Internationalizace**
   - Smíšený CZ/EN obsah; budoucí integrace i18n (Next.js `app/[lang]/`) s fallbackem.

## Postup implementace integrace

1. **Lokální příprava**
   - `git pull origin 2.8.6`
   - `npm install`
   - `npm run lint && npm run build` pro baseline.

2. **Obsahová synchronizace**
   - Automatizuj skriptem (`scripts/sync-docs.ts`) kopírování z `ZION_2.8.5` repa do `content/docs`.
   - Přidej test `npm run test:docs` validující existenci odkazovaných souborů.

3. **Komponenty & layout**
   - Dokumentuj props u vizuálních komponent (JSDoc) pro jednodušší integraci do dashboardu.
   - Připrav theme panel API (`ThemePanelContext`) pro sdílenou integraci napříč pages.

4. **CI/CD**
   - Github Actions: lint + build + link-check (`lychee`) na PR.
   - Vercel Preview: environment secrets pro whitepaper aliasy, toggle `NODE_OPTIONS=--max_old_space_size=4096`.

5. **Monitoring & zpětná vazba**
   - Integruj Vercel Analytics + Log sniffer.
   - Zaveď feedback widget v docs (`/docs/feedback`) s webhookem na Discord `#zion-docs`.

## Bezpečnostní a provozní opatření

- Audit přístupových klíčů (`public_html/ai.key`, `git.key`) – přesun do `.env` + `.gitignore`.
- Rate limiting pro API návody (Express `rate-limiter-flexible`).
- CSP hlavičky (`next.config.ts`) omezující externí zdroje na CDN list.
- Pravidelné SAST (CodeQL) a záplaty npm balíčků (`npm audit fix --force` jen po kontrole).

## Testovací strategie

- **Jednotkové testy**: React Testing Library pro komponenty (ThemePanel, MarkdownRenderer).
- **Integrace**: E2E (Playwright) pokrývající docs navigaci, vyhledání, tutorial flow.
- **Výkon**: Lighthouse CI (95+ skóre pro LCP, FID).
- **Obsah**: Markdown link checker (všechny interní odkazy).

## Roadmapa Web3.3 sladěná s core vydáními

### Q4 2025 – Release vlna 2.8.6 → 2.8.9

- **v2.8.6 “Stability”**: Udržet docs web bez chyb při změnách docker stacku; ověřit health-checky pro API, na které se dashboard napojí.
- **v2.8.7 “Performance”**: Připravit caching vrstvy v UI (SWR, React Query) napojené na backend redis cache; Lighthouse performance bench pro landing.
- **v2.8.8 “Features”**: Integrovat WebSocket API do dashboardu (Mission Control page nyní dostupná na `/dashboard`); přidat interaktivní ukázky do tutoriálů.
- **v2.8.9 “Polish”**: Zapracovat nový README, troubleshooting a API docs přímo do web3.3; dokončit E2E testy navigace a feedback loop.

### Q1 2026 – v2.9.0 “Quantum Leap”

- Security sekce dokumentace (hardware wallets, multi-sig) navázaná na Phase 1 roadmapy.
- Tutoriály pro Solana/Stellar bridge (Phase 3) + integrace do dashboard modulů.
- Přidání AI Orchestrator a Consciousness Mining widgetů podle Phase 4.

### Q2–Q4 2026 – Příprava na hlavní roadmapu

- Testnet v3.0: Web3.3 dashboard zobrazí KPIs (uptime, block propagation, bridge volume) v návaznosti na master roadmap Q2 2026.
- Multi-chain rozšíření: modulární přepínač pro Cardano/Tron/Trezor release (Q3–Q4 2026).
- Komunitní růst: docs gamifikace a DAO onboarding, jak stanovuje master roadmap.

## Milníky

| Milník | Datum | Kritéria dokončení |
| --- | --- | --- |
| Web3.3 Beta (navázáno na v2.8.9) | 15. prosince 2025 | Dashboard MVP, 3 tutoriály, build bez chyb |
| Web3.3 GA (po v2.9.0 RC) | 31. ledna 2026 | i18n připraveno, CI/CD plně automatické, docs coverage > 95% |
| Web3.4 Preview (Q2 roadmap) | duben 2026 | Live data feed, personalizované widgety |

## Doporučené další kroky

1. Finalizuj `/dashboard` route podle roadmapy.
2. Automatizuj synchronizaci dokumentace a validaci odkazů.
3. Připrav onboarding kit pro komunitu (video walkthrough + reference projekty).
4. Naplánuj bezpečnostní review pro public release.

---

Tento dokument se aktualizuje po každém sprint review, minimálně jednou za čtrnáct dní.
