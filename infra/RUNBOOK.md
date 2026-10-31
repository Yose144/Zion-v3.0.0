# RUNBOOK — deploy, restart, diagnostika, rollback

> Kanonická operativní příručka po cutoveru 2026-10-22 (web tier na EDGE2).
> Topologie detailně: `docs/ECOSYSTEM-REBUILD-PLAN.md` §1, live stav: `AGENTS.md`.

## Hosté a přístup

| Host | Alias | IP / port | Role |
|---|---|---|---|
| EDGE2 — web ingress + app/data hub | `zion-edge2` | `207.180.217.100` :22 | nginx :80/:443, weby, ZIS, L1 node, služby |
| EDGE — chain/mining tier | `zion-v6` (IPv6), `zion-new` (IPv4 :2222) | `62.171.141.136` | pool stratum/API, node followeři, monitoring, fallback vhosty |

Klíč: `~/.ssh/zion-edge-post-wipe-2026-07-29` (oba boxy, root).

## Deploy jednotlivých povrchů

Všechny skripty: lokální build → rsync → restart/reload → smoke check (nezero exit při selhání). Host je přepíšitelný env `*_HOST`.

| Plocha | Skript | Cíl (default) | Remote | Servis |
|---|---|---|---|---|
| app.zionterranova.com | `apps/website-v2.9/deploy/deploy-web2.9.sh` | `zion-edge2` | `/opt/zion/APP&WEB/website-v2.9` | `zion-website` restart |
| zionterranova.com (intro) | `apps/IntroPage/deploy/deploy-intro.sh` | `zion-edge2` | `/var/www/zion-maintenance` | nginx reload |
| freeworld.zionterranova.com | `apps/IntroPage/freeworld/deploy/deploy-freeworld.sh` | `zion-edge2` | `/var/www/freeworld` | nginx reload |
| oasis.zionterranova.com | `apps/OasisWeb/deploy/deploy-oasis-web.sh` | `zion-edge2` | `/var/www/oasis` | nginx reload |
| pool.zionterranova.com | `apps/pool-ui/deploy/deploy-pool.sh` | `zion-edge2` | `/var/www/pool` | nginx reload (`--nginx` instaluje vhost z `infra/nginx/edge2/`) |
| auth.zionterranova.com | `apps/identity/deploy/deploy-zis.sh` | `zion-edge2` (service + nginx) | `/opt/zion/identity` | `zion-zis` restart |
| market.zionterranova.com | `apps/MarketPlace/deploy/deploy-marketplace.sh` | `zion-edge2` | `/opt/zion/APP&WEB/MarketPlace` | `zion-marketplace` restart |
| nirvana.zionterranova.com | `apps/nirvana/deploy/deploy-nirvana.sh` | **`zion-new`** (EDGE — viz pozn. níže) | `/opt/zion/APP&WEB/nirvana` | `zion-nirvana` restart |

⚠️ **Fallback:** Edge (`zion-v6`) drží staré kopie `/var/www/*` a fallback vhosty (do F6). Deploy skripty je nemirrují — fallback servíruje stav z cutoveru.

⚠️ **nirvana. = výjimka z web-tier pravidla:** nasazena na **EDGE** (`zion-new`, port 3010) — DNS `nirvana.` resolvuje přes wildcard `* → 62.171.141.136` (explicitní A záznam zatím není). OASIS data tahá přes `OASIS_API_URL=http://127.0.0.1:8094` = chain-tunnel leg → reálný OASIS backend na EDGE2. **Fáze 2 (wildcard→EDGE2):** přidat explicitní `nirvana A 207.180.217.100` + nasadit instanci na EDGE2 (`ZION_EDGE_HOST=zion-edge2 bash apps/nirvana/deploy/deploy-nirvana.sh`) + certbot vhost tam — jinak po flipu doména umře.

## Restart / status služeb

```bash
# EDGE2
ssh zion-edge2 'systemctl restart zion-website'        # app web :3000
ssh zion-edge2 'systemctl restart zion-marketplace'    # market app :3100
ssh zion-edge2 'systemctl restart zion-zis'            # auth :8096
ssh zion-edge2 'systemctl restart zion-v31-free-world' # L5 :8095
ssh zion-edge2 'systemctl restart zion-v31-oasis'      # OASIS API :8094
ssh zion-edge2 'systemctl restart zion-v31-ncl'        # NCL :8098
ssh zion-edge2 'systemctl restart zion-v31-dao'        # DAO :8456
ssh zion-edge2 'systemctl restart zion-v31-node'       # L1 node RPC :9445
ssh zion-edge2 'systemctl restart zion-v31-multichain' # WARP :8453/:8454
ssh zion-edge2 'systemctl restart zion-v31-ai-native'  # ai-native :8001
ssh zion-edge2 'nginx -t && systemctl reload nginx'

# EDGE (chain/mining — opatrně, pool je produkční)
ssh zion-v6 'systemctl restart zion-v31-pool'   # stratum 8444/8445, API :8080 (~10s reconnect minerů)
ssh zion-v6 'systemctl restart zion-v31-node2'  # follower :9446
ssh zion-v6 'systemctl restart zion-v31-node3'  # follower :9447
ssh zion-v6 'systemctl restart zion-g8-probe'   # G8 probe :9105
ssh zion-v6 'systemctl restart zion-nirvana'    # nirvana web :3010 (Next.js standalone)
```

Health: `curl https://app.zionterranova.com/api/health` (28 služeb), `https://auth.zionterranova.com/health`, `https://pool.zionterranova.com/public/v1/coins`, `https://nirvana.zionterranova.com/api/oasis/worlds` (proxy → OASIS přes chain-tunnel).

## Co dělat když…

- **404 na obrázcích/docs po deployi webu** → standalone servíruje `public/` jen z `.next/standalone/public/`. `deploy-web2.9.sh` to řeší; při ručním hot-deployi zkopírovat soubor na **obě** místa (`public/…` i `.next/standalone/public/…`).
- **Nový public soubor = 404** → standalone drží manifest ze startu → `systemctl restart zion-website`.
- **`pool.` API 5xx / `/public/v1` prázdné** → edge2→edge tunel leg `:8080` (`zion-edge-tunnel` na EDGE2): `ssh zion-edge2 'systemctl status zion-edge-tunnel'`, `ssh zion-v6 'systemctl status zion-v31-pool'`.
- **app API/data prázdné, stránky 200 ale bez čísel** → edge→edge2 `zion-chain-tunnel` na Edgi: `ssh zion-v6 'systemctl status zion-chain-tunnel'` (legs: 9445/9944/44207/8332/8453/8454/8456/8094-8098/5432/3000/3100/8001).
- **Cert renewal** → všechny veřejné domény obnovuje certbot na **EDGE2** (`certbot renew --dry-run`); `dashboard.` + `newearth` renewal je na Edgi (DNS tam ukazuje).
- **Disk full** → `df -h`, `journalctl --vacuum-size=500M`, staré `.next.bak-*` a `oasis.bak-*` v `/var/www`, `docker system df`.
- **fail2ban lockout operátora** → jail `sshd` na Edgi umí zabanovat vlastní IP při rychlých SSH auditech — `OPERATOR_IPS` v `V31/AGENTS.md`.
- **Pool DoS / stratum flood / session churn** → layered vrstvy + kernel tuning + incident checklist: [`docs/3.2/POOL-DOS-LAYERS.md`](../docs/3.2/POOL-DOS-LAYERS.md).

## Pool HA (active-passive) — STAV: připraveno, NEaktivováno

> Rozhodnutí 👤 2026-10-31: HA stack **dokumentovat + oficiálně aktivovat** (2.S5 uzavřeno ve prospěch A4.2 active-passive).
> **Aktivace je blokovaná, dokud není doložené fencing.** Detail: [`NIRVANA-V3.3-KRALOVSTVI-SRDCE-PLAN.md`](../NIRVANA-V3.3-KRALOVSTVI-SRDCE-PLAN.md) §W2.

### Co existuje (EDGE2)

| Unit | Role | Stav |
|---|---|---|
| `zion-pool-standby.service` | replika poolu (`/opt/zion/bin/zion-pool-standby`), nepublikuje stratum | **inactive** |
| `zion-pool-ha-watchdog.timer` | 30 s — vyhodnocuje health primary a rozhoduje o promote | active |
| `zion-pool-standby-sync.timer` | 60 s — `store.db` + `pool-pplns.json` + payout ledger z EDGE | active |
| `zion-pool-standby-dbsync.timer` | 60 min — plná DB replikace | active |

**RPO ≤ 15 min** (ověřeno drill 27. 10.: integrity ok, schema v9, 210 817 payout rows, ledger max = tip).
**RTO** závisí na zvoleném režimu — u `armed` watchdogu ≈ 30–60 s, u manuálního promote ≈ čas operátora.

### ⚠️ Proč to nesmí být `armed` bez fencingu

Promote **při zpomalení** místo **při smrti** primáru znamená, že obě instance chvíli píšou ledger → **dvojí výplata minerům**. To je nejdražší možná chyba v celém systému; payout historie se needituje zpětně.

**Podmínky aktivace (všechny tři):**

1. Watchdog rozlišuje **prokázaný fail** (proces/port/health dead po N po sobě jdoucích pokusech) od **degradace** (pomalá odpověď) — degradace nikdy nespouští promote.
2. Promote obsahuje **explicitní stop primary** (systemd stop na EDGE + verifikace, že primary opravdu neběží), ne jen „převzít roli".
3. Staged: **`log-only` mód ≥ 1 týden** bez falešného promote → teprve pak 👤 flip na `armed`.

### Manuální promote (dokud není `armed`)

```bash
# 1. STOP primary FIRST — jinak dvojí výplata
ssh <edge> "systemctl stop zion-v31-pool && systemctl is-active zion-v31-pool"   # musí vrátit inactive
# 2. ověř, že primary opravdu neběží (ne jen 'deactivating')
ssh <edge> "pgrep -af zion-pool || echo NO_PROCESS"
# 3. promote standby
ssh zion-edge2 "systemctl start zion-pool-standby && systemctl is-active zion-pool-standby"
# 4. ověř stratum + API + payout sweep
curl -s http://127.0.0.1:8080/stats | head -c 200
# 5. zapiš do incident logu: čas, důvod, kdo, RPO (poslední sync timestamp)
```

**Rollback (zpět na EDGE):** stop standby → ověř `NO_PROCESS` → start primary → ověř `/stats` a payout sweep. Nikdy nespouštěj obě instance současně, ani na „jen pár sekund".

### Failback

Watchdog **neumí** vrátit roli primáru zpět automaticky — failback je vždy 👤 manuální okno (stejná sekvence jako promote, jen opačně). Automatický failback = další příležitost na split-brain.

---

## DNS a veřejné povrchy (stav 2026-10-31)

| Hostname | Cíl | HTTP | Poznámka |
|---|---|---|---|
| `zionterranova.com`, `www.` | EDGE2 | 200 | static export `/var/www/zion-maintenance` |
| `app.` | EDGE2 | 200 | `zion-website` :3000 — **hlavní pracovní povrch** |
| `market.` | EDGE2 | 200 | `zion-marketplace` :3100 |
| `pool.` | EDGE2 | 200 | ingress → `zion-edge-tunnel` → EDGE :8080 |
| `oasis.` | EDGE2 | 200 | `/var/www/oasis` |
| `auth.` | EDGE2 | 200 | `zion-zis` :8096 — **cert expiruje 25. 11. 2026** |
| `freeworld.` | EDGE2 | 200 | `zion-v31-free-world` :8095 |
| `rpc.` | EDGE2 | 200 | veřejné RPC |
| `explorer.` | EDGE | 301 | web-tier cutover není úplný |
| `nirvana.` | EDGE | 200 | `zion-nirvana` :3010 (`User=zion`, `/opt/zion/APP&WEB/nirvana`) |
| `dashboard.` | EDGE | 401 | basic auth — **živé, ne mrtvé** |
| `api.` | **EDGE** (DNS) / EDGE2 (služba) | **404** | ⚠️ **není mrtvé** — `zion-hiran-gateway` běží na EDGE2 `127.0.0.1:8007` (`/health` 200, neauth chat `401`). Vhost `infra/nginx/edge2/api.zionterranova.com.conf` je v repu. Chybí vhost + cert + **DNS → EDGE2** (rozhodnutí 👤 31. 10.: publikovat) |
| `updates.` | EDGE | 404 | **mrtvé** → smazat A záznam (`update-server/` jen v `archive/`, mobile = preview) |
| `dex.` | **EDGE** (DNS) / EDGE2 (služba) | **404** | ⚠️ **není mrtvé** — warpd `:8454` (`/v1/swap/pools` 200). Chybí vhost + cert + **DNS → EDGE2** **a** endpoint `/prices/:token/history` (rozhodnutí 👤 31. 10.: doplnit + publikovat) |

**Pozor na past:** `api.` a `dex.` **nejsou** mrtvé povrchy — DNS vede na EDGE, ale služby žijí na EDGE2. Diagnóza `curl` = `000` + `ssl_verify_result=1` znamená **SAN mismatch**, ne „nic tam neběží". Vždy nejdřív `ss -tlnp` na EDGE2, pak teprve suď.

**Pravidlo:** veřejný povrch je buď **200/301**, nebo **DNS záznam neexistuje**. 404 na vlastním hostname = nedodělek, ne „placeholder".

---

## Rollback

- **Web:** `.next.bak-*` konvence — před riskantním deployem `ssh zion-edge2 "cp -a /opt/zion/APP\&WEB/website-v2.9/.next /opt/zion/APP\&WEB/website-v2.9/.next.bak-$(date -u +%Y%m%dT%H%M%SZ)-<tag>"`; zpět = přejmenovat + `systemctl restart zion-website`.
- **Statické weby:** rsync `--delete` → rollback = redeploy předchozího commitu (nebo `/var/www/*.bak-*` adresáře pokud existují).
- **Celý web-tier na Edge:** DNS 9 záznamů zpět na `62.171.141.136` — fallback vhosty na Edgi žijí (stale). Okno ≈ do expirace auth certu na Edgi.
- **nginx změna:** `nginx -t` vždy před reload; zálohy confů **mimo** `sites-enabled/` (include glob `*` načte i `.bak` → duplicate `server_name`).

## Ops lessons (2026-10-24)

- **`/etc/nginx/sites-enabled/*.bak` se PARSEUJE** — `include sites-enabled/*` bere všechny soubory. Zálohy confů vždy mimo: `/etc/nginx/backups/`.
- **Edge catch-all:** `zion-edge-download.conf` = `server_name 62.171.141.136` + `_`→`return 444` (IPv4+IPv6). IP `/zion-miner/` + `/rig-output/` zůstávají; neznámé Host = connection closed.
- **Service user ≠ root:** `zion-edge-backup` běží jako `zion` — soubory root:600 (`/data/zion/g8_run.json`) mu číst nejdou. Perms kontrolovat.
- **macOS case-insensitive FS:** `PUBLIC/` a `public/` = jeden adresář — při auditu duplicit rozlišovat `git ls-files`, ne `find`.
