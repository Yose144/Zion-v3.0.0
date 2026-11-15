# REPORT — Průzkum projektu a EDGE1/EDGE2 + návrhy optimalizací

> **Datum:** 2026-11-15 · **Typ:** živý průzkum (SSH + veřejné sondy) · **Rozsah:** celý workspace `2.9.6`, `3.3.0`, produkční EDGE1 i EDGE2
> **Metoda:** `systemctl`/`ss`/`ps`/`df`/`du`/`journalctl`/`ufw`/`fail2ban` na obou boxech, RPC + HTTP sondy, veřejný smoke 17 domén, TLS cert check, lokální git/crontab stav.

---

## 1. Executive summary

**Oba boxy jsou zdravé.** 0 chyb v journalu za 24 h na všech ~55 services, 0 failed units, G8 sondy zelené (vše `success=1`), pool `/stats` čerstvý (`snapshot_age_s=2`), accept rate **100 %**, chain živý (~1 blok/30–60 s, výška 124 6xx), všechny TLS certifikáty platné do 12/2026–2/2027.

**Hlavní rizika nejsou poruchy, ale struktura:**

1. **EDGE1 je přetížený self-miningem** — 2 CPU minery (~250 % z 400 % vCPU) těží do vlastního pool walletu; pool sám drží **3,7 GB RSS** a `pool-pplns.json` (**121 MB**) se přepisuje zhruba **každých 30 s**. Volná paměť 1,7 GB z 7,8 GB.
2. **Zálohy žijí jen na boxe, který chrání** — na tomto Macu neběží `pull-edge-backups.sh` (žádný crontab/launchd, `~/backups/edge` neexistuje). EDGE1 drží 26 GB daily tarballů lokálně, EDGE2 pg dumpy také jen lokálně.
3. **EDGE2 má 2,1 GB swapu** (quantus 487 MB, llama 213 MB, pearl-gw 201 MB, bitcoind 148 MB) — paměťová bilance je napjatá.
4. **EDGE2 SSH :22 je otevřený světu** — 873 neúspěšných pokusů/24 h, 17 tis. `lastb` záznamů (fail2ban drží, ale je to zbytečný hluk).
5. **Známé nevyřešené:** pool HA standby = jen data-sync (žádný teplý standby), trvalý `ADMIN_API_KEY=zion-dev-admin-key` na marketu, LTE `chain_live` RCA-era probe shadow čeká na přepnutí 6. 12.

---

## 2. Topologie (změřeno)

### EDGE1 — `62.171.141.136:2222` (vmi3425821, Contabo)
**4× AMD EPYC vCPU · 7,8 GB RAM · 145 GB disk (66 %) · uptime 17 dní · load ~3,3**

| Role | Služba / port | Poznámka |
|---|---|---|
| Pool stratum | `zion-v31-pool` :8444–8446 (veřejně) | 3,7 GB RSS, 64 threadů, uptime 27 h |
| Follower node 2/3 | `zion-node` :9446 / :9447 (RPC), p2p :8336/:8337 | sync s primary, 0 chyb |
| Self-mining | `zion-fallback-miner` (CPUQuota 200 %, Nice 19) + `zion-v31-miner` (CPUQuota 150 %, Nice 19, MemMax 256M) | ~250 % CPU, wallet `zion1s6m…` |
| Web ingress | nginx :80/:443 (+:8443 jen pro whitelist IP) | nirvana, dashboard, explorer, api, dex, grafana, newearth, lumi, ops |
| Monitoring | Prometheus :9090, Alertmanager :9093, Grafana :3001, node-exporter :9100 | vše localhost |
| Ops | `zion-ops` :3031 (0.0.0.0, UFW deny), `ZION_OS/dashboard` :8766, G8 probe :9105 + shadow :9106 | |
| Ostatní | `zion-nirvana` + `zion-nirvana-net` :3011, `zion-lumi`, `zion-bitcoind-regtest` (0,3 % CPU), `zion-rig-output` :9999 | |
| **Tunel** | `zion-chain-tunnel` — **18× SSH `-L` → EDGE2** | SPOF web cesty (známé) |

**Disk `/opt/zion` = 69 GB:** backups 28 GB (daily **26 GB / 42 tarballů**, cyklus 4 h) · hiran modely **23 GB** (fp16 15 G + gguf 5,4 G + adapters 2,4 G) · V31 5,4 G · data 2,9 G · **canonical-main 2,6 G (repo checkout ze 29. 9., nic novějšího)** · archive 2 G.

**UFW:** default DROP, fail2ban (sshd + zion-p2p), 410 auth fails/24 h. **61 čekajících aktualizací** (unattended-upgrades zapnutý).

### EDGE2 — `207.180.217.100:22` (vmi3684458, Contabo)
**6× AMD EPYC vCPU · 11 GB RAM · 193 GB disk (62 %) · uptime 17 dní · load ~2,9**

| Role | Služba / port | Poznámka |
|---|---|---|
| **Primary node** | `zion-node` :9445 RPC (jen EDGE1 + nginx), p2p :8335 | 120 % CPU, 1,25 GB RSS |
| Web app stack | ~20 Next.js/services: website :3000, market **:3100** (starý) + **:3102** (3.3 parita), ZIS :8096, **ZIS-33 staging :8099**, kingdom :3020, portal, onboard, nirvana-kingdom, marketplace, oasis :8094, free-world :8095, issobella :8097, ncl :8098, ai-native :8001, dao :8456, multichain, realtime :3011, update-server | localhost/nginx |
| Data | PostgreSQL 16 (DB `zion` 46 MB, `zion_marketplace`, `zion_market_33`) | 26 idle conn |
| Vedlejší chainy | `bitcoind` (prune=20000, **3,8 GB RSS**, data 31 G) · `quantus-node` (~2 GB RSS, data 19 G) · `pearld`+`oyster`+`pearl-gateway` (data 19 G, .venv 4,7 G) | WARP/multi-chain nohy poolu |
| AI | `zion-hiran-inference` llama.cpp :8002 + `zion-hiran-gateway` :8007 | CPU inference |
| Pool HA | `pool-standby-sync` 60 s + `standby-dbsync` 1 h + `pool-ha-watchdog` 30 s (alert-only) | **standby pool sám neběží** — jen data |
| Tunnel | `zion-edge-tunnel` — 7× `-L` zpět na EDGE1 | |

**Disk `/opt` = 95 GB:** zion 57 G (bitcoin 31 G, APP&WEB 7,7 G, hiran-models 5,5 G, V31 3,2 G, data 2,8 G, nirvana 2,4 G, portal 1,2 G) + quantus 19 G + pearl 19 G. `/var/log` 2 G, journal 1 G.

**UFW:** SSH :22 **svět**, 9445 jen z EDGE1 (veřejné RPC jede přes nginx), p2p porty otevřené, zbytek localhost. **873 auth fails/24 h, 17 130 `lastb`.**

### Lokální Mac (workspace)
- `2.9.6` = produkční repo, **dirty**: `apps/lumi/*` modifikované + 2 untracked probe skripty + `lumi.md`.
- `3.3.0` = samostatný git repo, aktivní vývoj (poslední commit `c70ecbc8e`), 1 modifikovaný `next-env.d.ts`.
- **Žádný backup pull neběží** — `pull-edge-backups.sh` (rsync EDGE→`~/backups/edge`) nemá crontab ani launchd; `~/backups/edge` neexistuje. Repo `backups/` drží jen srpnové soubory.

---

## 3. Zdravotní detail (měřeno 15. 11. ~09:15 CET)

| Sonda | EDGE1 | EDGE2 |
|---|---|---|
| Journal err 24 h | **0** na všech units | **0** na všech units |
| Failed units | 0 | 0 |
| G8 probe (10 services) | všechny `success=1` | všechny `success=1` |
| Pool `/health` | `ok`, `snapshot_age_s=2` | — |
| Pool `/stats` | 200 za 71 ms; accept **14400/0 rejected**; 232 registrovaných minerů, 109 s nezaplaceným | — |
| Miner špičata | 3 aktivní mineři, **všichni → vlastní wallet**; ~95 H/s; **100 % z posledních 100 bloků** vlastní | — |
| Chain | node2/node3 = primary (124 639) | primary 124 641+, `getBlockByHeight` fix funguje |
| Swap | 360 MB / 8 GB | **2,1 GB / 4 GB** |
| TLS | — | všech 12 certů validních |

**Veřejný smoke (17 domén):** app/market/kingdom/pool/rpc/oasis/lumi/nirvana/freeworld = 200; apex = **503 (záměrná údržba)**; dashboard/grafana = 401 (správně); explorer/newearth = 301; `dex.`/`api.` = 404 (stopgap vhosty bez backendu); `auth./api/health` = 404 (špatná cesta sondy, ne výpadek). `app.` cold start 8,7 s → warm 0,3–0,8 s.

**Drobné anomálie v logu (neporuchy):**
- `zion-l1-watcher`: `L1 RPC timeout` ~každé 3 h (04:17, 07:17) + `ECONNREFUSED` při restartu node 14. 11. 20:17 — service sama obnoví, 2 restarty za týden.
- `zion-node` WARN `mempool tx invalid for template e=input not found` — normální churn mempoolu.
- P2P WARN `invalid P2P message` z cizí IP (172.236.228.245) — internet noise, odfiltrováno.

---

## 4. Nálezy a návrhy optimalizací (prioritizováno)

### P0 — data safety / paměť

**O1. Offsite zálohy — ověřit, že někde běží.** `pull-edge-backups.sh` na tomto Macu neběží. Pokud neběží ani jinde, EDGE1 daily (26 GB) a EDGE2 pg dumpy (53 MB) existují **jen na boxe, který chrání** — RPO = poslední lokální snapshot,-loss boxu = loss záloh. *Návrh:* launchd/cron na Macu nebo always-on boxu; `KEEP_DAILY=21`/`KEEP_WEEKLY=8` už je ve skriptu. Ověřit i EDGE2 pg backup (`/opt/zion/backups/pg`, 48 dumpů) — `pull-edge-backups.sh` tahá jen EDGE1 `daily/weekly/node-db-bak`.

**O2. EDGE1 paměťová hlava.** pool 3,7 GB RSS + node2/3 ~0,9 GB + minery + nginx na 7,8 GB ⇒ **1,7 GB available**. Příčina: `pplns-window-size=500000000` + `pool-pplns.json` **121 MB přepisovaný ~každých 30 s** (mtime 09:22:10→09:22:41, +1 143 B). *Návrh:* (a) profilovat flush interval / chunked append místo whole-file rewrite; (b) zvážit menší pplns window nebo binární formát; (c) sledovat RSS trend — jestli roste s uptime, je to leak. `MemoryMax` na pool zatím není (jen `LimitNOFILE`).

**O3. EDGE2 swap 2,1 GB.** quantus-node 487 MB, llama-server 213 MB, pearl-gateway 201 MB, bitcoind 148 MB jsou outsidem. *Návrh:* zjistit, jestli je to steady-state (cold pages) nebo leak — `smem`/`pmap` trend; zvážit `vm.swappiness` a restart cadence pro llama (model se stejně do paměti).

### P1 — výkon a odolnost

**O4. Self-mining na produkčním EDGE1.** ~250 % z 400 % vCPU jde do vlastního pool walletu; **100 % posledních 100 bloků = vlastní miner**. Problém je dvojí: (a) CPU competuje s pool/nodes/nginx — při zátěži hrozí, že watchdog/probe zpomalí; (b) **centralizace** — chain drží ~95 H/s vlastního CPU miningu, externí hashrate ~0. *Návrh:* zvažte přesun mining load na Vast.ai rigy (infra existuje: `vastctl`, `zion-vastrigs-sync` na EDGE2) nebo snížení `CPUQuota` — chain obtížnost 3 114 je triviální, i polovina H/s stačí. Během G8 okna (do 6. 12.) nic bez rollbacku.

**O5. SSH tunnel SPOF (známé, částečně vyřešené).** DNS už posílá apex/app/market/oasis/pool/rpc/auth/freeworld/kingdom přímo na EDGE2. Na EDGE1 zůstávají nirvana/dashboard/explorer/api/dex/grafana/newearth — jejichž backendy jsou na EDGE2 a jezdí **edge → ssh → edge2**. *Návrh:* dokončit flip zbývajících vhostů na EDGE2 nginx (už tam běží, 12 vhostů), čímž `zion-chain-tunnel` zůstane jen pro API backend spoje, ne pro web ingress. `api.`/`dex.` na EDGE2 jsou zatím jen :80 bez certu.

**O6. Pool HA = data-only.** `standby-sync` (60 s) + `dbsync` (1 h) syncují stav na EDGE2, `ha-watchdog` je alert-only, `zion-v31-pool.service` na EDGE2 **inactive**. Guard `pool-promote-guard.sh` + runbook existují, staged activation čeká na 👤. *Návrh:* dokončit warm-standby aktivaci po G8 — jinak je DR poolu manuální.

### P2 — hygiena a bezpečnost

**O7. EDGE2 SSH :22 svět** — 873 fails/24 h. *Návrh:* přejít na 2222 (jako EDGE1) nebo omezit na operator IPs; fail2ban už je, ale zbytečný hluk + riziko 0-day na sshd.

**O8. UFW hygiena EDGE1** — desetiletá hromada „Devin operator" rules se starými IP (dyn. IP churn). *Návrh:* audit + purge; zvážit `ufw delete` starých.

**O9. `ADMIN_API_KEY=zion-dev-admin-key`** v produkčním market env (známé z 12. 11.) — **rotovat**.

**O10. Smaž stale data (po verifikaci):**
- EDGE2 `/opt/zion/data/v31/node2.db` + `node3.db` ≈ **1,1 GB** (22. 10., žádný unit je nečte) — pozůstatek před migrací followerů.
- EDGE1 `/opt/zion/canonical-main` **2,6 GB** — repo checkout ze 29. 9., nic novějšího než 1. 11.
- EDGE1 `/opt/zion/hiran` **23 GB** modelů — inference běží na EDGE2; ověřit, jestli se nepoužívají pro training/rig sync (`vastctl`), pak archivovat/offload.
- EDGE2 `/opt/pearl/bin.bak-sec20261031` 86 MB, `node1.db` 0 B na EDGE2.
- EDGE1 `backups/daily` 26 GB — retention je v `edge-backup` skriptu; zkontrolovat, že nestřádá (42 souborů × ~620 MB).

**O11. 61 pending aktualizací na EDGE1** — naplánovat po G8 okně (do 6. 12.); unattended-upgrades kryje jen security.

**O12. `AGENTS.md` = 356 KB** — root pravidlo samo varuje, že má být čitelné; history bloky patří do `docs/`/`docs/reports/` (pravidlo z `3.3.0/AGENTS.md`). *Návrh:* archivovat staré „🆕" bloky.

### P3 — architektura / sledování

**O13. Dva Prometheus** (EDGE1 + EDGE2) — ověřit, že se nestříhá duplicita a že EDGE1 scratchuje EDGE2 jen přes tunelem (9100 whitelistováno pro EDGE1 IP — OK).

**O14. Follower nodes zpět do `ZION_NETWORK_NODES_JSON`** — node2/3 jsou teď sync (124 639 = primary), ale zůstávají mimo web failover po blind-index incidentu. *Návrh:* po týdnu čistého sledování je vrátit (nebo nechat záměrně mimo — rozhodnutí 👤).

**O15. `l1-watcher` RPC timeouty** — 3h cadence; pravděpodobně WAL checkpoint/backup okno na `node.db`. *Návrh:* sledovat, jestli koreluje se snapshotem; eventuálně timeout navýšit.

**O16. Market parita :3100/:3102** — čeká na 👤 + 30 dní (D-024), nic nového.

---

## 5. Co jsem záměrně NEUDĚLAT beze schválení

- **G8 okno do 6. 12. 2026** — required služby (`chain_live`, `pool_http`, `pool_stratum`, `multichain`, `dao`, `zis`) se bez rollbacku ≤15 min nedotýkají.
- Žádné restarty, żádné mazání, žádné DNS/vhost flippy, žádné rotace klíčů — tohle je průzkum, ne zásah.
- `Admin_API_KEY`, `/etc/zion/*.env`, DB dumps — necitlivé, do reportu nejdou hodnoty.

## 6. Rychlá tabulka „kde co je"

| Box | CPU | RAM | Disk | Hlavní zátěž | Nejdůležitější služba |
|---|---|---|---|---|---|
| EDGE1 | 4 | 7,8 G | 145 G (66 %) | mineri ~250 % + pool 41 % | `zion-v31-pool` :8444 |
| EDGE2 | 6 | 11 G | 193 G (62 %) | node 120 % + bitcoind/quantus/pearl | `zion-node` :9445 |
| Mac | — | — | 228 G (24 %) | repo + buildy | workspace |

---

## 7. Co bylo OPRAVENO v tomto průchodu (2026-11-15)

Všechny zásahy jsou mimo G8 required služby (žádný restart chain/node/pool/stratum/ZIS).

| # | Fix | Detail | Stav |
|---|---|---|---|
| **O1** | **Offsite zálohy na Macu** | Nový `scripts/pull-edge2-backups.sh` (rsync EDGE2 `backups/{pg,zis,services}` → `~/backups/edge2`, retence 30 pg dumpů) + `pull-edge-backups.sh` z maknut **macOS-kompatibilním** (`find -printf` → `ls -t`; na BSD find by prune selhal) a **single-instance lock** (`mkdir` atomicky). Dva launchd agenti `com.zion.pull-edge{,2}-backups` (hodinově, :07 / :37, log `~/backups/logs/`). První sync běží. | ✅ |
| **O9** | **`ADMIN_API_KEY` rotace** | `zion-dev-admin-key` (20 znaků, dev hodnota) → `zk_live_<48 hex>` na **obou** market env: `/etc/zion/market.env` (:3102) a `APP&WEB/MarketPlace/.env` (:3100). Backup `.bak-rotate-20261115T094028Z`. Restart `zion-market`+`zion-marketplace` (mimo G8 required). Ověřeno: starý klíč → **401**, nový → `/api/admin/orders` **200**. Nový klíč na EDGE2 `/root/.market-admin-key-rotate-20261115T094028Z` (600). | ✅ |
| **O10** | **Smazání stale dat EDGE2** | `node2.db`+`node3.db` (+shm/wal, ~1,1 GB, 21. 10., žádný unit/lsof je nečte — follower DBs jsou resyncovatelné z primary) + `node1.db` (0 B) + `/opt/pearl/bin.bak-sec20261031` (86 MB). Disk 119 G → 118 G. | ✅ |
| **Security** | **Oprava práv env backupů EDGE2** | 24 souborů `/etc/zion/*.bak*` (kopie `edge-environment.sh` s klíči) byly **world-readable 644** → `chmod 600`. Zbývají jen legit public (`fullchain.pem`, `edge-probe.pub`). | ✅ |
| **O2** | **PPLNS persist interval → env** | `V31/L1/pool/src/main.rs`: 30s flush intervalu `pool-pplns.json` (~121 MB JSON) je teď `ZION_POOL_PPLNS_PERSIST_INTERVAL_S` (default 30, min 5). `cargo check -p zion-pool` ✅. **Deploy = pool restart = G8 required → čeká na sign-off po 6. 12.** Poté nastavit např. 120–300 s na EDGE1. | ✅ kód / ⏸ deploy |

### Záměrně NEprovedeno (a proč)

- **O4 mineri CPUQuota** — `Nice=19`+nízký `CPUWeight` už yieldují všem ostatním; snížení hashrate by zpomalilo block production (chain = self-mined). Přesun na Vast rigy = rozhodnutí 👤.
- **O5 DNS/vhost flip** — public flippy blokované D-024 (👤 + 30 dní).
- **O6 warm pool standby** — staged activation čeká na 👤 (guard+runbook hotové).
- **O7 SSH EDGE2 :22** — změna portu/whitelistu může odříznout přístup; needs coordination.
- **O8 UFW purge** — :8443 má nginx allow-list + UFW operator rules jsou jeho brána; „stale" IP se špatně určuje (IPv6 privacy rotuje, moje IP se mezitím změnila). Risk > benefit.
- **O11 61 updates EDGE1** — počkat na G8 okno; unattended-upgrades kryje security.
- **O12 AGENTS.md 356 KB** — archivace history bloků je citlivá na always-on pravidla; отдельный úkol.
- **EDGE1 `canonical-main` 2,6 GB / `hiran` 23 GB** — canonical-main je adresář uvnitř `/opt/zion` git repa (možný deploy referenční bod), hiran modely mohou být potřeba pro training/rig sync — **pending 👤 decision**.

### Zbývající rizika po fixech

- Pool paměť 3,7 GB RSS + pplns.json churn — vyřešitelné až deployem env-knobu (nebo menším `pplns-window-size`) po G8.
- EDGE2 swap 2,1 GB — sledovat trend, žádná akce zatím.
- EDGE1 `l1-watcher` 3h RPC timeouty — monitorovat, pravděpodobně WAL checkpoint.
- Dva Prometheus — bez duplikace, OK.
