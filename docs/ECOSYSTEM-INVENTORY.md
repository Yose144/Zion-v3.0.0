# ZION Ecosystem — Hluboká inventarizace (měřeno 2026-10-22)

> Zdroj pravdy pro přestavbu. Všechna data níže jsou naměřená živým průzkumem (systemctl, ss, nginx conf, git, dig), ne z dokumentace. Tam, kde se realita liší od docs, **platí toto**.

---

## 1. Infrastruktura — tři boxy + rig

### Edge — `62.171.141.136` (vmi3425821, Contabo)

**Role dnes:** TLS termination + proxy pro VŠECHNY domény, pool, chain followers, monitoring, statické soubory.

| Kategorie | Detail |
|---|---|
| nginx :80/:443/:8443 | 12 vhostů (viz §3) — jediný TLS endpoint ekosystému |
| zion-v31-pool | :8080 API, :8444/:8445 stratums |
| zion-v31-node2/3 | follower nody :8336/:8337 |
| zion-chain-tunnel | **18× `-L` forward → edge2** (viz §4) — kritická tepna |
| Monitoring | prometheus :9090, alertmanager :9093, grafana :3001, node-exporter :9100, g8-probe/g8-alert-sink :9094 |
| zion-fallback-miner | CPU miner :9101 (Nice 19, quota 30%) |
| zion-bitcoind-regtest | BTC regtest |
| vastctl-daemon | vast.ai rig probe → status.json → webroot |
| zion-rig-output | `python3 -m http.server :9999` → /root/rig-output (SMOS logy) |
| zion-edge-python-dashboard | `ZION_OS/dashboard/app.py` :8766 (ops dashboard) |
| Mail | postfix + opendkim |
| Timers | zion-edge-backup (denní), zion-v31-watchdog, g8-evidence, edge-log-cleanup |
| /opt/zion | `backups/` 18G, `hiran-models/` 5.5G, `V31/` 4.5G, `canonical-main/` 2.6G, `wt-main/`+`wt-f5/` 3.4G, `data/` 2G, `website-v2.9/` 161M **(stale — neslužuje)**, `ZION_OS/` 587M, `releases/` 132M |
| /var/www | `zion-miner/` 3.3G (binárky ke stažení), `zion-maintenance/` 441M (apex), `newearth/` 428M (newearth.cz), `downloads/` 344M, `oasis/` 17M, `freeworld/` 6.1M, `pool/` 1.7M (pool-ui static), `maintenance/` 17M |
| Disk | 145G, 46% used |

⚠️ `zion-website.service` zde je **retired** (`zion-website.service.retired` v /etc/systemd/system) — web se tu už nespouští.

### Edge2 — `207.180.217.100` (vmi3684458, Contabo)

**Role dnes:** VŠECHNY aplikační + chain daemony + DB + weby. Žádný nginx, žádný certbot, žádný public port kromě SSH :22.

| Kategorie | Služba → port |
|---|---|
| Weby | `zion-website` (Next standalone) → :3000 · `zion-marketplace` (Next) → :3100 |
| Identity | `zion-zis` (node `/opt/zion/identity/server.js`) → :8096 |
| L1 | `zion-v31-node` → RPC :9445, P2P :8335 |
| L5/L6 daemony | `zion-v31-free-world` → :8095 · `zion-v31-issobella` → :8097 · `zion-v31-oasis` → :8094+9102 · `zion-v31-ncl` → :8098 · `zion-v31-dao` → :8456 · `zion-v31-multichain` |
| AI | `zion-v31-ai-native` (RAG) → :8001 · `zion-hiran-inference` (llama CPU) → :8002 |
| Multichain nody | `zion-bitcoind` → :8332-8334 (mainnet pruned) · `zion-quantus-node` → :9944/9615/30333 · `zion-pearld` → :44107/44108 · `zion-pearl-gateway` → :8477 · `zion-pearl-oyster` → :44207 |
| Swap | `warpd` → :8453/:8454 |
| Sync/watch | `zion-db-sync` (→ postgres) · `zion-l1-watcher` (marketplace) · `zion-btcunlock-coord` |
| Tunel zpět | `zion-edge-tunnel` → edge: -L 8080 (pool API), 8003 (rig LLM), 8004→8002, 8006, 9446/9447, 8766 (dashboard) |
| DB | `postgresql@16-main` → :5432 |
| Monitoring | prometheus :9090 + node-exporter :9100 |
| Misc | python3 :8779 (dashboard API?), :9105 (g8 exporter) |
| /opt/zion | `APP&WEB/` (mirror repa: website-v2.9 4.1G, MarketPlace 2.8G, OasisWeb 902M, IntroPage 435M, public_html 428M), `identity/` 166M (ZIS deploy), `hiran-models/` 5.5G, `V31/` 4.5G, `bitcoin/` 80M, `data/` 1.8G |
| Disk | 193G, 50% used |

### Rig (SMOS, ID 518837 / group 1780844)

| Stav | Detail |
|---|---|
| GPU | GTX 1070 Ti (SM61 — pearlhash přes SRBMiner nefunguje, vlastní CUDA kernel) |
| Workload | zion-miner (QTU ~70-77 MH/s) + ZION+VRSC streamy |
| LLM | llama.cpp server :8003 (`-c 3072`) — přes reverse tunel na Edge, přeposíláno edge2 |
| Přístup | přes Edge `permitlisten :8322,:8003` (rigtunnel user, nologin) |

### Lokální stroj (zionserver)

Vývojový/ops stroj: repo checkout `2.9.6-main`, ssh klíče, buildy, dashboard app.py (zrcadlený přes reverse tunel → edge :8088 → dashboard.zionterranova.com).

---

## 2. Tunely — dvoucestá SSH mřížka (křehké)

```
EDGE ────────── 18× -L forwards ──────────► EDGE2
  (zion-chain-tunnel, ssh → chaintunnel@edge2)
  3000 web · 3100 market · 5432 postgres
  8001 ai-native · 8332 btc · 8453/8454 warp
  8456 dao · 8477 pearl-gw · 8779 dashboard
  8094 oasis · 8095 freeworld · 8096 ZIS
  8097 issobella · 8098 ncl · 9445 zion-rpc
  9944 quantus · 44207 oyster

EDGE2 ────────── 7× -L forwards ──────────► EDGE
  (zion-edge-tunnel, ssh → edgetunnel@edge)
  8080 pool-api · 8003 rig-LLM · 8004→8002
  8006 · 9446/9447 · 8766 dashboard

EDGE ◄────── permitlisten :8322,:8003 ────── RIG
  (SMOS reverse tunel: sshd pro rig admin + llama :8003)
```

**Dopad:** každý veřejný request jede edge → ssh → edge2. Když `zion-chain-tunnel` ssh session spadne (flap pozorován 22.10.), **všechny weby přestanou odpovídat**. Web je závislý na sshd obou boxů.

---

## 3. Domény — všechny → 62.171.141.136

| Doména | Obsah | Backend |
|---|---|---|
| `zionterranova.com`, `www` | intro hub | `/var/www/zion-maintenance` (static) |
| `app.zionterranova.com` | **hlavní web** | tunel → edge2 :3000 |
| `oasis.zionterranova.com` | OASIS hra | `/var/www/oasis` + :8094/:8095 (tunel) + auth→auth.… |
| `freeworld.zionterranova.com` | L5 portál | tunel → :3000 → `/l5-free-world` |
| `auth.zionterranova.com` | **ZIS SSO** | `zion_zis` upstream → tunel → edge2 :8096 |
| `pool.zionterranova.com` | pool UI + API | `/var/www/pool` static + :8080 local + :8096 |
| `market.zionterranova.com` | marketplace | tunel → edge2 :3100 |
| `dashboard.zionterranova.com` | ops dashboard | :8779/api + :9999 (IP allowlist + BasicAuth) |
| `grafana.zionterranova.com` | grafana | :3001 local |
| `rpc.zionterranova.com` | veřejné RPC | → edge2:9445 (zion) + :9944 (qtc) |
| `api.zionterranova.com` | DNS existuje | ? |

**+1 doména mimo zionterranova:** `newearth.cz` → `/var/www/newearth` (428M static, z APP&WEB/public_html).

---

## 4. Repozitář — `~/2.9.6-main` (origin: Yose144/Zion-v3.0.0, public: Zion-TerraNova/v3-Mainnet)

### Top-level (30+ položek)

| Dir | Size | Files | Posl. commit | Hodnocení |
|---|---|---|---|---|
| `APP&WEB/` | 12G | 379k | 2026-10-22 | **živé — všechny appky** |
| `V31/` | 4.6G | 14k | 2026-10-22 | **živé — chain L1-L6** |
| `docs/` | 75M | 3.2k | 2026-10-22 | **živé — kanon + plány** |
| `ZION_OS/` | 211M | 10k | 2026-10-22 | živé — infra/dashboard/skripty |
| `scripts/` | 2.5M | 367 | 2026-10-22 | živé — ops skripty |
| `edge-deploy/` | 300K | 56 | 2026-10-21 | živé — edge deploy |
| `archive/` | 4.5G | 27k | 2026-10-21 | archiv (HiranV2.x, MinerP3.0.6, V3…) |
| `V3/` | 25M | 1.4k | 2026-10-21 | **stará chain verze → archive?** |
| `WarpBeta/` | 56K | 6 | 2026-10-21 | warp beta — posoudit |
| `L5Projects/` | 68M | 55 | 2026-10-21 | živé — L5 artwork/projekty |
| `BTCunlock/` | 1.2G | 4k | 2026-10-19 | živé — puzzle #71 koordinátor |
| `Hiran/` | 325M | 131 | 2026-10-18 | živé — LLM trénink pipeline |
| `L2data`–`L6data/` | ~14M | ~56 | 09–10/2026 | data exporty per vrstva |
| `logs/` | 466M | 214 | never | runtime logy (gitignored?) |
| `backups/` | 16G | 61 | never | **lokální zálohy → ven z repa?** |
| `BACKUP/` | 112M | 17 | never | stará záloha |
| `PUBLIC/` | 855M | 3.6k | never | **samostatný git klon public repa** |
| `public/` | 28M | 1.5k | 2026-10-21 | public subtree mirror → `public` remote |
| `venv-hiran/` | 36M | 1.9k | never | python venv |
| `LOGO/` | 91M | 169 | 2026-09-16 | brand zdrojáky |
| `tools/` | 336K | 12 | 2026-10-22 | utility |
| `AuXpow/` | 688K | 10 | 2026-08-04 | auxpow experiment? |
| `config/` | 8K | 1 | 2026-07-31 | 1 soubor |
| `dashboard/` | 452K | 1 dir | 2026-06-03 | python dashboard (models+services) |
| `data/` | 616K | 8 | never | lokální sqlite (bridge/dao/warp/revenue) |
| `src/` | 8K | 1 | 2026-08-05 | 1 soubor `lib.rs` (zbytek?) |

### APP&WEB aplikace (všechny živé, posl. commity 21–22.10.)

| App | Stack | Deploy | Stav |
|---|---|---|---|
| `website-v2.9` | Next.js 16.2.9 standalone | `deploy/deploy-web2.9.sh` → **zion-post-wipe (OLD edge!)** | ⚠️ cíl deploye je mrtvý box — viz §6 |
| `IntroPage` | Next.js static export | `deploy/deploy-intro.sh` → /var/www/zion-maintenance | apex hub; má i `build:freeworld` variantu |
| `OasisWeb` | Next.js + BabylonJS/R3F (3D hra) | `deploy/deploy-oasis-web.sh` → /var/www/oasis | oasis.zionterranova.com |
| `MarketPlace` | Next.js + Prisma + x402/evm + contracts | DEPLOY.md → edge2 :3100 | market.zionterranova.com |
| `pool-ui` | Next.js + simplewebauthn | `deploy/deploy-pool.sh` → /var/www/pool | pool.zionterranova.com |
| `identity` | Fastify + Prisma + JWT + WebAuthn | `deploy/deploy-zis.sh` → /opt/zion/identity | **ZIS = auth.zionterranova.com** |
| `desktop-agent` | Electron miner app | build → /var/www/zion-miner + releases | privátní/current |
| `mobile-app` | Expo React Native | – | mobilní appka (stále živá?) |
| `zion-wallet-sdk` | TS lib (ethers, bip39) | npm publish? | SDK |
| `shared` | Prisma db-sync skripty | `deploy/` | není UI kit — jen db sync |
| `public_html` | statický web | `deploy/deploy-newearth.sh` → /var/www/newearth | **newearth.cz — jiný projekt** |

### Website-v2.9 povrch (měřeno)

- **~60 route sekcí, ~130+ stránek, 74 API routes**
- Největší: `explorer/` 24 str., `terranova/` 18, `dashboard/` 10; desítky jednostránkových sekcí
- API: `blockchain/*` (20 rout — explorer backend), `auth/[...zis]`, `dao/*`, `defi/*`, `free-world/*`, `bridge/*`, `ai-chat`, `downloads`, `cex/listings`…
- docs reader: `MarkdownDoc` + Doc Link Engine + `/docs/view/[...path]`, manifest generovaný `gen-doc-manifest.mjs`
- ZIS integrováno: `/api/auth/[...zis]` + login page; cookie `.zionterranova.com`

---

## 5. ZIS — ZION Identity Service (kanon, již nasazené)

`auth.zionterranova.com` → edge nginx → upstream `zion_zis` (127.0.0.1:8096) → **tunel** → edge2 `zion-zis.service` → `/opt/zion/identity/server.js` (repo `APP&WEB/identity`).

Metody: Ed25519 (L1 native) · SIWE · Google OIDC · WebAuthn/passkeys → JWT EdDSA httpOnly cookie `.zionterranova.com`. Spotřebitelé: app (cookie), market (cookie+API key), oasis (cookie), dashboard (cookie).

---

## 6. Zjištěné problémy (seřazeno dle závažnosti)

| # | Problém | Dopad |
|---|---|---|
| 1 | **Web cesta: TLS edge → SSH tunel → edge2** — 1 extra hop + SPOF na sshd obou boxů (flap 22.10. = výpadek webu) | latence + křehkost |
| 2 | `deploy-web2.9.sh` cíl = `zion-post-wipe` (old edge) — web tam **neběží**; deploy jinam = mimo živý box | nasazení do prázdna / nekonzistence |
| 3 | `.next/standalone/public/` chyběl na edge2 → **všechny public assety 404** (fix 22.10.) | "rozsekaný" web |
| 4 | Žádný nginx/certbot na edge2 — nelze přesunout TLS bez instalace | blokuje F1 |
| 5 | Dvoucestá SSH mřížka (18+7 forwardů) — jakýkoliv výpadek degraduje celek | křehkost |
| 6 | `PUBLIC/` samostatný klon vs `public/` subtree — dvojí pravda pro public remote | riziko diverzence |
| 7 | `newearth.cz` (cizí projekt) žije na stejném boxu/nginx | míchání scope |
| 8 | Repo root: 30+ top-level dirs, `backups/` 16G v repu, `logs/` 466M, `venv-hiran/`, `PUBLIC/` klon | chaos |
| 9 | Deploy skripty per app s **různými targety** (zion-post-wipe vs vmi…contaboserver vs edge2) | nekonzistence |
| 10 | `zion-website.service.retired` na edge + stale `/opt/zion/website-v2.9` (161M) | zmatek |
| 11 | `dashboard.zionterranova.com` = ops dashboard s IP allowlist → ale DNS je veřejné; části tunelují na zionserver (:8088) | ops/web mix |
| 12 | `OasisWeb` (3D hra) + `oasis/` static + `/l4-oasis` v hlavním webu — tři povrchy pro "OASIS" | IA duplicita |
| 13 | `pool-ui` app + `/pool` v hlavním webu + `/var/www/pool` — tři pool povrchy | IA duplicita |
| 14 | `api.zionterranova.com` v DNS — zda má vhost je nejasné | audit |
| 15 | `zion-edge-download.conf` `server_name _` = catch-all → :9999 python http.server (rig-output) | divoký default |

---

## 7. Datové toky (jak to skutečně teče)

```
User → edge nginx :443 → [tunel] → edge2:3000 (web)
Web API calls → localhost edge2 (zion-rpc :9445, dao :8456, free-world :8095,
               oasis :8094, issobella :8097, ncl :8098, ai-native :8001,
               zis :8096, postgres :5432)
              → [tunel zpět] edge:8080 pool-api, edge:8003 rig LLM
Explorer/pool data → pool :8080 (edge) ← těžaři na :8444/:8445 stratums
ZIS auth → auth.… → edge nginx → [tunel] → edge2:8096
Marketplace → market.… → [tunel] → edge2:3100 → l1-watcher → zion-rpc
RPC veřejné → rpc.… → edge → edge2:9445 (přímo, ne tunel!) + :9944
OASIS → oasis.… → static /var/www/oasis + [tunel] edge2:8094/8095 + auth
Dashboard → dashboard.… → edge :8779(api→edge2 tunel) + :9999 (rig-output)
```
