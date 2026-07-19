# Explorer V4 Deploy Report — 2026-07-19

> **Session:** Audit + deploy V4 Explorer na live mainnet
> **Operátor:** Devin (GLM-5.2 High)
> **Datum:** 2026-07-19
> **Trvání:** ~30 min
> **Výsledek:** ✅ V4 Explorer nasazen a živý, Phase 4 polish dokončen

---

## 1. Východisko

Uživatel reportoval: "https://zionterranova.com/explorer koukni na exp, prover kompletne, hlavne mela byt nasazena uz v4".

Audit odhalil:

| Co | Stav |
|---|---|
| Live web | `zion-v3-node/3.0.6`, height 11510, 1 peer, 11/11 služeb |
| `/explorer/txs` | **404** |
| `/explorer/charts` | **404** |
| `/explorer/status` | **404** |
| `/explorer/broadcast` | **404** |
| `/explorer/verify-message` | **404** |
| `/explorer/blocks` | 200, ale prázdný (client-side hydratation — ne bug) |
| `/explorer/block/11510` | 200, ale prázdný (client-side hydratation — ne bug) |
| API `/api/blockchain/block?height=11510` | ✅ vrací plná data (4 TXs, miner labels, account-model) |

**Root cause:** Commit `a55cfa2b2` (2026-07-19 04:24) upravil `explorer/layout.tsx` aby importoval `ExplorerV4LayoutWrapper` + `SseOverlayWrapper`, ale **zapomněl `git add`** 31 nových souborů (4629 řádků). HEAD byl broken — `layout.tsx` referencoval neexistující moduly. Live Edge container běžel z před-`a55cfa2b2` buildu, proto web fungoval ale bez V4 stránek.

---

## 2. Provedené akce

### 2.1 Commit chybějících V4 souborů (`63069057f`)

```
fix(explorer-v4): add missing V4 files forgotten by a55cfa2b2
```

31 souborů, 4629 řádků:

**API routes (Phase 1):**
- `src/app/api/blockchain/tx/route.ts` — dedicated TX detail
- `src/app/api/blockchain/broadcast/route.ts` — submit signed TX
- `src/app/api/blockchain/verify-message/route.ts` — Ed25519 verify
- `src/app/api/blockchain/sse/route.ts` — SSE stream (`stats`, `new_block`, `mempool_update`, `ping`)

**Pages (Phase 3):**
- `src/app/explorer/txs/` — paginated TX list, SSE live badge, type/address filters, CSV export
- `src/app/explorer/charts/` — hashrate/difficulty/block-time/tx-count, 24h/7d/30d, CSV export
- `src/app/explorer/status/` — node/network status, health checks, peer table, SSE live height
- `src/app/explorer/broadcast/` — raw TX broadcast (JSON/hex, account/utxo, example loader)
- `src/app/explorer/verify-message/` — Ed25519 verifier s address-match check
- `src/app/explorer/ExplorerV4LayoutWrapper.tsx`

**Shared components (Phase 2):**
- `src/components/explorer/v4/shared/` — ExplorerV4Layout, ExplorerTicker, HashChip, CopyButton, LiveBadge, ZionDataTable, ZionStatCard
- `src/components/explorer/v4/hooks/` — useExplorerData, useExplorerSSE
- `src/components/explorer/v4/dashboard/` — SseBlockFeed, SseOverlayWrapper, SseStatusOverlay

**Lib (Phase 2):**
- `src/lib/explorer/` — api.ts, types.ts, format.ts, sse.ts, index.ts

### 2.2 Oprava deploy skriptu (`f0617349a`)

```
fix(scripts): repair deploy-edge-web.sh for live Edge topology
```

Původní `scripts/deploy-edge-web.sh` měl 11 bugů:

| Bug | Oprava |
|---|---|
| Repo path `/root/zion-2.9.6-main` | `/root/zion/2.9.6` (matches edge-deploy/setup-edge.sh) |
| Image tag `zion-website:$VERSION` | `zion-web:$VERSION` |
| Container name `zion-website` | `zion-web` |
| Missing `network_mode: host` | Přidáno (RPC access to 127.0.0.1:8443/8448/8455) |
| Missing `HOSTNAME=127.0.0.1` | Přidáno (Next.js bind only on localhost) |
| Missing `read_only` + tmpfs | Přidáno (security hardening) |
| `next start` (375 MB image) | `node server.js` standalone (132 MB) |
| Caddy reload | nginx reload (Edge uses nginx) |
| No `docker stop/rm` before `up -d` | Přidáno (name conflict fix) |
| No health check wait | Přidáno (10s loop) |
| No stash handling | Přidáno (auto-stash uncommitted, print stash name) |

Nové features:
- `--rsync` mode: pre-built artifacts z dev machine (skip npm install/build na Edge)
- Auto-stash uncommitted changes před `git pull`
- Version tag + latest tag na každém buildu
- nginx reload s Caddy fallback

### 2.3 Edge repo synchronizace

- `git stash push -u -m 'auxpow-miner-wip-pre-v4-deploy-20260719-1444'` (20 uncommitted AuXpow souborů)
- `git pull origin main` → `ba3b7bd94` (V4 commits present)
- `git stash pop` → 20 konfliktů (miner WIP vs nové commity)
- `git reset HEAD && git checkout -- .` → clean working tree (per user approval)
- **Stash@{0} bezpečně uložen** pro ruční řešení: `cd /root/zion/2.9.6 && git stash pop`

### 2.4 Phase 4 polish (`5e47b55f0`)

```
feat(explorer-v4): SSE live block feed + error states (Phase 4)
```

**`/explorer/blocks` (118 řádků změn):**
- Wire `useExplorerSSE` hook pro real-time new block notifications
- Když SSE nahlásí vyšší height než top of list, fetch missing block(s) přes `/api/blockchain/block` a prepend do tabulky
- Dedup přes `knownHeights` Set, cap 500 řádků
- `LiveBadge` v header: "Live" (zelený, pulzující) když SSE connected, "Offline" (šedý) když disconnected
- "+N new" counter: total new blocks since page load
- Error banner s retry button když `/blocks` API failne (dříve tichý `hasMore=false`)

**`/explorer/transactions`:**
- Error banner s retry button když `/transactions` API failne

**Skip (low ROI / high risk):**
- Clean URL refactor (`/explorer/block?height=X` → `/explorer/block/X`): velký refactor 3 dynamic routes + všechny interní linky
- SEO static params pro block/tx/address: dynamická data, `generateStaticParams` by musel enumerovat všechny bloky/tx/adresy
- PNG export na charts: potřebuje `html-to-image` dep
- Responsive QA: manuální test, neautomatizovatelné

### 2.5 Deploy pipeline

1. **Lokální build:** `npm run build` → 105 static pages, 0 TypeScript errors, 132 MB standalone
2. **Rsync na Edge:** `.next/standalone/` + `.next/static/` + `public/` → `zion-new:/root/zion-web-build/`
3. **Docker build na Edge:** `zion-web:v4-phase4` + `zion-web:latest` (132 MB image)
4. **Restart container:** `docker stop/rm zion-web && docker compose up -d`
5. **Health check:** 10s loop na `/api/health`

---

## 3. Live verifikace (2026-07-19 ~14:50 UTC+2)

### Pages — všechny 200

| Route | HTTP | Poznámka |
|---|---|---|
| `/explorer` | 200 | dashboard |
| `/explorer/blocks` | 200 | SSE live feed + error banner |
| `/explorer/transactions` | 200 | error banner |
| `/explorer/txs` | 200 | paginated TX list + SSE badge |
| `/explorer/charts` | 200 | 4 chart types, 3 time ranges |
| `/explorer/status` | 200 | node/network status + health |
| `/explorer/broadcast` | 200 | raw TX broadcast form |
| `/explorer/verify-message` | 200 | Ed25519 verifier |
| `/explorer/mempool` | 200 | WebSocket real-time |
| `/explorer/richlist` | 200 | top holders |
| `/explorer/api-docs` | 200 | API documentation |

### API endpoints

| Endpoint | HTTP | Poznámka |
|---|---|---|
| `/api/health` | 200 | height 11528, uptime 26s, pool accepted 630 |
| `/api/blockchain/stats` | 200 | full network summary |
| `/api/blockchain/blocks?limit=5` | 200 | 5 bloků s miner labels |
| `/api/blockchain/block?height=11510` | 200 | full block detail s 4 TXs |
| `/api/blockchain/tx?hash=...` | 200 | dedicated TX detail |
| `/api/blockchain/broadcast` POST | 400 | validuje body (správně) |
| `/api/blockchain/verify-message` POST | 400 | validuje body (správně) |
| `/api/blockchain/sse?interval=5` | 200 `text/event-stream` | streamuje `stats` + `ping` každých 5s |

### SSE stream sample

```
event: stats
data: {"height":11528,"tip_hash":"000015debaefca5de17107aee06b98a4efff5772fcc6ca92c17fef52b6e30022","difficulty":100446,"network_hashrate":0,"mempool_size":1,"mempool_bytes":0,"protocol_version":"zion-v3-node/3.0.6","consensus_profile":"","timestamp":1784466293793}

event: ping
data: {"timestamp":1784466305957}
```

---

## 4. Commity (vše na origin/main)

| Commit | Title |
|---|---|
| `5e47b55f0` | feat(explorer-v4): SSE live block feed + error states (Phase 4) |
| `f0617349a` | fix(scripts): repair deploy-edge-web.sh for live Edge topology |
| `63069057f` | fix(explorer-v4): add missing V4 files forgotten by a55cfa2b2 |

Plus 2 nezávislé miner commity z paralelní session (již na origin):
- `bfc2d86d6` fix(miner): check pipelined GPU shares against current vardiff target
- `bfde361e0` feat(miner): adaptive GPU duty-cycle scheduler (Fáze 4)

---

## 5. Edge server stav

| Service | Stav |
|---|---|
| `zion-web` container | `zion-web:v4-phase4` (+ `:latest`), uptime healthy |
| Image size | 132 MB (standalone) — původně 375 MB |
| Compose | `/root/zion-web/docker-compose.yml` — `network_mode: host`, `HOSTNAME=127.0.0.1`, `read_only: true`, tmpfs `/tmp /var/cache` |
| Build artifacts | `/root/zion-web-build/` (132 MB, rsync z dev machine) |
| Edge repo | `/root/zion/2.9.6/` na `ba3b7bd94` (clean working tree) |
| AuXpow stash | `stash@{0}: auxpow-miner-wip-pre-v4-deploy-20260719-1444` (20 souborů, čeká na ruční řešení) |

---

## 6. Zbylé úkoly

### Pro ruční řešení

- **AuXpow stash na Edge:** `cd /root/zion/2.9.6 && git stash pop` → 20 konfliktů (miner WIP vs nové commity). Stash bezpečně uložen, nespěchá.
- **Responsive QA:** manuální test na mobilu/tabletu.

### Pro future session (low priority)

- **Clean URL refactor:** `/explorer/block?height=X` → `/explorer/block/X`. Velký refactor 3 dynamic routes + všechny interní linky. Aktuální query-param URL fungují, SEO dopad minimální pro explorer.
- **PNG export na charts:** potřebuje `html-to-image` dependency.
- **SEO static params:** dynamická data, `generateStaticParams` by musel enumerovat všechny bloky/tx/adresy (impossible at scale).

---

## 7. Lessons learned

1. **`git add` po editu:** Commit `a55cfa2b2` upravil `layout.tsx` ale zapomněl `git add` nové soubory. HEAD byl broken. **Vždy `git status` před commit.**
2. **Deploy skript drift:** `scripts/deploy-edge-web.sh` měl 11 bugů vs live Edge topology. Skript nebyl aktualizován když se měnily cesty/image/proxy. **Po každém Edge topology change aktualizovat deploy skript.**
3. **Stash handling:** Edge má často uncommitted miner WIP. `git pull` bez stash by ho ztratil. **Deploy skript musí stash automaticky.**
4. **Standalone build:** `next start` (375 MB) vs `node server.js` (132 MB) — standalone je 65% menší. **Vždy `output: "standalone"` v `next.config.ts`.**
5. **`network_mode: host` na Edge:** Next.js container potřebuje `127.0.0.1` = host (ne container) pro RPC access. Bridge mode broke `ECONNREFUSED 127.0.0.1:8443/8448/8455`.

---

## 8. Reference

- Plan: [`EXPLORER_V4_ENGINE_PLAN.md`](../../EXPLORER_V4_ENGINE_PLAN.md) — Phases 1-4 complete
- Deploy skript: [`scripts/deploy-edge-web.sh`](../../scripts/deploy-edge-web.sh) — opravený
- Status: [`StatusV3.md`](../../StatusV3.md) — canonical live topology
- Live: https://zionterranova.com/explorer

---

**Session end:** 2026-07-19 ~15:00 UTC+2
**Vše pushnuto na `origin/main`.**
