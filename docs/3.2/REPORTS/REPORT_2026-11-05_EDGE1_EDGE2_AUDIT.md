# REPORT 2026-11-05 — EDGE1/EDGE2 živý audit + oprava veřejných endpointů

> **Rozsah:** živé sondy na oba boxy (systemctl, ss, journalctl, sqlite, RPC, curl publicly) + repo/docs kontrola. **Metoda:** přímé SSH (`edge`, `zion-edge2`) + veřejné HTTPS sondy z lokálního stroje.
> **Výsledek:** infrastruktura zdravá, 3 rozbité veřejné endpointy opraveny a nasazeny, DNSMigrace částečně zdokumentována.

---

## 1. Topologie — SKUTEČNÝ stav (odlišný od dokumentace)

**Web ingress se přestěhoval na EDGE2.** Na EDGE2 nově běží `nginx` (:80/:443, 7 workerů) s 12 vhosty. DNS zónu děluje:

| DNS → EDGE2 `207.180.217.100` (nginx → lokální služby) | DNS → EDGE `62.171.141.136` (nginx → lokální/tunel) |
|---|---|
| `zionterranova.com`, `www`, `app`, `market`, `oasis`, `pool`, `rpc`, `auth` (ZIS), `freeworld`, `kingdom` | `nirvana`, `dashboard`, `explorer`, `api`, `dex`, `grafana`, `newearth.cz` |

EDGE2 nginx proxy destinations (naměřeno): `app`→:3000 + `/rig-output/`→EDGE, `market`→:3100+:8007, `oasis`→:8094/:8095/:8096, `pool`→:8080 (edge-tunnel) + :8088/:8096, `rpc`→:9445+:9944, `auth`→:8096 (ZIS), `api`→:8007 (hiran-gateway), `dex`→:8454 (warpd), `freeworld`→:3000, `kingdom`→:3020, apex→static/intro.

**Důsledek:** `README.md`/`StatusV3.md`/`REPO-MAP.md`/`ECOSYSTEM-INVENTORY.md` popisovaly EDGE jako jediný ingress — aktualizováno.

## 2. EDGE1 `62.171.141.136` (vmi3425821) — pool + followeři + ops

| Metrika | Stav |
|---|---|
| Uptime / load | 7d 16h, load ~3 (záměrný mining load, `Nice=19`) |
| Disk / RAM | **58 %** (83/145 G) / 5,6 z 7,8 GB (**volné ~2,2 GB** — nejtěsnější box; `zion-pool` 2,4 GB) |
| Failed units | 0 (jen benign `systemd-networkd-wait-online`) |
| ZION chain | node2 **110 559** = primary ✓, node3 110 558 (1 za, syncuje) |
| Pool | build `d786449b0`, restart 05.11. 07:42 CET (způsobil 60s G8 incident), **1 234 bloků/24 h — všechny accepted** |
| Coiny | 12 live (zion, prl×2, qtc×2, zano, zcl, zec, vrsc, evr, krx, mewc, phx, rtm), všechny nohy connected |
| Payout backlog | **52 aktivních unconfirmed ≈ 74 890 ZION** (nejstarší 29. 10. — na 7denní hranici resurrect); +723 superseded evidence rows |
| `submitBlock previous hash mismatch` | 662×/24 h = retry na ne-tip-affine endpointu; **0 ztracených bloků** — WARN noise, ne incident |
| Backupy | `zion-edge-backup` běží (naposledy ~40 min), `zion-v31-watchdog` 60s timer |

## 3. EDGE2 `207.180.217.100` (vmi3684458) — primary + app stack + nginx

| Metrika | Stav |
|---|---|
| Uptime / load | 7d 16h, load ~1,5 |
| Disk / RAM | **58 %** (111/193 G) / 5 z 11 GB (6,7 volných) |
| Failed units | **0** — všech ~30 sluieb active |
| ZION chain | **110 559**, diff 4399, 7 aktivních peerů, tip `00a3553d…` — soulad s followery |
| Multichain | bitcoind, quantus (40 peerů, synced), pearld/gateway/oyster, postgres 16, warpd — vše OK |
| Payouty | `payout_confirmed` + `payout_broadcast` v logu; `QTC_PAYOUT_ENABLED=0` potvrzeno v `/etc/zion/edge-environment.sh`; `PRL_PAYOUT_DRY_RUN=1`; BTC swap `WARP_BTC_SWAP_ENABLED=0` |
| HA pool | `zion-pool-standby-sync.timer` 60s aktivní (replikace), standby daemon inactive — čeká fencing rozhodnutí (zdokumentováno) |
| `zion-v31-node.service` | **`enabled`** — křehkost z 31. 10. (implicitní start přes multichain) je **opravena** |
| Backupy | `zion-pg-backup` denně (naposledy ~7 h), `standby-dbsync` 60min |

## 4. Endpoint matice — PŘED → PO

| Endpoint | Před | Po |
|---|---|---|
| apex, www, app(+`/api/health`), nirvana, market, oasis, pool, rpc, auth, freeworld | 200 | 200 |
| dashboard. | 401 basic (záměr) | 401 |
| kingdom. | 503 maintenance (záměr) | 503 |
| explorer. | 301→app/explorer (záměr) | 301 |
| **api.** | **404** (DNS→EDGE, vhost jen na EDGE2 :80) | **200** `/health`, chat completions 401-auth reachable |
| **dex.** | **404** | **200** `/health`, `/v1/swap/pools` 200 |
| **grafana.** | **000** (HTTPS = default auth cert, name mismatch) | **200** + `/api/health` 200 |
| newearth.cz | 404/000 (vhost v `sites-available`, ne enabled) | **beze změny — čeká 👤 rozhodnutí** (cert i conf připraveny, `ln -s` od restore) |

## 5. Provedené změny (nasazeno 05.11. ~11:35–11:50 UTC)

Na **EDGE** (`/etc/nginx/sites-enabled/`):

1. **`api.zionterranova.com.conf`** (nový) — :80 ACME+proxy, :443 TLS → `http://207.180.217.100` (Host `api.`) → EDGE2 :80 vhost → hiran-gateway `:8007`. Zrcadlí i `/v1/chat/completions` streaming blok (buffering off, 300s).
2. **`dex.zionterranova.com.conf`** (nový) — :443 TLS → EDGE2 :80 dex vhost → warpd `:8454`; úzký povrch řeší upstream.
3. **`grafana.conf`** (přepsán) — :80→301, :443 TLS → `127.0.0.1:3001`.
4. **Cert:** `certbot certonly --webroot` → **`zion-ops-20261105`** (SAN: api+dex+grafana, exp 2027-02-03). `nginx -t` PASS před každým reloadem; graceful reload, bez výpadku.

**Varování — stopgap:** api./dex.EDGE vhosty jsou **dočasné** — až 👤 přepne DNS A na `207.180.217.100`, nejdřív na EDGE2 dobezpečně přidat :443 vhosty + `certbot --nginx` (HTTP-01 z EDGE2 projde až po flipu), pak EDGE vhosty z `sites-enabled` sundat. Repo kopie: `infra/nginx/edge-current/`.

## 6. G8 run #6 (`g8-20261029T234617Z`, cíl 28. 11. 23:46 UTC)

- **12 incidentů, 1 560 s / 2 592 s** povolených (99,9 %) → **zbývá ~17 min**
- Per-service uptime: chain_live 99,90 · pool_http 99,90 · pool_stratum 99,97 · multichain 99,91 · dao 99,92 · zis 99,91
- **Doporučení:** do 28. 11. žádné restarty/deployy na required službách bez rollbacku <15 min

### 6.1 RCA dvou nejnovějších incidentů (dopsáno 05. 11. odpoledne)

**05. 11. `pool_http`+`pool_stratum` 60 s (06:42 UTC) = pool restart — pravděpodobná příčina nalezena:**
- `journalctl` před restartem (07:41–07:42 CET): `zion_pool::api: pool_api_shed_load in_flight=64` opakovaně — **pool API bylo saturée** (64 concurrent requestů, shed-load WARN)
- `zion-v31-miner` i `zion-fallback-miner` watchdogy exponentovaly ~07:41 ("no share accepted/rejected for 300s") — CPU minery na EDGE restartovány systemd
- Pool restart 07:42:22 CET je čistý (`NRestarts=0`) — nejde o crash; pravděpodobně **`zion-pool-wedgewatch`** (detekce zaseknutí → auto-restart) po API saturaci
- **Dopad:** 60s G8 incident + krátký výpadek stratum pro minery. **Opatření:** sledovat `pool_api_shed_load` — opakování = further G8 budget burn; zvážit rate-limit/queue na `/api/v1/*` scrape cesty (standby-sync 60s + prometheus + public API)

**04. 11. `chain_live` 360 s (15:23–15:29 UTC) = probe-path stall, NE konsenzus:**
- Prometheus `zion_g8_chain_tip_age_seconds`: tip age rostl lineárně **~16–20 min** (15:12–15:28 UTC, max ~1 195 s) → reset 15:29; znovu ~10min stall 15:30–15:39
- NODE na EDGE2 **přijímal bloky normálně** celou dobu (journal `accepted block` 109475→109502+,.followers syncovali `109532..` v 15:29) → **řetězec rostl, probe neviděl čerstvý tip**
- `chain_live` = `tip_timestamp` freshness z node probe (g8_probe_exporter.py) — probe z EDGE na nody (EDGE2 :9445 přes `zion-chain-tunnel` + lokální 9446/9447). **Pravděpodobná příčina:** RPC/probe path stall (tunnel flap / RPC lock), ne P2P
- **Dopad:** 360s G8 incident. **Opatření:** prověřit `zion-chain-tunnel` stabilitu (známé flapování) + RPC latency pod load; zvážit probe fallback primaries

## 7. Otevřené položky (navazující)

| # | Položka | Kdo |
|---|---|---|
| 1 | DNS flip `api.`+`dex.` → EDGE2 + certbot --nginx na EDGE2 (pak EDGE vhosty sundat) | 👤 DNS panel → 🤖 zbytek |
| 2 | `newearth.cz` — restore (conf+cert připraveny) nebo retire | 👤 |
| 3 | G8: pochopit `chain_live` 360 s incident (04. 11.) + hlídat budget ~17 min | 🤖/👤 |
| 4 | 52 ZION payoutů na 7denní hranici — ověřit, že sweep resurrectuje | 🤖 monitoring |
| 5 | QTC treasury funding + re-enable (leg zůstává OFF) | 👤 |
| 6 | PRL payout flip, BTC swap pilot, node reward, release tag v3.2.0, HA stratum armed, G9 audit | 👤 (viz PLAN.md §4) |
| 7 | EDGE RAM 2,2 GB volných — sledovat; `submitBlock mismatch` WARN = zvážit log-level | 🤖 |

---
*Provedeno: Devin, 2026-11-05. Důkazy: živé sondy výše; repo diff `infra/nginx/edge-current/`.*
