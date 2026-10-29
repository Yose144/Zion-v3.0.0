# AGENTS.md — website-v2.9 (app.zionterranova.com)

Pravidla pro agenty (Devin, Copilot, WARP) pracující na veřejném ZION webu.

> **Služba:** `app.zionterranova.com` — Next.js 16.2.9, běží jako systemd `zion-website.service` na **EDGE2** (`207.180.217.100`, alias `zion-edge2`) — web ingress po cutoveru 2026-10-22. WorkingDirectory `/opt/zion/APP&WEB/website-v2.9`, proxy na `127.0.0.1:3000`.
> **Intro hub:** `zionterranova.com` — statický export projektu `apps/IntroPage` (source `src/app/maintenance.html`), deploy přes `apps/IntroPage/deploy/deploy-intro.sh` do `/var/www/zion-maintenance/`, servírovaný systémovým nginxem (ne Next.js). Legacy kopie `public/maintenance.html` v tomto repozitáři se na apex nepoužívá.
> **OASIS Web:** `oasis.zionterranova.com` — samostatná aplikace v `/var/www/oasis/`.
> **Free World portál:** `freeworld.zionterranova.com` — dedikovaný nginx vhost (repo `infra/nginx/edge2/freeworld.zionterranova.com.conf`) proxy na `127.0.0.1:3000`; `/` mapuje na `/l5-free-world`, cert přes certbot. Portál používá `/api/free-world/[[...path]]` proxy → L5 daemon `127.0.0.1:8095` (GET public; POST jen QV ballots se ZIS session — `voter_id` je server-side `zis:<user.id>`, `X-API-Key` z env `FREE_WORLD_API_KEY`). L5 API jednotky: všechna `*_zion` pole = flowers (1e-6 ZION). Web backup: `/opt/zion/APP&WEB/website-v2.9/.next.bak-20260929T134241Z-l5-portal`.
>
> **Deploy 2026-10-29 — TERRA NOVA READER: SSR + shared docs prose + EN ch12 + audit fixy (LIVE, `a36e791ed`):** `/terranova` čtečka předělaná na dokumentační standard. **SSR:** `ssr:false` + runtime fetch `/terranova-editions.json` → přímý `import editionsJson` (+ lokální `BookChapter`/`Section` typy) → stránka se prerenderuje s plným obsahem aktivní kapitoly (SEO + instant render, žádný loading stav). **Typografie:** chapter body přes `MarkdownDoc` se `className="zion-docs-prose"` — stejná typografie jako `/docs`, `/whitepapers`, archive readery; sekce renderované jako merged markdown (`### heading` + body, dead `.md` nav linky stripnuty `NAV_LINK_LINE_RE`); epigraph přes MarkdownDoc v blockquote. **Hash routing:** `#<chapter-id>` deep-linky (`chapterSlug`), `goTo` → `history.replaceState`, `hashchange` listener. **Titles:** `displayTitle()` stripne duplicitní `Kapitola NN —` prefixy (UI label zvlášť přes `chapterKindLabel`/`chapterGlyph` — Prolog ✦, Přílohy A–D písmena). **JSON data:** kap.12 (Te Piti/Rapa Nui) kompletní **EN překlad 73 sekcí** (dřív CZ kopie v EN slotu), přílohy A–D opravené titleCs/En (D měla citát místo titulu); full-text scan = 0 mojibake / 0 unbalanced `**` / 0 internal paths. **Responsivita:** mobilní sticky bar += prev/next tlačítka (disabled na okrajích), `line-clamp-6` epigraph v sidebaru, `chapterTitle` všude místo raw titles. **Smazáno:** `bookData.ts`, `generatedEditions.ts`, `chapters/` (dead TS duplikáty JSONu), edition-fetch machinery, `visibleBootLines` interval (BOOT_SEQUENCE renderuje vše). Page metadata: canonical + book description. Live ověřeno: `/terranova` 200 = 218 KB SSR HTML s obsahem knihy (`zion-docs-prose` ×5, "Prolog: Issobella" ×5), `/terranova/genesis` 200, app healthy. Zbývá: proofread nového EN překladu kap.12.
>
> **Deploy 2026-10-28 (7) — BOOK SOURCE GATE: `archive-content/` + `/api/archive/docs` (LIVE, `f4e7e7e1b`):** Audit ukázal, že ArchiveLock/pass byl **jen UI-level** — všech ~314 souborů knih se servírovalo jako veřejné `/docs/**/*.md` (gate bypass přímým URL). **Přesunuto mimo `public/`:** 269 souborů → `archive-content/` (books/{maitreya,nirvana,surta-srdce,kralovstvi-srdce} + en/{maitreya,nirvana}, korpus/ 13 book dirů). **Public zůstává** (dle uživatele): Ekam, Kvantová revoluce, Genesis book, TerraNova docs, onboarding, whitepapers, korpus aux (`marketing/`, `mainnet/`, `docs2.9/`, `HUMANITARIAN_TITHE`, `ZION_ONBOARDING_*`). **Nový `GET /api/archive/docs/[...path]`** — `hasArchiveAccess()` gate (stejné 3 cesty jako hub layout), sanitize + jen `.md`, nodejs runtime, multi-cwd ROOT resolution. `docPath` fce v `lib/books/*` → API path (opravilo i rozbitý maitreya `books/zion-archive/kapitoly` path). `gen-doc-manifest.mjs` emituje `files` + `archiveFiles` — korpusChapters/korpusLangs čtou union. `docs-manifest` Books sekce = jen public knihy (genesis/ekam/qr), dead gated hash aliasy smazány. **Deploy script:** kopíruje `archive-content/` → `.next/standalone/` (stejný pattern jako public/ — rsync ROOT_DIR ho přenese i top-level, obě varianty na serveru). Ověřeno live: gated public URL → 307→/docs (obsah nikde), `/api/archive/docs/...` bez pass → **403**, public books/docs → 200, e2e URL aktualizovány. e2e hub suite zůstává skipped (ARCHIVE_LOCKED).

> **Deploy 2026-10-28 (6) — ARCHIVE PASS: ZIS binding + OASIS bonus + entitlement store (LIVE, `3e2224a3c`):** `archive-access.ts` řeší přístup **3 cestami** (pořadí): `code` cookie → `zis-oasis` (ZIS session s linked `oasisPlayer` = OASIS bonus zdarma) → `zis-entitlement` (ZIS session + aktivní record). **Entitlement store** `src/lib/archive-entitlements.ts` — JSON `/opt/zion/data/archive-entitlements.json` (`ARCHIVE_ENTITLEMENTS_PATH`), records `zis:<userId>`→pass s `type: b2b|market|promo`, `org`, `note`, `expiresAt`, `revokedAt`; atomic tmp+fsync+rename+dirfsync (F1.2), corrupt→quarantine, mtime-cache, idempotent grant (stejný subject+type = stejný record). **POST /api/archive/access**: validní kód + ZIS session → auto-bind `b2b` entitlement (`claimedVia:'code'`, `{bound:true}`) — claim přežije rotaci kódu. **GET** = status `{access,via,user?}`. **Admin API `/api/archive/entitlements`** — Bearer `ARCHIVE_ADMIN_TOKEN` (timing-safe, disabled když unset): POST grant (validace `zis:` subject, type, ISO expiresAt), GET list, DELETE revoke → **plumbing pro marketplace purchase flow**. Lock UI: `useAuth` — ZIS login CTA pro OASIS bonus, "Přihlášen jako", "Pass navázán na tvůj ZIS účet", poctivá OASIS copy. EDGE2 env: `ARCHIVE_ADMIN_TOKEN=zaa_…` (jen env soubor), `ARCHIVE_ENTITLEMENTS_PATH`. Live ověřeno: anon status false, admin 401/201, file perzistence, kód flow nedotčen. e2e: status probe + admin 401.
>
> **Deploy 2026-10-28 (5) — ARCHIVE PASS: B2B access-code gate (LIVE, `48d8c843a`):** Operator-issued kódy odemykají celý `/zion-archive` strom — **server-side only**: `src/lib/archive-access.ts` (`isValidPassCode` = sha256+timingSafeEqual proti `ARCHIVE_PASS_CODES` env, `hasArchiveAccess` cookie gate v `zion-archive/layout.tsx`), `POST /api/archive/access` (`src/app/api/archive/access/route.ts`) → `zion_archive_pass` cookie `Secure; HttpOnly; SameSite=lax; Path=/; Max-Age=90d`; `DELETE` smaže. **Revokace = odebrat kód z env** — cookie value se re-validuje proti env při každém requestu. Throttle: per-IP 10 pokusů/min (in-memory, `x-forwarded-for`), 429 `too_many_attempts`; stale-window sweep >1024 IP. UI: bilingual formulář v `ArchiveLock` (invalid/throttled/generic stavy) + marketplace karta na `/market` overview tabu. **Kódy žijí jen v `/etc/zion/website-v31-environment.sh` na EDGE2** (`ARCHIVE_PASS_CODES=code1,code2`, plain `KEY=value` EnvironmentFile formát) — nikdy do repa/client bundle/logů. První produkční kód `ZAP-…` vygenerován na EDGE2 2026-10-28 (operátor čte z env souboru, vydává B2B zákazníkům). Ověřeno lokálně i live: invalid 401, valid 200+cookie, forged cookie→lock, cookie→reader TOC, 429 po ~10 pokusech. Roadmap: marketplace-issued pass (purchase→entitlement), OASIS bonusy, per-org metadata/expiry/audit — kód je základní gate; ZIS binding možné přes `getCurrentUserFromRequest` později.
>
> **Deploy 2026-10-28 (4) — Canon knihovna kompletní: Ruze + KruhBohyni (LIVE, `c6ebcb795`):** `canon/books/` měl 2 nepublikované knihy — **`Ruze`** (samostatná bajka, dřív jen BodhiGaia kap.12) a **`KruhBohyni`** (Kniha Strážkyň, L5+L6). Sanitizováno do `public/docs/korpus/` (vzor: `V31/*`→`interní repozitář`, `zion-*` služby→`* tracker`, `docs/private/`→`interní dokumentace`). Readery `/maitreya/{ruze,kruhbohyni}/cist` + `[slug]` 307 deep-linky. BOOK_NAV: ruze→roots (průsečík Lumi/Miriam), kruhbohyni→horizon (před MiseAmenti). `korpusChapters`: index = jen `README`, ostatní `00-*` = front matter (Prolog/Osnova/Úvod — KruhBohyni má 4× 00-* soubory). Library karty + sitemap + docLinks aktualizovány. **Všech 15 canon/books adresářů má nyní reader v hubu** (+genesis/terranova experience linky = 17 nav položek).
>
> **Deploy 2026-10-28 (4) — ZION ARCHIVE — NIRVANA HUB: canonical `/zion-archive` + coming-soon lock (LIVE, `b51c99157`):** Celý hub strom přejmenován `src/app/maitreya`→`src/app/zion-archive` (routy, library, panely, 17 readerů, hero images). **`/maitreya` + `/maitreya/*` → 301 `/zion-archive`** (deep-link cesty zachovány: `/maitreya/nirvana/cist`→`/zion-archive/nirvana/cist`). **Lock:** `ARCHIVE_LOCKED` v `zion-archive/layout.tsx` — `ArchiveLock` coming-soon stránka renderuje místo všech children (hub + všech 17 readerů); odemčení = flip flagu, všechny panely/readery/deep-linky intaktní. Lock page bilingual: access model karty (**Archive Pass** — placený přístup v přípravě na marketplace, **OASIS bonusy**, **B2B licence** v jednání), teaser 18 knih / 5 skupin z BOOK_NAV, CTA `/market` + `/docs`. Rebrand: metadata+hero 'Zion Archive' s 'Nirvana Hub' subtitle, homepage karta + badge 'Otevírá se brzy', nav label. Všechny interní `/maitreya*` hrefs → `/zion-archive*`; legacy redirecty (cesta/nirvana/cist-surta-kralovstvi legacy readery) retargetovány přímo na `/zion-archive`. Sitemap: jen `/zion-archive` dokud lock. E2E: hub suite skip, nový `zion-archive-lock.spec` (18 lock rout + 301). Live ověřeno: `/zion-archive*` 200+lock render, `/maitreya`→308, karta na homepage.

> **Deploy 2026-10-28 (3) — BookNav na hubu (LIVE, `d98cb42a4`):** `src/components/books/BookNav.tsx` = sdílený knihovní strom extrahovaný z BookReaderu (prop `activeBookId` + `renderActive` slot pro chapter TOC, `expandAll`, `onNavigate`). Hub `/maitreya` sidebar = sekční nav + karta „Knihovna" s `BookNav expandAll` (všechny skupiny otevřené); mobil = `<details>` rozbalovací karta pod section pills. Readery renderují identický strom přes `renderActive` = accent row + part/chapter TOC. Live ověřeno: všech 5 skupin + knihy v SSR HTML.
>
> **Deploy 2026-10-28 (3) — Canon link audit + publikace chybějících korpus docs (LIVE, `9679085e8`):** `korpusChapters` TOC = jen book struktura (README/`00-*`/`NN-*`/`Epilog-*`) — aux docs (Onboarding*, CHANGELOG) linkují přes docs viewer, nejsou kapitoly. Publikováno: chybějící `SulZeme/` (11 onboard docs), celý canon `marketing/` (17), `BodhiGaia/pilots/GENESIS-ROSE-001.md`, `docs2.9/genesis` kniha (16 souborů) — sanitizováno dle public-copy pravidel; manifest 852. Fixy dead links: en whitepaper `legal/*` → publikované soubory, `../v2.9.5/` dir → `README.md`, `MINING_GUIDE`→`mining-guide`, `cs/v2.9.6` `legal/`→`../legal/disclaimer.md`, Miriam book-dir linky → canonical readery. `check-doc-links.mjs` odvozuje book slugs/routy dynamicky (manifest + src/app scan) + cross-book stem match jako `docLinks.ts`. Stav: 3034 resolved, ~370 zbylých dead = záměrné interní repo reference (`3.2/*`, `V3/*`, `*.rs`, `archive/`) renderované muted non-link.

> **Deploy 2026-10-28 (2) — Unified library sidebar + poctivé EN fakty (LIVE, `4341eee03`):** BookReader sidebar/mobilní menu renderuje jeden `renderNav` strom z **`BOOK_NAV`** v `src/lib/books/registry.ts` — 5 skupin (Hlavní knihy / Srdce kompasu / Kořeny a příběh / Země a cesta / Horizont a pravidla), Genesis+TerraNova = experience linky. Skupiny collapsible (default open = skupina aktivní knihy), aktivní kniha = accent row + inline part/chapter TOC, ostatní = Link na reader. `bookNavLabel()` bilingual resolver. **EN/CZ audit:** `korpusLangs()` v `korpus.ts` odvozuje fakt „Jazyky" z reálného `_EN.md` coverage — 0 _EN → `CZ`, dílčí → `CZ (+EN části)`, většinová → `CZ + EN` (žádné false EN claimy; surta/království nemají `en/books/*/kapitoly` vůbec). Deploy smoke OK, live sidebar+fakty ověřeny.
>
> **Deploy 2026-10-28 — Book Reader kanonizace → „Nirvana Hub" (LIVE, `c1eee49fd`):** `/maitreya` hub rebrand na **Nirvana Hub** (hero, metadata, nav label). Jeden shared renderer `src/components/books/BookReader.tsx` (EN→CS fallback) + `src/lib/books/` (chapter data `maitreya/nirvana/surta-srdce/kralovstvi-srdce.ts`, `registry.ts` BookDef, `types.ts`, `singleDoc.ts` parser). **6 kanonických readerů:** `/maitreya/cist` (Maitreya), `/maitreya/nirvana/cist`, `/maitreya/surta-srdce/cist`, `/maitreya/kralovstvi-srdce/cist`, `/maitreya/ekam/cist` (per-part `BOOK-*.md` CZ+EN), `/maitreya/quantum-revolution/cist` (**single-doc** — jeden fetch, `### Kapitola N` → TOC). `/genesis`,`/quantum-revolution`,`/ekam` landings = experience pages (živé). **308:** `/nirvana/cist[/:slug]`→`/maitreya/nirvana/cist[#slug]`, `/surta-srdce[/cist[/:slug]]`, `/kralovstvi-srdce[/cist[/:slug]]`→canonical; canonical `[slug]` stránky → 307 `#slug`. Smazané `src/app/{nirvana,surta-srdce,kralovstvi-srdce}/` routes — md data v `public/docs/` zůstávají. Aktualizováno: library.ts, docLinks BOOK_READERS, docs-manifest, sitemap, MaitreyaSection, Navigation, e2e spec. **Live ověřeno:** 11 cest — všech 6 readerů 200, legacy→308 canonical, hub renderuje „Nirvana Hub". ⚠️ `next build` bez `--webpack` = Turbopack → fail na `fs`/`net` aliasech; vždy `npm run build`.

> **Deploy 2026-10-22 — F3 IA kanonizace: `/market` + `/world` huby (LIVE):** `/market` je nový kanonický Trh hub (přejmenovaný `/multichain`, impl přesunuta `defi/page.tsx`→`market/page.tsx`); `/world` nový vstupní hub vrstev (L3/L4/L5/L6 + TerraNova + Ekam + AI Native, nav skupina "Layers"). Permanentní 308 redirecty live: `/multichain[/:path]`→`/market[/:path]`, `/defi[/:path]`→`/market`, `/bridge`+`/warp`→`/market#bridge`, `/swap`→`/market#swap`, `/dex[/:path]`+`/ziondex`→`/market#dex`, `/roadmap-295`→`/roadmap`, `/wiki`→`/docs`, `/onboard`→`/mining`, `/kompas`→`/terranova`, `/cesta`→`/maitreya#cesta`, `/node-setup`+`/mining/node-setup`→`/mining#node-setup`, `/nirvana`→`/maitreya#nirvana`. Dead in-page redirect stránky smazány (`/kompas`, `/cesta`, `/node-setup`, `/mining/node-setup`, `/nirvana` root — `/nirvana/cist` reader žije). Shared design tokeny `apps/shared/ui` (rasta paleta, `#066928` kanon) napojeny do všech 5 appek. Deploy přes `deploy-web2.9.sh` na EDGE2; live ověřeno 14× 308/200 + smoke (/, hero.webp, favicon, manifest, /api/health). Mapa: `docs/F3-IA-MAP.md`.
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

**Kanonický deploy:** `bash apps/website-v2.9/deploy/deploy-web2.9.sh` — build → kopie `public/` do standalone → rsync na **EDGE2** (`zion-edge2` = `207.180.217.100`, web ingress po cutoveru 2026-10-22) `/opt/zion/APP&WEB/website-v2.9` → `chown zion:zion` → `systemctl restart zion-website` → smoke check. Runbook + ostatní povrchy: `infra/RUNBOOK.md`. Edge (`zion-v6`/`zion-new`) je fallback, deploy tam nemíří.

```bash
# Build (lokálně)
cd apps/website-v2.9 && npm run build

# Manuální deploy (bez skriptu)
rsync -az --delete src .next public package.json next.config.ts tsconfig.json \
  postcss.config.mjs tailwind.config.ts \
  zion-edge2:/opt/zion/APP&WEB/website-v2.9/
ssh zion-edge2 "chown -R zion:zion '/opt/zion/APP&WEB/website-v2.9' && systemctl restart zion-website"
```

⚠️ **`output: "standalone"` — `public/` se servíruje z `.next/standalone/public/`, ne `public/`:** Při hot-file deployi (např. jen změněný markdown v `public/docs/…`) je potřeba soubor zkopírovat na obě místa — `public/…` i `.next/standalone/public/…` — jinak HTTP vrací starý obsah. Plný deploy přes `deploy-web2.9.sh` rsyncuje celý `.next`, takže se to řeší samo.

⚠️ **Nové public soubory = 404 do restartu:** Standalone server drží seznam `public/` souborů z manifestu při startu. **Přepsání** existujícího souboru se projeví okamžitě, ale **nová cesta** vrací Next 404 stránku, dokud se neprovede `systemctl restart zion-website` (hot-deploy nových markdownů → rsync na obě místa + restart).

```bash
# Hot markdown deploy (bez buildu) — příklad
rsync -avzs -e ssh "public/docs/books/maitreya/kapitoly/epilog.md" \
  "zion-edge2:/opt/zion/APP&WEB/website-v2.9/public/docs/books/maitreya/kapitoly/epilog.md"
ssh zion-edge2 "cp '/opt/zion/APP&WEB/website-v2.9/public/docs/books/maitreya/kapitoly/epilog.md' \
  '/opt/zion/APP&WEB/website-v2.9/.next/standalone/public/docs/books/maitreya/kapitoly/epilog.md' \
  && chown zion:zion '/opt/zion/APP&WEB/website-v2.9/.next/standalone/public/docs/books/maitreya/kapitoly/epilog.md'"
```

**Pozor:** `npm install --omit=dev` na EDGE2 vynechá dev dependencies. Pokud `next.config.ts` importuje dev-only balíčky (např. `@next/bundle-analyzer`), je potřeba je doinstalovat na EDGE2: `npm install @next/bundle-analyzer`.

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
