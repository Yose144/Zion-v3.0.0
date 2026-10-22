# ZION INFRA SPLIT — EDGE (vmi3425821) × EDGE2 (vmi3684458)

> **✅ AKTUÁLNÍ STAV (2026-10-21 ~15:00, split v3 — MIGRACE DOKONČENA):**
> - **EDGE2 nese:** V31 primary (9445/8335), bitcoind mainnet (8332 pruned), quantus (9944 + QUIC UDP 9833 jen-z-edge + 30333), pearl stack (44207/8477), PG 16 (5432), WARP (8453/8454), ZIS 8096, db-sync, DAO 8456, OASIS 8094, freeworld 8095, issobella 8097, ncl 8098, website 3000, marketplace 3100, ai-native 8001, btcunlock 8779.
> - **EDGE nese:** nginx ingress (všechny veřejné vhosty → tunely/pool), pool 8444/8445 stratum + API 8080 (real miner IPs — per-IP session/ban limity, proto nemůže za stream proxy), fallback-miner, node2 9446 + node3 9447 (peerují EDGE2:8335), regtest BTC, dashboard 8766, grafana 3001.
> - **Tunely:** `zion-chain-tunnel` edge→EDGE2 (`chaintunnel`, permitopen whitelist): 9445/9944/44207/8332/8477/8453/8454/8456/8094-8098/5432/3000/3100/8001. `zion-edge-tunnel` EDGE2→edge (`edgetunnel`): 8080 (pool API), 8003 (hiran LLM), 9446/9447 (follower reads).
> - **Watchdog:** hlídá `node2,node3,pool,fallback-miner,chain-tunnel` — ghost node1 vypnut (watchdog ho dřív vzkřísil na starém tipu = split-brain povrch, opraveno).
> - **Dashboard:** EDGE2 karta (`/api/edge2-status`), `/api/health` = 28 služeb / 0 not-up (health map přepsaná na TCP probe přes tunel).
> - **Externě:** zionterranova.com, pool, oasis, rpc `/getinfo` = 200; pool legy all connected.
> - **Rollback:** `/root/cutover-*-rollback.sh` na edge pro každé okno (P2, chains, btc, apps, warp, web, btcunlock).
> - **Zbývá:** observační období → edge cleanup ~62G zdrojových dat (quantus 13G, pearl 18G, bitcoin 31G, apps 13G — NEMAZAT bez potvrzení); `PRL_PAYOUT_DRY_RUN=1` zůstává; `WARP_API_KEY` unset (pre-existing).

> **⚠️ PŮVODNÍ SPLIT-V2 STATUS (2026-10-21 12:35, historicky — fáze v3-A):**
> - **v3-A HOTOVO (2026-10-21 13:00):** quantus + pearl stack (pearld, oyster, gateway) běží na EDGE2 na loopbacku. Edge se připojuje přes `zion-chain-tunnel` (SSH `-L` na 9944/44207/8477, účet `chaintunnel@EDGE2`, permitopen jen tyto porty). QTC native leg jde přímo UDP/QUIC na `207.180.217.100:9833` (UFW allow jen z edge IP). Všechny legy poolu `up`.
> - **v3-B (další):** bitcoind (+ regtest zůstává na edge) → EDGE2 přes stejný tunel (přidat `-L 8332`, permitopen 8332); pak WARP zůstává na edge (čte BTC/QTC/PRL přes tunel). App tier + ZIS + PG čekají na rozhodnutí o cross-box závislostech (ZIS je používán poolem přes `ZION_POOL_ZIS_URL`, WARP a OASIS). ai-native zůstává na edge (LLM tunel rig→edge:8003).
> - **P2 HOTOVO:** V31 primary běží na **EDGE2** (tip shodný s node2/node3, veřejný RPC přes edge nginx). Edge primary disabled.
> - **Rozhodnutí — pool + fallback miner ZŮSTÁVAJÍ na edge:** stratum a pool API musí vidět reálné IP minerů (`ZION_POOL_MAX_SESSIONS_PER_IP`=10, IP ban). Nginx stream proxy by všechny minery sjednotil pod jednu IP → žádný stream proxy pro stratum. Původní plán (pool na EDGE2) je tímto **zrušen**.
> - **Rozhodnutí — node2 + node3 zůstávají na edge** (požadavek uživatele), followeři peerují na EDGE2 (`207.180.217.100:8335`).
> - **Měření:** latence edge↔EDGE2 ~1 ms → cross-box RPC je prakticky lokální, žádný důvod držet chainy na edge kvůli latenci.
> - **v3 (další):** quantus, pearl stack (pearld/oyster/gateway), bitcoind (+regtest), WARP (multichain) a app tier (DAO, OASIS, NCL, AI-native, FreeWorld, Issobella, ZIS, DB-sync, PG, website, marketplace, dashboard, btcunlock) → EDGE2. Pool, node2/node3, fallback miner, nginx ingress, fail2ban zůstávají na edge. Cíl: edge uvolní ~60 GB disku (je 89 %) a CPU zátěž; EDGE2 (6c/11G/193G) nese chain + app core.
> - Rollback primárního cutoveru: `bash /root/cutover-primary-rollback.sh`.

> **Stav 2026-10-21:** Edge = 4 cores / 8 GB RAM / 145 GB disk (89 %), load avg ~17 — přetížený.
> **EDGE2 = `207.180.217.100` (IPv6 `2a02:c207:2368:4458::1`) — vmi3684458, Ubuntu 24.04 — 6 cores AMD EPYC / 11 GB RAM / 193 GB disk** — SSH alias `zion-edge2` (klíč `zion-edge-post-wipe-2026-07-29`, port 22).
> **Design rozhodnutí (user):** EDGE2 = **primary node + pool + celý app/service stack**; EDGE = **oba followeři node2+node3 (chain redundance na samostatném boxu) + public ingress nginx + monitoring**. Consensus primary běží na silnějším siliconu; edge drží 2 živé kopie + public povrch.

---

## 1. Důkladná analýza Edge — skutečná spotřeba

| Služba | avg CPU | RAM | Disk | Role | Kritičnost |
|---|---|---|---|---|---|
| `zion-v31-node` (primary :9445, p2p 8335) | **~92 %** | 1008 MB | 536 M | konsenzus+validace | 🔴 L1 critical |
| `zion-v31-node2` (:9446) | **~79 %** | 672 MB | 522 M | follower/failover | 🟠 failover |
| `zion-v31-node3` (:9447) | **~79 %** | 669 MB | 522 M | follower | 🟠 failover |
| `zion-fallback-miner` | ~36 % | 2 MB | — | chain liveness SPOF | 🔴 u node |
| `zion-v31-pool` (:8080, stratum 8444/8445) | ~4 % | 487 MB | 116 M | public mining | 🔴 latency→node |
| `bitcoind` (pruned) + regtest | ~6 % | 1147 MB | **31 G** | WARP BTC backend | 🟡 |
| `quantus-node` | ~12 % | 870 MB | **13 G** | QTC pool leg | 🟡 |
| `pearld` + oyster + gateway | ~5 % | ~490 MB | **11 G** | PRL stack | 🟡 |
| `zion-v31-multichain` (:8453) | ~0.1 % | 13 MB | 74 M | WARP relay | 🟡 |
| dao/free-world/issobella/oasis (:8456/8094…) | ~0 % | ~3 MB | malé sqlite | L3-L6 trackery | 🟢 |
| `zion-v31-ncl` (:8098), `ai-native` | ~0 % | — | — | L3 compute | 🟢 |
| `zion-db-sync` + postgresql@16 | ~0 % | ~80 MB | — | sync→PG | 🟢 |
| `zion-website` (Next.js) | ~0 % | 128 MB | — | public web | 🟢 |
| `zion-marketplace` (Next.js) | ~0 % | 15 MB | — | public web | 🟢 |
| `zion-zis` (auth) | ~0 % | 37 MB | — | SSO | 🟠 web kritická |
| `zion-edge-python-dashboard` (:8766) | ~15-30 % | 149 MB | — | ops console — potřebuje local systemd/journald chain unitů | 🟠 |
| `zion-btcunlock-coord` | batch | 7 MB | — | puzzle scanner | 🟢 |
| nginx/prometheus/grafana/fail2ban/g8 | ~2 % | ~200 MB | — | ingress+monitoring | 🟠 |
| **rustc buildy** (manuální) | ~50 %+ | — | GB | aktuálně žere jádro | — |

**Závěry analýzy:**
1. **CPU bottleneck = 3 nody (~250 %)** + miner + příležitostné buildy. Vše ostatní je šum.
2. **RAM tlak** = nodes 2.3G + chains 2.5G + pool 0.5G → 5.9/7.8G + 4.7G swap.
3. **Disk** = btc 31G + quantus 13G + pearl 11G + hiran model 5.5G(unused) → ~60G reclaimable.
4. Konsenzus se nesmí dusit → patří na **rychlejší** box. Edge je slabší → jeho role = levný ingress + redundance.

---

## 2. Cílové rozdělení — "INVERTED"

### EDGE (62.171.141.136) = PUBLIC INGRESS + FOLLOWER REDUNDANCY
| Služba | Detail |
|---|---|
| **nginx** | TLS terminace všech domén → HTTP upstreamy na EDGE2. **`stream {}` TCP proxy** `8444`+`8445` → EDGE2 (stratum TLS se terminuje až na EDGE2 — end-to-end, žádná DNS změna, minerům +~1 ms). TCP pass-through `8335` → EDGE2 p2p pro zpětnou kompatibilitu peerů |
| **`zion-v31-node2` + `zion-v31-node3`** | **oba followeři ZŮSTÁVAJÍ (user rozhodnutí)** — peerují `207.180.217.100:8335`; chain redundance na samostatném hostu; jejich RPC 9446/9447 přebindovat `0.0.0.0` + UFW allow jen EDGE2 = **remote failover endpointy poolu** |
| fail2ban, node_exporter, g8 probe, pool-wedgewatch→remote | edge monitoring |
| sshd :2222 (`zion-v6`) | beze změny |

→ Zátěže: ~1.7 jádra ze 4 (2 followeři ~160 % + nginx) — edge nese 2 živé kopie chainu a ingress, zbytek boxu dýchá.

### EDGE2 (207.180.217.100, 6c/11G/193G) = PRIMARY CHAIN + APP CORE
| Služba | Detail |
|---|---|
| **`zion-v31-node`** primary | `--p2p 0.0.0.0:8335 --rpc 127.0.0.1:9445`; EPYC 6 jader = rychlejší validace, žádný RPC starvation |
| **`zion-v31-pool`** | getTemplate localhost 0 latence; `L1Endpoints=127.0.0.1:9445` + `62.171.141.136:9446` + `62.171.141.136:9447` — **cross-box failover přes edge followeři!** |
| **`zion-fallback-miner`** | stratum → localhost:8444 |
| bitcoind+regtest, quantus, pearld+oyster+gateway | všechny externí chainy — 55 G dat |
| `zion-v31-multichain` | node RPC + BTC/QTC/PRL RPC = **všechno localhost** |
| dao/free-world/issobella/oasis | node RPC localhost |
| `zion-v31-ncl`, `ai-native` | — |
| `zion-db-sync` + postgresql | co-located s chain zdrojem |
| website, marketplace, zis | Next.js — localhost k OASIS/PG/ZIS (app tier sjednocený!) |
| `zion-edge-python-dashboard` | ops console chain stacku → **patří na EDGE2**; edge-side služby probuje remote (tcp/ssh) |
| `zion-btcunlock-coord`, prometheus+grafana | batch+monitoring |
| **Build stroj** | veškeré cargo/rustc — edge už nikdy nekompiluje produkci |

→ Odhad: node ~1 jádro + miner ~0.4 + chainy ~0.6 + pool 0.3 + weby/dashboard ~0.5 + btcunlock batch = **~3.5 jádra z 6** = zdravý headroom.

---

## 3. Síťový design

| Tok | Cesta |
|---|---|
| Veřejný stratum 8444/8445 | edge nginx `stream` TCP → EDGE2:8444/8445 (TLS end-to-end EDGE2, cert soubory + LE deploy hook se stěhují) |
| HTTPS 443 domény | edge nginx TLS → `proxy_pass http://207.180.217.100:<port>` (UFW na EDGE2: allow only 62.171.141.136 na app porty) |
| Node P2P 8335 | EDGE2 public port (p2p je public by design). Edge **TCP-proxy 8335→EDGE2** pro zpětnou kompatibilitu hardcoded peerů |
| Pool→L1 failover | EDGE2 localhost 9445+9447; 3. endpoint `62.171.141.136:9446` (node2 na edge — cross-box failover; UFW allow 207.180.217.100) |
| EDGE2→edge RPC | jen pool 3. fallback — jinak **žádné** (žádné tunnely nutné!) |
| edge→EDGE2 RPC | dashboard probes — EDGE2 vystaví 9445/9447 + service health porty **jen pro 62.171.141.136** (UFW) |
| node2 (edge) → primary | p2p `207.180.217.100:8335` |
| Rig beacons / public API | `dashboard.zionterranova.com` → edge nginx → EDGE2:8766 |

**Žádné SSH tunnely** — vše se řeší UFW allowlisty mezi dvěma veřejnými IP (Contabo ~1-5 ms).

---

## 4. Migrační fáze (každá revertovatelná — data kopírovat, ne přesouvat; edge units `disabled` ne deleted)

### P0 — EDGE2 příprava ✅ **DONE 2026-10-21**
- [x] SSH klíče → root; alias `zion-edge2` (port 22); **edge→EDGE2 SSH** (edge root klíč v authorized_keys)
- [x] Specs: 6c EPYC / 11 GB / 193 GB → AGENTS.md
- [x] user `zion`, `/opt/zion/{data/v31,V31,bin}`, `/etc/zion`, `/data/zion` + `/opt/zion/logs` + `/var/log/zion` (⚠️ všechny `ReadWritePaths` musí existovat, jinak exit 226/NAMESPACE), Node 20.20, swap 4 G, fail2ban, journald persistent
- [x] UFW: default deny; allow 22; allow **from 62.171.141.136 (+edge /64)** → 9445/8444/8445/8080/8453/8456/8094/8098/8766/3000-3002/5432/9100; p2p 8335 open
- [x] binárky + env + stratum-tls zkopírovány (`zion-node --version` = zion-core 3.2.0 OK)
- [x] unit soubory `zion-v31-node`/`zion-v31-pool`/`zion-fallback-miner` (**disabled**); pool `--l1-rpc-url` = `9445 local` + `62.171.141.136:9446,9447` cross-box
- [x] **Warm primary BĚŽÍ** (drop-in `warmup-peer.conf` s `--peer 62.171.141.136:8335`): synced tip 90144, `accepted block` průběžně, `getStatus` **69 ms** @ ~5 % CPU / 172 MB
- [x] V31 data pre-staged (1.8 G); externí chainy rsync **běží** (~62 G @ ~15 MB/s → `/var/log/prestage-edge2.log` na edge)
- ⚠️ **CUTOVER KROK:** po cutoveru **smazat** `warmup-peer.conf` drop-in (EDGE2 --peer → edge 8335 = self-loop přes budoucí TCP proxy)

### P1 — Externí chainy (~55 G, okno ~1-3 h rsync)
- [ ] bitcoind stop → rsync chain dir → EDGE2 unit → verify `getblockcount` → edge disabled (**31 G**)
- [ ] quantus stop → rsync `/opt/quantus` → EDGE2 → edge disabled (**13 G**)
- [ ] pearld+oyster+gateway stop → rsync `/opt/pearl/data` → EDGE2 units → edge disabled (**11 G**)
- [ ] regtest triviálně s mainnetem
- [ ] WARP/multichain env na edge dočasně přepnout na `207.180.217.100:<rpc>` (nebo počkat do P4 a stěhovat atomicky — bezpečnější atomicky)

### P2 — THE BIG MOVE: primary + pool + miner (jedno okno, downtime ~5-15 min; node2/3 ZŮSTÁVAJÍ na edge)
- [ ] Pre-stage `rsync -a` node.db + pool-store.db (delta hotový)
- [ ] Edge node2/node3 RPC přebind `0.0.0.0` + UFW allow jen `207.180.217.100` (remote failover pro pool)
- [ ] Okno: edge `systemctl stop zion-v31-node zion-v31-pool zion-fallback-miner`
- [ ] Final delta rsync (sekundy) → EDGE2 units start: node(`--p2p 0.0.0.0:8335 --rpc 127.0.0.1:9445`) → pool → miner
- [ ] Edge nginx `stream {}`: 8444/8445 → EDGE2; stratum TLS cert+key+LE hook → EDGE2 (`/etc/zion/stratum-tls/`)
- [ ] Edge TCP proxy 8335 → EDGE2:8335 (zpětná kompatibilita peerů)
- [ ] Edge `node2`+`node3` units: `--peer 207.180.217.100:8335` → restart (re-peer na nový primary)
- [ ] Pool `L1Endpoints = 127.0.0.1:9445,62.171.141.136:9446,62.171.141.136:9447` (primary local + oba edge followeři cross-box!)
- [ ] Verify: `accepted block` na EDGE2, followeři re-sync z EDGE2, stratum connect externě, pool `/public/v1/coins`, dashboard
- [ ] Edge: node1+pool+miner `disabled`

### P3 — L2-L6 + app tier (postupně, per-služba verifikace)
- [ ] `multichain` + `warp_multichain.db*` — env: node RPC localhost, BTC/QTC/PRL localhost (už na EDGE2 z P2!) — čistší než edge setup
- [ ] `dao`/`free-world`/`issobella`/`oasis` + sqlite DBs
- [ ] `zion-v31-ncl` (`NCL_DB_PATH` db), `ai-native` (model 5.5 G NEPŘENÁŠET — unused)
- [ ] `postgresql@16` → `pg_dumpall` → EDGE2 cluster; `zion-db-sync` → EDGE2 (localhost PG+node)
- [ ] `zion-zis`, `zion-website`, `zion-marketplace` — rsync/rebuild; PG localhost; `OASIS_API_URL=127.0.0.1:8094` ✓
- [ ] `zion-btcunlock-coord`
- [ ] Edge nginx upstreamy: zionterranova.com→EDGE2:3000, auth→EDGE2 ZIS, marketplace/oasis paths → EDGE2
- [ ] ZIS SSO cookie domény beze změny (auth.zionterranova.com přes edge proxy)

### P4 — Dashboard + monitoring
- [ ] Dashboard → EDGE2:8766 (app.py rsync — obsahuje EDGE-primary logiku, topology zůstává edge-primary jen s `EDGE_HOST=207.180.217.100`); registry `host` políčka EDGE2 služeb → localhost; edge-side (nginx, node2) → remote probe `62.171.141.136` (tcp/ssh wrapper jako dnešní `_run_edge_cmd`, jen obráceně)
- [ ] edge nginx: `dashboard.zionterranova.com` → EDGE2:8766
- [ ] Prometheus na EDGE2 scrape edge node_exporter + všechny metriky; grafana oba boxy
- [ ] Alerts: EDGE2 nedostupný >60 s, node2 lag>10 bloků, tunnel/proxy failure

### P5 — Edge cleanup
- [ ] Po ≥48 h stabilního provozu smazat: `/opt/quantus`, `/opt/pearl/data`, bitcoind data, node.db+node3.db kopie, pool-store (~56 G celkem)
- [ ] `hiran-models/*.gguf` 5.5 G, `wt-*` worktrees ~3.4 G
- [ ] Edge služby disabled zůstávají jako rollback dokumentace

---

## 5. Rollback strategie (per fáze)

| Fáze | Revert |
|---|---|
| P1 chainy | start edge units (data nedotčena) |
| P2 core | edge nginx stream off + start edge node/pool/miner (db delta je kopie → spustí se na posledním stavu) |
| P3 služby | start edge units + nginx upstream zpět localhost |
| P4 | dashboard zpět na edge |

Žádná fáze nemaže zdroj před ověřením — downtime jen při P3 cutover (~5-15 min) a per-service v P4 (sekundy).

---

## 6. "Max performance + health" zásady

1. **Builds POUZE EDGE2** — pravidlo do AGENTS (edge rustc = historicky ~50 % jednoho jádra)
2. **Pool failover = 3 endpointy napříč boxy** (9445,9447 EDGE2 + 9446 edge) — přežije i výpadek EDGE2 RPC vrstvy
3. **Health budgety:** edge load < 1.5, EDGE2 load < cores×0.8, swap < 1 GB, disk < 80 % — alert v prometheus
4. **Secrets:** `edge-environment.sh` subset per-service na EDGE2; `WARP_MNEMONIC` jen multichain+pearl-gateway; payout keys jen pool
5. **Dashboard topology flag:** nová `topology: "split"` nebo `EDGE_HOST` na EDGE2 — registry `host` per-service (EDGE2 services → localhost)
6. **Chain redundancy:** node2 na edge = živá kopie mimo hlavní box; zvažovat `zion-v31-node` cold-standby config na edge pro disaster promote

---

## 7. OPEN / TBD
- EDGE2 specy (doplnit po SSH) — při ≥8c/16GB zvážit 4. follower nebo NCL GPU lane
- Contabo private network mezi boxy? → pokud ano, allowlist na private IP (rychlejší+bezpečnější)
- ZIS DB backend (sqlite vs PG) — ověřit při P4
- Stratum TLS LE renewal hook — přesun na EDGE2 + UFW 8445 open jen pro mining WAN (jako dnes)
