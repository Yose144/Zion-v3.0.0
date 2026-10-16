# AGENTS.md — website-v2.9 (app.zionterranova.com)

Pravidla pro agenty (Devin, Copilot, WARP) pracující na veřejném ZION webu.

> **Služba:** `app.zionterranova.com` — Next.js 16.2.9, běží jako systemd `zion-website.service` na Edge (`62.171.141.136`), WorkingDirectory `/opt/zion/APP&WEB/website-v2.9`, proxy na `127.0.0.1:3000`.
> **Intro hub:** `zionterranova.com` — statický export projektu `APP&WEB/IntroPage` (source `src/app/maintenance.html`), deploy přes `APP&WEB/IntroPage/deploy/deploy-intro.sh` do `/var/www/zion-maintenance/`, servírovaný systémovým nginxem (ne Next.js). Legacy kopie `public/maintenance.html` v tomto repozitáři se na apex nepoužívá.
> **OASIS Web:** `oasis.zionterranova.com` — samostatná aplikace v `/var/www/oasis/`.
> **Free World portál:** `freeworld.zionterranova.com` — dedikovaný nginx vhost (repo `V31/deploy/nginx/freeworld.zionterranova.com.conf`) proxy na `127.0.0.1:3000`; `/` mapuje na `/l5-free-world`, cert přes certbot. Portál používá `/api/free-world/[[...path]]` proxy → L5 daemon `127.0.0.1:8095` (GET public; POST jen QV ballots se ZIS session — `voter_id` je server-side `zis:<user.id>`, `X-API-Key` z env `FREE_WORLD_API_KEY`). L5 API jednotky: všechna `*_zion` pole = flowers (1e-6 ZION). Web backup: `/opt/zion/APP&WEB/website-v2.9/.next.bak-20260929T134241Z-l5-portal`.
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
cd APP&WEB/website-v2.9 && npm run build

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
