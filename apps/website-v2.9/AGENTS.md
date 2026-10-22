# AGENTS.md — website-v2.9 (app.zionterranova.com)

Pravidla pro agenty (Devin, Copilot, WARP) pracující na veřejném ZION webu.

> **Služba:** `app.zionterranova.com` — Next.js 16.2.9, běží jako systemd `zion-website.service` na Edge (`62.171.141.136`), WorkingDirectory `/opt/zion/APP&WEB/website-v2.9`, proxy na `127.0.0.1:3000`.
> **Intro hub:** `zionterranova.com` — statický export projektu `apps/IntroPage` (source `src/app/maintenance.html`), deploy přes `apps/IntroPage/deploy/deploy-intro.sh` do `/var/www/zion-maintenance/`, servírovaný systémovým nginxem (ne Next.js). Legacy kopie `public/maintenance.html` v tomto repozitáři se na apex nepoužívá.
> **OASIS Web:** `oasis.zionterranova.com` — samostatná aplikace v `/var/www/oasis/`.
> **Free World portál:** `freeworld.zionterranova.com` — dedikovaný nginx vhost (repo `V31/deploy/nginx/freeworld.zionterranova.com.conf`) proxy na `127.0.0.1:3000`; `/` mapuje na `/l5-free-world`, cert přes certbot. Portál používá `/api/free-world/[[...path]]` proxy → L5 daemon `127.0.0.1:8095` (GET public; POST jen QV ballots se ZIS session — `voter_id` je server-side `zis:<user.id>`, `X-API-Key` z env `FREE_WORLD_API_KEY`). L5 API jednotky: všechna `*_zion` pole = flowers (1e-6 ZION). Web backup: `/opt/zion/APP&WEB/website-v2.9/.next.bak-20260929T134241Z-l5-portal`.
>
> **Deploy 2026-10-19 — Homepage/background/responsiveness performance pass (LIVE):** ⭐ ROOT CAUSE "občas se stránka/pozadí nenačte" = **`src/app/loading.tsx`** — root loading boundary (`<Suspense>` kolem `{children}`) posílala obsah **každé** stránky do `S:0` streamu, reveal jen přes JS `$RC` → bez/při pomalém JS věčný "Loading..." spinner. Odstraněna; Suspense přesunut do segmentů co ho potřebují (`login/loading.tsx`, `explorer/loading.tsx` — kvůli `useSearchParams`). Live `S:N=0`, no-JS h1 painted. Opaque CSS fallback (html `#050505`); ThemeProvider guarded storage; StarfieldBackground — první frame vždy, static mode reduced-motion/saveData; HolographicEarthLazy — statický poster + opt-in 3D, contextlost→poster; HeroSlider — mount jen displayed+pending, swap po decode, visibility-gated autoplay; HomeInteractiveSection lazy-mount widgetů (IO 400px); Navigation — scroll-lock/focus/dup keys; FloatingUtilities z-40 (bg bottom-4, chat bottom-20, safe-area); `@config "../../tailwind.config.ts"` v globals.css — **Tailwind 4 teď skutečně generuje `text-zion-gold`/`text-zion-cyan` utility** (dřív chyběly = šedý text); badge_chv4 public copy; `overflow-x: clip`; odstraněné globální mobile grid/padding hacky; prefetch={false} nav/footer/hero. Měření (localhost standalone, kontrolované API 503): JS −62 % (704→266 KB), obrázky −89 %, mobilní LCP −27 % (5.7→4.2 s); lokální FCP metrika pessimistická (node serializace statiků — produkční nginx servíruje různě). Backup `.next.bak-home-perf-20261019T151545Z`. Deploy rsync standalone+src+public+e2e přes `zion-v6`, restart `zion-website`, live vše 200. Dřívější detailní entry: Opaque CSS fallback (html literal `#050505`, odstraněný inline `background:transparent` + ClientBackgrounds transparent writes); ThemeProvider guarded localStorage (denied storage už nepadá do error boundary, persisted theme se aplikuje v effectu); StarfieldBackground — první frame vždy, static mode pro reduced-motion/saveData, matchMedia+visibility lifecycle; HolographicEarthLazy — statický texturovaný poster + opt-in "Prozkoumat ve 3D" na všech zařízeních, lokální error boundary, onReady/onUnavailable, paralelní optional textury, frameloop never offscreen; HeroSlider — mount jen displayed+pending, swap až po load, autoplay jen při intersection+visible+no-reduce/saveData, pause tlačítko, caption pod obrázkem; HomeInteractiveSection (IO 400px) lazy-mountuje WebTerminal/LiveDashboard/GoldenEgg; Navigation — route-close jen při reálné změně, scroll-lock se zachováním scrollY, dialog aria+fokus trap, dup keys, Maitreya v Learn; FloatingUtilities — bg toggle + chat z-40 (bg bottom/right 1rem, chat bottom 5rem), chat polling jen open+visible; prefetch={false} nav/footer/hero CTA; odstraněné globální mobile grid/padding hacky. Rework: statické home importy (žádný S:0 carrier — H1 viditelné bez JS), @config tailwind.config.ts (zion-gold/cyan utilities aktivní), badge_chv4 public copy, slider visibility/decode-swap/hitbox fixy, EarthLazy bez eager WebGL probu (opt-in only), ThemeContext persist jen v setTheme, nav scroll/focus/key fixy, safe-area floating controls. Build EXIT:0 (181 str), e2e/home-shell 10/10 (EXIT:0, /tmp/home-shell-final.log); build log /tmp/zion-home-candidate2-build.log.
>
> **Deploy 2026-10-19 — /maitreya hub reorganizace (LIVE):** `/maitreya` je teď sekční hub ve stylu `/whitepapers` — kompaktní split hero + sticky desktop sidebar + jeden viditelný panel najednou, mobil má sticky horizontálně skrollovatelnou pill nav (auto-scroll aktivní pill). Šest sekcí se stabilními hashi: `#cesta` (6 hlavních knih + kompaktní kompas), `#kniha` (Maitreya: prolog/5 částí/epilog → `/maitreya/cist#slug`), `#nirvana` (12 epizod ve 3 skupinách + most ep.13, BEZ fake live/building statusů), `#plan-v33` (veřejná podoba Exekuční charty 3.3), `#spolecnici` (linkované doprovodné knihy ze `src/app/maitreya/library.ts`), `#souvislosti` (lore jako `<details>` skupiny). Redirecty `/cesta`→`#cesta` a `/nirvana`→`#nirvana` zůstávají — hashe otevírají správný panel. Sdílený zdroj pravdy pro 3.3: `src/lib/nirvana-roadmap.ts` (`NIRVANA_WORKSTREAMS` — používá i `/roadmap#nirvana`); žádné duplicitní station tabulky. E2E: `e2e/maitreya-hub.spec.ts` (16 testů, system Chrome). Deploy: standalone build (181 stránek) atomicky přes zion-v6, backup `/opt/zion/APP&WEB/website-v2.9/.next.bak-maitreya-20261019T130544Z`; live smoke na app.zionterranova.com = všechny hash panely, redirecty, EN lokalizované linky i mobil 320/390 OK.
>
> **Deploy 2026-10-20 — Doc Link Engine (unifikované odkazy, 738 souborů):** Všechny markdown plochy renderují přes `src/components/docs/MarkdownDoc.tsx` (GFM + GitHub heading ids). Link resolver `src/lib/docLinks.ts` řeší: externí linky, `#kotvy`, `/docs/<slug>` aliasy (`DOC_PATH_ALIASES`), relativní cesty vůči `sourceFile`, docs-root-relativní, unikátní filename a case-insensitive fallback, `../<Book>/` → `korpus/<Book>/`, cross-book kapitoly → `/<kniha>/cist#slug`, `../dao/`+ → app routa (`DIR_ROUTE_MAP`). Nenalezené interní reference se renderují jako **tlumený non-link** (`title="internal reference"`), ne 404. Generický viewer `/docs/view/[...path]` pro každý publikovaný md; `/docs/[...slug]` = alias vrstva. Manifest `src/lib/doc-manifest.json` generuje `scripts/gen-doc-manifest.mjs` (predev+prebuild hook). Audit: `npm run check:links` (strict: `--strict`). Nové redirecty: `/oasis`→`/l4-oasis`, `/health`→`/api/health`, `/pool/stats`→`/api/pool/stats`. Korpus společníků publikován pod `public/docs/korpus/` — **sanitizováno** (systemd/service names, `127.0.0.1` porty, `V31/` cesty, Edge IP nahrazeny neutrálním zněním); `security/SECURITY_DISCLOSURE_2026-07.md` záměrně NEpublikován (interní IP+ops). Při přidávání docs souborů: spustit marker-scan (viz §2 rules) — některé kapitoly obsahují infra tabulky.
>
> **Deploy 2026-09-25 — DAO Parlament / truth-sync:** `/dao` obsahuje VISION Parlament, 144 000 jako symbolický cíl a fail-closed treasury lock UI; web backup je `/opt/zion/APP&WEB/website-v2.9/.next.bak-20260925T152109Z-dao-parliament`. Live chain selector čte `/api/multichain/chains` (aktuálně jen `zion-l1`, `base`). Pozor: `next.config.ts` permanentně přesměrovává `/dex` i `/dex/:path*` na `/multichain#dex`; změny v `src/app/dex/liquidity/page.tsx` proto nejsou veřejně dosažitelné, dokud nebude redirect vědomě změněn.
> **Deploy 2026-10-11 — /api/blocks + pool API key:** Nový server-side route `GET /api/blocks?limit=N` (`src/app/api/blocks/route.ts`) — merged found-blocks feed pro desktop appku: pool `/api/v1/blocks` (ZION bloky, default-deny → vyžaduje `x-api-key`) + `sqm.quantus.com` wormhole rewards (QTC bloky authored native nodem = reward leaves). `ZION_POOL_API_KEY` je nově nastavený v `/etc/zion/edge-environment.sh` (pool) i `/etc/zion/website-v31-environment.sh` (web); `zion-rpc.ts` `poolHttpGet` teď posílá `x-api-key` header — opravuje i existující `/api/v1/miners`/`payouts` proxy volání, která předtím vracela 401. Klíč jen server-side, nikdy do klienta.
> **Deploy 2026-10-08 — /pool QTC tab:** `PoolDashboard` má šestý tab `QTC / Quantus` (`src/components/pool/PoolQtcClient.tsx`, CS+EN) napájený novým server-side proxem `GET /api/qtc` (`src/app/api/qtc/route.ts`, `force-dynamic`, `s-maxage=10`). Route agreguje: lokální Quantus node RPC (`QTC_RPC_URL`, default `127.0.0.1:9944`, jen Safe metody `system_health`/`chain_getHeader`/`system_version`/`system_chain`/`state_getRuntimeVersion`/`state_getStorage`), pool `/stats → auxpow.coin_details[QTU]` (native leg + upstream k1pool + `external_payouts.quantus.pending`), a `sqm.quantus.com` indexer (`QTC_INDEXER_URL`) pro wormhole rewards (`extrinsic_id is null`, leaf_index) + network feed + per-address history. `?addr=qz…` decoduje ss58-189 (base58 + blake2b-512 SS58PRE checksum, prefix byte 189) → `System.Account` storage key (twox128 prefix `26aa…f7` + blake2b-128 concat hash) → free/nonce; wormhole-only adresy bez účtu vrací 0 + valid:true. `QTC_REWARDS_ADDRESS` env defaultuje na aktuální wormhole rewards adresu (veřejný chain údaj, ne secret). UI neobsahuje interní cesty/service názvy. Pozor na deploy: souběžný `rsync --delete` jiné session maže adresáře mid-transfer — po cizím deployi pře-synknout.
>
> **Deploy 2026-10-16 — /pool PRL tab:** Sedmý tab `PRL / Pearl` (`src/components/pool/PoolPrlClient.tsx`, CS+EN, ikona Gem) napájený server-side proxem `GET /api/prl` (`src/app/api/prl/route.ts`, `force-dynamic`, `s-maxage=10`). Route agreguje: lokální `pearld` JSON-RPC (btcd-style basic auth — `PRL_RPC_URL`/`PRL_RPC_USER`/`PRL_RPC_PASS` v `/etc/zion/website-v31-environment.sh`, bak `…bak-prl-*`; RPC jen 127.0.0.1:44107) metody `getblockcount`/`getblockchaininfo`/`getmininginfo`/`getnetworkinfo`, a pool `/stats → auxpow.pearl` (native leg {enabled,job_id,job_age_ms,share_pct} + upstream leg {enabled,connected,job,pending_submits}). UI sekce: KPI strip (live/height/peers/network power/native leg/share %), node card (chain, `pearld` verze parsnutá ze subverze, difficulty, tip, mempool), pool legs card, SRBMiner connect card (`--algorithm pearlhash`, poznámka SM75+/AMD RDNA+ — Pascal nefunkční), network card. Bez wallet lookupu — pearl nemá public indexer. Ověřeno live: `/api/prl` → height 128637, 58.1 EH/s, native job fresh ~2 s.
>
> **Deploy 2026-10-16 — Globální AI chat widget:** `src/components/HiranFloatingChat.tsx` — floating FAB bottom-right (Brain, z-70) → chat panel; mountnutý v root `layout.tsx` (za Footer, uvnitř LanguageProvider). Používá `useLang()`, `usePathname()` hide na `/l3-hiran`+`/ai-native` (embedded chat už tam je), availability probe `GET /api/ai-chat` s 30s repoll. Branding: "Hiranyagarbha" (bez interních verzí/model jmen — i v `HiranMiniChat.tsx` sjednoceno "Hiran v2.2"→"Hiranyagarbha", "zion-expert"→"Hiran model"). SSR: FAB je v HTML na všech stránkách. Pozor na public copy — žádné interní názvy.
>
> **Deploy 2026-10-16 — AI answer quality fix:** Uživatelé reportovali nesmyslné odpovědi — root cause byl RAG korpus na Edge (`/opt/zion/data/l3-rag-docs`), který obsahoval interní dev/lore docs (plány, reporty, MiseAmenti kanon, onboard kronika). Vyměněno za 27 kurátorovaných public docs (kopie z `public/docs/cs`+`/en` + hand-written `HIRANYAGARBHA.md`+`SCOPE.md`); kanonická sada + deploy postup je v repu `V31/L3/ai-native/rag-docs/`, backup původního `l3-rag-docs.bak-internal`. Zároveň: `HIRAN_API_URL=http://127.0.0.1:8003` nově v `/etc/zion/website-v31-environment.sh` → availability probe teď testuje skutečný generační backend (dřív `:8002` standby); `route.ts` odmítá bare echo otázky jako degraded.
>
> **Deploy 2026-09-25 — DAO navigace:** přímé odkazy `/dao` v desktop shortcutu, multichain skupině (`DAO · Governance`) i mobilním menu; web backup je `/opt/zion/APP&WEB/website-v2.9/.next.bak-20260925T184747Z-dao-nav`.

---

## 1. Build & Deploy

```bash
# Build (lokálně)
cd apps/website-v2.9 && npm run build

# Deploy na Edge
rsync -az --delete -e "ssh -i ~/.ssh/zion-edge-post-wipe-2026-07-29" \
  src .next public package.json next.config.ts tsconfig.json \
  postcss.config.mjs tailwind.config.ts \
  zion-new:/opt/zion/APP\&WEB/website-v2.9/

# Oprávnění (pokud rsync zachoval lokální ownera)
ssh -i ~/.ssh/zion-edge-post-wipe-2026-07-29 zion-new \
  "chown -R zion:zion '/opt/zion/APP&WEB/website-v2.9'"

# Restart služby
ssh -i ~/.ssh/zion-edge-post-wipe-2026-07-29 zion-new "systemctl restart zion-website"
```

⚠️ **`output: "standalone"` — `public/` se servíruje z `.next/standalone/public/`, ne `public/`:** Při hot-file deployi (např. jen změněný markdown v `public/docs/…`) je potřeba soubor zkopírovat na obě místa — `public/…` i `.next/standalone/public/…` — jinak HTTP vrací starý obsah. Plný deploy přes `deploy-web2.9.sh` rsyncuje celý `.next`, takže se to řeší samo.

⚠️ **Nové public soubory = 404 do restartu:** Standalone server drží seznam `public/` souborů z manifestu při startu. **Přepsání** existujícího souboru se projeví okamžitě, ale **nová cesta** vrací Next 404 stránku, dokud se neprovede `systemctl restart zion-website` (hot-deploy nových markdownů → rsync na obě místa + restart).

```bash
# Hot markdown deploy (bez buildu) — příklad
rsync -avzs -e ssh "public/docs/books/maitreya/kapitoly/epilog.md" \
  "zion-post-wipe:/opt/zion/APP&WEB/website-v2.9/public/docs/books/maitreya/kapitoly/epilog.md"
ssh zion-post-wipe "cp '/opt/zion/APP&WEB/website-v2.9/public/docs/books/maitreya/kapitoly/epilog.md' \
  '/opt/zion/APP&WEB/website-v2.9/.next/standalone/public/docs/books/maitreya/kapitoly/epilog.md' \
  && chown zion:zion '/opt/zion/APP&WEB/website-v2.9/.next/standalone/public/docs/books/maitreya/kapitoly/epilog.md'"

# Intro hub deploy (jen maintenance.html)
scp -i ~/.ssh/zion-edge-post-wipe-2026-07-29 \
  APP\&WEB/website-v2.9/public/maintenance.html \
  zion-new:/var/www/maintenance/maintenance.html
```

**Pozor:** `npm install --omit=dev` na Edge vynechá dev dependencies. Pokud `next.config.ts` importuje dev-only balíčky (např. `@next/bundle-analyzer`), je potřeba je doinstalovat na Edge: `npm install @next/bundle-analyzer`.

---

## 2. Public Content Rules — CO NEZVEŘEJŇOVAT

Tento web je **veřejný** — vidí ho investoři, uživatelé, novináři, konkurence. Platí stejná pravidla jako pro `public/` subtree (viz root `AGENTS.md` §"Rules for public/ edits").

### Zakázané v public copy (news, download page, banner, intro hub):

1. **Interní architektura** — nezveřejňovat názvy interních engine, modulů, crate názvů, názvy souborů, cesty v kódu. Příklad čeho se vyvarovat:
   - ❌ "Miner běží s Trinity engine v backendu"
   - ❌ "UI ukazuje jen ZION stream"
   - ❌ "backend používá crate AuXpow"
   - ✅ "Miner podporuje GPU i CPU těžbu současně"
   - ✅ "Těžba na jedno kliknutí"

2. **Interní verze a plány** — nezveřejňovat interní milestone kódy (např. "3.0.7 All Green", "3.0.8 Full Stack Stable") pokud nejsou schválené pro public roadmap. Roadmap stránka (`/roadmap`) je source of truth pro veřejné milestone.

3. **Server infrastruktura** — žádné IP adresy (kromě veřejného RPC `62.171.141.136`), interní hostname, SSH porty, cesty na serveru (`/opt/zion/...`), systemd service názvy, Docker image size.

4. **Soukromá data** — žádné privátní klíče, mnemonics, GPG klíče, hesla, API tokeny.

5. **Interní názvy** — `V31`, `V3.1 workspace`, `ZionStart`, `PoC-lab`, `HiranV2.x`, `edge-deploy` jsou interní. V public copy používat pouze veřejné názvy: ZION, Trinity Miner, Desktop Miner, OASIS, ZION Liquidity.

6. **Technické detaily implementace** — nezveřejňovat knihovny použité v kódu (Three.js, framer-motion, atd.) v news článcích. V OASIS článcích lze zmínit vizuální koncept, ale ne interní strukturu kódu.

### Co JE v pořádku v public copy:

- Feature popisy (GUI mining, vestavěná peněženka, dashboard)
- Podporované platformy a formáty (Windows, macOS, Linux, AppImage, DEB, DMG, EXE, ZIP)
- GitHub release linky
- CTA (Stáhni, spusť, těž)
- Veřejné milestone z `/roadmap`
- Ecosystem popisy (L1–L6, OASIS, Marketplace, DeFi, Bridge, DAO)

---

## 3. News Articles (NewsFeed.tsx)

Při psaní novinek do `src/components/NewsFeed.tsx`:

- **Tone:** profesionální, stručný, pro veřejnost. Žádný interní žargon.
- **Struktura:** title (1 věta), summary (2–4 věty), tag, date, href.
- **Neodhalovat:** jak miner funguje interně, jaké crate/engine používá, jaká je interní architektura UI vs backend.
- **Odkaz:** vždy na veřejnou stránku nebo GitHub release.
- **CS + EN:** vždy obě jazyky.

---

## 4. Download Page (download/page.tsx)

- Tlačítka pro dostupné platformy = `zion-button-primary` (zlatý gradient).
- Tlačítka pro nedostupné platformy = `zion-button-secondary` + "Coming Soon" label.
- Nezveřejňovat interní build procesy, cross-compile targety, Cargo feature flagy.

---

## 5. Intro Hub (maintenance.html)

- Statický HTML soubor, neprochází Next.js buildem.
- Deploy = scp přímo na Edge, žádný build potřeba.
- ZION theme design system viz `docs/3.0.3/ZIONTHEME.md` — gold→purple→cyan gradient, rainbow accent per karta, glow shadows.
- Footer menu: 5 sloupců s per-column accent bar (Cyan, Amber, Emerald, Teal, Pink).

---

## 6. ZION Theme (design reference)

Viz `docs/3.0.3/ZIONTHEME.md` pro kompletní design system:
- Core colors: Gold `#ffd700`, Purple `#9333ea`, Cyan `#06b6d4`, Blue `#1e3a8a`
- Komponenty: `.zion-rainbow-card`, `.zion-section`, `.zion-button-primary`, `.zion-kicker`, `.zion-cta-banner`
- Per-card accent přes `--rc` CSS variable (RGB triplet)
- Radius MD `1.2rem` (buttons), Radius LG `1.65rem` (panels)
- Shadow glow: `0 0 42px rgba(147,51,234,0.28)`

---

## 7. Verification před deploy

Před nasazením na Edge vždy:
1. `npm run build` — musí projít bez chyb (106 static pages)
2. Zkontrolovat, že v upraveném copy nejsou interní detaily (viz §2)
3. Po deploy ověřit: `curl -s -o /dev/null -w '%{http_code}' https://app.zionterranova.com/<page>` = 200
4. Pro intro hub: `curl -s -o /dev/null -w '%{http_code}' https://zionterranova.com/` = 200
